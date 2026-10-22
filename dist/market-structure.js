/**
 * Daily-close market structure: causal state labels and confirmed pivots, with
 * separately marked retrospective macro windows. No intraday OHLC is inferred.
 */
import { utcDay, dateFromDay, validateDataset } from './cycle-engine.js?v=1.10.4';
import { shiftCalendarMonths } from './cycle-timing.js?v=1.10.4';

export const MARKET_STRUCTURE_VERSION = 'market-structure-v1';
export const STATE_LABELS = Object.freeze({
  warmup: '관측 준비',
  'price-discovery': '신고가 발견',
  'bottom-formation': '저점 형성 조건',
  range: '좁은 횡보',
  rebound: '반등',
  pullback: '되돌림',
  advance: '상승 진행',
  correction: '하락 진행',
  transition: '전환·혼합',
});
export const STATES = Object.freeze(Object.keys(STATE_LABELS));
export const FIBONACCI_RATIOS = Object.freeze([0.236, 0.382, 0.5, 0.618, 0.786]);
export const CONTROL_RATIOS = Object.freeze([0.20, 0.35, 0.45, 0.65, 0.80]);
const PEAK_YEARS = [2011, 2013, 2017, 2021, 2025];
const NUMERIC_TOLERANCE = 1e-12;
const atLeast = (value, target) => value >= target - NUMERIC_TOLERANCE;
const atMost = (value, target) => value <= target + NUMERIC_TOLERANCE;
const mean = (values) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
export function median(values) {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b), middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}
function sampleSD(values) {
  if (values.length < 2) return null;
  const center = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - center) ** 2, 0) / (values.length - 1));
}
function positiveInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 1) throw new TypeError(`${name} must be a positive integer`);
}
function fraction(value, name) {
  if (!Number.isFinite(value) || value <= 0 || value >= 1) throw new TypeError(`${name} must lie strictly between 0 and 1`);
}
function observations(input, asOf) {
  const rows = validateDataset(input);
  if (asOf !== undefined) utcDay(asOf);
  const selected = asOf === undefined ? rows : rows.filter((row) => row.date <= asOf);
  if (!selected.length) throw new RangeError('No observations on or before asOf');
  return selected;
}
function point(row) { return { date: row.date, price: row.price }; }
function extreme(rows, maximum = true) {
  return rows.reduce((best, row) => !best || (maximum ? row.price > best.price : row.price < best.price) ? row : best, null);
}
function earliestKnowable(date) { return `${dateFromDay(utcDay(date) + 1)}T00:00:00.000Z`; }
function periodBounds(date, frequency) {
  const [year, month] = date.split('-').map(Number);
  if (frequency === 'weekly') {
    const day = utcDay(date), weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    const start = day - (weekday + 6) % 7;
    return { period: `W-${dateFromDay(start)}`, startDate: dateFromDay(start), endDate: dateFromDay(start + 6) };
  }
  if (frequency === 'monthly') {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    return { period: date.slice(0, 7), startDate, endDate: dateFromDay(utcDay(shiftCalendarMonths(startDate, 1)) - 1) };
  }
  if (frequency === 'quarterly') {
    const quarter = Math.floor((month - 1) / 3), startDate = `${year}-${String(quarter * 3 + 1).padStart(2, '0')}-01`;
    return { period: `${year}-Q${quarter + 1}`, startDate, endDate: dateFromDay(utcDay(shiftCalendarMonths(startDate, 3)) - 1) };
  }
  if (frequency === 'four-year') {
    const firstYear = 2010 + 4 * Math.floor((year - 2010) / 4);
    return { period: `${firstYear}–${firstYear + 3}`, startDate: `${firstYear}-01-01`, endDate: `${firstYear + 3}-12-31` };
  }
  throw new TypeError(`Unsupported calendar frequency: ${frequency}`);
}

/** Within-period MDD includes the preceding observed close as its initial peak. */
function periodStatistics(rows, prior, priorATH) {
  let runningPeak = prior ?? rows[0], drawdownPeak = runningPeak, drawdownLow = runningPeak;
  let mdd = 0, ath = priorATH ?? -Infinity, maxATHDrawdown = 0, newHighDays = 0;
  const returns = [];
  let previous = prior, continuous = true;
  for (const row of rows) {
    if (row.price > runningPeak.price) runningPeak = row;
    const dd = row.price / runningPeak.price - 1;
    if (dd < mdd) { mdd = dd; drawdownPeak = runningPeak; drawdownLow = row; }
    if (row.price > ath) { if (Number.isFinite(ath)) newHighDays++; ath = row.price; }
    maxATHDrawdown = Math.min(maxATHDrawdown, row.price / ath - 1);
    if (previous) {
      if (row.epochDay - previous.epochDay === 1) returns.push(Math.log(row.price / previous.price));
      else continuous = false;
    }
    previous = row;
  }
  const first = rows[0], last = rows.at(-1), high = extreme(rows), low = extreme(rows, false);
  const rv = continuous ? sampleSD(returns) : null;
  return {
    date: last.date, price: last.price,
    firstObservationDate: first.date, lastObservationDate: last.date,
    open: first.price, high: high.price, low: low.price, close: last.price,
    highDate: high.date, lowDate: low.date,
    ohlcDefinition: 'Daily-close-derived O/H/L/C; not intraday candles.',
    priorCloseDate: prior?.date ?? null, priorClose: prior?.price ?? null,
    priorCloseContiguous: Boolean(prior && first.epochDay - prior.epochDay === 1),
    returnPct: prior ? (last.price / prior.price - 1) * 100 : null,
    firstToLastReturnPct: (last.price / first.price - 1) * 100,
    maxDrawdownPct: mdd * 100, drawdownPeakDate: drawdownPeak.date, drawdownTroughDate: drawdownLow.date,
    drawdownSeededWithPriorClose: Boolean(prior),
    athDrawdownPct: (last.price / ath - 1) * 100, maxATHDrawdownPct: maxATHDrawdown * 100,
    rangePct: (high.price / low.price - 1) * 100,
    realizedVolPct: rv === null ? null : rv * Math.sqrt(365) * 100,
    volatilityReturnCount: returns.length, volatilityAnnualizationDays: 365,
    newHighDays, discoveryDays: newHighDays, continuous,
  };
}

