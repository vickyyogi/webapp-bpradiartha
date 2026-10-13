# Laporan Sesi Coding Agent — Tahap 4 (P0.4 Penyimpanan dokumen privat & endpoint akses)

- **Tahap aktif:** Tahap 4 — P0.4.
- **Status:** **DONE.**
- **Tujuan sesi:** dokumen sensitif tidak dapat diakses tanpa autentikasi + otorisasi; berkas pindah dari `public/` ke penyimpanan privat di luar web root; seluruh unduhan melewati endpoint berotorisasi dan tercatat di audit log; berkas divalidasi dengan magic bytes; migrasi berkas lama diverifikasi sebelum berkas publik dihapus.
- **Tanggal:** 2026-10-13

## 1. Temuan yang diverifikasi sebelum perubahan

| Temuan | Bukti | Keadaan sebelum |
|---|---|---|
| Berkas dokumen disimpan di **folder publik** `public/uploads/documents/*` | `src/app/api/documents/route.ts` (POST), `src/app/api/credit/applications/route.ts` (KTP) | TERVERIFIKASI |
| `/uploads/*` **dibebaskan dari seluruh pemeriksaan sesi** | `src/proxy.ts` baris allowlist `path.startsWith("/uploads")` | TERVERIFIKASI |
| Rute `/uploads/[...path]` menyajikan berkas apa pun di bawah `public/uploads` tanpa autentikasi, dan `path.basename("..") = ".."` berpotensi lolos dari blokir traversal | `src/app/uploads/[...path]/route.ts` | TERVERIFIKASI |
| Unduhan tidak ber-otorisasi: UI memakai `href={doc.filePath}` yang menunjuk URL publik permanen | `DocumentsClientView.tsx`, `CreditApplicationDetailClientView.tsx` | TERVERIFIKASI |
| `GET/DELETE /api/documents/:id` tidak memeriksa **organisasi** record (IDOR metadata) | `src/app/api/documents/[id]/route.ts` | TERVERIFIKASI |
| Unggah hanya mempercayai ekstensi/Content-Type klien; tidak ada pemeriksaan signature | `src/app/api/documents/route.ts` | TERVERIFIKASI |
| KTP pengajuan kredit disimpan sebagai **base64 di database** (`filePath: ktpDocument.fileData`) tanpa validasi ukuran/tipe di server | `src/app/api/credit/applications/route.ts` | TERVERIFIKASI |
| `DELETE` menghapus baris database tetapi **meninggalkan berkas fisik** | `src/app/api/documents/[id]/route.ts` | TERVERIFIKASI |
| Tidak ada log akses/unduhan dokumen | `audit_logs` tidak pernah menerima aksi `UPLOAD/DOWNLOAD/DELETE` untuk `DOCUMENT` | TERVERIFIKASI |
| Daftar dokumen halaman detail pengajuan tidak dibatasi organisasi | `credit/applications/[id]/page.tsx` (`where: { ownerType, ownerId }`) | TERVERIFIKASI |
| 2 berkas `.jpeg` (foto KTP) ter-commit di git dan berada di `public/uploads/documents/` **tanpa record database** (yatim) | `git ls-files public/uploads` | TERVERIFIKASI |
| 3 record dokumen seed menunjuk `/uploads/documents/*.pdf` yang **tidak pernah ada** (unduhan selalu 404) | `prisma/seed.ts` + isi database | TERVERIFIKASI |

## 2. Perubahan

**Berkas baru:**

