import type { ApiError, ApiOk, Filters, Request, Sort } from './types';

export interface QueryLog {
  n: number;
  type: Request['type'] | 'export';
  /** time spent in PostgreSQL (server-measured) */
  ms: number;
  /** full round trip seen by the browser */
  rt: number;
  at: number;
}

export class StaleError extends Error {
  constructor() {
    super('superseded');
  }
}

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: ApiError['code'],
  ) {
    super(message);
  }
}

interface Pending {
  req: Request;
  controller: AbortController;
}

/**
 * Talks to the API server (server/index.ts). A newer request of the same kind
 * cancels the older one in flight, so fast typing or scrolling never queues
 * stale queries.
 */
class ApiClient {
  private seq = 0;
  private pending = new Map<number, Pending>();
  private logSubs = new Set<(l: QueryLog) => void>();
  readonly log: QueryLog[] = [];

  private supersede(req: Request) {
    for (const [id, p] of this.pending) {
      const older =
        req.type === 'rows'
          ? p.req.type === 'rows' && p.req.gen < req.gen
          : (req.type === 'summary' || req.type === 'lens' || req.type === 'detail') && p.req.type === req.type;
      if (older) {
        p.controller.abort();
        this.pending.delete(id);
      }
    }
  }

  private record(entry: Omit<QueryLog, 'n' | 'at'>) {
    const e = { ...entry, n: ++this.seq, at: Date.now() };
    this.log.unshift(e);
    this.log.length = Math.min(this.log.length, 24);
    this.logSubs.forEach((fn) => fn(e));
  }

  async call<T>(req: Request): Promise<{ data: T; ms: number; rt: number }> {
    this.supersede(req);
    const id = ++this.seq;
    const controller = new AbortController();
    this.pending.set(id, { req, controller });

    const { url, init } = endpoint(req);
    const t0 = performance.now();
    // A 503 means the database was momentarily unavailable (starting up, or
    // every pooled connection busy) — retry briefly. Boot has its own loop.
    const retries = req.type === 'init' ? 0 : 2;
    try {
      for (let attempt = 0; ; attempt++) {
        const res = await fetch(url, { ...init, signal: controller.signal });
        const body = (await res.json().catch(() => ({ error: `HTTP ${res.status}` }))) as ApiOk<T> & ApiError;
        if (res.status === 503 && attempt < retries) {
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
          continue;
        }
        if (!res.ok) throw new HttpError(body.error ?? `HTTP ${res.status}`, res.status, body.code);
        const rt = performance.now() - t0;
        this.record({ type: req.type, ms: body.ms, rt });
        return { data: body.data, ms: body.ms, rt };
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw new StaleError();
      throw e;
    } finally {
      this.pending.delete(id);
    }
  }

  /** Streams the filtered, sorted set as CSV in the source-file layout. */
  async exportCsv(filters: Filters, sort: Sort): Promise<{ blob: Blob; rows: number; rt: number }> {
    const t0 = performance.now();
    const res = await fetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filters, sort }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as ApiError;
      throw new HttpError(body.error ?? `HTTP ${res.status}`, res.status, body.code);
    }
    const blob = await res.blob();
    const rt = performance.now() - t0;
    this.record({ type: 'export', ms: rt, rt });
    return { blob, rows: Number(res.headers.get('X-Row-Count') ?? 0), rt };
  }

  onQuery(fn: (l: QueryLog) => void) {
    this.logSubs.add(fn);
    return () => void this.logSubs.delete(fn);
  }
}

function endpoint(req: Request): { url: string; init: RequestInit } {
  const post = (url: string, body: unknown) => ({
    url,
    init: { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  });
  switch (req.type) {
    case 'init':
      return { url: '/api/init', init: { method: 'GET' } };
    case 'rows':
      return post('/api/rows', { filters: req.filters, sort: req.sort, offset: req.offset, limit: req.limit });
    case 'summary':
      return post('/api/summary', { filters: req.filters });
    case 'lens':
      return post('/api/lens', { filters: req.filters, lens: req.lens });
    case 'detail':
      return { url: `/api/detail/${req.rowId}`, init: { method: 'GET' } };
  }
}

export const api = new ApiClient();
