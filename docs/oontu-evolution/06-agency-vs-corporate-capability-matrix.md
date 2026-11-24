# 06 · Agency vs corporate capability matrix

## 1. Existing code evidence

Type gating today: `coCorp()`, `filterNavForOrgType` (line ~4,389), `AGENCY_NAV_LAYOUT`, corporate labels (`O_STAGE_LABEL_CORP`, `LINEUP_CANON_STAGES_CORP`, `JOB_STAGE_TIPS_CORP`), corporate seed only in corporate workspaces (`coSeedCorp`: "an agency workspace never sees any of it"). Plan gating: `NAV_PLAN_GATES`, `navPlanLocked`, `ENTITLEMENT_CATALOG`, `TENANT_FEATURE_FLAGS`, `agentAccess`. Permissions: `PERMISSION_MODULES`, `canI`, `sCan`.

## 2. Current implementation

Type is used for three different jobs at once: product mode (which workflows exist), terminology (client vs department, "submission" vs "candidate sent to HM"), and visibility (nav filtering). Plans and permissions are separate mechanisms layered on top.

## 3. Matrix

Legend for **Class**: 1 shared domain · 2 agency-specific · 3 corporate-specific · 4 external vendor · 5 shared with configurable policy · 6 shared with configurable terminology · 7 permission-controlled · 8 subscription-controlled. Most capabilities carry several classes.

| Capability | Class | Agency | Corporate | Vendor | Evidence | Status |
|---|---|---|---|---|---|---|
| Identity, sign-in, memberships | 1, 7 | ✓ | ✓ | ✓ (own) | `createAuthSimulator`, `coVendorLogin` | SIMULATED |
| Workspace setup checklist | 5 | 7 steps | 7 steps | 2 steps | `WORKSPACE_STEPS_*`, `coOnboardStep` | VERIFIED (prototype) |
| Company structure (entities, units, departments) | 5, 6 | ✓ | ✓ | — | `company-script` | VERIFIED (prototype) |
| Roles and permissions | 1, 7 | ✓ | ✓ | own set | `CUSTOM_ROLES`, `PERMISSION_MODULES` | VERIFIED (prototype) |
| Jobs | 1, 5, 6 | client jobs | own jobs + approval | shared view | `JOBS`, `corp-jobs-script` (jaydeep) | PARTIAL (two corporate models) |
| Job approval | 5, 7 | optional (`JOB_APPROVAL_POLICY`) | presets | — | `coReqChain` (hard-coded) | PARTIAL |
| Hiring requests from HMs | 3 | — | ✓ | — | jaydeep only | MISSING here |
| Candidates and talent pool | 1, 7 | ✓ | ✓ | own pool (if agency tenant) | `CANDIDATES` | VERIFIED (prototype) |
| Journeys / submissions | 1, 6 | submission to client | candidate to HM | vendor submission | `SUBMISSIONS`, `coVendorSubmit` | VERIFIED (prototype) |
| Duplicate and ownership rules | 5 | duplicate window, same-job override | identity engine, vendor window | told minimally | `coIdentityMatch`, AR-5 | VERIFIED (prototype) |
| Consent | 1, 5 | ✓ | ✓ | via apply link | `m07-consent`, `coConsent*` | VERIFIED (prototype) |
| Interviews and scorecards | 1, 5 | client interviews | internal panels | own candidates | `interviews-script`, `coVendorInterviews` | VERIFIED (prototype) |
| Offers and joining | 1, 5 | fee frozen from terms | approval for exceptions | status only | M1 offer record | VERIFIED (prototype) |
| Approvals engine | 1, 5, 7 | ✓ | ✓ | — | `APS` | VERIFIED (prototype) |
| Clients and commercial terms | 2 | ✓ | — | — | `clients-script` | VERIFIED (prototype) |
| PayTrack (invoices, commission) | 2, 7, 8 | ✓ | — | — | `paytrack-script` | VERIFIED (prototype) |
| Contract staffing (agency side) | 2, 8 | ✓ | — | — | `contracts-script`, Boost "Contract Desk" | VERIFIED (prototype) |
| Contract hiring (buyer side) | 3, 8 | — | ✓ | timesheets | `renderContractHiring`, `coWo*` | VERIFIED (prototype) |
| Vendor management | 3 | — | ✓ | — | `renderVendors` | VERIFIED (prototype) |
| Vendor portal | 4 | — | — | ✓ | `#/vendor` | VERIFIED (prototype), no isolation |
| Marketplace | 2 (listing), 3 (discovery), 8 | list | discover | — | `agency-marketplace`, `coMarketRank` | PARTIAL |
| Careers page and Oontu jobs website | 5, 8 | ✓ | ✓ | — | `coSite*`, `jobs-site` | PARTIAL |
| Campaigns and Cowork agents | 1, 5, 8 | ✓ | ✓ (corp plans) | — | `AGENT_CATALOG.corpPlans`, `campaigns-script` | SIMULATED execution |
| Intelligence | 1, 6, 7, 8 | revenue, recruiters, clients | spend, departments, vendors | — | `iqPlan*` | SIMULATED (rules, no model) |
| LinkIt, WhatsApp, Inbox | 1, 8 | ✓ | ✓ | — | `inbox-script`, Boosts | SIMULATED channels |
| Reports and analytics | 1, 6, 7 | ✓ | ✓ | own stats | Reports, `coInsights` | PARTIAL (browser-computed) |
| Hiring manager workspace | 3 (agency: optional setting) | link | login | — | `hm-*` | VERIFIED (prototype) |
| Employee portal / referrals | 3 | — | planned | — | not built | MISSING |

## 4. Limitations

- Workspace type is the dominant switch. A corporate that also runs a small internal staffing arm, or an agency that hires for itself, cannot mix capabilities.
- Terminology is hard-coded in label maps (`*_CORP` constants), not a terminology layer.

## 5. Proposed solution

Replace the single switch with three explicit layers, evaluated in order:

1. **Capability set of the tenant** (from organisation type defaults + plan entitlements + feature controls). Example: `clients`, `paytrack`, `vendor_management`, `vendor_portal_access`, `hiring_requests`.
2. **Policy** per capability (approval presets, duplicate rules, vendor policy, consent rules), versioned per tenant.
3. **Permission** per user (role, data scope).

`orgType` stays as the **default bundle**, not as a gate. A terminology map per capability (`client` ↔ `hiring department`, `submission` ↔ `candidate to HM`) replaces scattered `*_CORP` labels, with the existing labels as its first values.

## 6. Data impact

`tenant_capabilities` (derived, cached), `terminology_maps` (configuration). No change to recruitment records.

## 7. Permissions

Capability check → policy → permission, all server-side. The nav and route manifest (01) read the same three layers.

## 8. Dependencies

07 (entitlements, feature controls), 12 (configuration), 01 (route manifest).

## 9. Acceptance criteria

- Turning on `vendor_management` for an agency tenant shows Vendors without changing its type.
- Every corporate-only label comes from the terminology map.
- No server endpoint checks `orgType` directly; it checks a capability.

## 10. Tests

A matrix test: each capability × {agency default, corporate default, custom bundle} × {permitted, not permitted}.

## 11. Migration risks

- `coCorp()` and `filterNavForOrgType` are called widely. Replace them with a capability helper that, at first, derives capabilities from `orgType`, so behaviour is unchanged on day one.
