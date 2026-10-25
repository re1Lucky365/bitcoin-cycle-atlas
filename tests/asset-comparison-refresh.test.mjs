import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {
  assetComparisonSourceUrl,parseYahooComparisonAsset,validateAssetComparisonBundle,
  attachPeerSessionMetadata,refreshAssetComparisonFile,
} from '../scripts/refresh-asset-comparison.mjs';

// One real archive supplies realistic full-year coverage. These tests do not
// freeze its latest date, total row count, price values, or provider response.
// Yahoo-shaped responses below are local fixtures, never network requests.
const archived=JSON.parse(await readFile(new URL('../dist/data/asset-comparison.json',import.meta.url),'utf8'));
const hash=value=>createHash('sha256').update(value).digest('hex');
const DAY=86400000;
const timestamp=date=>Date.parse(`${date}T16:00:00Z`)/1000;
const latestDate=archived.assets.map(asset=>asset.prices.at(-1)[0]).sort().at(-1);
const fixtureDate=new Date(Date.parse(`${latestDate}T00:00:00Z`)+DAY).toISOString().slice(0,10);
const fixtureTime=`${fixtureDate}T06:00:00.000Z`;

function payloadFor(asset){
  return {chart:{error:null,result:[{
    meta:{symbol:asset.symbol,currency:'USD',instrumentType:asset.meta.instrumentType,
      exchangeTimezoneName:'America/New_York',fullExchangeName:'Fixture exchange',
      dataGranularity:'1d',firstTradeDate:timestamp(asset.prices[0][0])},
    timestamp:asset.prices.map(([date])=>timestamp(date)),
    indicators:{quote:[{close:asset.prices.map(([,close])=>close)}]},
  }]}};
}
function parseOptions(asset,retrievedAt,payload){
  return {symbol:asset.symbol,retrievedAt,
    sourceUrl:assetComparisonSourceUrl(asset.symbol,Date.parse(retrievedAt)),
    responseSha256:hash(JSON.stringify(payload))};
}
function fixtureArchive(){
  const bundle=structuredClone(archived);bundle.retrievedAt=fixtureTime;
  for(const asset of bundle.assets){
    if(asset.symbol==='BTC')continue;
    asset.meta.retrievedAt=fixtureTime;
    asset.meta.sourceUrl=assetComparisonSourceUrl(asset.symbol,Date.parse(fixtureTime));
    asset.meta.responseSha256=hash(JSON.stringify(payloadFor(asset)));
    asset.meta.excludedIncomplete=0;
  }
  return bundle;
}
function removableInteriorIndex(asset){
  const firstYear=asset.prices[0][0].slice(0,4),lastYear=asset.prices.at(-1)[0].slice(0,4);
  const byYear=new Map();for(const [date] of asset.prices)byYear.set(date.slice(0,4),(byYear.get(date.slice(0,4))||0)+1);
  const middle=Math.floor(asset.prices.length/2);
  for(let offset=0;offset<asset.prices.length;offset++){
    const index=(middle+offset)%asset.prices.length;if(index===0||index===asset.prices.length-1)continue;
    const year=asset.prices[index][0].slice(0,4);
    const gap=(Date.parse(asset.prices[index+1][0])-Date.parse(asset.prices[index-1][0]))/DAY;
    if(year!==firstYear&&year!==lastYear&&byYear.get(year)>201&&gap<=7)return index;
  }
  throw new Error('Fixture needs an interior session with ordinary neighboring coverage');
}

test('daily explicit-period request rejects a provider silently returning monthly bars',()=>{
  const asset=archived.assets.find(item=>item.symbol!=='BTC'),payload=payloadFor(asset),url=new URL(assetComparisonSourceUrl(asset.symbol,Date.parse(fixtureTime)));
  assert.equal(url.searchParams.get('period1'),'0');assert.equal(url.searchParams.get('interval'),'1d');assert.equal(url.searchParams.has('range'),false);
  payload.chart.result[0].meta.dataGranularity='1mo';
  assert.throws(()=>parseYahooComparisonAsset(payload,parseOptions(asset,fixtureTime,payload)),/granularity mismatch/);
});

test('same-day provider quote is excluded during a session and accepted after UTC midnight',()=>{
  const asset=archived.assets.find(item=>item.symbol!=='BTC'),payload=payloadFor(asset),last=asset.prices.at(-1)[0];
  const intraday=parseYahooComparisonAsset(payload,parseOptions(asset,`${last}T18:00:00.000Z`,payload));
  assert.equal(intraday.meta.lastDate,asset.prices.at(-2)[0]);assert.equal(intraday.meta.excludedIncomplete,1);
  assert.equal(intraday.prices.length,asset.prices.length-1);
  const midnight=new Date(Date.parse(`${last}T00:00:00Z`)+DAY).toISOString();
  const completed=parseYahooComparisonAsset(payload,parseOptions(asset,midnight,payload));
  assert.deepEqual(completed.prices,asset.prices);assert.equal(completed.meta.excludedIncomplete,0);
});

