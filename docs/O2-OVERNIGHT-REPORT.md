# O2 overnight build — report

_In progress. Written in full when the build finishes._

## 1. Outcome

- Branch `o2/overnight-2026-11-26`, started from `o2-step-0a`.

## 2. What you can see now

- **0a** Demo data survives a reload. Switch 0a · any login · sign-in screen › Prototype · simulated sign-in › O2 build › 0a on.
- **0b** Policy values in one place; MRR per currency from list prices; access level shown on each workspace. Switch 0b · Meera Krishnan · Platform overview › MRR card; Tenants › a tenant › Access level; Platform Settings › Policy values.
- **0c** Billing customer per account: invoices freeze the buyer details; market locked by the first invoice, changed only from the next renewal; tax identical. Switch 0c · Meera Krishnan (or Finance) · Accounts › Northstar Talent Partners › Billing customer card › Edit billing details / Change market.
- **0d** Only tax invoices (OON/…) are shown on platform screens; overdue follows the tax invoice; legacy plans say “Grandfathered — not for sale” and are not offered. Switch 0d · Meera Krishnan · Business & finance › Invoices and refunds (OON numbers); Plans (labels); Tenants › Create workspace (no legacy plans).
- **1a** The §5 menu (Home · Work · Customers · Service · Billing · Admin), old screen ids redirect, one access table, Home for platform operations. Switch 1a · any login · the sidebar; open an old link such as Tenants and land on Workspaces.
- **1b** One approvals inbox for everyone (Waiting for me · I asked · Decided by me · All) and a platform bell that opens the record. Switches 1a+1b · Arjun raises a 15% discount on a deal, then Kavya opens Work › Approvals (and the bell).
- **1c** Platform search: IDs first, then names, grouped and permission-filtered, with actions. Switch 1c · Meera · press Ctrl+K and type TCK-1001, an OON/ number, “Northstar” or a GSTIN.
- **2** Home: ranked attention queue, six KPIs per the definitions, four SVG charts (illustrative where no history), recent activity. Switches 0b, 1a, 1b, 2 · Meera Krishnan · Home.
- **3a** Workspace lifecycle commands with a second person for suspension, closing a suspended workspace and early archive; emergency path for Security; archive keeps a tombstone. Switches 1a, 3a · Meera Krishnan · Workspaces › a workspace › suspend (asks for approval).
- **3b** Workspaces list (cards, tabs, filters, ten columns) and Workspace 360 (eight tabs, danger zone); Account help actions run as commands. Switches 0b, 1a, 3a, 3b · Meera Krishnan · Workspaces › a row; Requests tab.
- **4a** Every subscription change is a command with an audit row and an event; subscriptions carry items and a change history. Switches 4a (+4c to see it) · Meera Krishnan · Subscriptions › a subscription › Change history.
- **4b** Subscription statuses (incomplete … canceled) with cancel at period end, cancel now (approval), downgrade at renewal, manual activation (approval); unpaid makes the workspace read-only and paying clears it. Switches 3a, 4a, 4b (+4c) · Meera Krishnan or Vikram · Subscriptions › a subscription › Cancel at period end.
- **4c** Billing screens: Invoices & payments, Plans & pricing, Tax & reports, and a Subscription page; no Mark paid outside Invoices & payments. Switches 1a, 4c · Vikram Shah · Billing › Invoices & payments; Billing › Subscriptions › a subscription.
- **4d** Payments and allocations: one bank credit across invoices, several payments to one invoice, partial payments, TDS with certificates, customer credit, reversals; suggestions are never applied without Finance. Switches 1a, 4c, 4d · Vikram Shah · Billing › Invoices & payments › Reconciliation.
- **5** Account 360 (rail, seven tabs, both renewals side by side), Pipeline tabs including Sign-ups, Reports with pipeline analytics. Switches 1a, 5 · Kavya Iyer or Meera · Customers › Accounts › Northstar; Customers › Pipeline › Sign-ups.
- **6** Six visible ticket states; Incidents with severity, flow, cadence reminder and review; Publish update makes an announcement. Switches 1a, 6 · Nisha Pillai or Meera · Service › Incidents › an incident › Publish update.
- **7a** Refused and failed commands and failed sign-ins are audited once, with who, outcome and reason. Switches 7a (+7c to browse) · log in as Arjun and try a Finance export; then Meera › Admin › Audit & security › Refusals.
- **7b** Second sign-in step for Oontu employees and step-up for high-risk actions after 15 minutes. Switch 7b · sign in as any Oontu employee; the code 246810 is shown in Prototype · simulated sign-in.
- **7c** People & access with teams, roles, access reviews; separation-of-duties checks; Audit & security with an approved export; policy changes signed by Security and Finance. Switches 1a, 7a, 7c · Dev Patel or Meera · Admin › People & access; Admin › Audit & security.
- **8a** Ops flags and plan entitlements with workspace overrides that end on their date; one availability check. Switches 1a, 3b, 8a · Meera · Admin › Product controls; Workspaces › a workspace › Entitlements.
- **8b** AI agents governance: allow-listed tools, daily limits, run log without content. Switches 1a, 8b · Meera · Admin › AI agents › Tools & policies / Activity.
- **9** End-to-end flows across the new screens with every step on; docs updated; removal candidates listed (nothing removed).

