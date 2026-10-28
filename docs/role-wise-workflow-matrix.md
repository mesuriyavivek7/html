# Role-wise workflow matrix

Expected behaviour is from the flow map (v5). "Verified" means a spec in `tests/` checks it; "Seen" means checked by a screenshot or a manual pass only. Severity follows the master prompt (Critical, High, Medium, Low).

## Agency workspace

| Role | Sees | Can do | Must not do | Gaps found | Severity | Status |
|---|---|---|---|---|---|---|
| Owner (locked Super Admin role) | Everything, money, settings, audit | Setup, clients, jobs, approvals, roles, billing, Cowork, pause all | Lose the Owner role; be bypassed as final approval fallback | Corporate-only flows not applicable here; marketplace and jobs website are settings only (C6, E7) | Medium | Verified: settings, approvals, clients, auth |
| Recruiter Manager | Team's jobs, candidates, approvals for the team | Approve submissions, assign recruiters from own tree, Cowork for team | See other teams' data; change roles | Override request for same-job duplicates (AR-5) | Medium | Verified: settings, approvals, submission |
| Recruiter | Own and assigned jobs, own candidates | Screen, submit, Cowork for own jobs | Submit to a job they are not on; see other teams' journeys | Fixed this pass: reject reason codes (A6), duplicate-window note (A7), SLA reassignment (A5) | High → fixed | Verified: flow-rules, submission, intake |
| Client contact (no login) | Secure review link for their candidates | Shortlist, hold, reject, book interview from the link; reply by email/WhatsApp | Log in; see other clients' data | Fixed this pass: Kairo reads email/WhatsApp replies, recruiter confirms (A8) | High → fixed | Verified: interviews (links), flow-rules A8 |
| Hiring Manager (`hm` role) | Recommended candidates, interviews, feedback, decisions | Review and decide | — | Logs in to an agency workspace although the map says agency clients never log in (AR-3) | Medium | Awaiting approval |
| Candidate | Own applications, interviews, profile | Apply, confirm, reply on WhatsApp/email | See internal notes or scores | None found in this pass | — | Verified: screens crawl |

## Corporate workspace

| Role | Map expectation | Today | Gap | Severity | Status |
|---|---|---|---|---|---|
| Owner / TA Head | Requisition approvals, vendors, marketplace, jobs website, entities | Settings and approval matrix only | No requisition, vendor, marketplace or contract workflows (C3–C7, C10, E7, E8) | High | Awaiting approval (AR-2) |
| TA Recruiter | TA screening, band flag, send to HM | Jobs, candidates, interviews, campaigns | No vendor intake to screen; no HM review link | High | AR-2 |
| Hiring Manager | Raise requisitions (one sentence), review by link or email, hire decision | HM screens exist | No requisition form; review link and email-reply decision missing | High | AR-2 |
| Interviewer | Scorecard for one job, scores hidden until submitted | Interviewer secure links with scorecard | Matches the map | — | Verified: interviews |
| Approver | One-tap approval on WhatsApp/email | Approvals screen; WhatsApp one-tap is a stub | One-tap from WhatsApp not built (prototype) | Low | Partial |
| Employee | Internal jobs, referrals, internal apply | Not present | Employee portal missing | Medium | AR-2 |
| Vendor (contact, no login) | Authorised job link with one-time code, email to HR, status on the link | Not present | All of C7 | High | AR-2 |

## Oontu Super Admin

| Area | Map | Today | Status |
|---|---|---|---|
| Create tenant, owner invite | 00 | Built | Verified: auth 06k |
| Incomplete sign-ups, reminder, call outcome | 01 | Built | Verified: auth 06l |
| Assisted setup with permission | 01 | Removed by an earlier decision | AR-1 |
| Agents catalog, kill switch | K | Built | Verified: settings, cowork |

## Transition matrix: candidate on a job (agency)

| Current state | Trigger | Preconditions | Next state | Side effects | Failure handling |
|---|---|---|---|---|---|
| (none) | Apply / import / personal link | Valid application; job Active | Applied Directly | Intake dedupe, owner by time, auto-ack | Duplicate delivery suppressed; review queue for unclear matches |
| Applied | Not opened within SLA | Owner set, not opened, job Active | Applied (new owner) | Manager told, audit | No one else on the team → stays put |
| Applied | Recruiter removed from job | Applicant unreviewed | Applied (new owner) or unassigned | Audit | Submitted journeys keep their owner |
| Applied / any active | Reject | Reason code (Other needs a note) | Rejected | Reason stored, audit, stays in pool | No code → dialog, nothing written |
| Ready / Pending Review | Submit | On the job, scope, job open, no open journey | Pending Review or Ready to Send | Review request, audit | Same job → blocked with owner, date, stage; same client inside the window → note needed |
| Submitted | Client reply | Recruiter confirms Kairo's reading | Shortlisted / On Hold / Rejected | Reply kept as a note, audit | Unclear reply → recruiter picks |
| On Hold | 7 days pass | Still on hold | On Hold | Kairo checks back, note, audit | — |
| Offer Accepted | Joined | — | Joined | Open count −1; job Filled when full; replacement window | A Joined journey that ends reopens the job |
