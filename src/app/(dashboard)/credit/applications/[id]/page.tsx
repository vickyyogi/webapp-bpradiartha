import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { CreditApplicationDetailClientView } from "./CreditApplicationDetailClientView";
import { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const application = await db.creditApplication.findUnique({
    where: { id },
    select: {
      applicationNumber: true,
      applicant: { select: { fullName: true } },
    },
  });

  return {
    title: application
      ? `Pengajuan ${application.applicationNumber} - ${application.applicant?.fullName ?? "Nasabah"}`
      : "Detail Pengajuan Kredit",
  };
}

export const dynamic = "force-dynamic";

export default async function CreditApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/login");
  }

  const { id } = await params;

  const currentUser = await db.user.findUnique({
    where: { email: session.user.email },
  });

  const [application, users, documents] = await Promise.all([
    db.creditApplication.findUnique({
      where: { id },
      include: {
        applicant: { select: { id: true, fullName: true, email: true, phone: true } },
        branch: { select: { id: true, name: true, code: true } },
        marketingOfficer: { select: { id: true, fullName: true, email: true } },
        analyst: { select: { id: true, fullName: true, email: true } },
        surveyOfficer: { select: { id: true, fullName: true, email: true } },
        decisionMaker: { select: { id: true, fullName: true, email: true } },
        statusHistories: {
          include: {
            changedBy: { select: { id: true, fullName: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        approvalRecords: {
          include: {
            approver: { select: { id: true, fullName: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
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
    db.document.findMany({
      where: {
        ownerType: "CREDIT_APPLICATION",
        ownerId: id,
      },
      include: {
        uploadedBy: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!application) {
    notFound();
  }

  return (
    <CreditApplicationDetailClientView
      application={JSON.parse(JSON.stringify(application))}
      users={users}
      initialDocuments={JSON.parse(JSON.stringify(documents))}
    />
  );
}
