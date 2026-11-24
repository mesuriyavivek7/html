# 26 · Implementation baseline

The reference point for every Phase 3 change. Recorded 24 Nov 2026.

## 1. Repository and branch

| Item | Value |
|---|---|
| Branch | `agency-prototype-v2` (also `main` up to `fcb54ff`) |
| HEAD at start of Phase 3 | `88d8760` (documents only; application code identical to `fcb54ff`) |
| Remote | `origin` (GitHub). `agency-prototype-v2` was one commit ahead of `origin` at start (88d8760, not pushed) |
| Working tree at start | Clean |
| Other local work preserved | `auth-oa-screens` has 2 unpushed commits; `jaydeep-changes` holds the one-Job corporate model; backup branches untouched |

## 2. Structure and stack

| Path | What it is |
|---|---|
| `recruitment-os-prototype.html` | The whole product: about 65,000 lines of HTML, CSS and plain JavaScript, no build step, no package manifest |
| `oontu-approval-sla-engine.js` | Approvals engine (`window.APS`), also inlined into the page |
| `assets/brand/` | Approved logos, favicons, app icons |
| `tests/*.spec.js` (52 at baseline) + `tests/run-auth-tests.ps1` | Browser specs injected into a temporary copy of the page and run in headless Chrome/Edge |
| `test/aps.test.js` + `test/run-aps-tests.ps1` | APS engine unit tests (run in headless Chrome because Node is absent) |
| `docs/` | Product, flow and architecture documents |
| `backups/` | Earlier copies |

There are **no** backend services, packages, shared libraries, infrastructure code, CI configuration, database, migrations, environment files or deployment configuration in the repository.

## 3. Machine toolchain (this workstation)

| Tool | Present |
|---|---|
| Git | Yes |
| Chrome/Edge (headless test runner) | Yes |
| PowerShell 5.1, Git Bash | Yes |
| Node.js / npm / Deno / Bun | **No** |
| Python | **No** (only the Microsoft Store alias) |
| .NET | Runtimes 8/9/10 only, **no SDK** |
| PostgreSQL / SQLite / any database | **No** |
| Docker | **No** |
| WSL | Installed, **no distribution** |

**Consequence:** the server milestones in 23 (J0–J10), which need a runtime, a database and a migration tool, cannot be built or tested on this machine without installing software. Installing a runtime and a database is a system change and needs your decision (and D-1 is still open). This is recorded as blocker B-1 in 30.

## 4. Environment variables, integrations, secrets

- No environment files. Configuration is `window.OONTU_AUTH_CONFIG` in the page (mode `prototype` by default) and test hooks (`OONTU_MOTION_SCALE`, `AUTH_SKIP_OTP`, `AUTH_OPEN_SIGNIN`, `OONTU_PW_NUDGE_MS`).
- External integrations are all simulated: email, SMS/WhatsApp, LinkedIn, calendars, SSO/OAuth, model providers (`PLATFORM_AI` shows masked placeholder keys only; no real secret is in the repository).
- The only real network call is the untested live auth adapter.

## 5. Deployment architecture

None. The page can be opened from disk or any static host, with `assets/brand/` beside it.

## 6. Test baseline (before any Phase 3 change)

Full run at `fcb54ff`, 52 specs, headless Chrome, 1440×900:

- **All green except 7 known failures in 5 specs:** `cowork-simple` (Northstar page height), `cowork-visual` (390 px iframe cross-origin SecurityError), `demo-data` (personal-link owner reassigned by the SLA round-robin), `design-system` ×3 (collapsed sidebar icon 30 px, logo x offset, white pill), `walkthrough-fixes` K9 (Vistaar history 99%).
- These 7 also fail at `206c54d`, before the 24 Nov merge (verified by running the same specs against a scratch copy of that commit). They are baseline failures, not regressions.
- APS engine tests: run alongside the Phase 3 regression run; result recorded in 29.

Documentation identifier check: 557 backticked identifiers in 00–24 searched in the code, specs and `docs/AUTH.md`. Every reference to existing code resolves; the unresolved names are proposed future entities and tables (for example `VendorRelationship`, `job_vendor_access`), the commit id `fcb54ff`, and `fromJob` (exists only on `jaydeep-changes`).

## 7. How to measure later changes

Run `& .\tests\run-auth-tests.ps1 -Spec <spec>` for each spec, or the loop in 29. A change is a regression if any spec outside the 7 baseline failures fails, or if a baseline failure changes its message.
