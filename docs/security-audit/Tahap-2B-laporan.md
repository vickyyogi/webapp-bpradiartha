# Laporan Sesi Coding Agent — Tahap 2B (P0.2 riwayat identitas, deduplikasi, hubungan antar-pihak, persetujuan data pribadi)

- **Tahap aktif:** Tahap 2 — P0.2, sub-tahap **2B** (lanjutan dari 2A).
- **Status:** **DONE** untuk ruang lingkup 2B. Dengan selesainya 2A + 2B, **seluruh butir Tahap 2 (P0.2) sudah terpasang dan terverifikasi**.
- **Tujuan sesi:** mencatat riwayat perubahan identitas beserta petugas verifikator; menyediakan deteksi potensi duplikasi berdasarkan NIK/ID usaha dengan perlindungan akses; mendukung hubungan antar-pihak (pasangan/penjamin/UBO); dan mencatat bukti persetujuan pemrosesan data pribadi — beserta API dan UI manajemen nasabah (CRM Customers).
- **Tanggal:** 2026-10-13

## 1. Temuan yang diverifikasi sebelum perubahan

| Temuan | Bukti | Keadaan sebelum |
|---|---|---|
| Belum ada riwayat perubahan identitas | skema hanya punya `createdById/updatedById/verifiedById/verifiedAt` di `Customer`; tidak ada tabel riwayat | TERVERIFIKASI |
| Belum ada deteksi duplikasi berlapis | 2A hanya `findCustomerByIdentity` (cocok NIK persis) | TERVERIFIKASI |
| Belum ada entitas hubungan antar-pihak | tidak ada model relasi | TERVERIFIKASI |
| Belum ada bukti persetujuan pemrosesan data pribadi | tidak ada model consent | TERVERIFIKASI |
| Belum ada API/UI manajemen nasabah | hanya `/api/crm/leads`; halaman `/crm` masih mengarah ke leads | TERVERIFIKASI |
| Helper masking `src/lib/privacy.ts` belum dipakai | 0 pemakaian | TERVERIFIKASI → kini dipakai (`maskPhone`) dan `maskIdentity` baru |

## 2. Perubahan

**Berkas baru:**
- `prisma/migrations/20261013150000_tahap_2b_riwayat_relasi_consent/migration.sql` — migrasi aditif (3 tabel + 2 enum).
- `src/app/api/crm/customers/route.ts` — GET daftar nasabah (NIK disamarkan) + POST buat nasabah (validasi identitas, cek duplikat NIK → 409, catat riwayat CREATE, catat consent opsional).
- `src/app/api/crm/customers/[id]/route.ts` — GET detail (identitas lengkap + riwayat + hubungan + consent + pengajuan kredit) + PUT ubah (mencatat riwayat hanya untuk field identitas yang berubah).
- `src/app/api/crm/customers/duplicates/route.ts` — GET deteksi duplikat (hasil disamarkan; wajib izin view).
- `src/app/api/crm/customers/[id]/verify/route.ts` — POST verifikasi identitas (isi `verifiedById`/`verifiedAt` + riwayat VERIFY).
- `src/app/api/crm/customers/[id]/relationships/route.ts` + `.../relationships/[relationshipId]/route.ts` — GET/POST/DELETE hubungan antar-pihak (dengan audit trail).
- `src/app/api/crm/customers/[id]/consents/route.ts` — GET/POST catatan persetujuan (beri/cabut, dengan audit trail).
- `src/app/(dashboard)/crm/customers/page.tsx` + `CustomersClientView.tsx` — daftar nasabah, pencarian/filter, form tambah/ubah dengan peringatan duplikat.
- `src/app/(dashboard)/crm/customers/[id]/page.tsx` + `CustomerDetailClientView.tsx` — detail nasabah: identitas, riwayat identitas, hubungan antar-pihak, persetujuan data, pengajuan kredit terkait.

