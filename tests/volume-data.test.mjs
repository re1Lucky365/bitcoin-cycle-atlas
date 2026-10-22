import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  normalizeDailyVolume, parseVolumeSnapshot, aggregateWeeklyVolume, filterVolumeForView,
  fetchDailyVolumeHistory, volumeCoverage, VOLUME_SCOPE,
} from '../dist/volume-data.js';

const DAY = 86400, monday = Date.parse('2026-10-12T00:00:00Z') / 1000;
const now = Date.parse('2026-10-22T10:00:00Z');
const row = (time, { open = '100.00', high = '120.00', low = '90.00', close = '110.00', volume = '2.00000001' } = {}) => ({ timestamp: String(time), open, high, low, close, volume });
const sourcePayload = rows => ({ data: { pair: 'BTC/USD', ohlc: rows } });
const normal = rows => normalizeDailyVolume(sourcePayload(rows), { now }).bars;
const snapshotFor = rows => {
  const series = normalizeDailyVolume(sourcePayload(rows), { now });
  return { version: 1, ...series, retrievedAt: new Date(now).toISOString(), sourceUrls: ['https://www.bitstamp.net/api/v2/ohlc/btcusd/?step=86400'], documentationUrls: ['https://www.bitstamp.net/api/'] };
};

test('native Bitstamp strings retain actual OHLCV and descending responses sort chronologically', () => {
  const series = normalizeDailyVolume(sourcePayload([row(monday + DAY, { open: '110', high: '160', low: '80', close: '150', volume: '3.00000002' }), row(monday)]), { now });
  assert.deepEqual(series.bars, [
    { time: monday, date: '2026-10-12', open: 100, high: 120, low: 90, close: 110, volume: 2.00000001 },
    { time: monday + DAY, date: '2026-10-13', open: 110, high: 160, low: 80, close: 150, volume: 3.00000002 },
  ]);
  for (const [key, value] of Object.entries(VOLUME_SCOPE)) assert.equal(series[key], value);
  assert.equal(series.globalMarketVolume, false);
});

test('Coinbase six-field parsing is explicit and cannot be silently mislabeled as Bitstamp', () => {
  const native = [[monday, 90, 120, 100, 110, 3]];
  const parsed = normalizeDailyVolume(native, { source: 'Coinbase Exchange', now });
  assert.equal(parsed.source, 'Coinbase Exchange'); assert.equal(parsed.providerProduct, 'BTC-USD');
  assert.deepEqual(parsed.bars[0], { time: monday, date: '2026-10-12', open: 100, high: 120, low: 90, close: 110, volume: 3 });
  assert.throws(() => normalizeDailyVolume(native, { now }));
  assert.throws(() => normalizeDailyVolume(sourcePayload([row(monday)]), { source: 'global', now }));
});

test('malformed data, non-finite values, negative volumes, wrong UTC boundaries and duplicate dates fail closed', () => {
  const invalid = [
    row(monday, { volume: '-1' }), row(monday, { volume: '' }), row(monday, { volume: 'Infinity' }),
    row(monday, { high: '99' }), row(monday, { low: '111' }), row(monday, { close: 'NaN' }),
    row(monday + 1), row(monday, { open: null }), row(monday, { volume: '1e5' }),
    { ...row(monday), timestamp: monday }, { ...row(monday), close: 110 },
  ];
  for (const value of invalid) assert.throws(() => normal([value]));
  assert.throws(() => normal([row(monday), row(monday)]), /Duplicate/);
  assert.throws(() => normalizeDailyVolume({ data: { pair: 'ETH/USD', ohlc: [row(monday)] } }, { now }), /BTC\/USD/);
  assert.throws(() => normalizeDailyVolume([[monday, 90, 120, 100, 110, NaN]], { source: 'Coinbase Exchange', now }));
});

test('source-returned zero volume is retained while missing dates stay absent', () => {
  const series = normalizeDailyVolume([row(monday, { volume: '0.00000000' }), row(monday + 2 * DAY)], { now, start: '2010-01-01' });
  assert.equal(series.bars.length, 2); assert.equal(series.bars[0].volume, 0);
  assert.equal(series.coverage.sourceZeroVolumeBars, 1); assert.equal(series.coverage.gapCount, 1);
  assert.deepEqual(series.coverage.gaps, [{ startDate: '2026-10-13', endDate: '2026-10-13', missingDays: 1 }]);
  assert.equal(series.coverage.imputedBars, 0); assert.equal(series.coverage.gapsAreZeroVolume, false);
  assert.equal(series.firstDate, '2026-10-12');
});

