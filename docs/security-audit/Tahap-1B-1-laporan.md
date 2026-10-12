# Laporan Sesi Coding Agent — Tahap 1B-1 (P0.1 MFA/TOTP wajib untuk peran ADMIN)

- **Tahap aktif:** Tahap 1 — P0.1. Dikerjakan sebagai **sub-tahap 1B-1** sesuai §D dokumen instruksi.
- **Status:** DONE untuk ruang lingkup 1B-1. Tahap 1 secara keseluruhan **belum** DONE (1B-2 dan 1B-3 belum dikerjakan).
- **Tujuan sesi:** autentikasi dua faktor berbasis TOTP yang **wajib** untuk peran ADMIN, beserta kode cadangan dan jalur pemulihan operator.
- **Keputusan pengguna yang mendasari sesi ini:** (a) lanjut ke Tahap 1B; (b) reset kata sandi memakai email/SMTP yang kredensialnya disiapkan pengguna (dikerjakan di 1B-2); (c) MFA **wajib** TOTP untuk peran ADMIN dengan kode cadangan.
- **Tanggal:** 2026-10-12

## 1. Temuan yang diverifikasi sebelum perubahan

| Temuan | Bukti | Keadaan sebelum sesi ini |
|---|---|---|
| Tidak ada autentikasi dua faktor sama sekali | 0 match `totp/otpauth/authenticator` di `src` | TERVERIFIKASI |
| Tidak ada pustaka TOTP/QR | tidak ada di `package.json` | TERVERIFIKASI |
| Sesi hanya bergantung pada satu faktor | `authorize()` mengembalikan pengguna begitu sandi benar | TERVERIFIKASI |
| Tidak ada gerbang tambahan untuk peran berisiko tertinggi | `permissions.ts` hanya memeriksa kode izin | TERVERIFIKASI |
| Tidak ada mekanisme pemulihan bila faktor kedua hilang | — | celah baru yang muncul dari pekerjaan ini; ditutup di sesi yang sama |

## 2. Perubahan

Berkas baru:
- `src/lib/mfa.ts` — aturan & kriptografi: rahasia TOTP, URI otpauth, verifikasi TOTP dengan toleransi ±1 langkah, penjaga anti-replay berbasis langkah waktu, enkripsi rahasia AES-256-GCM, pembuatan/hash kode cadangan, aturan peran wajib-MFA.
- `src/lib/mfa-service.ts` — operasi basis data: pendaftaran → konfirmasi → verifikasi → nonaktifkan; siklus hidup tantangan login (berumur 5 menit, sekali pakai, maksimal 5 percobaan).
- `src/lib/auth-login.ts` — **inti verifikasi login** yang dipakai bersama provider `credentials` dan rute baru `prelogin`, sehingga pencatatan kegagalan hanya terjadi di satu tempat.
- `src/lib/session-user.ts` — pengambil pengguna dari sesi untuk rute layanan mandiri MFA.
- `src/app/api/auth/prelogin/route.ts` — langkah pertama login; memutuskan apakah langkah kedua MFA diperlukan dan menerbitkan token tantangan.
- `src/app/api/mfa/{status,setup,setup/confirm,disable,backup-codes}/route.ts` — layanan mandiri MFA (hanya untuk akun pemilik sesi).
- `src/app/mfa/setup/{page.tsx,MfaSetupClientView.tsx}` — halaman pendaftaran (QR + kode manual + kode cadangan yang dapat diunduh), sengaja berada **di luar** grup `(dashboard)`.
- `scripts/verify-mfa.ts` (57 pemeriksaan) dan `scripts/verify-mfa-live.ts` (35 pemeriksaan HTTP).

Berkas diubah:
- `src/app/api/auth/[...nextauth]/route.ts` — memakai inti bersama; tambahan provider kedua `mfa` (tantangan + kode) sebagai satu-satunya jalur pembuatan sesi bagi akun ber-MFA.
- `src/lib/permissions.ts` — gerbang `MFA_REQUIRED` (403) untuk peran wajib-MFA yang belum mendaftar.
- `src/app/(dashboard)/layout.tsx` — pengalihan ke `/mfa/setup` untuk peran wajib-MFA yang belum mendaftar.
- `src/app/login/LoginForm.tsx` — formulir dua langkah (sandi → kode MFA/kode cadangan).
- `src/lib/audit.ts` — impor `db` dibuat relatif agar dapat dimuat `ts-node` (perubahan satu baris, tanpa efek perilaku).
- `prisma/schema.prisma` — `mfa_enabled`, `mfa_secret` (terenkripsi), `mfa_enrolled_at`, `mfa_last_time_step` pada `users`; tabel `mfa_backup_codes` dan `mfa_challenges`.
- `scripts/set-password.ts` — tambahan `--reset-mfa` (pemulihan operator bila perangkat *dan* kode cadangan hilang).
- `.env.example` — dokumentasi `MFA_REQUIRED_ROLE_CODES`, `MFA_ISSUER`, `MFA_ENCRYPTION_KEY` (semua opsional).
- `package.json` — script `verify:mfa`, `verify:mfa:live`; dependensi `otplib@13` + `qrcode@1`.

