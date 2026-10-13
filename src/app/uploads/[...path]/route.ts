/**
 * Penyaji berkas unggahan PUBLIK — Tahap 4 (P0.4).
 *
 * Hanya konten CMS yang memang publik yang boleh disajikan di sini
 * (gambar hero dan laporan publik). Dokumen privat (KTP, agunan, bukti
 * penghasilan, dll.) disimpan DI LUAR `public/` dan hanya dapat diambil melalui
 * `GET /api/documents/:id/download` yang ber-otorisasi — permintaan ke
 * `/uploads/documents/*` selalu dijawab 404.
 */

import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";

/** Direktori unggahan yang memang bersifat publik (konten website resmi). */
const PUBLIC_UPLOAD_DIRS = new Set(["hero", "reports"]);

const KEY_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function getContentType(ext: string): string {
  switch (ext.toLowerCase()) {
    case "pdf":
      return "application/pdf";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    default:
      // SVG sengaja tidak dipetakan: berkas SVG dapat menampilkan skrip bila
      // disajikan inline dari origin yang sama, maka dijadikan unduhan mentah.
      return "application/octet-stream";
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params;
    if (!pathSegments || pathSegments.length === 0) {
      return NextResponse.json({ error: "File not specified" }, { status: 400 });
    }

    // Folder privat/rahasia tidak pernah dilayani di rute ini.
    if (!PUBLIC_UPLOAD_DIRS.has(pathSegments[0])) {
      return NextResponse.json({ error: "File tidak ditemukan" }, { status: 404 });
    }

    // Tolak traversal: hanya satu segmen nama berkas yang aman (huruf/angka,
    // titik, strip, garis bawah) dan tidak boleh "." / "..".
    if (pathSegments.length > 2 || pathSegments.some((s) => !KEY_SEGMENT.test(s))) {
      return NextResponse.json({ error: "File tidak ditemukan" }, { status: 404 });
    }

    const root = path.join(process.cwd(), "public", "uploads");
    const filePath = path.resolve(root, ...pathSegments);
    if (!filePath.startsWith(root + path.sep)) {
      return NextResponse.json({ error: "File tidak ditemukan" }, { status: 404 });
    }

    try {
      const fileStat = await stat(filePath);
      if (!fileStat.isFile()) {
        return NextResponse.json({ error: "File tidak ditemukan" }, { status: 404 });
      }

      const fileBuffer = await readFile(filePath);
      const ext = path.extname(filePath).replace(".", "").toLowerCase();
      const contentType = getContentType(ext);
      const fileName = path.basename(filePath);

      return new NextResponse(new Uint8Array(fileBuffer), {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Content-Length": fileStat.size.toString(),
          "Content-Disposition": `inline; filename="${fileName.replace(/["\\;]/g, "")}"`,
          "Cache-Control": "public, max-age=3600, must-revalidate",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch {
      return NextResponse.json({ error: "File tidak ditemukan di server" }, { status: 404 });
    }
  } catch (error) {
    console.error("Error serving uploaded file:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
