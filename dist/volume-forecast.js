import { utcDay, dateFromDay } from './cycle-engine.js?v=1.10.0';

const DAY_SECONDS = 86400;
const DAYS_PER_YEAR = 365.25;
const HORIZONS = Object.freeze([1, 3, 6, 12, 24, 36]);
const METHODS = Object.freeze([
  Object.freeze({ id: 'persistence', label: '최근 90일 거래 활동 유지', responseWeight: 0, complexity: 0 }),
  Object.freeze({ id: 'damped', label: '감쇠 추세', responseWeight: 0, complexity: 1 }),
  Object.freeze({ id: 'conditional25', label: '가격·변동성 반응 25%', responseWeight: 0.25, complexity: 2 }),
  Object.freeze({ id: 'conditional50', label: '가격·변동성 반응 50%', responseWeight: 0.5, complexity: 3 }),
  Object.freeze({ id: 'conditional100', label: '가격·변동성 반응 100%', responseWeight: 1, complexity: 4 }),
]);

export const VOLUME_FORECAST_DEFAULTS = Object.freeze({
  anchorDays: 90, minAnchorObservations: 60, minCompleteMonths: 36,
  regressionWindowMonths: 84, coefficientWindows: Object.freeze([60, 84, 120]),
  ridgePenalty: 4, driftHalfLifeMonths: 12, validationHoldoutMonths: 24,
  validationPriceHalfLifeMonths: 12, validationVolatilityHalfLifeMonths: 24,
  terminalVolatility: 0.20, volatilityHalfLifeYears: 8,
  venueShareHalfLifeYears: 8, terminalVenueMultiplier: 4,
  minimumSelectionLogGain: 0.05, maximumSelectionWapeRatio: 1.10,
});

