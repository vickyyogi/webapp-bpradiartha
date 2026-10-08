import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { requireAnyPermission } from "@/lib/permissions";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requireAnyPermission(["purchase.request.view"]);
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

    const request = await db.purchaseRequest.findFirst({
      where: {
        id,
        organizationId: currentUser.organizationId,
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
