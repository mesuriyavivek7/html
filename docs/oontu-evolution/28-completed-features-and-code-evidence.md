# 28 · Completed features and code evidence

## F1 · Shared provisioning engine

**Status: IMPLEMENTED AND VERIFIED** in the executable reference (`recruitment-os-prototype.html`). Persistence is SIMULATED (page memory), as for the rest of the prototype.

**Business outcome.** Every customer tenant, whether created by the Oontu team (Super Admin "Create tenant", the future Sales flow) or by the customer (Create workspace), is created by one engine. A double click, a retry or a failed step can never produce a second tenant, owner, invitation or subscription. Self-registered customers now appear in Super Admin › Tenants with an owner record, status Trial and an audit entry.

**Code changes** (`recruitment-os-prototype.html`):

| Change | Where |
|---|---|
| New engine: `PROVISION_CTX`, `PROVISION_STEPS` (`workspace`, `tenant`, `owner`, `subscription`, `audit`), `PROVISIONING` store, `provisioningRequestFor`, `provisionValidate`, `provisionStepFails` (test hook), `provisionTenant` | Platform section, directly after `createInvitedTenant` |
| `createInvitedTenant` reduced to a caller of `provisionTenant` (channel `assisted`) | same place |
| `createTenant` (no callers) delegates to the engine | above `PLATFORM_TENANT_ADMINS` |
| `createSubscriptionRecord(tenantId, planId, input, ctx)`: the engine passes `PROVISION_CTX` after authorising the whole request | Subscriptions section |
| Self-service hook: after `authApi.completeSetup()` succeeds in `createNow`, `provisionTenant({ channel:'self_service', idempotencyKey:'self:'+workspaceId, … })`; a failure never blocks the owner and stays retryable | `OA` module, `createNow` |
| Create tenant sheet: one `idemKey` per opened sheet; paused-step toast; resume; own in-progress domain claim not treated as a conflict (`ctEmailProblem`); changed-email refusal shown on the email field | `openCreateTenantModal`, `ctSubmit`, `ctEmailProblem` |

**Data model impact (reference).** New in-memory `PROVISIONING.requests[key] = { id, key, status: received|provisioning|failed|completed, attempts, tenantId, steps[{name,status,attempts,error,completedAt}], input{…}, out{workspaceId, inviteToken, inviteSentAt} }`. Tenant records gain `channel`, `provisioningRequestId`, `country`. Server equivalent: `provisioning_requests` (ADR-05, 23 J2).

**API (reference contract, for the server port).** `provisionTenant(req) → { ok, tenant, request, replayed? } | { ok:false, field?, reason } | { ok:false, retryable:true, step, reason, request }`. Maps to `POST /provisioning/self-service` and `POST /platform/provisioning-requests` in 23 J2.

**Permission rules.**
- `assisted`: `platform-tenant.create` (Super Admin and Operations roles; Support refused; suspended platform users refused because `canPlatform` checks status first).
- `self_service`: the workspace id from the auth layer's completed setup; no platform permission.
- Replaying an existing request requires the same permission as creating it, and the same owner email and channel.

**Tests executed.** `tests/provisioning.spec.js` (new, 10 cases, all passing, see 29): P1 assisted creation and platform audit actor; P2 idempotent replay; P3 failure at `subscription`, resume, no duplicates, failure audited; P4 validation and permission refusals create nothing; P5 real self-service sign-up through the screens registers exactly one tenant visible in Super Admin; P6 legacy path delegates; P7 replay without permission reveals nothing and key reuse is refused; P8 sheet pause and resume; P9 changed email refused without a script error; P10 Support/Operations/suspended platform roles.

**Defects found and fixed during verification.**
1. Replay returned a tenant before checking permission (P7).
2. A completed key could be replayed with a different owner email (P7).
3. Sheet retry for corporate tenants was blocked by the sheet's own domain pre-check (P8; root cause: the first attempt's domain claim).
4. A changed-email refusal would have thrown on `.focus()` of a non-existent field (P9).

**Known limitations.**
- Page-memory persistence: a reload loses provisioning requests, like every other record in the prototype.
- The self-service step trusts the workspace id returned by the auth layer in the same page; on the server the endpoint takes it from the session (ADR-03).
- There is no Super Admin provisioning queue screen yet; a failed assisted run is resumed from the same open sheet (or by calling the engine with the same key).
- `sim._ensureLeadAccount` (assisted setup from a sign-up lead) still creates workspaces outside the engine (N-1 in 32).
- Domain-claim behaviour is unchanged (D-4 pending).

**Migration notes.** No stored data exists to migrate. When the server is built, port `provisionTenant` and the 10 test cases first (J2); the steps and error contract are designed to map one to one.
