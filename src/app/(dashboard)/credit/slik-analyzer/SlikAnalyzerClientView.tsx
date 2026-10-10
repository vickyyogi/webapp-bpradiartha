"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Code2,
  Download,
  Eye,
  FileText,
  Info,
  Loader2,
  RefreshCw,
  ScanSearch,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatAngka,
  formatRupiah,
  normalizeSlikAnalysis,
  type SlikAnalysis,
  type SlikAnalysisResult,
} from "@/lib/slik/types";

const MAX_FILES = 10;
const MAX_FILE_BYTES = 15 * 1024 * 1024;

interface Props {
  userName: string;
  userRoleLabel: string;
  apiConfigured: boolean;
  defaultModel: string;
  fallbackModel: string;
}

type Phase = "idle" | "analyzing" | "ready" | "error";

function isPdfFile(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function rekomendasiVariant(rekomendasi: string): "success" | "destructive" | "warning" {
  if (rekomendasi === "APPROVE") return "success";
  if (rekomendasi === "CONSIDER") return "warning";
  return "destructive";
}

export function SlikAnalyzerClientView({
  userName,
  userRoleLabel,
  apiConfigured,
  defaultModel,
  fallbackModel,
}: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [analysis, setAnalysis] = useState<SlikAnalysis | null>(null);
  const [meta, setMeta] = useState<SlikAnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState<"preview" | "json">("preview");
  const [jsonDraft, setJsonDraft] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (phase !== "analyzing") return;
    const timer = setInterval(() => setElapsed((prev) => prev + 1), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const list = Array.from(incoming);
    const rejected: string[] = [];
    setFiles((prev) => {
      const next = [...prev];
      for (const file of list) {
        if (!isPdfFile(file)) {
          rejected.push(`${file.name} (bukan PDF)`);
          continue;
        }
        if (file.size > MAX_FILE_BYTES) {
          rejected.push(`${file.name} (lebih dari 15 MB)`);
          continue;
        }
        const duplicate = next.some((item) => item.name === file.name && item.size === file.size);
        if (duplicate) continue;
        if (next.length >= MAX_FILES) {
          rejected.push(`${file.name} (batas ${MAX_FILES} berkas)`);
          continue;
        }
        next.push(file);
      }
      return next;
    });
    if (rejected.length > 0) {
      setWarnings((prev) => [`Berkas diabaikan: ${rejected.join(", ")}.`, ...prev]);
    }
  }, []);

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const runAnalysis = async () => {
    if (files.length === 0) return;
    setElapsed(0);
    setPhase("analyzing");
    setErrorMessage(null);
    setWarnings([]);
    setAnalysis(null);
    setMeta(null);
    setJsonError(null);

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));

      const response = await fetch("/api/analyze-slik", { method: "POST", body: formData });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setWarnings(Array.isArray(payload?.warnings) ? payload.warnings : []);
        throw new Error(payload?.error || `Analisa gagal (HTTP ${response.status}).`);
      }

      const data = payload.data as SlikAnalysis;
      const resultMeta = payload.meta as SlikAnalysisResult;

      setAnalysis(data);
      setMeta(resultMeta);
      setWarnings(resultMeta?.warnings ?? []);
      setJsonDraft(JSON.stringify(data, null, 2));
      setActiveTab("preview");
      setPhase("ready");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Terjadi kesalahan tak terduga.");
      setPhase("error");
    }
  };

  const applyJsonDraft = () => {
    try {
      const parsed = JSON.parse(jsonDraft);
      const { data, issues } = normalizeSlikAnalysis(parsed);
      setAnalysis(data);
      setWarnings(issues);
      setJsonError(null);
      setActiveTab("preview");
    } catch (error) {
      setJsonError(error instanceof Error ? error.message : "JSON tidak valid.");
    }
  };

  const downloadReport = async () => {
    if (!analysis) return;
    setIsDownloading(true);
    setErrorMessage(null);
    try {
      // jsPDF di-import saat dibutuhkan agar tidak membebani bundel halaman ini.
      const { downloadSlikReportPdf } = await import("@/lib/slik/generateSlikReport");
      await downloadSlikReportPdf(analysis);
    } catch (error) {
      setErrorMessage(
        `Gagal membuat laporan PDF: ${error instanceof Error ? error.message : "kesalahan tak terduga"}.`
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const resetAll = () => {
    setFiles([]);
    setAnalysis(null);
    setMeta(null);
    setWarnings([]);
    setErrorMessage(null);
    setJsonDraft("");
    setJsonError(null);
    setPhase("idle");
  };

  const komite = analysis?.analisis_dan_rekomendasi.keputusan_komite;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <Link href="/credit">
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Kembali
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <ScanSearch className="h-6 w-6 text-primary" />
              Analisa SLIK OJK (IDEB)
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Unggah beberapa laporan SLIK OJK (PDF), sistem mengekstrak datanya, lalu menyusun
              laporan <span className="font-medium text-foreground">Credit Risk Assessment</span> siap cetak.
            </p>
          </div>
        </div>
        <div className="flex flex-col items-start gap-2 md:items-end">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{userName}</span>
            <Badge variant="secondary">{userRoleLabel}</Badge>
          </div>
          {analysis && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-2" onClick={resetAll}>
                <RefreshCw className="h-4 w-4" /> Analisa Baru
              </Button>
              <Button size="sm" className="gap-2" onClick={downloadReport} disabled={isDownloading}>
                {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {isDownloading ? "Menyusun PDF..." : "Unduh Laporan PDF"}
              </Button>
            </div>
          )}
        </div>
      </div>

      {!apiConfigured && (
        <div className="flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-soft/60 p-3 text-sm dark:border-yellow-900 dark:bg-yellow-950/20">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-yellow-700 dark:text-yellow-400" />
          <div>
            <p className="font-semibold text-yellow-800 dark:text-yellow-400">
              OPENROUTER_API_KEY belum diisi
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Tambahkan <code className="rounded bg-muted px-1 py-0.5">OPENROUTER_API_KEY</code> pada file{" "}
              <code className="rounded bg-muted px-1 py-0.5">.env</code> lalu restart server
              (<code className="rounded bg-muted px-1 py-0.5">npm run dev</code>) sebelum menjalankan analisa.
            </p>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Panel unggah + ringkasan proses */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" /> Unggah Laporan SLIK OJK
            </CardTitle>
            <CardDescription>
              Maksimal {MAX_FILES} berkas PDF (15 MB per berkas). Boleh beberapa laporan sekaligus —
              hasilnya digabung menjadi satu laporan analisa.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                if (event.dataTransfer?.files) addFiles(event.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                isDragging ? "border-primary bg-primary-soft/60" : "border-border hover:border-primary/50"
              }`}
            >
              <FileText className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">Tarik & lepas berkas PDF di sini</p>
              <p className="text-xs text-muted-foreground">atau klik untuk memilih berkas dari komputer</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                multiple
                className="hidden"
                onChange={(event) => {
                  if (event.target.files) addFiles(event.target.files);
                  event.target.value = "";
                }}
              />
            </div>

            {files.length > 0 && (
              <div className="divide-y divide-border rounded-md border text-sm">
                {files.map((file, index) => (
                  <div key={`${file.name}-${index}`} className="flex items-center justify-between p-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-primary" />
                      <span className="truncate font-medium">{file.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(file.size)}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1 text-xs text-muted-foreground hover:text-destructive"
                      onClick={() => removeFile(index)}
                      disabled={phase === "analyzing"}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Hapus
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Model: <span className="font-medium text-foreground">{defaultModel}</span> · cadangan:{" "}
                <span className="font-medium text-foreground">{fallbackModel}</span>
              </p>
              <Button
                onClick={runAnalysis}
                disabled={files.length === 0 || phase === "analyzing"}
                className="gap-2"
              >
                {phase === "analyzing" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {phase === "analyzing" ? `Menganalisa... (${elapsed}s)` : "Analisa Dokumen SLIK"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" /> Status Analisa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Tahap</span>
              <Badge
                variant={
                  phase === "ready" ? "success" : phase === "error" ? "destructive" : phase === "analyzing" ? "info" : "outline"
                }
              >
                {phase === "ready"
                  ? "Selesai"
                  : phase === "error"
                  ? "Gagal"
                  : phase === "analyzing"
                  ? "Diproses"
                  : "Menunggu berkas"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Berkas terpilih</span>
              <span className="font-semibold">{files.length}</span>
            </div>
            {meta && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Model terpakai</span>
                  <span className="font-medium">{meta.model}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Durasi</span>
                  <span className="font-medium">{(meta.elapsedMs / 1000).toFixed(1)} detik</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Halaman diproses</span>
                  <span className="font-medium">
                    {meta.sources.reduce((sum, source) => sum + source.pages, 0)}
                  </span>
                </div>
              </>
            )}
            <p className="rounded-md bg-muted/40 p-2.5 text-xs text-muted-foreground">
              Seluruh berkas dibaca di server BPR; hanya teks hasil ekstraksi yang dikirim ke OpenRouter
              untuk dianalisa. Setiap analisa tercatat pada audit trail.
            </p>
          </CardContent>
        </Card>
      </div>

      {warnings.length > 0 && (
        <Card className="border-yellow-200 dark:border-yellow-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-yellow-800 dark:text-yellow-400">
              <AlertTriangle className="h-4 w-4" /> Catatan & peringatan ({warnings.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {warnings.map((warning, index) => (
                <li key={index} className="flex gap-2">
                  <span className="text-yellow-600">•</span>
                  <span>{warning}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {analysis && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 border-b border-border pb-2">
            <button
              onClick={() => setActiveTab("preview")}
              className={`flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === "preview"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Eye className="h-4 w-4" /> Pratinjau Isi Laporan
            </button>
            <button
              onClick={() => {
                setJsonDraft(JSON.stringify(analysis, null, 2));
                setActiveTab("json");
              }}
              className={`flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === "json"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Code2 className="h-4 w-4" /> Koreksi Data (JSON)
            </button>
            <div className="ml-auto flex items-center gap-2">
              {komite && (
                <>
                  <Badge variant={rekomendasiVariant(komite.rekomendasi)}>
                    {komite.rekomendasi}
                  </Badge>
                  <Badge variant="outline">{komite.risk_rating}</Badge>
                </>
              )}
            </div>
          </div>

          {activeTab === "json" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Koreksi hasil ekstraksi</CardTitle>
                <CardDescription>
                  Perbaiki nilai yang kurang tepat sebelum laporan dibuat, lalu simpan. Struktur JSON
                  divalidasi otomatis — nilai yang salah tipe akan dibetulkan sistem.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <textarea
                  value={jsonDraft}
                  onChange={(event) => setJsonDraft(event.target.value)}
                  spellCheck={false}
                  rows={22}
                  className="w-full rounded-md border border-input bg-background p-3 font-mono text-xs leading-relaxed"
                />
                {jsonError && (
                  <p className="text-xs text-red-600 dark:text-red-400">JSON tidak valid: {jsonError}</p>
                )}
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setJsonDraft(JSON.stringify(analysis, null, 2));
                      setJsonError(null);
                    }}
                  >
                    Kembalikan
                  </Button>
                  <Button onClick={applyJsonDraft}>Terapkan Perubahan</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === "preview" && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" /> {analysis.header.nomor_laporan}
                  </CardTitle>
                  <CardDescription>
                    Posisi data: {analysis.header.posisi_data} · Operator: {analysis.header.operator}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2 text-sm">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Data Pribadi Debitur
                    </h3>
                    {[
                      ["Nama Lengkap", analysis.data_pribadi.nama_lengkap],
                      ["NIK", analysis.data_pribadi.nik],
                      ["TTL / Usia", analysis.data_pribadi.ttl_usia],
                      ["Pekerjaan", analysis.data_pribadi.pekerjaan],
                      ["Pendidikan", analysis.data_pribadi.pendidikan],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between gap-4 border-b pb-1.5">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="text-right font-medium">{value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2 text-sm">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Ringkasan Eksposur
                    </h3>
                    {[
                      ["Total Baki Debet", formatRupiah(analysis.ringkasan_eksposur.total_baki_debet)],
                      ["Plafon Efektif", analysis.ringkasan_eksposur.plafon_efektif],
                      ["Kualitas Terburuk", analysis.ringkasan_eksposur.kualitas_terburuk],
                      ["Total Kreditur", analysis.ringkasan_eksposur.total_kreditur],
                      ["Total Fasilitas", analysis.ringkasan_eksposur.total_fasilitas],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between gap-4 border-b pb-1.5">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="text-right font-semibold">{value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    1. Fasilitas Kredit ({analysis.fasilitas.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  {analysis.fasilitas.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Tidak ada fasilitas tercatat.</p>
                  ) : (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="py-2 pr-3 font-semibold">Bank Pelapor</th>
                          <th className="py-2 pr-3 font-semibold">Jenis</th>
                          <th className="py-2 pr-3 text-right font-semibold">Plafon</th>
                          <th className="py-2 pr-3 text-right font-semibold">Baki Debet</th>
                          <th className="py-2 pr-3 font-semibold">Bunga</th>
                          <th className="py-2 pr-3 font-semibold">Kol / DPD</th>
                          <th className="py-2 pr-3 font-semibold">Status</th>
                          <th className="py-2 text-right font-semibold">Est. Angsuran</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analysis.fasilitas.map((fasilitas, index) => (
                          <tr key={index} className="border-b last:border-0">
                            <td className="py-2 pr-3 font-medium">{fasilitas.bank_pelapor}</td>
                            <td className="py-2 pr-3">{fasilitas.jenis_fasilitas}</td>
                            <td className="py-2 pr-3 text-right">{formatAngka(fasilitas.plafon_awal)}</td>
                            <td className="py-2 pr-3 text-right">{formatAngka(fasilitas.baki_debet)}</td>
                            <td className="py-2 pr-3">{fasilitas.suku_bunga}</td>
                            <td className="py-2 pr-3">
                              <Badge variant="outline" className="text-[10px]">
                                {fasilitas.kolektibilitas} / {fasilitas.hari_tunggakan} hr
                              </Badge>
                            </td>
                            <td className="py-2 pr-3">{fasilitas.status_kondisi}</td>
                            <td className="py-2 text-right">
                              {fasilitas.est_angsuran_bulan > 0
                                ? formatRupiah(fasilitas.est_angsuran_bulan)
                                : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>

              <Card className="border-red-200 dark:border-red-900">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-red-800 dark:text-red-400">
                    Rincian Tunggakan
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                  {[
                    ["Tunggakan Pokok", formatRupiah(analysis.rincian_tunggakan.tunggakan_pokok)],
                    ["Tunggakan Bunga", formatRupiah(analysis.rincian_tunggakan.tunggakan_bunga)],
                    ["Denda Berjalan", formatRupiah(analysis.rincian_tunggakan.denda_berjalan)],
                    ["Total Tunggakan Real", formatRupiah(analysis.rincian_tunggakan.total_tunggakan_real)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-md bg-muted/40 p-2.5">
                      <div className="text-xs text-muted-foreground">{label}</div>
                      <div className="font-semibold">{value}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    2. Analisis & Rekomendasi Analis Kredit
                  </CardTitle>
                  <CardDescription>
                    Total estimasi angsuran bulanan:{" "}
                    <span className="font-semibold text-foreground">
                      {analysis.analisis_dan_rekomendasi.total_estimasi_angsuran_bulanan}
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5 text-sm">
                  {analysis.analisis_dan_rekomendasi.ringkasan_angsuran.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        A. Angsuran Berjalan
                      </h3>
                      {analysis.analisis_dan_rekomendasi.ringkasan_angsuran.map((item, index) => (
                        <div key={index} className="flex items-start justify-between gap-4 border-b pb-2">
                          <div>
                            <div className="font-medium">
                              {index + 1}. {item.nama_bank}
                            </div>
                            <div className="text-xs text-muted-foreground">{item.detail}</div>
                          </div>
                          <span className="shrink-0 font-semibold text-primary">{item.nominal_per_bulan}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {analysis.analisis_dan_rekomendasi.inventarisasi_agunan.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        B. Inventarisasi Agunan
                      </h3>
                      <ul className="space-y-1 text-xs">
                        {analysis.analisis_dan_rekomendasi.inventarisasi_agunan.map((agunan, index) => (
                          <li key={index} className="flex gap-2">
                            <span className="text-primary">•</span>
                            <span>{agunan}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {analysis.analisis_dan_rekomendasi.catatan_kritis_karakter.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        C. Catatan Kritis Karakter & Kapasitas
                      </h3>
                      {analysis.analisis_dan_rekomendasi.catatan_kritis_karakter.map((catatan, index) => (
                        <div key={index} className="rounded-md bg-muted/40 p-2.5 text-xs">
                          <span className="font-semibold">{catatan.judul}: </span>
                          <span className="text-muted-foreground">{catatan.uraian}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {komite && (
                    <div
                      className={`rounded-lg border p-4 ${
                        komite.rekomendasi === "APPROVE"
                          ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/20"
                          : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-bold">KEPUTUSAN KOMITE / ANALIS KREDIT</h3>
                        <div className="flex gap-2">
                          <Badge variant={rekomendasiVariant(komite.rekomendasi)}>
                            {komite.rekomendasi}
                          </Badge>
                          <Badge variant="outline">{komite.risk_rating}</Badge>
                        </div>
                      </div>
                      {komite.saran_tindakan.length > 0 && (
                        <ol className="mt-3 space-y-1 text-xs">
                          {komite.saran_tindakan.map((saran, index) => (
                            <li key={index}>
                              {index + 1}. {saran}
                            </li>
                          ))}
                        </ol>
                      )}
                      {komite.syarat_khusus.length > 0 && (
                        <ul className="mt-3 space-y-1 text-xs italic text-muted-foreground">
                          {komite.syarat_khusus.map((syarat, index) => (
                            <li key={index}>• {syarat}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
