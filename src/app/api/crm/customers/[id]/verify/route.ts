import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuthAndPermission } from "@/lib/permissions";
import { createSecureErrorResponse, sanitizeInput } from "@/lib/security";
import { buildScopeFilter, toScopeUser } from "@/lib/access-scope";
import { recordCustomerIdentityHistory } from "@/lib/customer";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Menandai identitas nasabah sudah diverifikasi (Tahap 2B — P0.2).
 * Mencatat petugas verifikator dan waktu; menambah baris riwayat identitas VERIFY.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const authCheck = await requireAuthAndPermission("crm.customer.update");
    if (!authCheck.authorized) return authCheck.response!;
    const currentUser = authCheck.user!;

    const { id } = await params;
    const existing = await db.customer.findFirst({
      where: { id, ...(buildScopeFilter(toScopeUser(currentUser), { assignmentFields: ["createdById"] }) as object) },
    });
    if (!existing) {
      return NextResponse.json({ error: "Nasabah tidak ditemukan." }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const verifiedAt = new Date();

    const updated = await db.customer.update({
      where: { id },
      data: { verifiedById: currentUser.id, verifiedAt, updatedById: currentUser.id },
    });

    await recordCustomerIdentityHistory({
      customerId: id,
      changedById: currentUser.id,
      verifiedById: currentUser.id,
      action: "VERIFY",
      notes: body?.notes ? sanitizeInput(String(body.notes)) : "Verifikasi identitas nasabah.",
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return createSecureErrorResponse(error, "POST /api/crm/customers/[id]/verify", 500);
  }
}
