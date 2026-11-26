# O2 overnight build — state (checkpoint memory)

Resume with: read this file, `git log --oneline -5`, `git tag -l "o2-step-*" "rx-g*"`, then continue the loop at **Current step**.

- Branch: `o2/overnight-2026-11-26` (from `o2-step-0a` = fa401d6)
- Briefs: `docs/O2-BUILD-BRIEF.md` (Part A), `docs/OONTU-GAME-CHANGERS-PROMPT.md` (Part B), both copied from `Downloads/` at start.
- Progress page: `docs/o2-progress.html` (data block `<script id="o2-data" type="application/json">`). Report: `docs/O2-OVERNIGHT-REPORT.md`.

## Current step

0c

## Steps

| Step | Status | Tag | Tests (new spec) | Notes |
| --- | --- | --- | --- | --- |
| 0a | Done | o2-step-0a | o2-persistence 14/14 | committed at start |
| 0b | Done | o2-step-0b | o2-metrics 10/10; regressions green off/on | o2-metrics-script; data always present, screens behind switch |

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