- `src/lib/document-storage.ts` — inti Tahap 4: akar penyimpanan privat (`PRIVATE_DOCUMENT_DIR`, default `storage/private/documents`), pola kunci anti-traversal (`KEY_PATTERN`), `savePrivateDocument`/`readPrivateDocument`/`deletePrivateDocument` (+ SHA-256), validasi magic bytes (`sniffDocumentType`, `validateDocumentUpload`, batas 10MB), parser referensi (`parseDocumentRef`: `private:` / `data:` / `/uploads/...`), `readDocumentBytes`, header `Content-Disposition` aman, dan DTO `toDocumentDto` (mengganti `filePath` dengan `downloadUrl`).
- `src/lib/document-access.ts` — otorisasi akses dokumen: `evaluateDocumentAccess` (organisasi → pengunggah → cakupan ORGANIZATION → cakupan record induk per jenis pemilik) dan `canAttachDocumentTo` (mencegah lampiran silang cabang saat unggah).
- `src/app/api/documents/[id]/download/route.ts` — endpoint unduh: sesi → `document.download` → cakupan → baca dari penyimpanan privat → tipe dari isi berkas → `inline` hanya untuk gambar/PDF, selain itu `attachment` + `application/octet-stream` → `Cache-Control: private, no-store` → audit `DOWNLOAD` (metadata saja, tanpa nama berkas/isi).
- `scripts/migrate-private-documents.ts` — migrasi berkas (default dry-run, `--apply` untuk eksekusi) + pemindahan berkas yatim; verifikasi ukuran + SHA-256 sebelum berkas sumber dihapus.
- `scripts/verify-documents.ts` — 66 pemeriksaan (logika, anti-traversal, referensi, header/DTO, baca berkas, penjagaan sumber, kondisi database).
- `scripts/verify-documents-live.ts` — 36 pemeriksaan HTTP (butuh `npm run dev`).
- `docs/DOCUMENT_STORAGE.md` — dokumentasi model penyimpanan/akses & keputusan yang tersisa.

**Berkas diubah:**

- `src/app/api/documents/route.ts` — GET memakai `toDocumentDto` (kunci tidak bocor ke klien); POST: validasi enum pemilik/jenis, cakupan record induk (`403`), badan rusak/kebesaran → `400` (bukan 500), validasi magic bytes, simpan ke penyimpanan privat, audit `UPLOAD`.
- `src/app/api/documents/[id]/route.ts` — `GET`/`DELETE` kini memeriksa organisasi + cakupan (404 bila di luar cakupan), `DELETE` mencatat audit lalu menghapus baris lebih dulu dan berkas fisik setelahnya.
- `src/app/uploads/[...path]/route.ts` — allowlist folder publik (`hero`, `reports`), penolakan segmen traversal + cek kontainer, SVG tidak lagi disajikan sebagai `image/svg+xml`.
- `src/proxy.ts` — penolakan `404` untuk `/uploads/documents/*` **sebelum** pengecualian `/uploads` (pertahanan berlapis; berlaku bahkan sebelum file statis dilayani).
- `src/app/api/credit/applications/route.ts` — KTP divalidasi (ukuran + magic bytes) **sebelum** record dibuat, disimpan ke penyimpanan privat, dan dicatat ke audit; base64 tidak lagi masuk database.
- `src/app/(dashboard)/documents/page.tsx`, `.../[id]/page.tsx` — dokumen dipetakan ke DTO (`downloadUrl`); query daftar dokumen pada detail pengajuan kini dibatasi `organizationId`.
- `DocumentsClientView.tsx`, `CreditApplicationDetailClientView.tsx`, `credit/applications/page.tsx`, `CreditApplicationsClientView.tsx` — tautan memakai `downloadUrl`; tipe `filePath` dihapus dari props klien; teks deskripsi disesuaikan agar tidak menjanjikan hal yang tidak dilakukan.
- `prisma/seed.ts` — contoh dokumen kini ditulis ke penyimpanan privat (PDF minimal yang valid + PNG), dan baris seed lama yang masih menunjuk `/uploads/documents/*` diperbaiki otomatis (idempoten).
- `next.config.ts` — `experimental.proxyClientMaxBodySize: "12mb"` agar unggahan berukuran maksimum (10MB) tidak terpotong buffering body oleh proxy.
- `.env.example` — dokumentasi `PRIVATE_DOCUMENT_DIR` (berkas ini masih di-ignore git — temuan lama).
- `.gitignore` — `/storage/` (berkas dokumen privat tidak boleh masuk version control).
- `package.json` — script `verify:documents`, `verify:documents:live`, `migrate:documents`.

## 3. Migrasi dan risiko data

