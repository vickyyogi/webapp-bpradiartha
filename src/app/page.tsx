"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import {
  ShieldCheck,
  Building2,
  Phone,
  Calculator,
  CheckCircle2,
  CreditCard,
  PiggyBank,
  Briefcase,
  Users2,
  ArrowRight,
  ArrowLeft,
  Send,
  HelpCircle,
  Camera,
  Coins,
  Gem,
  Landmark,
  BadgePercent,
  Wallet,
  TrendingUp,
  Clock,
  Home,
  ListTree,
  Info,
  ChevronRight,
  Zap,
} from "lucide-react";
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
    case "MULTI_GUNA":
    case "KONSUMTIF":
    case "INVESTASI":
      return "bg-lp-accent-soft text-lp-brand";
    case "TABUNGAN":
    case "DEPOSITO":
      return "bg-lp-brand-soft text-lp-brand";
    default:
      return "bg-lp-brand-soft text-lp-brand";
  }
}

// Fallback shown when the admin dashboard has no hero slides configured.
// These are the pre-normalised (1100x1400, equal subject height) versions.
const FALLBACK_HERO_SLIDES = [
  { src: "/model/normalized/model1_norm.png", alt: "Nasabah BPR Adiartha Reksacitra" },
  { src: "/model/normalized/model2_norm.png", alt: "Nasabah BPR Adiartha Reksacitra" },
  { src: "/model/normalized/model3_norm.png", alt: "Nasabah BPR Adiartha Reksacitra" },
];

const KEUNGGULAN = [
  {
    icon: Clock,
    title: "Proses Cepat",
    desc: "Persetujuan kredit tanpa birokrasi berbelit. Verifikasi berkas dan survey lapangan tepat waktu.",
  },
  {
    icon: ShieldCheck,
    title: "Aman & Terpercaya",
    desc: "Berizin resmi dan diawasi OJK, seluruh simpanan tabungan & deposito dijamin LPS.",
  },
  {
    icon: Users2,
    title: "Pendampingan AO",
    desc: "Account Officer kami siap mengunjungi tempat tinggal atau lokasi usaha Anda kapan saja.",
  },
  {
    icon: Building2,
    title: "Jaringan Luas",
    desc: "Kantor pusat dan kantor cabang strategis yang mudah dijangkau dengan pelayanan kekeluargaan.",
  },
];