test('completion boundary and inclusive asOf cutoff exclude current and future daily candles', () => {
  assert.equal(normalizeDailyVolume([row(monday)], { now: (monday + DAY) * 1000 - 1 }).bars.length, 0);
  assert.equal(normalizeDailyVolume([row(monday)], { now: (monday + DAY) * 1000 }).bars.length, 1);
  const series = normalizeDailyVolume(Array.from({ length: 12 }, (_, index) => row(monday + index * DAY)), { now, asOf: '2026-10-20' });
  assert.equal(series.lastDate, '2026-10-20'); assert.equal(series.excludedAfterAsOf, 1); assert.equal(series.excludedUnfinished, 2);
  assert.throws(() => normalizeDailyVolume([], { now: NaN }));
  assert.throws(() => normalizeDailyVolume([], { now, asOf: '2026-02-30' }));
});

test('snapshot keeps recorded retrieval time, OHLC and honest coverage after view cutoff', () => {
  const saved = snapshotFor([row(monday), row(monday + DAY)]);
  const result = parseVolumeSnapshot(saved, { now: now + 100 * DAY * 1000, asOf: '2026-10-12' });
  assert.equal(result.retrievedAt, saved.retrievedAt); assert.equal(result.bars.length, 1);
  assert.equal(result.originalCoverage.lastDate, '2026-10-13'); assert.equal(result.coverage.lastDate, '2026-10-12');
  assert.equal(saved.bars.length, 2); assert.equal(result.snapshot, true);
  for (const change of [
    value => value.unit = 'USD', value => value.source = 'Coinbase Exchange', value => value.globalMarketVolume = true,
    value => value.bars[0].high = 99, value => value.bars[0].date = '2026-10-13', value => value.coverage.gapCount = 4,
    value => value.retrievedAt = '2026-10-12T23:59:59Z', value => value.asOf = '2026-10-11',
    value => value.sourceUrls = ['https://example.com/fake-volume'],
    value => value.sourceUrls = ['https://www.bitstamp.net/api/v2/ohlc/btcusd/?step=60&limit=1'],
    value => value.documentationUrls = ['https://example.com/not-the-provider'],
  ]) { const bad = structuredClone(saved); change(bad); assert.throws(() => parseVolumeSnapshot(bad, { now })); }
});

test('UTC weekly OHLC uses Monday start, Sunday display date and the sum of seven actual days', () => {
  const daily = normal(Array.from({ length: 8 }, (_, index) => row(monday + index * DAY, { high: String(120 + index), low: String(90 - index), volume: String(index + 1) })));
  const result = aggregateWeeklyVolume(daily, { now });
  assert.equal(result.bars.length, 1); assert.equal(result.incompleteGroups, 1);
  assert.deepEqual(result.bars[0], { time: monday, date: '2026-10-18', startDate: '2026-10-12', endDate: '2026-10-18',
    open: 100, high: 126, low: 84, close: 110, volume: 28, daysIncluded: 7, complete: true });
  assert.equal(aggregateWeeklyVolume(daily, { now, asOf: '2026-10-17' }).bars.length, 0);
});

test('a missing observed day invalidates that week instead of manufacturing volume', () => {
  const rows = normal(Array.from({ length: 7 }, (_, index) => row(monday + index * DAY)).filter((_, index) => index !== 3));
  const result = aggregateWeeklyVolume(rows, { now });
  assert.equal(result.bars.length, 0); assert.equal(result.incompleteGroups, 1); assert.equal(result.imputedBars, 0);
  assert.throws(() => volumeCoverage([...rows].reverse()), /ordered/);
});

test('view filtering honors price asOf and never extends volume into unavailable history or forecast dates', () => {
  const bars = normal([row(monday), row(monday + DAY)]);
  assert.deepEqual(filterVolumeForView(bars, { start: '2010-01-01', end: '2050-12-31', asOf: '2026-10-12' }), [bars[0]]);
  assert.equal(filterVolumeForView(bars, { start: '2027-01-01', end: '2050-12-31' }).length, 0);
  assert.equal(filterVolumeForView(bars, { start: '2010-01-01', end: '2011-01-01' }).length, 0);
  assert.throws(() => filterVolumeForView([{ date: '2026-10-12', volume: -1 }]));
});

