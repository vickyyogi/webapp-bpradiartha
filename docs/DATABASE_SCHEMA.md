# DATABASE_SCHEMA.md
# BPR Operational Management System

## 1. Purpose

This document translates the conceptual ERD into a practical PostgreSQL/Prisma schema design.

It is intentionally not a copy-paste final `schema.prisma`. It defines table intent, columns, types, constraints, and implementation rules.

The final schema must be validated against the actual BPR requirements.

---

# 2. PostgreSQL Conventions

Recommended:

```text
Primary keys:
UUID

Timestamps:
TIMESTAMPTZ

Money:
NUMERIC(18,2)

Boolean:
BOOLEAN

Long text:
TEXT

Structured configuration:
JSONB

Short codes:
VARCHAR / TEXT with UNIQUE constraint
```

Use UTC in the database where practical and convert to local timezone at presentation boundaries.

---

# 3. Common Columns

Most business tables should have:

```text
id UUID PRIMARY KEY
created_at TIMESTAMPTZ NOT NULL
updated_at TIMESTAMPTZ NOT NULL
```

Where relevant:

```text
created_by UUID
updated_by UUID
```

Do not add audit columns mechanically to every table if they do not provide meaningful value.

---

# 4. Organizations

## organizations

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| code | VARCHAR(50) | UNIQUE |
| name | VARCHAR(200) | NOT NULL |
| is_active | BOOLEAN | NOT NULL DEFAULT true |
| created_at | TIMESTAMPTZ | NOT NULL |
| updated_at | TIMESTAMPTZ | NOT NULL |

---

# 5. Branches

## branches

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| organization_id | UUID | FK organizations.id |
| code | VARCHAR(50) | UNIQUE within organization |
| name | VARCHAR(200) | NOT NULL |
| address | TEXT | nullable |
| phone | VARCHAR(50) | nullable |
| is_active | BOOLEAN | NOT NULL DEFAULT true |
| created_at | TIMESTAMPTZ | NOT NULL |
| updated_at | TIMESTAMPTZ | NOT NULL |

---

# 6. Departments

## departments

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| organization_id | UUID | FK |
| code | VARCHAR(50) | NOT NULL |
| name | VARCHAR(200) | NOT NULL |
| is_active | BOOLEAN | NOT NULL DEFAULT true |
| created_at | TIMESTAMPTZ | NOT NULL |
| updated_at | TIMESTAMPTZ | NOT NULL |

Unique:

```text
organization_id + code
```

---

# 7. Users

## users

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| organization_id | UUID | FK |
| branch_id | UUID | FK nullable |
| department_id | UUID | FK nullable |
| email | VARCHAR(255) | UNIQUE |
| password_hash | TEXT | nullable depending on auth provider |
| full_name | VARCHAR(200) | NOT NULL |
| employee_number | VARCHAR(100) | nullable |
| phone | VARCHAR(50) | nullable |
| is_active | BOOLEAN | NOT NULL DEFAULT true |
| last_login_at | TIMESTAMPTZ | nullable |
| created_at | TIMESTAMPTZ | NOT NULL |
| updated_at | TIMESTAMPTZ | NOT NULL |

---

# 8. Roles

## roles

```text
id UUID PK
code VARCHAR(100) UNIQUE NOT NULL
name VARCHAR(150) NOT NULL
description TEXT
is_system BOOLEAN DEFAULT false
created_at TIMESTAMPTZ NOT NULL
updated_at TIMESTAMPTZ NOT NULL
```

---

# 9. Permissions

## permissions

```text
id UUID PK
code VARCHAR(150) UNIQUE NOT NULL
name VARCHAR(200) NOT NULL
description TEXT
created_at TIMESTAMPTZ NOT NULL
```

---

# 10. User Roles

## user_roles

```text
user_id UUID FK users.id
role_id UUID FK roles.id
created_at TIMESTAMPTZ NOT NULL

PRIMARY KEY(user_id, role_id)
```

---

# 11. Role Permissions

## role_permissions

```text
role_id UUID FK roles.id
permission_id UUID FK permissions.id
created_at TIMESTAMPTZ NOT NULL

PRIMARY KEY(role_id, permission_id)
```

---

# 12. CRM Leads

## leads

Recommended:

