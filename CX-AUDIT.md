# CX-AUDIT — Phase C0 (map the code; no feature changes)

_Brief: `docs/OONTU-COWORK-AGENTS-PROMPT.md`. Branch `o2/overnight-2026-11-26`, on top of tag `o2-audited` + the RX audit. Date: 2026-11-28._
_Line numbers are where the names sat when this audit was written. Wrap by name, not by line._

## Start gate

- **Earlier task.** The queued O2 audit and RX upgrade task is done.
  - Reports: `docs/O2-AUDIT-REPORT.md`, `docs/RX-REPORT.md`.
  - Progress page: `docs/o2-progress.html`.
  - Tags: `o2-audited`; `rx-g1`…`rx-g6`.
- **Baseline suite on 2026-11-28.**
  - Switches off: 1,310 / 1,311.
  - Every O2 and RX switch on: 1,312 / 1,313.
  - The single failure in both runs is `demo-data` › Vistaar "30 assignments, 8 approved weeks each". It is a date-dependent demo seed that started failing when the date turned to 28 November. It fails the same way on the code from before any O2 or RX work (`ea8919d`), so it is not a regression.
  - Logged in the CX decision log, and CX starts. K4 is the known flaky test in this brief; it did not fail.
- **A0–A9 / `AX_SWITCH`:** not found in the file. That earlier work was never built here. Nothing in CX depends on it.

## Where things live, what they do, how CX wraps them

| Area | Name (line) | What it does today | CX plan |
| --- | --- | --- | --- |
| Agent catalogue and pricing | `AGENT_CATALOG` (~41708) | Five agents with `price` (talent-discovery ₹4,999 / 5,000 actions; engagement, interviews, offers-joining ₹2,999; linkedin ₹1,999 per account, `addOnOnly`), `includedActions`, `steps`, `dailyCap` | Not edited. With CX on, every agent shows "Included". Plans show monthly credits and seats. The migration banner converts the old prices into credits (E2). |
| Agent steps and settings | `CA_ACTIONS` (~54772), `CA_DOES` (~54784), `CA_FIELDS` (~54787) | Steps per agent with autonomy level (auto / suggest / person) and settings per agent | `CX_STEP_MAP` moves every engagement / interviews / offers-joining step to its new owner. Read-time views add `outreach`, `delivery-guardian` and `revenue-redeploy`. The linkedin steps `visit` and `invite` become `person` tasks with CX on. The originals are kept. |
| Cowork engine | `CW` (~43075), `cwRunStep` (~43497), `cwLedger` / `SEND_LEDGER`, `cwSendEmail` / `cwSendWhatsapp` (~43428), `cwInWindow` / `cwNextWindow` (quiet hours), `cwSuppression` / `SUPPRESSION_LIST`, `cwHonestyCheck` (~49401), `CW_IDEM` (idempotency) | Engine clock `CW.clock`. Caps are `perPersonDay:1`, `perPersonWeek:3`, `logisticsPerInterview:4`, with `backoffMin`. Every message passes suppression, no-poach, exit rules, quiet hours, frequency caps, the per-agent daily cap, channel checks and approvals, and only then writes `SEND_LEDGER` | `cx-credits` wraps `cwLedger`. A row with `status:'sent'` charges a reservation; `blocked`, `failed` and other non-sent rows release it. `cwRunStep` is wrapped to reserve before a message. If no reservation is possible, the step pauses as "Paused: credits" and a task goes to the owner. The CX weekly cap of 2 across Outreach and LinkedIn Outreach is applied in the same place as the existing cap. |
| LinkedIn automation | `LI_SENDER_PROFILES` (~21444 uses), `LI_PLATFORM` (~44454: gologin token, proxy, warm-up, pacing, jitter, rotation), `liSendConnectionRequests` | Automated visit, invite and follow-up through GoLogin profiles and proxies | With CX on these are **not read and not shown**. The code stays. LinkedIn Outreach becomes the recruiter-assisted queue (`LI_TASKS`, `LI_CAPACITY`, `LI_OWNER`). |
| Campaigns | `CP_PLAYS` (~49255: apps, know, pool, ref, boards, li), Campaigns screen | Goal-driven campaign plays | The Simple Campaign Builder becomes the default under CX. It reuses `CP_PLAYS` for the audience. Workflow Studio is kept behind "Advanced". |
| Inbox | `inbox-script` (~63005). Lane A (LinkIt): personal email, WhatsApp **Web linked device**, LinkedIn. Lane B: Cloud API. `uniBoxThreadKey(c) = candidateId-workflowId` (~22456) | One inbox | With CX on, the thread key is `candidateId-jobId`; the old key stays readable. Agents never use the Lane A WhatsApp Web route; they use Lane B (simulated) plus click-to-chat `wa.me` for messages a person sends. |
| Matching | `computeJobMatchPct` (~14927), `computeJobFit` (~14940), `FIT_WEIGHTS` {required 60, preferred 15, experience 25}, `SKILL_ADJACENCY`, `MATCH_MODEL = 'skills'` | Skill overlap % (the default), or a detailed fit when `MATCH_MODEL` is `'detailed'` | Adds `MATCH_MODEL = 'evidence'` under CX: per-criterion evidence, a must-have gate, confidence and likelihood. The old functions are untouched. |
| JD and chat | `jdParseText` (~8899+), `kairoRespond` | Fills job fields from JD text and never invents anything; Kairo's rule-based intents | `cx-match` wraps intake into a versioned `JOB_CRITERIA[jobId]`. `cx-revenue-kairo` adds new intents and keeps the old ones. |
| AI adapter | `IQ_ADAPTER` (~58215) | Simulated respond adapter for the Intelligence workspace | Gets a sibling, `cxAI(tier, task, input)`: deterministic, rule-based, labelled simulated. Production notes cover routing. |
| Workflows | `wfRunTest`, plus G1's `rxEmit` / `rxRunWorkflow` / `wfPerform` (`rx-g1-script`) | Run Test, and live triggers when G1 is on | Workflow Studio and Campaigns call agents through the same credit path. |
| Earlier additions | O2 blocks `o2-*` (switches 0a–9). RX blocks `rx-g1`…`rx-g6` (G2 results, G3 money at risk, G4 redeploy, G5 own talent first, G6 self-booking) | — | Revenue & Redeploy wraps G3 (`RX_LEAK_RULES`) and G4 (`rxRedeploy*`) as its steps when present. The impact view reuses G2 (`rxResults`, `rxAttribute`). |

