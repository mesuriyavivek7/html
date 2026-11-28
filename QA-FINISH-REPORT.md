- **Account 360 › About this account › Domains shows `[object Object]`** (O2 step 5, found by the tour). Not fixed: it is outside the Part A list.
- **From CX-REPORT §7, unchanged:**
  - the LinkedIn partner programme (a business task);
  - real rates, now badged as placeholders;
  - playbook timing windows;
  - production adapters (Gmail push, Graph, Meta signed webhooks, SES, Postgres ledger).
- **WhatsApp Web lane.** Off by default under CX, and agents never use it. Removing the lane entirely when CX becomes the default is still a product decision.
- **The A8 check** covers 31 screens with CX off and 34 with CX on, as the Owner, Recruiter, Recruiter Manager, Hiring Manager and Super Admin. Screens not in that list (deep dialogs, every Settings section) were not measured at 375 px.
- **Test timing.** In the CX-off full suite, `cowork-agents` produced no result. It ran while the screenshot job was using the machine. Alone it passes 26/26 in 136 s. With nothing else running it takes about 2–4 minutes, so it is the spec to watch on a slow machine.
1. Review the tour (`qa-tour/QA-TOUR.html`) and export the results. Fix or accept any Fail.
2. Decide the defaults. `O2_SWITCH`, `RX_SWITCH` and `CX_SWITCH` are all off in code, so merging changes nothing for users until they are turned on.
3. Rebase or merge `main` into the branch first. `main` (`5b98966`) has moved since the merge-base (`96956a2`). This branch holds 94 commits on top of it, including one Business OS commit (`ea8919d`) that is not on `main`.
4. Run the full suite in both modes on the merged result (`run-list.ps1 -Specs ALL`, and again with `-Cx`).
5. Set the real credit rates, and remove the "Rates (placeholder)" badge when they are final.
6. Fix the Account 360 Domains field.
7. Nothing has been pushed. Pushing and opening the pull request is your call.
# QA finish-up fixes and visual QA tour — report

_2026-11-28 · branch `o2/overnight-2026-11-26` · local commits only (nothing pushed, merged or deployed)._

## 1. Part A — finish-up fixes

Each fix is one `fix:` commit. New behaviour is behind the existing switches (CX fixes act only with `CX_SWITCH` on; A8 is phone-width CSS for every mode). Earlier blocks are wrapped, not rewritten. No assertion was loosened.

| # | Item | Status | Commit | Test |
| --- | --- | --- | --- | --- |
| A1 | demo-data never expires | Done | `02e4fb8` | `demo-data` 9/9, CX off and on |
| A2 | CX-on spec for the retired behaviour | Done | `f4d0d5c` | `cx-retired` 3/3 (new) |
| A3 | "≈ N credits" on every spending button, ₹ on hover | Done | `76bad3a` | `cx-estimates` 6/6 (new, scans the CX screens) |
| A4 | Company campaign plays and vendor-submitted screening use the credit path | Done | `db72462` | `cx-audit` 6/6 (two new tests) |
| A5 | Builder: "Add a second version" (2 max) | Done | `c8f1490` | `cx-campaign-builder` 15/15 (one new test) |
| A6 | Real virtual scrolling in the live ledger | Done | `04ab5d3` | `cx-ledger-vscroll` 9/9 (new, 10,000 rows, < 100 in the DOM) |
| A7 | WhatsApp Web lane hidden by default under CX | Done | `dd55a77`, `53dc498` | `cx-wa-web` 7/7 (new) |
| A8 | Nothing runs off the screen at 375 px | Done | `ca85e42`, `53dc498` (CSS), `c4abf47` (check) | `mobile-375` 3/3 CX off and on (new) |
| A9 | "Rates (placeholder)" badge | Done | `591cbb7` | `cx-credits` 15/15 (one new test) |
| A10 | Did the Agent transformation A0–A9 run? | Checked: no | — | — |

