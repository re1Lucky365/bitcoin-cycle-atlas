import { chartInterval, marketProduct } from './ohlc-data.js?v=1.15.0';

// A viewport budget, not a history-start date: panning can keep requesting older
// windows. The latest saved window is retained separately for Reset.
export const INTRADAY_MAX_VISIBLE_BARS = 6000;
export const INTRADAY_CACHE_BARS = 12000;
export const INTRADAY_PAGE_SOURCE_BARS = 288;
const GENESIS = Date.parse('2009-01-03T00:00:00Z') / 1000;
const historyStart=series=>series.product?marketProduct(series.product).historyStart:GENESIS;

export function mergeCoverage(windows) {
  const sorted=windows.filter(([a,b])=>Number.isFinite(a)&&b>a).sort((a,b)=>a[0]-b[0]),merged=[];
  for(const [start,end] of sorted){const last=merged.at(-1);if(last&&start<=last[1])last[1]=Math.max(last[1],end);else merged.push([start,end]);}
  return merged;
}

/** Half-open checked windows include genuine no-trade gaps, so those gaps never
 * cause a network retry loop or get replaced by made-up candles. */
export function missingWindows(start,end,coverage) {
  const gaps=[];let cursor=start;
  for(const [first,last] of coverage){if(last<=cursor)continue;if(first>=end)break;if(first>cursor)gaps.push([cursor,Math.min(first,end)]);cursor=Math.max(cursor,last);if(cursor>=end)break;}
  if(cursor<end)gaps.push([cursor,end]);return gaps;
}

export function mergeCandleRows(left,right) {
  const result=[];let a=0,b=0;
  while(a<left.length||b<right.length){
    if(b>=right.length||(a<left.length&&left[a].time<right[b].time))result.push(left[a++]);
    else{if(a<left.length&&left[a].time===right[b].time)a++;result.push(right[b++]);}
  }
  return result;
}

export function createHistoryState(series) {
  const step=chartInterval(series.interval).seconds,first=series.candles[0].time,last=series.candles.at(-1).time;
  return {base:series,coverage:[[series.requestedStart??first,series.requestedEnd??last+step]],requested:null,retryAt:0};
}

export function intradayNavigationRange(series,previousRange=null) {
  const step=chartInterval(series.interval).seconds,first=series.candles[0].time,last=series.candles.at(-1).time;
  const min=Math.floor(historyStart(series)/step)*step,max=last+step;
  const start=previousRange?.start??first-step,end=previousRange?.end??max;
  return {unit:'seconds',start,end,min,max,step,minSpan:12,maxSpan:INTRADAY_MAX_VISIBLE_BARS,contextKey:`market:${series.product||'BTC-USD'}:${series.interval}:${series.retrievedAt}`};
}

export function requestedHistoryWindow(history,range) {
  const interval=chartInterval(history.base.interval),step=interval.seconds,nav=intradayNavigationRange(history.base);
  const end=Math.min(nav.max,Math.ceil(range.end/step)*step+step);
  const start=Math.max(nav.min,Math.floor(range.start/step)*step,end-INTRADAY_MAX_VISIBLE_BARS*step);
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||end<=start)return null;
  return {start,end,step};
}

export function nextHistoryPage(history) {
  const target=history.requested;if(!target)return null;
  const gap=missingWindows(target.start,target.end,history.coverage).at(-1);if(!gap)return null;
  const interval=chartInterval(history.base.interval),bars=Math.floor(INTRADAY_PAGE_SOURCE_BARS*interval.sourceSeconds/interval.seconds);
  return {start:Math.max(gap[0],gap[1]-bars*interval.seconds),end:gap[1]};
}

export function appendHistoryPage(series,history,page) {
  const step=history.base.seconds,target=history.requested;
  const spare=Math.max(0,INTRADAY_CACHE_BARS-(target.end-target.start)/step);
  const retainStart=Math.max(Math.floor(historyStart(history.base)/step)*step,target.start-Math.floor(spare/2)*step),retainEnd=retainStart+INTRADAY_CACHE_BARS*step;
  const fresh=page.candles.map(row=>({...row,retrievedAt:page.retrievedAt,snapshot:false}));
  const retained=mergeCandleRows(series.candles,fresh).filter(row=>row.time>=retainStart&&row.time<retainEnd);
  // Keep the newest fetched copy on an overlapping saved timestamp.
  const candles=mergeCandleRows(history.base.candles,retained);
  const baseStart=history.base.requestedStart??history.base.candles[0].time,baseEnd=history.base.requestedEnd??history.base.candles.at(-1).time+step;
  history.coverage=mergeCoverage([...history.coverage,[page.requestedStart,page.requestedEnd]].map(([a,b])=>[Math.max(a,retainStart),Math.min(b,retainEnd)]).concat([[baseStart,baseEnd]]));
  const gapCount=Math.max(0,Math.round(history.coverage.reduce((total,[a,b])=>total+(b-a)/step,0))-candles.length);
  return {...series,candles,firstDate:candles[0].date,lastDate:candles.at(-1).date,gapCount,historyRetrievedAt:page.retrievedAt,historyLoadedBars:Math.max(0,candles.length-history.base.candles.length),sourceUrls:[...new Set([...(series.sourceUrls||[]),...page.sourceUrls])].slice(-64)};
}
