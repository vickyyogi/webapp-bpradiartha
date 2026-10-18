"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  FileText,
  MapPin,
  Save,
  ShieldCheck,
  Users,
  DollarSign,
  History,
  CheckSquare,
  Loader2,
  Upload,
  Download,
} from "lucide-react";
import { formatRupiah, type SlikAnalysis } from "@/lib/slik/types";
import { isContinuationStatus, OVERRIDE_REASON_MIN_LENGTH, overrideRoleLabel } from "@/lib/slik/override";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type AnalysisData = {
  slikStatus?: string;
  characterNotes?: string;
  monthlyIncome?: string | number;
  monthlyExpense?: string | number;
  installmentCapacity?: string | number;
  dsrRatio?: string | number;
  collateralType?: string;
  collateralAddress?: string;
  marketValue?: string | number;
  liquidationValue?: string | number;
  businessCondition?: string;
  marketRisk?: string;
  analystRecommendation?: string;
  analystNotes?: string;
};

type SurveyData = {
  surveyDate?: string;
  surveyLocation?: string;
  interviewee?: string;
  businessStatus?: string;
  physicalCondition?: string;
  surveyFindingNotes?: string;
  surveyRecommendation?: string;
};

type StatusHistoryItem = {
  id: string;
  status: string;
  notes?: string | null;
  createdAt: string | Date;
  changedBy?: { fullName?: string | null; email?: string | null } | null;
};

type ApprovalRecordItem = {
  id: string;
  approverRoleName: string;
  status: string;
  approvedAmount?: number | null;
  notes?: string | null;
  createdAt: string | Date;
  approver?: { fullName?: string | null } | null;
};

type DocumentItem = {
  id: string;
  fileName: string;
  documentType: string;
  notes?: string | null;
  createdAt: string | Date;
  downloadUrl?: string;
  uploadedBy?: { fullName?: string | null } | null;
};

/** Ringkasan hasil analisa SLIK tersimpan (Tahap 5 — integrasi pipeline kredit). */
type SlikAnalysisSummary = {
  id: string;
  linkedToApplication: boolean;
  customerName: string;
  sourceFileNames?: string[] | null;
  mode: string;
  rekomendasi: string;
  riskRating?: string | null;
  modelUsed?: string | null;
  createdAt: string | Date;
  totalBakiDebet?: number | null;
  totalTunggakanReal?: number | null;
  kualitasTerburuk?: string | null;
  namaPadaDokumen?: string | null;
};

/** Alasan penerusan pengajuan meski rekomendasi AI = REJECT (Tahap 5B). */
type SlikOverrideItem = {
  id: string;
  slikAnalysisRecordId?: string | null;
  rekomendasi: string;
  reason: string;
  recordedByName: string;
  recordedByRole: string;
  createdAt: string | Date;
};

/** Status gate penerusan pengajuan terkait rekomendasi AI. */
type SlikGateState = {
  active: boolean;
  latestRekomendasi?: string | null;
  latestAnalysisDate?: string | Date | null;
  override?: {
    reason: string;
    recordedByName: string;
    recordedByRole: string;
    createdAt: string | Date;
  } | null;
};

type OverrideTarget =
  | { kind: "transition"; nextStatus: string; defaultNote: string }
  | { kind: "decision"; nextStatus: string; statusOverride?: string };

type CreditApplicationDetail = {
  id: string;
  applicationNumber: string;
  status: string;
  product?: string | null;
  requestedAmount?: number | null;
  requestedTenorMonths?: number | null;
  purpose?: string | null;
  source?: string | null;
  notes?: string | null;
  submissionDate?: string | Date | null;
  approvedAmount?: number | null;
  approvedTenorMonths?: number | null;
  interestRate?: number | null;
  conditions?: string | null;
  decisionNotes?: string | null;
  decisionDate?: string | Date | null;
  realizationReference?: string | null;
  realizationAmount?: number | null;
  realizationDate?: string | Date | null;
  analysisData?: AnalysisData | null;
  surveyData?: SurveyData | null;
  customer?: { id?: string | null; legalName?: string | null; phone?: string | null; email?: string | null } | null;
  branch?: { name?: string | null } | null;
  marketingOfficer?: { fullName?: string | null } | null;
  analyst?: { fullName?: string | null } | null;
  surveyOfficer?: { fullName?: string | null } | null;
  decisionMaker?: { fullName?: string | null } | null;
  statusHistories?: StatusHistoryItem[];
  approvalRecords?: ApprovalRecordItem[];
};

const STATUS_ORDER: Array<{
  key: string;
  label: string;
  desc: string;
}> = [
  { key: "DRAFT", label: "Draft", desc: "Penyusunan berkas" },
  { key: "SUBMITTED", label: "Diajukan", desc: "Masuk antrean" },
  { key: "VERIFICATION", label: "Verifikasi", desc: "Cek kelengkapan dokumen" },
  { key: "ANALYSIS", label: "Analisis", desc: "Penilaian 5C & kapasitas" },
  { key: "SURVEY", label: "Survey", desc: "Kunjungan & cek fisik usaha" },
  { key: "REVIEW", label: "Review", desc: "Evaluasi pimpinan kredit" },
  { key: "DECISION", label: "Keputusan", desc: "Sidang komite pemutus" },
  { key: "APPROVED", label: "Disetujui", desc: "Siap realisasi akad" },
];

function slikRekomendasiVariant(rekomendasi: string): "success" | "destructive" | "warning" {
  if (rekomendasi === "APPROVE") return "success";
  if (rekomendasi === "CONSIDER") return "warning";
  return "destructive";
}

/**
 * Tahap 5B: status SLIK pada formulir 5C TIDAK diisi manual — diturunkan dari
 * hasil analisa SLIK terbaru (kualitas/kolektibilitas terburuk hasil ekstraksi
 * AI), lalu dipetakan ke label kolektibilitas SLIK yang lazim.
 */
function deriveSlikStatus(analyses: SlikAnalysisSummary[]): string {
  const raw = analyses[0]?.kualitasTerburuk?.trim();
  if (!raw) return "";
  const upper = raw.toUpperCase();
  // Urutan penting: "KURANG LANCAR" mengandung kata "LANCAR".
  if (upper.includes("5") || upper.includes("MACET")) return "MACET (Kol 5)";
  if (upper.includes("4") || upper.includes("DIRAGUKAN")) return "DIRAGUKAN (Kol 4)";
  if (upper.includes("3") || upper.includes("KURANG")) return "KURANG LANCAR (Kol 3)";
  if (upper.includes("2") || upper.includes("DPK") || upper.includes("PERHATIAN")) return "DPK (Kol 2)";
  if (upper.includes("1") || upper.includes("LANCAR")) return "LANCAR (Kol 1)";
  return raw;
}

