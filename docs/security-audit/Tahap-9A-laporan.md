# Laporan Sesi Coding Agent — Tahap 9A (P1.1 Alur kredit end-to-end — sub-tahap A: master produk kredit)

- **Tahap aktif:** Tahap 9 — P1.1. Karena ruang lingkup P1.1 (7 butir) tidak realistis dalam satu sesi, dipecah menjadi sub-tahap (lihat §7); sesi ini hanya **Tahap 9A**.
- **Status:** **PARTIAL** (9A DONE; sisa sub-tahap P1.1 belum dikerjakan).
- **Tujuan sesi:** produk kredit, plafon, tenor, dan persyaratan dokumen dikelola sebagai Master Data yang menjadi sumber pilihan form serta divalidasi di server saat pengajuan dibuat/diubah.
- **Tanggal:** 2026-10-19

## 1. Temuan yang diverifikasi sebelum perubahan

| Temuan | Bukti | Keadaan sebelum |
|---|---|---|
| Produk pengajuan hanya string bebas | `CreditApplication.product String?` (`prisma/schema.prisma`); tidak ada relasi/FK ke master | TERVERIFIKASI |
| Pilihan produk di UI hard-coded | `CREDIT_PRODUCTS` di `src/app/(dashboard)/credit/applications/CreditApplicationsClientView.tsx` | TERVERIFIKASI |
| Master produk ada tetapi tidak dipakai | 3 baris `master_items` kategori `LOAN_PRODUCT` (min/max plafon, min/max tenor, bunga) | TERVERIFIKASI |
| Nama master ≠ data pengajuan lama | DB: master "Kredit Investasi" & "Kredit Multiguna & Konsumtif"; pengajuan lama "Kredit Investasi Usaha" & "Kredit Multi Guna" | TERVERIFIKASI |
| Tidak ada persyaratan dokumen per produk | atribut produk tidak punya `requiredDocuments`; `DocumentType` hanya enum global | TERVERIFIKASI |
| Tidak ada validasi plafon/tenor terhadap produk | `POST`/`PUT` credit applications tidak memeriksa master produk | TERVERIFIKASI |

## 2. Perubahan

**Berkas baru:**
- `src/lib/credit-product.ts` — tipe atribut produk, `normalizeLoanProductAttributes` (validasi atribut: angka ≥ 0, min ≤ max, tenor bulat ≥ 1, `requiredDocuments` ⊆ `DocumentType`), `listActiveCreditProducts(orgId)`, dan `validateCreditRequestAgainstProduct` (produk wajib terdaftar/aktif, plafon bilangan bulat rupiah > 0 dalam rentang produk, tenor dalam rentang produk). Produk historis yang tidak ada di master tetap boleh disimpan **selama nilainya tidak diubah**.
- `scripts/verify-credit-product.ts` — 21 pemeriksaan (unit aturan + kontrak Master Data + kompatibilitas produk lama).
- `docs/security-audit/Tahap-9A-laporan.md` — laporan ini.

**Berkas diubah:**
- `src/app/api/credit/applications/route.ts` — `POST` memvalidasi produk/plafon/tenor **sebelum** nasabah/berkas dibuat; respons 400 `CREDIT_PRODUCT_INVALID`.
- `src/app/api/credit/applications/[id]/route.ts` — `PUT` memvalidasi bila `product`/`requestedAmount`/`requestedTenorMonths` dikirim.
- `src/app/api/admin/master-data/route.ts` dan `[id]/route.ts` — atribut `LOAN_PRODUCT` dinormalkan & ditolak 400 bila tidak valid.
- `src/app/(dashboard)/admin/master-data/page.tsx` — input Min/Max Plafon, checklist "Persyaratan Dokumen" dari Master Data `DOCUMENT_TYPE`, kolom ringkas jumlah syarat dokumen.
- `src/app/(dashboard)/credit/applications/page.tsx` — memuat produk `LOAN_PRODUCT` aktif dan mengirimkannya ke client view.
- `src/app/(dashboard)/credit/applications/CreditApplicationsClientView.tsx` — pilihan produk dari master; fallback daftar lama hanya bila master kosong; nilai produk historis tetap tampil saat edit.
- `package.json` — script `verify:credit-product`.

## 3. Migrasi dan risiko data

