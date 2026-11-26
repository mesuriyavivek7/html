# 21 · Foundational architecture decision records

Status of every ADR: **Proposed**. Each needs your acceptance before implementation. Stack-specific details assume D-1 (TypeScript/Node, PostgreSQL); the decisions themselves are stack-neutral.

---

## ADR-01 · Organization, tenant and workspace identity

**Current.** Three overlapping registries: `ORG_STRUCTURE.profile` (one organisation per page), `PLATFORM_TENANTS` (platform view, `id`, `status`, `plan`, `workspaceId?`), simulator `db.workspaces` (auth view). `EXISTING_WORKSPACES` is a fourth, keyed by domain. `CURRENT_ORGANIZATION_ID` is a constant.

**Decision.**
- **Organization**: a business or legal identity (name, country, verification, domains). It can exist without being a customer (a prospect, a vendor that has not signed up).
- **Tenant**: the isolation boundary and the commercial account holder. `kind: 'customer' | 'vendor' | 'demo'`, `orgType: 'agency' | 'corporate'` for customers. Exactly one Organization per Tenant.
- **Workspace**: **not a separate entity in this phase.** `workspaceId` in the auth contract (`docs/AUTH.md`) is the tenant id. A future multi-workspace tenant is out of scope.
- **OrganizationGroup**: deferred (P3); the column `groupId` is reserved on Organization.
- **LegalEntity, Branch, Department, CostCentre** belong to the Tenant (ported from `company-script`).

```sql
organizations(id uuid pk, name text, country char(2), verification text check in ('unverified','pending','verified','rejected'), group_id uuid null, created_at)
tenants(id uuid pk, organization_id uuid unique references organizations, kind text, org_type text null, data_region text, status_access text, created_at)
organization_domains(id uuid pk, organization_id uuid references organizations, domain citext, status text, method text, verified_at, unique (domain) where status='verified')
legal_entities(id, tenant_id, name, country, currency, fy_start, ...), branches(id, tenant_id, legal_entity_id, name, country, region, city), departments(id, tenant_id, name, head_user_id null)
```

**Migration.** No production data exists. Demo companies (Kesar, Northstar, Vistaar) become seed tenants. `PLATFORM_TENANTS` fields map: `status` → access/subscription split (ADR-05 and doc 10).

**Tests.** Unique verified domain across organisations; tenant ↔ organisation 1:1; a vendor tenant has no `org_type`.

---

## ADR-02 · User identity and multiple memberships

**Current.** Simulator accounts `db.accounts[email]` with `memberships[{workspaceId, role}]`; tenant people in `RECRUITER_ROSTER` (no tenant key); vendor people in `CO.accounts` (one per email across Oontu, `orgs[]`); platform people in `PLATFORM_USER_ROSTER`. Persona identity (`currentActingUser()` returns Priya or Arjun).

**Decision.**
- **One `users` table** for every human outside Oontu staff: customer employees, hiring managers, vendor recruiters, candidates with accounts. Identified by verified email; credentials per `docs/AUTH.md` §6.
- **`memberships(user_id, tenant_id, status, invited_by, joined_at)`**: many per user. A vendor recruiter is a member of the vendor tenant; never of the buyer tenant.
- **`platform_users`**: separate table, separate session realm, MFA required. A platform user can also be a customer user only with a different identity record (no shared login).
- **Session** holds `user_id` and `active_tenant_id`; `POST /auth/session/workspace` switches tenant (exists in the contract).
- Outsiders without accounts (client contacts, external interviewers, candidates on consent pages) act through **scoped link tokens**, not users (existing secure-link design, `slValid`).

**Migration.** `RECRUITER_ROSTER` seed people become users + memberships in their demo tenant; `CO.accounts` become users in vendor tenants; personas disappear from the server (the prototype keeps them).

**Tests.** One email, two memberships, switch keeps `user_id`; a vendor user's session can never hold a customer tenant id it is not a member of; platform session rejected by tenant endpoints.

---

## ADR-03 · Tenant isolation and server-side authorisation

**Current.** None server-side. `canI`, data scope and nav filtering in the browser.

