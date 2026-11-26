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

Pending (Step 9).

## 7. Recommended next

Pending.
