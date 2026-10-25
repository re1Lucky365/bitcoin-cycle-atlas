import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

// Independent identities and alternative algorithms against the real modules.
// No result here establishes investment profitability or predictive calibration.
const root = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseline = process.env.SYSTEM_NUMERICAL_BASELINE;
const moduleAt = (name, directory = root) => import(pathToFileURL(path.join(directory, `dist/${name}.js`)));
const [{ analyzeDailySeries }, { calibrateCycleTiming }, { analyzeCycleTiming, shiftCalendarMonths }, treasury, detailed, long] = await Promise.all([
  moduleAt('daily-analytics'), moduleAt('cycle-calibration'), moduleAt('cycle-timing'), moduleAt('treasury-model'), moduleAt('detailed-forecast'), moduleAt('long-horizon-forecast'),
]);
const { aggregateCloseBars, computeRollingStates } = await moduleAt('market-structure');
const sourceFiles = ['dist/daily-analytics.js', 'dist/cycle-timing.js', 'dist/cycle-calibration.js', 'dist/market-structure.js', 'dist/treasury-model.js', 'dist/treasury-research.js', 'dist/detailed-forecast.js', 'dist/long-horizon-forecast.js'];
const dataFiles = ['dist/data/btc-daily.json', 'dist/data/eth-ohlc.json', 'dist/data/mstr-ohlc.json', 'dist/data/bmnr-ohlc.json'];
const hashes = async files => Object.fromEntries(await Promise.all(files.map(async file => [file, createHash('sha256').update(await readFile(path.join(root, file))).digest('hex')])));
const archives = Object.fromEntries(await Promise.all(dataFiles.map(async file => [path.basename(file).split('-')[0].toUpperCase(), JSON.parse(await readFile(path.join(root, file), 'utf8'))])));
let assertions = 0;
const errors = {};
function near(actual, expected, label, scale = Math.max(Math.abs(actual), Math.abs(expected)), absolute = 1e-8) {
  const error = Math.abs(actual - expected), tolerance = absolute + 128 * Number.EPSILON * Math.max(1, scale);
  assert.ok(Number.isFinite(actual) && Number.isFinite(expected) && error <= tolerance, `${label}: ${actual} != ${expected}; error ${error}, tolerance ${tolerance}`);
  assertions++;
  const category = label.split(':')[0];
  errors[category] = Math.max(errors[category] ?? 0, error);
}
function allFinite(value, label) {
  if (typeof value === 'number') { assert.ok(Number.isFinite(value), `${label} is non-finite`); assertions++; }
  else if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) allFinite(child, `${label}.${key}`);
}
function rawResidual(state, price) {
  return state.coinUnits * price + state.cashUsd + (state.otherAssetsUsd ?? 0)
    - (state.debtUsd ?? 0) - (state.preferredUsd ?? 0) - (state.otherLiabilitiesUsd ?? 0) - (state.nonControllingInterestUsd ?? 0);
}
const epoch = date => Date.parse(`${date}T00:00:00Z`) / 86400000;
const dateAt = day => new Date(day * 86400000).toISOString().slice(0, 10);
const normalized = (symbol, archive) => symbol === 'BTC' ? archive.prices
  : (symbol === 'ETH' ? archive.dailyHistory.candles : archive.candles).map(row => [row.date.slice(0, 10), row.close]);
