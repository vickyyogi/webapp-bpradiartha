import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAuthAndPermission } from "@/lib/permissions";
import { createSecureErrorResponse } from "@/lib/security";
import { buildScopeFilter, toScopeUser } from "@/lib/access-scope";
import { findDuplicateCandidates } from "@/lib/customer";

/**
 * Deteksi potensi duplikasi nasabah (Tahap 2B — P0.2).
 * Memerlukan izin crm.customer.view; hasil NIK/telepon SELALU disamarkan
 * dan dibatasi pada organisasi pengguna.
 */
export async function GET(req: NextRequest) {
  try {
    const authCheck = await requireAuthAndPermission("crm.customer.view");
    if (!authCheck.authorized) return authCheck.response!;
    const currentUser = authCheck.user!;

    const { searchParams } = new URL(req.url);
    const identityNumber = searchParams.get("identityNumber");
    const phone = searchParams.get("phone");
    const legalName = searchParams.get("legalName");
    const birthDate = searchParams.get("birthDate");
    const excludeCustomerId = searchParams.get("excludeCustomerId");

    if (!identityNumber && !phone && !legalName) {
      return NextResponse.json(
        { error: "Sertakan minimal satu dari: identityNumber, phone, legalName." },
        { status: 400 }
      );
    }

    const duplicates = await findDuplicateCandidates(currentUser.organizationId, {
      identityNumber,
      phone,
      legalName,
      birthDate,
      excludeCustomerId,
      extraWhere: buildScopeFilter(toScopeUser(currentUser), { assignmentFields: ["createdById"] }) as Prisma.CustomerWhereInput,
    });

    return NextResponse.json({ success: true, data: duplicates });
  } catch (error) {
    return createSecureErrorResponse(error, "GET /api/crm/customers/duplicates", 500);
  }
}
