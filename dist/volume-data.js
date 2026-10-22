import { utcDay, dateFromDay } from './cycle-engine.js?v=1.11.0';

const DAY_SECONDS = 86400;
const DAY_MS = DAY_SECONDS * 1000;
const iso = seconds => new Date(seconds * 1000).toISOString();
const dateAt = seconds => iso(seconds).slice(0, 10);
const positive = value => typeof value === 'number' && Number.isFinite(value) && value > 0;
const nonnegative = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;

export const VOLUME_PROVIDERS = Object.freeze({
  Bitstamp: Object.freeze({
    source: 'Bitstamp', provider: 'Bitstamp', product: 'BTC-USD', providerProduct: 'btcusd',
    endpoint: 'https://www.bitstamp.net/api/v2/ohlc/btcusd/', maxCandles: 1000, pageDays: 1000,
    documentationUrls: Object.freeze(['https://www.bitstamp.net/api/']),
  }),
  'Coinbase Exchange': Object.freeze({
    source: 'Coinbase Exchange', provider: 'Coinbase Exchange', product: 'BTC-USD', providerProduct: 'BTC-USD',
    endpoint: 'https://api.exchange.coinbase.com/products/BTC-USD/candles', maxCandles: 300, pageDays: 290,
    documentationUrls: Object.freeze([
      'https://docs.cdp.coinbase.com/api-reference/exchange-api/rest-api/products/get-product-candles',
      'https://docs.cdp.coinbase.com/api-reference/exchange-api/rest-api/products/get-product-stats',
      'https://docs.cdp.coinbase.com/api-reference/exchange-api/rest-api/products/get-single-product',
    ]),
  }),
});

function providerFor(source = 'Bitstamp') {
  const provider = Object.hasOwn(VOLUME_PROVIDERS, source) && VOLUME_PROVIDERS[source];
  if (!provider) throw new TypeError('Unsupported volume provider');
  return provider;
}

function sourceScope(source = 'Bitstamp') {
  const { provider, product, providerProduct } = providerFor(source);
  return { source, provider, product, providerProduct, unit: 'BTC', volumeType: 'base',
    scope: 'single-exchange-spot-pair', globalMarketVolume: false };
}

export const VOLUME_ENDPOINT = VOLUME_PROVIDERS.Bitstamp.endpoint;
export const VOLUME_DOCUMENTATION_URLS = VOLUME_PROVIDERS.Bitstamp.documentationUrls;
export const VOLUME_SCOPE = Object.freeze(sourceScope());

function validNow(now) {
  if (!Number.isFinite(now) || now <= 0) throw new RangeError('Invalid volume completion cutoff');
  return now;
}

function dateCutoff(asOf, now) {
  const completedDay = Math.floor(validNow(now) / DAY_MS) - 1;
  return Math.min(completedDay, asOf === undefined ? completedDay : utcDay(asOf));
}

function checkSourceUrl(url, source) {
  const parsed = new URL(url), expected = new URL(providerFor(source).endpoint);
  const intervalKey = source === 'Bitstamp' ? 'step' : 'granularity';
  if (parsed.origin !== expected.origin || parsed.pathname !== expected.pathname || parsed.username || parsed.password
    || parsed.hash || parsed.searchParams.get(intervalKey) !== String(DAY_SECONDS)) {
    throw new TypeError('Invalid volume source URL');
  }
}

function scopeCheck(payload) {
  const scope = sourceScope(payload?.source);
  for (const [key, value] of Object.entries(scope)) {
    if (payload?.[key] !== value) throw new TypeError(`Invalid volume snapshot ${key}`);
  }
}

function validateDailyBar(row, index) {
  if (!row || !Number.isSafeInteger(row.time) || row.time <= 0 || row.time % DAY_SECONDS !== 0
    || row.date !== dateAt(row.time) || !nonnegative(row.volume)
    || ![row.open, row.high, row.low, row.close].every(positive)) throw new TypeError(`Invalid daily volume bar at ${index}`);
  if (row.low > Math.min(row.open, row.close) || row.high < Math.max(row.open, row.close) || row.low > row.high) {
    throw new RangeError(`Inconsistent daily OHLC at ${index}`);
  }
  return { time: row.time, date: row.date, open: row.open, high: row.high, low: row.low, close: row.close, volume: row.volume };
}

