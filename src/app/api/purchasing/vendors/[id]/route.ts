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

    const authCheck = await requireAnyPermission(["vendor.view"]);
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

    const vendor = await db.vendor.findFirst({
      where: {
        id,
        organizationId: currentUser.organizationId,
      },
      include: {
        purchaseOrders: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!vendor) {
      return NextResponse.json({ error: "Vendor tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json({ vendor });
  } catch (error) {
    console.error("GET /api/purchasing/vendors/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
