import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { requireAuthAndPermission } from "@/lib/permissions";

export async function GET (_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requireAuthAndPermission("admin.settings.view");
    if (!authCheck.authorized) {
      return authCheck.response;
    }

    const currentUser = await db.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const limits = await db.creditApprovalLimit.findMany({
      where: {
        organizationId: currentUser.organizationId,
        isActive: true,
      },
      include: {
        role: { select: { id: true, name: true, code: true } },
      },
      orderBy: { tierOrder: "asc" },
    });

    return NextResponse.json({ success: true, data: limits });
  } catch (error) {
    console.error("Error fetching approval limits:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
