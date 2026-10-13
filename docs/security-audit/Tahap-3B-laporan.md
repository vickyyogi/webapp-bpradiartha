# Laporan Sesi Coding Agent — Tahap 3B (P0.3 cakupan data untuk CRM, laporan/ekspor, dan pengadaan)

- **Tahap aktif:** Tahap 3 — P0.3, sub-tahap **3B** (lanjutan 3A).
- **Status:** **PARTIAL** — cakupan cabang/penugasan untuk **CRM (nasabah & prospek)**, **pelaporan/ekspor**, dan **pengadaan** (termasuk Maker-Checker pengadaan) sudah **DONE dan teruji**. Modul inventaris, aset, admin, notifikasi, audit, dan dokumen/unduh serta penanganan mutasi pegawai menjadi **3C/3D**.
- **Tujuan sesi:** memperluas otorisasi cakupan data ke modul yang tersisa yang paling sensitif; membatasi ekspor data sensitif menurut hak akses; mencegah persetujuan mandiri pada pengadaan.
- **Tanggal:** 2026-10-13

## 1. Temuan yang diverifikasi sebelum perubahan

| Temuan | Bukti | Keadaan sebelum |
|---|---|---|
| CRM nasabah & prospek hanya menyaring organisasi | `src/app/api/crm/customers/*`, `crm/leads/*`, `src/app/(dashboard)/crm/**` | TERVERIFIKASI |
| Ekspor CSV laporan hanya butuh `report.management.view` | `src/app/api/reports/route.ts` (`format=csv`) | TERVERIFIKASI |
| Laporan mengambil seluruh organisasi tanpa cakupan cabang | query `where: { organizationId }` untuk kredit/tugas/PR/PO/inventaris/aset | TERVERIFIKASI |
| IDOR pada pengadaan | `purchasing/requests/[id]`, `purchasing/orders/[id]` by-id tanpa cakupan | TERVERIFIKASI |
| Tidak ada pemisahan tugas pada persetujuan pengadaan | `purchasing/requests/[id]/workflow` tidak memeriksa pengaju | TERVERIFIKASI |
| Endpoint berkas `/uploads/*` tanpa pemeriksaan sesi (temuan lama) | `src/app/uploads/[...path]/route.ts` + allowlist `src/proxy.ts` | TERVERIFIKASI — diserahkan ke **Tahap 4 (P0.4)** |

## 2. Perubahan

**CRM nasabah (PII):**
- `src/app/api/crm/customers/route.ts` — GET daftar memakai cakupan; POST memvalidasi cabang (`BRANCH_FORBIDDEN`) dan memakai cakupan pada pemeriksaan duplikat.
- `[id]/route.ts`, `[id]/verify/route.ts`, `[id]/relationships/route.ts`, `[id]/relationships/[relationshipId]/route.ts`, `[id]/consents/route.ts` — seluruh akses record memakai `buildScopeFilter` (404 bila di luar cakupan).
- `duplicates/route.ts` — hasil duplikat dibatasi cakupan.
- `crm/leads/route.ts`, `crm/leads/[id]/route.ts` — cakupan cabang/penugasan + validasi cabang/petugas.
- Halaman SSR `crm/customers/page.tsx`, `crm/customers/[id]/page.tsx`, `crm/page.tsx` — cakupan pada daftar/detail/ringkasan.
- `src/lib/customer.ts` — `findDuplicateCandidates` menerima `extraWhere` (digabung dengan `AND` agar tidak menimpa cakupan).

**Laporan/ekspor:**
- `src/app/api/reports/route.ts` — ekspor CSV menuntut izin `report.management.export` (JSON tetap `report.management.view`); seluruh kueri (kredit, tugas lapangan, PR, PO, inventaris, aset) memakai cakupan organisasi/cabang/penugasan.

**Pengadaan:**
- `purchasing/requests/route.ts`, `purchasing/requests/[id]/route.ts` — cakupan pada daftar, ringkasan, dan detail.
- `purchasing/requests/[id]/workflow/route.ts` — cakupan + **Maker-Checker**: pengaju tidak boleh menyetujui pengajuannya sendiri (`SEGREGATION_OF_DUTIES`).
- `purchasing/orders/route.ts`, `purchasing/orders/[id]/route.ts` — cakupan pada daftar, ringkasan, detail.
- `purchasing/receipts/route.ts` — cakupan pada daftar dan pencarian PO saat penerimaan.

**Lain-lain:** `scripts/verify-access.ts` (+7 pemeriksaan) dan `scripts/verify-access-live.ts` (+9 pemeriksaan) diperluas untuk 3B.

## 3. Migrasi

Tidak ada perubahan skema/migrasi pada 3B. Skema tetap **20 migrasi**, tanpa drift.

## 4. Pengujian

