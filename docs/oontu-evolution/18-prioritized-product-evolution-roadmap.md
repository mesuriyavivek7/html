# 18 · Prioritised product evolution roadmap and executive review

## 1. Existing code evidence

The build order in `docs/OONTU_AGENCY_READY_REPORT.md` §7 (15 modules, foundation first, specs as definition of done) is sound and is kept. This roadmap adds the platform, corporate, vendor and Super Admin tracks the brief requires and resolves the evidence-based adjustments below.

## 2. Evidence-based adjustments to the brief's priority frame

1. **Settle the corporate model before porting it (P0).** The approved one-Job model exists only on `jaydeep-changes`; porting the v2 Requisition model would build the wrong domain.
2. **Vendor isolation is P0, not P1.** The vendor relationship defines a cross-tenant boundary; it must be in the tenancy design from day one, even if the vendor screens ship in P1.
3. **One provisioning engine is P0.** Four creation paths exist today; Sales-assisted onboarding (P1) depends on it.
4. **APS ports early.** Approvals are used by jobs, vendors, offers, money and (proposed) platform exceptions.

## 3. Milestones

Each milestone ends with: server specs green, truth matrix (17) updated, no regression in the ported browser specs.

### P0 · Foundations
- **M0 Decisions (1–2 weeks):** stack; corporate model (recommend one-Job); ownership window default (180 vs 90 days); domain-claim behaviour change (02 §11); data regions at launch.
- **M1 Core platform skeleton:** identity (`docs/AUTH.md` contract), tenancy (one registry), memberships, roles and data scope (port `CUSTOM_ROLES`/`PERMISSION_MODULES`), platform identity and roles (separate realm), audit, outbox and job runner, configuration service (organisation scope + versioning), RLS.
- **M2 Provisioning engine:** one saga for self-service and assisted; idempotency; duplicate detection; country packs at creation; owner invite; subscription and trial.
- **M3 Tenant-safe recruitment core:** candidates, jobs (one-Job model with optional approval), journeys, consent, interviews, offers. Port `submission-flow`, `intake-flow`, `interviews`, `m01`–`m07`.
- **M4 APS on the server:** port `test/aps.test.js` first, then `approvals.spec.js`.
- **M5 Vendor relationship foundation:** relationship, agreement, job access, vendor-only org provisioning, RLS per side (screens can stay minimal).

### P1 · Operational completeness
- **M6 Corporate workflows:** approval policies (presets), HM hiring requests, departments as scope, HM review, offer approval, contract hiring.
- **M7 Vendor lifecycle and portal:** invitation, onboarding, compliance documents, submissions, duplicate engine, feedback policy, interviews; agency-as-vendor link.
- **M8 Agency completion:** clients and terms, PayTrack (database sequences), contracts, agency BD pipeline.
- **M9 Super Admin business console:** platform role bundles; Sales CRM; demos and demo workspaces; sales-assisted onboarding on the engine; Customer 360 read model.
- **M10 Onboarding, support and incidents:** onboarding plans with automatic checks; tickets, SLAs, incidents; Account help as a ticket category; support-access grants.
- **M11 Unified work:** WorkItem read model behind Home "Needs you", To do and the Super Admin home.

### P2 · Intelligence and global operations
- **M12 Kairo gateway:** server adapter behind `IQ_ADAPTER`; tools with permissions; provenance; deterministic fallback.
- **M13 Agent execution:** durable AgentActions, send ledger on the real notification service, kill switches, metering; Cowork and Campaigns on events.
- **M14 Organisation knowledge and evaluation.**
- **M15 Global configuration:** entity/department scopes, country and tax packs as data, working calendars, localisation, data-region deployments.
- **M16 Customer success:** explainable health, renewals, expansion; vendor intelligence (scorecard); business intelligence read models.

### P3 · Refinement and scale
Advanced automation, experience refinement, performance (pre-generated demo data, read-model tuning), group/subsidiary views, employee portal and referrals, marketplace verification.

Security, isolation and data integrity are inside P0 and are re-tested at every milestone, never deferred.

