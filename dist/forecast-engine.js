import { HALVINGS, utcDay, dateFromDay, validateDataset } from './cycle-engine.js?v=1.19.0';
import { shiftCalendarMonths } from './cycle-timing.js?v=1.19.0';

/**
 * Conditional scenarios, not a fitted market-price forecasting model.
 * All inputs are daily USD observations. Nothing after asOf enters a scenario.
 * Historical cycle labels and the two replay cutoffs are retrospective choices.
 */
const DEFAULT_REPLAY_CUTOFFS = Object.freeze(['2019-03-31', '2023-03-31']);
const DEFAULT_REPLAY_HORIZONS = Object.freeze([90, 180, 365]);
const VALIDATION_END = '2024-12-31';

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length ? sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2 : null;
};
const geometricMean = (values) => values.length === 1 ? values[0] : values.length ? Math.max(Math.min(...values), Math.min(Math.max(...values), Math.exp(values.reduce((sum, value) => sum + Math.log(value), 0) / values.length))) : null;
const addDays = (date, days) => dateFromDay(utcDay(date) + days);
const observation = (row) => row ? { date: row.date, price: row.price } : null;
const priceBand = (values) => values.length ? { min: Math.min(...values), max: Math.max(...values), rangeType: 'assumption-sensitivity', probability: null } : null;

function extreme(rows, startDate, endDate, maximum) {
  let selected = null;
  for (const row of rows) if (row.date >= startDate && row.date <= endDate && (!selected || (maximum ? row.price > selected.price : row.price < selected.price))) selected = row;
  return selected;
}

function inputPrefix(input, asOf) {
  if (asOf !== undefined) utcDay(asOf);
  const rows = validateDataset(input).filter((row) => asOf === undefined || row.date <= asOf);
  if (!rows.length) throw new RangeError('No price observations available through asOf');
  return rows;
}

/** Select past cycle extrema only after their following observed halving. */
function stateAt(rows, highZoneFraction) {
  const latest = rows.at(-1);
  const activeIndex = HALVINGS.findLastIndex((halving) => halving.date <= latest.date);
  if (activeIndex < 0) throw new RangeError('At least one observed halving is required');
  const historical = [];
  for (let index = 0; index < activeIndex; index++) {
    const halving = HALVINGS[index], next = HALVINGS[index + 1];
    const peakYear = halving.year + 1;
    const peak = extreme(rows, `${peakYear}-01-01`, `${peakYear}-12-31`, true);
    if (!peak) continue;
    const trough = extreme(rows, addDays(peak.date, 1), addDays(next.date, -1), false);
    if (!trough || trough.price >= peak.price) continue;
    historical.push({
      year: halving.year, halvingDate: halving.date,
      peak: observation(peak), trough: observation(trough),
      knownAt: next.date, peakToTroughDays: trough.epochDay - peak.epochDay,
      troughRetention: trough.price / peak.price, retrospective: true,
    });
  }
  const halving = HALVINGS[activeIndex];
  const peak = extreme(rows, halving.date, latest.date, true);
  const lower = extreme(rows, addDays(peak.date, 1), latest.date, false);
  const trough = lower && lower.price < peak.price ? lower : null;
  const entry = rows.find((row) => row.date >= halving.date && row.date <= peak.date && row.price >= highZoneFraction * peak.price);
  const current = {
    date: latest.date, price: latest.price, year: halving.year, halvingDate: halving.date,
    peak: { ...observation(peak), provisional: true },
    troughCandidate: trough ? { ...observation(trough), provisional: true, daysAfterPeak: trough.epochDay - peak.epochDay } : null,
    phaseDays: trough ? latest.epochDay - trough.epochDay : null,
    firstHighZoneEntry: entry ? {
      ...observation(entry), thresholdFraction: highZoneFraction,
      thresholdPrice: highZoneFraction * peak.price,
      daysBeforePeak: peak.epochDay - entry.epochDay,
      retrospective: true, denominatorIsObservedPeak: true,
    } : null,
    invalidation: trough ? {
      lowerThanPrice: trough.price,
      meaning: 'A later daily observation below this candidate invalidates the present bottom anchor; recalculate every dependent scenario.',
    } : null,
  };
  return { historical, current };
}

