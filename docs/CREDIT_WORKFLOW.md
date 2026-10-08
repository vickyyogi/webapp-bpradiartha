# CREDIT_WORKFLOW.md
# BPR Operational Management System

## 1. Purpose

Define the initial operational workflow for credit applications.

This workflow is a technical baseline. It must be reconciled with the BPR's actual SOP, authority limits, product rules, and regulatory/internal requirements before production use.

---

# 2. Core Principle

The Operational System manages the workflow and operational records.

The Core Banking System remains authoritative for core financial transactions.

```text
Operational System
    |
    +-- Application
    +-- Verification
    +-- Analysis
    +-- Survey
    +-- Review
    +-- Decision
    +-- Realization Record
             |
             v
       Core Banking
       (actual transaction)
```

---

# 3. High-Level Workflow

```text
DRAFT
  |
  v
SUBMITTED
  |
  v
VERIFICATION
  |
  +---- RETURNED_TO_APPLICANT
  |
  v
ANALYSIS
  |
  v
SURVEY
  |
  v
REVIEW
  |
  v
DECISION
  |
  +---- APPROVED
  |        |
  |        v
  |   READY_FOR_REALIZATION
  |        |
  |        v
  |    REALIZED
  |
  +---- REJECTED
  |
  +---- RETURNED
```

The exact sequence may vary by product.

---

# 4. Status Definitions

## DRAFT

Application is being prepared.

Allowed:

- Create
- Edit
- Upload documents
- Save draft

Not yet part of the formal processing queue.

---

## SUBMITTED

Applicant/application has been formally submitted.

System should:

- Generate application number
- Store submission timestamp
- Create status history
- Notify relevant operational role if notification is enabled

Editing should be restricted according to policy.

---

## VERIFICATION

Operational staff verify:

- Required fields
- Required documents
- Basic identity information
- Completeness

Possible outcomes:

```text
VERIFIED
RETURNED
```

---

## ANALYSIS

Credit analyst evaluates the application.

Possible sections:

- Identity
- Income
- Expenses
- Existing financing
- Business information
- Purpose
- Character
- Capacity
- Capital
- Collateral
- Condition
- Risk factors
- Recommendation

Possible outcomes:

```text
ANALYSIS_COMPLETED
RETURNED
```

---

## SURVEY

Field officer performs the required survey.

Possible data:

- Visit date
- Interview
- Location
- Business condition
- Photos
- Findings
- Supporting documents
- Recommendation

Possible outcomes:

```text
SURVEY_COMPLETED
RETURNED
```

Survey may happen before or after analysis depending on product configuration.

---

# 5. Review

Reviewer checks the complete application package.

Reviewer may inspect:

- Application
- Documents
- Verification
- Analysis
- Survey
- Previous history
- Recommendation

Possible outcomes:

```text
REVIEW_COMPLETED
RETURNED
```

---

# 6. Decision

An authorized approver makes a decision.

Possible outcomes:

```text
APPROVED
REJECTED
RETURNED
```

Approval may include:

- Approved amount
- Approved tenor
- Conditions
- Decision notes
- Decision date
- Decision maker

Approval authority must be configurable.

Do not hard-code monetary approval limits until the BPR provides them.

---

# 7. Ready for Realization

For approved applications:

```text
APPROVED
   |
   v
READY_FOR_REALIZATION
```

Operational checklist may verify:

- Required approval completed
- Required documents complete
- Conditions satisfied
- Internal checklist complete
- CBS reference prepared if applicable

---

# 8. Realized

The Operational System records that the credit realization/disbursement has occurred.

Possible fields:

```text
application_id
realization_date
amount
reference_number
core_banking_reference
notes
confirmed_by
confirmed_at
```

If the CBS supports API integration, `core_banking_reference` can be populated from the CBS.

Do not create a second financial ledger.

---

# 9. Rejection

When rejected:

```text
DECISION
   |
   v
REJECTED
```

Store:

- Reason code
- Reason notes
- Decision maker
- Timestamp

The rejection history must remain immutable from ordinary users.

---

# 10. Return / Correction

A return means the process needs additional information or correction.

Examples:

```text
REVIEW
  |
  v
RETURNED
  |
  v
ANALYSIS
```

or:

```text
VERIFICATION
  |
  v
RETURNED
```

