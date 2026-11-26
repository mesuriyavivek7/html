# 02 · Corporate authentication and tenant discovery

## 1. Existing code evidence

| Concern | Code |
|---|---|
| Auth adapters | `createAuthSimulator()` (line ~28,263, prototype), `createHttpAuthAdapter(cfg)` (line ~28,196, live contract, untested). Mode set by `window.OONTU_AUTH_CONFIG`. Contract: `docs/AUTH.md` §5 |
| Sign-in | Email first, then code (`sim.sendCode`/`verifyCode`), password (`sim.passwordSignIn`), SSO (`sim.ssoStart`, line ~28,479), Google/Microsoft (`sim.oauthStart`). Trusted device (`sim.trustDevice`, 30 days) |
| Sign-up (create workspace) | `OA` module (`.oa-*` screens); `sim.checkSignupEmail` (line ~28,697), `sim.createWorkspace` (line ~28,515), `sim.completeSetup` |
| Personal email rule | `FREE_EMAIL_DOMAINS` (line ~27,946, 14 providers), `isFreeEmailDomain` |
| Domain discovery | `EXISTING_WORKSPACES` (line ~27,948, keyed by `domain`), `corporateEmailProblem(email)` (line ~28,332) → `domain_taken` with company, masked owner, `policy` |
| Domain claim | `claimCorporateDomain(ws, owner, email)` sets `ws.domain`, `ws.verification='unverified'`; `releaseDomain` on cancel |
| Join policies | Setup step `corp-join` (line ~31,728): `request` (approve each, recommended), `auto` (join as Recruiter), `invite` (invitation only); saved to `ORG_STRUCTURE.profile.joinPolicy` |
| Join requests and recovery | `join-script` (line ~53,008): `joinRequestSend`, `jnJoinApprove`/`jnJoinDecline`, escalation to Oontu (`joinEscalate`, `JN_REASONS`), Oontu resolutions (`jnContactOwner`, `jnApproveJoin`, `jnTransferOwner`, `jnFreeDomain`, `jnAllowSeparate`), assisted setup with customer permission (`jnAssistAsk`…`jnAssistFinish`) |
| Owner override | `db.domainAllow[email]` lets Oontu admit one person past a taken domain |
| Invitations | `sim.createInvitation` (line ~28,800), `sim.acceptInvitation` (line ~28,781), owner invite `sim.acceptOwnerInvite` (line ~28,685) |
| Multiple workspaces | Account `memberships[]`; `sim.selectWorkspace` (line ~28,834); `authSelectWorkspaceNow` (line ~29,256) |
| Prototype conveniences | `teamAccount(email)` (code 123456 / `demo1234` for demo roster), `provisionDemoAccount` (unknown email on sign-in gets a demo workspace when `AUTH_OPEN_SIGNIN !== false`) |
| Tests | `auth-flow.spec.js` (88), `signup-recovery.spec.js` (11) |

## 2. Current behaviour (exact)

