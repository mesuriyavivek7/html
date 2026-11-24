// Configuration from the environment. Local development reads server/.env.local (written by dev/setup-db.ps1, never committed).
// Values already set in the environment win, so CI and deployments configure the process directly.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const localEnv = fileURLToPath(new URL('../.env.local', import.meta.url));
if (existsSync(localEnv)) process.loadEnvFile(localEnv);

export function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}. Run dev/setup-db.ps1 or set it in the environment.`);
  return v;
}

export function envInt(name: string, fallback: number): number {
  const v = process.env[name];
  const n = v ? Number.parseInt(v, 10) : Number.NaN;
  return Number.isFinite(n) ? n : fallback;
}
