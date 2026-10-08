import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { requireAnyPermission } from "@/lib/permissions";
import { PurchaseRequestStatus } from "@prisma/client";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
    const currentUser = await db.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { action, comment } = body; // action: "APPROVE" | "REJECT" | "RETURN"

    if (!action || !["APPROVE", "REJECT", "RETURN"].includes(action)) {
      return NextResponse.json({ error: "Aksi approval tidak valid." }, { status: 400 });
    }

    const pr = await db.purchaseRequest.findFirst({
      where: {
        id,
        organizationId: currentUser.organizationId,
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