- **Tidak ada migrasi skema** (tetap 24 migrasi; atribut produk memakai kolom `attributes Json` yang sudah ada).
- Tidak ada data yang diubah/dihapus. Pengajuan lama tidak divalidasi ulang kecuali produk/plafon/tenor diubah.
- **Rollback:** kembalikan berkas di atas (tanpa perubahan DB). Nilai `attributes.requiredDocuments` yang tersimpan hanya hilang bila kolom atribut dikembalikan manual.

## 4. Pengujian

| Perintah | Hasil aktual |
|---|---|
| `npm run verify:credit-product` | **21/21 lulus** (termasuk 3 produk pengajuan lama tetap dapat disimpan). |
| `npx tsc --noEmit` | **33 error**, seluruhnya error lama di modul lain (baseline Tahap 4/6); **0 error** pada berkas yang diubah. |
| `npm run build` | **Sukses** (build selesai, daftar route tercetak). |
| `graphify update .` | Graph diperbarui (2796 node, 6691 edge). |

**Pengujian yang belum dijalankan dan alasannya:** uji klik-untuk-klik UI (form master data & form pengajuan) dan uji konkurensi — belum ada browser/sesi uji; validasi server diuji lewat unit test fungsi murni, bukan HTTP end-to-end.

## 5. Risiko atau keputusan yang masih diperlukan

1. `requiredDocuments` produk masih **kosong** untuk semua produk. Isi per produk adalah **kebijakan** dan harus ditetapkan pemilik proses/compliance, bukan diasumsikan agent.
2. Dua produk pengajuan lama tidak cocok dengan master ("Kredit Investasi Usaha", "Kredit Multi Guna"). Perlu keputusan: ganti nama master agar cocok, atau migrasi data pengajuan lama (perubahan data → butuh persetujuan).
3. Plafon/tenor kini ditegakkan dari master; bila angka master belum mencerminkan aturan resmi, pengajuan sah bisa tertolak.
4. Limit kewenangan **per cabang**, checklist verifikasi berkas + alasan pengembalian, form analisis/survei standar + foto, komite kredit (kuorum/peserta/waktu), syarat pra-pencairan + referensi CBS, nomor aplikasi aman konkurensi, dan riwayat koreksi pasca-submit **belum dikerjakan** (lihat §7).

## 6. Tahap selesai

- **Tahap 9A (P1.1-A): DONE** — master produk kredit menjadi sumber pilihan & aturan pengajuan (plafon/tenor/persyaratan dokumen dikonfigurasi administrator), divalidasi di server, kompatibel dengan data lama, dan teruji otomatis.
- **P1.1 keseluruhan: PARTIAL.**

## 7. Rencana sub-tahap P1.1 (rekomendasi saja; jangan dikerjakan pada sesi ini)

| Sub-tahap | Ruang lingkup |
|---|---|
| 9B | Limit kewenangan memutus **per cabang** (`CreditApprovalLimit.branchId`, penegakan di keputusan, layar admin). |
| 9C | Checklist verifikasi berkas per produk (`requiredDocuments` → daftar periksa tersimpan) + alasan pengembalian **wajib** tervalidasi server. |
| 9D | Formulir analisis & survei terstandardisasi + unggah bukti/foto kunjungan bertipe `SURVEY_PHOTO`. |
| 9E | Keputusan Komite Kredit: peserta, kuorum, syarat persetujuan, waktu keputusan. |
| 9F | Syarat sebelum pencairan terstruktur + referensi transaksi CBS; nomor aplikasi unik aman konkurensi (sequence/retry); riwayat koreksi pasca-submit dengan audit trail. |

- **Prasyarat 9B:** keputusan pemilik proses tentang struktur limit per cabang (nilai limit tetap diisi manusia).
- **Prasyarat 9C:** penetapan daftar dokumen wajib per produk oleh compliance.

## Status untuk sesi berikutnya

- Skema: 24 migrasi (tidak berubah); tidak ada migrasi baru pada 9A.
- Perintah uji cepat: `npm run verify:credit-product` (butuh koneksi DB untuk bagian kontrak master).
- Lanjutkan **hanya Tahap 9B** (limit kewenangan per cabang) pada sesi baru; jangan mengulang 9A.
