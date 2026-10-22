/**
 * Retrospective near-peak timing and descriptive plateau statistics.
 * A threshold based on an annual/eventual observed maximum is not knowable
 * at its first historical crossing. Persistence does not remove that bias.
 */
import { utcDay, dateFromDay, validateDataset } from './cycle-engine.js?v=1.10.3';
import { analyzeCycleTiming, shiftCalendarMonths } from './cycle-timing.js?v=1.10.3';

const MONTH_DAYS = 365.2425 / 12;
const BASELINES = Object.freeze({ previous: [2020], recent2: [2016, 2020], all3: [2012, 2016, 2020] });
// 93% is deliberately retained: the 2021 spring high was 93.9354% of its
// November reference peak, so reporting only 94% and 95% hides a discontinuity.
const SENSITIVITY_THRESHOLDS = Object.freeze([.90, .93, .94, .95, .98]);

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function sampleStandardDeviation(values) {
  if (values.length < 2) return null;
  const average = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1));
}

function maximum(rows) {
  return rows.reduce((best, row) => !best || row.price > best.price ? row : best, null);
}

function event(row, cycle) {
  if (!row) return null;
  return {
    date: row.date, price: row.price,
    dayAfterHalving: row.epochDay - utcDay(cycle.halvingDate),
    daysBeforePeak: utcDay(cycle.peak.date) - row.epochDay,
    retrospective: true,
  };
}

function windowStatistics(rows, thresholdPrice) {
  if (!rows.length) return null;
  let runningPeak = rows[0], ddPeak = rows[0], ddTrough = rows[0], maxDrawdown = 0;
  let above = 0, aboveRun = 0, belowRun = 0, longestAboveRunDays = 0, longestBelowRunDays = 0;
  let minimum = rows[0], completeDailyWindow = true;
  const returns = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const contiguous = i === 0 || row.epochDay - rows[i - 1].epochDay === 1;
    if (!contiguous) { aboveRun = 0; belowRun = 0; completeDailyWindow = false; }
    if (i > 0 && contiguous) returns.push(Math.log(row.price) - Math.log(rows[i - 1].price));
    if (row.price > runningPeak.price) runningPeak = row;
    if (row.price < minimum.price) minimum = row;
    const drawdown = row.price / runningPeak.price - 1;
    if (drawdown < maxDrawdown) { maxDrawdown = drawdown; ddPeak = runningPeak; ddTrough = row; }
    if (row.price >= thresholdPrice) { above++; aboveRun++; belowRun = 0; }
    else { belowRun++; aboveRun = 0; }
    longestAboveRunDays = Math.max(longestAboveRunDays, aboveRun);
    longestBelowRunDays = Math.max(longestBelowRunDays, belowRun);
  }
  const vol = sampleStandardDeviation(returns), high = maximum(rows);
  return {
    startDate: rows[0].date, endDate: rows.at(-1).date,
    observations: rows.length, elapsedDays: rows.at(-1).epochDay - rows[0].epochDay,
    completeDailyWindow, aboveThresholdDays: above, occupancyPct: above / rows.length * 100,
    maxDrawdownPct: maxDrawdown * 100,
    maxDrawdown: { peakDate: ddPeak.date, troughDate: ddTrough.date },
    longestAboveRunDays, longestBelowRunDays,
    returnPct: (rows.at(-1).price / rows[0].price - 1) * 100,
    annualizedVolatilityPct: vol === null ? null : vol * Math.sqrt(365) * 100,
    dailyReturnObservations: returns.length,
    minimum: { date: minimum.date, price: minimum.price },
    maximum: { date: high.date, price: high.price },
    rangePctOfMinimum: (high.price / minimum.price - 1) * 100,
  };
}

function sustainedConfirmation(rows, thresholdPrice, cycle, required = 5, window = 7) {
  for (let i = window - 1; i < rows.length; i++) {
    // Seven observations must span seven calendar days; a missing day cannot
    // count toward the persistence condition or be silently interpolated.
    if (rows[i].epochDay - rows[i - window + 1].epochDay !== window - 1) continue;
    const sample = rows.slice(i - window + 1, i + 1);
    const qualifying = sample.filter((row) => row.price >= thresholdPrice);
    if (qualifying.length < required) continue;
    return {
      ...event(rows[i], cycle), confirmationDate: rows[i].date,
      firstQualifyingDate: qualifying[0].date,
      earliestKnowableUtc: `${dateFromDay(rows[i].epochDay + 1)}T00:00:00.000Z`,
      qualifyingDays: qualifying.length, requiredDays: required, windowDays: window,
      retrospectiveThreshold: true, causal: false,
    };
  }
  return null;
}

