"use client";

import { useState } from "react";
import Link from "next/link";
import {
  PlusCircle,
  Search,
  FileText,
  User,
  Calendar,
  CheckCircle,
  Clock,
  ShieldCheck,
  MapPin,
  AlertCircle,
  Edit2,
  Trash2,
  ArrowRight,
  Upload,
  Image as ImageIcon,
  Check,
} from "lucide-react";
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

export type CreditApplication = {
  id: string;
  applicationNumber: string;
  applicantId: string;
  branchId: string | null;
  product: string | null;
  requestedAmount: number | null;
  requestedTenorMonths: number | null;
  purpose: string | null;
  source: string | null;
  assignedMarketingOfficerId: string | null;
  assignedAnalystId: string | null;
  assignedSurveyOfficerId: string | null;
  status:
    | "DRAFT"
    | "SUBMITTED"
    | "VERIFICATION"
    | "ANALYSIS"
    | "SURVEY"
    | "REVIEW"
    | "DECISION"
    | "APPROVED"
    | "REJECTED"
    | "RETURNED";
  submissionDate: string | Date | null;
  notes: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  applicant?: { id: string; fullName: string; email: string; phone?: string | null } | null;
  branch?: { id: string; name: string; code: string } | null;
  marketingOfficer?: { id: string; fullName: string; email: string } | null;
  analyst?: { id: string; fullName: string; email: string } | null;
  surveyOfficer?: { id: string; fullName: string; email: string } | null;
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

type LeadOption = {
  id: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  source?: string | null;
  productInterest?: string | null;
  notes?: string | null;
};

type DocumentOption = {
  id: string;
  ownerId: string;
  fileName: string;
  filePath: string;
};

interface Props {
  initialApplications: CreditApplication[];
  users: UserOption[];
  branches: BranchOption[];
  leads?: LeadOption[];
  documents?: DocumentOption[];
}

const STATUS_CONFIG: Record<
  CreditApplication["status"],
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" | "purple" }
> = {
  DRAFT: { label: "Draft", variant: "secondary" },
  SUBMITTED: { label: "Diajukan (Submitted)", variant: "info" },
  VERIFICATION: { label: "Verifikasi Berkas", variant: "purple" },
  ANALYSIS: { label: "Analisis Kelayakan", variant: "warning" },
  SURVEY: { label: "Survey Lapangan", variant: "purple" },
  REVIEW: { label: "Review Komite", variant: "info" },
  DECISION: { label: "Menunggu Putusan", variant: "warning" },
  APPROVED: { label: "Disetujui (Approved)", variant: "success" },
  REJECTED: { label: "Ditolak (Rejected)", variant: "destructive" },
  RETURNED: { label: "Dikembalikan (Returned)", variant: "destructive" },
};

const CREDIT_PRODUCTS = [
  "Kredit Modal Kerja",
  "Kredit Investasi Usaha",
  "Kredit Multi Guna",
  "Kredit Konsumtif Pegawai",
  "Kredit Kepemilikan Rumah (KPR)",
  "Kredit Kendaraan Bermotor",
];

const APPLICATION_SOURCES = [
  "Public Website",
  "Marketing Officer",
  "Field Officer",
  "Walk-in Nasabah",
  "Referral Mitra",
  "Internal Staff",
];

export function CreditApplicationsClientView({
  initialApplications,
  users,
  branches,
  leads = [],
  documents = [],
}: Props) {
  const [applications, setApplications] = useState<CreditApplication[]>(initialApplications);
  const [docList, setDocList] = useState<DocumentOption[]>(documents);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<CreditApplication | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Applicant Mode: 'MANUAL' | 'LEAD' | 'USER'
  const [applicantMode, setApplicantMode] = useState<"MANUAL" | "LEAD" | "USER">("MANUAL");

  // KTP Upload State
  const [ktpData, setKtpData] = useState<{ fileName: string; fileData: string; mimeType: string } | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    product: CREDIT_PRODUCTS[0],
    requestedAmount: "",
    requestedTenorMonths: "12",
    purpose: "",
    source: "Marketing Officer",
    branchId: branches[0]?.id || "",
    applicantId: users[0]?.id || "",

    // Manual Applicant
    applicantName: "",
    applicantNik: "",
    applicantPhone: "",
    applicantEmail: "",
    applicantAddress: "",

    // Selected Lead
    leadId: "",

    assignedMarketingOfficerId: users[0]?.id || "",
    assignedAnalystId: "",
    assignedSurveyOfficerId: "",
    notes: "",
  });

  const resetForm = () => {
    setApplicantMode("MANUAL");
    setKtpData(null);
    setFormData({
      product: CREDIT_PRODUCTS[0],
      requestedAmount: "",
      requestedTenorMonths: "12",
      purpose: "",
      source: "Marketing Officer",
      branchId: branches[0]?.id || "",
      applicantId: users[0]?.id || "",
      applicantName: "",
      applicantNik: "",
      applicantPhone: "",
      applicantEmail: "",
      applicantAddress: "",
      leadId: "",
      assignedMarketingOfficerId: users[0]?.id || "",
      assignedAnalystId: "",
      assignedSurveyOfficerId: "",
      notes: "",
    });
    setErrorMessage("");
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsAddModalOpen(true);
  };

  const handleKtpFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("Ukuran berkas KTP maksimal 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Data = event.target?.result as string;
      setKtpData({
        fileName: file.name,
        fileData: base64Data,
        mimeType: file.type || "image/jpeg",
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSelectLead = (leadId: string) => {
    const selectedLead = leads.find((l) => l.id === leadId);
    if (selectedLead) {
      setFormData((prev) => ({
        ...prev,
        leadId,
        applicantName: selectedLead.name,
        applicantPhone: selectedLead.phone || "",
        applicantAddress: selectedLead.address || "",
        product: selectedLead.productInterest || prev.product,
        source: selectedLead.source || "Public Website",
        notes: selectedLead.notes || prev.notes,
      }));
    }
  };

  const handleOpenEdit = (app: CreditApplication) => {
    setEditingApp(app);
    setFormData({
      product: app.product || CREDIT_PRODUCTS[0],
      requestedAmount: app.requestedAmount ? app.requestedAmount.toString() : "",
      requestedTenorMonths: app.requestedTenorMonths ? app.requestedTenorMonths.toString() : "12",
      purpose: app.purpose || "",
      source: app.source || APPLICATION_SOURCES[0],
      branchId: app.branchId || branches[0]?.id || "",
      applicantId: app.applicantId || users[0]?.id || "",
      applicantName: app.applicant?.fullName || "",
      applicantNik: "",
      applicantPhone: app.applicant?.phone || "",
      applicantEmail: app.applicant?.email || "",
      applicantAddress: "",
      leadId: "",
      assignedMarketingOfficerId: app.assignedMarketingOfficerId || "",
      assignedAnalystId: app.assignedAnalystId || "",
      assignedSurveyOfficerId: app.assignedSurveyOfficerId || "",
      notes: app.notes || "",
    });
    setIsEditModalOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      if (applicantMode === "MANUAL" && (!formData.applicantName || !formData.applicantPhone)) {
        throw new Error("Nama lengkap dan nomor HP pemohon wajib diisi.");
      }

      const payload = {
        ...formData,
        applicantMode,
        ktpDocument: ktpData,
      };

      const res = await fetch("/api/credit/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Gagal menyimpan pengajuan kredit.");
      }

      setApplications([json.data, ...applications]);
      if (ktpData) {
        setDocList([
          {
            id: `ktp-${Date.now()}`,
            ownerId: json.data.id,
            fileName: ktpData.fileName,
            filePath: ktpData.fileData,
          },
          ...docList,
        ]);
      }

      setIsAddModalOpen(false);
      resetForm();
    } catch (err: any) {
      setErrorMessage(err.message || "Terjadi kesalahan sistem.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingApp) return;

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const res = await fetch(`/api/credit/applications/${editingApp.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Gagal memperbarui pengajuan kredit.");
      }

      setApplications(applications.map((a) => (a.id === editingApp.id ? json.data : a)));
      setIsEditModalOpen(false);
      setEditingApp(null);
    } catch (err: any) {
      setErrorMessage(err.message || "Terjadi kesalahan sistem.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (appId: string, newStatus: CreditApplication["status"]) => {
    try {
      const res = await fetch(`/api/credit/applications/${appId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const json = await res.json();
        alert(json.error || "Gagal mengubah status");
        return;
      }

      const json = await res.json();
      setApplications(applications.map((a) => (a.id === appId ? json.data : a)));
    } catch (err: any) {
      alert("Terjadi kesalahan saat mengubah status");
    }
  };

  const handleDelete = async (appId: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus berkas pengajuan kredit ini?")) return;

    try {
      const res = await fetch(`/api/credit/applications/${appId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const json = await res.json();
        alert(json.error || "Gagal menghapus berkas");
        return;
      }

      setApplications(applications.filter((a) => a.id !== appId));
    } catch (err) {
      alert("Gagal menghapus berkas pengajuan");
    }
  };

  // Filter Logic
  const filteredApps = applications.filter((app) => {
    const matchesStatus = statusFilter === "ALL" || app.status === statusFilter;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      app.applicationNumber.toLowerCase().includes(q) ||
      (app.applicant?.fullName && app.applicant.fullName.toLowerCase().includes(q)) ||
      (app.product && app.product.toLowerCase().includes(q)) ||
      (app.purpose && app.purpose.toLowerCase().includes(q));

    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Daftar Pengajuan Kredit</h1>
          <p className="text-muted-foreground mt-1">
            Input dan proses permohonan kredit nasabah (manual / dari website landing page) beserta berkas KTP.
          </p>
        </div>
        <Button onClick={handleOpenAdd} className="flex items-center gap-2">
          <PlusCircle className="h-4 w-4" />
          Ajukan Kredit Baru
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari berdasarkan No. Aplikasi, Nama Pemohon, Produk, atau Tujuan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="ALL">Semua Status ({applications.length})</option>
                {Object.entries(STATUS_CONFIG).map(([val, cfg]) => {
                  const count = applications.filter((a) => a.status === val).length;
                  return (
                    <option key={val} value={val}>
                      {cfg.label} ({count})
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Applications Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Berkas Pengajuan ({filteredApps.length})</CardTitle>
          <CardDescription>
            Tersedia badge kelengkapan dokumen KTP dan pergeseran status pipeline.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredApps.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Tidak ada data pengajuan kredit yang sesuai dengan kriteria filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No. Pengajuan</TableHead>
                    <TableHead>Debitur / Pemohon</TableHead>
                    <TableHead>Dokumen</TableHead>
                    <TableHead>Produk & Plafon</TableHead>
                    <TableHead>Kantor Cabang</TableHead>
                    <TableHead>Petugas Terkait</TableHead>
                    <TableHead>Status Lifecycle</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredApps.map((app) => {
                    const hasKtp = docList.some((d) => d.ownerId === app.id);
                    return (
                      <TableRow key={app.id}>
                        <TableCell className="font-semibold text-primary">
                          <Link
                            href={`/credit/applications/${app.id}`}
                            className="hover:underline flex items-center gap-1"
                          >
                            {app.applicationNumber}
                          </Link>
                          <div className="text-xs text-muted-foreground font-normal">
                            {app.submissionDate ? new Date(app.submissionDate).toLocaleDateString("id-ID") : "-"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold text-sm">{app.applicant?.fullName || "Debitur Nasabah"}</div>
                          <div className="text-xs text-muted-foreground">
                            {app.applicant?.phone || app.applicant?.email || "-"}
                          </div>
                        </TableCell>
                        <TableCell>
                          {hasKtp ? (
                            <Badge variant="success" className="text-[10px] flex items-center gap-1 w-fit">
                              <CheckCircle className="h-3 w-3" /> KTP Terlampir
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground w-fit">
                              Belum Upload KTP
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{app.product || "-"}</div>
                          <div className="text-xs text-muted-foreground">
                            {app.requestedAmount ? `Rp ${app.requestedAmount.toLocaleString("id-ID")}` : "-"}{" "}
                            • {app.requestedTenorMonths ? `${app.requestedTenorMonths} Bln` : "-"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{app.branch?.name || "-"}</span>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs space-y-0.5">
                            {app.marketingOfficer && (
                              <div>
                                <span className="text-muted-foreground">Mkt:</span> {app.marketingOfficer.fullName}
                              </div>
                            )}
                            {app.analyst && (
                              <div>
                                <span className="text-muted-foreground">Anls:</span> {app.analyst.fullName}
                              </div>
                            )}
                            {app.surveyOfficer && (
                              <div>
                                <span className="text-muted-foreground">Srvy:</span> {app.surveyOfficer.fullName}
                              </div>
                            )}
                            {!app.marketingOfficer && !app.analyst && !app.surveyOfficer && "-"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant={STATUS_CONFIG[app.status]?.variant || "secondary"}>
                              {STATUS_CONFIG[app.status]?.label || app.status}
                            </Badge>
                            <select
                              value={app.status}
                              onChange={(e) =>
                                handleStatusChange(app.id, e.target.value as CreditApplication["status"])
                              }
                              className="h-7 text-xs rounded border border-input bg-transparent px-1 cursor-pointer"
                              title="Ubah Status Pengajuan"
                            >
                              {Object.keys(STATUS_CONFIG).map((st) => (
                                <option key={st} value={st}>
                                  {st}
                                </option>
                              ))}
                            </select>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Link href={`/credit/applications/${app.id}`}>
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Buka Lembar Kerja & Analisis 5C"
                                className="text-primary hover:text-primary"
                              >
                                <ArrowRight className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(app)} title="Edit Data">
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(app.id)}
                              className="text-destructive hover:text-destructive"
                              title="Hapus Berkas"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle>Ajukan Permohonan Kredit Baru</DialogTitle>
              <DialogDescription>
                Isi data nasabah pemohon (Ketik Manual / Pilih dari Landing Page) dan unggah foto/scan KTP.
              </DialogDescription>
            </DialogHeader>

            {errorMessage && (
              <div className="bg-destructive/15 text-destructive p-3 rounded-md text-sm my-3">
                {errorMessage}
              </div>
            )}

            <div className="grid gap-4 py-4">
              {/* Applicant Source Mode Selection */}
              <div className="bg-muted/50 p-3 rounded-lg border">
                <label className="text-xs font-semibold block mb-2">Pilih Sumber / Cara Input Data Pemohon:</label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={applicantMode === "MANUAL" ? "default" : "outline"}
                    onClick={() => setApplicantMode("MANUAL")}
                  >
                    1. Ketik Manual Debitur Baru
                  </Button>
                  {leads.length > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      variant={applicantMode === "LEAD" ? "default" : "outline"}
                      onClick={() => setApplicantMode("LEAD")}
                    >
                      2. Dari Prospect Website ({leads.length})
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant={applicantMode === "USER" ? "default" : "outline"}
                    onClick={() => setApplicantMode("USER")}
                  >
                    3. Dari User Sistem
                  </Button>
                </div>
              </div>

              {/* Mode 1: Manual Input */}
              {applicantMode === "MANUAL" && (
                <div className="space-y-3 p-3 border rounded-md bg-card">
                  <span className="text-xs font-bold text-primary block">Data Debitur / Pemohon Pinjaman</span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium">Nama Lengkap Pemohon *</label>
                      <Input
                        placeholder="Contoh: Budi Santoso"
                        value={formData.applicantName}
                        onChange={(e) => setFormData({ ...formData, applicantName: e.target.value })}
                        className="mt-1"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium">NIK / No. KTP Pemohon (16 Digit)</label>
                      <Input
                        placeholder="Contoh: 3171012345678901"
                        maxLength={16}
                        value={formData.applicantNik}
                        onChange={(e) => setFormData({ ...formData, applicantNik: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium">No. HP / WhatsApp Pemohon *</label>
                      <Input
                        placeholder="Contoh: 081234567890"
                        value={formData.applicantPhone}
                        onChange={(e) => setFormData({ ...formData, applicantPhone: e.target.value })}
                        className="mt-1"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium">Email Pemohon (Opsional)</label>
                      <Input
                        type="email"
                        placeholder="debitur@gmail.com"
                        value={formData.applicantEmail}
                        onChange={(e) => setFormData({ ...formData, applicantEmail: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium">Alamat Tempat Tinggal / Usaha</label>
                    <Input
                      placeholder="Jl. Raya Utama No. 12, Kel. Menteng, Jakarta Pusat"
                      value={formData.applicantAddress}
                      onChange={(e) => setFormData({ ...formData, applicantAddress: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                </div>
              )}

              {/* Mode 2: Select Lead from Landing Page */}
              {applicantMode === "LEAD" && (
                <div className="space-y-3 p-3 border rounded-md bg-card">
                  <span className="text-xs font-bold text-primary block">Pilih Prospect Submisi Landing Page:</span>
                  <select
                    value={formData.leadId}
                    onChange={(e) => handleSelectLead(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                    required
                  >
                    <option value="">-- Pilih Prospect Nasabah --</option>
                    {leads.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.phone || "No HP -"}) • {l.productInterest || "Kredit"}
                      </option>
                    ))}
                  </select>

                  {formData.applicantName && (
                    <div className="text-xs bg-muted p-2.5 rounded space-y-1">
                      <div><strong>Nama:</strong> {formData.applicantName}</div>
                      <div><strong>Telepon:</strong> {formData.applicantPhone}</div>
                      <div><strong>Alamat:</strong> {formData.applicantAddress || "-"}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Mode 3: Existing User */}
              {applicantMode === "USER" && (
                <div>
                  <label className="text-xs font-medium">Pilih User Sistem sebagai Pemohon *</label>
                  <select
                    value={formData.applicantId}
                    onChange={(e) => setFormData({ ...formData, applicantId: e.target.value })}
                    className="w-full mt-1.5 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                    required
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* KTP Document Upload Section */}
              <div className="p-3 border rounded-md bg-accent/20">
                <label className="text-xs font-bold text-primary flex items-center gap-1.5 mb-1.5">
                  <Upload className="h-4 w-4" /> Unggah Foto / Scan KTP Pemohon (PDF / JPG / PNG)
                </label>
                <Input
                  type="file"
                  accept="image/jpeg,image/png,image/jpg,application/pdf"
                  onChange={handleKtpFileChange}
                  className="cursor-pointer text-xs"
                />
                {ktpData && (
                  <div className="mt-2 text-xs text-green-700 bg-green-50 p-2 rounded border border-green-200 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Check className="h-3.5 w-3.5 text-green-600" />
                      KTP Siap Diunggah: <strong>{ktpData.fileName}</strong>
                    </span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setKtpData(null)} className="h-6 text-[10px]">
                      Hapus
                    </Button>
                  </div>
                )}
              </div>

              {/* Loan Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium">Kantor Cabang *</label>
                  <select
                    value={formData.branchId}
                    onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                    className="w-full mt-1.5 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                    required
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium">Produk Kredit *</label>
                  <select
                    value={formData.product}
                    onChange={(e) => setFormData({ ...formData, product: e.target.value })}
                    className="w-full mt-1.5 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                    required
                  >
                    {CREDIT_PRODUCTS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium">Plafon yang Dimohon (Rp) *</label>
                  <Input
                    type="number"
                    min="1000000"
                    placeholder="Contoh: 50000000"
                    value={formData.requestedAmount}
                    onChange={(e) => setFormData({ ...formData, requestedAmount: e.target.value })}
                    className="mt-1.5"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Jangka Waktu (Tenor dalam Bulan) *</label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="Contoh: 24"
                    value={formData.requestedTenorMonths}
                    onChange={(e) => setFormData({ ...formData, requestedTenorMonths: e.target.value })}
                    className="mt-1.5"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium">Tujuan Penggunaan Kredit *</label>
                <Input
                  placeholder="Contoh: Tambahan modal kerja toko ritel / Pembelian aset"
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  className="mt-1.5"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium">Account Officer (Marketing)</label>
                  <select
                    value={formData.assignedMarketingOfficerId}
                    onChange={(e) => setFormData({ ...formData, assignedMarketingOfficerId: e.target.value })}
                    className="w-full mt-1.5 h-9 rounded-md border border-input bg-background px-2 py-1 text-xs"
                  >
                    <option value="">-- Pilih Petugas --</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium">Analis Kredit</label>
                  <select
                    value={formData.assignedAnalystId}
                    onChange={(e) => setFormData({ ...formData, assignedAnalystId: e.target.value })}
                    className="w-full mt-1.5 h-9 rounded-md border border-input bg-background px-2 py-1 text-xs"
                  >
                    <option value="">-- Pilih Analis --</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium">Petugas Survey</label>
                  <select
                    value={formData.assignedSurveyOfficerId}
                    onChange={(e) => setFormData({ ...formData, assignedSurveyOfficerId: e.target.value })}
                    className="w-full mt-1.5 h-9 rounded-md border border-input bg-background px-2 py-1 text-xs"
                  >
                    <option value="">-- Pilih Surveyor --</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium">Catatan / Keterangan Berkas</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Informasi tambahan mengenai debitur atau jaminan yang dijaminkan..."
                  className="w-full mt-1.5 rounded-md border border-input bg-background p-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Menyimpan..." : "Kirim Pengajuan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleUpdate}>
            <DialogHeader>
              <DialogTitle>Ubah Berkas Pengajuan: {editingApp?.applicationNumber}</DialogTitle>
              <DialogDescription>
                Perbarui data kredit, plafon, penugasan petugas, atau catatan analisis.
              </DialogDescription>
            </DialogHeader>

            {errorMessage && (
              <div className="bg-destructive/15 text-destructive p-3 rounded-md text-sm my-3">
                {errorMessage}
              </div>
            )}

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium">Nama Debitur / Pemohon</label>
                  <Input
                    value={formData.applicantName}
                    onChange={(e) => setFormData({ ...formData, applicantName: e.target.value })}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">No. HP / Telepon</label>
                  <Input
                    value={formData.applicantPhone}
                    onChange={(e) => setFormData({ ...formData, applicantPhone: e.target.value })}
                    className="mt-1.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium">Produk Kredit *</label>
                  <select
                    value={formData.product}
                    onChange={(e) => setFormData({ ...formData, product: e.target.value })}
                    className="w-full mt-1.5 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                    required
                  >
                    {CREDIT_PRODUCTS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium">Sumber Permohonan *</label>
                  <select
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                    className="w-full mt-1.5 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                    required
                  >
                    {APPLICATION_SOURCES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium">Plafon yang Dimohon (Rp) *</label>
                  <Input
                    type="number"
                    min="1000000"
                    value={formData.requestedAmount}
                    onChange={(e) => setFormData({ ...formData, requestedAmount: e.target.value })}
                    className="mt-1.5"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Jangka Waktu (Tenor Bulan) *</label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.requestedTenorMonths}
                    onChange={(e) => setFormData({ ...formData, requestedTenorMonths: e.target.value })}
                    className="mt-1.5"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium">Tujuan Penggunaan Kredit *</label>
                <Input
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  className="mt-1.5"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium">Marketing Officer</label>
                  <select
                    value={formData.assignedMarketingOfficerId}
                    onChange={(e) => setFormData({ ...formData, assignedMarketingOfficerId: e.target.value })}
                    className="w-full mt-1.5 h-9 rounded-md border border-input bg-background px-2 py-1 text-xs"
                  >
                    <option value="">-- Pilih Petugas --</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium">Analis Kredit</label>
                  <select
                    value={formData.assignedAnalystId}
                    onChange={(e) => setFormData({ ...formData, assignedAnalystId: e.target.value })}
                    className="w-full mt-1.5 h-9 rounded-md border border-input bg-background px-2 py-1 text-xs"
                  >
                    <option value="">-- Pilih Analis --</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium">Petugas Survey</label>
                  <select
                    value={formData.assignedSurveyOfficerId}
                    onChange={(e) => setFormData({ ...formData, assignedSurveyOfficerId: e.target.value })}
                    className="w-full mt-1.5 h-9 rounded-md border border-input bg-background px-2 py-1 text-xs"
                  >
                    <option value="">-- Pilih Surveyor --</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium">Catatan / Keterangan Berkas</label>
                <textarea
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full mt-1.5 rounded-md border border-input bg-background p-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Menyimpan..." : "Simpan Perubahan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
