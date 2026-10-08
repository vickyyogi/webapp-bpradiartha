import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndPermission } from "@/lib/permissions";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

// Max file size (25 MB for comprehensive financial reports)
const MAX_FILE_SIZE = 25 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requireAuthAndPermission("cms.media.manage");
    if (!authCheck.authorized) {
      return authCheck.response;
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "File tidak ditemukan dalam form data" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Ukuran berkas melebihi batas maksimum 25MB" },
        { status: 400 }
      );
    }

    const originalName = file.name || "laporan.pdf";
    const ext = originalName.split(".").pop()?.toLowerCase() || "pdf";

    if (ext !== "pdf" && !file.type.includes("pdf")) {
      return NextResponse.json(
        { error: "Format berkas harus berupa dokumen PDF (.pdf)" },
        { status: 400 }
      );
    }

    // Clean filename and make unique
    const sanitizedBase = originalName
      .replace(/\.[^/.]+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "-")
      .substring(0, 50);

    const timestamp = Date.now();
    const randomHex = Math.random().toString(36).substring(2, 7);
    const storageFileName = `${sanitizedBase}_${timestamp}_${randomHex}.pdf`;

    const uploadDir = path.join(process.cwd(), "public", "uploads", "reports");
    await mkdir(uploadDir, { recursive: true });

    const filePath = path.join(uploadDir, storageFileName);
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    const relativePublicPath = `/uploads/reports/${storageFileName}`;

    return NextResponse.json({
      success: true,
      url: relativePublicPath,
      fileName: originalName,
      fileSize: file.size,
    });
  } catch (error) {
    console.error("Error uploading report PDF:", error);
    return NextResponse.json({ error: "Gagal mengunggah berkas PDF" }, { status: 500 });
  }
}
