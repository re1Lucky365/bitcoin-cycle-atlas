import { HALVINGS, utcDay, dateFromDay, validateDataset } from './cycle-engine.js?v=1.11.0';
import { shiftCalendarMonths } from './cycle-timing.js?v=1.11.0';

/**
 * An observed-prefix clock adjustment, not a calibrated price prediction.
 * One forward pass preserves the signal that was knowable at each daily close.
 * Closed halving-era extrema enter the reference set only at the next observed
 * halving. A later low/high can revise today's candidate, never yesterday's row.
 */
export const CYCLE_CALIBRATION_VERSION = 'causal-cycle-clock-v1';
export const CYCLE_CALIBRATION_DEFAULTS = Object.freeze({
  drawdownPct: 40, reversalPct: 20, confirmationDays: 14, priorEquivalentCycles: 3,
  smoothingHalfLifeDays: 30, maxDailyShiftDays: 2, maxAbsoluteShiftDays: 180,
  neutralToleranceDays: 21,
});
export const CYCLE_CLOCK_STATES = Object.freeze({
  shortened: Object.freeze({ label: '단축 가정', color: '#df7c83' }),
  aligned: Object.freeze({ label: '기준 부근', color: '#65c3a5' }),
  lengthened: Object.freeze({ label: '연장 가정', color: '#74a7ee' }),
  insufficient: Object.freeze({ label: '근거 대기', color: '#8290a3' }),
});

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const median = values => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b), mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const observed = row => row ? { date: row.date, price: row.price } : null;
const shifted = (date, days) => dateFromDay(utcDay(date) + days);

function settingsFor(options) {
  const settings = { ...CYCLE_CALIBRATION_DEFAULTS, ...options };
  for (const key of ['drawdownPct', 'reversalPct', 'priorEquivalentCycles', 'smoothingHalfLifeDays', 'maxDailyShiftDays', 'maxAbsoluteShiftDays', 'neutralToleranceDays']) {
    if (!(Number.isFinite(settings[key]) && settings[key] > 0)) throw new RangeError(`${key} must be positive and finite`);
  }
  if (settings.reversalPct >= 100 || settings.drawdownPct >= 100) throw new RangeError('drawdownPct and reversalPct must be below 100');
  if (!Number.isSafeInteger(settings.confirmationDays) || settings.confirmationDays < 1) throw new RangeError('confirmationDays must be a positive integer');
  if (settings.neutralToleranceDays >= settings.maxAbsoluteShiftDays) throw new RangeError('neutralToleranceDays must be smaller than maxAbsoluteShiftDays');
  return settings;
}

function newEra(index, row) {
  return {
    index, halving: HALVINGS[index], peak: row, low: null,
    completeStart: row.date === HALVINGS[index].date, contiguous: true,
    peakRun: 0, reboundRun: 0, peakConfirmedAt: null, troughConfirmedAt: null, referenceCandidate: null,
  };
}

function closeEra(era, knownAt) {
  if (!era || !era.completeStart || !era.contiguous || !era.referenceCandidate) return null;
  const { peak, low, confirmedAt } = era.referenceCandidate;
  return {
    index: era.index, year: era.halving.year, halvingDate: era.halving.date,
    peak: observed(peak), trough: observed(low),
    bearDays: low.epochDay - peak.epochDay,
    knownAt, peakDrawdownConfirmedAt: confirmedAt, retrospectiveExtrema: true,
  };
}

function referenceStats(closed) {
  const peakIntervals = [];
  for (let index = 1; index < closed.length; index++) {
    const previous = closed[index - 1], current = closed[index];
    if (current.index !== previous.index + 1) continue;
    const nominalDate = shiftCalendarMonths(previous.peak.date, 48);
    peakIntervals.push({
      fromDate: previous.peak.date, toDate: current.peak.date,
      durationDays: utcDay(current.peak.date) - utcDay(previous.peak.date),
      deviationDays: utcDay(current.peak.date) - utcDay(nominalDate), knownAt: current.knownAt,
    });
  }
  return { peakIntervals, bearDurations: closed.map(item => item.bearDays) };
}

/**
 * O(n + n*k*log(k)) time, O(n+k) output memory; k <= 4 known halving eras.
 * With the explicit finite protocol-reference catalog this is O(n), not one
 * retrospective O(n) rescan per date. Unknown future halvings are not inserted.
 */
