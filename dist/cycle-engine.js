/**
 * Bitcoin Cycles — deterministic daily-price comparison engine.
 * All dates are UTC day labels. No interpolation, extrapolation, or price forecast.
 * PriceUSD data is attributed in the application's data metadata.
 */

export const DAY_MS = 86_400_000;
export const HISTORICAL_WINDOW_DAYS = 1461;
export const MODES = Object.freeze(['halving', 'bottom', 'top', 'breakout']);
export const HALVINGS = Object.freeze([
  Object.freeze({ year: 2012, date: '2012-11-28', height: 210000 }),
  Object.freeze({ year: 2016, date: '2016-07-09', height: 420000 }),
  Object.freeze({ year: 2020, date: '2020-05-11', height: 630000 }),
  Object.freeze({ year: 2024, date: '2024-04-20', height: 840000 }),
]);

const HISTORICAL_TOP_YEARS = [2011, 2013, 2017, 2021];
const COLORS = ['#a696ef', '#67aafa', '#49c8ae', '#f0a956', '#ef9154'];

// Calendar labels are immutable across price revisions and model scenarios.
// Repeated validation, moving windows and source anchors reuse only this pure
// conversion, never prices or fitted results. FIFO bounds memory on long visits.
const utcDayCache = new Map();
const UTC_DAY_CACHE_LIMIT = 32768;

export function utcDay(date) {
  if (typeof date === 'string') {
    const cached = utcDayCache.get(date);
    if (cached !== undefined) return cached;
  }
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new TypeError(`Invalid UTC date label: ${String(date)}`);
  }
  const millis = Date.parse(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(millis) || new Date(millis).toISOString().slice(0, 10) !== date) {
    throw new TypeError(`Invalid calendar date: ${date}`);
  }
  const day = millis / DAY_MS;
  if (utcDayCache.size >= UTC_DAY_CACHE_LIMIT) utcDayCache.delete(utcDayCache.keys().next().value);
  utcDayCache.set(date, day);
  return day;
}

export function dateFromDay(day) {
  if (!Number.isSafeInteger(day)) throw new TypeError('UTC day must be a safe integer');
  const date = new Date(day * DAY_MS);
  const year = date.getUTCFullYear();
  if (!(year >= 0 && year <= 9999)) throw new RangeError('UTC day must produce a date in years 0000 through 9999');
  return date.toISOString().slice(0, 10);
}

/** Validate without filling gaps. Accept raw { prices: [[date, price], ...] } or rows. */
export function validateDataset(input) {
  const rows = Array.isArray(input) ? input : input?.prices;
  if (!Array.isArray(rows) || rows.length === 0) throw new TypeError('Daily prices must be a nonempty array');
  let previous = -Infinity;
  return Array.from(rows, (row, index) => {
    if (Array.isArray(row) && row.length !== 2) throw new TypeError(`Daily price row ${index} must contain exactly date and price`);
    const date = Array.isArray(row) ? row[0] : row?.date;
    const price = Array.isArray(row) ? row[1] : row?.price;
    const epochDay = utcDay(date);
    if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) {
      throw new TypeError(`Invalid positive finite price at row ${index}`);
    }
    if (epochDay <= previous) throw new TypeError(`Duplicate or reversed UTC date at row ${index}: ${date}`);
    previous = epochDay;
    return { date, price, epochDay };
  });
}

function extreme(rows, predicate, maximize = true) {
  let found = null;
  for (const row of rows) {
    if (!predicate(row)) continue;
    if (!found || (maximize ? row.price > found.price : row.price < found.price)) found = row;
  }
  return found;
}

function finiteResult(value, description) {
  if (!Number.isFinite(value)) throw new RangeError(`Numeric overflow while computing ${description}`);
  return value;
}

function positiveResult(value, description) {
  finiteResult(value, description);
  if (value <= 0) throw new RangeError(`Numeric underflow while computing ${description}`);
  return value;
}

function percentageReturn(price, base) {
  return finiteResult((positiveResult(price / base, 'price ratio') - 1) * 100, 'return percentage');
}

function relativeValues(price, anchorPrice, referencePrice) {
  const ratio = positiveResult(price / anchorPrice, 'relative price');
  return {
    ratio,
    indexed: positiveResult(ratio * 100, 'base-100 index'),
    rebased: positiveResult(ratio * referencePrice, 'rebased price'),
    returnPct: finiteResult((ratio - 1) * 100, 'return percentage'),
  };
}

function historicalTops(rows) {
  return HISTORICAL_TOP_YEARS.map((year) => ({
    year,
    row: extreme(rows, (row) => row.date.startsWith(`${year}-`)),
  })).filter((entry) => entry.row);
}

