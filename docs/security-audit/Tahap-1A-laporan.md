# Laporan Sesi Coding Agent — Tahap 1A (P0.1 Autentikasi, hashing, sesi, akun)

- **Tahap aktif:** Tahap 1 — P0.1. **Dikerjakan sebagai sub-tahap 1A** sesuai §D dokumen instruksi (Tahap 1 dinilai terlalu besar untuk satu sesi).
- **Status:** DONE untuk ruang lingkup 1A. Tahap 1 secara keseluruhan **belum** DONE (1B belum dikerjakan).
- **Tujuan sesi:** menghapus sandi teks polos & sandi default statis, memasang hashing bcrypt, pembatas laju/kunci akun pada login, masa berlaku & pencabutan sesi.
- **Sesi berikutnya (1B):** reset kata sandi (butuh infra email yang belum ada), kebijakan sandi di UI, MFA untuk admin, pengerasan pencabutan sesi lintas perangkat.
- **Tanggal:** 2026-10-12

## 1. Temuan yang diverifikasi

| Temuan | Bukti lama | Keadaan sebelum sesi ini |
|---|---|---|
| Sandi dibandingkan sebagai teks polos | `src/app/api/auth/[...nextauth]/route.ts:22` | TERVERIFIKASI |
| Sandi pengguna disimpan teks polos | `src/app/api/users/route.ts:77`, `users/[id]/route.ts:47` | TERVERIFIKASI |
| Sandi default statis untuk pemohon | `src/app/api/credit/applications/route.ts:131,159` (`DEBITUR_DEFAULT_PASS`) | TERVERIFIKASI |
| Kredensial default pada seed | `prisma/seed.ts:38` (`admin123`) | TERVERIFIKASI |
| Tidak ada pustaka hashing | 0 match `bcrypt/argon2/scrypt` | TERVERIFIKASI |
| Login tanpa pembatas laju & tanpa kunci akun | hanya 2/57 route memakai `checkRateLimit` | TERVERIFIKASI |
| **Akun nonaktif tetap bisa login** (baru ditemukan saat Tahap 1A) | `authorize()` tidak memeriksa `isActive` | TERVERIFIKASI — memperbesar dampak penonaktifan akun |
| Pemohon dibuat sebagai akun pegawai | `applications/route.ts:124-134,152-162` | TERVERIFIKASI |

## 2. Perubahan

Berkas baru:
- `src/lib/password.ts` — bcrypt cost 12; deteksi nilai teks polos lama; kebijakan sandi (min 10 karakter, huruf+angka, tolak sandi lemah/default, tolak >72 byte, tolak memuat email); penolakan total atas sandi default statis; `burnPasswordTime` untuk menyamakan waktu respons saat email tidak terdaftar.
- `src/lib/auth-lockout.ts` — batas per IP (10 percobaan / 5 menit) + kunci akun per database (5 kegagalan → 15 menit).
- `src/lib/auth-config.ts` — sesi 8 jam, perpanjangan 1 jam, pemeriksaan ulang izin tiap 5 menit (dapat diturunkan lewat `AUTH_SESSION_REVALIDATE_SECONDS` untuk pengujian).
- `scripts/backfill-passwords.ts` — migrasi nilai lama: teks polos → hash bcrypt; catatan pemohon/debitur dikunci (`passwordHash = NULL`, `isActive = false`). Idempoten, dry-run secara bawaan.
- `scripts/verify-auth.ts` (38 pemeriksaan) dan `scripts/verify-auth-live.ts` (20 pemeriksaan HTTP).
- `scripts/set-password.ts` — rencana pemulihan akun (tetapkan sandi baru dari `TARGET_PASSWORD` atau `--generate`, atau hanya buka kunci dengan `--unlock`).

Berkas diubah:
- `src/app/api/auth/[...nextauth]/route.ts` — ditulis ulang: bcrypt, penolakan akun nonaktif/terkunci **sebelum** sesi dibuat, batas per IP diperiksa sebelum pencarian akun, pencatatan `lastLoginAt`, peningkatan hash otomatis saat login, sesi 8 jam + pencabutan sesi saat akun dinonaktifkan atau sandi diganti, audit login tanpa nilai sandi.
- `src/app/api/users/route.ts`, `src/app/api/users/[id]/route.ts` — hashing + kebijakan sandi + `passwordChangedAt`.
- `src/app/api/credit/applications/route.ts` — tidak lagi membuat akun login pemohon; pencarian dibatasi `passwordHash: null` agar tidak menautkan akun pegawai.
- `prisma/seed.ts` — sandi admin dari `SEED_ADMIN_PASSWORD`; jika kosong → sandi acak sekali pakai yang dicetak ke console saja.
- `prisma/schema.prisma` — kolom `failed_login_attempts`, `locked_until`, `password_changed_at`.
- `package.json` — script `verify:auth`, `verify:auth:live`, `backfill:passwords`, `set-password`; dependensi `bcryptjs@3`.
- `.env.example` — dokumentasi `SEED_ADMIN_PASSWORD` dan `AUTH_SESSION_REVALIDATE_SECONDS` (dijelaskan, tanpa nilai rahasia).

