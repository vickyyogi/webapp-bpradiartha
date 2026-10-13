"use client";

import { periksaAturanSandi } from "@/lib/password-policy-rules";

/**
 * Daftar periksa kebijakan kata sandi (Tahap 1B-3).
 *
 * Aturannya ada di src/lib/password-policy-rules.ts agar dapat diuji skrip
 * verifikasi. Pemeriksaan yang SAH tetap dilakukan server (src/lib/password.ts),
 * termasuk daftar sandi lemah/default yang sengaja tidak dibundel ke peramban.
 */

export function PasswordPolicyChecklist({ sandi }: { sandi: string }) {
  const aturan = periksaAturanSandi(sandi);

  return (
    <ul className="text-[11px] text-muted-foreground space-y-1">
      {aturan.map((a) => (
        <li key={a.label} className="flex items-start gap-1.5">
          <span
            className={`mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border text-[9px] font-bold flex items-center justify-center ${
              a.lulus
                ? "bg-primary/15 border-primary/40 text-primary"
                : "bg-muted border-border text-muted-foreground"
            }`}
            aria-hidden
          >
            {a.lulus ? "✓" : ""}
          </span>
          <span className={a.lulus ? "text-foreground" : undefined}>{a.label}</span>
        </li>
      ))}
      <li className="flex items-start gap-1.5">
        <span className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border bg-muted border-border" aria-hidden />
        <span>Tidak memuat nama pengguna/email dan bukan kata sandi umum (diperiksa server)</span>
      </li>
    </ul>
  );
}
