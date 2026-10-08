import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { requireAuthAndPermission } from "@/lib/permissions";
import { DocumentOwnerType, DocumentType } from "@prisma/client";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

// Max file size (10 MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

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

    const whereClause = {
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

    return NextResponse.json({ success: true, data: docs });
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
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const ownerType = (formData.get("ownerType") as DocumentOwnerType) || DocumentOwnerType.CREDIT_APPLICATION;
    const ownerId = (formData.get("ownerId") as string) || currentUser.id;
    const documentType = (formData.get("documentType") as DocumentType) || DocumentType.OTHER;
    const notes = (formData.get("notes") as string) || "";

    if (!file) {
      return NextResponse.json({ error: "File tidak ditemukan dalam request" }, { status: 400 });
    }

    // Security validation per Section 17
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Ukuran berkas melebihi batas maksimum 10MB" }, { status: 400 });
    }

    const mimeType = file.type;
    const originalName = file.name;
    const ext = originalName.split(".").pop()?.toLowerCase() || "";

    // Generate randomized unique storage name
    const timestamp = Date.now();
    const randomHex = Math.random().toString(36).substring(2, 8);
    const storageFileName = `${timestamp}_${randomHex}.${ext}`;

    const uploadDir = path.join(process.cwd(), "public", "uploads", "documents");
    await mkdir(uploadDir, { recursive: true });

    const filePath = path.join(uploadDir, storageFileName);
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    const relativePublicPath = `/uploads/documents/${storageFileName}`;

    const documentRecord = await db.document.create({
      data: {
        organizationId: currentUser.organizationId,
        ownerType,
        ownerId,
        documentType,
        fileName: originalName,
        filePath: relativePublicPath,
        fileExt: ext,
        fileSize: file.size,
        mimeType: mimeType || "application/octet-stream",
        uploadedById: currentUser.id,
        status: "ACTIVE",
        notes,
      },
      include: {
        uploadedBy: { select: { id: true, fullName: true, email: true } },
      },
    });

    return NextResponse.json({ success: true, data: documentRecord }, { status: 201 });
  } catch (error) {
    console.error("Error uploading document:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
