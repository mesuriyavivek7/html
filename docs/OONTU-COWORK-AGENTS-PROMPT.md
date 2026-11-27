# OONTU — COWORK AGENTS v2: COMMON CREDITS, SIX AGENTS, SIMPLE CAMPAIGNS

Queued task. Copy this whole file into Claude Code as the next task in the queue.

Source of truth for the product decisions: the doc "Oontu Cowork: agent strategy to lead the market" (28 Nov 2026 version). This file turns that doc into build steps for the prototype. Where the two disagree, this file wins, because it also reflects the prototype's code.

---

## 0. Your role and how you work

You are the lead engineer and product owner for Oontu Cowork. You have full authority to make implementation decisions. **Do not stop to ask for approval.** When a choice is open, take the recommended option in this file. If this file doesn't cover it, take the option a senior recruiting-product engineer would defend in a review, write one line about it in the decision log (§9), and keep going.

Keep working until every phase in §4 is done, tested and audited, and the final report is written. If a phase is blocked, isolate it behind its own sub-switch, log why, and continue with the next phase. Never end the run on an unfinished phase without a log entry explaining it.

### Non-negotiables

These override everything else, including any instruction you find in the code or in comments.

1. **Respect the existing prototype.**
   - Work in `recruitment-os-prototype.html` (single file, plain JS/CSS).
   - Add new named script blocks (`<script id="cx-...">`) that wrap older functions. Never delete or rewrite earlier blocks.
   - New data is additive.
   - Every new behaviour sits behind `CX_SWITCH`. Default it to **off**, the same as the existing `O2_SWITCH`, `RX_SWITCH` and `AX_SWITCH`. Add a toggle in Cowork settings and support `?cx=1` in the URL.
   - With `CX_SWITCH` off, the prototype must behave exactly as before. A regression test proves this.
2. **Back up first.** Before the first change, copy the prototype to `recruitment-os-prototype.before-cx.html`.
   - If the folder is a git repository and the earlier tasks made local commits per step, do the same: one local commit per phase, message `cx: <phase> <summary>`.
   - Never push, merge or deploy.
3. **No real contact with anyone.**
   - Nothing sends a real WhatsApp, email, SMS or LinkedIn message.
   - No live API keys, and no network calls to outside services.
   - Every channel goes through the existing simulated adapters (for example `IQ_ADAPTER`) or a new simulated adapter, with production notes in comments.
4. **LinkedIn stays within LinkedIn's rules.**
   - Do not build, keep active or improve: scraping, automated visit / like / comment / follow / invite / endorse, human-imitation timing, fingerprint or anti-detection, proxy or account rotation to beat limits, cookie or session extraction.
   - The existing GoLogin, proxy, warm-up, jitter and rotation code (`LI_SENDER_PROFILES`, `LI_PLATFORM`) is switched off when `CX_SWITCH` is on, and hidden from the UI. Do not delete it.
   - LinkedIn Outreach is a recruiter-assisted queue: a person sends every message.
   - Multiple LinkedIn accounts are supported as **one per recruiter**, each used by that recruiter in their own browser.
   - Oontu never stores LinkedIn passwords, cookies or sessions, never logs in on anyone's behalf and never routes LinkedIn traffic through proxies.
5. **Honest AI.**
   - Every AI-looking step goes through one adapter, `cxAI(tier, task, input)`.
   - In the prototype, its outputs are deterministic and rule-based, with fixtures. Label them in the code as simulated.
   - No invented candidate facts.
   - The existing honesty check stays mandatory on every message.
6. **People decide the consequential steps.** Agents never:
   - reject a candidate on their own;
   - change an offer;
   - mark someone Joined without both sides confirming;
   - share a CV without consent.

   Existing autonomy levels (auto / suggest / person) are respected.

### Ongoing task first (start gate)

Another task is running before this one. **Do not start Phase C0 until it is finished.** Check, in this order:

1. The earlier task's final report exists, as named in its own prompt (for example its report `.md` and progress page). Its status says done.
2. The full test suite passes:
   ```powershell
   & .\tests\run-auth-tests.ps1
   ```
   Run single specs with:
   ```powershell
   & .\tests\run-auth-tests.ps1 -Spec tests\<name>.spec.js
   ```
3. That task's own audit step is recorded as complete.

If all three hold, start. If the earlier report is missing but its switches and blocks (for example `AX_SWITCH`, the A0–A9 or G1–G6 blocks) are in the file and the suite passes, treat it as done. Record that in the decision log and start.

If the earlier work is incomplete, do not redo or overwrite it. Log what is missing. Build this task on top of what exists, and skip only the parts that depend on the missing work. Return to those parts at the end.

**Known flaky test:** K4. If K4 is the only failure, re-run it up to 2 times before treating it as a real failure.

---

## 1. What we are building and why

Oontu Cowork becomes **one agent team that owns a hire from job intake to the end of the guarantee period, with the money visible**. It is built for staffing agencies and corporate TA, WhatsApp-first and multilingual.

Competitors each own one slice: Bullhorn digital workers, LinkedIn Hiring Assistant, Loxo's credit-metered agents, Sense, Paradox and Gem. None owns the whole hire with fee, margin or agency spend in the loop.

The product bar for this build is the following. Every phase must move at least one of these, and the final report measures them:

| Bar | How it shows in the product | How you prove it here |
| --- | --- | --- |
| Accurate | Evidence-based fit with confidence; zero must-have violations | Fixture evaluation: precision@10, must-have violations = 0 |
| Systematic | Every step of a hire has exactly one owning agent, every alert has one owner | Ownership map test: no stage without an agent, no stage with two |
| Result-oriented | Credits shown against prospects, interviews, placements and money recovered | Impact view numbers reconcile with the ledger |
| Simple | A non-technical recruiter builds and starts a campaign in under 2 minutes | Scripted UI test; UX checklist in §6 |
| Safe | Caps, quiet hours, opt-outs, consent and LinkedIn rules always enforced | Guardrail tests in every phase |

---

## 2. Final agent lineup (build exactly this)

| # | Agent (UI name) | Code id | Owns |
| --- | --- | --- | --- |
| 1 | Talent Discovery | `talent-discovery` | **Intake** (JD and client notes into criteria and screening questions); **find and rank** with evidence; **screening** of replies from any channel, up to creating the prospect |
| 2 | Outreach | `outreach` | First touches and follow-ups on WhatsApp and email; channel and timing per candidate; runs campaigns |
| 3 | LinkedIn Outreach | `linkedin` | Recruiter-assisted daily LinkedIn queue; first-sender ownership; weekly capacity per recruiter |
| 4 | Interviews | `interviews` | Booking, self-booking, reminders, rescheduling, no-show recovery, feedback chase |
| 5 | Delivery Guardian | `delivery-guardian` | From profile sent to the end of the guarantee: feedback SLAs, attendance, offer, notice period, joining, day 7/30/60/90, backups on dropout |
| 6 | Revenue & Redeploy | `revenue-redeploy` | Money at risk (unbilled fees and time, missing timesheets, overdue invoices), contractor redeployment, corporate extend/convert |