function validatedDailyBars(rows) {
  if (!Array.isArray(rows) || rows.length > 50000) throw new TypeError('Daily volume bars must be an array');
  let previous = -Infinity;
  return rows.map((row, index) => {
    const result = validateDailyBar(row, index);
    if (result.time <= previous) throw new RangeError('Daily volume bars must be unique and strictly ordered');
    previous = result.time;
    return result;
  });
}

function rawRowsFor(payload, source) {
  if (source === 'Bitstamp' && !Array.isArray(payload)) {
    if (!payload?.data || (payload.data.pair !== undefined && payload.data.pair !== 'BTC/USD')
      || (payload.data.market !== undefined && !['btcusd', 'BTC/USD'].includes(payload.data.market))) {
      throw new TypeError('Invalid Bitstamp BTC/USD response');
    }
    return payload.data.ohlc;
  }
  return payload;
}

function decimalNumber(value) {
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) throw new TypeError('Invalid decimal API field');
  const number = Number(value);
  if (!Number.isFinite(number)) throw new TypeError('Non-finite decimal API field');
  return number;
}

/** Missing dates are recorded, never replaced with invented zero-volume bars. */
export function volumeCoverage(bars, { requestedStart = null, requestedEnd = null } = {}) {
  const rows = validatedDailyBars(bars), gaps = [];
  for (let index = 1; index < rows.length; index++) {
    const missing = (rows[index].time - rows[index - 1].time) / DAY_SECONDS - 1;
    if (missing > 0) gaps.push({ startDate: dateAt(rows[index - 1].time + DAY_SECONDS),
      endDate: dateAt(rows[index].time - DAY_SECONDS), missingDays: missing });
  }
  return {
    firstDate: rows[0]?.date ?? null, lastDate: rows.at(-1)?.date ?? null,
    bars: rows.length, expectedDaysWithinCoverage: rows.length ? (rows.at(-1).time - rows[0].time) / DAY_SECONDS + 1 : 0,
    gapCount: gaps.reduce((sum, gap) => sum + gap.missingDays, 0), gaps,
    requestedStart, requestedEnd, sourceZeroVolumeBars: rows.filter(row => row.volume === 0).length,
    beforeCoverageIsUnavailable: true, afterCoverageIsUnavailable: true, gapsAreZeroVolume: false, imputedBars: 0,
  };
}

/**
 * Pure normalization of native Bitstamp objects or explicit Coinbase six-field arrays.
 * `now` is milliseconds; start/end are inclusive/exclusive UTC day labels;
 * `asOf` is inclusive. Only completed provider observations are retained.
 */
export function normalizeDailyVolume(payload, { source = 'Bitstamp', now = Date.now(), asOf, start, end } = {}) {
  providerFor(source);
  const rawRows = rawRowsFor(payload, source);
  if (!Array.isArray(rawRows) || rawRows.length > 50000) throw new TypeError('Invalid raw volume response');
  const cutoff = dateCutoff(asOf, now), first = start === undefined ? -Infinity : utcDay(start);
  const last = end === undefined ? Infinity : utcDay(end);
  if (first >= last) throw new RangeError('Volume request start must precede end');
  const seen = new Set(), bars = [];
  let excludedUnfinished = 0, excludedAfterAsOf = 0, excludedOutsideRequest = 0;
  for (let index = 0; index < rawRows.length; index++) {
    const raw = rawRows[index];
    let time, low, high, open, close, volume;
    if (source === 'Bitstamp') {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw) || typeof raw.timestamp !== 'string' || !/^\d+$/.test(raw.timestamp)) {
        throw new TypeError(`Invalid Bitstamp daily candle at ${index}`);
      }
      time = Number(raw.timestamp);
      [open, high, low, close, volume] = ['open', 'high', 'low', 'close', 'volume'].map(key => decimalNumber(raw[key]));
    } else {
      if (!Array.isArray(raw) || raw.length !== 6) throw new TypeError(`Expected six Coinbase candle fields at ${index}`);
      [time, low, high, open, close, volume] = raw;
    }
    if (!Number.isSafeInteger(time) || time <= 0) throw new TypeError(`Invalid daily timestamp at ${index}`);
    const bar = validateDailyBar({ time, date: dateAt(time), low, high, open, close, volume }, index);
    if (seen.has(time)) throw new RangeError('Duplicate daily volume timestamp');
    seen.add(time);
    const day = time / DAY_SECONDS;
    if (day < first || day >= last) { excludedOutsideRequest++; continue; }
    if ((time + DAY_SECONDS) * 1000 > now) { excludedUnfinished++; continue; }
    if (day > cutoff) { excludedAfterAsOf++; continue; }
    bars.push(bar);
  }
  bars.sort((a, b) => a.time - b.time);
  return { ...sourceScope(source), interval: 'daily', seconds: DAY_SECONDS, bars,
    asOf: dateFromDay(cutoff), completedOnly: true, excludedUnfinished, excludedAfterAsOf, excludedOutsideRequest,
    coverage: volumeCoverage(bars, { requestedStart: start ?? null, requestedEnd: end ?? null }),
    firstDate: bars[0]?.date ?? null, lastDate: bars.at(-1)?.date ?? null };
}

