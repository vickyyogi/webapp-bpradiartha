import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { buildScopeFilter, resolveScopeLevel, toScopeUser } from "@/lib/access-scope";
import { maskIdentity } from "@/lib/customer";
import { CustomersClientView } from "./CustomersClientView";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Data Nasabah (Customers)",
};

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const currentUser = await db.user.findUnique({
    where: { email: session.user?.email || "" },
    include: { userRoles: { include: { role: true } } },
  });
  if (!currentUser) redirect("/login");

  const scopeUser = toScopeUser(currentUser);
  const orgWide = resolveScopeLevel(scopeUser) === "ORGANIZATION";
  const customerScope = buildScopeFilter(scopeUser, { assignmentFields: ["createdById"] }) as Prisma.CustomerWhereInput;

  const [customers, branches] = await Promise.all([
    db.customer.findMany({
      where: customerScope,
      include: {
        branch: { select: { id: true, name: true } },
        _count: { select: { creditApplications: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    db.branch.findMany({
      where: {
        isActive: true,
        organizationId: currentUser.organizationId,
        ...(orgWide ? {} : { id: currentUser.branchId ?? "__none__" }),
      },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const initialCustomers = customers.map((c) => ({
    id: c.id,
    customerNumber: c.customerNumber,
    customerType: c.customerType,
    status: c.status,
    legalName: c.legalName,
    identityNumberMasked: maskIdentity(c.identityNumber),
    phone: c.phone,
    email: c.email,
    branch: c.branch,
    verified: Boolean(c.verifiedAt),
    applicationCount: c._count.creditApplications,
    createdAt: c.createdAt,
  }));

  return (
    <CustomersClientView
      initialCustomers={JSON.parse(JSON.stringify(initialCustomers))}
      branches={branches}
    />
  );
}
