# Laporan Sesi Coding Agent — Tahap 10 (P1.2 Manajemen agunan)

- **Tahap aktif:** Tahap 10 — P1.2.
- **Status:** **DONE** untuk ruang lingkup teknis: entitas agunan, relasi nasabah/pengajuan, taksasi + riwayat, pengikatan, asuransi, lokasi, pengingat, API, UI, izin, audit, migrasi.
- **Tujuan sesi:** agunan menjadi entitas tersendiri dengan data kepemilikan, penilaian, pengikatan hukum, asuransi, serta pengingat tenggat.
- **Tanggal:** 2026-10-21

## Ringkasan hasil

- Model `CreditCollateral` + `CollateralAppraisal` ditambahkan, berelasi ke `Customer`, `CreditApplication` (opsional), `Branch`, dan `User`.
- Jenis agunan, pengikatan, dan metode penilaian berupa teks bebas karena daftar resmi belum ditetapkan SOP.
- Riwayat taksasi tidak ditimpa; record baru ditambahkan saat agunan dibuat atau opsi “simpan sebagai riwayat” dipilih.
- API CRUD dengan izin `credit.collateral.view/create/update/delete`, validasi nasabah/pengajuan satu organisasi, dan cakupan cabang.
- Halaman `/credit/collaterals`: daftar, pencarian, filter status, filter “Perlu Tindakan”, form lengkap, dan penghapusan teraudit.
- Pengingat in-app: taksasi ulang, pengikatan kedaluwarsa, asuransi kedaluwarsa (≤30 hari / sudah lewat).
- Navigasi “Agunan & Jaminan” ditambahkan pada menu Kredit.
- Permission ditambahkan ke katalog seed dan peran operasional terkait.
- Audit create/update/delete; create/update + riwayat taksasi dalam satu transaksi.

## File yang diperiksa

- `prisma/schema.prisma` (CreditApplication, Customer, Branch, User, Organization)
- `src/lib/access-scope.ts`, `src/lib/permissions.ts`, `src/lib/audit.ts`
- `src/app/api/credit/applications/route.ts` (bentuk data pengajuan/nasabah)
- `src/lib/navigation.ts`, layout dashboard
- Pola UI `src/app/(dashboard)/inventory/assets/page.tsx`, `src/app/(dashboard)/reports/page.tsx`

## File yang diubah/ditambah

- `prisma/schema.prisma` — enum `CollateralStatus`, model `CreditCollateral`, `CollateralAppraisal`, relasi balik.
- `prisma/migrations/20261021100000_tahap_10_manajemen_agunan/migration.sql` — enum, 2 tabel, index, FK.
- `prisma/seed.ts` — katalog permission agunan + penugasan peran.
- `src/lib/collateral.ts` — parsing/validasi payload, `daysUntil`, `reminderLevel`.
- `src/app/api/credit/collaterals/route.ts` — daftar + create + pengingat.
- `src/app/api/credit/collaterals/[id]/route.ts` — detail, update, delete.
- `src/app/(dashboard)/credit/collaterals/page.tsx` — UI manajemen agunan.
- `src/lib/navigation.ts` — menu dan penjaga rute.
- `scripts/verify-collateral.ts` + `package.json` — verifikasi.
- `docs/COLLATERAL_MANAGEMENT.md` — dokumentasi model, API, aturan, batas.

## Migrasi dan risiko data

- Migrasi baru: `20261021100000_tahap_10_manajemen_agunan`. Perubahan aditif (enum + 2 tabel + index/FK); tidak ada kolom lama diubah/dihapus.
- Rollback: hapus tabel `collateral_appraisals`, `credit_collaterals`, lalu enum `CollateralStatus`. Tidak ada data lama yang hilang.
- **Catatan lingkungan:** database lokal tidak memiliki tabel `_prisma_migrations`, sehingga `prisma migrate deploy` menolak dengan **P3005** (schema non-empty tanpa baseline). Migrasi diterapkan ke database lokal via `prisma db execute --file ...`. Untuk deployment baru/produksi, baseline database yang sudah ada terlebih dahulu lalu jalankan `prisma migrate deploy`.
- Seed permission belum dijalankan ulang karena seed mereset sandi `admin@bpr.com` dan mencabut sesi (perilaku terdokumentasi sejak Tahap 1A). Katalog permission di `prisma/seed.ts` sudah diperbarui; jalankan seed setelah disetujui.

## Pengujian

| Perintah | Hasil aktual |
|---|---|
| `npm run verify:collateral` | **36/36 lulus** — validasi payload, pembulatan nominal, status, tanggal/pengingat, 18 kolom tabel, tipe `numeric`, tabel riwayat. |
| `npm run verify:navigation` | **26/26 lulus**. |
| `npm run verify:access` | **45/45 lulus**. |
| `npm run verify:audit` | **3/3 lulus**. |
| `npx prisma validate` | Skema valid. |
| `npx tsc --noEmit` | **31 error**, seluruhnya baseline modul aset/CMS/inventaris/purchasing/`useInView`; **0 error** pada berkas Tahap 10. |
| `npx eslint --quiet` berkas Tahap 10 | **0 error**. |
| `npm run build` | Kompilasi sukses; berhenti di TypeScript check karena 31 error baseline. |

Belum dijalankan: uji browser klik-untuk-klik, uji CRUD end-to-end dengan sesi login, dan uji beban daftar agunan besar.

## Risiko atau keputusan yang masih diperlukan

1. **Daftar resmi jenis agunan/pengikatan/metode penilaian** harus ditetapkan pemilik proses; sementara berupa teks bebas.
2. **Kebijakan nilai dan penilai** (internal/eksternal, NJOP vs pasar, frekuensi taksasi ulang) perlu SOP; aplikasi hanya mencatat.
3. **Dokumen agunan** belum otomatis terhubung ke `Document` (tipe `COLLATERAL_DOC` sudah ada); perlu keputusan alur unggah dan retensi.
4. **Hapus agunan bersifat hard delete** dengan izin khusus + audit. Bila compliance menghendaki soft delete/pelepasan, ubah menjadi `RELEASED`.
5. **Pengingat hanya in-app**; email/WhatsApp menunggu Phase 7.
6. **Cakupan berbasis cabang** untuk agunan; agunan lintas cabang atau penugasan khusus belum didukung.
7. Seed permission harus dijalankan agar peran non-admin menerima izin agunan.

## Tahap selesai

- Entitas agunan + relasi nasabah/pengajuan: **DONE**
- Bukti kepemilikan, pemilik legal, hubungan debitur: **DONE**
- Taksasi + riwayat penilaian: **DONE**
- Pengikatan hukum, asuransi, lokasi fisik: **DONE**
- Pengingat penilaian ulang & dokumen kedaluwarsa: **DONE (in-app)**
- API/UI/izin/audit/migrasi: **DONE**

## Tahap berikutnya (rekomendasi saja; jangan dikerjakan pada sesi ini)

- **Nomor dan nama tahap:** **Tahap 11 — P1.3 Pemantauan pascapencairan.**
- **Prasyarat:** definisi tindak lanjut pascapencairan, jatuh tempo, dan eskalasi penagihan dari pemilik proses.
- **Catatan:** jangan membangun sinkronisasi CBS otomatis sebelum kontrak/akses resmi tersedia.
