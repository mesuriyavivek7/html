# 30 · Known gaps and blockers

## Blockers

| ID | Blocker | Effect | What unblocks it |
|---|---|---|---|
| **B-1** · RESOLVED 24 Nov (no-admin Node 26 + PostgreSQL 18 in %LOCALAPPDATA%oontu-dev; D-1 = TypeScript/Node/PostgreSQL) | Was: no server toolchain on this machine and stack decision D-1 open | Every server milestone (J0–J10): persistence, tenant isolation, server-side authorisation, migrations, real identity, background jobs | Your decision on D-1 plus permission to install a runtime and PostgreSQL locally, **or** a provided dev container / remote development environment |
| B-2 | No email provider account | Codes, owner and team invitations cannot be delivered for real | A transactional email provider account (sandbox is enough for staging) |
| B-3 | No object storage | Real resume/document handling | A storage bucket (or local equivalent in the dev environment) |
| B-4 | No model provider credentials and no processor agreement | Kairo/Intelligence/AI Workforce stay deterministic (honestly labelled) | Provider choice, keys in a secret store, a DPA |
| B-5 | Architecture decisions D-2…D-8 and ADR-01…09 not accepted | Domain model and policy defaults for later milestones | Your answers (21) |

## Gaps (product)

| Area | Gap | Status |
|---|---|---|
| Tenant isolation | Recruitment data has no tenant key; `RECRUITER_ROSTER` unscoped (223 references) | NOT IMPLEMENTED (server work, B-1) |
| Identity | Persona-based acting user; hiring managers act as Owner | NOT IMPLEMENTED |
| Corporate model | One-Job model only on `jaydeep-changes`; Requisitions screen on main | NOT IMPLEMENTED on main (D-2) |
| Approvals | Two policy sources (`APPROVAL_CHAINS`, `coReqChain`) | NOT IMPLEMENTED (N-2) |
| Compensation | LPA hard-coded in corporate bands (`coLpa`, `coBands`) | NOT IMPLEMENTED (N-3) |
| Domains and SSO | One domain per workspace, one SSO domain | NOT IMPLEMENTED |
| Vendor isolation | Vendor portal shares page memory with buyer data | NOT IMPLEMENTED (B-1) |
| Super Admin | CRM, demos, Customer 360, tickets, incidents, CS, provisioning queue screen | NOT IMPLEMENTED |
| Assisted setup from a lead | `sim._ensureLeadAccount` outside the engine | NOT IMPLEMENTED (N-1) |
| Kairo / Intelligence | No model gateway, retrieval, evaluation | SIMULATED / NOT IMPLEMENTED (B-4) |
| Global | No localisation, working calendars, data residency | NOT IMPLEMENTED |

## Known bugs (baseline, unchanged by Phase 3)

The 7 baseline test failures listed in 26 §6 (design-system ×3, cowork-simple, cowork-visual, demo-data, walkthrough-fixes K9). They predate Phase 3 and were not touched.
