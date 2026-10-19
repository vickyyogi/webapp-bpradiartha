import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { Prisma, CreditApplicationStatus } from "@prisma/client";
import { hasPermission, requireAnyPermission, requireAuthAndPermission } from "@/lib/permissions";
import { buildScopeFilter, isBranchAllowed, toScopeUser, violatesSegregationOfDuties } from "@/lib/access-scope";
import { extractClientInfo, logAudit } from "@/lib/audit";
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
            },
          });

          const maxAllowed = Math.max(...userLimits.map((l) => Number(l.maxAmount)), 0);
          if (finalAmount <= maxAllowed) {
            hasAuthority = true;
            const matchingLimit = userLimits.find(
              (l) => finalAmount >= Number(l.minAmount) && finalAmount <= Number(l.maxAmount)
            );
            if (matchingLimit) approverRoleTitle = matchingLimit.levelName;
          }
        }

        if (!hasAuthority) {
          const requiredLimit = await db.creditApprovalLimit.findFirst({
            where: {
              organizationId: currentUser.organizationId,
              minAmount: { lte: finalAmount },
              maxAmount: { gte: finalAmount },
              isActive: true,
            },
          });

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
                  notes: [statusChangeNote || `Perubahan status menjadi ${status}.`, slikOverrideNote]
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
      },
    });

    return NextResponse.json({ success: true, data: updated });
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
