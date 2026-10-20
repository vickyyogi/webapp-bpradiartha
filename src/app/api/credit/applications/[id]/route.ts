import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { Prisma, CreditApplicationStatus, DocumentType } from "@prisma/client";
import { hasPermission, requireAnyPermission, requireAuthAndPermission } from "@/lib/permissions";
import { buildScopeFilter, isBranchAllowed, toScopeUser, violatesSegregationOfDuties } from "@/lib/access-scope";
import { extractClientInfo, logAudit } from "@/lib/audit";
import { listActiveCreditProducts, validateCreditRequestAgainstProduct } from "@/lib/credit-product";
import {
  effectiveLimitsForBranch,
  missingRequiredDocuments,
  normalizeCommitteeDecision,
  requiredDocumentsForProduct,
  validateChecklistUpdate,
  validateDisbursementReady,
  validateReturnReason,
  validateStandardAnalysis,
  validateStandardSurvey,
} from "@/lib/credit-governance";
import {
  isContinuationStatus,
  isValidOverrideReason,
  OVERRIDE_REASON_MIN_LENGTH,
  overrideRoleLabel,
  resolveOverrideActor,
} from "@/lib/slik/override";
import { CREDIT_ASSIGNMENT_FIELDS } from "../route";

const DECISION_STATUSES: CreditApplicationStatus[] = [
  CreditApplicationStatus.APPROVED,
  CreditApplicationStatus.REJECTED,
];

/**
 * Tahap 5B (P0.5): panjang minimum alasan/pertimbangan pejabat pemutus untuk
 * keputusan akhir. Nilai ini juga dipakai oleh UI sebagai pencegahan awal —
 * server tetap otoritatif.
 */
const DECISION_NOTES_MIN_LENGTH = 10;

