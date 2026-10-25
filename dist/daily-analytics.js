import { utcDay, validateDataset } from './cycle-engine.js?v=1.19.0';

const YEAR_DAYS = 365.2425;
function finite(value, name) {
  if (!Number.isFinite(value)) throw new RangeError(`Non-finite daily analytics result: ${name}`);
  return Object.is(value, -0) ? 0 : value;
}

function returnPct(price, base) {
  const ratio = price / base;
  if (!Number.isFinite(ratio) || ratio <= 0) throw new RangeError('Daily analytics price ratio overflow or underflow');
  return finite((ratio - 1) * 100, 'return percentage');
}

function newDrawdown(seed) {
  return { peak: seed, mddPct: 0, peakDate: seed.date, troughDate: seed.date };
}

function updateDrawdown(tracker, row) {
  if (row.price > tracker.peak.price) tracker.peak = row;
  const drawdown = returnPct(row.price, tracker.peak.price);
  if (drawdown < tracker.mddPct) {
    tracker.mddPct = drawdown;
    tracker.peakDate = tracker.peak.date;
    tracker.troughDate = row.date;
  }
  return drawdown;
}

function periodBounds(row, monthly) {
  const year = Number(row.date.slice(0, 4)), month = Number(row.date.slice(5, 7));
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const endDay = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  const startDate = monthly ? `${row.date.slice(0, 7)}-01` : `${row.date.slice(0, 4)}-01-01`;
  const endDate = monthly ? `${row.date.slice(0, 7)}-${endDay}` : `${row.date.slice(0, 4)}-12-31`;
  return { year, ...(monthly ? { month } : {}), key: monthly ? year * 12 + month - 1 : year, start: utcDay(startDate), end: utcDay(endDate) };
}

function newPeriod(row, previous, monthly) {
  const bounds = periodBounds(row, monthly);
  const previousKey = previous ? periodBounds(previous, monthly).key : null;
  const hasBaseline = previousKey === bounds.key - 1;
  const baseline = hasBaseline ? previous : row;
  return { bounds, baseline, hasBaseline, first: row, last: row, count: 0, missing: 0, drawdown: newDrawdown(baseline) };
}

function addPeriod(period, row, missingSincePrevious) {
  period.last = row;
  period.count++;
  period.missing += missingSincePrevious;
  updateDrawdown(period.drawdown, row);
}

function closeCrossedPeriod(period, calendar) {
  // A later observed period proves that any unobserved calendar-day tail of
  // this period is missing. Exchange weekends/holidays need explicit evidence.
  if (calendar === 'daily') {
    const trailing = period.bounds.end - period.last.epochDay;
    period.missing += trailing;
    period.trailingMissing = trailing > 0;
  }
  return period;
}

function finishPeriod(period, calendar, asOfDay) {
  const { bounds, baseline, first, last, hasBaseline, drawdown } = period;
  const initialBoundary = hasBaseline && (calendar === 'sessions' || baseline.epochDay === bounds.start - 1);
  // For exchange calendars, the archive supplies actual sessions. A later
  // calendar period establishes the endpoint without manufacturing holidays.
  const finalBoundary = calendar === 'daily' ? last.epochDay === bounds.end : asOfDay > bounds.end || last.epochDay === bounds.end;
  return {
    year: bounds.year, ...(bounds.month ? { month: bounds.month } : {}),
    returnPct: returnPct(last.price, baseline.price), mddPct: drawdown.mddPct,
    peakDate: drawdown.peakDate, troughDate: drawdown.troughDate,
    startDate: first.date, endDate: last.date, baselineDate: baseline.date,
    count: period.count, partial: !initialBoundary || !finalBoundary || Boolean(period.trailingMissing),
    coverageComplete: period.missing === 0, missingDayCount: period.missing,
  };
}

/** Price returns use observed closes. All per-row values are causal. MDD is
 * negative and keeps ordered peak/trough dates; gaps can understate its loss magnitude. */
