"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Edit,
  PlusCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ReminderLevel = "OVERDUE" | "DUE_SOON" | "OK" | "NONE";

interface CollateralRow {
  id: string;
  collateralCode: string;
  collateralType: string;
  ownershipProof?: string | null;
  legalOwnerName: string;
  ownerRelationship?: string | null;
  marketValue?: string | number | null;
  njopValue?: string | number | null;
  appraisedValue?: string | number | null;
  appraiserName?: string | null;
  appraisalMethod?: string | null;
  appraisalDate?: string | null;
  nextAppraisalDate?: string | null;
  bindingType?: string | null;
  bindingNumber?: string | null;
  bindingDate?: string | null;
  bindingExpiryDate?: string | null;
  insuranceProvider?: string | null;
  insurancePolicyNumber?: string | null;
  insuranceExpiryDate?: string | null;
  locationAddress?: string | null;
  status: "ACTIVE" | "RELEASED" | "EXPIRED";
  notes?: string | null;
  customer?: { id: string; customerNumber: string; legalName: string } | null;
  creditApplication?: { id: string; applicationNumber: string } | null;
  branch?: { id: string; name: string } | null;
  reminders?: { appraisal: ReminderLevel; binding: ReminderLevel; insurance: ReminderLevel };
}

interface Option {
  id: string;
  legalName?: string;
  customerNumber?: string;
  applicationNumber?: string;
  customerId?: string;
}

const EMPTY_FORM = {
  customerId: "",
  creditApplicationId: "",
  collateralCode: "",
  collateralType: "",
  ownershipProof: "",
  legalOwnerName: "",
  ownerRelationship: "",
  marketValue: "",
  njopValue: "",
  appraisedValue: "",
  appraiserName: "",
  appraisalMethod: "",
  appraisalDate: "",
  nextAppraisalDate: "",
  bindingType: "",
  bindingNumber: "",
  bindingDate: "",
  bindingExpiryDate: "",
  insuranceProvider: "",
  insurancePolicyNumber: "",
  insuranceExpiryDate: "",
  locationAddress: "",
  status: "ACTIVE",
  notes: "",
};

type FormState = typeof EMPTY_FORM;

const money = (value?: string | number | null) =>
  value === null || value === undefined || value === "" ? "-" : `Rp ${Number(value).toLocaleString("id-ID")}`;

const dateText = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("id-ID") : "-";

const inputDate = (value?: string | null) => (value ? value.slice(0, 10) : "");

function ReminderBadge({ level, label }: { level?: ReminderLevel; label: string }) {
  if (!level || level === "NONE" || level === "OK") return null;
  return (
    <Badge variant="outline" className={level === "OVERDUE" ? "border-red-300 text-red-700" : "border-amber-300 text-amber-700"}>
      {label} {level === "OVERDUE" ? "lewat" : "dekat"}
    </Badge>
  );
}

