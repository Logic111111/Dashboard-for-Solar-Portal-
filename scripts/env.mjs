// Shared configuration for the database scripts (the API has its own copy in server/config.ts).
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const envFile = resolve(ROOT, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

/** The bundled development database started by `npm run dev:db`. */
export const LOCAL_URL = 'postgres://netplus:netplus@localhost:5433/netplus';

export const databaseUrl = () => process.env.DATABASE_URL || LOCAL_URL;

/** host:port/database — never prints the password. */
export function describeUrl(url) {
  const u = new URL(url);
  return `${u.hostname}:${u.port || 5432}${u.pathname}`;
}
