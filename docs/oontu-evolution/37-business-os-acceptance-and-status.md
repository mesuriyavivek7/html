# 37 · Business OS: acceptance scenarios, tests and implementation status

## 1. Test results (run on 25 Nov 2026)

| Run | Result |
|---|---|
| Baseline before the change (62 specs) | 954 passed, 1 failed. The failure was `motion.spec`, "collapse… pill on the active item": a **timing flake** that passes 8/8 when re-run alone on the same code. |
| After the change (64 specs) | **1018 passed, 0 failed.** |
| After the platform logins (65 specs, including `bos-login.spec.js` 7/7) | **1025 passed, 0 failed.** |
| After the billing engine, My team, customer Help & support and automatic invoicing (70 specs; new `bos-billing` 10/10, `bos-team-support` 12/12, `bos-autoinvoice` 9/9) | **1070 passed, 0 failed.** APS 34/34. See doc 38. |
| After tax reports, strict screens and the boot guard (66 specs; new `bos-tax.spec.js` 11/11, `bos-login.spec.js` 8/8) | 1022 passed, 0 failed. `intelligence-workspace.spec.js` timed out once in the full run (page stuck) and passed **15/15** when re-run alone: a harness flake, like `motion.spec` in the baseline. Total **1037/1037**. |
| New: `tests/bos-identity-revenue.spec.js` | 22 / 22 |
| New: `tests/bos-operations.spec.js` | 25 / 25 |
| `screens-crawl.spec.js` (every screen, every role, no render or console error) | 95 / 95 (was 87; the 8 new Oontu screens added) |
| `light.spec.js` (Design 2.0 colour and weight tokens on every screen) | 96 / 96 (was 88) |
| APS engine (`test/run-aps-tests.ps1`) | 34 / 34 |
| Changed existing test | `sidebar.spec.js` line 40: the Oontu menu headings changed on purpose, from "Customers, Product, Operations" to the five workspaces. No other assertion was changed or weakened. |
| Not available | Type-check, lint and build: the project is a single HTML file with no toolchain (no Node on this machine). Validation is the browser test suite above. |

Run everything with:

```
& .\tests\run-auth-tests.ps1 -Spec tests\<name>.spec.js
& .\test\run-aps-tests.ps1
```

## 2. Acceptance scenarios (brief §22)

Every scenario maps to an automated test: **I** = `bos-identity-revenue.spec.js`, **O** = `bos-operations.spec.js`.

