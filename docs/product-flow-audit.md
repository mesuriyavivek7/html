# Oontu product flow audit

Source of truth: `Oontu-Flow-Map.pdf` (v5, 84 pages). Implementation audited: `recruitment-os-prototype.html` on branch `design-system-migration`.
Audit date: 2026-10-28. Statuses: **Implemented** (behaviour exists and is covered by a spec), **Partial** (some of the node exists), **Missing**, **Conflict** (the code does something the map does not want, or the reverse, by an earlier decision).

## 1. What the product is today

- **One file.** A single-page prototype: vanilla JavaScript, Tailwind from a CDN, about 46,000 lines. There is no server; "backend" rules (permissions, approvals, intake, duplicate checks, engines) run in the page against in-memory seed data. Persistence is limited to a few `localStorage` keys (approvals state, sidebar, preferences).
- **Roles** (role switcher): Recruiter, Recruiter Manager, Owner (`admin`), Hiring Manager (`hm`), Candidate, Oontu Super Admin (`oontu`). Workspace type is `ORG_STRUCTURE.profile.orgType` (Staffing agency or Corporate); most screens switch on it.
- **Permission engine (E1):** `sCan(module, action)` over role permission matrices, data scopes, approval powers, `CUSTOM_ROLES`, `NAV_PERMISSIONS`. UI checks and the write functions both call it.
- **Approval engine (E2):** `oontu-approval-sla-engine.js` (`window.APS`), business-hours SLAs, reminders, escalation, delegation, owner fallback; Approvals screen.
- **Intake (E3):** `ingestApplicationEvent` (source, external IDs, dedupe by email, phone and content, review queue, ownership by time).
- **Submissions:** `submitOneToJob` is the one canonical write (scope, job state, open-journey integrity, closed-journey ownership, review routing).
- **Interviews (E4):** interviews module + secure `#/l/<token>` links for interviewers and client contacts.
- **Cowork / Kairo agents (K):** five agents, workflows, a send engine with safety rules, and campaigns that run to joining day (pre-joining check-ins, risk, backups).
- **Clients (A2), PayTrack, Settings, Sign-in and sign-up (OA module), Oontu Super Admin console.**
- **Tests:** 14 headless-browser specs in `tests/` (about 470 checks) + 32 engine checks in `test/`. All green at the start of this audit.

## 2. Flow-map inventory (every section, every node)

