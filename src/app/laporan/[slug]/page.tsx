"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  FileText,
  Download,
  ExternalLink,
  ArrowLeft,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Share2,
  Printer,
  ChevronRight,
  Info,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";

interface Report {
  id: string;
  title: string;
  slug: string;
  category: string;
  period: string | null;
  year: number | null;
  description: string | null;
  fileUrl: string;
  fileName: string | null;
  fileSize: number | null;
  publishedAt: string | null;
  createdAt: string;
}

export default function LaporanDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = use(params);
  const rawSlug = resolvedParams.slug;
  const slug = decodeURIComponent(rawSlug).trim();

  const [report, setReport] = useState<Report | null>(null);
  const [relatedReports, setRelatedReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);

        // Check if query params have direct url/file
        const search = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
        const directUrl = search?.get("url") || search?.get("file");
        const directTitle = search?.get("title");

        const cleanSlug = encodeURIComponent(slug);
        const res = await fetch(`/api/cms/reports/${cleanSlug}`);

        if (res.ok) {
          const data = await res.json();
          setReport(data);
        } else if (directUrl) {
          // Direct URL preview mode
          setReport({
            id: "preview",
            title: directTitle || "Pratinjau Dokumen PDF",
            slug: slug || "preview",
            category: search?.get("category") || "KEUANGAN",
            period: search?.get("period") || "Terkini",
            year: search?.get("year") ? Number(search?.get("year")) : new Date().getFullYear(),
            description: search?.get("desc") || "Dokumen publikasi resmi PT BPR Adiartha",
            fileUrl: directUrl,
            fileName: directUrl.split("/").pop() || "dokumen.pdf",
            fileSize: null,
            publishedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          });
        }

        // Also load other reports for sidebar
        const otherRes = await fetch("/api/cms/reports?active=true&limit=6");
        if (otherRes.ok) {
          const allReps: Report[] = await otherRes.json();
          setRelatedReports(allReps.filter((r) => r.slug !== slug && r.id !== slug));
        }
      } catch (err) {
        console.error("Failed to load report:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [slug]);

  const handleShare = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case "KEUANGAN":
        return "bg-primary text-primary-foreground";
      case "TATA_KELOLA":
        return "bg-gold-soft text-gold-dark border border-gold/30";
      case "TAHUNAN":
        return "bg-primary-soft text-primary border border-primary/20";
      case "KEBERLANJUTAN":
        return "bg-emerald-50 text-emerald-700 border border-emerald-200";
      default:
        return "bg-muted text-foreground border border-border";
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case "KEUANGAN":
        return "Laporan Keuangan";
      case "TATA_KELOLA":
        return "Tata Kelola (GCG)";
      case "TAHUNAN":
        return "Laporan Tahunan";
      case "KEBERLANJUTAN":
        return "Keberlanjutan";
      default:
        return category;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <PublicHeader />
        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 w-full">
          <div className="space-y-4 animate-pulse">
            <div className="h-4 bg-muted rounded w-1/4" />
            <div className="h-8 bg-muted rounded w-2/3" />
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-[600px] bg-muted rounded-xl mt-8" />
          </div>
        </main>
        <PublicFooter />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <PublicHeader />
        <main className="flex-1 max-w-4xl mx-auto px-4 py-20 text-center space-y-4">
          <FileText className="h-16 w-16 text-muted-foreground mx-auto" />
          <h1 className="text-2xl font-bold">Dokumen Laporan Tidak Ditemukan</h1>
          <p className="text-sm text-muted-foreground">
            Laporan publikasi yang Anda cari mungkin telah diperbarui atau dipindahkan.
          </p>
          <div className="pt-4">
            <Link href="/laporan">
              <Button variant="default" className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Kembali ke Daftar Laporan
              </Button>
            </Link>
          </div>
        </main>
        <PublicFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <PublicHeader />

      <main className="flex-1">
        {/* Breadcrumbs & Top Bar */}
        <section className="bg-muted/30 border-b py-3.5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-3 text-xs">
            <nav className="flex items-center gap-1.5 text-muted-foreground flex-wrap">
              <Link href="/" className="hover:text-primary transition-colors">
                Beranda
              </Link>
              <ChevronRight className="h-3 w-3 shrink-0" />
              <Link href="/laporan" className="hover:text-primary transition-colors">
                Laporan Publikasi
              </Link>
              <ChevronRight className="h-3 w-3 shrink-0" />
              <span className="text-foreground font-medium truncate max-w-[280px] sm:max-w-md">
                {report.title}
              </span>
            </nav>

            <Link href="/laporan" className="inline-flex items-center gap-1 text-primary hover:underline font-medium">
              <ArrowLeft className="h-3.5 w-3.5" /> Semua Laporan
            </Link>
          </div>
        </section>

        {/* Report Overview Header */}
        <section className="py-8 bg-card border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-3 max-w-3xl">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={`text-xs font-semibold ${getCategoryBadgeClass(report.category)}`}>
                    {getCategoryLabel(report.category)}
                  </Badge>
                  {report.period && (
                    <Badge variant="outline" className="text-xs">
                      Periode: {report.period}
                    </Badge>
                  )}
                  {report.year && (
                    <Badge variant="secondary" className="text-xs">
                      Tahun {report.year}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Publikasi Resmi OJK
                  </span>
                </div>

                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight leading-tight">
                  {report.title}
                </h1>

                {report.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {report.description}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
                  {report.publishedAt && (
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      Diterbitkan:{" "}
                      <strong className="text-foreground">
                        {new Date(report.publishedAt).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </strong>
                    </span>
                  )}
                  {report.fileName && (
                    <span className="flex items-center gap-1.5 font-mono">
                      <FileText className="h-3.5 w-3.5 text-rose-500" />
                      {report.fileName}
                    </span>
                  )}
                  {report.fileSize && (
                    <span>• {formatFileSize(report.fileSize)}</span>
                  )}
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0">
                <a
                  href={report.fileUrl}
                  download={report.fileName || `${report.slug}.pdf`}
                  className="w-full sm:w-auto"
                >
                  <Button className="w-full sm:w-auto gap-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold cursor-pointer shadow-sm">
                    <Download className="h-4 w-4" /> Unduh Berkas PDF
                  </Button>
                </a>

                <a
                  href={report.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full sm:w-auto"
                >
                  <Button variant="outline" className="w-full sm:w-auto gap-2 cursor-pointer">
                    <ExternalLink className="h-4 w-4" /> Tab Baru
                  </Button>
                </a>

                <Button
                  variant="outline"
                  onClick={handleShare}
                  className="w-full sm:w-auto gap-2 cursor-pointer"
                  title="Salin Tautan Halaman"
                >
                  <Share2 className="h-4 w-4" />
                  {copied ? "Tersalin!" : "Bagikan"}
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* PDF Viewer & Details Body */}
        <section className="py-8 sm:py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
              {/* Main Interactive PDF Viewer (3 Columns) */}
              <div className="lg:col-span-3 space-y-4">
                <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                  {/* Viewer Top Bar */}
                  <div className="bg-muted/70 px-4 py-3 border-b flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 font-medium text-foreground">
                      <FileText className="h-4 w-4 text-rose-600" />
                      <span>Pratinjau Dokumen PDF ({report.fileName || `${report.slug}.pdf`})</span>
                    </div>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <span className="hidden sm:inline">Gunakan kontrol di dalam viewer untuk zoom & cetak</span>
                      <a
                        href={report.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline flex items-center gap-1 font-semibold"
                      >
                        Layar Penuh <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>

                  {/* Embedded PDF Viewer */}
                  <div className="relative w-full h-[650px] sm:h-[850px] bg-slate-100 dark:bg-slate-900">
                    <object
                      data={`${report.fileUrl}#view=FitH`}
                      type="application/pdf"
                      className="w-full h-full"
                    >
                      <iframe
                        src={`${report.fileUrl}#view=FitH`}
                        title={report.title}
                        className="w-full h-full border-0"
                      >
                        <div className="p-8 text-center space-y-4 flex flex-col items-center justify-center h-full">
                          <FileText className="h-12 w-12 text-rose-500" />
                          <p className="text-sm font-medium">Peramban Anda tidak menampilkan pratinjau PDF langsung.</p>
                          <a href={report.fileUrl} download={report.fileName || `${report.slug}.pdf`}>
                            <Button size="sm" className="gap-2 bg-rose-600 hover:bg-rose-700 text-white">
                              <Download className="h-4 w-4" /> Unduh Dokumen PDF
                            </Button>
                          </a>
                        </div>
                      </iframe>
                    </object>
                  </div>
                </div>

                {/* Additional Notice Card */}
                <div className="bg-muted/40 border rounded-lg p-4 flex items-start gap-3 text-xs text-muted-foreground">
                  <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <p>
                    Apabila tampilan dokumen di atas tidak termuat sempurna pada peramban seluler Anda, silakan klik tombol{" "}
                    <strong className="text-foreground">Unduh Berkas PDF</strong> atau{" "}
                    <strong className="text-foreground">Tab Baru</strong> untuk membuka berkas secara langsung di aplikasi pembaca PDF perangkat Anda.
                  </p>
                </div>
              </div>

              {/* Sidebar Info & Related Reports (1 Column) */}
              <div className="space-y-6">
                {/* Document Metadata Card */}
                <Card className="border">
                  <CardContent className="p-5 space-y-4">
                    <h3 className="font-bold text-sm text-foreground flex items-center gap-2 border-b pb-2">
                      <Building2 className="h-4 w-4 text-primary" /> Informasi Dokumen
                    </h3>
                    <dl className="space-y-2.5 text-xs">
                      <div>
                        <dt className="text-muted-foreground">Penerbit</dt>
                        <dd className="font-semibold text-foreground">PT BPR Adiartha Reksacitra</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Kategori Publikasi</dt>
                        <dd className="font-semibold text-foreground">{getCategoryLabel(report.category)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Periode Pelaporan</dt>
                        <dd className="font-semibold text-foreground">
                          {report.period || "-"} {report.year ? `(${report.year})` : ""}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Format & Ukuran</dt>
                        <dd className="font-semibold text-foreground">
                          Dokumen PDF {report.fileSize ? `(${formatFileSize(report.fileSize)})` : ""}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Status Kepatuhan</dt>
                        <dd className="font-semibold text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Terverifikasi OJK & LPS
                        </dd>
                      </div>
                    </dl>
                  </CardContent>
                </Card>

                {/* Related / Other Reports */}
                {relatedReports.length > 0 && (
                  <Card className="border">
                    <CardContent className="p-5 space-y-4">
                      <h3 className="font-bold text-sm text-foreground border-b pb-2">
                        Publikasi Laporan Lainnya
                      </h3>
                      <div className="space-y-3">
                        {relatedReports.map((other) => (
                          <Link
                            key={other.id}
                            href={`/laporan/${other.slug}`}
                            className="block p-2.5 rounded-lg border hover:border-primary/50 hover:bg-muted/50 transition-colors space-y-1 group"
                          >
                            <div className="flex items-center gap-1.5">
                              <Badge className={`text-[9px] px-1.5 py-0 ${getCategoryBadgeClass(other.category)}`}>
                                {other.category}
                              </Badge>
                              {other.year && (
                                <span className="text-[10px] text-muted-foreground font-semibold">
                                  {other.year}
                                </span>
                              )}
                            </div>
                            <h4 className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                              {other.title}
                            </h4>
                          </Link>
                        ))}
                      </div>

                      <div className="pt-2 border-t">
                        <Link href="/laporan">
                          <Button variant="ghost" size="sm" className="w-full text-xs gap-1">
                            Lihat Semua Laporan &rarr;
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
