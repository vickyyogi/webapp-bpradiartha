import { Users, CreditCard, ArrowUpRight, Clock, ShieldCheck } from "lucide-react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard Operasional",
};

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Header ala referensi: eyebrow + judul + pil status */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2 w-2 rounded-full bg-lp-accent" />
            <span className="lp-eyebrow text-lp-brand">Ringkasan Sistem</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-lp-text">
            Dashboard Operasional
          </h1>
          <p className="text-xs sm:text-sm text-lp-muted mt-1">
            Selamat datang di portal pengelolaan dan operasional PT BPR Adiartha Utama.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-lp-accent px-3.5 py-1.5 text-xs font-semibold text-lp-on-accent shadow-[0_10px_22px_-12px_var(--lp-glow-lime)]">
            <ShieldCheck className="h-3.5 w-3.5" />
            Sistem Perbankan Aktif
          </span>
        </div>
      </div>

      {/* Kartu KPI ala referensi: label + kotak ikon + angka besar + delta */}
      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-2xl border border-lp-border bg-lp-card p-5 transition-colors hover:border-lp-brand/40">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-lp-muted">
                Total Prospek Baru
              </p>
              <p className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight text-lp-text">
                12
              </p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-lp-border bg-lp-card-2 text-lp-brand">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs">
            <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center">
              <ArrowUpRight className="h-3 w-3 mr-0.5" /> +2
            </span>
            <span className="text-lp-muted">dari hari kemarin</span>
          </div>
        </div>

        <div className="rounded-2xl border border-lp-border bg-lp-card p-5 transition-colors hover:border-lp-brand/40">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-lp-muted">
                Aplikasi Kredit Aktif
              </p>
              <p className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight text-lp-text">
                5
              </p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-lp-border bg-lp-card-2 text-lp-brand">
              <CreditCard className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-lp-muted">
            <Clock className="h-3 w-3 text-lp-brand" />
            <span className="font-medium text-lp-brand">Menunggu review AO &amp; Komite</span>
          </div>
        </div>
      </div>
    </div>
  );
}
