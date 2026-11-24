# 15 · Unified operating experience

## 1. Existing code evidence

| Work surface | Code |
|---|---|
| Home "Needs you" | `bhHome`, `bhNeeds`, `bhGroupsFromAttention` (groups Now / Today / This week), `oRecruiterAttention`, role Homes (recruiter, manager, owner, HM) |
| To do | `my-todo`, `manager-todo`, `all-tasks` renderers; `FOLLOW_UPS`, `FOLLOW_UP_TRANSITIONS`, `PERSONAL_TASKS` |
| Approvals | `approval-center`, APS lanes, `APPROVAL_REQUESTS` with entity types (Requisition, VendorJobRequest, VendorLifecycle, submissions, offers, credit notes, rates) |
| Campaign work | `cpMyDay` (ranked list on Cowork, campaign "Needs you", Home) |
| Inbox | `inbox-script`: team chat, WhatsApp, email, LinkedIn, campaign channels in one Inbox |
| Notifications | top-bar bell, `PLATFORM_ANNOUNCEMENTS` |
| Kairo suggestions | `oKairoCard`, `IQ_SUGGESTIONS` |
| Super Admin | Account help queue (`JN.ui.tab`), sign-up follow-ups |

## 2. Current implementation

Work already resolves to real records in the agency and corporate workspaces: attention items link to the job, journey or approval they come from, and approvals carry SLA and escalation. Several queues exist side by side (Needs you, To do, Approvals, Cowork My day, Inbox).

## 3. Limitations

- Each queue computes its own items; the same fact can appear in two places with different wording.
- No common shape (owner, deadline, why it matters, next action, whether Kairo can help, whether approval is required).
- Super Admin has no work queue beyond Account help.

## 4. Proposed solution: one work-item read model, many views

```
WorkItem (read model, derived from events, never edited directly) {
  id, tenantId | platform, kind: follow_up | bottleneck | approval | feedback_due | vendor_submission |
        customer_follow_up | sales_activity | demo_prep | onboarding_milestone | support_escalation |
        cs_task | renewal | platform_failure | agent_recommendation,
  record: { type, id },                // the canonical record; the item opens it
  what, whyItMatters, ownerId, dueAt, severity,
  nextAction: { label, permission },   // performed on the record, not on the item
  kairo: { canAssist, actionTemplate? }, approvalRequired: bool, approvalId?,
  source: rule | person | agent, ruleId?, createdAt, resolvedAt
}
```
- **Rules produce items** from events (an interview with no feedback after N hours; a vendor submission unreviewed past SLA; a milestone past target). Today's attention functions become the first rules, so wording and grouping (Now / Today / This week) stay.
- **Resolution is automatic**: when the underlying record changes, the item resolves. Nobody ticks a duplicate task.
- **Views, not new apps**: Home "Needs you", To do, Approvals and Cowork My day become filtered views of WorkItem. Approvals stays a dedicated screen because of its lanes and SLAs, but reads the same items.
- **Super Admin Home** gets the same component with platform kinds.
- **Kairo** can take an item only where `kairo.canAssist` and the autonomy level allow; the result is an AgentAction (13).

## 5. Data impact

`work_items` read model and `work_rules` (versioned configuration). No new source records.

## 6. Permissions

An item is visible if the viewer may see its record; `nextAction.permission` is checked when acted on.

## 7. Dependencies

Events (14), rules engine (shared with APS triggers), notification preferences (07).

## 8. Acceptance criteria

- The same fact never appears as two items for one person.
- Completing the action on the record resolves the item everywhere within one event cycle.
- Every item opens its record and shows who owns it, by when and why.

## 9. Tests

Rule → item → resolution tests per kind; permission filtering; port Home and To do assertions from `fidelity-b-v2`, `m04c-menu-home` and `walkthrough-fixes` specs.

## 10. Migration risks

Home layouts are approved designs (B v2). Change the data source behind them, not the layout.
