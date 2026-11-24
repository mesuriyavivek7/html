# 11 · Customer 360, onboarding, support and success

## 1. Existing code evidence

| Concern | Code | Status |
|---|---|---|
| Tenant records | `PLATFORM_TENANTS`, `PLATFORM_TENANT_ADMINS`, subscriptions, invoices | VERIFIED (prototype) |
| Tenant-side setup checklist | `WS_SETUPS`, `wsSetupStart` (line ~31,951), `WORKSPACE_STEPS_*`, Setup pill, `wsTrialCardHTML` | VERIFIED (prototype) |
| Usage signals | `TENANT_AGENT_SUBSCRIPTIONS[...].usedThisMonth`, `wsTrialNumbers` (jobs, submissions, interviews since trial start) | PARTIAL |
| Help for customers | Account help (`join-script`): sign-up and join problems, assisted setup | VERIFIED (prototype) |
| Tickets, incidents, CS plans, renewals, health | — (0 matches for "ticket"; "health" appears only as client health in the agency domain) | MISSING |

## 2. Current implementation

Oontu can see tenants, their plan and subscription, and help with sign-up and join problems. The customer's own setup progress lives in the tenant (and the browser), not in a record Oontu can see.

## 3. Limitations

No single customer record, no onboarding plan Oontu owns, no ticketing, no incidents, no health or renewal tracking.

## 4. Proposed solution

### 4.1 Customer 360 (one record, links not copies)
```
CustomerAccount { id, prospectId, primaryOrganizationId, tenantIds[], ownerIds: { sales, onboarding, cs },
                  segment: msme|mid|enterprise, orgType, country, status }
```
The 360 page is a **read model**: company and contacts (from Prospect/Contact), tenant(s) and access state, opportunity and demo history, proposals and agreements, subscription and invoices, onboarding milestones, usage, tickets, incidents affecting the tenant, renewals, CS activities, expansion opportunities. Each panel links to its source record; nothing is duplicated.

### 4.2 Onboarding plans
```
OnboardingTemplate { id, orgType, segment, milestones:[{ key, title, defaultOwnerRole, offsetDays, checks[] }] }
OnboardingPlan { id, customerAccountId, tenantId, templateId, ownerId, status, milestones:[
  { key, title, ownerId, targetDate, status: not_started|in_progress|blocked|done, blockers[], history[] } ] }
```
Default milestones: organisation setup, team and permissions, recruitment configuration (approval preset, stages), vendors (corporate) or clients (agency), data migration, integrations (mail, calendar, WhatsApp), training, Kairo and Intelligence configuration, go-live, first meaningful value.

**Automatic checks** read tenant events, not self-reports: "organisation setup" is done when the tenant's setup checklist is complete (today's `WS_SETUPS` progress, moved server-side); "first meaningful value" = first offer accepted (agency) or first job filled (corporate), configurable.

### 4.3 Support tickets and incidents
```
Ticket { id, customerAccountId, tenantId?, requesterContact|User, channel: in_app|email|web|internal,
         category, severity: s1..s4, priority, assigneeId, slaPolicyId, status: new|open|pending_customer|
         pending_engineering|resolved|closed|reopened, messages[] (public), notes[] (internal),
         attachments[], incidentId?, escalation?: { team, issueRef }, resolvedAt, reopenCount }
Incident { id, title, severity, status: investigating|identified|monitoring|resolved, affectedTenantIds[]|all,
           components[], startedAt, resolvedAt, commsLog[], postmortemRef, linkedTicketIds[] }
SlaPolicy { id, bySeverity: { firstResponseMins, resolutionMins }, businessHours, calendarId }
```
One incident links many tickets; resolving an incident offers a bulk customer update to linked tickets. In-app tickets carry tenant context automatically. Account help's escalations (`JN.escalations`) become tickets of category "Access and sign-up", keeping their resolution actions.

### 4.4 Customer success
```
HealthScore { customerAccountId, score, computedAt, signals:[{ name, value, weight, evidenceRef }] }
Renewal { id, customerAccountId, subscriptionId, dueDate, status, ownerId, risk, notes }
SuccessTask { id, customerAccountId, type, dueAt, ownerId, status, source: rule|manual|kairo }
```
Health is explainable: each signal names its evidence (active recruiter seats vs paid, weekly active users, jobs opened, journeys moved, time since last sign-in, open S1/S2 tickets, overdue invoices, setup completion). No black-box score.

## 5. Data impact

New platform tables above. Usage needs a metering event stream from tenants (counts only, never candidate content).

## 6. Permissions

CS and Support read tenant **metadata and usage counts**. Opening tenant content requires a support-access grant (16).

## 7. Dependencies

09 (CRM), 10 (provisioning), 14 (events), 15 (work queue), notification service.

## 8. Acceptance criteria

- One Customer 360 per customer; every panel opens its source record.
- A milestone completes from a tenant event without manual ticking.
- An incident affecting 30 tenants links their tickets and sends one update.
- Every health score can be explained signal by signal.

## 9. Tests

Read-model consistency after each source change; SLA timers in business hours (reuse APS business-hours logic, which already counts in the workspace time zone); incident-to-ticket fan-out.

## 10. Migration risks

Usage metering must not carry personal data across the platform boundary; define the event schema with privacy review.
