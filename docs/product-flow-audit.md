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
| 00 | Domain already has a workspace → request to join, owner approves | Implemented (pass 2, AR-1) | Removed on 2026-10-26 at the user's request; auth 03g shows "ask the owner to invite you". See approval AR-1 |
| 00 | New corporate workspace marked Unverified company; no job-site listing or marketplace reveals until verified | Partial | Badge and tip exist (`ORG_VERIFY_TIP`, auth 03h); the jobs website and marketplace that it gates do not exist (E7, C6) |
| 00 | Super Admin creates the tenant → owner invite → owner sets a password | Implemented | auth 06k |
| 00 | Every step saved immediately; half-finished sign-up never lost | Implemented (pass 2, AR-1) | Lead save/resume removed on 2026-10-26 at the user's request (AR-1). The follow-up list still exists for sign-ups that created a workspace but did not finish setup |
| 01 | Incomplete sign-ups list (step, time stuck, email, mobile, type, filter) | Implemented | `renderOontuSignups`, auth 06l |
| 01 | Kairo reminder with a resume link, then a call, call outcome logged | Implemented | auth 06l |
| 01 | Assisted setup with the customer's permission, audit-logged | Implemented (pass 2, AR-1) | Removed on 2026-10-26 (AR-1) |
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
| A5 | Channels: careers page, client widget, boards, social with UTM, recruiter personal link | Implemented (the personal link now routes the applicant since M2, section 6) | share links with `utm_content`, platform intake |
| A5 | Recruiter's personal link always wins over round-robin | Implemented | stated rule in job create and Settings |
| A5 | Auto-acknowledgement on WhatsApp or email | Implemented | Engagement agent template |
| A5 | Not opened within SLA → reassign to the next recruiter, notify the manager | Implemented (this pass) | `fmSlaSweep`; flow-rules spec A5 |
| A6 | Talent pool search, Kairo matches, manual add / bulk CV, dedupe | Implemented | intake, talent pool, submission specs |
| A6 | Capture CTC, notice, availability; right-to-represent consent before submission | Implemented | send-to-client consent; campaign pre-screen |
| A6 | Rejections always carry a reason code | Implemented (this pass) | reason dialog + `rejectReason`; flow-rules spec A6 |
| A6 | Kairo follows up twice then "Not reachable" | Implemented (pass 2) | Engagement workflows follow up; no "Not reachable" status |
| A7 | Same job, same candidate: show owner, date, stage; manager-override request | Implemented (pass 2, AR-5) | Owner, date and stage shown (this pass); override waits for AR-5 |
| A7 | Same client, other job, inside the duplicate window: warn, note required | Implemented (this pass) | `fmClientWindowHit` in `submitOneToJob`; flow-rules spec A7 |
| A7 | Ownership lock, saved to pool, pre-submission approval (per job since M3, section 7), client-ready profile, send by email/WhatsApp/review link, SLA follow-up | Implemented | submission spec, interviews secure links, `pipeChase` |
| A8 | Feedback by review link / by hand | Implemented | client secure link, pipeline |
| A8 | Kairo reads an email/WhatsApp reply and proposes a status; recruiter confirms | Implemented (this pass) | client-reply card in the submission drawer; flow-rules spec A8 |
| A8 | On hold → Kairo checks back in 7 days | Implemented (this pass) | `holdCheckAt` in `fmSlaSweep` |
| A9 | Record offer, internal approval, client extends, response, counter, declined → backups | Implemented (one offer record since M1, see section 5) | `tests/m01-offer.spec.js`, campaigns journey |
| A9 | Placement lowers the job's open count; job Filled when all openings are filled | Implemented (this pass) | `fmAfterJoin`; job page shows "1 of 2 open"; flow-rules spec A9 |
| A9 | Replacement window from joining; invoice in PayTrack | Implemented | PayTrack, clients terms |
| A9 | Contract hire → agency is employer of record (E8) | Implemented (pass 2) | E8 does not exist (AR-2) |
| C1 | Corporate setup: SME quick path vs entities, org, bands; people by invite, CSV, SSO+SCIM | Partial | Setup checklist and Settings (auth 06m, settings spec); CSV/SSO are settings stubs |
| C2 | Basic employee access; role rules (direct reports → HM, TA department → recruiter, panel → interviewer) | Partial | Role rules in Settings (settings spec "corporate workspace: role rules"); not applied to people automatically |
| C3 | **Requisition** (Kairo draft, form, replacement), hire type, band, headcount plan, approval matrix (Finance if unbudgeted), budget reserved, job opens | Implemented (pass 2) | Only permissions and approval-matrix rows exist (AR-2) |
| C4 | Internal-first window, channels, referrals, **pick vendors per job** | Implemented (pass 2) | Setting only (AR-2) |
| C5 | **Add vendors** (email + basic info), approval, pause/remove stops links | Implemented (pass 2) | AR-2 |
| C6 | **Marketplace** browse, reveal on terms, agency notified | Implemented (pass 2) | AR-2 |
| C7 | **Vendor submissions** (authorised link + one-time code, email to HR, caps, rate card, candidate consent in 48 h, dedupe, vendor status view, scorecard) | Implemented (pass 2) | AR-2 |
| C8 | TA screening, band flag, HM review by link / email reply, Kairo reminders, debrief | Implemented (pass 2) | HM screens exist (`hm-*`); HM review link and email-reply decisions not built |
| C9 | Offer band check + matrix, letter + e-sign, joining, vendor fee / referral bonus clock | Partial: band check and vendor fee clock built; e-sign and referral bonus clock not | Band check via APS matrix; e-sign, vendor fee and referral bonus clocks missing |
| C10 | **Contract and contingent hiring** (rate cards, SOW, work orders) | Implemented (pass 2) | AR-2 |
| C11 | Consent, purpose limit, retention, rights, region, explainable scores, audit | Partial | Consent, explainable reasons and audit exist; erasure and retention jobs missing |
| E1 | Roles: matrix × scope, reports-to without loops, deactivation forces hand-over | Implemented | settings spec, auth 27 |
| E2 | Approval engine | Implemented (one routing rule since M4a, section 8) | approvals spec + 32 engine checks |
| E3 | Intake engine | Implemented | intake spec (31 checks) |
| E4 | Interview loop (slots, confirm, reminders, no-show, feedback, hold) | Implemented | interviews spec; hold check-back added in this pass |
| E5 | Pre-joining tracker (check-ins, risk alerts, backed out → backups) | Implemented (pass 2) | Implemented inside Cowork campaigns; not yet for submissions outside a campaign |
| E6 | One status per candidate per job (Applied … Joined, Withdrawn) | Implemented as a derived list (pass 2, AR-4) | Stages exist with different names (`Pending Review`, `Ready to Send` …); no single E6 list (AR-4) |
| E7 | **Oontu jobs website** | Implemented (pass 2) | AR-2 |
| E8 | **Contract assignment engine** (timesheets, invoices from approved time, extensions, conversion) | Implemented (pass 2) | AR-2 |
| K | Kairo layer: three autonomy levels per step, borrows the user's permissions, never approves or sends to a client on its own | Implemented | cowork spec, agent step levels |
| I | Integrations | Partial | Integration list and simulators; no live connectors (prototype) |

