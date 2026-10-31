# Oontu — testing and regression (2026-10-30)

Run with `& .\tests\run-auth-tests.ps1 -Spec tests\<name>.spec.js` after the L1 to L6 changes.

| Spec | Result |
|---|---|
| light | 88 passed |
| auth-flow | 75 passed |
| corporate | 20 passed |
| flow-rules | 12 passed |
| screens-crawl | 87 passed |
| approvals | 14 passed |
| settings | 15 passed |
| clients | 31 passed |

Also run, all green: submission-flow 19, intake-flow 31, interviews 15, cowork 11, campaigns 21, cowork-journey 12, design-system 8, sidebar 6, signup-recovery 11. All 17 spec files pass.

New: `tests/intelligence.spec.js` (6 passed): funnel and dwell, Reports without invented figures, recruiter score, stalled rule, match explanation lines, workflow match field. After L7 to L11 these also passed: flow-rules 12, light 88, screens-crawl 87, submission-flow 19, settings 15, cowork 11, campaigns 21, corporate 20, auth-flow 75, clients 31, approvals 14.

Second pass (L12 to L18): `tests/intelligence.spec.js` now has 13 checks, all passing (corporate insights, client signals, Kairo log, AI disclosure line, fairness report, detailed fit and the model switch, no-forecast note). Re-run green afterwards: corporate 20, flow-rules 12, light 88, screens-crawl 87, submission-flow 19, settings 15, cowork 11, campaigns 21, clients 31. An earlier full run of all 18 files passed apart from one clients check, which pinned the client Overview to three parts; the signals moved to the Jobs tab and it passes. The last full run before the final experience-credit change in `computeJobFit` covered the other 12 files; that change touches only code that is not used for ranking.

Known limits:
- Not exercised in a browser by eye; checked through the headless specs only.
- The Cowork match field is changed but not covered by a test.
- Seeded data has few journeys, so most rates rest on tiny counts; the page shows the counts for that reason.
- The pay check reads only INR annual ranges with a fixed maximum, and only the lower bound of the candidate's range.
- Everything runs in the page with in-memory data; no backend or model exists to test.
