# 35 · Business OS: research and decisions

Research done on 25 Nov 2026. Each item says what kind of claim it is: official source, secondary source, or engineering judgement.

## 1. Payment provider for a SaaS company operating from India and selling worldwide

| Option | Findings | Fit |
|---|---|---|
| **Stripe** | Invite-only in India since May 2024 (Stripe docs and the India FAQ). Indian businesses can't sign up on the website; they must request an invitation. Existing accounts are unaffected. Stripe had said it wanted to support more Indian users by H2 2025, but its docs still say invite-only. | Use only if an invitation is granted. Strong subscription and webhook tooling. |
| **Razorpay** | Indian payment aggregator. Webhooks are signed with HMAC-SHA256 of the **raw** body using a separate webhook secret (not the API secret). It sends an `x-razorpay-event-id` header for de-duplication. Supports subscriptions. International card acceptance needs a separate activation (secondary sources; not verified here). | Good for INR, UPI and card e-mandates. |
| **Cashfree** | Subscription webhooks carry `x-webhook-signature` and `x-webhook-timestamp`. The signature is HMAC-SHA256 over the timestamp plus the raw body. Official SDKs verify it. International support not confirmed in this research. | An alternative to Razorpay for India. |
| **Paddle** (merchant of record) | Sells in 200+ countries and handles sales tax as the merchant of record. Indian customers can pay in INR by UPI. Payouts to Indian sellers are reported (secondary sources) to arrive monthly in a foreign currency. Verify with Paddle before relying on this. | Good for overseas customers: removes the burden of foreign VAT and sales tax. |

**RBI e-mandate framework (official, consolidated April 2026):**

- Recurring card or UPI charges up to ₹15,000 each run without extra authentication. Above that, the customer authenticates every charge.
- Registering, changing or withdrawing a mandate always needs authentication.
- Variable mandates must let the customer set a maximum.
- Consequence for Oontu: annual Enterprise renewals above ₹15,000 need a customer step each time. Dunning must allow for that.

**DECIDED (25 Nov 2026, the user): Razorpay alone, for Indian and international customers.**

| Rank | Option | Why |
|---|---|---|
| 1 (chosen) | Razorpay only | About 2% in India plus a subscription add-on (sources cite 0.9–0.99%; confirm before signing), about 3% on international cards, 18% GST on fees. One integration, one webhook secret, one reconciliation, INR settlement, eFIRC for exports. Oontu is B2B: in the EU and UK the business buyer usually accounts for VAT (reverse charge), and US sales tax only starts above each state's thresholds. A merchant of record's extra cost buys little at this stage. |
| 2 | Razorpay + Paddle | Add Paddle (5% + $0.50, handles overseas tax) only when self-serve sales abroad reach about 20–30% of revenue, or Oontu starts selling to individuals abroad. |
| 3 | Cashfree only | Similar to Razorpay; keep as the fallback. |
| 4 | Stripe | Invite-only in India. |

Before going live with Razorpay:

- Activate international payments; it is a separate approval.
- File the annual GST LUT so overseas sales are zero-rated.
- Keep the eFIRC for each overseas payment.
- Confirm the subscription fee and the international rate.
- Design renewals for the RBI step on charges above ₹15,000.

More sources:

- [Razorpay pricing](https://razorpay.com/pricing)
- [Razorpay SaaS pricing guide](https://razorpay.com/blog/best-payment-gateway-pricing-saas-india-tco-guide/)
- [Razorpay cross-border licence](https://razorpay.com/blog/razorpay-rbi-pa-cb-licence-international-payments/)
- [Razorpay: GST on exported services](https://razorpay.com/blog/gst-export-services-india-guide/)
- [Paddle pricing](https://www.paddle.com/pricing)

**Earlier recommendation (superseded by the decision above):**

- Use an Indian aggregator (Razorpay first, Cashfree second) for Indian customers.
- Use a merchant of record (Paddle) for international customers.
- Put both behind one provider adapter with the contract the prototype already implements:

  ```
  receive(rawBody, signature)
    → verify
    → de-duplicate on event id
    → apply only if the object version is newer
    → reconcile
  ```

- Revisit Stripe if it invites us.
- Decision needed from the business: whether to hold an overseas entity. It changes the options.

**Webhook practice (secondary sources, consistent with each provider's docs):**

- Delivery is at least once and not in order.
- Keep processed event IDs under a unique constraint.
- Act on the object's current state or version, not on arrival order.
- Retries can last days.
- Run a periodic reconciliation against the provider's events API.

All of this is mirrored in `BOS_PAY` and `bosReconcile`.

Sources:

- [Stripe docs: accept international payments from India (invite only)](https://docs.stripe.com/india-accept-international-payments)
- [Stripe India FAQ](https://support.stripe.com/questions/india-faq)
- [Stripe invite-only coverage, May 2024](https://thetechportal.com/2024/05/31/stripe-limits-new-sign-ups-in-india-to-invite-only-amid-stringent-regulatory-compliance/)
- [Razorpay: validate and test webhooks](https://razorpay.com/docs/webhooks/validate-test/)
- [Cashfree: subscription webhook signature](https://www.cashfree.com/docs/payments/subscription/webhook-signature)
- [Paddle: supported countries](https://developer.paddle.com/concepts/sell/supported-countries-locales)
- [Paddle: UPI](https://developer.paddle.com/concepts/payment-methods/upi)
- [RBI Digital Payments – E-mandate Framework, 2026](https://rbi.org.in/Scripts/NotificationUser.aspx?Id=13374&Mode=0)
- [Hookdeck: Stripe webhooks — duplicates, ordering, retries](https://hookdeck.com/webhooks/stripe/guide-duplicates-ordering-retries-timeouts)

## 2. Other research applied (established standards and practice; engineering judgement)

| Topic | What was applied |
|---|---|
| Authorization | RBAC alone is not enough. Roles carry scopes, and checks look at the record (owner, team, queue: relationship-based in the spirit of Zanzibar-style ReBAC) and at context (state, approvals, expiry). Deny by default; least privilege; separation of duties (maker-checker). OWASP guidance: authorise every request on the server. |
| Identity lifecycle | Joiner, mover, leaver. One identity. Time-boxed elevation with approval. Periodic access reviews. Session revocation on suspension. History kept on offboarding. |
| Email ingestion | SPF, DKIM and DMARC decide trust. Message-ID gives idempotency. Threads match on In-Reply-To and References (RFC 5322) and on a ticket token in the subject. A token alone must not let a stranger join a thread. |
| Identity resolution | Deterministic, explainable signals with strength levels. Free-mail domains excluded. Domain ownership is not identity. Human review for medium evidence. Merges reversible and approved by a second person. |
| Customer success | Health scores must be explainable. Activation means reaching value (first meaningful workflow), not logging in. |
| Event integrity | Idempotency keys on commands (`bosRun`), on provisioning and on provider events. Exactly-once effect through de-duplication, not exactly-once delivery. |
| AI governance | AI proposes and a person disposes for consequential actions. The agent acts within the user's permissions (no confused deputy). Outputs say where they came from. |
| Architecture size | No new services, brokers or databases. A modular monolith with one command layer is enough at this stage (consistent with ADR-01..09 in doc 21). |

## 3. Decisions taken in this phase

| ID | Decision | Why |
|---|---|---|
| BOS-1 | Extend the Super Admin console. No separate internal app; one employee identity store (`PLATFORM_USER_ROSTER`). | The brief requires it, and it avoids duplicate logins and records. |
| BOS-2 | Employees hold several roles (`platformRoleIds`). `canPlatform` takes the union of them; `bosCan` adds scope. | One person, several jobs. Existing call sites keep working. |
| BOS-3 | Role templates are generated from one canonical catalog. | No hand-written permission lists drifting apart. |
| BOS-4 | A platform maker-checker queue (`BOS.approvals`) instead of the tenant APS engine. | APS resolves approvers from tenant roles and the tenant roster. A platform adapter for APS SLA timers is PROPOSED (37 §4). |
| BOS-5 | One command layer (`bosRun`) for audit, events, idempotency, agent limits and integrity. | One place to enforce rules; the shape a server will have. |
| BOS-6 | Account ≠ Tenant; parent/subsidiary links; no automatic merges. | Brief §7 and §17. |
| BOS-7 | One ticket record for every kind of request. | Brief §10. |
| BOS-8 | Paid status only from a verified event or a referenced manual verification. | Brief §9: never trust the client or mark paid arbitrarily. |
| BOS-9 | Two lifecycle dimensions for tenants: operational status (existing rules) and customer stage (derived). | One field can't carry both without drift. |
| BOS-10 | The five workspaces as navigation groups, with Platform Administration folding. | Brief §19. Keeps the sidebar calm (the design-style rules). |
| BOS-11 | The Platform Users screen becomes Employees and access, on the same view id. | No duplicate navigation or user list. |