## 3. Blocked steps

None yet.

## 4. Decisions made for the owner

| Situation | Decision |
| --- | --- |
| Switch defaults | Off in code; tests turn them on. |
| Briefs location | Copied from `Downloads/` into `docs/` at start. |
| Internal workspaces | No seed is Oontu's own or a test workspace; all seeds internal:false. |
| Provisioning access level | Not in the §3.2 table; shown as Blocked (nobody signs in yet). |
| Policy data vs switch | Policy values and internal flags are always present; switches change only screens and code paths. |
| 0c wrap point | The brief says wrap bosTaxSegment; it receives a ready-made party, so bosTaxPartyOf (the one place the party is built) is wrapped instead. bosTaxSegment is untouched. |
| 0c snapshot hook | Several older paths issue invoices through a private function, so the buyer snapshot hooks pushes onto the invoice ledger after page load. |
| International currency | A billing customer outside India bills in USD (plans are priced in INR and USD only), even if the account lists another currency. |
| Demo tenant plan (0d) | Not moved: Northstar stays on Growth, labelled grandfathered. |
| Legacy plans in commands (0d) | Hidden from pickers only; commands still accept them so existing records and specs that use them keep working. |
| Overdue date (0d) | Tax invoices for subscriptions carry no due date today, so the internal row's due date is used when the tax invoice has none; settlement always comes from the tax invoice. |
| 1a merged screens | Until their own step, a new id that merges two screens shows both behind a small tab strip (Workspaces: All · Requests; Pipeline: Pipeline · Sign-ups); Approvals, Invoices and Tax open the old finance screen on the right tab. |
| 1a and bos-login.spec | The spec reads its screen lists through the old→new id map when 1a is on (exact lists, same strictness); with 1a off it is unchanged. |
| 1b Approvals access | Approvals is open to every active employee (they see their own requests and decisions); deciding still needs the approving permission. |
| 1c Sales ticket scope | A Sales Executive may read tickets (inside Account 360) but has no Tickets screen; search shows them tickets only on accounts they or their reports own. |
| 2 Home charts | No monthly history exists yet (BOS.mrrSnapshots), so MRR movement, new vs lost, trial conversion and the backlog history are fixed illustrative series labelled “Illustrative data”; the latest points that exist (backlog now, SLA this week, MRR now) are real. |
| 2 Home lede | A product-wide design layer hides page-head ledes, so “N things need the platform team” is shown as the first line of the page body. |
| 3a close approval | §3.1 asks for a second person to close a suspended workspace but §7.1 lists no type; a workspace-close approval type (approver platform-tenant:activate) was added. |
| 3a second approver in seeds | Only the Super Admin holds platform-tenant:activate among seeded employees, so in the demo suspensions wait for Meera; the spec gives Ishaan the Platform Manager role. Recommended next: a seeded Platform Manager login. |
| 4a checkout hook | The checkout-completion function is private to the billing script, so the verified payment event (BOS_PAY.receive) is wrapped instead; the same fix applies to 0c's billing-customer link after checkout. |
| 4b dunning | The renewal job keeps today's reminder schedule, which equals the policy defaults (1, 3, 7 days; read-only after 7). Reading the days from policy is left for when the owner changes them. |
| 4b enforcement points | Access level is enforced only where read-only is enforced today: the support tier and the workspace's own plan record. |
| 4d allocate permission | §7.2 adds platform-finance allocate and record_tds for Finance templates that hold verify_payment; the prototype checks verify_payment (or allocate), which is the same set of people, without editing role templates. |
| 4d ambiguous amounts | An amount-only suggestion is made only when exactly one open invoice of a matching payer has that outstanding amount; otherwise nothing is suggested. |
| 6 visible states | §6 says six visible states; the support diagram has seven including Closed. Tickets show New, Open, In progress, Waiting on customer, Waiting on us (with the detail), Resolved; Closed stays the end state. |
| 7b step-up scope | Step-up applies to sessions that came through the two-step sign-in; the developer shortcuts that switch the acting employee directly have no session to age. |
| 7c duty conflicts in templates | Every seeded Finance template already holds both invoice and verify payment. Blocking that would block normal Finance work, so a conflict built into one template is warned and audited; a conflict created by combining roles needs the Security Administrator override. Recommended next: split the Finance templates. |
| 7c policy sign-off | The two sign-offs (Security Administrator and Finance Manager) are kept as policy-change records (BOS.policyChanges) rather than two approvals, because one approval type can name only one approving permission. |