/**
 * Label internal extrema only once the analogue itself reverses by reversalPct.
 * Unconfirmed final extrema and the starting boundary are never called turns.
 * These are confirmations INSIDE a borrowed historical path, not future facts.
 */
export function detectScenarioTurns(path, { reversalPct = 20 } = {}) {
  if (!(reversalPct > 0 && reversalPct < 100)) throw new RangeError('reversalPct must be between 0 and 100');
  if (!Array.isArray(path) || path.length < 2) return [];
  for (let index = 0; index < path.length; index++) {
    const point = path[index];
    utcDay(point.date);
    if (!(Number.isFinite(point.price) && point.price > 0)) throw new TypeError('Scenario prices must be positive and finite');
    if (index && point.date <= path[index - 1].date) throw new TypeError('Scenario dates must be strictly increasing');
  }
  const reversal = reversalPct / 100;
  const events = [];
  let direction = null, high = path[0], low = path[0];
  const append = (type, turn, confirmation) => {
    if (turn.date === path[0].date || turn.date >= confirmation.date) return;
    events.push({
      type, date: turn.date, price: turn.price,
      horizonDay: turn.horizonDay ?? utcDay(turn.date) - utcDay(path[0].date),
      confirmationDate: confirmation.date, confirmationPrice: confirmation.price,
      sourceDate: turn.sourceDate ?? null,
      sourceConfirmationDate: confirmation.sourceDate ?? null,
      reversalPct, kind: 'conditional-analogue-turn',
      status: 'confirmed-inside-historical-analogue-only',
      futureObservation: false, probability: null,
    });
  };
  for (let index = 1; index < path.length; index++) {
    const point = path[index];
    if (direction === null) {
      if (point.price > high.price) high = point;
      if (point.price < low.price) low = point;
      if (point.price >= low.price * (1 + reversal) && low.date < point.date) {
        // Establish the incoming direction first. A shallow initial dip followed
        // by a rally is not a fully observed 20%-down/20%-up internal trough.
        direction = 'up'; high = point;
      } else if (point.price <= high.price * (1 - reversal) && high.date < point.date) {
        direction = 'down'; low = point;
      }
    } else if (direction === 'up') {
      if (point.price > high.price) high = point;
      if (point.price <= high.price * (1 - reversal)) {
        append('peak', high, point);
        direction = 'down'; low = point;
      }
    } else {
      if (point.price < low.price) low = point;
      if (point.price >= low.price * (1 + reversal)) {
        append('trough', low, point);
        direction = 'up'; high = point;
      }
    }
  }
  return events;
}

