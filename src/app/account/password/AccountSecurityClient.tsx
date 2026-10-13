"use client";

import { useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordPolicyChecklist } from "@/components/account/PasswordPolicyChecklist";

/**
 * Keamanan akun (Tahap 1B-3): ganti kata sandi sendiri + keluar dari semua perangkat.
 *
 * Kedua tindakan mencabut sesi yang sedang dipakai (sandi baru menggugurkan semua
 * sesi; "keluar dari semua perangkat" juga), jadi setelah berhasil pengguna
 * diarahkan keluar dan diminta masuk kembali.
 */
export function AccountSecurityClient({
  mustChangePassword,
  email,
}: {
  mustChangePassword: boolean;
  email: string;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [ulangi, setUlangi] = useState("");
  const [galat, setGalat] = useState("");
  const [pesan, setPesan] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingSemua, setLoadingSemua] = useState(false);
  const [selesai, setSelesai] = useState(false);

  const keluar = async () => {
    await signOut({ redirect: false }).catch(() => undefined);
  };

  const simpanSandi = async (e: React.FormEvent) => {
    e.preventDefault();
    setGalat("");
    setPesan("");

    if (newPassword !== ulangi) {
      setGalat("Kedua kata sandi baru tidak sama.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = (await res.json().catch(() => ({}))) as { status?: string; message?: string };

      if (!res.ok) {
        setGalat(data.message ?? "Gagal mengganti kata sandi.");
        return;
      }

      setPesan(data.message ?? "Kata sandi berhasil diganti.");
      setSelesai(true);
      setCurrentPassword("");
      setNewPassword("");
      setUlangi("");
      await keluar();
    } catch {
      setGalat("Tidak dapat menghubungi server. Coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  const akhiriSemuaSesi = async () => {
    setGalat("");
    setPesan("");
    setLoadingSemua(true);
    try {
      const res = await fetch("/api/account/logout-all", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { status?: string; message?: string };

      if (!res.ok) {
        setGalat(data.message ?? "Gagal mengakhiri sesi di perangkat lain.");
        return;
      }

      setPesan(data.message ?? "Semua sesi di seluruh perangkat telah diakhiri.");
      setSelesai(true);
      await keluar();
    } catch {
      setGalat("Tidak dapat menghubungi server. Coba lagi.");
    } finally {
      setLoadingSemua(false);
    }
  };

  if (selesai && pesan) {
    return (
      <Card className="border border-border bg-card shadow-sm">
        <CardHeader className="space-y-1.5 pb-6">
          <CardTitle className="text-xl font-extrabold text-foreground tracking-tight">Selesai</CardTitle>
          <CardDescription className="text-xs text-muted-foreground">{pesan}</CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/login"
            className="block w-full text-center rounded-md bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Masuk Kembali
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {mustChangePassword && (
        <div className="p-3 text-xs text-primary bg-primary-soft border border-primary/20 rounded-lg font-medium">
          Kata sandi akun ini tidak memenuhi kebijakan keamanan yang berlaku. Ganti kata sandi Anda sekarang; sebelum
          itu, menu dan fitur aplikasi tidak dapat dipakai.
        </div>
      )}

      <Card className="border border-border bg-card shadow-sm">
        <CardHeader className="space-y-1.5 pb-6">
          <CardTitle className="text-xl font-extrabold text-foreground tracking-tight">Ganti Kata Sandi</CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Sandi baru berlaku seketika dan seluruh sesi login lama diputus.
          </CardDescription>
        </CardHeader>
        <form onSubmit={simpanSandi}>
          <CardContent className="space-y-4">
            {galat && (
              <div className="p-3 text-xs text-primary bg-primary-soft border border-primary/20 rounded-lg font-medium">
                {galat}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="current-password" className="text-xs font-semibold text-foreground">
                Kata Sandi Saat Ini
              </Label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="h-10 bg-background border-border focus-visible:border-primary focus-visible:ring-primary/20"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-password" className="text-xs font-semibold text-foreground">
                Kata Sandi Baru
              </Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="h-10 bg-background border-border focus-visible:border-primary focus-visible:ring-primary/20"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ulangi-password" className="text-xs font-semibold text-foreground">
                Ulangi Kata Sandi Baru
              </Label>
              <Input
                id="ulangi-password"
                type="password"
                autoComplete="new-password"
                value={ulangi}
                onChange={(e) => setUlangi(e.target.value)}
                className="h-10 bg-background border-border focus-visible:border-primary focus-visible:ring-primary/20"
                required
              />
            </div>
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <p className="text-[11px] font-semibold text-foreground mb-2">Kebijakan kata sandi</p>
              <PasswordPolicyChecklist sandi={newPassword} />
              <p className="text-[10px] text-muted-foreground mt-2">
                Kata sandi tidak boleh memuat bagian email Anda ({email.split("@")[0]}).
              </p>
            </div>
          </CardContent>
          <CardFooter className="pt-2 pb-6">
            <Button type="submit" size="lg" className="w-full font-semibold shadow-xs" disabled={loading}>
              {loading ? "Menyimpan..." : "Simpan Kata Sandi Baru"}
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card className="border border-border bg-card shadow-sm">
        <CardHeader className="space-y-1.5 pb-4">
          <CardTitle className="text-base font-bold text-foreground tracking-tight">Keluar dari Semua Perangkat</CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Mengakhiri seluruh sesi login akun ini di semua perangkat, termasuk sesi yang sedang Anda pakai. Kata sandi
            tidak berubah. Gunakan bila Anda pernah masuk dari komputer/telepon yang bukan milik Anda.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <Button
            type="button"
            variant="outline"
            onClick={akhiriSemuaSesi}
            disabled={loadingSemua}
            className="w-full font-semibold"
          >
            {loadingSemua ? "Mengakhiri sesi..." : "Keluarkan Semua Sesi"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