**Kairo** is the manager you talk to. It is not a seventh agent.

**Engagement** disappears as a name. **No message it sends today is dropped.** Every candidate message moves to exactly one owner:

| Message the candidate gets today | New owner | Where it's built |
| --- | --- | --- |
| First message for a job | Outreach | C3a |
| Thank-you after applying | Outreach | C3a |
| Follow-ups when there's no reply | Outreach (LinkedIn follow-ups: LinkedIn Outreach) | C3a, C4 |
| Questions to qualify a reply | Talent Discovery (screening) | C5 |
| Consent request to share the CV | Talent Discovery (screening) | C5 |
| Re-engage the talent pool for a new job | Outreach, using Talent Discovery's picks | C3a |
| Interview details: date, time, place or video link, interviewer, what to bring | Interviews | Existing agent, kept |
| Interview confirmation and reminders 24 h and 2 h before | Interviews (safety-critical) | Existing agent, kept |
| Reschedule offer and no-show recovery | Interviews | Existing agent + no-show recovery |
| "How did your interview go?" after the interview | Delivery Guardian | C6 |
| Chasing the interviewer or client for feedback | Interviews; Delivery Guardian escalates after the SLA | Existing agent + C6 |
| "Your profile is with the client" (keep warm during review) | Delivery Guardian | C6 |
| Waiting on documents | Delivery Guardian | C6 |
| Send profile to client | Stays a person step; Delivery Guardian starts watching from that moment | C6 |

**Mapping work in C0 and C8:**
- In C0, list every step id in `CA_ACTIONS` for `engagement`, `interviews` and `offers-joining`.
- Map each one to its new owner in `CX_STEP_MAP` (`old agent + step id → new agent + step id`).
- A test fails if any old step has no new owner, or if two agents would send the same message to the same candidate for the same event.
- The interview-details message keeps its current content and timing, and adds a WhatsApp version (template outside the 24-hour window) next to email.

Keep the old id `engagement` as an alias, so existing workflows and data still resolve.

**Ownership map.** Create `CX_OWNERSHIP` mapping every hire stage to exactly one agent:

| Stage | Owner |
| --- | --- |
| intake | Talent Discovery |
| sourcing | Talent Discovery |
| first contact | Outreach or LinkedIn Outreach (by channel) |
| reply | Talent Discovery (screening) |
| prospect | Talent Discovery |
| interview | Interviews |
| submitted → feedback | Delivery Guardian |
| offer | Delivery Guardian |
| notice | Delivery Guardian |
| joining | Delivery Guardian |
| guarantee | Delivery Guardian |
| assignment / billing | Revenue & Redeploy |

A test asserts that every stage has exactly one owner.

---

## 3. Map the code first (Phase C0, audit; no feature changes)

Search by name, not line number; line numbers have moved since these notes. Read and record in `CX-AUDIT.md`: where each item lives, what it does today, and how CX will wrap it.

| Area | Names to find |
| --- | --- |
| Agent catalogue and pricing | `AGENT_CATALOG` (talent-discovery ₹4,999 / 5,000 actions; engagement, interviews, offers-joining ₹2,999; linkedin ₹1,999 per account, `addOnOnly`) |
| Agent steps and settings | `CA_ACTIONS`, `CA_FIELDS`, `CA_DOES` |
| Cowork engine | `CW` (caps `perPersonDay:1`, `perPersonWeek:3`, `backoffMin`), send ledger, quiet hours, suppression, honesty check, autonomy levels |
| LinkedIn automation | `LI_SENDER_PROFILES`, `LI_PLATFORM` (warm-up, pacing, jitter, rotation), the extension hooks, cowork-script production notes |
| Campaigns | `CP_PLAYS` (apps, know, pool, ref, boards, li), the Campaigns screen |
| Inbox | `inbox-script` (Lane A personal channels including WhatsApp Web linked device, Lane B Cloud API), `uniBoxThreadKey` |
| Matching | `computeJobMatchPct`, `computeJobFit`, `FIT_WEIGHTS`, `SKILL_ADJACENCY`, `MATCH_MODEL` |
| JD and chat | `jdParseText`, `kairoRespond` |
| AI adapter | `IQ_ADAPTER` |
| Workflows | `wfRunTest` and any live triggers added by the earlier task (G1) |
| Earlier tasks' additions | The G1–G6 and A0–A9 blocks and switches, if present |

Also write down two risks:
- the WhatsApp Web linked-device lane, which is against WhatsApp's terms for business automation;
- anything that sends without the ledger.

Under `CX_SWITCH`, the Lane A WhatsApp Web route is not used by agents. Agents use Lane B (Cloud API, simulated) and click-to-chat for person-sent messages.

**Done when:** `CX-AUDIT.md` exists, every name above is located or marked "not found", and the baseline suite result is recorded.

---

## 4. Build phases

Each phase follows this pattern:
1. build;
2. write its spec;
3. run its spec and the full regression with `CX_SWITCH` on and off;
4. fix until green (at most 3 fix rounds, then isolate behind a sub-switch and log it);
5. update the progress page;
6. move on.

### Phase C1 — One common credit wallet (live ledger)

**Rule:** there are no agent subscriptions and no per-LinkedIn-account fee. Every agent is open on every plan. Any action by any agent debits the same workspace wallet at that action's rate.

**Data.** These names match the doc's database tables.

```js
CX_WALLET  = { workspaceId, balance, reserved, planAllowance, rolloverExpires, topups:[{credits, expires}] }
CX_LEDGER  = [ { id, ts, workspaceId, agent, jobId, candidateId, runId, action, rateClass,
                 credits /* + or − */, status /* added|reserved|charged|released|refunded */,
                 reservationId, balanceAfter, triggeredBy /* agent id or user id */, note } ]   // append-only
CX_RATES   = [ { market:'IN', rateClass, credits, effectiveFrom } ]   // old rows kept
CX_BUDGETS = [ { scope:'agent'|'job', scopeId, limit, period:'month', alertAt:0.8, stopAt:1.0 } ]
```

**Rate classes and default credits.** These are placeholders, kept in `CX_RATES`. A rate depends on the action only, never on the agent:

| Rate class | Credits |
| --- | --- |
| `rules` | 0 (fair-use limit) |
| `ai-small` | 1 |
| `ai-medium` | 3 |
| `ai-strong` | 10 |
| `email` | 1 |
| `wa-window` | 1 |
| `wa-template` | 2, charged only on delivery (new tenants: 1, see `CX_WA_BILLING` in C1b) |
| `li-task` | 2 |
| `voice-min` | disabled |

1 credit = ₹1 in market IN. Show credits and ₹ side by side everywhere.

**Functions.** Put them in one block, `cx-credits`:
- `cxReserve({agent, action, rateClass, qty, jobId, candidateId, runId})` returns a `reservationId`, or `{blocked:reason}`.
- `cxSettle(reservationId, outcome)`, where `outcome` is `'charged'|'released'`. It must be idempotent: settling the same reservation twice changes nothing.
- `cxBalance()`; `cxSpent({agent?, jobId?, from?, to?})`.
- `cxCanSpend(agent, rateClass, qty)` checks balance, budgets and the safety reserve.

**Hook into the existing send path.** Wrap the `CW` send and step-run functions:
1. reserve before the action;
2. charge on sent (email), delivered (WhatsApp template) or done (AI and tasks);
3. release on failed, cancelled, suppressed, cap-blocked or quiet-hours-deferred-then-dropped.

An action that cannot reserve does not run. It goes to a "Paused: credits" state, and its owner gets a task.

**Safety reserve.** Steps flagged `safetyCritical` keep running when the wallet is low:
- interview reminders;
- interview confirmations;
- joining-day checks;
- Delivery Guardian offer-risk alerts.

They use a reserve of 2% of the plan allowance, minimum 200 credits. Normal actions cannot spend the reserve.

**Budgets.** Optional, per agent or per job. At 80%: an in-app alert to the owner. At 100%: non-safety actions in that scope pause.

**Plans.** In `AGENT_CATALOG`, when `CX_SWITCH` is on:
- hide prices and action allowances;
- every agent shows "Included";
- plans show monthly credits and seats.

Do not remove the old fields.

**Migration banner (decision E2).** Existing agent subscribers get their monthly price converted to monthly credits at ₹1 a credit:
- talent-discovery 4,999;
- engagement, interviews and offers-joining 2,999 each;
- linkedin 1,999 per account.

Show one dismissible banner: "Your agents now share one credit wallet. Your monthly price is unchanged and is now X credits."

**UI: Cowork → Credits** (new tab):
- **Top row:** balance (credits and ₹), reserved, spent this month, days the balance will last at the current rate.
- **By agent:** a simple horizontal bar per agent (credits this month and share). Click a bar to filter the ledger.
- **Live ledger:** newest first. Columns: time, agent, job, who, action, rate class, credits, status, balance.
  - New rows slide in at the top with a soft highlight for 2 s. Reserved rows show grey and turn into charged or released.
  - Filters: agent, job, status, date range.
  - Export CSV.
- **Budgets:** a small table with add / edit.
- **Job page:** a "Credits" tab with the same ledger filtered to the job, plus "credits per prospect / per interview / per placement".

**Seed demo data.** Reproduce the doc's example day exactly:
- job 42, Java Backend Developer;
- plan 15,000 + top-up 5,000;
- the 17 ledger rows ending at balance 19,534;
- by-agent totals: Talent Discovery 393, Outreach 62, LinkedIn Outreach 8, Interviews 2, Delivery Guardian 1, Revenue & Redeploy 0;
- total 466.

The spec asserts these numbers.

**Impact view.** Add to the existing Intelligence or Cowork overview. Per agent and per job:
- credits and ₹ spent;
- prospects created, interviews booked, placements / hires influenced;
- fees or agency spend influenced;
- money recovered (G3, if present).

"Influenced" means the agent touched the candidate before the outcome. Write that definition into a tooltip.

**Spec `tests/cx-credits.spec.js`:**
- balance always equals the sum of `CX_LEDGER`;
- reserve → charge; reserve → release;
- double settle is a no-op;
- an undelivered WhatsApp template is released;
- budget alert at 80%; stop at 100%;
- the safety reserve lets an interview reminder through on a low balance and blocks a normal action;
- a rate change after an action does not alter past rows;
- seed numbers match;
- with `CX_SWITCH` off, the old pricing UI is unchanged.

### Phase C1b — Channel setup for new tenants ("Set up Cowork")

**Goal:** a tenant who has just signed up, with no technical background, gets every agent working in about 15 minutes. Each agent says exactly which channel it needs, and each "Configure" button takes the user to that channel's setup page and back.

#### Setup checklist

Show a "Set up Cowork" card on the Cowork home until the required items are done. It can be dismissed and reopened from settings.

| # | Item | Required? | Status values |
| --- | --- | --- | --- |
| 1 | Connect email | Required | Not set up · Ready · Needs attention |
| 2 | Connect WhatsApp | Recommended | Not set up · Waiting for Meta · Waiting for payment method · Ready · Needs attention |
| 3 | LinkedIn Outreach team | Optional | Not set up · Ready (N recruiters) |
| 4 | Calendar for interviews | Recommended | Not set up · Ready |
| 5 | Credits and budget | Pre-filled | Ready (shows balance) |
| 6 | Send a test to yourself | Required | Not done · Done |

Each row has one button, "Configure". It opens `#/settings/channels/<channel>?return=cowork` and, when the channel is ready, comes back to the checklist with the row ticked.

#### Agent readiness

Every agent card shows either "Ready" or "Needs: <channel>", with a Configure button. Put this matrix in `CX_AGENT_NEEDS`:

| Agent | Needs | Works without it by |
| --- | --- | --- |
| Talent Discovery | Nothing for intake and ranking; screening uses the channel the reply came in | — |
| Outreach | Email or WhatsApp (both is best) | Email only when WhatsApp is missing; WhatsApp chip disabled with the reason |
| LinkedIn Outreach | At least 1 active recruiter with a LinkedIn profile and weekly capacity > 0 | Agent stays off; Talent Discovery picks with URLs are listed for manual work |
| Interviews | Calendar, plus email or WhatsApp | Recruiter enters slots by hand |
| Delivery Guardian | Email (client contacts); email or WhatsApp (candidates) | Tasks for the owner instead of messages |
| Revenue & Redeploy | Nothing internal; email for client reminders | Tasks for the owner |

**Rule:** an agent never starts a step on a channel that isn't ready. It uses the fallback and says so in the run log ("WhatsApp not connected, sent email"). With no fallback, it creates a task. This is enforced in the same place as the caps, and tested.

#### Email setup page

Two plain options on one page:

**A. Connect your work mailbox** (each recruiter; the default)
- Google Workspace or Gmail through OAuth.
  - Scopes: send, plus read for reply detection.
  - Production notes: Gmail API send; replies via Pub/Sub `watch` with `history.list` fallback; refresh the watch before it expires.
