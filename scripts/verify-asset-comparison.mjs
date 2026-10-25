import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { buildAssetComparison } from '../dist/asset-comparison.js';

// Bounded verification of the exported production JavaScript, not a claim of
// profitable trading or an independently certified exchange-session calendar.
// The oracle uses year grouping, extrema and all ordered observation pairs;
// it does not import the engine's date, mean, drawdown or classification helpers.
const engineUrl = new URL('../dist/asset-comparison.js', import.meta.url);
const dataUrl = new URL('../dist/data/asset-comparison.json', import.meta.url);
const [engineSource, dataSource] = await Promise.all([readFile(engineUrl, 'utf8'), readFile(dataUrl, 'utf8')]);
const published = JSON.parse(dataSource);
const started = performance.now();
const closeEnough = (actual, expected, label) => {
  if (expected === null) return assert.equal(actual, null, label);
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= 1e-9 * Math.max(1, Math.abs(expected)), `${label}: ${actual} != ${expected}`);
};

function reference(prices, asOf) {
  const prefix = prices.filter(([date]) => date <= asOf), year = Number(asOf.slice(0, 4));
  const years = [...new Set(prefix.map(([date]) => Number(date.slice(0, 4))))].filter(value => value < year).sort((a, b) => a - b);
  const samples = years.map(sampleYear => {
    const observations = prefix.filter(([date]) => Number(date.slice(0, 4)) === sampleYear);
    const values = observations.map(([, price]) => price), base = values[0];
    const rise = 100 * (Math.max(...values) - base) / base;
    const fall = 100 * (Math.min(...values) - base) / base;
    let mdd = 0;
    for (let earlier = 0; earlier < values.length; earlier++) {
      for (let later = earlier; later < values.length; later++) {
        mdd = Math.min(mdd, 100 * (values[later] - values[earlier]) / values[earlier]);
      }
    }
    return { year: sampleYear, count: values.length, rise, fall, mdd, start: observations[0][0], end: observations.at(-1)[0] };
  });
  const average = key => samples.length ? samples.reduce((sum, sample) => sum + sample[key], 0) / samples.length : null;
  const current = prefix.filter(([date]) => Number(date.slice(0, 4)) === year);
  const first = current[0] ?? null, latest = prefix.at(-1) ?? null;
  return { prefix, samples, rise: average('rise'), fall: average('fall'), mdd: average('mdd'), first, latest, ytd: first && latest ? 100 * (latest[1] - first[1]) / first[1] : null };
}

function referencePrerequisites(asset, expected, asOf) {
  const year = Number(asOf.slice(0, 4)), first = expected.prefix[0], day = date => Date.parse(`${date}T00:00:00Z`) / 86400000;
  const years = new Set(expected.samples.map(sample => sample.year));
  const noAbsentYears = !first || Array.from({ length: Math.max(0, year - Number(first[0].slice(0, 4))) }, (_, index) => Number(first[0].slice(0, 4)) + index).every(value => years.has(value));
  const noLargeGaps = expected.prefix.every(([date], index, observations) => index === 0 || day(date) - day(observations[index - 1][0]) <= (asset.meta?.calendar === 'calendar-days' ? 1 : 7));
  const noKnownMissing = !(asset.meta?.missingDates ?? []).some(date => first && date >= first[0] && date <= asOf);
  const currentStartsInFirstWeek = !expected.first || (asset.meta?.calendar === 'calendar-days' ? expected.first[0] === `${year}-01-01` : expected.first[0] <= `${year}-01-07`);
  const complete = Boolean(first && noAbsentYears && noLargeGaps && noKnownMissing && currentStartsInFirstWeek);
  const available = Boolean(
    complete && expected.first && expected.latest && Number(expected.latest[0].slice(0, 4)) === year &&
    day(asOf) - day(expected.latest[0]) <= 7 && expected.samples.length >= 5 &&
    expected.rise > 0 && expected.fall < 0 && Number.isFinite(expected.ytd)
  );
  return { complete, available };
}

