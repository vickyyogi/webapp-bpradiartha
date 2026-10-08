"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, TrendingUp, Users, CheckCircle2, DollarSign, Calendar, Clock, AlertTriangle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export type OfficerPerformance = {
  officerId: string;
  officerName: string;
  officerEmail: string;
  branchName: string;
  leadCount: number;
  appCount: number;
  surveyTaskCount: number;
  completedSurveyCount: number;
  approvedAppCount: number;
  realizedCount: number;
  realizedAmount: number;
  completedTasks: number;
  pendingTasks: number;
  overdueTasks: number;
  completionRate: number;
};

export function FieldPerformanceClientView({
  initialPerformance,
}: {
  initialPerformance: OfficerPerformance[];
}) {
  const [performance, setPerformance] = useState<OfficerPerformance[]>(initialPerformance);
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = performance.filter((p) => {
    const q = searchQuery.toLowerCase();
    return (
      !searchQuery ||
      p.officerName.toLowerCase().includes(q) ||
      p.branchName.toLowerCase().includes(q) ||
      p.officerEmail.toLowerCase().includes(q)
    );
  });

  const totalLeadsAll = performance.reduce((sum, p) => sum + p.leadCount, 0);
  const totalAppsAll = performance.reduce((sum, p) => sum + p.appCount, 0);
  const totalSurveysCompletedAll = performance.reduce((sum, p) => sum + p.completedSurveyCount, 0);
  const totalRealizedAmountAll = performance.reduce((sum, p) => sum + p.realizedAmount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/field">
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Kembali
              </Button>
            </Link>
            <h1 className="text-2xl font-bold tracking-tight">Kinerja Operasional Petugas Lapangan</h1>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            Metrik kinerja faktual berbasis aktivitas riil (Section 16), bebas dari penilaian subjektif manual.
          </p>
        </div>
      </div>

      {/* Aggregate KPI */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Total Prospek Ditangani</CardDescription>
            <CardTitle className="text-2xl font-bold text-blue-600">{totalLeadsAll}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Calon debitur yang diakuisisi</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Permohonan Kredit Masuk</CardDescription>
            <CardTitle className="text-2xl font-bold text-purple-600">{totalAppsAll}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Diajukan oleh marketing officer</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Survey Selesai Dilakukan</CardDescription>
            <CardTitle className="text-2xl font-bold text-yellow-600">{totalSurveysCompletedAll}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Verifikasi fisik tempat & agunan</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Total Nominal Realisasi</CardDescription>
            <CardTitle className="text-2xl font-bold text-green-600">
              Rp {(totalRealizedAmountAll / 1000000).toFixed(1)} Jt
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Akad kredit yang telah terealisasi</p>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari berdasarkan nama petugas atau kantor cabang..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Performance Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Tabel Kinerja Operasional Per Petugas</CardTitle>
          <CardDescription>
            Data riil dari pencatatan prospek, permohonan kredit, tugas survey, dan realisasi akad.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Petugas</TableHead>
                  <TableHead>Cabang</TableHead>
                  <TableHead className="text-center">Prospek</TableHead>
                  <TableHead className="text-center">Pengajuan</TableHead>
                  <TableHead className="text-center">Survey Selesai</TableHead>
                  <TableHead className="text-center">Disetujui</TableHead>
                  <TableHead className="text-right">Realisasi (Rp)</TableHead>
                  <TableHead className="text-center">Tugas Selesai / Total</TableHead>
                  <TableHead className="text-center">Tingkat Penyelesaian</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => (
                  <TableRow key={item.officerId}>
                    <TableCell>
                      <div className="font-semibold text-sm">{item.officerName}</div>
                      <div className="text-[11px] text-muted-foreground">{item.officerEmail}</div>
                    </TableCell>
                    <TableCell className="text-xs">{item.branchName}</TableCell>
                    <TableCell className="text-center font-medium">{item.leadCount}</TableCell>
                    <TableCell className="text-center font-medium">{item.appCount}</TableCell>
                    <TableCell className="text-center font-medium">
                      {item.completedSurveyCount} / {item.surveyTaskCount}
                    </TableCell>
                    <TableCell className="text-center font-medium text-blue-600">
                      {item.approvedAppCount}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-green-600">
                      {item.realizedAmount ? `Rp ${item.realizedAmount.toLocaleString("id-ID")}` : "-"}
                    </TableCell>
                    <TableCell className="text-center text-xs">
                      {item.completedTasks} / {item.completedTasks + item.pendingTasks}
                      {item.overdueTasks > 0 && (
                        <span className="text-destructive font-semibold ml-1">({item.overdueTasks} Overdue)</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={
                          item.completionRate >= 80
                            ? "success"
                            : item.completionRate >= 50
                            ? "warning"
                            : "secondary"
                        }
                      >
                        {item.completionRate}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