// Reverse suffix minima are independent of the implementation's running peaks.
function reverseMdd(rows) {
  let trough = rows.length - 1, loss = 0, bestPeak = 0, bestTrough = 0;
  for (let index = rows.length - 1; index >= 0; index--) {
    if (rows[index][1] <= rows[trough][1]) trough = index;
    const candidate = (rows[index][1] - rows[trough][1]) / rows[index][1];
    if (candidate > loss || (candidate === loss && candidate > 0 && (trough < bestTrough || (trough === bestTrough && index < bestPeak)))) {
      loss = candidate; bestPeak = index; bestTrough = trough;
    }
  }
  return { mddPct: -100 * loss, peakDate: rows[bestPeak][0], troughDate: rows[bestTrough][0] };
}
const actualData = [];
for (const [symbol, archive] of Object.entries(archives)) {
  const prices = normalized(symbol, archive), calendar = ['BTC', 'ETH'].includes(symbol) ? 'daily' : 'sessions';
  const model = analyzeDailySeries(prices, { calendar, symbol }), oracle = reverseMdd(prices);
  near(model.summary.mddPct, oracle.mddPct, 'mdd:full-history');
  assert.equal(model.summary.mddPeakDate, oracle.peakDate); assert.equal(model.summary.mddTroughDate, oracle.troughDate);
  near(model.summary.cumulativeReturnPct, 100 * (prices.at(-1)[1] - prices[0][1]) / prices[0][1], 'returns:full-history');
  if (model.summary.cagrPct !== null) near(model.summary.cagrPct, 100 * (Math.pow(prices.at(-1)[1] / prices[0][1], 365.2425 / (epoch(prices.at(-1)[0]) - epoch(prices[0][0]))) - 1), 'cagr:full-history');
  for (const period of [...model.annual, ...model.monthly]) {
    const selected = prices.filter(([date]) => date >= period.baselineDate && date <= period.endDate), expected = reverseMdd(selected);
    near(period.mddPct, expected.mddPct, 'mdd:calendar-period');
    near(period.returnPct, 100 * (selected.at(-1)[1] - selected[0][1]) / selected[0][1], 'returns:calendar-period');
  }
  let identicalToBaseline = null;
  if (baseline) {
    const previous = await moduleAt('daily-analytics', baseline);
    const old = previous.analyzeDailySeries(prices, { calendar, symbol });
    old.rows = old.rows.map(({ sma50, sma200, rsi14, signal, ...risk }) => risk);
    assert.deepEqual(model, old);
    identicalToBaseline = true;
  }
  actualData.push({ symbol, count: prices.length, firstDate: prices[0][0], asOf: prices.at(-1)[0], ...oracle, cumulativeReturnPct: model.summary.cumulativeReturnPct, cagrPct: model.summary.cagrPct, annualPeriods: model.annual.length, monthlyPeriods: model.monthly.length, identicalRiskOutputsToBaseline: identicalToBaseline });
}

