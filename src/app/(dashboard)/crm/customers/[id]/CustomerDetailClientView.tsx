"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  History,
  Users,
  FileCheck,
  FileText,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type HistoryRow = {
  id: string;
  action: string;
  changedFields: string[] | null;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  notes: string | null;
  createdAt: string;
  changedBy?: { fullName: string } | null;
  verifiedBy?: { fullName: string } | null;
};

type RelationshipRow = {
  id: string;
  relationshipType: string;
  relatedName: string | null;
  relatedIdentityNumber: string | null;
  notes: string | null;
  createdAt: string;
  relatedCustomer?: { id: string; customerNumber: string; legalName: string } | null;
};

type ConsentRow = {
  id: string;
  consentType: string;
  granted: boolean;
  policyVersion: string | null;
  evidenceRef: string | null;
  grantedAt: string | null;
  revokedAt: string | null;
  notes: string | null;
  createdAt: string;
};

type AppRow = {
  id: string;
  applicationNumber: string;
  status: string;
  requestedAmount: number | null;
  createdAt: string;
};

export type CustomerDetail = {
  id: string;
  customerNumber: string;
  customerType: string;
  status: string;
  legalName: string;
  nickname: string | null;
  identityType: string | null;
  identityNumber: string | null;
  npwp: string | null;
  birthPlace: string | null;
  birthDate: string | null;
  gender: string | null;
  address: string | null;
  rtRw: string | null;
  kelurahan: string | null;
  kecamatan: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  phone: string | null;
  email: string | null;
  occupation: string | null;
  employerName: string | null;
  monthlyIncome: number | null;
  branch?: { id: string; name: string } | null;
  createdBy?: { fullName: string } | null;
  updatedBy?: { fullName: string } | null;
  verifiedBy?: { fullName: string } | null;
  verifiedAt: string | null;
  createdAt: string;
  identityHistories: HistoryRow[];
  relationshipsAsSubject: RelationshipRow[];
  consents: ConsentRow[];
  creditApplications: AppRow[];
};

const RELATIONSHIP_TYPES = ["SPOUSE", "GUARANTOR", "UBO", "FAMILY", "BUSINESS_PARTNER", "OTHER"];
const RELATIONSHIP_LABELS: Record<string, string> = {
  SPOUSE: "Pasangan",
  GUARANTOR: "Penjamin",
  UBO: "Pemilik Manfaat (UBO)",
  FAMILY: "Keluarga",
  BUSINESS_PARTNER: "Mitra Usaha",
  OTHER: "Lainnya",
};

const CONSENT_TYPES = ["DATA_PROCESSING", "DATA_SHARING", "MARKETING", "CREDIT_CHECK"];
const CONSENT_LABELS: Record<string, string> = {
  DATA_PROCESSING: "Pemrosesan Data Pribadi",
  DATA_SHARING: "Berbagi Data",
  MARKETING: "Pemasaran",
  CREDIT_CHECK: "Pengecekan Kredit",
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-2 gap-2 pb-2 border-b last:border-0">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="font-medium text-sm">{value || "-"}</span>
    </div>
  );
}

