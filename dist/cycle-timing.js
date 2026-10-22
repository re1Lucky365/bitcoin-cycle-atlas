/**
 * Descriptive cycle timing, with separately identified causal daily signals.
 * Extrema and pairing a signal to an eventual low are retrospective selections.
 * No small-sample timing comparison here proves a predictive market law.
 */
import { DAY_MS, HALVINGS, utcDay, dateFromDay, validateDataset } from './cycle-engine.js?v=1.10.3';

const BASELINES = Object.freeze({ previous: [2020], recent2: [2016, 2020], all3: [2012, 2016, 2020] });
const PEAK_YEARS = [2013, 2017, 2021];
const MONTH_DAYS = 365.2425 / 12;
const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

export function shiftCalendarMonths(date, months) {
  utcDay(date);
  if (!Number.isSafeInteger(months)) throw new TypeError('Calendar month shift must be an integer');
  const [year, month, day] = date.split('-').map(Number);
  const first = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(day, lastDay));
  return first.toISOString().slice(0, 10);
}

export function calendarScenarioWindow(referenceDate, earliestMonths = 5, latestMonths = 3) {
  if (!Number.isInteger(earliestMonths) || !Number.isInteger(latestMonths) || earliestMonths < latestMonths || latestMonths < 0) {
    throw new TypeError('Scenario months must be nonnegative ordered integers');
  }
  return {
    referenceDate,
    startDate: shiftCalendarMonths(referenceDate, -earliestMonths),
    endDate: shiftCalendarMonths(referenceDate, -latestMonths),
    earlierMonths: [latestMonths, earliestMonths],
    scenarioOnly: true,
    description: 'Calendar arithmetic scenario; not a forecast or probability interval.',
  };
}

function positiveInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 1) throw new TypeError(`${name} must be a positive integer`);
}

/**
 * Prefix-causal detector. At day t every input is dated <= t.
 * MA transitions require p contiguous daily closes on the new side of the MA.
 * Rebounds require a 20% ATH drawdown persisting 14 days first, then p closes
 * >= (1 + reboundPct/100) times the running low known on each day.
 * A new observed ATH resets that drawdown episode. Gaps interrupt persistence.
 */
