# BPR Operational Management System

## Project Specification for AI Coding Agents

### Version 1.0

------------------------------------------------------------------------

## 1. Project Overview

Build a web-based **BPR Operational Management System** for a Bank
Perkreditan Rakyat (BPR).

The application is **NOT a Core Banking System** and must not attempt to
replace the existing core banking system.

The application is an operational layer that helps BPR employees manage:

-   Public website
-   Online credit applications
-   CRM / prospective customers
-   Credit verification
-   Credit analysis
-   Field surveys
-   Credit review and approval workflow
-   Credit realization/disbursement records
-   Field officer activities and performance metrics
-   Document management
-   Inventory and asset management
-   Purchasing / procurement
-   Workflow and approval
-   Management dashboards
-   Operational reporting
-   Audit trail
-   CMS
-   Users, roles, permissions, and administration

The existing Core Banking System (CBS) remains the authoritative system
for core banking transactions such as accounts, balances, financial
postings, repayment transactions, ledger-related records, and other
transactional banking functions.

------------------------------------------------------------------------

# 2. Core Architectural Principle

The system must clearly separate responsibilities between:

### BPR Operational Management System

Owns:

-   Leads
-   Prospects
-   Operational customer/application data
-   Credit applications
-   Credit analysis
-   Surveys
-   Internal review
-   Internal approval workflow
-   Operational documents
-   Field officer activity
-   Operational tasks
-   Inventory
-   Assets
-   Purchasing
-   Operational reporting
-   CMS
-   Audit trail

### Existing Core Banking System

Owns:

-   Accounts
-   Account balances
-   Financial transactions
-   Ledger/posting
-   Repayment transactions
-   Core banking calculations
-   Transactional loan records
-   Other official banking transaction records

The Operational System may eventually integrate with the CBS through
APIs, but the first version does not require CBS integration unless an
API is available and explicitly approved.

------------------------------------------------------------------------

# 3. Recommended Technology Stack

Use:

-   Next.js
-   React
-   TypeScript
-   PostgreSQL
-   Prisma ORM
-   Tailwind CSS
-   shadcn/ui
-   Authentication system with secure session management
-   Object storage for uploaded documents/files
-   Server-side validation
-   Zod or equivalent schema validation
-   ESLint
-   Prettier
-   Git

Recommended architecture:

``` text
Browser
   |
   v
Next.js
   |
   +-- Public Website
   +-- Operational Portal
   +-- CMS
   +-- API / Server Actions
   +-- Authentication
   +-- Authorization
   +-- Business Logic
          |
          +---- PostgreSQL
          |
          +---- Object Storage
```

Use a **modular monolith** architecture initially.

Do NOT introduce microservices unless there is a clear technical
requirement.

------------------------------------------------------------------------

# 4. Database Decision

PostgreSQL is the primary database.

Google Sheets is NOT the source of truth.

Optional future integrations:

``` text
PostgreSQL
    |
    +-- Excel export
    +-- CSV export
    +-- PDF reports
    +-- Google Sheets reporting
```

Google Sheets may be used for reporting/export workflows but not as the
primary transactional database.

------------------------------------------------------------------------

# 5. High-Level Application Areas

The application consists of three major areas.

## 5.1 Public Website

Routes may include:

``` text
/
 /tentang
 /produk
 /produk/kredit
 /produk/tabungan
 /produk/deposito
 /simulasi
 /berita
 /berita/[slug]
 /promo
 /faq
 /kontak
 /pengajuan
```

Public content should be manageable from the CMS.

------------------------------------------------------------------------

## 5.2 Operational Portal

Example routes:

``` text
/dashboard
/crm
/crm/leads
/crm/customers

/credit
/credit/applications
/credit/applications/[id]
/credit/analysis
/credit/surveys
/credit/reviews
/credit/decisions
/credit/realizations

/field
/field/tasks
/field/activities
/field/performance

/documents

/inventory
/inventory/items
/inventory/assets
/inventory/transfers
/inventory/maintenance

/purchasing
/purchasing/requests
/purchasing/orders
/purchasing/receipts
/purchasing/vendors

/reports
/audit
```

------------------------------------------------------------------------

## 5.3 Administration

``` text
/admin/users
/admin/roles
/admin/permissions
/admin/master-data
/admin/settings
/admin/workflows
/admin/document-types
```

------------------------------------------------------------------------

