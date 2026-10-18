import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuthAndPermission } from "@/lib/permissions";
import { createSecureErrorResponse } from "@/lib/security";
import { extractClientInfo, logAudit } from "@/lib/audit";
import { recordInScope, toScopeUser } from "@/lib/access-scope";

/**
 * GET /api/slik/analyses/[id]
 *
 * Detail satu hasil analisa SLIK tersimpan (Tahap 5A — P0.5) — untuk
 * "dilihat ulang". Akses diperiksa terhadap cakupan data pengguna, dan setiap
 * akses dicatat ke audit log (hasil analisa memuat data identitas nasabah).
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
        creditApplication: { select: { id: true, applicationNumber: true } },
        createdBy: { select: { id: true, fullName: true } },
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
      action: "VIEW",
      entityType: "SLIK_ANALYSIS",
      entityId: record.id,
      newValues: { customerId: record.customerId, customerName: record.customerName },
      notes: "Melihat ulang hasil analisa SLIK tersimpan.",
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ success: true, analysis: record });
  } catch (error) {
    return createSecureErrorResponse(error, "GET /api/slik/analyses/[id]", 500);
  }
}
