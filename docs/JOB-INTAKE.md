# Job publication and application intake (Task 01)

Scope: authorised job creation and publication, the job going live inside Oontu, application intake, candidate identity resolution, application events, the candidate-job journey, and what shows in Applicants. Nothing after "application received" (screening stages, WhatsApp, matching, interviews, new job-board integrations) is part of this task.

## 1. What this repository is

A single static HTML prototype with in-memory data. There is no backend, database or job-board integration here.

- **Enforced in functions, not only in the UI.** The rules live in plain functions (`jobGoLive`, `ingestApplicationEvent`, `decideDuplicateReview`, and so on). They check the acting user, the organisation and the allowed state themselves, so they can be tested and later moved to a server unchanged.
- **Not a security boundary.** Anyone can edit browser code. A real server must repeat every check and back the uniqueness rules with database constraints (section 7).
- **Simulated.** The only thing simulated is outside channel delivery. No channel adapter is registered, so no outside post is ever claimed.

## 2. What changed

All code is in `recruitment-os-prototype.html`, in one new section after the job ownership rules (search for `JOB PUBLICATION AND APPLICATION INTAKE`), plus small hooks.

| Area | Change |
|---|---|
| Approval policy | `JOB_APPROVAL_POLICY` is now `{ mode: mandatory / optional / direct, reviewer: admin / team_manager / designated, designatedReviewerId }`. The Tenant Admin sets it in Settings > Job approval. `setJobApprovalPolicy` refuses anyone else. |
| Publishing | `publishJob` follows the policy. Whoever has `jobs:Create` may publish (the separate `jobs:Publish` check is no longer used). Mandatory sends the job to the reviewer as a `JobApproval` request. Optional uses the creator's choice, and review when none is made. |
| Going live | `jobGoLive` is the only place a new job becomes live. It refuses unless the policy allowed direct publication or approval is `Approved`. It then tries each channel and requests candidate finding once. `decideApproval` now calls `jobApprovalDecided`. |
| Channels | Per-channel state in `job.channelDelivery`. Oontu-hosted channels (Career Page, Internal Talent Pool, Public Link) are live when the job is live. Outside channels become `live` only when a registered adapter confirms; with none they are `not_connected`. Failures keep their reason. `retryJobChannel` retries only failed or not-connected channels, uses a stable idempotency key (`jobId:channel`) and never re-sends a success. |
| Candidate finding | `requestCandidateFinding` records one request for a live job. It sends nothing. |
| Edit history | `recordJobEdit` stores who changed which tracked fields, when, and whether the job was live. |
| Intake | `ingestApplicationEvent` is the single entry point. `ingestInboundApplication` still exists and delegates to it, so the share-link form, platform simulator and demo data work as before. |
| Records | `APPLICATION_EVENTS` (one per genuine application) are separate from `CANDIDATES` (profiles) and `SUBMISSIONS` (journeys, one per candidate and job). |
| Duplicates | `DUPLICATE_REVIEWS`, `decideDuplicateReview`, `correctDuplicateReview`, `reviewPriority`, `reviewsVisibleTo`. |
| Screens | Settings > Job approval; the last create-job step explains what publishing will do; the job page has a Publication card; Applicants shows a "Needs a person" block, row flags, and a review dialog; the Approval Center lists possible duplicates. |
| Tests | `tests/intake-flow.spec.js` (30 tests). `tests/run-auth-tests.ps1` takes `-Spec`. |

## 3. Behaviour

**Publication**

- Mandatory approval: the job is `Pending Approval`, is not live, nothing is posted anywhere, candidate finding has not started and applications are refused (`job_not_live`). It goes live only when the reviewer approves.
- Reviewer: the Tenant Admin, the creator's Team Manager, or a designated person, per policy. A reviewer is never the creator. If the configured reviewer is unavailable (no manager, person removed, or the creator), the Tenant Admin reviews and the audit entry says so.
- Tenant Admin creating a job under mandatory approval with the admin as reviewer: it goes live directly, and an already-approved `JobApproval` record is written so the audit trail is complete. This is an assumption (the admin is the approver, so a second person would add nothing).
- Oontu status and outside channel status are separate. A job can be live in Oontu while every outside channel has failed.

**Application intake**

- The event is recorded first, so nothing is lost if later steps fail. It keeps source, portal, referrer, job, received time, external ID, integration, original CV reference, extraction result, and every delivery.
- Extraction never discards an application. Extracted values are marked `extracted`; values a person types are marked `verified`. If name or contact cannot be read, the event is `needs_details`: visible in Applicants, no profile or journey is invented, and a person completes it (`verifyApplicationFields`), after which it links normally.
- Profile enrichment fills empty fields and adds new skills. A differing value is never written over an existing one; it is recorded in `pendingConflicts` and flagged on the event. Provenance is kept in `fieldSources`.
- Identity: email is the stronger identifier, phone is used when there is no email match. If email and phone point at different profiles, the event links to the email match and is flagged `identity`; the other profile is untouched.
- Journey: one per candidate and job. A new application on an existing journey links to it and changes nothing on it (stage, owner, timestamps). If that journey is closed (withdrawn or rejected) it is linked and flagged, not reopened. This replaces the old behaviour, which reopened the journey silently.

**Duplicates**