# 6. Main Modules

The system should be divided into the following business domains.

1.  Authentication & Authorization
2.  CRM
3.  Credit Management
4.  Credit Analysis
5.  Survey
6.  Field Officer
7.  Document Management
8.  Workflow & Approval
9.  Inventory & Asset
10. Purchasing
11. Reporting
12. Audit
13. CMS
14. Notifications
15. Master Data

------------------------------------------------------------------------

# 7. Authentication and Authorization

Implement secure authentication.

Users must not automatically gain access to all modules.

Use RBAC:

``` text
User
  |
  +-- Role
        |
        +-- Permissions
```

Example roles:

-   Super Admin
-   Admin Operasional
-   Marketing
-   Field Officer
-   Credit Analyst
-   Credit Reviewer
-   Approver
-   Purchasing Officer
-   Asset Officer
-   Finance
-   Management
-   Auditor
-   CMS Editor
-   Viewer

Roles are configurable.

Do not hard-code role checks everywhere.

Prefer permission-based authorization:

``` text
credit.application.view
credit.application.create
credit.application.edit
credit.application.verify
credit.analysis.create
credit.analysis.review
credit.application.approve
credit.application.reject

inventory.asset.view
inventory.asset.create
inventory.asset.transfer

purchase.request.create
purchase.request.approve
purchase.order.create

report.credit.view
report.performance.view

audit.log.view
```

------------------------------------------------------------------------

# 8. CRM Module

CRM manages prospective customers before a formal credit application.

## Lead lifecycle

``` text
NEW
  |
CONTACTED
  |
QUALIFIED
  |
APPLICATION
  |
CONVERTED
```

Possible lead sources:

-   Website
-   Marketing
-   Referral
-   Walk-in
-   Event
-   WhatsApp
-   Other

Lead data may include:

-   Name
-   Phone
-   Address
-   Lead source
-   Assigned officer
-   Interested product
-   Notes
-   Status
-   Created date
-   Updated date

------------------------------------------------------------------------

# 9. Credit Application Module

Credit applications can originate from:

-   Public website
-   Marketing
-   Field officer
-   Internal staff

Initial lifecycle:

``` text
DRAFT
  |
SUBMITTED
  |
VERIFICATION
  |
ANALYSIS
  |
SURVEY
  |
REVIEW
  |
DECISION
  |
  +-- APPROVED
  |
  +-- REJECTED
  |
  +-- RETURNED
```

Each status change must create a history record.

Example:

``` text
Application #KRD-000123

09:01 SUBMITTED
09:15 VERIFICATION
10:20 ANALYSIS
13:10 SURVEY
15:30 REVIEW
16:00 APPROVED
```

Never overwrite historical status changes.

------------------------------------------------------------------------

# 10. Credit Application Data

A credit application may contain:

-   Application number
-   Applicant
-   Product
-   Requested amount
-   Requested tenor
-   Purpose
-   Source
-   Assigned marketing officer
-   Assigned analyst
-   Assigned survey officer
-   Status
-   Submission date
-   Notes
-   Related documents
-   Analysis
-   Survey
-   Review
-   Decision
-   Realization record

The exact fields must remain configurable where possible because
different BPR products may have different requirements.

------------------------------------------------------------------------

# 11. Credit Analysis

Credit analysis must be configurable and must not be hard-coded to a
single scoring model.

Possible analysis sections:

``` text
Identity
Character
Capacity
Capital
Collateral
Condition
Income
Expenses
Existing Financing
Business Information
Credit Purpose
Survey Result
Risk Assessment
Analyst Recommendation
```

Recommended conceptual entities:

``` text
credit_analyses
credit_analysis_items
credit_analysis_assessments
credit_analysis_recommendations
```

Do not reduce the entire analysis system to one hard-coded
`credit_score` field.

The BPR must be able to configure analysis criteria in the future.

------------------------------------------------------------------------

# 12. Survey Module

Survey tasks are assigned to field officers.

Example:

``` text
Survey #SV-0012

Applicant: Budi
Location: ...
Deadline: ...
Assigned Officer: ...
Status: ASSIGNED
```

Survey may include:

-   Applicant interview
-   Business condition
-   Address/location
-   Business photos
-   Supporting photos
-   Notes
-   Findings
-   Recommendations
-   Documents
-   Survey date
-   Survey officer

