# 00 · Oontu product vision and system boundaries

Snapshot audited: branch `agency-prototype-v2` = `main` at commit `fcb54ff` (24 Nov 2026). Line numbers are approximate and drift as the file changes; function and constant names are the stable references.

## How to read this blueprint

| Label | Meaning in these documents |
|---|---|
| **VERIFIED** | Works in the prototype and a spec in `tests/` checks it. Says nothing about production. |
| **PARTIALLY IMPLEMENTED** | Some of the behaviour exists; named gaps remain. |
| **SIMULATED** | The screen and rules exist, but the effect is faked in the browser (no server, no email, no model, no persistence). |
| **MISSING** | No code. |
| **PROPOSED** | This blueprint recommends it. |

The single most important fact: **the repository is a high-fidelity, rule-rich browser prototype, not a running SaaS.** `recruitment-os-prototype.html` (about 65,000 lines) holds every screen and rule. There is one network call in the whole file (`createHttpAuthAdapter`, line ~28,196, never run against a server). Everything else lives in JavaScript memory or `localStorage`. `docs/AUTH.md` §2 and `docs/OONTU_AGENCY_READY_REPORT.md` §6 say the same.

That is not a weakness of the product thinking. The prototype encodes hundreds of business rules, written "one function per rule so each can move to a server unchanged" (header of `corp-script`). The evolution path is therefore **port the rules to a server and put a real tenant boundary around them**, not "redesign".

## 1. Existing code evidence

| Area | Where |
|---|---|
| Whole product | `recruitment-os-prototype.html`, about 40 named `<script>`/`<style>` blocks (`cowork-script`, `approvals-script`, `interviews-script`, `clients-script`, `campaigns-script`, `flow-script`, `corp-script`, `join-script`, `paytrack-script`, `contracts-script`, `cowork-agents-script`, `demo-script`, `intelligence-script`, `nav-script`, `inbox-script`, `prospects-script`, `profile-script`, `company-script`, and others) |
| Approvals engine | `oontu-approval-sla-engine.js` (`window.APS`), tested by `test/aps.test.js` |
| Tests | 52 browser specs in `tests/*.spec.js`, run by `tests/run-auth-tests.ps1` (headless Chrome). Baseline: all green except 7 known failures |
| Existing documents | `docs/AUTH.md` (auth contract and proposed schema), `docs/OONTU_AGENCY_READY_REPORT.md` (server rules, build order), `docs/product-flow-audit.md`, `docs/role-wise-workflow-matrix.md`, `docs/approval-required-changes.md`, `docs/OONTU_INTELLIGENCE_ARCHITECTURE.md` |

## 2. Current implementation: what Oontu is today

Five surfaces share one page:

1. **Customer workspace**, which is either a **Staffing agency** or a **Corporate** workspace (`WORKSPACE_TYPES`, chosen at sign-up, then `ORG_STRUCTURE.profile.orgType`).
2. **External vendor portal** (`#/vendor`, email plus one-time code, `coVendorLogin`) for agencies that supply a corporate customer.
3. **No-login secure links** for clients, hiring managers, interviewers, candidates and contractors (consent, review, scorecard, timesheet pages).
4. **Candidate portal** (`candidate-*` renderers).
5. **Oontu Super Admin** (`state.role === 'oontu'`, `NAV_LAYOUT.oontu`): tenants, sign-ups, account help, subscriptions, plans, agents, feature controls, platform users, notifications, audit, settings.

Kairo (the assistant and agent workforce, `kairoRespond`, Cowork `cwEngineTick`, `AGENT_CATALOG`) and Intelligence (`intelligence-script`, `IQ_ADAPTER`, `iqPlan*`) run across the customer surfaces.

## 3. System boundaries (PROPOSED, preserving the existing split)