export function computeOnlineSignals(input, {
  maWindow = 200, persistence = 14, maType = 'geometric', reboundPct = 20,
  drawdownPct = 20, drawdownPersistence = 14,
} = {}) {
  positiveInteger(maWindow, 'maWindow'); positiveInteger(persistence, 'persistence');
  positiveInteger(drawdownPersistence, 'drawdownPersistence');
  if (!['geometric', 'arithmetic'].includes(maType)) throw new TypeError('Unsupported moving-average type');
  if (![reboundPct, drawdownPct].every((v) => Number.isFinite(v) && v > 0 && v < 100)) throw new TypeError('Thresholds must lie between 0 and 100 percent');
  const rows = validateDataset(input), trend = [], rebound = [];
  const logPrefix = [0], pricePrefix = [0];
  let state = 'unknown', pendingSide = null, sideRun = 0;
  let ath = -Infinity, peak = null, runningLow = null, drawdownRun = 0, bear = false, reboundRun = 0;
  let maValue = null, aboveMA = null;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i], contiguous = i === 0 || row.epochDay - rows[i - 1].epochDay === 1;
    logPrefix.push(logPrefix[i] + Math.log(row.price));
    pricePrefix.push(pricePrefix[i] + row.price);
    if (!contiguous) { sideRun = 0; pendingSide = null; state = 'unknown'; drawdownRun = 0; reboundRun = 0; }
    const hasWindow = i >= maWindow - 1 && row.epochDay - rows[i + 1 - maWindow].epochDay === maWindow - 1;
    maValue = hasWindow ? maType === 'geometric'
      ? Math.exp((logPrefix[i + 1] - logPrefix[i + 1 - maWindow]) / maWindow)
      : (pricePrefix[i + 1] - pricePrefix[i + 1 - maWindow]) / maWindow : null;
    if (maValue !== null && (!Number.isFinite(maValue) || maValue <= 0)) throw new RangeError('Invalid moving-average result');
    aboveMA = maValue === null ? null : row.price > maValue;
    const side = maValue === null || row.price === maValue ? null : aboveMA ? 'up' : 'down';
    if (side === null) { pendingSide = null; sideRun = 0; }
    else {
      sideRun = side === pendingSide ? sideRun + 1 : 1; pendingSide = side;
      if (sideRun >= persistence && state !== side) {
        trend.push({
          type: 'ma', direction: side, eventDate: rows[i - persistence + 1].date,
          confirmationDate: row.date, knownAt: row.date, price: row.price, maValue,
          earliestKnowableUtc: `${dateFromDay(row.epochDay + 1)}T00:00:00.000Z`,
          maType, maWindow, persistence, causal: true,
        });
        state = side;
      }
    }
    if (row.price > ath) {
      ath = row.price; peak = row; runningLow = row; drawdownRun = 0; bear = false; reboundRun = 0;
      continue;
    }
    if (row.price < runningLow.price) runningLow = row;
    drawdownRun = row.price <= ath * (1 - drawdownPct / 100) ? drawdownRun + 1 : 0;
    if (drawdownRun >= drawdownPersistence) bear = true;
    if (!bear) continue;
    reboundRun = row.price >= runningLow.price * (1 + reboundPct / 100) ? reboundRun + 1 : 0;
    if (reboundRun === persistence) rebound.push({
      type: 'running-low-rebound', direction: 'up', eventDate: rows[i - persistence + 1].date,
      confirmationDate: row.date, knownAt: row.date, price: row.price,
      earliestKnowableUtc: `${dateFromDay(row.epochDay + 1)}T00:00:00.000Z`,
      runningLowDate: runningLow.date, runningLowPrice: runningLow.price,
      episodePeakDate: peak.date, episodePeakPrice: peak.price,
      reboundPct, persistence, drawdownPct, drawdownPersistence, causal: true,
    });
  }
  return {
    trend, rebound,
    current: {
      asOf: rows.at(-1).date,
      state, maValue, aboveMA, maType, maWindow, persistence,
      lastTransition: trend.at(-1) ?? null,
      bearEpisodeActive: bear,
      observedATH: ath,
      episodePeakDate: peak?.date ?? null,
      runningLowIsPostPeak: Boolean(runningLow && peak && runningLow.date > peak.date && runningLow.price < peak.price),
      runningLowDate: runningLow && peak && runningLow.date > peak.date && runningLow.price < peak.price ? runningLow.date : null,
      runningLowPrice: runningLow && peak && runningLow.date > peak.date && runningLow.price < peak.price ? runningLow.price : null,
    },
  };
}

function extreme(rows, start, end, maximum) {
  let selected = null;
  for (const row of rows) if (row.date >= start && row.date <= end && (!selected || (maximum ? row.price > selected.price : row.price < selected.price))) selected = row;
  return selected;
}

function signalForCycle(signal, halving, trough) {
  if (!signal) return null;
  return {
    ...signal,
    dayAfterHalving: utcDay(signal.confirmationDate) - utcDay(halving),
    eventDayAfterHalving: utcDay(signal.eventDate) - utcDay(halving),
    daysAfterTrough: utcDay(signal.confirmationDate) - utcDay(trough),
    pairingIsRetrospective: true,
  };
}

function pairConfirmations(cycle, signals) {
  // No post-peak loss has been observed on a fresh high. The high itself cannot
  // stand in for a trough or be paired with an earlier recovery signal.
  if (!cycle.trough) return { gmaUp: null, reboundUp: null, gmaDown: null };
  const inWindow = (signal) => signal.eventDate > cycle.trough.date && signal.confirmationDate <= cycle.windowEnd;
  const up = signals.trend.find((signal) => signal.direction === 'up' && inWindow(signal));
  const reb = signals.rebound.find(inWindow);
  const down = signals.trend.find((signal) => signal.direction === 'down' && signal.eventDate > cycle.peak.date && signal.confirmationDate <= cycle.windowEnd);
  return {
    gmaUp: signalForCycle(up, cycle.halvingDate, cycle.trough.date),
    reboundUp: signalForCycle(reb, cycle.halvingDate, cycle.trough.date),
    gmaDown: signalForCycle(down, cycle.halvingDate, cycle.trough.date),
  };
}

