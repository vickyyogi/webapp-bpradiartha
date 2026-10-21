# Reporting Requirements — Tahap 8 (P1.5)

Sumber implementasi: `src/app/api/reports/route.ts`, `src/lib/report-export.ts`, `src/app/(dashboard)/reports/page.tsx`.

## 1. Dimensi laporan

| Dimensi | Parameter API | Catatan |
|---|---|---|
| Domain | `domain=CREDIT\|FIELD\|PURCHASING\|INVENTORY\|ASSET\|ALL` | Default `ALL` |
| Periode | `startDate`, `endDate` (`YYYY-MM-DD`) | Berdasarkan `createdAt`; `endDate` inklusif sampai 23:59:59 |
| Cabang | `branchId` | Mempersempit, tidak mengganti cakupan akses pengguna |
| Produk kredit | `product` | Pencarian substring, case-insensitive |
| Marketing Officer | `officerId` | Khusus domain kredit dan tugas lapangan |
| Analis kredit | `analystId` | Khusus domain kredit |

Filter yang tidak relevan dengan domain diabaikan. Filter cabang/produk/officer/analyst **selalu** di-AND dengan cakupan organisasi/cabang/penugasan dari `src/lib/access-scope.ts`.

## 2. Definisi metrik

| Metrik | Definisi |
|---|---|
| Total Pengajuan Kredit | Jumlah `CreditApplication` pada periode dan filter aktif |
| Total Nominal Diajukan | `SUM(requestedAmount)` pengajuan pada filter aktif |
| Total Disetujui Komite | `SUM(approvedAmount)` pengajuan pada filter aktif |
| Total Realisasi | `SUM(realizationAmount)` pengajuan pada filter aktif |
| Rasio Selesai Tugas | `tugas COMPLETED / total tugas` pada filter aktif |
| Komitmen Belanja (PO) | `SUM(totalAmount)` purchase order pada filter aktif |
| Nilai Persediaan | `SUM(unitPrice × currentStock)` item aktif pada filter aktif |
| Nilai Aset Tetap | `SUM(purchasePrice)` aset pada filter aktif |
| Item Stok Rendah | Item aktif dengan `currentStock <= minStock` |

Metrik dihitung ulang setiap request; tidak ada cache agar filter dan cakupan selalu konsisten.

## 3. Hak akses

| Domain | Lihat | Ekspor |
|---|---|---|
| CREDIT | `report.credit.view` | `report.credit.export` |
| FIELD | `report.field.view` | `report.field.export` |
| PURCHASING | `report.purchasing.view` | `report.purchasing.export` |
| INVENTORY/ASSET | `report.inventory.view` | `report.inventory.export` |
| ALL | `report.management.view` | `report.management.export` |

Izin ekspor terpisah dari izin lihat. Pengguna tanpa izin domain tetap dapat memakai izin manajemen bila dimiliki.

## 4. Keamanan ekspor

- **CSV Injection**: setiap sel yang diawali `=`, `+`, `-`, `@`, TAB, atau CR diberi prefiks `'` sebelum dikutip.
- **Escaping**: tanda kutip ganda di-escape; nilai dikutip; newline di dalam sel dipertahankan dalam kutip.
- **Streaming**: baris diambil per batch 500 via cursor `id` dan dikirim sebagai `ReadableStream`; seluruh hasil tidak dimuat ke memori.
- **PII**: kontak pada ekspor/tampilan selalu dimasking (`maskPhone`); NIK/rekening memakai helper `src/lib/privacy.ts`. Nama pemohon tetap tampil karena dibutuhkan operasional.
- **Audit**: setiap ekspor mencatat `EXPORT` + domain, jumlah baris, filter, dan status `pii: masked`. Isi CSV/PII tidak masuk log.
- **Header**: `text/csv; charset=utf-8`, `Content-Disposition: attachment`, `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`.

## 5. Batas yang belum dikerjakan

- Laporan SLA/backlog pengajuan dan kelengkapan dokumen belum menjadi metrik tersendiri.
- Rekonsiliasi dengan CBS belum ada karena kontrak data CBS belum tersedia (Phase 7 MVP).
- Laporan pascapencairan menjadi ruang lingkup Tahap 11.
- UI baru menyediakan filter periode, cabang, dan produk; `officerId`/`analystId` masih lewat API.
- Format ekspor baru CSV; XLSX/PDF belum disetujui.
