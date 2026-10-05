import pg from 'pg';
import { DATABASE_URL } from './config.ts';

// Return plain JS values: numeric → number, bigint (count) → number,
// timestamp → 'YYYY-MM-DD HH:MM:SS' string exactly as stored (no timezone shift).
pg.types.setTypeParser(pg.types.builtins.NUMERIC, parseFloat);
pg.types.setTypeParser(pg.types.builtins.INT8, Number);
pg.types.setTypeParser(pg.types.builtins.TIMESTAMP, (v) => v);

export const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 3000,
  // ISO output for timestamps and a safety net against runaway queries
  options: '-c datestyle=ISO,YMD -c statement_timeout=20000',
});

export async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const res = await pool.query(sql, params);
  return res.rows as T[];
}

/** Small TTL cache for aggregates: identical filter requests within a minute skip the database. */
const cache = new Map<string, { at: number; value: Promise<unknown> }>();
const TTL_MS = 60_000;

export function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as Promise<T>;
  const value = fn().catch((e) => {
    cache.delete(key);
    throw e;
  });
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 300) cache.delete(cache.keys().next().value!);
  return value;
}

export const clearCache = () => cache.clear();
