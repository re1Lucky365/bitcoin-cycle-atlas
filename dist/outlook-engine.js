import { HALVINGS, utcDay, dateFromDay, validateDataset } from './cycle-engine.js?v=1.10.5';
import { shiftCalendarMonths } from './cycle-timing.js?v=1.10.5';

/**
 * A conditional calendar-and-shape model, not a daily-return forecast.
 * UTC daily observations remain untouched. All generated curves start at asOf.
 * A is measured BACKWARD FROM THE NOMINAL PEAK, not from last cycle's zone entry.
 */
export const OUTLOOK_DEFAULTS = Object.freeze({
  asOf: '2026-10-20', referenceDate: '2026-10-21', referenceTimezone: 'Asia/Seoul',
  displayEnd: '2029-10-21', highZoneFraction: 0.95, priceGrowthRetention: 0.75,
  priceSensitivityPct: 25, bearDrawdownPct: 50, waveAmplitude: 0.06, waveCount: 4,
  arrivalLeadMonths: 3, dwellMonths: 3, stressBelowCandidatePct: 15, stressDelayMonths: 3,
});

export const OUTLOOK_SCENARIO_PRESETS = Object.freeze([
  Object.freeze({ id: 'base', label: '기본 · 3개월 먼저 도달 / 3개월 고점 형성', arrivalLeadMonths: 3, dwellMonths: 3, kind: 'bottom-holds' }),
  Object.freeze({ id: 'early-arrival-6', label: '6개월 먼저 도달 / 6개월 고점 형성', arrivalLeadMonths: 6, dwellMonths: 6, kind: 'bottom-holds' }),
  Object.freeze({ id: 'early-arrival-9', label: '9개월 먼저 도달 / 9개월 고점 형성', arrivalLeadMonths: 9, dwellMonths: 9, kind: 'bottom-holds' }),
  Object.freeze({ id: 'early-turn', label: '9개월 먼저 도달 / 5개월 형성 · 4개월 조기 전환', arrivalLeadMonths: 9, dwellMonths: 5, kind: 'bottom-holds' }),
  Object.freeze({ id: 'delayed', label: '3개월 먼저 도달 / 6개월 형성 · 3개월 지연 전환', arrivalLeadMonths: 3, dwellMonths: 6, kind: 'bottom-holds' }),
  Object.freeze({ id: 'stress', label: '저점 후보 이탈 후 재축적', arrivalLeadMonths: 3, dwellMonths: 3, kind: 'stress' }),
]);

const PEAK_YEARS = [2011, 2013, 2017, 2021, 2025];
const VALIDATION_CUTOFFS = ['2014-12-18', '2018-12-30'];
const VALIDATION_END = '2024-12-31';
const addDays = (date, days) => dateFromDay(utcDay(date) + days);
const plain = (row) => row ? { date: row.date, price: row.price } : null;
const mean = (values) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;

function numberIn(value, lo, hi, name, integer = false) {
  if (!Number.isFinite(value) || value < lo || value > hi || (integer && !Number.isSafeInteger(value))) {
    throw new RangeError(`${name} must be ${integer ? 'an integer ' : ''}in [${lo}, ${hi}]; received ${value}`);
  }
  return value;
}

function extreme(rows, start, end, maximum = true) {
  let answer = null;
  for (const row of rows) if (row.date >= start && row.date <= end && (!answer || (maximum ? row.price > answer.price : row.price < answer.price))) answer = row;
  return answer;
}

function prefix(input, asOf) {
  utcDay(asOf);
  const rows = validateDataset(input).filter((row) => row.date <= asOf);
  if (!rows.length) throw new RangeError('No observations available through asOf');
  return rows;
}

/**
 * Use one common nominal-peak anchor for both month shifts. Sequential shifts
 * can lose month-end days: May 31 -> Feb 28 -> May 28. This definition preserves
 * A=D => effectivePeak=nominalPeak, including leap years and month ends.
 */
