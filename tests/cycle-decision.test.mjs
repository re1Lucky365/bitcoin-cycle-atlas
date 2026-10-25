import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { buildCycleDecisionTable, CYCLE_ACTIONS } from '../dist/cycle-decision.js';
import { buildCycleMilestones } from '../dist/cycle-milestones.js';
import { dateFromDay, utcDay } from '../dist/cycle-engine.js';

const data = JSON.parse(await readFile(new URL('./fixtures/btc-daily-2026-10-20.json', import.meta.url), 'utf8'));
const observed = buildCycleMilestones(data);
const result = buildCycleDecisionTable({ prices: data, milestones: observed });
const prices = (values, start = '2024-01-01') => values.map((price, index) => [dateFromDay(utcDay(start) + index), price]);
function simpleMilestones(input, types = ['cycle-top', 'bottom'], options = {}) {
  const markers = types.map((type, index) => {
    const row = input[index ? input.length - 1 : 0];
    return { id: `${type}:${row[0]}`, type, date: row[0], price: row[1], kind: 'observed', selectionKind: 'observed', provisional: options.provisional ?? false, cycleId: 'sample' };
  });
  return { asOf: input.at(-1)[0], markers, intervals: [], cycles: [{ id: 'sample', label: '표본', kind: 'observed', markers: Object.fromEntries(markers.map(marker => [marker.type, marker])) }] };
}
function scenarioFixture() {
  const day = utcDay(data.prices.at(-1)[0]), anchor = data.prices.at(-1)[1];
  const path = Array.from({ length: 1001 }, (_, index) => ({ date: dateFromDay(day + index), price: anchor * Math.exp(index / 650 + .3 * Math.sin(index / 37)) }));
  const forecast = { asOf: data.prices.at(-1)[0], path, nominalClock: { effectivePeakDate: dateFromDay(day + 720), nextLowDate: dateFromDay(day + 1000), zoneEntryDate: dateFromDay(day + 620) }, scenario: { id: 'sample' } };
  return { forecast, milestones: buildCycleMilestones(data, { forecast }) };
}

test('every historical row names an exact chart point and the review applies at that point', () => {
  const byId = new Map(observed.markers.map(marker => [marker.id, marker]));
  const points = result.rows.filter(row => row.action.scope === 'end-marker');
  assert.equal(points.length, observed.markers.length);
  assert.equal(new Set(points.map(row => row.id)).size, points.length);
  for (const row of points) {
    const marker = byId.get(row.chart.markerId);
    assert.equal(row.endDate, marker.date);
    assert.equal(row.endPrice, marker.price);
    assert.equal(row.phaseId, marker.type);
    assert.equal(row.action.scope, 'end-marker');
    assert.equal(row.selectionIsRetrospective, true);
    assert.equal(row.days, utcDay(row.endDate) - utcDay(row.startDate));
    assert.equal(row.weeks, row.days / 7);
    assert.ok(row.markerIds.every(id => byId.has(id)));
  }
});

test('actual marker order is retained when ATH precedes a middle top', () => {
  const recovery = result.rows.find(row => row.endDate === '2024-03-04');
  const middle = result.rows.find(row => row.endDate === '2024-03-13');
  assert.equal(recovery.phaseId, 'ath');
  assert.equal(middle.phaseId, 'mid-top');
  assert.equal(middle.startDate, recovery.endDate);
  assert.ok(result.rows.filter(row => !row.current).every(row => row.days >= 0));
});

test('completed extrema may strengthen review but provisional extrema cannot', () => {
  const closedBottom = result.rows.find(row => row.endDate === '2022-11-09');
  const closedTop = result.rows.find(row => row.endDate === '2021-11-08');
  const openTop = result.rows.find(row => row.endDate === '2025-10-06');
  const openBottom = result.rows.find(row => row.endDate === '2026-06-30');
  assert.equal(closedBottom.action.id, 'strong-buy');
  assert.equal(closedTop.action.id, 'strong-sell');
  assert.equal(openTop.action.id, 'sell');
  assert.equal(openBottom.action.id, 'buy');
  assert.equal(openBottom.evidenceKind, 'provisional');
  assert.ok(result.rows.every(row => Object.hasOwn(CYCLE_ACTIONS, row.action.id)));
});