If location/GPS is implemented, handle it as sensitive operational data
and only collect/store it when there is a legitimate business
requirement and appropriate policy.

------------------------------------------------------------------------

# 13. Credit Review and Decision

After analysis and survey:

``` text
APPLICATION
    |
ANALYSIS
    |
SURVEY
    |
REVIEW
    |
DECISION
    |
    +-- APPROVED
    +-- REJECTED
    +-- RETURNED
```

Decision data may include:

-   Decision status
-   Approved amount
-   Approved tenor
-   Decision date
-   Decision maker
-   Reason
-   Notes
-   Conditions

All decisions must be auditable.

------------------------------------------------------------------------

# 14. Credit Realization / Disbursement Record

The Operational System records operational information about credit
realization.

Example:

``` text
Approved
   |
Ready for Realization
   |
Realized
```

Possible data:

``` text
loan_realizations

application_id
realization_date
amount
product
officer
reference_number
notes
created_by
created_at
```

Important:

The system must NOT become a second financial ledger.

If actual financial posting occurs in the Core Banking System, the
Operational System should store a reference or confirmation rather than
duplicating the financial ledger.

Future integration:

``` text
Operational System
        |
        | API
        v
Core Banking System
```

------------------------------------------------------------------------

# 15. Field Officer Module

Field officers need a task/activity system.

Features:

-   Assigned tasks
-   Survey assignments
-   Follow-up tasks
-   Customer visits
-   Activity records
-   Notes
-   Documents/photos
-   Status
-   Due dates
-   Activity history

Example:

``` text
Field Officer
   |
   +-- Leads
   +-- Applications
   +-- Surveys
   +-- Follow-ups
   +-- Tasks
   +-- Realizations
```

------------------------------------------------------------------------

# 16. Field Officer Performance

Performance should be derived from measurable activities rather than
manually entering arbitrary scores.

Metrics may include:

-   Number of leads
-   Number of applications
-   Number of surveys
-   Number of approved applications
-   Number of realized applications
-   Realized amount
-   Pending follow-ups
-   Completed tasks
-   Overdue tasks

Filters:

-   Date range
-   Branch
-   Officer
-   Product

The system should present factual operational metrics. Any formal HR
evaluation or compensation decision remains a business policy outside
the reporting engine.

------------------------------------------------------------------------

# 17. Document Management

Documents should be a separate module.

Database stores metadata.

Actual files should be stored in object storage.

Example:

``` text
Document
├── owner_type
├── owner_id
├── document_type
├── file_path
├── file_name
├── mime_type
├── size
├── version
├── uploaded_by
├── uploaded_at
└── status
```

Example application documents:

-   KTP
-   KK
-   Income proof
-   Business documents
-   Survey photos
-   Supporting documents
-   Approval documents

Security requirements:

-   Validate file type
-   Validate file size
-   Do not trust client MIME type alone
-   Use randomized storage names
-   Do not expose private files through public URLs
-   Use authorization checks before download
-   Log sensitive document access where appropriate

------------------------------------------------------------------------

# 18. Inventory Module

Inventory handles consumable/general stock.

Examples:

-   ATK
-   Paper
-   Toner
-   Office supplies

Inventory features:

-   Item master
-   Categories
-   Stock in
-   Stock out
-   Adjustment
-   Minimum stock
-   Location
-   Unit
-   Stock history

------------------------------------------------------------------------

# 19. Asset Management

Assets are individually identifiable operational equipment.

Examples:

-   Laptop
-   Printer
-   Smartphone
-   Motorcycle
-   AC
-   Furniture

Asset fields:

``` text
Asset Number
Category
Name
Serial Number
Purchase Date
Purchase Price
Location
Current Holder
Condition
Status
Vendor
Warranty
Documents
```

Asset lifecycle:

``` text
PURCHASED
   |
ASSIGNED
   |
TRANSFERRED
   |
MAINTENANCE
   |
RETURNED
   |
DISPOSED
```

Every assignment/transfer must create history.

------------------------------------------------------------------------

# 20. Purchasing Module

Purchasing workflow:

``` text
Purchase Request
       |
       v
Approval
       |
       v
Purchase Order
       |
       v
Goods Received
       |
       +---- Inventory
       |
       +---- Asset
```

Purchase Request may include:

-   Requester
-   Department
-   Item
-   Quantity
-   Estimated price
-   Purpose
-   Required date
-   Notes
-   Attachments
-   Approval status

