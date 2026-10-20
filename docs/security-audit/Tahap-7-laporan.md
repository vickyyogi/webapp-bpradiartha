# Laporan Sesi Coding Agent — Tahap 7 (P1.6 Audit trail dan logging)

- **Tahap aktif:** Tahap 7 — P1.6 Audit trail dan logging.
- **Status:** **DONE** untuk kontrol teknis audit/logging. **NEEDS HUMAN REVIEW** untuk angka retensi dan kebijakan alert terpusat.
- **Tujuan sesi:** memperbaiki audit trail yang menelan kegagalan, mencatat tindakan penting, mencegah rahasia/NIK masuk log, membuat audit atomik pada perubahan penting yang memungkinkan, membatasi akses, dan menyediakan mekanisme retensi yang tidak berjalan tanpa persetujuan.
- **Tanggal:** 2026-10-20

## Ringkasan hasil

Temuan utama terverifikasi: `src/lib/audit.ts` menangkap semua error penulisan audit, mencetak `console.error`, lalu mengembalikan `null`. Pemanggil tidak pernah tahu audit gagal dan perubahan data tetap tersimpan.

Perubahan inti:

1. `logAudit` tidak lagi menelan kegagalan. Default bersifat fail-closed: melempar `AuditLogWriteError` dengan kode `AUDIT_LOG_WRITE_FAILED`. Kegagalan non-kritis harus memakai `critical: false` secara eksplisit dan tetap dicetak ke stderr.
2. Data audit dibersihkan sebelum disimpan:
   - password, hash password, token, secret, authorization, cookie, PIN/OTP, kode MFA/backup, nomor kartu: `[REDACTED]`;
   - isi berkas/buffer: `[REDACTED_CONTENT]`;
   - NIK/identitas dan nomor rekening: disamarkan;
   - NIK 16 digit dan rahasia berlabel di `notes` juga disamarkan.
3. Audit dibuat atomik dengan perubahan data pada jalur penting:
   - pengguna: create, update role/status, nonaktifkan;
   - role: create, update izin, delete;
   - master data: create, update, delete;
   - limit kewenangan kredit: create, update, nonaktifkan;
   - dokumen: delete;
   - pengajuan kredit baru: create + audit.
4. Approval/rejection pengajuan memakai aksi audit `APPROVE`/`REJECT`, bukan `UPDATE` biasa.
5. Ekspor CSV `/api/reports` mencatat `EXPORT` (metadata domain, format, jumlah baris; isi CSV/PII tidak disimpan).
6. Respons API audit memakai `Cache-Control: private, no-store, max-age=0`.
7. Retensi disediakan lewat `scripts/purge-audit-logs.ts` dengan pengaman:
   - default dry-run;
   - wajib `AUDIT_LOG_RETENTION_DAYS` dan `AUDIT_RETENTION_APPLY=YES`;
   - tidak ada penghapusan otomatis tanpa keputusan kebijakan.

## File yang diperiksa

- `src/lib/audit.ts` — sumber utama temuan.
- `src/lib/auth-login.ts`, `src/lib/mfa-service.ts` — audit login/MFA.
- `src/app/api/audit/route.ts` — akses baca log.
- `src/app/api/documents/[id]/download/route.ts` — audit unduhan.
- `src/app/api/credit/applications/[id]/route.ts` — approval dan perubahan pasca-submit.
- `src/app/api/reports/route.ts`, `src/app/api/cms/reports/route.ts` — ekspor.
- `src/app/api/admin/roles/route.ts`, `src/app/api/admin/roles/[id]/route.ts` — perubahan role/izin.
- `src/app/api/admin/master-data/route.ts`, `src/app/api/admin/master-data/[id]/route.ts` — data master.
- `src/app/api/users/route.ts`, `src/app/api/users/[id]/route.ts` — akun dan role pengguna.
- `src/app/api/credit/approval-limits/route.ts`, `src/app/api/credit/approval-limits/[id]/route.ts` — konfigurasi limit.
- `src/app/(dashboard)/audit/page.tsx` — tampilan/filter audit.
- `src/lib/privacy.ts` — helper masking NIK/rekening.

## File yang diubah

- `src/lib/audit.ts` — sanitasi, error kritis, helper `buildAuditLogData`.
- `src/app/api/users/route.ts`, `src/app/api/users/[id]/route.ts` — audit atomik.
- `src/app/api/admin/roles/route.ts`, `src/app/api/admin/roles/[id]/route.ts` — audit atomik.
- `src/app/api/admin/master-data/route.ts`, `src/app/api/admin/master-data/[id]/route.ts` — audit atomik.
- `src/app/api/credit/approval-limits/route.ts`, `src/app/api/credit/approval-limits/[id]/route.ts` — audit atomik.
- `src/app/api/credit/applications/route.ts` — create pengajuan + audit atomik.
- `src/app/api/credit/applications/[id]/route.ts` — aksi audit approval/rejection.
- `src/app/api/documents/[id]/route.ts` — delete dokumen + audit atomik.
- `src/app/api/reports/route.ts` — audit ekspor CSV.
- `src/app/api/audit/route.ts` — header no-store.
- `src/app/(dashboard)/audit/page.tsx` — filter EXPORT/UPLOAD/DOWNLOAD/REPORT/ROLE/limit/master data; label `No. Pegawai`.
- `scripts/verify-audit.ts` — pemeriksaan sanitasi dan kegagalan audit.
- `scripts/purge-audit-logs.ts` — retensi dengan dry-run dan konfirmasi eksplisit.
- `package.json` — `verify:audit`, `audit:purge`.
- `.env.example` — dokumentasi variabel retensi.
- `docs/security-audit/Tahap-7-laporan.md` — laporan ini.

