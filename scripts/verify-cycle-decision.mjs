#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

// Exhaustive finite real-JavaScript verification. This is not a strategy test,
// an unrestricted theorem, or a proof of a stochastic price model.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const filename = path.join(root, 'dist/cycle-decision.js');
const source = await readFile(filename, 'utf8');
const { buildCycleDecisionTable: production } = await import(pathToFileURL(filename));
const epoch = Date.parse('2024-01-01T00:00:00Z');
const date = index => new Date(epoch + index * 86400000).toISOString().slice(0, 10);
const prices = values => values.map((value, index) => [date(index), value]);
const empty = input => ({ asOf: input.at(-1)[0], markers: [], cycles: [], intervals: [] });
const near = (actual, expected, label) => assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= 1e-10 * Math.max(1, Math.abs(expected)), `${label}: ${actual} != ${expected}`);
function observedFixture(values, { start = 0, end = values.length - 1, provisional = false, types = ['cycle-top', 'bottom'] } = {}) {
  const input = prices(values);
  const markers = [start, end].map((index, offset) => ({ id: `observed-${index}-${types[offset]}`, type: types[offset], date: input[index][0], price: input[index][1], kind: 'observed', selectionKind: 'observed', provisional, cycleId: 'sample' }));
  return { prices: input, milestones: { asOf: input.at(-1)[0], markers, intervals: [], cycles: [{ id: 'sample', label: '표본', kind: 'observed', startDate: markers[0].date, endDate: markers[1].date, markers: Object.fromEntries(markers.map(marker => [marker.type, marker])) }] } };
}
function scenarioFixture({ complete = true, partialMarker = false } = {}) {
  const fixture = observedFixture([120, 90, 110], { end: 1 });
  const anchor = fixture.milestones.markers[1];
  const recovery = { id: 'conditional-recovery', type: 'ath', date: date(2), price: 110, kind: 'observed', selectionKind: 'scenario', provisional: true };
  const top = { id: 'conditional-top', type: 'cycle-top', date: date(4), price: 180, kind: 'scenario', selectionKind: 'scenario', provisional: true, selectionWindowComplete: !partialMarker };
  const bottom = { id: 'conditional-bottom', type: 'bottom', date: date(5), price: 90, kind: 'scenario', selectionKind: 'scenario', provisional: true, selectionWindowComplete: !partialMarker };
  fixture.forecast = { asOf: date(2), scenario: { id: 'fixture-scenario' }, path: [[date(2), 110], [date(3), 130], [date(4), 180], [date(5), 90]] };
  fixture.milestones.markers.push(recovery, top, bottom);
  fixture.milestones.cycles.push({ id: 'selected-scenario', label: '조건부 가정', kind: 'scenario', startDate: anchor.date, endDate: bottom.date, markers: { bottom: anchor, ath: recovery, 'cycle-top': top, 'next-bottom': bottom } });
  fixture.milestones.futureStatus = { available: true, completeWindow: complete };
  return fixture;
}
function orderedOracle(input, start, end) {
  let result = 0;
  for (let peak = start; peak <= end; peak++) for (let trough = peak; trough <= end; trough++) result = Math.min(result, 100 * (input[trough][1] - input[peak][1]) / input[peak][1]);
  return result;
}
function* vectors(length, alphabet = [50, 100, 200]) {
  const total = alphabet.length ** length;
  for (let value = 0; value < total; value++) {
    let remaining = value;
    yield Array.from({ length }, () => { const digit = remaining % alphabet.length; remaining = Math.floor(remaining / alphabet.length); return alphabet[digit]; });
  }
}

const dayIndex = value => Math.round((Date.parse(`${value}T00:00:00Z`) - epoch) / 86400000);
const rangeRows = table => table.rows.filter(row => row.phaseId === 'range');

