# Laporan Sesi Coding Agent — Tahap 1B-3 (P0.1 kebijakan sandi di UI, wajib ganti sandi, pencabutan sesi lintas perangkat)

- **Tahap aktif:** Tahap 1 — P0.1, sub-tahap **1B-3** (terakhir dari Tahap 1).
- **Status:** DONE. Dengan selesainya 1A + 1B-1 + 1B-2 + 1B-3, **seluruh butir Tahap 1 (P0.1) sudah terpasang dan terverifikasi**, kecuali satu hal yang memang menunggu pihak luar: pengiriman email SMTP sungguhan untuk reset sandi (lihat 1B-2).
- **Tujuan sesi:** (a) menegakkan kebijakan kata sandi pada tampilan dan memaksa penggantian bagi sandi lama yang lemah, (b) menyediakan pencabutan sesi lintas perangkat.
- **Tanggal:** 2026-10-13

## 1. Temuan yang diverifikasi sebelum perubahan

| Temuan | Bukti | Keadaan sebelum |
|---|---|---|
| Kebijakan sandi hanya ditegakkan saat pembuatan/penggantian sandi; tidak ada cermin aturan di UI | `grep -inE "mustChange\|wajib.?ganti" prisma/schema.prisma src/lib/*.ts` = 0 hasil | TERVERIFIKASI |
| Sandi lama yang tidak memenuhi kebijakan hanya **dicatat di audit**, tidak memaksa ganti | `src/lib/auth-login.ts:172-175` (hanya `passwordHash` diperbarui) | TERVERIFIKASI |
| Tidak ada cara memutus sesi di perangkat lain; penonaktifan akun & penggantian sandi mencabut **semua** sesi termasuk sesi sendiri | `src/app/api/auth/[...nextauth]/route.ts:164-180` | TERVERIFIKASI |
| Backfill 1A tidak menandai akun bersandi lemah | `scripts/backfill-passwords.ts` (hanya `passwordHash`) | TERVERIFIKASI |

## 2. Perubahan

Berkas baru:
- `src/lib/password-policy-rules.ts` — cermin aturan kebijakan sandi (tanpa React) supaya dapat diuji skrip verifikasi maupun dipakai komponen.
- `src/components/account/PasswordPolicyChecklist.tsx` — daftar periksa interaktif; daftar sandi lemah/default sengaja **tidak** ikut ke peramban (tetap diperiksa server).
- `src/app/account/password/{page.tsx,AccountSecurityClient.tsx}` — halaman Keamanan Akun: ganti sandi sendiri + keluar dari semua perangkat. Halaman diletakkan **di luar** grup `(dashboard)` supaya akun yang wajib ganti sandi tidak terjebak putaran pengalihan.
- `src/app/api/account/password/route.ts` — ganti sandi sendiri (verifikasi sandi saat ini, kebijakan, tolak sandi sama, audit).
- `src/app/api/account/logout-all/route.ts` — pencabutan semua sesi.
- `scripts/verify-account-security.ts` (19 pemeriksaan) dan `scripts/verify-account-security-live.ts` (30 pemeriksaan HTTP).

Berkas diubah:
- `prisma/schema.prisma` — `users.must_change_password` dan `users.sessions_valid_from`.
- `src/lib/auth-login.ts` — jalur "sandi lama di-hash ulang" kini juga menandai `mustChangePassword = true` bila sandinya tidak memenuhi kebijakan.
- `src/app/api/auth/[...nextauth]/route.ts` — penjaga sesi juga membandingkan `iat` token dengan `sessions_valid_from`.
- `src/lib/permissions.ts` — gerbang `PASSWORD_CHANGE_REQUIRED` (403) pada `requireAuthAndPermission` dan `requireAnyPermission`.
- `src/app/(dashboard)/layout.tsx` — pengalihan ke `/account/password` bila akun wajib ganti sandi.
- `src/components/layouts/DashboardShell.tsx` — nama pengguna di header menjadi tautan ke halaman Keamanan Akun.
- `scripts/backfill-passwords.ts` — akun yang sandi lamanya tidak memenuhi kebijakan ditandai wajib ganti (dan dilaporkan di ringkasan/dry-run).
- `src/app/(dashboard)/admin/users/UserFormPage.tsx` — daftar periksa kebijakan di bawah kolom sandi admin.

## 3. Migrasi

- `prisma/migrations/<timestamp>_tahap_1b3_kebijakan_sandi_dan_sesi/migration.sql` — dua kolom baru pada `users` (tanpa data hilang; `must_change_password` bernilai false untuk akun yang ada).
- Hasil: `prisma migrate status` → skema basis data selaras.

## 4. Pengujian

