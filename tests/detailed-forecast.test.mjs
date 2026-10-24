import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { buildDetailedForecast, evaluateDetailedForecast, DETAILED_SCENARIOS } from '../dist/detailed-forecast.js';
import { utcDay, dateFromDay } from '../dist/cycle-engine.js';
import { shiftCalendarMonths } from '../dist/cycle-timing.js';
import { detectDirectionalChanges } from '../dist/market-structure.js';

const data = JSON.parse(await readFile(new URL('./fixtures/btc-daily-2026-10-20.json', import.meta.url), 'utf8'));
const close = (a, b, tol = 1e-10) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} != ${b}`);
const fast = { sampleCount: 16 };
const base = buildDetailedForecast(data, fast);

test('the model connects exactly to the completed observation and covers every calendar day', () => {
  assert.equal(base.asOf, '2026-10-20');
  assert.equal(base.referenceDate, '2026-10-22');
  assert.equal(base.displayEnd, '2029-10-22');
  assert.equal(base.path.length, 1099);
  const origin = base.observables.current.price;
  for (let i = 0; i < base.path.length; i++) {
    const point = base.path[i];
    assert.equal(point.date, dateFromDay(utcDay(base.asOf) + i));
    assert.ok([point.price, point.lower, point.median, point.upper, point.baselinePrice].every(value => Number.isFinite(value) && value > 0));
    assert.ok(point.lower <= point.median && point.median <= point.upper);
    close(point.indexedPrice, 100 * point.price / origin);
    assert.equal(point.probability, null);
  }
  for (const key of ['price', 'lower', 'median', 'upper', 'baselinePrice']) assert.equal(base.path[0][key], origin);
  assert.equal(base.path[0].indexedPrice, 100);
  assert.equal(base.observables.recoveryDays, 112);
  assert.equal(base.nominalClock.nominalTroughDate, '2026-10-06');
  assert.equal(base.observables.troughCandidate.date, '2026-06-30');
  assert.equal(base.nominalClock.futureHalvingDateAssumed, false);
});

test('future appended or altered observations cannot alter a fixed-asOf result', () => {
  const options = { ...fast, asOf: '2019-03-31', referenceDate: '2019-04-01' };
  const original = buildDetailedForecast(data, options);
  const changed = { ...data, prices: data.prices.map(([date, price]) => [date, date > options.asOf ? price * (date.endsWith('01') ? 1000 : 0.001) : price]) };
  assert.deepEqual(buildDetailedForecast(changed, options), original);
  const truncated = data.prices.filter(([date]) => date <= options.asOf);
  assert.deepEqual(buildDetailedForecast(truncated, options), original);
  const future = { ...data, prices: [...data.prices, ['2026-10-21', 1e20], ['2026-10-22', 1e-10]] };
  assert.deepEqual(buildDetailedForecast(future, { ...fast, asOf: '2026-10-20', referenceDate: '2026-10-22' }), base);
});

test('invalid date labels and sparse rows cannot disappear through the asOf filter', () => {
  const sparse = [...data.prices];
  sparse.length++;
  for (const input of [[...data.prices, ['not-a-date', 1]], [...data.prices, { price: 1 }], sparse]) {
    assert.throws(() => buildDetailedForecast(input, { ...fast, asOf: '2026-10-20' }), TypeError);
  }
});

test('every replay block is wholly past and keeps its source ordering and provenance', () => {
  assert.equal(base.training.stateLabelsAreCausal, true);
  assert.ok(base.training.eligibleBlockStarts > 5000);
  let previousEnd = base.asOf;
  for (const block of base.training.representativeBlocks) {
    assert.ok(block.sourceStartDate < block.sourceReturnStartDate);
    assert.ok(block.sourceReturnStartDate <= block.sourceEndDate);
    assert.ok(block.sourceEndDate <= base.asOf);
    assert.equal(utcDay(block.sourceEndDate) - utcDay(block.sourceStartDate), block.days);
    assert.equal(utcDay(block.targetStartDate), utcDay(previousEnd) + 1);
    assert.equal(utcDay(block.targetEndDate) - utcDay(block.targetStartDate) + 1, block.days);
    assert.ok(block.days > 0 && block.days <= 84);
    previousEnd = block.targetEndDate;
  }
  assert.equal(previousEnd, base.assumptions.bridgeTerminalDate);
  assert.equal(base.training.independentSampleSizeClaim, null);
  assert.equal(base.training.overlappingBlocksAreIndependent, false);
  assert.equal(base.training.sourceEras.at(-1).incomplete, true);
});

test('seeded samples are reproducible, unaffected by larger ensemble size, and do not mutate input', () => {
  const before = JSON.stringify(data);
  const a = buildDetailedForecast(data, { ...fast, includeSamplePaths: true });
  const b = buildDetailedForecast(data, { sampleCount: 32, includeSamplePaths: true });
  const changedSeed = buildDetailedForecast(data, { ...fast, seed: 1, includeSamplePaths: true });
  assert.deepEqual(a.samplePaths, b.samplePaths.slice(0, 16));
  assert.notDeepEqual(a.samplePaths[0].prices, changedSeed.samplePaths[0].prices);
  assert.deepEqual(buildDetailedForecast(data, fast), base);
  assert.equal(JSON.stringify(data), before);
  assert.deepEqual(a.path.map(row => row.price), a.samplePaths[a.training.selectedRepresentativeIndex].prices);
});

test('changing quote units changes prices only, not the relative stochastic dynamics', () => {
  const scaled = { ...data, prices: data.prices.map(([date, price]) => [date, price * 10]) };
  const a = buildDetailedForecast(data, { ...fast, includeSamplePaths: true });
  const b = buildDetailedForecast(scaled, { ...fast, includeSamplePaths: true });
  for (let s = 0; s < 16; s++) for (let t = 0; t < a.path.length; t += 31) close(b.samplePaths[s].prices[t], a.samplePaths[s].prices[t] * 10, 1e-8);
  close(b.assumptions.peakMultiple, a.assumptions.peakMultiple);
});

test('volatility sensitivity has the stated log-space effect without clipping prices', () => {
  const one = buildDetailedForecast(data, { ...fast, includeSamplePaths: true, volatilityMultiplier: 1 });
  const two = buildDetailedForecast(data, { ...fast, includeSamplePaths: true, volatilityMultiplier: 2 });
  for (let s = 0; s < 16; s++) for (let t = 0; t < one.path.length; t += 37) {
    const reference = one.path[t].baselinePrice;
    close(Math.log(two.samplePaths[s].prices[t] / reference), 2 * Math.log(one.samplePaths[s].prices[t] / reference), 1e-9);
  }
  assert.ok(two.samplePaths.some(sample => sample.prices.some(price => price < two.observables.troughCandidate.price)));
  assert.ok(two.samplePaths.some(sample => sample.prices.some(price => price > two.assumptions.peakReferencePrice)));
  assert.equal(two.assumptions.pathCapsOrFloorsApplied, false);
  assert.ok(one.events.some(event => event.inHorizon && Math.abs(event.price - event.representativePriceOnDate) > 1));
});

test('scenario timing preserves the nominal clock while allowing formation or net shifts', () => {
  const expected = { base: ['2029-07-06', '2029-10-06'], accelerated: ['2029-01-06', '2029-06-06'], wait: ['2029-01-06', '2029-10-06'], late: ['2029-07-06', '2030-01-06'], stress: ['2029-07-06', '2029-10-06'] };
  for (const preset of DETAILED_SCENARIOS) {
    const f = buildDetailedForecast(data, { ...fast, scenario: preset.id });
    assert.deepEqual([f.nominalClock.zoneEntryDate, f.nominalClock.effectivePeakDate], expected[preset.id]);
    assert.equal(f.nominalClock.nominalPeakDate, '2029-10-06');
    assert.equal(f.path.length, base.path.length);
    assert.ok(f.path.every(row => row.price > 0 && Number.isFinite(row.price)));
    for (const event of f.events) {
      assert.equal(event.status, 'conditional-anchor');
      assert.equal(event.turningPointClaim, false);
      assert.equal(event.probability, null);
      assert.equal(event.inHorizon, event.date <= f.displayEnd);
    }
  }
  const endOfMonth = buildDetailedForecast(data, { ...fast, referencePeakDate: '2025-05-31', arrivalLeadMonths: 3, dwellMonths: 3 });
  assert.equal(endOfMonth.nominalClock.zoneEntryDate, '2029-02-28');
  assert.equal(endOfMonth.nominalClock.effectivePeakDate, '2029-05-31');
  assert.notEqual(shiftCalendarMonths(endOfMonth.nominalClock.zoneEntryDate, 3), endOfMonth.nominalClock.effectivePeakDate);
});

test('local extrema require an actual later threshold reversal within the simulated path', () => {
  const map = new Map(base.path.map(row => [row.date, row]));
  assert.ok(base.localTurns.length > 4);
  for (const turn of base.localTurns) {
    assert.ok(turn.date > base.asOf && turn.confirmationDate > turn.date && turn.confirmationDate <= base.displayEnd);
    const between = base.path.filter(row => row.date >= turn.date && row.date <= turn.confirmationDate);
    assert.equal(map.get(turn.date).price, turn.price);
    assert.equal(map.get(turn.confirmationDate).price, turn.confirmationPrice);
    if (turn.type === 'high') {
      assert.equal(Math.max(...between.map(row => row.price)), turn.price);
      assert.ok(turn.confirmationPrice <= turn.price * 0.88);
      assert.ok(between.slice(0, -1).every(row => row.price > turn.price * 0.88));
    } else {
      assert.equal(Math.min(...between.map(row => row.price)), turn.price);
      assert.ok(turn.confirmationPrice >= turn.price * 1.12);
      assert.ok(between.slice(0, -1).every(row => row.price < turn.price * 1.12));
    }
    assert.equal(turn.probability, null);
    assert.equal(turn.futureObservation, false);
  }
  const oneDay = buildDetailedForecast(data, { ...fast, displayEnd: '2026-10-21' });
  assert.deepEqual(oneDay.localTurns, []);
  assert.equal(oneDay.diagnostics.representativeMaximum.confirmedTurningPoint, false);
});

test('week aggregation preserves daily closes and flags incomplete edge bins', () => {
  assert.equal(base.weeklyPath.length, 158);
  assert.equal(base.weeklyPath[0].partial, true);
  assert.equal(base.weeklyPath.at(-1).partial, true);
  assert.equal(base.weeklyPath.at(-1).daysIncluded, 1);
  for (const week of base.weeklyPath) {
    const days = base.path.filter(row => row.date >= week.weekStartDate && row.date <= week.weekEndDate);
    assert.equal(week.price, days.at(-1).price);
    assert.equal(week.weekMinPrice, Math.min(...days.map(row => row.price)));
    assert.equal(week.weekMaxPrice, Math.max(...days.map(row => row.price)));
    assert.equal(week.completeCalendarWeek, days.length === 7);
  }
});

test('next-turn windows summarize first confirmed turns, not the largest later peak or trough', () => {
  const model = buildDetailedForecast(data, { ...fast, includeSamplePaths: true });
  const dates = model.path.map(point => point.date);
  const first = { high: [], low: [] };
  for (const sample of model.samplePaths) {
    const external = detectDirectionalChanges(sample.prices.map((price, i) => [dates[i], price]), { threshold: 0.12 }).pivots;
    for (const type of ['high', 'low']) {
      const turn = external.find(point => point.type === type && point.eventDate > model.asOf);
      if (turn) first[type].push(utcDay(turn.eventDate));
    }
  }
  for (const type of ['high', 'low']) {
    first[type].sort((a, b) => a - b);
    const window = model.diagnostics.firstTurnWindows[type];
    const i = (first[type].length - 1) / 2;
    const expected = (first[type][Math.floor(i)] + first[type][Math.ceil(i)]) / 2;
    assert.equal(window.medianDate, dateFromDay(Math.round(expected)));
    assert.equal(window.sampleCount, first[type].length);
    assert.equal(window.probability, null);
    assert.equal(window.calibrated, false);
    assert.ok(window.confirmationWindow.medianDate >= window.medianDate);
  }
  const selectedMdd = model.diagnostics.representativeMddPct;
  assert.ok(selectedMdd >= model.diagnostics.representativeSelectionMddRange.lowerQuartile - 1e-8);
  assert.ok(selectedMdd <= model.diagnostics.representativeSelectionMddRange.upperQuartile + 1e-8);
});

test('backtests rebuild past-only pools, compare identical cohorts, and retain failure cases', () => {
  const result = evaluateDetailedForecast(data, { sampleCount: 16 });
  assert.equal(result.numberOfDistinctCutoffs, 9);
  assert.equal(result.effectiveMacroCohorts, 3);
  assert.deepEqual(result.excluded, []);
  assert.equal(result.summary.find(row => row.horizon === '3y').distinctMacroCohorts, 2);
  assert.equal(result.genuineProspectiveValidation, false);
  assert.equal(result.parameterSelectionWasRetrospective, true);
  assert.equal(result.current2025And2026OutcomesIncluded, false);
  assert.equal(result.candidateHoldFailures, 1);
  for (const item of result.cases) {
    assert.equal(item.sourceWindowLastDate, item.cutoff);
    for (const score of item.results) {
      assert.ok(score.outcomeDate <= result.outcomeThrough);
      for (const model of ['representative', 'median', 'simpleCalendarBaseline', 'flat']) {
        close(score[model].absolutePercentageErrorPct, 100 * Math.abs(score[model].price / score.actualPrice - 1));
        close(score[model].absoluteLogError, Math.abs(Math.log(score[model].price / score.actualPrice)));
      }
    }
  }
  assert.ok(result.summary.some(row => row.median.mapePct > row.flat.mapePct));
  const changed = { ...data, prices: data.prices.map(([date, price]) => [date, date >= '2025-01-01' ? price * 100 : price]) };
  assert.deepEqual(evaluateDetailedForecast(changed, { sampleCount: 16 }), result);
});

test('changing a held-out outcome changes its error, never the forecast made before it', () => {
  const options = { sampleCount: 16, cutoffs: ['2018-12-30'], horizons: [{ id: '30d', days: 30 }] };
  const first = evaluateDetailedForecast(data, options);
  const outcomeDate = first.cases[0].results[0].outcomeDate;
  const changed = { ...data, prices: data.prices.map(([date, price]) => [date, date === outcomeDate ? price * 2 : price]) };
  const second = evaluateDetailedForecast(changed, options);
  const before = first.cases[0].results[0], after = second.cases[0].results[0];
  for (const name of ['representative', 'median', 'simpleCalendarBaseline', 'flat']) assert.equal(before[name].price, after[name].price);
  assert.notEqual(before.median.absolutePercentageErrorPct, after.median.absolutePercentageErrorPct);
});

test('an interior missing evaluation day is excluded instead of shifting the comparable MDD window', () => {
  const options = { sampleCount: 16, cutoffs: ['2018-12-30'], outcomeThrough: '2019-02-01' };
  const missing = { ...data, prices: data.prices.filter(([date]) => date !== '2019-01-15') };
  const result = evaluateDetailedForecast(missing, options);
  assert.equal(result.cases.length, 0);
  assert.equal(result.excluded.length, 1);
  assert.match(result.excluded[0].reason, /consecutive daily observations; missing 2019-01-15/);
  const truncated = { ...data, prices: data.prices.filter(([date]) => date <= '2019-01-31') };
  const completeKnownWindow = evaluateDetailedForecast(truncated, options);
  assert.equal(completeKnownWindow.cases.length, 1);
  assert.deepEqual(completeKnownWindow.excluded, []);
  assert.equal(completeKnownWindow.cases[0].mddComparisonEndDate, '2019-01-31');
  assert.equal(completeKnownWindow.cases[0].dailyEnvelopeEvaluated, 32);
});

test('invalid inputs and unsupported horizons fail explicitly; an unconfirmed new high is not a cycle anchor', () => {
  assert.throws(() => buildDetailedForecast(data, { ...fast, asOf: '2025-10-07' }), /20% decline/);
  assert.throws(() => buildDetailedForecast(data, { ...fast, arrivalLeadMonths: 12, dwellMonths: 0 }), /silent clamping/);
  assert.throws(() => buildDetailedForecast(data, { ...fast, volatilityMultiplier: 0 }), /volatilityMultiplier/);
  assert.throws(() => buildDetailedForecast(data, { ...fast, sampleCount: 1 }), /sampleCount/);
  assert.throws(() => buildDetailedForecast(data, { ...fast, displayEnd: '2031-01-01' }), /horizon/);
  const missing = { ...data, prices: data.prices.filter(([date]) => date !== '2019-04-01') };
  assert.throws(() => buildDetailedForecast(missing, fast), /consecutive/);
});

test('evaluation rejects duplicate origins and ambiguous or nonfuture horizon definitions', () => {
  const options = { sampleCount: 16, cutoffs: ['2018-12-30'], horizons: [{ id: '30d', days: 30 }] };
  assert.throws(() => evaluateDetailedForecast(data, { ...options, cutoffs: ['2018-12-30', '2018-12-30'] }), /distinct.*cutoff|cutoff.*distinct/i);
  for (const horizons of [
    [{ id: 'zero', days: 0 }],
    [{ id: 'negative', days: -1 }],
    [{ id: 'fraction', days: 1.5 }],
    [{ id: 'ambiguous', days: 30, months: 1 }],
    [{ id: 'same', days: 30 }, { id: 'same', days: 60 }],
    [{ id: 'first', days: 30 }, { id: 'duplicate', days: 30 }],
  ]) assert.throws(() => evaluateDetailedForecast(data, { ...options, horizons }), /horizon/i);
});

test('an origin with no observable future is excluded, never scored as zero drawdown', () => {
  for (const cutoff of ['2026-10-20', '2024-12-31']) {
    const result = evaluateDetailedForecast(data, { sampleCount: 16, cutoffs: [cutoff], outcomeThrough: '2024-12-31' });
    assert.equal(result.numberOfDistinctCutoffs, 0);
    assert.equal(result.effectiveMacroCohorts, 0);
    assert.deepEqual(result.cases, []);
    assert.equal(result.excluded.length, 1);
    assert.match(result.excluded[0].reason, /subsequent|future|outcome/i);
  }
  const unobserved = evaluateDetailedForecast(data, { sampleCount: 16, cutoffs: [data.prices.at(-1)[0]], outcomeThrough: '2027-12-31' });
  assert.equal(unobserved.numberOfDistinctCutoffs, 0);
  assert.equal(unobserved.current2025And2026OutcomesIncluded, false);
});

test('evaluation reports actual included outcome dates, not merely the requested ceiling', () => {
  const priorOnly = evaluateDetailedForecast(data, { sampleCount: 16, cutoffs: ['2018-12-30'], outcomeThrough: '2026-10-20' });
  assert.equal(priorOnly.current2025And2026OutcomesIncluded, false);
  const current = evaluateDetailedForecast(data, { sampleCount: 16, cutoffs: ['2026-06-30'], outcomeThrough: '2026-10-20' });
  assert.equal(current.current2025And2026OutcomesIncluded, true);
  assert.ok(current.cases.some(item => item.dailyEnvelopeEvaluated > 0));
});

test('a visible bridge endpoint is the same imposed price in every stochastic draw', () => {
  const model = buildDetailedForecast(data, { ...fast, asOf: '2020-01-01', displayEnd: '2022-12-16', includeSamplePaths: true });
  assert.equal(model.displayEnd, model.assumptions.bridgeTerminalDate);
  assert.equal(model.diagnostics.terminalBridgeOutsideHorizon, false);
  for (const sample of model.samplePaths) close(sample.prices.at(-1), model.assumptions.bridgeTerminalPrice);
  close(model.path.at(-1).lower, model.path.at(-1).upper);
});

test('a supported custom short horizon does not require an unsupported three-year model window', () => {
  const cutoff = '2020-01-01';
  const result = evaluateDetailedForecast(data, { ...fast, cutoffs: [cutoff], horizons: [{ id: '30d', days: 30 }] });
  assert.deepEqual(result.excluded, []);
  assert.equal(result.numberOfDistinctCutoffs, 1);
  assert.equal(result.cases[0].results[0].outcomeDate, '2020-01-31');
  assert.equal(result.cases[0].mddComparisonEndDate, '2020-01-31');
  assert.equal(result.cases[0].dailyEnvelopeEvaluated, 30);
  const expected = buildDetailedForecast(data, { ...fast, asOf: cutoff, referenceDate: '2020-01-02', displayEnd: '2020-01-31' });
  assert.equal(result.cases[0].results[0].representative.price, expected.path.at(-1).price);
  assert.equal(result.cases[0].results[0].median.price, expected.path.at(-1).median);
  assert.throws(() => evaluateDetailedForecast(data, { ...fast, horizons: [{ id: 'too-long', days: 1121 }] }), /horizon/i);
  assert.throws(() => evaluateDetailedForecast(data, { ...fast, horizons: [{ id: 'too-long', months: 37 }] }), /horizon/i);
});

test('custom evaluation uses its last requested endpoint while each bridge draw keeps its prefix', () => {
  const cutoff = '2020-01-01';
  const options = { ...fast, asOf: cutoff, referenceDate: '2020-01-02', includeSamplePaths: true };
  const short = buildDetailedForecast(data, { ...options, displayEnd: '2020-01-31' });
  const long = buildDetailedForecast(data, { ...options, displayEnd: '2020-03-31' });
  for (let i = 0; i < short.samplePaths.length; i++) assert.deepEqual(short.samplePaths[i].prices, long.samplePaths[i].prices.slice(0, short.path.length));
  const result = evaluateDetailedForecast(data, { ...fast, cutoffs: [cutoff], horizons: [{ id: '90d', days: 90 }, { id: '30d', days: 30 }] });
  assert.deepEqual(result.excluded, []);
  assert.equal(result.cases[0].mddComparisonEndDate, '2020-03-31');
  assert.equal(result.cases[0].dailyEnvelopeEvaluated, 90);
  assert.deepEqual(result.cases[0].results.map(item => item.outcomeDate), ['2020-03-31', '2020-01-31']);
  const unavailable = evaluateDetailedForecast(data, { ...fast, cutoffs: [cutoff], horizons: [{ id: '3y', months: 36 }] });
  assert.equal(unavailable.numberOfDistinctCutoffs, 0);
  assert.match(unavailable.excluded[0].reason, /exceeds the next assumed low/);
});
