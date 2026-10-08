# AI_CODING_AGENT_INSTRUCTIONS.md
# BPR Operational Management System

## 1. Purpose

You are an AI Coding Agent working on the **BPR Operational Management System**.

Your job is to implement the system according to the project specifications in this repository.

The application is an operational management system for a BPR. It is NOT a Core Banking System.

You must prioritize:

1. Correctness
2. Security
3. Maintainability
4. Auditability
5. Clear business boundaries
6. Incremental implementation
7. Type safety
8. Testability

Do not optimize for speed of implementation at the expense of architecture or data integrity.

---

# 2. Source of Truth

Before modifying code, read these files:

```text
PROJECT_SPEC.md

docs/ROLE_PERMISSION_MATRIX.md
docs/CREDIT_WORKFLOW.md
docs/DATABASE_ERD.md
docs/DATABASE_SCHEMA.md
```

If more specification files exist under `docs/`, inspect the relevant ones before implementing the affected module.

Priority order:

```text
Actual BPR-provided requirements/SOP
        >
Explicit user instructions
        >
Specific module specification
        >
PROJECT_SPEC.md
        >
General technical assumptions
```

If actual BPR SOP or user requirements conflict with a generic assumption in the documentation, follow the actual BPR requirement and update the documentation if appropriate.

---

# 3. Critical Rule: Do Not Invent Business Rules

Never invent business rules for:

- Credit approval limits
- Credit scoring
- Risk categories
- Approval hierarchy
- Employee authority
- Loan eligibility
- Financial calculations
- Regulatory reporting
- Data retention
- Mandatory documents
- Product-specific credit policy
- Compensation/KPI formulas

If a required business rule is unknown:

### Option A

Make it configurable.

### Option B

Ask the user for clarification.

Do NOT silently invent a rule.

Example:

Bad:

```text
if amount > 100000000:
    require_director_approval()
```

unless the BPR explicitly provided this rule.

Good:

```text
approval_policy configuration
```

with a TODO/question asking for the actual authority limit.

---

# 4. Core Banking Boundary

The application does NOT replace the Core Banking System.

Do not implement a duplicate:

- Ledger
- Account balance engine
- Financial posting engine
- Repayment ledger
- Interest engine as a replacement for CBS
- Banking transaction engine

The Operational System may store:

- Application information
- Approval information
- Realization confirmation
- Core banking reference
- Operational status

Actual financial transactions remain authoritative in the CBS.

Future CBS integration must be implemented behind a clear integration boundary.

---

# 5. Development Architecture

Use a modular monolith.

Recommended:

```text
Next.js
├── Public Website
├── Operational Portal
├── CMS
├── API / Server Actions
├── Authentication
├── Authorization
└── Business Modules
       |
       +-- PostgreSQL
       |
       +-- Object Storage
```

Do not introduce microservices unless explicitly requested or technically justified.

---

# 6. Technology Rules

Preferred stack:

- Next.js
- React
- TypeScript
- PostgreSQL
- Prisma
- Tailwind CSS
- shadcn/ui
- Zod or equivalent validation
- ESLint
- Prettier

Use the versions already established in `package.json` when working inside an existing project.

Do not upgrade major dependencies without a clear reason.

---

# 7. Repository Inspection Before Coding

Before writing code:

1. Inspect repository structure.
2. Read `package.json`.
3. Read existing environment examples.
4. Inspect Prisma schema if present.
5. Inspect migrations.
6. Inspect authentication implementation.
7. Inspect existing UI components.
8. Inspect existing route structure.
9. Inspect tests.
10. Check Git status if available.

Do not overwrite existing work blindly.

If an existing implementation differs from the documentation, inspect the reason before changing it.

---

# 8. Incremental Development

Implement one vertical slice at a time.

Recommended order:

```text
Foundation
    ↓
Authentication
    ↓
RBAC
    ↓
Audit
    ↓
Master Data
    ↓
Workflow Foundation
    ↓
CRM
    ↓
Credit
    ↓
Field Operations
    ↓
Inventory
    ↓
Purchasing
    ↓
Reporting
    ↓
CMS
    ↓
External Integrations
```

Do not build every UI page first and database logic later.

A feature should be implemented end-to-end:

