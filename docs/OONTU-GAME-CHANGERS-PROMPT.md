# PROMPT FOR CLAUDE CODE — Oontu recruiter app: six must-have upgrades

Copy everything below this line into Claude Code.

---

You are working on the Oontu recruiter app inside `recruitment-os-prototype.html` (one HTML file, ~70,000 lines, plain JS and CSS, no build step). Oontu serves **staffing/recruitment agencies** and **corporate hiring teams** in the same app; corporate mode is detected with `jsCorp()` / `sIsCorporate()` (`ORG_STRUCTURE.profile.orgType === 'Corporate'`).

This task is NOT the O2 internal platform (Super Admin / Business OS). Do not touch `bos-*` scripts, `PLATFORM_*` stores or O2 screens.

## Goal

Make Oontu measurably better than competitors (benchmark: Bullhorn Automation) at the two things customers pay for: **agencies earning and keeping more revenue**, and **corporates finding the best talent at lower cost**. Six upgrades, built in order, each one small, testable and switchable:

| # | Upgrade | Agency gets | Corporate gets |
| --- | --- | --- | --- |
| G1 | Live workflow triggers | Automations that actually run | Same |
| G2 | Automation results | Fees each workflow influenced | Hires and agency fees avoided |
| G3 | Money-at-risk board | Unbilled fees, unbilled time, missing timesheets, overdue invoices found and fixed | Idle approved roles, joiners at risk, contracts ending undecided |
| G4 | Redeployment / contract-end decisions | Contractors placed again before they leave | Extend, convert or end contractors; silver medalists re-invited |
| G5 | Own talent first | Database-first shortlist on every new job | Direct sourcing window before roles go to vendors |
| G6 | Interview self-booking | Candidates book their own slot | Same, on hiring managers' free time |

## How to work (read first, follow exactly)

1. **One upgrade per session.** Start with G1. Branch `rx/g<n>` from the latest approved branch. Do not start the next upgrade until I approve.
2. **Before coding:** read the functions named under "Where" for that upgrade, confirm they exist and behave as described, and tell me about anything that differs. Then show a short plan (blocks to add, functions to wrap, fields to add, tests) and wait for "go".
3. **Respect the prototype.** Add new code in new named blocks after the last `<script>` in the file: `<script id="rx-g<n>-script">`, `<style id="rx-g<n>-style">`, IIFE-wrapped, exporting via `window.*`. **Wrap** existing functions (`const base = window.fn; window.fn = fn = function(){ … base.apply(this, arguments) … }`) instead of editing them. Edit in place only for a one-line fix, and say so.
4. **Never delete or rename** anything other code or tests use. Data changes are **additive** (new fields beside old ones).
5. **Reuse what exists:** Design 2.0 components (`oDashShell`, `oPageHead`, `oNumbers`, `oTableCard`, `oBadge`, `oAttentionCard`) for new screens; existing modals, token-link pages (pattern of `#/time/<token>`), `logAudit`, permission checks (`canI`, `ptCan`, `asCan`, `asSeesMoney`), money and date helpers already in the file.
6. **Switch per upgrade:** `window.RX_SWITCH = { g1:false, … }` with `rxOn('g1')`, shown as toggles in the existing prototype/dev panel. Off = old behaviour exactly. A switch never deletes or reverts data.
7. **Everything outbound is simulated** (existing message logs, Uni Box, WhatsApp counters). Nothing real is sent.
8. **Honest numbers:** anything credited to automation is labelled **"influenced"**; any estimate is labelled **"estimate"** with its formula on hover. Money is shown only to users who can already see money.
9. **Settings** go in `WSX.rx` with the defaults given below, editable by Owner/Admin under Settings › Automation.
10. **Tests:** run with `& .\tests\run-auth-tests.ps1 -Spec tests\<name>.spec.js`. Before each commit run the specs for the areas you touched plus `screens-crawl.spec.js`; at the end run the full suite. Add the new spec named in each upgrade. A spec may change selectors; changing what a spec expects needs my approval. `motion.spec.js` "collapse… pill" is a known flake: rerun alone.
11. **Commits:** small, `RX G<n>: <what>`.
12. **Stop and ask** before changing invoice numbering, tax, money calculations, plan prices, or anything outside the current upgrade.

