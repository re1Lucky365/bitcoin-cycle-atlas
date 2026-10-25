import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.env.SYSTEM_NUMERICAL_ROOT;
const moduleAt = name => root ? pathToFileURL(resolve(root, `dist/${name}.js`)).href : new URL(`../dist/${name}.js`, import.meta.url).href;
const { analyzeDailySeries } = await import(moduleAt('daily-analytics'));
const { shiftCalendarMonths } = await import(moduleAt('cycle-timing'));
const { utcDay, dateFromDay } = await import(moduleAt('cycle-engine'));
const { aggregateCloseBars, computeRollingStates, median, theilSenTrend, fibonacciLevels, confirmedSwingRetracement } = await import(moduleAt('market-structure'));

test('implicit daily gaps crossing a year end have the same coverage as explicit missing dates', () => {
  const prices = [['2024-12-30', 100], ['2025-01-02', 80]];
  const inferred = analyzeDailySeries(prices);
  const declared = analyzeDailySeries(prices, { missingDates: ['2024-12-31', '2025-01-01'] });
  assert.deepEqual(inferred, declared);
  assert.equal(inferred.summary.missingDayCount, 2);
  for (const period of [inferred.annual[0], inferred.monthly[0]]) {
    assert.equal(period.coverageComplete, false);
    assert.equal(period.missingDayCount, 1);
    assert.equal(period.partial, true);
  }
  // January's return is measured from the observed December 30 baseline;
  // both unobserved dates in that return interval still matter to its MDD.
  assert.equal(inferred.annual[1].missingDayCount, 2);
});

test('a gap crossing skipped months marks the previous month without inventing missing periods', () => {
  const prices = [['2024-01-30', 100], ['2024-04-02', 90]];
  const report = analyzeDailySeries(prices);
  assert.deepEqual(report.monthly.map(period => period.month), [1, 4]);
  assert.equal(report.monthly[0].missingDayCount, 1);
  assert.equal(report.monthly[0].coverageComplete, false);
  assert.equal(report.monthly[1].baselineDate, '2024-04-02');
  assert.equal(report.monthly[1].partial, true);
});

test('exchange weekends remain valid while a declared missing session crosses the year boundary', () => {
  const prices = [['2023-12-29', 100], ['2024-01-02', 110]];
  const sessions = analyzeDailySeries(prices, { calendar: 'sessions' });
  assert.equal(sessions.summary.missingDayCount, 0);
  assert.ok(sessions.annual.every(period => period.coverageComplete));
  const missing = analyzeDailySeries([['2024-12-30', 100], ['2025-01-02', 110]], { calendar: 'sessions', missingDates: ['2024-12-31'] });
  assert.equal(missing.summary.missingDayCount, 1);
  assert.equal(missing.annual[0].missingDayCount, 1);
  assert.equal(missing.annual[1].missingDayCount, 1);
});

test('calendar-month arithmetic preserves the full accepted four-digit Gregorian year domain', () => {
  for (const [date, months, expected] of [
    ['0099-12-31', 1, '0100-01-31'],
    ['0100-01-31', -1, '0099-12-31'],
    ['0000-01-31', 1, '0000-02-29'],
    ['0001-01-31', 1, '0001-02-28'],
    ['0096-03-31', -1, '0096-02-29'],
    ['2024-03-31', -1, '2024-02-29'],
    ['9999-11-30', 1, '9999-12-30'],
  ]) assert.equal(shiftCalendarMonths(date, months), expected);
});

test('calendar-month shifts beyond the public date domain fail instead of returning a different century or a truncated label', () => {
  for (const [date, months] of [['0000-01-01', -1], ['9999-12-31', 1], ['2024-01-01', Number.MAX_SAFE_INTEGER], ['2024-01-01', -Number.MAX_SAFE_INTEGER]]) {
    assert.throws(() => shiftCalendarMonths(date, months), RangeError);
  }
});

test('finite large medians and Theil–Sen slopes survive intermediate addition and subtraction overflow', () => {
  const max = Number.MAX_VALUE;
  assert.equal(median([max, max]), max);
  assert.equal(median([-max, -max]), -max);
  assert.equal(median([-max, max]), 0);
  assert.equal(theilSenTrend([{ x: 0, value: -max }, { x: 2, value: max }]).slopeDaysPerCycle, max);
  assert.equal(theilSenTrend([{ x: -max, value: 0 }, { x: max, value: max }]).slopeDaysPerCycle, 0.5);
  assert.equal(theilSenTrend([{ x: -max, value: -max }, { x: max, value: max }]).slopeDaysPerCycle, 1);
});

