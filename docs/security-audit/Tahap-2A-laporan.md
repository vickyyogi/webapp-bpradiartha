# Laporan Sesi Coding Agent — Tahap 2A (P0.2 memisahkan master nasabah/debitur dari pegawai)

- **Tahap aktif:** Tahap 2 — P0.2. Dikerjakan sebagai **sub-tahap 2A** sesuai §D dokumen instruksi (Tahap 2 dinilai terlalu besar untuk satu sesi: mencakup entitas master, riwayat identitas, deduplikasi, hubungan antar-pihak, persetujuan data pribadi, serta API/UI).
- **Status:** **PARTIAL** — inti pemisahan entitas, relasi pengajuan→nasabah, migrasi data, dan identitas terstruktur sudah **DONE dan teruji**; riwayat perubahan identitas + verifikator, deteksi duplikasi berlapis, hubungan antar-pihak, persetujuan pemrosesan data pribadi, dan API/UI manajemen nasabah menjadi **2B/2C**.
- **Tujuan sesi:** membuat entitas master Nasabah/Debitur yang terpisah dari User/Pegawai; memindahkan relasi pengajuan kredit agar tidak bergantung pada akun pegawai; memigrasikan data lama dengan aman; menyimpan identitas secara terstruktur (bukan catatan bebas).
- **Tanggal:** 2026-10-13

## 1. Temuan yang diverifikasi sebelum perubahan

| Temuan | Bukti | Keadaan sebelum |
|---|---|---|
| Relasi pengajuan kredit menunjuk ke akun `User`/pegawai | `prisma/schema.prisma` → `CreditApplication.applicantId → User` | TERVERIFIKASI |
| Pemohon dibuat sebagai baris `users` (walau tanpa sandi, tidak aktif) | `src/app/api/credit/applications/route.ts` (mode MANUAL/LEAD membuat `db.user.create`) | TERVERIFIKASI |
| NIK & alamat disimpan sebagai teks di kolom `notes` | `route.ts:189-194` (`[NIK KTP: ...]`, `[Alamat Pemohon: ...]`) | TERVERIFIKASI |
| Tidak ada entitas master nasabah | tidak ada model `Customer` di skema | TERVERIFIKASI |
| Helper masking `src/lib/privacy.ts` belum dipakai | 0 pemakaian `maskNIK/maskPhone/...` di luar definisi | TERVERIFIKASI (tetap menjadi pekerjaan pelaporan/masking Tahap 8) |
| Data dev saat ini: 3 pengajuan lama semuanya menunjuk ke `admin@bpr.com` | query DB (lihat lampiran migrasi) | TERVERIFIKASI |

## 2. Perubahan

**Berkas baru:**
- `src/lib/customer.ts` — aturan identitas (normalisasi & validasi NIK/ID usaha), pembuat nomor nasabah berurutan per organisasi (`CUST-YYYY-NNNN`) dengan retry saat tabrakan, dan `findCustomerByIdentity` untuk mencegah duplikasi dasar berdasarkan NIK/ID usaha.
- `prisma/migrations/20261013120000_tahap_2a_master_nasabah/migration.sql` — migrasi + **backfill data lama di dalam migrasi** (lihat bagian Migrasi).
- `scripts/verify-customers.ts` — 36 pemeriksaan (logika, struktur, integritas DB, operasi DB, dan penjaga sumber).
- `scripts/verify-customers-live.ts` — 15 pemeriksaan HTTP.

**Berkas diubah:**
- `prisma/schema.prisma` — model `Customer` (+ enum `CustomerType`, `CustomerStatus`) dengan identitas terstruktur (`customerNumber`, `customerType`, `legalName`, `identityType/identityNumber`, `npwp`, `birthPlace/birthDate`, `gender`, alamat terpisah, kontak, pekerjaan/penghasilan, serta `createdById/updatedById/verifiedById/verifiedAt`). `CreditApplication.applicantId`/`applicant` diganti `customerId`/`customer` (wajib). Relasi balik ditambahkan pada `Organization`, `Branch`, dan `User`.
- `src/app/api/credit/applications/route.ts` — POST **tidak pernah lagi membuat `User`**. Mode pemohon: `CUSTOMER` (nasabah terdaftar), `MANUAL` (nasabah baru; NIK/alamat masuk kolom terstruktur), `LEAD` (nasabah dari prospek). Nama lama `applicantMode: "USER"` dipetakan ke `CUSTOMER`. NIK/alamat **tidak lagi** ditulis ke `notes`. GET memakai `customer`.
- `src/app/api/credit/applications/[id]/route.ts` — include/`updated` memakai `customer`.
- `src/app/api/reports/route.ts` — laporan kredit memakai `customer.legalName`.
- `prisma/seed.ts` — sample kredit kini membuat 3 nasabah contoh dan mengaitkan pengajuan ke nasabah (bukan ke admin).
- Halaman & komponen: `credit/applications/page.tsx` (+ daftar nasabah untuk pemilihan), `CreditApplicationsClientView.tsx` (mode ketiga menjadi "Dari Nasabah Terdaftar"), `credit/applications/[id]/page.tsx`, `CreditApplicationDetailClientView.tsx`, `credit/page.tsx`, `reports/page.tsx` — semua memakai `customer`.
- `package.json` — script `verify:customers`, `verify:customers:live`.

