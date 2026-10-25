import { utcDay, validateDataset } from './cycle-engine.js?v=1.19.0';

export const ASSET_COMPARISON_VERSION = 1;
export const MIN_SAMPLE_YEARS = 5;
export const MAX_STALE_DAYS = 7;
export const ASSET_JUDGMENTS = Object.freeze({
  'strong-buy': '적극 매수', buy: '분할 매수', neutral: '중립',
  sell: '분할 매도', 'strong-sell': '적극 매도', unavailable: '판단 보류',
});

export const ASSET_COMPARISON_METHODOLOGY = Object.freeze({
  baseline: '각 연도의 첫 관측 거래일 종가. 전년 말 종가가 아닙니다.',
  meanRise: '지난 각 연도의 최고 종가 ÷ 해당 연도 첫 종가 − 1을 구한 뒤 연도별로 같은 비중을 적용한 산술평균입니다.',
  meanFall: '지난 각 연도의 최저 종가 ÷ 해당 연도 첫 종가 − 1의 산술평균입니다. 시간순 고점 이후의 최대 낙폭(MDD)과 다릅니다.',
  samples: '진행 중인 올해는 제외합니다. 최초 상장·관측 연도의 부분기간은 포함하고 별도로 표시합니다. 관측이 없는 연도를 채우지 않습니다.',
  priceBasis: '분할을 반영한 종가의 가격 변화이며 배당 재투자 총수익률이 아닙니다.',
  judgment: '평균 상승을 U, 평균 낙폭을 D, 올해 첫 종가 대비 변화를 r이라 할 때 D, D/2, U/2, U를 경계로 다섯 단계를 구분합니다.',
  interpretation: '과거 평균 범위에 대한 현재 가격의 위치를 표시하는 운영 규칙입니다. 반등·하락 확률, 최적 주문 비중 또는 거래 수익성이 검증된 신호가 아닙니다.',
  coverage: '확인된 결측·비어 있는 연도·자료 달력에 맞지 않는 관측 간격이 있으면 판단을 보류합니다. 거래소 휴장일·UTC 달력일을 서로 혼동하거나 임의로 채우지 않습니다.',
  freshness: '기준일까지의 관측만 사용합니다. 올해 기준가가 없거나 최근 종가가 기준일보다 7일 넘게 오래되면 판단을 보류합니다.',
  minimumSamples: MIN_SAMPLE_YEARS,
});

function finite(value, label) {
  if (!Number.isFinite(value)) throw new RangeError(`Non-finite asset comparison result: ${label}`);
  return Object.is(value, -0) ? 0 : value;
}

function percentage(price, baseline) {
  const ratio = price / baseline;
  if (!Number.isFinite(ratio) || ratio <= 0) throw new RangeError('Asset comparison price ratio overflow or underflow');
  return finite((ratio - 1) * 100, 'percentage');
}

// Every member of each mean has the same sign; this update avoids overflowing
// an otherwise representable mean by first adding all large annual values.
function mean(values) {
  if (!values.length) return null;
  let value = 0;
  for (let index = 0; index < values.length; index++) value += (values[index] - value) / (index + 1);
  return finite(value, 'equal-year arithmetic mean');
}

function yearOf(date) { return Number(date.slice(0, 4)); }
function sourceDate(bundle, asOfDate) {
  if (asOfDate !== undefined) { utcDay(asOfDate); return asOfDate; }
  if (typeof bundle.retrievedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(bundle.retrievedAt) || !Number.isFinite(Date.parse(bundle.retrievedAt))) throw new TypeError('Asset comparison needs a zoned retrieval timestamp or explicit asOfDate');
  utcDay(bundle.retrievedAt.slice(0, 10));
  const date = new Date(bundle.retrievedAt).toISOString().slice(0, 10);
  utcDay(date); return date;
}

function unavailable(reason, thresholds = null) {
  return { id: 'unavailable', label: ASSET_JUDGMENTS.unavailable, available: false, reason, thresholds };
}

