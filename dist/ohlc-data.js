export const CANDLE_ENDPOINT = 'https://api.exchange.coinbase.com/products/BTC-USD/candles';
export const CANDLE_DOCUMENTATION = 'https://docs.cdp.coinbase.com/api-reference/exchange-api/rest-api/products/get-product-candles';
export const CHART_INTERVALS = Object.freeze([
  {id:'1m',label:'1m',seconds:60,sourceSeconds:60},
  {id:'5m',label:'5m',seconds:300,sourceSeconds:300},
  {id:'15m',label:'15m',seconds:900,sourceSeconds:900},
  {id:'30m',label:'30m',seconds:1800,sourceSeconds:900},
  {id:'1h',label:'1h',seconds:3600,sourceSeconds:3600},
  {id:'4h',label:'4h',seconds:14400,sourceSeconds:3600},
  {id:'daily',label:'1D',seconds:86400,sourceSeconds:86400},
  {id:'weekly',label:'1W',seconds:604800,sourceSeconds:86400}
].map(Object.freeze));
const sourceIntervals = new Set([60,300,900,3600,21600,86400]);
const iso = seconds => new Date(seconds * 1000).toISOString();
const finitePositive = value => typeof value === 'number' && Number.isFinite(value) && value > 0;

export function chartInterval(id) {
  const result = CHART_INTERVALS.find(interval => interval.id === id);
  if (!result) throw new RangeError('Unsupported candle interval');
  return result;
}
export const isIntradayInterval = id => CHART_INTERVALS.some(interval => interval.id === id && interval.seconds < 86400);

/** The source's six fields are time, low, high, open, close and volume. */
export function parseCoinbaseCandles(payload, {sourceSeconds, now=Date.now(), start=-Infinity, end=Infinity}={}) {
  if (!sourceIntervals.has(sourceSeconds)) throw new RangeError('Unsupported source interval');
  if (!Number.isFinite(now) || now <= 0) throw new RangeError('Invalid candle cutoff');
  if (!Array.isArray(payload) || payload.length > 1000) throw new TypeError('Invalid candle response');
  const seen = new Set(), candles = [];
  let excludedUnfinished = 0;
  for (const raw of payload) {
    if (!Array.isArray(raw) || raw.length !== 6) throw new TypeError('Expected six candle fields');
    const [time,low,high,open,close,volume] = raw;
    if (!Number.isSafeInteger(time) || time <= 0 || time % sourceSeconds !== 0 || ![low,high,open,close].every(finitePositive) || typeof volume !== 'number' || !Number.isFinite(volume) || volume < 0) throw new TypeError('Invalid candle values');
    if (low > Math.min(open,close) || high < Math.max(open,close) || low > high) throw new RangeError('Inconsistent OHLC candle');
    if (seen.has(time)) throw new Error('Duplicate candle timestamp');
    seen.add(time);
    if (time < start || time >= end) continue;
    if ((time + sourceSeconds) * 1000 > now) { excludedUnfinished++; continue; }
    candles.push({time,date:iso(time),open,high,low,close,volume});
  }
  candles.sort((a,b) => a.time - b.time);
  return {candles,excludedUnfinished};
}

/** Weekly buckets start Monday 00:00 UTC; all source buckets must be present. */
export function aggregateCandles(candles, intervalId) {
  const interval = chartInterval(intervalId), factor = interval.seconds / interval.sourceSeconds;
  const origin = intervalId === 'weekly' ? 4 * 86400 : 0;
  const groups = new Map();
  for (const candle of candles) {
    const time = Math.floor((candle.time-origin)/interval.seconds)*interval.seconds+origin;
    if (!groups.has(time)) groups.set(time,[]);
    groups.get(time).push(candle);
  }
  const result = [];
  let incompleteGroups = 0;
  for (const [time,rows] of [...groups.entries()].sort((a,b)=>a[0]-b[0])) {
    rows.sort((a,b)=>a.time-b.time);
    if (rows.length !== factor || rows.some((row,index)=>row.time!==time+index*interval.sourceSeconds)) { incompleteGroups++; continue; }
    result.push({time,date:iso(time),open:rows[0].open,high:Math.max(...rows.map(row=>row.high)),low:Math.min(...rows.map(row=>row.low)),close:rows.at(-1).close,volume:rows.reduce((sum,row)=>sum+row.volume,0)});
  }
  return {candles:result,incompleteGroups};
}

