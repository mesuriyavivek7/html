# O2 overnight build — state (checkpoint memory)

Resume with: read this file, `git log --oneline -5`, `git tag -l "o2-step-*" "rx-g*"`, then continue the loop at **Current step**.

- Branch: `o2/overnight-2026-11-26` (from `o2-step-0a` = fa401d6)
- Briefs: `docs/O2-BUILD-BRIEF.md` (Part A), `docs/OONTU-GAME-CHANGERS-PROMPT.md` (Part B), both copied from `Downloads/` at start.
- Progress page: `docs/o2-progress.html` (data block `<script id="o2-data" type="application/json">`). Report: `docs/O2-OVERNIGHT-REPORT.md`.

## Current step

0b

## Steps

| Step | Status | Tag | Tests (new spec) | Notes |
| --- | --- | --- | --- | --- |
| 0a | Done | o2-step-0a | o2-persistence 14/14 | committed at start |

## How to run tests (this machine)

- `& .\tests\run-auth-tests.ps1 -Spec tests\<name>.spec.js [-Switches 0a,0b] [-Persist]` from the PowerShell tool. Never two at once.
- Full suite: `scratchpad\full-suite.ps1` pattern (loop over `tests\*.spec.js`, sequential). ~45 min per pass.
- A switch can be forced on for a spec with `-Switches <ids>`; a spec can also declare `// @o2-runner switches=<ids>` (only with `persist`, see runner regex) — new O2 specs set their switches themselves with `o2SetSwitch(id, true)` at the top instead.
- Headless Chrome sometimes hangs at launch: kill `chrome.exe` with `--dump-dom` in its command line and its children (same `oontu-auth-tests-*` profile), rerun alone.

## Decisions

(see report; mirrored in progress page)

## Open problems

none
