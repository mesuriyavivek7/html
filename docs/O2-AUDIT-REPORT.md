# O2 audit — report

_Branch `o2/overnight-2026-11-26`. Audit of everything since tag `o2-step-0a`, run after the overnight build finished. Date: 2026-11-27._

## 1. Result

- Every step has its commit and tag: `o2-step-0a` … `o2-step-9` (22 steps) and `rx-g1` … `rx-g6`. Table in §2.
- Three problems found and fixed in one commit, `f8c04ea` "O2 audit: …" (§4). Nothing else needed changing.
- No step was blocked, so there was nothing to retry.
- Full suite at the audited commit: **all switches off — FULL_OFF**; **every switch on — FULL_ON**; **saving on (0a acceptance 4) — FULL_PERSIST**.
- Tagged `o2-audited`.

## 2. Commits and tags

| Step | Tag | Commit |
| --- | --- | --- |
| 0a | o2-step-0a | fa401d6 O2 0a: persistence, switches, reset, export/import |
| 0b | o2-step-0b | 429a93f O2 0b: policy store, internal flag, MRR per currency, access level |
| 0c | o2-step-0c | df883ea O2 0c: billing customer, market rule and lock, buyer snapshot |
| 0d | o2-step-0d | a03a907 O2 0d: tax invoices are the only visible invoices; grandfathered plans |
| 1a | o2-step-1a | 62fb3b9 O2 1a: navigation per section 5, redirects, one access table |
| 1b | o2-step-1b | c9f0487 O2 1b: approvals inbox and platform bell |
| 1c | o2-step-1c | 0ca3b83 O2 1c: platform search |
| 2 | o2-step-2 | 4d647ea O2 2: Home command center |
| 3a | o2-step-3a | 261902f O2 3a: workspace lifecycle commands |
| 3b | o2-step-3b | ae9a239 O2 3b: Workspaces list and Workspace 360 |
| 4a | o2-step-4a | bdb3500 O2 4a: subscriptions on the gateway (and a 0c checkout fix) |
| 4b | o2-step-4b | ba1eec6 O2 4b: subscription statuses and enforced access |
| 4c | o2-step-4c | 5cd7668 O2 4c: billing screens |
| 4d | o2-step-4d | 3aa83d7 O2 4d: payment allocations, bank reconciliation, TDS |
| 5 | o2-step-5 | e7c5e27 O2 5: Customers (Account 360, Pipeline tabs, Reports) |
| 6 | o2-step-6 | b91b4fe O2 6: service and incidents |
| 7a | o2-step-7a | a61fb2b O2 7a: audit completeness (no behaviour change) |
| 7b | o2-step-7b | 4323588 O2 7b: MFA and step-up |
| 7c | o2-step-7c | 9b84036 O2 7c: People & access, roles, separation of duties |
| 8a | o2-step-8a | 915f568 O2 8a: feature flags and entitlements |
| 8b | o2-step-8b | 6c0ea41 O2 8b: AI agents governance |
| 9 | o2-step-9 | 91956c3 O2 9: end-to-end flows spec, removal candidates, Step 9 checks |
| G1 | rx-g1 | ac91d3e RX G1: live workflow triggers |
| G2 | rx-g2 | 5bdcfea RX G2: automation results |
| G3 | rx-g3 | 915386d (committed from your account; matches the tested tree) |
| G4 | rx-g4 | 862f8a0 RX G4: redeployment and contract-end decisions |
| G5 | rx-g5 | f8264ab RX G5: own talent first |
| G6 | rx-g6 | 6f484a5 RX G6: interview self-booking |

## 3. Acceptance lists, re-checked

Each item of the brief's acceptance lists, and the test that proves it. Every listed test passes in both full runs (§1).

