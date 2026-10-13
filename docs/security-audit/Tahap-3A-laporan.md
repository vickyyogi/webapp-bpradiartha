# Laporan Sesi Coding Agent — Tahap 3A (P0.3 otorisasi cakupan data & Maker-Checker pada modul kredit)

- **Tahap aktif:** Tahap 3 — P0.3. Dikerjakan sebagai **sub-tahap 3A** sesuai §D dokumen instruksi (Tahap 3 terlalu besar untuk satu sesi: mencakup seluruh route API, ekspor/unduh sensitif, dan penanganan mutasi pegawai).
- **Status:** **PARTIAL** — fondasi otorisasi cakupan data, perbaikan IDOR/lintas-cabang modul **kredit + tugas lapangan**, dan pemisahan tugas (Maker-Checker) kredit sudah **DONE dan teruji**. Modul lain (dokumen/unduh, ekspor/laporan, pembelian, inventaris, aset, CRM nasabah, admin) serta pencabutan akses saat mutasi pegawai menjadi **3B/3C**.
- **Tujuan sesi:** (a) menegakkan otorisasi server berdasarkan role + organisasi + cabang + penugasan; (b) menutup IDOR akses lintas cabang pada modul kredit dan tugas lapangan; (c) menerapkan pemisahan tugas agar pemutus kredit bukan pengaju/analis/surveyor yang sama; (d) menyediakan uji negatif lintas role, cabang, dan penugasan.
- **Tanggal:** 2026-10-13

## 1. Temuan yang diverifikasi sebelum perubahan

| Temuan | Bukti | Keadaan sebelum |
|---|---|---|
| **Kebocoran lintas cabang (IDOR)** pada detail/ubah/hapus pengajuan kredit | `src/app/api/credit/applications/[id]/route.ts` memakai `findUnique({ where: { id } })` tanpa cakupan | TERVERIFIKASI |
| **Kebocoran lintas cabang pada SSR** | `src/app/(dashboard)/credit/applications/[id]/page.tsx` memuat by-id tanpa cakupan; daftar & dasbor hanya menyaring `organizationId` | TERVERIFIKASI |
| **Bypass izin** pada daftar pengajuan | `GET /api/credit/applications` — bila sesi ada tetapi izin kurang, respons `authCheck` tidak dikembalikan sehingga daftar tetap terbaca | TERVERIFIKASI |
| **IDOR pada tugas lapangan** | `src/app/api/field/tasks/[id]/route.ts` GET/PUT/DELETE by-id tanpa cakupan | TERVERIFIKASI |
| **Belum ada pemisahan tugas** | keputusan kredit (`APPROVED`/`REJECTED`) tidak memeriksa apakah pemutus = pengaju/analis/surveyor | TERVERIFIKASI |
| Belum ada lapisan cakupan (BRANCH/ASSIGNED) yang dapat dipakai bersama | `permissions.ts` hanya memeriksa kode izin | TERVERIFIKASI |
| `docs/ROLE_PERMISSION_MATRIX.md` §7 mendefinisikan cakupan GLOBAL/ORGANIZATION/BRANCH/DEPARTMENT/OWN/ASSIGNED dan menyatakan pemetaan akhir harus dikonfirmasi BPR | dokumen | TERVERIFIKASI |

## 2. Perubahan

**Berkas baru:**
- `src/lib/access-scope.ts` — lapisan cakupan data: `resolveScopeLevel`, `buildScopeFilter`, `recordInScope`, `isBranchAllowed`, `toScopeUser`, `violatesSegregationOfDuties`. Pemetaan peran→cakupan **dapat dikonfigurasi** lewat `ACCESS_ORG_WIDE_ROLE_CODES` (default `ADMIN,DIRECTOR,MANAGEMENT,AUDITOR,ADMIN_OPERASIONAL`) dan `ACCESS_ASSIGNED_ROLE_CODES` (default `FIELD_OFFICER`); peran lain bercakupan BRANCH (cabang sendiri + penugasan sendiri).
- `scripts/verify-access.ts` (30 pemeriksaan) dan `scripts/verify-access-live.ts` (15 pemeriksaan HTTP).

