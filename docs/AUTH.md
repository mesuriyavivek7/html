# Oontu authentication

Status, architecture and the backend contract for sign-in, account activation, workspace creation, invitations, workspace selection and recovery.

## 1. What the product does

Signing in and activating an account are separate journeys.

**Signing in** (the familiar page)
- Work email and password, with a show/hide control, "Forgot password?" and "Remember me". **Continue** is the primary action.
- **Use a one-time code instead** swaps the password field for a code field on the same screen. It shows the expiry and has a resend control with a cooldown.
- **Forgot password?** is the same code path. After signing in with the code, the person lands on Settings > Password and can set a new password there. There is no separate reset screen.
- **Create an account** is for organisations that allow self-registration (`selfRegister`). Invited people never use it; they activate through their invitation link.
- Google and LinkedIn buttons appear only for providers the deployment configures. Single sign-on is not a button: after **Continue**, an organisation that uses it takes over automatically.
- There is no passkey option for now. It would add a concept people don't know and needs enrolment and recovery flows. It can come later as an optional setting.

**Activating an account** (invited people)
1. A tenant admin opens **Team members**, invites someone and picks their role. That sends an invitation email.
2. The person opens the link. A page shows the workspace, their role, who invited them and their email.
3. A first-time user enters a name and sets a password. That activates the account and signs them in. Someone who already has an Oontu account just accepts, and their password is left alone.
4. From then on they sign in normally with email and password.

## 2. Current status

This repository is a single static file, `recruitment-os-prototype.html`. It has no backend, database, auth provider, package manifest or build step. So:

| Capability | In this repo | Production-ready? |
|---|---|---|
| Sign-in, sign-up, activation, workspace choice, recovery screens, Settings > Password | Built, with loading, error, expired and retry states | UI yes |
| Flow logic: step machine, back/forward, duplicate-submit guard, return-destination checks | Built and tested | Yes |
| Team members and the setup wizard send invitations through the adapter | Built | Needs the server to send the email |
| Live adapter (`createHttpAuthAdapter`): API calls and CSRF header | Written to the contract below | **Untested: no API exists to call** |
| Passwords, codes, SSO, social sign-in, sessions, invitations, memberships | **Simulated** in prototype mode by `createAuthSimulator` | **No. Needs the auth service below** |

Prototype mode is labelled on screen (a "Prototype · simulated sign-in" caption that opens the simulated inbox and sample accounts). Nothing in it is security: all of its state lives in the browser and can be changed. It exists so every screen and state can be demonstrated and tested before the server is built.

## 3. Modes

Set at the top of the HTML file, before the app script:

```html
<script>window.OONTU_AUTH_CONFIG = { mode: 'prototype' };</script>
```

| Option | Meaning |
|---|---|
| `mode: 'prototype'` | Labelled simulator, sample records on `.example` domains, a simulated inbox. |
| `mode: 'live'` + `apiBase` | Calls the auth API at `apiBase` (must be `https://…` or a same-origin path such as `/api`). |
| `mode: 'live'` without a valid `apiBase` | Shows "Sign-in isn't available" with a developer note. Nobody gets in. |
| `selfRegister: false` | Hides **Create an account**. Default is on. |
| `sso: false` | Stops the single sign-on check after **Continue**. Turn it off until the server supports it, otherwise every sign-in waits on a missing endpoint. |
| `oauth: ['google','linkedin']` | Shows those social buttons. Prototype mode shows both; live mode shows **none** until listed, so a button is never decorative. |
| `links: { terms, privacy }` | `https://` URLs for the terms and privacy notice links. |

Never put secrets in this config; the HTML is public.

## 4. Architecture

Keep three layers separate:

1. **Authentication**: proves who someone is. Passwords, email codes, SSO (OIDC/SAML), social sign-in, sessions and recovery. Use established libraries; don't hand-roll crypto.
2. **Identity and access**: users, organisations (workspaces), memberships, roles, invitations, workspace selection, audit events. Every recruitment query is scoped by the organisation of the **server-side** session membership, never by an ID the browser sends.
3. **Recruitment application**: jobs, candidates, submissions, interviews, decisions. It reads the current user and organisation from the session only.

### Backend decision needed

No stack exists yet, so this is your call:

- **Self-hosted**: your API framework, an Argon2id or bcrypt library, a transactional email provider and an OIDC client. SAML usually needs a separate library or service. Most control; most work.
- **Managed identity provider** with passwords, email codes and enterprise SSO built in. Less to build and audit, but a paid dependency and a vendor data processor. Check data residency for India, the UK and the US.

Either way, the browser contract below stays the same.

## 5. API contract (what the live adapter calls)

All requests use `credentials: 'include'`. Every non-GET request sends `X-CSRF-Token` with the value of the `oontu_csrf` cookie (double-submit). Responses are JSON. Errors look like `{ "error": "<code>" }`, with `Retry-After` on 429. Successful sign-ins also return `method` (`password`, `email_code`, `oauth_*`, `sso`, `invitation`) so Settings knows whether a password change needs the current password.

| Method & path | Body | Success | Error codes |
|---|---|---|---|
| `GET /auth/session` | none | `{ authenticated, user?, workspaces?, activeWorkspaceId? }` | none |
| `POST /auth/password/sign-in` | `{ email, password, remember }` | `{ status, method, user, workspaces }` + session cookie (persistent when `remember`) | `invalid_credentials` (same for unknown accounts), `signin_locked` (+`retryAfterSec`) |
| `POST /auth/email/start` | `{ email, intent }` | `{ codeLength, expiresInSec, resendInSec }`, **identical for known and unknown emails** | `invalid_email`, `resend_cooldown`, `rate_limited` |
| `POST /auth/email/verify` | `{ email, code }` | `{ status: 'signed_in'\|'new_user', method, user, workspaces }` + session cookie | `invalid_code` (+`attemptsLeft`), `expired_code`, `too_many_attempts` |
| `POST /auth/sso/start` | `{ email, returnTo }` | `{ redirectUrl }` (https only). Called after **Continue**: `sso_unavailable` means "no SSO for this email" and the app carries on | `sso_unavailable`, `invalid_email` |
| `POST /auth/oauth/start` | `{ provider: 'google'\|'linkedin', returnTo }` | `{ redirectUrl }` (https only) | `oauth_unavailable` |
| `POST /workspaces` | `{ name, workspaceName, password }` | `{ workspace, role:'owner', roleLabel, method, user }` | `unauthenticated`, `invalid_input` (+`field`), `password_*` (+`field:'password'`) |
| `GET /invitations/:token` | none | `{ invitation: { orgName, role, roleLabel, inviterName, email, expiresAt, isNewUser } }` | `invite_invalid`, `invite_expired`, `invite_revoked`, `invite_used` |
| `POST /invitations/:token/accept` | `{ name?, password? }` (both required when `isNewUser`) | `{ workspace, role, roleLabel, method:'invitation', user }` + session cookie. **No prior session needed** | the invite errors, `name_required`, `password_*` |
| `POST /invitations` | `{ email, name, role }` | `{}`. Sends the email. Admins and owners only | `unauthenticated`, `forbidden`, `invalid_email`, `invalid_input` |
| `POST /account/password` | `{ currentPassword?, newPassword }` | `{}` | `unauthenticated`, `wrong_current_password`, `password_*` |
| `POST /auth/session/workspace` | `{ workspaceId }` | `{ workspace, role, roleLabel, method, user }` | `unauthenticated`, `forbidden` |
| `POST /auth/sign-out` | `{}` | `{}`, session revoked and cookie cleared | none |

Password error codes: `password_short`, `password_long`, `password_common`, `password_email`.

After SSO or social sign-in, the server redirects back to the app at `#/auth/sso?result=ok|cancelled|failed` or `#/auth/oauth?result=…`. The app never trusts that value; it calls `GET /auth/session`. Invitation links look like `https://app.example.com/#/invite/<token>`. Keeping the token in the fragment keeps it out of server logs and `Referer` headers.

## 6. Server rules the prototype imitates (and the server must enforce)

**Passwords**
- Store only a slow salted hash (Argon2id, or bcrypt if that is what you have). Never log, return or email a password.
- Length over complexity: at least 10 characters, at most 128, no composition rules. Reject common passwords and ones containing the person's email name. Check against a breached-password list if you can.
- Rate-limit sign-in per account and per IP. The simulator locks password sign-in for an account for 15 minutes after 5 failures and says so; a one-time code still works. Return the same `invalid_credentials` for a wrong password and an unknown account.
- On a password change, end the account's other sessions.