let randomState = 20261025;
const random = () => { randomState = Math.imul(randomState, 1664525) + 1013904223 >>> 0; return randomState / 2 ** 32; };
let generatedDrawdowns = 0, calendarComparisons = 0, treasuryOperations = 0;
for (let trial = 0; trial < 300; trial++) {
  const prices = Array.from({ length: 2 + Math.floor(random() * 20) }, (_, index) => [dateAt(epoch('2024-01-01') + index), 1 + Math.floor(random() * 10000)]);
  let brute = 0;
  for (let left = 0; left < prices.length; left++) for (let right = left; right < prices.length; right++) brute = Math.min(brute, 100 * (prices[right][1] - prices[left][1]) / prices[left][1]);
  near(analyzeDailySeries(prices).summary.mddPct, brute, 'mdd:brute-force'); generatedDrawdowns++;
}
for (const year of [0, 1, 4, 99, 100, 400, 1900, 2000, 2024, 9999]) for (const month of [1, 2, 3, 12]) for (const shift of [-13, -1, 0, 1, 13]) {
  const start = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-28`;
  const reference = new Date(`${start}T00:00:00Z`); reference.setUTCMonth(reference.getUTCMonth() + shift);
  if (reference.getUTCFullYear() < 0 || reference.getUTCFullYear() > 9999) assert.throws(() => shiftCalendarMonths(start, shift), RangeError);
  else assert.equal(shiftCalendarMonths(start, shift), reference.toISOString().slice(0, 10));
  calendarComparisons++;
}
for (let index = 0; index < 400; index++) {
  const state = { shares: 10 + Math.floor(random() * 10000), coinUnits: Math.floor(random() * 10000), cashUsd: Math.floor(random() * 100000), otherAssetsUsd: 700, debtUsd: Math.floor(random() * 100000), preferredUsd: 23, otherLiabilitiesUsd: 29, nonControllingInterestUsd: 31 };
  const price = 1 + Math.floor(random() * 1000), amount = Math.floor(random() * 150000), saleFee = index % 2 ? 0.005 : 0;
  const residual = rawResidual(state, price), scale = Math.abs(residual) + price * state.coinUnits + amount;
  const funded = treasury.fundCashOutflow(state, amount, price, saleFee);
  near(rawResidual(funded.state, price), residual - amount - funded.coinsSold * price * saleFee, 'accounting:expense-conservation', scale);
  assert.ok(funded.state.coinUnits >= 0 && funded.state.cashUsd >= 0 && funded.shortfall >= 0);
  const principal = Math.min(state.debtUsd, amount), repaid = treasury.repayPrincipal(state, principal, price, saleFee);
  near(rawResidual(repaid.state, price), residual - repaid.coinsSold * price * saleFee, 'accounting:principal-conservation', scale);
  const offerPrice = 1 + Math.floor(random() * 1000), feeRate = 0.02, newShares = 1 + Math.floor(random() * 1000), maxCoinUnits = state.coinUnits + Math.floor(random() * 100), investmentFraction = index % 3 === 0 ? 0 : index % 3 === 1 ? 0.5 : 1;
  const issued = treasury.issueCommon(state, { newShares, offerPrice, coinPrice: price, feeRate, investmentFraction, maxCoinUnits });
  const proceeds = (issued.shares - state.shares) * offerPrice * (1 - feeRate);
  near(rawResidual(issued, price), residual + proceeds, 'accounting:issuance-conservation', scale + proceeds);
  assert.ok(issued.coinUnits <= maxCoinUnits); treasuryOperations += 3;
}

// Legacy target interpolation is still a public model mode. The production
// daily asset-linked UI has its separate verify:treasury-paths verifier.
const legacyTreasury = [];
for (const symbol of ['MSTR', 'BMNR']) {
  const forecasts = treasury.buildTreasuryForecasts({ symbol, history: archives[symbol], endYear: 2035 });
  for (const [scenario, model] of Object.entries(forecasts)) {
    const settings = model.assumptions; let active = true, shockApplied = false, steps = 0;
    near(model.path[0].price, archives[symbol].candles.at(-1).close, 'accounting:observed-anchor');
    for (let index = 1; index < model.path.length; index++) {
      const previous = model.path[index - 1], current = model.path[index], a = previous.components, b = current.components;
      if (!active) { assert.equal(current.price, 0); continue; }
      const dt = (epoch(current.date) - epoch(previous.date)) / 365.25;
      const years = (epoch(current.date) - epoch(model.asOf)) / 365.25;
      const netReward = settings.stakingFraction * settings.stakingGross * (1 - settings.stakingAdvisoryFee) * (1 - settings.stakingOtherFee);
      const minted = a.coinUnits * (Math.pow(1 + netReward, dt) - 1);
      const sold = b.coinsSold - a.coinsSold, rewardSold = b.rewardsSold - a.rewardsSold, rewardCash = b.rewardSaleProceeds - a.rewardSaleProceeds;
      const capital = b.capitalRaised - a.capitalRaised;
      let slash = 0;
      if (settings.slashingLoss && !shockApplied && years >= 1) { slash = (a.coinUnits + minted - rewardSold) * settings.slashingLoss; shockApplied = true; }
      const coinTerms = [a.coinUnits, minted, -sold, -slash, capital * settings.investmentFraction / b.coinPrice];
      near(b.coinUnits, coinTerms.reduce((a, b) => a + b, 0), 'paths:coin-conservation', coinTerms.reduce((a, b) => a + Math.abs(b), 0), 1e-7);
      const expense = (settings.financingCarryUsd + settings.operatingExpenseUsd) * dt, principal = a.debtUsd - b.debtUsd, unpaid = b.otherLiabilitiesUsd - a.otherLiabilitiesUsd;
      const cashTerms = [a.cashUsd, rewardCash, capital * (1 - settings.investmentFraction), -expense, -principal, (sold - rewardSold) * b.coinPrice * (1 - settings.saleFee), unpaid];
      const scale = cashTerms.reduce((a, b) => a + Math.abs(b), 0) + a.capitalRaised + b.capitalRaised + (a.coinsSold + b.coinsSold) * b.coinPrice + a.seniorClaims + b.seniorClaims;
      near(b.cashUsd, cashTerms.reduce((a, b) => a + b, 0), 'paths:cash-conservation', scale, 1e-7);
      assert.ok(b.coinUnits <= settings.holdingPolicy.maxCoinUnits);
      const sharePriceScale = (b.grossAssets + b.seniorClaims) / b.shares * b.premium;
      near(current.price, current.valuationState === 'absorbed' ? 0 : Math.max(0, rawResidual(b, b.coinPrice)) / b.shares * b.premium, 'paths:price-identity', sharePriceScale, 1e-10);
      steps++; if (!current.price) active = false;
    }
    allFinite(model.path, `treasury.${symbol}.${scenario}`);
    legacyTreasury.push({ symbol, scenario, pathMode: model.pathMode, steps, points: model.path.length, financialAsOf: model.financialAsOf, asOf: model.asOf, insolvency: model.diagnostics.insolventAt, cap: settings.holdingPolicy.maxCoinUnits });
  }
}

const btc = archives.BTC, calibration = calibrateCycleTiming(btc);
const cutoffs = ['2016-07-09', '2020-05-11', '2024-04-20', '2025-10-06', '2026-06-30'];
for (const cutoff of cutoffs) assert.deepEqual(calibrateCycleTiming(btc, { asOf: cutoff }).series, calibration.series.filter(row => row.date <= cutoff));
const timing = analyzeCycleTiming(btc, { includeSensitivity: false });
const clock = timing.advances.calendarFourYear;
assert.equal(clock.peakAdvanceDays + clock.bearDurationShorteningDays, clock.troughAdvanceDays);
assert.equal(epoch(clock.projectedTroughDate) - epoch(timing.current.troughCandidate.date), clock.troughAdvanceDays);
if (baseline) {
  const previous = await moduleAt('market-structure', baseline);
  assert.deepEqual(computeRollingStates(btc), previous.computeRollingStates(btc));
  assert.deepEqual(aggregateCloseBars(btc, { frequency: 'monthly' }), previous.aggregateCloseBars(btc, { frequency: 'monthly' }));
}
const subsidy = height => height / 210000n >= 64n ? 0n : 5000000000n / 2n ** (height / 210000n);
let issuanceChecks = 0;
for (let era = 0; era <= 64; era++) for (const offset of [0, 1, 209999]) {
  const height = era * 210000 + offset; let total = 0n;
  for (let blockEra = 0; blockEra <= era && blockEra <= 64; blockEra++) {
    const remaining = BigInt(height) - BigInt(blockEra) * 210000n;
    const count = remaining < 210000n ? remaining : 210000n;
    total += count * subsidy(BigInt(blockEra) * 210000n);
  }
  assert.equal(long.bitcoinSubsidySatoshis(height), Number(subsidy(BigInt(height))));
  assert.equal(long.bitcoinSupplyBeforeHeight(height), Number(total) / 100000000); issuanceChecks++;
}

const currentDate = btc.prices.at(-1)[0];
const detailedOptions = { asOf: currentDate, referenceDate: dateAt(epoch(currentDate) + 1), displayEnd: dateAt(epoch(currentDate) + 90), sampleCount: 16, includeSamplePaths: true };
const forecast = detailed.buildDetailedForecast(btc, detailedOptions);
const altered = { ...btc, prices: [...btc.prices, [dateAt(epoch(currentDate) + 1), 1e100]] };
assert.deepEqual(forecast, detailed.buildDetailedForecast(altered, detailedOptions));
const quantile = (values, p) => { const sorted = [...values].sort((a, b) => a - b), index = p * (sorted.length - 1), lo = Math.floor(index), weight = index - lo; return Math.exp((1 - weight) * Math.log(sorted[lo]) + weight * Math.log(sorted[Math.ceil(index)])); };
for (let index = 0; index < forecast.path.length; index++) {
  const values = forecast.samplePaths.map(sample => sample.prices[index]);
  for (const [field, p] of [['lower', 0.1], ['median', 0.5], ['upper', 0.9]]) near(forecast.path[index][field], quantile(values, p), 'ensemble:log-quantile');
}
near(forecast.diagnostics.representativeMddPct, -reverseMdd(forecast.path.map(row => [row.date, row.price])).mddPct, 'forecast:MDD');
const horizon = long.buildLongHorizonForecast(btc, { sampleCount: 16 });
assert.equal(horizon.assumptions.envelopeQuantiles, null); assert.equal(horizon.assumptions.probability, null);
assert.equal(horizon.longHorizon.assumptions.historicalVintageBacktest, false);
for (const event of horizon.events) if (event.isPublishedSourcePrice) near(event.price, event.sourcePrices[event.publishedSourcePriceCase], 'long:source-anchor');
allFinite(forecast, 'detailed'); allFinite(horizon, 'long');

console.log(JSON.stringify({
  status: 'PASS', auditBaselineCommit: '64c8207cb044d8990289c5a7d39972e21b74c240', node: process.version,
  scope: 'Independent arithmetic/coverage/causality oracles on actual product modules, fixed archives and bounded generated inputs; not a universal floating-point proof or predictive-validation certificate.',
  regressionSuite: 'tests/system-numerical-regressions.test.mjs (run separately by npm test)',
  auditedFixes: [
    { id: 'NUM-01', module: 'dist/daily-analytics.js', boundary: 'An inferred daily gap crossing a year/month end must mark the prior observed period; explicit missingDates cannot double-count it. Exchange sessions require declared missing dates.' },
    { id: 'NUM-02', module: 'dist/cycle-timing.js', boundary: 'Calendar-month shifts preserve years 0000–0099 and reject results outside the accepted 0000–9999 date domain.' },
    { id: 'NUM-03', module: 'dist/market-structure.js', boundary: 'Stable median/slope/log-return/geometric-mean arithmetic retains representable answers; genuinely unrepresentable output metrics fail explicitly.' },
  ],
  proofClassification: { algebra: ['ordered peak-before-trough drawdown', 'expense, issuance and principal accounting identities', 'peak advance plus bear shortening equals trough advance'], boundedExecution: ['fixed archive comparisons', 'generated numeric cases', 'five causal clock prefixes', 'one seeded detailed ensemble and one long-horizon illustrative path'], unproved: ['universal floating-point correctness', 'forecast accuracy or probability calibration', 'signal profitability', 'financing availability and market liquidity'] },
  sourceHashes: await hashes(sourceFiles), dataHashes: await hashes(dataFiles), assertions, maxAbsoluteErrors: errors,
  realArchiveChecks: actualData, generated: { exhaustivePairMddSeries: generatedDrawdowns, calendarComparisons, treasuryOperations, bitcoinIssuanceHeights: issuanceChecks },
  legacyTreasuryPaths: legacyTreasury, treasuryDailyUiPathVerification: 'Separate scripts/verify-treasury-paths.mjs; this checker does not claim to rerun its daily asset-path integration coverage.',
  causalClockCutoffs: cutoffs, calendarIdentity: clock,
  marketStructureNormalFixtureIdenticalToBaseline: baseline ? true : null,
  detailedForecast: { asOf: forecast.asOf, days: forecast.horizonDays, sampleCount: forecast.samplePaths.length, appendedFutureCannotChangeCutoff: true, independentlyCheckedEnvelopeQuantiles: [0.1, 0.5, 0.9], representativeMddPct: forecast.diagnostics.representativeMddPct, probability: null },
  longHorizon: { asOf: horizon.asOf, endDate: horizon.displayEnd, points: horizon.path.length, valuationAnchors: horizon.events.length, probabilitiesCalibrated: false, isHistoricalVintageBacktest: false },
  limitations: ['Generated cases and deterministic fixtures cover finite domains, not all possible inputs.', 'Accounting conservation holds for the stated model operations, not omitted taxes, liquidity, convertible exercise or future financing access.', 'The bridge terminal price and external valuation curve are imposed conditions; numerical correctness does not prove market accuracy.', 'Daily close MDD excludes unobserved and intraday lows; stock outputs are split-adjusted price returns, not dividend-inclusive total returns.', 'Calendar identities are algebraic decompositions, not evidence that four-year cycles cause future prices.'],
}, null, 2));
