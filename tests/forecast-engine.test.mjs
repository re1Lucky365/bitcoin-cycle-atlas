import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { analyzeCycleForecast, backtestAnalogueForecast, detectScenarioTurns, interpolateLogAnchors } from '../dist/forecast-engine.js';
import { dateFromDay, utcDay } from '../dist/cycle-engine.js';

const bundled = JSON.parse(await readFile(new URL('./fixtures/btc-daily-2026-10-20.json', import.meta.url), 'utf8'));
const data = { ...bundled, prices: bundled.prices.filter(([date]) => date <= '2026-10-20') };
const forecast = analyzeCycleForecast(data);
const close = (actual, expected, relative = 1e-11) => assert.ok(Math.abs(actual - expected) <= relative * Math.max(1, Math.abs(expected)), `${actual} differs from ${expected}`);

test('forecast anchors and default high-zone definition reproduce observed UTC prices', () => {
  assert.equal(forecast.asOf, '2026-10-20');
  assert.equal(forecast.current.peak.date, '2025-10-06');
  assert.equal(forecast.current.troughCandidate.date, '2026-06-30');
  assert.equal(forecast.current.phaseDays, 112);
  assert.equal(forecast.current.firstHighZoneEntry.date, '2025-07-13');
  assert.equal(forecast.current.firstHighZoneEntry.thresholdFraction, 0.95);
  assert.equal(forecast.current.firstHighZoneEntry.daysBeforePeak, 85);
  assert.equal(forecast.horizonDate, '2028-10-19');
  assert.equal(forecast.scenarios.length, 3);
});

test('every projected analogue uses a historical prefix and exactly the stated return formula', () => {
  const prices = new Map(data.prices);
  for (const scenario of forecast.scenarios) {
    assert.ok(scenario.referenceKnownAt <= forecast.asOf);
    assert.ok(scenario.sourceEndDate <= forecast.asOf);
    assert.equal(scenario.path[0].date, forecast.asOf);
    assert.equal(scenario.path.at(-1).date, forecast.horizonDate);
    close(scenario.path[0].price, forecast.current.price);
    for (const point of scenario.path) {
      close(point.price, forecast.current.price * prices.get(point.sourceDate) / prices.get(scenario.sourceAlignedDate));
      assert.equal(utcDay(point.date) - utcDay(forecast.asOf), point.horizonDay);
      assert.equal(utcDay(point.sourceDate) - utcDay(scenario.sourceAlignedDate), point.horizonDay);
      assert.ok(point.sourceDate <= forecast.asOf);
    }
    for (const event of scenario.events) {
      assert.ok(event.date > forecast.asOf && event.date < event.confirmationDate);
      assert.ok(event.confirmationDate <= forecast.horizonDate);
      assert.ok(scenario.path.some((point) => point.date === event.date && point.price === event.price));
      assert.ok(event.type === 'peak' ? event.confirmationPrice <= event.price * 0.8 : event.confirmationPrice >= event.price * 1.2);
      assert.equal(event.probability, null);
    }
  }
  for (const band of forecast.envelope) {
    assert.ok(band.min <= band.geometricMean && band.geometricMean <= band.max);
    assert.equal(band.n, 3);
    assert.equal(band.probability, null);
  }
});

test('only established internal reversals become turns; shallow starts and terminal highs do not', () => {
  const start = utcDay('2030-01-01');
  const path = (prices) => prices.map((price, day) => ({ date: dateFromDay(start + day), price, horizonDay: day }));
  assert.deepEqual(detectScenarioTurns(path([100, 120, 150, 180])), []);
  assert.deepEqual(detectScenarioTurns(path([100, 99, 119, 140])), []);
  const turns = detectScenarioTurns(path([100, 130, 104, 80, 96, 120, 95]));
  assert.deepEqual(turns.map((event) => [event.type, event.horizonDay]), [['peak', 1], ['trough', 3], ['peak', 5]]);
  assert.ok(turns.every((event) => event.horizonDay !== 0 && event.horizonDay !== 6));
});

test('future rows cannot alter a fixed-asOf forecast or its candidate selection', () => {
  const options = { asOf: '2023-03-31', horizonDays: 365, includeBacktest: false };
  const original = analyzeCycleForecast(data, options);
  const corruptedFuture = { ...data, prices: data.prices.map(([date, price]) => [date, date > options.asOf ? price * 100 : price]) };
  assert.deepEqual(analyzeCycleForecast(corruptedFuture, options), original);
  assert.equal(original.current.troughCandidate.date, '2022-11-09');
  assert.deepEqual(original.scenarios.map((scenario) => scenario.referenceYear), [2012, 2016]);
});

