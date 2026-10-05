import type { ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from 'recharts';
import { MousePointerClick } from 'lucide-react';
import { fmtCompact, fmtFixed, fmtInt, fmtKwValue, fmtPct, fmtPowerText } from '../../lib/format';
import type { Bin, LensData } from '../data/types';
import { ChartBlock, ChartTip, SidePanel, StatRow, cursorFill, gridProps, labelStyle, xAxisProps, yAxisProps } from './common';
import type { LensActions } from './types';

type Data = Extract<LensData, { kind: 'capacity' }>;

export function CapacityLens({ head, data, actions }: { head: ReactNode; data: Data; actions: LensActions }) {
  const bins = data.bins.map((b) => ({ ...b, mw: b.kw / 1000 }));
  const { stats } = data;
  const bigShare = stats.kw ? bins.filter((b) => b.lo >= 40).reduce((s, b) => s + b.kw, 0) / stats.kw : 0;
  const bigCount = stats.count ? bins.filter((b) => b.lo >= 40).reduce((s, b) => s + b.count, 0) / stats.count : 0;

  const pick = (s: { activeTooltipIndex?: number } | null) => {
    const b = s?.activeTooltipIndex != null ? data.bins[s.activeTooltipIndex] : null;
    if (b) actions.pickCapacity(b.lo === 0 ? null : b.lo, b.hi);
  };
  const tip = (metric: 'count' | 'mw') =>
    function CapacityTip({ active, payload }: TooltipProps<number, string>) {
      if (!active || !payload?.length) return null;
      const b = payload[0].payload as Bin & { mw: number };
      return (
        <ChartTip
          title={`${b.label} kW systems`}
          rows={[
            { color: metric === 'count' ? 'var(--agg)' : 'var(--ink-4)', value: fmtInt(b.count), label: `accounts · ${fmtPct(stats.count ? b.count / stats.count : 0)}` },
            { color: metric === 'mw' ? 'var(--agg)' : 'var(--ink-4)', value: fmtPowerText(b.kw), label: `capacity · ${fmtPct(stats.kw ? b.kw / stats.kw : 0)}` },
          ]}
          foot="Click to filter this size band"
        />
      );
    };

  return (
    <>
      <div className="lens-main">
        {head}
        <div className="lens-charts cols-2">
          <ChartBlock label="Systems by size" unit="accounts · kW bands" clickable>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={bins} margin={{ top: 22, right: 10, left: 0, bottom: 0 }} onClick={pick}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="label" {...xAxisProps} interval="preserveStartEnd" minTickGap={2} />
                <YAxis {...yAxisProps} tickFormatter={fmtCompact} />
                <Tooltip cursor={cursorFill} isAnimationActive={false} content={tip('count')} />
                <Bar dataKey="count" fill="var(--agg)" radius={[4, 4, 0, 0]} maxBarSize={24} activeBar={{ fill: 'var(--accent-2)' }} animationDuration={380}>
                  <LabelList dataKey="count" position="top" formatter={(v: number) => (v ? fmtCompact(v) : '')} {...labelStyle} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartBlock>
          <ChartBlock label="Capacity by size" unit="MW · same bands" clickable>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={bins} margin={{ top: 22, right: 10, left: 0, bottom: 0 }} onClick={pick}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="label" {...xAxisProps} interval="preserveStartEnd" minTickGap={2} />
                <YAxis {...yAxisProps} tickFormatter={(v: number) => fmtCompact(v)} />
                <Tooltip cursor={cursorFill} isAnimationActive={false} content={tip('mw')} />
                <Bar dataKey="mw" fill="var(--agg)" radius={[4, 4, 0, 0]} maxBarSize={24} activeBar={{ fill: 'var(--accent-2)' }} animationDuration={380}>
                  <LabelList dataKey="mw" position="top" formatter={(v: number) => (v ? fmtFixed(v, v >= 100 ? 0 : 1) : '')} {...labelStyle} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartBlock>
        </div>
      </div>

      <SidePanel
        title="System size"
        sub="CAPACITY statistics · kW"
        note={
          <>
            <MousePointerClick size={13} /> Click a band to filter by size.
          </>
        }
      >
        <div className="stat-list">
          <StatRow k="Median system" v={`${fmtKwValue(stats.median)} kW`} tone="ink" />
          <StatRow k="Mean system" v={`${fmtFixed(stats.mean, 1)} kW`} />
          <StatRow k="90th percentile" v={`${fmtKwValue(stats.p90)} kW`} />
          <StatRow k="Largest" v={`${fmtKwValue(stats.max)} kW`} />
          <StatRow k="Smallest" v={`${fmtKwValue(stats.min)} kW`} />
          <StatRow k="Systems ≥ 40 kW" v={`${fmtPct(bigCount)} of accounts`} />
          <StatRow k="…holding" v={`${fmtPct(bigShare)} of capacity`} tone="ink" />
        </div>
      </SidePanel>
    </>
  );
}