## 3. Main risks and unknowns

1. **The corporate journey is mostly Settings without the workflows behind them** (C3–C7, C10, E7, E8). A corporate customer can configure vendors and requisition approvals but cannot raise a requisition or receive a vendor CV. This is the largest gap and is a build, not a fix (AR-2).
2. **Agency rules that exist only as settings** (SLA reassignment, duplicate window, override). Users see the setting and expect it to work. Fixed in this pass (Steps 3, 5, 7).
3. **No server.** Every "backend" check is client-side by design of the prototype. The rules are written as single functions so they can move to a server unchanged; production must re-check them server-side.
4. **Earlier deliberate removals conflict with v5** (AR-1).
5. **The Hiring Manager persona logs in for an agency client** (`hm` role titled "RetailX · Hiring"), while the map says agency clients never log in (AR-3).

## 4. Pass 2 update (2026-10-28)

Approved by the owner of this work: AR-1 (yes, with a live-domain rule and Oontu resolution), AR-2 (yes, in the order given, with a vendor sign-in), AR-3 (Hiring Manager login for company workspaces, agency clients use the review link), AR-4 (a derived status list, because vendors and hiring managers need plain words), AR-5 (override with reason and timeline, **not** through the Approvals engine).

| Node | What now exists | Evidence |
|---|---|---|
| 00 / 01 | Every answered question saved as a sign-up lead; resume link; request to join (owner rule: request, straight away, or invite only); who-to-ask panel; Ask Oontu; Account help console with approve, decline, contact owner, move ownership, free the domain, allow a separate workspace; assisted set-up only with the customer's permission, 24 hours, logged on both sides | `tests/signup-recovery.spec.js` (11) |
| C3 | Requisitions: one-sentence draft, approval chain (TA Head, Finance when unbudgeted or above band), Owner skips TA step, budget reserved, job opens internal first | `tests/corporate.spec.js` |
| C4 / C5 | Vendors: add, approval, pause or remove stops links and sign-in; share a job per vendor with cap, expiry, extension; internal-first release needs a reason | corporate spec |
| C6 | Marketplace ranked by area of work, contacts hidden until terms are accepted, reveal allowance, agency notified, unverified companies cannot reveal | corporate spec |
| C7 | Vendor sign-in (email and one-time code, lock after five wrong codes), portal, submission rules (details, cap, duplicate, one claim per candidate, one open role per vendor, current employee, 48 hour candidate consent), HR emailed | corporate spec |
| C8 / C9 | Hiring Manager review link (interview, hold, not a fit with reason), daily reminders, emailed-reply reader; vendor fee clock and voiding; offer band check | corporate spec |
| C10 / E8 | Work orders, rate cards, timesheets, invoices built only from approved time, extensions, conversion with fee rule, end notices | corporate spec |
| E7 | Jobs website `#/jobs`, gated by the Settings switch, verification, and a per-job opt-out; applications go through intake | corporate spec |
| E5 | Pre-joining tracker for every accepted offer outside a campaign | `tests/flow-rules.spec.js` |
| A6 | Not reachable after two unanswered follow-ups in 48 hours | flow-rules spec |
| A7 | Same-job override: reason, timeline, returns if nothing moves | flow-rules spec |

