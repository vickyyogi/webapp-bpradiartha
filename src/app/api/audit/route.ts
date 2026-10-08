import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { requireAuthAndPermission } from "@/lib/permissions";

export async function GET (req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requireAuthAndPermission("audit.log.view");
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
    const action = searchParams.get("action");
    const entityType = searchParams.get("entityType");
    const userId = searchParams.get("userId");
    const search = searchParams.get("search");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const limit = Math.min(200, Number(searchParams.get("limit")) || 50);

    const whereClause = {
      organizationId: currentUser.organizationId,
    };

    if (action && action !== "ALL") {
      whereClause.action = action;
    }

    if (entityType && entityType !== "ALL") {
      whereClause.entityType = entityType;
    }

    if (userId) {
      whereClause.userId = userId;
    }

    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        whereClause.createdAt.lte = end;
      }
    }

    if (search) {
      whereClause.OR = [
        { entityId: { contains: search, mode: "insensitive" } },
        { notes: { contains: search, mode: "insensitive" } },
        { ipAddress: { contains: search, mode: "insensitive" } },
        { user: { fullName: { contains: search, mode: "insensitive" } } },
      ];
    }

    const logs = await db.auditLog.findMany({
      where: whereClause,
      include: {
        user: { select: { id: true, fullName: true, email: true, employeeNumber: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    // Summary counts for filter tabs
    const totalCount = await db.auditLog.count({
      where: { organizationId: currentUser.organizationId },
    });

    return NextResponse.json({
      logs,
      totalCount,
      count: logs.length,
    });
  } catch (error) {
    console.error("GET /api/audit error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
