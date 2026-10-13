import { NextRequest, NextResponse } from "next/server";
import { Prisma, CreditApplicationStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuthAndPermission } from "@/lib/permissions";
import { createSecureErrorResponse, sanitizeInput } from "@/lib/security";
import {
  buildScopeFilter,
  isBranchAllowed,
  toScopeUser,
  type ScopeUser,
} from "@/lib/access-scope";
import {
  createCustomerWithNumber,
  findCustomerByIdentity,
  isValidIdentity,
  normalizeIdentityNumber,
  type CustomerTypeValue,
} from "@/lib/customer";

/** Field penugasan pada pengajuan kredit yang memberi hak akses kepada petugas. */
export const CREDIT_ASSIGNMENT_FIELDS = [
  "assignedMarketingOfficerId",
  "assignedAnalystId",
  "assignedSurveyOfficerId",
  "decisionMakerId",
];

const CUSTOMER_SELECT = {
  id: true,
  customerNumber: true,
  legalName: true,
  customerType: true,
  identityNumber: true,
  phone: true,
  email: true,
} as const;

/**
 * Memastikan petugas yang ditugaskan berada dalam jangkauan pengguna.
 * Wajib satu organisasi; untuk pengguna bercakupan cabang, petugas lain harus
 * berada di cabang yang sama (mencegah penugasan lintas cabang).
 */
async function ensureAssignable(
  scopeUser: ScopeUser,
  assigneeId: string | null | undefined
): Promise<string | null> {
  if (!assigneeId) return null;
  if (assigneeId === scopeUser.id) return null;
  const assignee = await db.user.findFirst({
    where: { id: assigneeId, organizationId: scopeUser.organizationId, isActive: true },
    select: { id: true, branchId: true },
  });
  if (!assignee) return "Petugas yang ditugaskan tidak ditemukan pada organisasi Anda.";
  if (!isBranchAllowed(scopeUser, assignee.branchId)) {
    return "Petugas yang ditugaskan berada di luar cabang Anda.";
  }
  return null;
}

