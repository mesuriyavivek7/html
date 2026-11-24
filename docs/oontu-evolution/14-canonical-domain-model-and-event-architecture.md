# 14 · Canonical domain model and event architecture

## 1. Existing code evidence (entity → prototype store)

| Entity | Prototype store | Tenant key today |
|---|---|---|
| Organisation / profile | `ORG_STRUCTURE.profile` | implicit (one per page) |
| Tenant | `PLATFORM_TENANTS` | id |
| Workspace | simulator `db.workspaces` | id |
| Legal entity, tax registration, unit | `ORG_STRUCTURE.legalEntities`, branches, departments, cost centres (`company-script`) | implicit |
| Domain | `EXISTING_WORKSPACES[].domain` | via workspaceId |
| User (tenant) | `RECRUITER_ROSTER` | **none** |
| User (platform) | `PLATFORM_USER_ROSTER` | n/a |
| Membership | simulator `memberships[]` | workspaceId |
| Role / permission | `CUSTOM_ROLES`, `PERMISSION_MODULES`; `PLATFORM_ROLES` | implicit |
| Subscription, plan, entitlement | `PLATFORM_SUBSCRIPTIONS`, `PLATFORM_PLANS`, `ENTITLEMENT_CATALOG`, `WS_PLANS` | tenantId |
| Configuration | `WSX` | implicit |
| Audit event | `AUDIT_LOG` | partial (`organizationId` appears 96 times in the file) |
| Client, contact, terms | `CLIENTS`, clients-script terms versions | **none** |
| Job | `JOBS` | **none** |
| Candidate | `CANDIDATES` | **none** |
| Journey / submission | `SUBMISSIONS` | **none** |
| Interview, feedback | interviews-script stores | none |
| Offer, placement | offer record (M1), `PLACEMENTS` | none |
| Invoice, credit note, commission | `paytrack-script` | none |
| Contract assignment, timesheet | `contracts-script`, `ASSIGNMENTS` | none |
| Requisition | `CO.reqs` (v2) / `Job.approval` (jaydeep) | implicit |
| Vendor account, vendor membership, invitation | `CO.accounts`, `CO.vendors`, `CO.invites` | `orgs[]` on the account |
| Job vendor access, vendor submission | `CO.assigns`, `CO.vsubs` | implicit |
| Work order, timesheet, invoice (buyer) | `CO.contracts`, `CO.sheets`, `CO.invoices` | implicit |
| Approval request | `APPROVAL_REQUESTS` (has `organizationId`) | yes |
| Agent, agent action, campaign | `AGENT_CATALOG`, Cowork ledgers, `CAMPAIGNS`, `WORKFLOW_RUNS` | partial |
| Sign-up lead, escalation | `SIGNUP_LEADS`, `JN.escalations` | n/a |
| Prospect, opportunity, demo, ticket, incident, onboarding plan, renewal | — | MISSING |

## 2. Current implementation

Rich entities with consistent shapes and derived statuses; no tenant key on most tenant data; several entities exist twice across branches (requisition) or across registries (tenant/workspace).

## 3. Limitations

Covered above: missing tenant keys, duplicate registries, requisition modelled two ways, vendor entities embedded in the corporate module, platform business entities missing.

## 4. Proposed canonical model (reuse first)

**Shared platform:** `Organization`, `OrganizationGroup`, `Tenant` (merges tenant + workspace), `OrganizationDomain`, `IdentityProvider`, `User`, `PlatformUser`, `Membership`, `Role`, `RoleAssignment` (with data scope), `PlatformRole`, `Plan`, `Subscription`, `Entitlement`, `FeatureControl`, `ConfigValue`, `AuditEvent`, `SupportAccessGrant`.

**Shared recruitment engine (one, not two):** `Candidate` (tenant-owned master), `Job` (with optional `JobApproval`, openings, location, entity/department/branch, hire type), `Journey` (candidate × job; one status list; owner history; source: internal | vendor | campaign | intake), `Interview`, `Feedback/Scorecard`, `Offer`, `Consent`, `ApprovalRequest` (APS), `Activity`.

**Agency extensions:** `Client`, `ClientContact`, `ClientTerms` (versioned), `ClientProspect`, `ClientOpportunity`, `Placement`, `Invoice`, `CreditNote`, `Commission`, `Replacement`, `ContractAssignment`, `Timesheet`.