function analoguePaths(rows, state, { horizonDays, reversalPct }) {
  const { current, historical } = state;
  const scenarios = [], excluded = [];
  if (!current.troughCandidate) return { scenarios, excluded, reason: 'No post-peak low candidate is available.' };
  const byDate = new Map(rows.map((row) => [row.date, row]));
  for (const reference of historical) {
    const alignedDate = addDays(reference.trough.date, current.phaseDays);
    const sourceEndDate = addDays(alignedDate, horizonDays);
    const base = byDate.get(alignedDate);
    if (!base || sourceEndDate > current.date) {
      excluded.push({ year: reference.year, reason: 'The full aligned historical horizon was not observed by asOf.', sourceEndDate });
      continue;
    }
    const path = [];
    let missingDate = null;
    for (let horizonDay = 0; horizonDay <= horizonDays; horizonDay++) {
      const sourceDate = addDays(alignedDate, horizonDay), source = byDate.get(sourceDate);
      if (!source) { missingDate = sourceDate; break; }
      path.push({
        date: addDays(current.date, horizonDay), horizonDay,
        price: current.price * (source.price / base.price),
        sourceDate, kind: horizonDay ? 'conditional-analogue' : 'observed-anchor',
      });
    }
    if (missingDate) {
      excluded.push({ year: reference.year, reason: 'A historical UTC day is missing; no interpolation or fabricated return is inserted.', missingDate });
      continue;
    }
    const highest = path.reduce((a, b) => b.price > a.price ? b : a);
    const lowest = path.reduce((a, b) => b.price < a.price ? b : a);
    const firstCandidateBreak = path.find((point) => point.price < current.troughCandidate.price);
    scenarios.push({
      id: `analogue-${reference.year}`, family: 'historical-analogue',
      label: `${reference.trough.date.slice(0, 4)} 저점 이후 경로`,
      referenceYear: reference.year, referenceTrough: reference.trough,
      referenceKnownAt: reference.knownAt, sourceAlignedDate: alignedDate,
      sourceEndDate, phaseDays: current.phaseDays,
      formula: 'S_j(h) = P(asOf) × P(b_j + phaseDays + h) / P(b_j + phaseDays)',
      condition: 'The current low candidate remains the cycle low and the selected historical post-low return sequence repeats without a time shift.',
      historicalSelectionIsRetrospective: true, probability: null,
      consistency: {
        staysAboveCurrentLowCandidate: !firstCandidateBreak,
        firstCandidateBreakDate: firstCandidateBreak?.date ?? null,
        meaning: firstCandidateBreak ? 'This scaled replay itself breaks the current low; its bottom-holds interpretation becomes invalid from that date.' : 'The replay stays above the current low candidate within this horizon; this is not a guarantee about actual prices.',
      },
      path, events: detectScenarioTurns(path, { reversalPct }),
      statistics: {
        horizonHigh: { date: highest.date, price: highest.price, isBoundary: highest.horizonDay === 0 || highest.horizonDay === horizonDays, turningPointClaim: false },
        horizonLow: { date: lowest.date, price: lowest.price, isBoundary: lowest.horizonDay === 0 || lowest.horizonDay === horizonDays, turningPointClaim: false },
        endDate: path.at(-1).date, endPrice: path.at(-1).price,
        endReturnPct: (path.at(-1).price / current.price - 1) * 100,
      },
    });
  }
  return { scenarios, excluded, reason: scenarios.length ? null : 'No complete, contiguous historical analogue horizon is available.' };
}

function samplePaths(scenarios, horizonDays, stepDays) {
  const offsets = new Set([0, horizonDays]);
  for (let day = 0; day <= horizonDays; day += stepDays) offsets.add(day);
  for (const scenario of scenarios) for (const event of scenario.events) {
    offsets.add(event.horizonDay);
    offsets.add(utcDay(event.confirmationDate) - utcDay(scenario.path[0].date));
  }
  const ordered = [...offsets].sort((a, b) => a - b);
  const envelope = scenarios.length ? ordered.map((day) => {
    const prices = scenarios.map((scenario) => scenario.path[day].price);
    return {
      date: scenarios[0].path[day].date, horizonDay: day,
      min: Math.min(...prices), max: Math.max(...prices),
      geometricMean: geometricMean(prices), n: prices.length,
      rangeType: 'historical-analogue-range', probability: null,
    };
  }) : [];
  return { scenarios: scenarios.map((scenario) => ({ ...scenario, path: ordered.map((day) => scenario.path[day]) })), envelope };
}

function dateWindow(dates, centerDate) {
  const sorted = [...dates].sort();
  return sorted.length ? {
    startDate: sorted[0], centerDate: centerDate ?? dateFromDay(Math.round(median(sorted.map(utcDay)))),
    endDate: sorted.at(-1), rangeType: 'conditional-date-sensitivity', probability: null,
  } : null;
}

function shiftedWindow(window, days) {
  return window ? { ...window, startDate: addDays(window.startDate, days), centerDate: addDays(window.centerDate, days), endDate: addDays(window.endDate, days) } : null;
}

