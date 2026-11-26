# Oontu platform: complete flow map (current state, 26 Nov 2026)

**Scope.** This covers only the **Oontu platform**: the internal operating system Oontu's own employees use to run the SaaS business (Super Admin console and Business OS). It does **not** cover the staffing-agency or corporate recruitment product, except where the platform touches it: checkout, Help & support, tenant data and provisioning.

**Ground truth.**
- One file: `recruitment-os-prototype.html` (about 70,000 lines, plain JS and CSS, no build).
- Tests live in `tests/*.spec.js` and run with `& .\tests\run-auth-tests.ps1 -Spec tests\<name>.spec.js` in headless Chrome.
- It is a **front-end prototype**. All data lives in the page, in memory. Razorpay, email, WhatsApp, DNS checks and the setup of remote workspaces are **simulated**. There is no backend.
- Every check runs in the browser, so none of it is production security.

**Reading guide for an AI assistant.** Each screen lists:
- its **view id**: `state.activeNav`, opened with `showView(id)`;
- who can see it (the access rule);
- what is on it;
- the **functions** that do the work;
- the **records** it reads and writes.

All Business OS changes go through `bosRun(name, input, fn)`, which:
- checks that the actor is active;
- refuses high-risk commands to agents;
- limits integrations to an allow-list of commands;
- honours idempotency keys;
- writes `logPlatformAudit`;
- pushes `BOS.events`;
- re-runs `bosIntegrityScan()`.

Changes in the older screens (Tenants, Subscriptions, Plans and the rest) call their own functions, which check `canPlatform`.

---

## 0. Current state

| Item | State |
|---|---|
| Committed | `agency-prototype-v2`, including accountable approvals (`bos-approval-guard-script`) and the simplified deal page (`bos-deal-flow-script`). Earlier work is in `96956a2`, which is merged into `main` (`5b98966`). |
| Tests | Every platform spec passes. The only failure seen in full runs is `motion.spec.js` "collapse… pill on the active item", a known timing flake that passes when run alone. |

---
## 1. Architecture: code blocks (in file order, platform-relevant)

| Block id or area | What it holds |
|---|---|
| `boot-guard-style` + script (in `<head>`) | Hides the half-styled first paint behind an "Oontu." splash until `DOMContentLoaded`. |
| Platform slices (~35,600–38,700) | `PLATFORM_PERMISSION_MODULES`, `PLATFORM_ROLES`, `PLATFORM_USER_ROSTER`, `canPlatform`, `PLATFORM_TENANTS`, `logPlatformAudit`, tenant lifecycle, sign-ups, tenant detail, `provisionTenant`, `PLATFORM_PLANS`, subscriptions, `PLATFORM_INVOICES`, platform users, feature controls, announcements, platform audit, platform settings. |
| ~7,641 | `renderOontuDashboardV2`: the platform overview (Dashboard). |
| ~41,880 | New plan catalogue (Desk, Floor, Network, Hire, Scale, Group), `BOOSTS`, `WS_PLANS`, `wsPlanChoose`. |
| ~42,950 | `renderOontuAgents`: Cowork agents catalogue and kill switch. |
| ~53,500 | `join-script`: Account help (join requests, domain escalations, assisted setup). |
| `bos-core-script` | Catalogue extension, 31 role templates, multi-role identity, scopes (`bosCan`), `BOS` store, `bosRun`, maker-checker approvals, employee lifecycle, temporary access, `bosActAs`. |
| `bos-revenue-script` | Accounts, contacts, `bosMatch`, opportunities, intake, stages, demos, proposals, policy, merge, domains, seeds. |
| `bos-operations-script` | Tickets, SLA, routing, email intake (`BOS_MAIL`), incidents, hand-over, onboarding, training, health, renewals, Razorpay adapter (`BOS_PAY`), refunds, reconciliation, Tenant 360 logic, sensitive access, seeds. |
| `bos-intelligence-script` | Integrity rules and exceptions, My Work, analytics, product themes, Kairo for operations (`bosKairo`). |
| `bos-style` + `bos-ui-script` | Every Business OS screen, dialogs, navigation (`NAV_LAYOUT.oontu`) and screen access (`BOS_VIEW_ACCESS`). |
| `bos-login-style/script` | Platform sign-in, the "Prototype · simulated sign-in" dropdown, the `authEnter` wrapper. |
| `bos-access-strict-script` | Strict screen access per role, `bosHomeView`, the redirect home. |
| `bos-tax-script` | GST/LUT engine, `BOS.taxInvoices` ledger, CA reports, Tax tab, customer tax details. |
| `bos-billing-script` | Per-licence pricing, promos, invoice drafts, issue and correct, payment links, checkout, renewals and dunning, Billing desk. |
| `bos-team-script` | Approval visibility, Insights scope, My team, hand-over. |
| `tenant-support-style/script` | Customer Settings › Help & support: knowledge centre, tickets, support tiers. |
| `bos-invoice-style` + `bos-autoinvoice-script` | Auto-invoice pipeline, invoice vault, invoice document, PDF. |
| `bos-approval-guard-script` | Accountable approvals: business case, approver reasoning, safeguards. |
| `bos-deal-flow-style/script` | Simplified deal page: five steps, one next action, "To win" checklist, Mark lost. |

---

## 2. Getting in: identity and sign-in

1. **Sign-in page** (`#/sign-in`).
   - An employee types their work email `<name>@oontu.internal`, then the password `demo1234`, or asks for the email code (`123456` in the prototype).
   - Simulator path: `createAuthSimulator()`.
     - `teamAccount(email)` looks the email up in `PLATFORM_USER_ROSTER`.
     - It creates an account with membership `{ workspaceId:'ws_oontu_platform', role:'oontu' }`.
     - It refuses anyone who is not Active, and any system identity.
   - `signIn()` re-checks the roster status on every sign-in.
2. **`authAfterIdentity` → `authSelectWorkspaceNow` → `authEnter`**, wrapped by `bos-login-script`:
   - sets `ACTIVE_PLATFORM_USER_ID`;
   - keeps the tenant's `ORG_STRUCTURE.profile` untouched;
   - calls `bosActAs(id)` and writes the audit entry "Employee signed in";
   - `showView(bosHomeView())` opens the Platform overview if the person holds `platform-tenant:update`, otherwise My work.