// Independent calendar-grid oracle: require every date, compare all price pairs
// for the width condition, then group qualifying END dates. It does not import
// the production rolling-window or run-building helpers.
function episodeOracle(input, firstEligibleDate = input[0][0]) {
  const byDate = new Map(input), qualifying = [];
  for (const [end, close] of input) {
    if (end < firstEligibleDate) continue;
    const endIndex = dayIndex(end);
    const window = Array.from({ length: 28 }, (_, offset) => byDate.get(date(endIndex - 27 + offset)));
    if (window.some(value => value === undefined)) continue;
    const widthFits = window.every(high => window.every(low => (high - low) / low * 100 <= 12 + 1e-10));
    const changeFits = Math.abs((close - window[0]) / window[0] * 100) <= 6 + 1e-10;
    if (widthFits && changeFits) qualifying.push(end);
  }
  const groups = [];
  for (const end of qualifying) {
    const previous = groups.at(-1);
    if (previous && dayIndex(end) - dayIndex(previous.at(-1)) === 1) previous.push(end);
    else groups.push([end]);
  }
  return groups.filter(group => group.length >= 7).map(group => ({
    startDate: group[0], endDate: group.at(-1), qualifyingObservations: group.length,
    minimumRunKnownAt: group[6], rangeWindowStart: date(dayIndex(group[0]) - 27),
    rightCensored: !byDate.has(date(dayIndex(group.at(-1)) + 1)),
  }));
}

function verifyObservedEpisodes(build, input) {
  const actual = rangeRows(build({ prices: input, milestones: empty(input) }));
  const expected = episodeOracle(input);
  assert.equal(actual.length, expected.length, 'observed episodes must match the independent qualifying-end oracle');
  for (const [index, row] of actual.entries()) {
    const run = expected[index];
    assert.equal(row.startDate, run.startDate, 'episode start is the first qualifying END date, not the lookback start');
    assert.equal(row.endDate, run.endDate, 'episode end is the last consecutive qualifying END date');
    assert.equal(row.minimumRunKnownAt, run.minimumRunKnownAt, 'episode minimum run becomes known only on its seventh qualifying date');
    assert.equal(row.qualifyingObservations, run.qualifyingObservations, 'episode count includes only consecutive qualifying END observations');
    assert.equal(row.minimumRunObservations, 7);
    assert.equal(row.rangeWindowStart, run.rangeWindowStart, 'episode lookback metadata stays separate from the displayed start');
    assert.equal(row.rightCensored, run.rightCensored, 'episode censoring distinguishes a known nonqualifying close from a missing boundary');
    const first = input.findIndex(([d]) => d === run.startDate), last = input.findIndex(([d]) => d === run.endDate);
    near(row.mddPct, orderedOracle(input, first, last), 'observed episode MDD excludes lookback prices');
    near(row.returnPct, (input[last][1] - input[first][1]) / input[first][1] * 100, 'observed episode return uses displayed endpoints');
    assert.ok(row.mddPeakDate >= row.startDate && row.mddPeakDate <= row.mddTroughDate && row.mddTroughDate <= row.endDate, 'observed episode MDD dates stay inside its displayed period');
    assert.equal(row.observationCount, last - first + 1); assert.equal(row.coverageComplete, true);
    assert.equal(row.kind, 'observed'); assert.equal(row.evidenceKind, 'observed-period');
    assert.equal(row.action.id, 'sideways'); assert.equal(row.action.scope, 'period'); assert.equal(row.action.strength, 'none');
    assert.equal(row.current, false); assert.equal(row.selectionIsRetrospective, false); assert.equal(row.scenarioId, null);
    assert.equal(row.days, dayIndex(row.endDate) - dayIndex(row.startDate)); near(row.weeks, row.days / 7, 'episode elapsed weeks');
    assert.equal(row.startPrice, input[first][1]); assert.equal(row.endPrice, input[last][1]);
    assert.equal(row.chart.startDate, row.startDate); assert.equal(row.chart.endDate, row.endDate); assert.equal(row.chart.markerId, null);
  }
}

function episodeScenarioFixture({ observedCount = 40, futureCount = 50, through = observedCount + futureCount - 1, futureValue = () => 100 } = {}) {
  const fixture = observedFixture(Array(observedCount).fill(100), { types: ['bottom', 'cycle-top'] });
  const baseline = structuredClone(fixture), anchor = fixture.milestones.markers.at(-1);
  fixture.forecast = {
    asOf: anchor.date, scenario: { id: 'bounded-flat-assumption' },
    path: [[anchor.date, anchor.price], ...Array.from({ length: futureCount }, (_, index) => [date(observedCount + index), futureValue(index)])],
  };
  fixture.milestones.cycles.push({ id: 'bounded-scenario-cycle', label: '선택한 횡보 가정', kind: 'scenario', startDate: anchor.date, endDate: date(observedCount + futureCount - 1), markers: { 'cycle-top': anchor } });
  fixture.milestones.futureStatus = { available: true, completeWindow: true, through: typeof through === 'number' ? date(through) : through };
  return { fixture, baseline };
}

