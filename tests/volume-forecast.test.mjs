import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { utcDay, dateFromDay } from '../dist/cycle-engine.js';
import { aggregateVolumeMonths, fitVolumeForecastModel, projectVolumeForecast } from '../dist/volume-forecast.js';

const DAY = 86400;
const makeBars = (first = '2016-01-01', last = '2026-10-21', { flatPrice = false, volume = null } = {}) => {
  const start = utcDay(first), end = utcDay(last);
  return Array.from({ length: end - start + 1 }, (_, index) => {
    const day = start + index, date = dateFromDay(day), m = index / 30.4375;
    return { date, time: day * DAY, close: flatPrice ? 100 : 100 * Math.exp(0.00025 * index + 0.15 * Math.sin(index / 23) + 0.025 * Math.sin(index / 3)),
      volume: volume ?? 1000 * Math.exp(-0.007 * m + 0.18 * Math.sin(m / 3) + 0.05 * Math.cos(index / 4)) };
  });
};
const synthetic = makeBars();
const syntheticModel = fitVolumeForecastModel(synthetic, { asOf: '2026-10-21' });
const pricePath = (end = '2050-12-31') => [
  { date: '2026-10-21', price: 99, baselinePrice: 100, annualizedVolatilityPct: 40 },
  { date: end, price: 999999, baselinePrice: 1000, annualizedVolatilityPct: 22.5 },
];
const near = (actual, expected, relative = 1e-11) => assert.ok(Math.abs(actual - expected) <= Math.max(1e-9, Math.abs(expected) * relative), `${actual} ≉ ${expected}`);

test('complete-calendar aggregation keeps genuine zero volumes and rejects missing or unfinished months', () => {
  const bars = makeBars('2020-01-01', '2020-04-20').map(row => ({ ...row, volume: row.date.startsWith('2020-01') ? 0 : row.date === '2020-02-10' ? 0 : 2 }));
  const missing = bars.filter(row => row.date !== '2020-03-12');
  const result = aggregateVolumeMonths(missing, { asOf: '2020-04-20' });
  assert.deepEqual(result.months.map(row => row.month), ['2020-01', '2020-02']);
  assert.equal(result.months[0].meanDailyVolume, 0); assert.equal(result.months[0].zeroVolumeDays, 31);
  assert.equal(result.months[1].days, 29); near(result.months[1].volumeTotal, 56); near(result.months[1].meanDailyVolume, 56 / 29);
  assert.deepEqual(result.excludedMonths.map(row => [row.month, row.reason]), [['2020-03', 'missing-calendar-days'], ['2020-04', 'unfinished-calendar-month']]);
  const absentMonth = aggregateVolumeMonths(bars.filter(row => !row.date.startsWith('2020-02')), { asOf: '2020-04-20' });
  assert.equal(absentMonth.excludedMonths.find(row => row.month === '2020-02').observedDays, 0);
});

test('fit is cutoff-specific: appending or changing future values cannot affect any fitted or validation output', () => {
  const cutoff = '2023-09-30', prefix = synthetic.filter(row => row.date <= cutoff);
  const poisonedFuture = synthetic.map(row => row.date > cutoff ? { ...row, close: NaN, volume: -Infinity, open: -1 } : row);
  const expected = fitVolumeForecastModel(prefix, { asOf: cutoff });
  assert.deepEqual(fitVolumeForecastModel(poisonedFuture, { asOf: cutoff }), expected);
  assert.equal(expected.metadata.observedEnd, cutoff);
  assert.ok(expected.monthly.every(row => row.endDate <= cutoff));
});

