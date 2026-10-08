import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { requireAuthAndPermission } from "@/lib/permissions";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requireAuthAndPermission("asset.dispose");
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
