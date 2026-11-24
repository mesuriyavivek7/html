// Forward-only migrations, one transaction per file, recorded with a checksum. An applied migration whose file
// has changed is refused: fix forward with a new file instead (expand-then-contract, docs/oontu-evolution/24).
// Usage: node src/migrate.ts            (uses DATABASE_URL_OWNER)
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import pg from 'pg';
import { env } from './config.ts';

export const MIGRATIONS_DIR = fileURLToPath(new URL('../migrations/', import.meta.url));

export type MigrationResult = { applied: string[]; skipped: string[] };

export async function migrate(connectionString: string, dir: string = MIGRATIONS_DIR): Promise<MigrationResult> {
  const client = new pg.Client({ connectionString });
  await client.connect();
  const out: MigrationResult = { applied: [], skipped: [] };
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`);
    // One migrator at a time.
    await client.query('SELECT pg_advisory_lock(727001)');
    const files = readdirSync(dir).filter((f) => /^\d{4}_[a-z0-9_]+\.sql$/.test(f)).sort();
    const done = new Map<string, string>();
    for (const r of (await client.query('SELECT version, checksum FROM schema_migrations')).rows) done.set(r.version, r.checksum);
    for (const file of files) {
      const sql = readFileSync(join(dir, file), 'utf8');
      const sum = createHash('sha256').update(sql).digest('hex');
      const prev = done.get(file);
      if (prev) {
        if (prev !== sum) throw new Error(`Migration ${file} was changed after it was applied. Add a new migration instead.`);
        out.skipped.push(file);
        continue;
      }
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)', [file, sum]);
        await client.query('COMMIT');
        out.applied.push(file);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} failed and was rolled back: ${(err as Error).message}`);
      }
    }
    return out;
  } finally {
    await client.query('SELECT pg_advisory_unlock(727001)').catch(() => undefined);
    await client.end();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  migrate(env('DATABASE_URL_OWNER'))
    .then((r) => { console.log(`Applied: ${r.applied.join(', ') || 'none'}. Already applied: ${r.skipped.length}.`); })
    .catch((e) => { console.error(e.message); process.exitCode = 1; });
}
