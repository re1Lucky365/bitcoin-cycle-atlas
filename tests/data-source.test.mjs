import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  makeSourceUrl, parseCoinMetricsPage, validateContinuation, validateFullSeries, fetchLatestDataset,
} from '../dist/data-source.js';

let checks = 0;
async function check(name, fn) { await fn(); checks++; console.log(`PASS ${name}`); }
const observation = (date, price = '100') => ({ asset: 'btc', time: `${date}T00:00:00.000000000Z`, PriceUSD: price });
const todayUtc = '2026-10-21';
const source = makeSourceUrl(todayUtc);
function continuation(token) { const url = new URL(source); url.searchParams.set('next_page_token', token); return url.href; }

await check('Incomplete UTC today and future observations are excluded, never shifted', () => {
  const page = parseCoinMetricsPage({ data: [observation('2026-10-20'), observation('2026-10-21'), observation('2026-10-22')] }, { todayUtc });
  assert.deepEqual(page.prices, [['2026-10-20', 100]]);
  assert.equal(page.excludedUnfinishedCount, 2);
  assert.equal(page.lastSeenDate, '2026-10-22');
  assert.deepEqual(parseCoinMetricsPage({ data: [observation('2026-10-20'), observation('2026-10-21', null)] }, { todayUtc }).prices, [['2026-10-20', 100]]);
});

await check('Asset, timestamp, calendar date and decimal metric schemas are checked', () => {
  for (const invalid of [
    { ...observation('2026-10-20'), asset: 'eth' },
    { ...observation('2026-10-20'), time: '2026-10-20T12:00:00Z' },
    { ...observation('2026-10-20'), time: '2026-10-20T00:00:00+09:00' },
    observation('2026-02-30'),
    ...['NaN', 'Infinity', '-1', '0', '1e999', '0x20', '', ' 100 '].map((value) => observation('2026-10-20', value)),
    { ...observation('2026-10-20'), PriceUSD: null },
  ]) assert.throws(() => parseCoinMetricsPage({ data: [invalid] }, { todayUtc }));
});

await check('Duplicate and descending timestamps fail within and across pages', () => {
  assert.throws(() => parseCoinMetricsPage({ data: [observation('2026-10-20'), observation('2026-10-20')] }, { todayUtc }), /duplicated/);
  assert.throws(() => parseCoinMetricsPage({ data: [observation('2026-10-20'), observation('2026-10-19')] }, { todayUtc }), /order/);
  assert.throws(() => parseCoinMetricsPage({ data: [observation('2026-10-20')] }, { todayUtc, previousDate: '2026-10-20' }), /duplicated/);
});

await check('Pagination preserves origin, path and requested BTC daily series', () => {
  assert.equal(validateContinuation(continuation('abc'), source), continuation('abc'));
  for (const changed of [
    continuation('abc').replace('community-api.coinmetrics.io', 'example.com'),
    continuation('abc').replace('/timeseries/asset-metrics', '/timeseries/market-candles'),
    continuation('abc').replace('assets=btc', 'assets=eth'),
    continuation('abc').replace('frequency=1d', 'frequency=1h'),
    `${continuation('abc')}&assets=btc`,
  ]) assert.throws(() => validateContinuation(changed, source));
  assert.throws(() => parseCoinMetricsPage({ data: [observation('2026-10-20')], next_page_token: 'abc' }, { todayUtc }), /token without/);
});

const bundled = JSON.parse(await readFile(new URL('../dist/data/btc-daily.json', import.meta.url), 'utf8'));
const fullData = bundled.prices.map(([date, price]) => observation(date, String(price)));
await check('A partial series or a missing historical halving anchor cannot replace the snapshot', () => {
  assert.throws(() => validateFullSeries(bundled.prices.slice(1)), /full historical/);
  assert.throws(() => validateFullSeries(bundled.prices.slice(0, 100)), /full historical/);
  assert.throws(() => validateFullSeries(bundled.prices.filter(([date]) => date !== '2020-05-11')), /halving-day/);
  assert.equal(validateFullSeries(bundled.prices).length, bundled.prices.length);
});

await check('Any missing UTC day fails at the source boundary before a daily model or cache receives it', () => {
  for (const date of ['2011-03-01','2026-10-20']) {
    assert.throws(() => validateFullSeries(bundled.prices.filter(row => row[0] !== date)), /missing UTC day/);
  }
});

const originalFetch = globalThis.fetch;
try {
  await check('Fetch follows supported pagination and retains exact observed values and provenance', async () => {
    const called = [];
    globalThis.fetch = async (url, options) => {
      called.push(String(url));
      assert.equal(options.credentials, 'omit');
      assert.equal(options.redirect, 'error');
      const next = new URL(url);
      const payload = called.length === 1
        ? { data: fullData.slice(0, 3000), next_page_url: (() => { next.searchParams.set('next_page_token', 'page2'); return next.href; })(), next_page_token: 'page2' }
        : { data: fullData.slice(3000) };
      return new Response(JSON.stringify(payload), { status: 200 });
    };
    const dataset = await fetchLatestDataset();
    assert.equal(called.length, 2);
    assert.equal(dataset.meta.pageCount, 2);
    assert.equal(dataset.meta.sourceName, 'Coin Metrics Community API');
    assert.deepEqual(dataset.prices, bundled.prices);
    assert.equal(dataset.meta.lastDate, bundled.meta.lastDate);
  });

  await check('Network failure propagates without constructing fallback or synthetic prices', async () => {
    globalThis.fetch = async () => new Response('rate limited', { status: 429 });
    await assert.rejects(fetchLatestDataset(), /HTTP 429/);
  });

  await check('A successful HTTP response with an omitted ordinary day cannot become a manual-refresh dataset', async () => {
    globalThis.fetch = async () => new Response(JSON.stringify({ data: fullData.filter(row => !row.time.startsWith('2026-10-20')) }), { status: 200 });
    await assert.rejects(fetchLatestDataset(), /missing UTC day/);
  });

  await check('Cross-origin pagination fails before any request to the new host', async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return new Response(JSON.stringify({ data: [fullData[0]], next_page_url: 'https://example.com/stolen' }));
    };
    await assert.rejects(fetchLatestDataset(), /origin or endpoint/);
    assert.equal(calls, 1);
  });

  await check('Pagination is bounded at ten pages and never follows a repeated URL', async () => {
    let calls = 0;
    globalThis.fetch = async (url) => {
      calls++;
      const next = new URL(url); next.searchParams.set('next_page_token', String(calls));
      return new Response(JSON.stringify({ data: [fullData[calls - 1]], next_page_url: next.href }));
    };
    await assert.rejects(fetchLatestDataset(), /exceeded 10 pages/);
    assert.equal(calls, 10);
    calls = 0;
    globalThis.fetch = async (url) => {
      calls++;
      const next = new URL(url); next.searchParams.set('next_page_token', 'repeated');
      return new Response(JSON.stringify({ data: [fullData[calls - 1]], next_page_url: next.href }));
    };
    await assert.rejects(fetchLatestDataset(), /repeated a page/);
    assert.equal(calls, 2);
  });

  await check('An already aborted refresh makes no network request', async () => {
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw new Error('Unexpected network request'); };
    const controller = new AbortController(); controller.abort();
    await assert.rejects(fetchLatestDataset({ signal: controller.signal }), { name: 'AbortError' });
    assert.equal(calls, 0);
  });
} finally { globalThis.fetch = originalFetch; }
console.log(`${checks} data-source checks passed`);