3. **"Prototype · simulated sign-in"** (bottom-right caption with an arrow): `authToggleDev()` opens the tools.
   - `bosDevLoginsHTML()` shows a dropdown grouped by department.
   - `bosLoginShow(id)` fills the card: user ID, password, role, department, queues, home screen, screens, what they can approve.
   - "Use this login" (`bosLoginUse(id)`) fills in the password step.
4. **Other ways in (prototype only):**
   - the developer tools role switcher (`switchRole('oontu')`) enters as Meera without signing in;
   - Employees and access › "View as (prototype)" (`bosActAs`).
5. **Seeded logins** (all use the password `demo1234`):

| Email | Role(s) | Department |
|---|---|---|
| meera@oontu.internal | Oontu Super Admin (protected) | Platform |
| arjun@ | Sales Executive | Revenue |
| kavya@ | Sales Manager (manages Arjun) | Revenue |
| leela@ | Revenue Manager | Revenue |
| rohan@ | Support Agent (queues: support, technical) | Service |
| nisha@ | Support Manager (manages Rohan) | Service |
| aditi@ | Implementation Specialist + Trainer | Customer Operations |
| sana@ | Customer Success Manager (manages Aditi) | Customer Operations |
| vikram@ | Finance Manager (manages Ishaan) | Business & Finance |
| ishaan@ | Commercial Operator | Business & Finance |
| dev@ | Security Administrator | Platform |
| `SYS-BILLING` | Billing scheduler (system; cannot sign in; hidden) | Business & Finance |

There are also two legacy platform roles: `role_oontu_support` and `role_oontu_operations`.

---

## 3. Authorization

### Permission catalogue

The catalogue is `PLATFORM_PERMISSION_MODULES`. Each module has a label, sensitivity, description and actions.

| Module | Actions |
|---|---|
| `platform-tenant` | view, create, update, suspend, activate |
| `platform-plan` | view, create, update, activate |
| `platform-subscription` | view, update, suspend, reactivate |
| `platform-feature` | view, update |
| `platform-notification` | create, update, publish |
| `platform-audit` | view, export |
| `platform-settings` | view, update |
| `platform-user` | view, create, update, assign, approve |
| `platform-account` | view, create, edit, assign, merge, export |
| `platform-lead` | view, create, edit, assign |
| `platform-commercial` | view, create, edit, approve_discount, approve_restricted, create_promo, approve_promo |
| `platform-ticket` | view, create, edit, assign, close, escalate |
| `platform-incident` | view, create, edit, close |
| `platform-onboarding` | view, create, edit, assign, execute |
| `platform-training` | view, create, edit |
| `platform-success` | view, edit, assign |
| `platform-finance` | view, verify_payment, request_refund, approve_refund, reconcile, export, invoice, correct_invoice, approve_correction |
| `platform-integrity` | view, assign, resolve |
| `platform-access` | request, approve, revoke |

### How checks work

- **Scopes:** own < assigned < team < queue < department < region < organization < global.
- **`canPlatform(module, action)`:** the union of the person's roles (`platformRoleIds` plus active temporary grants). Anyone not Active is denied.
- **`bosCan(module, action, record, user)`:** permission plus scope checked against `record.ownerId`, `assignees`, `queue`, the owner's team, department and region.
- **`bosWhyNot`:** a human-readable reason for a refusal.

### Role templates (`BOS_TEMPLATES`, 31, plus Super Admin and the two legacy roles)

| Area | Templates |
|---|---|
| Revenue | SDR, Sales Executive, Senior Sales Executive, Sales Manager, Revenue Manager, Revenue Administrator |
| Customer Operations | Customer Operations Associate, Implementation Specialist, Training Coordinator, Trainer, CS Executive, Senior CS, CS Manager, Operations Administrator |
| Service | Service Desk, Support Agent, Technical Support, Senior Support, Support Manager, Service Desk Administrator |
| Business & Finance | Commercial Operator, Finance Associate, Finance Specialist, Finance Manager, Finance Administrator |
| Platform | Platform Operations Associate, Tenant Operations Specialist, Platform Support Specialist, Platform Operations Manager, Security Administrator, Platform Administrator |

### Guards

- Nobody approves their own request.
- Nobody changes their own roles.
- Only someone holding `platform-user:approve` can grant more access than they have.
- At least one active Super Admin must remain.
- Agents may not run the commands in `HIGH_RISK`:
  - refund.approve, account.merge.approve, access.approve, tenant.suspend;
  - employee.roles, employee.offboard, payment.verify, approval.decide, grant.role.
- System actors may run only the commands in `BOS_SYSTEM_COMMANDS`: ticket.create, ticket.reopen, ticket.customer-reply, ticket.customer-close.

### Strict screen access (`BOS_VIEW_ACCESS`)

The same rule hides the menu item, refuses the screen, and redirects to home when someone opens a screen they can't use.

| Screen | Needs |
|---|---|
| Dashboard | tenant:update |
| My work | any active employee |
| My team | has reports |
| Pipeline | lead:view |
| Accounts | account:view |
| Incomplete sign-ups | lead:create |
| Tickets | ticket:edit |
| Onboarding and success | onboarding:edit, training:edit or success:edit |
| Account help | tenant:update |
| Billing and payments | finance:view or commercial:approve_restricted |
| Subscriptions | subscription:update |
| Plans | plan:update |
| Tenants | tenant:update or tenant:create |
| Employees and access | user:view |
| Integrity | integrity:resolve |
| Insights | managers: lead:assign, ticket:assign, success:assign, finance:approve_refund or integrity:resolve |
| Agents and Feature controls | feature:update |
| Notifications | notification:create |
| Audit | audit:view |
| Platform settings | settings:view |

Record pages: `oontu-opp` needs lead:view, `oontu-account` needs account:view, `oontu-ticket` needs ticket:view, `oontu-onboarding` needs onboarding:view.

The exact screens each login sees are pinned in `tests/bos-login.spec.js` and listed in `docs/PROTOTYPE-LOGINS.md`.

---

## 4. Navigation map (`NAV_LAYOUT.oontu`)