**Berkas diubah:**
- `src/app/api/credit/applications/route.ts` — GET: **memperbaiki bypass izin** (selalu mengembalikan respons saat tidak berizin) dan menerapkan filter cakupan; POST: menolak pembuatan di cabang luar jangkauan (`BRANCH_FORBIDDEN`) dan menolak penugasan petugas di luar cabang (`ASSIGNEE_FORBIDDEN`).
- `src/app/api/credit/applications/[id]/route.ts` — GET/PUT/DELETE memakai `buildScopeFilter` (404 bila di luar cakupan, tidak membocorkan keberadaan); PUT menegakkan **pemisahan tugas** (`SEGREGATION_OF_DUTIES`) untuk status APPROVED/REJECTED dan validasi cabang/penugasan; `updateData` kini bertipe Prisma (menghapus error tipe lama).
- `src/app/(dashboard)/credit/applications/page.tsx`, `[id]/page.tsx`, `src/app/(dashboard)/credit/page.tsx` — daftar, detail, dan dasbor memakai cakupan yang sama (menutup IDOR pada SSR).
- `src/app/api/field/tasks/route.ts`, `[id]/route.ts` — cakupan cabang + penugasan pada daftar/detail/ubah/hapus, validasi cabang & petugas.
- `src/app/(dashboard)/field/tasks/page.tsx` — daftar tugas, petugas, dan cabang dibatasi cakupan.
- `package.json` — script `verify:access`, `verify:access:live`.

## 3. Migrasi

Tidak ada perubahan skema atau migrasi pada 3A (murni lapisan otorisasi + kode). Skema tetap 20 migrasi tanpa drift.

## 4. Pengujian

| Perintah | Hasil aktual |
|---|---|
| `npm run verify:access` | **30/30 lulus** — penentu cakupan (ADMIN→ORGANIZATION, MARKETING→BRANCH, FIELD_OFFICER→ASSIGNED, tanpa cabang→filter mustahil); filter BRANCH memuat cabang+penugasan; filter ASSIGNED hanya penugasan; `recordInScope`/`isBranchAllowed` menolak cabang/organisasi lain; pemisahan tugas mendeteksi pemutus = pengaju/analis. **Integrasi DB**: pengguna cabang A tidak melihat/menemukan pengajuan cabang B (termasuk akses langsung by-id), pengguna ORGANIZATION melihatnya, pengguna ASSIGNED tidak melihat yang bukan tugasnya. Penjaga sumber memastikan route & halaman memakai `buildScopeFilter`/SoD. |
| `npm run verify:access:live` (dev server) | **15/15 lulus** — daftar kredit terisolasi per cabang; GET/PUT/DELETE lintas cabang → **404**; pengguna ORG → 200; POST ke cabang lain → **403**; pengguna tanpa izin → **403**; daftar & detail tugas lapangan terisolasi; **persetujuan mandiri ditolak 403 dengan kode `SEGREGATION_OF_DUTIES`**. Data uji (cabang, nasabah, pengajuan, tugas, akun, peran, audit) dihapus. |
| Regresi `npm run verify:customers` | **52/52 lulus**. |
| Regresi `npm run verify:customers:live` (dev server) | **33/33 lulus** — alur pengajuan kredit 2A/2B tidak regresi. |
| Regresi `npm run verify:auth` / `verify:mfa` | **38/38** dan **57/57** lulus. |
| `npx eslint --quiet` berkas 3A | **0 error**. |
| `npx tsc --noEmit` | **71** — turun dari baseline 113 (tipe `updateData` diperbaiki), tanpa error baru. |
| `npm run build` | Sukses. |

**Pengujian yang belum dijalankan dan alasannya:** uji lintas cabang pada modul di luar kredit/tugas lapangan (belum diubah — 3B); uji beban; uji mutasi pegawai (3C).

## 5. Inventaris route & status (audit 3A)

**Diperbaiki pada 3A (cakupan + IDOR):** `credit/applications` (GET/POST), `credit/applications/[id]` (GET/PUT/DELETE), `field/tasks` (GET/POST), `field/tasks/[id]` (GET/PUT/DELETE), plus SSR `credit/applications`, `credit/applications/[id]`, `credit` (dasbor), `field/tasks`.

