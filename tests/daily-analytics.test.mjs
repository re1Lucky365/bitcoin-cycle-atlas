import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { analyzeDailySeries } from '../dist/daily-analytics.js';
import { dateFromDay, utcDay } from '../dist/cycle-engine.js';

const rows = (prices, start = '2024-01-01') => prices.map((price, index) => [dateFromDay(utcDay(start) + index), price]);
const close = (actual, expected, tolerance = 1e-10) => assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);

test('MDD is a peak-before-trough loss and recovery uses the trough denominator', () => {
  const report = analyzeDailySeries(rows([100, 80, 120, 90, 60, 105]));
  const { summary } = report;
  close(summary.cumulativeReturnPct, 5);
  close(summary.mddPct, -50);
  assert.equal(summary.mddPeakDate, '2024-01-03');
  assert.equal(summary.mddTroughDate, '2024-01-05');
  close(summary.drawdownPct, -12.5);
  close(summary.recoveryPct, 100 / 7);
  close(report.rows[4].recoveryPct, 100);
  close(report.rows[3].mddToDatePct, -25);
  assert.equal(report.rows[4].peakDate, '2024-01-03');
  assert.equal(summary.cagrPct, null);
  const reorderedExtremes = analyzeDailySeries(rows([40, 100, 80])).summary;
  close(reorderedExtremes.mddPct, -20);
  assert.equal(reorderedExtremes.mddPeakDate, '2024-01-02');
  assert.equal(reorderedExtremes.mddTroughDate, '2024-01-03');
});

test('zero drawdowns and equal peaks have deterministic dates', () => {
  for (const prices of [[100], [100, 100, 100], [100, 110, 120]]) {
    const report = analyzeDailySeries(rows(prices));
    assert.equal(report.summary.mddPct, 0);
    assert.equal(report.summary.drawdownPct, 0);
    assert.equal(report.summary.recoveryPct, 0);
    assert.ok(report.rows.every(row => row.mddToDatePct === 0));
  }
  const ties = analyzeDailySeries(rows([100, 100, 50, 50]));
  assert.equal(ties.summary.mddPeakDate, '2024-01-01');
  assert.equal(ties.summary.mddTroughDate, '2024-01-03');
  assert.equal(ties.rows[0].changePct, null);
});

test('calendar returns and MDD carry the immediately preceding period close', () => {
  const report = analyzeDailySeries([
    ['2023-12-31', 100], ['2024-01-01', 80], ['2024-01-02', 90],
  ]);
  const january = report.monthly.find(period => period.year === 2024 && period.month === 1);
  const year = report.annual.find(period => period.year === 2024);
  for (const period of [january, year]) {
    close(period.returnPct, -10);
    close(period.mddPct, -20);
    assert.equal(period.baselineDate, '2023-12-31');
    assert.equal(period.peakDate, '2023-12-31');
    assert.equal(period.troughDate, '2024-01-01');
    assert.equal(period.partial, true);
    assert.equal(period.coverageComplete, true);
  }
  close(report.rows[1].ytdPct, -20);
  assert.equal(report.rows[1].ytdPartial, false);
  const firstYear = report.annual[0];
  assert.equal(firstYear.partial, true);
  assert.equal(firstYear.baselineDate, '2023-12-31');
  assert.equal(report.rows[0].ytdPartial, true);
});

test('period MDD does not import a distant lifetime peak', () => {
  const report = analyzeDailySeries([
    ['2023-12-30', 100], ['2023-12-31', 80], ['2024-01-01', 90], ['2024-01-02', 85],
  ]);
  close(report.summary.mddPct, -20);
  close(report.annual[1].mddPct, -100 / 18);
  close(report.annual[1].returnPct, 6.25);
  assert.equal(report.annual[1].peakDate, '2024-01-01');
  assert.equal(report.annual[1].troughDate, '2024-01-02');
});

test('full leap-year and monthly boundaries are distinguished from partial periods', () => {
  const input = rows(Array.from({ length: 367 }, (_, index) => 100 + index), '2023-12-31');
  const report = analyzeDailySeries(input);
  const fullYear = report.annual.find(period => period.year === 2024);
  assert.equal(fullYear.partial, false);
  assert.equal(fullYear.coverageComplete, true);
  assert.equal(fullYear.count, 366);
  close(fullYear.returnPct, 366);
  const february = report.monthly.find(period => period.year === 2024 && period.month === 2);
  assert.equal(february.count, 29);
  assert.equal(february.baselineDate, '2024-01-31');
  assert.equal(february.startDate, '2024-02-01');
  assert.equal(february.endDate, '2024-02-29');
  assert.equal(february.partial, false);
  assert.equal(report.annual[0].partial, true);
  const cropped = analyzeDailySeries(input.slice(15, -20));
  assert.ok(cropped.annual.every(period => period.partial));
  assert.equal(cropped.monthly.at(-1).partial, true);
});