## 3. Migrasi

- `prisma/migrations/20261012072609_tahap_1b_mfa_totp/migration.sql` — empat kolom pada `users` dan dua tabel baru.
- `prisma/migrations/20261012073000_mfa_challenge_token_hash_unique/migration.sql` — `CREATE UNIQUE INDEX "mfa_challenges_token_hash_key"`. Dibuat **manual** karena `prisma migrate dev` menuntut konfirmasi interaktif untuk penambahan unique constraint; diterapkan dengan `npx prisma migrate deploy` (non-interaktif). Tabelnya masih kosong saat itu, sehingga tidak ada risiko data ganda.
- Hasil: `prisma migrate status` → **16 migrasi, "Database schema is up to date!"**. **Tidak ada reset database dan tidak ada kehilangan data.**
- Cara menjalankan di lingkungan lain: `npx prisma migrate deploy`.

## 4. Pengujian

| Perintah | Hasil aktual |
|---|---|
| `npm run verify:mfa` | **57/57 lulus** — termasuk pembanding independen: implementasi RFC 6238 ditulis ulang di skrip uji dan hasilnya **sama** dengan pustaka otplib; toleransi ±1 langkah diterima, dua langkah ditolak; replay pada langkah sama ditolak; enkripsi AES-256-GCM bolak-balik, teks tersimpan tidak memuat rahasia, data yang diubah ditolak; 10 kode cadangan unik berformat `XXXXX-XXXXX`, tidak tersimpan apa adanya, sekali pakai; tantangan sekali pakai, kedaluwarsa, dibatasi 5 percobaan; siklus pendaftaran→verifikasi→nonaktif pada database nyata. |
| `npm run verify:mfa:live` (dev server) | **36/36 lulus** — admin dapat login dengan sandi tetapi **ditolak 403 `MFA_REQUIRED`** dan **dialihkan ke `/mfa/setup`** (halaman itu sendiri terbukti dapat dibuka: HTTP 200 memuat "Autentikasi Dua Faktor"); pendaftaran menghasilkan QR; konfirmasi kode salah ditolak, kode benar menghasilkan 10 kode cadangan; gerbang terbuka; provider `credentials` **tidak** membuat sesi untuk akun ber-MFA; kode salah ditolak; kode benar membuat sesi; tantangan terpakai ditolak; kode TOTP yang sama ditolak pada login kedua dalam jendela yang sama; kode cadangan berhasil dan **tidak bisa dipakai dua kali**; setelah 5 percobaan salah kode benar pun ditolak + tercatat di audit; login berhasil lagi dengan tantangan baru; nonaktifkan MFA menuntut kode; akun non-MFA tetap dapat login seperti semula. Akun uji beserta seluruh jejaknya dihapus. |
| `npm run verify:auth` (regresi 1A) | **38/38 lulus** setelah refaktor inti login — tidak ada regresi. |
| `npm run verify:auth:live` (regresi 1A) | **20/20 lulus** — tidak ada regresi pada kunci akun, pencabutan sesi, dan jalur sandi. |
| Pemulihan operator | Diuji sungguhan pada akun uji ber-MFA: `npm run set-password -- <email> --reset-mfa` → MFA nonaktif, rahasia dihapus, kode cadangan 0. |
| `npx eslint` pada berkas 1B | **0 error** pada berkas baru/berubah. Dua error `no-explicit-any` di `src/lib/audit.ts` terbukti **sudah ada di HEAD** (`git show HEAD:src/lib/audit.ts`) dan tidak disentuh sesi ini. |
| `npx tsc --noEmit` | **113 error** — sama dengan baseline 1A, tidak ada error baru. |
| `npm run build` | Sukses (`Compiled successfully in 6.0s`); rute terdaftar: `/api/auth/prelogin`, `/api/mfa/status|setup|setup/confirm|disable|backup-codes`, `/mfa/setup`. |

Catatan proses: tiga kegagalan awal pada uji HTTP **bukan** cacat aplikasi melainkan cacat skrip uji (kode TOTP diuji ulang pada jendela 30 detik yang sudah dipakai, dan pembatas 10 percobaan/5 menit per IP ikut terhitung karena uji melakukan banyak percobaan dari satu IP). Skrip uji diperbaiki agar menunggu pergantian jendela waktu dan memakai IP uji berbeda per bagian. Satu cacat aplikasi yang **benar-benar** ditemukan oleh uji ini: penjaga anti-replay ikut berlaku saat pendaftaran sehingga admin ditolak pada login pertama setelah mendaftar — sudah diperbaiki (penjaga hanya berlaku di jalur login).

## 5. Risiko / temuan tambahan yang perlu keputusan

