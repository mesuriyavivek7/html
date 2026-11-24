# 25 · Phase completion and reconciliation

Reconciled on 24 Nov 2026 against `agency-prototype-v2` at `88d8760` (documents commit) plus the Phase 3 working-tree changes described in 27. A task counts as complete only with code, tests and evidence.

## 1. Document inventory

All 25 expected documents exist under `docs/oontu-evolution/` (00–24, plus `README.md`). None had to be reconstructed. They were written on 24 Nov 2026, in the same session as this reconciliation, so there was no time for the code to drift away from them; corrections come from re-checking, not from later code changes.

| Doc | Exists | Content status | Notes |
|---|---|---|---|
| 00 Vision and boundaries | Yes | VERIFIED COMPLETE (as analysis) | Boundaries still hold |
| 01 Screen/role/workflow audit | Yes | VERIFIED COMPLETE | Includes experience audit (§5) |
| 02 Corporate auth and discovery | Yes | VERIFIED COMPLETE (analysis); proposals NOT IMPLEMENTED | Domain claim still one domain per workspace |
| 03 Corporate operating model | Yes | PARTIALLY COMPLETE | Says the approval chain is hard-coded; 20 C4 adds that `APPROVAL_CHAINS` exists as a second policy source |
| 04 Vendor ecosystem | Yes | VERIFIED COMPLETE (analysis); NOT IMPLEMENTED | Vendor isolation still absent |
| 05 Agency model | Yes | VERIFIED COMPLETE | |
| 06 Capability matrix | Yes | VERIFIED COMPLETE | |
| 07 Core platform | Yes | OUTDATED in one point | "Four provisioning paths" → two live paths (20 C1); now one engine in the reference (27) |
| 08 Super Admin console | Yes | OUTDATED in two points | Platform roles are three, not one (20 C2); sign-up lead capture is live (20 C3) |
| 09 Sales and assisted onboarding | Yes | OUTDATED in one point | Lead capture exists (`joinLeadSync`); CRM should build on `SIGNUP_LEADS` |
| 10 Provisioning and lifecycle | Yes | PARTIALLY COMPLETE | Engine design now implemented in the reference (27); lifecycle split NOT IMPLEMENTED |
| 11 Customer 360 / support / CS | Yes | NOT IMPLEMENTED | |
| 12 Global multi-tenant | Yes | NOT IMPLEMENTED | LPA hard-coding noted below (§4) |
| 13 Kairo / Intelligence / agents | Yes | OUTDATED in one point | Cowork has idempotency keys `CW_IDEM` (20 C6) |
| 14 Domain model and events | Yes | NOT IMPLEMENTED | |
| 15 Unified operating experience | Yes | NOT IMPLEMENTED | |
| 16 Security and readiness | Yes | VERIFIED COMPLETE (as assessment) | Roster exposure larger (20 C5) |
| 17 Truth matrix | Yes | PARTIALLY COMPLETE | Rows corrected after 20; provisioning row updated again by 27 |
| 18 Roadmap and executive review | Yes | OUTDATED in two points | "one platform role", "four provisioning paths" |
| 19 Backlog | Yes | PARTIALLY COMPLETE | V-1/V-5 now partly done in the reference (27) |
| 20 Validation | Yes | VERIFIED COMPLETE | Its corrections re-checked in this pass |
| 21 ADRs | Yes | PROPOSED, NOT ACCEPTED | No ADR has your acceptance yet |
| 22 Corporate journey plan | Yes | NOT IMPLEMENTED (J2 engine done in the reference only) | |
| 23 Milestones | Yes | BLOCKED (server milestones) | Toolchain and D-1 missing (26) |
| 24 Risks and migration | Yes | VERIFIED COMPLETE | R7 (decisions delayed) and the toolchain blocker have materialised |

## 2. Verification of key claims against current code

| Claim | Status | Evidence |
|---|---|---|
| Single HTML prototype; one `fetch` (live auth adapter) | VERIFIED | `createHttpAuthAdapter` is the only `fetch` |
| No tenant key on recruitment records | VERIFIED | `JOBS`, `CANDIDATES`, `CLIENTS` seeds have no `organizationId` |
| Self-service sign-up creates a platform tenant | **CONTRADICTED BY CODE before Phase 3** | Only `PLATFORM_TENANTS.push` calls were the dead `createTenant`, `createInvitedTenant` and a seed. Self-service tenants were invisible to Super Admin. **Fixed in the reference by 27** |
| Subscription creation available to provisioning | **CONTRADICTED BY CODE before Phase 3** | `createSubscriptionRecord` required `platform-subscription.update`, so assisted creation by a role without it silently skipped the subscription, and self-service never had one. Fixed by the engine context (27) |
| Two live creation paths + demo helpers | VERIFIED (and a third assisted helper exists) | `sim.createWorkspace`, `createInvitedTenant`; `provisionDemoAccount`, `teamAccount`; **`sim._ensureLeadAccount`** (assisted setup from a lead) was not listed before; it creates workspaces too |
| Hiring managers act as Owner | VERIFIED | `currentActingUser`, `currentUserRoleId` |
| Vendor submissions join the shared journey | VERIFIED | `coConsentGive` |
| One-Job model only on `jaydeep-changes` | VERIFIED | `corp-jobs-script` count 0 on this branch |
| Two approval-policy sources | VERIFIED | `APPROVAL_CHAINS` and `coReqChain` |
| Kairo/Intelligence have no model integration | VERIFIED | `IQ_ADAPTER.name = 'prototype'`; `PLATFORM_AI` keys simulated |

Identifier check: every backticked identifier in 00–24 was searched for in the code, specs and `docs/AUTH.md`. Result recorded in 26 §6.

## 3. Decisions proposed but never taken

D-1 stack, D-2 corporate model, D-3 vendor tenant, D-4 domain claim, D-5 ownership window, D-6 identity build/buy, D-7 region, D-8 client strategy, and acceptance of ADR-01…09. **Status: BLOCKED on you.** D-1 is also blocked by the machine (26 §3).

## 4. Implementation that contradicts the architecture (still open)

| Finding | Contradicts | Status |
|---|---|---|
| Compensation hard-coded in LPA (`coLpa`, `coBands` defaults "B1–B5 in LPA", band fields `ctcMax` in lakhs) | 12 (currency and period must be explicit) | NOT IMPLEMENTED (fix needs the jaydeep corporate model first, to avoid fixing it twice) |
| `RECRUITER_ROSTER` unscoped (223 references) | ADR-03 | NOT IMPLEMENTED (server-side by design) |
| Persona identity (`currentActingUser`) | ADR-02 | NOT IMPLEMENTED |
| Hard-coded requisition chain | ADR-06 | NOT IMPLEMENTED |
| `sim._ensureLeadAccount` creates workspaces outside the engine | ADR-05 | NOT IMPLEMENTED (assisted setup path; next unit, 32) |

## 5. Missing tests and unverified claims

- Server-side behaviour of anything: no server exists (BLOCKED).
- `corp-jobs-script` has not been run on this branch (unverified port).
- Performance claims (Vistaar timings) come from earlier reports, not re-measured in this pass.
- Accessibility: no WCAG audit has been run.
