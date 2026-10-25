import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildAssetComparison, ASSET_JUDGMENTS, MIN_SAMPLE_YEARS, MAX_STALE_DAYS,
} from '../dist/asset-comparison.js';

let checks = 0;
function check(name, fn) { fn(); checks++; console.log(`PASS ${name}`); }
function near(actual, expected, tolerance = 1e-10) {
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);
}
function bundle(prices, { meta = {}, symbol = 'TEST', ...other } = {}) {
  return { version: 1, retrievedAt: '2026-01-05T22:00:00.000Z', assets: [{
    symbol, name: '검증 자산', group: '주식', category: '검증', currency: 'USD', prices,
    meta: { calendar: 'sessions', dataGranularity: '1d', adjustment: 'split-adjusted-close', ...meta }, ...other,
  }] };
}
function row(input, asOfDate = '2026-01-05') { return buildAssetComparison(input, { asOfDate }).rows[0]; }
function yearPrices(year, firstValues = [100, 200, 50], start = '01-02', tail = 100) {
  const values = [];
  for (let time = Date.parse(`${year}-${start}T00:00:00Z`); time <= Date.parse(`${year}-12-31T00:00:00Z`); time += 86400000) {
    const date = new Date(time);
    if (date.getUTCDay() === 0 || date.getUTCDay() === 6) continue;
    values.push([date.toISOString().slice(0, 10), firstValues[values.length] ?? tail]);
  }
  return values;
}
const baselineHistory = [2021, 2022, 2023, 2024, 2025].flatMap(year => yearPrices(year));
function stageBundle(latest = 100, history = baselineHistory) {
  return bundle([...history, ['2026-01-02', 100], ['2026-01-05', latest]]);
}
function calculated(result) {
  const { source, meta, ...values } = result;
  return values;
}

check('Public labels and operational thresholds are explicit and stable', () => {
  assert.deepEqual(Object.values(ASSET_JUDGMENTS), ['적극 매수', '분할 매수', '중립', '분할 매도', '적극 매도', '판단 보류']);
  assert.equal(MIN_SAMPLE_YEARS, 5);
  assert.equal(MAX_STALE_DAYS, 7);
  assert.deepEqual(row(stageBundle()).judgment.thresholds, { strongBuyPct: -50, buyPct: -25, sellPct: 50, strongSellPct: 100 });
});

check('Average fall is year-start-to-low, separately from ordered MDD', () => {
  const input = bundle([['2025-01-02', 100], ['2025-01-03', 150], ['2025-01-06', 90], ['2025-12-31', 120], ['2026-01-02', 120]]);
  const result = row(input);
  near(result.meanRisePct, 50);
  near(result.meanFallPct, -10);
  near(result.meanMddPct, -40);
  assert.equal(result.samples[0].mddPeakDate, '2025-01-03');
  assert.equal(result.samples[0].mddTroughDate, '2025-01-06');
  assert.notEqual(result.meanFallPct, result.meanMddPct);
});

check('A trough before a later high cannot become a peak-to-trough drawdown', () => {
  const result = row(bundle([['2025-01-02', 100], ['2025-01-03', 50], ['2025-01-06', 200], ['2026-01-02', 200]]));
  near(result.meanFallPct, -50);
  near(result.meanMddPct, -50);
  assert.equal(result.samples[0].mddPeakDate, '2025-01-02');
  assert.equal(result.samples[0].mddTroughDate, '2025-01-03');
  assert.notEqual(result.meanMddPct, -75);
});

check('Historical means weight each observed year equally regardless of session count', () => {
  const result = row(bundle([
    ['2023-01-02', 100], ['2023-01-03', 110],
    ['2024-01-02', 100], ['2024-01-03', 130], ['2024-01-04', 80],
    ['2026-01-02', 100], ['2026-01-05', 100],
  ]));
  near(result.meanRisePct, 20);
  near(result.meanFallPct, -10);
  assert.equal(result.sampleYears, 2);
  assert.deepEqual(result.coverage.missingYears, [2025]);
  assert.equal(result.judgment.available, false);
});

check('Current-year observations never enter prior-year means or sample counts', () => {
  const low = row(stageBundle(1)), high = row(stageBundle(1000000));
  assert.equal(low.sampleYears, 5);
  assert.equal(high.sampleYears, 5);
  assert.deepEqual(high.samples, low.samples);
  near(high.meanRisePct, low.meanRisePct);
  near(high.meanFallPct, low.meanFallPct);
  assert.ok(high.samples.every(sample => sample.year < 2026));
});

