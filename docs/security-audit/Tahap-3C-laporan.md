# Laporan Sesi Coding Agent — Tahap 3C (P0.3 cakupan data untuk inventaris, aset, audit, admin, dan notifikasi)

- **Tahap aktif:** Tahap 3 — P0.3, sub-tahap **3C** (lanjutan 3A/3B).
- **Status:** **DONE** untuk ruang lingkup 3C. Dengan selesainya 3A + 3B + 3C, **seluruh modul API utama sudah menerapkan otorisasi cakupan data**, dan **Tahap 3 (P0.3) dinyatakan DONE** (kecuali penanganan mutasi pegawai yang mendalam, yang sudah sebagian dilakukan di 3C).
- **Tujuan sesi:** menutup IDOR/lintas-cabang pada inventaris, aset, audit, master data, dan notifikasi; menegakkan isolasi organisasi pada master data; mencabut sesi saat role/cabang/status pegawai berubah.
- **Tanggal:** 2026-10-13

## 1. Temuan yang diverifikasi sebelum perubahan

| Temuan | Bukti | Keadaan sebelum |
|---|---|---|
| **Kebocoran lintas organisasi pada master data** | `GET /api/admin/master-data` memakai `where = {}` (tanpa `organizationId`); `[id]` memakai `findUnique({ where: { id } })` | TERVERIFIKASI (vulnerability nyata) |
| IDOR pada inventaris & aset | `inventory/items/[id]`, `assets/[id]`, `assets/[id]/assign|maintenance|dispose` memuat record by-id tanpa cakupan cabang | TERVERIFIKASI |
| Daftar inventaris/aset hanya menyaring organisasi | `inventory/items/route.ts`, `assets/route.ts` (termasuk ringkasan) | TERVERIFIKASI |
| Jejak audit hanya disaring organisasi | `audit/route.ts` (`audit.log.view`) tanpa pembatasan cakupan | TERVERIFIKASI |
| Notifikasi dapat dikirim ke pengguna organisasi lain | `notifications/route.ts` `action: "SEND"` tanpa validasi organisasi penerima | TERVERIFIKASI |
| Perubahan role/cabang/penonaktifan tidak langsung mencabut sesi | `users/[id]/route.ts` tidak memperbarui `sessionsValidFrom` | TERVERIFIKASI |

## 2. Perubahan

**Inventaris:** `inventory/items/route.ts` (daftar + validasi cabang saat buat), `inventory/items/[id]/route.ts` (detail/ubah bercakupan cabang).

**Aset:** `assets/route.ts` (daftar + ringkasan bercakupan, validasi cabang & pemegang saat buat), `assets/[id]/route.ts` (detail/ubah), `assets/[id]/assign|maintenance|dispose/route.ts` (mutasi/pemeliharaan/penghapusan bercakupan).

**Audit:** `audit/route.ts` — hanya peran bercakupan **ORGANIZATION** (mis. Admin Operasional, Manajemen, Auditor) yang boleh membaca; pengguna bercakupan cabang ditolak `403 SCOPE_FORBIDDEN`.

**Admin/master data:** `admin/master-data/route.ts` — daftar **disaring `organizationId`** (menutup kebocoran lintas organisasi); `admin/master-data/[id]/route.ts` — PUT/DELETE memverifikasi organisasi record.

**Notifikasi:** `notifications/route.ts` — `action: "SEND"` memvalidasi penerima berada pada organisasi yang sama (`403 SCOPE_FORBIDDEN`).

**Pegawai:** `users/[id]/route.ts` — bila **role berubah, cabang berpindah, atau akun dinonaktifkan**, `sessionsValidFrom` diperbarui sehingga sesi lama dicabut segera (dipadukan dengan revalidasi izin per-permintaan yang sudah ada).

**Pengujian:** `scripts/verify-access.ts` (+8 pemeriksaan → 45) dan `scripts/verify-access-live.ts` (+8 pemeriksaan → 32).

## 3. Migrasi

Tidak ada perubahan skema/migrasi pada 3C. Skema tetap **20 migrasi**, tanpa drift.

## 4. Pengujian

