# Oontu — flow gap analysis

The flow-map audit already exists and is current: `docs/product-flow-audit.md` (per-step status, with the pass 2 update), `docs/role-wise-workflow-matrix.md`, `docs/implementation-progress.md`. This file does not repeat it; it records what is still open after pass 2 and what this pass added.

## Open after pass 2 (from the trackers)

| Area | Gap | Class |
|---|---|---|
| Employee portal, e-sign | Not built | E |
| Referral bonus clock | Not built | E |
| Mailbox and WhatsApp reading, one-tap WhatsApp approvals | Need real integrations; not built | E (integration) |
| E5 pre-joining | Built as in-page plan and check-ins; no real notifications | C |
| LinkedIn multi-account, proxies, security-check bypass | Declined (platform terms and account-safety risk) | not planned |

## New findings this pass

| Id | Finding | Flow | Class | Action |
|---|---|---|---|---|
| G1 | Join, response and counter-offer figures are hand-typed constants presented as predictions; workflow condition "Relevance / Match Score" and the HM dashboard "% match" used `joinProb` | E3, A6, C8 | P0 | Relabelled; both places now use the real skills match |
| G2 | Match explanation had no availability or pay check | E3 | P1 | Added rule-based lines |
| G3 | Reports funnel counts stages but has no conversion, ageing or source breakdown | A7 to A9 | P1 | Recommended; needs stage history (see architecture) |
| G4 | Correction: I first wrote that no stage history existed. It does: every submission has `stageHistory` (stage, time, reason, who) and a `recruiterId`. What was missing was anything reading it | all | P1 | Done: `flowFunnel`, `flowDwellDays`, `flowBySource`, `flowStalled` now read it |
| G5 | `computeRecruiterScore` used org-wide `decisionHistory`; per-recruiter data already existed on submissions | A7 | P1 | Done: now per recruiter, with the sent count shown |
| G6 | Reports showed hard-coded KPIs (16 placements, 1.8 days, 21 days, 91% efficiency), a fixed placements-per-month chart and an unsourced 35% "industry benchmark" | A9 | P0 | Done: replaced with computed figures; empty states when there is no data |