**Corporate extensions:** `Department`, `BusinessUnit`, `Branch`, `LegalEntity` (shared with agency for billing), `SalaryBand`, `HeadcountPlan` (P2), `HiringRequest` (HM asks HR), `ApprovalPolicy`, `WorkOrder` (buyer side).

**Vendor relationship (links two tenants):** `VendorRelationship`, `VendorAgreement`, `JobVendorAccess`, `VendorSubmission` (in the buyer tenant, references the vendor org and its candidate ref), `VendorCompliance`, `VendorScore` (derived).

**Oontu internal:** `Prospect`, `Contact`, `Lead`, `Opportunity`, `Demo`, `DemoWorkspace`, `SalesActivity`, `Proposal`, `CustomerAccount`, `OnboardingTemplate`, `OnboardingPlan`, `Milestone`, `Ticket`, `Incident`, `SlaPolicy`, `HealthScore`, `Renewal`, `SuccessTask`, `ProvisioningRequest`.

**Kairo:** `AgentAction`, `KnowledgeSource`, `Conversation`, `UsageEvent`.

Decisions on reuse:
- **Requisition → `JobApproval`** (approved one-Job model), not a table of its own.
- **`HiringManager` is a role assignment** with department scope, not an entity.
- **`InternalRecruiterAssignment` = Job team** (exists on jobs today).
- **`VendorInvoice`** reuses `Invoice` with `relationshipId` when the buyer pays a vendor through Oontu (P2).
- **`ClientProspect` and platform `Prospect` share a shape but not a table** (different tenants and owners).

### 4.1 Tenant boundaries
Every tenant-owned row has `tenant_id`. Platform tables have none and are unreachable from tenant sessions. Relationship tables carry both `buyer_tenant_id` and `vendor_tenant_id`, and RLS policies admit each side only to its columns and rows.

### 4.2 Events (transactional outbox, at-least-once, idempotent consumers)
Naming `<entity>.<past-tense>`, payload = ids + changed fields, never full personal data.

| Producer | Events |
|---|---|
| Provisioning | `tenant.provisioned`, `tenant.provisioning_failed`, `owner.invited`, `owner.accepted` |
| Tenancy | `tenant.access_changed`, `domain.verified`, `membership.created/removed`, `role.changed` |
| Commercial | `subscription.changed`, `invoice.issued/paid/overdue` |
| Recruitment | `job.opened/closed`, `job.approval_requested/decided`, `journey.created/status_changed/owner_changed`, `interview.scheduled/completed`, `offer.made/accepted/declined`, `candidate.joined` |
| Vendor | `vendor.invited/activated/suspended`, `job_vendor_access.granted/revoked`, `vendor_submission.created/duplicate_flagged/decided` |
| Agency money | `placement.created`, `invoice.issued`, `commission.payable` |
| Kairo | `agent_action.proposed/approved/executed/failed` |
| Platform ops | `ticket.created/escalated/resolved`, `incident.opened/resolved`, `milestone.completed` |

Consumers: notifications, work queue (15), read models for reports and Customer 360, usage metering, Kairo triggers (Cowork engine replaces its browser tick with event + schedule triggers).

## 5. Data impact and migration strategy

1. Freeze the domain schema from this list; generate the migration per module in the build order (18).
2. Seed: generate demo tenants once per environment from `demo-script` builders (not replayed per session).
3. Map `CO.*` to vendor tables (04 §5) and `CO.reqs` to `JobApproval` (03).

## 6. Permissions

Each entity names its owning tenant and the permission module that governs it (existing `PERMISSION_MODULES` ids are reused).

## 7. Dependencies

07, 10, 12, 13.

## 8. Acceptance criteria

- Each entity has exactly one owning service and one table (or is explicitly a read model).
- Every domain event is emitted from the same transaction as its state change.
- Reports read only read models built from events or from canonical tables, never stored counters (rule already stated in the agency report).

## 9. Tests

Schema contract tests; outbox delivery and idempotent consumption; RLS per tenant and per relationship side.

## 10. Migration risks

Getting `Journey` right is the core: agency submissions, corporate candidates-to-HM, vendor submissions and campaign moves must all be one journey model with source and policy, or the engine forks.
