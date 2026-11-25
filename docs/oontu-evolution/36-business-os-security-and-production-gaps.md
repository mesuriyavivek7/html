# 36 · Business OS: security, privacy and production gaps

**This is a front-end prototype.** Every check below runs in the browser, which an attacker controls. None of it is production authorization. A server must repeat every check against its own data. Nothing here is production-ready.

## 1. Controls in the prototype (tested; see 37)

| Area | Control |
|---|---|
| Authentication and identity | One employee identity. Invited, suspended and offboarded employees are denied on every call. Two-step sign-in is represented (`mfa`) but simulated. |
| Authorization | Deny by default. Union of roles plus scope checked against the record. Hidden navigation also refuses to render. Every command checks again. |
| Privilege escalation | Nobody changes their own roles. Only `platform-user:approve` can grant beyond your own access. At least one active Super Admin. Temporary elevation needs another person's approval and expires. |
| Separation of duties | Maker-checker on discounts, trials, refunds, merges, sensitive access and elevated roles. The requester can never decide. |
| Tenant data access | Platform roles never include tenant data. Workspace-data access needs a ticket, the customer's authorisation, another person's approval, 1–24 h, and is revocable and audited. |
| Offboarding | Roles, sessions and grants are removed at once. Open work is handed over. History is untouched. |
| Audit | Every command writes a platform audit entry with the employee, the actor type (employee, agent, system) and the command name. |
| Email | SPF, DKIM and DMARC failures are quarantined. Message-ID de-duplication. A quoted ticket ID from a stranger can't join a thread. Attachment scan is simulated. |
| Payments | The signature is verified. Event-ID de-duplication. Version ordering. Mismatches and unmatched events are flagged. No client-side "paid". |
| AI | Agents act within the person's permissions and are refused high-risk commands. Drafts are never sent automatically. Outputs are labelled simulated. |
| Integrations | A system actor may run only listed commands (email intake: create and reopen tickets). |
| Privacy | The outbox never sends. Seeded data uses `.example` domains. Contact data is held only in the page. |

## 2. Production gaps (MISSING; needed before real use)

1. **Server authorization.**
   - Port `bosCan`, the catalog, the templates and `bosRun` to the server (TypeScript and PostgreSQL per D-1, still parked).
   - Enforce scope in queries, not after reading.
   - Use row-level security per tenant for customer data.
2. **Real identity.**
   - An identity provider with SSO for employees and enforced MFA.
   - Session store and revocation.
   - SCIM or HR-driven joiner, mover and leaver.
   - Login alerts.
3. **Secrets.**
   - Provider webhook secrets in a secrets manager.
   - HMAC-SHA256 over the raw body on the server.
   - Secret rotation with an overlap window. The prototype's `sim1=` checksum is **not** cryptography.
4. **Email.**
   - A mailbox provider webhook or IMAP poller, with signature checks on the provider's callback.
   - Malware scanning of attachments.
   - Rate limits.
   - Data-loss rules for outbound mail.
5. **Persistence and concurrency.**
   - A database with transactions.
   - Unique constraints on event IDs and idempotency keys.
   - Optimistic locking on records.
   - An outbox table for events.
6. **SLA calendars.** Business hours and holidays per region and contract, in each customer's time zone (APS already models IST business hours for tenants).
7. **Data protection.**
   - Retention periods for tickets, email and recordings.
   - Consent for training recordings.
   - DPDP Act (India) and GDPR handling for contacts.
   - Export and erasure requests.
8. **Audit storage.** Append-only, tamper-evident storage with export for auditors (`platform-audit:export` exists as a permission only).
9. **Payments.**
   - Real provider integration, after the business decides on the entity structure (35 §1).
   - Dunning under the RBI e-mandate rules.
   - GST invoicing.
10. **Abuse prevention.** Rate limits on intake and email, CAPTCHA on public forms, alerting on integrity findings of critical severity.

## 3. Threats considered

| Threat | Mitigation in this design | Server work |
|---|---|---|
| Forged "payment succeeded" from the browser | Paid only from a verified event or a referenced Finance verification | Verify on the server; never accept client state |
| Replay or out-of-order webhooks | Event-ID de-duplication; version ordering | Unique index, transaction |
| Ticket hijack by quoting an ID | The sender must match the thread's contact domain | Same, plus DMARC |
| Sales approving its own discount | Maker-checker, role-bound approver | Same on the server |
| Admin granting themselves power | No self role change; approve-level needed beyond own access | Same; alert on attempts |
| Support browsing customer data | Ticket, customer authorisation, approval, expiry, audit | Enforced by row-level security and a proxy |
| AI agent misuse | Acts as the person, with high-risk commands refused | Task-scoped tokens; per-action authorisation |
| Weak-signal automatic merges | Never automatic; reversible; second person | Same |
