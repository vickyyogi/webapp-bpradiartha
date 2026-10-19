import { db } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { Prisma } from "@prisma/client";
import { buildScopeFilter, resolveScopeLevel, toScopeUser } from "@/lib/access-scope";
import { CreditApplicationsClientView } from "./CreditApplicationsClientView";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pengajuan Kredit",
};

export const dynamic = "force-dynamic";

const CREDIT_ASSIGNMENT_FIELDS = [
  "assignedMarketingOfficerId",
  "assignedAnalystId",
  "assignedSurveyOfficerId",
  "decisionMakerId",
];

export default async function CreditApplicationsPage() {
  const session = await getServerSession(authOptions);
  const currentUser = await db.user.findUnique({
    where: { email: session?.user?.email || "" },
    include: { userRoles: { include: { role: true } } },
  });

  if (!currentUser) {
    return <CreditApplicationsClientView initialApplications={[]} users={[]} branches={[]} customers={[]} />;
  }

  const scopeUser = toScopeUser(currentUser);
  const organizationId = currentUser.organizationId;
  const orgWide = resolveScopeLevel(scopeUser) === "ORGANIZATION";

  const applicationScope = buildScopeFilter(scopeUser, { assignmentFields: CREDIT_ASSIGNMENT_FIELDS }) as Prisma.CreditApplicationWhereInput;
  const customerScope = buildScopeFilter(scopeUser, { assignmentFields: ["createdById"] }) as Prisma.CustomerWhereInput;
  const officerScope: Prisma.UserWhereInput = orgWide
    ? {}
    : { OR: [{ branchId: currentUser.branchId ?? undefined }, { id: currentUser.id }] };

  const [applications, users, branches, leads, documents, customers, products] = await Promise.all([
    db.creditApplication.findMany({
      where: applicationScope,
      include: {
        customer: {
          select: {
            id: true,
            customerNumber: true,
            legalName: true,
            customerType: true,
            identityNumber: true,
            phone: true,
            email: true,
          },
        },
        branch: { select: { id: true, name: true, code: true } },
        marketingOfficer: { select: { id: true, fullName: true, email: true } },
        analyst: { select: { id: true, fullName: true, email: true } },
        surveyOfficer: { select: { id: true, fullName: true, email: true } },
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
    db.lead.findMany({
      where: { organizationId, ...(orgWide ? {} : { branchId: currentUser.branchId ?? "__none__" }) },
      select: { id: true, name: true, phone: true, address: true, source: true, productInterest: true, notes: true },
      orderBy: { createdAt: "desc" },
    }),
    db.document.findMany({
      where: { organizationId, ownerType: "CREDIT_APPLICATION", documentType: "KTP" },
      select: { id: true, ownerId: true, fileName: true },
    }),
    db.customer.findMany({
      where: { ...customerScope, isActive: true },
      select: { id: true, customerNumber: true, legalName: true, customerType: true, identityNumber: true, phone: true },
      orderBy: { legalName: "asc" },
    }),
    // Tahap 9A (P1.1): produk kredit aktif dari Master Data (sumber pilihan form).
    db.masterItem.findMany({
      where: { organizationId, category: "LOAN_PRODUCT", isActive: true },
      select: { code: true, name: true, attributes: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  return (
    <CreditApplicationsClientView
      initialApplications={JSON.parse(JSON.stringify(applications))}
      users={users}
      branches={branches}
      leads={JSON.parse(JSON.stringify(leads))}
      documents={JSON.parse(JSON.stringify(documents))}
      customers={JSON.parse(JSON.stringify(customers))}
      products={JSON.parse(JSON.stringify(products))}
    />
  );
}
