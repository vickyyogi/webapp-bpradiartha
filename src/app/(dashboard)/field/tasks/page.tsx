import { db } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { Prisma } from "@prisma/client";
import { buildScopeFilter, resolveScopeLevel, toScopeUser } from "@/lib/access-scope";
import { FieldTasksClientView } from "./FieldTasksClientView";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tugas Lapangan",
};

export const dynamic = "force-dynamic";

export default async function FieldTasksPage() {
  const session = await getServerSession(authOptions);
  const currentUser = await db.user.findUnique({
    where: { email: session?.user?.email || "" },
    include: { userRoles: { include: { role: true } } },
  });

  if (!currentUser) {
    return <FieldTasksClientView initialTasks={[]} officers={[]} branches={[]} />;
  }

  const scopeUser = toScopeUser(currentUser);
  const organizationId = currentUser.organizationId;
  const orgWide = resolveScopeLevel(scopeUser) === "ORGANIZATION";

  const taskScope = buildScopeFilter(scopeUser, { assignmentFields: ["assignedOfficerId"] }) as Prisma.FieldTaskWhereInput;
  const officerScope: Prisma.UserWhereInput = orgWide
    ? {}
    : { OR: [{ branchId: currentUser.branchId ?? undefined }, { id: currentUser.id }] };

  const [tasks, officers, branches] = await Promise.all([
    db.fieldTask.findMany({
      where: taskScope,
      include: {
        assignedOfficer: { select: { id: true, fullName: true, email: true } },
        branch: { select: { id: true, name: true, code: true } },
        creditApplication: { select: { id: true, applicationNumber: true } },
        lead: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.user.findMany({
      where: { organizationId, isActive: true, ...officerScope },
      select: { id: true, fullName: true, email: true },
      orderBy: { fullName: "asc" },
    }),
    db.branch.findMany({
      where: { organizationId, isActive: true, ...(orgWide ? {} : { id: currentUser.branchId ?? "__none__" }) },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <FieldTasksClientView
      initialTasks={JSON.parse(JSON.stringify(tasks))}
      officers={officers}
      branches={branches}
    />
  );
}
