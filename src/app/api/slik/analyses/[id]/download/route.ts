import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuthAndPermission } from "@/lib/permissions";
import { createSecureErrorResponse } from "@/lib/security";
import { extractClientInfo, logAudit } from "@/lib/audit";
import { recordInScope, toScopeUser } from "@/lib/access-scope";

/**
 * GET /api/slik/analyses/[id]/download
 *
 * Mengambil kembali data hasil analisa SLIK tersimpan untuk "diunduh ulang" —
 * PDF laporan disusun di sisi klien memakai generator yang sama dengan analisa
 * baru (src/lib/slik/generateSlikReport.ts), sehingga isi unduhan selalu
 * konsisten dengan format laporan saat ini.
 *
 * Setiap unduhan dicatat ke audit log (tanpa isi dokumen / NIK).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ASSIGNMENT_FIELDS = ["createdById"];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authCheck = await requireAuthAndPermission("credit.analysis.view");
    if (!authCheck.authorized) {
      return authCheck.response!;
    }
    const currentUser = authCheck.user!;
    const scopeUser = toScopeUser(currentUser);
    const { id } = await params;

    const record = await db.slikAnalysisRecord.findFirst({
      where: { id },
      include: {
        customer: { select: { id: true, customerNumber: true, legalName: true } },
      },
    });

    if (!record || !recordInScope(scopeUser, record, { assignmentFields: ASSIGNMENT_FIELDS })) {
      return NextResponse.json(
        { error: "Hasil analisa SLIK tidak ditemukan di cakupan akses Anda." },
        { status: 404 }
      );
    }

    const { ipAddress, userAgent } = extractClientInfo(req);
    await logAudit({
      organizationId: currentUser.organizationId,
      userId: currentUser.id,
      action: "DOWNLOAD",
      entityType: "SLIK_ANALYSIS",
      entityId: record.id,
      newValues: { customerId: record.customerId, customerName: record.customerName },
      notes: "Unduh ulang laporan hasil analisa SLIK tersimpan.",
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      recordId: record.id,
      customerName: record.customerName,
      createdAt: record.createdAt,
      data: record.result,
      meta: record.meta,
    });
  } catch (error) {
    return createSecureErrorResponse(error, "GET /api/slik/analyses/[id]/download", 500);
  }
}