test('first marker has no invented interval return or prior price evidence for stronger review', () => {
  const first = result.rows.find(row => row.action.scope === 'end-marker');
  assert.equal(first.days, 0);
  assert.equal(first.returnPct, null);
  assert.equal(first.mddPct, null);
  assert.notEqual(first.action.strength, 'strong');
});

test('interval MDD resets at the displayed start and respects peak before trough', () => {
  const input = prices([120, 60, 200, 190, 180]);
  const model = buildCycleDecisionTable({ prices: input, milestones: simpleMilestones(input) });
  const row = model.rows[1];
  assert.equal(row.startDate, input[0][0]);
  assert.equal(row.endDate, input.at(-1)[0]);
  assert.equal(row.returnPct, 50);
  assert.equal(row.mddPct, -50);
  assert.equal(row.mddPeakDate, input[0][0]);
  assert.equal(row.mddTroughDate, input[1][0]);
  assert.equal(row.coverageComplete, true);
  // Taking the highest and lowest price without time order would give -70%.
  assert.notEqual(row.mddPct, -70);
});

test('a missing day is disclosed without inventing flat prices or a sideways state', () => {
  const input = prices(Array.from({ length: 29 }, () => 100)).filter((_, index) => index !== 10);
  const model = buildCycleDecisionTable({ prices: input, milestones: simpleMilestones(input) });
  assert.equal(model.rows[1].coverageComplete, false);
  assert.match(model.rows[1].note, /누락/);
  assert.equal(model.current.action.id, 'unavailable');
  assert.equal(model.current.range28dPct, null);
});

test('current sideways description uses only 28 contiguous closes and no macro marker', () => {
  const input = prices(Array.from({ length: 28 }, (_, index) => index % 2 ? 103 : 100));
  const milestones = { asOf: input.at(-1)[0], markers: [], cycles: [], intervals: [] };
  const model = buildCycleDecisionTable({ prices: input, milestones });
  assert.equal(model.current.action.id, 'sideways');
  assert.equal(model.current.action.scope, 'as-of');
  assert.equal(model.current.selectionIsRetrospective, false);
  assert.ok(Math.abs(model.current.range28dPct - 3) < 1e-10);
  assert.equal(model.rows.length, 1);
});

test('wide or trending current prices do not get mislabeled sideways or calendar buy', () => {
  for (const input of [prices(Array.from({ length: 28 }, (_, index) => 100 + index)), prices(Array.from({ length: 28 }, (_, index) => index % 2 ? 120 : 100)), prices([100])]) {
    const milestones = { asOf: input.at(-1)[0], markers: [], cycles: [] };
    const current = buildCycleDecisionTable({ prices: input, milestones }).current;
    assert.equal(current.action.id, 'unavailable');
    assert.equal(current.action.strength, 'none');
  }
});

test('future rows retain scenario provenance and never show realized return or MDD', () => {
  const { forecast, milestones } = scenarioFixture();
  const model = buildCycleDecisionTable({ prices: data, milestones, forecast });
  const future = model.rows.filter(row => row.evidenceKind === 'scenario');
  assert.ok(future.length > 0);
  for (const row of future) {
    assert.ok(row.endDate > model.asOf);
    assert.equal(row.provisional, true);
    assert.equal(row.returnPct, null);
    assert.equal(row.mddPct, null);
    assert.match(row.basis, /가정/);
    assert.match(row.action.reason, /가정/);
    assert.ok(['scenario', 'mixed'].includes(row.kind));
  }
  assert.deepEqual(model.rows.filter(row => row.evidenceKind !== 'scenario'), result.rows);
});

