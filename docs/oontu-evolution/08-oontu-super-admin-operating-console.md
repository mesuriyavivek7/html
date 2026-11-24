# 08 · Oontu Super Admin operating console

## 1. Existing code evidence

| Screen (`NAV_LAYOUT.oontu`) | Code | Status |
|---|---|---|
| Dashboard `oontu-dashboard` | platform renderers | VERIFIED (prototype) |
| Tenants `oontu-tenants` | `createInvitedTenant` (line ~36,276), `ctSubmit`, `openTenantInviteSheet`, lifecycle `TENANT_STATUS_TRANSITIONS` + `TENANT_STATUS_REASONS`, tenant admins `PLATFORM_TENANT_ADMINS` | VERIFIED (prototype), auth 06k |
| Incomplete sign-ups `oontu-signups` | `SIGNUP_LEADS`, `LEAD_OUTCOMES`, `LEAD_DROP_REASONS`, call logging | VERIFIED (prototype), auth 06l; live lead capture was removed with the new sign-up (`docs/AUTH.md` §10), so it holds seeded samples |
| Account help `oontu-help` | `join-script`: escalations, `jnContactOwner`, `jnApproveJoin`, `jnTransferOwner`, `jnFreeDomain`, `jnAllowSeparate`, assisted setup with customer permission (`jnAssist*`, 24 h, logged) | VERIFIED (prototype), `signup-recovery` |
| Subscriptions `oontu-subscriptions` | `PLATFORM_SUBSCRIPTIONS`, `SUBSCRIPTION_TRANSITIONS`, `PLATFORM_INVOICES`, `INVOICE_STATES` | VERIFIED (prototype) |
| Plans `oontu-plans` | `PLATFORM_PLANS`, `BOOSTS` | VERIFIED (prototype) |
| Agents `oontu-agents` | `AGENT_CATALOG`, kill switch with reason, `PLATFORM_ADDON_LEDGER` | VERIFIED (prototype) |
| Feature controls | `PLATFORM_FEATURE_CONTROLS`, `FEATURE_CONTROL_STATES` | VERIFIED (prototype) |
| Platform users | `PLATFORM_USER_ROSTER` | VERIFIED (prototype) |
| Notifications | `PLATFORM_ANNOUNCEMENTS`, `ANNOUNCEMENT_STATES/TRANSITIONS` | VERIFIED (prototype) |
| Audit | `logPlatformAudit` → `AUDIT_LOG` (module `Platform`) | VERIFIED (prototype) |
| Settings | `sec_platformAi` (`PLATFORM_AI`, keys "simulated in this prototype") and platform sections | SIMULATED |

Permission model: `PLATFORM_PERMISSION_MODULES` = tenant, plan, subscription, feature, notification, audit, settings, user. `PLATFORM_ROLES` contains **one role** (`role_oontu_super_admin`, protected). `canPlatform` checks the user's suspension before the role, every call.

## 2. Current implementation

A clean foundation: separate identity, explicit permissions, audited actions, lifecycle state machines with reasons. Assisted setup already follows the right principle (customer permission, time-bound, logged).

## 3. Limitations (against brief §11)

| Brief capability | Status |
|---|---|
| A. Internal role bundles (Sales, Support, CS, Finance…) | MISSING: one role only; the role editor exists for the single role |
| B. Sales CRM | MISSING (no leads, contacts, opportunities, proposals) |
| C. Demo management | MISSING (demo workspaces exist as `DEMO_COMPANIES` in the developer menu, not as managed demos) |
| D. Sales-assisted onboarding | PARTIAL: "Create tenant" sends an owner invite; no link to a prospect, no onboarding plan, no hand-over |
| E. One provisioning engine | MISSING: four paths (07 §3) |
| F. Customer 360 | MISSING |
| G. Customer onboarding plans | MISSING (tenant-side setup checklist exists, `WS_SETUPS`, but Oontu cannot see or own it as a plan) |
| H. Support and incidents | MISSING (0 occurrences of "ticket"); Account help covers sign-up and join problems only |
| I. Customer success | MISSING |
| J. Platform operations | PARTIAL: tenant suspension/restore, agent kill switch; no provisioning-failure, job-failure or integration-failure queues |

## 4. Proposed solution

Evolve the existing console. Navigation (extends `NAV_LAYOUT.oontu`; each group appears only with permission):

- **Home:** my work queue (15) + platform health.
- **Revenue:** Leads, Opportunities, Demos, Proposals (09).
- **Customers:** Customer 360 list, Tenants, Onboarding, Sign-ups, Account help (existing).
- **Support:** Tickets, Incidents (11).
- **Success:** Health, Renewals, Expansion (11).
- **Product:** Plans, Agents, Feature controls (existing).
- **Operations:** Provisioning queue, Job and integration failures, Approvals, Support access grants, Platform users, Notifications, Audit (existing + new).
- **Settings** (existing).

**Permission bundles** (new modules: `platform-lead`, `platform-opportunity`, `platform-demo`, `platform-proposal`, `platform-onboarding`, `platform-ticket`, `platform-incident`, `platform-success`, `platform-provisioning`, `platform-support-access`, `platform-billing`):

| Bundle | Grants (summary) | Needs approval for |
|---|---|---|
| Super Admin | everything enumerated (as today) | deletion, still dual-approved |
| Sales | leads, opportunities, demos (own), proposals (standard pricing), **create customer workspace from a won opportunity** | discount beyond policy, custom entitlements |
| Sales Manager | Sales + team pipeline, approve standard discounts, reassign | custom contracts |
| Demo Specialist | demos, demo workspaces (reset), read leads | — |
| Onboarding / Implementation | onboarding plans and milestones, tenant config read, assisted setup (with customer grant) | data import into a live tenant |
| Support | tickets, read tenant metadata, request support access | every support-access session (customer grant or manager approval) |
| Support Manager | Support + SLA policy, assignment, incident link | — |
| Engineering / Platform Ops | provisioning queue, job and integration failures, incidents, feature kill switches | tenant suspension, data operations |
| Customer Success | health, renewals, CS tasks, expansion opportunities | — |
| Finance / Billing | subscriptions, platform invoices, payments, dunning | write-offs, refunds over a limit |
| Product Operations | plans (draft), feature controls, announcements | publishing a plan price |

Users may hold several bundles (`platformRoleIds: []`). No user-name checks, no bypass: every action still resolves through `canPlatform` (preserve the existing comment's rule).

**Approval policies** reuse APS with platform-scoped entities: `PlatformDiscount`, `CustomEntitlement`, `TenantSuspension`, `TenantDeletion`, `SupportAccess`, `OwnerTransfer`, `DomainRelease`.

## 5. Data impact

New platform tables (09, 10, 11). `PLATFORM_ROLES` gains rows; `platform_users.role_ids` becomes an array.

## 6. Permissions

As above. Platform permissions never include tenant recruitment data; access to it is only through a support-access grant (16).

## 7. Dependencies

Core platform (07), provisioning (10), unified work (15), APS port.

## 8. Acceptance criteria

- A Sales user creates a customer workspace from a won opportunity without Super Admin involvement, and cannot suspend a tenant or grant a custom entitlement without approval.
- Every console action writes a platform audit event naming the platform user.
- A Support user cannot open tenant candidate data without an active, time-boxed grant.

## 9. Tests

Bundle × action matrix (allow/deny); approval-required actions create an APS request and do nothing until approved; suspended platform user denied (already tested in principle by `canPlatform`).

## 10. Migration risks

- The single protected role grows automatically when modules are added (documented trade-off in the code). Keep that only for Super Admin; new bundles enumerate explicitly.