test('CAGR compounds actual elapsed calendar days rather than averaging annual returns', () => {
  const report = analyzeDailySeries([
    ['2020-01-01', 100], ['2021-01-01', 200], ['2022-01-01', 100],
  ]);
  assert.equal(report.summary.elapsedDays, 731);
  assert.equal(report.summary.cumulativeReturnPct, 0);
  assert.equal(report.summary.cagrPct, 0);
  const doubled = analyzeDailySeries([['2020-01-01', 100], ['2022-01-01', 200]]);
  close(doubled.summary.cagrPct, (2 ** (365.2425 / 731) - 1) * 100);
  const leapAnniversary = analyzeDailySeries([['2020-01-01', 100], ['2021-01-01', 121]]);
  close(leapAnniversary.summary.cagrPct, (1.21 ** (365.2425 / 366) - 1) * 100);
  assert.equal(analyzeDailySeries(rows([100, 200])).summary.cagrPct, null);
});

test('CAGR eligibility follows the first calendar anniversary independently of annualization', () => {
  const year = analyzeDailySeries([['2021-01-01', 100], ['2022-01-01', 110]]);
  close(year.summary.cagrPct, (1.1 ** (365.2425 / 365) - 1) * 100);
  assert.equal(analyzeDailySeries([['2021-01-01', 100], ['2021-12-31', 110]]).summary.cagrPct, null);
  assert.equal(analyzeDailySeries([['2020-01-01', 100], ['2020-12-31', 110]]).summary.cagrPct, null);
  const leapDay = analyzeDailySeries([['2020-02-29', 100], ['2021-02-28', 110]]);
  close(leapDay.summary.cagrPct, (1.1 ** (365.2425 / 365) - 1) * 100);
  assert.equal(analyzeDailySeries([['2020-02-29', 100], ['2021-02-27', 110]]).summary.cagrPct, null);
});

test('appending future observations cannot revise historical daily risk values', () => {
  const input = rows(Array.from({ length: 450 }, (_, i) => 100 + i / 10 + Math.sin(i / 4) * 3), '2023-10-01');
  const prefix = analyzeDailySeries(input.slice(0, 230));
  const appended = analyzeDailySeries(input);
  assert.deepEqual(appended.rows.slice(0, 230), prefix.rows);
  const replacement = analyzeDailySeries([...input.slice(0, 230), ...input.slice(230).map(([date, price]) => [date, price / 100])]);
  assert.deepEqual(replacement.rows.slice(0, 230), prefix.rows);
});

test('missing UTC days suppress mislabeled daily changes and mark incomplete risk windows', () => {
  const input = rows(Array.from({ length: 410 }, (_, i) => 100 + i * 0.1));
  input.splice(210, 1);
  const report = analyzeDailySeries(input);
  assert.equal(report.summary.missingDayCount, 1);
  assert.equal(report.summary.coverageComplete, false);
  const afterGap = report.rows[210];
  assert.equal(afterGap.changePct, null);
  assert.equal(report.annual[0].coverageComplete, false);
  assert.equal(report.monthly.find(period => period.month === 7).coverageComplete, false);
  assert.ok(report.summary.mddPct <= 0);
});

test('exchange weekends preserve previous-session returns but known missing sessions break daily changes', () => {
  const fridayMonday = analyzeDailySeries([['2024-01-05', 100], ['2024-01-08', 110]], { calendar: 'sessions' });
  close(fridayMonday.rows[1].changePct, 10);
  assert.equal(fridayMonday.summary.missingDayCount, 0);
  const missingMonday = analyzeDailySeries([['2024-01-05', 100], ['2024-01-09', 110]], { calendar: 'sessions', missingDates: ['2024-01-08'] });
  assert.equal(missingMonday.rows[1].changePct, null);
  assert.equal(missingMonday.summary.missingDayCount, 1);
  assert.equal(missingMonday.monthly[0].coverageComplete, false);
  const acrossYears = analyzeDailySeries([['2023-12-29', 100], ['2024-01-02', 80], ['2024-12-31', 120]], { calendar: 'sessions' });
  assert.equal(acrossYears.annual[1].partial, false);
  assert.equal(acrossYears.annual[1].baselineDate, '2023-12-29');
  close(acrossYears.annual[1].mddPct, -20);
  close(acrossYears.annual[1].returnPct, 20);
  assert.match(acrossYears.summary.coverageBasis, /known missing/);
});

test('unobserved whole periods do not gain invented returns or stale baselines', () => {
  const report = analyzeDailySeries([['2020-01-01', 100], ['2022-03-01', 80], ['2022-03-02', 88]]);
  assert.deepEqual(report.annual.map(period => period.year), [2020, 2022]);
  assert.deepEqual(report.monthly.map(period => [period.year, period.month]), [[2020, 1], [2022, 3]]);
  assert.equal(report.annual[1].baselineDate, '2022-03-01');
  assert.equal(report.annual[1].partial, true);
  close(report.annual[1].returnPct, 10);
  close(report.annual[1].mddPct, 0);
});