export function CreditApplicationDetailClientView({
  application: initialApp,
  initialDocuments = [],
  initialSlikAnalyses = [],
  slikGate,
  slikOverrides = [],
}: {
  application: CreditApplicationDetail;
  users: Array<{ id: string; fullName: string; email: string }>;
  initialDocuments?: DocumentItem[];
  initialSlikAnalyses?: SlikAnalysisSummary[];
  slikGate?: SlikGateState;
  slikOverrides?: SlikOverrideItem[];
}) {
  const [app, setApp] = useState(initialApp);
  const [slikAnalyses] = useState<SlikAnalysisSummary[]>(initialSlikAnalyses);
  const [downloadingSlikId, setDownloadingSlikId] = useState<string | null>(null);

  // Tahap 5B: dialog alasan penerusan pengajuan meski rekomendasi AI = REJECT.
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [overrideTarget, setOverrideTarget] = useState<OverrideTarget | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideError, setOverrideError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"summary" | "analysis" | "survey" | "decision" | "realization" | "history" | "documents">("summary");
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Documents State
  const [documents, setDocuments] = useState<DocumentItem[]>(initialDocuments);
  const [isUploadDocOpen, setIsUploadDocOpen] = useState(false);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docType, setDocType] = useState("KTP");
  const [docNotes, setDocNotes] = useState("");

  // Analysis Form State (5C)
  const existingAnalysis: AnalysisData = app.analysisData || {};
  const [analysisData, setAnalysisData] = useState({
    characterNotes: existingAnalysis.characterNotes || "",
    monthlyIncome: existingAnalysis.monthlyIncome || "",
    monthlyExpense: existingAnalysis.monthlyExpense || "",
    installmentCapacity: existingAnalysis.installmentCapacity || "",
    dsrRatio: existingAnalysis.dsrRatio || "",
    collateralType: existingAnalysis.collateralType || "SHM (Sertifikat Hak Milik)",
    collateralAddress: existingAnalysis.collateralAddress || "",
    marketValue: existingAnalysis.marketValue || "",
    liquidationValue: existingAnalysis.liquidationValue || "",
    businessCondition: existingAnalysis.businessCondition || "",
    marketRisk: existingAnalysis.marketRisk || "Rendah",
    analystRecommendation: existingAnalysis.analystRecommendation || "LAYAK",
    analystNotes: existingAnalysis.analystNotes || "",
  });

  // Survey Form State
  const existingSurvey: SurveyData = app.surveyData || {};
  const [surveyData, setSurveyData] = useState({
    surveyDate: existingSurvey.surveyDate || "",
    surveyLocation: existingSurvey.surveyLocation || "",
    interviewee: existingSurvey.interviewee || "",
    businessStatus: existingSurvey.businessStatus || "Aktif Beroperasi",
    physicalCondition: existingSurvey.physicalCondition || "",
    surveyFindingNotes: existingSurvey.surveyFindingNotes || "",
    surveyRecommendation: existingSurvey.surveyRecommendation || "DIREKOMENDASIKAN",
  });

  // Decision Form State
  const [decisionData, setDecisionData] = useState({
    approvedAmount: app.approvedAmount ? app.approvedAmount.toString() : app.requestedAmount ? app.requestedAmount.toString() : "",
    approvedTenorMonths: app.approvedTenorMonths ? app.approvedTenorMonths.toString() : app.requestedTenorMonths ? app.requestedTenorMonths.toString() : "12",
    interestRate: app.interestRate ? app.interestRate.toString() : "12.0",
    conditions: app.conditions || "1. Asuransi Jiwa & Agunan lunas sebelum pencairan.\n2. Buka rekening tabungan operasional BPR.\n3. Blokir 1x angsuran.",
    decisionNotes: app.decisionNotes || "",
    status: app.status,
    statusChangeNote: "",
  });

  // Realization Form State
  const [realizationData, setRealizationData] = useState({
    realizationReference: app.realizationReference || `PK-${app.applicationNumber}`,
    realizationAmount: app.realizationAmount ? app.realizationAmount.toString() : app.approvedAmount ? app.approvedAmount.toString() : "",
    realizationDate: app.realizationDate ? new Date(app.realizationDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
  });

  const showNotification = (type: "success" | "error", text: string) => {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  /** Unduh ulang laporan PDF hasil analisa SLIK tersimpan (audit tercatat di server). */
  const downloadSlikReport = async (recordId: string) => {
    setDownloadingSlikId(recordId);
    try {
      const res = await fetch(`/api/slik/analyses/${recordId}/download`);
      const payload = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: SlikAnalysis;
        error?: string;
      };
      if (!res.ok || !payload?.success || !payload.data) {
        throw new Error(payload?.error || "Gagal mengambil data analisa SLIK tersimpan.");
      }
      const { downloadSlikReportPdf } = await import("@/lib/slik/generateSlikReport");
      await downloadSlikReportPdf(payload.data);
    } catch (error) {
      showNotification(
        "error",
        error instanceof Error ? error.message : "Gagal menyusun laporan PDF SLIK."
      );
    } finally {
      setDownloadingSlikId(null);
    }
  };

  const handleSaveAnalysis = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/credit/applications/${app.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Status SLIK diturunkan dari hasil analisa — bukan isian manual.
          analysisData: { ...analysisData, slikStatus: deriveSlikStatus(slikAnalyses) },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menyimpan analisis.");
      setApp(json.data);
      showNotification("success", "Analisis Kelayakan 5C berhasil disimpan!");
    } catch (e) {
      showNotification("error", e instanceof Error ? e.message : "");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSurvey = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/credit/applications/${app.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surveyData }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menyimpan data survey.");
      setApp(json.data);
      showNotification("success", "Hasil survey lapangan berhasil disimpan!");
    } catch (e) {
      showNotification("error", e instanceof Error ? e.message : "");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDecision = async (statusOverride?: string, slikOverrideReason = "") => {
    setIsSaving(true);
    try {
      const payload = {
        ...decisionData,
        status: statusOverride || decisionData.status,
        ...(slikOverrideReason ? { slikOverrideReason } : {}),
      };

      const res = await fetch(`/api/credit/applications/${app.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menyimpan keputusan.");
      setApp(json.data);
      setDecisionData((prev) => ({ ...prev, status: json.data.status, statusChangeNote: "" }));
      showNotification("success", `Keputusan kredit status ${json.data.status} berhasil dicatat.`);
    } catch (e) {
      showNotification("error", e instanceof Error ? e.message : "");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveRealization = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/credit/applications/${app.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(realizationData),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal mencatat realisasi.");
      setApp(json.data);
      showNotification("success", "Pencatatan realisasi kredit berhasil disimpan!");
    } catch (e) {
      showNotification("error", e instanceof Error ? e.message : "");
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickStatusTransition = async (nextStatus: string, defaultNote: string, slikOverrideReason = "") => {
    if (!confirm(`Ubah status pengajuan menjadi "${nextStatus}"?`)) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/credit/applications/${app.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          statusChangeNote: defaultNote,
          ...(slikOverrideReason ? { slikOverrideReason } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memperbarui status.");
      setApp(json.data);
      showNotification("success", `Status pengajuan berhasil diubah menjadi ${nextStatus}.`);
    } catch (e) {
      showNotification("error", e instanceof Error ? e.message : "");
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Tahap 5B: bila rekomendasi AI terakhir = REJECT dan pengajuan diteruskan,
   * minta alasan penerusan (diisi Account Officer / petugas survei) lebih dulu.
   */
  const requestStatusTransition = (nextStatus: string, defaultNote: string) => {
    if (!slikGate?.active || !isContinuationStatus(nextStatus)) {
      void handleQuickStatusTransition(nextStatus, defaultNote);
      return;
    }
    setOverrideTarget({ kind: "transition", nextStatus, defaultNote });
    setOverrideReason("");
    setOverrideError(null);
    setOverrideDialogOpen(true);
  };

  /** Versi ber-gate untuk pencatatan keputusan (APPROVED/RETURNED/REJECTED). */
  const requestSaveDecision = (statusOverride?: string) => {
    const targetStatus = statusOverride || decisionData.status;
    if (!slikGate?.active || !isContinuationStatus(targetStatus)) {
      void handleSaveDecision(statusOverride);
      return;
    }
    setOverrideTarget({ kind: "decision", nextStatus: targetStatus, statusOverride });
    setOverrideReason("");
    setOverrideError(null);
    setOverrideDialogOpen(true);
  };

  const confirmOverride = async () => {
    if (!overrideTarget) return;
    const reason = overrideReason.trim();
    if (reason.length < OVERRIDE_REASON_MIN_LENGTH) {
      setOverrideError(`Alasan penerusan minimal ${OVERRIDE_REASON_MIN_LENGTH} karakter.`);
      return;
    }
    const target = overrideTarget;
    setOverrideDialogOpen(false);
    setOverrideTarget(null);
    setOverrideReason("");
    setOverrideError(null);
    if (target.kind === "transition") {
      await handleQuickStatusTransition(target.nextStatus, target.defaultNote, reason);
    } else {
      await handleSaveDecision(target.statusOverride, reason);
    }
  };

  const handleUploadDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docFile) return;
    setIsUploadingDoc(true);
    try {
      const formData = new FormData();
      formData.append("file", docFile);
      formData.append("documentType", docType);
      formData.append("ownerType", "CREDIT_APPLICATION");
      formData.append("ownerId", app.id);
      formData.append("notes", docNotes);

      const res = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal mengunggah dokumen");

      setDocuments([json.data, ...documents]);
      setIsUploadDocOpen(false);
      setDocFile(null);
      setDocNotes("");
      showNotification("success", "Dokumen berhasil diunggah ke berkas pengajuan ini!");
    } catch (e) {
      showNotification("error", e instanceof Error ? e.message : "");
    } finally {
      setIsUploadingDoc(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Navigation */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/credit/applications">
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Kembali
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{app.applicationNumber}</h1>
              <Badge
                variant={
                  app.status === "APPROVED"
                    ? "success"
                    : app.status === "REJECTED" || app.status === "RETURNED"
                    ? "destructive"
                    : "info"
                }
              >
                {app.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Pemohon: <span className="font-medium text-foreground">{app.customer?.legalName}</span> • Kantor: {app.branch?.name || "-"} • Tanggal: {app.submissionDate ? new Date(app.submissionDate).toLocaleDateString("id-ID") : "-"}
            </p>
          </div>
        </div>

        {/* Quick Stepper Action */}
        <div className="flex items-center gap-2">
          {app.status === "SUBMITTED" && (
            <Button
              size="sm"
              onClick={() => requestStatusTransition("VERIFICATION", "Berkas diterima & masuk tahap verifikasi")}
              disabled={isSaving}
            >
              Mulai Verifikasi Berkas
            </Button>
          )}
          {app.status === "VERIFICATION" && (
            <Button
              size="sm"
              onClick={() => requestStatusTransition("ANALYSIS", "Verifikasi lengkap, dialihkan ke analis kredit")}
              disabled={isSaving}
            >
              Lanjutkan ke Analisis 5C
            </Button>
          )}
          {app.status === "ANALYSIS" && (
            <Button
              size="sm"
              onClick={() => requestStatusTransition("SURVEY", "Analisis awal selesai, penugasan survey lapangan")}
              disabled={isSaving}
            >
              Tugaskan Survey Lapangan
            </Button>
          )}
          {app.status === "SURVEY" && (
            <Button
              size="sm"
              onClick={() => requestStatusTransition("REVIEW", "Hasil survey lengkap, berkas diajukan untuk review")}
              disabled={isSaving}
            >
              Ajukan Review Komite
            </Button>
          )}
          {app.status === "REVIEW" && (
            <Button
              size="sm"
              onClick={() => requestStatusTransition("DECISION", "Review selesai, siap untuk keputusan akhir")}
              disabled={isSaving}
            >
              Sidang Keputusan Komite
            </Button>
          )}
        </div>
      </div>

      {feedbackMsg && (
        <div
          className={`p-3 rounded-md text-sm ${
            feedbackMsg.type === "success"
              ? "bg-green-100 text-green-900 border border-green-200"
              : "bg-red-100 text-red-900 border border-red-200"
          }`}
        >
          {feedbackMsg.text}
        </div>
      )}

      {/* Lifecycle Progress Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Alur Lifecycle Permohonan Kredit
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
            {STATUS_ORDER.map((item, idx) => {
              const isCurrent = app.status === item.key;
              const isPast = STATUS_ORDER.findIndex((s) => s.key === app.status) > idx;
              return (
                <div
                  key={item.key}
                  className={`p-2.5 rounded-lg border text-center transition-all ${
                    isCurrent
                      ? "border-primary bg-primary/10 text-primary font-semibold shadow-xs"
                      : isPast
                      ? "border-green-300 bg-green-50 text-green-800 dark:bg-green-950/20"
                      : "border-muted bg-muted/20 text-muted-foreground"
                  }`}
                >
                  <div className="text-xs font-bold">{item.label}</div>
                  <div className="text-[10px] truncate mt-0.5">{item.desc}</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Tabs Control */}
      <div className="flex border-b border-border gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("summary")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
            activeTab === "summary"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          1. Ringkasan Permohonan
        </button>
        <button
          onClick={() => setActiveTab("analysis")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
            activeTab === "analysis"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          2. Analisis Kelayakan 5C
        </button>
        <button
          onClick={() => setActiveTab("survey")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
            activeTab === "survey"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          3. Survey Lapangan
        </button>
        <button
          onClick={() => setActiveTab("decision")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
            activeTab === "decision"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          4. Keputusan Komite
        </button>
        <button
          onClick={() => setActiveTab("realization")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
            activeTab === "realization"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          5. Realisasi / Pencairan
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
            activeTab === "history"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          6. Riwayat Status ({app.statusHistories?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab("documents")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
            activeTab === "documents"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          7. Dokumen Berkas ({documents.length})
        </button>
      </div>

      {/* TAB 1: SUMMARY */}
      {activeTab === "summary" && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" /> Rincian Fasilitas Kredit
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2 pb-2 border-b">
                <span className="text-muted-foreground">Produk Kredit:</span>
                <span className="font-semibold">{app.product || "-"}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pb-2 border-b">
                <span className="text-muted-foreground">Plafon Dimohon:</span>
                <span className="font-semibold text-primary">
                  {app.requestedAmount ? `Rp ${app.requestedAmount.toLocaleString("id-ID")}` : "-"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 pb-2 border-b">
                <span className="text-muted-foreground">Jangka Waktu (Tenor):</span>
                <span className="font-semibold">{app.requestedTenorMonths ? `${app.requestedTenorMonths} Bulan` : "-"}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pb-2 border-b">
                <span className="text-muted-foreground">Sumber Pengajuan:</span>
                <span className="font-semibold">{app.source || "-"}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pb-2 border-b">
                <span className="text-muted-foreground">Tujuan Pinjaman:</span>
                <span className="font-semibold">{app.purpose || "-"}</span>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground">Catatan Tambahan:</span>
                <p className="bg-muted/40 p-2.5 rounded-md text-xs">{app.notes || "Tidak ada catatan khusus."}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" /> Data Debitur & Penugasan Petugas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2 pb-2 border-b">
                <span className="text-muted-foreground">Nama Debitur:</span>
                <span className="font-semibold">{app.customer?.legalName || "-"}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pb-2 border-b">
                <span className="text-muted-foreground">Kontak Telepon:</span>
                <span className="font-semibold">{app.customer?.phone || "-"}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pb-2 border-b">
                <span className="text-muted-foreground">Email:</span>
                <span className="font-semibold">{app.customer?.email || "-"}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pb-2 border-b">
                <span className="text-muted-foreground">Kantor Cabang:</span>
                <span className="font-semibold">{app.branch?.name || "-"}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pb-2 border-b">
                <span className="text-muted-foreground">Account Officer (Mkt):</span>
                <span className="font-semibold">{app.marketingOfficer?.fullName || "Belum ditugaskan"}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pb-2 border-b">
                <span className="text-muted-foreground">Analis Kredit:</span>
                <span className="font-semibold">{app.analyst?.fullName || "Belum ditugaskan"}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <span className="text-muted-foreground">Surveyor Lapangan:</span>
                <span className="font-semibold">{app.surveyOfficer?.fullName || "Belum ditugaskan"}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 2: 5C ANALYSIS (Configurable per Section 11) */}
      {activeTab === "analysis" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" /> Formulir Analisis Kelayakan Kredit (Prinsip 5C)
            </CardTitle>
            <CardDescription>
              Penilaian komprehensif aspek karakter, kemampuan bayar (capacity), modal, agunan jaminan, dan prospek usaha.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Tahap 5 (P0.5): hasil analisa SLIK masuk ke pipeline pengajuan kredit */}
            <div className="space-y-3 rounded-lg border border-primary/30 bg-primary-soft/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold flex items-center gap-2 text-primary">
                  <ShieldCheck className="h-4 w-4" /> Hasil Analisa SLIK OJK (AI) — Bahan Verifikasi
                </h3>
                <Link
                  href={`/credit/slik-analyzer?customerId=${app.customer?.id ?? ""}&applicationId=${app.id}`}
                >
                  <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
                    <Upload className="h-3.5 w-3.5" />{" "}
                    {slikAnalyses.length > 0 ? "Analisa Ulang" : "Jalankan Analisa SLIK"}
                  </Button>
                </Link>
              </div>
              <p className="text-xs text-muted-foreground">
                Hasil ekstraksi AI untuk mempercepat penilaian Character &amp; Capacity —{" "}
                <span className="font-medium text-foreground">bukan keputusan kredit final</span>.
                Wajib diverifikasi manual terhadap dokumen SLIK asli.
              </p>
              {/* Tahap 5B: gate penerusan meski rekomendasi AI = REJECT */}
              {slikGate?.active && (
                <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-900 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <p className="leading-relaxed">
                    <span className="font-semibold">Rekomendasi AI terakhir: REJECT.</span>{" "}
                    Pengajuan hanya dapat dilanjutkan setelah{" "}
                    <span className="font-semibold">Account Officer atau petugas survei lapangan</span>{" "}
                    mengisi alasan penerusan — dialognya muncul otomatis saat tombol lanjut/keputusan ditekan.
                  </p>
                </div>
              )}
              {slikGate?.override && (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-2.5 text-xs dark:border-emerald-900 dark:bg-emerald-950/20">
                  <p className="font-semibold text-emerald-800 dark:text-emerald-400">
                    Diteruskan meski rekomendasi AI REJECT
                  </p>
                  <p className="mt-1 leading-relaxed text-muted-foreground">
                    {overrideRoleLabel(slikGate.override.recordedByRole === "SURVEY" ? "SURVEY" : "AO")}{" "}
                    ({slikGate.override.recordedByName}) ·{" "}
                    {new Date(slikGate.override.createdAt).toLocaleString("id-ID")}:{" "}
                    <span className="italic">{slikGate.override.reason}</span>
                  </p>
                </div>
              )}
              {slikAnalyses.length === 0 ? (
                <p className="text-xs italic text-muted-foreground">
                  Belum ada hasil analisa SLIK untuk debitur ini.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
                    <div className="rounded-md border border-border bg-background p-2">
                      <p className="text-muted-foreground">Total Baki Debet (AI)</p>
                      <p className="font-semibold">{formatRupiah(slikAnalyses[0].totalBakiDebet ?? 0)}</p>
                    </div>
                    <div className="rounded-md border border-border bg-background p-2">
                      <p className="text-muted-foreground">Total Tunggakan (AI)</p>
                      <p className="font-semibold">{formatRupiah(slikAnalyses[0].totalTunggakanReal ?? 0)}</p>
                    </div>
                    <div className="rounded-md border border-border bg-background p-2">
                      <p className="text-muted-foreground">Kualitas Terburuk (AI)</p>
                      <p className="font-semibold">{slikAnalyses[0].kualitasTerburuk || "-"}</p>
                    </div>
                    <div className="rounded-md border border-border bg-background p-2">
                      <p className="text-muted-foreground">Rekomendasi AI</p>
                      <Badge variant={slikRekomendasiVariant(slikAnalyses[0].rekomendasi)}>
                        {slikAnalyses[0].rekomendasi}
                      </Badge>
                    </div>
                  </div>
                  <div className="divide-y divide-border rounded-md border border-border bg-background text-xs">
                    {slikAnalyses.map((item) => (
                      <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 p-2.5">
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-1.5 truncate font-medium">
                            {new Date(item.createdAt).toLocaleString("id-ID")}
                            {item.linkedToApplication && (
                              <Badge variant="secondary" className="text-[10px]">
                                Terkait pengajuan ini
                              </Badge>
                            )}
                          </p>
                          <p className="truncate text-muted-foreground">
                            {item.sourceFileNames?.join(", ") || "Laporan SLIK"}
                            {item.namaPadaDokumen ? ` · ${item.namaPadaDokumen}` : ""}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant={slikRekomendasiVariant(item.rekomendasi)}>{item.rekomendasi}</Badge>
                          {item.riskRating && <Badge variant="outline">{item.riskRating}</Badge>}
                          <Link
                            href={`/credit/slik-analyzer?customerId=${app.customer?.id ?? ""}&applicationId=${app.id}&view=${item.id}`}
                          >
                            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                              <Eye className="h-3.5 w-3.5" /> Lihat
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 text-xs"
                            disabled={downloadingSlikId === item.id}
                            onClick={() => downloadSlikReport(item.id)}
                          >
                            {downloadingSlikId === item.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Download className="h-3.5 w-3.5" />
                            )}
                            Unduh PDF
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {slikOverrides.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Riwayat Alasan Penerusan (meski rekomendasi AI)
                  </p>
                  <div className="divide-y divide-border rounded-md border border-border bg-background text-xs">
                    {slikOverrides.map((item) => (
                      <div key={item.id} className="p-2.5">
                        <p className="flex flex-wrap items-center gap-1.5 font-medium">
                          {new Date(item.createdAt).toLocaleString("id-ID")} · {item.recordedByName}
                          <span className="text-muted-foreground">
                            ({overrideRoleLabel(item.recordedByRole === "SURVEY" ? "SURVEY" : "AO")})
                          </span>
                          <Badge variant="outline" className="text-[10px]">
                            {item.rekomendasi}
                          </Badge>
                        </p>
                        <p className="mt-1 leading-relaxed italic text-muted-foreground">{item.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* 1. Character */}
              <div className="p-4 border rounded-lg space-y-3 bg-muted/10">
                <h3 className="font-semibold text-sm flex items-center gap-2 text-primary">
                  1. Character (Karakter & SLIK / OJK)
                </h3>
                <div>
                  <label className="text-xs font-medium">Hasil Pengecekan Riwayat SLIK / IDEB OJK</label>
                  {slikAnalyses.length > 0 && slikAnalyses[0].kualitasTerburuk ? (
                    <div className="mt-1 flex items-center gap-2 rounded-md border border-input bg-muted/30 px-3 py-2 text-sm">
                      <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
                      <span className="font-medium">{deriveSlikStatus(slikAnalyses)}</span>
                      <Badge variant={slikRekomendasiVariant(slikAnalyses[0].rekomendasi)} className="ml-auto">
                        {slikAnalyses[0].rekomendasi}
                      </Badge>
                    </div>
                  ) : (
                    <p className="mt-1 rounded-md border border-dashed border-input px-3 py-2 text-xs text-muted-foreground">
                      Belum ada hasil analisa SLIK untuk debitur ini — jalankan analisa SLIK, status akan
                      terisi otomatis dari hasil analisa.
                    </p>
                  )}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Diisi otomatis dari hasil analisa SLIK (alat bantu AI) — verifikasi manual terhadap
                    dokumen SLIK asli tetap wajib.
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium">Catatan Integritas & Reputasi Lingkungan</label>
                  <textarea
                    rows={2}
                    value={analysisData.characterNotes}
                    onChange={(e) => setAnalysisData({ ...analysisData, characterNotes: e.target.value })}
                    placeholder="Integritas nasabah, riwayat hubungan dengan bank lain..."
                    className="w-full mt-1 p-2 rounded-md border border-input bg-background text-sm"
                  />
                </div>
              </div>

              {/* 2. Capacity */}
              <div className="p-4 border rounded-lg space-y-3 bg-muted/10">
                <h3 className="font-semibold text-sm flex items-center gap-2 text-primary">
                  2. Capacity (Kemampuan Membayar & Cashflow)
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium">Omset/Penghasilan Bruto (Rp/bln)</label>
                    <Input
                      type="number"
                      value={analysisData.monthlyIncome}
                      onChange={(e) => setAnalysisData({ ...analysisData, monthlyIncome: e.target.value })}
                      placeholder="Contoh: 35000000"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium">Biaya Hidup & Usaha (Rp/bln)</label>
                    <Input
                      type="number"
                      value={analysisData.monthlyExpense}
                      onChange={(e) => setAnalysisData({ ...analysisData, monthlyExpense: e.target.value })}
                      placeholder="Contoh: 15000000"
                      className="mt-1"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium">Sisa Kemampuan Angsur (Rp)</label>
                    <Input
                      type="number"
                      value={analysisData.installmentCapacity}
                      onChange={(e) => setAnalysisData({ ...analysisData, installmentCapacity: e.target.value })}
                      placeholder="Contoh: 8000000"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium">Perkiraan DSR (Debt Service Ratio %)</label>
                    <Input
                      value={analysisData.dsrRatio}
                      onChange={(e) => setAnalysisData({ ...analysisData, dsrRatio: e.target.value })}
                      placeholder="Contoh: 32%"
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Collateral */}
              <div className="p-4 border rounded-lg space-y-3 bg-muted/10">
                <h3 className="font-semibold text-sm flex items-center gap-2 text-primary">
                  3. Collateral (Agunan / Jaminan Kredit)
                </h3>
                <div>
                  <label className="text-xs font-medium">Jenis Agunan Utama</label>
                  <select
                    value={analysisData.collateralType}
                    onChange={(e) => setAnalysisData({ ...analysisData, collateralType: e.target.value })}
                    className="w-full mt-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                  >
                    <option value="SHM (Sertifikat Hak Milik)">SHM (Sertifikat Hak Milik)</option>
                    <option value="SHGB (Hak Guna Bangunan)">SHGB (Hak Guna Bangunan)</option>
                    <option value="BPKB Mobil / Motor">BPKB Mobil / Motor</option>
                    <option value="Bilyet Deposito BPR">Bilyet Deposito BPR</option>
                    <option value="Lainnya">Lainnya / Tanpa Agunan</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium">Nilai Taksasi Pasar (Rp)</label>
                    <Input
                      type="number"
                      value={analysisData.marketValue}
                      onChange={(e) => setAnalysisData({ ...analysisData, marketValue: e.target.value })}
                      placeholder="Contoh: 200000000"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium">Nilai Taksasi Likuidasi (Rp)</label>
                    <Input
                      type="number"
                      value={analysisData.liquidationValue}
                      onChange={(e) => setAnalysisData({ ...analysisData, liquidationValue: e.target.value })}
                      placeholder="Contoh: 140000000"
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* 4. Capital & Condition */}
              <div className="p-4 border rounded-lg space-y-3 bg-muted/10">
                <h3 className="font-semibold text-sm flex items-center gap-2 text-primary">
                  4. Capital & Condition (Modal & Prospek Usaha)
                </h3>
                <div>
                  <label className="text-xs font-medium">Prospek & Perkembangan Usaha</label>
                  <textarea
                    rows={2}
                    value={analysisData.businessCondition}
                    onChange={(e) => setAnalysisData({ ...analysisData, businessCondition: e.target.value })}
                    placeholder="Kondisi industri, persaingan, tren penjualan..."
                    className="w-full mt-1 p-2 rounded-md border border-input bg-background text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Tingkat Risiko Kredit</label>
                  <select
                    value={analysisData.marketRisk}
                    onChange={(e) => setAnalysisData({ ...analysisData, marketRisk: e.target.value })}
                    className="w-full mt-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                  >
                    <option value="Rendah">Rendah (Low Risk)</option>
                    <option value="Moderat">Moderat (Medium Risk)</option>
                    <option value="Tinggi">Tinggi (High Risk)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Analyst Final Recommendation */}
            <div className="p-4 border border-primary/30 rounded-lg bg-primary/5 space-y-3">
              <h3 className="font-semibold text-sm text-primary flex items-center gap-2">
                <CheckSquare className="h-4 w-4" /> Kesimpulan & Rekomendasi Analis Kredit
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium">Rekomendasi Analis *</label>
                  <select
                    value={analysisData.analystRecommendation}
                    onChange={(e) => setAnalysisData({ ...analysisData, analystRecommendation: e.target.value })}
                    className="w-full mt-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm font-semibold"
                  >
                    <option value="LAYAK">LAYAK (Direkomendasikan)</option>
                    <option value="LAYAK DENGAN SYARAT">LAYAK DENGAN CATATAN / SYARAT</option>
                    <option value="TIDAK LAYAK">TIDAK LAYAK (Tolak)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium">Pertimbangan & Argumen Rekomendasi</label>
                  <Input
                    value={analysisData.analystNotes}
                    onChange={(e) => setAnalysisData({ ...analysisData, analystNotes: e.target.value })}
                    placeholder="Alasan kelayakan pemberian kredit..."
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSaveAnalysis} disabled={isSaving} className="gap-2">
                <Save className="h-4 w-4" />
                {isSaving ? "Menyimpan..." : "Simpan Analisis 5C"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 3: SURVEY (Section 12) */}
      {activeTab === "survey" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" /> Modul Survey Lapangan (On-The-Spot)
            </CardTitle>
            <CardDescription>
              Catatan verifikasi fisik tempat tinggal, kunjungan tempat usaha, dan wawancara lingkungan oleh petugas survey lapangan.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium">Tanggal Pelaksanaan Survey</label>
                <Input
                  type="date"
                  value={surveyData.surveyDate}
                  onChange={(e) => setSurveyData({ ...surveyData, surveyDate: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <label className="text-xs font-medium">Orang yang Diwawancarai (Interviewee)</label>
                <Input
                  value={surveyData.interviewee}
                  onChange={(e) => setSurveyData({ ...surveyData, interviewee: e.target.value })}
                  placeholder="Nama & hubungan dengan debitur (debitur/pasangan/manajer)"
                  className="mt-1.5"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium">Lokasi Kunjungan Lapangan</label>
              <Input
                value={surveyData.surveyLocation}
                onChange={(e) => setSurveyData({ ...surveyData, surveyLocation: e.target.value })}
                placeholder="Alamat tempat tinggal / lokasi toko / pabrik debitur..."
                className="mt-1.5"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium">Status Operasional Usaha</label>
                <select
                  value={surveyData.businessStatus}
                  onChange={(e) => setSurveyData({ ...surveyData, businessStatus: e.target.value })}
                  className="w-full mt-1.5 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  <option value="Aktif Beroperasi">Aktif Beroperasi & Ramai</option>
                  <option value="Aktif Standar">Aktif Standar</option>
                  <option value="Musiman">Musiman</option>
                  <option value="Tutup Sementara / Menurun">Tutup Sementara / Menurun</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium">Rekomendasi Hasil Survey</label>
                <select
                  value={surveyData.surveyRecommendation}
                  onChange={(e) => setSurveyData({ ...surveyData, surveyRecommendation: e.target.value })}
                  className="w-full mt-1.5 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm font-semibold"
                >
                  <option value="DIREKOMENDASIKAN">DIREKOMENDASIKAN</option>
                  <option value="DIPERTIMBANGKAN">DIPERTIMBANGKAN DENGAN CATATAN</option>
                  <option value="TIDAK DIREKOMENDASIKAN">TIDAK DIREKOMENDASIKAN</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium">Temuan Kondisi Fisik & Lingkungan Usaha</label>
              <textarea
                rows={3}
                value={surveyData.physicalCondition}
                onChange={(e) => setSurveyData({ ...surveyData, physicalCondition: e.target.value })}
                placeholder="Kondisi bangunan, persediaan barang dagang, aktivitas transaksi harian..."
                className="w-full mt-1.5 p-2 rounded-md border border-input bg-background text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-medium">Catatan Khusus Surveyor Lapangan</label>
              <textarea
                rows={3}
                value={surveyData.surveyFindingNotes}
                onChange={(e) => setSurveyData({ ...surveyData, surveyFindingNotes: e.target.value })}
                placeholder="Konfirmasi dari tetangga/lingkungan sekitar, kepemilikan agunan..."
                className="w-full mt-1.5 p-2 rounded-md border border-input bg-background text-sm"
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSaveSurvey} disabled={isSaving} className="gap-2">
                <Save className="h-4 w-4" />
                {isSaving ? "Menyimpan..." : "Simpan Hasil Survey"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 4: DECISION (Section 13) */}
      {activeTab === "decision" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" /> Keputusan Komite Kredit
            </CardTitle>
            <CardDescription>
              Penetapan plafon yang disetujui, tenor, suku bunga, dan syarat-syarat kredit sebelum penerbitan Surat Penawaran Kredit (SPK).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 border border-muted rounded-lg bg-muted/20 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase">Status Putusan Saat Ini</div>
                <div className="text-xl font-bold mt-1">{app.status}</div>
                {app.decisionMaker && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Diputuskan oleh: {app.decisionMaker.fullName} ({app.decisionDate ? new Date(app.decisionDate).toLocaleDateString("id-ID") : "-"})
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => requestSaveDecision("RETURNED")}
                  disabled={isSaving}
                  className="text-orange-600 hover:text-orange-700"
                >
                  Kembalikan Berkas (Return)
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => requestSaveDecision("REJECTED")}
                  disabled={isSaving}
                >
                  Tolak Pengajuan (Reject)
                </Button>
                <Button
                  size="sm"
                  onClick={() => requestSaveDecision("APPROVED")}
                  disabled={isSaving}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  Setujui Kredit (Approve)
                </Button>
              </div>
            </div>

            {/* Authority Limit Tier Info */}
            {(() => {
              const finalNominal = parseFloat(decisionData.approvedAmount) || app.requestedAmount || 0;
              let requiredAuthorityText = "Tier 1 - Kepala Cabang (Maks. Rp 50.000.000)";
              if (finalNominal > 250000000) {
                requiredAuthorityText = "Tier 3 - Direksi / Komite Kredit Pusat (Di atas Rp 250.000.000)";
              } else if (finalNominal > 50000000) {
                requiredAuthorityText = "Tier 2 - Komite Kredit Cabang (Rp 50.000.001 s.d. Rp 250.000.000)";
              }

              return (
                <div className="p-3 bg-blue-50 border border-blue-200 dark:bg-blue-950/20 dark:border-blue-900 rounded-lg flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-blue-600" />
                    <span>
                      <strong>Ketentuan Kewenangan Memutus:</strong> Nominal Rp {finalNominal.toLocaleString("id-ID")} memerlukan otorisasi:{" "}
                      <span className="font-semibold text-blue-700 dark:text-blue-300">{requiredAuthorityText}</span>
                    </span>
                  </div>
                  <Badge variant="outline" className="border-blue-300 text-[10px]">
                    SOP OJK / BPR
                  </Badge>
                </div>
              );
            })()}

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium">Plafon Disetujui (Rp) *</label>
                <Input
                  type="number"
                  value={decisionData.approvedAmount}
                  onChange={(e) => setDecisionData({ ...decisionData, approvedAmount: e.target.value })}
                  placeholder="Nominal disetujui..."
                  className="mt-1.5"
                />
              </div>
              <div>
                <label className="text-xs font-medium">Jangka Waktu Disetujui (Bulan) *</label>
                <Input
                  type="number"
                  value={decisionData.approvedTenorMonths}
                  onChange={(e) => setDecisionData({ ...decisionData, approvedTenorMonths: e.target.value })}
                  placeholder="Tenor..."
                  className="mt-1.5"
                />
              </div>
              <div>
                <label className="text-xs font-medium">Suku Bunga (% p.a) *</label>
                <Input
                  type="number"
                  step="0.1"
                  value={decisionData.interestRate}
                  onChange={(e) => setDecisionData({ ...decisionData, interestRate: e.target.value })}
                  placeholder="Contoh: 12.5"
                  className="mt-1.5"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium">Syarat & Ketentuan Putusan (Conditions Precedent)</label>
              <textarea
                rows={3}
                value={decisionData.conditions}
                onChange={(e) => setDecisionData({ ...decisionData, conditions: e.target.value })}
                className="w-full mt-1.5 p-2 rounded-md border border-input bg-background text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-medium">Catatan / Risalah Sidang Komite Kredit</label>
              <textarea
                rows={3}
                value={decisionData.decisionNotes}
                onChange={(e) => setDecisionData({ ...decisionData, decisionNotes: e.target.value })}
                placeholder="Alasan persetujuan / mitigasi risiko yang disepakati oleh seluruh anggota komite..."
                className="w-full mt-1.5 p-2 rounded-md border border-input bg-background text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-medium">Catatan Alasan Perubahan Status (Dicatat ke Log Riwayat)</label>
              <Input
                value={decisionData.statusChangeNote}
                onChange={(e) => setDecisionData({ ...decisionData, statusChangeNote: e.target.value })}
                placeholder="Contoh: Disetujui dalam rapat komite kredit cabang..."
                className="mt-1.5"
              />
            </div>

            {/* Multi-Level Approval Records List */}
            {app.approvalRecords && app.approvalRecords.length > 0 && (
              <div className="space-y-3 pt-3 border-t">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Daftar Rekam Jejak Persetujuan Komite ({app.approvalRecords.length})
                </h4>
                <div className="divide-y rounded-md border text-xs">
                  {app.approvalRecords.map((rec: ApprovalRecordItem) => (
                    <div key={rec.id} className="p-3 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-sm">{rec.approver?.fullName || "Pejabat Pemutus"}</div>
                        <div className="text-muted-foreground">
                          {rec.approverRoleName} • {new Date(rec.createdAt).toLocaleString("id-ID")}
                        </div>
                        {rec.notes && <p className="mt-1 text-xs italic text-foreground/80">{rec.notes}</p>}
                      </div>
                      <div className="text-right">
                        <Badge variant={rec.status === "APPROVED" ? "success" : "destructive"}>
                          {rec.status}
                        </Badge>
                        {rec.approvedAmount && (
                          <div className="font-medium mt-1">Rp {rec.approvedAmount.toLocaleString("id-ID")}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={() => requestSaveDecision()} disabled={isSaving} className="gap-2">
                <Save className="h-4 w-4" />
                {isSaving ? "Menyimpan..." : "Simpan Ketetapan Putusan"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 5: REALIZATION (Section 14) */}
      {activeTab === "realization" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" /> Pencatatan Realisasi Kredit (Disbursement Record)
            </CardTitle>
            <CardDescription>
              Pencatatan data operasional realisasi akad kredit setelah dokumen SPK dan PK ditandatangani oleh debitur.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium">Nomor Perjanjian Kredit (PK) *</label>
                <Input
                  value={realizationData.realizationReference}
                  onChange={(e) => setRealizationData({ ...realizationData, realizationReference: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <label className="text-xs font-medium">Tanggal Realisasi Akad *</label>
                <Input
                  type="date"
                  value={realizationData.realizationDate}
                  onChange={(e) => setRealizationData({ ...realizationData, realizationDate: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <label className="text-xs font-medium">Nominal Pencairan Bersih (Rp) *</label>
                <Input
                  type="number"
                  value={realizationData.realizationAmount}
                  onChange={(e) => setRealizationData({ ...realizationData, realizationAmount: e.target.value })}
                  className="mt-1.5"
                />
              </div>
            </div>

            <div className="p-3 bg-muted/40 rounded-md text-xs text-muted-foreground">
              <strong>Catatan Arsitektur BPR:</strong> Sistem Operasional ini mencatat konfirmasi realisasi operasional pinjaman. Pemindahbukuan buku besar keuangan aktual dilakukan secara terintegrasi pada Core Banking System.
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSaveRealization} disabled={isSaving} className="gap-2">
                <Save className="h-4 w-4" />
                {isSaving ? "Menyimpan..." : "Simpan Pencatatan Realisasi"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 6: STATUS AUDIT HISTORY (Section 9 & 10) */}
      {activeTab === "history" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="h-5 w-5 text-primary" /> Riwayat Audit Perubahan Status (Audit Trail)
            </CardTitle>
            <CardDescription>
              Jejak waktu terinci setiap perubahan siklus status berkas pengajuan kredit demi kepatuhan audit.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!app.statusHistories || app.statusHistories.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Belum ada catatan riwayat status.
              </div>
            ) : (
              <div className="relative border-l border-border ml-4 space-y-6 py-2">
                {app.statusHistories.map((h: StatusHistoryItem) => (
                  <div key={h.id} className="relative pl-6">
                    <div className="absolute -left-1.5 top-1.5 h-3 w-3 rounded-full border-2 border-background bg-primary" />
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-semibold text-xs">
                        {h.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(h.createdAt).toLocaleString("id-ID")}
                      </span>
                    </div>
                    <p className="text-sm font-medium mt-1">
                      {h.notes || "Status diperbarui."}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Oleh: {h.changedBy?.fullName || "Sistem"} ({h.changedBy?.email || "-"})
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 7: DOCUMENTS (Section 17) */}
      {activeTab === "documents" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" /> Dokumen & Berkas Debitur (Section 17)
                </CardTitle>
                <CardDescription>
                  Arsip dokumen identitas, kelayakan usaha, foto survey lapangan, jaminan, dan persetujuan kredit.
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => setIsUploadDocOpen(true)} className="gap-2">
                <Upload className="h-4 w-4" />
                Unggah Dokumen Berkas
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {documents.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">
                Belum ada dokumen yang diunggah untuk pengajuan kredit ini.
              </div>
            ) : (
              <div className="divide-y divide-border rounded-md border text-sm">
                {documents.map((doc: DocumentItem) => (
                  <div key={doc.id} className="p-3.5 flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{doc.fileName}</span>
                        <Badge variant="outline" className="text-xs">
                          {doc.documentType}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {doc.notes || "Tidak ada catatan"} • Diunggah oleh: {doc.uploadedBy?.fullName || "User"} (
                        {new Date(doc.createdAt).toLocaleDateString("id-ID")})
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <a href={doc.downloadUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm" className="gap-1 text-xs">
                          <Download className="h-3.5 w-3.5 text-primary" /> Unduh / Buka
                        </Button>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Upload Document Modal */}
      <Dialog open={isUploadDocOpen} onOpenChange={setIsUploadDocOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <form onSubmit={handleUploadDoc}>
            <DialogHeader>
              <DialogTitle>Unggah Berkas ke Pengajuan Ini</DialogTitle>
              <DialogDescription>
                Pilih dokumen kelengkapan kredit (KTP, KK, Bukti Penghasilan, Foto Survey, SHM/BPKB, dll.)
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-3">
              <div>
                <label className="text-xs font-medium">Pilih Berkas *</label>
                <Input
                  type="file"
                  required
                  onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-medium">Jenis Dokumen *</label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="w-full mt-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-xs"
                >
                  <option value="KTP">KTP Elektronik</option>
                  <option value="KK">Kartu Keluarga (KK)</option>
                  <option value="INCOME_PROOF">Slip Gaji / Rekening Koran</option>
                  <option value="BUSINESS_DOC">Izin Usaha (NIB/SIUP)</option>
                  <option value="SURVEY_PHOTO">Foto Survey Lapangan</option>
                  <option value="COLLATERAL_DOC">Dokumen Agunan (SHM/BPKB)</option>
                  <option value="APPROVAL_DOC">Dokumen SPK & PK</option>
                  <option value="OTHER">Lainnya</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium">Catatan Dokumen</label>
                <Input
                  placeholder="Keterangan singkat berkas..."
                  value={docNotes}
                  onChange={(e) => setDocNotes(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsUploadDocOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={isUploadingDoc}>
                {isUploadingDoc ? "Mengunggah..." : "Unggah Berkas"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Tahap 5B: dialog alasan penerusan meski rekomendasi AI = REJECT */}
      <Dialog
        open={overrideDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setOverrideDialogOpen(false);
            setOverrideTarget(null);
            setOverrideError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" /> Alasan Penerusan Pengajuan
            </DialogTitle>
            <DialogDescription>
              Analisa SLIK terakhir merekomendasikan{" "}
              <span className="font-semibold text-foreground">REJECT</span>. Untuk tetap melanjutkan ke
              tahap <span className="font-semibold text-foreground">{overrideTarget?.nextStatus}</span>,
              Account Officer atau petugas survei lapangan wajib mengisi alasan penerusan. Alasan ini
              disimpan permanen dan dicatat ke audit log.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="slik-override-reason" className="text-xs font-semibold">
              Alasan mengapa pengajuan tetap diteruskan
            </label>
            <textarea
              id="slik-override-reason"
              rows={4}
              value={overrideReason}
              onChange={(event) => {
                setOverrideReason(event.target.value);
                setOverrideError(null);
              }}
              placeholder={`Minimal ${OVERRIDE_REASON_MIN_LENGTH} karakter. Contoh: tunggakan berasal dari fasilitas yang sudah lunas dan debitur memiliki agunan tambahan yang menutupi plafon...`}
              className="w-full rounded-md border border-input bg-background p-2 text-sm"
            />
            {overrideError && <p className="text-xs text-destructive">{overrideError}</p>}
            <p className="text-[11px] text-muted-foreground">
              Hanya Account Officer / petugas survei lapangan yang berwenang mengisi — diverifikasi di
              server, bukan hanya di tampilan.
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOverrideDialogOpen(false);
                setOverrideTarget(null);
                setOverrideError(null);
              }}
            >
              Batal
            </Button>
            <Button type="button" onClick={() => void confirmOverride()} className="gap-2">
              <CheckCircle2 className="h-4 w-4" /> Teruskan &amp; Simpan Alasan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