## 5. Step 1a screen lists

Derived from the strict access rules (same permission per screen; new ids replace old). Checked by `o2-nav-redirect.spec.js` and by `bos-login.spec.js` with 1a on.

| Login | Before (1a off) | After (1a on) |
| --- | --- | --- |
| Meera (Super Admin) | every screen (18+) | Home · My work · Approvals · My team · Reports · Accounts · Pipeline · Workspaces · Onboarding & success · Tickets · Incidents · Announcements · Subscriptions · Invoices & payments · Plans & pricing · Tax & reports · People & access · Audit & security · Integrity · AI agents · Product controls · Platform settings |
| Arjun (Sales Executive) | My work · Pipeline · Accounts · Sign-ups | My work · Accounts · Pipeline (Sign-ups is a tab) |
| Kavya (Sales Manager) | My team · My work · Pipeline · Accounts · Sign-ups · Insights | My work · My team · Reports · Accounts · Pipeline |
| Leela (Revenue Manager) | My work · Pipeline · Accounts · Sign-ups · Billing and payments · Integrity · Insights | My work · Approvals · Reports · Accounts · Pipeline · Invoices & payments · Tax & reports · Integrity |
| Rohan (Support Agent) | My work · Accounts · Tickets | My work · Accounts · Tickets · Incidents |
| Nisha (Support Manager) | My team · My work · Accounts · Tickets · Integrity · Insights | My work · My team · Reports · Accounts · Tickets · Incidents · Integrity |
| Aditi (Implementation + Trainer) | My work · Accounts · Tickets · Onboarding · Tenants | My work · Accounts · Workspaces · Onboarding & success · Tickets · Incidents |
| Sana (CS Manager) | My team · My work · Pipeline · Accounts · Sign-ups · Onboarding · Tenants · Integrity · Insights | My work · My team · Reports · Accounts · Pipeline · Workspaces · Onboarding & success · Integrity |
| Vikram (Finance Manager) | My team · My work · Accounts · Tickets · Billing and payments · Subscriptions · Plans · Integrity · Insights | My work · Approvals · My team · Reports · Accounts · Tickets · Incidents · Subscriptions · Invoices & payments · Plans & pricing · Tax & reports · Integrity |
| Dev (Security Admin) | My work · Employees and access · Integrity · Insights · Audit | My work · Reports · People & access · Audit & security · Integrity |

With 1b on, Approvals is open to every active employee (their own requests and decisions).

## 6. Old code that can be removed

