import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { requireAuthAndPermission } from "@/lib/permissions";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requireAuthAndPermission("inventory.item.view");
    if (!authCheck.authorized) {
      return authCheck.response;
    }

    const { id } = await params;
    const currentUser = await db.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const item = await db.inventoryItem.findFirst({
      where: {
        id,
        organizationId: currentUser.organizationId,
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
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requireAuthAndPermission("inventory.item.update");
    if (!authCheck.authorized) {
      return authCheck.response;
    }

    const { id } = await params;
    const currentUser = await db.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const item = await db.inventoryItem.findFirst({
      where: {
        id,
        organizationId: currentUser.organizationId,
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