export default function CollateralPage() {
  const [items, setItems] = useState<CollateralRow[]>([]);
  const [customers, setCustomers] = useState<Option[]>([]);
  const [applications, setApplications] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [onlyReminders, setOnlyReminders] = useState(false);
  const [reminders, setReminders] = useState({ appraisalDue: 0, bindingDue: 0, insuranceDue: 0 });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<CollateralRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [recordAppraisal, setRecordAppraisal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (status !== "ALL") params.set("status", status);
      if (onlyReminders) params.set("reminders", "1");
      const res = await fetch(`/api/credit/collaterals?${params.toString()}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Gagal memuat agunan.");
      setItems(body.data || []);
      setReminders(body.reminders || { appraisalDue: 0, bindingDue: 0, insuranceDue: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat agunan.");
    } finally {
      setLoading(false);
    }
  }, [search, status, onlyReminders]);

  useEffect(() => {
    // Ditunda satu microtask agar setState tidak berjalan sinkron di body effect.
    let cancelled = false;
    async function start() {
      await Promise.resolve();
      if (!cancelled) void load();
    }
    void start();
    return () => {
      cancelled = true;
    };
  }, [load]);

  useEffect(() => {
    Promise.all([
      fetch("/api/crm/customers").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/credit/applications").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([c, a]) => {
        setCustomers(c?.data || []);
        setApplications(a?.data || []);
      })
      .catch(() => {});
  }, []);

  const appOptions = useMemo(
    () => applications.filter((a) => !form.customerId || a.customerId === form.customerId),
    [applications, form.customerId]
  );

  const set = (key: keyof FormState, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setRecordAppraisal(false);
    setDialogOpen(true);
  };

  const openEdit = (row: CollateralRow) => {
    setEditing(row);
    setForm({
      customerId: row.customer?.id || "",
      creditApplicationId: row.creditApplication?.id || "",
      collateralCode: row.collateralCode,
      collateralType: row.collateralType,
      ownershipProof: row.ownershipProof || "",
      legalOwnerName: row.legalOwnerName,
      ownerRelationship: row.ownerRelationship || "",
      marketValue: row.marketValue ? String(row.marketValue) : "",
      njopValue: row.njopValue ? String(row.njopValue) : "",
      appraisedValue: row.appraisedValue ? String(row.appraisedValue) : "",
      appraiserName: row.appraiserName || "",
      appraisalMethod: row.appraisalMethod || "",
      appraisalDate: inputDate(row.appraisalDate),
      nextAppraisalDate: inputDate(row.nextAppraisalDate),
      bindingType: row.bindingType || "",
      bindingNumber: row.bindingNumber || "",
      bindingDate: inputDate(row.bindingDate),
      bindingExpiryDate: inputDate(row.bindingExpiryDate),
      insuranceProvider: row.insuranceProvider || "",
      insurancePolicyNumber: row.insurancePolicyNumber || "",
      insuranceExpiryDate: inputDate(row.insuranceExpiryDate),
      locationAddress: row.locationAddress || "",
      status: row.status,
      notes: row.notes || "",
    });
    setRecordAppraisal(false);
    setDialogOpen(true);
  };

  const submit = async () => {
    if (!form.customerId || !form.collateralType.trim() || !form.legalOwnerName.trim()) {
      setError("Nasabah, jenis agunan, dan pemilik legal wajib diisi.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = { ...form, creditApplicationId: form.creditApplicationId || null, recordAppraisal };
      const res = await fetch(editing ? `/api/credit/collaterals/${editing.id}` : "/api/credit/collaterals", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Gagal menyimpan agunan.");
      setDialogOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan agunan.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: CollateralRow) => {
    if (!window.confirm(`Hapus agunan ${row.collateralCode}? Tindakan ini tercatat di audit log.`)) return;
    setError("");
    const res = await fetch(`/api/credit/collaterals/${row.id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Gagal menghapus agunan.");
      return;
    }
    await load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" /> Agunan & Jaminan
          </h1>
          <p className="text-muted-foreground text-sm">
            Data agunan, taksasi, pengikatan, asuransi, dan pengingat tenggat.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-1.5">
          <PlusCircle className="h-4 w-4" /> Tambah Agunan
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 mt-0.5" /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase">Penilaian Ulang ≤30 Hari</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{reminders.appraisalDue}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase">Pengikatan Kedaluwarsa ≤30 Hari</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{reminders.bindingDue}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase">Asuransi Kedaluwarsa ≤30 Hari</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{reminders.insuranceDue}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari kode, jenis, pemilik, atau nasabah..."
                className="pl-8"
              />
            </div>
            <Select value={status} onValueChange={(v) => setStatus(v ?? "ALL")}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Status</SelectItem>
                <SelectItem value="ACTIVE">Aktif</SelectItem>
                <SelectItem value="RELEASED">Dilepas</SelectItem>
                <SelectItem value="EXPIRED">Kedaluwarsa</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant={onlyReminders ? "default" : "outline"}
              onClick={() => setOnlyReminders((v) => !v)}
              className="gap-1.5"
            >
              <CalendarClock className="h-4 w-4" /> Perlu Tindakan
            </Button>
            <Button variant="ghost" onClick={() => void load()} className="gap-1.5">
              <RefreshCw className="h-4 w-4" /> Muat Ulang
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daftar Agunan</CardTitle>
          <CardDescription>{loading ? "Memuat..." : `${items.length} agunan pada halaman ini`}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2">Kode</th>
                  <th className="px-3 py-2">Nasabah</th>
                  <th className="px-3 py-2">Jenis</th>
                  <th className="px-3 py-2">Pemilik Legal</th>
                  <th className="px-3 py-2 text-right">Nilai Pasar</th>
                  <th className="px-3 py-2">Pengikatan</th>
                  <th className="px-3 py-2">Pengingat</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((row) => (
                  <tr key={row.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-xs font-semibold text-primary">
                      {row.collateralCode}
                      {row.creditApplication && (
                        <div className="font-sans font-normal text-muted-foreground">{row.creditApplication.applicationNumber}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {row.customer?.legalName || "-"}
                      <div className="text-muted-foreground">{row.branch?.name || "-"}</div>
                    </td>
                    <td className="px-3 py-2 text-xs">{row.collateralType}</td>
                    <td className="px-3 py-2 text-xs">
                      {row.legalOwnerName}
                      {row.ownerRelationship && <div className="text-muted-foreground">{row.ownerRelationship}</div>}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{money(row.marketValue)}</td>
                    <td className="px-3 py-2 text-xs">
                      {row.bindingType || "-"}
                      <div className="text-muted-foreground">{row.bindingNumber || "-"}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        <ReminderBadge level={row.reminders?.appraisal} label="Taksasi" />
                        <ReminderBadge level={row.reminders?.binding} label="Ikatan" />
                        <ReminderBadge level={row.reminders?.insurance} label="Asuransi" />
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={row.status === "ACTIVE" ? "default" : "outline"} className="text-[10px]">
                        {row.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(row)} aria-label="Ubah agunan">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => void remove(row)} aria-label="Hapus agunan">
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {!loading && items.length === 0 && (
                  <tr><td colSpan={9} className="px-3 py-10 text-center text-sm text-muted-foreground">Belum ada data agunan.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Ubah Agunan" : "Tambah Agunan"}</DialogTitle>
            <DialogDescription>
              Nilai, penilai, dan daftar jenis mengikuti SOP yang disahkan. Riwayat taksasi tidak ditimpa.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Nasabah *</Label>
              <Select value={form.customerId} onValueChange={(v) => { set("customerId", v ?? ""); set("creditApplicationId", ""); }}>
                <SelectTrigger><SelectValue placeholder="Pilih nasabah" /></SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.customerNumber} — {c.legalName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Pengajuan Kredit (opsional)</Label>
              <Select value={form.creditApplicationId || "NONE"} onValueChange={(v) => set("creditApplicationId", !v || v === "NONE" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Tidak terhubung" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Tidak terhubung</SelectItem>
                  {appOptions.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.applicationNumber}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Kode Agunan</Label>
              <Input value={form.collateralCode} onChange={(e) => set("collateralCode", e.target.value)} placeholder="Otomatis bila kosong" />
            </div>
            <div className="space-y-1.5">
              <Label>Jenis Agunan *</Label>
              <Input value={form.collateralType} onChange={(e) => set("collateralType", e.target.value)} placeholder="SHM, BPKB, deposito..." />
            </div>
            <div className="space-y-1.5">
              <Label>Pemilik Legal *</Label>
              <Input value={form.legalOwnerName} onChange={(e) => set("legalOwnerName", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Hubungan dengan Debitur</Label>
              <Input value={form.ownerRelationship} onChange={(e) => set("ownerRelationship", e.target.value)} placeholder="Debitur, suami/istri, pihak ketiga" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Bukti Kepemilikan</Label>
              <Input value={form.ownershipProof} onChange={(e) => set("ownershipProof", e.target.value)} placeholder="Nomor sertifikat/BPKB" />
            </div>
            <div className="space-y-1.5"><Label>Nilai Pasar</Label><Input type="number" min="0" value={form.marketValue} onChange={(e) => set("marketValue", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>NJOP</Label><Input type="number" min="0" value={form.njopValue} onChange={(e) => set("njopValue", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Nilai Taksasi</Label><Input type="number" min="0" value={form.appraisedValue} onChange={(e) => set("appraisedValue", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Penilai</Label><Input value={form.appraiserName} onChange={(e) => set("appraiserName", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Metode Penilaian</Label><Input value={form.appraisalMethod} onChange={(e) => set("appraisalMethod", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Tanggal Taksasi</Label><Input type="date" value={form.appraisalDate} onChange={(e) => set("appraisalDate", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Jadwal Taksasi Ulang</Label><Input type="date" value={form.nextAppraisalDate} onChange={(e) => set("nextAppraisalDate", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Jenis Pengikatan</Label><Input value={form.bindingType} onChange={(e) => set("bindingType", e.target.value)} placeholder="HT, Fidusia, SKMHT..." /></div>
            <div className="space-y-1.5"><Label>Nomor Pengikatan</Label><Input value={form.bindingNumber} onChange={(e) => set("bindingNumber", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Tanggal Pengikatan</Label><Input type="date" value={form.bindingDate} onChange={(e) => set("bindingDate", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Kedaluwarsa Pengikatan</Label><Input type="date" value={form.bindingExpiryDate} onChange={(e) => set("bindingExpiryDate", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Penyedia Asuransi</Label><Input value={form.insuranceProvider} onChange={(e) => set("insuranceProvider", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Nomor Polis</Label><Input value={form.insurancePolicyNumber} onChange={(e) => set("insurancePolicyNumber", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Kedaluwarsa Asuransi</Label><Input type="date" value={form.insuranceExpiryDate} onChange={(e) => set("insuranceExpiryDate", e.target.value)} /></div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v ?? "ACTIVE")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Aktif</SelectItem>
                  <SelectItem value="RELEASED">Dilepas</SelectItem>
                  <SelectItem value="EXPIRED">Kedaluwarsa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Lokasi Fisik</Label>
              <textarea
                className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.locationAddress}
                onChange={(e) => set("locationAddress", e.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Catatan</Label>
              <textarea
                className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
              />
            </div>
            {editing && form.appraisalDate && (
              <label className="sm:col-span-2 flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={recordAppraisal} onChange={(e) => setRecordAppraisal(e.target.checked)} />
                Simpan nilai taksasi saat ini sebagai riwayat penilaian baru
              </label>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button onClick={() => void submit()} disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