---

## G1 — Live workflow triggers (must come first)

**Why:** Workflow Studio only runs when someone presses Run Test (`wfRunTest`). Nothing fires on real events, so no automation actually happens.

**Where (verify):** Workflow Studio block near `WF_TRIGGERS` / `TA_TRIGGERS` / `LI_TRIGGERS` / `OTHER_TRIGGERS`, `WF_CONDITION_FIELDS`, `WF_TRIGGER_AGENT`, `WF_ACTIONS`, `WORKFLOWS`, `WF_TEMPLATES`, `wfEvaluateConditions`, `wfRunTest`. Stage moves (pipeline-move code), offers (`offersList()`), joins (PayTrack and contracts), talent-pool adds, job publish.

**Add:**
- `rxEmit(event, payload)` event bus. Payload: `candidateId`, `jobId`, `submissionId` (when known), `at`, `actor`.
- Emit from the functions that change: Candidate Added, Stage Changed, Interview Scheduled, Offer Released, Offer Accepted, Candidate Joined, Job Published, Candidate Added to Talent Pool. Corporate vendor submission stage changes (`CO.vsubs`) emit Stage Changed too.
- `rxSweep()` for time-based triggers (Notice Period Expiring, Scheduled Refresh, and those added in G3–G5): runs on load, every 60 s while open, and from a "Run sweep now" dev button.
- `rxRunWorkflow(wf, event)`: only **Active** workflows; conditions evaluated for **that candidate only**.
- Touch log `RX.touches[]` `{ id, workflowId, candidateId, jobId, channel, action, at, outcome }` and `RX.replies[]` when a reply lands in the Uni Box.

**Edit (refactor allowed, results must not change):** move the action-performing part of `wfRunTest` into a shared `wfPerform(wf, candidate, context)` used by both Run Test and live runs, keeping every existing check (approved template rule, WhatsApp tier quota, LinkedIn sender limits, weekend rule, duplicate suppression).

**Guards:** never act twice for the same `workflowId + event + candidateId + eventId`; max actions per workflow per day `WSX.rx.maxActionsPerDay` (200); skip candidates without consent (`consent.given !== true`) with reason "No consent".

**Show:** on each workflow card: last live run, actions today, skipped with reasons.

**Test:** new `rx-g1-live.spec.js`. Activate "Offer Follow-up", accept an offer, and expect exactly one action for that candidate. Re-fire it and expect nothing. Paused workflows never run. Run Test output is identical before and after.

---

## G2 — Automation results (proof in money)

**Why:** customers renew and recommend on outcomes. Today no screen says what a workflow earned.

**Add:**
- `rxAttribute(outcome)`: a workflow **influenced** an outcome if it touched the candidate within `WSX.rx.attributionDays` (30) before the outcome's first step (first submission to that job; first reply). Credit the most recent touch; list other touching workflows as "also touched".
- Outcomes per workflow: messages, replies, interviews, submissions, offers, joins.
- Money:
  - Agency perm: placement fee from `PLACEMENTS.feeAmount` / PayTrack `placementFee` (state the unit you find; use existing money formatting).
  - Agency contract: margin influenced (estimate) = (bill − pay) × expected weekly units × weeks booked, from `asCurrentRate`.
  - Corporate: hires influenced, plus **agency fees avoided (estimate)** for hires not sourced through a vendor = offered annual CTC × average vendor fee % from `CO.rateCards` / `CO.fees`, else `WSX.rx.defaultAgencyFeePct` (8.33, shown as an assumption).
- **Results** tab in Kairo/Workflow Studio and on each workflow: a funnel and money table with a 30/90/365-day filter; every number drills to its records.
- **Home card** for Owner/Admin: "Automation influenced ₹X fees / N hires (90 days)".

**Test:** new `rx-g2-results.spec.js`. A touch 10 days before submission credits the fee; a touch 45 days before does not. Users without billing view see counts but no amounts.

---

## G3 — Money-at-risk board

**Why:** agencies lose money they already earned. Corporates lose time and money on idle approved roles, last-minute joining dropouts, and contractors whose contracts end with no decision.

