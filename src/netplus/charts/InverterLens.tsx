import type { ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { TriangleAlert } from 'lucide-react';
import { fmtCompact, fmtFixed, fmtInt, fmtKwValue, fmtPct } from '../../lib/format';
import type { LensData } from '../data/types';
import { ChartBlock, ChartTip, SidePanel, StatRow, cursorFill, gridProps, labelStyle, xAxisProps, yAxisProps } from './common';
import type { LensActions } from './types';

type Data = Extract<LensData, { kind: 'inverter' }>;

export function InverterLens({ head, data, actions }: { head: ReactNode; data: Data; actions: LensActions }) {
  const { stats } = data;
  const ratings = data.ratings.map((r) => ({ ...r, label: r.rating < 0 ? 'Other' : fmtKwValue(r.rating) }));
  const ratio = data.ratio.map((r) => ({ ...r, label: r.tone === 'warn' ? '< 1.00' : r.label }));

  return (
    <>
      <div className="lens-main">
        {head}
        <div className="lens-charts cols-2">
          <ChartBlock label="Most common inverter ratings" unit="accounts · kW rating" clickable>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart
                data={ratings}
                margin={{ top: 22, right: 10, left: 0, bottom: 0 }}
                onClick={(s) => {
                  const r = s?.activeTooltipIndex != null ? ratings[s.activeTooltipIndex] : null;
                  if (r && r.rating > 0) actions.pickInverter(r.rating);
                }}
              >
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="label" {...xAxisProps} interval="preserveStartEnd" minTickGap={2} />
                <YAxis {...yAxisProps} tickFormatter={fmtCompact} />
                <Tooltip
                  cursor={cursorFill}
                  isAnimationActive={false}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const r = payload[0].payload as (typeof ratings)[number];
                    return (
                      <ChartTip
                        title={r.rating < 0 ? 'Other ratings' : `${r.label} kW inverters`}
                        rows={[{ color: 'var(--agg)', value: fmtInt(r.count), label: `accounts · ${fmtPct(stats.count ? r.count / stats.count : 0)}` }]}
                        foot={r.rating > 0 ? 'Click to filter this rating' : undefined}
                      />
                    );
                  }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={24} activeBar={{ fill: 'var(--accent-2)' }} animationDuration={380}>
                  {ratings.map((r) => (
                    <Cell key={r.label} fill={r.rating < 0 ? 'var(--ink-4)' : 'var(--agg)'} />
                  ))}
                  <LabelList dataKey="count" position="top" formatter={(v: number) => fmtCompact(v)} {...labelStyle} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartBlock>

          <ChartBlock label="DC/AC loading ratio" unit="CAPACITY ÷ INV_CAPACITY" clickable>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart
                data={ratio}
                margin={{ top: 22, right: 10, left: 0, bottom: 0 }}
                onClick={(s) => s?.activeTooltipIndex === 0 && actions.showOversized()}
              >
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="label" {...xAxisProps} interval="preserveStartEnd" minTickGap={2} />
                <YAxis {...yAxisProps} tickFormatter={fmtCompact} />
                <Tooltip
                  cursor={cursorFill}
                  isAnimationActive={false}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const r = payload[0].payload as (typeof ratio)[number];
                    return (
                      <ChartTip
                        title={r.tone === 'warn' ? 'Inverter rated above array' : `Ratio ${r.label}`}
                        rows={[
                          {
                            color: r.tone === 'warn' ? 'var(--serious)' : 'var(--agg)',
                            value: fmtInt(r.count),
                            label: `accounts · ${fmtPct(stats.count ? r.count / stats.count : 0)}`,
                          },
                        ]}
                        foot={r.tone === 'warn' ? 'Click to list these accounts' : undefined}
                      />
                    );
                  }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={24} animationDuration={380}>
                  {ratio.map((r) => (
                    <Cell key={r.label} fill={r.tone === 'warn' ? 'var(--serious)' : 'var(--agg)'} />
                  ))}
                  <LabelList dataKey="count" position="top" formatter={(v: number) => fmtCompact(v)} {...labelStyle} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartBlock>
        </div>
      </div>

      <SidePanel title="Inverter fleet" sub="INV_CAPACITY statistics">
        <div className="stat-list">
          <StatRow k="Fleet DC/AC ratio" v={fmtFixed(stats.fleetRatio, 2)} tone="ink" />
          <StatRow k="Most common rating" v={stats.topRating == null ? '—' : `${fmtKwValue(stats.topRating)} kW`} />
          <StatRow k="Accounts" v={fmtInt(stats.count)} />
          <StatRow
            k={
              <span className="warn-inline">
                <TriangleAlert size={13} /> Inverter &gt; array
              </span>
            }
            sub={fmtPct(stats.count ? stats.oversized / stats.count : 0)}
            v={fmtInt(stats.oversized)}
            tone="warn"
            onClick={stats.oversized ? actions.showOversized : undefined}
          />
        </div>
        <div className="side-note">
          <TriangleAlert size={13} /> An inverter rated above its array usually signals a data-entry error or a pending array upgrade.
        </div>
      </SidePanel>
    </>
  );
}
