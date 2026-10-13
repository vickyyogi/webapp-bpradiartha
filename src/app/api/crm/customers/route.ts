import { NextRequest, NextResponse } from "next/server";
import { Prisma, CustomerStatus, CustomerType } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuthAndPermission } from "@/lib/permissions";
import { createSecureErrorResponse, sanitizeInput } from "@/lib/security";
import { buildScopeFilter, isBranchAllowed, toScopeUser } from "@/lib/access-scope";
import {
  createCustomerWithNumber,
  findDuplicateCandidates,
  isValidIdentity,
  normalizeIdentityNumber,
  pickIdentitySnapshot,
  recordCustomerIdentityHistory,
  maskIdentity,
  type CustomerTypeValue,
} from "@/lib/customer";

const CUSTOMER_ASSIGNMENT_FIELDS = ["createdById"];

const customerScope = (user: Parameters<typeof toScopeUser>[0]) =>
  buildScopeFilter(toScopeUser(user), { assignmentFields: CUSTOMER_ASSIGNMENT_FIELDS }) as Prisma.CustomerWhereInput;

/** Bentuk ringkas nasabah untuk daftar (NIK disamarkan). */
function toListItem(c: {
  id: string;
  customerNumber: string;
  customerType: string;
  status: string;
  legalName: string;
  identityNumber: string | null;
  phone: string | null;
  email: string | null;
  branch?: { id: string; name: string; code: string } | null;
  verifiedAt: Date | null;
  createdAt: Date;
  _count?: { creditApplications: number };
}) {
  return {
    id: c.id,
    customerNumber: c.customerNumber,
    customerType: c.customerType,
    status: c.status,
    legalName: c.legalName,
    identityNumberMasked: maskIdentity(c.identityNumber),
    phone: c.phone,
    email: c.email,
    branch: c.branch ?? null,
    verified: Boolean(c.verifiedAt),
    applicationCount: c._count?.creditApplications ?? 0,
    createdAt: c.createdAt,
  };
}

