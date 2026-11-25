# 34 · Business OS: workflows by workspace

Code: the blocks `bos-core-script`, `bos-revenue-script`, `bos-operations-script`, `bos-intelligence-script`, `bos-style` and `bos-ui-script` at the end of `recruitment-os-prototype.html`.

Every change runs through `bosRun(name, input, fn)`. It:

- checks that the actor is active;
- refuses high-risk commands to agents, and allows an integration only the commands on its list;
- honours an idempotency key;
- writes the platform audit event;
- publishes a domain event (`BOS.events`);
- re-runs the integrity rules.

## 1. Account 360 and identity resolution (IMPLEMENTED)

- **Account and Tenant are different records.**
  - An Account is the customer relationship. It holds parent, domains with verification, registry ID, owner, contacts, opportunities, tickets, onboarding and history.
  - A Tenant is a workspace (`PLATFORM_TENANTS`). An account lists its tenants in `account.tenantIds`.
  - Parent and subsidiary stay separate accounts, linked by `parentId`.
- **`bosMatch(input)`** returns every candidate with its evidence:
  - **strong:** existing contact email, the same registry ID, the same tenant, a verified domain;
  - **medium:** an unverified domain, the same website, the same name once legal words are removed, the same phone;
  - **weak:** a related sub-domain, a similar name, the same city.
- **Decisions.**
  - Strong evidence links the inbound contact to the existing account and notifies the owner.
  - Medium evidence creates a new account plus a duplicate review.
  - Weak evidence creates a new account and shows the hint. It never merges and never blocks.
  - A different registry ID caps the result at weak: parent and subsidiary stay distinct.
- **Domains.**
  - Free-mail domains give no evidence.
  - A domain can be verified on only one account (simulated DNS check). Shared domains stay verified on one account and the others are linked as related.
- **Reviewing a duplicate pair.** The reviewer can keep them separate (with a reason, recorded as a false positive), make one a subsidiary, or ask for a merge.
- **Merges.**
  - Need `platform-account:merge` and a second person; the requester can't approve.
  - Are refused when the registry IDs differ.
  - Move contacts, opportunities, tickets, onboardings, demos, proposals, domains and tenants, and keep a map so `bosUndoMerge` restores them.
- **Ownership.**
  - Each account and opportunity has one owner.
  - An inquiry on an owned account goes to that owner.
  - Changing an owner is recorded in history and audit.
  - Two open opportunities on one account with different owners raise an `ownership-conflict` finding.

## 2. Revenue (IMPLEMENTED; email, meeting links and payment links are SIMULATED)

- **Intake.** `bosIntake` is one door for 18 sources: Website, Contact form, Sign-up, Incomplete sign-up, Demo request, Referral, Partner, Outbound, Social, Marketing, Advertising, Event, Manual, Import, Existing customer, Expansion, Renewal, Support.
  - Source and campaign are stored on the opportunity: attribution comes from the record itself.
  - Incomplete sign-ups (`SIGNUP_LEADS`) are followed up with `bosFollowUpSignup`. It links the lead and doesn't copy it, and a second click returns the same lead.
- **Lifecycle.** New lead → Identity resolution → Qualified → Discovery → Demo → Evaluation → Proposal → Negotiation → Approval → Won.
  - Side states: Lost (needs a reason), Nurture, Disqualified, Duplicate, Existing account, Unresponsive. A lost or side-state deal can be reopened.
  - Stages can be skipped. **Won** requires an account, a contact, an owner and an accepted proposal whose terms are inside policy or approved.
- **Qualification.** Business need, hiring volume, team size, decision maker and timeline; it says what is still missing. Pain points are optional.
- **Demos.**
  - Scheduled in the customer's time zone and shown in both clocks.
  - Past times are refused.
  - The outcome records attendance (attended, no-show, rescheduled), objections, features shown and next steps.
  - Objections feed the product feedback themes.
- **Commercial policy** (`BOS_POLICY`, deterministic):
  - The price always comes from the plan's official list price; a typed price is refused.
  - Seats are checked against the plan's user limit.
  - Approved offers (`BOS_PROMOS`) need no approval.

  | Request | Who must approve |
  |---|---|
  | Discount up to 10 %, trial up to 14 days | Nobody (the owner may give it) |
  | Discount up to 25 %, trial up to 30 days | A Sales Manager |
  | Discount above 25 %, or a longer trial | A Revenue Manager or Finance Manager (restricted) |
  | Discount above 40 % | Refused outright |

  - Nobody approves their own request.
  - A proposal waiting for approval can't be sent.
