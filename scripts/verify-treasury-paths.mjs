import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath, pathToFileURL} from 'node:url';
import path from 'node:path';

const root = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DAY = 86400000;
const SCENARIOS = ['stress', 'base', 'bull'];
const asOf = '2026-10-23';
const endYear = 2050;
const seed = 20261022;
const readJson = async file => JSON.parse(await readFile(path.join(root, file), 'utf8'));
const sources = ['scripts/verify-treasury-paths.mjs', 'dist/treasury-asset-paths.js', 'dist/treasury-model.js', 'dist/long-horizon-forecast.js', 'dist/long-horizon-evidence.js', 'dist/detailed-forecast.js', 'dist/cycle-calibration.js', 'dist/cycle-engine.js', 'dist/cycle-timing.js', 'dist/market-structure.js', 'dist/treasury-research.js', 'dist/treasury-catalog.js'];
const inputs = ['dist/data/btc-daily.json', 'dist/data/eth-ohlc.json', 'dist/data/mstr-ohlc.json', 'dist/data/bmnr-ohlc.json', 'research-data/treasury-mstr.json', 'research-data/treasury-bmnr.json'];
const hashes = async files => Object.fromEntries(await Promise.all(files.map(async file => [file, createHash('sha256').update(await readFile(path.join(root, file))).digest('hex')])));
const sourceHashes = await hashes(sources);
const inputHashes = await hashes(inputs);
const {buildTreasuryAssetPaths} = await import(pathToFileURL(path.join(root, 'dist/treasury-asset-paths.js')));
const {buildTreasuryForecasts} = await import(pathToFileURL(path.join(root, 'dist/treasury-model.js')));
const {buildLongHorizonForecast} = await import(pathToFileURL(path.join(root, 'dist/long-horizon-forecast.js')));
const {LONG_HORIZON_REVIEW_DATE} = await import(pathToFileURL(path.join(root, 'dist/long-horizon-evidence.js')));
const btcHistory = await readJson('dist/data/btc-daily.json');
const ethHistory = await readJson('dist/data/eth-ohlc.json');
const maxAbsoluteErrors = {};
const counts = {activeSteps: 0, absorbedSteps: 0, financingSteps: 0, rewardSaleSteps: 0, debtRepayments: 0};
const checks = [];

function near(actual, expected, label, scale = 1, field = label) {
  const error = Math.abs(actual - expected);
  const tolerance = 1e-7 + 64 * Number.EPSILON * Math.max(1, scale, Math.abs(actual), Math.abs(expected));
  maxAbsoluteErrors[field] = Math.max(maxAbsoluteErrors[field] || 0, error);
  assert.ok(Number.isFinite(actual) && Number.isFinite(expected) && error <= tolerance, `${label}: ${actual} vs ${expected}, error ${error}, tolerance ${tolerance}`);
}

