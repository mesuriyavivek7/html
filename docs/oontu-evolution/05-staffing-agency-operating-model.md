# 05 · Staffing agency operating model

## 1. Existing code evidence

| Concern | Code |
|---|---|
| Registration | `OA` create workspace, type "We hire for clients" → `Staffing agency`; agency setup steps `WORKSPACE_STEPS_AGENCY = ['agency-profile','agency-tools','agency-team','agency-marketplace','jobs-site','first-client','first-job']` (line ~31,221) |
| Clients and terms | `clients-script` (line ~47,412); `CLIENTS`; versioned commercial terms; tax engine (`clnTaxLine`, GST treatments `GST_TREATMENTS`, `GST_SAMPLE_REGISTRY`); Bill-from per client (`company-script`, `c.billFrom`); `CLIENT_FEEDBACK_SLA_DAYS`, `CLIENT_REJECT_REASONS` |
| Jobs | `JOBS`; creation steps `JOB_CREATE_STEPS`; JD reader (`jdParseText`); process stages `DEFAULT_JOB_WORKFLOW`; routing `JC_ROUTING` |
| Intake | `INTAKE_CONFIG`, `CENTRAL_INTAKE_QUEUE`, applicant owner by personal link and SLA (`m02-applicant-owner.spec`) |
| Talent pool and candidate | `CANDIDATES`, `talent-pool` screen, Prospects (`prospects-script`), candidate profile (`profile-script`, pf- module) |
| Journeys | `SUBMISSIONS` (one journey per candidate per job), `JOURNEY_STATUS_LABEL`, `JOURNEY_NEXT_ACTION`, owner history, duplicate window and same-job override (AR-5) |
| Submission rules | Review, consent links (48 h, at most 2 per 30 days), send to client (`m03-submission-rules.spec`, `m07-consent.spec`) |
| Client review and interviews | Secure links (`slValid`, `slExpire`), holds with 7-day check-back (`HOLD_CHECK_DAYS`), `interviews-script` |
| Offers, placements, money | One offer record (M1), fee frozen from the terms version, `PLACEMENTS`; `paytrack-script` (invoices, collections, credit notes, commission with sourcer/closer split, replacement window); `contracts-script` (bill rate = pay + markup, minimum margin approval, timesheets, conversions) |
| Team | Team members, Reports to, suspend with hand-over, `TEAMS`, `ROLE_TEMPLATES` |
| Kairo and agents | Cowork agents (`cowork-agents-script`), Campaigns as a journey to joining (`campaigns-script`), LinkIt, Inbox |
| Reporting | Revenue, Recruiter analytics (`RECRUITER_SCORE_RULES`), Reports, Intelligence answers |
| Marketplace listing | `agency-marketplace` setup step |
| Status | `docs/OONTU_AGENCY_READY_REPORT.md`: B1–B20 fixed, server rules listed in §5 |
| Tests | `agency-e2e`, `agency-shapes`, `submission-flow`, `intake-flow`, `clients`, `m01`…`m11`, `demo-data` |

## 2. Current implementation

The agency journey is the most complete part of Oontu. Client → terms → job → intake and sourcing → review → consent → send → client decision (link or email/WhatsApp reply read by Kairo, confirmed by a recruiter) → interviews → offer (fee frozen) → joining (one placement per journey) → invoice (sequence per agency and year) → collection → commission (payable after full payment and the window). Contract staffing adds work orders, rates, timesheets and conversion. **VERIFIED (prototype).**

One candidate can hold independent journeys on several jobs and clients (`SUBMISSIONS` keyed by candidate + job). Preserve this.

## 3. Limitations

1. **No business-development pipeline.** Prospects are candidates (`prospects-script`). A client exists only once it is created. There is no prospect company → opportunity → won client flow for the agency's own sales.
2. **Account manager scope** is a role template (`account`: own clients and their jobs). There is no client-team model (several AMs, a delivery lead).
3. **Client portal is link-based by design** (agency clients never log in, AR-3). Large clients may want a persistent view; today the answer is links plus, optionally, the "Client contacts sign in" setting.
4. **Agency as vendor to a corporate on Oontu** is not connected to the agency workspace (04 §3.2).
5. **Tax and compliance packs** are India-centred (GST, PAN). TDS for contract staffing is not set (`OONTU_AGENCY_READY_REPORT.md` §6 risk 4).
6. **Placement economics** are per placement; there is no client profitability report combining fees, credits, recruiter cost and time.

## 4. Proposed solution

- **Keep the engine and every rule.** Port in the order already written in `OONTU_AGENCY_READY_REPORT.md` §7 (foundation → team → clients and terms → jobs → candidates and intake → journeys → approvals → links and interviews → offers, joining, PayTrack → contracts → messaging → Cowork → reports).
- **Agency BD pipeline (P1):** reuse the Super Admin CRM model's shape (09) inside the tenant as `ClientProspect → ClientOpportunity → Client`, so "won" creates the client with its first terms version. No second client store.
- **Agency-as-vendor link (P1):** when a corporate on Oontu invites an agency whose verified domain matches an agency tenant, the relationship attaches to that tenant (04 §4.1). Vendor jobs appear in the agency's Jobs list tagged with the buyer; submissions go from the agency's talent pool through the buyer's consent and duplicate rules.
- **Client teams (P2):** `ClientTeam { clientId, members:[{userId, role: account_manager|delivery_lead|recruiter}] }` drives data scope instead of single-owner fields.
- **Country rule packs (P2):** move GST/PAN/TDS logic into versioned `TaxRulePack` data per country (the file already treats tax as rule packs, `CL_PACKS`). See 12.
- **Client profitability (P2):** a read model over placements, credit notes, commissions and recruiter time.

## 5. Data impact

New: `client_prospects`, `client_opportunities`, `client_teams`, `tax_rule_packs` (data, not code). Agency vendor link reuses `vendor_relationships`.

## 6. Permissions

Existing `PERMISSION_MODULES` stay. Add `clients.Prospect`, `clients.Opportunity`, `vendorwork.Submit` (agency side of a buyer relationship).

## 7. Dependencies

Core platform (07), domain model (14), vendor relationship (04), configuration (12).

## 8. Acceptance criteria

- Every agency spec passes against the API.
- A won client opportunity creates exactly one client with terms v1.
- An agency submits to a corporate buyer from its own talent pool, and the buyer's duplicate and consent rules apply.

## 9. Tests

Port the agency specs listed above. Add BD pipeline and agency-as-vendor end-to-end tests.

## 10. Migration risks

- The Vistaar demo builds 4,500 journeys through the real steps on each open (11–12 s). On a server, seed data must be generated once, not replayed per session.
- Invoice numbering must move to database sequences before any real invoice is issued (already a stated server rule).
