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

## 2026-10-31 · M1 · one offer record (B6, flow map section 14)

Backup before any change: `backups/recruitment-os-prototype.pre-m1-offer.html`.

**Changes**
- `sb.offer` is the only offer record: `id`, `ctc`, `doj`, `status` (Made, Pending approval, Accepted, Declined, Withdrawn), `fee {amount, currency, termsVersion, line}` from `clientFee`, `exception {reasons, approvalId}`, `history`.
- `recordOffer(subId, {ctc, doj})` is the single write path (outcome dialog "Offer made" and "Revised offer", and `cpMakeOffer`). A revised offer keeps the record, moves the old values to `history`, cancels any approval still waiting, and runs the approval rule again.
- `offerException(sb, ctc)` is the one approval rule. It reads Settings → Approvals → Offer: Never (or `off`), Always, or Only when… (CTC more than 10% above the job's range or below it, skipped when the job has no range; or a job fee below the client's terms that isn't approved). The skip role's own offers need no request, and the audit says "Offer approved by rule".
- Offer exceptions go to the requester's manager (`tmManagerIdOf`, then `managerOf`), else the Owner, never the requester. The `ac2` trigger now carries the C7 wording. `requestApproval` records the acting person.
- While an offer is Pending approval the journey stays at Offer Extended, and Accepted and Joined are refused with a message naming the approver. `finalizeApprovedOffer` / `rejectPendingOffer` work on the journey; a rejection withdraws the offer with the reason.
- `ptCreateJoinedRecord` reads the accepted `sb.offer` by journey id. A recruiter with Candidates → Edit can confirm a joining with no override; the Owner override remains only when there is no offer at all. The placement carries `ctc`, `offerId`, `submissionId`, `recruiterId` (the journey owner) and the offer's fee. `ptIsTracked` matches by journey id (name only for seed rows without one). It is the one place a journey moves to Joined.
- Outcome dialog "Joined" creates the placement first and stops if it can't. One joining date: `sb.offer.doj`, mirrored to `sb.joinDate` and the pre-joining tracker (and back from `pjSetDate`).
- "Backed out" after the offer is out or accepted goes through `pjBackedOut`, which now also accepts Offer Extended (its own check only; `pjEligible` is unchanged) and withdraws the offer. Before an offer exists, backing out still withdraws directly.
- `OFFERED_CANDIDATES` is a read-only list built from the journeys; its readers use `offersList()` / `offerById()`. Approval cards, the engine's describe and registry, and `decideApproval` find offers through `offerById`.
- Seed: Rahul Shah's offer is `sub-1.offer` (Accepted). The Sneha Patel (Full Stack Developer, RetailX) and Neha Joshi (QA Lead) seed offers had no matching job or journey and were dropped. The "placements" figure in Insights now counts PayTrack (joined + completed).
- Lineup "Extend Offer" became "Record the client's offer" and opens the outcome dialog. `openOfferModal`, `confirmExtendOffer`, the old offer modal, `recordOfferDecision` (no callers), `offerRequiresApproval` and `parseApprovalThresholdLPA` were removed. `coBandCheck` was not touched.
- Campaigns: accepting, declining and "did not join" update `sb.offer`; a pending offer can't be accepted in the campaign; joining creates the placement first.
- Approval engine (`oontu-approval-sla-engine.js` and its inline copy, edited the same way because the copy has drifted): follow-through uses the real statuses.
- `tests/m01-offer.spec.js` (new, 9 tests).

**Dashboard numbers that changed (seed data)**

| Number | Before | After | Why |
|---|---|---|---|
| Insights · placements | 1 | 12 | counted from PayTrack (joined + completed), not offers |
| Revenue (computeRevenue, Insights revenue) | ₹3,49,860 | ₹4,66,480 | accepted or joined offers are now Rahul ₹24L and Ananya Iyer ₹32L (sub-8), not Rahul and Sneha ₹18L |
| Home briefing · live offers | ₹3.8L | ₹2.0L | only Rahul's offer is live; Neha's seed offer is gone |
| Weekly summary · offers | 3 | 2 | Rahul + Ananya |
| Notifications · offer items | 3 | 2 | same |
| Offered candidates card | Rahul, Sneha, Neha | Rahul, Ananya | same |
| Kairo offer and joining suggestions · unanswered offers | 1 | 0 | Neha's seed offer was the only one |
| Cowork offers signals · unanswered offers | 1 | 0 | same |
| Corporate dashboard · offer acceptance | 67% (2 of 3) | 100% (2 of 2) | same |

Unchanged: weekly accepted (2), weekly joined (3), Home "3 placements made so far".

**Tests executed (actual results)**

| Spec | Result |
|---|---|
| m01-offer (new) | 9 / 9 |
| approvals | 14 / 14 |
| auth-flow | 75 / 75 |
| campaigns | 21 / 21 |
| clients | 31 / 31 (alone; under parallel load the 50 ms search timing check took 63–75 ms, unrelated to offers) |
| corporate | 20 / 20 (alone; once under load two consent checks failed on an exact-millisecond clock comparison, unrelated to offers) |
| cowork-journey | 12 / 12 |
| cowork | 11 / 11 |
| design-system | 8 / 8 |
| flow-rules | 12 / 12 |
| intake-flow | 31 / 31 |
| intelligence | 13 / 13 |
| interviews | 15 / 15 |
| light | 88 / 88 |
| screens-crawl | 87 / 87 |
| settings | 15 / 15 |
| sidebar | 6 / 6 |
| signup-recovery | 11 / 11 |
| submission-flow | 19 / 19 |
| approval engine checks | 32 / 32 |

No existing spec was edited.

**Visual check:** at 1440 px: the outcome dialog ("Record the client's offer"), the pipeline drawer with an offer waiting for approval, the dialog while pending, and the manager's approval detail.

**Not verified**
- Not opened in a browser: the revised-offer dialog, PayTrack after a joining, the campaign offer sheet, the corporate dashboard, phone widths. These are covered by specs only.
- Contract and temporary hires still become a PayTrack placement, as before; there is no contract assignment (M9).
- Routing is manager, else Owner (M4 replaces it). The old "Offer Pending Approval" stage is still in filters and labels, but nothing sets it (M5).
- Pre-existing, not from M1: on sign-in the page logs `insertBefore` from `addMenu`; the backup shows the same error.

## 2026-10-31 · M2 · applicants get an owner (B1, flow map section 10)

Backup before any change: `backups/recruitment-os-prototype.pre-m2-owner.html`.

**Changes**
- `applicantOwnerFor(job, ev, candidate)` is the one rule, called by `intakeAttach` for a new journey only.
  - Personal link first: `utm_content` from the application (payload or context UTM fields, or the landing or referrer URL), matched case-insensitively. It counts only if that person is active and on the job team or is the job lead; otherwise the audit says "Personal link from <name> not used: <reason>" and the rule moves on.
  - Then the job's routing: round-robin (position stored on the job as `job.routing.lastId`), workload (fewest open applicants on the job, tie → team order), skill match (`skillMatchScore()`, its own function so it can be swapped; tie → workload; no skill history → workload), manual (the job lead).
  - With no active recruiter on the job: the job lead, then the Owner. Never unowned.
- `routingMode()` treats 'round-robin' and 'round_robin' as the same. The workspace setting (`hiring.distribute`) is the default for new jobs and for jobs that have no value.
- `jobLeadOf(job)` = `jobLeadId`, else the job's owner (`recruiterId`); the Owner after that.
- `isActiveRecruiter()` is one shared active test, used only in routing, the SLA sweep and A4. Approvals and Team screens are unchanged (M4).
- New agency applicants start at the existing 'Applied Directly' stage (shown as "Applied"). They get their owner through `setJourneyOwner` (ownerHistory with the reason; the routing rule is stored as `sub.ownerRule`) and `slaFrom`. They are no longer added to `job.submitted`. Corporate intake is unchanged.
- Duplicate reviews: when the journey's owner came only from the Owner fallback (`ownerRule === 'Owner fallback'`), the case goes to the central intake queue with `queueReason` "No one on the job; owner is the Owner fallback".
- Duplicate-review priority uses `subPhase(sb) === 'applied'` instead of stage names, so an applicant (new, or an old inbound journey at 'Submitted' that was never sent) is not "already in the hiring process".
- SLA sweep: an inbound applicant with no owner gets one through the same rule (audit "Owner assigned: had none"; its SLA clock starts then, so it can't move in the same sweep). When nobody else is on the job, an unopened applicant moves to the job lead, then the Owner, skipping the current owner; it is never "moved" to the same person. The manager is still told.
- A4 (removing a recruiter from a job): the same fallback, job lead then Owner.
- Job form: the Manual option reads "Goes to the job lead."; new jobs take the workspace routing as their default.
- `tests/m02-applicant-owner.spec.js` (new, 15 tests).

**Changed lines in an existing spec** (`tests/intake-flow.spec.js`; only what this module deliberately changes)

| Check | Before | After |
|---|---|---|
| B1 (line 177) | `eq(r.submission.stage, 'Submitted'); eq(r.submission.recruiterId, null, 'no owner is assigned silently');` | `eq(r.submission.stage, 'Applied Directly'); assert(r.submission.recruiterId, 'an owner is assigned');` |
| C1 | `eq(j.submitted, 1, 'counted once');` | `eq(j.submitted, 0, 'an applicant is not counted as submitted');` |
| F1 | `eq(j2.submitted, 1);` | `eq(j2.submitted, 0);` |

**Seeded data**
- The seed's applications (`job.interested`) go through intake on every page load. Neha Joshi's Careers Page application on Senior Java Developer (j1, `sub-9`) is now created at 'Applied Directly' and given an owner by round-robin: Priya Sharma (j1's team is Priya, then Divya). Before M2 it was 'Submitted' with no owner.
- So the sweep's "Owner assigned: had none" touches 0 seeded journeys; it applies to unowned applicants created any other way.
- `job.submitted` seed values are not recalculated (M5). The only change is j1, because its seeded application no longer adds to it.

**Numbers that changed (seed data)**

| Number | Before | After |
|---|---|---|
| j1 "submitted" (job card, jobs table, bottlenecks) | 3 | 2 |
| Priya's jobs, submissions total (`performanceTodayHTML`) | 14 | 13 |
| All jobs, sum of `job.submitted` | 15 | 14 |
| Journeys at 'Submitted' / 'Applied Directly' | 9 / 16 | 8 / 17 |
| Applicants with no owner | 1 | 0 |

Unchanged: revenue, offers, placements, notifications, jobs needing attention (8), the recruiter score (outreach volume is capped at 100 either way).

**Tests executed (actual results)**

| Spec | Result |
|---|---|
| m02-applicant-owner (new) | 15 / 15 |
| intake-flow (3 lines changed, above) | 31 / 31 |
| m01-offer | 9 / 9 |
| approvals | 14 / 14 |
| auth-flow | 75 / 75 |
| campaigns | 21 / 21 |
| clients | 31 / 31 |
| corporate | 20 / 20 |
| cowork-journey | 12 / 12 |
| cowork | 11 / 11 |
| design-system | 8 / 8 |
| flow-rules | 12 / 12 |
| intelligence | 13 / 13 |
| interviews | 15 / 15 |
| light | 88 / 88 |
| screens-crawl | 87 / 87 |
| settings | 15 / 15 |
| sidebar | 6 / 6 |
| signup-recovery | 11 / 11 |
| submission-flow | 19 / 19 |
| approval engine checks | 32 / 32 |

All in one run (three at a time); no timing flakes this time.

**Visual check:** the job form's "How new applicants are shared" cards at 1440 px.

**Not verified**
- Not opened in a browser: the pipeline and Applicants lists with a routed applicant, the owner history panel, the central intake queue card with its reason, the SLA notice in the notification centre. Covered by specs only.
- `fmManagerOf` still uses teams, not Reports to (M4). `job.submitted` seed values are not recalculated, and 'Applied Directly' is not renamed (M5).
- Skill match reads skills from past journeys in this browser's data only; there is no history across workspaces.
- Setting the owner at load writes "Journey owner set" audit lines for the seeded application (one), although intake itself is silent for seed data.

## 2026-10-31 · M3 · submission rules, review and sending (B2, B3; flow map sections 05, 06, 09, 12)

Backup before any change: `backups/recruitment-os-prototype.pre-m3-rules.html`.

**Changes**
- `jobSubmissionRules(job)` is the one reader for a job's rules: `approvalBeforeClient`, `hideContacts`, `maxProfiles`, `required`. Saved rules win; anything missing comes from Settings › Hiring rules (`preApproval`, `maskContacts`, `maxProfiles`). A job with no saved rules (every seeded job) has **no required fields** until its rules are saved.
- New jobs start from Settings, including the required list (`requiredFromSetting()` turns the comma-separated line into the job form's names) and `replacementDays`. Settings values are only defaults: changing them never changes a job's saved rules.
- Review: `submissionReviewerFor` returns no reviewer when the job's "Approval before sending to the client" is off. When it's on, the reviewer search and skip roles are unchanged (M4 replaces the search). `SUBMISSION_POLICY` is removed.
- Required fields: `submitOneToJob` returns `code:'required_missing'` with a plain message ("Add notice period and expected CTC first.") before any write, dry runs included.

  | Required name | Checked on the candidate |
  |---|---|
  | Current CTC | `comp.current` |
  | Expected CTC | `comp.expected`, else the profile's "Expected pay" (`salary`) |
  | Notice period | `notice` |
  | Current location | `loc` |
  | Resume | `resumeFile` |
  | LinkedIn profile | `linkedin` |
  | Reason for change, Interview availability | **not checked**: the profile has no field for them yet. They never block; the submit result lists them as `uncheckedRequired`. |

  "Not filled" means empty or "—".
- Send dialog: when the job hides contacts, the mask is on, can't be turned off ("Hidden for this job"), and `csSend` forces it. When the job shares contacts, the mask starts off and the sender may still hide them. More ready profiles than the job allows: Send is blocked with "This job allows 3 profiles per send. Remove 2.", and `csSend` checks the same, so it can't be bypassed. The right-to-represent tick box is unchanged (M7).
- The agency Recruiter role can send a Ready profile: 'Send to Client' added to the seed role, the agency template, and `migrateRole` for existing agency workspaces. Corporate templates are unchanged. The reviewer's "Approve & send to client" is unchanged.
- Approval engine (`oontu-approval-sla-engine.js` and its HTML copy, edited the same way): new adapter hook `followThroughOwner`. A submission's "Send to client" follow-through goes to the requester if their role can send, otherwise to the reviewer who approved it. When the app can't tell (the engine checks run without the app), it stays with the requester as before.
- Wording: Settings "Maximum profiles per job" → "Maximum profiles per send"; job form and its Review step "Max profiles per submission" → "Max profiles per send".
- `tests/m03-submission-rules.spec.js` (new, 10 tests).

**Changed line in an existing spec** (`tests/submission-flow.spec.js`, its `reset()`)

| Before | After |
|---|---|
| `SUBMISSION_POLICY.recruiterSubmissionsNeedReview = true;` | (line removed: the constant no longer exists; the spec's jobs have no saved rules, so they take the workspace default, review on, and behave as before) |

**Numbers that changed:** none. The dashboard, applicant and offer figures compared before and after are identical.

**Tests executed (actual results)**

The 21 browser specs: approvals, auth-flow, campaigns, clients, corporate, cowork-journey, cowork, design-system, flow-rules, intake-flow, intelligence, interviews, light, m01-offer, m02-applicant-owner, m03-submission-rules, screens-crawl, settings, sidebar, signup-recovery, submission-flow.

| Spec | Result |
|---|---|
| m03-submission-rules (new) | 10 / 10 |
| submission-flow (1 line removed, above) | 19 / 19 |
| approvals | 14 / 14 |
| auth-flow | 75 / 75 |
| campaigns | 21 / 21 |
| clients | 31 / 31 |
| corporate | 20 / 20 |
| cowork-journey | 12 / 12 |
| cowork | 11 / 11 |
| design-system | 8 / 8 |
| flow-rules | 12 / 12 |
| intake-flow | 31 / 31 |
| intelligence | 13 / 13 |
| interviews | 15 / 15 |
| light | 88 / 88 |
| m01-offer | 9 / 9 |
| m02-applicant-owner | 15 / 15 |
| screens-crawl | 87 / 87 |
| settings | 15 / 15 |
| sidebar | 6 / 6 |
| signup-recovery | 11 / 11 (alone; once under load R8 failed on an exact-millisecond clock comparison, same on the M3 backup, unrelated) |
| approval engine checks | 32 / 32 |

Test runner note: specs now run each in their own browser context. Without that, parallel pages shared `localStorage`, so the approval engine's saved state could leak between specs; this caused one intermittent m03 failure before the change, none after (three repeat runs).

**Visual check:** the send dialog at 1440 px with contacts hidden for the job and two profiles on a one-per-send job.

**Not verified**
- Not opened in a browser: the job form's rules step with Settings defaults, the submit results list showing "Add … first.", the approvals follow-through card after approval, Settings › Hiring rules with the new label. Covered by specs only.
- Gap: "Reason for change" and "Interview availability" can be chosen as required, but there is nothing on the profile to check, so they never block. They come back in the submit result as `uncheckedRequired`.
- Seeded jobs keep their rules unsaved, so none of them has required fields until someone saves the job's rules.
- The right-to-represent tick box is unchanged (M7); the reviewer search is unchanged (M4).

## 2026-10-31 · M4a · approval routing (B4 part 1; flow map sections 05, 06, 07)

Backup before any change: `backups/recruitment-os-prototype.pre-m4a-routing.html`. Not changed in M4a: data scope (M4b), menu and Home (M4c), Team actions and suspend hand-over (M4d).

**Changes**
- `approverFor(kind, requester, ctx)` is the one routing rule for `submission`, `offer`, `client`, `job` and `jobAccess`:
  1. The Settings › Approvals mode for the kind is off (not used for submission, which the job decides, or offer, which `offerException` decides) → approved by rule. The requester acting as Owner → approved by rule, "Owner, no one above". The requester's role is the kind's skip role → approved by rule. For submissions, the 'Submit Without Review' permission is an extra skip.
  2. Walk up Reports to (`tmManagerIdOf`) one person at a time. Inactive people (`isActiveRecruiter`) are skipped. Someone on leave is replaced by their delegate if the delegate qualifies.
  3. The first person whose role approves the kind (`approves[kind]`, or approvals · Approve when the role has no entry for it) and who can see the work (on the job as assigned, job lead or job owner, or jobs scope "all") is the approver.
  4. Nobody qualifies → the Owner. "Never the requester" is checked by person record: if the Owner fallback would be the requester's own record (Priya in the Recruiter persona with nobody qualifying on her line) → approved by rule, "Requester is the only Owner".
  It returns `{ user, route, reason, approvedByRule }`. Approved-by-rule cases are audited on submissions, offers and new clients.
- Every routed request stores `route` (each person checked and why they were skipped) and `routeReason`. No new UI yet.
- Wired into submission review (`submissionReviewerFor` is now a thin wrapper; the hardcoded manager-role skip is gone), offer exceptions (M1's interim `offerApprover` removed), job access (`jobAccessApproverFor`), new client (`clientApprover`) and the job policy's `reports_to` reviewer.
- Skip roles come from Settings › Approvals (`roleIdForName`: Owner → the protected top role, Recruiter Manager / TA Head → `role_recmgr`, other names by role name, Nobody → none). M1's `OFFER_SKIP_ROLES` map is replaced by it.
- Agency default approve powers: Owner everything; Recruiter Manager `{ client:false, job:true, submission:true, offer:true, jobAccess:true }`; Recruiter nothing. Corporate defaults unchanged (`offer:{ maxBand:'B3' }` for TA Head).
- One `roleHasPermission` (the later behaviour: migrates the role and maps `ai` to `kairo`).
- `fmManagerOf` (SLA notices) uses Reports to instead of teams.
- Delegation: `delegateFor(user, at)` reads `APS.config.delegations`, the store the approval engine already routes with. Settings › You › Delegation now reads and writes that same store for the signed-in person (same rows; no end date is stored as 2099-12-31). The old `DELEGATIONS` panel (in `renderRolesPermissions`) was removed: its view always redirects to Settings, so it never rendered and nothing read it. `WSX.delegation` is left in place but no longer used.
- `tests/m04a-approval-routing.spec.js` (new, 13 tests).

**Remaining routes that don't use Reports to**
- The job policy's `team_manager` reviewer still uses teams (`managerOf`). `jobAccessApproverFor` no longer uses `managerOf`.
- Fee below the client's terms and manual tax lines stay Owner-only.
- Seeded approval requests keep their stored approver (Arjun Kapoor).

**Gaps and overlaps noted, not changed**
- "Contract above a value" (client) and "Job above a budget" (job) have no check anywhere; the 'condition' mode is treated as on for client, job and submission.
- "Pre-submission approval" (Hiring rules) and the Submission row (Approvals) overlap. The job's rule decides whether a review is needed; from the Submission row only the skip role and the SLA are used. To be tidied later.
- `jobAccess` has no row in Settings › Approvals, so it's always on with no skip role.
- When "Requester is the only Owner" applies to a job access request, the request still goes to the Super Admin record, which is the requester. Edge case of the Recruiter persona only.

**Changed lines in an existing spec** (`tests/m01-offer.spec.js`)

| Check | Before | After |
|---|---|---|
| Offer over the range (setup) | `wsxOffer(); asRecruiter('RP-081'); var sb = atOffer('Over Range'), ctc = +(34 * 1.15).toFixed(1);` | `wsxOffer(); asRecruiter('RP-081'); var j4 = jobById('j4'); if(j4.assignedRecruiters.indexOf('RP-092') < 0) j4.assignedRecruiters.push('RP-092');   // since M4a the approver must be on the job` then `var sb = atOffer('Over Range'), ctc = +(34 * 1.15).toFixed(1);` |
| Owner with skip "Nobody" (expectation) | `ok(sb4.offer.status === 'Pending approval' && rq && rq.approverUserId !== 'RP-088', 'without the skip the Owner’s offer goes to someone else, never the requester: ' + (rq && rq.approverName));` | `ok(sb4.offer.status === 'Made' && !rq && audits('Offer approved by rule', sb4.id).length === 1, 'the Owner’s offer is approved by rule (Owner, no one above), never sent to someone below');` |

**Numbers that changed:** none. Dashboard figures and the seeded approval queue (10 pending, all with Arjun Kapoor) are identical before and after.

**Tests executed (actual results)**

The 22 browser specs: approvals, auth-flow, campaigns, clients, corporate, cowork-journey, cowork, design-system, flow-rules, intake-flow, intelligence, interviews, light, m01-offer, m02-applicant-owner, m03-submission-rules, m04a-approval-routing, screens-crawl, settings, sidebar, signup-recovery, submission-flow.

| Spec | Result |
|---|---|
| m04a-approval-routing (new) | 13 / 13 |
| m01-offer (2 lines changed, above) | 9 / 9 |
| approvals | 14 / 14 |
| auth-flow | 75 / 75 |
| campaigns | 21 / 21 |
| clients | 31 / 31 |
| corporate | 20 / 20 |
| cowork-journey | 12 / 12 |
| cowork | 11 / 11 |
| design-system | 8 / 8 |
| flow-rules | 12 / 12 |
| intake-flow | 31 / 31 |
| intelligence | 13 / 13 |
| interviews | 15 / 15 |
| light | 88 / 88 |
| m02-applicant-owner | 15 / 15 |
| m03-submission-rules | 10 / 10 |
| screens-crawl | 87 / 87 |
| settings | 15 / 15 |
| sidebar | 6 / 6 |
| signup-recovery | 11 / 11 |
| submission-flow | 19 / 19 |
| approval engine checks | 32 / 32 |

All in one run (three specs at a time, each in its own browser context).

**Visual check:** Settings › Approvals & hiring rules › Delegation at 1440 px, after setting a delegate and an end date.

**Not verified**
- Not opened in a browser: an approval request's stored route (no UI yet), the job access request flow, a new client going to the Owner, Approvals after a delegation set from Settings. Covered by specs only.
- Seed data unchanged: Priya Sharma (Owner) still "reports to" Arjun Kapoor. The Owner check keeps the Owner from being routed to him.

## 2026-10-31 · M4b · data scope (B4 part 2; flow map sections 04 and 21)

Backup before any change: `backups/recruitment-os-prototype.pre-m4b-scope.html`. Not changed: the menu, Home and Team actions (M4c, M4d), who sees money (M8).

**Changes**
- `canIOn(moduleId, action, record)` is the one scope rule, used by the lists, the detail views and `checkScope`. Scope values:
  - all: everything
  - team: me and everyone below me in Reports to, the whole tree (`scopeTreeIds`, via `tmManagerIdOf`)
  - assigned: on the job (assigned, job lead or job owner)
  - own: for journeys, I own it; for clients, I own the account; for jobs, I own its client, or I'm on the job
  A record with no owner field passes only with All scope (no seeded record lacks an owner, so nothing in the seed is hidden for that reason).
- Journeys have a scope-only key, `journeys`, shown in the role's scope editor as **"Pipeline"** (the word the job page uses for candidates on a job). It has no permission actions.
- Agency defaults (flow 04):
  - Owner, Admin: all.
  - Recruiter Manager: team for jobs, Pipeline, interviews and approvals; all for the talent pool, candidates and clients.
  - Recruiter: assigned for jobs and interviews; own for Pipeline; all for the talent pool, candidates and clients.
  Corporate defaults are unchanged. Corporate workspaces and the agency Hiring Manager persona keep their screens' own rules (`scopeApplies()` is false for them).
- Where it applies:
  - Jobs list: every tab is filtered. Under "All jobs", jobs outside scope that are open and allow requests show as reduced rows (title, client, status, Request access; no link, candidates, team or dates). The "n open across m clients" line counts jobs in scope.
  - Job detail: opening a job outside scope shows the blocked state.
  - Job page: the Pipeline and Applicants rows, their tab counts, the pipeline health strip, the stage counts, the source counts and Kairo's job suggestions follow Pipeline scope. Job-level facts stay whole-job: openings, the filled count, "x of y open", Filled.
  - Lineup: an entry shows only when its journey is in scope.
  - Journey detail: opening a journey outside scope shows the blocked state.
  - Clients: `clientVisibleTo` calls `canIOn` (scope only; who may open the Clients page is M4c). Opening a client outside scope shows the blocked state.
  - Interviews: agency Recruiter, Recruiter Manager and Owner use `interviewInScope`; the Interviewer and Hiring Manager views are unchanged.
  - Approvals: "Needs you" stays approver-based. Team scope adds read-only rows to "Waiting on others" and "Decided" for requests raised by people in my tree.
- `checkScope` uses the same rule for job and submission actions in agency workspaces. A journey needs to be in scope, or a pending request on it must be addressed to me. The organisation boundary checks are unchanged.
- Talent pool: everyone searches all of it. A candidate in someone else's open journey still shows with its owner. For a journey outside your scope the lock shows only the owner's name, the stage and the date (no notes, CTC, client feedback, contact details, history or "Open journey").
- Seed fix: the Owner (Priya Sharma) reports to nobody (`reportingManagerId: null`). The Owner is the top of every tree.
- M4a leftover: a job access request where nobody can approve (Priya in the Recruiter persona, "Requester is the only Owner") is granted by rule, mapped and audited, never sent to herself.
- `tests/m04b-data-scope.spec.js` (new, 10 tests); `tests/m04a-approval-routing.spec.js` gains the job access case.

**Changed lines in existing specs**

| Spec · check | Before | After |
|---|---|---|
| m04a · Owner in the Recruiter persona (last line) | `ok(approverFor('submission', currentActingUser(), { jobId:withArjun.id }).user.id === 'RP-092', 'as a recruiter, her line (Arjun) still reviews when he qualifies');` | `var w = approverFor('submission', currentActingUser(), { jobId:withArjun.id }); ok(w.approvedByRule && w.reason === 'Requester is the only Owner' && !w.user, 'the Owner reports to nobody, so even with Arjun on the job she is never sent to someone below');` |
| intake-flow · G4 (setup) | `const j = liveJob({ recruiterId:null, recruiter:null, assignedRecruiters:[] });` | `const j = liveJob({ recruiterId:null, recruiter:null, assignedRecruiters:[], jobLeadId:'RP-092' });   // since M4b the manager sees only his own tree's applicants; as job lead, the applicant is his` |

**What each person sees (seed data, before → after)**

| Person | Jobs they can open | "All jobs" tab | Pipeline (journeys) | Lineup | Interviews | Clients | Approvals waiting / decided |
|---|---|---|---|---|---|---|---|
| Divya (Recruiter) | 17 → **9** | 17 → 16 (7 as request-access rows) | 55 → **10** | 36 → **8** | 17 → 17 | 9 → 9 | 11 / 1 → 11 / 1 |
| Arjun (Recruiter Manager) | 17 → **11** | 17 → 16 (5 as request-access rows) | 55 → **10** | 36 → **8** | 18 → **17** | 9 → 9 | 0 / 1 → 0 / 1 |
| Priya (Owner) | 17 → 17 | 17 → 17 | 55 → 55 | 36 → 36 | 18 → 18 | 9 → 9 | 0 / 1 → 0 / 1 |
| Priya in the Recruiter persona | 17 → **11** | 17 → 16 (5 as request-access rows) | 55 → **45** | 36 → **34** | 17 → 17 | 4 → **9** | 0 / 0 → 0 / 0 |

Before M4b every journey on a job page was visible to anyone who opened the job. Arjun's tree is Arjun and Divya now that the Owner reports to nobody. The Owner-view dashboards are unchanged.

**Tests executed (actual results)**

The 23 browser specs: approvals, auth-flow, campaigns, clients, corporate, cowork-journey, cowork, design-system, flow-rules, intake-flow, intelligence, interviews, light, m01-offer, m02-applicant-owner, m03-submission-rules, m04a-approval-routing, m04b-data-scope, screens-crawl, settings, sidebar, signup-recovery, submission-flow.

| Spec | Result |
|---|---|
| m04b-data-scope (new) | 10 / 10 |
| m04a-approval-routing (1 line changed, 1 test added) | 14 / 14 |
| intake-flow (1 line changed) | 31 / 31 |
| approvals | 14 / 14 |
| auth-flow | 75 / 75 |
| campaigns | 21 / 21 |
| clients | 31 / 31 |
| corporate | 20 / 20 |
| cowork-journey | 12 / 12 |
| cowork | 11 / 11 |
| design-system | 8 / 8 |
| flow-rules | 12 / 12 |
| intelligence | 13 / 13 |
| interviews | 15 / 15 |
| light | 88 / 88 |
| m01-offer | 9 / 9 |
| m02-applicant-owner | 15 / 15 |
| m03-submission-rules | 10 / 10 |
| screens-crawl | 87 / 87 |
| settings | 15 / 15 |
| sidebar | 6 / 6 |
| signup-recovery | 11 / 11 |
| submission-flow | 19 / 19 |
| approval engine checks | 32 / 32 |

All in one run.

**Visual check:** Divya's jobs list (All jobs) at 1440 px, with reduced "You're not on this job / Request access" rows.

**Not verified**
- Not opened in a browser: the blocked state for a job, journey or client link; the job page with only own journeys; the lineup; the scope editor's new "Pipeline" row; the Recruiter Manager's read-only approval rows. Covered by specs only.
- Corporate scope is not applied to lists in M4b (unchanged behaviour); the agency Hiring Manager persona is not scoped either.
- A delegate who is outside the requester's tree can still act on that journey only through the pending request addressed to them.

## 2026-10-31 · M4c · menu and Home from permissions (B5; flow map sections 04 and 21)

Backup before any change: `backups/recruitment-os-prototype.pre-m4c-menu.html`. Not changed: Team actions and suspend (M4d); money visibility beyond client screens (M8).

**Changes**
- Agency staff (the recruiter, manager and admin personas in an agency workspace) get one layout, `AGENCY_NAV_LAYOUT`, in the Owner's group order, filtered by the acting role's permissions and scope. Empty groups are dropped. Labels, icons, the agents filter and the corporate-item filter are kept.
  - "Workspace" is named only when Team is in it.
  - A foldable group (Insights) folds only when it holds 3 or more items.
  - "My placements" (`paytrack`) sits in Insights.
- `NAV_ITEM_ACCESS` maps each item to a permission:
  - Approvals: approvals · Approve or any approve power.
  - Jobs: jobs · View. Candidates: talentpool · View. Interviews: interviews · View. Clients: clients · View.
  - Cowork: kairo · Use agents. LinkIt: candidates · View.
  - Revenue: billing · View and reports · View. PayTrack and Billing: billing · View.
  - My placements: offers · View with Pipeline scope "own" and no billing · View.
  - Reports and Analytics: reports · View with reports scope "all". Org productivity: team · View Performance with reports scope "all". Intelligence: reports · View.
  - Team: `team-members` with team · Manage roles or Invite members, else `manager-team` with team · View Team.
  - Settings: always.
  The corporate entries of `NAV_PERMISSIONS` stay.
- One Home, one To do, one Team and one PayTrack entry per person. To do comes from Pipeline scope: own or assigned → To do, team → team To do, all → Tasks; it's shown only with jobs · View or candidates · View.
- `homeFor(role)`:
  - admin-dashboard for the Owner role, or All scope for jobs and Pipeline.
  - manager-dashboard for approvals · Approve with team Pipeline scope.
  - admin-paytrack for a role with billing but no jobs, candidates or talent pool.
  - otherwise dashboard (My day).
  Sign-in, the persona switcher, the logo link, the "Go to Dashboard" fallback and role preview use it (`homeForMe()`); corporate keeps `DEFAULT_VIEW`. Preview now shows the previewed role's menu and Home.
- A change to a role's permissions or scope rebuilds the menu at once. If the current screen is one the role no longer opens, the person goes to Home with "Your role no longer opens <page>, so you're back on Home."
- Opening a menu screen the role can't use (by link or `showView`) shows the blocked state: "Your role can't open this page."
- Blocked panel: the title is "You don't have access to this", with the reasons "You're not on this job." / "This belongs to another team." / "This belongs to another organisation." / "Your role can't open this page." The "Your …" box shows only for organisation blocks. Same component.
- Client money (agency): `clCanSeeMoney()` needs Clients · View Contracts (or org-wide authority), whatever the persona. Corporate is unchanged. The agency Recruiter default gets Clients · View (no View Contracts), so Clients is in their menu with the no-money view; the manager's "View as recruiter" mirror sees no money. The agency Recruiter Manager default gets Clients · View and View Contracts, so the RM sees money exactly as before.
- `tests/m04c-menu-home.spec.js` (new, 9 tests).

**For M8:** flow 21 says the Recruiter Manager should see no money; for now the RM keeps View Contracts so nothing changes. Money elsewhere (PayTrack, Revenue, the job page's expected fee) is not yet permission-based everywhere.

**Menu per seeded role (agency, before → after)**

| Role | Before | After | What changed |
|---|---|---|---|
| Owner | Home, Approvals, Tasks · Jobs, Candidates, Interviews, Clients · Cowork, LinkIt · Revenue, PayTrack, Billing · Insights (folded): Reports, Analytics, Org productivity, Intelligence · Team, Settings | the same | nothing |
| Recruiter Manager | Home, Approvals, To do · Jobs, Candidates, Interviews, Clients · Cowork, LinkIt · Team and insights: Team, Intelligence · Settings | Home, Approvals, To do · Jobs, Candidates, Interviews, Clients · Cowork, LinkIt · Insights: Intelligence · Workspace: Team, Settings | Intelligence moves to Insights; Team and Settings sit under Workspace |
| Recruiter | Home, To do · Jobs, Candidates, Interviews · Cowork, LinkIt · Insights: Intelligence, PayTrack · Settings | Home, To do · Jobs, Candidates, Interviews, **Clients** · Cowork, LinkIt · Insights: Intelligence, PayTrack · Settings | Clients appears (Clients · View, no money) |

Homes are unchanged for all three (dashboard, manager-dashboard, admin-dashboard). The Admin role gets the Owner's menu and Home. Corporate, hiring manager, candidate and Oontu menus are unchanged.

Spec fixtures (not product templates): Account manager → Home, Approvals, To do, Jobs, Interviews, Clients, Settings; Home is My day. Accounts → Home (PayTrack), Billing, Settings. Sourcer → Home, To do, Candidates, LinkIt, Settings, plus Cowork when an agent is on for the person; Home is My day.

**Changed lines in existing specs**

| Spec · check | Before | After |
|---|---|---|
| sidebar · RM test name | `await t('recruiter manager: Approvals next to Home; Clients with hiring; Team with insights', async function(){` | `await t('recruiter manager: Approvals next to Home; Clients with hiring; Intelligence in Insights; Team under Workspace', async function(){` |
| sidebar · RM items | `…'client-management,kairo-team,li-uni-box,manager-team,intelligence,settings'…` | `…'client-management,kairo-team,li-uni-box,intelligence,manager-team,settings'…` |
| sidebar · RM headings | `ok(heads().join() === 'Hiring,Outreach,Team and insights', heads().join());` | `ok(heads().join() === 'Hiring,Outreach,Insights,Workspace', heads().join());` |
| sidebar · recruiter items | `as('recruiter'); ok(shown().join() === 'dashboard,my-todo,jobs,talent-pool,interviews,kairo-team,li-uni-box,intelligence,paytrack,settings', shown().join());` | `as('recruiter'); ok(shown().join() === 'dashboard,my-todo,jobs,talent-pool,interviews,client-management,kairo-team,li-uni-box,intelligence,paytrack,settings', shown().join());` |
| sidebar · recruiter collapsed rail | `ok(document.querySelectorAll('#sidebar-nav .nav-item').length === 10, 'all items reachable in the collapsed rail');` | `ok(document.querySelectorAll('#sidebar-nav .nav-item').length === 11, 'all items reachable in the collapsed rail');   // 11 since M4c: Clients` |
| m04b · line 23 | `function blocked(){ var b = q('#blocked-modal-root'); return !!b && /isn’t in your data scope/.test(b.textContent); }` | `function blocked(){ var b = q('#blocked-modal-root'); return !!b && /You don’t have access to this/.test(b.textContent) && /You’re not on this job\.\|This belongs to another team\./.test(b.textContent); }` |
| signup-recovery · R6 | `state.role = 'recruiter'; showView('team-members'); assert(!q('#jn-join-card'), 'a recruiter does not'); state.role = 'admin';` | `state.role = 'recruiter'; showView('team-members'); assert(/You don’t have access to this/.test(q('#blocked-modal-root').textContent) && /Your role can’t open this page/.test(q('#blocked-modal-root').textContent), 'a recruiter can’t open Team members, so never sees the request'); closeBlockedState(); state.role = 'admin';` |

**Numbers that changed:** none (Owner-view dashboards identical).

**Tests executed (actual results)**

The 24 browser specs: approvals, auth-flow, campaigns, clients, corporate, cowork-journey, cowork, design-system, flow-rules, intake-flow, intelligence, interviews, light, m01-offer, m02-applicant-owner, m03-submission-rules, m04a-approval-routing, m04b-data-scope, m04c-menu-home, screens-crawl, settings, sidebar, signup-recovery, submission-flow.

| Spec | Result |
|---|---|
| m04c-menu-home (new) | 9 / 9 |
| sidebar (5 lines changed) | 6 / 6 |
| m04b-data-scope (1 line changed) | 10 / 10 |
| signup-recovery (1 line changed) | 11 / 11 |
| clients (unchanged) | 31 / 31 |
| approvals | 14 / 14 |
| auth-flow | 75 / 75 |
| campaigns | 21 / 21 |
| corporate | 20 / 20 |
| cowork-journey | 12 / 12 |
| cowork | 11 / 11 |
| design-system | 8 / 8 |
| flow-rules | 12 / 12 |
| intake-flow | 31 / 31 |
| intelligence | 13 / 13 |
| interviews | 15 / 15 |
| light | 88 / 88 |
| m01-offer | 9 / 9 |
| m02-applicant-owner | 15 / 15 (once under load the sweep check compared two clock readings to the millisecond and failed; passes alone, not changed) |
| m03-submission-rules | 10 / 10 |
| m04a-approval-routing | 14 / 14 |
| screens-crawl | 87 / 87 |
| settings | 15 / 15 |
| submission-flow | 19 / 19 |
| approval engine checks | 32 / 32 |

**Visual check:** the Recruiter persona's menu and the Clients list (no money) at 1440 px.

**Not verified**
- Not opened in a browser: the blocked panel's new wording, role preview with a custom role, the redirect to Home after a permission change, the RM's regrouped menu. Covered by specs only.
- Spec fixture roles only; no new role templates in the product.

## 2026-11-01 · M4d · team actions and suspend hand-over (B17, B11; flow map sections 04, 05, 21)

Backup before any change: `backups/recruitment-os-prototype.pre-m4d-team.html`. This completes M4.

**Changes**
- `canTeamAction(action, target)` replaces `tmRequireAdmin` (Owner only) on every Team action:
  - invite and resend: team · Invite members
  - suspend and reactivate: team · Deactivate members
  - edit role and delete: team · Manage roles
  - change reports to: team · Manage roles anywhere, or team · Change reports to for someone in my Reports to tree, only to someone in my tree or me
  Only an Owner acts on an Owner; nobody suspends or deletes themselves; the last active Owner can't be suspended (existing blocker and wording, until M11). The agency defaults already match flow 21 (Owner all; Admin invite, suspend, manage roles; Recruiter Manager change reports to; Recruiter none), so no permission data changed. Corporate defaults are unchanged.
- Buttons follow the permissions (same components): Invite on the Team page; edit, suspend or reactivate, and delete in the Team table and the member drawer; Edit, Reactivate and Deactivate in Settings › People. A Recruiter Manager editing someone in their tree gets the existing form with only "Reports to" open, listing their tree and themselves.
- One suspend path: Team › Suspend and Settings › People › Deactivate both open the hand-over (`openHandOver`). The plain suspend confirm (`tmRenderSuspend` / `tmConfirmSuspend`) and the old one-target hand-over (`sRenderHandover` / `sConfirmHandover`) are removed.
- `handOverWork(user, choices)`, one category at a time, each to its own person:
  - jobs: they're on, lead or own (not closed, filled or declined)
  - open journeys: via `setJourneyOwner`, reason "Hand-over from <name>"
  - approvals waiting on them: to the chosen person if they qualify (approve power, can see the work, not the requester); otherwise re-routed by `approverFor`, with the route stored
  - Cowork campaigns (not done): `ownerId` and sender
  - client accounts: `ownerId`, with a line in the client's activity
  - direct reports: under the chosen person, with the loop check
  Every category defaults to their Reports to manager, else the Owner. Empty categories aren't shown. Nothing stays with them. One audit line per category ("Hand-over: …") plus "Member suspended after hand-over". Closed journeys, done campaigns and audit lines keep the old name.
- `sPeopleScope` uses the Reports to tree (`scopeTreeIds`).
- The job approval policy's `team_manager` reviewer routes through `approverFor`, like `reports_to`. "Fell back" is recorded when nobody on the line qualifies. **The two options now behave the same and should be merged into one later (Settings options not changed).**
- `tests/m04d-team-handover.spec.js` (new, 5 tests); `tests/agency-shapes.spec.js` (new, 5 tests: Small, Classic, Larger, Mixed end to end, plus a custom Account manager).

**Changed line in an existing spec** (`tests/intake-flow.spec.js`, A2b setup; the expectation, reviewed by Arjun, is unchanged)

| Before | After |
|---|---|
| `const creator = RECRUITER_ROSTER.find(function(r){ return managerOf(r.id) && r.id!==MANAGER().id && managerOf(r.id).id===MANAGER().id; });` | `const creator = RECRUITER();   // Divya Menon (Recruiter) reports to Arjun: a member's job is reviewed by their manager (since M4d team_manager routes by Reports to)` |

**Numbers that changed**

| Where | Before | After |
|---|---|---|
| Settings › People for the Recruiter Manager (Arjun) | Priya Sharma, Divya Menon (his TEAMS team) | Divya Menon (his Reports to tree; the Owner reports to nobody) |
| Owner's Team page buttons | invite 1, edit 9, suspend 9, delete 9 | the same |
| Dashboards | — | unchanged |

**Tests executed (actual results)**

The 26 browser specs: agency-shapes, approvals, auth-flow, campaigns, clients, corporate, cowork-journey, cowork, design-system, flow-rules, intake-flow, intelligence, interviews, light, m01-offer, m02-applicant-owner, m03-submission-rules, m04a-approval-routing, m04b-data-scope, m04c-menu-home, m04d-team-handover, screens-crawl, settings, sidebar, signup-recovery, submission-flow.

| Spec | Result |
|---|---|
| m04d-team-handover (new) | 5 / 5 |
| agency-shapes (new) | 5 / 5 |
| intake-flow (1 line changed) | 31 / 31 |
| approvals | 14 / 14 |
| auth-flow | 75 / 75 |
| campaigns | 21 / 21 |
| clients | 31 / 31 |
| corporate | 20 / 20 |
| cowork-journey | 12 / 12 |
| cowork | 11 / 11 |
| design-system | 8 / 8 |
| flow-rules | 12 / 12 |
| intelligence | 13 / 13 |
| interviews | 15 / 15 |
| light | 88 / 88 |
| m01-offer | 9 / 9 |
| m02-applicant-owner | 15 / 15 |
| m03-submission-rules | 10 / 10 |
| m04a-approval-routing | 14 / 14 |
| m04b-data-scope | 10 / 10 |
| m04c-menu-home | 9 / 9 |
| screens-crawl | 87 / 87 |
| settings | 15 / 15 |
| sidebar | 6 / 6 |
| signup-recovery | 11 / 11 |
| submission-flow | 19 / 19 |
| approval engine checks | 32 / 32 |

All in one run.

**Visual check:** the hand-over dialog for Divya Menon at 1440 px (four categories, each defaulting to Arjun Kapoor).

**Not verified**
- Not opened in a browser: the Recruiter Manager's limited edit form, Settings › People › Deactivate opening the same dialog, the client activity line after a hand-over, a member drawer for a role without team powers. Covered by specs only.
- Reassigning someone's work without suspending them is not a separate action yet (the hand-over runs only on suspend).

## 2026-11-01 · M5a · one status list, part 1: the numbers (B14, B20; flow map sections 18 and 20)

Backup before any change: `backups/recruitment-os-prototype.pre-m5a-numbers.html`. M5b (one status shown everywhere) follows.

**Changes**
- One status per candidate on a job: `journeyStatus(sb)` returns the flow 18 status (Applied, Sourced, Screening, Not reachable, Not interested, Not suitable, Ready, In review, Ready to send, With client, Shortlisted, Interviewing · round, On hold, Rejected by client, Rejected at round, Selected, Offer made, Offer accepted, Offer declined, Joined, Backed out, Withdrawn). Screens don't show it yet (M5b).
  - Screening: an applicant or sourced journey its owner has opened (`openedAt`, from M2) and not yet sent. Unopened stays Applied or Sourced.
  - Ready: only from a campaign pre-screen (the person is "ready" in a campaign on the same job). **Ready from consent given and required fields complete is wired in M7, when consent becomes data.**
- Sent comes from the send record: `journeySent(sb)` is `sb.sent`, or for a non-inbound journey a history entry at "Submitted". Portal applicants never count as sent. The only journey counted through the history entry is `sub-18`, Riya Desai on Python Backend Developer (j5).
  - The funnel's "Sent to client" step, by-source, stage conversion, fairness, client signals and the recruiter score read `journeySentAt`.
  - The recruiter dashboard's "Submitted" counts sends, not every journey the recruiter owns.
  - Owner Home's job pipeline counts a journey at Submitted or Shortlisted as "with client" only once sent; otherwise screening.
- `jobSentCount(job)` replaces every read of `job.submitted` (Home job cards, jobs needing attention, briefing, Priya's performance, blocked pipelines, jobs table, close-job warning, Kairo insight, recruiter score outreach). The stored field is still written but nothing reads it.
- Placement states live in PayTrack: "Lock-in Completed" and "Revenue at Risk" are out of the stage order, the stage labels, the board and the filters. A candidate's page still shows them: the entry is Joined, with the placement state, next action and billing from PayTrack (same words as before). Joined counts read `journeyJoined(sb)`.
- "Offer Pending Approval" is removed from the stage order, labels, filters, tones and next actions (offers waiting on approval are `sb.offer` since M1). Home's briefing line "N offers waiting on approval" now counts offers waiting on approval (it counted every pending approval) and opens Approvals.
- Revenue comes from the client's terms: `revenueFeeFor(job, ctc)` uses `clientFee` with the job's terms version; a recorded offer fee wins. With no terms it uses the workspace default, labelled "Workspace default 8.33%". Used by revenue, live offers on Home (says "(some at the workspace default 8.33%)" when any are), recruiter revenue (the placement's fee first) and a new PayTrack record with no offer fee (was 10%).
- The campaign "Fee per hire" line describes the client's terms ("HealthAI’s terms: 12% of ₹25,00,000"); with no terms, "Workspace default 8.33% of the middle of the pay range". Corporate's "Agency fee avoided" line is unchanged.
- Five seed journeys had a status that disagreed with their stage. They are corrected once after all seeds load, through `moveSubmissionStage` (same stage, reason "Status corrected (was …)"), each audited:

| Journey | Before | After |
|---|---|---|
| sub-ap-2 · Meera Pillai · React Frontend Engineer | stage Interview Scheduled, status in_review, never sent, review waiting | stage Pending Review, status in_review · In review |
| sub-ap-8 · Amit Verma · React Frontend Engineer | stage Interview Scheduled, status in_review, never sent, review waiting | stage Pending Review, status in_review · In review |
| sub-iv-1 · Kunal Desai · Product Manager, Growth | stage Submitted, status active | stage Submitted, status submitted · With client |
| sub-iv-2 · Ritika Shah · Product Manager, Growth | stage Submitted, status active | stage Submitted, status submitted · With client |
| sub-iv-3 · Mohit Agarwal · Product Manager, Growth | stage Submitted, status active | stage Submitted, status submitted · With client |

  sub-ap-2 and sub-ap-8 were never sent and still have a review waiting, so they go back to In review (stage Pending Review). Their open interviews are left as they are: sub-ap-2 Technical Round "Finding a time", sub-ap-8 Technical Round "Confirmed".
- `MATCH_MODEL` stays `'skills'`.
- `tests/m05a-status-numbers.spec.js` (new, 9 tests).

**Changed lines in existing specs:** none.

**Sent to client per job** (`job.submitted` → `jobSentCount`)

| Job | Before | After |
|---|---|---|
| j1 | 2 | 6 |
| j2 | 3 | 5 |
| j3 | 1 | 1 |
| j4 | 0 | 6 |
| j5 | 2 | 3 |
| j6 | 1 | 1 |
| j7 | 2 | 2 |
| j8 | 2 | 2 |
| j9 | 1 | 1 |
| j21–j28 | 0 | 0 |
| Total | 14 | 27 |

**Numbers that changed (agency)**

| Where | Before | After | Why |
|---|---|---|---|
| Funnel (Sent 27 · Shortlisted 8 · Interview 7 · Offer 2 · Accepted 2 · Joined 1) | — | unchanged | |
| Priya's dashboard "Submitted" | 45 | 26 | counts sends, not every journey owned |
| Priya's score | 54 | 54 | unchanged (quality 27%, interview 23%, outreach 100) |
| Divya's dashboard "Submitted" | 10 | 1 | counts sends |
| Divya's score | 69 (outreach 0) | 70 (outreach 10) | outreach counts her own sends (1) |
| Arjun's score | 17 (outreach 10) | 16 (outreach 0) | outreach counts his own sends (0); it read `job.submitted` on his job |
| Revenue (Intelligence, reports) | ₹4,66,480 | ₹5,83,920 | Ananya Iyer (HealthAI, ₹32L): ₹2,66,560 at 8.33% → ₹3,84,000 at HealthAI's 12%; Rahul Shah ₹1,99,920 unchanged (recorded offer fee) |
| Home briefing | "10 offers waiting on approval …" | line not shown | no offer is waiting on approval; it counted every pending approval |
| Owner Home job pipeline, React Frontend Engineer (j2): Screening / Interview | 0 / 6 | 2 / 4 | sub-ap-2 and sub-ap-8 back in review |
| Stage counts: Interview Scheduled / Pending Review | 16 / 8 | 14 / 10 | same |
| By source, fairness, recruiter revenue, live offers, jobs needing attention, bottlenecks, campaign fee amounts | — | unchanged | |

**Corporate:** the same lines change by the same amounts (dashboards, scores, revenue, briefing, job pipeline). Corporate was wrong the same way (same journeys, same functions); nothing broke on its own.

**Follow-up the same day**
- sub-ap-2 and sub-ap-8 back to In review (above). The first run had moved only their status, which added an "Interview Scheduled" history entry and made the funnel 8 → 10 shortlisted and 7 → 9 interviewed, and Priya's score 54 → 58; those are back to their earlier values.
- Recruiter score outreach counted every send on the recruiter's jobs; it now counts sends of journeys they own or sent themselves (flow 20).
- **The sign-in screen was blank on open since M4b.** At load, `migrateLegacyFollowUps()` calls `checkScope`, which called `scopeApplies()` before the script defining it had loaded. The throw stopped the rest of that script, including `authBoot()` on the next line. Present in the pre-m4c, pre-m4d and pre-m5a backups, not in pre-m4b or the original (fd83b20). While it threw, no action was wrongly allowed or blocked: after load `scopeApplies` exists and every check ran normally; at load the one migrated follow-up (a seeded "Follow up" alert) was refused by scope before M4b too, so the outcome was the same (no follow-up created, alert left), only the "Cross-scope access denied" audit line was missing. Fix: `checkScope` uses the M4b rule only once `scopeApplies` exists; at load it uses the team rule, as before M4b. A small script at the top of the page keeps load errors in `window.__bootErrors` for the spec.
- m05a spec: 11 tests (added: no load errors except the known `insertBefore` one and the sign-in screen renders; no journey has history at Shortlisted, Interview, Offer or Joined unless sent; outreach from own sends).

**Tests executed (actual results)**

| Spec | Result |
|---|---|
| m05a-status-numbers (new) | 11 / 11 |
| agency-shapes | 5 / 5 |
| approvals | 14 / 14 |
| auth-flow | 75 / 75 |
| campaigns | 21 / 21 |
| clients | 31 / 31 |
| corporate | 20 / 20 |
| cowork-journey | 12 / 12 |
| cowork | 11 / 11 |
| design-system | 8 / 8 |
| flow-rules | 12 / 12 |
| intake-flow | 31 / 31 |
| intelligence | 13 / 13 |
| interviews | 15 / 15 |
| light | 88 / 88 |
| m01-offer | 9 / 9 |
| m02-applicant-owner | 15 / 15 |
| m03-submission-rules | 10 / 10 |
| m04a-approval-routing | 14 / 14 |
| m04b-data-scope | 10 / 10 |
| m04c-menu-home | 9 / 9 |
| m04d-team-handover | 5 / 5 |
| screens-crawl | 87 / 87 |
| settings | 15 / 15 |
| sidebar | 6 / 6 |
| signup-recovery | 11 / 11 |
| submission-flow | 19 / 19 |
| approval engine checks | 32 / 32 |

All in one run.

**Not verified**
- Not opened in a browser: the candidate page's placement entries (Lock-in Completed, Revenue at Risk), the campaign Fee per hire line, Home's briefing and job pipeline, the recruiter dashboard. Covered by specs and number scripts only.
- One page-load error remains, as in the original prototype: `insertBefore` in `addMenu`.

## 2026-11-01 · M5b · one status list, part 2: one status everywhere (B14; flow map section 18)

Backup before any change: `backups/recruitment-os-prototype.pre-m5b-status.html`. This completes M5.

**Changes (agency workspaces)**
- Every list, filter and label reads `journeyStatus(sb)`. Stored stage names stay as stored values only; history rows show them in plain words (`stageWords`).
- Who ended a closed journey (`journeyClosedBy`):
  - The client (or the hiring manager): `rejectedBy:'Client'`, reason code `client`, client feedback Rejected, a round marked Not cleared, or a closing reason "Rejected by client / hiring manager", "Not cleared", "Hiring manager decision". Shows "Rejected by client", or "Rejected at <round>".
  - The candidate: `droppedBy:'Candidate'`, reason code `not_interested`, or a closing reason "backed out / declined / dropped out / withdrew". Shows "Not interested" before sending, "Backed out" after.
  - Otherwise the agency: "Not suitable" ("Not reachable" with that reason code). Sent back in review shows "Not suitable · sent back in review". A plain withdrawal is "Withdrawn".
- Stored stage "On Hold" reads On hold. A sent journey stored at "Approved" (the hiring manager approved the profile in `hmDecision`, before any round) reads Shortlisted.
- Job chip, pipeline drawer and Talent Pool rows (`pipeLabel`): the status, then today's detail ("Interviewing · Technical Round · Wed", "With client · no feedback 4d", "· outcome due", "· no-show").
- Talent Pool: buckets from the status; the "Submitted" tab is now "In review" (in review and ready to send).
- Lineup: six progress steps (Applied · In review · With client · Interview · Offer · Joined); filters and board columns are statuses in flow order; **drag-and-drop on the board is removed** (cards open the candidate; people move them with the real action, so nothing reaches Submitted or Shortlisted without being sent). The second status word (Active / Waiting / Not Applied Yet / Closed) is no longer shown.
- Candidate page entries and timeline: the status label and the next action by status. Entries with no journey: an application is Applied, a hiring manager's "Approved" is Shortlisted, their "Rejected" is Rejected by client. A submission logged with no reviewer shows "Submitted to the job".
- The candidate's own portal shows a candidate view of the status (`journeyCandidateStatus`): Applied, In review, Shared with the employer, Interviewing · round, On hold, Selected, Offer made, Offer accepted, Offer declined, Joined, Not selected (every rejection), Withdrawn.
- Job page counts: the six status groups; closed journeys are no longer counted (they were counted under "Submitted").
- Messages: the follow-up job list, "submission is closed (…)", "already in the hiring process (…)" and "Already in this job · since … · …" use the status.
- The pipeline drawer's status chip moved under the name and job: the longer chip pushed the name and the close button out at phone width.
- The Oontu jobs website is an inbound channel in agency workspaces (flow 10): an applicant from it reads Applied (was Sourced) and is never counted as sent. No seeded journey has this source; no number changes.
- Seed: sub-ap-2 (Meera Pillai) and sub-ap-8 (Amit Verma), back in review since M5a, had open interviews; they are cancelled, audited "Interview cancelled: candidate not yet sent to the client" (int-15 Finding a time, int-12 Confirmed). The seeded double-booking moves to int-18 (Tara Bhatt, React Frontend Engineer, journey sub-iv-12, sent), now at the same time as int-13 (Priya Nair, sub-iv-8, sent), both with Suresh Iyer.

**Next action by status**

| Status | Next action |
|---|---|
| Applied | Review application |
| Sourced | Screen the candidate |
| Screening | Finish screening |
| Ready | Submit to the job |
| Not reachable | Try another way to reach them |
| In review | Waiting for review |
| Ready to send | Send to client |
| With client | Waiting for the client’s decision |
| Shortlisted | Schedule the interview |
| Interviewing · round | Prepare interview feedback |
| On hold | Check back with the client |
| Selected | Make the offer |
| Offer made | Follow up on offer response |
| Offer made · waiting for approval | Waiting for offer approval |
| Offer accepted | Confirm joining date |
| Joined | Monitor lock-in period |
| Rejected by client, Rejected at round, Not suitable, Not interested, Offer declined, Backed out, Withdrawn | No action required |

PayTrack placements keep their own next action ("Placement complete — billing eligible", "Review in PayTrack immediately").

**Labels that changed (agency, seed data)**

| Where | Before → after (journeys) |
|---|---|
| Job chip, drawer, Talent Pool row | Applied → Ready (9) · "<round> · <detail>" → "Interviewing · <round> · <detail>" (16) · "No feedback · Nd" → "With client · no feedback Nd" (3) · Tara Bhatt "Technical Round · Wed" → "Interviewing · Technical Round · outcome due" (the clash move) |
| Talent Pool tabs | All active · **Submitted** · With client · … → All active · **In review** · With client · … (12 journeys under the renamed tab) |
| Candidate portal | Submitted → Shared with the employer (8) · Interviewing → Interviewing · <round> (15) · Ready → In review (2) · Rejected → Not selected (1) · Shortlisted → Interviewing · SQL Assessment (1) |
| Candidate page / Lineup entry | Applied Directly → Applied (8) or Ready (9) · Pending Review → In review (8) · Interview Scheduled → Interviewing · <round> (15) or In review (2: sub-ap-2, sub-ap-8) · Submitted → With client (8) · Ready to Send → Ready to send (2) · Offer Accepted → Offer accepted · Rejected → Rejected by client · Shortlisted → Interviewing · SQL Assessment · Approved → Shortlisted |
| Entry next action | Review application → Submit to the job (9) · Awaiting client/HM decision → Waiting for the client’s decision (8) · Prepare interview feedback → Waiting for review (2) · Assign a job → Prepare interview feedback (1) · Submit to client → Schedule the interview (1) |
| Entry status word | Active (37), Waiting (17), Closed (5) → not shown |
| Lineup progress | Applied · Screening · Interview · Offer · Joined → Applied · In review · With client · Interview · Offer · Joined; 18 entries gain a bar (In review 10, With client 8), 2 move Interview → In review, 1 Applied → Interview, 1 Screening → With client |
| Lineup filters / board columns | All · Applied Directly · Approved · Interview Scheduled · Offer Accepted · Pending Review · Ready to Send · Rejected · Shortlisted · Submitted → All · Applied · Ready · In review · Ready to send · With client · Shortlisted · Interviewing · Rejected by client · Offer accepted |

**Job page counts** (Submitted · Interview · Feedback · Offer · Joined → Applied · In review · With client · Interview · Offer · Joined)

| Job | Before | After |
|---|---|---|
| j1 | 20 · 3 · 0 · 1 · 0 | 17 · 1 · 2 · 3 · 1 · 0 |
| j2 | 3 · 4 · 0 · 0 · 0 | 0 · 2 · 0 · 4 · 0 · 0 |
| j3 | 3 · 1 · 0 · 0 · 0 | 0 · 3 · 0 · 1 · 0 · 0 |
| j4 | 3 · 2 · 0 · 0 · 1 | 0 · 0 · 3 · 2 · 0 · 1 |
| j5 | 2 · 1 · 0 · 0 · 0 | 0 · 1 · 1 · 1 · 0 · 0 |
| j6 | 1 · 1 · 0 · 0 · 0 | 0 · 1 · 0 · 1 · 0 · 0 |
| j7 | 3 · 0 · 0 · 0 · 0 | 0 · 1 · 1 · 1 · 0 · 0 |
| j8 | 2 · 1 · 0 · 0 · 0 | 0 · 1 · 1 · 1 · 0 · 0 |
| j9 | 2 · 1 · 0 · 0 · 0 | 0 · 2 · 0 · 1 · 0 · 0 |

**Company workspaces (option b):** corporate shows exactly its pre-M5b words and behaviour on every shared screen: the chip (`pipeLabelCorp`), Talent Pool buckets and the "Submitted" tab, the Lineup (stored-stage filters and board with drag, five steps, the status word), the candidate portal, job page counts, timeline and messages. `journeyStatus` keeps the same keys in both workspaces; in corporate its label is the pre-M5b chip text. `isInboundSource` is unchanged in corporate. The only corporate label change is Tara Bhatt's chip ("Technical Round · Wed" → "Technical Round · outcome due"), from the seeded clash move, which is data shared by both workspaces.

**Corporate wording, for a separate corporate pass** (shared screens that say "client" in a company workspace; not changed now)
- Chip: "With client"; "No feedback · Nd"; "Rejected by client".
- Next step titles and details: "Waiting for <company>’s feedback"; "On hold at <company>"; "Ready to send to <company>"; "Waiting to be sent to <company>"; "Once you approve, it can go to <company>"; "It can go to <company> once approved"; "Shortlisted applicants go to <company> like any other submission"; "Clients usually reply within …"; "Record it when the client shares the offer letter."
- Buttons: "Send to client"; "Record client feedback"; "Chase client"; "Record the client’s offer".
- Talent Pool: tab "With client"; "Needs client feedback".
- Job page: "Not with <company> yet"; "<company>’s usual hiring process"; tab "With client".
- Pipeline drawer: "Client replied by email or WhatsApp?"; steps "Sent to client" and "Client feedback"; "Hiring process at <company>"; "<company>’s usual rounds".
- Candidate entries: next action "Awaiting client/HM decision"; "Submit to client".
- Careers-page applicants count as sent to client (since the original prototype). Real fix: coHmSend writes a send record, and careers-page applicants start unsent.

**Changed lines in existing specs** (`tests/m05a-status-numbers.spec.js`)

| Line | Before | After |
|---|---|---|
| 121 | `await t('"Offer Pending Approval" is gone from filters and labels; other labels unchanged; the briefing counts offers', async function(){` | `await t('"Offer Pending Approval" is gone from filters and labels; screens read the status (M5b); the briefing counts offers', async function(){` |
| 123 | `ok(O_STAGE_LABEL['Interview Scheduled'] === 'Interviewing' && O_STAGE_LABEL['Ready to Send'] === 'Ready', 'labels unchanged');` | `var rs = SUBMISSIONS.find(function(x){ return x.stage === 'Ready to Send'; }); ok(rs && pipeLabel(rs).text === 'Ready to send' && pipeLabel(rs).text === journeyStatus(rs).label, 'labels from the status (M5b)');` |

New: `tests/m05b-status-everywhere.spec.js` (10 tests).

**Numbers:** no dashboard or report number changes from M5b (all M5a numbers and dashboard snapshots identical, agency and corporate).

**Chip width check** (job page Pipeline tab and pipeline drawer, 1440 px and 390 px)
- 1440 px: no chip wraps or clips on either screen.
- Pipeline drawer at 390 px: the longer chip pushed the name and the close button out of the header. Fixed: the chip sits under the name and job (same chip style).
- Job page Pipeline rows at 390 px: names are hidden and the row runs past the right edge (chip, then button). **This was already so before M5b** (same screenshot on the backup); M5b's longer chips make the cut-off later in the row. Not changed (a job page layout fix of its own).

**Tests executed (actual results)**

| Spec | Result |
|---|---|
| m05b-status-everywhere (new) | 10 / 10 |
| m05a-status-numbers (2 lines changed) | 11 / 11 |
| agency-shapes | 5 / 5 |
| approvals | 14 / 14 |
| auth-flow | 75 / 75 |
| campaigns | 21 / 21 |
| clients | 31 / 31 |
| corporate | 20 / 20 |
| cowork-journey | 12 / 12 |
| cowork | 11 / 11 |
| design-system | 8 / 8 |
| flow-rules | 12 / 12 |
| intake-flow | 31 / 31 |
| intelligence | 13 / 13 |
| interviews | 15 / 15 |
| light | 88 / 88 |
| m01-offer | 9 / 9 |
| m02-applicant-owner | 15 / 15 |
| m03-submission-rules | 10 / 10 |
| m04a-approval-routing | 14 / 14 |
| m04b-data-scope | 10 / 10 |
| m04c-menu-home | 9 / 9 |
| m04d-team-handover | 5 / 5 |
| screens-crawl | 87 / 87 |
| settings | 15 / 15 |
| sidebar | 6 / 6 |
| signup-recovery | 11 / 11 |
| submission-flow | 19 / 19 |
| approval engine checks | 32 / 32 |

**Not verified**
- Opened in a browser (screenshots): the job page Pipeline tab and the pipeline drawer at 1440 px and 390 px. Not opened: the Lineup list and board, the Talent Pool tabs, the candidate page timeline, the candidate portal, the job page counts, and every corporate screen; covered by specs and label scripts.
- The corporate list above was gathered from the code and two rendered corporate journeys; it may not be complete.

## 2026-11-01 · M6 · one hold (B18; flow map sections 13 and 20)

Backup before any change: `backups/recruitment-os-prototype.pre-m6-hold.html`.

**What was there (verified)**
- Agency hold paths: client feedback (`cfSave`, `sb.hold {at, reason}`, audited), round outcome "On hold" including the interviewer's outcome (`ocSave`, `sb.hold`, history only, **not audited**), the client's secure link "Hold" (`slDecide`, `sb.hold {reason, by, at}`, audited), and Kairo's reply reader (`fmClientApply`, moved the stage to "On Hold", `holdCheckAt`; shared by both workspaces). A wrapper on `moveSubmissionStage` set `holdCheckAt` on any move to "On Hold".
- Only stage "On Hold" was checked back; `sb.hold` holds never were. `flowStalled` skipped `sb.hold` holds, but showed stage "On Hold" journeys as stalled 7 days after their last update.
- Endings: resume cleared the hold with history but no audit; client feedback, withdraw and backed out cleared it silently; a cleared round, an offer, and the client link's "not a fit" or booking **left the hold on**; a stage "On Hold" hold lost the stage before it.
- The hiring-manager link is company-only (`coHmSend` refuses agency jobs). No seeded journey was on hold.

**Changes (agency workspaces)**
- One record: `sb.hold = { reason, by, at, checkAt, source, checks }`, source `client feedback`, `outcome`, `client link` or `client reply`. The stage stays where it was, so a hold during a round keeps the round.
- `setHold(sb, { reason, by, source })` and `clearHold(sb, why, by)` are the only ways in and out. Both write stage history ("Put on hold: …", "Hold updated: …", "Hold ended: …") and the audit (who, from, to, why; "Put on hold", "Hold updated", "Hold cleared"). `checkAt` is 7 days out; `setHold` on a journey already on hold updates the reason and resets the check-back, keeping the date it was first held.
- All four paths call `setHold`. Kairo's reply reader no longer moves the stage to "On Hold".
- Every end calls `clearHold`: resume, client feedback shortlisted, any round outcome other than "On hold", the client link booking an interview, an offer recorded, Kairo's reply with any other status. Safety net: any move to Rejected, Withdrawn or Joined clears an open hold, with the move's reason (reject, withdraw, backed out, not a fit).
- Check-back: `fmSlaSweep` checks back every agency hold whose `checkAt` has passed; `checkAt` moves on 7 days and `checks` counts up.
  - Kairo's client follow-ups on (the Engagement agent is on for the journey's owner and its "Follow-up messages from approved templates" step runs automatically — `agentAccess('engagement')`, `agentStepLevel('engagement','followup')`): Kairo's note "Checked back with <client> about <candidate> (on hold)" and the audit, as before. Today's hold check-back read no setting at all.
  - Off: a reminder to the journey's owner, "<candidate> has been on hold at <client> since <date>. Check in with them.", audited "Hold check-back · reminder to <owner>". A hold is never left without a check-back.
- The pipeline drawer note shows for every agency hold: "On hold. Kairo checks back with <client> on <date>." (or "You’re reminded to check in with <client> on <date>." when follow-ups are off).
- Stalled: an agency hold whose check-back date has passed shows in `flowStalled`, labelled "<candidate> at <client> — on hold, past its check-back date" in the bottleneck list; holds not yet due stay out.
- Old agency journeys at stage "On Hold" are converted at load to the one record at their previous stage, audited "Hold converted". **None today.**
- `journeyStatus` reads "On hold" for every hold (unchanged).

**Company workspaces:** unchanged. Kairo's reply reader still moves the stage to "On Hold" with `holdCheckAt`; client feedback, round outcome and the client link still write the old `sb.hold`; the stage "On Hold" check-back, stalled rule and drawer note are as before.

**Changed lines in existing specs** (`tests/flow-rules.spec.js`, A8, following the listed change to Kairo's reply reader)

| Line | Before | After |
|---|---|---|
| 73 | `ok(sb.stage === 'On Hold' && sb.holdCheckAt > Date.now() + 6 * 86400000, 'on hold, check-back set');` | `ok(sb.stage === 'Submitted' && sb.hold && sb.hold.source === 'client reply' && sb.hold.checkAt > Date.now() + 6 * 86400000, 'on hold, stage kept, check-back set (M6)');` |
| 74 | `ok(out.checkedBack >= 1 && sb.holdChecks === 1 && /Checked back/.test(…), 'Kairo checked back');` | `ok(out.checkedBack >= 1 && sb.hold.checks === 1 && /Checked back/.test(…), 'Kairo checked back');` |

New: `tests/m06-one-hold.spec.js` (7 tests).

**Numbers:** none change (no seeded hold). Every M5 number, the dashboards and the stalled count (1, not a hold) are identical before and after, agency and corporate.

**Tests executed (actual results)**

| Spec | Result |
|---|---|
| m06-one-hold (new) | 7 / 7 |
| flow-rules (2 lines changed) | 12 / 12 |
| agency-shapes | 5 / 5 |
| approvals | 14 / 14 |
| auth-flow | 75 / 75 |
| campaigns | 21 / 21 |
| clients | 31 / 31 |
| corporate | 20 / 20 |
| cowork-journey | 12 / 12 |
| cowork | 11 / 11 |
| design-system | 8 / 8 |
| intake-flow | 31 / 31 |
| intelligence | 13 / 13 |
| interviews | 15 / 15 |
| light | 88 / 88 |
| m01-offer | 9 / 9 |
| m02-applicant-owner | 15 / 15 |
| m03-submission-rules | 10 / 10 |
| m04a-approval-routing | 14 / 14 |
| m04b-data-scope | 10 / 10 |
| m04c-menu-home | 9 / 9 |
| m04d-team-handover | 5 / 5 |
| m05a-status-numbers | 11 / 11 |
| m05b-status-everywhere | 10 / 10 |
| screens-crawl | 87 / 87 |
| settings | 15 / 15 |
| sidebar | 6 / 6 |
| signup-recovery | 11 / 11 |
| submission-flow | 19 / 19 |
| approval engine checks | 32 / 32 |

All in one run (an earlier run had a page-load timeout on design-system and the known m02 clock flake; both passed alone and in the final run).

**Not verified**
- Nothing in M6 was opened in a browser: the drawer note, the client feedback and outcome dialogs, the client's secure link, the owner reminder in notifications, and the bottleneck list are covered by specs only.
- Whether the owner reminder should also reach the owner's manager is not decided (it goes to the owner only).

## 2026-11-01 · M6 follow-up · a hold that doesn't move reaches the manager

Backup: `backups/recruitment-os-prototype.pre-m6b-escalate.html`.
- When a hold is checked back for the third time with nothing changing (no reply, no resume), the owner's Reports to manager is told too: "<candidate> has been on hold at <client> since <date>, checked back 3 times with no change. <owner> owns it." Audited "Hold check-back · manager told" (says so when the owner has no manager).
- A new answer that keeps the hold (setHold again) counts as a reply: the check-back count starts again.
- `tests/m06-one-hold.spec.js`: one test added (8 tests).

## 2026-11-01 · M7 · the candidate confirms right to represent (B8; flow map section 11)

Backup before any change: `backups/recruitment-os-prototype.pre-m7-consent.html`.

**What was there (verified)**
- The send dialog had a tick box (`csState.rtr`); `csSend` refused without it and stored only a time, `sb.rtrConfirmedAt` (no who, no how). The seed set it on the 26 sent journeys.
- Company workspaces: the consent page `#/consent/<token>` (`coConsentPage`, `coConsentGive`, `coConsentState`) works on vendor submissions (`CO.vsubs`), 48-hour window from `hiring.vendorConsent`, messages through `coMail` with WhatsApp, all simulated.
- `WSX.hiring.consent` ("Right-to-represent consent before submission", Settings › Hiring › Submissions, agency only, no help text) was read nowhere.
- Candidate WhatsApp is `c.phone`, email `c.email`. Agency messages to candidates log a touch (`tsLog`, audited "Candidate contacted"); `pipeTellCandidate` also opens a wa.me tab.

**Changes (agency workspaces)**
- One consent record on the journey (one per candidate and job): `sb.consent = { token, state:'pending'|'given'|'declined'|'expired', channel, sentAt, dueAt, answeredAt, how:'candidate'|'call', callNote, by }`. Earlier requests are kept in `sb.consentHistory`; a reopened journey keeps the old record in its cycle.
- `requestConsent(sb)`: logs a WhatsApp and an email touch to the candidate with the link (no wa.me tab), due in 48 hours, history line and audit "Consent requested". Called automatically on a successful submission (`submitOneToJob`) and when an applicant is shortlisted (`pipeShortlistApplicant`), unless the journey already has a pending or given consent. Review carries on meanwhile. On an expired request it sends a fresh link ("Consent link sent again").
- The consent page: `#/consent/<token>` looks up journey tokens first, then vendor tokens as before, in the same page shell. Agency wording: "<Agency> would like to put you forward to <Client> for <Job>. Tap Yes to agree." Yes / No, one tap, no login. Expired: the same expired page.
- Yes: given, audited "Candidate agreed to be represented". No: the journey closes as Not interested with the reason "Candidate declined to be represented for <Client>", its pending review is cancelled, audited "Candidate declined to be represented", the owner is told. It blocks nobody: a later submission for that job (by anyone) reopens it fresh and sends a new link.
- No answer in 48 hours: expired (on read and in the sweep), the owner is told, audited "Consent request expired". `recordConsentCall(sb, note)` records a phone confirmation; a note is required ("Called on +91…, agreed at 3 pm"); `how:'call'`, audited "Consent recorded from a call".
- Send dialog: the tick box is replaced by the consent status per profile ("Agreed on <date>", "Agreed by call · <note>", "Waiting for <name>’s yes · link sent <date>", "No answer · call and record it" with a note field, "Record call" and "Send a new link", or "Not asked yet" with "Ask <name> to agree"), and a summary line naming who hasn't agreed. Send is blocked in the dialog and in `csSend` for any profile without consent given or a recorded call. `csState.rtr` is no longer used in agency; `rtrConfirmedAt` is no longer written (old values stay).
- Pipeline drawer: the same status and actions for a journey not yet sent (Applied, Sourced, Screening, In review, Ready to send), including "Ask <name> to agree" before submitting.
- Ready: consent given (or a recorded call) + the job's required fields complete + not yet submitted. A campaign pre-screen alone no longer makes a journey Ready (it ends at "Ready to call").
- Settings › Hiring › Submissions: "Right-to-represent consent before submission" shows **On** and can't be switched off, with the help text "The candidate agrees by link, or you record a call, before a profile goes to the client." No per-job switch.
- Already-sent seeded journeys (27: the 26 with a send record plus sub-18, the older send on j5) were sent before consent existed; they are left as they are, with no consent record.

**Company workspaces:** unchanged. Vendor consent works as before; the send dialog keeps its tick box; submitting asks nobody.

**Status changes (seed): the 9 journeys Ready from the campaign pre-screen**

| Journey | Before | After |
|---|---|---|
| sub-19 Rohan Deshmukh · Senior Java Developer | Ready | Applied |
| sub-20 Meera Iyer · Senior Java Developer | Ready | Applied |
| sub-21 Aditya Kulkarni · Senior Java Developer | Ready | Applied |
| sub-22 Nisha Rao · Senior Java Developer | Ready | Applied |
| sub-23 Karthik Nair · Senior Java Developer | Ready | Applied |
| sub-24 Pooja Bhatt · Senior Java Developer | Ready | Applied |
| sub-25 Sandeep Joshi · Senior Java Developer | Ready | Applied |
| sub-26 Ritu Malhotra · Senior Java Developer | Ready | Applied |
| sub-27 Vivek Menon · Senior Java Developer | Ready | Applied |

With it: their next action "Submit to the job" → "Review application", and "Ready" leaves the Lineup filters. No other journey's status changes.

**Numbers:** none change (every M5 number, the dashboards and the stalled count are identical before and after).

**Changed lines in existing specs**

| Spec · line | Before | After |
|---|---|---|
| m03-submission-rules · 32 | `function send(ids, mutate){ openSendToClient(ids); ok(csState, 'the send dialog opened'); csState.rtr = true; if(mutate) mutate(csState); csSend(); }` | (new line before it) `function agree(ids){ … consentAnswer(token, true) on a pending link, else recordConsentCall(x, 'Called the candidate, agreed to be put forward') … }` and `… ok(csState, 'the send dialog opened'); agree(csState.subIds); if(mutate) mutate(csState); csSend(); }` |
| m03 · 66 | `csState.rtr = true; csSend(); ok(r.sub.stage === 'Submitted' …` | `agree(csState.subIds); csSend(); ok(r.sub.stage === 'Submitted' …` |
| m03 · 94 | `csState.mask = false; csState.rtr = true; csSend();` | `csState.mask = false; agree(csState.subIds); csSend();` |
| m03 · 97 | `csToggle('mask'); csState.rtr = true; csSend();` | `csToggle('mask'); agree(csState.subIds); csSend();` |
| m03 · 102 | `openSendToClient(ids); csState.rtr = true; csRender();` | `openSendToClient(ids); agree(ids); csRender();` |
| m03 · 105 | `csState = { …, resume:false, rtr:true, ref:'' }; csSend();` | `csState = { …, resume:false, ref:'' }; csSend();` |
| m03 · 107 | `… 'removing one clears it'); csState.rtr = true; csSend(); …` | `… 'removing one clears it'); csSend(); …` (consent given at line 102) |
| agency-shapes · 32 | `openSendToClient([r.sub.id]); csState.rtr = true; csSend();` | `openSendToClient([r.sub.id]); consentAnswer(r.sub.consent.token, true); csSend();` |
| m05a-status-numbers · 43 | `'statuses before sending: Applied, Sourced, Screening once opened, Ready from a campaign pre-screen, Not reachable'` | `'… Ready once the candidate agreed (M7), Not reachable'` |
| m05a · 52 | `ok(st(rd).key === 'ready' && st(rd).label === 'Ready', 'campaign pre-screen ready: Ready — ' + st(rd).label);` | `ok(st(rd).key !== 'ready', 'a campaign pre-screen alone is not Ready (M7): ' + …); recordConsentCall(rd, 'Called the candidate, agreed'); ok(st(rd).key === 'ready' && st(rd).label === 'Ready', 'agreed and required fields complete: Ready — ' + …);` |
| m05b-status-everywhere · 67 | `var ready = SUBMISSIONS.find(function(sb){ return journeyStatus(sb).key === 'ready'; }); var e = …` | `var ready = mkSub('Recommended'); recordConsentCall(ready, 'Called the candidate, agreed'); var e = …` |

New: `tests/m07-consent.spec.js` (7 tests).

**Tests executed (actual results)**

| Spec | Result |
|---|---|
| m07-consent (new) | 7 / 7 |
| m06-one-hold (1 test added) | 8 / 8 |
| m03-submission-rules (7 lines changed) | 10 / 10 |
| agency-shapes (1 line changed) | 5 / 5 |
| m05a-status-numbers (2 lines changed) | 11 / 11 |
| m05b-status-everywhere (1 line changed) | 10 / 10 |
| approvals | 14 / 14 |
| auth-flow | 75 / 75 |
| campaigns | 21 / 21 |
| clients | 31 / 31 |
| corporate | 20 / 20 |
| cowork-journey | 12 / 12 |
| cowork | 11 / 11 |
| design-system | 8 / 8 |
| flow-rules | 12 / 12 |
| intake-flow | 31 / 31 |
| intelligence | 13 / 13 |
| interviews | 15 / 15 |
| light | 88 / 88 |
| m01-offer | 9 / 9 |
| m02-applicant-owner | 15 / 15 |
| m04a-approval-routing | 14 / 14 |
| m04b-data-scope | 10 / 10 |
| m04c-menu-home | 9 / 9 |
| m04d-team-handover | 5 / 5 |
| screens-crawl | 87 / 87 |
| settings | 15 / 15 |
| sidebar | 6 / 6 |
| signup-recovery | 11 / 11 |
| submission-flow | 19 / 19 |
| approval engine checks | 32 / 32 |

All in one run.

**Not verified**
- Nothing in M7 was opened in a browser: the consent page (agency Yes/No, done, expired), the send dialog's consent lines and call field, the drawer card, the locked setting, and the owner notices are covered by specs only.
- `subPhase` treats a sourced journey that was never sent as "client" (an old quirk; M5a's status already reads it right). The drawer card uses the status, not the phase.

## 2026-11-01 · M7 follow-ups · asking again, and journeys sent before consent

Backup: `backups/recruitment-os-prototype.pre-m7b-consent-limits.html`.
- After a candidate says No, asking again within 7 days needs a note on why. Submitting again without one is refused ("<name> said no on <date>. To ask again within 7 days, add a note on why."), audited "Consent request refused". With a note, the link goes out and the audit carries the note. The drawer of the closed journey has "Ask again" with the note field.
- Never more than 2 consent links per candidate, client and job in 30 days (counting earlier requests and earlier attempts on the journey). A third is refused with the reason ("Two links have gone to <name> for <client> · <job> in the last 30 days. Call them and record it instead."), audited; the dialog and drawer then offer only "Record call".
- The 27 journeys sent before consent existed show "Right to represent · Sent before consent was recorded" in the drawer. No report, notice, audit or block treats them as missing consent (they are never asked, never expire, never blocked).
- `tests/m07-consent.spec.js`: 2 tests added (9 tests). One line of an existing m07 test changed to follow the new 7-day rule:

| Line | Before | After |
|---|---|---|
| 80 | `actAs(rec2.id); var again = submitOneToJob(j, c, 'Test'); asOwner();` | `FM.offset = T0 + 8 * 24 * H; actAs(rec2.id); var again = submitOneToJob(j, c, 'Test'); asOwner();   // after 7 days no note is needed (M7 follow-up)` |

- Results: all 30 browser specs pass in one run (m07 9/9); approval engine checks 32/32. Numbers: none change.

## 2026-11-01 · M8 · PayTrack end to end (B9, B10, B13, B16; flow map section 15; decisions C2, C3, C4)

Backup before any change: `backups/recruitment-os-prototype.pre-m8-paytrack.html`. Source read: `Oontu-Agency-Flow-v10.pdf` section 15, the role tables and decisions C2–C4.

**What was there**
- Joining created the placement with the fee from the client's terms version. Raising an invoice only flipped a status (holds from `clInvoiceHold` via the clients script); recording payment was all-or-nothing; both were Owner-only (`ptRequireTenantAdmin`). No invoice numbers, due dates, part payments or overdue.
- The lock-in sweep ran once at load against a fixed 12 Jul 2026 and wrote a fixed 10% "recruiter incentive".
- Nothing happened when a hire left: no way to record it, no replacement, no credit.
- Money in four places: Billing (`payroll-billing`, the same PayTrack body), Revenue (a hard-coded chart), Home cards (`odMoney`, own sums), the client Billing tab (`clientMoney`). `admin-paytrack` was an empty "Nothing here yet" page.

**Changes (agency workspaces)**
- **One record.** The placement holds `invoice`, `credit`, `commission` and `left`; `invoiceStatus` / `paymentStatus` stay as its summary for older readers.
- **Billing permissions (B16).** billing · Raise invoice, Record payment, Approve credit, Pay commission. Owner: all four. Admin: Raise invoice and Record payment (money going out stays with the Owner and the Accounts template). Recruiters and Recruiter Managers: none. The Owner can give any of them to any role in Roles. Every action is audited.

  | Template | PayTrack |
  |---|---|
  | Owner | All · raise, record, approve credit, pay commission |
  | Admin | Raise invoices and record payments; no credit approvals or commission payouts |
  | Accounts (M11) | All four |
  | Recruiter Manager | Team placements, no money |
  | Recruiter | Own placements, no money (own commission only if the Owner turns it on, C2) |

- **Invoices.** Client terms (versioned) gain "When to invoice: At joining (default) / After the replacement window". A draft is made at joining (or when the window passes) with the fee and tax worked out and frozen (amounts plus the clients script's `clSnapshot`); a hold (`clInvoiceHold`: registration, PO, lapsed LUT, no tax rule) shows its reason and blocks Raise until fixed (the snapshot is frozen again once a hold clears). Raise assigns the number, sends it to the client's invoice contact (`clientRoute(c,'Invoices')`, simulated, client activity line) and sets the due date from payment days. Then Part paid / Paid / Overdue. When overdue, Kairo drafts a reminder (audited, the client owner told); a person sends it.
- **Numbers.** Sequential per agency and financial year from the workspace invoice prefix: `NST-26-27/0001`. Never reused, even when an invoice is credited or cancelled. Credit notes: their own series `CN-NST-26-27/0001`, always pointing to the invoice they reduce. Invoices raised before M8 keep their old numbers.
- **Leaving (B9).** "Record that <name> left" (date and reason) in the PayTrack placement drawer; any move out of Joined is handled the same way. Inside the window: the journey moves to Withdrawn, the commission is cancelled with a reason, and the client's terms decide:
  - Free replacement (default, versioned): a replacement job linked to the original (`replacementOf` / `replacementJobs`), same client, terms version and hiring process, no new fee, flagged on both jobs; the original job stays filled (the opening moves to the replacement); the placement shows "Left in window · replacement open". A hire on the replacement job carries no fee, no invoice and no commission.
  - Credit note: a request through the approval engine (billing · Approve credit, guarded and ticked like every decision), then a credit note against the invoice (or the unraised draft is cancelled).
  After the window: recorded on the placement and the journey only (no replacement, credit or cancel). The journey drawer and the job page show the same "Left on <date> · <reason>" line.
- **Commission (B10).** Owner setting in Settings › Hiring › Commission: % of the fee (default 10), sourcer share (default 30, the closer gets the rest; 100% when the same person), "Show recruiters their own commission" (off, C2). Sourcer = the journey's first owner (intake owner or whoever added them); closer = the owner at Joined. Expected → Payable (the invoice is paid in full, credit included, and the window has passed) → Approved → Paid (billing · Pay commission), each audited; the people paid are told. Left in the window: cancelled with a reason. Contract staff: `ptCommissionBase` calls `ptContractMargin` when it exists (M9). The fixed 10% incentive is gone.
- **Legacy placements.** Seeded placements keep their stored amounts, labelled "Recorded before commission rules" (₹ amount where one was stored); they are never recalculated and still count in totals. Only new placements use the rule.
- **One clock.** `PAYTRACK_TODAY` is only the date the seeds were written against; seeded dates are shifted once to today so their ages stay the same (still shown as "Oct 5", with an ISO date alongside). Every window, overdue and commission check uses `ptToday()` = the flow rules' `fmNow()`.
- **One money screen (B13).** PayTrack (`admin-paytrack`) has tabs Placements · Invoices · Collections · Commission and a Billed · Collected · Outstanding · Overdue strip from `ptMoney()`. Billing is removed from the menu and `payroll-billing` opens PayTrack. Revenue, the Home money cards (`odMoney`) and the client Billing tab (`clientMoney`) read `ptMoney()`. The client Billing tab shows "Part paid · ₹x of ₹y" and sends money changes to PayTrack ("Open in PayTrack"). Recruiters keep their no-money PayTrack view; with C2 on they see "My commission" with their own lines only.

**Company workspaces:** unchanged (no PayTrack or Billing; Revenue keeps its own page; joining creates no invoice or commission; the sweep does nothing).

**Numbers that changed**

| Where | Before | After | Why |
|---|---|---|---|
| Revenue page | a fixed chart (Feb–Jul ₹28–38L) and fixed client totals | Billed ₹27.69L · Collected ₹13.99L · Outstanding ₹13.7L · Overdue ₹9.9L, fees by month of joining, top clients by billed | reads PayTrack |
| PayTrack KPI "This month" | ₹3.8L · −5 vs last month | ₹0.0L · −4 vs last month | the seeds keep their ages but fall in other calendar months (shifted from 12 Jul to today) |
| Seeded placement dates | e.g. Sneha Patel joined Jun 15, Ananya Iyer completed Jun 1 | Oct 5, Sep 21 (same ages) | one clock |
| Home money cards, every client's billed / collected / outstanding / overdue, all report and dashboard numbers | — | unchanged | |

**Changed lines in existing specs** (approved: the Billing menu item)

| Spec · line | Before | After |
|---|---|---|
| sidebar · 28 | `…li-uni-box,admin-revenue,admin-paytrack,payroll-billing,team-members,settings` | `…li-uni-box,admin-revenue,admin-paytrack,team-members,settings` |
| m04c-menu-home · 35 | `…li-uni-box,admin-revenue,admin-paytrack,payroll-billing,reports,…` | `…li-uni-box,admin-revenue,admin-paytrack,reports,…` |
| m04c-menu-home · 52 | `ok(shown() === 'admin-paytrack,payroll-billing,settings', shown());` | `ok(shown() === 'admin-paytrack,settings', shown());   // M8: Billing is PayTrack (the route redirects)` |

`light` and `screens-crawl` walk the menu, so each visits one screen fewer (88 → 87, 87 → 86); no line changed. New: `tests/m08-paytrack.spec.js` (13 tests).

**Tests executed (actual results)**

| Spec | Result |
|---|---|
| m08-paytrack (new) | 13 / 13 |
| sidebar (1 line changed) | 6 / 6 |
| m04c-menu-home (2 lines changed) | 9 / 9 |
| light (one menu screen fewer) | 87 / 87 |
| screens-crawl (one menu screen fewer) | 86 / 86 |
| clients | 31 / 31 |
| approvals | 14 / 14 |
| m07-consent | 9 / 9 |
| m06-one-hold | 8 / 8 |
| m05b-status-everywhere | 10 / 10 |
| m05a-status-numbers | 11 / 11 |
| m04d-team-handover | 5 / 5 |
| m04b-data-scope | 10 / 10 |
| m04a-approval-routing | 14 / 14 |
| m03-submission-rules | 10 / 10 |
| m02-applicant-owner | 15 / 15 |
| m01-offer | 9 / 9 |
| agency-shapes | 5 / 5 |
| auth-flow | 75 / 75 |
| campaigns | 21 / 21 |
| corporate | 20 / 20 |
| cowork-journey | 12 / 12 |
| cowork | 11 / 11 |
| design-system | 8 / 8 |
| flow-rules | 12 / 12 |
| intake-flow | 31 / 31 |
| intelligence | 13 / 13 |
| interviews | 15 / 15 |
| settings | 15 / 15 |
| signup-recovery | 11 / 11 |
| submission-flow | 19 / 19 |
| approval engine checks | 32 / 32 |

All 31 browser specs in one run.

**Not verified**
- Opened in a browser (screenshots, 1440 px): PayTrack's Invoices tab and the placement drawer. Not opened: the Collections and Commission tabs, recording a leave, the replacement job page, the credit note approval in Approvals, the Settings commission card, the Revenue page, the client Billing tab with a part payment, the recruiter "My commission" block, phone width.
- The fee on a new placement still comes from the clients script's hook (the client's current terms version at joining), as before M8.

## 2026-11-01 · M8 follow-ups · fee version, sourcer, a demo month

Backup: `backups/recruitment-os-prototype.pre-m8b-followups.html`.
- **Fee version.** A placement's fee and terms version come from the M1 offer record: the version in force when the client's offer was recorded (the offer stores `fee.amount`, `fee.termsVersion`, `fee.recordedAt`; the "Offer recorded" audit names both). Both are frozen on the placement (`feeFromOffer`, `offerRecordedAt`), and the invoice is drafted from them. The journey drawer shows "Offer fee ₹x · terms v<n> (recorded <date>)" to people who can see money; the placement drawer shows "Fee from terms v<n>", and "(in force when the offer was recorded)" when the terms changed before joining.
- **Sourcer.** `sb.sourcedBy = { id, name, how, at }`, set once and audited ("Sourced by"), on the first action on the candidate for this journey: added from the pool, submitted, opened by its owner, or screened. An owner the SLA rule moved away before they opened it is never the sourcer. Commission's sourcer is `sourcedBy`; journeys from before this (no `sourcedBy`) count the closer as both.
- **Demo month.** A seeded placement (Kiran Rao · Meridian Health, a client with no target or jobs) secured this calendar month, invoiced the M8 way and paid today, so PayTrack "This month" isn't empty.
- **Numbers that changed (demo record only):** Home "Revenue earned" ₹20.69L → ₹23.33L; PayTrack "Revenue realized" ₹20.7L (9) → ₹23.3L (10), "This month" ₹0.0L · −4 → ₹2.6L · −3; Revenue page Billed ₹27.69L → ₹30.33L, Collected ₹13.99L → ₹16.63L; Meridian Health billed ₹3.8L → ₹6.44L, collected ₹0 → ₹2.64L. Every other client, the dashboards and the reports are unchanged.
- **Spec lines changed** (`tests/m08-paytrack.spec.js`, the M8 helper): `place()` now adds the candidate while acting as the sourcer (`actAs(sourcer); createSubmission(…); asOwner();`, was created as the Owner), and the joining part moved to `join()`, which keeps an offer already recorded (`sb.offer ? { ok:true } : recordOffer(…)`). Two tests added (15 tests).
- Results: all 31 browser specs pass in one run (m08 15/15); approval engine checks 32/32.

## 2026-11-01 · M9 step 1 · the corporate time engine split into shared functions

Backup before any change: `backups/recruitment-os-prototype.pre-m9-contracts.html`.
- New shared, pure functions (in the corporate script, before the work-order code), each taking the record, the sheet list, the clock and its own words, and keeping no state of their own: `ctWeekCheck` (running, per-day limit, not in the future, inside the dates, something entered, not locked), `ctDecide` (approve, or send back with a note), `ctAmount` (rate × time per hour or per day), `ctReadyTime` (approved-and-unbilled, waiting, billed), `ctExtendCheck` (running, later end, length limit, reason), `ctTimeFormHTML` (the worker's week form).
- Corporate `coSheetSubmit`, `coSheetDecide`, `coSheetAmount`, `coInvoiceBuild`, `coWoExtend` and `coTimePage` keep their names, arguments, messages, audit lines and HTML, and now call the shared functions with `CO.contracts` / `CO.sheets`. Corporate invoices (`CO.invoices`, flat 18%) are unchanged.
- Proof: the same 25 corporate cases run on the backup and on the split file give byte-identical results (every success and refusal message, the time page HTML for two weeks, invoice lines and totals, extensions, audit lines). `corporate.spec` 20/20, all 31 browser specs in one run, approval engine checks 32/32. No spec line changed.
- Not yet built: anything on the agency side.

## 2026-11-01 · M9 step 2a · contract and temporary staff: assignment and time (no money yet)

Backup before any change: `backups/recruitment-os-prototype.pre-m9a-assignments.html`. The test runner now launches its own Chrome profile and runs two specs at a time, so a crash in the person's Chrome can't stop it.

**Changes (agency workspaces)**
- **Joined on a Contract or Temporary job** (job hiring type) opens the assignment form instead of creating a PayTrack placement; the journey ends at Joined and the assignment carries on (`ASSIGNMENTS`). Fields: start and end, rate per hour/day/month, pay rate, markup % (default from the client's versioned contract terms) or a typed bill rate, tracking (days, hours, shifts, attendance import; Temporary defaults to days), hours in a day, overtime after 9 h a day / 48 h a week (editable), notice days, client approver. Linked to the journey, job, client, client location and terms version.
- **Minimum margin.** Client terms (versioned) gain "Contract staff: markup on pay %" and "minimum margin %" (default 10). A rate whose margin is below it waits for contracts · Approve rates through the approval engine (guarded and ticked like every decision); the assignment is "Pending approval" until then.
- **Worker link** `#/time/<token>`: one token per assignment, revoked or reissued from the assignment (the old link then says "This link does not work"), stops at Ended or Terminated, shows only that worker's own weeks. Time is per day with real dates (`dates[7]` on each week), entered as hours, days or shifts. Built on the shared engine (`ctWeekCheck`, `ctTimeFormHTML`).
- **Client approver's link** `#/time-ok/<token>`, no login: approve, or send back with a comment (required); the owner is told on send-back. Reminders when last week's time is late (2 days) and when an approval is late (2 days), audited.
- **Kairo flags** (shown to the worker and the approver, never blocking): worked on a holiday (the workspace list plus days each client location adds), over 9 h a day or 48 h a week (or 2+ shifts a day), the same worker on another assignment the same day, weekdays with no time.
- **Attendance import:** a CSV per client and month (worker, date, hours or shifts), checked row by row with errors shown before anything is imported; imported days are marked "Imported" and go through the same checks and approval link.
- **Lifecycle:** Kairo alert 30 days before the end; extend (shared `ctExtendCheck`); change the rate from an effective date (approval when below the minimum margin); end on the end date, or early with the notice period, after which it is Terminated. "On assignment until <date>" on the job page and the candidate (and the journey drawer's assignment panel).
- **Permissions:** contracts · View / Manage / Approve rates. Owner all; Admin View and Manage; Recruiter Manager and Recruiter View. Recruiters see the pay rate; bill rate and margin only with money permission. Not a module in company workspaces.

**Company workspaces:** unchanged. `corporate.spec` 20/20 with no line changed; corporate work orders, timesheets and the corporate time page behave as before.

**Numbers:** none change (every report, dashboard and money number identical).

**Tests executed:** `tests/m09a-assignments.spec.js` (new) 9/9; all 32 browser specs pass in one run; approval engine checks 32/32. No existing spec line changed.

**Not verified:** opened in a browser (screenshots, 1440 px): the assignment form, the client approver's page. Not opened: the worker's page (rendered by the spec), the assignment panel in the drawer, the action forms (extend, change rate, end, add a holiday, import), the job page line, phone width.

## 2026-11-01 · M9 · rate privacy check on step 2a

A new m09a test checks rate privacy on every page (10 tests). What it found exposed, now fixed:
- **Audit log text:** "Assignment created" and "Rate sent for approval" said "margin 4.8% is below the minimum 10%". Margin figures are gone from the audit text (they stay on the approval request, shown only to people who can see money).
- **Recruiter Manager:** saw the bill rate and margin in the assignment panel, because "can see money" also counted Clients · View Contracts (which M4c gives Recruiter Managers for client fee terms). Bill rates and margins now need billing · View (Owner, Admin, Accounts).
- **Scope:** assignment lines on the job page and the candidate listed every assignment on the job, whoever owned the journey (names and dates, no money). They now follow the viewer's journey scope: a Recruiter sees their own, a Recruiter Manager their team's.
- **Approvals:** minimum-margin rate requests (and M8's credit-note requests) did not appear in Approvals at all, so the Owner could only decide them in code. They are now rows: "Rate from <date> · <client> · below the minimum margin" (pay, bill and margin only for people who can see money); "Credit note · against <invoice>" (amount only for money roles).
- Already clean: the client approver's page (time, dates, Kairo flags only), the worker's page (no rates), notifications.

## 2026-11-01 · M9 step 2b · contract and temporary staff: money (B7)

Backup before any change: `backups/recruitment-os-prototype.pre-m9b-money.html`.
- **Monthly invoices** (`asBuildInvoice`, the Contracts view → "Build invoice"): from approved time only (the shared `ctReadyTime`), split at calendar-month boundaries day by day, each day priced at the rate in force on that day (a mid-month rate change makes two lines). Waiting days are listed, never billed; a billed day is never billed again. Per hour, per day (hours ÷ hours in a day; a day or shift counts as one) or per month (a share of the month's working days). Each month's invoice is an invoice record on the assignment (`a.invoices[]`) handled by M8: the same numbering (`NST-26-27/…`), frozen tax snapshot, holds, part payments, overdue and Kairo reminder drafts.
- **Tax:** from the client location's rules (`clTaxFor`, now taking a supply type), on the whole bill; nothing hardcoded on the agency path. The GST service code comes from the rule pack (998513 contract staffing, 998514 temporary staffing). **TDS per supply type:** the rule pack's TDS entry now holds rates per supply type; placement fees keep 194J as before; contract staffing has no rate in the pack, so the invoice shows "TDS for contract staffing is not set in the rule pack. Confirm the TDS rate for each supply type (placement fee, contract staffing) with your accountant." No rate was invented. Corporate keeps its flat 18%.
- **M8 generalised:** PayTrack reads every record with invoices (`ptMoneyRecords()`: placements plus each month's contract invoice; `ptInvoicesOf(record)` gives a record's list). Invoices, Collections, Commission, totals, the client Billing tab and the sweep include contract invoices; permanent placement totals are unchanged. No m08 line changed.
- **Gross pay** (Contracts view → "Gross pay before deductions (CSV)", billing · View): approved time × pay rate per worker, per month and rate period, titled "Gross pay before deductions", with the note "PF, ESI, professional tax and TDS on salary are not worked out here. Gross pay only; your payroll provider works out deductions." Audited.
- **Conversion to permanent:** client terms (versioned) gain "Conversion to permanent, % of CTC" (default: the permanent fee) and "Waived after N months" (default 9). Converting creates a normal M8 placement (invoice, commission, replacement window), linked both ways (`convertedFrom` / `convertedTo`); the assignment is Converted and the worker link stops. Temporary: no conversion fee unless the terms set one.
- **Commission on monthly margin:** Settings commission gains "for contract staff: % of monthly margin" (`contractPct`, default 10); each month's invoice carries its commission, payable when that month's invoice is paid in full (credit included), with the same sourcer/closer split; approved and paid as in M8.
- **Contracts view** inside PayTrack (a fifth tab for people with contracts · View; no new menu item): each assignment with status, dates, pay rate (bill rate only for money roles), the month's approved and waiting days, its invoice and "Build invoice"; the gross-pay export and both notes.

**Numbers:** none change (all reports, dashboards and money identical before and after; no seeded assignments).

**Tests executed:** `tests/m09b-contract-money.spec.js` (new) 5/5, including one full cycle across a month boundary with a mid-month rate change, a part payment and commission becoming payable. `tests/m09a-assignments.spec.js` 10/10. Full suite: 32 of 33 in one run, the other (m02, its known exact-millisecond clock check) 15/15 alone. Corporate 20/20 and m08 15/15 with no line changed. Approval engine checks 32/32.

**Not verified:** not opened in a browser: the Contracts tab, building and raising a contract invoice on screen, the CSV download, the conversion, the Approvals rows for rates and credit notes, the new terms fields, phone width.

## 2026-11-01 · M9 follow-ups · a steady clock check, a demo assignment, the approver link after the end

Backup before any change: `backups/recruitment-os-prototype.pre-m10-disclosure.html` (shared with M10).
- **m02 clock check made steady:** the "clock starts now" check no longer compares exact milliseconds after moving the clock. It reads the app clock before and after the sweep and checks the start time falls between them. The full suite passed in one run, twice in a row.
- **Demo assignment (agency workspaces only; the seed returns early in corporate):** Sana Qureshi applies to SwiftLog's Warehouse Supervisor job through the careers page (the normal inbound path makes her profile and journey). She is put forward with consent recorded by call, joins, and becomes assignment AS-0001: pay ₹1,500/day, bill ₹1,680/day (SwiftLog's 12% contract markup), owner Arjun Kapoor. Last month has two approved weeks; that month's invoice NST-26-27/0002 is raised and part paid (₹9,912 of ₹19,824 incl. IGST 18%), with commission Expected (10% of the ₹1,800 monthly margin). The invoice is built by `asBuildInvoiceCore`, which `asBuildInvoice` now calls after its "Raise invoice" permission check.
- **Approver link after the end:** once an assignment is Converted, Ended or Terminated, the client's `#/time-ok/<token>` link shows "This link no longer works", except for a week that is still Submitted and waiting for approval, which can still be decided.
- **Audit text without margin:** for contract records, audit lines say "(amount on the invoice)" instead of a ₹ figure (`ptAuditText`), so the commission line no longer shows the margin to people who can read the audit log but not money. The privacy check caught this once the demo seed added a contract invoice.

**Numbers that change (before → after; corporate workspaces unchanged):**

| Where | Before | After |
|---|---|---|
| Funnel (all journeys) | Sent 27 · Shortlisted 8 · Interview 7 · Offer 2 · Accepted 2 · Joined 1 | Sent 28 · Shortlisted 9 · Interview 8 · Offer 3 · Accepted 3 · Joined 2 |
| By source | Talent Pool, Seed Data | + Careers page: sent 1, interview 1, offer 1, joined 1 |
| Recruiter score · Arjun Kapoor | composite 16, quality 0%, interview 0%, sent 0, outreach 0 | composite 72, quality 100%, interview 100%, sent 1, outreach 10 (revenue ₹1,02,000 unchanged) |
| Quality funnel · Arjun Kapoor | submissions 0, accepted 0 | submissions 1, accepted 1 |
| Fairness · Pune | sent 10, shortlisted 4, interview 4 | sent 11, shortlisted 5, interview 5 |
| Bottlenecks · Warehouse Supervisor | "Only 0 candidates recommended so far" | "Only 1 candidate recommended so far" |
| Dashboard · Joined | 1 | 2 |
| Home · unpaid invoices | 6 | 7 |
| Home · to collect | ₹13.7L | ₹13.78L |
| Revenue page · Billed / Collected / Outstanding | ₹30.33L / ₹16.63L / ₹13.7L | ₹30.5L / ₹16.71L / ₹13.78L (Overdue ₹9.9L unchanged) |
| SwiftLog · billing | billed ₹90,000 · collected ₹90,000 · outstanding 0 | billed ₹1,06,800 · collected ₹98,400 · outstanding ₹8,400 · overdue 0 |

Revenue and the client tab count the invoice before tax (₹16,800 billed, ₹8,400 collected); the invoice itself shows the total with IGST.

**Spec lines changed (before → after):**
- `tests/m02-applicant-owner.spec.js` 133–134: `FM.offset = 25 * 3600000; var out = fmSlaSweep(), at = fmNow(); FM.offset = 0;` … `new Date(sb.slaFrom).getTime() === at` → `var from = fmNow(), out = fmSlaSweep(), at = fmNow();` … `sla >= from && sla <= at` (same meaning: the clock starts during this sweep and isn't moved twice).
- `tests/m05b-status-everywhere.spec.js` 64: `e.nextAction === journeyNextAction(js)` → also accepts `On assignment until …` when the entry belongs to an assignment (M9: a contract hire's next action is their assignment; the demo seed is the first such journey).
- `tests/m09a-assignments.spec.js`: one test added (converted, ended or terminated → the approver link stops, except for a week still waiting); now 11 tests.

**Tests executed:** full suite 34/34, twice in a row, in the runner's own Chrome profile; approval engine `node test/aps.test.js` 32/32; `tests/corporate.spec.js` 20/20 with no lines changed.

**Not verified:** not opened in a browser: the demo assignment on the Contracts tab, PayTrack, Revenue and the SwiftLog billing tab; the "This link no longer works" page.

## 2026-11-01 · M10 · honest Kairo disclosure (B19; flow map section 17)

Backup before any change: `backups/recruitment-os-prototype.pre-m10-disclosure.html`.
- **Two wordings, chosen by how the message was sent:** "Drafted by Kairo, Oontu's assistant, and approved by a person on our team." only when a person approved that message (a step held for review and approved). "Drafted by Kairo, Oontu's assistant, from a template our team approved." for automatic sends without a per-message check: acknowledgements, follow-ups, reminders, consent links and time links.
- **Recorded on the send ledger:** each sent entry carries `disclosure` (`'approved'`, `'template'` or none) and, for approved ones, `approvedBy`. The wording follows the message, not the agent: the same agent with and without review gets different lines. The approver sees the line the message will carry. Consent links are now on the ledger too (`action: 'consent'`), and overdue reminders (`action: 'overdue reminder'`, sent by a person) carry the approved line.
- **Switch off:** neither line is added and the ledger records none.
- **A person's own message** (e.g. "Tell candidate" in the pipeline) gets no line; a template filled in without a send gets none either.
- **Settings help** for "Say when Kairo wrote the message" explains both lines and that messages you write yourself get no line.

**Numbers:** none change.

**Spec lines changed (before → after):**
- `tests/intelligence.spec.js` 80–81: `cwTemplateText(step, c, { ownerId:'RP-088' })` → `cwTemplateText(step, c, { ownerId:'RP-088' }, 'template')` (M10: the line depends on how it was sent; without it, no line is added).

**Tests executed:** `tests/m10-disclosure.spec.js` (new) 4/4: automatic acknowledgement and consent links → template wording; a reviewed campaign message → approved wording, and the same agent without review → template; a person's own message → none; switch off → none, plus the Settings help. Full suite 34/34 twice; engine 32/32; corporate 20/20 unchanged.

**Not verified:** not opened in a browser: the Settings help text, the line in the approval queue preview, the ledger view of a consent link.

## 2026-11-01 · M10 follow-up · small samples in the recruiter score

Backup before any change: `backups/recruitment-os-prototype.pre-m10b-score-sample.html`.
- Below a minimum of 5 sent submissions (`RECRUITER_SCORE_RULES.minSent`), the recruiter score has no quality rate, no interview rate and no composite score. Screens say "Too few to score yet (<n> sent)", the same way client signals mark small samples. Counts (submitted, shortlisted, interviewed, accepted) still show.
- Where: Recruiter Analytics (the score ring, both rate cards, the leaderboard: scored people are ranked, the rest are listed after it unranked), the Home performance card (Offer ratio "—" with the note), the recruiter Home "My month" funnel, the Owner Home "Team performance · Quality" list (too few: listed last, no "accepted" figure) and the recruiter profile pipeline.

**Numbers that change (before → after):**

| Recruiter | Sent | Before | After |
|---|---|---|---|
| Arjun Kapoor | 1 | score 72 · quality 100% · interview 100% · ranked 1st | Too few to score yet (1 sent), unranked |
| Divya Menon | 1 | score 70 · quality 100% · interview 100% · ranked 2nd | Too few to score yet (1 sent), unranked |
| Akash Shah | 0 | score 14 · 0% · 0% · ranked 10th | Too few to score yet (0 sent) |
| Neha Kulkarni, Rohit Bansal, Sana Iqbal, Vivek Menon, Kavya Iyer, Rhea Malhotra | 0 | score 20 · 0% · 0% · ranked 4th–9th | Too few to score yet (0 sent) |
| Priya Sharma | 26 | score 54 · 27% · 23% · ranked 3rd | unchanged, now ranked 1st (the only one scored) |

**Spec lines changed:** none. One test added to `tests/intelligence.spec.js` (now 14 tests). It checks no rate or score below 5, the leaderboard text, no 100% on the leaderboard, and the score turning on at 5 sent.

**Tests executed:** full suite 34/34 twice in a row; engine 32/32; corporate 20/20 unchanged.

**Not verified:** not opened in a browser: Recruiter Analytics, the Home cards and the recruiter profile with the new text.

## 2026-11-01 · M11 · names, role templates and team-size defaults (B12, C5; flow map 01, 03, 04)

Backup before any change: `backups/recruitment-os-prototype.pre-m11-names-templates.html`.

**1. Names (B12).** The top role is "Owner" inside every workspace, agency and corporate (the demo's seeded role was "Super Admin"; the ids `role_founder` and `state.role 'admin'` are unchanged). 44 strings changed: main script 40, light script 2 (override errors), join script 1, settings script 1. Answered wordings: "The Owner or an Admin sets these.", "the Owner or an Admin" in the sign-in notice, invite error, hold-override errors and join approval. Two more with the same wording were found while working: "Ask the Owner or an Admin to fix the records." (duplicate journeys) and "Contact the Owner or an Admin of your Oontu workspace." (sign-in help). Oontu Platform Settings now says "each workspace Owner's own Setup screens". Kept: "Oontu Super Admin" on Oontu's screens and in the persona switcher, "primary tenant administrator" on Oontu's create-tenant form, transfer ownership's "you become an Admin", and the import alias "super admin" → Owner. Code comments are not changed.
- **Saved records are never edited.** `shownRoleName()` shows an old "Tenant Admin" / "Super Admin" / "Tenant Super Admin" label as "Owner" only when displayed: in the audit log (Settings and the old view), the Kairo activity lines, approvals (approver and decided-by, in the Approvals engine and the older request screens), the submission review timeline and decline reasons.

**2. "Submit to job" and role templates (flow map 04).**
- New permission **Candidates · Submit to job**. Agency submit checks use it (`submissionGate` behind `submitOneToJob`, and `jobWsCanSubmit`, which gates the send dialog `openSubmitPicker` and the submit buttons); corporate keeps talent pool Add and its role editor doesn't show the new action. The old check was talent pool **Add**, not Recommend, so every role with Add or Recommend gets it once (`grantSubmitToJob`; one audit line at load: "Submit to job — Owner, Admin, Recruiter Manager, Recruiter"). After that it is an ordinary permission. Roles made from templates or clones don't get it automatically.
- **Create role** (Settings › Roles, agency, for people who can manage roles): Admin, Account manager, Accounts, Sourcer, or Blank. A template fills the editor (permissions, data scope, approval powers) as a draft marked "not saved"; edits change only the draft; Save role creates it (a name already in use is refused) with the audit line "Role created · from the X template"; Discard drops it. Not seeded: sign-up still seeds Owner, Recruiter Manager, Recruiter.

| Template | Permissions | Scope | Home |
|---|---|---|---|
| Admin | everything except plan & add-ons, approve credit, pay commission, Cowork subscription and the danger zone; billing View, Raise invoice, Record payment; contracts View, Manage | All | Owner Home |
| Account manager | clients View, Edit, View Contracts; jobs View, Create, Edit; candidates View, Send to Client; approvals; approves submissions | clients and jobs Own; pipeline Assigned jobs (includes their clients' jobs) | My day |
| Accounts | billing View and all four; contracts View; clients View, View Contracts | billing, contracts, clients All | PayTrack |
| Sourcer | talent pool View, Add, Move; candidates View, Edit; jobs View; Cowork Use agents, Create workflows | talent pool All; jobs Assigned; Cowork Own | My day |

- **Account manager approvals:** the client's owner counts as being on the job (`canSeeApprovalWork`), and "Assigned jobs" pipeline scope includes the client's owner. No existing agency role uses that scope for pipeline. The reporting line still decides who reviews.
- **Cowork:** the owner filter already existed (`cwWfVisible`: own workflows, a manager's team, and workflows marked shared). Nothing changed there; the spec checks a Sourcer sees their own and not another person's.

**3. Team-size defaults (C5).** `applyTeamSizeDefaults` runs once at sign-up (agency): 1–5 → submission review off, new applicants to the job lead; 6 or more → review on (Recruiters need it; the Owner and Recruiter Managers already skip it), round-robin. Audited. Workspace defaults and the sign-up "How your agency works" screen show "Submission review" and "New applicants" from the current settings, with Change. The later Team size sheet only changes the answer: never Settings or jobs.

**4. Join ratio** on the Home performance card: joined ÷ accepted offers from the recruiter's own journeys, with the small-sample rule (below 5 accepted: "Too few to score yet (n accepted)"). Before: 200% (placements ÷ approved decisions). After: "—" with "Join ratio: Too few to score yet (1 accepted)." The quality funnel gains a `joined` count; nothing else moved (reports, dashboard and money identical).

**Spec lines changed (before → after):**
- `tests/m04d-team-handover.spec.js` 79: `/only active Super Admin|your own account/` → `/only active Owner|your own account/`; 82: `/only active Super Admin/` → `/only active Owner/`.
- `tests/auth-flow.spec.js` 1121: adds `Submission review=On for the Recruiter role|` after `Approvals=Follow the reporting line|`; 1122: `length, 11` → `length, 12`.
- `tests/intake-flow.spec.js` 17, 26, 32, 75, 115, 425: "Tenant Admin" → "Owner" in comments, one message and two test titles (no checks change).
- `tests/flow-rules.spec.js` 83 (not in the plan; follows from the approved "the Owner or an Admin" wording): `/manager or an admin/` → `/manager, the Owner or an Admin/`.
- auth-flow sign-up lines 704, 709, 742 didn't move.

**Tests executed:** `tests/m11-names-templates.spec.js` (new) 7/7; full suite 35/35 twice; engine 32/32; `tests/corporate.spec.js` 20/20, no lines changed.

**Not verified:** not opened in a browser: Create role and the template editor, the Workspace defaults rows, the renamed strings on screen, the Home performance card.

## 2026-11-02 · M11 fix · no lazy permission grants; shared workflows

Backup before any change: `backups/recruitment-os-prototype.pre-m12-e2e.html` (shared with M12).
- **"Submit to job" is a one-time update at load** (`submitToJobUpdate`), not a grant on first use. Each role that existed before M11 with talent pool Add or Recommend gets it, with **one audit line per role** ("Owner: Submit to job …", the same for Admin, Recruiter Manager, Recruiter). Every role is marked so it never runs twice.
- **Roles made after M11 get it only when the Owner ticks it:** templates, Blank, and the old New role box. A clone copies the source role's ticks as they are. The agency sign-up seeds (Recruiter Manager, Recruiter) carry it written in, so a new agency can submit.
- **Also gated:** shortlisting an applicant (`pipeShortlistApplicant`) puts them forward, so it now needs "Submit to job" too. The add-candidate form offers no jobs to a role without it.
- **Shared workflows:** a Sourcer sees and uses them (Duplicate makes their own draft copy). Only the owner, the Owner or an Admin can edit, pause or delete one; people who approve agent messages may also pause or resume it. These guards are now in `cwWorkflowToggle` and `cwDelete` themselves, not only in the menu.
  - A copy of someone else's workflow keeps only the copier's own LinkedIn accounts, and rotation becomes "my account". It never sends as another person; the duplicate line is audited.
  - `cwWfVisible` now judges "manager" by the Team · View Team permission rather than the persona signed in, so a Sourcer seen through "View as" isn't treated as a manager.

**Spec lines changed:** in `tests/m11-names-templates.spec.js` (new in M11):
- the grant test now checks one audit line per role (was one combined line)
- a role made after load is not granted by use (was: granted)
- the load update grants a pre-M11 role once and never twice
- two tests added: the Sourcer (template → add a candidate → open a job → can't submit, after a reload and a second use) and shared workflows

## 2026-11-02 · M12 · end-to-end test and the agency-ready report

- **New `tests/agency-e2e.spec.js`, 8 tests.** It runs the whole journey for each of the four shapes, plus the four Classic-only cases: leaves in the window, contract monthly invoice, consent No, duplicate with override. What it covers and the three shortcuts it takes are written at the top of the spec and in `docs/OONTU_AGENCY_READY_REPORT.md` section 1.
- **New `docs/OONTU_AGENCY_READY_REPORT.md`:** fixed B1–B20 (B15 marked in the final round: fixed in the flow map, no code change), still not built, simulated, server rules by module, risks and checks by eye, build order.

**Spec lines changed:** `tests/m08-paytrack.spec.js` 37, 40, 172. `new Date(fmNow()).toISOString().slice(0, 10)` → `ptLocalDay(new Date(fmNow()))` for the offer and joining dates.
- Why: in UTC these fell a day early between 00:00 and 05:30 IST, so "the drawer says where the fee came from" failed.
- It failed the same way on the pre-M12 backup, so it isn't caused by this round. The product records the local day.

**Tests executed:** full suite 36/36 twice; engine 32/32; corporate 20/20, no lines changed; `tests/agency-e2e.spec.js` 8/8; `tests/m11-names-templates.spec.js` 9/9.

## 2026-11-02 · Final round (part 1) · B15, clones, time zone search

Backup before any change: `backups/recruitment-os-prototype.pre-final-round.html`.
- **B15** marked "Fixed in the flow map (no code change)" in `product-flow-audit.md` (section 20) and the ready report. Flow map v8 showed the old 4-question sign-up; the product asks 9 questions with a code; corrected from v9.
- **Clone (agency):** opens as a "not saved" draft with the source role's ticks, "Submit to job" included and shown ticked. The editor says "A copy of X, with the same ticks, including Submit to job". Save role writes the audit line "Role cloned · X → name". Corporate keeps its immediate clone.
- **Time zone:** the product code was searched for business days built from UTC; the list is in the round's report. No product dates changed yet: the instruction for what business days must use was cut off.

**Spec lines changed:** none; one test added to `tests/m11-names-templates.spec.js` (now 10).
**Tests executed:** full suite 36/36 twice; engine 32/32; corporate 20/20, no lines changed.
**Not verified:** not opened in a browser: the clone draft in Settings › Roles.

## 2026-11-02 · Final round (part 2) · business days in the workspace time zone

Backup before any change: `backups/recruitment-os-prototype.pre-tz.html`.
- **One helper family** (main script, before PayTrack): `wsTz()`, which reads `ORG_STRUCTURE.profile.timezone` (stored as a label; the zone is its first word; Asia/Kolkata if unreadable), with `wsParts`, `wsDay`, `wsMonth`, `wsDayStart`, `wsWallMs`, `wsAddDays`, `wsAddMonths`, `wsDaysBetween`, `wsDow` and `wsFmt`. It is built on `Intl.DateTimeFormat` with `timeZone`; there are no fixed offsets. `calDay` is only for seed strings such as "Jun 15".
- **Pointed at it:** `ptLocalDay`, `ptStartOfDay`, `ptParseDate`, `ptDaysBetween`, `ptFmtDate`, `PT_SEED_SHIFT`, `ptFy`, `clIso`, `coIso`, `coIsoMs`, `coMonday` (`asIso` follows `ptLocalDay`). PayTrack, terms, contracts and the shared time engine therefore no longer depend on the browser's zone.
- **Day arithmetic instead of 24-hour blocks:**
  - replacement window end (`ptWindowEnd`)
  - invoice due date (`ptDueIso`: due on the day paymentDays after raising; overdue from the next day)
  - client due date (`clRecDue`)
  - contract weeks (`asWeekDates`), month bounds (`asMonthBounds`), workdays (`asWorkdays`), last month (`asLastMonth`)
  - the revenue months chart
  - client FY start (`CL_FY_START`, set at load) and last FY
  - Oontu subscription renewal, period end and due date (`wsAddMonths`, `wsAddDays`)
- **Every business-day hit from the table** is fixed: 14590, 44807, 48070, 44563, the Oontu console lines, `sToday`, and delegation (the hard-coded 5:30 is removed). Also fixed:
  - the agent "trial · N days left" count, which parsed a date as UTC
  - the console invoice overdue check
  - the "Paid" day on console invoices
- **Date formatters** in the money, client, contract, corporate-time and light code now show dates in the workspace zone: `ptFmtDate`, `clDate`, `fmDate`, `coDate`, `coDay`, `asFmt`, `asMonthLabel`, plus the client renewal and "since" lines.
- **Approval engine** (both `oontu-approval-sla-engine.js` and the copy in the page): `utcOffsetMinutes: 330` is replaced by the workspace zone through Intl. The page's `wsTz()` wins; `APS.config.timeZone` is the fallback when the engine runs alone. 2 London checks added (34 in all), including the October and March clock changes.
- **Removed:** the unused date picker (6 functions).
- **Unchanged:** timestamps (created, sent, decided) stay UTC instants, and stored dates are never rewritten.
  - Found: seeded client terms v1 dates are a day early when the page loads between 00:00 and 05:30 IST, in the old code.
  - Not changed: harmless, because v1 only starts a day earlier.
- **Not changed (still the browser's clock):**
  - interview calendars and slot finding
  - campaign send windows and slot suggestions
  - Cowork quiet hours and day keys
  - follow-up presets
  - some older displays in the main script (52 date formatters there)

**New spec:** `tests/time-zone.spec.js`, 8 tests. The rules run at 00:30 and 23:30 IST and with the workspace in Europe/London; it passes with the browser in UTC and in Asia/Kolkata.
**Spec lines changed:** none. `test/aps.test.js` has 2 London tests (4 assertions) added.

## 2026-11-02 · Final round (part 3) · interviews, Kairo send windows, any browser zone

Backup before any change: `backups/recruitment-os-prototype.pre-tz2.html`.
- **Interviews:** the start stays a UTC instant (`iv.at`). It is shown in the workspace zone with the zone named, e.g. "Wed, Jan 6, 10:00 AM IST", using `ivFmtT`, `ivFmtD`, `ivWhen` and the new `wsTime` and `wsZoneAbbr`.
  - When the viewer's browser is in another zone, their own time follows in brackets: "(4:30 AM your time)", from `wsViewerNote` and `ivLocal`.
  - The note is added on screens and on the candidate and client links only. Stored `iv.date` strings never carry one viewer's time.
  - Workspace-zone working: slot finding (09:30–18:30, not Sundays), the day, week and month grids (`ivMid`, `ivMonday` = `coMonday`, `ivShiftMonth`), list grouping (`ivDayGroup`) and Home's "Today" (`oIsToday`).
  - The `.ics` already carried UTC (`DTSTART:…Z`); unchanged.
  - The seeded interviews used the browser's hour on a workspace day; they now use the workspace hour.
- **Kairo send windows**, all in the workspace zone:
  - Cowork: `cwInWindow`, `cwIsWorkday`, `cwNextWindow`, `cwDayKey` (now `wsDay`), the engine's start clock, `cwFmtTime`, and LinkedIn active hours (`cwLiInActive`)
  - Campaigns: send hours in `cpSendCheck`, `cpNextWeekday`, `cpSlotAt`, `cpSlots`, `CP_ISO`, `cpDate`, `cpDateMs`, `cpWhen`
- **Unchanged, as asked:** follow-up presets stay on the user's own clock, and the ~50 older displays in the main script stay as they are.
- **Spec lines changed (before → after).** All of them set clock times with the browser's `setHours`, which is wrong once times are in the workspace zone; each now uses a `wsAt(day, h, m)` helper (a wall time in the workspace zone):
  - `tests/m09b-contract-money.spec.js` 42: `first = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime() … mid = new Date(now.getFullYear(), now.getMonth() - 1, 15).getTime()` → `first = wsDayStart(wsYmd(lm[0], lm[1], 1)) … mid = wsDayStart(wsYmd(lm[0], lm[1], 15))` (last month from `wsParts(fmNow())`)
  - `tests/cowork.spec.js` 13 (`tue10`): `new Date(CW.clock); d.setHours(10, 0, 0, 0); while(d.getDay() !== 2) …` → `wsDay(CW.clock); while(wsDow(day) !== 2) …; wsAt(day, 10)`
  - `tests/cowork.spec.js` 106: `new Date(cwNow()); d.setHours(22, 0, 0, 0)` → `new Date(wsAt(wsDay(cwNow()), 22))`
  - `tests/campaigns.spec.js` 14 (`tue10`, 11:00), the same change
  - `tests/campaigns.spec.js` 143: "Sunday 11:00" built with `getDay`/`setHours` → `wsDay`/`wsDow`/`wsAt`
  - `tests/m10-disclosure.spec.js` 24 (`tue10`), the same change
- **New tests** in `tests/time-zone.spec.js` (now 10):
  - an interview booked from the client link stores 04:30 UTC, shows "10:00 AM IST", lands on 6 Jan, has `.ics` `DTSTART:20270106T043000Z`, and shows the viewer note only in a non-IST browser
  - a campaign step is held at 02:00 and 23:30 IST (18:00 UTC, daytime for a UTC browser), sends at 11:00 IST, and is held at 23:30 in London

**Tests executed:** full suite 37/37 twice (normal); full suite 37/37 once with the browser in UTC; engine 34/34; corporate 20/20, no lines changed.
**Not verified:** not opened in a browser:
- the interview screens and links with the zone name and the "your time" note
- the month and week grids
- campaign slot suggestions