function anchorsForRows(rows, mode) {
  if (!MODES.includes(mode)) throw new TypeError(`Unsupported comparison mode: ${mode}`);
  const firstDate = rows[0].date;
  const lastDate = rows.at(-1).date;
  const byDate = new Map(rows.map((row) => [row.date, row]));
  let anchors = [];

  if (mode === 'halving') {
    anchors = HALVINGS.filter((event) => event.date >= firstDate && event.date <= lastDate).map((event) => {
      const row = byDate.get(event.date);
      if (!row) throw new Error(`Missing exact halving-day observation: ${event.date}`);
      return {
        id: `halving-${event.year}`,
        label: `${event.year}`,
        date: row.date,
        price: row.price,
        year: event.year,
        blockHeight: event.height,
        description: `블록 ${event.height.toLocaleString('en-US')} 반감기 · UTC 일말 가격`,
      };
    });
  } else {
    const tops = historicalTops(rows);
    if (mode === 'top') {
      anchors = tops.map(({ year, row }) => ({
        id: `top-${year}`, label: String(year), date: row.date, price: row.price, year,
        description: `${year}년 내 최고 UTC 일말 가격 · 사후에 선택한 역사 기준점`,
      }));
      // The completed 2025 calendar-year maximum is a provisional market-cycle
      // reference, not a claim that the ultimate cycle peak has been confirmed.
      if (firstDate <= '2025-01-01' && lastDate >= '2025-12-31') {
        const row = extreme(rows, (point) => point.date.startsWith('2025-'));
        if (row) anchors.push({
          id: 'top-2025', label: '2025', date: row.date, price: row.price, year: 2025,
          provisional: true,
          description: '2025년 내 최고 UTC 일말 가격 · 시장 사이클 고점 확정이 아닌 잠정 비교 기준',
        });
      }
    } else {
      const bottoms = tops.map(({ year, row: top }) => {
        const event = HALVINGS.find((halving) => halving.date > top.date);
        // A trough is only included after its bounding halving has occurred.
        if (!event || event.date > lastDate) return null;
        const bottom = extreme(rows, (point) => point.date >= top.date && point.date < event.date, false);
        return bottom && { topYear: year, top, event, bottom };
      }).filter(Boolean);

      if (mode === 'bottom') {
        anchors = bottoms.map(({ topYear, top, event, bottom }) => ({
          id: `bottom-${bottom.date.slice(0, 4)}`, label: bottom.date.slice(0, 4),
          date: bottom.date, price: bottom.price, year: Number(bottom.date.slice(0, 4)),
          previousPeakDate: top.date, boundHalvingDate: event.date,
          description: `${topYear}년 기준 고점부터 ${event.date} 반감기 전날까지의 최저 UTC 일말 가격`,
        }));
      } else {
        anchors = bottoms.map(({ topYear, top, bottom }) => {
          const crossing = rows.find((point) => point.date > bottom.date && point.price > top.price);
          return crossing ? {
            id: `breakout-${crossing.date.slice(0, 4)}`, label: crossing.date.slice(0, 4),
            date: crossing.date, price: crossing.price, year: Number(crossing.date.slice(0, 4)),
            previousPeakDate: top.date, previousPeakPrice: top.price,
            description: `${topYear}년 고점의 일말 가격을 이후 저점 뒤 처음 초과한 UTC 관측일`,
          } : null;
        }).filter(Boolean);
      }
    }
  }

  anchors.sort((a, b) => a.date.localeCompare(b.date));
  return anchors.map((anchor, index) => ({
    ...anchor,
    color: COLORS[index] ?? COLORS.at(-1),
    current: index === anchors.length - 1,
    provisional: Boolean(anchor.provisional),
  }));
}

export function getAnchors(input, mode = 'halving') {
  return anchorsForRows(validateDataset(input), mode);
}

/** Exact elapsed-day lookup. A missing observed day is deliberately null. */
export function getPointAtDay(series, day) {
  if (!Number.isInteger(day) || day < 0) return null;
  const points = Array.isArray(series) ? series : series?.points;
  if (!Array.isArray(points)) return null;
  let lo = 0;
  let hi = points.length - 1;
  while (lo <= hi) {
    const middle = (lo + hi) >>> 1;
    if (points[middle].day === day) return points[middle];
    if (points[middle].day < day) lo = middle + 1;
    else hi = middle - 1;
  }
  return null;
}

/** Statistics on the supplied observed window, never on unobserved future data. */
export function getSeriesStats(points) {
  if (!Array.isArray(points) || points.length === 0) return null;
  let peak = points[0];
  let minimum = points[0];
  let runningPeak = points[0];
  let drawdownPeak = points[0];
  let drawdownTrough = points[0];
  let maxDrawdown = 0;
  for (const point of points) {
    if (point.price > peak.price) peak = point;
    if (point.price < minimum.price) minimum = point;
    if (point.price > runningPeak.price) runningPeak = point;
    const drawdown = positiveResult(point.price / runningPeak.price, 'drawdown ratio') - 1;
    if (drawdown < maxDrawdown) {
      maxDrawdown = drawdown;
      drawdownPeak = runningPeak;
      drawdownTrough = point;
    }
  }
  const first = points[0];
  const last = points.at(-1);
  return {
    count: points.length,
    firstDate: first.date,
    lastDate: last.date,
    firstDay: first.day,
    lastDay: last.day,
    lastPrice: last.price,
    returnPct: percentageReturn(last.price, first.price),
    peakPrice: peak.price,
    peakDate: peak.date,
    peakDay: peak.day,
    peakReturnPct: percentageReturn(peak.price, first.price),
    minimumPrice: minimum.price,
    minimumDate: minimum.date,
    minimumDay: minimum.day,
    maxDrawdownPct: maxDrawdown * 100,
    drawdownPeakDate: drawdownPeak.date,
    drawdownTroughDate: drawdownTrough.date,
  };
}