### What each fix does

- **A1.** The Vistaar demo seed gave each contract up to 8 weekly timesheets. A start 60–63 days back left the 8th week, or its approval, in the future on some weekdays, so "8 approved weeks each" depended on the date. Every contract now starts at least 66 days before the seed's own clock. The seed's random draws are unchanged.
- **A2.** `tests/cx-retired.spec.js` runs with CX on and proves:
  - per-agent prices, trials, "Not in your plan" and "Add for ₹" are gone;
  - the engine sends no LinkedIn invites, and every automation entry point refuses;
  - LinkedIn infrastructure (GoLogin, proxies) is hidden from the platform settings.
  - The CX-off side stays proved by `cowork-agents`, `cowork`, `settings` and `o2-nav-redirect`.
- **A3.** `CX_SPEND_CLICKS` says what each spending click costs:
  - Read the job (ai-strong);
  - rewrite (ai-small);
  - Start campaign (the review's own estimate);
  - Add to the conversation (reading the reply plus the first screening question);
  - Needs you answers (the next message);
  - LinkedIn task.
  - `CX_FREE_CLICKS` lists clicks that reach a spending function but cannot spend (Mark sent, Skip, Accepted). The spec proves they add no ledger row.
  - Cowork and the job page's criteria card are decorated. A button that already said "≈ …" gets only the hover.
  - The scan reads function sources transitively from `cxReserve`, so a new spending button without an estimate fails the test.
  - Wrappers now expose `__base` so the scan can see through them.
- **A4.** Company campaigns used to be charged by the ledger hook after the send, so a send could go out with no credits. Now:
  - `cpSendStep` reserves before the send and settles after. Templates wait for the delivery receipt. With no reservation there is no send; the person waits with "Paused: credits".
  - A LinkedIn campaign step under CX is a person task. The person goes to the LinkedIn queue, which reserves and settles itself.
  - Vendor-submitted candidates get a profile check against the job's criteria once they agree (ai-medium, reserve → settle). With no credits there is no check, and a task says so.
- **A5.** A step's version B is stored as `step.messageB`, so version A, saved campaigns and templates read as before.
  - The step card shows "2 versions" and a Version B editor, and offers no third version.
  - Sends alternate between versions.
  - The C4 rule (`cxAbRecord`, 50 sends each, interested rate) decides, unchanged; after that every send uses the kept version.
  - The campaign page shows sent and interested % per version, then "kept" and "retired".
- **A6.** The ledger sits in its own scrolling box and draws only the rows in view (60 at most). Padding stands in for the rest.
  - Filters reset to the top. A live re-render keeps the place.
  - `cxLedgerRows` and `cxExportCsv` are unchanged, so filters and CSV cover every row.
  - The job page's short list (explicit limit) is unchanged.
- **A7.** "Allow personal WhatsApp Web inbox" is in Settings › Cowork › Cowork v2. It is off by default and carries the line "WhatsApp Web (a linked device) is not the official WhatsApp API…".
  - While it is off, personal WhatsApp chats leave the Inbox; campaign replies from the business number stay.
  - My connections, the Inbox card and Kairo say the lane is off, with no QR.
  - Agents always send through the Cloud API (stamped `via:'cloud-api'`), and the spec shows the agent path never reads the personal link.
  - A person's own reply goes through the Cloud API inside the 24-hour window (wa-window, reserved and settled), otherwise by click-to-chat (`wa.me`).
  - The tour found the warning line printed as escaped markup (`<span…>`); fixed in `53dc498`, and the test now checks for it.
- **A8.** The page itself already never scrolled sideways (html/body clip it). The real faults were rows cut off at the screen edge. `tests/mobile-375.spec.js` loads the app in a 375 × 812 frame and visits 31 screens (CX off) or 34 (CX on). Headless Chrome will not lay out a window under ~500 px, so earlier "375 px" screenshots were really 512 px wide. Fixed:
  - Approvals phone tabs;
  - Cowork setup card rows;
  - job page list chips;
  - My to-do add row;
  - candidate profile "Now" menu;
  - manager Team chips;
  - hiring manager role rows;
  - Cowork agent card footers;
  - Cowork number tiles: four across became two across on a phone (found by the tour's phone screenshots; the CSS landed in `53dc498` together with the A7 text fix, the check in `c4abf47`).
- **A9.** No rates table was on screen, so the badge needed one. Settings › Cowork › Cowork v2 now shows a read-only "Credit rates" table from `CX_RATES` under a "Rates (placeholder)" badge. Nothing about rates or money changed.
- **A10.** The Agent transformation task (A0–A9) did not run:
  - `OONTU-AGENT-TRANSFORMATION-PROMPT.md` exists only in Downloads (27 Nov, 23:24);
  - there is no `AX_SWITCH` in the code, no `ax/` branch or tag, no `docs/oontu-agent-transformation/`, no `AX-REPORT.md` and no progress-page section;
  - the Cowork v2 prompt (28 Nov, 00:19) replaced it and covers the same ground: one wallet, assisted LinkedIn, retired automation behind a switch.

### Full suite

The target was 1,408 / 1,408 in both modes. The fixes added tests, so both totals are now higher, and every test passes.

| Mode | Result | Notes |
| --- | --- | --- |
| CX off | **1,440 / 1,440** | The full run gave 1,414 / 1,414 plus `cowork-agents` with no result. That spec ran while the screenshot job was using the machine; alone it passes 26 / 26. The run was before `53dc498` and `c4abf47`, which change only phone-width CSS and CX-only text. The CX-off specs those touch (`mobile-375`, `cowork-visual`) were rerun and pass. |
| CX on | **1,441 / 1,441** | A full run on the final code (`c4abf47`): all green. |

- `demo-data` (the only failure before) now passes in both modes.
- The CX-on total is one higher because the phone-tiles check runs only with CX on.
- Runner: `run-list.ps1 -Specs ALL` (and with `-Cx`), one spec at a time, never two passes at once.

## 2. Part B — visual QA tour

**Open `qa-tour/QA-TOUR.html`** (double-click; it reads its pictures from `qa-tour/img/`). A printable version is `qa-tour/QA-CHECKLIST.md`.

| Run | What | Cards | Under the hood |
| --- | --- | ---: | ---: |
| 0 | Agent transformation A0–A9 | 0 (did not run) | — |
| 1 | O2 Super Admin build (steps 0a–9) | 17 | 5 |
| 2 | Recruiter-app upgrades G1–G6 | 6 | 1 |
| 3 | Cowork v2 (C0–C10) | 11 | 4 |
| 4 | QA finish-up fixes (A1–A10) | 6 | 4 |
| | **Total** | **40** | **14** |

- **BASE** is `ea8919d`, the commit just before the first overnight commit (`fa401d6`, O2 0a). The merge-base with `main` is `96956a2`. `ea8919d` is one Business OS commit after it, and is not on `main`.
- **Splitting the commits into runs:**
  - Run 1: `O2 …` commits up to `13647b5`, including the O2 audit.
  - Run 2: `RX G1–G6`, including the RX audit.
  - Run 3: `cx: C0–C10`.
  - Run 4: the `fix:` commits.
- **Before pictures.**
  - Runs 1–3 use a worktree at BASE, with the same steps.
  - Run 4 uses a worktree at `0ccf679` (Cowork v2 done, before the fixes) with CX on.
  - Where a screen did not exist, the picture is a grey "New screen" card: 16 before-pictures.
  - Both worktrees were removed at the end.
- **After pictures** come from the current file with the item's switches on. The red box is drawn around the changed element and follows it, so it stays right when the page shifts.
  - 1440 × 900 for every card.
  - 375 × 812 for the 18 main screens, loaded in a 375 px frame. Headless Chrome won't lay out a narrower window.
  - 114 pictures in all, taken by `tools/qa-shots.ps1`. The page is built by `tools/qa-tour-build.ps1` from `qa-tour/items.json`.
- **Each card** has:
  - id, run and screen;
  - where to go, switch and login, and an Open button (`?cx=1` for Cowork);
  - what changed, and 3–5 checks;
  - before/after with Enlarge and a slider;
  - the phone view;
  - Pass / Fail / Not checked and a note.
  - Results stay in the browser (localStorage, guarded). Export results downloads `qa-results.csv`.
  - Order: Super Admin → recruiter app → Cowork. Cowork follows a new tenant's path: setup → Credits → job 42 picks → builder → LinkedIn queue → pasted reply and screening → prospect → Live hires → Revenue & Redeploy → Kairo → agents page.
- **B5 self-check** (`tools/qa-tour-check.html`, headless): 17/17. It checks:
  - 40 cards, every one with pictures and at least 3 checks;
  - group order, and the Cowork path order;
  - run, screen, status and search filters;
  - progress counts;
  - the export (header plus 40 rows, with the result and note);
  - results surviving a reload.
  - The check restores any saved tour results when it ends.
- **Red boxes.**
  - Every after-picture reported its box in place (`qa-tour/shots.json`).
  - Five were opened and looked at: R2-G1, R4-A7, R3-C4, R1-3b phone, R1-0c. All were on the changed element; the R1-3b phone box sits on the Danger zone heading.
  - Four boxes that had first missed (R1-0c, R1-5, R1-7b, R2-G1) were fixed by changing the steps.
- **Every "done" item in the reports is in the tour or listed under the hood:**
  - O2: 3a is shown in the 3b card; 4a and 4b in the 4c card; 7a in the 7c card and under the hood; 0a's engine and step 9 are under the hood.
  - RX: G1–G6 all have cards.
  - Cowork: C0, C9 and C10 are under the hood; the rest have cards.
  - Part A: A1, A2, A4 and A10 are under the hood; the rest have cards.
- **The tour found three things:**
  - the A7 warning shown as markup, and the Cowork number tiles cut off on a phone — both fixed (see A7 and A8);
  - Account 360's "Domains" field shows `[object Object]` (O2 step 5) — still open.

## 3. Decisions made without asking

| Situation | Decision |
| --- | --- |
| Tests per Part A item | Each item ran its own spec plus the specs it touches, in both modes where it matters; the full suite ran once per mode at the end (a full pass is ~45 minutes per mode). |
| ₹ on hover (A3) | Shown only to people who already see money (`cxMoney()`); a recruiter's hover says "Credits come from the shared wallet". Recruiters never see ₹ (earlier rule). |
| Vendor screening (A4) | Implemented as a profile check (fit against the job's criteria) when the candidate agrees, not a message exchange; vendors' candidates are already in a conversation with the vendor. |
| LinkedIn campaign steps under CX (A4) | Not sent by the engine; the person goes to the LinkedIn queue (assisted), because CX retires LinkedIn automation. |
| Person-sent WhatsApp through the Cloud API (A7) | Charged as wa-window (reserve → settle) like any other window message. |
| Rates table (A9) | Added a read-only table so the badge has something to sit on; "no other code change" otherwise. |
| A8 measuring | A 375 px frame, as `cowork-visual` does at 390; elements inside their own scrolling box are allowed, clipped content is not. |
| Before images | Runs 1–3: the BASE worktree (`ea8919d`) with the same steps; where a screen did not exist (or its code was not there) the grey "New screen" card. Run 4: a worktree at `0ccf679` (Cowork v2 done, before the QA fixes) with CX on. |
| Playwright | Not installed (no new packages allowed); headless Chrome takes the screenshots (`tools/qa-shots.ps1`). |

## 4. Still open


## 5. Before merging

