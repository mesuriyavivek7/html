# 17 · Current capability truth matrix

Two columns matter: **Prototype** (does the behaviour exist and is it tested in the browser) and **Production** (is it real: persisted, server-enforced, delivered). Labels as defined in 00.

## 1. Existing code evidence

Every row names its evidence. Spec names refer to `tests/*.spec.js` at commit `fcb54ff` (52 specs; 7 known failures: `cowork-simple` page height, `cowork-visual` 390 px iframe, `demo-data` personal-link owner, `design-system` ×3 sidebar logo, `walkthrough-fixes` K9).

## 2. Matrix

| Capability | Prototype | Production | Evidence |
|---|---|---|---|
| **Identity and access** | | | |
| Email-first sign-in (code, password) | VERIFIED | SIMULATED | `createAuthSimulator`, `auth-flow` |
| SSO / Google / Microsoft | SIMULATED | MISSING | `sim.ssoStart`, `sim.oauthStart` |
| Create workspace (self-service) | VERIFIED | SIMULATED | `sim.createWorkspace`, `auth-flow`, `signup-recovery` |
| Personal-email refusal, domain discovery | VERIFIED | SIMULATED | `corporateEmailProblem`, `FREE_EMAIL_DOMAINS` |
| Domain verification (DNS) | MISSING | MISSING | `ws.verification = 'unverified'` only |
| Multiple domains per organisation | MISSING | MISSING | one `domain` per workspace |
| Join policies (request/auto/invite) | VERIFIED | SIMULATED | `corp-join`, `jnJoinApprove` |
| Invitations, owner invite | VERIFIED | SIMULATED | `sim.createInvitation`, `sim.acceptOwnerInvite` |
| Multiple memberships, picker | VERIFIED | SIMULATED | `sim.selectWorkspace` |
| In-app workspace switcher | MISSING | MISSING | `docs/AUTH.md` §10 |
| Tenant roles and permissions | VERIFIED | MISSING (server) | `CUSTOM_ROLES`, `canI`, `settings` |
| Data scope | VERIFIED | MISSING (server) | `m04b-data-scope` |
| Platform roles | PARTIALLY IMPLEMENTED (three roles: Super Admin, Support, Operations; see 20 C2) | MISSING | `PLATFORM_ROLES` |
| **Tenancy and platform** | | | |
| Tenant registry | VERIFIED | MISSING | `PLATFORM_TENANTS` |
| Tenant isolation | MISSING | MISSING | no tenant keys on recruitment data |
| One provisioning engine | MISSING (2 live paths + demo helpers; `createTenant` is dead code, see 20 C1) | MISSING | 10 §1 |
| Tenant lifecycle | VERIFIED | MISSING | `TENANT_STATUS_TRANSITIONS` |
| Subscription lifecycle | VERIFIED | MISSING | `SUBSCRIPTION_TRANSITIONS` |
| Plans, boosts, entitlements, feature controls | VERIFIED | MISSING | `PLATFORM_PLANS`, `BOOSTS`, `ENTITLEMENT_CATALOG`, `TENANT_FEATURE_FLAGS` |
| Configuration (versioned, scoped) | PARTIALLY IMPLEMENTED (one scope, audited) | MISSING | `WSX`, `sSet` |
| Audit | VERIFIED | MISSING | `logAudit`, `logPlatformAudit` |
| Background jobs, events | SIMULATED | MISSING | browser ticks |
| Notifications and email | SIMULATED | MISSING | mail arrays |
| **Agency** | | | |
| Clients, terms, tax | VERIFIED | MISSING | `clients.spec` |
| Jobs, intake, applicant owner | VERIFIED | MISSING | `intake-flow`, `m02` |
| Journeys, submission rules, consent | VERIFIED | MISSING | `submission-flow`, `m03`, `m07` |
| Client review links, interviews, holds | VERIFIED | MISSING | `interviews`, `flow-rules` |
| Offers, placements, PayTrack, commission | VERIFIED | MISSING | `m01`, `m08` |
| Contract staffing | VERIFIED | MISSING | `m09a`, `m09b` |
| Agency BD pipeline | MISSING | MISSING | — |
| **Corporate** | | | |
| Company setup (entities, regs, units) | VERIFIED | MISSING | `company-setup.spec` |
| Requisitions (separate record) | VERIFIED | MISSING | `corporate.spec` |
| One-Job model (approved) | MISSING on main (exists on `jaydeep-changes`) | MISSING | `corp-jobs-script` |
| Configurable approval policy | PARTIALLY IMPLEMENTED (APS configurable; requisition chain hard-coded) | MISSING | `coReqChain` |
| HM review and decisions | VERIFIED | MISSING | `coHm*`, `hm-*` |
| Contract hiring (buyer) | VERIFIED | MISSING | `coWo*`, `coSheet*` |
| Careers page / Oontu jobs website | PARTIALLY IMPLEMENTED | MISSING | `coSite*` |
| Headcount plans, budgets | MISSING | MISSING | boolean `budgeted` only |
| Employee portal, referrals | MISSING | MISSING | `role-wise-workflow-matrix.md` |
| **Vendor** | | | |
| Invite, accept, onboard, lifecycle | VERIFIED | MISSING | `corporate.spec` |
| Job access (assign, revoke, extend) | VERIFIED | MISSING | `coAssign*` |
| Submission, consent, apply links | VERIFIED | MISSING | `coVendorSubmit`, `coVLink*` |
| Identity / duplicate engine | VERIFIED | MISSING | `coIdentityMatch` |
| Vendor isolation | MISSING | MISSING | same page and memory |
| Agreements, documents, compliance | PARTIALLY IMPLEMENTED (fee %, terms acceptance, GSTIN format) | MISSING | `coVendorAcceptTerms` |
| Vendor scorecard | MISSING on main (jaydeep `cjScore`) | MISSING | `iqPlanVendors` guard |
| Marketplace | PARTIALLY IMPLEMENTED | MISSING | `coMarketRank`, `coMarketReveal` |
| **Super Admin** | | | |
| Tenants, create + owner invite | VERIFIED | SIMULATED | auth 06k |
| Sign-ups follow-up | VERIFIED (live capture via `joinLeadSync`, see 20 C3) | MISSING | `SIGNUP_LEADS` |
| Account help, assisted setup | VERIFIED | SIMULATED | `signup-recovery` |
| Plans, subscriptions, agents, features, users, notifications, audit | VERIFIED | MISSING | `oontu-*` |
| Sales CRM, demos, proposals | MISSING | MISSING | — |
| Customer 360 | MISSING | MISSING | — |
| Onboarding plans | MISSING | MISSING | — |
| Tickets, incidents, SLAs | MISSING | MISSING | — |
| Customer success, health, renewals | MISSING | MISSING | — |
| Support access grants | PARTIALLY IMPLEMENTED (assisted setup permission) | MISSING | `jnAssist*` |
| **Kairo and Intelligence** | | | |
| Kairo chat and navigation | VERIFIED | SIMULATED | `kairoRespond` |
| Intelligence answers | VERIFIED (deterministic) | SIMULATED (no model) | `IQ_ADAPTER.name='prototype'` |
| Permission-aware answers | VERIFIED | MISSING (server) | `intelligence-roles` |
| Agent autonomy, person-only steps, kill switch | VERIFIED | MISSING | `cowork-agents`, `settings` |
| Agent execution, retries | SIMULATED | MISSING | `cwEngineTick` |
| Organisation knowledge, retrieval, evaluation | MISSING | MISSING | — |
| Model provider integration | SIMULATED (masked keys) | MISSING | `PLATFORM_AI` |
| **Experience** | | | |
| Design system 2.0, motion tokens | VERIFIED | n/a | `design-system`, `motion`, `light` specs |
| Accessibility basics (labels, focus, reduced motion) | PARTIALLY IMPLEMENTED | n/a | `light.spec`, motion reduced-motion rules |
| Responsive (390 px) | PARTIALLY IMPLEMENTED | n/a | `cowork-visual` (one known failure) |

## 3. Limitations, proposals, data impact, permissions, dependencies

This document is the index of truth; the proposals for each row are in the document named by its area (02–16).

## 4. Acceptance criteria

The matrix is updated at the end of each milestone (18), and no row moves to production-ready without a server test.

## 5. Tests

Each row's evidence spec, plus the server suite named in its area document.

## 6. Migration risks

Rows marked VERIFIED (prototype) are the most likely to be mistaken for done. They are specifications with tests, not production features.
