# Credit Data Database Design

## Principle
Do not use the existing `CreditApplication` model for imported snapshot data. The import module represents externally sourced credit/account data, not a new credit application workflow.

## Core entities
```text
Customer 1 ---- N CreditAccount
CreditAccount 1 ---- N CreditCollateral
CreditImportBatch 1 ---- N staged/import rows
```

Recommended models: `Customer`, `CreditAccount`, `CreditCollateral`, `CreditImportBatch`, and staging representation (`CreditImportRow` or equivalent). Reuse existing User/Role/Permission/Branch/Audit models.

## Customer
Store CIF and customer profile fields: `cif`, legacy/effective CIF, NIK, name, birth date, addresses, contact, spouse, marital status, occupation, gender, religion, and coordinate data according to `CSV_DATA_MAPPING.md`.

## CreditAccount
Store all credit-specific source fields: account identifiers, classification, schedule, financial balances, arrears, collection quality, AO/branch, collateral summary, accrual and savings fields. Include `customer_id`, `import_batch_id`, source row number and timestamps.

## CreditCollateral
In v1, preserve `Detail Agunan` as source text on the credit record. Introduce structured collateral rows only when the source format/business rules are formally defined.

## CreditImportBatch
Suggested fields:
```text
id
file_name
source_period
status
total_rows
valid_rows
invalid_rows
warning_rows
uploaded_by
uploaded_at
activated_by
activated_at
failure_reason
created_at
updated_at
```

## Staging
Use an import-specific staging representation so raw/normalized rows can be validated before activation. For a maintainable first version, `credit_import_rows` linked to `credit_import_batches` is acceptable.

## Constraints
- `RekeningBaru` unique within a single import.
- `CIFBaru` indexed but not assumed globally unique unless business rules guarantee it.
- Foreign keys for customer/import/collateral relationships.
- Preserve leading zeroes in identifiers.

If historical snapshots are stored in the same credit table, use a scoped uniqueness such as `UNIQUE(import_batch_id, rekening)`. If only active rows are stored in the main credit table, keep historical row data in import/staging storage.

## Indexes
At minimum consider indexes on `cif`, `nik`, `rekening`, `rekening_efektif`, `customer_id`, `kolektibilitas`, `kode_ao`, `cabang`, `import_batch_id`, `jatuh_tempo`, `tanggal_tunggakan`, and import status/time. Add only indexes justified by queries.

## Money and identifiers
Money uses PostgreSQL `numeric`/Prisma Decimal, not floating point. Identifiers such as CIF, rekening, NIK and codes are text.

## Privacy
NIK, spouse NIK, phone, addresses, coordinates and detailed collateral must be protected by application authorization and should not be returned unnecessarily.

## Active snapshot recommendation
For v1, prefer a clear active dataset model: the latest successful import is active; failed imports remain in history. If full historical row-level querying is required later, evolve to full snapshot storage with batch-scoped uniqueness.
