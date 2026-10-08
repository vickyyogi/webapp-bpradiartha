import Link from "next/link";
import { ShieldCheck, Lock, Building2, ArrowLeft } from "lucide-react";
import { LoginForm } from "./LoginForm";
import { Badge } from "@/components/ui/badge";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Masuk Portal",
  description: "Portal operasional terintegrasi PT BPR Adiartha Utama untuk Account Officer, Analis Kredit, Pengadaan, dan Manajemen.",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <div className="min-h-screen grid lg:grid-cols-12 bg-background">
      {/* Brand & Visual Hero Area (Left) */}
      <div className="lg:col-span-5 bg-gradient-to-br from-primary-dark via-primary to-primary text-primary-foreground p-8 lg:p-12 flex flex-col justify-between relative overflow-hidden">
        {/* Subtle decorative gold/warm curves */}
        <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-gold/10 blur-3xl pointer-events-none" />
        <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-white/5 blur-2xl pointer-events-none" />

        {/* Top: Logo & Back */}
        <div className="relative z-10 space-y-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-medium text-white/80 hover:text-white transition-colors bg-black/10 hover:bg-black/20 px-3 py-1.5 rounded-full backdrop-blur-xs w-fit"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Beranda
          </Link>
          <div className="pt-4">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-xs border border-gold/30 px-3 py-1 rounded-full text-[11px] font-medium text-gold-light mb-4">
              <ShieldCheck className="h-3.5 w-3.5 text-gold" />
              Sistem Perbankan BPR Terpercaya
            </div>
            <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white">
              PT BPR Adiartha Utama
            </h1>
            <p className="text-white/80 text-sm mt-2 leading-relaxed">
              Portal operasional terintegrasi untuk Account Officer, Analis Kredit, Pengadaan, dan Manajemen.
            </p>
          </div>
        </div>

        {/* Bottom Trust & Compliance */}
        <div className="relative z-10 pt-10 border-t border-white/15 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/90">
            <span className="font-semibold text-gold-light">Resmi & Diawasi:</span>
            <span>Otoritas Jasa Keuangan (OJK)</span>
            <span>•</span>
            <span>Lembaga Penjamin Simpanan (LPS)</span>
          </div>
          <p className="text-[11px] text-white/60">
            &copy; {new Date().getFullYear()} PT BPR Adiartha Utama. Seluruh Hak Cipta Dilindungi.
          </p>
        </div>
      </div>

      {/* Login Form Container (Right) */}
      <div className="lg:col-span-7 flex items-center justify-center p-6 sm:p-10 lg:p-16 bg-muted/20">
        <div className="w-full max-w-md">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
