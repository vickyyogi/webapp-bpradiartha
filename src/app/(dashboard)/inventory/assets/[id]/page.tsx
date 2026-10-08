"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Laptop,
  ArrowLeft,
  UserCheck,
  Wrench,
  AlertTriangle,
  History,
  ShieldCheck,
  Calendar,
  DollarSign,
  MapPin,
  Tag,
  Share2,
  Trash2,
  CheckCircle2,
  Clock,
  RefreshCw,
  FileText,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function AssetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [asset, setAsset] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"history" | "maintenance">("history");
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Modal State: Assignment / Transfer
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [transferForm, setTransferForm] = useState({
    actionType: "TRANSFER",
    toHolderId: "",
    toLocation: "",
    notes: "",
  });

  // Modal State: Maintenance
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const [savingMaintenance, setSavingMaintenance] = useState(false);
  const [maintenanceForm, setMaintenanceForm] = useState({
    title: "",
    description: "",
    cost: "",
    vendor: "",
    technician: "",
    startDate: new Date().toISOString().split("T")[0],
    completionDate: "",
    maintenanceStatus: "IN_PROGRESS",
    newCondition: "IN_REPAIR",
    notes: "",
  });

  // Modal State: Disposal
  const [disposalOpen, setDisposalOpen] = useState(false);
  const [disposing, setDisposing] = useState(false);
  const [disposalForm, setDisposalForm] = useState({
    reason: "",
    approvalReference: "",
    notes: "",
  });

  const fetchAsset = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/assets/${id}`);
      if (!res.ok) {
        throw new Error("Gagal mengambil data aset.");
      }
      const data = await res.json();
      setAsset(data.asset);
    } catch (err: any) {
      console.error(err);
      setFeedbackMsg({ type: "error", text: err.message });
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
    if (id) {
      fetchAsset();
      fetchUsers();
    }
  }, [id]);

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setTransferring(true);
    setFeedbackMsg(null);
    try {
      const res = await fetch(`/api/assets/${id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(transferForm),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mencatat mutasi aset.");

      setFeedbackMsg({ type: "success", text: data.message || "Mutasi aset berhasil dicatat!" });
      setTransferOpen(false);
      fetchAsset();
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.message });
    } finally {
      setTransferring(false);
    }
  };

  const handleMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingMaintenance(true);
    setFeedbackMsg(null);
    try {
      const res = await fetch(`/api/assets/${id}/maintenance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(maintenanceForm),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mencatat pemeliharaan.");

      setFeedbackMsg({ type: "success", text: "Data pemeliharaan berhasil dicatat!" });
      setMaintenanceOpen(false);
      fetchAsset();
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.message });
    } finally {
      setSavingMaintenance(false);
    }
  };

  const handleDisposal = async (e: React.FormEvent) => {
    e.preventDefault();
    setDisposing(true);
    setFeedbackMsg(null);
    try {
      const res = await fetch(`/api/assets/${id}/dispose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(disposalForm),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghapusbukukan aset.");

      setFeedbackMsg({ type: "success", text: "Aset berhasil dihapusbukukan (Disposed)!" });
      setDisposalOpen(false);
      fetchAsset();
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.message });
    } finally {
      setDisposing(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Memuat data aset...</div>;
  }

  if (!asset) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-red-600 font-semibold">Aset tidak ditemukan.</p>
        <Link href="/inventory/assets">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Kembali ke Daftar Aset
          </Button>
        </Link>
      </div>
    );
  }

  const isDisposed = asset.status === "DISPOSED";

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
            <Link href="/inventory/assets" className="hover:underline">
              Aset Operasional
            </Link>
            <span>/</span>
            <span className="font-mono">{asset.assetNumber}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{asset.name}</h1>
            <span className="text-xs font-mono bg-muted text-muted-foreground px-2 py-1 rounded">
              {asset.assetNumber}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/inventory/assets">
            <Button variant="outline" size="sm" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" /> Kembali
            </Button>
          </Link>

          {!isDisposed && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setTransferForm({
                    actionType: asset.currentHolder ? "TRANSFER" : "ASSIGNMENT",
                    toHolderId: "",
                    toLocation: asset.location || "",
                    notes: "",
                  });
                  setTransferOpen(true);
                }}
                className="gap-1.5 text-blue-700 border-blue-200 hover:bg-blue-50"
              >
                <Share2 className="h-4 w-4" /> Mutasi / Serah Terima
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setMaintenanceForm({
                    title: "",
                    description: "",
                    cost: "",
                    vendor: asset.vendor || "",
                    technician: "",
                    startDate: new Date().toISOString().split("T")[0],
                    completionDate: "",
                    maintenanceStatus: "IN_PROGRESS",
                    newCondition: "IN_REPAIR",
                    notes: "",
                  });
                  setMaintenanceOpen(true);
                }}
                className="gap-1.5 text-purple-700 border-purple-200 hover:bg-purple-50"
              >
                <Wrench className="h-4 w-4" /> Servis / Pemeliharaan
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setDisposalForm({ reason: "", approvalReference: "", notes: "" });
                  setDisposalOpen(true);
                }}
                className="gap-1.5 text-red-700 border-red-200 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" /> Hapus Buku (Disposal)
              </Button>
            </>
          )}
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

      {/* Status Warning if Disposed */}
      {isDisposed && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
          <div className="text-sm">
            <span className="font-bold">Aset ini telah Dihapusbukukan (Disposed).</span> Aset tidak lagi beroperasi
            aktif dan riwayat mutasi telah ditutup untuk pencatatan inventaris resmi.
          </div>
        </div>
      )}

      {/* Overview Top Info */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Status Card */}
        <Card className="border-l-4 border-l-primary shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Status & Kondisi
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={
                  asset.status === "ASSIGNED"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-xs px-2.5 py-0.5"
                    : asset.status === "MAINTENANCE"
                    ? "bg-purple-50 text-purple-700 border-purple-200 text-xs px-2.5 py-0.5"
                    : asset.status === "DISPOSED"
                    ? "bg-gray-100 text-gray-700 border-gray-300 text-xs px-2.5 py-0.5"
                    : "bg-blue-50 text-blue-700 border-blue-200 text-xs px-2.5 py-0.5"
                }
              >
                {asset.status}
              </Badge>
              <Badge
                variant="outline"
                className={
                  asset.condition === "GOOD"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-xs"
                    : asset.condition === "FAIR"
                    ? "bg-blue-50 text-blue-700 border-blue-200 text-xs"
                    : asset.condition === "DAMAGED"
                    ? "bg-red-50 text-red-700 border-red-200 text-xs"
                    : "bg-purple-50 text-purple-700 border-purple-200 text-xs"
                }
              >
                Kondisi: {asset.condition}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">Kategori: {asset.category}</p>
          </CardContent>
        </Card>

        {/* Current Holder Card */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Pemegang / Penanggung Jawab
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {asset.currentHolder ? (
              <div>
                <div className="text-base font-bold flex items-center gap-1.5 text-foreground">
                  <UserCheck className="h-4 w-4 text-emerald-600" />
                  {asset.currentHolder.fullName}
                </div>
                <p className="text-xs text-muted-foreground">{asset.currentHolder.email}</p>
              </div>
            ) : (
              <div>
                <div className="text-sm font-semibold text-muted-foreground italic">
                  Belum Ditugaskan / Gudang
                </div>
                <p className="text-xs text-muted-foreground">Siap diserahterimakan</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Location & Specs */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Lokasi & No. Seri
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-sm font-semibold flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              {asset.location || "Kantor Pusat BPR"}
            </div>
            <p className="text-xs font-mono text-muted-foreground">
              S/N: <span className="font-semibold text-foreground">{asset.serialNumber || "-"}</span>
            </p>
          </CardContent>
        </Card>

        {/* Procurement & Warranty */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Perolehan & Garansi
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-sm font-bold font-mono">
              {asset.purchasePrice ? `Rp ${asset.purchasePrice.toLocaleString("id-ID")}` : "-"}
            </div>
            <p className="text-xs text-muted-foreground">
              Garansi:{" "}
              {asset.warrantyExpiry
                ? new Date(asset.warrantyExpiry).toLocaleDateString("id-ID", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })
                : "Tidak ada data"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Lifecycle Mutasi vs Pemeliharaan */}
      <div className="space-y-4">
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab("history")}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === "history"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <History className="h-4 w-4" />
            Riwayat Serah Terima & Mutasi ({asset.histories?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab("maintenance")}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === "maintenance"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Wrench className="h-4 w-4" />
            Riwayat Pemeliharaan & Servis ({asset.maintenances?.length || 0})
          </button>
        </div>

        {/* Tab 1: Riwayat Mutasi */}
        {activeTab === "history" && (
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">Jejak Riwayat Siklus Hidup Aset</CardTitle>
              <CardDescription>
                Pelacakan serah terima antar karyawan, mutasi antar lokasi cabang, dan perubahan status operasional.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {asset.histories?.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground bg-muted/20 rounded-lg">
                  Belum ada catatan mutasi.
                </div>
              ) : (
                <div className="relative pl-6 border-l-2 border-muted space-y-6">
                  {asset.histories.map((h: any) => (
                    <div key={h.id} className="relative group">
                      {/* Timeline dot */}
                      <div className="absolute -left-[31px] top-1 h-4 w-4 rounded-full border-2 border-background bg-primary" />

                      <div className="p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-primary">{h.action}</span>
                            {h.status && (
                              <Badge variant="outline" className="text-[10px]">
                                {h.status}
                              </Badge>
                            )}
                            {h.condition && (
                              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                Kondisi: {h.condition}
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(h.createdAt).toLocaleDateString("id-ID", {
                              day: "2-digit",
                              month: "long",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>

                        {/* Movement details */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-muted/40 p-2.5 rounded">
                          <div>
                            <span className="text-muted-foreground">Dari Pemegang:</span>{" "}
                            <span className="font-medium">{h.fromHolderName || "Gudang / Pembelian Baru"}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Ke Pemegang:</span>{" "}
                            <span className="font-medium text-emerald-700">
                              {h.toHolderName || "Gudang / Disimpan"}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Lokasi Awal:</span>{" "}
                            <span>{h.fromLocation || "-"}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Lokasi Tujuan:</span>{" "}
                            <span className="font-medium">{h.toLocation || "-"}</span>
                          </div>
                        </div>

                        {h.notes && <p className="text-xs text-foreground/90 italic">"{h.notes}"</p>}

                        <div className="text-[11px] text-muted-foreground text-right pt-1">
                          Dicatat oleh: <span className="font-medium">{h.performedBy?.fullName || "Sistem"}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tab 2: Riwayat Pemeliharaan */}
        {activeTab === "maintenance" && (
          <Card className="shadow-sm">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold">Catatan Pemeliharaan & Perbaikan</CardTitle>
                <CardDescription>
                  Daftar servis berkala, perbaikan sparepart, dan biaya perawatan aset
                </CardDescription>
              </div>
              {!isDisposed && (
                <Button
                  size="sm"
                  onClick={() => setMaintenanceOpen(true)}
                  className="gap-1.5 text-xs bg-purple-600 hover:bg-purple-700"
                >
                  <Wrench className="h-3.5 w-3.5" /> Catat Servis Baru
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {asset.maintenances?.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground bg-muted/20 rounded-lg">
                  Belum ada catatan pemeliharaan atau perbaikan untuk aset ini.
                </div>
              ) : (
                <div className="space-y-4">
                  {asset.maintenances.map((m: any) => (
                    <div
                      key={m.id}
                      className="p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 border-b pb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-foreground">{m.title}</span>
                          <Badge
                            variant="outline"
                            className={
                              m.status === "COMPLETED"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]"
                                : m.status === "IN_PROGRESS"
                                ? "bg-purple-50 text-purple-700 border-purple-200 text-[10px]"
                                : "bg-blue-50 text-blue-700 border-blue-200 text-[10px]"
                            }
                          >
                            {m.status}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          Mulai:{" "}
                          {m.startDate
                            ? new Date(m.startDate).toLocaleDateString("id-ID", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })
                            : "-"}
                          {m.completionDate &&
                            ` • Selesai: ${new Date(m.completionDate).toLocaleDateString("id-ID", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}`}
                        </span>
                      </div>

                      {m.description && <p className="text-xs text-muted-foreground">{m.description}</p>}

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-muted/40 p-2.5 rounded">
                        <div>
                          <span className="text-muted-foreground">Vendor/Bengkel:</span>{" "}
                          <span className="font-medium">{m.vendor || "-"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Teknisi:</span>{" "}
                          <span className="font-medium">{m.technician || "-"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Biaya Servis:</span>{" "}
                          <span className="font-bold font-mono text-foreground">
                            {m.cost ? `Rp ${m.cost.toLocaleString("id-ID")}` : "Rp 0"}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Petugas Input:</span>{" "}
                          <span>{m.performedBy?.fullName || "Sistem"}</span>
                        </div>
                      </div>

                      {m.notes && <p className="text-xs italic text-foreground/80">Catatan: {m.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modal: Mutasi / Serah Terima Aset */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Mutasi / Serah Terima Aset</DialogTitle>
            <DialogDescription>
              Alihkan pemegang aset atau kembalikan aset ke inventaris gudang kantor.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleTransfer} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="actionType">Jenis Mutasi *</Label>
              <select
                id="actionType"
                value={transferForm.actionType}
                onChange={(e) => setTransferForm({ ...transferForm, actionType: e.target.value })}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="TRANSFER">🔄 Mutasi Antar Pemegang / Unit Kerja</option>
                <option value="ASSIGNMENT">🤝 Serah Terima ke Pemegang Baru</option>
                <option value="RETURN">📦 Pengembalian ke Gudang BPR</option>
              </select>
            </div>

            {transferForm.actionType !== "RETURN" && (
              <div className="space-y-2">
                <Label htmlFor="toHolder">Penerima Baru / Pemegang *</Label>
                <select
                  id="toHolder"
                  value={transferForm.toHolderId}
                  onChange={(e) => setTransferForm({ ...transferForm, toHolderId: e.target.value })}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  required={transferForm.actionType !== "RETURN"}
                >
                  <option value="">-- Pilih Staf Penerima --</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} {u.department ? `(${u.department.name})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="toLocation">Lokasi Baru</Label>
              <Input
                id="toLocation"
                placeholder="Contoh: Kantor Cabang Renon / Meja Analis"
                value={transferForm.toLocation}
                onChange={(e) => setTransferForm({ ...transferForm, toLocation: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="transferNotes">Alasan / Catatan Berita Acara</Label>
              <Input
                id="transferNotes"
                placeholder="Contoh: Penugasan perangkat kerja analis baru"
                value={transferForm.notes}
                onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
              />
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setTransferOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={transferring}>
                {transferring ? "Memproses..." : "Simpan Mutasi"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Catat Pemeliharaan / Servis */}
      <Dialog open={maintenanceOpen} onOpenChange={setMaintenanceOpen}>
        <DialogContent className="sm:max-w-[540px]">
          <DialogHeader>
            <DialogTitle>Catat Servis & Pemeliharaan Aset</DialogTitle>
            <DialogDescription>
              Aset: <strong>{asset.name}</strong> ({asset.assetNumber})
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleMaintenance} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="mTitle">Uraian Pekerjaan / Servis *</Label>
              <Input
                id="mTitle"
                placeholder="Contoh: Ganti Aki & Servis 15.000 KM atau Servis Printhead"
                value={maintenanceForm.title}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, title: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mStatus">Status Pemeliharaan</Label>
                <select
                  id="mStatus"
                  value={maintenanceForm.maintenanceStatus}
                  onChange={(e) =>
                    setMaintenanceForm({
                      ...maintenanceForm,
                      maintenanceStatus: e.target.value,
                      newCondition: e.target.value === "COMPLETED" ? "GOOD" : "IN_REPAIR",
                    })
                  }
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="IN_PROGRESS">Sedang Dikerjakan (In Progress)</option>
                  <option value="SCHEDULED">Dijadwalkan (Scheduled)</option>
                  <option value="COMPLETED">Selesai (Completed)</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mCost">Estimasi / Biaya Riil (Rp)</Label>
                <Input
                  id="mCost"
                  type="number"
                  placeholder="Contoh: 350000"
                  value={maintenanceForm.cost}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, cost: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mVendor">Bengkel / Vendor Service</Label>
                <Input
                  id="mVendor"
                  placeholder="Contoh: AHASS Astra Motor"
                  value={maintenanceForm.vendor}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, vendor: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mTech">Nama Teknisi</Label>
                <Input
                  id="mTech"
                  placeholder="Contoh: Bpk. Made"
                  value={maintenanceForm.technician}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, technician: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mDesc">Keterangan Tambahan / Detail Kerusakan</Label>
              <Input
                id="mDesc"
                placeholder="Part yang diganti atau rekomendasi teknisi"
                value={maintenanceForm.description}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, description: e.target.value })}
              />
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setMaintenanceOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={savingMaintenance}>
                {savingMaintenance ? "Menyimpan..." : "Simpan Pemeliharaan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Disposal Aset */}
      <Dialog open={disposalOpen} onOpenChange={setDisposalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Penghapusan Buku Aset (Disposal)
            </DialogTitle>
            <DialogDescription>
              Tindakan ini akan menghentikan masa operasional aset <strong>{asset.name}</strong> secara permanen.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleDisposal} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="dispReason">Alasan Penghapusan (Disposal) *</Label>
              <select
                id="dispReason"
                value={disposalForm.reason}
                onChange={(e) => setDisposalForm({ ...disposalForm, reason: e.target.value })}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                required
              >
                <option value="">-- Pilih Alasan --</option>
                <option value="Rusak Berat (Tidak Ekonomis Diperbaiki)">
                  Rusak Berat (Biaya perbaikan melebihi nilai ekonomis)
                </option>
                <option value="Usang / Kadaluarsa Teknologi (Obsolete)">
                  Usang / Kadaluarsa Teknologi (Obsolete)
                </option>
                <option value="Hilang / Force Majeure">Hilang / Force Majeure</option>
                <option value="Dijual / Dilelang">Dijual / Dilelang</option>
                <option value="Dihibahkan">Dihibahkan</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dispRef">Nomor SK / Berita Acara Approval Direksi</Label>
              <Input
                id="dispRef"
                placeholder="Contoh: SK-DIR-DISP/2026/012"
                value={disposalForm.approvalReference}
                onChange={(e) => setDisposalForm({ ...disposalForm, approvalReference: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dispNotes">Catatan / Keterangan Tambahan</Label>
              <Input
                id="dispNotes"
                placeholder="Rincian kondisi fisik terakhir"
                value={disposalForm.notes}
                onChange={(e) => setDisposalForm({ ...disposalForm, notes: e.target.value })}
              />
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setDisposalOpen(false)}>
                Batal
              </Button>
              <Button type="submit" variant="destructive" disabled={disposing}>
                {disposing ? "Memproses..." : "Konfirmasi Hapus Buku"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
