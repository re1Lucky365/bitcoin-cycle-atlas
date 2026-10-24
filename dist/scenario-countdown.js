import { utcDay, dateFromDay } from './cycle-engine.js?v=1.19.0';

/** Daily state labels describe one conditional price path, never an event ETA. */
export const COUNTDOWN_REGIMES = Object.freeze({
  advance: Object.freeze({ key: 'advance', label: '상승', color: '#65c3a5' }),
  rebound: Object.freeze({ key: 'advance', label: '상승', color: '#65c3a5' }),
  'price-discovery': Object.freeze({ key: 'advance', label: '상승', color: '#65c3a5' }),
  pullback: Object.freeze({ key: 'pullback', label: '조정', color: '#e6b46b' }),
  correction: Object.freeze({ key: 'correction', label: '하락', color: '#df7c83' }),
  range: Object.freeze({ key: 'range', label: '횡보', color: '#91a4be' }),
  'bottom-formation': Object.freeze({ key: 'bottom', label: '바닥 후보', color: '#74a7ee' }),
  transition: Object.freeze({ key: 'transition', label: '전환·혼합', color: '#a899cd' }),
  warmup: Object.freeze({ key: 'unknown', label: '판단 대기', color: '#8290a3' }),
});
const unknown = COUNTDOWN_REGIMES.warmup;
const conditionalNote = '선택한 가정 경로의 상태 전환입니다. 실제 시장의 전환일이나 확률을 예측·확정한 일정이 아닙니다.';

/** Calendar D-day uses the Korean date; it does not assign an intraday event time. */
export function koreanCalendarDate(now = new Date()) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new TypeError('A valid date is required');
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * O(n) once per model/calendar day, O(r) for r state runs. Consumers cache it
 * outside pointer handlers. Never smooth prices or change the plotted states.
 * Persistence is an explicit UI filter, not a statistically fitted threshold.
 */
export function buildScenarioCountdown(model, { today = koreanCalendarDate(), minimumRunDays = 7 } = {}) {
  const todayDay = utcDay(today);
  if (!Number.isSafeInteger(minimumRunDays) || minimumRunDays < 1) throw new RangeError('minimumRunDays must be a positive integer');
  let asOf = null;
  try { if (model?.asOf) { utcDay(model.asOf); asOf = model.asOf; } } catch {}
  const asOfAgeDays = asOf ? Math.max(0, todayDay - utcDay(asOf)) : null;
  const base = {
    status: 'unavailable', currentLabel: null, nextLabel: null, currentKey: null, nextKey: null,
    date: null, days: null, dday: '—', holdDays: null, currentUntil: null,
    asOf, asOfAgeDays, staleDays: asOfAgeDays === null ? null : Math.max(0, asOfAgeDays - 1),
    today, timezone: 'Asia/Seoul', pathDateConvention: 'UTC daily date labels compared with the KST calendar date; no intraday transition time',
    minimumRunDays, sequence: [], conditional: true, probability: null,
    label: '시나리오 기준', rule: `${minimumRunDays}일 이상 유지 조건`,
    currentIsConditional: Boolean(asOf && today > asOf),
    intermediateTransitions: 0, horizonEnd: model?.displayEnd ?? null,
    note: conditionalNote,
  };
  if (!asOf || !Array.isArray(model?.path) || !model.path.length) return { ...base, reason: 'missing-daily-path' };
  if (today < asOf) return { ...base, reason: 'today-precedes-observation-cutoff' };
  const runs = [];
  let previousDay = -Infinity;
  for (const point of model.path) {
    let day;
    try { day = utcDay(point?.date); } catch { return { ...base, reason: 'invalid-path-date' }; }
    if (day <= previousDay || point.date < asOf) return { ...base, reason: 'nonchronological-path' };
    const regime = COUNTDOWN_REGIMES[point.state] ?? unknown;
    let run = runs.at(-1);
    if (!run || day !== previousDay + 1 || run.key !== regime.key) {
      run = { ...regime, startDate: point.date, endDate: point.date, startDay: day, endDay: day, days: 0 };
      runs.push(run);
    }
    run.endDate = point.date; run.endDay = day; run.days++;
    previousDay = day;
  }
  const currentIndex = runs.findIndex(run => run.startDay <= todayDay && run.endDay >= todayDay);
  if (currentIndex < 0) return { ...base, reason: todayDay > previousDay ? 'beyond-displayed-horizon' : 'missing-today-in-path' };
  const current = runs[currentIndex];
  if (current.key === 'unknown') return { ...base, reason: 'current-state-unavailable' };
  const rightCensored = index => !runs[index + 1]
    || runs[index + 1].startDay !== runs[index].endDay + 1
    || runs[index + 1].key === 'unknown';
  const result = {
    ...base, currentLabel: current.label, currentKey: current.key, currentColor: current.color,
    currentUntil: current.endDate, holdDays: current.endDay - todayDay + 1,
    holdDaysIncludeToday: true, currentRightCensored: rightCensored(currentIndex),
    horizonEnd: dateFromDay(previousDay),
  };
  let lastKey = current.key, nextIndex = -1, skippedShortRuns = 0, incompleteFuturePath = false;
  for (let index = currentIndex + 1; index < runs.length; index++) {
    const run = runs[index];
    // A missing day invalidates the countdown chain instead of inventing a
    // transition across an unobserved part of the conditional daily path.
    if (run.startDay !== runs[index - 1].endDay + 1 || run.key === 'unknown') {
      incompleteFuturePath = true;
      break;
    }
    if (run.days < minimumRunDays) {
      if (nextIndex < 0) skippedShortRuns++;
      continue;
    }
    if (run.key === lastKey) continue;
    const days = run.startDay - todayDay;
    result.sequence.push({
      key: run.key, label: run.label, color: run.color, date: run.startDate,
      days, dday: days ? `D-${days}` : 'D-day',
      expectedRunDays: run.days, endDate: run.endDate,
      rightCensored: rightCensored(index),
      conditional: true, probability: null,
    });
    if (nextIndex < 0) nextIndex = index;
    lastKey = run.key;
    if (result.sequence.length === 3) break;
  }
  const next = result.sequence[0];
  if (!next && incompleteFuturePath) return {
    ...result, status: 'unavailable', reason: 'incomplete-future-path',
    note: `${conditionalNote} 미래 경로에 누락일 또는 판단 대기 구간이 있어 다음 전환 후보를 계산할 수 없습니다.`,
  };
  if (!next) return { ...result, status: 'maintained', reason: 'no-sustained-different-regime', note: `${conditionalNote} 표시 범위에 ${minimumRunDays}일 이상 이어지는 다음 전환 후보가 없습니다.` };
  return {
    ...result, status: 'upcoming', nextLabel: next.label, nextKey: next.key, nextColor: next.color,
    date: next.date, days: next.days, dday: next.dday,
    nextRunDays: next.expectedRunDays, nextUntil: next.endDate,
    intermediateTransitions: skippedShortRuns,
    note: `${conditionalNote} ${minimumRunDays}일 미만의 짧은 구간은 다음 전환 후보에서 제외합니다. 현재 상태의 연속 유지기간과 다음 후보까지의 남은 기간은 다를 수 있습니다.`,
  };
}
