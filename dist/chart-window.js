/** View-only algorithms. Source arrays stay complete, chronological and unmodified. */
const dateOf = row => row.date;

export function lowerBoundDate(rows, date, readDate = dateOf) {
  let lo = 0, hi = rows.length;
  while (lo < hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (readDate(rows[mid]) < date) lo = mid + 1; else hi = mid;
  }
  return lo;
}

export function upperBoundDate(rows, date, readDate = dateOf) {
  let lo = 0, hi = rows.length;
  while (lo < hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (readDate(rows[mid]) <= date) lo = mid + 1; else hi = mid;
  }
  return lo;
}

/** Inclusive window: O(log N + V), with no full-series cache or stale identity key. */
export function dateWindow(rows, start, end, readDate = dateOf) {
  if (!rows.length || end < start) return [];
  const first = lowerBoundDate(rows, start, readDate);
  return rows.slice(first, upperBoundDate(rows, end, readDate));
}

/** Complete nonoverlapping intervals ordered by end date, e.g. UTC volume weeks. */
export function intervalAtDate(rows, date) {
  const candidate = rows[lowerBoundDate(rows, date)];
  return candidate && date >= (candidate.startDate || candidate.date) && date <= (candidate.endDate || candidate.date) ? candidate : null;
}

/**
 * Display-only, chronological first/last/min/max points in each occupied pixel.
 * Extrema for EVERY requested field survive, unlike every-kth-point sampling.
 * O(V K) work and at most (2 + 2K) points per occupied column; original records
 * still back crosshairs, exports, measurements, labels and model calculations.
 */
export function pixelExtrema(rows, x, keys = ['price']) {
  if (rows.length < 3) return rows;
  const result = [];
  let column = null, first = -1, last = -1, lows = [], highs = [];
  const flush = () => {
    if (first < 0) return;
    const indices = [...new Set([first, last, ...lows, ...highs].filter(index => index >= 0))].sort((a, b) => a - b);
    for (const index of indices) result.push(rows[index]);
  };
  for (let index = 0; index < rows.length; index++) {
    const next = Math.floor(x(rows[index]));
    if (next !== column) {
      flush(); column = next; first = index; lows = keys.map(() => -1); highs = keys.map(() => -1);
    }
    last = index;
    for (let keyIndex = 0; keyIndex < keys.length; keyIndex++) {
      const key = keys[keyIndex], value = rows[index][key];
      if (!Number.isFinite(value)) continue;
      if (lows[keyIndex] < 0 || value < rows[lows[keyIndex]][key]) lows[keyIndex] = index;
      if (highs[keyIndex] < 0 || value > rows[highs[keyIndex]][key]) highs[keyIndex] = index;
    }
  }
  flush(); return result;
}

/** Preserve every input break while reducing only the connected runs. */
export function pixelLineSegments(rows, x, keys = ['price'], breakWhen = () => false) {
  const segments = []; let run = [];
  const flush = () => { if (run.length) segments.push(pixelExtrema(run, x, keys)); run = []; };
  for (const row of rows) { if (breakWhen(row)) flush(); else run.push(row); }
  flush(); return segments;
}