test('bottom-holds event dates use observed intervals and no second compression', () => {
  const macro = forecast.macro.scenarios.find((scenario) => scenario.id === 'bottom-holds');
  assert.deepEqual(forecast.macro.lowToNextPeakIntervals.map((interval) => interval.days), [1067, 1059, 1062]);
  assert.equal(macro.peakWindow.startDate, '2029-05-24');
  assert.equal(macro.peakWindow.centerDate, '2029-05-27');
  assert.equal(macro.peakWindow.endDate, '2029-06-01');
  assert.equal(macro.highZoneWindow.centerDate, '2029-03-03');
  assert.equal(macro.troughWindow.startDate, '2030-05-23');
  assert.equal(macro.troughWindow.endDate, '2030-07-12');
  assert.equal(macro.shorterDeclineWindow.centerDate, '2030-02-18');
  assert.equal(forecast.macro.unknownFutureHalvingDateUsed, false);
  assert.equal(forecast.macro.lowToNextPeakIntervals.at(-1).nextPeakProvisional, true);
});

test('calendar recurrence keeps high-zone and absolute peak distinct and clamps month ends', () => {
  const byId = Object.fromEntries(forecast.macro.scenarios.map((scenario) => [scenario.id, scenario]));
  assert.equal(byId['calendar-48m'].peakWindow.centerDate, '2029-10-06');
  assert.equal(byId['calendar-48m'].highZoneWindow.centerDate, '2029-07-13');
  assert.equal(byId['calendar-48m'].troughWindow.centerDate, '2030-06-30');
  assert.equal(byId['calendar-minus-3m'].peakWindow.centerDate, '2029-07-06');
  assert.equal(byId['calendar-minus-4m'].troughWindow.centerDate, '2030-02-28');
  assert.equal(byId['calendar-minus-5m'].peakWindow.centerDate, '2029-05-06');
  const ninety = analyzeCycleForecast(data, { highZoneFraction: 0.9, includeBacktest: false });
  assert.equal(ninety.current.firstHighZoneEntry.date, '2025-07-10');
  assert.equal(ninety.macro.scenarios.find((scenario) => scenario.id === 'calendar-48m').highZoneWindow.centerDate, '2029-07-10');
  assert.deepEqual(ninety.macro.scenarios[0].peakWindow, forecast.macro.scenarios[0].peakWindow);
});

test('price sensitivities are explicit formulas, retain provisional cases, and are not probabilities', () => {
  const model = forecast.macro.priceModel;
  for (const entry of model.peakPriceCases) close(entry.price, forecast.current.peak.price * model.lastPeakMultiple ** entry.alpha);
  assert.deepEqual(model.peakPriceCases.map((entry) => entry.alpha), [0.5, 0.75, 1]);
  assert.equal(model.representativeChoiceIsNotEstimated, true);
  for (const entry of model.troughPriceGrid) {
    const peak = model.peakPriceCases.find((choice) => choice.alpha === entry.alpha);
    close(entry.price, peak.price * entry.retention);
  }
  assert.equal(model.retentionCases.at(-1).provisional, true);
  assert.equal(model.peakPriceBand.probability, null);
  for (const scenario of forecast.macro.scenarios) {
    assert.ok(scenario.path.every((point) => point.low <= point.price && point.price <= point.high));
    assert.ok(scenario.path.slice(1).every((point) => point.kind === 'schematic-log-interpolation'));
  }
});

test('log interpolation is a geometric connector and preserves event anchors', () => {
  const path = interpolateLogAnchors([{ date: '2030-01-01', price: 100 }, { date: '2030-01-03', price: 400 }], { stepDays: 1 });
  close(path[1].price, 200);
  assert.equal(path.at(-1).price, 400);
  assert.throws(() => interpolateLogAnchors([{ date: '2030-01-01', price: 0 }]), /positive/);
  assert.throws(() => interpolateLogAnchors([{ date: '2030-01-01', price: 100 }, { date: '2030-01-01', price: 200 }]), /increasing/);
});