Still not built: the Employee portal (internal jobs and referrals), e-sign for offer letters, the referral bonus clock, live mailbox and WhatsApp reading, one-tap approvals on WhatsApp, LinkedIn multi-account sourcing (declined, see `approval-required-changes.md`).

## 5. M1 update (2026-10-31) · one offer record

| ID | Finding | Status | Evidence |
|---|---|---|---|
| B6 | Offers were kept in three places (`sb.offer`, `OFFERED_CANDIDATES`, campaign `p.offer`); a recruiter's "Joined" moved the journey but PayTrack refused the placement ("No accepted offer on file"); placements matched by name and took the job's recruiter; two joining dates; the offer approval rule ignored Settings → Approvals | **Fixed** | `tests/m01-offer.spec.js` (9 tests); see `implementation-progress.md`, 2026-10-31 |

What changed, in short: `sb.offer` is the only offer record and `recordOffer()` the only way to make or revise one. `offerException()` is the one approval rule (Settings → Approvals → Offer, with the C7 condition). A joining creates its placement first, by journey id, and moves the journey to Joined once. `OFFERED_CANDIDATES` is now a read-only list built from the journeys.

Still open after M1: approval routing is the requester's manager, else the Owner (M4 replaces it); the old "Offer Pending Approval" stage is still listed in filters and labels but nothing sets it (M5); contract and temporary hires still become a PayTrack placement, with no contract assignment (M9).

## 6. M2 update (2026-10-31) · applicants get an owner

| ID | Finding | Status | Evidence |
|---|---|---|---|
| B1 | New applicants were created at 'Submitted' with no owner; the personal link (`utm_content`) was never read; the job's routing and job lead were saved but unused; the SLA sweep skipped unowned applicants and did nothing on a one-recruiter job; applicants counted as submitted | **Fixed** | `tests/m02-applicant-owner.spec.js` (15 tests); see `implementation-progress.md`, 2026-10-31 · M2 |

