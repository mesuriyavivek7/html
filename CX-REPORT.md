# Cowork v2 (CX) — final report

_Brief: `docs/OONTU-COWORK-AGENTS-PROMPT.md`. Branch `o2/overnight-2026-11-26`, one local commit per phase (`cx: …`). Nothing pushed. Date: 2026-11-28._

## 1. Summary

Everything below is behind `CX_SWITCH`, off by default. Turn it on with `?cx=1`, Settings › Cowork › Cowork v2, or the test runner (`-Cx`).

- **One credit wallet** for all agents:
  - no agent subscriptions and no per-LinkedIn-account fee;
  - an append-only live ledger;
  - budgets;
  - a safety reserve for reminders and joining checks;
  - the example day seeded exactly (466 credits, balance 19,534).
- **Set up Cowork:**
  - a checklist and channel pages for email, WhatsApp (Cloud API, Tech Provider flow), the LinkedIn team and calendar;
  - each agent card says Ready or "Needs: …";
  - one send path (`cxSend`) with fallbacks, consent and signed webhooks.
- **Six agents:**
  - **Talent Discovery:** versioned intake and an evidence-based match with a must-have gate, confidence and likelihood; plus screening of replies into prospects.
  - **Outreach:** a playbook per segment, a weekly cap of 2, and a Simple Campaign Builder (7 clicks to start a 3-step campaign).
  - **LinkedIn Outreach:** a recruiter-assisted daily queue; the automation is retired.
  - **Interviews:** the existing agent, kept.
  - **Delivery Guardian:** watches each hire from profile sent to the end of the guarantee.
  - **Revenue & Redeploy:** built on the G3/G4 work.
  - **Kairo** manages through chat intents and asks before acting.
- "Engagement" is gone from the screens with CX on; its steps moved to new owners, and old ids still resolve.
- CX off: the prototype behaves as before. Each phase's spec has a CX-off test, and the full suite runs green with CX off (§3).

## 2. Phase table

| Phase | Status | Spec | Notes |
| --- | --- | --- | --- |
| C0 Map the code | Done | — | `CX-AUDIT.md`; baseline 1,310/1,311 (the `demo-data` date seed, pre-existing) |
| C1 Credit wallet | Done | `cx-credits` 14/14 | Seed 466 / 19,534 exact; ₹ shown only to people with billing view |
| C1b Set up Cowork | Done | `cx-setup` 12/12 | Simulated OAuth, Embedded Signup, a rejected template, DNS check, webhooks |
| C2 Intake and matching | Done | `cx-match` 11/11 | Evidence p@10 1.0 / 1.0 / 1.0, 0 violations; 1,000 ranked in < 300 ms |
| C3 Outreach and Campaign Builder | Done | `cx-campaign-builder` 14/14 | 7 clicks measured |
| C4 LinkedIn Outreach | Done | `cx-linkedin` 9/9 | No `LI_PLATFORM` reads with CX on (counted) |
| C5 Screening | Done | `cx-screening` 9/9 | Checkpoint after C5: CX off 1,376/1,379; CX on green apart from known items |
| C6 Delivery Guardian | Done | `cx-guardian` 10/10 | Live hires board |
| C7 Revenue & Redeploy, Kairo | Done | `cx-kairo-revenue` 9/9 | Wraps G3 rules and G4 ranking |
| C8 Migration | Done | `cx-migration` 5/5 | 21 steps mapped, 13 stages owned |
| C9 UX polish | Done | regressions | 13 screens × 2 sizes in `cx-screens/`, each reviewed and fixed |
| C10 Final audit | Done | `cx-audit` 4/4 | Full suite: CX off 1,407 / 1,408 and CX on 1,407 / 1,408 — the one failure in both is the date-dependent `demo-data` seed (pre-existing) |

## 3. Before and after

**Matching** (fixtures: 3 jobs × 40 labelled candidates, shuffled the same way for both models):

| Job | Old `computeJobMatchPct` p@10 | Old must-have violations in top 10 | Evidence model p@10 | Evidence violations |
| --- | --- | --- | --- | --- |
| Java backend | 1.0 | 0 | 1.0 | 0 |
| Inside sales | 1.0 | 0 | 1.0 | 0 |
| Staff nurse | 0.9 | 1 | 1.0 | 0 |

- The keyword-stuffed trap (profile lists every skill, CV shows 0 years of the must-have):
  - the old model scores it 100%;
  - the evidence model excludes it as "must-have not met".
- The adjacent-skill fit is kept (for example Kotlin for Java).
- The stale-contact fit keeps a high fit with "Unlikely" to respond.

**Pricing** (seed example):

