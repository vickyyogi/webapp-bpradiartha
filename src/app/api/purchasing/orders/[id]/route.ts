import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAnyPermission } from "@/lib/permissions";
import { buildScopeFilter, toScopeUser } from "@/lib/access-scope";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authCheck = await requireAnyPermission(["purchase.order.view"]);
    if (!authCheck.authorized) {
      return authCheck.response;
    }
    const currentUser = authCheck.user!;

    const { id } = await params;

    const order = await db.purchaseOrder.findFirst({
      where: {
        id,
        ...(buildScopeFilter(toScopeUser(currentUser), { assignmentFields: ["createdById"] }) as Prisma.PurchaseOrderWhereInput),
      },
      include: {
        vendor: true,
        purchaseRequest: {
          select: {
            id: true,
            requestNumber: true,
            title: true,
            requester: { select: { fullName: true } },
          },
        },
        createdBy: { select: { id: true, fullName: true, email: true } },
        items: true,
        goodsReceipts: {
          include: {
            receivedBy: { select: { id: true, fullName: true } },
            items: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Purchase Order tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json({ order });
  } catch (error) {
    console.error("GET /api/purchasing/orders/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
