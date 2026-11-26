# 38 · Billing engine, My team and customer Help & support

Built on 25 Nov 2026, after the user approved the recommendation and added customer support. Front-end prototype: Razorpay, email and WhatsApp are simulated, and nothing is charged or sent.

Code blocks:

- `bos-billing-script`
- `bos-team-script`
- `tenant-support-style` and `tenant-support-script`

Tests:

- `tests/bos-billing.spec.js`
- `tests/bos-team-support.spec.js`

## 1. How money moves

Only Razorpay's verified payment event marks something paid. Only an invoice, a credit note or a debit note changes what a customer owes. Every route ends in the same records: `PLATFORM_SUBSCRIPTIONS`, `BOS.taxInvoices` and `BOS.payLinks`.

| Route | What happens |
|---|---|
| Customer buys or upgrades in the app (Settings › Plan & billing, the trial card, Compare plans) | `bosCheckoutStart`, then Razorpay, then the verified event. The plan is activated, the subscription is created or updated, a paid tax invoice is issued with its lines, the promo use is counted and a receipt is emailed. A declined card changes nothing. |
| Customer buys on the website | The same `bosCheckoutStart({ channel:'website' })`. The public page is not built in the prototype. |
| Assisted sale | Proposal, then approval if outside policy, then a payment link. The link can be shared by email, WhatsApp or copy. |
| Finance raises an invoice | Draft (edit freely), then issue, which assigns the number, applies GST, LUT or IGST, and creates a payment link that can be shared. |
| Renewal | The mandate is charged on the renewal date. Above ₹15,000 the customer approves each charge (RBI). A failed charge gets reminders on day 1, 3 and 7, then the workspace becomes read-only. Nothing is deleted. Paying the link clears it. |

### Pricing

Desk, Floor, Network, Hire and Scale are priced as licences × price per licence × months, in INR or USD. Group is priced by quote. The legacy flat plans keep their flat price.

This fixes the earlier bug where a 20-licence deal was priced as a single licence.

### Promo codes

- Created by a Revenue or Finance manager.
- Approved by a Finance manager who did not create the code (maker-checker).
- Each code carries dates, eligible plans, a maximum number of uses and a "new customers only" flag.
- Checked the same way for proposals and for checkout.
- Capped at 25 %. Deeper discounts go through a proposal approval.

### Correcting an issued invoice (GST)

| State | What Oontu does |
|---|---|
| Draft | Edit anything. |
| Issued, unpaid, this month, GSTR-1 not marked filed | Cancel and re-issue. The new number is linked to the old one, and the old payment link stops working. |
| Paid, already filed, or from an earlier month | Credit note (`OON-CN/`) for a lower amount, or debit note (`OON-DN/`) for a higher one. The debit note gets its own payment link. |
| Only the customer's GSTIN or address was wrong, after filing | The invoice is flagged for amendment (B2BA) in the next return. |

- A reason is always required.
- A change above ₹10,000, or any change to a paid invoice, needs approval from a Finance manager who did not request it.
- Finance marks a month's GSTR-1 as filed in the billing desk; that changes the correction path.
- All corrections appear in the CA exports.

### Payment links

- One open link per document.
- Sharing by email or WhatsApp checks the address or number.
- Reminders go 5 and 2 days before the link expires.
- The link records when it was opened and paid.
- Links can be cancelled.

### Screens

- **Finance:** Billing and payments › Billing desk. It holds the drafts, the documents and their corrections, the payment links, the promo codes and the renewals with their reminders.
- **Customers:** Settings › Plan & billing. It has "Choose a plan" (checkout) and "Invoices and receipts", with Pay now on anything open.

### Permissions

| Permission | Who holds it |
|---|---|
| `platform-finance:invoice` | Commercial Operator, Finance Associate, Finance Specialist, Finance Manager, Finance Administrator |
| `platform-finance:correct_invoice` | Finance Specialist and above |
| `platform-finance:approve_correction` | Finance Manager and Finance Administrator |
| `platform-commercial:create_promo` | Revenue Manager, Finance Manager, Finance Administrator |
| `platform-commercial:approve_promo` | Finance Manager and Finance Administrator |

Sales can share proposal payment links but cannot raise, edit or correct invoices. The renewal scheduler runs as a system identity (`SYS-BILLING`) that can never sign in and never appears in a people list.

## 1a. Automatic invoicing: payment in, invoice out (`bos-autoinvoice-script`)

Every verified payment runs one pipeline with no manual step. Each run is logged in Billing desk › Invoice vault.

1. **Payment verified.** A signed Razorpay event, or Finance's manual verification with a bank reference.
2. **Invoice ready.**
   - If an invoice already exists, it is marked paid. This covers subscription invoices, drafts that were issued, checkouts and proposals.
   - If the payment has no invoice behind it, a GST invoice is created from what was paid. The tax is worked back out of the total.
   - The invoice is numbered in the year's series and its CGST + SGST, IGST or LUT treatment is chosen automatically.
3. **Stored.** A frozen copy of the invoice document goes into the vault with a fingerprint. A later change to it is detected and shown.
4. **Sent to the customer.** The invoice and receipt are emailed; this is simulated in the prototype.

What it guarantees:

- **One invoice per payment.** A repeated Razorpay event never creates a second invoice or a second email.
- **Mismatches stop.** A payment whose amount doesn't match is not invoiced; it becomes a Finance exception.
- **Every route uses it:** renewals, checkouts, proposal links and bank transfers.

The stored document is a proper GST tax invoice:

- supplier name and GSTIN, and the customer's GSTIN;
- place of supply, SAC, line items and taxable value;
- CGST / SGST / IGST, the total and the amount in words;
- the LUT wording for exports, and PAID with the payment ID.

