import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { utcDay, dateFromDay } from '../dist/cycle-engine.js';
import { buildCycleMilestones, MILESTONE_TYPES, INTERVAL_RELATIONS } from '../dist/cycle-milestones.js';

const data = JSON.parse(await readFile(new URL('./fixtures/btc-daily-2026-10-20.json', import.meta.url), 'utf8'));
const observed = buildCycleMilestones(data);

test('all six reference landmark categories and nine interval families are represented in observed history', () => {
  assert.equal(MILESTONE_TYPES.length, 6);
  assert.equal(INTERVAL_RELATIONS.length, 9);
  assert.deepEqual(new Set(observed.markers.map(row => row.type)), new Set(MILESTONE_TYPES.map(row => row.id)));
  assert.deepEqual(new Set(observed.intervals.map(row => row.relation)), new Set(INTERVAL_RELATIONS.map(row => row.id)));
  assert.equal(new Set(observed.markers.map(row => row.id)).size, observed.markers.length);
});

test('every observed marker uses an exact source close, not the reference image weekly dates or prices', () => {
  const prices = new Map(data.prices);
  for (const marker of observed.markers) {
    assert.equal(marker.kind, 'observed');
    assert.equal(marker.price, prices.get(marker.date));
    assert.ok(marker.date <= observed.asOf);
    assert.ok(marker.definition.length > 12);
    if (marker.confirmationDate) assert.ok(marker.confirmationDate >= marker.date && marker.confirmationDate <= observed.asOf);
  }
  assert.equal(observed.markers.find(row => row.type === 'bottom' && row.date.startsWith('2022')).date, '2022-11-09');
});

test('all durations use exact UTC elapsed days, including leap years, rather than reference-image constants', () => {
  const byId = new Map(observed.markers.map(row => [row.id, row]));
  for (const interval of observed.intervals) {
    assert.equal(interval.days, utcDay(interval.endDate) - utcDay(interval.startDate));
    assert.equal(interval.weeks, interval.days / 7);
    assert.ok(Number.isSafeInteger(interval.days) && interval.days > 0);
    assert.equal(interval.startDate, byId.get(interval.fromId).date);
    assert.equal(interval.endDate, byId.get(interval.toId).date);
    assert.equal(interval.kind, 'observed');
  }
  assert.ok(observed.intervals.some(row => row.relation === 'bottom-cycle-top' && row.weeks !== 152));
});

test('2025 calendar maximum and newest observed low remain provisional; initial sample is not invented as a bottom', () => {
  const top = observed.markers.find(row => row.type === 'cycle-top' && row.date.startsWith('2025'));
  const low = observed.markers.find(row => row.type === 'bottom' && row.date.startsWith('2026'));
  assert.equal(top.provisional, true);
  assert.equal(low.provisional, true);
  assert.equal(observed.markers.some(row => row.type === 'bottom' && row.date === data.prices[0][0]), false);
  assert.ok(observed.intervals.filter(row => row.fromId === top.id || row.toId === top.id).every(row => row.provisional));
});

test('historical prefix cannot see later prices or promote the image 2025 projection into an observation', () => {
  const asOf = '2024-08-06';
  const a = buildCycleMilestones(data, { asOf });
  const b = buildCycleMilestones({ prices: data.prices.filter(([date]) => date <= asOf) });
  assert.deepEqual(a, b);
  assert.ok(a.markers.every(row => row.date <= asOf));
  assert.ok(a.intervals.every(row => row.endDate <= asOf));
  assert.equal(a.markers.some(row => row.date.startsWith('2025')), false);
});

function forecastFor(multiplier = 1) {
  const asOf = data.prices.at(-1)[0], day = utcDay(asOf), price = data.prices.at(-1)[1];
  const path = Array.from({ length: 1001 }, (_, index) => ({
    date: dateFromDay(day + index),
    price: price * Math.exp(index / 650 * multiplier + .3 * Math.sin(index / 37)),
    kind: index ? 'conditional-long-horizon-path' : 'observed-anchor',
  }));
  return { asOf, path, nominalClock: { effectivePeakDate: dateFromDay(day + 720), nextLowDate: dateFromDay(day + 1000), zoneEntryDate: dateFromDay(day + 620) }, scenario: { id: 'test' } };
}