check('Year-start return uses the actual first current-year session, not December 31', () => {
  const history = baselineHistory.map(pair => [...pair]);
  history.at(-1)[1] = 200;
  const result = row(bundle([...history, ['2026-01-02', 80], ['2026-01-05', 100]]));
  assert.equal(result.yearStartDate, '2026-01-02');
  assert.equal(result.yearStartPrice, 80);
  assert.equal(result.latestPrice, 100);
  near(result.ytdPct, 25);
  assert.notEqual(result.ytdPct, -50);
});

check('Listing-year partial history counts once and is explicitly disclosed', () => {
  const history = [...yearPrices(2021, [100, 200, 50], '12-10'), ...[2022, 2023, 2024, 2025].flatMap(year => yearPrices(year))];
  const result = row(stageBundle(100, history));
  assert.equal(result.sampleYears, 5);
  assert.equal(result.sampleStartYear, 2021);
  assert.equal(result.sampleEndYear, 2025);
  assert.equal(result.samplePartialFirstYear, true);
  assert.equal(result.firstPartialStartDate, '2021-12-10');
  assert.equal(result.coverage.firstYearPartial, true);
  assert.equal(result.judgment.available, true);
  near(result.meanRisePct, 100);
  near(result.meanFallPct, -50);
});

check('Unavailable years are never manufactured to inflate the sample', () => {
  const history = baselineHistory.filter(([date]) => !date.startsWith('2023-'));
  const result = row(stageBundle(100, history));
  assert.equal(result.sampleYears, 4);
  assert.deepEqual(result.samples.map(sample => sample.year), [2021, 2022, 2024, 2025]);
  assert.deepEqual(result.coverage.missingYears, [2023]);
  assert.equal(result.coverage.complete, false);
  assert.equal(result.judgment.label, '판단 보류');
});

check('Every exact threshold has one stage and nearby unrounded values retain their side', () => {
  const cases = [
    [40, 'strong-buy'], [50, 'strong-buy'], [50.000001, 'buy'],
    [74.999999, 'buy'], [75, 'buy'], [75.000001, 'neutral'],
    [100, 'neutral'], [149.999999, 'neutral'], [150, 'sell'],
    [150.000001, 'sell'], [199.999999, 'sell'], [200, 'strong-sell'], [250, 'strong-sell'],
  ];
  for (const [price, id] of cases) assert.equal(row(stageBundle(price)).judgment.id, id, `latest ${price}`);
});

check('Five-stage partition is exhaustive and ordered over a finite positive-price sweep', () => {
  const order = ['strong-buy', 'buy', 'neutral', 'sell', 'strong-sell'];
  let previous = -1;
  const seen = new Set();
  for (let price = 1; price <= 250; price++) {
    const result = row(stageBundle(price)), index = order.indexOf(result.judgment.id);
    assert.ok(result.judgment.available && index >= previous && index >= 0);
    seen.add(result.judgment.id); previous = index;
  }
  assert.deepEqual([...seen], order);
});

check('Fewer than five annual samples and degenerate bands are unavailable, never fake neutral', () => {
  const fourYears = baselineHistory.filter(([date]) => date >= '2022-01-01');
  const tooShort = row(stageBundle(100, fourYears));
  assert.equal(tooShort.sampleYears, 4);
  assert.equal(tooShort.coverage.complete, true);
  assert.equal(tooShort.judgment.id, 'unavailable');
  assert.match(tooShort.judgment.reason, /최소 5/);
  for (const path of [[100, 100, 50], [100, 200, 100], [100, 100, 100]]) {
    const history = [2021, 2022, 2023, 2024, 2025].flatMap(year => yearPrices(year, path));
    const result = row(stageBundle(100, history));
    assert.equal(result.judgment.label, '판단 보류');
    assert.equal(result.judgment.available, false);
  }
});

check('As-of projection excludes all future prices, years and known future missing dates', () => {
  const prefix = stageBundle(125), extended = structuredClone(prefix);
  extended.assets[0].prices.push(['2026-01-06', 0.001], ['2026-12-31', 100000], ['2027-01-04', 1000000]);
  extended.assets[0].meta.missingDates = ['2026-01-07'];
  assert.deepEqual(calculated(row(extended)), calculated(row(prefix)));
  assert.equal(row(extended).observationCount, prefix.assets[0].prices.length);
  assert.equal(row(extended).latestDate, '2026-01-05');
});

