# Oontu QA checklist

Branch `o2/overnight-2026-11-26`. Before = `ea8919d` (BASE) or `0ccf679` (before the QA fixes). Tick Pass or Fail for each item and write what you saw. The same items, with screenshots, are in `QA-TOUR.html`.

## Agent transformation A0–A9

Did not run. Its prompt (OONTU-AGENT-TRANSFORMATION-PROMPT.md) is in Downloads only; there is no AX_SWITCH in the code, no ax/ branch or tag, no docs/oontu-agent-transformation folder and no progress-page section. The Cowork v2 prompt replaced it.

## Run 1 · O2 Super Admin build

### R1-0a - Demo data survives a reload (O2 build switches)

- Where: Sign-in screen › Prototype · simulated sign-in › O2 build
- Switch: O2 0a - Log in as: Any login
- What changed: A switch panel for the O2 build; with 0a on, demo data is saved and survives a reload, with reset, export and import.

- [ ] The O2 build panel lists every step with its switch
- [ ] Turn 0a on, change something, reload: it is still there
- [ ] Reset puts the seeds back
- [ ] Export downloads a file and Import reads it back

Result: [ ] Pass  [ ] Fail    Note: ______________________________________________

### R1-0b - Policy values, MRR per currency, access level

- Where: Platform overview › MRR card
- Switch: O2 0b - Log in as: Meera Krishnan (Super Admin)
- What changed: MRR is worked out per currency from list prices; policy values live in one place; each workspace shows its access level.

- [ ] The MRR card shows a figure per currency
- [ ] Platform Settings › Policy values lists the values with their source
- [ ] A workspace shows its access level (Full, Read-only, Blocked)

Result: [ ] Pass  [ ] Fail    Note: ______________________________________________

### R1-0c - Billing customer per account

- Where: Customers › Accounts › Northstar Talent Partners › Billing customer
- Switch: O2 0c (+ 5 for Account 360) - Log in as: Meera Krishnan
- What changed: Each account has a billing customer; invoices freeze the buyer details; the market is locked by the first invoice and changes only from the next renewal.

- [ ] The Billing customer card shows legal name, GSTIN and market
- [ ] Edit billing details changes future invoices only
- [ ] Change market says it applies from the next renewal

Result: [ ] Pass  [ ] Fail    Note: ______________________________________________

### R1-0d - Only tax invoices; grandfathered plans

- Where: Business & finance › Plans
- Switch: O2 0d - Log in as: Meera Krishnan
- What changed: Platform screens show only tax invoices (OON/…); legacy plans say “Grandfathered — not for sale” and are not offered for new workspaces.

- [ ] Plans shows “Grandfathered — not for sale” on legacy plans
- [ ] Invoices lists OON/… numbers only
- [ ] Create workspace does not offer legacy plans

Result: [ ] Pass  [ ] Fail    Note: ______________________________________________

### R1-1a - The new Super Admin menu

- Where: The sidebar
- Switch: O2 1a - Log in as: Meera Krishnan
- What changed: Home · Work · Customers · Service · Billing · Admin. Old screen links redirect to their new place; one access table decides who sees what.

- [ ] The sidebar shows the six groups
- [ ] Opening an old link (Tenants) lands on Workspaces
- [ ] A Finance login sees Billing but not Admin

Result: [ ] Pass  [ ] Fail    Note: ______________________________________________

### R1-1b - One approvals inbox and the platform bell

- Where: Work › Approvals
- Switch: O2 1a + 1b - Log in as: Kavya Iyer
- What changed: Waiting for me · I asked · Decided by me · All, for everyone; the bell lists approvals and opens the record.

- [ ] The four tabs show the right requests
- [ ] Approving needs the approving permission
- [ ] The bell shows the request unread and opens it

Result: [ ] Pass  [ ] Fail    Note: ______________________________________________

### R1-1c - Platform search

