# 03 · Corporate operating model and onboarding

## 1. Existing code evidence

| Concern | Code |
|---|---|
| Corporate mode | `coCorp()` = `ORG_STRUCTURE.profile.orgType === 'Corporate'`; `filterNavForOrgType` |
| Setup checklist | `WORKSPACE_STEPS_CORPORATE = ['corp-setup','org-basics','corp-entities','corp-join','corp-careers','jobs-site','corp-vendors']` (line ~31,222); catalogue entries such as `'corp-join'` (line ~31,977); state in `wsSetup`, persisted per workspace (`WS_STORE_KEY`) |
| Company structure | `company-script` (prefix `cf`): `ORG_STRUCTURE.legalEntities` with tax registrations `regs[]`, invoice series, FY, region; units (branches, departments, cost centres); profiles Simple / Multi-location / Multi-company (`cfProfile`, `cfNeedsAsk`) |
| Salary bands | `ORG_STRUCTURE.profile.salaryBands`; `coBands()` defaults B1–B5 in LPA; `coBandOver`, `coBandCheck` |
| Requisitions | `CO.reqs`; `coReqFromSentence` (one-sentence request), `coReqValidate`, `coReqSubmit`, `coReqChain`, `coReqApproval` → `APPROVAL_REQUESTS` (entity `Requisition`), `coReqOpenJob`, `coReqClose`, `coReqFunnel`; screens `renderRequisitions`, `renderRequisitionNew`, `renderRequisitionDetail` |
| Hiring manager | `hm` persona screens (`hm-dashboard`, `hm-jobs`, `hm-job-create`, `hm-interviews`, `hm-feedback`, `hm-decisions`); HM review by link `coHmSend` / `coHmDecide` / `coHmReadReply` |
| Interviews and scorecards | `interviews-script`; interviewer secure links with scorecards hidden until submitted (`role-wise-workflow-matrix.md`) |
| Offers and joining | Shared offer record (M1 in `implementation-progress.md`), `OFFER_TRANSITIONS` |
| Contract hiring | Work orders `coWoCreate/Approve/Extend/Convert`, timesheets `coSheetSubmit/Decide`, invoices `coInvoiceBuild` |
| Careers and jobs site | `coSiteJobs`, `coSiteCompany`, `coSiteApply`; Oontu jobs website pages (`coJobsPage`) |
| Insights | `coInsights`, `coReqInsightsHTML`, `coVenInsightsHTML`, `coConInsightsHTML` ("rules over the records, with the rule stated") |
| Approved but missing here | One Job model (`corp-jobs-script`, approved 20 Nov 2026) exists only on `jaydeep-changes` |
| Tests | `corporate.spec.js` (20 checks on this branch), `company-setup.spec.js` (14), `approvals.spec.js` |

## 2. Current implementation

- **Setup:** seven steps. Each writes to the records the product uses: `corp-join` saves `profile.joinPolicy`; `corp-entities` and Company setup write `legalEntities` and bands; `corp-vendors` invites vendors into `CO.vendors`. The checklist is progressive ("finish later", Setup pill), and single-company tenants never see entity words (`cfProfile() === 'simple'`). **VERIFIED (prototype).**
- **Requisition flow:** a hiring manager or HR raises a requisition (one sentence is enough), validation checks band and budget, the chain is built, approvals are raised, and the final approval opens a job. **VERIFIED (prototype).**
- **Approval chain is hard-coded:**
  ```js
  function coReqChain(rq){
    const steps = [{ key:'ta', label:'TA Head', roleId:'role_founder' }];
    if(rq.budgeted === false || coBandOver(rq)) steps.push({ key:'fin', label:'Finance', roleId:'role_approver', ... });
    return steps;
  }
  ```
  This contradicts brief §5 ("do not hard-code the same approval hierarchy") and the approved presets (Simple / Guarded / Strict) recorded for the one-Job model.
- **Two models on two branches.** v2/main: Requisition and Job are separate records with a separate screen. jaydeep: one Job with an optional approval stage, HM "Ask HR for hiring support" requests, presets, hire types and the branch → country location model.