function verifyFutureEpisodes(build, fixture, baseline) {
  const table = build(fixture), cutoff = fixture.milestones.asOf, through = fixture.milestones.futureStatus?.through;
  const available = fixture.milestones.futureStatus?.available === true;
  const actual = rangeRows(table).filter(row => row.evidenceKind === 'scenario');
  // Forecast identity, values and length cannot rewrite any actual-price row.
  assert.deepEqual(table.rows.filter(row => row.evidenceKind !== 'scenario'), build(baseline).rows, 'arbitrary future paths cannot create or rewrite actual results');
  if (!through) assert.equal(actual.length, 0, 'a forecast without chart bounds cannot create future episodes');
  if (!available) assert.equal(actual.length, 0, 'an unavailable chart horizon cannot create future episodes');
  const future = through && available ? fixture.forecast.path.filter(([d]) => d > cutoff && d <= through) : [];
  const combined = [...fixture.prices.slice(-27), ...future];
  const expected = future.length ? episodeOracle(combined, future[0][0]) : [];
  for (const row of actual) {
    assert.ok(row.startDate > cutoff, 'future episodes start strictly after the observed cutoff');
    assert.ok(row.endDate <= through, 'future episodes stay inside the selected chart horizon');
    assert.equal(row.scenarioId, fixture.forecast.scenario.id, 'future episodes preserve the selected scenario identity');
    assert.equal(row.returnPct, null, 'future episodes cannot invent realized return'); assert.equal(row.mddPct, null, 'future episodes cannot invent realized MDD');
    assert.equal(row.mddPeakDate, null); assert.equal(row.mddTroughDate, null); assert.equal(row.observationCount, 0); assert.equal(row.coverageComplete, false);
    assert.equal(row.action.id, 'sideways'); assert.equal(row.action.scope, 'period'); assert.equal(row.action.strength, 'none');
    assert.equal(row.provisional, true); assert.equal(row.current, false); assert.equal(row.selectionIsRetrospective, false);
    assert.deepEqual(row.cycleIds, ['bounded-scenario-cycle'], 'conditional periods retain only their selected cycle membership');
  }
  assert.equal(actual.length, expected.length, 'future episodes independently satisfy the seven-observation minimum');
  for (const [index, row] of actual.entries()) {
    const run = expected[index];
    assert.equal(row.startDate, run.startDate, 'future episode start is its first qualifying END date');
    assert.equal(row.endDate, run.endDate, 'future episode ends at its last known qualifying date');
    assert.equal(row.qualifyingObservations, run.qualifyingObservations);
    assert.equal(row.minimumRunKnownAt, run.minimumRunKnownAt, 'future episode minimum is known only after seven future qualifying dates');
    assert.equal(row.rightCensored, run.rightCensored, 'future episode censoring follows the bounded selected path');
    assert.equal(row.kind, run.rangeWindowStart <= cutoff ? 'mixed' : 'scenario', 'warm-up observations do not turn conditional episodes into observed periods');
    assert.equal(row.rangeWindowStart, run.rangeWindowStart);
  }
}

