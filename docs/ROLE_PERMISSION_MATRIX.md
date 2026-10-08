# ROLE_PERMISSION_MATRIX.md
# BPR Operational Management System

## 1. Purpose

This document defines the initial Role-Based Access Control (RBAC) model for the BPR Operational Management System.

This is a technical baseline, not a final organizational policy. The BPR must confirm actual roles, approval authority, branch scope, and segregation-of-duties requirements before production deployment.

---

## 2. Authorization Model

Use:

```text
User
  |
  +-- UserRole
          |
          +-- Role
                  |
                  +-- RolePermission
                          |
                          +-- Permission
```

Authorization must be enforced server-side.

The UI may hide unavailable actions, but UI visibility is NOT a security boundary.

---

## 3. Initial Roles

| Role | Primary Responsibility | Default Scope |
|---|---|---|
| SUPER_ADMIN | Technical/system administration | All |
| ADMIN_OPERASIONAL | Operational administration | Assigned organization |
| MARKETING | Leads and credit applications | Assigned branch/portfolio |
| FIELD_OFFICER | Survey and field activities | Assigned tasks/branch |
| CREDIT_ANALYST | Credit analysis | Assigned applications/branch |
| CREDIT_REVIEWER | Review and recommendation | Assigned applications/branch |
| APPROVER | Approval/decision according to authority | Assigned approval scope |
| PURCHASING_OFFICER | Purchasing | Assigned organization |
| ASSET_OFFICER | Assets and inventory | Assigned organization |
| FINANCE | Purchasing/operational financial records | Assigned organization |
| MANAGEMENT | Management dashboards/reports | Organization-wide or assigned scope |
| AUDITOR | Audit/read-only investigation | Authorized scope |
| CMS_EDITOR | Public website content | CMS only |
| VIEWER | Read-only access | Assigned scope |

These roles may be renamed or split after the BPR confirms its organization structure.

---

## 4. Permission Naming Convention

Use:

```text
<domain>.<resource>.<action>
```

Examples:

```text
credit.application.view
credit.application.create
credit.application.update
credit.application.verify
credit.application.assign
credit.application.approve
```

Actions should be explicit.

Recommended actions:

```text
view
create
update
delete
submit
assign
verify
review
approve
reject
return
export
download
publish
manage
```

---

## 5. Permission Catalog

### 5.1 Dashboard

```text
dashboard.view
dashboard.management_view
```

### 5.2 CRM

```text
crm.lead.view
crm.lead.create
crm.lead.update
crm.lead.delete
crm.lead.assign
crm.customer.view
crm.customer.create
crm.customer.update
```

### 5.3 Credit Applications

```text
credit.application.view
credit.application.create
credit.application.update
credit.application.delete
credit.application.submit
credit.application.assign
credit.application.verify
credit.application.return
credit.application.export
```

### 5.4 Credit Analysis

```text
credit.analysis.view
credit.analysis.create
credit.analysis.update
credit.analysis.submit
credit.analysis.return
```

### 5.5 Survey

```text
credit.survey.view
credit.survey.create
credit.survey.update
credit.survey.assign
credit.survey.submit
```

### 5.6 Credit Review

```text
credit.review.view
credit.review.create
credit.review.update
credit.review.submit
credit.review.return
```

### 5.7 Credit Decision

```text
credit.decision.view
credit.decision.approve
credit.decision.reject
credit.decision.return
```

### 5.8 Credit Realization Record

```text
credit.realization.view
credit.realization.create
credit.realization.update
credit.realization.confirm
credit.realization.export
```

### 5.9 Field Operations

```text
field.task.view
field.task.create
field.task.assign
field.task.update
field.activity.view
field.activity.create
field.activity.update
field.performance.view
```

### 5.10 Documents

```text
document.view
document.upload
document.update
document.delete
document.download
document.manage_types
```

### 5.11 Inventory

```text
inventory.item.view
inventory.item.create
inventory.item.update
inventory.stock_in
inventory.stock_out
inventory.adjust
inventory.export
```

### 5.12 Assets

```text
asset.view
asset.create
asset.update
asset.assign
asset.transfer
asset.maintenance
asset.dispose
asset.export
```

### 5.13 Purchasing

```text
purchase.request.view
purchase.request.create
purchase.request.update
purchase.request.submit
purchase.request.approve
purchase.request.reject

purchase.order.view
purchase.order.create
purchase.order.update
purchase.order.approve

purchase.receipt.view
purchase.receipt.create
```