function auditBalances(forecast) {
  const s = forecast.assumptions;
  const start = Date.parse(forecast.asOf);
  const first = forecast.path[0];
  let active = first.price > 0;
  let slashed = false;
  for (let index = 0; index < forecast.path.length; index++) {
    const point = forecast.path[index];
    const b = point.components;
    const label = `${forecast.symbol}/${forecast.scenario.id}/${point.date}`;
    for (const [key, value] of Object.entries(b)) if (typeof value === 'number') assert.ok(Number.isFinite(value), `${label}.${key} must be finite`);
    assert.ok(b.coinUnits >= 0 && b.coinUnits <= s.holdingPolicy.maxCoinUnits, `${label} holding boundary`);
    assert.ok(b.cashUsd >= 0 && b.shares > 0, `${label} cash and share boundaries`);
    assert.ok(point.low >= 0 && point.low <= point.price && point.price <= point.high, `${label} condition range`);
    const gross = b.coinUnits * b.coinPrice + b.cashUsd + b.otherAssetsUsd;
    const senior = b.debtUsd + b.preferredUsd + b.otherLiabilitiesUsd + b.nonControllingInterestUsd;
    near(b.grossAssets, gross, `${label} gross assets`, gross, 'grossAssetsUsd');
    near(b.seniorClaims, senior, `${label} senior claims`, senior, 'seniorClaimsUsd');
    near(b.residualUsd, gross - senior, `${label} common residual`, gross + senior, 'residualUsd');
    assert.equal(point.valuationState, active && gross > senior ? 'active' : 'absorbed', `${label} valuation lifecycle`);
    const years = (Date.parse(point.date) - start) / DAY / 365.25;
    const premium = s.premiumTarget + (first.components.premium - s.premiumTarget) * 2 ** (-years / s.premiumHalfLifeYears);
    near(b.premium, premium, `${label} premium`, premium, 'premium');
    const expectedPrice = active ? Math.max(0, gross - senior) / b.shares * premium : 0;
    near(point.price, expectedPrice, `${label} common price`, (Math.abs(gross) + senior) / b.shares * Math.abs(premium), 'sharePriceUsd');
    if (!index) continue;
    const previous = forecast.path[index - 1];
    const a = previous.components;
    assert.equal((Date.parse(point.date) - Date.parse(previous.date)) / DAY, 1, `${label} daily calendar continuity`);
    if (!active) {
      assert.equal(point.price, 0, `${label} absorbing liquidation assumption`);
      counts.absorbedSteps++;
      continue;
    }
    const dt = 1 / 365.25;
    const minted = a.coinUnits * ((1 + s.stakingFraction * s.stakingGross * (1 - s.stakingAdvisoryFee) * (1 - s.stakingOtherFee)) ** dt - 1);
    const rewardsSold = b.rewardsSold - a.rewardsSold;
    const rewardCash = b.rewardSaleProceeds - a.rewardSaleProceeds;
    const sold = b.coinsSold - a.coinsSold;
    const capital = b.capitalRaised - a.capitalRaised;
    let slash = 0;
    if (s.slashingLoss && !slashed && years >= 1) {
      slash = (a.coinUnits + minted - rewardsSold) * s.slashingLoss;
      slashed = true;
    }
    const coinTerms = [a.coinUnits, minted, -sold, -slash, capital * s.investmentFraction / b.coinPrice];
    near(b.coinUnits, coinTerms.reduce((a, b) => a + b, 0), `${label} coin flow`, coinTerms.reduce((a, b) => a + Math.abs(b), 0), 'coinUnits');
    near(rewardsSold, Math.max(0, a.coinUnits + minted - s.holdingPolicy.maxCoinUnits), `${label} reward sale capacity`, a.rewardsSold + b.rewardsSold + a.coinUnits, 'rewardUnits');
    near(rewardCash, rewardsSold * b.coinPrice * (1 - s.saleFee), `${label} reward sale proceeds`, a.rewardSaleProceeds + b.rewardSaleProceeds, 'rewardCashUsd');
    const haircutElapsed = Math.min(years, 1) - Math.min((Date.parse(previous.date) - start) / DAY / 365.25, 1);
    near(b.otherAssetsUsd, a.otherAssetsUsd * (1 - s.otherAssetHaircut) ** haircutElapsed, `${label} other asset haircut`, a.otherAssetsUsd, 'otherAssetsUsd');
    const expense = (s.financingCarryUsd + s.operatingExpenseUsd) * dt;
    const principal = a.debtUsd - b.debtUsd;
    const due = s.repayAtPut ? (forecast.snapshot.debtSchedule || []).filter(item => item.date > previous.date && item.date <= point.date).reduce((sum, item) => sum + (item.principalUsd ?? item.amountUsd ?? 0), 0) : 0;
    near(principal, Math.min(a.debtUsd, due), `${label} principal schedule`, a.debtUsd + b.debtUsd, 'principalUsd');
    const newLiability = b.otherLiabilitiesUsd - a.otherLiabilitiesUsd;
    const cashTerms = [a.cashUsd, rewardCash, capital * (1 - s.investmentFraction), -expense, -principal, (sold - rewardsSold) * b.coinPrice * (1 - s.saleFee), newLiability];
    const cashScale = cashTerms.reduce((a, b) => a + Math.abs(b), 0) + (a.capitalRaised + b.capitalRaised) * (1 - s.investmentFraction) + (a.coinsSold + b.coinsSold + a.rewardsSold + b.rewardsSold) * b.coinPrice * (1 - s.saleFee) + a.otherLiabilitiesUsd + b.otherLiabilitiesUsd;
    near(b.cashUsd, cashTerms.reduce((a, b) => a + b, 0), `${label} cash flow`, cashScale, 'cashUsd');
    const preShares = a.shares * (1 + s.stockCompAnnual) ** dt;
    const actualIssued = b.shares - preShares;
    const preResidual = b.residualUsd - capital;
    const offer = Math.max(0, preResidual) / preShares * premium;
    const preCoins = b.coinUnits - capital * s.investmentFraction / b.coinPrice;
    const planned = preShares * ((1 + s.issuanceAnnual) ** dt - 1);
    const unitCost = offer * (1 - s.feeRate) * s.investmentFraction / b.coinPrice;
    const expectedIssued = preResidual > 0 && premium * (1 - s.feeRate) > 1 && unitCost > 0 ? Math.min(planned, Math.max(0, s.holdingPolicy.maxCoinUnits - preCoins) / unitCost) : 0;
    near(actualIssued, expectedIssued, `${label} issuance capacity and gate`, a.shares + b.shares, 'issuedShares');
    near(capital, actualIssued * offer * (1 - s.feeRate), `${label} net issuance proceeds`, a.capitalRaised + b.capitalRaised, 'issuanceUsd');
    if (capital > 0) counts.financingSteps++;
    if (rewardsSold > 0) counts.rewardSaleSteps++;
    if (principal > 0) counts.debtRepayments++;
    counts.activeSteps++;
    if (point.price === 0) active = false;
  }
}

