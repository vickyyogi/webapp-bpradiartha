import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuthAndPermission } from "@/lib/permissions";
import { createSecureErrorResponse, sanitizeInput } from "@/lib/security";
import { buildScopeFilter, toScopeUser } from "@/lib/access-scope";
import {
  diffIdentitySnapshots,
  isValidIdentity,
  normalizeIdentityNumber,
  pickIdentitySnapshot,
  recordCustomerIdentityHistory,
  type CustomerTypeValue,
} from "@/lib/customer";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const CUSTOMER_ASSIGNMENT_FIELDS = ["createdById"];

function customerScope(user: Parameters<typeof toScopeUser>[0]): Prisma.CustomerWhereInput {
  return buildScopeFilter(toScopeUser(user), { assignmentFields: CUSTOMER_ASSIGNMENT_FIELDS }) as Prisma.CustomerWhereInput;
}

async function loadOwnedCustomer(id: string, user: Parameters<typeof toScopeUser>[0]) {
  return db.customer.findFirst({ where: { id, ...customerScope(user) } });
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const authCheck = await requireAuthAndPermission("crm.customer.view");
    if (!authCheck.authorized) return authCheck.response!;
    const currentUser = authCheck.user!;

    const { id } = await params;
    const customer = await db.customer.findFirst({
      where: { id, ...customerScope(currentUser) },
      include: {
        branch: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, fullName: true } },
        updatedBy: { select: { id: true, fullName: true } },
        verifiedBy: { select: { id: true, fullName: true } },
        identityHistories: {
          orderBy: { createdAt: "desc" },
          take: 100,
          include: {
            changedBy: { select: { id: true, fullName: true } },
            verifiedBy: { select: { id: true, fullName: true } },
          },
        },
        relationshipsAsSubject: {
          orderBy: { createdAt: "desc" },
          include: {
            relatedCustomer: { select: { id: true, customerNumber: true, legalName: true } },
            createdBy: { select: { id: true, fullName: true } },
          },
        },
        consents: { orderBy: { createdAt: "desc" } },
        creditApplications: {
          select: { id: true, applicationNumber: true, status: true, requestedAmount: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 25,
        },
      },
    });

    if (!customer) {
      return NextResponse.json({ error: "Nasabah tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: customer });
  } catch (error) {
    return createSecureErrorResponse(error, "GET /api/crm/customers/[id]", 500);
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const authCheck = await requireAuthAndPermission("crm.customer.update");
    if (!authCheck.authorized) return authCheck.response!;
    const currentUser = authCheck.user!;

    const { id } = await params;
    const existing = await loadOwnedCustomer(id, currentUser);
    if (!existing) {
      return NextResponse.json({ error: "Nasabah tidak ditemukan." }, { status: 404 });
    }

    const body = await req.json();
    const type: CustomerTypeValue =
      body.customerType === "BADAN"
        ? "BADAN"
        : body.customerType === "INDIVIDU"
        ? "INDIVIDU"
        : existing.customerType;

    if (body.identityNumber !== undefined) {
      const normalized = normalizeIdentityNumber(body.identityNumber);
      if (!isValidIdentity(type, normalized)) {
        return NextResponse.json(
          {
            error:
              type === "INDIVIDU"
                ? "NIK harus 16 digit angka."
                : "Nomor identitas usaha minimal 5 karakter.",
          },
          { status: 400 }
        );
      }
    }

    const data: Record<string, unknown> = { updatedById: currentUser.id };
    const setStr = (key: string, value: unknown, sanitize = true) => {
      if (value === undefined) return;
      if (value === null || value === "") data[key] = null;
      else data[key] = sanitize ? sanitizeInput(String(value)) : value;
    };

    if (body.customerType !== undefined) data.customerType = type;
    if (body.legalName !== undefined) {
      if (!String(body.legalName).trim()) {
        return NextResponse.json({ error: "Nama legal nasabah wajib diisi." }, { status: 400 });
      }
      data.legalName = sanitizeInput(String(body.legalName));
    }
    setStr("nickname", body.nickname);
    setStr("identityType", body.identityType);
    if (body.identityNumber !== undefined) data.identityNumber = normalizeIdentityNumber(body.identityNumber);
    setStr("npwp", body.npwp);
    setStr("birthPlace", body.birthPlace);
    if (body.birthDate !== undefined) data.birthDate = body.birthDate ? new Date(body.birthDate) : null;
    setStr("gender", body.gender);
    setStr("address", body.address);
    setStr("rtRw", body.rtRw);
    setStr("kelurahan", body.kelurahan);
    setStr("kecamatan", body.kecamatan);
    setStr("city", body.city);
    setStr("province", body.province);
    setStr("postalCode", body.postalCode);
    setStr("phone", body.phone);
    setStr("email", body.email);
    setStr("occupation", body.occupation);
    setStr("employerName", body.employerName);
    if (body.monthlyIncome !== undefined) {
      data.monthlyIncome = body.monthlyIncome === null || body.monthlyIncome === "" ? null : parseFloat(body.monthlyIncome);
    }
    if (body.branchId !== undefined) data.branchId = body.branchId || null;
    setStr("notes", body.notes);
    if (body.status !== undefined) data.status = body.status;
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

    const updated = await db.customer.update({ where: { id }, data });

    // Riwayat identitas: hanya field identitas yang berubah yang dicatat.
    const diff = diffIdentitySnapshots(pickIdentitySnapshot(existing), pickIdentitySnapshot(updated));
    if (diff.changedFields.length > 0) {
      await recordCustomerIdentityHistory({
        customerId: id,
        changedById: currentUser.id,
        action: "UPDATE",
        changedFields: diff.changedFields,
        oldValues: diff.oldValues,
        newValues: diff.newValues,
        notes: body.changeNote ? sanitizeInput(String(body.changeNote)) : "Perubahan data identitas nasabah.",
      });
    }

    return NextResponse.json({ success: true, data: updated, changedFields: diff.changedFields });
  } catch (error) {
    return createSecureErrorResponse(error, "PUT /api/crm/customers/[id]", 500);
  }
}