```text
id UUID PK
lead_number VARCHAR(50) UNIQUE NOT NULL
name VARCHAR(200) NOT NULL
phone VARCHAR(50) NOT NULL
email VARCHAR(255)
address TEXT
source_code VARCHAR(100)
status VARCHAR(50) NOT NULL
assigned_user_id UUID FK users.id
interested_product_id UUID FK loan_products.id nullable
notes TEXT
created_at TIMESTAMPTZ NOT NULL
updated_at TIMESTAMPTZ NOT NULL
```

Do not use uncontrolled free-text status in production. Prefer a master/configuration table or enum strategy after requirements are finalized.

---

# 13. Customers

## customers

```text
id UUID PK
customer_number VARCHAR(50) UNIQUE NOT NULL
full_name VARCHAR(200) NOT NULL
identity_number VARCHAR(100)
phone VARCHAR(50)
email VARCHAR(255)
address TEXT
created_at TIMESTAMPTZ NOT NULL
updated_at TIMESTAMPTZ NOT NULL
```

Sensitive identifiers require strict access control.

---

# 14. Loan Products

## loan_products

```text
id UUID PK
code VARCHAR(50) UNIQUE NOT NULL
name VARCHAR(200) NOT NULL
description TEXT
is_active BOOLEAN DEFAULT true
workflow_id UUID FK workflows.id nullable
configuration JSONB nullable
created_at TIMESTAMPTZ NOT NULL
updated_at TIMESTAMPTZ NOT NULL
```

`configuration` should only contain configurable product metadata, not critical financial truth that belongs in normalized relational fields.

---

# 15. Loan Applications

## loan_applications

```text
id UUID PK
application_number VARCHAR(50) UNIQUE NOT NULL
customer_id UUID FK customers.id nullable
lead_id UUID FK leads.id nullable
loan_product_id UUID FK loan_products.id NOT NULL
organization_id UUID FK organizations.id NOT NULL
branch_id UUID FK branches.id nullable
submitted_by UUID FK users.id nullable
assigned_marketing_user_id UUID FK users.id nullable
requested_amount NUMERIC(18,2) NOT NULL
requested_tenor INTEGER NOT NULL
purpose TEXT
status VARCHAR(50) NOT NULL
submitted_at TIMESTAMPTZ nullable
created_at TIMESTAMPTZ NOT NULL
updated_at TIMESTAMPTZ NOT NULL
```

Indexes:

```text
status
branch_id
loan_product_id
assigned_marketing_user_id
created_at
```

---

# 16. Application Status History

## loan_application_status_histories

```text
id UUID PK
application_id UUID FK NOT NULL
from_status VARCHAR(50)
to_status VARCHAR(50) NOT NULL
reason TEXT
comment TEXT
changed_by UUID FK users.id NOT NULL
changed_at TIMESTAMPTZ NOT NULL
```

Never update historical rows as part of ordinary status transitions.

---

# 17. Application Assignments

## loan_application_assignments

```text
id UUID PK
application_id UUID FK NOT NULL
stage VARCHAR(50) NOT NULL
assigned_to UUID FK users.id NOT NULL
assigned_by UUID FK users.id NOT NULL
assigned_at TIMESTAMPTZ NOT NULL
unassigned_at TIMESTAMPTZ nullable
reason TEXT
```

---

# 18. Credit Analysis

## credit_analyses

```text
id UUID PK
application_id UUID FK UNIQUE NOT NULL
analyst_id UUID FK users.id NOT NULL
status VARCHAR(50) NOT NULL
recommendation TEXT
notes TEXT
completed_at TIMESTAMPTZ nullable
created_at TIMESTAMPTZ NOT NULL
updated_at TIMESTAMPTZ NOT NULL
```

---

# 19. Credit Analysis Items

## credit_analysis_items

```text
id UUID PK
analysis_id UUID FK NOT NULL
criterion_code VARCHAR(100) NOT NULL
criterion_name VARCHAR(200) NOT NULL
value TEXT
assessment TEXT
notes TEXT
sort_order INTEGER NOT NULL DEFAULT 0
created_at TIMESTAMPTZ NOT NULL
updated_at TIMESTAMPTZ NOT NULL
```

This design supports configurable analysis criteria.

---

# 20. Surveys

## surveys

```text
id UUID PK
application_id UUID FK NOT NULL
assigned_officer_id UUID FK users.id NOT NULL
status VARCHAR(50) NOT NULL
scheduled_at TIMESTAMPTZ nullable
conducted_at TIMESTAMPTZ nullable
findings TEXT
recommendation TEXT
created_at TIMESTAMPTZ NOT NULL
updated_at TIMESTAMPTZ NOT NULL
```

---

# 21. Survey Items

