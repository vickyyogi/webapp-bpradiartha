import { NextRequest, NextResponse } from "next/server";
import { CustomerRelationshipType } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuthAndPermission } from "@/lib/permissions";
import { createSecureErrorResponse, sanitizeInput } from "@/lib/security";
import { buildScopeFilter, toScopeUser } from "@/lib/access-scope";
import { logAudit, extractClientInfo } from "@/lib/audit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Hubungan antar-pihak nasabah: pasangan, penjamin, UBO, dsb (Tahap 2B — P0.2). */
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

    const relationships = await db.customerRelationship.findMany({
      where: { customerId: id },
      include: {
        relatedCustomer: { select: { id: true, customerNumber: true, legalName: true } },
        createdBy: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: relationships });
  } catch (error) {
    return createSecureErrorResponse(error, "GET /api/crm/customers/[id]/relationships", 500);
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
    const { relationshipType, relatedCustomerId, relatedName, relatedIdentityNumber, notes } = body;

    if (!Object.values(CustomerRelationshipType).includes(relationshipType)) {
      return NextResponse.json({ error: "Jenis hubungan tidak valid." }, { status: 400 });
    }
    if (!relatedCustomerId && !relatedName) {
      return NextResponse.json(
        { error: "Pilih nasabah terkait atau isi nama pihak terkait." },
        { status: 400 }
      );
    }
    if (relatedCustomerId === id) {
      return NextResponse.json({ error: "Nasabah tidak dapat dihubungkan dengan dirinya sendiri." }, { status: 400 });
    }

    let relatedId: string | null = null;
    if (relatedCustomerId) {
      const related = await db.customer.findFirst({
        where: { id: relatedCustomerId, organizationId: currentUser.organizationId },
        select: { id: true },
      });
      if (!related) {
        return NextResponse.json({ error: "Nasabah terkait tidak ditemukan." }, { status: 404 });
      }
      relatedId = related.id;
    }

    const created = await db.customerRelationship.create({
      data: {
        customerId: id,
        relatedCustomerId: relatedId,
        relationshipType,
        relatedName: relatedName ? sanitizeInput(String(relatedName)) : null,
        relatedIdentityNumber: relatedIdentityNumber ? sanitizeInput(String(relatedIdentityNumber)) : null,
        notes: notes ? sanitizeInput(String(notes)) : null,
        createdById: currentUser.id,
      },
      include: {
        relatedCustomer: { select: { id: true, customerNumber: true, legalName: true } },
      },
    });

    const info = extractClientInfo(req);
    await logAudit({
      organizationId: currentUser.organizationId,
      userId: currentUser.id,
      action: "CREATE",
      entityType: "CUSTOMER",
      entityId: id,
      newValues: { relationshipType, relatedCustomerId: relatedId, relatedName: relatedName ?? null },
      ipAddress: info.ipAddress,
      userAgent: info.userAgent,
      notes: "Penambahan hubungan antar-pihak nasabah.",
    });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    return createSecureErrorResponse(error, "POST /api/crm/customers/[id]/relationships", 500);
  }
}
