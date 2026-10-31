# Oontu — improvement recommendations

Priority: P0 correctness/trust, P1 improve existing, P2 missing capability, P3 advanced. Complexity S/M/L. "Needs data" means no honest version exists until real history is captured.

| # | Recommendation | Where it goes | Who benefits | Class | Priority | Size | Status |
|---|---|---|---|---|---|---|---|
| R1 | Stop showing hand-typed numbers as predictions | Candidate gauges, Intelligence, dashboards, workflows | All users, trust | B | P0 | S | **Done** (labels and two wrong uses) |
| R2 | Add notice, pay and work-mode checks to the existing match explanation | `computeMatchReasoning` | Recruiter | B | P1 | S | **Done** for notice and pay; work mode not recorded on candidates yet |
| R3 | Record stage-change events (who, when, from, to, reason) | Data layer under submissions and pipeline | Everyone downstream | F | P1 | M | Open; unlocks R4 to R8 |
| R4 | Stage conversion, ageing and source effectiveness inside Reports | `renderReports` | Manager, owner | B | P1 | M | Open; needs R3 |
| R5 | Preferred skills and seniority in the skills score, with skill adjacency list | `computeJobMatchPct` | Recruiter | B | P1 | M | Needs approval: it changes every match percentage and ranking |
| R6 | Attribute decisions and interviews to the sourcing recruiter | Data fields, Recruiter Analytics | Manager | B | P1 | S | Open |
| R7 | SLA risk and stalled-submission cues from real timestamps | Intelligence, notifications | Recruiter, manager | B | P1 | S/M | Partly there (flow SLA sweep); fold into Intelligence |
| R8 | Fill-time and offer-acceptance forecast | Job detail, Reports | Manager, client | F | P3 | L | Needs real outcome history; until then show plain averages with the sample size |
| R9 | Fairness report: pass-through by group, no protected data in ranking | Audit Center | Admin, compliance | F | P2 | M | Open; needs consented, lawful data |
| R10 | Disclose AI use to candidates on messages Kairo drafts | Composer, templates | Candidate | F | P2 | S | Open |
| R11 | Client response speed and requirement-quality signals | Client account | Owner, manager | B | P2 | M | Needs R3 |
| R12 | Contract expiry, timesheet exceptions and rate-card compliance cards | Contract hiring | Corporate TA | B | P2 | S | Partly in contract screens; review next |

Status after the second pass: R5 built and compared, waiting for approval to switch (`docs/OONTU_MATCHING_BEFORE_AFTER.md`); R11 (client signals, corporate cards) and R12 done; R9 first version done (structure only, no group data); R10 done as a setting; R8 stays unbuilt on purpose. Kairo suggestions are logged. Sensitive steps already went through the Approvals engine or an explicit person-clicked modal before this pass; nothing in Kairo sends, submits or approves on its own.

Not recommended: a second matching module, new dashboards beside existing ones, any score built on photographs, accent, inferred personality or protected traits.
