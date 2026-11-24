# 24 · Risk register and migration strategy

## 1. Migration strategy

**There is no production data to migrate.** The prototype holds demo data in memory and `localStorage`. "Migration" here means moving **behaviour** (rules, permissions, copy, design) into a real system without losing it, and keeping the existing product usable for demos and design work throughout.

Principles:
1. **Strangler, not rewrite-in-place.** The new system is built beside the prototype. The prototype file is not edited for this work (ADR-09); it stays deployed as the specification and the sales demo.
2. **Rule-by-rule porting with parity tests.** Each ported function keeps its prototype name in a comment and gets unit tests derived from the matching spec assertions. Where a spec asserts behaviour (e.g. `corporate.spec` duplicate messages), the server test asserts the same inputs and outputs.
3. **Seed, don't replay.** Demo tenants (Kesar, Northstar, Vistaar, a corporate demo) are generated once by seed scripts from the prototype builders (`demo-script`), not rebuilt per session (Vistaar's 4,500-journey build takes 11–12 s in the browser).
4. **Additive schema, flags per tenant.** Every milestone ships behind `feature_flags(tenant_id, key)`. Rollback = flag off + previous build; migrations are expand-then-contract so the previous build still runs.
5. **One source of truth per entity from day one.** No dual-writes between prototype and server; they never share data.
6. **Agency parity before the switch.** Agency customers keep using the prototype-based demo until the agency modules are ported (after the corporate journey). Shared entities (Job, Journey, Candidate) are designed with agency fields now so the agency port does not reshape them.

Cut-over per customer: a tenant moves to the new client only when every screen it uses has reached parity; until then the prototype is demo-only, never a system of record.

## 2. Risk register

Scale: likelihood (L) and impact (I) on 1–5.

| ID | Risk | L | I | Mitigation | Owner |
|---|---|---|---|---|---|
| R1 | **Branch drift:** the approved one-Job model lives on `jaydeep-changes` with many unmerged commits; v2/main has the older Requisition model | 5 | 4 | D-2 now; port `corp-jobs-script` and its specs as a block into the reference; stop parallel feature work on two branches | Product + eng lead |
| R2 | **Prototype mistaken for production** by customers or the team | 4 | 5 | Truth matrix (17) updated per milestone; prototype labelled "Prototype · simulated"; no customer data in the prototype | Founders |
| R3 | **RLS bypass through connection pooling or ORM** (tenant context not set per transaction) | 3 | 5 | ADR-03 pattern (`SET LOCAL` inside a transaction per request); API role without `BYPASSRLS`; "filter removed" tests in CI | Eng lead |
| R4 | **Rule drift while porting** (subtle behaviour differences) | 4 | 3 | Parity tests from spec assertions; port APS unchanged first; keep function names | Engineers |
| R5 | **Design fidelity loss** in the new client | 3 | 4 | Reuse the same CSS tokens, motion and assets; screenshot parity per screen; design review per milestone | Design |
| R6 | **Email deliverability** (codes, invitations) blocks the first slice | 3 | 4 | Transactional provider with SPF/DKIM/DMARC from J0; sandbox in staging; delivery status recorded (the prototype already models DELIVERY_FAILED for vendor invites) | Eng |
| R7 | **Decisions delayed** (D-1…D-8) | 4 | 4 | Time-box M0 to two weeks; default to the recommendations in 20 §6 if undecided | Founders |
| R8 | **Personal data compliance** (candidate PII, vendor transfers, model providers later) | 3 | 5 | Consent records from J6; DPA templates; data region fixed at provisioning; legal review list in `docs/AUTH.md` §8; no model provider in this journey | Founders + counsel |
| R9 | **Scope creep** into agency, Cowork, Kairo during the corporate journey | 4 | 3 | Out-of-scope list (22 §3); milestones closed only on their definition of done | Product |
| R10 | **Vendor identity privacy** (a buyer learning which competitors a vendor serves) | 2 | 4 | Keep `coOtherOrgs` behaviour (count only, never names); relationship-scoped APIs | Product |
| R11 | **Domain-claim behaviour change** confuses existing sign-up expectations | 3 | 3 | D-4 approval; copy reviewed; Request to join stays the visible path | Product |
| R12 | **HM authority assumption** carried from the prototype (HMs act as Owner there) | 4 | 4 | ADR-06 department scope; explicit tests (J9) | Eng |
| R13 | **Test-suite noise:** 7 known prototype failures mask regressions in the reference | 3 | 2 | Fix or quarantine the 7 with notes before porting the related modules | Eng |
| R14 | **Two approval-policy sources** (`APPROVAL_CHAINS` vs `coReqChain`) ported separately | 3 | 3 | ADR-06: one `approval_policies` store; `coReqChain` becomes preset `guarded` | Eng |
| R15 | **Team capacity:** a small team spread across platform, client and domain work | 4 | 4 | Vertical milestones (23) with one in flight at a time; no parallel module rewrites | Founders |
| R16 | **Super Admin still on prototype** while real tenants exist | 3 | 3 | J2 includes the minimal real platform console (create tenant, see provisioning); the rest of Super Admin follows in P1 | Eng |

