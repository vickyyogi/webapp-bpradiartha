# Laporan Sesi Coding Agent — Tahap 1B-2 (P0.1 reset kata sandi mandiri lewat email)

- **Tahap aktif:** Tahap 1 — P0.1, sub-tahap **1B-2**.
- **Status:** DONE untuk ruang lingkup 1B-2, **dengan satu catatan penting**: jalur SMTP sungguhan belum pernah dijalankan karena kredensialnya belum ada. Seluruh alur diuji menyeluruh memakai transport email uji (`MAIL_TRANSPORT=file`), yaitu jalur kode yang sama kecuali langkah terakhir `transporter.sendMail`.
- **Tujuan sesi:** pengguna dapat memulihkan akses sendiri lewat tautan email, tanpa bantuan operator, tanpa membocorkan daftar akun.
- **Tanggal:** 2026-10-13

## 1. Temuan yang diverifikasi sebelum perubahan

| Temuan | Bukti | Keadaan sebelum |
|---|---|---|
| Tidak ada alur lupa sandi sama sekali | pencarian `lupa.?sandi\|forgot\|reset.?password` di `src` = 0 hasil | TERVERIFIKASI |
| Tidak ada infrastruktur email | `nodemailer\|smtp\|sendmail` = 0 hasil di `src` dan `package.json` | TERVERIFIKASI |
| Pemulihan hanya lewat operator | hanya `scripts/set-password.ts` (akses server) | TERVERIFIKASI |
| **Middleware sekarang bernama `src/proxy.ts`** (Next 16 mengganti `middleware.ts`) dan memblokir semua rute kecuali daftar putih | `src/proxy.ts:8-21` | TERVERIFIKASI — dan inilah yang menggagalkan uji pertama |

## 2. Perubahan

Berkas baru:
- `src/lib/secure-token.ts` — token acak 32 byte + hash sha256, pencocokan waktu-tetap, masa berlaku. Dipakai ulang oleh alur reset.
- `src/lib/mailer.ts` — dua transport: `smtp` (produksi, via nodemailer) dan `file` (uji/non-produksi, menulis isi surat ke berkas). Transport `file` **ditolak tegas saat `NODE_ENV=production`**. Pengiriman tidak pernah melempar; kegagalan dikembalikan sebagai hasil.
- `src/lib/password-reset.ts` — inti alur: pembuatan tautan, pemeriksaan, pemakaian, pembatas, pencatatan audit, email pemberitahuan.
- `src/app/api/auth/forgot-password/route.ts` — permintaan tautan; jawaban SELALU seragam dan waktu tanggapnya disamakan (minimal 700 ms) agar ada/tidaknya akun tidak terbaca.
- `src/app/api/auth/reset-password/route.ts` — `GET` memeriksa keabsahan tautan (email disamarkan), `POST` menetapkan sandi baru.
- `src/app/forgot-password/{page.tsx,ForgotPasswordForm.tsx}` dan `src/app/reset-password/{page.tsx,ResetPasswordForm.tsx}` — halaman publik. Keabsahan tautan diperiksa **di server** saat halaman dirender, jadi tidak ada permintaan klien tambahan dan tidak perlu efek di sisi React.
- `scripts/verify-password-reset.ts` (45 pemeriksaan) dan `scripts/verify-password-reset-live.ts` (32 pemeriksaan HTTP).

Berkas diubah:
- `prisma/schema.prisma` — model `PasswordResetToken` (hanya `tokenHash` unik, `expiresAt`, `usedAt`, `attempts`, `requestedIp`) + relasi di `User`.
- `src/proxy.ts` — **perbaikan bug**: `/forgot-password` dan `/reset-password` ditambahkan ke daftar rute publik. Tanpa ini, pengguna yang belum login (justru satu-satunya orang yang memakai halaman tersebut) dialihkan ke `/login`.
- `src/app/login/LoginForm.tsx` — tautan "Lupa kata sandi?" pada langkah pertama.
- `package.json` — script `verify:reset`, `verify:reset:live`; dependensi `nodemailer@10` (+ `@types/nodemailer`).

## 3. Migrasi

- `prisma/migrations/20261013013325_tahap_1b2_reset_kata_sandi/migration.sql` — tabel `password_reset_tokens`.
- Hasil: `prisma migrate status` → skema basis data selaras. Tidak ada perubahan destruktif, tidak ada reset database.

## 4. Pengujian