| Before | After |
| --- | --- |
| Five subscriptions: Talent Discovery ₹4,999; Engagement, Interviews, Offer & Joining ₹2,999 each; LinkedIn ₹1,999 per account | One wallet: the plan's 15,000 credits + a 5,000 top-up |
| The demo's subscribed agents cost ₹15,995 a month | The same ₹15,995 a month, now credits that any agent can spend (banner) |
| — | The example day spends 466 credits across six agents (393 / 62 / 8 / 2 / 1 / 0) |

**LinkedIn** (what is switched off with CX on):
- GoLogin profiles, proxies, warm-up, pacing and jitter, and rotation are not read (a read counter proves 0 reads).
- Automated visit, invite, follow-up and withdraw are not used.
- Account connection through GoLogin is refused.
- The infrastructure settings are hidden.
- What remains is a daily queue per recruiter (profile URL, account type, weekly capacity). A person opens the profile, copies the note and marks it sent.
- The helper extension only opens and copies.
- `cxLiAutomationReachable()` is empty.

## 4. Product bar results

| Bar | Measured |
| --- | --- |
| Accurate | precision@10 = 1.0 on all three fixture jobs; must-have violations in the top 10 = 0 |
| Systematic | 13 hire stages, each with exactly one owner (`CX_OWNERSHIP`, tested); every Guardian alert has one owner (submission owner → job recruiter → team lead), tested |
| Result-oriented | Impact view credits = the ledger (`cxSpent`, tested); money at risk reconciles with PayTrack records and becomes "recovered" on resolve (tested) |
| Simple | 7 clicks to build and start a 3-step campaign (limit 12); no "sequence / cadence / node / trigger / webhook / payload / regex" in the builder (tested) |
| Safe | Tested in each phase: weekly cap 2 (moved, never dropped), quiet hours, opt-out first, WhatsApp consent, the 24-hour window, the honesty check (including fake urgency), LinkedIn rules, the safety reserve, no automatic rejection, no automatic Joined |

## 5. How to try it

Open `recruitment-os-prototype.html?cx=1`, sign in with the prototype tools as the agency Owner, and go to Cowork.

1. **Set up Cowork as a new tenant.** In the browser console run `cxSetupNewTenant(); caRefresh()`. Then use the checklist on the Cowork page:
   - Configure email: connect Google, then "Send a test email to yourself".
   - Configure WhatsApp: number and code, "Meta finished", add a payment method, submit the starter pack, fix the rejected Gujarati template, send the test.
   - Configure the LinkedIn team: add a recruiter, profile link, account type, Active.
   - Configure the calendar; then "Send a test to yourself".
2. **Credits tab:** balance, reserved, spent, how long it lasts, bars by agent (click to filter), impact, live ledger, CSV, budgets.
3. **Job 42 picks.** Open Jobs › the Senior Java Developer job (job 42 resolves to it). In Talent Discovery choose "Read the job", confirm the criteria, and see the pick cards (fit, confidence, likelihood, why, will ask). Or ask Kairo "start sourcing for job 42".
4. **A new campaign:** Campaigns tab › New campaign › pick a job › Next › Use recommended steps › Next › Start campaign.
5. **The LinkedIn queue for Suresh:** Agents tab › "Today's LinkedIn" › choose Suresh.
6. **A pasted reply:** on a sent card choose "Replied?", paste "Yes, interested", then "Add to the conversation".
7. **Screening:** the reply starts screening, with one question at a time on the channel it came from; unclear readings appear in "Needs you".
8. **The prospect:** answer the questions (or run `cxOnInbound`); a qualified person becomes a prospect with a summary and consent.
9. **Live hires tab:** every live submission with stage, days, next action, risk in words and owner.
10. **Kairo:** "what's stuck today".
11. **Impact view:** Credits tab › Impact (influenced = the agent touched the person before the outcome).

## 6. Decision log

Also on `cx-progress.html`.

- **Baseline and gate**
  - `demo-data` › Vistaar fails from 2026-11-28 on old and new code alike: a date-dependent seed, outside CX.
  - A0–A9 / `AX_SWITCH` are not present; nothing depends on them.
- **Commits:** phase commits are on `o2/overnight-2026-11-26`, where the queue was already committing.
- **Regressions:** each phase ran targeted regressions with CX on and off; the full suite ran at C1, C5 and C10 (a full suite per phase, twice, would take about 25 hours).
- **Old specs whose subject CX retires**
  - `cowork-agents` is pinned to CX off (`// @cx-runner off`): it tests per-agent plans, trials and Add.
  - These tests run with CX off inside the test, assertions unchanged:
    - `settings`' trial test;
    - three `cowork` LinkedIn-automation tests;
    - `settings`' and `o2-nav-redirect`'s LinkedIn-infrastructure tests.
- **Wallet**
  - Seeded Cowork history is never charged.
  - ₹ is shown only to people with billing view.
