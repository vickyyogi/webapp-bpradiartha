import Link from "next/link";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { LoginForm } from "./LoginForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Masuk Portal",
  description: "Portal operasional terintegrasi PT BPR Adiartha Utama untuk Account Officer, Analis Kredit, Pengadaan, dan Manajemen.",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <div className="min-h-screen grid lg:grid-cols-12 bg-lp-bg">
      {/* Brand & Visual Hero Area (Left) — panel ink ala band landing page */}
      <div className="lg:col-span-5 bg-lp-band text-lp-band-text p-8 lg:p-12 flex flex-col justify-between relative overflow-hidden">
        {/* Glow dekoratif violet + lime */}
        <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-lp-glow-violet blur-3xl pointer-events-none" />
        <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-lp-glow-lime blur-3xl pointer-events-none" />

        {/* Top: Logo & Back */}
        <div className="relative z-10 space-y-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-medium text-lp-band-muted hover:text-lp-band-text transition-colors bg-lp-band-2/60 hover:bg-lp-band-2 px-3 py-1.5 rounded-full border border-lp-band-border backdrop-blur-xs w-fit"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Beranda
          </Link>
          <div className="pt-4">
            <div className="inline-flex items-center gap-2 bg-lp-band-2/70 border border-lp-band-border px-3 py-1 rounded-full text-[11px] font-medium text-lp-accent mb-4">
              <ShieldCheck className="h-3.5 w-3.5 text-lp-accent" />
              Sistem Perbankan BPR Terpercaya
            </div>
            <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-lp-band-text">
              PT BPR Adiartha Utama
            </h1>
            <p className="text-lp-band-muted text-sm mt-2 leading-relaxed">
              Portal operasional terintegrasi untuk Account Officer, Analis Kredit, Pengadaan, dan Manajemen.
            </p>
          </div>
        </div>

        {/* Bottom Trust & Compliance */}
        <div className="relative z-10 pt-10 border-t border-lp-band-border space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-lp-band-muted">
            <span className="font-semibold text-lp-accent">Resmi &amp; Diawasi:</span>
            <span>Otoritas Jasa Keuangan (OJK)</span>
            <span>•</span>
            <span>Lembaga Penjamin Simpanan (LPS)</span>
          </div>
          <p className="text-[11px] text-lp-band-muted/70">
            &copy; {new Date().getFullYear()} PT BPR Adiartha Utama. Seluruh Hak Cipta Dilindungi.
          </p>
        </div>
      </div>

      {/* Login Form Container (Right) */}
      <div className="lg:col-span-7 flex items-center justify-center p-6 sm:p-10 lg:p-16">
        <div className="w-full max-w-md">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
