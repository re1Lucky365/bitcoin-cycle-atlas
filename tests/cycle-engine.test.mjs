import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Import this dependency-free browser ESM without requiring package.json changes.
const source = await readFile(new URL('../dist/cycle-engine.js', import.meta.url), 'utf8');
const engine = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const {
  utcDay, dateFromDay, validateDataset, buildComparison,
  getAnchors, getPointAtDay, getSeriesStats, comparisonToCsv,
} = engine;
let checks = 0;
function check(name, fn) { fn(); checks++; console.log(`PASS ${name}`); }
function near(actual, expected, tolerance = 1e-9) { assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`); }

check('UTC dates survive leap day and daylight-saving boundaries', () => {
  assert.equal(utcDay('2024-03-11') - utcDay('2024-03-10'), 1);
  assert.equal(utcDay('2024-03-01') - utcDay('2024-02-28'), 2);
  assert.equal(dateFromDay(utcDay('2024-02-29')), '2024-02-29');
  assert.throws(() => utcDay('2023-02-29'));
  assert.throws(() => utcDay('2024-02-30'));
  assert.throws(() => utcDay('2024-04-20T00:00:00Z'));
});

check('Invalid prices, duplicate dates, and reversed dates are rejected', () => {
  for (const value of [0, -1, Infinity, -Infinity, NaN, '12']) {
    assert.throws(() => validateDataset([['2012-11-28', value]]));
  }
  assert.throws(() => validateDataset([['2012-11-28', 12], ['2012-11-28', 13]]));
  assert.throws(() => validateDataset([['2012-11-29', 12], ['2012-11-28', 13]]));
  assert.throws(() => validateDataset(new Array(2)));
  assert.throws(() => validateDataset([['2012-11-28', 12, 'unexpected']]));
  assert.throws(() => dateFromDay(Number.MAX_SAFE_INTEGER));
  assert.throws(() => dateFromDay(1.5));
});

check('Extreme but individually finite input prices cannot silently overflow the chart', () => {
  assert.throws(() => buildComparison({ prices: [['2012-11-28', Number.MIN_VALUE], ['2012-11-29', Number.MAX_VALUE]] }), /overflow/);
  assert.throws(() => buildComparison({ prices: [['2012-11-28', 1], ['2012-11-29', Number.MAX_VALUE]] }), /overflow/);
  assert.throws(() => buildComparison({ prices: [['2012-11-28', Number.MAX_VALUE], ['2012-11-29', Number.MIN_VALUE]] }), /underflow/);
});

check('Missing days stay missing and do not masquerade as a one-day change', () => {
  const comparison = buildComparison({ prices: [['2012-11-28', 10], ['2012-11-30', 20]] });
  const series = comparison.series[0];
  assert.deepEqual(series.points.map((point) => point.day), [0, 2]);
  assert.equal(getPointAtDay(series, 1), null);
  assert.equal(getPointAtDay(series, 2).price, 20);
  assert.equal(getPointAtDay(series, 3), null);
  assert.equal(comparison.stats.dailyChangePct, null);
  assert.equal(comparison.metadata.missingDayCount, 1);
});

check('Observed windows are never extrapolated and exact anchors are required', () => {
  const comparison = buildComparison({ prices: [['2012-11-28', 10], ['2012-11-29', 15]] }, { horizon: 1461 });
  assert.equal(comparison.series[0].points.at(-1).day, 1);
  assert.equal(comparison.series[0].points.length, 2);
  assert.throws(() => buildComparison({ prices: [['2012-11-27', 10], ['2012-11-29', 15]] }));
  assert.throws(() => buildComparison({ prices: [['2012-11-28', 10]] }, { horizon: -1 }));
});

check('Drawdown measures the loss from an earlier observed peak', () => {
  const points = [100, 200, 50, 150].map((price, day) => ({ price, day, date: dateFromDay(utcDay('2020-01-01') + day) }));
  const stats = getSeriesStats(points);
  assert.equal(stats.maxDrawdownPct, -75);
  assert.equal(stats.returnPct, 50);
  assert.equal(stats.peakPrice, 200);
  assert.equal(stats.minimumPrice, 50);
  assert.equal(stats.drawdownPeakDate, '2020-01-02');
  assert.equal(stats.drawdownTroughDate, '2020-01-03');
});

const data = JSON.parse(await readFile(new URL('./fixtures/btc-daily-2026-10-20.json', import.meta.url), 'utf8'));
check('Every real-data mode rebases all starting points to a common value', () => {
  for (const mode of ['halving', 'bottom', 'top', 'breakout']) {
    const result = buildComparison(data, { mode });
    for (const series of result.series) {
      const first = series.points[0];
      assert.equal(first.day, 0);
      assert.equal(first.ratio, 1);
      assert.equal(first.indexed, 100);
      assert.equal(first.returnPct, 0);
      assert.equal(first.rebased, result.referencePrice);
      assert.ok(series.points.at(-1).date <= result.latest.date);
      if (!series.current) assert.ok(series.points.at(-1).day <= 1461);
    }
  }
});

check('Historical anchors follow the declared annual-high and bounded-low rules', () => {
  const top = getAnchors(data, 'top');
  assert.deepEqual(top.slice(0, 4).map((anchor) => anchor.year), [2011, 2013, 2017, 2021]);
  assert.equal(top.at(-1).year, 2025);
  assert.equal(top.at(-1).provisional, true);
  const bottom = getAnchors(data, 'bottom');
  assert.equal(bottom.length, 4);
  assert.equal(bottom.at(-1).date.slice(0, 4), '2022');
  for (const anchor of bottom) assert.ok(anchor.date < anchor.boundHalvingDate);
  const breakout = getAnchors(data, 'breakout');
  for (const anchor of breakout) {
    assert.ok(anchor.price > anchor.previousPeakPrice);
    const preceding = data.prices.find(([date]) => date === dateFromDay(utcDay(anchor.date) - 1));
    assert.ok(preceding[1] <= anchor.previousPeakPrice);
  }
});

check('Same-day comparison and actual source returns agree independently of zoom', () => {
  const all = buildComparison(data, { mode: 'halving', horizon: 'all' });
  const year = buildComparison(data, { mode: 'halving', horizon: 365 });
  assert.deepEqual(all.comparisonAtCurrentDay, year.comparisonAtCurrentDay);
  assert.equal(year.stats.currentInView, false);
  const latestPrice = data.prices.at(-1)[1];
  const anchorPrice = data.prices.find(([date]) => date === '2024-04-20')[1];
  near(all.stats.currentReturnPct, (latestPrice / anchorPrice - 1) * 100);
  const current = all.comparisonAtCurrentDay.find((series) => series.current);
  near(current.price, latestPrice);
  near(current.returnPct, all.stats.currentReturnPct);
});

check('CSV contains exactly the observed plotted values and no synthetic rows', () => {
  const comparison = buildComparison(data, { horizon: 365 });
  const csv = comparisonToCsv(comparison);
  assert.equal(csv.trim().split('\r\n').length, 1 + comparison.series.reduce((sum, series) => sum + series.points.length, 0));
  assert.ok(csv.startsWith('cycle_id,cycle_label,anchor_date,observation_date_utc'));
});

console.log(`${checks} meaningful engine checks passed`);
