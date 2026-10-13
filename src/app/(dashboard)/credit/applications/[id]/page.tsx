import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { buildScopeFilter, toScopeUser } from "@/lib/access-scope";
import { CreditApplicationDetailClientView } from "./CreditApplicationDetailClientView";
import { Metadata } from "next";

const CREDIT_ASSIGNMENT_FIELDS = [
  "assignedMarketingOfficerId",
  "assignedAnalystId",
  "assignedSurveyOfficerId",
  "decisionMakerId",
];

async function scopedApplicationId(id: string): Promise<{ found: boolean; organizationId?: string }> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return { found: false };
  const currentUser = await db.user.findUnique({
    where: { email: session.user.email },
    include: { userRoles: { include: { role: true } } },
  });
  if (!currentUser) return { found: false };
  const scopeUser = toScopeUser(currentUser);
  const application = await db.creditApplication.findFirst({
    where: {
      id,
      ...(buildScopeFilter(scopeUser, { assignmentFields: CREDIT_ASSIGNMENT_FIELDS }) as Prisma.CreditApplicationWhereInput),
    },
    select: { id: true, organizationId: true },
  });
  return { found: Boolean(application), organizationId: application?.organizationId };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { found, organizationId } = await scopedApplicationId(id);
  if (!found || !organizationId) {
    return { title: "Detail Pengajuan Kredit" };
  }
  const application = await db.creditApplication.findFirst({
    where: { id, organizationId },
    select: { applicationNumber: true, customer: { select: { legalName: true } } },
  });

  return {
    title: application
      ? `Pengajuan ${application.applicationNumber} - ${application.customer?.legalName ?? "Nasabah"}`
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
    include: { userRoles: { include: { role: true } } },
  });
  if (!currentUser) redirect("/login");

  const scopeUser = toScopeUser(currentUser);
  const scopeWhere = buildScopeFilter(scopeUser, { assignmentFields: CREDIT_ASSIGNMENT_FIELDS }) as Prisma.CreditApplicationWhereInput;

  const [application, users, documents] = await Promise.all([
    db.creditApplication.findFirst({
      where: { id, ...scopeWhere },
      include: {
        customer: {
          select: {
            id: true,
            customerNumber: true,
            legalName: true,
            customerType: true,
            identityType: true,
            identityNumber: true,
            npwp: true,
            birthPlace: true,
            birthDate: true,
            address: true,
            phone: true,
            email: true,
          },
        },
        branch: { select: { id: true, name: true, code: true } },
        marketingOfficer: { select: { id: true, fullName: true, email: true } },
        analyst: { select: { id: true, fullName: true, email: true } },
        surveyOfficer: { select: { id: true, fullName: true, email: true } },
        decisionMaker: { select: { id: true, fullName: true, email: true } },
        statusHistories: {
          include: { changedBy: { select: { id: true, fullName: true, email: true } } },
          orderBy: { createdAt: "desc" },
        },
        approvalRecords: {
          include: { approver: { select: { id: true, fullName: true, email: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    db.user.findMany({
      where: { organizationId: currentUser.organizationId, isActive: true },
      select: { id: true, fullName: true, email: true },
      orderBy: { fullName: "asc" },
    }),
    db.document.findMany({
      where: { ownerType: "CREDIT_APPLICATION", ownerId: id },
      include: { uploadedBy: { select: { id: true, fullName: true, email: true } } },
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