function assertSourceCutoff(value, cutoff) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (['sourceEndDate', 'sourceReturnStartDate', 'maxSourceDate', 'informationThrough', 'sourceWindowLastDate'].includes(key) && typeof child === 'string') assert.ok(child <= cutoff, `${key} ${child} exceeds ${cutoff}`);
    if (child && typeof child === 'object') assertSourceCutoff(child, cutoff);
  }
}

const bundles = {};
const scenarios = [];
for (const symbol of ['MSTR', 'BMNR']) {
  const assetPaths = buildTreasuryAssetPaths({symbol, btcHistory, ethHistory, asOf, endYear, seed});
  bundles[symbol] = assetPaths;
  assert.equal(assetPaths.asOf, asOf);
  assert.equal(assetPaths.endDate, `${endYear}-12-31`);
  const history = await readJson(`dist/data/${symbol.toLowerCase()}-ohlc.json`);
  const coinAnchor = {date: asOf, price: assetPaths.scenarios.base.path[0].price};
  const forecasts = buildTreasuryForecasts({symbol, history, asOf, endYear, assetPaths, coinAnchor});
  for (const scenario of SCENARIOS) {
    const asset = assetPaths.scenarios[scenario];
    const forecast = forecasts[scenario];
    assertSourceCutoff(asset.training, asOf);
    assert.equal(forecast.path.length, asset.path.length);
    let rises = 0, declines = 0;
    for (let index = 0; index < asset.path.length; index++) {
      assert.equal(forecast.path[index].date, asset.path[index].date);
      assert.equal(forecast.path[index].components.coinPrice, asset.path[index].price);
      const prices = SCENARIOS.map(id => forecasts[id].path[index].price);
      assert.equal(forecast.path[index].low, Math.min(...prices));
      assert.equal(forecast.path[index].high, Math.max(...prices));
      if (index) {
        if (asset.path[index].price > asset.path[index - 1].price) rises++;
        if (asset.path[index].price < asset.path[index - 1].price) declines++;
      }
    }
    assert.ok(rises > 0 && declines > 0, `${symbol}/${scenario} has both upward and downward conditional movements`);
    auditBalances(forecast);
    scenarios.push({symbol, scenario, asOf, endDate: forecast.displayEnd, points: forecast.path.length, upwardAssetDays: rises, downwardAssetDays: declines, insolventAt: forecast.diagnostics.insolventAt, capacityReachedAt: forecast.diagnostics.capacityReachedAt, lastPrice: forecast.path.at(-1).price, lastCoinUnits: forecast.path.at(-1).components.coinUnits});
  }
}
checks.push('six actual-input financial paths conserve holdings, cash, senior claims, issuance and daily calendar events');