export function computeOutlookTiming(referencePeakDate, { arrivalLeadMonths = 3, dwellMonths = 3 } = {}) {
  utcDay(referencePeakDate);
  numberIn(arrivalLeadMonths, -6, 12, 'arrivalLeadMonths', true);
  numberIn(dwellMonths, 0, 12, 'dwellMonths', true);
  const netShiftMonths = dwellMonths - arrivalLeadMonths;
  if (Math.abs(netShiftMonths) > 6) throw new RangeError('|dwellMonths - arrivalLeadMonths| must be <= 6; the input is not silently clamped');
  const nominalTroughDate = shiftCalendarMonths(referencePeakDate, 12);
  const nominalPeakDate = shiftCalendarMonths(referencePeakDate, 48);
  const zoneEntryDate = shiftCalendarMonths(nominalPeakDate, -arrivalLeadMonths);
  const effectivePeakDate = shiftCalendarMonths(nominalPeakDate, netShiftMonths);
  const nextLowDate = shiftCalendarMonths(effectivePeakDate, 12);
  if (zoneEntryDate > effectivePeakDate) throw new RangeError('Zone entry must not follow the effective peak');
  return {
    referencePeakDate, nominalTroughDate, nominalPeakDate,
    nominalNextTroughDate: shiftCalendarMonths(nominalPeakDate, 12),
    zoneEntryDate, effectivePeakDate, nextLowDate,
    arrivalLeadMonths, dwellMonths, netShiftMonths,
    actualLeadDays: utcDay(nominalPeakDate) - utcDay(zoneEntryDate),
    formationDays: utcDay(effectivePeakDate) - utcDay(zoneEntryDate),
    effectivePeakShiftDays: utcDay(effectivePeakDate) - utcDay(nominalPeakDate),
    nominalRiseMonths: 36, nominalDeclineMonths: 12,
    effectiveRiseFromNominalTroughMonths: 36 + netShiftMonths,
    nextDeclineMonths: 12,
    definition: 'A counts months backward from the nominal peak; D is the high-zone formation span, not uninterrupted time above the zone threshold.',
    monthEndConvention: 'Both entry and effective peak are shifted once from the common nominal peak; actual elapsed days are reported separately.',
    probability: null,
  };
}

function zoneObservation(rows, peak, startDate, fraction) {
  const thresholdPrice = peak.price * fraction;
  const entry = rows.find((row) => row.date >= startDate && row.date <= peak.date && row.price >= thresholdPrice);
  if (!entry) return null;
  const interval = rows.filter((row) => row.date >= entry.date && row.date <= peak.date);
  const inZone = interval.filter((row) => row.price >= thresholdPrice).length;
  let runningHigh = interval[0].price, maxDrawdownPct = 0;
  for (const row of interval) {
    runningHigh = Math.max(runningHigh, row.price);
    maxDrawdownPct = Math.max(maxDrawdownPct, (1 - row.price / runningHigh) * 100);
  }
  return {
    entryDate: entry.date, entryPrice: entry.price, fraction, thresholdPrice,
    daysBeforePeak: utcDay(peak.date) - utcDay(entry.date),
    observationsInInterval: interval.length, observationsAboveThreshold: inZone,
    occupancyPct: 100 * inZone / interval.length, maxWithinIntervalDrawdownPct: maxDrawdownPct,
    retrospective: true, denominator: 'eventual-observed-peak-within-asOf',
    continuousResidenceClaim: false,
  };
}

function context(input, options = {}) {
  const settings = { ...OUTLOOK_DEFAULTS, ...options };
  numberIn(settings.highZoneFraction, 0.8, 0.99, 'highZoneFraction');
  numberIn(settings.priceGrowthRetention, 0, 1.5, 'priceGrowthRetention');
  numberIn(settings.priceSensitivityPct, 0, 40, 'priceSensitivityPct');
  numberIn(settings.bearDrawdownPct, 10, 85, 'bearDrawdownPct');
  numberIn(settings.waveAmplitude, 0, 0.15, 'waveAmplitude');
  numberIn(settings.waveCount, 1, 8, 'waveCount', true);
  numberIn(settings.stressBelowCandidatePct, 1, 50, 'stressBelowCandidatePct');
  numberIn(settings.stressDelayMonths, 1, 6, 'stressDelayMonths', true);
  const rows = prefix(input, settings.asOf);
  const current = rows.at(-1);
  utcDay(settings.referenceDate); utcDay(settings.displayEnd);
  if (settings.referenceDate <= current.date) throw new RangeError('referenceDate must follow the latest completed UTC observation');
  if (settings.displayEnd <= current.date) throw new RangeError('displayEnd must follow the last observed date');
  if (utcDay(settings.displayEnd) - current.epochDay > 2200) throw new RangeError('This outlook supports at most 2200 forward daily steps');
  const halving = HALVINGS.findLast((event) => event.date <= current.date);
  if (!halving) throw new RangeError('An observed halving is needed to identify the current comparison episode');
  const peak = extreme(rows, halving.date, current.date);
  const trough = extreme(rows, addDays(peak.date, 1), current.date, false);
  if (!trough || trough.price >= peak.price) throw new RangeError('A post-peak low candidate is required; a new observed high needs a new outlook anchor');
  const previousPeakYear = PEAK_YEARS.filter((year) => year < Number(peak.date.slice(0, 4))).at(-1);
  const previousPeak = previousPeakYear ? extreme(rows, `${previousPeakYear}-01-01`, `${previousPeakYear}-12-31`) : null;
  if (!previousPeak) throw new RangeError('A prior comparison-cycle peak is needed for the default price sensitivity');
  const lastPeakMultiple = peak.price / previousPeak.price;
  if (!(lastPeakMultiple > 0 && Number.isFinite(lastPeakMultiple))) throw new RangeError('Invalid historical peak multiple');
  const defaultPeakPrice = peak.price * lastPeakMultiple ** settings.priceGrowthRetention;
  const peakMultiple = settings.peakMultiple === undefined ? defaultPeakPrice / current.price : numberIn(settings.peakMultiple, 1.05, 20, 'peakMultiple');
  const peakPrice = current.price * peakMultiple;
  const sensitivity = settings.priceSensitivityPct / 100;
  if (!(Number.isFinite(peakPrice) && peakPrice > 0)) throw new RangeError('Peak-price assumption overflowed');
  if (peakPrice * (1 - sensitivity) * settings.highZoneFraction <= current.price) {
    throw new RangeError('The lowest price sensitivity must reach its high zone above the current price; increase peakMultiple or reduce priceSensitivityPct');
  }
  const nominal = computeOutlookTiming(peak.date);
  const observables = {
    current: plain(current), peak: { ...plain(peak), provisional: true },
    previousPeak: { ...plain(previousPeak), selectedRetrospectively: true },
    troughCandidate: { ...plain(trough), provisional: true },
    daysAfterPeak: current.epochDay - peak.epochDay,
    observedPeakToLowDays: trough.epochDay - peak.epochDay,
    recoveryDays: current.epochDay - trough.epochDay,
    recoveryPct: (current.price / trough.price - 1) * 100,
    currentDrawdownFromPeakPct: (1 - current.price / peak.price) * 100,
    candidateLowDrawdownPct: (1 - trough.price / peak.price) * 100,
    candidateLeadToNominalTroughDays: utcDay(nominal.nominalTroughDate) - trough.epochDay,
    firstHighZoneEntry: zoneObservation(rows, peak, halving.date, settings.highZoneFraction),
    priceDefinition: 'Coin Metrics PriceUSD at the end of each labeled UTC day; not intraday high or a live quote.',
  };
  return { settings, rows, current, peak, trough, previousPeak, lastPeakMultiple, peakMultiple, peakPrice, defaultPeakPrice, observables };
}

