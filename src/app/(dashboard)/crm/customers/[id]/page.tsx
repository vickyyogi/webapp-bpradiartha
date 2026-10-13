import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { buildScopeFilter, toScopeUser } from "@/lib/access-scope";
import { CustomerDetailClientView } from "./CustomerDetailClientView";
import { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const customer = await db.customer.findUnique({ where: { id }, select: { legalName: true } });
  return { title: customer ? `Nasabah ${customer.legalName}` : "Detail Nasabah" };
}

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const currentUser = await db.user.findUnique({
    where: { email: session.user.email },
    include: { userRoles: { include: { role: true } } },
  });
  if (!currentUser) redirect("/login");
  const { id } = await params;

  const customer = await db.customer.findFirst({
    where: { id, ...(buildScopeFilter(toScopeUser(currentUser), { assignmentFields: ["createdById"] }) as Prisma.CustomerWhereInput) },
    include: {
      branch: { select: { id: true, name: true, code: true } },
      createdBy: { select: { id: true, fullName: true } },
      updatedBy: { select: { id: true, fullName: true } },
      verifiedBy: { select: { id: true, fullName: true } },
      identityHistories: {
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          changedBy: { select: { id: true, fullName: true } },
          verifiedBy: { select: { id: true, fullName: true } },
        },
      },
      relationshipsAsSubject: {
        orderBy: { createdAt: "desc" },
        include: {
          relatedCustomer: { select: { id: true, customerNumber: true, legalName: true } },
          createdBy: { select: { id: true, fullName: true } },
        },
      },
      consents: { orderBy: { createdAt: "desc" } },
      creditApplications: {
        select: { id: true, applicationNumber: true, status: true, requestedAmount: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 25,
      },
    },
  });

  if (!customer) notFound();

  return <CustomerDetailClientView customer={JSON.parse(JSON.stringify(customer))} />;
}
