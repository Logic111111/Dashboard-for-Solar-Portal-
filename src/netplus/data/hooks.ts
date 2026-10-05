import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { api, HttpError, StaleError, type QueryLog } from './client';
import type { CustomerRow, Filters, InitResult, Request, RowsResult, Sort } from './types';

// ------------------------------------------------------------------ boot ---

export type BootStage = 'connect' | 'waiting' | 'ready';
export interface BootState {
  status: 'loading' | 'ready' | 'error';
  stage: BootStage;
  attempts: number;
  /** why we are still waiting (database starting, not seeded, API down…) */
  message: string | null;
  result: InitResult | null;
  ms: number;
  error: string | null;
}

type BootPatch = Partial<BootState>;
const bootListeners = new Set<(p: BootPatch) => void>();
let bootLoop: Promise<{ data: InitResult; rt: number }> | null = null;
const MAX_ATTEMPTS = 90; // ~2 minutes: covers a first-run cluster init + data load

function waitingMessage(e: unknown) {
  if (e instanceof HttpError && e.code === 'NOT_READY') return e.message;
  if (e instanceof HttpError) return 'The API server is starting…';
  return 'Cannot reach the API server yet…';
}

/** One shared retry loop: waits while PostgreSQL starts or loads data. */
function startBoot() {
  bootLoop ??= (async () => {
    for (let attempt = 1; ; attempt++) {
      try {
        const { data, rt } = await api.call<InitResult>({ type: 'init' });
        return { data, rt };
      } catch (e) {
        const retryable = !(e instanceof HttpError) || e.status >= 500;
        if (!retryable || attempt >= MAX_ATTEMPTS) throw e;
        bootListeners.forEach((fn) => fn({ stage: 'waiting', attempts: attempt, message: waitingMessage(e) }));
        await new Promise((r) => setTimeout(r, 1300));
      }
    }
  })();
  return bootLoop;
}

export function useBoot(): BootState {
  const [state, setState] = useState<BootState>({
    status: 'loading',
    stage: 'connect',
    attempts: 0,
    message: null,
    result: null,
    ms: 0,
    error: null,
  });
  useEffect(() => {
    const listener = (p: BootPatch) => setState((s) => ({ ...s, ...p }));
    bootListeners.add(listener);
    startBoot()
      .then(({ data, rt }) => setState((s) => ({ ...s, status: 'ready', stage: 'ready', result: data, ms: rt, message: null })))
      .catch((e: Error) => setState((s) => ({ ...s, status: 'error', error: e.message })));
    return () => void bootListeners.delete(listener);
  }, []);
  return state;
}

// ---------------------------------------------------------------- queries ---

export interface QueryState<T> {
  data: T | null;
  ms: number;
  pending: boolean;
  error: string | null;
}

/** Runs an API request whenever `key` changes; keeps the previous data while the next one loads. */
export function useSqlQuery<T>(req: Request | null, key: string): QueryState<T> {
  const [state, setState] = useState<QueryState<T>>({ data: null, ms: 0, pending: !!req, error: null });
  const reqRef = useRef(req);
  reqRef.current = req;
  useEffect(() => {
    const r = reqRef.current;
    if (!r) return;
    let alive = true;
    setState((s) => ({ ...s, pending: true }));
    api
      .call<T>(r)
      .then(({ data, ms }) => alive && setState({ data, ms, pending: false, error: null }))
      .catch((e: Error) => {
        if (!alive || e instanceof StaleError) return;
        setState((s) => ({ ...s, pending: false, error: e.message }));
      });
    return () => {
      alive = false;
    };
  }, [key]);
  return state;
}

// ------------------------------------------------------------ row source ---

export const BLOCK = 100;
const MAX_BLOCKS = 60;

interface LiveSet {
  key: string;
  total: number;
  blocks: Map<number, CustomerRow[]>;
  /** PostgreSQL time and browser round trip of the latest page */
  queryMs: number;
  rtMs: number;
}

export interface RowSource {
  total: number;
  /** a new (filters, sort) is loading; the previous rows are still shown */
  pending: boolean;
  /** changes whenever the displayed result set is replaced */
  liveKey: string;
  queryMs: number;
  rtMs: number;
  getRow: (index: number) => CustomerRow | undefined;
  ensureRange: (start: number, end: number) => void;
}

/**
 * Block-paged access to the sorted result set: each block is one
 * ORDER BY … LIMIT 100 OFFSET n query. Only blocks near the viewport are kept.
 */
export function useRowSource(filters: Filters, sort: Sort): RowSource {
  const key = useMemo(() => JSON.stringify([filters, sort]), [filters, sort]);
  const args = useRef({ filters, sort });
  args.current = { filters, sort };
  const ref = useRef({
    key: '',
    gen: 0,
    inflight: new Set<string>(),
    live: { key: '', total: 0, blocks: new Map(), queryMs: 0, rtMs: 0 } as LiveSet,
  });
  const [, rerender] = useReducer((x: number) => x + 1, 0);

  const request = useCallback((block: number) => {
    const r = ref.current;
    const { gen, key: k } = r;
    const tag = `${gen}:${block}`;
    if (r.inflight.has(tag) || (r.live.key === k && r.live.blocks.has(block))) return;
    r.inflight.add(tag);
    const { filters: f, sort: s } = args.current;
    api
      .call<RowsResult>({ type: 'rows', filters: f, sort: s, offset: block * BLOCK, limit: BLOCK, gen })
      .then(({ data, ms, rt }) => {
        r.inflight.delete(tag);
        if (r.gen !== gen) return;
        if (r.live.key !== k) r.live = { key: k, total: data.total, blocks: new Map(), queryMs: ms, rtMs: rt };
        r.live.total = data.total;
        r.live.queryMs = ms;
        r.live.rtMs = rt;
        r.live.blocks.set(block, data.rows);
        if (r.live.blocks.size > MAX_BLOCKS) {
          const far = [...r.live.blocks.keys()].sort((a, b) => Math.abs(b - block) - Math.abs(a - block));
          for (const b of far.slice(0, r.live.blocks.size - MAX_BLOCKS)) r.live.blocks.delete(b);
        }
        rerender();
      })
      .catch(() => r.inflight.delete(tag));
  }, []);

  useEffect(() => {
    const r = ref.current;
    r.gen += 1;
    r.key = key;
    r.inflight.clear();
    request(0);
    request(1);
  }, [key, request]);

  const live = ref.current.live;
  const ensureRange = useCallback(
    (start: number, end: number) => {
      if (ref.current.live.key !== ref.current.key) return;
      for (let b = Math.floor(start / BLOCK); b <= Math.floor(end / BLOCK); b++) request(b);
    },
    [request],
  );
  const getRow = useCallback((i: number) => ref.current.live.blocks.get(Math.floor(i / BLOCK))?.[i % BLOCK], []);

  return {
    total: live.total,
    pending: live.key !== key,
    liveKey: live.key,
    queryMs: live.queryMs,
    rtMs: live.rtMs,
    getRow,
    ensureRange,
  };
}

// -------------------------------------------------------------- telemetry ---

export function useQueryLog(limit = 5): QueryLog[] {
  const [log, setLog] = useState<QueryLog[]>(() => api.log.slice(0, limit));
  useEffect(() => api.onQuery(() => setLog(api.log.slice(0, limit))), [limit]);
  return log;
}

/** Debounced copy of a value (used for text input → SQL). */
export function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
