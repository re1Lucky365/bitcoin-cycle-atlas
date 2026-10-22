import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { utcDay, dateFromDay } from '../dist/cycle-engine.js';
import { shiftCalendarMonths } from '../dist/cycle-timing.js';
import { analyzeThreeYearOutlook, buildOutlookScenario, computeOutlookTiming, reconstructHistoricalOutlook, evaluateThreeYearModel } from '../dist/outlook-engine.js';

const data = JSON.parse(await readFile(new URL('./fixtures/btc-daily-2026-10-20.json', import.meta.url), 'utf8'));
const outlook = analyzeThreeYearOutlook(data);
const byId = Object.fromEntries(outlook.scenarios.map((scenario) => [scenario.id, scenario]));
const close = (a, b, tolerance = 1e-11) => assert.ok(Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(b)), `${a} differs from ${b}`);

test('observed recovery and the nominal calendar remain distinct', () => {
  assert.equal(outlook.asOf, '2026-10-20');
  assert.equal(outlook.referenceDate, '2026-10-21');
  assert.equal(outlook.referenceTimezone, 'Asia/Seoul');
  assert.equal(outlook.displayEnd, shiftCalendarMonths(outlook.referenceDate, 36));
  assert.equal(outlook.observables.peak.date, '2025-10-06');
  assert.equal(outlook.observables.troughCandidate.date, '2026-06-30');
  assert.equal(outlook.observables.observedPeakToLowDays, 267);
  assert.equal(outlook.observables.recoveryDays, 112);
  close(outlook.observables.recoveryPct, 41.64682342401713);
  assert.equal(outlook.nominalClock.nominalTroughDate, '2026-10-06');
  assert.equal(outlook.nominalClock.nominalPeakDate, '2029-10-06');
  assert.equal(outlook.nominalClock.isObservedTurningPoint, false);
  assert.equal(outlook.nominalClock.observedHistoryIsRewritten, false);
  assert.equal(outlook.observables.firstHighZoneEntry.entryDate, '2025-07-13');
  assert.equal(outlook.observables.firstHighZoneEntry.daysBeforePeak, 85);
  assert.equal(outlook.observables.firstHighZoneEntry.observationsAboveThreshold, 16);
  assert.equal(outlook.observables.firstHighZoneEntry.observationsInInterval, 86);
});

test('arrival and formation are separate controls while nominal dates stay fixed', () => {
  assert.equal(byId.base.timing.zoneEntryDate, '2029-07-06');
  assert.equal(byId['early-arrival-6'].timing.zoneEntryDate, '2029-04-06');
  assert.equal(byId['early-arrival-9'].timing.zoneEntryDate, '2029-01-06');
  for (const id of ['base', 'early-arrival-6', 'early-arrival-9']) assert.equal(byId[id].timing.effectivePeakDate, '2029-10-06');
  assert.equal(byId['early-turn'].timing.effectivePeakDate, '2029-06-06');
  assert.equal(byId['early-turn'].timing.nextLowDate, '2030-06-06');
  assert.equal(byId.delayed.timing.effectivePeakDate, '2030-01-06');
  assert.equal(byId.delayed.summary.peakInHorizon, false);
  assert.equal(byId.delayed.events.find((event) => event.id === 'peak').outsideHorizonLabel, '3년 표시 범위 밖');
  assert.ok(outlook.scenarios.every((scenario) => scenario.timing.nominalPeakDate === '2029-10-06'));
});

test('every calendar date has a finite positive path and starts exactly at the observed price', () => {
  const first = utcDay(outlook.asOf), last = utcDay(outlook.displayEnd);
  assert.equal(outlook.horizonDays, 1097); // Includes leap year 2028 and one observed anchor day.
  for (const scenario of outlook.scenarios) {
    assert.equal(scenario.path.length, last - first + 1);
    for (let i = 0; i < scenario.path.length; i++) {
      const point = scenario.path[i];
      assert.equal(point.date, dateFromDay(first + i));
      assert.ok([point.price, point.low, point.high].every((price) => Number.isFinite(price) && price > 0));
      assert.ok(point.low <= point.price + 1e-8 && point.price <= point.high + 1e-8);
      close(point.indexedPrice, 100 * point.price / outlook.observables.current.price);
      assert.equal(point.kind, i ? 'illustrative-conditional-path' : 'observed-anchor');
      assert.equal(point.probability, null);
    }
    const firstPoint = scenario.path[0];
    assert.equal(firstPoint.price, outlook.observables.current.price);
    assert.equal(firstPoint.low, firstPoint.price);
    assert.equal(firstPoint.high, firstPoint.price);
    assert.equal(firstPoint.indexedPrice, 100);
    assert.equal(scenario.path.at(-1).date, '2029-10-21');
    assert.equal(scenario.events.find((event) => event.id === 'horizon-end').turningPointClaim, false);
    for (const event of scenario.events) {
      assert.equal(event.probability, null);
      assert.equal(event.futureObservation, false);
      if (event.inHorizon) close(scenario.path[utcDay(event.date) - first].price, event.price);
    }
  }
});