function compareReference(input, asOf = '2026-01-05', build = buildAssetComparison) {
  const model = build(input, { asOfDate: asOf });
  for (let index = 0; index < input.assets.length; index++) {
    const actual = model.rows[index], expected = reference(input.assets[index].prices, asOf), label = actual.symbol;
    assert.equal(actual.sampleYears, expected.samples.length, `${label}: observed annual sample count`);
    closeEnough(actual.meanRisePct, expected.rise, `${label}: equal-year average rise`);
    closeEnough(actual.meanFallPct, expected.fall, `${label}: equal-year average fall`);
    closeEnough(actual.meanMddPct, expected.mdd, `${label}: independent ordered-pair MDD`);
    closeEnough(actual.ytdPct, expected.ytd, `${label}: first-session current return`);
    assert.equal(actual.yearStartDate, expected.first?.[0] ?? null, `${label}: current-year first observed date`);
    assert.equal(actual.latestDate, expected.latest?.[0] ?? null, `${label}: as-of last observed date`);
    const prerequisites = referencePrerequisites(input.assets[index], expected, asOf);
    assert.equal(actual.coverage.complete, prerequisites.complete, `${label}: independent coverage prerequisites`);
    assert.equal(actual.judgment.available, prerequisites.available, `${label}: independent judgment prerequisites`);
    if (prerequisites.available) assert.deepEqual(intervalMembers(expected.ytd, expected.rise, expected.fall), [actual.judgment.id], `${label}: independent interval membership`);
    else assert.equal(actual.judgment.id, 'unavailable', `${label}: absent prerequisites cannot produce a trading stage`);
    for (let sampleIndex = 0; sampleIndex < expected.samples.length; sampleIndex++) {
      const sample = actual.samples[sampleIndex], oracle = expected.samples[sampleIndex];
      assert.equal(sample.year, oracle.year);
      assert.equal(sample.count, oracle.count);
      assert.equal(sample.startDate, oracle.start);
      assert.equal(sample.endDate, oracle.end);
      closeEnough(sample.risePct, oracle.rise, `${label}/${sample.year}: rise`);
      closeEnough(sample.fallPct, oracle.fall, `${label}/${sample.year}: fall`);
      closeEnough(sample.mddPct, oracle.mdd, `${label}/${sample.year}: ordered MDD`);
      assert.ok(sample.risePct >= 0 && sample.fallPct <= 0 && sample.mddPct <= sample.fallPct + 1e-9);
      assert.ok(sample.mddPeakDate <= sample.mddTroughDate, `${label}/${sample.year}: MDD chronology`);
    }
  }
  return model;
}

function bundle(prices, meta = {}) {
  return { version: 1, retrievedAt: '2026-01-05T22:00:00Z', assets: [{
    symbol: 'TEST', name: '검증', group: '주식', category: '검증', currency: 'USD', prices,
    meta: { calendar: 'sessions', dataGranularity: '1d', adjustment: 'split-adjusted-close', ...meta },
  }] };
}
function yearPrices(year, initial = [100, 200, 50], tail = 100) {
  const values = [];
  for (let time = Date.parse(`${year}-01-02T00:00:00Z`); time <= Date.parse(`${year}-12-31T00:00:00Z`); time += 86400000) {
    const day = new Date(time);
    if (![0, 6].includes(day.getUTCDay())) values.push([day.toISOString().slice(0, 10), initial[values.length] ?? tail]);
  }
  return values;
}
const history = [2021, 2022, 2023, 2024, 2025].flatMap(year => yearPrices(year));
const stageBundle = (price = 100, past = history) => bundle([...past, ['2026-01-02', 100], ['2026-01-05', price]]);
const buildRow = (build, input = stageBundle(), asOfDate = '2026-01-05') => build(input, { asOfDate }).rows[0];
const newYear = compareReference(stageBundle(), '2026-01-01').rows[0];
assert.equal(newYear.latestDate, '2025-12-31');
assert.equal(newYear.coverage.complete, true);
assert.equal(newYear.yearStartDate, null);
assert.equal(newYear.judgment.id, 'unavailable', 'fresh new-year archive without a first current-year close is correctly unavailable');

function* paths(length, prefix = []) {
  if (prefix.length === length) { yield prefix; return; }
  for (const value of [50, 100, 150]) yield* paths(length, [...prefix, value]);
}
let finitePaths = 0;
for (let length = 2; length <= 5; length++) {
  for (const path of paths(length)) {
    // Constant padding changes neither extrema nor ordered maximum drawdown;
    // it merely provides dense synthetic weekday coverage for the full year.
    const input = bundle([...yearPrices(2025, path, path.at(-1)), ['2026-01-02', 100], ['2026-01-05', 100]]);
    compareReference(input);
    finitePaths++;
  }
}
assert.equal(finitePaths, 360);