/** Calendar bins remain partial until every labeled day is observed. */
export function aggregateCloseBars(input, { frequency = 'weekly', asOf } = {}) {
  const rows = observations(input, asOf), grouped = [];
  for (const row of rows) {
    const bounds = periodBounds(row.date, frequency);
    if (grouped.at(-1)?.period !== bounds.period) grouped.push({ ...bounds, rows: [] });
    grouped.at(-1).rows.push(row);
  }
  let prior = null, ath = null;
  return grouped.map((group) => {
    const first = group.rows[0], last = group.rows.at(-1);
    const expectedDays = utcDay(group.endDate) - utcDay(group.startDate) + 1;
    const missingDays = last.epochDay - first.epochDay + 1 - group.rows.length;
    const stats = periodStatistics(group.rows, prior, ath);
    prior = last; ath = Math.max(ath ?? -Infinity, ...group.rows.map((row) => row.price));
    return {
      period: group.period, frequency, startDate: group.startDate, endDate: group.endDate,
      ...stats, observations: group.rows.length, expectedDays, missingDays,
      leftCensored: first.date > group.startDate, rightCensored: last.date < group.endDate,
      complete: first.date === group.startDate && last.date === group.endDate && group.rows.length === expectedDays,
      knownAt: last.date, earliestKnowableUtc: earliestKnowable(last.date),
    };
  });
}

function sampledRows(input, { frequency = 'daily', asOf } = {}) {
  if (!['daily', 'weekly'].includes(frequency)) throw new TypeError('Sampling frequency must be daily or weekly');
  const rows = observations(input, asOf);
  if (frequency === 'daily') return rows;
  return aggregateCloseBars(rows, { frequency: 'weekly' }).filter((bar) => bar.complete)
    .map((bar) => ({ date: bar.lastObservationDate, price: bar.close, epochDay: utcDay(bar.lastObservationDate) }));
}

/** Confirmed extrema never backdate their availability to the extremum date. */
export function detectDirectionalChanges(input, { threshold = 0.12, frequency = 'daily', asOf } = {}) {
  fraction(threshold, 'threshold');
  const rows = sampledRows(input, { frequency, asOf }), pivots = [];
  const parameters = { threshold, frequency, reversalDefinition: 'Up: low×(1+threshold); down: high×(1−threshold).' };
  if (!rows.length) return { parameters, pivots, legs: [], current: null };
  let direction = 'unknown', high = { ...rows[0], index: 0 }, low = high;
  function confirm(type, candidate, row, index) {
    pivots.push({
      type, eventDate: candidate.date, eventPrice: candidate.price,
      confirmationDate: row.date, confirmationPrice: row.price,
      knownAt: row.date, earliestKnowableUtc: earliestKnowable(row.date),
      lagDays: row.epochDay - candidate.epochDay, lagBars: index - candidate.index,
      threshold, frequency, causal: true, leftCensored: candidate.index === 0,
    });
  }
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i], candidate = { ...row, index: i };
    if (direction === 'unknown') {
      if (row.price > high.price) high = candidate;
      if (row.price < low.price) low = candidate;
      if (row.price < high.price && atMost(row.price / high.price, 1 - threshold)) {
        confirm('high', high, row, i); direction = 'down'; low = candidate;
      } else if (row.price > low.price && atLeast(row.price / low.price, 1 + threshold)) {
        confirm('low', low, row, i); direction = 'up'; high = candidate;
      }
    } else if (direction === 'up') {
      if (row.price > high.price) high = candidate;
      if (row.price < high.price && atMost(row.price / high.price, 1 - threshold)) {
        confirm('high', high, row, i); direction = 'down'; low = candidate;
      }
    } else {
      if (row.price < low.price) low = candidate;
      if (row.price > low.price && atLeast(row.price / low.price, 1 + threshold)) {
        confirm('low', low, row, i); direction = 'up'; high = candidate;
      }
    }
  }
  const legs = pivots.slice(1).map((end, index) => {
    const start = pivots[index];
    return {
      direction: end.type === 'high' ? 'up' : 'down', startDate: start.eventDate, startPrice: start.eventPrice,
      endDate: end.eventDate, endPrice: end.eventPrice, confirmationDate: end.confirmationDate,
      knownAt: end.confirmationDate, durationDays: utcDay(end.eventDate) - utcDay(start.eventDate),
      returnPct: (end.eventPrice / start.eventPrice - 1) * 100,
      leftCensored: start.leftCensored, boundariesKnownOnlyAfterConfirmation: true,
    };
  });
  const candidate = direction === 'up' ? high : direction === 'down' ? low : null;
  return {
    parameters, pivots, legs,
    current: { asOf: rows.at(-1).date, direction, unconfirmedCandidate: candidate ? {
      type: direction === 'up' ? 'high' : 'low', eventDate: candidate.date, eventPrice: candidate.price,
      confirmed: false, knownAt: rows.at(-1).date,
    } : null },
  };
}

function makeEpisodes(points, stepDays) {
  const episodes = [];
  for (const row of points) {
    let episode = episodes.at(-1);
    const gap = Boolean(episode && utcDay(row.date) - utcDay(episode.endDate) !== stepDays);
    if (gap) episode.rightCensored = true;
    if (!episode || episode.state !== row.state || gap) {
      episode = { state: row.state, startDate: row.date, endDate: row.date, bars: 0, leftCensored: !episodes.length || gap, rightCensored: false };
      episodes.push(episode);
    }
    episode.endDate = row.date; episode.bars++;
    episode.durationDays = episode.bars * stepDays;
    episode.elapsedDays = utcDay(episode.endDate) - utcDay(episode.startDate);
  }
  if (episodes.length) episodes.at(-1).rightCensored = true;
  return episodes;
}

