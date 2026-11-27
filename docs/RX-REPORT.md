# Recruiter-app upgrades G1–G6 — report

_Branch `o2/overnight-2026-11-26`. Brief: `docs/OONTU-GAME-CHANGERS-PROMPT.md`. Date: 2026-11-27._

## Summary

- All six upgrades were already built during the overnight run (tags `rx-g1` … `rx-g6`), so Phase 2 **audited** them and built nothing new.
- Each upgrade sits behind its own switch in `RX_SWITCH` (`g1` … `g6`), **off by default**. Off is today's product. Toggles: sign-in screen › Prototype tools › Recruiter-app upgrades.
- No `bos-*` script and no O2 screen is touched. The only shared hook is the prototype tools panel, which the brief names for the toggles.
- No pre-existing line of the prototype was removed or edited. Every upgrade is a new block (`rx-g1-style`, `rx-g1-script` … `rx-g6-script`) that wraps existing functions. The old function always runs first, and the switch decides whether anything is added.
- Full suite at the end: every switch off **FULL_OFF**; every O2 step and every upgrade on **FULL_ON**.
- Settings for all six live in `WSX.rx` (Settings › Workflow automation): `maxActionsPerDay` 200, `attributionDays` 30, `defaultAgencyFeePct` 8.33, `invoiceGraceDays` 3, `contractInvoiceDay` 3, `reqIdleDays` 7, `redeployLeadDays` 21, `redeployWindowDays` 14, `silverMonths` 12, `dbFirstCount` 25, `directWindowDays` 5, `bookingSlots` 6, `rescheduleCutoffHours` 12.

| Upgrade | Switch | Tag | Spec | Audit |
| --- | --- | --- | --- | --- |
| G1 Live workflow triggers | g1 | rx-g1 | rx-g1-live 9/9 | Pass |
| G2 Automation results | g2 | rx-g2 | rx-g2-results 11/11 | Pass |
| G3 Money at risk | g3 | rx-g3 | rx-g3-leaks 10/10 | Pass |
| G4 Redeployment and contract-end decisions | g4 | rx-g4 | rx-g4-redeploy 10/10 | Pass |
| G5 Own talent first | g5 | rx-g5 | rx-g5-own-first 6/6 | Pass |
| G6 Interview self-booking | g6 | rx-g6 | rx-g6-booking 10/10 | Pass |

The audit checked, for each upgrade:
- the switch defaults off, and off changes nothing (a spec test per upgrade);
- the brief's test is in the spec and passes;
- regressions pass with the switch on and with it off (numbers below);
- no assertion in an older spec was weakened. Two older specs were made switch-aware, and both keep the exact old check when the switch is off: `cowork-agents` (tabs, G2) and `rx-g1-live` (switch line);
- the rollback notes are written.

---

## G1 — Live workflow triggers

1. **Added / wrapped.** Block `rx-g1-script`.
   - The event bus `rxEmit` fires on real changes. It wraps `moveSubmissionStage` (Stage Changed, Interview Scheduled), `offerSetStatus` (Offer Released / Accepted), `ptCreateJoinedRecord` (Candidate Joined), `publishJob` (Job Published), and new records in `CANDIDATES` (Candidate Added).
   - `rxRunWorkflow` runs one workflow for one candidate. `wfPerform` uses the same checks as Run Test. `rxSweep` handles time-based triggers (Notice Period Expiring, Scheduled Refresh) plus the other upgrades' sweepers.
   - Guards:
     - never twice for workflow + event + candidate + event id;
     - paused workflows never run;
     - no consent → skipped "No consent";
     - daily action limit.
   - Wrapped `workflowCardHTML`: last live run, actions today, skips with reasons.
   - Settings section "Workflow automation".
   - Toggles in the prototype tools.
2. **Tests.**
   - `rx-g1-live` 9/9.
   - Regressions with the switch on and off: `cowork*`, `campaigns`, `light`, `design-system`, `motion`, `screens-crawl`, `bos-login` (292/292 off, green on).
3. **Acceptance.** Activating "Offer Follow-up" and accepting an offer gives exactly one action for that candidate. Firing again does nothing. Paused never runs. Run Test output is identical with G1 on and off. All checked by the spec.
4. **Rollback.**
   - Off: no live runs. Workflows stay as they are.
   - Data that remains: `RX.touches`, `RX.runs`, `RX.skips`, `RX.events`, and `wf.lastLiveRunAt`.
   - Cannot be undone: messages counted as sent (simulated, on the same WhatsApp counter as Run Test) and follow-up tasks created.
   - Recovery: delete the tasks, or use Prototype tools › Reset demo data.
