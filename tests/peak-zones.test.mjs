import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { analyzePeakZones } from '../dist/peak-zones.js';
import { utcDay } from '../dist/cycle-engine.js';

const bundled = JSON.parse(await readFile(new URL('../dist/data/btc-daily.json', import.meta.url), 'utf8'));
const data = { ...bundled, prices: bundled.prices.filter(([date]) => date <= '2026-10-20') };
const analysis = analyzePeakZones(data);
const approx = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
let checks = 0;
const check = (name, fn) => { fn(); checks++; console.log(`PASS ${name}`); };

check('Near-peak first crossings reproduce the independently calculated daily evidence', () => {
  const expected = {
    .90: ['2013-11-29', '2017-12-15', '2021-03-13', '2025-07-10'],
    .95: ['2013-11-29', '2017-12-16', '2021-10-19', '2025-07-13'],
    .98: ['2013-11-29', '2017-12-16', '2021-11-08', '2025-08-13'],
  };
  for (const [q, dates] of Object.entries(expected)) {
    const result = analyzePeakZones(data, { threshold: Number(q) });
    assert.deepEqual(result.cycles.map((cycle) => cycle.firstEntry.date), dates);
    for (const cycle of result.cycles) {
      assert.ok(cycle.firstEntry.date <= cycle.peak.date);
      assert.ok(cycle.firstEntry.price >= Number(q) * cycle.peak.price);
      assert.equal(cycle.firstEntry.dayAfterHalving, utcDay(cycle.firstEntry.date) - utcDay(cycle.halvingDate));
      assert.equal(cycle.firstEntry.daysBeforePeak + cycle.firstEntry.dayAfterHalving, cycle.peak.dayAfterHalving);
      const earlier = data.prices.filter(([date]) => date >= cycle.halvingDate && date < cycle.firstEntry.date);
      assert.ok(earlier.every(([, price]) => price < Number(q) * cycle.peak.price));
    }
  }
});

check('A 100% zone selects the actual observed maximum with consistent price and date', () => {
  const result = analyzePeakZones(data, { threshold: 1 });
  for (const cycle of result.cycles) {
    assert.equal(cycle.firstEntry.date, cycle.peak.date);
    assert.equal(cycle.firstEntry.price, cycle.peak.price);
    assert.equal(cycle.firstEntry.daysBeforePeak, 0);
    assert.equal(cycle.zoneStats.occupancyPct, 100);
    const eligible = data.prices.filter(([date]) => cycle.current
      ? date >= cycle.halvingDate && date <= result.asOf
      : date.startsWith(`${cycle.peakYear}-`));
    assert.equal(Math.max(...eligible.map(([, price]) => price)), cycle.peak.price);
  }
});

check('The 2021 double top causes a disclosed 93-to-94 percent discontinuity', () => {
  const entries = Object.fromEntries(analysis.sensitivity.map((variant) => [variant.threshold, variant.cycleEntries.find((c) => c.year === 2020)]));
  assert.equal(entries[.93].date, '2021-04-13');
  assert.equal(entries[.94].date, '2021-10-19');
  assert.equal(entries[.95].date, '2021-10-19');
  approx(analysis.spring2021.pctOfPeak, 93.93542977536293);
  assert.ok(utcDay(entries[.94].date) - utcDay(entries[.93].date) > 180);
  assert.equal(analysis.sensitivity.find((v) => v.threshold === .90).leadDays, -31);
  assert.equal(analysis.sensitivity.find((v) => v.threshold === .95).leadDays, 76.5);
});

check('Calendar and halving clocks are independently calculated rather than conflated', () => {
  assert.equal(analysis.current.firstEntry.date, '2025-07-13');
  assert.equal(analysis.calendarFourYear.firstEntryReferenceDate, '2025-10-19');
  assert.equal(analysis.calendarFourYear.firstEntryAdvanceDays, 98);
  assert.equal(analysis.comparison.firstEntry.leadDays, 76.5);
  assert.equal(analysis.comparison.absolutePeak.leadDays, 1.5);
  assert.equal(analysis.calendarFourYear.absolutePeakAdvanceDays, 33);
});

check('A brief crossing is not silently treated as sustained residence', () => {
  assert.equal(analysis.current.firstEntry.date, '2025-07-13');
  assert.equal(analysis.current.sustained5of7.confirmationDate, '2025-10-06');
  assert.equal(analysis.current.sustained5of7.firstQualifyingDate, '2025-10-02');
  assert.equal(analysis.current.sustained5of7.earliestKnowableUtc, '2025-10-07T00:00:00.000Z');
  assert.equal(analysis.current.sustained5of7.causal, false);
  assert.equal(analysis.cycles.find((c) => c.year === 2016).sustained5of7, null);
  assert.equal(analysis.comparison.sustained5of7.n, 0);
  assert.equal(analysis.comparison.sustained5of7.leadDays, null);
  const ninety = analyzePeakZones(data, { threshold: .90 });
  assert.equal(ninety.current.sustained5of7.confirmationDate, '2025-07-14');
  assert.equal(ninety.current.sustained14consecutive.confirmationDate, '2025-07-23');
  const last = ninety.current.terminalEpisodes;
  assert.equal(last.find((e) => e.maxGapDays === 7).startDate, '2025-09-10');
  assert.equal(last.find((e) => e.maxGapDays === 14).startDate, '2025-07-10');
});

