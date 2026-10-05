import { memo, useMemo, type ReactNode } from 'react';
import { ArrowDownWideNarrow, ArrowUpNarrowWide, Cpu, Gauge, Map as MapIcon, Network, TrendingUp, UtilityPole, type LucideIcon } from 'lucide-react';
import { cx } from '../../lib/format';
import type { Filters, LensData, LensKey, Sort, Summary } from '../data/types';
import { LENS_META, LENS_ORDER, SORT_META } from '../meta';
import { CapacityLens } from '../charts/CapacityLens';
import { GeoLens } from '../charts/GeoLens';
import { InverterLens } from '../charts/InverterLens';
import { PoleLens } from '../charts/PoleLens';
import { TimelineLens } from '../charts/TimelineLens';
import { TransformerLens } from '../charts/TransformerLens';
import type { LensActions } from '../charts/types';

const LENS_ICON: Record<LensKey, LucideIcon> = {
  timeline: TrendingUp,
  capacity: Gauge,
  inverter: Cpu,
  transformer: Network,
  pole: UtilityPole,
  geo: MapIcon,
};
const LENS_TAB: Record<LensKey, string> = {
  timeline: 'Timeline',
  capacity: 'Capacity',
  inverter: 'Inverter',
  transformer: 'Transformer',
  pole: 'Pole',
  geo: 'Geography',
};

interface Props {
  lens: LensKey;
  sort: Sort;
  data: LensData | null;
  pending: boolean;
  summary: Summary | null;
  filters: Filters;
  onLens: (l: LensKey) => void;
  actions: LensActions;
}

/** The chart panel follows the table's sort column: each sort key has its own lens. */
export const SortLens = memo(function SortLens({ lens, sort, data, pending, summary, filters, onLens, actions }: Props) {
  const shown = data;
  const stale = pending || !shown || shown.kind !== lens;
  const DirIcon = sort.dir === 'desc' ? ArrowDownWideNarrow : ArrowUpNarrowWide;
  const shownKind = shown?.kind ?? lens;

  const head = useMemo(
    () => (
      <div className="lens-caption">
        <div>
          <h3>{LENS_META[shownKind].title}</h3>
          <p>{LENS_META[shownKind].subtitle}</p>
        </div>
      </div>
    ),
    [shownKind],
  );

  // Charts only re-render when their data changes — not on every sort click.
  const body = useMemo((): ReactNode => {
    if (!shown) return null;
    switch (shown.kind) {
      case 'timeline':
        return <TimelineLens head={head} monthly={shown.monthly} summary={summary} actions={actions} />;
      case 'capacity':
        return <CapacityLens head={head} data={shown} actions={actions} />;
      case 'inverter':
        return <InverterLens head={head} data={shown} actions={actions} />;
      case 'transformer':
        return <TransformerLens head={head} data={shown} actions={actions} />;
      case 'pole':
        return <PoleLens head={head} data={shown} actions={actions} />;
      case 'geo':
        return <GeoLens head={head} summary={shown.summary} filters={filters} actions={actions} />;
    }
  }, [shown, head, summary, filters, actions]);

  return (
    <section className="card lens" aria-label="Sort lens charts">
      <header className="card-head">
        <div className="card-title">
          <span className="title-bar" />
          <h2>Sort Lens</h2>
          <span className="pill" title="The charts follow the table's sort column">
            <DirIcon size={13} />
            follows <span className="mono">{SORT_META[sort.key].column}</span>
          </span>
        </div>
        <div className="lens-tabs" role="tablist" aria-label="Choose a lens (also sorts the table)">
          {LENS_ORDER.map((k) => {
            const Icon = LENS_ICON[k];
            return (
              <button
                key={k}
                role="tab"
                aria-selected={k === lens}
                className={cx('lens-tab', k === lens && 'is-active')}
                onClick={() => onLens(k)}
                title={`Sort by ${SORT_META[LENS_META[k].sort].column}`}
              >
                <Icon size={14} />
                {LENS_TAB[k]}
              </button>
            );
          })}
        </div>
      </header>
      <div className={cx('lens-body', stale && 'is-refreshing')}>
        {body ?? (
          <>
            <div className="lens-main">
              {head}
              <div className="skel" style={{ height: 240, borderRadius: 12 }} />
            </div>
            <aside className="lens-side">
              <div className="skel" style={{ height: 200, borderRadius: 8 }} />
            </aside>
          </>
        )}
      </div>
    </section>
  );
});
