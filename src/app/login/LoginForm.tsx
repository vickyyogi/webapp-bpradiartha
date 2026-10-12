"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Formulir login dua langkah (Tahap 1B).
 *
 * Langkah 1: email + kata sandi dikirim ke /api/auth/prelogin. Rute itu yang
 * memverifikasi sandi (termasuk aturan penguncian) dan menentukan apakah akun
 * memakai MFA.
 * Langkah 2: hanya bila MFA aktif — kode TOTP enam digit atau satu kode cadangan.
 */
export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const finishLogin = () => {
    router.push("/dashboard");
    router.refresh();
  };

  const goToStep2 = (token: string) => {
    setChallengeToken(token);
    setPassword("");
    setCode("");
    setError("");
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!challengeToken) {
      // Langkah 1 — verifikasi sandi.
      try {
        const res = await fetch("/api/auth/prelogin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        const data = (await res.json().catch(() => ({}))) as { status?: string; challengeToken?: string };

        if (data.status === "mfa" && data.challengeToken) {
          goToStep2(data.challengeToken);
          return;
        }

        if (data.status !== "ok") {
          setError(
            res.status === 429
              ? "Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi."
              : "Email atau kata sandi tidak valid."
          );
          setLoading(false);
          return;
        }
      } catch {
        setError("Tidak dapat menghubungi server. Coba lagi.");
        setLoading(false);
        return;
      }

      // Sandi benar dan akun tidak memakai MFA → buat sesi seperti biasa.
      const res = await signIn("credentials", { email, password, redirect: false });

      if (res?.error) {
        setError("Email atau kata sandi tidak valid.");
        setLoading(false);
        return;
      }

      finishLogin();
      return;
    }

    // Langkah 2 — kode MFA.
    const res = await signIn("mfa", { challengeToken, code, redirect: false });

    if (res?.error) {
      setError("Kode MFA tidak sah atau sudah kedaluwarsa. Periksa jam perangkat Anda, lalu coba lagi.");
      setCode("");
      setLoading(false);
      return;
    }

    finishLogin();
  };

  return (
    <Card className="border border-border bg-card shadow-sm">
      <CardHeader className="space-y-1.5 pb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="h-2 w-2 rounded-full bg-primary" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-gold-dark">Autentikasi Internal</span>
        </div>
        <CardTitle className="text-2xl font-extrabold text-foreground tracking-tight">
          {challengeToken ? "Verifikasi Dua Faktor" : "Masuk ke Akun Staf"}
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          {challengeToken
            ? "Masukkan kode 6 digit dari aplikasi authenticator, atau satu kode cadangan Anda"
            : "Masukkan alamat email dan kata sandi operasional Anda"}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 text-xs text-primary bg-primary-soft border border-primary/20 rounded-lg flex items-center gap-2 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {challengeToken ? (
            <div className="space-y-1.5">
              <Label htmlFor="mfa-code" className="text-xs font-semibold text-foreground">
                Kode MFA / Kode Cadangan
              </Label>
              <Input
                id="mfa-code"
                type="text"
                inputMode="text"
                autoComplete="one-time-code"
                autoFocus
                placeholder="123456 atau ABCDE-23456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="h-10 bg-background border-border text-center text-lg font-semibold tracking-[0.2em] focus-visible:border-primary focus-visible:ring-primary/20"
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Kode berlaku 30 detik dan hanya bisa dipakai sekali.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold text-foreground">Email Resmi Pegawai</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="nama@bpradiartha.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-10 bg-background border-border focus-visible:border-primary focus-visible:ring-primary/20"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-semibold text-foreground">Kata Sandi</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-10 bg-background border-border focus-visible:border-primary focus-visible:ring-primary/20"
                  required
                />
              </div>
            </>
          )}
        </CardContent>
        <CardFooter className="pt-2 pb-6 flex-col gap-3">
          <Button type="submit" size="lg" className="w-full font-semibold shadow-xs gap-2" disabled={loading}>
            {loading
              ? "Memproses Autentikasi..."
              : challengeToken
                ? "Verifikasi & Masuk"
                : "Masuk ke Sistem"}
          </Button>
          {challengeToken && (
            <button
              type="button"
              onClick={() => {
                setChallengeToken(null);
                setCode("");
                setError("");
              }}
              className="text-[11px] font-medium text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              Kembali ke langkah pertama
            </button>
          )}
        </CardFooter>
      </form>
    </Card>
  );
}
