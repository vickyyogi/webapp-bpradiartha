import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users2, UserPlus, Filter, FileText, PhoneCall } from "lucide-react";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "CRM & Prospek",
};

export const dynamic = "force-dynamic";

export default async function CrmDashboardPage() {
  const session = await getServerSession(authOptions);
  const currentUser = await db.user.findUnique({
    where: { email: session?.user?.email || "" },
  });

  const [totalLeads, newLeads, convertedLeads] = await Promise.all([
    db.lead.count({ where: currentUser?.organizationId ? { organizationId: currentUser.organizationId } : {} }),
    db.lead.count({ where: { status: "NEW", ...(currentUser?.organizationId ? { organizationId: currentUser.organizationId } : {}) } }),
    db.lead.count({ where: { status: "CONVERTED", ...(currentUser?.organizationId ? { organizationId: currentUser.organizationId } : {}) } }),
  ]);

  const crmModules = [
    {
      title: "Prospek Nasabah (Leads)",
      description: "Kelola data calon nasabah, sumber prospek, dan tahapan lifecycle kredit.",
      icon: UserPlus,
      href: "/crm/leads",
      badge: `${totalLeads} Data`,
    },
    {
      title: "Data Nasabah (Customers)",
      description: "Database nasabah aktif yang telah terkonversi dan memiliki riwayat rekening/kredit.",
      icon: Users2,
      href: "/crm/leads", // currently redirects to leads until customers module
      badge: "Tahap Lanjutan",
    },
    {
      title: "Pipeline & Follow Up",
      description: "Jadwal interaksi marketing, survey awal, dan follow-up prospek harian.",
      icon: PhoneCall,
      href: "/crm/leads",
      badge: `${newLeads} Perlu Follow-up`,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Customer Relationship Management (CRM)</h1>
        <p className="text-muted-foreground mt-2">
          Kelola hubungan dengan calon nasabah dan nasabah eksisting BPR untuk meningkatkan konversi kredit dan dana.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Total Prospek Tercatat</CardDescription>
            <CardTitle className="text-3xl font-bold">{totalLeads}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Prospek Baru (Belum Dihubungi)</CardDescription>
            <CardTitle className="text-3xl font-bold text-blue-600">{newLeads}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Berhasil Terkonversi</CardDescription>
            <CardTitle className="text-3xl font-bold text-green-600">{convertedLeads}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Modul CRM</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {crmModules.map((module) => {
            const Icon = module.icon;
            return (
              <Link key={module.title} href={module.href}>
                <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full border">
                  <CardHeader>
                    <div className="flex items-center justify-between mb-2">
                      <Icon className="h-8 w-8 text-primary" />
                      <span className="text-xs font-medium bg-primary/10 text-primary px-2.5 py-0.5 rounded-full">
                        {module.badge}
                      </span>
                    </div>
                    <CardTitle className="text-lg">{module.title}</CardTitle>
                    <CardDescription>{module.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