/** Straight lines in log-price space through explicitly assumed event anchors. */
export function interpolateLogAnchors(anchors, { stepDays = 14 } = {}) {
  if (!Number.isSafeInteger(stepDays) || stepDays < 1) throw new RangeError('stepDays must be a positive integer');
  if (!anchors.length) return [];
  for (let index = 0; index < anchors.length; index++) {
    const point = anchors[index];
    utcDay(point.date);
    if (![point.price, point.low ?? point.price, point.high ?? point.price].every((value) => Number.isFinite(value) && value > 0)) throw new TypeError('Log-price anchors must be positive and finite');
    if (!((point.low ?? point.price) <= point.price && point.price <= (point.high ?? point.price))) throw new RangeError('Anchor price must be inside its sensitivity band');
    if (index && point.date <= anchors[index - 1].date) throw new TypeError('Anchor dates must be strictly increasing');
  }
  const path = [];
  for (let index = 0; index < anchors.length - 1; index++) {
    const a = anchors[index], b = anchors[index + 1];
    const days = utcDay(b.date) - utcDay(a.date);
    for (let day = 0; day < days; day += stepDays) {
      const weight = day / days;
      const blend = (start, end) => Math.exp((1 - weight) * Math.log(start) + weight * Math.log(end));
      path.push({
        date: addDays(a.date, day), price: blend(a.price, b.price),
        low: blend(a.low ?? a.price, b.low ?? b.price),
        high: blend(a.high ?? a.price, b.high ?? b.price),
        kind: index === 0 && day === 0 ? 'observed-anchor' : 'schematic-log-interpolation',
      });
    }
  }
  const last = anchors.at(-1);
  path.push({ date: last.date, price: last.price, low: last.low ?? last.price, high: last.high ?? last.price, kind: anchors.length === 1 ? 'observed-anchor' : 'schematic-log-interpolation' });
  return path;
}

