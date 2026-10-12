"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

interface MfaStatus {
  enabled: boolean;
  enrolledAt: string | null;
  backupCodesRemaining: number;
}

/**
 * Pendaftaran MFA (Tahap 1B).
 *
 * Alur: minta rahasia + QR → pindai dengan aplikasi authenticator → masukkan satu
 * kode untuk membuktikan perangkat sudah benar → kode cadangan ditampilkan SEKALI.
 */
export function MfaSetupClientView({ userEmail }: { userEmail: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // versiStatus dipakai untuk memuat ulang status setelah pendaftaran selesai,
  // tanpa memanggil setState langsung di dalam efek.
  const [versiStatus, setVersiStatus] = useState(0);

  useEffect(() => {
    let aktif = true;

    (async () => {
      const res = await fetch("/api/mfa/status");
      if (!aktif) return;

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      const data = (await res.json().catch(() => ({}))) as MfaStatus;
      if (aktif) setStatus(data);
    })();

    return () => {
      aktif = false;
    };
  }, [router, versiStatus]);

  const mulaiPendaftaran = async () => {
    setBusy(true);
    setError("");
    setBackupCodes(null);

    const res = await fetch("/api/mfa/setup", { method: "POST" });
    const data = (await res.json().catch(() => ({}))) as { qrDataUrl?: string; secret?: string; error?: string };

    if (!res.ok) {
      setError(data.error ?? "Gagal memulai pendaftaran MFA.");
      setBusy(false);
      return;
    }

    setQrDataUrl(data.qrDataUrl ?? "");
    setSecret(data.secret ?? "");
    setBusy(false);
  };

  const konfirmasi = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");

    const res = await fetch("/api/mfa/setup/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = (await res.json().catch(() => ({}))) as { backupCodes?: string[]; error?: string };

    if (!res.ok) {
      setError(data.error ?? "Kode tidak cocok.");
      setCode("");
      setBusy(false);
      return;
    }

    setBackupCodes(data.backupCodes ?? []);
    setQrDataUrl("");
    setSecret("");
    setCode("");
    setBusy(false);
    setVersiStatus((versi) => versi + 1);
  };

  const unduhKodeCadangan = () => {
    if (!backupCodes) return;
    const isi = [
      "KODE CADANGAN MFA — BPR Adiartha Reksacitra",
      `Akun: ${userEmail}`,
      "Setiap kode hanya bisa dipakai sekali. Simpan di tempat aman dan jangan dibagikan.",
      "",
      ...backupCodes,
    ].join("\n");

    const url = URL.createObjectURL(new Blob([isi], { type: "text/plain" }));
    const tautan = document.createElement("a");
    tautan.href = url;
    tautan.download = "kode-cadangan-mfa.txt";
    tautan.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="w-full max-w-lg border border-border bg-card shadow-sm">
      <CardHeader className="space-y-1.5 pb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="h-2 w-2 rounded-full bg-primary" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-gold-dark">
            Keamanan Akun
          </span>
        </div>
        <CardTitle className="text-2xl font-extrabold text-foreground tracking-tight">
          Autentikasi Dua Faktor
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          Akun <span className="font-semibold text-foreground">{userEmail}</span> — peran admin wajib memakai
          autentikasi dua faktor sebelum dapat memakai sistem.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 text-xs text-primary bg-primary-soft border border-primary/20 rounded-lg flex items-center gap-2 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {backupCodes && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-foreground">
              MFA aktif. Simpan kode cadangan berikut — hanya ditampilkan sekali:
            </p>
            <div className="grid grid-cols-2 gap-2 font-mono text-sm">
              {backupCodes.map((kode) => (
                <span key={kode} className="rounded-md border border-border bg-background px-2 py-1 text-center">
                  {kode}
                </span>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Setiap kode hanya bisa dipakai sekali, misalnya bila ponsel Anda hilang. Perlakukan seperti kata sandi.
            </p>
          </div>
        )}

        {!backupCodes && status?.enabled && (
          <div className="rounded-lg border border-border bg-background p-3 text-xs space-y-1">
            <p className="font-semibold text-foreground">MFA sudah aktif pada akun ini.</p>
            <p className="text-muted-foreground">
              Terdaftar: {status.enrolledAt ? new Date(status.enrolledAt).toLocaleString("id-ID") : "-"} · kode cadangan
              tersisa: {status.backupCodesRemaining}
            </p>
          </div>
        )}

        {!backupCodes && !status?.enabled && !qrDataUrl && (
          <p className="text-xs text-muted-foreground">
            Anda akan memindai kode QR dengan aplikasi authenticator (Google Authenticator, Microsoft Authenticator,
            Authy, atau sejenisnya), lalu memasukkan satu kode untuk memastikan perangkat sudah benar.
          </p>
        )}

        {qrDataUrl && (
          <div className="space-y-3">
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="Kode QR pendaftaran MFA" className="h-60 w-60 rounded-lg border border-border" />
            </div>
            <div className="space-y-1 text-center">
              <p className="text-[11px] text-muted-foreground">Tidak bisa memindai? Masukkan kode ini secara manual:</p>
              <p className="font-mono text-xs break-all text-foreground">{secret}</p>
            </div>
            <form onSubmit={konfirmasi} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="kode" className="text-xs font-semibold text-foreground">
                  Kode 6 digit dari aplikasi authenticator
                </Label>
                <Input
                  id="kode"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  className="h-10 text-center text-lg tracking-[0.3em] font-semibold"
                  required
                />
              </div>
              <Button type="submit" className="w-full font-semibold" disabled={busy}>
                {busy ? "Memeriksa..." : "Aktifkan MFA"}
              </Button>
            </form>
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-2 pb-6 flex-col gap-2">
        {!backupCodes && !status?.enabled && !qrDataUrl && (
          <Button onClick={mulaiPendaftaran} className="w-full font-semibold" disabled={busy}>
            {busy ? "Menyiapkan..." : "Mulai Pendaftaran MFA"}
          </Button>
        )}
        {backupCodes && (
          <>
            <Button onClick={unduhKodeCadangan} variant="outline" className="w-full font-semibold">
              Unduh Kode Cadangan
            </Button>
            <Button onClick={() => router.push("/dashboard")} className="w-full font-semibold">
              Selesai — Masuk ke Dasbor
            </Button>
          </>
        )}
        {!backupCodes && status?.enabled && (
          <Button onClick={() => router.push("/dashboard")} className="w-full font-semibold">
            Kembali ke Dasbor
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
