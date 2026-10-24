import { aggregateCandles, CANDLE_DOCUMENTATION, marketProduct, parseCompletedCandleRows, parseMarketSnapshot } from './ohlc-data.js?v=1.15.0';

export const ETH_SNAPSHOT_URL = './data/eth-ohlc.json';
export const ETH_PRODUCT = 'ETH-USD';
const DAY = 86400;

/** The archive contains venue observations only. No interpolation or model is
 * used, including for untraded dates and incomplete edge weeks. */
export function parseEthArchive(payload,intervalId='daily') {
  if (!['daily','weekly'].includes(intervalId)) throw new RangeError('ETH archive supports daily and weekly candles');
  if (payload?.version!==1 || payload?.source!=='Coinbase Exchange' || payload?.product!==ETH_PRODUCT) throw new TypeError('Invalid ETH archive identity');
  const source=payload.dailyHistory;
  if (source?.product!==ETH_PRODUCT || source?.source!=='Coinbase Exchange' || source?.completedOnly!==true) throw new TypeError('Invalid ETH archive metadata');
  const daily=parseCompletedCandleRows(source,'daily',{maxCandles:20000});
  if (source.firstCollectedAt!==undefined && (!Number.isFinite(Date.parse(source.firstCollectedAt)) || Date.parse(source.firstCollectedAt)>Date.parse(source.retrievedAt) || daily.some(row=>row.retrievedAt&&Date.parse(row.retrievedAt)<Date.parse(source.firstCollectedAt)))) throw new TypeError('Invalid ETH archive first collection time');
  if (![source.requestedStart,source.requestedEnd].every(value=>Number.isSafeInteger(value)&&value>0&&value%DAY===0) || source.requestedStart>daily[0].time || source.requestedEnd<daily.at(-1).time+DAY || source.requestedEnd*1000>Date.parse(source.retrievedAt)) throw new TypeError('Invalid ETH archive coverage');
  const aggregated=intervalId==='weekly'?aggregateCandles(daily,'weekly'):{candles:daily,incompleteGroups:0};
  if (!aggregated.candles.length) throw new Error('No completed ETH candles for this interval');
  // A week derives from seven independently collected daily rows. Preserve the
  // latest collection among those seven inputs, not the archive refresh time:
  // refreshing October must not make an untouched May candle appear re-fetched.
  const dailyByTime=intervalId==='weekly'?new Map(daily.map(row=>[row.time,row])):null;
  const candles=intervalId==='weekly'?aggregated.candles.map(row=>({
    ...row,retrievedAt:new Date(Math.max(...Array.from({length:7},(_,index)=>Date.parse(dailyByTime.get(row.time+index*DAY).retrievedAt||source.retrievedAt)))).toISOString(),
  })):daily;
  const seconds=intervalId==='weekly'?7*DAY:DAY;
  const gapCount=candles.slice(1).reduce((sum,row,index)=>sum+Math.max(0,Math.round((row.time-candles[index].time)/seconds)-1),0);
  return {
    ...source,interval:intervalId,seconds,candles,source:'Coinbase Exchange',product:ETH_PRODUCT,
    baseCurrency:'ETH',quoteCurrency:'USD',historyStart:marketProduct(ETH_PRODUCT).historyStart,
    firstDate:candles[0].date,lastDate:candles.at(-1).date,gapCount,
    incompleteGroups:aggregated.incompleteGroups,aggregation:intervalId==='weekly'?'7 × 86400s':'native',
    documentationUrl:CANDLE_DOCUMENTATION,snapshot:true,completedOnly:true,
  };
}

/** Validate every published interval so BTC/USDT snapshots cannot enter ETH. */
export function validateEthSnapshot(payload) {
  const archive=parseEthArchive(payload);
  for (const id of ['1m','5m','15m','30m','1h','4h','daily','weekly']) parseMarketSnapshot(payload,id,{product:ETH_PRODUCT});
  return {firstDate:archive.firstDate,lastDate:archive.lastDate,candles:archive.candles.length,gapCount:archive.gapCount,retrievedAt:archive.retrievedAt};
}

/** A manual refresh may replace recent source rows but cannot erase history or
 * silently label an unqueried time range as checked. Original row collection
 * times survive; only rows actually received again get the new timestamp. */
export function mergeEthArchive(payload,latestDaily) {
  const previous=parseEthArchive(payload);
  if(latestDaily?.product!==ETH_PRODUCT||latestDaily?.source!=='Coinbase Exchange'||latestDaily?.completedOnly!==true)throw new TypeError('Invalid ETH refresh identity');
  const fresh=parseCompletedCandleRows(latestDaily,'daily');
  if(![latestDaily.requestedStart,latestDaily.requestedEnd].every(value=>Number.isSafeInteger(value)&&value>0&&value%DAY===0)||latestDaily.requestedStart>previous.requestedEnd||latestDaily.requestedEnd<previous.requestedEnd||latestDaily.requestedStart>fresh[0].time||latestDaily.requestedEnd<fresh.at(-1).time+DAY||latestDaily.requestedEnd*1000>Date.parse(latestDaily.retrievedAt)||Date.parse(latestDaily.retrievedAt)<Date.parse(previous.retrievedAt))throw new RangeError('ETH refresh does not cover the saved archive boundary');
  const rows=new Map(previous.candles.map(row=>[row.time,{...row,retrievedAt:row.retrievedAt||previous.retrievedAt}]));
  for(const row of fresh)rows.set(row.time,{...row,retrievedAt:latestDaily.retrievedAt});
  const candles=[...rows.values()].sort((a,b)=>a.time-b.time);
  const dailyHistory={
    ...payload.dailyHistory,candles,retrievedAt:latestDaily.retrievedAt,firstCollectedAt:payload.dailyHistory.firstCollectedAt||previous.retrievedAt,requestedEnd:latestDaily.requestedEnd,
    firstDate:candles[0].date,lastDate:candles.at(-1).date,
    gapCount:candles.slice(1).reduce((sum,row,index)=>sum+Math.max(0,(row.time-candles[index].time)/DAY-1),0),
    sourceUrls:[...new Set([...(payload.dailyHistory.sourceUrls||[]),...(latestDaily.sourceUrls||[])])].slice(-64),
  };
  const result={...payload,retrievedAt:latestDaily.retrievedAt,dailyHistory};
  parseEthArchive(result);
  return result;
}
