# Oontu — implementation log (2026-10-30)

All changes are in `recruitment-os-prototype.html`. Nothing committed.

| Id | Change | Function / area |
|---|---|---|
| L1 | Candidate gauges relabelled "Join score (indicative)", "Counter-offer signal (indicative)", "Response score (indicative)" | candidate profile gauge row |
| L2 | Kairo activity summary no longer says "predicted join probability"; says the figure is indicative | `kairoActivitySummary` |
| L3 | Intelligence pipeline-risk text no longer claims it is based on tenure and engagement | `intelPipelineRisk` |
| L4 | HM dashboard attention row showed `joinProb` as "% match"; now shows the best job and its real skills match | `renderHmDashboard` |
| L5 | Workflow field "Relevance / Match Score" read `joinProb`; now reads the best skills match from `bestJobMatch` | workflow field list (`matchScore`) |
| L6 | Match explanation gains Availability (notice period) and Pay (expected vs budget) lines and a note that they are rules; the match percentage is unchanged | `computeMatchReasoning`, `matchReasoningHTML` |

| L7 | Flow analytics from each submission's `stageHistory`: `flowFunnel`, `flowReachedAt`, `flowDwellDays`, `flowBySource`, `flowStalled` (placed before `computeRecruiterRevenue`) | analytics helpers |
| L8 | Reports: four hard-coded KPI cards replaced by joined count and average days to interview, offer and join (each with its sample size); invented 35% benchmark removed; new Stage conversion and By source card; placements-per-month now built from real joining dates | `renderReports` |
| L9 | Intelligence hiring bottlenecks gain "no movement for 7+ days" items, labelled as a rule | `intelBottlenecks` |
| L10 | Recruiter score: submission quality and interview conversion now count the recruiter's own submissions; page shows the sent count | `computeRecruiterScore`, `renderRecruiterAnalytics` |
| L11 | Second workflow field list (Cowork) also read `joinProb` as "Match score"; now the real skills match | Cowork condition fields |

| L12 | `computeJobFit`, `SKILL_ADJACENCY`, `FIT_WEIGHTS`, `MATCH_MODEL` (R5). Detailed fit is shown in the match explanation; ranking stays on the skills match until approved. Before/after in `docs/OONTU_MATCHING_BEFORE_AFTER.md` | matching |
| L13 | `coInsights`, `CO_RULES` and cards on Requisitions (oldest open, where approvals wait), Vendors (duplicates, agreed, shortlisted) and Contract hiring (ending soon, time waiting, weeks with no time, rate card) | corporate block |
| L14 | `clientSignals`, `clSignalsHTML` on the client account Jobs tab: reply speed, requirement quality (coded rejection reasons, old jobs) and progress. Not on Overview, which a client test pins to three parts | client account |
| L15 | Kairo job panel: `kairoAccept`, `kairoLogOutcome`; accepted and dismissed suggestions go to the job log and the Audit Log; panel states that people decide | `kairoJobHTML`, `kairoTopHTML`, `kairoDismiss` |
| L16 | Settings switch `hiring.aiDisclose` (default on): a line is added to every message Kairo drafts | `cwTemplateText`, Cowork settings card |
| L17 | Audit Center: Fairness and AI use report (what ranking uses, pass-through by candidate city with small-sample marks, what is not collected, human control) | `fairnessReportHTML`, `renderAuditCenter` |
| L18 | Reports states why no forecast is shown and what history one would need | `renderReports` |

Backup before changes: `backups/recruitment-os-prototype.pre-intelligence-audit.html`.
