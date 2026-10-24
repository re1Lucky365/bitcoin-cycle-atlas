import { HALVINGS, utcDay, dateFromDay, validateDataset } from './cycle-engine.js?v=1.19.0';
import { buildDetailedForecast } from "./detailed-forecast.js?v=1.21.0";
import { computeRollingStates, detectDirectionalChanges } from "./market-structure.js?v=1.21.0";
import { LONG_HORIZON_CLAIMS, LONG_HORIZON_REVIEW_DATE } from './long-horizon-evidence.js?v=1.11.0';
import { calibrateCycleTiming } from './cycle-calibration.js?v=1.19.0';

const DAYS_PER_YEAR = 365.25;
const BLOCKS_PER_DAY = 144;
const HALVING_BLOCKS = 210000;
const HALVING_YEARS = HALVING_BLOCKS / BLOCKS_PER_DAY / DAYS_PER_YEAR;
const SATOSHIS_PER_BTC = 100000000;
const PROTOCOL_SOURCES = [
  'https://github.com/bitcoin/bitcoin/blob/v29.0/src/validation.cpp',
  'https://github.com/bitcoin/bitcoin/blob/v29.0/src/kernel/chainparams.cpp',
];

export const LONG_HORIZON_DEFAULTS = Object.freeze({
  scenario: 'base', seed: 20261022, sampleCount: 128, blockDays: 28,
  volatilityWindowDays: 90, volatilityMultiplier: 1,
  terminalVolatilityPct: 20, volatilityHalfLifeYears: 8,
  residualHalfLifeDays: 730, localTurnThreshold: 0.12,
  applyCycleCalibration: true,
});

export const LONG_HORIZON_SCENARIOS = Object.freeze([
  Object.freeze({ id: 'base', label: '통화·금 기준', valuationCase: 'base' }),
  Object.freeze({ id: 'accelerated', label: '채택 확대', valuationCase: 'high' }),
  Object.freeze({ id: 'wait', label: '완만한 채택', valuationCase: 'moderate' }),
  Object.freeze({ id: 'late', label: '낮은 채택', valuationCase: 'low' }),
  Object.freeze({ id: 'stress', label: '수요 훼손', valuationCase: 'stress' }),
]);

