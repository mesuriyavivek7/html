# Oontu for agencies: where it stands

Date: 2 November 2026. Prototype: `recruitment-os-prototype.html` (one file, no server). Branch: `agency-fix-m1-m7`, with M8 to M12 not committed yet.

This is a plain summary of what was fixed, what is still missing, what is only pretended in the prototype, and what a real build has to do. Every claim of "fixed" points to the test file that proves it.

## 1. Test results

| Check | Result |
|---|---|
| Full suite (38 spec files, in a separate Chrome profile) | 38 of 38 twice (after the K1–K8 review); 37 of 37 with the browser in UTC before it |
| Approval engine checks (`node test/aps.test.js`) | 34 of 34 (2 London checks added) |
| Corporate spec | 20 of 20, no lines changed since before M1 |
| New end-to-end spec `tests/agency-e2e.spec.js` | 8 of 8 |

The end-to-end spec runs the whole agency journey once for each team shape: Owner → Recruiters, Owner → Recruiter Manager → Recruiters, Owner → Admin → Recruiter Manager → Recruiters, and a mixed team. Each run covers:

- sign-up with the team size, then setup
- invites with Reports to
- a client with terms, then a job
- applicants, both by a personal link and by the sharing rule
- screening, then consent Yes
- review (when it is on), then send
- the client booking from the review link
- two interview rounds, with a hold and a check-back in round 1
- offer (the fee from that terms version), accepted, pre-joining, joined
- the invoice raised by an Accounts person, part paid, then paid
- the window passing, then commission payable, approved and paid

It checks who acts at each step, that people who shouldn't act can't, the audit lines, and the funnel and money numbers. The Classic shape also runs, once each:

- a hire who leaves in the window
- a contract hire billed through a monthly invoice
- a consent No
- a same-job duplicate with an override

Three shortcuts in that spec, said plainly:

- **Sign-up:** it calls the same functions the sign-up wizard calls when it enters the product, not the wizard screens. Those screens are tested in `auth-flow`.
- **Invites:** an invite is accepted by marking the person Active. The accept screens are tested in `auth-flow`.
- **Clients:** a client is made from a copy of a seeded client, then given its terms through the real terms function.

## 2. Fixed: B1 to B20

| ID | What was wrong, and what it does now | Proved by |
|---|---|---|
| B1 | New applicants had no owner and the personal link was ignored. Now: personal link first, then the job's rule, then the job lead, then the Owner; never unowned; SLA hand-on | `tests/m02-applicant-owner.spec.js` |
| B2 | Review before the client was one workspace switch. Now each job decides, from Settings defaults; required fields are checked | `tests/m03-submission-rules.spec.js` |
| B3 | The send dialog ignored the job's contact and profile limits; recruiters couldn't send a Ready profile | `tests/m03-submission-rules.spec.js` |
| B4 | Approvals were routed five different ways. Now one rule: up the Reports to line, people on the job, role powers, delegates, Owner last | `tests/m04a-approval-routing.spec.js`, `tests/m04b-data-scope.spec.js` |
| B5 | Menu and Home came from the persona, not the role. Now both follow the role's permissions | `tests/m04c-menu-home.spec.js` |
| B6 | Offers were kept in three places and placements were matched by name. Now one offer record, linked by ids, one joining date | `tests/m01-offer.spec.js` |
| B7 | No agency path for contract or temporary hires. Now: assignments, the worker's time link, client approval link, monthly invoices, gross pay export, conversion | `tests/m09a-assignments.spec.js`, `tests/m09b-contract-money.spec.js` |
| B8 | Right to represent was a tick box. Now the candidate gets a link and taps Yes or No, or a call is recorded with a note; nothing goes to the client without it | `tests/m07-consent.spec.js` |
| B9 | A hire who left inside the window didn't affect money. Now: free replacement job or a credit note, by the client's terms; commission cancelled | `tests/m08-paytrack.spec.js` |
| B10 | Commission was a flat 10%. Now: a rule, a sourcer/closer split, payable only when paid in full and the window has passed | `tests/m08-paytrack.spec.js` |
| B11 | Two suspend paths, one with no hand-over. Now one hand-over for everything a person owns | `tests/m04d-team-handover.spec.js`, `tests/agency-shapes.spec.js` |
| B12 | The top role was called "Super Admin" or "Tenant Admin". Now "Owner" inside every workspace; "Oontu Super Admin" only on Oontu's screens | `tests/m11-names-templates.spec.js` |
| B13 | Money showed in four places with different totals. Now PayTrack is the one source; Revenue, Home cards and the client tab read it | `tests/m08-paytrack.spec.js` |
| B14 | No single status per candidate per job. Now one status list, shown everywhere | `tests/m05a-status-numbers.spec.js`, `tests/m05b-status-everywhere.spec.js` |
| B15 | The flow map (v8) showed the old 4-question sign-up, while the product asks 9 questions with a code. **Fixed in the flow map (no code change)** from v9 | Flow map v9; the sign-up itself is covered by `tests/auth-flow.spec.js` |
| B16 | Only the Owner could raise an invoice. Now billing permissions: Raise invoice, Record payment, Approve credit, Pay commission | `tests/m08-paytrack.spec.js` |
| B17 | Every Team action was Owner-only. Now Team actions follow the role's team permissions | `tests/m04d-team-handover.spec.js` |
| B18 | Four hold paths, three records, most never checked back. Now one hold, checked back every 7 days, ended with history | `tests/m06-one-hold.spec.js` |
| B19 | Every Kairo message said a person approved it. Now the line says how it was actually sent, from the send ledger | `tests/m10-disclosure.spec.js` |
| B20 | Funnel and counts read the wrong field; revenue used a flat 8.33%. Now everything counts from the send record and PayTrack | `tests/m05a-status-numbers.spec.js` |