| Step | Acceptance item | Proved by |
| --- | --- | --- |
| 0a | 1 deal, ticket, invoice survive a reload | o2-persistence "after a reload: the deal, ticket, invoice, setting and audit rows are back" |
| 0a | 2 Reset restores seed state exactly | o2-persistence "Reset gives exactly the seed records and ids" |
| 0a | 3 Export/Import round trip; wrong schemaVersion refused | o2-persistence "Import refuses bad files…", "Import restores exactly the exported state" |
| 0a | 4 full suite identical with saving on and off | full suite with saving on (FULL_PERSIST) vs off (FULL_OFF) |
| 0a | 5 switch panel lists 0a and later steps, off | o2-persistence "switches: 22 steps, every default off…", "the existing sign-in tools show the 22 switches…" |
| 0b | 1 MRR equals a hand calculation, three cases | o2-metrics "MRR case 1/2/3" |
| 0b | 2 INR and USD separate; internal excluded | o2-metrics "totals: INR and USD separately, never summed; internal workspaces left out" |
| 0b | 3 access-level badge per §3.2 | o2-metrics "access level matches §3.2 for every workspace state × subscription status" |
| 0b | 4 no behaviour change elsewhere | o2-metrics "switch 0b off: …nothing else changes"; full suite off |
| 0c | 1 bosTaxSegment identical on and off | o2-billing-customer "acceptance 1" |
| 0c | 2 market rule and lock; change from next renewal | o2-billing-customer "acceptance 2" |
| 0c | 3 earlier invoices keep the old address | o2-billing-customer "acceptance 3" |
| 0c | 4 billing and tax specs green | bos-tax, bos-billing, bos-autoinvoice, o2-* billing specs in both runs |
| 0d | 1 no inv-N visible | o2-invoice-view "acceptance 1"; screens-crawl |
| 0d | 2 overdue follows tax invoices | o2-invoice-view "acceptance 2" |
| 0d | 3 legacy plans labelled, not sold | o2-invoice-view "acceptance 3" |
| 0d | 4 billing specs green | both runs |
| 1a | 1 each login sees exactly its screens | o2-nav-redirect "acceptance 1"; bos-login (switch-aware) |
| 1a | 2 every old id redirects; nothing blank or denied | o2-nav-redirect "acceptance 2", "every old id redirects…" |
| 1a | 3 no access → sent home | o2-nav-redirect "acceptance 3" |
| 1b | 1 Arjun's request waits for Kavya, in Arjun's "I asked" | o2-approvals "acceptance 1"; o2-bell |
| 1b | 2 deciding from the inbox = the old place | o2-approvals "acceptance 2" |
| 1b | 3 bell items open the record; unread count right | o2-bell "acceptance 3", "unread count is right…" |
| 1c | finds ticket and invoice by id, account by name; Sales Executive scoped | o2-search "acceptance: finds…", "acceptance: a Sales Executive…" |
| 2 | 1 KPIs equal §3.8 | o2-home "acceptance 1" |
| 2 | 2 attention types; Arjun lands on My work | o2-home "acceptance 2" |
| 2 | 3 everything navigates; charts labelled | o2-home "acceptance 3" |
| 3a | 1 every §3.1 transition works, others refused | o2-workspace-lifecycle "acceptance 1a", "1b" |
| 3a | 2 one person cannot suspend | o2-workspace-lifecycle "acceptance 2" |
| 3a | 3 lifecycle events and audit rows | o2-workspace-lifecycle "acceptance 3" (+ the scheduled run is now a command, §4) |
| 3b | old Account help and tenant actions work from the new screens; badge | o2-workspace-360 "every tenant page action…", "Requests: every Account help action…" |
| 4a | every subscription change: audit row + event; no direct writes | o2-subscription-gateway "acceptance: every subscription change is a command…" |
| 4b | §3.2 rows; cancel at period end; unpaid read-only; paying clears | o2-access-level (all), o2-subscription-lifecycle "cancel at period end…" |
| 4c | every old tab action reachable; no Mark paid elsewhere | o2-billing-screens "acceptance…", "no “Mark paid” outside Invoices & payments…" |
| 4d | items 1–9 | o2-allocation tests 1–9 |
| 5 | Sign-ups actions; Account 360 on one page | o2-customers "acceptance" ×2 |
| 6 | SLA identical; outage → incident → update → announcement → resolve → review | o2-incident "acceptance" ×2 |
| 7a | one audit row per refusal; failed sign-ins logged | o2-audit (all four) |
| 7b | second step required; step-up after stepUpMinutes; existing specs pass with the helper | o2-mfa; bos-login (MFA helper) in the all-on run |
| 7c | old Employees actions; conflicting pairs warn and audit; policy edits need two signatures | o2-people, o2-sod |
| 8a | availability identical on and off; overrides expire | o2-entitlements "acceptance" ×2 |
| 8b | allow-list refusals logged; limits enforced; activity without content | o2-agents "acceptance" ×2 |
| 9 | full suite green twice; department walks; owner signs off removals | both runs (§1); o2-flows; removal list in O2-OVERNIGHT-REPORT §6 waits for your sign-off |

## 4. Diff review from `o2-step-0a`

| Check | Finding | Result |
| --- | --- | --- |
| Nothing deleted | No file deleted. The prototype HTML has **0 removed lines** since `o2-step-0a`; every change is a new block or a wrapper. | Pass |
| No assertion weakened | 24 changed lines in 13 existing specs. All are switch-aware with the old assertion kept exactly when the switch is off. One was looser than that: `auth-flow` accepted "Create tenant" **or** "Create workspace" in both states. | **Fixed** (exact label per switch state) |
| Switches default off | `O2_SWITCH` defaults to `false` for every step; `RX_SWITCH` defaults to `false` for g1–g6. Only the test runner or a saved choice turns them on. | Pass |
| bos-tax output unchanged | No tax, numbering or price function was edited or wrapped (the only new tax-named functions are display helpers `o2TaxHTML`, `o2OverdueTaxInvoices`); `bos-tax` 11/11 in both runs; 0c acceptance 1 compares `bosTaxSegment` on and off. | Pass |
| No numbering / price / tax change | As above; MRR changes only how it is shown (per currency, 0b, as specified). | Pass |
| Every data change through `bosRun` | 30 `bosRun` commands in the O2 blocks; each platform write was traced to its command. Two places wrote outside a command: (1) 3a's scheduled transitions (`o2LifecycleRun`) wrote with their own audit row and event but not as a command; (2) 0c's follow-on writes after another command (tax-detail sync, checkout link, payment link to the billing customer). | **Fixed**: (1) runs as one system command `workspace.lifecycle-run` under the billing scheduler, like 4b's renewal run; (2) runs as `billing-customer.sync`. Two spec assertions added. |
| Accepted exceptions | Switch-on backfills that create derived links once (0c `linkSubs`, 4a `o2EnsureSubItems`, 7c teams from the roster) and the 8b agent run log (a log, like audit rows). They change no business value and run when a switch turns on; making them commands would add an audit row on every page load. | Listed, not changed |
| Mock numbers labelled | Home charts without history say "illustrative"; Part B money is labelled "estimate" or "influenced"; simulated messages say "(simulated)". | Pass |

## 5. Not done / for you

- Step 9's "one person from each department walks their flows" and "owner signs off the removal list" need people; the removal candidates are listed in `docs/O2-OVERNIGHT-REPORT.md` §6, nothing was removed.
- The accepted exceptions in §4, if you want them as commands too.