function evaluateSignals(rows, cycles, signals, family) {
  const records = [];
  for (const cycle of cycles) {
    for (const signal of signals.filter((signal) => signal.direction === 'up' && signal.confirmationDate > cycle.peak.date && signal.confirmationDate <= cycle.windowEnd)) {
      const floor = extreme(rows, cycle.peak.date, signal.confirmationDate, false);
      const later = rows.find((row) => row.date > signal.confirmationDate && row.date <= cycle.windowEnd && row.price < floor.price);
      records.push({
        family, cycleYear: cycle.year, eventDate: signal.eventDate, confirmationDate: signal.confirmationDate,
        floorAtConfirmationDate: floor.date, floorAtConfirmationPrice: floor.price,
        invalidatedAt: later?.date ?? null,
        subsequentLowerLow: Boolean(later),
        daysToInvalidation: later ? later.epochDay - utcDay(signal.confirmationDate) : null,
        followupDays: utcDay(cycle.windowEnd) - utcDay(signal.confirmationDate),
        windowClosedByHalving: !cycle.current,
        interpretation: later ? 'A later observed lower low invalidated a final-bottom interpretation.' : cycle.current ? 'No lower low observed yet; right-censored.' : 'No lower low before the next halving.',
      });
    }
  }
  return records;
}

function cycleMetrics(cycle) {
  return {
    peak: cycle.peak.dayAfterHalving,
    trough: cycle.trough?.dayAfterHalving ?? null,
    bear: cycle.trough?.daysAfterPeak ?? null,
    gmaDown: cycle.confirmations.gmaDown?.dayAfterHalving ?? null,
    gmaUp: cycle.confirmations.gmaUp?.dayAfterHalving ?? null,
    reboundUp: cycle.confirmations.reboundUp?.dayAfterHalving ?? null,
    gmaUpAfterTrough: cycle.confirmations.gmaUp?.daysAfterTrough ?? null,
    reboundUpAfterTrough: cycle.confirmations.reboundUp?.daysAfterTrough ?? null,
  };
}

function aggregateBaseline(cycles, current, years) {
  const selected = cycles.filter((cycle) => years.includes(cycle.year));
  const currentMetrics = cycleMetrics(current), metrics = {};
  for (const key of Object.keys(currentMetrics)) {
    const values = selected.map((cycle) => cycleMetrics(cycle)[key]).filter((value) => value !== null);
    const center = median(values), currentDays = currentMetrics[key];
    metrics[key] = {
      historicalValues: values, n: values.length,
      medianDays: center, meanDays: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null,
      minDays: values.length ? Math.min(...values) : null, maxDays: values.length ? Math.max(...values) : null,
      currentDays,
      leadDays: center !== null && currentDays !== null ? center - currentDays : null,
      leadMonthsApprox: center !== null && currentDays !== null ? (center - currentDays) / MONTH_DAYS : null,
    };
  }
  return { years, sampleSize: selected.length, center: 'median', metrics };
}