/** A saved response retains its original collection time when read later. */
export function parseVolumeSnapshot(payload, { asOf, now = Date.now() } = {}) {
  scopeCheck(payload);
  if (payload.version !== 1 || payload.interval !== 'daily' || payload.seconds !== DAY_SECONDS
    || payload.completedOnly !== true || !Array.isArray(payload.sourceUrls) || !payload.sourceUrls.length
    || !Array.isArray(payload.documentationUrls) || !payload.documentationUrls.length) throw new TypeError('Invalid volume snapshot metadata');
  const retrieved = Date.parse(payload.retrievedAt);
  validNow(retrieved); validNow(now); utcDay(payload.asOf);
  for (const url of payload.sourceUrls) checkSourceUrl(url, payload.source);
  if (payload.documentationUrls.some(url => !providerFor(payload.source).documentationUrls.includes(url))) {
    throw new TypeError('Invalid volume documentation URL');
  }
  const stored = validatedDailyBars(payload.bars);
  if (!stored.length) throw new TypeError('Volume snapshot has no observed bars');
  if (stored.some(row => (row.time + DAY_SECONDS) * 1000 > retrieved || row.date > payload.asOf)) {
    throw new RangeError('Snapshot includes an unfinished or post-cutoff volume bar');
  }
  const originalCoverage = volumeCoverage(stored);
  if (payload.firstDate !== originalCoverage.firstDate || payload.lastDate !== originalCoverage.lastDate
    || payload.coverage?.firstDate !== originalCoverage.firstDate || payload.coverage?.lastDate !== originalCoverage.lastDate
    || payload.coverage?.bars !== stored.length || payload.coverage?.gapCount !== originalCoverage.gapCount) {
    throw new RangeError('Volume snapshot coverage does not match its rows');
  }
  const cutoff = Math.min(dateCutoff(asOf, now), utcDay(payload.asOf)), bars = stored.filter(row => row.time / DAY_SECONDS <= cutoff);
  const coverage = volumeCoverage(bars, { requestedStart: payload.coverage.requestedStart ?? null, requestedEnd: dateFromDay(cutoff + 1) });
  return { ...payload, bars, asOf: dateFromDay(cutoff), coverage, firstDate: coverage.firstDate, lastDate: coverage.lastDate,
    snapshot: true, originalCoverage: { firstDate: originalCoverage.firstDate, lastDate: originalCoverage.lastDate },
    excludedAfterAsOf: stored.length - bars.length };
}

/** Monday UTC to next Monday; only seven observed, completed UTC daily buckets. */
export function aggregateWeeklyVolume(dailyBars, { source = 'Bitstamp', asOf, now = Date.now() } = {}) {
  const rows = validatedDailyBars(dailyBars), cutoff = dateCutoff(asOf, now), groups = new Map();
  for (const row of rows) {
    const day = row.time / DAY_SECONDS;
    if (day > cutoff) continue;
    const monday = day - ((day + 3) % 7 + 7) % 7;
    if (!groups.has(monday)) groups.set(monday, []);
    groups.get(monday).push(row);
  }
  const bars = [];
  let incompleteGroups = 0;
  for (const [monday, days] of groups) {
    if (days.length !== 7 || days.some((row, index) => row.time / DAY_SECONDS !== monday + index) || monday + 6 > cutoff) {
      incompleteGroups++; continue;
    }
    const volume = days.reduce((sum, row) => sum + row.volume, 0);
    if (!Number.isFinite(volume)) throw new RangeError('Weekly volume overflow');
    bars.push({ time: monday * DAY_SECONDS, date: dateFromDay(monday + 6), startDate: dateFromDay(monday), endDate: dateFromDay(monday + 6),
      open: days[0].open, high: Math.max(...days.map(row => row.high)), low: Math.min(...days.map(row => row.low)),
      close: days.at(-1).close, volume, daysIncluded: 7, complete: true });
  }
  return { ...sourceScope(source), interval: 'weekly', seconds: 7 * DAY_SECONDS, bars, asOf: dateFromDay(cutoff),
    completedOnly: true, incompleteGroups, firstDate: bars[0]?.date ?? null, lastDate: bars.at(-1)?.date ?? null,
    aggregation: 'Sum of seven completed UTC daily buckets; Monday start, Sunday chart label', imputedBars: 0 };
}