check('Known stale data are rejected after seven calendar days, including year rollover', () => {
  assert.equal(row(stageBundle(), '2026-01-12').judgment.available, true);
  const stale = row(stageBundle(), '2026-01-13');
  assert.equal(stale.judgment.id, 'unavailable');
  assert.match(stale.judgment.reason, /7일/);
  const newYear = row(stageBundle(), '2027-01-02');
  assert.equal(newYear.yearStartDate, null);
  assert.equal(newYear.ytdPct, null);
  assert.equal(newYear.judgment.id, 'unavailable');
});

check('Known missing observations, large internal gaps and a late current baseline fail closed', () => {
  const missing = stageBundle();
  missing.assets[0].prices = missing.assets[0].prices.filter(([date]) => date !== '2024-06-10');
  missing.assets[0].meta.missingDates = ['2024-06-10'];
  assert.deepEqual(row(missing).coverage.missingDates, ['2024-06-10']);
  assert.equal(row(missing).judgment.available, false);
  const gap = stageBundle();
  gap.assets[0].prices = gap.assets[0].prices.filter(([date]) => date < '2024-06-10' || date > '2024-06-21');
  assert.ok(row(gap).coverage.gapCount > 0);
  assert.equal(row(gap).judgment.available, false);
  const late = bundle([...baselineHistory, ['2026-01-09', 100], ['2026-01-12', 120]]);
  assert.equal(row(late, '2026-01-12').judgment.id, 'unavailable');
  assert.ok(row(late, '2026-01-12').coverage.issues.some(issue => issue.includes('첫 주')));
});

check('Known gaps outside the available historical prefix do not contaminate an as-of result', () => {
  const input = stageBundle();
  input.assets[0].meta.missingDates = ['2000-01-03', '2026-01-06'];
  assert.deepEqual(row(input).coverage.missingDates, []);
  assert.equal(row(input).judgment.available, true);
});

check('Assets with no observations yet remain visible with unavailable metrics', () => {
  const result = row(bundle([['2027-01-04', 100]]));
  assert.equal(result.symbol, 'TEST');
  assert.equal(result.sampleYears, 0);
  assert.equal(result.meanRisePct, null);
  assert.equal(result.latestPrice, null);
  assert.equal(result.yearStartPrice, null);
  assert.equal(result.ytdPct, null);
  assert.equal(result.coverage.status, 'unavailable');
  assert.equal(result.judgment.label, '판단 보류');
});

check('Default as-of derives deterministically from a zoned retrieval timestamp', () => {
  const input = stageBundle();
  const originalNow = Date.now;
  try {
    Date.now = () => 0;
    assert.equal(buildAssetComparison(input).asOf, '2026-01-05');
    input.retrievedAt = '2026-01-05T23:30:00-09:00';
    assert.equal(buildAssetComparison(input).asOf, '2026-01-06');
  } finally { Date.now = originalNow; }
  for (const timestamp of ['not-a-date', '2026-02-30T00:00:00Z', '2026-01-05T00:00:00', '01/05/2026']) {
    input.retrievedAt = timestamp;
    assert.throws(() => buildAssetComparison(input));
  }
  delete input.retrievedAt;
  assert.equal(row(input).sampleYears, 5);
  assert.throws(() => buildAssetComparison(input));
});

check('Malformed prices, dates, order and impossible arithmetic cannot produce finite-looking judgments', () => {
  for (const price of [0, -1, NaN, Infinity, -Infinity, '100', null]) assert.throws(() => row(bundle([['2026-01-02', price]])));
  for (const prices of [[], new Array(2), [['2026-02-30', 100]], [['2026-01-02', 100, 3]], [['2026-01-02', 100], ['2026-01-02', 101]], [['2026-01-05', 100], ['2026-01-02', 101]]]) assert.throws(() => row(bundle(prices)));
  for (const path of [[Number.MIN_VALUE, Number.MAX_VALUE], [1, Number.MAX_VALUE], [Number.MAX_VALUE, Number.MIN_VALUE]]) {
    assert.throws(() => row(bundle([['2025-01-02', path[0]], ['2025-01-03', path[1]], ['2026-01-02', 100]])), /overflow|underflow|Non-finite/);
  }
});