Vendor management should be separate.

------------------------------------------------------------------------

# 21. Workflow and Approval Engine

Many modules require approval.

Do not implement each approval workflow as unrelated custom code.

Create a reusable workflow concept.

Conceptual entities:

``` text
workflows
workflow_steps
workflow_instances
workflow_actions
```

Example:

``` text
Purchase Request
    |
    v
Submitted
    |
    v
Approval
   / \
  /   \
Approved Rejected
   |
   v
Purchase Order
```

Credit:

``` text
Application
    |
Analysis
    |
Review
    |
Approval
```

The workflow engine should support:

-   Status
-   Step
-   Assignee
-   Role-based assignment
-   Action
-   Approval
-   Rejection
-   Return
-   Comment
-   Timestamp
-   History

------------------------------------------------------------------------

# 22. Audit Trail

Audit logging is mandatory.

Conceptual structure:

``` text
audit_logs

id
user_id
action
entity_type
entity_id
old_values
new_values
ip_address
user_agent
created_at
```

Examples:

``` text
CREATE
UPDATE
DELETE
APPROVE
REJECT
LOGIN
LOGOUT
UPLOAD
DOWNLOAD
STATUS_CHANGE
ASSIGN
TRANSFER
```

Example:

``` text
User: Andi
Action: UPDATE
Entity: loan_application
ID: 12345

Field:
plafond

Before:
100000000

After:
125000000
```

Audit logs must be append-oriented and should not be casually
editable/deletable through the normal UI.

------------------------------------------------------------------------

# 23. Reporting

Reporting should have two layers.

## Operational Dashboard

Examples:

-   Applications today
-   Applications this month
-   Pending verification
-   Pending analysis
-   Pending survey
-   Pending review
-   Pending approval
-   Pending purchasing
-   Outstanding tasks

## Management Reporting

Examples:

-   Credit pipeline
-   Applications by product
-   Applications by branch
-   Applications by period
-   Realization records
-   Field officer activity
-   Purchasing summary
-   Asset summary
-   Inventory summary
-   Operational activity

Exports:

-   XLSX
-   CSV
-   PDF
-   Optional Google Sheets

------------------------------------------------------------------------

# 24. CMS

CMS manages public website content.

Entities:

``` text
pages
posts
categories
banners
faqs
media
```

Features:

-   Create page
-   Edit page
-   Publish/unpublish
-   Draft
-   Schedule publication if needed
-   News
-   Promo
-   FAQ
-   Banner
-   Media library
-   SEO metadata

CMS content must be separated from operational data.

------------------------------------------------------------------------

# 25. Notifications

Future notification system should support:

-   In-app notifications
-   Email
-   Optional WhatsApp integration
-   Task reminders
-   Approval notifications
-   Application status notifications

Do not hard-code notification providers into business logic.

Use an abstraction such as:

``` text
NotificationService
```

with providers implemented separately.

------------------------------------------------------------------------

# 26. Master Data

Create centralized master data where appropriate.

Examples:

-   Branch
-   Department
-   Position
-   Product
-   Loan product
-   Asset category
-   Inventory category
-   Document type
-   Application source
-   Lead source
-   Vendor category
-   Units
-   Status definitions

Avoid duplicating these values throughout the codebase.

------------------------------------------------------------------------

# 27. Suggested PostgreSQL Domain Structure

Initial conceptual tables:

``` text
AUTH
├── users
├── roles
├── permissions
├── user_roles
└── role_permissions

CRM
├── leads
├── customers
└── customer_contacts

CREDIT
├── loan_products
├── loan_applications
├── loan_application_statuses
├── loan_application_status_histories
├── credit_analyses
├── credit_analysis_items
├── surveys
├── survey_items
├── credit_reviews
├── credit_decisions
└── loan_realizations

FIELD
├── field_officers
├── field_tasks
├── field_activities
└── field_activity_logs

DOCUMENT
├── documents
├── document_types
└── document_versions

INVENTORY
├── inventory_items
├── inventory_transactions
├── assets
├── asset_assignments
├── asset_transfers
├── asset_maintenance
└── asset_disposals

PURCHASING
├── purchase_requests
├── purchase_request_items
├── purchase_orders
├── purchase_order_items
├── goods_receipts
├── goods_receipt_items
└── vendors

WORKFLOW
├── workflows
├── workflow_steps
├── workflow_instances
└── workflow_actions

CMS
├── pages
├── posts
├── categories
├── banners
├── faqs
└── media

SYSTEM
├── audit_logs
├── notifications
├── settings
└── activity_logs
```