- Where: Ctrl+K anywhere
- Switch: O2 1c - Log in as: Meera Krishnan
- What changed: IDs first, then names, grouped and filtered by permission, with actions.

- [ ] TCK-1001 finds the ticket first
- [ ] An OON/ number finds the invoice
- [ ] “Northstar” groups workspace, account and invoices
- [ ] Results you may not open are not shown

Result: [ ] Pass  [ ] Fail    Note: ______________________________________________

### R1-2 - Home command center

- Where: Home
- Switch: O2 0b, 1a, 1b, 2 - Log in as: Meera Krishnan
- What changed: A ranked attention queue, six KPIs by definition, four charts (illustrative where there is no history), recent activity.

- [ ] The attention queue is ranked, each item opens its record
- [ ] Six KPIs with their definitions on hover
- [ ] Charts say “illustrative” where history is missing

Result: [ ] Pass  [ ] Fail    Note: ______________________________________________

### R1-3b - Workspaces list and Workspace 360 (with lifecycle commands, 3a)

- Where: Workspaces › Northstar
- Switch: O2 0b, 1a, 3a, 3b - Log in as: Meera Krishnan
- What changed: Cards, tabs, filters and ten columns; Workspace 360 with eight tabs and a danger zone; suspending asks a second person (3a).

- [ ] The list filters and sorts
- [ ] Workspace 360 has eight tabs
- [ ] Danger zone › Suspend asks for approval
- [ ] Archive keeps a tombstone

Result: [ ] Pass  [ ] Fail    Note: ______________________________________________

### R1-4c - Billing screens and the Subscription page (4a, 4b)

- Where: Billing › Subscriptions › Northstar
- Switch: O2 1a, 4a, 4b, 4c - Log in as: Vikram Shah (Finance)
- What changed: Invoices & payments, Plans & pricing, Tax & reports and a Subscription page with statuses, change history and approvals for cancel-now and manual activation.

- [ ] The Subscription page shows status, items and Change history
- [ ] Cancel at period end works; Cancel now asks for approval
- [ ] Unpaid makes the workspace read-only; paying clears it
- [ ] Mark paid only exists in Invoices & payments

Result: [ ] Pass  [ ] Fail    Note: ______________________________________________

### R1-4d - Payments, allocations, reconciliation, TDS

- Where: Billing › Invoices & payments › Reconciliation
- Switch: O2 1a, 4c, 4d - Log in as: Vikram Shah
- What changed: One bank credit across invoices, several payments to one invoice, partial payments, TDS with certificates, credits and reversals; suggestions never apply without Finance.

- [ ] A bank credit can be split across two invoices
- [ ] TDS needs a certificate
- [ ] A suggestion waits for Finance to apply it

Result: [ ] Pass  [ ] Fail    Note: ______________________________________________

### R1-5 - Account 360, Pipeline tabs, Reports

- Where: Customers › Accounts › Northstar
- Switch: O2 1a, 5 - Log in as: Kavya Iyer (Sales)
- What changed: Account 360 with a rail, seven tabs and both renewals side by side; Pipeline tabs including Sign-ups; Reports with pipeline analytics.

- [ ] Account 360 shows seven tabs
- [ ] Both renewals sit side by side
- [ ] Pipeline › Sign-ups lists new sign-ups
- [ ] Reports shows pipeline analytics

Result: [ ] Pass  [ ] Fail    Note: ______________________________________________

### R1-6 - Service: ticket states and incidents

- Where: Service › Incidents › an incident
- Switch: O2 1a, 6 - Log in as: Nisha Pillai or Meera
- What changed: Six visible ticket states; incidents with severity, flow, an update cadence reminder and a review; Publish update makes an announcement.

- [ ] An incident shows severity and its next update time
- [ ] Publish update posts an announcement
- [ ] A SEV1/SEV2 asks for a review after it is resolved

Result: [ ] Pass  [ ] Fail    Note: ______________________________________________