```
(top)                    Dashboard · My work · My team
Revenue                  Pipeline · Accounts · Incomplete sign-ups
Service                  Tickets
Customer operations      Onboarding and success · Account help
Business & finance       Billing and payments · Subscriptions · Plans
Platform administration  (folding group) Tenants · Employees and access · Integrity · Insights ·
                         Cowork agents · Feature controls · Notifications · Audit
(bottom)                 Platform settings
```

Settings (`showView('settings')`) for the platform role also has a "Platform" group. Most of its items are links to the screens above (Tenants, Plans, Subscriptions, Agents, Sign-ups, Platform users, Notifications, Audit). Two are real sections:

- **LinkedIn infrastructure** (`p-linkedin`): GoLogin, proxies, limits and warm-up.
- **AI models** (`p-ai`): provider keys and model choice (simulated).

---

## 5. Screen by screen

### 5.1 Dashboard (`oontu-dashboard`, `renderOontuDashboardV2`)

- **Number cards:** active workspaces, incomplete sign-ups, trials ending this week, MRR (`oSubMrr`).
- **"Needs your attention"** shows:
  - sign-ups stuck more than 24 h;
  - trials ending;
  - overdue invoices (`PLATFORM_INVOICES` + `isInvoiceOverdue`);
  - suspended workspaces.
- **Table:** workspaces (`PLATFORM_TENANTS`). A row opens `openOontuTenantDetail`.
- **Action:** Create workspace → `openCreateTenantModal` → `ctSubmit` → `createInvitedTenant` → `provisionTenant`.

### 5.2 My work (`oontu-mywork`, `bosMyWork(userId)`)

- **One ranked list built from the records**, with no copied tasks:
  - their open deals, with next-step due dates;
  - unowned leads, if they may assign;
  - their demos;
  - their tickets and the unassigned tickets in their queues;
  - their onboardings;
  - training they run;
  - approvals they may decide;
  - integrity findings assigned to them;
  - renewals on their accounts.
- **Each item** shows its points and why, for example "SLA breached +50", plus a type, a due date and one action button.
- **"Updates for you"** shows `BOS.notifications`, marked read with `bosMarkRead`.

### 5.3 My team (`oontu-team`, `bos-team-script`)

- `bosReportsOf(me)` gives direct and indirect reports and never includes system identities.
- `bosPersonMetrics(user, days)` gives numbers by kind of work, each with a "how":
  - **Sales:** pipeline, won, win rate, demos, follow-ups on time, average discount, days to close.
  - **Support:** resolved, within SLA, first response, reopened, escalations, open.
  - **Customer Operations:** onboarding, fully set up, health, renewals, training.
  - **Finance:** invoices issued, collected, overdue, refunds.
  - **Anyone:** findings reviewed.
- Workload and overdue come from `bosMyWork(user)`.
- **Period:** 7, 30 or 90 days.
- **"Hand work to a teammate":** `bosHandOverDialog` → `bosHandOver`, which uses `bosAssignOpp`, `bosTicketAssign` and `bosOnbAssign`, so permissions apply.
- A note says the view is for coaching, not ranking.

### 5.4 Pipeline (`oontu-revenue`)

- **Number cards:** open pipeline, win rate, demo attendance, follow-ups on time, discount approvals pending.
- **Tabs:**
  1. **Pipeline:** open deals in scope. A row opens `bosOpen('opp', id)`.
  2. **Leads and sign-ups:**
     - new and unowned leads;
     - incomplete sign-ups (`SIGNUP_LEADS`) with "Follow up" (`bosFollowUpSignup`), which creates the lead once and is idempotent.
  3. **Demos:** your time and the customer's time zone.
  4. **Proposals:** status and policy note.
  5. **Analytics:** by source, by stage, lost reasons.
- **Action:** New inquiry → `bosInquiryDialog` → `bosIntake(input)`:
  1. checks the required fields;
  2. `bosMatch` returns `link`, `review` or `new` with evidence;
  3. creates or links the account and contact;
  4. owner = the account owner, otherwise the person logging it;
  5. creates the opportunity, or adds history to an existing open one;
  6. tells the account owner;
  7. on medium evidence, opens a duplicate review (`bosOpenDuplicateReview`).

### 5.5 Opportunity page (`oontu-opp`, `renderOpp` + `bos-deal-flow-script`)

**Top card** (`bosDealFlowHTML`):

- **Five steps:** Lead → Qualify → Demo → Proposal → Won. They are made from the ten detailed stages (`BOS_DEAL_PHASES`); the current detailed stage is shown under the step.
  - Clicking a step moves the deal there (`bosDealGoTo` → `bosMoveStage`). The same rules apply, and a refusal says what is missing.
  - For someone who can only view, the steps are disabled.
- **Next step** (`bosDealNext`): one button worked out from the deal's records. In order:

  | Situation | Next step |
  |---|---|
  | Nobody owns it | Take this deal |
  | Not qualified | Qualify |
  | No demo yet | Book a demo |
  | Demo booked, still to come | Prepare for the demo |
  | Demo time has passed | Record the demo outcome |
  | No live proposal | Prepare the proposal |
  | Discount request pending | Waiting for approval (shows who) |
  | Proposal ready | Send the proposal |
  | Proposal sent | Customer accepted (or send a payment link) |
  | Proposal accepted | Mark as won |
  | Won | Open onboarding |
  | Lost | Reopen the deal |

- **To win** checklist (`bosDealChecklist`): owner, contact, qualified, demo held, proposal sent, customer accepted.
- **Quiet actions:**
  - Mark as lost (`bosDealLostDialog`; a reason is required);
  - Reassign;
  - Back to Revenue.

**Cards below:**

- Opportunity, Qualification.
- Kairo · next step: `bosKairo.nextAction` now uses `bosDealNext`, so it is right for won and lost deals.
- Proposals table: Send, Record acceptance, Payment link, View approval.
- Demos table: Record outcome.
- Hand-over (once won).
- History.

**The dialogs behind the buttons:**

| Dialog | Calls |
|---|---|
| Qualify (`bosQualifyDialog`) | `bosQualify` |
| Demo (`bosDemoDialog`) | `bosScheduleDemo` |
| Demo outcome (`bosDemoOutcomeDialog`) | `bosDemoOutcome` |
| Proposal (`bosProposalDialog`) | `bosCreateProposal` |

