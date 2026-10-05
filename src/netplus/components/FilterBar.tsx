import { memo, useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { CalendarRange, Check, Cpu, Gauge, MapPin, RotateCcw, Search, TriangleAlert, X } from 'lucide-react';
import { cx, fmtDay, fmtInt, fmtKwValue, isoDay, monthEnd, ymLabel } from '../../lib/format';
import { EMPTY_FILTERS, type Filters } from '../data/types';
import { branchColor } from '../meta';
import { toggleGeo, useLookups, type GeoLevel } from '../lookups';
import { Popover } from './Popover';

interface Props {
  filters: Filters;
  setFilters: Dispatch<SetStateAction<Filters>>;
  searchText: string;
  setSearchText: (s: string) => void;
  count: number | null;
  total: number;
}

interface RangePreset {
  label: string;
  min: number | null;
  max: number | null;
}

const CAP_PRESETS: RangePreset[] = [
  { label: 'Under 3 kW', min: null, max: 3 },
  { label: '3 – 5 kW', min: 3, max: 5 },
  { label: '5 – 10 kW', min: 5, max: 10 },
  { label: '10 – 20 kW', min: 10, max: 20 },
  { label: '20 – 40 kW', min: 20, max: 40 },
  { label: '40 – 100 kW', min: 40, max: 100 },
  { label: '100 – 500 kW', min: 100, max: 500 },
  { label: '500 kW and above', min: 500, max: null },
];

const INV_PRESETS: RangePreset[] = [
  { label: 'Under 5 kW', min: null, max: 5 },
  { label: '5 – 10 kW', min: 5, max: 10 },
  { label: '10 – 20 kW', min: 10, max: 20 },
  { label: '20 – 50 kW', min: 20, max: 50 },
  { label: '50 – 100 kW', min: 50, max: 100 },
  { label: '100 kW and above', min: 100, max: null },
];

/** Ranges are [min, max): min inclusive, max exclusive — the same bins the charts use. */
export function rangeText(min: number | null, max: number | null, unit = 'kW') {
  if (min != null && max != null && max - min < 0.01) return `${fmtKwValue(min)} ${unit}`;
  if (min != null && max != null) return `${fmtKwValue(min)}–${fmtKwValue(max)} ${unit}`;
  if (min != null) return `≥ ${fmtKwValue(min)} ${unit}`;
  if (max != null) return `< ${fmtKwValue(max)} ${unit}`;
  return '';
}

/** Human label for an inclusive 'YYYY-MM-DD' range: "Mar 2023", "2023", "Feb 21, 2024", "Jan 5 – Mar 2, 2024"… */
export function periodText(from: string | null, to: string | null) {
  if (from && to) {
    if (from === to) return fmtDay(from);
    if (from.endsWith('-01-01') && to.endsWith('-12-31') && from.slice(0, 4) === to.slice(0, 4)) return from.slice(0, 4);
    if (from.endsWith('-01') && to === monthEnd(from)) return ymLabel(Number(from.slice(0, 4) + from.slice(5, 7)));
    return `${fmtDay(from)} – ${fmtDay(to)}`;
  }
  if (from) return `Since ${fmtDay(from)}`;
  if (to) return `Until ${fmtDay(to)}`;
  return '';
}

function periodPresets(now = new Date()) {
  const y = now.getFullYear();
  const back = (days: number) => isoDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1));
  return [
    { label: 'Last 7 days', from: back(7), to: null },
    { label: 'Last 30 days', from: back(30), to: null },
    { label: 'Last 90 days', from: back(90), to: null },
    { label: 'This month', from: isoDay(new Date(y, now.getMonth(), 1)), to: null },
    { label: `This year (${y})`, from: `${y}-01-01`, to: null },
    ...[1, 2, 3].map((d) => ({ label: String(y - d), from: `${y - d}-01-01`, to: `${y - d}-12-31` })),
    { label: 'Since 2020', from: '2020-01-01', to: null },
    { label: 'Before 2020', from: null, to: '2019-12-31' },
  ];
}