Finance and the customer can each open an invoice ("View") and save it as a PDF (the browser's print-to-PDF).

Tests: `tests/bos-autoinvoice.spec.js`.

## 1b. Accountable approvals (`bos-approval-guard-script`, 26 Nov 2026)

Both sides of every approval must explain themselves. The record keeps what was asked, what the approver saw and why they decided.

**The requester: discounts and trials above policy.** No approval is requested until there is a business case:

- a reason type: competitor offer, volume or multi-year commitment, strategic or reference customer, budget limit, expansion, or other;
- the case itself, with facts;
- the competitor and their offer, when the reason is a competitor match;
- the commitment in licences, months or years, when the reason is volume;
- what happens without the discount.

Stock phrases such as "please approve", "urgent" or "ok" are refused.

**The approver: every approval type.** The approval dialog shows:

- the business case;
- the deal context: stage, confidence, close date, terms, list price against net, and the rupees given away;
- the customer's earlier proposals;
- the requester's last 90 days of requests;
- risk checks: stacked offers, restricted level, a low-confidence deal, a deal not yet qualified, undercutting an existing customer, a competitor quote with no figure.

The approver must pick a reason and write their reasoning, whether they approve or decline. Money approvals and other approvals use different reason lists. The requester is told why.

**Protection:**

- Nobody approves their own request.
- Nobody approves a discount on a deal they own.
- Only one discount request can be pending per deal. This stops asking several approvers with different numbers.
- An approval holds only for the exact terms approved, and for 14 days.
- A declined case can't be resubmitted unchanged.
- The requester can withdraw a request while it is pending.
- Promo codes need a business purpose.
- New integrity rule `discount-pattern`: three or more above-policy requests by one person in 30 days, or most of them declined, opens a finding for review. It is not treated as proof.
- The case, the context seen, the decision reason and the reasoning are all stored on the approval and in the audit log.

Tests: `tests/bos-approval-guard.spec.js`.

## 2. Role fixes (from the role check)

- **Approvals lists:** each person sees only requests they made, requests they may decide, or requests they decided. Finance no longer sees security approvals.
- **Insights:** shows only the departments the person manages. The Super Admin sees all of them.
- **New permissions:** the invoice and promo permissions in the table above.
- **Demo data:** a Commercial Operator is now seeded (Ishaan Verma, reports to Vikram Shah).

## 3. My team

The screen is in every manager's menu when someone reports to them, directly or through another manager.

Each person's card shows the numbers for their kind of work. Hover over a number to see how it is calculated. Numbers are shown for the last 7, 30 or 90 days.

| Kind of work | Numbers shown |
|---|---|
| Sales | Open pipeline, won, win rate, demos held, follow-ups on time, average discount, days to close |
| Support | Tickets resolved, share resolved within target time, first-response time, reopened, escalations, open now |
| Customer Operations | Onboarding in progress, share fully set up, customer health, renewals in 90 days, training held |
| Finance | Invoices issued, money collected, overdue, refunds handled |

Every card also shows workload and overdue items. "Hand work to a teammate" uses the normal commands, so permissions still apply: a deal can't go to someone who doesn't sell. There is no ranking between people.

## 4. Help & support for customers (staffing agencies and corporates)

Settings › Help & support is available to everyone in a customer workspace. It has three tabs.

### Knowledge centre

- 35 short tutorials. Each one has a one-line answer, numbered steps and an "Open …" button that goes to the right screen or settings section.
- Only articles that fit the workspace type (agency or corporate) are shown.
- People ask in their own words. Synonyms are understood, for example "cv" means résumé, "login" means sign in and "coupon" means promo code.
- The product itself is also searched: every screen and settings section the person can open. So "where is…" questions land on the real place.
- Each answer asks "Did this answer it?". A "No" offers the next step.
- Searches with no answer, and answers marked "No", become product feedback in Oontu's Insights. Repeated questions can then become new articles.
- Kairo's support drafts on the Oontu side use the same articles, so there is one knowledge source.

### Tickets

When a question isn't answered, the person can raise a ticket from the answer or from the Tickets tab.

- **What goes to Oontu's team:** the question, the articles already tried, the screen and the plan.
- **Where it lands:** Oontu's single ticket system (Service), with the plan's response times.
- **What the customer sees:** replies only. Internal notes and drafts never appear.
- **What the customer can do:** reply (which reopens a resolved ticket), then confirm it's solved and rate the help 1–5.
- **Who sees which tickets:** a person sees their own. Workspace managers see all tickets for the workspace.

### Your support plan

The support level comes from the workspace's plan:

| Support level | Plans | First reply | Ways to reach Oontu |
|---|---|---|---|
| Essential | Desk, Hire | 24 h; no urgent tickets | Tickets, email |
| Priority | Floor | 8 h; urgent 4 h | + Write to support (chat) |
| Premium | Network, Scale | 4 h; urgent 1 h | + Calls, named success manager |
| Enterprise | Group | 2 h; urgent 1 h, 24×7 for critical issues | + Calls, success manager |

- Outages are always treated as urgent, on every plan.
- A read-only workspace keeps the knowledge centre and can still get billing and account help.
- The plan's response times also apply to tickets Oontu staff create for that customer.

## 5. Not built

- Real Razorpay keys and webhooks, real email and WhatsApp sending.
- A public website checkout page.
- GST portal filing and e-invoicing (IRN).
- Downloadable PDF invoices.
- A live chat channel (the prototype's chat sends a message into a ticket).
- Help articles managed from a CMS. In the prototype the articles are kept in the page.
