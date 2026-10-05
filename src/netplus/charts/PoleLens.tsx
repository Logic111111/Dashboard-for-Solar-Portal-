import type { ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { TriangleAlert, UtilityPole } from 'lucide-react';
import { fmtCompact, fmtFixed, fmtInt, fmtPct } from '../../lib/format';
import type { LensData } from '../data/types';
import { ChartBlock, ChartTip, SidePanel, StatRow, cursorFill, gridProps, labelStyle, xAxisProps, yAxisProps } from './common';
import type { LensActions } from './types';

type Data = Extract<LensData, { kind: 'pole' }>;

export function PoleLens({ head, data, actions }: { head: ReactNode; data: Data; actions: LensActions }) {
  const { stats } = data;
  const dist = data.dist.map((d) => ({ ...d, crowded: d.n >= 5 }));

  return (
    <>
      <div className="lens-main">
        {head}
        <div className="lens-charts">
          <ChartBlock label="Poles by number of net plus accounts attached" unit="x: accounts on the pole · y: poles">
            <ResponsiveContainer width="100%" height={270}>
              <BarChart data={dist} margin={{ top: 22, right: 14, left: 0, bottom: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis
                  dataKey="label"
                  {...xAxisProps}
                  interval={0}
                />
                <YAxis {...yAxisProps} tickFormatter={fmtCompact} />
                <Tooltip
                  cursor={cursorFill}
                  isAnimationActive={false}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload as (typeof dist)[number];
                    return (
                      <ChartTip
                        title={`Poles with ${d.label} account${d.n === 1 ? '' : 's'}`}
                        rows={[
                          {
                            color: d.crowded ? 'var(--serious)' : 'var(--agg)',
                            value: fmtInt(d.poles),
                            label: `poles · ${fmtPct(stats.poles ? d.poles / stats.poles : 0)}`,
                          },
                        ]}
                        foot={d.crowded ? '5 or more systems on one pole' : undefined}
                      />
                    );
                  }}
                />
                <Bar dataKey="poles" radius={[4, 4, 0, 0]} maxBarSize={24} animationDuration={380}>
                  {dist.map((d) => (
                    <Cell key={d.label} fill={d.crowded ? 'var(--serious)' : 'var(--agg)'} />
                  ))}
                  <LabelList dataKey="poles" position="top" formatter={(v: number) => (v ? fmtCompact(v) : '')} {...labelStyle} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartBlock>
          <div className="legend">
            <span className="legend-item">
              <i style={{ background: 'var(--agg)' }} /> 1–4 accounts
            </span>
            <span className="legend-item">
              <i style={{ background: 'var(--serious)' }} />
              <TriangleAlert size={12} /> 5 or more (crowded)
            </span>
          </div>
        </div>
      </div>

      <SidePanel title="Pole sharing" sub="Distinct (transformer, pole) pairs">
        <div className="stat-list">
          <StatRow k="Poles with net plus" v={fmtInt(stats.poles)} tone="ink" />
          <StatRow k="Avg accounts / pole" v={fmtFixed(stats.avgPerPole, 2)} />
          <StatRow
            k={
              <span className="warn-inline">
                <TriangleAlert size={13} /> Crowded poles (5+)
              </span>
            }
            v={fmtInt(stats.crowded)}
            tone="warn"
          />
        </div>
        <div className="side-sub" style={{ borderBottom: 0, borderTop: '1px solid var(--line)', marginTop: 6, paddingTop: 10 }}>
          Most shared poles
        </div>
        <div className="stat-list">
          {data.top.map((p) => (
            <StatRow
              key={p.transformer + p.pole}
              k={
                <span className="mono">
                  <UtilityPole size={12} style={{ verticalAlign: -1, marginRight: 6, color: 'var(--ink-3)' }} />
                  {p.pole}
                </span>
              }
              sub={<span className="mono">{p.transformer}</span>}
              v={`${p.count} acc.`}
              tone="ink"
              onClick={() => actions.pickTransformer(p.transformer)}
            />
          ))}
        </div>
      </SidePanel>
    </>
  );
}
