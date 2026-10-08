# Credit Data Permissions

## Purpose
Define access control for the restricted CSV Credit Data module using the existing project's RBAC.

## Permissions
```text
credit_data.view
credit_data.import
credit_data.replace
credit_data.history
credit_data.export
credit_data.restricted
```

| Permission | Purpose |
|---|---|
| `credit_data.view` | View active credit data and normal detail fields |
| `credit_data.import` | Upload, parse and validate CSV |
| `credit_data.replace` | Activate/replace active dataset |
| `credit_data.history` | View import batches/errors/history |
| `credit_data.export` | Export permitted data |
| `credit_data.restricted` | View sensitive fields |

## Recommended role policy
| Role example | View | Import | Replace | History | Export | Restricted |
|---|---:|---:|---:|---:|---:|---:|
| Admin | Yes | Yes | Yes | Yes | Yes | Yes |
| Manager | Yes | No | No | Yes | Yes | Conditional |
| Supervisor | Yes | Yes | No | Yes | Yes | Conditional |
| Credit Officer | Yes | Yes | No | Scoped | Conditional | Conditional |
| General Staff | No | No | No | No | No | No |
These are recommendations; map them to the project's actual roles rather than creating duplicate roles.

## Route/API protection
```text
/credit-data                    -> credit_data.view
/credit-data/import             -> credit_data.import
POST import API                 -> credit_data.import
POST import/[id]/activate       -> credit_data.replace
/credit-data/history            -> credit_data.history
export API                      -> credit_data.export
restricted fields/API           -> credit_data.restricted
```

Use the project's existing authorization helper, e.g. `requireAuthAndPermission(...)`, where available. Do not rely on sidebar/menu hiding.

## Field-level security
Normal fields: Rekening, CIF, Nama, Plafond, Baki Debet, Kolektibilitas, AO, Cabang and dates. Restricted fields: NIK, spouse NIK, coordinates, sensitive address data and detailed collateral.

## Branch/organization scope
If the existing platform enforces organization/branch scope, apply it to Credit Data. A user should only see permitted branches unless a cross-branch permission is explicitly granted.

## Four-eyes option
For sensitive environments, allow one user to upload/validate and another user with `credit_data.replace` to activate. This can be implemented after the basic module.

## Audit events
Recommended events:
```text
CREDIT_DATA_IMPORT_STARTED
CREDIT_DATA_IMPORT_VALIDATED
CREDIT_DATA_IMPORT_FAILED
CREDIT_DATA_IMPORT_ACTIVATED
CREDIT_DATA_IMPORT_CANCELLED
CREDIT_DATA_EXPORT
CREDIT_DATA_RESTRICTED_VIEW
```
Audit should capture actor, branch/org, action, target batch/credit, timestamp and result. Never put raw CSV rows or sensitive values into logs.

## Security acceptance
A user without `credit_data.view` cannot retrieve data; without `credit_data.import` cannot upload; without `credit_data.replace` cannot activate; without `credit_data.history` cannot view history; without `credit_data.export` cannot export; without `credit_data.restricted` cannot retrieve restricted fields. Direct API calls must enforce the same rules as the UI.
