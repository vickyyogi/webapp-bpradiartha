import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { requireAuthAndPermission } from "@/lib/permissions";
import { canAttachDocumentTo } from "@/lib/document-access";
import { extractClientInfo, logAudit } from "@/lib/audit";
import { DocumentOwnerType, DocumentType } from "@prisma/client";
import {
  DOCUMENT_MAX_BYTES,
  DocumentValidationError,
  savePrivateDocument,
  toDocumentDto,
  validateDocumentUpload,
} from "@/lib/document-storage";

export async function GET (req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requireAuthAndPermission("document.view");
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
    const ownerType = searchParams.get("ownerType");
    const ownerId = searchParams.get("ownerId");
    const documentType = searchParams.get("documentType");
    const search = searchParams.get("search");

    const whereClause: Record<string, unknown> = {
      organizationId: currentUser.organizationId,
    };

    if (ownerType && Object.values(DocumentOwnerType).includes(ownerType as DocumentOwnerType)) {
      whereClause.ownerType = ownerType as DocumentOwnerType;
    }

    if (ownerId) {
      whereClause.ownerId = ownerId;
    }

    if (documentType && Object.values(DocumentType).includes(documentType as DocumentType)) {
      whereClause.documentType = documentType as DocumentType;
    }

    if (search) {
      whereClause.OR = [
        { fileName: { contains: search, mode: "insensitive" } },
        { notes: { contains: search, mode: "insensitive" } },
      ];
    }

    const docs = await db.document.findMany({
      where: whereClause,
      include: {
        uploadedBy: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Kunci penyimpanan tidak pernah dikirim ke klien; hanya URL unduh berotorisasi.
    return NextResponse.json({ success: true, data: docs.map(toDocumentDto) });
  } catch (error) {
    console.error("Error fetching documents:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST (req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requireAuthAndPermission("document.upload");
    if (!authCheck.authorized) {
      return authCheck.response;
    }

    const currentUser = await db.user.findUnique({
      where: { email: session.user.email },
      include: { userRoles: { select: { role: { select: { code: true } } } } },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Body multipart dapat terpotong oleh batas buffering Next (proxy aktif) atau
    // rusak; keduanya merupakan kesalahan klien, bukan kegagalan server.
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json(
        {
          error: `Berkas terlalu besar atau format permintaan tidak valid. Ukuran maksimum ${Math.floor(
            DOCUMENT_MAX_BYTES / (1024 * 1024)
          )} MB.`,
        },
        { status: 400 }
      );
    }
    const file = formData.get("file");
    const ownerTypeRaw = (formData.get("ownerType") as string) || DocumentOwnerType.CREDIT_APPLICATION;
    const ownerId = ((formData.get("ownerId") as string) || currentUser.id).slice(0, 100);
    const documentTypeRaw = (formData.get("documentType") as string) || DocumentType.OTHER;
    const notes = ((formData.get("notes") as string) || "").slice(0, 1000);

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File tidak ditemukan dalam request" }, { status: 400 });
    }

    if (!Object.values(DocumentOwnerType).includes(ownerTypeRaw as DocumentOwnerType)) {
      return NextResponse.json({ error: "Jenis pemilik dokumen tidak dikenal." }, { status: 400 });
    }
    const ownerType = ownerTypeRaw as DocumentOwnerType;

    if (!Object.values(DocumentType).includes(documentTypeRaw as DocumentType)) {
      return NextResponse.json({ error: "Jenis dokumen tidak dikenal." }, { status: 400 });
    }
    const documentType = documentTypeRaw as DocumentType;

    // Cakupan record induk: mencegah pengguna melampirkan berkas ke pengajuan/
    // pihak lain hanya dengan mengganti ownerId.
    const canAttach = await canAttachDocumentTo(currentUser, ownerType, ownerId);
    if (!canAttach) {
      return NextResponse.json(
        { error: "Record tujuan dokumen tidak ditemukan atau di luar cakupan akses Anda." },
        { status: 403 }
      );
    }

    if (file.size > DOCUMENT_MAX_BYTES) {
      return NextResponse.json(
        { error: `Ukuran berkas melebihi batas maksimum ${Math.floor(DOCUMENT_MAX_BYTES / (1024 * 1024))} MB` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Validasi berbasis magic bytes: ekstensi dan Content-Type dari klien tidak dipercaya.
    let sniffed: { ext: string; mimeType: string };
    try {
      sniffed = validateDocumentUpload(buffer, { fileName: file.name, declaredMime: file.type });
    } catch (error) {
      if (error instanceof DocumentValidationError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }

    const originalName = (file.name || "dokumen").slice(0, 255);
    const saved = await savePrivateDocument(buffer, sniffed.ext);

    const documentRecord = await db.document.create({
      data: {
        organizationId: currentUser.organizationId,
        ownerType,
        ownerId,
        documentType,
        fileName: originalName,
        filePath: `private:${saved.key}`,
        fileExt: sniffed.ext,
        fileSize: buffer.length,
        mimeType: sniffed.mimeType,
        uploadedById: currentUser.id,
        status: "ACTIVE",
        notes,
      },
      include: {
        uploadedBy: { select: { id: true, fullName: true, email: true } },
      },
    });

    await logAudit({
      organizationId: currentUser.organizationId,
      userId: currentUser.id,
      action: "UPLOAD",
      entityType: "DOCUMENT",
      entityId: documentRecord.id,
      ...extractClientInfo(req),
      // Metadata saja — tidak mencatat nama berkas (berpotensi berisi PII).
      newValues: {
        documentType,
        ownerType,
        mimeType: sniffed.mimeType,
        fileSize: buffer.length,
        sha256: saved.sha256,
      },
    });

    return NextResponse.json({ success: true, data: toDocumentDto(documentRecord) }, { status: 201 });
  } catch (error) {
    console.error("Error uploading document:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