```text
Database
    ↓
Domain Logic
    ↓
Authorization
    ↓
API / Server Action
    ↓
Validation
    ↓
UI
    ↓
Tests
```

---

# 9. Database Rules

PostgreSQL is the source of truth.

Do not use Google Sheets as the primary database.

Use Prisma migrations.

Every schema change must be represented by a migration.

Never silently modify production schema manually.

Before creating a new table:

1. Check `DATABASE_ERD.md`.
2. Check `DATABASE_SCHEMA.md`.
3. Check existing Prisma schema.
4. Check whether the concept already exists.

Avoid duplicate entities.

---

# 10. Prisma Rules

Use explicit relations.

Prefer:

```prisma
customerId String?
customer   Customer? @relation(...)
```

instead of storing unvalidated IDs without relations.

Use:

- UUID primary keys
- Unique business identifiers
- Foreign keys
- Appropriate indexes
- `createdAt`
- `updatedAt`

Use transactions for multi-step operations.

Example:

```text
Application submission
    |
    +-- update application
    +-- create status history
    +-- create workflow instance
    +-- create task
    +-- create audit event
```

These should be atomic where business correctness requires it.

---

# 11. Database History

Do not overwrite important business history.

For example:

Bad:

```text
application.status = "APPROVED"
```

without recording how it got there.

Good:

```text
application.status
+
loan_application_status_histories
+
workflow_actions
+
audit_logs
```

Important historical entities include:

- Credit status
- Credit decisions
- Application assignments
- Asset transfers
- Purchase approvals
- Workflow actions
- Audit records

---

# 12. Delete Policy

Do not provide normal hard-delete operations for critical business records unless explicitly approved.

Critical records include:

- Credit applications
- Credit decisions
- Credit realization records
- Status histories
- Audit logs
- Purchase orders
- Asset history

If a record must disappear from normal operational views, consider archival or a business-approved soft-delete mechanism.

Do not use soft-delete automatically on every table.

---

# 13. Authentication

Authentication must be secure.

Never:

- Store plaintext passwords.
- Store secrets in source code.
- Trust client-provided user identity.
- Trust client-provided role.
- Use localStorage as the sole security mechanism for sensitive sessions.

Use the authentication mechanism selected for the project.

---

# 14. Authorization

Authorization must be enforced on the server.

Example:

```text
credit.application.approve
```

must be checked server-side before the approval operation executes.

This is NOT enough:

```tsx
{canApprove && <ApproveButton />}
```

The server action/API must also check:

```text
authenticated user
+
permission
+
organization scope
+
branch scope
+
record scope
+
business transition
```

---

# 15. RBAC and Scope

Do not treat role as the only authorization rule.

Authorization may depend on:

```text
Organization
Branch
Department
Own record
Assigned record
Workflow stage
Approval authority
```

Example:

A Marketing user may have:

```text
credit.application.view
```

but only for:

```text
OWN
```

or:

```text
ASSIGNED
```

records.

The exact scope must follow the role matrix.

---

# 16. Segregation of Duties

Do not automatically allow one user to perform all credit stages.

Typical separation:

```text
Marketing
    ↓
Verification
    ↓
Credit Analyst
    ↓
Survey
    ↓
Reviewer
    ↓
Approver
```

If the BPR permits combined responsibilities, make the configuration explicit.

Never bypass segregation-of-duties checks just to make a demo work.

---

# 17. Validation

All external input must be validated.

Validate:

- Forms
- Query parameters
- Route parameters
- API payloads
- File metadata
- Import files
- Configuration values

Prefer Zod or equivalent schema validation.

Client validation improves UX.

Server validation is mandatory for security and correctness.

---

# 18. Error Handling

Never expose internal implementation details to users.

Bad:

```text
PrismaClientKnownRequestError: Unique constraint failed...
```

Good:

```text
Data could not be saved because the application number already exists.
```

Log technical details securely.

User-facing errors should be actionable.

---

# 19. Loading and Empty States

Every data-heavy screen should handle:

```text
Loading
Empty
Error
Success
Unauthorized
Not Found
```

Do not leave blank screens when a query returns no records.

---

# 20. Forms

Forms should have:

- Clear labels
- Required indicators
- Validation
- Helpful errors
- Loading state
- Submit state
- Unsaved-change handling where relevant
- Server-side validation

Do not rely on placeholders as field labels.

---

# 21. Tables