export async function GET (req: NextRequest) {
  try {
    const authCheck = await requireAuthAndPermission("credit.application.view");
    if (!authCheck.authorized) {
      return authCheck.response!;
    }
    const currentUser = authCheck.user!;
    const scopeUser = toScopeUser(currentUser);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    // Cakupan organisasi/cabang/penugasan ditegakkan di server.
    const whereClause: Prisma.CreditApplicationWhereInput = {
      ...(buildScopeFilter(scopeUser, { assignmentFields: CREDIT_ASSIGNMENT_FIELDS }) as Prisma.CreditApplicationWhereInput),
    };

    if (status && Object.values(CreditApplicationStatus).includes(status as CreditApplicationStatus)) {
      whereClause.status = status as CreditApplicationStatus;
    }

    if (search) {
      const cleanSearch = sanitizeInput(search);
      whereClause.OR = [
        { applicationNumber: { contains: cleanSearch, mode: "insensitive" } },
        { product: { contains: cleanSearch, mode: "insensitive" } },
        { purpose: { contains: cleanSearch, mode: "insensitive" } },
        { customer: { legalName: { contains: cleanSearch, mode: "insensitive" } } },
      ];
    }

    const applications = await db.creditApplication.findMany({
      where: whereClause,
      include: {
        customer: { select: CUSTOMER_SELECT },
        branch: { select: { id: true, name: true, code: true } },
        marketingOfficer: { select: { id: true, fullName: true, email: true } },
        analyst: { select: { id: true, fullName: true, email: true } },
        surveyOfficer: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: applications });
  } catch (error) {
    return createSecureErrorResponse(error, "GET /api/credit/applications", 500);
  }
}

/**
 * Membuat pengajuan kredit. Pemohon SELALU berupa entitas Nasabah (Customer),
 * bukan akun pegawai (User) — Tahap 2A (P0.2).
 *
 * Mode pemohon (body.customerMode, nama lama applicantMode masih diterima):
 *  - "CUSTOMER" : memakai nasabah yang sudah terdaftar (customerId).
 *  - "MANUAL"   : mengetik data nasabah baru (nama/NIK/telepon/email/alamat).
 *  - "LEAD"     : menurunkan nasabah dari prospek (leadId).
 */
export async function POST (req: NextRequest) {
  try {
    const authCheck = await requireAuthAndPermission("credit.application.create");
    if (!authCheck.authorized) {
      return authCheck.response!;
    }

    const currentUser = authCheck.user!;
    const scopeUser = toScopeUser(currentUser);
    const body = await req.json();
    const {
      branchId,
      product,
      requestedAmount,
      requestedTenorMonths,
      purpose,
      source,

      // Mode pemohon (nama baru) + nama lama untuk kompatibilitas.
      customerMode,
      applicantMode,
      customerId,
      applicantId,

      // Data nasabah manual
      customerName,
      customerNik,
      customerPhone,
      customerEmail,
      customerAddress,
      customerType,

      // Nama lama (masih dikirim klien versi sebelumnya)
      applicantName,
      applicantNik,
      applicantPhone,
      applicantEmail,
      applicantAddress,

      // Prospek
      leadId,

      assignedMarketingOfficerId,
      assignedAnalystId,
      assignedSurveyOfficerId,
      notes,

      // KTP Document Upload
      ktpDocument,
    } = body;

    // Cakupan cabang: pengguna bercakupan cabang hanya boleh membuat pengajuan pada cabangnya.
    if (branchId && !isBranchAllowed(scopeUser, branchId)) {
      return NextResponse.json(
        { error: "Anda tidak berwenang membuat pengajuan pada cabang tersebut.", code: "BRANCH_FORBIDDEN" },
        { status: 403 }
      );
    }

    for (const assigneeId of [assignedMarketingOfficerId, assignedAnalystId, assignedSurveyOfficerId]) {
      const err = await ensureAssignable(scopeUser, assigneeId);
      if (err) return NextResponse.json({ error: err, code: "ASSIGNEE_FORBIDDEN" }, { status: 403 });
    }

    // "USER" adalah nama mode lama yang menunjuk ke akun pegawai; kini diperlakukan
    // sebagai pemilihan nasabah terdaftar.
    const rawMode = String(customerMode || applicantMode || "MANUAL").toUpperCase();
    const mode = rawMode === "USER" ? "CUSTOMER" : rawMode;

    const name = customerName ?? applicantName;
    const nik = customerNik ?? applicantNik;
    const phone = customerPhone ?? applicantPhone;
    const email = customerEmail ?? applicantEmail;
    const address = customerAddress ?? applicantAddress;
    const type: CustomerTypeValue = customerType === "BADAN" ? "BADAN" : "INDIVIDU";

    let targetCustomerId: string | null = null;

    if (mode === "CUSTOMER") {
      const selectedId = customerId || applicantId;
      if (!selectedId) {
        return NextResponse.json({ error: "Nasabah terdaftar wajib dipilih." }, { status: 400 });
      }
      const customer = await db.customer.findFirst({
        where: { id: selectedId, organizationId: currentUser.organizationId },
        select: { id: true },
      });
      if (!customer) {
        return NextResponse.json({ error: "Nasabah tidak ditemukan pada organisasi Anda." }, { status: 404 });
      }
      targetCustomerId = customer.id;
    } else if (mode === "MANUAL") {
      const cleanName = name ? sanitizeInput(name) : "";
      if (!cleanName || !phone) {
        return NextResponse.json({ error: "Nama lengkap dan nomor HP/WhatsApp nasabah wajib diisi." }, { status: 400 });
      }

      const normalizedNik = normalizeIdentityNumber(nik);
      if (normalizedNik && !isValidIdentity(type, normalizedNik)) {
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

      const existing = await findCustomerByIdentity(currentUser.organizationId, normalizedNik);
      if (existing) {
        targetCustomerId = existing.id;
      } else {
        const created = await createCustomerWithNumber(currentUser.organizationId, {
          branchId: branchId || currentUser.branchId || null,
          customerType: type,
          status: "PROSPEK",
          legalName: cleanName,
          identityType: normalizedNik ? (type === "BADAN" ? "NIB" : "KTP") : null,
          identityNumber: normalizedNik,
          phone: phone ? sanitizeInput(phone) : null,
          email: email ? sanitizeInput(email) : null,
          address: address ? sanitizeInput(address) : null,
          createdById: currentUser.id,
        });
        targetCustomerId = created.id;
      }
    } else if (mode === "LEAD") {
      if (!leadId) {
        return NextResponse.json({ error: "Prospek wajib dipilih." }, { status: 400 });
      }
      const lead = await db.lead.findFirst({
        where: { id: leadId, organizationId: currentUser.organizationId },
      });
      if (!lead) {
        return NextResponse.json({ error: "Prospek tidak ditemukan." }, { status: 404 });
      }

      const leadPhone = lead.phone ? sanitizeInput(lead.phone) : null;
      const existing = leadPhone
        ? await db.customer.findFirst({
            where: { organizationId: currentUser.organizationId, phone: leadPhone },
            select: { id: true },
          })
        : null;

      if (existing) {
        targetCustomerId = existing.id;
      } else {
        const created = await createCustomerWithNumber(currentUser.organizationId, {
          branchId: branchId || lead.branchId || currentUser.branchId || null,
          customerType: "INDIVIDU",
          status: "PROSPEK",
          legalName: sanitizeInput(lead.name),
          phone: leadPhone,
          address: lead.address ? sanitizeInput(lead.address) : null,
          createdById: currentUser.id,
          notes: `Dibuat dari prospek (${lead.source}).`,
        });
        targetCustomerId = created.id;
      }

      await db.lead.update({ where: { id: leadId }, data: { status: "APPLICATION" } });
    } else {
      return NextResponse.json({ error: "Mode pemohon tidak dikenal." }, { status: 400 });
    }

    if (!targetCustomerId) {
      return NextResponse.json({ error: "Data nasabah pemohon tidak dapat ditentukan." }, { status: 400 });
    }

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const applicationNumber = `KRD-${dateStr}-${randomSuffix}`;

    const combinedNotes = notes ? sanitizeInput(notes) : "";

    const newApplication = await db.creditApplication.create({
      data: {
        organizationId: currentUser.organizationId,
        branchId: branchId || currentUser.branchId,
        applicationNumber,
        customerId: targetCustomerId,
        product: sanitizeInput(product),
        requestedAmount: requestedAmount ? parseFloat(requestedAmount) : null,
        requestedTenorMonths: requestedTenorMonths ? parseInt(requestedTenorMonths, 10) : null,
        purpose: sanitizeInput(purpose),
        source: source ? sanitizeInput(source) : "Marketing Officer",
        assignedMarketingOfficerId: assignedMarketingOfficerId || currentUser.id,
        assignedAnalystId: assignedAnalystId || null,
        assignedSurveyOfficerId: assignedSurveyOfficerId || null,
        status: CreditApplicationStatus.SUBMITTED,
        submissionDate: new Date(),
        notes: combinedNotes,
        statusHistories: {
          create: {
            status: CreditApplicationStatus.SUBMITTED,
            changedById: currentUser.id,
            notes: "Permohonan kredit baru berhasil diajukan.",
          },
        },
      },
      include: {
        customer: { select: CUSTOMER_SELECT },
        branch: { select: { id: true, name: true, code: true } },
        marketingOfficer: { select: { id: true, fullName: true, email: true } },
      },
    });

    if (ktpDocument && ktpDocument.fileData) {
      await db.document.create({
        data: {
          organizationId: currentUser.organizationId,
          ownerType: "CREDIT_APPLICATION",
          ownerId: newApplication.id,
          documentType: "KTP",
          fileName: ktpDocument.fileName || "KTP_Pemohon.jpg",
          filePath: ktpDocument.fileData,
          fileExt: (ktpDocument.fileName || "").split(".").pop() || "jpg",
          fileSize: ktpDocument.fileSize || 1024,
          mimeType: ktpDocument.mimeType || "image/jpeg",
          uploadedById: currentUser.id,
          notes: "Dokumen KTP pemohon.",
        },
      });
    }

    return NextResponse.json({ success: true, data: newApplication }, { status: 201 });
  } catch (error) {
    return createSecureErrorResponse(error, "POST /api/credit/applications", 500);
  }
}