### R1-7b - Second sign-in step and step-up

- Where: Sign in as an Oontu employee (code 246810 in the sign-in tools)
- Switch: O2 7b - Log in as: Any Oontu employee
- What changed: Oontu employees confirm a code after the password; high-risk actions ask again after 15 minutes.

- [ ] Signing in as an employee asks for the code
- [ ] The wrong code is refused
- [ ] A high-risk action after 15 minutes asks again

Result: [ ] Pass  [ ] Fail    Note: ______________________________________________

### R1-7c - People & access, Audit & security (7a refusals)

- Where: Admin › People & access; Admin › Audit & security › Refusals
- Switch: O2 1a, 7a, 7c - Log in as: Dev Patel or Meera
- What changed: Teams, roles and access reviews; separation-of-duties checks; an approved audit export; refused and failed commands are audited once (7a).

- [ ] People & access lists teams and roles
- [ ] An access review can be started
- [ ] Audit & security › Refusals shows a refused Finance export
- [ ] Policy changes need Security and Finance

Result: [ ] Pass  [ ] Fail    Note: ______________________________________________

### R1-8a - Product controls and entitlements

- Where: Admin › Product controls
- Switch: O2 1a, 3b, 8a - Log in as: Meera Krishnan
- What changed: Ops flags and plan entitlements, with workspace overrides that end on their date; one availability check.

- [ ] Product controls lists flags and entitlements
- [ ] A workspace override has an end date
- [ ] The workspace's Entitlements tab shows the override

Result: [ ] Pass  [ ] Fail    Note: ______________________________________________

### R1-8b - AI agents governance

- Where: Admin › AI agents › Tools & policies
- Switch: O2 1a, 8b - Log in as: Meera Krishnan
- What changed: Allow-listed tools, daily limits and a run log without content.

- [ ] Tools & policies lists allowed tools
- [ ] A daily limit can be changed
- [ ] Activity shows runs without message content

Result: [ ] Pass  [ ] Fail    Note: ______________________________________________

Under the hood (nothing to check on screen):

- 0a persistence engine, switch store, reset/export/import plumbing (panel shown in R1-0a)
- 7a audit completeness: refused/failed commands and sign-ins audited once (seen through R1-7c Refusals)
- 9 end-to-end flows spec, docs (PROTOTYPE-LOGINS, flow map §13), removal candidates — no screen
- O2 audit fixes (f8c04ea): scheduled lifecycle run and billing-customer follow-on writes run as commands
- Spec selector updates for switch-aware runs (b70f941, 3871617, d64257f, d30c4f7)

## Run 2 · Recruiter-app upgrades G1–G6

### R2-G1 - Live workflow triggers

- Where: Workflow Studio › Offer Follow-up
- Switch: RX g1 - Log in as: Priya Sharma (Owner)
- What changed: An active workflow runs on real events (for example an accepted offer) exactly once; paused never runs; Run test is unchanged.

- [ ] The workflow says it is live on real events
- [ ] Accepting an offer gives exactly one action
- [ ] Firing again does nothing; paused never runs

Result: [ ] Pass  [ ] Fail    Note: ______________________________________________

### R2-G2 - Automation results

- Where: Cowork › Results; Home › results card
- Switch: RX g2 - Log in as: Priya Sharma
- What changed: What each automation produced: prospects, interviews, placements and fees, per agent, with a Home card.

- [ ] Results shows numbers per agent
- [ ] Each number opens the records behind it
- [ ] The Home card matches the Results page

Result: [ ] Pass  [ ] Fail    Note: ______________________________________________

### R2-G3 - Money at risk

- Where: Money at risk (Home card and its page)
- Switch: RX g3 - Log in as: Priya Sharma
- What changed: Revenue leaks found from real records: unbilled joinings, overdue invoices, missing timesheets, with the amount and an owner.

- [ ] Each leak shows amount, reason and owner
- [ ] Fix opens the record
- [ ] Totals match the list

