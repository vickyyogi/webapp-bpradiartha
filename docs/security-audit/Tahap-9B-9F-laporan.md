# Laporan Sesi Coding Agent — Tahap 9B–9F (P1.1 alur kredit end-to-end)

- **Tahap aktif:** Tahap 9 — P1.1, sub-tahap 9B, 9C, 9D, 9E, 9F.
- **Status:** **DONE** untuk ruang lingkup teknis 9B–9F.
- **Tanggal:** 2026-10-20
- **Catatan protokol:** pengguna memberi instruksi eksplisit mengerjakan 9B sampai 9F dalam satu sesi. Satu tahap per sesi tidak diterapkan karena instruksi tersebut.

## 1. Perubahan per sub-tahap

### 9B — Limit kewenangan per cabang
- `CreditApprovalLimit.branchId` (nullable): `null` = organisasi, terisi = cabang.
- Limit cabang **menggantikan** limit organisasi untuk cabang itu; bila tidak ada limit cabang, limit organisasi dipakai (`effectiveLimitsForBranch`).
- Penegakan di `PUT /api/credit/applications/[id]`: pencarian limit pemutus dan penentuan tingkat kewenangan memakai cabang pengajuan.
- API admin `GET/POST /api/credit/approval-limits`, `PUT/DELETE /api/credit/approval-limits/[id]` (nonaktifkan, bukan hapus).
- Halaman `/admin/credit-limits` + menu navigasi.

### 9C — Checklist berkas dan alasan pengembalian
- Model `CreditDocumentChecklist` (unik per pengajuan + jenis dokumen). Item wajib disalin dari `requiredDocuments` produk saat pengajuan dibuat.
- Server menolak penghapusan item wajib dan menolak penurunan status `isRequired` oleh klien.
- Perpindahan ke `ANALYSIS`, `SURVEY`, `REVIEW`, `DECISION`, `APPROVED`, `REJECTED` ditolak (`DOCUMENT_CHECKLIST_INCOMPLETE`) bila item wajib belum dicentang.
- Status `RETURNED` wajib menyertakan `returnReason` minimal 10 karakter (`RETURN_REASON_REQUIRED`), disimpan ke riwayat status.

### 9D — Formulir analisis/survei terstandardisasi
- Validasi server field wajib analisis 5C dan survei lapangan, termasuk angka non-negatif dan tanggal survei valid.
- Formulir tidak lengkap ditolak (`ANALYSIS_INCOMPLETE` / `SURVEY_INCOMPLETE`), juga sebelum `DECISION`/`APPROVED`/`REJECTED`.
- Foto survei memakai unggahan dokumen yang sudah ada dengan tipe `SURVEY_PHOTO` (privat, terotorisasi).

### 9E — Risalah Komite Kredit
- Model `CreditCommitteeDecision`: jadwal, waktu keputusan, kuorum, peserta (hadir/vote), keputusan, risalah, syarat persetujuan.
- Kuorum dihitung server dari peserta `present`; keputusan ditolak bila hadir < kuorum, waktu keputusan sebelum jadwal, atau risalah < 10 karakter.
- UI tab **Tata Kelola & Pencairan** untuk mencatat peserta, kuorum, keputusan, dan riwayat risalah.

### 9F — Syarat pencairan, referensi CBS, nomor aplikasi, audit koreksi
- Model `CreditDisbursementCondition` (syarat terstruktur + status pemenuhan + petugas/waktu).
- Pencairan ditolak (`DISBURSEMENT_CONDITIONS_PENDING`) bila syarat belum dipenuhi dan `CBS_REFERENCE_REQUIRED` bila referensi CBS kosong.
- Nomor aplikasi memakai entropi kriptografis `KRD-YYYYMMDD-NNNNNN` + retry pada bentrok unik (maks. 5 percobaan).
- Setiap `PUT` pengajuan menulis audit log `UPDATE` (status, field berubah, alasan pengembalian) dan ditampilkan pada tab Tata Kelola.

## 2. Berkas baru
- `src/lib/credit-governance.ts`
- `src/app/api/credit/approval-limits/[id]/route.ts`
- `src/app/(dashboard)/admin/credit-limits/page.tsx`
- `prisma/migrations/20261020040503_tahap_9b_9f_credit_governance/migration.sql`
- `scripts/verify-credit-governance.ts`
- `docs/security-audit/Tahap-9B-9F-laporan.md`

## 3. Berkas diubah
- `prisma/schema.prisma`
- `src/app/api/credit/applications/route.ts`
- `src/app/api/credit/applications/[id]/route.ts`
- `src/app/api/credit/approval-limits/route.ts`
- `src/app/(dashboard)/credit/applications/[id]/page.tsx`
- `src/app/(dashboard)/credit/applications/[id]/CreditApplicationDetailClientView.tsx`
- `src/lib/navigation.ts`
- `package.json`
- `scripts/verify-slik-records.ts` (jumlah migrasi 24 → 25)

## 4. Migrasi dan risiko data
- Migrasi `20261020040503_tahap_9b_9f_credit_governance` ditambahkan dan **sudah diterapkan** ke database lokal (`prisma migrate deploy`).
- Perubahan aditif: 1 kolom nullable + 3 tabel baru + index/FK. Tidak ada kolom/tabel lama yang dihapus atau diubah tipenya.
- Rollback: hapus 3 tabel baru dan kolom `credit_approval_limits.branch_id`, lalu kembalikan schema/kode. Tidak ada data lama yang hilang.

## 5. Pengujian
| Perintah | Hasil aktual |
|---|---|
| `npm run verify:credit-governance` | **19/19 lulus** (aturan 9B–9F + cek skema DB). |
| `npx prisma validate` | Skema valid. |
| `npx prisma migrate status` | 25 migrasi, database up to date. |
| `npx tsc --noEmit` | **33 error**, seluruhnya error baseline modul lain; **0 error** pada berkas yang diubah. |
| `npm run build` | **Sukses**, route `/admin/credit-limits` dan API baru ikut ter-build. |

Belum dijalankan: uji klik-untuk-klik UI dan uji konkurensi beban nyata (tidak ada sesi browser/load test pada sesi ini).

## 6. Risiko / keputusan yang masih diperlukan
1. **Nilai limit per cabang** dan **daftar dokumen wajib produk** adalah kebijakan resmi; admin/compliance harus mengisi, bukan agent.
2. Risalah komite dapat dicatat, tetapi alur final `APPROVED/REJECTED` masih mengizinkan keputusan pejabat individual tanpa risalah komite. Bila SOP mewajibkan komite untuk semua plafon, perlu keputusan bisnis dan penegakan tambahan.
3. Foto survei tersedia sebagai unggahan; kewajiban minimal satu foto per kunjungan belum ditegakkan karena bergantung SOP.
4. Tahap 7 (audit log gagal tulis) dan Tahap 8 (masking/CSV injection/paginasi laporan) tetap belum dikerjakan.
5. `typescript.ignoreBuildErrors` masih aktif (Tahap 13).

## 7. Tahap berikutnya (rekomendasi)
- **Tahap 7 — P1.6 Audit trail dan logging**, lalu **Tahap 8 — P1.5 Pelaporan/ekspor**, karena keduanya terlewat sebelum 9A.
