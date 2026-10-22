import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { utcDay, dateFromDay } from '../dist/cycle-engine.js';
import {
  aggregateCloseBars, computeRollingStates, detectDirectionalChanges, getMacroCycles,
  theilSenTrend, fibonacciLevels, confirmedSwingRetracement, evaluateFibonacci,
  analyzeMarketStructure, STATES,
} from '../dist/market-structure.js';

const data = JSON.parse(await readFile(new URL('./fixtures/btc-daily-2026-10-20.json', import.meta.url), 'utf8'));
const rows = (prices, start = '2020-01-01') => prices.map((price, index) => [dateFromDay(utcDay(start) + index), price]);
const close = (a, b, tolerance = 1e-10) => assert.ok(Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(b)), `${a} != ${b}`);

test('calendar MDD and period return carry in the previous close', () => {
  const periods = aggregateCloseBars([
    ['2023-12-31', 100], ['2024-01-01', 80], ['2024-01-02', 90],
  ], { frequency: 'monthly' });
  assert.equal(periods[0].returnPct, null);
  const january = periods[1];
  close(january.returnPct, -10);
  close(january.firstToLastReturnPct, 12.5);
  close(january.maxDrawdownPct, -20);
  assert.equal(january.drawdownPeakDate, '2023-12-31');
  assert.equal(january.drawdownTroughDate, '2024-01-01');
  assert.equal(january.drawdownSeededWithPriorClose, true);
  assert.equal(january.open, 80);
  assert.equal(january.high, 90);
  assert.equal(january.low, 80);
  assert.equal(january.close, 90);
  assert.match(january.ohlcDefinition, /not intraday/);
  assert.equal(january.complete, false);
  const quarter = aggregateCloseBars([
    ['2024-03-31', 100], ['2024-04-01', 90], ['2024-04-02', 70], ['2024-04-03', 105],
  ], { frequency: 'quarterly' })[1];
  close(quarter.maxDrawdownPct, -30);
  close(quarter.returnPct, 5);
  assert.equal(quarter.newHighDays, 1);
});

test('UTC calendar bins honor leap days and exclude partial weekly runtime samples', () => {
  const input = rows([100, 101, 102, 103, 104, 105, 106, 107, 108], '2024-02-26');
  const bars = aggregateCloseBars(input, { frequency: 'weekly' });
  assert.equal(bars.length, 2);
  assert.equal(bars[0].startDate, '2024-02-26');
  assert.equal(bars[0].endDate, '2024-03-03');
  assert.equal(bars[0].observations, 7);
  assert.equal(bars[0].complete, true);
  assert.equal(bars[1].rightCensored, true);
  assert.equal(bars[1].observations, 2);
  assert.equal(computeRollingStates(input, { frequency: 'weekly' }).points.length, 1);
  assert.equal(computeRollingStates(input, { frequency: 'weekly' }).current.date, '2024-03-03');
  const february = aggregateCloseBars(rows(Array(29).fill(100), '2024-02-01'), { frequency: 'monthly' })[0];
  assert.equal(february.expectedDays, 29);
  assert.equal(february.complete, true);
  assert.equal(february.realizedVolPct, 0);
  const gap = aggregateCloseBars([['2024-02-01', 100], ['2024-02-03', 90]], { frequency: 'monthly' })[0];
  assert.equal(gap.missingDays, 1);
  assert.equal(gap.continuous, false);
  assert.equal(gap.realizedVolPct, null);
});

test('directional changes separate event date from first knowable confirmation', () => {
  const input = rows([100, 110, 125, 124, 111, 105, 118, 120, 100, 90, 100, 103]);
  const result = detectDirectionalChanges(input, { threshold: 0.10 });
  assert.deepEqual(result.pivots.map((p) => [p.type, p.eventDate, p.confirmationDate]), [
    ['low', '2020-01-01', '2020-01-02'],
    ['high', '2020-01-03', '2020-01-05'],
    ['low', '2020-01-06', '2020-01-07'],
    ['high', '2020-01-08', '2020-01-09'],
    ['low', '2020-01-10', '2020-01-11'],
  ]);
  assert.equal(result.pivots[0].leftCensored, true);
  assert.equal(result.pivots[1].lagDays, 2);
  assert.equal(result.pivots[1].knownAt, '2020-01-05');
  assert.equal(result.pivots[1].earliestKnowableUtc, '2020-01-06T00:00:00.000Z');
  assert.equal(result.current.unconfirmedCandidate.confirmed, false);
  assert.equal(result.current.unconfirmedCandidate.eventDate, '2020-01-12');
  assert.equal(detectDirectionalChanges(input.slice(0, 4), { threshold: .10 }).pivots.some((p) => p.type === 'high'), false);
  for (const pivot of result.pivots) assert.ok(pivot.eventDate <= pivot.confirmationDate);
});