This is a conceptual model, not the final Prisma schema.

------------------------------------------------------------------------

# 28. Important Data Modeling Rules

1.  Use UUID or another non-sequential public identifier where
    appropriate.
2.  Use database foreign keys.
3.  Add indexes for frequently queried fields.
4.  Use timestamps consistently.
5.  Prefer soft-delete only where business/audit requirements justify
    it.
6.  Never silently overwrite important business history.
7.  Store status history for workflow entities.
8.  Keep audit logs separate from ordinary activity logs.
9.  Store file metadata in PostgreSQL and files in object storage.
10. Do not store large binary files directly in ordinary relational
    records unless there is a specific requirement.
11. Avoid excessive JSON fields for core relational business data.
12. JSON may be used for configurable metadata where justified.
13. Use database transactions for multi-step business operations.
14. Use migrations for all schema changes.
15. Never modify production schema manually without a migration.

------------------------------------------------------------------------

# 29. Security Requirements

Because the system may process personal and confidential BPR data,
security is a first-class requirement.

Implement:

-   Secure authentication
-   Password hashing
-   Secure sessions
-   Role-based access control
-   Permission-based authorization
-   Server-side authorization checks
-   Input validation
-   Output encoding
-   CSRF protection where applicable
-   XSS protection
-   SQL injection prevention through ORM/parameterized queries
-   Rate limiting
-   Secure file upload
-   Private document storage
-   Audit logging
-   Environment variables for secrets
-   No secrets in Git
-   Secure HTTP headers
-   Database backups
-   Error logging without leaking sensitive information

Never trust authorization performed only in the client UI.

Every sensitive server operation must verify permissions server-side.

------------------------------------------------------------------------

# 30. Privacy Principles

The application may contain:

-   Personal identity data
-   Contact data
-   Financial/application information
-   Documents
-   Internal employee information

Therefore:

-   Collect only necessary information.
-   Restrict access based on role and business need.
-   Avoid exposing sensitive information in URLs when possible.
-   Do not log sensitive personal data unnecessarily.
-   Do not include sensitive data in error messages.
-   Do not expose private documents publicly.
-   Maintain access logs where appropriate.
-   Define retention/deletion rules with the BPR.
-   Follow applicable Indonesian data protection and banking regulations
    and the BPR's internal policies.

The AI coding agent must not invent legal compliance claims.

------------------------------------------------------------------------

# 31. UI/UX Principles

The system is primarily an internal business application.

Prioritize:

-   Clear navigation
-   Fast data entry
-   Search
-   Filters
-   Pagination
-   Bulk actions where safe
-   Status badges
-   Approval visibility
-   Activity history
-   Responsive layout
-   Accessible forms
-   Clear validation errors
-   Confirmation for destructive operations

For tables:

-   Search
-   Sort
-   Filter
-   Pagination
-   Column visibility where useful
-   Export where authorized

For detail pages:

``` text
Header
Summary
Status
Actions
Main Data
Documents
Workflow
Activity
Audit/History
```

------------------------------------------------------------------------

# 32. Recommended Folder Structure

Use domain-oriented architecture.

``` text
src/
|
├── app/
│   ├── (public)/
│   ├── (portal)/
│   ├── admin/
│   └── api/
|
├── components/
│   ├── ui/
│   ├── forms/
│   ├── tables/
│   ├── charts/
│   └── layouts/
|
├── modules/
│   ├── crm/
│   ├── credit/
│   ├── field/
│   ├── documents/
│   ├── inventory/
│   ├── purchasing/
│   ├── workflow/
│   ├── reporting/
│   ├── audit/
│   └── cms/
|
├── lib/
│   ├── auth/
│   ├── db/
│   ├── storage/
│   ├── permissions/
│   ├── validation/
│   ├── logging/
│   └── notifications/
|
├── prisma/
│   ├── schema.prisma
│   └── migrations/
|
└── types/
```

------------------------------------------------------------------------

# 33. Development Principles for AI Coding Agents

The AI coding agent must follow these rules:

### Before coding

