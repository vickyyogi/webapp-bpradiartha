import { NextRequest, NextResponse } from "next/server";
import { Prisma, PurchaseRequestStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAnyPermission } from "@/lib/permissions";
import { buildScopeFilter, toScopeUser, violatesSegregationOfDuties } from "@/lib/access-scope";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await req.json();
    const actionAuth = String(body.action || "").toUpperCase();
    const wfPermAuth = actionAuth === "APPROVE" ? "purchase.request.approve" : actionAuth === "REJECT" ? "purchase.request.reject" : null;
    if (!wfPermAuth) {
      return NextResponse.json({ error: "Action workflow tidak dikenal." }, { status: 400 });
    }
    const authCheck = await requireAnyPermission([wfPermAuth]);
    if (!authCheck.authorized) {
      return authCheck.response;
    }

    const { id } = await params;
    const currentUser = authCheck.user!;

    const { action, comment } = body; // action: "APPROVE" | "REJECT" | "RETURN"

    if (!action || !["APPROVE", "REJECT", "RETURN"].includes(action)) {
      return NextResponse.json({ error: "Aksi approval tidak valid." }, { status: 400 });
    }

    const pr = await db.purchaseRequest.findFirst({
      where: {
        id,
        ...(buildScopeFilter(toScopeUser(currentUser), { assignmentFields: ["requesterId"] }) as Prisma.PurchaseRequestWhereInput),
      },
      include: {
        workflowInstances: {
          include: {
            workflow: {
              include: { steps: { orderBy: { stepOrder: "asc" } } },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!pr) {
      return NextResponse.json({ error: "Purchase Request tidak ditemukan." }, { status: 404 });
    }

    if (pr.status === "APPROVED" || pr.status === "REJECTED") {
      return NextResponse.json(
        { error: `Purchase Request sudah berstatus ${pr.status} dan tidak dapat diubah.` },
        { status: 400 }
      );
    }

    // Pemisahan tugas (Maker-Checker) pengadaan: pengaju tidak boleh menyetujui pengajuannya sendiri.
    if (action === "APPROVE" && violatesSegregationOfDuties(currentUser.id, [pr.requesterId])) {
      return NextResponse.json(
        {
          error: "Pemisahan tugas: Anda adalah pengaju pengadaan ini dan tidak dapat menyetujuinya sendiri.",
          code: "SEGREGATION_OF_DUTIES",
        },
        { status: 403 }
      );
    }

    const activeInstance = pr.workflowInstances[0];
    const totalSteps = activeInstance?.workflow?.steps?.length || 1;
    const currentStepNum = activeInstance?.currentStep || 1;

    let nextPrStatus: PurchaseRequestStatus = pr.status;
    let nextInstanceStatus = "PENDING";
    let nextStepNum = currentStepNum;

    if (action === "APPROVE") {
      if (currentStepNum >= totalSteps) {
        nextPrStatus = "APPROVED";
        nextInstanceStatus = "APPROVED";
      } else {
        nextStepNum = currentStepNum + 1;
        nextInstanceStatus = "PENDING";
      }
    } else if (action === "REJECT") {
      nextPrStatus = "REJECTED";
      nextInstanceStatus = "REJECTED";
    } else if (action === "RETURN") {
      nextPrStatus = "DRAFT";
      nextInstanceStatus = "RETURNED";
    }

    const result = await db.$transaction(async (tx) => {
      // Record action
      if (activeInstance) {
        await tx.workflowAction.create({
          data: {
            instanceId: activeInstance.id,
            stepNumber: currentStepNum,
            actorId: currentUser.id,
            action,
            comment: comment || null,
          },
        });

        await tx.workflowInstance.update({
          where: { id: activeInstance.id },
          data: {
            currentStep: nextStepNum,
            status: nextInstanceStatus,
          },
        });
      }

      const updatedPR = await tx.purchaseRequest.update({
        where: { id: pr.id },
        data: { status: nextPrStatus },
      });

      return updatedPR;
    });

    return NextResponse.json({
      message: `Aksi ${action} pada pengadaan ${pr.requestNumber} berhasil diproses. Status: ${nextPrStatus}.`,
      purchaseRequest: result,
    });
  } catch (error) {
    console.error("POST /api/purchasing/requests/[id]/workflow error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
