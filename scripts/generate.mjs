// Deterministic synthetic Net Plus dataset shared by the database loaders.
// createDataset() returns the network hierarchy plus a generator of customer
// rows in the source export's column order.

export function createDataset(rows = 200_000, seed = 20260930) {
// ---------------------------------------------------------------- random ---
function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(seed);
const randInt = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const pad = (n, w = 2) => String(n).padStart(w, '0');
function normal() {
  let u = 0;
  while (u === 0) u = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd());
}
const lognormal = (median, sigma) => median * Math.exp(sigma * normal());
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
/** Cumulative-weight sampler: O(log n) per draw. */
function sampler(weights) {
  const cum = new Float64Array(weights.length);
  let acc = 0;
  weights.forEach((w, i) => (cum[i] = acc += w));
  return () => {
    const r = rnd() * acc;
    let lo = 0;
    let hi = cum.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] < r) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
}

// ------------------------------------------------------------- hierarchy ---
// Branch weights follow the relative daily peaks of the existing forecast view.
const BRANCHES = [
  { name: 'GALLE', prefix: '07', weight: 11.7, cscs: [['Galle', 'GAL'], ['Hikkaduwa', 'HKD'], ['Ambalangoda', 'AMB']] },
  { name: 'KALUTARA', prefix: '06', weight: 11.1, cscs: [['Kalutara', 'KLT'], ['Panadura', 'PND'], ['Beruwala', 'BRW']] },
  { name: 'KELANIYA', prefix: '03', weight: 18.4, cscs: [['Kelaniya', 'KLN'], ['Wattala', 'WTL'], ['Kiribathgoda', 'KBG'], ['Kadawatha', 'KDW']] },
  { name: 'KOTTE', prefix: '04', weight: 13.6, cscs: [['Kotte', 'KTE'], ['Battaramulla', 'BTM'], ['Rajagiriya', 'RJG']] },
  { name: 'MORATUWA', prefix: '05', weight: 20.2, cscs: [['Moratuwa', 'MRT'], ['Ratmalana', 'RTM'], ['Dehiwala', 'DHW']] },
  { name: 'NEGOMBO', prefix: '02', weight: 15.5, cscs: [['Negombo', 'NGB'], ['Ja-Ela', 'JAE'], ['Katunayake', 'KTN'], ['Kochchikade', 'KCK']] },
  { name: 'NUGEGODA', prefix: '01', weight: 18.4, cscs: [['Nugegoda', 'NUG'], ['Maharagama', 'MHR'], ['Boralesgamuwa', 'BRG']] },
];
const SINGLE_PSS_CSCS = new Set(['BRW', 'KCK']); // 21 x 2 + 2 x 1 = 44 PSS
const FOUR_FEEDER_PSS = 15; // 15 x 4 + 29 x 3 = 147 feeders

const branches = [];
const cscs = [];
const pss = [];
const feeders = [];
const transformers = [];

BRANCHES.forEach((b, bi) => {
  const branchId = bi + 1;
  branches.push({ id: branchId, name: b.name, prefix: b.prefix });
  for (const [cscName, cscCode] of b.cscs) {
    const cscId = cscs.length + 1;
    cscs.push({ id: cscId, name: cscName, code: cscCode, branchId });
    const pssCount = SINGLE_PSS_CSCS.has(cscCode) ? 1 : 2;
    for (let p = 1; p <= pssCount; p++) {
      pss.push({ id: pss.length + 1, name: `${cscCode}-P${p}`, cscId, branchId });
    }
  }
});

const fourFeeder = new Set(shuffle(pss.map((p) => p.id)).slice(0, FOUR_FEEDER_PSS));
const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const prefixes = shuffle([...letters].flatMap((a) => [...letters].map((b) => a + b)));

for (const p of pss) {
  const n = fourFeeder.has(p.id) ? 4 : 3;
  for (let f = 1; f <= n; f++) {
    const feederId = feeders.length + 1;
    const csc = cscs[p.cscId - 1];
    feeders.push({ id: feederId, name: `${p.name}-F${f}`, pssId: p.id, cscId: csc.id, branchId: p.branchId });
    // Transformer code: 2-letter feeder prefix + 2-digit section + 2-digit sequence, e.g. AZ0102
    const tfPrefix = prefixes[feederId - 1];
    const count = randInt(45, 75);
    for (let k = 0; k < count; k++) {
      transformers.push({
        code: `${tfPrefix}${pad(1 + Math.floor(k / 15))}${pad(1 + (k % 15))}`,
        feederId,
        pssId: p.id,
        cscId: csc.id,
        branchId: p.branchId,
      });
    }
  }
}

// Each transformer draws customers in proportion to its branch weight, with a
// lognormal spread so a few transformers become solar hot-spots.
const tfPerBranch = new Map();
for (const t of transformers) tfPerBranch.set(t.branchId, (tfPerBranch.get(t.branchId) ?? 0) + 1);
const tfWeights = transformers.map(
  (t) => (BRANCHES[t.branchId - 1].weight / tfPerBranch.get(t.branchId)) * Math.exp(0.75 * normal()),
);
const totalTfWeight = tfWeights.reduce((a, b) => a + b, 0);
const drawTransformer = sampler(tfWeights);

