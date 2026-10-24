import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {parseEquityArchive} from '../dist/equity-market-data.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const numeric=value=>Number(String(value).replace(/[$,]/g,''));
export function compareNasdaqSessions(archive,payload){
  const series=parseEquityArchive(archive),data=payload?.data;
  if(payload?.status?.rCode!==200||data?.symbol!==series.symbol||!Array.isArray(data?.tradesTable?.rows))throw new TypeError('Invalid Nasdaq cross-check response');
  const byDate=new Map(series.candles.map(row=>[row.date.slice(0,10),row]));
  const comparisons=data.tradesTable.rows.map(row=>{
    const [month,day,year]=row.date.split('/'),date=`${year}-${month}-${day}`,stored=byDate.get(date);
    if(!stored)throw new RangeError('Nasdaq date is not in saved equity coverage');
    const differences=Object.fromEntries(['open','high','low','close'].map(key=>[key,Math.abs(stored[key]-numeric(row[key]))]));
    if(!Object.values(differences).every(Number.isFinite))throw new TypeError('Invalid Nasdaq OHLC');
    const volume=numeric(row.volume);if(!Number.isFinite(volume)||volume<0)throw new TypeError('Invalid Nasdaq volume');
    return {date,close:stored.close,comparisonClose:numeric(row.close),priceAbsoluteDifferences:differences,providerVolume:stored.volume,comparisonVolume:volume,volumeDifferencePct:volume?(stored.volume/volume-1)*100:null};
  });
  if(!comparisons.length)throw new Error('No overlapping Nasdaq sessions');
  const maxCloseDifference=Math.max(...comparisons.map(row=>row.priceAbsoluteDifferences.close));
  const maxOHLCPriceDifference=Math.max(...comparisons.flatMap(row=>Object.values(row.priceAbsoluteDifferences)));
  return {symbol:series.symbol,scope:'latest-five-trading-sessions-only',comparedSessions:comparisons.length,maxCloseDifference,maxOHLCPriceDifference,closeToleranceUsd:0.01,ohlcToleranceUsd:0.01,status:maxCloseDifference<=0.01&&maxOHLCPriceDifference<=0.01?'within-price-tolerance':'price-mismatch',volumeStatus:'provider-differences-disclosed-not-harmonized',comparisons,note:'독립 제공 화면의 최근 5개 세션만 비교. 전체 과거 이력·매매 체결·가격 산출 방식의 일치 증명이 아닙니다. 거래량 차이는 실제 제공 값으로 보존합니다.'};
}
if(resolve(process.argv[1]||'')===fileURLToPath(import.meta.url)){
  const results=[];
  for(const symbol of ['MSTR','BMNR']){
    const archive=JSON.parse(await readFile(resolve(root,`dist/data/${symbol.toLowerCase()}-ohlc.json`),'utf8')),last=archive.candles.at(-1).date.slice(0,10),first=archive.candles.at(-5).date.slice(0,10);
    const sourceUrl=`https://api.nasdaq.com/api/quote/${symbol}/historical?assetclass=stocks&fromdate=${first}&todate=${last}&limit=10`;
    const response=await fetch(sourceUrl,{headers:{'User-Agent':'Mozilla/5.0','Accept':'application/json','Referer':'https://www.nasdaq.com/'},signal:AbortSignal.timeout(25000)});if(!response.ok)throw new Error(`Nasdaq HTTP ${response.status}`);
    const body=await response.text(),result={...compareNasdaqSessions(archive,JSON.parse(body)),sourceUrl,comparisonProvider:'Nasdaq',retrievedAt:new Date().toISOString(),responseSha256:createHash('sha256').update(body).digest('hex'),archiveRetrievedAt:archive.retrievedAt,archiveResponseSha256:archive.responseSha256};
    if(result.status!=='within-price-tolerance')throw new Error(`${symbol} price cross-check failed`);
    results.push(result);
    archive.validation={status:result.status,scope:result.scope,comparedSessions:result.comparedSessions,sourceUrl,comparisonProvider:result.comparisonProvider,retrievedAt:result.retrievedAt,maxCloseDifference:result.maxCloseDifference,maxOHLCPriceDifference:result.maxOHLCPriceDifference,volumeStatus:result.volumeStatus,note:result.note};
    await writeFile(resolve(root,`dist/data/${symbol.toLowerCase()}-ohlc.json`),`${JSON.stringify(archive)}\n`);
    console.log(JSON.stringify({symbol,status:result.status,comparedSessions:result.comparedSessions,maxCloseDifference:result.maxCloseDifference,maxOHLCPriceDifference:result.maxOHLCPriceDifference}));
  }
  await mkdir(resolve(root,'research-data'),{recursive:true});await writeFile(resolve(root,'research-data/equity-price-validation.json'),`${JSON.stringify({version:1,results},null,2)}\n`);
}
