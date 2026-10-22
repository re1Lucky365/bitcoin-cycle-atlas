import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { buildScenarioCountdown, koreanCalendarDate } from '../dist/scenario-countdown.js';
import { buildLongHorizonForecast, LONG_HORIZON_SCENARIOS } from '../dist/long-horizon-forecast.js';
import { utcDay, dateFromDay } from '../dist/cycle-engine.js';
import { preparePriceViewData } from '../dist/price-view-data.js';

function fixture(segments, asOf = '2026-10-21') {
  const path = [], start = utcDay(asOf);
  for (const [state, days] of segments) for (let i = 0; i < days; i++) path.push({ date: dateFromDay(start + path.length), state });
  return { asOf, path, displayEnd: path.at(-1).date };
}

test('countdown shares the scenario calendar and distinguishes brief noise from continuous holding', () => {
  const model = fixture([['advance', 4], ['pullback', 2], ['correction', 9], ['range', 8]]);
  const result = buildScenarioCountdown(model, { today: '2026-10-22' });
  assert.equal(result.currentLabel, '상승');
  assert.equal(result.currentUntil, '2026-10-24');
  assert.equal(result.holdDays, 3);
  assert.equal(result.nextLabel, '하락');
  assert.equal(result.date, '2026-10-27');
  assert.equal(result.days, 5);
  assert.equal(result.dday, 'D-5');
  assert.equal(result.nextRunDays, 9);
  assert.equal(result.intermediateTransitions, 1);
  assert.equal(result.sequence[1].label, '횡보');
  assert.equal(result.conditional, true);
  assert.equal(result.probability, null);
  assert.equal(buildScenarioCountdown(model, { today: '2026-10-23' }).days, 4);
});

test('rally subtypes share one upward regime; bottom is explicitly a candidate', () => {
  const model = fixture([['rebound', 4], ['advance', 4], ['price-discovery', 4], ['bottom-formation', 7]]);
  const result = buildScenarioCountdown(model, { today: '2026-10-22' });
  assert.equal(result.holdDays, 11);
  assert.equal(result.nextLabel, '바닥 후보');
  assert.equal(result.nextRunDays, 7);
  assert.equal(result.sequence[0].rightCensored, true);
});

test('current-state maintenance, insufficient future runs and missing days never manufacture an ETA', () => {
  const flat = buildScenarioCountdown(fixture([['range', 20]]), { today: '2026-10-22' });
  assert.equal(flat.status, 'maintained');
  assert.equal(flat.days, null);
  assert.equal(flat.currentRightCensored, true);
  const short = buildScenarioCountdown(fixture([['advance', 2], ['correction', 6]]), { today: '2026-10-22' });
  assert.equal(short.status, 'maintained');
  assert.equal(short.nextLabel, null);
  const gap = fixture([['advance', 5], ['correction', 10]]);
  gap.path.splice(4, 1);
  const incomplete = buildScenarioCountdown(gap, { today: '2026-10-22' });
  assert.equal(incomplete.days, null);
  assert.equal(incomplete.status, 'unavailable');
  assert.equal(incomplete.reason, 'incomplete-future-path');
  assert.equal(incomplete.currentLabel, '상승');
  assert.equal(incomplete.currentRightCensored, true);
  assert.equal(buildScenarioCountdown(gap, { today: '2026-10-25' }).reason, 'missing-today-in-path');
});

test('unknown intervals stop the candidate chain without hiding an earlier fully observed candidate', () => {
  const unknown = buildScenarioCountdown(fixture([['advance', 4], ['warmup', 2], ['correction', 9]]), { today: '2026-10-22' });
  assert.equal(unknown.status, 'unavailable');
  assert.equal(unknown.reason, 'incomplete-future-path');
  assert.equal(unknown.currentRightCensored, true);
  const known = buildScenarioCountdown(fixture([['advance', 4], ['correction', 9], ['warmup', 2], ['range', 8]]), { today: '2026-10-22' });
  assert.equal(known.status, 'upcoming');
  assert.equal(known.nextLabel, '하락');
  assert.equal(known.sequence.length, 1);
  assert.equal(known.sequence[0].rightCensored, true);
});

test('the skipped-brief-run count excludes a long return to the current regime', () => {
  const model = fixture([['advance', 4], ['pullback', 2], ['advance', 20], ['correction', 8]]);
  const result = buildScenarioCountdown(model, { today: '2026-10-22' });
  assert.equal(result.holdDays, 3);
  assert.equal(result.nextLabel, '하락');
  assert.equal(result.intermediateTransitions, 1);
  assert.equal(result.days, 25);
});

