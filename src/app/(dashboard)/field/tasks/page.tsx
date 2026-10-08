import { db } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
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
  });

  const orgFilter = currentUser?.organizationId ? { organizationId: currentUser.organizationId } : {};

  const [tasks, officers, branches] = await Promise.all([
    db.fieldTask.findMany({
      where: orgFilter,
      include: {
        assignedOfficer: { select: { id: true, fullName: true, email: true } },
        branch: { select: { id: true, name: true, code: true } },
        creditApplication: { select: { id: true, applicationNumber: true } },
        lead: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.user.findMany({
      where: {
        ...orgFilter,
        isActive: true,
      },
      select: { id: true, fullName: true, email: true },
      orderBy: { fullName: "asc" },
    }),
    db.branch.findMany({
      where: {
        ...orgFilter,
        isActive: true,
      },
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