Result: [ ] Pass  [ ] Fail    Note: ______________________________________________

### R2-G4 - Redeployment and contract-end decisions

- Where: Redeploy (agency) · Contract hiring (company)
- Switch: RX g4 - Log in as: Priya Sharma (agency) / company admin
- What changed: Contractors ending soon get ranked open roles within ±15% pay with margin; companies decide extend, convert or end.

- [ ] Roles are ranked with margin shown
- [ ] Below-minimum margin is flagged, not hidden
- [ ] An availability check can be sent

Result: [ ] Pass  [ ] Fail    Note: ______________________________________________

### R2-G5 - Own talent first

- Where: A job › your own talent first
- Switch: RX g5 - Log in as: Priya Sharma
- What changed: A new job shows matches from your own database before outside sourcing, with a short direct-sourcing window.

- [ ] The job shows a database-first shortlist
- [ ] Send the new role goes to your own people first
- [ ] A hire from the window counts as fees avoided

Result: [ ] Pass  [ ] Fail    Note: ______________________________________________

### R2-G6 - Interview self-booking

- Where: A job › Interviews › booking link
- Switch: RX g6 - Log in as: Priya Sharma
- What changed: Candidates pick a slot from the interviewer's free time with a booking link; cancel and rebook work.

- [ ] A booking link shows only free slots
- [ ] Booking a slot creates the interview
- [ ] Cancelling frees the slot

Result: [ ] Pass  [ ] Fail    Note: ______________________________________________

Under the hood (nothing to check on screen):

- G1–G6 state/report commits; RX audit report

## Run 3 · Cowork v2

### R3-C1b - Set up Cowork (a new workspace)

- Where: Cowork › Agents › Set up Cowork
- Switch: CX on (?cx=1) - Log in as: Priya Sharma (Owner)
- What changed: A readiness card for a new tenant: mailbox, WhatsApp business number, LinkedIn team, calendar, each with what it unlocks; one send path for every agent.

- [ ] The card lists what is missing and what it unlocks
- [ ] Each item opens its setup page
- [ ] Agents still work with what is connected (email only is fine)

Result: [ ] Pass  [ ] Fail    Note: ______________________________________________

### R3-C1 - Credits: one wallet for every agent

- Where: Cowork › Credits
- Switch: CX on - Log in as: Priya Sharma
- What changed: Balance, reserved, spent and days left; credits by agent; impact per agent; the live ledger; budgets with alerts; CSV export.

- [ ] Balance equals the sum of the ledger
- [ ] Clicking an agent bar filters the ledger
- [ ] A budget alerts at 80% and stops at 100% (not safety steps)
- [ ] Export CSV has every row

Result: [ ] Pass  [ ] Fail    Note: ______________________________________________

### R3-C2 - Job 42: Talent Discovery reads the job and picks people

- Where: Jobs › Java Backend Developer › Talent Discovery
- Switch: CX on - Log in as: Priya Sharma
- What changed: The job is read into criteria chips you confirm; picks are ranked on evidence with fit and likelihood shown separately.

- [ ] Read the job costs ≈ 10 credits and shows chips
- [ ] Confirm makes Criteria v1
- [ ] Each pick shows fit, likelihood and the evidence
- [ ] No pick breaks a must-have

Result: [ ] Pass  [ ] Fail    Note: ______________________________________________

### R3-C3 - Simple Campaign Builder

- Where: Cowork › Campaigns › New campaign
- Switch: CX on - Log in as: Priya Sharma
- What changed: Who → Steps → Review & start; recommended steps for the audience; plain-word step cards; honesty check; weekly cap fixes; ≤ 12 clicks.

- [ ] Use recommended steps fills the steps
- [ ] The step card reads as a sentence
- [ ] Fake urgency is warned in plain words
- [ ] Review shows the credit estimate before Start

Result: [ ] Pass  [ ] Fail    Note: ______________________________________________