## 3. Migrasi

- Migrasi Prisma: `prisma/migrations/20261012052211_npm_run_backfill_passwords/migration.sql`
  — `ALTER TABLE "users" ADD COLUMN "failed_login_attempts" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "locked_until" TIMESTAMPTZ, ADD COLUMN "password_changed_at" TIMESTAMPTZ`.
  Nama folder dibuat otomatis oleh Prisma dari konteks npm script saat dijalankan; isinya persis tiga kolom yang direncanakan. **Tidak ada reset database dan tidak ada kehilangan data** (`prisma migrate status` sebelumnya: 14 migrasi, tanpa drift).
- Cara menjalankan pada lingkungan lain: `npx prisma migrate deploy`, lalu `npm run backfill:passwords -- --apply`.
- Rollback: kolom tambahan bersifat aditif dan tidak dibaca oleh kode lama, sehingga aman dibiarkan; untuk mundur total: `ALTER TABLE "users" DROP COLUMN ...` (setelah kode lama dipasang kembali) — nilai sandi yang sudah di-hash **tidak dapat** dikembalikan ke bentuk semula (memang disengaja).
- Data: sebelum sesi ini database hanya berisi 1 akun (`admin@bpr.com`). Hasil akhir: sandinya berupa hash bcrypt, akun aktif, tidak terkunci, `password_changed_at` terisi, 0 baris pemohon (`@bpr-client.internal`).

## 4. Pengujian

| Perintah | Hasil aktual |
|---|---|
| `npm run verify:auth` | **38/38 lulus** — hashing, verifikasi, penolakan sandi default statis, kebijakan sandi, nilai sesi/kunci, dan integritas database (0 sandi teks polos, semua hash cost 12, kolom kunci ada). |
| `npm run verify:auth:live` (dev server + `AUTH_SESSION_REVALIDATE_SECONDS=1`) | **20/20 lulus** — login bcrypt menghasilkan sesi; sandi salah ditolak & tercatat; akun terkunci setelah 5 kegagalan dan sandi benar tetap ditolak saat terkunci; batas per IP tercatat di audit; login berhasil setelah kunci dibuka; sesi dicabut saat akun dinonaktifkan; sesi dicabut saat sandi diganti (sandi lama tidak berlaku, sandi baru berlaku); akun nonaktif ditolak; catatan pemohon tanpa sandi ditolak tanpa dihitung sebagai kegagalan sandi; email tidak terdaftar ditolak; tidak ada sandi yang bocor ke audit. Akun uji beserta baris auditnya dihapus setelah pengujian. |
| `npx eslint` pada berkas yang diubah | 0 error (11 warning lama di `prisma/seed.ts`, tidak berkaitan). |
| `npx tsc --noEmit` | 113 error (sebelumnya 114) — 4 error di berkas yang tersentuh terbukti sudah ada di HEAD (`error.code` pada `unknown`, `whereClause`), tidak ada error baru. |
| `npm run build` | Sukses (`BUILD_ID` baru terbentuk 2026-10-12 12:29:32); route `/api/auth/*` terdaftar. |

Pengujian yang belum dijalankan dan alasannya: reset kata sandi (belum ada alurnya — pekerjaan 1B), MFA (belum ada infra), pengujian lintas-instance untuk pembatas per IP (butuh 2 instance), dan uji beban. Tidak ada pengujian terhadap data nasabah nyata.

## 5. Risiko atau keputusan yang masih diperlukan

1. **Kebijakan penguncian pada backfill:** akun yang nilai sandinya masih sama dengan sandi default statis (`admin123`, `DEBITUR_DEFAULT_PASS`, dll.) **dikunci**, bukan hanya di-hash. Ini benar dari sisi keamanan, tetapi bila akun itu satu-satunya admin, pemulihan harus lewat `npm run set-password`. Pada database ini admin tidak terkena (nilainya bukan salah satu default) sehingga tidak ada yang terkunci. Keputusan untuk Anda: pertahankan kunci (disarankan) atau ubah menjadi "hash + tandai wajib ganti".
2. **Pembatas per IP masih di memori proses** dan IP diambil dari `X-Forwarded-For`. Bila aplikasi dijalankan di belakang reverse proxy, header itu harus diisi/dibersihkan oleh proxy; bila multi-instance, perlu penyimpanan bersama (Redis) — tercatat untuk Tahap 13.
3. **Sandi admin belum tentu memenuhi kebijakan baru.** Bila sandi lama tidak memenuhi kebijakan, login tetap berhasil (sandi di-hash ulang) tetapi dicatat untuk wajib diganti; belum ada paksaan penggantian di UI (pekerjaan 1B).
4. **Akun pemohon masih berupa baris `users`** tanpa sandi dan tidak aktif. Pemisahan penuh ke entitas nasabah adalah Tahap 2; sebelumnya `CreditApplication.applicantId` menunjuk ke baris ini.
5. **Belum ada halaman/kebijakan penggantian sandi mandiri** dan belum ada notifikasi ke pengguna saat sandi/kunci berubah.