/** Every label depends only on closes at or before that label's date. */
export function computeRollingStates(input, {
  frequency = 'daily', threshold = 0.12,
  shortWindow = frequency === 'daily' ? 28 : 4,
  longWindow = frequency === 'daily' ? 91 : 13,
  deepDrawdown = 0.40, asOf,
} = {}) {
  fraction(threshold, 'threshold'); fraction(deepDrawdown, 'deepDrawdown');
  positiveInteger(shortWindow, 'shortWindow'); positiveInteger(longWindow, 'longWindow');
  if (longWindow < shortWindow) throw new RangeError('longWindow must be at least shortWindow');
  const rows = sampledRows(input, { frequency, asOf }), stepDays = frequency === 'weekly' ? 7 : 1;
  const parameters = { frequency, threshold, shortWindow, longWindow, deepDrawdown, stepDays, windowDefinition: 'lookback intervals; each price window includes both endpoints' };
  let ath = -Infinity;
  const points = rows.map((row, i) => {
    const newATH = i > 0 && row.price > ath;
    ath = Math.max(ath, row.price);
    const athDrawdown = row.price / ath - 1;
    const hasShort = i >= shortWindow && row.epochDay - rows[i - shortWindow].epochDay === shortWindow * stepDays;
    const hasLong = i >= longWindow && row.epochDay - rows[i - longWindow].epochDay === longWindow * stepDays;
    const shortRows = hasShort ? rows.slice(i - shortWindow, i + 1) : [];
    const longRows = hasLong ? rows.slice(i - longWindow, i + 1) : [];
    const shortMA = hasShort ? Math.exp(mean(shortRows.map((p) => Math.log(p.price)))) : null;
    const longMA = hasLong ? Math.exp(mean(longRows.map((p) => Math.log(p.price)))) : null;
    const high = hasShort ? Math.max(...shortRows.map((p) => p.price)) : null;
    const low = hasShort ? Math.min(...shortRows.map((p) => p.price)) : null;
    const rollingReturn = hasShort ? row.price / shortRows[0].price - 1 : null;
    const rollingRange = hasShort ? high / low - 1 : null;
    const rollingDrawdown = hasShort ? row.price / high - 1 : null;
    const rebound = hasShort ? row.price / low - 1 : null;
    const returns = hasShort ? shortRows.slice(1).map((p, index) => Math.log(p.price / shortRows[index].price)) : [];
    const rv = sampleSD(returns);
    let state = 'transition';
    if (!hasLong) state = 'warmup';
    else if (newATH) state = 'price-discovery';
    else if (atMost(athDrawdown, -deepDrawdown) && atMost(rollingRange, threshold) && atMost(Math.abs(rollingReturn), threshold / 2)) state = 'bottom-formation';
    else if (atMost(rollingRange, threshold) && atMost(Math.abs(rollingReturn), threshold / 2)) state = 'range';
    else if (atMost(athDrawdown, -threshold) && atLeast(rebound, threshold) && rollingReturn > threshold / 2 && row.price > shortMA) state = 'rebound';
    else if (atMost(rollingDrawdown, -threshold) && row.price >= longMA) state = 'pullback';
    else if (row.price >= shortMA && shortMA >= longMA && rollingReturn > 0) state = 'advance';
    else if (row.price < longMA && rollingReturn < 0) state = 'correction';
    else if (row.price < shortMA && rollingReturn < 0) state = 'pullback';
    return {
      date: row.date, price: row.price, epochDay: row.epochDay, state,
      knownAt: row.date, earliestKnowableUtc: earliestKnowable(row.date), causal: true,
      athPrice: ath, athDrawdownPct: athDrawdown * 100, newATH,
      rollingReturnPct: rollingReturn === null ? null : rollingReturn * 100,
      rollingRangePct: rollingRange === null ? null : rollingRange * 100,
      rollingDrawdownPct: rollingDrawdown === null ? null : rollingDrawdown * 100,
      reboundFromWindowLowPct: rebound === null ? null : rebound * 100,
      realizedVolPct: rv === null ? null : rv * Math.sqrt(365 / stepDays) * 100,
      shortMA, longMA,
    };
  });
  return { parameters, points, current: points.at(-1) ?? null, episodes: makeEpisodes(points, stepDays) };
}

/** Historical calendar-year peaks and lows bounded by the next selected peak. */
export function getMacroCycles(input, { asOf } = {}) {
  const rows = observations(input, asOf), last = rows.at(-1);
  const peaks = PEAK_YEARS.map((year) => ({ year, row: extreme(rows.filter((p) => p.date.startsWith(`${year}-`))) })).filter((p) => p.row);
  let start = rows[0];
  const cycles = peaks.map(({ year, row: peak }, index) => {
    const bound = peaks[index + 1]?.row ?? last;
    const end = extreme(rows.filter((row) => row.date >= peak.date && row.date <= bound.date), false);
    const leftCensored = index === 0, rightCensored = index === peaks.length - 1;
    const nominalEnd = shiftCalendarMonths(start.date, 48), nominalDays = utcDay(nominalEnd) - start.epochDay;
    const bullDays = peak.epochDay - start.epochDay, bearDays = end.epochDay - peak.epochDay;
    const cycle = {
      id: `peak-${year}`, peakYear: year, regime: year === 2011 ? 'early-price-discovery' : year === 2013 ? 'early-halving-era' : 'mature-halving-era',
      start: point(start), peak: point(peak), end: point(end),
      observationEndDate: rightCensored ? last.date : end.date,
      peakSelection: 'Maximum daily close within the named calendar year; retrospective.',
      troughSelection: 'Minimum daily close from this peak through the next selected peak, or current cutoff.',
      boundariesRetrospective: true, leftCensored, rightCensored, complete: !leftCensored && !rightCensored,
      peakYearFullyObserved: last.date >= `${year}-12-31`, endIsCandidate: rightCensored,
      bullDays, bearDays, cycleDays: end.epochDay - start.epochDay,
      recoverySinceCandidateDays: rightCensored ? last.epochDay - end.epochDay : null,
      observedWindowDays: utcDay(rightCensored ? last.date : end.date) - start.epochDay,
      bullReturnPct: (peak.price / start.price - 1) * 100,
      bearReturnPct: (end.price / peak.price - 1) * 100,
      nominal48MonthEnd: nominalEnd, nominal48MonthDays: nominalDays,
      peakAtNominalMonth: 48 * bullDays / nominalDays,
      troughAtNominalMonth: 48 * (end.epochDay - start.epochDay) / nominalDays,
      bullDeltaVersus36CalendarMonthsDays: peak.epochDay - utcDay(shiftCalendarMonths(start.date, 36)),
      bearDeltaVersus12CalendarMonthsDays: end.epochDay - utcDay(shiftCalendarMonths(peak.date, 12)),
    };
    start = end;
    return cycle;
  });
  return { asOf: last.date, cycles, selectionIsRetrospective: true, initialHistoryIsLeftCensored: true };
}