// ---------------------------------------------------------------- pieces ---

function RangeBody(props: {
  title: string;
  presets: RangePreset[];
  min: number | null;
  max: number | null;
  onChange: (min: number | null, max: number | null) => void;
  close: () => void;
}) {
  const { title, presets, min, max, onChange, close } = props;
  const [lo, setLo] = useState(min?.toString() ?? '');
  const [hi, setHi] = useState(max?.toString() ?? '');
  const parse = (s: string) => {
    const n = Number(s);
    return s.trim() === '' || !Number.isFinite(n) ? null : n;
  };
  return (
    <>
      <div className="pop-title">
        {title}
        <button onClick={() => (onChange(null, null), close())}>Clear</button>
      </div>
      <div className="pop-list">
        {presets.map((p) => {
          const on = p.min === min && p.max === max;
          return (
            <button key={p.label} className={cx('pop-opt no-dot', on && 'is-on')} onClick={() => (onChange(p.min, p.max), close())}>
              <span className="tick">{on && <Check size={15} strokeWidth={3} />}</span>
              <span>{p.label}</span>
              <span />
            </button>
          );
        })}
      </div>
      <form
        className="pop-foot"
        onSubmit={(e) => {
          e.preventDefault();
          onChange(parse(lo), parse(hi));
          close();
        }}
      >
        <div className="pop-foot-label">Custom range · from (inclusive) – below</div>
        <div className="range-inputs">
          <label className="field">
            <input inputMode="decimal" placeholder="From" value={lo} onChange={(e) => setLo(e.target.value)} aria-label="Minimum" />
            <span className="unit">kW</span>
          </label>
          <span className="range-dash">–</span>
          <label className="field">
            <input inputMode="decimal" placeholder="Below" value={hi} onChange={(e) => setHi(e.target.value)} aria-label="Maximum (exclusive)" />
            <span className="unit">kW</span>
          </label>
          <button className="btn is-primary" type="submit">
            Apply
          </button>
        </div>
      </form>
    </>
  );
}

function PeriodBody({ from, to, onChange, close }: { from: string | null; to: string | null; onChange: (f: string | null, t: string | null) => void; close: () => void }) {
  const [a, setA] = useState(from ?? '');
  const [b, setB] = useState(to ?? '');
  const today = isoDay(new Date());
  const invalid = !!a && !!b && a > b;
  return (
    <>
      <div className="pop-title">
        Connection date
        <button onClick={() => (onChange(null, null), close())}>Clear</button>
      </div>
      <div className="pop-list preset-grid">
        {periodPresets().map((p) => {
          const on = p.from === from && p.to === to;
          return (
            <button key={p.label} className={cx('pop-opt no-dot', on && 'is-on')} onClick={() => (onChange(p.from, p.to), close())}>
              <span className="tick">{on && <Check size={15} strokeWidth={3} />}</span>
              <span>{p.label}</span>
              <span />
            </button>
          );
        })}
      </div>
      <form
        className="pop-foot"
        onSubmit={(e) => {
          e.preventDefault();
          if (invalid) return;
          onChange(a || null, b || null);
          close();
        }}
      >
        <div className="pop-foot-label">Custom dates (inclusive)</div>
        <div className="range-inputs">
          <label className="field">
            <input type="date" value={a} min="2016-01-01" max={today} onChange={(e) => setA(e.target.value)} aria-label="From date" />
          </label>
          <span className="range-dash">–</span>
          <label className="field">
            <input type="date" value={b} min="2016-01-01" max={today} onChange={(e) => setB(e.target.value)} aria-label="To date" />
          </label>
          <button className="btn is-primary" type="submit" disabled={invalid}>
            Apply
          </button>
        </div>
        {invalid && <div className="pop-foot-label" style={{ color: 'var(--serious)', marginTop: 8 }}>“From” must be on or before “To”.</div>}
      </form>
    </>
  );
}