Nothing was removed (Step 9 rule: only after you accept a step's switch, one switch per commit, after exporting a demo state). Candidates once the switch is accepted and its default turned on:

| After accepting | Can go | Why it is safe then |
| --- | --- | --- |
| 0d | The `inv-N` display paths (internal invoice rows on Subscriptions and in the refund picker) | Every screen shows the linked OON/ number; internal rows stay as data |
| 1a | `NAV_LAYOUT.oontu` old layout, old ids as menu items, Settings › Platform link sections | The §5 menu and redirects replace them |
| 2 | `renderOontuDashboardV2` as a screen (keep the function until 9 if other code reads it) | Home replaces it |
| 3b | Old Tenants list and the standalone Account help screen | Workspaces (All · Requests) and Workspace 360 host every action |
| 4c | The single Business & finance screen and its tab bar | Invoices & payments, Plans & pricing and Tax & reports reuse its tab bodies |
| 4d | One-click mark-paid paths (`markInvoicePaid` without allocation) | Allocations settle invoices; the old flag is still written |
| 5 | Standalone Incomplete sign-ups and Insights screens | Pipeline › Sign-ups and Reports |
| 6 | Old Notifications screen id | Announcements is the same screen |
| 7c | Old Employees and access screen | People & access reuses its tab bodies |
| 8a | Old Feature controls screen | Product controls › Maintenance hosts it |
| 8b | `renderOontuAgents` as a top-level screen | AI agents › Catalogue hosts it |

## Step 9 checks

- `o2-flows.spec.js` (every step on): lead → won → hand-over → provisioned → Workspace 360, checkout with allocation, renewal → dunning → read-only → paid, bank transfer with TDS, refund, sensitive access, every new screen renders without `inv-N`. 8/8, run twice in a row.
- Visual and keyboard: new screens use Design 2.0 cards and tables only; host tabs, chart marks and danger-zone buttons are keyboard-reachable; `light`, `design-system`, `a11y-responsive` and `motion` pass with every step on (motion's collapse-pill is the brief's known flake).
- Docs: `docs/OONTU-PLATFORM-FLOWMAP.md` §13 and `docs/PROTOTYPE-LOGINS.md` (O2 build switches) updated.
- Full suite: Step 9 changed no product code, so the checkpoint after 8b stands for it (off 1,246/1,247 with one focus flake; all on 1,249/1,249). The final branch suite runs again after Part B.

## 7. Recommended next

Pending.

## Part B · Recruiter-app upgrades (RX_SWITCH)

- **G1** Live workflow triggers: published workflows run on real events (stage moves, interviews, offers, joins, job publish, new candidates) for that one candidate, once per event, with consent and a daily limit; cards show the last live run and skips. Switch G1 (prototype tools › Recruiter-app upgrades) · any recruiter · Cowork › a workflow: Publish, then accept an offer.
- **G2** Automation results: every outcome (reply, submission, interview, offer, join) is credited to the live workflow that touched the person in the 30 days before its first step (most recent touch; others listed as "also touched"); perm fees from PLACEMENTS (₹) / PayTrack (₹ lakhs), contract margin and corporate agency fees avoided as estimates (8.33% assumption when no rate cards). Switch G2 · Owner/Admin · Cowork › Results tab (agency) or an agent › Results (company); Home card "Automation influenced ₹X fees / N hires". Users without billing view see counts only.
- **G3** Money at risk: ten rules (six agency: joined not invoiced, invoice overdue, approved time not invoiced, timesheet missing, time awaiting client, left in guarantee with no replacement; four corporate: idle approved role, joining at risk, work order ending, duplicate dispute open) found by `rxLeakSweep` (also inside `rxSweep`). Each finding has owner, age, amount in INR (estimates labelled) and one fix button that calls the existing flow; it closes itself when the condition clears (recovered when money was involved); dismissing needs a reason and never reopens. Switch G3 · Owner/Admin/Accounts (company: Owner, Finance) · Home or PayTrack card "₹X at risk · ₹Y recovered this month" → Money at risk screen. Workflow Studio trigger "Revenue Leak Detected" (conditions rule, amount, age).

Part B decisions: `wfRunTest` is not refactored; `wfPerform` applies the same checks per candidate with the same helpers, so Run Test output cannot change. Consent counts the prompt's `candidate.consent.given` or a given right-to-represent consent on any of the candidate's submissions (no seed has the former). The settings section is named "Workflow automation" (an older spec treats the word "Auto…" in Settings as an autonomy-level picker). G2: agency Cowork never shows the word "workflow" (an existing spec bans it), so Results copy says "automation"; Results sit in Cowork, where Workflow Studio routes. G3: fixes that do not exist yet in the product (G4 decision card, G5 direct sourcing) open today's screen for that record (Contract hiring; the "Release to vendors early" dialog); "joining at risk" uses a call task and an audited reminder because `coOnboardRemind` is the vendor onboarding reminder, not the joiner's; a work order counts as decided when `endDecision` is set (G4 sets it). Fixed: `CO` is a top-level const, so G2's vendor-fee lookup now reads it directly (was `window.CO`, always falling back to 8.33%; same output with today's empty rate cards). Commit note: the G3 code and the G3/G4 specs were committed from your own account as 915386d ("Add RX G3 and G4 test specifications…") while G3 was being finished; it matches the tested tree exactly, so it was tagged rx-g3 instead of making a second commit (no history rewrite).