### 5.14 Vendors

```text
vendor.view
vendor.create
vendor.update
```

### 5.15 Reports

```text
report.credit.view
report.credit.export
report.field.view
report.field.export
report.inventory.view
report.inventory.export
report.purchasing.view
report.purchasing.export
report.management.view
report.management.export
```

### 5.16 CMS

```text
cms.page.view
cms.page.create
cms.page.update
cms.page.publish
cms.page.delete

cms.post.view
cms.post.create
cms.post.update
cms.post.publish
cms.post.delete

cms.banner.manage
cms.faq.manage
cms.media.manage
```

### 5.17 Administration

```text
admin.user.view
admin.user.create
admin.user.update
admin.user.disable

admin.role.view
admin.role.create
admin.role.update

admin.permission.view

admin.master_data.view
admin.master_data.manage

admin.workflow.view
admin.workflow.manage

admin.settings.view
admin.settings.manage
```

### 5.18 Audit

```text
audit.log.view
audit.log.export
```

---

## 6. Initial Role Matrix

`C` = create, `R` = view/read, `U` = update, `A` = approval/decision, `X` = export, `M` = manage.

| Domain | Super Admin | Admin Ops | Marketing | Field Officer | Analyst | Reviewer | Approver | Purchasing | Asset | Finance | Management | Auditor | CMS |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Dashboard | M | R | R | R | R | R | R | R | R | R | M | R | - |
| CRM | M | M | M | R/C | R | R | R | - | - | - | R | R | - |
| Credit Application | M | M | C/U | R/U | R | R | R | - | - | - | R | R | - |
| Credit Analysis | M | R | - | R | C/U | R | R | - | - | - | R | R | - |
| Survey | M | R | R | C/U | R | R | R | - | - | - | R | R | - |
| Review | M | R | - | - | C | C/U | R | - | - | - | R | R | - |
| Decision | M | R | - | - | - | C/R | A | - | - | - | R | R | - |
| Realization Record | M | C/U | R | R | R | R | A/R | - | - | R | R | R | - |
| Field Performance | M | R | R | R(self) | R | R | R | - | - | - | M | R | - |
| Documents | M | M | C/U | C/U | R/U | R/U | R | - | R | R | R | R | - |
| Inventory | M | M | - | - | - | - | R | R | M | R | R | R | - |
| Assets | M | M | - | - | - | - | R | R | M | R | R | R | - |
| Purchasing | M | M | - | - | - | - | A | C/U | R | R | R | R | - |
| Reports | M | M | R | R | R | R | R | R | R | R | M | R/X | - |
| CMS | M | R | - | - | - | - | - | - | - | - | R | - | M |
| Users/Roles | M | M* | - | - | - | - | - | - | - | - | R | - | - |
| Audit | M | R | - | - | - | - | - | - | - | - | R | M | - |

`M*` means only if explicitly delegated by Super Admin.

This matrix is a baseline. Actual access must also consider organizational scope.

---

## 7. Scope-Based Authorization

A permission alone is not enough.

A user may have:

```text
credit.application.view
```

but only be allowed to view:

- Their assigned applications
- Their branch
- Their department
- Their organization

depending on policy.

Recommended scope dimensions:

```text
organization_id
branch_id
department_id
assigned_user_id
```

The authorization layer should support:

```text
GLOBAL
ORGANIZATION
BRANCH
DEPARTMENT
OWN
ASSIGNED
```

Do not assume every role needs global access.

---

## 8. Segregation of Duties

The system should support separation between:

```text
Applicant/Marketing
       |
       v
Verification
       |
       v
Credit Analysis
       |
       v
Review
       |
       v
Approval
```

A user should not automatically be allowed to perform every stage simply because they have a broad role.

Final segregation-of-duties rules must be confirmed by the BPR.

---

## 9. Permission Implementation Rules

1. Check permission on the server.
2. Check organizational scope.
3. Check record ownership/assignment where required.
4. Do not rely on hidden buttons.
5. Log sensitive actions.
6. Log approvals/rejections.
7. Protect exports because exports may contain sensitive data.
8. Protect document downloads.
9. Never allow a client to choose an arbitrary role/permission without server authorization.
10. Changes to roles and permissions should themselves be audited.

---

# 10. Future Extension

Possible future permissions:

```text
notification.manage
integration.cbs.view
integration.cbs.sync
integration.google_sheets.export
api_key.manage
data_retention.manage
```

These should only be implemented when the corresponding feature exists.