function wave(u, count) {
  return Math.sin(Math.PI * u) ** 2 * Math.sin(Math.PI * count * u) ** 2;
}

/** Continuous, endpoint-preserving connectors in log price, sampled daily. */
function segmentPrice(left, right, day, settings, floor) {
  if (day === left.day) return left.price;
  if (day === right.day) return right.price;
  const u = (day - left.day) / (right.day - left.day);
  const a = Math.log(left.price), b = Math.log(right.price);
  const base = (1 - u) * a + u * b;
  const shape = wave(u, settings.waveCount);
  let logPrice;
  if (right.phase === 'decline' || right.phase === 'stress-decline') {
    // Positive corrections remain strictly below the segment's starting high.
    const capacity = Math.min(settings.waveAmplitude, Math.max(0, 0.5 * (a - base)));
    logPrice = base + capacity * shape;
  } else {
    // Corrections cannot cross the scenario's assumed surviving low.
    const capacity = Math.min(settings.waveAmplitude, Math.max(0, 0.5 * (base - Math.log(floor))));
    logPrice = base - capacity * shape;
  }
  const price = Math.exp(logPrice);
  if (!(Number.isFinite(price) && price > 0)) throw new RangeError('The illustrative connector produced a nonpositive or nonfinite price');
  return price;
}

function pricedAnchors(ctx, timing, kind, factor) {
  const { current, trough, settings } = ctx;
  const peakPrice = ctx.peakPrice * factor;
  const anchors = [{ id: 'current', date: current.date, price: current.price, phase: 'observed-anchor' }];
  let floor = trough.price;
  if (kind === 'stress') {
    const stressDate = shiftCalendarMonths(timing.nominalTroughDate, settings.stressDelayMonths);
    if (stressDate <= current.date || stressDate >= timing.zoneEntryDate) throw new RangeError('The stress low must be after asOf and before high-zone arrival; expired assumptions cannot be drawn as history');
    floor = trough.price * (1 - settings.stressBelowCandidatePct / 100);
    anchors.push({ id: 'stress-low', date: stressDate, price: floor, phase: 'stress-decline' });
  }
  const recoveryPhase = kind === 'stress' ? 'stress-recovery' : 'recovery';
  if (timing.formationDays === 0) {
    // Daily data can first enter the zone and print its peak on the same day.
    // Keep every earlier daily sample below q*peak, then join the final day.
    const before = addDays(timing.zoneEntryDate, -1);
    if (before <= anchors.at(-1).date) throw new RangeError('A zero-formation scenario needs a complete day before its coincident arrival and peak');
    anchors.push({ id: 'pre-zone', date: before, price: peakPrice * settings.highZoneFraction * (1 - 1e-10), phase: recoveryPhase, turningPointClaim: false });
    anchors.push({ id: 'peak', date: timing.effectivePeakDate, price: peakPrice, phase: 'high-zone' });
  } else {
    anchors.push({ id: 'zone-entry', date: timing.zoneEntryDate, price: peakPrice * settings.highZoneFraction, phase: recoveryPhase });
    anchors.push({ id: 'peak', date: timing.effectivePeakDate, price: peakPrice, phase: 'high-zone' });
  }
  anchors.push({ id: 'next-low', date: timing.nextLowDate, price: peakPrice * (1 - settings.bearDrawdownPct / 100), phase: 'decline' });
  for (let i = 0; i < anchors.length; i++) {
    anchors[i].day = utcDay(anchors[i].date);
    if (i && anchors[i].day <= anchors[i - 1].day) throw new RangeError('Scenario anchors must be strictly increasing');
  }
  return { anchors, floor };
}