test('an incomplete future window cannot strengthen low or high review', () => {
  const { forecast, milestones } = scenarioFixture();
  milestones.futureStatus.completeWindow = false;
  const model = buildCycleDecisionTable({ prices: data, milestones, forecast });
  assert.ok(model.rows.filter(row => row.evidenceKind === 'scenario').every(row => row.action.strength !== 'strong'));
});

test('a point chosen by a future cycle can have observed prices without becoming a historical role', () => {
  const { forecast } = scenarioFixture();
  forecast.nominalClock.effectivePeakDate = dateFromDay(utcDay(forecast.asOf) + 90);
  forecast.nominalClock.nextLowDate = dateFromDay(utcDay(forecast.asOf) + 180);
  const milestones = buildCycleMilestones(data, { forecast });
  const selectedObserved = milestones.markers.filter(marker => marker.kind === 'observed' && marker.selectionKind === 'scenario');
  assert.ok(selectedObserved.length > 0);
  const model = buildCycleDecisionTable({ prices: data, milestones, forecast });
  for (const marker of selectedObserved) {
    const found = model.rows.filter(row => row.chart.markerId === marker.id);
    assert.equal(found.length, 1);
    assert.equal(found[0].kind, 'observed');
    assert.equal(found[0].evidenceKind, 'scenario');
    assert.match(found[0].basis, /관측 가격.*가정/);
    assert.equal(found[0].returnPct, null);
    assert.equal(found[0].mddPct, null);
  }
});

test('scenario changes cannot alter current causal description', () => {
  const { forecast, milestones } = scenarioFixture();
  assert.throws(() => buildCycleDecisionTable({ prices: data, milestones }), /require.*forecast/);
  const model = buildCycleDecisionTable({ prices: data, milestones, forecast });
  assert.deepEqual(model.current, result.current);
});

test('unrepresentable price ratios fail instead of presenting arithmetic underflow as a total loss', () => {
  for (const values of [[Number.MAX_VALUE, Number.MIN_VALUE], [Number.MIN_VALUE, Number.MAX_VALUE]]) {
    const input = prices(values);
    assert.throws(() => buildCycleDecisionTable({ prices: input, milestones: simpleMilestones(input) }), /finite numeric range/);
  }
});

test('historical asOf equals a physically truncated dataset and cannot see later prices', () => {
  const asOf = '2024-08-06', prefix = { prices: data.prices.filter(([date]) => date <= asOf) };
  const a = buildCycleDecisionTable({ prices: data, milestones: buildCycleMilestones(data, { asOf }), asOf });
  const b = buildCycleDecisionTable({ prices: prefix, milestones: buildCycleMilestones(prefix) });
  assert.deepEqual(a, b);
  assert.ok(a.rows.every(row => row.endDate <= asOf));
  assert.notEqual(a.current.action.strength, 'strong');
});

test('stale annotations, revised observed points, and mismatched scenario paths fail closed', () => {
  assert.throws(() => buildCycleDecisionTable({ prices: data, milestones: { ...observed, asOf: '2026-10-19' } }), /cutoff/);
  const altered = structuredClone(observed);
  altered.markers[0].price *= 2;
  assert.throws(() => buildCycleDecisionTable({ prices: data, milestones: altered }), /observed price/);
  const { forecast, milestones } = scenarioFixture();
  const future = milestones.markers.find(marker => marker.kind === 'scenario');
  future.price *= 2;
  assert.throws(() => buildCycleDecisionTable({ prices: data, milestones, forecast }), /selected scenario path/);
});