**Belum diperbaiki — menjadi 3B** (masih menyaring organisasi saja / by-id tanpa cakupan cabang): `users`, `users/[id]`, `documents`, `documents/[id]`, `reports` (termasuk ekspor CSV), `audit`, `notifications`, `purchasing/*`, `inventory/*`, `assets/*`, `cms/*`, `crm/leads`, `crm/customers/[id]` (dan sub-route nasabah), `admin/*`. Ekspor/unduh data sensitif dan pembatasan unduhan dokumen juga di 3B.

## 6. Risiko atau keputusan yang masih diperlukan

1. **Pemetaan peran → cakupan adalah baseline teknis, bukan kebijakan final.** Default saat ini: ORGANIZATION untuk `ADMIN/DIRECTOR/MANAGEMENT/AUDITOR/ADMIN_OPERASIONAL`; ASSIGNED untuk `FIELD_OFFICER`; sisanya BRANCH. **Wajib dikonfirmasi pemilik proses/compliance** (§7 ROLE_PERMISSION_MATRIX, §8 dokumen instruksi). Dapat diubah tanpa mengubah kode lewat environment variable.
2. **Pemisahan tugas kredit** saat ini memakai proksi "pengaju = marketing officer penugasan, analis, surveyor". Skema belum menyimpan `createdById` pada pengajuan, sehingga pengaju tidak dapat diperiksa secara langsung; penambahan kolom pengaju dapat dipertimbangkan di 3B/3C.
3. **Kewenangan approval** tetap memakai `CreditApprovalLimit` (belum berubah); Maker-Checker penuh (mis. kuorum komite) tetap ruang lingkup SOP yang perlu disahkan.
4. **Akses lintas cabang pada modul lain masih terbuka** (lihat §5) — **belum aman untuk produksi** sampai 3B selesai.
5. **Penonaktifan/mutasi pegawai:** pencabutan sesi saat akun dinonaktifkan sudah ada (Tahap 1A), tetapi penyesuaian cakupan saat perpindahan cabang/perubahan role dan audit-nya belum menyeluruh → **3C**.
6. **`credit.application.view` pada GET daftar dulu bisa dilewati oleh pengguna ber-sesi tanpa izin** — sudah diperbaiki; pola serupa perlu diperiksa pada route lain di 3B.
7. Temuan lama yang masih menunggu keputusan: `next@16.4.0`, `.env.example` yang diabaikan git, status sesi saat sandi diganti (Tahap 1).

## 7. Tahap selesai

- **Tahap 3A: DONE.** Tahap 3 induk **belum DONE** (3B/3C tersisa).

## 8. Tahap berikutnya (rekomendasi saja; jangan dikerjakan pada sesi ini)

- **Nomor dan nama tahap:** **Tahap 3B — P0.3 lanjutan**: terapkan cakupan pada seluruh route/modul yang tersisa (dokumen & unduh, ekspor/laporan, pembelian, inventaris, aset, CRM nasabah, admin, notifikasi, audit) dan batasi ekspor/unduh data sensitif menurut hak akses.
- **Prasyarat:** konfirmasi pemetaan peran→cakupan (§6 butir 1).
- **Persetujuan/keputusan yang dibutuhkan:** siapa yang boleh mengekspor/mengunduh data sensitif; perlu tidaknya kolom pengaju pada pengajuan kredit.

## Status untuk sesi berikutnya

- Tidak ada perubahan skema (tetap 20 migrasi, tanpa drift). Lapisan cakupan `src/lib/access-scope.ts` siap dipakai ulang modul lain.
- Perintah uji: `npm run verify:access` (tanpa server) dan `npm run verify:access:live` (butuh `npm run dev`). Regresi: `npm run verify:customers`, `verify:auth`, `verify:mfa`.
- Untuk melanjutkan: mulai **Tahap 3B** saja. Jangan menyalakan kembali pengiriman data SLIK ke pihak ketiga (Tahap 5) dan jangan mengubah tipe nominal (Tahap 6).