| Perintah | Hasil aktual |
|---|---|
| `npm run verify:account` | **19/19 lulus** — cermin aturan klien tidak pernah lebih longgar dari server (diuji atas 9 contoh sandi); akun bersandi lama lemah: login tetap berhasil, hash dinaikkan ke cost 12, akun **ditandai wajib ganti**; akun bersandi lama kuat: **tidak** ditandai; `sessions_valid_from` tersimpan/terbaca dan aturan pencabutan (token terbit sebelum vs sesudah) berperilaku benar; audit memuat catatan wajib-ganti tanpa nilai sandi. |
| `npm run verify:account:live` | **30/30 lulus** — login dengan sandi lama lemah → akun ditandai; **API berizin ditolak 403 `PASSWORD_CHANGE_REQUIRED`**; halaman dasbor dialihkan 307 ke `/account/password`; halaman Keamanan Akun terbuka dan memuat kebijakan + peringatan + aksi keluar-semua-perangkat; ganti sandi dengan sandi saat ini salah / sandi baru lemah / sandi sama → ditolak, dan gerbang tetap menutup; ganti sandi sah → penanda dibersihkan, hash cost 12, sesi lama dicabut (setelah pemeriksaan ulang), sandi lama tidak berlaku, sandi baru berlaku, gerbang terbuka; **keluar dari semua perangkat** mencabut sesi pemanggil **dan** sesi perangkat kedua, sementara sandi tetap berlaku; audit lengkap dan bebas nilai sandi. |
| Regresi penuh | `verify:auth` **38/38**, `verify:mfa` **57/57**, `verify:reset` **45/45**, `verify:auth:live` **20/20**, `verify:mfa:live` **36/36**, `verify:reset:live` **32/32**. Tidak ada regresi setelah perubahan penjaga sesi, urutan gerbang izin, dan `DashboardShell`. |
| `npx eslint --quiet` berkas 1B-3 | **0 error**. |
| `npx tsc --noEmit` | **113** — sama dengan baseline, tanpa error baru. |
| `npm run build` | Sukses; rute `/account/password`, `/api/account/password`, `/api/account/logout-all` terdaftar. |

## 5. Risiko / keputusan

1. **Ganti sandi sendiri (dan "keluar dari semua perangkat") memang mengeluarkan sesi yang sedang dipakai.** Ini konsekuensi desain yang disengaja: sandi baru memperbarui `passwordChangedAt`, dan pencabutan perangkat memperbarui `sessions_valid_from`. Aplikasi menampilkan pesan lalu mengarahkan ke halaman masuk. Bila Anda ingin sesi saat ini tetap hidup saat sandi diganti, itu perlu mekanisme penanda sesi per-perangkat — silakan putuskan pada tahap lanjutan.
2. **Gerbang wajib-ganti berlaku pada SEMUA pengguna yang sandi tersimpannya tidak memenuhi kebijakan**, bukan hanya peran tertentu. Hari ini praktis hanya menyentuh akun yang sandi lamanya lemah (lewat backfill atau peningkatan hash saat login). Tidak ada akun yang perlu Anda tangani sekarang kecuali hasil backfill menunjukkan adanya.
3. **`sessions_valid_from` menyimpan waktu; token dinilai berdasarkan `iat`.** Jam server yang mundur dapat membuat token baru ikut dianggap tidak berlaku (kasus tepi yang jarang). Sudah dicatat untuk tahap infrastruktur (sinkronisasi waktu/NTP).
4. **Jalur SMTP sungguhan masih belum diuji** (sama seperti 1B-2) — menunggu kredensial dari Anda.
5. Masih menunggu keputusan Anda: perbaikan kerentanan `next@16.3.6` (perlu `next@16.4.0`) dan `.env.example` yang diabaikan git.

## 6. Langkah berikutnya (rekomendasi saja, jangan dikerjakan tanpa instruksi)

- **Tahap 1 (P0.1) sudah selesai.** Tahap berikutnya menurut urutan audit adalah **Tahap 2 — pemisahan master nasabah / data pribadi** (termasuk tema `src/lib/privacy.ts` yang belum dipakai dan jejak data nasabah yang ter-commit).
- Sebelum Tahap 2 dimulai, ada baiknya memutuskan: `next@16.4.0`, `.env.example`, dan apakah sesi saat ini boleh tetap hidup saat sandi diganti (butir 1).
- Setelah kredensial SMTP ada: `npm run verify:reset:live` tanpa transport file + satu percobaan nyata dari `/forgot-password`.

## Status untuk sesi berikutnya

- Tahap 1 lengkap dan terverifikasi: **1A** (bcrypt, kunci akun, sesi 8 jam), **1B-1** (MFA wajib ADMIN), **1B-2** (reset sandi via email), **1B-3** (kebijakan sandi + wajib ganti + pencabutan lintas perangkat).
- Perintah uji: `npm run verify:auth|verify:mfa|verify:reset|verify:account` (+ `:live` untuk masing-masing). Uji live butuh server berjalan; `verify:reset:live` butuh `MAIL_TRANSPORT=file` + `MAIL_OUTBOX_DIR`; uji pencabutan sesi butuh `AUTH_SESSION_REVALIDATE_SECONDS=1`.
- Pengingat: `src/proxy.ts` adalah daftar putih rute publik — setiap halaman publik baru harus ditambahkan di sana. Halaman `/account/password` sengaja **tidak** di daftar putih karena wajib sesi.
- **`admin@bpr.com`** masih wajib mendaftarkan MFA pada login berikutnya (`/mfa/setup`), dan jalur pemulihannya `npm run set-password -- admin@bpr.com --reset-mfa`.
