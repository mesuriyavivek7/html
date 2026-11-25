# 33 · Business OS: baseline, operating model, identity and access

Phase 4 (25 Nov 2026). Brief: *Oontu Unified Business Operating System, Master Assignment* (17 pages): turn the existing Super Admin / Core Platform into the internal operating system Oontu uses to run its own SaaS business.

Scope: the front-end prototype only, as the user decided on 24 Nov 2026 and as the brief restricts. No backend, migrations, deployment, real email, real payments or credentials.

Labels used in 33–37:

| Label | Meaning |
|---|---|
| **IMPLEMENTED** | Works in the prototype, with automated tests. |
| **SIMULATED** | Works in the prototype through a clearly labelled stand-in (adapter, test secret, outbox). |
| **PARTIAL** | Some of the behaviour exists. |
| **PROPOSED** | Designed and documented, not built. |
| **MISSING** | Not designed in detail and not built. |

## 1. Repository baseline (before any change)

| Item | Evidence |
|---|---|
| Branch / commit | `agency-prototype-v2` at `c77b60c`, clean (`main` at `563b419`, same content). |
| Product | One file, `recruitment-os-prototype.html` (66,336 lines before this phase). The approval engine is generated from `oontu-approval-sla-engine.js`. |
| Super Admin / Core Platform | `state.role === 'oontu'`, `NAV_LAYOUT.oontu`. Screens: dashboard, tenants (with lifecycle), incomplete sign-ups, account help, subscriptions, invoices, plans, agents, feature controls, platform users, notifications, audit and settings. |
| Platform identity | `PLATFORM_USER_ROSTER`, one role per user (`platformRoleId`). Three roles: Super Admin, Support and Operations. `canPlatform()` denies suspended users and is kept separate from tenant `canI()`. |
| Audit | `logPlatformAudit` → `logAudit('Platform', …)` → `AUDIT_LOG`, with the acting platform user. |
| Provisioning | One engine, `provisionTenant` (idempotent and resumable), from Phase 3. |
| What the brief needs that was missing | CRM (accounts, contacts, opportunities, demos, proposals), ticketing, incidents, onboarding plans, training, health, renewals, payment events and refunds, integrity, My Work, product feedback themes, multi-role employees, role templates, scoped permissions, temporary and sensitive access. See doc 08 §3. |
| Tests before the change | 62 specs: **954 passed, 1 failed**. The failure was `motion.spec`, "collapse… pill on the active item". It is a timing flake: it passes 8/8 when re-run alone, and the suite was 955/955 at `c77b60c`. |
| Backend | `server/` and `dev/` hold the J0 work, which is **parked**. Not touched. |

## 2. Operating model

The brief's five workspaces are kept, because the evidence supports them: they match the existing console's groups and the role templates in the brief. They are **capability boundaries, not separate apps**:

- one sign-in;
- one employee record;
- one audit log;
- one set of records, which every workspace reads.

| Workspace | Screens (`state.activeNav`) | Owns |
|---|---|---|
| Revenue | Pipeline `oontu-revenue`, Accounts `oontu-accounts`, Incomplete sign-ups `oontu-signups` | Leads, identity resolution, qualification, demos, pipeline, proposals, offers, renewal and expansion deals |
| Service | Tickets `oontu-service` | One ticket system, incidents, email intake, routing, SLA, escalation |
| Customer Operations | Onboarding and success `oontu-custops`, Account help `oontu-help` | Hand-over, onboarding, setup, training, activation, health, renewal readiness |
| Business & Finance | Billing and payments `oontu-finance`, Subscriptions, Plans | Approvals, payment links, provider events, invoice verification, refunds, reconciliation |
| Platform Administration | Tenants (with Tenant 360), Employees and access, Integrity, Insights, Agents, Feature controls, Notifications, Audit | Employee and tenant lifecycle, access, integrity, audit, platform settings |

Above the workspaces sit **Home** (the platform overview) and **My work**.

The cross-workspace journey (brief §21) runs:

1. Inquiry or sign-up.
2. `bosIntake` with `bosMatch`.
3. Opportunity and demo.
4. Proposal, approval and payment link.
5. Won.
6. `bosHandover` creates the onboarding record.
7. `bosProvisionFromOnboarding` calls `provisionTenant`.
8. Training and activation.
9. Tickets and health.
10. `bosRenewals` and `bosStartRenewal`, which hands the deal back to Revenue.

Every step writes to the same `BOS` and `PLATFORM_*` records.

Renewal ownership is shared, as the brief requires:

- Customer Operations watches readiness.
- Revenue owns the renewal opportunity.
- Finance handles billing exceptions.
- Platform Administration keeps the subscription and entitlements consistent.

## 3. One employee identity (IMPLEMENTED)

