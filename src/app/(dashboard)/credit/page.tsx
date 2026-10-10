import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, FileCheck2, FileScan, FileText, ClipboardList, CheckCircle2, XCircle, ArrowRight, ShieldCheck, MapPin } from "lucide-react";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kredit & Analisis",
};

export const dynamic = "force-dynamic";

export default async function CreditDashboardPage() {
  const session = await getServerSession(authOptions);
  const currentUser = await db.user.findUnique({
    where: { email: session?.user?.email || "" },
  });

  const orgFilter = currentUser?.organizationId ? { organizationId: currentUser.organizationId } : {};

  const [
    totalApps,
    inProcessApps,
    decisionApps,
    approvedApps,
    rejectedApps,
    recentApplications,
  ] = await Promise.all([
    db.creditApplication.count({ where: orgFilter }),
    db.creditApplication.count({
      where: {
        ...orgFilter,
        status: { in: ["SUBMITTED", "VERIFICATION", "ANALYSIS", "SURVEY", "REVIEW"] },
      },
    }),
    db.creditApplication.count({
      where: {
        ...orgFilter,
        status: "DECISION",
      },
    }),
    db.creditApplication.count({
      where: {
        ...orgFilter,
        status: "APPROVED",
      },
    }),
    db.creditApplication.count({
      where: {
        ...orgFilter,
        status: { in: ["REJECTED", "RETURNED"] },
      },
    }),
    db.creditApplication.findMany({
      where: orgFilter,
      include: {
        applicant: { select: { fullName: true } },
        branch: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const creditModules = [
    {
      title: "Pengajuan Kredit (Applications)",
      description: "Daftar seluruh berkas pengajuan kredit nasabah baru maupun eksisting beserta status siklus hidupnya.",
      icon: FileText,
      href: "/credit/applications",
      badge: `${totalApps} Pengajuan`,
      primary: true,
    },
    {
      title: "Analisis Kelayakan Kredit",
      description: "Penilaian aspek 5C (Character, Capacity, Capital, Collateral, Condition) dan rekomendasi analis.",
      icon: ShieldCheck,
      href: "/credit/applications",
      badge: `${inProcessApps} Dalam Proses`,
    },
    {
      title: "Tugas Survey Lapangan",
      description: "Penugasan dan hasil on-the-spot survey jaminan serta tempat usaha debitur oleh field officer.",
      icon: MapPin,
      href: "/credit/applications",
      badge: "Field Officer",
    },
    {
      title: "Keputusan Komite Kredit",
      description: "Review berkas, persetujuan bertingkat, dan keputusan akhir komite pemutus kredit.",
      icon: FileCheck2,
      href: "/credit/applications",
      badge: `${decisionApps} Menunggu Keputusan`,
    },
    {
      title: "Analisa SLIK OJK (IDEB)",
      description:
        "Unggah laporan SLIK OJK debitur, ekstrak datanya secara otomatis, lalu cetak laporan Credit Risk Assessment siap komite.",
      icon: FileScan,
      href: "/credit/slik-analyzer",
      badge: "AI Analyzer",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manajemen Kredit</h1>
          <p className="text-muted-foreground mt-1">
            Pengelolaan end-to-end siklus pengajuan kredit, verifikasi dokumen, analisis 5C, hingga keputusan persetujuan.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/credit/applications">
            <Button className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Kelola Pengajuan Kredit
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Total Pengajuan</CardDescription>
            <CardTitle className="text-3xl font-bold">{totalApps}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Seluruh permohonan kredit yang masuk</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Sedang Diproses</CardDescription>
            <CardTitle className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">{inProcessApps}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Tahap Verifikasi, Analisis & Survey</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Kredit Disetujui</CardDescription>
            <CardTitle className="text-3xl font-bold text-green-600 dark:text-green-400">{approvedApps}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Siap diterbitkan SPK & realisasi akad</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Ditolak / Dikembalikan</CardDescription>
            <CardTitle className="text-3xl font-bold text-red-600 dark:text-red-400">{rejectedApps}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Tidak memenuhi kriteria / butuh revisi</p>
          </CardContent>
        </Card>
      </div>

      {/* Credit Modules Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {creditModules.map((module) => {
          const Icon = module.icon;
          return (
            <Card key={module.title} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{module.title}</CardTitle>
                      <CardDescription className="mt-1">{module.description}</CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary">{module.badge}</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0 flex justify-end">
                <Link href={module.href}>
                  <Button variant="ghost" size="sm" className="gap-2">
                    Buka Modul <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Applications Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Pengajuan Kredit Terbaru</CardTitle>
              <CardDescription>5 permohonan kredit terakhir yang dicatat dalam sistem</CardDescription>
            </div>
            <Link href="/credit/applications">
              <Button variant="outline" size="sm">
                Lihat Semua
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {recentApplications.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              Belum ada berkas pengajuan kredit.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentApplications.map((app) => (
                <div key={app.id} className="py-3 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{app.applicationNumber}</span>
                      <Badge variant="outline" className="text-xs">
                        {app.product || "Kredit Umum"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Pemohon: <span className="font-medium text-foreground">{app.applicant.fullName}</span> • Kantor: {app.branch?.name || "-"}
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-sm font-semibold">
                      {app.requestedAmount ? `Rp ${app.requestedAmount.toLocaleString("id-ID")}` : "-"}
                    </p>
                    <Badge variant={app.status === "APPROVED" ? "success" : app.status === "REJECTED" ? "destructive" : "info"} className="text-xs">
                      {app.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
