# O2 overnight build — report

_In progress. Written in full when the build finishes._

## 1. Outcome

- Branch `o2/overnight-2026-11-26`, started from `o2-step-0a`.

## 2. What you can see now

- **0a** Demo data survives a reload. Switch 0a · any login · sign-in screen › Prototype · simulated sign-in › O2 build › 0a on.
- **0b** Policy values in one place; MRR per currency from list prices; access level shown on each workspace. Switch 0b · Meera Krishnan · Platform overview › MRR card; Tenants › a tenant › Access level; Platform Settings › Policy values.
- **0c** Billing customer per account: invoices freeze the buyer details; market locked by the first invoice, changed only from the next renewal; tax identical. Switch 0c · Meera Krishnan (or Finance) · Accounts › Northstar Talent Partners › Billing customer card › Edit billing details / Change market.

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

## 5. Step 1a screen lists

Pending.

## 6. Old code that can be removed

Pending (Step 9).

## 7. Recommended next

Pending.
