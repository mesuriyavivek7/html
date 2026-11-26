# 13 · Kairo, Intelligence and the agent workforce

## 1. Existing code evidence

| Concern | Code | Reality |
|---|---|---|
| Kairo chat | `kairoRespond(rawText)` (line ~5,036), `kairoChatMessages`, `KAIRO_VIEW_INTENTS` | Intent matching on text, navigates or answers from workspace data |
| Intelligence workspace | `intelligence-script` (line ~57,615); `IQ_ADAPTER` (line ~57,728) with `respond(request, ctx, sink)` streaming contract; `iqPlan` routes intents to `iqPlanRevenue`, `iqPlanRecruiters`, `iqPlanGrowth`, `iqPlanClients`, `iqPlanBottlenecks`, `iqPlanSpend`, `iqPlanDepartments`, `iqPlanVendors`, `iqPlanApprovals`, `iqPlanConfig`, `iqPlanAttachment`, `iqPlanLookup`, and more | **Deterministic rules** over in-memory records. `IQ_ADAPTER.name = 'prototype'`. Every answer is labelled `IQ_NOTE = 'Illustrative…'` |
| Access to Intelligence | `iq-access-script`, `IQ_ACCESS`, `IQ_PERMS`: on for all roles, Owner/Admin can lock per role | VERIFIED (prototype), `intelligence-access.spec.js` |
| Permission-aware answers | `iqPlan*` check permissions (recruiter gets no revenue) | VERIFIED (prototype), `intelligence-roles.spec.js` |
| Live configuration | `iqCfgApply` → `iqLiveRun`: proposal first, then applies departments, heads, presets "in this browser's memory" | SIMULATED, honest about it |
| Model providers | `PLATFORM_AI` (line ~42,415): providers and masked keys; "Key management is simulated in this prototype" | SIMULATED |
| Agent workforce (Cowork) | `cowork-script`, `cowork-agents-script`, `AGENT_CATALOG` (line ~41,150), `AI_EMPLOYEES`, `cwEngineTick` (line ~43,052); autonomy per step with `level==='person'` locked ("Always a person. Kairo never does this on its own.", line ~42,323); kill switch; weekly caps; quiet hours; suppression; no-poach; send ledger; disclosure line `CW_DISCLOSURE` | Rules and ledger VERIFIED (prototype); execution SIMULATED (browser ticks, no real sends) |
| Campaigns | `campaigns-script`: journey to joining day, `cpJourneyTick`, offer never auto, person confirms joining | VERIFIED (prototype), SIMULATED execution |
| Activity history | one record per agent action; recruiter feed limited to own jobs (server rule listed in agency report) | PARTIAL |
| Subscriptions | `agentAccess(agentId, userId)`, `TENANT_AGENT_SUBSCRIPTIONS`, `PLATFORM_ADDON_LEDGER` | VERIFIED (prototype) |
| Existing architecture note | `docs/OONTU_INTELLIGENCE_ARCHITECTURE.md`: five output kinds kept apart, data foundation first, gates before predictions | Keep |

## 2. Current implementation

The identity and the governance shape are right: one named intelligence (Kairo), "no AI wording" for customers (project decision), permission-aware answers, illustrative labels, autonomy levels with person-only steps, a send ledger and a kill switch. What does not exist: a model call, retrieval, organisation memory, provenance beyond "built from this workspace's records", evaluation, or server-side execution.

## 3. Limitations

1. No model integration (do not claim one).
2. Answers are computed from the whole in-memory data set, filtered by role in code; a real system must retrieve only what the user may see.
3. No organisation memory: policies are re-read from settings each time, which is right, but documents, playbooks and past decisions are not a knowledge source.
4. Agent actions are not durable jobs; there is no retry, recovery or idempotency.
5. No evaluation harness.

## 4. Proposed solution

### 4.1 Separation of truth and reasoning
```
Deterministic layer (source of truth)          Reasoning layer (Kairo)
records, rules, permissions, policies   ──►     reads through tools that call the same
APS approvals, ledgers, audit                   permission-checked APIs as a person
                                        ◄──     proposes actions as Action Requests
                                                (never writes records directly)
```

### 4.2 Components
- **Kairo gateway:** implements `IQ_ADAPTER.respond(request, ctx, sink)` server-side (keep the contract: status steps, streamed blocks, sources, follow-ups). The prototype adapter stays as the offline and test adapter.
- **Context builder:** user, membership, tenant capability set, current screen, permitted entity ids. Never a raw table dump.
- **Tools:** typed functions over tenant APIs (`searchCandidates`, `getJobFunnel`, `draftMessage`, `proposeConfigChange`…), each declaring the permission it needs. The model cannot see a tool the user lacks.
- **Organisation knowledge:** `KnowledgeSource { tenantId, type: policy|playbook|document|faq, scope, acl, version }`, chunked and embedded per tenant, retrieved with the user's ACL. Policies come from configuration (deterministic), not from embeddings.
- **Provenance:** every answer lists the records and sources used (`sources` already exists in the sink contract).
- **Action requests:** `AgentAction { id, agentId, tenantId, actorUserId (on whose behalf), type, payload, autonomyLevel, approvalId?, status: proposed|approved|executing|done|failed|reverted, idempotencyKey, result, undo? }`. Autonomy per step uses today's levels (auto / ask / person), with person-only steps locked platform-wide (offer, hiring decision, anything legally consequential).
- **Execution:** durable jobs on the event/job service (07) with retries and dead-letter queue; sends go through the notification service and the send ledger (existing rules: caps, quiet hours, suppression, disclosure line).
- **Governance:** per-tenant usage metering (counts against `includedActions`), platform kill switch per agent (exists), tenant pause-all (exists), audit of every action with its prompt-hash and model version.
- **Evaluation:** offline test sets per intent (the `iqPlan*` outputs become the first golden answers for factual questions), red-team prompts for permission leaks, and human review sampling for agent sends.
- **Internal use (P2):** the same gateway serves Super Admin (sales prep from Customer 360, ticket summarisation, health explanations), with platform-scope tools only.

### 4.3 What stays human
Hiring decisions, offers, rejections at final stages, commercial exceptions, permission changes and tenant lifecycle changes. Kairo may draft and recommend; a person decides. This matches the existing person-only steps and the brief.

## 5. Data impact

`agent_actions`, `knowledge_sources`, `knowledge_chunks` (per tenant, in-region), `kairo_conversations` (today in localStorage per workspace, role and org type), `usage_events`.

## 6. Permissions

Tools inherit the user's permissions; agents act "on behalf of" a user or as a tenant service identity with an explicit permission set; platform agents have platform permissions only.

## 7. Dependencies

07 (jobs, notifications, audit), 14 (events), 16 (residency of embeddings, processor agreements with model providers).

## 8. Acceptance criteria

- A recruiter asking for revenue gets a permission refusal from the tool layer, not just a filtered answer.
- Every Kairo answer shows its sources; every agent action has an audit row with on-whose-behalf, autonomy level and approval.
- Killing an agent at platform level stops queued actions within one job cycle.
- With the model provider down, Kairo degrades to the deterministic answers (today's `iqPlan*`) with a clear notice.

## 9. Tests

Port `intelligence*.spec.js`, `cowork*.spec.js`, `campaigns.spec.js`. Add permission-leak evals, idempotent retries, undo/revert, kill-switch latency.

## 10. Migration risks

- Model providers are data processors: contracts and regional hosting before any candidate data is sent.
- Keep the customer-facing "no AI wording" rule in prompts and outputs.
