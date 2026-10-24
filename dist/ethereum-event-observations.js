const DAY = 86400;
const WINDOWS = Object.freeze([1, 3, 7]);
const day = time => new Date(time * 1000).toISOString().slice(0, 10);

function daySeconds(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const time = Date.parse(`${value}T00:00:00Z`) / 1000;
  return Number.isFinite(time) && day(time) === value ? time : NaN;
}

/** Descriptive closes only. Each window includes the event's calendar day,
 * starts from the preceding UTC daily close, and requires every daily bar.
 * This is not an announcement-time return or an estimate of causal impact. */
export function observeEthereumEvent(event, series) {
  const time = daySeconds(event?.date);
  const unavailable = reason => ({eventDate:event?.date ?? null, baselineDate:null, baselineClose:null, source:'Coinbase Exchange', product:'ETH-USD', retrievedAt:null,
    windows:WINDOWS.map(days => ({days, status:reason, changePct:null}))});
  if (!Number.isFinite(time)) return unavailable('invalid-date');
  if (!series || series.interval !== 'daily' || series.product !== 'ETH-USD' || series.source !== 'Coinbase Exchange' || series.completedOnly !== true || !Array.isArray(series.candles) || !series.candles.length) return unavailable('unavailable');
  const collected = Date.parse(series.retrievedAt) / 1000;
  if (!Number.isFinite(collected)) return unavailable('invalid-data');
  const rows = new Map();
  let previous = -Infinity;
  for (const candle of series.candles) {
    if (!Number.isSafeInteger(candle.time) || candle.time <= 0 || candle.time > collected || candle.time % DAY || candle.time <= previous || !Number.isFinite(candle.close) || candle.close <= 0 || (candle.date !== undefined && (typeof candle.date !== 'string' || candle.date.slice(0,10) !== day(candle.time)))) return unavailable('invalid-data');
    const received = candle.retrievedAt ? Date.parse(candle.retrievedAt) / 1000 : collected;
    if (!Number.isFinite(received) || received > collected || candle.time + DAY > received) return unavailable('invalid-data');
    rows.set(candle.time, candle);
    previous = candle.time;
  }
  const first = series.candles[0].time, last = series.candles.at(-1).time;
  const baselineTime = time - DAY, baseline = rows.get(baselineTime);
  return {
    eventDate:event.date, baselineDate:day(baselineTime), baselineClose:baseline?.close ?? null,
    source:series.source, product:series.product, retrievedAt:series.retrievedAt,
    windows:WINDOWS.map(days => {
      const end = time + (days - 1) * DAY;
      const window = {days, startDate:event.date, endDate:day(end), endClose:null, changePct:null};
      if (baselineTime < first || end > last) return {...window, status:'outside-coverage'};
      for (let current = baselineTime; current <= end; current += DAY) if (!rows.has(current)) return {...window, status:'missing-day'};
      const endClose = rows.get(end).close;
      const changePct = (endClose / baseline.close - 1) * 100;
      if (!Number.isFinite(changePct)) return {...window, status:'invalid-data'};
      return {...window, status:'observed', endClose, changePct};
    }),
  };
}
