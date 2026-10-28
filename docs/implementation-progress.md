# Implementation progress

## 2026-10-28 · pass 1

**Changes**
- `recruitment-os-prototype.html`: new `<style id="flow-style">` + `<script id="flow-script">` (before `nav-script`), one function per flow-map rule: A9 `fmAfterJoin`, A6 `pipeRejectApplicant` + reason dialog, A7 `fmClientWindowHit` and duplicate details in `submitOneToJob`, A5 `fmSlaSweep`, A4 `removeRecruiterFromJob` hook, A8 `fmReadClientReply` / `fmClientApply` / drawer card, hold check-back. Job page "Positions" shows "n of m open".
- `tests/flow-rules.spec.js` (8 checks).
- Source part kept outside the repo: `fm.js`, `fm-build.ps1` (session scratchpad); edit the inlined block if they are gone.

**Tests executed (actual results)**

| Spec | Result |
|---|---|
| flow-rules (new) | 8 / 8 |
| submission-flow | 19 / 19 |
| intake-flow | 31 / 31 |
| screens-crawl | 75 / 75 |
| light (design rules, every screen, every role) | 76 / 76 |
| clients | 31 / 31 |
| interviews | 15 / 15 |
| approvals | 14 / 14 |
| settings | 15 / 15 |
| cowork | 11 / 11 |
| campaigns | 21 / 21 |
| cowork-journey | 12 / 12 |
| design-system | 8 / 8 |
| sidebar | 6 / 6 |
| auth-flow | 75 / 75 |
| approval engine checks | 32 / 32 |

**Visual check:** reject dialog and client-reply card at 1440 px (light design rules hold).

**Not verified**
- Real email/WhatsApp ingestion of client replies (the recruiter pastes the reply; production would read the mailbox).
- The SLA sweep runs on page navigation in the prototype; production needs a scheduled job.
- Manager notices from the SLA rule are stored in `FM.notices` and the audit log; they are not yet shown in the notification centre.

**Awaiting approval:** AR-1 to AR-5 in `approval-required-changes.md`.

## 2026-10-28 · pass 2 (corporate journey, AR-1, AR-3, AR-4, AR-5, steps 17 and 18)

**Changes**
- `corp-script` (new): requisitions, vendors, marketplace, vendor sign-in and portal, vendor submission rules, consent, hiring manager link, contract hiring, jobs website, E6 derived list. Pages outside the app: `#/vendor`, `#/hm/<token>`, `#/consent/<token>`, `#/time/<token>`, `#/jobs`.
- `join-script` (new): saved sign-up leads, resume, request to join, escalation, Oontu Account help, assisted set-up.
- `flow-script`: same-job override, Not reachable, pre-joining tracker, notices in the notification centre.
- Auth simulator and sign-up screen: join rules, domain liveness, request records; hooks only.
- Settings: Hiring rules gets "Client contacts sign in".

**Tests executed (actual results)**

| Spec | Result |
|---|---|
| corporate (new) | 20 / 20 |
| signup-recovery (new) | 11 / 11 |
| flow-rules (extended) | 12 / 12 |
| submission-flow, intake, crawl, light, clients, interviews, approvals, settings, cowork, campaigns, cowork-journey, design-system, sidebar, auth-flow | all green |
| approval engine checks | 32 / 32 |

**Not verified / not built**
- Employee portal, e-sign, referral bonus clock, real mailbox and WhatsApp reading, one-tap WhatsApp approvals.
- Everything runs in the page with in-memory data. Rules are single functions so they can move to a server, but production must re-check every one.
- The sweeps run on navigation; production needs a scheduler.
- A recruiter who is "Not reachable" is marked dormant for the SLA rule, but job header counts still include them.
- Plan entitlements for vendors and marketplace are not checked; only the Settings switches are.
