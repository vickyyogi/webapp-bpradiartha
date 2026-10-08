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

    const authCheck = await requireAuthAndPermission("purchase.order.view");
    if (!authCheck.authorized) {
      return authCheck.response;
    }

    const currentUser = await db.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");
    const status = searchParams.get("status");
    const vendorId = searchParams.get("vendorId");

    const whereClause = {
      organizationId: currentUser.organizationId,
    };

    if (status && Object.values(PurchaseOrderStatus).includes(status as PurchaseOrderStatus)) {
      whereClause.status = status as PurchaseOrderStatus;
    }

    if (vendorId) {
      whereClause.vendorId = vendorId;
    }

    if (search) {
      whereClause.OR = [
        { poNumber: { contains: search, mode: "insensitive" } },
        { vendor: { name: { contains: search, mode: "insensitive" } } },
        { notes: { contains: search, mode: "insensitive" } },
      ];
    }

    const orders = await db.purchaseOrder.findMany({
      where: whereClause,
      include: {
        vendor: { select: { id: true, name: true, phone: true, category: true } },
        purchaseRequest: { select: { id: true, requestNumber: true, title: true } },
        createdBy: { select: { id: true, fullName: true, email: true } },
        _count: {
          select: {
            items: true,
            goodsReceipts: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const allOrders = await db.purchaseOrder.findMany({
      where: { organizationId: currentUser.organizationId },
      select: { status: true, totalAmount: true },
    });

    const summary = {
      total: allOrders.length,
      issued: allOrders.filter((o) => o.status === "ISSUED").length,
      partial: allOrders.filter((o) => o.status === "PARTIAL_RECEIVED").length,
      completed: allOrders.filter((o) => o.status === "COMPLETED").length,
      totalValue: allOrders.reduce((acc, curr) => acc + (curr.totalAmount || 0), 0),
    };

    return NextResponse.json({ orders, summary });
  } catch (error) {
    console.error("GET /api/purchasing/orders error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST (req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requireAuthAndPermission("purchase.order.create");
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
      vendorId,
      purchaseRequestId,
      expectedDeliveryDate,
      paymentTerms,
      includeTax = true,
      notes,
      items = [],
    } = body;

    if (!vendorId || items.length === 0) {
      return NextResponse.json(
        { error: "Pilih vendor penyedia dan minimal 1 item untuk menerbitkan Purchase Order." },
        { status: 400 }
      );
    }

    // Generate PO Number
    const year = new Date().getFullYear();
    const count = await db.purchaseOrder.count({
      where: { organizationId: currentUser.organizationId },
    });
    const poNumber = `PO-${year}-${String(count + 1).padStart(4, "0")}`;

    const subtotal = items.reduce(
      (sum: number, it) => sum + (Number(it.quantityOrdered) || 1) * (Number(it.unitPrice) || 0),
      0
    );
    const taxAmount = includeTax ? subtotal * 0.11 : 0;
    const totalAmount = subtotal + taxAmount;

    const newPO = await db.purchaseOrder.create({
      data: {
        organizationId: currentUser.organizationId,
        branchId: currentUser.branchId,
        vendorId,
        purchaseRequestId: purchaseRequestId || null,
        poNumber,
        expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
        paymentTerms: paymentTerms || "NET 14 Hari",
        status: "ISSUED",
        subtotal,
        taxAmount,
        totalAmount,
        notes: notes || null,
        createdById: currentUser.id,
        items: {
          create: items.map((it) => ({
            itemName: it.itemName,
            unit: it.unit || "Pcs",
            quantityOrdered: Number(it.quantityOrdered) || 1,
            quantityReceived: 0,
            unitPrice: Number(it.unitPrice) || 0,
            totalPrice: (Number(it.quantityOrdered) || 1) * (Number(it.unitPrice) || 0),
            itemType: it.itemType || "INVENTORY",
            inventoryItemId: it.inventoryItemId || null,
            notes: it.notes || null,
          })),
        },
      },
      include: {
        vendor: true,
        items: true,
      },
    });

    return NextResponse.json({
      message: `Purchase Order ${newPO.poNumber} berhasil diterbitkan ke vendor ${newPO.vendor.name}.`,
      purchaseOrder: newPO,
    });
  } catch (error) {
    console.error("POST /api/purchasing/orders error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
