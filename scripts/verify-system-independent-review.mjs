import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseline = process.env.SYSTEM_REVIEW_BASELINE;
const load = (name, directory = root) => import(pathToFileURL(path.join(directory, `dist/${name}.js`)));
const { analyzeDailySeries } = await load('daily-analytics');
const { shiftCalendarMonths } = await load('cycle-timing');
const market = await load('market-structure');
const epoch = date => Date.parse(`${date}T00:00:00.000Z`) / 86400000;
const dateAt = day => new Date(day * 86400000).toISOString().slice(0, 10);
const close = (actual, expected, tolerance = 2e-12) => assert.ok(Number.isFinite(actual)
  && Math.abs(actual / expected - 1) <= tolerance, `${actual} != ${expected}`);
const sourceFiles = ['dist/daily-analytics.js', 'dist/cycle-timing.js', 'dist/market-structure.js', 'dist/daily-data-view.js', 'dist/lab-view.js'];
const hashes = Object.fromEntries(await Promise.all(sourceFiles.map(async file => [file,
  createHash('sha256').update(await readFile(path.join(root, file))).digest('hex')])));

function nativeMonthShift(date, months) {
  const input = new Date(`${date}T00:00:00Z`), shifted = new Date(input);
  shifted.setUTCDate(1);
  shifted.setUTCMonth(input.getUTCMonth() + months);
  const finalDay = new Date(shifted);
  finalDay.setUTCMonth(shifted.getUTCMonth() + 1, 0);
  shifted.setUTCDate(Math.min(input.getUTCDate(), finalDay.getUTCDate()));
  if (shifted.getUTCFullYear() < 0 || shifted.getUTCFullYear() > 9999) return null;
  return shifted.toISOString().slice(0, 10);
}

