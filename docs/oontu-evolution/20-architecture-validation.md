# 20 · Architecture validation

Purpose: re-check documents 00–19 against the repository before anything is built. Snapshot: `agency-prototype-v2` = `main` at `fcb54ff`. Every finding below was re-run against the code on 24 Nov 2026.

## 1. Corrections to documents 00–19

| # | Earlier claim | What the code shows | Effect |
|---|---|---|---|
| C1 | "Four provisioning paths" (07, 10, 17, 18) | `createTenant` (line ~35,442) has **no callers**: it is dead code. Live paths: self-service `sim.createWorkspace` and Super Admin `createInvitedTenant`. Prototype-only helpers: `provisionDemoAccount`, `teamAccount` | The gap is real but smaller: **two live paths** plus demo helpers. Recommendation unchanged (one engine) |
| C2 | "`PLATFORM_ROLES` contains one role" (08, 17, 18) | Three roles: `role_oontu_super_admin`, `role_oontu_support`, `role_oontu_operations` (seeded at line ~37,404 via `buildPlatformPerms`) | Platform bundles are partly started. Brief bundles (Sales, CS, Finance…) are still missing |
| C3 | "Live sign-up lead capture was removed; Sign-ups holds seeded samples" (08, 09, 17, citing `docs/AUTH.md` §10) | `joinLeadSync` (join-script) is called on every answered sign-up question (line ~30,692) and pushes real `SIGNUP_LEADS` records. Request to join is offered on a taken domain (line ~53,067, `su-join`) | **`docs/AUTH.md` §10 is out of date.** Lead capture exists; the CRM proposal (09) should build on `SIGNUP_LEADS`, not replace a missing feature |
| C4 | "Requisition approval chain is hard-coded" (03) | True (`coReqChain`), and there is **also** a configurable policy store `APPROVAL_CHAINS` (job publish above ₹30L, offer exceptions) used by other approvals | Stronger finding: **two approval-policy sources**. The ADR must make `APPROVAL_CHAINS`/APS the one policy source and retire `coReqChain` |
| C5 | "RECRUITER_ROSTER read unfiltered in ~31 places" (07, 16) | 223 references in the file; exactly one filters by `organizationId`. The "~31" came from a code comment counting tenant-side screens | Isolation exposure is larger than stated |
| C6 | "Agent actions have no idempotency" (13) | Cowork keeps `CW_IDEM` (idempotency keys per run step, line ~43,016) and `SEND_LEDGER` | Reuse these concepts in the server `AgentAction` design |
| C7 | "Hiring managers act with org-wide authority" (01, from notes) | Confirmed: `currentActingUser()` returns Priya Sharma (`role_founder`) for every persona except `manager`; `currentUserRoleId()` falls back to her assigned role | Any corporate permission behaviour seen in the prototype for HMs is not evidence of correct scoping |
| C8 | "Vendor submissions become journeys" (04, 06) | Confirmed: after consent, `coConsentGive` attaches the vendor to the shared submission (`sub.vendorId`, `sub.source`, `setJourneyOwner`), and `vs.subId` links back | The one-journey-engine recommendation is evidence-based |
| C9 | "Approved requisition opens a job" (03) | Confirmed: `coReqOpenJob` pushes a normal record into `JOBS` | One Job record is already the outcome; merging the requisition into the job is a small step |

## 2. Recommendations: evidence vs assumption

| Recommendation | Basis | Confidence |
|---|---|---|
| Port rules, don't redesign | Evidence: rules are plain functions with specs (e.g. `oontu-approval-sla-engine.js` + `test/aps.test.js`; `corp-script` header "one function per rule") | High |
| One journey engine | Evidence (C8) | High |
| One-Job corporate model | Evidence of your approval (project notes, 20 Nov) + code on `jaydeep-changes` (`corp-jobs-script`, 1,153 lines) | High that it was approved; **medium** that it ports cleanly (not run on this branch) |
| One provisioning engine | Evidence (C1) | High |
| Tenant isolation with `tenant_id` + RLS | Assumption about the stack (PostgreSQL); the need is evidence-based (C5) | High need; stack-dependent design |
| Vendor as a separate tenant | Assumption, consistent with brief and with `CO.accounts` being one per email across Oontu with `orgs[]` | Medium-high; decision needed |
| Domain verification split (02) | Evidence of the gap (`claimCorporateDomain` sets `unverified` and makes the creator owner); remedy is an assumption about global customers | Medium-high |
| Configuration scopes (12) | Evidence of one scope (`WSX`); scope list is a design assumption | Medium |
| WorkItem read model (15) | Evidence of parallel queues; benefit assumed | Medium; not needed for the first milestone |
| Kairo gateway (13) | Evidence: `IQ_ADAPTER` contract exists and is model-free | High for the contract; model choice open |
| Super Admin CRM/support (08, 09, 11) | Evidence of absence (C2/C3 corrected) | High need; P1 |

## 3. Conflicting recommendations found in 00–19