export async function fetchMarketCandles({interval:intervalId='15m',signal,count=180,now=Date.now(),fetchImpl=globalThis.fetch}={}) {
  const interval = chartInterval(intervalId);
  if (!Number.isInteger(count) || count < 2 || count > 300) throw new RangeError('Candle count must be 2–300');
  if (!Number.isFinite(now) || now <= 0) throw new RangeError('Invalid candle cutoff');
  const origin = intervalId==='weekly'?4*86400:0;
  const end = Math.floor((Math.floor(now/1000)-origin)/interval.seconds)*interval.seconds+origin;
  const start = end-count*interval.seconds;
  const rawCandles = [], sourceUrls = [];
  let excludedUnfinished = 0;
  for (let cursor=start;cursor<end;cursor+=interval.sourceSeconds*290) {
    signal?.throwIfAborted?.();
    const pageEnd = Math.min(end,cursor+interval.sourceSeconds*290);
    const url = new URL(CANDLE_ENDPOINT);
    url.searchParams.set('granularity',String(interval.sourceSeconds));
    url.searchParams.set('start',iso(cursor));url.searchParams.set('end',iso(pageEnd));
    const response = await fetchImpl(url.href,{method:'GET',mode:'cors',credentials:'omit',redirect:'error',cache:'no-cache',headers:{Accept:'application/json'},signal});
    if (!response.ok) throw new Error(`Coinbase candles HTTP ${response.status}`);
    const parsed = parseCoinbaseCandles(await response.json(),{sourceSeconds:interval.sourceSeconds,now,start:cursor,end:pageEnd});
    rawCandles.push(...parsed.candles);excludedUnfinished += parsed.excludedUnfinished;sourceUrls.push(url.href);
  }
  signal?.throwIfAborted?.();
  const aggregated = aggregateCandles(rawCandles,intervalId), candles=aggregated.candles;
  if (!candles.length) throw new Error('No completed candles in the requested interval');
  const gapCount=candles.slice(1).reduce((sum,candle,index)=>sum+Math.max(0,Math.round((candle.time-candles[index].time)/interval.seconds)-1),0);
  return {interval:intervalId,seconds:interval.seconds,candles,source:'Coinbase Exchange',product:'BTC-USD',retrievedAt:new Date(now).toISOString(),firstDate:candles[0].date,lastDate:candles.at(-1).date,excludedUnfinished,gapCount,incompleteGroups:aggregated.incompleteGroups,aggregation:interval.seconds===interval.sourceSeconds?'native':`${interval.seconds/interval.sourceSeconds} × ${interval.sourceSeconds}s`,sourceUrls,documentationUrl:CANDLE_DOCUMENTATION,completedOnly:true};
}

/** Saved snapshots carry their original collection time, never the current time. */
export function parseMarketSnapshot(payload,intervalId) {
  const interval=chartInterval(intervalId), source=payload?.intervals?.[intervalId];
  if (payload?.version!==1 || payload?.source!=='Coinbase Exchange' || payload?.product!=='BTC-USD' || !source || source.interval!==intervalId || source.seconds!==interval.seconds || !Number.isFinite(Date.parse(source.retrievedAt))) throw new TypeError('Invalid market snapshot metadata');
  if (!Array.isArray(source.candles) || source.candles.length<1 || source.candles.length>300) throw new TypeError('Invalid market snapshot candles');
  const now=Date.parse(source.retrievedAt), origin=intervalId==='weekly'?4*86400:0;
  let previous=-Infinity;
  const candles=source.candles.map(row=>{
    if (!Number.isSafeInteger(row.time) || row.time<=previous || (row.time-origin)%interval.seconds!==0 || row.date!==iso(row.time) || ![row.open,row.high,row.low,row.close].every(finitePositive) || !Number.isFinite(row.volume) || row.volume<0 || row.low>Math.min(row.open,row.close) || row.high<Math.max(row.open,row.close) || (row.time+interval.seconds)*1000>now) throw new TypeError('Invalid saved candle');
    previous=row.time;
    return {time:row.time,date:row.date,open:row.open,high:row.high,low:row.low,close:row.close,volume:row.volume};
  });
  return {...source,candles,source:'Coinbase Exchange',product:'BTC-USD',firstDate:candles[0].date,lastDate:candles.at(-1).date,snapshot:true,completedOnly:true};
}