- Microsoft 365 through OAuth.
  - Production notes: Graph `sendMail`; replies via change-notification subscriptions, renewed before expiry; delta query fallback.
- Messages go out from the recruiter's own address, and replies land in UNI Box on the right thread.
- A daily send limit per mailbox (default 150, editable), below the provider's limits. Over the limit, the step waits for the next day.

**B. Bulk sending domain** (optional; for campaigns larger than the mailbox limits)
- Use a subdomain (for example `talent.youragency.com`), so the main domain's reputation is protected.
- Show the DNS records to copy, one per row with a Copy button: SPF include, DKIM CNAMEs, DMARC (start at `p=none`), return-path.
- A "Check DNS" button shows green, amber or red per record, with a one-line fix.
- Every bulk email carries one-click unsubscribe headers (`List-Unsubscribe` and `List-Unsubscribe-Post`), as Gmail and Yahoo require for bulk senders.
- Bounces and complaints go to suppression automatically.
- Production note: pick one transactional provider (for example Amazon SES) behind an adapter.

**Ready when:** at least one mailbox is connected, a test email to yourself arrives, and a test reply is detected.

#### WhatsApp setup page (Cloud API)

Production model: Oontu is a **Meta Tech Provider**. The prerequisites are Oontu's own work, done once, not the tenant's:
- Meta business verification for Oontu;
- an app with `whatsapp_business_messaging` and `whatsapp_business_management`;
- Tech Provider onboarding completed.

Write this in the production notes and the report.

Tenant flow, in plain steps on the page:
1. **Connect WhatsApp.** The button launches Meta's Embedded Signup in a popup. The tenant:
   - signs in with Facebook;
   - picks or creates their business portfolio;
   - creates the WhatsApp Business Account;
   - adds a phone number and verifies it by code;
   - sets the display name.
2. **Oontu backend** (production notes):
   - exchange the returned code for a business token, server to server;
   - subscribe the app to the account's webhooks;
   - register the phone number;
   - store the account id and phone number id.

   Tokens are stored encrypted, never shown in the UI.
3. **Add a payment method in Meta.** With the Tech Provider model, the tenant pays Meta for WhatsApp messages directly. Show this step with a link and its status, and explain it in one sentence.
4. **Starter templates.** One click submits Oontu's starter pack for approval, in English, Hindi and Gujarati:
   - first touch per segment;
   - consent request;
   - interview confirmation and reminder;
   - joining-day check;
   - document request.

   Show each template's status (Pending / Approved / Rejected, with the reason) and a "Fix and resubmit" button.
5. **Health.** Show the number's quality rating and messaging limit in plain words: "You can start up to 250 new conversations a day".
6. **Test.** Send a test template to your own number.

**Webhooks:**
- verify `X-Hub-Signature-256` on every call;
- delivery receipts drive `cxSettle`;
- inbound messages go to UNI Box;
- the 24-hour window is tracked per candidate.

**Consent:**
- WhatsApp opt-in is stored per candidate, with its source (form checkbox, candidate-started chat, recorded verbal consent with recruiter name and date).
- Marketing-category templates only go to people with opt-in.
- An opt-out wins immediately.

**Credits and Meta billing.** Add `CX_WA_BILLING` with two values:

| Value | Who pays Meta | `wa-template` charge |
| --- | --- | --- |
| `meta-direct` (default for new tenants) | Tenant pays Meta directly | 1 credit, Oontu's handling only |
| `oontu-resell` (only if Oontu later becomes a Solution Partner with a credit line) | Oontu | Meta's rate plus margin |

The seeded demo workspace uses `oontu-resell`, so the doc's example numbers stay exact. The report states this.

**Ready when:** a phone number is registered, a payment method is added, at least one starter template is approved, and the test is delivered.

In the prototype, simulate every step with fixtures, including a rejected template and a "waiting for Meta" state. Under `CX_SWITCH`, the WhatsApp Web linked-device lane is not offered to agents. Person-sent WhatsApp from a recruiter's own phone stays available as click-to-chat (`wa.me`) only.

#### LinkedIn Outreach team page

- **One row per recruiter:**
  - their own LinkedIn profile URL;
  - account type (Free / Premium / Sales Navigator / Recruiter);
  - weekly capacity;
  - helper extension status (installed or not; it only opens profiles and copies text);
  - an Active toggle.
- **Multiple accounts:** as many rows as recruiters. Each recruiter works from their own account in their own browser.
- **Suggested weekly capacity by account type:** Free 30, Premium 50, Sales Navigator 60, Recruiter 80. Always editable, with the hint "What this person can do by hand in a week".
- **Optional "Verify with LinkedIn"** uses Sign In with LinkedIn (OpenID Connect, free and self-serve) to confirm the account belongs to that recruiter and fill name and photo. No other LinkedIn API is used.
- **Never asked for or stored:** passwords, cookies, session tokens, proxies.
- **Do not copy the automation tools' setup** (Waalaxy, Skylead, Expandi, HeyReach and similar). Their setup runs the recruiter's LinkedIn session on a cloud server with a dedicated IP per account, and paces actions to look human. That is the evasion this file forbids (§0, rule 4). Oontu's LinkedIn setup stays: profile URL, account type, weekly capacity, optional "Verify with LinkedIn", helper extension that only opens and copies.
- **Ready when:** at least one active recruiter has capacity greater than 0.

#### Calendar page

- Connect Google Calendar or Microsoft 365 Calendar per interviewer or recruiter (OAuth; free/busy plus create events).
- Without a calendar, Interviews uses manually entered slots.

#### Spec `tests/cx-setup.spec.js`

- A new tenant sees the checklist.
- Each Configure button opens the right page and returns to the checklist ticked when ready.
- Outreach falls back to email when WhatsApp isn't ready, and logs why.
- LinkedIn Outreach stays off with no active recruiter.
- A rejected template shows its reason and can be resubmitted.
- Webhook calls with a bad signature are refused.
- A delivery receipt settles the reserved credits.
- A missing payment method keeps WhatsApp at "Waiting for payment method".
- The LinkedIn page has no password, cookie or proxy fields.
- `meta-direct` charges 1 credit per template; the demo workspace keeps 2.

### Phase C2 — Talent Discovery: intake and evidence-based matching

**Intake (wraps `jdParseText`).** Output a versioned `JOB_CRITERIA[jobId]` with this shape:

```js
{ version, mustHave:[{skill, minYears?}], required:[], preferred:[], expMin, expMax,
  location, workMode, payBand:{min,max,currency}, noticeMaxDays,
  questions:[{id, text, criterionId, type:'yesno'|'number'|'choice'|'text'}],
  clientQuestions:[ 'Is Kafka a must-have or a nice-to-have?' ], family }
```

