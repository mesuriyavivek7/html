# 29 · Test and security results

All results below were executed on 24 Nov 2026 on the final Phase 3 working tree (HEAD `88d8760` + uncommitted Phase 3 changes), headless Chrome, 1440×900. Nothing listed as passed was skipped or weakened.

## 1. Full regression

| Run | Specs | Checks | Passed | Failed |
|---|---|---|---|---|
| Baseline (`fcb54ff`, 26 §6) | 52 | 882 | 875 | 7 |
| **Phase 3 final** | **53** (+ `provisioning.spec.js`) | **892** | **885** | **7** |

The 7 failures are the same tests with the same messages as the baseline (also failing at `206c54d`, before any of today's work):
`cowork-simple` (Northstar page height 1418 vs limit), `cowork-visual` (390 px iframe cross-origin SecurityError), `demo-data` (personal-link owner reassigned by SLA round-robin), `design-system` ×3 (collapsed icon 30.08 px, logo x 0 vs 27.93, white pill), `walkthrough-fixes` K9 (Vistaar history 99%). **No regression was introduced.**

APS engine unit tests (`test/run-aps-tests.ps1`): **34 checks passed**.

Note on method: an earlier full run was stopped and restarted because code changed while it ran (fixes found during review). Only the restarted run, on the final code, is reported.

## 2. Phase 3 feature tests: `tests/provisioning.spec.js`

10 of 10 passed (standalone and inside the full run): P1 assisted creation and platform-audit actor · P2 idempotent replay · P3 failed step, resume, no duplicates, failure audited · P4 validation and permission refusals create nothing · P5 real self-service sign-up registers exactly one tenant visible in Super Admin · P6 legacy path delegates · P7 replay without permission reveals nothing; key reuse refused · P8 Create tenant sheet pause and resume · P9 changed email refused without a script error · P10 Support refused, Operations allowed, suspended platform user refused.

Four defects were found by these tests and fixed before the final run (28 §Defects).

## 3. Results by focus area

| Focus area | Evidence | Result | Scope of what it proves |
|---|---|---|---|
| Corporate registration and onboarding | `auth-flow` (88), `signup-recovery` (11), `company-setup` (14), `provisioning` P5 | Pass | Prototype behaviour; self-service now provisions through the engine |
| Organisation / tenant / workspace isolation | `intake-flow` E1 "Nothing crosses a tenant boundary" (prototype seeds) | Pass, **but not a security result** | **BLOCKED** as a security test: no server, no database, one page memory (B-1). Isolation cannot be proven in a single-page app |
| Multiple workspace memberships | `auth-flow` 11 "A member of two workspaces chooses one" | Pass | Simulated auth only |
| Corporate requisitions and approvals | `corporate` (32), `approvals` (14), APS 34 | Pass | Prototype; requisition chain still hard-coded (N-2) |
| Corporate-to-vendor boundaries | `corporate`: vendor sees only own interviews; duplicate message minimal; HR contacts only on shared jobs | Pass | Filter-level in one page; **not a security boundary** (B-1) |
| Agency client and candidate journeys | `clients` (31), `submission-flow` (19), `intake-flow` (31), `agency-e2e`, `m01`–`m11` | Pass | Unchanged by Phase 3 |
| Sales-assisted onboarding | `auth-flow` 06k, `provisioning` P1, P8 | Pass | Super Admin path through the engine; Sales CRM not built |
| Provisioning and retry safety | `provisioning` P2, P3, P8, P9 | Pass | Engine in the reference |
| Super Admin role permissions | `provisioning` P4, P7, P10; `settings` (15) | Pass | Platform roles vs tenant roles kept apart |
| Kairo, Intelligence, AI boundaries | `intelligence*` (51 in total), `cowork-agents` (26: "Always a person" can never be Auto, kill switches), `cowork-journey`, `campaigns` | Pass | Deterministic rules; no model integration exists (B-4) |
| PayTrack and recruitment | `m08-paytrack` (15), `m09a`/`m09b`, `clients` | Pass | Unchanged |

## 4. Security tests not executed (and why)

| Test | Status | Reason |
|---|---|---|
| Cross-tenant API reads/writes, RLS, file access, background-job tenant context | NOT EXECUTED | No server or database (B-1) |
| Session security, CSRF, rate limiting, MFA, SSO | NOT EXECUTED | Simulated auth only; contract and test plan in `docs/AUTH.md` §9 |
| Penetration test, dependency scan, backup/restore drill | NOT EXECUTED | Nothing deployable exists |
| AI permission-leak and hallucination evaluations | NOT EXECUTED | No model integration (B-4) |

These must not be reported as passed. They are the gating tests of the server milestones (23).