function macroScenarios(state, { highZoneFraction }) {
  const { current, historical } = state;
  const allCycles = [...historical, { year: current.year, peak: current.peak, trough: current.troughCandidate }];
  const lowToNextPeakIntervals = historical.flatMap((reference) => {
    const next = allCycles.find((cycle) => cycle.year > reference.year);
    return next && next.peak.date > reference.trough.date ? [{
      fromCycleYear: reference.year, fromDate: reference.trough.date,
      toDate: next.peak.date, days: utcDay(next.peak.date) - utcDay(reference.trough.date),
      nextPeakProvisional: next.year === current.year, retrospective: true,
    }] : [];
  });
  const peakToTroughIntervals = historical.map((cycle) => ({
    cycleYear: cycle.year, peakDate: cycle.peak.date, troughDate: cycle.trough.date,
    days: cycle.peakToTroughDays, completedReference: true,
  }));
  const previousPeak = historical.at(-1)?.peak;
  const lastPeakMultiple = previousPeak ? current.peak.price / previousPeak.price : null;
  const peakPriceCases = lastPeakMultiple ? [0.5, 0.75, 1].map((alpha) => ({
    alpha, price: current.peak.price * lastPeakMultiple ** alpha,
    label: `직전 고점 간 로그 성장 ${alpha * 100}% 유지`,
    parameterIsAssumed: true, probability: null,
  })) : [];
  const retentionCases = historical.map((cycle) => ({
    id: `retention-${cycle.year}`, cycleYear: cycle.year,
    ratio: cycle.troughRetention, drawdownPct: (cycle.troughRetention - 1) * 100,
    peakDate: cycle.peak.date, troughDate: cycle.trough.date,
    provisional: false,
  }));
  if (current.troughCandidate) retentionCases.push({
    id: `retention-${current.year}-candidate`, cycleYear: current.year,
    ratio: current.troughCandidate.price / current.peak.price,
    drawdownPct: (current.troughCandidate.price / current.peak.price - 1) * 100,
    peakDate: current.peak.date, troughDate: current.troughCandidate.date,
    provisional: true,
  });
  const troughPriceGrid = peakPriceCases.flatMap((peakCase) => retentionCases.map((retention) => ({
    alpha: peakCase.alpha, retentionId: retention.id, retention: retention.ratio,
    price: peakCase.price * retention.ratio, usesProvisionalRetention: retention.provisional,
  })));
  const peakPriceBand = priceBand(peakPriceCases.map((entry) => entry.price));
  const troughPriceBand = priceBand(troughPriceGrid.map((entry) => entry.price));
  const centerPeakPrice = peakPriceCases.find((entry) => entry.alpha === 0.75)?.price ?? null;
  const centerRetention = historical.at(-1)?.troughRetention ?? null;
  const centerTroughPrice = centerPeakPrice && centerRetention ? centerPeakPrice * centerRetention : null;
  const observedZoneLead = current.firstHighZoneEntry?.daysBeforePeak ?? 0;
  const scenarios = [];

  const addScenario = ({ id, label, peakWindow, highZoneWindow, troughWindow, assumptions, shorterDeclineWindow = null }) => {
    const anchors = [{ date: current.date, price: current.price, low: current.price, high: current.price, type: 'observed' }];
    const events = [];
    if (peakPriceBand && centerPeakPrice) {
      if (highZoneWindow && highZoneWindow.centerDate > current.date && highZoneWindow.centerDate < peakWindow.centerDate) anchors.push({
        date: highZoneWindow.centerDate, price: highZoneFraction * centerPeakPrice,
        low: highZoneFraction * peakPriceBand.min, high: highZoneFraction * peakPriceBand.max, type: 'high-zone',
      });
      if (peakWindow.centerDate > current.date) {
        anchors.push({ date: peakWindow.centerDate, price: centerPeakPrice, low: peakPriceBand.min, high: peakPriceBand.max, type: 'peak' });
        events.push({ type: 'peak', date: peakWindow.centerDate, price: centerPeakPrice, window: peakWindow, priceBand: peakPriceBand, kind: 'assumed-macro-event', probability: null });
      }
      if (troughWindow && centerTroughPrice && troughPriceBand && troughWindow.centerDate > anchors.at(-1).date) {
        anchors.push({ date: troughWindow.centerDate, price: centerTroughPrice, low: troughPriceBand.min, high: troughPriceBand.max, type: 'trough' });
        events.push({ type: 'trough', date: troughWindow.centerDate, price: centerTroughPrice, window: troughWindow, priceBand: troughPriceBand, kind: 'assumed-macro-event', probability: null });
      }
    }
    scenarios.push({
      id, family: 'macro-timing-scenario', label,
      peakWindow, highZoneWindow, troughWindow, shorterDeclineWindow,
      peakPriceBand, troughPriceBand, anchors, events,
      path: interpolateLogAnchors(anchors),
      pathMeaning: 'Schematic log-price interpolation between assumed events; neither a daily-return forecast nor a calibrated confidence band.',
      assumptions, probability: null,
    });
  };

  if (current.troughCandidate && lowToNextPeakIntervals.length && peakToTroughIntervals.length) {
    const peakDates = lowToNextPeakIntervals.map((interval) => addDays(current.troughCandidate.date, interval.days));
    const peakWindow = dateWindow(peakDates);
    const bearDays = peakToTroughIntervals.map((interval) => interval.days);
    const troughDates = peakDates.flatMap((peakDate) => bearDays.map((days) => addDays(peakDate, days)));
    const troughWindow = dateWindow(troughDates, addDays(peakWindow.centerDate, Math.round(median(bearDays))));
    addScenario({
      id: 'bottom-holds', label: '저점 유지 · 과거 회복기간',
      peakWindow, highZoneWindow: shiftedWindow(peakWindow, -observedZoneLead), troughWindow,
      shorterDeclineWindow: shiftedWindow(peakWindow, current.troughCandidate.daysAfterPeak),
      assumptions: [
        'The present post-peak minimum remains the cycle low.',
        'Repeat the observed historical low-to-next-peak intervals. The interval ending at the current observed peak is provisional.',
        'Apply the range of completed historical peak-to-trough durations after the next peak. The currently shorter decline is a separate sensitivity.',
        'The high-zone date repeats the currently observed high-zone-to-peak gap; no extra 3–5-month deduction is applied to this model.',
      ],
    });
  }
  for (const earlierMonths of [0, 3, 4, 5]) {
    const peakDate = shiftCalendarMonths(current.peak.date, 48 - earlierMonths);
    const highZoneDate = current.firstHighZoneEntry ? shiftCalendarMonths(current.firstHighZoneEntry.date, 48 - earlierMonths) : peakDate;
    const troughDate = current.troughCandidate ? shiftCalendarMonths(current.troughCandidate.date, 48 - earlierMonths) : null;
    addScenario({
      id: earlierMonths ? `calendar-minus-${earlierMonths}m` : 'calendar-48m',
      label: earlierMonths ? `48개월 기준에서 추가 ${earlierMonths}개월 앞당김` : '관측 사건 +48개월',
      peakWindow: dateWindow([peakDate]), highZoneWindow: dateWindow([highZoneDate]),
      troughWindow: troughDate ? dateWindow([troughDate]) : null,
      assumptions: [
        `Repeat each current observed event after ${48 - earlierMonths} calendar months.`,
        earlierMonths ? 'The extra advance is a user-specified sensitivity, not an estimated acceleration rate.' : 'This baseline already inherits the current cycle’s event dates; earlier arrival must not be subtracted a second time.',
        'High-zone entry and absolute peak are distinct events and are shifted individually.',
        'The future low uses the current provisional low anchor and inherits its current decline duration.',
      ],
    });
  }
  return {
    scenarios, lowToNextPeakIntervals, peakToTroughIntervals,
    priceModel: {
      previousPeak: previousPeak ?? null, currentPeak: current.peak, lastPeakMultiple,
      peakFormula: 'Q_next(alpha) = Q_current × (Q_current / Q_previous)^alpha',
      troughFormula: 'L_next(alpha, r) = Q_next(alpha) × r',
      peakPriceCases, retentionCases, troughPriceGrid, peakPriceBand, troughPriceBand,
      representativeAlpha: 0.75, representativeRetention: centerRetention,
      representativeChoiceIsNotEstimated: true,
      meaning: 'A price sensitivity grid. Alpha = 0.50/0.75/1.00 is an explicit convenience assumption, not a fitted distribution. Historical retention ratios and the current provisional ratio are separate stress assumptions.',
      noFiniteHistoryProof: true, probability: null,
    },
    bottomHoldsScenarioRequiresCurrentCandidate: true,
    unknownFutureHalvingDateUsed: false,
  };
}