function SearchBox({ value, onChange }: { value: string; onChange: (s: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div className="search">
      <Search size={16} className="search-icon" />
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && onChange('')}
        placeholder="Account, transformer or pole"
        aria-label="Search accounts, transformers or poles"
        spellCheck={false}
        autoComplete="off"
      />
      <span className="search-kbd">
        {value ? (
          <button className="search-clear" onClick={() => onChange('')} aria-label="Clear search">
            <X size={14} />
          </button>
        ) : (
          <kbd>/</kbd>
        )}
      </span>
    </div>
  );
}

// ------------------------------------------------------------------ chips ---

interface ChipDef {
  key: string;
  k: string;
  label: ReactNode;
  color?: string;
  clear: (f: Filters) => Filters;
}

function useChips(filters: Filters, search: string): ChipDef[] {
  const L = useLookups();
  const chips: ChipDef[] = [];
  const geo = (level: GeoLevel, id: number, k: string, label: string, color: string) =>
    chips.push({ key: `${level}${id}`, k, label: <b>{label}</b>, color, clear: (f) => toggleGeo(f, L, level, id) });

  if (search.trim()) chips.push({ key: 'search', k: 'Search', label: <b className="mono">{search.trim().toUpperCase()}…</b>, clear: (f) => f });
  filters.branches.forEach((id) => geo('branch', id, 'Branch', L.branch.get(id)?.name ?? '?', branchColor(id)));
  filters.cscs.forEach((id) => {
    const c = L.csc.get(id);
    geo('csc', id, 'CSC', c?.name ?? '?', branchColor(c?.branchId ?? 0));
  });
  filters.pss.forEach((id) => {
    const p = L.pss.get(id);
    geo('pss', id, 'PSS', p?.name ?? '?', branchColor(p?.branchId ?? 0));
  });
  filters.feeders.forEach((id) => {
    const fd = L.feeder.get(id);
    const p = fd ? L.pss.get(fd.pssId) : undefined;
    geo('feeder', id, 'Feeder', fd?.name ?? '?', branchColor(p?.branchId ?? 0));
  });
  if (filters.transformer)
    chips.push({ key: 'tf', k: 'Transformer', label: <b className="mono">{filters.transformer}</b>, clear: (f) => ({ ...f, transformer: null }) });
  if (filters.capMin != null || filters.capMax != null)
    chips.push({ key: 'cap', k: 'Capacity', label: <b>{rangeText(filters.capMin, filters.capMax)}</b>, clear: (f) => ({ ...f, capMin: null, capMax: null }) });
  if (filters.invMin != null || filters.invMax != null)
    chips.push({ key: 'inv', k: 'Inverter', label: <b>{rangeText(filters.invMin, filters.invMax)}</b>, clear: (f) => ({ ...f, invMin: null, invMax: null }) });
  if (filters.fromDate || filters.toDate)
    chips.push({ key: 'period', k: 'Connected', label: <b>{periodText(filters.fromDate, filters.toDate)}</b>, clear: (f) => ({ ...f, fromDate: null, toDate: null }) });
  if (filters.oversized)
    chips.push({ key: 'over', k: 'Flag', label: <b>Inverter &gt; array</b>, clear: (f) => ({ ...f, oversized: false }) });
  return chips;
}

// ------------------------------------------------------------------- bar ---