function terminalEpisode(rows, thresholdPrice, cycle, maxGapDays) {
  let segment = 0;
  const above = [];
  for (let i = 0; i < rows.length; i++) {
    if (i > 0 && rows[i].epochDay - rows[i - 1].epochDay !== 1) segment++;
    if (rows[i].price >= thresholdPrice) above.push({ ...rows[i], segment });
  }
  let first = above.length - 1;
  for (let i = above.length - 2; i >= 0; i--) {
    if (above[i].segment !== above[i + 1].segment || above[i + 1].epochDay - above[i].epochDay - 1 > maxGapDays) break;
    first = i;
  }
  const start = above[first], count = above.length - first;
  return {
    maxGapDays, startDate: start.date, endDate: cycle.peak.date,
    dayAfterHalving: start.epochDay - utcDay(cycle.halvingDate),
    daysBeforePeak: utcDay(cycle.peak.date) - start.epochDay,
    aboveThresholdDays: count,
    occupancyPct: count / (utcDay(cycle.peak.date) - start.epochDay + 1) * 100,
    gapPolicy: 'Intervening observed below-threshold calendar days; a missing observation always separates episodes.',
  };
}

function describeCycle(rows, cycle, threshold) {
  const prePeak = rows.filter((row) => row.date >= cycle.halvingDate && row.date <= cycle.peak.date);
  const thresholdPrice = threshold * cycle.peak.price;
  const first = prePeak.find((row) => row.price >= thresholdPrice);
  const zoneRows = prePeak.filter((row) => row.date >= first.date);
  const peakDay = utcDay(cycle.peak.date);
  const ninetyDays = rows.filter((row) => row.epochDay >= peakDay - 90 && row.epochDay <= peakDay);
  return {
    year: cycle.year, peakYear: Number(cycle.peak.date.slice(0, 4)), halvingDate: cycle.halvingDate,
    current: cycle.current, windowEnd: cycle.windowEnd, peak: cycle.peak,
    threshold, thresholdPrice,
    firstEntry: event(first, cycle),
    sustained5of7: sustainedConfirmation(prePeak, thresholdPrice, cycle),
    sustained14consecutive: sustainedConfirmation(prePeak, thresholdPrice, cycle, 14, 14),
    zoneStats: windowStatistics(zoneRows, thresholdPrice),
    prePeak90Days: windowStatistics(ninetyDays, thresholdPrice),
    terminalEpisodes: [0, 7, 14, 30].map((gap) => terminalEpisode(prePeak, thresholdPrice, cycle, gap)),
  };
}

function comparison(cycles, years, field) {
  const historical = cycles.filter((cycle) => years.includes(cycle.year));
  const get = (cycle) => field === 'absolutePeak' ? cycle.peak.dayAfterHalving : cycle[field]?.dayAfterHalving ?? null;
  const values = historical.map(get).filter((value) => value !== null);
  const currentDays = get(cycles.at(-1)), medianDays = median(values);
  const leadDays = medianDays !== null && currentDays !== null ? medianDays - currentDays : null;
  return {
    historicalValues: values, historicalYears: historical.map((cycle) => cycle.year),
    n: values.length, eligibleHistoricalCycles: historical.length,
    medianDays, currentDays, leadDays,
    leadMonthsApprox: leadDays === null ? null : leadDays / MONTH_DAYS,
  };
}

function calendarComparison(cycles) {
  const previous = cycles.at(-2), current = cycles.at(-1);
  const firstEntryReferenceDate = shiftCalendarMonths(previous.firstEntry.date, 48);
  const absolutePeakReferenceDate = shiftCalendarMonths(previous.peak.date, 48);
  return {
    firstEntryReferenceDate,
    firstEntryAdvanceDays: utcDay(firstEntryReferenceDate) - utcDay(current.firstEntry.date),
    absolutePeakReferenceDate,
    absolutePeakAdvanceDays: utcDay(absolutePeakReferenceDate) - utcDay(current.peak.date),
    basis: 'Same previous-cycle event plus 48 calendar months; distinct from elapsed days since each halving.',
  };
}

/**
 * Analyze a selected first-entry threshold, retaining the alternatives that
 * make the conclusion sensitive. All data is truncated before any extremum.
 * Units: prices USD, all properties ending in Pct in percentage points.
 */