- **Payment link** (simulated) from a ready, sent or accepted proposal, or from an issued invoice. Only one open link per proposal or invoice.
- **Analytics.** Opportunities and wins by source, by stage, lost reasons, win rate, demo attendance, follow-up compliance and discounts pending.

## 3. Service (IMPLEMENTED; the email adapter is SIMULATED)

- **One ticket record**, carrying:
  - account, tenant, contact, source, category, priority, queue and owner;
  - SLA, messages and internal notes, escalation level, incident;
  - reopen count, resolution, root cause, affected feature, attachments, sensitivity and history.
- **Routing** (`BOS_ROUTES`), exactly the brief's table:

  | Category | Queue |
  |---|---|
  | Login / account | Technical Support |
  | Product issue | Support |
  | Training | Training |
  | Billing | Billing Support (Finance roles) |
  | Renewal | Revenue |
  | Setup / configuration | Customer Operations |
  | Outage | Incident (auto-links an incident) |
  | Cancellation | Retention |
  | Upgrade | Revenue |
  | Import / data issue | Technical Support |
  | Security report | Security (marked sensitive) |

  Classification is a suggestion with its reason ("Matched 'password' → …"); a person can change the category and priority.
- **SLA.**

  | Priority | Respond | Resolve |
  |---|---|---|
  | P1 | 1 h | 8 h |
  | P2 | 4 h | 24 h |
  | P3 | 8 h | 72 h |
  | P4 | 24 h | 120 h |

  - Enterprise plans halve these times.
  - Waiting on the customer pauses the clock.
  - Breaches raise integrity findings.
  - These are clock hours. Business calendars per region are a server task (see 36).
- **Lifecycle.** received → classified → routed → assigned → investigating → waiting (customer, internal, engineering) → resolved → closed.
  - Resolving needs a resolution.
  - Closing needs a resolved ticket.
  - An outage ticket can't be resolved without an incident.
  - The ticket reopens when the customer replies.
- **Escalation** needs a reason. It raises the priority one level and co-assigns the owner's manager.
- **Email intake** (`BOS_MAIL.receive`):
  - quarantines when sender authentication (SPF, DKIM, DMARC) fails;
  - runs spam rules;
  - de-duplicates on Message-ID;
  - matches threads by `[TCK-…]` in the subject or by In-Reply-To;
  - lets a stranger's mail that quotes a ticket ID start a new ticket, never join the thread;
  - resolves the sender to an account through `bosMatch`;
  - sends an acknowledgement to the outbox (nothing is sent);
  - runs as a **system actor** that may only create and reopen tickets.

## 4. Customer Operations (IMPLEMENTED; remote workspace setup and usage are SIMULATED)

- **Hand-over on Won** (`bosHandover`) checks:
  - account;
  - primary contact;
  - plan and terms;
  - commercial owner;
  - goals;
  - implementation needs;
  - workspace.

  It records the completeness percentage and creates an onboarding record. The record goes to the Customer Operations person with the fewest open onboardings.
- **Provisioning.** The workspace is created through the one engine (`provisionTenant`, idempotency key `handover:<opp>`): one tenant, and a second click is refused.
- **Standard setup** (`bosStandardSetup`) covers the profile, role templates, approval chain, templates, the training invitation and dashboards.
  - It is checked for the workspace this page holds.
  - It is **simulated** for remote tenants and says so.
- **Milestones.** Hand-over, workspace, owner, team, roles, workflow, admin training, first job, first submission.
  - Automatic milestones come from the workspace's own data when the page holds it. They can't be ticked by hand there.
  - Manual milestones need written evidence.
- **Activation** means the owner signed in, the team was invited, a workflow was configured, the first job is live and the first candidate was submitted. Signing in alone is not activation.
- **Training.** Weekly group sessions by default; individual sessions too.
  - Each session has a capacity with a waitlist, a trainer, a time zone, and recording only when allowed.
  - Attendance can only be recorded after the session starts.
  - Attendance completes the onboarding's training milestone.
