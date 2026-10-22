import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  buildLongHorizonForecast, bitcoinSubsidySatoshis, bitcoinSupplyBeforeHeight,
  projectBitcoinIssuance, LONG_HORIZON_SCENARIOS,
} from '../dist/long-horizon-forecast.js';
import { LONG_HORIZON_CLAIMS } from '../dist/long-horizon-evidence.js';
import { dateFromDay, utcDay } from '../dist/cycle-engine.js';
import { detectDirectionalChanges } from '../dist/market-structure.js';

const data = JSON.parse(await readFile(new URL('./fixtures/btc-daily-2026-10-20.json', import.meta.url), 'utf8'));
const fast = { sampleCount: 16 };
const base = buildLongHorizonForecast(data, fast);
const close = (actual, expected, tolerance = 1e-10) => assert.ok(
  Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`,
);

test('forecast starts at the exact observed close and has every day through the verified source horizon', () => {
  assert.equal(base.asOf, '2026-10-20');
  assert.equal(base.displayEnd, '2050-12-31');
  assert.equal(base.longHorizon.sourceThroughYear, 2050);
  assert.equal(base.path.length, utcDay('2050-12-31') - utcDay(base.asOf) + 1);
  assert.ok(base.horizonDays > 3 * 366);
  const observed = data.prices.at(-1)[1];
  for (const key of ['price', 'lower', 'median', 'upper', 'baselinePrice']) assert.equal(base.path[0][key], observed);
  for (let i = 0; i < base.path.length; i++) {
    const point = base.path[i];
    assert.equal(point.date, dateFromDay(utcDay(base.asOf) + i));
    assert.ok([point.price, point.lower, point.median, point.upper, point.baselinePrice].every(value => Number.isFinite(value) && value > 0));
    assert.ok(point.lower <= point.price && point.price <= point.upper);
    assert.ok(point.lower <= point.median && point.median <= point.upper);
    close(point.indexedPrice, 100 * point.price / observed);
    assert.equal(point.probability, null);
    assert.equal(point.calibrated, false);
  }
  assert.equal(base.path.at(-1).date, base.displayEnd);
  assert.ok(base.path.at(-1).upper / base.path.at(-1).lower > 6);
  assert.equal(base.assumptions.envelopeQuantiles, null);
  assert.equal(base.assumptions.terminalPriceForced, false);
  assert.equal(base.assumptions.pathCapsOrFloorsApplied, false);
});

test('published valuations remain separate from the unpinned representative path and probability claims', () => {
  const end2030 = base.longHorizon.annualSummary.find(item => item.year === 2030);
  const end2050 = base.longHorizon.annualSummary.find(item => item.year === 2050);
  close(end2030.baselinePrice, 275000);
  close(end2050.baselinePrice, 710000);
  close(end2030.referencePrices.low, 150000);
  close(end2050.referencePrices.high, 1800000);
  assert.ok(Math.abs(end2030.price - end2030.baselinePrice) > 1000);
  assert.ok(Math.abs(end2050.price - end2050.baselinePrice) > 1000);
  assert.equal(end2030.isSourceValuationYear, true);
  assert.equal(base.longHorizon.annualSummary.find(item => item.year === 2035).isSourceValuationYear, false);
  assert.equal(base.assumptions.referenceValuesAreImposedAssumptions, true);
  assert.equal(base.assumptions.representativeIsExpectedPrice, false);
  assert.equal(base.longHorizon.assumptions.historicalVintageBacktest, false);
  for (const event of base.events) {
    assert.equal(event.status, 'conditional-anchor');
    assert.equal(event.inHorizon, true);
    assert.equal(event.isRepresentativeValue, false);
    assert.equal(event.turningPointClaim, false);
    assert.equal(event.probability, null);
    assert.equal(event.price, base.path.find(point => point.date === event.date).baselinePrice);
  }
  assert.deepEqual(base.longHorizon.sourceReferencePoints.filter(item => item.isModelValuationAnchor).map(item => item.sourceId), ['wisdomtree-2030', 'wisdomtree-2050']);
  assert.ok(base.longHorizon.sourceReferencePoints.some(item => item.publisher === 'VanEck' && !item.isModelValuationAnchor));
});

test('horizon follows eligible dated evidence, including a newly verified later target, rather than an N-year setting', () => {
  const extra = { ...LONG_HORIZON_CLAIMS.find(item => item.id === 'wisdomtree-2050'), id: 'test-reference-2060', targetYear: 2060, prices: { low: 300000, base: 900000, high: 2500000 } };
  const extended = buildLongHorizonForecast(data, { ...fast, claims: [...LONG_HORIZON_CLAIMS, extra], horizonYears: 1 });
  assert.equal(extended.displayEnd, '2060-12-31');
  close(extended.path.at(-1).baselinePrice, 900000);
  assert.equal(extended.longHorizon.assumptions.valuationBeyondLastAnchorIsExtrapolated, false);
  const unverified = { ...extra, sourceStatus: 'unverified', targetYear: 2090 };
  const futurePublished = { ...extra, id: 'future-publication', publishedAt: '2027-01-01', targetYear: 2100 };
  const excluded = buildLongHorizonForecast(data, { ...fast, claims: [...LONG_HORIZON_CLAIMS, unverified, futurePublished] });
  assert.equal(excluded.displayEnd, '2050-12-31');
  assert.throws(() => buildLongHorizonForecast(data, { ...fast, researchAsOf: '2024-01-01' }), /No verified/);
  assert.throws(() => buildLongHorizonForecast(data, { ...fast, claims: [] }), /No verified/);
});

test('fixed observation cutoff excludes appended or altered future prices and preserves source chronology', () => {
  const appended = { ...data, prices: [...data.prices, ['2026-10-21', 1e20], ['2026-10-22', 1e-20]] };
  const unchanged = buildLongHorizonForecast(appended, { ...fast, asOf: '2026-10-20' });
  assert.deepEqual(unchanged, base);
  const cutoff = '2025-04-30';
  const options = { ...fast, asOf: cutoff, referenceDate: '2025-05-01' };
  const earlier = buildLongHorizonForecast(data, options);
  const changed = { ...data, prices: data.prices.map(([date, price]) => [date, date > cutoff ? 1e10 : price]) };
  assert.deepEqual(buildLongHorizonForecast(changed, options), earlier);
  assert.deepEqual(buildLongHorizonForecast(data.prices.filter(([date]) => date <= cutoff), options), earlier);
  assert.equal(earlier.training.informationThrough, cutoff);
  assert.equal(earlier.longHorizon.assumptions.researchPublishedAfterObservationCutoff, true);
  assert.equal(earlier.longHorizon.assumptions.historicalVintageBacktest, false);
  let previousEnd = base.nearPhase.displayEnd;
  for (const block of base.training.representativeBlocks) {
    assert.ok(block.sourceStartDate < block.sourceReturnStartDate);
    assert.ok(block.sourceReturnStartDate <= block.sourceEndDate);
    assert.ok(block.sourceEndDate <= base.asOf);
    assert.equal(utcDay(block.sourceEndDate) - utcDay(block.sourceStartDate), block.days);
    assert.equal(utcDay(block.targetStartDate), utcDay(previousEnd) + 1);
    assert.equal(utcDay(block.targetEndDate) - utcDay(block.targetStartDate) + 1, block.days);
    previousEnd = block.targetEndDate;
  }
  assert.equal(previousEnd, base.displayEnd);
});

test('seeded outputs are reproducible without mutating history and changed seeds change the representative path', () => {
  const before = JSON.stringify(data);
  assert.deepEqual(buildLongHorizonForecast(data, fast), base);
  const another = buildLongHorizonForecast(data, { ...fast, seed: 1 });
  assert.notDeepEqual(another.path.map(item => item.price), base.path.map(item => item.price));
  assert.deepEqual(another.path.map(item => item.baselinePrice), base.path.map(item => item.baselinePrice));
  assert.equal(JSON.stringify(data), before);
  assert.ok(base.diagnostics.representativeMaximum.price < 1e8, 'Default USD path should not accidentally cumulate a daily rather than annual volatility scale');
  assert.ok(base.diagnostics.representativeMinimum.price > 1, 'Default fixture should not suffer a units error');
});

test('every economic scenario stays inside its own defined range, and demand failure permits losses', () => {
  for (const scenario of LONG_HORIZON_SCENARIOS) {
    const model = scenario.id === 'base' ? base : buildLongHorizonForecast(data, { ...fast, scenario: scenario.id });
    for (let i = 0; i < model.path.length; i++) {
      const point = model.path[i];
      assert.ok(point.lower <= point.price && point.price <= point.upper);
      assert.equal(point.residualLog, base.path[i].residualLog, 'Economic cases must share the same illustrative residual');
      assert.equal(point.cycleDisplacement, base.path[i].cycleDisplacement, 'Economic cases must not silently change the timing prior');
    }
    assert.ok(model.path.at(-1).lower < model.path.at(-1).upper);
    for (const event of model.events) {
      const derived = ['wait', 'stress'].includes(scenario.id);
      assert.equal(event.isPublishedSourcePrice, !derived);
      assert.equal(event.valuationOrigin, derived ? 'analyst-derived' : 'published-economic-case');
      if (derived) assert.equal(event.publishedSourcePriceCase, null);
      else close(event.price, event.sourcePrices[event.publishedSourcePriceCase]);
    }
    if (scenario.id === 'wait') close(model.path.at(-1).baselinePrice, Math.sqrt(266000 * 710000));
    if (scenario.id === 'stress') {
      close(model.path.at(-1).baselinePrice, 0.3 * model.observables.current.price);
      assert.ok(model.path.at(-1).price < model.observables.current.price);
      assert.equal(model.longHorizon.assumptions.stressFractionsAreAnalystChoices, true);
      assert.ok(model.path.some(point => point.price < model.observables.troughCandidate.price));
    }
  }
});

test('issuance damping is continuous and does not claim an empirical cycle termination date', () => {
  assert.equal(base.longHorizon.cycleExpiryYear, null);
  assert.equal(base.longHorizon.cycleDecay.cycleExpiryYear, null);
  assert.equal(base.longHorizon.cycleDecay.weightingIsModelChoice, true);
  assert.equal(base.longHorizon.cycleDecay.supplyScheduleDoesNotIdentifyPriceCausality, true);
  assert.equal(base.longHorizon.cycleDecay.repeatedFourYearWaves, false);
  assert.equal(base.path[0].cycleWeight, 1);
  for (let i = 1; i < base.path.length; i++) {
    assert.ok(base.path[i].cycleWeight > 0 && base.path[i].cycleWeight < base.path[i - 1].cycleWeight);
  }
  const handoff = base.path.findIndex(point => point.date === base.nearPhase.displayEnd);
  close(base.path[handoff].cycleDisplacement, 0);
  assert.equal(base.path[handoff + 1].cycleDisplacement, 0);
  assert.ok(Math.abs(Math.log(base.path[handoff + 1].price / base.path[handoff].price)) < 0.2, 'Handoff cannot reset the residual or introduce an artificial price jump');
  assert.equal(base.longHorizon.cycleDecay.nearPhaseTransitionIsNotCycleExpiry, true);
  assert.ok(base.path.at(-1).annualizedVolatilityPct > 20);
  assert.ok(base.path.at(-1).annualizedVolatilityPct < base.path[0].annualizedVolatilityPct);
  assert.equal(base.longHorizon.assumptions.volatilityIsModelAssumption, true);
  assert.equal(base.longHorizon.assumptions.residualMeanReversionEstimated, false);
  assert.notEqual(base.path.at(-1).realizedVolPct, base.path.at(-1).annualizedVolatilityPct);
});

test('turn markers are confirmed turns of the displayed path and do not inherit a different ensemble’s timing windows', () => {
  const expected = detectDirectionalChanges(base.path, { threshold: base.assumptions.localTurnThreshold }).pivots.filter(item => !item.leftCensored);
  assert.deepEqual(base.localTurns.map(item => [item.type, item.date, item.confirmationDate]), expected.map(item => [item.type, item.eventDate, item.confirmationDate]));
  assert.deepEqual(base.diagnostics.firstTurnWindows, {});
  assert.equal(base.diagnostics.simulatedPeakWindow, null);
  assert.equal(base.diagnostics.simulatedLowWindow, null);
  assert.equal(base.diagnostics.totalPaths, 1);
  for (const turn of base.localTurns) {
    assert.equal(turn.futureObservation, false);
    assert.equal(turn.probability, null);
    assert.equal(turn.status, 'illustrative-path-only');
  }
});

test('weekly rows expose partial edges and exactly preserve the last daily close', () => {
  assert.equal(base.weeklyPath.at(-1).date, base.displayEnd);
  assert.equal(base.weeklyPath.at(-1).price, base.path.at(-1).price);
  assert.equal(base.weeklyPath.reduce((sum, row) => sum + row.daysIncluded, 0), base.path.length);
  for (const row of base.weeklyPath) {
    assert.equal(row.completeCalendarWeek, row.daysIncluded === 7);
    assert.equal(row.partial, row.daysIncluded !== 7);
    assert.equal(row.observationClaim, false);
  }
});

test('calendar clock expiration and missing historical eras do not prevent the evidence-based horizon', () => {
  const short = data.prices.slice(-400);
  const withoutNear = buildLongHorizonForecast(short, fast);
  assert.equal(withoutNear.nearPhase, null);
  assert.match(withoutNear.longHorizon.cycleDecay.nearPhaseUnavailable, /historical halving eras/);
  assert.equal(withoutNear.displayEnd, '2050-12-31');
  assert.equal(withoutNear.training.representativeBlocks[0].targetStartDate, '2026-10-21');
  const expired = data.prices.map(row => [...row]);
  for (let day = utcDay('2026-10-21'); day <= utcDay('2031-01-01'); day++) {
    expired.push([dateFromDay(day), 80000 * Math.exp(0.02 * Math.sin(day / 11))]);
  }
  const later = buildLongHorizonForecast(expired, { ...fast, referenceDate: '2031-01-02' });
  assert.equal(later.nearPhase, null);
  assert.match(later.longHorizon.cycleDecay.nearPhaseUnavailable, /high-zone reference/);
  assert.equal(later.displayEnd, '2050-12-31');
  assert.equal(later.events.length, 1);
  assert.equal(later.events[0].sourceId, 'wisdomtree-2050');
});

test('protocol issuance uses integer satoshis and differentiates scheduled supply from accessible coins', () => {
  const expected = [
    [840000, 312500000, 19687500],
    [1050000, 156250000, 20343750],
    [1260000, 78125000, 20671875],
    [1470000, 39062500, 20835937.5],
    [1680000, 19531250, 20917968.75],
  ];
  for (const [height, subsidy, supply] of expected) {
    assert.equal(bitcoinSubsidySatoshis(height), subsidy);
    assert.equal(bitcoinSupplyBeforeHeight(height), supply);
    assert.equal(bitcoinSubsidySatoshis(height - 1), subsidy * 2);
  }
  assert.equal(bitcoinSubsidySatoshis(32 * 210000), 1);
  assert.equal(bitcoinSubsidySatoshis(33 * 210000), 0);
  assert.equal(bitcoinSubsidySatoshis(64 * 210000), 0);
  assert.equal(bitcoinSupplyBeforeHeight(33 * 210000), 20999999.9769);
  assert.equal(bitcoinSupplyBeforeHeight(64 * 210000), 20999999.9769);
  const year2030 = projectBitcoinIssuance('2030-12-31');
  assert.equal(year2030.heightEstimate, 1192224);
  assert.equal(year2030.supplyBTC, 20565975);
  assert.equal(year2030.annualNewBTC, 82181.25);
  assert.equal(year2030.calendarProjection, true);
  assert.match(year2030.supplyDefinition, /not spendable or circulating supply/);
  assert.match(year2030.annualIssuanceDefinition, /not a calendar-year total/);
  close(projectBitcoinIssuance('2050-12-31').supplyBTC, 20986530.46802928);
});

test('invalid daily inputs and unsupported assumptions fail explicitly instead of silently repairing history', () => {
  assert.throws(() => buildLongHorizonForecast(data.prices.slice(-100), fast), /366/);
  const gap = data.prices.filter(([date]) => date !== '2026-09-01');
  assert.throws(() => buildLongHorizonForecast(gap, fast), /gaps are not interpolated/);
  assert.throws(() => buildLongHorizonForecast(data, { ...fast, seed: -1 }), /seed/);
  assert.throws(() => buildLongHorizonForecast(data, { ...fast, terminalVolatilityPct: 0 }), /terminalVolatilityPct/);
  assert.throws(() => buildLongHorizonForecast(data, { ...fast, referenceDate: '2026-10-20' }), /referenceDate/);
  assert.throws(() => bitcoinSupplyBeforeHeight(-1), /height/);
  assert.throws(() => bitcoinSubsidySatoshis(1.1), /height/);
});
