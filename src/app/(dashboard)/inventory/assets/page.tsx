"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Laptop,
  PlusCircle,
  Search,
  Filter,
  UserCheck,
  Wrench,
  AlertTriangle,
  RefreshCw,
  Eye,
  CheckCircle2,
  DollarSign,
  ShieldAlert,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const CATEGORIES = [
  "ALL",
  "IT Equipment",
  "Office Furniture",
  "Kendaraan Operasional",
  "Elektronik & AC",
  "Lainnya",
];

const STATUSES = [
  "ALL",
  "PURCHASED",
  "ASSIGNED",
  "TRANSFERRED",
  "MAINTENANCE",
  "RETURNED",
  "DISPOSED",
];

const CONDITIONS = ["ALL", "GOOD", "FAIR", "DAMAGED", "IN_REPAIR", "DISPOSED"];

export default function AssetsPage() {
  const [assets, setAssets] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({
    totalAssets: 0,
    assignedCount: 0,
    maintenanceCount: 0,
    disposedCount: 0,
    totalValue: 0,
  });
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [condition, setCondition] = useState("ALL");

  // Create Modal
  const [newAssetOpen, setNewAssetOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [assetForm, setAssetForm] = useState({
    assetNumber: "",
    name: "",
    category: "IT Equipment",
    serialNumber: "",
    purchaseDate: "",
    purchasePrice: "",
    vendor: "",
    warrantyExpiry: "",
    location: "",
    currentHolderId: "",
    condition: "GOOD",
    notes: "",
  });

  const fetchAssets = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (category !== "ALL") params.set("category", category);
      if (status !== "ALL") params.set("status", status);
      if (condition !== "ALL") params.set("condition", condition);

      const res = await fetch(`/api/assets?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAssets(data.assets || []);
        setSummary(data.summary || {});
      }
    } catch (err) {
      console.error("Failed to fetch assets:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error("Failed to load users:", err);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, [search, category, status, condition]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setFeedbackMsg(null);
    try {
      const res = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(assetForm),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal mendaftarkan aset baru.");
      }

      setFeedbackMsg({ type: "success", text: "Aset operasional baru berhasil didaftarkan!" });
      setNewAssetOpen(false);
      setAssetForm({
        assetNumber: "",
        name: "",
        category: "IT Equipment",
        serialNumber: "",
        purchaseDate: "",
        purchasePrice: "",
        vendor: "",
        warrantyExpiry: "",
        location: "",
        currentHolderId: "",
        condition: "GOOD",
        notes: "",
      });
      fetchAssets();
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.message });
    } finally {
      setCreating(false);
    }
  };

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
            <span>Aset Operasional</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Manajemen Aset Operasional BPR</h1>
          <p className="text-muted-foreground text-sm">
            Pencatatan, serah terima (handover), pelacakan mutasi, dan siklus hidup perlengkapan kerja.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={() => setNewAssetOpen(true)} className="gap-2">
            <PlusCircle className="h-4 w-4" />
            Daftarkan Aset Baru
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {feedbackMsg && (
        <div
          className={`p-4 rounded-lg text-sm flex items-center justify-between ${
            feedbackMsg.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          <span>{feedbackMsg.text}</span>
          <button onClick={() => setFeedbackMsg(null)} className="text-xs font-semibold hover:underline">
            Tutup
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Total Unit Terdaftar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalAssets || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Nilai: Rp {((summary.totalValue || 0) / 1000000).toFixed(1)} Jt
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-emerald-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Sedang Digunakan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{summary.assignedCount || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Dipegang staf operasional</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-purple-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Dalam Pemeliharaan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{summary.maintenanceCount || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Servis / perbaikan berkala</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-gray-400">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Dihapusbukukan (Disposed)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{summary.disposedCount || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Aset rusak berat / pensiun</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="shadow-sm">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari kode aset, nama, SN, pemegang..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c === "ALL" ? "Semua Kategori" : c}
                </option>
              ))}
            </select>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s === "ALL" ? "Semua Status" : `Status: ${s}`}
                </option>
              ))}
            </select>

            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {c === "ALL" ? "Semua Kondisi" : `Kondisi: ${c}`}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Asset Table */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold">Daftar Peralatan & Aset</CardTitle>
            <CardDescription>Menampilkan {assets.length} aset operasional BPR</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchAssets} className="gap-1 text-xs">
            <RefreshCw className="h-3.5 w-3.5" /> Segarkan
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Memuat data aset...</div>
          ) : assets.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground bg-muted/20 rounded-lg">
              Tidak ada aset yang sesuai kriteria pencarian.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground text-left bg-muted/30">
                    <th className="py-3 px-4 font-semibold">No. Aset</th>
                    <th className="py-3 px-4 font-semibold">Nama & Spesifikasi</th>
                    <th className="py-3 px-4 font-semibold">Kategori</th>
                    <th className="py-3 px-4 font-semibold">No. Seri (S/N)</th>
                    <th className="py-3 px-4 font-semibold">Pemegang Saat Ini</th>
                    <th className="py-3 px-4 font-semibold">Lokasi</th>
                    <th className="py-3 px-4 font-semibold text-center">Kondisi</th>
                    <th className="py-3 px-4 font-semibold text-center">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {assets.map((asset) => {
                    return (
                      <tr key={asset.id} className="hover:bg-muted/40 transition-colors">
                        <td className="py-3 px-4 font-mono text-xs font-semibold text-primary">
                          {asset.assetNumber}
                        </td>
                        <td className="py-3 px-4 font-medium">
                          <Link
                            href={`/inventory/assets/${asset.id}`}
                            className="hover:underline flex items-center gap-1.5"
                          >
                            {asset.name}
                          </Link>
                          {asset.vendor && (
                            <span className="text-xs text-muted-foreground block">
                              Vendor: {asset.vendor}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs text-muted-foreground">{asset.category}</td>
                        <td className="py-3 px-4 font-mono text-xs text-muted-foreground">
                          {asset.serialNumber || "-"}
                        </td>
                        <td className="py-3 px-4 text-xs">
                          {asset.currentHolder ? (
                            <span className="font-medium text-foreground">
                              {asset.currentHolder.fullName}
                            </span>
                          ) : (
                            <span className="text-muted-foreground italic">Gudang / Belum Ditugaskan</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs text-muted-foreground">
                          {asset.location || "-"}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge
                            variant="outline"
                            className={
                              asset.condition === "GOOD"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]"
                                : asset.condition === "FAIR"
                                ? "bg-blue-50 text-blue-700 border-blue-200 text-[10px]"
                                : asset.condition === "DAMAGED"
                                ? "bg-red-50 text-red-700 border-red-200 text-[10px]"
                                : asset.condition === "IN_REPAIR"
                                ? "bg-purple-50 text-purple-700 border-purple-200 text-[10px]"
                                : "bg-gray-100 text-gray-700 border-gray-300 text-[10px]"
                            }
                          >
                            {asset.condition}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-center">
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
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Link href={`/inventory/assets/${asset.id}`}>
                            <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs">
                              <Eye className="h-3.5 w-3.5" /> Detail & Mutasi
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal: Tambah Aset Baru */}
      <Dialog open={newAssetOpen} onOpenChange={setNewAssetOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Daftarkan Aset Operasional Baru</DialogTitle>
            <DialogDescription>
              Catat peralatan kerja baru seperti laptop, kendaraan, brankas, atau elektronik kantor.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateAsset} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="assetCategory">Kategori Aset *</Label>
                <select
                  id="assetCategory"
                  value={assetForm.category}
                  onChange={(e) => setAssetForm({ ...assetForm, category: e.target.value })}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  required
                >
                  {CATEGORIES.filter((c) => c !== "ALL").map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="assetNumber">Nomor / Kode Aset (Opsional)</Label>
                <Input
                  id="assetNumber"
                  placeholder="Otomatis jika dikosongkan"
                  value={assetForm.assetNumber}
                  onChange={(e) => setAssetForm({ ...assetForm, assetNumber: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="assetName">Nama & Tipe Aset *</Label>
              <Input
                id="assetName"
                placeholder="Contoh: Laptop Lenovo ThinkPad L14 Gen 4"
                value={assetForm.name}
                onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="serialNumber">Nomor Seri / Plat Nomor (S/N)</Label>
                <Input
                  id="serialNumber"
                  placeholder="Contoh: PF349B21 atau DK 4521 AA"
                  value={assetForm.serialNumber}
                  onChange={(e) => setAssetForm({ ...assetForm, serialNumber: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="purchasePrice">Harga Perolehan (Rp)</Label>
                <Input
                  id="purchasePrice"
                  type="number"
                  placeholder="Contoh: 16500000"
                  value={assetForm.purchasePrice}
                  onChange={(e) => setAssetForm({ ...assetForm, purchasePrice: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="purchaseDate">Tanggal Pembelian</Label>
                <Input
                  id="purchaseDate"
                  type="date"
                  value={assetForm.purchaseDate}
                  onChange={(e) => setAssetForm({ ...assetForm, purchaseDate: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="warrantyExpiry">Masa Berlaku Garansi Hingga</Label>
                <Input
                  id="warrantyExpiry"
                  type="date"
                  value={assetForm.warrantyExpiry}
                  onChange={(e) => setAssetForm({ ...assetForm, warrantyExpiry: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vendor">Vendor / Toko Penyedia</Label>
                <Input
                  id="vendor"
                  placeholder="Contoh: PT Sentra Pratama Komputer"
                  value={assetForm.vendor}
                  onChange={(e) => setAssetForm({ ...assetForm, vendor: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Lokasi Penempatan</Label>
                <Input
                  id="location"
                  placeholder="Contoh: Kantor Pusat - Ruang CS Lt. 1"
                  value={assetForm.location}
                  onChange={(e) => setAssetForm({ ...assetForm, location: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="holder">Serahkan Langsung ke Pemegang</Label>
                <select
                  id="holder"
                  value={assetForm.currentHolderId}
                  onChange={(e) => setAssetForm({ ...assetForm, currentHolderId: e.target.value })}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">-- Belum Ditugaskan / Simpan di Gudang --</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} {u.department ? `(${u.department.name})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="condition">Kondisi Awal</Label>
                <select
                  id="condition"
                  value={assetForm.condition}
                  onChange={(e) => setAssetForm({ ...assetForm, condition: e.target.value })}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="GOOD">GOOD (Baik / Baru)</option>
                  <option value="FAIR">FAIR (Cukup Baik)</option>
                  <option value="DAMAGED">DAMAGED (Rusak Ringan)</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Catatan Tambahan</Label>
              <Input
                id="notes"
                placeholder="Kelengkapan (charger, tas, STNK, dll)"
                value={assetForm.notes}
                onChange={(e) => setAssetForm({ ...assetForm, notes: e.target.value })}
              />
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setNewAssetOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? "Menyimpan..." : "Daftarkan Aset"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