function evaluateAnchors(model, date, settings) {
  const day = utcDay(date), { anchors, floor } = model;
  if (day < anchors[0].day || day > anchors.at(-1).day) return null;
  if (day === anchors[0].day) return { price: anchors[0].price, phase: 'observed-anchor' };
  const index = anchors.findIndex((point) => point.day >= day);
  const left = anchors[index - 1], right = anchors[index];
  return { price: segmentPrice(left, right, day, settings, floor), phase: right.phase };
}

function buildFromContext(ctx, options = {}) {
  const settings = ctx.settings;
  const kind = options.kind ?? 'bottom-holds';
  if (!['bottom-holds', 'stress'].includes(kind)) throw new RangeError('kind must be bottom-holds or stress');
  const timing = computeOutlookTiming(ctx.peak.date, {
    arrivalLeadMonths: options.arrivalLeadMonths ?? settings.arrivalLeadMonths,
    dwellMonths: options.dwellMonths ?? settings.dwellMonths,
  });
  if (timing.zoneEntryDate <= ctx.current.date) throw new RangeError('High-zone arrival is expired at this asOf; it cannot be silently drawn into observed history');
  if (settings.displayEnd > timing.nextLowDate) throw new RangeError('displayEnd exceeds the modeled next low; no invented second cycle is appended');
  const factors = [1 - settings.priceSensitivityPct / 100, 1, 1 + settings.priceSensitivityPct / 100];
  const models = factors.map((factor) => pricedAnchors(ctx, timing, kind, factor));
  const riseAnchorDate = kind === 'stress' ? models[1].anchors.find((anchor) => anchor.id === 'stress-low').date : ctx.trough.date;
  Object.assign(timing, {
    nominalRiseAnchorDate: timing.nominalTroughDate,
    assumedRiseAnchorDate: riseAnchorDate,
    riseAnchorStatus: kind === 'stress' ? 'conditional-stress-low' : 'observed-low-candidate',
    riseDaysFromCandidateOrStress: utcDay(timing.effectivePeakDate) - utcDay(riseAnchorDate),
    observedConnectorStartsAt: ctx.current.date,
    historyBetweenCandidateAndAsOfIsNotReconstructed: true,
  });
  const inHorizon = (date) => date >= ctx.current.date && date <= settings.displayEnd;
  const priced = (date) => models.map((model) => evaluateAnchors(model, date, settings)?.price ?? null);
  const event = (id, type, label, date, turningPointClaim = false) => {
    const [low, price, high] = priced(date);
    return { id, type, label, date, price, low, high, inHorizon: inHorizon(date),
      status: id === 'current' ? 'observed' : 'conditional-assumption',
      turningPointClaim, futureObservation: false, probability: null,
      outsideHorizonLabel: inHorizon(date) ? null : '3년 표시 범위 밖',
    };
  };
  const events = [event('current', 'reference', '마지막 관측', ctx.current.date)];
  if (kind === 'stress') events.push(event('stress-low', 'trough', '후보 이탈 후 조건부 저점', models[1].anchors.find((a) => a.id === 'stress-low').date, true));
  events.push(event('zone-entry', 'high-zone-entry', '고점권 최초 도달 가정', timing.zoneEntryDate));
  events.push(event('peak', 'peak', '조건부 최고가 전환', timing.effectivePeakDate, true));
  events.push(event('next-low', 'trough', '고점 12개월 후 저점 가정', timing.nextLowDate, true));
  events.push(event('horizon-end', 'endpoint', '3년 표시 종료 · 전환점 아님', settings.displayEnd));
  const path = [];
  for (let day = ctx.current.epochDay; day <= utcDay(settings.displayEnd); day++) {
    const date = dateFromDay(day), samples = models.map((model) => evaluateAnchors(model, date, settings));
    const [low, price, high] = samples.map((sample) => sample.price);
    if (!(low <= price + 1e-8 && price <= high + 1e-8)) throw new RangeError('Sensitivity ordering failed');
    path.push({ date, price, low, high,
      indexedPrice: 100 * price / ctx.current.price, indexedLow: 100 * low / ctx.current.price, indexedHigh: 100 * high / ctx.current.price,
      phase: date === timing.zoneEntryDate ? 'high-zone' : samples[1].phase, horizonDay: day - ctx.current.epochDay,
      kind: day === ctx.current.epochDay ? 'observed-anchor' : 'illustrative-conditional-path',
      probability: null,
    });
  }
  const zonePeakPoints = path.filter((p) => p.date >= timing.zoneEntryDate && p.date <= timing.effectivePeakDate);
  const threshold = ctx.peakPrice * settings.highZoneFraction;
  const candidateBreak = path.find((p) => p.date <= timing.effectivePeakDate && p.price < ctx.trough.price);
  const anyCandidatePriceBreak = path.find((p) => p.price < ctx.trough.price);
  return {
    id: options.id ?? 'custom', label: options.label ?? '직접 설정', kind,
    asOf: ctx.current.date, referenceDate: settings.referenceDate, displayEnd: settings.displayEnd,
    probability: null, pathIsForecastDailyReturns: false,
    parameters: {
      arrivalLeadMonths: timing.arrivalLeadMonths, dwellMonths: timing.dwellMonths,
      highZoneFraction: settings.highZoneFraction, peakMultiple: ctx.peakMultiple,
      priceGrowthRetention: settings.priceGrowthRetention, peakMultipleWasOverridden: settings.peakMultiple !== undefined,
      priceSensitivityPct: settings.priceSensitivityPct, bearDrawdownPct: settings.bearDrawdownPct,
      waveAmplitude: settings.waveAmplitude, waveCount: settings.waveCount,
      stressBelowCandidatePct: kind === 'stress' ? settings.stressBelowCandidatePct : null,
      stressDelayMonths: kind === 'stress' ? settings.stressDelayMonths : null,
    },
    timing,
    priceSensitivity: {
      type: 'user-assumption-sensitivity', probability: null,
      peakPrice: ctx.peakPrice, peakMultiple: ctx.peakMultiple,
      lowPeakPrice: ctx.peakPrice * factors[0], highPeakPrice: ctx.peakPrice * factors[2],
      factors, percentageAroundChosenPeak: settings.priceSensitivityPct,
      choiceWasEstimatedFromData: false,
      defaultCenterFormula: 'P_peak = P_previous_observed_peak × (P_previous_observed_peak / P_older_cycle_peak)^g',
      defaultCenterInputs: { previousObservedPeak: ctx.peak.price, olderCyclePeak: ctx.previousPeak.price, lastPeakMultiple: ctx.lastPeakMultiple, g: settings.priceGrowthRetention },
      chosenCenterFormula: settings.peakMultiple === undefined ? 'defaultCenterFormula' : 'P_peak = P(asOf) × user peakMultiple',
    },
    anchors: models[1].anchors.map(({ day, ...anchor }) => ({ ...anchor, inHorizon: inHorizon(anchor.date), status: anchor.id === 'current' ? 'observed' : 'conditional-assumption', probability: null })),
    events, path,
    summary: {
      peakDate: timing.effectivePeakDate, peakPrice: ctx.peakPrice,
      peakInHorizon: inHorizon(timing.effectivePeakDate),
      zoneEntryDate: timing.zoneEntryDate, zoneEntryInHorizon: inHorizon(timing.zoneEntryDate),
      nextLowDate: timing.nextLowDate, nextLowPrice: ctx.peakPrice * (1 - settings.bearDrawdownPct / 100),
      endDate: settings.displayEnd, endPrice: path.at(-1).price, endIndex: path.at(-1).indexedPrice,
      endIsTurningPoint: false, firstCandidateBreakDate: candidateBreak?.date ?? null,
      firstAnyCandidatePriceBreakDate: anyCandidatePriceBreak?.date ?? null,
      highZoneObservationsWithinHorizon: zonePeakPoints.length,
      observationsAboveThresholdWithinFormation: zonePeakPoints.filter((p) => p.price >= threshold).length,
      fullFormationInHorizon: inHorizon(timing.effectivePeakDate),
      formationIsContinuousResidence: false,
    },
    assumptions: [
      `${ctx.peak.date} 관측 고점에서 +12개월·+48개월을 명목 저점·고점으로 놓는 달력 모형이며, 미래 반감기 날짜를 사용하지 않는다.`,
      'A는 명목 최고점에서 역산한 도달 선행 개월이다. 이전 연구의 같은 고점권 진입 사건 대비 선행 일수와 다른 변수다.',
      'D는 고점권 최초 도달부터 최고가까지의 형성 구간이다. 그 사이 95% 경계 아래로 재이탈할 수 있다.',
      'g, 고점 배수, 가격 범위, 낙폭과 파동은 편집 가능한 가정이며 추정 확률·신뢰구간이 아니다.',
      '소파동은 앵커 사이를 연결하는 결정적 예시다. 개별 파동의 날짜와 수익률을 예측한 것이 아니다.',
      kind === 'stress' ? '현재 저점 후보를 먼저 이탈한 뒤 명목 상승 국면으로 복귀한다는 별도 스트레스다.' : '현재 저점 후보가 이 상승 회차의 저점으로 유지된다는 조건이다.',
      '명목 4년 시계는 고정한다. 조건부 다음 저점은 실제 가정 고점 +12개월이므로 명목 다음 저점과 다를 수 있다.',
    ],
    invalidations: [
      kind === 'stress' ? `가정한 ${settings.stressBelowCandidatePct}% 후보 이탈과 그 이후 회복이 관측되지 않으면 이 경로는 실현되지 않는다.` : `이 상승 회차에서 UTC 일말 가격이 ${ctx.trough.price} 아래로 내려가면 현재 저점 유지 가정은 무효다.`,
      '실제 고점권 도달·형성 기간·고점 가격이 설정과 다르면 날짜와 가격을 함께 다시 계산해야 한다.',
      '명목 저점에서 실제 고점까지의 30~42개월 범위를 벗어나면 이 모형의 약 3년 상승 가드 밖이다.',
      '단순한 향후 신고가는 이 모형의 상승 가정과 양립한다. 기존 관측 고점을 이전 회차의 기준으로 유지할 수 없다는 구조적 해석 변화가 있으면 명목 시계를 재검토한다.',
    ],
  };
}

