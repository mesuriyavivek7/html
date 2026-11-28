# Oontu O2: build brief for Claude Code

**Version:** 2 (final), 26 Nov 2026. Replaces version 1 completely.
**Status:** for owner approval. Implementation starts at Step 0a only after approval.
**What this is:** the single implementation reference for building the Oontu O2 platform (the internal Super Admin system Oontu's own employees use) inside the prototype. If anything else (the flow map, the architecture doc, a chat) disagrees with this brief, **this brief wins**; if this brief is unclear, stop and ask.
**What this is not:** a redesign of the recruiter app, a backend, or a production system.

**Repo file:** `recruitment-os-prototype.html` (~70,000 lines, plain JS and CSS, no build step).
**Background reading (context only):** `docs/OONTU-PLATFORM-FLOWMAP.md` (current state), `docs/O2-ARCHITECTURE.md` (approved proposal and Final review).

---

## Contents

0. How to start a session
1. Ground rules
2. Switches, data and rollback: what a switch can and cannot undo
3. Approved architecture to build (reference)
4. Policy values and tax placeholders
5. Target navigation and redirects
6. The 22 steps
7. Reference tables
8. What not to build

---

## 0. How to start a session (paste into Claude Code)

```
Read docs/O2-BUILD-BRIEF.md in full. It is the single implementation
reference; it overrides every other document. Work on STEP <id> only
(for example STEP 0a).

Before changing any code:
1. Create branch o2/step-<id> from the latest approved branch
   (agency-prototype-v2 for Step 0a; the previous step's merged branch after).
2. Run the step's "Regression tests" and report pass/fail as the baseline.
3. Show me a plan: blocks you will add, functions you will wrap, data
   fields you will add, the switch you will register, tests you will add
   or update, and anything in the step you think is unclear or risky.
4. Wait for my reply "go".

Then build only that step, run its tests with the switch ON and the
previous behaviour tests with the switch OFF, check every acceptance
criterion, and report: what changed, tests run and results, the
rollback notes for this step, and anything you could not do.
Do not start the next step.
```

---

## 1. Ground rules (every step)

1. **One file, no framework, no new runtime dependencies.** Plain JS and CSS inside `recruitment-os-prototype.html`. Test tooling already in `tests/` may be used as is.
2. **Add, don't rewrite.** The file grows by appending named blocks after `bos-deal-flow-script`, as earlier work did (`bos-billing-script`, `bos-access-strict-script`):
   - `<style id="o2-<step>-style">` and `<script id="o2-<step>-script">`, IIFE-wrapped, exporting through `window.*`.
   - Wrap older functions (`const base = window.fn; window.fn = fn = function(){ … }`) rather than editing them. A direct edit is allowed only for a one-line bug fix; say so in the report.
   - Every wrapper checks its switch first and calls `base` unchanged when the switch is off (§2).
3. **Every data change goes through `bosRun(name, input, fn)`.** Older platform functions that change data directly are routed through `bosRun` in the step that touches them, with a named command (`workspace.suspend`, `subscription.change-plan`, …).
4. **Design 2.0 components only** for new UI (`oDashShell`, `oPageHead`, `oNumbers`, `oTableCard`, `oBadge`, `oAttentionCard`, `bosDialog`). No new Tailwind-card screens.
5. **Never delete a function, field or record type** other code or tests use. Old paths are removed only in Step 9, after their switches have been accepted.
6. **Additive data only.** New fields and records sit beside old ones. Old code must keep working when it meets records that carry new fields.
7. **Access stays strict.** New screens get a `BOS_VIEW_ACCESS` entry; every renderer and every command checks again.
8. **Mock numbers are labelled** "Illustrative data". Never present seeded numbers as live.
9. **Plain UI words.** Refusals use `bosWhyNot`-style reasons and say who can do it.
10. **Tax rules are not changed** by any step. Steps may move where tax inputs are read from (0c) but must produce identical tax results for all seeds. Any change to rates, classification, numbering or correction rules needs the owner's written approval after the tax advisor answers (§4).
11. **Billing and permissions never change in the same step.** Only one billing step (0c, 0d, 4a, 4b, 4c, 4d) is in progress at a time; the same for permissions steps (7a, 7b, 7c).
12. **Tests:** `& .\tests\run-auth-tests.ps1 -Spec tests\<name>.spec.js` (headless Chrome). Before each commit: the step's regression tests + `screens-crawl.spec.js` + `bos-login.spec.js`. End of step: full suite. `motion.spec.js` "collapse… pill on the active item" is a known timing flake; rerun alone before calling it a failure. A spec may change selectors without approval; a change to what a spec expects needs owner approval.
13. **Commits:** small, one concern each, `O2 <step>: <what>`, with the attribution lines your environment requires.
14. **Stop and ask** before: changing tax output, invoice numbering, a spec's expected behaviour, deleting anything, or doing work outside the step's scope.

---

## 2. Switches, data and rollback

### 2.1 What a switch is

A switch is a **code-path selector** in the prototype. It decides whether the new wrapper or the old function runs, and which screens and menu items show. **A switch is not a data rollback.** Turning it off never deletes, reverts or rewrites records.

- Registry (created in Step 0a): `window.O2_SWITCH = { '0a': true, '0b': false, … }`, read with `o2On('<step>')`.
- Stored in `localStorage['oontu.o2.switches.v1']`; shown in the "Prototype · simulated sign-in" panel as a list of toggles with the step name.
- Default: **off** until the owner accepts the step; then the default in code becomes **on**.
- Tests: each step's new specs run with its switch on; the step's "switch off" check proves the previous behaviour still works.
- Turning a switch on or off reloads the page view (re-render), not the data.

### 2.2 Rules every step must follow so a switch can be turned off safely

1. **Old code must tolerate new data.** Records created or changed while the switch was on stay valid for the old code (extra fields ignored, old fields still filled).
2. **Dual-write where the old code reads a field.** If the new code changes a concept the old code reads (e.g. subscription status), keep writing the old field too (e.g. `readOnly`) until Step 9.
3. **No destructive migration.** Never rewrite seeds in place to a new shape; add new fields or records alongside.
4. **Each step's brief lists** (in its "Rollback and recovery" part): what the switch disables, what data remains, what cannot be reversed, and how to recover.

### 2.3 What can never be undone by a switch

These are permanent once they happen (in the prototype until Reset; in production, forever):

- Issued invoice, credit-note and debit-note numbers, and anything written to the vault.
- Audit rows and domain events.
- Decided approvals (approved, declined) and the actions they triggered.
- Simulated outbox messages (emails, WhatsApp) "sent" to customers.
- Payment events received and payment allocations confirmed by Finance.
- Workspace archive (data deletion) once the deletion job has run.

Recovery for these is always a **forward correction** through normal commands (credit note, new approval, reversal allocation, restore), never editing or deleting the record.

### 2.4 Recovery in the prototype

- **Reset demo data** (Step 0a) clears saved state and reloads seeds. This is the prototype's only "database rollback" and it loses all demo changes.
- **Export state** (Step 0a): a button that downloads the saved state as JSON, so a demo can be kept before a risky step; **Import state** restores it, refusing files with a different `schemaVersion`.
- If a switch is turned off and the old code misbehaves with data written while it was on: export state, Reset, report the record that broke the old code, fix the step (old code must tolerate it, rule 2.2.1).

---

## 3. Approved architecture to build (reference)

### 3.1 Workspace lifecycle (tenant)

States: `provisioning`, `trial`, `active`, `suspended`, `closed`, `archived`. Map old values: `invited` → `provisioning`, `cancelled` → `closed` (keep the old value in `statusLegacy`).

| From | To | Command | Who | Second person | Reason |
| --- | --- | --- | --- | --- | --- |
| provisioning | trial | `workspace.start-trial` | system / owner verification | no | — |
| provisioning | active | `workspace.activate` | provisioning with a paid subscription | no | — |
| trial | active | automatic on paid subscription | system | no | — |
| trial | closed | automatic after `trialGraceDays` | `SYS-BILLING` | no | — |
| trial, active | suspended | `workspace.suspend` | `platform-tenant:suspend` | yes (`workspace-suspend` approval) unless `suspendNeedsSecondPerson` is false; Security Administrator emergency path | required |
| suspended | active | `workspace.restore` | `platform-tenant:activate` | no | required |
| active | closed | `workspace.close` | `platform-tenant:suspend` | no | required |
| suspended | closed | `workspace.close` | `platform-tenant:suspend` | yes | required |
| closed | active | `workspace.restore` within `closedRetentionDays` and with an active subscription | `platform-tenant:activate` | no | required |
| closed | archived | automatic at retention end, or `workspace.archive` early | system / Platform Ops | yes for early | required |

- Every transition writes `tenant.lifecycle[]` (from, to, at, by, actorType, reason, approvalId) and an audit row.
- Archived refuses every command except read; archive keeps a tombstone (id, name, dates), invoices and audit.
- Emergency suspension by a Security Administrator alone raises the integrity finding "Emergency suspension to review".

### 3.2 Access level (computed by `o2AccessLevel(tenant)`, never stored)

Cancel at period end is not a status: the subscription stays `active` with `cancelAt`.

| Subscription status | Workspace trial | Workspace active | Suspended | Closed |
| --- | --- | --- | --- | --- |
| incomplete | full | full (previous paid period) | blocked | read-only, owner export |
| trialing | full | — | blocked | read-only, owner export |
| active (incl. `cancelAt` set) | — | full until paid-through date | blocked | read-only, owner export |
| past_due | — | full + payment banner | blocked | read-only, owner export |
| unpaid | — | read-only + payment banner | blocked | read-only, owner export |
| paused | — | read-only (policy may set blocked) | blocked | read-only, owner export |
| canceled | lifecycle moves to closed | lifecycle moves to closed at paid-through date | blocked | read-only, owner export |

Archived is always blocked. Suspended-owner export follows policy `suspendedOwnerExport`.

### 3.3 Billing relationships (rules R1–R5)

| # | Rule |
| --- | --- |
| R1 | A workspace has many subscriptions over time, one current (`tenant.subscriptionId`). Old subscriptions are kept. Read the plan through the current subscription, not `tenant.planId`. |
| R2 | Billing customer belongs to an account (`billingCustomer.accountId`), which may differ from the workspace's account (parent pays for subsidiary). Never derive one from the other. |
| R3 | Invoices are made of lines; each subscription charge line names its `subscriptionId`. Version 1 issues one invoice per subscription period. |
| R4 | Invoices freeze the buyer at issue: legal name, GSTIN, address, state code, place of supply, currency, tax decision with reasons and rule version. Later billing-customer edits never change issued invoices. |
| R5 | Payments are allocated to invoices (§3.4). |

Not in version 1: one subscription covering several workspaces, split billing of one workspace, billing-customer hierarchy, committed-spend contracts.

### 3.4 Payments, allocations and TDS

**Records:**

- **Payment** — money received: `id`, `source` (`provider` | `bank` | `customer-credit`), `providerEventId` or bank details (date, amount, reference, payer name), `currency`, `amount`, `status` (`unallocated` | `partly_allocated` | `allocated` | `refunded`), `allocations[]`.
- **Allocation** — `{ id, paymentId | null, invoiceId, kind: 'cash' | 'tds' | 'credit', amount, at, by, confirmedBy, note }`.
- **TDS allocation** (`kind:'tds'`, no payment) — `section` (entered by Finance; not hardcoded), `amount`, `financialYear`, `quarter`, `certificateStatus` (`expected` | `received` | `verified`), `certificateRef`.
- **Invoice settlement** — `outstanding = total − Σ allocations (cash + tds + credit) − credit notes`. Status: `open` → `partly_paid` → `paid`; plus existing `cancelled`.
- **Customer credit** — overpayment held on the billing customer, applied later by a `credit` allocation.

**Rules:**

1. One payment may be allocated across **several invoices** of the same billing customer and currency.
2. One invoice may receive **several allocations** (several payments, TDS, credit).
3. **Partial payment** leaves the invoice `partly_paid`; the subscription is not activated or renewed until the current invoice is `paid` (policy may later allow partial thresholds — not in v1).
4. **TDS:** Finance records the TDS amount when cash arrives short. Cash + TDS allocations that cover the outstanding amount make the invoice `paid` (subscription activates normally). Certificates still `expected` 60 days after the quarter ends raise integrity finding `tds-certificate-overdue` (days are a policy value). If the TDS amount differs from the expected percentage in policy `tdsExpectedPercent` (placeholder until T10), show a warning; never block.
5. **Unmatched bank credits are never assigned arbitrarily.**
   - The system may only **suggest** a match, in this order: (a) reference equals an open invoice number of a billing customer whose name matches the payer, and amount ≤ outstanding (+ TDS tolerance); (b) amount equals one open invoice's outstanding and payer name matches the billing customer.
   - A suggestion is never applied automatically. Finance confirms each allocation (`payment.allocate` command, reason, step-up once 7b exists).
   - No suggestion → the credit stays in **Reconciliation › Unmatched** with status `unallocated`. After 7 days it raises integrity finding `unmatched-credit`.
   - Overpayment remainder becomes customer credit only when Finance confirms.
6. **Provider payments** (payment links, checkout, mandates) carry their invoice or link reference, so they allocate to that invoice automatically. If amount or currency doesn't match, keep today's behaviour: no allocation, a Finance exception.
7. **No duplicate invoices from payments:** a provider payment event creates **at most one** new invoice, and only when no invoice exists for that payment (today's `bosAutoInvoice` `byPayment` rule). A repeated event changes nothing. This is about not duplicating invoices; it does not limit how a payment is allocated.
8. **Corrections are reversals:** an allocation is never edited or deleted; Finance adds a reversing allocation with a reason (`payment.unallocate`), which reopens the invoice.

### 3.5 Subscription statuses

`incomplete`, `trialing`, `active` (+ `cancelAt`), `past_due`, `unpaid`, `paused`, `canceled`. Map old: `trial` → `trialing`, `cancelled` → `canceled`, `expired` → `canceled`, `readOnly:true` → `unpaid` (keep writing `readOnly` until Step 9).

- incomplete → trialing | active | (abandoned after 24 h: removed from lists, kept in history)
- trialing → active | canceled
- active → past_due | paused | canceled
- past_due → active | unpaid
- unpaid → active | canceled
- paused → active | canceled
- Upgrade: immediate, prorated (existing). Downgrade: at next renewal; refused if licences in use exceed the new count. Cancel: default at period end (`cancelAt`); cancel now needs approval `subscription-cancel-now`.
- Renewal mandate rule unchanged: INR charges above ₹15,000 need customer approval per charge.

### 3.6 Export

| Started by | What | Approval | Available in |
| --- | --- | --- | --- |
| Workspace owner (customer) | own workspace data | none | trial, active, closed; suspended if `suspendedOwnerExport` |
| Oontu employee for a customer | workspace data | second person + customer authorisation | any state except archived |
| Oontu employee | audit log, customer lists | second person (`data-export`) | — |
| Finance | CA tax exports | none (existing) | — |

Every export writes an audit row; links expire after `exportLinkHours`.

### 3.7 Tax architecture (design only)

- One decision function (`bosTaxSegment`) used by every path. Inputs: supplier profile (dated), buyer snapshot from the billing customer, supply (type, date, value, currency), rule set version.
- Output stored on the invoice: treatment, rates, place of supply, reasons, rule version; for USD invoices also INR value, rate and rate date (rate source is a placeholder until T6).
- Not enough facts (missing location, GSTIN/state mismatch, lapsed LUT) → "Needs review"; the invoice cannot be issued.
- Issued documents never change; corrections are linked documents (existing correction path).
- Reports are derived from the ledger.
- **No step changes rates, classifications, thresholds, numbering or correction rules.** All tax samples stay labelled as samples.

### 3.8 KPI definitions (used by Steps 0b and 2)

General: money metrics per currency (INR and USD shown separately, never summed or converted); exclude workspaces with `internal:true`; store UTC, report days in Asia/Kolkata.

| Metric | Calculation |
| --- | --- |
| MRR (per currency) | Subscriptions with status `active` or `past_due`: Σ recurring items (unit price × quantity − recurring discount) ÷ months in interval (annual ÷ 12). Excludes tax, one-off charges, proration, first-period-only promos, other statuses, internal workspaces. Includes `cancelAt` subscriptions until they end. |
| MRR movement (per currency, per month) | Per subscription, month-start vs month-end MRR: new, expansion, contraction, churn, reactivation; start + new + expansion + reactivation − contraction − churn = end. Needs monthly snapshots (`BOS.mrrSnapshots`, written by a month-end job); until history exists: illustrative. |
| Paying workspaces | Lifecycle `active` and current subscription `active` or `past_due` with MRR > 0; excludes internal and fully discounted. |
| At-risk MRR (per currency) | MRR of `past_due` subscriptions. Shown beside, never added: **Lapsed MRR** (what `unpaid` subscriptions would carry) and **Scheduled churn** (MRR with `cancelAt` in the next 30 days). |
| Trials ending (7 d) | `trialing` subscriptions with trial end today through today + 6; subtitle % with onboarding activated. |
| Trial conversion (monthly cohort) | Cohort = trials started that month; converted = first paid invoice ≤ trial end + 30 days; shown only when the whole cohort has matured; excludes internal and spam/duplicate trials. Illustrative until history exists. |
| Payment success (per currency, per week) | First-attempt rate = renewal charges captured on first attempt ÷ renewal charges attempted. Recovery rate = `past_due` returned to `active` before `unpaid` ÷ entered `past_due`. Excludes unopened links, duplicate events, test mode. |
| Open P1/P2 tickets | Not resolved or closed, priority P1–P2; subtitle: past SLA now (customer-waiting time excluded). |
| SLA attainment (per week) | Resolved within resolve target ÷ resolved that week; tier SLA when a workspace is linked. |
| Approvals waiting | Pending approvals `bosCanDecide(a, me).ok`; subtitle oldest age. |
| New vs lost paying workspaces (per month) | New = became paying that month; lost = paying at start, not at end. Illustrative until history exists. |

No converted total appears anywhere until the owner approves a reporting conversion policy.

---

## 4. Policy values and tax placeholders

### 4.1 Policy values (owner decisions B1–B11 pending)

All live in `PLATFORM_SETTINGS.policy` (Step 0b creates it), editable in Platform settings by Security Admin + Finance Manager (approval type `policy-change`, Step 7c). Code reads only from here; never hardcode these numbers.

| Key | Placeholder | Decision |
| --- | --- | --- |
| `trialGraceDays` | 7 | B1 |
| `dunningReminderDays` | [1, 3, 7] | B2 |
| `readOnlyAfterDays` | 7 | B2 |
| `closedRetentionDays` | 90 | B3 |
| `suspendNeedsSecondPerson` | true (Security emergency path allowed) | B4 |
| `suspendedOwnerExport` | 'after-review' | B5 |
| `downgradeTiming` | 'next-renewal' | B6 |
| `cancelDefault` | 'period-end' | B6 |
| `legacyPlans` | 'grandfathered' | B7 |
| `marketRule` | 'gstin-then-billing-country' | B8 |
| discount and trial thresholds | today's `BOS_POLICY` | B9 |
| `mfaMethod` (prototype) | simulated code `246810` | B10 |
| `exportLinkHours` | 24 | — |
| `incompleteAbandonHours` | 24 | — |
| `unmatchedCreditDays` | 7 | — |
| `tdsCertificateDueDays` | 60 after quarter end | T10 |
| `tdsExpectedPercent` | null (warning off) until T10 | T10 |
| `stepUpMinutes` | 15 | — |

Roles: Product Operations and AI Operations are not created (B11).

### 4.2 Tax advisor questions (T1–T12)

Open until answered: SAC code and rates (T1), place of supply rules (T2), export qualification and evidence (T3), foreign individuals (T4), LUT lapse (T5), USD conversion rate (T6), return thresholds and e-invoicing (T7), credit-note limits and cancel-and-reissue (T8), invoice number format (T9), TDS section and certificates (T10), discounts and proration on invoices (T11), advance receipts before invoice (T12). Steps must not implement answers to these; they keep today's sample behaviour.

---

## 5. Target navigation and redirects

```
Home                  oontu-home
Work                  My work (oontu-mywork) · Approvals (oontu-approvals) · My team (oontu-team) · Reports (oontu-reports)
Customers             Accounts (oontu-accounts) · Pipeline (oontu-revenue) · Workspaces (oontu-workspaces) · Onboarding & success (oontu-custops)
Service               Tickets (oontu-service) · Incidents (oontu-incidents) · Announcements (oontu-announcements)
Billing               Subscriptions (oontu-subscriptions) · Invoices & payments (oontu-invoices) · Plans & pricing (oontu-plans) · Tax & reports (oontu-tax)
Admin (folding)       People & access (oontu-people) · Audit & security (oontu-audit) · Integrity (oontu-integrity) · AI agents (oontu-ai) · Product controls (oontu-controls) · Platform settings (oontu-settings)
Record pages          oontu-account · oontu-opp · oontu-workspace · oontu-onboarding · oontu-ticket · oontu-incident · oontu-subscription-detail · oontu-plans-detail
```

| Old id | New id (tab) | Built in step |
| --- | --- | --- |
| `oontu-dashboard` | `oontu-home` | 1a redirect → old renderer until 2 |
| `oontu-signups` | `oontu-revenue` (Sign-ups) | 1a → 5 |
| `oontu-help` | `oontu-workspaces` (Requests) | 1a → 3b |
| `oontu-tenants` | `oontu-workspaces` (All) | 1a → 3b |
| `oontu-tenant-detail` | `oontu-workspace` | 1a → 3b |
| `oontu-insights` | `oontu-reports` | 1a → 5 |
| `oontu-agents` | `oontu-ai` | 1a → 8b |
| `oontu-feature-controls` | `oontu-controls` | 1a → 8a |
| `oontu-notifications` | `oontu-announcements` | 1a → 6 |
| `oontu-platform-users` | `oontu-people` | 1a → 7c |
| `oontu-finance` tab 0 | `oontu-approvals` | 1b |
| `oontu-finance` tabs 1–4, 6 | `oontu-invoices`, `oontu-plans` | 4c |
| `oontu-finance` tab 5 | `oontu-tax` | 4c |

Until the target exists, a new id renders the old screen, so nothing breaks.

---

## 6. The 22 steps

Order and dependencies:

```
0a → 0b → 0c → 0d                       (billing path starts)
0a → 1a → 1b, 1c
0b + 1b → 2
1a → 3a → 3b
0d + 3a → 4a → 4b → 4c → 4d             (billing path, one at a time)
4c → 5
1a → 6
1a → 7a → 7b → 7c                       (permissions path, one at a time)
3b → 8a ; 7b → 8b
all → 9
```

Each step below has the same seven parts. "Files/modules" are blocks inside `recruitment-os-prototype.html` unless a path is given.

---

### Step 0a — Persistence, switches, reset

**Scope:**
- Switch registry `O2_SWITCH` and `o2On()` with the panel UI (§2.1).
- Save to `localStorage['oontu.o2.state.v1']` (debounced, after each successful `bosRun` and each older platform mutation): `BOS`, `PLATFORM_TENANTS`, `PLATFORM_TENANT_ADMINS`, `PLATFORM_SUBSCRIPTIONS`, `PLATFORM_INVOICES`, `PLATFORM_PLANS`, `PLATFORM_USER_ROSTER`, `SIGNUP_LEADS`, `JN`, `PROVISIONING`, platform `AUDIT_LOG` rows, id sequences (`subscriptionIdSeq` and similar).
- Restore after all seeds run; `schemaVersion` mismatch → discard and reseed.
- Reset demo data, Export state, Import state (§2.4).
- Tests always start fresh: honour `?fresh=1` and `window.__O2_NO_PERSIST__`; update the test runner or shared helper so every spec sets one (inspect `tests/run-auth-tests.ps1` and spec helpers first and say which you changed).
- No other behaviour change.

**Depends on:** nothing.
**Files/modules:** new `o2-switch-script`, `o2-persist-script`; login panel markup in `bos-login-script` (wrapped); `tests/` helper.
**Preserve:** every seed and its values; every `bos*` function; id formats; login dropdown.
**Regression tests:** full suite (baseline), then full suite with saving on and with saving off.
**Acceptance:**
1. A new deal, ticket and invoice survive a reload.
2. Reset restores seed state exactly (compare record counts and ids).
3. Export then Import reproduces the state; a wrong `schemaVersion` is refused with a message.
4. Full suite passes identically with saving on and off.
5. Switch panel lists `0a` and later steps (off).
**Rollback and recovery:**
- Switch `0a` off: nothing is saved or restored; the page behaves exactly as today.
- Data that remains: the saved state in localStorage (ignored while off; cleared by Reset).
- Cannot be reversed: nothing (no records are changed).
- Recovery: Reset demo data, or clear the key by hand.

---

### Step 0b — Policy store, internal flag, metrics and access-level functions

**Scope:**
- `PLATFORM_SETTINGS.policy` with every key in §4.1 (read-only UI line in Platform settings showing values and "placeholder, pending decision").
- `internal:true|false` on workspaces; seed Oontu's own and demo test workspaces as internal where they exist (list them in the report).
- `o2Mrr(sub)` and `o2MrrTotals()` per §3.8, computed from plan price per currency × seats × interval (until 4a adds items).
- `o2AccessLevel(tenant)` per §3.2, **computed and displayed only** (badge on the tenant page); not enforced.
- Dashboard MRR card uses `o2Mrr` when the switch is on; old `oSubMrr` kept and shown in a dev tooltip for comparison.

**Depends on:** 0a.
**Files/modules:** new `o2-metrics-script`; wraps `renderOontuDashboardV2` (MRR card only) and the tenant detail renderer (badge only).
**Preserve:** `oSubMrr` function; every other dashboard value; tenant actions.
**Regression tests:** `auth-flow.spec.js`, `bos-billing.spec.js`, `screens-crawl.spec.js`, `light.spec.js`; new `o2-metrics.spec.js`.
**Acceptance:**
1. MRR equals a hand calculation for three seeded cases: a monthly subscription, an annual subscription, a subscription created by checkout with proration.
2. INR and USD are shown separately; internal workspaces excluded.
3. Access-level badge matches §3.2 for every seeded tenant/subscription pair (table in the spec).
4. No behaviour changes anywhere else.
**Rollback and recovery:**
- Switch off: dashboard shows `oSubMrr`; badge hidden.
- Data that remains: `policy` object and `internal` flags (harmless to old code).
- Cannot be reversed: nothing.
- Recovery: none needed.

---

### Step 0c — Billing customer (billing)

**Scope:**
- `BOS.billingCustomers` per R2/R4 fields: `id, accountId, legalName, gstin, address, stateCode, country, market, currency, mandate, createdAt, history[]`.
- Seed one per account that has a subscription, copying today's tax details from the account (`bosSetCustomerTax` data).
- `billingCustomerId` on subscriptions (added, old fields kept).
- Market rule per `policy.marketRule`; market locked after the first invoice; change via `billing-customer.change-market` (Finance, reason, from next renewal).
- When the switch is on, `bosTaxSegment` reads buyer facts from the billing customer; `bosSetCustomerTax` writes to both places (dual-write).
- Invoices issued while the switch is on store the buyer snapshot (R4).

**Depends on:** 0b.
**Files/modules:** new `o2-billing-customer-script`; wraps `bosTaxSegment`, `bosSetCustomerTax`, checkout start, invoice issue (snapshot only).
**Preserve:** every tax result for every seed and every spec case; invoice numbering; account tax display.
**Regression tests:** `bos-tax.spec.js`, `bos-billing.spec.js`, `bos-autoinvoice.spec.js`, `bos-identity-revenue.spec.js`; new `o2-billing-customer.spec.js`.
**Acceptance:**
1. `bosTaxSegment` returns identical results with the switch on and off for all seeds and all spec cases (a spec compares both).
2. Market rule and lock behave per §3.3; a market change applies from next renewal only.
3. An invoice issued after editing the billing customer's address keeps the old address on earlier invoices.
4. All billing and tax specs green.
**Rollback and recovery:**
- Switch off: tax reads account fields again; billing-customer screens hidden.
- Data that remains: billing-customer records, `billingCustomerId` on subscriptions, buyer snapshots on invoices issued while on (old code ignores them; dual-write kept account fields current).
- Cannot be reversed: invoices issued while on (numbers and snapshots are permanent).
- Recovery: forward correction via the existing correction path if an invoice is wrong; in the prototype, Reset.

---

### Step 0d — One visible invoice model, grandfathered plans (billing)

**Scope:**
- Every O2 screen shows tax invoices (`OON/…`) only. `generateInvoiceForSubscription` keeps creating its internal `PLATFORM_INVOICES` row (linked by `sourceRef`) but screens and the overdue list read the linked tax invoice.
- `isInvoiceOverdue` reads the tax invoice's due date and settlement when the switch is on.
- Legacy plans show "Grandfathered — not for sale"; not offered in plan pickers (already true for checkout via `choosablePlans`).
- The demo tenant stays on its current plan unless the owner approves moving it (ask; do not move).

**Depends on:** 0c.
**Files/modules:** new `o2-invoice-view-script`; wraps Subscriptions detail invoice section, `isInvoiceOverdue`, dashboard overdue list, Plans list.
**Preserve:** `PLATFORM_INVOICES` data and functions; `voidInvoice` wrapper behaviour; tax invoice numbering.
**Regression tests:** `bos-billing.spec.js`, `bos-autoinvoice.spec.js`, `bos-tax.spec.js`, `auth-flow.spec.js`; new `o2-invoice-view.spec.js`.
**Acceptance:**
1. No `inv-N` number visible on any platform screen (crawl spec checks text).
2. Overdue items match tax invoices' due dates.
3. Legacy plans labelled and not selectable for new sales.
4. All billing specs green.
**Rollback and recovery:**
- Switch off: old screens show `inv-N` again.
- Data that remains: everything; no records changed.
- Cannot be reversed: nothing new.
- Recovery: none needed.

---

### Step 1a — Navigation, redirects, one access table

**Scope:**
- `NAV_LAYOUT.oontu` set to §5; `navApplyLayout('oontu')`; Admin `{ fold:true }`.
- New ids added to `RENDERERS`, rendering the old screens until their step.
- `showView` wrapper redirects old ids per §5.
- One access table: assign the strict rules for every id (old and new) in one place; `bosHomeView()` returns `oontu-home` for `platform-tenant:update`, else `oontu-mywork`.
- Remove duplicate links from Settings › Platform group (keep LinkedIn infrastructure and AI models).

**Depends on:** 0a.
**Files/modules:** new `o2-nav-script`; wraps `showView`, `filterNavForPermissions`; reads `BOS_VIEW_ACCESS`.
**Preserve:** `bos-access-strict-script` rules (same permissions per screen); record pages; login flow.
**Regression tests:** `bos-login.spec.js` (screen lists will change: show the owner the new lists per login before committing), `screens-crawl.spec.js`, `light.spec.js`, `motion.spec.js`; new `o2-nav-redirect.spec.js`.
**Acceptance:**
1. Each seeded login sees exactly the agreed screens (owner-approved list).
2. Every old id redirects; no blank or denied screen for a permitted person.
3. A person without access to a screen is sent home, as today.
**Rollback and recovery:**
- Switch off: old navigation and ids.
- Data that remains: none written.
- Cannot be reversed: nothing.
- Recovery: none needed.

---

### Step 1b — Approvals inbox and bell

**Scope:**
- `oontu-approvals`: tabs Waiting for me · I asked · Decided by me · All (`platform-audit:view`); columns request, type, amount/risk, asked by, age, expires in, record; Decide opens existing `bosApprovalDialog`.
- Finance screen tab 0 redirects to the inbox; record pages show a "Pending approval" chip linking to it instead of their own Decide button.
- Bell (platform role): `computeNotifications` returns the current employee's `BOS.notifications` plus account-help items in the same shape; each opens its record (`bosOpen`); mark read uses `bosMarkRead`. My work › Updates becomes a link to the bell.

**Depends on:** 1a.
**Files/modules:** new `o2-approvals-script`; wraps `computeNotifications`, `refreshNotifications`, finance tab renderer, deal page approval area.
**Preserve:** every approval guard (no self-approval, deal owner can't decide, 14-day validity, withdraw, business case, reasoning); notification creation in `bosRequestApproval`.
**Regression tests:** `bos-approval-guard.spec.js`, `bos-team-support.spec.js`, `bos-deal-flow.spec.js`, `bos-login.spec.js`; new `o2-approvals.spec.js`, `o2-bell.spec.js`.
**Acceptance:**
1. An approval raised by Arjun appears in Kavya's inbox and bell, not in Arjun's "Waiting for me" (it is in his "I asked").
2. Deciding from the inbox gives the same result as deciding from the old place.
3. Bell items link to the right record; unread count correct.
**Rollback and recovery:**
- Switch off: old approval places and old bell.
- Data that remains: approvals and notifications (shared with old code).
- Cannot be reversed: approvals decided (permanent).
- Recovery: a wrong decision is handled by a new request; never edit the decided approval.

---

### Step 1c — Platform search

**Scope:** for `state.role === 'oontu'`, `⌘K` searches platform records: ID detection first (`TCK-`, `OON/`, `OON-CN/`, `OON-DN/`, `APR-`, opportunity, account and workspace ids, GSTIN, email domain), then names across accounts, workspaces, employees, deals, tickets, invoices, payments, incidents; results grouped and permission-filtered (`bosCan(…,'view')`); actions where permitted (Create workspace, New ticket, Go to Approvals). Placeholder text changes for the platform role only.

**Depends on:** 1a.
**Files/modules:** new `o2-search-script`; wraps `openGlobalSearch` result building for the platform role.
**Preserve:** recruiter search for every tenant role unchanged.
**Regression tests:** any existing search spec, `screens-crawl.spec.js`; new `o2-search.spec.js`.
**Acceptance:** finds a ticket and an invoice by id and an account by name; a Sales Executive cannot see tickets outside their scope.
**Rollback and recovery:** switch off → old search; no data written; nothing irreversible.

---

### Step 2 — Home (command center)

**Scope:** `oontu-home` for people with `platform-tenant:update` (others land on My work): page head; attention queue (ranks 1–9 as in the architecture doc, each only if the viewer can open its target); KPI strip of six (§3.8: MRR, paying workspaces, trials ending, at-risk MRR with lapsed and scheduled churn beside it, open P1/P2, approvals waiting); four hand-drawn SVG charts (MRR movement, new vs lost paying workspaces, trial conversion, ticket backlog + SLA attainment) labelled "Illustrative data" where history is missing; recent activity from `BOS.events`. No chart library.

**Depends on:** 0b, 1b.
**Files/modules:** new `o2-home-style`, `o2-home-script`; reuses computations from `renderOontuDashboardV2`.
**Preserve:** old dashboard renderer (reachable when switch off).
**Regression tests:** `screens-crawl.spec.js`, `light.spec.js`, `auth-flow.spec.js` (dashboard parts); new `o2-home.spec.js`.
**Acceptance:**
1. Every KPI equals its §3.8 definition on seeds (spec computes independently).
2. Meera sees every attention type present in seeds; Arjun lands on My work.
3. Every KPI, row and chart mark navigates to its filtered list; charts have `aria-label` and hover values.
**Rollback and recovery:** switch off → old dashboard; no data written; nothing irreversible.

---

### Step 3a — Workspace lifecycle commands

**Scope:**
- Lifecycle per §3.1 as `bosRun` commands; new approval types `workspace-suspend`, `workspace-archive-early`.
- `tenant.lifecycle[]` events; emergency path; archive tombstone; retention and grace from policy.
- Old status values mapped (keep `statusLegacy`); the old tenant page's actions call the new commands when on.
- Scheduled checks (`o2LifecycleRun`, triggered like `bosRenewalRun`) for trial grace end and retention end.

**Depends on:** 1a.
**Files/modules:** new `o2-lifecycle-script`; wraps `changeTenantStatus`, `suspendTenant`/`activateTenant` callers, `TENANT_STATUS_TRANSITIONS` reads.
**Preserve:** `provisionTenant` (idempotent, resumable), `TENANT_STATUS_REASONS`, tenant admin invites.
**Regression tests:** `provisioning.spec.js`, `auth-flow.spec.js`, `signup-recovery.spec.js`, `bos-operations.spec.js`; new `o2-workspace-lifecycle.spec.js` (every allowed and refused transition, second person, emergency path, archived read-only, retention).
**Acceptance:**
1. Every transition in §3.1 works; every other transition is refused with a reason.
2. A single person cannot suspend a workspace when `suspendNeedsSecondPerson` is true.
3. Lifecycle events and audit rows exist for each change.
**Rollback and recovery:**
- Switch off: old status function and transitions.
- Data that remains: new lifecycle values on tenants changed while on. Old code reads `statusLegacy` (dual-write: keep `status` values the old code understands where one exists; `closed` ↔ `cancelled`, `provisioning` ↔ `invited`; `archived` exists in both).
- Cannot be reversed: an archive whose deletion ran (prototype: data marked deleted); decided approvals; audit.
- Recovery: restore through `workspace.restore` where allowed; for archive in the prototype, Reset or Import an earlier export.

---

### Step 3b — Workspace screens

**Scope:** `oontu-workspaces` (number cards, tabs All · Needs attention · Requests, columns and filters per architecture doc) and `oontu-workspace` (Workspace 360 tabs Overview with danger zone and typed-name confirm, Users, Billing, Entitlements read-only, Usage, Support, Activity, Configuration; Next step button). Requests tab hosts every `jn*` action, each wrapped in `bosRun`. `bosTenant360HTML` content moves into tabs; function kept as wrapper. "Not held in this prototype" where data is missing.

**Depends on:** 3a.
**Files/modules:** new `o2-workspace-style`, `o2-workspace-script`; wraps `jn*` functions, `openOontuTenantDetail`, `openCreateTenantModal` submit.
**Preserve:** every Account help action and its audit (join, decline, transfer owner, free domain, allow separate, assisted setup with 24 h consent).
**Regression tests:** `signup-recovery.spec.js` (selectors only), `provisioning.spec.js`, `screens-crawl.spec.js`; new `o2-workspace-360.spec.js`.
**Acceptance:** every old Account help and tenant page action works from the new screens; access-level badge matches §3.2.
**Rollback and recovery:** switch off → old Tenants and Account help screens; data shared, nothing new irreversible beyond 3a's.

---

### Step 4a — Subscriptions on the gateway (billing; same statuses)

**Scope:**
- Wrap `changeSubscriptionPlan`, `extendSubscriptionTrial`, `setSubscriptionRenewalDate`, `changeSubscriptionStatus`, `generateInvoiceForSubscription`, `createSubscriptionRecord` and the checkout completion in `bosRun` commands.
- Add subscription items (`items[]`: priceRef, unit price, quantity, interval) and `history[]` (R1); keep `price`, `seats`, `planId` fields written.
- Keep today's statuses and transitions unchanged in this step.
- `o2Mrr` switches to items when present.

**Depends on:** 0d, 3a.
**Files/modules:** new `o2-subscription-gateway-script`; wraps the functions above and `CHECKOUT_DONE.checkout`.
**Preserve:** proration, renewals, mandate ₹15,000 rule, dunning days, read-only flag behaviour, every billing spec expectation.
**Regression tests:** `bos-billing.spec.js`, `bos-autoinvoice.spec.js`, `bos-tax.spec.js`, `auth-flow.spec.js` (subscription parts); new `o2-subscription-gateway.spec.js`.
**Acceptance:** every subscription change produces an audit row and a domain event; no subscription field changes outside a command (spec patches functions to detect direct writes); all billing specs green; MRR unchanged for seeds.
**Rollback and recovery:**
- Switch off: old functions run directly.
- Data that remains: `items[]`, `history[]`, `billingCustomerId` (ignored by old code; old fields kept current).
- Cannot be reversed: invoices issued, renewal charges simulated, outbox messages.
- Recovery: forward correction (credit note, plan change); prototype: Reset or Import.

---

### Step 4b — Subscription statuses and enforced access (billing)

**Scope:**
- Statuses and transitions per §3.5 with mapping; `cancelAt`; approval `subscription-cancel-now`.
- Dual-write: `readOnly` kept in step with `unpaid`; `status` values old code understands written to `statusLegacy`.
- `o2AccessLevel` enforced in the customer workspace where today's read-only is enforced (same places only; no new customer UI).
- Downgrade at next renewal; licence check.
- Approval `manual-activation`: activates a subscription with its invoice still due (e.g. signed purchase order); dunning applies normally.

**Depends on:** 4a.
**Files/modules:** new `o2-subscription-status-script`; wraps `bosRenewalRun`, dunning reminders, read-only checks, `SUBSCRIPTION_TRANSITIONS` reads.
**Preserve:** dunning schedule (from policy, same defaults), reminder messages, paying a link clears read-only, nothing deleted.
**Regression tests:** `bos-billing.spec.js` (renewals and dunning), `bos-autoinvoice.spec.js`, `bos-team-support.spec.js` (read-only workspace support limits); new `o2-subscription-lifecycle.spec.js`, `o2-access-level.spec.js`.
**Acceptance:** every row of §3.2 holds for seeded and constructed cases; cancel at period end keeps full access until the paid-through date; unpaid → read-only; paying clears it.
**Rollback and recovery:**
- Switch off: old statuses and `readOnly` flag drive behaviour (kept current by dual-write).
- Data that remains: new status values and `cancelAt` (old code reads `statusLegacy`/`readOnly`).
- Cannot be reversed: cancellations approved and processed; outbox messages.
- Recovery: reactivate via a new subscription or `subscription.resume` where allowed; prototype: Reset or Import.

---

### Step 4c — Billing screens (billing; layout only)

**Scope:** split `oontu-finance` into `oontu-invoices` (Invoices · Payments · Payment links · Refunds · Reconciliation · Vault · Billing customers), `oontu-plans` (Plans · Add-ons · Promo codes · Discount policy read-only), `oontu-tax` (today's tab 5 unchanged); Subscription page per architecture doc; remove "Mark paid" from the old Subscriptions screen (link to Invoices & payments instead). Reuse existing tab renderers; no logic changes.

**Depends on:** 4b.
**Files/modules:** new `o2-billing-screens-style`, `o2-billing-screens-script`; wraps finance tab renderers, subscription detail renderer.
**Preserve:** every action in every old finance tab (verify payment with reference, payment links, refunds, reconciliation, vault view and print, drafts, issue, correct, share, promos, renewals run, tax exports).
**Regression tests:** `bos-billing.spec.js`, `bos-tax.spec.js`, `bos-autoinvoice.spec.js`, `bos-operations.spec.js` (payments, refunds), `screens-crawl.spec.js`; new `o2-billing-screens.spec.js` (each old action reachable).
**Acceptance:** each old tab's every action reachable from its new place with the same result; no "Mark paid" outside Invoices & payments.
**Rollback and recovery:** switch off → old finance screen; no data written by this step; nothing irreversible.

---

### Step 4d — Payment allocations, bank reconciliation, TDS (billing)

**Scope:** implement §3.4 exactly:
- Payment and allocation records; invoice settlement (`open`, `partly_paid`, `paid`).
- Commands: `payment.record-bank-credit`, `payment.allocate`, `payment.unallocate` (reversal), `payment.record-tds`, `tds.update-certificate`, `customer-credit.apply`.
- Suggestions only (rule 5); every bank allocation confirmed by Finance.
- Provider payments allocate to their own invoice; mismatch keeps today's exception.
- `bosAutoInvoice` unchanged in what it creates (at most one new invoice per provider payment); it now records an allocation instead of only marking paid.
- Subscription activation/renewal triggers on invoice `paid` (cash + TDS + credit).
- Integrity rules `unmatched-credit`, `tds-certificate-overdue`; Reconciliation tabs Unmatched · Partly paid · TDS receivable.
- Existing manual verification (`markInvoicePaid(id, {reference})`) becomes "record bank credit + allocate in full" in one confirmation.

**Depends on:** 4c.
**Files/modules:** new `o2-allocation-script`; wraps `bosAutoInvoice` (record allocation), `markInvoicePaid`, `bosOpenVerifyPayment`, `bosReconcile`, `bosIntegrityScan` rule list.
**Preserve:** no duplicate invoices from repeated provider events; mismatch → Finance exception; vault fingerprints; refund flow and credit notes; reconciliation checks that exist today.
**Regression tests:** `bos-autoinvoice.spec.js`, `bos-billing.spec.js`, `bos-operations.spec.js` (reconciliation, refunds), `bos-tax.spec.js`; new `o2-allocation.spec.js`.
**Acceptance:**
1. One bank credit allocated across two invoices settles both; payment status `allocated`.
2. Two payments allocated to one invoice settle it.
3. A partial payment leaves the invoice `partly_paid`; the subscription does not activate until `paid`.
4. Cash + recorded TDS equal to the outstanding amount make the invoice `paid` and the subscription active; certificate `expected` past the due window raises `tds-certificate-overdue`.
5. A bank credit with no reference match and no exact amount + payer match stays unallocated, is never auto-assigned, and raises `unmatched-credit` after `unmatchedCreditDays`.
6. A suggestion is never applied without Finance confirmation.
7. An overpayment becomes customer credit only on confirmation, and can be applied to a later invoice.
8. Reversing an allocation reopens the invoice and keeps both rows.
9. A repeated provider event creates no second invoice and no second allocation.
**Rollback and recovery:**
- Switch off: old mark-paid behaviour; invoices read their old `paid` flag.
- Data that remains: payments and allocations (old code ignores them). Dual-write: when allocations make an invoice `paid`, the old paid flag is also set; `partly_paid` leaves the old flag unpaid.
- Cannot be reversed: confirmed allocations (reversal only), TDS records, customer credits, audit.
- Recovery: reversing allocations with a reason; prototype: Reset or Import.

---

### Step 5 — Customers

**Scope:** Account 360 tabs (Overview with both renewals side by side, Contacts, Deals, Workspaces, Billing, Service, Activity) and rail; Pipeline tabs Deals · Leads · Sign-ups · Demos · Proposals (Sign-ups reuses `renderOontuSignups` content: stop step, lead sheet, call logging, outcomes, drop reasons, Follow up); Reports replaces Insights and absorbs Pipeline analytics.

**Depends on:** 4c (billing tab reads billing customers and settlement).
**Files/modules:** new `o2-customers-style`, `o2-customers-script`; wraps account renderer, Pipeline renderer, Insights renderer.
**Preserve:** deal page, `bosMatch`, duplicate review, merge and undo, intake, call logging data.
**Regression tests:** `bos-identity-revenue.spec.js`, `bos-deal-flow.spec.js`, `signup-recovery.spec.js` (sign-up parts), `bos-team-support.spec.js` (Insights scope); new `o2-customers.spec.js`.
**Acceptance:** every old Incomplete sign-ups action works from Pipeline › Sign-ups; Account 360 shows plan, billing status, workspaces, tickets and renewals on one page.
**Rollback and recovery:** switch off → old screens; no new data; nothing irreversible.

---

### Step 6 — Service and incidents

**Scope:** six visible ticket states mapped from internal states (data unchanged); Incidents screen and page (SEV 1–3, statuses Investigating · Identified · Monitoring · Resolved · Reviewed, lead, affected workspaces, linked tickets, updates timeline, update-cadence reminder, review required for SEV 1–2); Announcements (old Notifications screen moved, "Publish update" from an incident).

**Depends on:** 1a.
**Files/modules:** new `o2-service-style`, `o2-service-script`; wraps ticket list/page status display, incident renderer, announcements renderer.
**Preserve:** SLA maths, routing, email intake, support tiers, customer portal tickets, outage auto-link.
**Regression tests:** `bos-operations.spec.js`, `bos-team-support.spec.js`; new `o2-incident.spec.js`.
**Acceptance:** SLA results identical to before for all seeded tickets; outage → incident → update → announcement → resolve → review.
**Rollback and recovery:** switch off → old displays; new incident fields remain (ignored by old code); published announcements and outbox messages are irreversible (follow-up announcement to correct).

---

### Step 7a — Audit completeness (permissions; no behaviour change)

**Scope:** wrap `bosRun` and older platform commands so refused and failed commands also write audit rows; log failed sign-ins; audit rows carry the fields in §7.3. Nothing is refused or allowed differently.

**Depends on:** 1a.
**Files/modules:** new `o2-audit-script`; wraps `bosRun`, `logPlatformAudit`, sign-in failure paths in `bos-login-script`.
**Preserve:** every allow/refuse outcome; existing audit rows.
**Regression tests:** full suite (behaviour must be identical); new `o2-audit.spec.js`.
**Acceptance:** each refusal produces exactly one audit row with outcome `refused` and the reason; failed sign-ins logged without passwords or codes.
**Rollback and recovery:** switch off → refusals not logged; rows already written remain (permanent).

---

### Step 7b — MFA and step-up (permissions)

**Scope:** after password or email code, a second step asks for the simulated code (`policy.mfaMethod`); the email code alone no longer signs in; `mfaAt` on the session; step-up for `HIGH_RISK` commands plus `workspace.suspend`, `workspace.close`, `export.*`, `payment.verify`, `payment.allocate` when `mfaAt` is older than `stepUpMinutes`. Agents remain refused outright. The simulated sign-in panel shows the code.

**Depends on:** 7a.
**Files/modules:** new `o2-mfa-script`; wraps `signIn`, `authEnter`, `bosRun` (step-up check).
**Preserve:** login dropdown, `bosActAs`, all role checks.
**Regression tests:** `bos-login.spec.js` (add the MFA step to its helper), every spec that signs in (via shared helper), new `o2-mfa.spec.js`.
**Acceptance:** cannot sign in without the second step; high-risk commands ask again after `stepUpMinutes`; all existing specs pass using the updated helper.
**Rollback and recovery:** switch off → old sign-in; no data changed; nothing irreversible.

---

### Step 7c — People & access, roles, separation of duties (permissions)

**Scope:** `oontu-people` (People · Teams as records · Roles with 12 starter roles first and specialist roles collapsed · Temporary access · Access reviews quarterly campaign · Advanced: permission catalogue read-only except Security Admin); SoD warnings with Security Admin override (audited) for `finance:invoice` + `finance:verify_payment` and `user:assign` + `audit:export`; Audit & security screen (filters, tabs, export via `data-export` approval); `policy-change` approval for editing `PLATFORM_SETTINGS.policy`.

**Depends on:** 7b.
**Files/modules:** new `o2-people-style`, `o2-people-script`; wraps Employees and access renderer, `bosSetRoles`, audit renderer, Platform settings policy editor.
**Preserve:** all 31 templates, roster, grants, guards (no self-approval, no self role change, at least one Super Admin, elevation approval).
**Regression tests:** `bos-identity-revenue.spec.js` (roles, scopes), `bos-operations.spec.js` (access grants), `bos-login.spec.js`; new `o2-people.spec.js`, `o2-sod.spec.js`.
**Acceptance:** every old Employees and access action available; conflicting pairs warn and audit; policy edits need the approval.
**Rollback and recovery:** switch off → old screen; Teams records remain (ignored); role changes and approvals are permanent (change again to correct).

---

### Step 8a — Feature flags and entitlements

**Scope:** split `PLATFORM_FEATURE_CONTROLS`: plan-gated rows become plan entitlements (`ENTITLEMENT_CATALOG`), temporarily-disabled rows become ops flags in `BOS.flags`; overrides per workspace with expiry and reason; `o2Entitlements(tenantId)` and one availability check (flag ∧ entitlement ∧ workspace permission) wired into the customer app's existing feature gates without changing their UI; `oontu-controls` screen (Flags · Entitlements · Maintenance).

**Depends on:** 3b.
**Files/modules:** new `o2-controls-script`; wraps feature-gate checks (`TENANT_FEATURE_FLAGS` readers), Feature controls renderer, Workspace 360 Entitlements tab.
**Preserve:** current availability of every feature for every seeded workspace; kill switch.
**Regression tests:** `auth-flow.spec.js`, `screens-crawl.spec.js`, any feature-gate specs; new `o2-entitlements.spec.js` (availability matrix identical before and after for seeds).
**Acceptance:** availability identical for all seeds with switch on and off; an override with expiry turns off at expiry.
**Rollback and recovery:** switch off → old feature controls; flags and overrides remain (ignored); nothing irreversible.

---

### Step 8b — AI agents governance

**Scope:** `oontu-ai` (Catalogue with status and existing kill switch; Tools & policies: read, draft, act tool lists per agent, act tools may never include high-risk commands, limits per user per day and monthly budget per workspace; Activity from `BOS.agentRuns` with no prompt or output content; Usage labelled illustrative); AI models section moved into Platform settings (keys never displayed).

**Depends on:** 7b.
**Files/modules:** new `o2-ai-script`; wraps `renderOontuAgents`, `bosAsAgent`/Kairo action paths (log runs, enforce allow-list).
**Preserve:** agent refusal of high-risk commands; kill switch with reason; usage ledger.
**Regression tests:** `bos-identity-revenue.spec.js` (AI limits), `bos-operations.spec.js` (Kairo drafts); new `o2-agents.spec.js`.
**Acceptance:** an act tool outside the allow-list is refused and logged; limits enforced; activity shows runs without content.
**Rollback and recovery:** switch off → old agents screen and no allow-list enforcement; run log remains; nothing irreversible.

---

### Step 9 — Integration, QA and cleanup

**Scope:** end-to-end flows F1–F16 on the new screens (`o2-flows.spec.js` covering lead → won, hand-over → live, checkout, renewal → dunning → read-only → paid, bank transfer with TDS, refund, sensitive access); visual pass (light theme, keyboard focus, no Tailwind-card platform screens); remove old code paths **only** for switches accepted by the owner, one switch per commit, after export of a demo state; update `docs/OONTU-PLATFORM-FLOWMAP.md` and `docs/PROTOTYPE-LOGINS.md`.

**Depends on:** all.
**Preserve:** every accepted behaviour.
**Regression tests:** full suite twice in a row.
**Acceptance:** full suite green twice; one person from each department walks their flows; owner signs off the removal list.
**Rollback and recovery:** removed paths are restored by reverting the specific commit (git), not by a switch; therefore each removal is its own commit.

---

## 7. Reference tables

### 7.1 New approval types (add to `BOS_APPROVAL_TYPES`)

| Type | Approver permission | Step |
| --- | --- | --- |
| `workspace-suspend` | `platform-tenant:activate` (another person) | 3a |
| `workspace-archive-early` | `platform-tenant:activate` | 3a |
| `subscription-cancel-now` | `platform-finance:approve_refund` | 4b |
| `manual-activation` | `platform-finance:approve_correction` | 4b |
| `data-export` | `platform-access:approve` | 7c |
| `policy-change` | Security Administrator and Finance Manager (both) | 7c |

### 7.2 New permission modules and actions

| Module / action | Step |
| --- | --- |
| `platform-ai`: view, configure, kill | 8b |
| `platform-export`: request, approve | 7c |
| `platform-finance`: allocate, record_tds | 4d (grant to Finance templates that hold `verify_payment`) |

### 7.3 Audit row fields (Step 7a)

`id`, `at` (UTC), `actorType` (employee | agent | system), `actorId`, `onBehalfOf`, `command`, `resourceType`, `resourceId`, `workspaceId`, `outcome` (allowed | refused | failed), `reason`, `approvalId`, `mfaAt`, `before`/`after` (changed fields only). Never: passwords, codes, tokens, card numbers, full bank account numbers, message bodies.

### 7.4 New integrity rules

| Rule | Step |
| --- | --- |
| `emergency-suspension-review` | 3a |
| `unmatched-credit` | 4d |
| `tds-certificate-overdue` | 4d |

### 7.5 UI rules for new screens

- List: page head (context, title, one-line status, one primary action) → 3–4 number cards that filter → tabs → search and filter chips → table → row opens record.
- Record: head with status badge, owner, one Next-step button → summary rail → tabs → activity timeline → "…" menu → danger zone at the bottom of Overview (typed-name confirm, reason).
- Loading: skeleton rows. Empty: what would appear + the one action that creates it. Error: keep input, say what to do. Refusal: plain reason and who can do it.
- Type: title 24/600, section 16/600, body 14, label 12/500, table 13, metrics 28/600 tabular figures. Colour never carries meaning alone. Motion 150–200 ms ease-out; respect reduced motion.

---

## 8. What not to build

A backend, real payments, real email, AI cost dashboards with real data, ABAC policy engines, saved views, a second payment provider, the public website checkout page, SIEM integration, an Agreements module beyond an attachment, experiment flags, one subscription across several workspaces, consolidated multi-workspace invoices, reporting currency conversion, and any tax rule change pending T1–T12. If a step seems to need one of these, stop and ask.
