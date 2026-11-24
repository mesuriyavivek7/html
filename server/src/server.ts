// HTTP entry point. J0 exposes only GET /health; later milestones add the APIs in docs/oontu-evolution/23.
// Node's own http module is enough until routing needs grow (no framework dependency yet).
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import type pg from 'pg';
import { env, envInt } from './config.ts';
import { createPool } from './db.ts';

export function createServer(appPool: pg.Pool): http.Server {
  return http.createServer(async (req, res) => {
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      res.end(JSON.stringify(body));
    };
    try {
      if (req.method === 'GET' && req.url === '/health') {
        try {
          await appPool.query('SELECT 1');
          return send(200, { status: 'ok', db: 'ok' });
        } catch {
          return send(503, { status: 'degraded', db: 'unavailable' });   // no internal detail leaves the server
        }
      }
      return send(404, { error: 'not_found' });
    } catch {
      return send(500, { error: 'internal' });
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const pool = createPool(env('DATABASE_URL_APP'));
  const port = envInt('PORT', 4000);
  createServer(pool).listen(port, 'localhost', () => console.log(`Oontu server listening on http://localhost:${port}`));
}
