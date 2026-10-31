# Oontu — intelligence architecture

## Five kinds of output, kept apart in the UI

1. **Business rules**: deterministic checks (SLA, consent, approvals, skill overlap, notice/pay fit). Label: "rule".
2. **Statistics**: counts, averages, conversion from recorded events, always with sample size. Label: "from N records".
3. **Recommendations**: ranked suggestions with the evidence shown and a human action.
4. **ML predictions**: only when trained and validated on this tenant's (or pooled, consented) history, with a version, a calibration check and a fairness check. None exist today.
5. **Generative AI**: drafts only (messages, summaries); a person sends or approves.

A rule must never be presented as a trained prediction. Today's `joinProb`, `respProb` and `counterRisk` fields are category 1 at best (hand-set); the UI now says "indicative".

## Data foundation (first)

- Append-only `recruitment_events` table: tenant, entity, type, from/to stage, actor, reason, timestamp. In the prototype this would be an array written by `moveSubmissionStage` and the decision functions.
- Outcomes recorded on placements: joined, left within lock-in, reason.
- Normalised skills and a small adjacency map, versioned.

## Server side (when a backend exists)

PostgreSQL for events and features (tenant-scoped, row-level isolation); a worker queue for sweeps; a Python service only when a model is actually trained, with a tabular model (for example LightGBM, as Greenhouse documents for its own forecast) and a model registry. Add pgvector only if semantic search beats the skill match in a measured test. Nothing here requires replacing the current architecture.

## Gates before any prediction ships

Minimum history per tenant (set after measuring variance), holdout evaluation, calibration plot, group-wise error check, drift monitoring, per-prediction audit record, and a plain "why" with the top inputs. Below the minimum, show averages with counts instead.

## Kairo

Kairo should read the same events and rules, act with the signed-in user's permissions, and put sensitive steps (rejection, client submission, requisition approval, offer terms, permissions, vendor access) into the Approvals engine. It should log every suggestion and whether the user accepted it; that feedback is training data later.