export function buildOutlookScenario(input, options = {}) {
  return buildFromContext(context(input, options), options);
}

/** Exact retrospective decomposition, deliberately NOT a forecast score. */
export function reconstructHistoricalOutlook(input, { asOf = OUTLOOK_DEFAULTS.asOf, highZoneFraction = 0.95 } = {}) {
  numberIn(highZoneFraction, 0.8, 0.99, 'highZoneFraction');
  const rows = prefix(input, asOf), cases = [];
  for (const year of [2017, 2021, 2025]) {
    if (`${year}-12-31` > rows.at(-1).date) continue;
    const previous = extreme(rows, `${year - 4}-01-01`, `${year - 4}-12-31`);
    const peak = extreme(rows, `${year}-01-01`, `${year}-12-31`);
    const halving = HALVINGS.find((event) => event.year === year - 1);
    if (!previous || !peak || !halving) continue;
    const entry = rows.find((row) => row.date >= halving.date && row.date <= peak.date && row.price >= highZoneFraction * peak.price);
    if (!entry) continue;
    const nominalPeakDate = shiftCalendarMonths(previous.date, 48);
    const leadDays = utcDay(nominalPeakDate) - entry.epochDay;
    const formationDays = peak.epochDay - entry.epochDay;
    const reconstructedPeakDate = addDays(nominalPeakDate, -leadDays + formationDays);
    cases.push({ year, previousPeak: plain(previous), nominalPeakDate,
      actualPeak: plain(peak), actualEntry: plain(entry), highZoneFraction,
      leadDays, formationDays, netShiftDays: -leadDays + formationDays,
      reconstructedPeakDate, identityResidualDays: utcDay(reconstructedPeakDate) - peak.epochDay,
      sameEventLeadFromPriorEntryDays: (() => {
        const prevHalving = HALVINGS.find((event) => event.year === year - 5);
        const prevEntry = prevHalving && rows.find((row) => row.date >= prevHalving.date && row.date <= previous.date && row.price >= highZoneFraction * previous.price);
        return prevEntry ? utcDay(shiftCalendarMonths(prevEntry.date, 48)) - entry.epochDay : null;
      })(),
      retrospective: true, predictiveScore: false, probability: null,
      note: leadDays < 0 ? 'Negative A means arrival after the nominal peak; retain this case rather than censor it.' : 'A and D share the same entry date; they are jointly defined, not independent evidence.',
    });
  }
  return { type: 'retrospective-algebraic-decomposition', cases, numberOfCases: cases.length,
    forecastAccuracyClaim: false, zeroResidualMeaning: 'An identity obtained by substituting the already observed entry and peak dates, not prediction accuracy.',
  };
}

