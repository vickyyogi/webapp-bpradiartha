"use client";

import { useState } from "react";
import { PlusCircle, Search, Phone, User, Calendar, Tag, MoreVertical, Edit2, Trash2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type Lead = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  source: string;
  productInterest: string | null;
  status: "NEW" | "CONTACTED" | "QUALIFIED" | "APPLICATION" | "CONVERTED";
  assignedOfficerId: string | null;
  branchId: string | null;
  notes: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  branch?: { id: string; name: string } | null;
  assignedOfficer?: { id: string; fullName: string } | null;
};

type UserOption = {
  id: string;
  fullName: string;
  email: string;
};

type BranchOption = {
  id: string;
  name: string;
  code: string;
};

interface Props {
  initialLeads: Lead[];
  officers: UserOption[];
  branches: BranchOption[];
}

const STATUS_CONFIG: Record<
  Lead["status"],
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" | "purple" }
> = {
  NEW: { label: "Baru (New)", variant: "info" },
  CONTACTED: { label: "Dihubungi (Contacted)", variant: "warning" },
  QUALIFIED: { label: "Memenuhi Syarat (Qualified)", variant: "purple" },
  APPLICATION: { label: "Pengajuan Kredit (Application)", variant: "secondary" },
  CONVERTED: { label: "Konversi Sukses (Converted)", variant: "success" },
};

const LEAD_SOURCES = [
  "Website",
  "Marketing",
  "Referral",
  "Walk-in",
  "Event",
  "WhatsApp",
  "Media Sosial",
  "Lainnya",
];

const PRODUCT_INTERESTS = [
  "Kredit Modal Kerja",
  "Kredit Investasi",
  "Kredit Konsumtif / Multiguna",
  "Kredit Pegawai / Payroll",
  "Tabungan BPR",
  "Deposito Berjangka",
  "Lainnya",
];