- **One record per person.** It lives in `PLATFORM_USER_ROSTER`, now with `platformRoleIds[]`, `department`, `teamId`, `region`, `managerId`, `queues[]`, `sessions`, `mfa`, `lastReviewedAt`. Inviting an email that already exists is refused: "add a role instead of creating a second account".
- **Lifecycle.** Invited (7-day expiry, resend) → Active (email verification and two-step sign-in, simulated) → Suspended (sessions end) → Offboarded.
  - Offboarding removes roles and sessions and revokes grants.
  - It hands open work to a named colleague and keeps history.
- **Temporary elevated access** (`bosRequestTempRole`).
  - Requires the purpose, the hours (1–72) and a request from someone who may manage employees.
  - Approved by somebody else (Security Administrator); it expires by itself.
  - Super Admin can't be granted this way.
- **Access review** (`bosReviewAccess`) records who confirmed someone's roles still fit. You can't review yourself.
- **Prototype "View as"** (`bosActAs`) shows the product with another employee's roles. It is labelled; in production nobody switches into another account.

## 4. Authorization model (IMPLEMENTED in the client; production needs the same on a server)

A hybrid of RBAC, scope and relationship checks, with context:

- **Subject.** The employee with all their roles, plus active temporary grants; department, team, queues, region.
- **Resource and action.** 19 modules in the canonical catalog (`PLATFORM_PERMISSION_MODULES`, shown in Employees and access › Permission catalog). Each module has a description, a sensitivity (low → critical) and its actions:
  - view, create, edit, assign, approve, execute, delete;
  - export, merge, verify_payment, approve_refund, and so on.
- **Scope.** Each grant carries one of own, assigned, team, queue, department, region, organization or global. `bosCan(module, action, record)` checks both the permission and the scope against the record's owner, assignees, queue, team and department. `canPlatform` keeps its old meaning ("has this permission at any scope"), so existing screens work unchanged.
- **Context.**
  - Record state, for example only a sent proposal can be accepted.
  - Approvals (maker-checker).
  - Temporary grants and their expiry.
  - Sensitive access, which needs a ticket, the customer's authorisation and an approval.
- **Guards.**
  - Nobody approves their own request.
  - Nobody changes their own roles.
  - Only someone holding `platform-user:approve` can give a role with more access than they have themselves.
  - At least one active Super Admin always remains.
  - Agents can't run high-risk commands.
  - Everything is audited.
- **Deny by default.** No role means no access. Invited, suspended and offboarded employees are denied on every call.

### Role templates (34 roles: 31 templates + the 3 existing roles)

All templates are derived from the catalog (`BOS_TEMPLATES`); the full grants are shown in the product under Employees and access › Role templates.

| Workspace | Templates |
|---|---|
| Revenue | Lead Researcher / SDR (own) · Sales Executive (own) · Senior Sales Executive (team) · Sales Manager (team, approves standard discounts) · Revenue Manager (department, restricted discounts, merges) · Revenue Administrator |
| Customer Operations | Customer Operations Associate (assigned) · Implementation Specialist (assigned, provisions, runs setup) · Training Coordinator · Trainer (own sessions) · Customer Success Executive (own) · Senior CS (team) · CS Manager (department) · Operations Administrator |
| Service | Service Desk Associate (queue) · Support Agent (queue) · Technical Support Specialist (queue, incidents) · Senior Support (department) · Support Manager (department, approves workspace access) · Service Desk Administrator |
| Business & Finance | Commercial Operator · Finance Associate · Finance Specialist (verifies payments, reconciles) · Finance Manager (approves refunds and restricted discounts) · Finance Administrator. Finance roles work the Billing Support queue. |
| Platform Administration | Platform Operations Associate · Tenant Operations Specialist · Platform Support Specialist · Platform Operations Manager · Security Administrator (approves access and elevated roles) · Platform Administrator · Super Administrator (existing, protected) |

Seeded employees cover each workspace:

- Arjun Rao (Sales Executive)
- Kavya Iyer (Sales Manager)
- Leela Fernandes (Revenue Manager)
- Rohan Das (Support Agent)
- Nisha Pillai (Support Manager)
- Aditi Menon (Implementation Specialist **and** Trainer: one identity, two roles)
- Sana Qureshi (CS Manager)
- Vikram Shah (Finance Manager)
- Dev Patel (Security Administrator)
- Meera Krishnan (Super Admin)

## 5. Navigation

`NAV_LAYOUT.oontu` now lists Home and My work, then Revenue, Service, Customer operations, Business & finance, Platform administration (a folding group) and Settings.

`filterNavForPermissions` hides items the employee can't use (`BOS_VIEW_ACCESS`). Hiding is not security: every renderer is wrapped with the same check, and every command checks again.

The old single-role Platform Users screen is replaced by **Employees and access**, under the same view id and on the same identity store, so there is no second user list.