test('a new ATH removes stale low-dependent paths and a new lower low revises the anchor', () => {
  const fresh = analyzeCycleForecast({ ...data, prices: [...data.prices, ['2026-10-21', 200000]] }, { includeBacktest: false });
  assert.equal(fresh.current.troughCandidate, null);
  assert.equal(fresh.availability.analogue, false);
  assert.equal(fresh.scenarios.length, 0);
  assert.ok(!fresh.macro.scenarios.some((scenario) => scenario.id === 'bottom-holds'));
  assert.ok(fresh.macro.scenarios.every((scenario) => scenario.troughWindow === null));
  const lower = analyzeCycleForecast({ ...data, prices: [...data.prices, ['2026-10-21', 50000]] }, { includeBacktest: false });
  assert.equal(lower.current.troughCandidate.date, '2026-10-21');
  assert.equal(lower.current.phaseDays, 0);
  assert.notDeepEqual(lower.macro.scenarios[0].peakWindow, forecast.macro.scenarios[0].peakWindow);
});

test('a missing historical day excludes that whole borrowed return path', () => {
  const missing = analyzeCycleForecast({ ...data, prices: data.prices.filter(([date]) => date !== '2015-08-24') }, { includeBacktest: false });
  assert.deepEqual(missing.scenarios.map((scenario) => scenario.referenceYear), [2016, 2020]);
  assert.equal(missing.availability.excludedAnalogues[0].missingDate, '2015-08-24');
  assert.ok(missing.envelope.every((band) => band.n === 2));
});

test('fixed-cutoff replay includes the weak horizon and no current-cycle information', () => {
  const replay = forecast.backtest;
  assert.equal(replay.numberOfDistinctCutoffs, 2);
  assert.deepEqual(replay.samples.map((sample) => sample.referenceYears), [[2012], [2012, 2016]]);
  for (const sample of replay.samples) {
    assert.ok(sample.maxReferenceSourceDate <= sample.cutoff);
    assert.equal(sample.predictionInformationThrough, sample.cutoff);
    assert.ok(sample.results.every((result) => result.outcomeDate < '2025-01-01'));
  }
  const halfYear = replay.summary.find((entry) => entry.horizonDays === 180);
  assert.ok(halfYear.analogueMeanAbsoluteLogError > halfYear.flatMeanAbsoluteLogError);
  const year = replay.summary.find((entry) => entry.horizonDays === 365);
  close(year.analogueMeanAbsolutePercentageErrorPct, 20.39388966812764);
  close(year.flatMeanAbsolutePercentageErrorPct, 47.73038129299078);
  assert.equal(replay.currentCycleIncluded, false);
  const changedCurrent = { ...data, prices: data.prices.map(([date, price]) => [date, date >= '2025-01-01' ? price / 10 : price]) };
  assert.deepEqual(backtestAnalogueForecast(changedCurrent), replay);
});

test('log interpolation enforces its sensitivity band when only one bound is supplied', () => {
  for (const anchor of [
    { date: '2030-01-01', price: 100, low: 110 },
    { date: '2030-01-01', price: 100, high: 90 },
  ]) assert.throws(() => interpolateLogAnchors([anchor]), /inside its sensitivity band/);
  assert.deepEqual(interpolateLogAnchors([{ date: '2030-01-01', price: 100, low: 90 }])[0], {
    date: '2030-01-01', price: 100, low: 90, high: 100, kind: 'observed-anchor',
  });
});

test('analogue scaling avoids intermediate overflow when the resulting prices are finite', () => {
  const options = { horizonDays: 30, includeBacktest: false };
  const original = analyzeCycleForecast(data, options);
  const multiplier = 1e150;
  const scaled = analyzeCycleForecast({ prices: data.prices.map(([date, price]) => [date, price * multiplier]) }, options);
  assert.equal(scaled.scenarios.length, original.scenarios.length);
  for (let s = 0; s < original.scenarios.length; s++) {
    const before = original.scenarios[s], after = scaled.scenarios[s];
    assert.equal(after.path[0].price, scaled.current.price);
    for (let i = 0; i < before.path.length; i++) close(after.path[i].price / multiplier, before.path[i].price);
  }
});

test('a customized analogue replay discloses actual included current-cycle outcomes', () => {
  const current = backtestAnalogueForecast(data, { cutoffs: ['2026-06-30'], validationEnd: '2026-10-20', horizons: [90] });
  assert.equal(current.numberOfDistinctCutoffs, 1);
  assert.equal(current.currentCycleIncluded, true);
  assert.ok(current.samples[0].results.some(result => result.outcomeDate >= '2025-01-01'));
  const priorOnly = backtestAnalogueForecast(data, { cutoffs: ['2019-03-31'], validationEnd: '2026-10-20', horizons: [90] });
  assert.equal(priorOnly.currentCycleIncluded, false);
  assert.throws(() => backtestAnalogueForecast(data, { horizons: [90, 90] }), /distinct|duplicate/i);
});