-   Inspect existing project structure.
-   Inspect package.json.
-   Inspect environment configuration.
-   Inspect existing database schema.
-   Inspect existing components.
-   Do not overwrite existing work without understanding it.
-   Ask for clarification when a business rule is genuinely ambiguous.

### During coding

-   Use TypeScript.
-   Avoid `any` unless explicitly justified.
-   Keep business logic out of UI components.
-   Validate all external/user input.
-   Perform authorization server-side.
-   Reuse shared components.
-   Reuse shared services.
-   Use database transactions where required.
-   Add appropriate indexes.
-   Add migrations.
-   Keep code modular.

### Before finishing a feature

-   Run type checking.
-   Run linting.
-   Run tests if available.
-   Check database migrations.
-   Check authorization.
-   Check empty/loading/error states.
-   Check mobile/responsive behavior where applicable.
-   Verify that sensitive data is not accidentally exposed.

------------------------------------------------------------------------

# 34. Do Not Build These as Core Banking Functions

The following should not be implemented as a duplicate ledger/core
banking engine:

-   Bank account ledger
-   Customer balance engine
-   General ledger
-   Financial transaction posting
-   Interest calculation as a replacement for CBS
-   Payment processing as a replacement for CBS
-   Repayment posting as a replacement for CBS

If needed, create operational references and future integration points.

------------------------------------------------------------------------

# 35. MVP Roadmap

## Phase 1 - Foundation

Implement:

-   Next.js project
-   TypeScript
-   PostgreSQL
-   Prisma
-   Authentication
-   User management
-   Role management
-   Permission management
-   Base layout
-   Navigation
-   Audit log
-   Master data foundation
-   File storage abstraction

------------------------------------------------------------------------

## Phase 2 - Credit Operations

Implement:

-   CRM
-   Lead
-   Customer
-   Loan products
-   Online credit application
-   Application management
-   Document management
-   Verification
-   Credit analysis
-   Survey
-   Review
-   Decision
-   Realization record
-   Status history
-   Credit dashboard

------------------------------------------------------------------------

## Phase 3 - Field Operations

Implement:

-   Field officer
-   Task assignment
-   Survey task
-   Activity tracking
-   Follow-up
-   Officer dashboard
-   Performance metrics

------------------------------------------------------------------------

## Phase 4 - Operational Management

Implement:

-   Inventory
-   Asset
-   Asset assignment
-   Asset transfer
-   Maintenance
-   Purchasing
-   Vendor
-   Purchase request
-   Approval
-   Purchase order
-   Goods receipt

------------------------------------------------------------------------

## Phase 5 - Management

Implement:

-   Management dashboard
-   Reports
-   Export
-   Advanced audit
-   Notifications

------------------------------------------------------------------------

## Phase 6 - Public Website & CMS

Implement:

-   Landing page
-   Product pages
-   News
-   Promo
-   FAQ
-   Banner
-   CMS
-   Online application integration

------------------------------------------------------------------------

## Phase 7 - External Integration

Potential integrations:

-   Core Banking API
-   Email
-   WhatsApp
-   Google Sheets
-   Other BPR systems

Do not implement an integration until its API contract and ownership are
known.

------------------------------------------------------------------------

# 36. Recommended Initial Screens

Build these first:

``` text
LOGIN

DASHBOARD

CRM
  ├── Leads
  ├── Customers
  └── Lead Detail

CREDIT
  ├── Applications
  ├── Application Detail
  ├── Analysis
  ├── Survey
  ├── Review
  ├── Decision
  └── Realization

FIELD
  ├── My Tasks
  ├── Activities
  └── Performance

DOCUMENTS

ADMIN
  ├── Users
  ├── Roles
  ├── Permissions
  └── Master Data

AUDIT

REPORTS
```

------------------------------------------------------------------------

# 37. Initial Dashboard

Dashboard should show only data the current user is authorized to see.

Example:

``` text
+----------------------------------------------------------+
| BPR Operational Dashboard                                |
+----------------------------------------------------------+
| Applications | Pending Analysis | Pending Survey        |
|     182      |        31         |        18             |
+----------------------------------------------------------+
| Pending Review | Pending Approval | Realized             |
|       12       |        9         |        87             |
+----------------------------------------------------------+

Credit Pipeline
-------------------------
Submitted       42
Verification    31
Analysis        27
Survey          18
Review          12
Approved        15

My Tasks
-------------------------
Survey #SV-001
Follow-up #FL-012
Review #RV-008
```