// Reconcile the displayed ETH residual to the actual dated source returns,
// without calling the sampler or trusting its reported mean/volatility.
const ethObserved = ethHistory.dailyHistory.candles.filter(row => row.date.slice(0, 10) >= '2022-09-15' && row.date.slice(0, 10) <= asOf);
const ethByDay = new Map(ethObserved.map(row => [row.date.slice(0, 10), row.close]));
const observedReturns = ethObserved.slice(1).map((row, index) => Math.log(row.close / ethObserved[index].close));
const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
const sampleSd = values => {const average = mean(values); return Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1));};
const sourceMean = mean(observedReturns), sourceSd = sampleSd(observedReturns), recentSd = sampleSd(observedReturns.slice(-90));
const dayString = millis => new Date(millis).toISOString().slice(0, 10);
const ethAnchor = ethByDay.get(asOf);
const targetDays = (Date.parse('2030-12-31') - Date.parse(asOf)) / DAY;
let residualChecks = 0, nextTargetIndex = 1;
for (const block of bundles.BMNR.scenarios.base.training.representativeBlocks) {
  assert.ok(block.days > 0 && block.days <= 28);
  assert.equal(block.sourceReturnStartDate, dayString(Date.parse(block.sourceStartDate) + DAY));
  assert.equal(block.sourceEndDate, dayString(Date.parse(block.sourceStartDate) + block.days * DAY));
  assert.equal(block.targetStartDate, dayString(Date.parse(asOf) + nextTargetIndex * DAY));
  assert.equal(block.targetEndDate, dayString(Date.parse(block.targetStartDate) + (block.days - 1) * DAY));
  for (let offset = 0; offset < block.days; offset++, nextTargetIndex++) {
    const sourcePriorDay = dayString(Date.parse(block.sourceStartDate) + offset * DAY);
    const sourceDay = dayString(Date.parse(sourcePriorDay) + DAY);
    assert.ok(sourceDay <= asOf && ethByDay.has(sourcePriorDay) && ethByDay.has(sourceDay));
    const innovation = (Math.log(ethByDay.get(sourceDay) / ethByDay.get(sourcePriorDay)) - sourceMean) / sourceSd * recentSd;
    for (const id of SCENARIOS) {
      const points = bundles.BMNR.scenarios[id].path, previous = points[nextTargetIndex - 1], point = points[nextTargetIndex];
      const target = id === 'stress' ? 360 : id === 'bull' ? 22000 : ethAnchor;
      near(point.baselinePrice, ethAnchor * (target / ethAnchor) ** Math.min(1, nextTargetIndex / targetDays), `ETH/${id}/${point.date} explicit baseline`, point.baselinePrice, 'ethBaselineUsd');
      const previousResidual = Math.log(previous.price / previous.baselinePrice);
      const expectedResidual = 2 ** (-1 / 730) * previousResidual + innovation;
      const actualResidual = Math.log(point.price / point.baselinePrice), error = Math.abs(actualResidual - expectedResidual);
      maxAbsoluteErrors.ethResidualLog = Math.max(maxAbsoluteErrors.ethResidualLog || 0, error);
      assert.ok(error <= 512 * Number.EPSILON * (1 + Math.abs(previousResidual) + Math.abs(innovation) + Math.abs(actualResidual)), `ETH/${id}/${point.date} residual disagrees with the cited source block`);
      residualChecks++;
    }
  }
}
assert.equal(nextTargetIndex, bundles.BMNR.scenarios.base.path.length);
checks.push('every ETH baseline and residual is independently reconciled to the explicit target, actual dated post-Merge source return and declared 90-day scale/730-day persistence');

for (const [scenario, bitcoinScenario] of Object.entries({stress: 'stress', base: 'base', bull: 'accelerated'})) {
  const direct = buildLongHorizonForecast(btcHistory, {asOf, scenario: bitcoinScenario, seed, researchAsOf: [LONG_HORIZON_REVIEW_DATE, asOf].sort()[0]});
  assert.deepEqual(bundles.MSTR.scenarios[scenario].path.map(({date, price}) => ({date, price})), direct.path.filter(point => point.date <= `${endYear}-12-31`).map(({date, price}) => ({date, price})));
}
checks.push('MSTR asset dates and prices equal the original BTC engine for all three mapped scenarios');