## 3. Migrasi dan risiko data

Migrasi `20261013120000_tahap_2a_master_nasabah` dijalankan dengan `npx prisma migrate deploy` (non-interaktif) dan berisi, dalam satu transaksi:
1. Membuat enum `CustomerType`/`CustomerStatus` dan tabel `customers` + indeks + FK.
2. Menambah `credit_applications.customer_id` (nullable dulu).
3. **Backfill**: satu nasabah untuk setiap akun pemohon lama yang dipakai pengajuan; `customers.id = users.id` agar relasi dapat ditelusuri melalui kolom `legacy_applicant_user_id`. Nomor nasabah `CUST-<tahun>-NNNN` dihasilkan berurutan per organisasi.
4. **Ekstraksi identitas terstruktur**: tag `[NIK KTP: ...]` dan `[Alamat Pemohon: ...]` di catatan lama dipindahkan ke `identity_number`/`address`, lalu tag dibersihkan dari `notes`.
5. Mengaitkan setiap pengajuan ke nasabah, mengubah `customer_id` menjadi `NOT NULL`, menghapus FK & kolom `applicant_id`, dan menambah FK baru ke `customers`.

- Hasil: `prisma migrate status` → **19 migrasi, "Database schema is up to date!"**; `prisma migrate diff` → **"No difference detected"** (tidak ada drift). Tidak ada reset database.
- Data dev terverifikasi: 1 nasabah terbentuk (`CUST-2026-0001`, `legacy_applicant_user_id` terisi), 3 pengajuan terhubung ke nasabah tersebut, catatan lama sudah bersih dari NIK.
- **Rollback:** migrasi ini mengubah bentuk relasi (menghapus `applicant_id`). Untuk mundur: buat ulang kolom `applicant_id` dan isi dari `customers.legacy_applicant_user_id`, pasang kembali kode lama, lalu `ALTER TABLE credits... DROP COLUMN customer_id` dan `DROP TABLE customers`. Karena id nasabah hasil migrasi = id user lama, pemetaan balik bersifat deterministik.
- **Catatan destruktif:** kolom `applicant_id` **dihapus** (transformasi, bukan kehilangan informasi — nilainya tersimpan sebagai `customers.id` dan `customers.legacy_applicant_user_id`). Karena menyangkut transformasi data, ini dicatat sebagai keputusan yang perlu disetujui pemilik sistem di lingkungan nyata (lihat bagian risiko). Pada database pengembangan yang dipakai sesi ini hanya berisi data contoh.

## 4. Pengujian

| Perintah | Hasil aktual |
|---|---|
| `npm run verify:customers` | **36/36 lulus** — normalisasi/validasi NIK & ID usaha, format nomor nasabah (>9999 tetap unik), tabel `customers` ada, `credit_applications` punya `customer_id` & **tidak lagi** `applicant_id`, FK baru terpasang, setiap pengajuan punya nasabah dengan organisasi sama, tidak ada NIK/alamat tersisa di catatan, nomor nasabah unik per organisasi, nasabah migrasi menunjuk baris `users` lama, pembuatan+pencarian+deduplikasi nasabah nyata di DB (lalu dibersihkan), dan penjaga sumber (route tidak membuat User / tidak menyentuh `passwordHash` / tidak menulis NIK ke catatan). |
| `npm run verify:customers:live` (dev server) | **15/15 lulus** — login non-MFA berhasil; GET pengajuan 200; POST `MANUAL` → 201 dengan nasabah ber-nama legal, NIK tersimpan terstruktur, nomor `CUST-…`, catatan **bersih dari NIK**, dan **tidak ada `User` yang dibuat untuk pemohon**; POST mode `CUSTOMER` → 201 memakai nasabah yang sama; NIK tidak valid → 400. Data uji (aplikasi, nasabah, akun, peran, audit) dihapus setelah pengujian. |
| Regresi `npm run verify:auth` | **38/38 lulus** — tidak ada regresi pada hashing/penguncian/akun pemohon. |
| `npx eslint --quiet` berkas 2A | **0 error** pada `src/lib/customer.ts`, `scripts/verify-customers*.ts`, `prisma/seed.ts`. |
| `npx tsc --noEmit` | **113** — sama dengan baseline; tidak ada error baru (error lama pada `whereClause`/`updateData = {}` tetap). |
| `npm run build` | Sukses; rute `/api/credit/applications`, `/api/credit/applications/[id]`, `/api/reports`, `/credit/applications`, `/credit/applications/[id]` terdaftar. |