**Berkas diubah:**
- `prisma/schema.prisma` — model `CustomerIdentityHistory`, `CustomerRelationship`, `CustomerConsent` (+ enum `CustomerRelationshipType`, `CustomerConsentType`) dan relasi balik di `Customer`/`User`.
- `src/lib/customer.ts` — `CUSTOMER_IDENTITY_FIELDS`, `pickIdentitySnapshot`, `diffIdentitySnapshots`, `recordCustomerIdentityHistory`, `maskIdentity`, `findDuplicateCandidates` (alasan `IDENTITY_EXACT`/`PHONE_EXACT`/`NAME_BIRTHDATE`, hasil disamarkan).
- `src/components/layouts/DashboardShell.tsx` — menu "Data Nasabah (Customers)" → `/crm/customers`.
- `src/app/(dashboard)/crm/page.tsx` — kartu modul nasabah diarahkan ke `/crm/customers`.
- `scripts/verify-customers.ts` (+16 pemeriksaan 2B) dan `scripts/verify-customers-live.ts` (+19 pemeriksaan HTTP 2B).

## 3. Migrasi

- `prisma/migrations/20261013150000_tahap_2b_riwayat_relasi_consent/migration.sql` — **aditif**: membuat `customer_identity_histories`, `customer_relationships`, `customer_consents` beserta enum/indeks/FK. **Tidak menyentuh data lama, tidak ada reset, tidak ada data hilang.**
- Hasil: `prisma migrate status` → **20 migrasi, "Database schema is up to date!"**; `prisma migrate diff` → **"No difference detected"**.
- Catatan proses: percobaan pertama gagal karena berkas migrasi mengandung BOM (kesalahan penulisan berkas, bukan cacat skema); migrasi ditandai `--rolled-back`, BOM dihapus, lalu diterapkan ulang dengan sukses. Tidak ada migrasi yang ter-aplikasi sebagian.
- Rollback: `DROP TABLE customer_consents, customer_relationships, customer_identity_histories;` dan `DROP TYPE "CustomerRelationshipType", "CustomerConsentType";` setelah kode lama dipasang kembali.

## 4. Pengujian

| Perintah | Hasil aktual |
|---|---|
| `npm run verify:customers` | **52/52 lulus** — mencakup 2A (36) + 2B (16): snapshot hanya memuat field identitas; diff mendeteksi/mengabaikan field dengan benar; masking identitas; ketiga tabel baru ada; deteksi duplikat `IDENTITY_EXACT`, `PHONE_EXACT`, `NAME_BIRTHDATE`; hasil duplikat disamarkan; `excludeCustomerId`; riwayat identitas tersimpan; hubungan antar-pihak tersimpan; catatan persetujuan beri & cabut tersimpan; data uji dibersihkan. |
| `npm run verify:customers:live` (dev server) | **33/33 lulus** — 2A (14) + 2B (19): POST nasabah 201 dengan nomor CUST; deteksi duplikat menemukan & menyamarkan NIK; identitas duplikat ditolak **409**; daftar menyamarkan NIK dan **tidak** memuat NIK mentah; detail menampilkan NIK lengkap untuk pengguna berizin; PUT mencatat field `phone` berubah; riwayat memuat aksi UPDATE; verifikasi menandai `verifiedAt`; hubungan antar-pihak POST/GET/DELETE; persetujuan data POST/GET. Data uji (nasabah, aplikasi, akun, peran, audit) dihapus setelah pengujian. |
| Regresi `npm run verify:auth` | **38/38 lulus** — tidak ada regresi. |
| `npx eslint --quiet` berkas baru 2B | **0 error**. |
| `npx tsc --noEmit` | **113** — sama dengan baseline, tanpa error baru. |
| `npm run build` | Sukses; rute `/api/crm/customers`, `/[id]`, `/[id]/verify`, `/[id]/relationships`, `/[id]/relationships/[relationshipId]`, `/[id]/consents`, `/duplicates`, `/crm/customers`, `/crm/customers/[id]` terdaftar. |

**Pengujian yang belum dijalankan dan alasannya:** uji klik-untuk-klik di peramban (memerlukan pengetikan sandi); uji beban/performa untuk daftar besar (dibatasi `take: 500`); uji multi-instance.

## 5. Risiko atau keputusan yang masih diperlukan