check('Malformed or inconsistent asset contracts fail before rendering a misleading table', () => {
  for (const input of [null, {}, { version: 2, assets: [] }, { version: 1, assets: new Array(1) }]) assert.throws(() => row(input));
  const duplicate = stageBundle();
  duplicate.assets.push(structuredClone(duplicate.assets[0]));
  assert.throws(() => row(duplicate), /duplicate/);
  for (const overrides of [{ symbol: 'test' }, { symbol: new String('TEST') }, { name: '' }, { group: ' ' }, { category: null }, { currency: 'KRW' }, { meta: 'invalid' }, { meta: [] }]) {
    const input = stageBundle();
    Object.assign(input.assets[0], overrides);
    assert.throws(() => row(input));
  }
  for (const meta of [{ calendar: 'daily' }, { dataGranularity: '1mo' }, { granularity: '1wk' }, { adjustment: 'dividend-adjusted-close' }, { missingDates: ['2026-01-02'] }, { missingDates: ['2025-02-30'] }, { missingDates: ['2000-01-03', '2000-01-03'] }, { missingDates: '2025-01-02' }]) {
    assert.throws(() => row(bundle(stageBundle().assets[0].prices, { meta })));
  }
});

check('Equivalent positive unit changes preserve the calculated ranges and stages', () => {
  const input = stageBundle(50.000001), original = row(input);
  for (const scale of [0.125, 10, 1000000]) {
    const scaled = structuredClone(input);
    scaled.assets[0].prices = scaled.assets[0].prices.map(([date, price]) => [date, price * scale]);
    const result = row(scaled);
    for (const field of ['meanRisePct', 'meanFallPct', 'meanMddPct', 'ytdPct']) near(result[field], original[field]);
    assert.equal(result.judgment.id, original.judgment.id);
    assert.equal(result.sampleYears, original.sampleYears);
  }
});

check('Input prices and provenance remain unmodified', () => {
  const input = stageBundle(), copy = structuredClone(input);
  function freeze(value) { if (value && typeof value === 'object') { for (const item of Object.values(value)) freeze(item); Object.freeze(value); } return value; }
  freeze(input);
  row(input);
  assert.deepEqual(input, copy);
});

const published = JSON.parse(await readFile(new URL('../dist/data/asset-comparison.json', import.meta.url), 'utf8'));
check('A fresh year-end close on New Year’s Day is correctly unavailable before the first session', () => {
  const result = buildAssetComparison(published, { asOfDate: '2026-01-01' });
  assert.equal(result.rows.length, 18);
  for (const asset of result.rows) {
    if (asset.symbol === 'BTC') { assert.equal(asset.latestDate, '2026-01-01'); assert.equal(asset.yearStartDate, '2026-01-01'); continue; }
    assert.equal(asset.latestDate, '2025-12-31');
    assert.equal(asset.coverage.complete, true);
    assert.equal(asset.yearStartDate, null);
    assert.equal(asset.ytdPct, null);
    assert.equal(asset.judgment.id, 'unavailable');
    assert.match(asset.judgment.reason, /올해/);
  }
});

check('Published all-asset history has the real observed sample years and first-session baselines', () => {
  const result = buildAssetComparison(published, { asOfDate: '2026-10-25' });
  assert.deepEqual(result.rows.map(asset => asset.symbol), ['BTC', 'SPY', 'QQQ', 'NVDA', 'AAPL', 'GOOG', 'MSFT', 'AMZN', 'META', 'AVGO', 'PLTR', 'TSLA', 'HOOD', 'TLT', 'IEF', 'GLD', 'SLV', 'PDBC']);
  assert.deepEqual(result.rows.map(asset => asset.sampleYears), [16, 33, 27, 27, 46, 22, 40, 29, 14, 17, 6, 16, 5, 24, 24, 22, 20, 12]);
  assert.ok(result.rows.reduce((count, asset) => count + asset.observationCount, 0) > 97000);
  for (const asset of result.rows) {
    if (asset.symbol === 'BTC') { assert.equal(asset.yearStartDate, '2026-01-01'); assert.equal(asset.latestDate, '2026-10-23'); assert.equal(asset.coverage.status, 'observed'); assert.equal(asset.samplePartialFirstYear, true); continue; }
    assert.equal(asset.yearStartDate, '2026-01-02');
    assert.equal(asset.latestDate, '2026-10-23');
    assert.equal(asset.sampleEndYear, 2025);
    assert.equal(asset.samplePartialFirstYear, true);
    assert.equal(asset.coverage.status, 'observed');
    assert.equal(asset.judgment.available, true);
    assert.ok(asset.meanRisePct > 0 && asset.meanFallPct < 0);
    assert.ok(asset.samples.every(sample => sample.year < result.year && sample.mddPeakDate <= sample.mddTroughDate));
    assert.match(asset.source.responseSha256, /^[a-f0-9]{64}$/);
    assert.match(asset.source.priceDefinition, /dividends|distributions/);
  }
  assert.equal(result.rows.find(asset => asset.symbol === 'AAPL').sampleStartYear, 1980);
  assert.equal(result.rows.find(asset => asset.symbol === 'PDBC').firstPartialStartDate, '2014-11-07');
});

