import { useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowDown, ArrowDownWideNarrow, ArrowUp, ArrowUpNarrowWide, ChevronDown, Download, Loader2, SearchX, TriangleAlert, Zap } from 'lucide-react';
import { cx, fmtDate, fmtFixed, fmtInt, fmtKwValue, fmtMs, fmtTime } from '../../lib/format';
import { useRowSource } from '../data/hooks';
import type { CustomerRow, Filters, Sort, SortKey } from '../data/types';
import { branchColor, SORT_META } from '../meta';
import { useLookups } from '../lookups';

const ROW_H = 44;
const LOG_MAX = Math.log10(1001);

interface Col {
  id: string;
  label: string;
  sub?: string;
  sort?: SortKey;
  right?: boolean;
}

const COLS: Col[] = [
  { id: 'rank', label: '#', right: true },
  { id: 'account', label: 'Account No', sort: 'account' },
  { id: 'transformer', label: 'Transformer', sort: 'transformer' },
  { id: 'pole', label: 'Pole', sort: 'pole' },
  { id: 'capacity', label: 'Capacity', sub: 'kW', sort: 'capacity' },
  { id: 'inverter', label: 'Inverter', sub: 'kW', sort: 'inverter', right: true },
  { id: 'ratio', label: 'DC/AC', right: true },
  { id: 'date', label: 'Connected', sort: 'date' },
  { id: 'branch', label: 'Branch / CSC', sort: 'branch' },
];

interface Props {
  filters: Filters;
  sort: Sort;
  onSort: (key: SortKey) => void;
  onSortDir: () => void;
  selectedId: number | null;
  onSelect: (id: number) => void;
  onExport: () => void;
  exporting: boolean;
  onClearFilters: () => void;
}

function Cells({ r, sortKey }: { r: CustomerRow; sortKey: SortKey }) {
  const L = useLookups();
  const s = (k: SortKey) => (sortKey === k ? ' is-sorted' : '');
  const over = r.inverter > r.capacity;
  const ratio = r.capacity / r.inverter;
  return (
    <>
      <div className={'gc gc-acct mono' + s('account')}>{r.account}</div>
      <div className={'gc' + s('transformer')}>
        <span className="code mono">{r.transformer}</span>
      </div>
      <div className={'gc' + s('pole')}>
        <span className="code mono">{r.pole}</span>
      </div>
      <div className={'gc' + s('capacity')}>
        <div className="cap-cell">
          <div className="cap-bar" aria-hidden="true">
            <span style={{ width: `${Math.max(2, (Math.log10(1 + r.capacity) / LOG_MAX) * 100)}%` }} />
          </div>
          <span className="kw num">{fmtKwValue(r.capacity)}</span>
        </div>
      </div>
      <div className={'gc is-right' + s('inverter')}>
        <span className="kw num">{fmtKwValue(r.inverter)}</span>
      </div>
      <div className="gc is-right">
        {over ? (
          <span className="ratio is-warn num" title="Inverter rated above the array capacity">
            <TriangleAlert size={12} />
            {fmtFixed(ratio, 2)}
          </span>
        ) : (
          <span className="ratio num">{fmtFixed(ratio, 2)}</span>
        )}
      </div>
      <div className={'gc date-cell' + s('date')}>
        <b className="num">{fmtDate(r.date)}</b>
        <span className="num">{fmtTime(r.date)}</span>
      </div>
      <div className={'gc' + s('branch')}>
        <span className="geo-cell">
          <i style={{ background: branchColor(r.branchId) }} />
          <b>{L.branch.get(r.branchId)?.name}</b>
          <span>{L.csc.get(r.cscId)?.name}</span>
        </span>
      </div>
    </>
  );
}

const SKELETON_W = [0, 78, 58, 44, 70, 36, 30, 72, 64];

