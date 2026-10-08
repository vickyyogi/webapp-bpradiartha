import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { requireAnyPermission } from "@/lib/permissions";
import { InventoryTransactionType } from "@prisma/client";

export async function GET (req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requireAnyPermission(["inventory.item.view"]);
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
    const itemId = searchParams.get("itemId");
    const type = searchParams.get("type");

    const whereClause = {
      item: {
        organizationId: currentUser.organizationId,
      },
    };

    if (itemId) {
      whereClause.itemId = itemId;
    }

    if (type && Object.values(InventoryTransactionType).includes(type as InventoryTransactionType)) {
      whereClause.type = type as InventoryTransactionType;
    }

    const transactions = await db.inventoryTransaction.findMany({
      where: whereClause,
      include: {
        item: {
          select: {
            id: true,
            itemCode: true,
            name: true,
            unit: true,
            category: true,
            currentStock: true,
          },
        },
        performedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ transactions });
  } catch (error) {
    console.error("GET /api/inventory/transactions error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST (req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const txTypeAuth = String(body.type || "").toUpperCase();
    const txPermAuth = txTypeAuth === "STOCK_IN" ? "inventory.stock_in" : txTypeAuth === "STOCK_OUT" ? "inventory.stock_out" : "inventory.adjust";
    const authCheck = await requireAnyPermission([txPermAuth]);
    if (!authCheck.authorized) {
      return authCheck.response;
    }

    const currentUser = await db.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { itemId, type, quantity, referenceNumber, notes } = body;

    if (!itemId || !type || quantity === undefined) {
      return NextResponse.json(
        { error: "Item ID, jenis transaksi, dan kuantitas wajib diisi." },
        { status: 400 }
      );
    }

    const qty = Number(quantity);
    if (isNaN(qty) || qty <= 0) {
      return NextResponse.json(
        { error: "Kuantitas harus berupa angka positif lebih dari 0." },
        { status: 400 }
      );
    }

    if (!Object.values(InventoryTransactionType).includes(type as InventoryTransactionType)) {
      return NextResponse.json({ error: "Jenis transaksi tidak valid." }, { status: 400 });
    }

    // Execute atomic transaction
    const result = await db.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findFirst({
        where: {
          id: itemId,
          organizationId: currentUser.organizationId,
        },
      });

      if (!item) {
        throw new Error("Barang tidak ditemukan.");
      }

      const stockBefore = item.currentStock;
      let stockAfter = stockBefore;

      if (type === "STOCK_IN") {
        stockAfter = stockBefore + qty;
      } else if (type === "STOCK_OUT") {
        if (stockBefore < qty) {
          throw new Error(
            `Stok tidak mencukupi untuk pengeluaran barang. Sisa stok: ${stockBefore} ${item.unit}.`
          );
        }
        stockAfter = stockBefore - qty;
      } else if (type === "ADJUSTMENT") {
        // Adjustment sets exact stock count or adjusts up/down
        stockAfter = qty;
      }

      // Update item current stock
      await tx.inventoryItem.update({
        where: { id: item.id },
        data: { currentStock: stockAfter },
      });

      // Create transaction record
      const transactionRecord = await tx.inventoryTransaction.create({
        data: {
          itemId: item.id,
          type: type as InventoryTransactionType,
          quantity: qty,
          stockBefore,
          stockAfter,
          referenceNumber: referenceNumber || null,
          notes: notes || null,
          performedById: currentUser.id,
        },
        include: {
          item: true,
          performedBy: { select: { fullName: true, email: true } },
        },
      });

      return { transaction: transactionRecord, newStock: stockAfter };
    });

    return NextResponse.json({
      message: "Transaksi stok berhasil dicatat.",
      ...result,
    });
  } catch (error) {
    console.error("POST /api/inventory/transactions error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 400 }
    );
  }
}
