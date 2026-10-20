import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuthAndPermission } from "@/lib/permissions";
import { toScopeUser, isBranchAllowed, buildScopeFilter } from "@/lib/access-scope";
import { buildAuditLogData, extractClientInfo } from "@/lib/audit";

export async function GET (_req: NextRequest) {
  try {
    const authCheck = await requireAuthAndPermission("admin.settings.view");
    if (!authCheck.authorized) {
      return authCheck.response;
    }
    const scopeUser = toScopeUser(authCheck.user!);

    const limits = await db.creditApprovalLimit.findMany({
      where: {
        organizationId: authCheck.user!.organizationId,
        ...(buildScopeFilter(scopeUser) as Prisma.CreditApprovalLimitWhereInput),
      },
      include: {
        role: { select: { id: true, name: true, code: true } },
        branch: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ tierOrder: "asc" }, { branchId: "asc" }],
    });

    return NextResponse.json({ success: true, data: limits });
  } catch (error) {
    console.error("Error fetching approval limits:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/** Tahap 9B — buat limit kewenangan (global atau per cabang). */
export async function POST (req: NextRequest) {
  try {
    const authCheck = await requireAuthAndPermission("admin.settings.manage");
    if (!authCheck.authorized) {
      return authCheck.response;
    }
    const user = authCheck.user!;
    const scopeUser = toScopeUser(user);
    const body = await req.json();
    const roleId = typeof body.roleId === "string" ? body.roleId : "";
    const branchId = body.branchId ? String(body.branchId) : null;
    const levelName = typeof body.levelName === "string" ? body.levelName.trim() : "";
    const minAmount = Number(body.minAmount);
    const maxAmount = Number(body.maxAmount);
    const tierOrder = Number(body.tierOrder ?? 1);

    if (!roleId) return NextResponse.json({ error: "Role wajib dipilih." }, { status: 400 });
    if (!levelName) return NextResponse.json({ error: "Nama level kewenangan wajib diisi." }, { status: 400 });
    if (
      !Number.isFinite(minAmount) ||
      !Number.isFinite(maxAmount) ||
      !Number.isInteger(minAmount) ||
      !Number.isInteger(maxAmount) ||
      minAmount < 0 ||
      maxAmount < minAmount
    ) {
      return NextResponse.json(
        { error: "Limit minimum/maksimum harus bilangan bulat rupiah dan maksimum ≥ minimum." },
        { status: 400 }
      );
    }
    if (!Number.isInteger(tierOrder) || tierOrder < 1) {
      return NextResponse.json({ error: "Urutan tingkat harus bilangan bulat minimal 1." }, { status: 400 });
    }
    if (branchId && !isBranchAllowed(scopeUser, branchId)) {
      return NextResponse.json({ error: "Cabang berada di luar cakupan akses Anda." }, { status: 403 });
    }

    const role = await db.role.findUnique({ where: { id: roleId }, select: { id: true } });
    if (!role) return NextResponse.json({ error: "Role tidak ditemukan." }, { status: 404 });

    const clientInfo = extractClientInfo(req);
    // Tahap 7 (P1.6): konfigurasi limit + audit ditulis atomik.
    const created = await db.$transaction(async (tx) => {
      const saved = await tx.creditApprovalLimit.create({
        data: {
          organizationId: user.organizationId,
          branchId,
          roleId,
          levelName,
          minAmount: new Prisma.Decimal(minAmount),
          maxAmount: new Prisma.Decimal(maxAmount),
          tierOrder,
        },
        include: {
          role: { select: { id: true, name: true, code: true } },
          branch: { select: { id: true, name: true, code: true } },
        },
      });

      await tx.auditLog.create({
        data: buildAuditLogData({
          organizationId: user.organizationId,
          userId: user.id,
          action: "CREATE",
          entityType: "CREDIT_APPROVAL_LIMIT",
          entityId: saved.id,
          newValues: { roleId, branchId, levelName, minAmount, maxAmount, tierOrder },
          ...clientInfo,
        }),
      });

      return saved;
    });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    console.error("Error creating approval limit:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
