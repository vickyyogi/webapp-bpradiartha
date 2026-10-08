import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { CreditApplicationStatus, DocumentOwnerType, DocumentType } from "@prisma/client";
import { requireAuthAndPermission } from "@/lib/permissions";
import { createSecureErrorResponse, sanitizeInput } from "@/lib/security";

export async function GET (req: NextRequest) {
  try {
    const authCheck = await requireAuthAndPermission("credit.application.view");
    if (!authCheck.authorized) {
      const session = await getServerSession(authOptions);
      if (!session?.user?.email) {
        return authCheck.response!;
      }
    }

    const session = await getServerSession(authOptions);
    const currentUser = await db.user.findUnique({
      where: { email: session!.user!.email! },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "Pengguna tidak ditemukan." }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    const whereClause = {
      organizationId: currentUser.organizationId,
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
        { applicant: { fullName: { contains: cleanSearch, mode: "insensitive" } } },
      ];
    }

    const applications = await db.creditApplication.findMany({
      where: whereClause,
      include: {
        applicant: { select: { id: true, fullName: true, email: true, phone: true } },
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

export async function POST (req: NextRequest) {
  try {
    const authCheck = await requireAuthAndPermission("credit.application.create");
    if (!authCheck.authorized) {
      return authCheck.response!;
    }

    const currentUser = authCheck.user!;
    const body = await req.json();
    const {
      branchId,
      product,
      requestedAmount,
      requestedTenorMonths,
      purpose,
      source,

      // Applicant modes: 'MANUAL' | 'LEAD' | 'USER'
      applicantMode,
      applicantId,

      // Manual applicant details
      applicantName,
      applicantNik,
      applicantPhone,
      applicantEmail,
      applicantAddress,

      // Lead details
      leadId,

      assignedMarketingOfficerId,
      assignedAnalystId,
      assignedSurveyOfficerId,
      notes,

      // KTP Document Upload
      ktpDocument,
    } = body;

    let targetApplicantId = applicantId;

    // 1. If Applicant mode is 'MANUAL', create or find user by email/phone
    if (applicantMode === "MANUAL" && applicantName) {
      const cleanName = sanitizeInput(applicantName);
      const cleanPhone = applicantPhone ? sanitizeInput(applicantPhone) : null;
      const cleanEmail = applicantEmail
        ? sanitizeInput(applicantEmail)
        : `debitur.${Date.now()}@bpr-client.internal`;

      // Check if user already exists with email
      let user = await db.user.findUnique({
        where: { email: cleanEmail },
      });

      if (!user) {
        user = await db.user.create({
          data: {
            organizationId: currentUser.organizationId,
            branchId: branchId || currentUser.branchId,
            email: cleanEmail,
            fullName: cleanName,
            phone: cleanPhone,
            passwordHash: "DEBITUR_DEFAULT_PASS",
            isActive: true,
          },
        });
      }
      targetApplicantId = user.id;
    } else if (applicantMode === "LEAD" && leadId) {
      // 2. If Applicant mode is 'LEAD', fetch lead details
      const lead = await db.lead.findUnique({
        where: { id: leadId },
      });

      if (lead) {
        const leadEmail = `lead.${lead.id.slice(0, 8)}@bpr-client.internal`;
        let user = await db.user.findFirst({
          where: {
            OR: [{ email: leadEmail }, { phone: lead.phone || undefined }],
          },
        });

        if (!user) {
          user = await db.user.create({
            data: {
              organizationId: currentUser.organizationId,
              branchId: branchId || currentUser.branchId,
              email: leadEmail,
              fullName: lead.name,
              phone: lead.phone,
              passwordHash: "DEBITUR_DEFAULT_PASS",
              isActive: true,
            },
          });
        }
        targetApplicantId = user.id;

        // Update lead status
        await db.lead.update({
          where: { id: leadId },
          data: { status: "APPLICATION" },
        });
      }
    }

    if (!targetApplicantId) {
      targetApplicantId = currentUser.id;
    }

    // Generate unique application number, e.g., KRD-YYYYMMDD-XXXX
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const applicationNumber = `KRD-${dateStr}-${randomSuffix}`;

    let combinedNotes = notes ? sanitizeInput(notes) : "";
    if (applicantNik) {
      combinedNotes = `[NIK KTP: ${sanitizeInput(applicantNik)}]\n${combinedNotes}`.trim();
    }
    if (applicantAddress) {
      combinedNotes = `[Alamat Pemohon: ${sanitizeInput(applicantAddress)}]\n${combinedNotes}`.trim();
    }

    const newApplication = await db.creditApplication.create({
      data: {
        organizationId: currentUser.organizationId,
        branchId: branchId || currentUser.branchId,
        applicationNumber,
        applicantId: targetApplicantId,
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
        applicant: { select: { id: true, fullName: true, email: true, phone: true } },
        branch: { select: { id: true, name: true, code: true } },
        marketingOfficer: { select: { id: true, fullName: true, email: true } },
      },
    });

    // 3. Save KTP Document if provided
    if (ktpDocument && ktpDocument.fileData) {
      await db.document.create({
        data: {
          organizationId: currentUser.organizationId,
          ownerType: DocumentOwnerType.CREDIT_APPLICATION,
          ownerId: newApplication.id,
          documentType: DocumentType.KTP,
          fileName: ktpDocument.fileName || "KTP_Pemohon.jpg",
          filePath: ktpDocument.fileData,
          fileExt: (ktpDocument.fileName || "").split(".").pop() || "jpg",
          fileSize: ktpDocument.fileSize || 1024,
          mimeType: ktpDocument.mimeType || "image/jpeg",
          uploadedById: currentUser.id,
          notes: `Dokumen KTP Pemohon (NIK: ${applicantNik || "-"})`,
        },
      });
    }

    return NextResponse.json({ success: true, data: newApplication }, { status: 201 });
  } catch (error) {
    return createSecureErrorResponse(error, "POST /api/credit/applications", 500);
  }
}