let calendarCases = 0;
for (const year of [...Array(401).keys(), 1899, 1900, 1999, 2000, 2099, 2100, 9998, 9999]) {
  for (let month = 1; month <= 12; month++) {
    const first = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01`;
    const end = new Date(`${first}T00:00:00Z`);
    end.setUTCMonth(end.getUTCMonth() + 1, 0);
    const date = end.toISOString().slice(0, 10);
    for (const shift of [-25, -13, -1, 0, 1, 13, 25]) {
      const expected = nativeMonthShift(date, shift);
      if (expected === null) assert.throws(() => shiftCalendarMonths(date, shift), RangeError);
      else assert.equal(shiftCalendarMonths(date, shift), expected);
      calendarCases++;
    }
  }
}

let rng = 0x6c917a3d;
function random() { rng = Math.imul(rng, 1664525) + 1013904223 >>> 0; return rng / 2 ** 32; }
let periodComparisons = 0, missingDateInvariantCases = 0, prefixComparisons = 0;
for (let trial = 0; trial < 80; trial++) {
  const start = epoch('2023-12-01') + trial;
  const prices = Array.from({ length: 450 }, (_, i) => [dateAt(start + i), 50 + random() * 100]);
  const observed = prices.filter((_, i) => i === 0 || i === prices.length - 1 || random() > .35);
  const observedDays = new Set(observed.map(row => epoch(row[0])));
  const missingDates = prices.filter(row => !observedDays.has(epoch(row[0]))).map(row => row[0]);
  const report = analyzeDailySeries(observed);
  assert.deepEqual(report, analyzeDailySeries(observed, { missingDates }));
  assert.equal(report.summary.missingDayCount, missingDates.length);
  missingDateInvariantCases++;
  for (const periods of [report.annual, report.monthly]) {
    for (let i = 0; i < periods.length; i++) {
      const period = periods[i];
      let end = epoch(period.endDate);
      if (i < periods.length - 1) {
        const limit = new Date(`${period.endDate}T00:00:00Z`);
        if (period.month) limit.setUTCMonth(limit.getUTCMonth() + 1, 0);
        else limit.setUTCFullYear(limit.getUTCFullYear() + 1, 0, 0);
        end = limit.getTime() / 86400000;
      }
      let expected = 0;
      for (let day = epoch(period.baselineDate) + 1; day <= end; day++) if (!observedDays.has(day)) expected++;
      assert.equal(period.missingDayCount, expected);
      assert.equal(period.coverageComplete, expected === 0);
      periodComparisons++;
    }
  }
  for (const length of [1, 13, 67, observed.length - 1]) {
    assert.deepEqual(analyzeDailySeries(observed.slice(0, length)).rows, report.rows.slice(0, length));
    prefixComparisons++;
  }
}

const causalPrices = Array.from({ length: 500 }, (_, i) => [dateAt(epoch('2024-01-01') + i), 200 + i / 10 + 70 * Math.sin(i / 25)]).filter((_, i) => i !== 230);
const causalDaily = analyzeDailySeries(causalPrices);
assert.ok(causalDaily.rows.some(row => row.sma200 !== null && row.signal.key !== 'unavailable'));
for (const length of [199, 200, 229, 250, 480]) {
  assert.deepEqual(analyzeDailySeries(causalPrices.slice(0, length)).rows, causalDaily.rows.slice(0, length));
  prefixComparisons++;
}
let rollingPrefixComparisons = 0;
for (const frequency of ['daily', 'weekly']) {
  const all = market.computeRollingStates(causalPrices, { frequency });
  assert.ok(all.points.some(point => point.state !== 'warmup' && point.longMA !== null));
  for (const dayOffset of [30, 80, 170, 300, 420]) {
    const asOf = dateAt(epoch(causalPrices[0][0]) + dayOffset);
    const truncated = market.computeRollingStates(causalPrices, { frequency, asOf });
    assert.deepEqual(truncated.points, all.points.filter(point => point.date <= asOf));
    rollingPrefixComparisons++;
  }
}

const min = Number.MIN_VALUE;
const volatility = market.aggregateCloseBars([['2024-01-31', 1.5], ['2024-02-01', min], ['2024-02-02', 2 * min]], { frequency: 'monthly' })[1].realizedVolPct;
const expectedVolatility = Math.abs(Math.log(min) - Math.log(1.5) - Math.log(2)) / Math.sqrt(2) * Math.sqrt(365) * 100;
close(volatility, expectedVolatility);
const midpoint = market.fibonacciLevels(min, 1.5, { ratios: [.5], scale: 'log' })[0].price;
const expectedMidpoint = Math.exp((Math.log(min) + Math.log(1.5)) / 2);
close(midpoint, expectedMidpoint);
const pivots = [{ type: 'high', eventPrice: 1.5, eventDate: '2024-01-01', confirmationDate: '2024-01-02' },
  { type: 'low', eventPrice: min, eventDate: '2024-01-03', confirmationDate: '2024-01-04' }];
const retracement = market.confirmedSwingRetracement(pivots, '2024-01-04', 1).currentRetracementLog;
const expectedRetracement = Math.log(min) / (Math.log(min) - Math.log(1.5));
close(retracement, expectedRetracement);

const finiteBoundaryCases = [
  [-1.771930152577346e308, 1.744446372530627e308, 1.9560493706715358],
  [-1.257633137051149e308, 1.7567346219575627e308, 1.6767977251243051],
  [-1.7269369229518715e308, 1.5697870851178163e308, 1.8338636022672368],
];
function exactBinary64(value) {
  const bytes = new DataView(new ArrayBuffer(8));
  bytes.setFloat64(0, value);
  const bits = bytes.getBigUint64(0), exponent = Number(bits >> 52n & 2047n);
  const mantissa = (bits & ((1n << 52n) - 1n)) + (exponent ? 1n << 52n : 0n);
  const power = exponent ? exponent - 1075 : -1074;
  return { numerator: (bits >> 63n ? -mantissa : mantissa) << BigInt(Math.max(0, power)), denominator: 1n << BigInt(Math.max(0, -power)) };
}
const maxExact = exactBinary64(Number.MAX_VALUE), precedingExact = exactBinary64(Number.MAX_VALUE - 2 ** 971);
const slopes = finiteBoundaryCases.map(([left, right, distance]) => {
  const a = exactBinary64(left), b = exactBinary64(right), d = exactBinary64(distance);
  const numerator = (b.numerator * a.denominator - a.numerator * b.denominator) * d.denominator;
  const denominator = b.denominator * a.denominator * d.numerator;
  assert.ok(numerator * maxExact.denominator <= maxExact.numerator * denominator, 'exact slope lies within the finite range');
  assert.ok(2n * numerator * maxExact.denominator * precedingExact.denominator
    > (maxExact.numerator * precedingExact.denominator + precedingExact.numerator * maxExact.denominator) * denominator,
  'round-to-nearest maps the exact slope to MAX rather than its predecessor');
  const slope = market.theilSenTrend([{ x: 0, value: left }, { x: distance, value: right }]).slopeDaysPerCycle;
  assert.equal(slope, Number.MAX_VALUE);
  return { left, right, distance, slope };
});
assert.throws(() => market.theilSenTrend([{ x: 0, value: -Number.MAX_VALUE }, { x: 1, value: Number.MAX_VALUE }]), RangeError);

const normalDifferentials = [];
if (baseline) {
  const oldMarket = await load('market-structure', baseline), oldDaily = await load('daily-analytics', baseline);
  for (let trial = 0; trial < 12; trial++) {
    const prices = Array.from({ length: 180 }, (_, i) => [dateAt(epoch('2024-01-01') + i), 200 + 150 * Math.sin(i / (trial + 3)) + random()]);
    assert.deepEqual(analyzeDailySeries(prices), oldDaily.analyzeDailySeries(prices));
    for (const frequency of ['daily', 'weekly']) assert.deepEqual(market.computeRollingStates(prices, { frequency }), oldMarket.computeRollingStates(prices, { frequency }));
    for (const frequency of ['weekly', 'monthly', 'quarterly', 'four-year']) assert.deepEqual(market.aggregateCloseBars(prices, { frequency }), oldMarket.aggregateCloseBars(prices, { frequency }));
    normalDifferentials.push({ trial, observations: prices.length, completeOutputsEqual: true });
  }
}

console.log(JSON.stringify({ status: 'PASS', baselineCommit: '64c8207cb044d8990289c5a7d39972e21b74c240',
  executedAt: new Date().toISOString(), node: process.version, sourceHashes: hashes,
  calendarCases, missingDateInvariantCases, periodComparisons, prefixComparisons, rollingPrefixComparisons,
  subnormalBoundaries: { volatility, expectedVolatility, midpoint, expectedMidpoint, retracement, expectedRetracement },
  finiteBoundaryOracle: 'Exact binary64 rational arithmetic with BigInt. Each slope is <= MAX and strictly above the midpoint between MAX and its predecessor.',
  finiteBoundaryCases: slopes, genuinelyUnrepresentableSlopeRejected: true, normalDifferentials,
  scope: 'Public module calls, explicit missing-date enumeration, native calendar oracle, prefix invariance, exact-binary-rational boundary fixtures, baseline normal-output comparison. No browser or benchmark measurement.' }, null, 2));
