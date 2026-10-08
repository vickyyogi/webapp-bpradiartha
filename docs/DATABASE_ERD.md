# DATABASE_ERD.md
# BPR Operational Management System

## 1. Purpose

This document describes the conceptual relational model for PostgreSQL.

It is intended to guide Prisma schema design.

This is an initial architecture and must be validated against the BPR's actual forms, SOPs, reports, and organization structure.

---

# 2. Domain Map

```text
AUTH
  |
  +------------------------------+
  |                              |
  v                              v
CRM                          SYSTEM/AUDIT
  |                              |
  v                              |
CREDIT --------------------------+
  |
  +---- DOCUMENTS
  |
  +---- FIELD
  |
  +---- WORKFLOW
  |
  +---- REALIZATION

PURCHASING
  |
  +---- INVENTORY
  |
  +---- ASSETS
  |
  +---- DOCUMENTS
  |
  +---- WORKFLOW

CMS
```

---

# 3. Authentication ERD

```text
users
  |
  +----< user_roles >---- roles
                            |
                            +----< role_permissions >---- permissions
```

### users

```text
users
- id PK
- email UNIQUE
- password_hash
- full_name
- employee_number
- organization_id FK
- branch_id FK nullable
- department_id FK nullable
- is_active
- created_at
- updated_at
```

### roles

```text
roles
- id PK
- code UNIQUE
- name
- description
- is_system
- created_at
- updated_at
```

### permissions

```text
permissions
- id PK
- code UNIQUE
- name
- description
- created_at
```

---

# 4. Organization ERD

Recommended:

```text
organizations
   |
   +----< branches
   |
   +----< departments
```

Potential future employee relationship:

```text
users
   |
   +---- organization
   +---- branch
   +---- department
```

The exact hierarchy should be confirmed.

---

# 5. CRM ERD

```text
leads
  |
  +---- customer (optional conversion)
                  |
                  +----< loan_applications
```

### leads

```text
leads
- id PK
- lead_number UNIQUE
- name
- phone
- email nullable
- address nullable
- source_id FK
- assigned_user_id FK
- interested_product_id FK nullable
- status
- notes
- created_at
- updated_at
```

### customers

```text
customers
- id PK
- customer_number UNIQUE
- full_name
- identity_number nullable
- phone
- email nullable
- address nullable
- created_at
- updated_at
```

Do not assume that every lead must become a customer record.

---

# 6. Credit ERD

```text
customers
   |
   +----< loan_applications >---- loan_products
                  |
                  +----< application_status_history
                  |
                  +----< application_assignments
                  |
                  +----< credit_analyses
                  |
                  +----< surveys
                  |
                  +----< credit_reviews
                  |
                  +----< credit_decisions
                  |
                  +----< loan_realizations
                  |
                  +----< documents
                  |
                  +----< workflow_instances
```

---

# 7. Loan Products

```text
loan_products
- id PK
- code UNIQUE
- name
- description
- is_active
- workflow_id FK nullable
- created_at
- updated_at
```

Do not hard-code product-specific fields into the application table if they can be represented through configuration.

---

# 8. Loan Applications

```text
loan_applications
- id PK
- application_number UNIQUE
- customer_id FK nullable
- lead_id FK nullable
- loan_product_id FK
- branch_id FK
- submitted_by FK
- assigned_marketing_user_id FK nullable
- requested_amount
- requested_tenor
- purpose
- status
- submitted_at nullable
- created_at
- updated_at
```

Important:

The application number is a business identifier.

The database primary key should remain an internal stable identifier such as UUID.

---

# 9. Application Status History

```text
loan_application_status_histories
- id PK
- application_id FK
- from_status nullable
- to_status
- reason nullable
- comment nullable
- changed_by FK
- changed_at
```

Relationship:

```text
loan_applications 1 ---- N loan_application_status_histories
```

---

# 10. Application Assignment

```text
loan_application_assignments
- id PK
- application_id FK
- stage
- assigned_to FK
- assigned_by FK
- assigned_at
- unassigned_at nullable
- reason nullable
```

---

# 11. Credit Analysis

