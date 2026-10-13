# Penyimpanan & Akses Dokumen (Tahap 4 — P0.4)

Dokumen dalam sistem ini (KTP, KK, bukti penghasilan, sertifikat agunan, foto
survey, SPK/PK, dan berkas internal lain) merupakan data sensitif. Dokumen ini
**bukan** konten publik dan tidak boleh dapat diakses tanpa autentikasi +
otorisasi.

## 1. Lokasi penyimpanan

| Jenis | Lokasi | Status akses |
|---|---|---|
| Dokumen privat (tabel `documents`) | `storage/private/documents/<tahun>/<bulan>/<kunci>.<ext>` (di luar `public/`) | Hanya lewat endpoint ber-otorisasi |
| Aset CMS: gambar hero | `public/uploads/hero/*` | Publik (memang konten website) |
| Aset CMS: laporan publik | `public/uploads/reports/*` | Publik (memang konten website) |

- Akar penyimpanan privat dapat diubah lewat variabel `PRIVATE_DOCUMENT_DIR`
  (lihat `.env.example`). Nilai default `storage/private/documents` ikut
  direktori proyek dan **tidak pernah** berada di dalam web root.
- `storage/` masuk `.gitignore` — berkas dokumen tidak boleh masuk version control.
- Bila kelak tersedia object storage privat (S3/GCS/dll.), cukup ganti
  implementasi `savePrivateDocument` / `readPrivateDocument` di
  `src/lib/document-storage.ts`; pemanggil tidak berubah.

## 2. Referensi berkas pada database

Kolom `Document.filePath` menyimpan **referensi**, bukan jalur publik:

| Bentuk | Arti | Status |
|---|---|---|
| `private:<kunci>` | Berkas di penyimpanan privat | Format saat ini |
| `data:<mime>;base64,...` | Berkas lama tersimpan di database | Legacy — dimigrasikan |
| `/uploads/documents/...` | Berkas lama di jalur publik | Legacy — dimigrasikan |

Kunci penyimpanan divalidasi oleh pola ketat (`KEY_PATTERN` pada
`src/lib/document-storage.ts`): tanpa segmen kosong, tanpa `..`, tanpa
backslash, tanpa path absolut — sehingga setiap kunci sah selalu berada di dalam
akar penyimpanan (anti path traversal).

Respons API **tidak pernah** mengembalikan `filePath`/kunci penyimpanan; yang
dikembalikan adalah `downloadUrl`.

## 3. Endpoint akses

### `GET /api/documents/:id/download`

Urutan pemeriksaan (semuanya di server):

1. Sesi valid (tanpa sesi: `401` JSON, atau redirect `/login` bila datang dari
   navigasi peramban).
2. Permission `document.download` (plus pemeriksaan MFA & kebijakan sandi).
3. Record ada → `404` bila tidak ada **atau** di luar organisasi (tidak
   membocorkan keberadaan record).
4. Cakupan (`src/lib/document-access.ts`):
   - organisasi sama;
   - pengunggah dokumen tersebut boleh selalu;
   - cakupan `ORGANIZATION` boleh;
   - selain itu, record induk (pengajuan kredit, lead, nasabah, aset, item
     inventaris, PR/PO/GR) harus berada dalam cakupan cabang/penugasan;
   - `INTERNAL` (repositori dokumen umum) berbasis izin + organisasi.
5. Berkas dibaca dari penyimpanan privat, tipe ditentukan ulang dari **isi
   berkas** (magic bytes), lalu:
   - gambar/PDF: disajikan `inline`;
   - selain itu: `Content-Disposition: attachment` + `application/octet-stream`.
6. Header: `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`.
7. Aksi `DOWNLOAD` dicatat ke `audit_logs` (metadata saja: jenis, MIME, ukuran —
   tanpa nama berkas/isi dokumen agar PII tidak masuk log).

### `GET/DELETE /api/documents/:id`

Metadata juga merupakan data sensitif: wajib lolos permission **dan** cakupan
yang sama. `DELETE` mencatat audit lalu menghapus baris database lebih dulu,
baru berkas fisiknya (kegagalan menghapus berkas hanya menyisakan berkas yatim,
bukan record yang menunjuk berkas hilang).

### `POST /api/documents`

- Permission `document.upload`.
- Pemilik record (`ownerType`/`ownerId`) divalidasi: lampiran ke pengajuan di
  luar cakupan cabang ditolak (`403`).
- Validasi berkas: ukuran (maks 10 MB), magic bytes, kecocokan ekstensi dengan
  isi berkas, dan pencocokan Content-Type. Ekstensi/Content-Type dari klien
  tidak pernah dipercaya.
- Nama penyimpanan dihasilkan acak (`< waktu >_< acak 24 hex >.< ext >`),
  nama berkas asli hanya disimpan sebagai metadata tampilan.

### Jalur lama ditutup

- `src/proxy.ts` menjawab `404` untuk seluruh permintaan `/uploads/documents/*`
  bahkan sebelum file statis dilayani.
- `src/app/uploads/[...path]/route.ts` hanya melayani allowlist folder publik
  (`hero`, `reports`) dan menolak segmen traversal. SVG tidak lagi disajikan
  sebagai `image/svg+xml`.

## 4. Migrasi berkas lama

`scripts/migrate-private-documents.ts` (mode default: laporan/dry-run):

```bash
npm run migrate:documents            # laporan saja, tidak mengubah apa pun
npm run migrate:documents -- --apply # memindahkan berkas
```

Aturan keamanan:

- berkas sumber **tidak dihapus** sebelum isi salinan diverifikasi (ukuran +
  SHA-256 identik);
- sumber yang tidak ditemukan **tidak diubah** (laporan `SUMBER HILANG` dan
  menunggu keputusan manusia);
- berkas di `public/uploads/documents/` yang tidak dirujuk record manapun
  dipindahkan ke penyimpanan privat sebagai **berkas yatim** — keputusan
  mengaitkannya ke dokumen atau memusnahkannya sesuai kebijakan retensi ada di
  tangan pemilik proses.

Aset CMS (`/uploads/hero/*`, `/uploads/reports/*`) sengaja **tidak** dimigrasikan
karena memang konten publik.

## 5. Pengujian

```bash
npm run verify:documents        # logika + penjagaan sumber + kondisi database
npm run verify:documents:live   # uji HTTP (butuh `npm run dev`)
```

Cakupan uji live: jalur publik ditutup, autentikasi wajib, unggah tervalidasi
(berkas palsu/ekstensi salah/kelebihan ukuran/lampiran lintas cabang ditolak),
unduh lintas organisasi & lintas cabang → `404`, tanpa permission → `403`,
daftar tidak membocorkan kunci, penghapusan menghapus berkas fisik, dan audit
tercatat.

## 6. Keputusan yang masih perlu manusia

1. **Enkripsi saat disimpan (at-rest)** belum diterapkan pada tingkat aplikasi —
   menyerahkan pada enkripsi disk/volume penyedia hosting. Bila diwajibkan,
   diperlukan manajemen kunci terpisah.
2. **Pembersihan riwayat git** untuk berkas dokumen yang pernah ter-commit
   (`public/uploads/documents/*.jpeg`) memerlukan persetujuan pemilik repositori
   (rewrite sejarah).
3. **Retensi/pemusnahan** dokumen dan berkas yatim menunggu kebijakan resmi
   (Tahap 12 / Compliance).
4. **Pemisahan izin per kategori dokumen** (identitas / kredit / SLIK / umum)
   saat ini memakai permission `document.*` + cakupan; bila compliance
   menghendangi izin terpisah per kategori, perlu penambahan permission baru
   (keputusan pemilik proses).