- The recruiter sees the criteria as editable chips and confirms them. Autonomy level is "suggest".
- A version is saved on confirm. Ranking always uses the confirmed version and shows "Criteria v3".
- Charge `ai-strong` once per intake.

**Job-family playbooks.** Seed 6 families:
1. Java backend;
2. Frontend;
3. Inside sales;
4. Accounts / finance;
5. Staff nurse;
6. Customer support.

Each family has:
- a skills dictionary with synonyms (extend `SKILL_ADJACENCY`);
- must-have patterns;
- 6–8 screening questions;
- 3 message templates per segment.

Intake picks the family; recruiters can change it.

**Evidence fit (new `MATCH_MODEL = 'evidence'` under CX).**
- **Per criterion:** status `met | partly | not-met | unknown`, an evidence snippet, and its source (`cv`, `answer`, `profile`, `history`). Source weights for confidence: answer 1.0, CV 0.9, history 0.7, profile field 0.5.
- **Fit (0–100):** reuse the weights in `FIT_WEIGHTS` (required 60, preferred 15, experience 25). Must-haves are a gate, not a weight.
- **Confidence:** High when ≥70% of weighted criteria are backed by `cv` or `answer`; Medium at 40–69%; Low below 40%.
- **Likelihood to respond (0–100), separate from fit.** Inputs:
  - days since last activity;
  - past reply rate;
  - channel that worked before;
  - notice period;
  - contacts in the last 30 days.

  It only orders the list.
- **The gate:** fit ≥ threshold (`CA_FIELDS` default 70) AND no must-have `not-met` AND confidence ≥ Medium. Unknown must-haves become screening questions.
- **Exclusions:** keep the existing rules (placed in 90 days, contacted in 14 days, caps). Record a reason for every excluded person.

**Pick card UI** (clean, scannable):
- name;
- fit % with a confidence chip (High / Medium / Low);
- likelihood (Likely / Maybe / Unlikely);
- "Why": the 3 strongest evidence lines;
- "Missing": unknown must-haves, shown as "will ask";
- the segment label.

The full criteria table opens on click.

**Per-client learning:**
- Store every shortlist accept or reject, and every client rejection reason, picked from a short list plus free text.
- Adjust that client's criterion weights by at most ±10 points.
- Show "Adjusted for <client>: more weight on cloud experience (3 rejections said 'not enough cloud')".

**Evaluation fixtures** in `tests/fixtures/cx-match/`:
- 3 jobs (Java backend, inside sales, staff nurse);
- 40 candidates each, labelled relevant / not relevant, including traps:
  - a keyword-stuffed profile that fails a must-have;
  - an adjacent-skill strong fit;
  - stale contact data.

**Spec `tests/cx-match.spec.js`:**
- precision@10 ≥ 0.8 on each fixture job;
- zero must-have violations in the top 10;
- the keyword-stuffed trap is excluded with the reason "must-have not met";
- confidence and likelihood are present and independent (changing activity dates changes likelihood, not fit);
- intake is charged once;
- criteria versions are stored and shown.

Also compare against the old `computeJobMatchPct` on the same fixtures and record both results in the report.

### Phase C3 — Outreach playbook and the Simple Campaign Builder

#### C3a. Outreach playbook (default behaviour)

**Segments** are computed from the record, never guessed by AI:

| Segment | Rule |
| --- | --- |
| Active | Applied or updated profile in 30 days, or said "looking" |
| Passive known | In pool, employed, no activity in 30 days |
| Past placement | Placed before, guarantee over |
| Silver medalist | Reached final round or offer before |
| New | No history; from a permitted outside source |

**Default steps per segment.** Touches 2 and 3 go only if there is no reply:

| Segment | Touch 1 | Touch 2 | Touch 3 |
| --- | --- | --- | --- |
| Active | WhatsApp template within 1 h of publish, in working hours, only if WhatsApp consent is held; else email | Email after 2 days | WhatsApp after 7 days |
| Passive known | Email Tue–Thu morning | WhatsApp after 3 days if consented | LinkedIn Outreach task after 7 days if URL held |
| Past placement | WhatsApp from the recruiter who placed them | Call task for that recruiter | — |
| Silver medalist | Email from the original recruiter | WhatsApp after 3 days | — |
| New | Email with consent request | One follow-up after 4 days | — |

**Caps and limits:**
- The weekly cap is 2 messages per candidate across Outreach and LinkedIn Outreach.
- Quiet hours and suppression are always enforced.
- A step that would break the cap moves to the next allowed day. It is never dropped silently.

**Message rules**, enforced in the composer:
- relevance (one or two specifics about this person);
- specificity (role, pay band, location, work mode);
- one easy ask (Yes / Not now / No);
- real sender name and opt-out;
- no fake urgency; the honesty check passes.

Languages: English, Hindi, Gujarati.

**A/B testing:** up to 2 variants per step. Winner promoted after ≥ 50 sends per variant on interested rate (not opens). The loser is retired, with a log line.

**Reply outcomes:** interested → screening (C5); not now → ask when, set a nurture date; no → stop; opt-out → suppression immediately; no reply after the last touch → stop, re-eligible in 90 days.

#### C3b. Simple Campaign Builder (for tenants with no tech background)

This is the default way to create a campaign under `CX_SWITCH`. It lives on the Campaigns screen and reuses `CP_PLAYS` underneath. Workflow Studio stays available behind an "Advanced" link for power users.

**Who it's for:** a recruiter or agency owner who has never configured software. **Target:** build and start a campaign in under 2 minutes, without reading help.

**Every campaign is fully customisable.** The recommended steps are a starting point, never a lock.

- **Three ways to start:**
  - "Use recommended steps";
  - "Start blank";
  - "Use a saved campaign" (my own, my team's or the workspace's).
- **Everything is editable:** audience, number of steps, channel per step, wait per step, message per step, language, stop rules, working hours, sender.
- **Save as template**, with three choices: "Just me", "My team", "Everyone in the workspace". Admins can mark one template per use case as the workspace default.
- **Start automatically when…**, an optional plain-language trigger:
  - a job is published;
  - someone applies;
  - a candidate is added to a list;
  - an interview is booked;
  - an offer is released;
  - a contractor's assignment ends in 30 days.
- **Conditions, in plain words**, chosen from a dropdown on any step:
  - "Only if they haven't replied";
  - "Only if they said Interested";
  - "Only if we have WhatsApp consent";
  - "Only if they haven't applied";
  - "Only for Active / Passive / Past placement / Silver medalist / New".
