"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Permintaan tautan reset kata sandi (Tahap 1B-2).
 *
 * Pesan hasil selalu sama, baik email terdaftar maupun tidak, supaya halaman ini
 * tidak menjadi alat untuk menebak siapa saja yang punya akun.
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [pesan, setPesan] = useState("");
  const [galat, setGalat] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setGalat("");
    setPesan("");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (res.status === 429) {
        setGalat("Terlalu banyak permintaan dari jaringan ini. Tunggu beberapa menit lalu coba lagi.");
        return;
      }

      const data = (await res.json().catch(() => ({}))) as { message?: string };
      setPesan(
        data.message ??
          "Bila alamat email tersebut terdaftar sebagai akun staf, kami telah mengirimkan tautan pengaturan ulang kata sandi."
      );
    } catch {
      setGalat("Tidak dapat menghubungi server. Coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border border-border bg-card shadow-sm">
      <CardHeader className="space-y-1.5 pb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="h-2 w-2 rounded-full bg-primary" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-gold-dark">Pemulihan Akun</span>
        </div>
        <CardTitle className="text-2xl font-extrabold text-foreground tracking-tight">Lupa Kata Sandi</CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          Masukkan alamat email resmi Anda. Kami akan mengirimkan tautan untuk menetapkan kata sandi baru.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {galat && (
            <div className="p-3 text-xs text-primary bg-primary-soft border border-primary/20 rounded-lg font-medium">
              {galat}
            </div>
          )}
          {pesan && (
            <div className="p-3 text-xs text-foreground bg-muted border border-border rounded-lg font-medium">
              {pesan}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-semibold text-foreground">
              Email Resmi Pegawai
            </Label>
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
          <p className="text-[11px] text-muted-foreground">
            Tautan berlaku 30 menit dan hanya dapat dipakai satu kali. Bila email tidak diterima, hubungi administrator TI
            bank (email bisa belum terdaftar atau transport email belum aktif).
          </p>
        </CardContent>
        <CardFooter className="pt-2 pb-6 flex-col gap-3">
          <Button type="submit" size="lg" className="w-full font-semibold shadow-xs" disabled={loading}>
            {loading ? "Mengirim..." : "Kirim Tautan Reset"}
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
