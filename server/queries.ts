import { escapeLiteral } from 'pg';
import type {
  Bin,
  CustomerRow,
  Detail,
  Filters,
  Hierarchy,
  InitResult,
  LensData,
  LensKey,
  MonthPoint,
  RowsResult,
  Sort,
  Summary,
} from '../src/netplus/data/types.ts';
import { DATABASE_URL, describeUrl } from './config.ts';
import { cached, q } from './db.ts';
import { buildWhere, orderBy, type Parents, type Where } from './filters.ts';

const T = 'net_plus_customers';

const ROW_COLS = `c.id, c.account_no AS account, c.transformer_code AS transformer, c.pole, c.capacity,
  c.inv_capacity AS inverter, c.net_con_start_date AS date, c.branch_id AS "branchId", c.csc_id AS "cscId",
  c.pss_id AS "pssId", c.feeder_id AS "feederId"`;

// -------------------------------------------------------------- hierarchy ---

let parents: Parents | null = null;

async function loadParents(): Promise<Parents> {
  if (parents) return parents;
  const [cscs, pss, feeders] = await Promise.all([
    q<{ csc_id: number; branch_id: number }>('SELECT csc_id, branch_id FROM cscs'),
    q<{ pss_id: number; csc_id: number }>('SELECT pss_id, csc_id FROM pss'),
    q<{ feeder_id: number; pss_id: number }>('SELECT feeder_id, pss_id FROM feeders'),
  ]);
  parents = {
    cscBranch: new Map(cscs.map((r) => [r.csc_id, r.branch_id])),
    pssCsc: new Map(pss.map((r) => [r.pss_id, r.csc_id])),
    feederPss: new Map(feeders.map((r) => [r.feeder_id, r.pss_id])),
  };
  return parents;
}

export async function where(f: Filters, startAt = 0): Promise<Where> {
  return buildWhere(f, await loadParents(), startAt);
}

export async function init(): Promise<InitResult> {
  parents = null;
  const [branches, cscs, pss, feeders, counts, [tf], [ver], [size], indexes, meta] = await Promise.all([
    q<{ id: number; name: string; prefix: string }>(
      'SELECT branch_id AS id, branch_name AS name, account_prefix AS prefix FROM branches ORDER BY branch_id',
    ),
    q<{ id: number; name: string; code: string; branchId: number }>(
      'SELECT csc_id AS id, csc_name AS name, csc_code AS code, branch_id AS "branchId" FROM cscs ORDER BY branch_id, csc_id',
    ),
    q<{ id: number; name: string; cscId: number; branchId: number }>(
      'SELECT pss_id AS id, pss_name AS name, csc_id AS "cscId", branch_id AS "branchId" FROM pss ORDER BY pss_id',
    ),
    q<{ id: number; name: string; pssId: number }>('SELECT feeder_id AS id, feeder_name AS name, pss_id AS "pssId" FROM feeders ORDER BY feeder_id'),
    q<{ b: number; c: number; p: number; f: number; n: number; kw: number }>(
      `SELECT branch_id AS b, csc_id AS c, pss_id AS p, feeder_id AS f, count(*) AS n, sum(capacity) AS kw
       FROM ${T} GROUP BY 1, 2, 3, 4`,
    ),
    q<{ n: number }>('SELECT count(*) AS n FROM transformers'),
    q<{ v: string }>("SELECT current_setting('server_version') AS v"),
    q<{ bytes: number }>('SELECT pg_database_size(current_database()) AS bytes'),
    q<{ name: string }>(`SELECT indexname AS name FROM pg_indexes WHERE tablename = '${T}' ORDER BY indexname`),
    q<{ key: string; value: string }>("SELECT key, value FROM portal_meta WHERE to_regclass('portal_meta') IS NOT NULL").catch(() => []),
  ]);

  const sum = (m: Map<number, number>, k: number, v: number) => m.set(k, (m.get(k) ?? 0) + v);
  const bc = new Map<number, number>();
  const bk = new Map<number, number>();
  const cc = new Map<number, number>();
  const pc = new Map<number, number>();
  const fc = new Map<number, number>();
  let rows = 0;
  for (const r of counts) {
    sum(bc, r.b, r.n);
    sum(bk, r.b, r.kw);
    sum(cc, r.c, r.n);
    sum(pc, r.p, r.n);
    sum(fc, r.f, r.n);
    rows += r.n;
  }
  const hierarchy: Hierarchy = {
    branches: branches.map((b) => ({ ...b, count: bc.get(b.id) ?? 0, kw: bk.get(b.id) ?? 0 })),
    cscs: cscs.map((c) => ({ ...c, count: cc.get(c.id) ?? 0 })),
    pss: pss.map((p) => ({ ...p, count: pc.get(p.id) ?? 0 })),
    feeders: feeders.map((f) => ({ ...f, count: fc.get(f.id) ?? 0 })),
    transformers: tf.n,
  };
  const m = Object.fromEntries(meta.map((r) => [r.key, r.value]));
  return {
    hierarchy,
    engine: {
      engine: `PostgreSQL ${ver.v.split(' ')[0]}`,
      database: describeUrl(DATABASE_URL),
      dbBytes: size.bytes,
      rows,
      indexes: indexes.map((i) => i.name),
      generatedAt: m.generated_at ?? '',
      source: m.source ?? 'database',
    },
  };
}