function classify({ sampleYears, meanRisePct, meanFallPct, ytdPct, current, latest, year, asOfDay, coverage }) {
  const thresholds = meanRisePct !== null && meanFallPct !== null
    ? { strongBuyPct: meanFallPct, buyPct: meanFallPct / 2, sellPct: meanRisePct / 2, strongSellPct: meanRisePct } : null;
  if (!latest || !current || yearOf(latest.date) !== year) return unavailable('올해의 기준가와 최근 완료 종가를 함께 확보하지 못했습니다.', thresholds);
  if (asOfDay - latest.epochDay > MAX_STALE_DAYS) return unavailable('최근 종가가 기준일보다 7일 넘게 오래되어 판단을 보류합니다.', thresholds);
  if (!coverage.complete) return unavailable('확인된 관측 공백이 있어 평균 범위에 따른 판단을 보류합니다.', thresholds);
  if (sampleYears < MIN_SAMPLE_YEARS) return unavailable(`과거 표본 ${sampleYears}개 연도로는 최소 ${MIN_SAMPLE_YEARS}개 연도 기준을 충족하지 못합니다.`, thresholds);
  if (!(meanRisePct > 0 && meanFallPct < 0) || !Number.isFinite(ytdPct)) return unavailable('상승·낙폭 양쪽의 평균 범위를 확보하지 못했습니다.', thresholds);
  let id, reason;
  if (ytdPct <= thresholds.strongBuyPct) {
    id = 'strong-buy'; reason = '올해 첫 종가 대비 하락이 과거 평균 낙폭 경계에 도달하거나 그보다 깊습니다.';
  } else if (ytdPct <= thresholds.buyPct) {
    id = 'buy'; reason = '올해 첫 종가 대비 하락이 과거 평균 낙폭의 절반 경계를 넘었습니다.';
  } else if (ytdPct < thresholds.sellPct) {
    id = 'neutral'; reason = '올해 가격 변화가 과거 평균 상승·낙폭의 절반 경계 사이에 있습니다.';
  } else if (ytdPct < thresholds.strongSellPct) {
    id = 'sell'; reason = '올해 첫 종가 대비 상승이 과거 평균 상승의 절반 경계에 도달했습니다.';
  } else {
    id = 'strong-sell'; reason = '올해 첫 종가 대비 상승이 과거 평균 상승 경계에 도달하거나 그보다 높습니다.';
  }
  return { id, label: ASSET_JUDGMENTS[id], available: true, reason, thresholds };
}

function annualPeriods(prices) {
  const result = [];
  let period;
  for (const point of prices) {
    const year = yearOf(point.date);
    if (!period || period.year !== year) {
      period = { year, first: point, last: point, high: point, low: point, peak: point, mddPeak: point, mddTrough: point, mddPct: 0, count: 0 };
      result.push(period);
    }
    period.last = point; period.count++;
    if (point.price > period.high.price) period.high = point;
    if (point.price < period.low.price) period.low = point;
    if (point.price > period.peak.price) period.peak = point;
    const drawdown = percentage(point.price, period.peak.price);
    if (drawdown < period.mddPct) { period.mddPct = drawdown; period.mddPeak = period.peak; period.mddTrough = point; }
  }
  return result.map(period => ({
    year: period.year, startDate: period.first.date, endDate: period.last.date, count: period.count,
    baselinePrice: period.first.price, highPrice: period.high.price, lowPrice: period.low.price,
    highDate: period.high.date, lowDate: period.low.date,
    risePct: percentage(period.high.price, period.first.price),
    fallPct: percentage(period.low.price, period.first.price),
    mddPct: period.mddPct, mddPeakDate: period.mddPeak.date, mddTroughDate: period.mddTrough.date,
  }));
}

function coverageFor(prices, metadata, periods, year, asOfDay) {
  const first = prices[0], observed = new Set(prices.map(point => point.date));
  const missingDates = [];
  const suppliedMissing = metadata.missingDates ?? [];
  if (!Array.isArray(suppliedMissing)) throw new TypeError('Asset comparison missingDates must be an array');
  const seenMissing = new Set();
  for (const date of suppliedMissing) {
    const day = utcDay(date);
    if (seenMissing.has(date)) throw new TypeError('Duplicate asset comparison missing date');
    seenMissing.add(date);
    if (observed.has(date)) throw new TypeError('Asset comparison date is both observed and missing');
    if (first && day >= first.epochDay && day <= asOfDay) missingDates.push(date);
  }
  const calendar = metadata.calendar ?? 'sessions';
  if (!['sessions', 'calendar-days'].includes(calendar)) throw new TypeError('Unsupported asset comparison calendar');
  let gapCount = 0;
  for (let index = 1; index < prices.length; index++) {
    const intervalDays = prices[index].epochDay - prices[index - 1].epochDay;
    if (calendar === 'calendar-days' ? intervalDays !== 1 : intervalDays > 7) gapCount++;
  }
  const presentYears = new Set(periods.map(period => period.year)), missingYears = [];
  if (first) for (let historicalYear = yearOf(first.date); historicalYear < year; historicalYear++) if (!presentYears.has(historicalYear)) missingYears.push(historicalYear);
  const firstYearPartial = Boolean(first && (calendar === 'calendar-days' ? first.date.slice(5) !== '01-01' : first.date.slice(5) > '01-07'));
  const issues = [];
  if (!first) issues.push('기준일까지의 관측 없음');
  if (missingDates.length) issues.push(`확인된 결측 ${missingDates.length}개 날짜`);
  if (missingYears.length) issues.push(`관측 없는 과거 연도 ${missingYears.join(', ')}`);
  if (gapCount) issues.push(calendar === 'calendar-days' ? `하루를 넘는 UTC 달력일 관측 간격 ${gapCount}개` : `7일을 넘는 거래 세션 관측 간격 ${gapCount}개`);
  const current = periods.find(period => period.year === year);
  if (current && (calendar === 'calendar-days' ? current.startDate.slice(5) !== '01-01' : current.startDate.slice(5) > '01-07')) issues.push(calendar === 'calendar-days' ? '올해 UTC 첫 달력일 기준 종가 없음' : '올해 첫 주의 기준 종가 없음');
  return { status: !first ? 'unavailable' : issues.length ? 'incomplete' : 'observed', complete: Boolean(first) && issues.length === 0, issues, missingYears, missingDates: missingDates.sort(), gapCount, firstYearPartial, firstPartialStartDate: firstYearPartial ? first.date : null };
}