test('future markers use only the selected path and intervals crossing the observation boundary stay conditional', () => {
  const forecast = forecastFor();
  const result = buildCycleMilestones(data, { forecast });
  const prices = new Map(forecast.path.map(point => [point.date, point.price]));
  const future = result.markers.filter(point => point.kind === 'scenario');
  assert.ok(future.length >= 3);
  for (const point of future) {
    assert.ok(point.date > result.asOf);
    assert.equal(point.price, prices.get(point.date));
    assert.equal(point.provisional, true);
  }
  assert.ok(result.intervals.some(row => row.kind === 'mixed'));
  assert.ok(result.intervals.filter(row => row.kind !== 'observed').every(row => row.provisional));
  const changed = buildCycleMilestones(data, { forecast: forecastFor(1.4) });
  assert.notDeepEqual(future.map(row => [row.date, row.price]), changed.markers.filter(row => row.kind === 'scenario').map(row => [row.date, row.price]));
  assert.deepEqual(result.markers.filter(row => row.kind === 'observed'), observed.markers);
});

test('missing or expired future clock does not invent distant cycle peaks from valuation anchors', () => {
  const forecast = forecastFor();
  delete forecast.nominalClock;
  forecast.events = [{ date: '2050-12-31', type: 'valuation-reference', price: 1000000 }];
  const result = buildCycleMilestones(data, { forecast });
  assert.equal(result.markers.some(row => row.kind === 'scenario'), false);
  assert.equal(result.futureStatus.available, false);
  assert.match(result.futureStatus.reason, /시계|기준/);
  forecast.nominalClock = { effectivePeakDate: '2025-01-01', nextLowDate: '2026-01-01' };
  assert.equal(buildCycleMilestones(data, { forecast }).markers.some(row => row.kind === 'scenario'), false);
});

test('mismatched forecast cutoff or invalid dates are rejected instead of mixing revisions', () => {
  const forecast = forecastFor();
  forecast.asOf = '2024-08-06';
  assert.throws(() => buildCycleMilestones(data, { forecast }), /asOf|cutoff/i);
  assert.throws(() => buildCycleMilestones(data, { asOf: '2023-02-29' }), /date/i);
});

test('partial and short histories omit unavailable landmarks without empty or backwards intervals', () => {
  const result = buildCycleMilestones({ prices: [['2026-10-01', 90], ['2026-10-02', 95]] });
  assert.deepEqual(result.markers, []);
  assert.deepEqual(result.intervals, []);
  for (const cutoff of ['2010-12-01', '2011-06-01', '2012-11-28', '2025-06-30']) {
    const partial = buildCycleMilestones(data, { asOf: cutoff });
    assert.ok(partial.intervals.every(row => row.days > 0));
    assert.ok(partial.markers.every(row => row.date <= cutoff));
  }
});

test('major first tops match first-half phases instead of the first small correction, and pit stops remain later highs', () => {
  const cycle = observed.cycles.find(row => row.id === 'peak-2021');
  assert.equal(cycle.markers['first-top'].date, '2021-04-13');
  assert.equal(cycle.markers['pit-stop'].date, '2021-09-06');
  for (const selected of observed.cycles) {
    const first = selected.markers['first-top'], pit = selected.markers['pit-stop'], top = selected.markers['cycle-top'];
    if (first) {
      assert.equal(first.date.slice(0, 4), top.date.slice(0, 4));
      assert.ok(first.date.slice(5, 7) <= '06');
      assert.ok(utcDay(top.date) - utcDay(first.date) >= 90);
    }
    if (pit) {
      assert.ok(pit.date > first.date);
      const days = utcDay(top.date) - utcDay(pit.date);
      assert.ok(days >= 60 && days <= 150);
    }
  }
});