**Where (verify):** PayTrack (`PAYTRACK_JOINED`, `PAYTRACK_COMPLETED`, `ptAllRecords`, `invoiceStatus`, `paymentStatus`, `ptRaiseInvoice`, guarantee/replacement days, replacement jobs). Contracts (`contracts-script`: `ASSIGNMENTS`, `ASSIGNMENT_SHEETS`, `ctReadyTime`, `asMonthLines`, `asLastMonth`, `asBuildInvoice`, `asCurrentRate`, time and approval token pages). Corporate (`corp-script`: `CO.reqs`, `coReq*`, work orders, `coAssignExtend`, `coOnboardStep`, `coOnboardRemind`, `coDup*`).

**Add** `RX_LEAK_RULES`, evaluated by `rxSweep()`. Each finding is `{ id, rule, recordRef, amount, currency, ownerId, detectedAt, status: open|fixed|dismissed, dismissReason }`. A finding closes itself when its condition clears; it counts as **recovered** when money was involved. Dismissing needs a reason and never reopens for the same condition.

Agency rules:

| Rule | Condition | Amount | Fix button calls |
| --- | --- | --- | --- |
| perm-not-invoiced | joined, `invoiceStatus` 'Not Raised' after `WSX.rx.invoiceGraceDays` (3) | placement fee | `ptRaiseInvoice` |
| invoice-overdue | 'Raised', unpaid past client payment terms (default 30 days) | invoice amount | reminder to client billing contact + task |
| approved-time-not-invoiced | ready approved time for `asLastMonth()` after day `WSX.rx.contractInvoiceDay` (3) | `asMonthLines` value | `asBuildInvoice` |
| timesheet-missing | running assignment, no sheet for a finished week after 2 days | expected units × bill rate (estimate) | resend worker's time link |
| timesheet-awaiting-client | submitted, not approved after 3 working days | sheet value | remind client approver |
| guarantee-left-no-replacement | candidate left inside guarantee, no replacement job | fee at risk | open replacement job (existing flow) |

Corporate rules:

| Rule | Condition | Shown as | Fix |
| --- | --- | --- | --- |
| req-idle | approved, no candidates for `WSX.rx.reqIdleDays` (7) | days idle × (budgeted CTC ÷ 260) (estimate) | start direct sourcing (G5) / release to vendors |
| joining-at-risk | offer accepted, joining ≤ 7 days, onboarding incomplete or no contact 5 days | role, joining date, backups from the same requisition | `coOnboardRemind` + call task |
| work-order-ending | ends ≤ 14 days, no extend/convert/end decision | weekly cost | decision card (G4) |
| duplicate-dispute-open | duplicate case open > 3 days | candidate, vendors | open existing duplicate resolver |

**Show:** a "Money at risk" screen (agency: Owner, Admin, Accounts; corporate: Owner, HR head, Finance) grouped by rule, with totals per currency, owner, age and a fix button. A Home card shows "₹X at risk · ₹Y recovered this month". Add the Workflow Studio trigger **Revenue Leak Detected** (conditions: rule, amount, age).

**Test:** new `rx-g3-leaks.spec.js`, one seeded case per rule, plus the fixed, dismissed and self-closed paths.

---

## G4 — Redeployment (agency) and contract-end decisions (corporate)

**Why:** for staffing agencies, every contractor whose assignment ends with no next one is lost margin. Few firms even measure it, and Bullhorn's headline claim is +75% redeployment. Corporates rehire good contractors later through agencies at full fee.

**Agency, add:**
- Triggers **Assignment Ending** (at `WSX.rx.redeployLeadDays` = 21, and again at 7 days before `a.end`, for running assignments) and **Assignment Ended**.
- A **Redeploy** panel on the assignment, plus a Redeploy board. It ranks open Contract/Temporary jobs (`asIsContractJob`) by the existing match score, filtered by location and pay within ±15% of the last rate. It shows each job's projected margin against the client's minimum (`asMinMargin`, `asMarginPct`); jobs below the minimum are flagged, never hidden.
- **Availability check** token page `#/avail/<token>` (Yes / Not yet / No). It updates `candidate.availableFrom`.
- **Ask client to extend** via the existing extension path (`asExtend` / client approval link).
- Workflow actions for these triggers: send availability check, create task, shortlist to job (as a draft; a person submits), ask client to extend.
- Metrics:
  - Redeployment rate = workers starting a new assignment within `WSX.rx.redeployWindowDays` (14) of their last one ending ÷ assignments ended.
  - Margin retained (estimate).