| Scenario | Test | Status |
|---|---|---|
| Website inquiry creates or links the correct account | I "a website inquiry…", "an existing customer contact links…" | IMPLEMENTED |
| Lead has clear ownership | I "a website inquiry… one owner" | IMPLEMENTED |
| Incomplete sign-up can be followed up | I "an incomplete sign-up…" | IMPLEMENTED |
| Duplicate company detected without unsafe merge | I "a likely duplicate company…" | IMPLEMENTED |
| Existing customer contact links correctly | I "an existing customer contact…" | IMPLEMENTED |
| Parent and subsidiary remain distinct | I "weak evidence never merges…" | IMPLEMENTED |
| Ownership conflict detected | I "ownership conflict is detected" | IMPLEMENTED |
| Sales manages the lead and follow-up | I "sales manages the lead…" | IMPLEMENTED |
| Time-zone-aware demo scheduled | I "sales manages the lead…" (Europe/London) | IMPLEMENTED |
| Demo attendance and outcome recorded | I "sales manages the lead…" | IMPLEMENTED |
| Proposal prepared | I "a proposal uses the official price…" | IMPLEMENTED (sending SIMULATED) |
| Approved offer or discount applied | I "a proposal uses the official price…" | IMPLEMENTED |
| Restricted discount requires approval | I "a restricted discount needs approval…" | IMPLEMENTED |
| Sales can't approve its own restricted exception | I "a restricted discount…" | IMPLEMENTED |
| Won deal handed to Customer Operations | I "won needs an accepted proposal…", O "won deal → hand-over…" | IMPLEMENTED |
| Onboarding has canonical context | O "won deal → hand-over…" | IMPLEMENTED |
| Standard setup automated or safely simulated | O "won deal → hand-over…" | SIMULATED for remote tenants |
| Training scheduled | O "training…" | IMPLEMENTED |
| Group capacity and attendance tracked | O "training…" | IMPLEMENTED |
| Activation based on evidence | O "activation is based on evidence…" | IMPLEMENTED |
| Health explained with evidence | O "health is explained…" | IMPLEMENTED |
| Ticket created | O "a ticket is created…" | IMPLEMENTED |
| Email workflow creates or links a ticket | O "email intake…" | SIMULATED adapter |
| Routing works | O "routing follows the table…" | IMPLEMENTED |
| SLA assigned | O "a ticket is created…", "assignment respects queues…" | IMPLEMENTED (clock hours) |
| Ticket escalates | O "a ticket escalates…" | IMPLEMENTED |
| Ticket links account and tenant | O "a ticket is created…" | IMPLEMENTED |
| Ticket reopens | O "a ticket can't close without a resolution…" | IMPLEMENTED |
| Ticket links incident | O "an outage ticket links to an incident…" | IMPLEMENTED |
| Refund controlled | O "refund is controlled…" | IMPLEMENTED (provider SIMULATED) |
| Subscription and payment context visible | O "Platform Admin views Tenant 360…"; Account 360 screen | IMPLEMENTED |
| Payment state can't be arbitrarily changed | O "payment state can't be changed by hand…" | IMPLEMENTED |
| Provider events safely simulated | O "provider events are verified…" | SIMULATED |
| Renewal readiness monitored | O "health is explained…; renewal readiness…" | IMPLEMENTED |
| Revenue manages renewal | O same | IMPLEMENTED |
| Finance handles a reconciliation exception | O "Finance handles a reconciliation exception" | IMPLEMENTED |
| Platform Admin views Tenant 360 | O "Platform Admin views Tenant 360…" | IMPLEMENTED |
| Tenant lifecycle follows policy | O same (disallowed transition refused) | IMPLEMENTED (existing rules) |
| Sensitive access controlled and auditable | O "sensitive access is controlled…" | IMPLEMENTED |
| Employees have one identity | I "employees have one identity…" | IMPLEMENTED |
| Employee holds multiple roles | I "an employee holding several roles…" | IMPLEMENTED |
| Navigation reflects access | I "navigation reflects access…", O "every Business OS screen renders…" | IMPLEMENTED |
| Role change updates access | I "role change updates access at once" | IMPLEMENTED |
| Offboarding revokes access | I "offboarding revokes access…" | IMPLEMENTED |
| My Work aggregates canonical work | O "My Work aggregates…" | IMPLEMENTED |
| Duplicate work avoided | O "My Work… no duplicates"; I "an incomplete sign-up… same lead" | IMPLEMENTED |
| Integrity detects an exception | O "Finance handles…", I "ownership conflict…" | IMPLEMENTED |
| False-positive review possible | O "false-positive review…" | IMPLEMENTED |
| AI assists safe operation | O "safe AI: Kairo drafts…" | SIMULATED |
| AI can't bypass authorization | I "AI cannot bypass…" | IMPLEMENTED |
| Product feedback links to evidence | O "product feedback links to evidence…" | IMPLEMENTED |
| Cross-workspace consistency preserved | O "cross-workspace consistency…" | IMPLEMENTED |
| Existing features continue | Full regression: 1018/1018 | IMPLEMENTED |
| UI states usable | O "the screens…", "every Business OS screen renders…"; crawl and light specs | IMPLEMENTED |

## 3. Status by workspace

| Area | Status | Notes |
|---|---|---|
| Identity and access | IMPLEMENTED (client) | Server enforcement MISSING (36 §2). |
| Account 360 and matching | IMPLEMENTED | Registry lookups and DNS verification SIMULATED. |
| Revenue | IMPLEMENTED | Email, meeting links and payment links SIMULATED. No forecast model beyond confidence and value. |
| Service | IMPLEMENTED | Mailbox adapter SIMULATED. SLA in clock hours. No CSAT survey sending (field exists). |
| Customer Operations | IMPLEMENTED | Usage evidence real only for the workspace held in the page. |
| Business & Finance | IMPLEMENTED | Provider SIMULATED. No GST invoice documents, credits ledger or dunning. |
| Platform operations | IMPLEMENTED | Tenant 360, two-dimension lifecycle, sensitive access. |
| Integrity | IMPLEMENTED | 11 rules. |
| My Work | IMPLEMENTED | Explainable points. |
| Analytics and product intelligence | IMPLEMENTED | Small numbers from seeded data; no time-series charts. |
| Kairo / Intelligence / AI Workforce | Kairo for operations SIMULATED | No model calls; deterministic. |
| Persistence | PARTIAL | Records live in the page, like the rest of the prototype; a reload restores the seeds. |

**Accepted on 25 Nov 2026 (the user):** this stays a front-end prototype. Everything runs in the browser, so none of it is production security. Email, payments (now shaped as Razorpay), DNS checks and the setup of other workspaces are simulated. Logins for every employee are in `docs/PROTOTYPE-LOGINS.md` (`tests/bos-login.spec.js`, 7/7).

## 4. Next valuable priorities

1. **Server port** of `bosRun`, the catalog, the templates and `bosCan` (needs D-1 and the user lifting the backend pause).
2. **Platform adapter for APS.** Business-hour SLA timers and escalation ladders for platform approvals and tickets, reusing APS rather than adding a second engine.
3. **Payment provider decision** (entity structure; Razorpay plus Paddle recommended) and one real adapter in a sandbox.
4. **Mailbox integration** design (provider webhook, signature, attachment scanning).
5. **Persistence** for BOS records (the same store as the other prototype state) so demos survive a reload.
6. **CSAT and customer confirmation emails, credits ledger, GST invoice documents.**