export function analyzePeakZones(input, { threshold = .95, baseline = 'recent2', asOf } = {}) {
  if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 1) throw new TypeError('Peak-zone threshold must be greater than 0 and at most 1');
  if (!(baseline in BASELINES)) throw new TypeError('Unknown peak-zone baseline');
  const timing = analyzeCycleTiming(input, { asOf, baseline, includeSensitivity: false });
  const rows = validateDataset(input).filter((row) => row.date <= timing.asOf);
  const latest = rows.at(-1), years = BASELINES[baseline];
  const cycles = timing.cycles.map((cycle) => describeCycle(rows, cycle, threshold));
  const currentCycle = cycles.at(-1), oldCycle = cycles.at(-2);
  const troughCandidate = timing.current.troughCandidate;
  const peakAgeDays = latest.epochDay - utcDay(currentCycle.peak.date);
  const current = {
    ...currentCycle,
    latestPrice: latest.price, peakAgeDays, troughCandidate,
    daysPeakToLow: troughCandidate?.daysAfterPeak ?? null,
    daysSinceLow: timing.current.daysSinceLow,
    currentDrawdownPct: timing.current.drawdownFromPeakPct,
    maxObservedDrawdownPct: troughCandidate ? (troughCandidate.price / currentCycle.peak.price - 1) * 100 : null,
    recoveryToPeakPct: (currentCycle.peak.price / latest.price - 1) * 100,
    reboundFromLowPct: timing.current.reboundPct,
    regime: timing.current.regime,
    durationIdentity: {
      peakAgeDays, daysPeakToLow: troughCandidate?.daysAfterPeak ?? null,
      daysSinceLow: timing.current.daysSinceLow,
      holds: troughCandidate ? peakAgeDays === troughCandidate.daysAfterPeak + timing.current.daysSinceLow : null,
    },
  };
  const sensitivity = SENSITIVITY_THRESHOLDS.map((q) => {
    const variants = q === threshold ? cycles : timing.cycles.map((cycle) => describeCycle(rows, cycle, q));
    const measure = comparison(variants, years, 'firstEntry');
    const calendar = calendarComparison(variants);
    return {
      threshold: q,
      cycleEntries: variants.map((cycle) => ({ year: cycle.year, ...cycle.firstEntry })),
      currentDate: variants.at(-1).firstEntry.date,
      currentDayAfterHalving: variants.at(-1).firstEntry.dayAfterHalving,
      medianDays: measure.medianDays, n: measure.n,
      leadDays: measure.leadDays, leadMonthsApprox: measure.leadMonthsApprox,
      calendarLeadDays: calendar.firstEntryAdvanceDays,
      currentSustained5of7: variants.at(-1).sustained5of7,
      sameUnderlyingObservations: true,
    };
  });
  const july = maximum(rows.filter((row) => row.date >= '2025-07-01' && row.date <= '2025-07-31'));
  const spring = maximum(rows.filter((row) => row.date >= '2021-01-01' && row.date <= '2021-05-31'));
  const currentReference = timing.cycles.at(-1);
  const first90 = describeCycle(rows, currentReference, .90);
  const first95 = threshold === .95 ? currentCycle : describeCycle(rows, currentReference, .95);
  return {
    asOf: timing.asOf, threshold, baseline, retrospective: true,
    cycles, current,
    comparison: Object.fromEntries(['firstEntry', 'sustained5of7', 'absolutePeak'].map((field) => [field, comparison(cycles, years, field)])),
    calendarFourYear: calendarComparison(cycles),
    sensitivity,
    july2025: july ? {
      date: july.date, price: july.price, pctOfPeak: july.price / currentCycle.peak.price * 100,
      remainingUpsidePct: (currentCycle.peak.price / july.price - 1) * 100,
      daysBeforePeak: utcDay(currentCycle.peak.date) - july.epochDay,
      referencePeakDate: currentCycle.peak.date, referencePeakProvisional: true,
    } : null,
    spring2021: spring ? {
      date: spring.date, price: spring.price, pctOfPeak: spring.price / oldCycle.peak.price * 100,
      referencePeakDate: oldCycle.peak.date,
    } : null,
    plateau2025: {
      calendarJulyToPeak: windowStatistics(rows.filter((row) => row.date >= '2025-07-01' && row.date <= currentCycle.peak.date), threshold * currentCycle.peak.price),
      first90ToPeak: first90.zoneStats, first95ToPeak: first95.zoneStats,
    },
    methodology: {
      priceConvention: 'Coin Metrics PriceUSD UTC end-of-day price; not an exchange intraday high.',
      firstEntry: 'First close on or after the halving with P(t) >= threshold × selected reference peak, searched only through that peak day.',
      persistence: 'The first 7 consecutive calendar days containing at least 5 qualifying closes; the date is the confirming close. Missing days interrupt the window.',
      occupancy: 'Qualifying observed closes divided by all observed closes from first entry through peak, both endpoints included. Gaps are disclosed.',
      volatility: 'Sample standard deviation of adjacent one-calendar-day log returns, multiplied by sqrt(365). The 90-day window normally contains 91 closes and 90 returns.',
      historicalPeakRule: timing.methodology.historicalPeakRule,
      currentPeakRule: timing.methodology.currentPeakRule,
      positiveLeadMeaning: 'Historical median halving-to-event days minus current days; positive means current event was earlier.',
      approximateMonthDays: MONTH_DAYS,
      noProbabilityEstimate: true,
    },
    warnings: [
      '최종 관측 고점을 분모로 한 고점권 진입은 사후 계산입니다. 당시 최종 고점임을 알았다는 뜻이 아닙니다.',
      '현재 최고가와 저점은 관측 후보입니다. 새로운 최고가·저점이 나오면 날짜와 관련 계산이 바뀝니다.',
      '2021년 봄 최고 종가는 11월 최고 종가의 약 93.94%였습니다. 93%→94% 기준 변경으로 첫 진입 시기가 봄에서 가을로 바뀝니다.',
      '첫 진입, 7일 중 5일 유지, 마지막 고점 구간, 최고가 날짜는 서로 다른 사건입니다.',
      '고점 미회복 기간에는 저점 이후 반등 기간도 포함됩니다. 고점부터 저점까지의 하락 기간과 구분해야 합니다.',
      '과거 1~3개 회차와 여러 임계값은 동일 관측을 공유합니다. 고정된 주기 단축이나 예측 확률을 증명하지 않습니다.',
    ],
  };
}