Also fixed along the way (no B number):

- **Recruiter score:** it no longer shows 100% from one record ("Too few to score yet").
- **Join Ratio:** it was 200%; it now uses the same small-sample rule.
- **Role templates and team-size defaults:** both added (C5).
- **Submitting:** a role without "Submit to job" can't submit by any path. That includes shortlisting an applicant, which used to slip past.
- **Final review K1–K8:**
  - Money only for money roles: recruiter Home, Intelligence, client money and campaign revenue need billing · View, while fee terms stay on View Contracts. A privacy sweep proves it (`tests/k-review.spec.js`).
  - No typed-in figures shown as facts.
  - One source for the jobs website and marketplace; agency jobs on the jobs website.
  - The phone note bar.
  - The corporate demo menu error.
- **Shared Cowork workflows:** only their owner can edit, pause or delete them, and a copy always sends from your own accounts.

## 3. Still not built from the flow map, and why

| What | Why it isn't there |
|---|---|
| Employee portal (internal jobs, referrals) and the referral bonus clock | Corporate; never scheduled |
| E-sign for offer letters | Needs a signing provider; out of scope for a prototype |
| Reading a real mailbox or WhatsApp, and one-tap approvals on WhatsApp | Needs live connectors. The prototype reads a pasted reply and suggests a status (A8) |
| LinkedIn multi-account sourcing | Declined earlier (`approval-required-changes.md`) |
| Marketplace listing and the public jobs website for agencies | Settings exist; the agency side of the marketplace was not built |
| A report of sign-up drop-off reasons | Reasons are stored; no report screen |
| Routing a new client through the Approvals engine | Only below-standard fees and tax lines are approved today |
| Kairo drafting the client's career-page widget | The company lookup exists; the widget draft does not |
| A spec that checks job workload and Kairo's team suggestions (A4) | The screen exists; untested |
| Erasure and retention jobs (C11) | Consent and audit exist; deleting and expiring data on a schedule needs a server |
| Corporate: CSV and SSO/SCIM people import, automatic role rules (C1, C2) | Settings stubs only |
| Live integrations of any kind (I) | Every connector is a simulator |

## 4. Simulated in the prototype, and what each needs in production