The proposal dialog asks for a **business case** when the discount or trial is above policy. **Won** needs an account, contact, owner and an accepted proposal with approved terms. Winning runs `bosHandover`.
### 5.6 Accounts (`oontu-accounts`) and Account 360 (`oontu-account`)

- **List:** search; "Possible duplicates to review", where Review opens `bosDupDialog`. The reviewer can:
  - keep them separate (`bosKeepSeparate`);
  - make one a subsidiary (`bosSetParent`);
  - ask to merge (`bosRequestMerge`), which needs an approval and can be undone with `bosUndoMerge`.
- **Account 360 shows:**
  - identity: registry ID, domains, verify domain (`bosVerifyDomain`, simulated DNS), parent and subsidiaries, merged-in accounts with "Undo merge";
  - **Tax details:** country, GSTIN, place of supply, and why that tax treatment applies; "Edit tax details" uses `bosSetCustomerTax`;
  - Kairo summary;
  - Health, with its evidence;
  - contacts, opportunities and tickets;
  - workspaces and billing (subscription, invoices, "Open Tenant 360");
  - onboarding and history.

### 5.7 Incomplete sign-ups (`oontu-signups`, `renderOontuSignups`, older module)

- `SIGNUP_LEADS`:
  - filters;
  - where each person stopped (`LEAD_STOP_STEPS`);
  - a lead sheet (`openSignupSheet`) with a timeline;
  - assign (`assignSignupLead`);
  - log a call (`logSignupCall`) with an outcome (`LEAD_OUTCOMES`) and a drop reason (`LEAD_DROP_REASONS`);
  - Kairo panel.
- It overlaps with Pipeline › Leads and sign-ups, which also lists these sign-ups with "Follow up".

### 5.8 Tickets (`oontu-service`) and ticket page (`oontu-ticket`)

- **Number cards:** open, resolved within SLA, median first response, reopen rate.
- **Tabs:**
  1. My queues;
  2. All tickets;
  3. Incidents, with Resolve (`bosResolveIncident`);
  4. Email intake log;
  5. Routing and SLA tables.
- **Actions:**
  - New ticket (`bosTicketDialog` → `bosCreateTicket`);
  - Simulate inbound email (`bosMailDialog` → `BOS_MAIL.receive`).
- **Ticket page:**
  - Take it, Assign, Reply (with internal and wait-for-customer options), Kairo draft (`bosKairo.draftReply`, which saves a draft only), Waiting on…;
  - Escalate (reason required; raises the priority one level and co-assigns the manager);
  - Resolve (resolution required), then Close;
  - Reopen;
  - Link account or incident;
  - Request refund (billing tickets);
  - Change category or priority (`bosSetClass`).
- **Lifecycle:** received → classified → routed → assigned → investigating → waiting (customer, internal, engineering) → resolved → closed. A reopen goes back to investigating.
- **SLA:** `BOS_SLA` by priority (P1 1/8 h, P2 4/24 h, P3 8/72 h, P4 24/120 h). The customer's **support tier** overrides it when the ticket has a tenant. Waiting on the customer pauses the clock.
- **Routing:** `BOS_ROUTES`, 11 categories mapped to queues:

  | Category | Queue |
  |---|---|
  | Login | technical |
  | Product | support |
  | Training | training |
  | Billing | billing |
  | Renewal, Upgrade | revenue |
  | Setup | customer-ops |
  | Outage | incident (auto-links an incident) |
  | Cancellation | retention |
  | Import | technical |
  | Security | security (sensitive) |

- **Email intake** (`BOS_MAIL.receive`): runs as the system actor `mail-intake`.
  - Quarantines on SPF/DKIM/DMARC failure.
  - Applies spam rules.
  - De-duplicates on Message-ID.
  - Matches threads on `[TCK-…]` or In-Reply-To. A stranger's mail can't join a thread.
  - Resolves the sender to an account.
  - Sends an acknowledgement to the outbox.

### 5.9 Onboarding and success (`oontu-custops`) and onboarding page (`oontu-onboarding`)

- **Number cards:** onboarding, activation rate, health split, renewals in 90 days.
- **Tabs:**
  1. Onboarding;
  2. Training: sessions, Manage (register with a waitlist, attendance);
  3. Health and renewals: health per account; renewals within 90 days with "Start renewal" (`bosStartRenewal`, owned by Revenue).
- **Action:** New training session (`bosCreateSession`).
- **Onboarding page:**
  - hand-over checks and completeness;
  - activation rule;
  - **Provision workspace** (`bosProvisionFromOnboarding` → `provisionTenant`, idempotent key `handover:<opp>`);
  - **Run standard setup** (`bosStandardSetup`, simulated for remote tenants);
  - Reassign or Take ownership (`bosOnbAssign`);
  - milestones (`BOS_MILESTONES`). Automatic ones come from the tenant's real data via `bosEvidence`; manual ones need evidence (`bosCompleteMilestone`).
- **Activation** means owner, team, workflow, first job and first submission. Signing in alone is not activation.

### 5.10 Account help (`oontu-help`, `join-script`, older module)

- **Join requests and domain escalations** for customers signing up on a domain someone already holds:
  - contact the owner (`jnContactOwner`);
  - approve or decline the join (`jnApproveJoin`, `jnDeclineJoin`);
  - transfer ownership (`jnTransferOwner`);
  - free the domain (`jnFreeDomain`);
  - allow a separate workspace (`jnAllowSeparate`);
  - resolve (`jnResolve`).
- **Assisted setup** with the customer's permission, for 24 hours: `jnAssistAsk`, `jnAssistAnswer`, `jnAssistDo`, `jnAssistRevoke`, `jnAssistFinish`, all audited.

### 5.11 Billing and payments (`oontu-finance`)

Number cards: approvals pending, open links, refunds waiting, reconciliation.