------------------------------------------------------------------------

# 38. Non-Functional Requirements

The application should be designed for:

-   Maintainability
-   Security
-   Auditability
-   Scalability
-   Testability
-   Clear separation of concerns

Performance targets should be defined later based on expected user count
and infrastructure.

Do not prematurely optimize.

------------------------------------------------------------------------

# 39. Future Scalability

The architecture should allow future addition of:

-   Multiple branches
-   Multiple business units
-   More loan products
-   More workflow types
-   More approval levels
-   Advanced reporting
-   Mobile/PWA field operations
-   CBS integration
-   WhatsApp integration
-   Email notifications
-   BI/data warehouse
-   Additional operational modules

------------------------------------------------------------------------

# 40. First Implementation Milestone

The first coding milestone should NOT implement every module.

Start with:

``` text
1. Project setup
2. PostgreSQL
3. Prisma
4. Authentication
5. User
6. Role
7. Permission
8. Base dashboard
9. Audit log
10. Master data
11. Basic workflow infrastructure
```

Then build the Credit module.

This creates a stable foundation before adding inventory, purchasing,
reporting, and CMS.

------------------------------------------------------------------------

# 41. Definition of Done

A feature is considered complete only when:

-   Database schema exists
-   Migration exists
-   Server-side validation exists
-   Authorization exists
-   UI exists
-   Loading state exists
-   Error state exists
-   Empty state exists
-   Audit behavior is implemented where relevant
-   Business workflow is respected
-   TypeScript passes
-   Lint passes
-   Tests exist where appropriate
-   Sensitive data is protected

------------------------------------------------------------------------

# 42. Important Instruction to the AI Coding Agent

Do not invent BPR business rules.

When a requirement affects:

-   Credit approval
-   Credit scoring
-   Risk assessment
-   Approval limits
-   Employee authority
-   Financial calculations
-   Regulatory reporting
-   Data retention
-   Legal compliance

the AI agent must distinguish between:

1.  Technical implementation
2.  Configurable business rules
3.  Rules that must be supplied/confirmed by the BPR

If the exact business rule is unknown, make the implementation
configurable or ask for clarification rather than inventing a policy.

------------------------------------------------------------------------

# 43. Current Project Status

This document represents the initial system architecture and functional
blueprint.

The following are intentionally NOT finalized yet:

-   Final ERD
-   Exact Prisma schema
-   Exact credit analysis formula
-   Exact approval hierarchy
-   Exact organizational structure
-   Exact branch structure
-   Exact document requirements
-   Exact purchasing approval limits
-   Exact reporting requirements
-   Core Banking API contract
-   Regulatory reporting requirements

These must be defined from actual BPR SOPs, forms, reports, and
organizational rules.

------------------------------------------------------------------------

# 44. Next Design Tasks

Before major feature development, create these documents:

1.  `ROLE_PERMISSION_MATRIX.md`
2.  `CREDIT_WORKFLOW.md`
3.  `CREDIT_ANALYSIS_REQUIREMENTS.md`
4.  `DATABASE_ERD.md`
5.  `DATABASE_SCHEMA.md`
6.  `PURCHASING_WORKFLOW.md`
7.  `INVENTORY_WORKFLOW.md`
8.  `FIELD_OFFICER_REQUIREMENTS.md`
9.  `REPORTING_REQUIREMENTS.md`
10. `SECURITY_REQUIREMENTS.md`
11. `API_SPECIFICATION.md`
12. `UI_ROUTE_MAP.md`

These documents become the source of truth for future AI coding
sessions.

------------------------------------------------------------------------

# 45. Suggested Project Documentation Structure

``` text
docs/
|
├── PROJECT_SPEC.md
├── ROLE_PERMISSION_MATRIX.md
├── CREDIT_WORKFLOW.md
├── CREDIT_ANALYSIS_REQUIREMENTS.md
├── DATABASE_ERD.md
├── DATABASE_SCHEMA.md
├── PURCHASING_WORKFLOW.md
├── INVENTORY_WORKFLOW.md
├── FIELD_OFFICER_REQUIREMENTS.md
├── REPORTING_REQUIREMENTS.md
├── SECURITY_REQUIREMENTS.md
├── API_SPECIFICATION.md
└── UI_ROUTE_MAP.md
```

`PROJECT_SPEC.md` is the current master document.