1. **Perlindungan akses duplikasi** dilakukan dengan mewajibkan izin `crm.customer.view` dan menyamarkan NIK/telepon pada daftar & hasil duplikat; detail menampilkan NIK lengkap untuk pengguna berizin. Kebijakan siapa yang berhak melihat NIK penuh perlu disahkan oleh pemilik sistem (bila perlu, tambahkan izin khusus pada Tahap 3).
2. **Verifikasi identitas memakai izin `crm.customer.update`** (belum izin terpisah) dan **bukan** pemisahan Maker-Checker penuh. Pemisahan tugas verifikator/pemutus adalah ruang lingkup **Tahap 3 (P0.3)**.
3. **Hubungan antar-pihak** mencatat `relatedName`/`relatedIdentityNumber` bebas bila pihak terkait belum terdaftar sebagai nasabah; penautan ke nasabah lain (`relatedCustomerId`) sudah didukung.
4. **Consent bersifat catatan operasional** (beri/cabut direkam sebagai baris); versi kebijakan (`policyVersion`) diisi manual. Dasar hukum, teks persetujuan, dan retensi final perlu validasi compliance (butir yang sama seperti 2A).
5. **Audit trail menulis ke `audit_logs`** untuk perubahan hubungan/consent. `src/lib/audit.ts` masih mengabaikan kegagalan tulis (temuan P1.6) — akan diperkuat pada **Tahap 7**.
6. Daftar nasabah dibatasi `take: 500` tanpa paginasi; paginasi/streaming aman adalah ruang lingkup pelaporan (Tahap 8).
7. `monthly_income` masih `Float` → dikonversi ke `Decimal` pada **Tahap 6**.
8. Temuan lama yang masih menunggu keputusan: `next@16.4.0`, `.env.example` yang diabaikan git, dan status sesi saat sandi diganti (Tahap 1).

## 6. Tahap selesai

- **Tahap 2B: DONE.**
- **Tahap 2 (P0.2): DONE** — seluruh tugas dan kriteria selesai terpenuhi:
  - Entitas master Nasabah/Debitur terpisah dari User/Pegawai ✔ (2A)
  - Identitas terstruktur (nomor nasabah, nama legal, NIK/NPWP, kontak, tanggal lahir/berdiri) ✔ (2A)
  - Riwayat perubahan identitas + pengguna + waktu + verifikator ✔ (2B)
  - Deteksi duplikasi NIK/ID usaha dengan perlindungan akses ✔ (2B)
  - Hubungan antar-pihak (pasangan/penjamin/UBO) ✔ (2B)
  - Bukti persetujuan pemrosesan data pribadi ✔ (2B)
  - Relasi pengajuan kredit tidak bergantung akun pegawai ✔ (2A)
  - Migrasi data lama dipetakan, divalidasi, diuji ✔ (2A)
  - Data identitas tidak lagi disimpan sebagai catatan bebas ✔ (2A)

## 7. Tahap berikutnya (rekomendasi saja; jangan dikerjakan pada sesi ini)

- **Nomor dan nama tahap:** **Tahap 3 — P0.3 Otorisasi berbasis role, cabang, penugasan, dan Maker-Checker.**
- **Prasyarat:** keputusan atas butir risiko 1 (siapa berhak melihat NIK penuh) dan konfirmasi matriks kewenangan/alur persetujuan (SOP) yang akan ditegakkan.
- **Persetujuan/keputusan yang dibutuhkan:** aturan Maker-Checker (pengaju/analis/pemutus harus akun berbeda) dan batas kewenangan per cabang — ini menyentuh aturan kredit (§8 dokumen instruksi) sehingga butuh persetujuan pemilik proses/compliance.

## Status untuk sesi berikutnya

- Skema selaras, **20 migrasi**, tanpa drift. Entitas `Customer` lengkap dengan riwayat/hubungan/consent; API & UI `/crm/customers` aktif.
- Perintah uji: `npm run verify:customers` (tanpa server) dan `npm run verify:customers:live` (butuh `npm run dev`). Regresi: `npm run verify:auth`.
- Untuk melanjutkan: mulai **Tahap 3** saja. Jangan menyalakan kembali pengiriman data SLIK ke pihak ketiga (Tahap 5) dan jangan mengubah tipe nominal keuangan (Tahap 6).