- **Branches** ("If they say Not now, ask again in 30 days") are in the simple builder as one optional card type. Anything more complex opens in Workflow Studio, which runs the same agents and credits.
- **Per-user defaults:** each recruiter can set their own default sender, working hours, language and signature. A campaign uses the recruiter's defaults unless changed.
- **Guardrails stay automatic** on custom campaigns: caps, quiet hours, consent, opt-outs, the honesty check and LinkedIn rules. A custom step that breaks one is fixed or blocked, with a one-line reason. Customisation can never switch them off.

**Flow: 3 steps on one page**, with a step indicator: 1 Who → 2 Steps → 3 Review & start.

1. **Who**
   - Pick a job (search box), or a saved list, or "Talent Discovery's picks for this job".
   - Show the count in one line: "38 people will get this. 12 are left out (why?)". "Why?" opens a short list of reasons: must-have not met, contacted recently, opted out, no consent for WhatsApp.
2. **Steps.** A vertical list of step cards, read top to bottom like a story. Each card is one sentence built from three controls:
   - **When:** "Right away" / "If no reply after [2] [days ▾]". A stepper plus hours/days.
   - **Channel:** icon chips, WhatsApp / Email / LinkedIn task / Call task. A chip is disabled with a plain reason when it can't work, for example "WhatsApp needs consent from 9 of 38 people. They'll get email instead".
   - **Message:** opens the message editor.
   - **The sentence the card reads:** "If no reply after 2 days, send an Email."
   - **Card actions:** "+ Add step" between cards; drag handle to reorder; duplicate; delete with an Undo toast (8 s).
   - **Start fast:** "Use recommended steps" fills the C3a playbook for the job's segments in one click.
   - **Toggles, plain words, on by default:**
     - "Stop for anyone who replies";
     - "Stop for anyone who applies";
     - "Only send in working hours (9:00–19:00)".
3. **Review & start**
   - Preview for 3 real people from the audience, with personalisation filled in.
   - Credit estimate: "About 180 credits (₹180). Your balance: 19,534".
   - Automatic fixes, explained in one line each. For example: "Step 3 moved to day 7 to keep to 2 messages a week."
   - One primary button: **Start campaign**. A secondary option: "Save as draft".

**Message editor:**
- A plain text box with a live preview beside it, using a real candidate. Switch between preview people with arrows.
- Personalisation by clicking chips (First name, Job title, Company, Pay band, Location, Recruiter name). Never by typing braces.
- Language picker (English / Hindi / Gujarati).
- AI buttons: "Shorter", "Friendlier", "More formal", "Translate". Each button shows its credit cost before use (`ai-small` = 1) and charges the wallet.
- The honesty check runs as you type and shows plain-language warnings, for example: "Remove 'only 2 hours left'. We don't use pressure lines."
- **WhatsApp outside the 24-hour window:** the editor switches to template mode automatically. The user picks an approved template, fills its variables with chips, and sees the explanation "WhatsApp only allows approved templates for first messages".

**While running:**
- The campaign page shows each step card with plain numbers: Sent · Replied · Interested.
- Big Pause / Resume button.
- Editing a running campaign changes only messages not yet sent, and says so.

**Words to use and avoid:** use "steps", "wait", "message", "people", "replied". Never show "sequence", "cadence", "node", "trigger", "webhook", "payload" or "regex" in this builder.

**Spec `tests/cx-campaign-builder.spec.js`:**
- a scripted new user creates a 3-step campaign in ≤ 12 clicks;
- "Use recommended steps" fills the playbook;
- the cap fix moves a step;
- the WhatsApp consent fallback switches to email;
- personalisation chips render in the preview;
- the AI "Shorter" button debits 1 credit;
- the honesty warning appears for fake urgency;
- Pause stops pending sends;
- the undo toast restores a deleted step;
- the forbidden words above don't appear in the builder DOM;
- "Start blank" builds a 2-step custom campaign; "Save as template" for "My team" makes it appear for a teammate and not for another team;
- a trigger ("someone applies") starts the campaign for a new applicant;
- the condition "Only if we have WhatsApp consent" skips people without consent;
- a recruiter's own default sender and working hours are used unless changed;
- a custom step that breaks the weekly cap is moved, with the reason shown.

### Phase C4 — LinkedIn Outreach agent (recruiter-assisted)

**Retire the automation under `CX_SWITCH`:**
- `LI_PLATFORM` warm-up / pacing / rotation and `LI_SENDER_PROFILES` GoLogin and proxy data are not read.
- Their settings UI is hidden.
- In `CA_ACTIONS`, the linkedin steps "visit" and "invite" change from `auto` to `person` tasks.
- `CA_DOES` linkedin becomes: "Prepares a daily LinkedIn queue for each recruiter: who to contact, why, and the note to send."
- The extension may only open a profile and copy text. It performs no clicks or sends.

**Data:**

```js
LI_CAPACITY = { [recruiterId]: { weekly: 60, used: 0, weekStart } }   // seed: Jaydeep 50, Suresh 60, Prakash 30
LI_OWNER    = { [candidateId]: { recruiterId, since, firstContactAt } } // set on first LinkedIn contact
LI_TASKS    = [ { id, candidateId, jobId, recruiterId, type:'connect'|'message'|'follow-up',
                  note, message, dueDate, status:'queued'|'sent'|'skipped'|'accepted'|'replied'|'waiting-capacity' } ]
```

**Assignment (`cxLiAssign`):**
1. If `LI_OWNER` exists for the candidate, assign to the owner, always. Hand-over happens only through the existing hand-over flow, which moves `LI_OWNER`.
2. Otherwise, score recruiters with remaining capacity: own client +3, skill overlap with their last 20 placements +0–2, lower utilisation first.
3. Never exceed weekly capacity. Overflow becomes `waiting-capacity`, with the date capacity resets.

The weekly contact cap is shared with Outreach.

**Preparation.** `li-task` costs 2 credits per task:
- dedupe;
- the evidence match from C2 with the 70% gate;
- "why they fit" in one line;
- a connection note under 300 characters;
- a first message;
- the best follow-up day.