const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const sd = values => values.length > 1 ? Math.sqrt(values.reduce((sum, value) => sum + (value - mean(values)) ** 2, 0) / (values.length - 1)) : 0;
const median = values => { const sorted = [...values].sort((a, b) => a - b); return sorted.length ? (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2 : 0; };
const positive = value => typeof value === 'number' && Number.isFinite(value) && value > 0;
const nonnegative = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const monthNumber = date => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1;
const monthStart = number => `${Math.floor(number / 12).toString().padStart(4, '0')}-${(number % 12 + 1).toString().padStart(2, '0')}-01`;
const monthEnd = number => dateFromDay(utcDay(monthStart(number + 1)) - 1);
const dampedTime = (months, halfLife) => -Math.expm1(-Math.LN2 * months / halfLife) / (Math.LN2 / halfLife);
const unavailable = (reason, asOf, metadata = {}, monthly = []) => ({ status: 'unavailable', reason, asOf, metadata, monthly, params: null, anchor: null, validation: null, assumptions: null });

function observedPrefix(input, asOf) {
  if (!Array.isArray(input) || input.length > 50000) throw new TypeError('Volume observations must be an array of at most 50,000 daily rows');
  const cutoff = utcDay(asOf), rows = [];
  let previous = -Infinity;
  for (const row of input) {
    const day = utcDay(row?.date);
    // Values after the cutoff are not inspected, fitted, or used to select a model.
    if (day > cutoff) continue;
    if (day <= previous) throw new RangeError('Observed volume dates must be unique and strictly ordered');
    if (row.time !== undefined && row.time !== day * DAY_SECONDS) throw new RangeError('Volume timestamps must match UTC day labels');
    if (!positive(row.close) || !nonnegative(row.volume) || row.kind === 'scenario') throw new TypeError('Expected actual nonnegative BTC volume and positive close');
    if (['open', 'high', 'low'].some(key => row[key] !== undefined)) {
      if (![row.open, row.high, row.low].every(positive) || row.low > Math.min(row.open, row.close)
        || row.high < Math.max(row.open, row.close) || row.low > row.high) throw new RangeError('Invalid observed OHLC');
    }
    rows.push({ date: row.date, day, time: day * DAY_SECONDS, close: row.close, volume: row.volume });
    previous = day;
  }
  return rows;
}

function returnsFor(rows) {
  const result = [];
  for (let i = 1; i < rows.length; i++) if (rows[i].day === rows[i - 1].day + 1) result.push(Math.log(rows[i].close / rows[i - 1].close));
  return result;
}

/** Calendar-complete months only. Source zeros are real observations; absent days are never zero-filled. */
export function aggregateVolumeMonths(dailyBars, { asOf = dailyBars?.at(-1)?.date } = {}) {
  if (asOf === undefined) return { months: [], excludedMonths: [], observedDays: 0 };
  const rows = observedPrefix(dailyBars, asOf), grouped = new Map(), months = [], excludedMonths = [];
  for (const row of rows) {
    const key = monthNumber(row.date);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }
  const byDay = new Map(rows.map(row => [row.day, row]));
  const firstMonth = rows.length ? monthNumber(rows[0].date) : 0, lastMonth = rows.length ? monthNumber(asOf) : -1;
  for (let number = firstMonth; number <= lastMonth; number++) {
    const group = grouped.get(number) ?? [];
    const startDate = monthStart(number), endDate = monthEnd(number), start = utcDay(startDate), end = utcDay(endDate), expectedDays = end - start + 1;
    const complete = endDate <= asOf && group.length === expectedDays && group[0]?.day === start && group.at(-1)?.day === end;
    if (!complete) { excludedMonths.push({ month: startDate.slice(0, 7), observedDays: group.length, expectedDays, reason: endDate > asOf ? 'unfinished-calendar-month' : 'missing-calendar-days' }); continue; }
    const prior = byDay.get(start - 1), logReturns = returnsFor(prior ? [prior, ...group] : group);
    const volumeTotal = group.reduce((sum, row) => sum + row.volume, 0);
    if (!Number.isFinite(volumeTotal)) throw new RangeError('Monthly volume exceeds finite numeric range');
    months.push({ month: startDate.slice(0, 7), monthNumber: number, startDate, endDate, days: expectedDays,
      volumeTotal, meanDailyVolume: volumeTotal / expectedDays, geometricMeanPrice: Math.exp(mean(group.map(row => Math.log(row.close)))),
      realizedVolatility: sd(logReturns) * Math.sqrt(365), returnCount: logReturns.length,
      zeroVolumeDays: group.filter(row => row.volume === 0).length, complete: true });
  }
  return { months, excludedMonths, observedDays: rows.length };
}

function anchorAt(rows, asOf) {
  const cutoff = utcDay(asOf), from = cutoff - VOLUME_FORECAST_DEFAULTS.anchorDays + 1;
  const recent = rows.filter(row => row.day >= from && row.day <= cutoff);
  const withPrior = rows.filter(row => row.day >= from - 1 && row.day <= cutoff);
  return { date: asOf, startDate: dateFromDay(from), observations: recent.length, expectedDays: 90,
    missingDays: 90 - recent.length, meanDailyVolume: mean(recent.map(row => row.volume)),
    lastPrice: recent.at(-1)?.close ?? null, lastObservedDate: recent.at(-1)?.date ?? null,
    geometricMeanPrice: recent.length ? Math.exp(mean(recent.map(row => Math.log(row.close)))) : null,
    realizedVolatility: sd(returnsFor(withPrior)) * Math.sqrt(365),
    zeroVolumeDays: recent.filter(row => row.volume === 0).length };
}

function differences(months) {
  const pairs = [];
  for (let i = 1; i < months.length; i++) {
    const left = months[i - 1], right = months[i];
    if (right.monthNumber !== left.monthNumber + 1 || !positive(left.meanDailyVolume) || !positive(right.meanDailyVolume)
      || !positive(left.realizedVolatility) || !positive(right.realizedVolatility)) continue;
    pairs.push({ month: right.month, y: Math.log(right.meanDailyVolume / left.meanDailyVolume),
      p: Math.log(right.geometricMeanPrice / left.geometricMeanPrice), r: Math.log(right.realizedVolatility / left.realizedVolatility) });
  }
  return pairs;
}

function ridgeFit(months, windowMonths) {
  const finalNumber = months.at(-1)?.monthNumber ?? 0;
  const window = months.filter(row => row.monthNumber > finalNumber - windowMonths);
  const pairs = differences(window), n = pairs.length;
  if (n < 24) return { available: false, windowMonths, observations: n, reason: 'fewer-than-24-valid-adjacent-log-differences' };
  const pMean = mean(pairs.map(row => row.p)), rMean = mean(pairs.map(row => row.r)), yMean = mean(pairs.map(row => row.y));
  const pScale = sd(pairs.map(row => row.p)), rScale = sd(pairs.map(row => row.r));
  const standardized = pairs.map(row => ({ p: pScale > 1e-12 ? (row.p - pMean) / pScale : 0, r: rScale > 1e-12 ? (row.r - rMean) / rScale : 0, y: row.y - yMean }));
  let pp = 4, rr = 4, pr = 0, py = 0, ry = 0;
  for (const row of standardized) { pp += row.p ** 2; rr += row.r ** 2; pr += row.p * row.r; py += row.p * row.y; ry += row.r * row.y; }
  const determinant = pp * rr - pr * pr;
  const priceCoefficient = pScale > 1e-12 ? (rr * py - pr * ry) / determinant / pScale : 0;
  const volatilityCoefficient = rScale > 1e-12 ? (pp * ry - pr * py) / determinant / rScale : 0;
  const intercept = yMean - priceCoefficient * pMean - volatilityCoefficient * rMean;
  const residuals = pairs.map(row => row.y - intercept - priceCoefficient * row.p - volatilityCoefficient * row.r);
  return { available: true, windowMonths, observations: n, trainingStart: window[0].startDate, trainingEnd: window.at(-1).endDate,
    priceCoefficient, volatilityCoefficient, intercept, meanLogVolumeChange: yMean,
    residualSD: Math.sqrt(residuals.reduce((sum, value) => sum + value ** 2, 0) / Math.max(1, n - 3)),
    ridgePenalty: 4, scales: { price: pScale, volatility: rScale }, interceptPenalized: false };
}

function fitParameters(months) {
  const windows = VOLUME_FORECAST_DEFAULTS.coefficientWindows.map(window => ridgeFit(months, window));
  const primary = windows.find(item => item.windowMonths === 84 && item.available) ?? windows.find(item => item.available);
  const available = windows.filter(item => item.available);
  // Duplicate effective windows in short histories provide no independent stability evidence.
  const distinct = available.filter((item, index, all) => all.findIndex(other => other.trainingStart === item.trainingStart && other.trainingEnd === item.trainingEnd) === index);
  const priceValues = distinct.map(item => item.priceCoefficient), volatilityValues = distinct.map(item => item.volatilityCoefficient);
  const samePriceSign = priceValues.length >= 2 && priceValues.every(value => Math.sign(value) === Math.sign(priceValues[0])) && priceValues.every(value => Math.abs(value) >= 0.05);
  const priceCoefficient = samePriceSign ? clamp(median(priceValues), -1, 1) : 0;
  const volatilityCoefficient = volatilityValues.length && volatilityValues.every(value => value > 0) ? clamp(median(volatilityValues), 0, 1.5) : 0;
  const recentMonths = months.filter(row => row.monthNumber > (months.at(-1)?.monthNumber ?? 0) - 84);
  const allPairs = differences(recentMonths);
  const trendPairs = [];
  for (let i = 1; i < recentMonths.length; i++) if (recentMonths[i].monthNumber === recentMonths[i - 1].monthNumber + 1 && positive(recentMonths[i].meanDailyVolume) && positive(recentMonths[i - 1].meanDailyVolume)) trendPairs.push(Math.log(recentMonths[i].meanDailyVolume / recentMonths[i - 1].meanDailyVolume));
  // Recalculate the intercept after coefficient shrinkage, rather than retaining an incompatible raw intercept.
  const drift = primary && allPairs.length ? mean(allPairs.map(row => row.y - priceCoefficient * row.p - volatilityCoefficient * row.r)) : 0;
  return { available: Boolean(primary), priceCoefficient, volatilityCoefficient,
    drift: clamp(drift, -0.10, 0.10), naiveDrift: clamp(mean(trendPairs.slice(-83)), -0.10, 0.10),
    residualSD: primary?.residualSD ?? sd(trendPairs.slice(-83)),
    priceStability: samePriceSign ? 'same-sign-across-distinct-windows' : 'unstable-or-insufficient-windows-shrunk-to-zero',
    priceSensitivity: priceValues.length ? [Math.min(0, ...priceValues.map(value => clamp(value, -1, 1))), Math.max(0, ...priceValues.map(value => clamp(value, -1, 1)))] : [0, 0],
    primaryWindowMonths: primary?.windowMonths ?? null, windows,
    excludedLogDifferencePairs: Math.max(0, recentMonths.length - 1 - allPairs.length),
    zeroVolumeMonths: months.filter(row => row.meanDailyVolume === 0).map(row => row.month),
    zeroVolatilityMonths: months.filter(row => row.realizedVolatility === 0).map(row => row.month),
    coefficientConstraints: { price: [-1, 1], volatility: [0, 1.5], monthlyDrift: [-0.10, 0.10] },
    causalInterpretation: false };
}

function driverAssumptions(months, anchor) {
  const last = months.at(-1)?.monthNumber ?? 0, recent = months.filter(row => row.monthNumber > last - 13);
  const changes = [];
  for (let i = 1; i < recent.length; i++) if (recent[i].monthNumber === recent[i - 1].monthNumber + 1) changes.push(Math.log(recent[i].geometricMeanPrice / recent[i - 1].geometricMeanPrice));
  const volatilityMedian = median(months.slice(-60).map(row => row.realizedVolatility).filter(positive));
  return { priceMonthlyTrend: clamp(mean(changes), -0.10, 0.10), volatilityAnchor: anchor.realizedVolatility,
    volatilityTarget: volatilityMedian, source: 'origin-prefix-only', futureRealizedCovariatesUsed: false };
}

function futureLogChange(params, method, months, priceRatio, volatilityRatio) {
  if (method.id === 'persistence') return 0;
  const elapsed = dampedTime(months, 12);
  if (method.id === 'damped') return params.naiveDrift * elapsed;
  return method.responseWeight * (params.drift * elapsed + params.priceCoefficient * Math.log(priceRatio) + params.volatilityCoefficient * Math.log(volatilityRatio));
}

function exAnteValue(fit, method, day) {
  const months = (day - utcDay(fit.anchor.date)) * 12 / DAYS_PER_YEAR;
  const priceRatio = Math.exp(fit.drivers.priceMonthlyTrend * dampedTime(months, 12));
  const initial = fit.drivers.volatilityAnchor, target = fit.drivers.volatilityTarget;
  const volatility = target + (initial - target) * 2 ** (-months / 24);
  const volatilityRatio = positive(initial) && positive(volatility) ? volatility / initial : 1;
  return fit.anchor.meanDailyVolume * Math.exp(futureLogChange(fit.params, method, months, priceRatio, volatilityRatio));
}

function metrics(pairs) {
  if (!pairs.length) return { count: 0, mae: null, meanAbsLogError: null, wapePct: null, maeRatioToPersistence: null };
  const error = pairs.reduce((sum, row) => sum + Math.abs(row.predicted - row.actual), 0);
  const actual = pairs.reduce((sum, row) => sum + row.actual, 0);
  return { count: pairs.length, mae: error / pairs.length,
    meanAbsLogError: mean(pairs.map(row => Math.abs(Math.log1p(row.predicted) - Math.log1p(row.actual)))),
    wapePct: actual > 0 ? 100 * error / actual : null, maeRatioToPersistence: null };
}

function metricCollection(samples) {
  const result = Object.fromEntries(METHODS.map(method => [method.id, metrics(samples.map(row => ({ actual: row.actual, predicted: row.predictions[method.id] })))]));
  for (const value of Object.values(result)) value.maeRatioToPersistence = result.persistence.mae > 0 ? value.mae / result.persistence.mae : value.mae === 0 ? 1 : null;
  return result;
}

function originFit(rows, months, origin) {
  const asOf = origin.endDate, prefix = months.filter(row => row.endDate <= asOf);
  const anchor = anchorAt(rows, asOf), params = fitParameters(prefix);
  return { anchor, params, drivers: driverAssumptions(prefix, anchor) };
}

function targetSample(fit, origin, target) {
  const days = Array.from({ length: target.days }, (_, i) => utcDay(target.startDate) + i);
  return { originDate: origin.endDate, targetMonth: target.month, targetEnd: target.endDate,
    horizonMonths: target.monthNumber - origin.monthNumber, actual: target.meanDailyVolume,
    predictions: Object.fromEntries(METHODS.map(method => [method.id, mean(days.map(day => exAnteValue(fit, method, day)))])),
    covariateSource: 'origin-prefix-only' };
}

function validateModel(rows, months) {
  const enoughForHoldout = months.length >= 72;
  const holdoutMonths = enoughForHoldout ? months.slice(-24) : [];
  const developmentMonths = enoughForHoldout ? months.slice(0, -24) : months;
  const developmentEnd = developmentMonths.at(-1)?.endDate ?? null, targets = new Map(developmentMonths.map(row => [row.monthNumber, row]));
  const samples = [];
  for (let i = 35; i < developmentMonths.length - 1; i++) {
    const origin = developmentMonths[i], fit = originFit(rows, developmentMonths, origin);
    if (fit.anchor.observations < 60 || !positive(fit.anchor.meanDailyVolume)) continue;
    for (const horizon of HORIZONS) {
      const target = targets.get(origin.monthNumber + horizon);
      if (target && target.endDate <= developmentEnd) samples.push(targetSample(fit, origin, target));
    }
  }
  const byHorizon = Object.fromEntries(HORIZONS.map(horizon => [horizon, { models: metricCollection(samples.filter(row => row.horizonMonths === horizon)) }]));
  const eligibleHorizons = HORIZONS.filter(horizon => byHorizon[horizon].models.persistence.count >= 12 && byHorizon[horizon].models.persistence.meanAbsLogError > 1e-12);
  const scores = METHODS.map(method => {
    const logRatio = eligibleHorizons.length ? mean(eligibleHorizons.map(horizon => byHorizon[horizon].models[method.id].meanAbsLogError / byHorizon[horizon].models.persistence.meanAbsLogError)) : null;
    const wapeRatio = eligibleHorizons.length ? mean(eligibleHorizons.map(horizon => byHorizon[horizon].models[method.id].wapePct / byHorizon[horizon].models.persistence.wapePct)) : null;
    return { method: method.id, complexity: method.complexity, logRatio, wapeRatio,
      qualifies: method.id !== 'persistence' && enoughForHoldout && eligibleHorizons.length >= 3 && logRatio <= 0.95 && wapeRatio <= 1.10 };
  });
  const winner = scores.filter(row => row.qualifies).sort((a, b) => a.logRatio - b.logRatio || a.complexity - b.complexity)[0];
  const selected = METHODS.find(method => method.id === winner?.method) ?? METHODS[0];
  const selection = { method: selected.id, responseWeight: selected.responseWeight, splitDate: developmentEnd,
    reason: winner ? 'development-log-error-gain-at-least-5pct-with-wape-guardrail' : 'no-eligible-development-gain-persistence-fallback',
    rule: { minimumLogErrorGain: 0.05, maximumWapeRatio: 1.10, minimumOriginsPerHorizon: 12, minimumEligibleHorizons: 3 },
    eligibleHorizons, scores, developmentMetrics: Object.fromEntries(HORIZONS.map(horizon => [horizon, byHorizon[horizon].models[selected.id]])),
    selectedWithoutHoldout: true };
  const holdoutOrigin = enoughForHoldout ? developmentMonths.at(-1) : null;
  const holdoutFit = holdoutOrigin ? originFit(rows, developmentMonths, holdoutOrigin) : null;
  const holdoutSamples = holdoutFit && holdoutFit.anchor.observations >= 60 && positive(holdoutFit.anchor.meanDailyVolume)
    ? holdoutMonths.map(target => targetSample(holdoutFit, holdoutOrigin, target)) : [];
  const holdoutMetrics = metricCollection(holdoutSamples);
  return { horizons: [...HORIZONS], methods: METHODS.map(({ complexity, ...method }) => method),
    target: 'calendar-month mean BTC/day', logErrorDefinition: 'mean(abs(log1p(forecast BTC/day)-log1p(actual BTC/day)))',
    futureRealizedCovariatesUsed: false, coefficientStabilityRecomputedAtEveryOrigin: true,
    designWasRetrospective: true, genuineProspectiveValidation: false, overlappingOutcomes: true, independentTrialCountClaim: null,
    development: { startDate: developmentMonths[0]?.startDate ?? null, endDate: developmentEnd, months: developmentMonths.length,
      byHorizon, originCount: new Set(samples.map(row => row.originDate)).size, samples },
    selection,
    holdout: { available: holdoutSamples.length > 0, startDate: holdoutMonths[0]?.startDate ?? null, endDate: holdoutMonths.at(-1)?.endDate ?? null,
      months: holdoutMonths.length, originDate: holdoutOrigin?.endDate ?? null, fixedOrigin: true, usedForSelection: false,
      metricsByMethod: holdoutMetrics, selectedMetrics: holdoutMetrics[selected.id],
      byHorizon: Object.fromEntries(HORIZONS.map(horizon => [horizon, { models: metricCollection(holdoutSamples.filter(row => row.horizonMonths === horizon)) }])), samples: holdoutSamples },
    longHorizonValidated: false, maximumEvaluatedHorizonMonths: samples.length ? Math.max(...samples.map(row => row.horizonMonths)) : 0 };
}

/** Deterministic, cutoff-specific fit. Refit for a different asOf; no wall clock or random generator is consulted. */
export function fitVolumeForecastModel(dailyBars, { asOf = dailyBars?.at(-1)?.date, source = 'Bitstamp' } = {}) {
  if (source !== 'Bitstamp') throw new RangeError('This model is scoped to Bitstamp BTC/USD; another venue requires a separately attributed fit');
  if (asOf === undefined) return unavailable('no-observations', null);
  const rows = observedPrefix(dailyBars, asOf), aggregation = aggregateVolumeMonths(rows.map(row => ({ ...row, time: row.day * DAY_SECONDS })), { asOf });
  const monthly = aggregation.months;
  const metadata = { version: 1, source, product: 'BTC-USD', unit: 'BTC/day', scope: 'single-exchange-spot-pair', globalMarketVolume: false,
    asOf, observedStart: rows[0]?.date ?? null, observedEnd: rows.at(-1)?.date ?? null, observedDays: rows.length,
    trainingStart: monthly[0]?.startDate ?? null, trainingEnd: monthly.at(-1)?.endDate ?? null, trainingMonths: monthly.length,
    completeCalendarMonthsOnly: true, excludedMonths: aggregation.excludedMonths, zeroVolumeDays: rows.filter(row => row.volume === 0).length,
    imputedDays: 0, sourceUrl: 'https://www.bitstamp.net/api/v2/ohlc/btcusd/', documentationUrl: 'https://www.bitstamp.net/api/' };
  if (monthly.length < 36) return unavailable('fewer-than-36-complete-calendar-months', asOf, metadata, monthly);
  const anchor = anchorAt(rows, asOf);
  if (anchor.observations < 60 || anchor.lastObservedDate !== asOf || !positive(anchor.meanDailyVolume)) return unavailable('insufficient-recent-positive-volume-anchor', asOf, metadata, monthly);
  const params = fitParameters(monthly), validation = validateModel(rows, monthly);
  return { status: 'ready', asOf, metadata, monthly, params, anchor, validation,
    assumptions: { ...VOLUME_FORECAST_DEFAULTS, futureRealizedCovariatesUsed: false, volumeTarget: 'conditional daily-mean BTC level; not a probability-distribution expectation',
      venueContinuesOperating: true, constantGlobalMarketShareClaim: false,
      venueClosureIncludedInRange: false, rangeLabel: '모형·거래소 점유율 가정 범위', probability: null, calibrated: false,
      rangeMultipliersAreAssumptions: true, driftDoesNotCompoundIndefinitely: true,
      pricePathHasRandomShocks: false, futureOHLCProduced: false } };
}

function priceNodes(priceRows, model) {
  if (!Array.isArray(priceRows) || priceRows.length > 50000) throw new TypeError('Price scenario must be an array of at most 50,000 rows');
  const cutoff = utcDay(model.asOf), nodes = [];
  let previous = -Infinity;
  for (const row of priceRows) {
    const day = utcDay(row?.date);
    if (day < cutoff) continue;
    if (day <= previous) throw new RangeError('Scenario price dates must be unique and ordered');
    const price = row.baselinePrice ?? row.price;
    if (!positive(price)) throw new TypeError('Positive baselinePrice or price is required');
    const volatility = row.annualizedVolatilityPct === undefined ? null : row.annualizedVolatilityPct / 100;
    if (volatility !== null && !positive(volatility)) throw new RangeError('Scenario volatility percent must be positive');
    nodes.push({ day, price, volatility, basis: row.baselinePrice !== undefined ? 'baselinePrice' : 'price' }); previous = day;
  }
  if (!nodes.length) return [];
  if (nodes[0].day > cutoff) nodes.unshift({ day: cutoff, price: model.anchor.lastPrice, volatility: null, basis: 'observed-close' });
  return nodes;
}

function projectionSummary(model, daily, annual, settings, volatilitySource) {
  const selection = model.validation.selection, method = METHODS.find(row => row.id === selection.method);
  const { development, ...validationCompact } = model.validation;
  const { samples: ignoredSamples, ...holdout } = validationCompact.holdout;
  return { source: model.metadata.source, product: 'BTC-USD', unit: 'BTC/day', asOf: model.asOf,
    trainingStart: model.metadata.trainingStart, trainingEnd: model.metadata.trainingEnd, trainingMonths: model.metadata.trainingMonths,
    anchorDailyVolume: model.anchor.meanDailyVolume, anchorStartDate: model.anchor.startDate, anchorObservedDays: model.anchor.observations,
    centralMethod: method.id, centralLabel: method.label, selection, holdout,
    firstDate: daily[0]?.date ?? null, lastDate: daily.at(-1)?.date ?? null, annualCount: annual.length,
    rangeLabel: model.assumptions.rangeLabel, probability: null, calibrated: false, longHorizonValidated: false,
    maximumBacktestHorizonMonths: model.validation.maximumEvaluatedHorizonMonths,
    usdProxyLabel: '기준 가격 × 가정 BTC 수량 (실제 VWAP 거래대금 아님)',
    venueContinuesOperating: true, venueClosureIncludedInRange: false,
    volatilitySource, terminalVolatility: settings.terminalVolatility, volatilityHalfLifeYears: settings.volatilityHalfLifeYears,
    terminalVolatilityRole: volatilitySource === 'provided-price-scenario' ? 'unused-fallback-only' : 'fallback-assumption',
    firstVolatilityAssumption: daily[0]?.annualizedVolatilityAssumption ?? null,
    lastVolatilityAssumption: daily.at(-1)?.annualizedVolatilityAssumption ?? null };
}

/** Smooth scenario quantity; priceRows are assumptions, not future observations. There are no invented candles. */
export function projectVolumeForecast(model, priceRows, options = {}) {
  if (model?.status !== 'ready') return { status: 'unavailable', reason: model?.reason ?? 'model-unavailable', points: [], summary: null, annual: [], diagnostics: {} };
  const { asOf = model.asOf, endDate, frequency = 'daily', terminalVolatility = 0.20, volatilityHalfLifeYears = 8 } = options;
  if (asOf !== model.asOf) throw new RangeError('Projection asOf must match the fitted cutoff; refit to change it');
  if (!['daily', 'weekly'].includes(frequency)) throw new RangeError('Volume projection frequency must be daily or weekly');
  if (!positive(terminalVolatility) || terminalVolatility > 5 || !positive(volatilityHalfLifeYears)) throw new RangeError('Invalid volatility assumptions');
  const nodes = priceNodes(priceRows, model), firstDay = utcDay(asOf);
  if (nodes.length < 2) return { status: 'unavailable', reason: 'no-future-price-scenario', points: [], summary: null, annual: [], diagnostics: {} };
  const requestedEnd = endDate === undefined ? nodes.at(-1).day : utcDay(endDate), lastDay = Math.min(requestedEnd, nodes.at(-1).day);
  if (lastDay <= firstDay) throw new RangeError('Volume scenario must end after its observation cutoff');
  if (lastDay - firstDay > 50000) throw new RangeError('Volume scenario exceeds the supported 50,000-day rendering budget');
  const method = METHODS.find(row => row.id === model.validation.selection.method), daily = [], annual = [];
  const initialPrice = nodes[0].price, initialVolatility = nodes[0].volatility ?? model.anchor.realizedVolatility;
  let nodeIndex = 1, providedVolatilityDays = 0, fallbackVolatilityDays = 0;
  for (let day = firstDay + 1; day <= lastDay; day++) {
    while (nodes[nodeIndex].day < day) nodeIndex++;
    const left = nodes[nodeIndex - 1], right = nodes[nodeIndex], fraction = (day - left.day) / (right.day - left.day);
    const priceReference = Math.exp(Math.log(left.price) + fraction * Math.log(right.price / left.price));
    const years = (day - firstDay) / DAYS_PER_YEAR, months = years * 12;
    const fallbackVolatility = terminalVolatility + (initialVolatility - terminalVolatility) * 2 ** (-years / volatilityHalfLifeYears);
    const usesProvidedVolatility = positive(left.volatility) && positive(right.volatility);
    if (usesProvidedVolatility) providedVolatilityDays++; else fallbackVolatilityDays++;
    const volatility = usesProvidedVolatility
      ? Math.exp(Math.log(left.volatility) + fraction * Math.log(right.volatility / left.volatility)) : fallbackVolatility;
    const priceRatio = priceReference / initialPrice, volatilityRatio = positive(initialVolatility) && positive(volatility) ? volatility / initialVolatility : 1;
    const centralLog = Math.log(model.anchor.meanDailyVolume) + futureLogChange(model.params, method, months, priceRatio, volatilityRatio);
    const alternativeLogs = METHODS.map(candidate => Math.log(model.anchor.meanDailyVolume) + futureLogChange(model.params, candidate, months, priceRatio, volatilityRatio));
    // Window sensitivity is retained even when an unstable price elasticity is excluded from the centre.
    for (const beta of model.params.priceSensitivity) alternativeLogs.push(Math.log(model.anchor.meanDailyVolume) + model.params.drift * dampedTime(months, 12)
      + beta * Math.log(priceRatio) + model.params.volatilityCoefficient * Math.log(volatilityRatio));
    // A finite residual tolerance and explicit venue-share assumptions, NOT a confidence interval.
    const residualTolerance = model.params.residualSD * Math.sqrt(12 * (1 - Math.exp(-months / 12)));
    const venueTolerance = Math.log(4) * (1 - 2 ** (-years / 8));
    const lowerLog = Math.min(centralLog, ...alternativeLogs) - residualTolerance - venueTolerance;
    const upperLog = Math.max(centralLog, ...alternativeLogs) + residualTolerance + venueTolerance;
    const volume = Math.exp(centralLog), lower = Math.exp(lowerLog), upper = Math.exp(upperLog), usdProxy = priceReference * volume;
    if (![volume, lower, upper, usdProxy].every(positive)) throw new RangeError('Scenario assumptions exceed finite positive numeric range');
    const date = dateFromDay(day), point = { date, time: day * DAY_SECONDS, volume, lower, upper, kind: 'scenario', unit: 'BTC', source: 'Bitstamp',
      product: 'BTC-USD', priceReference, usdProxy, annualizedVolatilityAssumption: volatility,
      probability: null, calibrated: false, daysIncluded: 1, startDate: date, endDate: date };
    daily.push(point);
    if (date.endsWith('-12-31')) annual.push({ year: Number(date.slice(0, 4)), date, volume, lower, upper, usdProxy, priceReference, unit: 'BTC/day' });
  }
  let points = daily, excludedPartialWeekDays = 0;
  if (frequency === 'weekly') {
    const groups = new Map();
    for (const point of daily) {
      const day = utcDay(point.date), monday = day - ((day + 3) % 7 + 7) % 7;
      if (!groups.has(monday)) groups.set(monday, []);
      groups.get(monday).push(point);
    }
    points = [];
    for (const [monday, week] of groups) {
      if (week.length !== 7 || utcDay(week[0].date) !== monday || utcDay(week.at(-1).date) !== monday + 6) { excludedPartialWeekDays += week.length; continue; }
      const sum = key => week.reduce((value, point) => value + point[key], 0), last = week.at(-1), volume = sum('volume'), usdProxy = sum('usdProxy');
      const lower = sum('lower'), upper = sum('upper'), priceReference = usdProxy / volume;
      if (![volume, lower, upper, usdProxy, priceReference].every(positive)) throw new RangeError('Weekly scenario sums exceed finite positive numeric range');
      points.push({ ...last, time: monday * DAY_SECONDS, date: dateFromDay(monday + 6), startDate: dateFromDay(monday), endDate: dateFromDay(monday + 6),
        volume, lower, upper, usdProxy, priceReference,
        daysIncluded: 7, completeCalendarWeek: true });
    }
  }
  const volatilitySource = !fallbackVolatilityDays ? 'provided-price-scenario' : !providedVolatilityDays ? 'anchored-mean-reversion-assumption' : 'mixed-provided-scenario-and-fallback';
  const summary = projectionSummary(model, daily, annual, { terminalVolatility, volatilityHalfLifeYears }, volatilitySource);
  return { status: 'ready', points, summary, annual,
    diagnostics: { frequency, dailyDays: daily.length, returnedPoints: points.length, excludedPartialWeekDays,
      requestedEndDate: dateFromDay(requestedEnd), actualEndDate: dateFromDay(lastDay), priceHorizonClipped: requestedEnd > lastDay,
      priceBasis: nodes.every(row => row.basis !== 'price') ? 'baselinePrice' : 'baselinePrice-when-available-otherwise-price',
      volatilitySource, providedVolatilityDays, fallbackVolatilityDays,
      interpolatedReferencePrices: true, extrapolatedDays: 0, futureOHLCProduced: false, futureObservedVolumeUsed: false,
      annualUnit: 'BTC/day', weeklyUnit: 'BTC per complete future-only calendar week',
      rangeIsConfidenceInterval: false, rangeCoverageProbability: null, venueClosureIncludedInRange: false,
      usdProxyDefinition: 'sum of reference price × assumed daily BTC quantity; not observed or forecast VWAP turnover' } };
}