1. **Sign-in** asks for the work email. Default path: a 6-digit code. Password and SSO are alternatives. An SSO domain (`ws.ssoDomain`) hands over to a simulated provider.
2. **Unknown email at sign-in** → the person is taken to Create workspace with the email already proven (v2 flow: email, code, name, type, org, size, place).
3. **Corporate sign-up** checks the email before a code goes out: a personal domain → `personal_email`; a domain held by a live workspace → `domain_taken`, which tells the person who to ask and, under AR-1, offers Request to join (the owner's policy decides) or escalation to Oontu.
4. **Creating** a Corporate workspace claims the domain (`claimCorporateDomain`), marks it `unverified`, and makes the creator `owner` ("the request can't choose a role").
5. **Join policy** is one value per workspace: request, auto or invite.
6. **Invitations** are single-use, hashed, 7-day, bound to email and role; accepting is a POST, never a GET side effect (`docs/AUTH.md` §6).
7. **Multiple memberships** are supported at sign-in (workspace picker). There is no in-app switcher (`docs/AUTH.md` §10).

## 3. Prototype simulations

All of it runs in `createAuthSimulator`: codes appear in a simulated inbox, `123456` always works unless `AUTH_SKIP_OTP === false`, SSO and OAuth are faked, sessions live in browser memory, and `EXISTING_WORKSPACES` is sample data. **Nothing here is security** (`docs/AUTH.md` §2).

## 4. Limitations against global organisations

| Case | Today | Problem |
|---|---|---|
| MNC with several domains (`acme.com`, `acme.co.uk`, `acme-group.com`) | One `domain` per workspace | Second domain either looks unclaimed (anyone can start a rival workspace) or must be the same workspace with no way to say so |
| Parent and subsidiaries | One workspace, legal entities inside (Company setup, `cf-` module) | Cannot express "subsidiary with its own workspace, but under the group" |
| Acquisitions | None | Domain transfer between workspaces is only an Oontu-side `jnFreeDomain` |
| Shared domains (`gmail`-like corporate hosts, universities, government) | Blocklist of 14 free providers only | A shared corporate host would let the first registrant claim everyone |
| Contractors and consultants on other domains | Invite only | No "external member" type with its own policy |
| Different identity providers per entity | One `ssoDomain` per workspace | Cannot map domain A → IdP 1, domain B → IdP 2 |
| Ownership by email possession | Creator becomes owner on an unverified domain | The brief forbids ownership from email possession alone |

## 5. Proposed solution: three distinct controls

Keep the existing journey and copy. Change what sits behind it.

**A. Domain claim (who may represent a domain).**
- `OrganizationDomain { orgId, domain, status: unverified | pending | verified | disputed | released, method: dns_txt | email_admin | manual_review, verifiedAt, verifiedBy }`.
- Many domains per organisation. A domain belongs to at most one organisation once **verified**.
- Before verification, a claim is provisional: it lets the creator work in their own workspace, but it does not lock out colleagues. A second registrant on the same domain sees "A workspace for <company> is being set up by <masked owner>. Request to join, or ask Oontu."
- Shared-host list (`FREE_EMAIL_DOMAINS` grows into a maintained `SharedDomainPolicy` with categories: personal, education, government, hosting) can never be claimed.

**B. Organisation verification (is this a real company).**
- Separate from the domain: `Organization.verification = unverified | pending | verified | rejected`, with evidence (registry number, documents, Oontu reviewer). The prototype already holds the inputs: legal entities, GSTIN/VAT registrations, PAN checks (`company-script`, `gstinChecksumOk`).
- Some actions wait on it: publishing to the Oontu jobs website, inviting vendors from the marketplace, raising invoices.

**C. Administrator authorisation (who may administer).**
- Owner of a self-created workspace stays owner of **that workspace**. Ownership of the **organisation's verified domains** needs domain verification. Taking over an existing verified organisation always goes through Oontu (today's `jnTransferOwner`, with evidence and audit).

**Join policy becomes an organisation policy object** (extends `profile.joinPolicy`):

```
JoinPolicy {
  mode: request | auto | invite          // existing three
  allowedDomains: [domainId]             // verified domains only for auto
  defaultRoleId, defaultDepartmentId?    // today auto = Recruiter
  ssoRequired: bool                      // refuse code/password when an IdP is mapped
  externalMembers: deny | invite_only    // contractors, consultants
  approvers: roleIds                     // who decides requests
}
```

**Identity providers:** `IdentityProvider { orgId, protocol: oidc|saml, domains: [domainId], enforce, jitDefaultRoleId }`, many per organisation (replaces the single `ws.ssoDomain`).

**Group structure:** an optional `OrganizationGroup` (parent) over several organisations, each its own tenant. Group admins get a read-model view across them (deferred in Company setup: "Group workspaces + Group view" are on the agreed deferred list).

**Multiple workspaces:** keep memberships; add an in-app workspace switcher that calls `POST /auth/session/workspace` (already in the contract) and reloads the tenant context, keeping the identity.

## 6. Data impact

New: `organization_domains`, `identity_providers`, `join_policies`, `organization_groups`, `join_requests` (server-side; today join requests live inside the auth simulator, which is why APS cannot track them, per the approvals memory). Extends `organisations` from `docs/AUTH.md` §7.

## 7. Permissions

- `org.domains.manage`, `org.sso.manage`, `org.join.decide` (tenant plane).
- `platform-tenant.verify`, `platform-tenant.transfer_owner`, `platform-tenant.release_domain` (platform plane, approval required for transfer and release).

## 8. Dependencies

Core identity service (07), provisioning (10), audit (07), Super Admin Account help (08).

## 9. Acceptance criteria

- A second domain can be added and verified (DNS TXT) without creating a second workspace.
- An unverified claim never blocks a colleague from requesting to join, and never makes the creator owner of the organisation's other domains.
- An SSO-enforced domain refuses code and password sign-in server-side.
- A contractor on a foreign domain can be invited only when `externalMembers = invite_only`.
- Workspace switch keeps the user id and changes the tenant on every subsequent call.

## 10. Tests

Port `auth-flow` and `signup-recovery` to the API. Add: two domains, one organisation; disputed claim; shared host refused; SSO enforcement; external member policy; cross-tenant call after switching returns `forbidden`. The 11-item server test plan in `docs/AUTH.md` §9 stays mandatory.

## 11. Migration risks

- **Existing claims are all `unverified`.** Run a verification campaign before enforcing; until then keep today's behaviour behind a flag.
- **Auto-join on an unverified domain** would admit strangers. Allow `auto` only for verified domains (a behaviour change; needs your approval).
- `provisionDemoAccount` and `teamAccount` must never exist in live mode (they are gated by `AUTH_IS_PROTOTYPE`; keep a test that proves it).
