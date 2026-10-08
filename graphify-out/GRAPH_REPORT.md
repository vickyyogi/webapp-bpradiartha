# Graph Report - webapp-bpradiartha  (2026-10-06)

## Corpus Check
- 201 files · ~1,009,774 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: (none) 1, .toml 1, .prisma 1)

## Summary
- 1241 nodes · 3221 edges · 124 communities (64 shown, 60 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d56e814b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Button
- extractClientInfo
- AI_CODING_AGENT_INSTRUCTIONS.md
- requireAuthAndPermission
- next-auth
- PROJECT_SPEC.md
- CREDIT_WORKFLOW.md
- 5. Permission Catalog
- next
- permissions.ts
- notificationService
- components.json
- DATABASE_SCHEMA.md
- package.json
- compilerOptions
- DATABASE_ERD.md
- dropdown-menu.tsx
- Prisma Platform core concepts
- Prisma Platform core concepts
- Prisma Platform core concepts
- Prisma Platform core concepts
- hero-slides/upload/route.ts
- Credit Data Database Design
- apply/route.ts
- Prisma Composer core concepts
- Prisma Composer core concepts
- Prisma Composer core concepts
- Prisma Composer core concepts
- Credit Data CSV Module
- devDependencies
- CSV Import Workflow
- 51. AI Agent Work Protocol
- Credit Data Permissions
- dependencies
- DashboardShell.tsx
- 39. CMS Tables
- 35. MVP Roadmap
- app/layout.tsx
- CSV Data Mapping
- scripts
- privacy.ts
- 20. Purchasing ERD
- 21. Workflow ERD
- 38. Workflow Tables
- 45. Transaction Requirements
- 39. Testing Strategy
- 3. Authentication ERD
- 27. Documents
- 28. Inventory
- eslint.config.mjs
- BPR Operational Management System
- 33. Development Principles for AI Coding Agents
- 5. High-Level Application Areas
- README.md
- posts/route.ts
- cms/reports/route.ts
- This is NOT the Next.js you know
- 3. Critical Rule: Do Not Invent Business Rules
- 16. Field Operations ERD
- 17. Document ERD
- 18. Inventory ERD
- 5. CRM ERD
- 29. Assets
- 35. Purchase Requests
- 36. Purchase Orders
- 37. Goods Receipts
- next.config.ts
- seed.ts
- 23. Reporting
- 2. Core Architectural Principle
- berita/layout.tsx
- cms/layout.tsx
- master-data/layout.tsx
- roles/layout.tsx
- users/layout.tsx
- audit/layout.tsx
- assets/layout.tsx
- items/layout.tsx
- inventory/layout.tsx
- maintenance/layout.tsx
- purchasing/layout.tsx
- orders/layout.tsx
- receipts/layout.tsx
- requests/layout.tsx
- vendors/layout.tsx
- reports/layout.tsx
- galeri/layout.tsx
- laporan/layout.tsx
- BPR Operational Management System
- 19. Asset ERD
- BPR Operational Management System
- 23. Audit ERD
- 10. User Roles
- 11. Role Permissions
- 12. CRM Leads
- 13. Customers
- 14. Loan Products
- 15. Loan Applications
- 16. Application Status History
- 17. Application Assignments
- 18. Credit Analysis
- 19. Credit Analysis Items
- BPR Operational Management System
- 21. Survey Items
- 22. Credit Reviews
- 23. Credit Decisions
- 24. Loan Realizations
- 25. Field Tasks
- 31. Asset Transfers
- 33. Asset Disposal
- 34. Vendors
- 40. Audit Logs
- 41. Notifications
- 43. Locations
- 4. Organizations
- 5. Branches
- 7. Users
- 8. Roles
- 9. Permissions
- postcss.config.mjs
- 8. CRM Module

## God Nodes (most connected - your core abstractions)
1. `next` - 132 edges
2. `requireAuthAndPermission()` - 122 edges
3. `Button()` - 88 edges
4. `Badge()` - 76 edges
5. `db` - 76 edges
6. `Card()` - 75 edges
7. `next-auth` - 70 edges
8. `CardTitle()` - 69 edges
9. `CardHeader()` - 68 edges
10. `CardContent()` - 68 edges

## Surprising Connections (you probably didn't know these)
- `Principle` --references--> `CreditApplication`  [INFERRED]
  docs/CREDIT_DATA_DATABASE.md → src/app/(dashboard)/credit/applications/CreditApplicationsClientView.tsx
- `CreditApplicationsPage()` --calls--> `CreditApplicationsClientView()`  [EXTRACTED]
  src/app/(dashboard)/credit/applications/page.tsx → src/app/(dashboard)/credit/applications/CreditApplicationsClientView.tsx
- `CreditApplicationDetailPage()` --calls--> `CreditApplicationDetailClientView()`  [EXTRACTED]
  src/app/(dashboard)/credit/applications/[id]/page.tsx → src/app/(dashboard)/credit/applications/[id]/CreditApplicationDetailClientView.tsx
- `LeadsPage()` --calls--> `LeadsClientView()`  [EXTRACTED]
  src/app/(dashboard)/crm/leads/page.tsx → src/app/(dashboard)/crm/leads/LeadsClientView.tsx
- `GET()` --calls--> `requireAuthAndPermission()`  [EXTRACTED]
  src/app/api/admin/permissions/route.ts → src/lib/permissions.ts

## Import Cycles
- None detected.

## Communities (124 total, 60 thin omitted)

### Community 0 - "Button"
Cohesion: 0.06
Nodes (150): cn, lucide-react, react, BeritaPage(), Post, BeritaDetailPage(), Props, BranchesPage() (+142 more)

### Community 1 - "extractClientInfo"
Cohesion: 0.09
Nodes (32): DELETE(), PUT(), DELETE(), PUT(), GET(), POST(), DELETE(), PUT() (+24 more)

### Community 2 - "AI_CODING_AGENT_INSTRUCTIONS.md"
Cohesion: 0.04
Nodes (53): 10. Prisma Rules, 11. Database History, 12. Delete Policy, 13. Authentication, 14. Authorization, 15. RBAC and Scope, 16. Segregation of Duties, 17. Validation (+45 more)

### Community 3 - "requireAuthAndPermission"
Cohesion: 0.09
Nodes (32): @prisma/client, POST(), POST(), GET(), PUT(), GET(), POST(), DELETE() (+24 more)

### Community 4 - "next-auth"
Cohesion: 0.08
Nodes (25): next-auth, POST(), GET(), authOptions, handler, POST(), GET(), GET() (+17 more)

### Community 5 - "PROJECT_SPEC.md"
Cohesion: 0.05
Nodes (38): 10. Credit Application Data, 11. Credit Analysis, 12. Survey Module, 13. Credit Review and Decision, 14. Credit Realization / Disbursement Record, 15. Field Officer Module, 16. Field Officer Performance, 17. Document Management (+30 more)

### Community 6 - "CREDIT_WORKFLOW.md"
Cohesion: 0.06
Nodes (29): 10. Return / Correction, 11. Status Transition Rules, 12. State Transition Audit, 13. Assignment, 14. Tasks, 15. SLA / Due Dates, 16. Credit Product Configuration, 17. Approval Authority (+21 more)

### Community 7 - "5. Permission Catalog"
Cohesion: 0.06
Nodes (29): 10. Future Extension, 1. Purpose, 2. Authorization Model, 3. Initial Roles, 4. Permission Naming Convention, 5.10 Documents, 5.11 Inventory, 5.12 Assets (+21 more)

### Community 8 - "next"
Cohesion: 0.09
Nodes (5): next, POST(), slugify(), db, config

### Community 9 - "permissions.ts"
Cohesion: 0.11
Nodes (20): GET(), POST(), GET(), POST(), SEED_PERMISSIONS, DELETE(), GET(), PUT() (+12 more)

### Community 10 - "notificationService"
Cohesion: 0.17
Nodes (8): EmailNotificationProvider, InAppNotificationProvider, notificationService, WhatsAppNotificationProvider, NotificationChannel, NotificationProvider, NotificationType, SendNotificationInput

### Community 11 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 12 - "DATABASE_SCHEMA.md"
Cohesion: 0.10
Nodes (18): 20. Surveys, 26. Field Activities, 2. PostgreSQL Conventions, 30. Asset Assignment History, 32. Asset Maintenance, 3. Common Columns, 42. Settings, 44. Prisma Implementation Guidance (+10 more)

### Community 13 - "package.json"
Cohesion: 0.11
Nodes (18): name, prisma, seed, private, version, babel-plugin-react-compiler, class-variance-authority, prisma (+10 more)

### Community 14 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 15 - "DATABASE_ERD.md"
Cohesion: 0.11
Nodes (16): 10. Application Assignment, 11. Credit Analysis, 12. Survey, 13. Credit Review, 14. Credit Decision, 15. Loan Realization, 22. CMS ERD, 24. Key Relationship Summary (+8 more)

### Community 16 - "dropdown-menu.tsx"
Cohesion: 0.12
Nodes (3): @base-ui/react, DropdownMenuContent(), DropdownMenuSubContent()

### Community 17 - "Prisma Platform core concepts"
Cohesion: 0.12
Nodes (15): Branches are preview environments, Environment variables, Failure modes quick reference, Local development, Object storage, Prisma Platform core concepts, Prisma Postgres, Project setup (+7 more)

### Community 18 - "Prisma Platform core concepts"
Cohesion: 0.12
Nodes (15): Branches are preview environments, Environment variables, Failure modes quick reference, Local development, Object storage, Prisma Platform core concepts, Prisma Postgres, Project setup (+7 more)

### Community 19 - "Prisma Platform core concepts"
Cohesion: 0.12
Nodes (15): Branches are preview environments, Environment variables, Failure modes quick reference, Local development, Object storage, Prisma Platform core concepts, Prisma Postgres, Project setup (+7 more)

### Community 20 - "Prisma Platform core concepts"
Cohesion: 0.12
Nodes (15): Branches are preview environments, Environment variables, Failure modes quick reference, Local development, Object storage, Prisma Platform core concepts, Prisma Postgres, Project setup (+7 more)

### Community 21 - "hero-slides/upload/route.ts"
Cohesion: 0.17
Nodes (10): ALLOWED_TYPES, POST(), GET(), getContentType(), HERO_ASPECT_RATIO, HERO_CANVAS_HEIGHT, HERO_CANVAS_WIDTH, HERO_MAX_SUBJECT_WIDTH (+2 more)

### Community 22 - "Credit Data Database Design"
Cohesion: 0.13
Nodes (14): Active snapshot recommendation, Constraints, Core entities, Credit Data Database Design, CreditAccount, CreditCollateral, CreditImportBatch, Customer (+6 more)

### Community 23 - "apply/route.ts"
Cohesion: 0.24
Nodes (11): GET(), POST(), POST(), checkRateLimit(), getClientIp(), memoryStore, RateLimitConfig, RateLimitStore (+3 more)

### Community 24 - "Prisma Composer core concepts"
Cohesion: 0.14
Nodes (13): Building blocks and extensions, Builds are yours, Contracts and RPC, Databases and migrations, Declarations are data, Deploy model: converge, don't script, Failure modes quick reference, Local development (+5 more)

### Community 25 - "Prisma Composer core concepts"
Cohesion: 0.14
Nodes (13): Building blocks and extensions, Builds are yours, Contracts and RPC, Databases and migrations, Declarations are data, Deploy model: converge, don't script, Failure modes quick reference, Local development (+5 more)

### Community 26 - "Prisma Composer core concepts"
Cohesion: 0.14
Nodes (13): Building blocks and extensions, Builds are yours, Contracts and RPC, Databases and migrations, Declarations are data, Deploy model: converge, don't script, Failure modes quick reference, Local development (+5 more)

### Community 27 - "Prisma Composer core concepts"
Cohesion: 0.14
Nodes (13): Building blocks and extensions, Builds are yours, Contracts and RPC, Databases and migrations, Declarations are data, Deploy model: converge, don't script, Failure modes quick reference, Local development (+5 more)

### Community 28 - "Credit Data CSV Module"
Cohesion: 0.15
Nodes (12): Acceptance criteria, Active snapshot, Credit Data CSV Module, Detail sections, Existing platform, Import principle, Main list fields, Permissions (+4 more)

### Community 29 - "devDependencies"
Cohesion: 0.15
Nodes (13): devDependencies, babel-plugin-react-compiler, eslint, eslint-config-next, prisma, @prisma/client, tailwindcss, @tailwindcss/postcss (+5 more)

### Community 30 - "CSV Import Workflow"
Cohesion: 0.17
Nodes (11): Acceptance tests, Concurrency, Critical rule, CSV Import Workflow, Duplicate rules, Failure behavior, Goal, History (+3 more)

### Community 31 - "51. AI Agent Work Protocol"
Cohesion: 0.18
Nodes (11): 51. AI Agent Work Protocol, Step 1, Step 10, Step 2, Step 3, Step 4, Step 5, Step 6 (+3 more)

### Community 32 - "Credit Data Permissions"
Cohesion: 0.18
Nodes (10): Audit events, Branch/organization scope, Credit Data Permissions, Field-level security, Four-eyes option, Permissions, Purpose, Recommended role policy (+2 more)

### Community 33 - "dependencies"
Cohesion: 0.18
Nodes (11): dependencies, @base-ui/react, class-variance-authority, cn, lucide-react, next, next-auth, react (+3 more)

### Community 34 - "DashboardShell.tsx"
Cohesion: 0.22
Nodes (9): DashboardLayout(), LogoutButton(), DashboardShell(), MenuVisibility, NavDropdownItem, NavItem, NavLinkItem, NavSection (+1 more)

### Community 35 - "39. CMS Tables"
Cohesion: 0.25
Nodes (8): 39. CMS Tables, banners, categories, faqs, media, pages, post_categories, posts

### Community 36 - "35. MVP Roadmap"
Cohesion: 0.25
Nodes (8): 35. MVP Roadmap, Phase 1 - Foundation, Phase 2 - Credit Operations, Phase 3 - Field Operations, Phase 4 - Operational Management, Phase 5 - Management, Phase 6 - Public Website & CMS, Phase 7 - External Integration

### Community 37 - "app/layout.tsx"
Cohesion: 0.29
Nodes (4): geistMono, geistSans, metadata, poppins

### Community 38 - "CSV Data Mapping"
Cohesion: 0.33
Nodes (5): CSV Data Mapping, Keys, Mapping, Type rules, Validation

### Community 39 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, lint, postinstall, start

### Community 41 - "20. Purchasing ERD"
Cohesion: 0.40
Nodes (5): 20. Purchasing ERD, goods_receipts, purchase_orders, purchase_request_items, purchase_requests

### Community 42 - "21. Workflow ERD"
Cohesion: 0.40
Nodes (5): 21. Workflow ERD, workflow_actions, workflow_instances, workflow_steps, workflows

### Community 43 - "38. Workflow Tables"
Cohesion: 0.40
Nodes (5): 38. Workflow Tables, workflow_actions, workflow_instances, workflow_steps, workflows

### Community 44 - "45. Transaction Requirements"
Cohesion: 0.40
Nodes (5): 45. Transaction Requirements, Application submission, Asset assignment, Purchase approval, Status transition

### Community 45 - "39. Testing Strategy"
Cohesion: 0.50
Nodes (4): 39. Testing Strategy, End-to-end tests, Integration tests, Unit tests

### Community 46 - "3. Authentication ERD"
Cohesion: 0.50
Nodes (4): 3. Authentication ERD, permissions, roles, users

### Community 47 - "27. Documents"
Cohesion: 0.50
Nodes (4): 27. Documents, document_types, document_versions, documents

### Community 48 - "28. Inventory"
Cohesion: 0.50
Nodes (4): 28. Inventory, inventory_categories, inventory_items, inventory_transactions

### Community 49 - "eslint.config.mjs"
Cohesion: 0.50
Nodes (3): eslintConfig, eslint, eslint-config-next

### Community 50 - "BPR Operational Management System"
Cohesion: 0.50
Nodes (4): 1. Project Overview, BPR Operational Management System, Project Specification for AI Coding Agents, Version 1.0

### Community 51 - "33. Development Principles for AI Coding Agents"
Cohesion: 0.50
Nodes (4): 33. Development Principles for AI Coding Agents, Before coding, Before finishing a feature, During coding

### Community 52 - "5. High-Level Application Areas"
Cohesion: 0.50
Nodes (4): 5.1 Public Website, 5.2 Operational Portal, 5.3 Administration, 5. High-Level Application Areas

### Community 53 - "README.md"
Cohesion: 0.50
Nodes (3): Deploy on Vercel, Getting Started, Learn More

### Community 57 - "3. Critical Rule: Do Not Invent Business Rules"
Cohesion: 0.67
Nodes (3): 3. Critical Rule: Do Not Invent Business Rules, Option A, Option B

### Community 58 - "16. Field Operations ERD"
Cohesion: 0.67
Nodes (3): 16. Field Operations ERD, field_activities, field_tasks

### Community 59 - "17. Document ERD"
Cohesion: 0.67
Nodes (3): 17. Document ERD, document_versions, documents

### Community 60 - "18. Inventory ERD"
Cohesion: 0.67
Nodes (3): 18. Inventory ERD, inventory_items, inventory_transactions

### Community 61 - "5. CRM ERD"
Cohesion: 0.67
Nodes (3): 5. CRM ERD, customers, leads

### Community 62 - "29. Assets"
Cohesion: 0.67
Nodes (3): 29. Assets, asset_categories, assets

### Community 63 - "35. Purchase Requests"
Cohesion: 0.67
Nodes (3): 35. Purchase Requests, purchase_request_items, purchase_requests

### Community 64 - "36. Purchase Orders"
Cohesion: 0.67
Nodes (3): 36. Purchase Orders, purchase_order_items, purchase_orders

### Community 65 - "37. Goods Receipts"
Cohesion: 0.67
Nodes (3): 37. Goods Receipts, goods_receipt_items, goods_receipts

### Community 68 - "23. Reporting"
Cohesion: 0.67
Nodes (3): 23. Reporting, Management Reporting, Operational Dashboard

### Community 69 - "2. Core Architectural Principle"
Cohesion: 0.67
Nodes (3): 2. Core Architectural Principle, BPR Operational Management System, Existing Core Banking System

## Knowledge Gaps
- **640 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+635 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 751 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **60 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `next` to `Button`, `extractClientInfo`, `requireAuthAndPermission`, `next-auth`, `permissions.ts`, `package.json`, `hero-slides/upload/route.ts`, `apply/route.ts`, `DashboardShell.tsx`, `app/layout.tsx`, `posts/route.ts`, `cms/reports/route.ts`, `next.config.ts`, `berita/layout.tsx`, `cms/layout.tsx`, `master-data/layout.tsx`, `roles/layout.tsx`, `users/layout.tsx`, `audit/layout.tsx`, `assets/layout.tsx`, `items/layout.tsx`, `inventory/layout.tsx`, `maintenance/layout.tsx`, `purchasing/layout.tsx`, `orders/layout.tsx`, `receipts/layout.tsx`, `requests/layout.tsx`, `vendors/layout.tsx`, `reports/layout.tsx`, `galeri/layout.tsx`, `laporan/layout.tsx`?**
  _High betweenness centrality (0.145) - this node is a cross-community bridge._
- **Why does `react` connect `Button` to `DashboardShell.tsx`, `package.json`, `dropdown-menu.tsx`, `admin/layout.tsx`, `useInView.ts`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `lucide-react` connect `Button` to `dropdown-menu.tsx`, `DashboardShell.tsx`, `next-auth`, `package.json`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _640 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Button` be split into smaller, more focused modules?**
  _Cohesion score 0.05943847072879331 - nodes in this community are weakly interconnected._
- **Should `extractClientInfo` be split into smaller, more focused modules?**
  _Cohesion score 0.08590441621294616 - nodes in this community are weakly interconnected._
- **Should `AI_CODING_AGENT_INSTRUCTIONS.md` be split into smaller, more focused modules?**
  _Cohesion score 0.03636363636363636 - nodes in this community are weakly interconnected._