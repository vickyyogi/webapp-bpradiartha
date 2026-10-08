"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShoppingCart,
  FileCheck,
  PackageCheck,
  Building2,
  PlusCircle,
  ArrowRight,
  Clock,
  DollarSign,
  TrendingUp,
  FileText,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function PurchasingDashboardPage() {
  const [prSummary, setPrSummary] = useState<any>({ total: 0, submitted: 0, approved: 0, rejected: 0, totalAmount: 0 });
  const [poSummary, setPoSummary] = useState<any>({ total: 0, issued: 0, partial: 0, completed: 0, totalValue: 0 });
  const [recentPRs, setRecentPRs] = useState<any[]>([]);
  const [recentPOs, setRecentPOs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [prRes, poRes] = await Promise.all([
          fetch("/api/purchasing/requests"),
          fetch("/api/purchasing/orders"),
        ]);

        if (prRes.ok) {
          const prData = await prRes.json();
          setPrSummary(prData.summary || {});
          setRecentPRs((prData.requests || []).slice(0, 5));
        }

        if (poRes.ok) {
          const poData = await poRes.json();
          setPoSummary(poData.summary || {});
          setRecentPOs((poData.orders || []).slice(0, 5));
        }
      } catch (err) {
        console.error("Error loading purchasing dashboard:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pengadaan & Pembelian (Purchasing)</h1>
          <p className="text-muted-foreground text-sm">
            Modul pengajuan pengadaan barang/jasa (PR), alur persetujuan bertingkat, penerbitan PO, dan penerimaan barang (GRN).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/purchasing/requests">
            <Button variant="outline" className="gap-2">
              <FileCheck className="h-4 w-4" />
              Pengajuan (PR)
            </Button>
          </Link>
          <Link href="/purchasing/orders">
            <Button className="gap-2">
              <ShoppingCart className="h-4 w-4" />
              Pesanan (PO)
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-amber-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Menunggu Approval (PR)
            </CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{loading ? "..." : prSummary.submitted}</div>
            <p className="text-xs text-muted-foreground mt-1">Perlu tinjauan atasan / direksi</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-600 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              PR Disetujui
            </CardTitle>
            <FileCheck className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{loading ? "..." : prSummary.approved}</div>
            <p className="text-xs text-muted-foreground mt-1">Siap diterbitkan Purchase Order</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-600 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              PO Aktif Berjalan
            </CardTitle>
            <ShoppingCart className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {loading ? "..." : (poSummary.issued || 0) + (poSummary.partial || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Menunggu pengiriman vendor</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-indigo-600 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Nilai Pembelian
            </CardTitle>
            <DollarSign className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              Rp {((poSummary.totalValue || 0) / 1000000).toFixed(1)} Jt
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total komitmen pesanan aktif</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: Recent PRs vs Recent POs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Recent Purchase Requests */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-amber-600" />
                Pengajuan Pengadaan Terbaru (PR)
              </CardTitle>
              <CardDescription>Permohonan barang & jasa dari berbagai divisi operasional</CardDescription>
            </div>
            <Link href="/purchasing/requests">
              <Button variant="ghost" size="sm" className="gap-1 text-xs">
                Lihat Semua <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Memuat pengajuan pengadaan...</div>
            ) : recentPRs.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground bg-muted/20 rounded-lg">
                Belum ada pengajuan pengadaan barang.
              </div>
            ) : (
              <div className="space-y-3">
                {recentPRs.map((pr) => (
                  <Link
                    key={pr.id}
                    href={`/purchasing/requests/${pr.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/40 transition-colors block"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{pr.title}</span>
                        <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                          {pr.requestNumber}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Pemohon: <span className="font-medium text-foreground">{pr.requester?.fullName}</span> •{" "}
                        {pr._count?.items} item
                      </div>
                    </div>

                    <div className="text-right space-y-1">
                      <div className="font-bold text-xs font-mono">
                        Rp {pr.totalEstimatedAmount?.toLocaleString("id-ID")}
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          pr.status === "APPROVED"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]"
                            : pr.status === "SUBMITTED"
                            ? "bg-amber-50 text-amber-700 border-amber-200 text-[10px]"
                            : pr.status === "REJECTED"
                            ? "bg-red-50 text-red-700 border-red-200 text-[10px]"
                            : "bg-blue-50 text-blue-700 border-blue-200 text-[10px]"
                        }
                      >
                        {pr.status}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Recent Purchase Orders */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-blue-600" />
                Pesanan Pembelian Aktif (PO)
              </CardTitle>
              <CardDescription>Pesanan resmi yang diterbitkan ke vendor rekanan BPR</CardDescription>
            </div>
            <Link href="/purchasing/orders">
              <Button variant="ghost" size="sm" className="gap-1 text-xs">
                Lihat Semua <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Memuat pesanan pembelian...</div>
            ) : recentPOs.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground bg-muted/20 rounded-lg">
                Belum ada pesanan pembelian resmi diterbitkan.
              </div>
            ) : (
              <div className="space-y-3">
                {recentPOs.map((po) => (
                  <Link
                    key={po.id}
                    href={`/purchasing/orders/${po.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/40 transition-colors block"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{po.vendor?.name}</span>
                        <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                          {po.poNumber}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Tanggal: {new Date(po.poDate).toLocaleDateString("id-ID")} • Syarat: {po.paymentTerms}
                      </div>
                    </div>

                    <div className="text-right space-y-1">
                      <div className="font-bold text-xs font-mono">
                        Rp {po.totalAmount?.toLocaleString("id-ID")}
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          po.status === "COMPLETED"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]"
                            : po.status === "PARTIAL_RECEIVED"
                            ? "bg-amber-50 text-amber-700 border-amber-200 text-[10px]"
                            : po.status === "ISSUED"
                            ? "bg-blue-50 text-blue-700 border-blue-200 text-[10px]"
                            : "bg-gray-100 text-gray-700 border-gray-300 text-[10px]"
                        }
                      >
                        {po.status}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Link href="/purchasing/requests" className="block group">
          <Card className="h-full border hover:border-primary transition-colors cursor-pointer group-hover:shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
                  <FileCheck className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold group-hover:text-primary transition-colors">
                    Pengajuan (PR)
                  </CardTitle>
                  <CardDescription className="text-xs">Formulir pengajuan & persetujuan</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/purchasing/orders" className="block group">
          <Card className="h-full border hover:border-primary transition-colors cursor-pointer group-hover:shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                  <ShoppingCart className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold group-hover:text-primary transition-colors">
                    Purchase Order (PO)
                  </CardTitle>
                  <CardDescription className="text-xs">Penerbitan surat pesanan vendor</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/purchasing/receipts" className="block group">
          <Card className="h-full border hover:border-primary transition-colors cursor-pointer group-hover:shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                  <PackageCheck className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold group-hover:text-primary transition-colors">
                    Penerimaan (GRN)
                  </CardTitle>
                  <CardDescription className="text-xs">Pengecekan fisik & update stok</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/purchasing/vendors" className="block group">
          <Card className="h-full border hover:border-primary transition-colors cursor-pointer group-hover:shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold group-hover:text-primary transition-colors">
                    Vendor Rekanan
                  </CardTitle>
                  <CardDescription className="text-xs">Database supplier & rekening</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}
