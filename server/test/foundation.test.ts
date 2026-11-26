// J0 foundations against a real PostgreSQL (oontu_test). Run: npm test (from server/), with dev/pg-start.ps1 running.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import pg from 'pg';
import { env } from '../src/config.ts';
import { createPool, withTx } from '../src/db.ts';
import { migrate, MIGRATIONS_DIR } from '../src/migrate.ts';
import { recordAudit, enqueue, publishPending } from '../src/events.ts';
import { createServer } from '../src/server.ts';

const OWNER = env('DATABASE_URL_TEST_OWNER'), APP = env('DATABASE_URL_TEST_APP');
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
let owner: pg.Pool, app: pg.Pool;

async function resetSchema() {
  const c = new pg.Client({ connectionString: OWNER }); await c.connect();
  try { await c.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT USAGE ON SCHEMA public TO oontu_app'); } finally { await c.end(); }
}

before(async () => { await resetSchema(); await migrate(OWNER); owner = createPool(OWNER, 4); app = createPool(APP, 4); });
after(async () => { await app?.end(); await owner?.end(); });

test('migrations apply once and are idempotent', async () => {
  const again = await migrate(OWNER);
  assert.deepEqual(again.applied, []);
  assert.ok(again.skipped.includes('0001_foundation.sql'));
});

test('a migration file changed after it was applied is refused', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'oontu-mig-'));
  try {
    copyFileSync(join(MIGRATIONS_DIR, '0001_foundation.sql'), join(dir, '0001_foundation.sql'));
    writeFileSync(join(dir, '0001_foundation.sql'), '-- edited\n', { flag: 'a' });
    await assert.rejects(migrate(OWNER, dir), /changed after it was applied/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('the API role is not the owner and cannot bypass row-level security', async () => {
  const r = await app.query("SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user");
  assert.equal(r.rows[0].rolsuper, false); assert.equal(r.rows[0].rolbypassrls, false);
  const own = await app.query("SELECT tableowner FROM pg_tables WHERE tablename = 'audit_events'");
  assert.equal(own.rows[0].tableowner, 'oontu_owner');
});

test('audit is append-only for the API: insert works, update and delete are refused', async () => {
  const id = await withTx(app, { tenantId: A, userId: 'u1' }, (db) => recordAudit(db, { plane: 'tenant', tenantId: A, actorType: 'user', actorId: 'u1', action: 'Test write' }));
  assert.ok(id > 0);
  await assert.rejects(withTx(app, { tenantId: A }, (db) => db.query("UPDATE audit_events SET action = 'x' WHERE id = $1", [id])), /permission denied/);
  await assert.rejects(withTx(app, { tenantId: A }, (db) => db.query('DELETE FROM audit_events WHERE id = $1', [id])), /permission denied/);
});

test('tenant isolation (RLS): a tenant reads only its own audit rows and cannot write another tenant’s', async () => {
  await withTx(app, { tenantId: B, userId: 'u2' }, (db) => recordAudit(db, { plane: 'tenant', tenantId: B, actorType: 'user', actorId: 'u2', action: 'B secret' }));
  const seenByA = await withTx(app, { tenantId: A }, (db) => db.query("SELECT action FROM audit_events WHERE action = 'B secret'"));
  assert.equal(seenByA.rowCount, 0, 'tenant A cannot see tenant B rows even when asking for them by value');
  const seenByB = await withTx(app, { tenantId: B }, (db) => db.query("SELECT action FROM audit_events WHERE action = 'B secret'"));
  assert.equal(seenByB.rowCount, 1);
  await assert.rejects(withTx(app, { tenantId: A }, (db) => recordAudit(db, { plane: 'tenant', tenantId: B, actorType: 'user', action: 'forged' })), /row-level security/);
  const none = await withTx(app, {}, (db) => db.query('SELECT count(*)::int AS n FROM audit_events'));
  assert.equal(none.rows[0].n, 0, 'no tenant context, no tenant rows');
});

test('platform audit needs a platform actor; tenants never see platform rows', async () => {
  await assert.rejects(withTx(app, {}, (db) => recordAudit(db, { plane: 'platform', actorType: 'system', action: 'no actor' })), /row-level security/);
  await withTx(app, { platformUserId: 'PU-001' }, (db) => recordAudit(db, { plane: 'platform', actorType: 'platform_user', actorId: 'PU-001', action: 'Tenant created' }));
  const t = await withTx(app, { tenantId: A }, (db) => db.query("SELECT 1 FROM audit_events WHERE action = 'Tenant created'"));
  assert.equal(t.rowCount, 0);
});

test('tenant context is transaction-local: it never leaks to the next request on a pooled connection', async () => {
  const single = createPool(APP, 1);
  try {
    await withTx(single, { tenantId: A }, async (db) => { const r = await db.query('SELECT app_tenant() AS t'); assert.equal(r.rows[0].t, A); });
    await withTx(single, {}, async (db) => { const r = await db.query('SELECT app_tenant() AS t'); assert.equal(r.rows[0].t, null); });
  } finally { await single.end(); }
});

test('audit and outbox commit with the change and disappear with a rollback', async () => {
  await assert.rejects(withTx(app, { tenantId: A }, async (db) => {
    await recordAudit(db, { plane: 'tenant', tenantId: A, actorType: 'user', action: 'Rolled back' });
    await enqueue(db, { tenantId: A, type: 'job.opened', payload: { jobId: 'j-rb' } });
    throw new Error('boom');
  }), /boom/);
  const left = await owner.query("SELECT (SELECT count(*) FROM audit_events WHERE action = 'Rolled back')::int AS a, (SELECT count(*) FROM outbox WHERE payload->>'jobId' = 'j-rb')::int AS o");
  assert.deepEqual(left.rows[0], { a: 0, o: 0 });
});

test('outbox: event names are entity.past_tense; a tenant cannot enqueue for another tenant', async () => {
  await assert.rejects(withTx(app, { tenantId: A }, (db) => enqueue(db, { tenantId: A, type: 'Bad Name' })), /check constraint/);
  await assert.rejects(withTx(app, { tenantId: A }, (db) => enqueue(db, { tenantId: B, type: 'job.opened' })), /row-level security/);
});

test('relay publishes each event once, retries a failing handler with the error recorded, and never republishes', async () => {
  await owner.query('DELETE FROM outbox');
  await withTx(app, { tenantId: A }, async (db) => { await enqueue(db, { tenantId: A, type: 'job.opened', payload: { n: 1 } }); await enqueue(db, { tenantId: A, type: 'job.closed', payload: { n: 2 } }); });
  const seen: string[] = [];
  let fail = true;
  const handler = async (e: { type: string }) => { if (e.type === 'job.closed' && fail) throw new Error('downstream unavailable'); seen.push(e.type); };
  const p1 = await publishPending(owner, handler);
  assert.deepEqual(p1, { published: 1, failed: 1 });
  const bad = await owner.query("SELECT attempts, last_error, published_at FROM outbox WHERE type = 'job.closed'");
  assert.equal(bad.rows[0].attempts, 1); assert.match(bad.rows[0].last_error, /downstream unavailable/); assert.equal(bad.rows[0].published_at, null);
  fail = false;
  const p2 = await publishPending(owner, handler);
  assert.deepEqual(p2, { published: 1, failed: 0 });
  const p3 = await publishPending(owner, handler);
  assert.deepEqual(p3, { published: 0, failed: 0 });
  assert.deepEqual(seen, ['job.opened', 'job.closed']);
});

test('GET /health reports the database; unknown routes are 404', async () => {
  const server = createServer(app).listen(0, 'localhost');
  await new Promise((r) => server.once('listening', r));
  try {
    const base = `http://localhost:${(server.address() as AddressInfo).port}`;
    const h = await fetch(base + '/health'); assert.equal(h.status, 200); assert.deepEqual(await h.json(), { status: 'ok', db: 'ok' });
    const n = await fetch(base + '/nope'); assert.equal(n.status, 404);
  } finally { server.close(); }
});
