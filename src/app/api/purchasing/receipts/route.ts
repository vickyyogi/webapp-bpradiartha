import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { requireAuthAndPermission } from "@/lib/permissions";
import { PurchaseOrderStatus } from "@prisma/client";

export async function GET (req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requireAuthAndPermission("purchase.receipt.view");
    if (!authCheck.authorized) {
      return authCheck.response;
    }

    const currentUser = await db.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const receipts = await db.goodsReceipt.findMany({
      where: {
        organizationId: currentUser.organizationId,
      },
      include: {
        purchaseOrder: {
          select: {
            id: true,
            poNumber: true,
            vendor: { select: { id: true, name: true } },
          },
        },
        receivedBy: { select: { id: true, fullName: true, email: true } },
        items: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ receipts });
  } catch (error) {
    console.error("GET /api/purchasing/receipts error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST (req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requireAuthAndPermission("purchase.receipt.create");
    if (!authCheck.authorized) {
      return authCheck.response;
    }

    const currentUser = await db.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json();
    const {
      purchaseOrderId,
      deliveryNoteNumber,
      receiptDate,
      notes,
      items = [], // array of { poItemId, quantityReceived, condition, autoStockToInventory }
    } = body;

    if (!purchaseOrderId || items.length === 0) {
      return NextResponse.json(
        { error: "Pilih Purchase Order dan minimal 1 item barang yang diterima." },
        { status: 400 }
      );
    }

    const po = await db.purchaseOrder.findFirst({
      where: {
        id: purchaseOrderId,
        organizationId: currentUser.organizationId,
      },
      include: {
        items: true,
      },
    });

    if (!po) {
      return NextResponse.json({ error: "Purchase Order tidak ditemukan." }, { status: 404 });
    }

    if (po.status === "COMPLETED" || po.status === "CANCELLED") {
      return NextResponse.json(
        { error: `Purchase Order berstatus ${po.status} dan tidak dapat diproses penerimaan lagi.` },
        { status: 400 }
      );
    }

    // Generate receipt number (GRN)
    const year = new Date().getFullYear();
    const count = await db.goodsReceipt.count({
      where: { organizationId: currentUser.organizationId },
    });
    const receiptNumber = `GRN-${year}-${String(count + 1).padStart(4, "0")}`;

    const result = await db.$transaction(async (tx) => {
      // Create GoodsReceipt
      const grn = await tx.goodsReceipt.create({
        data: {
          organizationId: currentUser.organizationId,
          branchId: po.branchId,
          purchaseOrderId: po.id,
          receiptNumber,
          receiptDate: receiptDate ? new Date(receiptDate) : new Date(),
          deliveryNoteNumber: deliveryNoteNumber || null,
          receivedById: currentUser.id,
          status: "RECEIVED",
          notes: notes || null,
        },
      });

      // Process each received item
      for (const item of items) {
        const poItem = po.items.find((pi) => pi.id === item.poItemId);
        if (!poItem) continue;

        const qty = Number(item.quantityReceived) || 0;
        if (qty <= 0) continue;

        const newReceivedQty = poItem.quantityReceived + qty;

        // Update PO item
        await tx.purchaseOrderItem.update({
          where: { id: poItem.id },
          data: { quantityReceived: newReceivedQty },
        });

        // Create GRN item
        const grnItem = await tx.goodsReceiptItem.create({
          data: {
            goodsReceiptId: grn.id,
            poItemId: poItem.id,
            itemName: poItem.itemName,
            unit: poItem.unit,
            quantityReceived: qty,
            condition: item.condition || "GOOD",
            itemType: poItem.itemType,
            inventoryItemId: poItem.inventoryItemId,
            isStocked: Boolean(item.autoStockToInventory && poItem.inventoryItemId),
            notes: item.notes || null,
          },
        });

        // Integration with Section 18: Auto-Stock into InventoryItem
        if (item.autoStockToInventory && poItem.inventoryItemId) {
          const invItem = await tx.inventoryItem.findFirst({
            where: { id: poItem.inventoryItemId },
          });

          if (invItem) {
            const stockBefore = invItem.currentStock;
            const stockAfter = stockBefore + qty;

            await tx.inventoryItem.update({
              where: { id: invItem.id },
              data: { currentStock: stockAfter },
            });

            await tx.inventoryTransaction.create({
              data: {
                itemId: invItem.id,
                type: "STOCK_IN",
                quantity: qty,
                stockBefore,
                stockAfter,
                referenceNumber: `${po.poNumber} / ${receiptNumber}`,
                notes: `Penerimaan barang dari PO ${po.poNumber} (Surat Jalan: ${deliveryNoteNumber || "-"})`,
                performedById: currentUser.id,
              },
            });
          }
        }
      }

      // Check overall PO completion status
      const updatedPOItems = await tx.purchaseOrderItem.findMany({
        where: { purchaseOrderId: po.id },
      });

      const allReceived = updatedPOItems.every(
        (pi) => pi.quantityReceived >= pi.quantityOrdered
      );
      const someReceived = updatedPOItems.some((pi) => pi.quantityReceived > 0);

      let nextPOStatus: PurchaseOrderStatus = po.status;
      if (allReceived) {
        nextPOStatus = "COMPLETED";
      } else if (someReceived) {
        nextPOStatus = "PARTIAL_RECEIVED";
      }

      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: { status: nextPOStatus },
      });

      return grn;
    });

    return NextResponse.json({
      message: `Penerimaan barang ${result.receiptNumber} berhasil dicatat. Stok inventaris telah disinkronkan.`,
      goodsReceipt: result,
    });
  } catch (error) {
    console.error("POST /api/purchasing/receipts error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
