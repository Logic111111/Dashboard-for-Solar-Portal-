import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { Database, Layers, Zap } from 'lucide-react';
import { fmtBytes, fmtInt, monthRange } from '../lib/format';
import { api } from './data/client';
import { useDebounced, useSqlQuery } from './data/hooks';
import { EMPTY_FILTERS, type Filters, type InitResult, type LensData, type LensKey, type Sort, type SortKey, type Summary } from './data/types';
import { LENS_META, SORT_META } from './meta';
import { buildLookups, LookupsContext, toggleGeo } from './lookups';
import type { LensActions } from './charts/types';
import { DataGrid } from './components/DataGrid';
import { DetailDrawer } from './components/DetailDrawer';
import { FilterBar } from './components/FilterBar';
import { KpiRow } from './components/KpiRow';
import { ModuleSidebar } from './components/ModuleSidebar';
import { SortLens } from './components/SortLens';

interface Props {
  init: InitResult;
  sidebarOpen: boolean;
  onCloseSidebar: () => void;
  notify: (msg: string) => void;
}

export function NetPlusModule({ init, sidebarOpen, onCloseSidebar, notify }: Props) {
  const lookups = useMemo(() => buildLookups(init.hierarchy), [init.hierarchy]);
  const { engine, hierarchy } = init;

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [searchText, setSearchText] = useState('');
  const [sort, setSort] = useState<Sort>({ key: 'date', dir: 'desc' });
  const [selected, setSelected] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  const search = useDebounced(searchText, 160);
  const effective = useMemo(() => ({ ...filters, search }), [filters, search]);
  const fkey = useMemo(() => JSON.stringify(effective), [effective]);
  const lens = SORT_META[sort.key].lens;

  const summary = useSqlQuery<Summary>({ type: 'summary', filters: effective }, fkey);
  const lensData = useSqlQuery<LensData>({ type: 'lens', filters: effective, lens }, `${fkey}|${lens}`);
  // Charts render at low priority: a new table page always commits first.
  const deferredLens = useDeferredValue(lensData.data);
  const deferredSummary = useDeferredValue(summary.data);

  // ------------------------------------------------------------ actions ---
  const onSort = useCallback((key: SortKey) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: SORT_META[key].defaultDir }));
  }, []);
  const onSortDir = useCallback(() => setSort((s) => ({ ...s, dir: s.dir === 'asc' ? 'desc' : 'asc' })), []);
  const onLens = useCallback(
    (l: LensKey) => {
      if (l === lens) return;
      const key = LENS_META[l].sort;
      setSort({ key, dir: SORT_META[key].defaultDir });
    },
    [lens],
  );

  const actions: LensActions = useMemo(
    () => ({
      pickMonth: (ym) => {
        const [fromDate, toDate] = monthRange(ym);
        setFilters((f) => ({ ...f, fromDate, toDate }));
      },
      pickCapacity: (capMin, capMax) => setFilters((f) => ({ ...f, capMin, capMax })),
      pickInverter: (r) => setFilters((f) => ({ ...f, invMin: r, invMax: r + 0.001 })),
      showOversized: () => setFilters((f) => ({ ...f, oversized: true })),
      pickTransformer: (code) => setFilters((f) => ({ ...f, transformer: code })),
      toggleBranch: (id) => setFilters((f) => toggleGeo(f, lookups, 'branch', id)),
      toggleCsc: (id) => setFilters((f) => toggleGeo(f, lookups, 'csc', id)),
    }),
    [lookups],
  );

  const clearAll = useCallback(() => {
    setFilters(EMPTY_FILTERS);
    setSearchText('');
  }, []);

  const onExport = useCallback(async () => {
    setExporting(true);
    try {
      const { blob, rows, rt } = await api.exportCsv(effective, sort);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `net_plus_customers_${sort.key}_${sort.dir}_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      notify(`Exported ${fmtInt(rows)} rows in source format (${fmtBytes(blob.size)}, ${Math.round(rt)} ms)`);
    } catch (e) {
      notify(`Export failed: ${(e as Error).message}`);
    } finally {
      setExporting(false);
    }
  }, [effective, sort, notify]);

  const closeDrawer = useCallback(() => setSelected(null), []);

  return (
    <LookupsContext.Provider value={lookups}>
      <div className="workspace">
        {sidebarOpen && <div className="scrim" style={{ zIndex: 74 }} onClick={onCloseSidebar} />}
        <ModuleSidebar filters={filters} setFilters={setFilters} engine={engine} open={sidebarOpen} />

        <main className="main">
          <section className="page-head">
            <div>
              <div className="eyebrow">Net Plus · Customer Explorer</div>
              <h1>Net Plus Customers</h1>
              <p>
                <b>{fmtInt(engine.rows)}</b> accounts across {hierarchy.branches.length} branches, {hierarchy.cscs.length} CSCs and{' '}
                {fmtInt(hierarchy.transformers)} transformers. Sort any column and the Sort Lens charts follow it.
              </p>
            </div>
            <div className="head-badges">
              <span className="badge">
                <Database size={13} /> {engine.engine} · {engine.database}
              </span>
              <span className="badge">
                <Layers size={13} /> {engine.indexes.length} indexes · {fmtBytes(engine.dbBytes)}
              </span>
              <span className="badge is-accent">
                <Zap size={13} /> {engine.source === 'synthetic' ? 'Synthetic data' : 'Live data'}
              </span>
            </div>
          </section>

          <FilterBar
            filters={filters}
            setFilters={setFilters}
            searchText={searchText}
            setSearchText={setSearchText}
            count={summary.data?.count ?? null}
            total={engine.rows}
          />

          <KpiRow summary={summary.data} pending={summary.pending} totalRows={engine.rows} />

          <SortLens
            lens={lens}
            sort={sort}
            data={deferredLens}
            pending={lensData.pending || deferredLens !== lensData.data}
            summary={deferredSummary}
            filters={filters}
            onLens={onLens}
            actions={actions}
          />

          <DataGrid
            filters={effective}
            sort={sort}
            onSort={onSort}
            onSortDir={onSortDir}
            selectedId={selected}
            onSelect={setSelected}
            onExport={onExport}
            exporting={exporting}
            onClearFilters={clearAll}
          />
        </main>
      </div>

      {selected != null && (
        <DetailDrawer
          id={selected}
          onClose={closeDrawer}
          onSelect={setSelected}
          onFilterTransformer={(code) => {
            setFilters((f) => ({ ...f, transformer: code }));
            setSelected(null);
          }}
          onFilterFeeder={(id) => {
            setFilters((f) => toggleGeo({ ...f, feeders: f.feeders.filter((x) => x !== id) }, lookups, 'feeder', id));
            setSelected(null);
          }}
        />
      )}
    </LookupsContext.Provider>
  );
}
