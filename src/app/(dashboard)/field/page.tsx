import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, CheckCircle2, Clock, AlertTriangle, Users, ClipboardList, TrendingUp, ArrowRight, PlusCircle } from "lucide-react";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Petugas Lapangan",
};

export const dynamic = "force-dynamic";

export default async function FieldDashboardPage() {
  const session = await getServerSession(authOptions);
  const currentUser = await db.user.findUnique({
    where: { email: session?.user?.email || "" },
  });

  const orgFilter = currentUser?.organizationId ? { organizationId: currentUser.organizationId } : {};
  const now = new Date();

  const [
    totalTasks,
    pendingTasks,
    completedTasks,
    overdueTasks,
    recentTasks,
  ] = await Promise.all([
    db.fieldTask.count({ where: orgFilter }),
    db.fieldTask.count({
      where: { ...orgFilter, status: { in: ["PENDING", "IN_PROGRESS"] } },
    }),
    db.fieldTask.count({
      where: { ...orgFilter, status: "COMPLETED" },
    }),
    db.fieldTask.count({
      where: {
        ...orgFilter,
        status: { in: ["PENDING", "IN_PROGRESS"] },
        dueDate: { lt: now },
      },
    }),
    db.fieldTask.findMany({
      where: orgFilter,
      include: {
        assignedOfficer: { select: { fullName: true } },
        branch: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Petugas Lapangan (Field Operations)</h1>
          <p className="text-muted-foreground mt-1">
            Manajemen aktivitas survey fisik, kunjungan nasabah, penjemputan berkas, dan pemantauan kinerja riil petugas.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/field/performance">
            <Button variant="outline" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Laporan Kinerja Petugas
            </Button>
          </Link>
          <Link href="/field/tasks">
            <Button className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Kelola Daftar Tugas
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Total Tugas Terdaftar</CardDescription>
            <CardTitle className="text-3xl font-bold">{totalTasks}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Seluruh penugasan aktivitas lapangan</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Tugas Sedang Berjalan</CardDescription>
            <CardTitle className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">{pendingTasks}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Belum atau sedang dalam proses pengerjaan</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Tugas Berhasil Diselesaikan</CardDescription>
            <CardTitle className="text-3xl font-bold text-green-600 dark:text-green-400">{completedTasks}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Survey & kunjungan terverifikasi</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Jatuh Tempo (Overdue)</CardDescription>
            <CardTitle className="text-3xl font-bold text-red-600 dark:text-red-400">{overdueTasks}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Melewati batas waktu pelaksanaan</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
                <ClipboardList className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-lg">Daftar Penugasan Lapangan</CardTitle>
                <CardDescription className="mt-1">
                  Kelola tugas harian: survey jaminan kredit, kunjungan calon debitur, pengambilan berkas, dan follow-up.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 flex justify-end">
            <Link href="/field/tasks">
              <Button variant="ghost" size="sm" className="gap-2">
                Buka Daftar Tugas <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-500/10 p-2.5 text-green-600">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-lg">Metrik Kinerja Petugas (Section 16)</CardTitle>
                <CardDescription className="mt-1">
                  Evaluasi kinerja berbasis data operasional riil: jumlah prospek, survey selesai, realisasi kredit, dan rasio penyelesaian.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 flex justify-end">
            <Link href="/field/performance">
              <Button variant="ghost" size="sm" className="gap-2">
                Lihat Kinerja Petugas <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Recent Tasks */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Penugasan Terbaru</CardTitle>
              <CardDescription>5 aktivitas lapangan terakhir yang dicatat dalam sistem</CardDescription>
            </div>
            <Link href="/field/tasks">
              <Button variant="outline" size="sm">
                Lihat Semua
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {recentTasks.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              Belum ada tugas lapangan yang tercatat.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentTasks.map((task) => (
                <div key={task.id} className="py-3 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{task.title}</span>
                      <Badge variant="outline" className="text-xs">
                        {task.taskType}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Nasabah: <span className="font-medium text-foreground">{task.customerName || "-"}</span> • Petugas: {task.assignedOfficer.fullName}
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    <Badge variant={task.status === "COMPLETED" ? "success" : task.status === "IN_PROGRESS" ? "warning" : "info"} className="text-xs">
                      {task.status}
                    </Badge>
                    <div className="text-[11px] text-muted-foreground">
                      Batas: {task.dueDate ? new Date(task.dueDate).toLocaleDateString("id-ID") : "-"}
                    </div>
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