test('Bitstamp pagination respects its 1000-bar cap and end-precedence semantics without gaps', async () => {
  const first = Date.parse('2020-01-01T00:00:00Z') / 1000, end = first + 1003 * DAY, calls = [];
  const result = await fetchDailyVolumeHistory({ start: '2020-01-01', now: end * 1000,
    fetchImpl: async (url, options) => {
      const parsed = new URL(url), last = Number(parsed.searchParams.get('end')), count = Number(parsed.searchParams.get('limit'));
      assert.equal(parsed.origin, 'https://www.bitstamp.net'); assert.equal(parsed.searchParams.has('start'), false);
      assert.equal(parsed.searchParams.get('exclude_current_candle'), 'true'); assert.equal(last % DAY, DAY - 1);
      assert.equal(options.credentials, 'omit'); assert.ok(count <= 1000);
      calls.push({ count, last });
      return { ok: true, json: async () => sourcePayload(Array.from({ length: count }, (_, index) => row(last + 1 - (index + 1) * DAY))) };
    } });
  assert.deepEqual(calls.map(call => call.count), [1000, 3]);
  assert.equal(result.bars.length, 1003); assert.equal(result.bars[0].time, first); assert.equal(result.bars.at(-1).time + DAY, end);
  assert.equal(result.coverage.gapCount, 0); assert.equal(result.collection.requestCount, 2);
});

test('provider overlap is filtered and early unavailable history is never filled', async () => {
  const result = await fetchDailyVolumeHistory({ start: '2026-10-10', now, fetchImpl: async () => ({ ok: true,
    json: async () => sourcePayload([row(monday - 3 * DAY), row(monday), row(monday + DAY)]) }) });
  assert.equal(result.bars.length, 2); assert.equal(result.firstDate, '2026-10-12'); assert.equal(result.collection.excludedOutsideRequest, 1);
});

test('HTTP denial, malformed pages and abortion are visible and trigger no retry or provider change', async () => {
  let calls = 0;
  await assert.rejects(fetchDailyVolumeHistory({ now, fetchImpl: async () => { calls++; return { ok: false, status: 403 }; } }), /HTTP 403/);
  assert.equal(calls, 1);
  await assert.rejects(fetchDailyVolumeHistory({ now, fetchImpl: async () => ({ ok: true, json: async () => sourcePayload(Array(1001).fill(row(monday))) }) }), /candle limit/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(fetchDailyVolumeHistory({ now, signal: controller.signal, fetchImpl: async () => { calls++; } }), { name: 'AbortError' });
  assert.equal(calls, 1);
  const finalController = new AbortController();
  await assert.rejects(fetchDailyVolumeHistory({ start: '2026-10-12', now, signal: finalController.signal,
    fetchImpl: async () => ({ ok: true, json: async () => { finalController.abort(); return sourcePayload([row(monday)]); } }) }), { name: 'AbortError' });
});

test('recorded production history has genuine provenance, full OHLC, correct cutoff and reproducible independent witnesses', async () => {
  const raw = JSON.parse(await readFile(new URL('../dist/data/btc-volume.json', import.meta.url), 'utf8'));
  const parsed = parseVolumeSnapshot(raw, { now: Date.parse(raw.retrievedAt) });
  assert.equal(parsed.source, 'Bitstamp'); assert.equal(parsed.firstDate, '2011-08-18');
  assert.ok(parsed.bars.length >= 5544); assert.equal(parsed.bars[0].volume, 0.48990826);
  assert.equal(parsed.coverage.imputedBars, 0); assert.equal(parsed.globalMarketVolume, false);
  assert.ok(parsed.bars.every(bar => bar.high >= Math.max(bar.open, bar.close) && bar.low <= Math.min(bar.open, bar.close)));
  const earlyCutoff = parseVolumeSnapshot(raw, { now: Date.parse(raw.retrievedAt), asOf: '2026-10-20' });
  assert.equal(earlyCutoff.lastDate, '2026-10-20');
  assert.equal(raw.validation.nativeResolution.hourly.maxAbsDifferenceBTC, '0.00000000');
  assert.equal(raw.validation.nativeResolution.quarterHourly.maxAbsDifferenceBTC, '0.00000000');
  assert.ok(raw.validation.baseUnit.completedMinutes >= 2); assert.ok(raw.validation.independentExchange.comparedDays >= 2);
  assert.equal(raw.validation.status, 'PASS'); assert.equal(raw.validation.observedBars, parsed.bars.length);
});