console.log(`Asset comparison: ${checks} checks passed.`);

check('BTC uses complete UTC calendar days, includes leap days, and never borrows exchange-session rules', () => {
  const btc = buildAssetComparison(published, { asOfDate: '2026-10-26' }).rows[0];
  assert.equal(btc.symbol, 'BTC'); assert.equal(btc.yearStartDate, '2026-01-01');
  assert.equal(btc.source.url, published.assets[0].meta.source);
  assert.equal(btc.source.responseSha256, published.assets[0].meta.rawSha256);
  assert.equal(btc.sampleYears, 16); assert.equal(btc.samplePartialFirstYear, true);
  assert.equal(btc.samples.find(sample => sample.year === 2012).count, 366);
  assert.equal(btc.coverage.complete, true); assert.equal(btc.coverage.gapCount, 0);
  const gapBundle = structuredClone(published); gapBundle.assets[0].prices.splice(gapBundle.assets[0].prices.findIndex(([date]) => date === '2024-02-29'), 1);
  const gap = buildAssetComparison(gapBundle, { asOfDate: '2026-10-26' }).rows[0];
  assert.equal(gap.coverage.complete, false); assert.equal(gap.coverage.gapCount, 1); assert.equal(gap.judgment.id, 'unavailable');
  assert.match(gap.coverage.issues.find(issue => issue.includes('달력일')), /하루를 넘는 UTC 달력일 관측 간격 1개/);
  const twoDayGap = structuredClone(published); twoDayGap.assets[0].prices.splice(twoDayGap.assets[0].prices.findIndex(([date]) => date === '2024-02-29'), 1);
  const oneGapDayRow = buildAssetComparison(twoDayGap, { asOfDate: '2026-10-26' }).rows[0];
  assert.equal(oneGapDayRow.coverage.gapCount, 1);
  assert.match(oneGapDayRow.coverage.issues.find(issue => issue.includes('달력일')), /달력일 관측 간격 1개/);
  const eightDayGap = structuredClone(published); eightDayGap.assets[0].prices = eightDayGap.assets[0].prices.filter(([date]) => date < '2024-02-20' || date > '2024-02-26');
  const eightDayAdjacency = eightDayGap.assets[0].prices.filter(([date]) => date >= '2024-02-19' && date <= '2024-02-27').map(([date]) => date);
  assert.deepEqual(eightDayAdjacency, ['2024-02-19', '2024-02-27']);
  const eightGapRow = buildAssetComparison(eightDayGap, { asOfDate: '2026-10-26' }).rows[0];
  assert.equal(eightGapRow.coverage.gapCount, 1);
  assert.match(eightGapRow.coverage.issues.find(issue => issue.includes('달력일')), /달력일 관측 간격 1개/);
  assert.equal(btc.latestDate, '2026-10-23'); assert.equal(btc.judgment.available, true);
  const lateStart = structuredClone(published); lateStart.assets[0].prices = lateStart.assets[0].prices.filter(([date]) => date !== '2026-01-01');
  const noJanFirst = buildAssetComparison(lateStart, { asOfDate: '2026-10-26' }).rows[0];
  assert.equal(noJanFirst.coverage.complete, false); assert.equal(noJanFirst.judgment.id, 'unavailable');
  const stale = buildAssetComparison(published, { asOfDate: '2026-10-31' }).rows[0];
  assert.equal(stale.latestDate, '2026-10-23'); assert.equal(stale.judgment.id, 'unavailable');
  assert.match(stale.judgment.reason, /7일 넘게/);
});
