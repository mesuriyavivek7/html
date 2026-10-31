# Matching: skills match today vs detailed fit (R5, needs your approval to switch)

Computed on the seeded data: 37 candidates against 15 active jobs (555 pairs). Nothing was changed in the ranking; `MATCH_MODEL` is still `'skills'`.

## The two models

| | Skills match (in use) | Detailed fit (proposed) |
|---|---|---|
| Required skills | Share of the job's required skills the candidate lists, exact match | Same, but a near skill counts half (for example Kotlin for Java, Azure for AWS). 60 points |
| Preferred skills | Not counted | Share of preferred skills held. 15 points (the 15 go to required skills when a job lists none) |
| Experience | Not counted (shown as text only) | Against the job's minimum, scaled by the share of required skills held, so years in other skills do not help. 25 points |
| Location, notice, pay | Shown as text | Still shown as separate availability checks, never mixed into suitability |
| Protected traits, photo, name, accent | Not used | Not used |

## What would change (seeded data)

- Of 555 candidate-and-job pairs: **445 stay the same, 75 go down, 35 go up.**
- **Down:** a candidate with every required skill but missing a preferred skill or below the minimum experience, for example 100% to 85% for most Java matches. This is the intended effect: 100% should mean the whole brief, not only the required skills.
- **Up:** a candidate holding a near skill, for example Vikram Rao for Senior Java Developer, 50% to 58%.
- **Best job per candidate:** unchanged for all 37 candidates.
- Candidates who match every required skill on a job with no preferred skills and who meet the minimum stay at 100%.

## How to see it and how to switch

- Open any match explanation: it shows "Detailed fit (proposed)" with the points per part, beside the skills match.
- To switch every ranking, search and workflow rule to the detailed fit, set `MATCH_MODEL` to `'detailed'` in `recruitment-os-prototype.html`. It is one line, and `computeJobMatchPct` then returns the detailed fit everywhere.
- Switching changes every percentage the team sees, so it needs the owner's approval. Weights (60/15/25) and the near-skill list (`SKILL_ADJACENCY`) are starting values to review with a recruiter, not measured results.
