# 27 · Implementation progress

Phase 3 started 24 Nov 2026 from `88d8760`. This file records what was done, in order, and where to resume.

## Milestone 0 · Reconciliation and baseline: DONE

- 25 (reconciliation) and 26 (baseline) written.
- Finding that changed the plan: **the server milestones (J0–J10 in 23) cannot be built on this machine.** There is no Node, Python, .NET SDK, database or Docker, and the stack decision (D-1) is still open (26 §3, blocker B-1 in 30).
- Decision taken under the Phase 3 autonomy rule ("choose the smallest safe and coherent approach, document it, continue"): implement the highest-priority architecture slice **in the executable reference** (the single-file product), where it is testable today and directly portable to the server later. No new framework, dependency, database or service was introduced.

## Milestone 1 · Shared platform foundations: PARTIAL

| Unit | Status | Notes |
|---|---|---|
| **Shared provisioning engine (ADR-05, J2)** | IMPLEMENTED AND VERIFIED (in the reference; SIMULATED persistence) | `provisionTenant()` is now the only way a customer tenant is created. Both Super Admin "Create tenant" and self-service Create workspace use it. Idempotent, resumable, validated, permission-checked, audited. See 28 |
| Self-service tenants visible to Super Admin | IMPLEMENTED AND VERIFIED | Previously a self-registered workspace never reached `PLATFORM_TENANTS` (25 §2) |
| Subscription creation during provisioning | IMPLEMENTED AND VERIFIED | Previously skipped silently without `platform-subscription.update` |
| Dead `createTenant` | IMPLEMENTED AND VERIFIED | Delegates to the engine; no second path |
| Create tenant sheet retry | IMPLEMENTED AND VERIFIED | Paused step explained; Create again resumes; changed email refused cleanly |
| Organisation / tenant / workspace identity on a server | BLOCKED | B-1 |
| Tenant isolation, server-side authorisation | BLOCKED | B-1; cannot be proven in a single-page app |
| Persistence | BLOCKED | B-1 |
| `sim._ensureLeadAccount` (assisted setup from a lead) through the engine | NOT IMPLEMENTED | Next unit (32, N-1) |

## Milestones 2–6

NOT STARTED as server work (B-1). The prototype's existing corporate, vendor, agency, Super Admin, Kairo and Intelligence features were regression-tested unchanged (29).

## Where to resume

1. **If you unblock B-1** (choose the stack and allow installing a runtime and PostgreSQL, or provide a dev container/remote environment): start J0 in 23, then port `provisionTenant` and `tests/provisioning.spec.js` to the server as J2's first module; the rules and test cases are ready.
2. **If B-1 stays open:** continue in the reference with N-1 (route `sim._ensureLeadAccount` through the engine), then N-2 (one approval-policy source: `coReqChain` → preset over `APPROVAL_CHAINS`), then N-3 (explicit currency and pay period instead of LPA). Next file: `recruitment-os-prototype.html`, `join-script` (`jnAssistDo` → `_ensureLeadAccount`).

The overall program is **not complete**.

## Update, 24 Nov 2026 (later): server work unblocked, J0 done

- **B-1 resolved (no-admin route, your choice):** Node.js 26.13.1 (official zip, SHA-256 verified against nodejs.org) and PostgreSQL 18.4 (official EDB portable zip; its executables are not code-signed, so integrity rests on the HTTPS download from EDB) installed in `%LOCALAPPDATA%\oontu-dev`. No system PATH change, no Windows service.
- **D-1 accepted:** TypeScript on Node.js, PostgreSQL. Runtime dependency: `pg` only; dev: `typescript`, `@types/node`, `@types/pg`; npm audit: 0 vulnerabilities.
- **J0 Foundations: IMPLEMENTED AND VERIFIED** in `server/` (see `server/README.md`): config from environment, pooled transactions with transaction-local tenant context (`withTx`), checksummed forward-only migrations (`0001_foundation.sql`), append-only audit, transactional outbox with an at-least-once relay that retries, row-level security with a non-owner API role, `GET /health`. `server/test/foundation.test.ts`: **11 of 11 passing** against real PostgreSQL, including cross-tenant read/write denial and context-leak tests. Type check clean. Migration applied to the dev database (`oontu`).
- **Database migrations status:** `0001_foundation.sql` applied to the local `oontu` and `oontu_test` databases only. No other environment exists.
- **Next file:** `server/migrations/0002_identity_tenancy.sql` and `server/src/identity/` for J1 (users, email-code sign-in, sessions, organizations, tenants, memberships, platform users), following `docs/AUTH.md` §5–§7.
