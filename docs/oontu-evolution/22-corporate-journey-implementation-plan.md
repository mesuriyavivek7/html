# 22 · Corporate employer journey: implementation plan

The first vertical journey to build for real:

**Corporate registration or Sales-assisted creation → provisioning → owner invitation → onboarding → internal team → requisition (job draft) → approval → allocation to internal recruiters and vendors → submission → evaluation → interview → hiring decision.**

Rules for this plan:
- Nothing in the prototype changes. It stays the reference and the demo.
- No demo shortcuts in the real system: no `123456` code, no `teamAccount`, no `provisionDemoAccount`, no persona identity, no simulated mail.
- External vendor agencies keep their own tenant, identity and permissions (ADR-04).
- Agency-only capabilities (clients, PayTrack, contracts, campaigns) are **not built** in this journey, but shared entities include their fields so nothing has to be reshaped later.

## 1. Journey map: existing code, reuse, new work

| # | Step | Prototype reference (rules to port) | Reuse | New work |
|---|---|---|---|---|
| 1 | Self-service corporate registration | `OA` sign-up screens; `sim.checkSignupEmail`, `corporateEmailProblem`, `FREE_EMAIL_DOMAINS`, `sim.createWorkspace`, `claimCorporateDomain`; lead `joinLeadSync` | Validation rules, error codes (`docs/AUTH.md` §5), copy, step order | Real identity service, email codes, domain claim per ADR-01/D-4, provisioning call |
| 1b | Sales-assisted creation | `ctSheetHTML`/`ctSubmit` → `createInvitedTenant`; `canPerformPlatformAction` | Field set, validations, audit wording | Platform realm sign-in, provisioning request (ADR-05) |
| 2 | Provisioning | `COUNTRIES` defaults; `WORKSPACE_STEPS_CORPORATE`; role templates | Defaults tables as seed | Saga, idempotency, duplicate detection |
| 3 | Owner invitation | `sim.acceptOwnerInvite`, `activateInvitedTenant`, owner link `#/invite/…` | Token rules (7 days, single use, POST to accept) | Email delivery, hashed tokens |
| 4 | Corporate onboarding | Setup steps `corp-setup`, `org-basics`, `corp-entities`, `corp-join`; `company-script` (`cfProfile`, legal entities, units); salary bands `coBands` | Progressive checklist, profile detection (Simple / Multi-location / Multi-company), band defaults | Server persistence of profile, entities, branches, departments, bands, join policy |
| 5 | Internal team setup | Team members invite, Reports to, role templates, `sim.createInvitation` / `sim.acceptInvitation` | Invitation rules, "only active Owner" rule | Role assignments with scope (ADR-06); corporate role templates |
| 6 | Requisition creation (job draft) | `corp-jobs-script` (jaydeep): job steps, HM "Ask HR for hiring support"; v2: `coReqFromSentence`, `coReqValidate`, `coBandCheck` | Validation rules, one-sentence draft (deterministic parser, no model needed) | Job API with draft status; HiringRequest from HMs |
| 7 | Approval | APS engine (`oontu-approval-sla-engine.js`); `APPROVAL_CHAINS`; `coReqChain` as preset `guarded`; `coReqAfterDecision`, `coReqOpenJob` | APS engine code and its 32 tests, nearly verbatim | Policy store, approver resolution by role + department scope, notifications |
| 8a | Internal recruiter allocation | Job team (`assignedBy`, recruiter fields), `isRecruiterMappedToJob` | Rules | Job team endpoints |
| 8b | Vendor allocation | `coVendorInvite`, `coInviteIssue/Accept`, `coVendorSaveDetails`, `coVendorAcceptTerms`, `coAssign*`, approved default "publish to all active empanelled vendors" | Lifecycle and invitation rules | Vendor tenant provisioning, relationship, job access (ADR-04) |
| 9a | Internal submission | `createSubmission`, consent (`m07-consent` rules), intake dedupe | Journey rules (one per candidate per job), consent limits | Candidate + journey + consent APIs, document storage |
| 9b | Vendor submission | `coVendorCheck`, `coVendorSubmit`, `coConsentGive`, identity engine `coIdentityMatch`, `coDupMsg`, `coVendorWithdrawWhy` | Duplicate rules and messages, consent page | Relationship-scoped vendor API, buyer-side duplicate decisions |
| 10 | Evaluation | HM review (`hm-*` screens, `coHmSend`/`coHmDecide`), shortlist/reject reasons (`CLIENT_REJECT_REASONS`, reject reason codes) | Review states, reason codes | Department-scoped HM queue (fixes the org-wide HM issue) |
| 11 | Interview | `interviews-script`: rounds, scheduling, interviewer scorecard links (scores hidden until submitted), `INTERVIEW_TRANSITIONS` | Rules and transitions | Calendar invites (email ICS first), interviewer links |
| 12 | Hiring decision | Journey statuses, offer record (M1), `OFFER_TRANSITIONS`; offer exceptions via approvals | Transition tables | Decision record on the journey; offer creation; vendor sees derived status (`coE6`) |