test('generated observed paths cross-check interval MDD against all ordered peak/trough pairs', () => {
  let seed = 6419;
  for (let sample = 0; sample < 120; sample++) {
    const values = Array.from({ length: 2 + sample % 17 }, () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return 1 + seed % 10000;
    });
    const input = prices(values), model = buildCycleDecisionTable({ prices: input, milestones: simpleMilestones(input) });
    let expected = 0;
    for (let left = 0; left < values.length; left++) for (let right = left; right < values.length; right++) expected = Math.min(expected, (values[right] / values[left] - 1) * 100);
    assert.ok(Math.abs(model.rows[1].mddPct - expected) <= 1e-12);
    assert.ok(model.rows[1].mddPeakDate <= model.rows[1].mddTroughDate);
    assert.ok(model.rows[1].mddPct <= 0 && model.rows[1].mddPct >= -100);
  }
});

const emptyMilestones = input => ({ asOf: input.at(-1)[0], markers: [], intervals: [], cycles: [] });
const rangeRows = model => model.rows.filter(row => row.phaseId === 'range');

test('historical sideways periods start at the first causal qualifying end-date and need seven qualifiers', () => {
  for (const [length, count] of [[33, 0], [34, 1]]) {
    const input = prices(Array(length).fill(100));
    const model = buildCycleDecisionTable({ prices: input, milestones: emptyMilestones(input) });
    assert.equal(rangeRows(model).length, count);
    if (count) {
      const row = rangeRows(model)[0];
      assert.equal(row.startDate, input[27][0]);
      assert.equal(row.endDate, input[33][0]);
      assert.equal(row.minimumRunKnownAt, input[33][0]);
      assert.equal(row.qualifyingObservations, 7);
      assert.equal(row.minimumRunObservations, 7);
      assert.equal(row.days, 6);
      assert.equal(row.action.id, 'sideways');
      assert.equal(row.action.scope, 'period');
      assert.equal(row.selectionIsRetrospective, false);
      assert.equal(row.rightCensored, true);
      assert.equal(row.rangeWindowStart, input[0][0]);
      assert.equal(row.coverageComplete, true);
      assert.equal(row.observationCount, 7);
    }
  }
});

test('a missing day breaks sideways episodes and requires a fresh contiguous lookback', () => {
  const all = prices(Array(80).fill(100)), input = all.filter((_, i) => i !== 40);
  const episodes = rangeRows(buildCycleDecisionTable({ prices: input, milestones: emptyMilestones(input) }));
  assert.equal(episodes.length, 2);
  assert.equal(episodes[0].startDate, all[27][0]);
  assert.equal(episodes[0].endDate, all[39][0]);
  assert.equal(episodes[0].rightCensored, true);
  assert.equal(episodes[1].startDate, all[68][0]);
  assert.equal(episodes[1].endDate, all[79][0]);
  assert.ok(episodes.every(row => row.coverageComplete));
  assert.ok(episodes.every(row => row.qualifyingObservations >= 7));
});

function flatConditional(observedCount = 40, futureCount = 20, horizonCount = futureCount) {
  const all = prices(Array(observedCount + futureCount).fill(100)), input = all.slice(0, observedCount);
  const forecast = { asOf: input.at(-1)[0], scenario: { id: 'flat-scenario' }, path: all.slice(observedCount - 1) };
  const milestones = { ...emptyMilestones(input), futureStatus: { available: true, through: all[observedCount + horizonCount - 1][0], completeWindow: true } };
  return { prices: input, forecast, milestones, all };
}

