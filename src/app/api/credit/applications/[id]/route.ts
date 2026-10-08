import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { requireAuthAndPermission } from "@/lib/permissions";
import { CreditApplicationStatus } from "@prisma/client";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requireAuthAndPermission("credit.application.view");
    if (!authCheck.authorized) {
      return authCheck.response;
    }

    const { id } = await params;
    const application = await db.creditApplication.findUnique({
      where: { id },
      include: {
        applicant: { select: { id: true, fullName: true, email: true, phone: true } },
        branch: { select: { id: true, name: true, code: true } },
        marketingOfficer: { select: { id: true, fullName: true, email: true } },
        analyst: { select: { id: true, fullName: true, email: true } },
        surveyOfficer: { select: { id: true, fullName: true, email: true } },
        decisionMaker: { select: { id: true, fullName: true, email: true } },
        statusHistories: {
          include: {
            changedBy: { select: { id: true, fullName: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        approvalRecords: {
          include: {
            approver: { select: { id: true, fullName: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!application) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: application });
  } catch (error) {
    console.error("Error fetching credit application detail:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requireAuthAndPermission("credit.application.update");
    if (!authCheck.authorized) {
      return authCheck.response;
    }

    const currentUser = await db.user.findUnique({
      where: { email: session.user.email },
      include: {
        userRoles: {
          include: { role: true },
        },
      },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id } = await params;
    const existing = await db.creditApplication.findUnique({
      where: { id },
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
      assignedMarketingOfficerId,
      assignedAnalystId,
      assignedSurveyOfficerId,
      notes,
      // 5C & Survey
      analysisData,
      surveyData,
      // Decision
      approvedAmount,
      approvedTenorMonths,
      interestRate,
      decisionNotes,
      conditions,
      // Realization
      realizationDate,
      realizationReference,
      realizationAmount,
      statusChangeNote,
    } = body;

    const updateData = {};
    if (product !== undefined) updateData.product = product;
    if (requestedAmount !== undefined) updateData.requestedAmount = requestedAmount ? parseFloat(requestedAmount) : null;
    if (requestedTenorMonths !== undefined) updateData.requestedTenorMonths = requestedTenorMonths ? parseInt(requestedTenorMonths, 10) : null;
    if (purpose !== undefined) updateData.purpose = purpose;
    if (source !== undefined) updateData.source = source;
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

    const isStatusChanged = status && status !== existing.status && Object.values(CreditApplicationStatus).includes(status as CreditApplicationStatus);

    let approverRoleTitle = "Pejabat Pemutus";

    if (isStatusChanged) {
      updateData.status = status as CreditApplicationStatus;

      if (status === "APPROVED" || status === "REJECTED" || status === "DECISION") {
        updateData.decisionDate = new Date();
        updateData.decisionMakerId = currentUser.id;
      }

      // Check level & authority when approving
      if (status === "APPROVED") {
        const finalAmount = updateData.approvedAmount ?? existing.approvedAmount ?? existing.requestedAmount ?? 0;
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

          const maxAllowed = Math.max(...userLimits.map((l) => l.maxAmount), 0);
          if (finalAmount <= maxAllowed) {
            hasAuthority = true;
            const matchingLimit = userLimits.find((l) => finalAmount >= l.minAmount && finalAmount <= l.maxAmount);
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
                  notes: statusChangeNote || `Perubahan status menjadi ${status}.`,
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
                  approvedAmount: updateData.approvedAmount ?? existing.approvedAmount ?? existing.requestedAmount ?? null,
                  notes: decisionNotes || statusChangeNote || `Putusan ${status} oleh ${approverRoleTitle}.`,
                },
              },
            }
          : {}),
      },
      include: {
        applicant: { select: { id: true, fullName: true, email: true, phone: true } },
        branch: { select: { id: true, name: true, code: true } },
        marketingOfficer: { select: { id: true, fullName: true, email: true } },
        analyst: { select: { id: true, fullName: true, email: true } },
        surveyOfficer: { select: { id: true, fullName: true, email: true } },
        decisionMaker: { select: { id: true, fullName: true, email: true } },
        statusHistories: {
          include: {
            changedBy: { select: { id: true, fullName: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        approvalRecords: {
          include: {
            approver: { select: { id: true, fullName: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Error updating credit application:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requireAuthAndPermission("credit.application.delete");
    if (!authCheck.authorized) {
      return authCheck.response;
    }

    const { id } = await params;
    await db.creditApplication.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Application deleted successfully" });
  } catch (error) {
    console.error("Error deleting credit application:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
