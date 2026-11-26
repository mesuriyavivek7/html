# 23 · Engineering milestones and acceptance criteria

Each milestone is small, independently testable and deployable behind a tenant-level feature flag. "Prototype reference" lists the files and functions whose behaviour is ported; the prototype itself is never edited.

Common to all milestones:
- **Tests:** unit tests for ported rules; API tests (allow + deny); a cross-tenant test for every new endpoint; RLS tests for every new table.
- **Migration style:** forward-only, expand-then-contract schema migrations; no prototype data to migrate.
- **Rollback:** turn the tenant feature flag off; redeploy the previous build; migrations are additive, so the previous build keeps working.
- **Audit:** every state change writes an `audit_events` row and, where listed, an outbox event.

---

## J0 · Foundations (no customer-visible change)

- **Business outcome:** a safe place to build: repository, CI, environments, observability.
- **Existing files:** none changed. `tests/run-auth-tests.ps1` keeps running the prototype suite.
- **Backend:** service skeleton (D-1), PostgreSQL, migration tool, config and secrets, structured logging, error tracking, health checks, one clock abstraction (port of `fmNow` semantics for tests), email provider adapter (sandbox).
- **Frontend:** client skeleton with Design 2.0 tokens, fonts, motion tokens and brand assets copied from `assets/brand/` (ADR-09).
- **Data model:** `audit_events`, `outbox`, `feature_flags`.
- **API:** `GET /health`.
- **Permissions:** none.
- **Tests:** CI runs unit, API and migration tests against a real database; outbox relay test.
- **Dependencies:** D-1, D-7.
- **Definition of done:** a commit deploys to staging automatically; an audit row and an outbox event are written and relayed in a test transaction.

## J1 · Identity and tenancy core

- **Business outcome:** real accounts and sign-in; tenants exist; isolation works.
- **Prototype reference:** `createAuthSimulator` rules, `docs/AUTH.md` §5–§7, `AUTH_MESSAGES`, `FREE_EMAIL_DOMAINS`.
- **Backend:** users, email-code sign-in (CSPRNG code, HMAC stored, 10-minute expiry, 5 attempts, 30 s cooldown), optional password, sessions (`__Host-` cookie, rotation, CSRF), organizations, tenants, memberships, platform users (separate realm with MFA), RLS framework with `SET LOCAL app.tenant_id`.
- **Frontend:** sign-in screens (email, code, password) rebuilt from the `OA` design; "Sign-in isn't available" state for errors.
- **Data model:** `users`, `email_challenges`, `sessions`, `organizations`, `tenants`, `memberships`, `platform_users`, `platform_sessions`.
- **API:** `GET /auth/session`, `POST /auth/email/start`, `POST /auth/email/verify`, `POST /auth/password/sign-in`, `POST /auth/sign-out`, `POST /auth/session/workspace` (exact contract from `docs/AUTH.md` §5). Platform: `POST /platform/auth/…` equivalents.
- **Permissions:** membership required for any tenant endpoint; platform realm separate.
- **Tests:** `docs/AUTH.md` §9 items 1–5, 9; port `auth-flow` 01-series assertions as API tests; RLS "filter removed" test.
- **Migration/rollback:** new tables only.
- **Dependencies:** J0, D-6.
- **Definition of done:** a user with memberships in two tenants signs in, switches, and every call is scoped; a platform user is rejected by tenant endpoints and vice versa.

## J2 · Shared provisioning: self-service and Sales-assisted

