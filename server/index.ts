// Net Plus Customer Portal — API server (Express + PostgreSQL).
//
//   npm run dev     → this server on :3001, Vite on :5173 (proxying /api), local PostgreSQL on :5433
//   npm start       → this server alone, also serving the built UI from dist/

import express, { type Request, type Response } from 'express';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { to as copyTo } from 'pg-copy-streams';
import { DATABASE_URL, DIST, PORT, describeUrl } from './config.ts';
import { pool, q } from './db.ts';
import { BadRequest, parseFilters, parseInt32, parseLens, parseSort } from './filters.ts';
import * as db from './queries.ts';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '64kb' }));

/** Maps failures to status codes the UI understands (503 = database not ready yet). */
function fail(res: Response, e: unknown) {
  const err = e as { code?: string; message?: string };
  if (e instanceof BadRequest) return res.status(400).json({ error: err.message, code: 'BAD_REQUEST' });
  if (err.code === '42P01' || err.code === '3D000') {
    return res.status(503).json({ error: 'The database has no Net Plus tables yet — run "npm run db:seed".', code: 'NOT_READY' });
  }
  if (err.code === 'ECONNREFUSED' || err.code === '57P03' || /timeout|connect/i.test(err.message ?? '')) {
    console.warn(`[api] database unavailable: ${err.code ?? ''} ${err.message}`);
    return res.status(503).json({ error: `PostgreSQL is not reachable at ${describeUrl(DATABASE_URL)}.`, code: 'NOT_READY' });
  }
  console.error('[api]', e);
  return res.status(500).json({ error: 'Internal error', code: 'INTERNAL' });
}

const handle = (fn: (req: Request) => Promise<unknown>) => async (req: Request, res: Response) => {
  const t0 = performance.now();
  try {
    const data = await fn(req);
    if (data === null) return res.status(404).json({ error: 'Not found' });
    res.json({ data, ms: performance.now() - t0 });
  } catch (e) {
    fail(res, e);
  }
};

app.get('/api/health', handle(async () => (await q<{ ok: number }>('SELECT 1 AS ok'))[0]));
app.get('/api/init', handle(() => db.init()));
app.post(
  '/api/rows',
  handle((req) =>
    db.rows(parseFilters(req.body?.filters), parseSort(req.body?.sort), parseInt32(req.body?.offset, 'offset', 10_000_000), parseInt32(req.body?.limit, 'limit', 1000)),
  ),
);
app.post('/api/summary', handle((req) => db.summary(parseFilters(req.body?.filters))));
app.post('/api/lens', handle((req) => db.lens(parseFilters(req.body?.filters), parseLens(req.body?.lens))));
app.get('/api/detail/:id', handle((req) => db.detail(parseInt32(Number(req.params.id), 'id', 2_147_483_647))));

// CSV in the source-file layout, streamed row by row from PostgreSQL.
app.post('/api/export', async (req: Request, res: Response) => {
  let client;
  try {
    const f = parseFilters(req.body?.filters);
    const s = parseSort(req.body?.sort);
    const { copySql, countSql, params } = await db.exportSql(f, s);
    const [{ n }] = await q<{ n: number }>(countSql, params);
    client = await pool.connect();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="net_plus_customers_${s.key}_${s.dir}.csv"`);
    res.setHeader('X-Row-Count', String(n));
    await pipeline(client.query(copyTo(copySql)), res);
  } catch (e) {
    if (!res.headersSent) fail(res, e);
    else res.destroy();
  } finally {
    client?.release();
  }
});

app.use('/api', (_req, res) => res.status(404).json({ error: 'Unknown endpoint' }));

// Production: serve the built UI from the same origin.
if (existsSync(DIST)) {
  app.use(express.static(DIST, { index: false, maxAge: '1h' }));
  app.use((req, res, next) => (req.method === 'GET' ? res.sendFile(resolve(DIST, 'index.html')) : next()));
}

app.listen(PORT, () => {
  console.log(`[api] http://localhost:${PORT} → PostgreSQL ${describeUrl(DATABASE_URL)}`);
  warmUp();
});

/**
 * Right after PostgreSQL starts its buffer cache is cold and the first
 * aggregates take 5–10x longer. Pre-run the default view once (retrying while
 * the database is still starting) so the first visitor gets warm timings.
 */
async function warmUp(attempt = 1): Promise<void> {
  const none = parseFilters({});
  try {
    const t0 = performance.now();
    await db.init();
    await Promise.all([
      db.summary(none),
      db.rows(none, { key: 'date', dir: 'desc' }, 0, 100),
      ...(['timeline', 'capacity', 'inverter', 'transformer', 'pole'] as const).map((k) => db.lens(none, k)),
    ]);
    console.log(`[api] warm-up done in ${Math.round(performance.now() - t0)} ms`);
  } catch {
    if (attempt < 60) setTimeout(() => warmUp(attempt + 1), 2000);
  }
}