New applicants start at 'Applied Directly' (shown as "Applied") with an owner chosen by `applicantOwnerFor()`: personal link, then the job's routing, then the job lead, then the Owner. Still open after M2: `fmManagerOf` uses teams, not Reports to (M4); the 'Applied Directly' stored value and the seeded `job.submitted` counts are cleaned up in M5.

## 7. M3 update (2026-10-31) · submission rules, review and sending

| ID | Finding | Status | Evidence |
|---|---|---|---|
| B2 | Review before the client was a hardcoded workspace switch, not the job's "Approval before sending to the client"; seeded jobs had no rules; the job form ignored Settings defaults; required fields were never checked | **Fixed** | `tests/m03-submission-rules.spec.js`; see `implementation-progress.md`, 2026-10-31 · M3 |
| B3 | The send dialog ignored the job's contacts rule and its profile limit; a Recruiter could not send a Ready profile; the "Send to client" follow-through was owed by someone who could not send | **Fixed** | same spec |

Still open after M3: "Reason for change" and "Interview availability" have no profile field, so they are not enforced; the reviewer search is replaced in M4; the right-to-represent tick box in M7.

## 8. M4a update (2026-10-31) · approval routing

| ID | Finding | Status | Evidence |
|---|---|---|---|
| B4 | Approvals were routed in five separate ways (team manager, one-hop Reports to, nearest manager-type role on the job, Super Admin); role approve powers and the Settings skip roles were never read; SLA notices used teams; lists decided visibility by persona | **Fixed** (routing in M4a, data scope in M4b, section 9) | `tests/m04a-approval-routing.spec.js` (13 tests); see `implementation-progress.md`, 2026-10-31 · M4a |

One rule, `approverFor()`, now routes submission, offer, client, job and job access approvals up the Reports to line, with skip roles, approve powers, delegates and the Owner fallback, and stores the route on each request. Still open: data scope (M4b), menu and Home from permissions (M4c), Team actions and suspend hand-over (M4d); the job policy's "team manager" reviewer still uses teams.

## 9. M4b update (2026-10-31) · data scope

B4 is now fully fixed. `canIOn()` is the one scope rule for lists, detail views and actions: team is the whole Reports to tree, assigned is on the job, own is mine; the Owner is the top of every tree. Agency defaults follow flow 04, with a "Pipeline" scope for journeys. Recruiters see their assigned jobs and own journeys, the whole talent pool and all clients; Recruiter Managers see their tree. Outside your scope a job, journey or client opens to the blocked state, and a locked candidate shows only its owner, stage and date. Evidence: `tests/m04b-data-scope.spec.js` (10 tests); see `implementation-progress.md`, 2026-10-31 · M4b. Still open: menu and Home from permissions (M4c), Team actions and suspend hand-over (M4d); corporate lists keep their own rules.

## 10. M4c update (2026-10-31) · menu and Home from permissions

| ID | Finding | Status | Evidence |
|---|---|---|---|
| B5 | The menu and Home came from the persona, not the role: a custom role got its persona's menu; one permission entry gated the sidebar; the blocked panel said "Team mismatch" | **Fixed** | `tests/m04c-menu-home.spec.js` (9 tests); see `implementation-progress.md`, 2026-10-31 · M4c |

Agency staff get one menu filtered by their role's permissions, one Home from `homeFor()`, and the blocked state (in plain words) for screens their role can't open. Client money on agency screens follows Clients · View Contracts. Still open: Team actions and suspend hand-over (M4d); money visibility everywhere else (M8).

## 11. M4d update (2026-11-01) · team actions and suspend hand-over

| ID | Finding | Status | Evidence |
|---|---|---|---|
| B17 | Every Team action was Owner-only, whatever the role's team permissions; Settings › People and the Team page disagreed on who could act | **Fixed** | `tests/m04d-team-handover.spec.js`, `tests/agency-shapes.spec.js`; see `implementation-progress.md`, 2026-11-01 · M4d |
| B11 | Two suspend paths: Team suspended with no hand-over; Settings handed everything to one person without owner history, missing campaigns, client accounts and the job lead | **Fixed** | same specs |