export function analyzeDailySeries(prices, { calendar = 'daily', asOfDate, symbol = '', missingDates = [] } = {}) {
  if (!['daily', 'sessions'].includes(calendar)) throw new TypeError('Unknown daily analytics calendar');
  if (typeof symbol !== 'string' || !Array.isArray(missingDates)) throw new TypeError('Invalid daily analytics options');
  const input = validateDataset(prices), first = input[0], last = input.at(-1);
  const asOfDay = utcDay(asOfDate ?? last.date);
  if (asOfDay < last.epochDay) throw new RangeError('Analytics asOfDate precedes an observation');
  const observedDates = new Set(input.map(row => row.date)), missingSet = new Set();
  for (const date of missingDates) {
    utcDay(date);
    if (missingSet.has(date) || observedDates.has(date)) throw new TypeError('Duplicate or observed missing date');
    missingSet.add(date);
  }
  const missingDays = [...missingSet].map(utcDay).sort((a, b) => a - b);
  let missingIndex = 0, totalMissing = 0;
  let yearPeriod = null, monthPeriod = null;
  const rows = [], annual = [], monthly = [], lifetime = newDrawdown(first);
  for (let index = 0; index < input.length; index++) {
    const row = input[index], previous = input[index - 1];
    let knownMissing = 0;
    while (missingIndex < missingDays.length && missingDays[missingIndex] < row.epochDay) {
      if (previous && missingDays[missingIndex] > previous.epochDay) knownMissing++;
      missingIndex++;
    }
    const missing = previous ? calendar === 'daily' ? row.epochDay - previous.epochDay - 1 : knownMissing : 0;
    totalMissing += missing;
    const contiguousPrevious = previous && missing === 0 ? previous : null;
    const year = Number(row.date.slice(0, 4)), monthKey = row.date.slice(0, 7);
    if (yearPeriod?.bounds.year !== year) {
      if (yearPeriod) annual.push(closeCrossedPeriod(yearPeriod, calendar));
      yearPeriod = newPeriod(row, previous, false);
    }
    if (monthPeriod?.first.date.slice(0, 7) !== monthKey) {
      if (monthPeriod) monthly.push(closeCrossedPeriod(monthPeriod, calendar));
      monthPeriod = newPeriod(row, previous, true);
    }
    // A period receives only gaps between its actual baseline and its end.
    const yearMissing = previous && previous.epochDay >= yearPeriod.baseline.epochDay ? missing : 0;
    const monthMissing = previous && previous.epochDay >= monthPeriod.baseline.epochDay ? missing : 0;
    addPeriod(yearPeriod, row, yearMissing); addPeriod(monthPeriod, row, monthMissing);
    const drawdownPct = updateDrawdown(lifetime, row);
    rows.push({
      date: row.date, price: row.price,
      changePct: contiguousPrevious ? returnPct(row.price, previous.price) : null,
      drawdownPct, mddToDatePct: lifetime.mddPct, peakDate: lifetime.peak.date,
      recoveryPct: returnPct(lifetime.peak.price, row.price),
      ytdPct: returnPct(row.price, yearPeriod.baseline.price),
      ytdPartial: !yearPeriod.hasBaseline || (calendar === 'daily' && yearPeriod.baseline.epochDay !== yearPeriod.bounds.start - 1),
    });
  }
  annual.push(yearPeriod); monthly.push(monthPeriod);
  const years = new Map(annual.map(period => [period.bounds.key, period]));
  const months = new Map(monthly.map(period => [period.bounds.key, period]));
  for (const date of missingSet) {
    const day = utcDay(date);
    if (day < first.epochDay || day > asOfDay) continue;
    if (day > last.epochDay) totalMissing++;
    // Interior daily gaps, including crossed-period tails, were already
    // inferred above; an explicit report of the same day must not add it twice.
    if (calendar === 'daily' && day <= last.epochDay) continue;
    const year = Number(date.slice(0, 4)), month = Number(date.slice(5, 7));
    for (const period of [years.get(year), months.get(year * 12 + month - 1)]) {
      if (period && day > period.last.epochDay) {
        period.missing++;
        period.trailingMissing = true;
      }
    }
  }
  const elapsedDays = last.epochDay - first.epochDay;
  // Eligibility is a calendar anniversary; the exponent separately uses the
  // stated mean Gregorian year. A February 29 start reaches one year on February 28.
  const anniversaryYear = Number(first.date.slice(0, 4)) + 1;
  const anniversaryDate = `${String(anniversaryYear).padStart(4, '0')}-${first.date.slice(5) === '02-29' ? '02-28' : first.date.slice(5)}`;
  const hasFullYear = anniversaryYear <= 9999 && last.date >= anniversaryDate;
  const cagrPct = !hasFullYear ? null : finite(Math.expm1((Math.log(last.price) - Math.log(first.price)) * YEAR_DAYS / elapsedDays) * 100, 'CAGR');
  return {
    rows, annual: annual.map(period => finishPeriod(period, calendar, asOfDay)), monthly: monthly.map(period => finishPeriod(period, calendar, asOfDay)),
    summary: {
      symbol, calendar, firstDate: first.date, lastDate: last.date, count: input.length, elapsedDays,
      cumulativeReturnPct: returnPct(last.price, first.price), cagrPct,
      mddPct: lifetime.mddPct, mddPeakDate: lifetime.peakDate, mddTroughDate: lifetime.troughDate,
      drawdownPct: rows.at(-1).drawdownPct, recoveryPct: rows.at(-1).recoveryPct,
      missingDayCount: totalMissing, coverageComplete: totalMissing === 0,
      coverageBasis: calendar === 'daily' ? 'UTC calendar days' : 'observed exchange sessions; known missing sessions only',
    },
  };
}
