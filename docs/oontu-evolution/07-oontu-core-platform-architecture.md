# 07 · Oontu Core Platform architecture

## 1. Existing code evidence

| Capability | Prototype source of truth | Notes |
|---|---|---|
| Tenant registry | `PLATFORM_TENANTS` (line ~35,268) | Seeded with `CURRENT_ORGANIZATION_ID = 'org-northstar'` (line ~24,422) |
| Organisation identity | `ORG_STRUCTURE.profile` + `legalEntities` | One organisation per page |
| Workspace identity | Auth simulator `db.workspaces` | A second, parallel registry; linked to tenants by `tenant.workspaceId` |
| Membership | `db.accounts[email].memberships[]` (simulator) | Roles: owner/admin/manager/recruiter/hiring_manager (`AUTH_ROLE_TO_APP`) |
| Tenant users | `RECRUITER_ROSTER` | Not filtered by organisation in ~31 places (code comment in `createTenant`) |
| Platform users | `PLATFORM_USER_ROSTER`, `ACTIVE_PLATFORM_USER_ID` | Deliberately separate from tenant users |
| Authentication | `createAuthSimulator` / `createHttpAuthAdapter` | Contract in `docs/AUTH.md` |
| Authorisation (tenant) | `CUSTOM_ROLES`, `PERMISSION_MODULES`, `canI`, `roleHasPermission`, `sCan`, data scope (`m04b-data-scope.spec`) | Explicit enumeration, no wildcard bypass (comment at line ~35,210) |
| Authorisation (platform) | `PLATFORM_ROLES` (one role), `PLATFORM_PERMISSION_MODULES` (8 modules), `canPlatform` (checks suspended status before role) | Good pattern |
| Provisioning | `sim.createWorkspace`, `createInvitedTenant`, `createTenant`, `provisionDemoAccount`, `teamAccount` | **Four creation paths** |
| Plans | `PLATFORM_PLANS` (legacy Starter/Growth/Enterprise + Desk/Floor/Network, Hire/Scale/Group), `BOOSTS`, `WS_PLANS` | |
| Subscriptions | `PLATFORM_SUBSCRIPTIONS`, `SUBSCRIPTION_STATES` / `SUBSCRIPTION_TRANSITIONS` (line ~36,887) | Separate from tenant status (good), but the tenant also stores `subscriptionStatus` |
| Entitlements | `ENTITLEMENT_CATALOG` (line ~36,495), `NAV_PLAN_GATES`, `navPlanLocked` | |
| Feature controls | `TENANT_FEATURE_FLAGS` (line ~23,457), `PLATFORM_FEATURE_CONTROLS`, `FEATURE_CONTROL_STATES` | |
| Agent subscriptions | `AGENT_CATALOG`, `TENANT_AGENT_SUBSCRIPTIONS`, `agentAccess`, `PLATFORM_ADDON_LEDGER` | |
| Configuration | `WSX` settings tree, `sGet`/`sSet` (audited, with Undo) | One level (workspace) |
| Events and background jobs | `cwEngineTick` (Cowork), `cpJourneyTick`, `coSweep`, `coDormancySweep`, APS tick, `SCHEDULED_JOBS` (display only) | Timers in the browser |
| Notifications | `PLATFORM_ANNOUNCEMENTS`, in-app notifications, simulated mail arrays (`CO.mails`, `JN.mails`, `db.outbox`) | No delivery |
| Audit | `AUDIT_LOG`, `logAudit` (~114 call sites), `logPlatformAudit` | In memory, append-only by convention |
| Integrations | `CONNECTORS`, `CHANNEL_ADAPTERS`, `PLATFORM_AI` (keys "simulated") | No real integration |
| Retention | Not modelled | |
| Observability | None | |

## 2. Current implementation

The prototype already separates platform from tenant identity and permissions, uses explicit permission enumeration, and keeps tenant and subscription lifecycles as separate state machines. These are sound decisions; preserve them.

## 3. Limitations

