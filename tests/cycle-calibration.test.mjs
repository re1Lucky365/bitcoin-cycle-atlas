import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { calibrateCycleTiming, cycleCalibrationSnapshot, evaluateCycleCalibration, CYCLE_CALIBRATION_DEFAULTS } from '../dist/cycle-calibration.js';
import { buildLongHorizonForecast } from '../dist/long-horizon-forecast.js';
import { buildDetailedForecast } from '../dist/detailed-forecast.js';
import { utcDay, dateFromDay } from '../dist/cycle-engine.js';

const data = JSON.parse(await readFile(new URL('./fixtures/btc-daily-2026-10-20.json', import.meta.url), 'utf8'));
const full = calibrateCycleTiming(data);

test('daily ribbon is prefix-causal across confirmations and newly observed halving boundaries', () => {
  for (const asOf of ['2018-06-30', '2020-05-10', '2020-05-11', '2024-04-19', '2024-04-20', '2026-09-01', '2026-09-02']) {
    const prefix = calibrateCycleTiming(data, { asOf });
    assert.deepEqual(prefix.series, full.series.filter(row => row.date <= asOf));
    assert.ok(prefix.closedReferences.every(reference => reference.knownAt <= asOf));
    const altered = { prices: data.prices.map(([date, price]) => [date, date <= asOf ? price : NaN]) };
    assert.deepEqual(calibrateCycleTiming(altered, { asOf }), prefix);
  }
  const before = calibrateCycleTiming(data, { asOf: '2026-09-01' });
  const confirmed = calibrateCycleTiming(data, { asOf: '2026-09-02' });
  assert.equal(before.current.troughConfirmedAt, null);
  assert.equal(before.current.bearComponentDays, 0);
  assert.equal(confirmed.current.troughConfirmedAt, '2026-09-02');
  assert.ok(confirmed.current.bearComponentDays < 0);
});

test('an unconfirmed pre-halving high cannot replace the earlier deep-drawdown reference', () => {
  const reference = full.closedReferences.find(row => row.year === 2020);
  assert.equal(reference.peak.date, '2021-11-08');
  assert.equal(reference.trough.date, '2022-11-09');
  assert.equal(reference.knownAt, '2024-04-20');
  assert.ok(data.prices.find(([date]) => date === '2024-03-13')[1] > reference.peak.price);
  assert.equal(calibrateCycleTiming(data, { asOf: '2024-04-19' }).closedReferences.length, 2);
});

test('small-sample shrinkage, calendar-day units and color meanings remain explicit', () => {
  assert.equal(full.current.referenceCount, 3);
  assert.equal(full.current.peakWeight, 0.5);
  assert.equal(full.current.bearWeight, 0.5);
  assert.equal(full.current.medianBearDays, 366);
  assert.equal(full.current.observedBearDays, 267);
  assert.equal(full.current.rawShiftDays, -66);
  assert.equal(full.current.appliedShiftDays, -52);
  assert.equal(full.current.state, 'shortened');
  assert.equal(full.current.color, '#df7c83');
  assert.equal(full.current.expectedNextPeakDate, '2029-08-15');
  assert.equal(full.current.cycleLengthDays, 1409);
  assert.equal(full.current.sensitivity.probability, null);
  assert.equal(full.method.calibrated, false);
  assert.equal(full.method.historicalForecastAccuracyClaim, false);
  assert.equal(full.method.colorsAreTradingSignals, false);
  assert.ok(full.series.some(row => row.state === 'aligned' && row.color === '#65c3a5'));
});

test('fixed-origin daily adjustments are bounded and later lower lows invalidate only current candidates', () => {
  for (let index = 1; index < full.series.length; index++) {
    const previous = full.series[index - 1], current = full.series[index];
    if (previous.state !== 'insufficient' && current.state !== 'insufficient') {
      assert.ok(Math.abs(current.shiftDays - previous.shiftDays) <= CYCLE_CALIBRATION_DEFAULTS.maxDailyShiftDays + 1e-10);
    }
    assert.ok(Math.abs(current.shiftDays) <= CYCLE_CALIBRATION_DEFAULTS.maxAbsoluteShiftDays);
  }
  const revised = calibrateCycleTiming({ prices: [...data.prices, ['2026-10-21', 50000]] });
  assert.deepEqual(revised.series.slice(0, -1), full.series);
  assert.equal(revised.current.candidateTroughDate, '2026-10-21');
  assert.equal(revised.current.troughConfirmedAt, null);
  assert.equal(revised.current.bearComponentDays, 0);
  assert.ok(Math.abs(revised.current.shiftDays - full.current.shiftDays) <= 2);
});

test('longer synthetic bear duration produces blue without inventing an observed future ribbon', () => {
  const peakDate = '2025-10-06', peakPrice = data.prices.find(([date]) => date === peakDate)[1];
  const prices = data.prices.filter(([date]) => date <= peakDate).map(row => [...row]);
  for (let offset = 1; offset <= 700; offset++) {
    const price = offset <= 500 ? peakPrice * (1 - 0.6 * offset / 500) : peakPrice * 0.6;
    prices.push([dateFromDay(utcDay(peakDate) + offset), price]);
  }
  const result = calibrateCycleTiming({ prices });
  assert.equal(result.current.observedBearDays, 500);
  assert.ok(result.current.appliedShiftDays > 21);
  assert.equal(result.current.state, 'lengthened');
  assert.equal(result.current.color, '#74a7ee');
  assert.equal(result.series.at(-1).date, prices.at(-1)[0]);
  assert.ok(result.series.every(row => row.causal && row.date <= result.asOf));
});

