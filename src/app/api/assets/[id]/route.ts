import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { requireAuthAndPermission } from "@/lib/permissions";
import { AssetCondition } from "@prisma/client";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requireAuthAndPermission("asset.view");
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

    const asset = await db.asset.findFirst({
      where: {
        id,
        organizationId: currentUser.organizationId,
      },
      include: {
        branch: { select: { id: true, name: true, code: true } },
        currentHolder: { select: { id: true, fullName: true, email: true, phone: true } },
        histories: {
          include: {
            performedBy: { select: { id: true, fullName: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        maintenances: {
          include: {
            performedBy: { select: { id: true, fullName: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!asset) {
      return NextResponse.json({ error: "Aset tidak ditemukan." }, { status: 404 });
    }

    // Resolve user names for fromHolderId and toHolderId in histories
    const holderIds = new Set<string>();
    asset.histories.forEach((h) => {
      if (h.fromHolderId) holderIds.add(h.fromHolderId);
      if (h.toHolderId) holderIds.add(h.toHolderId);
    });

    const holders = await db.user.findMany({
      where: { id: { in: Array.from(holderIds) } },
      select: { id: true, fullName: true, email: true },
    });

    const holderMap = new Map(holders.map((u) => [u.id, u.fullName]));

    const enrichedHistories = asset.histories.map((h) => ({
      ...h,
      fromHolderName: h.fromHolderId ? holderMap.get(h.fromHolderId) || "N/A" : null,
      toHolderName: h.toHolderId ? holderMap.get(h.toHolderId) || "N/A" : null,
    }));

    return NextResponse.json({ asset: { ...asset, histories: enrichedHistories } });
  } catch (error) {
    console.error("GET /api/assets/[id] error:", error);
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

    const authCheck = await requireAuthAndPermission("asset.update");
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

    const asset = await db.asset.findFirst({
      where: {
        id,
        organizationId: currentUser.organizationId,
      },
    });

    if (!asset) {
      return NextResponse.json({ error: "Aset tidak ditemukan." }, { status: 404 });
    }

    const body = await req.json();
    const {
      name,
      category,
      serialNumber,
      purchaseDate,
      purchasePrice,
      vendor,
      warrantyExpiry,
      location,
      condition,
      notes,
    } = body;

    const conditionChanged = condition && condition !== asset.condition;

    const updated = await db.$transaction(async (tx) => {
      const updatedAsset = await tx.asset.update({
        where: { id },
        data: {
          name: name !== undefined ? name : asset.name,
          category: category !== undefined ? category : asset.category,
          serialNumber: serialNumber !== undefined ? serialNumber : asset.serialNumber,
          purchaseDate: purchaseDate !== undefined ? (purchaseDate ? new Date(purchaseDate) : null) : asset.purchaseDate,
          purchasePrice: purchasePrice !== undefined ? (purchasePrice ? Number(purchasePrice) : null) : asset.purchasePrice,
          vendor: vendor !== undefined ? vendor : asset.vendor,
          warrantyExpiry: warrantyExpiry !== undefined ? (warrantyExpiry ? new Date(warrantyExpiry) : null) : asset.warrantyExpiry,
          location: location !== undefined ? location : asset.location,
          condition: condition !== undefined ? (condition as AssetCondition) : asset.condition,
          notes: notes !== undefined ? notes : asset.notes,
        },
      });

      if (conditionChanged) {
        await tx.assetHistory.create({
          data: {
            assetId: asset.id,
            action: "CONDITION_UPDATE",
            condition: condition as AssetCondition,
            status: asset.status,
            notes: `Perubahan kondisi aset dari ${asset.condition} ke ${condition}. Catatan: ${notes || "-"}`,
            performedById: currentUser.id,
          },
        });
      }

      return updatedAsset;
    });

    return NextResponse.json({ asset: updated, message: "Informasi aset berhasil diperbarui." });
  } catch (error) {
    console.error("PUT /api/assets/[id] error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
