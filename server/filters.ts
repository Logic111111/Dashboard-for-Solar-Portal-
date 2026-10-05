// Request validation and SQL building. Every user value becomes a bind
// parameter; ORDER BY is chosen from a fixed whitelist.

import type { Filters, LensKey, Sort, SortKey } from '../src/netplus/data/types.ts';

export class BadRequest extends Error {}

const SORT_KEYS: SortKey[] = ['account', 'transformer', 'pole', 'capacity', 'inverter', 'date', 'branch'];
const LENS_KEYS: LensKey[] = ['timeline', 'capacity', 'inverter', 'transformer', 'pole', 'geo'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const intList = (v: unknown, name: string) => {
  if (v == null) return [];
  if (!Array.isArray(v) || v.length > 200 || !v.every((x) => Number.isInteger(x) && x > 0 && x < 32768)) {
    throw new BadRequest(`${name} must be a list of ids`);
  }
  return v as number[];
};
const num = (v: unknown, name: string) => {
  if (v == null) return null;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1e6) throw new BadRequest(`${name} must be a number`);
  return v;
};
const date = (v: unknown, name: string) => {
  if (v == null) return null;
  if (typeof v !== 'string' || !DATE.test(v) || Number.isNaN(Date.parse(v))) throw new BadRequest(`${name} must be YYYY-MM-DD`);
  return v;
};

export function parseFilters(v: unknown): Filters {
  const f = (v ?? {}) as Record<string, unknown>;
  const search = typeof f.search === 'string' ? f.search.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 24) : '';
  const tf = typeof f.transformer === 'string' ? f.transformer.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 10) : '';
  return {
    branches: intList(f.branches, 'branches'),
    cscs: intList(f.cscs, 'cscs'),
    pss: intList(f.pss, 'pss'),
    feeders: intList(f.feeders, 'feeders'),
    capMin: num(f.capMin, 'capMin'),
    capMax: num(f.capMax, 'capMax'),
    invMin: num(f.invMin, 'invMin'),
    invMax: num(f.invMax, 'invMax'),
    fromDate: date(f.fromDate, 'fromDate'),
    toDate: date(f.toDate, 'toDate'),
    search,
    transformer: tf || null,
    oversized: f.oversized === true,
  };
}

export function parseSort(v: unknown): Sort {
  const s = (v ?? {}) as Record<string, unknown>;
  if (!SORT_KEYS.includes(s.key as SortKey)) throw new BadRequest('unknown sort key');
  return { key: s.key as SortKey, dir: s.dir === 'asc' ? 'asc' : 'desc' };
}

export function parseLens(v: unknown): LensKey {
  if (!LENS_KEYS.includes(v as LensKey)) throw new BadRequest('unknown lens');
  return v as LensKey;
}

export function parseInt32(v: unknown, name: string, max: number) {
  if (!Number.isInteger(v) || (v as number) < 0 || (v as number) > max) throw new BadRequest(`${name} is out of range`);
  return v as number;
}

// ------------------------------------------------------------------ WHERE ---

/** Parent links used to turn a hierarchy selection into index-friendly terms. */
export interface Parents {
  cscBranch: Map<number, number>;
  pssCsc: Map<number, number>;
  feederPss: Map<number, number>;
}

export interface Where {
  sql: string;
  params: unknown[];
  key: string;
}

export function buildWhere(f: Filters, parents: Parents, startAt = 0): Where {
  const params: unknown[] = [];
  const $ = (v: unknown) => {
    params.push(v);
    return `$${startAt + params.length}`;
  };
  const c: string[] = [];

  // Hierarchy selections are a union of nodes. Each node becomes a
  // prefix-equality term on ix_npc_geo (branch, csc, pss, feeder).
  const geo: string[] = [];
  for (const b of f.branches) geo.push(`branch_id = ${$(b)}`);
  for (const id of f.cscs) geo.push(`(branch_id = ${$(parents.cscBranch.get(id) ?? -1)} AND csc_id = ${$(id)})`);
  for (const id of f.pss) {
    const csc = parents.pssCsc.get(id) ?? -1;
    geo.push(`(branch_id = ${$(parents.cscBranch.get(csc) ?? -1)} AND csc_id = ${$(csc)} AND pss_id = ${$(id)})`);
  }
  for (const id of f.feeders) {
    const pss = parents.feederPss.get(id) ?? -1;
    const csc = parents.pssCsc.get(pss) ?? -1;
    geo.push(
      `(branch_id = ${$(parents.cscBranch.get(csc) ?? -1)} AND csc_id = ${$(csc)} AND pss_id = ${$(pss)} AND feeder_id = ${$(id)})`,
    );
  }
  if (geo.length) c.push(geo.length === 1 ? geo[0] : `(${geo.join(' OR ')})`);

  if (f.capMin != null) c.push(`capacity >= ${$(f.capMin)}`);
  if (f.capMax != null) c.push(`capacity < ${$(f.capMax)}`);
  if (f.invMin != null) c.push(`inv_capacity >= ${$(f.invMin)}`);
  if (f.invMax != null) c.push(`inv_capacity < ${$(f.invMax)}`);
  if (f.fromDate) c.push(`net_con_start_date >= ${$(f.fromDate)}::date`);
  if (f.toDate) c.push(`net_con_start_date < ${$(f.toDate)}::date + 1`);
  if (f.transformer) c.push(`transformer_code = ${$(f.transformer)}`);
  if (f.oversized) c.push('inv_capacity > capacity');
  if (f.search) {
    const p = $(`${f.search}%`);
    c.push(`(account_no LIKE ${p} OR transformer_code LIKE ${p} OR pole LIKE ${p})`);
  }

  const sql = c.length ? `WHERE ${c.join(' AND ')}` : '';
  return { sql, params, key: sql + JSON.stringify(params) };
}

// --------------------------------------------------------------- ORDER BY ---

// Column lists mirror server/sql/indexes.sql so every sort is an index walk.
const ORDER: Record<SortKey, string[]> = {
  account: ['account_no'],
  transformer: ['transformer_code', 'pole', 'capacity', 'id'],
  pole: ['pole', 'transformer_code', 'id'],
  capacity: ['capacity', 'inv_capacity', 'id'],
  inverter: ['inv_capacity', 'capacity', 'id'],
  date: ['net_con_start_date', 'id'],
  branch: ['branch_id', 'csc_id', 'pss_id', 'feeder_id', 'id'],
};

export function orderBy(s: Sort, alias = '') {
  const dir = s.dir === 'desc' ? 'DESC' : 'ASC';
  return ORDER[s.key].map((col) => `${alias}${col} ${dir}`).join(', ');
}