The system should require a return reason/comment.

---

# 11. Status Transition Rules

Recommended transition matrix:

| Current | Allowed Next |
|---|---|
| DRAFT | SUBMITTED |
| SUBMITTED | VERIFICATION |
| VERIFICATION | ANALYSIS, RETURNED |
| ANALYSIS | SURVEY, RETURNED |
| SURVEY | REVIEW, RETURNED |
| REVIEW | DECISION, RETURNED |
| DECISION | APPROVED, REJECTED, RETURNED |
| APPROVED | READY_FOR_REALIZATION |
| READY_FOR_REALIZATION | REALIZED |
| RETURNED | Configured previous processing stage |

Do not allow arbitrary status changes.

---

# 12. State Transition Audit

Every transition must create:

```text
loan_application_status_histories
```

Fields:

```text
id
application_id
from_status
to_status
reason
comment
changed_by
changed_at
```

---

# 13. Assignment

Applications may be assigned to:

- Marketing officer
- Verification officer
- Credit analyst
- Survey officer
- Reviewer
- Approver

Assignments should create history.

Conceptual:

```text
loan_application_assignments
```

Fields:

```text
application_id
stage
assigned_to
assigned_by
assigned_at
unassigned_at
reason
```

---

# 14. Tasks

Workflow stages can create tasks.

Example:

```text
Application submitted
       |
       v
Verification Task
       |
       v
Analysis Task
       |
       v
Survey Task
       |
       v
Review Task
       |
       v
Decision Task
```

Each task should have:

- Task type
- Owner/assignee
- Due date
- Priority
- Status
- Related entity
- Completion timestamp

---

# 15. SLA / Due Dates

The system should support configurable due dates.

Example:

```text
Verification: 1 business day
Analysis: 2 business days
Survey: 2 business days
Review: 1 business day
Decision: 1 business day
```

These values are placeholders only.

Actual SLA must be configured by the BPR.

---

# 16. Credit Product Configuration

Different loan products may have different:

- Required documents
- Required analysis fields
- Survey requirements
- Approval levels
- Workflow stages
- SLA
- Amount limits

Therefore workflow should be configurable per product where practical.

---

# 17. Approval Authority

Do not hard-code:

```text
Manager <= X
Director <= Y
```

until actual authority limits are provided.

Recommended conceptual configuration:

```text
approval_policies
approval_policy_steps
```

Possible conditions:

- Product
- Amount
- Branch
- Risk category
- Purpose
- Customer category

---

# 18. Exception Handling

The system must handle:

- Missing documents
- Duplicate applications
- Returned applications
- Re-assignment
- Officer absence
- Cancelled applications
- Rejected applications
- Failed CBS integration
- Duplicate realization confirmation

Each exception should be recorded rather than silently overwritten.

---

# 19. Duplicate Application Detection

The system should support configurable duplicate checks.

Possible matching signals:

- Applicant identity number
- Phone
- Existing customer reference
- Application similarity

Do not automatically reject solely based on a match unless business rules explicitly require it.

---

# 20. Notifications

Potential notification events:

```text
APPLICATION_SUBMITTED
APPLICATION_ASSIGNED
TASK_ASSIGNED
APPLICATION_RETURNED
ANALYSIS_COMPLETED
SURVEY_COMPLETED
REVIEW_COMPLETED
APPLICATION_APPROVED
APPLICATION_REJECTED
REALIZATION_READY
REALIZATION_CONFIRMED
TASK_OVERDUE
```

Notification providers should be abstracted.

---

# 21. Cancellation

If cancellation is required, add:

```text
CANCELLED
```

with:

- Cancellation reason
- Cancelled by
- Cancelled at

Cancellation rules must be defined by the BPR.

---

# 22. Reporting Metrics

Useful factual metrics:

- Applications by status
- Applications by product
- Applications by branch
- Average processing time by stage
- Pending tasks
- Overdue tasks
- Approved amount
- Realized amount
- Rejection counts
- Return counts
- Application volume

Avoid calculating official performance/KPI definitions until management confirms the formulas.

---

# 23. Workflow Configuration Principle

The implementation should separate:

```text
Workflow Engine
```

from:

```text
Credit Business Rules
```

This allows the BPR to change workflow without rewriting the entire application.
