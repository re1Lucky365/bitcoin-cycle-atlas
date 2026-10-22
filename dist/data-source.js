/**
 * Coin Metrics Community API reader. Only observed, completed UTC daily prices
 * are accepted. The caller owns stale-data handling and the bundled fallback.
 * API pagination contract: https://docs.coinmetrics.io/api/v4/
 */
import { HALVINGS, utcDay, validateDataset } from './cycle-engine.js?v=1.10.0';

export const COMMUNITY_ENDPOINT = 'https://community-api.coinmetrics.io/v4/timeseries/asset-metrics';
export const START_DATE = '2010-07-18';
export const MAX_PAGES = 10;

export function makeSourceUrl(todayUtc) {
  utcDay(todayUtc);
  const url = new URL(COMMUNITY_ENDPOINT);
  for (const [key, value] of Object.entries({
    assets: 'btc', metrics: 'PriceUSD', frequency: '1d', start_time: START_DATE,
    end_time: todayUtc, page_size: '10000', paging_from: 'start',
  })) url.searchParams.set(key, value);
  return url.href;
}

/** Reject a continuation that changes the source or the requested dataset. */
export function validateContinuation(nextUrl, initialUrl) {
  if (typeof nextUrl !== 'string' || !nextUrl) throw new TypeError('Missing next_page_url');
  const baseline = new URL(initialUrl);
  const next = new URL(nextUrl, baseline);
  if (next.origin !== baseline.origin || next.pathname !== baseline.pathname || next.username || next.password || next.hash) {
    throw new Error('Coin Metrics pagination changed its origin or endpoint');
  }
  for (const key of ['assets', 'metrics', 'frequency', 'start_time', 'end_time', 'paging_from']) {
    const values = next.searchParams.getAll(key);
    if (values.length !== 1 || values[0] !== baseline.searchParams.get(key)) {
      throw new Error(`Coin Metrics pagination changed ${key}`);
    }
  }
  const pageSize = next.searchParams.get('page_size');
  if (!/^\d+$/.test(pageSize ?? '') || Number(pageSize) < 1 || Number(pageSize) > 10000) {
    throw new Error('Invalid pagination page_size');
  }
  const tokens = next.searchParams.getAll('next_page_token');
  if (tokens.length !== 1 || !tokens[0]) throw new Error('Pagination URL is missing its continuation token');
  return next.href;
}

/** Pure page parser; duplicate/order validation includes excluded unfinished days. */
export function parseCoinMetricsPage(payload, { todayUtc, previousDate = null } = {}) {
  const todayDay = utcDay(todayUtc);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || !Array.isArray(payload.data)) {
    throw new TypeError('Coin Metrics response must contain a data array');
  }
  if (payload.data.length > 10000) throw new Error('Coin Metrics page exceeded requested maximum size');
  let previousDay = previousDate === null ? -Infinity : utcDay(previousDate);
  let lastSeenDate = previousDate;
  let excludedUnfinishedCount = 0;
  const prices = [];
  for (const record of payload.data) {
    if (!record || typeof record !== 'object' || Array.isArray(record) || record.asset !== 'btc') {
      throw new TypeError('Coin Metrics record is not a BTC asset observation');
    }
    // The provider labels a UTC daily series at midnight with nanoseconds.
    // Accept zero-only fractional precision; reject intraday/offset timestamps.
    const match = typeof record.time === 'string' && /^(\d{4}-\d{2}-\d{2})T00:00:00(?:\.0{1,9})?Z$/.exec(record.time);
    if (!match) throw new TypeError('Coin Metrics timestamp is not an exact UTC daily label');
    const date = match[1];
    const epochDay = utcDay(date);
    if (epochDay <= previousDay) throw new Error('Coin Metrics dates are duplicated or out of order');
    previousDay = epochDay;
    lastSeenDate = date;
    if (date < START_DATE) throw new Error('Coin Metrics returned data before the requested start date');
    // Today's provider placeholder may still be null; it is never accepted as
    // a price observation, regardless of whether a provisional price exists.
    if (epochDay >= todayDay) { excludedUnfinishedCount++; continue; }
    const rawPrice = record.PriceUSD;
    if (typeof rawPrice !== 'string' || !/^(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(rawPrice)) {
      throw new TypeError('Coin Metrics PriceUSD is not a decimal metric string');
    }
    const price = Number(rawPrice);
    if (!Number.isFinite(price) || price <= 0) throw new TypeError('Coin Metrics PriceUSD is not positive and finite');
    prices.push([date, price]);
  }
  const nextPageUrl = payload.next_page_url;
  const nextPageToken = payload.next_page_token;
  if (nextPageUrl != null && nextPageUrl !== '' && typeof nextPageUrl !== 'string') {
    throw new TypeError('Invalid next_page_url response type');
  }
  if (nextPageToken != null && nextPageToken !== '' && typeof nextPageToken !== 'string') {
    throw new TypeError('Invalid next_page_token response type');
  }
  // The documented contract requires the URL. A bare token is not proof that
  // the first page is the complete series and must not be silently discarded.
  if (nextPageToken && !nextPageUrl) throw new Error('Incomplete pagination: token without next_page_url');
  if (nextPageUrl && payload.data.length === 0) throw new Error('Empty page cannot continue pagination');
  return { prices, lastSeenDate, excludedUnfinishedCount, nextPageUrl: nextPageUrl || null };
}

