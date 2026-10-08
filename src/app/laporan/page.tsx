"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  FileText,
  Search,
  Download,
  Eye,
  Calendar,
  ShieldCheck,
  ChevronRight,
  Filter,
  FileSpreadsheet,
  Building2,
  Clock,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
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

export default function LaporanPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedYear, setSelectedYear] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetch("/api/cms/reports?active=true&limit=100")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setReports(data);
        }
      })
      .catch((err) => console.error("Error loading reports:", err))
      .finally(() => setLoading(false));
  }, []);

  const categories = [
    { code: "ALL", label: "Semua Laporan" },
    { code: "KEUANGAN", label: "Laporan Keuangan Publikasi" },
    { code: "TATA_KELOLA", label: "Tata Kelola (GCG)" },
    { code: "TAHUNAN", label: "Laporan Tahunan (Annual Report)" },
    { code: "KEBERLANJUTAN", label: "Laporan Keberlanjutan" },
  ];

  const years = Array.from(
    new Set(reports.map((r) => r.year).filter(Boolean))
  ).sort((a, b) => (b as number) - (a as number));

  const filteredReports = reports.filter((r) => {
    if (selectedCategory !== "ALL" && r.category !== selectedCategory) return false;
    if (selectedYear !== "ALL" && String(r.year) !== selectedYear) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = r.title.toLowerCase().includes(q);
      const matchDesc = (r.description || "").toLowerCase().includes(q);
      const matchPeriod = (r.period || "").toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchPeriod) return false;
    }
    return true;
  });

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

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <PublicHeader />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="bg-gradient-to-b from-primary/10 via-background to-background py-14 sm:py-20 border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-semibold mb-4">
                <FileText className="h-3.5 w-3.5" />
                Publikasi & Transparansi Informasi Resmi
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground">
                Laporan & Kinerja Publikasi
              </h1>
              <p className="mt-4 text-base sm:text-lg text-muted-foreground leading-relaxed">
                Sebagai wujud transparansi, akuntabilitas, dan kepatuhan terhadap regulasi
                Otoritas Jasa Keuangan (OJK), PT BPR Adiartha menyediakan publikasi laporan
                keuangan berkala, penerapan tata kelola (GCG), serta laporan tahunan resmi dalam format dokumen PDF.
              </p>
            </div>

            {/* OJK & LPS Notice Banner */}
            <div className="mt-8 bg-card border rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">
                    Kepatuhan Terhadap Ketentuan OJK & LPS
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Seluruh dokumen laporan disusun sesuai standar akuntansi keuangan dan ketentuan publikasi berkala OJK.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs bg-muted/50 border-emerald-500/30 text-emerald-600">
                  Diawasi OJK
                </Badge>
                <Badge variant="outline" className="text-xs bg-muted/50 border-blue-500/30 text-blue-600">
                  Peserta LPS
                </Badge>
              </div>
            </div>
          </div>
        </section>

        {/* Content Section */}
        <section className="py-12 sm:py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
            {/* Filter and Search Bar */}
            <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
              {/* Category Pills */}
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat.code}
                    onClick={() => setSelectedCategory(cat.code)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                      selectedCategory === cat.code
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Year Select & Search Input */}
              <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="rounded-md border border-input bg-background px-3 py-2 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="ALL">Semua Tahun</option>
                  {years.map((yr) => (
                    <option key={yr} value={String(yr)}>
                      Tahun {yr}
                    </option>
                  ))}
                </select>

                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Cari judul laporan..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Reports List */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="border rounded-xl p-5 space-y-3 animate-pulse bg-muted/30"
                  >
                    <div className="h-5 bg-muted rounded w-1/3" />
                    <div className="h-6 bg-muted rounded w-3/4" />
                    <div className="h-12 bg-muted rounded w-full" />
                    <div className="h-8 bg-muted rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : filteredReports.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredReports.map((report) => (
                  <Card
                    key={report.id}
                    className="flex flex-col justify-between hover:border-primary/50 hover:shadow-md transition-all group overflow-hidden border bg-card"
                  >
                    <CardContent className="p-6 flex flex-col justify-between h-full space-y-5">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <Badge
                            className={`text-[10px] font-semibold ${getCategoryBadgeClass(
                              report.category
                            )}`}
                          >
                            {getCategoryLabel(report.category)}
                          </Badge>
                          {report.year && (
                            <span className="text-xs font-semibold text-muted-foreground">
                              {report.period ? `${report.period} • ` : ""}
                              {report.year}
                            </span>
                          )}
                        </div>

                        <div className="flex items-start gap-3 pt-1">
                          <div className="h-10 w-10 rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-200/50">
                            <FileText className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <Link href={`/laporan/${report.slug}`}>
                              <h3 className="font-bold text-base text-foreground group-hover:text-primary transition-colors leading-snug line-clamp-2">
                                {report.title}
                              </h3>
                            </Link>
                          </div>
                        </div>

                        {report.description && (
                          <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                            {report.description}
                          </p>
                        )}
                      </div>

                      <div className="pt-4 border-t space-y-3">
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1 font-mono truncate max-w-[160px]">
                            {report.fileName || "dokumen.pdf"}
                          </span>
                          <span>{formatFileSize(report.fileSize)}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <Link href={`/laporan/${report.slug}`} className="w-full">
                            <Button
                              variant="default"
                              size="sm"
                              className="w-full gap-1.5 text-xs font-medium cursor-pointer"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Preview
                            </Button>
                          </Link>
                          <a
                            href={report.fileUrl}
                            download={report.fileName || `${report.slug}.pdf`}
                            className="w-full"
                          >
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full gap-1.5 text-xs font-medium cursor-pointer hover:bg-muted"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Unduh PDF
                            </Button>
                          </a>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-16 border border-dashed rounded-xl space-y-3">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto" />
                <h3 className="text-base font-semibold text-foreground">
                  Tidak Ada Dokumen Laporan Ditemukan
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Cobalah mengganti kata kunci pencarian atau memilih kategori laporan lainnya.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedCategory("ALL");
                    setSelectedYear("ALL");
                    setSearchQuery("");
                  }}
                  className="text-xs mt-2"
                >
                  Reset Filter
                </Button>
              </div>
            )}
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