/** Filter observed daily or weekly bars, using inclusive display dates. */
export function filterVolumeForView(bars, { start, end, asOf } = {}) {
  if (!Array.isArray(bars)) throw new TypeError('Volume view requires bars');
  const lower = start === undefined ? -Infinity : utcDay(start);
  const upper = Math.min(end === undefined ? Infinity : utcDay(end), asOf === undefined ? Infinity : utcDay(asOf));
  if (lower > upper) return [];
  return bars.filter(row => {
    if (!nonnegative(row?.volume)) throw new TypeError('Invalid observed volume');
    const day = utcDay(row.date);
    return day >= lower && day <= upper;
  });
}

/** Public collection. No credentials, polling, retries or implicit provider fallback. */
export async function fetchDailyVolumeHistory({ source = 'Bitstamp', start = '2010-01-01', asOf, now = Date.now(), fetchImpl = globalThis.fetch, signal } = {}) {
  const provider = providerFor(source), first = utcDay(start), cutoff = dateCutoff(asOf, now), end = cutoff + 1;
  if (first >= end) throw new RangeError('Volume start is after the completed-day cutoff');
  const bars = [], sourceUrls = [], requests = [];
  let excludedUnfinished = 0, excludedOutsideRequest = 0;
  for (let cursor = first; cursor < end; cursor += provider.pageDays) {
    signal?.throwIfAborted?.();
    const pageEnd = Math.min(end, cursor + provider.pageDays), url = new URL(provider.endpoint);
    if (source === 'Bitstamp') {
      // The provider gives end precedence over start. Send end plus an exact limit,
      // then enforce the inclusive/exclusive requested window on the client.
      url.searchParams.set('step', String(DAY_SECONDS));
      url.searchParams.set('limit', String(pageEnd - cursor));
      url.searchParams.set('end', String(pageEnd * DAY_SECONDS - 1));
      url.searchParams.set('exclude_current_candle', 'true');
    } else {
      url.searchParams.set('granularity', String(DAY_SECONDS));
      url.searchParams.set('start', iso(cursor * DAY_SECONDS));
      url.searchParams.set('end', iso(pageEnd * DAY_SECONDS));
    }
    const response = await fetchImpl(url.href, { method: 'GET', mode: 'cors', credentials: 'omit', redirect: 'error',
      cache: 'no-cache', headers: { Accept: 'application/json' }, signal });
    if (!response.ok) throw new Error(`${source} volume HTTP ${response.status}; no retry or source substitution applied`);
    const payload = await response.json(), raw = rawRowsFor(payload, source);
    signal?.throwIfAborted?.();
    if (!Array.isArray(raw) || raw.length > provider.maxCandles) throw new TypeError(`${source} page exceeds its documented candle limit`);
    const parsed = normalizeDailyVolume(payload, { source, now, asOf: dateFromDay(cutoff), start: dateFromDay(cursor), end: dateFromDay(pageEnd) });
    bars.push(...parsed.bars); sourceUrls.push(url.href);
    excludedUnfinished += parsed.excludedUnfinished; excludedOutsideRequest += parsed.excludedOutsideRequest;
    requests.push({ url: url.href, requestedStart: dateFromDay(cursor), requestedEnd: dateFromDay(pageEnd), returnedRows: raw.length, includedBars: parsed.bars.length });
  }
  const coverage = volumeCoverage(bars, { requestedStart: start, requestedEnd: dateFromDay(end) });
  if (!bars.length) throw new Error(`No completed ${source} daily volume was returned`);
  signal?.throwIfAborted?.();
  return { version: 1, ...sourceScope(source), interval: 'daily', seconds: DAY_SECONDS,
    retrievedAt: new Date(now).toISOString(), asOf: dateFromDay(cutoff), bars, firstDate: coverage.firstDate, lastDate: coverage.lastDate, coverage,
    completedOnly: true, sourceUrls, documentationUrls: [...provider.documentationUrls],
    collection: { requestedStart: start, requestedEnd: dateFromDay(end), requestCount: requests.length, requests, excludedUnfinished, excludedOutsideRequest } };
}
