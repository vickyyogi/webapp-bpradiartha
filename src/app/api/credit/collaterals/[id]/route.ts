import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuthAndPermission } from "@/lib/permissions";
import { buildScopeFilter, isBranchAllowed, toScopeUser } from "@/lib/access-scope";
import { extractClientInfo, logAudit } from "@/lib/audit";
import { createSecureErrorResponse } from "@/lib/security";
import { parseCollateralPayload, reminderLevel } from "@/lib/collateral";

const include = {
  customer: { select: { id: true, customerNumber: true, legalName: true } },
  creditApplication: { select: { id: true, applicationNumber: true, status: true } },
  branch: { select: { id: true, name: true } },
  createdBy: { select: { id: true, fullName: true } },
  appraisals: {
    orderBy: { appraisalDate: "desc" },
    include: { createdBy: { select: { fullName: true } } },
  },
} satisfies Prisma.CreditCollateralInclude;

function serialize(c: Prisma.CreditCollateralGetPayload<{ include: typeof include }>) {
  return {
    ...c,
    reminders: {
      appraisal: reminderLevel(c.nextAppraisalDate),
      binding: reminderLevel(c.bindingExpiryDate),
      insurance: reminderLevel(c.insuranceExpiryDate),
    },
  };
}

async function findInScopeLight(id: string, user: Parameters<typeof toScopeUser>[0]) {
  const where: Prisma.CreditCollateralWhereInput = {
    id,
    ...(buildScopeFilter(toScopeUser(user), { assignmentFields: [] }) as Prisma.CreditCollateralWhereInput),
  };
  return db.creditCollateral.findFirst({
    where,
    include: { customer: { select: { id: true, legalName: true } } },
  });
}

async function findInScopeDetail(id: string, user: Parameters<typeof toScopeUser>[0]) {
  const where: Prisma.CreditCollateralWhereInput = {
    id,
    ...(buildScopeFilter(toScopeUser(user), { assignmentFields: [] }) as Prisma.CreditCollateralWhereInput),
  };
  return db.creditCollateral.findFirst({ where, include });
}

export async function GET (req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authCheck = await requireAuthAndPermission("credit.collateral.view");
    if (!authCheck.authorized) return authCheck.response!;
    const { id } = await params;
    const collateral = await findInScopeDetail(id, authCheck.user!);
    if (!collateral) return NextResponse.json({ error: "Agunan tidak ditemukan." }, { status: 404 });
    return NextResponse.json({ success: true, data: serialize(collateral) });
  } catch (error) {
    return createSecureErrorResponse(error, "GET /api/credit/collaterals/[id]", 500);
  }
}

export async function PUT (req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authCheck = await requireAuthAndPermission("credit.collateral.update");
    if (!authCheck.authorized) return authCheck.response!;
    const currentUser = authCheck.user!;
    const scopeUser = toScopeUser(currentUser);
    const { id } = await params;

    const existing = await findInScopeLight(id, currentUser);
    if (!existing) return NextResponse.json({ error: "Agunan tidak ditemukan." }, { status: 404 });

    const body = (await req.json()) as Record<string, unknown>;
    const parsed = parseCollateralPayload(body);
    if (!parsed.data) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const data = parsed.data;

    if (data.customerId !== existing.customerId) {
      const customer = await db.customer.findFirst({
        where: { id: data.customerId, organizationId: currentUser.organizationId },
        select: { branchId: true },
      });
      if (!customer) return NextResponse.json({ error: "Nasabah tidak ditemukan." }, { status: 404 });
      if (!isBranchAllowed(scopeUser, customer.branchId)) {
        return NextResponse.json({ error: "Nasabah berada di luar cakupan cabang Anda." }, { status: 403 });
      }
    }
    if (data.creditApplicationId) {
      const app = await db.creditApplication.findFirst({
        where: {
          id: data.creditApplicationId,
          organizationId: currentUser.organizationId,
          customerId: data.customerId,
        },
        select: { id: true },
      });
      if (!app) {
        return NextResponse.json({ error: "Pengajuan kredit tidak ditemukan untuk nasabah ini." }, { status: 404 });
      }
    }

    const recordAppraisal = body.recordAppraisal === true && data.appraisalDate !== null;
    const { collateralCode, ...updateData } = data;

    const updated = await db.$transaction(async (tx) => {
      const collateral = await tx.creditCollateral.update({
        where: { id },
        data: {
          ...updateData,
          ...(collateralCode ? { collateralCode } : {}),
        },
        include,
      });
      if (recordAppraisal && data.appraisalDate) {
        await tx.collateralAppraisal.create({
          data: {
            collateralId: id,
            marketValue: data.marketValue,
            njopValue: data.njopValue,
            appraisedValue: data.appraisedValue,
            appraiserName: data.appraiserName,
            method: data.appraisalMethod,
            appraisalDate: data.appraisalDate,
            createdById: currentUser.id,
          },
        });
      }
      return collateral;
    });

    await logAudit({
      organizationId: currentUser.organizationId,
      userId: currentUser.id,
      action: "UPDATE",
      entityType: "CREDIT_COLLATERAL",
      entityId: id,
      ...extractClientInfo(req),
      oldValues: { status: existing.status },
      newValues: { status: updated.status, recordAppraisal },
      notes: "Memperbarui data agunan.",
    });

    return NextResponse.json({ success: true, data: serialize(updated) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Kode agunan sudah dipakai." }, { status: 409 });
    }
    return createSecureErrorResponse(error, "PUT /api/credit/collaterals/[id]", 500);
  }
}

export async function DELETE (req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authCheck = await requireAuthAndPermission("credit.collateral.delete");
    if (!authCheck.authorized) return authCheck.response!;
    const currentUser = authCheck.user!;
    const { id } = await params;

    const existing = await findInScopeLight(id, currentUser);
    if (!existing) return NextResponse.json({ error: "Agunan tidak ditemukan." }, { status: 404 });

    await db.creditCollateral.delete({ where: { id } });

    await logAudit({
      organizationId: currentUser.organizationId,
      userId: currentUser.id,
      action: "DELETE",
      entityType: "CREDIT_COLLATERAL",
      entityId: id,
      ...extractClientInfo(req),
      oldValues: { collateralCode: existing.collateralCode, customerId: existing.customerId },
      notes: "Menghapus data agunan.",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return createSecureErrorResponse(error, "DELETE /api/credit/collaterals/[id]", 500);
  }
}
