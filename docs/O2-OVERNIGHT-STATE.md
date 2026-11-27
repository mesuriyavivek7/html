# O2 overnight build — state (checkpoint memory)

Resume with: read this file, `git log --oneline -5`, `git tag -l "o2-step-*" "rx-g*"`, then continue the loop at **Current step**.

- Branch: `o2/overnight-2026-11-26` (from `o2-step-0a` = fa401d6)
- Briefs: `docs/O2-BUILD-BRIEF.md` (Part A), `docs/OONTU-GAME-CHANGERS-PROMPT.md` (Part B), both copied from `Downloads/` at start.
- Progress page: `docs/o2-progress.html` (data block `<script id="o2-data" type="application/json">`). Report: `docs/O2-OVERNIGHT-REPORT.md`.

## Current step

Overnight build COMPLETE. Next: queued task Phase 1 (audit)

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
| 4d | Done | o2-step-4d | o2-allocation 10/10; regressions 181/181 off, 182/182 on | ambiguous amount matches are not suggested; allocate permission = holders of verify_payment |
| 5 | Done | o2-step-5 | o2-customers 6/6; regressions 155/155 off, 156/156 on | old account page kept inside Overview; 1a's Pipeline/Sign-ups strip steps aside when 5 is on |
| 6 | Done | o2-step-6 | o2-incident 5/5; regressions 141/141 off, 142/142 on | visible states on ticket rows and ticket head only; 'att' badge variant handled |
| 7a | Done | o2-step-7a | o2-audit 7/7; BOS + shell specs 316/316 off and on (full suite at the 7c checkpoint) | logged once at the outermost command |
| 7b | Done | o2-step-7b | o2-mfa 5/5; sign-in specs 220/220 off, 221/221 on | step-up applies to sessions that signed in through the two steps |
| 7c | Done | o2-step-7c | o2-people 7/7, o2-sod 6/6; regressions green off/on | template-internal conflicts warn, combined conflicts need override; policy sign-off kept in BOS.policyChanges |
| 8a | Done | o2-step-8a | o2-entitlements 5/5; regressions 214/214 off, 215/215 on | derived split (old rows unchanged); availability matrix identical on/off |
| 8b | Done | o2-step-8b | o2-agents 6/6; regressions 151/151 off, 152/152 on | allow-list enforced at bosRun for agent actors |
| 9 | Done | o2-step-9 | o2-flows 8/8 twice; 8b checkpoint stands (no code change) | nothing removed; candidates listed |
| G1 | Done | rx-g1 | rx-g1-live 9/9; regressions 292/292 off, green on | wfRunTest untouched (wfPerform reimplements its checks per candidate); consent = candidate consent or M7 representation consent |
| G2 | Done | rx-g2 | rx-g2-results 11/11; regressions on 61/61 + 18 specs, off 351/351 | Results tab + Home card; agency Cowork forbids the word workflow, copy says automation |
| G3 | Done | rx-g3 | rx-g3-leaks 10/10; regressions on 580/580, off 550/550 | fixes for G4/G5 items open today's screens; joining-at-risk uses call task |
| G4 | Done | rx-g4 | rx-g4-redeploy 10/10; regressions on 617/617, off 576/577 (motion collapse-pill flake, passes alone) | work orders extend via coWoExtend; end records endDecision |
| G5 | Done | rx-g5 | rx-g5-own-first 6/6; regressions on 575/575, off 529/529 | window = existing internalUntil hold, extended only |
| G6 | Done | rx-g6 | rx-g6-booking 10/10; regressions on 478/478; full suite off 1311/1311 | availability added (none existed); fixed tz offsets |
| G6 checkpoint | Done | rx-g6 | full suite off 1311/1311, all on 1313/1313 | overnight build complete |

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
