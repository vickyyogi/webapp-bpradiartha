import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuthAndPermission } from "@/lib/permissions";
import { createSecureErrorResponse } from "@/lib/security";
import { extractClientInfo, logAudit } from "@/lib/audit";
import { recordInScope, toScopeUser } from "@/lib/access-scope";
import {
  detectCorrections,
  validateVerificationInput,
  VERIFICATION_NOTE_MAX_LENGTH,
  type SlikAiFigures,
} from "@/lib/slik/verification";

/**
 * POST /api/slik/analyses/[id]/verify
 *
 * Verifikasi manual angka hasil ekstraksi AI (Tahap 5B — P0.5): petugas
 * membandingkan baki debet, tunggakan, dan kolektibilitas terhadap dokumen
 * SLIK asli, lalu mengonfirmasi/mengoreksi angkanya. Nilai AI disimpan sebagai
 * snapshot pembanding — record hasil AI tidak diubah, koreksi terekam
 * berjejak + audit log. Verifikasi ulang membuat record baru (riwayat utuh).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ASSIGNMENT_FIELDS = ["createdById"];

/** Angka hasil ekstraksi AI dari hasil ternormalisasi (snapshot pembanding). */
function extractAiFigures(result: unknown): SlikAiFigures {
  const data = (result ?? {}) as {
    ringkasan_eksposur?: { total_baki_debet?: number; kualitas_terburuk?: string };
    rincian_tunggakan?: { total_tunggakan_real?: number };
  };
  const bakiDebet = data.ringkasan_eksposur?.total_baki_debet;
  const tunggakan = data.rincian_tunggakan?.total_tunggakan_real;
  const kualitas = data.ringkasan_eksposur?.kualitas_terburuk;
  return {
    bakiDebet: typeof bakiDebet === "number" && Number.isFinite(bakiDebet) ? bakiDebet : null,
    tunggakan: typeof tunggakan === "number" && Number.isFinite(tunggakan) ? tunggakan : null,
    kolektibilitas: typeof kualitas === "string" && kualitas.trim() ? kualitas.trim() : null,
  };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verifikasi angka = koreksi/catatan pada hasil analisa → wewenang analis.
    const authCheck = await requireAuthAndPermission("credit.analysis.update");
    if (!authCheck.authorized) {
      return authCheck.response!;
    }
    const currentUser = authCheck.user!;
    const scopeUser = toScopeUser(currentUser);
    const { id } = await params;

    const record = await db.slikAnalysisRecord.findFirst({
      where: { id },
      select: { id: true, customerId: true, customerName: true, result: true },
    });
    if (!record || !recordInScope(scopeUser, record, { assignmentFields: ASSIGNMENT_FIELDS })) {
      return NextResponse.json(
        { error: "Hasil analisa SLIK tidak ditemukan di cakupan akses Anda." },
        { status: 404 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const validationError = validateVerificationInput(body);
    if (validationError) {
      return NextResponse.json({ error: validationError, code: "SLIK_VERIFY_INVALID" }, { status: 400 });
    }

    const ai = extractAiFigures(record.result);
    const confirmed = {
      bakiDebet: body.bakiDebet as number,
      tunggakan: body.tunggakan as number,
      kolektibilitas: (body.kolektibilitas as string).trim(),
    };
    const corrections = detectCorrections(ai, confirmed);
    const note =
      typeof body.note === "string" && body.note.trim()
        ? body.note.trim().slice(0, VERIFICATION_NOTE_MAX_LENGTH)
        : null;

    const verification = await db.slikAnalysisVerification.create({
      data: {
        organizationId: currentUser.organizationId,
        slikAnalysisRecordId: record.id,
        aiBakiDebet: ai.bakiDebet,
        aiTunggakan: ai.tunggakan,
        aiKolektibilitas: ai.kolektibilitas,
        confirmedBakiDebet: confirmed.bakiDebet,
        confirmedTunggakan: confirmed.tunggakan,
        confirmedKolektibilitas: confirmed.kolektibilitas,
        note,
        verifiedById: currentUser.id,
        verifiedByName: currentUser.fullName,
      },
    });

    const { ipAddress, userAgent } = extractClientInfo(req);
    await logAudit({
      organizationId: currentUser.organizationId,
      userId: currentUser.id,
      action: "SLIK_VERIFY",
      entityType: "SLIK_ANALYSIS",
      entityId: record.id,
      newValues: {
        verificationId: verification.id,
        confirmed: { ...confirmed, note },
        corrections,
      },
      notes: corrections.length
        ? `Verifikasi manual angka ekstraksi AI — ${corrections.length} koreksi: ${corrections
            .map((c) => `${c.field} ${c.from} → ${c.to}`)
            .join(", ")}.`
        : "Verifikasi manual angka ekstraksi AI — semua angka sesuai dokumen asli.",
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ success: true, verification }, { status: 201 });
  } catch (error) {
    return createSecureErrorResponse(error, "POST /api/slik/analyses/[id]/verify", 500);
  }
}
