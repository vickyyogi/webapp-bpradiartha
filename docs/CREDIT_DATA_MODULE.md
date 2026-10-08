# Credit Data CSV Module

## Purpose
Add a restricted Credit Data/CSV Import module to the existing BPR Next.js platform. The CSV is a periodic snapshot from an external source. A successful activation replaces the active dataset; import history remains auditable.

## Existing platform
Reuse the existing Next.js, PostgreSQL, Prisma, NextAuth, RBAC/permissions, organization/branch context, and audit trail. Do not create a second auth/RBAC/database system.

## Scope
- Restricted credit-data dashboard
- CSV upload, parsing, header/row validation and preview
- Staging and transactional replacement
- Rollback on failure
- Import history/errors
- Credit list/detail, customer and collateral views
- Search/filter/reporting
- Permission and audit controls

Out of scope for v1: core-banking synchronization, automatic scheduled import, manual editing of imported figures, and replacement of the existing Credit Application workflow.

## Routes
```text
/credit-data
/credit-data/import
/credit-data/history
/credit-data/[rekening]
```

## Main list fields
Rekening, CIF, Nama, No SPK, AO, Cabang, Plafond, Baki Debet, Kolektibilitas, Total Tunggakan, FR Hari, Jenis Kredit, Tgl Mulai, Jatuh Tempo, and derived status. Do not expose all 112 source columns in the list.

## Detail sections
Identitas Kredit; Nasabah; Akad & Jadwal; Saldo & Kewajiban; Angsuran & Tunggakan; Kolektibilitas; AO/Cabang; Agunan; Rekening Tabungan; Accrual; Import Metadata.

## Permissions
```text
credit_data.view
credit_data.import
credit_data.replace
credit_data.history
credit_data.export
credit_data.restricted
```
Server-side checks are mandatory on pages, route handlers and server actions.

## Import principle
Never perform an unprotected DELETE followed by INSERT. Use: upload -> parse -> validate -> stage -> preview -> confirm -> transaction -> replace -> commit. A failed import must leave the previous active dataset untouched.

## Active snapshot
Only the latest successfully activated batch is active. Failed/cancelled imports never replace the active snapshot. Historical batches remain auditable.

## Sensitive data
NIK, phone, addresses, spouse data, coordinates, credit balances and collateral data require least-privilege access. Do not log raw CSV rows or sensitive values.

## Acceptance criteria
Valid CSV can be uploaded, validated, previewed and activated atomically; invalid CSV cannot change active data; import history is preserved; direct API access is protected; detail can be opened by RekeningBaru; UI exposes only selected fields by default.
