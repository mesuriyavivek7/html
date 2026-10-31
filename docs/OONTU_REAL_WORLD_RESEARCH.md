# Oontu — real-world research

Only the six starting sources were read for this pass (fetched 2026-10-30). Competitor product claims (Ashby, Lever, Bullhorn, etc.) were NOT researched yet and are not stated here. Market evidence is separated from Oontu recommendations.

## 1. Documented evidence

| Source | Date on page | What it says (as stated) | Method / caveat |
|---|---|---|---|
| Greenhouse Recruiting Benchmarks | March 2026 | Applications per recruiter 1,610 (2022) to 4,890 (2025); applications per job 116 to 244; recruiters per organisation 10.43 to 4.62; monthly hires per recruiter 2.2 to 4.9; time-to-fill 43.64 to 59.67 | 6,000+ companies, 640M+ applications; full report gated; geography and units not stated on the page |
| Greenhouse, How offer forecast works | undated | Predicts offer acceptance and start date per job with LightGBM, trained on filled jobs; inputs include candidates per milestone, hiring-plan steps, job age, days since update, offer status, average hiring speed | Greenhouse itself says forecasts can't be fully explained and no single input moves them much |
| SHRM, validating AI hiring tools | 7 Jul 2026 | Validate against later job outcomes; check content and construct; check fairness across groups; a human making the final call does not remove liability when AI ranks and filters | Opinion/guidance article |
| SHRM, human-centred AI sourcing (India) | 5 Jun 2026 | Plan human review points; check training data fits India; disclose AI use to candidates; treat output as ranked recommendations; run quarterly bias audits | Guidance article |
| Deloitte India, Campus Workforce Trends 2026 | 27 Aug 2026 | 86% of organisations say AI is transforming hiring; 72% use AI for resume screening; 48% AI assessments | 257 organisations, 505 campuses; the release gives two different attrition figures, so that statistic is not used |
| LinkedIn, Future of Talent | not dated (survey fielded June 2026) | 771 HR/TA leaders (US 200, UK 131, France 125, Germany 129, India 126, Australia 60); 81% say winning organisations start from business outcomes; verified skills expected to gain trust | Published by a vendor that sells recruiting products |

## 2. What this means for Oontu (our reasoning, not market fact)

1. **Recruiters are handling far more applications each.** Greenhouse's figures point to screening load as the pressure. Oontu already scores skill overlap; the explanation and rule-based fit checks (done in this pass) help the recruiter read faster.
2. **Forecasting is trained, and even then only partly explainable.** Greenhouse trains on filled-job history. Oontu has no such history in the prototype, so any forecast must wait for real outcome data (see the intelligence architecture).
3. **Ranking is a selection decision.** SHRM says a human sign-off does not remove exposure. So every Oontu score needs its basis shown, a fairness check, and no protected attributes.
4. **Disclosure and human review points.** Oontu should say when AI drafted or ranked something. Kairo already routes sensitive actions to approvals.

## 3. Still to research (not yet done)

Greenhouse, Lever, Ashby, SmartRecruiters, Workday, iCIMS, Bullhorn, Avature, Eightfold, Beamery and LinkedIn Talent Solutions: documented capabilities, reporting and integrations. No competitor feature is claimed here.
