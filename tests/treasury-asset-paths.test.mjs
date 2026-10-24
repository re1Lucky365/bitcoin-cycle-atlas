import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { buildTreasuryAssetPaths } from '../dist/treasury-asset-paths.js';
import { buildLongHorizonForecast } from '../dist/long-horizon-forecast.js';
import { utcDay, dateFromDay } from '../dist/cycle-engine.js';

const btcHistory = JSON.parse(await readFile(new URL('./fixtures/btc-daily-2026-10-20.json', import.meta.url), 'utf8'));
const ethHistory = JSON.parse(await readFile(new URL('../dist/data/eth-ohlc.json', import.meta.url), 'utf8'));
const ethRows = ethHistory.dailyHistory.candles;
const ethAsOf = '2026-10-20';
const ethOptions = { symbol: 'BMNR', ethHistory, asOf: ethAsOf, endYear: 2035 };
const eth = buildTreasuryAssetPaths(ethOptions);
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) <= 1e-10 * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);

test('MSTR consumes the same seeded BTC engine path in every economic condition', () => {
  const bundle = buildTreasuryAssetPaths({ symbol: 'MSTR', btcHistory, asOf: '2026-10-20', endYear: 2035 });
  for (const [id, scenario] of Object.entries({ stress: 'stress', base: 'base', bull: 'accelerated' })) {
    const direct = buildLongHorizonForecast(btcHistory, { scenario, asOf: '2026-10-20', researchAsOf: '2026-10-20' });
    const actual = bundle.scenarios[id];
    assert.deepEqual(actual.path.map(row => [row.date, row.price, row.baselinePrice]), direct.path.filter(row => row.date <= '2035-12-31').map(row => [row.date, row.price, row.baselinePrice]));
    assert.equal(actual.metadata.engineScenario, scenario);
    assert.equal(actual.training.maxSourceDate, bundle.asOf);
    assert.ok(actual.training.representativeBlocks.every(block => block.sourceEndDate <= bundle.asOf));
    assert.equal(actual.metadata.probability, null);
    assert.equal(actual.metadata.managementTargetAppliedToPath, false);
    assert.equal(actual.metadata.ohlcClaim, false);
  }
});

test('ETH includes every future calendar day from the exact observed anchor', () => {
  const anchor = ethRows.find(row => row.date.slice(0, 10) === ethAsOf).close;
  assert.equal(eth.asset, 'ETH');
  for (const scenario of Object.values(eth.scenarios)) {
    assert.equal(scenario.path[0].price, anchor);
    assert.equal(scenario.path[0].kind, 'observed-anchor');
    assert.equal(scenario.path.at(-1).date, '2035-12-31');
    assert.equal(scenario.path.length, utcDay('2035-12-31') - utcDay(ethAsOf) + 1);
    for (let index = 0; index < scenario.path.length; index++) {
      const point = scenario.path[index];
      assert.equal(point.date, dateFromDay(utcDay(ethAsOf) + index));
      assert.ok(Number.isFinite(point.price) && point.price > 0);
      assert.equal('open' in point, false);
      assert.equal('high' in point, false);
      assert.equal('low' in point, false);
    }
  }
});

test('ETH uses coherent shared residuals while keeping economic conditions separate from outcomes', () => {
  const targets = { stress: 360, base: eth.scenarios.base.path[0].price, bull: 22000 };
  for (const [id, scenario] of Object.entries(eth.scenarios)) {
    const target = scenario.path.find(row => row.date === '2030-12-31');
    close(target.baselinePrice, targets[id]);
    assert.notEqual(target.price, target.baselinePrice);
    close(scenario.path.at(-1).baselinePrice, target.baselinePrice);
    assert.notEqual(scenario.path.at(-1).price, target.price);
    assert.equal(scenario.metadata.repeatedFourYearWaves, false);
    assert.equal(scenario.metadata.calibrated, false);
    assert.equal(scenario.metadata.probability, null);
    assert.equal(scenario.metadata.sampleCount, 1);
    assert.equal(scenario.metadata.terminalPriceForced, false);
  }
  for (let index = 0; index < eth.scenarios.base.path.length; index++) {
    const base = eth.scenarios.base.path[index];
    const bull = eth.scenarios.bull.path[index];
    close(base.price / base.baselinePrice, bull.price / bull.baselinePrice);
  }
  const prices = eth.scenarios.base.path.map(row => row.price);
  assert.ok(prices.some((price, index) => index > 0 && price > prices[index - 1]));
  assert.ok(prices.some((price, index) => index > 0 && price < prices[index - 1]));
});

test('ETH provenance records only post-Merge blocks available by the equity cutoff', () => {
  const training = eth.scenarios.base.training;
  assert.equal(training.firstObservation, '2022-09-15');
  assert.equal(training.maxSourceDate, ethAsOf);
  assert.equal(training.informationThrough, ethAsOf);
  assert.equal(training.overlappingBlocksAreIndependent, false);
  assert.ok(training.representativeBlocks.length > 0);
  let prior = ethAsOf;
  for (const block of training.representativeBlocks) {
    assert.ok(block.sourceStartDate >= '2022-09-15');
    assert.ok(block.sourceStartDate < block.sourceReturnStartDate);
    assert.ok(block.sourceEndDate <= ethAsOf);
    assert.equal(utcDay(block.sourceEndDate) - utcDay(block.sourceStartDate), block.days);
    assert.equal(utcDay(block.targetStartDate), utcDay(prior) + 1);
    assert.equal(utcDay(block.targetEndDate) - utcDay(block.targetStartDate) + 1, block.days);
    prior = block.targetEndDate;
  }
  assert.equal(prior, eth.endDate);
});

