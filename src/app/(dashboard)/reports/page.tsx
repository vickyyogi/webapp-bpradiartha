"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  FileSpreadsheet,
  Printer,
  Download,
  Calendar,
  Filter,
  RefreshCw,
  TrendingUp,
  CreditCard,
  ShoppingCart,
  Boxes,
  Laptop,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export default function ReportsDashboardPage() {
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"credit" | "field" | "purchasing" | "inventory">("credit");

  // Filters
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const fetchReports = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const res = await fetch(`/api/reports?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setReportData(data);
      }
    } catch (err) {
      console.error("Failed to load reports:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [startDate, endDate]);

  const handleExportCSV = (domain: string) => {
    const params = new URLSearchParams();
    params.set("domain", domain);
    params.set("format", "csv");
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);

    window.open(`/api/reports?${params.toString()}`, "_blank");
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 print:m-0 print:p-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4 print:border-none">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1 print:hidden">
            <span>Manajemen & Operasional</span>
            <span>/</span>
            <span>Laporan Terpadu</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Laporan & Analitika Operasional BPR
          </h1>
          <p className="text-muted-foreground text-sm">
            Konsolidasi data portofolio permohonan kredit, aktivitas petugas lapangan, pengadaan belanja, dan aset inventaris.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5 text-xs">
            <Printer className="h-4 w-4" /> Cetak / Unduh PDF
          </Button>
          <Button
            size="sm"
            onClick={() => handleExportCSV(activeTab.toUpperCase())}
            className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Download className="h-4 w-4" /> Ekspor CSV ({activeTab.toUpperCase()})
          </Button>
        </div>
      </div>

      {/* Date Filter & Export Bar */}
      <Card className="shadow-sm print:hidden">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> Periode Laporan:
              </span>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-40 h-9 text-xs"
              />
              <span className="text-xs text-muted-foreground">s/d</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-40 h-9 text-xs"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button variant="ghost" size="sm" onClick={fetchReports} className="gap-1 text-xs">
                <RefreshCw className="h-3.5 w-3.5" /> Hitung Ulang
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Macro Executive Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-600 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Total Pengajuan Kredit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {loading ? "..." : reportData?.creditPipelineSummary?.totalApplications || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Realisasi: Rp {(((reportData?.creditPipelineSummary?.totalRealizedAmount || 0) / 1000000)).toFixed(1)} Jt
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-600 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Rasio Selesai Tugas Lapangan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {loading ? "..." : `${reportData?.fieldProductivitySummary?.completionRate || 0}%`}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {reportData?.fieldProductivitySummary?.completedTasks || 0} dari {reportData?.fieldProductivitySummary?.totalTasks || 0} tugas selesai
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-600 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Komitmen Belanja (PO)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-purple-600">
              Rp {(((reportData?.purchasingSummary?.totalPOValue || 0) / 1000000)).toFixed(1)} Jt
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {reportData?.purchasingSummary?.totalPO || 0} Surat Pesanan (PO)
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Total Valuasi Aset Tetap
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-amber-600">
              Rp {(((reportData?.inventoryAssetSummary?.assetTotalValuation || 0) / 1000000)).toFixed(1)} Jt
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {reportData?.inventoryAssetSummary?.totalAssetsCount || 0} unit aset terdaftar
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="space-y-4">
        <div className="flex border-b print:hidden">
          <button
            onClick={() => setActiveTab("credit")}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === "credit"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <CreditCard className="h-4 w-4" />
            Laporan Kredit & Pipeline
          </button>
          <button
            onClick={() => setActiveTab("field")}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === "field"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <TrendingUp className="h-4 w-4" />
            Produktivitas Petugas Lapangan
          </button>
          <button
            onClick={() => setActiveTab("purchasing")}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === "purchasing"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <ShoppingCart className="h-4 w-4" />
            Pengadaan & Pembelian (PO)
          </button>
          <button
            onClick={() => setActiveTab("inventory")}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === "inventory"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Boxes className="h-4 w-4" />
            Inventaris & Aset BPR
          </button>
        </div>

        {/* Tab 1: Credit Pipeline */}
        {activeTab === "credit" && (
          <div className="space-y-6">
            {/* Status breakdown grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2">
              {reportData?.creditPipelineSummary?.byStatus &&
                Object.entries(reportData.creditPipelineSummary.byStatus).map(([st, count]: any) => (
                  <Card key={st} className="p-3 text-center bg-card">
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase">{st}</span>
                    <div className="text-lg font-bold text-foreground mt-1">{count}</div>
                  </Card>
                ))}
            </div>

            {/* Financial comparison card */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold">Ringkasan Nilai Finansial Portofolio Kredit</CardTitle>
                  <CardDescription>Akumulasi nominal pengajuan, persetujuan komite, dan realisasi pencairan</CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleExportCSV("CREDIT")}
                  className="gap-1 text-xs print:hidden"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" /> Unduh CSV
                </Button>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-lg bg-muted/30 border">
                  <div>
                    <span className="text-xs text-muted-foreground">Total Nominal Diajukan:</span>
                    <div className="text-xl font-extrabold font-mono text-foreground mt-1">
                      Rp {reportData?.creditPipelineSummary?.totalRequestedAmount?.toLocaleString("id-ID")}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Total Disetujui Komite:</span>
                    <div className="text-xl font-extrabold font-mono text-primary mt-1">
                      Rp {reportData?.creditPipelineSummary?.totalApprovedAmount?.toLocaleString("id-ID")}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Total Realisasi Dicairkan:</span>
                    <div className="text-xl font-extrabold font-mono text-emerald-600 mt-1">
                      Rp {reportData?.creditPipelineSummary?.totalRealizedAmount?.toLocaleString("id-ID")}
                    </div>
                  </div>
                </div>

                <div className="mt-6 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs text-muted-foreground text-left bg-muted/40">
                        <th className="py-2.5 px-3 font-semibold">No. Aplikasi</th>
                        <th className="py-2.5 px-3 font-semibold">Pemohon</th>
                        <th className="py-2.5 px-3 font-semibold">Produk</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Diajukan</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Disetujui</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Realisasi</th>
                        <th className="py-2.5 px-3 font-semibold text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {reportData?.data?.creditApps?.map((c: any) => (
                        <tr key={c.id} className="hover:bg-muted/40">
                          <td className="py-2 px-3 font-mono text-xs font-semibold text-primary">
                            {c.applicationNumber}
                          </td>
                          <td className="py-2 px-3 text-xs font-medium">{c.applicant?.fullName}</td>
                          <td className="py-2 px-3 text-xs text-muted-foreground">{c.product || "-"}</td>
                          <td className="py-2 px-3 text-right font-mono text-xs">
                            Rp {c.requestedAmount?.toLocaleString("id-ID")}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-xs">
                            {c.approvedAmount ? `Rp ${c.approvedAmount.toLocaleString("id-ID")}` : "-"}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-xs text-emerald-600">
                            {c.realizationAmount ? `Rp ${c.realizationAmount.toLocaleString("id-ID")}` : "-"}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <Badge variant="outline" className="text-[10px]">
                              {c.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tab 2: Field Productivity */}
        {activeTab === "field" && (
          <Card className="shadow-sm">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold">Produktivitas Petugas Lapangan</CardTitle>
                <CardDescription>Pelaksanaan tugas survey on-the-spot dan kunjungan nasabah</CardDescription>
              </div>
              <Link href="/field/performance">
                <Button size="sm" variant="outline" className="text-xs print:hidden">
                  Lihat Detail Performa
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-lg bg-muted/30 border">
                <div>
                  <span className="text-xs text-muted-foreground">Total Tugas Ditugaskan:</span>
                  <div className="text-2xl font-bold font-mono mt-1">
                    {reportData?.fieldProductivitySummary?.totalTasks || 0}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Tugas Berhasil Diselesaikan:</span>
                  <div className="text-2xl font-bold font-mono text-emerald-600 mt-1">
                    {reportData?.fieldProductivitySummary?.completedTasks || 0}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Tugas Dalam Proses / Pending:</span>
                  <div className="text-2xl font-bold font-mono text-amber-600 mt-1">
                    {reportData?.fieldProductivitySummary?.pendingTasks || 0}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tab 3: Purchasing */}
        {activeTab === "purchasing" && (
          <Card className="shadow-sm">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold">Rekapitulasi Belanja Pengadaan (Purchasing)</CardTitle>
                <CardDescription>Monitoring komitmen pembelian dan realisasi belanja per vendor rekanan</CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleExportCSV("PURCHASING")}
                className="gap-1 text-xs print:hidden"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" /> Unduh CSV
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground text-left bg-muted/40">
                      <th className="py-2.5 px-3 font-semibold">No. PO</th>
                      <th className="py-2.5 px-3 font-semibold">Vendor Rekanan</th>
                      <th className="py-2.5 px-3 font-semibold">Tanggal PO</th>
                      <th className="py-2.5 px-3 font-semibold">Syarat Bayar</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Subtotal</th>
                      <th className="py-2.5 px-3 font-semibold text-right">PPN 11%</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Total Nilai</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {reportData?.data?.purchaseOrders?.map((po: any) => (
                      <tr key={po.id} className="hover:bg-muted/40">
                        <td className="py-2 px-3 font-mono text-xs font-semibold text-primary">
                          {po.poNumber}
                        </td>
                        <td className="py-2 px-3 text-xs font-medium">{po.vendor?.name}</td>
                        <td className="py-2 px-3 text-xs text-muted-foreground">
                          {new Date(po.poDate).toLocaleDateString("id-ID")}
                        </td>
                        <td className="py-2 px-3 text-xs text-muted-foreground">{po.paymentTerms}</td>
                        <td className="py-2 px-3 text-right font-mono text-xs">
                          Rp {po.subtotal?.toLocaleString("id-ID")}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-xs text-muted-foreground">
                          Rp {po.taxAmount?.toLocaleString("id-ID")}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-xs">
                          Rp {po.totalAmount?.toLocaleString("id-ID")}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <Badge variant="outline" className="text-[10px]">
                            {po.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tab 4: Inventory & Assets */}
        {activeTab === "inventory" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="shadow-sm">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-bold">Stok Barang & ATK</CardTitle>
                    <CardDescription>Valuasi persediaan habis pakai kantor</CardDescription>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleExportCSV("INVENTORY")}
                    className="gap-1 text-xs print:hidden"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" /> Unduh CSV
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="p-3 rounded-lg bg-muted/30 border space-y-1">
                    <span className="text-xs text-muted-foreground">Total Nilai Persediaan Stok:</span>
                    <div className="text-xl font-bold font-mono text-primary">
                      Rp {reportData?.inventoryAssetSummary?.inventoryValuation?.toLocaleString("id-ID")}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Item di bawah batas minimum:{" "}
                    <strong className="text-amber-600">
                      {reportData?.inventoryAssetSummary?.lowStockItemsCount || 0} jenis barang
                    </strong>
                  </p>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-bold">Aset Tetap & Peralatan</CardTitle>
                    <CardDescription>Valuasi perolehan aset operasional BPR</CardDescription>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleExportCSV("ASSET")}
                    className="gap-1 text-xs print:hidden"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" /> Unduh CSV
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="p-3 rounded-lg bg-muted/30 border space-y-1">
                    <span className="text-xs text-muted-foreground">Total Nilai Perolehan Aset:</span>
                    <div className="text-xl font-bold font-mono text-indigo-600">
                      Rp {reportData?.inventoryAssetSummary?.assetTotalValuation?.toLocaleString("id-ID")}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground flex gap-4">
                    <span>
                      Sedang Dipakai:{" "}
                      <strong>{reportData?.inventoryAssetSummary?.assignedAssetsCount || 0} unit</strong>
                    </span>
                    <span>
                      Dalam Servis:{" "}
                      <strong className="text-purple-600">
                        {reportData?.inventoryAssetSummary?.maintenanceAssetsCount || 0} unit
                      </strong>
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