test('development origins AND outcomes precede holdout; holdout outcomes/covariates cannot select or alter ex-ante forecasts', () => {
  const original = syntheticModel;
  assert.equal(original.validation.holdout.months, 24);
  const split = original.validation.selection.splitDate;
  assert.ok(original.validation.development.samples.every(row => row.originDate < row.targetEnd && row.targetEnd <= split));
  const changed = synthetic.map(row => row.date > split ? { ...row, close: row.close * (2 + Math.sin(utcDay(row.date)) ** 2), volume: row.volume * 7 } : row);
  const refit = fitVolumeForecastModel(changed, { asOf: '2026-10-21' });
  assert.deepEqual(refit.validation.selection, original.validation.selection);
  assert.deepEqual(refit.validation.development, original.validation.development);
  assert.deepEqual(refit.validation.holdout.samples.map(row => row.predictions), original.validation.holdout.samples.map(row => row.predictions));
  assert.notEqual(refit.validation.holdout.selectedMetrics.mae, original.validation.holdout.selectedMetrics.mae);
  assert.equal(original.validation.holdout.byHorizon[36].models.persistence.count, 0);
  assert.equal(original.validation.holdout.usedForSelection, false);
  assert.equal(original.validation.futureRealizedCovariatesUsed, false);
  assert.equal(original.validation.genuineProspectiveValidation, false);
});

test('limited history, stale last day and all-zero recent activity are unavailable without invented observations', () => {
  assert.equal(fitVolumeForecastModel([], { asOf: '2026-10-21' }).status, 'unavailable');
  assert.equal(fitVolumeForecastModel(makeBars('2025-01-01', '2026-10-21')).reason, 'fewer-than-36-complete-calendar-months');
  assert.equal(fitVolumeForecastModel(synthetic.slice(0, -1), { asOf: '2026-10-21' }).reason, 'insufficient-recent-positive-volume-anchor');
  const zero = synthetic.map(row => row.date >= '2026-07-24' ? { ...row, volume: 0 } : row);
  assert.equal(fitVolumeForecastModel(zero).status, 'unavailable');
  assert.deepEqual(projectVolumeForecast({ status: 'unavailable', reason: 'short' }, []), { status: 'unavailable', reason: 'short', points: [], summary: null, annual: [], diagnostics: {} });
});

test('zero volatility or zero-volume months stay explicit; no fabricated epsilon observations are fitted', () => {
  const bars = makeBars('2016-01-01', '2026-10-21', { flatPrice: true, volume: 10 }).map(row => row.date.startsWith('2020-05') ? { ...row, volume: 0 } : row);
  const model = fitVolumeForecastModel(bars);
  assert.equal(model.status, 'ready'); assert.equal(model.params.available, false);
  assert.equal(model.params.priceCoefficient, 0); assert.equal(model.params.volatilityCoefficient, 0);
  assert.ok(model.params.zeroVolumeMonths.includes('2020-05'));
  assert.equal(model.params.zeroVolatilityMonths.length, model.monthly.length);
  assert.equal(model.monthly.find(row => row.month === '2020-05').meanDailyVolume, 0);
  const result = projectVolumeForecast(model, pricePath('2027-12-31'));
  assert.ok(result.points.every(row => Number.isFinite(row.volume) && row.lower > 0 && row.lower <= row.volume && row.volume <= row.upper));
});

test('projection reaches the supplied 2050 horizon and always labels smooth daily quantities as nonprobabilistic scenarios', () => {
  const result = projectVolumeForecast(syntheticModel, pricePath(), { endDate: '2050-12-31' });
  assert.equal(result.status, 'ready'); assert.equal(result.points[0].date, '2026-10-22'); assert.equal(result.points.at(-1).date, '2050-12-31');
  assert.equal(result.points.length, utcDay('2050-12-31') - utcDay('2026-10-21'));
  assert.equal(result.summary.trainingMonths, 129); assert.equal(result.summary.unit, 'BTC/day');
  assert.equal(result.summary.probability, null); assert.equal(result.summary.calibrated, false);
  assert.equal(result.diagnostics.rangeIsConfidenceInterval, false); assert.equal(result.diagnostics.futureOHLCProduced, false);
  assert.ok(result.points.every(row => row.kind === 'scenario' && row.unit === 'BTC' && row.daysIncluded === 1 && row.probability === null && !row.calibrated));
  assert.ok(result.points.every(row => row.lower > 0 && row.lower <= row.volume && row.volume <= row.upper && Number.isFinite(row.usdProxy)));
  for (const point of result.points) for (const key of ['open', 'high', 'low', 'close']) assert.equal(Object.hasOwn(point, key), false);
  assert.deepEqual(result.annual.filter(row => [2030, 2035, 2040, 2050].includes(row.year)).map(row => row.year), [2030, 2035, 2040, 2050]);
  near(result.points.at(-1).usdProxy, result.points.at(-1).priceReference * result.points.at(-1).volume);
});