export function DataGrid({ filters, sort, onSort, onSortDir, selectedId, onSelect, onExport, exporting, onClearFilters }: Props) {
  const src = useRowSource(filters, sort);
  const scrollRef = useRef<HTMLDivElement>(null);

  const virt = useVirtualizer({
    count: src.total,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_H,
    overscan: 14,
  });
  const items = virt.getVirtualItems();
  const first = items[0]?.index ?? 0;
  const last = items[items.length - 1]?.index ?? 0;

  const { ensureRange, total, liveKey } = src;
  useEffect(() => {
    if (total) ensureRange(first, last);
  }, [first, last, total, liveKey, ensureRange]);

  // a new ordering replaces the rows: jump back to the top
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [liveKey]);

  const DirIcon = sort.dir === 'desc' ? ArrowDownWideNarrow : ArrowUpNarrowWide;
  const empty = !src.pending && src.liveKey && src.total === 0;
  const visibleFrom = src.total ? first + 1 : 0;
  const visibleTo = src.total ? Math.min(src.total, last + 1) : 0;
  const scrollPct = src.total > 1 ? last / (src.total - 1) : 0;

  return (
    <section className="card grid-card" aria-label="Net plus accounts table">
      <header className="card-head">
        <div className="card-title">
          <span className="title-bar" />
          <h2>Net Plus Accounts</h2>
          <span className="pill num">{fmtInt(src.total)} rows</span>
        </div>
        <div className="grid-tools">
          <span className="perf" title="Time PostgreSQL spent on the latest page (sort + count), and the full browser round trip">
            {src.pending ? <Loader2 size={13} className="spin" /> : <Zap size={13} />}
            {src.pending ? (
              'Sorting…'
            ) : (
              <>
                PostgreSQL <b>{fmtMs(src.queryMs)}</b> · round trip <b>{fmtMs(src.rtMs)}</b>
              </>
            )}
          </span>
          <span className="select-label">Sort by</span>
          <label className="select">
            <select value={sort.key} onChange={(e) => onSort(e.target.value as SortKey)} aria-label="Sort column">
              {(Object.keys(SORT_META) as SortKey[]).map((k) => (
                <option key={k} value={k}>
                  {SORT_META[k].label} · {SORT_META[k].column}
                </option>
              ))}
            </select>
            <ChevronDown size={14} />
          </label>
          <button className="btn btn-sq" onClick={onSortDir} aria-label={`Sort ${sort.dir === 'desc' ? 'ascending' : 'descending'}`} title={sort.dir === 'desc' ? 'Descending' : 'Ascending'}>
            <DirIcon size={16} />
          </button>
          <button className="btn is-primary" onClick={onExport} disabled={exporting || !src.total}>
            {exporting ? <Loader2 size={15} className="spin" /> : <Download size={15} />}
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      </header>

      <div className="grid-wrap">
        <div className="grid" role="grid" aria-rowcount={src.total} aria-busy={src.pending}>
          <div className="grid-head" role="row">
            {COLS.map((c) => {
              const sorted = c.sort === sort.key;
              const Arrow = sorted && sort.dir === 'asc' ? ArrowUp : ArrowDown;
              const content = (
                <>
                  {c.label}
                  {c.sub && <span className="gh-sub">{c.sub}</span>}
                  {c.sort && <Arrow size={13} className="sort-ico" />}
                </>
              );
              return c.sort ? (
                <button
                  key={c.id}
                  role="columnheader"
                  aria-sort={sorted ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className={cx('gh', c.right && 'is-right', sorted && 'is-sorted')}
                  onClick={() => onSort(c.sort!)}
                  title={`Sort by ${SORT_META[c.sort].column}`}
                >
                  {content}
                </button>
              ) : (
                <div key={c.id} role="columnheader" className={cx('gh', c.right && 'is-right')}>
                  {content}
                </div>
              );
            })}
          </div>

          <div className="grid-scroll" ref={scrollRef}>
            <div className={cx('grid-body', src.pending && 'is-pending')} style={{ height: virt.getTotalSize() }}>
              {items.map((vi) => {
                const r = src.getRow(vi.index);
                return (
                  <div
                    key={vi.key}
                    role="row"
                    aria-rowindex={vi.index + 1}
                    className={cx('grid-row', r && r.id === selectedId && 'is-selected')}
                    style={{ transform: `translateY(${vi.start}px)` }}
                    onClick={() => r && onSelect(r.id)}
                  >
                    <div className="gc is-right gc-rank mono num">{fmtInt(vi.index + 1)}</div>
                    {r ? (
                      <Cells r={r} sortKey={sort.key} />
                    ) : (
                      SKELETON_W.slice(1).map((w, i) => (
                        <div key={i} className="gc">
                          <div className="skel" style={{ width: `${w}%` }} />
                        </div>
                      ))
                    )}
                  </div>
                );
              })}
            </div>
            {empty && (
              <div className="grid-empty">
                <div>
                  <div className="grid-empty-ico">
                    <SearchX size={22} />
                  </div>
                  <b>No accounts match these filters</b>
                  <span>Loosen a filter or </span>
                  <button className="btn is-ghost" style={{ display: 'inline-flex', height: 26 }} onClick={onClearFilters}>
                    reset all
                  </button>
                </div>
              </div>
            )}
            {!src.liveKey && (
              <div className="grid-empty">
                <Loader2 size={22} className="spin" />
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className="grid-foot">
        <span>
          Rows <b className="num">{fmtInt(visibleFrom)}–{fmtInt(visibleTo)}</b> of <b className="num">{fmtInt(src.total)}</b> · sorted by{' '}
          <b className="mono">{SORT_META[sort.key].column}</b> {sort.dir === 'desc' ? '↓' : '↑'}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="scroll-meter" aria-hidden="true">
            <span style={{ width: `${scrollPct * 100}%` }} />
          </span>
          Click a row for account detail
        </span>
      </footer>
    </section>
  );
}