Operational tables should support appropriate combinations of:

- Search
- Filter
- Sort
- Pagination
- Status filter
- Date filter
- Branch filter
- Officer filter
- Export

Do not load thousands of rows into the browser unnecessarily.

Use server-side pagination for large datasets.

---

# 22. Credit Workflow Rules

Use `docs/CREDIT_WORKFLOW.md`.

Do not allow arbitrary status transitions.

Example:

```text
DRAFT
  -> SUBMITTED

SUBMITTED
  -> VERIFICATION

VERIFICATION
  -> ANALYSIS
  -> RETURNED

ANALYSIS
  -> SURVEY
  -> RETURNED

SURVEY
  -> REVIEW
  -> RETURNED

REVIEW
  -> DECISION
  -> RETURNED

DECISION
  -> APPROVED
  -> REJECTED
  -> RETURNED

APPROVED
  -> READY_FOR_REALIZATION

READY_FOR_REALIZATION
  -> REALIZED
```

The actual transition rules should be centralized.

Do not duplicate transition logic in multiple UI components.

---

# 23. Workflow Engine

Workflow logic should be reusable.

Prefer:

```text
workflow service
```

rather than:

```text
if application...
else if purchase...
else if asset...
```

spread across controllers and components.

Workflow operations should validate:

1. Current status
2. Allowed transition
3. User permission
4. Organizational scope
5. Required fields
6. Required documents
7. Approval authority
8. Segregation of duties where configured

---

# 24. Audit Logging

Audit sensitive operations.

Examples:

```text
CREATE
UPDATE
DELETE
APPROVE
REJECT
RETURN
STATUS_CHANGE
ASSIGN
TRANSFER
UPLOAD
DOWNLOAD
LOGIN
LOGOUT
```

At minimum capture:

```text
user
action
entity
entity ID
timestamp
```

For important changes also capture:

```text
old values
new values
```

Do not put unnecessary sensitive personal data into logs.

---

# 25. File Upload Security

Documents may contain highly sensitive information.

Requirements:

- Validate file size.
- Validate extension.
- Validate actual file type where possible.
- Generate randomized storage keys.
- Store private files outside public web directories.
- Authorize every download.
- Do not expose direct permanent public URLs for confidential documents.
- Consider checksum/hash.
- Log important document actions.

Never trust:

```text
filename
Content-Type
extension
```

from the client alone.

---

# 26. Document Access

A user must have authorization to:

- View document metadata
- Download document
- Replace document
- Delete/retire document

A URL such as:

```text
/documents/123/download
```

must still perform server-side authorization.

Do not assume obscurity of an ID is security.

---

# 27. Credit Analysis

Credit analysis must remain configurable.

Do not hard-code a scoring formula unless supplied by the BPR.

Bad:

```text
score =
income * 0.4 +
age * 0.2 +
collateral * 0.4
```

unless this is an actual approved BPR rule.

Prefer configurable criteria and explicit analysis records.

---

# 28. Financial Data

Use appropriate numeric types.

For monetary amounts:

```text
NUMERIC(18,2)
```

Do not use JavaScript floating-point arithmetic for authoritative financial calculations.

If a financial calculation is required, use a decimal-safe approach.

Remember:

The Operational System is not the financial ledger.

---

# 29. Credit Realization

When recording realization:

```text
Operational System
    |
    +-- realization record
    +-- CBS reference
```

Do not create a second transaction ledger.

If CBS integration is unavailable, allow manual confirmation according to authorized workflow.

---

# 30. Inventory

Inventory stock must be traceable.

Prefer:

```text
Stock In
Stock Out
Adjustment
Transfer
```

as transactions.

Do not let arbitrary users directly edit a `current_stock` value without a corresponding transaction/history.

---

# 31. Assets

Asset changes must be historical.

For example:

```text
Asset
  |
  +-- Assignment history
  +-- Transfer history
  +-- Maintenance history
  +-- Disposal history
```

Do not overwrite the entire history when the asset changes holder.

---

# 32. Purchasing

Purchasing should follow the configured workflow.

Do not automatically approve requests because an administrator is logged in.

Approval must still verify:

- Permission
- Scope
- Workflow step
- Authority
- Required information

Approval actions must be audited.

---

# 33. Reporting

Reports must clearly distinguish:

```text
Source data
Calculated metric
Business KPI
```

Do not invent KPI formulas.

If a report requires a KPI definition not supplied by the BPR, ask for the formula or make it configurable.

---

# 34. CMS

CMS content is public-facing.

Treat CMS content separately from confidential operational data.

CMS permissions:

```text
view
create
update
publish
delete
```

Publishing should be permission-controlled.

Do not expose draft content publicly.

---

# 35. Notifications

Do not hard-code email/WhatsApp calls throughout business logic.

Use:

```text
NotificationService
```

and provider adapters.

Example:

```text
NotificationService
  |
  +-- InAppProvider
  +-- EmailProvider
  +-- WhatsAppProvider
```

Only implement providers that are actually configured.

---

# 36. API / Server Actions

Business rules must live in reusable server-side services/domain functions.

Avoid putting complex business logic directly inside React components.

Preferred:

```text
UI
 |
Server Action / API
 |
Application Service
 |
Domain Logic
 |
Repository / Prisma
```

The exact structure may vary, but separation of concerns must remain clear.

---

# 37. TypeScript Rules

Avoid `any`.

Prefer:

```ts
unknown
```

plus validation/narrowing where external data is involved.

Use shared types carefully.

Do not create giant global types containing every domain.

Keep domain types near the domain where practical.

---

# 38. Environment Variables

Never hard-code:

- Database credentials
- API keys
- Encryption keys
- Authentication secrets
- Storage credentials
- External service secrets

Maintain:

```text
.env.example
```

with placeholder values.

Never commit `.env`.

---

# 39. Testing Strategy

At minimum, create tests for important business logic.

Priority:

### Unit tests

- Status transitions
- Permission checks
- Approval rules
- Validation
- Inventory calculations
- Workflow transitions

### Integration tests

- Database operations
- Application submission
- Approval
- Asset transfer
- Purchase workflow

### End-to-end tests

Important user journeys:

```text
Login
Create Lead
Create Application
Submit Application
Verify
Analyze
Survey
Review
Approve
Record Realization
```

---

# 40. Definition of Done

A feature is NOT complete merely because the UI works.

A feature is complete when:

```text
[ ] Database schema
[ ] Migration
[ ] Server validation
[ ] Authorization
[ ] Business logic
[ ] API/server action
[ ] UI
[ ] Loading state
[ ] Empty state
[ ] Error state
[ ] Audit behavior
[ ] Tests
[ ] Type check
[ ] Lint
[ ] Documentation
```

---

# 41. Migration Safety

Before changing database schema:

1. Read current schema.
2. Read current migration history.
3. Determine migration impact.
4. Create a new migration.
5. Check for destructive operations.
6. Consider existing data.
7. Run migration in development.
8. Run tests.
9. Only then proceed toward production.

Do not casually use destructive commands such as:

```text
prisma db push --force-reset
```

on important environments.

Never reset a production database.

---

# 42. Seed Data

Development seed data may include:

- Example organization
- Example branch
- Example departments
- Roles
- Permissions
- Development users
- Example loan products
- Example workflow

Clearly label development/demo data.

Do not seed fake production customers into production.

Never put real personal data in seed files.

---

# 43. Logging

Application logs should be useful but privacy-conscious.

Do not log:

- Passwords
- Authentication secrets
- Full identity documents
- Full confidential financial records
- Private document contents

Use structured logs where practical.

---

# 44. Performance

Do not optimize prematurely.

But avoid obvious problems:

- N+1 queries
- Loading entire tables
- Unbounded API responses
- Large document downloads through memory
- Repeated identical database queries

Use:

- Pagination
- Appropriate indexes
- Selective queries
- Streaming/download mechanisms where appropriate
- Caching only where justified

---

# 45. UI Design

The application is primarily an operational business application.

Prioritize:

- Clarity
- Speed
- Searchability
- Consistency
- Accessibility
- Error prevention

Do not prioritize flashy animations over usability.

Use consistent:

```text
Status badges
Buttons
Forms
Tables
Dialogs
Cards
Tabs
Breadcrumbs
```

---

# 46. Responsive Design

Public website must be fully responsive.

Operational portal should support:

- Desktop
- Laptop
- Tablet where practical

Field officer interfaces should be designed with mobile usage in mind if field operations are expected to use phones.

---

