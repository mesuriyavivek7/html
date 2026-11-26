# 01 · Complete product, screen, role and workflow audit

## 1. Existing code evidence

**Screen registry.** `RENDERERS` (line ~ after 59,000 region; keys listed below) plus routes handled outside it: `#/vendor…`, `#/apply/<token>`, `#/l/<token>` secure links, `#/invite/<token>`, `#/sign-up`, `#/auth/*`, and the `oontu-*` views.

Renderer keys found: `dashboard, admin-dashboard, manager-dashboard, hm-dashboard, candidate-home, jobs, talent-pool, candidate-search, advanced-search, interviews, client-management, approval-center, my-todo, manager-todo, all-tasks, manager-team, manager-recruiter-detail, intelligence, kairo-team (Cowork), li-lists-hub, li-uni-box, linkit-wizard, workflow-builder, paytrack, payroll-billing, admin-revenue, admin-recruiters, recruiter-analytics, reports, weekly, monthly, yearly, audit-center, user-management, roles-permissions, org-structure, master-data, security-settings, scheduled-jobs, feature-flags, settings, setup-hub, hm-jobs, hm-job-create, hm-interviews, hm-feedback, hm-decisions, candidate-opportunities, candidate-interviews, candidate-profile-self` (plus design-system preview keys). Corporate views come from `corp-script`: `renderRequisitions`, `renderRequisitionNew`, `renderRequisitionDetail`, `renderVendors`, `renderVendorDetail`, `renderMarketplace`, `renderContractHiring`, and the vendor portal pages (`coVJobsPage`, `coVJobPage`, `coVIvPage`, `coVOnboardPage`).

**Navigation per persona.** `NAV_LAYOUT` (line ~59,414) has six keys: `recruiter`, `manager`, `admin`, `hm`, `candidate`, `oontu`. `AGENCY_NAV_LAYOUT` and `filterNavForOrgType` (line ~4,389) hide corporate-only items in agency workspaces and the reverse. `NAV_PERMISSIONS`, `NAV_ITEM_ACCESS` and `NAV_PLAN_GATES` gate items.

**Roles.** `CUSTOM_ROLES` (line ~24,753, `role_founder` = Owner, protected), `PERMISSION_MODULES` (line ~24,725), `ROLE_TEMPLATES` (line ~42,073: Admin, Account manager, Accounts, and others), `canI(module, action)` (line ~24,793), `sCan` for Settings, `hasOrgWideAuthority()` = `role_founder`.

## 2. Current implementation by surface

| Surface | Main screens | Primary workflows | Status |
|---|---|---|---|
| Agency workspace | Home (B v2 `bhHome`), Jobs, Talent pool, Interviews, Clients, Approvals, To do, Cowork, LinkIt, Intelligence, PayTrack, Revenue, Reports, Team members, Settings | Client → job → source → submit (review, consent) → client feedback → interview → offer → join → invoice/commission | VERIFIED (prototype) across `submission-flow`, `intake-flow`, `clients`, `m01`–`m11`, `interviews`, `approvals` specs |
| Corporate workspace | Home, Jobs, Talent pool, Interviews, Requisitions, Vendors, Marketplace, Contract hiring, Approvals, Intelligence, Settings | Requisition → approval → job → vendors → submissions → HM review → interview → offer → join | VERIFIED (prototype) in `corporate.spec.js`; the approved one-Job model is MISSING on this branch (03) |
| Vendor portal | Jobs (Shared with you, All your profiles, Ask for a job), Interviews, onboarding (details, terms) | Invite → accept → onboard → submit → track → withdraw/resubmit | VERIFIED (prototype), `corporate.spec.js` |
| Secure links | Client review, HM decision, interviewer scorecard, candidate consent, contractor time, vendor apply link | Outsiders act without accounts | VERIFIED (prototype), `interviews.spec.js`, `flow-rules.spec.js` |
| Candidate portal | Home, Opportunities, Interviews, Profile | Apply, confirm, update profile | PARTIALLY IMPLEMENTED (seen in `screens-crawl.spec.js`) |
| Super Admin | Dashboard, Tenants, Sign-ups, Account help, Subscriptions, Plans, Agents, Feature controls, Platform users, Notifications, Audit, Settings | Create tenant + owner invite, lifecycle changes, plan/feature admin, join escalations, assisted setup | VERIFIED (prototype) for tenant create (auth 06k), sign-ups (06l), assisted setup (`signup-recovery`) |

## 3. Role inventory against the brief

| Brief role | Prototype representation | Gap |
|---|---|---|
| Agency owner / admin | `admin` persona, `role_founder`, template `admin` | — |
| Recruitment manager | `manager` persona, `role_recmgr` | — |
| Recruiter, sourcer | `recruiter` persona; sourcer via role templates | Sourcer is a permission set, not a persona (fine) |
| BD / account manager | template `account` | No BD pipeline before a client exists (prospects are candidates, not companies) |
| Finance / operations | template `accounts` | — |
| Corporate HR admin, TA Head | Owner/Admin roles in a Corporate workspace | Approval chain hard-codes TA Head = `role_founder` (`coReqChain`) |
| Internal recruiter | `recruiter` | — |
| Hiring manager | `hm` persona | In the prototype `hm` acts with org-wide authority (memory note; `corporate.spec.js` uses `recruiter` as the unauthorised actor) |
| Interviewer | Secure-link scorecard, no persona | Fine for external interviewers; internal interviewers need an in-app queue |
| Approver, finance stakeholder | `role_approver` used by `coReqChain` | Not a configurable approval structure |
| Department leader, business leader | Departments in Company setup (`company-script`) | No department-scoped role or reporting view |
| External vendor | `CO.accounts` + `CO.vendors`, own portal | See 04 |
| Oontu internal roles (Sales, Support, CS…) | One platform role: `role_oontu_super_admin` (`PLATFORM_ROLES`, line ~35,217) | All internal bundles MISSING (08) |