| Tab | Contents |
|---|---|
| 0 Approvals | `bosApprovalsVisible()`: only what you asked for, may decide, or decided. Decide opens `bosApprovalDialog`. |
| 1 Payments | Payment links (Simulate payment) and provider events (applied, stale, rejected, mismatch, unmatched). |
| 2 Invoices and refunds | `PLATFORM_INVOICES` with Verify payment (`bosOpenVerifyPayment` → `markInvoicePaid(id, {reference})`, Finance only) and Payment link; refunds with Simulate provider refund. |
| 3 Reconciliation | `bosReconcile()`: paid without a verified event, duplicate invoice, refund without approval. |
| 4 Provider and rules | Razorpay (decided); rules text. |
| 5 Tax and CA reports | Oontu tax profile (Edit: `bosSetTaxProfile`); how tax is chosen; compliance checks (`bosTaxChecks`); financial year and period; 5 CSV exports (`bosTaxExport`; Download all `bosTaxExportAll`: sales register, GSTR-1 summary, payments and gateway charges, exports with LUT/eFIRC, credit and debit notes); number cards; tax documents table. |
| 6 Billing desk | **Invoice vault** (auto-invoice runs, View); Drafts (`bosDraftDialog`, `bosEditDraft`, `bosIssueDraft`); documents (Payment link, Correct → `bosCorrectDialog` → `bosCorrectInvoice`); payment links (Share → `bosShareDialog` → `bosShareLink`; Cancel); promo codes (New → `bosPromoDialog` → `bosCreatePromo`; Pause or Resume); renewals and reminders; Run renewals now (`bosRenewalRunUI`). |

### 5.12 Subscriptions (`oontu-subscriptions`, older module) and the subscription page

- **List** with status filter (`SUBSCRIPTION_STATES`).
- **Detail:**
  - change plan (`changeSubscriptionPlan`);
  - extend trial (`extendSubscriptionTrial`);
  - set renewal date (`setSubscriptionRenewalDate`);
  - status change (`changeSubscriptionStatus`, following `SUBSCRIPTION_TRANSITIONS`);
  - invoices section: Generate invoice (`generateInvoiceForSubscription`, wrapped to issue the GST tax invoice too), Mark paid (now opens the Finance verify dialog), Void (`voidInvoice`, wrapped to cancel the tax invoice).

### 5.13 Plans (`oontu-plans`, older module) and the plan page

- `PLATFORM_PLANS`:
  - **legacy** (`legacy:true`): Starter, Growth, Enterprise, with flat prices;
  - **current:** Desk, Floor, Network (agency), Hire, Scale (corporate), priced per licence a month in `prices{INR,USD}`; Group is "talk to us".
- **Actions:** create a plan, edit fields and entitlements (`ENTITLEMENT_CATALOG`), activate or deactivate.
- `BOOSTS`: add-ons.

### 5.14 Tenants (`oontu-tenants`) and Tenant 360 (`oontu-tenant-detail`)

- **List:** search, status filter, plan filter.
- **Tenant page (older module):**
  - status with reasons (`TENANT_STATUS_TRANSITIONS` + `TENANT_STATUS_REASONS`);
  - tenant admins and invites (`PLATFORM_TENANT_ADMINS`);
  - Cowork LinkedIn usage.
- **Tenant 360** section (`bosTenant360HTML`):
  - account, customer stage (`bosCustomerStage`, derived from evidence), owners;
  - health, renewal, open tickets, onboarding;
  - access grants;
  - Request access.

### 5.15 Employees and access (`oontu-platform-users`; replaced the old Platform Users screen)

- **Tabs:**
  1. **Employees:** Manage (`bosEmployeeDialog`) offers:
     - View as;
     - Save roles (`bosSetRoles`);
     - Temporary access (`bosRequestTempRole`; approval by a Security Administrator; expires);
     - Review access (`bosReviewAccess`);
     - Suspend (`bosSuspendEmployee`, which ends sessions);
     - Offboard (`bosOffboardEmployee`, which hands work over and keeps history);
     - Resend or Mark activated, for invited people.
  2. **Role templates.**
  3. **Permission catalogue.**
  4. **Temporary and sensitive access:** grants, with Revoke (`bosRevokeGrant`).
  5. **Outbox:** simulated email.
- **Actions:**
  - Invite employee (`bosInviteEmployee`; 7-day invitation);
  - Request workspace access (`bosRequestAccess`). Metadata access needs no approval. Workspace data needs a ticket, the customer's authorisation and someone else's approval, lasts 1–24 h, and expires on its own.

### 5.16 Integrity (`oontu-integrity`)

- `BOS_RULES`, 12 rules:

  | Rule | Looks for |
  |---|---|
  | duplicate-account | Accounts that look like the same company |
  | ownership-conflict | Two owners working one account |
  | unowned-lead | A lead with no owner |
  | missed-follow-up | A follow-up past its date |
  | unapproved-discount | Terms outside policy without approval |
  | missing-handover | A won deal with no hand-over |
  | stalled-onboarding | Onboarding unowned or with no progress |
  | unowned-renewal | A renewal coming up with no owner |
  | ticket-sla | Breach, unowned, closed without resolution, reopened twice, outage without incident |
  | finance-reconciliation | The reconciliation problems in 5.11 |
  | access-control | Data access without approval, offboarded owners, self role changes |
  | discount-pattern | Many above-policy requests by one person |

- **Finding lifecycle:** detected → assigned → review → confirmed or false positive → resolved → closed (`bosReviewException`).
- A false positive is not raised again for the same evidence. A cleared condition is closed automatically.

### 5.17 Insights (`oontu-insights`)

- Department cards, only for the departments you manage (`bosSeesDept`).
- Product feedback themes (`bosProductThemes`), built from:
  - tickets (affected feature, root cause);
  - demo objections;
  - lost reasons;
  - Help-centre searches that weren't answered;
  - feature requests.

### 5.18 Cowork agents (`oontu-agents`), Feature controls, Notifications, Audit, Platform settings (older modules)

- **Agents:** `AGENT_CATALOG`, plans, kill switch with a reason, usage per tenant (`PLATFORM_ADDON_LEDGER`).
- **Feature controls:** `PLATFORM_FEATURE_CONTROLS`, statuses available, unavailable, plan-gated or disabled-temporarily, with plan selection.
- **Notifications (announcements):** `PLATFORM_ANNOUNCEMENTS`, states draft → scheduled → published → expired → archived. The audience is all tenants, chosen tenants, or a plan.
- **Audit:** `AUDIT_LOG` filtered to `module === 'Platform'`; filter by category; search.
- **Platform settings:** `PLATFORM_SETTINGS` (platform name, support email and phone, default time zone and currency, maintenance message and mode, default trial days).

---

## 6. End-to-end flows (step by step)

