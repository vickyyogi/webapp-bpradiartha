import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuthAndPermission } from "@/lib/permissions";
import { resolveScopeLevel, toScopeUser } from "@/lib/access-scope";

export async function GET (req: NextRequest) {
  try {
    const authCheck = await requireAuthAndPermission("audit.log.view");
    if (!authCheck.authorized) {
      return authCheck.response;
    }
    const currentUser = authCheck.user!;

    // Jejak audit bersifat lintas cabang: hanya peran bercakupan ORGANIZATION
    // (mis. Admin Operasional, Manajemen, Auditor) yang boleh membacanya.
    if (resolveScopeLevel(toScopeUser(currentUser)) !== "ORGANIZATION") {
      return NextResponse.json(
        { error: "Akses jejak audit memerlukan cakupan organisasi (lintas cabang).", code: "SCOPE_FORBIDDEN" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");
    const entityType = searchParams.get("entityType");
    const userId = searchParams.get("userId");
    const search = searchParams.get("search");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const limit = Math.min(200, Number(searchParams.get("limit")) || 50);

    const whereClause: Prisma.AuditLogWhereInput = {
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