export function theilSenTrend(records) {
  if (!Array.isArray(records)) throw new TypeError('Trend records must be an array');
  const values = records.filter((row) => Number.isFinite(row.value));
  const coordinates = values.map((row, index) => row.x ?? index);
  if (coordinates.some((x) => !Number.isFinite(x)) || new Set(coordinates).size !== coordinates.length) throw new TypeError('Trend coordinates must be finite and distinct');
  const slopes = [];
  for (let i = 0; i < values.length; i++) for (let j = i + 1; j < values.length; j++) {
    const x1 = values[i].x ?? i, x2 = values[j].x ?? j;
    if (x2 !== x1) slopes.push((values[j].value - values[i].value) / (x2 - x1));
  }
  const slope = median(slopes);
  const leaveOneOut = values.length >= 3 ? values.map((omitted, index) => {
    const subset = values.map((row, i) => ({ ...row, x: row.x ?? i })).filter((_, i) => i !== index);
    const differences = [];
    for (let i = 0; i < subset.length; i++) for (let j = i + 1; j < subset.length; j++) differences.push((subset[j].value - subset[i].value) / (subset[j].x - subset[i].x));
    return { omittedId: omitted.id, slopeDaysPerCycle: median(differences) };
  }) : [];
  const loo = leaveOneOut.map((row) => row.slopeDaysPerCycle).filter((v) => v !== null);
  return {
    nCycles: values.length, records: values, slopeDaysPerCycle: slope, pairwiseSlopes: slopes,
    leaveOneOut, leaveOneOutMin: loo.length ? Math.min(...loo) : null, leaveOneOutMax: loo.length ? Math.max(...loo) : null,
    leaveOneOutDirectionStable: loo.length ? loo.every((v) => Math.sign(v) === Math.sign(slope)) : null,
    inferentialPValue: null, confidenceInterval: null,
    interpretation: 'Descriptive slope and leave-one-cycle sensitivity; cycles are the sampling units, not daily observations.',
  };
}

function summarizeStateWindow(points, startDate, endDate, stepDays = 1, includeEnd = true, includeStart = false) {
  const selected = points.filter((row) => (includeStart ? row.date >= startDate : row.date > startDate) && (includeEnd ? row.date <= endDate : row.date < endDate));
  const counts = Object.fromEntries(STATES.map((state) => [state, 0]));
  for (const row of selected) counts[row.state]++;
  const episodes = makeEpisodes(selected, stepDays);
  const stateEpisodes = Object.fromEntries(STATES.map((state) => {
    const completed = episodes.filter((episode) => episode.state === state && !episode.leftCensored && !episode.rightCensored);
    return [state, { completedEpisodes: completed.length, medianDays: median(completed.map((e) => e.durationDays)),
      minDays: completed.length ? Math.min(...completed.map((e) => e.durationDays)) : null,
      maxDays: completed.length ? Math.max(...completed.map((e) => e.durationDays)) : null }];
  }));
  return {
    startDate, endDate, startIncluded: includeStart, endIncluded: includeEnd, elapsedDays: utcDay(endDate) - utcDay(startDate),
    observationCount: selected.length, sampleStepDays: stepDays, stateCounts: counts,
    stateSharePct: Object.fromEntries(STATES.map((state) => [state, selected.length ? counts[state] / selected.length * 100 : null])),
    stateEpisodes, boundaryEpisodesCensored: true,
  };
}

function addCycleStates(cycles, states, frequency) {
  const step = frequency === 'weekly' ? 7 : 1;
  return cycles.map((cycle) => ({ ...cycle,
    stateSummary: {
      frequency,
      bull: summarizeStateWindow(states.points, cycle.start.date, cycle.peak.date, step),
      bear: summarizeStateWindow(states.points, cycle.peak.date, cycle.end.date, step),
      recovery: cycle.rightCensored ? summarizeStateWindow(states.points, cycle.end.date, cycle.observationEndDate, step, true) : null,
      allObserved: summarizeStateWindow(states.points, cycle.start.date, cycle.observationEndDate, step),
    },
  }));
}