| ID | Flow-map node | Status | Evidence / gap |
|---|---|---|---|
| 00 | Mobile number on the first screen, with name and email | Implemented | OA sign-up form; auth spec 02, 02L |
| 00 | Google / Microsoft sign-up then ask mobile | Implemented | auth spec 21 |
| 00 | Email unverified: look around, invite/publish/send locked | Implemented | `emailVerifyLocked()`, auth 02v, 05y |
| 00 | Corporate needs a work email (free domains blocked) | Implemented | `isFreeEmailDomain`, auth 03e |
| 00 | Domain already has a workspace → request to join, owner approves | **Conflict** | Removed on 2026-10-26 at the user's request; auth 03g shows "ask the owner to invite you". See approval AR-1 |
| 00 | New corporate workspace marked Unverified company; no job-site listing or marketplace reveals until verified | Partial | Badge and tip exist (`ORG_VERIFY_TIP`, auth 03h); the jobs website and marketplace that it gates do not exist (E7, C6) |
| 00 | Super Admin creates the tenant → owner invite → owner sets a password | Implemented | auth 06k |
| 00 | Every step saved immediately; half-finished sign-up never lost | **Conflict** | Lead save/resume removed on 2026-10-26 at the user's request (AR-1). The follow-up list still exists for sign-ups that created a workspace but did not finish setup |
| 01 | Incomplete sign-ups list (step, time stuck, email, mobile, type, filter) | Implemented | `renderOontuSignups`, auth 06l |
| 01 | Kairo reminder with a resume link, then a call, call outcome logged | Implemented | auth 06l |
| 01 | Assisted setup with the customer's permission, audit-logged | **Conflict** | Removed on 2026-10-26 (AR-1) |
| 01 | Drop-off reasons as a report | Partial | Reasons are stored; no report screen |
| A1 | Agency profile, default roles, default policies (reporting-line approvals, round-robin, 90-day duplicate window, SLA) | Implemented | Setup checklist (auth 06i), Settings policies |
| A1 | Marketplace listing opt-in | Partial | Setting only (`marketplaceListed`); no marketplace exists (C6) |
| A1 | Allow jobs on the Oontu jobs website | Partial | Setting only; no public jobs website (E7) |
| A2 | Add client, contacts with email + WhatsApp, commercial terms | Implemented | clients spec (31 checks) |
| A2 | Duplicate check by name, domain, tax ID → show owner → request access | Implemented | clients spec "a duplicate shows the amber panel and blocks the save" |
| A2 | Client goes live after approval routing (E2) | Partial | Client approvals exist for tax lines and below-standard fees; creating a client is not routed through E2 |
| A2 | Kairo enriches company info, drafts the career-page widget | Partial | Company lookup exists; widget snippet not drafted |
| A3 | Start blank / upload or paste JD (Kairo prefills) / clone a past job | Implemented | Three start cards: JD, "Copy a past job", blank (`jobCreateStep1HTML`) |
| A3 | Client's saved hiring process → load; build stages; save as client template | Implemented | job create step 4, `jcStageListReadHTML` |
| A3 | Submission rules on the job (pre-approval, max profiles, mandatory fields, mask contacts) | Implemented | job create step 5 |
| A3 | Distribution rule and approval routing → Job Open | Implemented | intake spec A1–A2c |
| A4 | Job Lead + recruiters; workload shown; manager adds from own tree | Partial | Team panel exists; workload and Kairo suggestions not checked by a spec |
| A4 | Member removed → unreviewed applicants redistributed; submitted keep owner | Implemented (this pass) | `removeRecruiterFromJob` wrapper; flow-rules spec A4 |
| A5 | Channels: careers page, client widget, boards, social with UTM, recruiter personal link | Implemented | share links with `utm_content`, platform intake |
| A5 | Recruiter's personal link always wins over round-robin | Implemented | stated rule in job create and Settings |
| A5 | Auto-acknowledgement on WhatsApp or email | Implemented | Engagement agent template |
| A5 | Not opened within SLA → reassign to the next recruiter, notify the manager | Implemented (this pass) | `fmSlaSweep`; flow-rules spec A5 |
| A6 | Talent pool search, Kairo matches, manual add / bulk CV, dedupe | Implemented | intake, talent pool, submission specs |
| A6 | Capture CTC, notice, availability; right-to-represent consent before submission | Implemented | send-to-client consent; campaign pre-screen |
| A6 | Rejections always carry a reason code | Implemented (this pass) | reason dialog + `rejectReason`; flow-rules spec A6 |
| A6 | Kairo follows up twice then "Not reachable" | Partial | Engagement workflows follow up; no "Not reachable" status |
| A7 | Same job, same candidate: show owner, date, stage; manager-override request | Partial | Owner, date and stage shown (this pass); override waits for AR-5 |
| A7 | Same client, other job, inside the duplicate window: warn, note required | Implemented (this pass) | `fmClientWindowHit` in `submitOneToJob`; flow-rules spec A7 |
| A7 | Ownership lock, saved to pool, pre-submission approval, client-ready profile, send by email/WhatsApp/review link, SLA follow-up | Implemented | submission spec, interviews secure links, `pipeChase` |
| A8 | Feedback by review link / by hand | Implemented | client secure link, pipeline |
| A8 | Kairo reads an email/WhatsApp reply and proposes a status; recruiter confirms | Implemented (this pass) | client-reply card in the submission drawer; flow-rules spec A8 |
| A8 | On hold → Kairo checks back in 7 days | Implemented (this pass) | `holdCheckAt` in `fmSlaSweep` |
| A9 | Record offer, internal approval, client extends, response, counter, declined → backups | Implemented | offer flows, campaigns journey |
| A9 | Placement lowers the job's open count; job Filled when all openings are filled | Implemented (this pass) | `fmAfterJoin`; job page shows "1 of 2 open"; flow-rules spec A9 |
| A9 | Replacement window from joining; invoice in PayTrack | Implemented | PayTrack, clients terms |
| A9 | Contract hire → agency is employer of record (E8) | **Missing** | E8 does not exist (AR-2) |
| C1 | Corporate setup: SME quick path vs entities, org, bands; people by invite, CSV, SSO+SCIM | Partial | Setup checklist and Settings (auth 06m, settings spec); CSV/SSO are settings stubs |
| C2 | Basic employee access; role rules (direct reports → HM, TA department → recruiter, panel → interviewer) | Partial | Role rules in Settings (settings spec "corporate workspace: role rules"); not applied to people automatically |
| C3 | **Requisition** (Kairo draft, form, replacement), hire type, band, headcount plan, approval matrix (Finance if unbudgeted), budget reserved, job opens | **Missing** | Only permissions and approval-matrix rows exist (AR-2) |
| C4 | Internal-first window, channels, referrals, **pick vendors per job** | **Missing** | Setting only (AR-2) |
| C5 | **Add vendors** (email + basic info), approval, pause/remove stops links | **Missing** | AR-2 |
| C6 | **Marketplace** browse, reveal on terms, agency notified | **Missing** | AR-2 |
| C7 | **Vendor submissions** (authorised link + one-time code, email to HR, caps, rate card, candidate consent in 48 h, dedupe, vendor status view, scorecard) | **Missing** | AR-2 |
| C8 | TA screening, band flag, HM review by link / email reply, Kairo reminders, debrief | Partial | HM screens exist (`hm-*`); HM review link and email-reply decisions not built |
| C9 | Offer band check + matrix, letter + e-sign, joining, vendor fee / referral bonus clock | Partial | Band check via APS matrix; e-sign, vendor fee and referral bonus clocks missing |
| C10 | **Contract and contingent hiring** (rate cards, SOW, work orders) | **Missing** | AR-2 |
| C11 | Consent, purpose limit, retention, rights, region, explainable scores, audit | Partial | Consent, explainable reasons and audit exist; erasure and retention jobs missing |
| E1 | Roles: matrix × scope, reports-to without loops, deactivation forces hand-over | Implemented | settings spec, auth 27 |
| E2 | Approval engine | Implemented | approvals spec + 32 engine checks |
| E3 | Intake engine | Implemented | intake spec (31 checks) |
| E4 | Interview loop (slots, confirm, reminders, no-show, feedback, hold) | Implemented | interviews spec; hold check-back added in this pass |
| E5 | Pre-joining tracker (check-ins, risk alerts, backed out → backups) | Partial | Implemented inside Cowork campaigns; not yet for submissions outside a campaign |
| E6 | One status per candidate per job (Applied … Joined, Withdrawn) | Partial | Stages exist with different names (`Pending Review`, `Ready to Send` …); no single E6 list (AR-4) |
| E7 | **Oontu jobs website** | **Missing** | AR-2 |
| E8 | **Contract assignment engine** (timesheets, invoices from approved time, extensions, conversion) | **Missing** | AR-2 |
| K | Kairo layer: three autonomy levels per step, borrows the user's permissions, never approves or sends to a client on its own | Implemented | cowork spec, agent step levels |
| I | Integrations | Partial | Integration list and simulators; no live connectors (prototype) |

## 3. Main risks and unknowns

1. **The corporate journey is mostly Settings without the workflows behind them** (C3–C7, C10, E7, E8). A corporate customer can configure vendors and requisition approvals but cannot raise a requisition or receive a vendor CV. This is the largest gap and is a build, not a fix (AR-2).
2. **Agency rules that exist only as settings** (SLA reassignment, duplicate window, override). Users see the setting and expect it to work. Fixed in this pass (Steps 3, 5, 7).
3. **No server.** Every "backend" check is client-side by design of the prototype. The rules are written as single functions so they can move to a server unchanged; production must re-check them server-side.
4. **Earlier deliberate removals conflict with v5** (AR-1).
5. **The Hiring Manager persona logs in for an agency client** (`hm` role titled "RetailX · Hiring"), while the map says agency clients never log in (AR-3).