test('a forecast built against another final observed price is rejected even when its date matches', () => {
  const forecast = forecastFor();
  forecast.path[0].price *= 1.01;
  assert.throws(() => buildCycleMilestones(data, { forecast }), /anchor|price|관측/i);
});

test('a truncated future low window stays an explicitly partial candidate without claiming the clock endpoint', () => {
  const forecast = forecastFor();
  forecast.path = forecast.path.slice(0, 850);
  const result = buildCycleMilestones(data, { forecast });
  const cycle = result.cycles.at(-1), bottom = cycle.markers['next-bottom'];
  assert.ok(bottom, 'the available path contains a low after the selected future peak');
  assert.equal(bottom.selectionWindowComplete, false);
  assert.equal(bottom.windowStart, cycle.markers['cycle-top'].date);
  assert.equal(bottom.windowEnd, forecast.path.at(-1).date);
  assert.equal(bottom.requestedWindowEnd, forecast.nominalClock.nextLowDate);
  assert.equal(bottom.provisional, true);
  assert.match(bottom.definition, /부분|경로 종료/);
  assert.match(result.futureStatus.reason, /부분|미완료/);
  const periods = result.intervals.filter(interval => interval.toId === bottom.id);
  assert.ok(periods.length >= 2);
  assert.ok(periods.every(interval => interval.selectionWindowComplete === false));
  assert.ok(periods.every(interval => interval.endDate <= forecast.path.at(-1).date));
  const full = buildCycleMilestones(data, { forecast: forecastFor() }).cycles.at(-1).markers['next-bottom'];
  assert.equal(full.selectionWindowComplete, true);
  assert.equal(full.windowEnd, forecast.nominalClock.nextLowDate);
});

test('future-dependent selection of an observed price preserves both kinds of provenance', () => {
  const asOf = '2024-08-06', prefix = data.prices.filter(([date]) => date <= asOf);
  const day = utcDay(asOf), price = prefix.at(-1)[1];
  const path = Array.from({ length: 1001 }, (_, index) => ({
    date: dateFromDay(day + index), price: price * Math.exp(index / 650 + .3 * Math.sin(index / 37)),
  }));
  const forecast = { asOf, path, nominalClock: { effectivePeakDate: dateFromDay(day + 720), nextLowDate: dateFromDay(day + 1000) } };
  const baseline = buildCycleMilestones({ prices: prefix });
  const result = buildCycleMilestones({ prices: prefix }, { forecast });
  const baselineIds = new Set(baseline.markers.map(marker => marker.id));
  const conditionalObserved = result.markers.filter(marker => marker.kind === 'observed' && !baselineIds.has(marker.id));
  assert.ok(conditionalObserved.length > 0, 'future cycle selects an already-observed ATH or MID-TOP');
  for (const marker of conditionalObserved) {
    assert.equal(marker.selectionKind, 'scenario');
    assert.equal(marker.price, new Map(prefix).get(marker.date));
    assert.equal(marker.provisional, true);
  }
  assert.deepEqual(result.markers.filter(marker => baselineIds.has(marker.id)), baseline.markers);
  const conditionalPeriods = result.intervals.filter(interval => interval.cycleId.startsWith('scenario-'));
  assert.ok(conditionalPeriods.some(interval => interval.kind === 'observed'));
  assert.ok(conditionalPeriods.every(interval => interval.selectionKind === 'scenario' && interval.provisional));
});

test('FIRST TOP and PIT STOP selected relative to a provisional peak remain provisional too', () => {
  const partial = buildCycleMilestones(data, { asOf: '2021-06-30' });
  const current = partial.cycles.at(-1);
  assert.equal(current.markers['cycle-top'].provisional, true);
  assert.ok(current.markers['first-top'] && current.markers['pit-stop']);
  assert.equal(current.markers['first-top'].provisional, true);
  assert.equal(current.markers['pit-stop'].provisional, true);
  const completed = observed.cycles.find(cycle => cycle.id === 'peak-2021');
  assert.equal(completed.markers['first-top'].provisional, false);
  assert.equal(completed.markers['pit-stop'].provisional, false);
});