test('Korean midnight changes only the calendar countdown, without revising the observation cutoff', () => {
  assert.equal(koreanCalendarDate(new Date('2026-10-22T14:59:59Z')), '2026-10-22');
  assert.equal(koreanCalendarDate(new Date('2026-10-22T15:00:00Z')), '2026-10-23');
  const old = fixture([['advance', 14], ['correction', 9]], '2026-10-10');
  const result = buildScenarioCountdown(old, { today: '2026-10-22' });
  assert.equal(result.asOf, '2026-10-10');
  assert.equal(result.asOfAgeDays, 12);
  assert.equal(result.days, 2);
  assert.equal(result.currentIsConditional, true);
  assert.throws(() => koreanCalendarDate(new Date(NaN)), /valid date/);
});

test('unavailable, invalid or exhausted paths explain absence instead of negative countdowns', () => {
  assert.equal(buildScenarioCountdown(null, { today: '2026-10-22' }).status, 'unavailable');
  assert.equal(buildScenarioCountdown(fixture([['range', 2]]), { today: '2026-10-25' }).reason, 'beyond-displayed-horizon');
  assert.equal(buildScenarioCountdown(fixture([['warmup', 10]]), { today: '2026-10-22' }).reason, 'current-state-unavailable');
  const reversed = fixture([['advance', 5]]); reversed.path.reverse();
  assert.equal(buildScenarioCountdown(reversed, { today: '2026-10-22' }).status, 'unavailable');
  assert.throws(() => buildScenarioCountdown(null, { today: '2026-02-30' }), /calendar/);
  assert.throws(() => buildScenarioCountdown(null, { today: '2026-10-22', minimumRunDays: 0 }), /positive integer/);
});

test('reduced-ensemble countdown follows all selected scenario paths without changing model data', async () => {
  const data = JSON.parse(await readFile(new URL('./fixtures/btc-daily-2026-10-20.json', import.meta.url), 'utf8'));
  for (const { id: scenario } of LONG_HORIZON_SCENARIOS) {
    const model = buildLongHorizonForecast(data, { scenario, sampleCount: 16 });
    const original = JSON.stringify(model.path);
    const result = buildScenarioCountdown(model, { today: '2026-10-22' });
    assert.equal(result.asOf, model.asOf);
    assert.equal(result.status, 'upcoming');
    assert.equal(result.days, utcDay(result.date) - utcDay(result.today));
    const from = model.path.findIndex(row => row.date === result.date);
    assert.ok(from >= 0);
    const target = buildScenarioCountdown(model, { today: result.date });
    assert.equal(target.currentLabel, result.nextLabel);
    assert.ok(target.holdDays >= 7);
    assert.equal(JSON.stringify(model.path), original);
  }
});

test('the production 128-draw base contract matches the plotted path and its calendar countdown', async () => {
  const fixtureData = JSON.parse(await readFile(new URL('./fixtures/btc-daily-2026-10-20.json', import.meta.url), 'utf8'));
  // One completed Coin Metrics observation from the published 2026-10-21
  // snapshot makes this browser-contract regression independent of daily refresh.
  const prices = [...fixtureData.prices, ['2026-10-21', 84176.0796455874]];
  // Keep the real lab-view model() options here. A 16-draw speed fixture may
  // select a different representative path and must not stand in for production.
  const model = buildLongHorizonForecast(prices, {
    asOf: '2026-10-21', referenceDate: '2026-10-22', scenario: 'base',
    seed: 20261022, sampleCount: 128, blockDays: 28,
  });
  const result = buildScenarioCountdown(model, { today: '2026-10-22' });
  assert.equal(model.nearPhase.assumptions.sampleCount, 128);
  assert.equal(model.cycleCalibration.forecastApplication.appliedShiftDays, -52);
  assert.deepEqual({
    status: result.status, current: result.currentLabel, currentUntil: result.currentUntil,
    holdDays: result.holdDays, next: result.nextLabel, date: result.date,
    days: result.days, nextRunDays: result.nextRunDays, skipped: result.intermediateTransitions,
  }, {
    status: 'upcoming', current: '횡보', currentUntil: '2027-01-12',
    holdDays: 83, next: '하락', date: '2027-01-18',
    days: 88, nextRunDays: 27, skipped: 2,
  });
  const plotted = preparePriceViewData(model, prices.map(([date, price]) => ({ date, price }))).future;
  const from = plotted.findIndex(point => point.date === result.date);
  assert.ok(from >= 0);
  assert.equal(plotted[from - 1].state === 'correction', false);
  assert.ok(plotted.slice(from, from + result.nextRunDays).every(point => point.state === 'correction'));
  assert.equal(plotted[from + result.nextRunDays].state === 'correction', false);
  assert.equal(buildScenarioCountdown(model, { today: '2026-10-23' }).days, 87);
  assert.equal(result.conditional, true);
  assert.equal(result.probability, null);
});
