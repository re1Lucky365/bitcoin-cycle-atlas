import {readFile,writeFile,rename,mkdir,rm} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const DAY=86400000;
const sha256=value=>createHash('sha256').update(value).digest('hex');
const utcDate=value=>new Date(value).toISOString().slice(0,10);
const dayNumber=value=>Date.parse(`${value}T00:00:00Z`)/DAY;
const isDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(`${value}T00:00:00Z`))&&utcDate(Date.parse(`${value}T00:00:00Z`))===value;
export const ASSET_COMPARISON_UNIVERSE=Object.freeze([
  {symbol:'SPY',name:'S&P 500',group:'위험 자산',category:'Index ETF',type:'ETF',firstYear:1993},
  {symbol:'QQQ',name:'NASDAQ 100',group:'위험 자산',category:'Index ETF',type:'ETF',firstYear:1999},
  {symbol:'NVDA',name:'엔비디아',group:'위험 자산',category:'대형 기술주',type:'EQUITY',firstYear:1999},
  {symbol:'AAPL',name:'애플',group:'위험 자산',category:'대형 기술주',type:'EQUITY',firstYear:1980},
  {symbol:'GOOG',name:'알파벳',group:'위험 자산',category:'대형 기술주',type:'EQUITY',firstYear:2004},
  {symbol:'MSFT',name:'마이크로소프트',group:'위험 자산',category:'대형 기술주',type:'EQUITY',firstYear:1986},
  {symbol:'AMZN',name:'아마존',group:'위험 자산',category:'대형 기술주',type:'EQUITY',firstYear:1997},
  {symbol:'META',name:'메타',group:'위험 자산',category:'대형 기술주',type:'EQUITY',firstYear:2012},
  {symbol:'AVGO',name:'브로드컴',group:'위험 자산',category:'대형 기술주',type:'EQUITY',firstYear:2009},
  {symbol:'PLTR',name:'팔란티어',group:'위험 자산',category:'개별주',type:'EQUITY',firstYear:2020},
  {symbol:'TSLA',name:'테슬라',group:'위험 자산',category:'개별주',type:'EQUITY',firstYear:2010},
  {symbol:'HOOD',name:'로빈후드',group:'위험 자산',category:'개별주',type:'EQUITY',firstYear:2021},
  {symbol:'TLT',name:'미국 장기채권',group:'안전 자산',category:'채권',type:'ETF',firstYear:2002},
  {symbol:'IEF',name:'미국 중기채권',group:'안전 자산',category:'채권',type:'ETF',firstYear:2002},
  {symbol:'GLD',name:'금',group:'안전 자산',category:'금',type:'ETF',firstYear:2004},
  {symbol:'SLV',name:'은',group:'안전 자산',category:'은',type:'ETF',firstYear:2006},
  {symbol:'PDBC',name:'원자재',group:'대체자산',category:'원자재',type:'ETF',firstYear:2014},
]);
const dates=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'});
function sessionDate(seconds){
  if(!Number.isSafeInteger(seconds))throw new TypeError('Invalid provider session timestamp');
  const parts=Object.fromEntries(dates.formatToParts(new Date(seconds*1000)).map(p=>[p.type,p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function definition(symbol){
  const entry=ASSET_COMPARISON_UNIVERSE.find(item=>item.symbol===symbol);
  if(!entry)throw new TypeError('Unsupported comparison asset');
  return entry;
}
export function assetComparisonSourceUrl(symbol,now=Date.now()){
  definition(symbol);
  if(!Number.isFinite(now)||now<0)throw new TypeError('Invalid retrieval time');
  // range=max can silently change daily observations into monthly bars. An
  // explicit 1970 boundary covers the earliest requested listing (AAPL 1980).
  return `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=0&period2=${Math.floor(now/1000)}&interval=1d&events=history%2Csplits%2Cdividends`;
}
export function parseYahooComparisonAsset(payload,{symbol,retrievedAt,sourceUrl,responseSha256}={}){
  const asset=definition(symbol),result=payload?.chart?.result?.[0],meta=result?.meta,quote=result?.indicators?.quote?.[0];
  if(payload?.chart?.error||meta?.symbol!==symbol||meta?.currency!=='USD'||meta?.instrumentType!==asset.type||meta?.exchangeTimezoneName!=='America/New_York'||meta?.dataGranularity!=='1d')throw new TypeError(`${symbol}: provider identity or daily granularity mismatch`);
  const now=Date.parse(retrievedAt);
  if(!Number.isFinite(now)||!Array.isArray(result.timestamp)||!Array.isArray(quote?.close)||quote.close.length!==result.timestamp.length)throw new TypeError(`${symbol}: invalid provider arrays`);
  const cutoff=utcDate(now),prices=[],unavailableSessions=[];let excludedIncomplete=0,previousTimestamp=-Infinity;
  for(let index=0;index<result.timestamp.length;index++){
    const timestamp=result.timestamp[index];
    if(timestamp<=previousTimestamp)throw new TypeError(`${symbol}: unsorted provider timestamps`);
    previousTimestamp=timestamp;
    const date=sessionDate(timestamp),close=quote.close[index];
    if(date>=cutoff){excludedIncomplete++;continue;}
    if(close===null||close===undefined){unavailableSessions.push(date);continue;}
    if(!Number.isFinite(close)||close<=0||prices.at(-1)?.[0]>=date)throw new TypeError(`${symbol}: invalid daily close or duplicate date`);
    prices.push([date,close]);
  }
  if(!prices.length)throw new RangeError(`${symbol}: no completed daily sessions`);
  const splits=Object.values(result.events?.splits||{}).map(item=>({date:sessionDate(item.date),numerator:item.numerator,denominator:item.denominator,ratio:item.splitRatio}));
  const output={symbol,name:asset.name,group:asset.group,category:asset.category,currency:'USD',prices,meta:{
    sourceName:'Yahoo Finance',sourceUrl,sourcePage:`https://finance.yahoo.com/quote/${symbol}/history/`,
    priceDefinition:'Provider split-adjusted daily close in USD; cash dividends and distributions are excluded, not total return.',
    adjustment:'split-adjusted-close',calendar:'sessions',exchangeTimezone:'America/New_York',exchange:meta.fullExchangeName,
    instrumentType:meta.instrumentType,dataGranularity:'1d',retrievedAt,responseSha256,pricesSha256:sha256(JSON.stringify(prices)),
    firstDate:prices[0][0],lastDate:prices.at(-1)[0],count:prices.length,
    providerFirstTradeDate:Number.isSafeInteger(meta.firstTradeDate)?sessionDate(meta.firstTradeDate):null,
    completedOnly:true,completionRule:'session-date-before-retrieval-utc-date',excludedIncomplete,unavailableSessions,missingDates:[...unavailableSessions],splits,
    coverageNote:'Full provider daily history requested from 1970. The inception/listing calendar year is a partial-year sample; the current calendar year is not a completed historical sample.',
  }};
  validateAsset(output,{retrievedAt});return output;
}
function validateAsset(asset,{retrievedAt}){
  const expected=definition(asset?.symbol),meta=asset.meta;
  if(asset.name!==expected.name||asset.group!==expected.group||asset.category!==expected.category||asset.currency!=='USD'||!Array.isArray(asset.prices)||!asset.prices.length)throw new TypeError(`${expected.symbol}: invalid archive identity`);
  if(meta?.sourceName!=='Yahoo Finance'||meta.adjustment!=='split-adjusted-close'||meta.calendar!=='sessions'||meta.dataGranularity!=='1d'||meta.completedOnly!==true||meta.completionRule!=='session-date-before-retrieval-utc-date'||meta.exchangeTimezone!=='America/New_York'||meta.instrumentType!==expected.type||meta.retrievedAt!==retrievedAt||meta.sourceUrl!==assetComparisonSourceUrl(expected.symbol,Date.parse(retrievedAt))||!/^[a-f0-9]{64}$/.test(meta.responseSha256))throw new TypeError(`${expected.symbol}: invalid archive provenance`);
  const cutoff=utcDate(Date.parse(retrievedAt)),years=new Map();let previous='',maxGapDays=0;
  for(const pair of asset.prices){
    if(!Array.isArray(pair)||pair.length!==2||!isDate(pair[0])||pair[0]<=previous||pair[0]>=cutoff||!Number.isFinite(pair[1])||pair[1]<=0)throw new TypeError(`${expected.symbol}: invalid archived price`);
    if(previous)maxGapDays=Math.max(maxGapDays,dayNumber(pair[0])-dayNumber(previous));
    previous=pair[0];const year=Number(pair[0].slice(0,4));years.set(year,(years.get(year)||0)+1);
  }
  const first=asset.prices[0][0],last=asset.prices.at(-1)[0],firstYear=Number(first.slice(0,4)),lastYear=Number(last.slice(0,4));
  if(first!==meta.firstDate||last!==meta.lastDate||first!==meta.providerFirstTradeDate||asset.prices.length!==meta.count||sha256(JSON.stringify(asset.prices))!==meta.pricesSha256)throw new TypeError(`${expected.symbol}: archive coverage or hash mismatch`);
  if(firstYear!==expected.firstYear)throw new RangeError(`${expected.symbol}: expected listing/inception year ${expected.firstYear}, received ${firstYear}; investigate history before accepting`);
  for(let year=firstYear;year<=lastYear;year++){
    if(!years.has(year))throw new RangeError(`${expected.symbol}: absent calendar year ${year}`);
    if(year>firstYear&&year<lastYear&&(years.get(year)<200||years.get(year)>263))throw new RangeError(`${expected.symbol}: implausible daily coverage for ${year}: ${years.get(year)}`);
  }
  if(dayNumber(cutoff)-dayNumber(last)>7)throw new RangeError(`${expected.symbol}: provider history is more than seven calendar days stale`);
  if(maxGapDays>10)throw new RangeError(`${expected.symbol}: historical price gap exceeds ten calendar days`);
  const observed=new Set(asset.prices.map(row=>row[0])),peerMissing=meta.peerSessionCheck?.missingDates||[];
  const invalidMissing=values=>!Array.isArray(values)||values.some((date,index)=>!isDate(date)||date>=cutoff||observed.has(date)||(index>0&&date<=values[index-1]));
  const allMissing=[...new Set([...(Array.isArray(meta.unavailableSessions)?meta.unavailableSessions:[]),...(Array.isArray(peerMissing)?peerMissing:[])])].sort();
  if(invalidMissing(meta.unavailableSessions)||invalidMissing(peerMissing)||JSON.stringify(meta.missingDates)!==JSON.stringify(allMissing)||!Number.isSafeInteger(meta.excludedIncomplete)||meta.excludedIncomplete<0)throw new TypeError(`${expected.symbol}: invalid unavailable-session metadata`);
  return {symbol:asset.symbol,firstDate:first,lastDate:last,observations:asset.prices.length,completedCalendarLabels:[...years.keys()].filter(year=>year<Number(cutoff.slice(0,4))).length,firstYearSessions:years.get(firstYear),maxGapDays,unavailableSessions:meta.unavailableSessions.length};
}
export function crossAssetSessionCoverage(bundle){
  const owners=new Map();
  for(const asset of bundle.assets)for(const [date] of asset.prices){
    if(!owners.has(date))owners.set(date,new Set());owners.get(date).add(asset.symbol);
  }
  const union=[...owners.keys()].sort();
  return bundle.assets.map(asset=>{
    const own=new Set(asset.prices.map(row=>row[0])),first=asset.prices[0][0],last=asset.prices.at(-1)[0];
    const peers=union.filter(date=>date>=first&&date<=last&&owners.get(date).size>(owners.get(date).has(asset.symbol)?1:0));
    const missingDates=peers.filter(date=>!own.has(date)),matchedSessions=peers.length-missingDates.length;
    return {method:'union-of-other-assets-observed-session-dates',firstPeerDate:peers[0]||null,lastPeerDate:peers.at(-1)||null,peerObservedSessions:peers.length,matchedSessions,unpairedSessions:own.size-matchedSessions,missingDates};
  });
}
export function attachPeerSessionMetadata(bundle){
  const comparisons=crossAssetSessionCoverage(bundle);
  for(let index=0;index<bundle.assets.length;index++){
    const meta=bundle.assets[index].meta;meta.peerSessionCheck=comparisons[index];
    meta.missingDates=[...new Set([...meta.unavailableSessions,...comparisons[index].missingDates])].sort();
  }
  return bundle;
}
export function validateAssetComparisonBundle(bundle){
  if(bundle?.version!==1||!Number.isFinite(Date.parse(bundle.retrievedAt))||!Array.isArray(bundle.assets)||bundle.assets.length!==ASSET_COMPARISON_UNIVERSE.length)throw new TypeError('Invalid asset-comparison bundle');
  if(bundle.assets.some((asset,index)=>asset.symbol!==ASSET_COMPARISON_UNIVERSE[index].symbol))throw new TypeError('Comparison universe ordering or membership mismatch');
  const coverage=bundle.assets.map(asset=>validateAsset(asset,bundle)),comparisons=crossAssetSessionCoverage(bundle);
  return coverage.map((entry,index)=>{
    if(JSON.stringify(bundle.assets[index].meta.peerSessionCheck)!==JSON.stringify(comparisons[index]))throw new TypeError(`${entry.symbol}: cross-asset session metadata mismatch`);
    return {...entry,peerMatchedSessions:comparisons[index].matchedSessions,peerMissingSessions:comparisons[index].missingDates.length,unpairedSessions:comparisons[index].unpairedSessions};
  });
}
export function assetComparisonAcquisitionManifest(bundle){
  const coverage=validateAssetComparisonBundle(bundle);
  return {
    version:1,retrievedAt:bundle.retrievedAt,source:'Yahoo Finance chart endpoint',
    requestStart:'1970-01-01',interval:'1d',priceField:'indicators.quote[0].close',
    priceDefinition:'Split-adjusted closing market price in USD; dividends and distributions excluded.',
    completionRule:'Exchange session date strictly before the retrieval UTC date.',
    historyPolicy:'Full available provider history; listing year may be partial. No interpolation, screenshot values, or substitute tickers.',
    totalObservations:coverage.reduce((sum,asset)=>sum+asset.observations,0),
    assets:coverage.map((entry,index)=>({...entry,providerFirstTradeDate:bundle.assets[index].meta.providerFirstTradeDate,sourceUrl:bundle.assets[index].meta.sourceUrl,sourcePage:bundle.assets[index].meta.sourcePage,responseSha256:bundle.assets[index].meta.responseSha256,pricesSha256:bundle.assets[index].meta.pricesSha256})),
    primaryCrossChecks:[
      {symbol:'PDBC',fact:'Issuer inception is 2014-11-07; include its 37 observed 2014 sessions when counting available calendar labels in this snapshot.',url:'https://www.invesco.com/us/en/insights/opportunities-commodities-amid-volatility.html'},
      {fact:'Yahoo historical close is split-adjusted; adjusted close additionally accounts for distributions.',url:'https://finance.yahoo.com/quote/SPY/history/'},
    ],
    limits:['Observed session dates are cross-checked against other requested US-listed assets within each own history range. Shared provider omissions and periods without a peer are not certified against an exchange calendar.','The first calendar sample can be shorter than a year; the current calendar year is not a completed historical sample.','GOOG and AVGO use the provider\'s continuous history through share-class/corporate changes; their first date does not imply the present legal share class existed on that date.'],
  };
}
async function fetchWithRetry(sourceUrl,{fetchImpl,symbol}){
  for(let attempt=0;attempt<3;attempt++){
    let response;
    try{response=await fetchImpl(sourceUrl,{headers:{'User-Agent':'Bitcoin-Cycle-Atlas research / https://github.com/twoimo/bitcoin-cycle-atlas'},signal:AbortSignal.timeout(45000)});}
    catch(error){if(attempt===2)throw error;await new Promise(done=>setTimeout(done,1000*2**attempt));continue;}
    if(response.ok)return response;
    const error=new Error(`${symbol}: provider HTTP ${response.status}`);
    if(attempt===2||![429,500,502,503,504].includes(response.status))throw error;
    const retryAfter=response.headers?.get?.('retry-after');
    const requestedDelay=retryAfter==null?0:/^\d+$/.test(retryAfter)?Number(retryAfter)*1000:Math.max(0,Date.parse(retryAfter)-Date.now());
    // Respect a long server cooldown by stopping; a scheduler can try later.
    if(!Number.isFinite(requestedDelay)||requestedDelay>30000)throw error;
    await new Promise(done=>setTimeout(done,Math.max(requestedDelay,1000*2**attempt)));
  }
}
export async function fetchAssetComparisonBundle({now=Date.now(),fetchImpl=globalThis.fetch,onAsset=()=>{}}={}){
  const retrievedAt=new Date(now).toISOString(),assets=new Array(ASSET_COMPARISON_UNIVERSE.length);let next=0,failed=false;
  async function worker(){
    for(let index=next++;index<assets.length&&!failed;index=next++){
      try{
      const {symbol}=ASSET_COMPARISON_UNIVERSE[index],sourceUrl=assetComparisonSourceUrl(symbol,now);
      const response=await fetchWithRetry(sourceUrl,{fetchImpl,symbol});
      const raw=await response.text();
      assets[index]=parseYahooComparisonAsset(JSON.parse(raw),{symbol,retrievedAt,sourceUrl,responseSha256:sha256(raw)});
      onAsset(validateAsset(assets[index],{retrievedAt}));
      }catch(error){failed=true;throw error;}
    }
  }
  const results=await Promise.allSettled(Array.from({length:3},worker));
  const failure=results.find(result=>result.status==='rejected');if(failure)throw failure.reason;
  const bundle=attachPeerSessionMetadata({version:1,retrievedAt,assets});validateAssetComparisonBundle(bundle);return bundle;
}
export async function refreshAssetComparisonFile(output,{now=Date.now(),fetchImpl=globalThis.fetch,onAsset}={}){
  let previous=null;
  try{previous=JSON.parse(await readFile(output,'utf8'));validateAssetComparisonBundle(previous);}catch(error){if(error.code!=='ENOENT')throw error;}
  const next=await fetchAssetComparisonBundle({now,fetchImpl,onAsset});
  if(previous)for(let index=0;index<next.assets.length;index++){
    const old=previous.assets[index],asset=next.assets[index];
    if(asset.meta.firstDate>old.meta.firstDate||asset.meta.lastDate<old.meta.lastDate||asset.prices.length<old.prices.length)throw new Error(`${asset.symbol}: refresh would truncate existing history`);
    const dates=new Set(asset.prices.map(row=>row[0]));
    if(old.prices.some(row=>!dates.has(row[0])))throw new Error(`${asset.symbol}: refresh omits previously observed session`);
  }
  await mkdir(dirname(output),{recursive:true});const temporary=`${output}.tmp-${process.pid}`;
  try{await writeFile(temporary,`${JSON.stringify(next)}\n`,{flag:'wx'});await rename(temporary,output);}finally{await rm(temporary,{force:true});}
  return next;
}
if(resolve(process.argv[1]||'')===fileURLToPath(import.meta.url)){
  const output=resolve(root,'dist/data/asset-comparison.json'),manifestPath=resolve(root,'docs/data/asset-comparison-acquisition.json');
  const writeManifest=process.argv.includes('--write-manifest'),localOnly=process.argv.includes('--check')||writeManifest;
  const bundle=localOnly?JSON.parse(await readFile(output,'utf8')):await refreshAssetComparisonFile(output,{onAsset:asset=>console.log(JSON.stringify(asset))});
  // The manifest is a dated research checkpoint. Routine data-only refreshes
  // and --check must not depend on its historical retrieval timestamp.
  if(writeManifest){
    await mkdir(dirname(manifestPath),{recursive:true});await writeFile(manifestPath,`${JSON.stringify(assetComparisonAcquisitionManifest(bundle),null,2)}\n`);
  }
  console.log(JSON.stringify({status:'PASS',retrievedAt:bundle.retrievedAt,assets:validateAssetComparisonBundle(bundle)}));
}
