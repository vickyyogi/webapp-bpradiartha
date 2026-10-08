import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { LeadsClientView } from "./LeadsClientView";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Data Prospek (Leads)",
};

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  const currentUser = await db.user.findUnique({
    where: { email: session.user?.email || "" },
  });

  const organizationId = currentUser?.organizationId;

  const [leads, officers, branches] = await Promise.all([
    db.lead.findMany({
      where: organizationId ? { organizationId } : undefined,
      include: {
        branch: { select: { id: true, name: true } },
        assignedOfficer: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.user.findMany({
      where: {
        isActive: true,
        ...(organizationId ? { organizationId } : {}),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
      },
      orderBy: { fullName: "asc" },
    }),
    db.branch.findMany({
      where: {
        isActive: true,
        ...(organizationId ? { organizationId } : {}),
      },
      select: {
        id: true,
        name: true,
        code: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <LeadsClientView
      initialLeads={leads as any}
      officers={officers}
      branches={branches}
    />
  );
}
