# Prototype logins

**Prototype only.** These are fictional demo accounts that live inside the page. They are not real credentials, and they must never be used in a real deployment.

Open `recruitment-os-prototype.html`. On the sign-in screen, either:

- choose **Sign in with password** and type the email and password; or
- type the email, press **Continue**, and enter the code **123456**.

Under the demo note on the first sign-in screen, open **"Oontu platform logins"** and click a name. It fills in the email; then type the password.

## Oontu platform (internal Business OS)

Password for every employee: **demo1234**. The email code also works: **123456**.

| Name | Email (user ID) | Role(s) | Opens on | Screens in their menu (nothing else) |
|---|---|---|---|---|
| Meera Krishnan | meera@oontu.internal | Oontu Super Admin | Platform overview | Everything |
| Arjun Rao | arjun@oontu.internal | Sales Executive | My work | My work, Pipeline (own deals), Accounts, Incomplete sign-ups |
| Kavya Iyer | kavya@oontu.internal | Sales Manager | My work | + Insights; approves discounts up to 25 % |
| Leela Fernandes | leela@oontu.internal | Revenue Manager | My work | My work, Pipeline, Accounts, Incomplete sign-ups, Billing and payments (approvals), Integrity, Insights |
| Rohan Das | rohan@oontu.internal | Support Agent | My work | My work, Tickets (Support and Technical queues), Accounts |
| Nisha Pillai | nisha@oontu.internal | Support Manager | My work | My work, Tickets, Accounts, Integrity, Insights |
| Aditi Menon | aditi@oontu.internal | Implementation Specialist + Trainer | My work | My work, Onboarding and success, Tickets, Accounts, Tenants |
| Sana Qureshi | sana@oontu.internal | Customer Success Manager | My work | My work, Onboarding and success, Pipeline (renewals), Accounts, Incomplete sign-ups, Tenants, Integrity, Insights |
| Vikram Shah | vikram@oontu.internal | Finance Manager | My work | My work, Billing and payments (incl. Tax and CA reports), Subscriptions, Plans, Tickets (Billing queue), Accounts, Integrity, Insights |
| Ishaan Verma | ishaan@oontu.internal | Commercial Operator | My work | My work, Billing and payments (raises invoices, shares links), Subscriptions, Accounts |
| Dev Patel | dev@oontu.internal | Security Administrator | My work | My work, Employees and access, Audit log, Integrity, Insights |

Kavya, Nisha, Sana, Vikram and Meera also have **My team**, because people report to them.

The rule: a screen is in someone's menu only if they do that work. That means holding the screen's own working permission, not an incidental read-only one. Opening any other screen sends them back to their home. Each action still checks again. `tests/bos-login.spec.js` pins these exact lists.
Notes:

- Roles are read from the employee record at sign-in. Change them in **Employees and access** and the next sign-in follows the change.
- Invited, suspended and offboarded employees can't sign in.
- An employee you invite in Employees and access can sign in with **demo1234** once you mark them activated.
- Anyone without dashboard access lands on **My work**.
- Employees and access › "View as (prototype)" switches between these people without signing out.

## Customer workspaces (the recruitment product)

In any customer workspace: **Settings › Help & support** has the knowledge centre, tickets and the support plan. **Settings › Plan & billing** has the checkout (simulated Razorpay) and invoices.


| Email | Password | Opens as |
|---|---|---|
| alex@northstar.example | Prototype#2026 | Admin, Northstar Talent Partners |
| sam@harbor.example | Prototype#2026 | Two workspaces (Recruiter / Recruitment manager): pick one |
| lee@acme.example | (single sign-on) | Hiring manager at Acme Corp, via simulated SSO |
| test@incomplete.com | Prototype#2026 | Owner of a workspace whose setup is unfinished |
| Any team member's email in the open workspace (Team members) | demo1234 | That person, with their own role |
| Any other email, signed in with the code 123456 | — | Owner of a new, complete demo workspace |

## O2 build switches (2026-11-27)

The O2 platform rebuild (`docs/O2-BUILD-BRIEF.md`) sits behind one switch per step, all **off** by default. Turn them on in the sign-in screen's **Prototype · simulated sign-in** tools › **O2 build** › Build steps. A switch changes which screens and code paths run, never the data.

- **1a on:** the Oontu menu becomes Home · Work · Customers · Service · Billing · Admin. The per-login lists before and after are in `docs/O2-OVERNIGHT-REPORT.md` §5. Home is for platform operations (Meera); everyone else opens on My work.
- **1b on:** every employee has **Approvals** (their own requests and decisions; deciding still needs the approving permission).
- **7b on:** after the password or email code, Oontu employees enter a second-step code: **246810** (shown in the prototype tools). High-risk actions ask for it again after 15 minutes.
- **3a:** only the Super Admin holds the permission that approves a workspace suspension in the seeds, so suspensions requested by Meera wait for a second person who does not exist yet (see Recommended next in the report).
- Saved demo data (0a) can be exported, imported and reset from the same tools.
