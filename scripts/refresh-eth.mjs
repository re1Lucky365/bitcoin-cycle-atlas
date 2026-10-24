import { readFile, writeFile, mkdir, rename, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHART_INTERVALS, fetchMarketCandles, CANDLE_DOCUMENTATION } from '../dist/ohlc-data.js';
import { ETH_PRODUCT, parseEthArchive, validateEthSnapshot } from '../dist/eth-market-data.js';
import { mergeCandleRows } from '../dist/intraday-history.js';

const DAY=86400;
// Probe before this venue's first ETH candle; keep the actual first returned
// observation as the archive's start instead of filling its pre-listing dates.
export const ETH_ARCHIVE_QUERY_START=Date.parse('2016-01-01T00:00:00Z')/1000;
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');

/** Build completely in memory. A failed page/interval never publishes a partial
 * archive, changes its collection date or overwrites the previous saved file. */
export async function refreshEthSnapshot({prior=null,now=Date.now(),fetchImpl=globalThis.fetch,onProgress=()=>{},requestGapMs=125}={}) {
  if (!Number.isFinite(now)||now<=0) throw new RangeError('Invalid refresh cutoff');
  if (!Number.isFinite(requestGapMs)||requestGapMs<0||requestGapMs>10000) throw new RangeError('Invalid exchange request gap');
  let lastRequestAt=0;
  const providerFetch=async(url,options)=>{
    const wait=Math.max(0,requestGapMs-(Date.now()-lastRequestAt));
    if(wait)await new Promise(resolve=>setTimeout(resolve,wait));
    options?.signal?.throwIfAborted();lastRequestAt=Date.now();
    return fetchImpl(url,options);
  };
  const previous=prior?parseEthArchive(prior):null;
  if (prior) validateEthSnapshot(prior);
  const cutoff=Math.floor(now/1000/DAY)*DAY;
  if (previous&&cutoff<previous.requestedEnd) throw new RangeError('Refresh cutoff precedes the saved ETH archive');
  const start=previous?Math.max(ETH_ARCHIVE_QUERY_START,previous.requestedEnd-7*DAY):ETH_ARCHIVE_QUERY_START;
  const pages=[],urls=[];
  for(let cursor=start;cursor<cutoff;cursor+=290*DAY){
    const end=Math.min(cutoff,cursor+290*DAY);
    const page=await fetchMarketCandles({product:ETH_PRODUCT,interval:'daily',start:cursor,end,allowEmpty:true,now,fetchImpl:providerFetch,signal:AbortSignal.timeout(30000)});
    pages.push(...page.candles.map(row=>({...row,retrievedAt:page.retrievedAt})));urls.push(...page.sourceUrls);
    onProgress({kind:'history',start:cursor,end,candles:page.candles.length});
  }
  const candles=mergeCandleRows((previous?.candles||[]).map(row=>({...row,retrievedAt:row.retrievedAt||previous.retrievedAt})),pages);
  if(!candles.length) throw new Error('ETH daily archive has no completed exchange observations');
  const retrievedAt=new Date(now).toISOString();
  const dailyHistory={
    interval:'daily',seconds:DAY,source:'Coinbase Exchange',product:ETH_PRODUCT,baseCurrency:'ETH',quoteCurrency:'USD',
    retrievedAt,firstCollectedAt:prior?.dailyHistory?.firstCollectedAt||previous?.retrievedAt||retrievedAt,
    requestedStart:previous?.requestedStart??ETH_ARCHIVE_QUERY_START,requestedEnd:cutoff,
    firstDate:candles[0].date,lastDate:candles.at(-1).date,
    gapCount:candles.slice(1).reduce((sum,row,index)=>sum+Math.max(0,(row.time-candles[index].time)/DAY-1),0),
    completedOnly:true,aggregation:'native',documentationUrl:CANDLE_DOCUMENTATION,
    sourceUrls:[...new Set([...(prior?.dailyHistory?.sourceUrls||[]),...urls])].slice(-64),candles,
  };
  const intervals={};
  for(const interval of CHART_INTERVALS){
    if(interval.id==='daily'||interval.id==='weekly'){
      const series=parseEthArchive({version:1,source:'Coinbase Exchange',product:ETH_PRODUCT,dailyHistory},interval.id);
      const rows=series.candles.slice(-180);
      intervals[interval.id]={...series,candles:rows,firstDate:rows[0].date,lastDate:rows.at(-1).date,requestedStart:rows[0].time,requestedEnd:rows.at(-1).time+series.seconds};
      delete intervals[interval.id].snapshot;
      intervals[interval.id].gapCount=rows.slice(1).reduce((sum,row,index)=>sum+Math.max(0,(row.time-rows[index].time)/series.seconds-1),0);
    } else {
      intervals[interval.id]=await fetchMarketCandles({product:ETH_PRODUCT,interval:interval.id,count:180,now,fetchImpl:providerFetch,signal:AbortSignal.timeout(30000)});
    }
    onProgress({kind:'interval',interval:interval.id,candles:intervals[interval.id].candles.length});
  }
  const result={version:1,source:'Coinbase Exchange',product:ETH_PRODUCT,retrievedAt,dailyHistory,intervals};
  validateEthSnapshot(result);
  return result;
}

export async function refreshEthFile(output,{now=Date.now(),fetchImpl=globalThis.fetch,onProgress=()=>{},requestGapMs=125}={}) {
  let prior=null;
  try {prior=JSON.parse(await readFile(output,'utf8'));}
  catch(error){if(error.code!=='ENOENT')throw error;}
  const result=await refreshEthSnapshot({prior,now,fetchImpl,onProgress,requestGapMs});
  await mkdir(dirname(output),{recursive:true});
  const temporary=`${output}.tmp-${process.pid}`;
  try {await writeFile(temporary,`${JSON.stringify(result)}\n`,{flag:'wx'});await rename(temporary,output);}
  finally {await rm(temporary,{force:true});}
  return result;
}

if(resolve(process.argv[1]||'')===fileURLToPath(import.meta.url)){
  const output=resolve(process.argv[2]||resolve(root,'dist/data/eth-ohlc.json'));
  const result=await refreshEthFile(output,{onProgress:event=>console.error(JSON.stringify(event))});
  console.log(JSON.stringify({status:'ok',output,...validateEthSnapshot(result),intervals:Object.keys(result.intervals)}));
}
