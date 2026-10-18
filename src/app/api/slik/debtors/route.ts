import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuthAndPermission } from "@/lib/permissions";
import { createSecureErrorResponse, sanitizeInput } from "@/lib/security";
import { buildScopeFilter, toScopeUser } from "@/lib/access-scope";

/**
 * GET /api/slik/debtors?search=...
 *
 * Daftar debitur yang terdaftar pada pengajuan kredit — sumber pilihan
 * "debitur dianalisa" di halaman Analisa SLIK (Tahap 5A — P0.5).
 *
 * Hanya nasabah yang MEMILIKI minimal satu pengajuan kredit yang ditampilkan,
 * dan hanya dalam cakupan data pengguna (organisasi/cabang/penugasan).
 * PII sensitif (NIK/identitas) sengaja TIDAK ikut dikirim ke dropdown ini.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Field penugasan pada pengajuan kredit yang memberi hak akses kepada petugas. */
const CREDIT_ASSIGNMENT_FIELDS = [
  "assignedMarketingOfficerId",
  "assignedAnalystId",
  "assignedSurveyOfficerId",
  "decisionMakerId",
];

export async function GET(req: NextRequest) {
  try {
    const authCheck = await requireAuthAndPermission("credit.analysis.create");
    if (!authCheck.authorized) {
      return authCheck.response!;
    }
    const currentUser = authCheck.user!;
    const scopeUser = toScopeUser(currentUser);

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");

    // Cakupan organisasi/cabang/penugasan ditegakkan di server, lewat pengajuan
    // kredit yang menjadi syarat "terdaftar sebagai debitur".
    const where: Record<string, unknown> = {
      ...buildScopeFilter(scopeUser, { assignmentFields: CREDIT_ASSIGNMENT_FIELDS }),
    };

    if (search) {
      const cleanSearch = sanitizeInput(search);
      where.OR = [
        { applicationNumber: { contains: cleanSearch, mode: "insensitive" } },
        { product: { contains: cleanSearch, mode: "insensitive" } },
        { customer: { legalName: { contains: cleanSearch, mode: "insensitive" } } },
        { customer: { customerNumber: { contains: cleanSearch, mode: "insensitive" } } },
      ];
    }

    const applications = await db.creditApplication.findMany({
      where,
      select: {
        customerId: true,
        customer: {
          select: {
            id: true,
            customerNumber: true,
            legalName: true,
            customerType: true,
            isActive: true,
          },
        },
      },
      distinct: ["customerId"],
      orderBy: { createdAt: "desc" },
      take: 300,
    });

    const debtors = applications
      .map((application) => application.customer)
      .filter((customer) => customer.isActive)
      .map((customer) => ({
        id: customer.id,
        customerNumber: customer.customerNumber,
        legalName: customer.legalName,
        customerType: customer.customerType,
      }));

    return NextResponse.json({ success: true, debtors });
  } catch (error) {
    return createSecureErrorResponse(error, "GET /api/slik/debtors", 500);
  }
}