test('appending future prices cannot rewrite causal labels or confirmed pivots', () => {
  for (const frequency of ['daily', 'weekly']) {
    const fullStates = computeRollingStates(data, { frequency });
    const fullPivots = detectDirectionalChanges(data, { frequency });
    for (const cutoff of ['2011-06-09', '2013-04-10', '2020-03-15', '2021-05-01', '2026-08-01']) {
      const prefix = data.prices.filter(([date]) => date <= cutoff);
      const states = computeRollingStates(prefix, { frequency });
      const pivots = detectDirectionalChanges(prefix, { frequency });
      assert.deepEqual(states.points, fullStates.points.filter((p) => p.date <= cutoff));
      assert.deepEqual(pivots.pivots, fullPivots.pivots.filter((p) => p.confirmationDate <= cutoff));
      const mutatedFuture = data.prices.map(([date, price], i) => [date, date > cutoff ? (i % 2 ? 1 : 1e8) : price]);
      assert.deepEqual(computeRollingStates(mutatedFuture, { frequency, asOf: cutoff }).points, states.points);
      assert.deepEqual(detectDirectionalChanges(mutatedFuture, { frequency, asOf: cutoff }).pivots, pivots.pivots);
    }
  }
});

test('tuple and normalized object inputs agree, gaps force fresh state warmup', () => {
  const input = rows([100, 101, 102, 103, 102, 100, 99, 101, 104, 103]);
  const objects = input.map(([date, price]) => ({ date, price }));
  assert.deepEqual(computeRollingStates(input, { shortWindow: 2, longWindow: 4 }), computeRollingStates(objects, { shortWindow: 2, longWindow: 4 }));
  const gap = input.filter((_, i) => i !== 6);
  const gapResult = computeRollingStates(gap, { shortWindow: 2, longWindow: 4 });
  const state = gapResult.points.at(-1);
  assert.equal(state.state, 'warmup');
  assert.equal(gapResult.episodes.find((e) => e.endDate === '2020-01-06').rightCensored, true);
  assert.equal(gapResult.episodes.find((e) => e.startDate === '2020-01-08').leftCensored, true);
  assert.throws(() => computeRollingStates(input, { threshold: 0 }), /threshold/);
  assert.throws(() => detectDirectionalChanges(input, { threshold: 1 }), /threshold/);
  assert.throws(() => aggregateCloseBars(input, { frequency: 'intraday' }), /frequency/);
  assert.throws(() => computeRollingStates([['2024-02-30', 1]]), /calendar/);
});

test('retrospective macro windows preserve early history and censor the latest trough', () => {
  const cycles = getMacroCycles(data).cycles;
  assert.deepEqual(cycles.map((c) => [c.peakYear, c.bullDays, c.bearDays]), [
    [2011, 325, 163], [2013, 747, 406], [2017, 1067, 364], [2021, 1059, 366], [2025, 1062, 267],
  ]);
  assert.equal(cycles[0].leftCensored, true);
  assert.equal(cycles[0].complete, false);
  assert.equal(cycles.at(-1).rightCensored, true);
  assert.equal(cycles.at(-1).endIsCandidate, true);
  assert.equal(cycles.at(-1).recoverySinceCandidateDays, 112);
  assert.equal(cycles.at(-1).start.date, '2022-11-09');
  assert.equal(cycles.at(-1).end.date, '2026-06-30');
  assert.ok(cycles.every((c) => c.boundariesRetrospective));
  for (const cycle of cycles) {
    close(cycle.troughAtNominalMonth, 48 * cycle.cycleDays / cycle.nominal48MonthDays);
    assert.equal(cycle.bullDays + cycle.bearDays, cycle.cycleDays);
  }
});

test('Theil–Sen uses cycles and exposes leave-one-cycle sign instability', () => {
  const trend = theilSenTrend([{ id: '2017', value: 1067 }, { id: '2021', value: 1059 }, { id: '2025', value: 1062 }]);
  assert.equal(trend.nCycles, 3);
  assert.equal(trend.slopeDaysPerCycle, -2.5);
  assert.equal(trend.leaveOneOutMin, -8);
  assert.equal(trend.leaveOneOutMax, 3);
  assert.equal(trend.leaveOneOutDirectionStable, false);
  assert.equal(trend.inferentialPValue, null);
  assert.equal(trend.confidenceInterval, null);
  assert.equal(theilSenTrend([{ id: 'one', value: 100 }]).slopeDaysPerCycle, null);
  assert.throws(() => theilSenTrend([{ value: 100, x: 0 }, { value: 90, x: 0 }]), /distinct/);
});