1. **MFA adalah wajib, jadi admin tanpa MFA tidak bisa memakai sistem** sampai mendaftar. Ini memang yang diminta, dan pendaftaran tetap dapat diakses karena halaman serta API MFA berada di luar gerbang. Konsekuensi operasional: setiap admin baru harus langsung mendaftarkan MFA.
2. **Pemulihan bila perangkat dan kode cadangan hilang:** sudah tersedia `npm run set-password -- <email> --reset-mfa` (hanya operator dengan akses server). Tanpa jalur ini, akun akan terkunci permanen — jalur ini wajib ada di runbook operasional.
3. **Kunci enkripsi rahasia TOTP** diturunkan dari `NEXTAUTH_SECRET` bila `MFA_ENCRYPTION_KEY` kosong (pilihan bawaan: tidak ada rahasia baru yang harus diisi operator). Mengganti `NEXTAUTH_SECRET` akan membuat pendaftaran MFA yang ada tidak terbaca — pengguna harus memakai kode cadangan atau `--reset-mfa`, lalu mendaftar ulang. Keputusan untuk Anda: biarkan seperti ini atau isi `MFA_ENCRYPTION_KEY` terpisah.
4. **Kerentanan dependensi (baru ditemukan sesi ini):** `npm audit` melaporkan **13 kerentanan high** yang berasal dari **Next.js 16.3.6** (6 advisory: cache poisoning SSG/ISR, SSRF pada Image Optimization, information disclosure) dan `source-map-js`. Perbaikannya memerlukan `next@16.4.0` — **di luar rentang dependensi saat ini**, jadi butuh keputusan Anda dan pengerjaan tersendiri (jangan dicampur dengan tahap keamanan lain). Tidak dikerjakan di sesi ini.
5. **Jejak izin lama:** di `(dashboard)/layout.tsx` masih ada aturan lama `roleCodes.size === 0` → dianggap system admin **untuk visibilitas menu**. Ini bukan dari sesi ini; API tetap terlindungi karena memakai kode izin, sehingga dampaknya terbatas pada tampilan. Sebaiknya dibersihkan di Tahap 2/3.
6. **Pembatas laju per IP masih di memori proses** (10 percobaan/5 menit) — pada jaringan kantor dengan satu IP publik, sekitar 10 percobaan login dari siapa pun dalam 5 menit akan menolak pengguna sah. Sudah tercatat untuk Tahap 13; belum diubah agar tidak mencampur tahap.
7. **`.env.example` diabaikan oleh git** (`.gitignore:34` memakai pola `.env*`). Akibatnya dokumentasi konfigurasi dari 1A dan 1B **tidak ikut ter-commit** dan tidak akan terlihat oleh pengembang lain atau saat deploy. Berkasnya ada di disk dan sudah diperbarui, tetapi perlu keputusan Anda: tambahkan pengecualian `!.env.example` di `.gitignore`, atau pindahkan dokumentasi env ke `docs/`. Tidak saya ubah karena mengubah kebijakan git berada di luar lingkup tahap ini.
8. **Verifikasi tampilan:** halaman `/login` diperiksa di browser sungguhan (tampil normal: kolom email, kata sandi, tombol "Masuk ke Sistem", tanpa error). Halaman `/mfa/setup` diverifikasi pada tingkat server (HTTP 200 untuk admin yang belum mendaftar) dan seluruh API-nya diuji; klik-untuk-klik di browser tidak dilakukan karena memerlukan pengetikan sandi akun.

## 6. Langkah berikutnya (rekomendasi saja, jangan dikerjakan tanpa instruksi)

- **1B-2 — reset kata sandi mandiri lewat email:** memerlukan kredensial SMTP yang Anda siapkan. Rencana: token sekali pakai berumur pendek (hanya hash yang disimpan), halaman "lupa sandi", template email, pembatas laju per akun, audit, dan pencabutan sesi setelah sandi diganti.
- **1B-3 - kebijakan sandi di UI + wajib ganti sandi** saat sandi lama tidak memenuhi kebijakan, serta pengerasan pencabutan sesi lintas perangkat.
- Setelah 1B selesai, Tahap 1 dapat ditandai DONE dan Tahap 2 (pemisahan master nasabah) dimulai.
- Keputusan yang masih menunggu: butir 3 dan 4 di atas.

## Status untuk sesi berikutnya

- 1B-1 sudah terpasang dan terverifikasi (57 + 35 pemeriksaan baru, plus 58 pemeriksaan 1A yang tetap lulus). Dua migrasi sudah diterapkan; skema tidak punya drift.
- Uji otomatis untuk dijalankan ulang: `npm run verify:mfa`, `npm run verify:mfa:live` (butuh dev server), `npm run verify:auth`, `npm run verify:auth:live`.
- **MFA wajib untuk peran ADMIN sudah aktif.** Admin yang belum mendaftar akan dialihkan ke `/mfa/setup` dan ditolak 403 pada API sampai mendaftar. Karena `admin@bpr.com` berperan ADMIN, akun itu **wajib mendaftarkan MFA saat login berikutnya** — siapkan ponsel dengan aplikasi authenticator.
- Untuk melanjutkan: kerjakan **1B-2 (reset sandi lewat email)** setelah kredensial SMTP disiapkan. Jangan mengubah gerbang MFA di luar kebutuhan 1B, dan jangan menyalakan kembali pengiriman data SLIK ke pihak ketiga (itu Tahap 5).