| Conflict | Where | Resolution (see 21) |
|---|---|---|
| Keep the prototype as the client and add a route manifest (01 §7) **vs** rebuild the client against the API, prototype as reference (16 §10) | 01, 07, 16 | ADR-09: build a new client from the existing design system; the prototype stays the executable specification and demo. The route manifest is built in the new client, seeded from `NAV_PERMISSIONS`/`NAV_ITEM_ACCESS`/`NAV_PLAN_GATES` |
| "Requisition" in the Phase 2 journey **vs** the approved one-Job model with no Requisitions screen | Brief Phase 2 §3 vs 03 | ADR-07: one `Job` entity with an approval stage; a job in Draft or Waiting for approval is what the business calls a requisition. The screen label is terminology, not a second entity |
| Organization vs Tenant vs Workspace: 07 merges tenant and workspace; 14 keeps Organization and Tenant separate; 02 adds groups | 02, 07, 14 | ADR-01 fixes all three |
| Vendor-only organisations "lightweight" (04) yet "tenant of their own" (04, 14) | 04 | ADR-04: a vendor org is a tenant of `kind='vendor'` with a reduced capability set, provisioned by the same engine |
| Approval policy: preset object (03) vs reuse `APPROVAL_CHAINS` (found in C4) | 03 | ADR-06: one policy store, APS runtime; presets are named policy bundles |

## 4. Missing dependencies (not called out before)

1. **Email delivery** is required by the very first milestone (owner invitation, codes). Without it nothing is production-worthy.
2. **Resume/document storage** (object storage, virus scanning) is required before candidate submission; resumes are parsed in the browser today (`resumeReadText` with pdf.js).
3. **A client application.** There is no build tooling; the brand assets in `assets/brand/` and the design CSS must be packaged.
4. **CI and environments.** The 52 specs run only locally via PowerShell + Chrome. A server project needs CI with a database.
5. **Test parity.** Specs are injected into the prototype page; they cannot run against an API. A server test suite must be written per module (the specs are the acceptance source, not reusable code).
6. **Seed data strategy.** Demo builders (`demo-script`) generate data at runtime; a server needs seed scripts.
7. **Time source.** Many rules use `fmNow()`/`CW.clock`/demo clock; the server needs one clock abstraction for tests.

## 5. Existing functionality that could be damaged

| At risk | How | Guard |
|---|---|---|
| Agency workflows, PayTrack, Workflow Studio (`renderWorkflowBuilder`, `WORKFLOWS`, `WF_TRIGGERS`, `WF_ACTIONS`), Cowork, Campaigns, Kairo, Intelligence | A corporate-first backend that changes shared entities (Job, Journey) without the agency rules | Shared entities are defined once with agency fields included from day one; agency specs remain the regression bar for the prototype; no prototype code is changed by the first milestones |
| Sales demos | Demos run on the prototype (Developer tools, demo companies) | Keep the prototype deployed unchanged as the demo environment until the new client reaches parity |
| Existing role and subscription capabilities | Re-modelling roles could drop permissions | Port `PERMISSION_MODULES`, `CUSTOM_ROLES`, `ROLE_TEMPLATES`, `ENTITLEMENT_CATALOG`, `NAV_PLAN_GATES` verbatim as seed data |
| Candidate-job journey relationship | Corporate "candidate to HM" modelled separately | ADR-07: one Journey |
| Branch work on `jaydeep-changes` | Porting one block re-opens merge conflicts | Port `corp-jobs-script` and its specs as a unit; re-run the full suite |

## 6. Decisions required before implementation

| ID | Decision | Recommendation | Blocks |
|---|---|---|---|
| D-1 | Backend language and stack | TypeScript on Node (the rules are JavaScript and port nearly verbatim; `oontu-approval-sla-engine.js` can run unchanged), PostgreSQL, a relational migration tool, a server-rendered or SPA client built from the design system | Everything |
| D-2 | Corporate model | One Job with approval stage (approved 20 Nov) | M5 onward |
| D-3 | Vendor org as tenant of kind `vendor` | Yes | M7 onward |
| D-4 | Domain claim behaviour change | Unverified claims do not lock colleagues out; `auto` join only on verified domains | M2 |
| D-5 | Vendor ownership window default | Choose 180 days (today) or 90 days | M8 |
| D-6 | Identity: build vs managed provider | Either; contract fixed by `docs/AUTH.md` | M1 |
| D-7 | Launch data region(s) | One region for the first milestone (India), design for more | M1 |
| D-8 | New client application vs evolving the single HTML file | New client (ADR-09) | M1 UI work |

## 7. Tests for this validation

The commands used are reproducible: `grep` for `createTenant(` callers, `PLATFORM_ROLES.push`, `joinLeadSync(`, `APPROVAL_CHAINS`, `RECRUITER_ROSTER` counts, `CW_IDEM`, and reading `coConsentGive`, `coReqOpenJob`, `currentActingUser`, `currentUserRoleId`.