function verifyEpisodes(build) {
  const counts = { observedEpisodeCases: 0, observedEpisodeGaps: 0, episodeCausalPrefixes: 0, futureEpisodeCases: 0, futureEpisodeBounds: 0, futureEpisodeGaps: 0, sharedCycleMemberships: 0 };
  // The first qualifying period is perfectly flat, while its warm-up has a
  // 10.714...% drawdown. Pulling lookback prices into period MDD must fail.
  verifyObservedEpisodes(build, prices(Array.from({ length: 34 }, (_, index) => index === 13 ? 112 : 100))); counts.observedEpisodeCases++;
  for (let length = 1; length <= 42; length++) { verifyObservedEpisodes(build, prices(Array(length).fill(100))); counts.observedEpisodeCases++; }
  const shapes = [
    Array.from({ length: 96 }, (_, index) => index === 34 ? 200 : 100),
    [...Array(40).fill(100), ...Array(36).fill(200)],
    Array.from({ length: 80 }, (_, index) => 100 + index),
    ...[106, 112, 112.01].map(high => Array.from({ length: 80 }, (_, index) => index % 2 ? high : 100)),
    ...[106, 106.01, 94, 93.99].map(close => [...Array(27).fill(100), ...Array(12).fill(close)]),
  ];
  for (const values of shapes) { verifyObservedEpisodes(build, prices(values)); counts.observedEpisodeCases++; }
  for (let gap = 1; gap <= 66; gap++) {
    verifyObservedEpisodes(build, prices(Array(96).fill(100)).filter((_, index) => index !== gap)); counts.observedEpisodeGaps++;
  }
  for (let end = 26; end <= 42; end++) {
    const prefix = prices(Array(end + 1).fill(100)), milestones = empty(prefix);
    const extended = [...prefix, ...Array.from({ length: 12 }, (_, offset) => [date(end + offset + 1), 200 + offset * 100])];
    assert.deepEqual(build({ prices: extended, milestones, asOf: date(end) }), build({ prices: prefix, milestones }), 'future closes cannot backdate a seven-observation episode');
    counts.episodeCausalPrefixes++;
  }
  const checkFuture = (options, counter = 'futureEpisodeCases') => {
    const { fixture, baseline } = episodeScenarioFixture(options);
    verifyFutureEpisodes(build, fixture, baseline); counts[counter]++;
    return { fixture, baseline };
  };
  checkFuture({ through: 65 });
  for (const observedCount of [28, 33, 34, 40]) for (let futureCount = 0; futureCount <= 10; futureCount++) checkFuture({ observedCount, futureCount });
  checkFuture({ futureValue: () => 200 });
  checkFuture({ futureValue: index => index < 21 ? 100 : 200 });
  checkFuture({ futureValue: index => 100 + index * 25 });
  for (const through of [38, 39, 40, 45, 46, 47, 65, 89, 99]) checkFuture({ through }, 'futureEpisodeBounds');
  for (const absent of [undefined, null, '']) {
    const { fixture, baseline } = episodeScenarioFixture(); fixture.milestones.futureStatus.through = absent;
    verifyFutureEpisodes(build, fixture, baseline); counts.futureEpisodeBounds++;
  }
  {
    const { fixture, baseline } = episodeScenarioFixture(); delete fixture.milestones.futureStatus;
    verifyFutureEpisodes(build, fixture, baseline); counts.futureEpisodeBounds++;
  }
  for (const available of [false, undefined, null, 0]) {
    const { fixture, baseline } = episodeScenarioFixture(); fixture.milestones.futureStatus.available = available;
    verifyFutureEpisodes(build, fixture, baseline); counts.futureEpisodeBounds++;
  }
  for (const gap of [40, 41, 46, 47, 60, 66, 75]) {
    const { fixture, baseline } = episodeScenarioFixture(); fixture.forecast.path = fixture.forecast.path.filter(([d]) => d !== date(gap));
    verifyFutureEpisodes(build, fixture, baseline); counts.futureEpisodeGaps++;
  }
  {
    const { fixture, baseline } = episodeScenarioFixture();
    fixture.prices = fixture.prices.filter(([d]) => d !== date(35)); baseline.prices = fixture.prices;
    verifyFutureEpisodes(build, fixture, baseline); counts.futureEpisodeGaps++;
  }
  for (const reverse of [false, true]) for (const includeScenario of [false, true]) {
    const input = prices([100, 130, 80, 100, 150, 90]);
    const [opening, top, shared, laterTop, closing] = [0, 1, 2, 4, 5].map((index, position) => ({ id: `shared-${index}`, type: position % 2 ? 'cycle-top' : 'bottom', date: date(index), price: input[index][1], kind: 'observed', selectionKind: 'observed' }));
    const cycles = [
      { id: 'first-cycle', label: '첫 사이클', kind: 'observed', startDate: opening.date, endDate: shared.date, markers: { bottom: opening, 'cycle-top': top, 'next-bottom': shared } },
      { id: 'second-cycle', label: '둘째 사이클', kind: 'observed', startDate: shared.date, endDate: closing.date, markers: { bottom: shared, 'cycle-top': laterTop, 'next-bottom': closing } },
    ];
    if (reverse) cycles.reverse();
    if (includeScenario) cycles.push({ id: 'scenario-anchor-only', kind: 'scenario', startDate: shared.date, endDate: date(12), markers: { bottom: shared } });
    const table = build({ prices: input, milestones: { asOf: date(5), markers: [opening, top, shared, laterTop, closing], intervals: [], cycles } });
    const matches = table.rows.filter(row => row.chart.markerId === shared.id);
    assert.equal(matches.length, 1, 'a shared bottom remains one factual checkpoint');
    assert.deepEqual([...matches[0].cycleIds].sort(), ['first-cycle', 'second-cycle'], 'a shared bottom retains BOTH source cycle memberships');
    assert.equal(matches[0].cycleId, 'second-cycle'); assert.equal(matches[0].evidenceKind, 'retrospective'); counts.sharedCycleMemberships++;
  }
  {
    const input = prices(Array(60).fill(100)), milestones = empty(input);
    milestones.cycles = [
      { id: 'first-range-cycle', kind: 'observed', startDate: date(0), endDate: date(33), markers: {} },
      { id: 'second-range-cycle', kind: 'observed', startDate: date(33), endDate: date(59), markers: {} },
    ];
    assert.deepEqual(rangeRows(build({ prices: input, milestones }))[0].cycleIds, ['first-range-cycle', 'second-range-cycle'], 'an observed period preserves every overlapping cycle membership'); counts.sharedCycleMemberships++;
  }
  return counts;
}