const futureBtc = {...btcHistory, prices: [...btcHistory.prices.filter(row => row[0] <= asOf), ['2026-10-24', 1e10]]};
const futureEth = {...ethHistory, dailyHistory: {...ethHistory.dailyHistory, candles: [...ethHistory.dailyHistory.candles.filter(row => row.date.slice(0, 10) <= asOf), {...ethHistory.dailyHistory.candles.at(-1), date: '2026-10-24T00:00:00Z', time: Date.parse('2026-10-24') / 1000, open: 1e10, high: 1e10, low: 1e10, close: 1e10}]}};
for (const symbol of ['MSTR', 'BMNR']) {
  const repeated = buildTreasuryAssetPaths({symbol, btcHistory: futureBtc, ethHistory: futureEth, asOf, endYear, seed});
  for (const scenario of SCENARIOS) assert.deepEqual(repeated.scenarios[scenario].path, bundles[symbol].scenarios[scenario].path);
}
checks.push('same seed and cutoff reproduce every path after extreme future observations are appended');

const fixtureEnd = '2027-12-31';
const fixtureDays = (Date.parse(fixtureEnd) - Date.parse(asOf)) / DAY;
function fixtureBundle(valueAt) {
  return {asset: 'BTC', asOf, endDate: fixtureEnd, metadata: {syntheticFixture: true}, warnings: [], scenarios: Object.fromEntries(SCENARIOS.map(id => [id, {
    id, asset: 'BTC', asOf, endDate: fixtureEnd, method: 'synthetic-verification-fixture', sourceIds: ['verification-fixture'], anchors: [], training: {maxSourceDate: asOf},
    path: Array.from({length: fixtureDays + 1}, (_, index) => ({date: new Date(Date.parse(asOf) + index * DAY).toISOString().slice(0, 10), price: index ? valueAt(index, id) : 100, kind: index ? 'conditional-asset-path' : 'observed-anchor', sourceIds: ['verification-fixture']})),
  }]))};
}
const fixtureSnapshot = {coin: 'BTC', asOf, publishedAt: asOf, coinUnits: 1000000, cashUsd: 0, otherAssetsUsd: 0, debtUsd: 0, preferredUsd: 0, otherLiabilitiesUsd: 0, nonControllingInterestUsd: 0, shares: 1000000, annualExpensesUsd: 0, debtSchedule: [], sourceIds: ['verification-fixture'], notes: []};
const fixtureInput = {symbol: 'MSTR', history: [{date: asOf, close: 100}], asOf, endYear: 2027, snapshot: fixtureSnapshot, coinAnchor: {date: asOf, price: 100}};
const fixtureResults = [];
for (const intermediatePrice of [50, 150]) {
  const assetPaths = fixtureBundle(index => index <= Math.floor(fixtureDays / 2) ? intermediatePrice : 100);
  const before = JSON.stringify({fixtureInput, assetPaths});
  const forecast = buildTreasuryForecasts({...fixtureInput, assetPaths}).stress;
  assert.equal(JSON.stringify({fixtureInput, assetPaths}), before, 'Synthetic inputs must not be mutated');
  const settings = forecast.assumptions;
  const expectedUnits = fixtureSnapshot.coinUnits - assetPaths.scenarios.stress.path.slice(1).reduce((sum, point) => sum + settings.operatingExpenseUsd / 365.25 / (point.price * (1 - settings.saleFee)), 0);
  assert.ok(expectedUnits > 0, 'Path-dependence fixture must remain solvent');
  const last = forecast.path.at(-1);
  near(last.components.coinUnits, expectedUnits, `same-endpoint fixture ${intermediatePrice} holdings`, fixtureSnapshot.coinUnits, 'fixtureCoinUnits');
  near(last.components.shares, fixtureSnapshot.shares * (1 + settings.stockCompAnnual) ** (fixtureDays / 365.25), `same-endpoint fixture ${intermediatePrice} dilution`, fixtureSnapshot.shares, 'fixtureShares');
  assert.equal(last.components.coinPrice, 100);
  assert.equal(last.components.capitalRaised, 0, 'Stress fixture must not create funding');
  fixtureResults.push({intermediatePrice, finalCoinPrice: 100, expectedCoinUnits: expectedUnits, actualCoinUnits: last.components.coinUnits, finalSharePrice: last.price});
}
assert.ok(fixtureResults[0].actualCoinUnits < fixtureResults[1].actualCoinUnits);
assert.ok(fixtureResults[0].finalSharePrice < fixtureResults[1].finalSharePrice);
checks.push('same terminal asset price produces independently computed different holdings and share prices after different interim cash-outflow prices');