/**
 * Prefix-only pseudo-hindcasts of THIS model. The design and origin dates were
 * chosen after observing history, so this is not a preregistered out-of-sample
 * trial. Outcomes after 2024 are excluded; 2025/26 are never validation samples.
 */
export function evaluateThreeYearModel(input) {
  const all = validateDataset(input), availableEnd = all.at(-1).date < VALIDATION_END ? all.at(-1).date : VALIDATION_END;
  const rows = all.filter((row) => row.date <= availableEnd), byDate = new Map(rows.map((row) => [row.date, row]));
  const samples = [];
  for (const cutoff of VALIDATION_CUTOFFS) {
    if (!byDate.has(cutoff)) continue;
    const referenceDate = addDays(cutoff, 1), displayEnd = shiftCalendarMonths(referenceDate, 36);
    if (displayEnd > availableEnd) continue;
    const before = rows.filter((row) => row.date <= cutoff);
    const ctx = context(before, { asOf: cutoff, referenceDate, displayEnd });
    const model = buildFromContext(ctx, { id: 'hindcast-base', arrivalLeadMonths: 3, dwellMonths: 3 });
    const predicted = new Map(model.path.map((point) => [point.date, point]));
    const results = [12, 24, 36].map((months) => {
      const outcomeDate = shiftCalendarMonths(cutoff, months), actual = byDate.get(outcomeDate), estimate = predicted.get(outcomeDate);
      if (!actual || !estimate) return null;
      const absoluteLogError = Math.abs(Math.log(estimate.price / actual.price));
      const flatAbsoluteLogError = Math.abs(Math.log(ctx.current.price / actual.price));
      return { horizonMonths: months, outcomeDate, actualPrice: actual.price, scenarioPrice: estimate.price, flatPrice: ctx.current.price,
        absoluteLogError, flatAbsoluteLogError,
        absolutePercentageErrorPct: 100 * Math.abs(estimate.price / actual.price - 1),
        flatAbsolutePercentageErrorPct: 100 * Math.abs(ctx.current.price / actual.price - 1),
        scenarioBeatsFlatAtThisEndpoint: absoluteLogError < flatAbsoluteLogError,
      };
    }).filter(Boolean);
    const nextYear = Number(ctx.peak.date.slice(0, 4)) + 4;
    const actualNextPeak = `${nextYear}-12-31` <= availableEnd ? extreme(rows, `${nextYear}-01-01`, `${nextYear}-12-31`) : null;
    const firstCandidateBreak = rows.find((row) => row.date > cutoff && row.date <= displayEnd && row.price < ctx.trough.price);
    samples.push({ cutoff, informationThrough: cutoff, parameterSelectionWasRetrospective: true,
      observedAnchor: plain(ctx.current), observedLowCandidate: plain(ctx.trough), previousPeak: plain(ctx.peak), olderPeak: plain(ctx.previousPeak),
      assumedPeakDate: model.timing.effectivePeakDate, assumedPeakPrice: model.summary.peakPrice,
      actualNextPeak: plain(actualNextPeak),
      peakDateErrorDays: actualNextPeak ? utcDay(model.timing.effectivePeakDate) - actualNextPeak.epochDay : null,
      firstActualCandidateBreakDate: firstCandidateBreak?.date ?? null,
      candidateHoldAssumptionFailed: Boolean(firstCandidateBreak), results,
    });
  }
  const summary = [12, 24, 36].map((months) => {
    const items = samples.flatMap((sample) => sample.results.filter((result) => result.horizonMonths === months));
    return { horizonMonths: months, numberOfCutoffs: items.length,
      scenarioMeanAbsoluteLogError: mean(items.map((r) => r.absoluteLogError)), flatMeanAbsoluteLogError: mean(items.map((r) => r.flatAbsoluteLogError)),
      scenarioMAPEPct: mean(items.map((r) => r.absolutePercentageErrorPct)), flatMAPEPct: mean(items.map((r) => r.flatAbsolutePercentageErrorPct)),
      scenarioEndpointWins: items.filter((r) => r.scenarioBeatsFlatAtThisEndpoint).length,
    };
  });
  return { type: 'fixed-rule-prefix-only-pseudo-hindcast', validationEnd: availableEnd,
    numberOfDistinctCutoffs: samples.length, parameterSelectionWasRetrospective: true,
    currentCycleIncluded: false, genuineProspectiveValidation: false,
    candidateHoldFailures: samples.filter((sample) => sample.candidateHoldAssumptionFailed).length,
    sampleDependence: 'Horizons from one cutoff overlap and are not separate independent cycles.',
    parameters: { arrivalLeadMonths: 3, dwellMonths: 3, priceGrowthRetention: 0.75, bearDrawdownPct: 50, waveAmplitude: 0.06, priceSensitivityPct: 25 },
    samples, summary, probability: null,
    limitations: [
      'Only two earlier cutoff episodes; neither validates the present A/D/price parameters.',
      'Model design and cutoff choice are retrospective, even though each numerical forecast consumes only its prefix.',
      'A broken low-holds assumption is retained as a failure; losing horizons are not removed.',
      'Endpoint errors do not test intraday execution, forecast probability, trading profitability or daily wave timing.',
    ],
  };
}