**Pengujian yang belum dijalankan dan alasannya:** uji klik-untuk-klik di peramban untuk form pengajuan (memerlukan pengetikan sandi); uji terhadap data nasabah produksi (tidak ada akses); uji concurrency multi-instance untuk pembuat nomor nasabah (tercatat sebagai risiko).

## 5. Risiko atau keputusan yang masih diperlukan

1. **Penghapusan kolom `applicant_id`** adalah transformasi data. Di dev tidak ada kehilangan (id nasabah = id user lama + `legacy_applicant_user_id`), tetapi pada data produksi wajib: dump database lebih dulu, jalankan backfill, dan verifikasi jumlah nasabah == jumlah pemohon lama sebelum menghapus kolom. Butuh persetujuan pemilik sistem (aturan §8).
2. **Akun nasabah vs pegawai.** Sesi ini menegakkan bahwa pengajuan merujuk ke `Customer`, dan pemohon baru tidak pernah dibuatkan `User`. Namun baris `User` lama yang sebelumnya dipakai sebagai pemohon (mis. `admin@bpr.com` pada data contoh) **tidak** dihapus/diubah; ia hanya tidak lagi menjadi relasi pengajuan.
3. **Deduplikasi masih dasar** (cocok persis NIK/ID usaha ternormalisasi; untuk LEAD cocok nomor telepon). Deteksi duplikasi berlapis (mis. kemiripan nama, perlindungan akses hasil pencarian) menjadi 2B.
4. **Riwayat perubahan identitas & verifikator.** Kolom `createdById/updatedById/verifiedById/verifiedAt` sudah tersedia, tetapi tabel riwayat perubahan per-field dan alur verifikasi/penolakan identitas belum ada → 2B.
5. **Hubungan antar-pihak (pasangan/penjamin/UBO) & persetujuan pemrosesan data pribadi** belum dibuat → 2B.
6. **Nomor nasabah berbasis urutan + retry**, belum memakai sequence database; aman karena constraint unik, tetapi pada trafik sangat tinggi dapat menambah percobaan. Cukup untuk sekarang; dapat ditingkatkan bila perlu.
7. `monthly_income` pada nasabah masih `Float`; konversi ke `Decimal` menyusul pada **Tahap 6 (P0.6)** agar tidak mencampur tahap.
8. Temuan lama yang masih menunggu keputusan Anda: `next@16.4.0`, `.env.example` yang diabaikan git, dan status sesi saat sandi diganti (dari Tahap 1).

## 6. Tahap selesai

- **Tahap 2A: DONE** (inti P0.2). Tahap 2 induk **belum DONE** sampai 2B/2C selesai.

## 7. Tahap berikutnya (rekomendasi saja; jangan dikerjakan pada sesi ini)

- **Nomor dan nama tahap:** **Tahap 2B — P0.2 lanjutan**: riwayat perubahan identitas + verifikator; deteksi duplikasi berlapis dengan perlindungan akses; hubungan antar-pihak (pasangan, penjamin, UBO); pencatatan bukti persetujuan pemrosesan data pribadi; plus API/UI manajemen nasabah (CRM Customers).
- **Prasyarat:** keputusan atas butir risiko 1 (kebijakan transformasi data produksi) bila akan diterapkan ke data nyata.
- **Persetujuan/keputusan yang dibutuhkan:** kebijakan retensi & dasar hukum penyimpanan NIK (validasi compliance) sebelum menambah field kepatuhan.

## Status untuk sesi berikutnya

- Skema selaras, **19 migrasi**, tanpa drift. Entitas `Customer` aktif; `CreditApplication.customerId` wajib; kolom `applicant_id` sudah dihapus.
- Perintah uji: `npm run verify:customers` (tanpa server) dan `npm run verify:customers:live` (butuh `npm run dev`). Regresi: `npm run verify:auth`.
- Berkas lama `scripts/backfill-passwords.ts` tidak relevan dengan tahap ini dan tidak diubah untuk 2A.
- Untuk melanjutkan: mulai **Tahap 2B** saja. Jangan menyalakan kembali pengiriman data SLIK ke pihak ketiga (itu Tahap 5), dan jangan mengubah tipe nominal keuangan (itu Tahap 6).