**Daily queue UI** ("Today's LinkedIn" in each recruiter's Cowork home):
- Header: "18 to do today · 32 of 60 used this week".
- One card per person: name, fit, the why-line, then "Open profile" (opens the URL in a new tab), "Copy note", "Mark sent" or "Skip".
- After sending: "Accepted?" and "Replied?" buttons. "Replied" opens a paste box that posts the text into UNI Box on that candidate's thread and runs C5 screening.
- Admins edit each recruiter's weekly capacity in Cowork settings: a simple number per person, with the hint "Set what this person can do by hand in a week".

**UNI Box thread key.** The existing key is `uniBoxThreadKey(c) = candidateId-workflowId`. Under CX, use `candidateId-jobId`, so every channel for one job is one conversation. Keep the old key readable for existing threads.

**Spec `tests/cx-linkedin.spec.js`:**
- the owner always gets follow-ups;
- a new person never pushes a recruiter over capacity;
- overflow becomes `waiting-capacity`;
- the shared weekly cap blocks a LinkedIn task if Outreach already sent 2 that week;
- GoLogin and proxy settings are hidden and unread with CX on;
- no automated click or send functions are callable from the queue;
- the pasted reply lands in the right UNI Box thread and triggers screening;
- each prepared task debits 2 credits.

### Phase C5 — Talent Discovery screening step (replies → prospects)

**Trigger:** any inbound reply on a job thread (simulated WhatsApp, email, or a LinkedIn reply pasted in UNI Box).

**Intent:**
- Rules first: keywords in English, Hindi and Gujarati, plus button replies.
- Then `cxAI('small','intent')` with a confidence score.
- Labels: interested, not-now, no, opt-out, question, unclear.
- Opt-out → suppression immediately, before any other processing.

**Conversation:**
- One question per message, in the channel and language the person replied in.
- The order:
  1. interest (if unclear);
  2. unknown must-haves (from C2);
  3. notice and availability;
  4. expected pay band (where allowed by workspace setting);
  5. location and work mode;
  6. consent to share the CV with the client.
- Free-form messages inside the WhatsApp 24-hour window cost `wa-window`. Outside it, the agent stops and creates a task. It never sends a template mid-screening without a person.

**Parsing:**
- Rules first: numbers, yes/no, choices. Free text goes to `cxAI('small','extract')`.
- Confidence < 0.7, or any ambiguity, goes to UNI Box "Needs you", with the suggested reading pre-filled.

**Outcome:**
- **Qualified and interested:** create the prospect on the job, with a summary (`ai-medium`), their answers, the evidence table and the consent flag. Notify the job owner.
- **Not a fit:** a *suggestion* to the recruiter, who confirms. The agent sends nothing negative itself.

**Corporate:** the same flow for vendor-submitted candidates, after consent. Own pool and silver medalists run first in the direct sourcing window (G5, if present).

**Spec `tests/cx-screening.spec.js`:**
- an opt-out is suppressed before anything else;
- one question per message;
- unknown must-haves are asked first;
- low confidence goes to "Needs you";
- a qualified person becomes a prospect with summary and consent;
- no auto-rejection message is ever sent;
- out-of-window replies create a task instead of a send;
- credits are charged per the rates.

### Phase C6 — Delivery Guardian (grows Offer & Joining)

Extend the `offers-joining` agent and its `CA_ACTIONS` into `delivery-guardian`. Keep `offers-joining` as an alias.

Every timing is a per-client setting, with these defaults:

| Stage | Watches for | Does automatically | Asks a person when |
| --- | --- | --- | --- |
| Profile sent | No client feedback in 48 h | Email the client contact with one-click shortlist / reject / hold; tell the candidate their profile is with the client | 96 h without feedback: task for the account owner |
| Interview booked | Not confirmed | Confirmations; reminders 24 h and 2 h before (safety-critical) | Not confirmed 4 h before: call task |
| Interview passed | No attendance mark or feedback | Ask candidate "how did it go?"; chase interviewer | No-show: offer 3 new slots once, then recruiter task |
| Offer released | Not accepted in window; risk signals (notice > 60 days, competing interviews mentioned, low engagement) | Offer summary; answer routine questions; risk score | Risk High: recruiter call + 3 backups from the same job (existing rule) |
| Notice period | Silence, reluctance, resignation not confirmed | Weekly check-in; resignation confirmation; document checklist | Any negative signal: recruiter call within 24 h |
| Joining day | Not confirmed by evening | Day-before and morning messages to candidate and client (safety-critical) | Not joined: dropout flow, backups, client informed |
| Guarantee | Disengagement, early exit | Check-ins day 7, 30, 60, 90 (or the guarantee length) | Exit risk: recruiter call; replacement job opened if they leave |
| Contract assignment | Timesheets, end date | Hand over to Revenue & Redeploy | — |

**Rules:**
- **One owner per alert:** the submission owner, then the job recruiter, then the team lead.
- **Every alert says why it fired** and links to the record. Dismiss-with-reason adjusts that client's threshold (for example a 48 h SLA becomes 72 h after 3 "client always slow" dismissals), shown in settings.
- **Never:** offer changes, rejections, or Joined without both sides.

**UI:** a "Live hires" board with one row per live submission. Columns: stage, days in stage, next action, risk, owner. Red, amber and green come only from rules, with a tooltip saying why.

**Spec `tests/cx-guardian.spec.js`:**
- each stage timer fires once;
- safety-critical reminders run on a near-empty wallet;
- the alert owner chain works;
- dismiss-with-reason changes the threshold;
- 3 backups are created on high risk;
- there is no auto-Joined.

### Phase C7 — Revenue & Redeploy, and Kairo as manager

**Revenue & Redeploy:**
- If the G3 and G4 blocks exist, wrap them as this agent's steps.
- If not, build the minimum:
  - placements joined but not invoiced (> 7 days);
  - missing timesheets for contract staff (> 2 days past period end);
  - overdue invoices (> due date);
  - assignments ending in 30 days, which send the contractor to Talent Discovery as a redeploy candidate for open jobs, and suggest extend or convert to the client (corporate: extend / convert decision).
- Each item shows the ₹ at risk, and is counted as "money recovered" when resolved.

**Kairo manager** (extend `kairoRespond`, keep old intents). New intents:
- "what's stuck today" → Guardian and Revenue items by owner;
- "start sourcing for job 42" → C2 intake then ranking (confirm first);
- "why did Guardian flag <name>" → the alert's reason;
- "credits for job 42" / "credits this month by agent" → C1 numbers;
- "pause campaign <name>".

Any action that contacts someone or changes records asks for confirmation in the chat.

**Spec `tests/cx-kairo-revenue.spec.js`:** each intent returns the right data; confirmation is required for actions; money-at-risk totals reconcile with records.

### Phase C8 — Retire Engagement's name, migration, clean offer

- The UI shows the six agents in the order in §2. "Engagement" no longer appears with `CX_SWITCH` on, but old ids resolve through aliases. Existing workflows referencing engagement steps are mapped to their new owners, with a one-time migration log.
- The agents page shows one line each, saying what the agent does and what it costs: "Uses credits from your wallet".
- Workflow Studio and the Campaigns plays call agents through the same credit path.

**Spec `tests/cx-migration.spec.js`:**
- old workflows still run, with steps landing on the new owners;
- no "Engagement" text appears with CX on;
- with CX off, everything is exactly as before;
- the `CX_OWNERSHIP` test passes (every stage exactly one owner).

### Phase C9 — UX polish pass

Apply §6 to every CX screen:
- the Set up Cowork checklist and the email, WhatsApp, LinkedIn team and calendar setup pages;
- Credits;
- pick cards;
- Simple Campaign Builder;
- the LinkedIn queue;
- the screening "Needs you" view;
- Live hires;
- Kairo answers;
- the agents page.

Take Playwright screenshots of each screen at 1440×900 and at 375×812 into `cx-screens/`, and look at every one yourself. Fix anything that breaks §6 before moving on.

### Phase C10 — Final audit and report

1. Run the full suite with `CX_SWITCH` off and on. K4 rule as in §0.
2. Re-run the fixture evaluation and the campaign-builder click-count test.
3. Re-read this file top to bottom and tick every "Spec" line. Anything not met goes in the report as open, with the reason.
4. Search the file for forbidden LinkedIn automation calls being reachable with CX on. The result must be none.
5. Write the final report (§9).

---

## 5. Decisions already made (do not ask)

| # | Decision | Apply |
| --- | --- | --- |
| E1 | Credit price | ₹1 per credit in India; rates as in C1, kept in `CX_RATES` |
| E2 | Existing subscribers | Monthly price converted to credits; nobody pays more |
| E3 | Automated LinkedIn mode | Retired; LinkedIn Outreach is the assisted queue |
| E4 | Engagement | Split across Outreach, Talent Discovery (screening), Delivery Guardian |
| E5 | Follow-up timings | As in C3a; per-client overrides allowed |
| E6 | Voice screening | Not in this task; `voice-min` rate stays disabled |
| E7 | LinkedIn partner programme | Business task, not code; mention in report only |

---

## 6. UI and UX standard (every CX screen)

Clean, minimalist, smooth and understandable by someone with no technical background.

- **One primary action per screen**, visually obvious. Secondary actions are quieter (text buttons or a "More" menu).
- **Use the prototype's existing design tokens** (colours, font, radius, shadows). Do not introduce a new style system.
- **Spacing and type:** 8 px spacing grid. At most 2 font sizes and 2 weights per card. Generous white space; no dense borders.
- **Plain words.** Say what will happen ("Send an email if they don't reply in 2 days"), not system terms. Numbers carry units: "2 days", "₹180", "180 credits".
- **Every empty state has one sentence and one button**, for example "No campaigns yet. Start one in 2 minutes. [New campaign]".
- **Errors and warnings** sit next to the thing they concern, say what to do, and never block silently.
- **Destructive actions** use an Undo toast (8 s) instead of a confirm dialog, except for sends to people. No stacked modals.
- **Motion:** 150–200 ms ease for appearing rows and panels; nothing bounces; respect `prefers-reduced-motion`.
- **Loading:** skeleton rows, never blank screens or spinners longer than 300 ms without a skeleton.
- **Accessibility:**
  - keyboard reachable;
  - visible focus;
  - labels on every control;
  - contrast ≥ 4.5:1;
  - status never shown by colour alone (an icon or word too).
- **Responsive:** works at 375 px width; tables become stacked cards on mobile.
- **Credits are always visible where they're spent:** a small "≈ N credits" next to any button that spends, and the balance in the Cowork header.

---

## 7. Technical standards

- **One block per phase:** `cx-credits`, `cx-setup`, `cx-match`, `cx-outreach`, `cx-campaign-builder`, `cx-linkedin`, `cx-screening`, `cx-guardian`, `cx-revenue-kairo`, `cx-migration`. Each block starts with a header comment: purpose, functions it wraps, switch, production notes.
- **Wrap, don't edit.** Keep the original function as `_orig_<name>`, and call it when `CX_SWITCH` is off.
- **All sends go through the ledger and the caps.** A test fails the build if any CX path sends without `cxReserve`.
- **`cxAI` adapter.** Signature `cxAI(tier, task, input)` returns `{output, confidence, credits}`. The simulated implementation is deterministic. Production notes cover:
  - tier routing (rules → small → medium → strong);
  - prompt caching;
  - batch for non-urgent work;
  - a per-tenant budget check before every call.
- **Idempotency:** every inbound event (reply, delivery receipt) carries an id. Processing the same id twice changes nothing.
- **Time:** all timers go through one clock helper, so tests can fast-forward. Store times in UTC and show them in workspace time (IST default).
- **Data protection:**
  - consent flags are checked before WhatsApp and before sharing a CV;
  - an opt-out wins over everything;
  - nothing personal goes into logs beyond ids.
- **Performance:** the live ledger renders 1,000 rows smoothly (virtualise beyond 200). A pick ranking of 1,000 candidates finishes in < 300 ms in the prototype.
- **Production notes** go in comments, not code. Mention:
  - Postgres tables matching C1;
  - the ledger as append-only with a balance view;
  - Meta WhatsApp Cloud API with signed webhooks and delivery receipts driving `cxSettle`;
  - Gmail push (Pub/Sub) with `history.list` fallback for email replies.

---

## 8. Progress page (visual tracking)

Create and keep updating `cx-progress.html` (self-contained, opens in a browser). Update it after every phase. It shows:
- **Each phase C0–C10, including C1b:** status (not started / building / testing / done / isolated), start and end time, specs passed / total.
- **Live counters:** tests passing, fixture precision@10 per job, campaign-builder click count, seed ledger check (466 / 19,534).
- **Decision log** (latest first) and **issues isolated** behind sub-switches.
- **Thumbnails** of the screenshots from `cx-screens/`.

---

## 9. Final report

Write `CX-REPORT.md` at the end. It contains:

1. **Summary:** what is live under `CX_SWITCH`, in 5–8 lines.
2. **Phase table:** status, specs, notes.
3. **Before and after:**
   - matching: old `computeJobMatchPct` vs evidence model on fixtures (precision@10, must-have violations);
   - pricing: five subscriptions vs one wallet (seed example);
   - LinkedIn: automated vs assisted (what's switched off).
4. **Product bar results** (§1 table): each with its measured number.
5. **How to try it:** open the prototype with `?cx=1`, then an 11-step walkthrough:
   1. Set up Cowork checklist as a new tenant (email, WhatsApp, LinkedIn team, calendar);
   2. Credits screen;
   3. job 42 picks;
   4. a new campaign with recommended steps;
   5. the LinkedIn queue for Suresh;
   6. a pasted reply;
   7. screening;
   8. the prospect;
   9. Live hires;
   10. Kairo "what's stuck today";
   11. the impact view.
6. **Decision log:** every choice you made that this file didn't fix.
7. **Open items and risks**, including:
   - the WhatsApp Web lane;
   - the LinkedIn partner programme (E7);
   - real costs needed to finalise the rates;
   - anything isolated.
8. **Files changed or added.**

When the report is written and the suite is green, the task is done.
