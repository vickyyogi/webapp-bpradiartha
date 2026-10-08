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

    const authCheck = await requireAuthAndPermission("field.performance.view");
    if (!authCheck.authorized) {
      return authCheck.response;
    }

    const currentUser = await db.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get all officers in the organization
    const officers = await db.user.findMany({
      where: {
        organizationId: currentUser.organizationId,
        isActive: true,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        branch: { select: { id: true, name: true, code: true } },
      },
      orderBy: { fullName: "asc" },
    });

    const now = new Date();

    // Calculate factual metrics for each officer
    const performanceData = await Promise.all(
      officers.map(async (officer) => {
        const [
          leadCount,
          appCount,
          surveyTaskCount,
          completedSurveyCount,
          approvedAppCount,
          realizedApplications,
          completedTasks,
          pendingTasks,
          overdueTasks,
        ] = await Promise.all([
          // Leads assigned to officer
          db.lead.count({ where: { assignedOfficerId: officer.id } }),
          // Applications where officer is marketing officer
          db.creditApplication.count({ where: { assignedMarketingOfficerId: officer.id } }),
          // Survey tasks assigned
          db.fieldTask.count({ where: { assignedOfficerId: officer.id, taskType: "SURVEY" } }),
          // Surveys completed
          db.fieldTask.count({ where: { assignedOfficerId: officer.id, taskType: "SURVEY", status: "COMPLETED" } }),
          // Approved applications
          db.creditApplication.count({
            where: { assignedMarketingOfficerId: officer.id, status: "APPROVED" },
          }),
          // Realized applications & amounts
          db.creditApplication.findMany({
            where: {
              assignedMarketingOfficerId: officer.id,
              realizationDate: { not: null },
            },
            select: { realizationAmount: true, approvedAmount: true, requestedAmount: true },
          }),
          // Completed tasks
          db.fieldTask.count({ where: { assignedOfficerId: officer.id, status: "COMPLETED" } }),
          // Pending tasks
          db.fieldTask.count({
            where: { assignedOfficerId: officer.id, status: { in: ["PENDING", "IN_PROGRESS"] } },
          }),
          // Overdue tasks
          db.fieldTask.count({
            where: {
              assignedOfficerId: officer.id,
              status: { in: ["PENDING", "IN_PROGRESS"] },
              dueDate: { lt: now },
            },
          }),
        ]);

        const realizedAmount = realizedApplications.reduce(
          (sum, a) => sum + (a.realizationAmount || a.approvedAmount || a.requestedAmount || 0),
          0
        );

        return {
          officerId: officer.id,
          officerName: officer.fullName,
          officerEmail: officer.email,
          branchName: officer.branch?.name || "-",
          leadCount,
          appCount,
          surveyTaskCount,
          completedSurveyCount,
          approvedAppCount,
          realizedCount: realizedApplications.length,
          realizedAmount,
          completedTasks,
          pendingTasks,
          overdueTasks,
          completionRate:
            completedTasks + pendingTasks > 0
              ? Math.round((completedTasks / (completedTasks + pendingTasks)) * 100)
              : 0,
        };
      })
    );

    return NextResponse.json({ success: true, data: performanceData });
  } catch (error) {
    console.error("Error calculating field officer performance:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