/** Read observed, split-adjusted closes only. Pure and O(total observations).
 * The caller supplies today's UTC asOfDate when using a stored public archive.
 * No current-year observation is allowed into the historical mean bands. */
export function buildAssetComparison(bundle, { asOfDate } = {}) {
  if (!bundle || bundle.version !== ASSET_COMPARISON_VERSION || !Array.isArray(bundle.assets) || bundle.assets.length === 0) throw new TypeError('Invalid asset comparison bundle');
  const asOf = sourceDate(bundle, asOfDate), asOfDay = utcDay(asOf), year = yearOf(asOf), symbols = new Set();
  const rows = Array.from(bundle.assets, asset => {
    if (!asset || typeof asset.symbol !== 'string' || !/^[A-Z][A-Z0-9.-]{0,14}$/.test(asset.symbol) || symbols.has(asset.symbol)) throw new TypeError('Invalid or duplicate asset comparison symbol');
    symbols.add(asset.symbol);
    for (const field of ['name', 'group', 'category']) if (typeof asset[field] !== 'string' || !asset[field].trim()) throw new TypeError(`Missing asset comparison ${field}`);
    if (asset.currency !== 'USD') throw new TypeError('Asset comparison requires consistently USD-denominated prices');
    const meta = asset.meta ?? {};
    if (typeof meta !== 'object' || Array.isArray(meta)) throw new TypeError('Asset comparison metadata must be an object');
    if (meta.calendar !== undefined && !['sessions', 'calendar-days'].includes(meta.calendar)) throw new TypeError('Asset comparison expects exchange sessions or UTC calendar days');
    for (const granularity of [meta.dataGranularity, meta.granularity]) if (granularity !== undefined && granularity !== '1d') throw new TypeError('Asset comparison requires daily source observations');
    if (meta.adjustment !== undefined && meta.adjustment !== 'split-adjusted-close' && !(meta.calendar === 'calendar-days' && meta.adjustment === 'none')) throw new TypeError('Asset comparison requires split-adjusted price-only closes or UTC daily prices');
    const all = validateDataset(asset.prices), prices = all.filter(point => point.epochDay <= asOfDay);
    const latest = prices.at(-1) ?? null, first = prices[0] ?? null, periods = annualPeriods(prices);
    const samples = periods.filter(period => period.year < year);
    const sampleYears = samples.length;
    const meanRisePct = mean(samples.map(period => period.risePct));
    const meanFallPct = mean(samples.map(period => period.fallPct));
    const meanMddPct = mean(samples.map(period => period.mddPct));
    const current = prices.find(point => yearOf(point.date) === year) ?? null;
    const ytdPct = current && latest ? percentage(latest.price, current.price) : null;
    const coverage = coverageFor(prices, meta, periods, year, asOfDay);
    const judgment = classify({ sampleYears, meanRisePct, meanFallPct, ytdPct, current, latest, year, asOfDay, coverage });
    return {
      symbol: asset.symbol, name: asset.name, group: asset.group, category: asset.category, currency: asset.currency,
      sampleYears, sampleStartYear: samples[0]?.year ?? null, sampleEndYear: samples.at(-1)?.year ?? null,
      samplePartialFirstYear: Boolean(samples.length && coverage.firstYearPartial),
      firstPartialStartDate: samples.length ? coverage.firstPartialStartDate : null,
      meanRisePct, meanFallPct, meanMddPct,
      yearStartDate: current?.date ?? null, yearStartPrice: current?.price ?? null,
      latestDate: latest?.date ?? null, latestPrice: latest?.price ?? null, ytdPct,
      firstDate: first?.date ?? null, lastDate: latest?.date ?? null, observationCount: prices.length,
      judgment, coverage, samples,
      source: { name: meta.sourceName ?? '', url: meta.sourceUrl ?? meta.source ?? '', priceDefinition: meta.priceDefinition ?? '', currency: asset.currency, retrievedAt: meta.retrievedAt ?? bundle.retrievedAt ?? null, firstDate: meta.firstDate ?? all[0].date, lastDate: meta.lastDate ?? all.at(-1).date, count: meta.count ?? all.length, responseSha256: meta.responseSha256 ?? meta.rawSha256 ?? null },
      meta: { ...meta },
    };
  });
  return { version: ASSET_COMPARISON_VERSION, asOf, year, rows, methodology: ASSET_COMPARISON_METHODOLOGY };
}
