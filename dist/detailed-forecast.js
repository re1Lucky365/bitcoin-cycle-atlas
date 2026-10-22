import { HALVINGS, utcDay, dateFromDay, validateDataset } from './cycle-engine.js?v=1.10.3';
import { shiftCalendarMonths } from './cycle-timing.js?v=1.10.3';
import { computeRollingStates } from './market-structure.js?v=1.10.3';

/**
 * Conditional historical-block scenarios, not a probability-calibrated forecast.
 * All source windows and regime labels are rebuilt from the requested prefix.
 * A calendar prior supplies a reference curve; actual historical return blocks
 * supply its irregularity. No sine waves, future labels, price caps or floors.
 */
export const DETAILED_FORECAST_DEFAULTS = Object.freeze({
  referenceDate: '2026-10-22', referenceTimezone: 'Asia/Seoul', horizonYears: 3,
  scenario: 'base', seed: 20261022, sampleCount: 128, blockDays: 28,
  volatilityWindowDays: 90, highZoneFraction: 0.95, priceGrowthRetention: 0.75,
  volatilityMultiplier: 1,
  bearDrawdownPct: 50, stressBelowCandidatePct: 15, localTurnThreshold: 0.12,
  includeSamplePaths: false,
});

export const DETAILED_SCENARIOS = Object.freeze([
  Object.freeze({ id: 'base', label: '기본 · 고점권 3개월 선행 / 형성 3개월', arrivalLeadMonths: 3, dwellMonths: 3, kind: 'recovery' }),
  Object.freeze({ id: 'accelerated', label: '조기 전환 · 9개월 선행 / 형성 5개월', arrivalLeadMonths: 9, dwellMonths: 5, kind: 'recovery' }),
  Object.freeze({ id: 'wait', label: '빠른 도달 · 9개월 선행 / 형성 9개월', arrivalLeadMonths: 9, dwellMonths: 9, kind: 'recovery' }),
  Object.freeze({ id: 'late', label: '지연 전환 · 3개월 선행 / 형성 6개월', arrivalLeadMonths: 3, dwellMonths: 6, kind: 'recovery' }),
  Object.freeze({ id: 'stress', label: '저점 재시험 · 추가 하락 후 회복', arrivalLeadMonths: 3, dwellMonths: 3, kind: 'stress' }),
]);