## survey_items

```text
id UUID PK
survey_id UUID FK NOT NULL
section VARCHAR(100)
field_code VARCHAR(100) NOT NULL
value TEXT
notes TEXT
sort_order INTEGER DEFAULT 0
created_at TIMESTAMPTZ NOT NULL
updated_at TIMESTAMPTZ NOT NULL
```

---

# 22. Credit Reviews

## credit_reviews

```text
id UUID PK
application_id UUID FK NOT NULL
reviewer_id UUID FK users.id NOT NULL
status VARCHAR(50) NOT NULL
findings TEXT
recommendation TEXT
reviewed_at TIMESTAMPTZ nullable
created_at TIMESTAMPTZ NOT NULL
updated_at TIMESTAMPTZ NOT NULL
```

---

# 23. Credit Decisions

## credit_decisions

```text
id UUID PK
application_id UUID FK NOT NULL
decision VARCHAR(50) NOT NULL
approved_amount NUMERIC(18,2)
approved_tenor INTEGER
conditions TEXT
reason TEXT
notes TEXT
decided_by UUID FK users.id NOT NULL
decided_at TIMESTAMPTZ NOT NULL
created_at TIMESTAMPTZ NOT NULL
```

If decisions must be immutable, enforce application-level finalization and consider database protections.

---

# 24. Loan Realizations

## loan_realizations

```text
id UUID PK
application_id UUID FK UNIQUE NOT NULL
realization_date TIMESTAMPTZ NOT NULL
amount NUMERIC(18,2) NOT NULL
reference_number VARCHAR(100)
core_banking_reference VARCHAR(150)
confirmed_by UUID FK users.id NOT NULL
confirmed_at TIMESTAMPTZ NOT NULL
notes TEXT
created_at TIMESTAMPTZ NOT NULL
updated_at TIMESTAMPTZ NOT NULL
```

This is an operational confirmation record, not a financial ledger.

---

# 25. Field Tasks

## field_tasks

```text
id UUID PK
task_number VARCHAR(50) UNIQUE NOT NULL
application_id UUID FK nullable
assigned_to UUID FK users.id NOT NULL
task_type VARCHAR(100) NOT NULL
status VARCHAR(50) NOT NULL
priority VARCHAR(30) NOT NULL
due_at TIMESTAMPTZ nullable
completed_at TIMESTAMPTZ nullable
notes TEXT
created_at TIMESTAMPTZ NOT NULL
updated_at TIMESTAMPTZ NOT NULL
```

---

# 26. Field Activities

## field_activities

```text
id UUID PK
user_id UUID FK users.id NOT NULL
task_id UUID FK field_tasks.id nullable
activity_type VARCHAR(100) NOT NULL
activity_date TIMESTAMPTZ NOT NULL
notes TEXT
created_at TIMESTAMPTZ NOT NULL
```

---

# 27. Documents

## document_types

```text
id UUID PK
code VARCHAR(100) UNIQUE NOT NULL
name VARCHAR(200) NOT NULL
description TEXT
is_required BOOLEAN DEFAULT false
is_active BOOLEAN DEFAULT true
created_at TIMESTAMPTZ NOT NULL
updated_at TIMESTAMPTZ NOT NULL
```

## documents

```text
id UUID PK
document_type_id UUID FK NOT NULL
owner_type VARCHAR(100) NOT NULL
owner_id UUID NOT NULL
status VARCHAR(50) NOT NULL
current_version_id UUID nullable
created_by UUID FK users.id NOT NULL
created_at TIMESTAMPTZ NOT NULL
updated_at TIMESTAMPTZ NOT NULL
```

## document_versions

```text
id UUID PK
document_id UUID FK NOT NULL
version_number INTEGER NOT NULL
storage_key TEXT NOT NULL
original_filename TEXT NOT NULL
mime_type VARCHAR(150) NOT NULL
file_size BIGINT NOT NULL
checksum VARCHAR(128)
uploaded_by UUID FK users.id NOT NULL
uploaded_at TIMESTAMPTZ NOT NULL
```

For strict referential integrity, replace polymorphic ownership with explicit relation tables if necessary.

---

# 28. Inventory

## inventory_categories

```text
id UUID PK
code VARCHAR(50) UNIQUE NOT NULL
name VARCHAR(150) NOT NULL
created_at TIMESTAMPTZ NOT NULL
updated_at TIMESTAMPTZ NOT NULL
```

## inventory_items

