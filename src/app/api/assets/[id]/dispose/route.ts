import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuthAndPermission } from "@/lib/permissions";
import { buildScopeFilter, toScopeUser } from "@/lib/access-scope";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authCheck = await requireAuthAndPermission("asset.dispose");
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
      return NextResponse.json({ error: "Aset ini sudah dalam status Disposed." }, { status: 400 });
    }

    const body = await req.json();
    const { reason, approvalReference, notes } = body;

    if (!reason) {
      return NextResponse.json({ error: "Alasan penghapusan aset (Disposal) wajib diisi." }, { status: 400 });
    }

    const result = await db.$transaction(async (tx) => {
      const history = await tx.assetHistory.create({
        data: {
          assetId: asset.id,
          action: "DISPOSAL",
          fromHolderId: asset.currentHolderId,
          toHolderId: null,
          fromLocation: asset.location,
          condition: "DISPOSED",
          status: "DISPOSED",
          notes: `Penghapusan aset (Disposal). Alasan: ${reason}. No. Referensi SK/Approval: ${approvalReference || "-"}. ${notes || ""}`,
          performedById: currentUser.id,
        },
      });

      const updated = await tx.asset.update({
        where: { id: asset.id },
        data: {
          status: "DISPOSED",
          condition: "DISPOSED",
          currentHolderId: null,
          notes: asset.notes
            ? `${asset.notes} | [DISPOSED]: ${reason}`
            : `[DISPOSED]: ${reason}`,
        },
      });

      return { history, asset: updated };
    });

    return NextResponse.json({
      message: "Aset berhasil dihapusbukukan (Disposed) dari operasional aktif.",
      ...result,
    });
  } catch (error) {
    console.error("POST /api/assets/[id]/dispose error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