// ------------------------------------------------------------------- rows ---

export async function rows(f: Filters, s: Sort, offset: number, limit: number): Promise<RowsResult> {
  const w = await where(f);
  const n = w.params.length;
  // Deferred join: find the page's ids from the index alone, then fetch just
  // those rows — deep pages stay fast because skipped rows are never read.
  const pageSql = `
    SELECT ${ROW_COLS}
    FROM ${T} c
    JOIN (SELECT id FROM ${T} ${w.sql} ORDER BY ${orderBy(s)} LIMIT $${n + 1} OFFSET $${n + 2}) page USING (id)
    ORDER BY ${orderBy(s, 'c.')}`;
  const [total, page] = await Promise.all([
    cached(`count${w.key}`, async () => (await q<{ n: number }>(`SELECT count(*) AS n FROM ${T} ${w.sql}`, w.params))[0].n),
    q<CustomerRow>(pageSql, [...w.params, limit, offset]),
  ]);
  return { total, offset, rows: page };
}

// -------------------------------------------------------------- aggregates ---

function monthly(w: Where): Promise<MonthPoint[]> {
  return cached(`monthly${w.key}`, () =>
    q<MonthPoint>(
      `SELECT to_char(m, 'YYYYMM')::int AS ym, n AS count, kw
       FROM (SELECT date_trunc('month', net_con_start_date) AS m, count(*) AS n, sum(capacity) AS kw
             FROM ${T} ${w.sql} GROUP BY 1) t
       ORDER BY m`,
      w.params,
    ),
  );
}

export async function summary(f: Filters): Promise<Summary> {
  const w = await where(f);
  return cached(`summary${w.key}`, async () => {
    const [[k], geo, months] = await Promise.all([
      q<{ count: number; kw: number; invKw: number; oversized: number; firstDate: string | null; lastDate: string | null }>(
        `SELECT count(*) AS count, coalesce(sum(capacity), 0) AS kw, coalesce(sum(inv_capacity), 0) AS "invKw",
                count(*) FILTER (WHERE inv_capacity > capacity) AS oversized,
                min(net_con_start_date) AS "firstDate", max(net_con_start_date) AS "lastDate"
         FROM ${T} ${w.sql}`,
        w.params,
      ),
      q<{ branchId: number; cscId: number; count: number; kw: number }>(
        `SELECT branch_id AS "branchId", csc_id AS "cscId", count(*) AS count, sum(capacity) AS kw
         FROM ${T} ${w.sql} GROUP BY 1, 2`,
        w.params,
      ),
      monthly(w),
    ]);
    const byBranch = new Map<number, { branchId: number; count: number; kw: number }>();
    for (const g of geo) {
      const b = byBranch.get(g.branchId) ?? { branchId: g.branchId, count: 0, kw: 0 };
      b.count += g.count;
      b.kw += g.kw;
      byBranch.set(g.branchId, b);
    }
    return { ...k, byBranch: [...byBranch.values()].sort((a, b) => a.branchId - b.branchId), byCsc: geo, monthly: months };
  });
}

const CAP_BINS: [string, number, number | null][] = [
  ['< 3', 0, 3],
  ['3–5', 3, 5],
  ['5–10', 5, 10],
  ['10–20', 10, 20],
  ['20–40', 20, 40],
  ['40–100', 40, 100],
  ['100–500', 100, 500],
  ['500+', 500, null],
];
const TF_BINS: [string, number, number | null][] = [
  ['1', 1, 2],
  ['2–5', 2, 6],
  ['6–10', 6, 11],
  ['11–20', 11, 21],
  ['21–40', 21, 41],
  ['41+', 41, null],
];
/** CASE expression assigning each value to its [lo, hi) bin index. */
const binCase = (col: string, bins: [string, number, number | null][]) =>
  `CASE ${bins
    .slice(0, -1)
    .map(([, , hi], i) => `WHEN ${col} < ${hi} THEN ${i}`)
    .join(' ')} ELSE ${bins.length - 1} END`;