## 4. Safest first end-to-end milestone

**"One corporate tenant, one internal hire, created by Sales."** M1 + M2 + a thin M3 + a thin M9:
Sales creates a prospect → wins it → provisions a corporate tenant through the engine → the admin accepts the invite → adds a department and a hiring manager → opens a job (Simple preset, no approval) → an internal recruiter adds a candidate with consent → interview → offer → joined. All server-side, tenant-isolated, audited. It exercises identity, tenancy, provisioning, permissions, the shared journey and the platform/tenant split without the vendor boundary or money, which follow in the next two milestones.

## 5. Executive review

1. **What is Oontu today?** A complete, rule-rich, well-tested product prototype of a recruitment operating system for agencies and corporates, with vendor, platform and intelligence surfaces, running entirely in one browser page. It is a specification you can click, not a running SaaS.
2. **What is strong and must be preserved?** The agency journey and its money rules; the derived-status discipline; APS approvals; consent and duplicate/identity rules; platform-vs-tenant identity separation; explicit permission enumeration; tenant and subscription lifecycles as separate machines; time-zone rules; Kairo's identity and person-only steps; Design 2.0 and its motion tokens; the 52 specs.
3. **Is the corporate experience designed for employers using internal teams and vendors?** In design, yes: requisitions or jobs, HM review, vendors, contract hiring, company setup. On the main line it still uses the older Requisition model with a hard-coded approval chain; the approved one-Job model sits on another branch.
4. **Can an MNC or an MSME run its internal recruitment on Oontu?** An MSME's flow works in the prototype. An MNC needs multiple domains, per-entity identity providers, configurable approval routing, department-scoped roles and country packs (02, 03, 12), none of which exist yet.
5. **Can external agencies serve several corporates without breaking tenant boundaries?** The rules are designed for it (count-only cross-company signal, own-candidate views), but there is no boundary today; the vendor portal shares memory with the corporate data. The relationship model in 04 is required.
6. **Is the corporate login and join flow sufficient for global organisations?** Not yet: one domain per workspace, ownership from an unverified email claim, one SSO domain. The journey is right; the controls behind it need the three-way split in 02.
7. **Can Sales onboard a customer without Super Admin?** No. Only Super Admin can create tenants, and creation is not linked to a sales record. M9 fixes this on the shared engine.
8. **Does Super Admin give complete operational control through roles?** It has the right permission pattern but one role, and no CRM, demos, support, incidents, onboarding plans or customer success.
9. **Does Core Platform provide the shared capabilities to scale?** Not as a platform: the pieces exist as in-memory structures, with four provisioning paths, two tenant registries and no persistence, events or isolation.
10. **Five most serious architectural gaps:** (1) no server, persistence or tenant isolation; (2) four provisioning paths, two registries; (3) vendor access without a cross-tenant boundary; (4) corporate domain model split across branches, with a hard-coded approval chain; (5) domain ownership and SSO model too simple for global organisations.
11. **What first?** M0 decisions, then M1–M2 (platform skeleton and one provisioning engine), then the first end-to-end milestone above.
12. **What must never be redesigned or duplicated?** The journey model (one engine for agency, corporate and vendor submissions), APS, the platform/tenant identity split, the consent and identity/duplicate rules, the agency money rules, Kairo's identity, and Design 2.0. No second CRM, tenant console, task app, client store or provisioning path.
13. **Safest first end-to-end milestone:** section 4.

## 6. Dependencies, data impact, permissions

As per the milestone's area documents.

## 7. Acceptance criteria

The final product test in the brief passes on a staging environment: a corporate goes from demo request to a measured hire with vendors, while Super Admin manages account, subscription, onboarding, support and renewal; an agency runs client to placement to invoice in parallel; Kairo assists in both with permission-checked context.

## 8. Tests

Each milestone's server suite plus the ported browser specs; cross-tenant suite at every milestone.

## 9. Migration risks

Branch drift (`jaydeep-changes` vs main) will grow; take the M0 decisions quickly, and port blocks deliberately rather than merging whole branches.