export async function GET(req: NextRequest) {
  try {
    const authCheck = await requireAuthAndPermission("crm.customer.view");
    if (!authCheck.authorized) return authCheck.response!;
    const currentUser = authCheck.user!;

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");
    const status = searchParams.get("status");
    const customerType = searchParams.get("customerType");

    const where: Prisma.CustomerWhereInput = customerScope(currentUser);
    if (status && Object.values(CustomerStatus).includes(status as CustomerStatus)) {
      where.status = status as CustomerStatus;
    }
    if (customerType && Object.values(CustomerType).includes(customerType as CustomerType)) {
      where.customerType = customerType as CustomerType;
    }
    if (search) {
      const q = sanitizeInput(search);
      where.OR = [
        { legalName: { contains: q, mode: "insensitive" } },
        { customerNumber: { contains: q, mode: "insensitive" } },
        { identityNumber: { contains: q } },
        { phone: { contains: q } },
        { email: { contains: q, mode: "insensitive" } },
      ];
    }

    const customers = await db.customer.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true, code: true } },
        _count: { select: { creditApplications: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    return NextResponse.json({
      success: true,
      data: customers.map((c) => toListItem(c)),
    });
  } catch (error) {
    return createSecureErrorResponse(error, "GET /api/crm/customers", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const authCheck = await requireAuthAndPermission("crm.customer.create");
    if (!authCheck.authorized) return authCheck.response!;
    const currentUser = authCheck.user!;

    const body = await req.json();
    const {
      customerType,
      legalName,
      nickname,
      identityType,
      identityNumber,
      npwp,
      birthPlace,
      birthDate,
      gender,
      address,
      rtRw,
      kelurahan,
      kecamatan,
      city,
      province,
      postalCode,
      phone,
      email,
      occupation,
      employerName,
      monthlyIncome,
      branchId,
      notes,
      consent,
      force,
    } = body;

    if (!legalName || typeof legalName !== "string" || !legalName.trim()) {
      return NextResponse.json({ error: "Nama legal nasabah wajib diisi." }, { status: 400 });
    }

    const scopeUser = toScopeUser(currentUser);
    if (branchId && !isBranchAllowed(scopeUser, branchId)) {
      return NextResponse.json(
        { error: "Anda tidak berwenang membuat nasabah pada cabang tersebut.", code: "BRANCH_FORBIDDEN" },
        { status: 403 }
      );
    }

    const type: CustomerTypeValue = customerType === "BADAN" ? "BADAN" : "INDIVIDU";
    const normalizedIdentity = normalizeIdentityNumber(identityNumber);
    if (!isValidIdentity(type, normalizedIdentity)) {
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

    // Perlindungan duplikasi: identitas yang sudah persis terdaftar ditolak kecuali force.
    if (normalizedIdentity) {
      const duplicates = await findDuplicateCandidates(currentUser.organizationId, {
        identityNumber: normalizedIdentity,
        phone,
        legalName,
        birthDate,
        extraWhere: customerScope(currentUser),
      });
      const exact = duplicates.find((d) => d.matchReasons.includes("IDENTITY_EXACT"));
      if (exact && !force) {
        return NextResponse.json(
          {
            error: `Nomor identitas sudah terdaftar pada nasabah ${exact.customerNumber}. Konfirmasi bila tetap ingin menyimpan.`,
            code: "DUPLICATE_IDENTITY",
            duplicates,
          },
          { status: 409 }
        );
      }
    }

    const data = {
      branchId: branchId || currentUser.branchId || null,
      customerType: type,
      status: "PROSPEK" as const,
      legalName: sanitizeInput(legalName),
      nickname: nickname ? sanitizeInput(nickname) : null,
      identityType: identityType ? sanitizeInput(identityType) : normalizedIdentity ? (type === "BADAN" ? "NIB" : "KTP") : null,
      identityNumber: normalizedIdentity,
      npwp: npwp ? sanitizeInput(npwp) : null,
      birthPlace: birthPlace ? sanitizeInput(birthPlace) : null,
      birthDate: birthDate ? new Date(birthDate) : null,
      gender: gender ? sanitizeInput(gender) : null,
      address: address ? sanitizeInput(address) : null,
      rtRw: rtRw ? sanitizeInput(rtRw) : null,
      kelurahan: kelurahan ? sanitizeInput(kelurahan) : null,
      kecamatan: kecamatan ? sanitizeInput(kecamatan) : null,
      city: city ? sanitizeInput(city) : null,
      province: province ? sanitizeInput(province) : null,
      postalCode: postalCode ? sanitizeInput(postalCode) : null,
      phone: phone ? sanitizeInput(phone) : null,
      email: email ? sanitizeInput(email) : null,
      occupation: occupation ? sanitizeInput(occupation) : null,
      employerName: employerName ? sanitizeInput(employerName) : null,
      monthlyIncome: monthlyIncome !== undefined && monthlyIncome !== "" ? parseFloat(monthlyIncome) : null,
      createdById: currentUser.id,
      notes: notes ? sanitizeInput(notes) : null,
    };

    const created = await createCustomerWithNumber(currentUser.organizationId, data);

    await recordCustomerIdentityHistory({
      customerId: created.id,
      changedById: currentUser.id,
      action: "CREATE",
      newValues: pickIdentitySnapshot(created),
      notes: "Pembuatan data nasabah.",
    });

    if (consent && typeof consent === "object" && consent.dataProcessing === true) {
      await db.customerConsent.create({
        data: {
          customerId: created.id,
          consentType: "DATA_PROCESSING",
          granted: true,
          policyVersion: consent.policyVersion ? sanitizeInput(String(consent.policyVersion)) : null,
          evidenceRef: consent.evidenceRef ? sanitizeInput(String(consent.evidenceRef)) : null,
          grantedAt: new Date(),
          recordedById: currentUser.id,
          notes: consent.notes ? sanitizeInput(String(consent.notes)) : null,
        },
      });
    }

    return NextResponse.json(
      { success: true, data: { ...created, identityNumberMasked: maskIdentity(created.identityNumber) } },
      { status: 201 }
    );
  } catch (error) {
    return createSecureErrorResponse(error, "POST /api/crm/customers", 500);
  }
}