test('same inputs are byte-deterministic and baselinePrice shields quantity/range from illustrative price noise', () => {
  const path = pricePath('2027-12-31'), first = projectVolumeForecast(syntheticModel, path);
  assert.deepEqual(projectVolumeForecast(syntheticModel, path), first);
  assert.deepEqual(projectVolumeForecast(syntheticModel, path.map(row => ({ ...row, price: row.price * 999 }))), first);
  assert.equal(first.diagnostics.priceBasis, 'baselinePrice');
  const priceOnly = projectVolumeForecast(syntheticModel, path.map(({ baselinePrice, ...row }) => ({ ...row, price: baselinePrice })));
  near(priceOnly.points[15].volume, first.points[15].volume);
  assert.equal(priceOnly.diagnostics.priceBasis, 'baselinePrice-when-available-otherwise-price');
});

test('volatility metadata distinguishes provided scenario assumptions from unused fallback settings', () => {
  const given = pricePath('2027-12-31').map(row => ({ ...row, annualizedVolatilityPct: 100 }));
  const result = projectVolumeForecast(syntheticModel, given, { terminalVolatility: 0.25 });
  assert.equal(result.summary.volatilitySource, 'provided-price-scenario');
  assert.equal(result.summary.terminalVolatilityRole, 'unused-fallback-only');
  assert.equal(result.summary.lastVolatilityAssumption, 1); assert.equal(result.diagnostics.fallbackVolatilityDays, 0);
  assert.ok(result.points.every(row => row.annualizedVolatilityAssumption === 1));
  const fallback = projectVolumeForecast(syntheticModel, given.map(({ annualizedVolatilityPct, ...row }) => row), { terminalVolatility: 0.25 });
  assert.equal(fallback.summary.volatilitySource, 'anchored-mean-reversion-assumption');
  assert.equal(fallback.summary.terminalVolatilityRole, 'fallback-assumption');
  assert.equal(fallback.diagnostics.providedVolatilityDays, 0);
});

test('weekly values are sums of seven future-only UTC days; partial weeks are omitted and annual BTC/day values stay identical', () => {
  const daily = projectVolumeForecast(syntheticModel, pricePath('2027-12-31'));
  const weekly = projectVolumeForecast(syntheticModel, pricePath('2027-12-31'), { frequency: 'weekly' });
  assert.equal(weekly.points[0].startDate, '2026-10-26'); assert.equal(weekly.points[0].endDate, '2026-11-01');
  assert.equal(weekly.points[0].time, utcDay('2026-10-26') * DAY);
  assert.ok(weekly.points.every(row => row.daysIncluded === 7 && row.completeCalendarWeek && row.startDate > syntheticModel.asOf));
  for (const week of weekly.points) {
    const days = daily.points.filter(row => row.date >= week.startDate && row.date <= week.endDate);
    assert.equal(days.length, 7);
    for (const key of ['volume', 'lower', 'upper', 'usdProxy']) near(week[key], days.reduce((sum, row) => sum + row[key], 0));
    near(week.priceReference * week.volume, week.usdProxy);
  }
  assert.equal(weekly.diagnostics.excludedPartialWeekDays + 7 * weekly.points.length, daily.points.length);
  assert.deepEqual(weekly.annual, daily.annual); assert.deepEqual(weekly.summary, daily.summary);
});