function verify(build) {
  const counts = { exhaustivePricePaths: 0, scopedIntervals: 0, currentWindows: 0, causalPrefixes: 0, provenanceCases: 0, strongGuards: 0, rejectedMismatches: 0 };
  // All 1,089 positive-price paths over a three-level alphabet, lengths 2..6.
  // Oracle tries every ordered pair, rather than sharing the running-peak algorithm.
  for (let length = 2; length <= 6; length++) for (const values of vectors(length)) {
    const fixture = observedFixture(values), table = build(fixture), row = table.rows.find(row => row.chart.markerId === fixture.milestones.markers[1].id);
    near(row.mddPct, orderedOracle(fixture.prices, 0, length - 1), 'ordered MDD');
    near(row.returnPct, 100 * (values.at(-1) - values[0]) / values[0], 'endpoint return');
    assert.ok(row.mddPeakDate <= row.mddTroughDate && row.mddPeakDate >= row.startDate && row.mddTroughDate <= row.endDate, 'MDD dates must stay inside the displayed ordered interval');
    assert.equal(row.observationCount, length); assert.equal(row.coverageComplete, true);
    assert.equal(row.days, length - 1); assert.equal(row.action.scope, 'end-marker');
    assert.equal(table.rows[0].returnPct, null); assert.equal(table.rows[0].mddPct, null);
    counts.exhaustivePricePaths++;
  }
  for (const values of vectors(4)) {
    const fixture = observedFixture([10000, ...values, 1], { start: 1, end: 4 });
    const row = build(fixture).rows.find(row => row.chart.markerId === fixture.milestones.markers[1].id);
    near(row.mddPct, orderedOracle(fixture.prices, 1, 4), 'window MDD excludes prices before and after it');
    assert.equal(row.startDate, date(1)); assert.equal(row.endDate, date(4));
    counts.scopedIntervals++;
  }
  // No history, a missing day, strong movement and threshold boundaries must
  // not be collapsed into the same neutral/sideways fallback.
  const windows = [
    [Array(28).fill(100), true],
    [Array(27).fill(100), false],
    [Array.from({ length: 28 }, (_, i) => 100 + i), false],
    [Array.from({ length: 28 }, (_, i) => i === 13 ? 112 : 100), true],
    [Array.from({ length: 28 }, (_, i) => i === 13 ? 112.01 : 100), false],
    [Array.from({ length: 28 }, (_, i) => i === 27 ? 106 : 100), true],
    [Array.from({ length: 28 }, (_, i) => i === 27 ? 106.01 : 100), false],
    [Array.from({ length: 28 }, (_, i) => i === 27 ? 94 : 100), true],
    [Array.from({ length: 28 }, (_, i) => i === 27 ? 93.99 : 100), false],
  ];
  for (const [values, sideways] of windows) {
    const input = prices(values), current = build({ prices: input, milestones: empty(input) }).current;
    assert.equal(current.action.id, sideways ? 'sideways' : 'unavailable', 'current window must satisfy both stated conditions');
    assert.equal(current.action.scope, 'as-of'); assert.equal(current.selectionIsRetrospective, false); assert.equal(current.action.strength, 'none');
    counts.currentWindows++;
  }
  for (let gap = 1; gap < 28; gap++) {
    const input = prices(Array(29).fill(100)).filter((_, i) => i !== gap);
    const current = build({ prices: input, milestones: empty(input) }).current;
    assert.equal(current.action.id, 'unavailable', 'a missing UTC date cannot be sideways');
    assert.equal(current.range28dPct, null); assert.equal(current.change28dPct, null);
    counts.currentWindows++;
  }
  const history = prices(Array.from({ length: 80 }, (_, i) => 100 + i % 9));
  for (let end = 27; end < 60; end++) {
    const prefix = history.slice(0, end + 1), milestones = empty(prefix);
    const expected = build({ prices: prefix, milestones });
    const futureChanged = [...prefix, ...history.slice(end + 1).map(([d, value]) => [d, value * 7])];
    assert.deepEqual(build({ prices: futureChanged, milestones, asOf: date(end) }), expected, 'future observations cannot rewrite an as-of table');
    counts.causalPrefixes++;
  }
  for (const complete of [false, true]) for (const partialMarker of [false, true]) {
    const fixture = scenarioFixture({ complete, partialMarker }), table = build(fixture);
    const base = observedFixture([120, 90, 110], { end: 1 });
    assert.deepEqual(table.current, build(base).current, 'selected forecast cannot change current observed state');
    for (const marker of fixture.milestones.markers.filter(marker => marker.selectionKind === 'scenario')) {
      const row = table.rows.find(row => row.chart.markerId === marker.id);
      assert.ok(row, 'scenario-selected observed and future chart points must be represented');
      assert.equal(row.evidenceKind, 'scenario', 'observed prices do not make a scenario-selected role historical');
      assert.equal(row.scenarioId, fixture.forecast.scenario.id, 'scenario-selected checkpoints preserve the selected scenario identity');
      assert.deepEqual(row.cycleIds, ['selected-scenario'], 'conditional checkpoints retain their selected cycle membership');
      assert.equal(row.returnPct, null, 'conditional rows cannot invent realized return'); assert.equal(row.mddPct, null, 'conditional rows cannot invent realized MDD'); assert.equal(row.mddPeakDate, null); assert.equal(row.mddTroughDate, null);
      assert.equal(row.endDate, marker.date); assert.equal(row.endPrice, marker.price); assert.equal(row.provisional, true);
      if (!complete || partialMarker) assert.notEqual(row.action.strength, 'strong', 'partial conditional windows cannot strengthen review');
      counts.provenanceCases++;
    }
  }
  for (const types of [['cycle-top', 'bottom'], ['bottom', 'cycle-top']]) for (const values of [[200, 100], [100, 200]]) {
    const open = observedFixture(values, { types, provisional: true }), table = build(open);
    assert.ok(table.rows.every(row => row.action.strength !== 'strong'), 'provisional observed endpoints cannot become strong review');
    counts.strongGuards++;
  }
  const rejected = [
    () => { const f = observedFixture([120, 90]); f.milestones.asOf = date(0); return f; },
    () => { const f = observedFixture([120, 90]); f.milestones.markers[1].price = 91; return f; },
    () => { const f = scenarioFixture(); f.forecast.asOf = date(1); return f; },
    () => { const f = scenarioFixture(); f.forecast.path[0][1] = 111; return f; },
    () => { const f = scenarioFixture(); f.milestones.markers.find(marker => marker.id === 'conditional-top').price = 181; return f; },
    () => { const f = scenarioFixture(); f.forecast = null; return f; },
  ];
  for (const fixture of rejected) { assert.throws(() => build(fixture()), 'mismatched prices, scenario or cutoff must fail closed'); counts.rejectedMismatches++; }
  return { ...counts, ...verifyEpisodes(build) };
}

