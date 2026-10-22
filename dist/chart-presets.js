import { utcDay, dateFromDay } from './cycle-engine.js?v=1.11.0';
import { shiftCalendarMonths } from './cycle-timing.js?v=1.11.0';

export const DEFAULT_CHART_SPAN = 'focus';
export const CHART_SPANS = Object.freeze(['focus', 'near', 'all', 'history']);

/** Display windows only: these never truncate the model's forecast horizon. */
export function chartPresetRange({ asOf, referenceDate = asOf, firstDate, lastDate, span = DEFAULT_CHART_SPAN }) {
  for (const date of [asOf, referenceDate, firstDate, lastDate]) utcDay(date);
  if (firstDate > asOf || asOf > lastDate) throw new RangeError('관측일이 자료 범위 안에 있어야 합니다.');
  if (!CHART_SPANS.includes(span)) throw new RangeError('지원하지 않는 표시 범위입니다.');
  let start, end;
  if (span === 'focus') {
    start = shiftCalendarMonths(asOf, -24);
    end = shiftCalendarMonths(asOf, 24);
  } else if (span === 'near') {
    start = dateFromDay(utcDay(referenceDate) - 45);
    end = shiftCalendarMonths(referenceDate, 6);
  } else {
    start = span === 'history' ? firstDate : dateFromDay(utcDay(asOf) - 365);
    end = lastDate;
  }
  return { start: start < firstDate ? firstDate : start, end: end > lastDate ? lastDate : end };
}
