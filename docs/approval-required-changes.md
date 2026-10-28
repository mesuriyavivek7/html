# Changes that need your approval

Nothing in this file has been built. Each item changes a process, a data model or an earlier decision.

## AR-1 · Sign-up: bring back request-to-join, saved steps and assisted setup

- **Current:** On 2026-10-26 you asked to port the new sign-in/create-workspace design exactly and to remove three things: saving a half-finished sign-up step by step, Super Admin assisted setup, and "request to join" for a company domain that already has a workspace. Today a second person from the same domain is told to ask the owner for an invite.
- **Flow map v5 (00, 01):** wants all three back: every step saved at once, "Request to join that workspace · its owner approves", and assisted setup with the customer's permission.
- **Why it matters:** without saved steps, people who stop before the email code are invisible to the follow-up list (01), which is where the map recovers lost sign-ups.
- **Options:** (a) follow v5: add the three back inside the OA screens, without changing their look; (b) keep the current behaviour and update the map; (c) only add saved steps (the biggest recovery gain) now.
- **Recommendation:** (a). Risk: touches the auth module (75 auth checks guard it). Effort: medium.

## AR-2 · Build the corporate journey and contract hiring

- **Current:** corporate workspaces have settings for requisition approvals, vendor caps, consent and ownership windows and internal-first days, but no workflow uses them. There are no requisitions, vendors, vendor links, marketplace, jobs website, rate cards, work orders or timesheets.
- **Map:** C3, C4, C5, C6, C7, C10, E7, E8.
- **Proposed order (each is usable on its own):**
  1. C3 Requisitions → approval matrix (E2) → job opens (corporate jobs then exist as data).
  2. C5 Vendors (email + basic info) and C4 "pick vendors on publish".
  3. C7 Vendor submissions: authorised link with one-time code, email-to-HR intake, caps, candidate consent in 48 h, dedupe through E3, vendor status view.
  4. C8 HM review link and email-reply decisions; C9 e-sign stub, vendor-fee and referral-bonus clocks.
  5. C10 + E8 contract hiring: rate cards, work orders, weekly timesheets (WhatsApp/web link), invoices only from approved time, extensions, conversion. Shared by agencies (employer of record).
  6. C6 Marketplace and E7 Oontu jobs website (both gated by "Unverified company").
- **Impact:** new data stores and screens; existing agency flows untouched. Sidebar gets Requisitions and Vendors for corporate roles.
- **Recommendation:** approve the order; I build and test one step at a time, like this pass.

## AR-3 · Hiring Manager login in an agency workspace

- **Current:** the `hm` role ("Suresh Iyer · RetailX · Hiring") logs in to an agency workspace and reviews candidates.
- **Map:** agency client contacts never log in; they answer by email, WhatsApp or a review link (A7, A8). Hiring Managers are corporate users (C2, C8).
- **Options:** (a) keep `hm` only for corporate workspaces and route agency client review to the secure client link (already built); (b) keep both.
- **Recommendation:** (a).

## AR-4 · One candidate status list (E6)

- **Current:** submission stages are `Pending Review`, `Ready to Send`, `Submitted`, `Interview Scheduled`, `Feedback Given`, `Offer Pending Approval`, `Offer Extended`, `Offer Accepted`, `Joined`, `Withdrawn`, `Rejected`, plus campaign states.
- **Map:** Applied, Sourced, In review, Not suitable, Not interested, Ready, Pending approval, Submitted, Returned, Internal reject, Client rejected, On hold, Shortlisted, Interviewing, Stage rejected, Selected, Offer extended, Offer accepted, Offer declined, Joined, Backed out, Withdrawn; corporate renames two.
- **Proposal:** add an E6 status field derived from the current stage plus the missing states, keep the old stage names as display labels, and move reports to E6. Data migration: computed, no loss.
- **Recommendation:** approve; medium effort, touches many screens.

## AR-5 · Manager override for a same-job duplicate goes through the Approvals engine

- **Proposal (Step 7, ready to build):** "Request a manager override" creates an approval of a new kind, Submission override, routed by the reporting line with the owner as fallback. When approved, the requester may submit once and the earlier owner is told.
- **Why approval:** adds a new kind to the approvals engine you supplied (I add it through its public API, not by editing the engine).
