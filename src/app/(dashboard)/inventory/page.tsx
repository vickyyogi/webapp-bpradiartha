"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Boxes,
  Laptop,
  AlertTriangle,
  ArrowRight,
  TrendingDown,
  Wrench,
  UserCheck,
  PackagePlus,
  PlusCircle,
  FileSpreadsheet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function InventoryDashboardPage() {
  const [inventorySummary, setInventorySummary] = useState<any>({
    totalItems: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
  });
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [assetSummary, setAssetSummary] = useState<any>({
    totalAssets: 0,
    assignedCount: 0,
    maintenanceCount: 0,
    disposedCount: 0,
    totalValue: 0,
  });
  const [recentAssets, setRecentAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [invRes, lowInvRes, assetRes] = await Promise.all([
          fetch("/api/inventory/items"),
          fetch("/api/inventory/items?lowStock=true"),
          fetch("/api/assets"),
        ]);

        if (invRes.ok) {
          const invData = await invRes.json();
          setInventorySummary(invData.summary || {});
        }

        if (lowInvRes.ok) {
          const lowData = await lowInvRes.json();
          setLowStockItems(lowData.items || []);
        }

        if (assetRes.ok) {
          const astData = await assetRes.json();
          setAssetSummary(astData.summary || {});
          setRecentAssets((astData.assets || []).slice(0, 5));
        }
      } catch (err) {
        console.error("Failed to load inventory & asset dashboard data:", err);
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
          <h1 className="text-2xl font-bold tracking-tight">Inventaris & Manajemen Aset</h1>
          <p className="text-muted-foreground text-sm">
            Modul operasional pengelolaan stok barang habis pakai (ATK/blanko) dan aset peralatan operasional BPR.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/inventory/items">
            <Button variant="outline" className="gap-2">
              <Boxes className="h-4 w-4" />
              Stok Barang & ATK
            </Button>
          </Link>
          <Link href="/inventory/assets">
            <Button className="gap-2">
              <Laptop className="h-4 w-4" />
              Kelola Aset
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border-l-4 border-l-blue-600 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Total Master ATK
            </CardTitle>
            <Boxes className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "..." : inventorySummary.totalItems}</div>
            <p className="text-xs text-muted-foreground mt-1">Jenis item persediaan</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Peringatan Stok
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {loading ? "..." : inventorySummary.lowStockCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {inventorySummary.outOfStockCount > 0 ? (
                <span className="text-red-600 font-semibold">{inventorySummary.outOfStockCount} stok habis</span>
              ) : (
                "Di bawah batas minimum"
              )}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-indigo-600 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Total Aset BPR
            </CardTitle>
            <Laptop className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "..." : assetSummary.totalAssets}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Nilai perolehan: Rp {((assetSummary.totalValue || 0) / 1000000).toFixed(1)} Jt
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-600 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Aset Diserahterimakan
            </CardTitle>
            <UserCheck className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {loading ? "..." : assetSummary.assignedCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Aktif dipegang karyawan</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-600 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Dalam Servis
            </CardTitle>
            <Wrench className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {loading ? "..." : assetSummary.maintenanceCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Perbaikan & perawatan</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: Low stock alerts vs Recent Assets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Low Stock Alert Section */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Peringatan Stok Kritis & Menipis
              </CardTitle>
              <CardDescription>Barang yang perlu dilakukan pengadaan atau pengisian ulang segera</CardDescription>
            </div>
            <Link href="/inventory/items?lowStock=true">
              <Button variant="ghost" size="sm" className="gap-1 text-xs">
                Lihat Semua <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Memuat data inventaris...</div>
            ) : lowStockItems.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground bg-muted/20 rounded-lg">
                ✅ Seluruh stok barang dan ATK dalam jumlah aman di atas batas minimum.
              </div>
            ) : (
              <div className="space-y-3">
                {lowStockItems.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/40 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{item.name}</span>
                        <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                          {item.itemCode}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Kategori: {item.category} • Lokasi: {item.storageLocation || "Gudang Utama"}
                      </div>
                    </div>

                    <div className="text-right space-y-1">
                      <div className="flex items-center gap-2 justify-end">
                        <span className="text-xs text-muted-foreground">Sisa:</span>
                        <span
                          className={`font-bold text-sm ${
                            item.currentStock === 0
                              ? "text-red-600"
                              : item.currentStock <= item.minStock
                              ? "text-amber-600"
                              : "text-foreground"
                          }`}
                        >
                          {item.currentStock} {item.unit}
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          item.currentStock === 0
                            ? "bg-red-50 text-red-700 border-red-200 text-[10px]"
                            : "bg-amber-50 text-amber-700 border-amber-200 text-[10px]"
                        }
                      >
                        Min. {item.minStock} {item.unit}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Operational Assets Overview */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Laptop className="h-4 w-4 text-indigo-600" />
                Daftar Aset Operasional Terbaru
              </CardTitle>
              <CardDescription>Peralatan komputer, kendaraan, dan inventaris bernilai tinggi</CardDescription>
            </div>
            <Link href="/inventory/assets">
              <Button variant="ghost" size="sm" className="gap-1 text-xs">
                Lihat Semua <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Memuat data aset...</div>
            ) : recentAssets.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground bg-muted/20 rounded-lg">
                Belum ada aset operasional terdaftar.
              </div>
            ) : (
              <div className="space-y-3">
                {recentAssets.map((asset) => (
                  <Link
                    key={asset.id}
                    href={`/inventory/assets/${asset.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/40 transition-colors block"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{asset.name}</span>
                        <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                          {asset.assetNumber}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {asset.category} • Pemegang:{" "}
                        <span className="font-medium text-foreground">
                          {asset.currentHolder?.fullName || "Belum Ditugaskan / Gudang"}
                        </span>
                      </div>
                    </div>

                    <div className="text-right space-y-1">
                      <Badge
                        variant="outline"
                        className={
                          asset.status === "ASSIGNED"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]"
                            : asset.status === "MAINTENANCE"
                            ? "bg-purple-50 text-purple-700 border-purple-200 text-[10px]"
                            : asset.status === "DISPOSED"
                            ? "bg-gray-100 text-gray-700 border-gray-300 text-[10px]"
                            : "bg-blue-50 text-blue-700 border-blue-200 text-[10px]"
                        }
                      >
                        {asset.status}
                      </Badge>
                      <div className="text-[11px] text-muted-foreground">
                        Kondisi: <span className="font-medium">{asset.condition}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Navigation Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/inventory/items" className="block group">
          <Card className="h-full border hover:border-primary transition-colors cursor-pointer group-hover:shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                  <Boxes className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold group-hover:text-primary transition-colors">
                    Master Barang & ATK
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Kelola stok kertas, formulir, toner, dan alat tulis kantor
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/inventory/assets" className="block group">
          <Card className="h-full border hover:border-primary transition-colors cursor-pointer group-hover:shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                  <Laptop className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold group-hover:text-primary transition-colors">
                    Aset & Peralatan BPR
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Pencatatan laptop, kendaraan operasional, brankas, dan serah terima
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/inventory/maintenance" className="block group">
          <Card className="h-full border hover:border-primary transition-colors cursor-pointer group-hover:shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
                  <Wrench className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold group-hover:text-primary transition-colors">
                    Jadwal Pemeliharaan & Servis
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Monitoring servis kendaraan dinas, perbaikan printer, dan AC kantor
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}