const STATS = [
  { icon: Clock, value: "1-3 Hari", label: "Proses Persetujuan" },
  { icon: Coins, value: "Rp 2 M+", label: "Plafon Kredit" },
  { icon: TrendingUp, value: "6-60 Bln", label: "Tenor Fleksibel" },
  { icon: Phone, value: "24/7", label: "Konsultasi AO" },
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

  // Carousel produk
  const produkScrollRef = useRef<HTMLDivElement>(null);
  const scrollProduk = (dir: 1 | -1) => {
    produkScrollRef.current?.scrollBy({ left: dir * 340, behavior: "smooth" });
  };

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
    <div className="min-h-screen flex flex-col bg-lp-bg text-lp-text">
      {/* Main Header / Navigation */}
      <PublicHeader />

      {/* ============================= HERO ============================= */}
      <section id="beranda" className="lp-hero-bg relative isolate overflow-hidden scroll-mt-28">
        {/* Decorative glows */}
        <div
          aria-hidden="true"
          className="absolute -right-24 -top-24 h-[34rem] w-[34rem] rounded-full bg-lp-glow-violet blur-3xl opacity-60"
        />
        <div
          aria-hidden="true"
          className="absolute -left-32 bottom-0 h-80 w-80 rounded-full bg-lp-glow-lime blur-3xl opacity-50"
        />
        <div aria-hidden="true" className="lp-dots absolute right-8 top-28 h-40 w-56 opacity-70 hidden lg:block" />
        <div aria-hidden="true" className="lp-dots absolute left-1/2 bottom-10 h-28 w-40 opacity-50 hidden lg:block" />

        {/* Floating quick-nav rail */}
        <nav
          aria-label="Navigasi cepat"
          className="absolute left-6 top-1/2 z-20 hidden -translate-y-1/2 xl:flex flex-col gap-2 rounded-full border border-lp-border bg-lp-card/80 p-2.5 shadow-xl backdrop-blur-md"
        >
          <a href="#beranda" aria-label="Beranda" className="lp-circle lp-circle-dark h-10 w-10">
            <Home className="h-4 w-4" />
          </a>
          <a href="#produk" aria-label="Produk" className="lp-circle lp-circle-light h-10 w-10">
            <ListTree className="h-4 w-4" />
          </a>
          <a href="#simulasi-kredit" aria-label="Simulasi kredit" className="lp-circle lp-circle-light h-10 w-10">
            <Calculator className="h-4 w-4" />
          </a>
          <a href="#form-pengajuan" aria-label="Formulir pengajuan" className="lp-circle lp-circle-light h-10 w-10">
            <Send className="h-4 w-4" />
          </a>
          <a href="#faq" aria-label="Tanya jawab" className="lp-circle lp-circle-light h-10 w-10">
            <Info className="h-4 w-4" />
          </a>
        </nav>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 pt-14 pb-24 lg:pt-20 lg:pb-32">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            {/* Copy */}
            <div className="lg:col-span-6 space-y-7 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-lp-border bg-lp-card/70 px-4 py-2 backdrop-blur">
                <span className="lp-circle lp-circle-accent h-6 w-6">
                  <Zap className="h-3.5 w-3.5" />
                </span>
                <span className="lp-eyebrow text-lp-brand">Solusi Finansial Terpercaya</span>
              </div>

              <h1 className="lp-display text-[2.75rem] leading-[0.95] sm:text-7xl lg:text-[5.25rem] animate-fade-in-up">
                Wujudkan
                <br />
                <span className="lp-text-gradient">Masa Depan</span>
                <br />
                Usaha Anda
              </h1>

              <p className="text-base sm:text-lg text-lp-muted max-w-xl mx-auto lg:mx-0 leading-relaxed animate-fade-in-up">
                Cepat. Transparan. Terpercaya. Fasilitas pinjaman modal kerja, investasi usaha, dan kredit multiguna,
                serta tabungan &amp; deposito aman dijamin LPS.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start pt-1">
                <button type="button" onClick={scrollToApply} className="lp-btn lp-btn-accent pl-7 pr-2 py-2 text-sm sm:text-base gap-4">
                  Ajukan Kredit
                  <span className="lp-circle lp-circle-dark h-10 w-10">
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </button>
                <button type="button" onClick={scrollToSimulator} className="lp-btn lp-btn-soft px-7 py-3.5 text-sm sm:text-base gap-2">
                  <Calculator className="h-4 w-4 text-lp-brand" />
                  Hitung Simulasi
                </button>
              </div>

              {/* Trust chips */}
              <div className="flex flex-wrap items-center gap-3 justify-center lg:justify-start pt-3">
                <div className="flex items-center gap-2 rounded-full border border-lp-border bg-lp-card/70 px-3.5 py-2 backdrop-blur">
                  <ShieldCheck className="h-4 w-4 text-lp-brand" />
                  <span className="text-xs font-semibold">Berizin &amp; Diawasi OJK</span>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-lp-border bg-lp-card/70 px-3.5 py-2 backdrop-blur">
                  <Landmark className="h-4 w-4 text-lp-brand" />
                  <span className="text-xs font-semibold">Simpanan Dijamin LPS</span>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-lp-border bg-lp-card/70 px-3.5 py-2 backdrop-blur">
                  <Users2 className="h-4 w-4 text-lp-brand" />
                  <span className="text-xs font-semibold">AO Siap Kunjungi Lokasi</span>
                </div>
              </div>
            </div>

            {/* Hero Visual - Model Portrait */}
            <div className="lg:col-span-6">
              <div className="relative isolate mx-auto w-full max-w-md lg:max-w-xl">
                {/* Violet blob behind the portrait */}
                <div
                  aria-hidden="true"
                  className="absolute -inset-6 -z-10 rounded-[3rem] bg-lp-glow-violet blur-2xl opacity-70 rotate-6"
                />
                <div aria-hidden="true" className="lp-dots absolute -left-10 top-10 -z-10 h-32 w-24 opacity-80 hidden sm:block" />
                <div aria-hidden="true" className="lp-dots absolute -right-8 bottom-16 -z-10 h-28 w-24 opacity-80 hidden sm:block" />

                {/* Framed portrait slideshow */}
                <div
                  className="group relative overflow-hidden rounded-[2.25rem] border border-lp-border bg-lp-card shadow-2xl shadow-lp-glow-violet/25"
                  onMouseEnter={() => setHeroPaused(true)}
                  onMouseLeave={() => setHeroPaused(false)}
                >
                  <div className="relative aspect-[1100/1400] w-full">
                    {heroImages.map((slide, i) => (
                      <Image
                        key={slide.src}
                        src={slide.src}
                        alt={slide.alt}
                        fill
                        preload={i === 0}
                        aria-hidden={i !== heroSlide}
                        sizes="(max-width: 1024px) 100vw, 480px"
                        className={`object-contain transition-all duration-1000 ease-out ${
                          i === heroSlide ? "opacity-100" : "opacity-0"
                        } ${heroReducedMotion || i === heroSlide ? "scale-100" : "scale-[1.04]"}`}
                      />
                    ))}
                  </div>

                  {/* Slide indicators */}
                  <div className="absolute right-4 top-4 z-20 flex items-center gap-1.5 rounded-full border border-lp-border bg-lp-card/85 px-2.5 py-1.5 shadow-sm backdrop-blur">
                    {heroImages.map((slide, i) => (
                      <button
                        key={slide.src}
                        type="button"
                        onClick={() => setHeroSlide(i)}
                        aria-label={`Tampilkan gambar model ${i + 1}`}
                        aria-current={i === heroSlide}
                        className={`h-2 cursor-pointer rounded-full transition-all duration-300 ${
                          i === heroSlide ? "w-6 bg-lp-brand" : "w-2 bg-lp-brand/30 hover:bg-lp-brand/60"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Floating trust card */}
                <div className="absolute inset-x-4 -bottom-6 z-30 sm:inset-x-6">
                  <div className="flex items-center gap-3 rounded-2xl border border-lp-border bg-lp-card/95 px-4 py-3 shadow-xl backdrop-blur-md">
                    <div className="lp-circle lp-circle-accent h-11 w-11">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-lp-text">Aman &amp; Terpercaya</div>
                      <div className="truncate text-[11px] text-lp-muted">
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

      {/* ==================== DARK FEATURE BAND ==================== */}
      <section
        id="keunggulan"
        ref={keunggulanRef}
        className={`relative z-10 -mt-12 px-4 sm:px-6 lg:px-8 pb-6 transition-all duration-700 ${
          keunggulanVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
        }`}
      >
        <div className="max-w-7xl mx-auto rounded-[2.25rem] bg-lp-band text-lp-band-text px-6 sm:px-10 lg:px-12 py-12 lg:py-14 shadow-2xl shadow-lp-glow-violet/20">
          <p className="lp-eyebrow text-lp-accent mb-10">Dibangun untuk masa depan Anda</p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-10">
            {KEUNGGULAN.map((k) => (
              <div key={k.title} className="space-y-4">
                <div className="lp-circle lp-circle-accent h-12 w-12">
                  <k.icon className="h-5 w-5" />
                </div>
                <h3 className="lp-display text-lg leading-tight">{k.title}</h3>
                <p className="text-sm text-lp-band-muted leading-relaxed">{k.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================= PRODUK ========================= */}
      <section
        id="produk"
        ref={produkRef}
        className={`py-20 scroll-mt-28 transition-all duration-700 ${
          produkVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div className="max-w-xl space-y-4">
              <p className="lp-eyebrow text-lp-brand">Produk &amp; Layanan</p>
              <h2 className="lp-display text-4xl sm:text-5xl leading-[1.02]">
                Pilihan Fasilitas
                <br />
                untuk Setiap Kebutuhan
              </h2>
              <div className="h-1 w-16 rounded-full bg-lp-accent" />
              <p className="text-lp-muted text-sm sm:text-base leading-relaxed">
                Kredit, simpanan, dan investasi yang dirancang mendukung kemajuan bisnis serta kesejahteraan keluarga
                Anda.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button type="button" onClick={() => scrollProduk(-1)} aria-label="Produk sebelumnya" className="lp-circle lp-circle-light h-12 w-12">
                <ArrowLeft className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => scrollProduk(1)} aria-label="Produk berikutnya" className="lp-circle lp-circle-dark h-12 w-12">
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Carousel produk */}
          <div
            ref={produkScrollRef}
            className="flex gap-6 overflow-x-auto pb-4 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {(cmsProducts.length > 0
              ? cmsProducts.map((p) => {
                  let featuresList: string[] = [];
                  if (p.features) {
                    try {
                      featuresList = JSON.parse(p.features);
                    } catch (e) {
                      featuresList = [];
                    }
                  }
                  return {
                    key: p.id,
                    icon: getProductIcon(p.icon, p.category),
                    color: getProductColor(p.category),
                    badge: p.badge as string | null,
                    name: p.name as string,
                    desc: p.description as string,
                    features: featuresList,
                  };
                })
              : [
                  {
                    key: "fallback-1",
                    icon: <Briefcase className="h-6 w-6" />,
                    color: getProductColor("MODAL_KERJA"),
                    badge: "Usaha",
                    name: "Kredit Modal Kerja",
                    desc: "Bantuan likuiditas usaha untuk menambah stok persediaan toko, operasional harian, dan piutang dagang.",
                    features: [
                      "Plafon s.d. Rp 1.000.000.000",
                      "Tenor fleksibel 12 s.d. 36 bulan",
                      "Jaminan SHM / BPKB Kendaraan",
                    ],
                  },
                  {
                    key: "fallback-2",
                    icon: <CreditCard className="h-6 w-6" />,
                    color: getProductColor("MULTI_GUNA"),
                    badge: "Favorit",
                    name: "Kredit Multi Guna",
                    desc: "Fasilitas pinjaman perorangan untuk renovasi rumah, pendidikan anak, biaya kesehatan, atau konsumtif lainnya.",
                    features: [
                      "Bunga ringan & cicilan tetap",
                      "Jangka waktu panjang s.d. 5 tahun",
                      "Syarat berkas mudah & pendampingan AO",
                    ],
                  },
                  {
                    key: "fallback-3",
                    icon: <PiggyBank className="h-6 w-6" />,
                    color: getProductColor("TABUNGAN"),
                    badge: "Dijamin LPS",
                    name: "Deposito & Tabungan",
                    desc: "Kembangkan dana mengendap Anda dengan suku bunga menarik di atas rata-rata bank umum, 100% dijamin LPS.",
                    features: [
                      "Bunga bersaing sesuai batas penjaminan LPS",
                      "Tenor 1, 3, 6, dan 12 bulan",
                      "Bebas biaya administrasi bulanan",
                    ],
                  },
                ]
            ).map((p) => (
              <article
                key={p.key}
                className="group lp-card snap-start flex flex-col justify-between min-w-[290px] sm:min-w-[320px] max-w-[340px] p-7 hover:border-lp-brand/50 hover:shadow-xl hover:shadow-lp-glow-violet/10 transition-all duration-300"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className={`h-13 w-13 rounded-2xl flex items-center justify-center ${p.color}`}>
                      {p.icon}
                    </div>
                    {p.badge && (
                      <span className="lp-eyebrow text-[9px] rounded-full border border-lp-border bg-lp-card-2 text-lp-muted px-2.5 py-1.5">
                        {p.badge}
                      </span>
                    )}
                  </div>

                  <h3 className="font-sans text-xl font-bold leading-snug">{p.name}</h3>
                  <p className="text-sm text-lp-muted leading-relaxed">{p.desc}</p>

                  {p.features.length > 0 && (
                    <ul className="space-y-2.5 pt-1">
                      {p.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-lp-muted">
                          <CheckCircle2 className="h-4 w-4 text-lp-brand shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3 pt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setFormData((prev) => ({ ...prev, productInterest: p.name }));
                      scrollToApply();
                    }}
                    className="text-sm font-semibold group-hover:text-lp-brand transition-colors cursor-pointer"
                  >
                    Pilih Produk
                  </button>
                  <button
                    type="button"
                    aria-label={`Pilih ${p.name}`}
                    onClick={() => {
                      setFormData((prev) => ({ ...prev, productInterest: p.name }));
                      scrollToApply();
                    }}
                    className="lp-circle lp-circle-accent h-11 w-11"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ======================= STATS BAND ======================= */}
      <section className="px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto rounded-[2rem] bg-lp-brand-band text-lp-on-brand">
          <div className="grid grid-cols-2 lg:grid-cols-4">
            {STATS.map((s) => (
              <div
                key={s.label}
                className="flex items-center gap-4 px-6 sm:px-8 py-8 border-b border-r border-lp-on-brand/15 [&:nth-child(2n)]:border-r-0 [&:nth-child(n+3)]:border-b-0 lg:border-b-0 lg:[&:nth-child(2n)]:border-r lg:[&:nth-child(4n)]:border-r-0"
              >
                <div className="lp-circle h-12 w-12 bg-lp-on-brand/10 text-lp-on-brand">
                  <s.icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="lp-display text-2xl leading-none">{s.value}</div>
                  <div className="text-xs mt-1.5 text-lp-on-brand/80">{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ======================= SIMULASI ======================= */}
      <section
        id="simulasi-kredit"
        ref={simulasiRef}
        className={`py-20 scroll-mt-28 transition-all duration-700 ${
          simulasiVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-5 space-y-6">
              <p className="lp-eyebrow text-lp-brand">Kalkulator Interaktif</p>
              <h2 className="lp-display text-4xl sm:text-5xl leading-[1.02]">
                Simulasi Angsuran
                <br />
                <span className="lp-text-gradient">Transparan</span>
              </h2>
              <p className="text-lp-muted leading-relaxed">
                Kami menjunjung tinggi transparansi tanpa biaya tersembunyi. Tentukan plafon dan tenor yang paling
                nyaman bagi keuangan Anda.
              </p>

              <div className="space-y-4 pt-2">
                {[
                  {
                    n: "1",
                    t: "Tentukan Kebutuhan Modal",
                    d: "Sesuaikan dengan rincian anggaran belanja atau kebutuhan investasi.",
                  },
                  {
                    n: "2",
                    t: "Pilih Jangka Waktu Cicilan",
                    d: "Tenor fleksibel dari 6 bulan hingga 60 bulan sesuai perputaran arus kas.",
                  },
                  {
                    n: "3",
                    t: "Kirim Permohonan Langsung",
                    d: "Tim Account Officer kami siap berkunjung dan membantu proses berkas.",
                  },
                ].map((step) => (
                  <div key={step.n} className="flex items-start gap-3">
                    <div className="lp-circle lp-circle-accent h-8 w-8 text-sm font-bold">{step.n}</div>
                    <div>
                      <h4 className="text-sm font-bold">{step.t}</h4>
                      <p className="text-xs text-lp-muted leading-relaxed">{step.d}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="lp-card p-7 sm:p-9 shadow-xl shadow-lp-glow-violet/10">
                <div className="space-y-2">
                  <h3 className="font-sans text-xl font-bold">Formulir Simulasi Angsuran</h3>
                  <p className="text-sm text-lp-muted">Sesuaikan parameter di bawah untuk melihat rincian angsuran</p>
                </div>

                <div className="space-y-6 mt-7">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold">Plafon Pinjaman (Rp)</label>
                      <input
                        type="number"
                        min="1000000"
                        step="1000000"
                        value={plafond}
                        onChange={(e) => setPlafond(Math.max(0, Number(e.target.value)))}
                        className="lp-input mt-1.5 font-semibold"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold">Suku Bunga (% per bulan)</label>
                      <input
                        type="number"
                        step="0.05"
                        value={bungaBulan}
                        onChange={(e) => setBungaBulan(Math.max(0, Number(e.target.value)))}
                        className="lp-input mt-1.5 font-semibold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold mb-2 block">Pilih Jangka Waktu (Tenor Bulan):</label>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {[6, 12, 18, 24, 36, 60].map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setTenor(t)}
                          className={`lp-chip py-2.5 text-xs ${tenor === t ? "lp-chip-active" : ""}`}
                        >
                          {t} Bulan
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-4 pt-6 border-t border-lp-border">
                    <div className="p-4 rounded-2xl bg-lp-card-2 text-center">
                      <span className="text-xs text-lp-muted">Plafond</span>
                      <div className="text-base font-bold text-lp-text mt-1">
                        Rp {Math.round(plafond).toLocaleString("id-ID")}
                      </div>
                    </div>
                    <div className="p-4 rounded-2xl bg-lp-card-2 text-center">
                      <span className="text-xs text-lp-muted">Suku Bunga per Tahun</span>
                      <div className="text-base font-bold text-lp-text mt-1">{bungaBulan * 12}%</div>
                    </div>
                    <div className="p-4 rounded-2xl border border-lp-brand/30 bg-lp-brand-soft text-center">
                      <span className="text-xs font-medium text-lp-brand">Total Angsuran / Bln</span>
                      <div className="text-lg font-extrabold text-lp-brand mt-1">
                        Rp {totalAngsuranBulanan.toLocaleString("id-ID")}
                      </div>
                    </div>
                  </div>

                  <button type="button" onClick={scrollToApply} className="lp-btn lp-btn-accent w-full py-4 text-sm gap-2">
                    Gunakan Simulasi Ini &amp; Ajukan Pinjaman
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== FORM PENGAJUAN ==================== */}
      <section
        id="form-pengajuan"
        ref={formRef}
        className={`py-20 bg-lp-bg-2 scroll-mt-28 transition-all duration-700 ${
          formVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
        }`}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-10">
            <p className="lp-eyebrow text-lp-brand">Formulir Online</p>
            <h2 className="lp-display text-4xl sm:text-5xl leading-[1.02]">
              Ajukan Permohonan
              <br />
              <span className="lp-text-gradient">atau Konsultasi</span>
            </h2>
            <p className="text-lp-muted text-sm max-w-xl mx-auto leading-relaxed">
              Isi data diri singkat Anda di bawah ini. Permohonan akan langsung terhubung ke sistem operasional CRM kami
              dan dihubungi dalam 1x24 jam.
            </p>
          </div>

          <div className="lp-card p-6 sm:p-9 shadow-xl shadow-lp-glow-violet/10">
            {submitSuccess ? (
              <div className="text-center py-12 space-y-4">
                <div className="lp-circle lp-circle-accent h-16 w-16 mx-auto">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h3 className="font-sans text-2xl font-bold text-lp-text">Permohonan Berhasil Dikirim!</h3>
                <p className="text-lp-muted text-sm max-w-md mx-auto leading-relaxed">
                  Terima kasih telah mempercayai BPR Adiartha. Petugas Account Officer kami akan segera menghubungi
                  nomor WhatsApp/Telepon Anda untuk memandu proses selanjutnya.
                </p>
                <button
                  type="button"
                  onClick={() => setSubmitSuccess(false)}
                  className="lp-btn lp-btn-soft px-6 py-3 text-sm mt-4"
                >
                  Kirim Pengajuan Lainnya
                </button>
              </div>
            ) : (
              <form onSubmit={handleApplyNow} className="space-y-4">
                {submitError && (
                  <div className="p-3 rounded-xl border border-lp-border bg-lp-card-2 text-sm font-medium text-lp-text">
                    {submitError}
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold">Nama Lengkap Sesuai KTP *</label>
                    <input
                      required
                      placeholder="Contoh: I Wayan Sudarma"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="lp-input mt-1.5"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold">Nomor WhatsApp / HP Aktif *</label>
                    <input
                      required
                      placeholder="Contoh: 081234567890"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="lp-input mt-1.5"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold">Produk yang Diminati *</label>
                    <select
                      value={formData.productInterest}
                      onChange={(e) => setFormData({ ...formData, productInterest: e.target.value })}
                      className="lp-input mt-1.5 font-medium"
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
                    <input
                      disabled
                      value={`Rp ${plafond.toLocaleString("id-ID")} (${tenor} Bulan)`}
                      className="lp-input mt-1.5 font-semibold text-lp-brand"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold">Alamat Domisili / Lokasi Usaha</label>
                  <input
                    placeholder="Contoh: Jl. Diponegoro No. 25, Denpasar Barat"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="lp-input mt-1.5"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold">Catatan Tambahan / Keperluan Pinjaman</label>
                  <textarea
                    rows={3}
                    placeholder="Ceritakan singkat mengenai rencana penggunaan pinjaman atau jaminan yang dimiliki..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="lp-input mt-1.5 resize-none"
                  />
                </div>

                <div className="pt-2">
                  <button type="submit" disabled={isSubmitting} className="lp-btn lp-btn-accent w-full py-4 text-sm gap-2 disabled:opacity-60">
                    <Send className="h-4 w-4" />
                    {isSubmitting ? "Mengirimkan Permohonan..." : "Kirimkan Permohonan Sekarang"}
                  </button>
                  <p className="text-[11px] text-center text-lp-muted mt-3 leading-relaxed">
                    Dengan mengirimkan formulir ini, Anda menyetujui petugas BPR menghubungi Anda untuk konsultasi
                    perbankan. Kerahasiaan data Anda terlindungi.
                  </p>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* ========================= BERITA ========================= */}
      {berita.length > 0 && (
        <section id="berita" className="py-20 scroll-mt-28">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto space-y-4 mb-14">
              <p className="lp-eyebrow text-lp-brand">Publikasi &amp; Kabar</p>
              <h2 className="lp-display text-4xl sm:text-5xl leading-[1.02]">Berita &amp; Edukasi Finansial</h2>
              <div className="h-1 w-16 rounded-full bg-lp-accent mx-auto" />
              <p className="text-lp-muted text-sm leading-relaxed">
                Informasi terbaru seputar kegiatan operasional kantor, promo suku bunga, dan program literasi perbankan
                BPR Adiartha.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {berita.map((post) => (
                <article
                  key={post.id}
                  className="lp-card overflow-hidden flex flex-col justify-between group hover:border-lp-brand/50 hover:shadow-xl hover:shadow-lp-glow-violet/10 transition-all duration-300"
                >
                  {post.featuredImage && (
                    <div className="h-44 w-full bg-lp-card-2 overflow-hidden relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={post.featuredImage}
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  )}
                  <div className="p-6 space-y-3 flex-1 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="lp-eyebrow text-[9px] rounded-full bg-lp-accent-soft text-lp-brand px-2.5 py-1.5">
                          {post.category}
                        </span>
                        <span className="text-[11px] text-lp-muted">
                          {post.publishedAt
                            ? new Date(post.publishedAt).toLocaleDateString("id-ID", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })
                            : ""}
                        </span>
                      </div>
                      <h3 className="font-sans text-base font-bold line-clamp-2 leading-snug group-hover:text-lp-brand transition-colors">
                        <Link href={`/berita/${post.slug}`}>{post.title}</Link>
                      </h3>
                      <p className="text-xs text-lp-muted line-clamp-3 leading-relaxed">
                        {post.excerpt || post.content.slice(0, 130) + "..."}
                      </p>
                    </div>
                    <div className="pt-4 border-t border-lp-border flex items-center justify-between text-xs">
                      <span className="text-lp-muted">Oleh: {post.authorName || "Redaksi"}</span>
                      <Link
                        href={`/berita/${post.slug}`}
                        className="text-lp-brand font-semibold hover:underline flex items-center gap-1"
                      >
                        Baca <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="text-center mt-10">
              <Link href="/berita" className="lp-btn lp-btn-soft px-7 py-3.5 text-xs sm:text-sm gap-2">
                Lihat Semua Berita &amp; Kegiatan Kantor <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ========================= GALERI ========================= */}
      {cmsGalleries.length > 0 && (
        <section id="galeri" className="py-20 bg-lp-bg-2 scroll-mt-28">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12">
              <div className="space-y-4 max-w-2xl">
                <p className="lp-eyebrow text-lp-brand">Dokumentasi Foto</p>
                <h2 className="lp-display text-4xl sm:text-5xl leading-[1.02]">Galeri Kegiatan Kantor</h2>
                <div className="h-1 w-16 rounded-full bg-lp-accent" />
                <p className="text-lp-muted text-sm leading-relaxed">
                  Dokumentasi visual momen kebersamaan, bakti sosial kemasyarakatan, kegiatan survei lapangan, dan
                  perayaan HUT BPR Adiartha.
                </p>
              </div>
              <Link href="/galeri" className="lp-btn lp-btn-soft px-6 py-3.5 gap-2 shrink-0 text-sm">
                <Camera className="h-4 w-4 text-lp-brand" /> Buka Album Galeri Lengkap
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {cmsGalleries.map((item) => (
                <Link
                  key={item.id}
                  href="/galeri"
                  className="group lp-card overflow-hidden hover:border-lp-brand/50 hover:shadow-xl hover:shadow-lp-glow-violet/10 transition-all"
                >
                  <div className="aspect-[4/3] w-full bg-lp-card-2 overflow-hidden relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-3 left-3">
                      <span className="lp-eyebrow text-[9px] rounded-full bg-lp-band/80 text-lp-band-text px-2.5 py-1.5 backdrop-blur">
                        {item.category}
                      </span>
                    </div>
                  </div>
                  <div className="p-4">
                    <h4 className="font-semibold text-xs line-clamp-2 group-hover:text-lp-brand transition-colors">
                      {item.title}
                    </h4>
                    <span className="text-[10px] text-lp-muted block mt-1.5">
                      {item.eventDate
                        ? new Date(item.eventDate).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : ""}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* =========================== FAQ =========================== */}
      <section
        id="faq"
        ref={faqRef}
        className={`py-20 scroll-mt-28 transition-all duration-700 ${
          faqVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
        }`}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-12">
            <p className="lp-eyebrow text-lp-brand">Pertanyaan Umum</p>
            <h2 className="lp-display text-4xl sm:text-5xl leading-[1.02]">Tanya Jawab</h2>
            <div className="h-1 w-16 rounded-full bg-lp-accent mx-auto" />
            <p className="text-lp-muted text-sm leading-relaxed">
              Hal-hal yang sering ditanyakan mengenai produk kredit dan layanan perbankan BPR Adiartha.
            </p>
          </div>

          <div className="space-y-4">
            {cmsFaqs.length > 0 ? (
              cmsFaqs.map((faq) => (
                <div key={faq.id} className="lp-card p-6">
                  <h3 className="font-sans text-base font-bold flex items-center gap-3">
                    <span className="lp-circle h-8 w-8 bg-lp-accent-soft text-lp-brand">
                      <HelpCircle className="h-4 w-4" />
                    </span>
                    {faq.question}
                  </h3>
                  <p className="text-xs text-lp-muted mt-3 ml-11 leading-relaxed">{faq.answer}</p>
                </div>
              ))
            ) : (
              <>
                <div className="lp-card p-6">
                  <h3 className="font-sans text-base font-bold flex items-center gap-3">
                    <span className="lp-circle h-8 w-8 bg-lp-accent-soft text-lp-brand">
                      <HelpCircle className="h-4 w-4" />
                    </span>
                    Apa saja syarat umum pengajuan kredit di BPR Adiartha?
                  </h3>
                  <p className="text-xs text-lp-muted mt-3 ml-11 leading-relaxed">
                    Syarat umum meliputi KTP pemohon dan pasangan, Kartu Keluarga (KK), bukti
                    penghasilan/rekening koran usaha 3 bulan terakhir, serta dokumen agunan (Sertifikat SHM/SHGB atau
                    BPKB kendaraan).
                  </p>
                </div>

                <div className="lp-card p-6">
                  <h3 className="font-sans text-base font-bold flex items-center gap-3">
                    <span className="lp-circle h-8 w-8 bg-lp-accent-soft text-lp-brand">
                      <HelpCircle className="h-4 w-4" />
                    </span>
                    Berapa lama proses persetujuan dan pencairan kredit?
                  </h3>
                  <p className="text-xs text-lp-muted mt-3 ml-11 leading-relaxed">
                    Apabila dokumen telah lengkap dan proses survey lapangan selesai dilaksanakan, keputusan kredit
                    rata-rata dapat diterbitkan dalam waktu 1 hingga 3 hari kerja.
                  </p>
                </div>

                <div className="lp-card p-6">
                  <h3 className="font-sans text-base font-bold flex items-center gap-3">
                    <span className="lp-circle h-8 w-8 bg-lp-accent-soft text-lp-brand">
                      <HelpCircle className="h-4 w-4" />
                    </span>
                    Apakah simpanan deposito di BPR aman?
                  </h3>
                  <p className="text-xs text-lp-muted mt-3 ml-11 leading-relaxed">
                    Sangat aman. Seluruh simpanan nasabah di BPR Adiartha dijamin oleh Lembaga Penjamin Simpanan (LPS)
                    sesuai dengan syarat dan ketentuan tingkat bunga penjaminan yang berlaku.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ================== TESTIMONI + CTA BAND ================== */}
      <section className="px-4 sm:px-6 lg:px-8 pb-20">
        <div className="max-w-7xl mx-auto rounded-[2.25rem] bg-lp-band text-lp-band-text overflow-hidden">
          <div className="grid lg:grid-cols-12 gap-0">
            {/* Visual */}
            <div className="lg:col-span-4 relative min-h-[280px] lg:min-h-[420px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/office.jpg"
                alt="Kantor BPR Adiartha Reksacitra"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div aria-hidden="true" className="absolute inset-0 bg-lp-band/45" />
              <div aria-hidden="true" className="lp-dots absolute right-6 top-6 h-24 w-24 opacity-70" />
            </div>

            {/* Testimoni */}
            <div className="lg:col-span-5 px-8 sm:px-12 py-12 lg:py-16 flex flex-col justify-center gap-6">
              <div className="lp-display text-lp-accent text-6xl leading-none">&ldquo;</div>
              <p className="text-xl sm:text-2xl leading-snug font-semibold">
                BPR Adiartha bukan sekadar tempat meminjam &mdash; mereka mendampingi usaha kami tumbuh, dengan proses
                cepat dan transparan.
              </p>
              <div>
                <div className="text-sm font-bold text-lp-accent">Nasabah UMKM</div>
                <div className="text-xs text-lp-band-muted mt-1">Pelaku Usaha &middot; Malang Raya</div>
              </div>
            </div>

            {/* CTA Card */}
            <div className="lg:col-span-3 p-8 lg:p-10 flex items-center">
              <div className="w-full rounded-[1.5rem] border border-lp-accent/40 bg-lp-band-2 p-7 space-y-5">
                <h3 className="lp-display text-xl leading-tight">
                  Siap Wujudkan
                  <br />
                  Rencana Anda?
                </h3>
                <p className="text-xs text-lp-band-muted leading-relaxed">
                  Konsultasikan kebutuhan kredit Anda bersama Account Officer kami &mdash; cepat, transparan, dan tanpa
                  biaya tersembunyi.
                </p>
                <button type="button" onClick={scrollToApply} className="lp-btn lp-btn-accent w-full pl-6 pr-2 py-2 text-xs gap-3">
                  Ajukan Sekarang
                  <span className="lp-circle lp-circle-dark h-9 w-9">
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <PublicFooter />
    </div>
  );
}
