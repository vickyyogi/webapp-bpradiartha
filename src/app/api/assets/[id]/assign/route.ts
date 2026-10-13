import { NextRequest, NextResponse } from "next/server";
import { Prisma, AssetStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuthAndPermission } from "@/lib/permissions";
import { buildScopeFilter, toScopeUser } from "@/lib/access-scope";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authCheck = await requireAuthAndPermission("asset.assign");
    if (!authCheck.authorized) {
      return authCheck.response;
    }
    const currentUser = authCheck.user!;

    const { id } = await params;

    const asset = await db.asset.findFirst({
      where: {
        id,
        ...(buildScopeFilter(toScopeUser(currentUser), { assignmentFields: ["currentHolderId"] }) as Prisma.AssetWhereInput),
      },
    });

    if (!asset) {
      return NextResponse.json({ error: "Aset tidak ditemukan." }, { status: 404 });
    }

    if (asset.status === "DISPOSED") {
      return NextResponse.json(
        { error: "Aset yang telah dihapusbukukan (Disposed) tidak dapat dimutasi atau dialihkan." },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { actionType, toHolderId, toLocation, notes } = body;
    // actionType: "ASSIGNMENT" (penyerahan ke pemegang baru), "TRANSFER" (mutasi antar unit/karyawan), "RETURN" (pengembalian ke gudang kantor)

    if (!actionType) {
      return NextResponse.json({ error: "Jenis mutasi wajib dipilih." }, { status: 400 });
    }

    let nextStatus: AssetStatus = "ASSIGNED";
    let nextHolderId: string | null = toHolderId || null;

    if (actionType === "RETURN") {
      nextStatus = "RETURNED";
      nextHolderId = null;
    } else if (actionType === "TRANSFER") {
      nextStatus = "TRANSFERRED";
      if (!toHolderId && !toLocation) {
        return NextResponse.json(
          { error: "Penerima baru atau lokasi tujuan baru wajib ditentukan untuk mutasi." },
          { status: 400 }
        );
      }
    } else if (actionType === "ASSIGNMENT") {
      nextStatus = "ASSIGNED";
      if (!toHolderId) {
        return NextResponse.json(
          { error: "Karyawan penerima wajib dipilih untuk serah terima." },
          { status: 400 }
        );
      }
    }

    const result = await db.$transaction(async (tx) => {
      // Create history
      const history = await tx.assetHistory.create({
        data: {
          assetId: asset.id,
          action: actionType,
          fromHolderId: asset.currentHolderId,
          toHolderId: nextHolderId,
          fromLocation: asset.location,
          toLocation: toLocation || asset.location,
          condition: asset.condition,
          status: nextStatus,
          notes: notes || `Mutasi ${actionType} aset operasional`,
          performedById: currentUser.id,
        },
      });

      // Update asset
      const updatedAsset = await tx.asset.update({
        where: { id: asset.id },
        data: {
          currentHolderId: nextHolderId,
          location: toLocation !== undefined ? toLocation : asset.location,
          status: nextStatus === "TRANSFERRED" ? "ASSIGNED" : nextStatus,
        },
        include: {
          currentHolder: { select: { id: true, fullName: true, email: true } },
        },
      });

      return { history, updatedAsset };
    });

    return NextResponse.json({
      message: `Proses ${actionType} aset berhasil dicatat.`,
      ...result,
    });
  } catch (error) {
    console.error("POST /api/assets/[id]/assign error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