test('known missing final sessions mark prior periods and the terminal summary as incomplete', () => {
  const options = { calendar: 'sessions', asOfDate: '2025-01-02', missingDates: ['2024-12-31'] };
  const terminal = analyzeDailySeries([['2023-12-29', 100], ['2024-12-30', 150]], options);
  assert.equal(terminal.summary.missingDayCount, 1);
  assert.equal(terminal.summary.coverageComplete, false);
  assert.equal(terminal.annual[1].missingDayCount, 1);
  assert.equal(terminal.annual[1].coverageComplete, false);
  assert.equal(terminal.annual[1].partial, true);
  assert.equal(terminal.monthly.at(-1).partial, true);
  const crossed = analyzeDailySeries([['2023-12-29', 100], ['2024-12-30', 150], ['2025-01-02', 151]], options);
  assert.equal(crossed.summary.missingDayCount, 1, 'A crossed missing session is counted only once');
  assert.equal(crossed.annual[1].coverageComplete, false, 'The missing year-end belongs to the prior year too');
  assert.equal(crossed.annual[1].partial, true);
  assert.equal(crossed.monthly.find(period => period.year === 2024).coverageComplete, false);
  const futureKnown = analyzeDailySeries([['2024-12-30', 150]], { ...options, asOfDate: '2024-12-30' });
  assert.equal(futureKnown.summary.missingDayCount, 0, 'A later missing report cannot leak into a prior as-of date');
});

test('invalid dates, prices, ordering and option identities fail before producing a report', () => {
  for (const price of [0, -1, NaN, Infinity, -Infinity, '100', null]) {
    assert.throws(() => analyzeDailySeries([['2024-01-01', price]]));
  }
  for (const input of [[], [['2024-02-30', 100]], [['2024-01-01', 100], ['2024-01-01', 110]], [['2024-01-02', 100], ['2024-01-01', 110]]]) {
    assert.throws(() => analyzeDailySeries(input));
  }
  assert.throws(() => analyzeDailySeries(rows([100]), { calendar: 'invented' }), /calendar/);
  assert.throws(() => analyzeDailySeries(rows([100]), { asOfDate: '2023-12-31' }), /precedes/);
  assert.throws(() => analyzeDailySeries(rows([100]), { asOfDate: '2024-02-30' }), /date/);
  assert.throws(() => analyzeDailySeries(rows([100]), { missingDates: ['2024-01-01'] }), /observed missing/);
  assert.throws(() => analyzeDailySeries(rows([100]), { missingDates: ['2024-01-03', '2024-01-03'] }), /Duplicate/);
  assert.throws(() => analyzeDailySeries(rows([Number.MIN_VALUE, Number.MAX_VALUE])), /overflow or underflow/);
  assert.throws(() => analyzeDailySeries(rows([Number.MAX_VALUE, Number.MIN_VALUE])), /overflow or underflow/);
});

test('the checked-in BTC fixture reconciles endpoint return, all-time MDD and causal count', async () => {
  const input = JSON.parse(await readFile(new URL('./fixtures/btc-daily-2026-10-20.json', import.meta.url), 'utf8'));
  const report = analyzeDailySeries(input);
  assert.equal(report.rows.length, input.prices.length);
  assert.equal(report.summary.missingDayCount, 0);
  close(report.summary.cumulativeReturnPct, (input.prices.at(-1)[1] / input.prices[0][1] - 1) * 100);
  const byDate = new Map(input.prices);
  assert.ok(report.summary.mddPeakDate < report.summary.mddTroughDate);
  close(report.summary.mddPct, (byDate.get(report.summary.mddTroughDate) / byDate.get(report.summary.mddPeakDate) - 1) * 100);
  const year2024 = report.annual.find(period => period.year === 2024);
  close(year2024.returnPct, (byDate.get('2024-12-31') / byDate.get('2023-12-31') - 1) * 100);
  assert.equal(year2024.partial, false);
  assert.equal(year2024.coverageComplete, true);
  assert.ok(report.annual.at(-1).partial);
});

test('risk-only analytics accepts flat subnormal prices without constructing removed indicators', () => {
  const report = analyzeDailySeries(rows(Array(240).fill(Number.MIN_VALUE)));
  assert.equal(report.summary.mddPct, 0);
  assert.equal(report.summary.cumulativeReturnPct, 0);
  assert.ok(report.rows.every(row => row.drawdownPct === 0));
  for (const row of report.rows) for (const field of ['signal', 'sma50', 'sma200', 'rsi14']) assert.equal(Object.hasOwn(row, field), false);
});