test('linear and log retracements use the last confirmed swing only', () => {
  close(fibonacciLevels(100, 200).find((p) => p.ratio === .5).price, 150);
  close(fibonacciLevels(100, 200, { scale: 'log' }).find((p) => p.ratio === .5).price, Math.sqrt(20000));
  close(fibonacciLevels(200, 100).find((p) => p.ratio === .5).price, 150);
  const input = rows([120, 100, 112, 150, 200, 178, 160, 149, 158]);
  const pivots = detectDirectionalChanges(input, { threshold: .10 }).pivots;
  const before = confirmedSwingRetracement(pivots, '2020-01-05', 200);
  assert.equal(before.end.date, '2020-01-02');
  const after = confirmedSwingRetracement(pivots, '2020-01-06', 178);
  assert.equal(after.end.date, '2020-01-05');
  assert.equal(after.knownAt, '2020-01-06');
  assert.equal(after.linear.find((p) => p.ratio === .5).price, 150);
  assert.throws(() => fibonacciLevels(0, 100), /positive/);
  assert.throws(() => fibonacciLevels(100, 100), /distinct/);
});

test('Fibonacci evaluation excludes preconfirmation crossings and incomplete follow-up wins', () => {
  const prices = [120, 100, 112, 150, 200, 178, 160, 149, 158, ...Array(61).fill(160)];
  const input = rows(prices);
  const target = (analysis) => analysis.trials.find((t) => t.group === 'fibonacci' && t.ratio === .5 && t.anchorEndDate === '2020-01-05');
  const full = evaluateFibonacci(input, { threshold: .10, includeTrials: true });
  assert.equal(target(full).touchDate, '2020-01-08');
  assert.equal(target(full).status, 'rejected');
  assert.equal(target(full).outcomeDate, '2020-01-09');
  const truncated = evaluateFibonacci(input.slice(0, 10), { threshold: .10, includeTrials: true });
  assert.equal(target(truncated).status, 'followup-censored');
  assert.equal(target(truncated).outcomeDate, null);
  const slowConfirmation = evaluateFibonacci(input, { threshold: .20, includeTrials: true });
  const crossed = slowConfirmation.trials.find((t) => t.group === 'fibonacci' && t.ratio === .236 && t.anchorEndDate === '2020-01-05');
  assert.equal(crossed.status, 'crossed-before-confirmation');
  assert.equal(full.parameters.fullFollowupRequiredEvenIfBarrierHitEarly, true);
  assert.equal(full.inference.pValue, null);
  assert.equal(full.inference.controlsArePlacebosNotAStatisticalNullDistribution, true);
  for (const group of [full.fibonacci, full.control]) {
    assert.equal(group.completedTouches, group.rejected + group.failed + group.unresolved);
    assert.equal(Object.values(group.counts).reduce((a, b) => a + b, 0), group.totalLevels);
  }
});

test('combined analysis reconciles durations, schema, partial periods and sensitivity', () => {
  const result = analyzeMarketStructure(data, { includeFibonacciSensitivity: false });
  assert.equal(result.coverage.observations, 5939);
  assert.equal(result.coverage.missingDayCount, 0);
  assert.equal(result.monthly.length, 196);
  assert.equal(result.quarterly.length, 66);
  assert.equal(result.currentState.date, '2026-10-20');
  assert.equal(result.currentWeeklyState.date, '2026-10-18');
  assert.equal(result.monthly.at(-1).complete, false);
  assert.equal(result.quarterly.at(-1).expectedDays, 92);
  assert.equal(result.monthly.at(-1).fibonacciAnchor.knownAt, '2026-07-21');
  assert.equal(result.calendarBlocks.length, 5);
  assert.ok(result.calendarBlocks.every((b) => b.isMarketCycleClaim === false));
  assert.equal(result.calendarBlocks[0].leftCensored, true);
  assert.equal(result.calendarBlocks.at(-1).rightCensored, true);
  assert.equal(result.periodComparisons.calendarBlocks.at(-1).monthly.completedPeriods, 9);
  assert.equal(result.periodComparisons.calendarBlocks.at(-1).quarterly.completedPeriods, 3);
  for (const cycle of result.macroCycles) {
    const count = (phase) => Object.values(phase.stateCounts).reduce((a, b) => a + b, 0);
    assert.equal(count(cycle.stateSummary.bull), cycle.bullDays);
    assert.equal(count(cycle.stateSummary.bear), cycle.bearDays);
    assert.equal(count(cycle.stateSummary.allObserved), cycle.observedWindowDays);
    if (cycle.stateSummary.recovery) assert.equal(count(cycle.stateSummary.recovery), cycle.recoverySinceCandidateDays);
  }
  assert.ok(result.dailyStates.every((p) => STATES.includes(p.state) && p.knownAt === p.date));
  assert.deepEqual(result.sensitivity.map((s) => s.confirmedPivotCount), [418, 248, 126, 153, 115, 71]);
  assert.equal(result.doublePeakExamples[1].firstHalfPeak.date, '2021-04-13');
  close(result.doublePeakExamples[1].interimDrawdownPct, -53.08320869786175);
  const latest = result.macroCycles.at(-1);
  close(latest.risk.bullMaxDrawdownPct, -28.049027604886778);
});
