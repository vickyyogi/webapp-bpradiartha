import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndPermission } from "@/lib/permissions";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { normalizeHeroImage, HERO_CANVAS_WIDTH, HERO_CANVAS_HEIGHT } from "@/lib/hero-image";

// Max upload size (15 MB) - the file is re-encoded, never stored as-is.
const MAX_FILE_SIZE = 15 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

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
      return NextResponse.json({ error: "Ukuran gambar melebihi batas maksimum 15MB" }, { status: 400 });
    }
    if (file.type && !ALLOWED_TYPES.includes(file.type.toLowerCase())) {
      return NextResponse.json(
        { error: "Format gambar harus PNG, JPG, atau WEBP" },
        { status: 400 }
      );
    }

    const input = Buffer.from(await file.arrayBuffer());

    // Auto-normalise: crop transparent border, scale to a fixed subject height,
    // centre on a fixed transparent canvas. Every slide ends up identical.
    const normalized = await normalizeHeroImage(input);

    const uploadDir = path.join(process.cwd(), "public", "uploads", "hero");
    await mkdir(uploadDir, { recursive: true });

    // Unique filename => the URL always changes, so the Next.js image optimiser
    // can never serve a stale cached version of a replaced picture.
    const base =
      (file.name || "hero")
        .replace(/\.[^/.]+$/, "")
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "-")
        .substring(0, 40) || "hero";
    const timestamp = Date.now();
    const randomHex = Math.random().toString(36).substring(2, 7);
    const storageFileName = `${base}_${timestamp}_${randomHex}.png`;

    await writeFile(path.join(uploadDir, storageFileName), normalized.data);

    return NextResponse.json({
      success: true,
      url: `/uploads/hero/${storageFileName}`,
      width: normalized.width,
      height: normalized.height,
      canvasWidth: HERO_CANVAS_WIDTH,
      canvasHeight: HERO_CANVAS_HEIGHT,
      originalName: file.name,
      originalSize: file.size,
      normalizedSize: normalized.data.length,
    });
  } catch (error) {
    console.error("Error uploading hero slide:", error);
    return NextResponse.json(
      { error: "Gagal memproses gambar hero. Pastikan berkas berupa gambar yang valid." },
      { status: 500 }
    );
  }
}