```text
credit_analyses
- id PK
- application_id FK UNIQUE
- analyst_id FK
- status
- recommendation nullable
- notes nullable
- completed_at nullable
- created_at
- updated_at
```

Analysis items:

```text
credit_analysis_items
- id PK
- analysis_id FK
- criterion_code
- criterion_name
- value nullable
- assessment nullable
- notes nullable
- sort_order
```

This supports configurable analysis criteria.

---

# 12. Survey

```text
surveys
- id PK
- application_id FK
- assigned_officer_id FK
- status
- scheduled_at nullable
- conducted_at nullable
- findings nullable
- recommendation nullable
- created_at
- updated_at
```

Survey items:

```text
survey_items
- id PK
- survey_id FK
- section
- field_code
- value nullable
- notes nullable
- sort_order
```

---

# 13. Credit Review

```text
credit_reviews
- id PK
- application_id FK
- reviewer_id FK
- status
- findings nullable
- recommendation nullable
- reviewed_at nullable
- created_at
- updated_at
```

---

# 14. Credit Decision

```text
credit_decisions
- id PK
- application_id FK
- decision
- approved_amount nullable
- approved_tenor nullable
- conditions nullable
- reason nullable
- notes nullable
- decided_by FK
- decided_at
```

A decision should not be edited freely after finalization.

Use a correction/reversal process if policy requires changes.

---

# 15. Loan Realization

```text
loan_realizations
- id PK
- application_id FK UNIQUE
- realization_date
- amount
- reference_number nullable
- core_banking_reference nullable
- confirmed_by FK
- confirmed_at
- notes nullable
```

This is an operational record.

It is not a replacement for a financial ledger.

---

# 16. Field Operations ERD

```text
users
  |
  +----< field_tasks
  |
  +----< field_activities
```

### field_tasks

```text
field_tasks
- id PK
- task_number UNIQUE
- application_id FK nullable
- assigned_to FK
- task_type
- status
- priority
- due_at nullable
- completed_at nullable
- notes nullable
- created_at
- updated_at
```

### field_activities

```text
field_activities
- id PK
- user_id FK
- task_id FK nullable
- activity_type
- activity_date
- notes
- created_at
```

---

# 17. Document ERD

```text
documents
  |
  +----< document_versions
```

### documents

```text
documents
- id PK
- document_type_id FK
- owner_type
- owner_id
- status
- current_version_id nullable
- created_by FK
- created_at
- updated_at
```

### document_versions

```text
document_versions
- id PK
- document_id FK
- version_number
- storage_key
- original_filename
- mime_type
- file_size
- checksum nullable
- uploaded_by FK
- uploaded_at
```

Because documents can belong to multiple business domains, `owner_type + owner_id` is a polymorphic relationship. If strict foreign keys are required for a specific deployment, use dedicated relation tables instead.

---

# 18. Inventory ERD

```text
inventory_categories
      |
      +----< inventory_items
                    |
                    +----< inventory_transactions
```

### inventory_items

```text
inventory_items
- id PK
- sku UNIQUE
- category_id FK
- name
- unit
- minimum_stock nullable
- is_active
- created_at
- updated_at
```

### inventory_transactions

```text
inventory_transactions
- id PK
- item_id FK
- transaction_type
- quantity
- location_id FK nullable
- reference_type nullable
- reference_id nullable
- performed_by FK
- transaction_at
- notes
```

Stock should preferably be derived from transactions or maintained with a carefully controlled balance mechanism.

---

# 19. Asset ERD

```text
asset_categories
      |
      +----< assets
                 |
                 +----< asset_assignments
                 |
                 +----< asset_transfers
                 |
                 +----< asset_maintenance
                 |
                 +----< asset_disposals
```

### assets

```text
assets
- id PK
- asset_number UNIQUE
- category_id FK
- name
- serial_number nullable
- purchase_date nullable
- purchase_price nullable
- vendor_id FK nullable
- location_id FK nullable
- current_holder_id FK nullable
- condition
- status
- warranty_until nullable
- created_at
- updated_at
```

---

# 20. Purchasing ERD

```text
vendors
   |
   +----< purchase_orders

purchase_requests
   |
   +----< purchase_request_items

purchase_orders
   |
   +----< purchase_order_items
   |
   +----< goods_receipts
```