**Decision.**
- **Shared database, shared schema, `tenant_id` on every tenant-owned row.**
- The API derives `tenant_id` from the session membership only; never from request input.
- **PostgreSQL row-level security** as the second wall: every tenant table has a policy `tenant_id = current_setting('app.tenant_id')::uuid`; the application sets `app.tenant_id` (and `app.user_id`) with `SET LOCAL` at the start of each transaction. Migrations run as a role that owns tables; the API connects as a role **without** `BYPASSRLS`.
- **Platform schema** (`platform.*`: CRM, provisioning, subscriptions) is a separate schema and DB role; tenant API roles have no grants on it.
- **Authorisation pipeline** per request: authenticate → load membership → load tenant capability set → `authorize(permission, resource)` (role permission + data scope) → domain rule → write + audit + outbox in one transaction.

**Risk to watch.** ORMs that pool connections must run each request in a transaction where `SET LOCAL` is applied; verify with an RLS test that deliberately omits the application filter.

**Tests.** For every endpoint: tenant A token on tenant B resource → 404/403; RLS test with application filter removed still returns zero rows; background jobs set the tenant context explicitly.

---

## ADR-04 · Corporate-to-vendor organisation relationships

**Current.** `CO.vendors` (membership per company, `feePct`, `termsAt`), `CO.accounts` (identity), `CO.invites` (hashed tokens), `CO.assigns` (job access), `CO.vsubs` (vendor-side submission linked to a shared journey by `subId`). All inside the buyer's page.

**Decision.**
- A vendor agency is a **tenant of kind `vendor`** (or an existing agency tenant; same organisation, linked by verified domain or tax id). Provisioned by the shared engine (ADR-05).
- **`vendor_relationships(id, buyer_tenant_id, vendor_tenant_id, status, agreement_id, created_by, ...)`**: the only link between the two tenants.
- **`job_vendor_access(job_id, relationship_id, granted_by, expires_at, revoked_at, submission_limit)`** in the buyer's data.
- **`vendor_submissions`** live in the **buyer** tenant (the buyer owns the hiring decision) with `relationship_id`, `vendor_ref`, `consent_id`, ownership window fields, and `journey_id` (the shared journey). The vendor sees its submissions through a **relationship-scoped API**, not by sharing tables.
- RLS for relationship-scoped reads: policy admits a vendor session when `relationship_id` belongs to a relationship whose `vendor_tenant_id = app.tenant_id` and only through views exposing allowed columns (derived status `coE6`, dates, vendor ref, feedback per policy).
- The vendor's own talent pool stays in the vendor tenant; submission copies candidate fields under consent.

**Migration.** Map `CO.*` as above; `coOtherOrgs` behaviour (count only, never names) kept.

**Tests.** Vendor A never reads vendor B's submissions; vendor never reads buyer notes, scores or other journeys; revoking access blocks new submissions immediately; relationship suspension blocks all vendor reads except its own history (policy-dependent).

---

## ADR-05 · Shared customer provisioning

**Current.** Two live paths (`sim.createWorkspace`, `createInvitedTenant`), dead `createTenant`, prototype helpers (20 §1 C1).

**Decision.** One `ProvisioningService.provision(request)` saga (design in doc 10 §4.1) called by:
- `POST /provisioning/self-service` (session after email code; owner = caller),
- `POST /platform/provisioning-requests` (platform user with `platform-provisioning.create`; owner = invitation),
- `POST /vendor-invitations/{token}/accept` when the vendor has no tenant (creates a `vendor` tenant).

Idempotency key required; unique constraints (verified domain, `(tenant_id, idempotency_key)`); each step idempotent; a failed step is resumable by Operations.

**Tests.** Double submit; retry after each step's failure; concurrent claims on one domain; self-service and assisted produce identical tenant defaults.

---

## ADR-06 · Role and permission architecture

**Current.** Tenant: `CUSTOM_ROLES` with permission sets over `PERMISSION_MODULES` (explicit enumeration, `role_founder` protected), `ROLE_TEMPLATES`, data scope in `m04b-data-scope`. Platform: `PLATFORM_ROLES` (three), `PLATFORM_PERMISSION_MODULES` (eight), `canPlatform` checks suspension first. Approval policy: `APPROVAL_CHAINS` + hard-coded `coReqChain`.

