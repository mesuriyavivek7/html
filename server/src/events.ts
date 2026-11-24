// Audit and outbox (ADR-08). Both are written with the same database client as the change they describe,
// inside the caller's transaction, so they exist if and only if the change committed.
import type pg from 'pg';
import type { Db } from './db.ts';

export type AuditEvent = {
  plane: 'tenant' | 'platform';
  tenantId?: string | null;
  actorType: 'user' | 'platform_user' | 'system' | 'agent' | 'link';
  actorId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
};

export async function recordAudit(db: Db, e: AuditEvent): Promise<number> {
  const r = await db.query(
    `INSERT INTO audit_events (plane, tenant_id, actor_type, actor_id, action, entity_type, entity_id, before, after, reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
    [e.plane, e.tenantId ?? null, e.actorType, e.actorId ?? null, e.action, e.entityType ?? null, e.entityId ?? null,
     e.before === undefined ? null : JSON.stringify(e.before), e.after === undefined ? null : JSON.stringify(e.after), e.reason ?? null],
  );
  return Number(r.rows[0].id);
}

export type OutboxEvent = { tenantId?: string | null; type: string; payload?: Record<string, unknown> };

export async function enqueue(db: Db, e: OutboxEvent): Promise<string> {
  const r = await db.query('INSERT INTO outbox (tenant_id, type, payload) VALUES ($1, $2, $3) RETURNING id',
    [e.tenantId ?? null, e.type, JSON.stringify(e.payload ?? {})]);
  return r.rows[0].id as string;
}

export type PublishedEvent = { id: string; tenantId: string | null; type: string; payload: Record<string, unknown>; attempts: number };

// The relay runs as the table owner (outside RLS) because it serves every tenant. It claims rows with
// SKIP LOCKED so two relays never publish the same event, marks them published only after the handler
// succeeds, and records the error and attempt count otherwise (the row is retried on the next pass).
// Handlers must be idempotent: delivery is at least once.
export async function publishPending(ownerPool: pg.Pool, handler: (e: PublishedEvent) => Promise<void>,
  opts: { batch?: number; maxAttempts?: number } = {}): Promise<{ published: number; failed: number }> {
  const client = await ownerPool.connect();
  let published = 0, failed = 0;
  try {
    await client.query('BEGIN');
    const rows = (await client.query(
      `SELECT id, tenant_id, type, payload, attempts FROM outbox
       WHERE published_at IS NULL AND attempts < $2
       ORDER BY created_at LIMIT $1 FOR UPDATE SKIP LOCKED`, [opts.batch ?? 100, opts.maxAttempts ?? 10])).rows;
    for (const r of rows) {
      try {
        await handler({ id: r.id, tenantId: r.tenant_id, type: r.type, payload: r.payload, attempts: r.attempts });
        await client.query('UPDATE outbox SET published_at = now(), attempts = attempts + 1, last_error = NULL WHERE id = $1', [r.id]);
        published++;
      } catch (err) {
        await client.query('UPDATE outbox SET attempts = attempts + 1, last_error = $2 WHERE id = $1', [r.id, String((err as Error).message).slice(0, 1000)]);
        failed++;
      }
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
  return { published, failed };
}