- **Skema: TIDAK BERUBAH** — tetap 20 migrasi, tanpa drift (`verify:documents` memeriksa jumlah migrasi).
- Migrasi berjalan dalam dua langkah, keduanya terverifikasi:
  1. `npx prisma db seed` — memperbaiki 3 record contoh menjadi referensi `private:` dan menulis berkasnya (idempoten). **Efek samping yang sudah terdokumentasi sejak Tahap 1A:** sandi `admin@bpr.com` disetel ulang sesuai `SEED_ADMIN_PASSWORD` di `.env` dan sesi lama akun itu dicabut.
  2. `npm run migrate:documents -- --apply` — memindahkan **2 berkas yatim** (foto KTP lama tanpa record) dari `public/uploads/documents/` ke penyimpanan privat, dengan verifikasi ukuran + SHA-256 sebelum berkas sumber dihapus. `public/uploads/documents/` kini kosong (0 berkas).
- **Rollback:** kembalikan record ke jalur lama dan salin berkas kembali dari `storage/private/documents/` (data tidak pernah dihapus tanpa verifikasi; tidak ada data yang hilang dalam sesi ini).
- Berkas `public/uploads/documents/*.jpeg` masih ada dalam **riwayat git** — pembersihan memerlukan rewrite sejarah dan **persetujuan pemilik repositori** (tidak dilakukan).
- `git status` menunjukkan dua berkas terhapus dari working tree (`D public/uploads/documents/*.jpeg`) — itu hasil migrasi yang disengaja.

## 4. Pengujian

| Perintah | Hasil aktual |
|---|---|
| `npm run verify:documents` | **66/66 lulus** — validasi magic bytes (PDF/JPEG/PNG/DOCX diterima; teks bernama `.pdf`, ekstensi salah, EXE, >10MB, kosong ditolak), 9 kunci traversal ditolak (`/etc/passwd`, `a//b`, `..`, backslash, absolut), klasifikasi referensi, baca berkas privat/inline/warisan, `Content-Disposition` bebas CR/LF, DTO tidak membocorkan kunci, penjagaan sumber (proxy, allowlist `/uploads`, endpoint unduh, KTP bukan base64, tautan UI), dan database (0 referensi publik tersisa, 0 berkas privat hilang, 0 base64). |
| `npm run verify:documents:live` (dev server) | **36/36 lulus** — `/uploads/documents/*` anonim → 404; kunci privat tak terjangkau via `/uploads`; aset CMS publik tetap 200; anonim → 401 (JSON) / redirect `/login` (HTML); unggah sah → 201 tanpa kunci; berkas teks `.pdf` → 400; ekstensi salah → 400; >10MB → 400; lampiran lintas cabang → 403; jalur INTERNAL (halaman Dokumen) → 201 & unduh 200; unduh sendiri → 200 dengan isi identik, `image/png`, `inline`, `private, no-store`; tanpa izin → 403; lintas organisasi → 404; lintas cabang (unduh & metadata) → 404; daftar tanpa kunci/`filePath`; hapus tanpa izin → 403; hapus → berkas fisik ikut hilang & unduh lanjutan 404; audit tercatat; data uji bersih. |
| Regresi `verify:navigation` | **26/26 lulus.** |
| Regresi `verify:access` | **45/45 lulus.** |
| Regresi `verify:customers` | **52/52 lulus.** |
| Regresi `verify:auth` / `verify:mfa` / `verify:account` | **38/38**, **57/57**, **19/19** lulus. |
| `npx tsc --noEmit` | **33 error** — seluruhnya error lama di modul lain; **tidak ada error baru** (baseline 3C/3D = 37; penurunan terjadi karena berkas yang disentuh Tahap 4 ikut diperbaiki tipenya). |
| `npx eslint --quiet` pada seluruh berkas yang disentuh Tahap 4 | **0 error baru.** Berkas inti (2 lib, API dokumen, `/uploads`, `proxy.ts`, 3 skrip, `seed.ts`, `next.config.ts`) = **0 error**. Tiga komponen UI menyisakan **18 error `@typescript-eslint/no-explicit-any`** — jumlah identik dengan versi HEAD sebelum sesi ini (diverifikasi dengan menjalankan eslint pada `git show HEAD:<berkas>`: 2 + 3 + 13), seluruhnya pada blok `catch (...: any)`/props lama yang tidak diubah sesi ini. |
| `npm run build` | **Sukses**; rute `/documents`, `/uploads/[...path]`, dan Proxy terdaftar. |
| `graphify update .` | Berhasil (2596 node, 6300 edge). |