export const FilterBar = memo(function FilterBar({ filters, setFilters, searchText, setSearchText, count, total }: Props) {
  const L = useLookups();
  const chips = useChips(filters, searchText);
  const nBranch = filters.branches.length;
  const resultCount = (
    <span className="result-count" aria-live="polite">
      <b className="num">{count == null ? '—' : fmtInt(count)}</b> of {fmtInt(total)} accounts
    </span>
  );

  return (
    <section className="card filterbar" aria-label="Filters">
      <div className="filter-row">
        <SearchBox value={searchText} onChange={setSearchText} />
        <span className="fsep" />

        <Popover
          icon={<MapPin size={15} />}
          label="Branch"
          value={nBranch ? (nBranch === 1 ? L.branch.get(filters.branches[0])?.name : `${nBranch} of 7`) : null}
          active={nBranch > 0}
          width={300}
        >
          {() => (
            <>
              <div className="pop-title">
                Branches
                <button onClick={() => setFilters((f) => ({ ...f, branches: [] }))}>Clear</button>
              </div>
              <div className="pop-list">
                {L.hierarchy.branches.map((b) => {
                  const on = filters.branches.includes(b.id);
                  return (
                    <button key={b.id} className={cx('pop-opt', on && 'is-on')} onClick={() => setFilters((f) => toggleGeo(f, L, 'branch', b.id))}>
                      <span className="check">{on && <Check size={11} strokeWidth={3.5} />}</span>
                      <span className="tree-dot" style={{ background: branchColor(b.id) }} />
                      <span>{b.name}</span>
                      <span className="pop-meta num">{fmtInt(b.count)}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </Popover>

        <Popover icon={<Gauge size={15} />} label="Capacity" value={rangeText(filters.capMin, filters.capMax) || null} active={filters.capMin != null || filters.capMax != null} width={330}>
          {(close) => (
            <RangeBody
              title="Array capacity · CAPACITY"
              presets={CAP_PRESETS}
              min={filters.capMin}
              max={filters.capMax}
              onChange={(capMin, capMax) => setFilters((f) => ({ ...f, capMin, capMax }))}
              close={close}
            />
          )}
        </Popover>

        <Popover icon={<Cpu size={15} />} label="Inverter" value={rangeText(filters.invMin, filters.invMax) || null} active={filters.invMin != null || filters.invMax != null} width={330}>
          {(close) => (
            <RangeBody
              title="Inverter capacity · INV_CAPACITY"
              presets={INV_PRESETS}
              min={filters.invMin}
              max={filters.invMax}
              onChange={(invMin, invMax) => setFilters((f) => ({ ...f, invMin, invMax }))}
              close={close}
            />
          )}
        </Popover>

        <Popover icon={<CalendarRange size={15} />} label="Connected" value={periodText(filters.fromDate, filters.toDate) || null} active={!!(filters.fromDate || filters.toDate)} width={380}>
          {(close) => (
            <PeriodBody from={filters.fromDate} to={filters.toDate} onChange={(fromDate, toDate) => setFilters((f) => ({ ...f, fromDate, toDate }))} close={close} />
          )}
        </Popover>

        <button
          className={cx('toggle', filters.oversized && 'is-on')}
          onClick={() => setFilters((f) => ({ ...f, oversized: !f.oversized }))}
          aria-pressed={filters.oversized}
          title="Accounts whose inverter is rated above the array capacity"
        >
          <span className="switch" />
          <TriangleAlert size={14} />
          Inverter &gt; array
        </button>

        {chips.length === 0 && (
          <>
            <div className="filter-spacer" />
            {resultCount}
          </>
        )}
      </div>

      {chips.length > 0 && (
        <div className="chips">
          {chips.map((c) => (
            <span key={c.key} className="chip">
              {c.color && <i className="chip-dot" style={{ background: c.color }} />}
              <span className="chip-k">{c.k}</span>
              {c.label}
              <button
                className="chip-x"
                aria-label={`Remove ${c.k} filter`}
                onClick={() => (c.key === 'search' ? setSearchText('') : setFilters((f) => c.clear(f)))}
              >
                <X size={13} />
              </button>
            </span>
          ))}
          <div className="filter-spacer" />
          {resultCount}
          <button
            className="btn is-ghost"
            style={{ height: 28 }}
            onClick={() => {
              setFilters(EMPTY_FILTERS);
              setSearchText('');
            }}
          >
            <RotateCcw size={13} /> Reset
          </button>
        </div>
      )}
    </section>
  );
});
