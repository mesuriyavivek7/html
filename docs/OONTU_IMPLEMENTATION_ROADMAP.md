# Oontu — implementation roadmap

| Phase | Content | Depends on | State |
|---|---|---|---|
| 0 Baseline | Copy of the HTML in `backups/recruitment-os-prototype.pre-intelligence-audit.html`; regression specs listed in the testing doc | none | Done (no commit made, per project rule) |
| 1 Improve existing | R1, R2, R4 (first version), R6, R7 (stalled rule) done on the existing `stageHistory`. Next: R11, R12 | none | In progress |
| 1b Needs approval | R5 built and compared; switching `MATCH_MODEL` changes every percentage | owner approval | Waiting (see `OONTU_MATCHING_BEFORE_AFTER.md`) |
| 3 (done early) | R11, R12, R9 first version, R10, Kairo outcome log | none | Done |
| 2 Missing flow steps | Employee portal, e-sign, referral bonus clock, real mailbox/WhatsApp | integrations, credentials | Not started |
| 3 Intelligence on existing data | R3 events, then R4 conversion/ageing/source, R11, R12 | R3 | Not started |
| 4 Data and ML foundation | Outcomes, features, evaluation harness, fairness report (R9) | real backend | Not started |
| 5 Forecasting | R8 | Phase 4 and enough history | Not started |

Order rule: events (R3) before any analytics that claims a rate or a forecast.
