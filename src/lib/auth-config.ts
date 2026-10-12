/**
 * Konfigurasi sesi & autentikasi — Tahap 1A (P0.1).
 * Nilai sengaja dikumpulkan di satu tempat agar mudah ditinjau dan diuji.
 */

/** Masa berlaku sesi: 8 jam (satu shift kerja). Sebelumnya memakai bawaan NextAuth 30 hari. */
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

/** Sesi aktif diperpanjang setiap 1 jam pemakaian. */
export const SESSION_UPDATE_AGE_SECONDS = 60 * 60;

/**
 * Selang pemeriksaan ulang ke database: akun dinonaktifkan atau sandinya diganti
 * akan kehilangan sesi paling lambat dalam waktu ini.
 * Dapat diturunkan lewat variabel lingkungan untuk keperluan pengujian otomatis;
 * nilai bawaan (300 detik) yang berlaku di produksi.
 */
const parsedRevalidate = Number.parseInt(process.env.AUTH_SESSION_REVALIDATE_SECONDS?.trim() || "300", 10);

export const SESSION_REVALIDATE_AFTER_SECONDS =
  Number.isFinite(parsedRevalidate) && parsedRevalidate > 0 ? parsedRevalidate : 300;

/** Variabel lingkungan untuk sandi awal admin saat seed (tidak boleh hard-coded). */
export const SEED_ADMIN_PASSWORD_ENV = "SEED_ADMIN_PASSWORD";