const depleted = buildTreasuryForecasts({...fixtureInput, snapshot: {...fixtureSnapshot, preferredUsd: 90000000}, history: [{date: asOf, close: 10}], assetPaths: fixtureBundle(index => index === 1 ? 1 : 1000)});
for (const scenario of SCENARIOS) {
  assert.equal(depleted[scenario].diagnostics.insolventAt, '2026-10-24');
  assert.ok(depleted[scenario].path.slice(1).every(point => point.price === 0), `${scenario} liquidation must remain absorbed despite asset-price recovery`);
}
const split = buildTreasuryForecasts({...fixtureInput, assetPaths: fixtureBundle((index, id) => id === 'stress' ? 0.01 : id === 'base' ? 100 : 150)});
assert.equal(split.base.path[1].low, 0);
assert.ok(split.base.path.slice(1).every(point => point.price > 0), 'A zero lower condition must not liquidate another condition');
checks.push('liquidation is absorbing within its own financial path and does not propagate from another condition through the displayed envelope');

let rejectedBoundaryCases = 0;
for (const mutate of [
  bundle => {bundle.asset = 'ETH';},
  bundle => {bundle.asOf = '2026-10-22';},
  bundle => {bundle.scenarios.base.training.maxSourceDate = '2026-10-24';},
  bundle => {bundle.scenarios.base.path.splice(3, 1);},
  bundle => {bundle.scenarios.base.path[2].date = bundle.scenarios.base.path[1].date;},
  bundle => {bundle.scenarios.base.path[0].price = 101;},
  bundle => {bundle.scenarios.base.path[1].price = Infinity;},
]) {
  const assetPaths = fixtureBundle(() => 100);
  mutate(assetPaths);
  assert.throws(() => buildTreasuryForecasts({...fixtureInput, assetPaths}));
  rejectedBoundaryCases++;
}
checks.push('wrong asset, bundle cutoff, future training, missing day, duplicate day, mismatched initial price and non-finite price are rejected');
const refreshedAsOf = '2026-10-26', refreshed = fixtureBundle(() => 100);
refreshed.asOf = refreshedAsOf;
for (const scenario of Object.values(refreshed.scenarios)) {
  scenario.asOf = refreshedAsOf;
  scenario.training.maxSourceDate = refreshedAsOf;
  scenario.path = scenario.path.filter(point => point.date >= refreshedAsOf);
}
assert.throws(() => buildTreasuryForecasts({...fixtureInput, history: [{date: refreshedAsOf, close: 100}], asOf: refreshedAsOf, assetPaths: refreshed}), /coin anchor date/);
rejectedBoundaryCases++;
checks.push('an older coin anchor is rejected even when its numeric price equals the new exact-date path anchor');
for (const altered of [
  {...ethHistory, product: undefined},
  {...ethHistory, dailyHistory: {...ethHistory.dailyHistory, source: 'Conflicting provider'}},
]) {
  assert.throws(() => buildTreasuryAssetPaths({symbol: 'BMNR', ethHistory: altered, asOf, endYear, seed}));
  rejectedBoundaryCases++;
}
checks.push('raw ETH archives cannot omit their asset identity or contradict the nested Coinbase source identity');
assert.deepEqual(await hashes(sources), sourceHashes, 'Source changed during the verification run');
assert.deepEqual(await hashes(inputs), inputHashes, 'Stored observations changed during the verification run');

console.log(JSON.stringify({status: 'PASS', node: process.version, asOf, endYear, seed, scope: 'Independent daily financial identities and input-boundary verification. This does not establish predictive accuracy, calibrated probabilities or feasible financing.', sourceHashes, inputHashes, tolerance: 'Financial and baseline identities: 1e-7 + 64 * Number.EPSILON * arithmetic scale, including cumulative quantities used in differences. ETH log residual: 512 * Number.EPSILON * (1 + absolute residual and innovation terms).', checks, counts, ethResidualChecks: residualChecks, rejectedBoundaryCases, maxAbsoluteErrors, scenarios, syntheticPathDependence: fixtureResults}, null, 2));