export function calibrateCycleTiming(input, options = {}) {
  const settings = settingsFor(options), raw = Array.isArray(input) ? input : input?.prices;
  if (!Array.isArray(raw) || !raw.length) throw new TypeError('A nonempty daily price series is required');
  const cutoff = options.asOf ?? (Array.isArray(raw.at(-1)) ? raw.at(-1)[0] : raw.at(-1).date);
  utcDay(cutoff);
  // Exclude future rows before validation/calculation; a future revision cannot
  // alter an earlier snapshot, including via a validation failure.
  const rows = validateDataset(raw.filter(row => (Array.isArray(row) ? row[0] : row.date) <= cutoff));
  const series = [], closed = [], alpha = 1 - 2 ** (-1 / settings.smoothingHalfLifeDays);
  let era = null, smoothed = 0, current = null, statistics = referenceStats(closed);
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index], previous = rows[index - 1];
    const eraIndex = HALVINGS.findLastIndex(item => item.date <= row.date);
    const contiguous = !previous || row.epochDay === previous.epochDay + 1;
    let resetReason = null;
    if (eraIndex >= 0 && era?.index !== eraIndex) {
      // A gap over the boundary cannot establish a fully observed closed era.
      const completed = contiguous ? closeEra(era, row.date) : null;
      if (completed) closed.push(completed);
      statistics = referenceStats(closed);
      era = newEra(eraIndex, row); smoothed = 0; resetReason = 'new-observed-halving-era';
    }
    if (era && !contiguous) {
      era.contiguous = false; era.peakRun = 0; era.reboundRun = 0;
      era.peakConfirmedAt = null; era.troughConfirmedAt = null;
      smoothed = 0; resetReason = 'missing-observation';
    }
    if (era && row.price > era.peak.price) {
      era.peak = row; era.low = null; era.peakRun = 0; era.reboundRun = 0;
      era.peakConfirmedAt = null; era.troughConfirmedAt = null;
      smoothed = 0; resetReason = 'new-observed-high';
    } else if (era && row.date > era.peak.date) {
      if (!era.low || row.price < era.low.price) {
        era.low = row; era.reboundRun = 0; era.troughConfirmedAt = null;
      }
      era.peakRun = row.price <= era.peak.price * (1 - settings.drawdownPct / 100) ? era.peakRun + 1 : 0;
      if (!era.peakConfirmedAt && era.peakRun >= settings.confirmationDays) era.peakConfirmedAt = row.date;
      if (era.peakConfirmedAt) era.referenceCandidate = { peak: era.peak, low: era.low, confirmedAt: era.peakConfirmedAt };
      era.reboundRun = era.peakConfirmedAt && row.price >= era.low.price * (1 + settings.reversalPct / 100) ? era.reboundRun + 1 : 0;
      if (!era.troughConfirmedAt && era.reboundRun >= settings.confirmationDays) era.troughConfirmedAt = row.date;
    }
    const available = Boolean(era?.completeStart && era.contiguous && era.peakConfirmedAt && closed.length);
    const deviations = statistics.peakIntervals.map(item => item.deviationDays);
    const lastClosed = closed.at(-1);
    if (available && lastClosed?.index === era.index - 1) {
      deviations.push(era.peak.epochDay - utcDay(shiftCalendarMonths(lastClosed.peak.date, 48)));
    }
    const peakWeight = deviations.length / (deviations.length + settings.priorEquivalentCycles);
    const bearWeight = closed.length / (closed.length + settings.priorEquivalentCycles);
    const observedBearDays = era?.low ? era.low.epochDay - era.peak.epochDay : null;
    const medianBearDays = median(statistics.bearDurations);
    const peakComponentDays = available && deviations.length ? peakWeight * median(deviations) : 0;
    const bearComponentDays = available && era.troughConfirmedAt ? bearWeight * (observedBearDays - medianBearDays) : 0;
    const rawShiftDays = available ? clamp(peakComponentDays + bearComponentDays, -settings.maxAbsoluteShiftDays, settings.maxAbsoluteShiftDays) : 0;
    if (available) smoothed += clamp(alpha * (rawShiftDays - smoothed), -settings.maxDailyShiftDays, settings.maxDailyShiftDays);
    else smoothed = 0;
    const appliedShiftDays = Math.round(smoothed), nominalPeakDate = era ? shiftCalendarMonths(era.peak.date, 48) : null;
    const nominalLengthDays = era ? utcDay(nominalPeakDate) - era.peak.epochDay : null;
    const state = !available ? 'insufficient' : appliedShiftDays < -settings.neutralToleranceDays ? 'shortened' : appliedShiftDays > settings.neutralToleranceDays ? 'lengthened' : 'aligned';
    const point = {
      date: row.date, epochDay: row.epochDay, state, ...CYCLE_CLOCK_STATES[state],
      shiftDays: smoothed, appliedShiftDays,
      cycleLengthDays: nominalLengthDays === null ? null : nominalLengthDays + appliedShiftDays,
      causal: true, probability: null,
    };
    series.push(point);
    // Full provenance is kept once for today's output, not duplicated n times.
    current = {
      ...point, asOf: row.date, available, rawShiftDays,
      referencePeakDate: era?.peak.date ?? null, referencePeakPrice: era?.peak.price ?? null,
      candidateTroughDate: era?.low?.date ?? null, candidateTroughPrice: era?.low?.price ?? null,
      peakConfirmedAt: era?.peakConfirmedAt ?? null, troughConfirmedAt: era?.troughConfirmedAt ?? null,
      candidateIsFinalCycleTurn: false, nominalPeakDate,
      expectedNextPeakDate: nominalPeakDate ? shifted(nominalPeakDate, appliedShiftDays) : null,
      nextPeakDateIsConditionalClock: true,
      referenceCount: closed.length, cycleIntervalCount: deviations.length,
      observedBearDays, medianBearDays, peakComponentDays, bearComponentDays,
      peakWeight, bearWeight, resetReason,
      unavailableReason: available ? null : !era ? 'no-observed-halving'
        : !era.completeStart || !era.contiguous ? 'incomplete-current-era'
          : !closed.length ? 'no-complete-reference-era' : 'persistent-drawdown-not-confirmed',
      sensitivity: {
        lowerShiftDays: available ? Math.min(0, appliedShiftDays, rawShiftDays) : 0,
        upperShiftDays: available ? Math.max(0, appliedShiftDays, rawShiftDays) : 0,
        meaning: 'Sensitivity spanning the unadjusted calendar prior, current smoothed correction and current raw rule. It is not a prediction interval.',
        probability: null, calibrated: false,
      },
    };
  }
  return {
    version: CYCLE_CALIBRATION_VERSION, asOf: rows.at(-1).date,
    available: current.available, current, series,
    closedReferences: closed, settings: Object.fromEntries(Object.keys(CYCLE_CALIBRATION_DEFAULTS).map(key => [key, settings[key]])),
    method: {
      referenceRule: 'The last running high with a persistent deep drawdown, and its following running low, in a fully observed halving-to-halving era become eligible only on its next observed halving. A newer unconfirmed high cannot replace this historical episode; no chosen peak years.',
      confirmationRule: `${settings.drawdownPct}% drawdown / ${settings.reversalPct}% rebound, ${settings.confirmationDays} consecutive observed daily closes; final cycle turns remain unconfirmed.`,
      rawFormula: 'clip(w_peak × median(peak-to-peak deviation from 48 calendar months) + w_bear × (current confirmed-candidate bear duration − median closed bear duration), −maxShift, maxShift)',
      shrinkageFormula: 'w = n / (n + priorEquivalentCycles); three prior-equivalent observations favor zero shift by default.',
      smoothingFormula: 's_t = s_(t−1) + clip((1−2^(−1/halfLife)) × (raw_t−s_(t−1)), −dailyLimit, dailyLimit)',
      stabilityReset: 'A new observed high, missing observation or newly observed halving resets the origin and smoothing; fixed-origin daily changes are bounded.',
      phaseTransferAssumption: 'A deviation in the candidate bear duration shifts the conditional next high by the same shrunk number of days. This is a chosen phase-transfer rule, not an estimated causal law.',
      parametersFittedToFuture: false, modelChoicesAreAssumed: true,
      colorsAreTradingSignals: false, colorToleranceDays: settings.neutralToleranceDays,
      probability: null, calibrated: false, historicalForecastAccuracyClaim: false,
      earlierRowsRecomputedFromLaterData: false,
      complexity: 'O(n) for the fixed catalog of observed halvings; O(n) output memory. One forward scan, no prefix recomputation.',
    },
    sources: [
      'https://otexts.com/fpp3/tscv.html',
      'https://otexts.com/fpp3/holt.html',
      'https://www.fidelity.com/learning-center/trading-investing/four-year-bitcoin-and-crypto-cycles',
      'https://fidelitydigitalassets.com/research-and-insights/bitcoins-four-year-cycle-over',
    ],
  };
}