export async function lens(f: Filters, key: LensKey): Promise<LensData> {
  const w = await where(f);
  return cached(`lens:${key}${w.key}`, async (): Promise<LensData> => {
    switch (key) {
      case 'timeline':
        return { kind: 'timeline', monthly: await monthly(w) };

      case 'geo':
        return { kind: 'geo', summary: await summary(f) };

      case 'capacity': {
        const [groups, [st]] = await Promise.all([
          q<{ b: number; n: number; kw: number }>(
            `SELECT ${binCase('capacity', CAP_BINS)} AS b, count(*) AS n, sum(capacity) AS kw FROM ${T} ${w.sql} GROUP BY 1`,
            w.params,
          ),
          q<{ min: number; max: number; mean: number; median: number; p90: number; count: number; kw: number }>(
            `SELECT coalesce(min(capacity), 0) AS min, coalesce(max(capacity), 0) AS max, coalesce(avg(capacity), 0)::float8 AS mean,
                    coalesce(percentile_disc(0.5) WITHIN GROUP (ORDER BY capacity), 0) AS median,
                    coalesce(percentile_disc(0.9) WITHIN GROUP (ORDER BY capacity), 0) AS p90,
                    count(*) AS count, coalesce(sum(capacity), 0) AS kw
             FROM ${T} ${w.sql}`,
            w.params,
          ),
        ]);
        const bins: Bin[] = CAP_BINS.map(([label, lo, hi]) => ({ label, lo, hi, count: 0, kw: 0 }));
        for (const g of groups) Object.assign(bins[g.b], { count: g.n, kw: g.kw });
        return { kind: 'capacity', bins, stats: st };
      }

      case 'inverter': {
        const [ratings, [r]] = await Promise.all([
          q<{ rating: number; count: number }>(
            `SELECT inv_capacity AS rating, count(*) AS count FROM ${T} ${w.sql} GROUP BY 1 ORDER BY 2 DESC`,
            w.params,
          ),
          q<{ over: number; eq: number; r10: number; r20: number; r30: number; hi: number; cap: number; inv: number; count: number }>(
            `SELECT count(*) FILTER (WHERE inv_capacity > capacity) AS over,
                    count(*) FILTER (WHERE capacity = inv_capacity) AS eq,
                    count(*) FILTER (WHERE capacity > inv_capacity AND capacity < inv_capacity * 1.1) AS r10,
                    count(*) FILTER (WHERE capacity >= inv_capacity * 1.1 AND capacity < inv_capacity * 1.2) AS r20,
                    count(*) FILTER (WHERE capacity >= inv_capacity * 1.2 AND capacity < inv_capacity * 1.3) AS r30,
                    count(*) FILTER (WHERE capacity >= inv_capacity * 1.3) AS hi,
                    coalesce(sum(capacity), 0) AS cap, coalesce(sum(inv_capacity), 0) AS inv, count(*) AS count
             FROM ${T} ${w.sql}`,
            w.params,
          ),
        ]);
        // Eleven most common ratings in rating order, the long tail folded into "Other".
        const top = ratings.slice(0, 11).sort((a, b) => a.rating - b.rating);
        const other = ratings.slice(11).reduce((s, x) => s + x.count, 0);
        if (other) top.push({ rating: -1, count: other });
        return {
          kind: 'inverter',
          ratings: top,
          ratio: [
            { label: 'Inverter > array', count: r.over, tone: 'warn' },
            { label: '1.00', count: r.eq, tone: 'normal' },
            { label: '1.00–1.10', count: r.r10, tone: 'normal' },
            { label: '1.10–1.20', count: r.r20, tone: 'normal' },
            { label: '1.20–1.30', count: r.r30, tone: 'normal' },
            { label: '≥ 1.30', count: r.hi, tone: 'normal' },
          ],
          stats: { fleetRatio: r.inv ? r.cap / r.inv : 0, oversized: r.over, count: r.count, topRating: ratings[0]?.rating ?? null },
        };
      }

      case 'transformer': {
        const per = `SELECT transformer_code, count(*) AS n, sum(capacity) AS kw FROM ${T} ${w.sql} GROUP BY 1`;
        const [top, [st], dist] = await Promise.all([
          q<{ code: string; count: number; kw: number; branchId: number }>(
            `SELECT g.transformer_code AS code, g.n AS count, g.kw, p.branch_id AS "branchId"
             FROM (${per} ORDER BY kw DESC LIMIT 15) g
             JOIN transformers USING (transformer_code) JOIN feeders USING (feeder_id) JOIN pss p USING (pss_id)
             ORDER BY g.kw DESC`,
            w.params,
          ),
          q<{ transformers: number; avgAccounts: number; avgKw: number; maxAccounts: number; overMw: number }>(
            `SELECT count(*) AS transformers, coalesce(avg(n), 0)::float8 AS "avgAccounts", coalesce(avg(kw), 0)::float8 AS "avgKw",
                    coalesce(max(n), 0) AS "maxAccounts", count(*) FILTER (WHERE kw >= 1000) AS "overMw"
             FROM (${per}) g`,
            w.params,
          ),
          q<{ b: number; n: number; kw: number }>(
            `SELECT ${binCase('n', TF_BINS)} AS b, count(*) AS n, sum(kw) AS kw FROM (${per}) g GROUP BY 1`,
            w.params,
          ),
        ]);
        const bins: Bin[] = TF_BINS.map(([label, lo, hi]) => ({ label, lo, hi, count: 0, kw: 0 }));
        for (const d of dist) Object.assign(bins[d.b], { count: d.n, kw: d.kw });
        return { kind: 'transformer', top, dist: bins, stats: st };
      }

      case 'pole': {
        const per = `SELECT transformer_code, pole, count(*) AS n FROM ${T} ${w.sql} GROUP BY 1, 2`;
        const [dist, top, [acc]] = await Promise.all([
          q<{ k: number; poles: number }>(`SELECT least(n, 8) AS k, count(*) AS poles FROM (${per}) p GROUP BY 1`, w.params),
          q<{ transformer: string; pole: string; count: number }>(
            `SELECT transformer_code AS transformer, pole, n AS count FROM (${per}) p ORDER BY n DESC, transformer_code LIMIT 5`,
            w.params,
          ),
          q<{ n: number }>(`SELECT count(*) AS n FROM ${T} ${w.sql}`, w.params),
        ]);
        const bins = Array.from({ length: 8 }, (_, i) => ({ label: i === 7 ? '8+' : String(i + 1), n: i + 1, poles: 0 }));
        for (const d of dist) bins[d.k - 1].poles = d.poles;
        const poles = bins.reduce((s, d) => s + d.poles, 0);
        return {
          kind: 'pole',
          dist: bins,
          top,
          stats: { poles, avgPerPole: poles ? acc.n / poles : 0, crowded: bins.slice(4).reduce((s, d) => s + d.poles, 0) },
        };
      }
    }
  });
}