### F1. Lead to won

1. `bosIntake` or `bosFollowUpSignup`.
2. Identity resolution by `bosMatch`:
   - strong evidence: link the account and tell the owner;
   - medium: create a new account plus a duplicate review;
   - weak: create a new account and show the hint.
3. Owner set.
4. `bosQualify`.
5. `bosScheduleDemo`, then `bosDemoOutcome`.
6. `bosCreateProposal`: the price comes from the plan (licences × unit × months); offers from `BOS.promos`; discount policy `BOS_POLICY`:

   | Discount or trial | Result |
   |---|---|
   | Up to 10 % and 14 days | No approval |
   | Up to 25 % and 30 days | Sales Manager approves |
   | Above that | Revenue or Finance Manager approves (restricted) |
   | Above 40 % | Refused |

   A business case is required above policy, and only one pending request is allowed per deal.
7. The approval (if needed): `bosDecide` with a reason and reasoning, both ways.
8. `bosSendProposal` (simulated email). It must match the approved terms and be within 14 days.
9. `bosAcceptProposal`, or the customer pays a link (`bosCreatePayLink`), which accepts the proposal automatically.
10. `bosMoveStage(id, 'Won')`, then `bosHandover`, which creates the onboarding.

### F2. Hand-over to live customer

1. `bosHandover`: checks, completeness, owner = the Customer Operations person with the least load, account status customer.
2. `bosProvisionFromOnboarding` → `provisionTenant` (assisted; idempotent; owner invited).
3. `bosStandardSetup`.
4. Training and attendance complete the training milestone.
5. Evidence milestones complete, then the onboarding is activated.

### F3. Health to renewal

1. `bosHealth`: activation 30 + usage 25 + support 20 + billing 15 + training 10.
2. `bosRenewals()` lists renewals within 90 days.
3. An integrity finding is raised if a renewal within 60 days has no owner.
4. `bosStartRenewal` creates a Renewal opportunity owned by Revenue.
5. The billing renewal itself is F8.

### F4. Ticket lifecycle

1. Created from in-app, email (`BOS_MAIL`), the customer portal (`supportRaise`), phone, chat or an internal request.
2. Classified (`bosClassify`), routed, given its SLA (tier SLA for tenants).
3. Assign, reply, wait (pauses the SLA), escalate.
4. Resolve with a resolution.
5. Close: the customer confirms and rates (`supportConfirm`), or closes it manually.
6. A customer reply reopens it.
7. An outage links an incident.
8. A billing ticket can lead to a refund (F10).

### F5. Customer support from inside a customer workspace (Settings › Help & support, every customer user)

1. **Knowledge centre** (`helpSearch`):
   - 35 articles (`HELP_ARTICLES`, filtered to agency or corporate), plus an index of the screens and settings sections this person can open;
   - synonyms understood;
   - the answer shows steps and an "Open …" button;
   - "Did this answer it?". **No** (or no result) logs product feedback and offers the next step.
2. **Raise a ticket** (`supportTicketDialog` → `supportRaise`):
   - category, subject, details, urgency (urgent only on Priority and above);
   - outages are always P1;
   - a read-only workspace gets billing and account help only.
3. **Write to support** (chat, Priority and above) or **Ask for a call** (Premium and above) also create tickets.
4. **Tickets tab:**
   - the customer sees their own tickets; workspace managers see all of the workspace's tickets;
   - replies only, never internal notes;
   - reply (`supportReply`);
   - confirm and rate (`supportConfirm`).
5. **Your support plan** (`SUPPORT_TIERS`):

   | Tier | Plans | First reply |
   |---|---|---|
   | Essential | Desk, Hire | 24 h |
   | Priority | Floor | 8 h, urgent 4 h; chat |
   | Premium | Network, Scale | 4 h, urgent 1 h; calls and a success manager |
   | Enterprise | Group | 2 h, urgent 1 h; 24×7 for critical issues |

### F6. Customer buys or upgrades (Settings › Plan & billing, trial card, Compare plans)

1. `bosCheckoutOpen`, then the checkout dialog:
   - plan, licences, yearly or monthly, add-ons, promo code;
   - `bosCheckoutQuote` adds proration credit and GST, IGST or LUT.
2. `bosCheckoutStart` (system actor `checkout`) creates the Razorpay link.
3. `bosCheckoutPay`:
   - declined: nothing changes;
   - captured: `CHECKOUT_DONE.checkout` issues the paid tax invoice with its lines, counts the promo use, creates or updates the subscription with its mandate, and activates the WS plan.
4. Then F9: the auto-invoice pipeline stores the invoice and emails it.
5. The website would call the same `bosCheckoutStart({channel:'website'})`. The public page is not built.

### F7. Finance invoices by hand

1. `bosDraftInvoice` (lines, currency, due days).
2. `bosEditDraft`.
3. `bosIssueDraft`: number `OON/<FY>/####`, tax segment, payment link (`bosLinkForDoc`).
4. `bosShareLink`: email, WhatsApp or copy, with reminders 5 and 2 days before expiry (`bosLinkSweep`).
5. Paid: F9.
6. **Correct** (`bosCorrectionPath` decides the path):
   - unpaid, this month, GSTR-1 not filed: cancel and re-issue (linked; the old link is cancelled);
   - otherwise: credit note `OON-CN/` or debit note `OON-DN/` (the debit note has its own link);
   - only the GSTIN or address wrong after filing: flagged for amendment.
   - Above ₹10,000 or on a paid invoice: a Finance Manager approves first (`invoice-correction`).
   - `bosMarkGstr1Filed(period)` marks a month as filed.

### F8. Renewals and payment reminders (`bosRenewalRun`, runs as `SYS-BILLING`)

1. For each active subscription that is due:
   1. `generateInvoiceForSubscription` creates the invoice and tax invoice; a payment link is created.
   2. INR above ₹15,000: the customer must approve the charge (RBI rule). The link is sent and reminders follow.
   3. Mandate fine: charged, then the next renewal date is set.
   4. Charge fails: status past_due, link sent.
2. Reminders go on day 1, 3 and 7. After day 7 the subscription becomes `readOnly` and the workspace read-only. Nothing is deleted.
3. Paying the link clears the reminders and the read-only state.

