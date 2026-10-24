import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {buildTreasuryProjection} from '../dist/treasury-projection.js';

const baseDate = '2026-10-23';
const rawEquity = JSON.parse(await readFile(new URL('../dist/data/bmnr-ohlc.json', import.meta.url), 'utf8'));
const rawEth = JSON.parse(await readFile(new URL('../dist/data/eth-ohlc.json', import.meta.url), 'utf8'));
// Freeze the observation cutoff so a later archive refresh neither changes this
// test's dates nor collides with the explicitly synthetic update below.
const equity = {...rawEquity, candles: rawEquity.candles.filter(row => row.date.slice(0, 10) <= baseDate)};
const eth = {...rawEth, dailyHistory: {...rawEth.dailyHistory, candles: rawEth.dailyHistory.candles.filter(row => row.date.slice(0, 10) <= baseDate)}};
const options = {symbol: 'BMNR', history: equity, ethHistory: eth, endYear: 2027};
const current = buildTreasuryProjection(options);

// Deliberately synthetic future observations, confined to this test. No stored
// market observations are modified or represented as independently retrieved.
const nextDate = '2026-10-26';
const nextEquity = {...equity, syntheticFixture: true, candles: [...equity.candles, {
  date: `${nextDate}T00:00:00Z`, sessionDate: nextDate, close: 31,
}]};
const futurePrices = [['2026-10-24', 2430], ['2026-10-25', 2450], [nextDate, 2600]];
const nextEth = {...eth, syntheticFixture: true, retrievedAt: '2026-10-27T12:00:00Z', dailyHistory: {
  ...eth.dailyHistory, retrievedAt: '2026-10-27T12:00:00Z', requestedEnd: Date.parse('2026-10-27') / 1000,
  candles: [...eth.dailyHistory.candles, ...futurePrices.map(([date, close]) => ({
    date: `${date}T00:00:00Z`, time: Date.parse(date) / 1000, open: close, high: close, low: close, close,
  }))],
}};

test('the actual-data projection aligns all financial conditions to the exact observed session and ETH close', () => {
  assert.equal(current.asOf, baseDate);
  const lastEquity = equity.candles.find(row => row.date.slice(0, 10) === baseDate);
  const lastEth = eth.dailyHistory.candles.find(row => row.date.slice(0, 10) === baseDate);
  assert.deepEqual(Object.keys(current.forecasts), ['stress', 'base', 'bull']);
  for (const forecast of Object.values(current.forecasts)) {
    assert.equal(forecast.asOf, baseDate);
    assert.equal(forecast.coinAnchor.date, baseDate);
    assert.equal(forecast.coinAnchor.price, lastEth.close);
    assert.equal(forecast.coinAnchor.retrievedAt, eth.dailyHistory.retrievedAt);
    assert.equal(forecast.path[0].components.coinPrice, lastEth.close);
    assert.ok(Math.abs(forecast.path[0].price - lastEquity.close) < 1e-10);
    assert.equal(forecast.pathMode, 'asset-linked-daily');
    assert.equal(forecast.assetPath.training.maxSourceDate, baseDate);
  }
});

test('a valid later synthetic session updates both market anchors without borrowing the old catalog price', () => {
  const projection = buildTreasuryProjection({...options, history: nextEquity, ethHistory: nextEth});
  assert.equal(projection.asOf, nextDate);
  for (const forecast of Object.values(projection.forecasts)) {
    assert.equal(forecast.coinAnchor.date, nextDate);
    assert.equal(forecast.coinAnchor.price, 2600);
    assert.equal(forecast.coinAnchor.retrievedAt, nextEth.dailyHistory.retrievedAt);
    assert.equal(forecast.path[0].date, nextDate);
    assert.equal(forecast.path[0].components.coinPrice, 2600);
    assert.ok(Math.abs(forecast.path[0].price - 31) < 1e-10);
    assert.equal(forecast.assetPath.training.maxSourceDate, nextDate);
  }
});

test('a weekend cutoff uses the preceding actual stock session and ignores later crypto observations', () => {
  const projection = buildTreasuryProjection({...options, history: nextEquity, ethHistory: nextEth, asOf: '2026-10-25'});
  assert.equal(projection.asOf, baseDate);
  for (const id of ['stress', 'base', 'bull']) {
    assert.equal(projection.forecasts[id].coinAnchor.date, baseDate);
    assert.deepEqual(projection.forecasts[id].path, current.forecasts[id].path);
  }
});

test('a new equity session cannot reuse stale crypto data or an invented missing day', () => {
  assert.throws(() => buildTreasuryProjection({...options, history: nextEquity}), /exact equity asOf/);
  const missing = {...nextEth, dailyHistory: {...nextEth.dailyHistory,
    candles: nextEth.dailyHistory.candles.filter(row => row.date.slice(0, 10) !== '2026-10-24'),
  }};
  assert.throws(() => buildTreasuryProjection({...options, history: nextEquity, ethHistory: missing}), /consecutive/);
});

test('projection milestones use one explicit simulated-turn rule with distinct event and confirmation dates', () => {
  let turns = 0;
  for (const forecast of Object.values(current.forecasts)) {
    assert.equal(new Set(forecast.milestones.map(row => row.id)).size, forecast.milestones.length);
    for (const row of forecast.milestones.filter(item => item.turnType !== undefined)) {
      turns++;
      assert.equal(row.kind, 'simulated-turn');
      assert.ok(['high', 'low'].includes(row.turnType));
      assert.equal(row.threshold, 0.12);
      assert.ok(row.confirmationDate > row.date);
      assert.equal(row.probability, null);
      assert.equal(row.price, forecast.path.find(point => point.date === row.date).price);
    }
  }
  assert.ok(turns > 0, 'The actual source path must exercise the sole turn detector');
});

test('explicit projection cutoffs reject invalid dates and periods before the available session', () => {
  assert.throws(() => buildTreasuryProjection({...options, asOf: '2026-02-30'}));
  assert.throws(() => buildTreasuryProjection({...options, history: [{date: baseDate, close: 22.4}], asOf: '2026-10-22'}), /No observed equity session/);
  assert.throws(() => buildTreasuryProjection({...options, history: [{date: 'bad-date', close: 22.4}]}), /session date/);
});