## 3. Protecting the existing product

| Capability | Protection |
|---|---|
| Design identity | Same tokens, motion and brand assets (ADR-09); no redesign |
| Staffing agency workflows, PayTrack | Prototype untouched; shared entities include agency fields; agency port follows the corporate journey |
| Candidate-job journey relationship | ADR-07: one Journey for internal, vendor, intake and campaign sources |
| Kairo, Intelligence, AI Workforce (Cowork, Campaigns), Workflow Studio (`renderWorkflowBuilder`, `WORKFLOWS`) | Not ported in this journey; continue in the prototype; the server's audit/event design (ADR-08) and AgentAction concept reuse `CW_IDEM` and `SEND_LEDGER` semantics when they are ported |
| Role and subscription capabilities | Seeded verbatim (`PERMISSION_MODULES`, `CUSTOM_ROLES`, `ROLE_TEMPLATES`, `ENTITLEMENT_CATALOG`, `NAV_PLAN_GATES`, `BOOSTS`) |
| No duplicate modules | One provisioning engine, one approval store, one journey, one tenant registry; prototype and server never share data |

## 4. Recommendation: the first smallest production-worthy vertical slice

**Build J0 + J1 + J2 + J3: "A corporate customer is created (by self sign-up or by Sales) through one provisioning engine, its owner accepts a real invitation, and invites teammates who sign in with real, scoped roles, fully isolated from every other tenant."**

Why this slice first:
1. **Everything else depends on it.** Requisitions, approvals, vendors, submissions and interviews all need real identity, tenancy, isolation, permissions, audit and events. Building any of them first would mean building on simulated foundations, which is the exact gap the audit found.
2. **It replaces the most simulated part of Oontu.** Sign-in, provisioning, invitations and memberships are entirely faked today (`createAuthSimulator`). This slice makes them real, and its contract is already written (`docs/AUTH.md` §5–§9), so the risk of designing the wrong thing is low.
3. **It removes duplicate sources of truth on day one.** One provisioning engine for self-service and Sales (fixes the two live creation paths), one tenant registry (fixes `PLATFORM_TENANTS` vs `db.workspaces` vs `EXISTING_WORKSPACES`).
4. **It proves isolation before any candidate data exists.** Cross-tenant and RLS tests become CI gates while the data is still low-risk (company and user records, no candidate PII), so the boundary is trusted before J6 brings resumes.
5. **It is production-worthy, not a demo.** Real emails, real sessions, real roles, real audit. A real customer could be onboarded and could build their team on it, even though hiring screens follow in J4–J10.
6. **It is small enough to finish.** Four milestones with a written contract, no domain complexity from money, vendors or agents, and no change to the existing prototype.

What it deliberately does not include: requisitions, vendors, candidates, Kairo, agency modules, multiple domains and SSO. Those follow in order (J4 → J10), each on a foundation that has already been proven.
