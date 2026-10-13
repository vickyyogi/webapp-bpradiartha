"use client";

import { useState } from "react";
import Link from "next/link";
import {
  PlusCircle,
  Search,
  Edit2,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Building2,
  User,
  AlertTriangle,
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

export type CustomerListItem = {
  id: string;
  customerNumber: string;
  customerType: "INDIVIDU" | "BADAN";
  status: "PROSPEK" | "AKTIF" | "NONAKTIF" | "BLACKLIST";
  legalName: string;
  identityNumberMasked: string | null;
  phone: string | null;
  email: string | null;
  branch?: { id: string; name: string } | null;
  verified: boolean;
  applicationCount: number;
  createdAt: string | Date;
};

type BranchOption = { id: string; name: string; code: string };

type DuplicateCandidate = {
  id: string;
  customerNumber: string;
  legalName: string;
  identityNumberMasked: string | null;
  matchReasons: string[];
};

interface Props {
  initialCustomers: CustomerListItem[];
  branches: BranchOption[];
}

const STATUS_CONFIG: Record<
  CustomerListItem["status"],
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" | "purple" }
> = {
  PROSPEK: { label: "Prospek", variant: "info" },
  AKTIF: { label: "Aktif", variant: "success" },
  NONAKTIF: { label: "Nonaktif", variant: "secondary" },
  BLACKLIST: { label: "Blacklist", variant: "destructive" },
};

const emptyForm = (branchId: string) => ({
  customerType: "INDIVIDU" as "INDIVIDU" | "BADAN",
  status: "PROSPEK" as CustomerListItem["status"],
  legalName: "",
  nickname: "",
  identityType: "KTP",
  identityNumber: "",
  npwp: "",
  birthPlace: "",
  birthDate: "",
  gender: "",
  address: "",
  rtRw: "",
  kelurahan: "",
  kecamatan: "",
  city: "",
  province: "",
  postalCode: "",
  phone: "",
  email: "",
  occupation: "",
  employerName: "",
  monthlyIncome: "",
  branchId,
  notes: "",
  consentDataProcessing: false,
});

export function CustomersClientView({ initialCustomers, branches }: Props) {
  const [customers, setCustomers] = useState<CustomerListItem[]>(initialCustomers);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[]>([]);
  const [formData, setFormData] = useState(emptyForm(branches[0]?.id || ""));

  const resetForm = () => {
    setFormData(emptyForm(branches[0]?.id || ""));
    setDuplicates([]);
    setErrorMessage("");
  };

  const handleOpenAdd = () => {
    resetForm();
    setEditingId(null);
    setIsAddOpen(true);
  };

  const checkDuplicates = async () => {
    if (!formData.identityNumber && !formData.legalName && !formData.phone) return;
    try {
      const params = new URLSearchParams();
      if (formData.identityNumber) params.set("identityNumber", formData.identityNumber);
      if (formData.legalName) params.set("legalName", formData.legalName);
      if (formData.phone) params.set("phone", formData.phone);
      if (editingId) params.set("excludeCustomerId", editingId);
      const res = await fetch(`/api/crm/customers/duplicates?${params.toString()}`);
      const json = await res.json();
      if (res.ok) setDuplicates(json.data || []);
    } catch {
      // diamkan; pemeriksaan duplikat bersifat bantuan
    }
  };

  const handleOpenEdit = async (customer: CustomerListItem) => {
    setErrorMessage("");
    setDuplicates([]);
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/crm/customers/${customer.id}`);
      const json = await res.json();
      const c = json.data;
      setFormData({
        customerType: c.customerType,
        status: c.status,
        legalName: c.legalName || "",
        nickname: c.nickname || "",
        identityType: c.identityType || "KTP",
        identityNumber: c.identityNumber || "",
        npwp: c.npwp || "",
        birthPlace: c.birthPlace || "",
        birthDate: c.birthDate ? String(c.birthDate).slice(0, 10) : "",
        gender: c.gender || "",
        address: c.address || "",
        rtRw: c.rtRw || "",
        kelurahan: c.kelurahan || "",
        kecamatan: c.kecamatan || "",
        city: c.city || "",
        province: c.province || "",
        postalCode: c.postalCode || "",
        phone: c.phone || "",
        email: c.email || "",
        occupation: c.occupation || "",
        employerName: c.employerName || "",
        monthlyIncome: c.monthlyIncome !== null && c.monthlyIncome !== undefined ? String(c.monthlyIncome) : "",
        branchId: c.branchId || branches[0]?.id || "",
        notes: c.notes || "",
        consentDataProcessing: false,
      });
      setEditingId(customer.id);
      setIsEditOpen(true);
    } catch {
      setErrorMessage("Gagal memuat data nasabah.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const submit = async (e: React.SyntheticEvent, force = false) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      const payload: Record<string, unknown> = { ...formData, force };
      if (!editingId) {
        payload.consent = formData.consentDataProcessing
          ? { dataProcessing: true, policyVersion: "v1" }
          : undefined;
      }
      const res = await fetch(editingId ? `/api/crm/customers/${editingId}` : "/api/crm/customers", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (res.status === 409 && json.duplicates) {
        setDuplicates(json.duplicates);
        setErrorMessage(json.error || "Terdeteksi kemungkinan duplikat.");
        return;
      }
      if (!res.ok) throw new Error(json.error || "Gagal menyimpan nasabah.");

      const saved = json.data;
      const listItem: CustomerListItem = {
        id: saved.id,
        customerNumber: saved.customerNumber,
        customerType: saved.customerType,
        status: saved.status,
        legalName: saved.legalName,
        identityNumberMasked: saved.identityNumberMasked ?? null,
        phone: saved.phone,
        email: saved.email,
        branch: saved.branch ?? null,
        verified: Boolean(saved.verifiedAt),
        applicationCount: editingId
          ? customers.find((c) => c.id === editingId)?.applicationCount ?? 0
          : 0,
        createdAt: saved.createdAt,
      };

      if (editingId) {
        setCustomers(customers.map((c) => (c.id === editingId ? listItem : c)));
        setIsEditOpen(false);
      } else {
        setCustomers([listItem, ...customers]);
        setIsAddOpen(false);
      }
      resetForm();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Terjadi kesalahan sistem.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = customers.filter((c) => {
    const matchesStatus = statusFilter === "ALL" || c.status === statusFilter;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      c.legalName.toLowerCase().includes(q) ||
      c.customerNumber.toLowerCase().includes(q) ||
      (c.phone || "").includes(q) ||
      (c.email || "").toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const duplicatePanel = duplicates.length > 0 && (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 space-y-1">
      <div className="flex items-center gap-1.5 font-semibold">
        <AlertTriangle className="h-3.5 w-3.5" /> Kemungkinan duplikat ({duplicates.length})
      </div>
      {duplicates.map((d) => (
        <div key={d.id}>
          • {d.legalName} — {d.customerNumber} ({d.matchReasons.join(", ")})
          {d.identityNumberMasked ? ` • ${d.identityNumberMasked}` : ""}
        </div>
      ))}
    </div>
  );

  const identityFields = (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium">Jenis Nasabah *</label>
          <select
            value={formData.customerType}
            onChange={(e) => setFormData({ ...formData, customerType: e.target.value as "INDIVIDU" | "BADAN" })}
            className="w-full mt-1.5 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            <option value="INDIVIDU">Individu</option>
            <option value="BADAN">Badan Usaha</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium">Status</label>
          <select
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as CustomerListItem["status"] })}
            className="w-full mt-1.5 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
              <option key={val} value={val}>{cfg.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium">Nama Legal *</label>
          <Input value={formData.legalName} onChange={(e) => setFormData({ ...formData, legalName: e.target.value })} className="mt-1.5" required />
        </div>
        <div>
          <label className="text-xs font-medium">Nama Panggilan</label>
          <Input value={formData.nickname} onChange={(e) => setFormData({ ...formData, nickname: e.target.value })} className="mt-1.5" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-medium">Jenis Identitas</label>
          <select
            value={formData.identityType}
            onChange={(e) => setFormData({ ...formData, identityType: e.target.value })}
            className="w-full mt-1.5 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            <option value="KTP">KTP</option>
            <option value="SIM">SIM</option>
            <option value="PASPOR">Paspor</option>
            <option value="NIB">NIB / ID Usaha</option>
            <option value="NPWP">NPWP</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium">Nomor Identitas {formData.customerType === "INDIVIDU" ? "(NIK 16 digit)" : "(ID usaha)"}</label>
          <Input
            value={formData.identityNumber}
            onChange={(e) => setFormData({ ...formData, identityNumber: e.target.value })}
            onBlur={checkDuplicates}
            maxLength={formData.customerType === "INDIVIDU" ? 16 : 64}
            className="mt-1.5"
          />
        </div>
        <div>
          <label className="text-xs font-medium">NPWP</label>
          <Input value={formData.npwp} onChange={(e) => setFormData({ ...formData, npwp: e.target.value })} className="mt-1.5" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-medium">Tempat Lahir / Berdiri</label>
          <Input value={formData.birthPlace} onChange={(e) => setFormData({ ...formData, birthPlace: e.target.value })} className="mt-1.5" />
        </div>
        <div>
          <label className="text-xs font-medium">Tanggal Lahir / Berdiri</label>
          <Input type="date" value={formData.birthDate} onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })} className="mt-1.5" />
        </div>
        <div>
          <label className="text-xs font-medium">Jenis Kelamin</label>
          <select
            value={formData.gender}
            onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
            className="w-full mt-1.5 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            <option value="">-</option>
            <option value="LAKI_LAKI">Laki-laki</option>
            <option value="PEREMPUAN">Perempuan</option>
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs font-medium">Alamat</label>
        <Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="mt-1.5" />
      </div>
      <div className="grid grid-cols-5 gap-2">
        <div><label className="text-xs font-medium">RT/RW</label><Input value={formData.rtRw} onChange={(e) => setFormData({ ...formData, rtRw: e.target.value })} className="mt-1.5" /></div>
        <div><label className="text-xs font-medium">Kelurahan</label><Input value={formData.kelurahan} onChange={(e) => setFormData({ ...formData, kelurahan: e.target.value })} className="mt-1.5" /></div>
        <div><label className="text-xs font-medium">Kecamatan</label><Input value={formData.kecamatan} onChange={(e) => setFormData({ ...formData, kecamatan: e.target.value })} className="mt-1.5" /></div>
        <div><label className="text-xs font-medium">Kota</label><Input value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} className="mt-1.5" /></div>
        <div><label className="text-xs font-medium">Provinsi</label><Input value={formData.province} onChange={(e) => setFormData({ ...formData, province: e.target.value })} className="mt-1.5" /></div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-medium">No. HP / WhatsApp</label>
          <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} onBlur={checkDuplicates} className="mt-1.5" />
        </div>
        <div>
          <label className="text-xs font-medium">Email</label>
          <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="mt-1.5" />
        </div>
        <div>
          <label className="text-xs font-medium">Cabang</label>
          <select
            value={formData.branchId}
            onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
            className="w-full mt-1.5 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-medium">Pekerjaan</label>
          <Input value={formData.occupation} onChange={(e) => setFormData({ ...formData, occupation: e.target.value })} className="mt-1.5" />
        </div>
        <div>
          <label className="text-xs font-medium">Nama Usaha / Pemberi Kerja</label>
          <Input value={formData.employerName} onChange={(e) => setFormData({ ...formData, employerName: e.target.value })} className="mt-1.5" />
        </div>
        <div>
          <label className="text-xs font-medium">Penghasilan / Bulan</label>
          <Input type="number" value={formData.monthlyIncome} onChange={(e) => setFormData({ ...formData, monthlyIncome: e.target.value })} className="mt-1.5" />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium">Catatan</label>
        <textarea
          rows={2}
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          className="w-full mt-1.5 rounded-md border border-input bg-background p-2 text-sm"
        />
      </div>

      {!editingId && (
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={formData.consentDataProcessing}
            onChange={(e) => setFormData({ ...formData, consentDataProcessing: e.target.checked })}
          />
          Nasabah telah memberikan persetujuan pemrosesan data pribadi (dicatat sebagai bukti).
        </label>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Data Nasabah (Customers)</h1>
          <p className="text-muted-foreground mt-1">
            Master nasabah/debitur terpisah dari akun pegawai, dengan identitas terstruktur, riwayat perubahan, hubungan antar-pihak, dan catatan persetujuan data.
          </p>
        </div>
        <Button onClick={handleOpenAdd} className="flex items-center gap-2">
          <PlusCircle className="h-4 w-4" /> Tambah Nasabah
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama, nomor nasabah, telepon, atau email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
            >
              <option value="ALL">Semua Status ({customers.length})</option>
              {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
                <option key={val} value={val}>{cfg.label}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Daftar Nasabah ({filtered.length})</CardTitle>
          <CardDescription>Nomor identitas disamarkan pada daftar; data lengkap tersedia di halaman detail sesuai hak akses.</CardDescription>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">Belum ada nasabah yang cocok.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No. Nasabah</TableHead>
                    <TableHead>Nama Legal</TableHead>
                    <TableHead>Identitas</TableHead>
                    <TableHead>Kontak</TableHead>
                    <TableHead>Cabang</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Aplikasi</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-semibold text-primary">
                        <Link href={`/crm/customers/${c.id}`} className="hover:underline">{c.customerNumber}</Link>
                        <div className="text-xs text-muted-foreground font-normal flex items-center gap-1">
                          {c.customerType === "BADAN" ? <Building2 className="h-3 w-3" /> : <User className="h-3 w-3" />}
                          {c.customerType}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm flex items-center gap-1.5">
                          {c.legalName}
                          {c.verified ? (
                            <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
                          ) : (
                            <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-mono">{c.identityNumberMasked || "-"}</TableCell>
                      <TableCell className="text-xs">
                        <div>{c.phone || "-"}</div>
                        <div className="text-muted-foreground">{c.email || "-"}</div>
                      </TableCell>
                      <TableCell className="text-sm">{c.branch?.name || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_CONFIG[c.status]?.variant || "secondary"}>
                          {STATUS_CONFIG[c.status]?.label || c.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{c.applicationCount}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/crm/customers/${c.id}`}>
                            <Button variant="ghost" size="sm" title="Detail & riwayat"><ArrowRight className="h-4 w-4" /></Button>
                          </Link>
                          <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(c)} title="Edit data"><Edit2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[760px] max-h-[90vh] overflow-y-auto">
          <form onSubmit={(e) => submit(e, false)}>
            <DialogHeader>
              <DialogTitle>Tambah Nasabah Baru</DialogTitle>
              <DialogDescription>Isi identitas nasabah. Nomor identitas diperiksa otomatis terhadap duplikasi.</DialogDescription>
            </DialogHeader>
            {errorMessage && <div className="bg-destructive/15 text-destructive p-3 rounded-md text-sm my-3">{errorMessage}</div>}
            {duplicatePanel}
            <div className="py-4">{identityFields}</div>
            <DialogFooter>
              {duplicates.length > 0 && (
                <Button type="button" variant="destructive" onClick={(e) => submit(e, true)} disabled={isSubmitting}>
                  Tetap Simpan
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Batal</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Menyimpan..." : "Simpan Nasabah"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[760px] max-h-[90vh] overflow-y-auto">
          <form onSubmit={(e) => submit(e, false)}>
            <DialogHeader>
              <DialogTitle>Ubah Data Nasabah</DialogTitle>
              <DialogDescription>Perubahan identitas akan tercatat pada riwayat.</DialogDescription>
            </DialogHeader>
            {errorMessage && <div className="bg-destructive/15 text-destructive p-3 rounded-md text-sm my-3">{errorMessage}</div>}
            {duplicatePanel}
            <div className="py-4">{identityFields}</div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>Batal</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Menyimpan..." : "Simpan Perubahan"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