test('all allowed A/D combinations respect the first daily high-zone entry and assumed peak', () => {
  for (let a = -6; a <= 12; a++) for (let d = 0; d <= 12; d++) {
    if (Math.abs(d - a) > 6) continue;
    const scenario = buildOutlookScenario(data, { arrivalLeadMonths: a, dwellMonths: d });
    const event = scenario.events.find((entry) => entry.id === 'zone-entry');
    for (const [priceKey, target] of [['price', scenario.priceSensitivity.peakPrice], ['low', scenario.priceSensitivity.lowPeakPrice], ['high', scenario.priceSensitivity.highPeakPrice]]) {
      const threshold = target * scenario.parameters.highZoneFraction;
      assert.ok(event[priceKey] >= threshold * (1 - 1e-12));
      for (const point of scenario.path) {
        assert.ok(point[priceKey] <= target * (1 + 1e-12));
        if (point.date < scenario.timing.zoneEntryDate) assert.ok(point[priceKey] < threshold, `${a}/${d} reaches ${priceKey} too soon on ${point.date}`);
      }
    }
    if (a === d) assert.equal(scenario.timing.effectivePeakDate, '2029-10-06');
    assert.ok(scenario.timing.effectiveRiseFromNominalTroughMonths >= 30 && scenario.timing.effectiveRiseFromNominalTroughMonths <= 42);
  }
});

test('calendar identity survives month-end clipping, leap years, zero formation and late arrival', () => {
  const may = computeOutlookTiming('2025-05-31', { arrivalLeadMonths: 3, dwellMonths: 3 });
  assert.equal(may.nominalPeakDate, '2029-05-31');
  assert.equal(may.zoneEntryDate, '2029-02-28');
  assert.equal(may.effectivePeakDate, '2029-05-31');
  assert.notEqual(shiftCalendarMonths(may.zoneEntryDate, 3), may.effectivePeakDate);
  const leap = computeOutlookTiming('2024-02-29', { arrivalLeadMonths: 12, dwellMonths: 12 });
  assert.equal(leap.effectivePeakDate, '2028-02-29');
  assert.equal(leap.zoneEntryDate, '2027-02-28');
  assert.equal(leap.formationDays, 366);
  const late = computeOutlookTiming('2025-10-06', { arrivalLeadMonths: -6, dwellMonths: 0 });
  assert.equal(late.zoneEntryDate, '2030-04-06');
  assert.equal(late.effectivePeakDate, late.zoneEntryDate);
  const zero = buildOutlookScenario(data, { arrivalLeadMonths: 3, dwellMonths: 0 });
  const highZone = zero.events.find((event) => event.id === 'zone-entry');
  assert.equal(highZone.date, zero.summary.peakDate);
  assert.equal(highZone.price, zero.summary.peakPrice);
});

test('invalid or expired assumptions fail visibly instead of being silently clamped', () => {
  assert.throws(() => computeOutlookTiming('2025-10-06', { arrivalLeadMonths: -7, dwellMonths: 0 }), /arrivalLeadMonths/);
  assert.throws(() => computeOutlookTiming('2025-10-06', { arrivalLeadMonths: 13, dwellMonths: 12 }), /arrivalLeadMonths/);
  assert.throws(() => computeOutlookTiming('2025-10-06', { arrivalLeadMonths: 12, dwellMonths: 0 }), /silently clamped/);
  assert.throws(() => computeOutlookTiming('2025-10-06', { arrivalLeadMonths: 1.5, dwellMonths: 2 }), /integer/);
  assert.throws(() => buildOutlookScenario(data, { peakMultiple: 1.1 }), /lowest price sensitivity/);
  assert.throws(() => buildOutlookScenario(data, { displayEnd: '2032-01-01' }), /modeled next low/);
  assert.throws(() => buildOutlookScenario(data, { kind: 'unknown' }), /kind/);
});

test('a stress low is a distinct assumed event and low-holds paths preserve their floor until the peak', () => {
  const stress = byId.stress, event = stress.events.find((point) => point.id === 'stress-low');
  assert.equal(event.date, '2027-01-06');
  close(event.price, outlook.observables.troughCandidate.price * 0.85);
  assert.ok(event.price < outlook.observables.troughCandidate.price);
  assert.equal(event.status, 'conditional-assumption');
  assert.ok(stress.summary.firstCandidateBreakDate > outlook.asOf);
  assert.ok(stress.path.every((point) => point.price >= event.price * (1 - 1e-12)));
  for (const scenario of outlook.scenarios.filter((scenario) => scenario.kind === 'bottom-holds')) {
    assert.equal(scenario.summary.firstCandidateBreakDate, null);
    assert.ok(scenario.path.filter((point) => point.date <= scenario.summary.peakDate).every((point) => point.low >= outlook.observables.troughCandidate.price));
  }
  const laterBear = buildOutlookScenario(data, { arrivalLeadMonths: 12, dwellMonths: 6, peakMultiple: 1.45, bearDrawdownPct: 85 });
  assert.equal(laterBear.summary.firstCandidateBreakDate, null);
  assert.equal(laterBear.summary.firstAnyCandidatePriceBreakDate, '2029-09-01');
  assert.ok(laterBear.summary.firstAnyCandidatePriceBreakDate > laterBear.summary.peakDate);
});

