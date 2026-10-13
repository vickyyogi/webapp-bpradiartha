/**
 * Endpoint unduh dokumen — Tahap 4 (P0.4).
 *
 * Setiap unduhan wajib melewati:
 *   autentikasi sesi → permission `document.download` → cakupan organisasi/cabang
 *   → cakupan record induk (pengajuan/lead/aset/dll.) → baca dari penyimpanan privat.
 * Berkas tidak pernah disajikan dari URL publik permanen; unduhan dicatat ke audit log.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndPermission } from "@/lib/permissions";
import { evaluateDocumentAccess } from "@/lib/document-access";
import { extractClientInfo, logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import {
  contentDisposition,
  isInlineSafeExtension,
  readDocumentBytes,
  sniffDocumentType,
} from "@/lib/document-storage";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authCheck = await requireAuthAndPermission("document.download");
    if (!authCheck.authorized) {
      // Navigasi peramban (tautan <a href>) diarahkan ke halaman login.
      const accept = req.headers.get("accept") || "";
      if (authCheck.response.status === 401 && accept.includes("text/html")) {
        const callbackUrl = encodeURIComponent(req.nextUrl.pathname);
        return NextResponse.redirect(new URL(`/login?callbackUrl=${callbackUrl}`, req.url));
      }
      return authCheck.response;
    }
    const user = authCheck.user;

    const { id } = await params;
    const document = await db.document.findUnique({ where: { id } });
    if (!document) {
      // Jangan membedakan "tidak ada" dengan "bukan milik Anda" agar URL tidak
      // dapat dipakai untuk memancing keberadaan record.
      return NextResponse.json({ error: "Dokumen tidak ditemukan" }, { status: 404 });
    }

    const access = await evaluateDocumentAccess(user, document);
    if (!access.allowed) {
      await logAudit({
        organizationId: user.organizationId,
        userId: user.id,
        action: "DOWNLOAD",
        entityType: "DOCUMENT",
        entityId: document.id,
        ...extractClientInfo(req),
        notes: `Akses dokumen ditolak (${access.reason}).`,
      });
      return NextResponse.json({ error: "Dokumen tidak ditemukan" }, { status: 404 });
    }

    const bytes = await readDocumentBytes(document.filePath);
    if (!bytes) {
      return NextResponse.json(
        { error: "Berkas dokumen tidak ditemukan di penyimpanan." },
        { status: 404 }
      );
    }

    // Tipe ditentukan dari isi berkas (magic bytes), bukan dari metadata klien.
    const sniffed = sniffDocumentType(bytes.buffer);
    const extension = sniffed?.ext || (document.fileExt || "bin").toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
    const contentType = sniffed?.mimeType || "application/octet-stream";
    // Hanya tipe yang aman (gambar/PDF) yang boleh dirender inline; sisanya diunduh.
    const inline = sniffed ? isInlineSafeExtension(sniffed.ext) : false;

    await logAudit({
      organizationId: user.organizationId,
      userId: user.id,
      action: "DOWNLOAD",
      entityType: "DOCUMENT",
      entityId: document.id,
      ...extractClientInfo(req),
      // Metadata saja: tidak mencatat nama berkas (berpotensi berisi PII) atau isi dokumen.
      notes: `Unduh dokumen ${document.documentType} (${contentType}, ${bytes.buffer.length} byte).`,
    });

    return new NextResponse(new Uint8Array(bytes.buffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(bytes.buffer.length),
        "Content-Disposition": contentDisposition(document.fileName, inline ? "inline" : "attachment", extension),
        "Cache-Control": "private, no-store, max-age=0",
        "Pragma": "no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Error downloading document:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
