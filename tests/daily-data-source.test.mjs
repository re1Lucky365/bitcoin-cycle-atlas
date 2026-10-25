import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { bitcoinDailyAsset, dailyAssetFromArchive, loadDailyAsset } from '../dist/daily-data-source.js';

const read = async name => JSON.parse(await readFile(new URL(`../dist/data/${name}.json`, import.meta.url), 'utf8'));
const [btc, eth, mstr, bmnr] = await Promise.all(['btc-daily', 'eth-ohlc', 'mstr-ohlc', 'bmnr-ohlc'].map(read));

test('daily analytics retains the published BTC observations and their price definition', () => {
  const asset = bitcoinDailyAsset(btc);
  assert.equal(asset.prices, btc.prices);
  assert.equal(asset.calendar, 'daily');
  assert.equal(asset.symbol, 'BTC');
  assert.equal(asset.asOfDate, btc.meta.retrievedAt.slice(0, 10));
  assert.equal(asset.timezone, 'UTC');
  assert.match(asset.priceNote, /일말/);
  assert.throws(() => bitcoinDailyAsset({ ...btc, meta: { ...btc.meta, metric: 'CapMrktCurUSD' } }), /identity/);
  assert.throws(() => bitcoinDailyAsset({ ...btc, meta: { ...btc.meta, count: 1 } }), /coverage/);
  assert.throws(() => bitcoinDailyAsset({ ...btc, meta: { ...btc.meta, source: 'https://example.com/prices' } }), /source/);
  assert.throws(() => bitcoinDailyAsset({ ...btc, meta: { ...btc.meta, retrievedAt: btc.meta.lastDate + 'T12:00:00Z' } }), /completed/);
});

test('ETH uses only observed Coinbase closing prices and preserves its shorter coverage', () => {
  const asset = dailyAssetFromArchive('ETH', eth);
  assert.equal(asset.prices.length, eth.dailyHistory.candles.length);
  assert.equal(asset.prices[0][0], eth.dailyHistory.firstDate.slice(0, 10));
  assert.deepEqual(asset.prices.at(-1), [eth.dailyHistory.lastDate.slice(0, 10), eth.dailyHistory.candles.at(-1).close]);
  assert.equal(asset.sourceName, 'Coinbase Exchange');
  assert.match(asset.coverageNote, new RegExp(`${eth.dailyHistory.gapCount}일의 결측`));
  assert.throws(() => dailyAssetFromArchive('ETH', { ...eth, product: 'BTC-USD' }), /identity/);
});

test('equity analytics uses split-adjusted close rather than dividend-adjusted close', () => {
  for (const [symbol, payload] of [['MSTR', mstr], ['BMNR', bmnr]]) {
    const edited = { ...payload, candles: payload.candles.map(row => ({ ...row, adjustedClose: 0.01 })) };
    const asset = dailyAssetFromArchive(symbol, edited);
    assert.equal(asset.prices[0][1], payload.candles[0].close);
    assert.equal(asset.prices.at(-1)[1], payload.candles.at(-1).close);
    assert.equal(asset.prices.length, payload.candles.length);
    assert.equal(asset.calendar, 'sessions');
    assert.equal(asset.timezone, 'America/New_York');
    assert.match(asset.priceNote, /배당 미포함/);
    assert.equal(asset.coverageNote, payload.coverageNote);
  }
  assert.throws(() => dailyAssetFromArchive('MSTR', bmnr), /identity/);
  assert.throws(() => dailyAssetFromArchive('BMNR', { ...bmnr, unavailableSessions: ['2026-02-30'] }), /Invalid calendar/);
});

test('standalone archives are read locally and malformed embedded data cannot fall through to a network request', async () => {
  for (const [symbol, payload] of [['ETH', eth], ['MSTR', mstr], ['BMNR', bmnr]]) {
    const expectedId = `embedded-${symbol.toLowerCase()}-data`;
    const asset = await loadDailyAsset(symbol, {
      document: { getElementById(id) { assert.equal(id, expectedId); return { textContent: JSON.stringify(payload) }; } },
      fetch() { throw new Error('Unexpected network request'); },
    });
    assert.equal(asset.symbol, symbol);
  }
  await assert.rejects(loadDailyAsset('ETH', {
    document: { getElementById() { return { textContent: '{}' }; } },
    fetch() { throw new Error('Must not fetch after corrupt embedded archive'); },
  }), /identity/);
});

test('published loading checks HTTP status and source identity before exposing rows', async () => {
  let requests = 0;
  const asset = await loadDailyAsset('BMNR', { document: null, fetch: async (url, options) => {
    requests++;
    assert.equal(url, './data/bmnr-ohlc.json');
    assert.equal(options.cache, 'no-cache');
    assert.ok(options.signal);
    return { ok: true, json: async () => bmnr };
  } });
  assert.equal(asset.prices.length, bmnr.candles.length);
  assert.equal(requests, 1);
  await assert.rejects(loadDailyAsset('MSTR', { document: null, fetch: async () => ({ ok: false, status: 503 }) }), /503/);
  await assert.rejects(loadDailyAsset('MSTR', { document: null, fetch: async () => ({ ok: true, json: async () => bmnr }) }), /identity/);
  await assert.rejects(loadDailyAsset('SPY', { fetch() { throw new Error('Unexpected network request'); } }), /Unsupported/);
});
