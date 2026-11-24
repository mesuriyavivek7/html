# 09 · Sales, demos and sales-assisted customer onboarding

## 1. Existing code evidence

| Concern | Code | Status |
|---|---|---|
| Create tenant from Super Admin | `ctSheetHTML` / `ctSubmit` (line ~36,215) → `createInvitedTenant` (company, owner name, email, mobile, type, plan, note) → `authApi._createOwnerInvite` → owner link `GET/POST /invitations/owner/{token}` → `activateInvitedTenant` when the owner finishes setup | VERIFIED (prototype) |
| Owner invite acceptance | `sim.acceptOwnerInvite` (line ~28,685): account created verified, `setupPending`, tenant Invited → Active | VERIFIED (prototype) |
| Duplicate checks at creation | `account_exists`, `domain_taken` from `_createOwnerInvite` | VERIFIED (prototype) |
| Sign-up leads | `SIGNUP_LEADS`, call outcomes | Seeded samples only (live capture removed) |
| Demo data | `DEMO_COMPANIES` (Kesar, Northstar, Vistaar) in `demo-script`, Developer tools "Demo company", "Start from sign-up or Open with demo data" | VERIFIED (prototype) as a presenter tool |
| Plans offered | `PLATFORM_PLANS` active plans in the Create tenant sheet | VERIFIED (prototype) |
| CRM, demos, proposals, commercial approvals | — | MISSING |

## 2. Current implementation

Super Admin can create an invited tenant in one sheet; the owner gets a link, sets up and lands on the setup checklist. That covers steps 3–4, 6, 9 and 11 of the brief's 17-step flow, in simulation.

## 3. Limitations

- Not linked to a prospect or opportunity; no commercial arrangement beyond a plan id; no region or locale choice at creation (country defaults are applied later in setup); no onboarding plan, owner or hand-over; no customer or internal notifications beyond the owner email.
- Only Super Admin holds `platform-tenant.create`.
- It uses a different creation path from self sign-up (10).

## 4. Proposed solution

### 4.1 Sales CRM (platform-scoped, one record per company)
```
Prospect (company) { id, name, domains[], orgTypeGuess: agency|corporate|unknown, country, industry, size,
                     source: demo_request|inbound|referral|partner|manual|signup, ownerId, status }
Contact { id, prospectId, name, email, phone, role, consent }
Lead { id, prospectId, contactId, source, qualification: { budget?, authority?, need?, timing?, notes }, score?, status }
Opportunity { id, prospectId, stage: qualify|demo|proposal|negotiation|won|lost, amount, currency, planId,
              boosts[], term, ownerId, lostReason? , closeDate }
SalesActivity { id, prospectId, type: call|email|meeting|note|task, dueAt?, doneAt?, ownerId }
Proposal { id, opportunityId, version, lines[], discountPct, approvalId?, status, sentAt, acceptedAt }
```
- A self sign-up creates or updates the Prospect (by verified domain) with `source:'signup'`, so Sales sees product-led sign-ups in the same pipeline. This restores lead capture in a cleaner place than the removed sign-up lead (`docs/AUTH.md` §10).
- Discount above policy creates an APS `PlatformDiscount` approval.

### 4.2 Demos
```
Demo { id, opportunityId, playbook: agency|corporate|enterprise, presenterId, scheduledAt (UTC), timezone,
       attendees[], meetingLink, prepNotes, demoWorkspaceId?, status: requested|scheduled|done|no_show|cancelled,
       notes, questions[], objections[], outcome, followUps[] }
DemoWorkspace { id, template: kesar|northstar|vistaar|corporate_demo, tenantId, resetAt, expiresAt }
```
Demo workspaces are real tenants flagged `demo:true`, provisioned by the same engine from a template, resettable, never billable, auto-expired. The existing three demo companies become the first templates.

### 4.3 Sales-assisted onboarding (the 17 steps)

| # | Step | Implementation |
|---|---|---|
| 1–2 | Open a won opportunity → **Create customer workspace** | Button on the Opportunity (needs `platform-provisioning.create`, held by Sales) |
| 3–4 | Organisation type and details | Prefilled from the Prospect; verification starts (02 §5B) |
| 5 | Primary administrator | From Contacts |
| 6 | Plan and commercial arrangement | From the accepted Proposal; anything off-catalogue requires the approved `CustomEntitlement` |
| 7 | Region, country, locale, timezone, data region | Uses `COUNTRIES` defaults (currency, timezone, date format, data region, tax-id label, already wired at sign-up) |
| 8–12 | Provision, create workspace, apply defaults, owner invite, subscription/trial | **One call to the provisioning engine** (10) with `channel:'sales_assisted'` |
| 13–14 | Onboarding plan and owner | Template by type and size (11) |
| 15 | Notify customer and internal teams | Notification service; customer email is the owner invite |
| 16 | Track invitation and onboarding | Provisioning request status + onboarding milestones |
| 17 | Hand over to Customer Success | Milestone "Go-live" assigns the CS owner |

The existing Create tenant sheet becomes the "manual" entry of the same flow (no opportunity), kept for Super Admin.

## 5. Data impact

New platform tables above; `PLATFORM_TENANTS` records gain `customerAccountId` and `opportunityId`.

## 6. Permissions

Sales: create leads, opportunities, demos, proposals within pricing policy, provision from a won opportunity. Not allowed: suspend, delete, custom entitlements, discount over policy (approval).

## 7. Dependencies

Provisioning engine (10), Customer 360 (11), APS on the server, notification service (07).

## 8. Acceptance criteria

- From a won opportunity, a Sales user completes provisioning; the customer receives one owner invite; the tenant, subscription and onboarding plan exist exactly once, even if the button is pressed twice or the request is retried.
- Self sign-ups appear as Prospects with source "signup".
- A discount over policy blocks the proposal until approved.

## 9. Tests

End-to-end: lead → demo → proposal (approval) → won → provision → owner accepts → milestone hand-over. Idempotency: double submit, network retry, partial failure resume.

## 10. Migration risks

- Pricing is placeholder (project rule: Oontu edits it; do not present as final).
- Contact data is personal data of prospects: needs a lawful basis and retention policy (16).
