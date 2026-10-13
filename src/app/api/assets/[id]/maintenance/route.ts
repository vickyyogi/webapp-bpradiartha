import { NextRequest, NextResponse } from "next/server";
import { Prisma, AssetCondition, AssetStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuthAndPermission } from "@/lib/permissions";
import { buildScopeFilter, toScopeUser } from "@/lib/access-scope";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authCheck = await requireAuthAndPermission("asset.maintenance");
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
        { error: "Aset yang telah dihapusbukukan tidak dapat dilakukan pemeliharaan." },
        { status: 400 }
      );
    }

    const body = await req.json();
    const {
      title,
      description,
      cost,
      vendor,
      technician,
      startDate,
      completionDate,
      maintenanceStatus = "SCHEDULED", // SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED
      newCondition,
      notes,
    } = body;

    if (!title) {
      return NextResponse.json({ error: "Judul perbaikan / pemeliharaan wajib diisi." }, { status: 400 });
    }

    const result = await db.$transaction(async (tx) => {
      const maintenance = await tx.assetMaintenance.create({
        data: {
          assetId: asset.id,
          title,
          description: description || null,
          cost: cost ? Number(cost) : null,
          vendor: vendor || null,
          technician: technician || null,
          startDate: startDate ? new Date(startDate) : new Date(),
          completionDate: completionDate ? new Date(completionDate) : null,
          status: maintenanceStatus,
          notes: notes || null,
          performedById: currentUser.id,
        },
      });

      let nextAssetStatus: AssetStatus = asset.status;
      if (maintenanceStatus === "IN_PROGRESS" || maintenanceStatus === "SCHEDULED") {
        nextAssetStatus = "MAINTENANCE";
      } else if (maintenanceStatus === "COMPLETED") {
        nextAssetStatus = asset.currentHolderId ? "ASSIGNED" : "PURCHASED";
      }

      const nextCondition: AssetCondition = newCondition || (maintenanceStatus === "COMPLETED" ? "GOOD" : "IN_REPAIR");

      await tx.asset.update({
        where: { id: asset.id },
        data: {
          status: nextAssetStatus,
          condition: nextCondition,
        },
      });

      await tx.assetHistory.create({
        data: {
          assetId: asset.id,
          action: "MAINTENANCE",
          condition: nextCondition,
          status: nextAssetStatus,
          notes: `[${maintenanceStatus}] ${title}. ${notes ? `Catatan: ${notes}` : ""}`,
          performedById: currentUser.id,
        },
      });

      return maintenance;
    });

    return NextResponse.json({
      message: "Data pemeliharaan aset berhasil dicatat.",
      maintenance: result,
    });
  } catch (error) {
    console.error("POST /api/assets/[id]/maintenance error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
