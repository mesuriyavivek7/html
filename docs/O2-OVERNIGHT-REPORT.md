# O2 overnight build — report

_In progress. Written in full when the build finishes._

## 1. Outcome

- Branch `o2/overnight-2026-11-26`, started from `o2-step-0a`.

## 2. What you can see now

- **0a** Demo data survives a reload. Switch 0a · any login · sign-in screen › Prototype · simulated sign-in › O2 build › 0a on.
- **0b** Policy values in one place; MRR per currency from list prices; access level shown on each workspace. Switch 0b · Meera Krishnan · Platform overview › MRR card; Tenants › a tenant › Access level; Platform Settings › Policy values.

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

## 5. Step 1a screen lists

Pending.

## 6. Old code that can be removed

Pending (Step 9).

## 7. Recommended next

Pending.