- **Business outcome:** a corporate customer can be created by sign-up or by Sales, through one engine.
- **Prototype reference:** `sim.checkSignupEmail`, `corporateEmailProblem`, `sim.createWorkspace`, `claimCorporateDomain`, `createInvitedTenant`, `ctSubmit` fields, `COUNTRIES` defaults, `WORKSPACE_STEPS_CORPORATE`, `joinLeadSync` (lead record).
- **Backend:** `ProvisioningService` saga (validate → org + tenant → defaults → subscription stub (trial) → owner membership or owner invitation → setup checklist → `tenant.provisioned`); idempotency keys; duplicate detection; domain claim as **provisional** (D-4); sign-up lead record in the platform schema (successor of `SIGNUP_LEADS`).
- **Frontend:** Create workspace questions (corporate path), Super Admin "Create tenant" sheet, provisioning status display.
- **Data model:** `provisioning_requests`, `organization_domains`, `signup_leads`, `subscriptions` (minimal: plan id, status trial), `tenant_setup_items`.
- **API:**
  - `POST /auth/sign-up/check-email {email, type}` → `{ok}` | `personal_email` | `domain_pending{company, ownerMasked, canRequestJoin}`
  - `POST /provisioning/self-service {idempotencyKey, name, organizationName, country, teamSize}` → `{tenant, membership}`
  - `POST /platform/provisioning-requests {idempotencyKey, org:{name,type,country}, owner:{name,email,mobile?}, planId, note}` → `{request, tenantId}`
  - `GET /platform/provisioning-requests/{id}`
- **Permissions:** self-service needs a verified-email session; assisted needs `platform-provisioning.create` (Super Admin and Operations roles at first).
- **Tests:** idempotent double submit; failure injected at each saga step then resumed; concurrent requests on one domain; personal domain refused; assisted and self-service tenants have identical defaults; port `auth-flow` 06k and `signup-recovery` lead assertions.
- **Migration/rollback:** additive; flag `provisioning.v1`.
- **Dependencies:** J1, D-4.
- **Definition of done:** both entry points create exactly one organisation, tenant, subscription, setup list and owner (or invitation) per request, auditable end to end.

## J3 · Owner invitation, internal team and roles (first production-worthy slice ends here)

- **Business outcome:** the customer's owner gets in and builds their team with real roles.
- **Prototype reference:** `sim.acceptOwnerInvite`, `activateInvitedTenant`, `sim.createInvitation`, `sim.acceptInvitation`, Team members (invite, suspend with hand-over, "only active Owner"), `CUSTOM_ROLES`, `PERMISSION_MODULES`, `ROLE_TEMPLATES`, `m04a`–`m04d` specs.
- **Backend:** invitations (32+ random bytes, hashed, 7 days, single use, bound to email and role, POST to accept, resend withdraws earlier link); roles and permissions seeded from prototype tables plus corporate templates; role assignments with scope (tenant or department, departments arrive in J4 and default to tenant scope); sole-owner protection; email delivery for invites.
- **Frontend:** owner invite acceptance page, Team members list, invite drawer, role picker, suspend.
- **Data model:** `invitations`, `roles`, `permissions`, `role_permissions`, `role_assignments`.
- **API:** `GET /invitations/owner/{token}`, `POST /invitations/owner/{token}/accept`, `POST /invitations {email, name, roleId, scope?}`, `GET /invitations/{token}`, `POST /invitations/{token}/accept`, `GET/POST/PATCH /roles`, `GET /members`, `PATCH /members/{id}` (suspend, change role).
- **Permissions:** `team.Invite`, `team.Manage`, `roles.Manage`; nobody may invite as Owner (existing rule).
- **Tests:** `docs/AUTH.md` §9 items 7–8; invitation tampering (email, role, org in the request ignored); sole-owner protection; permission matrix for each template; cross-tenant invitation acceptance refused.
- **Migration/rollback:** additive; flag `team.v1`.
- **Dependencies:** J2.
- **Definition of done:** an owner created by Sales accepts, invites a TA Head and a recruiter, each signs in with only their role's permissions, and a second tenant's users see none of it.

## J4 · Corporate onboarding data

