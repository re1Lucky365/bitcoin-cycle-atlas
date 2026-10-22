import assert from 'node:assert/strict';
import test from 'node:test';
import { createMarketDataController, marketStatusText } from '../dist/market-data-controller.js';
import { CANDLE_ENDPOINT } from '../dist/ohlc-data.js';

const savedAt = '2020-01-01T00:05:00.000Z';
const savedTime = Date.parse('2020-01-01T00:00:00.000Z') / 1000;
const testOptions = { timeout: 1000 };

function savedSnapshot() {
  return {
    version: 1, source: 'Coinbase Exchange', product: 'BTC-USD',
    intervals: {
      '1m': {
        interval: '1m', seconds: 60, retrievedAt: savedAt, gapCount: 0,
        candles: [{ time: savedTime, date: new Date(savedTime * 1000).toISOString(), open: 100, high: 120, low: 90, close: 110, volume: 2 }],
      },
    },
  };
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

// Generate only complete provider candles from the actual request boundaries.
// No network or wall-clock delay is needed, and the real parser still runs.
function publicResponse(address) {
  const url = new URL(address);
  assert.equal(`${url.origin}${url.pathname}`, CANDLE_ENDPOINT);
  const step = Number(url.searchParams.get('granularity'));
  const first = Date.parse(url.searchParams.get('start')) / 1000;
  const end = Date.parse(url.searchParams.get('end')) / 1000;
  const payload = Array.from({ length: (end - first) / step }, (_, index) => [first + index * step, 90, 130, 100, 120, 3]).reverse();
  return { ok: true, json: async () => payload };
}

function recordChanges() {
  const changes = [];
  return { changes, onChange: (interval, entry) => changes.push({ interval, status: entry.status, series: entry.series }) };
}

test('network failure uses validated embedded candles and retains their original collection time', testOptions, async t => {
  const record = recordChanges(), calls = [];
  let embeddedReads = 0;
  const controller = createMarketDataController({
    onChange: record.onChange,
    fetchImpl: async url => { calls.push(url); throw new Error('Exchange offline'); },
    readEmbedded: () => { embeddedReads++; return JSON.stringify(savedSnapshot()); },
  });
  t.after(() => controller.cancel());

  await controller.load('1m');
  const entry = controller.get('1m');
  assert.equal(entry.status, 'snapshot');
  assert.equal(entry.error, 'Exchange offline');
  assert.equal(entry.series.snapshot, true);
  assert.equal(entry.series.completedOnly, true);
  assert.equal(entry.series.retrievedAt, savedAt);
  assert.deepEqual(entry.series.candles, savedSnapshot().intervals['1m'].candles);
  assert.equal(embeddedReads, 1);
  assert.equal(calls.length, 1, 'embedded fallback must not fetch a second source');
  assert.match(marketStatusText(entry), /연결 실패 · 저장 자료 2020-01-01 00:05 UTC/);
  assert.deepEqual(record.changes.map(change => change.status), ['loading', 'snapshot']);
});

test('invalid saved OHLC is rejected instead of becoming a successful fallback', testOptions, async t => {
  const invalid = savedSnapshot();
  invalid.intervals['1m'].candles[0].high = 99;
  const controller = createMarketDataController({
    fetchImpl: async () => { throw new Error('Exchange offline'); },
    readEmbedded: () => JSON.stringify(invalid),
  });
  t.after(() => controller.cancel());
  await controller.load('1m');
  assert.equal(controller.get('1m').status, 'error');
  assert.equal(controller.get('1m').series, null);
});

test('failure of both exchange and saved data stays in error without an automatic retry loop', testOptions, async t => {
  const record = recordChanges(), calls = [];
  const controller = createMarketDataController({
    onChange: record.onChange,
    fetchImpl: async url => {
      calls.push(url);
      return { ok: false, status: url === './data/btc-ohlc.json' ? 404 : 503 };
    },
  });
  t.after(() => controller.cancel());
  await controller.load('1m');
  assert.equal(controller.get('1m').status, 'error');
  assert.equal(controller.get('1m').series, null);
  assert.match(controller.get('1m').error, /HTTP 503/);
  assert.equal(calls.length, 2);
  assert.equal(calls[1], './data/btc-ohlc.json');
  for (let repeat = 0; repeat < 4; repeat++) await controller.load('1m');
  assert.equal(calls.length, 2, 'rendering the same failed interval must not restart requests');
  assert.deepEqual(record.changes.map(change => change.status), ['loading', 'error']);
  assert.match(marketStatusText(controller.get('1m')), /새로고침으로 재시도/);
});

test('a forced refresh replaces a saved fallback after a successful validated response', testOptions, async t => {
  const record = recordChanges(), refreshResponse = deferred();
  let attempts = 0, refreshUrl;
  const controller = createMarketDataController({
    onChange: record.onChange,
    readEmbedded: () => JSON.stringify(savedSnapshot()),
    fetchImpl: async url => {
      attempts++;
      if (attempts === 1) throw new Error('Initially offline');
      refreshUrl = url;
      return refreshResponse.promise;
    },
  });
  t.after(() => controller.cancel());
  await controller.load('1m');
  const original = controller.get('1m').series;
  await controller.load('1m');
  assert.equal(attempts, 1, 'a saved result remains cached until an explicit refresh');

  const refresh = controller.load('1m', { force: true });
  assert.equal(controller.get('1m').status, 'loading');
  assert.equal(controller.get('1m').series, original);
  assert.equal(controller.get('1m').series.retrievedAt, savedAt);
  assert.match(marketStatusText(controller.get('1m')), /갱신 중 · 이전 조회/);
  refreshResponse.resolve(publicResponse(refreshUrl));
  await refresh;

  const updated = controller.get('1m');
  assert.equal(updated.status, 'ready');
  assert.equal(updated.error, null);
  assert.notEqual(updated.series.retrievedAt, savedAt);
  assert.equal(updated.series.snapshot, undefined);
  assert.equal(updated.series.candles.length, 180);
  assert.equal(updated.series.gapCount, 0);
  assert.equal(updated.series.candles[0].close, 120);
  assert.deepEqual(record.changes.map(change => change.status), ['loading', 'snapshot', 'loading', 'ready']);
});

test('switching intervals aborts the previous request and a late response cannot overwrite or notify', testOptions, async t => {
  const record = recordChanges(), oldResponse = deferred();
  let oldUrl, oldSignal, embeddedReads = 0;
  const controller = createMarketDataController({
    onChange: record.onChange,
    readEmbedded: () => { embeddedReads++; return JSON.stringify(savedSnapshot()); },
    fetchImpl: async (url, options) => {
      if (new URL(url).searchParams.get('granularity') === '60') {
        oldUrl = url; oldSignal = options.signal;
        return oldResponse.promise; // Deliberately ignore abort until the old response arrives.
      }
      return publicResponse(url);
    },
  });
  t.after(() => controller.cancel());
  const first = controller.load('1m');
  await controller.load('5m');
  assert.equal(oldSignal.aborted, true);
  assert.equal(controller.get('1m').status, 'idle');
  const selected = controller.get('5m');
  assert.equal(selected.status, 'ready');
  const notificationsBeforeLateResponse = record.changes.length;

  oldResponse.resolve(publicResponse(oldUrl));
  await first;
  assert.equal(controller.get('5m'), selected);
  assert.equal(controller.get('1m').status, 'idle');
  assert.equal(record.changes.length, notificationsBeforeLateResponse);
  assert.equal(embeddedReads, 0, 'an aborted old request must not start fallback work');
  assert.deepEqual(record.changes.map(change => `${change.interval}:${change.status}`), ['1m:loading', '5m:loading', '5m:ready']);
});

test('switching back to a cached interval still cancels the outstanding different interval', testOptions, async t => {
  const record = recordChanges(), oldResponse = deferred();
  let oldUrl, oldSignal;
  const controller = createMarketDataController({
    onChange: record.onChange,
    fetchImpl: async (url, options) => {
      if (new URL(url).searchParams.get('granularity') === '60') {
        oldUrl = url; oldSignal = options.signal;
        return oldResponse.promise;
      }
      return publicResponse(url);
    },
  });
  t.after(() => controller.cancel());
  await controller.load('5m');
  const cached = controller.get('5m');
  const pending = controller.load('1m');
  await controller.load('5m');
  const cancelledAtSwitch = oldSignal.aborted;
  const notificationsAtSwitch = record.changes.length;
  oldResponse.resolve(publicResponse(oldUrl));
  await pending;

  assert.equal(cancelledAtSwitch, true);
  assert.equal(controller.get('5m'), cached);
  assert.equal(controller.get('1m').status, 'idle');
  assert.equal(record.changes.length, notificationsAtSwitch);
});

test('explicit cancellation produces no stale UI callback and does not enter fallback', testOptions, async t => {
  const record = recordChanges();
  let requestSignal, embeddedReads = 0;
  const controller = createMarketDataController({
    onChange: record.onChange,
    readEmbedded: () => { embeddedReads++; return JSON.stringify(savedSnapshot()); },
    fetchImpl: (_url, { signal }) => {
      requestSignal = signal;
      return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
    },
  });
  t.after(() => controller.cancel());
  const pending = controller.load('1m');
  controller.cancel();
  await pending;
  assert.equal(requestSignal.aborted, true);
  assert.equal(controller.get('1m').status, 'idle');
  assert.equal(controller.get('1m').series, null);
  assert.equal(embeddedReads, 0);
  assert.deepEqual(record.changes.map(change => change.status), ['loading']);
});

test('a saved-data response arriving after cancellation cannot publish stale fallback state', testOptions, async t => {
  const record = recordChanges(), savedResponse = deferred(), fallbackStarted = deferred();
  const controller = createMarketDataController({
    onChange: record.onChange,
    fetchImpl: async url => {
      if (url !== './data/btc-ohlc.json') throw new Error('Exchange offline');
      fallbackStarted.resolve();
      return savedResponse.promise;
    },
  });
  t.after(() => controller.cancel());
  const pending = controller.load('1m');
  await fallbackStarted.promise;
  controller.cancel();
  savedResponse.resolve({ ok: true, json: async () => savedSnapshot() });
  await pending;
  assert.equal(controller.get('1m').status, 'idle');
  assert.equal(controller.get('1m').series, null);
  assert.deepEqual(record.changes.map(change => change.status), ['loading']);
});

test('snapshot-first loading obeys cancellation even when saved data ignores abort and arrives late', testOptions, async t => {
  const record = recordChanges(), savedResponse = deferred();
  const calls = [];
  const controller = createMarketDataController({
    preferSnapshot: true,
    onChange: record.onChange,
    fetchImpl: url => {
      calls.push(url);
      assert.equal(url, './data/btc-ohlc.json');
      return savedResponse.promise;
    },
  });
  t.after(() => controller.cancel());

  const pending = controller.load('1m');
  assert.equal(controller.get('1m').status, 'loading');
  controller.cancel();
  const notificationsAtCancel = record.changes.length;
  savedResponse.resolve({ ok: true, json: async () => savedSnapshot() });
  await pending;

  assert.equal(controller.get('1m').status, 'idle');
  assert.equal(controller.get('1m').series, null);
  assert.equal(record.changes.length, notificationsAtCancel, 'cancelled snapshot work must not notify the UI');
  assert.deepEqual(calls, ['./data/btc-ohlc.json'], 'cancelled snapshot work must not start a live fallback');
});

test('a late preferred snapshot cannot overwrite a newer forced refresh of the same interval', testOptions, async t => {
  const record = recordChanges(), savedResponse = deferred();
  const calls = [];
  const controller = createMarketDataController({
    preferSnapshot: true,
    onChange: record.onChange,
    fetchImpl: async url => {
      calls.push(url);
      if (url === './data/btc-ohlc.json') return savedResponse.promise;
      return publicResponse(url);
    },
  });
  t.after(() => controller.cancel());

  const older = controller.load('1m');
  assert.equal(controller.get('1m').status, 'loading');
  await controller.load('1m', { force: true });
  const refreshed = controller.get('1m');
  assert.equal(refreshed.status, 'ready', 'force must restart an already active request for the same interval');
  assert.equal(refreshed.series.candles.length, 180);
  assert.equal(refreshed.series.snapshot, undefined);
  assert.notEqual(refreshed.series.retrievedAt, savedAt);
  const notificationsAfterRefresh = record.changes.length;

  savedResponse.resolve({ ok: true, json: async () => savedSnapshot() });
  await older;

  assert.equal(controller.get('1m'), refreshed, 'the older snapshot must not replace the fresh entry');
  assert.equal(record.changes.length, notificationsAfterRefresh, 'the late snapshot must not cause a stale render');
  assert.equal(calls.filter(url => url === './data/btc-ohlc.json').length, 1);
  assert.equal(calls.filter(url => url !== './data/btc-ohlc.json').length, 1);
});