function durationTrends(cycles) {
  const trend = (selected, key) => theilSenTrend(selected.map((cycle, index) => ({ id: cycle.id, x: index, value: cycle[key], provisional: cycle.rightCensored })));
  const completed = cycles.filter((c) => c.complete), mature = cycles.filter((c) => c.regime === 'mature-halving-era');
  return {
    bullAllNonLeftCensored: trend(cycles.filter((c) => !c.leftCensored), 'bullDays'),
    bullMatureIncludingLatestPeak: trend(mature, 'bullDays'),
    bullCompleted: trend(completed, 'bullDays'),
    bearCompleted: trend(completed, 'bearDays'),
    bearIncludingLatestCandidate: trend(cycles.filter((c) => !c.leftCensored), 'bearDays'),
    cycleCompleted: trend(completed, 'cycleDays'),
    cycleMatureCompleted: trend(mature.filter((c) => c.complete), 'cycleDays'),
    subphaseDaysInMatureBull: Object.fromEntries(STATES.filter((s) => s !== 'warmup').map((state) => [state,
      theilSenTrend(mature.map((cycle, index) => ({ id: cycle.id, x: index, value: cycle.stateSummary.bull.stateCounts[state], provisional: cycle.rightCensored }))),
    ])),
    limits: [
      'The 2010/2011 observation window is left-censored and is not a four-year cycle.',
      'The latest trough is an observed candidate; its bear duration can lengthen.',
      'Peak-year selection and macro boundaries are retrospective. Daily causal state labels do not make those boundaries causal.',
      'Calendar four-year blocks have fixed lengths; their state occupancy is a separate comparison from extrema-defined durations.',
    ],
  };
}

/** r=0 is the confirmed swing endpoint; r=1 is the previous confirmed pivot. */
export function fibonacciLevels(startPrice, endPrice, { ratios = FIBONACCI_RATIOS, scale = 'linear' } = {}) {
  if (![startPrice, endPrice].every((p) => Number.isFinite(p) && p > 0) || startPrice === endPrice) throw new TypeError('Swing prices must be distinct, finite and positive');
  if (!['linear', 'log'].includes(scale)) throw new TypeError('Retracement scale must be linear or log');
  if (!Array.isArray(ratios) || !ratios.length) throw new TypeError('Ratios must be a nonempty array');
  return ratios.map((ratio) => {
    fraction(ratio, 'retracement ratio');
    return { ratio, price: scale === 'linear'
      ? endPrice - ratio * (endPrice - startPrice)
      : Math.exp(Math.log(endPrice) - ratio * Math.log(endPrice / startPrice)) };
  });
}

export function confirmedSwingRetracement(pivots, asOf, currentPrice) {
  utcDay(asOf);
  const known = pivots.filter((pivot) => pivot.confirmationDate <= asOf);
  if (known.length < 2) return null;
  const start = known.at(-2), end = known.at(-1);
  return {
    direction: end.type === 'high' ? 'up' : 'down',
    start: { date: start.eventDate, price: start.eventPrice, confirmationDate: start.confirmationDate },
    end: { date: end.eventDate, price: end.eventPrice, confirmationDate: end.confirmationDate },
    knownAt: end.confirmationDate, leftCensored: start.leftCensored,
    linear: fibonacciLevels(start.eventPrice, end.eventPrice, { scale: 'linear' }),
    log: fibonacciLevels(start.eventPrice, end.eventPrice, { scale: 'log' }),
    currentRetracementLinear: Number.isFinite(currentPrice) ? (end.eventPrice - currentPrice) / (end.eventPrice - start.eventPrice) : null,
    currentRetracementLog: Number.isFinite(currentPrice) && currentPrice > 0 ? Math.log(end.eventPrice / currentPrice) / Math.log(end.eventPrice / start.eventPrice) : null,
    ratiosAreConventions: true, halfIsNotAFibonacciNumber: true,
  };
}

const RESOLVED_TOUCH_STATUSES = new Set(['rejected', 'failed', 'unresolved']);
function trialSummary(trials) {
  const statuses = ['anchor-left-censored', 'crossed-before-confirmation', 'no-touch', 'search-censored', 'followup-censored', 'rejected', 'failed', 'unresolved'];
  const counts = Object.fromEntries(statuses.map((status) => [status, 0]));
  for (const trial of trials) counts[trial.status]++;
  const completedTouches = counts.rejected + counts.failed + counts.unresolved;
  return {
    totalLevels: trials.length, counts,
    completedTouches, rejected: counts.rejected, failed: counts.failed, unresolved: counts.unresolved,
    rejectionRatePct: completedTouches ? counts.rejected / completedTouches * 100 : null,
    resolvedOnlyRejectionRatePct: counts.rejected + counts.failed ? counts.rejected / (counts.rejected + counts.failed) * 100 : null,
    censored: counts['search-censored'] + counts['followup-censored'],
    rejectionDenominator: 'All touched levels with the full follow-up window, including unresolved outcomes.',
  };
}

/**
 * Frozen, already-confirmed swings. A close crossing is not an intraday fill.
 * A full follow-up horizon is required even if a barrier was hit early.
 */