- **Business outcome:** the company's structure and hiring settings live on the server and drive behaviour.
- **Prototype reference:** `company-script` (`cfProfile`, `cfNeedsAsk`, legal entities, regs, branches, departments), `corp-join` (`profile.joinPolicy`), `coBands`, setup checklist, `company-setup.spec` (14).
- **Backend:** legal entities (tax registrations deferred except storage), branches, departments (head user), salary bands per entity/currency, join policy (request/auto/invite; `auto` only on verified domains, D-4), setup checklist progress from records (item complete when its record exists), configuration store at organisation scope with versions.
- **Frontend:** setup checklist and pill, company card, units, departments, bands, join policy, all on the existing designs.
- **Data model:** `legal_entities`, `branches`, `departments`, `salary_bands`, `tenant_settings(key, value, version)`, `join_requests`.
- **API:** CRUD under `/org/legal-entities`, `/org/branches`, `/org/departments`, `/org/salary-bands`; `GET/PUT /settings/{key}`; `POST /join-requests`, `POST /join-requests/{id}/decide`.
- **Permissions:** `settings.Organization`, `org.structure.Manage`, `org.join.Decide`.
- **Tests:** profile detection (Simple shows no entity words, via API flags); join request routing; setup items complete from records; settings versioning.
- **Dependencies:** J3.
- **Definition of done:** the owner configures one entity, two departments, bands and the join policy; a colleague's join request is approved; the checklist reflects real records.

## J5 · Job draft (requisition) and approval

- **Business outcome:** HR opens jobs, with approval when the company's policy requires it.
- **Prototype reference:** jaydeep `corp-jobs-script` (job steps, presets, HM hiring requests, statuses); v2 `coReqValidate`, `coBandCheck`, `coReqChain` (→ preset), `coReqAfterDecision`, `coReqOpenJob`; APS engine + `test/aps.test.js`; `APPROVAL_CHAINS`; `approvals.spec`.
- **Backend:** Job entity (ADR-07) with draft → waiting_for_approval → open → on_hold → filled/closed; JobApproval sub-record; approval policies (Simple default, Guarded, Strict) evaluated by the ported APS engine; approver resolution by role and department scope; SLA reminders via scheduled jobs; HiringRequest (HM asks HR; HR accepts into a draft, asks a question, or declines).
- **Frontend:** Jobs list with "Waiting for approval" filter, job creation steps, approval panel and Approvals screen (lanes), HM "Ask HR for hiring support".
- **Data model:** `jobs`, `job_openings`, `job_approvals`, `approval_policies`, `approval_requests`, `hiring_requests`.
- **API:** `POST /jobs` (draft), `PATCH /jobs/{id}`, `POST /jobs/{id}/submit` → `{status, approval?}`, `GET /approvals?lane=`, `POST /approvals/{id}/decide {decision, reason}`, `POST /hiring-requests`, `POST /hiring-requests/{id}/accept|ask|decline`, `GET/PUT /approval-policies`.
- **Permissions:** `jobs.Create` (HR/TA), `hiring_requests.Create` (HM), decisions per policy (`APS.guardDecision` semantics: no self-approval, delegation).
- **Tests:** APS tests ported unchanged first; preset matrix; over-band routes to Finance; policy version frozen per job; HM cannot create jobs by default; events `job.approval_requested/decided`, `job.opened`.
- **Dependencies:** J4, D-2.
- **Definition of done:** an over-band job is drafted, routed (TA Head → Finance), approved within SLA rules and opens; a Simple-preset tenant opens jobs without approval.

## J6 · Internal allocation, candidates and internal submissions

- **Business outcome:** internal recruiters work open jobs with real candidates and consent.
- **Prototype reference:** job team fields, `isRecruiterMappedToJob`, `createSubmission`, intake dedupe, consent rules (`m07-consent`), `submission-flow`, `intake-flow`, `resumeReadText`/`resumeFields`.
- **Backend:** job team; candidates (tenant master, dedupe by email/mobile/LinkedIn); document storage (object storage, virus scan, signed URLs); consent records and links (48 h, 2 per 30 days); journeys (one per candidate per job, owner history, statuses); resume parsing server-side (port the reader rules).
- **Frontend:** job team picker, Talent pool add candidate, candidate profile (minimal), consent page, journey list on a job.
- **Data model:** `job_team`, `candidates`, `documents`, `consents`, `journeys`, `journey_events`.
- **API:** `PUT /jobs/{id}/team`, `POST /candidates`, `POST /documents` (upload URL), `POST /journeys {jobId, candidateId}`, `POST /consents/{token}` (public, link-scoped), `PATCH /journeys/{id}` (status with reason codes).
- **Permissions:** `candidates.View/Edit/Download Resume`, submit only on mapped jobs, salary fields by permission.
- **Tests:** duplicate journey blocked with owner/date/stage message; consent limits; link expiry; recruiter not on job cannot submit; resume access audited.
- **Dependencies:** J5; storage provider.
- **Definition of done:** a recruiter adds a candidate with resume, the candidate consents by link, and the journey appears on the job; a recruiter in another team cannot see it.