```text
id UUID PK
sku VARCHAR(100) UNIQUE NOT NULL
category_id UUID FK NOT NULL
name VARCHAR(200) NOT NULL
unit VARCHAR(50) NOT NULL
minimum_stock NUMERIC(18,3)
is_active BOOLEAN DEFAULT true
created_at TIMESTAMPTZ NOT NULL
updated_at TIMESTAMPTZ NOT NULL
```

## inventory_transactions

```text
id UUID PK
item_id UUID FK NOT NULL
transaction_type VARCHAR(50) NOT NULL
quantity NUMERIC(18,3) NOT NULL
location_id UUID nullable
reference_type VARCHAR(100)
reference_id UUID nullable
performed_by UUID FK users.id NOT NULL
transaction_at TIMESTAMPTZ NOT NULL
notes TEXT
created_at TIMESTAMPTZ NOT NULL
```

---

# 29. Assets

## asset_categories

```text
id UUID PK
code VARCHAR(50) UNIQUE NOT NULL
name VARCHAR(150) NOT NULL
created_at TIMESTAMPTZ NOT NULL
updated_at TIMESTAMPTZ NOT NULL
```

## assets

```text
id UUID PK
asset_number VARCHAR(100) UNIQUE NOT NULL
category_id UUID FK NOT NULL
name VARCHAR(200) NOT NULL
serial_number VARCHAR(150)
purchase_date DATE
purchase_price NUMERIC(18,2)
vendor_id UUID FK nullable
location_id UUID nullable
current_holder_id UUID FK users.id nullable
condition VARCHAR(50)
status VARCHAR(50) NOT NULL
warranty_until DATE nullable
created_at TIMESTAMPTZ NOT NULL
updated_at TIMESTAMPTZ NOT NULL
```

---

# 30. Asset Assignment History

## asset_assignments

```text
id UUID PK
asset_id UUID FK NOT NULL
assigned_to UUID FK users.id NOT NULL
assigned_by UUID FK users.id NOT NULL
assigned_at TIMESTAMPTZ NOT NULL
returned_at TIMESTAMPTZ nullable
notes TEXT
```

---

# 31. Asset Transfers

## asset_transfers

```text
id UUID PK
asset_id UUID FK NOT NULL
from_location_id UUID nullable
to_location_id UUID nullable
from_holder_id UUID FK users.id nullable
to_holder_id UUID FK users.id nullable
transferred_by UUID FK users.id NOT NULL
transferred_at TIMESTAMPTZ NOT NULL
reason TEXT
```

---

# 32. Asset Maintenance

## asset_maintenance

```text
id UUID PK
asset_id UUID FK NOT NULL
vendor_id UUID FK nullable
maintenance_type VARCHAR(100) NOT NULL
description TEXT
cost NUMERIC(18,2)
started_at TIMESTAMPTZ
completed_at TIMESTAMPTZ
status VARCHAR(50)
notes TEXT
created_at TIMESTAMPTZ NOT NULL
updated_at TIMESTAMPTZ NOT NULL
```

---

# 33. Asset Disposal

## asset_disposals

```text
id UUID PK
asset_id UUID FK NOT NULL
disposed_by UUID FK users.id NOT NULL
disposed_at TIMESTAMPTZ NOT NULL
reason TEXT NOT NULL
notes TEXT
created_at TIMESTAMPTZ NOT NULL
```

---

# 34. Vendors

## vendors

```text
id UUID PK
code VARCHAR(50) UNIQUE NOT NULL
name VARCHAR(200) NOT NULL
contact_name VARCHAR(200)
phone VARCHAR(50)
email VARCHAR(255)
address TEXT
tax_identifier VARCHAR(100)
is_active BOOLEAN DEFAULT true
created_at TIMESTAMPTZ NOT NULL
updated_at TIMESTAMPTZ NOT NULL
```

---

# 35. Purchase Requests

## purchase_requests

```text
id UUID PK
request_number VARCHAR(50) UNIQUE NOT NULL
requested_by UUID FK users.id NOT NULL
department_id UUID FK NOT NULL
branch_id UUID FK nullable
status VARCHAR(50) NOT NULL
purpose TEXT
required_date DATE nullable
notes TEXT
created_at TIMESTAMPTZ NOT NULL
updated_at TIMESTAMPTZ NOT NULL
```

## purchase_request_items

```text
id UUID PK
request_id UUID FK NOT NULL
item_name VARCHAR(200) NOT NULL
quantity NUMERIC(18,3) NOT NULL
estimated_unit_price NUMERIC(18,2)
notes TEXT
```