/**
 * Fixed-cutoff historical replay. The forecast sees only each cutoff's prefix.
 * Outcomes after 2024 are excluded, including the current 2025/2026 cycle.
 * Two hand-selected regimes cannot establish out-of-sample predictive power.
 */
export function backtestAnalogueForecast(input, {
  cutoffs = DEFAULT_REPLAY_CUTOFFS, horizons = DEFAULT_REPLAY_HORIZONS,
  validationEnd = VALIDATION_END, highZoneFraction = 0.95, reversalPct = 20,
} = {}) {
  utcDay(validationEnd);
  if (!(highZoneFraction > 0 && highZoneFraction <= 1)) throw new RangeError('highZoneFraction must be in (0, 1]');
  if (!(reversalPct > 0 && reversalPct < 100)) throw new RangeError('reversalPct must be between 0 and 100');
  if (!Array.isArray(cutoffs) || new Set(cutoffs).size !== cutoffs.length) throw new TypeError('Replay cutoffs must be an array of distinct dates');
  if (!Array.isArray(horizons) || !horizons.length || horizons.some((value) => !Number.isSafeInteger(value) || value < 1)) throw new RangeError('Replay horizons must be positive integer days');
  if (new Set(horizons).size !== horizons.length) throw new RangeError('Replay horizons must be distinct');
  const rows = validateDataset(input);
  const outcomeLimit = rows.at(-1).date < validationEnd ? rows.at(-1).date : validationEnd;
  const outcomes = new Map(rows.filter((row) => row.date <= outcomeLimit).map((row) => [row.date, row]));
  const samples = [], excluded = [];
  for (const cutoff of cutoffs) {
    utcDay(cutoff);
    const prefix = rows.filter((row) => row.date <= cutoff);
    if (!prefix.length || prefix.at(-1).date !== cutoff || cutoff >= outcomeLimit) {
      excluded.push({ cutoff, reason: 'A complete cutoff observation and subsequent eligible outcomes are required.' });
      continue;
    }
    const allowedHorizons = horizons.filter((horizon) => addDays(cutoff, horizon) <= outcomeLimit && outcomes.has(addDays(cutoff, horizon)));
    if (!allowedHorizons.length) { excluded.push({ cutoff, reason: 'No outcome exists before the validation ceiling.' }); continue; }
    const state = stateAt(prefix, highZoneFraction);
    const results = [];
    for (const horizonDays of allowedHorizons) {
      const projection = analoguePaths(prefix, state, { horizonDays, reversalPct });
      if (!projection.scenarios.length) { excluded.push({ cutoff, horizonDays, reason: projection.reason }); continue; }
      const outcomeDate = addDays(cutoff, horizonDays), actual = outcomes.get(outcomeDate).price;
      const values = projection.scenarios.map((scenario) => scenario.path[horizonDays].price);
      const prediction = geometricMean(values), naive = state.current.price;
      const error = (value) => ({ absoluteLogError: Math.abs(Math.log(value / actual)), absolutePercentageErrorPct: Math.abs(value / actual - 1) * 100 });
      results.push({
        horizonDays, outcomeDate, actualPrice: actual,
        referenceYears: projection.scenarios.map((scenario) => scenario.referenceYear),
        maxReferenceSourceDate: projection.scenarios.map((scenario) => scenario.sourceEndDate).sort().at(-1),
        analogueGeometricMean: prediction, flatPriceBaseline: naive,
        analogueRange: { min: Math.min(...values), max: Math.max(...values), n: values.length, probability: null },
        analogueError: error(prediction), flatError: error(naive),
      });
    }
    if (!results.length) continue;
    samples.push({
      cutoff, priceAtCutoff: state.current.price, lowCandidateAtCutoff: state.current.troughCandidate,
      phaseDays: state.current.phaseDays, referenceYears: [...new Set(results.flatMap(result => result.referenceYears))].sort((a, b) => a - b),
      maxReferenceSourceDate: results.map(result => result.maxReferenceSourceDate).sort().at(-1),
      predictionInformationThrough: cutoff, results,
    });
  }
  const summary = horizons.map((horizonDays) => {
    const results = samples.flatMap((sample) => sample.results.filter((result) => result.horizonDays === horizonDays));
    const mean = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    return {
      horizonDays, n: results.length,
      analogueMeanAbsoluteLogError: mean(results.map((result) => result.analogueError.absoluteLogError)),
      flatMeanAbsoluteLogError: mean(results.map((result) => result.flatError.absoluteLogError)),
      analogueMeanAbsolutePercentageErrorPct: mean(results.map((result) => result.analogueError.absolutePercentageErrorPct)),
      flatMeanAbsolutePercentageErrorPct: mean(results.map((result) => result.flatError.absolutePercentageErrorPct)),
      analogueBetterCount: results.filter((result) => result.analogueError.absoluteLogError < result.flatError.absoluteLogError).length,
    };
  });
  return {
    samples, summary, excluded, numberOfDistinctCutoffs: samples.length,
    validationEnd: outcomeLimit, requestedValidationEnd: validationEnd,
    forecastsUseOnlyCutoffPrefix: true,
    currentCycleIncluded: samples.some(sample => sample.results.some(result => result.outcomeDate >= '2025-01-01')),
    testedModel: 'Undiscounted historical analogue returns; geometric mean across available analogues, compared with unchanged current price.',
    notTested: [...(samples.some(sample => sample.results.some(result => result.horizonDays === 730)) ? [] : ['730-day performance']), 'macro event dates', 'log-growth alpha choices', 'future peak/trough prices', 'calibrated interval coverage'],
    limits: [
      `${samples.length} evaluated cutoff(s); the origin selection is retrospective, with no significance test or predictive-probability claim.`,
      'Horizons from the same origin overlap. Changing the origin or horizon count does not create independent market cycles.',
      'Past reference cycle extrema are selected retrospectively, although each selection window was completed before its replay cutoff.',
      'Current low candidates are computed from each cutoff prefix, not replaced by later-known lows.',
      'The default evaluation excludes outcomes from 2025 onward. Custom cutoffs or a later validation ceiling can include them; currentCycleIncluded reports whether any were actually scored.',
    ],
  };
}