- **Configure pages** open directly (the app router rewrites the address); deep links to `#/settings/channels/<channel>?return=cowork` still work.
- **Matching**
  - The fixtures are shuffled with a fixed order before both models rank.
  - A must-have listed only on the profile but missing from the CV counts as not met.
- **Campaigns**
  - The builder lives in Cowork › Campaigns; the agency has no Campaigns screen today.
  - A team is the recruiter's department.
  - The honesty check reads the message as written.
  - A step skipped for its condition keeps the next step's own wait.
- **LinkedIn send counting:** a LinkedIn send that a person marks is counted once in the weekly cap.
- **Revenue & Redeploy**
  - Job 42 resolves through `CX_JOB_ALIAS` to the Java backend job.
  - Revenue & Redeploy runs the G3 rules directly, whatever the RX switch.
- **Agent cards**
  - Cards keep `data-agent` with the old id and add `data-cx-agent`.
  - Revenue & Redeploy is its own card type.
- **Screenshots:** taken with headless Chrome, because Playwright is not installed.
- **Seed labels:** ledger action labels avoid "word (", which an older dead-handler check reads as a function call.

## 7. Open items and risks

- **WhatsApp Web (Lane A, linked device).**
  - It stays in the product for people's own one-to-one chats, but automating it would break WhatsApp's terms.
  - With CX on, agents never use it: they send through the Cloud API (simulated), and people use click-to-chat.
  - Recommendation: remove the agent path for Lane A entirely when CX becomes the default.
- **LinkedIn partner programme (E7):** a business task (Talent Solutions partnership); not code.
- **Real costs.** The credit rates are placeholders in `CX_RATES` and need final numbers:
  - Meta conversation prices per category and market;
  - email provider cost;
  - AI tier costs.
- **Isolated phases:** none.
- **Pre-existing mobile overflow:** at 375 px the app's top bar and cards overflow with CX off too. CX tables stack into labelled rows on phones, but the page frame needs a separate fix.
- **Not fully built, or built as a simpler version:**
  - **Job page credits:** a "Credits" section on the job page, not a separate tab.
  - **Live ledger:** pages in 200s ("Show more") rather than true virtual scrolling.
  - **"≈ N credits" next to spending buttons:** shown on the AI rewrite buttons and "Read the job"; not yet on every spending button.
  - **Corporate screening of vendor-submitted candidates:** not separately implemented. Company workspaces run the same screening once a reply arrives.
  - **Company Campaign plays (`CP_PLAYS`):** not yet routed through the credit path. Agency campaigns, workflows and agent sends all are.
  - **A/B testing:** an engine function (winner after 50 sends per variant); the builder does not yet offer a second variant per step.
  - **Playbook timing:** the "within 1 hour of publish" and "Tue–Thu morning" timings are recorded in the playbook. Sends follow working hours and the steps' waits, not those exact windows.
- **Production:** every simulated adapter carries production notes:
  - Gmail push with `history.list` fallback;
  - Graph subscriptions;
  - Meta Embedded Signup and signed webhooks;
  - an SES bulk domain;
  - Sign In with LinkedIn only;
  - Postgres tables for the wallet with an append-only ledger and a balance view.

## 8. Files changed or added

- `recruitment-os-prototype.html`: new blocks `cx-style`, `cx-credits`, `cx-setup`, `cx-match`, `cx-outreach`, `cx-campaign-builder`, `cx-linkedin`, `cx-screening`, `cx-guardian`, `cx-revenue-kairo`, `cx-migration`, `cx-polish` and `cx-audit`. Earlier blocks are not edited.
- **New specs:**
  - `tests/cx-credits.spec.js`, `cx-setup`, `cx-match`, `cx-campaign-builder`, `cx-linkedin`, `cx-screening`, `cx-guardian`, `cx-kairo-revenue`, `cx-migration`, `cx-audit`;
  - fixtures `tests/fixtures/cx-match/fixtures.js`.
- **Changed tests:**
  - `tests/run-auth-tests.ps1`: `-Cx`, `// @cx-runner on|off`, `// @fixture`.
  - `tests/cowork-agents.spec.js`: pinned to CX off.
  - `tests/settings.spec.js`, `tests/cowork.spec.js`, `tests/o2-nav-redirect.spec.js`: tests of retired behaviour run with CX off inside the test; assertions unchanged.
- **Docs and tools:**
  - `CX-AUDIT.md`, `CX-REPORT.md`, `cx-progress.html`;
  - `cx-screens/` (28 PNG);
  - `tools/cx-shots.ps1`;
  - `docs/OONTU-COWORK-AGENTS-PROMPT.md` (the brief);
  - `docs/O2-OVERNIGHT-STATE.md` (progress notes).
- **Backup:** `recruitment-os-prototype.before-cx.html`, local and excluded from git.
