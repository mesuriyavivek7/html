# Oontu — existing feature inventory (partial, code-verified)

File: `recruitment-os-prototype.html` (about 47,500 lines, single file, in-memory data; nothing here is a production backend). Classes: A complete, B improve, C partial, D UI only, E missing. Items below were checked in code this pass; screens not listed are covered by `docs/product-flow-audit.md` and `docs/role-wise-workflow-matrix.md` and have NOT been re-audited line by line.

## Matching and talent

| Feature | Where / function | Data | Status |
|---|---|---|---|
| Match percentage | `computeJobMatchPct(c, job)` | Required-skill overlap only, case-insensitive exact match | **B**: works, but ignores preferred skills, seniority, pay, notice, work mode; no skill adjacency (Java vs Kotlin counts as zero) |
| Match reasoning | `computeMatchReasoning`, `matchReasoningHTML` | Matched/missing/bonus skills, experience vs `minExp`, same-city check | **B**: improved this pass (see log) with availability and pay fit |
| Best job match | `bestJobMatch(c)` | Highest pct across Active jobs | A (inherits the matching limits) |
| Job-create talent preview | `jcTalentMatches`, `jcPayFit` | Reuses `computeJobMatchPct`; pay fit vs strong matches | A/B |
| Talent pool, advanced search | `renderTalentPool`, `computeAdvancedSearchResults` | CANDIDATES | A |
| Duplicate handling | `detectDuplicates`, `ncFindDuplicate`, duplicate review and AR-5 override | clients, submissions | A |

## Intelligence

| Feature | Where | Finding | Status |
|---|---|---|---|
| Intelligence page | `renderIntelligence`, `intelBottlenecks`, `intelPipelineRisk`, `intelDropoff` | Rules on days open, pipeline count and per-candidate numbers | C |
| Join, response and counter-offer numbers | candidate fields `joinProb`, `respProb`, `counterRisk` (typed by hand per candidate; new candidates default to 60/60/30) | Shown as "probability" and "risk" in many places (gauges, dashboards, workflow conditions, Intelligence). They are fixed numbers, not model output | **P0 honesty gap**: relabelled "indicative" this pass; real signals need outcome data |
| Recruiter score | `computeRecruiterScore` | Weighted formula; the page already discloses that submission quality and interview conversion are org-wide | B |
| Revenue | `computeRevenue`, `PLACEMENTS`, `revenueAnalyticsHTML` | Real fee records with split credits | A |
| Reports funnel | `renderReports` | Stage counts from pipeline entries | B (no stage-to-stage conversion or ageing) |

## Other modules (names only; see earlier trackers)

Kairo and AI Workforce (`kairoRespond`, `kairoForJob`, `renderOontuAgents`), Workflow Studio, Cowork campaigns, Clients, Approvals engine (APS), Interviews and secure links, Settings, Roles and permissions, Audit, PayTrack, Corporate (requisitions, vendors, marketplace, contract hiring), Sign-up recovery and join requests, Oontu admin screens.