export function CustomerDetailClientView({ customer }: { customer: CustomerDetail }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [relForm, setRelForm] = useState({
    relationshipType: "SPOUSE",
    relatedName: "",
    relatedIdentityNumber: "",
    notes: "",
  });
  const [consentForm, setConsentForm] = useState({
    consentType: "DATA_PROCESSING",
    policyVersion: "v1",
    evidenceRef: "",
    notes: "",
  });

  const call = async (url: string, method: string, body?: unknown) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Operasi gagal.");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("Terjadi kesalahan sistem.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = () => call(`/api/crm/customers/${customer.id}/verify`, "POST", {});

  const handleAddRelationship = async () => {
    const ok = await call(`/api/crm/customers/${customer.id}/relationships`, "POST", relForm);
    if (ok) setRelForm({ relationshipType: "SPOUSE", relatedName: "", relatedIdentityNumber: "", notes: "" });
  };

  const handleRemoveRelationship = (rid: string) =>
    call(`/api/crm/customers/${customer.id}/relationships/${rid}`, "DELETE");

  const handleRecordConsent = async (granted: boolean) => {
    const ok = await call(`/api/crm/customers/${customer.id}/consents`, "POST", { ...consentForm, granted });
    if (ok) setConsentForm({ ...consentForm, evidenceRef: "", notes: "" });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <Link href="/crm/customers" className="text-sm text-muted-foreground hover:underline flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Daftar Nasabah
          </Link>
          <h1 className="text-3xl font-bold tracking-tight mt-1 flex items-center gap-3">
            {customer.legalName}
            <Badge variant={customer.status === "AKTIF" ? "success" : "secondary"}>{customer.status}</Badge>
            {customer.verifiedAt ? (
              <Badge variant="success" className="flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Terverifikasi</Badge>
            ) : (
              <Badge variant="warning" className="flex items-center gap-1"><ShieldAlert className="h-3 w-3" /> Belum diverifikasi</Badge>
            )}
          </h1>
          <p className="text-muted-foreground mt-1 font-mono text-sm">{customer.customerNumber} • {customer.customerType}</p>
        </div>
        {!customer.verifiedAt && (
          <Button onClick={handleVerify} disabled={busy} className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Verifikasi Identitas
          </Button>
        )}
      </div>

      {error && <div className="bg-destructive/15 text-destructive p-3 rounded-md text-sm">{error}</div>}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Identitas & Kontak</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Field label="Jenis Nasabah" value={customer.customerType === "BADAN" ? "Badan Usaha" : "Individu"} />
            <Field label="Nama Panggilan" value={customer.nickname || ""} />
            <Field label="Jenis Identitas" value={customer.identityType || ""} />
            <Field label="Nomor Identitas" value={customer.identityNumber || ""} />
            <Field label="NPWP" value={customer.npwp || ""} />
            <Field label="Tempat / Tanggal Lahir" value={[customer.birthPlace, customer.birthDate ? new Date(customer.birthDate).toLocaleDateString("id-ID") : ""].filter(Boolean).join(", ")} />
            <Field label="Alamat" value={[customer.address, customer.rtRw, customer.kelurahan, customer.kecamatan, customer.city, customer.province, customer.postalCode].filter(Boolean).join(", ")} />
            <Field label="Telepon" value={customer.phone || ""} />
            <Field label="Email" value={customer.email || ""} />
            <Field label="Pekerjaan / Usaha" value={[customer.occupation, customer.employerName].filter(Boolean).join(" • ")} />
            <Field label="Penghasilan / Bulan" value={customer.monthlyIncome ? `Rp ${customer.monthlyIncome.toLocaleString("id-ID")}` : ""} />
            <Field label="Cabang" value={customer.branch?.name || ""} />
            <Field label="Dibuat Oleh" value={customer.createdBy?.fullName || ""} />
            <Field label="Diubah Oleh" value={customer.updatedBy?.fullName || ""} />
            <Field label="Diverifikasi Oleh" value={customer.verifiedBy?.fullName ? `${customer.verifiedBy.fullName} (${customer.verifiedAt ? new Date(customer.verifiedAt).toLocaleString("id-ID") : "-"})` : ""} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Pengajuan Kredit</CardTitle>
            <CardDescription>{customer.creditApplications.length} pengajuan terkait</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {customer.creditApplications.length === 0 && <p className="text-muted-foreground">Belum ada pengajuan.</p>}
            {customer.creditApplications.map((a) => (
              <div key={a.id} className="flex items-center justify-between border-b pb-1 last:border-0">
                <Link href={`/credit/applications/${a.id}`} className="text-primary hover:underline font-medium">{a.applicationNumber}</Link>
                <span className="text-xs text-muted-foreground">{a.status}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><History className="h-4 w-4 text-primary" /> Riwayat Perubahan Identitas</CardTitle>
          <CardDescription>Catatan siapa mengubah, kapan, field apa, dan nilai lama/baru.</CardDescription>
        </CardHeader>
        <CardContent>
          {customer.identityHistories.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada riwayat.</p>
          ) : (
            <div className="space-y-3">
              {customer.identityHistories.map((h) => (
                <div key={h.id} className="border rounded-md p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <Badge variant={h.action === "CREATE" ? "info" : h.action === "VERIFY" ? "success" : "warning"}>{h.action}</Badge>
                    <span className="text-xs text-muted-foreground">{new Date(h.createdAt).toLocaleString("id-ID")}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Oleh: {h.changedBy?.fullName || "Sistem"}
                    {h.verifiedBy?.fullName ? ` • Verifikator: ${h.verifiedBy.fullName}` : ""}
                  </p>
                  {h.changedFields && h.changedFields.length > 0 && (
                    <p className="text-xs mt-1">Field: {h.changedFields.join(", ")}</p>
                  )}
                  {h.notes && <p className="text-xs mt-1 italic">{h.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Hubungan Antar-Pihak</CardTitle>
          <CardDescription>Pasangan, penjamin, pemilik manfaat (UBO), dan pihak terkait lainnya.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {customer.relationshipsAsSubject.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada hubungan tercatat.</p>
          ) : (
            <div className="space-y-2">
              {customer.relationshipsAsSubject.map((r) => (
                <div key={r.id} className="flex items-center justify-between border rounded-md p-2.5 text-sm">
                  <div>
                    <Badge variant="outline" className="mr-2">{RELATIONSHIP_LABELS[r.relationshipType] || r.relationshipType}</Badge>
                    {r.relatedCustomer ? (
                      <Link href={`/crm/customers/${r.relatedCustomer.id}`} className="text-primary hover:underline">
                        {r.relatedCustomer.legalName} ({r.relatedCustomer.customerNumber})
                      </Link>
                    ) : (
                      <span>{r.relatedName || "-"}{r.relatedIdentityNumber ? ` • ${r.relatedIdentityNumber}` : ""}</span>
                    )}
                    {r.notes && <span className="text-xs text-muted-foreground block">{r.notes}</span>}
                  </div>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleRemoveRelationship(r.id)} disabled={busy}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="border-t pt-3 grid gap-2 md:grid-cols-4">
            <select
              value={relForm.relationshipType}
              onChange={(e) => setRelForm({ ...relForm, relationshipType: e.target.value })}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
            >
              {RELATIONSHIP_TYPES.map((t) => (
                <option key={t} value={t}>{RELATIONSHIP_LABELS[t]}</option>
              ))}
            </select>
            <Input placeholder="Nama pihak terkait" value={relForm.relatedName} onChange={(e) => setRelForm({ ...relForm, relatedName: e.target.value })} />
            <Input placeholder="NIK/ID pihak terkait (opsional)" value={relForm.relatedIdentityNumber} onChange={(e) => setRelForm({ ...relForm, relatedIdentityNumber: e.target.value })} />
            <Button onClick={handleAddRelationship} disabled={busy} className="flex items-center gap-1">
              <Plus className="h-4 w-4" /> Tambah
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><FileCheck className="h-4 w-4 text-primary" /> Persetujuan Pemrosesan Data Pribadi</CardTitle>
          <CardDescription>Catatan bukti persetujuan dan pencabutannya sesuai kebijakan yang disahkan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {customer.consents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada catatan persetujuan.</p>
          ) : (
            <div className="space-y-2">
              {customer.consents.map((c) => (
                <div key={c.id} className="flex items-center justify-between border rounded-md p-2.5 text-sm">
                  <div>
                    <Badge variant="outline" className="mr-2">{CONSENT_LABELS[c.consentType] || c.consentType}</Badge>
                    <span>{c.policyVersion ? `Kebijakan ${c.policyVersion}` : ""}</span>
                    {c.evidenceRef && <span className="text-xs text-muted-foreground block">Bukti: {c.evidenceRef}</span>}
                  </div>
                  <Badge variant={c.granted ? "success" : "destructive"}>
                    {c.granted ? `Diberikan ${c.grantedAt ? new Date(c.grantedAt).toLocaleDateString("id-ID") : ""}` : `Dicabut ${c.revokedAt ? new Date(c.revokedAt).toLocaleDateString("id-ID") : ""}`}
                  </Badge>
                </div>
              ))}
            </div>
          )}

          <div className="border-t pt-3 grid gap-2 md:grid-cols-4">
            <select
              value={consentForm.consentType}
              onChange={(e) => setConsentForm({ ...consentForm, consentType: e.target.value })}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
            >
              {CONSENT_TYPES.map((t) => (
                <option key={t} value={t}>{CONSENT_LABELS[t]}</option>
              ))}
            </select>
            <Input placeholder="Versi kebijakan" value={consentForm.policyVersion} onChange={(e) => setConsentForm({ ...consentForm, policyVersion: e.target.value })} />
            <Input placeholder="Referensi bukti (opsional)" value={consentForm.evidenceRef} onChange={(e) => setConsentForm({ ...consentForm, evidenceRef: e.target.value })} />
            <div className="flex gap-2">
              <Button onClick={() => handleRecordConsent(true)} disabled={busy} className="flex-1">Beri</Button>
              <Button variant="destructive" onClick={() => handleRecordConsent(false)} disabled={busy} className="flex-1">Cabut</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