export function analyzeCycleForecast(input, {
  asOf, horizonDays = 730, pathStepDays = 7, reversalPct = 20,
  highZoneFraction = 0.95, includeBacktest = true,
} = {}) {
  if (!Number.isSafeInteger(horizonDays) || horizonDays < 1 || horizonDays > 1461) throw new RangeError('horizonDays must be an integer between 1 and 1461');
  if (!Number.isSafeInteger(pathStepDays) || pathStepDays < 1) throw new RangeError('pathStepDays must be a positive integer');
  if (!(highZoneFraction > 0 && highZoneFraction <= 1)) throw new RangeError('highZoneFraction must be in (0, 1]');
  if (!(reversalPct > 0 && reversalPct < 100)) throw new RangeError('reversalPct must be between 0 and 100');
  const rows = inputPrefix(input, asOf);
  const state = stateAt(rows, highZoneFraction);
  const projected = analoguePaths(rows, state, { horizonDays, reversalPct });
  const sampled = samplePaths(projected.scenarios, horizonDays, pathStepDays);
  const macro = macroScenarios(state, { highZoneFraction });
  return {
    schemaVersion: 1, asOf: state.current.date,
    horizonDays, horizonDate: addDays(state.current.date, horizonDays),
    source: Array.isArray(input) ? {} : { source: input.meta?.source, sourceName: input.meta?.sourceName, metric: input.meta?.metric, retrievedAt: input.meta?.retrievedAt },
    current: state.current,
    availability: {
      analogue: sampled.scenarios.length > 0, candidateTrough: Boolean(state.current.troughCandidate),
      reason: projected.reason, excludedAnalogues: projected.excluded,
    },
    scenarios: sampled.scenarios, envelope: sampled.envelope, macro,
    backtest: includeBacktest ? backtestAnalogueForecast({ prices: rows.map((row) => [row.date, row.price]) }, { highZoneFraction, reversalPct }) : null,
    methodology: {
      unit: 'USD per bitcoin', observationTime: 'UTC daily observation label, not intraday high/low',
      analogueFormula: 'S_j(h) = P_t × P_(b_j + d + h) / P_(b_j + d), d = t − b_current',
      analogueMeaning: 'Replays realized historical returns at the same number of days after each past low; no least-squares curve fit or time warp is used.',
      baselineFormula: 'Flat(h) = P_t',
      macroTimingFormula: 'NextPeak_j = currentLowCandidateDate + (historicalNextPeakDate_j − historicalLowDate_j)',
      nextTroughFormula: 'NextTrough_(j,k) = NextPeak_j + historicalCompletedPeakToTroughDays_k',
      calendarFormula: 'calendar(event, extraMonths) = observedEventDate + (48 − extraMonths) calendar months',
      interpolationFormula: 'log P(t) = (1 − w) log A + w log B, w = elapsedDays / intervalDays',
      interpolationMeaning: 'Only a visual connection between specified assumptions. Interior dates do not have daily-return predictive meaning.',
      reversalRule: `The initial trend must first move at least ${reversalPct}%. Then an interior high requires a later decline of at least ${reversalPct}%, and an interior low requires a later rebound of at least ${reversalPct}%, within that borrowed historical path. The initial and terminal unconfirmed extrema are omitted.`,
      highZoneFraction, highZoneRule: 'First daily observation at or above the chosen fraction of the subsequently observed peak; definition is retrospective and changes if the peak changes.',
      noDoubleCompression: 'The bottom-holds model already uses the earlier current low; it receives no additional month subtraction. Extra 3/4/5 months applies only to the separate 48-month calendar scenarios.',
      dateWindows: 'Min/max of named historical intervals or explicit arithmetic sensitivities, never confidence intervals.',
      priceBands: 'Min/max of named assumption combinations, never a probability distribution.',
      missingDays: 'A reference path with any missing UTC day is excluded; missing prices are not synthesized.',
      noFutureHalvingDateAssumed: true,
    },
    warnings: [
      'Conditional historical scenarios do not mathematically prove a future peak, trough, price, or 4-year law. Any finite observed history admits future continuations with a higher high or lower low.',
      'The current peak and low are provisional; a lower low invalidates the bottom-aligned paths and revises all dependent dates.',
      'Only three historical cycle references exist. Daily rows, parameter variants, and closely spaced horizons do not increase the number of independent cycles.',
      'An observed high-zone entry is not an absolute peak. Consistent first-entry definitions can produce different results in the 2021 double-top cycle; an apparent 3–5-month advance is not a fitted acceleration constant.',
      'The historical-analogue envelope is a descriptive range of three selected histories. Actual outcomes can lie outside it.',
      'Internal peak/trough markers belong to the historical analogue, with its own subsequent 20% reversal. Unconfirmed right-edge extremes are not labeled turning points.',
      'The macro path and its price band are schematic sensitivities. The representative alpha and retention ratio are convenient display assumptions, not expected returns or estimates of likelihood.',
      'The 48-month baseline inherits the observed current event dates. Subtracting the prior early arrival again would count the same shift twice.',
      'The default historical replay stops before 2025, checks at most 365 days, and does not validate the 730-day path or 2029/2030 macro scenarios.',
    ],
  };
}