test('observed and future sideways episodes split at the cutoff and future risk stays empty', () => {
  const fixture = flatConditional(), model = buildCycleDecisionTable(fixture);
  const episodes = rangeRows(model), actual = episodes.find(row => row.evidenceKind !== 'scenario'), future = episodes.find(row => row.evidenceKind === 'scenario');
  assert.equal(actual.endDate, model.asOf);
  assert.equal(actual.startDate, fixture.all[27][0]);
  assert.equal(actual.qualifyingObservations, 13);
  assert.equal(actual.mddPct, 0);
  assert.equal(future.startDate, fixture.all[40][0]);
  assert.equal(future.endDate, fixture.all[59][0]);
  assert.equal(future.qualifyingObservations, 20);
  assert.equal(future.minimumRunKnownAt, fixture.all[46][0]);
  assert.equal(future.kind, 'mixed');
  assert.equal(future.scenarioId, 'flat-scenario');
  for (const field of ['returnPct', 'mddPct', 'mddPeakDate', 'mddTroughDate']) assert.equal(future[field], null);
  assert.equal(future.provisional, true);
  assert.equal(future.selectionIsRetrospective, false);
  assert.equal(future.action.strength, 'none');
  assert.deepEqual(model.rows.filter(row => row.evidenceKind !== 'scenario'), buildCycleDecisionTable({ prices: fixture.prices, milestones: emptyMilestones(fixture.prices) }).rows);
});

test('future sideways episodes are bounded to the explicit near-cycle horizon and seven future qualifiers', () => {
  const short = flatConditional(40, 1000, 6);
  assert.equal(rangeRows(buildCycleDecisionTable(short)).filter(row => row.evidenceKind === 'scenario').length, 0);
  const bounded = flatConditional(40, 1000, 7);
  const episodes = rangeRows(buildCycleDecisionTable(bounded)).filter(row => row.evidenceKind === 'scenario');
  assert.equal(episodes.length, 1);
  assert.equal(episodes[0].endDate, bounded.milestones.futureStatus.through);
  assert.equal(episodes[0].qualifyingObservations, 7);
  assert.equal(episodes[0].rightCensored, true);
  bounded.milestones.futureStatus.available = false;
  assert.equal(rangeRows(buildCycleDecisionTable(bounded)).filter(row => row.evidenceKind === 'scenario').length, 0);
  delete bounded.milestones.futureStatus;
  assert.equal(rangeRows(buildCycleDecisionTable(bounded)).filter(row => row.evidenceKind === 'scenario').length, 0);
});

test('changing future sideways path never changes observed episodes', () => {
  const fixture = flatConditional(), before = buildCycleDecisionTable(fixture);
  const changed = structuredClone(fixture);
  changed.forecast.path = changed.forecast.path.map(([date, value], i) => [date, i ? value * 10 ** (i / 10) : value]);
  const after = buildCycleDecisionTable(changed);
  assert.deepEqual(after.rows.filter(row => row.evidenceKind !== 'scenario'), before.rows.filter(row => row.evidenceKind !== 'scenario'));
  assert.equal(rangeRows(after).filter(row => row.evidenceKind === 'scenario').length, 0);
});

test('sideways period MDD uses only the displayed run dates, not its 28-close lookback', () => {
  const values = Array(35).fill(100); values[0] = 111; values[29] = 105; values[30] = 98;
  const input = prices(values), model = buildCycleDecisionTable({ prices: input, milestones: emptyMilestones(input) });
  const episode = rangeRows(model)[0];
  assert.equal(episode.startDate, input[28][0]);
  assert.equal(episode.endDate, input[34][0]);
  assert.ok(Math.abs(episode.mddPct - (98 / 105 - 1) * 100) < 1e-10);
  assert.equal(episode.mddPeakDate, input[29][0]);
  assert.equal(episode.mddTroughDate, input[30][0]);
  assert.notEqual(episode.mddPeakDate, input[0][0]);
});

test('a shared historical bottom remains selectable in both adjacent chart cycles', () => {
  const bottom = result.rows.find(row => row.chart.markerId === 'bottom:observed:2022-11-09');
  assert.deepEqual(bottom.cycleIds, ['peak-2021', 'peak-2025']);
  assert.equal(result.rows.filter(row => row.chart.markerId === bottom.chart.markerId).length, 1);
  const { forecast, milestones } = scenarioFixture();
  const model = buildCycleDecisionTable({ prices: data, milestones, forecast });
  assert.ok(model.rows.filter(row => row.evidenceKind === 'scenario').every(row => row.scenarioId === 'sample'));
});