5. **Unclear / not done.**
   - Consent counts `candidate.consent.given`, or a given right-to-represent consent on any of the candidate's submissions. No seed has the former.
   - `wfRunTest` was not refactored, so its output cannot change.

## G2 — Automation results

1. **Added / wrapped.** Block `rx-g2-script`.
   - `rxAttribute(outcome)`: the most recent touch within `attributionDays` before the outcome's first step gets the credit; others are listed as "also touched". If two touches share a moment, the one recorded last counts.
   - `rxResults({ days, workflowIds })`: messages, replies, submissions, interviews, offers and joins per workflow.
   - `rxOutcomeMoney`:
     - perm fee from `PLACEMENTS.feeAmount` (₹) or PayTrack `placementFee` (₹ lakhs);
     - contract margin (estimate) from `asCurrentRate`;
     - company: agency fees avoided (estimate) = offered CTC × the average vendor fee % from `CO.rateCards` / `CO.fees`, or the 8.33% assumption.
   - Results tab:
     - agency Cowork: a top tab "Results", and a Results section on each agent page (wraps `caRender`, `caAgentPage`);
     - company Cowork: a Results sub-tab on each agent (wraps `cwAgentPage`).
   - 30/90/365 filter; every number opens its records.
   - Home card on the Owner/Admin Home (wraps `RENDERERS['admin-dashboard']`).
2. **Tests.**
   - `rx-g2-results` 11/11.
   - Regressions on 61/61 + 18 specs; off 351/351.
3. **Acceptance.**
   - A touch 10 days before a submission credits the fee; 45 days before does not.
   - People without billing view see counts but no amounts.
   - Checked by the spec.
4. **Rollback.**
   - Off: no tab, section or card.
   - Data that remains: none (read-only).
   - Cannot be undone: nothing.
5. **Unclear / not done.**
   - Agency Cowork never shows the word "workflow" (an existing spec bans it), so the copy says "automation".
   - Results live in Cowork, where Workflow Studio routes.
   - Results history is computed live; it is not stored.

## G3 — Money at risk

1. **Added / wrapped.** Block `rx-g3-script`.
   - `RX_LEAK_RULES`, 10 rules:
     - agency: perm-not-invoiced, invoice-overdue, approved-time-not-invoiced, timesheet-missing, timesheet-awaiting-client, guarantee-left-no-replacement;
     - company: req-idle, joining-at-risk, work-order-ending, duplicate-dispute-open.
   - `rxLeakSweep`, also run inside `rxSweep`.
   - `rxLeakFix` calls the existing flows: `ptRaiseInvoice`, `ptSendReminder` + task, `asBuildInvoice`, worker and approver reminders as the contracts sweep writes them, `ptOpenReplacementJob`, the "Release to vendors early" dialog, Contract hiring, `coDupReviewOpen`.
   - `rxLeakDismiss`: a reason is required, and a dismissed finding never reopens.
   - Self-closing with "recovered" when money was involved.
   - Money at risk screen (`rx-money-at-risk`).
   - Card on the Owner/Admin Home and on PayTrack.
   - Workflow Studio trigger "Revenue Leak Detected" (conditions: rule, amount, age).
2. **Tests.**
   - `rx-g3-leaks` 10/10.
   - Regressions on 580/580, off 550/550.
3. **Acceptance.** One seeded case per rule, plus the fixed, dismissed and self-closed paths. Checked by the spec.
4. **Rollback.**
   - Off: no screen, card, findings or trigger.
   - Data that remains: `RX.leaks`, `RX.leakRuns`.
   - Cannot be undone: invoices raised, replacement jobs opened, reminders and tasks created by fix buttons.
   - Recovery: through the existing flows (cancel or credit the invoice, close the job), or Reset.
5. **Unclear / not done.**
   - Fixes that belong to later upgrades open today's screen for that record.
   - "Joining at risk" uses a call task and an audited reminder, because `coOnboardRemind` is the vendor onboarding reminder.
   - The commit for G3 was made from your own account (`915386d`). It matches the tested tree and is tagged `rx-g3`.

## G4 — Redeployment (agency) and contract-end decisions (company)

1. **Added / wrapped.** Block `rx-g4-script`.
   - `rxRedeploySweep`:
     - Assignment Ending at 21 and 7 days, once each;
     - Assignment Ended, once;
     - Work Order Ending at 21 and 7 days.
   - `rxRedeployJobs`: open contract jobs ranked by `computeJobMatchPct`, within ±15% pay, with margin against `asMinMargin`. Below the minimum is flagged, never hidden.
   - Availability check page `#/avail/<token>` writes `candidate.availableFrom`.
   - `rxShortlistDraft`: a draft only; a person submits.
   - `rxAskExtend` with the existing extend action.
   - Workflow steps (wrap of `wfPerform`).
   - Redeploy panel (wraps `asPanelHTML`) and Redeploy board (`rx-redeploy`).
   - `rxRedeployMetrics`: redeployment rate and margin retained (estimate).
   - Company:
     - decision card on Contract hiring: Extend via `coWoExtend`, Make permanent via the existing convert dialog, End with a reason;
     - silver medalists on requisition approval (wraps `coReqApproved`) with Invite to apply.