const PHASE_STATES = Object.freeze({
  accumulation: ['bottom-formation', 'range', 'rebound', 'transition'],
  advance: ['advance', 'rebound', 'pullback', 'range', 'transition'],
  expansion: ['price-discovery', 'advance', 'pullback', 'transition'],
  distribution: ['range', 'pullback', 'correction', 'price-discovery', 'transition'],
  decline: ['correction', 'rebound', 'pullback', 'bottom-formation'],
  'stress-decline': ['correction', 'rebound', 'pullback'],
});
const PHASE_LABELS = Object.freeze({ accumulation: '축적·회복 기준', advance: '상승 중간 기준', expansion: '상승 후반 기준', distribution: '고점 형성 기준', decline: '하락 기준', 'stress-decline': '추가 하락 기준', 'observed-anchor': '현재 관측' });
const VALIDATION_CUTOFFS = ['2014-12-18', '2015-03-31', '2015-06-30', '2018-12-30', '2019-03-31', '2019-06-30', '2022-12-31', '2023-03-31', '2023-06-30'];
const addDays = (date, n) => dateFromDay(utcDay(date) + n);
const sum = values => values.reduce((a, b) => a + b, 0);
const mean = values => values.length ? sum(values) / values.length : null;
const plain = row => ({ date: row.date, price: row.price });
const quantileSorted = (a, q) => {
  if (!a.length) return null;
  const index = (a.length - 1) * q, lo = Math.floor(index), fraction = index - lo;
  return a[lo] + fraction * (a[Math.min(lo + 1, a.length - 1)] - a[lo]);
};
const quantile = (a, q) => quantileSorted([...a].sort((x, y) => x - y), q);
function range(value, lo, hi, name, integer = false) {
  if (!Number.isFinite(value) || value < lo || value > hi || (integer && !Number.isSafeInteger(value))) throw new RangeError(`${name} must be ${integer ? 'an integer ' : ''}in [${lo}, ${hi}]`);
  return value;
}
function seedGenerator(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
function prefix(input, asOf) {
  const raw = Array.isArray(input) ? input : input?.prices;
  if (!Array.isArray(raw) || !raw.length) throw new TypeError('A nonempty daily price series is required');
  const end = asOf ?? (Array.isArray(raw.at(-1)) ? raw.at(-1)[0] : raw.at(-1).date);
  utcDay(end);
  const rows = validateDataset(raw.filter(row => (Array.isArray(row) ? row[0] : row.date) <= end));
  if (rows.length < 366) throw new RangeError('At least 366 completed daily observations are required');
  for (let i = 1; i < rows.length; i++) if (rows[i].epochDay - rows[i - 1].epochDay !== 1) throw new RangeError('Historical return blocks require consecutive daily observations; gaps are not interpolated');
  return rows;
}
function statistics(values) {
  const avg = mean(values);
  const variance = values.length > 1 ? sum(values.map(x => (x - avg) ** 2)) / (values.length - 1) : 0;
  return { mean: avg, sd: Math.sqrt(variance), n: values.length };
}
function pickExtreme(rows, maximum = true) {
  let answer = rows[0];
  for (const row of rows) if (maximum ? row.price > answer.price : row.price < answer.price) answer = row;
  return answer;
}
function eraForDate(date) {
  const halving = HALVINGS.findLast(item => item.date <= date);
  return halving ? `halving-${halving.year}` : 'before-2012-halving';
}

function context(input, options) {
  const settings = { ...DETAILED_FORECAST_DEFAULTS, ...options };
  const preset = DETAILED_SCENARIOS.find(item => item.id === settings.scenario);
  if (!preset) throw new RangeError('scenario must be base, accelerated, wait, late or stress');
  range(settings.sampleCount, 16, 512, 'sampleCount', true);
  range(settings.blockDays, 7, 84, 'blockDays', true);
  range(settings.seed, 0, 4294967295, 'seed', true);
  range(settings.volatilityWindowDays, 28, 365, 'volatilityWindowDays', true);
  range(settings.volatilityMultiplier, 0.5, 2, 'volatilityMultiplier');
  range(settings.highZoneFraction, 0.8, 0.99, 'highZoneFraction');
  range(settings.priceGrowthRetention, 0, 1.5, 'priceGrowthRetention');
  range(settings.bearDrawdownPct, 10, 85, 'bearDrawdownPct');
  range(settings.stressBelowCandidatePct, 1, 50, 'stressBelowCandidatePct');
  range(settings.localTurnThreshold, 0.05, 0.5, 'localTurnThreshold');
  range(settings.horizonYears, 1, 3, 'horizonYears', true);
  const rows = prefix(input, settings.asOf), current = rows.at(-1);
  const peak = options.referencePeakDate ? rows.find(row => row.date === options.referencePeakDate) : pickExtreme(rows);
  if (!peak) throw new RangeError('referencePeakDate must be an observed date within asOf');
  const confirmation = rows.find(row => row.date > peak.date && row.price <= peak.price * 0.8);
  if (!confirmation) throw new RangeError('The calendar reference high needs a 20% decline observed by asOf; a final market-cycle peak is still not established');
  const afterPeak = rows.filter(row => row.date > peak.date);
  const candidate = pickExtreme(afterPeak, false);
  const currentHalving = HALVINGS.findLast(item => item.date <= peak.date);
  if (!currentHalving) throw new RangeError('A prior completed halving era is needed for the calendar price reference');
  const priorRows = rows.filter(row => row.date < currentHalving.date);
  const priorHalving = HALVINGS.findLast(item => item.date < currentHalving.date);
  const previousPeak = pickExtreme(priorRows.filter(row => !priorHalving || row.date >= priorHalving.date));
  const referenceDate = options.referenceDate ?? (options.asOf ? addDays(current.date, 1) : settings.referenceDate);
  utcDay(referenceDate);
  if (referenceDate <= current.date) throw new RangeError('referenceDate must follow the latest completed UTC price');
  const displayEnd = options.displayEnd ?? shiftCalendarMonths(referenceDate, settings.horizonYears * 12);
  const displayDays = utcDay(displayEnd) - current.epochDay;
  range(displayDays, 1, 1120, 'display horizon days', true);
  const a = options.arrivalLeadMonths ?? preset.arrivalLeadMonths;
  const d = options.dwellMonths ?? preset.dwellMonths;
  range(a, -6, 12, 'arrivalLeadMonths', true); range(d, 0, 12, 'dwellMonths', true);
  if (Math.abs(d - a) > 6) throw new RangeError('|dwellMonths - arrivalLeadMonths| must be <= 6; no silent clamping');
  const nominalLowDate = shiftCalendarMonths(peak.date, 12);
  const nominalPeakDate = shiftCalendarMonths(peak.date, 48);
  const requestedTiming = options.timingCalibration ?? null;
  if (requestedTiming && (!Number.isSafeInteger(requestedTiming.appliedShiftDays) || Math.abs(requestedTiming.appliedShiftDays) > 180)) {
    throw new RangeError('timingCalibration.appliedShiftDays must be an integer in [-180, 180]');
  }
  if (requestedTiming && requestedTiming.asOf !== current.date) throw new RangeError('timingCalibration.asOf must match the observed forecast cutoff');
  const calibrationCompatible = Boolean(requestedTiming?.available && requestedTiming.referencePeakDate === peak.date);
  const requestedShiftDays = calibrationCompatible ? requestedTiming.appliedShiftDays : 0;
  const nominalZoneDate = shiftCalendarMonths(nominalPeakDate, -a);
  const nominalEffectivePeakDate = shiftCalendarMonths(nominalPeakDate, d - a);
  const nominalNextLowDate = shiftCalendarMonths(nominalEffectivePeakDate, 12);
  // Do not manufacture another cycle or silently clamp an expired reference.
  // A feasible adjustment shifts the whole remaining phase clock by the same
  // calendar-day amount. If it would expire a required anchor, keep the prior
  // and expose the reason rather than displaying a different undisclosed shift.
  const shiftedZoneDate = addDays(nominalZoneDate, requestedShiftDays);
  const shiftedNextLowDate = addDays(nominalNextLowDate, requestedShiftDays);
  const calibrationFeasible = shiftedZoneDate > current.date && shiftedNextLowDate >= displayEnd;
  const timingShiftDays = calibrationFeasible ? requestedShiftDays : 0;
  const zoneDate = addDays(nominalZoneDate, timingShiftDays);
  const peakDate = addDays(nominalEffectivePeakDate, timingShiftDays);
  const nextLowDate = addDays(nominalNextLowDate, timingShiftDays);
  if (zoneDate <= current.date || peakDate < zoneDate) throw new RangeError('The assumed next high-zone reference must be strictly in the future');
  if (displayEnd > nextLowDate) throw new RangeError('The requested horizon exceeds the next assumed low; no extra cycle is invented');
  const totalDays = utcDay(nextLowDate) - current.epochDay;
  range(totalDays, displayDays, 2200, 'bridge terminal horizon', true);
  const defaultPeakPrice = peak.price * (peak.price / previousPeak.price) ** settings.priceGrowthRetention;
  const peakMultiple = options.peakMultiple === undefined ? defaultPeakPrice / current.price : range(options.peakMultiple, 1.05, 30, 'peakMultiple');
  const peakPrice = current.price * peakMultiple;
  if (!(peakPrice * settings.highZoneFraction > current.price && Number.isFinite(peakPrice))) throw new RangeError('The future high-zone price reference must exceed the latest price');
  const anchors = [{ id: 'current', type: 'observation', date: current.date, price: current.price, label: '현재 관측' }];
  let stressDate = null;
  if (preset.kind === 'stress') {
    stressDate = addDays(shiftCalendarMonths(nominalLowDate, 3), timingShiftDays);
    if (stressDate <= current.date || stressDate >= zoneDate) throw new RangeError('The stress reference date is expired or follows the high-zone reference');
    anchors.push({ id: 'stress-low', type: 'macro-reference', date: stressDate, price: candidate.price * (1 - settings.stressBelowCandidatePct / 100), label: '추가 하락 기준점' });
  }
  if (zoneDate < peakDate) anchors.push({ id: 'zone-reference', type: 'macro-reference', date: zoneDate, price: peakPrice * settings.highZoneFraction, label: '고점권 도달 기준' });
  anchors.push({ id: 'peak-reference', type: 'macro-reference', date: peakDate, price: peakPrice, label: '거시 고점 기준' });
  anchors.push({ id: 'next-low-reference', type: 'macro-reference', date: nextLowDate, price: peakPrice * (1 - settings.bearDrawdownPct / 100), label: '다음 거시 저점 기준' });
  for (const anchor of anchors) anchor.day = utcDay(anchor.date);
  const nominalClock = {
    referencePeakDate: peak.date, referencePeakConfirmationDate: confirmation.date,
    referenceConfirmationRule: '20% fall from the observed reference high; not proof of a completed four-year cycle',
    nominalTroughDate: nominalLowDate, nominalPeakDate, zoneEntryDate: zoneDate,
    effectiveTroughDate: addDays(nominalLowDate, timingShiftDays),
    effectivePeakDate: peakDate, nextLowDate, nominalNextTroughDate: shiftCalendarMonths(nominalPeakDate, 12),
    arrivalLeadMonths: a, dwellMonths: d, netShiftMonths: d - a,
    nominalRiseMonths: 36, nominalDeclineMonths: 12, definitionIsConditionalPrior: true,
    timingAdjustment: {
      requested: Boolean(requestedTiming), available: Boolean(requestedTiming?.available),
      asOf: requestedTiming?.asOf ?? null, requestedShiftDays,
      appliedShiftDays: timingShiftDays, applied: Boolean(calibrationCompatible && calibrationFeasible),
      sourceReferencePeakDate: requestedTiming?.referencePeakDate ?? null,
      reason: !requestedTiming ? 'legacy-calendar-prior'
        : !requestedTiming.available ? 'insufficient-causal-timing-evidence'
          : !calibrationCompatible ? 'calibration-reference-high-differs'
            : !calibrationFeasible ? 'adjustment-would-expire-required-anchor' : 'causal-daily-clock-applied',
      nominalZoneDate, nominalEffectivePeakDate, nominalNextLowDate,
      finalCycleTurnClaim: false, probability: null,
    },
    intermediateAnchorsAreHardConstraints: false, finalBridgeEndpointIsHardConstraint: true,
    futureHalvingDateAssumed: false, probability: null,
  };
  const returns = new Float64Array(rows.length);
  for (let i = 1; i < rows.length; i++) returns[i] = Math.log(rows[i].price / rows[i - 1].price);
  const target = statistics(Array.from(returns.slice(-settings.volatilityWindowDays)));
  if (!(target.sd > 1e-9)) throw new RangeError('Positive recent realized volatility is required');
  return { rows, current, peak, previousPeak, candidate, confirmation, settings, preset, referenceDate, displayEnd, displayDays, totalDays, peakMultiple, peakPrice, anchors, nominalClock, returns, target, stressDate };
}

function phaseAt(ctx, day) {
  if (day === ctx.current.epochDay) return 'observed-anchor';
  if (ctx.stressDate && day <= utcDay(ctx.stressDate)) return 'stress-decline';
  if (day >= utcDay(ctx.nominalClock.effectivePeakDate)) return 'decline';
  if (day >= utcDay(ctx.nominalClock.zoneEntryDate)) return 'distribution';
  const start = ctx.stressDate ? utcDay(ctx.stressDate) : utcDay(ctx.nominalClock.effectiveTroughDate);
  const progress = (day - start) / (utcDay(ctx.nominalClock.zoneEntryDate) - start);
  return progress < 1 / 3 ? 'accumulation' : progress < 2 / 3 ? 'advance' : 'expansion';
}

function makePool(ctx) {
  const stateResult = computeRollingStates(ctx.rows, { frequency: 'daily', threshold: ctx.settings.localTurnThreshold });
  const points = stateResult.points;
  const stateByDate = new Map(points.map(point => [point.date, point.state]));
  const states = ctx.rows.map(row => stateByDate.get(row.date) ?? 'warmup');
  const eras = [];
  for (let start = 0; start < ctx.rows.length;) {
    const id = eraForDate(ctx.rows[start].date);
    let end = start;
    while (end + 1 < ctx.rows.length && eraForDate(ctx.rows[end + 1].date) === id) end++;
    const stats = statistics(Array.from(ctx.returns.slice(Math.max(start + 1, 1), end + 1)));
    if (stats.n >= 14 && stats.sd > 1e-9) eras.push({ id, start, end, ...stats, byState: new Map(), eligibleStarts: [] });
    start = end + 1;
  }
  let eligibleStartCount = 0;
  for (const era of eras) for (let s = Math.max(era.start, 91); s + 7 <= era.end; s++) {
    const state = states[s];
    if (state === 'warmup') continue;
    era.eligibleStarts.push(s);
    if (!era.byState.has(state)) era.byState.set(state, []);
    era.byState.get(state).push(s);
    eligibleStartCount++;
  }
  const useful = eras.filter(era => era.eligibleStarts.length);
  if (!useful.length) throw new RangeError('No fully historical state-labelled blocks are available');
  const innovations = new Float64Array(ctx.rows.length);
  for (const era of useful) {
    const returnsByPriorState = new Map();
    for (let i = era.start + 1; i <= era.end; i++) {
      const state = states[i - 1];
      if (!returnsByPriorState.has(state)) returnsByPriorState.set(state, []);
      returnsByPriorState.get(state).push(ctx.returns[i]);
    }
    era.stateMeans = Object.fromEntries([...returnsByPriorState].map(([state, values]) => [state, mean(values)]));
    const residuals = [];
    for (let i = era.start + 1; i <= era.end; i++) {
      innovations[i] = ctx.returns[i] - era.stateMeans[states[i - 1]];
      residuals.push(innovations[i]);
    }
    era.residualSd = statistics(residuals).sd;
    if (!(era.residualSd > 1e-9)) throw new RangeError(`No residual variation in source era ${era.id}`);
  }
  const phasePools = Object.fromEntries(Object.entries(PHASE_STATES).map(([phase, allowed]) => [phase, useful.map(era => ({ era, starts: allowed.flatMap(state => era.byState.get(state) ?? []) })).filter(item => item.starts.length)]));
  const statesPools = new Map();
  for (const state of new Set(states)) statesPools.set(state, useful.map(era => ({ era, starts: era.byState.get(state) ?? [] })).filter(item => item.starts.length));
  const allPool = useful.map(era => ({ era, starts: era.eligibleStarts }));
  return { states, innovations, eras: useful, phasePools, statesPools, allPool, eligibleStartCount, currentState: states.at(-1) };
}

function makeBaseline(ctx) {
  const values = new Float64Array(ctx.totalDays + 1);
  let segment = 1;
  for (let t = 0; t <= ctx.totalDays; t++) {
    const day = ctx.current.epochDay + t;
    while (ctx.anchors[segment].day < day) segment++;
    const left = ctx.anchors[segment - 1], right = ctx.anchors[segment];
    const u = (day - left.day) / (right.day - left.day);
    values[t] = (1 - u) * Math.log(left.price) + u * Math.log(right.price);
  }
  return values;
}

function simulate(ctx, pool, baseline, pathIndex) {
  // A separate deterministic stream for each path means increasing sampleCount
  // does not rewrite the first N resampled trajectories.
  const random = seedGenerator((ctx.settings.seed + Math.imul(pathIndex + 1, 0x9E3779B1)) >>> 0);
  const residual = new Float64Array(ctx.totalDays + 1), sources = [];
  let t = 1, lastSourceState = pool.currentState, priorPhase = null;
  while (t <= ctx.totalDays) {
    const phase = phaseAt(ctx, ctx.current.epochDay + t);
    const allowed = PHASE_STATES[phase];
    const coherent = (priorPhase === phase || t === 1) && allowed.includes(lastSourceState) ? pool.statesPools.get(lastSourceState) : null;
    const choices = coherent?.length ? coherent : pool.phasePools[phase]?.length ? pool.phasePools[phase] : pool.allPool;
    const selected = choices[Math.floor(random() * choices.length)];
    const start = selected.starts[Math.floor(random() * selected.starts.length)];
    // Geometric block duration with explicit 7..84-day bounds. This is a
    // modelling tuning choice, not an inferred distribution of cycle duration.
    const geometric = Math.ceil(Math.log(1 - random()) / Math.log(1 - 1 / ctx.settings.blockDays));
    const length = Math.min(84, Math.max(7, geometric), selected.era.end - start, ctx.totalDays - t + 1);
    const scale = ctx.settings.volatilityMultiplier * ctx.target.sd / selected.era.residualSd;
    const firstTarget = t;
    for (let j = 1; j <= length; j++, t++) residual[t] = residual[t - 1] + scale * pool.innovations[start + j];
    lastSourceState = pool.states[start + length];
    sources.push({
      targetStartDate: dateFromDay(ctx.current.epochDay + firstTarget), targetEndDate: dateFromDay(ctx.current.epochDay + t - 1),
      sourceStartDate: ctx.rows[start].date, sourceReturnStartDate: ctx.rows[start + 1].date,
      sourceEndDate: ctx.rows[start + length].date, sourceState: pool.states[start], sourceEndState: lastSourceState,
      sourceEra: selected.era.id, days: length, volatilityScale: scale, phase,
      centeringRule: 'source-era × previous-day causal-state next-return mean',
    });
    priorPhase = phase;
  }
  const logPath = new Float64Array(ctx.displayDays + 1), terminalResidual = residual[ctx.totalDays];
  logPath[0] = Math.log(ctx.current.price);
  for (let i = 1; i <= ctx.displayDays; i++) {
    const value = baseline[i] + residual[i] - (i / ctx.totalDays) * terminalResidual;
    if (!(Number.isFinite(value) && value > -700 && value < 700)) throw new RangeError('A simulated price overflowed; no clipping or silent removal was applied');
    logPath[i] = value;
  }
  return { logPath, sources, terminalResidual };
}

/** A direction change is only emitted after the threshold reversal occurs. */
function confirmedTurns(prices, threshold) {
  const result = [];
  let direction = 0, high = 0, low = 0;
  for (let i = 1; i < prices.length; i++) {
    if (direction >= 0) {
      if (prices[i] >= prices[high]) high = i;
      if (prices[i] <= prices[high] * (1 - threshold)) {
        if (high > 0) result.push({ type: 'high', index: high, confirmationIndex: i, price: prices[high], confirmationPrice: prices[i] });
        direction = -1; low = i; continue;
      }
    }
    if (direction <= 0) {
      if (prices[i] <= prices[low]) low = i;
      if (prices[i] >= prices[low] * (1 + threshold)) {
        if (low > 0) result.push({ type: 'low', index: low, confirmationIndex: i, price: prices[low], confirmationPrice: prices[i] });
        direction = 1; high = i;
      }
    }
  }
  return result;
}
function maximumDrawdown(prices) {
  let high = prices[0], mdd = 0;
  for (const value of prices) { high = Math.max(high, value); mdd = Math.max(mdd, 1 - value / high); }
  return 100 * mdd;
}
function dateSummary(indices, ctx, label) {
  const sorted = [...indices].sort((a, b) => a - b);
  return {
    label, sampleCount: sorted.length, sampleCountWithConfirmedTurn: sorted.length, totalPaths: ctx.settings.sampleCount,
    lowerDate: sorted.length ? dateFromDay(ctx.current.epochDay + Math.round(quantileSorted(sorted, 0.1))) : null,
    medianDate: sorted.length ? dateFromDay(ctx.current.epochDay + Math.round(quantileSorted(sorted, 0.5))) : null,
    upperDate: sorted.length ? dateFromDay(ctx.current.epochDay + Math.round(quantileSorted(sorted, 0.9))) : null,
    quantiles: [0.1, 0.5, 0.9], probability: null, calibrated: false,
    definition: 'Empirical date quantiles for the event named in label, conditional on the stated simulation. Paths without a confirmed event are counted separately. These are not calibrated market turning-date probabilities or independent observations.',
  };
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
    const last = points.at(-1), complete = points.length === 7 && points[0].date === dateFromDay(monday) && last.date === dateFromDay(monday + 6);
    const row = { ...last, weekStartDate: dateFromDay(monday), weekEndDate: dateFromDay(monday + 6), firstIncludedDate: points[0].date, lastIncludedDate: last.date, daysIncluded: points.length, completeCalendarWeek: complete, partial: !complete, weekMinPrice: Math.min(...points.map(point => point.price)), weekMaxPrice: Math.max(...points.map(point => point.price)), weeklyReturnPct: 100 * (last.price / previous - 1), observationClaim: false };
    previous = last.price;
    return row;
  });
}

