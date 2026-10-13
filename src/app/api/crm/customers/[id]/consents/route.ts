import { NextRequest, NextResponse } from "next/server";
import { CustomerConsentType } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuthAndPermission } from "@/lib/permissions";
import { createSecureErrorResponse, sanitizeInput } from "@/lib/security";
import { buildScopeFilter, toScopeUser } from "@/lib/access-scope";
import { logAudit, extractClientInfo } from "@/lib/audit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Catatan persetujuan pemrosesan data pribadi (Tahap 2B — P0.2). */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const authCheck = await requireAuthAndPermission("crm.customer.view");
    if (!authCheck.authorized) return authCheck.response!;
    const currentUser = authCheck.user!;

    const { id } = await params;
    const owned = await db.customer.findFirst({
      where: { id, ...(buildScopeFilter(toScopeUser(currentUser), { assignmentFields: ["createdById"] }) as object) },
      select: { id: true },
    });
    if (!owned) return NextResponse.json({ error: "Nasabah tidak ditemukan." }, { status: 404 });

    const consents = await db.customerConsent.findMany({
      where: { customerId: id },
      include: { recordedBy: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: consents });
  } catch (error) {
    return createSecureErrorResponse(error, "GET /api/crm/customers/[id]/consents", 500);
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const authCheck = await requireAuthAndPermission("crm.customer.update");
    if (!authCheck.authorized) return authCheck.response!;
    const currentUser = authCheck.user!;

    const { id } = await params;
    const owned = await db.customer.findFirst({
      where: { id, ...(buildScopeFilter(toScopeUser(currentUser), { assignmentFields: ["createdById"] }) as object) },
      select: { id: true },
    });
    if (!owned) return NextResponse.json({ error: "Nasabah tidak ditemukan." }, { status: 404 });

    const body = await req.json();
    const { consentType, granted, policyVersion, evidenceRef, notes } = body;

    if (!Object.values(CustomerConsentType).includes(consentType)) {
      return NextResponse.json({ error: "Jenis persetujuan tidak valid." }, { status: 400 });
    }

    const isGranted = granted !== false;
    const now = new Date();

    const created = await db.customerConsent.create({
      data: {
        customerId: id,
        consentType,
        granted: isGranted,
        policyVersion: policyVersion ? sanitizeInput(String(policyVersion)) : null,
        evidenceRef: evidenceRef ? sanitizeInput(String(evidenceRef)) : null,
        grantedAt: isGranted ? now : null,
        revokedAt: isGranted ? null : now,
        recordedById: currentUser.id,
        notes: notes ? sanitizeInput(String(notes)) : null,
      },
    });

    const info = extractClientInfo(req);
    await logAudit({
      organizationId: currentUser.organizationId,
      userId: currentUser.id,
      action: isGranted ? "APPROVE" : "REJECT",
      entityType: "CUSTOMER",
      entityId: id,
      newValues: { consentType, granted: isGranted, policyVersion: policyVersion ?? null },
      ipAddress: info.ipAddress,
      userAgent: info.userAgent,
      notes: isGranted ? "Pencatatan persetujuan pemrosesan data pribadi." : "Pencatatan pencabutan persetujuan data pribadi.",
    });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    return createSecureErrorResponse(error, "POST /api/crm/customers/[id]/consents", 500);
  }
}