| Simulated | How the prototype does it | Production needs |
|---|---|---|
| WhatsApp | Opens a `wa.me` link or writes a "touch" record; nothing is sent | A WhatsApp Business provider (Meta Cloud API or a BSP); pre-approved templates; delivery and read receipts; opt-out handling; a 24-hour window rule |
| Email | Writes to an in-page outbox (`coMail`, the send ledger) | A sending service (SES, SendGrid, Postmark) with a verified domain (SPF, DKIM, DMARC), bounce and complaint handling, unsubscribe |
| Job boards | `ingestApplicationEvent` is called as if a board sent an application; "publish to Naukri/LinkedIn" is a flag | Board APIs or feeds (XML/JSON), webhooks for applications, and a mapping per board |
| Consent links, time links, client review and approver links | Hash routes (`#/consent/…`, `#/time/…`, `#/time-ok/…`, `#/l/…`) in the same page; tokens kept in memory | Signed, single-purpose tokens stored on the server with an expiry; pages served by Next.js without sign-in; rate limits; every answer written by the server |
| Tax packs (GST, TDS, VAT) | Rule packs in the page; TDS for contract staffing is not set and the invoice says "confirm with an accountant" | Rule packs kept as data, reviewed by an accountant per country; GST e-invoicing (IRN) where required; a place-of-supply check |
| Payments | A person records a payment by hand | Bank reconciliation or a payment gateway; remittance matching; TDS certificates |
| Sign-in and codes | `authApi` is a mock; one-time codes are shown in the page | A real identity service: email OTP, Google/Microsoft OAuth, sessions, device list, lockouts |
| Kairo (AI) | Deterministic templates; replies and interest are decided by a hash of the ids | A model API with prompts kept as data, a review queue, logging, and limits per workspace |
| LinkedIn sender accounts | Profiles and limits in memory | Only what LinkedIn allows. The multi-account part was declined |
| Calendar and video | Times and `.ics` files made in the page | Google/Microsoft calendar APIs, free/busy, Meet/Teams links |
| Background checks | A listed integration only | A provider API |
| Clock | One app clock (`fmNow`) that tests move forward. Business days come from the workspace time zone (`wsDay`, `tests/time-zone.spec.js`) | A server clock, and scheduled jobs (SLA sweeps, check-backs, windows, reminders) run by a job queue in each workspace's time zone |
| Saving | Almost nothing is saved; a reload resets the demo. Only approvals state and a few preferences use `localStorage` | A database |

## 5. What a real backend must enforce on the server

Today every rule below runs only in the page, so anyone with the browser console can skip it. Each one must be checked again by the server on every write. The function names are where the rule lives today; port them as they are.

**Permissions and data scope**
- Every action against the role's permissions: `canI`, `canIOn`, `roleHasPermission`, `checkScope`.
- Data scope for jobs, journeys, clients, interviews and approvals (`jobInScope`, `journeyInScope`, `clientInScope`), including "the client's owner counts as on the job".
- Submitting needs "Submit to job" (`submissionGate`, `canSubmitToJobs`), on every path: submit, the send dialog, and shortlisting an applicant.
- Money visibility: `asSeesMoney`, `clCanSeeMoney`, and audit text with no amounts for people without money access (`ptAuditText`).
- The Owner role can't be edited or removed, and the last active Owner can't be suspended.

**Team**
- Reports to with no loops (`tmCreatesCycle`).
- Hand-over before suspension (`handOverWork`): every journey, job, campaign, client account and job lead role moves.
- Who may invite, edit or suspend (`tmRequire`).

**Sign-up and settings**
- The team-size starting rules are set once (`applyTeamSizeDefaults`).
- A later team-size change never touches Settings or jobs.
- Settings values are defaults for new jobs only.

**Intake**
- Dedupe by email, phone and content.
- Owner by personal link, then the job's rule, then the job lead, then the Owner (`applicantOwnerFor`).
- SLA reassignment (`fmSlaSweep`).
- A repeat delivery never changes the owner.

**Submissions**
- One open journey per candidate per job (`submitOneToJob`).
- The client duplicate window.
- Same-job override, with a reason, a deadline and automatic return (`fmOverrideGrant`, `fmOverrideSweep`).
- Required fields, and the profile limit and contact masking at send.
- Review when the job needs it.

**Consent**
- Nothing is sent to the client without a Yes or a recorded call with a note.
- A link expires after 48 hours.
- At most 2 links in 30 days, and a note is needed to ask again within 7 days.
- Consent is per client and job.

**Approvals**
- One routing rule (`approverFor`).
- Decision guards (`APS.guardDecision`).
- SLAs, reminders, escalation and delegation.
- Credit notes need "Approve credit"; rate changes below the minimum margin need "Approve rates".

**Interviews, holds, client links**
- Link scope and expiry (`slValid`, `slExpire`).
- One hold record with a 7-day check-back; the third check-back tells the manager.
- A booked interview clears the hold.

**Offers and joining**
- The fee is frozen from the terms version in force when the offer was recorded.
- Exceptions (pay outside the range, a fee below terms) need approval.
- One placement per journey; a second joining is refused.

**PayTrack**
- Invoice and credit-note numbers come from a database sequence per agency and year, and are never reused.
- A frozen tax snapshot.
- Raise, record, credit and pay commission each need their permission.
- Commission is payable only when the invoice is paid in full (credit included) and the window has passed.
- The sourcer/closer split.
- Leaving inside the window gives a free replacement or a credit note.