async function ensureAssignable(
  organizationId: string,
  branchAllowed: (branchId?: string | null) => boolean,
  assigneeId: string | null | undefined
): Promise<string | null> {
  if (!assigneeId) return null;
  const assignee = await db.user.findFirst({
    where: { id: assigneeId, organizationId, isActive: true },
    select: { id: true, branchId: true },
  });
  if (!assignee) return "Petugas yang ditugaskan tidak ditemukan pada organisasi Anda.";
  if (!branchAllowed(assignee.branchId)) return "Petugas yang ditugaskan berada di luar cabang Anda.";
  return null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authCheck = await requireAuthAndPermission("credit.application.view");
    if (!authCheck.authorized) {
      return authCheck.response;
    }
    const scopeUser = toScopeUser(authCheck.user!);

    const { id } = await params;
    const application = await db.creditApplication.findFirst({
      where: {
        id,
        ...(buildScopeFilter(scopeUser, { assignmentFields: CREDIT_ASSIGNMENT_FIELDS }) as Prisma.CreditApplicationWhereInput),
      },
      include: {
        customer: { select: { id: true, customerNumber: true, legalName: true, customerType: true, identityNumber: true, phone: true, email: true } },
        branch: { select: { id: true, name: true, code: true } },
        marketingOfficer: { select: { id: true, fullName: true, email: true } },
        analyst: { select: { id: true, fullName: true, email: true } },
        surveyOfficer: { select: { id: true, fullName: true, email: true } },
        decisionMaker: { select: { id: true, fullName: true, email: true } },
        statusHistories: {
          include: { changedBy: { select: { id: true, fullName: true, email: true } } },
          orderBy: { createdAt: "desc" },
        },
        approvalRecords: {
          include: { approver: { select: { id: true, fullName: true, email: true } } },
          orderBy: { createdAt: "desc" },
        },
        documentChecklist: { orderBy: { documentType: "asc" } },
        committeeDecisions: { orderBy: { decidedAt: "desc" } },
        disbursementConditions: { orderBy: { sortOrder: "asc" } },
      },
    });

    // 404 (bukan 403) agar keberadaan record di cabang/penugasan lain tidak terbocor.
    if (!application) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: application });
  } catch (error) {
    console.error("Error fetching credit application detail:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authCheck = await requireAnyPermission(
      ["credit.application.update", "credit.application.verify"],
      ["DIRECTOR", "ADMIN"]
    );
    if (!authCheck.authorized) {
      return authCheck.response;
    }

    const session = await getServerSession(authOptions);
    const currentUser = await db.user.findUnique({
      where: { email: session!.user!.email! },
      include: { userRoles: { include: { role: true } } },
    });
    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const scopeUser = toScopeUser(currentUser);

    const { id } = await params;
    const existing = await db.creditApplication.findFirst({
      where: {
        id,
        ...(buildScopeFilter(scopeUser, { assignmentFields: CREDIT_ASSIGNMENT_FIELDS }) as Prisma.CreditApplicationWhereInput),
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    const body = await req.json();
    const {
      product,
      requestedAmount,
      requestedTenorMonths,
      purpose,
      source,
      status,
      branchId,
      assignedMarketingOfficerId,
      assignedAnalystId,
      assignedSurveyOfficerId,
      notes,
      analysisData,
      surveyData,
      approvedAmount,
      approvedTenorMonths,
      interestRate,
      decisionNotes,
      conditions,
      realizationDate,
      realizationReference,
      realizationAmount,
      statusChangeNote,
      returnReason,
      documentChecklist,
      committeeDecision,
      disbursementConditions,
    } = body;

    // Cakupan cabang: pengguna bercakupan cabang tidak boleh memindahkan ke cabang lain.
    if (branchId !== undefined && branchId && !isBranchAllowed(scopeUser, branchId)) {
      return NextResponse.json(
        { error: "Anda tidak berwenang memindahkan pengajuan ke cabang tersebut.", code: "BRANCH_FORBIDDEN" },
        { status: 403 }
      );
    }

    for (const assigneeId of [assignedMarketingOfficerId, assignedAnalystId, assignedSurveyOfficerId]) {
      const err = await ensureAssignable(currentUser.organizationId, (b) => isBranchAllowed(scopeUser, b), assigneeId);
      if (err) return NextResponse.json({ error: err, code: "ASSIGNEE_FORBIDDEN" }, { status: 403 });
    }

    // Tahap 9A (P1.1): produk/plafon/tenor hasil perubahan divalidasi terhadap
    // master produk kredit. Produk historis yang tidak ada di master tetap
    // diperbolehkan selama nilainya tidak diubah.
    if (product !== undefined || requestedAmount !== undefined || requestedTenorMonths !== undefined) {
      const products = await listActiveCreditProducts(currentUser.organizationId);
      const productError = validateCreditRequestAgainstProduct(
        {
          product: product !== undefined ? product : existing.product,
          requestedAmount: requestedAmount !== undefined ? requestedAmount : existing.requestedAmount,
          requestedTenorMonths:
            requestedTenorMonths !== undefined ? requestedTenorMonths : existing.requestedTenorMonths,
        },
        products,
        existing.product
      );
      if (productError) {
        return NextResponse.json({ error: productError, code: "CREDIT_PRODUCT_INVALID" }, { status: 400 });
      }
    }

    const products = await listActiveCreditProducts(currentUser.organizationId);
    const finalProduct = product !== undefined ? product : existing.product;
    const requiredDocuments = requiredDocumentsForProduct(products, finalProduct);

    // Tahap 9C: checklist berkas. Item wajib dari produk tidak boleh dihapus;
    // item yang belum ada dibuat otomatis (unchecked) agar gate berikutnya jujur.
    const existingChecklist = await db.creditDocumentChecklist.findMany({
      where: { organizationId: currentUser.organizationId, creditApplicationId: id },
      select: { documentType: true, isRequired: true, isChecked: true },
    });

    let checklistForGate = existingChecklist.map((item) => ({
      documentType: item.documentType as string,
      isRequired: item.isRequired,
      isChecked: item.isChecked,
    }));

    const missingChecklistRows = requiredDocuments.filter(
      (doc) => !existingChecklist.some((item) => item.documentType === doc)
    );

    if (documentChecklist !== undefined) {
      if (!Array.isArray(documentChecklist)) {
        return NextResponse.json(
          { error: "Checklist dokumen harus berupa daftar.", code: "DOCUMENT_CHECKLIST_INVALID" },
          { status: 400 }
        );
      }
      const present = new Set(
        documentChecklist.map((item: { documentType?: unknown }) => String(item?.documentType ?? "").toUpperCase())
      );
      const merged = [
        ...documentChecklist,
        ...requiredDocuments
          .filter((doc) => !present.has(doc))
          .map((documentType) => ({ documentType, isChecked: false })),
      ];
      const validated = validateChecklistUpdate(existingChecklist, merged, requiredDocuments);
      if (validated.error) {
        return NextResponse.json(
          { error: validated.error, code: "DOCUMENT_CHECKLIST_INVALID" },
          { status: 400 }
        );
      }

      for (const item of validated.items) {
        await db.creditDocumentChecklist.upsert({
          where: {
            creditApplicationId_documentType: {
              creditApplicationId: id,
              documentType: item.documentType as DocumentType,
            },
          },
          create: {
            organizationId: currentUser.organizationId,
            creditApplicationId: id,
            documentType: item.documentType as DocumentType,
            isRequired: item.isRequired,
            isChecked: item.isChecked,
            note: item.note ?? null,
            checkedById: item.isChecked ? currentUser.id : null,
            checkedByName: item.isChecked ? currentUser.fullName : null,
            checkedAt: item.isChecked ? new Date() : null,
          },
          update: {
            isRequired: item.isRequired,
            isChecked: item.isChecked,
            note: item.note ?? null,
            checkedById: item.isChecked ? currentUser.id : null,
            checkedByName: item.isChecked ? currentUser.fullName : null,
            checkedAt: item.isChecked ? new Date() : null,
          },
        });
      }
      checklistForGate = validated.items.map((item) => ({
        documentType: item.documentType,
        isRequired: item.isRequired,
        isChecked: Boolean(item.isChecked),
      }));
    } else if (missingChecklistRows.length > 0) {
      await db.creditDocumentChecklist.createMany({
        data: missingChecklistRows.map((documentType) => ({
          organizationId: currentUser.organizationId,
          creditApplicationId: id,
          documentType: documentType as DocumentType,
          isRequired: true,
        })),
        skipDuplicates: true,
      });
      checklistForGate = [
        ...checklistForGate,
        ...missingChecklistRows.map((documentType) => ({
          documentType,
          isRequired: true,
          isChecked: false,
        })),
      ];
    }

    // Tahap 9D: formulir analisis & survei terstandardisasi divalidasi saat
    // disimpan. Formulir lama yang belum lengkap tetap dapat dibaca, tetapi
    // tidak dapat disimpan ulang sebagian.
    if (analysisData !== undefined) {
      const analysisError = validateStandardAnalysis(analysisData);
      if (analysisError) {
        return NextResponse.json({ error: analysisError, code: "ANALYSIS_INCOMPLETE" }, { status: 400 });
      }
    }
    if (surveyData !== undefined) {
      const surveyError = validateStandardSurvey(surveyData);
      if (surveyError) {
        return NextResponse.json({ error: surveyError, code: "SURVEY_INCOMPLETE" }, { status: 400 });
      }
    }

    // Tahap 9E: risalah komite. Kuorum dihitung server dari peserta hadir.
    let normalizedCommittee: ReturnType<typeof normalizeCommitteeDecision>["value"] = null;
    if (committeeDecision !== undefined && committeeDecision !== null) {
      const parsed = normalizeCommitteeDecision(committeeDecision);
      if (parsed.error || !parsed.value) {
        return NextResponse.json(
          { error: parsed.error ?? "Risalah komite tidak valid.", code: "COMMITTEE_INVALID" },
          { status: 400 }
        );
      }
      if (status !== undefined && status !== parsed.value.decision) {
        return NextResponse.json(
          {
            error: "Keputusan pada risalah komite harus sama dengan status pengajuan yang disimpan.",
            code: "COMMITTEE_STATUS_MISMATCH",
          },
          { status: 400 }
        );
      }
      normalizedCommittee = parsed.value;
    }

    // Tahap 9F: syarat pencairan terstruktur.
    if (disbursementConditions !== undefined) {
      if (!Array.isArray(disbursementConditions)) {
        return NextResponse.json(
          { error: "Syarat pencairan harus berupa daftar.", code: "DISBURSEMENT_CONDITIONS_INVALID" },
          { status: 400 }
        );
      }
      for (const condition of disbursementConditions) {
        if (!condition || typeof condition !== "object" || !String(condition.description ?? "").trim()) {
          return NextResponse.json(
            { error: "Setiap syarat pencairan wajib memiliki uraian.", code: "DISBURSEMENT_CONDITIONS_INVALID" },
            { status: 400 }
          );
        }
      }
    }

    // Tahap 5B (P0.5): angka ekstraksi AI (baki debet, tunggakan,
    // kolektibilitas) wajib diverifikasi manual terhadap dokumen SLIK asli
    // sebelum dipakai dalam Analisis 5C.
    if (analysisData !== undefined) {
      const latestSlik = await db.slikAnalysisRecord.findFirst({
        where: { organizationId: currentUser.organizationId, customerId: existing.customerId },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      if (latestSlik) {
        const verified = await db.slikAnalysisVerification.findFirst({
          where: { slikAnalysisRecordId: latestSlik.id },
          select: { id: true },
        });
        if (!verified) {
          return NextResponse.json(
            {
              error:
                "Analisa SLIK terakhir belum diverifikasi manual. Verifikasi angka baki debet, tunggakan, dan kolektibilitas terhadap dokumen asli (panel Hasil Analisa SLIK) sebelum menyimpan Analisis 5C.",
              code: "SLIK_VERIFICATION_REQUIRED",
            },
            { status: 400 }
          );
        }
      }
    }

    const updateData: Prisma.CreditApplicationUncheckedUpdateInput = {};
    if (product !== undefined) updateData.product = product;
    if (requestedAmount !== undefined) updateData.requestedAmount = requestedAmount ? parseFloat(requestedAmount) : null;
    if (requestedTenorMonths !== undefined) updateData.requestedTenorMonths = requestedTenorMonths ? parseInt(requestedTenorMonths, 10) : null;
    if (purpose !== undefined) updateData.purpose = purpose;
    if (source !== undefined) updateData.source = source;
    if (branchId !== undefined) updateData.branchId = branchId || null;
    if (assignedMarketingOfficerId !== undefined) updateData.assignedMarketingOfficerId = assignedMarketingOfficerId || null;
    if (assignedAnalystId !== undefined) updateData.assignedAnalystId = assignedAnalystId || null;
    if (assignedSurveyOfficerId !== undefined) updateData.assignedSurveyOfficerId = assignedSurveyOfficerId || null;
    if (notes !== undefined) updateData.notes = notes;
    if (analysisData !== undefined) updateData.analysisData = analysisData;
    if (surveyData !== undefined) updateData.surveyData = surveyData;
    if (approvedAmount !== undefined) updateData.approvedAmount = approvedAmount ? parseFloat(approvedAmount) : null;
    if (approvedTenorMonths !== undefined) updateData.approvedTenorMonths = approvedTenorMonths ? parseInt(approvedTenorMonths, 10) : null;
    if (interestRate !== undefined) updateData.interestRate = interestRate ? parseFloat(interestRate) : null;
    if (decisionNotes !== undefined) updateData.decisionNotes = decisionNotes;
    if (conditions !== undefined) updateData.conditions = conditions;
    if (realizationDate !== undefined) updateData.realizationDate = realizationDate ? new Date(realizationDate) : null;
    if (realizationReference !== undefined) updateData.realizationReference = realizationReference;
    if (realizationAmount !== undefined) updateData.realizationAmount = realizationAmount ? parseFloat(realizationAmount) : null;

    const isStatusChanged =
      status && status !== existing.status && Object.values(CreditApplicationStatus).includes(status as CreditApplicationStatus);

    let approverRoleTitle = "Pejabat Pemutus";
    let slikOverrideNote = "";

    if (isStatusChanged) {
      const targetStatus = status as CreditApplicationStatus;

      // Tahap 9C: alasan pengembalian wajib, tervalidasi server.
      if (targetStatus === CreditApplicationStatus.RETURNED) {
        const returnError = validateReturnReason(returnReason);
        if (returnError) {
          return NextResponse.json(
            { error: returnError, code: "RETURN_REASON_REQUIRED" },
            { status: 400 }
          );
        }
      }

      // Tahap 9C: berkas wajib produk harus lengkap sebelum analisis/putusan.
      const checklistGateStatuses: CreditApplicationStatus[] = [
        CreditApplicationStatus.ANALYSIS,
        CreditApplicationStatus.SURVEY,
        CreditApplicationStatus.REVIEW,
        CreditApplicationStatus.DECISION,
        CreditApplicationStatus.APPROVED,
        CreditApplicationStatus.REJECTED,
      ];
      if (checklistGateStatuses.includes(targetStatus)) {
        const missing = missingRequiredDocuments(checklistForGate);
        if (missing.length > 0) {
          return NextResponse.json(
            {
              error: `Checklist berkas wajib belum lengkap: ${missing.join(", ")}.`,
              code: "DOCUMENT_CHECKLIST_INCOMPLETE",
            },
            { status: 400 }
          );
        }
      }

      // Tahap 9D: keputusan hanya boleh diambil setelah formulir analisis
      // (dan survei bila ada) terisi lengkap sesuai standar.
      const decisionGateStatuses: CreditApplicationStatus[] = [
        CreditApplicationStatus.DECISION,
        CreditApplicationStatus.APPROVED,
        CreditApplicationStatus.REJECTED,
      ];
      if (decisionGateStatuses.includes(targetStatus)) {
        const finalAnalysis = analysisData !== undefined ? analysisData : existing.analysisData;
        const analysisError = validateStandardAnalysis(finalAnalysis);
        if (analysisError) {
          return NextResponse.json({ error: analysisError, code: "ANALYSIS_INCOMPLETE" }, { status: 400 });
        }
        const finalSurvey = surveyData !== undefined ? surveyData : existing.surveyData;
        if (existing.assignedSurveyOfficerId || finalSurvey) {
          const surveyError = validateStandardSurvey(finalSurvey);
          if (surveyError) {
            return NextResponse.json({ error: surveyError, code: "SURVEY_INCOMPLETE" }, { status: 400 });
          }
        }
      }

      // Tahap 5B (P0.5): bila rekomendasi analisa AI terbaru = REJECT dan
      // pengajuan tetap DITERUSKAN, alasan penerusan boleh diisi Account
      // Officer, petugas survei lapangan, siapa pun yang berwenang
      // memverifikasi pengajuan, Super Admin, atau Direksi.
      if (isContinuationStatus(status)) {
        const latestSlik = await db.slikAnalysisRecord.findFirst({
          where: { organizationId: currentUser.organizationId, customerId: existing.customerId },
          orderBy: { createdAt: "desc" },
          select: { id: true, rekomendasi: true },
        });

        if (latestSlik && latestSlik.rekomendasi === "REJECT") {
          const coveringOverride = await db.creditSlikOverride.findFirst({
            where: { creditApplicationId: id, slikAnalysisRecordId: latestSlik.id },
            select: { id: true },
          });

          if (!coveringOverride) {
            const canVerify = await hasPermission(currentUser.email!, "credit.application.verify");
            const actorRole = resolveOverrideActor(currentUser, existing, { canVerify });
            if (!actorRole) {
              return NextResponse.json(
                {
                  error:
                    "Analisa SLIK terakhir merekomendasikan REJECT. Hanya Account Officer, petugas survei lapangan, verifikator, Super Admin, atau Direksi yang dapat mengisi alasan penerusan pengajuan.",
                  code: "SLIK_OVERRIDE_FORBIDDEN",
                },
                { status: 403 }
              );
            }
            if (!isValidOverrideReason(body.slikOverrideReason)) {
              return NextResponse.json(
                {
                  error: `Analisa SLIK terakhir merekomendasikan REJECT. Isi alasan penerusan pengajuan (minimal ${OVERRIDE_REASON_MIN_LENGTH} karakter) sebelum melanjutkan.`,
                  code: "SLIK_OVERRIDE_REQUIRED",
                },
                { status: 400 }
              );
            }

            const reason = body.slikOverrideReason.trim();
            await db.creditSlikOverride.create({
              data: {
                organizationId: currentUser.organizationId,
                creditApplicationId: id,
                slikAnalysisRecordId: latestSlik.id,
                rekomendasi: "REJECT",
                reason,
                recordedById: currentUser.id,
                recordedByName: currentUser.fullName,
                recordedByRole: actorRole,
              },
            });

            const { ipAddress, userAgent } = extractClientInfo(req);
            await logAudit({
              organizationId: currentUser.organizationId,
              userId: currentUser.id,
              action: "SLIK_OVERRIDE",
              entityType: "CREDIT_APPLICATION",
              entityId: id,
              newValues: { slikAnalysisRecordId: latestSlik.id, rekomendasi: "REJECT", reason, role: actorRole },
              notes: "Alasan penerusan pengajuan meski rekomendasi analisa SLIK AI = REJECT.",
              ipAddress,
              userAgent,
            });

            slikOverrideNote = `Diteruskan meski rekomendasi AI REJECT — alasan ${overrideRoleLabel(actorRole)} (${currentUser.fullName}): ${reason}`;
          }
        }
      }

      updateData.status = status as CreditApplicationStatus;

      if (status === "APPROVED" || status === "REJECTED" || status === "DECISION") {
        updateData.decisionDate = new Date();
        updateData.decisionMakerId = currentUser.id;
      }

      // Tahap 5B (P0.5): pejabat pemutus wajib mencatat keputusan akhir beserta
      // alasan/pertimbangannya — analisis AI hanya bahan, bukan keputusan final.
      if (DECISION_STATUSES.includes(status as CreditApplicationStatus)) {
        const decisionNotesText = typeof decisionNotes === "string" ? decisionNotes.trim() : "";
        if (decisionNotesText.length < DECISION_NOTES_MIN_LENGTH) {
          return NextResponse.json(
            {
              error: `Keputusan ${status} wajib mencantumkan alasan/pertimbangan pejabat pemutus (min. ${DECISION_NOTES_MIN_LENGTH} karakter) pada Catatan Keputusan.`,
              code: "DECISION_NOTES_REQUIRED",
            },
            { status: 400 }
          );
        }
      }

      // Pemisahan tugas (Maker-Checker): pemutus tidak boleh orang yang sama dengan
      // pengaju (marketing), analis, atau surveyor pada pengajuan ini.
      if (DECISION_STATUSES.includes(status as CreditApplicationStatus)) {
        const finalMarketing =
          assignedMarketingOfficerId !== undefined ? assignedMarketingOfficerId || null : existing.assignedMarketingOfficerId;
        const finalAnalyst =
          assignedAnalystId !== undefined ? assignedAnalystId || null : existing.assignedAnalystId;
        const finalSurvey =
          assignedSurveyOfficerId !== undefined ? assignedSurveyOfficerId || null : existing.assignedSurveyOfficerId;

        if (violatesSegregationOfDuties(currentUser.id, [finalMarketing, finalAnalyst, finalSurvey])) {
          return NextResponse.json(
            {
              error:
                "Pemisahan tugas: Anda terlibat sebagai pengaju/analis/surveyor pada pengajuan ini dan tidak dapat menjadi pemutusnya.",
              code: "SEGREGATION_OF_DUTIES",
            },
            { status: 403 }
          );
        }
      }

      if (status === "APPROVED") {
        const finalAmount = Number(
          updateData.approvedAmount ?? existing.approvedAmount ?? existing.requestedAmount ?? 0
        );
        const roleCodes = currentUser.userRoles.map((ur) => ur.role.code);
        const isSuperAdmin = roleCodes.includes("ADMIN") || roleCodes.includes("DIRECTOR");

        let hasAuthority = isSuperAdmin;
        approverRoleTitle = isSuperAdmin
          ? "Direksi / Administrator"
          : currentUser.userRoles[0]?.role.name || "Komite Kredit";

        if (!hasAuthority) {
          const userLimits = await db.creditApprovalLimit.findMany({
            where: {
              organizationId: currentUser.organizationId,
              roleId: { in: currentUser.userRoles.map((ur) => ur.roleId) },
              isActive: true,
              // Tahap 9B: limit cabang hanya berlaku untuk pengajuan cabang itu;
              // limit tanpa cabang = organisasi (fallback).
              OR: [{ branchId: null }, ...(existing.branchId ? [{ branchId: existing.branchId }] : [])],
            },
          });

          // Limit khusus cabang menggantikan limit organisasi untuk cabang itu.
          const effectiveLimits = effectiveLimitsForBranch(userLimits, existing.branchId);
          const maxAllowed = Math.max(...effectiveLimits.map((l) => Number(l.maxAmount)), 0);
          if (finalAmount <= maxAllowed) {
            hasAuthority = true;
            const matchingLimit = effectiveLimits.find(
              (l) => finalAmount >= Number(l.minAmount) && finalAmount <= Number(l.maxAmount)
            );
            if (matchingLimit) approverRoleTitle = matchingLimit.levelName;
          }
        }

        if (!hasAuthority) {
          const requiredLimits = await db.creditApprovalLimit.findMany({
            where: {
              organizationId: currentUser.organizationId,
              minAmount: { lte: finalAmount },
              maxAmount: { gte: finalAmount },
              isActive: true,
              OR: [{ branchId: null }, ...(existing.branchId ? [{ branchId: existing.branchId }] : [])],
            },
            orderBy: { tierOrder: "asc" },
          });
          const requiredLimit =
            requiredLimits.find((limit) => existing.branchId && limit.branchId === existing.branchId) ??
            requiredLimits.find((limit) => !limit.branchId);

          const requiredName = requiredLimit?.levelName || "Tingkat Direksi / Komite Pusat";
          return NextResponse.json(
            {
              error: `Kewenangan approval tidak mencukupi: Plafon Rp ${finalAmount.toLocaleString("id-ID")} memerlukan persetujuan dari ${requiredName}.`,
            },
            { status: 403 }
          );
        }
      }
    }

    // Tahap 9F: pencairan hanya boleh dicatat bila referensi CBS diisi dan
    // seluruh syarat terstruktur sudah dipenuhi.
    if (realizationDate !== undefined && realizationDate) {
      const finalReference =
        realizationReference !== undefined ? realizationReference : existing.realizationReference;
      if (!finalReference || !String(finalReference).trim()) {
        return NextResponse.json(
          { error: "Referensi transaksi CBS wajib diisi sebelum pencairan dicatat.", code: "CBS_REFERENCE_REQUIRED" },
          { status: 400 }
        );
      }
      const conditionsForGate =
        disbursementConditions !== undefined
          ? disbursementConditions.map((item: { description: string; isSatisfied?: boolean }) => ({
              description: String(item.description).trim(),
              isSatisfied: Boolean(item.isSatisfied),
            }))
          : (
              await db.creditDisbursementCondition.findMany({
                where: { organizationId: currentUser.organizationId, creditApplicationId: id },
                select: { description: true, isSatisfied: true },
              })
            );
      const readyError = validateDisbursementReady(conditionsForGate);
      if (readyError) {
        return NextResponse.json({ error: readyError, code: "DISBURSEMENT_CONDITIONS_PENDING" }, { status: 400 });
      }
    }

    const updated = await db.creditApplication.update({
      where: { id },
      data: {
        ...updateData,
        ...(isStatusChanged
          ? {
              statusHistories: {
                create: {
                  status: status as CreditApplicationStatus,
                  changedById: currentUser.id,
                  notes: [
                    statusChangeNote || `Perubahan status menjadi ${status}.`,
                    status === CreditApplicationStatus.RETURNED && returnReason
                      ? `Alasan pengembalian: ${String(returnReason).trim()}`
                      : "",
                    slikOverrideNote,
                  ]
                    .filter(Boolean)
                    .join(" | "),
                },
              },
            }
          : {}),
        ...(isStatusChanged && (status === "APPROVED" || status === "REJECTED" || status === "RETURNED")
          ? {
              approvalRecords: {
                create: {
                  approverId: currentUser.id,
                  approverRoleName: approverRoleTitle,
                  status: status as CreditApplicationStatus,
                  approvedAmount: (updateData.approvedAmount as number | null) ?? existing.approvedAmount ?? existing.requestedAmount ?? null,
                  notes: decisionNotes || statusChangeNote || `Putusan ${status} oleh ${approverRoleTitle}.`,
                },
              },
            }
          : {}),
        ...(normalizedCommittee
          ? {
              committeeDecisions: {
                create: {
                  organizationId: currentUser.organizationId,
                  scheduledAt: normalizedCommittee.scheduledAt,
                  decidedAt: normalizedCommittee.decidedAt,
                  quorumRequired: normalizedCommittee.quorumRequired,
                  participants: normalizedCommittee.participants,
                  decision: normalizedCommittee.decision as CreditApplicationStatus,
                  notes: normalizedCommittee.notes,
                  conditions: normalizedCommittee.conditions,
                  createdById: currentUser.id,
                  createdByName: currentUser.fullName,
                },
              },
            }
          : {}),
      },
      include: {
        customer: { select: { id: true, customerNumber: true, legalName: true, customerType: true, identityNumber: true, phone: true, email: true } },
        branch: { select: { id: true, name: true, code: true } },
        marketingOfficer: { select: { id: true, fullName: true, email: true } },
        analyst: { select: { id: true, fullName: true, email: true } },
        surveyOfficer: { select: { id: true, fullName: true, email: true } },
        decisionMaker: { select: { id: true, fullName: true, email: true } },
        statusHistories: {
          include: { changedBy: { select: { id: true, fullName: true, email: true } } },
          orderBy: { createdAt: "desc" },
        },
        approvalRecords: {
          include: { approver: { select: { id: true, fullName: true, email: true } } },
          orderBy: { createdAt: "desc" },
        },
        documentChecklist: { orderBy: { documentType: "asc" } },
        committeeDecisions: { orderBy: { decidedAt: "desc" } },
        disbursementConditions: { orderBy: { sortOrder: "asc" } },
      },
    });

    // Tahap 9F: simpan syarat pencairan (upsert per id; item yang tidak dikirim
    // tidak dihapus agar riwayat pemenuhan syarat tidak hilang).
    if (disbursementConditions !== undefined) {
      for (const [index, condition] of (disbursementConditions as Array<{
        id?: string;
        description: string;
        isSatisfied?: boolean;
        note?: string | null;
      }>).entries()) {
        const description = String(condition.description).trim();
        const isSatisfied = Boolean(condition.isSatisfied);
        const existingCondition = condition.id
          ? await db.creditDisbursementCondition.findFirst({
              where: { id: condition.id, organizationId: currentUser.organizationId, creditApplicationId: id },
              select: { id: true },
            })
          : null;
        if (existingCondition) {
          await db.creditDisbursementCondition.update({
            where: { id: existingCondition.id },
            data: {
              description,
              isSatisfied,
              note: condition.note ?? null,
              sortOrder: index,
              satisfiedById: isSatisfied ? currentUser.id : null,
              satisfiedByName: isSatisfied ? currentUser.fullName : null,
              satisfiedAt: isSatisfied ? new Date() : null,
            },
          });
        } else {
          await db.creditDisbursementCondition.create({
            data: {
              organizationId: currentUser.organizationId,
              creditApplicationId: id,
              description,
              isSatisfied,
              note: condition.note ?? null,
              sortOrder: index,
              satisfiedById: isSatisfied ? currentUser.id : null,
              satisfiedByName: isSatisfied ? currentUser.fullName : null,
              satisfiedAt: isSatisfied ? new Date() : null,
            },
          });
        }
      }
    }

    // Tahap 9F: audit trail perubahan pasca-submit (nilai lama/baru per field).
    const changedFields = Object.keys(updateData);
    if (isStatusChanged) changedFields.push("status");
    if (normalizedCommittee) changedFields.push("committeeDecision");
    if (disbursementConditions !== undefined) changedFields.push("disbursementConditions");
    if (documentChecklist !== undefined) changedFields.push("documentChecklist");
    if (changedFields.length > 0) {
      await logAudit({
        organizationId: currentUser.organizationId,
        userId: currentUser.id,
        // Tahap 7 (P1.6): approval/rejection memakai aksi audit khusus, bukan UPDATE biasa.
        action: !isStatusChanged
          ? "UPDATE"
          : status === "APPROVED"
          ? "APPROVE"
          : status === "REJECTED"
          ? "REJECT"
          : "STATUS_CHANGE",
        entityType: "CREDIT_APPLICATION",
        entityId: id,
        ...extractClientInfo(req),
        oldValues: {
          status: existing.status,
          ...Object.fromEntries(changedFields.filter((field) => field in existing).map((field) => [field, (existing as Record<string, unknown>)[field]])),
        },
        newValues: {
          fields: changedFields,
          ...(isStatusChanged ? { status } : {}),
          ...(returnReason ? { returnReason: String(returnReason).trim() } : {}),
        },
        notes: isStatusChanged
          ? `Perubahan status pengajuan menjadi ${status}.`
          : "Koreksi/perubahan pengajuan kredit setelah diajukan.",
      });
    }

    // Ambil ulang agar checklist/syarat yang baru ditulis ikut terkirim ke UI.
    const refreshed = await db.creditApplication.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, customerNumber: true, legalName: true, customerType: true, identityNumber: true, phone: true, email: true } },
        branch: { select: { id: true, name: true, code: true } },
        marketingOfficer: { select: { id: true, fullName: true, email: true } },
        analyst: { select: { id: true, fullName: true, email: true } },
        surveyOfficer: { select: { id: true, fullName: true, email: true } },
        decisionMaker: { select: { id: true, fullName: true, email: true } },
        statusHistories: {
          include: { changedBy: { select: { id: true, fullName: true, email: true } } },
          orderBy: { createdAt: "desc" },
        },
        approvalRecords: {
          include: { approver: { select: { id: true, fullName: true, email: true } } },
          orderBy: { createdAt: "desc" },
        },
        documentChecklist: { orderBy: { documentType: "asc" } },
        committeeDecisions: { orderBy: { decidedAt: "desc" } },
        disbursementConditions: { orderBy: { sortOrder: "asc" } },
      },
    });

    return NextResponse.json({ success: true, data: refreshed ?? updated });
  } catch (error) {
    console.error("Error updating credit application:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authCheck = await requireAuthAndPermission("credit.application.delete");
    if (!authCheck.authorized) {
      return authCheck.response;
    }
    const scopeUser = toScopeUser(authCheck.user!);

    const { id } = await params;
    const existing = await db.creditApplication.findFirst({
      where: {
        id,
        ...(buildScopeFilter(scopeUser, { assignmentFields: CREDIT_ASSIGNMENT_FIELDS }) as Prisma.CreditApplicationWhereInput),
      },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    await db.creditApplication.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "Application deleted successfully" });
  } catch (error) {
    console.error("Error deleting credit application:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