/** Main descriptive analysis. asOf truncates all inputs before any calculation. */
export function analyzeCycleTiming(input, {
  asOf, baseline = 'recent2', maWindow = 200, persistence = 14, reboundPct = 20,
  includeSensitivity = true,
} = {}) {
  if (!(baseline in BASELINES)) throw new TypeError('Unknown timing baseline');
  if (asOf !== undefined) utcDay(asOf);
  const allRows = validateDataset(input);
  const rows = asOf ? allRows.filter((row) => row.date <= asOf) : allRows;
  if (!rows.length || rows.at(-1).date < HALVINGS.at(-1).date) throw new Error('Timing analysis requires observed data in the 2024 halving cycle');
  const latest = rows.at(-1), signals = computeOnlineSignals(rows, { maWindow, persistence, reboundPct });
  const cycles = HALVINGS.map((halving, index) => {
    const current = index === HALVINGS.length - 1;
    const windowEnd = current ? latest.date : dateFromDay(utcDay(HALVINGS[index + 1].date) - 1);
    const peak = current ? extreme(rows, halving.date, latest.date, true)
      : extreme(rows, `${PEAK_YEARS[index]}-01-01`, `${PEAK_YEARS[index]}-12-31`, true);
    if (!peak) throw new Error(`Historical reference peak unavailable for cycle ${halving.year}`);
    const lowerObservation = extreme(rows, dateFromDay(peak.epochDay + 1), windowEnd, false);
    const trough = lowerObservation && lowerObservation.price < peak.price ? lowerObservation : null;
    if (!current && !trough) throw new Error(`Observed trough unavailable for historical cycle ${halving.year}`);
    const cycle = {
      year: halving.year, halvingDate: halving.date, current, windowEnd,
      peak: {
        date: peak.date, price: peak.price, dayAfterHalving: peak.epochDay - utcDay(halving.date),
        annualYear: current ? null : PEAK_YEARS[index], provisional: current,
        selection: current ? 'Maximum observed since the 2024 halving; may change with new observations.' : `Explicit reference-year maximum: ${PEAK_YEARS[index]}.`,
        retrospective: true,
      },
      troughAvailable: Boolean(trough),
      availability: {
        trough: Boolean(trough),
        reason: trough ? null : 'No observation after the latest peak has a lower price; a post-peak trough is not yet observed.',
      },
      trough: trough ? {
        date: trough.date, price: trough.price, dayAfterHalving: trough.epochDay - utcDay(halving.date),
        daysAfterPeak: trough.epochDay - peak.epochDay, provisional: current, windowEnd,
        retrospective: true,
      } : null,
    };
    cycle.confirmations = pairConfirmations(cycle, signals);
    return cycle;
  });
  const currentCycle = cycles.at(-1), previous = cycles.at(-2);
  const baselines = Object.fromEntries(Object.entries(BASELINES).map(([key, years]) => [key, aggregateBaseline(cycles, currentCycle, years)]));
  const projectedPeakDate = shiftCalendarMonths(previous.peak.date, 48);
  const projectedTroughDate = shiftCalendarMonths(previous.trough.date, 48);
  const peakAdvanceDays = utcDay(projectedPeakDate) - utcDay(currentCycle.peak.date);
  const troughAdvanceDays = currentCycle.trough ? utcDay(projectedTroughDate) - utcDay(currentCycle.trough.date) : null;
  const projectedBearDurationDays = utcDay(projectedTroughDate) - utcDay(projectedPeakDate);
  const shortening = currentCycle.trough ? projectedBearDurationDays - currentCycle.trough.daysAfterPeak : null;
  const previousHalvingProjection = dateFromDay(utcDay(currentCycle.halvingDate) + previous.trough.dayAfterHalving);
  const falseSignals = {
    gma: evaluateSignals(rows, cycles, signals.trend, 'gma'),
    rebound: evaluateSignals(rows, cycles, signals.rebound, 'rebound'),
  };
  falseSignals.counts = Object.fromEntries(Object.entries(BASELINES).map(([key, years]) => [key, Object.fromEntries(['gma', 'rebound'].map((family) => {
    const events = falseSignals[family].filter((signal) => years.includes(signal.cycleYear));
    return [family, { signals: events.length, subsequentLowerLows: events.filter((signal) => signal.subsequentLowerLow).length }];
  }))]));
  const sensitivity = [];
  if (includeSensitivity) for (const maType of ['geometric', 'arithmetic']) {
    for (const window of maType === 'geometric' ? [150, 200, 250] : [200]) {
      for (const days of [7, 14, 30]) {
        const alternative = computeOnlineSignals(rows, { maWindow: window, persistence: days, maType, reboundPct });
        const alternativeCycles = cycles.map((cycle) => ({ ...cycle, confirmations: pairConfirmations(cycle, alternative) }));
        const summary = aggregateBaseline(alternativeCycles, alternativeCycles.at(-1), BASELINES[baseline]);
        sensitivity.push({
          maType, maWindow: window, persistence: days,
          currentEventDate: alternativeCycles.at(-1).confirmations.gmaUp?.eventDate ?? null,
          currentConfirmationDate: alternativeCycles.at(-1).confirmations.gmaUp?.confirmationDate ?? null,
          halvingToUpLeadDays: summary.metrics.gmaUp.leadDays,
          troughToUpLeadDays: summary.metrics.gmaUpAfterTrough.leadDays,
          halvingToDownLeadDays: summary.metrics.gmaDown.leadDays,
          notIndependentSamples: true,
        });
      }
    }
  }
  return {
    asOf: latest.date,
    source: Array.isArray(input) ? {} : { source: input.meta?.source, sourceName: input.meta?.sourceName, retrievedAt: input.meta?.retrievedAt },
    selectedBaseline: baseline,
    cycles, baselines,
    current: {
      year: currentCycle.year, halvingDate: currentCycle.halvingDate,
      peak: currentCycle.peak, troughCandidate: currentCycle.trough,
      troughAvailable: currentCycle.troughAvailable,
      availability: currentCycle.availability,
      latestPrice: latest.price,
      reboundPct: currentCycle.trough ? (latest.price / currentCycle.trough.price - 1) * 100 : null,
      drawdownFromPeakPct: (latest.price / currentCycle.peak.price - 1) * 100,
      daysSinceLow: currentCycle.trough ? latest.epochDay - utcDay(currentCycle.trough.date) : null,
      daysSinceHalving: latest.epochDay - utcDay(currentCycle.halvingDate),
      confirmations: currentCycle.confirmations,
      regime: signals.current,
    },
    advances: {
      calendarFourYear: {
        previousPeakDate: previous.peak.date, previousTroughDate: previous.trough.date,
        projectedPeakDate, projectedTroughDate, peakAdvanceDays, previousPeakShiftDays: peakAdvanceDays,
        previousBearDurationDays: previous.trough.daysAfterPeak,
        projectedBearDurationDays, currentBearDurationDays: currentCycle.trough?.daysAfterPeak ?? null,
        bearDurationShorteningDays: shortening, troughAdvanceDays,
        identityCheck: currentCycle.trough ? peakAdvanceDays + shortening === troughAdvanceDays : null,
        identity: 'trough advance = peak advance + shortening of the projected peak-to-trough interval',
      },
      bearMedian: { priorYears: BASELINES[baseline], medianDays: baselines[baseline].metrics.bear.medianDays, advanceDays: baselines[baseline].metrics.bear.leadDays },
      halvingTiming: {
        peakLeadDays: baselines[baseline].metrics.peak.leadDays,
        troughLeadDays: baselines[baseline].metrics.trough.leadDays,
        gmaUpLeadDays: baselines[baseline].metrics.gmaUp.leadDays,
        reboundUpLeadDays: baselines[baseline].metrics.reboundUp.leadDays,
      },
    },
    scenarios: {
      previousTroughCalendarFourYears: calendarScenarioWindow(projectedTroughDate),
      previousTroughHalvingRelative: calendarScenarioWindow(previousHalvingProjection),
      currentCandidateInsideCalendarWindow: currentCycle.trough ? currentCycle.trough.date >= shiftCalendarMonths(projectedTroughDate, -5) && currentCycle.trough.date <= shiftCalendarMonths(projectedTroughDate, -3) : null,
    },
    falseSignals, sensitivity,
    methodology: {
      observationsAreDailyUTC: true,
      dateMeaning: 'eventDate, confirmationDate and knownAt are UTC observation-day labels. A completed daily confirmation cannot be known before earliestKnowableUtc (the following UTC midnight); actual provider publication may be later. regime.asOf is the latest observed day, whereas lastTransition is the most recent confirmed transition.',
      gapPolicy: 'Missing dates are not filled; persistence and moving-average windows require contiguous days.',
      currentPeakRule: 'Maximum observed from the 2024 halving through asOf, not a fixed annual maximum.',
      troughAvailabilityRule: 'A trough requires a strictly later observation with price strictly below the selected peak. Without one, trough-dependent statistics and comparisons are unavailable (null), not zero.',
      historicalPeakRule: 'Explicit annual maxima in 2013, 2017 and 2021; selection is retrospective.',
      signalCausality: 'Each detector uses only observations available through its confirmationDate.',
      pairingCaveat: 'Selecting the first signal after the eventual observed trough is retrospective; earlier invalidated signals are retained separately.',
      rightCensoring: 'The current minimum and recovery are provisional; a later lower low changes the trough date and every dependent timing comparison.',
      statisticalLimit: 'Only 1, 2 or 3 prior cycles. Parameter variants share the same observations and are not independent samples. No predictive p-value is claimed.',
      approximateMonthDays: MONTH_DAYS,
    },
  };
}