test('appended or modified future ETH observations cannot change a frozen forecast', () => {
  const altered = ethRows.map(row => row.date.slice(0, 10) > ethAsOf ? { ...row, close: 1e10 } : row);
  altered.push({ date: '2026-10-24', close: 1e-10 });
  assert.deepEqual(buildTreasuryAssetPaths({ ...ethOptions, ethHistory: altered }), eth);
});

test('pre-Merge price history is excluded from ETH residual estimation', () => {
  const altered = ethRows.map(row => row.date < '2022-09-15' ? { ...row, close: 1e10 } : row);
  assert.deepEqual(buildTreasuryAssetPaths({ ...ethOptions, ethHistory: altered }), eth);
});

test('fixed seeds reproduce ETH paths and horizon changes preserve the earlier prefix', () => {
  assert.deepEqual(buildTreasuryAssetPaths(ethOptions), eth);
  const different = buildTreasuryAssetPaths({ ...ethOptions, seed: 20261023 });
  assert.notDeepEqual(different.scenarios.base.path, eth.scenarios.base.path);
  const extended = buildTreasuryAssetPaths({ ...ethOptions, endYear: 2050 });
  for (const id of ['stress', 'base', 'bull']) assert.deepEqual(extended.scenarios[id].path.slice(0, eth.scenarios[id].path.length), eth.scenarios[id].path);
});

test('missing post-Merge days and too-short ETH samples are not filled or silently substituted', () => {
  const missing = ethRows.filter(row => row.date.slice(0, 10) !== '2025-02-01');
  assert.throws(() => buildTreasuryAssetPaths({ ...ethOptions, ethHistory: missing }), /consecutive/);
  const short = ethRows.filter(row => row.date.slice(0, 10) <= ethAsOf).slice(-365);
  assert.throws(() => buildTreasuryAssetPaths({ ...ethOptions, ethHistory: short }), /366/);
});

test('asset histories must contain an exact cutoff close rather than borrowing a later day', () => {
  const missing = ethRows.filter(row => row.date.slice(0, 10) !== ethAsOf);
  assert.throws(() => buildTreasuryAssetPaths({ ...ethOptions, ethHistory: missing }), /exact equity asOf/);
  assert.throws(() => buildTreasuryAssetPaths({ ...ethOptions, asOf: '2027-01-01' }), /exact equity asOf/);
});

test('malformed, duplicate, sparse, reordered and conflicting dated rows fail at the boundary', () => {
  assert.throws(() => buildTreasuryAssetPaths({ ...ethOptions, ethHistory: [...ethRows, { date: 'bad-date', close: 1 }] }), /ISO/);
  assert.throws(() => buildTreasuryAssetPaths({ ...ethOptions, ethHistory: [...ethRows, ethRows.at(-1)] }), /chronological/);
  const sparse = [...ethRows]; delete sparse[0];
  assert.throws(() => buildTreasuryAssetPaths({ ...ethOptions, ethHistory: sparse }), /ISO/);
  const reversed = [...ethRows].reverse();
  assert.throws(() => buildTreasuryAssetPaths({ ...ethOptions, ethHistory: reversed }), /chronological/);
  const conflict = ethRows.map((row, index) => index === 0 ? { ...row, time: row.time + 1 } : row);
  assert.throws(() => buildTreasuryAssetPaths({ ...ethOptions, ethHistory: conflict }), /conflicts/);
});

test('invalid prices and constant returns cannot invent future ETH variation', () => {
  const invalid = ethRows.map((row, index) => index === 0 ? { ...row, close: 0 } : row);
  assert.throws(() => buildTreasuryAssetPaths({ ...ethOptions, ethHistory: invalid }), /positive/);
  const constant = ethRows.map(row => ({ ...row, close: 100 }));
  assert.throws(() => buildTreasuryAssetPaths({ ...ethOptions, ethHistory: constant }), /positive realized/);
});

test('wrong assets and uncompleted raw exchange archives cannot enter ETH simulation', () => {
  assert.throws(() => buildTreasuryAssetPaths({ ...ethOptions, ethHistory: { ...ethHistory, product: 'BTC-USD' } }), /ETH-USD/);
  assert.throws(() => buildTreasuryAssetPaths({ ...ethOptions, ethHistory: { ...ethHistory, dailyHistory: { ...ethHistory.dailyHistory, completedOnly: false } } }), /completed/);
  assert.throws(() => buildTreasuryAssetPaths({ ...ethOptions, ethHistory: { ...ethHistory, product: undefined } }), /ETH-USD/);
  assert.throws(() => buildTreasuryAssetPaths({ ...ethOptions, ethHistory: { ...ethHistory, dailyHistory: { ...ethHistory.dailyHistory, source: 'Conflicting provider' } } }), /Coinbase/);
});

test('symbol, horizon, seed and cutoff are explicit bounded inputs', () => {
  for (const symbol of ['BTC', 'ETH', undefined]) assert.throws(() => buildTreasuryAssetPaths({ ...ethOptions, symbol }), /MSTR or BMNR/);
  for (const seed of [-1, 1.5, Infinity, NaN, 4294967296]) assert.throws(() => buildTreasuryAssetPaths({ ...ethOptions, seed }), /seed/);
  for (const endYear of [2026, 2051, 2030.5]) assert.throws(() => buildTreasuryAssetPaths({ ...ethOptions, endYear }), /2027/);
  assert.throws(() => buildTreasuryAssetPaths({ ...ethOptions, asOf: '2026-02-30' }));
  assert.throws(() => buildTreasuryAssetPaths({ ...ethOptions, asOf: undefined }));
});