**Corporate, add:**
- Trigger **Work Order Ending** (21 and 7 days). The decision card offers:
  - **extend** (`coAssignExtend`);
  - **convert to permanent** (opens a requisition prefilled from the work order; shows the vendor conversion fee from fee terms if recorded);
  - **end** (reason required).
- **Silver medalists:** when a requisition is approved, list candidates who reached final interview or offer for similar roles in the last `WSX.rx.silverMonths` (12) months and weren't hired. A one-click "Invite to apply" sends the invitation.

**Test:** new `rx-g4-redeploy.spec.js`.
- The trigger fires once per threshold.
- Below-minimum-margin jobs are flagged.
- The availability link updates the worker.
- The redeployment rate counts correctly.
- All three corporate decisions run through existing functions.

---

## G5 — Own talent first

**Why:** agencies pay job boards for candidates already in their database. Corporates pay agency fees for people already in their own pool.

**Agency, add:** when a job is published or re-opened, a **Database-first shortlist** of the top `WSX.rx.dbFirstCount` (25) existing candidates by match score. It excludes candidates contacted for another job in the last 14 days, in an active process, or without consent. One action sends an approved "new role" message and records touches. The job shows "placements from own database".

**Corporate, add:** a **Direct sourcing window**. For `WSX.rx.directWindowDays` (5 working days; Owner may set 0) after approval, the requisition is not released to vendors. During that time, the company's own pool, past applicants and silver medalists are matched and invited. The requisition shows "Direct sourcing until <date>", plus "Release to vendors now" (reason required). Requisitions marked urgent skip the window. A hire from the window is recorded in G2 as agency fees avoided (estimate).

**Where (verify):** the job publish / re-open functions; corporate requisition approval; the function that releases a requisition to vendors (`coMarket*` / `coAssign*`, so confirm which).

**Test:** new `rx-g5-own-first.spec.js`.
- Exclusions apply.
- The window holds the release and lifts it on time or by button.
- Urgent roles skip the window.
- A hire from the window appears in G2.

---

## G6 — Interview self-booking

**Why:** scheduling takes most recruiters two or more days per interview, and candidates are lost while they wait.

**Where (verify):** `interviews-script`, `openScheduleInterviewModal` and its save function; the Interviews agent's propose step; corporate hiring manager pages (`coHm*`).

**Add:**
- Availability per interviewer: reuse it if it exists; otherwise add `availability` (working days, hours, time zone). Existing interviews count as busy.
- Booking link `#/book/<token>`, sent by the Interviews agent or the new workflow action **Send booking link**.
  - Shows up to `WSX.rx.bookingSlots` (6) free slots over the next 5 working days, in the candidate's time zone.
  - Booking saves through the existing scheduling save path, sends confirmations (simulated) and emits Interview Scheduled.
  - Reschedule or cancel from the same link until `WSX.rx.rescheduleCutoffHours` (12) before the slot; after that, the candidate is told to contact the recruiter.
- Agency: the recruiter enters the client interviewer's weekly free hours (simple grid). Corporate: hiring managers' availability is used.
- Metric: median days from shortlist to interview booked, per job.

**Test:** new `rx-g6-booking.spec.js`.
- A booked interview is identical to one scheduled by hand.
- A taken slot disappears for others.
- A reschedule after the cutoff is refused with a message.

---

## Report after each upgrade

1. What you added, wrapped or edited (block names and function names).
2. Tests run and results, with the switch on and off.
3. Every acceptance item checked.
4. Rollback notes:
   - what the switch turns off;
   - what data remains;
   - what can't be undone (messages sent, invoices raised by fix buttons);
   - how to recover.
5. Anything unclear or not done.

Do not start the next upgrade until I approve.
