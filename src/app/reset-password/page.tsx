import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, ArrowLeft, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RESET_TOKEN_MESSAGES, loadResetToken } from "@/lib/password-reset";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = {
  title: "Atur Ulang Kata Sandi",
  description: "Menetapkan kata sandi baru akun staf PT BPR Adiartha Utama melalui tautan email.",
  robots: { index: false, follow: false },
};

/**
 * Halaman pemakaian tautan reset (Tahap 1B-2).
 *
 * Keabsahan tautan diperiksa di server (bukan di peramban) supaya pemeriksaannya
 * memakai aturan yang sama dengan API dan tidak ada permintaan tambahan dari klien.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const state = await loadResetToken(token);
  const sah = state.status === "ok" && Boolean(state.context);

  const emailMasked = state.context
    ? (() => {
        const [lokal, domain] = state.context.email.split("@");
        return `${lokal.slice(0, 2)}${"*".repeat(Math.max(3, lokal.length - 2))}@${domain ?? ""}`;
      })()
    : null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6 bg-muted/20">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 px-3 py-1 rounded-full text-[11px] font-medium text-primary">
            <ShieldCheck className="h-3.5 w-3.5" />
            Keamanan Akun
          </div>
          <h1 className="text-lg font-extrabold tracking-tight text-foreground">PT BPR Adiartha Utama</h1>
        </div>

        {sah && token ? (
          <ResetPasswordForm token={token} emailMasked={emailMasked} />
        ) : (
          <Card className="border border-border bg-card shadow-sm">
            <CardHeader className="space-y-1.5 pb-6">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-primary" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-gold-dark">Tautan Tidak Dapat Dipakai</span>
              </div>
              <CardTitle className="text-xl font-extrabold text-foreground tracking-tight">
                {RESET_TOKEN_MESSAGES[state.status]}
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Demi keamanan, tautan reset hanya berlaku 30 menit dan sekali pakai. Minta tautan baru melalui halaman
                Lupa Kata Sandi.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link
                href="/forgot-password"
                className="block w-full text-center rounded-md bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                Minta Tautan Baru
              </Link>
              <Link
                href="/login"
                className="block w-full text-center text-[11px] font-medium text-muted-foreground hover:text-foreground underline underline-offset-2"
              >
                Kembali ke halaman masuk
              </Link>
            </CardContent>
          </Card>
        )}

        <div className="text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Beranda
          </Link>
        </div>
      </div>
    </div>
  );
}