// ----------------------------------------------------------------- detail ---

export async function detail(id: number): Promise<Detail | null> {
  const [row] = await q<CustomerRow>(`SELECT ${ROW_COLS} FROM ${T} c WHERE c.id = $1`, [id]);
  if (!row) return null;
  const [[tf], [rank], pole] = await Promise.all([
    q<{ count: number; kw: number; maxKw: number }>(
      `SELECT count(*) AS count, sum(capacity) AS kw, max(capacity) AS "maxKw" FROM ${T} WHERE transformer_code = $1`,
      [row.transformer],
    ),
    q<{ rank: number }>(`SELECT count(*) + 1 AS rank FROM ${T} WHERE transformer_code = $1 AND capacity > $2`, [
      row.transformer,
      row.capacity,
    ]),
    q<{ id: number; account: string; capacity: number; date: string }>(
      `SELECT id, account_no AS account, capacity, net_con_start_date AS date FROM ${T}
       WHERE transformer_code = $1 AND pole = $2 ORDER BY capacity DESC, id LIMIT 12`,
      [row.transformer, row.pole],
    ),
  ]);
  return { row, transformer: { ...tf, rank: rank.rank }, pole };
}

// ----------------------------------------------------------------- export ---

/**
 * COPY … TO STDOUT streams the result straight from PostgreSQL. COPY cannot
 * take bind parameters, so the (already validated) values are inlined as
 * escaped literals.
 */
export async function exportSql(f: Filters, s: Sort): Promise<{ copySql: string; countSql: string; params: unknown[] }> {
  const w = await where(f);
  const inline = (sql: string) =>
    sql.replace(/\$(\d+)/g, (_, i) => {
      const v = w.params[Number(i) - 1];
      return typeof v === 'number' ? String(v) : escapeLiteral(String(v));
    });
  const select = `SELECT account_no AS "ACCOUNT_NO", transformer_code AS "TRANSFORMER_CODE", pole AS "POLE",
      trim_scale(capacity) AS "CAPACITY", trim_scale(inv_capacity) AS "INV_CAPACITY",
      to_char(net_con_start_date, 'MM/DD/YYYY HH24:MI:SS') AS "NET_CON_START_DATE"
    FROM ${T} ${w.sql} ORDER BY ${orderBy(s)}`;
  return {
    copySql: `COPY (${inline(select)}) TO STDOUT WITH (FORMAT csv, HEADER true)`,
    countSql: `SELECT count(*) AS n FROM ${T} ${w.sql}`,
    params: w.params,
  };
}
