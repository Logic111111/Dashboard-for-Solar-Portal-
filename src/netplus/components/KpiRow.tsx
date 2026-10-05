import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarRange, Cpu, SolarPanel, TriangleAlert, UsersRound } from 'lucide-react';
import { cx, fmtFixed, fmtInt, fmtPct, MONTHS } from '../../lib/format';
import type { Summary } from '../data/types';

/** Tweens between values so KPI changes read as motion, not a flash. */
function useTween(target: number, ms = 520) {
  const [v, setV] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      const next = a + (target - a) * e;
      setV(next);
      from.current = next;
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

function Num({ value, format }: { value: number; format: (n: number) => string }) {
  return <>{format(useTween(value))}</>;
}

function SparkBars({ data }: { data: { y: number; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const W = 120;
  const H = 44;
  const gap = 3;
  const bw = (W - gap * (data.length - 1)) / data.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="kpi-spark" role="img" aria-label="Connections per year">
      {data.map((d, i) => {
        const h = Math.max(2, (d.count / max) * (H - 4));
        const last = i === data.length - 1;
        return (
          <rect key={d.y} x={i * (bw + gap)} y={H - h} width={bw} height={h} rx={2} fill={last ? 'var(--agg)' : 'var(--line-3)'}>
            <title>
              {d.y}: {fmtInt(d.count)} connections
            </title>
          </rect>
        );
      })}
    </svg>
  );
}

export const KpiRow = memo(function KpiRow({ summary, pending, totalRows }: { summary: Summary | null; pending: boolean; totalRows: number }) {
  const s = summary;
  const derived = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const years = new Map<number, number>();
    let ytd = 0;
    let prev = 0;
    for (const p of s?.monthly ?? []) {
      const yy = Math.floor(p.ym / 100);
      years.set(yy, (years.get(yy) ?? 0) + p.count);
      if (p.ym >= y * 100 + 1 && p.ym <= y * 100 + m) ytd += p.count;
      if (p.ym >= (y - 1) * 100 + 1 && p.ym <= (y - 1) * 100 + m) prev += p.count;
    }
    const spark = [];
    for (let yy = y - 9; yy <= y; yy++) spark.push({ y: yy, count: years.get(yy) ?? 0 });
    return { y, m, ytd, prev, delta: prev ? ytd / prev - 1 : null, spark };
  }, [s]);

  const count = s?.count ?? 0;
  const share = totalRows ? count / totalRows : 0;
  const ratio = s && s.invKw ? s.kw / s.invKw : 0;

  return (
    <section className={cx('kpis', pending && 'is-refreshing')} aria-label="Key figures" style={{ transition: 'opacity .25s' }}>
      <article className="card kpi">
        <div className="kpi-head">
          <span className="kpi-icon">
            <UsersRound size={15} />
          </span>
          Net plus accounts
        </div>
        <div className="kpi-value">
          <Num value={count} format={fmtInt} />
        </div>
        <div className="meter" aria-hidden="true">
          <span style={{ width: `${Math.max(share * 100, count ? 0.8 : 0)}%` }} />
        </div>
        <div className="kpi-foot">
          <span>
            <b>{fmtPct(share)}</b> of {fmtInt(totalRows)} registered
          </span>
        </div>
      </article>

      <article className="card kpi is-hero">
        <div className="kpi-head">
          <span className="kpi-icon">
            <SolarPanel size={15} />
          </span>
          Array capacity
        </div>
        <div className="kpi-value">
          <Num value={(s?.kw ?? 0) / 1000} format={(n) => fmtFixed(n, 1)} />
          <small>MW</small>
        </div>
        <div className="kpi-foot">
          <span>
            Avg system <b>{fmtFixed(count ? (s?.kw ?? 0) / count : 0, 1)} kW</b>
          </span>
          <span>· Σ CAPACITY</span>
        </div>
      </article>

      <article className="card kpi">
        <div className="kpi-head">
          <span className="kpi-icon">
            <Cpu size={15} />
          </span>
          Inverter capacity
        </div>
        <div className="kpi-value">
          <Num value={(s?.invKw ?? 0) / 1000} format={(n) => fmtFixed(n, 1)} />
          <small>MW</small>
        </div>
        <div className="kpi-foot">
          <span>
            DC/AC <b>{fmtFixed(ratio, 2)}</b>
          </span>
          {!!s?.oversized && (
            <span className="warn-inline" title="Inverter rated above the array capacity">
              <TriangleAlert size={13} /> {fmtInt(s.oversized)} inverter &gt; array
            </span>
          )}
        </div>
      </article>

      <article className="card kpi">
        <div className="kpi-head">
          <span className="kpi-icon">
            <CalendarRange size={15} />
          </span>
          Connected in {derived.y}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
          <div className="kpi-value">
            <Num value={derived.ytd} format={fmtInt} />
          </div>
          <SparkBars data={derived.spark} />
        </div>
        <div className="kpi-foot">
          {derived.delta != null && (
            <span className={cx('delta', derived.delta >= 0 ? 'is-up' : 'is-down')}>
              {derived.delta >= 0 ? '▲' : '▼'} {fmtPct(Math.abs(derived.delta))}
            </span>
          )}
          <span>
            vs Jan–{MONTHS[derived.m - 1]} {derived.y - 1}
          </span>
        </div>
      </article>
    </section>
  );
});
