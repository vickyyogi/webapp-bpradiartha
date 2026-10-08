# CSV Import Workflow

## Goal
Replace the active credit snapshot safely while preserving the previous successful snapshot and import history.

## State machine
```text
UPLOADED -> VALIDATING -> VALIDATED -> ACTIVATING -> ACTIVE
                              |
                              +-> FAILED
UPLOADED/VALIDATED -> CANCELLED
```

## Workflow
1. **Upload** — require `credit_data.import`; validate file size/type and create an import batch.
2. **Parse** — server-side CSV parser; normalize BOM, line endings, empty cells and whitespace.
3. **Headers** — compare explicitly with the mapping; report missing, unexpected and duplicate headers.
4. **Rows** — validate required fields, numeric values, dates and unique `RekeningBaru`.
5. **Stage** — keep validated data associated with its import batch.
6. **Preview** — show source period, row counts, errors/warnings and a small preview.
7. **Confirm** — only `credit_data.replace` can activate.
8. **Transaction** — serialize activation; replace active data; mark new batch ACTIVE; commit.
9. **Audit** — record actor, batch, timestamps, counts and result.

## Critical rule
Never do an unrelated `DELETE` followed by `INSERT`. If activation fails, PostgreSQL transaction rollback must leave the previous active dataset untouched.

## Concurrency
Only one activation at a time. Prefer a PostgreSQL advisory lock or equivalent transaction-safe lock.

## History
Keep filename, source period, status, row counts, uploader, upload time, activator, activation time and failure reason. Historical batches must not be silently deleted.

## Failure behavior
Validation failure: batch FAILED, active dataset unchanged. Activation failure: ROLLBACK, batch FAILED, active dataset unchanged. Success: new batch ACTIVE, previous batch historical/inactive.

## Duplicate rules
`RekeningBaru` must be unique within one import. The same rekening appearing in different historical snapshots is expected.

## Performance
For large files use server-side streaming/batching. Consider PostgreSQL bulk loading only after validation and only inside a carefully controlled transaction. Do not load large CSVs into browser memory.

## Acceptance tests
- valid file becomes active;
- missing/extra required headers block activation;
- duplicate rekening blocks activation;
- invalid numeric/date blocks or rejects according to policy;
- simulated DB failure rolls back;
- unauthorized import/replace calls are rejected;
- previous active snapshot remains queryable after failed import.