# 47. Documentation Updates

When a business or architectural decision changes:

Update the relevant document.

Examples:

```text
Role change
 -> ROLE_PERMISSION_MATRIX.md

Credit workflow change
 -> CREDIT_WORKFLOW.md

Database change
 -> DATABASE_ERD.md
 -> DATABASE_SCHEMA.md

System architecture change
 -> PROJECT_SPEC.md
```

Do not leave documentation permanently inconsistent with implementation.

---

# 48. Change Management

Before making a major architecture change:

Explain:

1. Why the change is necessary.
2. What files/modules are affected.
3. What data migration is required.
4. What risks exist.
5. What alternative was considered.

Do not replace the selected architecture simply because another technology is fashionable.

---

# 49. When Requirements Are Ambiguous

Use this process:

```text
Can the ambiguity be safely represented as configuration?
       |
       +-- YES -> Implement configurable design.
       |
       +-- NO
             |
             v
        Ask the user.
```

Do not make silent assumptions about important business rules.

---

# 50. When a User Requests a Shortcut

If the shortcut creates security or data-integrity risk:

Explain the technical consequence and propose the smallest safe alternative.

Examples:

Bad shortcut:

```text
Allow every admin to approve every credit.
```

Better:

```text
Create configurable approval permission and authority scope.
```

Bad shortcut:

```text
Store KTP files in /public/uploads.
```

Better:

```text
Store private files in protected object storage.
```

---

# 51. AI Agent Work Protocol

For every task:

## Step 1

Read relevant documentation.

## Step 2

Inspect existing implementation.

## Step 3

State the intended change internally.

## Step 4

Implement the smallest complete vertical slice.

## Step 5

Run:

```text
typecheck
lint
tests
```

when available.

## Step 6

Inspect generated migration.

## Step 7

Verify authorization.

## Step 8

Verify error/loading/empty states.

## Step 9

Update documentation if architecture/business behavior changed.

## Step 10

Report:

- What changed
- Files changed
- Database changes
- Tests run
- Remaining TODOs
- Any business decision still required

---

# 52. Never Do This

Do not:

- Invent credit policies.
- Invent approval limits.
- Invent regulatory requirements.
- Duplicate the Core Banking ledger.
- Bypass authorization.
- Trust client-side permissions.
- Store secrets in source code.
- Expose private documents publicly.
- Delete important business history.
- Reset production databases.
- Add dependencies unnecessarily.
- Rewrite unrelated modules.
- Change architecture without justification.
- Hide unresolved errors.
- Mark incomplete features as complete.

---

# 53. First Implementation Task

When starting from an empty repository, implement only the foundation first.

Order:

```text
1. Next.js + TypeScript
2. Tailwind + shadcn/ui
3. PostgreSQL
4. Prisma
5. Environment configuration
6. Authentication
7. Users
8. Roles
9. Permissions
10. RBAC middleware/server utilities
11. Base dashboard
12. Audit logging
13. Organization/branch/department master data
14. Workflow foundation
```

Do NOT implement the entire credit module in the first task.

---

# 54. Second Implementation Task

After foundation is stable:

```text
CRM
  |
Lead
  |
Customer
  |
Loan Application
```

Implement this as the first business vertical slice.

---

# 55. Third Implementation Task

Then implement:

```text
Credit Verification
    |
Credit Analysis
    |
Survey
    |
Review
    |
Decision
    |
Realization Record
```

Use the workflow and audit infrastructure.

---

# 56. Recommended Git Strategy

Use small commits.

Examples:

```text
feat(auth): add authentication foundation
feat(rbac): add role and permission system
feat(audit): add audit logging
feat(crm): add lead management
feat(credit): add loan application
feat(credit): add application workflow
feat(credit): add credit analysis
feat(field): add survey tasks
```

Avoid giant commits such as:

```text
feat: build entire BPR system
```

---

# 57. Final Principle

The goal is not to make the AI agent generate the maximum amount of code.

The goal is to create a reliable BPR operational system with:

```text
Clear business boundaries
+
Secure access control
+
Auditable workflows
+
Reliable data
+
Maintainable architecture
+
Configurable business rules
```

When in doubt:

```text
Do not guess important business rules.
Do not compromise security.
Do not compromise data integrity.
Ask for clarification or make the rule configurable.
```
