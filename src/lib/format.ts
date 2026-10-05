const int = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const fmtInt = (n: number) => int.format(Math.round(n));
export const fmtCompact = (n: number) => compact.format(n);
export const fmtFixed = (n: number, d: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

/** Capacity values as they appear in the source data: 17, 5.4, 10.08 */
export const fmtKwValue = (n: number) =>
  Number.isInteger(n) ? int.format(n) : n.toLocaleString('en-US', { maximumFractionDigits: 2 });

/** Picks kW or MW so the number stays readable. */
export function fmtPower(kw: number, digits = 1): { value: string; unit: 'kW' | 'MW' } {
  if (Math.abs(kw) >= 1000) return { value: fmtFixed(kw / 1000, digits), unit: 'MW' };
  return { value: fmtKwValue(Math.round(kw * 100) / 100), unit: 'kW' };
}
export const fmtPowerText = (kw: number, digits = 1) => {
  const p = fmtPower(kw, digits);
  return `${p.value} ${p.unit}`;
};

export const fmtPct = (n: number, d = 1) => `${fmtFixed(n * 100, d)}%`;

export const ymLabel = (ym: number) => `${MONTHS[(ym % 100) - 1]} ${Math.floor(ym / 100)}`;
export const ymShort = (ym: number) => `${MONTHS[(ym % 100) - 1]} ’${String(Math.floor(ym / 100)).slice(2)}`;

/** ISO 'YYYY-MM-DD HH:MM:SS' → 'Sep 23, 2020' */
export const fmtDate = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}, ${iso.slice(0, 4)}`;
export const fmtTime = (iso: string) => iso.slice(11, 16);
/** 'YYYY-MM-DD' → 'Feb 21, 2024' */
export const fmtDay = (d: string) => fmtDate(d);
/** Local calendar date as 'YYYY-MM-DD' */
export const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** Last day of the month containing 'YYYY-MM-DD' */
export const monthEnd = (d: string) => isoDay(new Date(Number(d.slice(0, 4)), Number(d.slice(5, 7)), 0));
/** First and last day of a yyyymm month */
export const monthRange = (ym: number): [string, string] => {
  const first = `${Math.floor(ym / 100)}-${String(ym % 100).padStart(2, '0')}-01`;
  return [first, monthEnd(first)];
};

/** Source export layout: 'MM/DD/YYYY HH:MM:SS' */
export const fmtSourceDate = (iso: string) => `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)} ${iso.slice(11)}`;

export function fmtMs(ms: number) {
  if (ms < 1) return `${ms.toFixed(2)} ms`;
  if (ms < 100) return `${ms.toFixed(1)} ms`;
  return `${Math.round(ms)} ms`;
}

export const fmtBytes = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);

/** '5y 7m' since the connection date */
export function tenure(iso: string, now = new Date()) {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  let months = (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m);
  if (now.getDate() < Number(iso.slice(8, 10))) months -= 1;
  months = Math.max(0, months);
  if (months === 0) return 'under a month';
  const yy = Math.floor(months / 12);
  const mm = months % 12;
  return yy ? `${yy}y ${mm}m` : `${mm}m`;
}

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');
