"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Penetapan kata sandi baru (Tahap 1B-2).
 *
 * Keabsahan tautan sudah diperiksa di server saat halaman dirender; formulir ini
 * hanya mengirim token + kata sandi baru ke API.
 */
export function ResetPasswordForm({ token, emailMasked }: { token: string; emailMasked: string | null }) {
  const [password, setPassword] = useState("");
  const [ulangi, setUlangi] = useState("");
  const [pesan, setPesan] = useState("");
  const [galat, setGalat] = useState("");
  const [selesai, setSelesai] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGalat("");
    setPesan("");

    if (password !== ulangi) {
      setGalat("Kedua kata sandi tidak sama.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = (await res.json().catch(() => ({}))) as { status?: string; message?: string };

      if (!res.ok) {
        setGalat(data.message ?? "Gagal menetapkan kata sandi baru. Minta tautan baru bila perlu.");
        if (res.status === 410) setSelesai(true);
        return;
      }

      setPesan(data.message ?? "Kata sandi berhasil diperbarui.");
      setSelesai(true);
      setPassword("");
      setUlangi("");
    } catch {
      setGalat("Tidak dapat menghubungi server. Coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  if (selesai && pesan) {
    return (
      <Card className="border border-border bg-card shadow-sm">
        <CardHeader className="space-y-1.5 pb-6">
          <CardTitle className="text-xl font-extrabold text-foreground tracking-tight">Kata Sandi Diperbarui</CardTitle>
          <CardDescription className="text-xs text-muted-foreground">{pesan}</CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/login"
            className="block w-full text-center rounded-md bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Masuk ke Sistem
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-border bg-card shadow-sm">
      <CardHeader className="space-y-1.5 pb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="h-2 w-2 rounded-full bg-primary" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-gold-dark">Pemulihan Akun</span>
        </div>
        <CardTitle className="text-2xl font-extrabold text-foreground tracking-tight">Atur Ulang Kata Sandi</CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          {emailMasked ? `Menetapkan kata sandi baru untuk akun ${emailMasked}` : "Menetapkan kata sandi baru akun Anda"}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {galat && (
            <div className="p-3 text-xs text-primary bg-primary-soft border border-primary/20 rounded-lg font-medium">
              {galat}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs font-semibold text-foreground">
              Kata Sandi Baru
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10 bg-background border-border focus-visible:border-primary focus-visible:ring-primary/20"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ulangi" className="text-xs font-semibold text-foreground">
              Ulangi Kata Sandi Baru
            </Label>
            <Input
              id="ulangi"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••••"
              value={ulangi}
              onChange={(e) => setUlangi(e.target.value)}
              className="h-10 bg-background border-border focus-visible:border-primary focus-visible:ring-primary/20"
              required
            />
          </div>
          <ul className="text-[11px] text-muted-foreground space-y-0.5 list-disc pl-4">
            <li>Minimal 10 karakter, memuat huruf dan angka.</li>
            <li>Bukan kata sandi umum/default, dan tidak memuat nama pengguna/email Anda.</li>
            <li>Setelah tersimpan, semua sesi login lama diputus.</li>
          </ul>
        </CardContent>
        <CardFooter className="pt-2 pb-6 flex-col gap-3">
          <Button type="submit" size="lg" className="w-full font-semibold shadow-xs" disabled={loading}>
            {loading ? "Menyimpan..." : "Simpan Kata Sandi Baru"}
          </Button>
          <Link
            href="/login"
            className="text-[11px] font-medium text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            Kembali ke halaman masuk
          </Link>
        </CardFooter>
      </form>
    </Card>
  );
}