test('missing observations and insufficient reference history do not fabricate confirmation or certainty', () => {
  const missing = { prices: data.prices.filter(([date]) => date !== '2026-08-28') };
  const result = calibrateCycleTiming(missing);
  assert.equal(result.available, false);
  assert.equal(result.current.appliedShiftDays, 0);
  assert.equal(result.current.state, 'insufficient');
  assert.equal(result.current.unavailableReason, 'incomplete-current-era');
  assert.ok(!result.series.some(row => row.date === '2026-08-28'));
  const short = calibrateCycleTiming(data.prices.slice(-400));
  assert.equal(short.available, false);
  assert.equal(short.current.appliedShiftDays, 0);
  assert.equal(short.closedReferences.length, 0);
});

test('same data yields identical snapshots and changed quote units do not change the clock', () => {
  const before = JSON.stringify(data), snapshot = cycleCalibrationSnapshot(data);
  assert.deepEqual(cycleCalibrationSnapshot(data), snapshot);
  assert.equal(snapshot.observationCount, data.prices.length);
  assert.equal('series' in snapshot, false);
  const scaled = calibrateCycleTiming({ prices: data.prices.map(([date, price]) => [date, price * 10]) });
  assert.deepEqual(scaled.series, full.series);
  assert.equal(JSON.stringify(data), before);
});

test('timing correction moves future phases while published valuation endpoints stay unchanged', () => {
  const adjusted = buildLongHorizonForecast(data, { sampleCount: 16 });
  const prior = buildLongHorizonForecast(data, { sampleCount: 16, applyCycleCalibration: false });
  assert.equal(adjusted.cycleCalibration.forecastApplication.appliedShiftDays, -52);
  assert.equal(adjusted.cycleCalibration.forecastApplication.applied, true);
  assert.equal(prior.cycleCalibration.forecastApplication.applied, false);
  assert.equal(utcDay(adjusted.nominalClock.effectivePeakDate) - utcDay(prior.nominalClock.effectivePeakDate), -52);
  assert.equal(utcDay(adjusted.nominalClock.zoneEntryDate) - utcDay(prior.nominalClock.zoneEntryDate), -52);
  assert.equal(utcDay(adjusted.nominalClock.effectiveTroughDate) - utcDay(prior.nominalClock.effectiveTroughDate), -52);
  assert.equal(adjusted.nearPhase.assumptions.phasePriorClockOriginDate, adjusted.nominalClock.effectiveTroughDate);
  assert.deepEqual(adjusted.path.map(row => row.baselinePrice), prior.path.map(row => row.baselinePrice));
  assert.deepEqual(adjusted.events.map(row => row.price), prior.events.map(row => row.price));
  assert.notDeepEqual(adjusted.path.map(row => row.price), prior.path.map(row => row.price));
  assert.ok(adjusted.path.slice(1, 700).some((row, index) => row.cycleDisplacement !== prior.path[index + 1].cycleDisplacement));
  assert.equal(adjusted.longHorizon.cycleDecay.appliedTimingShiftDays, -52);
  assert.equal(adjusted.path[0].price, prior.path[0].price);
  assert.equal(adjusted.displayEnd, prior.displayEnd);
});

test('forecast integration rejects stale timing input and explains an incompatible observed reference', () => {
  assert.throws(() => buildDetailedForecast(data, { sampleCount: 16, timingCalibration: { ...full.current, asOf: '2026-10-19' } }), /cutoff/);
  assert.throws(() => buildDetailedForecast(data, { sampleCount: 16, timingCalibration: { ...full.current, appliedShiftDays: Infinity } }), /integer/);
  const different = buildDetailedForecast(data, { sampleCount: 16, referencePeakDate: '2025-05-31', timingCalibration: full.current });
  assert.equal(different.nominalClock.timingAdjustment.applied, false);
  assert.equal(different.nominalClock.timingAdjustment.appliedShiftDays, 0);
  assert.equal(different.nominalClock.timingAdjustment.reason, 'calibration-reference-high-differs');
});

test('rolling-origin audit separates future scoring targets and counts distinct cycles honestly', () => {
  const audit = evaluateCycleCalibration(data);
  assert.equal(audit.originCount, 8);
  assert.equal(audit.independentTargetCount, 1);
  assert.equal(audit.adjustedMaeDays, 21);
  assert.equal(audit.calendarMaeDays, 38);
  assert.equal(audit.sufficientForPredictiveSuperiorityClaim, false);
  assert.equal(audit.settingsSelectedFromAuditScores, false);
  assert.ok(audit.excluded.every(row => row.reason === 'next-era-outcome-not-closed'));
  for (const row of audit.records) {
    assert.ok(row.trainingThrough <= row.origin && row.origin < row.targetDate && row.targetDate < row.targetKnownAt);
    const truncated = data.prices.filter(([date]) => date <= row.origin);
    assert.equal(calibrateCycleTiming(truncated).current.expectedNextPeakDate, row.forecastDate);
  }
});

test('invalid calibration parameters and empty prefixes fail explicitly', () => {
  assert.throws(() => calibrateCycleTiming(data, { confirmationDays: 0 }), /positive integer/);
  assert.throws(() => calibrateCycleTiming(data, { drawdownPct: 100 }), /below 100/);
  assert.throws(() => calibrateCycleTiming(data, { smoothingHalfLifeDays: NaN }), /positive and finite/);
  assert.throws(() => calibrateCycleTiming(data, { maxAbsoluteShiftDays: 20 }), /smaller/);
  assert.throws(() => calibrateCycleTiming(data, { asOf: '2000-01-01' }), /nonempty/);
});