export function evaluateFibonacci(input, {
  threshold = 0.12, frequency = 'daily', scale = 'linear',
  touchHorizonDays = 56, followupDays = 14, rejectionFraction = 0.05,
  includeTrials = false, asOf,
} = {}) {
  fraction(threshold, 'threshold'); fraction(rejectionFraction, 'rejectionFraction');
  positiveInteger(touchHorizonDays, 'touchHorizonDays'); positiveInteger(followupDays, 'followupDays');
  if (!['linear', 'log'].includes(scale)) throw new TypeError('Retracement scale must be linear or log');
  const raw = observations(input, asOf), rows = sampledRows(raw, { frequency });
  const pivots = detectDirectionalChanges(raw, { threshold, frequency }).pivots;
  const cycles = getMacroCycles(raw).cycles, trials = [], lastDay = rows.at(-1)?.epochDay ?? -Infinity;
  const stepDays = frequency === 'weekly' ? 7 : 1;
  const indexByDate = new Map(rows.map((row, index) => [row.date, index]));
  for (let i = 1; i < pivots.length; i++) {
    const start = pivots[i - 1], end = pivots[i], direction = end.type === 'high' ? 1 : -1;
    const knownIndex = indexByDate.get(end.confirmationDate), knownDay = utcDay(end.confirmationDate);
    const eventIndex = indexByDate.get(end.eventDate), horizonEndDay = knownDay + touchHorizonDays;
    const cycle = cycles.find((c) => end.eventDate >= c.start.date && (c.rightCensored ? end.eventDate <= c.observationEndDate : end.eventDate < c.end.date));
    for (const [group, ratios] of [['fibonacci', FIBONACCI_RATIOS], ['control', CONTROL_RATIOS]]) {
      const levels = fibonacciLevels(start.eventPrice, end.eventPrice, { ratios, scale });
      levels.forEach(({ ratio, price: levelPrice }, slot) => {
        const trial = {
          id: `${frequency}-${threshold}-${scale}-${i}-${group}-${slot}`, swingId: i, group, slot, ratio, levelPrice,
          scale, direction: direction === 1 ? 'support-after-up-swing' : 'resistance-after-down-swing',
          anchorStartDate: start.eventDate, anchorStartPrice: start.eventPrice,
          anchorEndDate: end.eventDate, anchorEndPrice: end.eventPrice,
          anchorKnownAt: end.confirmationDate, cycleId: cycle?.id ?? 'unassigned',
          cycleComplete: Boolean(cycle?.complete), touchDate: null, outcomeDate: null, status: null,
        };
        if (start.leftCensored) { trial.status = 'anchor-left-censored'; trials.push(trial); return; }
        const beforeKnown = rows.slice(eventIndex + 1, knownIndex + 1);
        if (beforeKnown.some((p) => direction * (p.price - levelPrice) <= 0)) {
          trial.status = 'crossed-before-confirmation'; trials.push(trial); return;
        }
        let touchIndex = -1;
        for (let j = knownIndex + 1; j < rows.length && rows[j].epochDay <= horizonEndDay; j++) {
          if (direction * (rows[j].price - levelPrice) <= 0) { touchIndex = j; break; }
        }
        if (touchIndex < 0) {
          const searchRows = rows.slice(knownIndex).filter((p) => p.epochDay <= horizonEndDay);
          const expected = Math.floor(touchHorizonDays / stepDays) + 1;
          trial.status = lastDay >= horizonEndDay && searchRows.length === expected ? 'no-touch' : 'search-censored';
          trials.push(trial); return;
        }
        const touched = rows[touchIndex], outcomeEndDay = touched.epochDay + followupDays;
        const followup = rows.slice(touchIndex).filter((p) => p.epochDay <= outcomeEndDay);
        trial.touchDate = touched.date; trial.touchClose = touched.price;
        trial.followupEndDate = dateFromDay(outcomeEndDay);
        if (lastDay < outcomeEndDay || followup.length !== Math.floor(followupDays / stepDays) + 1
          || followup.some((p, j) => j > 0 && p.epochDay - followup[j - 1].epochDay !== stepDays)) {
          trial.status = 'followup-censored'; trials.push(trial); return;
        }
        trial.status = 'unresolved';
        for (const p of followup) {
          const move = direction * (p.price / levelPrice - 1);
          if (atLeast(move, rejectionFraction)) { trial.status = 'rejected'; trial.outcomeDate = p.date; break; }
          if (atMost(move, -rejectionFraction)) { trial.status = 'failed'; trial.outcomeDate = p.date; break; }
        }
        trials.push(trial);
      });
    }
  }
  const fib = trials.filter((t) => t.group === 'fibonacci'), control = trials.filter((t) => t.group === 'control');
  const perCycle = cycles.map((cycle) => {
    const f = trialSummary(fib.filter((t) => t.cycleId === cycle.id)), c = trialSummary(control.filter((t) => t.cycleId === cycle.id));
    return { cycleId: cycle.id, complete: cycle.complete, leftCensored: cycle.leftCensored, rightCensored: cycle.rightCensored,
      fibonacci: f, control: c, differencePercentagePoints: f.rejectionRatePct !== null && c.rejectionRatePct !== null ? f.rejectionRatePct - c.rejectionRatePct : null };
  });
  const controls = new Map(control.map((t) => [`${t.swingId}-${t.slot}`, t]));
  const matched = fib.flatMap((f) => {
    const c = controls.get(`${f.swingId}-${f.slot}`);
    return RESOLVED_TOUCH_STATUSES.has(f.status) && c && RESOLVED_TOUCH_STATUSES.has(c.status)
      ? [{ cycleId: f.cycleId, cycleComplete: f.cycleComplete, difference: Number(f.status === 'rejected') - Number(c.status === 'rejected') }] : [];
  });
  const closedDifferences = perCycle.filter((c) => c.complete && c.differencePercentagePoints !== null);
  return {
    parameters: { threshold, frequency, scale, touchHorizonDays, followupDays, rejectionFraction,
      fibonacciRatios: [...FIBONACCI_RATIOS], controlRatios: [...CONTROL_RATIOS],
      fullFollowupRequiredEvenIfBarrierHitEarly: true, halfIsConventionalNotAFibonacciNumber: true },
    asOf: rows.at(-1)?.date ?? null, designIsRetrospective: true,
    fibonacci: trialSummary(fib), control: trialSummary(control), perCycle,
    completedCycleComparison: {
      nCycles: closedDifferences.length,
      fibonacci: trialSummary(fib.filter((t) => t.cycleComplete)), control: trialSummary(control.filter((t) => t.cycleComplete)),
      meanCycleDifferencePercentagePoints: mean(closedDifferences.map((c) => c.differencePercentagePoints)),
      minCycleDifferencePercentagePoints: closedDifferences.length ? Math.min(...closedDifferences.map((c) => c.differencePercentagePoints)) : null,
      maxCycleDifferencePercentagePoints: closedDifferences.length ? Math.max(...closedDifferences.map((c) => c.differencePercentagePoints)) : null,
    },
    matchedCompletedTouches: {
      pairs: matched.length, differencePercentagePoints: matched.length ? 100 * mean(matched.map((p) => p.difference)) : null,
      completedCyclePairs: matched.filter((p) => p.cycleComplete).length,
      completedCycleDifferencePercentagePoints: matched.some((p) => p.cycleComplete) ? 100 * mean(matched.filter((p) => p.cycleComplete).map((p) => p.difference)) : null,
      matching: 'Same confirmed swing and nearest predeclared ratio slot; both touches require complete follow-up.',
    },
    inference: {
      pValue: null, independentDailyTrialCount: null, samplingUnit: 'macro cycles, with overlap and serial dependence retained',
      controlsArePlacebosNotAStatisticalNullDistribution: true,
      caveat: 'Descriptive retrospective comparison; ratio pairs have slightly different prices and touch times. No out-of-sample edge or execution profitability is established.',
    },
    ...(includeTrials ? { trials } : {}),
  };
}

