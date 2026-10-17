"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Wrench,
  Search,
  Laptop,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface MaintenanceAsset {
  id: string;
  name: string;
  assetNumber: string;
  vendor?: string | null;
  status: string;
  category: string;
  location?: string | null;
  currentHolder?: { fullName?: string } | null;
  condition: string;
  _count?: { maintenances?: number };
}

export default function MaintenanceSchedulePage() {
  const [assets, setAssets] = useState<MaintenanceAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/assets");
        if (res.ok) {
          const data = (await res.json()) as { assets?: MaintenanceAsset[] };
          if (cancelled) return;
          setAssets(data.assets || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  return (
    <MaintenanceListClient assets={assets} loading={loading} onRefresh={refresh} />
  );
}

function MaintenanceListClient({
  assets,
  loading,
  onRefresh,
}: {
  assets: MaintenanceAsset[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Assets in maintenance or with maintenance records
  const maintenanceAssets = assets.filter((a) => {
    const matchesSearch =
      search === "" ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.assetNumber.toLowerCase().includes(search.toLowerCase()) ||
      (a.vendor && a.vendor.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus =
      statusFilter === "ALL" ||
      (statusFilter === "MAINTENANCE" && a.status === "MAINTENANCE") ||
      (statusFilter === "ASSIGNED" && a.status === "ASSIGNED");

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href="/inventory" className="hover:underline">
              Inventaris
            </Link>
            <span>/</span>
            <span>Jadwal Pemeliharaan</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Jadwal Pemeliharaan & Servis Aset</h1>
          <p className="text-muted-foreground text-sm">
            Monitoring perbaikan, perawatan berkala inventaris kantor, kendaraan dinas, dan peralatan operasional.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/inventory/assets">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Laptop className="h-4 w-4" /> Kelola Aset
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter and Search */}
      <Card className="shadow-sm">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari aset, nomor seri, vendor servis..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="ALL">Semua Aset</option>
                <option value="MAINTENANCE">Hanya Sedang Dalam Servis</option>
                <option value="ASSIGNED">Aktif Operasional</option>
              </select>

              <Button variant="ghost" size="sm" onClick={onRefresh} className="gap-1 text-xs">
                <RefreshCw className="h-3.5 w-3.5" /> Segarkan
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold">Status Pemeliharaan Unit Kerja</CardTitle>
          <CardDescription>
            Menampilkan ringkasan status operasional unit yang memiliki histori pemeliharaan
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Memuat jadwal pemeliharaan...</div>
          ) : maintenanceAssets.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground bg-muted/20 rounded-lg">
              Tidak ada data aset pemeliharaan yang cocok dengan pencarian.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {maintenanceAssets.map((asset) => {
                const isInService = asset.status === "MAINTENANCE";

                return (
                  <div key={asset.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/inventory/assets/${asset.id}`}
                          className="font-bold text-base hover:underline text-foreground"
                        >
                          {asset.name}
                        </Link>
                        <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                          {asset.assetNumber}
                        </span>
                        {isInService && (
                          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs">
                            Sedang Servis
                          </Badge>
                        )}
                      </div>

                      <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span>Kategori: {asset.category}</span>
                        <span>Lokasi: {asset.location || "Kantor Pusat"}</span>
                        <span>
                          Pemegang:{" "}
                          <strong className="text-foreground">{asset.currentHolder?.fullName || "Gudang"}</strong>
                        </span>
                        <span>Kondisi: {asset.condition}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right text-xs">
                        <div className="text-muted-foreground">Histori Servis:</div>
                        <span className="font-bold text-sm text-foreground">
                          {asset._count?.maintenances || 0} catatan
                        </span>
                      </div>
                      <Link href={`/inventory/assets/${asset.id}`}>
                        <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                          <Wrench className="h-3.5 w-3.5" /> Detail & Servis
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
