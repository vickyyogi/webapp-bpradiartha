import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { requireAuthAndPermission } from "@/lib/permissions";
import { PurchaseRequestStatus } from "@prisma/client";

export async function GET (req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requireAuthAndPermission("purchase.request.view");
    if (!authCheck.authorized) {
      return authCheck.response;
    }

    const currentUser = await db.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");
    const status = searchParams.get("status");

    const whereClause = {
      organizationId: currentUser.organizationId,
    };

    if (status && Object.values(PurchaseRequestStatus).includes(status as PurchaseRequestStatus)) {
      whereClause.status = status as PurchaseRequestStatus;
    }

    if (search) {
      whereClause.OR = [
        { requestNumber: { contains: search, mode: "insensitive" } },
        { title: { contains: search, mode: "insensitive" } },
        { purpose: { contains: search, mode: "insensitive" } },
        { requester: { fullName: { contains: search, mode: "insensitive" } } },
      ];
    }

    const requests = await db.purchaseRequest.findMany({
      where: whereClause,
      include: {
        requester: { select: { id: true, fullName: true, email: true } },
        department: { select: { id: true, name: true, code: true } },
        branch: { select: { id: true, name: true, code: true } },
        _count: {
          select: {
            items: true,
            purchaseOrders: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const allRequests = await db.purchaseRequest.findMany({
      where: { organizationId: currentUser.organizationId },
      select: { status: true, totalEstimatedAmount: true },
    });

    const summary = {
      total: allRequests.length,
      submitted: allRequests.filter((r) => r.status === "SUBMITTED").length,
      approved: allRequests.filter((r) => r.status === "APPROVED").length,
      rejected: allRequests.filter((r) => r.status === "REJECTED").length,
      totalAmount: allRequests.reduce((acc, curr) => acc + (curr.totalEstimatedAmount || 0), 0),
    };

    return NextResponse.json({ requests, summary });
  } catch (error) {
    console.error("GET /api/purchasing/requests error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST (req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requireAuthAndPermission("purchase.request.create");
    if (!authCheck.authorized) {
      return authCheck.response;
    }

    const currentUser = await db.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json();
    const { title, purpose, requiredDate, departmentId, notes, items = [] } = body;

    if (!title || !purpose || items.length === 0) {
      return NextResponse.json(
        { error: "Judul pengadaan, alasan/urgensi, dan minimal 1 item barang wajib diisi." },
        { status: 400 }
      );
    }

    // Generate requestNumber
    const year = new Date().getFullYear();
    const count = await db.purchaseRequest.count({
      where: { organizationId: currentUser.organizationId },
    });
    const requestNumber = `PR-${year}-${String(count + 1).padStart(4, "0")}`;

    const totalEstimatedAmount = items.reduce(
      (sum: number, it) => sum + (Number(it.quantity) || 1) * (Number(it.estimatedPrice) || 0),
      0
    );

    const result = await db.$transaction(async (tx) => {
      // Find purchasing workflow if configured
      const workflow = await tx.workflow.findFirst({
        where: {
          organizationId: currentUser.organizationId,
          module: "PURCHASING",
          isActive: true,
        },
      });

      const newPR = await tx.purchaseRequest.create({
        data: {
          organizationId: currentUser.organizationId,
          branchId: currentUser.branchId,
          departmentId: departmentId || currentUser.departmentId,
          requestNumber,
          requesterId: currentUser.id,
          title,
          purpose,
          requiredDate: requiredDate ? new Date(requiredDate) : null,
          status: "SUBMITTED",
          totalEstimatedAmount,
          notes,
          items: {
            create: items.map((it) => ({
              itemName: it.itemName,
              category: it.category || null,
              unit: it.unit || "Pcs",
              quantity: Number(it.quantity) || 1,
              estimatedPrice: Number(it.estimatedPrice) || 0,
              totalPrice: (Number(it.quantity) || 1) * (Number(it.estimatedPrice) || 0),
              itemType: it.itemType || "INVENTORY",
              inventoryItemId: it.inventoryItemId || null,
              notes: it.notes || null,
            })),
          },
        },
      });

      // Create workflow instance
      await tx.workflowInstance.create({
        data: {
          workflowId: workflow ? workflow.id : null,
          entityType: "PURCHASE_REQUEST",
          entityId: newPR.requestNumber,
          currentStep: 1,
          status: "PENDING",
          purchaseRequestId: newPR.id,
          actions: {
            create: {
              stepNumber: 1,
              actorId: currentUser.id,
              action: "SUBMIT",
              comment: `Pengajuan pengadaan diajukan oleh ${currentUser.fullName}`,
            },
          },
        },
      });

      return newPR;
    });

    return NextResponse.json({
      message: `Purchase Request ${result.requestNumber} berhasil diajukan untuk proses approval.`,
      purchaseRequest: result,
    });
  } catch (error) {
    console.error("POST /api/purchasing/requests error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