### R3-C4 - LinkedIn queue (assisted, a person sends)

- Where: Cowork › Agents › LinkedIn queue
- Switch: CX on - Log in as: Priya Sharma
- What changed: Cowork prepares a daily queue with a note under 300 characters; a person opens the profile, copies the note and marks it sent. No automation.

- [ ] Each task has Open profile, Copy note, Mark sent, Skip
- [ ] The header shows today's count and the weekly use
- [ ] Nothing is clicked or sent automatically

Result: [ ] Pass  [ ] Fail    Note: ______________________________________________

### R3-C5 - A pasted reply starts screening; Needs you

- Where: Cowork › Agents › Needs you
- Switch: CX on - Log in as: Priya Sharma
- What changed: A reply (pasted from LinkedIn or received) is read; interested people get one screening question per message; unsure readings go to Needs you.

- [ ] Paste a reply on a LinkedIn task: it joins the job's conversation
- [ ] Screening asks unknown must-haves first, in the person's language
- [ ] A low-confidence answer shows in Needs you with a suggestion

Result: [ ] Pass  [ ] Fail    Note: ______________________________________________

### R3-C5b - A qualified person becomes a prospect

- Where: Talent pool › Prospects (or the job's picks)
- Switch: CX on - Log in as: Priya Sharma
- What changed: After screening, a qualified, interested person becomes a prospect with a summary, answers, evidence and consent; the owner is told.

- [ ] The prospect card has summary, answers and evidence
- [ ] Consent is recorded
- [ ] Nothing negative is ever sent to someone not a fit

Result: [ ] Pass  [ ] Fail    Note: ______________________________________________

### R3-C6 - Live hires (Delivery Guardian)

- Where: Cowork › Live hires
- Switch: CX on - Log in as: Priya Sharma
- What changed: Offers, joinings and interviews watched for risk; each flag has a reason and an owner; reminders are safety steps that run even on a low balance.

- [ ] Each flagged hire shows why and who owns it
- [ ] Interview reminders run on a low balance
- [ ] The flag clears when the risk is gone

Result: [ ] Pass  [ ] Fail    Note: ______________________________________________

### R3-C7 - Revenue & Redeploy

- Where: Cowork › Agents › Revenue & Redeploy
- Switch: CX on - Log in as: Priya Sharma
- What changed: Money at risk and redeploy chances found by rules (0 credits), with owners.

- [ ] The card shows money at risk
- [ ] Each item names an owner
- [ ] Rules-only checks cost 0 credits

Result: [ ] Pass  [ ] Fail    Note: ______________________________________________

### R3-C7b - Kairo as the manager

- Where: Kairo: “what’s stuck today”
- Switch: CX on - Log in as: Priya Sharma
- What changed: Kairo answers what is stuck (by owner, with money at risk), starts sourcing with a confirmation and the credit estimate, pauses campaigns.

- [ ] “What’s stuck today” lists owners and reasons
- [ ] “Start sourcing for job 42” says ≈ 10 credits and asks first
- [ ] “Credits for job 42” gives the spend

Result: [ ] Pass  [ ] Fail    Note: ______________________________________________

### R3-C8 - Six agents (Engagement retired), included on every plan

- Where: Cowork › Agents
- Switch: CX on - Log in as: Priya Sharma
- What changed: Six agents with clear owners per stage; no per-agent prices, trials or Add; old workflows run on the new owners.

- [ ] Six agent cards, each “Included · uses credits”
- [ ] No prices, trials or “Not in your plan”
- [ ] Old Engagement workflows still run

Result: [ ] Pass  [ ] Fail    Note: ______________________________________________

Under the hood (nothing to check on screen):

- C0 audit of the Cowork code (CX-AUDIT.md)
- C1 ledger internals: reserve → settle, running index, safety reserve, rates by effective date
- C8 migration map CX_STEP_MAP / CX_OWNERSHIP (agents page shows the result, R3-C8)
- C9 polish (words, grouping) spread across the CX screens above; C10 LinkedIn automation guard and audit spec

## Run 4 · QA finish-up fixes

### R4-A8 - Nothing runs off the screen at 375 px

- Where: Phone width: My to-do, Team, hiring manager Home, Approvals, Cowork cards
- Switch: none (always on) - Log in as: Neha Kulkarni (Recruiter) and others
- What changed: Rows that were cut off at the screen edge now wrap; tab strips and tables scroll inside their own box.

- [ ] My to-do: the add row wraps
- [ ] Cowork agent cards: buttons wrap under the chip
- [ ] Approvals phone card: the tabs scroll inside the card
- [ ] No page scrolls sideways

Result: [ ] Pass  [ ] Fail    Note: ______________________________________________

### R4-A3 - Every spending button shows ≈ N credits

- Where: Cowork › Campaigns › Review & start
- Switch: CX on - Log in as: Priya Sharma
- What changed: Start campaign, Read the job, rewrite buttons, Add to the conversation and Needs you answers show the estimate before use; the hover shows ₹ to people who see money.

- [ ] Start campaign shows ≈ N credits
- [ ] Hovering shows ₹ for the Owner, not for a recruiter
- [ ] Read the job shows ≈ 10 credits

Result: [ ] Pass  [ ] Fail    Note: ______________________________________________

### R4-A5 - A second message version in the builder

- Where: Cowork › Campaigns › a step › Add a second version
- Switch: CX on - Log in as: Priya Sharma
- What changed: Two versions at most per message step; the card says “2 versions”; results show the interested rate per version; the better one is kept after 50 sends each.

- [ ] Add a second version shows a Version B box
- [ ] The card says 2 versions; no third is offered
- [ ] The campaign page shows sent and interested % per version

Result: [ ] Pass  [ ] Fail    Note: ______________________________________________

### R4-A6 - The live ledger scrolls (no Show more)

- Where: Cowork › Credits › Live ledger
- Switch: CX on - Log in as: Priya Sharma
- What changed: The ledger sits in its own scrolling box and draws only the rows in view; filters and CSV still cover every row.

- [ ] Scroll the ledger: rows keep coming, no Show more
- [ ] The row count under the table is the full count
- [ ] A filter starts again from the top

Result: [ ] Pass  [ ] Fail    Note: ______________________________________________

### R4-A7 - Personal WhatsApp Web inbox is off by default

- Where: Settings › Cowork › Cowork v2; Settings › My connections
- Switch: CX on - Log in as: Priya Sharma (Owner/Admin)
- What changed: A workspace setting, off by default, with a warning that WhatsApp Web is not the official API; agents never use it; your own replies go by click-to-chat or the business number.

- [ ] The switch is off and shows the warning
- [ ] My connections says WhatsApp Web is off (no QR)
- [ ] Turning it on brings back your own WhatsApp chats
- [ ] Replying on WhatsApp with it off opens click-to-chat

Result: [ ] Pass  [ ] Fail    Note: ______________________________________________

### R4-A9 - Credit rates with a “Rates (placeholder)” badge

- Where: Settings › Cowork › Cowork v2 › Credit rates
- Switch: CX on - Log in as: Priya Sharma
- What changed: The current rates are listed read-only under a badge saying they are placeholders until the real costs are set.

- [ ] The badge reads “Rates (placeholder)”
- [ ] Each action shows its credits
- [ ] Nothing is editable here

Result: [ ] Pass  [ ] Fail    Note: ______________________________________________

Under the hood (nothing to check on screen):

- A1 demo seed never expires (Vistaar contract weeks start ≥ 66 days back)
- A2 CX-on spec for retired behaviour (tests/cx-retired.spec.js)
- A4 company campaign plays and vendor-submitted screening reserve credits before sending (tests/cx-audit.spec.js)
- A10 status check of the Agent transformation task (it did not run)

