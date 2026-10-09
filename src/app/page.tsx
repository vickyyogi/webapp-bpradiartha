"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import {
  ShieldCheck,
  Building2,
  Phone,
  Mail,
  MapPin,
  Clock,
  Calculator,
  ChevronRight,
  CheckCircle2,
  CreditCard,
  PiggyBank,
  Briefcase,
  Users2,
  Lock,
  ArrowRight,
  Send,
  HelpCircle,
  Megaphone,
  BookOpen,
  Camera,
  Coins,
  Gem,
  Landmark,
  BadgePercent,
  Wallet,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";

function getProductIcon(iconName?: string | null, category?: string | null) {
  switch (iconName) {
    case "CreditCard":
      return <CreditCard className="h-6 w-6" />;
    case "PiggyBank":
      return <PiggyBank className="h-6 w-6" />;
    case "Briefcase":
      return <Briefcase className="h-6 w-6" />;
    case "Building2":
      return <Building2 className="h-6 w-6" />;
    case "Coins":
      return <Coins className="h-6 w-6" />;
    case "Gem":
      return <Gem className="h-6 w-6" />;
    case "Landmark":
      return <Landmark className="h-6 w-6" />;
    case "BadgePercent":
      return <BadgePercent className="h-6 w-6" />;
    case "Wallet":
      return <Wallet className="h-6 w-6" />;
    case "TrendingUp":
      return <TrendingUp className="h-6 w-6" />;
    default:
      if (category === "TABUNGAN" || category === "DEPOSITO") return <PiggyBank className="h-6 w-6" />;
      if (category === "MODAL_KERJA") return <Briefcase className="h-6 w-6" />;
      return <CreditCard className="h-6 w-6" />;
  }
}

function getProductColor(category?: string | null) {
  switch (category) {
    case "MODAL_KERJA":
      return "bg-primary/10 text-primary";
    case "MULTI_GUNA":
    case "KONSUMTIF":
      return "bg-gold/15 text-gold-dark";
    case "TABUNGAN":
    case "DEPOSITO":
      return "bg-emerald-800/10 text-emerald-800";
    case "INVESTASI":
      return "bg-gold/25 text-gold-dark";
    default:
      return "bg-primary/10 text-primary";
  }
}

// Fallback shown when the admin dashboard has no hero slides configured.
// These are the pre-normalised (1100x1400, equal subject height) versions.
const FALLBACK_HERO_SLIDES = [
  { src: "/model/normalized/model1_norm.png", alt: "Nasabah BPR Adiartha Reksacitra" },
  { src: "/model/normalized/model2_norm.png", alt: "Nasabah BPR Adiartha Reksacitra" },
  { src: "/model/normalized/model3_norm.png", alt: "Nasabah BPR Adiartha Reksacitra" },
];