**Contracts**
- Bill rate = pay rate + markup, with a minimum margin that needs approval.
- Week checks, month splits and rate changes by day.
- The same days are never billed twice.
- The client approver link stops after convert, end or terminate, except for weeks still waiting.
- Conversion fees and waiver months.

**Cowork**
- The send ledger.
- Quiet hours, caps, suppression and the no-poach rule.
- Per-message approval when the agent asks for it.
- The disclosure line comes from how the message was sent.
- Only the owner edits, pauses or deletes a workflow; copies send from your own accounts.

**Dates and time zones**
- Server stores timestamps in UTC and computes business days in the workspace time zone, using the same rule as wsDay.
- Business days are: joining date, due date, window end, timesheet day, invoice month, terms effective date, SLA day, renewal and period dates, call-back dates.
- Days are added as calendar days, never as 24-hour blocks, so a clock change can't move a day.
- Business hours for approvals are counted in the workspace zone too (Intl, daylight saving included).
- Interview times are stored as UTC instants and shown in the workspace zone with the zone named; calendar files carry UTC.
- Send windows (email, WhatsApp, LinkedIn active hours, campaign hours) are checked in the workspace zone.

**Audit**
- The log is append-only and saved history is never edited.
- Old labels are mapped only when shown (`shownRoleName`).

## 6. Known risks, and what to check by eye before showing a real agency

Risks:

1. **Nothing is saved.** A reload resets the demo, including roles and invites. Don't reload mid-demo.
2. **One very large file** (about 50,000 lines). It is slower to open than a real app, and the first render on a slow laptop is noticeable.
3. **Many screens have only been checked by specs, never opened in a browser.** These are listed below.
4. **Tax:** TDS for contract staffing is not set in the rule pack (the invoice says so). GST treatment for overseas clients needs an accountant's review.
5. **"View as" and persona:** some older code still decides by which persona is signed in rather than by the person's role (`sRoleKind`). I changed the one place found in M12 (shared workflows). Others may remain.
6. **Two Settings pages for roles:** the old Permissions page still exists behind a redirect.
7. **Seed oddities:**
   - The demo has an "Admin" role that new agencies don't get.
   - Demo seeds (Kiran Rao this month; Sana Qureshi's contract) move some numbers.
8. **Dates and time zones:** business days, interview times and grids, and Kairo send windows (Cowork quiet hours, LinkedIn active hours, campaign send hours and slots) all use the workspace time zone, whatever the browser's.
   - Interviews show the zone name ("10:00 AM IST"), plus the viewer's own time in brackets when their browser is elsewhere.
   - The whole suite passes with the browser in UTC.
   - Still on the browser's clock, by decision: follow-up presets ("tomorrow 10:00"), and about 50 older date displays in the main script.
   - Seeded client terms v1 can start a day early when the page loads between 00:00 and 05:30 IST; this is harmless and was not changed.
9. **A known flaky check in the corporate spec** compares an exact millisecond. It failed once in many runs and was not touched, because corporate must stay as it is.

Check by eye, in a browser, at desktop and phone width:

- **Sign-up:** "Just me" and "6–20", then Workspace defaults (the Submission review and New applicants rows).
- **Settings → Roles:** Create role and each template; "not saved"; Save, Discard, Rename.
- **Team members:**
  - invite with Reports to
  - suspend with hand-over
  - the "only active Owner" message
- **Job:** create one, then the applicant list, Shortlist, the review in Approvals, and the send dialog.
- **Consent page on a phone** (Yes, No), and the call-with-a-note path.
- **Client review link:** the profile, booking a time, hold, not a fit, round outcomes.
- **PayTrack:** all five tabs (Placements, Invoices, Collections, Commission, Contracts), the part-paid label, and the credit note.
- **Contracts:**
  - the worker's time link
  - the client approver link, including "This link no longer works" after the end
  - the monthly invoice and the gross pay CSV
- **Revenue and Home money cards against PayTrack.**
- **Recruiter Analytics and the Home performance card:** "Too few to score yet".
- **Cowork:**
  - a shared workflow as a Sourcer: Duplicate works; Pause, Edit and Delete are refused
  - the disclosure line in a sent message
- **Corporate:** sign in to a company workspace and make sure nothing changed.

## 7. Suggested order to build it for real (NestJS + Prisma + PostgreSQL + Next.js)

Build each module in this order. Each one gets its Prisma models, a NestJS service that holds the rules (ported from the named functions), REST or tRPC endpoints, Next.js screens, and the matching spec ported to Playwright against the real app. Nothing in a later module should need a change to an earlier one's rules.

1. **Foundation.**
   - Workspaces (tenants, with the agency/company type).
   - Users and sign-in (email OTP, Google, Microsoft).
   - Roles, permissions and data scope, as one guard used by every endpoint.
   - An append-only audit log.
   - One server clock.
   - A job queue (BullMQ on Redis) for scheduled sweeps.
   - An outbox for every message.
   - PostgreSQL row-level security per workspace as a second wall.
2. **Team.** Invites, Reports to (with a loop check), suspend with hand-over, team-size starting rules, role templates.
3. **Clients and terms.** Contacts, locations, versioned commercial terms, tax rule packs as data, duplicate check.
4. **Jobs.** Process stages, submission rules, team and job lead, applicant routing, publishing (internal first; boards later).
5. **Candidates and intake.** Talent pool, dedupe, the intake endpoint for boards and the careers page, the personal-link owner rule, the SLA sweep.
6. **Journeys.**
   - One status per candidate per job.
   - Ownership and owner history.
   - The duplicate window and the same-job override.
   - Consent links (signed tokens, 48-hour expiry, limits).
7. **Approvals.** One routing rule, decision guards, SLAs, reminders, escalation, delegation. Port `test/aps.test.js` first.
8. **Client review links and interviews.** Scoped links, booking, rounds, feedback, outcomes, holds with check-backs.
9. **Offers, joining and PayTrack.**
   - Offers with the fee from the terms version, and exceptions.
   - Placements, invoices (database sequences), payments, credit notes.
   - Commission rules and the split.
   - Leaving in the window.
   - Bring in an accountant before going live.
10. **Contracts.** Assignments, rates and margin approval, the worker time link, the client approver link, monthly invoices, the gross pay export, conversion.
11. **Messaging providers.** Email first, then WhatsApp, both through the outbox and the send ledger, with the disclosure line from the ledger.
12. **Cowork / Kairo.** Workflows, the engine as queue jobs, approvals per message, safety rules, a model API behind a review queue.
13. **Reports and dashboards.** Read models or materialised views from the journey, send and PayTrack tables, never stored counters.
14. **Oontu platform console.** Tenants, plans, sign-up follow-ups, platform audit.
15. **Corporate modules.** Requisitions, vendors, marketplace, hiring manager links, as already prototyped.

Two rules for the whole build:

- The page never decides alone. Every check above runs on the server, and the screens only show what the server allows.
- Each module ships with its spec ported from `tests/`. Those specs are the definition of done.

## 8. Demo data (added 3 November 2026)

The account menu has the demo controls: Demo company (Kesar Staffing, Northstar Talent Partners, Vistaar HR Services; Start from sign-up or Open with demo data), Sign in as, Demo clock, and Simulate application on a job's Applicants tab. The three companies are built by the product's own functions, the same on every load; `tests/demo-data.spec.js` checks the guide's counts, the story records, every member's menu, money and privacy.

Measured on a MacBook (headless Chrome):

| What | Kesar | Northstar | Vistaar | Target |
|---|---|---|---|---|
| Switch company (reload + build + Home) | 0.5 s | 0.8 s | 11–12 s | 3 s |
| Home | | | 0.08 s | 2 s |
| Job list, Approvals | | | 0.05 s, 0.06 s | 1 s |
| Talent pool / a search | | | 0.63 s / 0.41 s (0.38 s is the "searching" pause) | 1 s |
| PayTrack Invoices | | | 0.05 s | 1.5 s |
| A contract month (all 30 assignments) | | | under 0.01 s | 2 s |

Vistaar misses the switch target. All 4,500 journeys go through the real steps on every open. Choices for this are in the round's report.

### Update, 4 November 2026: walk-through fixes

- **Vistaar open:** Home is on screen 1.3 s after navigation, and the history fills in behind a "Loading history…" note. It is complete at about 12 s.
  - The page stays usable while history loads; the build pauses while a dialog is open.
  - The longest pause after Home is about 0.6 s, at the very end.
- **Approval engine tick:** the full Vistaar tick went from 0.58 s to 0.025 s.
- **Rule for the server (K14):** when a recruiter starts a journey from a candidate that a Sourcer (Talent pool · Add, no Submit to job) added to the pool, the Sourcer is the journey's sourcer for commission.
- **Consent on screen (U1):** a journey shows "Ready to send" only once the candidate has agreed or a call is recorded. A recorded call cancels the open link. The server must apply both rules.
- **Secure links:** a send to a contact whose link has expired issues a new link; an expired link is never reused.
- **Workspace name (K17):** every message, page and document reads the workspace's current name. A server should print it from the workspace record, never a stored copy.
