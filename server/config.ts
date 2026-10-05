import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export const ROOT = resolve(import.meta.dirname, '..');

const envFile = resolve(ROOT, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

/** Defaults to the development database started by `npm run dev:db`. */
export const DATABASE_URL = process.env.DATABASE_URL || 'postgres://netplus:netplus@localhost:5433/netplus';
export const PORT = Number(process.env.PORT || 3001);
export const DIST = resolve(ROOT, 'dist');

/** host:port/database — never exposes the password. */
export function describeUrl(url: string) {
  const u = new URL(url);
  return `${u.hostname}:${u.port || 5432}${u.pathname}`;
}