### purchase_requests

```text
purchase_requests
- id PK
- request_number UNIQUE
- requested_by FK
- department_id FK
- branch_id FK nullable
- status
- purpose
- required_date nullable
- notes nullable
- created_at
- updated_at
```

### purchase_request_items

```text
purchase_request_items
- id PK
- request_id FK
- item_name
- quantity
- estimated_unit_price nullable
- notes nullable
```

### purchase_orders

```text
purchase_orders
- id PK
- po_number UNIQUE
- vendor_id FK
- purchase_request_id FK nullable
- status
- order_date
- expected_date nullable
- notes nullable
```

### goods_receipts

```text
goods_receipts
- id PK
- receipt_number UNIQUE
- purchase_order_id FK
- received_by FK
- received_at
- notes nullable
```

---

# 21. Workflow ERD

```text
workflows
   |
   +----< workflow_steps

workflow_instances
   |
   +----< workflow_actions
```

### workflows

```text
workflows
- id PK
- code UNIQUE
- name
- entity_type
- is_active
```

### workflow_steps

```text
workflow_steps
- id PK
- workflow_id FK
- step_code
- name
- sequence
- role_code nullable
- required
```

### workflow_instances

```text
workflow_instances
- id PK
- workflow_id FK
- entity_type
- entity_id
- current_step_id FK
- status
- started_at
- completed_at nullable
```

### workflow_actions

```text
workflow_actions
- id PK
- workflow_instance_id FK
- step_id FK
- action
- performed_by FK
- comment nullable
- performed_at
```

---

# 22. CMS ERD

```text
pages
posts
categories
banners
faqs
media
```

Possible relationships:

```text
categories 1 ---- N posts
```

CMS should be isolated from confidential operational data.

---

# 23. Audit ERD

```text
users
  |
  +----< audit_logs
```

### audit_logs

```text
audit_logs
- id PK
- user_id FK nullable
- action
- entity_type
- entity_id nullable
- old_values JSONB nullable
- new_values JSONB nullable
- ip_address nullable
- user_agent nullable
- created_at
```

Audit logs should be append-only from the normal application interface.

---

# 24. Key Relationship Summary

```text
Organization
  |
  +-- Branch
  +-- Department
  +-- User

User
  |
  +-- Roles
  +-- Field Tasks
  +-- Credit Assignments
  +-- Audit Logs

Customer
  |
  +-- Loan Applications

Loan Application
  |
  +-- Product
  +-- Status History
  +-- Assignments
  +-- Analysis
  +-- Survey
  +-- Review
  +-- Decision
  +-- Realization
  +-- Documents
  +-- Workflow Instance

Purchase Request
  |
  +-- Items
  +-- Workflow
  +-- Purchase Order
          |
          +-- Goods Receipt
          |
          +-- Inventory / Asset
```

---

# 25. Indexing Guidelines

Important indexes:

```text
users.email
users.employee_number

leads.phone
leads.assigned_user_id
leads.status

customers.identity_number
customers.phone

loan_applications.application_number
loan_applications.status
loan_applications.branch_id
loan_applications.assigned_marketing_user_id
loan_applications.loan_product_id
loan_applications.created_at

loan_application_status_histories.application_id
loan_application_status_histories.changed_at

documents.owner_type + owner_id

field_tasks.assigned_to
field_tasks.status
field_tasks.due_at

inventory_items.sku

assets.asset_number
assets.serial_number
assets.status

purchase_requests.request_number
purchase_requests.status

purchase_orders.po_number

audit_logs.entity_type + entity_id
audit_logs.user_id
audit_logs.created_at
```

Indexes should be validated against actual query patterns.

---

# 26. Database Design Rules

- Use foreign keys.
- Use unique constraints for business identifiers.
- Use transactions for multi-table business operations.
- Use migrations.
- Avoid uncontrolled cascading deletes.
- Preserve historical business records.
- Use `created_at` and `updated_at` consistently.
- Add explicit `created_by` / `updated_by` where auditability requires it.
- Avoid storing derived values unless performance requires it.
- If derived values are stored, define the source-of-truth clearly.