## 6. Langkah berikutnya (rekomendasi saja)

- **Tahap 1B** (lanjutan P0.1): alur reset kata sandi (perlu keputusan infrastruktur email), halaman ganti sandi wajib saat sandi tidak memenuhi kebijakan, MFA untuk admin, pencabutan sesi lintas perangkat, dan pencatatan perubahan sandi yang lebih rinci.
- Prasyarat 1B: keputusan kanal email/SMS untuk reset, dan keputusan apakah MFA wajib untuk semua admin.
- Setelah 1B selesai, Tahap 1 dapat ditandai DONE dan Tahap 2 (pemisahan master nasabah) dapat dimulai.

## Koreksi pasca-uji (1A.1) — 2026-10-12

Dilaporkan pengguna: tidak bisa login dengan sandi yang diberikan saat menjalankan `npx prisma db seed`.

**Akar masalah (cacat kode pada perubahan 1A ini):**
1. `prisma/seed.ts` memakai `upsert` dengan `update: {}`, sehingga `SEED_ADMIN_PASSWORD` **hanya berlaku saat akun admin belum ada**. Mengubah nilai di `.env` lalu menjalankan seed ulang tidak berpengaruh apa pun, padahal console tampak sukses — inilah yang menyesatkan.
2. `.env` memuat `SEED_ADMIN_PASSWORD=` **tanpa nilai**, jadi seed membuat sandi acak sekali pakai (akun dibuat 2026-10-12 12:22:14). Lima percobaan login gagal (12:45) membuat akun terkunci sampai 12:55.
3. Ditemukan saat menguji perbaikan: blok `create` pada seed masih memakai email literal `admin@bpr.com` sementara `where` memakai email yang dikonfigurasi → percobaan membuat akun kedua bertabrakan `unique constraint`.

**Perbaikan:**
- Bila `SEED_ADMIN_PASSWORD` diisi, nilai itu **diterapkan juga pada akun yang sudah ada** (sekaligus membuka kunci dan mengaktifkan kembali akun).
- Bila env kosong dan akun sudah ada, seed **tidak menyentuh sandi** dan mencetak dua cara menggantinya secara eksplisit.
- Tambahan opsi `SEED_ADMIN_EMAIL` (bawaan `admin@bpr.com`); email kini konsisten di `where` maupun `create`.
- Akun `admin@bpr.com` dibuka kuncinya; keadaan akhir: sandi hash bcrypt, aktif, 0 kegagalan, tidak terkunci.

**Verifikasi perbaikan (dijalankan sungguhan):** dengan akun uji terpisah dan sandi yang dibuat di dalam shell (tidak pernah ditampilkan) —
1. Seed pertama dengan nilai A → akun dibuat; 2. Seed kedua dengan nilai B → pesan "SANDI DIPERBARUI" muncul, dan pemeriksaan bcrypt menunjukkan hash **cocok dengan B** serta **tidak cocok dengan A**. Akun uji beserta 2 peran dan baris auditnya dihapus setelah pengujian; skrip sementara dibersihkan.

**Catatan pemakaian:**
- `npm run <script> arg` **tidak** meneruskan argumen di npm; gunakan `npm run <script> -- arg`.
- Sandi admin tidak boleh memuat kata `admin` (karena merupakan bagian lokal email `admin@bpr.com`). Contoh yang ditolak: `AdminBpr2026`; contoh yang diterima: `BprAdiartha2026`.
- Rotasi/pemulihan: isi `SEED_ADMIN_PASSWORD` di `.env` lalu `npx prisma db seed`, atau `npm run set-password -- admin@bpr.com --generate`.

## Status untuk sesi berikutnya

- Kode 1A sudah terpasang dan terverifikasi; migrasi sudah diterapkan.
- `admin@bpr.com` saat ini menyimpan sandi acak yang dibuat seed 12:22 yang tidak tercatat pengguna. Akun sudah dibuka kuncinya; sandi harus ditetapkan lewat salah satu cara di bagian "Koreksi pasca-uji (1A.1)" sebelum sesi berikutnya.
- Untuk melanjutkan: kerjakan **Tahap 1B** saja. Jangan mengubah alur login kecuali untuk kebutuhan 1B, dan jangan menyalakan kembali pengiriman data SLIK ke pihak ketiga (itu Tahap 5).