export function analyzeThreeYearOutlook(input, options = {}) {
  const ctx = context(input, options);
  const scenarios = OUTLOOK_SCENARIO_PRESETS.map((preset) => buildFromContext(ctx, preset));
  const nominal = computeOutlookTiming(ctx.peak.date);
  return {
    version: 'three-year-outlook-v1', asOf: ctx.current.date, requestedAsOf: ctx.settings.asOf,
    referenceDate: ctx.settings.referenceDate, referenceTimezone: ctx.settings.referenceTimezone,
    displayStart: ctx.current.date, displayEnd: ctx.settings.displayEnd,
    horizonDays: utcDay(ctx.settings.displayEnd) - ctx.current.epochDay,
    referenceWindowMonths: 36,
    nominalClock: {
      referencePeakDate: ctx.peak.date, nominalTroughDate: nominal.nominalTroughDate,
      nominalPeakDate: nominal.nominalPeakDate, nominalNextTroughDate: nominal.nominalNextTroughDate,
      riseMonths: 36, declineMonths: 12, cycleMonths: 48,
      isObservedTurningPoint: false, unknownFutureHalvingDateUsed: false,
      observedHistoryIsRewritten: false, probability: null,
    },
    observables: ctx.observables,
    parameters: { ...ctx.settings, peakMultiple: ctx.peakMultiple },
    parameterDefinitions: {
      arrivalLeadMonths: { label: '명목 최고점보다 고점권에 먼저 도달하는 개월', min: -6, max: 12, step: 1, negativeMeans: '명목 최고점 이후 도달', baseline: 'nominalPeakDate', estimated: false },
      dwellMonths: { label: '고점 형성 기간', min: 0, max: 12, step: 1, continuousResidenceClaim: false, estimated: false },
      netShiftMonths: { formula: 'D - A', min: -6, max: 6, positiveMeans: '최고가 날짜 지연' },
      peakMultiple: { label: '현재 대비 조건부 최고가 배수', estimated: false },
      bearDrawdownPct: { label: '가정 고점 이후 12개월 낙폭', estimated: false },
      waveAmplitude: { label: '설명용 로그가격 파동 크기', estimated: false },
    },
    scenarios,
    historicalReconstruction: reconstructHistoricalOutlook(ctx.rows, { asOf: ctx.current.date, highZoneFraction: ctx.settings.highZoneFraction }),
    validation: options.includeValidation === false ? null : evaluateThreeYearModel(ctx.rows),
    formulas: [
      { id: 'clock', expression: 'T_low^nom = T_previous_peak + 12 months; T_peak^nom = T_previous_peak + 48 months', meaning: '명목 3년 상승·1년 하락 시계. 실제 저점·고점 관측과 구분한다.' },
      { id: 'entry', expression: 'T_zone = shiftMonths(T_peak^nom, -A)', meaning: 'A는 명목 최고점에서 역산한 고점권 도달 선행 개월이다.' },
      { id: 'peak', expression: 'T_peak = shiftMonths(T_peak^nom, D - A)', meaning: 'A=D면 최고가 날짜 유지, A>D면 조기 전환, A<D면 지연. 말일 오차를 막기 위해 공통 기준에서 한 번 이동한다.' },
      { id: 'price', expression: 'P_peak = P_observed_peak × (P_observed_peak/P_older_peak)^g, or P(asOf) × userMultiple', meaning: 'g와 직접 배수 모두 가정. 데이터로 추정된 확률분포가 아니다.' },
      { id: 'path', expression: 'log P(u) = (1-u) log P_left + u log P_right ± c(u) sin²(πu) sin²(kπu)', meaning: '파동은 0≤u≤1의 예시 연결 함수이고 양 끝에서 0이다. c(u)는 저점·고점 경계를 넘지 않도록 제한한다.' },
      { id: 'trough', expression: 'T_next_low = T_peak + 12 months; P_next_low = P_peak × (1-drawdownPct/100)', meaning: '다음 명목 저점은 고정하되 조건부 저점은 가정 최고점에 따라 이동한다. 장기 4년 반복의 증명이 아니다.' },
    ],
    invariants: {
      allDailyPricesPositiveFinite: true, exactObservedStart: true, endIsNotAutomaticallyTurn: true,
      arrivalBeforeOrAtPeak: true, firstDailyZoneEntryRespected: true,
      noOvershootAboveAssumedPeak: true, aEqualsDKeepsNominalPeak: true,
      uncertaintyIsCalibrated: false, futureMarketLawProved: false,
    },
    assumptions: [
      `사용자 기준일은 ${ctx.settings.referenceTimezone} ${ctx.settings.referenceDate}, 가격은 완료된 UTC 일말 관측만 사용한다.`,
      `명목 저점 ${nominal.nominalTroughDate}은 달력 참조선이다. 관측 저점 후보와 최근 회복을 과거 하락으로 다시 그리지 않는다.`,
      '모든 미래 선과 범위는 가정 민감도다. 소파동 날짜·수익률이나 특정 고점·저점의 발생 확률을 제시하지 않는다.',
      '과거 분해의 0일 잔차는 항등식이고 예측 검증 점수가 아니다. 새 모형의 과거 절단 재생도 소표본·사후 설계라는 한계를 갖는다.',
    ],
    sources: [
      { label: 'Coin Metrics Community PriceUSD data', url: 'https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets=btc&metrics=PriceUSD&frequency=1d&start_time=2010-07-18&end_time=2026-10-21&page_size=10000' },
      { label: 'Coin Metrics PriceUSD definition', url: 'https://docs.coinmetrics.io/network-data/network-data-overview/market/price' },
      { label: 'Rolling-origin validation and its limitations', url: 'https://otexts.com/fpp3/toolbox.html' },
    ],
  };
}