---

# 36. Purchase Orders

## purchase_orders

```text
id UUID PK
po_number VARCHAR(50) UNIQUE NOT NULL
vendor_id UUID FK NOT NULL
purchase_request_id UUID FK nullable
status VARCHAR(50) NOT NULL
order_date DATE NOT NULL
expected_date DATE nullable
notes TEXT
created_at TIMESTAMPTZ NOT NULL
updated_at TIMESTAMPTZ NOT NULL
```

## purchase_order_items

```text
id UUID PK
purchase_order_id UUID FK NOT NULL
item_name VARCHAR(200) NOT NULL
quantity NUMERIC(18,3) NOT NULL
unit_price NUMERIC(18,2) NOT NULL
notes TEXT
```

---

# 37. Goods Receipts

## goods_receipts

```text
id UUID PK
receipt_number VARCHAR(50) UNIQUE NOT NULL
purchase_order_id UUID FK NOT NULL
received_by UUID FK users.id NOT NULL
received_at TIMESTAMPTZ NOT NULL
notes TEXT
```

## goods_receipt_items

```text
id UUID PK
goods_receipt_id UUID FK NOT NULL
purchase_order_item_id UUID FK NOT NULL
quantity_received NUMERIC(18,3) NOT NULL
condition VARCHAR(50)
notes TEXT
```

---

# 38. Workflow Tables

## workflows

```text
id UUID PK
code VARCHAR(100) UNIQUE NOT NULL
name VARCHAR(200) NOT NULL
entity_type VARCHAR(100) NOT NULL
is_active BOOLEAN DEFAULT true
created_at TIMESTAMPTZ NOT NULL
updated_at TIMESTAMPTZ NOT NULL
```

## workflow_steps

```text
id UUID PK
workflow_id UUID FK NOT NULL
step_code VARCHAR(100) NOT NULL
name VARCHAR(200) NOT NULL
sequence INTEGER NOT NULL
role_code VARCHAR(100)
required BOOLEAN DEFAULT true
created_at TIMESTAMPTZ NOT NULL
updated_at TIMESTAMPTZ NOT NULL
```

Unique:

```text
workflow_id + step_code
workflow_id + sequence
```

## workflow_instances

```text
id UUID PK
workflow_id UUID FK NOT NULL
entity_type VARCHAR(100) NOT NULL
entity_id UUID NOT NULL
current_step_id UUID FK
status VARCHAR(50) NOT NULL
started_at TIMESTAMPTZ NOT NULL
completed_at TIMESTAMPTZ nullable
```

## workflow_actions

```text
id UUID PK
workflow_instance_id UUID FK NOT NULL
step_id UUID FK NOT NULL
action VARCHAR(50) NOT NULL
performed_by UUID FK users.id NOT NULL
comment TEXT
performed_at TIMESTAMPTZ NOT NULL
```

---

# 39. CMS Tables

## pages

```text
id UUID PK
slug VARCHAR(255) UNIQUE NOT NULL
title VARCHAR(255) NOT NULL
content TEXT
status VARCHAR(50) NOT NULL
meta_title VARCHAR(255)
meta_description TEXT
published_at TIMESTAMPTZ nullable
created_by UUID FK users.id
updated_by UUID FK users.id
created_at TIMESTAMPTZ NOT NULL
updated_at TIMESTAMPTZ NOT NULL
```

## posts

```text
id UUID PK
slug VARCHAR(255) UNIQUE NOT NULL
title VARCHAR(255) NOT NULL
excerpt TEXT
content TEXT
status VARCHAR(50) NOT NULL
published_at TIMESTAMPTZ nullable
author_id UUID FK users.id
created_at TIMESTAMPTZ NOT NULL
updated_at TIMESTAMPTZ NOT NULL
```

## categories

```text
id UUID PK
name VARCHAR(150) NOT NULL
slug VARCHAR(150) UNIQUE NOT NULL
created_at TIMESTAMPTZ NOT NULL
updated_at TIMESTAMPTZ NOT NULL
```

## post_categories

```text
post_id UUID FK
category_id UUID FK

PRIMARY KEY(post_id, category_id)
```

## banners

```text
id UUID PK
title VARCHAR(255)
image_url TEXT
link_url TEXT
sort_order INTEGER DEFAULT 0
status VARCHAR(50)
published_at TIMESTAMPTZ nullable
created_at TIMESTAMPTZ NOT NULL
updated_at TIMESTAMPTZ NOT NULL
```

