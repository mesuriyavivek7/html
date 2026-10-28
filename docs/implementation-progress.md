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