## J7 · Vendor tenant, relationship and job access

- **Business outcome:** the company invites a staffing agency, which keeps its own identity and tenant.
- **Prototype reference:** `coVendorInvite`, `coInviteIssue/Deliver/Resend/Revoke/Accept`, `coAccountCreate/Link`, `coVendorSaveDetails`, `coVendorAcceptTerms`, `coVendorLife`, `coAssign/Revoke/Extend`, approved default publish-to-all-active.
- **Backend:** vendor invitations; on acceptance, link to an existing vendor/agency tenant or provision a `vendor` tenant through J2's engine; vendor relationship with versioned agreement (fee %, terms acceptance); onboarding (details + terms) derived status; job vendor access (all active vendors by default, or selected; expiry; revoke); relationship suspension.
- **Frontend:** Vendors list and detail (company side); vendor portal shell, invitation page, two-step onboarding.
- **Data model:** `vendor_relationships`, `vendor_agreements`, `vendor_invitations`, `job_vendor_access`.
- **API (buyer):** `POST /vendors/invitations`, `POST /vendors/{relId}/suspend|restore`, `PUT /jobs/{id}/vendor-access`. **API (vendor):** `GET /vendor/invitations/{token}`, `POST /vendor/invitations/{token}/accept`, `GET /vendor/relationships`, `GET /vendor/jobs` (relationship-scoped), `POST /vendor/relationships/{id}/terms`.
- **Permissions:** buyer `vendors.Invite/Manage`, `jobs.ShareWithVendors`; vendor-tenant roles Vendor owner / Vendor recruiter.
- **Tests:** vendor sees only shared jobs of buyers it has active relationships with; two buyers, one vendor: no cross-visibility of buyer names beyond its own relationships; revoke immediate; RLS relationship policies.
- **Dependencies:** J2 (engine), J5 (jobs), D-3.
- **Definition of done:** one agency accepts invitations from two corporate tenants, sees each one's shared jobs separately, and neither corporate sees the other.

## J8 · Vendor submissions with consent and duplicates

- **Business outcome:** vendors submit candidates fairly, under the buyer's rules.
- **Prototype reference:** `coVendorCheck`, `coVendorSubmit`, `coVLinkCreate/Submit` (apply link), `coConsentGive`, `coIdentityMatch`/`coIdScore`/`coIdIndex`, `coSame`, `coDupMsg`, `coDupOverride/Dismiss/Allow`, `coVendorWithdrawWhy`, `coVendorResubmit`, `coMonths` (window).
- **Backend:** vendor submission in the buyer tenant; candidate consent via link; on consent, a journey with `source='vendor'`, ownership window from policy (D-5); exact duplicates blocked with the minimal message; probable matches flagged for buyer review; buyer decisions with reason and ownership history; withdraw/resubmit rules.
- **Frontend:** vendor portal Jobs → submit / apply link / All your profiles; buyer duplicate review queue and candidate drawer card.
- **Data model:** `vendor_submissions`, `identity_index`, `duplicate_decisions`.
- **API (vendor):** `POST /vendor/jobs/{jobId}/submissions`, `POST /vendor/submissions/{id}/withdraw {reason}`, `POST /vendor/submissions/{id}/resubmit {reason}`, `POST /vendor/apply-links`. **Public:** `POST /apply/{token}`. **Buyer:** `GET /duplicates`, `POST /duplicates/{id}/decide {keep|reassign|allow, reason}`.
- **Permissions:** vendor `vendor.submissions.Create/Withdraw`; buyer `submissions.DecideDuplicate`.
- **Tests:** port `corporate.spec` duplicate and consent cases; vendor never sees the other submitter's identity; window boundary dates in the buyer's time zone.
- **Dependencies:** J6, J7.
- **Definition of done:** a vendor submission becomes a consented journey; a second vendor's identical submission is blocked with only the date message; the buyer can reassign with a reason and history.

