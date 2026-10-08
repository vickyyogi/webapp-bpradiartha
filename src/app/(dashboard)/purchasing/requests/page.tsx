"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileCheck,
  PlusCircle,
  Search,
  RefreshCw,
  Eye,
  Trash2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building,
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

export default function PurchaseRequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({ total: 0, submitted: 0, approved: 0, rejected: 0, totalAmount: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Create Modal
  const [newPrOpen, setNewPrOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [form, setForm] = useState({
    title: "",
    purpose: "",
    requiredDate: "",
    notes: "",
    items: [
      { itemName: "", category: "Formulir & Kertas", unit: "Rim", quantity: 1, estimatedPrice: 0, itemType: "INVENTORY" },
    ],
  });

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter !== "ALL") params.set("status", statusFilter);

      const res = await fetch(`/api/purchasing/requests?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests || []);
        setSummary(data.summary || {});
      }
    } catch (err) {
      console.error("Failed to load purchase requests:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [search, statusFilter]);

  const handleAddItemRow = () => {
    setForm({
      ...form,
      items: [
        ...form.items,
        { itemName: "", category: "ATK", unit: "Pcs", quantity: 1, estimatedPrice: 0, itemType: "INVENTORY" },
      ],
    });
  };

  const handleRemoveItemRow = (index: number) => {
    if (form.items.length <= 1) return;
    const newItems = form.items.filter((_, i) => i !== index);
    setForm({ ...form, items: newItems });
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const updated = [...form.items];
    updated[index] = { ...updated[index], [field]: value };
    setForm({ ...form, items: updated });
  };

  const calculateTotal = () => {
    return form.items.reduce(
      (sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.estimatedPrice) || 0),
      0
    );
  };

  const handleCreatePR = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setFeedbackMsg(null);
    try {
      const res = await fetch("/api/purchasing/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengajukan pengadaan.");

      setFeedbackMsg({ type: "success", text: "Pengajuan pengadaan barang (PR) berhasil diserahkan untuk proses approval!" });
      setNewPrOpen(false);
      setForm({
        title: "",
        purpose: "",
        requiredDate: "",
        notes: "",
        items: [
          { itemName: "", category: "Formulir & Kertas", unit: "Rim", quantity: 1, estimatedPrice: 0, itemType: "INVENTORY" },
        ],
      });
      fetchRequests();
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
            <Link href="/purchasing" className="hover:underline">
              Pengadaan
            </Link>
            <span>/</span>
            <span>Purchase Requests</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Pengajuan Pengadaan (Purchase Request)</h1>
          <p className="text-muted-foreground text-sm">
            Daftar usulan pengadaan barang, ATK, inventaris kantor, dan persetujuan bertingkat operasional.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={() => setNewPrOpen(true)} className="gap-2">
            <PlusCircle className="h-4 w-4" />
            Buat Pengajuan (PR) Baru
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

      {/* Filter and Search Bar */}
      <Card className="shadow-sm">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari nomor PR, judul pengadaan, pemohon..."
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
                <option value="ALL">Semua Status</option>
                <option value="SUBMITTED">SUBMITTED (Menunggu Approval)</option>
                <option value="APPROVED">APPROVED (Disetujui)</option>
                <option value="REJECTED">REJECTED (Ditolak)</option>
                <option value="DRAFT">DRAFT (Revisi)</option>
              </select>

              <Button variant="ghost" size="sm" onClick={fetchRequests} className="gap-1 text-xs">
                <RefreshCw className="h-3.5 w-3.5" /> Segarkan
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold">Daftar Pengajuan Pengadaan</CardTitle>
          <CardDescription>Menampilkan {requests.length} pengajuan pengadaan barang & jasa</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Memuat pengajuan pengadaan...</div>
          ) : requests.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground bg-muted/20 rounded-lg">
              Tidak ada data pengajuan pengadaan yang sesuai kriteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground text-left bg-muted/30">
                    <th className="py-3 px-4 font-semibold">No. PR</th>
                    <th className="py-3 px-4 font-semibold">Judul & Urgensi</th>
                    <th className="py-3 px-4 font-semibold">Pemohon</th>
                    <th className="py-3 px-4 font-semibold">Divisi / Bagian</th>
                    <th className="py-3 px-4 font-semibold text-right">Estimasi Biaya</th>
                    <th className="py-3 px-4 font-semibold text-center">Status Approval</th>
                    <th className="py-3 px-4 font-semibold text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {requests.map((pr) => (
                    <tr key={pr.id} className="hover:bg-muted/40 transition-colors">
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-primary">
                        {pr.requestNumber}
                      </td>
                      <td className="py-3 px-4 font-medium">
                        <Link href={`/purchasing/requests/${pr.id}`} className="hover:underline">
                          {pr.title}
                        </Link>
                        <span className="text-xs text-muted-foreground block truncate max-w-sm">
                          {pr.purpose}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <span className="font-medium text-foreground">{pr.requester?.fullName}</span>
                      </td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">
                        {pr.department?.name || "Operasional Umum"}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-xs">
                        Rp {pr.totalEstimatedAmount?.toLocaleString("id-ID")}
                      </td>
                      <td className="py-3 px-4 text-center">
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
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link href={`/purchasing/requests/${pr.id}`}>
                          <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs">
                            <Eye className="h-3.5 w-3.5" /> Detail & Approval
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal: Buat Pengajuan (PR) Baru */}
      <Dialog open={newPrOpen} onOpenChange={setNewPrOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Formulir Pengajuan Pengadaan (Purchase Request)</DialogTitle>
            <DialogDescription>
              Isi kebutuhan barang/jasa operasional. Pengajuan akan diproses melalui alur persetujuan pejabat berwenang.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreatePR} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="prTitle">Judul Pengadaan *</Label>
              <Input
                id="prTitle"
                placeholder="Contoh: Pengadaan Kertas HVS & Toner Triwulan II"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prRequiredDate">Tanggal Dibutuhkan</Label>
                <Input
                  id="prRequiredDate"
                  type="date"
                  value={form.requiredDate}
                  onChange={(e) => setForm({ ...form, requiredDate: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="prNotes">Catatan / Rekomendasi Vendor</Label>
                <Input
                  id="prNotes"
                  placeholder="Contoh: Rekanan langganan CV Bali Grafika"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="prPurpose">Keperluan & Alasan Urgensi *</Label>
              <Input
                id="prPurpose"
                placeholder="Jelaskan tujuan dan dampak operasional pengadaan ini"
                value={form.purpose}
                onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                required
              />
            </div>

            {/* Dynamic Items Rows */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between border-b pb-2">
                <Label className="font-bold text-sm">Rincian Barang yang Diminta</Label>
                <Button type="button" variant="outline" size="sm" onClick={handleAddItemRow} className="gap-1 text-xs">
                  <PlusCircle className="h-3.5 w-3.5" /> Tambah Baris
                </Button>
              </div>

              <div className="space-y-3">
                {form.items.map((item, idx) => (
                  <div key={idx} className="p-3 rounded-lg border bg-muted/30 grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-5 space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Nama Barang *</Label>
                      <Input
                        placeholder="Nama spesifikasi barang"
                        value={item.itemName}
                        onChange={(e) => handleItemChange(idx, "itemName", e.target.value)}
                        className="h-8 text-xs"
                        required
                      />
                    </div>

                    <div className="col-span-2 space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Satuan</Label>
                      <Input
                        placeholder="Rim/Box/Pcs"
                        value={item.unit}
                        onChange={(e) => handleItemChange(idx, "unit", e.target.value)}
                        className="h-8 text-xs"
                        required
                      />
                    </div>

                    <div className="col-span-2 space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Qty</Label>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(idx, "quantity", Number(e.target.value))}
                        className="h-8 text-xs"
                        required
                      />
                    </div>

                    <div className="col-span-2 space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Est. Harga (Rp)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={item.estimatedPrice}
                        onChange={(e) => handleItemChange(idx, "estimatedPrice", Number(e.target.value))}
                        className="h-8 text-xs"
                        required
                      />
                    </div>

                    <div className="col-span-1 pt-4 text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveItemRow(idx)}
                        disabled={form.items.length <= 1}
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 rounded-lg bg-card border flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Total Estimasi Anggaran:</span>
                <span className="text-base font-extrabold font-mono text-primary">
                  Rp {calculateTotal().toLocaleString("id-ID")}
                </span>
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setNewPrOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? "Mengajukan..." : "Ajukan Pengadaan (Submit PR)"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