const counts = verify(production);
const mutations = [
  ['unordered-MDD', 'let peak = rows[first], worstPeak = peak, trough = peak, mdd = 0;', 'let peak = rows.slice(first, last + 1).reduce((a, b) => a.price > b.price ? a : b), worstPeak = peak, trough = peak, mdd = 0;'],
  ['scope-leaks-prior-history', 'const first = indices.get(start), last = indices.get(end);', 'const first = 0, last = indices.get(end);'],
  ['missing-days-as-sideways', 'const sideways = complete && range28dPct', 'const sideways = range28dPct'],
  ['future-observations-in-asof', 'const rows = asOf === undefined ? validated : validated.filter(row => row.date <= asOf);', 'const rows = validated;'],
  ['scenario-promoted-to-history', "const evidenceKind = scenario ? 'scenario'", "const evidenceKind = scenario ? 'retrospective'"],
  ['fictional-realized-zero', 'scenario ? blankRisk() : observedRisk(rows, indices, startDate, endDate)', 'scenario ? { ...blankRisk(), returnPct: 0, mddPct: 0 } : observedRisk(rows, indices, startDate, endDate)'],
  ['unconditional-strong-review', 'const strongEligible = !provisional && !scenario || scenario && completeWindow;', 'const strongEligible = true;'],
  ['changed-observed-price-accepted', 'byDate.get(marker.date) !== marker.price', 'false'],
  ['changed-scenario-price-accepted', 'futurePrices.get(marker.date) !== marker.price', 'false'],
  ['episode-start-backdated', 'const startDate = run.first.date, endDate = run.last.date;', 'const startDate = run.lookbackStart, endDate = run.last.date;'],
  ['episode-minimum-bypassed', 'if (run?.qualifyingObservations >= 7)', 'if (run?.qualifyingObservations >= 1)'],
  ['episode-gap-ignored', 'const contiguous = point.epochDay - first.epochDay === 27;', 'const contiguous = true;'],
  ['episode-return-threshold-removed', 'const qualifies = contiguous && range <= 12 + 1e-10 && Math.abs(change) <= 6 + 1e-10;', 'const qualifies = contiguous && range <= 12 + 1e-10;'],
  ['episode-width-threshold-removed', 'const qualifies = contiguous && range <= 12 + 1e-10 && Math.abs(change) <= 6 + 1e-10;', 'const qualifies = contiguous && Math.abs(change) <= 6 + 1e-10;'],
  ['episode-known-before-seven', 'if (run.qualifyingObservations === 7)', 'if (run.qualifyingObservations === 1)'],
  ['episode-risk-includes-lookback', 'const risk = !scenario ? observedRisk(rows, indices, startDate, endDate) : blankRisk();', 'const risk = !scenario ? observedRisk(rows, indices, run.lookbackStart, endDate) : blankRisk();'],
  ['episode-end-falsely-complete', 'finish(true);\n  return runs;', 'finish(false);\n  return runs;'],
  ['future-episode-realized-zero', 'const risk = !scenario ? observedRisk(rows, indices, startDate, endDate) : blankRisk();', 'const risk = !scenario ? observedRisk(rows, indices, startDate, endDate) : { ...blankRisk(), returnPct: 0, mddPct: 0 };'],
  ['future-episode-promoted-to-actual', "evidenceKind: scenario ? 'scenario' : 'observed-period',", "evidenceKind: 'observed-period',"],
  ['episode-cutoff-split-removed', 'sidewaysRuns(combined, { firstEligibleDate: future[0].date })', 'sidewaysRuns([...rows, ...future])'],
  ['future-episode-horizon-removed', 'point.date > cutoff && point.date <= futureEnd', 'point.date > cutoff'],
  ['future-episode-bound-invented', 'const futureEnd = milestones.futureStatus?.through;', 'const futureEnd = milestones.futureStatus?.through ?? selectedPath?.at(-1)?.date;'],
  ['future-episode-availability-ignored', 'if (selectedPath && futureEnd && milestones.futureStatus.available === true)', 'if (selectedPath && futureEnd)'],
  ['shared-bottom-membership-overwritten', 'membership.get(marker.id).add(cycle.id);', "if (cycle.kind !== 'scenario') membership.set(marker.id, new Set([cycle.id])); else membership.get(marker.id).add(cycle.id);"],
  ['overlapping-period-membership-collapsed', "cycleIds: memberships.length ? memberships.map(cycle => cycle.id) : [owner?.id || 'current'],", "cycleIds: [owner?.id || 'current'],"],
  ['future-episode-scenario-id-lost', 'selectionIsRetrospective: false, scenarioId: scenario ? scenarioId : null,', 'selectionIsRetrospective: false, scenarioId: null,'],
  ['checkpoint-scenario-id-lost', 'scenarioId: scenario ? forecast?.scenario?.id ?? null : null,', 'scenarioId: null,'],
];
const expectedFailure = {
  'unordered-MDD': /ordered MDD/,
  'scope-leaks-prior-history': /window MDD excludes prices before and after it/,
  'missing-days-as-sideways': /current window must satisfy both stated conditions/,
  'future-observations-in-asof': /Chart milestones must match the observed cutoff/,
  'scenario-promoted-to-history': /observed prices do not make a scenario-selected role historical/,
  'fictional-realized-zero': /conditional rows cannot invent realized return/,
  'unconditional-strong-review': /partial conditional windows cannot strengthen review/,
  'changed-observed-price-accepted': /Missing expected exception: mismatched prices, scenario or cutoff must fail closed/,
  'changed-scenario-price-accepted': /Missing expected exception: mismatched prices, scenario or cutoff must fail closed/,
  'episode-start-backdated': /episode start is the first qualifying END date, not the lookback start/,
  'episode-minimum-bypassed': /observed episodes must match the independent qualifying-end oracle/,
  'episode-gap-ignored': /episode start is the first qualifying END date, not the lookback start/,
  'episode-return-threshold-removed': /observed episodes must match the independent qualifying-end oracle/,
  'episode-width-threshold-removed': /observed episodes must match the independent qualifying-end oracle/,
  'episode-known-before-seven': /episode minimum run becomes known only on its seventh qualifying date/,
  'episode-risk-includes-lookback': /observed episode MDD excludes lookback prices/,
  'episode-end-falsely-complete': /episode censoring distinguishes a known nonqualifying close from a missing boundary/,
  'future-episode-realized-zero': /future episodes cannot invent realized return/,
  'future-episode-promoted-to-actual': /arbitrary future paths cannot create or rewrite actual results/,
  'episode-cutoff-split-removed': /future episodes start strictly after the observed cutoff/,
  'future-episode-horizon-removed': /future episodes stay inside the selected chart horizon/,
  'future-episode-bound-invented': /a forecast without chart bounds cannot create future episodes/,
  'future-episode-availability-ignored': /an unavailable chart horizon cannot create future episodes/,
  'shared-bottom-membership-overwritten': /a shared bottom retains BOTH source cycle memberships/,
  'overlapping-period-membership-collapsed': /an observed period preserves every overlapping cycle membership/,
  'future-episode-scenario-id-lost': /future episodes preserve the selected scenario identity/,
  'checkpoint-scenario-id-lost': /scenario-selected checkpoints preserve the selected scenario identity/,
};
const controls = [];
for (const [name, needle, replacement] of mutations) {
  assert.equal(source.split(needle).length, 2, `Mutation ${name} must match exactly once. Review changed source, never silently skip it.`);
  const altered = source.replace(needle, replacement).replace(/from ['"]\.\/([^'"]+)['"]/g, (_, resource) => `from '${new URL(resource, pathToFileURL(filename)).href}'`);
  const { buildCycleDecisionTable: broken } = await import(`data:text/javascript;base64,${Buffer.from(altered).toString('base64')}`);
  let failure = null;
  try { verify(broken); } catch (error) { failure = error; }
  assert.ok(failure instanceof assert.AssertionError || failure instanceof RangeError || failure instanceof TypeError, `${name} was not detected`);
  assert.match(failure.message, expectedFailure[name], `${name} failed for an unrelated reason`);
  controls.push({ mutation: name, detected: true, failure: failure.message.split('\n')[0] });
}
verify(production);
console.log(JSON.stringify({
  status: 'PASS', method: 'Exhaustive finite real-JavaScript inputs, independent ordered-pair risk and calendar-grid episode oracles, public-entry mutation controls',
  baseCommit: '3a1be8370a9fd9a71861be3f929493370f08a5ef',
  sourceSha256: createHash('sha256').update(source).digest('hex'), node: process.version, counts, negativeControls: controls,
  bounds: 'Every length-2..6 path over prices 50, 100 and 200; all 81 length-4 scoped intervals; 36 current-window cases; 33 as-of prefixes; 4 conditional-window combinations; 4 provisional extrema combinations; 6 rejected mismatches; 53 bounded observed-episode inputs; 66 missing-date positions; 17 episode cutoff prefixes; 48 bounded future-episode inputs; 17 explicit, absent or unavailable chart-horizon cases; 8 future/warm-up gaps; 5 shared-cycle membership cases. Episode cases are bounded fixtures, not exhaustive long price paths.',
  excludes: 'Unbounded mathematical proof, market forecasting, trading profitability, model calibration, browser rendering, transaction costs and intraday losses.',
}, null, 2));