export default function PublicLandingPage() {
  // CMS Content State
  const [cmsBanners, setCmsBanners] = useState<any[]>([]);
  const [berita, setBerita] = useState<any[]>([]);
  const [cmsFaqs, setCmsFaqs] = useState<any[]>([]);
  const [cmsGalleries, setCmsGalleries] = useState<any[]>([]);
  const [cmsProducts, setCmsProducts] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/cms/banners?activeOnly=true")
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setCmsBanners(d))
      .catch(() => {});

    fetch("/api/cms/posts?status=PUBLISHED&limit=3")
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setBerita(d))
      .catch(() => {});

    fetch("/api/cms/faqs?activeOnly=true")
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setCmsFaqs(d))
      .catch(() => {});

    fetch("/api/cms/gallery?activeOnly=true&limit=4")
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setCmsGalleries(d))
      .catch(() => {});

    fetch("/api/cms/products?activeOnly=true")
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setCmsProducts(d))
      .catch(() => {});
  }, []);

  // Simulator State
  const [plafond, setPlafond] = useState<number>(10000000);
  const [tenor, setTenor] = useState<number>(24);
  const [bungaBulan, setBungaBulan] = useState<number>(1.5); // % per bulan

  // Form Application State
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    address: "",
    productInterest: "Kredit Modal Kerja",
    notes: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Hero slideshow: rotate the model image every few seconds
  const [heroImages, setHeroImages] = useState(FALLBACK_HERO_SLIDES);
  const [heroSlide, setHeroSlide] = useState(0);
  const [heroPaused, setHeroPaused] = useState(false);
  const [heroReducedMotion, setHeroReducedMotion] = useState(false);

  // Slides are managed from the admin dashboard. The static fallback above is
  // used until an editor uploads and activates slides there.
  useEffect(() => {
    fetch("/api/cms/hero-slides?activeOnly=true")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d) && d.length > 0) {
          setHeroImages(
            d.map((s: { imageUrl: string; altText?: string | null; title?: string | null }) => ({
              src: s.imageUrl,
              alt: s.altText || s.title || "Nasabah BPR Adiartha Reksacitra",
            }))
          );
        }
      })
      .catch(() => {});
  }, []);

  // Always auto-rotate (per requirement). Reduced-motion users still get the
  // rotation, but without the zoom movement - just a plain crossfade.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setHeroReducedMotion(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  // Keep the active index in range if the slide list changes.
  useEffect(() => {
    setHeroSlide((i) => (heroImages.length ? i % heroImages.length : 0));
  }, [heroImages.length]);

  useEffect(() => {
    if (heroPaused) return;
    const id = window.setInterval(() => {
      setHeroSlide((i) => (i + 1) % heroImages.length);
    }, 4500);
    return () => window.clearInterval(id);
  }, [heroPaused, heroImages.length]);

    // Scroll Animation Hooks
            const { ref: produkRef, isVisible: produkVisible } = useScrollAnimation(0.1, "0px 0px -50px 0px");
            const { ref: simulasiRef, isVisible: simulasiVisible } = useScrollAnimation(0.1, "0px 0px -50px 0px");
            const { ref: formRef, isVisible: formVisible } = useScrollAnimation(0.1, "0px 0px -50px 0px");
            const { ref: keunggulanRef, isVisible: keunggulanVisible } = useScrollAnimation(0.1, "0px 0px -50px 0px");
            const { ref: faqRef, isVisible: faqVisible } = useScrollAnimation(0.1, "0px 0px -50px 0px");

    // Calculation formula
  const angsuranPokok = plafond / tenor;
  const angsuranBunga = plafond * (bungaBulan / 100);
  const totalAngsuranBulanan = Math.ceil((angsuranPokok + angsuranBunga) / 500) * 500;
  const totalPengembalian = totalAngsuranBulanan * tenor;

  const handleApplyNow = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError("");

    fetch("/api/public/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...formData,
        requestedAmount: plafond,
        tenorMonths: tenor,
      }),
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Gagal mengirimkan permohonan");
        setSubmitSuccess(true);
      })
      .catch((err) => {
        setSubmitError(err.message || "Terjadi kesalahan sistem");
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const scrollToApply = () => {
    document.getElementById("form-pengajuan")?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToSimulator = () => {
    document.getElementById("simulasi-kredit")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
          {/* Main Header / Navigation */}
      <PublicHeader />

      {/* Hero Section */}
      <section className="relative isolate overflow-hidden py-16 lg:py-24 border-b border-border">
        {/* Background image */}
        <Image
          src="/office.jpg"
          alt="Kantor BPR Adiartha Reksacitra"
          fill
          priority
          sizes="100vw"
          className="-z-20 object-cover object-center"
        />
        {/* Elegant contrast overlays */}
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-gradient-to-r from-slate-950/90 via-slate-950/75 to-slate-900/40"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-gradient-to-t from-slate-950/90 via-slate-950/10 to-slate-950/40"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,rgba(212,175,55,0.18),transparent_55%)]"
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <Badge variant="outline" className="px-3 py-1 text-xs font-semibold border-gold/40 text-gold-light bg-white/10 backdrop-blur-sm">
                Solusi Keuangan Terpercaya BPR di Malang Raya
              </Badge>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)] animate-fade-in-up">
                Wujudkan Rencana & Kembangkan Usaha Anda Bersama{" "}
                <span className="bg-gradient-to-r from-amber-200 via-gold-light to-amber-300 bg-clip-text text-transparent">
                  BPR Adiartha Reksacitra
                </span>
              </h1>
              <p className="text-base sm:text-lg text-white/85 max-w-2xl mx-auto lg:mx-0 leading-relaxed animate-fade-in-up">
                Fasilitas pinjaman modal kerja, investasi usaha, dan kredit multiguna dengan proses cepat, suku bunga kompetitif, serta tabungan dan deposito aman dijamin LPS.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start pt-2">
                <Button size="lg" onClick={scrollToApply} className="gap-2 text-base px-6 bg-primary text-primary-foreground hover:bg-primary-dark shadow-lg shadow-black/30 cursor-pointer font-semibold">
                  Ajukan Kredit Sekarang <ArrowRight className="h-5 w-5" />
                </Button>
                <Button size="lg" variant="outline" onClick={scrollToSimulator} className="gap-2 text-base px-6 border-white/40 bg-white/5 text-white backdrop-blur-sm hover:border-gold/60 hover:bg-white/10 hover:text-gold-light transition-colors cursor-pointer font-medium">
                  <Calculator className="h-5 w-5 text-gold-light" /> Hitung Simulasi Angsuran
                </Button>
              </div>

              {/* Trust Indicators */}
              <div className="pt-6 grid grid-cols-3 gap-4 border-t border-white/20 max-w-lg mx-auto lg:mx-0">
                <div>
                  <div className="text-2xl font-black text-gold-light animate-pulse-subtle">1-3 Hari</div>
                  <div className="text-xs text-white/70 mt-0.5">Proses Cepat & Ringkas</div>
                </div>
                <div>
                  <div className="text-2xl font-black text-gold-light animate-pulse-subtle">s.d. Rp 2 M+</div>
                  <div className="text-xs text-white/70 mt-0.5">Plafon Fleksibel</div>
                </div>
                <div>
                  <div className="text-2xl font-black text-gold-light animate-pulse-subtle">100% Aman</div>
                  <div className="text-xs text-white/70 mt-0.5">Diawasi OJK & LPS</div>
                </div>
              </div>
            </div>

            {/* Hero Visual - Model Portrait */}
            <div className="lg:col-span-5">
              <div className="relative isolate mx-auto w-full max-w-md lg:max-w-none">
                {/* Ambient glows */}
                <div
                  aria-hidden="true"
                  className="absolute -inset-8 -z-10 rounded-full bg-gradient-to-br from-primary/25 via-gold/15 to-transparent blur-3xl"
                />
                <div
                  aria-hidden="true"
                  className="absolute -left-10 bottom-16 -z-10 h-52 w-52 rounded-full bg-gold/10 blur-3xl"
                />
                <div
                  aria-hidden="true"
                  className="absolute -right-10 top-10 -z-10 h-44 w-44 rounded-full bg-primary/20 blur-3xl"
                />

                {/* Framed portrait slideshow */}
                <div
                  className="group relative overflow-hidden rounded-[2rem] border border-gold/30 bg-gradient-to-b from-primary-soft/90 via-card to-gold-soft/80 shadow-2xl shadow-black/40 ring-1 ring-white/10"
                  onMouseEnter={() => setHeroPaused(true)}
                  onMouseLeave={() => setHeroPaused(false)}
                >
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 top-0 z-20 h-24 bg-gradient-to-b from-card/60 to-transparent"
                  />

                  <div className="relative aspect-[1100/1400] w-full">
                    {heroImages.map((slide, i) => (
                      <Image
                        key={slide.src}
                        src={slide.src}
                        alt={slide.alt}
                        fill
                        priority={i === 0}
                        aria-hidden={i !== heroSlide}
                        sizes="(max-width: 1024px) 100vw, 480px"
                        className={`object-contain transition-all duration-1000 ease-out ${
                          i === heroSlide ? "opacity-100" : "opacity-0"
                        } ${heroReducedMotion || i === heroSlide ? "scale-100" : "scale-[1.04]"}`}
                      />
                    ))}
                  </div>

                  {/* Slide indicators */}
                  <div className="absolute right-4 top-4 z-20 flex items-center gap-1.5 rounded-full border border-border/60 bg-card/85 px-2.5 py-1.5 shadow-sm backdrop-blur">
                    {heroImages.map((slide, i) => (
                      <button
                        key={slide.src}
                        type="button"
                        onClick={() => setHeroSlide(i)}
                        aria-label={`Tampilkan gambar model ${i + 1}`}
                        aria-current={i === heroSlide}
                        className={`h-2 cursor-pointer rounded-full transition-all duration-300 ${
                          i === heroSlide ? "w-6 bg-primary" : "w-2 bg-primary/30 hover:bg-primary/60"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Floating trust card */}
                <div className="absolute inset-x-4 -bottom-6 z-30 sm:inset-x-6">
                  <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card/95 px-4 py-3 shadow-xl backdrop-blur-md">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-foreground">Aman &amp; Terpercaya</div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        Berizin &amp; diawasi OJK &middot; Dijamin LPS
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Produk Section */}
            <section id="produk" ref={produkRef} className={`py-20 bg-muted/20 transition-all duration-700 ${produkVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-3 mb-16">
            <Badge variant="outline" className="text-xs uppercase tracking-wider text-primary border-primary/30">
              Produk & Layanan
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight brand-heading-accent">
              Pilihan Fasilitas Keuangan untuk Setiap Kebutuhan
            </h2>
            <p className="text-muted-foreground">
              BPR Adiartha menyediakan beragam produk kredit, simpanan, dan investasi yang dirancang mendukung kemajuan bisnis dan keluarga.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {cmsProducts.length > 0 ? (
              cmsProducts.map((p) => {
                let featuresList: string[] = [];
                if (p.features) {
                  try {
                    featuresList = JSON.parse(p.features);
                  } catch (e) {
                    featuresList = [];
                  }
                }
                return (
                  <Card key={p.id} className="hover:shadow-lg transition-all border-border hover:border-primary/50 flex flex-col justify-between">
                    <div>
                      <CardHeader>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${getProductColor(p.category)}`}>
                            {getProductIcon(p.icon, p.category)}
                          </div>
                          {p.badge && (
                            <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">
                              {p.badge}
                            </Badge>
                          )}
                        </div>
                        <CardTitle className="text-xl">{p.name}</CardTitle>
                        <CardDescription>
                          {p.description}
                        </CardDescription>
                      </CardHeader>
                      {featuresList.length > 0 && (
                        <CardContent className="space-y-3 text-sm">
                          {featuresList.map((f, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs">
                              <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                              <span>{f}</span>
                            </div>
                          ))}
                        </CardContent>
                      )}
                    </div>
                    <div className="p-6 pt-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-2 border-primary/20 hover:border-primary hover:bg-primary/5"
                        onClick={() => {
                          setFormData((prev) => ({ ...prev, productInterest: p.name }));
                          scrollToApply();
                        }}
                      >
                        Pilih Produk <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </Card>
                );
              })
            ) : (
              <>
                <Card className="hover:shadow-lg transition-all border-border hover:border-primary/50">
                  <CardHeader>
                    <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-2">
                      <Briefcase className="h-6 w-6" />
                    </div>
                    <CardTitle className="text-xl">Kredit Modal Kerja</CardTitle>
                    <CardDescription>
                      Bantuan likuiditas usaha untuk menambah stok persediaan toko, operasional harian, dan piutang dagang.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex items-center gap-2 text-xs">
                      <CheckCircle2 className="h-4 w-4 text-green-600" /> Plafon s.d. Rp 1.000.000.000
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <CheckCircle2 className="h-4 w-4 text-green-600" /> Tenor fleksibel 12 s.d. 36 bulan
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <CheckCircle2 className="h-4 w-4 text-green-600" /> Jaminan SHM / BPKB Kendaraan
                    </div>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-lg transition-all border-border hover:border-primary/50">
                  <CardHeader>
                    <div className="h-12 w-12 rounded-xl bg-gold/15 text-gold-dark flex items-center justify-center mb-2">
                      <CreditCard className="h-6 w-6" />
                    </div>
                    <CardTitle className="text-xl">Kredit Multi Guna</CardTitle>
                    <CardDescription>
                      Fasilitas pinjaman perorangan untuk renovasi rumah, pendidikan anak, biaya kesehatan, atau konsumtif lainnya.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex items-center gap-2 text-xs">
                      <CheckCircle2 className="h-4 w-4 text-green-600" /> Bunga ringan & cicilan tetap
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <CheckCircle2 className="h-4 w-4 text-green-600" /> Jangka waktu panjang s.d. 5 tahun
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <CheckCircle2 className="h-4 w-4 text-green-600" /> Syarat berkas mudah & pendampingan AO
                    </div>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-lg transition-all border-border hover:border-primary/50">
                  <CardHeader>
                    <div className="h-12 w-12 rounded-xl bg-emerald-800/10 text-emerald-800 flex items-center justify-center mb-2">
                      <PiggyBank className="h-6 w-6" />
                    </div>
                    <CardTitle className="text-xl">Deposito & Tabungan</CardTitle>
                    <CardDescription>
                      Kembangkan dana mengendap Anda dengan suku bunga menarik di atas rata-rata bank umum, 100% dijamin LPS.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex items-center gap-2 text-xs">
                      <CheckCircle2 className="h-4 w-4 text-green-600" /> Bunga bersaing sesuai batas penjaminan LPS
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <CheckCircle2 className="h-4 w-4 text-green-600" /> Tenor 1, 3, 6, dan 12 bulan
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <CheckCircle2 className="h-4 w-4 text-green-600" /> Bebas biaya administrasi bulanan
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Simulasi Kredit Detail Section */}
            <section id="simulasi-kredit" ref={simulasiRef} className={`py-20 border-b transition-all duration-700 ${simulasiVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-5 space-y-6">
              <Badge variant="outline" className="text-xs uppercase tracking-wider text-primary border-primary/30">
                Kalkulator Interaktif
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                Simulasi Angsuran Pinjaman Transparan
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Kami menjunjung tinggi transparansi tanpa biaya tersembunyi. Tentukan plafon dan tenor yang paling nyaman bagi keuangan Anda.
              </p>

              <div className="space-y-3 pt-2">
                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold">Tentukan Kebutuhan Modal</h4>
                    <p className="text-xs text-muted-foreground">Sesuaikan dengan rincian anggaran belanja atau kebutuhan investasi.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold">Pilih Jangka Waktu Cicilan</h4>
                    <p className="text-xs text-muted-foreground">Tenor fleksibel dari 6 bulan hingga 60 bulan sesuai perputaran arus kas.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold">Kirim Permohonan Langsung</h4>
                    <p className="text-xs text-muted-foreground">Tim Account Officer kami siap berkunjung dan membantu proses berkas.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7">
              <Card className="border-border shadow-md">
                <CardHeader>
                  <CardTitle className="text-xl">Formulir Simulasi Angsuran</CardTitle>
                  <CardDescription>Sesuaikan parameter di bawah untuk melihat rincian angsuran</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold">Plafon Pinjaman (Rp)</label>
                      <Input
                        type="number"
                        min="1000000"
                        step="1000000"
                        value={plafond}
                        onChange={(e) => setPlafond(Math.max(0, Number(e.target.value)))}
                        className="mt-1 font-semibold"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold">Suku Bunga (% per bulan)</label>
                      <Input
                        type="number"
                        step="0.05"
                        value={bungaBulan}
                        onChange={(e) => setBungaBulan(Math.max(0, Number(e.target.value)))}
                        className="mt-1 font-semibold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold mb-1.5 block">Pilih Jangka Waktu (Tenor Bulan):</label>
                    <div className="grid grid-cols-6 gap-2">
                      {[6, 12, 18, 24, 36, 60].map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setTenor(t)}
                          className={`py-2 text-xs rounded-md border text-center transition-all ${
                            tenor === t
                              ? "bg-primary text-primary-foreground font-bold border-primary shadow-xs"
                              : "border-border hover:bg-muted text-muted-foreground"
                          }`}
                        >
                          {t} Bulan
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-4 pt-4 border-t border-border">
                    <div className="p-3 bg-muted/40 rounded-lg text-center">
                      <span className="text-xs text-muted-foreground">Plafond</span>
                      <div className="text-base font-bold text-foreground mt-1">
                        Rp {Math.round(plafond).toLocaleString("id-ID")}
                      </div>
                    </div>
                    <div className="p-3 bg-muted/40 rounded-lg text-center">
                      <span className="text-xs text-muted-foreground">Suku Bunga per Tahun</span>
                      <div className="text-base font-bold text-foreground mt-1">
                        {bungaBulan * 12}%
                      </div>
                    </div>
                    <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg text-center">
                      <span className="text-xs font-medium text-primary">Total Angsuran / Bln</span>
                      <div className="text-lg font-extrabold text-primary mt-1">
                        Rp {totalAngsuranBulanan.toLocaleString("id-ID")}
                      </div>
                    </div>
                  </div>

                  <Button onClick={scrollToApply} className="w-full gap-2 text-sm">
                    Gunakan Simulasi Ini & Ajukan Pinjaman <ArrowRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Online Application Form Section */}
            <section id="form-pengajuan" ref={formRef} className={`py-20 bg-muted/20 transition-all duration-700 ${formVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-3 mb-10">
            <Badge variant="outline" className="text-xs uppercase tracking-wider text-primary border-primary/30">
              Formulir Online
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Ajukan Permohonan / Konsultasi Kredit
            </h2>
            <p className="text-muted-foreground text-sm max-w-xl mx-auto">
              Isi data diri singkat Anda di bawah ini. Permohonan Anda akan langsung terhubung ke sistem operasional CRM kami dan dihubungi dalam 1x24 jam.
            </p>
          </div>

          <Card className="border-border shadow-lg">
            <CardContent className="pt-6">
              {submitSuccess ? (
                <div className="text-center py-12 space-y-4">
                  <div className="h-16 w-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="h-10 w-10" />
                  </div>
                  <h3 className="text-2xl font-bold text-foreground">Permohonan Berhasil Dikirim!</h3>
                  <p className="text-muted-foreground text-sm max-w-md mx-auto">
                    Terima kasih telah mempercayai BPR Adiartha. Petugas Account Officer kami akan segera menghubungi nomor WhatsApp/Telepon Anda untuk memandu proses selanjutnya.
                  </p>
                  <Button onClick={() => setSubmitSuccess(false)} variant="outline" className="mt-4">
                    Kirim Pengajuan Lainnya
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleApplyNow} className="space-y-4">
                  {submitError && (
                    <div className="p-3 bg-destructive/15 text-destructive rounded-md text-sm">
                      {submitError}
                    </div>
                  )}

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold">Nama Lengkap Sesuai KTP *</label>
                      <Input
                        required
                        placeholder="Contoh: I Wayan Sudarma"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold">Nomor WhatsApp / HP Aktif *</label>
                      <Input
                        required
                        placeholder="Contoh: 081234567890"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold">Produk yang Diminati *</label>
                      <select
                        value={formData.productInterest}
                        onChange={(e) => setFormData({ ...formData, productInterest: e.target.value })}
                        className="w-full mt-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm font-medium"
                      >
                        {cmsProducts.length > 0 ? (
                          cmsProducts.map((p) => (
                            <option key={p.id} value={p.name}>
                              {p.name} {p.badge ? `(${p.badge})` : ""}
                            </option>
                          ))
                        ) : (
                          <>
                            <option value="Kredit Modal Kerja">Kredit Modal Kerja (Usaha/Dagang)</option>
                            <option value="Kredit Multi Guna">Kredit Multi Guna (Renovasi/Konsumtif)</option>
                            <option value="Kredit Investasi Usaha">Kredit Investasi Usaha (Mesin/Properti)</option>
                            <option value="Deposito Berjangka">Deposito Berjangka BPR</option>
                            <option value="Tabungan BPR">Tabungan BPR</option>
                          </>
                        )}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold">Plafon Sesuai Simulasi (Rp)</label>
                      <Input
                        disabled
                        value={`Rp ${plafond.toLocaleString("id-ID")} (${tenor} Bulan)`}
                        className="mt-1 bg-muted/50 font-semibold text-primary"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold">Alamat Domisili / Lokasi Usaha</label>
                    <Input
                      placeholder="Contoh: Jl. Diponegoro No. 25, Denpasar Barat"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold">Catatan Tambahan / Keperluan Pinjaman</label>
                    <textarea
                      rows={3}
                      placeholder="Ceritakan singkat mengenai rencana penggunaan pinjaman atau jaminan yang dimiliki..."
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full mt-1 p-2 rounded-md border border-input bg-background text-sm"
                    />
                  </div>

                  <div className="pt-2">
                    <Button type="submit" size="lg" disabled={isSubmitting} className="w-full gap-2 font-semibold">
                      <Send className="h-4 w-4" />
                      {isSubmitting ? "Mengirimkan Permohonan..." : "Kirimkan Permohonan Sekarang"}
                    </Button>
                    <p className="text-[11px] text-center text-muted-foreground mt-2">
                      Dengan mengirimkan formulir ini, Anda menyetujui petugas BPR menghubungi Anda untuk konsultasi perbankan. Kerahasiaan data Anda terlindungi.
                    </p>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Keunggulan Section */}
            <section id="keunggulan" ref={keunggulanRef} className={`py-20 border-b transition-all duration-700 ${keunggulanVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-3 mb-16">
            <Badge variant="outline" className="text-xs uppercase tracking-wider text-primary border-primary/30">
              Mengapa Memilih Kami
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Komitmen Layanan Terbaik untuk Masyarakat
            </h2>
            <p className="text-muted-foreground">
              BPR Adiartha memadukan kecepatan layanan lokal dengan tata kelola perbankan yang profesional dan aman.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            <div className="p-6 rounded-xl border border-border bg-card text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                <Clock className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-base">Proses Cepat & Ringkas</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Persetujuan kredit tanpa birokrasi berbelit. Verifikasi berkas dan survey lapangan tepat waktu.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-border bg-card text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-base">Aman & Terpercaya</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Berizin resmi dan diawasi OJK serta seluruh simpanan tabungan/deposito dijamin LPS.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-border bg-card text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                <Users2 className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-base">Pendampingan Account Officer</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Staf kami siap mengunjungi tempat tinggal atau lokasi usaha Anda untuk kemudahan konsultasi.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-border bg-card text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                <Building2 className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-base">Jaringan Kantor Strategis</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Kantor pusat dan kantor cabang yang mudah dijangkau dengan pelayanan ramah dan kekeluargaan.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CMS News, Promos & Articles Section */}
            {berita.length > 0 && (
              <section id="berita" className="py-20 bg-background border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto space-y-3 mb-14">
              <Badge variant="outline" className="text-xs uppercase tracking-wider text-primary border-primary/30">
                Publikasi & Kabar
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                Berita, Kegiatan & Edukasi Finansial
              </h2>
              <p className="text-muted-foreground text-sm">
                Informasi terbaru seputar kegiatan operasional kantor, promo suku bunga, dan program literasi perbankan BPR Adiartha.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {berita.map((post) => (
                <Card key={post.id} className="border hover:shadow-md transition-shadow flex flex-col justify-between overflow-hidden group">
                  {post.featuredImage && (
                    <div className="h-44 w-full bg-muted overflow-hidden relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={post.featuredImage}
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  )}
                  <CardHeader className="space-y-2 pb-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="text-[10px] font-semibold">
                        {post.category}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : ""}
                      </span>
                    </div>
                    <CardTitle className="text-base font-bold line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                      <Link href={`/berita/${post.slug}`}>
                        {post.title}
                      </Link>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-4 flex-1 flex flex-col justify-between">
                    <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                      {post.excerpt || post.content.slice(0, 130) + "..."}
                    </p>
                    <div className="pt-3 border-t flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Oleh: {post.authorName || "Redaksi"}</span>
                      <Link
                        href={`/berita/${post.slug}`}
                        className="text-primary font-semibold hover:underline flex items-center gap-1"
                      >
                        Baca <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="text-center mt-10">
              <Link href="/berita">
                <Button variant="outline" className="gap-2 text-xs sm:text-sm font-semibold">
                  Lihat Semua Berita & Kegiatan Kantor <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Gallery Section */}
            {cmsGalleries.length > 0 && (
              <section id="galeri" className="py-20 bg-muted/10 border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12">
              <div className="space-y-3 max-w-2xl">
                <Badge variant="outline" className="text-xs uppercase tracking-wider text-primary border-primary/30">
                  Dokumentasi Foto
                </Badge>
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                  Galeri Foto Kegiatan Kantor
                </h2>
                <p className="text-muted-foreground text-sm">
                  Dokumentasi visual momen kebersamaan, bakti sosial kemasyarakatan, kegiatan survei lapangan, dan perayaan HUT BPR Adiartha.
                </p>
              </div>
              <Link href="/galeri">
                <Button variant="outline" className="gap-2 shrink-0">
                  <Camera className="h-4 w-4 text-primary" /> Buka Album Galeri Lengkap
                </Button>
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {cmsGalleries.map((item) => (
                <Link
                  key={item.id}
                  href="/galeri"
                  className="group block rounded-xl overflow-hidden border bg-card shadow-sm hover:shadow-md transition-all"
                >
                  <div className="aspect-[4/3] w-full bg-muted overflow-hidden relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-2 left-2">
                      <Badge className="bg-black/60 backdrop-blur text-white text-[10px] border-0">
                        {item.category}
                      </Badge>
                    </div>
                  </div>
                  <div className="p-3">
                    <h4 className="font-semibold text-xs line-clamp-2 group-hover:text-primary transition-colors">
                      {item.title}
                    </h4>
                    <span className="text-[10px] text-muted-foreground block mt-1">
                      {item.eventDate ? new Date(item.eventDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : ""}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ Section */}
            <section id="faq" ref={faqRef} className={`py-20 bg-muted/20 border-b transition-all duration-700 ${faqVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-3 mb-12">
            <Badge variant="outline" className="text-xs uppercase tracking-wider text-primary border-primary/30">
              Pertanyaan Umum
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight">FAQ (Frequently Asked Questions)</h2>
            <p className="text-muted-foreground text-sm">
              Hal-hal yang sering ditanyakan mengenai produk kredit dan layanan perbankan BPR Adiartha.
            </p>
          </div>

          <div className="space-y-4">
            {cmsFaqs.length > 0 ? (
              cmsFaqs.map((faq) => (
                <Card key={faq.id}>
                  <CardHeader className="py-4">
                    <CardTitle className="text-base flex items-center gap-2">
                      <HelpCircle className="h-4 w-4 text-primary shrink-0" />
                      {faq.question}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground pt-0 leading-relaxed">
                    {faq.answer}
                  </CardContent>
                </Card>
              ))
            ) : (
              <>
                <Card>
                  <CardHeader className="py-4">
                    <CardTitle className="text-base flex items-center gap-2">
                      <HelpCircle className="h-4 w-4 text-primary shrink-0" />
                      Apa saja syarat umum pengajuan kredit di BPR Adiartha?
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground pt-0 leading-relaxed">
                    Syarat umum meliputi KTP pemohon dan pasangan, Kartu Keluarga (KK), bukti penghasilan/rekening koran usaha 3 bulan terakhir, serta dokumen agunan (Sertifikat SHM/SHGB atau BPKB kendaraan).
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="py-4">
                    <CardTitle className="text-base flex items-center gap-2">
                      <HelpCircle className="h-4 w-4 text-primary shrink-0" />
                      Berapa lama proses persetujuan dan pencairan kredit?
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground pt-0 leading-relaxed">
                    Apabila dokumen telah lengkap dan proses survey lapangan selesai dilaksanakan, keputusan kredit rata-rata dapat diterbitkan dalam waktu 1 hingga 3 hari kerja.
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="py-4">
                    <CardTitle className="text-base flex items-center gap-2">
                      <HelpCircle className="h-4 w-4 text-primary shrink-0" />
                      Apakah simpanan deposito di BPR aman?
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground pt-0 leading-relaxed">
                    Sangat aman. Seluruh simpanan nasabah di BPR Adiartha dijamin oleh Lembaga Penjamin Simpanan (LPS) sesuai dengan syarat dan ketentuan tingkat bunga penjaminan yang berlaku.
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <PublicFooter/>
    </div>
  );
}
