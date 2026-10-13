import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuthAndPermission } from "@/lib/permissions";
import { buildScopeFilter, toScopeUser } from "@/lib/access-scope";

const invScope = (user: Parameters<typeof toScopeUser>[0]) =>
  buildScopeFilter(toScopeUser(user), { assignmentFields: [] }) as Prisma.InventoryItemWhereInput;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authCheck = await requireAuthAndPermission("inventory.item.view");
    if (!authCheck.authorized) {
      return authCheck.response;
    }

    const { id } = await params;

    const item = await db.inventoryItem.findFirst({
      where: {
        id,
        ...invScope(authCheck.user!),
      },
      include: {
        branch: { select: { id: true, name: true, code: true } },
        transactions: {
          include: {
            performedBy: { select: { id: true, fullName: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!item) {
      return NextResponse.json({ error: "Barang tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json({ item });
  } catch (error) {
    console.error("GET /api/inventory/items/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authCheck = await requireAuthAndPermission("inventory.item.update");
    if (!authCheck.authorized) {
      return authCheck.response;
    }

    const { id } = await params;

    const item = await db.inventoryItem.findFirst({
      where: {
        id,
        ...invScope(authCheck.user!),
      },
    });

    if (!item) {
      return NextResponse.json({ error: "Barang tidak ditemukan." }, { status: 404 });
    }

    const body = await req.json();
    const { name, category, unit, minStock, storageLocation, unitPrice, notes, isActive } = body;

    const updatedItem = await db.inventoryItem.update({
      where: { id },
      data: {
        name: name !== undefined ? name : item.name,
        category: category !== undefined ? category : item.category,
        unit: unit !== undefined ? unit : item.unit,
        minStock: minStock !== undefined ? Number(minStock) : item.minStock,
        storageLocation: storageLocation !== undefined ? storageLocation : item.storageLocation,
        unitPrice: unitPrice !== undefined ? Number(unitPrice) : item.unitPrice,
        notes: notes !== undefined ? notes : item.notes,
        isActive: isActive !== undefined ? Boolean(isActive) : item.isActive,
      },
    });

    return NextResponse.json({ item: updatedItem, message: "Data barang berhasil diperbarui." });
  } catch (error) {
    console.error("PUT /api/inventory/items/[id] error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