function doublePeakExamples(rows) {
  return [2013, 2021].flatMap((year) => {
    const firstHalf = rows.filter((p) => p.date >= `${year}-01-01` && p.date <= `${year}-06-30`);
    const annual = rows.filter((p) => p.date.startsWith(`${year}-`));
    if (!firstHalf.length || !annual.length) return [];
    const firstPeak = extreme(firstHalf), finalPeak = extreme(annual);
    if (finalPeak.date <= firstPeak.date) return [];
    const valley = extreme(rows.filter((p) => p.date >= firstPeak.date && p.date <= finalPeak.date), false);
    return [{ year, firstHalfPeak: point(firstPeak), interveningLow: point(valley), annualPeak: point(finalPeak),
      firstPeakAsPctOfAnnualPeak: 100 * firstPeak.price / finalPeak.price,
      interimDrawdownPct: 100 * (valley.price / firstPeak.price - 1),
      firstToFinalPeakDays: finalPeak.epochDay - firstPeak.epochDay,
      peakToInterveningLowDays: valley.epochDay - firstPeak.epochDay,
      interveningLowToFinalPeakDays: finalPeak.epochDay - valley.epochDay,
      retrospective: true, selection: 'Illustrative 2013 and 2021 cases: first-half maximum, later annual maximum, and intervening minimum.' }];
  });
}

function cycleRisk(rows, cycle) {
  const bull = rows.filter((p) => p.date >= cycle.start.date && p.date <= cycle.peak.date);
  const bear = rows.filter((p) => p.date >= cycle.peak.date && p.date <= cycle.end.date);
  let runningLow = bear[0], largestRebound = 0, reboundLow = bear[0], reboundHigh = bear[0];
  for (const p of bear) {
    if (p.price < runningLow.price) runningLow = p;
    const move = p.price / runningLow.price - 1;
    if (move > largestRebound) { largestRebound = move; reboundLow = runningLow; reboundHigh = p; }
  }
  const risk = periodStatistics(bull, null, null);
  return {
    bullMaxDrawdownPct: risk.maxDrawdownPct, bullDrawdownPeakDate: risk.drawdownPeakDate, bullDrawdownTroughDate: risk.drawdownTroughDate,
    bearLargestCountertrendReboundPct: largestRebound * 100, bearReboundLowDate: reboundLow.date, bearReboundHighDate: reboundHigh.date,
    extremaAreRetrospective: true,
  };
}

function summarizeCalendarPeriods(periods) {
  const observed = periods.filter((period) => period.complete && period.returnPct !== null);
  const valid = (key) => observed.map((period) => period[key]).filter(Number.isFinite);
  return {
    completedPeriods: observed.length,
    firstPeriod: observed[0]?.period ?? null, lastPeriod: observed.at(-1)?.period ?? null,
    negativePeriods: observed.filter((p) => p.returnPct < 0).length,
    negativePeriodPct: observed.length ? 100 * observed.filter((p) => p.returnPct < 0).length / observed.length : null,
    medianReturnPct: median(valid('returnPct')), meanReturnPct: mean(valid('returnPct')),
    medianMaxDrawdownPct: median(valid('maxDrawdownPct')),
    worstMaxDrawdownPct: observed.length ? Math.min(...valid('maxDrawdownPct')) : null,
    medianRangePct: median(valid('rangePct')), medianRealizedVolPct: median(valid('realizedVolPct')),
    periodsWithPriceDiscovery: observed.filter((p) => p.newHighDays > 0).length,
    completePeriodsOnly: true,
  };
}

function periodComparisons(monthly, quarterly, blocks, cycles) {
  const enclosed = (periods, start, end) => periods.filter((p) => p.startDate >= start && p.endDate <= end);
  const window = (start, end) => ({
    startDate: start, endDate: end,
    monthly: summarizeCalendarPeriods(enclosed(monthly, start, end)),
    quarterly: summarizeCalendarPeriods(enclosed(quarterly, start, end)),
  });
  return {
    selection: 'Only complete calendar months/quarters wholly inside each window. Edge fragments and ongoing periods are excluded.',
    calendarBlocks: blocks.map((block) => ({ id: block.period, ...window(block.startDate, block.endDate), isMarketCycleClaim: false })),
    macroCycles: cycles.map((cycle) => ({
      id: cycle.id, retrospectiveBoundaries: true, complete: cycle.complete,
      bull: window(cycle.start.date, cycle.peak.date), bear: window(cycle.peak.date, cycle.end.date),
      recovery: cycle.rightCensored ? window(cycle.end.date, cycle.observationEndDate) : null,
    })),
    independenceCaveat: 'Months, quarters and days overlap market regimes and are not independent cycle replications.',
  };
}