| Perintah | Hasil aktual |
|---|---|
| `npm run verify:reset` | **45/45 lulus** — token 64 heksadesimal; hash tersimpan bukan nilai asli; `MAIL_TRANSPORT=file` ditolak di produksi; SMTP tanpa `MAIL_FROM` ditolak tanpa melempar; email tak terdaftar/akun nonaktif tidak dibuatkan tautan; tautan 30 menit; tautan lama hangus saat tautan baru diminta; tautan kedaluwarsa/terpakai/diblokir ditolak; sandi lemah ditolak **tanpa** mengubah hash lama; sandi baru tidak boleh sama dengan sandi lama; sukses → hash bcrypt baru, `passwordChangedAt` diperbarui, kunci akun dibuka; tautan tidak dapat dipakai dua kali; 3 permintaan/jam per akun, permintaan ke-4 ditolak; tautan dihanguskan bila email gagal terkirim; audit memuat peristiwanya **tanpa** token/sandi. |
| `npm run verify:reset:live` (server dev + `MAIL_*` uji) | **32/32 lulus** — jawaban email terdaftar dan tidak terdaftar **identik**, keduanya ≥650 ms; surat uji memuat tautan; API mengenali tautan sah dan menyamarkan email; tautan palsu ditolak (API dan halaman); halaman reset tampil untuk tautan sah dan menolak tautan palsu; halaman login memuat tautan lupa sandi; halaman lupa sandi dapat dibuka **tanpa sesi**; sandi lemah/sama ditolak; sandi baru tersimpan; tautan tidak bisa dipakai dua kali (410); **sesi lama dicabut** setelah reset; sandi lama tidak berlaku, sandi baru berlaku; email pemberitahuan terkirim; audit bersih dari token/sandi; batas per IP (permintaan ke-6 → 429) dan per akun (maksimal 3 tautan hidup). |
| Regresi 1A & 1B-1 | `npm run verify:auth` **38/38**, `npm run verify:mfa` **57/57** — tidak ada regresi setelah perubahan `LoginForm.tsx` dan `proxy.ts`. |
| `npx eslint --quiet` berkas 1B-2 | **0 error**. |
| `npx tsc --noEmit` | **113** — sama dengan baseline; dua error baru yang sempat muncul (penulisan `process.env.NODE_ENV` di skrip uji) sudah diperbaiki. |
| `npm run build` | Sukses; rute `/forgot-password`, `/reset-password`, `/api/auth/forgot-password`, `/api/auth/reset-password` terdaftar. |

**Cacat nyata yang ditemukan uji ini:** uji live pertama gagal 3 pemeriksaan karena `/reset-password` mengembalikan 307 ke `/login`. Penyebabnya `src/proxy.ts` (middleware Next 16) yang memblokir semua rute kecuali daftar putih, dan halaman publik baru tidak masuk daftar itu. Ini akan membuat fitur pemulihan **tidak dapat dipakai sama sekali** oleh pengguna yang lupa sandi. Sudah diperbaiki dan diverifikasi ulang.

## 5. Risiko / keputusan yang masih menunggu

1. **Jalur SMTP belum diuji dengan surat sungguhan.** Yang perlu Anda isi di `.env`:
   ```
   SMTP_HOST=...
   SMTP_PORT=587            # 465 otomatis memakai TLS implisit
   SMTP_USER=...
   SMTP_PASS=...
   MAIL_FROM="BPR Adiartha Reksacitra <no-reply@bpradiartha.co.id>"
   ```
   Setelah itu: `npm run verify:reset:live` (uji tanpa transport file) dan satu percobaan nyata dari halaman `/forgot-password`. Tanpa konfigurasi ini, aplikasi tidak akan mengirim apa pun dan **hanya mencatat peringatan di log server**; jawaban ke pengguna tetap seragam (tidak membocorkan apa pun).
2. **Kotak surat uji (`MAIL_TRANSPORT=file`) menulis isi surat — termasuk tautan reset — ke berkas di `MAIL_OUTBOX_DIR`.** Aman untuk pengembangan, dan sudah diblokir di produksi. Jangan diaktifkan di server bank.
3. **Tautan reset berisi token mentah** (di URL email). Ini praktik lazim, tetapi konsekuensinya: log proxy/aplikasi atau berkas akses yang menyimpan URL penuh bisa memuat token. Sudah ditekan sedapat mungkin (hanya hash di database, sekali pakai, 30 menit), namun pembersihan log HTTP dari query `token=` perlu dipertimbangkan pada tahap infrastruktur.
4. **Kuota email** bergantung pada penyedia SMTP. Batas internal: 5 permintaan/15 menit per IP, 3 tautan/jam per akun.
5. Kerentanan `next@16.3.6` dan `.env.example` yang diabaikan git masih menunggu keputusan Anda (temuan yang sama seperti laporan 1B-1).

## 6. Langkah berikutnya (rekomendasi saja)

- **1B-3** — kebijakan sandi di UI + wajib ganti sandi bagi akun bersandi lama yang lemah + pengerasan pencabutan sesi lintas perangkat ("keluar dari semua perangkat"). Setelah itu Tahap 1 dapat ditandai DONE dan Tahap 2 (pemisahan master nasabah) dimulai.
- Setelah kredensial SMTP ada: jalankan `npm run verify:reset:live` tanpa transport file untuk membuktikan pengiriman sungguhan.

## Status untuk sesi berikutnya

- 1B-2 terpasang dan terverifikasi (45 + 32 pemeriksaan baru). Skema selaras, satu migrasi baru, tidak ada data hilang.
- Uji ulang: `npm run verify:reset` (tanpa server), `npm run verify:reset:live` (butuh server + `MAIL_TRANSPORT=file`, `MAIL_OUTBOX_DIR`, `AUTH_SESSION_REVALIDATE_SECONDS=1`), plus `npm run verify:auth`, `npm run verify:mfa`.
- **Jangan lupa**: `src/proxy.ts` adalah daftar putih rute publik. Setiap halaman publik baru (termasuk halaman 1B-3 seperti ganti sandi wajib) harus ditambahkan di sana, atau pengguna akan dialihkan ke `/login`.
