import { CHART_INTERVALS, chartInterval, isIntradayInterval } from './ohlc-data.js?v=1.15.0-eth.1';

export function readEthView(params) {
  return {
    frequency: CHART_INTERVALS.some(item => item.id === params.get('granularity')) ? params.get('granularity') : 'daily',
    chartType: params.get('type') === 'candles' ? 'candles' : 'line',
    scale: params.get('axis') === 'linear' ? 'linear' : 'log',
    span: ['1m', '6m', '1y', '4y', 'all'].includes(params.get('eth-span')) ? params.get('eth-span') : '4y',
  };
}

export function ethViewQuery(state) {
  const params = new URLSearchParams({symbol:'ETHUSD'});
  if (state.frequency !== 'daily') params.set('granularity', state.frequency);
  if (state.chartType === 'candles') params.set('type', 'candles');
  if (state.scale === 'linear') params.set('axis', 'linear');
  if (state.span !== '4y') params.set('eth-span', state.span);
  return params.toString();
}

/** Bounds contain observed bars only. All navigation shares the candle grid. */
export function ethHistoryRange(series, span = '4y', previous = null) {
  const step = chartInterval(series.interval).seconds;
  const first = series.candles[0]?.time, last = series.candles.at(-1)?.time;
  if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last)) return null;
  const min = first - step, max = last + step;
  const days = {'1m':30, '6m':183, '1y':365, '4y':1461};
  const count = span === 'all' ? Math.round((max - min) / step) : Math.ceil((days[span] || 1461) * 86400 / step);
  const start = previous?.start ?? Math.max(min, max - count * step);
  const end = previous?.end ?? max;
  return {unit:'seconds', start, end, min, max, step, minSpan:Math.min(12, Math.round((max-min)/step)+1), contextKey:`ETH-USD:${series.interval}:${series.retrievedAt}`};
}

export function ethRangeLabel(frequency, span) {
  if (isIntradayInterval(frequency)) return '최근 구간';
  return {'1m':'1개월', '6m':'6개월', '1y':'1년', '4y':'4년', all:'전체'}[span] || '4년';
}