**Pengujian yang belum dijalankan dan alasannya:** uji beban & uji klik-untuk-klik di peramban (unduh lewat tautan sudah diuji lewat HTTP); pengujian enkripsi at-rest (belum ada kontrol enkripsi di tingkat aplikasi — lihat bagian 5).

## 5. Risiko atau keputusan yang masih diperlukan

1. **Enkripsi saat disimpan (at-rest)** belum diterapkan aplikasi — diserahkan pada enkripsi disk/volume hosting. Bila diwajibkan compliance, perlu manajemen kunci terpisah → **keputusan pemilik sistem**.
2. **Berkas dalam riwayat git** (`public/uploads/documents/*.jpeg`) masih bisa dilihat siapa pun yang meng-clone riwayat → perlu **persetujuan pemilik repositori** untuk rewrite sejarah.
3. **2 berkas yatim** (foto KTP lama tanpa record) kini berada di penyimpanan privat, tetapi **tidak dirujuk record mana pun** → perlu keputusan: kaitkan ke dokumen atau musnahkan (menunggu kebijakan retensi, Tahap 12).
4. **Daftar dokumen masih bersifat organisasi** untuk semua pemegang `document.view` (isi berkas tetap terlindungi cakupan). penyaringan metadata per cabang/penugasan memerlukan penambahan `branchId`/relasi pada tabel `documents` (perubahan skema + migrasi) → **rekomendasi sub-tahap 4B bila compliance mewajibkan**.
5. **Pemisahan izin per kategori dokumen** (identitas / kredit / SLIK / umum) saat ini memakai permission `document.*` + cakupan; menambah permission baru per kategori adalah **keputusan pemilik proses/compliance**.
6. Dokumen SLIK saat ini tidak memiliki record tersendiri (analisa SLIK bekerja in-memory) — bila kelak disimpan, harus mengikuti pola yang sama dan masuk ruang lingkup **Tahap 5 (P0.5)**.
7. Temuan lama yang belum ditangani di tahap ini: `next@16.3.6`, `.env.example` diabaikan git, `typescript.ignoreBuildErrors: true` (Tahap 13), status sesi saat sandi diganti.

## 6. Tahap selesai

- **Tahap 4 (P0.4): DONE** — dokumen sensitif tidak dapat diakses tanpa otorisasi; jalur publik ditutup; endpoint unduh terotorisasi + ter-audit; validasi magic bytes & batas ukuran; migrasi terverifikasi; uji negatif lintas organisasi/cabang/izin/tipe palsu/ukuran tersedia.

## 7. Tahap berikutnya (rekomendasi saja; jangan dikerjakan pada sesi ini)

- **Nomor dan nama tahap:** **Tahap 5 — P0.5 Tata kelola AI dan pemrosesan dokumen SLIK.**
- **Prasyarat:** keputusan legal/compliance apakah teks SLIK boleh dikirim ke penyedia AI eksternal (OpenRouter) dan dalam bentuk apa (masking/anonimisasi).
- **Persetujuan/keputusan yang dibutuhkan:** persetujuan pemilik proses, legal/compliance, dan keamanan untuk pengiriman data ke pihak ketiga; jika belum disetujui, alur eksternal dinonaktifkan.
- **Prioritas:** setelah Tahap 4, risiko berkas publik telah tertutup; jangan mengubah tipe nominal (Tahap 6) pada sesi berikutnya.

## Status untuk sesi berikutnya

- Tanpa perubahan skema (20 migrasi, tanpa drift). Model penyimpanan/akses ada di `src/lib/document-storage.ts` + `src/lib/document-access.ts`; dokumentasi lengkap di `docs/DOCUMENT_STORAGE.md`.
- Perintah uji: `npm run verify:documents` (tanpa server), `npm run verify:documents:live` (butuh `npm run dev`), migrasi `npm run migrate:documents [-- --apply]`. Regresi: `verify:navigation`, `verify:access`, `verify:customers`, `verify:auth`, `verify:mfa`, `verify:account`.
- Kerjaan yang belum di-commit dari sesi sebelumnya (Tahap 3D) masih berada di working tree yang sama.
- Lanjutkan **hanya Tahap 5**; jangan mengaktifkan pengiriman SLIK ke pihak ketiga tanpa persetujuan, dan jangan mengubah tipe nominal (Tahap 6).
