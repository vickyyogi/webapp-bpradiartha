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
    const authCheck = await requireAnyPermission(["purchase.request.view"]);
    if (!authCheck.authorized) {
      return authCheck.response;
    }
    const currentUser = authCheck.user!;

    const { id } = await params;

    const request = await db.purchaseRequest.findFirst({
      where: {
        id,
        ...(buildScopeFilter(toScopeUser(currentUser), { assignmentFields: ["requesterId"] }) as Prisma.PurchaseRequestWhereInput),
      },
      include: {
        requester: { select: { id: true, fullName: true, email: true, employeeNumber: true } },
        department: { select: { id: true, name: true, code: true } },
        branch: { select: { id: true, name: true, code: true } },
        items: true,
        purchaseOrders: {
          include: {
            vendor: { select: { id: true, name: true, phone: true } },
          },
        },
        workflowInstances: {
          include: {
            workflow: {
              include: {
                steps: { orderBy: { stepOrder: "asc" } },
              },
            },
            actions: {
              include: {
                actor: { select: { id: true, fullName: true, email: true } },
              },
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
    });

    if (!request) {
      return NextResponse.json({ error: "Pengajuan pengadaan (PR) tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json({ request });
  } catch (error) {
    console.error("GET /api/purchasing/requests/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