| Perintah | Hasil aktual |
|---|---|
| `npm run verify:access` | **37/37 lulus** — termasuk: cakupan nasabah (cabang A tidak melihat nasabah cabang B, ORGANIZATION melihatnya), dan penjaga sumber (CRM nasabah/leads, laporan memakai `buildScopeFilter`; ekspor menuntut `report.management.export`; workflow pengadaan memakai `violatesSegregationOfDuties`). |
| `npm run verify:access:live` (dev server) | **24/24 lulus** — 3A (15) + 3B (9): daftar & detail **nasabah** lintas cabang terisolasi (404); laporan JSON 200 untuk pemilik `view`; **ekspor CSV tanpa izin ekspor → 403**; daftar & detail **PR** lintas cabang terisolasi; **persetujuan mandiri pengadaan → 403 `SEGREGATION_OF_DUTIES`**. Data uji (cabang, nasabah, pengajuan, tugas, PR, akun, peran, audit) dihapus. |
| Regresi `npm run verify:customers` / `:live` | **52/52** dan **33/33** lulus. |
| Regresi `npm run verify:auth` / `verify:mfa` | **38/38** dan **57/57** lulus. |
| `npx eslint --quiet` berkas 3B | **0 error**. |
| `npx tsc --noEmit` | **53** — turun dari 71 (tipe `whereClause`/`updateData` pada route pengadaan & leads diperbaiki), tanpa error baru. |
| `npm run build` | Sukses. |

**Pengujian yang belum dijalankan dan alasannya:** uji lintas cabang modul inventaris/aset/admin/notifikasi/audit (belum diubah — 3C); uji dokumen/unduh (Tahap 4); uji mutasi pegawai (3D).

## 5. Inventaris status cakupan (per modul)

**Bercakupan (3A+3B):** kredit (pengajuan + SSR), tugas lapangan (API + SSR), CRM nasabah & prospek (API + SSR), laporan/ekspor, pengadaan (PR/PO/penerimaan).

**Belum bercakupan → 3C:** `inventory/*`, `assets/*`, `admin/*` (users/roles/master-data), `notifications`, `audit`, `purchasing/vendors` (master data organisasi), dan halaman SSR terkait. **Dokumen & endpoint unduh `/uploads/*` → Tahap 4 (P0.4)** — saat ini berkas di bawah `/uploads/documents` masih dapat diakses tanpa sesi; ini risiko yang **wajib ditutup pada Tahap 4**.

## 6. Risiko atau keputusan yang masih diperlukan

1. **Pemetaan peran→cakupan** tetap baseline teknis (lihat 3A) — wajib dikonfirmasi pemilik proses/compliance; dapat diubah via env.
2. **Ekspor CSV** kini butuh `report.management.export`; kebijakan siapa yang berhak mengekspor data sensitif perlu disahkan.
3. **Pemisahan tugas pengadaan** memakai `requesterId`; alur multi-level workflow lain (mis. pembuat PO) belum diperiksa → 3C.
4. **Dokumen/unduh masih publik** (temuan kritis) — ditangani Tahap 4, bukan ditunda tanpa batas; jangan gunakan dengan data nyata sebelum Tahap 4.
5. **Mutasi pegawai/perpindahan cabang/perubahan role** belum menyeluruh → 3D.
6. Temuan lama: `next@16.4.0`, `.env.example` diabaikan git, status sesi saat sandi diganti.

## 7. Tahap selesai

- **Tahap 3B: PARTIAL→ DONE untuk ruang lingkup yang dipilih** (CRM + laporan/ekspor + pengadaan). Tahap 3 induk **belum DONE** (3C/3D tersisa).

## 8. Tahap berikutnya (rekomendasi saja; jangan dikerjakan pada sesi ini)

- **Nomor dan nama tahap:** **Tahap 3C — P0.3 penutup**: terapkan cakupan pada inventaris, aset, admin (users/roles/master-data), notifikasi, dan audit; plus pemeriksaan IDOR sisa.
- **Prasyarat:** konfirmasi pemetaan peran→cakupan (§6 butir 1).
- **Persetujuan/keputusan yang dibutuhkan:** kebijakan ekspor/unduh data sensitif; kebutuhan kolom pengaju.

## Status untuk sesi berikutnya

- Tidak ada perubahan skema (20 migrasi, tanpa drift). `src/lib/access-scope.ts` + `findDuplicateCandidates(extraWhere)` siap dipakai modul lain.
- Perintah uji: `npm run verify:access` (tanpa server) dan `npm run verify:access:live` (butuh `npm run dev`). Regresi: `verify:customers`, `verify:auth`, `verify:mfa`.
- Untuk melanjutkan: mulai **Tahap 3C** saja (atau **Tahap 4** untuk dokumen/unduh bila prioritas Anda adalah menutup akses berkas publik). Jangan mengubah tipe nominal (Tahap 6) dan jangan menyalakan pengiriman SLIK ke pihak ketiga (Tahap 5).