export function buildDetailedForecast(input, options = {}) {
  const ctx = context(input, options), pool = makePool(ctx), baseline = makeBaseline(ctx);
  const simulations = Array.from({ length: ctx.settings.sampleCount }, (_, i) => simulate(ctx, pool, baseline, i));
  const lower = new Float64Array(ctx.displayDays + 1), median = new Float64Array(ctx.displayDays + 1), upper = new Float64Array(ctx.displayDays + 1);
  for (let t = 0; t <= ctx.displayDays; t++) {
    const values = simulations.map(sample => sample.logPath[t]).sort((a, b) => a - b);
    lower[t] = quantileSorted(values, 0.1); median[t] = quantileSorted(values, 0.5); upper[t] = quantileSorted(values, 0.9);
  }
  const drawMdds = simulations.map(sample => {
    let maximum = sample.logPath[0], worst = 0;
    for (const value of sample.logPath) { maximum = Math.max(maximum, value); worst = Math.max(worst, 1 - Math.exp(value - maximum)); }
    return worst * 100;
  });
  const mddLowerQuartile = quantile(drawMdds, 0.25), mddUpperQuartile = quantile(drawMdds, 0.75);
  let representativeIndex = 0, bestDistance = Infinity;
  for (let i = 0; i < simulations.length; i++) {
    if (drawMdds[i] < mddLowerQuartile || drawMdds[i] > mddUpperQuartile) continue;
    let distance = 0;
    for (let t = 0; t <= ctx.displayDays; t += 7) distance += Math.abs(simulations[i].logPath[t] - median[t]);
    if (distance < bestDistance) { bestDistance = distance; representativeIndex = i; }
  }
  const representative = simulations[representativeIndex];
  const path = [];
  let runningHigh = ctx.current.price;
  for (let i = 0; i <= ctx.displayDays; i++) {
    const price = i ? Math.exp(representative.logPath[i]) : ctx.current.price;
    const lo = i ? Math.exp(lower[i]) : price, med = i ? Math.exp(median[i]) : price, hi = i ? Math.exp(upper[i]) : price;
    const phase = phaseAt(ctx, ctx.current.epochDay + i);
    runningHigh = Math.max(runningHigh, price);
    path.push({ date: dateFromDay(ctx.current.epochDay + i), price, indexedPrice: 100 * price / ctx.current.price, lower: lo, median: med, upper: hi,
      indexedLower: 100 * lo / ctx.current.price, indexedMedian: 100 * med / ctx.current.price, indexedUpper: 100 * hi / ctx.current.price,
      baselinePrice: i ? Math.exp(baseline[i]) : price, baselineIndex: i ? 100 * Math.exp(baseline[i]) / ctx.current.price : 100,
      phase, phaseLabel: PHASE_LABELS[phase], drawdownPct: 100 * (1 - price / runningHigh),
      kind: i ? 'conditional-resampled-path' : 'observed-anchor', probability: null,
    });
  }
  const projectedStates = computeRollingStates([...ctx.rows, ...path.slice(1)], { frequency: 'daily', threshold: ctx.settings.localTurnThreshold });
  const projectedByDate = new Map(projectedStates.points.map(point => [point.date, point]));
  for (const point of path) {
    const state = projectedByDate.get(point.date);
    point.state = state?.state ?? 'transition';
    point.athDrawdownPct = state?.athDrawdownPct ?? null;
    point.realizedVolPct = state?.realizedVolPct ?? null;
  }
  const localTurns = confirmedTurns(path.map(point => point.price), ctx.settings.localTurnThreshold).map((turn, i) => ({
    id: `representative-${turn.type}-${i}`, type: turn.type, label: turn.type === 'high' ? '대표 경로 국지 고점' : '대표 경로 국지 저점',
    date: path[turn.index].date, price: turn.price, indexedPrice: 100 * turn.price / ctx.current.price,
    confirmationDate: path[turn.confirmationIndex].date, confirmationPrice: turn.confirmationPrice,
    lagDays: turn.confirmationIndex - turn.index, threshold: ctx.settings.localTurnThreshold,
    status: 'representative-path-only', futureObservation: false, probability: null,
  }));
  const events = ctx.anchors.filter(anchor => anchor.id !== 'current').map(anchor => ({
    id: anchor.id, type: 'macro-reference', label: anchor.label, date: anchor.date, price: anchor.price,
    indexedPrice: 100 * anchor.price / ctx.current.price, status: 'conditional-anchor', inHorizon: anchor.date <= ctx.displayEnd,
    outsideHorizonLabel: anchor.date > ctx.displayEnd ? '3년 표시 범위 밖' : null,
    isRepresentativeValue: false, turningPointClaim: false, futureObservation: false,
    representativePriceOnDate: path[anchor.day - ctx.current.epochDay]?.price ?? null,
    probability: null,
  }));
  const mdds = [], highDates = [], lowDates = [], peakValues = [], lowValues = [];
  const firstHighDates = [], firstLowDates = [], firstHighConfirmations = [], firstLowConfirmations = [];
  let breaks = 0, overshoots = 0, boundaryMaxima = 0, noHigh = 0, noLow = 0;
  const peakOffset = Math.min(ctx.displayDays, utcDay(ctx.nominalClock.effectivePeakDate) - ctx.current.epochDay);
  for (const simulation of simulations) {
    const prices = Array.from(simulation.logPath, value => Math.exp(value));
    prices[0] = ctx.current.price;
    mdds.push(maximumDrawdown(prices));
    let maxIndex = 0, minIndex = 0, broken = false;
    for (let i = 1; i < prices.length; i++) {
      if (prices[i] > prices[maxIndex]) maxIndex = i;
      if (prices[i] < prices[minIndex]) minIndex = i;
      if (i <= peakOffset && prices[i] < ctx.candidate.price) broken = true;
    }
    breaks += Number(broken); overshoots += Number(prices[maxIndex] > ctx.peakPrice);
    boundaryMaxima += Number(maxIndex === 0 || maxIndex === prices.length - 1);
    peakValues.push(prices[maxIndex]); lowValues.push(prices[minIndex]);
    const turns = confirmedTurns(prices, ctx.settings.localTurnThreshold);
    const highs = turns.filter(turn => turn.type === 'high'), lows = turns.filter(turn => turn.type === 'low');
    if (highs.length) { firstHighDates.push(highs[0].index); firstHighConfirmations.push(highs[0].confirmationIndex); }
    if (lows.length) { firstLowDates.push(lows[0].index); firstLowConfirmations.push(lows[0].confirmationIndex); }
    if (highs.length) highDates.push(highs.reduce((a, b) => a.price > b.price ? a : b).index); else noHigh++;
    if (lows.length) lowDates.push(lows.reduce((a, b) => a.price < b.price ? a : b).index); else noLow++;
  }
  const rangeSummary = values => ({ p10: quantile(values, 0.1), p50: quantile(values, 0.5), p90: quantile(values, 0.9), probability: null, calibrated: false });
  const maxPoint = path.reduce((a, b) => a.price > b.price ? a : b), minPoint = path.reduce((a, b) => a.price < b.price ? a : b);
  const originState = pool.currentState;
  const output = {
    version: 'historical-block-bridge-1', asOf: ctx.current.date, referenceDate: ctx.referenceDate,
    referenceTimezone: ctx.settings.referenceTimezone, displayEnd: ctx.displayEnd, horizonDays: ctx.displayDays,
    observables: { current: plain(ctx.current), peak: { ...plain(ctx.peak), provisional: true, confirmationDate: ctx.confirmation.date }, previousPeak: { ...plain(ctx.previousPeak), definition: 'maximum of the prior already completed observed halving era' }, troughCandidate: { ...plain(ctx.candidate), provisional: true }, currentState: originState,
      recoveryDays: ctx.current.epochDay - ctx.candidate.epochDay, recoveryPct: 100 * (ctx.current.price / ctx.candidate.price - 1), observedPeakToLowDays: ctx.candidate.epochDay - ctx.peak.epochDay,
      recentDailyLogReturnSd: ctx.target.sd, recentAnnualizedVolPct: 100 * ctx.target.sd * Math.sqrt(365), volatilityWindowDays: ctx.settings.volatilityWindowDays,
      priceDefinition: 'Coin Metrics PriceUSD, UTC day-end; no intraday OHLC claims',
    },
    nominalClock: ctx.nominalClock,
    scenario: { ...ctx.preset, arrivalLeadMonths: ctx.nominalClock.arrivalLeadMonths, dwellMonths: ctx.nominalClock.dwellMonths },
    assumptions: {
      macroClock: '48 calendar months from the known reference high; nominal 12-month decline plus 36-month rise is a conditional prior, optionally shifted by the separately disclosed observed-prefix timing adjustment, not an estimated law',
      peakMultiple: ctx.peakMultiple, peakReferencePrice: ctx.peakPrice, priceGrowthRetention: ctx.settings.priceGrowthRetention,
      priceReferenceFormula: options.peakMultiple === undefined ? 'referenceHigh × (referenceHigh / previousEraHigh)^g; g is an editable assumption' : 'currentPrice × user-specified peakMultiple',
      priceGrowthRetentionEstimatedFromData: false, bearDrawdownPct: ctx.settings.bearDrawdownPct, highZoneFraction: ctx.settings.highZoneFraction,
      priorPriceDenominatorWindow: { startDate: HALVINGS.findLast(item => item.date < HALVINGS.findLast(item => item.date <= ctx.peak.date).date)?.date ?? ctx.rows[0].date, endDate: addDays(HALVINGS.findLast(item => item.date <= ctx.peak.date).date, -1), observedMaximum: plain(ctx.previousPeak) },
      firstHighZoneArrivalGuaranteed: false, continuousHighZoneResidenceGuaranteed: false,
      residualFormula: 'log P*(t) = log B(t) + R(t) - (t/T) R(T)',
      baselineFormula: 'log B(t) is linear between scenario reference landmarks',
      returnFormula: 'epsilon = recentWindowSd / sourceEraResidualSd × (sourceDailyLogReturn - mean(nextReturn | sourceEra, previousDayKnownState))',
      bridgeTerminalDate: ctx.nominalClock.nextLowDate, bridgeTerminalPrice: ctx.anchors.at(-1).price,
      intermediateDatesAndPricesForced: false, terminalPriceForced: true, pathCapsOrFloorsApplied: false,
      volatilityPersistsAtRecentLevel: true, volatilityMultiplier: ctx.settings.volatilityMultiplier, volatilityMultiplierEstimated: false, stateEligibilityIsModelChoice: true, equalEraSamplingIsModelChoice: true,
      phasePriorClockOriginDate: ctx.stressDate ?? ctx.nominalClock.effectiveTroughDate,
      risePhaseFractions: [1 / 3, 2 / 3], risePhaseFractionsEstimatedFromData: false,
      phaseEligibilityIsNotFutureStatePrediction: true, microTimeWarpApplied: false, fibonacciDrivesExpectedReturns: false,
      blockLengthRule: 'geometric mean parameter blockDays; clipped to 7..84 days and available historical/terminal length',
      blockDays: ctx.settings.blockDays, seed: ctx.settings.seed, sampleCount: ctx.settings.sampleCount,
      representativeRule: 'Among actual draws with MDD in the ensemble interquartile range, choose the draw minimizing weekly absolute log distance from the pointwise median. This avoids selecting an unusually smooth low-drawdown path; it is not a most-likely path.',
      envelopeQuantiles: [0.1, 0.9], envelopeLabel: '조건부 경로 범위 · 확률 보정 전',
      probability: null, calibrated: false, futurePricesKnown: false,
    },
    training: {
      informationThrough: ctx.current.date, observations: ctx.rows.length, firstObservation: ctx.rows[0].date,
      sourceWindowLastDate: ctx.rows.at(-1).date, eligibleBlockStarts: pool.eligibleStartCount,
      sourceEras: pool.eras.map(era => ({ id: era.id, startDate: ctx.rows[era.start].date, endDate: ctx.rows[era.end].date, dailyReturns: era.n, eligibleStarts: era.eligibleStarts.length, dailyLogMean: era.mean, dailyLogSd: era.sd, residualSd: era.residualSd, nextReturnMeanByKnownState: era.stateMeans, targetVolatilityScale: ctx.settings.volatilityMultiplier * ctx.target.sd / era.residualSd, incomplete: era.end === ctx.rows.length - 1 })),
      completedHalvingEras: pool.eras.filter(era => era.end < ctx.rows.length - 1).length,
      independentSampleSizeClaim: null, overlappingBlocksAreIndependent: false,
      stateLabelsAreCausal: true, sourceBlockEndpointsAtOrBeforeAsOf: true,
      selectedRepresentativeIndex: representativeIndex, representativeBlocks: representative.sources,
      conditionalPhaseEligibleStates: PHASE_STATES,
    },
    path, weeklyPath: weeklyRows(path), events, localTurns,
    diagnostics: {
      representativeMddPct: maximumDrawdown(path.map(point => point.price)), simulatedMddPct: rangeSummary(mdds),
      representativeSelectionMddRange: { lowerQuartile: mddLowerQuartile, upperQuartile: mddUpperQuartile, probability: null },
      representativeMaximum: { ...plain(maxPoint), indexedPrice: maxPoint.indexedPrice, rangeExtremeOnly: true, confirmedTurningPoint: localTurns.some(turn => turn.type === 'high' && turn.date === maxPoint.date), atDisplayBoundary: maxPoint.date === ctx.current.date || maxPoint.date === ctx.displayEnd },
      representativeMinimum: { ...plain(minPoint), indexedPrice: minPoint.indexedPrice, rangeExtremeOnly: true, confirmedTurningPoint: localTurns.some(turn => turn.type === 'low' && turn.date === minPoint.date), atDisplayBoundary: minPoint.date === ctx.current.date || minPoint.date === ctx.displayEnd },
      simulatedDisplayMaximumPrice: rangeSummary(peakValues), simulatedDisplayMinimumPrice: rangeSummary(lowValues),
      simulatedPeakWindow: dateSummary(highDates, ctx, '각 조건부 경로의 가장 높은 확정 국지 고점'),
      simulatedLowWindow: dateSummary(lowDates, ctx, '각 조건부 경로의 가장 낮은 확정 국지 저점'),
      firstTurnWindows: {
        high: { ...dateSummary(firstHighDates, ctx, '각 조건부 경로의 첫 확정 국지 고점'),
          confirmationWindow: dateSummary(firstHighConfirmations, ctx, `첫 고점의 ${100 * ctx.settings.localTurnThreshold}% 반전 확인일`),
          definition: 'First future local high in each draw that is followed by the required decline inside the horizon. Dates refer to the extreme, which becomes identifiable only on its later confirmation date. Empirical conditional-scenario quantiles, not calibrated turning-date probabilities.' },
        low: { ...dateSummary(firstLowDates, ctx, '각 조건부 경로의 첫 확정 국지 저점'),
          confirmationWindow: dateSummary(firstLowConfirmations, ctx, `첫 저점의 ${100 * ctx.settings.localTurnThreshold}% 반전 확인일`),
          definition: 'First future local low in each draw that is followed by the required rebound inside the horizon. Dates refer to the extreme, which becomes identifiable only on its later confirmation date. Empirical conditional-scenario quantiles, not calibrated turning-date probabilities.' },
      },
      pathsWithoutConfirmedHigh: noHigh, pathsWithoutConfirmedLow: noLow, boundaryDisplayMaximumPaths: boundaryMaxima,
      candidateLowBreakPathsBeforePeakReference: breaks, peakReferenceOvershootPaths: overshoots, totalPaths: simulations.length,
      candidateLowBreakPathFraction: breaks / simulations.length, peakReferenceOvershootPathFraction: overshoots / simulations.length,
      frequenciesAreConditionalSimulationCounts: true, frequenciesAreMarketProbabilities: false,
      terminalBridgeOutsideHorizon: ctx.nominalClock.nextLowDate > ctx.displayEnd,
    },
    warnings: [
      '수많은 경로는 같은 소수의 역사 회차를 다시 뽑은 결과다. 독립 시장 표본 수가 늘어난 것이 아니다.',
      '10–90% 분위 범위는 지정한 가정 아래 생성한 경로들의 범위이며, 실제 미래의 80% 확률구간이 아니다.',
      '거시 기준점의 날짜·가격은 조건이다. 대표 경로의 국지 고저점이나 실제 시장의 최종 고저점을 보장하지 않는다.',
      '현재 저점 후보를 지키도록 경로를 자르지 않는다. 후보 이탈과 거시 고점 기준 초과를 모두 남긴다.',
      '현재의 변동성이 유지되고 과거의 상태별 짧은 움직임이 재사용 가능하다고 가정한다. 체제 변화·초기 시장 비유사성·긴 의존성은 남는 위험이다.',
      '표시창 밖 다음 저점에서 잔차를 0으로 만드는 bridge는 인위적 종점 조건이다. 종점의 정밀 예측이 아니다.',
      `${100 * ctx.settings.localTurnThreshold}% 국지 전환점은 그 경로의 이후 반전이 발생해야 확인된다. 표시창 끝의 미확정 극값을 전환점으로 표시하지 않는다.`,
    ],
    sources: [
      'https://docs.coinmetrics.io/network-data/network-data-overview/market/price',
      'https://otexts.com/fpp3/bootstrap.html',
      'https://otexts.com/fpp3/tscv.html',
      'https://projecteuclid.org/journals/annals-of-statistics/volume-17/issue-3/The-Jackknife-and-the-Bootstrap-for-General-Stationary-Observations/10.1214/aos/1176347265.full',
    ],
  };
  if (ctx.settings.includeSamplePaths) output.samplePaths = simulations.map((sample, index) => ({ index, prices: Array.from(sample.logPath, (value, i) => i ? Math.exp(value) : ctx.current.price) }));
  return output;
}

