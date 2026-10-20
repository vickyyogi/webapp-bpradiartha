import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { requireAuthAndPermission } from "@/lib/permissions";
import { buildAuditLogData, extractClientInfo } from "@/lib/audit";
import { normalizeLoanProductAttributes } from "@/lib/credit-product";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requireAuthAndPermission("admin.master_data.manage");
    if (!authCheck.authorized) {
      return authCheck.response;
    }

    const currentUser = await db.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id } = await params;
    const existing = await db.masterItem.findFirst({ where: { id, organizationId: currentUser.organizationId } });
    if (!existing) {
      return NextResponse.json({ error: "Item master data tidak ditemukan" }, { status: 404 });
    }

    const body = await req.json();

    // Tahap 9A (P1.1): validasi atribut produk kredit sebelum disimpan.
    let attributes = body.attributes !== undefined ? body.attributes : existing.attributes;
    if (existing.category === "LOAN_PRODUCT" && body.attributes !== undefined) {
      const normalized = normalizeLoanProductAttributes(body.attributes);
      if (normalized.error) {
        return NextResponse.json({ error: normalized.error }, { status: 400 });
      }
      attributes = normalized.attributes;
    }

    const clientInfo = extractClientInfo(req);
    // Tahap 7 (P1.6): perubahan master data + audit ditulis atomik.
    const updated = await db.$transaction(async (tx) => {
      const saved = await tx.masterItem.update({
        where: { id },
        data: {
          name: body.name !== undefined ? body.name : existing.name,
          description: body.description !== undefined ? body.description : existing.description,
          attributes,
          sortOrder: body.sortOrder !== undefined ? Number(body.sortOrder) : existing.sortOrder,
          isActive: body.isActive !== undefined ? Boolean(body.isActive) : existing.isActive,
        },
      });

      await tx.auditLog.create({
        data: buildAuditLogData({
          organizationId: currentUser.organizationId,
          userId: currentUser.id,
          action: "UPDATE",
          entityType: "MASTER_DATA",
          entityId: id,
          oldValues: existing,
          newValues: saved,
          ipAddress: clientInfo.ipAddress,
          userAgent: clientInfo.userAgent,
          notes: `Memperbarui Master Data [${saved.category}]: ${saved.code} - ${saved.name}`,
        }),
      });

      return saved;
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/admin/master-data/[id] error:", error);
    return NextResponse.json({ error: "Failed to update master item" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requireAuthAndPermission("admin.master_data.manage");
    if (!authCheck.authorized) {
      return authCheck.response;
    }

    const currentUser = await db.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id } = await params;
    const existing = await db.masterItem.findFirst({ where: { id, organizationId: currentUser.organizationId } });
    if (!existing) {
      return NextResponse.json({ error: "Item master data tidak ditemukan" }, { status: 404 });
    }

    const clientInfo = extractClientInfo(req);
    await db.$transaction(async (tx) => {
      await tx.masterItem.delete({ where: { id } });
      await tx.auditLog.create({
        data: buildAuditLogData({
          organizationId: currentUser.organizationId,
          userId: currentUser.id,
          action: "DELETE",
          entityType: "MASTER_DATA",
          entityId: id,
          oldValues: existing,
          ipAddress: clientInfo.ipAddress,
          userAgent: clientInfo.userAgent,
          notes: `Menghapus Master Data [${existing.category}]: ${existing.code} - ${existing.name}`,
        }),
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/admin/master-data/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete master item" }, { status: 500 });
  }
}