### F9. Payment to invoice: automatic pipeline (`bosAutoInvoice`, runs after every verified `payment.captured` or a manual bank verification)

1. **Payment verified.**
2. **Invoice ready:** an existing document is marked paid; if there is none, one is created from the amount, with the tax worked back out of the total.
3. **Stored:** `BOS.vault` gets the frozen HTML and a fingerprint (`bosVaultVerify`).
4. **Sent:** outbox.

- Exactly one invoice per payment (`byPayment` map); a repeated event does nothing.
- A mismatch: no invoice, and a Finance exception.
- View and save as PDF: `bosInvoiceView` and `bosInvoicePrint` (Finance in the Billing desk vault; customers in Settings › Plan & billing).

### F10. Refund

1. `bosRequestRefund` (Finance or Support roles; capped at what was paid).
2. Approval: a Finance Manager, not the requester.
3. Provider instruction (outbox).
4. `BOS_PAY` event `refund.processed`: refunded, and a **credit note** is issued.

### F11. Razorpay adapter (`BOS_PAY`)

- `sign` and `receive(raw, signature)` → verify (simulated checksum; production uses HMAC-SHA256 on the server).
- De-duplicate by event ID.
- Version ordering (stale events are kept but not applied).
- Amount and currency match.
- Apply.
- Wrappers, in order:
  1. tax (proposal checkout invoice, credit notes);
  2. billing (document links, checkout completion, dunning reset);
  3. auto-invoice (the vault).

### F12. Tax

- `bosTaxSegment(party, date, valueINR)` chooses the treatment:

  | Customer | Treatment |
  |---|---|
  | Same state as Oontu (profile Karnataka 29, sample) | CGST 9 + SGST 9 |
  | Another Indian state | IGST 18 |
  | Abroad, LUT valid | EXPWOP, zero-rated |
  | Abroad, no LUT | EXPWP, IGST 18 |
  | Location missing | Review |

- GSTR-1 section: B2B when there is a GSTIN; B2CL when inter-state and above ₹1 lakh; otherwise B2CS. Credit and debit notes go to CDNR or CDNUR.
- `BOS_TAX.profile`, `BOS_TAX.rates` and the eFIRC numbers are samples.

### F13. Employee lifecycle

1. Invite.
2. Activated.
3. Roles changed, temporary access, access review.
4. Suspend: sessions end.
5. Offboard: work handed over, grants revoked, roles removed, history kept.

### F14. Sensitive access

1. Request: purpose; scope metadata or workspace data; hours; ticket; customer authorisation.
2. Approval: Support Manager or Security Administrator, not the requester.
3. Active.
4. Expired (`bosExpireGrants`) or revoked. Everything is audited.

### F15. Approvals (maker-checker; all types in `BOS_APPROVAL_TYPES`)

- Types:
  - discount, discount-restricted, trial-extension;
  - refund;
  - account-merge;
  - access;
  - role-grant;
  - invoice-correction;
  - promo.
- `bosRequestApproval` notifies everyone who may decide.
- `bosDecide`, then `bosOnApproval[type]` runs the result.
- `bos-approval-guard-script`:
  - requester case;
  - the approver's reason and reasoning, both ways;
  - context and risk checks (`bosApprovalContext`);
  - the deal owner can't decide;
  - terms bound to the approval, valid 14 days;
  - no unchanged resubmission;
  - `bosWithdrawApproval`;
  - promo purpose required;
  - the `discount-pattern` rule.

### F16. Tenant lifecycle and provisioning

- `provisionTenant`:
  - channels: assisted (Super Admin, Sales, Customer Operations) or self-service;
  - steps: workspace, tenant, owner, subscription, audit;
  - idempotent and resumable.
- Status machine `TENANT_STATUS_TRANSITIONS`, with reasons.
- Customer stage is derived (`bosCustomerStage`).

---

## 7. State machines (summary)

| Record | States |
|---|---|
| Opportunity | New lead, Identity resolution, Qualified, Discovery, Demo, Evaluation, Proposal, Negotiation, Approval, Won · side: Lost (reason), Nurture, Disqualified, Duplicate, Existing account, Unresponsive · Reopened goes back to Qualified |
| Proposal | ready, awaiting_approval, sent, accepted · declined, superseded · withdrawn, approval_expired |
| Approval | pending → approved, declined, withdrawn |
| Ticket | received → classified → routed → assigned → investigating ⇄ waiting_customer / internal / engineering → resolved → closed (reopen) |
| Incident | investigating → resolved |
| Onboarding | not_started → in_progress → completed |
| Training session | scheduled → held |
| Payment link | open → paid, expired, cancelled, failed |
| Tax document | issued → paid; cancelled; kinds: invoice, credit_note, debit_note |
| Invoice draft | draft → issued |
| Promo | pending_approval → active ⇄ paused; declined |
| Subscription | trial, active, past_due, paused, cancelled, expired; plus `dunning` and `readOnly` |
| Tenant | invited, trial, active, suspended, cancelled, archived |
| Employee | Invited, Active, Suspended, Offboarded |
| Grant | requested → active → expired, revoked, declined |
| Integrity exception | detected → assigned → review → confirmed or false_positive → resolved → closed |
| Announcement | draft → scheduled → published → expired → archived |

---

## 8. Data stores (all in memory unless noted)

**Records from the older platform slices:**

- `PLATFORM_USER_ROSTER`, `PLATFORM_ROLES`, `PLATFORM_PERMISSION_MODULES`
- `PLATFORM_TENANTS`, `PLATFORM_TENANT_ADMINS`
- `PLATFORM_PLANS`, `PLATFORM_SUBSCRIPTIONS`, `PLATFORM_INVOICES`
- `PLATFORM_FEATURE_CONTROLS`, `PLATFORM_ANNOUNCEMENTS`, `PLATFORM_SETTINGS`
- `AGENT_CATALOG`, `PLATFORM_ADDON_LEDGER`
- `SIGNUP_LEADS`, `JN` (account help)
- `PROVISIONING`
- `AUDIT_LOG`

**`BOS` object (Business OS records):**

