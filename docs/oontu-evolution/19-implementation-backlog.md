# 19 · Implementation backlog

Epics follow the milestones in 18. Each item names the prototype source to port (the reference implementation and its spec). Size: S (≤3 days), M (≤2 weeks), L (≤6 weeks) for a small senior team; estimates are indicative.

## 1. Existing code evidence

Sources are cited per item. Specs live in `tests/`; the approvals engine tests live in `test/aps.test.js`.

## 2. Backlog

### M0 · Decisions
| ID | Item | Owner | Output |
|---|---|---|---|
| D-1 | Backend stack | Founders + eng lead | ADR (`docs/AUTH.md` §4 options) |
| D-2 | Corporate model: one-Job (recommended) vs Requisition + Job | Product | ADR; port plan for `corp-jobs-script` |
| D-3 | Vendor ownership window default (180 vs 90 days) | Product + legal | Policy default |
| D-4 | Domain claim: unverified claim no longer locks colleagues out; `auto` join only on verified domains | Product | Behaviour change approval |
| D-5 | Launch data regions | Founders | Region list |

### M1 · Core platform skeleton
| ID | Item | Source to port | Acceptance | Size |
|---|---|---|---|---|
| P-1 | Identity service per `docs/AUTH.md` §5–7 | `createAuthSimulator` rules | `docs/AUTH.md` §9 items 1–8, 10–11 | L |
| P-2 | Tenancy: organizations, tenants (merged with workspaces), domains | `PLATFORM_TENANTS`, `db.workspaces`, `EXISTING_WORKSPACES` | one registry | M |
| P-3 | Memberships, roles, data scope; route manifest | `CUSTOM_ROLES`, `PERMISSION_MODULES`, `canI`, `m04b` | permission matrix tests | M |
| P-4 | Platform identity realm, MFA, platform roles | `PLATFORM_USER_ROSTER`, `PLATFORM_ROLES`, `canPlatform` | cross-plane denial tests | M |
| P-5 | Audit service (tenant + platform streams, append-only) | `logAudit`, `logPlatformAudit` | one event per change | S |
| P-6 | Outbox, event bus, job runner, scheduler | browser ticks | at-least-once, idempotent consumers | M |
| P-7 | Configuration service (org scope, versioned) | `WSX`, `sGet`/`sSet` | version per change, Undo = revert | M |
| P-8 | RLS policies and cross-tenant test harness | — | every endpoint covered | M |

### M2 · Provisioning engine
| ID | Item | Source | Acceptance | Size |
|---|---|---|---|---|
| V-1 | ProvisioningRequest saga with idempotency key | `sim.createWorkspace`, `createInvitedTenant` | 10 §8 | L |
| V-2 | Duplicate detection (verified domain, tax id, name + country) | `corporateEmailProblem`, `_createOwnerInvite` | no duplicate org under concurrency | M |
| V-3 | Country pack defaults at creation | `COUNTRIES` mapping | currency, timezone, date format, region set | S |
| V-4 | Owner invitation and acceptance | `sim.acceptOwnerInvite`, `activateInvitedTenant` | single use, 7 days | S |
| V-5 | Retire `createTenant`; gate demo helpers to prototype | `createTenant`, `provisionDemoAccount`, `teamAccount` | none reachable in live mode | S |

### M3 · Tenant-safe recruitment core
| ID | Item | Source / spec | Size |
|---|---|---|---|
| R-1 | Candidates and talent pool with dedupe | `CANDIDATES`, intake dedupe; `intake-flow` | L |
| R-2 | Job (one-Job model, optional approval, openings, location, hire types) | `corp-jobs-script` (jaydeep), `JOBS`; corp-jobs specs | L |
| R-3 | Journey (one status per candidate per job, owner history, duplicate window, override) | `SUBMISSIONS`; `submission-flow`, `m02`, `m03`, `m05a/b` | L |
| R-4 | Consent links and limits | `m07-consent` | M |
| R-5 | Interviews, scorecards, holds, secure links | `interviews-script`; `interviews`, `m06` | L |
| R-6 | Offers and joining | M1 offer record; `m01` | M |

### M4 · Approvals
| ID | Item | Source | Size |
|---|---|---|---|
| A-1 | APS engine server port | `oontu-approval-sla-engine.js`, `test/aps.test.js` (port first) | M |
| A-2 | Approval policies as data (presets) | `coReqChain` → preset `guarded`; `JOB_APPROVAL_POLICY` | M |
| A-3 | Business-hours SLAs with working calendars | APS business hours | S |