export function buildComparison(input, { mode = 'halving', horizon = HISTORICAL_WINDOW_DAYS } = {}) {
  const rows = validateDataset(input);
  const anchors = anchorsForRows(rows, mode);
  if (!anchors.length) throw new Error(`No observed anchors for mode: ${mode}`);
  const latest = rows.at(-1);
  const previous = rows.length > 1 ? rows.at(-2) : null;
  const currentAnchor = anchors.at(-1);
  const currentDays = latest.epochDay - utcDay(currentAnchor.date);
  const windowDays = horizon === 'all' ? Math.max(HISTORICAL_WINDOW_DAYS, currentDays) : horizon;
  if (!Number.isSafeInteger(windowDays) || windowDays < 0) throw new TypeError('Horizon must be nonnegative integer days or "all"');
  const referencePrice = currentAnchor.price;
  const series = anchors.map((anchor) => {
    const anchorDay = utcDay(anchor.date);
    const endDay = Math.min(windowDays, anchor.current ? currentDays : HISTORICAL_WINDOW_DAYS);
    const points = rows.filter((row) => {
      const day = row.epochDay - anchorDay;
      return day >= 0 && day <= endDay;
    }).map((row) => {
      return {
        day: row.epochDay - anchorDay,
        date: row.date,
        price: row.price,
        ...relativeValues(row.price, anchor.price, referencePrice),
      };
    });
    return { ...anchor, endDay, points, stats: getSeriesStats(points) };
  });

  // Same-day comparisons must not depend on the user's display horizon.
  // Historical observations beyond the defined four-year window remain absent.
  const comparisonAtCurrentDay = anchors.map((anchor) => {
    const observedDate = dateFromDay(utcDay(anchor.date) + currentDays);
    const row = !anchor.current && currentDays > HISTORICAL_WINDOW_DAYS ? null : rows.find((point) => point.date === observedDate);
    return {
      id: anchor.id, label: anchor.label, color: anchor.color, current: anchor.current,
      date: row?.date ?? null,
      day: currentDays,
      price: row?.price ?? null,
      ...(row ? relativeValues(row.price, anchor.price, referencePrice) : { ratio: null, indexed: null, rebased: null, returnPct: null }),
    };
  });

  const previousIsYesterday = Boolean(previous && latest.epochDay - previous.epochDay === 1);
  return {
    mode,
    horizon: windowDays,
    requestedHorizon: horizon,
    historicalWindowDays: HISTORICAL_WINDOW_DAYS,
    referencePrice,
    currentAnchor,
    currentDays,
    latest: { date: latest.date, price: latest.price },
    series,
    comparisonAtCurrentDay,
    stats: {
      latestPrice: latest.price,
      latestDate: latest.date,
      previousDate: previous?.date ?? null,
      previousPrice: previous?.price ?? null,
      dailyChangePct: previousIsYesterday ? percentageReturn(latest.price, previous.price) : null,
      currentReturnPct: percentageReturn(latest.price, referencePrice),
      currentRatio: positiveResult(latest.price / referencePrice, 'current relative price'),
      currentDays,
      currentAnchorPrice: referencePrice,
      currentAnchorDate: currentAnchor.date,
      currentInView: currentDays <= windowDays,
      observationCount: rows.length,
    },
    metadata: {
      ...(Array.isArray(input) ? {} : input?.meta ?? {}),
      firstDate: rows[0].date,
      lastDate: latest.date,
      count: rows.length,
      missingDayCount: latest.epochDay - rows[0].epochDay + 1 - rows.length,
      gapPolicy: 'No interpolation. Missing observations remain absent.',
      historicalWindowDays: HISTORICAL_WINDOW_DAYS,
      topRule: 'Historical reference-year maxima: 2011, 2013, 2017, 2021. The 2025 annual maximum is a provisional cycle reference.',
    },
  };
}

function csvCell(value) {
  const text = value == null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Export exactly the observed points present in this comparison object. */
export function comparisonToCsv(comparison) {
  const columns = ['cycle_id', 'cycle_label', 'anchor_date', 'observation_date_utc', 'elapsed_days', 'price_usd', 'ratio', 'index_base_100', 'rebased_usd', 'return_pct', 'provisional', 'source', 'data_license'];
  const lines = [columns.join(',')];
  for (const series of comparison.series) {
    for (const point of series.points) {
      lines.push([
        series.id, series.label, series.date, point.date, point.day, point.price,
        point.ratio, point.indexed, point.rebased, point.returnPct, series.provisional,
        'Coin Metrics PriceUSD', 'CC BY-NC 4.0',
      ].map(csvCell).join(','));
    }
  }
  return `${lines.join('\r\n')}\r\n`;
}
