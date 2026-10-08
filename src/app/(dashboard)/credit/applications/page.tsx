import { db } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { CreditApplicationsClientView } from "./CreditApplicationsClientView";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pengajuan Kredit",
};

export const dynamic = "force-dynamic";

export default async function CreditApplicationsPage() {
  const session = await getServerSession(authOptions);
  const currentUser = await db.user.findUnique({
    where: { email: session?.user?.email || "" },
  });

  const orgFilter = currentUser?.organizationId ? { organizationId: currentUser.organizationId } : {};

  const [applications, users, branches, leads, documents] = await Promise.all([
    db.creditApplication.findMany({
      where: orgFilter,
      include: {
        applicant: { select: { id: true, fullName: true, email: true, phone: true } },
        branch: { select: { id: true, name: true, code: true } },
        marketingOfficer: { select: { id: true, fullName: true, email: true } },
        analyst: { select: { id: true, fullName: true, email: true } },
        surveyOfficer: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.user.findMany({
      where: {
        ...(currentUser?.organizationId ? { organizationId: currentUser.organizationId } : {}),
        isActive: true,
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
        ...(currentUser?.organizationId ? { organizationId: currentUser.organizationId } : {}),
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        code: true,
      },
      orderBy: { name: "asc" },
    }),
    db.lead.findMany({
      where: orgFilter,
      select: {
        id: true,
        name: true,
        phone: true,
        address: true,
        source: true,
        productInterest: true,
        notes: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    db.document.findMany({
      where: {
        ...(currentUser?.organizationId ? { organizationId: currentUser.organizationId } : {}),
        ownerType: "CREDIT_APPLICATION",
        documentType: "KTP",
      },
      select: {
        id: true,
        ownerId: true,
        fileName: true,
        filePath: true,
      },
    }),
  ]);

  return (
    <CreditApplicationsClientView
      initialApplications={JSON.parse(JSON.stringify(applications))}
      users={users}
      branches={branches}
      leads={JSON.parse(JSON.stringify(leads))}
      documents={JSON.parse(JSON.stringify(documents))}
    />
  );
}
