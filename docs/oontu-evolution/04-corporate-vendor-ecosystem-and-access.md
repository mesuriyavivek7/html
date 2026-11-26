# 04 · Corporate vendor ecosystem and access

## 1. Existing code evidence (`corp-script`, line ~50,883 onward)

| Concern | Functions / data |
|---|---|
| Store | `CO = { vendors, market, assigns, vsubs, invites, accounts, jobReqs, dupAttempts, idNotSame, vlinks, contracts, sheets, invoices, fees, rateCards, ... }` |
| Vendor account (Oontu-wide identity) | `CO.accounts`: one per email across Oontu, `orgs[]` = companies it works with; status ACTIVE / DORMANT / SUSPENDED / DISABLED. `coAccountCreate`, `coAccountLink`, `coOtherOrgs` returns **a count, never names** |
| Membership per company | `CO.vendors[i]`: `status` Invited / Active / Paused…, `feePct`, `termsAt`, `accountId` |
| Invitation | `coInviteIssue/Deliver/Resend/Revoke/Accept`, hashed token (`coHash`, `coSecret`), states PENDING / ACCEPTED / EXPIRED (derived) / REVOKED / DELIVERY_FAILED; `#/vendor/invite/<token>` changes nothing until Accept |
| Onboarding | `coOnboarding` derived from account details (contact, phone, GSTIN format check) + per-company `termsAt`; `coVendorSaveDetails`, `coVendorAcceptTerms`, `coOnboardRemind` |
| Lifecycle | `coVendorLife` (one label + one action), dormancy sweep `coDormancySweep` (setting `hiring.vendorDormantDays`), reactivation by code (`coReactivateCode/Confirm`), restore (`coVendorRestore`), approvals entity `VendorLifecycle` |
| Job access | Assignments `coAssign`, `coAssignRevoke`, `coAssignExtend`, `coAssignBlock`, `coAssignState`; vendor ranking `coJobVendorRank` |
| Vendor asks for a job | `coVendorRequestJob` → `CO.jobReqs` + `APPROVAL_REQUESTS` (`VendorJobRequest`) to the job's POC; `coVendorJobDecide` |
| Submission | `coVendorSubmit`, consent (`coConsentGive/State/Lapse`), submission links `#/apply/<token>` (`coVLinkCreate/Submit`), withdraw/resubmit with reason (`coVendorWithdrawWhy`, `coVendorResubmit`) |
| Duplicates and ownership | Identity engine `coIdentityMatch` / `coIdScore` / `coIdIndex` (confirmed / probable / different, with evidence); exact match blocks (`coSame`); company decides `coDupOverride` (reason, moves credit, `sub.ownership` history), `coDupDismiss`, `coDupAllow`; window `coMonths()` = setting `hiring.vendorWindow`, default **6 months** |
| What a vendor is told | `coDupMsg`: only "This profile was already uploaded on <date time>." plus a verification date (company timezone `coTz`) |
| Vendor view of status | `coE6` derived outsider status list (Applied … Rejected / Withdrawn) |
| Interviews | `coVendorInterviews`: own candidates only |
| Marketplace | `coMarketRank`, `coMarketReveal` with a monthly reveal cap (`careers.vendors.reveals`, default 5) |
| Performance | `coVendorStats`, `coVendorRecs`; scorecard `cjScore` on jaydeep only |
| Tests | `corporate.spec.js` |

## 2. Current implementation against the 12-step journey

| Step | Status |
|---|---|
| 1. Create and approve requisition | VERIFIED (prototype), hard-coded chain (03) |
| 2. Assign to internal or vendor channels | VERIFIED (prototype): `coAssign`; approved default is publish to all empanelled vendors (jaydeep) |
| 3. Invite or discover a vendor | Invite VERIFIED; marketplace discovery PARTIALLY IMPLEMENTED (ranking + reveal cap, no verification of listings) |
| 4. Vendor accepts | VERIFIED (prototype) |
| 5. Verification and documents | PARTIALLY IMPLEMENTED: GSTIN format check, terms acceptance; no document upload, no agreement versioning, no real verification |
| 6. Grant access to specific jobs | VERIFIED (prototype): assignments with expiry and revoke |
| 7. Submit eligible candidates | VERIFIED (prototype), with consent and duplicate engine |
| 8. Evaluate alongside internal pipeline | VERIFIED (prototype): vendor submissions become journeys with `sub.source`/`sub.vendorRef` |
| 9. Feedback flows back | PARTIALLY IMPLEMENTED: derived status (`coE6`) only; no structured feedback share policy |
| 10. Interviews coordinated | VERIFIED (prototype): own-candidate interview list |
| 11. Offer and joining under corporate authority | VERIFIED (prototype) via shared offer record |
| 12. Performance and commercial outcome | PARTIALLY IMPLEMENTED: stats; fees (`CO.fees`) and invoices for contract work; scorecard only on jaydeep |

## 3. Limitations

