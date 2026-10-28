# Implementation plan

Order: agency rules that exist as settings but did nothing come first. They are small and safe, and users already expect them to work. The corporate journey follows once AR-2 is approved, because it is a build of new modules, not a fix.

| Step | Node | Problem | Why now | Depends on | Scope | Acceptance | Tests | Status |
|---|---|---|---|---|---|---|---|---|
| 1 | A9 | A placement did not lower the open count or close a full job | Wrong job state feeds every report | — | `moveSubmissionStage` hook, job page "n of m open" | Joining lowers the count; last opening → Filled; ended placement reopens | flow-rules A9 | Verified |
| 2 | A6 | Rejections had no reason code | Map rule; reports need it | — | Reason dialog, `rejectReason` | No code → dialog; Other needs a note | flow-rules A6 | Verified |
| 3 | A7 | Duplicate window was a setting only | Fee disputes with clients | — | Check in `submitOneToJob` | Warn in preflight; note needed; logged | flow-rules A7 | Verified |
| 4 | A3 | (audit error) Clone a past job | — | — | Already built ("Copy a past job") | — | — | Verified (no change) |
| 5 | A5 | SLA reassignment was a setting only | Applicants wait unseen | — | `fmSlaSweep`, opened time | Unopened past SLA → next recruiter, manager told | flow-rules A5 | Verified |
| 6 | A4 | Removing a recruiter stranded their applicants | Applicants lost | Step 5 helpers | `removeRecruiterFromJob` hook | Unreviewed move; submitted keep owner | flow-rules A4 | Verified |
| 7 | A7 | Same-job duplicate showed only the owner | Map asks for date, stage, override | AR-5 for the override | Reason text; override after approval | Date and stage shown | flow-rules A7 | Partial (override awaits AR-5) |
| 8 | A8 / E4 | Client replies by email/WhatsApp not read; holds never checked | Most agency feedback arrives this way | — | Drawer card, rule reader, 7-day check-back | Proposal only until confirmed | flow-rules A8 | Verified |
| 9 | 00/01 | Request to join, saved steps, assisted setup | v5 conflicts with an earlier decision | AR-1 | Inside the OA module | — | auth spec + new | Awaiting approval |
| 10 | C3 | Requisitions | Corporate hiring cannot start | AR-2 | New module | — | new spec | Awaiting approval |
| 11 | C5/C4 | Vendors, pick per job | | Step 10 | | | | Awaiting approval |
| 12 | C7 | Vendor submissions | | Step 11, E3 | | | | Awaiting approval |
| 13 | C8/C9 | HM review link, e-sign, fee and bonus clocks | | Step 10 | | | | Awaiting approval |
| 14 | C10/E8 | Contract hiring and assignments | | Step 10 | | | | Awaiting approval |
| 15 | C6/E7 | Marketplace and jobs website | | Unverified-company rule | | | | Awaiting approval |
| 16 | E6 | One status list | | AR-4 | | | | Awaiting approval |
| 17 | A6 | "Not reachable" after two follow-ups | | — | Engagement workflow + status | | | Planned |
| 18 | E5 | Pre-joining tracker for submissions outside a campaign | | — | Reuse campaign journey engine | | | Planned |
| 19 | A2 | New client routed through E2 | | — | APS kind "client" | | | Planned |