// Independently describe each interval and count membership. A five-way if/else
// copied from production would miss overlapping or uncovered boundaries.
function intervalMembers(returnPct, rise, fall) {
  return [
    ['strong-buy', returnPct <= fall],
    ['buy', returnPct > fall && returnPct <= fall / 2],
    ['neutral', returnPct > fall / 2 && returnPct < rise / 2],
    ['sell', returnPct >= rise / 2 && returnPct < rise],
    ['strong-sell', returnPct >= rise],
  ].filter(([, member]) => member).map(([id]) => id);
}
const thresholdPrices = [...Array.from({ length: 250 }, (_, index) => index + 1), 49.999999, 50, 50.000001, 74.999999, 75, 75.000001, 149.999999, 150, 150.000001, 199.999999, 200, 200.000001];
const stageOrder = ['strong-buy', 'buy', 'neutral', 'sell', 'strong-sell'];
let priorStage = -1;
for (const price of [...thresholdPrices].sort((a, b) => a - b)) {
  const actual = buildRow(buildAssetComparison, stageBundle(price));
  const members = intervalMembers(price - 100, 100, -50);
  assert.equal(members.length, 1, `exactly one threshold interval for ${price}`);
  assert.equal(actual.judgment.id, members[0], `threshold membership for ${price}`);
  assert.equal(actual.judgment.available, true);
  const stage = stageOrder.indexOf(actual.judgment.id);
  assert.ok(stage >= priorStage, 'stage order is monotone with current return at fixed bands');
  priorStage = stage;
}

const afterTrough = bundle([['2025-01-02', 100], ['2025-01-03', 50], ['2025-01-06', 200], ['2026-01-02', 100]]);
const differentDrawdown = bundle([['2025-01-02', 100], ['2025-01-03', 150], ['2025-01-06', 90], ['2026-01-02', 100]]);
const unequalYears = bundle([['2023-01-02', 100], ['2023-01-03', 110], ['2024-01-02', 100], ['2024-01-03', 130], ['2024-01-04', 80], ['2026-01-02', 100]]);
const priorClose = stageBundle();
priorClose.assets[0].prices.at(-3)[1] = 200;
priorClose.assets[0].prices.at(-2)[1] = 80;
const future = stageBundle(125);
future.assets[0].prices.push(['2026-01-06', 10000]);
const missing = stageBundle();
missing.assets[0].prices = missing.assets[0].prices.filter(([date]) => date !== '2024-06-10');
missing.assets[0].meta.missingDates = ['2024-06-10'];
const short = stageBundle(100, history.filter(([date]) => date >= '2022-01-01'));
const absentYear = stageBundle(100, history.filter(([date]) => !date.startsWith('2023-')));
const monthly = stageBundle();
monthly.assets[0].meta.dataGranularity = '1mo';

