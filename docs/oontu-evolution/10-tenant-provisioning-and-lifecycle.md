# 10 · Tenant provisioning and lifecycle

## 1. Existing code evidence

**Creation paths (four, plus a prototype helper):**

| Path | Function | Validation | Creates |
|---|---|---|---|
| Self sign-up | `sim.createWorkspace` (line ~28,515) | session required, names, password rules, `corporateEmailProblem` for Corporate, mobile rules | `db.workspaces[id]`, membership `owner`, domain claim; tenant record created later via setup |
| Super Admin create | `createInvitedTenant` (line ~36,276) | `canPerformPlatformAction('create','platform-tenant')`, `_createOwnerInvite` (`account_exists`, `domain_taken`) | `PLATFORM_TENANTS` (status `invited`), `PLATFORM_TENANT_ADMINS`, subscription, owner invite |
| Legacy platform create | `createTenant` (line ~35,442) | permission, name, admin, unique id; **no domain check** | `PLATFORM_TENANTS` (trial or active), tenant admin, subscription |
| Demo on unknown sign-in | `provisionDemoAccount` (line ~28,423) | prototype only (`AUTH_OPEN_SIGNIN`) | complete demo workspace |
| Demo team members | `teamAccount` (line ~28,351) | prototype only | account + membership in the page's workspace |

**Lifecycles:**
- Tenant: `TENANT_LIFECYCLE_STATES = ['invited','trial','active','suspended','cancelled','archived']` with `TENANT_STATUS_TRANSITIONS` (line ~35,360) and `TENANT_STATUS_REASONS` (line ~35,516).
- Subscription: `SUBSCRIPTION_STATES = ['trial','active','past_due','paused','cancelled','expired']`, `SUBSCRIPTION_TRANSITIONS` (line ~36,887).
- Plan state per created workspace: `WS_PLANS`, `wsPlanState` (trial days left, read-only after trial, `wsReadOnlyBlocked`).
- Vendor access lifecycle (corporate side): invitations, accounts, memberships, dormancy (04).

## 2. Current implementation

Good separation already: tenant status and subscription status are two machines with reasons. But the tenant record also stores `subscriptionStatus`, and `trial` appears in both machines, so "trial" means two things.

## 3. Limitations

1. Four creation paths with different rules: a tenant created by `createTenant` can claim a domain another workspace already holds.
2. Not idempotent: pressing Create twice or retrying creates a second tenant if the id differs (`generateTenantId`), and partial failures leave orphan records (an owner invite without a tenant or the reverse).
3. Onboarding progress, access, billing and support state are not modelled as separate lifecycles.
4. No archival, export or deletion process; `archived` exists as a state only.

## 4. Proposed solution

### 4.1 One provisioning engine
```
POST /platform/provisioning-requests   (Sales, Super Admin)        channel: sales_assisted | manual
POST /provisioning-requests            (self sign-up, after code)  channel: self_service
both → ProvisioningService.provision(request)
```
```
ProvisioningRequest {
  id, idempotencyKey,                      // client-supplied; same key → same result
  channel, requestedBy (user or platform user), opportunityId?,
  org: { name, type, country, locale, timezone, currency, dataRegion, domains[] },
  owner: { name, email, mobile? }, planId, commercial?, demoTemplate?,
  status: received | validating | provisioning | awaiting_owner | completed | failed | cancelled,
  steps: [{ name, status, attempts, lastError, completedAt }], tenantId?, createdAt
}
```
Steps (a saga; each step idempotent and resumable):
1. **Validate:** email shape, personal-domain policy, domain claim state, duplicate organisation (verified domain, tax id, normalised name + country), plan exists and is offered to the channel.
2. **Create organisation and tenant** (one transaction, unique constraints on verified domains).
3. **Apply defaults:** country pack (currency, timezone, date format, data region, tax-id label: today's `COUNTRIES` mapping), role templates by type (`ROLE_TEMPLATES`), default approval preset, setup checklist (`WORKSPACE_STEPS_*`), default feature controls by plan.
4. **Create subscription** (trial or contracted) and entitlements.
5. **Create owner membership:** self-service = the signed-in user is owner of this workspace (domain stays unverified, 02); assisted = owner invitation (7 days, single use).
6. **Create onboarding plan** from a template (11), assign owner.
7. **Emit `tenant.provisioned`;** notifications fan out from the outbox.

Duplicate detection returns `{ duplicateOf: tenantId, reason }`; the caller chooses "request to join", "contact Oontu", or (platform, with approval) "allow separate" (today's `jnAllowSeparate`).

`createTenant` is retired; `createInvitedTenant` and `sim.createWorkspace` become thin callers of the engine. `provisionDemoAccount` maps to `demoTemplate` with `demo:true` (prototype only).

### 4.2 Independent lifecycles (no overloaded status)

| Lifecycle | States | Responsible actor | Notes |
|---|---|---|---|
| Lead / opportunity | 09 | Sales | |
| Customer account | prospect → customer → former_customer | system on first paid subscription / end | |
| Provisioning request | received → … → completed / failed | engine; Ops resolves failures | |
| Owner invitation | pending → accepted / expired / revoked | system; Sales/Onboarding resend | |
| Tenant access | active ↔ restricted (read-only) ↔ suspended → closed | Finance (grace), Platform Ops (security), approvals | **Access** is what the product enforces |
| Organisation setup | not_started → in_progress → complete | tenant owner | today's checklist |
| Subscription | trial → active → past_due → paused / cancelled / expired | billing system, Finance | grace policy maps past_due → access `restricted` after N days, configurable |
| Onboarding | planned → in_progress → live → value_reached | Onboarding owner | |
| Renewal | upcoming → in_negotiation → renewed / churned | CS | |
| Data | live → retention_hold → export_ready → scheduled_deletion → deleted | Platform Ops with dual approval | cancellation never deletes |

Valid examples: tenant access `active` while setup `in_progress`; subscription `past_due` with access `active` inside grace; subscription `cancelled` with data `retention_hold` for the contractual period, export available, deletion only after approval.

### 4.3 Transitions
Each lifecycle keeps a transition table like today's `TENANT_STATUS_TRANSITIONS`, with a reason list like `TENANT_STATUS_REASONS`, actor permission and, where listed, an approval.

## 5. Data impact

New `provisioning_requests`, `tenant_access_state`, `data_lifecycle`; `tenants.status` split into the lifecycles above. Mapping: `invited` → access active + owner invitation pending; `trial` → subscription trial; `suspended` → access suspended; `cancelled` → subscription cancelled + data retention_hold; `archived` → data retention_hold or deleted.

## 6. Permissions

`platform-provisioning.create` (Sales, Onboarding, Super Admin), `platform-provisioning.retry` (Ops), `platform-tenant.suspend` (approval), `platform-tenant.delete` (dual approval).

## 7. Dependencies

07 (services), 02 (domain claims), 11 (onboarding plans), events (14).

## 8. Acceptance criteria

- The same idempotency key returns the same tenant; no duplicate organisation, user, subscription or invitation after any retry.
- A failure at step 4 resumes from step 4.
- Self-service and sales-assisted tenants differ only in owner creation and channel.
- Cancelling a subscription leaves data intact and exportable.

## 9. Tests

Saga tests with injected failures per step; concurrency (two requests, same domain); grace-period access; export and deletion approvals.

## 10. Migration risks

- Existing seeded tenants have mixed `status`/`subscriptionStatus`: map with the table in §5 and verify by hand.
- Changing "domain claim makes you owner of the organisation" (02) alters sign-up behaviour; needs approval.