## J9 · Evaluation and interviews

- **Business outcome:** the hiring manager reviews in scope and interviews happen with scorecards.
- **Prototype reference:** `hm-*` screens, `coHmSend/Decide/ReadReply`, reject reason codes, `interviews-script`, `INTERVIEW_ROUND_TYPES`, `INTERVIEW_TRANSITIONS`, interviewer secure links (scores hidden until submitted), `interviews.spec`.
- **Backend:** HM review queue (department-scoped role assignment); shortlist / hold / reject with reasons; interviews (rounds, UTC instants, workspace time zone display), interviewer assignment (user or link), scorecards, ICS invites by email.
- **Frontend:** HM Recommended/Reviews screens, journey drawer actions, interview scheduling, scorecard page.
- **Data model:** `interviews`, `interview_participants`, `scorecards`, `scorecard_templates`.
- **API:** `GET /reviews` (HM scope), `POST /journeys/{id}/review {decision, reasonCode, note}`, `POST /interviews`, `PATCH /interviews/{id}`, `POST /scorecards/{token}` (link) or `/interviews/{id}/scorecards`.
- **Permissions:** HM only within department; interviewer only own assignments; vendor sees interview existence for own candidates (`coVendorInterviews`) but not scores.
- **Tests:** HM of department A cannot review department B (fixes C7); scores hidden until own submission; time-zone suite cases; vendor view.
- **Dependencies:** J6, J8.
- **Definition of done:** an HM shortlists a vendor candidate and an internal candidate; two rounds are scheduled and scored; vendor sees "Interview" only.

## J10 · Hiring decision and offer

- **Business outcome:** the company decides and makes an offer under its authority, and everyone sees the right outcome.
- **Prototype reference:** M1 offer record, `OFFER_TRANSITIONS`, offer exception approvals (`APPROVAL_CHAINS` ac2), `coE6`.
- **Backend:** hiring decision on the journey (hire / reject with reason); offer (one per journey) with band check and exception approval; offer accepted/declined; joining date; events for status fan-out; job openings decrement and job filled.
- **Frontend:** decision and offer drawers; vendor portal status.
- **Data model:** `offers`, `journey_decisions`.
- **API:** `POST /journeys/{id}/decision`, `POST /journeys/{id}/offer`, `PATCH /offers/{id}` (accept, decline, withdraw).
- **Permissions:** decision by HM/TA per policy; offer exception approval per policy.
- **Tests:** offer only on shortlisted/interviewed journeys; over-band offer requires approval; filled job closes openings; vendor sees "Offer"/"Joined" only.
- **Dependencies:** J9.
- **Definition of done:** the Phase 2 journey (doc 22 §7) passes on staging with real email.

---

## Reuse summary

| Existing asset | Used in |
|---|---|
| `docs/AUTH.md` contract, schema sketch, server rules, test plan | J1–J3 |
| `oontu-approval-sla-engine.js` + `test/aps.test.js` | J5, J10 |
| `PERMISSION_MODULES`, `CUSTOM_ROLES`, `ROLE_TEMPLATES` | J3 |
| `company-script` rules | J4 |
| `corp-jobs-script` (jaydeep) | J5 |
| `corp-script` vendor, consent, identity and duplicate rules | J7–J8 |
| `interviews-script` rules | J9 |
| Design 2.0 CSS, motion, brand assets | all client work |
| 52 prototype specs | acceptance source per milestone |