const negativeControls = [
  {
    id: 'current-year-enters-history',
    before: 'const samples = periods.filter(period => period.year < year);',
    after: 'const samples = periods.filter(period => period.year <= year);',
    property: build => assert.equal(buildRow(build).sampleYears, 5, 'control: historical exclusion'),
    failure: 'control: historical exclusion',
  },
  {
    id: 'previous-year-close-baseline',
    before: 'const current = prices.find(point => yearOf(point.date) === year) ?? null;',
    after: 'const current = prices.findLast(point => yearOf(point.date) < year) ?? null;',
    property: build => closeEnough(buildRow(build, priorClose).ytdPct, 25, 'control: first-session baseline'),
    failure: 'control: first-session baseline',
  },
  {
    id: 'unordered-extrema-called-mdd',
    before: 'mddPct: period.mddPct, mddPeakDate: period.mddPeak.date,',
    after: 'mddPct: percentage(period.low.price, period.high.price), mddPeakDate: period.mddPeak.date,',
    property: build => closeEnough(buildRow(build, afterTrough).meanMddPct, -50, 'control: ordered MDD'),
    failure: 'control: ordered MDD',
  },
  {
    id: 'fall-mislabeled-as-mdd',
    before: 'fallPct: percentage(period.low.price, period.first.price),',
    after: 'fallPct: period.mddPct,',
    property: build => closeEnough(buildRow(build, differentDrawdown).meanFallPct, -10, 'control: first-close fall'),
    failure: 'control: first-close fall',
  },
  {
    id: 'minimum-sample-guard-removed',
    before: 'if (sampleYears < MIN_SAMPLE_YEARS)',
    after: 'if (sampleYears < 0)',
    property: build => assert.equal(buildRow(build, short).judgment.available, false, 'control: minimum samples'),
    failure: 'control: minimum samples',
  },
  {
    id: 'freshness-guard-removed',
    before: 'if (asOfDay - latest.epochDay > MAX_STALE_DAYS)',
    after: 'if (false)',
    property: build => assert.equal(buildRow(build, stageBundle(), '2026-01-13').judgment.available, false, 'control: freshness'),
    failure: 'control: freshness',
  },
  {
    id: 'as-of-filter-removed',
    before: 'all.filter(point => point.epochDay <= asOfDay)',
    after: 'all',
    property: build => assert.equal(buildRow(build, future).latestDate, '2026-01-05', 'control: as-of prefix'),
    failure: 'control: as-of prefix',
  },
  {
    id: 'half-fall-threshold-changed',
    before: 'buyPct: meanFallPct / 2',
    after: 'buyPct: meanFallPct / 3',
    property: build => assert.equal(buildRow(build, stageBundle(80)).judgment.id, 'neutral', 'control: half-band threshold'),
    failure: 'control: half-band threshold',
  },
  {
    id: 'rounding-before-classification',
    before: 'const ytdPct = current && latest ? percentage(latest.price, current.price) : null;',
    after: 'const ytdPct = current && latest ? Math.round(percentage(latest.price, current.price)) : null;',
    property: build => assert.equal(buildRow(build, stageBundle(149.999999)).judgment.id, 'neutral', 'control: unrounded comparison'),
    failure: 'control: unrounded comparison',
  },
  {
    id: 'absent-year-count-padded',
    before: 'const sampleYears = samples.length;',
    after: 'const sampleYears = samples.length ? year - samples[0].year : 0;',
    property: build => assert.equal(buildRow(build, absentYear).sampleYears, 4, 'control: observed-year count'),
    failure: 'control: observed-year count',
  },
  {
    id: 'session-weighted-instead-of-year-weighted',
    before: 'const meanRisePct = mean(samples.map(period => period.risePct));',
    after: 'const meanRisePct = mean(samples.flatMap(period => Array(period.count).fill(period.risePct)));',
    property: build => closeEnough(buildRow(build, unequalYears).meanRisePct, 20, 'control: equal-year mean'),
    failure: 'control: equal-year mean',
  },
  {
    id: 'known-missing-sessions-ignored',
    before: 'if (missingDates.length) issues.push',
    after: 'if (false) issues.push',
    property: build => assert.equal(buildRow(build, missing).judgment.available, false, 'control: known missing date'),
    failure: 'control: known missing date',
  },
  {
    id: 'monthly-prices-accepted',
    before: "if (granularity !== undefined && granularity !== '1d')",
    after: 'if (false)',
    property: build => assert.throws(() => buildRow(build, monthly), /daily source/, 'control: daily granularity'),
    failure: 'control: daily granularity',
  },
  {
    id: 'exact-buy-boundary-uncovered',
    before: 'else if (ytdPct <= thresholds.buyPct)',
    after: 'else if (ytdPct < thresholds.buyPct)',
    property: build => assert.equal(buildRow(build, stageBundle(75)).judgment.id, 'buy', 'control: inclusive buy boundary'),
    failure: 'control: inclusive buy boundary',
  },
];
const killedMutations = [];
for (const control of negativeControls) {
  control.property(buildAssetComparison);
  assert.equal(engineSource.split(control.before).length - 1, 1, `unique mutation target: ${control.id}`);
  const mutated = engineSource.replace(control.before, control.after).replace(
    "from './cycle-engine.js?v=1.19.0'",
    `from '${new URL('../dist/cycle-engine.js?v=1.19.0', import.meta.url).href}'`,
  );
  const module = await import(`data:text/javascript;base64,${Buffer.from(`${mutated}\n//# sourceURL=asset-comparison-${control.id}.js`).toString('base64')}`);
  let intendedFailure = false;
  try { control.property(module.buildAssetComparison); }
  catch (error) {
    assert.equal(error.code, 'ERR_ASSERTION', `mutation ${control.id} failed for an unrelated exception`);
    assert.ok(error.message.includes(control.failure), `mutation ${control.id} failed outside its intended invariant: ${error.message}`);
    intendedFailure = true;
  }
  assert.equal(intendedFailure, true, `mutation survived: ${control.id}`);
  killedMutations.push(control.id);
}

const requestedAsOf = process.argv.find(argument => argument.startsWith('--as-of='))?.slice('--as-of='.length);
const asOf = requestedAsOf ?? new Date(published.retrievedAt).toISOString().slice(0, 10);
const order = ['BTC', 'SPY', 'QQQ', 'NVDA', 'AAPL', 'GOOG', 'MSFT', 'AMZN', 'META', 'AVGO', 'PLTR', 'TSLA', 'HOOD', 'TLT', 'IEF', 'GLD', 'SLV', 'PDBC'];
const model = compareReference(published, asOf);
assert.deepEqual(model.rows.map(asset => asset.symbol), order);
for (const asset of model.rows) {
  assert.ok(asset.samples.every(sample => sample.year < model.year));
  const firstYearPartial = Boolean(asset.sampleYears && (asset.meta.calendar === 'calendar-days' ? asset.firstDate.slice(5) !== '01-01' : asset.firstDate.slice(5) > '01-07'));
  assert.equal(asset.samplePartialFirstYear, firstYearPartial);
  assert.equal(asset.firstPartialStartDate, firstYearPartial ? asset.firstDate : null);
}
if (model.year === 2026) assert.deepEqual(model.rows.map(asset => asset.sampleYears), [16, 33, 27, 27, 46, 22, 40, 29, 14, 17, 6, 16, 5, 24, 24, 22, 20, 12]);

// A second successful production run follows every negative control. Measure
// only the pure build, excluding JSON parsing, oracle work and rendering.
const buildStarted = performance.now();
const finalModel = buildAssetComparison(published, { asOfDate: asOf });
const buildMs = performance.now() - buildStarted;
assert.deepEqual(finalModel, model, 'production model is deterministic after negative controls');
const report = {
  status: 'pass', scope: 'bounded production-JavaScript verification; no trading-profit or probability proof',
  asOf, assets: model.rows.length, observations: model.rows.reduce((total, asset) => total + asset.observationCount, 0),
  annualSamples: model.rows.reduce((total, asset) => total + asset.sampleYears, 0),
  finitePaths, thresholdCases: thresholdPrices.length,
  negativeControls: killedMutations.length, killedMutations,
  engineSha256: createHash('sha256').update(engineSource).digest('hex'),
  bundleSha256: createHash('sha256').update(dataSource).digest('hex'),
  buildMs: Number(buildMs.toFixed(3)), verificationMs: Number((performance.now() - started).toFixed(3)),
  rows: model.rows.map(asset => ({
    symbol: asset.symbol, sampleYears: asset.sampleYears, sampleStartYear: asset.sampleStartYear,
    sampleEndYear: asset.sampleEndYear, firstPartialStartDate: asset.firstPartialStartDate,
    meanRisePct: asset.meanRisePct, meanFallPct: asset.meanFallPct, meanMddPct: asset.meanMddPct,
    yearStartDate: asset.yearStartDate, latestDate: asset.latestDate, ytdPct: asset.ytdPct,
    judgment: asset.judgment.label, coverage: asset.coverage.status,
  })),
};
if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
else {
  console.log(`PASS independent reference: ${report.assets} assets, ${report.observations.toLocaleString('en-US')} closes, ${report.annualSamples} annual samples`);
  console.log(`PASS bounded domains: ${finitePaths} price paths, ${thresholdPrices.length} threshold cases`);
  console.log(`PASS negative controls: ${killedMutations.length}/${negativeControls.length} targeted mutants rejected at their intended assertions`);
  console.log(`PASS production rerun: ${buildMs.toFixed(1)} ms pure build; ${report.verificationMs.toFixed(1)} ms entire verifier`);
  console.log(`Engine SHA-256 ${report.engineSha256}`);
  console.log(`Bundle SHA-256 ${report.bundleSha256}`);
  const formatPct = value => value === null ? '—' : `${value.toFixed(2)}%`;
  for (const asset of report.rows) console.log(`${asset.symbol}\t${asset.sampleYears}\t${formatPct(asset.meanRisePct)}\t${formatPct(asset.meanFallPct)}\t${formatPct(asset.ytdPct)}\t${asset.judgment}`);
}
