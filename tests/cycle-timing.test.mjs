import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { analyzeCycleTiming, computeOnlineSignals, shiftCalendarMonths, calendarScenarioWindow } from '../dist/cycle-timing.js';
import { utcDay, dateFromDay } from '../dist/cycle-engine.js';

const bundled = JSON.parse(await readFile(new URL('./fixtures/btc-daily-2026-10-20.json', import.meta.url), 'utf8'));
// A dated evidence fixture remains reproducible when newer daily rows arrive.
const data = { ...bundled, prices: bundled.prices.filter(([date]) => date <= '2026-10-20') };
let checks = 0;
const check = (name, fn) => { fn(); checks++; console.log(`PASS ${name}`); };
const analysis = analyzeCycleTiming(data);

check('Calendar scenarios use calendar months including month-end and leap rules', () => {
  assert.equal(shiftCalendarMonths('2026-11-09', -5), '2026-06-09');
  assert.equal(shiftCalendarMonths('2026-03-31', -1), '2026-02-28');
  assert.equal(shiftCalendarMonths('2024-03-31', -1), '2024-02-29');
  assert.equal(shiftCalendarMonths('2024-02-29', 12), '2025-02-28');
  assert.equal(calendarScenarioWindow('2026-11-09').endDate, '2026-08-09');
});

check('Every confirmation is prefix-causal and cannot appear before its persistence period', () => {
  const full = computeOnlineSignals(data);
  for (const date of ['2026-05-13', '2026-08-31', '2026-09-01', '2026-09-02']) {
    const prefix = computeOnlineSignals({ prices: data.prices.filter(([d]) => d <= date) });
    for (const family of ['trend', 'rebound']) {
      assert.deepEqual(prefix[family], full[family].filter((signal) => signal.confirmationDate <= date));
      for (const signal of prefix[family]) assert.equal(utcDay(signal.confirmationDate) - utcDay(signal.eventDate), 13);
    }
  }
  const before = computeOnlineSignals({ prices: data.prices.filter(([d]) => d <= '2026-08-31') });
  assert.ok(!before.trend.some((signal) => signal.eventDate === '2026-08-19'));
});

check('Missing UTC days cannot count as continuous persistence or moving-average observations', () => {
  const start = utcDay('2020-01-01');
  const prices = Array.from({ length: 14 }, (_, i) => [dateFromDay(start + i), 100 + i * 10]);
  const withGap = prices.filter(([date]) => date !== '2020-01-05');
  const output = computeOnlineSignals({ prices: withGap }, { maWindow: 3, persistence: 3 });
  assert.ok(output.trend.every((event) => event.eventDate >= '2020-01-08'));
});

check('Current candidate and timing identity reproduce the verified daily observations', () => {
  assert.equal(analysis.asOf, '2026-10-20');
  assert.equal(analysis.current.peak.date, '2025-10-06');
  assert.equal(analysis.current.troughCandidate.date, '2026-06-30');
  assert.equal(analysis.current.troughCandidate.daysAfterPeak, 267);
  assert.equal(analysis.current.daysSinceLow, 112);
  assert.equal(analysis.advances.calendarFourYear.peakAdvanceDays, 33);
  assert.equal(analysis.advances.calendarFourYear.bearDurationShorteningDays, 99);
  assert.equal(analysis.advances.calendarFourYear.troughAdvanceDays, 132);
  assert.equal(analysis.advances.calendarFourYear.identityCheck, true);
  assert.equal(analysis.advances.bearMedian.advanceDays, 98);
  assert.equal(analysis.baselines.recent2.metrics.peak.leadDays, 1.5);
  assert.equal(analysis.baselines.recent2.metrics.trough.leadDays, 99.5);
});

check('Online confirmation dates differ from the initial qualifying dates', () => {
  assert.equal(analysis.current.confirmations.gmaUp.eventDate, '2026-08-19');
  assert.equal(analysis.current.confirmations.gmaUp.confirmationDate, '2026-09-01');
  assert.equal(analysis.current.confirmations.gmaUp.earliestKnowableUtc, '2026-09-02T00:00:00.000Z');
  assert.equal(analysis.current.confirmations.reboundUp.eventDate, '2026-08-20');
  assert.equal(analysis.current.confirmations.reboundUp.confirmationDate, '2026-09-02');
  assert.equal(analysis.current.confirmations.reboundUp.earliestKnowableUtc, '2026-09-03T00:00:00.000Z');
  assert.equal(analysis.current.confirmations.gmaUp.pairingIsRetrospective, true);
  assert.equal(analysis.current.regime.state, 'up');
  assert.equal(analysis.current.regime.asOf, '2026-10-20');
});