1. **No isolation.** The vendor portal runs in the same page and memory as the corporate workspace (`CO.*`). "Vendor sees only their own" is enforced by filter functions, not by a boundary. This is the critical production gap.
2. **The vendor account is a corporate-module record.** `CO.accounts` lives inside the corporate tenant's script. A staffing agency that is also an Oontu agency tenant has two unrelated identities (its agency workspace and its vendor account), so it cannot bring its own talent pool into vendor work.
3. **Commercial terms are a single `feePct` per vendor** plus acceptance time. No agreement versions, rate cards per job family, replacement terms or invoice workflow for permanent placements.
4. **Feedback sharing is implicit.** There is no per-company policy on what feedback a vendor sees.
5. **The ownership window is a business decision still open:** the code uses 6 months; the identity-engine spec assumed 90 days (flagged in project notes).

## 4. Proposed solution

### 4.1 Two organisations, one relationship
```
VendorRelationship {
  id, buyerOrgId, vendorOrgId,             // two tenants, never merged
  status: invited | onboarding | active | suspended | ended,
  agreementVersionId, complianceStatus,
  createdBy, history[]
}
VendorAgreement { id, relationshipId, version, feeModel: pct|flat|rate_card, feePct?, replacementDays,
                  paymentTerms, ownershipWindowDays, acceptedBy, acceptedAt, documentRefs[] }
JobVendorAccess { jobId, relationshipId, grantedBy, grantedAt, expiresAt?, submissionLimit?, revokedAt? }
VendorSubmission { id, jobId, relationshipId, candidateRef, submittedByVendorUserId, consentId, ownership{...}, status }
```
- The **vendor organisation** is a tenant of its own. It is either a full agency tenant (an existing Oontu agency workspace, which keeps its talent pool, team and PayTrack) or a **vendor-only organisation** (lightweight, free per the pricing line: "vendors are always free").
- `CO.accounts` maps to vendor-org **users**; `CO.vendors` maps to `VendorRelationship`; `CO.assigns` maps to `JobVendorAccess`; `vsubs` maps to `VendorSubmission`. The names change; the rules port as they are.

### 4.2 Record ownership
| Record | Owner | Vendor can see |
|---|---|---|
| Job, approval, internal notes, other vendors' submissions | Buyer | Shared job fields (title, JD, location, band if the buyer allows, POCs) |
| VendorSubmission and its status | Buyer (decision) and vendor (its copy) | Own submissions, derived status (`coE6`), feedback per policy |
| Candidate master in the vendor's talent pool | Vendor | Everything (it is theirs) |
| Candidate journey in the buyer's tenant | Buyer | Status per policy, never internal scores |
| Commercial agreement, invoices | Shared by relationship | Its own |

Candidate data crosses the boundary only as a **submission with a consent record**. The buyer gets a copy under its own retention policy; the vendor keeps its master.

### 4.3 Configurable, auditable policy (no universal legal rule)
```
VendorPolicy (per buyer, versioned) {
  publishDefault: all_active | selected          // approved default: all_active
  ownershipWindowDays                            // decision pending: 180 today vs 90
  duplicateRule: first_valid_submission | first_consent | buyer_decides
  vendorDupMessage: minimal                      // today's coDupMsg wording
  feedbackShare: status_only | reasons | full_notes
  submissionLimitPerJob?, compliance: { documents:[...], renewEveryDays }
}
```
Duplicate decisions stay with the buyer (`coDupOverride` / `coDupDismiss` / `coDupAllow`, reason required, ownership history kept).

### 4.4 Access enforcement
Every vendor API call resolves: vendor user → vendor org → active relationship with the buyer → active `JobVendorAccess` for the job. PostgreSQL row-level security on `vendor_submissions` by `relationship_id`. Buyer-internal tables are never readable from a vendor session.

## 5. Data impact

New tables above; one-time mapping from `CO.*`. A vendor that is already an agency tenant links its existing org instead of creating a vendor-only org (dedupe by verified domain or tax id).

## 6. Permissions

Buyer: `vendors.Invite`, `vendors.Approve`, `vendors.Suspend`, `vendors.Terms`, `jobs.ShareWithVendors`, `submissions.DecideDuplicate`. Vendor org: `vendor.jobs.View`, `vendor.submissions.Create`, `vendor.submissions.Withdraw`, `vendor.team.Manage`. Platform: none by default (Oontu staff never see either side's candidates without support access, 16).

## 7. Dependencies

Tenancy (07), provisioning of vendor-only orgs through the same engine (10), consent and retention (12, 16), events for status fan-out (14).

## 8. Acceptance criteria

- One agency serves three corporates from its own workspace; each corporate sees only that agency's submissions to its own jobs.
- Revoking `JobVendorAccess` stops new submissions at once; existing submissions stay with their history.
- A vendor can never enumerate other vendors, internal notes or the buyer's talent pool. Proven by API tests, not screens.
- Changing the ownership window affects only submissions made after the policy version changes.

## 9. Tests

Port `corporate.spec.js` vendor sections. Add cross-tenant API tests (vendor A vs vendor B, vendor vs buyer internals), the policy matrix, and suspension/revocation.

## 10. Migration risks

- The prototype's `coOtherOrgs` count is the only cross-company signal today; real cross-org identity needs a privacy review (whether a buyer may know a vendor works with competitors; today: count only, keep that).
- The ownership window default needs your decision before it reaches real customers.