## Pengujian

| Perintah | Hasil aktual |
|---|---|
| `npm run verify:audit` | **3/3 lulus** — rahasia/isi berkas tidak masuk, NIK/rekening disamarkan, audit sukses bersih, kegagalan kritis melempar `AuditLogWriteError`, `critical:false` mengembalikan `null` dan mencetak error. |
| `npm run verify:credit-governance` | **19/19 lulus** — tidak ada regresi aturan 9B–9F. |
| `npx tsc --noEmit` | **31 error lama**, turun dari baseline 33 (dua error `error.code` pada rute pengguna ikut diperbaiki). **0 error baru** pada berkas Tahap 7. |
| `npm run build` | **Sukses** — kompilasi dan prerender selesai. |
| `graphify update .` | Dijalankan setelah perubahan. |

Pengujian yang belum dijalankan:
- Uji beban/chaos audit database saat transaksi berjalan. Belum ada lingkungan terisolasi; perilaku kegagalan diuji lewat foreign-key violation.
- Uji integrasi browser untuk ekspor CSV dan tampilan audit. Perubahan UI hanya filter/label.

## Migrasi dan risiko data

- **Tidak ada migrasi Prisma** dan tidak ada perubahan skema pada Tahap 7.
- Tidak ada backfill/scrub log lama. Log lama yang sudah telanjur memuat NIK/rahasia tetap ada sampai retensi dijalankan atau dibersihkan manual dengan persetujuan.
- Retensi default **tidak menghapus apa pun**. Angka retensi harus diputuskan pemilik proses/compliance.

## Risiko atau keputusan yang masih diperlukan

1. **Angka retensi audit** belum ditetapkan. Skrip sudah tersedia, tetapi belum diaktifkan.
2. **Alert terpusat** belum ada. Kegagalan audit saat ini terdeteksi lewat error aplikasi/`stderr`; alerting formal masuk lingkup P2.1 (centralized logging/APM).
3. **Login dengan email tidak dikenal** tidak dapat dicatat ke `audit_logs` karena `organizationId` wajib dan email tersebut tidak terhubung ke organisasi mana pun. Percobaan untuk akun yang dikenal sudah tercatat.
4. **Fail-closed pada rute non-atomik** dapat menghasilkan respons 500 setelah data tersimpan bila audit gagal. Jalur penting utama sudah dibuat atomik; beberapa rute lama (mis. ubah sandi, CMS, SLIK) belum dipindahkan ke transaksi yang sama.
5. **Approval kredit** masih menulis audit setelah update status dan syarat pencairan, bukan dalam satu transaksi penuh. Bila audit gagal tepat setelah commit, perubahan sudah tersimpan dan respons gagal. Ini batas yang disengaja agar tidak merombak alur 9F secara besar pada sesi ini.
6. Tampilan audit masih menampilkan email/nomor pegawai; masking PII secara menyeluruh adalah lingkup Tahap 8.

## Tahap selesai

- Temuan `src/lib/audit.ts` menelan kegagalan: **DIPERBAIKI**.
- Pencatatan login, role, approval, ekspor, unduhan, master data, konfigurasi: **ADA**; beberapa jalur kini atomik dan aksi approval memakai label khusus.
- Larangan password/token/isi dokumen/NIK plaintext: **DITEGAKKAN** untuk tulisan baru.
- Alert/penanganan kegagalan audit: **ADA** (error kritis + log stderr).
- Transaksi atomik: **DITERAPKAN** pada jalur penting yang aman diubah; sisanya terdokumentasi.
- Pembatasan akses log: **ADA** (permission `audit.log.view` + cakupan organisasi + no-store).
- Retensi: **MEKANISME SIAP**, angka kebijakan **BELUM DIPUTUSKAN**.

## Tahap berikutnya (rekomendasi saja; jangan dikerjakan pada sesi ini)

- **Nomor dan nama tahap:** Tahap 8 — P1.5 Pelaporan manajemen dan ekspor data.
- **Prasyarat:** Tahap 7 selesai secara teknis; putuskan angka retensi agar `audit:purge` dapat diaktifkan.
- **Persetujuan/keputusan yang dibutuhkan:** kebijakan retensi audit; keputusan pemilik proses untuk masking PII dan format ekspor.

## Status untuk sesi berikutnya

- Instruksi singkat: lanjutkan ke Tahap 8 hanya setelah pengguna memerintahkan. Fokus Tahap 8: gunakan `src/lib/privacy.ts` di laporan, masking PII, proteksi CSV Injection, dan ekspor aman dengan paginasi/streaming. Jangan mengaktifkan `audit:purge` tanpa `AUDIT_LOG_RETENTION_DAYS` yang disetujui.
