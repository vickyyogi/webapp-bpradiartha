import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { requireAuthAndPermission } from "@/lib/permissions";
import { evaluateDocumentAccess } from "@/lib/document-access";
import { buildAuditLogData, extractClientInfo } from "@/lib/audit";
import {
  deletePrivateDocument,
  parseDocumentRef,
  toDocumentDto,
} from "@/lib/document-storage";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requireAuthAndPermission("document.download");
    if (!authCheck.authorized) {
      return authCheck.response;
    }
    const user = authCheck.user;

    const { id } = await params;
    const document = await db.document.findUnique({
      where: { id },
      include: {
        uploadedBy: { select: { id: true, fullName: true, email: true } },
      },
    });

    if (!document) {
      return NextResponse.json({ error: "Dokumen tidak ditemukan" }, { status: 404 });
    }

    // Metadata (nama berkas, keterangan) juga merupakan data sensitif:
    // wajib lolos cakupan organisasi/cabang/penugasan.
    const access = await evaluateDocumentAccess(user, document);
    if (!access.allowed) {
      return NextResponse.json({ error: "Dokumen tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: toDocumentDto(document) });
  } catch (error) {
    console.error("Error fetching document:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requireAuthAndPermission("document.delete");
    if (!authCheck.authorized) {
      return authCheck.response;
    }
    const user = authCheck.user;

    const { id } = await params;
    const document = await db.document.findUnique({ where: { id } });

    if (!document) {
      return NextResponse.json({ error: "Dokumen tidak ditemukan" }, { status: 404 });
    }

    const access = await evaluateDocumentAccess(user, document);
    if (!access.allowed) {
      return NextResponse.json({ error: "Dokumen tidak ditemukan" }, { status: 404 });
    }

    const clientInfo = extractClientInfo(req);
    // Tahap 7 (P1.6): audit + penghapusan record atomik.
    await db.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: buildAuditLogData({
          organizationId: user.organizationId,
          userId: user.id,
          action: "DELETE",
          entityType: "DOCUMENT",
          entityId: document.id,
          ...clientInfo,
          oldValues: { documentType: document.documentType, mimeType: document.mimeType, fileSize: document.fileSize },
          notes: "Dokumen dihapus dari sistem.",
        }),
      });

      // Baris database dihapus lebih dulu: bila penghapusan berkas gagal, yang
      // tersisa hanyalah berkas yatim (aman), bukan record yang menunjuk ke
      // berkas yang sudah tidak ada.
      await tx.document.delete({ where: { id } });
    });

    const ref = parseDocumentRef(document.filePath);
    if (ref.kind === "private") {
      const removed = await deletePrivateDocument(ref.key);
      if (!removed) {
        console.error(`Private document file could not be removed: ${ref.key}`);
      }
    }

    return NextResponse.json({ success: true, message: "Dokumen berhasil dihapus" });
  } catch (error) {
    console.error("Error deleting document:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
