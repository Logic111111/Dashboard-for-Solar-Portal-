import { useMemo, type ReactNode } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { MousePointerClick } from 'lucide-react';
import { fmtCompact, fmtDate, fmtFixed, fmtInt, fmtPct, fmtPowerText, MONTHS, ymLabel } from '../../lib/format';
import type { MonthPoint, Summary } from '../data/types';
import { ChartBlock, ChartTip, SidePanel, StatRow, cursorFill, gridProps, xAxisProps, yAxisProps } from './common';
import type { LensActions } from './types';

const nextYm = (ym: number) => (ym % 100 === 12 ? ym + 89 : ym + 1);

export function TimelineLens({ head, monthly, summary, actions }: { head: ReactNode; monthly: MonthPoint[]; summary: Summary | null; actions: LensActions }) {
  const data = useMemo(() => {
    if (!monthly.length) return [];
    const byYm = new Map(monthly.map((p) => [p.ym, p]));
    const out: { ym: number; count: number; kw: number; mw: number }[] = [];
    let cum = 0;
    for (let ym = monthly[0].ym; ym <= monthly[monthly.length - 1].ym; ym = nextYm(ym)) {
      const p = byYm.get(ym);
      cum += p?.kw ?? 0;
      out.push({ ym, count: p?.count ?? 0, kw: p?.kw ?? 0, mw: cum / 1000 });
    }
    return out;
  }, [monthly]);

  const stats = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    let ytd = 0;
    let prev = 0;
    let last12 = 0;
    let peak = { ym: 0, count: 0 };
    const years = new Map<number, number>();
    const from12 = m === 12 ? y * 100 + 1 : (y - 1) * 100 + m + 1;
    for (const p of monthly) {
      if (p.ym >= y * 100 + 1 && p.ym <= y * 100 + m) ytd += p.count;
      if (p.ym >= (y - 1) * 100 + 1 && p.ym <= (y - 1) * 100 + m) prev += p.count;
      if (p.ym >= from12) last12 += p.count;
      if (p.count > peak.count) peak = p;
      years.set(Math.floor(p.ym / 100), (years.get(Math.floor(p.ym / 100)) ?? 0) + p.count);
    }
    const busiest = [...years].sort((a, b) => b[1] - a[1])[0];
    return { y, m, ytd, prev, delta: prev ? ytd / prev - 1 : null, last12, peak, busiest };
  }, [monthly]);

  const yearTicks = data.filter((d) => d.ym % 100 === 1).map((d) => d.ym);
  const yearTick = (ym: number) => `’${String(Math.floor(ym / 100)).slice(2)}`;

  return (
    <>
      <div className="lens-main">
        {head}
        <div className="lens-charts">
        <ChartBlock label="New connections per month" unit="accounts · click a month to filter" clickable>
          <ResponsiveContainer width="100%" height={196}>
            <BarChart
              data={data}
              syncId="timeline"
              margin={{ top: 8, right: 14, left: 0, bottom: 0 }}
              barCategoryGap={1}
              onClick={(s) => s?.activeLabel != null && actions.pickMonth(Number(s.activeLabel))}
            >
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="ym" ticks={yearTicks} interval={0} tickFormatter={yearTick} {...xAxisProps} />
              <YAxis {...yAxisProps} tickFormatter={fmtCompact} />
              <Tooltip
                cursor={cursorFill}
                isAnimationActive={false}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as (typeof data)[number];
                  return (
                    <ChartTip
                      title={ymLabel(d.ym)}
                      rows={[
                        { color: 'var(--agg)', value: fmtInt(d.count), label: 'new connections' },
                        { color: 'var(--ink-4)', value: fmtPowerText(d.kw), label: 'array capacity added' },
                      ]}
                      foot="Click to filter this month"
                    />
                  );
                }}
              />
              <Bar dataKey="count" fill="var(--agg)" radius={[2, 2, 0, 0]} maxBarSize={24} activeBar={{ fill: 'var(--accent-2)' }} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </ChartBlock>

        <ChartBlock label="Cumulative array capacity" unit="MW">
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={data} syncId="timeline" margin={{ top: 8, right: 14, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="tl-wash" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="var(--agg)" stopOpacity={0.3} />
                  <stop offset="1" stopColor="var(--agg)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="ym" ticks={yearTicks} interval={0} tickFormatter={yearTick} {...xAxisProps} />
              <YAxis {...yAxisProps} tickFormatter={(v: number) => fmtCompact(v)} />
              <Tooltip
                cursor={{ stroke: 'var(--line-3)', strokeWidth: 1 }}
                isAnimationActive={false}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as (typeof data)[number];
                  return <ChartTip title={ymLabel(d.ym)} rows={[{ color: 'var(--agg)', value: `${fmtFixed(d.mw, 1)} MW`, label: 'connected to date' }]} />;
                }}
              />
              <Area
                type="monotone"
                dataKey="mw"
                stroke="var(--agg)"
                strokeWidth={2}
                fill="url(#tl-wash)"
                dot={false}
                activeDot={{ r: 4.5, fill: 'var(--agg)', stroke: 'var(--panel)', strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartBlock>
        </div>
      </div>

      <SidePanel
        title="Connection pulse"
        sub="Within the current filters"
        note={
          <>
            <MousePointerClick size={13} /> Click a month to narrow the table to it.
          </>
        }
      >
        <div className="stat-list">
          <StatRow k={`Connected in ${stats.y}`} sub={`Jan–${MONTHS[stats.m - 1]}`} v={fmtInt(stats.ytd)} tone="ink" />
          <StatRow
            k={`vs same period ${stats.y - 1}`}
            v={stats.delta == null ? '—' : `${stats.delta >= 0 ? '+' : ''}${fmtPct(stats.delta)}`}
            tone={stats.delta != null && stats.delta < 0 ? 'warn' : undefined}
          />
          <StatRow k="Last 12 months" v={fmtInt(stats.last12)} />
          <StatRow k="Peak month" sub={stats.peak.ym ? ymLabel(stats.peak.ym) : ''} v={fmtInt(stats.peak.count)} />
          <StatRow k="Busiest year" sub={stats.busiest ? String(stats.busiest[0]) : ''} v={stats.busiest ? fmtInt(stats.busiest[1]) : '—'} />
          <StatRow k="First connection" v={summary?.firstDate ? fmtDate(summary.firstDate) : '—'} tone="ink" />
          <StatRow k="Latest connection" v={summary?.lastDate ? fmtDate(summary.lastDate) : '—'} tone="ink" />
        </div>
      </SidePanel>
    </>
  );
}
