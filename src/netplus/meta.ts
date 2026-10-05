import type { LensKey, SortDir, SortKey } from './data/types';

export interface SortMeta {
  label: string;
  /** source column name shown as a caption */
  column: string;
  lens: LensKey;
  defaultDir: SortDir;
}

export const SORT_META: Record<SortKey, SortMeta> = {
  account: { label: 'Account No', column: 'ACCOUNT_NO', lens: 'geo', defaultDir: 'asc' },
  transformer: { label: 'Transformer', column: 'TRANSFORMER_CODE', lens: 'transformer', defaultDir: 'asc' },
  pole: { label: 'Pole', column: 'POLE', lens: 'pole', defaultDir: 'asc' },
  capacity: { label: 'Capacity', column: 'CAPACITY', lens: 'capacity', defaultDir: 'desc' },
  inverter: { label: 'Inverter', column: 'INV_CAPACITY', lens: 'inverter', defaultDir: 'desc' },
  date: { label: 'Connected', column: 'NET_CON_START_DATE', lens: 'timeline', defaultDir: 'desc' },
  branch: { label: 'Branch / CSC', column: 'BRANCH', lens: 'geo', defaultDir: 'asc' },
};

export interface LensMeta {
  title: string;
  subtitle: string;
  sort: SortKey;
}

export const LENS_META: Record<LensKey, LensMeta> = {
  timeline: { title: 'Connection timeline', subtitle: 'New connections per month · cumulative array capacity', sort: 'date' },
  capacity: { title: 'Capacity profile', subtitle: 'How system sizes are distributed', sort: 'capacity' },
  inverter: { title: 'Inverter profile', subtitle: 'Inverter ratings and DC/AC loading', sort: 'inverter' },
  transformer: { title: 'Transformer concentration', subtitle: 'Where net plus capacity clusters on the LV network', sort: 'transformer' },
  pole: { title: 'Pole sharing', subtitle: 'How many accounts hang off each pole', sort: 'pole' },
  geo: { title: 'Geography', subtitle: 'Accounts and capacity by branch and CSC', sort: 'branch' },
};

export const LENS_ORDER: LensKey[] = ['timeline', 'capacity', 'inverter', 'transformer', 'pole', 'geo'];

/** Branch identity colours — validated categorical slots, fixed order (see styles/tokens.css). */
export const branchColor = (branchId: number) => `var(--b${branchId})`;
