"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Phone,
  Mail,
  ShieldCheck,
  Lock,
  Menu,
  X,
  ChevronRight,
  ChevronDown,
  FileText,
  ListTree,
  Camera,
  Info,
  Calculator,
  Home,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/public/ThemeToggle";

interface ReportItem {
  id: string;
  title: string;
  slug: string;
  category: string;
  year: number | null;
  period: string | null;
  fileUrl: string;
}

export function PublicHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [reportDropdownOpen, setReportDropdownOpen] = useState(false);
  const [mobileReportOpen, setMobileReportOpen] = useState(true);
  const [recentReports, setRecentReports] = useState<ReportItem[]>([]);
  const pathname = usePathname();

  useEffect(() => {
    fetch("/api/cms/reports?active=true&limit=6")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setRecentReports(data);
        }
      })
      .catch((err) => console.error("Error loading header reports:", err));
  }, []);

  const isCurrent = (path: string) => {
    if (path === "/" && pathname === "/") return true;
    if (path !== "/" && pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <>
      {/* Top Notification Bar */}
      <div className="bg-primary text-primary-foreground text-xs py-2 px-4 border-b border-primary-dark">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 text-white/90">
              <Phone className="h-3 w-3 text-gold-light" /> (0341) 453200
            </span>
            <span className="flex items-center gap-1 text-white/90">
              <Mail className="h-3 w-3 text-gold-light" /> halo@bpradiartha.com
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 font-medium text-white">
              <ShieldCheck className="h-3.5 w-3.5 text-gold-light" /> Terdaftar & Diawasi OJK • Dijamin LPS
            </span>
            <span className="text-white/40">|</span>
            <Link href="/login" className="hover:text-gold-light transition-colors font-semibold flex items-center gap-1 text-white">
              <Lock className="h-3 w-3 text-gold-light" /> Portal Staf
            </Link>
          </div>
        </div>
      </div>

      {/* Main Header / Navigation */}
      <header className="sticky top-0 z-40 safe-top bg-background/95 backdrop-blur border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-20">
          <Link href="/" className="flex items-center gap-3">
            <div className="relative h-15 w-56 sm:w-64 flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.svg"
                alt="Logo BPR Adiartha"
                className="max-h-10 w-auto object-contain object-left"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/logo.png"; // Fallback ke logo default jika gagal memuat
                }}
              />
              <span className="font-semibold text-primary">BPR Adiartha Reksacitra</span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-3 xl:gap-5 text-sm font-medium">
            <Link
              href="/#produk"
              className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
            >
              <ListTree className="h-3.5 w-3.5" />
              Produk
            </Link>

            {/* Dropdown Menu: Laporan */}
            <div
              className="relative"
              onMouseEnter={() => setReportDropdownOpen(true)}
              onMouseLeave={() => setReportDropdownOpen(false)}
            >
              <button
                type="button"
                onClick={() => setReportDropdownOpen(!reportDropdownOpen)}
                className={`transition-colors flex items-center gap-1 py-2 font-medium cursor-pointer ${
                  isCurrent("/laporan")
                    ? "text-primary font-semibold"
                    : "text-muted-foreground hover:text-primary"
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
                <span>Publikasi</span>
                <ChevronDown
                  className={`h-3 w-3 transition-transform duration-200 ${
                    reportDropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Dropdown Card */}
              {reportDropdownOpen && (
                <div className="absolute top-full left-0 w-84 bg-popover text-popover-foreground border rounded-xl shadow-xl p-3 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="px-2 py-1.5 border-b mb-2 flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <FileText className="h-3 w-3 text-rose-500" /> Publikasi Resmi (PDF)
                    </span>
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-emerald-500/40 text-emerald-600">
                      OJK & LPS
                    </Badge>
                  </div>

                  <div className="space-y-1">
                    {recentReports.length > 0 ? (
                      recentReports.slice(0, 4).map((item) => (
                        <Link
                          key={item.id}
                          href={`/laporan/${item.slug}`}
                          onClick={() => setReportDropdownOpen(false)}
                          className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-muted transition-colors group cursor-pointer"
                        >
                          <div className="h-7 w-7 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center shrink-0 mt-0.5 border border-rose-100 dark:border-rose-900/40">
                            <FileText className="h-3.5 w-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                                {item.category.replace("_", " ")}
                              </span>
                              {item.year && (
                                <span className="text-[10px] text-muted-foreground">
                                  • {item.year}
                                </span>
                              )}
                            </div>
                            <h4 className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                              {item.title}
                            </h4>
                          </div>
                        </Link>
                      ))
                    ) : (
                      <>
                        <Link
                          href="/laporan"
                          onClick={() => setReportDropdownOpen(false)}
                          className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted text-xs font-medium cursor-pointer"
                        >
                          <FileText className="h-4 w-4 text-blue-500" />
                          Laporan Keuangan Publikasi
                        </Link>
                        <Link
                          href="/laporan"
                          onClick={() => setReportDropdownOpen(false)}
                          className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted text-xs font-medium cursor-pointer"
                        >
                          <FileText className="h-4 w-4 text-purple-500" />
                          Laporan Tata Kelola (GCG)
                        </Link>
                        <Link
                          href="/laporan"
                          onClick={() => setReportDropdownOpen(false)}
                          className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted text-xs font-medium cursor-pointer"
                        >
                          <FileText className="h-4 w-4 text-amber-500" />
                          Laporan Tahunan (Annual Report)
                        </Link>
                      </>
                    )}
                  </div>

                  <div className="mt-2 pt-2 border-t">
                    <Link
                      href="/laporan"
                      onClick={() => setReportDropdownOpen(false)}
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-semibold text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                    >
                      <span>Lihat Seluruh Laporan Publikasi</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <Link
              href="/berita"
              className={`transition-colors flex items-center gap-1 ${
                isCurrent("/berita") ? "text-primary " : "text-muted-foreground hover:text-primary"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              Berita & Kegiatan
            </Link>
            <Link
              href="/galeri"
              className={`transition-colors flex items-center gap-1 ${
                isCurrent("/galeri") ? "text-primary " : "text-muted-foreground hover:text-primary"
              }`}
            >
              <Camera className="h-3.5 w-3.5" />
              Galeri Foto
            </Link>
            <Link
              href="/#faq"
              className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
            >
              <Info className="h-3.5 w-3.5" />
              Bantuan (FAQ)
            </Link>
            <Link
              href="/#kontak"
              className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
            >
              <Phone className="h-3.5 w-3.5" />
              Kontak
            </Link>
          </nav>

          {/* Action Button & Mobile Menu Toggle */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/#form-pengajuan">
              <Button className="gap-2 font-semibold shadow-xs text-xs sm:text-sm bg-primary text-primary-foreground hover:bg-primary-dark cursor-pointer">
                Ajukan Pinjaman <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>

            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-foreground cursor-pointer"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t bg-background px-4 pt-3 pb-6 safe-bottom space-y-3 shadow-lg max-h-[85dvh] overflow-y-auto overscroll-contain drawer-enter">
            <nav className="flex flex-col space-y-2 text-sm font-medium">
              <Link
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted"
              >
                <Home className="h-4 w-4 text-primary" /> Beranda
              </Link>
              <Link
                href="/#produk"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-md hover:bg-muted"
              >
                Produk & Layanan
              </Link>

              {/* Mobile Collapsible Laporan */}
              <div className="border rounded-lg p-2 bg-muted/20 space-y-1">
                <button
                  type="button"
                  onClick={() => setMobileReportOpen(!mobileReportOpen)}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-muted text-primary font-semibold text-sm cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-rose-500" /> Laporan Publikasi (PDF)
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform duration-200 ${
                      mobileReportOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {mobileReportOpen && (
                  <div className="pl-4 pr-1 py-1 space-y-1.5 border-t pt-2">
                    <Link
                      href="/laporan"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center justify-between py-1 text-xs font-bold text-primary hover:underline"
                    >
                      <span>Lihat Semua Laporan</span>
                      <ChevronRight className="h-3 w-3" />
                    </Link>

                    {recentReports.length > 0 ? (
                      recentReports.map((item) => (
                        <Link
                          key={item.id}
                          href={`/laporan/${item.slug}`}
                          onClick={() => setMobileMenuOpen(false)}
                          className="flex items-center gap-1.5 py-1 text-xs text-muted-foreground hover:text-foreground truncate"
                        >
                          <FileText className="h-3 w-3 text-rose-500 shrink-0" />
                          <span className="truncate">{item.title}</span>
                        </Link>
                      ))
                    ) : (
                      <Link
                        href="/laporan"
                        onClick={() => setMobileMenuOpen(false)}
                        className="block py-1 text-xs text-muted-foreground"
                      >
                        Laporan Keuangan & GCG
                      </Link>
                    )}
                  </div>
                )}
              </div>

              <Link
                href="/berita"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted text-primary font-semibold"
              >
                <FileText className="h-4 w-4" /> Berita & Kegiatan Kantor
              </Link>
              <Link
                href="/galeri"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted text-primary font-semibold"
              >
                <Camera className="h-4 w-4" /> Galeri Foto Kegiatan
              </Link>
              <Link
                href="/#faq"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-md hover:bg-muted"
              >
                Tanya Jawab (FAQ)
              </Link>
              <Link
                href="/#kontak"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-md hover:bg-muted"
              >
                Kontak & Lokasi Cabang
              </Link>
              <div className="pt-2 border-t">
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Lock className="h-3.5 w-3.5" /> Masuk Portal Staf Internal
                </Link>
              </div>
            </nav>
          </div>
        )}
      </header>
    </>
  );
}