2. **Tests.**
   - `rx-g4-redeploy` 10/10.
   - Regressions on 617/617; off 576/577 (`motion` collapse-pill, the known flake; passed alone).
3. **Acceptance.**
   - The trigger fires once per threshold.
   - Below-minimum jobs are flagged.
   - The availability link updates the worker.
   - The redeployment rate counts correctly.
   - All three company decisions run through existing functions.
   - Checked by the spec.
4. **Rollback.**
   - Off: no triggers, panel, board, page or card.
   - Data that remains: `RX.g4`, `candidate.availableFrom` / `availability`, `wo.endDecision`, `rq.silver`.
   - Cannot be undone: work orders extended or converted (existing flows).
   - Recovery: record a new decision there.
5. **Unclear / not done.**
   - Work orders extend through `coWoExtend`; the brief named `coAssignExtend`, which is the vendor job assignment.
   - "End" has no existing function: it records the decision with an audit line, and the existing sweep ends the work order on its date.
   - The Redeploy board has no menu item yet.

## G5 — Own talent first

1. **Added / wrapped.** Block `rx-g5-script`.
   - Database-first shortlist on `publishJob` and on re-opening through `setJobStatus`.
   - People are left out for no consent, an active process, or contact for another job within 14 days, and the reason is kept.
   - `rxDbFirstSend` records the touches.
   - The job page shows the list and "Placements from own database" (wraps `renderJobDetail`).
   - Company: a Direct sourcing window on the existing internal-first hold.
     - `coReqOpenJob` wrap; 5 working days; urgent roles skip it; 0 turns it off.
     - Own pool, past applicants and silver medalists with Invite.
     - "Release to vendors now" = the existing `coVendorEarlyOpen`.
   - Pseudo-sources "Database-first shortlist" and "Direct sourcing window" are credited in G2.
2. **Tests.**
   - `rx-g5-own-first` 6/6.
   - Regressions on 575/575, off 529/529.
3. **Acceptance.**
   - Exclusions apply.
   - The window holds the release and lifts it on time or by button.
   - Urgent roles skip the window.
   - A hire from the window appears in G2 as agency fees avoided.
   - Checked by the spec.
4. **Rollback.**
   - Off: no shortlist, window or section.
   - Data that remains: `RX.g5`, `job.rxDirectUntil`, and a later `job.internalUntil` on jobs opened while on (vendors wait until that date).
   - Recovery: "Release to vendors now".
5. **Unclear / not done.**
   - The window extends the existing hold and never shortens it.

## G6 — Interview self-booking

1. **Added / wrapped.** Block `rx-g6-script`.
   - Interviewer free hours, `RX.g6.avail` (none existed).
   - `rxFreeSlots`: up to 6 slots, next 5 working days, in the candidate's zone.
   - `rxBookLink`, `rxBook` and `rxBookCancel` go through the hand path: `pipeOpenSchedule` → `ivSave`, and `ivCancel`. Before the client's process starts, the earlier `confirmScheduleInterview` is used.
   - Page `#/book/<token>`.
   - "Send a booking link instead" on the schedule dialog (wraps `ivRender`).
   - Workflow step "Send booking link".
   - `rxBookingMedianDays` on the job page.
2. **Tests.**
   - `rx-g6-booking` 10/10.
   - Regressions on 478/478.
   - Full suite off 1311/1311.
3. **Acceptance.**
   - A booked interview is identical to one scheduled by hand.
   - A taken slot disappears for others.
   - A reschedule after the cutoff is refused with a message.
   - Checked by the spec.
4. **Rollback.**
   - Off: no page, panel or metric.
   - Data that remains: `RX.g6` links and hours.
   - Cannot be undone: interviews booked or cancelled from a link. They are normal interviews; manage them on the Interviews page.
5. **Unclear / not done.**
   - Time zones use fixed offsets (no daylight saving).
   - The Interviews agent's propose step does not send the link yet.

## Recommended next

- Menu items for Money at risk and Redeploy.
- The Interviews agent sends the booking link.
- Daylight-saving-aware zones.
- A real "end work order" function and joiner onboarding data for companies.
- Vendor fee % on rate cards, so the 8.33% assumption is no longer needed.
- G2 history kept across reloads when demo saving is on.
