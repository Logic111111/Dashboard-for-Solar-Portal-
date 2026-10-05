import type { ReactNode } from 'react';
import { MousePointerClick } from 'lucide-react';
import { fmtFixed, fmtInt, fmtPct } from '../../lib/format';
import type { Filters, Summary } from '../data/types';
import { branchColor } from '../meta';
import { useLookups } from '../lookups';
import { ChartBlock, HBarList, SidePanel, StatRow } from './common';
import type { LensActions } from './types';

export function GeoLens({ head, summary, filters, actions }: { head: ReactNode; summary: Summary; filters: Filters; actions: LensActions }) {
  const L = useLookups();
  const branches = summary.byBranch.map((b) => ({
    id: b.branchId,
    name: L.branch.get(b.branchId)?.name ?? '?',
    color: branchColor(b.branchId),
    selected: filters.branches.includes(b.branchId),
    count: b.count,
    kw: b.kw,
  }));
  const cscs = [...summary.byCsc].sort((a, b) => b.count - a.count);

  return (
    <>
      <div className="lens-main">
        {head}
        <div className="lens-charts cols-2">
          <ChartBlock label="Accounts by branch" unit="click a branch to filter">
            <div style={{ padding: '10px 12px 10px 10px' }}>
              <HBarList
                title="Accounts by branch"
                items={branches.map((b) => ({ ...b, value: b.count }))}
                format={(v) => (
                  <>
                    {fmtInt(v)} <small>{fmtPct(summary.count ? v / summary.count : 0, 0)}</small>
                  </>
                )}
                onPick={(id) => actions.toggleBranch(Number(id))}
              />
            </div>
          </ChartBlock>
          <ChartBlock label="Array capacity by branch" unit="MW">
            <div style={{ padding: '10px 12px 10px 10px' }}>
              <HBarList
                title="Array capacity by branch"
                items={branches.map((b) => ({ ...b, value: b.kw / 1000 }))}
                format={(v) => (
                  <>
                    {fmtFixed(v, 1)} <small>MW</small>
                  </>
                )}
                onPick={(id) => actions.toggleBranch(Number(id))}
              />
            </div>
          </ChartBlock>
        </div>
      </div>

      <SidePanel
        title="CSC leaderboard"
        sub={`${cscs.length} customer service centres in scope`}
        note={
          <>
            <MousePointerClick size={13} /> Click a CSC to drill down.
          </>
        }
      >
        <div className="stat-list side-scroll-list">
          {cscs.map((c) => (
            <StatRow
              key={c.cscId}
              dot={branchColor(c.branchId)}
              k={L.csc.get(c.cscId)?.name ?? '?'}
              sub={L.branch.get(c.branchId)?.name}
              v={fmtInt(c.count)}
              tone="ink"
              onClick={() => actions.toggleCsc(c.cscId)}
            />
          ))}
          <div className="stat-row is-total no-dot">
            <span className="k">All CSCs</span>
            <span className="v is-ink">{fmtInt(summary.count)}</span>
          </div>
        </div>
      </SidePanel>
    </>
  );
}
