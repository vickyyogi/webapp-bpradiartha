import { Metadata } from "next";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { SlikAnalyzerClientView } from "./SlikAnalyzerClientView";

export const metadata: Metadata = {
  title: "Analisa SLIK OJK (IDEB)",
};

export const dynamic = "force-dynamic";

/**
 * Halaman analisa SLIK OJK.
 *
 * Akses mengikuti RBAC project ini: user harus punya salah satu dari
 * `credit.analysis.view` / `credit.analysis.create` (permission yang sama dengan
 * modul analisis kredit, sehingga role CREDIT_ANALYST dan admin otomatis bisa).
 * Penyembunyian menu di sidebar bukan batas keamanan — API route-nya juga
 * memeriksa permission yang sama.
 */
export default async function SlikAnalyzerPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string; applicationId?: string; view?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/login");
  }

  const currentUser = await db.user.findUnique({
    where: { email: session.user.email },
    include: {
      userRoles: {
        include: { role: true },
      },
    },
  });

  if (!currentUser) {
    redirect("/login");
  }

  const [canCreate, canView] = await Promise.all([
    hasPermission(currentUser.email, "credit.analysis.create"),
    hasPermission(currentUser.email, "credit.analysis.view"),
  ]);

  if (!canCreate && !canView) {
    redirect("/dashboard");
  }

  // Tahap 5 (P0.5): konteks pipeline pengajuan kredit (opsional). Bila halaman
  // ini dibuka dari detail pengajuan, debitur & pengajuan otomatis terkait.
  const params = await searchParams;
  let initialCustomerId = "";
  let creditApplicationId = "";
  let contextLabel = "";

  if (params.applicationId) {
    const application = await db.creditApplication.findFirst({
      where: { id: params.applicationId, organizationId: currentUser.organizationId },
      select: {
        id: true,
        applicationNumber: true,
        customer: { select: { id: true, legalName: true, customerNumber: true } },
      },
    });
    if (application) {
      creditApplicationId = application.id;
      initialCustomerId = application.customer.id;
      contextLabel = `Pengajuan ${application.applicationNumber} — ${application.customer.legalName} (${application.customer.customerNumber})`;
    }
  } else if (params.customerId) {
    const customer = await db.customer.findFirst({
      where: { id: params.customerId, organizationId: currentUser.organizationId },
      select: { id: true, legalName: true, customerNumber: true },
    });
    if (customer) {
      initialCustomerId = customer.id;
      contextLabel = `Debitur ${customer.legalName} (${customer.customerNumber})`;
    }
  }

  const roleLabel =
    currentUser.userRoles.map((userRole) => userRole.role.name).filter(Boolean).join(", ") ||
    "Staff Operasional";

  return (
    <SlikAnalyzerClientView
      userName={currentUser.fullName}
      userRoleLabel={roleLabel}
      apiConfigured={Boolean(process.env.OPENROUTER_API_KEY?.trim())}
      defaultModel={process.env.OPENROUTER_MODEL?.trim() || "qwen/qwen3.7-flash"}
      fallbackModel={process.env.OPENROUTER_FALLBACK_MODEL?.trim() || "deepseek/deepseek-v4.1-flash"}
      initialCustomerId={initialCustomerId}
      creditApplicationId={creditApplicationId}
      contextLabel={contextLabel}
      initialViewRecordId={params.view || ""}
    />
  );
}