- Same external ID, same source, same organisation: a repeat delivery. No new event; the delivery is logged; valid new details are accepted. Same ID in another source or organisation is a different event. Same ID, same source, other job is refused (`external_id_conflict`).
- No external ID: another portal is a separate application. Same portal and person: identical content is a technical duplicate and suppressed (logged on the earlier event); a different attached document is distinguishing evidence and is kept; otherwise it is kept and sent for review.
- Routing: journey owner, else the job's assigned recruiter, else the central intake queue. Operations users (Tenant Admin, or `team:Manage Team Work`) see the central queue.
- Priority: tiers (Standard, Elevated, High) from combined risk (job priority High, identity conflict, data conflict, candidate already in process or earlier journey closed), then longest wait first. Every case lists its reasons in plain words. There is no numeric score.
- Decisions: same application delivered twice, genuine new application, or keep pending. All three need an explanation. Pending keeps the case open.
- Corrections: Tenant Admin or manager, with a mandatory reason and the case version they were looking at. The original decision and each change stay on record. Two people correcting from the same version: one wins, the other gets `conflict`.

## 4. Assumptions (change if wrong)

1. "Assigned recruiter" for an uncertain case is the journey owner, otherwise the job's recruiter. New inbound journeys have no owner in this prototype.
2. "Authorised recruitment operations user" is the Tenant Admin or anyone with `team:Manage Team Work`.
3. Who can correct a decision: the same operations users. The assignee who made the decision cannot.
4. The Tenant Admin under mandatory approval is exempt from review (see above).
5. Career Page counts as Oontu-hosted, so it is live when the job is live.
6. A new application to a job that is not live is refused.

## 5. Not decided, needs configuration

- `INTAKE_CONFIG.duplicateWindowMinutes` is `null`. No time window is applied; duplicate judgement uses evidence only. Set one only when the product or the portals define it.
- `INTAKE_CONFIG.waitingEscalationHours` is `null`. Waiting time orders cases within a tier but never escalates. If a limit is set, a case waiting longer moves up one tier.
- Retention of original CVs: the event stores a reference (`artifact.ref`), never the file. Retention and deletion belong to the file store.
- Real job-board adapters (register in `CHANNEL_ADAPTERS`). Each must honour the idempotency key.

## 6. Tests

Run: `powershell -ExecutionPolicy Bypass -File tests\run-auth-tests.ps1 -Spec tests\intake-flow.spec.js` (the auth suite runs with no argument).

Covered: mandatory approval blocks going live; optional approval (direct and review); direct policy; reviewer rules; admin-only policy; publish right; Oontu status independent of channel results; per-channel retry that never re-sends a success; candidate finding only when live; edit history; source and CV retained; failed and partial extraction stay visible and can be completed; enrichment without overwrite; identity conflict; repeat application keeps one journey and does not reset it; closed journey not reopened; repeat external delivery; external ID scoping; no-ID review rules; routing; priority reasons; all three decisions need an explanation; correction history; tenant isolation (jobs, profiles, events, reviews, CVs); simultaneous and retried deliveries; the screens.

Not tested (and why):

- Real concurrency. Tests run in one JavaScript thread, so they show the logic is idempotent, not that a database blocks a race.
- Any real job-board delivery. No adapter exists; only the simulated adapters in the tests.
- Real OCR or CV parsing. Extraction is simulated by what the payload carries.
- Persistence across reloads. Everything resets on reload.
- Visual layout in a browser at several widths, and screen reader behaviour of the new dialogs.
- Authorisation on a server. The checks are in browser code.

## 7. What the backend must add

Database constraints (names illustrative):

```sql
-- one event per external event, per source, per organisation
UNIQUE (organisation_id, integration_id, external_id) WHERE external_id IS NOT NULL
-- one journey per candidate and job
UNIQUE (organisation_id, job_id, candidate_id) ON journeys
-- one open review per event
UNIQUE (event_id) WHERE status = 'open'
-- decision correction: optimistic version on the review row
UPDATE duplicate_reviews SET ... , version = version + 1 WHERE id = $1 AND version = $2
```

Also: apply organisation scoping in every query (not in application code alone), run intake and journey linking in one transaction (insert the event, then insert the journey with `ON CONFLICT DO NOTHING` and read back), check permissions on the server, and make CV access a short-lived signed link after the permission check.

## 8. Manual check, job to Applicants

1. Sign in as the Tenant Admin, open Settings > Job approval, choose "Approval required" with the Tenant Admin as reviewer.
2. Switch to a Recruiter Manager, create a job, select LinkedIn and Naukri, publish. The job page shows "Waiting for approval" and no channel is Live.
3. Switch to the Tenant Admin, open the Jobs list, and approve. The job page shows "Live in Oontu"; LinkedIn and Naukri show "Not connected" with a Retry button (no integration exists), not Live.
4. Open the job > Share job link > Preview, submit an application. It appears under Applicants with its source.
5. Submit the same email again. Applicants still shows one row, now flagged "2 applications".
6. In the browser console, `ingestApplicationEvent('<job id>', { extractionError:'OCR failed' }, { platform:'Indeed' })` makes a row under "Needs a person". Use Add details to complete it.
7. Console: ingest the same person twice from "Indeed" with a different `note`. A possible duplicate appears in Applicants and in the Approval Center for operations users. Try each decision with and without an explanation.
