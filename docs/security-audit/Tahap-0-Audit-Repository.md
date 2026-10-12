# Laporan Sesi Coding Agent — Tahap 0 (Audit Repository)

- **Tahap aktif:** Tahap 0 — Audit repository, verifikasi temuan, inventarisasi risiko, rencana kerja
- **Status:** DONE (untuk ruang lingkup Tahap 0 = laporan saja) — 6 item P0/P1/P2 di bawah berlabel NEEDS HUMAN REVIEW sebagai keputusan, bukan sebagai pekerjaan tahap ini
- **Tujuan sesi:** Memverifikasi setiap temuan pada kode aktual, menginventarisasi risiko, dan menyusun rencana pengerjaan. Tidak mengubah kode aplikasi.
- **Tanggal:** 2026-10-12
- **Kepatuhan batas tahap:** Tidak ada berkas kode aplikasi dibuat/diubah/dihapus pada sesi ini. Hanya berkas dokumentasi ini yang ditambahkan.

## Ringkasan hasil

Repository adalah aplikasi operasional BPR (Next.js App Router 16.3.6, React 19, TypeScript, Prisma ORM + PostgreSQL, NextAuth credentials/JWT, Tailwind v4). Skala: **41 model, 12 enum, 13 migrasi, 57 route handler API, 16 modul API**.

Seluruh temuan P0 yang disebut dokumen instruksi **terkonfirmasi ada di kode saat ini** (bukan temuan usang). Yang paling mendesak dan tidak disebut eksplisit di dokumen instruksi tetapi ditemukan di lapangan:

1. **Berkas dokumen nasabah sudah masuk riwayat git** (11 berkas di `public/uploads`, folder tidak di-ignore).
2. **Endpoint penyaji berkas `src/app/uploads/[...path]/route.ts` tidak punya pemeriksaan sesi sama sekali** — siapa pun yang tahu URL dapat mengunduh; ditambah opsi cache publik 1 jam.
3. **IDOR lintas cabang/organisasi** pada route detail (terverifikasi pada dua route inti).
4. **Akun debitur/lead dibuat sebagai User dengan sandi statis** `DEBITUR_DEFAULT_PASS` — kombinasi dua temuan yang membuatnya bisa jadi jalur masuk, bukan hanya soal model data.
5. **Fitur Analisa SLIK AKTIF** dengan kunci OpenRouter terpasang di `.env` dan teks dokumen SLIK dikirim ke pihak ketiga tanpa masking, tanpa gerbang persetujuan. Ini bertentangan langsung dengan aturan kerja §8 dokumen instruksi dan harus diputuskan manusia.

## File yang diperiksa

Kode aplikasi (baca saja):
`next.config.ts`, `package.json`, `prisma/schema.prisma` (41 model), `prisma/seed.ts`, `.env.example`, `.gitignore`,
`src/lib/permissions.ts`, `src/lib/audit.ts`, `src/lib/privacy.ts`, `src/lib/rate-limit.ts`, `src/lib/security.ts`, `src/lib/db.ts`,
`src/app/api/auth/[...nextauth]/route.ts`, `src/app/api/users/route.ts`, `src/app/api/users/[id]/route.ts`,
`src/app/api/credit/applications/route.ts`, `src/app/api/credit/applications/[id]/route.ts`, `src/app/api/documents/route.ts`, `src/app/api/documents/[id]/route.ts`, `src/app/api/audit/route.ts`, `src/app/api/public/apply/route.ts`, `src/app/api/reports/route.ts`, `src/app/api/analyze-slik/route.ts`,
`src/app/uploads/[...path]/route.ts`,
`src/lib/slik/{openrouter,generateSlikReport,pdfText,types}.ts`, `src/app/(dashboard)/credit/slik-analyzer/SlikAnalyzerClientView.tsx`.
Plus pemindaian otomatis terhadap seluruh 57 route handler di `src/app/api`.

## Perubahan file

- **Kode aplikasi: tidak ada** (sesuai batas Tahap 0).
- Berkas dokumentasi baru: `docs/security-audit/Tahap-0-Audit-Repository.md` (laporan ini; agar protokol "baca laporan terakhir" dapat dijalankan pada sesi berikutnya).
- Skrip audit sementara berada di luar repo (scratch Hermes), tidak menambah berkas di repository.

## Pengujian