/**
 * Fixed calendar cutoffs, re-estimated source pools at every origin. Parameters
 * were designed retrospectively: this is rolling-origin reconstruction, not a
 * registered prospective test. 2025/2026 outcomes are deliberately excluded.
 */
export function evaluateDetailedForecast(input, options = {}) {
  const rows = validateDataset(input), byDate = new Map(rows.map(row => [row.date, row]));
  const outcomeThrough = options.outcomeThrough ?? '2024-12-31';
  utcDay(outcomeThrough);
  const cutoffs = options.cutoffs ?? VALIDATION_CUTOFFS;
  const sampleCount = options.sampleCount ?? 64;
  const seed = options.seed ?? 20261022;
  const horizons = options.horizons ?? [{ id: '30d', days: 30 }, { id: '90d', days: 90 }, { id: '180d', days: 180 }, { id: '1y', months: 12 }, { id: '2y', months: 24 }, { id: '3y', months: 36 }];
  const cases = [], excluded = [];
  for (const cutoff of cutoffs) {
    if (!byDate.has(cutoff)) { excluded.push({ cutoff, reason: 'No exact completed observation at cutoff' }); continue; }
    try {
      const model = buildDetailedForecast(input, { asOf: cutoff, referenceDate: addDays(cutoff, 1), displayEnd: shiftCalendarMonths(cutoff, 36), scenario: 'base', sampleCount, seed, blockDays: options.blockDays ?? 28, includeSamplePaths: true });
      const points = new Map(model.path.map(point => [point.date, point]));
      const results = [];
      for (const horizon of horizons) {
        const date = horizon.months ? shiftCalendarMonths(cutoff, horizon.months) : addDays(cutoff, horizon.days);
        if (date > outcomeThrough || !byDate.has(date) || !points.has(date)) continue;
        const actual = byDate.get(date).price, point = points.get(date), flat = model.observables.current.price;
        const score = predicted => ({ price: predicted, absolutePercentageErrorPct: 100 * Math.abs(predicted / actual - 1), absoluteLogError: Math.abs(Math.log(predicted / actual)) });
        results.push({ horizon: horizon.id, outcomeDate: date, actualPrice: actual, representative: score(point.price), median: score(point.median), simpleCalendarBaseline: score(point.baselinePrice), flat: score(flat), lower: point.lower, upper: point.upper, insideConditionalEnvelope: actual >= point.lower && actual <= point.upper });
      }
      const evaluationEndDate = [model.displayEnd, outcomeThrough, rows.at(-1).date].sort()[0];
      const dailyEligible = model.path.filter(point => point.date > cutoff && point.date <= evaluationEndDate);
      const missingOutcome = dailyEligible.find(point => !byDate.has(point.date));
      if (missingOutcome) throw new RangeError(`Evaluation requires consecutive daily observations; missing ${missingOutcome.date}`);
      const dailyCovered = dailyEligible.filter(point => byDate.get(point.date).price >= point.lower && byDate.get(point.date).price <= point.upper).length;
      const firstActualBreak = dailyEligible.find(point => point.date <= model.nominalClock.effectivePeakDate && byDate.get(point.date).price < model.observables.troughCandidate.price);
      const actualDaily = [flatPrice(model), ...dailyEligible.map(point => byDate.get(point.date).price)];
      const comparableMdds = model.samplePaths.map(sample => maximumDrawdown(sample.prices.slice(0, actualDaily.length)));
      cases.push({ cutoff, informationThrough: cutoff, sourceWindowLastDate: model.training.sourceWindowLastDate, referencePeakDate: model.observables.peak.date, macroCohort: model.observables.peak.date.slice(0, 4), sourceEras: model.training.sourceEras.length, results,
        dailyEnvelopeCovered: dailyCovered, dailyEnvelopeEvaluated: dailyEligible.length, dailyEnvelopeCoverageFraction: dailyEligible.length ? dailyCovered / dailyEligible.length : null,
        firstActualCandidateBreakDate: firstActualBreak?.date ?? null, actualWindowMddPct: maximumDrawdown(actualDaily),
        mddComparisonEndDate: dailyEligible.at(-1)?.date ?? cutoff,
        simulatedWindowMdd: { p10: quantile(comparableMdds, 0.1), p50: quantile(comparableMdds, 0.5), p90: quantile(comparableMdds, 0.9), probability: null, calibrated: false },
      });
    } catch (error) { excluded.push({ cutoff, reason: error.message }); }
  }
  const summary = horizons.map(horizon => {
    const samples = cases.flatMap(item => item.results.filter(result => result.horizon === horizon.id).map(result => ({ ...result, cutoff: item.cutoff, cohort: item.macroCohort })));
    if (!samples.length) return null;
    const aggregate = name => ({ mapePct: mean(samples.map(sample => sample[name].absolutePercentageErrorPct)), meanAbsoluteLogError: mean(samples.map(sample => sample[name].absoluteLogError)) });
    return { horizon: horizon.id, samples: samples.length, cutoffs: samples.map(sample => sample.cutoff), distinctMacroCohorts: new Set(samples.map(sample => sample.cohort)).size,
      representative: aggregate('representative'), median: aggregate('median'), simpleCalendarBaseline: aggregate('simpleCalendarBaseline'), flat: aggregate('flat'),
      envelopeCovered: samples.filter(sample => sample.insideConditionalEnvelope).length, envelopeCoverageFraction: samples.filter(sample => sample.insideConditionalEnvelope).length / samples.length,
      nominalEnsembleFraction: 0.8, calibratedProbabilityClaim: false,
    };
  }).filter(Boolean);
  return { method: 'fixed-cutoff rolling-origin reconstruction', outcomeThrough, sampleCount, seed,
    cutoffSelection: 'Three fixed calendar origins in each of the 2013, 2017 and 2021 reference-high cohorts; selected during this retrospective analysis, not a historical preregistration or an optimum selected from test scores',
    parameterSelectionWasRetrospective: true, genuineProspectiveValidation: false, current2025And2026OutcomesIncluded: outcomeThrough >= '2025-01-01',
    sameCohortsForAllBaselinesWithinEachHorizon: true, simpleBaselineDefinition: 'The identical scenario calendar and price reference curve with residuals set to zero; isolates the contribution of historical blocks, not a differently tuned competitor',
    numberOfDistinctCutoffs: cases.length, effectiveMacroCohorts: new Set(cases.map(item => item.macroCohort)).size,
    independentTrialCountClaim: null, overlappingOutcomes: true, cases, excluded, summary,
    candidateHoldFailures: cases.filter(item => item.firstActualCandidateBreakDate).length,
    warning: 'Coverage is observed on these overlapping, retrospectively chosen historical cohorts. It is a diagnostic, not a future coverage guarantee; reported failures are retained.',
  };
}
function flatPrice(model) { return model.observables.current.price; }
