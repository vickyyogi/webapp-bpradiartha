# Laporan Sesi Coding Agent — Tahap 6 (P0.6 Presisi angka keuangan & migrasi Decimal)

- **Tahap aktif:** Tahap 6 — P0.6.
- **Status:** **DONE.**
- **Tujuan sesi:** seluruh nominal uang tersimpan sebagai `Decimal` (bukan `Float`), kalkulasi keuangan tidak memakai aritmetika floating point, data lama dimigrasikan tanpa kehilangan nilai, dan kontrak API/UI tetap mengirim `number`.
- **Tanggal:** 2026-10-19

## 1. Temuan yang diverifikasi sebelum perubahan

| Temuan | Bukti | Keadaan sebelum |
|---|---|---|
| 25 kolom fisik bertipe `double precision` | `information_schema.columns` | TERVERIFIKASI |
| `interest_rate` ikut bertipe float | `CreditApplication.interestRate` | TERVERIFIKASI |
| Penjumlahan nominal di server memakai `+` langsung pada hasil Prisma | `field/performance`, `assets`, `purchasing`, `reports` | TERVERIFIKASI |
| PPN dihitung `subtotal * 0.11` tanpa pembulatan | `src/app/api/purchasing/orders/route.ts` | TERVERIFIKASI |
| Data lokal seluruhnya bilangan bulat (tidak ada pecahan) | query `col <> trunc(col)` untuk 25 kolom | TERVERIFIKASI |
| Database up to date, 23 migrasi | `npx prisma migrate status` | TERVERIFIKASI |

## 2. Perubahan

**Keputusan presisi (disetujui pengguna):**
- Uang: `numeric(18,0)` — rupiah penuh, maksimum 999.999.999.999.999.999.
- `interest_rate`: `numeric(6,4)` — persen hingga 99.9999.

**Berkas baru:**
- `prisma/migrations/20261019120000_tahap_6_decimal_keuangan/migration.sql` — 25 `ALTER COLUMN ... TYPE numeric(...) USING ...`.
- `scripts/verify-decimal.ts` — 27 pemeriksaan: tipe/scale 25 kolom, 0 kolom float tersisa, serialisasi JSON Decimal → number.
- `docs/security-audit/Tahap-6-laporan.md` — laporan ini.

**Berkas diubah:**
- `prisma/schema.prisma` — 25 kolom `Float` → `Decimal` + `@db.Decimal(18,0)` / `@db.Decimal(6,4)`; komentar status quo dihapus.
- `src/lib/db.ts` — `Prisma.Decimal.prototype.toJSON` mengembalikan `toNumber()`: API dan server component tetap mengirim `number`, bukan string Decimal.
- `src/app/api/credit/applications/[id]/route.ts` — `finalAmount` dan `maxAllowed` dikonversi eksplisit; perbandingan limit memakai `Number()`.
- `src/app/api/field/performance/route.ts`, `src/app/(dashboard)/field/performance/page.tsx` — total target memakai `Number()`.
- `src/app/api/assets/route.ts` — total nilai aset memakai `Number()`.
- `src/app/api/purchasing/orders/route.ts` — total PO memakai `Number()`; PPN dibulatkan `Math.round(subtotal * 0.11)`.
- `src/app/api/purchasing/requests/route.ts` — total estimasi memakai `Number()`.
- `src/app/api/reports/route.ts` — seluruh agregat CSV/summary memakai `Number()`.
- `src/app/(dashboard)/credit/page.tsx` — format `requestedAmount` melalui `Number()`.
- `scripts/verify-slik-records.ts` — konversi `Number()` pada snapshot verifikasi dan jumlah migrasi 23 → 24.
- `package.json` — script `verify:decimal`.

## 3. Migrasi dan risiko data

- Backup tabel terdampak (13 tabel, JSON) dibuat sebelum migrasi di `%TEMP%\tahap6-backup-1792380451516.json`.
- Migrasi diterapkan dengan `npx prisma migrate deploy` — sukses, tanpa reset.
- Data lama integral → cast tidak mengubah nilai. Bila ada pecahan, PostgreSQL membulatkan setengah ke atas saat cast.
- **Rollback:** `ALTER COLUMN ... TYPE double precision` per kolom (nilai tidak hilang) + kembalikan `schema.prisma`; backup JSON tersedia untuk restore baris.
- Batas presisi klien: `toJSON` mengirim number, aman sampai `2^53-1` rupiah; di atas itu perlu mapper string eksplisit (tercatat sebagai `ponytail:` di `db.ts`).

## 4. Pengujian

| Perintah | Hasil aktual |
|---|---|
| `npm run verify:decimal` | **27/27 lulus** — semua tipe/scale benar, 0 kolom float, JSON Decimal = number. |
| `npm run verify:slik-records` | **44/44 lulus** (migrasi terhitung 24). |
| `npm run verify:slik` | **SEMUA UJI LULUS.** |
| `npx tsc --noEmit` | **33 error**, seluruhnya error lama di modul lain (baseline Tahap 4 = 33); **0 error baru** dari Tahap 6. |
| `npm run build` | **Sukses** (`✓ Compiled successfully`). |
| `graphify update .` | Berhasil. |

**Pengujian yang belum dijalankan dan alasannya:** uji klik-untuk-klik UI dan uji beban; tidak ada perubahan alur UI selain tipe data.

## 5. Risiko atau keputusan yang masih diperlukan

1. Nilai nominal di atas `2^53-1` akan kehilangan presisi saat serialisasi JSON → perlu mapper string bila limit bisnis melebihi angka tersebut.
2. `Decimal(18,0)` membulatkan pecahan rupiah; bila kelak dibutuhkan sen, perlu migrasi scale baru (keputusan bisnis).
3. Error TypeScript lama di `src/app/api/*` dan `src/lib/useInView.ts` tidak disentuh pada tahap ini (bukan lingkup Tahap 6).
4. `typescript.ignoreBuildErrors: true` masih aktif — risiko build hijau meski ada error tipe (Tahap 13).

## 6. Tahap selesai

- **Tahap 6 (P0.6): DONE** — 25 kolom nominal menjadi Decimal dengan presisi disepakati; kalkulasi server tidak lagi mencampur floating point; serialisasi API/UI tetap number; migrasi terverifikasi dan build sukses.

## 7. Tahap berikutnya (rekomendasi saja; jangan dikerjakan pada sesi ini)

- **Nomor dan nama tahap:** **Tahap 7 — P1.6 Audit trail dan logging.**
- **Prasyarat:** daftar aksi/entitas wajib audit dan kebijakan retensi log.
- **Prioritas:** konsistensi `logAudit` di seluruh route mutasi dan masking data sensitif pada log.

## Status untuk sesi berikutnya

- Skema: 24 migrasi, database lokal sudah menerapkan Tahap 6.
- Perintah uji: `npm run verify:decimal` (tanpa server), regresi `verify:slik-records`, `verify:slik`.
- Lanjutkan **hanya Tahap 7**; jangan mengubah nominal lagi kecuali keputusan bisnis baru.