test('price and drawdown controls are explicit sensitivities, with a geometric path when waves are zero', () => {
  const scenario = buildOutlookScenario(data, { peakMultiple: 2.5, bearDrawdownPct: 60, waveAmplitude: 0 });
  close(scenario.summary.peakPrice, outlook.observables.current.price * 2.5);
  close(scenario.summary.nextLowPrice, scenario.summary.peakPrice * 0.4);
  close(scenario.priceSensitivity.lowPeakPrice, scenario.summary.peakPrice * 0.75);
  close(scenario.priceSensitivity.highPeakPrice, scenario.summary.peakPrice * 1.25);
  assert.equal(scenario.priceSensitivity.probability, null);
  assert.equal(scenario.priceSensitivity.choiceWasEstimatedFromData, false);
  const point = scenario.path.find((row) => row.date === '2028-01-01');
  const u = (utcDay(point.date) - utcDay(outlook.asOf)) / (utcDay(scenario.timing.zoneEntryDate) - utcDay(outlook.asOf));
  const target = scenario.summary.peakPrice * scenario.parameters.highZoneFraction;
  close(point.price, Math.exp((1 - u) * Math.log(outlook.observables.current.price) + u * Math.log(target)));
  assert.ok(byId.base.path.some((p) => p.date > byId.base.timing.zoneEntryDate && p.date < byId.base.timing.effectivePeakDate && p.price < byId.base.summary.peakPrice * 0.95));
});

test('future observations do not alter a fixed-asOf scenario or its observed anchors', () => {
  const withFuture = { ...data, prices: [...data.prices, ['2026-10-21', 9999999], ['2026-10-22', 0.00001]] };
  assert.deepEqual(analyzeThreeYearOutlook(withFuture), outlook);
  const options = { asOf: '2018-12-30', referenceDate: '2018-12-31', displayEnd: '2021-12-31' };
  const changedFuture = { ...data, prices: data.prices.map(([date, price]) => [date, date > options.asOf ? price * 100 : price]) };
  assert.deepEqual(buildOutlookScenario(changedFuture, options), buildOutlookScenario(data, options));
});

test('historical A/D decomposition retains delayed arrival and is explicitly an identity', () => {
  const reconstruction = outlook.historicalReconstruction;
  assert.equal(reconstruction.forecastAccuracyClaim, false);
  assert.deepEqual(reconstruction.cases.map((record) => [record.year, record.leadDays, record.formationDays, record.netShiftDays]), [[2017, -12, 0, 12], [2021, 58, 20, -38], [2025, 118, 85, -33]]);
  assert.equal(reconstruction.cases.at(-1).sameEventLeadFromPriorEntryDays, 98);
  assert.ok(reconstruction.cases.every((record) => record.identityResidualDays === 0 && !record.predictiveScore));
  const ninety = reconstructHistoricalOutlook(data, { highZoneFraction: 0.9 });
  assert.deepEqual(ninety.cases.map((record) => record.netShiftDays), reconstruction.cases.map((record) => record.netShiftDays));
});

test('this model has its own prefix hindcast, retains failures, and excludes 2025/26 outcomes', () => {
  const result = outlook.validation;
  assert.equal(result.numberOfDistinctCutoffs, 2);
  assert.equal(result.currentCycleIncluded, false);
  assert.equal(result.genuineProspectiveValidation, false);
  assert.equal(result.parameterSelectionWasRetrospective, true);
  assert.deepEqual(result.samples.map((record) => record.cutoff), ['2014-12-18', '2018-12-30']);
  assert.equal(result.samples[0].firstActualCandidateBreakDate, '2014-12-29');
  assert.deepEqual(result.samples.map((record) => record.peakDateErrorDays), [-12, 38]);
  assert.equal(result.candidateHoldFailures, 1);
  for (const sample of result.samples) {
    assert.equal(sample.informationThrough, sample.cutoff);
    assert.ok(sample.results.every((record) => record.outcomeDate < '2025-01-01'));
    for (const record of sample.results) {
      close(record.absoluteLogError, Math.abs(Math.log(record.scenarioPrice / record.actualPrice)));
      close(record.flatAbsolutePercentageErrorPct, 100 * Math.abs(record.flatPrice / record.actualPrice - 1));
    }
  }
  assert.ok(result.summary.every((record) => record.scenarioMAPEPct > record.flatMAPEPct));
  assert.ok(result.summary[0].scenarioMeanAbsoluteLogError > result.summary[0].flatMeanAbsoluteLogError);
  const changedCurrent = { ...data, prices: data.prices.map(([date, price]) => [date, date >= '2025-01-01' ? price * 100 : price]) };
  assert.deepEqual(evaluateThreeYearModel(changedCurrent), result);
});
