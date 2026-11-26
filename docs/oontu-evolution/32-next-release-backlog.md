# 32 · Next release backlog

Ordered. Each item is a complete, testable unit.

## Track A · Unblocked now (in the executable reference)

| ID | Item | Files / functions | Done when |
|---|---|---|---|
| **N-1** | Route assisted setup from a sign-up lead through the provisioning engine | `join-script` (`jnAssistDo` and the call to `authApi._ensureLeadAccount`), `provisionTenant` | `signup-recovery` R-series still pass; a new provisioning case proves one tenant per lead, idempotent |
| N-2 | One approval-policy source: requisition chain from a preset (Simple/Guarded/Strict) stored with `APPROVAL_CHAINS`; `coReqChain` becomes the Guarded preset | `corp-script` `coReqChain`, approvals block | `corporate.spec` and `approvals.spec` pass; preset switch test |
| N-3 | Explicit currency and pay period for corporate bands and job pay (no universal LPA) | `coBands`, `coLpa`, band fields, Company setup | Bands show currency and period from the entity; India keeps LPA as a display format only |
| N-4 | Super Admin provisioning queue (list failed requests, Resume, step detail) | Super Admin Tenants area | Failed requests visible and resumable without the original sheet |
| N-5 | Fix the 7 baseline test failures or quarantine with reasons | specs listed in 26 §6 | Clean baseline |
| N-6 | Port `corp-jobs-script` from `jaydeep-changes` (after D-2) | new block before `nav-script` | jaydeep corp-jobs specs pass on main |

## Track B · Needs B-1 (server)

J0 → J1 → J2 (port `provisionTenant` + `tests/provisioning.spec.js` as the first server module) → J3 → J4 … J10, exactly as specified in 23.

## Track C · Needs your decisions

D-1 … D-8 (20 §6, 21). Recommended defaults are in those documents.