## 4. Cross-cutting findings

1. **Persona-driven identity in places.** `currentActingUser()` (line ~25,157) returns Priya Sharma for every role except `manager` (Arjun Kapoor). `ROLE_META` holds one name per persona. Many actions are attributed by persona rather than by a real user id. `logAudit` was fixed to resolve the actor (comment at line ~24,461), but "who acts" is still persona-based.
2. **Nav is keyed by persona, permissions by role.** Navigation (`NAV_LAYOUT[role]`) and permission checks (`canI`) are two mechanisms. A custom role cannot get a custom navigation without a persona.
3. **Workspace type is used both as a product mode and as a permission shortcut** (`coCorp()`, `filterNavForOrgType`, `cjOn()` on jaydeep). The brief asks for capability-plus-policy, not type-only gating (06).
4. **Strong derived-state discipline.** Statuses are derived rather than stored where possible (`coE6`, `coOnboarding`, `coInviteState`, `coVendorLife`). Preserve it.
5. **Consistent empty, error and audit patterns.** Most actions return `{ ok, reason }` and write `logAudit`. Preserve it as the server contract style.

## 5. Experience and design audit (brief §18)

The design language (Oontu Design 2.0: `design-style.md`, B v2 Homes `bhHome`, motion tokens in `<style id="oontu-motion">`, brand assets in `assets/brand/`) is consistent and tested (`design-system`, `fidelity-b-v2`, `light`, `motion` specs). **No redesign is recommended.** Changes are proposed only where there is a usability problem:

| Area | Finding | Proposal |
|---|---|---|
| Corporate login and registration | Clear and short (email, code, then name, type, organisation, size, place). The domain-taken path explains who to ask | Keep. Add the provisional-claim message (02 §5A) and a workspace switcher (02) |
| Corporate onboarding | Progressive, hides entity words for simple companies (`cfProfile`) | Keep. Add approval preset and HR partners only for Multi-company profiles (03) |
| Corporate workspace | Two job concepts on this branch (Requisitions screen + Jobs) | One Jobs list with a "Waiting for approval" filter (approved one-Job model) |
| Agency workspace | Complete; dense Money and Insights groups | Keep |
| Vendor portal | Deliberately two modules (Jobs, Interviews); duplicate messages minimal and fair | Keep. Add compliance documents into the two-step onboarding (04) |
| Role navigation | Keyed by persona, not by permissions | Derive from permissions + capabilities (§6) |
| Workflow continuity | Attention items link to records; several parallel queues | One WorkItem model behind the same layouts (15) |
| Empty, error and loading states | Present on auth (expired, retry), Intelligence (honest denied/unsupported states), approvals | Keep the `{ ok, reason }` pattern as the API error contract |
| Accessibility | Labels, focus handling, `aria-pressed` tabs, reduced-motion rules present | Run an audit against WCAG 2.2 AA on the rebuilt client |
| Responsive | 390 px checks exist; one known failure (`cowork-visual`) | Fix with the client rebuild |
| Motion | Token-based (80/120/200/320/480 ms), screen-change gate (`apple-motion-script`) | Keep |
| Execution feedback | Kairo working card with steps; Setup pill; toasts with Undo (`sSet`) | Keep; long server operations (provisioning, imports) use the same working-card pattern with real status |

## 6. Limitations

- About 45 renderers plus corporate and portal pages share one global state, with no route-level authorisation, so a screen's visibility is the only guard.
- Several screens have been checked only by specs, never by eye (`OONTU_AGENCY_READY_REPORT.md` §6).

## 7. Proposed solution

- Keep every screen. Introduce a **route manifest** (screen id → required capability + permission + plan entitlement) that the server also uses to authorise the data calls behind it. Today's `NAV_PERMISSIONS` / `NAV_ITEM_ACCESS` / `NAV_PLAN_GATES` are the seed of that manifest.
- Decouple navigation from persona: derive the sidebar from the user's effective permissions plus the workspace capability set, keeping `NAV_LAYOUT` as the default order per role template.
- Replace persona-based `currentActingUser()` with the session user once identity is server-side (07, 16).

## 8. Data impact

None to records. The route manifest is a new configuration artefact derived from existing constants.

## 9. Permissions

Every renderer gets an explicit capability key. Server endpoints check the same key.

## 10. Dependencies

07 (authorisation service), 12 (configuration), 14 (domain model).

## 11. Acceptance criteria

- Every screen id has exactly one manifest entry.
- A custom role with only `jobs.View` sees Jobs and nothing else, without a code change.
- Every acting identity in audit entries is a user id, never a persona name.

## 12. Tests

- New spec: each manifest entry is denied for a role lacking its permission (screens-crawl already visits every screen; extend it to assert the deny path).
- Server: an API test per manifest capability for allow and deny.

## 13. Migration risks

- Specs that rely on persona names (Priya, Arjun) break when identity becomes real. Mitigation: keep the demo seed users with the same names and ids.
