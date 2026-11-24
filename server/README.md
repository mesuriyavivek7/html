# Oontu server

The production implementation of the rules in `recruitment-os-prototype.html`, built milestone by milestone as planned in `docs/oontu-evolution/21`–`23`. Stack (D-1, accepted 24 Nov 2026): TypeScript on Node.js 26 (run directly, no build step), PostgreSQL 18, `pg` as the only runtime dependency.

## Local setup (Windows, no admin rights needed)

The toolchain lives in `%LOCALAPPDATA%\oontu-dev` (Node.js 26.13.1 and PostgreSQL 18.4, from the official zips). Nothing is added to the system PATH, and there is no Windows service.

```powershell
. .\dev\env.ps1          # put node, npm and psql on PATH for this session
& .\dev\pg-start.ps1     # start PostgreSQL (localhost only)
& .\dev\setup-db.ps1     # once: roles oontu_owner / oontu_app, databases oontu / oontu_test, writes server/.env.local
cd server
npm install
npm run migrate          # apply migrations to the dev database
npm test                 # tests against oontu_test (real PostgreSQL)
npm run typecheck
npm start                # http://localhost:4000/health
```

Stop the database with `& .\dev\pg-stop.ps1`. Start it only with `pg-start.ps1`: it detaches PostgreSQL from the console (starting it from a console that later closes makes new backends fail with `0xC0000142`).

## Rules this code keeps

- The API connects as `oontu_app`: not the table owner, no `BYPASSRLS`. Row-level security applies to every query.
- Every unit of work goes through `withTx(pool, ctx, fn)`, which sets the tenant and actor for that transaction only. The tenant comes from the server-side session, never from request input.
- Every state change writes an `audit_events` row (append-only for the API) and, when others must react, an `outbox` row, in the same transaction.
- Migrations are forward-only, one transaction each, checksummed; never edit an applied migration.
- `server/.env.local` holds generated local passwords and is never committed.

## Milestones

| Milestone | Status |
|---|---|
| J0 Foundations: config, pooled transactions with tenant context, migrations, audit, outbox and relay, RLS, `/health` | Done: `test/foundation.test.ts`, 11 passing |
| J1 Identity and tenancy core | Next |
