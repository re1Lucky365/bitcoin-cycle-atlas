/** Descriptive cycle audit, independent arithmetic with chart parity checks.
 * Run: node scripts/research-cycle-table.mjs [--check]
 * This is not a trading-strategy backtest or a test of a future price law.
 */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { getMacroCycles } from '../dist/market-structure.js';

const root = new URL('../', import.meta.url);
const inputPath = new URL('dist/data/btc-daily.json', root);
const outputPath = new URL('docs/data/cycle-table-research.json', root);
const bytes = readFileSync(inputPath), input = JSON.parse(bytes);
const rows = input.prices.map(([date, price]) => ({ date, price }));
const day = date => Date.parse(`${date}T00:00:00Z`) / 86_400_000;
const extreme = (values, high) => values.reduce((best, row) =>
  (high ? row.price > best.price : row.price < best.price) ? row : best);
const window = (start, end) => rows.filter(row => row.date >= start && row.date <= end);
const afterYears = (date, years) => `${Number(date.slice(0, 4)) + years}${date.slice(4)}`;
const median = values => {
  const sorted = [...values].sort((a, b) => a - b), mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const mdd = values => {
  let peak = values[0], peakDate = peak.date, troughDate = peak.date, maximumLoss = 0;
  for (const row of values) {
    if (row.price > peak.price) peak = row;
    const loss = row.price / peak.price - 1;
    if (loss < maximumLoss) { maximumLoss = loss; peakDate = peak.date; troughDate = row.date; }
  }
  return { pct: maximumLoss * 100, peakDate, troughDate };
};

// These years deliberately match the chart's named, retrospective peak windows.
// Preserving that choice permits exact annotation parity; it does not remove
// selection bias or prove that an independent observer would pick these cycles.
const peakYears = [2011, 2013, 2017, 2021, 2025];
const peaks = peakYears.map(year => ({
  year, row: extreme(rows.filter(row => row.date.startsWith(`${year}-`)), true),
}));
let start = rows[0];
const independent = peaks.map(({ year, row: peak }, index) => {
  const nextPeak = peaks[index + 1]?.row ?? rows.at(-1);
  const end = extreme(window(peak.date, nextPeak.date), false);
  const bullDays = day(peak.date) - day(start.date), bearDays = day(end.date) - day(peak.date);
  const record = {
    peakYear: year, startDate: start.date, peakDate: peak.date, endDate: end.date,
    startPrice: start.price, peakPrice: peak.price, endPrice: end.price,
    bullDays, bearDays, cycleDays: bullDays + bearDays,
    bullVersus36MonthsDays: day(peak.date) - day(afterYears(start.date, 3)),
    bearVersus12MonthsDays: day(end.date) - day(afterYears(peak.date, 1)),
    leftCensored: index === 0, rightCensored: index === peaks.length - 1,
    complete: index > 0 && index < peaks.length - 1,
    risePathMdd: mdd(window(start.date, peak.date)),
    fullCycleMdd: mdd(window(start.date, end.date)),
    peakToTroughPct: (end.price / peak.price - 1) * 100,
  };
  start = end;
  return record;
});

const chart = getMacroCycles(input).cycles;
assert.equal(chart.length, independent.length);
independent.forEach((result, i) => {
  const expected = chart[i];
  assert.deepEqual([result.startDate, result.peakDate, result.endDate],
    [expected.start.date, expected.peak.date, expected.end.date]);
  assert.deepEqual([result.bullDays, result.bearDays, result.cycleDays],
    [expected.bullDays, expected.bearDays, expected.cycleDays]);
  assert.equal(result.complete, expected.complete);
  assert.equal(result.bullVersus36MonthsDays, expected.bullDeltaVersus36CalendarMonthsDays);
  assert.equal(result.bearVersus12MonthsDays, expected.bearDeltaVersus12CalendarMonthsDays);
});
const closed = independent.filter(row => row.complete);
const summarize = cycles => ({
  count: cycles.length,
  peakYears: cycles.map(row => row.peakYear),
  bullDays: { min: Math.min(...cycles.map(row => row.bullDays)), median: median(cycles.map(row => row.bullDays)), max: Math.max(...cycles.map(row => row.bullDays)) },
  bearDays: { min: Math.min(...cycles.map(row => row.bearDays)), median: median(cycles.map(row => row.bearDays)), max: Math.max(...cycles.map(row => row.bearDays)) },
  cycleDays: { min: Math.min(...cycles.map(row => row.cycleDays)), median: median(cycles.map(row => row.cycleDays)), max: Math.max(...cycles.map(row => row.cycleDays)) },
});
const report = {
  schemaVersion: 1,
  generatedBy: 'node scripts/research-cycle-table.mjs',
  baselineRevision: '3a1be8370a9fd9a71861be3f929493370f08a5ef',
  inputFile: 'dist/data/btc-daily.json',
  inputSha256: createHash('sha256').update(bytes).digest('hex'),
  source: { name: input.meta.sourceName, url: input.meta.source, metric: input.meta.metric, frequency: input.meta.frequency, retrievedAt: input.meta.retrievedAt },
  asOf: rows.at(-1).date,
  observationCount: rows.length,
  method: {
    peakSelection: 'Maximum daily Coin Metrics PriceUSD within each named peak year; earliest tie.',
    troughSelection: 'Minimum from this selected peak through the next selected peak, inclusive; latest cycle through asOf only.',
    duration: 'UTC elapsed days. No inclusive +1 and no forced 365-day year.',
    mdd: 'Minimum of price/runningPeak - 1 within the explicitly stated ordered daily-price window.',
    independentArithmetic: true,
    chartParityChecked: true,
    hypotheticalTradingPerformance: false,
    selectionIsRetrospective: true,
    cycleSelectionWasPreSpecifiedInChart: true,
    cyclesAreIndependentTrials: false,
  },
  cycles: independent,
  closed: summarize(closed),
  matureClosed: summarize(closed.filter(row => row.peakYear >= 2017)),
  interpretation: [
    'The closed mature cycles resemble roughly three years from selected low to high and one year from high to low, but n=2 is descriptive only.',
    'The early 2013 cycle is a counterexample to enforcing 36 rise months plus 12 fall months across the chart history.',
    'A positive low-to-high endpoint return does not mean monotonic rising prices; rise-path MDD is measured independently.',
    'The newest trough is provisional. Neither its timing nor its recovery makes the current cycle complete.',
    'These historical annotation choices are not real-time trade signals, causal halving effects, independent holdout tests, or probability estimates.',
  ],
};
const serialized = `${JSON.stringify(report, null, 2)}\n`;
if (process.argv.includes('--check')) assert.equal(readFileSync(outputPath, 'utf8'), serialized, 'Cycle research artifact is stale.');
else writeFileSync(outputPath, serialized);
console.log(JSON.stringify({ status: 'PASS', file: fileURLToPath(outputPath), asOf: report.asOf,
  closed: report.closed, matureClosed: report.matureClosed,
  risePathMdd: independent.map(row => ({ peakYear: row.peakYear, ...row.risePathMdd })) }, null, 2));
