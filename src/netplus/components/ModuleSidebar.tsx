import { memo, useState, type Dispatch, type SetStateAction } from 'react';
import { ChevronDown, ChevronRight, Database, MapPin, Network, TableProperties } from 'lucide-react';
import { cx, fmtBytes, fmtCompact, fmtInt, fmtMs } from '../../lib/format';
import { useQueryLog } from '../data/hooks';
import type { EngineInfo, Filters } from '../data/types';
import { branchColor } from '../meta';
import { geoCount, toggleGeo, useLookups } from '../lookups';

const QUERY_LABEL: Record<string, string> = {
  init: 'Boot · hierarchy',
  rows: 'Table page',
  summary: 'KPI summary',
  lens: 'Lens aggregate',
  detail: 'Account detail',
  export: 'CSV export (stream)',
};

interface Props {
  filters: Filters;
  setFilters: Dispatch<SetStateAction<Filters>>;
  engine: EngineInfo;
  open: boolean;
}

export const ModuleSidebar = memo(function ModuleSidebar({ filters, setFilters, engine, open }: Props) {
  const L = useLookups();
  const h = L.hierarchy;
  const [geoOpen, setGeoOpen] = useState(true);
  const [netOpen, setNetOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const log = useQueryLog(5);

  const isOpen = (k: string) => expanded.has(k);
  const flip = (k: string) =>
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  const geoSel = filters.branches.length + filters.cscs.length;
  const netSel = filters.pss.length + filters.feeders.length;

  return (
    <aside className={cx('sidebar', open && 'is-open')} aria-label="Net plus navigation">
      <div className="side-scroll">
        <button className="side-item is-active" aria-current="page">
          <span className="side-icon">
            <TableProperties size={17} />
          </span>
          <span className="side-text">
            <b>Customer Explorer</b>
            <small>Sort &amp; analyse net plus accounts</small>
          </span>
        </button>

        {/* ---------- geographical: branch → CSC */}
        <div className={cx('side-group', geoOpen && 'is-open')}>
          <button className="side-item" onClick={() => setGeoOpen((o) => !o)} aria-expanded={geoOpen}>
            <span className="side-icon">
              <MapPin size={17} />
              {geoSel > 0 && <span className="side-count">{geoSel}</span>}
            </span>
            <span className="side-text">
              <b>Geographical Hierarchy</b>
              <small>
                {h.branches.length} Branches → {h.cscs.length} CSC
              </small>
            </span>
            <ChevronDown size={16} className="side-chev" />
          </button>
          {geoOpen && (
            <div className="tree" role="tree">
              {h.branches.map((b) => {
                const key = `b${b.id}`;
                return (
                  <div key={b.id} role="treeitem" aria-expanded={isOpen(key)}>
                    <div className={cx('tree-row', filters.branches.includes(b.id) && 'is-selected')}>
                      <span
                        className={cx('tree-caret', isOpen(key) && 'is-open')}
                        onClick={() => flip(key)}
                        role="button"
                        aria-label={`Expand ${b.name}`}
                      >
                        <ChevronRight size={13} />
                      </span>
                      <i className="tree-dot" style={{ background: branchColor(b.id) }} />
                      <button className="tree-name" style={{ textAlign: 'left' }} onClick={() => setFilters((f) => toggleGeo(f, L, 'branch', b.id))}>
                        {b.name}
                      </button>
                      <span className="tree-num num">{fmtCompact(b.count)}</span>
                    </div>
                    {isOpen(key) && (
                      <div className="tree" role="group">
                        {(L.cscsOf.get(b.id) ?? []).map((c) => (
                          <button
                            key={c.id}
                            className={cx('tree-row', filters.cscs.includes(c.id) && 'is-selected')}
                            onClick={() => setFilters((f) => toggleGeo(f, L, 'csc', c.id))}
                            role="treeitem"
                          >
                            <span />
                            <i className="tree-dot is-hollow" />
                            <span className="tree-name">{c.name}</span>
                            <span className="tree-num num">{fmtCompact(c.count)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ---------- network: PSS → feeder */}
        <div className={cx('side-group', netOpen && 'is-open')}>
          <button className="side-item" onClick={() => setNetOpen((o) => !o)} aria-expanded={netOpen}>
            <span className="side-icon">
              <Network size={17} />
              {netSel > 0 && <span className="side-count">{netSel}</span>}
            </span>
            <span className="side-text">
              <b>Network Hierarchy</b>
              <small>
                {h.pss.length} PSS → {h.feeders.length} Feeders
              </small>
            </span>
            <ChevronDown size={16} className="side-chev" />
          </button>
          {netOpen && (
            <div className="tree" role="tree">
              {h.pss.map((p) => {
                const key = `p${p.id}`;
                return (
                  <div key={p.id} role="treeitem" aria-expanded={isOpen(key)}>
                    <div className={cx('tree-row', filters.pss.includes(p.id) && 'is-selected')}>
                      <span className={cx('tree-caret', isOpen(key) && 'is-open')} onClick={() => flip(key)} role="button" aria-label={`Expand ${p.name}`}>
                        <ChevronRight size={13} />
                      </span>
                      <i className="tree-dot" style={{ background: branchColor(p.branchId) }} />
                      <button className="tree-name mono" style={{ textAlign: 'left', fontSize: 12.5 }} onClick={() => setFilters((f) => toggleGeo(f, L, 'pss', p.id))}>
                        {p.name}
                      </button>
                      <span className="tree-num num">{fmtCompact(p.count)}</span>
                    </div>
                    {isOpen(key) && (
                      <div className="tree" role="group">
                        {(L.feedersOf.get(p.id) ?? []).map((fd) => (
                          <button
                            key={fd.id}
                            className={cx('tree-row', filters.feeders.includes(fd.id) && 'is-selected')}
                            onClick={() => setFilters((f) => toggleGeo(f, L, 'feeder', fd.id))}
                            role="treeitem"
                          >
                            <span />
                            <i className="tree-dot is-hollow" />
                            <span className="tree-name mono" style={{ fontSize: 12 }}>
                              {fd.name}
                            </span>
                            <span className="tree-num num">{fmtCompact(fd.count)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {geoCount(filters) > 0 && (
          <button className="btn is-ghost" style={{ alignSelf: 'flex-start', marginLeft: 8 }} onClick={() => setFilters((f) => ({ ...f, branches: [], cscs: [], pss: [], feeders: [] }))}>
            Clear hierarchy selection
          </button>
        )}
      </div>

      {/* ---------- engine telemetry */}
      <div className="engine">
        <div className="engine-head">
          <span className="engine-title">
            <span className="live-dot" /> {engine.engine}
          </span>
          <span className="engine-ver mono" title="Connected database">
            {engine.database}
          </span>
        </div>
        <div className="engine-stats">
          <div className="engine-stat">
            <b className="num">{fmtInt(engine.rows)}</b>
            <span>rows</span>
          </div>
          <div className="engine-stat">
            <b className="num">{fmtBytes(engine.dbBytes)}</b>
            <span>{engine.indexes.length} indexes</span>
          </div>
        </div>
        <div className="qlog" aria-label="Recent queries">
          {log.map((l) => (
            <div key={l.n} className="qlog-row">
              <span>
                <Database size={11} style={{ verticalAlign: -1, marginRight: 6 }} />
                <b>{QUERY_LABEL[l.type] ?? l.type}</b>
              </span>
              <span className={cx('ms mono', l.ms < 16 && 'is-fast')} title={`PostgreSQL ${fmtMs(l.ms)} · round trip ${fmtMs(l.rt)}`}>
                {fmtMs(l.ms)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
});
