import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuthAndPermission } from "@/lib/permissions";
import { createSecureErrorResponse } from "@/lib/security";
import { buildScopeFilter, toScopeUser } from "@/lib/access-scope";
import { logAudit, extractClientInfo } from "@/lib/audit";

interface RouteParams {
  params: Promise<{ id: string; relationshipId: string }>;
}

/** Menghapus hubungan antar-pihak nasabah (Tahap 2B — P0.2). */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const authCheck = await requireAuthAndPermission("crm.customer.update");
    if (!authCheck.authorized) return authCheck.response!;
    const currentUser = authCheck.user!;

    const { id, relationshipId } = await params;
    const owned = await db.customer.findFirst({
      where: { id, ...(buildScopeFilter(toScopeUser(currentUser), { assignmentFields: ["createdById"] }) as object) },
      select: { id: true },
    });
    if (!owned) return NextResponse.json({ error: "Nasabah tidak ditemukan." }, { status: 404 });

    const relationship = await db.customerRelationship.findFirst({
      where: { id: relationshipId, customerId: id },
    });
    if (!relationship) {
      return NextResponse.json({ error: "Hubungan tidak ditemukan." }, { status: 404 });
    }

    await db.customerRelationship.delete({ where: { id: relationshipId } });

    const info = extractClientInfo(req);
    await logAudit({
      organizationId: currentUser.organizationId,
      userId: currentUser.id,
      action: "DELETE",
      entityType: "CUSTOMER",
      entityId: id,
      oldValues: { relationshipType: relationship.relationshipType, relatedCustomerId: relationship.relatedCustomerId },
      ipAddress: info.ipAddress,
      userAgent: info.userAgent,
      notes: "Penghapusan hubungan antar-pihak nasabah.",
    });

    return NextResponse.json({ success: true, message: "Hubungan berhasil dihapus." });
  } catch (error) {
    return createSecureErrorResponse(error, "DELETE /api/crm/customers/[id]/relationships/[relationshipId]", 500);
  }
}
