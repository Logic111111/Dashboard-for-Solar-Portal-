// Shared contract between the React UI and the API server (server/index.ts).
// Each Request type maps to one endpoint that runs parameterized PostgreSQL.

export type SortKey = 'account' | 'transformer' | 'pole' | 'capacity' | 'inverter' | 'date' | 'branch';
export type SortDir = 'asc' | 'desc';
export interface Sort {
  key: SortKey;
  dir: SortDir;
}

export interface Filters {
  branches: number[];
  cscs: number[];
  pss: number[];
  feeders: number[];
  capMin: number | null;
  capMax: number | null;
  invMin: number | null;
  invMax: number | null;
  /** inclusive connection-date bounds, 'YYYY-MM-DD' */
  fromDate: string | null;
  toDate: string | null;
  /** prefix match on account, transformer or pole */
  search: string;
  transformer: string | null;
  /** inverter rated above the array capacity */
  oversized: boolean;
}

export const EMPTY_FILTERS: Filters = {
  branches: [],
  cscs: [],
  pss: [],
  feeders: [],
  capMin: null,
  capMax: null,
  invMin: null,
  invMax: null,
  fromDate: null,
  toDate: null,
  search: '',
  transformer: null,
  oversized: false,
};

export interface CustomerRow {
  id: number;
  account: string;
  transformer: string;
  pole: string;
  capacity: number;
  inverter: number;
  /** ISO 'YYYY-MM-DD HH:MM:SS' */
  date: string;
  branchId: number;
  cscId: number;
  pssId: number;
  feederId: number;
}

export interface BranchNode {
  id: number;
  name: string;
  prefix: string;
  count: number;
  kw: number;
}
export interface CscNode {
  id: number;
  name: string;
  code: string;
  branchId: number;
  count: number;
}
export interface PssNode {
  id: number;
  name: string;
  cscId: number;
  branchId: number;
  count: number;
}
export interface FeederNode {
  id: number;
  name: string;
  pssId: number;
  count: number;
}
export interface Hierarchy {
  branches: BranchNode[];
  cscs: CscNode[];
  pss: PssNode[];
  feeders: FeederNode[];
  transformers: number;
}

export interface EngineInfo {
  /** e.g. 'PostgreSQL 18.4' */
  engine: string;
  /** host:port/database (no credentials) */
  database: string;
  dbBytes: number;
  rows: number;
  indexes: string[];
  generatedAt: string;
  source: string;
}

export interface InitResult {
  engine: EngineInfo;
  hierarchy: Hierarchy;
}

export interface MonthPoint {
  ym: number;
  count: number;
  kw: number;
}

export interface Summary {
  count: number;
  kw: number;
  invKw: number;
  oversized: number;
  firstDate: string | null;
  lastDate: string | null;
  byBranch: { branchId: number; count: number; kw: number }[];
  byCsc: { cscId: number; branchId: number; count: number; kw: number }[];
  monthly: MonthPoint[];
}

export interface RowsResult {
  total: number;
  offset: number;
  rows: CustomerRow[];
}

export type LensKey = 'timeline' | 'capacity' | 'inverter' | 'transformer' | 'pole' | 'geo';

export interface Bin {
  label: string;
  lo: number;
  hi: number | null;
  count: number;
  kw: number;
}

export type LensData =
  | { kind: 'timeline'; monthly: MonthPoint[] }
  | {
      kind: 'capacity';
      bins: Bin[];
      stats: { min: number; max: number; mean: number; median: number; p90: number; count: number; kw: number };
    }
  | {
      kind: 'inverter';
      ratings: { rating: number; count: number }[];
      ratio: { label: string; count: number; tone: 'warn' | 'normal' }[];
      stats: { fleetRatio: number; oversized: number; count: number; topRating: number | null };
    }
  | {
      kind: 'transformer';
      top: { code: string; count: number; kw: number; branchId: number }[];
      dist: Bin[];
      stats: { transformers: number; avgAccounts: number; avgKw: number; maxAccounts: number; overMw: number };
    }
  | {
      kind: 'pole';
      dist: { label: string; n: number; poles: number }[];
      top: { transformer: string; pole: string; count: number }[];
      stats: { poles: number; avgPerPole: number; crowded: number };
    }
  | { kind: 'geo'; summary: Summary };

export interface Detail {
  row: CustomerRow;
  transformer: { count: number; kw: number; rank: number; maxKw: number };
  pole: { account: string; capacity: number; date: string; id: number }[];
}

export type Request =
  | { type: 'init' }
  | { type: 'rows'; filters: Filters; sort: Sort; offset: number; limit: number; gen: number }
  | { type: 'summary'; filters: Filters }
  | { type: 'lens'; filters: Filters; lens: LensKey }
  | { type: 'detail'; rowId: number };

/** Every JSON endpoint answers { data, ms } — ms is the time spent in PostgreSQL. */
export interface ApiOk<T> {
  data: T;
  ms: number;
}
export interface ApiError {
  error: string;
  /** NOT_READY: the database is starting or has no data yet */
  code?: 'NOT_READY' | 'BAD_REQUEST' | 'INTERNAL';
}