export function LeadsClientView({ initialLeads, officers, branches }: Props) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    address: "",
    source: "Website",
    productInterest: "Kredit Modal Kerja",
    status: "NEW" as Lead["status"],
    assignedOfficerId: officers[0]?.id || "",
    branchId: branches[0]?.id || "",
    notes: "",
  });

  const resetForm = () => {
    setFormData({
      name: "",
      phone: "",
      address: "",
      source: "Website",
      productInterest: "Kredit Modal Kerja",
      status: "NEW",
      assignedOfficerId: officers[0]?.id || "",
      branchId: branches[0]?.id || "",
      notes: "",
    });
    setErrorMessage("");
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (lead: Lead) => {
    setEditingLead(lead);
    setFormData({
      name: lead.name,
      phone: lead.phone || "",
      address: lead.address || "",
      source: lead.source,
      productInterest: lead.productInterest || "Kredit Modal Kerja",
      status: lead.status,
      assignedOfficerId: lead.assignedOfficerId || "",
      branchId: lead.branchId || branches[0]?.id || "",
      notes: lead.notes || "",
    });
    setErrorMessage("");
    setIsEditModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setErrorMessage("Nama calon nasabah wajib diisi.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage("");

      const res = await fetch("/api/crm/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Gagal menambahkan data prospek");
      }

      setLeads([result.data, ...leads]);
      setIsAddModalOpen(false);
      resetForm();
    } catch (err: any) {
      setErrorMessage(err.message || "Terjadi kesalahan saat menyimpan data");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLead) return;
    if (!formData.name.trim()) {
      setErrorMessage("Nama calon nasabah wajib diisi.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage("");

      const res = await fetch(`/api/crm/leads/${editingLead.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Gagal memperbarui data prospek");
      }

      setLeads(leads.map((l) => (l.id === editingLead.id ? result.data : l)));
      setIsEditModalOpen(false);
      setEditingLead(null);
    } catch (err: any) {
      setErrorMessage(err.message || "Terjadi kesalahan saat memperbarui data");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickStatusChange = async (leadId: string, newStatus: Lead["status"]) => {
    try {
      const res = await fetch(`/api/crm/leads/${leadId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      const result = await res.json();
      if (res.ok) {
        setLeads(leads.map((l) => (l.id === leadId ? result.data : l)));
      }
    } catch (err) {
      console.error("Gagal mengubah status lead:", err);
    }
  };

  const handleDelete = async (leadId: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus data prospek ini?")) return;

    try {
      const res = await fetch(`/api/crm/leads/${leadId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setLeads(leads.filter((l) => l.id !== leadId));
      }
    } catch (err) {
      console.error("Gagal menghapus lead:", err);
    }
  };

  // Filtered Leads
  const filteredLeads = leads.filter((lead) => {
    const matchesStatus = statusFilter === "ALL" || lead.status === statusFilter;
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      lead.name.toLowerCase().includes(query) ||
      (lead.phone && lead.phone.toLowerCase().includes(query)) ||
      (lead.productInterest && lead.productInterest.toLowerCase().includes(query)) ||
      lead.source.toLowerCase().includes(query);

    return matchesStatus && matchesSearch;
  });

  // KPI Metrics
  const totalCount = leads.length;
  const newCount = leads.filter((l) => l.status === "NEW").length;
  const contactedCount = leads.filter((l) => l.status === "CONTACTED").length;
  const qualifiedCount = leads.filter((l) => l.status === "QUALIFIED").length;
  const convertedCount = leads.filter((l) => l.status === "CONVERTED" || l.status === "APPLICATION").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manajemen Prospek Nasabah (Leads)</h1>
          <p className="text-muted-foreground mt-1">
            Pantau dan kelola siklus prospek calon debitur BPR dari tahap awal hingga pengajuan kredit.
          </p>
        </div>
        <Button onClick={handleOpenAdd} className="gap-2">
          <PlusCircle className="h-4 w-4" /> Tambah Prospek Baru
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Total Prospek</CardDescription>
            <CardTitle className="text-2xl font-bold">{totalCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Baru (New)</CardDescription>
            <CardTitle className="text-2xl font-bold text-blue-600">{newCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-yellow-500">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Dihubungi</CardDescription>
            <CardTitle className="text-2xl font-bold text-yellow-600">{contactedCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Memenuhi Syarat</CardDescription>
            <CardTitle className="text-2xl font-bold text-purple-600">{qualifiedCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Aplikasi / Konversi</CardDescription>
            <CardTitle className="text-2xl font-bold text-green-600">{convertedCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-card p-4 rounded-xl border">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari nama, nomor HP, atau produk..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs font-medium text-muted-foreground mr-1">Status:</span>
          {["ALL", "NEW", "CONTACTED", "QUALIFIED", "APPLICATION", "CONVERTED"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                statusFilter === st
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {st === "ALL" ? "Semua" : STATUS_CONFIG[st as Lead["status"]]?.label.split(" ")[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Table Card */}
      <Card>
        <CardHeader>
          <CardTitle>Daftar Calon Debitur ({filteredLeads.length})</CardTitle>
          <CardDescription>
            Klik pada status untuk langsung memperbarui tahapan prospek nasabah.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Calon Nasabah</TableHead>
                  <TableHead>Sumber & Minat Produk</TableHead>
                  <TableHead>Kantor / Petugas AO</TableHead>
                  <TableHead>Tahapan Status</TableHead>
                  <TableHead>Tanggal Input</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      Tidak ada data prospek yang sesuai filter pencarian.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLeads.map((lead) => (
                    <TableRow key={lead.id}>
                      {/* Name & Phone */}
                      <TableCell>
                        <div className="font-semibold text-foreground">{lead.name}</div>
                        {lead.phone && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Phone className="h-3 w-3 text-primary" />
                            <a
                              href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, "")}`}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:underline text-primary"
                            >
                              {lead.phone}
                            </a>
                          </div>
                        )}
                        {lead.address && (
                          <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                            {lead.address}
                          </div>
                        )}
                      </TableCell>

                      {/* Source & Product */}
                      <TableCell>
                        <div className="font-medium text-sm text-foreground">
                          {lead.productInterest || "Belum ditentukan"}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Tag className="h-3 w-3" />
                          <span>Sumber: {lead.source}</span>
                        </div>
                      </TableCell>

                      {/* Branch & AO */}
                      <TableCell>
                        <div className="text-sm font-medium">
                          {lead.branch?.name || "Pusat"}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <User className="h-3 w-3" />
                          <span>AO: {lead.assignedOfficer?.fullName || "Belum ditugaskan"}</span>
                        </div>
                      </TableCell>

                      {/* Status with Quick Select */}
                      <TableCell>
                        <select
                          value={lead.status}
                          onChange={(e) =>
                            handleQuickStatusChange(lead.id, e.target.value as Lead["status"])
                          }
                          className="text-xs font-semibold rounded-md border bg-background px-2 py-1 outline-none cursor-pointer focus:ring-2 focus:ring-primary"
                        >
                          <option value="NEW">🔵 Baru (New)</option>
                          <option value="CONTACTED">🟡 Dihubungi (Contacted)</option>
                          <option value="QUALIFIED">🟣 Memenuhi Syarat (Qualified)</option>
                          <option value="APPLICATION">🟠 Pengajuan (Application)</option>
                          <option value="CONVERTED">🟢 Konversi (Converted)</option>
                        </select>
                      </TableCell>

                      {/* Created At */}
                      <TableCell className="text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(lead.createdAt).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </div>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(lead)}
                            title="Edit Prospek"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(lead.id)}
                            className="text-destructive hover:bg-destructive/10"
                            title="Hapus Prospek"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Modal Dialog: Tambah Prospek Baru */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleCreateSubmit}>
            <DialogHeader>
              <DialogTitle>Tambah Calon Nasabah (Lead)</DialogTitle>
              <DialogDescription>
                Masukkan informasi calon nasabah untuk ditindaklanjuti oleh Account Officer.
              </DialogDescription>
            </DialogHeader>

            {errorMessage && (
              <div className="mt-3 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                {errorMessage}
              </div>
            )}

            <div className="grid gap-3 py-4 text-sm">
              <div>
                <label className="font-medium text-xs text-foreground block mb-1">
                  Nama Lengkap Calon Nasabah *
                </label>
                <Input
                  required
                  placeholder="Contoh: I Wayan Sudarta"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-xs text-foreground block mb-1">
                    Nomor Telepon / WhatsApp
                  </label>
                  <Input
                    placeholder="Contoh: 08123456789"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>

                <div>
                  <label className="font-medium text-xs text-foreground block mb-1">
                    Sumber Prospek (Lead Source) *
                  </label>
                  <select
                    className="w-full h-8 rounded-lg border border-input bg-transparent px-2.5 text-xs outline-none focus:ring-2 focus:ring-primary"
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  >
                    {LEAD_SOURCES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="font-medium text-xs text-foreground block mb-1">
                  Minat Produk
                </label>
                <select
                  className="w-full h-8 rounded-lg border border-input bg-transparent px-2.5 text-xs outline-none focus:ring-2 focus:ring-primary"
                  value={formData.productInterest}
                  onChange={(e) => setFormData({ ...formData, productInterest: e.target.value })}
                >
                  {PRODUCT_INTERESTS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-xs text-foreground block mb-1">
                    Kantor Cabang
                  </label>
                  <select
                    className="w-full h-8 rounded-lg border border-input bg-transparent px-2.5 text-xs outline-none focus:ring-2 focus:ring-primary"
                    value={formData.branchId}
                    onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-medium text-xs text-foreground block mb-1">
                    Petugas AO (Assigned Officer)
                  </label>
                  <select
                    className="w-full h-8 rounded-lg border border-input bg-transparent px-2.5 text-xs outline-none focus:ring-2 focus:ring-primary"
                    value={formData.assignedOfficerId}
                    onChange={(e) =>
                      setFormData({ ...formData, assignedOfficerId: e.target.value })
                    }
                  >
                    <option value="">-- Pilih Petugas --</option>
                    {officers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="font-medium text-xs text-foreground block mb-1">
                  Alamat Calon Nasabah
                </label>
                <Input
                  placeholder="Jl. Raya No. 123, Denpasar"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>

              <div>
                <label className="font-medium text-xs text-foreground block mb-1">
                  Catatan Prospek / Kebutuhan Dana
                </label>
                <textarea
                  rows={2}
                  className="w-full rounded-lg border border-input bg-transparent p-2 text-xs outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Contoh: Butuh pinjaman modal usaha warung sembako Rp 50.000.000, jaminan BPKB motor."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddModalOpen(false)}
                disabled={isSubmitting}
              >
                Batal
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Menyimpan..." : "Simpan Prospek"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Dialog: Edit Prospek */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleUpdateSubmit}>
            <DialogHeader>
              <DialogTitle>Edit Data Prospek</DialogTitle>
              <DialogDescription>Perbarui data dan status prospek nasabah.</DialogDescription>
            </DialogHeader>

            {errorMessage && (
              <div className="mt-3 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                {errorMessage}
              </div>
            )}

            <div className="grid gap-3 py-4 text-sm">
              <div>
                <label className="font-medium text-xs text-foreground block mb-1">
                  Nama Lengkap Calon Nasabah *
                </label>
                <Input
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-xs text-foreground block mb-1">
                    Nomor Telepon / WhatsApp
                  </label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>

                <div>
                  <label className="font-medium text-xs text-foreground block mb-1">
                    Sumber Prospek
                  </label>
                  <select
                    className="w-full h-8 rounded-lg border border-input bg-transparent px-2.5 text-xs outline-none focus:ring-2 focus:ring-primary"
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  >
                    {LEAD_SOURCES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-xs text-foreground block mb-1">
                    Minat Produk
                  </label>
                  <select
                    className="w-full h-8 rounded-lg border border-input bg-transparent px-2.5 text-xs outline-none focus:ring-2 focus:ring-primary"
                    value={formData.productInterest}
                    onChange={(e) =>
                      setFormData({ ...formData, productInterest: e.target.value })
                    }
                  >
                    {PRODUCT_INTERESTS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-medium text-xs text-foreground block mb-1">
                    Tahapan Status (Lifecycle)
                  </label>
                  <select
                    className="w-full h-8 rounded-lg border border-input bg-transparent px-2.5 text-xs outline-none focus:ring-2 focus:ring-primary"
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value as Lead["status"] })
                    }
                  >
                    <option value="NEW">Baru (New)</option>
                    <option value="CONTACTED">Dihubungi (Contacted)</option>
                    <option value="QUALIFIED">Memenuhi Syarat (Qualified)</option>
                    <option value="APPLICATION">Pengajuan (Application)</option>
                    <option value="CONVERTED">Konversi (Converted)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-xs text-foreground block mb-1">
                    Kantor Cabang
                  </label>
                  <select
                    className="w-full h-8 rounded-lg border border-input bg-transparent px-2.5 text-xs outline-none focus:ring-2 focus:ring-primary"
                    value={formData.branchId}
                    onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-medium text-xs text-foreground block mb-1">
                    Petugas AO (Assigned Officer)
                  </label>
                  <select
                    className="w-full h-8 rounded-lg border border-input bg-transparent px-2.5 text-xs outline-none focus:ring-2 focus:ring-primary"
                    value={formData.assignedOfficerId}
                    onChange={(e) =>
                      setFormData({ ...formData, assignedOfficerId: e.target.value })
                    }
                  >
                    <option value="">-- Pilih Petugas --</option>
                    {officers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="font-medium text-xs text-foreground block mb-1">
                  Alamat Calon Nasabah
                </label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>

              <div>
                <label className="font-medium text-xs text-foreground block mb-1">Catatan</label>
                <textarea
                  rows={2}
                  className="w-full rounded-lg border border-input bg-transparent p-2 text-xs outline-none focus:ring-2 focus:ring-primary"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditModalOpen(false)}
                disabled={isSubmitting}
              >
                Batal
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Menyimpan..." : "Perbarui Prospek"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