1. **Two registries for the same thing:** `PLATFORM_TENANTS` (platform view) and `db.workspaces` (auth view), joined by an optional `workspaceId`.
2. **Four provisioning paths** with different validation (sign-up checks the corporate domain; `createTenant` does not).
3. **No tenant key on recruitment records** (`JOBS`, `CANDIDATES`, `CLIENTS`, `SUBMISSIONS` have no `organizationId`).
4. **Configuration has one scope** (`WSX`), so entity-, country- and department-level settings have nowhere to live except ad-hoc fields.
5. **Background work runs on browser timers**; nothing runs when nobody has the page open.

## 4. Proposed solution: services and their source of truth

Logical services (deployable as one modular monolith first; split later only if load requires):

| Service | Owns (source of truth) | Replaces |
|---|---|---|
| **Identity** | users, credentials, sessions, MFA, identity providers, platform users (separate table) | `createAuthSimulator`, `PLATFORM_USER_ROSTER` |
| **Tenancy** | organizations, tenants, workspaces (1:1 with tenant at first), domains, groups, vendor relationships (the link, not its content) | `PLATFORM_TENANTS` + `db.workspaces` + `EXISTING_WORKSPACES` |
| **Membership and access** | memberships, roles, permissions, data scopes, platform roles, support-access grants | `CUSTOM_ROLES`, `PLATFORM_ROLES`, simulator memberships |
| **Provisioning** | provisioning requests and their saga state | the four creation paths (see 10) |
| **Commercial** | plans, prices, boosts, subscriptions, entitlements, invoices (platform billing) | `PLATFORM_PLANS`, `PLATFORM_SUBSCRIPTIONS`, `WS_PLANS`, `PLATFORM_INVOICES` |
| **Feature control** | feature flags and kill switches (platform → tenant) | `TENANT_FEATURE_FLAGS`, agent kill switch |
| **Configuration** | versioned settings with scope and precedence (12) | `WSX` |
| **Events and jobs** | transactional outbox, event log, scheduled jobs, retries | browser ticks, `SCHEDULED_JOBS` |
| **Notifications** | templates, delivery, preferences, send ledger | simulated mail arrays, `CW` send ledger |
| **Audit** | append-only audit events (tenant and platform streams) | `AUDIT_LOG` |
| **Integrations** | connectors, credentials vault, webhooks | `CONNECTORS`, `PLATFORM_AI` |

**Tenant isolation:** every tenant-owned table carries `tenant_id`; the API resolves `tenant_id` from the server session membership only (already the rule in `docs/AUTH.md` §4); PostgreSQL row-level security is the second wall (already proposed in `OONTU_AGENCY_READY_REPORT.md` §7).

**Request pipeline (every API call):** authenticate → resolve membership → load tenant capability set (06) → check permission + data scope → execute domain rule → write record + audit + outbox event in one transaction.

## 5. Data impact

Introduces `tenant_id` on every recruitment record; the demo seed gets one tenant id per demo company (Kesar, Northstar, Vistaar already exist as separate builds in `demo-script`).

## 6. Permissions

Platform permission modules grow (08). Tenant permission modules stay as `PERMISSION_MODULES`. Neither plane can grant the other.

## 7. Dependencies

Stack decision (`docs/AUTH.md` §4). Everything else depends on this document.

## 8. Acceptance criteria

- One tenant registry; `workspaceId` and `tenantId` resolve to the same record.
- A recruitment query without a tenant context fails closed.
- A platform user session cannot call a tenant endpoint, and the reverse.
- Every state-changing call writes exactly one audit event and, where relevant, one outbox event in the same transaction.

## 9. Tests

API tests for cross-tenant reads and writes on every endpoint (item 9 of `docs/AUTH.md` §9). RLS tests at the database level. Port `settings.spec.js` permission checks.

## 10. Migration risks

- About 31 unfiltered `RECRUITER_ROSTER` reads and the global arrays mean the browser code cannot simply be pointed at an API. Each module's port must replace global reads with tenant-scoped queries. The prototype stays the reference implementation, not the client.
