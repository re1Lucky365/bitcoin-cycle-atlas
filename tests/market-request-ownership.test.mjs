import assert from 'node:assert/strict';
import test from 'node:test';
import { createMarketDataController } from '../dist/market-data-controller.js';

const savedTime = Date.parse('2020-01-01T00:00:00Z') / 1000;
const saved = {
  version: 1, source: 'Coinbase Exchange', product: 'BTC-USD',
  intervals: {
    '1m': {
      interval: '1m', seconds: 60, retrievedAt: '2020-01-01T00:05:00.000Z',
      candles: [{ time: savedTime, date: new Date(savedTime * 1000).toISOString(), open: 100, high: 120, low: 90, close: 110, volume: 2 }],
    },
  },
};

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function response(address) {
  const url = new URL(address), step = Number(url.searchParams.get('granularity'));
  const first = Date.parse(url.searchParams.get('start')) / 1000;
  const end = Date.parse(url.searchParams.get('end')) / 1000;
  return { ok: true, json: async () => Array.from({ length: (end - first) / step }, (_, index) => [first + index * step, 90, 130, 100, 120, 3]) };
}

// Replay the model's Load -> LiveFailure -> Load -> SavedSuccess path against
// the real controller. Both await-completion orders matter: the newer request
// can still own the slot, or it can have finished and left the slot empty.
for (const interval of ['1m', '5m']) {
  for (const newerFinishesFirst of [false, true]) {
    for (const savedFails of [false, true]) {
      test(`an older saved fallback cannot replace ${interval}; newer first=${newerFinishesFirst}; saved failure=${savedFails}`, { timeout: 2000 }, async t => {
        const savedReply = deferred(), fallbackStarted = deferred(), freshReply = deferred();
        const changes = [];
        let liveRequests = 0, freshUrl;
        const controller = createMarketDataController({
          onChange: (id, entry) => changes.push({ id, status: entry.status, series: entry.series }),
          fetchImpl: async url => {
            if (url === './data/btc-ohlc.json') { fallbackStarted.resolve(); return savedReply.promise; }
            if (++liveRequests === 1) throw new Error('Exchange unavailable for older request');
            freshUrl = url;
            return freshReply.promise;
          },
        });
        t.after(() => controller.cancel());
        const older = controller.load('1m');
        await fallbackStarted.promise;
        const newer = controller.load(interval, { force: true });
        if (newerFinishesFirst) { freshReply.resolve(response(freshUrl)); await newer; }
        const beforeLateResult = controller.get(interval);
        const changesBeforeLateResult = changes.length;
        if (savedFails) savedReply.reject(new Error('Saved response failed after replacement'));
        else savedReply.resolve({ ok: true, json: async () => saved });
        await older;
        assert.equal(controller.get(interval), beforeLateResult, 'a superseded fallback must not replace the selected entry');
        assert.equal(changes.length, changesBeforeLateResult, 'a superseded fallback must not notify the UI');
        if (interval !== '1m') assert.equal(controller.get('1m').status, 'idle');
        if (!newerFinishesFirst) { freshReply.resolve(response(freshUrl)); await newer; }
        assert.equal(controller.get(interval).status, 'ready');
        assert.equal(controller.get(interval).series.candles[0].close, 120);
      });
    }
  }
}