// Poles: a handful of customers share a pole; codes look like PN69C.
const poleLetters = 'ABCDEFGHJKLMNPRSTUVW';
transformers.forEach((t, i) => {
  const expected = (rows * tfWeights[i]) / totalTfWeight;
  const count = Math.max(1, Math.round(expected / (1.3 + rnd() * 1.4)));
  const codes = new Set();
  while (codes.size < count) {
    codes.add(`P${pick(poleLetters)}${pad(randInt(1, 99))}${'ABCDEFGH'[randInt(0, 7)]}`);
  }
  t.poles = [...codes];
});

// ------------------------------------------------------------- timeline ---
// Monthly connection weights: scheme launch 2016, COVID lull 2020, crisis
// surge 2022–23, tariff revision cool-down 2024, steady since.
const YEAR_RATE = { 2016: 3.2, 2017: 5.8, 2018: 7.4, 2019: 8.6, 2020: 7.2, 2021: 9.4, 2022: 14.8, 2023: 18.5, 2024: 11.2, 2025: 9.6, 2026: 9.1 };
const SPECIAL = { '2020-04': 0.12, '2020-05': 0.45, '2021-05': 0.7, '2021-06': 0.75, '2022-03': 0.8, '2022-04': 0.7, '2024-01': 1.35, '2024-02': 1.25 };
const months = [];
for (let y = 2016; y <= 2026; y++) {
  for (let m = 1; m <= 12; m++) {
    if (y === 2026 && m > 9) break;
    const key = `${y}-${pad(m)}`;
    const trend = y === 2022 ? 0.65 + (m / 12) * 0.8 : 1;
    const season = 1 + 0.1 * Math.sin(((m - 2) / 12) * 2 * Math.PI);
    months.push({ y, m, w: YEAR_RATE[y] * trend * season * (SPECIAL[key] ?? 1) });
  }
}
const drawMonth = sampler(months.map((x) => x.w));
const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

function sampleDate() {
  const { y, m } = months[drawMonth()];
  const maxDay = y === 2026 && m === 9 ? 29 : daysIn(y, m);
  let d;
  let dow;
  do {
    d = randInt(1, maxDay);
    dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  } while ((dow === 0 || dow === 6) && rnd() < 0.88);
  const office = rnd() < 0.93;
  const hh = office ? randInt(8, 16) : randInt(0, 23);
  return { y, iso: `${y}-${pad(m)}-${pad(d)} ${pad(hh)}:${pad(randInt(0, 59))}:${pad(randInt(0, 59))}` };
}

// ------------------------------------------------------------- capacity ---
const MODULE_W = { 2016: 265, 2017: 285, 2018: 320, 2019: 340, 2020: 370, 2021: 405, 2022: 450, 2023: 540, 2024: 550, 2025: 580, 2026: 600 };
const SEGMENTS = [
  { p: 0.62, median: 5.2, sigma: 0.42 },
  { p: 0.26, median: 14, sigma: 0.28 },
  { p: 0.09, median: 34, sigma: 0.33 },
  { p: 0.025, median: 88, sigma: 0.42 },
  { p: 0.005, median: 290, sigma: 0.5 },
];
const drawSegment = sampler(SEGMENTS.map((s) => s.p));
const INV_RATINGS = [1, 1.5, 2, 2.5, 3, 3.6, 4, 4.6, 5, 6, 8, 10, 12, 15, 17, 20, 25, 30, 33, 36, 40, 50, 60, 75, 80, 100, 110, 125, 150, 200, 250, 300, 500, 750, 1000];

function sampleCapacity(year) {
  const s = SEGMENTS[drawSegment()];
  const target = Math.min(1000, Math.max(1, lognormal(s.median, s.sigma)));
  if (rnd() < 0.64) {
    return target >= 50 ? Math.max(50, Math.round(target / 5) * 5) : Math.max(1, Math.round(target));
  }
  const w = MODULE_W[year];
  const panels = Math.max(2, Math.round((target * 1000) / w));
  return Math.round(panels * w) / 1000;
}

function sampleInverter(cap) {
  if (rnd() < 0.012) {
    // data-quality outlier: inverter rated above the array capacity
    return INV_RATINGS.find((r) => r > cap) ?? cap;
  }
  if (Number.isInteger(cap) && INV_RATINGS.includes(cap) && rnd() < 0.3) return cap;
  const ratio = 1 + Math.abs(normal()) * 0.11;
  const target = cap / ratio;
  let best = INV_RATINGS[0];
  for (const r of INV_RATINGS) if (r <= target + 1e-9) best = r;
  return best;
}

  function* customers() {
    const usedAccounts = new Set();
    for (let i = 0; i < rows; i++) {
      const t = transformers[drawTransformer()];
      const branch = branches[t.branchId - 1];
      let acct;
      do acct = branch.prefix + pad(randInt(0, 99_999_999), 8);
      while (usedAccounts.has(acct));
      usedAccounts.add(acct);
      const { y, iso } = sampleDate();
      const cap = sampleCapacity(y);
      const pole = t.poles[Math.floor(t.poles.length * rnd() ** 1.35)];
      yield {
        account: acct,
        transformer: t.code,
        pole,
        capacity: cap,
        inverter: sampleInverter(cap),
        date: iso,
        branchId: t.branchId,
        cscId: t.cscId,
        pssId: t.pssId,
        feederId: t.feederId,
      };
    }
  }

  return { rows, seed, branches, cscs, pss, feeders, transformers, customers };
}