**Decision.**
- **Permissions are data**: `permissions(module, action)` seeded verbatim from `PERMISSION_MODULES`; roles are tenant-owned sets (`roles`, `role_permissions`), seeded from `CUSTOM_ROLES` + `ROLE_TEMPLATES`, with corporate templates (Owner, Admin, TA Head, HR Partner, Recruiter, Hiring Manager, Interviewer, Approver, Finance).
- **Role assignments carry scope**: `role_assignments(user_id, tenant_id, role_id, scope_type: 'tenant'|'legal_entity'|'branch'|'department'|'own', scope_id null)`. A hiring manager = Hiring Manager role scoped to their department (fixes C7).
- **Owner** stays protected (cannot be removed while sole owner; existing rule "only active Owner").
- **Capabilities and plan entitlements** gate before permissions (doc 06).
- **Approval policy**: one store (`approval_policies`) evaluated by the ported APS engine; `APPROVAL_CHAINS` seeds it; `coReqChain` becomes the `guarded` preset. Presets Simple / Guarded / Strict as approved.
- **Vendor tenants** have their own roles (Vendor owner, Vendor recruiter). Access to buyer jobs is a **relationship grant**, not a role.
- **Platform roles** stay separate; add bundles later (doc 08).

**Tests.** Permission matrix per template; scope tests (HM sees own department only); sole-owner protection; approval preset changes apply to new jobs only.

---

## ADR-07 · Canonical recruitment records and lifecycle

**Current.** `JOBS`, `CANDIDATES`, `SUBMISSIONS` (journeys, one per candidate per job), interviews, offers (M1 record), `CO.reqs` linked to jobs on jaydeep (`fromJob`, `jobId`).

**Decision.**
- **Job** (one entity for agency and corporate): `status: draft → waiting_for_approval? → open → on_hold → filled | closed`; corporate fields (legal entity, branch, department, cost centre, hiring manager, band, hire type, openings); agency fields (client, terms version) nullable by capability.
- **JobApproval** (sub-record of Job): policy version used, steps, decisions; replaces `CO.reqs`. The business word "requisition" labels a job before it opens.
- **Candidate**: tenant-owned master (dedupe within tenant).
- **Journey** (candidate × job): one status list (`JOURNEY_STATUS_LABEL`), `source: internal|vendor|intake|campaign|referral`, owner + owner history, consent link, ownership window (vendor), derived outsider status (`coE6`).
- **Interview**, **Scorecard**, **Offer** (one per journey), **HiringDecision** recorded on the journey (decision, decided_by, reason).
- Lifecycle transitions are validated by the server using the prototype's transition tables (`OFFER_TRANSITIONS`, `INTERVIEW_TRANSITIONS`, journey rules).

**Tests.** Transition tables; one open journey per candidate per job; consent required before a vendor journey becomes visible to the hiring team; offer only on an eligible journey.

---

## ADR-08 · Audit and event architecture

**Current.** `AUDIT_LOG` + `logAudit` (~114 call sites, actor resolved), `logPlatformAudit`; Cowork `SEND_LEDGER`; no events.

**Decision.**
- `audit_events(id bigserial, plane 'tenant'|'platform', tenant_id null, actor_type user|platform_user|system|agent|link, actor_id, action, entity_type, entity_id, before jsonb, after jsonb, reason, ip, at)`: append-only (no UPDATE/DELETE grants), partitioned by month, hash-chained per tenant (P2).
- **Transactional outbox** `outbox(id, tenant_id, type, payload, created_at, published_at)` written in the same transaction as the state change; a relay publishes to the job runner / queue; consumers are idempotent (dedupe on event id).
- Event names `entity.past_tense` (doc 14 §4.2). Payloads carry ids and changed fields, not personal data.
- Never log codes, tokens, passwords (existing rule).

**Tests.** Each state-changing endpoint writes exactly one audit event; outbox row exists iff the transaction committed; consumer replay is harmless.

---

## ADR-09 · Client application strategy (resolves conflict 20 §3)

**Decision.** Build a new client application against the API, reusing the Oontu Design 2.0 system (design tokens, `oontu-design` and `oontu-motion` CSS, brand assets in `assets/brand/`, component patterns such as `bhHome`, `oPageHead`, `oBadge`). The single HTML prototype is **not modified** by the new work; it remains the executable specification and the sales demo until each module reaches parity.

**Why.** The prototype's global arrays (223 roster references, global `JOBS`/`CANDIDATES`) cannot be pointed at a tenant-scoped API safely; rebuilding screen by screen with the same design keeps the identity without inheriting the data model.

**Tests.** Visual parity checks against the prototype's screenshots for each ported screen; the design-system and motion rules re-expressed as client tests.