Team actions follow `canTeamAction()` (permission based; a Recruiter Manager changes reports to inside their own tree). Suspending always opens one hand-over that moves jobs, journeys (with owner history), approvals (re-routed when needed), campaigns, client accounts and direct reports, each to its own person, with an audit line per category. M4 (B4, B5, B11, B17) is complete. Still to merge later: the job policy's "team manager" and "reports to" options now behave the same.


## 12. M5a update (2026-11-01) · one status list, part 1: the numbers

| ID | Finding | Status | Evidence |
|---|---|---|---|
| B20 | Funnel, recruiter dashboard and job counts read stage "Submitted" or a stored counter instead of the send record; portal applicants could count as sent; revenue used a flat 8.33%; placement states sat in the candidate stage order | **Fixed** | `tests/m05a-status-numbers.spec.js`; see `implementation-progress.md`, 2026-11-01 · M5a |
| B14 | No single status per candidate per job; stage names and statuses disagreed | **Partly fixed**: `journeyStatus()` gives the flow 18 status and five mismatched seed journeys are corrected; screens show it in M5b | same spec |

Also fixed: the sign-in screen was blank on open since M4b (`checkScope` threw at load before `scopeApplies` existed, which stopped `authBoot()`); recruiter score outreach now counts only the recruiter's own sends.

Still open: one status shown everywhere (M5b); Ready from consent and required fields (M7).

## 13. M5b update (2026-11-01) · one status everywhere

| ID | Finding | Status | Evidence |
|---|---|---|---|
| B14 | No single status per candidate per job; screens showed stored stage names and their own phase words | **Fixed** (agency) | `tests/m05b-status-everywhere.spec.js`; see `implementation-progress.md`, 2026-11-01 · M5b |

Every agency list, filter and label reads `journeyStatus()`: job chips, the pipeline drawer, Talent Pool tabs, the Lineup (six steps, status filters and board, no drag), candidate entries and next actions, the candidate's own portal (a candidate view), job page counts and messages. Company workspaces keep their pre-M5b words; their "client" wording is listed for a separate corporate pass. M5 (B14, B20) is complete.

## 14. M6 update (2026-11-01) · one hold

| ID | Finding | Status | Evidence |
|---|---|---|---|
| B18 | Four agency hold paths with three different records; only the stage "On Hold" one was checked back; holds survived a cleared round, an offer or the client's "not a fit"; ending a hold was mostly silent | **Fixed** (agency) | `tests/m06-one-hold.spec.js`; see `implementation-progress.md`, 2026-11-01 · M6 |

Agency holds are one record (`sb.hold`, with source and check-back date), started and ended only by `setHold`/`clearHold` with history and audit, checked back every 7 days whichever path set them (Kairo when its follow-ups are on, a reminder to the owner when off), and shown as stalled once past their check-back date. Company workspaces keep their own hold paths.

## 15. M7 update (2026-11-01) · the candidate confirms right to represent

| ID | Finding | Status | Evidence |
|---|---|---|---|
| B8 | Right to represent was a tick box in the send dialog; nothing recorded who agreed or how; the candidate was never asked | **Fixed** (agency) | `tests/m07-consent.spec.js`; see `implementation-progress.md`, 2026-11-01 · M7 |

Submitting a candidate sends them a link (WhatsApp and email) to agree to be put forward to that client for that job. Nothing is sent to the client without their yes or a recorded call; No closes the journey as Not interested and blocks nobody; no answer in 48 hours tells the owner. Ready now means agreed with required fields complete. Company workspaces keep their vendor consent. Also: an agency hold checked back three times with no change now reaches the owner's manager (M6 follow-up).

## 16. M8 update (2026-11-01) · PayTrack end to end