check('Plateau statistics agree with independent Python calculations and proper denominators', () => {
  const ninety = analysis.plateau2025.first90ToPeak;
  assert.equal(ninety.observations, 89);
  assert.equal(ninety.aboveThresholdDays, 69);
  approx(ninety.occupancyPct, 69 / 89 * 100);
  approx(ninety.maxDrawdownPct, -12.253649182941317);
  approx(ninety.annualizedVolatilityPct, 28.92025126069173, 1e-8);
  assert.deepEqual(ninety.maxDrawdown, { peakDate: '2025-08-13', troughDate: '2025-08-31' });
  assert.equal(analysis.current.zoneStats.observations, 86);
  assert.equal(analysis.current.zoneStats.aboveThresholdDays, 16);
  approx(analysis.current.zoneStats.occupancyPct, 16 / 86 * 100);
  assert.equal(analysis.july2025.date, '2025-07-22');
  approx(analysis.july2025.pctOfPeak, 96.1894903294868);
  approx(analysis.july2025.remainingUpsidePct, 3.961461545809941);
  assert.equal(analysis.current.prePeak90Days.observations, 91);
  assert.equal(analysis.current.prePeak90Days.dailyReturnObservations, 90);
  approx(analysis.current.prePeak90Days.returnPct, 14.563429243115844);
});

check('Peak-to-low duration is distinguished from underwater time and the rebound', () => {
  assert.equal(analysis.current.peakAgeDays, 379);
  assert.equal(analysis.current.daysPeakToLow, 267);
  assert.equal(analysis.current.daysSinceLow, 112);
  assert.equal(analysis.current.durationIdentity.holds, true);
  approx(analysis.current.maxObservedDrawdownPct, -53.11409452054985);
  approx(analysis.current.currentDrawdownPct, -33.58760425477166);
  approx(analysis.current.recoveryToPeakPct, 50.57429999005103);
  assert.equal(analysis.current.peak.provisional, true);
});

check('As-of analysis excludes later peaks and recomputes the retrospective denominator', () => {
  const date = '2025-07-15';
  const prefix = { ...data, prices: data.prices.filter(([d]) => d <= date) };
  const fromAsOf = analyzePeakZones(data, { asOf: date });
  const fromPrefix = analyzePeakZones(prefix);
  assert.deepEqual(fromAsOf, fromPrefix);
  assert.ok(fromAsOf.current.peak.date <= date);
  assert.ok(fromAsOf.current.firstEntry.date <= date);
  assert.notEqual(fromAsOf.current.peak.price, analysis.current.peak.price);
  const newHigh = analyzePeakZones({ ...data, prices: [...data.prices, ['2026-10-21', 200000]] });
  assert.equal(newHigh.current.peak.date, '2026-10-21');
  assert.equal(newHigh.current.firstEntry.date, '2026-10-21');
  assert.equal(newHigh.current.troughCandidate, null);
  assert.equal(newHigh.current.daysPeakToLow, null);
  assert.equal(newHigh.current.maxObservedDrawdownPct, null);
  assert.equal(newHigh.current.durationIdentity.holds, null);
  assert.equal(newHigh.current.recoveryToPeakPct, 0);
});

check('Missing days interrupt sustained windows and are disclosed in occupancy statistics', () => {
  const withGap = { ...data, prices: data.prices.filter(([date]) => date !== '2025-07-12') };
  const result = analyzePeakZones(withGap, { threshold: .90 });
  assert.ok(result.current.sustained5of7.confirmationDate >= '2025-07-19');
  assert.equal(result.current.zoneStats.completeDailyWindow, false);
  assert.equal(result.current.zoneStats.observations, 88);
  assert.equal(result.current.zoneStats.dailyReturnObservations, 86);
});

check('Invalid thresholds and baselines fail explicitly rather than changing the calculation', () => {
  for (const threshold of [0, -.1, 1.01, NaN, Infinity]) assert.throws(() => analyzePeakZones(data, { threshold }), /threshold/);
  assert.throws(() => analyzePeakZones(data, { baseline: 'selected-after-result' }), /baseline/);
  assert.equal(analyzePeakZones(data, { baseline: 'previous' }).comparison.firstEntry.n, 1);
  assert.equal(analyzePeakZones(data, { baseline: 'all3' }).comparison.firstEntry.n, 3);
});

console.log(`${checks} peak-zone checks passed`);