test('Theil–Sen retains a representable slope at the upper finite boundary', () => {
  // Exact binary64 input fractions give a slope just below MAX_VALUE; rounding
  // once gives MAX_VALUE. Separately divided endpoints double-round to Infinity.
  const records = [
    { x: 0, value: -1.771930152577346e308 },
    { x: 1.9560493706715358, value: 1.744446372530627e308 },
  ];
  assert.equal(theilSenTrend(records).slopeDaysPerCycle, Number.MAX_VALUE);
});

test('finite log volatility does not become NaN when the intermediate price ratio underflows', () => {
  const monthly = aggregateCloseBars([['2024-01-31', 1e308], ['2024-02-01', 1e-300], ['2024-02-02', 2e-300]], { frequency: 'monthly' });
  const returns = [Math.log(1e-300) - Math.log(1e308), Math.log(2)];
  const expected = Math.abs(returns[0] - returns[1]) / Math.sqrt(2) * Math.sqrt(365) * 100;
  assert.ok(Number.isFinite(monthly[1].realizedVolPct));
  assert.ok(Math.abs(monthly[1].realizedVolPct / expected - 1) < 1e-12);
});

test('a positive subnormal price ratio retains the logarithm of both original prices', () => {
  const min = Number.MIN_VALUE;
  const monthly = aggregateCloseBars([['2024-01-31', 1.5], ['2024-02-01', min], ['2024-02-02', 2 * min]], { frequency: 'monthly' });
  const returns = [Math.log(min) - Math.log(1.5), Math.log(2)];
  const expected = Math.abs(returns[0] - returns[1]) / Math.sqrt(2) * Math.sqrt(365) * 100;
  assert.ok(Math.abs(monthly[1].realizedVolPct / expected - 1) < 1e-12,
    'taking log of an already-rounded subnormal quotient loses the original price ratio');
});

test('log retracement preserves extreme midpoint symmetry and normalized distance', () => {
  const min = Number.MIN_VALUE, high = 1.5;
  const midpoint = Math.exp((Math.log(min) + Math.log(high)) / 2);
  for (const [start, end] of [[min, high], [high, min]]) {
    const actual = fibonacciLevels(start, end, { ratios: [0.5], scale: 'log' })[0].price;
    assert.ok(Math.abs(actual / midpoint - 1) < 1e-12,
      'a positive subnormal quotient must not break geometric midpoint symmetry');
  }
  const pivots = [
    { type: 'high', eventDate: '2024-01-01', eventPrice: high, confirmationDate: '2024-01-02' },
    { type: 'low', eventDate: '2024-01-03', eventPrice: min, confirmationDate: '2024-01-04' },
  ];
  const actual = confirmedSwingRetracement(pivots, '2024-01-05', 1).currentRetracementLog;
  const expected = (Math.log(min) - Math.log(1)) / (Math.log(min) - Math.log(high));
  assert.ok(Math.abs(actual - expected) < 1e-12);
});

test('geometric moving averages remain within the observed window even at finite numeric limits', () => {
  for (const price of [Number.MAX_VALUE, Number.MIN_VALUE]) {
    const prices = Array.from({ length: 92 }, (_, index) => [dateFromDay(utcDay('2024-01-01') + index), price]);
    const state = computeRollingStates(prices).current;
    assert.equal(state.shortMA, price);
    assert.equal(state.longMA, price);
    assert.equal(state.realizedVolPct, 0);
  }
});

test('unrepresentable percentage ranges fail explicitly rather than returning successful Infinity or NaN metrics', () => {
  for (const prices of [[1e-300, 1e300], [1, 1e307]]) {
    assert.throws(() => aggregateCloseBars(prices.map((price, index) => [dateFromDay(utcDay('2024-01-01') + index), price])), /finite numeric range/);
    assert.throws(() => computeRollingStates(Array.from({ length: 92 }, (_, index) => [dateFromDay(utcDay('2024-01-01') + index), prices[index % 2]])), /finite numeric range/);
  }
});

test('a genuinely unrepresentable Theil–Sen slope fails without suppressing valid large slopes', () => {
  assert.throws(() => theilSenTrend([{ x: 0, value: -Number.MAX_VALUE }, { x: 1, value: Number.MAX_VALUE }]), /finite numeric range/);
});