| Perintah | Hasil aktual |
|---|---|
| `npx tsc --noEmit -p tsconfig.json \| grep -c "error TS"` | **114 error** (semuanya di route API lain; 0 dari modul SLIK) |
| `npx eslint .` | **373 problems (140 error, 233 warning)** |
| `npm run build` (sesi kerja sebelumnya, setelah perubahan terakhir) | exit 0 — padahal 114 error TS ada, karena `ignoreBuildErrors: true` |
| `grep -rn "bcrypt\|argon2\|scrypt" src` | 0 match; tidak ada dependensi hashing di `package.json` |
| `grep -c Float / Decimal / BigInt prisma/schema.prisma` | 20 / 0 / 0 |
| `grep -rn "maskNIK\|maskPhone\|maskEmail\|maskAccountNumber\|sanitizeLogData" src` (di luar `src/lib/privacy.ts`) | **0 pemakaian** — helper masking ada tetapi tidak dipakai |
| `git ls-files public/uploads \| wc -l` | **11 berkas dokumen nasabah ter-track git** |
| `git log -- .env .env.local .env.production` | kosong — `.env` tidak pernah di-commit (baik) |
| `find src -name "*.test.ts*" -o -name "*.spec.ts*" \| wc -l` | 0 — tidak ada tes otomatis |
| `ls .github`, `ls Dockerfile docker-compose*` | tidak ada CI/CD, Docker, atau skrip deploy |
| Skrip audit route (baca-saja, di luar repo) | 57 route handler; 2 tanpa pemeriksaan sesi; logAudit di 21/57; rate limit di 2/57; penyaringan cabang di 12/57 |

**Pengujian yang belum dijalankan dan alasannya:** tidak ada uji runtime/migrasi pada tahap ini karena ruang lingkupnya verifikasi statis (Tahap 0 = laporan). Uji fungsional login/otorisasi/akses berkas berada di Tahap 1–4. Saya juga tidak menguji terhadap database produksi/nyata (tidak ada akses, dan tidak diminta).

## Migrasi dan risiko data

Tahap ini tidak menjalankan atau merancang migrasi. Risiko data yang harus dibawa ke tahap berikutnya:

- `CreditApplication.applicantId → User` (bukan entitas nasabah); akun debitur dibuat otomatis dengan sandi statis → migrasi pemisahan master nasabah (Tahap 2) menyentuh data nyata dan butuh strategi backfill + rollback.
- NIK & alamat pemohon tersimpan sebagai teks di kolom `notes` → perlu ekstraksi ke kolom terstruktur saat Tahap 2.
- 20 kolom uang bertipe `Float` → konversi ke `Decimal` (Tahap 6) berisiko pada data historis; butuh pemetaan presisi & pembulatan yang disepakati.
- 11 berkas dokumen nasabah di riwayat git → pembersihan riwayat bersifat destruktif pada histori; butuh keputusan manusia.
- Tidak ada backup/DR sama sekali → sebelum migrasi apa pun disarankan dump database lebih dulu (Tahap 13).

## Risiko atau keputusan yang masih diperlukan

Lihat bagian "NEEDS HUMAN REVIEW" pada laporan chat; ringkasnya:

1. Berkas dokumen nasabah di riwayat git — tangani sebagai insiden privasi? (filter-repo + rotasi/pemberitahuan)
2. Fitur SLIK ke OpenRouter — setujui dengan dasar tertulis/DPIA, atau nonaktifkan? (kunci sudah terpasang di `.env`)
3. Kredensial default `admin123` (seed) — apakah pernah dipakai pada data nyata/produksi?
4. Ledger tahap: apakah ada laporan Tahap 1/2 lama di luar repository? Audit menunjukkan deliverable-nya belum ada di kode.
5. Kebijakan retensi/pemusnahan dokumen & audit trail yang mencatat PII.

## Tahap selesai

**Tahap 0 — Audit Repository: DONE** (laporan saja, tanpa perubahan kode aplikasi).

## Tahap berikutnya (rekomendasi saja; jangan dikerjakan pada sesi ini)

- **Nomor dan nama tahap:** **Tahap 1 — P0.1 Autentikasi, hashing kata sandi, sesi, dan manajemen akun**
- **Alasan urutan (sesuai tabel §C):** sandi masih plaintext dan ada sandi default statis; ini prasyarat untuk semua tahap lain dan paling cepat memberi dampak keamanan nyata.
- **Prasyarat:** keputusan atas item NEEDS HUMAN REVIEW #1–#3; rencana migrasi sandi lama (hash saat login pertama / reset paksa) yang tidak mengunci semua pengguna; akses DB untuk uji.
- **Persetujuan/keputusan yang dibutuhkan:** menyetujui mekanisme migrasi sandi (memengaruhi akses pengguna produksi — §8 dokumen instruksi), dan keputusan apakah akun debitur tetap sebagai User (bila ya: hapus sandi statis dan buat tidak dapat login; bila tidak: tunggu Tahap 2).
- **Catatan:** bila Tahap 1 dinilai terlalu besar, pecah menjadi 1A (hashing + penghapusan sandi default + rate limit login) dan 1B (reset password, kebijakan sandi, MFA, pencabutan sesi) sesuai §D.

## Status untuk sesi berikutnya

Repository bersih (semua pekerjaan SLIK sudah di-commit; HEAD `1e587a0 fixing slik analyzer`). Tidak ada berkas sisa proses audit di dalam repo. Untuk melanjutkan: mulai **Tahap 1** saja, jangan menyentuh modul SLIK kecuali untuk menonaktifkan pengiriman data keluar bila diputuskan, dan jangan menyatakan siap produksi.