## faqs

```text
id UUID PK
question TEXT NOT NULL
answer TEXT NOT NULL
sort_order INTEGER DEFAULT 0
is_active BOOLEAN DEFAULT true
created_at TIMESTAMPTZ NOT NULL
updated_at TIMESTAMPTZ NOT NULL
```

## media

```text
id UUID PK
filename TEXT NOT NULL
storage_key TEXT NOT NULL
mime_type VARCHAR(150) NOT NULL
file_size BIGINT NOT NULL
uploaded_by UUID FK users.id
created_at TIMESTAMPTZ NOT NULL
```

---

# 40. Audit Logs

## audit_logs

```text
id UUID PK
user_id UUID FK users.id nullable
action VARCHAR(100) NOT NULL
entity_type VARCHAR(100) NOT NULL
entity_id UUID nullable
old_values JSONB nullable
new_values JSONB nullable
ip_address INET nullable
user_agent TEXT nullable
created_at TIMESTAMPTZ NOT NULL
```

Recommended indexes:

```text
(user_id, created_at)
(entity_type, entity_id)
(created_at)
```

---

# 41. Notifications

## notifications

```text
id UUID PK
user_id UUID FK users.id NOT NULL
type VARCHAR(100) NOT NULL
title VARCHAR(255) NOT NULL
message TEXT NOT NULL
entity_type VARCHAR(100)
entity_id UUID
read_at TIMESTAMPTZ nullable
created_at TIMESTAMPTZ NOT NULL
```

---

# 42. Settings

## settings

```text
id UUID PK
key VARCHAR(150) UNIQUE NOT NULL
value JSONB NOT NULL
description TEXT
updated_by UUID FK users.id
created_at TIMESTAMPTZ NOT NULL
updated_at TIMESTAMPTZ NOT NULL
```

Do not store secrets in generic settings. Secrets belong in secure environment/secret management.

---

# 43. Locations

A generic location table may be useful for inventory/assets.

## locations

```text
id UUID PK
organization_id UUID FK
branch_id UUID FK nullable
code VARCHAR(100) NOT NULL
name VARCHAR(200) NOT NULL
type VARCHAR(50)
is_active BOOLEAN DEFAULT true
created_at TIMESTAMPTZ NOT NULL
updated_at TIMESTAMPTZ NOT NULL
```

---

# 44. Prisma Implementation Guidance

Use Prisma relations explicitly.

Example conceptual relation:

```prisma
model LoanApplication {
  id              String   @id @default(uuid())
  applicationNumber String @unique

  customerId      String?
  customer        Customer? @relation(fields: [customerId], references: [id])

  loanProductId   String
  loanProduct     LoanProduct @relation(fields: [loanProductId], references: [id])

  status          String

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

This is illustrative only. Do not copy the example blindly into the final schema.

---

# 45. Transaction Requirements

Use database transactions for operations such as:

### Application submission

```text
Create/update application
+
Create status history
+
Create workflow instance
+
Create initial task
```

### Status transition

```text
Validate transition
+
Update application status
+
Create history
+
Create workflow action
+
Create task/notification if required
```

### Purchase approval

```text
Validate authority
+
Update purchase request
+
Create workflow action
+
Create audit record
```

### Asset assignment

```text
Validate asset status
+
Update current holder
+
Create assignment history
+
Create audit record
```

---

# 46. Delete Strategy

Do not allow hard delete for critical business records by default.

Critical records include:

- Credit applications
- Credit decisions
- Status histories
- Realization records
- Purchase orders
- Asset history
- Audit logs

For content/configuration records, deletion policy can differ.

Use archival/soft-delete only where it is useful and consistent with retention requirements.

---

# 47. Data Retention

Retention periods must be supplied by the BPR and applicable policy/regulation.

Do not hard-code arbitrary retention periods.

Create future configuration capability for:

```text
data_retention_policy
document_retention_policy
audit_retention_policy
```

---

# 48. Final Schema Validation Checklist

Before generating production migrations:

- Confirm organization structure
- Confirm branch structure
- Confirm user/employee structure
- Confirm customer definition
- Confirm credit product structure
- Confirm application fields
- Confirm document types
- Confirm credit analysis fields
- Confirm survey fields
- Confirm approval hierarchy
- Confirm purchasing workflow
- Confirm asset lifecycle
- Confirm reporting requirements
- Confirm retention requirements
- Confirm CBS integration identifiers

Only then finalize `schema.prisma`.
