import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuthAndPermission } from "@/lib/permissions";
import { isBranchAllowed, toScopeUser } from "@/lib/access-scope";
import { buildAuditLogData, extractClientInfo } from "@/lib/audit";

export async function PUT (req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authCheck = await requireAuthAndPermission("admin.settings.manage");
    if (!authCheck.authorized) return authCheck.response;
    const user = authCheck.user!;
    const scopeUser = toScopeUser(user);
    const { id } = await params;

    const existing = await db.creditApprovalLimit.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) return NextResponse.json({ error: "Limit tidak ditemukan." }, { status: 404 });

    const body = await req.json();
    const data: Prisma.CreditApprovalLimitUpdateInput = {};

    if (body.roleId !== undefined) {
      const role = await db.role.findUnique({
        where: { id: String(body.roleId) },
        select: { id: true },
      });
      if (!role) return NextResponse.json({ error: "Role tidak ditemukan." }, { status: 404 });
      data.role = { connect: { id: role.id } };
    }
    if (body.branchId !== undefined) {
      const branchId = body.branchId ? String(body.branchId) : null;
      if (branchId && !isBranchAllowed(scopeUser, branchId)) {
        return NextResponse.json({ error: "Cabang berada di luar cakupan akses Anda." }, { status: 403 });
      }
      data.branch = branchId ? { connect: { id: branchId } } : { disconnect: true };
    }
    if (body.levelName !== undefined) {
      const levelName = String(body.levelName).trim();
      if (!levelName) return NextResponse.json({ error: "Nama level kewenangan wajib diisi." }, { status: 400 });
      data.levelName = levelName;
    }
    if (body.minAmount !== undefined) {
      const minAmount = Number(body.minAmount);
      if (!Number.isInteger(minAmount) || minAmount < 0) {
        return NextResponse.json({ error: "Limit minimum harus bilangan bulat rupiah." }, { status: 400 });
      }
      data.minAmount = new Prisma.Decimal(minAmount);
    }
    if (body.maxAmount !== undefined) {
      const maxAmount = Number(body.maxAmount);
      if (!Number.isInteger(maxAmount) || maxAmount < 0) {
        return NextResponse.json({ error: "Limit maksimum harus bilangan bulat rupiah." }, { status: 400 });
      }
      data.maxAmount = new Prisma.Decimal(maxAmount);
    }
    if (body.tierOrder !== undefined) {
      const tierOrder = Number(body.tierOrder);
      if (!Number.isInteger(tierOrder) || tierOrder < 1) {
        return NextResponse.json({ error: "Urutan tingkat harus bilangan bulat minimal 1." }, { status: 400 });
      }
      data.tierOrder = tierOrder;
    }
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

    const nextMin = body.minAmount !== undefined ? Number(body.minAmount) : Number(existing.minAmount);
    const nextMax = body.maxAmount !== undefined ? Number(body.maxAmount) : Number(existing.maxAmount);
    if (nextMax < nextMin) {
      return NextResponse.json({ error: "Limit maksimum tidak boleh kurang dari minimum." }, { status: 400 });
    }

    const clientInfo = extractClientInfo(req);
    // Tahap 7 (P1.6): perubahan konfigurasi limit + audit ditulis atomik.
    const updated = await db.$transaction(async (tx) => {
      const saved = await tx.creditApprovalLimit.update({
        where: { id },
        data,
        include: {
          role: { select: { id: true, name: true, code: true } },
          branch: { select: { id: true, name: true, code: true } },
        },
      });

      await tx.auditLog.create({
        data: buildAuditLogData({
          organizationId: user.organizationId,
          userId: user.id,
          action: "UPDATE",
          entityType: "CREDIT_APPROVAL_LIMIT",
          entityId: id,
          oldValues: {
            branchId: existing.branchId,
            levelName: existing.levelName,
            minAmount: existing.minAmount.toString(),
            maxAmount: existing.maxAmount.toString(),
            tierOrder: existing.tierOrder,
            isActive: existing.isActive,
          },
          newValues: body,
          ...clientInfo,
        }),
      });

      return saved;
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Error updating approval limit:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE (req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authCheck = await requireAuthAndPermission("admin.settings.manage");
    if (!authCheck.authorized) return authCheck.response;
    const user = authCheck.user!;
    const { id } = await params;

    const existing = await db.creditApprovalLimit.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) return NextResponse.json({ error: "Limit tidak ditemukan." }, { status: 404 });

    const clientInfo = extractClientInfo(req);
    // Nonaktifkan, bukan hapus: record limit pernah dipakai sebagai dasar keputusan.
    // Tahap 7 (P1.6): penonaktifan + audit ditulis atomik.
    await db.$transaction(async (tx) => {
      await tx.creditApprovalLimit.update({ where: { id }, data: { isActive: false } });
      await tx.auditLog.create({
        data: buildAuditLogData({
          organizationId: user.organizationId,
          userId: user.id,
          action: "DELETE",
          entityType: "CREDIT_APPROVAL_LIMIT",
          entityId: id,
          oldValues: { isActive: true },
          newValues: { isActive: false },
          notes: "Limit kewenangan dinonaktifkan.",
          ...clientInfo,
        }),
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error disabling approval limit:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