check('Earlier rebound failures remain visible instead of silently selecting the successful signal', () => {
  const failed = analysis.falseSignals.rebound.find((signal) => signal.cycleYear === 2024 && signal.confirmationDate === '2026-05-13');
  assert.equal(failed.invalidatedAt, '2026-06-05');
  assert.equal(failed.subsequentLowerLow, true);
  assert.equal(analysis.falseSignals.counts.recent2.rebound.subsequentLowerLows, 5);
  assert.equal(analysis.falseSignals.counts.all3.gma.subsequentLowerLows, 1);
});

check('asOf truncates before extrema; newly observed peaks and lows revise the candidate honestly', () => {
  const beforeLow = analyzeCycleTiming(data, { asOf: '2026-06-01', includeSensitivity: false });
  assert.notEqual(beforeLow.current.troughCandidate.date, '2026-06-30');
  const nextDate = dateFromDay(utcDay(data.prices.at(-1)[0]) + 1);
  const lower = analyzeCycleTiming({ ...data, prices: [...data.prices, [nextDate, 50000]] }, { includeSensitivity: false });
  assert.equal(lower.current.troughCandidate.date, nextDate);
  assert.equal(lower.current.confirmations.gmaUp, null);
  const higher = analyzeCycleTiming({ ...data, prices: [...data.prices, [nextDate, 200000]] }, { includeSensitivity: false });
  assert.equal(higher.current.peak.date, nextDate);
  assert.equal(higher.current.troughCandidate, null);
});

check('A new ATH has no observed trough, zero-duration bear claim, or stale recovery pairing', () => {
  const prices = [...data.prices, ['2026-10-21', 130000]];
  const freshHigh = analyzeCycleTiming({ ...data, prices });
  assert.equal(freshHigh.current.peak.date, '2026-10-21');
  assert.equal(freshHigh.current.troughCandidate, null);
  assert.equal(freshHigh.cycles.at(-1).trough, null);
  assert.equal(freshHigh.current.troughAvailable, false);
  assert.equal(freshHigh.current.availability.trough, false);
  assert.equal(freshHigh.current.daysSinceLow, null);
  assert.equal(freshHigh.current.reboundPct, null);
  assert.deepEqual(freshHigh.current.confirmations, { gmaUp: null, reboundUp: null, gmaDown: null });
  for (const baseline of Object.values(freshHigh.baselines)) {
    for (const key of ['trough', 'bear', 'gmaUp', 'reboundUp', 'gmaUpAfterTrough', 'reboundUpAfterTrough']) {
      assert.equal(baseline.metrics[key].currentDays, null);
      assert.equal(baseline.metrics[key].leadDays, null);
    }
    assert.notEqual(baseline.metrics.peak.currentDays, null);
  }
  for (const key of ['currentBearDurationDays', 'bearDurationShorteningDays', 'troughAdvanceDays', 'identityCheck']) {
    assert.equal(freshHigh.advances.calendarFourYear[key], null);
  }
  assert.equal(freshHigh.scenarios.currentCandidateInsideCalendarWindow, null);
  assert.ok(freshHigh.sensitivity.every((variant) => variant.halvingToUpLeadDays === null && variant.currentConfirmationDate === null));
  assert.equal(freshHigh.current.regime.asOf, '2026-10-21');
  assert.equal(freshHigh.current.regime.state, 'up');
  assert.equal(freshHigh.current.regime.lastTransition.confirmationDate, '2026-09-01');
  assert.equal(freshHigh.current.regime.runningLowDate, null);
  assert.equal(freshHigh.current.regime.runningLowIsPostPeak, false);
});

check('A later equal high is not a trough; a strictly later lower price becomes an observed candidate', () => {
  const prices = [...data.prices, ['2026-10-21', 130000], ['2026-10-22', 130000]];
  const equal = analyzeCycleTiming({ ...data, prices }, { includeSensitivity: false });
  assert.equal(equal.current.troughCandidate, null);
  const lower = analyzeCycleTiming({ ...data, prices: [...prices, ['2026-10-23', 129000]] }, { includeSensitivity: false });
  assert.equal(lower.current.troughCandidate.date, '2026-10-23');
  assert.equal(lower.current.troughCandidate.price, 129000);
  assert.equal(lower.current.troughCandidate.daysAfterPeak, 2);
  assert.equal(lower.current.troughAvailable, true);
  assert.equal(lower.current.confirmations.gmaUp, null);
});

check('All baselines and sensitivity variants expose their small shared sample', () => {
  assert.equal(analysis.baselines.previous.sampleSize, 1);
  assert.equal(analysis.baselines.recent2.sampleSize, 2);
  assert.equal(analysis.baselines.all3.sampleSize, 3);
  assert.equal(analysis.sensitivity.length, 12);
  assert.ok(analysis.sensitivity.every((variant) => variant.notIndependentSamples));
  assert.equal(analysis.scenarios.previousTroughCalendarFourYears.scenarioOnly, true);
});

console.log(`${checks} timing-analysis checks passed`);
