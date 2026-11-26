// Database access (ADR-03). The API connects as oontu_app, which does not own the tables and has no BYPASSRLS,
// so PostgreSQL row-level security applies to every query. Each unit of work runs in one transaction that sets
// the tenant and actor context with set_config(..., true): transaction-local, so a pooled connection can never
// carry one request's tenant into the next request.
import pg from 'pg';

export type Ctx = {
  tenantId?: string | null;        // the tenant from the server-side session membership, never from request input
  userId?: string | null;          // tenant user acting
  platformUserId?: string | null;  // Oontu staff acting (platform realm)
};

export type Db = pg.PoolClient;

export function createPool(connectionString: string, max = 10): pg.Pool {
  return new pg.Pool({ connectionString, max });
}

export async function withTx<T>(pool: pg.Pool, ctx: Ctx, fn: (db: Db) => Promise<T>): Promise<T> {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query(
      "SELECT set_config('app.tenant_id', $1, true), set_config('app.user_id', $2, true), set_config('app.platform_user_id', $3, true)",
      [ctx.tenantId ?? '', ctx.userId ?? '', ctx.platformUserId ?? ''],
    );
    const result = await fn(db);
    await db.query('COMMIT');
    return result;
  } catch (err) {
    await db.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    db.release();
  }
}
