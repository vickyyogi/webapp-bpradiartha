import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuthAndPermission } from "@/lib/permissions";
import { buildScopeFilter, isBranchAllowed, toScopeUser } from "@/lib/access-scope";
import { extractClientInfo, logAudit } from "@/lib/audit";
import { createSecureErrorResponse, sanitizeInput } from "@/lib/security";
import { COLLATERAL_STATUSES, parseCollateralPayload, reminderLevel } from "@/lib/collateral";

const scopeFor = (user: Parameters<typeof toScopeUser>[0]) =>
  buildScopeFilter(toScopeUser(user), { assignmentFields: [] }) as Prisma.CreditCollateralWhereInput;

const collateralInclude = {
  customer: { select: { id: true, customerNumber: true, legalName: true } },
  creditApplication: { select: { id: true, applicationNumber: true, status: true } },
  branch: { select: { id: true, name: true } },
  createdBy: { select: { id: true, fullName: true } },
} satisfies Prisma.CreditCollateralInclude;

function serialize(c: Prisma.CreditCollateralGetPayload<{ include: typeof collateralInclude }>) {
  return {
    ...c,
    reminders: {
      appraisal: reminderLevel(c.nextAppraisalDate),
      binding: reminderLevel(c.bindingExpiryDate),
      insurance: reminderLevel(c.insuranceExpiryDate),
    },
  };
}

export async function GET (req: NextRequest) {
  try {
    const authCheck = await requireAuthAndPermission("credit.collateral.view");
    if (!authCheck.authorized) return authCheck.response!;
    const currentUser = authCheck.user!;
    const scopeUser = toScopeUser(currentUser);

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");
    const status = searchParams.get("status");
    const customerId = searchParams.get("customerId");
    const creditApplicationId = searchParams.get("creditApplicationId");
    const reminders = searchParams.get("reminders") === "1";
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 20)));

    const where: Prisma.CreditCollateralWhereInput = scopeFor(currentUser);
    const andFilters: Prisma.CreditCollateralWhereInput[] = [];
    if (status && (COLLATERAL_STATUSES as readonly string[]).includes(status.toUpperCase())) {
      where.status = status.toUpperCase() as (typeof COLLATERAL_STATUSES)[number];
    }
    if (customerId) where.customerId = customerId;
    if (creditApplicationId) where.creditApplicationId = creditApplicationId;
    if (search) {
      const q = sanitizeInput(search);
      andFilters.push({
        OR: [
          { collateralCode: { contains: q, mode: "insensitive" } },
          { collateralType: { contains: q, mode: "insensitive" } },
          { legalOwnerName: { contains: q, mode: "insensitive" } },
          { ownershipProof: { contains: q, mode: "insensitive" } },
          { customer: { legalName: { contains: q, mode: "insensitive" } } },
        ],
      });
    }
    if (reminders) {
      const until = new Date();
      until.setDate(until.getDate() + 30);
      andFilters.push({ status: "ACTIVE" });
      andFilters.push({
        OR: [
          { nextAppraisalDate: { lte: until } },
          { bindingExpiryDate: { lte: until } },
          { insuranceExpiryDate: { lte: until } },
        ],
      });
    }
    if (andFilters.length) where.AND = andFilters;

    const [items, total] = await Promise.all([
      db.creditCollateral.findMany({
        where,
        include: collateralInclude,
        orderBy: [{ status: "asc" }, { nextAppraisalDate: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.creditCollateral.count({ where }),
    ]);

    // Ringkasan pengingat hanya menghitung agunan aktif dalam cakupan pengguna.
    const activeWhere: Prisma.CreditCollateralWhereInput = { ...scopeFor(currentUser), status: "ACTIVE" };
    const in30 = new Date();
    in30.setDate(in30.getDate() + 30);
    const [appraisalDue, bindingDue, insuranceDue] = await Promise.all([
      db.creditCollateral.count({ where: { ...activeWhere, nextAppraisalDate: { lte: in30 } } }),
      db.creditCollateral.count({ where: { ...activeWhere, bindingExpiryDate: { lte: in30 } } }),
      db.creditCollateral.count({ where: { ...activeWhere, insuranceExpiryDate: { lte: in30 } } }),
    ]);

    return NextResponse.json({
      success: true,
      data: items.map(serialize),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      reminders: { appraisalDue, bindingDue, insuranceDue },
    });
  } catch (error) {
    return createSecureErrorResponse(error, "GET /api/credit/collaterals", 500);
  }
}

export async function POST (req: NextRequest) {
  try {
    const authCheck = await requireAuthAndPermission("credit.collateral.create");
    if (!authCheck.authorized) return authCheck.response!;
    const currentUser = authCheck.user!;
    const scopeUser = toScopeUser(currentUser);

    const body = await req.json();
    const parsed = parseCollateralPayload(body as Record<string, unknown>);
    if (!parsed.data) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const data = parsed.data;

    const customer = await db.customer.findFirst({
      where: { id: data.customerId, organizationId: currentUser.organizationId },
      select: { id: true, branchId: true },
    });
    if (!customer) return NextResponse.json({ error: "Nasabah tidak ditemukan." }, { status: 404 });
    if (!isBranchAllowed(scopeUser, customer.branchId)) {
      return NextResponse.json({ error: "Nasabah berada di luar cakupan cabang Anda." }, { status: 403 });
    }

    if (data.creditApplicationId) {
      const app = await db.creditApplication.findFirst({
        where: {
          id: data.creditApplicationId,
          organizationId: currentUser.organizationId,
          customerId: data.customerId,
        },
        select: { id: true, branchId: true },
      });
      if (!app) {
        return NextResponse.json({ error: "Pengajuan kredit tidak ditemukan untuk nasabah ini." }, { status: 404 });
      }
      if (!isBranchAllowed(scopeUser, app.branchId)) {
        return NextResponse.json({ error: "Pengajuan berada di luar cakupan cabang Anda." }, { status: 403 });
      }
    }

    const collateralCode =
      data.collateralCode || `AGN-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 4).toUpperCase()}`;

    const created = await db.$transaction(async (tx) => {
      const collateral = await tx.creditCollateral.create({
        data: {
          ...data,
          collateralCode,
          organizationId: currentUser.organizationId,
          branchId: customer.branchId,
          createdById: currentUser.id,
        },
        include: collateralInclude,
      });

      if (data.appraisalDate) {
        await tx.collateralAppraisal.create({
          data: {
            collateralId: collateral.id,
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
      action: "CREATE",
      entityType: "CREDIT_COLLATERAL",
      entityId: created.id,
      ...extractClientInfo(req),
      newValues: { collateralCode: created.collateralCode, customerId: created.customerId },
      notes: "Membuat data agunan.",
    });

    return NextResponse.json({ success: true, data: serialize(created) }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Kode agunan sudah dipakai." }, { status: 409 });
    }
    return createSecureErrorResponse(error, "POST /api/credit/collaterals", 500);
  }
}