- **Health** (`bosHealth`) is transparent. Each line shows what it was based on:

  | Part | Points |
  |---|---|
  | Activation | 30 |
  | Usage | 25 |
  | Support | 20 |
  | Billing | 15 |
  | Training | 10 |

  Bands: Healthy ≥ 70, Watch ≥ 45, At risk below that. Usage for remote tenants is neutral because the prototype doesn't hold it, and it says so.
- **Renewals.** Subscriptions renewing within 90 days are listed with their readiness.
  - Customer Operations starts the renewal; the opportunity is owned by Revenue.
  - Renewals within 60 days with no owner raise a finding.

## 5. Business & Finance (IMPLEMENTED; the provider is SIMULATED)

- **Payment state** changes only from a **verified provider event**, or from Finance's manual verification (`platform-finance:verify_payment` plus a bank or provider reference, audited). The old one-click "Mark paid" now asks for the reference.
- **`BOS_PAY.receive(raw, signature)`:**
  - verifies the signature;
  - de-duplicates by event ID;
  - applies an event only if the object's version is newer (out-of-order safe);
  - flags an amount or currency mismatch;
  - records unmatched events.

  Discrepancies and unmatched events become Finance findings.
- **Refunds.**
  - Requested by Finance or Support roles, and limited to what is left to refund.
  - Approved by a Finance Manager who is not the requester.
  - Completed only by the provider's `refund.processed` event.
- **Reconciliation** (`bosReconcile`) finds paid invoices with no event or reference, duplicate invoices for one period, and refunds processed without approval.

## 6. Tenant operations (IMPLEMENTED)

- **Tenant 360** is a section added to the existing tenant page. It shows:
  - the account and customer stage;
  - the account and Customer Operations owners;
  - health and renewal;
  - open tickets and onboarding;
  - access grants.
- **Lifecycle has two dimensions.**
  - The existing operational status, with its transition rules (`TENANT_STATUS_TRANSITIONS`).
  - A customer stage computed from evidence (`bosCustomerStage`): Prospect, Trial, Onboarding, Active, Adoption, Renewal, Expansion, At risk, Suspended, Churned. It is never typed in by hand.
- **Sensitive access** (`bosRequestAccess`).
  - Metadata access: time-boxed, audited, no approval.
  - Workspace-data access: needs a ticket, the customer's recorded authorisation and an approval by someone else (Support Manager or Security Administrator).
  - All grants expire on their own (1–24 h), can be revoked and are audited. There is no impersonation.

## 7. Operational integrity (IMPLEMENTED)

Eleven deterministic rules (`BOS_RULES`), listed in the product with what each one looks at:

| Rule | Looks for |
|---|---|
| duplicate-account | Pairs of accounts with medium or strong match evidence |
| ownership-conflict | Two owners working the same account |
| unowned-lead | A lead with no owner after 24 h |
| missed-follow-up | A follow-up past its date |
| unapproved-discount | Terms outside policy without approval |
| missing-handover | A deal won without a hand-over |
| stalled-onboarding | An onboarding unowned, or with no progress for 7 days |
| unowned-renewal | A renewal within 60 days with no owner |
| ticket-sla | A breach, an unowned ticket, closure without a resolution, two or more reopens, an outage without an incident |
| finance-reconciliation | The reconciliation problems in §5 |
| access-control | Data access without approval, offboarded people still owning work, self role changes |

Each finding carries evidence, a confidence, a severity and an owner (from the right department). Its lifecycle:

1. detected
2. assigned
3. review
4. confirmed or false positive (a reason is required)
5. resolved (a resolution is required)
6. closed

A false positive isn't raised again for the same evidence. A condition that disappears is closed automatically with a note, unless a person already confirmed it. Nothing consequential happens automatically.

## 8. My Work (IMPLEMENTED)

`bosMyWork` reads the records themselves; there are no copied tasks. It covers:

- your opportunities;
- unowned leads, if you may assign them;
- your demos;
- your tickets and the unassigned tickets in your queues;
- your onboardings;
- your training sessions;
- approvals you are allowed to decide;
- integrity findings assigned to you;
- renewals on your accounts.