**Remember me**
- Ticked: a persistent session cookie (the simulator uses 30 days idle). Unticked: an ordinary session (about 8 hours idle). The browser also pre-fills the email next time. Only the email is stored, never the password.

**Email codes**
- Six digits from a CSPRNG. Store only an HMAC of the code; never log it or return it in a response.
- 10-minute expiry, single use, one active code per email (a new code invalidates the old one). Maximum 5 wrong attempts, then the code is burned.
- 30-second resend cooldown and at most 5 sends per 15 minutes per email. Also rate-limit per IP and add bot protection on `/auth/email/start` if abuse appears.
- Same response and similar timing whether or not the account exists.
- Forgot password is this same path, so it needs no reset email or token of its own.

**SSO**
- OIDC with PKCE, `state` and `nonce`. SAML via a maintained library or provider.
- Per-organisation configuration, verified domains, and a default role for just-in-time members.
- If an organisation enforces SSO, refuse password and email-code sign-in for its domain. Oontu never sees SSO passwords.

**Social sign-in (Google, LinkedIn)**
- OIDC authorization-code flow with PKCE, `state` and `nonce`; the server exchanges the code and the browser never sees tokens.
- Accept the identity **only if the provider marks the email as verified**. Never link to an existing Oontu account on an unverified email (account takeover).
- Request only name and email scopes. A new person is sent to workspace creation, never given a workspace or role.

**Sessions**
- `__Host-oontu_session` cookie: HttpOnly, Secure, SameSite=Lax, Path=/. Server-side session store.
- Rotate the session ID on every sign-in (prevents fixation). Absolute timeout of about 30 days.
- Revoke on sign-out. A double-submit CSRF token protects state-changing requests.

**Invitations and activation**
- 32+ random bytes, stored hashed, expiring after 7 days, single use, bound to one email and to a role chosen by an authorised inviter.
- Only an owner or admin of the workspace in the session may create one. Sending again withdraws the earlier link for that person. Nobody is invited as owner.
- **The link is the email verification.** It reaches only the invited inbox, so a first-time user who sets a password has proved the address. Accepting creates the account, adds the membership with the invited role and starts a new session. There is no code step.
- Acceptance is a deliberate button press (`POST`), never a side effect of opening the link, so email scanners that pre-fetch links can't spend the invitation.
- Identity, role and organisation come only from the invitation row. **Ignore any email, role or organisation ID in the request.** An existing account's password is never changed by an invitation.
- Treat the link like a password-reset link: HTTPS only, short expiry, single use, token kept out of logs, audit event on accept. For an existing account the link is as strong as the email-code sign-in, so an organisation that enforces SSO for its members should refuse the link-only path for them.

**Authorisation**
- The membership row decides the role. Check permissions on every request.
- Scope every query by organisation (consider row-level security). Return `forbidden` for non-members.

**Audit**
- Record sign-in, sign-out, failed sign-in, lockout, password change, invitation sent/accepted/revoked, role change and workspace creation, with time, actor and IP.
- Never record codes, tokens, cookies or passwords.

## 7. Proposed data model (PostgreSQL, not yet a migration)

```sql
create table users (id uuid primary key, email citext unique not null, name text, password_hash text, email_verified_at timestamptz, created_at timestamptz not null default now());
create table organisations (id uuid primary key, name text not null, created_by uuid references users, created_at timestamptz not null default now());
create table memberships (user_id uuid references users, organisation_id uuid references organisations, role text not null check (role in ('owner','admin','manager','recruiter','hiring_manager')), created_at timestamptz not null default now(), primary key (user_id, organisation_id));
create table invitations (id uuid primary key, organisation_id uuid not null references organisations, email citext not null, role text not null, token_hash bytea unique not null, invited_by uuid references users, expires_at timestamptz not null, accepted_at timestamptz, revoked_at timestamptz);
create table email_challenges (id uuid primary key, email citext not null, code_hmac bytea not null, expires_at timestamptz not null, attempts int not null default 0, consumed_at timestamptz);
create table login_failures (email citext not null, at timestamptz not null default now());
create table sso_connections (id uuid primary key, organisation_id uuid not null references organisations, protocol text not null, domain citext not null, config jsonb not null, enforce boolean not null default false, default_role text not null default 'recruiter');
create table sessions (id_hash bytea primary key, user_id uuid not null references users, active_organisation_id uuid references organisations, method text not null, remember boolean not null default false, created_at timestamptz not null, last_seen_at timestamptz not null, expires_at timestamptz not null, revoked_at timestamptz);
create table audit_events (id bigserial primary key, organisation_id uuid, actor_user_id uuid, event text not null, ip inet, created_at timestamptz not null default now(), detail jsonb);
```