test('requested horizon cannot extrapolate beyond price evidence and explicit cutoff/frequency/date mistakes fail closed', () => {
  const path = pricePath('2027-12-31');
  const clipped = projectVolumeForecast(syntheticModel, path, { endDate: '2050-12-31' });
  assert.equal(clipped.points.at(-1).date, '2027-12-31'); assert.equal(clipped.diagnostics.extrapolatedDays, 0); assert.equal(clipped.diagnostics.priceHorizonClipped, true);
  assert.throws(() => projectVolumeForecast(syntheticModel, path, { asOf: '2026-10-20' }), /refit/);
  assert.throws(() => projectVolumeForecast(syntheticModel, path, { frequency: 'hourly' }), /frequency/);
  assert.throws(() => projectVolumeForecast(syntheticModel, path, { endDate: '2026-10-21' }), /after/);
  assert.throws(() => projectVolumeForecast(syntheticModel, path, { terminalVolatility: NaN }));
  assert.throws(() => projectVolumeForecast(syntheticModel, [path[0], path[0], path[1]]), /unique/);
  assert.throws(() => projectVolumeForecast(syntheticModel, [{ ...path[0], baselinePrice: 0 }, path[1]]), /Positive/);
  assert.throws(() => fitVolumeForecastModel(synthetic, { source: 'global' }), /Bitstamp/);
  assert.throws(() => fitVolumeForecastModel([synthetic[0], synthetic[0]]), /unique/);
  assert.throws(() => aggregateVolumeMonths([{ date: '2020-02-30', close: 1, volume: 2 }]));
});

test('weekly aggregation rejects overflowing dollar proxies even when every daily proxy is finite', () => {
  const path = [{ date: syntheticModel.asOf, baselinePrice: 2e305 }, { date: '2026-11-15', baselinePrice: 2e305 }];
  const daily = projectVolumeForecast(syntheticModel, path);
  assert.ok(daily.points.every(row => Number.isFinite(row.usdProxy)));
  assert.throws(() => projectVolumeForecast(syntheticModel, path, { frequency: 'weekly' }), /Weekly scenario sums/);
});

test('real snapshot benchmark honesty: a losing development model cannot replace persistence because holdout looks better', async () => {
  const payload = JSON.parse(await readFile(new URL('../dist/data/btc-volume.json', import.meta.url), 'utf8'));
  const model = fitVolumeForecastModel(payload.bars, { asOf: '2026-10-21' });
  assert.equal(model.status, 'ready'); assert.equal(model.metadata.trainingMonths, 181); assert.equal(model.metadata.zeroVolumeDays, 33);
  assert.equal(model.validation.selection.method, 'persistence'); assert.equal(model.validation.selection.responseWeight, 0);
  assert.ok(model.validation.selection.scores.filter(row => row.method !== 'persistence').every(row => !row.qualifies));
  assert.ok(model.validation.holdout.metricsByMethod.conditional100.mae < model.validation.holdout.metricsByMethod.persistence.mae);
  assert.equal(model.params.priceCoefficient, 0); assert.ok(model.params.windows.some(row => row.priceCoefficient < 0)); assert.ok(model.params.windows.some(row => row.priceCoefficient > 0));
  const forecast = projectVolumeForecast(model, [{ date: model.asOf, baselinePrice: model.anchor.lastPrice }, { date: '2050-12-31', baselinePrice: 1000000 }]);
  assert.ok(forecast.points.every(row => Math.abs(row.volume - model.anchor.meanDailyVolume) < 1e-8));
  near(model.anchor.meanDailyVolume, 1566.7136227944436);
  near(model.validation.holdout.selectedMetrics.wapePct, 37.412649601871784);
  assert.equal(model.validation.maximumEvaluatedHorizonMonths, 36); assert.equal(model.validation.longHorizonValidated, false);
});