### M5 · Vendor relationship foundation
| ID | Item | Source | Size |
|---|---|---|---|
| VR-1 | VendorRelationship, VendorAgreement (versioned) | `CO.vendors`, `feePct`, `termsAt` | M |
| VR-2 | JobVendorAccess with expiry and revoke | `coAssign*` | S |
| VR-3 | Vendor-only org provisioning via the engine | `coAccountCreate` | M |
| VR-4 | Per-side RLS and cross-tenant vendor tests | — | M |

### M6–M8 · Corporate, vendor, agency completion
| ID | Item | Source | Size |
|---|---|---|---|
| C-1 | HM hiring requests and HR routing | jaydeep corp-jobs | M |
| C-2 | Departments and branches as data scope | `company-script` units | M |
| C-3 | Contract hiring (buyer) | `coWo*`, `coSheet*`, `coInvoice*` | M |
| C-4 | Domains: multiple per org, DNS verification, IdPs per domain, join policy object | 02 §5 | L |
| VP-1 | Vendor portal on the API: jobs, submissions, apply links, interviews | `coV*` pages | L |
| VP-2 | Identity / duplicate engine server-side | `coIdentityMatch`, `coDup*` | M |
| VP-3 | Compliance documents and renewals | new | M |
| VP-4 | Feedback-share policy | new over `coE6` | S |
| VP-5 | Agency-as-vendor link | 05 §4 | M |
| AG-1 | Clients, terms, tax packs | `clients-script`; `clients` | L |
| AG-2 | PayTrack with database sequences | `paytrack-script`; `m08` | L |
| AG-3 | Contracts | `contracts-script`; `m09a/b` | L |
| AG-4 | Agency BD pipeline | new | M |

### M9–M11 · Super Admin, onboarding, support, unified work
| ID | Item | Source | Size |
|---|---|---|---|
| SA-1 | Platform permission bundles and multi-role users | `PLATFORM_PERMISSION_MODULES` | M |
| SA-2 | CRM: prospects, contacts, leads, opportunities, activities, proposals + discount approval | new | L |
| SA-3 | Demos and demo workspaces from templates | `DEMO_COMPANIES` builders | M |
| SA-4 | Create customer workspace from a won opportunity | V-1 | S |
| SA-5 | Customer 360 read model | new | M |
| SA-6 | Onboarding templates and plans with automatic checks | `WS_SETUPS` | M |
| SA-7 | Tickets, SLA policies, incidents; Account help as a ticket category | `join-script` | L |
| SA-8 | Support-access grants | `jnAssist*` | M |
| SA-9 | Provisioning, job and integration failure queues | new | M |
| UW-1 | WorkItem read model and rules | `bhNeeds`, `oRecruiterAttention`, `FOLLOW_UPS`, `cpMyDay` | L |

### M12–M16 · Intelligence and global
| ID | Item | Source | Size |
|---|---|---|---|
| K-1 | Kairo gateway implementing `IQ_ADAPTER` contract server-side | `IQ_ADAPTER`, `iqPlan*` as fallback and golden answers | L |
| K-2 | Permissioned tools and provenance | `iqPlan*` permission checks | M |
| K-3 | AgentAction execution, ledger, kill switch, metering | `cwEngineTick`, `AGENT_CATALOG`, `agentAccess` | L |
| K-4 | Knowledge sources and retrieval per tenant | new | L |
| K-5 | Evaluation harness and permission-leak evals | new | M |
| G-1 | Entity/department config scopes, country and tax packs as data | `company-script`, `CL_PACKS`, GST tables | L |
| G-2 | Localisation framework | new | M |
| G-3 | Data-region deployments, retention, export, deletion | new | L |
| CS-1 | Explainable health, renewals, success tasks | new | M |
| CS-2 | Vendor scorecard | jaydeep `cjScore` | S |

## 3. Limitations

Estimates assume the prototype stays available as the reference implementation and that the M0 decisions are made in time.

## 4. Data impact, permissions, dependencies

Per item, as detailed in documents 02–16.

## 5. Acceptance criteria

Each item's spec, ported to the API, is its definition of done (rule from `OONTU_AGENCY_READY_REPORT.md` §7), plus the cross-tenant suite.

## 6. Tests

The cross-tenant and RLS suites (P-8, VR-4) run on every merge from M1 onward.

## 7. Migration risks

- Porting from a branch with drift (R-2 from `jaydeep-changes`): copy the block and its specs, then re-run the full suite.
- Demo data generation must move to seed scripts (performance: Vistaar builds 4,500 journeys per open today).