## Risks found

1. **WhatsApp Web linked device (Lane A).** Automating it breaks WhatsApp's terms for business messaging.
   - Under CX, agents never use it. Agents send through the Cloud API (simulated).
   - People send their own one-to-one messages with click-to-chat (`wa.me`).
2. **Sends outside the ledger.**
   - Two older paths count messages without `SEND_LEDGER`:
     - the RX G1 live runner (`wfPerform` counts WhatsApp on `WA_BUSINESS_ACCOUNT.messagesToday` and writes `RX.touches`);
     - the G5 database-first send (`rxDbFirstSend`).
   - The Run Test simulation counts, but does not send.
   - Under CX, every CX path goes through `cxReserve`. The G1 and G5 paths are wrapped to reserve and charge too. A test checks that no CX path sends without a reservation.
3. **LinkedIn automation stays in the file.** GoLogin, proxies, warm-up and rotation remain for the old behaviour.
   - With CX on, nothing reads them, and the queue offers no function that clicks or sends.
   - A search test proves this (C10).
4. **The existing frequency cap is 3 a week.** The brief wants 2 across Outreach and LinkedIn Outreach.
   - With CX on, those two agents use 2 a week.
   - Interviews and Delivery Guardian logistics keep their own caps.

## Decision log (C0)

- Phase commits on this branch (`o2/overnight-2026-11-26`), `cx: <phase> <summary>`, local only. The memory note says "jaydeep-changes", but every earlier task in this queue committed here, so CX follows the queue.
- The backup is at `recruitment-os-prototype.before-cx.html`.
- `demo-data` Vistaar is treated as a pre-existing, date-dependent failure, outside CX.