```
                         ┌──────────────────────────────────────────┐
                         │            OONTU CORE PLATFORM           │
                         │ identity · tenancy · membership · authz  │
                         │ provisioning · plans/entitlements · config│
                         │ events/jobs · notifications · audit      │
                         └───────┬───────────────┬──────────────────┘
          tenant-scoped APIs     │               │  platform-scoped APIs
   ┌─────────────────────────────┴──┐       ┌────┴─────────────────────────┐
   │ CUSTOMER TENANTS               │       │ OONTU SUPER ADMIN (internal)  │
   │  Agency domain   Corporate dom │       │  Sales · Demos · Onboarding   │
   │  (clients, sub-  (jobs+approval│       │  Support · Incidents · CS     │
   │   missions,      vendors, HM,  │       │  Tenants · Plans · Platform ops│
   │   PayTrack)      offers)       │       └───────────────────────────────┘
   │  Shared recruitment engine     │
   │  (candidates, journeys, inter- │
   │   views, offers, approvals)    │
   │  Kairo · Intelligence · Cowork │
   └──────────────┬─────────────────┘
                  │ relationship records only (never a shared tenant)
   ┌──────────────┴─────────────────┐
   │ VENDOR ORGANISATION (an agency │
   │ tenant or a vendor-only org)   │
   └────────────────────────────────┘
```

Boundary rules:

- A **tenant** is the unit of data isolation. A staffing agency and a corporate are separate tenants, even when one supplies the other.
- A **vendor relationship** links two organisations. It grants scoped access to named jobs. It never merges tenants (see 04).
- **Platform identities are not tenant identities.** The prototype already keeps them apart (`PLATFORM_USER_ROSTER` vs `RECRUITER_ROSTER`, comment at line ~35,250). Keep it that way.
- **Deterministic business truth** (records, rules, permissions) is separate from **Kairo reasoning**. Kairo reads through the same permission layer as a person and proposes; consequential actions go through approvals (see 13).

## 4. Limitations

- No server, database, tenant boundary, email, messaging or model integration (see 16, 17).
- One shared demo data set per page; a reload resets it (`OONTU_AGENCY_READY_REPORT.md` §6 risk 1).
- The corporate "one Job" model approved on 20 Nov 2026 lives only on `jaydeep-changes` (`corp-jobs-script`, 1,153 lines). v2/main still shows a separate Requisitions screen (see 03).

## 5. Proposed direction (summary)

1. **P0:** Core Platform foundation: tenancy, identity, one provisioning engine, server-enforced permissions, audit, persistence. Port the existing rules module by module, with their specs as the definition of done.
2. **P1:** Close the operational loops: corporate jobs and vendor lifecycle on the server, Super Admin business console (CRM, demos, assisted onboarding, support, incidents), Customer 360, unified work queue.
3. **P2:** Kairo and Intelligence on a real model behind the existing adapter contract, organisation memory, governed agent execution, global configuration.
4. **P3:** Scale and refinement.

## 6. Data impact

None from this document. It sets the boundaries that 07, 10, 12 and 14 make concrete.

## 7. Permissions

Two permission planes that never mix: tenant permissions (`PERMISSION_MODULES`, `CUSTOM_ROLES`, `canI`) and platform permissions (`PLATFORM_PERMISSION_MODULES`, `PLATFORM_ROLES`, `canPlatform`). A third, relationship-scoped plane is added for vendors (04).

## 8. Dependencies

A backend stack decision (open in `docs/AUTH.md` §4; `OONTU_AGENCY_READY_REPORT.md` §7 proposes NestJS + Prisma + PostgreSQL + Next.js). This blueprint is stack-neutral, with PostgreSQL assumed for the row-level-security recommendations.

## 9. Acceptance criteria

- Every later document maps each proposal to an existing function, constant or screen, or states that none exists.
- No proposal introduces a second source of truth for an entity that already has one.

## 10. Tests

The 52 browser specs stay the behavioural definition. Each ported module ships with its spec rewritten against the real API (the rule already set in `OONTU_AGENCY_READY_REPORT.md` §7).

## 11. Migration risks

- **Mistaking the prototype for production.** Mitigation: the truth matrix (17) labels every capability.
- **Big-bang rewrite.** Mitigation: the milestone plan in 18 ports one bounded module at a time behind the existing adapter seams (`createHttpAuthAdapter`, `IQ_ADAPTER`, `APS`).