| ID | Finding | Status | Evidence |
|---|---|---|---|
| B9 | A hire who leaves inside the window reopens the job but PayTrack doesn't react | **Fixed** (agency) | `tests/m08-paytrack.spec.js`; see `implementation-progress.md`, 2026-11-01 · M8 |
| B10 | Commission is a fixed 10% with no rule, split or "payable when" | **Fixed** (agency) | same spec |
| B13 | Money shows in four places | **Fixed** (agency) | same spec |
| B16 | Only the Owner can raise an invoice | **Fixed** (agency) | same spec |

PayTrack is the one money screen (Placements · Invoices · Collections · Commission); Revenue, Home cards and the client Billing tab read it. Invoices follow the client's terms (at joining or after the window), are numbered per agency and year, held with a reason, and paid in full or in part. Leaving inside the window opens a linked free replacement or a credit note per the client's terms. Commission follows the Owner's rule and split, payable after full payment and the window. Billing actions follow four permissions. Company workspaces are unchanged.

## 17. M9 update (2026-11-01) · contract and temporary staff for agencies

| ID | Finding | Status | Evidence |
|---|---|---|---|
| B7 | Contract and temporary hires had no agency path: no assignment, time, client approval, monthly invoice or worker pay | **Fixed** (agency) | `tests/m09a-assignments.spec.js`, `tests/m09b-contract-money.spec.js`; see `implementation-progress.md`, 2026-11-01 · M9 |

A Contract or Temporary hire becomes an assignment at Joined (rates with a minimum-margin approval, per-day time from the worker's link, one-tap client approval, Kairo's flags, attendance import, lifecycle). Monthly invoices are built from approved time in PayTrack with the M8 machinery and the client location's tax rules; gross pay exports for payroll; conversion to permanent creates a normal placement; commission follows the monthly margin. Corporate contract hiring shares the same time engine and is unchanged.

## 18. M10 update (2026-11-01) · honest Kairo disclosure

| ID | Finding | Status | Evidence |
|---|---|---|---|
| B19 | Every message Kairo drafted said "approved by a person on our team", including automatic sends that no person looked at | **Fixed** | `tests/m10-disclosure.spec.js`; see `implementation-progress.md`, 2026-11-01 · M10 |

The line now depends on how each message was actually sent, recorded on the send ledger: "approved by a person on our team" only when a person approved that message; "from a template our team approved" for automatic acknowledgements, follow-ups, reminders, consent and time links. A person's own message gets no line, and with the switch off neither line is added. The Settings help explains both.

## 19. M11 update (2026-11-01) · names, role templates and team-size defaults

| ID | Finding | Status | Evidence |
|---|---|---|---|
| B12 | The top role was called "Super Admin" or "Tenant Admin" across role names, toasts, errors, help and audit text | **Fixed** (agency and corporate) | `tests/m11-names-templates.spec.js`; see `implementation-progress.md`, 2026-11-01 · M11 |
| C5 (decision) | The team size answered at sign-up didn't set any starting rules | **Fixed** (agency) | same spec |

Inside a workspace the top role is "Owner" everywhere; "Oontu Super Admin" stays on Oontu's own screens. Saved records keep their old label and are shown as Owner. Create role offers Admin, Account manager, Accounts and Sourcer (never seeded); each fills the editor and nothing is created until Save. A new permission, "Submit to job", keeps everyone who could submit able to; the Sourcer template doesn't have it. The team size at sign-up sets submission review and applicant sharing once (1–5: review off, applicants to the job lead; 6 or more: review on for Recruiters, round-robin), shown in Workspace defaults with Change; a later team-size change touches neither Settings nor jobs. (This C5 is the decision-list item; the vendors row C5 in section 2 is a different item.)

## 20. M12 update (2026-11-02) · end to end

The whole agency journey runs end to end for all four team shapes in `tests/agency-e2e.spec.js`. The summary for reading is `docs/OONTU_AGENCY_READY_REPORT.md`. B15 was not a code issue. It was missing from this audit until now:

| ID | Finding | Status | Evidence |
|---|---|---|---|
| B15 | The flow map (v8) showed the old 4-question sign-up; the product asks 9 questions with a code | **Fixed in the flow map (no code change)**, from v9 | Flow map v9; sign-up covered by `tests/auth-flow.spec.js` |