## 3. Limitations

1. **The approved corporate model is not on the main line.** This is the most important corporate gap: it changes the domain model (one record vs two).
2. The approval chain is fixed and keyed to role ids rather than to organisation structure (department head, cost-centre owner, country HR).
3. Departments exist in Company setup but do not drive permissions (no department-scoped roles or data scope).
4. Budgets are a boolean (`rq.budgeted`) plus band checks. There is no headcount plan or budget record.
5. Hire types beyond permanent and contract exist only on jaydeep.
6. No campus or high-volume model beyond Campaigns (agency-oriented).
7. Corporate reporting is computed from `CO.*` arrays in the browser (`coInsights`), not from canonical server records.

## 4. Proposed solution

**Step 1: settle one model (decision needed, recommendation: the approved one-Job model).**
Bring `corp-jobs-script` from `jaydeep-changes` onto the main line. One `Job` record per hire, with an optional `approval` stage. The requisition becomes the approval sub-record, not a sibling entity. This also matches how agency jobs work, so the recruitment engine stays single (06).

**Step 2: approval policy as data.**
```
ApprovalPolicy {
  appliesTo: job_open | offer | vendor_access | budget_exception
  preset: simple | guarded | strict | custom
  rules: [{ when: { overBand?, unbudgeted?, entityId?, departmentId?, country?, hireType?, payAbove? },
            steps: [{ approver: role | departmentHead | costCentreOwner | namedUser | hrPartnerFor(dept|branch|country),
                      sla, escalateTo, mode: any | all }] }]
}
```
Evaluated by the existing APS engine (`window.APS`: routing, SLAs, escalation, delegation), which stays the single approvals runtime. `coReqChain` becomes the default `guarded` preset, not code.

**Step 3: organisation structure drives scope.**
Departments, business units, branches and entities (already in `company-script`) get owners and become **data-scope dimensions** for roles: "Hiring manager: own department's jobs", "HR partner: jobs in India branches". This replaces persona-based scoping.

**Step 4: workforce plan and budget (P2, optional per tenant).**
`HeadcountPlan { period, entityId, departmentId, approvedHeadcount, budget, currency }`; jobs draw down against it. MSMEs never see it (Simple profile).

**Step 5: progressive onboarding stays.**
Keep the seven setup steps. Add, for Multi-company profiles only: approval preset choice, departments and HR partners, bands per entity and currency. Each step must write to the canonical record (already true; keep a test per step).

## 5. Data impact

- Merge `CO.reqs` into `Job.approval` (jaydeep already links `fromJob`/`jobId`; a one-time mapping, no data loss).
- New `approval_policies`, `headcount_plans` (P2). Departments and branches gain `ownerUserId`.

## 6. Permissions

`jobs.Create` is HR/TA by default; HMs get `hiring_requests.Create` (approved model). Approval decisions use `APS.guardDecision`. Pay visibility (`candidates.View Salary`, band override) is configurable per role, never hard-coded (approved).

## 7. Dependencies

05/06 for the shared engine, 12 for entity- and country-level configuration, 14 for the Job entity, APS port (P0).

## 8. Acceptance criteria

- A 10-person company opens a job with no approval and no entity words.
- A multi-country enterprise routes an over-band job in Germany to the German HR partner, then Finance, with SLA and escalation, configured without code.
- Changing the preset changes the next job's chain; jobs already in approval keep the chain they started with (versioned policy).
- Corporate reports read the same Job and Journey records as everything else.

## 9. Tests

Port `corporate.spec.js` and jaydeep's corp-jobs specs. Add policy tests: preset matrix, versioning, escalation, delegation (APS tests already cover the engine).

## 10. Migration risks

- **Branch divergence.** `jaydeep-changes` has many commits that are not on main, and merging it now will conflict (as the main ↔ v2 merge did). Port `corp-jobs-script` as a block rather than merging the whole branch.
- Specs that look for the Requisitions screen change when the screen goes. Keep a redirect from `requisitions` to Jobs, filtered to "Waiting for approval".
