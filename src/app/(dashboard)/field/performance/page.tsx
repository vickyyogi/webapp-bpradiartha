import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { FieldPerformanceClientView } from "./FieldPerformanceClientView";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Performa Petugas Lapangan",
};

export const dynamic = "force-dynamic";

export default async function FieldPerformancePage() {
  const session = await getServerSession(authOptions);
  const currentUser = await db.user.findUnique({
    where: { email: session?.user?.email || "" },
  });

  const officers = await db.user.findMany({
    where: {
      ...(currentUser?.organizationId ? { organizationId: currentUser.organizationId } : {}),
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
        db.lead.count({ where: { assignedOfficerId: officer.id } }),
        db.creditApplication.count({ where: { assignedMarketingOfficerId: officer.id } }),
        db.fieldTask.count({ where: { assignedOfficerId: officer.id, taskType: "SURVEY" } }),
        db.fieldTask.count({ where: { assignedOfficerId: officer.id, taskType: "SURVEY", status: "COMPLETED" } }),
        db.creditApplication.count({ where: { assignedMarketingOfficerId: officer.id, status: "APPROVED" } }),
        db.creditApplication.findMany({
          where: { assignedMarketingOfficerId: officer.id, realizationDate: { not: null } },
          select: { realizationAmount: true, approvedAmount: true, requestedAmount: true },
        }),
        db.fieldTask.count({ where: { assignedOfficerId: officer.id, status: "COMPLETED" } }),
        db.fieldTask.count({ where: { assignedOfficerId: officer.id, status: { in: ["PENDING", "IN_PROGRESS"] } } }),
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

  return <FieldPerformanceClientView initialPerformance={performanceData} />;
}