/** Small, reproducible daily artifact. The runtime series remains data-driven. */
export function cycleCalibrationSnapshot(input, options = {}) {
  const result = calibrateCycleTiming(input, options);
  return {
    version: result.version, asOf: result.asOf, current: result.current,
    settings: result.settings, closedReferences: result.closedReferences,
    method: result.method, sources: result.sources,
    observationCount: result.series.length,
  };
}

/**
 * Retrospective audit on fixed quarterly origins. Outcomes enter scoring only;
 * each prediction is re-created from its own prefix. Several origins predict
 * the same eventual peak and are explicitly NOT independent cycle trials.
 */
export function evaluateCycleCalibration(input, { origins = [
  '2018-03-31', '2018-06-30', '2018-09-30', '2018-12-31',
  '2019-03-31', '2019-06-30', '2019-09-30', '2019-12-31',
  '2022-03-31', '2022-06-30', '2022-09-30', '2022-12-31',
  '2023-03-31', '2023-06-30', '2023-09-30', '2023-12-31',
], asOf } = {}) {
  const complete = calibrateCycleTiming(input, { asOf }), records = [], excluded = [];
  for (const origin of origins) {
    utcDay(origin);
    if (origin > complete.asOf) { excluded.push({ origin, reason: 'origin-not-observed' }); continue; }
    const atOrigin = calibrateCycleTiming(input, { asOf: origin });
    const eraIndex = HALVINGS.findLastIndex(item => item.date <= origin);
    const outcome = complete.closedReferences.find(item => item.index === eraIndex + 1);
    if (!atOrigin.current.available) { excluded.push({ origin, reason: 'timing-unavailable-at-origin' }); continue; }
    if (!outcome) { excluded.push({ origin, reason: 'next-era-outcome-not-closed' }); continue; }
    const adjustedErrorDays = utcDay(atOrigin.current.expectedNextPeakDate) - utcDay(outcome.peak.date);
    const calendarErrorDays = utcDay(atOrigin.current.nominalPeakDate) - utcDay(outcome.peak.date);
    records.push({
      origin, trainingThrough: atOrigin.asOf,
      forecastDate: atOrigin.current.expectedNextPeakDate,
      baselineDate: atOrigin.current.nominalPeakDate,
      appliedShiftDays: atOrigin.current.appliedShiftDays,
      targetDate: outcome.peak.date, targetKnownAt: outcome.knownAt,
      adjustedErrorDays, calendarErrorDays,
      referenceCountAtOrigin: atOrigin.current.referenceCount,
    });
  }
  const average = key => records.length ? records.reduce((total, row) => total + Math.abs(row[key]), 0) / records.length : null;
  return {
    version: CYCLE_CALIBRATION_VERSION, asOf: complete.asOf, records, excluded,
    originCount: records.length, independentTargetCount: new Set(records.map(item => item.targetDate)).size,
    adjustedMaeDays: average('adjustedErrorDays'), calendarMaeDays: average('calendarErrorDays'),
    targetSelection: 'Next closed halving era’s last running high with persistent deep drawdown. Earlier or intracycle turns are not silently substituted as successes.',
    originSelection: 'Fixed quarterly 2018–2019 and 2022–2023 origins chosen for this retrospective audit; not historically preregistered or optimized.',
    futureOutcomesUsedInPrediction: false, settingsSelectedFromAuditScores: false,
    sufficientForPredictiveSuperiorityClaim: false,
    limitation: 'Overlapping origins, very few completed independent cycles, and a chosen cycle definition preclude a reliable accuracy or superiority claim.',
  };
}