function finitePositive(value, label) {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${label} must be positive and finite`);
  return value;
}

function bounded(value, low, high, label, integer = false) {
  if (!Number.isFinite(value) || value < low || value > high || (integer && !Number.isSafeInteger(value))) {
    throw new RangeError(`${label} must be ${integer ? 'an integer ' : ''}in [${low}, ${high}]`);
  }
  return value;
}

function randomGenerator(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function statistics(values) {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return { mean, sd: Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1)) };
}

export function bitcoinSubsidySatoshis(height) {
  if (!Number.isSafeInteger(height) || height < 0) throw new RangeError('height must be a nonnegative safe integer');
  const halvings = Math.floor(height / HALVING_BLOCKS);
  return halvings >= 64 ? 0 : Number(5000000000n >> BigInt(halvings));
}

export function bitcoinSupplyBeforeHeight(height) {
  if (!Number.isSafeInteger(height) || height < 0) throw new RangeError('height must be a nonnegative safe integer');
  let supply = 0;
  for (let era = 0, remaining = height; remaining > 0 && era < 33; era++) {
    const blocks = Math.min(remaining, HALVING_BLOCKS);
    supply += blocks * bitcoinSubsidySatoshis(era * HALVING_BLOCKS);
    remaining -= blocks;
  }
  return supply / SATOSHIS_PER_BTC;
}

export function projectBitcoinIssuance(date) {
  const day = utcDay(date);
  const anchor = HALVINGS.findLast(item => item.date <= date);
  if (!anchor) throw new RangeError('Supply calendar projection requires a date on or after 2012-11-28');
  const heightEstimate = anchor.height + (day - utcDay(anchor.date)) * BLOCKS_PER_DAY;
  const subsidyBTC = bitcoinSubsidySatoshis(heightEstimate) / SATOSHIS_PER_BTC;
  const supplyBTC = bitcoinSupplyBeforeHeight(heightEstimate);
  const annualNewBTC = subsidyBTC * BLOCKS_PER_DAY * DAYS_PER_YEAR;
  return {
    date, heightEstimate, subsidyBTC, supplyBTC, annualNewBTC,
    dailyNewBTC: subsidyBTC * BLOCKS_PER_DAY,
    annualIssuancePct: 100 * annualNewBTC / supplyBTC,
    issuedSharePct: 100 * supplyBTC / 21000000,
    nextHalvingHeight: (Math.floor(heightEstimate / HALVING_BLOCKS) + 1) * HALVING_BLOCKS,
    anchorDate: anchor.date, anchorHeight: anchor.height,
    expectedBlocksPerDay: BLOCKS_PER_DAY, calendarProjection: true,
    supplyDefinition: 'Scheduled subsidy before the estimated height; not spendable or circulating supply. Excludes corrections for unclaimed rewards, genesis, burns and lost keys.',
    annualIssuanceDefinition: 'Current subsidy × 144 × 365.25 / scheduled supply; annualized run rate, not a calendar-year total across a halving.',
  };
}

function validatedPrefix(input, asOf) {
  const raw = Array.isArray(input) ? input : input?.prices;
  if (!Array.isArray(raw) || !raw.length) throw new TypeError('A nonempty daily price series is required');
  const cutoff = asOf ?? (Array.isArray(raw.at(-1)) ? raw.at(-1)[0] : raw.at(-1).date);
  utcDay(cutoff);
  const included = [];
  for (const row of raw) {
    const date = Array.isArray(row) ? row[0] : row?.date;
    utcDay(date);
    if (date <= cutoff) included.push(row);
  }
  const rows = validateDataset(included);
  if (rows.length < 366) throw new RangeError('At least 366 completed daily observations are required');
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].epochDay !== rows[i - 1].epochDay + 1) throw new RangeError('Historical return blocks require consecutive daily observations; gaps are not interpolated');
  }
  return rows;
}

function evidenceAt(claims, researchAsOf, currentDate) {
  const priceClaims = claims.filter(item => item.chartEligible && item.sourceStatus === 'verified-primary' && item.publishedAt <= researchAsOf && Number.isSafeInteger(item.targetYear) && item.prices);
  if (!priceClaims.length) throw new RangeError('No verified, dated price scenarios are available for this research cutoff');
  const sourceThroughYear = Math.max(...priceClaims.map(item => item.targetYear));
  const displayEnd = `${sourceThroughYear}-12-31`;
  utcDay(displayEnd);
  if (displayEnd <= currentDate) throw new RangeError('Verified source horizons do not extend beyond the latest observation');
  const references = priceClaims.filter(item => item.publisher === 'WisdomTree' && `${item.targetYear}-12-31` > currentDate).sort((a, b) => a.targetYear - b.targetYear);
  if (!references.length) throw new RangeError('No unexpired WisdomTree valuation anchors are available');
  for (const item of references) {
    for (const key of ['low', 'base', 'high']) finitePositive(item.prices[key], `${item.id}.${key}`);
    if (!(item.prices.low <= item.prices.base && item.prices.base <= item.prices.high)) throw new RangeError(`${item.id} valuation cases must be ordered`);
  }
  if (new Set(references.map(item => item.targetYear)).size !== references.length) throw new RangeError('Use one valuation-source vintage per target year');
  return { priceClaims, references, sourceThroughYear, displayEnd };
}

function logCurve(current, references, key, day) {
  const anchors = [{ day: current.epochDay, price: current.price }, ...references.map(item => ({ day: utcDay(`${item.targetYear}-12-31`), price: item.prices[key] }))];
  let index = anchors.findIndex(item => item.day >= day);
  if (index === 0) return Math.log(current.price);
  if (index < 0) index = anchors.length - 1;
  const left = anchors[index - 1], right = anchors[index];
  const weight = (day - left.day) / (right.day - left.day);
  return Math.log(left.price) + weight * Math.log(right.price / left.price);
}

function stressLogCurve(current, references, day) {
  const firstYear = references[0].targetYear, lastYear = references.at(-1).targetYear;
  const stressReferences = references.map(item => {
    const mix = firstYear === lastYear ? 1 : (item.targetYear - firstYear) / (lastYear - firstYear);
    const value = current.price * Math.exp(Math.log(0.6) + mix * Math.log(0.3 / 0.6));
    return { ...item, prices: { stress: value } };
  });
  return logCurve(current, stressReferences, 'stress', day);
}

function weeklyRows(path) {
  const groups = new Map();
  for (const point of path) {
    const day = utcDay(point.date), monday = day - ((day + 3) % 7 + 7) % 7;
    if (!groups.has(monday)) groups.set(monday, []);
    groups.get(monday).push(point);
  }
  let previous = path[0].price;
  return [...groups].map(([monday, points]) => {
    const last = points.at(-1), complete = points.length === 7;
    const row = { ...last, weekStartDate: dateFromDay(monday), weekEndDate: dateFromDay(monday + 6), firstIncludedDate: points[0].date, lastIncludedDate: last.date, daysIncluded: points.length, completeCalendarWeek: complete, partial: !complete, weekMinPrice: Math.min(...points.map(point => point.price)), weekMaxPrice: Math.max(...points.map(point => point.price)), weeklyReturnPct: 100 * (last.price / previous - 1), observationClaim: false };
    previous = last.price;
    return row;
  });
}

function localTurnsFor(path, threshold, currentPrice) {
  return detectDirectionalChanges(path, { threshold }).pivots.filter(item => !item.leftCensored).map((item, index) => ({
    id: `long-path-${item.type}-${index}`, type: item.type,
    label: item.type === 'high' ? '가정 경로 국지 고점' : '가정 경로 국지 저점',
    date: item.eventDate, price: item.eventPrice, indexedPrice: 100 * item.eventPrice / currentPrice,
    confirmationDate: item.confirmationDate, confirmationPrice: item.confirmationPrice,
    lagDays: item.lagDays, threshold, status: 'illustrative-path-only',
    futureObservation: false, probability: null,
  }));
}

function scenarioFor(id) {
  const scenario = LONG_HORIZON_SCENARIOS.find(item => item.id === id);
  if (!scenario) throw new RangeError('scenario must be base, accelerated, wait, late or stress');
  return scenario;
}

// Source targets are valuation assumptions; stochastic residuals are never pinned to them.
export function buildLongHorizonForecast(input, options = {}) {
  const settings = { ...LONG_HORIZON_DEFAULTS, ...options };
  const scenario = scenarioFor(settings.scenario);
  return projectLongHorizon(prepareLongHorizon(input, options, settings), scenario);
}

/** Share source preparation only within this synchronous batch, never across data revisions. */
export function buildLongHorizonForecasts(input, { scenarios = LONG_HORIZON_SCENARIOS.map(item => item.id), ...options } = {}) {
  if (!Array.isArray(scenarios) || !scenarios.length || new Set(scenarios).size !== scenarios.length) throw new RangeError('scenarios must be a nonempty array of unique scenario ids');
  if (Object.hasOwn(options, 'scenario')) throw new TypeError('Use scenarios for a forecast batch');
  const selected = scenarios.map(scenarioFor);
  const settings = { ...LONG_HORIZON_DEFAULTS, ...options };
  const prepared = prepareLongHorizon(input, options, settings);
  return Object.fromEntries(selected.map(scenario => [scenario.id, projectLongHorizon({
    ...prepared,
    nearPhase: structuredClone(prepared.nearPhase),
    cycleCalibration: structuredClone(prepared.cycleCalibration),
    evidence: structuredClone(prepared.evidence),
  }, scenario)]));
}

function prepareLongHorizon(input, options, settings) {
  bounded(settings.seed, 0, 4294967295, 'seed', true);
  bounded(settings.sampleCount, 16, 512, 'sampleCount', true);
  bounded(settings.blockDays, 7, 84, 'blockDays', true);
  bounded(settings.volatilityWindowDays, 28, 365, 'volatilityWindowDays', true);
  bounded(settings.volatilityMultiplier, 0.5, 2, 'volatilityMultiplier');
  bounded(settings.terminalVolatilityPct, 1, 100, 'terminalVolatilityPct');
  finitePositive(settings.volatilityHalfLifeYears, 'volatilityHalfLifeYears');
  finitePositive(settings.residualHalfLifeDays, 'residualHalfLifeDays');
  bounded(settings.localTurnThreshold, 0.05, 0.5, 'localTurnThreshold');
  if (typeof settings.applyCycleCalibration !== 'boolean') throw new TypeError('applyCycleCalibration must be boolean');
  const rows = validatedPrefix(input, options.asOf), current = rows.at(-1);
  const cycleCalibration = calibrateCycleTiming(rows, { asOf: current.date });
  const referenceDate = options.referenceDate ?? (current.date < '2026-10-22' ? '2026-10-22' : dateFromDay(current.epochDay + 1));
  utcDay(referenceDate);
  if (referenceDate <= current.date) throw new RangeError('referenceDate must follow the latest completed UTC price');
  const researchAsOf = options.researchAsOf ?? LONG_HORIZON_REVIEW_DATE;
  utcDay(researchAsOf);
  const evidence = evidenceAt(options.claims ?? LONG_HORIZON_CLAIMS, researchAsOf, current.date);
  const horizonDays = utcDay(evidence.displayEnd) - current.epochDay;
  const allReturns = rows.slice(1).map((row, index) => Math.log(row.price / rows[index].price));
  const recent = statistics(allReturns.slice(-settings.volatilityWindowDays));
  if (!(recent.sd > 1e-9)) throw new RangeError('Positive recent realized volatility is required');
  const sourceReturns = allReturns.slice(-1461), sourceStats = statistics(sourceReturns);
  if (!(sourceStats.sd > 1e-9)) throw new RangeError('Positive historical return variation is required');
  const sourceFirstRow = rows.length - sourceReturns.length;
  let nearPhase = null, nearPhaseUnavailable = null;
  const historicalPeak = rows.reduce((a, b) => a.price > b.price ? a : b);
  const peakHalving = HALVINGS.findLast(item => item.date <= historicalPeak.date);
  if (!peakHalving || rows[0].date >= peakHalving.date) {
    nearPhaseUnavailable = 'Insufficient historical halving eras for the optional near-phase model';
  } else {
    try {
      nearPhase = buildDetailedForecast(rows, { ...settings, scenario: 'base', asOf: current.date, referenceDate, horizonYears: 3, displayEnd: undefined, includeSamplePaths: false,
        timingCalibration: settings.applyCycleCalibration ? cycleCalibration.current : null });
    } catch (error) {
      const unavailableClock = /calendar reference high needs a 20% decline|high-zone reference must be strictly in the future|stress reference date is expired|horizon exceeds the next assumed low|display horizon days|bridge terminal horizon/.test(error.message);
      if (!(error instanceof RangeError) || !unavailableClock) throw error;
      nearPhaseUnavailable = error.message;
    }
  }
  return { options, settings, rows, current, cycleCalibration, referenceDate, researchAsOf, evidence,
    horizonDays, recent, sourceReturns, sourceStats, sourceFirstRow, nearPhase, nearPhaseUnavailable };
}

function projectLongHorizon(prepared, scenario) {
  const { options, settings, rows, current, cycleCalibration, referenceDate, researchAsOf, evidence,
    horizonDays, recent, sourceReturns, sourceStats, sourceFirstRow, nearPhase, nearPhaseUnavailable } = prepared;
  const recentVol = recent.sd * Math.sqrt(365) * settings.volatilityMultiplier;
  const terminalVol = settings.terminalVolatilityPct / 100 * settings.volatilityMultiplier;
  const innovationVol = years => terminalVol + (recentVol - terminalVol) * 2 ** (-years / settings.volatilityHalfLifeYears);
  const nearDays = nearPhase ? nearPhase.path.length - 1 : 0;
  const nearGrowth = nearPhase ? Math.log(nearPhase.path.at(-1).baselinePrice / current.price) : 0;
  const random = randomGenerator((settings.seed ^ 0x4C4F4E47) >>> 0);
  const persistence = Math.exp(-Math.LN2 / settings.residualHalfLifeDays);
  const representativeBlocks = [];
  let residual = 0, blockStart = 0, blockOffset = settings.blockDays, high = current.price;
  const path = [];
  for (let index = 0; index <= horizonDays; index++) {
    const day = current.epochDay + index, date = dateFromDay(day), years = index / DAYS_PER_YEAR;
    const cycleWeight = 2 ** (-years / HALVING_YEARS);
    const annualizedVolatilityPct = 100 * innovationVol(years);
    let cycleDisplacement = 0;
    if (index && nearPhase && index <= nearDays) {
      const near = nearPhase.path[index];
      cycleDisplacement = cycleWeight * (Math.log(near.baselinePrice / current.price) - index / nearDays * nearGrowth);
      residual = Math.log(near.price / near.baselinePrice) * innovationVol(years) / recentVol;
    } else if (index) {
      if (blockOffset === settings.blockDays) {
        blockStart = Math.floor(random() * (sourceReturns.length - settings.blockDays + 1));
        blockOffset = 0;
        const used = Math.min(settings.blockDays, horizonDays - index + 1);
        representativeBlocks.push({
          sourceStartDate: rows[sourceFirstRow + blockStart - 1].date,
          sourceReturnStartDate: rows[sourceFirstRow + blockStart].date,
          sourceEndDate: rows[sourceFirstRow + blockStart + used - 1].date,
          targetStartDate: date, targetEndDate: dateFromDay(day + used - 1), days: used,
        });
      }
      const innovation = (sourceReturns[blockStart + blockOffset++] - sourceStats.mean) / sourceStats.sd;
      residual = persistence * residual + innovation * innovationVol(years) / Math.sqrt(365);
    }
    const lowLog = logCurve(current, evidence.references, 'low', day);
    const baseLog = logCurve(current, evidence.references, 'base', day);
    const highLog = logCurve(current, evidence.references, 'high', day);
    const stressLog = stressLogCurve(current, evidence.references, day);
    const chosenLog = ({ low: lowLog, base: baseLog, high: highLog, moderate: (lowLog + baseLog) / 2, stress: stressLog })[scenario.valuationCase];
    const displacement = cycleDisplacement + residual;
    const price = index ? finitePositive(Math.exp(chosenLog + displacement), 'projected price') : current.price;
    const lower = index ? finitePositive(Math.exp(Math.min(lowLog, chosenLog) + displacement), 'scenario lower price') : current.price;
    const upper = index ? finitePositive(Math.exp(Math.max(highLog, chosenLog) + displacement), 'scenario upper price') : current.price;
    const median = index ? finitePositive(Math.exp(baseLog + displacement), 'base scenario price') : current.price;
    const baselinePrice = index ? finitePositive(Math.exp(chosenLog), 'valuation reference price') : current.price;
    high = Math.max(high, price);
    path.push({
      date, price, lower, median, upper, baselinePrice,
      centralReferencePrice: index ? Math.exp(baseLog) : current.price,
      lowerReferencePrice: index ? Math.exp(lowLog) : current.price,
      upperReferencePrice: index ? Math.exp(highLog) : current.price,
      indexedPrice: 100 * price / current.price, indexedLower: 100 * lower / current.price,
      indexedMedian: 100 * median / current.price, indexedUpper: 100 * upper / current.price,
      baselineIndex: 100 * baselinePrice / current.price,
      drawdownPct: 100 * (1 - price / high), cycleWeight, cycleDisplacement,
      cycleComponentActive: Boolean(nearPhase && index > 0 && index < nearDays),
      residualLog: residual, annualizedVolatilityPct,
      phase: index ? 'long-horizon' : 'observed-anchor',
      phaseLabel: index ? '장기 채택 가정' : '현재 관측',
      kind: index ? 'conditional-long-horizon-path' : 'observed-anchor',
      probability: null, calibrated: false,
    });
  }
  const states = computeRollingStates([...rows, ...path.slice(1)], { threshold: settings.localTurnThreshold });
  const statesByDate = new Map(states.points.map(point => [point.date, point]));
  for (const point of path) {
    const state = statesByDate.get(point.date);
    point.state = state?.state ?? 'transition';
    point.athDrawdownPct = state?.athDrawdownPct ?? null;
    point.realizedVolPct = state?.realizedVolPct ?? null;
  }
  const localTurns = localTurnsFor(path, settings.localTurnThreshold, current.price);
  const byDate = new Map(path.map(point => [point.date, point]));
  const annualSummary = path.filter(point => point.date.endsWith('-12-31')).map(point => {
    const issuance = projectBitcoinIssuance(point.date);
    return { year: Number(point.date.slice(0, 4)), date: point.date, price: point.price, lower: point.lower, upper: point.upper,
      baselinePrice: point.baselinePrice, referencePrices: { low: point.lowerReferencePrice, base: point.centralReferencePrice, high: point.upperReferencePrice },
      annualizedVolatilityPct: point.annualizedVolatilityPct, realizedVolPct: point.realizedVolPct,
      cycleWeight: point.cycleWeight, cycleComponentActive: point.cycleComponentActive,
      cycleDisplacement: point.cycleDisplacement,
      supply: issuance.supplyBTC, annualIssuancePct: issuance.annualIssuancePct, issuance,
      isSourceValuationYear: evidence.references.some(item => item.targetYear === Number(point.date.slice(0, 4))),
      sourceValuationIds: evidence.references.filter(item => item.targetYear === Number(point.date.slice(0, 4))).map(item => item.id),
      probability: null, calibrated: false };
  });
  const events = evidence.references.map(item => {
    const date = `${item.targetYear}-12-31`, point = byDate.get(date);
    const isPublishedSourcePrice = ['low', 'base', 'high'].includes(scenario.valuationCase);
    const label = scenario.valuationCase === 'stress' ? `${item.targetYear}년 자체 수요 훼손 가정`
      : scenario.valuationCase === 'moderate' ? `${item.targetYear}년 혼합 평가 가정` : `${item.targetYear}년 외부 평가 가정`;
    const derivation = scenario.valuationCase === 'stress' ? 'Analyst fractions of the latest observed price: 60% at the first remaining milestone, 30% at the last (30% when only one remains).'
      : scenario.valuationCase === 'moderate' ? 'Geometric mean of the published low and base cases; this blend is an app assumption.'
        : `Published ${scenario.valuationCase} economic valuation case, imposed only on the reference curve.`;
    return { id: `valuation-${item.id}`, type: 'valuation-reference', label,
      shortLabel: `${item.targetYear}년 평가 가정`, date, price: point.baselinePrice,
      sourceId: item.id, sourcePrices: item.prices, indexedPrice: 100 * point.baselinePrice / current.price,
      isPublishedSourcePrice, publishedSourcePriceCase: isPublishedSourcePrice ? scenario.valuationCase : null,
      valuationOrigin: isPublishedSourcePrice ? 'published-economic-case' : 'analyst-derived', derivation,
      status: 'conditional-anchor', inHorizon: true, outsideHorizonLabel: null,
      isRepresentativeValue: false, turningPointClaim: false, futureObservation: false,
      representativePriceOnDate: point.price, probability: null };
  });
  const sourceReferencePoints = evidence.priceClaims.map(item => ({
    sourceId: item.id, publisher: item.publisher, year: item.targetYear,
    date: `${item.targetYear}-12-31`, prices: { ...item.prices },
    publishedAt: item.publishedAt, url: item.url,
    isModelValuationAnchor: evidence.references.some(reference => reference.id === item.id),
    targetDateIsDisplayConvention: true, turningPointClaim: false, probability: null,
  })).sort((a, b) => a.year - b.year || a.publisher.localeCompare(b.publisher));
  const maxPoint = path.reduce((a, b) => a.price > b.price ? a : b);
  const minPoint = path.reduce((a, b) => a.price < b.price ? a : b);
  const observedPeak = rows.reduce((a, b) => a.price > b.price ? a : b);
  const peakIndex = rows.findIndex(row => row.date === observedPeak.date);
  const trough = rows.slice(peakIndex).reduce((a, b) => a.price < b.price ? a : b);
  const currentState = statesByDate.get(current.date)?.state ?? 'transition';
  const observed = row => ({ date: row.date, price: row.price });
  return {
    version: 'source-anchored-long-horizon-2', asOf: current.date, referenceDate,
    referenceTimezone: options.referenceTimezone ?? 'Asia/Seoul', displayEnd: evidence.displayEnd, horizonDays,
    observables: nearPhase?.observables ?? {
      current: observed(current), peak: { ...observed(observedPeak), provisional: true }, previousPeak: null,
      troughCandidate: { ...observed(trough), provisional: true }, currentState,
      recoveryDays: current.epochDay - trough.epochDay, recoveryPct: 100 * (current.price / trough.price - 1),
      observedPeakToLowDays: trough.epochDay - observedPeak.epochDay,
      recentDailyLogReturnSd: recent.sd, recentAnnualizedVolPct: 100 * recent.sd * Math.sqrt(365),
      volatilityWindowDays: settings.volatilityWindowDays,
      priceDefinition: 'Completed UTC daily observations; future daily values are simulated, never OHLC.',
    },
    scenario, nominalClock: nearPhase?.nominalClock ?? null, nearPhase,
    cycleCalibration: {
      ...cycleCalibration,
      forecastApplication: {
        enabled: settings.applyCycleCalibration,
        requestedShiftDays: settings.applyCycleCalibration ? cycleCalibration.current.appliedShiftDays : 0,
        appliedShiftDays: nearPhase?.nominalClock.timingAdjustment.appliedShiftDays ?? 0,
        applied: Boolean(settings.applyCycleCalibration && nearPhase?.nominalClock.timingAdjustment.applied),
        reason: !settings.applyCycleCalibration ? 'disabled-for-comparison' : nearPhase?.nominalClock.timingAdjustment.reason ?? 'near-phase-unavailable',
        sourceValuationAnchorsChanged: false,
        scope: 'The optional near-phase clock only; no automatic repetition of four-year waves through 2050.',
      },
    },
    path, weeklyPath: weeklyRows(path), events, localTurns,
    assumptions: {
      seed: settings.seed, blockDays: settings.blockDays, volatilityMultiplier: settings.volatilityMultiplier,
      localTurnThreshold: settings.localTurnThreshold,
      priceReferenceFormula: 'Log interpolation of dated, published WisdomTree economic cases, re-anchored to the last observed USD price; source targets are valuation assumptions, not expected returns.',
      referenceValuesAreImposedAssumptions: true, terminalPriceForced: false,
      intermediateDatesAndPricesForced: false, pathCapsOrFloorsApplied: false,
      baselineAnchorValuesImposed: true, representativeIsExpectedPrice: false,
      envelopeLabel: '경제 가정 범위 · 확률구간 아님', envelopeQuantiles: null,
      envelopeMeaning: 'Low/base/high valuation cases share one illustrative residual path. These are neither sample quantiles nor an exhaustive range of possible outcomes.',
      legacyMedianFieldMeaning: 'Base economic scenario with the shared illustrative residual, not a statistical median.',
      sampleCount: 1, shortTermSourceEnsembleCount: settings.sampleCount,
      representativeRule: 'One deterministic seeded path; no claim that this is the most likely path.',
      calibrated: false, probability: null, futurePricesKnown: false,
    },
    training: {
      informationThrough: current.date, observations: rows.length, firstObservation: rows[0].date,
      sourceWindowLastDate: current.date, sourceReturnStartDate: rows[sourceFirstRow].date,
      sourceReturnCount: sourceReturns.length, sourceDailyLogMean: sourceStats.mean, sourceDailyLogSd: sourceStats.sd,
      representativeBlocks, sourceBlockEndpointsAtOrBeforeAsOf: true,
      independentSampleSizeClaim: null, overlappingBlocksAreIndependent: false,
      sourceEras: nearPhase?.training.sourceEras ?? [], nearPhaseSourceTraining: nearPhase?.training ?? null,
      historicalForecastAccuracyClaim: false,
    },
    diagnostics: {
      representativeMddPct: Math.max(...path.map(point => point.drawdownPct)),
      representativeMaximum: { ...observed(maxPoint), indexedPrice: maxPoint.indexedPrice, rangeExtremeOnly: true, confirmedTurningPoint: localTurns.some(item => item.type === 'high' && item.date === maxPoint.date), atDisplayBoundary: maxPoint.date === current.date || maxPoint.date === evidence.displayEnd },
      representativeMinimum: { ...observed(minPoint), indexedPrice: minPoint.indexedPrice, rangeExtremeOnly: true, confirmedTurningPoint: localTurns.some(item => item.type === 'low' && item.date === minPoint.date), atDisplayBoundary: minPoint.date === current.date || minPoint.date === evidence.displayEnd },
      firstTurnWindows: {}, simulatedPeakWindow: null, simulatedLowWindow: null,
      totalPaths: 1, frequenciesAreMarketProbabilities: false,
      scope: 'Displayed illustrative long-horizon path. Original near-phase ensemble diagnostics remain only under nearPhase.diagnostics.',
    },
    longHorizon: {
      sourceThroughYear: evidence.sourceThroughYear, researchAsOf,
      method: 'Source-anchored economic scenarios with a transient, issuance-damped near-term cycle and historical-block residuals',
      calibrated: false, probability: null, cycleExpiryYear: null,
      assumptions: {
        horizonRule: 'Last calendar year covered by a verified, chart-eligible external price scenario; no user horizon control.',
        valuationSourceIds: evidence.references.map(item => item.id),
        selectedValuationCase: scenario.valuationCase,
        nearPhaseScenario: 'base', economicScenariosShareNearPhase: true,
        externalPriceClaimIds: evidence.priceClaims.map(item => item.id),
        referencePrices: evidence.references.map(item => ({ id: item.id, year: item.targetYear, prices: { ...item.prices }, publishedAt: item.publishedAt, url: item.url })),
        targetDateConvention: 'Year-end display placement is an app convention; publication target years do not establish exact turning dates.',
        valuationBeyondLastAnchorIsExtrapolated: evidence.sourceThroughYear > evidence.references.at(-1).targetYear,
        researchPublishedAfterObservationCutoff: evidence.priceClaims.some(item => item.publishedAt > current.date),
        historicalVintageBacktest: false,
        stressReferenceFractions: [0.6, 0.3], stressFractionsAreAnalystChoices: true,
        stressDefinition: 'First/last remaining valuation milestones use 60%/30% of today’s observed price (only one remaining milestone uses 30%). Not a publisher forecast or a worst-case bound.',
        terminalVolatilityPct: settings.terminalVolatilityPct,
        volatilityHalfLifeYears: settings.volatilityHalfLifeYears,
        volatilityFormula: 'sigma(t) = sigma_terminal + (sigma_recent − sigma_terminal) × 2^(−years / volatilityHalfLifeYears)',
        volatilityIsModelAssumption: true, goldVolatilityConvergenceGuaranteed: false,
        annualizedVolatilityPctMeaning: 'Assumed annualized innovation scale; realizedVolPct measures the generated path separately. Near-phase residuals are rescaled by this term.',
        residualHalfLifeDays: settings.residualHalfLifeDays,
        residualFormula: 'After the near phase: R[t] = exp(−ln(2)/halfLifeDays) × R[t−1] + normalized past block return × sigma(t)/sqrt(365)',
        residualMeanReversionEstimated: false, residualEndpointForced: false,
      },
      cycleDecay: {
        formula: 'weight(t) = 2^(−elapsedYears / (210000 / 144 / 365.25))',
        halfLifeYears: HALVING_YEARS, weightingIsModelChoice: true,
        weightMeaning: 'Smooth issuance-inspired multiplier, not an estimated share of price variation. It remains positive after the optional near-phase component has ended; cycleComponentActive and cycleDisplacement identify the actual path contribution.',
        supplyScheduleDoesNotIdentifyPriceCausality: true,
        repeatedFourYearWaves: false, cycleExpiryYear: null,
        nearPhaseEnd: nearPhase?.displayEnd ?? null, nearPhaseUnavailable,
        nearPhaseTransitionIsNotCycleExpiry: true,
        adaptiveTimingEnabled: settings.applyCycleCalibration,
        timingCalibrationVersion: cycleCalibration.version,
        appliedTimingShiftDays: nearPhase?.nominalClock.timingAdjustment.appliedShiftDays ?? 0,
        displacementDefinition: 'Damped deviation of the legacy short-term reference from its endpoint trend, returning to zero at the near-phase endpoint. No new scheduled peaks or troughs are invented afterward.',
      },
      annualSummary, sourceReferencePoints,
      issuance: {
        definition: 'Bitcoin Core subsidy schedule in integer satoshis; calendar height is projected at 144 blocks/day from the last known halving. Protocol supply is not tradeable float.',
        asOf: projectBitcoinIssuance(current.date),
        halvingEpochs: [4, 5, 6, 7, 8].map(era => {
          const height = era * HALVING_BLOCKS;
          const subsidyBTC = bitcoinSubsidySatoshis(height) / SATOSHIS_PER_BTC;
          const supplyBTC = bitcoinSupplyBeforeHeight(height);
          const annualNewBTC = subsidyBTC * BLOCKS_PER_DAY * DAYS_PER_YEAR;
          return { height, approximateYear: 2024 + (era - 4) * 4, subsidyBTC, supplyBTC,
            dailyNewBTC: subsidyBTC * BLOCKS_PER_DAY, annualNewBTC,
            annualIssuancePct: 100 * annualNewBTC / supplyBTC, issuedSharePct: 100 * supplyBTC / 21000000,
            calendarYearIsEstimate: era > 4 };
        }), sources: PROTOCOL_SOURCES,
      },
    },
    warnings: [
      '장기 가격은 외부 기관의 채택·통화 가정을 연결한 예시다. 검증된 확률 예측이나 합의 목표가가 아니다.',
      '낮은 채택 범위도 채택 지속을 전제로 한다. 영구적인 수요 상실·운영 실패·전액 손실은 기본 범위 밖일 수 있다.',
      '수요 훼손 시나리오의 60%·30%는 손실 가능성을 보이는 별도 분석 가정이며 기관 전망이나 최악값이 아니다.',
      '공급 증가율 하락은 계산 가능하지만 가격 주기가 끝나는 연도는 식별하지 못한다. 주기 가중치와 잔차 평균회귀는 모형 선택이다.',
      `변동성은 ${settings.terminalVolatilityPct * settings.volatilityMultiplier}%를 장기 가정으로 사용한다. 금의 역사적 변동성에 반드시 도달한다는 뜻이 아니다.`,
      '실제·가정 경로의 전환점은 이후 반전으로 확인한다. 장기 전환일의 확률 창은 제공하지 않는다.',
      '기존 단기 모형의 회고 검증은 이 장기 가격·변동성 모형의 성능 검증으로 이전되지 않는다.',
      '현재 연구자료를 과거 가격 기준일에 붙여도 당시 알려진 전망을 재현한 백테스트가 되지 않는다.',
    ],
    sources: [...new Set([...evidence.priceClaims.map(item => item.url), ...PROTOCOL_SOURCES,
      'https://www.fidelitydigitalassets.com/research-and-insights/bitcoins-four-year-cycle-over',
      'https://www.fidelity.com/learning-center/trading-investing/four-year-bitcoin-and-crypto-cycles',
      'https://www.gold.org/goldhub/gold-focus/2026/04/you-asked-we-answered-has-golds-performance-structurally-changed',
      'https://copestake.info/workingpaper/cryptofinance/CryptoFinance.pdf',
    ])],
  };
}