export function validateFullSeries(prices) {
  const rows = validateDataset(prices);
  if (rows[0].date !== START_DATE || rows.length < 5000) {
    throw new Error('Coin Metrics response does not contain the required full historical series');
  }
  const dates = new Set(rows.map((row) => row.date));
  for (const halving of HALVINGS) {
    if (!dates.has(halving.date)) throw new Error(`Required halving-day observation is missing: ${halving.date}`);
  }
  return rows;
}

async function sha256(text) {
  if (!globalThis.crypto?.subtle || typeof TextEncoder === 'undefined') return null;
  try {
    const hash = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(hash), (value) => value.toString(16).padStart(2, '0')).join('');
  } catch { return null; }
}

export async function fetchLatestDataset({ signal } = {}) {
  const startedAt = new Date();
  const todayUtc = startedAt.toISOString().slice(0, 10);
  const source = makeSourceUrl(todayUtc);
  const visited = new Set();
  const pageSources = [];
  const prices = [];
  let nextUrl = source;
  let previousDate = null;
  let excludedUnfinishedCount = 0;

  for (let page = 0; nextUrl; page++) {
    if (page >= MAX_PAGES) throw new Error('Coin Metrics pagination exceeded 10 pages');
    if (visited.has(nextUrl)) throw new Error('Coin Metrics pagination repeated a page');
    visited.add(nextUrl);
    signal?.throwIfAborted?.();
    const response = await fetch(nextUrl, {
      method: 'GET', mode: 'cors', credentials: 'omit', cache: 'no-store',
      redirect: 'error', headers: { Accept: 'application/json' }, signal,
    });
    if (!response.ok) throw new Error(`Coin Metrics request failed with HTTP ${response.status}`);
    const raw = await response.text();
    let payload;
    try { payload = JSON.parse(raw); } catch { throw new TypeError('Coin Metrics returned invalid JSON'); }
    const parsed = parseCoinMetricsPage(payload, { todayUtc, previousDate });
    prices.push(...parsed.prices);
    previousDate = parsed.lastSeenDate;
    excludedUnfinishedCount += parsed.excludedUnfinishedCount;
    pageSources.push({ url: nextUrl, sha256: await sha256(raw) });
    nextUrl = parsed.nextPageUrl ? validateContinuation(parsed.nextPageUrl, source) : null;
  }
  signal?.throwIfAborted?.();
  const rows = validateFullSeries(prices);
  const first = rows[0];
  const last = rows.at(-1);
  const singlePageHash = pageSources.length === 1 ? pageSources[0].sha256 : null;
  return {
    meta: {
      source,
      sourceName: 'Coin Metrics Community API',
      metric: 'PriceUSD',
      frequency: '1d',
      timezone: 'UTC',
      priceDefinition: 'USD price as of end of each labeled UTC day; not intraday high or spot quote',
      license: 'CC BY-NC 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-nc/4.0/',
      attributionUrl: 'https://coinmetrics.io/',
      documentationUrl: 'https://docs.coinmetrics.io/api/v4/',
      retrievedAt: new Date().toISOString(),
      firstDate: first.date,
      lastDate: last.date,
      count: rows.length,
      missingDayCount: last.epochDay - first.epochDay + 1 - rows.length,
      excludedUnfinishedCount,
      completedDaysBeforeUtc: todayUtc,
      pageCount: pageSources.length,
      responsePages: pageSources,
      ...(singlePageHash ? { rawSha256: singlePageHash, rawSha256Scope: 'Exact single HTTP response text encoded as UTF-8' } : {}),
    },
    prices,
  };
}
