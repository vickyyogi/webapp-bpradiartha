/**
 * Aturan kebijakan kata sandi untuk tampilan (Tahap 1B-3).
 *
 * Dipisahkan dari komponen React supaya dapat dipakai bersama:
 * - komponen daftar-periksa (src/components/account/PasswordPolicyChecklist.tsx), dan
 * - skrip verifikasi berbasis ts-node (scripts/verify-account-security.ts).
 *
 * Ini hanya cermin untuk membantu pengguna. Pemeriksaan yang SAH tetap di server:
 * src/lib/password.ts → validatePasswordPolicy (termasuk daftar sandi lemah/default
 * yang sengaja tidak ikut dikirim ke peramban).
 */
export const MIN_PANJANG_SANDI = 10;

export interface AturanSandi {
  label: string;
  lulus: boolean;
}

export function periksaAturanSandi(sandi: string): AturanSandi[] {
  return [
    { label: `Minimal ${MIN_PANJANG_SANDI} karakter`, lulus: sandi.length >= MIN_PANJANG_SANDI },
    { label: "Memuat huruf dan angka", lulus: /[A-Za-z]/.test(sandi) && /[0-9]/.test(sandi) },
    { label: "Tidak terlalu mudah ditebak (variasi karakter cukup)", lulus: new Set(sandi).size >= 4 },
  ];
}
