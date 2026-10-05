import { createContext, useContext } from 'react';
import type { BranchNode, CscNode, FeederNode, Filters, Hierarchy, PssNode } from './data/types';

export interface Lookups {
  hierarchy: Hierarchy;
  branch: Map<number, BranchNode>;
  csc: Map<number, CscNode>;
  pss: Map<number, PssNode>;
  feeder: Map<number, FeederNode>;
  cscsOf: Map<number, CscNode[]>;
  pssOf: Map<number, PssNode[]>; // by csc
  feedersOf: Map<number, FeederNode[]>; // by pss
}

const group = <T,>(items: T[], key: (t: T) => number) => {
  const m = new Map<number, T[]>();
  for (const it of items) {
    const k = key(it);
    const arr = m.get(k);
    if (arr) arr.push(it);
    else m.set(k, [it]);
  }
  return m;
};

export function buildLookups(h: Hierarchy): Lookups {
  return {
    hierarchy: h,
    branch: new Map(h.branches.map((b) => [b.id, b])),
    csc: new Map(h.cscs.map((c) => [c.id, c])),
    pss: new Map(h.pss.map((p) => [p.id, p])),
    feeder: new Map(h.feeders.map((f) => [f.id, f])),
    cscsOf: group(h.cscs, (c) => c.branchId),
    pssOf: group(h.pss, (p) => p.cscId),
    feedersOf: group(h.feeders, (f) => f.pssId),
  };
}

export const LookupsContext = createContext<Lookups | null>(null);
export const useLookups = () => useContext(LookupsContext)!;

export type GeoLevel = 'branch' | 'csc' | 'pss' | 'feeder';

/** Ancestors of a node as {branch, csc, pss}. */
function ancestry(L: Lookups, level: GeoLevel, id: number) {
  if (level === 'branch') return { branch: id };
  if (level === 'csc') return { branch: L.csc.get(id)?.branchId, csc: id };
  if (level === 'pss') {
    const p = L.pss.get(id);
    return { branch: p?.branchId, csc: p?.cscId, pss: id };
  }
  const f = L.feeder.get(id);
  const p = f ? L.pss.get(f.pssId) : undefined;
  return { branch: p?.branchId, csc: p?.cscId, pss: f?.pssId, feeder: id };
}

/**
 * Hierarchy selections are a union of nodes. Selecting a node drops any
 * selected ancestor (drill-down narrows) and any selected descendant
 * (roll-up widens), so the set never contains overlapping nodes.
 */
export function toggleGeo(f: Filters, L: Lookups, level: GeoLevel, id: number): Filters {
  const keyOf: Record<GeoLevel, 'branches' | 'cscs' | 'pss' | 'feeders'> = {
    branch: 'branches',
    csc: 'cscs',
    pss: 'pss',
    feeder: 'feeders',
  };
  const k = keyOf[level];
  if (f[k].includes(id)) return { ...f, [k]: f[k].filter((x) => x !== id) };

  const a = ancestry(L, level, id);
  const under = (lvl: GeoLevel, nodeId: number) => {
    const b = ancestry(L, lvl, nodeId) as Record<string, number | undefined>;
    return b[level] === id;
  };
  return {
    ...f,
    branches: level === 'branch' ? [...f.branches, id] : f.branches.filter((b) => b !== a.branch),
    cscs:
      level === 'csc'
        ? [...f.cscs, id]
        : level === 'branch'
          ? f.cscs.filter((c) => !under('csc', c))
          : f.cscs.filter((c) => c !== a.csc),
    pss:
      level === 'pss'
        ? [...f.pss, id]
        : level === 'feeder'
          ? f.pss.filter((p) => p !== a.pss)
          : f.pss.filter((p) => !under('pss', p)),
    feeders: level === 'feeder' ? [...f.feeders, id] : f.feeders.filter((fd) => !under('feeder', fd)),
  };
}

export const geoCount = (f: Filters) => f.branches.length + f.cscs.length + f.pss.length + f.feeders.length;
