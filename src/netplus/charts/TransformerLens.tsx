import type { ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { MousePointerClick } from 'lucide-react';
import { fmtCompact, fmtFixed, fmtInt, fmtPowerText } from '../../lib/format';
import type { LensData } from '../data/types';
import { branchColor } from '../meta';
import { useLookups } from '../lookups';
import { ChartBlock, ChartTip, HBarList, MONO, SidePanel, StatRow, cursorFill, labelStyle, xAxisProps } from './common';
import type { LensActions } from './types';

type Data = Extract<LensData, { kind: 'transformer' }>;

export function TransformerLens({ head, data, actions }: { head: ReactNode; data: Data; actions: LensActions }) {
  const L = useLookups();
  const { top, stats } = data;
  const present = [...new Set(top.map((t) => t.branchId))].sort((a, b) => a - b);

  return (
    <>
      <div className="lens-main">
        {head}
        <div className="lens-charts">
          <ChartBlock label={`Top ${top.length} transformers by connected net plus capacity`} unit="kW · click to filter" clickable>
            <ResponsiveContainer width="100%" height={Math.max(220, top.length * 22 + 36)}>
              <BarChart
                layout="vertical"
                data={top}
                margin={{ top: 4, right: 70, left: 4, bottom: 0 }}
                barCategoryGap={4}
                onClick={(s) => {
                  const t = s?.activeTooltipIndex != null ? top[s.activeTooltipIndex] : null;
                  if (t) actions.pickTransformer(t.code);
                }}
              >
                <CartesianGrid horizontal={false} stroke="var(--grid)" />
                <XAxis type="number" {...xAxisProps} tickFormatter={(v: number) => fmtCompact(v)} />
                <YAxis
                  type="category"
                  dataKey="code"
                  width={74}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--axis)' }}
                  tick={{ fill: 'var(--ink-2)', fontSize: 11.5, fontFamily: MONO }}
                  interval={0}
                />
                <Tooltip
                  cursor={cursorFill}
                  isAnimationActive={false}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const t = payload[0].payload as (typeof top)[number];
                    return (
                      <ChartTip
                        title={
                          <>
                            <span className="mono">{t.code}</span> · {L.branch.get(t.branchId)?.name}
                          </>
                        }
                        rows={[
                          { color: branchColor(t.branchId), value: fmtPowerText(t.kw), label: 'connected array capacity' },
                          { color: 'var(--ink-4)', value: fmtInt(t.count), label: 'net plus accounts' },
                          { color: 'var(--ink-4)', value: `${fmtFixed(t.kw / Math.max(1, t.count), 1)} kW`, label: 'per account' },
                        ]}
                        foot="Click to list this transformer's accounts"
                      />
                    );
                  }}
                />
                <Bar dataKey="kw" radius={[0, 4, 4, 0]} maxBarSize={14} animationDuration={380}>
                  {top.map((t) => (
                    <Cell key={t.code} fill={branchColor(t.branchId)} />
                  ))}
                  <LabelList dataKey="kw" position="right" formatter={(v: number) => fmtPowerText(v)} {...labelStyle} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartBlock>
          <div className="legend" aria-label="Branch legend">
            {present.map((b) => (
              <span key={b} className="legend-item">
                <i style={{ background: branchColor(b) }} />
                {L.branch.get(b)?.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      <SidePanel
        title="LV network load"
        sub="Net plus accounts per transformer"
        note={
          <>
            <MousePointerClick size={13} /> Click a bar to list that transformer's accounts.
          </>
        }
      >
        <div className="stat-list">
          <StatRow k="Transformers in scope" v={fmtInt(stats.transformers)} tone="ink" />
          <StatRow k="Avg accounts / transformer" v={fmtFixed(stats.avgAccounts, 1)} />
          <StatRow k="Avg capacity / transformer" v={`${fmtFixed(stats.avgKw, 1)} kW`} />
          <StatRow k="Most accounts on one" v={fmtInt(stats.maxAccounts)} />
          <StatRow k="Transformers ≥ 1 MW solar" v={fmtInt(stats.overMw)} tone={stats.overMw ? 'warn' : undefined} />
        </div>
        <div className="side-sub" style={{ borderBottom: 0, borderTop: '1px solid var(--line)', marginTop: 6, paddingTop: 10 }}>
          Transformers by account count
        </div>
        <HBarList
          title="Transformers by account count"
          items={data.dist.map((d) => ({ id: d.label, name: `${d.label} acc.`, color: 'var(--agg)', value: d.count }))}
          format={(v) => fmtInt(v)}
        />
      </SidePanel>
    </>
  );
}
