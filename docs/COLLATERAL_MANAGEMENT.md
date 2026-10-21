# Manajemen Agunan — Tahap 10 (P1.2)

Implementasi: `prisma/schema.prisma`, `src/lib/collateral.ts`, `src/app/api/credit/collaterals/**`, `src/app/(dashboard)/credit/collaterals/page.tsx`.

## 1. Model data

`CreditCollateral` — entitas agunan tersendiri:

| Kelompok | Field |
|---|---|
| Identitas | `collateralCode`, `collateralType`, `status` (`ACTIVE/RELEASED/EXPIRED`) |
| Relasi | `customerId` (wajib), `creditApplicationId` (opsional), `branchId`, `createdById` |
| Kepemilikan | `ownershipProof`, `legalOwnerName`, `ownerRelationship` |
| Taksasi | `marketValue`, `njopValue`, `appraisedValue`, `appraiserName`, `appraisalMethod`, `appraisalDate`, `nextAppraisalDate` |
| Pengikatan | `bindingType`, `bindingNumber`, `bindingDate`, `bindingExpiryDate` |
| Asuransi | `insuranceProvider`, `insurancePolicyNumber`, `insuranceExpiryDate` |
| Lainnya | `locationAddress`, `notes` |

`CollateralAppraisal` — riwayat penilaian. Record baru ditambahkan saat:
- agunan dibuat dan `appraisalDate` diisi, atau
- saat ubah agunan dengan `recordAppraisal: true`.

Riwayat lama tidak pernah ditimpa. Nilai terkini tetap disimpan di `CreditCollateral` untuk tampilan cepat.

Jenis agunan, jenis pengikatan, dan metode penilaian berupa teks bebas karena daftar resmi belum ditetapkan SOP. Ganti ke enum/master data setelah keputusan bisnis.

## 2. API

| Method | Rute | Izin |
|---|---|---|
| GET | `/api/credit/collaterals` | `credit.collateral.view` |
| POST | `/api/credit/collaterals` | `credit.collateral.create` |
| GET | `/api/credit/collaterals/[id]` | `credit.collateral.view` |
| PUT | `/api/credit/collaterals/[id]` | `credit.collateral.update` |
| DELETE | `/api/credit/collaterals/[id]` | `credit.collateral.delete` |

Query daftar: `search`, `status`, `customerId`, `creditApplicationId`, `reminders=1`, `page`, `limit`.

Validasi:
- `customerId`, `collateralType`, `legalOwnerName` wajib.
- Nominal non-negatif, dibulatkan ke rupiah (`Decimal(18,0)`).
- Tanggal tidak valid menjadi `null`.
- `creditApplicationId` harus milik nasabah dan organisasi yang sama.
- Kode agunan otomatis dibuat bila kosong; unik per organisasi.
- Cakupan organisasi/cabang dari `buildScopeFilter` selalu di-AND dengan filter pencarian; pencarian tidak dapat memperluas akses.

## 3. Pengingat

Tenggat yang dipantau: `nextAppraisalDate`, `bindingExpiryDate`, `insuranceExpiryDate`.

- `OVERDUE`: tanggal sudah lewat.
- `DUE_SOON`: ≤30 hari.
- `OK`: >30 hari.
- `NONE`: tanggal kosong.

Halaman menampilkan hitungan agunan aktif yang perlu tindakan dan filter “Perlu Tindakan”. Ini pengingat in-app; belum ada pengiriman email/WhatsApp (Phase 7 MVP).

## 4. Audit dan izin

- Create/update/delete mencatat audit `CREDIT_COLLATERAL`. Update mencatat status lama/baru dan apakah riwayat taksasi ditambahkan.
- Create/update taksasi berjalan dalam satu transaksi database.
- Permission ditambahkan ke katalog seed dan diberikan ke `ADMIN_OPERASIONAL`, `MARKETING`/`AO_MARKETING`, `CREDIT_ANALYST`, `CREDIT_REVIEWER`, `APPROVER` sesuai kebutuhan operasional.

## 5. Batas yang belum dikerjakan

- Dokumen agunan belum otomatis terhubung ke tabel `Document` (tipe `COLLATERAL_DOC` sudah tersedia); unggahan masih lewat modul Dokumen.
- Belum ada penilaian ulang terjadwal otomatis, notifikasi keluar, atau integrasi kalender.
- Belum ada laporan/ekspor khusus agunan.
- Persetujuan/verifikasi agunan oleh pejabat belum menjadi workflow tersendiri.