Run it through your migration tool once the stack is chosen. Set retention for `email_challenges` and `login_failures` (hours), `sessions` (after expiry) and `audit_events` (per policy). A `passkeys` table is deliberately absent until passkeys are added.

## 8. Privacy and compliance: items for legal review

These controls support compliance work, but **they do not make Oontu compliant or certified**. Each item below needs review by counsel or your compliance owner:

- **India: DPDP Act 2023 and the DPDP Rules.** Confirm which provisions are in force on your launch date. Covers notice content and language, consent for any optional data, grievance contact, breach notification, and data processor contracts.
- **UK: UK GDPR, Data Protection Act 2018 and the Data (Use and Access) Act 2025.** Covers lawful basis for account data, the privacy notice, international transfer mechanisms, and records of processing.
- **US: state privacy laws** (California CCPA/CPRA and others) and FTC Act section 5 on security claims. Covers state breach-notification laws, and notices for California residents if applicable.
- **Data minimisation.** Sign-up collects only email, name, workspace name and a password. Company size, phone and organisation type moved to the post-sign-up setup. Keep it that way, or document why more is needed.
- **Browser storage.** "Remember me" stores the email address in this browser's local storage. Decide whether your cookie and storage notice needs to mention it.
- **Recruitment-specific.** Candidate data is processed on behalf of customers, so a data processing agreement is needed with each customer.
- **Marketing claims.** Don't state SOC 2, ISO 27001 or "GDPR compliant" until audits or legal sign-off exist.
- **Ownership.** Terms and privacy notice URLs, the session cookie notice (it is strictly necessary), and the retention schedule all need an owner.

## 9. Tests

Run the suite with:

```
powershell -ExecutionPolicy Bypass -File tests\run-auth-tests.ps1
```

This needs Chrome or Edge. It injects `tests/auth-flow.spec.js` into a temporary copy of the page, runs it headless, and prints PASS/FAIL per test.

It covers screens, flow logic and adapter rules against the **simulator**. Before launch, run the same scenarios against the real API (server test plan):

1. Password hashing, the 10-character minimum, common-password rejection, and identical responses for a wrong password and an unknown account.
2. Lockout after repeated failures and its expiry, and that a code still works while locked.
3. Code expiry, single use, attempt limit, cooldown and per-email/per-IP limits.
4. Session cookie flags, rotation, idle and absolute expiry, remember-me lifetime, and revocation on sign-out and on password change.
5. CSRF rejection without a token.
6. OIDC `state`/`nonce` mismatch, a cancelled login, and an unverified provider email.
7. Invitation reuse, expiry, revocation, link-scanner prefetch (a `GET` must not consume it), and email, role or organisation tampering in the accept request.
8. Invitation creation by a non-admin, by a signed-out caller, and with role `owner`.
9. Cross-organisation access to every recruitment endpoint.
10. Open-redirect attempts on `returnTo` and SSO return URLs.

## 10. Known limitations and next steps

- The live adapter has not run against a server. Its redirect and cookie code paths are untested.
- No email is sent from this repo. Invitation and code emails need the server and a mail provider, and the invitation email template still has to be written.
- Passkeys are deferred. Next: an optional "Add a passkey" setting after sign-in, with a recovery path.
- No organisation switcher inside the app. A multi-workspace user picks a workspace at sign-in; switching later means signing out.
- Invitations sent from Team members map the workspace role (for example "Recruitment Manager") to one of five account roles. The permission model in the prototype is richer, so the server needs a matching role table.
- The recruitment data in this prototype is shared demo data. Real tenant isolation needs the backend.