Each item shows its points and why it got them, for example "SLA breached +50 · P1 +25". It also shows its due date and type. The list is sorted by points, then by due date.

## 9. Product intelligence (IMPLEMENTED)

`bosProductThemes` groups feedback from:

- the affected feature and root cause on tickets;
- demo objections;
- lost reasons;
- logged feedback.

Each theme lists its evidence. One mention is a **Signal**; three or more, or two sources, make a **Pattern**. Themes reference the existing product backlog process; there is no second backlog.

## 10. Kairo, Intelligence and AI Workforce (SIMULATED and deterministic)

Kairo for operations (`bosKairo`):

- ticket classification;
- reply drafts from the approved knowledge list (`BOS_KB`), saved as drafts; it never sends or resolves;
- account summaries;
- next-step suggestions.

Each answer has a state from the shared AI vocabulary (completed, partial, needs_confirmation, failed) and the label "simulated".

Kairo acts through `bosRun` as an agent on behalf of the signed-in person, so it never has more access than they do. It is refused approvals, merges, refunds, access, role changes, payment verification and tenant suspension.

Kairo, Intelligence and AI Workforce keep their separate identities; nothing was merged into a generic chat.

## 11. GST, LUT and CA-ready reports (IMPLEMENTED; GSTIN, LUT, exchange rates and eFIRC are SAMPLES)

**Automatic tax treatment.** `bosTaxSegment` decides the tax at the moment an invoice is issued, from the customer's GSTIN (or state) and country on the account:

| Customer | Treatment |
|---|---|
| In Oontu's state | CGST 9 % + SGST 9 % |
| In another Indian state | IGST 18 % |
| Outside India, with a valid LUT | Export under LUT, zero-rated |
| Outside India, without a LUT | Export with IGST 18 % (refund claimable) |
| Location unknown | Flagged "Review"; fix before filing |

- It covers subscription invoices and Razorpay checkout from a proposal.
- Razorpay payment links collect the tax-inclusive total.

**GSTR-1 section.**

| Customer | Section |
|---|---|
| Has a GSTIN | B2B |
| Unregistered, inter-state, invoice above ₹1,00,000 | B2CL (confirm the limit with the CA) |
| Other unregistered | B2CS |
| Outside India | EXP (WOPAY) under LUT, EXP (WPAY) otherwise |
| Credit notes | CDNR or CDNUR |

**Documents.**
- One numbered series per financial year: `OON/26-27/0001`. Credit notes use `OON-CN/26-27/0001`.
- Each document stores the treatment and the reason it was chosen; documents already issued keep their tax.
- A refund processed by Razorpay creates a credit note against the original invoice.
- A paid export gets an eFIRC number (simulated).

**Exports for the CA** (Billing and payments › Tax and CA reports; `platform-finance:export`; each export is audited). By financial year, quarter or month, as CSV with a UTF-8 BOM so Excel opens it cleanly:

1. **Sales register:** every column the CA needs. GSTIN, place of supply, SAC, exchange rate, INR values, CGST / SGST / IGST, LUT, gateway payment ID, eFIRC, and the reason the tax was chosen.
2. **GSTR-1 summary** by section.
3. **Payments and gateway charges:** the estimated GST on gateway fees is input tax credit.
4. **Exports:** LUT and eFIRC.
5. **Credit notes.**

**Compliance checks.**
- An expired or missing LUT.
- A LUT ending within 45 days.
- Documents with no customer location.
- Paid exports with no eFIRC, and unpaid exports.
- Sample GSTIN and LUT details still in place.

**Settings.**
- Finance (`platform-finance:reconcile`) edits the Oontu tax profile. The state comes from the GSTIN.
- Account 360 shows and edits each customer's tax details.

**Not done.** No GST portal filing, no e-invoicing (IRN / QR for turnover above the threshold) and no live exchange rates. Confirm the SAC and edge cases with the CA.

## 12. Strict screens per role (IMPLEMENTED)

A screen is in someone's menu only if they hold its own working permission. Read-only grants used inside other screens don't add screens. Opening any other screen sends the person to their home. Home is the platform overview for platform operations and My work for everyone else.

The ten demo logins and their exact screens are in `docs/PROTOTYPE-LOGINS.md`; `tests/bos-login.spec.js` checks them.