test('price, coverage metadata, and response-hash corruption fail validation',()=>{
  const alteredPrice=structuredClone(archived);alteredPrice.assets[1].prices[3][1]*=1.01;
  assert.throws(()=>validateAssetComparisonBundle(alteredPrice),/hash mismatch/);
  const alteredCount=structuredClone(archived);alteredCount.assets[1].meta.count--;
  assert.throws(()=>validateAssetComparisonBundle(alteredCount),/coverage or hash mismatch/);
  const alteredHash=structuredClone(archived);alteredHash.assets[1].meta.responseSha256='z'.repeat(64);
  assert.throws(()=>validateAssetComparisonBundle(alteredHash),/provenance/);
  const contradictoryMissing=structuredClone(archived);contradictoryMissing.assets[1].meta.missingDates=[contradictoryMissing.assets[1].prices[3][0]];
  assert.throws(()=>validateAssetComparisonBundle(contradictoryMissing),/unavailable-session metadata/);
});

test('peer comparison detects an isolated omitted session even after count/hash are recomputed',()=>{
  const bundle=structuredClone(archived),asset=bundle.assets[1],index=removableInteriorIndex(asset);
  const [missingDate]=asset.prices.splice(index,1)[0];
  asset.meta.count=asset.prices.length;asset.meta.pricesSha256=hash(JSON.stringify(asset.prices));
  assert.throws(()=>validateAssetComparisonBundle(bundle),/cross-asset session metadata mismatch/);
  attachPeerSessionMetadata(bundle);
  assert.ok(asset.meta.peerSessionCheck.missingDates.includes(missingDate));
  assert.ok(asset.meta.missingDates.includes(missingDate));
  assert.equal(validateAssetComparisonBundle(bundle)[1].peerMissingSessions,archived.assets[1].meta.peerSessionCheck.missingDates.length+1);
  assert.ok(!asset.prices.some(([date])=>date===missingDate),'the omitted price must remain absent');
});

test('refresh rejects a truncated provider history without changing the existing bundle',async()=>{
  const previous=fixtureArchive(),directory=await mkdtemp(join(tmpdir(),'asset-comparison-refresh-')),output=join(directory,'bundle.json');
  const before=JSON.stringify(previous)+'\n';
  const rawBySymbol=new Map(previous.assets.filter(asset=>asset.symbol!=='BTC').map(asset=>{
    const payload=payloadFor(asset);
    if(asset.symbol===previous.assets.find(item=>item.symbol!=='BTC').symbol){
      const index=removableInteriorIndex(asset),result=payload.chart.result[0];
      result.timestamp.splice(index,1);result.indicators.quote[0].close.splice(index,1);
    }
    return [asset.symbol,JSON.stringify(payload)];
  }));
  try{
    await writeFile(output,before);
    await assert.rejects(refreshAssetComparisonFile(output,{
      now:Date.parse(fixtureTime),fetchImpl:async url=>({ok:true,status:200,text:async()=>rawBySymbol.get(new URL(url).pathname.split('/').at(-1))}),
    }),/truncate existing history/);
    assert.equal(await readFile(output,'utf8'),before);
  }finally{await rm(directory,{recursive:true,force:true});}
});

test('unchanged completed prices still receive the actual new retrieval timestamp',async()=>{
  const previous=fixtureArchive(),directory=await mkdtemp(join(tmpdir(),'asset-comparison-refresh-')),output=join(directory,'bundle.json');
  const rawBySymbol=new Map(previous.assets.filter(asset=>asset.symbol!=='BTC').map(asset=>[asset.symbol,JSON.stringify(payloadFor(asset))]));
  const nextTime=`${fixtureDate}T07:00:00.000Z`;
  try{
    await writeFile(output,JSON.stringify(previous));
    const next=await refreshAssetComparisonFile(output,{
      now:Date.parse(nextTime),fetchImpl:async url=>({ok:true,status:200,text:async()=>rawBySymbol.get(new URL(url).pathname.split('/').at(-1))}),
    });
    assert.equal(next.retrievedAt,nextTime);assert.notEqual(next.retrievedAt,previous.retrievedAt);
    assert.deepEqual(next.assets.map(asset=>asset.prices),previous.assets.map(asset=>asset.prices));
    assert.ok(next.assets.filter(asset=>asset.symbol!=='BTC').every(asset=>asset.meta.retrievedAt===nextTime));
    assert.deepEqual(next.assets[0].prices,previous.assets[0].prices,'BTC archive is reused without changing its original observations');
    assert.equal(JSON.parse(await readFile(output,'utf8')).retrievedAt,nextTime);
  }finally{await rm(directory,{recursive:true,force:true});}
});

test('UTC calendar-day BTC rejects a missing leap-year date without treating weekends as market closures',()=>{
  const bundle=structuredClone(archived),btc=bundle.assets[0];
  assert.equal(btc.symbol,'BTC'); assert.equal(btc.meta.calendar,'calendar-days');
  const leapIndex=btc.prices.findIndex(([date])=>date==='2024-02-29'); assert.notEqual(leapIndex,-1);
  btc.prices.splice(leapIndex,1);btc.meta.count--;btc.meta.lastDate=btc.prices.at(-1)[0];
  assert.throws(()=>validateAssetComparisonBundle(bundle),/missing date/);
});