/** Complete deterministic analysis; all state/pivot thresholds are explicit. */
export function analyzeMarketStructure(input, { asOf, threshold = 0.12, includeDailyStates = true, includeFibonacciSensitivity = true } = {}) {
  const rows = observations(input, asOf), macro = getMacroCycles(rows);
  const daily = computeRollingStates(rows, { threshold }), weekly = computeRollingStates(rows, { threshold, frequency: 'weekly' });
  const dailyPivots = detectDirectionalChanges(rows, { threshold }), weeklyPivots = detectDirectionalChanges(rows, { threshold, frequency: 'weekly' });
  const cycles = addCycleStates(macro.cycles, daily, 'daily').map((cycle) => ({ ...cycle, risk: cycleRisk(rows, cycle) }));
  const decoratePeriod = (period) => ({ ...period,
    fibonacciAnchor: confirmedSwingRetracement(dailyPivots.pivots, period.lastObservationDate, period.close),
  });
  const monthly = aggregateCloseBars(rows, { frequency: 'monthly' }).map(decoratePeriod);
  const quarterly = aggregateCloseBars(rows, { frequency: 'quarterly' }).map(decoratePeriod);
  const calendarBlocks = aggregateCloseBars(rows, { frequency: 'four-year' }).map((period) => ({ ...period,
    isMarketCycleClaim: false,
    stateSummary: summarizeStateWindow(daily.points, period.firstObservationDate, period.lastObservationDate, 1, true, true),
  }));
  const sensitivity = [];
  for (const frequency of ['daily', 'weekly']) for (const candidateThreshold of [0.08, 0.12, 0.20]) {
    const states = candidateThreshold === threshold ? (frequency === 'daily' ? daily : weekly) : computeRollingStates(rows, { frequency, threshold: candidateThreshold });
    const changes = candidateThreshold === threshold ? (frequency === 'daily' ? dailyPivots : weeklyPivots) : detectDirectionalChanges(rows, { frequency, threshold: candidateThreshold });
    const completeEpisodes = states.episodes.filter((e) => !e.leftCensored && !e.rightCensored);
    sensitivity.push({
      frequency, threshold: candidateThreshold, stateParameters: states.parameters,
      observationCount: states.points.length, confirmedPivotCount: changes.pivots.length,
      medianConfirmedLegDays: median(changes.legs.filter((l) => !l.leftCensored).map((l) => l.durationDays)),
      medianConfirmationLagDays: median(changes.pivots.filter((p) => !p.leftCensored).map((p) => p.lagDays)),
      completedEpisodeCount: completeEpisodes.length, medianEpisodeDays: median(completeEpisodes.map((e) => e.durationDays)),
      current: states.current, latestConfirmedPivot: changes.pivots.at(-1) ?? null,
      cycles: addCycleStates(macro.cycles, states, frequency).map((cycle) => ({
        id: cycle.id, bullDays: cycle.bullDays, bearDays: cycle.bearDays, complete: cycle.complete,
        stateSummary: cycle.stateSummary,
        confirmedPivotCount: changes.pivots.filter((p) => p.confirmationDate >= cycle.start.date && p.confirmationDate <= cycle.observationEndDate).length,
      })),
    });
  }
  const fibonacci = evaluateFibonacci(rows, { threshold });
  if (includeFibonacciSensitivity) fibonacci.sensitivity = ['daily', 'weekly'].flatMap((frequency) => [0.08, 0.12, 0.20].flatMap((t) => ['linear', 'log'].map((scale) => {
    const result = frequency === 'daily' && t === threshold && scale === 'linear' ? fibonacci : evaluateFibonacci(rows, { threshold: t, frequency, scale });
    return { frequency, threshold: t, scale, fibonacci: result.fibonacci, control: result.control,
      completedCycleComparison: result.completedCycleComparison, matchedCompletedTouches: result.matchedCompletedTouches };
  })));
  const first = rows[0], last = rows.at(-1);
  return {
    schemaVersion: MARKET_STRUCTURE_VERSION, asOf: last.date,
    coverage: { firstDate: first.date, lastDate: last.date, observations: rows.length,
      missingDayCount: last.epochDay - first.epochDay + 1 - rows.length, source: 'Coin Metrics Community API PriceUSD',
      priceDefinition: 'End of labeled UTC day. All OHLC, drawdown and volatility statistics are derived from daily closes.',
      intradayRiskIsNotMeasured: true, initialHistoryLeftCensored: true },
    parameters: { threshold, daily: daily.parameters, weekly: weekly.parameters,
      stateSelectionIsCausal: true, macroSelectionIsRetrospective: true, calendarBlockOriginYear: 2010 },
    stateLabels: STATE_LABELS, currentState: daily.current, currentWeeklyState: weekly.current,
    ...(includeDailyStates ? { dailyStates: daily.points } : {}), weeklyStates: weekly.points,
    dailyEpisodes: daily.episodes, weeklyEpisodes: weekly.episodes,
    pivots: { daily: dailyPivots, weekly: weeklyPivots },
    weeklyBars: aggregateCloseBars(rows, { frequency: 'weekly' }), monthly, quarterly, calendarBlocks,
    macroCycles: cycles, durationTrends: durationTrends(cycles), doublePeakExamples: doublePeakExamples(rows),
    periodComparisons: periodComparisons(monthly, quarterly, calendarBlocks, cycles),
    sensitivity, fibonacci,
    caveats: [
      'A bottom-formation state is a narrow-range/deep-drawdown condition, not confirmation of the final cycle bottom.',
      'Weekly states and pivots use complete Monday–Sunday bins and their Sunday close only; partial weeks remain in weeklyBars with complete=false.',
      'Daily-close MDD omits intraday extremes; its magnitude is a lower bound on drawdown from the same market price path sampled more finely.',
      'The 2010 starting observation, 2011 regime, 2013 double rise and 2021 double top are not forced into a smooth three-year ascent.',
      'Macro anchors are vendor-sensitive. Coin Metrics and Coinbase selected different November 2022 daily-close lows in the independent source audit (12 calendar days).',
      'Fibonacci controls are predeclared comparison grids, not a formal statistical null distribution. No p-values or trading advantage are claimed.',
      'Model and rule design are retrospective. Causal feature construction prevents input look-ahead but is not prospective validation.',
    ],
  };
}
