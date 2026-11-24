# 16 · Security and production readiness

## 1. Existing code evidence

| Area | Evidence |
|---|---|
| Persistence | One `fetch` in the whole file (`createHttpAuthAdapter`). `localStorage` keys: workspace setup (`WS_STORE_KEY`), demo store (`STORE_KEY`), Intelligence conversations (`iqKey`), access locks (`iqAccessKey`), inbox (`ibStoreKey`), my connections (`MY_CONN_KEY`), approvals config (`AP_CFG_KEY`, `APS.config.storageKey`), remember-me email, trusted device token (`TRUST_KEY`, "a real server sets an httpOnly cookie"), UI prefs. Recruitment data is in memory; a reload resets it |
| Tenant isolation | `CURRENT_ORGANIZATION_ID` constant; `JOBS`, `CANDIDATES`, `CLIENTS`, `SUBMISSIONS` have no tenant key; `RECRUITER_ROSTER` read unfiltered in ~31 places (comment in `createTenant`) |
| Identity separation | Platform vs tenant users and roles kept apart (comments at lines ~35,210 and ~35,250); `canPlatform` checks suspension first |
| Authorisation | `canI`, `roleHasPermission`, data scope (`m04b-data-scope.spec`), `sCan`; all client-side |
| Vendor isolation | Filter functions in the same page as corporate data |
| Invitations, codes, passwords, sessions, SSO | Server rules fully specified in `docs/AUTH.md` §6; simulated |
| Audit | `logAudit` (~114 call sites), platform audit; in memory |
| Secure links | `slValid`, `slExpire`, token links in the hash fragment |
| Support access | Assisted setup needs customer permission, 24 h, logged (`jnAssist*`) |
| Tests | 52 browser specs against the prototype; server test plan in `docs/AUTH.md` §9 |

## 2. Current implementation

Security rules are designed and written down well. None are enforced, because there is no server. The prototype labels itself ("Prototype · simulated sign-in").

## 3. Production readiness

| Capability | Label | Evidence / note |
|---|---|---|
| Persistence (database) | MISSING | memory + localStorage |
| Multi-tenancy | SIMULATED | one org per page; tenant registry exists in memory |
| Tenant isolation | MISSING | no tenant keys; unfiltered rosters |
| Authentication | SIMULATED | simulator; live adapter untested |
| Authorisation | PARTIALLY IMPLEMENTED | complete client-side model; nothing server-side |
| API architecture | PROPOSED | contract for auth only (`docs/AUTH.md` §5) |
| Database model | PROPOSED | auth schema sketch (`docs/AUTH.md` §7); domain in 14 |
| Background processing | SIMULATED | browser ticks |
| Event delivery | MISSING | |
| Integrations (mail, calendar, WhatsApp, LinkedIn, boards, models) | SIMULATED | |
| File storage (resumes, documents) | MISSING | resumes parsed in-browser (`resumeReadText`, pdf.js) |
| Logging, observability | MISSING | |
| Error recovery | PARTIALLY IMPLEMENTED | UI retry/expired states exist; no server recovery |
| Backups, disaster recovery | MISSING | |
| Performance | PARTIALLY IMPLEMENTED | measured in-browser (Vistaar 11–12 s full build, Home in 1.3 s) |
| Testing | VERIFIED (prototype) | 52 specs, 7 known failures; APS unit tests |
| Security controls | PROPOSED | well specified in `docs/AUTH.md` §6 |
| AI evaluation | MISSING | |
| Deployment | MISSING | static file only; brand assets must be served beside it |

## 4. Proposed security architecture

1. **Server-enforced everything.** The screen only shows what the server allows (rule already set in the agency report). Every endpoint: session → membership → capability → permission + data scope → rule.
2. **Isolation in depth.** `tenant_id` from the session only; RLS per tenant; relationship tables with per-side policies (04); separate platform database schema with its own credentials.
3. **Separate identities.** Platform users authenticate on a separate realm with mandatory MFA and SSO; they have no tenant membership.
4. **Support access.** `SupportAccessGrant { tenantId, platformUserId, reason, ticketId, scope: metadata|read|write, approvedBy (customer admin or manager per policy), startsAt, expiresAt (max 24 h default), revokedAt }`. Every request during a grant is audited and visible to the customer's admins. No standing access. (Generalises today's assisted-setup permission.)
5. **Sensitive data.** Compensation and commercial fields behind field-level permissions (exists as `View Salary`, `Edit Salary`, `Hide Salary`), encrypted at rest for bank and tax identifiers.
6. **Sessions, MFA, SSO, invitations, codes.** Implement exactly `docs/AUTH.md` §6; MFA required for owners/admins of enterprise tenants and all platform users; SSO enforcement per domain (02).
7. **Data lifecycle.** Retention policies, export (tenant-wide JSON/CSV plus documents), deletion with dual approval and certificate; cancellation never deletes (10).
8. **Audit.** Append-only, tamper-evident (hash chain or WORM storage), separate tenant and platform streams, retained per policy, never containing codes, tokens or passwords.
9. **Secrets.** Model and integration keys in a vault (today shown masked in `PLATFORM_AI`).
10. **Compliance work items.** DPDP (India), UK GDPR, EU GDPR, US state laws, as in `docs/AUTH.md` §8; data processing agreements with customers and with model providers. No compliance claims until audited.

## 5. Data impact

`support_access_grants`, audit storage, retention tables, encrypted columns.

## 6. Permissions

`platform-support-access.request`, `.approve`; tenant `security.ApproveSupportAccess`.

## 7. Dependencies

07, 10, 12, 14.

## 8. Acceptance criteria

- Automated cross-tenant tests on every endpoint return `forbidden`.
- A platform user without a grant receives `forbidden` on every tenant content endpoint.
- A vendor session cannot read any buyer-internal table (database-level test).
- Restore from backup within the stated RTO/RPO in a drill.

## 9. Tests

`docs/AUTH.md` §9 (11 items), cross-tenant suite, RLS suite, support-access suite, penetration test before first customer, backup restore drill.

## 10. Migration risks

Treating the prototype as a client of a new API would carry its global arrays into production. Rebuild the client against the API, using the prototype as the reference.
