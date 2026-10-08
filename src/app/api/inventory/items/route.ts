import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { requireAuthAndPermission } from "@/lib/permissions";

export async function GET (req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requireAuthAndPermission("inventory.item.view");
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
    const category = searchParams.get("category");
    const lowStock = searchParams.get("lowStock") === "true";

    const whereClause = {
      organizationId: currentUser.organizationId,
      isActive: true,
    };

    if (category && category !== "ALL") {
      whereClause.category = category;
    }

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { itemCode: { contains: search, mode: "insensitive" } },
        { storageLocation: { contains: search, mode: "insensitive" } },
      ];
    }

    const items = await db.inventoryItem.findMany({
      where: whereClause,
      include: {
        branch: { select: { id: true, name: true, code: true } },
        _count: { select: { transactions: true } },
      },
      orderBy: [{ name: "asc" }],
    });

    // If lowStock is filtered, filter in memory or where stock <= minStock
    const filteredItems = lowStock
      ? items.filter((item) => item.currentStock <= item.minStock)
      : items;

    // Summary counters
    const totalItems = items.length;
    const lowStockCount = items.filter((item) => item.currentStock <= item.minStock).length;
    const outOfStockCount = items.filter((item) => item.currentStock === 0).length;

    return NextResponse.json({
      items: filteredItems,
      summary: {
        totalItems,
        lowStockCount,
        outOfStockCount,
      },
    });
  } catch (error) {
    console.error("GET /api/inventory/items error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST (req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requireAuthAndPermission("inventory.item.create");
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
      itemCode,
      name,
      category,
      unit,
      minStock = 5,
      storageLocation,
      unitPrice,
      notes,
      initialStock = 0,
      branchId,
    } = body;

    if (!name || !category || !unit) {
      return NextResponse.json(
        { error: "Nama barang, kategori, dan satuan wajib diisi." },
        { status: 400 }
      );
    }

    // Auto generate code if not provided
    let finalCode = itemCode;
    if (!finalCode) {
      const prefix = category.substring(0, 3).toUpperCase();
      const count = await db.inventoryItem.count({
        where: { organizationId: currentUser.organizationId },
      });
      finalCode = `INV-${prefix}-${String(count + 1).padStart(3, "0")}`;
    }

    // Check unique code
    const existing = await db.inventoryItem.findFirst({
      where: {
        organizationId: currentUser.organizationId,
        itemCode: finalCode,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Kode barang ${finalCode} sudah digunakan.` },
        { status: 400 }
      );
    }

    const item = await db.$transaction(async (tx) => {
      const newItem = await tx.inventoryItem.create({
        data: {
          organizationId: currentUser.organizationId,
          branchId: branchId || currentUser.branchId,
          itemCode: finalCode,
          name,
          category,
          unit,
          currentStock: Number(initialStock) || 0,
          minStock: Number(minStock) || 5,
          storageLocation,
          unitPrice: unitPrice ? Number(unitPrice) : null,
          notes,
        },
      });

      if (Number(initialStock) > 0) {
        await tx.inventoryTransaction.create({
          data: {
            itemId: newItem.id,
            type: "STOCK_IN",
            quantity: Number(initialStock),
            stockBefore: 0,
            stockAfter: Number(initialStock),
            referenceNumber: "INITIAL-STOCK",
            notes: "Saldo stok awal pendaftaran barang baru",
            performedById: currentUser.id,
          },
        });
      }

      return newItem;
    });

    return NextResponse.json({ item, message: "Barang inventaris berhasil didaftarkan." });
  } catch (error) {
    console.error("POST /api/inventory/items error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
