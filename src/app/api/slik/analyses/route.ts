import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuthAndPermission } from "@/lib/permissions";
import { createSecureErrorResponse } from "@/lib/security";
import { buildScopeFilter, toScopeUser } from "@/lib/access-scope";

/**
 * GET /api/slik/analyses?customerId=...
 *
 * Riwayat hasil analisa SLIK yang tersimpan (Tahap 5A — P0.5), untuk
 * "dilihat ulang" tanpa menjalankan analisa baru. Hanya ringkasan yang dikirim —
 * isi lengkap ada di /api/slik/analyses/[id].
 *
 * Cakupan: organisasi → cabang → (khusus petugas lapangan) record buatan sendiri.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Field record yang memberi hak akses kepada petugas bercakupan ASSIGNED. */
const ASSIGNMENT_FIELDS = ["createdById"];

export async function GET(req: NextRequest) {
  try {
    const authCheck = await requireAuthAndPermission("credit.analysis.view");
    if (!authCheck.authorized) {
      return authCheck.response!;
    }
    const currentUser = authCheck.user!;
    const scopeUser = toScopeUser(currentUser);

    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customerId");
    const creditApplicationId = searchParams.get("creditApplicationId");
    const limitParam = Number.parseInt(searchParams.get("limit") ?? "", 10);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 200) : 50;

    const where: Record<string, unknown> = {
      ...buildScopeFilter(scopeUser, { assignmentFields: ASSIGNMENT_FIELDS }),
    };
    if (customerId) {
      where.customerId = customerId;
    }
    if (creditApplicationId) {
      where.creditApplicationId = creditApplicationId;
    }

    const records = await db.slikAnalysisRecord.findMany({
      where,
      select: {
        id: true,
        customerId: true,
        creditApplicationId: true,
        customerName: true,
        sourceFileNames: true,
        mode: true,
        rekomendasi: true,
        riskRating: true,
        modelUsed: true,
        elapsedMs: true,
        createdAt: true,
        createdBy: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ success: true, analyses: records });
  } catch (error) {
    return createSecureErrorResponse(error, "GET /api/slik/analyses", 500);
  }
}
