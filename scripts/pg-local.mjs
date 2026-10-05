// Development database: runs a real PostgreSQL server from node_modules
// (embedded-postgres), with data kept in .pgdata/. First run creates the
// cluster and loads the synthetic dataset.
//
// Skipped when DATABASE_URL points at another server (e.g. your own PostgreSQL).

import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, LOCAL_URL, databaseUrl, describeUrl } from './env.mjs';
import { seed } from './db-seed.mjs';

const url = databaseUrl();
if (url !== LOCAL_URL) {
  console.log(`[db] Using external PostgreSQL at ${describeUrl(url)} — local server not started.`);
  process.exit(0);
}

const u = new URL(url);
const dataDir = resolve(ROOT, '.pgdata');

async function tryConnect(timeoutMs = 1500) {
  const c = new pg.Client({ connectionString: url, connectionTimeoutMillis: timeoutMs });
  try {
    await c.connect();
    return c;
  } catch {
    return null;
  }
}

/**
 * After an unclean shutdown PostgreSQL replays its WAL before accepting
 * connections, and a busy machine can be slow to answer — keep trying.
 */
async function waitForConnection(maxMs = 90_000) {
  const until = Date.now() + maxMs;
  for (let attempt = 1; Date.now() < until; attempt++) {
    const c = await tryConnect(5000);
    if (c) return c;
    if (attempt === 3) console.log('[db] Waiting for PostgreSQL to accept connections…');
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`PostgreSQL did not accept connections within ${maxMs / 1000}s`);
}

async function ensureSeeded() {
  const c = await waitForConnection();
  try {
    const { rows } = await c.query("SELECT to_regclass('public.net_plus_customers') IS NOT NULL AS ok");
    const ready = rows[0].ok && (await c.query('SELECT EXISTS (SELECT 1 FROM net_plus_customers) AS ok')).rows[0].ok;
    if (ready) return;
  } finally {
    await c.end();
  }
  console.log('[db] Loading synthetic data (first run)…');
  await seed(url);
}

const existing = await tryConnect();
if (existing) {
  await existing.end();
  console.log(`[db] PostgreSQL already running at ${describeUrl(url)}`);
  await ensureSeeded();
  process.exit(0);
}

const server = new EmbeddedPostgres({
  databaseDir: dataDir,
  port: Number(u.port),
  user: decodeURIComponent(u.username),
  password: decodeURIComponent(u.password),
  persistent: true,
  initdbFlags: ['--encoding=UTF8', '--no-locale'],
  // PostgreSQL writes everything to stderr; surface only what matters.
  onLog: (m) => {
    for (const line of String(m).split(/\r?\n/)) {
      // "starting up" / "not yet accepting" are normal while clients wait for boot
      if (/starting up|not yet accepting/.test(line)) continue;
      if (/(FATAL|PANIC|ERROR):|not properly shut down|recovery in progress/.test(line)) {
        console.log(`[db] ${line.replace(/^.*?\] /, '')}`);
      }
    }
  },
  onError: (e) => {
    const msg = String(e instanceof Error ? e.message : e).trim();
    if (msg && !/^(LOG|DETAIL|HINT):/m.test(msg)) console.error(`[db] ${msg}`);
  },
});

const fresh = !existsSync(resolve(dataDir, 'PG_VERSION'));
if (fresh) {
  console.log('[db] Creating a PostgreSQL cluster in .pgdata/ …');
  await server.initialise();
}
try {
  await server.start();
} catch (e) {
  console.error(`[db] PostgreSQL failed to start: ${e.message ?? e}`);
  console.error('[db] If a previous run was killed, delete .pgdata/postmaster.pid and try again.');
  process.exit(1);
}
if (fresh) await server.createDatabase(u.pathname.slice(1));
await ensureSeeded();
console.log(`[db] PostgreSQL ready at ${describeUrl(url)}`);

const shutdown = async () => {
  console.log('[db] Stopping PostgreSQL…');
  await server.stop().catch(() => {});
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
setInterval(() => {}, 1 << 30);