| Perintah | Hasil aktual |
|---|---|
| `npm run verify:access` | **45/45 lulus** — termasuk cakupan inventaris & aset (barang/aset cabang B tidak terlihat oleh pengguna cabang A, terlihat oleh ORGANIZATION) dan penjaga sumber (inventaris/aset memakai `buildScopeFilter`; audit menuntut cakupan organisasi; master data menyaring organisasi; perubahan role/cabang/nonaktif mencabut sesi). |
| `npm run verify:access:live` (dev server) | **32/32 lulus** — 3A (15) + 3B (9) + 3C (8): daftar & detail **inventaris** dan **aset** lintas cabang terisolasi (404); **audit → 403 `SCOPE_FORBIDDEN`** untuk pengguna cabang; **master data tidak memuat item organisasi lain**; **kirim notifikasi lintas organisasi → 403**. Data uji (2 organisasi, cabang, nasabah, pengajuan, tugas, PR, inventaris, aset, master data, akun, peran, audit) dihapus. |
| Regresi `npm run verify:customers` / `:live` | **52/52** dan **33/33** lulus. |
| Regresi `npm run verify:auth` / `verify:mfa` | **38/38** dan **57/57** lulus. |
| `npx eslint --quiet` berkas 3C | **0 error**. |
| `npx tsc --noEmit` | **37** — turun dari 53 (tipe `whereClause` diperbaiki), tanpa error baru. |
| `npm run build` | Sukses. |

**Pengujian yang belum dijalankan dan alasannya:** uji dokumen/unduh (Tahap 4); uji beban; uji klik-untuk-klik peramban.

## 5. Inventaris status cakupan (akhir Tahap 3)

**Bercakupan penuh (3A–3C):** kredit, tugas lapangan, CRM nasabah & prospek, laporan/ekspor, pengadaan (PR/PO/penerimaan), inventaris, aset, audit, admin master data, notifikasi (organisasi penerima), dan pengelolaan pengguna.

**Bukan data bercabang (tidak perlu cakupan cabang):** `purchasing/vendors` dan `admin/roles`/`admin/permissions` adalah data master tingkat organisasi/global; tetap dilindungi izin.

**Diserahkan ke Tahap 4 (P0.4):** dokumen & endpoint berkas `/uploads/*` — **masih dapat diakses tanpa sesi**; ini risiko yang wajib ditutup pada Tahap 4 dan **jangan dipakai dengan data nyata sebelum itu**.

## 6. Risiko atau keputusan yang masih diperlukan

1. **Pemetaan peran→cakupan** tetap baseline teknis (lihat 3A) — wajib dikonfirmasi pemilik proses/compliance; dapat diubah via env.
2. **Audit dibatasi ke cakupan ORGANIZATION**; bila kelak ada auditor cabang, perlu pemetaan peran tersendiri.
3. **Dokumen/unduh masih publik** — risiko kritis, ditangani Tahap 4.
4. **Mutasi pegawai:** pencabutan sesi saat role/cabang/nonaktif sudah ditambahkan; verifikasi perilaku lintas-instance & runbook operasional menyusul di Tahap 13.
5. Temuan lama: `next@16.4.0`, `.env.example` diabaikan git, status sesi saat sandi diganti.

## 7. Tahap selesai

- **Tahap 3C: DONE.**
- **Tahap 3 (P0.3): DONE** — seluruh tugas terpenuhi: otorisasi role/organisasi/cabang/departemen/penugasan diterapkan di server untuk modul-modul utama; Maker-Checker kredit & pengadaan diterapkan; ekspor/unduh sensitif dibatasi izin (ekspor laporan); IDOR & akses lintas cabang ditutup pada modul kredit, tugas lapangan, CRM, pengadaan, inventaris, aset, audit, master data, notifikasi; mutasi pegawai/perubahan role/nonaktif mencabut sesi; uji negatif lintas role/cabang/penugasan tersedia.

## 8. Tahap berikutnya (rekomendasi saja; jangan dikerjakan pada sesi ini)

- **Nomor dan nama tahap:** **Tahap 4 — P0.4 Penyimpanan dokumen privat dan endpoint akses.**
- **Prasyarat:** keputusan penyimpanan privat (folder privat/object storage) dan endpoint unduh ber-otorisasi.
- **Persetujuan/keputusan yang dibutuhkan:** infrastruktur penyimpanan & kebijakan retensi dokumen; pembersihan berkas sensitif yang sudah masuk riwayat git.

## Status untuk sesi berikutnya

- Tanpa perubahan skema (20 migrasi, tanpa drift). Lapisan cakupan `src/lib/access-scope.ts` dipakai di seluruh modul utama.
- Perintah uji: `npm run verify:access` (tanpa server) dan `npm run verify:access:live` (butuh `npm run dev`). Regresi: `verify:customers`, `verify:auth`, `verify:mfa`.
- **Prioritas:** Tahap 4 (dokumen/unduh publik) sebaiknya didahulukan karena menyangkut akses berkas tanpa autentikasi. Jangan mengubah tipe nominal (Tahap 6) dan jangan menyalakan pengiriman SLIK ke pihak ketiga (Tahap 5).
