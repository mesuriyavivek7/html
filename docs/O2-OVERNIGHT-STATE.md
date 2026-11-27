# O2 overnight build — state (checkpoint memory)

Resume with: read this file, `git log --oneline -5`, `git tag -l "o2-step-*" "rx-g*"`, then continue the loop at **Current step**.

- Branch: `o2/overnight-2026-11-26` (from `o2-step-0a` = fa401d6)
- Briefs: `docs/O2-BUILD-BRIEF.md` (Part A), `docs/OONTU-GAME-CHANGERS-PROMPT.md` (Part B), both copied from `Downloads/` at start.
- Progress page: `docs/o2-progress.html` (data block `<script id="o2-data" type="application/json">`). Report: `docs/O2-OVERNIGHT-REPORT.md`.

## Current step

4d

## Steps

| Step | Status | Tag | Tests (new spec) | Notes |
| --- | --- | --- | --- | --- |
| 0a | Done | o2-step-0a | o2-persistence 14/14 | committed at start |
| 0b | Done | o2-step-0b | o2-metrics 10/10; regressions green off/on | o2-metrics-script; data always present, screens behind switch |
| 0c | Done | o2-step-0c | o2-billing-customer 8/8; regressions green off/on | wraps bosTaxPartyOf (not bosTaxSegment: it receives a party); snapshot via BOS.taxInvoices.push hook |
| 0d | Done | o2-step-0d | o2-invoice-view 6/6; regressions green off/on | text-only inv-N → OON mapping on platform screens + bosDialog; isInvoiceOverdue reads tax invoice; legacy plans stripped from pickers (commands unchanged) |
| 1a | Done | o2-step-1a | o2-nav-redirect 9/9; bos-login 8/8 on and off; screens-crawl, light, motion green (motion collapse-pill flake passes alone) | new ids host old screens; bos-login made 1a-aware (same strictness) |
| 1b | Done | o2-step-1b | o2-approvals 5/5, o2-bell 6/6; regressions 130/130 off, on green | Approvals open to all active employees; bos-login 1b-aware |
| 1c | Done | o2-step-1c | o2-search 6/6; crawl, bos-login, a11y green off/on (no older search spec exists) | Sales ticket scope = accounts they or their reports own |
| 2 | Done | o2-step-2 | o2-home 5/5; crawl, light, auth-flow, bos-login green off/on | status line in the body (a later design layer hides page-head ledes); chart colours avoid red/green (light.spec rule) |
| 3a | Done | o2-step-3a | o2-workspace-lifecycle 8/8; regressions 238/238 off, 239/239 on | workspace-close approval type added (suspended→closed needs a second person); spec grants Ishaan Platform Manager as second person |
| 3b | Done | o2-step-3b | o2-workspace-360 7/7; regressions 142/142 off, 143/143 on | old tenant page inside Overview; Account help inside Requests |
| 4a | Done | o2-step-4a | o2-subscription-gateway 5/5; regressions 242/242 off and on | checkout hooked at BOS_PAY.receive (CHECKOUT_DONE is private); 0c checkout link fixed the same way |
| 4b | Done | o2-step-4b | o2-subscription-lifecycle 6/6, o2-access-level 5/5; regressions green off/on | renewal job = one command as SYS-BILLING; dunning schedule kept (equals policy defaults) |
| 4c | Done | o2-step-4c | o2-billing-screens 6/6; regressions green off/on | old tab bodies reused; billing desk action bar on Invoices, Payments, Promo codes |

## How to run tests (this machine)

- `& .\tests\run-auth-tests.ps1 -Spec tests\<name>.spec.js [-Switches 0a,0b] [-Persist]` from the PowerShell tool. Never two at once.
- Full suite: `scratchpad\full-suite.ps1` pattern (loop over `tests\*.spec.js`, sequential). ~45 min per pass.
- Switches for a spec: first line `// @o2-runner switches=0b,0c` (saving stays off), or `-Switches 0b` on the command line. Specs may also call `o2SetSwitch(id, on)` at runtime.
- Helpers in the session scratchpad (recreate if lost): run-list.ps1 (list or ALL), progress.ps1 (progress JSON), state.sh, insert.sh (insert a block before o2-persist-script), eval.ps1 (evaluate expressions in the app).
- New O2 blocks go just before `<script id="o2-persist-script">` (persist must stay last).
- Headless Chrome sometimes hangs at launch: kill `chrome.exe` with `--dump-dom` in its command line and its children (same `oontu-auth-tests-*` profile), rerun alone.

## Decisions

(see report; mirrored in progress page)

## Open problems

none

## Queued after the overnight build (owner message, 2026-11-26 22:3x)

Start only when the overnight build has printed its final "Done. Report: …" line, every step is Done/Blocked/Skipped and git is clean.
- **Phase 1 — audit** on o2/overnight-2026-11-26: tag per Done step; full suite twice (off / all passed on); re-check every acceptance list; review diff from o2-step-0a (nothing deleted or weakened, switches default off, bos-tax output unchanged, no numbering/price/tax change, data changes through bosRun, mock numbers labelled); retry Blocked steps once; fix ("O2 audit: …"); write docs/O2-AUDIT-REPORT.md; tag o2-audited.
- **Phase 2 — G1–G6** from docs/OONTU-GAME-CHANGERS-PROMPT.md behind RX_SWITCH (default off), from tag o2-audited, same branch; per upgrade: read, baseline, build, self-review, test (new spec on; regressions on/off; screens-crawl; bos-login), acceptance, commit "RX G<n>: …", tag rx-g<n>. If rx-g tags exist from the overnight build, audit them and build only the missing ones.
- Progress page gets sections "Audit" and "Recruiter-app upgrades G1–G6". End: full suite twice; docs/RX-REPORT.md.
- Final line: `Done. Audit: docs/O2-AUDIT-REPORT.md · Upgrades: docs/RX-REPORT.md · Progress page: docs/o2-progress.html · Branch: o2/overnight-2026-11-26`
- Same never-list (no push/merge/force/delete, no packages, never two test passes at once, no uncommitted changes).
