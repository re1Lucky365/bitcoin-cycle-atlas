import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { buildLongHorizonForecast, buildLongHorizonForecasts, LONG_HORIZON_SCENARIOS } from '../dist/long-horizon-forecast.js';

const data = JSON.parse(await readFile(new URL('./fixtures/btc-daily-2026-10-20.json', import.meta.url), 'utf8'));
const options = { sampleCount: 16, asOf: '2026-10-20' };
const scenarios = LONG_HORIZON_SCENARIOS.map(item => item.id);
const batch = buildLongHorizonForecasts(data, options);

test('batch results preserve every scalar field for all five economic conditions', () => {
  assert.deepEqual(Object.keys(batch), scenarios);
  for (const scenario of scenarios) assert.deepEqual(batch[scenario], buildLongHorizonForecast(data, { ...options, scenario }));
});

test('subset and reversed requests preserve scenario identity and values', () => {
  const selected = ['stress', 'late', 'base'];
  const results = buildLongHorizonForecasts(data, { ...options, scenarios: selected });
  assert.deepEqual(Object.keys(results), selected);
  for (const id of selected) assert.deepEqual(results[id], batch[id]);
});

test('batch rejects empty, duplicated, unknown and ambiguous scenario requests', () => {
  for (const invalid of [[], ['base', 'base'], 'base', null]) {
    assert.throws(() => buildLongHorizonForecasts(data, { ...options, scenarios: invalid }), /nonempty array of unique/);
  }
  assert.throws(() => buildLongHorizonForecasts(data, { ...options, scenarios: ['missing'] }), /scenario must be/);
  assert.throws(() => buildLongHorizonForecasts(data, { ...options, scenario: 'stress' }), /Use scenarios/);
  assert.throws(() => buildLongHorizonForecasts(data, { ...options, sampleCount: 0 }), /sampleCount/);
  assert.throws(() => buildLongHorizonForecasts(data, { ...options, researchAsOf: '2024-01-01' }), /No verified/);
});

test('a revised input with the same identity and cutoff is recomputed, not served from an old cache', () => {
  const revised = structuredClone(data);
  const first = buildLongHorizonForecasts(revised, { ...options, scenarios: ['base'] });
  revised.prices.at(-1)[1] *= 1.01;
  const second = buildLongHorizonForecasts(revised, { ...options, scenarios: ['base'] });
  assert.equal(second.base.path[0].price, revised.prices.at(-1)[1]);
  assert.notEqual(first.base.path[0].price, second.base.path[0].price);
  assert.deepEqual(second.base, buildLongHorizonForecast(revised, options));
});

test('mutating one returned forecast cannot corrupt another condition or the next batch', () => {
  const results = buildLongHorizonForecasts(data, { ...options, scenarios: ['base', 'stress'] });
  results.base.nearPhase.path[1].price = -1;
  results.base.nearPhase.training.sourceEras[0].dailyLogMean = -999;
  results.base.cycleCalibration.current.appliedShiftDays = -999;
  results.base.events[0].sourcePrices.base = -1;
  assert.deepEqual(results.stress, batch.stress);
  assert.deepEqual(buildLongHorizonForecasts(data, { ...options, scenarios: ['base'] }).base, batch.base);
});