## 2. What is reused, concretely

1. **Rule functions** (ported to TypeScript, same names where possible): `corporateEmailProblem`, `coBandCheck`, `coReqValidate`, `coVendorCheck`, `coIdentityMatch`/`coIdScore`, `coDupMsg`, `coE6`, consent limits, journey uniqueness.
2. **APS engine**: run `oontu-approval-sla-engine.js` server-side with its existing tests first.
3. **Seed tables**: `PERMISSION_MODULES`, `CUSTOM_ROLES`, `ROLE_TEMPLATES`, `COUNTRIES`, `FREE_EMAIL_DOMAINS`, `WORKSPACE_STEPS_CORPORATE`, `CO_E6`, reject reasons, interview round types.
4. **Copy and states**: error messages (`AUTH_MESSAGES`), empty states, the vendor duplicate wording.
5. **Design system**: tokens, motion, brand assets, Home and page patterns (ADR-09).
6. **Specs as acceptance criteria**: `auth-flow`, `signup-recovery`, `company-setup`, `corporate`, `approvals`, `interviews`, `submission-flow`, `m07-consent`.

## 3. Explicitly out of scope for this journey

Agency domain (clients, PayTrack, contracts), Cowork/Campaigns execution, LinkIt/WhatsApp, marketplace discovery, contract hiring, Kairo model integration (Intelligence keeps running in the prototype), Super Admin CRM/support, multiple domains and SSO (designed in 02, built after the journey), group structures.

## 4. Sequence

The journey is split into milestones J0–J10 (doc 23). Each milestone is independently deployable and testable, and the first production-worthy slice ends at J3.

```
J0 Foundations ─► J1 Identity & tenancy ─► J2 Provisioning (self + Sales) ─► J3 Owner, team, roles ══ first production slice
   ─► J4 Corporate onboarding data ─► J5 Job draft + approval ─► J6 Internal allocation + candidates + submissions
   ─► J7 Vendor tenant + relationship + access ─► J8 Vendor submissions ─► J9 Evaluation + interviews ─► J10 Hiring decision
```

## 5. Permissions across the journey

| Actor | Tenant | Key permissions |
|---|---|---|
| Sales (platform) | platform | `platform-provisioning.create` |
| Owner / Admin | customer | everything in tenant; protected owner |
| TA Head / HR Partner | customer | `jobs.Create`, `jobs.Approve` (policy), `vendors.*`, scoped by entity/branch if configured |
| Internal recruiter | customer | `candidates.*`, `jobs.View` (own team), submit |
| Hiring manager | customer | `hiring_requests.Create`, review/decide journeys in own department |
| Interviewer | customer or link | scorecard on assigned interviews |
| Vendor owner / recruiter | vendor | own tenant; relationship-scoped `vendor.jobs.View`, `vendor.submissions.Create/Withdraw` |

## 6. Data model touched

`organizations`, `tenants`, `organization_domains`, `users`, `memberships`, `platform_users`, `roles`, `role_permissions`, `role_assignments`, `invitations`, `provisioning_requests`, `legal_entities`, `branches`, `departments`, `salary_bands`, `tenant_settings` (organisation scope), `approval_policies`, `jobs`, `job_approvals`, `job_team`, `hiring_requests`, `candidates`, `documents`, `consents`, `journeys`, `vendor_relationships`, `vendor_agreements`, `job_vendor_access`, `vendor_submissions`, `interviews`, `scorecards`, `offers`, `audit_events`, `outbox`.

## 7. Definition of done for the whole journey

The Phase 2 test passes on staging with real email: Sales (or self-service) creates a corporate tenant; the owner accepts; configures one legal entity, two departments, bands and the Guarded preset; invites a TA Head, a recruiter and a hiring manager; the HM raises a hiring request; HR drafts the job; it routes for approval and opens; it is shared with one internal recruiter and one vendor tenant; the vendor (in its own tenant) and the recruiter each submit a consented candidate; the HM (department-scoped) shortlists; an interview is scheduled and scored; a hiring decision and offer are recorded; the vendor sees only its candidate's derived status; every step is audited; a second corporate tenant and a second vendor see nothing of it.
