import type { ReactNode } from 'react';
import { cx } from '../../lib/format';

/** Tooltip body — value leads, label follows, series keyed with a short line. */
export function ChartTip({ title, rows, foot }: { title: ReactNode; rows: { color: string; value: ReactNode; label: ReactNode }[]; foot?: ReactNode }) {
  return (
    <div className="ctip">
      <div className="ctip-title">{title}</div>
      {rows.map((r, i) => (
        <div className="ctip-row" key={i}>
          <i style={{ background: r.color }} />
          <b>{r.value}</b>
          <span>{r.label}</span>
        </div>
      ))}
      {foot && <div className="ctip-foot">{foot}</div>}
    </div>
  );
}

export function ChartBlock({ label, unit, children, clickable }: { label: string; unit?: string; children: ReactNode; clickable?: boolean }) {
  return (
    <div className="chart-block">
      <div className="chart-label">
        {label}
        {unit && <span>{unit}</span>}
      </div>
      <div className={cx('chart-frame', clickable && 'clickable')}>{children}</div>
    </div>
  );
}

// Recharts prop presets: hairline solid grid, recessive axes, tabular ticks.
export const gridProps = { vertical: false, stroke: 'var(--grid)' } as const;
export const xAxisProps = {
  tickLine: false,
  axisLine: { stroke: 'var(--axis)' },
  tick: { fill: 'var(--tick)', fontSize: 11 },
  tickMargin: 8,
} as const;
export const yAxisProps = {
  tickLine: false,
  axisLine: false,
  tick: { fill: 'var(--tick)', fontSize: 11 },
  width: 46,
} as const;
export const cursorFill = { fill: 'var(--accent-soft)', opacity: 0.6 };
export const labelStyle = { fill: 'var(--ink-2)', fontSize: 11, fontWeight: 600 } as const;
export const MONO = "'JetBrains Mono Variable', ui-monospace, monospace";

export interface HBarItem {
  id: number | string;
  name: string;
  color: string;
  value: number;
  sub?: string;
  selected?: boolean;
}

/** Thin horizontal bars in plain HTML — precise, accessible, and clickable. */
export function HBarList({ items, format, onPick, title }: { items: HBarItem[]; format: (v: number) => ReactNode; onPick?: (id: HBarItem['id']) => void; title?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="hbar-list" role="list" aria-label={title}>
      {items.map((it) => (
        <button
          key={it.id}
          role="listitem"
          className="hbar"
          onClick={() => onPick?.(it.id)}
          title={onPick ? `Filter to ${it.name}` : undefined}
          style={it.selected ? { background: 'var(--accent-soft)' } : undefined}
        >
          <span className="hbar-name">
            <i style={{ background: it.color }} />
            {it.name}
          </span>
          <span className="hbar-track">
            <span className="hbar-fill" style={{ width: `${(it.value / max) * 100}%`, background: it.color }} />
          </span>
          <span className="hbar-val">{format(it.value)}</span>
        </button>
      ))}
    </div>
  );
}

export function StatRow({ k, v, dot, tone, sub, onClick }: { k: ReactNode; v: ReactNode; dot?: string; tone?: 'ink' | 'warn'; sub?: ReactNode; onClick?: () => void }) {
  const body = (
    <>
      {dot !== undefined && <i className="dot" style={{ background: dot }} />}
      <span className="k">
        {k}
        {sub && <small>{sub}</small>}
      </span>
      <span className={cx('v', tone === 'ink' && 'is-ink', tone === 'warn' && 'is-warn')}>{v}</span>
    </>
  );
  const cls = cx('stat-row', dot === undefined && 'no-dot');
  return onClick ? (
    <button className={cls} onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function SidePanel({ title, sub, children, note }: { title: string; sub: string; children: ReactNode; note?: ReactNode }) {
  return (
    <aside className="lens-side">
      <div className="side-title">{title}</div>
      <div className="side-sub">{sub}</div>
      {children}
      {note && <div className="side-note">{note}</div>}
    </aside>
  );
}