| Area | Keys |
|---|---|
| Revenue | `accounts`, `contacts`, `opps`, `demos`, `proposals` |
| Approvals and access | `approvals`, `grants`, `reviews` |
| Service | `tickets`, `incidents`, `emails` |
| Customer Operations | `onboardings`, `trainings` |
| Payments | `payEvents`, `payLinks`, `refunds` |
| Integrity and feedback | `exceptions`, `feedback`, `helpSearches` |
| Messaging | `outbox`, `notifications` |
| Tax and billing | `taxInvoices`, `drafts`, `gstFiled`, `promos`, `vault`, `autoRuns` |
| Plumbing | `events`, `processed`, `idem`, `seq` |

**Kept in the browser (localStorage):**

- auth accounts made by sign-up (`oontu.proto.accounts`);
- `WS_PLANS`;
- the last workspace;
- nav group open state;
- APS state.

**Everything in `BOS` resets on reload.**

---

## 9. Simulated or not built

| Thing | Status |
|---|---|
| Razorpay | Simulated adapter |
| Email, WhatsApp | Outbox only |
| DNS domain verification | Simulated |
| Registry lookups | Simulated |
| Remote tenant setup | Simulated |
| Usage of remote tenants | Not held |
| Persistence | None |
| Server authorization | None |
| Website checkout page | Not built |
| GST portal filing, e-invoicing (IRN) | Not built |
| PDF | Browser print |
| Live chat | Becomes a ticket |
| CMS for help articles | Not built |

---

## 10. Known problems and suspected "broken" points (prioritised)

1. **Fixed on 26 Nov:** the confusing opportunity page. It now has five steps and one Next-step button, and Kairo's suggestion is right for won and lost deals.
2. **Two generations of screens.**
   - Older slices use older Tailwind cards and modals and their own state variables: Dashboard, Tenants, Tenant page, Incomplete sign-ups, Account help, Subscriptions, Plans, Agents, Feature controls, Notifications, Audit, Platform settings.
   - Business OS screens use the Design 2.0 `o-*` components and `bosRun`.
   - Look and behaviour differ, and the older actions don't go through `bosRun`, so they don't trigger integrity re-scans or domain events.
3. **Duplicate entry points:**
   - Incomplete sign-ups (old screen) and Pipeline › Leads and sign-ups both list `SIGNUP_LEADS`;
   - Settings › Platform group links repeat the sidebar;
   - Subscriptions › Generate invoice and Billing desk › New invoice are two ways to invoice;
   - approvals are decided in My work, in Billing › Approvals, and from the opportunity page, with no single "Approvals" inbox.
4. **Two invoice models.** `PLATFORM_INVOICES` (`inv-N`, per subscription) and `BOS.taxInvoices` (`OON/…`) are linked by `sourceRef`. The Subscriptions screen shows `inv-N`; Finance and customers see `OON/…`.
5. **Two plan catalogues.** The legacy Starter, Growth and Enterprise plans still exist (the demo tenant's subscription may be on Growth) next to Desk through Group. Legacy plans have flat prices; the current ones are per licence.
6. **Nothing survives a reload.** `BOS` resets: tickets, deals and invoices created during a demo disappear. This is the most likely reason the platform "feels broken".
7. **Only one tenant has real data.** Other tenants are registry entries, so health, usage, activation and Tenant 360 show "not held in this prototype" for them.
8. **Top-bar search** says "Search candidates, jobs, clients" and searches tenant recruiting data, not platform records (accounts, tickets, invoices).
9. **The notification bell** shows account-help items. `BOS.notifications` (approvals needed, tickets assigned) appear only in My work › Updates.
10. **The dashboard (platform overview) knows only the older data:** tenants, sign-ups, trials, MRR from the older subscription fields. It shows nothing from the Business OS (pipeline, tickets, SLA breaches, approvals, integrity).
11. **MRR** is computed from `sub.price`. After a checkout, `price` holds the year's taxable total, so MRR may be overstated or understated.
12. **The developer role switcher** enters the platform as Meera without signing in (prototype only).
13. **`motion.spec.js` "collapse… pill"** fails sometimes in full runs (timing flake).
14. **The older screens' "Mark paid"** now opens the Finance verify dialog, which needs a reference. Users of the old screen may expect a one-click mark.
15. **Real details missing:** sample GSTIN and LUT, simulated Razorpay. The CA must confirm the SAC code and the ₹1 lakh B2CL limit.

---

## 11. Tests that cover the platform

| Spec | Covers |
|---|---|
| `bos-identity-revenue.spec.js` | Identity, roles, scope, navigation, accounts, matching, merge, revenue, policy, AI limits |
| `bos-operations.spec.js` | Tickets, email, SLA, escalation, incidents, onboarding, training, health, renewals, payments, refunds, reconciliation, false positives, access, Tenant 360, My work, product themes, screens |
| `bos-login.spec.js` | Platform sign-in, dropdown, exact screens per login |
| `bos-tax.spec.js` | Tax segments, numbering, reports, exports, tax profile |
| `bos-billing.spec.js` | Pricing, promos, invoices, corrections, links, checkout, proration, renewals and dunning |
| `bos-team-support.spec.js` | Approval visibility, Insights scope, My team, hand-over, system identity, customer Help & support |
| `bos-autoinvoice.spec.js` | Payment → invoice → vault → email, no duplicates, mismatch, bank transfer, renewals, proposals |
| `bos-approval-guard.spec.js` | Accountable approvals |
| `bos-deal-flow.spec.js` | Simplified deal page |
| `provisioning.spec.js` | The provisioning engine |
| `signup-recovery.spec.js` | Account help |
| Parts of `auth-flow.spec.js` | Older platform screens |
| `screens-crawl.spec.js`, `light.spec.js` | Every Oontu nav screen renders with the design tokens |

---

## 12. Glossary

| Term | Meaning |
|---|---|
| Account | The customer relationship (CRM). |
| Tenant | A customer workspace (`PLATFORM_TENANTS`). One account can own several. |
| BOS | The Business OS layer (`window.BOS`). |
| Maker-checker | The requester can never decide their own request. |
| Scope | How far a permission reaches (own, team, queue, …). |
| Support tier | The customer's support level from their plan. |
| LUT | Letter of Undertaking: zero-rated exports. |
| EXPWOP / EXPWP | Export without or with IGST. |
| eFIRC | Bank proof of foreign inward remittance. |
| Vault | The frozen copies of sent invoices. |
| Dunning | Reminders after a failed renewal charge. |
