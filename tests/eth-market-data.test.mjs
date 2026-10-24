import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fetchMarketCandles, parseMarketSnapshot, marketProduct, CHART_INTERVALS } from '../dist/ohlc-data.js';
import { createMarketDataController, marketStatusText } from '../dist/market-data-controller.js';
import { intradayNavigationRange } from '../dist/intraday-history.js';
import { parseEthArchive, validateEthSnapshot, mergeEthArchive } from '../dist/eth-market-data.js';
import { refreshEthSnapshot, refreshEthFile } from '../scripts/refresh-eth.mjs';
import { drawIntradayChart } from '../dist/intraday-chart.js';

const DAY=86400;
const saved=JSON.parse(await readFile(new URL('../dist/data/eth-ohlc.json',import.meta.url),'utf8'));
const first=Date.parse('2026-10-01T00:00:00Z')/1000;
function response(address,{price=100,omit=()=>false}={}) {
  const url=new URL(address),step=Number(url.searchParams.get('granularity'));
  const start=Date.parse(url.searchParams.get('start'))/1000,end=Date.parse(url.searchParams.get('end'))/1000;
  return {ok:true,json:async()=>Array.from({length:(end-start)/step},(_,i)=>[start+i*step,price-1,price+2,price,price+1,3]).filter(row=>!omit(row[0])).reverse()};
}

test('ETH fetch addresses the literal USD market and arbitrary or USDT products fail closed',async()=>{
  const calls=[];
  const series=await fetchMarketCandles({product:'ETH-USD',interval:'1h',count:2,now:first*1000,fetchImpl:async url=>{calls.push(url);return response(url);}});
  assert.ok(calls.every(url=>new URL(url).pathname==='/products/ETH-USD/candles'));
  assert.equal(series.product,'ETH-USD');assert.equal(series.baseCurrency,'ETH');assert.equal(series.quoteCurrency,'USD');
  assert.equal(series.completedOnly,true);assert.equal(series.candles.length,2);
  for(const product of ['ETH-USDT','BTC-USDT','ETH/USD','../../BTC-USD','toString']){
    await assert.rejects(fetchMarketCandles({product,fetchImpl:async()=>assert.fail('invalid product must not request data')}),/Unsupported/);
  }
});

test('published ETH archive and every interval contain real completed, coherent USD candles',()=>{
  const summary=validateEthSnapshot(saved),daily=parseEthArchive(saved),weekly=parseEthArchive(saved,'weekly');
  assert.equal(summary.firstDate,'2016-05-18T00:00:00.000Z');
  assert.ok(summary.candles>=3809);assert.equal(summary.gapCount,2);
  const missing=[];for(let i=1;i<daily.candles.length;i++)for(let time=daily.candles[i-1].time+DAY;time<daily.candles[i].time;time+=DAY)missing.push(new Date(time*1000).toISOString().slice(0,10));
  assert.deepEqual(missing,['2016-05-21','2016-05-22']);
  for(const interval of CHART_INTERVALS){
    const series=parseMarketSnapshot(saved,interval.id,{product:'ETH-USD'});
    assert.equal(series.product,'ETH-USD');assert.ok(series.candles.length>0);
  }
  assert.ok(weekly.candles.every(row=>new Date(row.time*1000).getUTCDay()===1));
  const dailyByTime=new Map(daily.candles.map(row=>[row.time,row]));
  for(const row of weekly.candles){
    const input=Array.from({length:7},(_,i)=>dailyByTime.get(row.time+i*DAY));
    assert.ok(input.every(Boolean),'no incomplete week becomes a candle');
    assert.equal(row.open,input[0].open);assert.equal(row.close,input.at(-1).close);
    assert.equal(row.high,Math.max(...input.map(v=>v.high)));assert.equal(row.low,Math.min(...input.map(v=>v.low)));
  }
});

test('ETH parsing rejects BTC/USDT identity, inconsistent metadata, duplicates and unfinished candles',()=>{
  for(const product of ['BTC-USD','ETH-USDT']){
    const bad={...saved,product};assert.throws(()=>parseEthArchive(bad),/identity/);
    assert.throws(()=>parseMarketSnapshot(bad,'1m',{product:'ETH-USD'}),/metadata/);
  }
  const mixed=structuredClone(saved);mixed.intervals['1m'].product='BTC-USD';assert.throws(()=>validateEthSnapshot(mixed));
  const duplicate=structuredClone(saved);duplicate.dailyHistory.candles[1]=duplicate.dailyHistory.candles[0];assert.throws(()=>parseEthArchive(duplicate));
  const high=structuredClone(saved);high.dailyHistory.candles[0].high=0.1;assert.throws(()=>parseEthArchive(high));
  const future=structuredClone(saved);future.dailyHistory.retrievedAt=future.dailyHistory.candles.at(-1).date;assert.throws(()=>parseEthArchive(future));
  const provenance=structuredClone(saved);provenance.dailyHistory.candles[0].retrievedAt='2099-01-01T00:00:00.000Z';assert.throws(()=>parseEthArchive(provenance));
  const firstCollection=structuredClone(saved);firstCollection.dailyHistory.firstCollectedAt='2099-01-01T00:00:00.000Z';assert.throws(()=>parseEthArchive(firstCollection),/first collection/);
  const contradictoryCollection=structuredClone(saved);contradictoryCollection.dailyHistory.firstCollectedAt=new Date(Date.parse(contradictoryCollection.dailyHistory.retrievedAt)+1).toISOString();assert.throws(()=>parseEthArchive(contradictoryCollection),/first collection/);
});

test('controllers have independent product caches, snapshot URLs and loading labels',async t=>{
  const btcCalls=[],ethCalls=[];
  const btc=createMarketDataController({preferSnapshot:true,fetchImpl:async url=>{btcCalls.push(url);throw new Error('offline');}});
  const eth=createMarketDataController({product:'ETH-USD',preferSnapshot:true,fetchImpl:async url=>{ethCalls.push(url);return {ok:true,json:async()=>saved};}});
  t.after(()=>{btc.cancel();eth.cancel();});
  const pending=eth.load('1m');assert.match(marketStatusText(eth.get('1m')),/ETH-USD/);await pending;
  assert.equal(eth.get('1m').series.product,'ETH-USD');assert.deepEqual(ethCalls,['./data/eth-ohlc.json']);
  assert.equal(btc.get('1m').status,'idle');await btc.load('1m');
  assert.equal(btc.get('1m').status,'error');assert.equal(eth.get('1m').status,'snapshot');
  assert.ok(btcCalls.some(url=>url==='./data/btc-ohlc.json'));
  assert.match(marketStatusText(eth.get('1m')),/Coinbase ETH-USD/);
  const market=eth.get('1m').series,btcRange=intradayNavigationRange({...market,product:'BTC-USD'}),ethRange=eth.range('1m');
  assert.notEqual(ethRange.contextKey,btcRange.contextKey);assert.equal(ethRange.min,marketProduct('ETH-USD').historyStart);
});

test('ETH controller rejects wrong-product saved fallback after a failed live request',async t=>{
  const wrong={...saved,product:'BTC-USD'};
  const controller=createMarketDataController({product:'ETH-USD',readEmbedded:()=>JSON.stringify(wrong),fetchImpl:async()=>{throw new Error('offline');}});
  t.after(()=>controller.cancel());await controller.load('1m');
  assert.equal(controller.get('1m').status,'error');assert.equal(controller.get('1m').series,null);
});

test('recent ETH refresh preserves older source values and their collection times, including real gaps',async()=>{
  const prior=parseEthArchive(saved),now=(prior.requestedEnd+DAY)*1000;
  const fresh=await fetchMarketCandles({product:'ETH-USD',interval:'daily',count:10,now,fetchImpl:async url=>response(url,{price:10000})});
  const merged=mergeEthArchive(saved,fresh),next=parseEthArchive(merged);
  assert.deepEqual(next.candles[0],prior.candles[0]);
  assert.equal(next.candles.at(-1).close,10001);assert.equal(next.candles.at(-1).retrievedAt,fresh.retrievedAt);
  assert.equal(next.candles.length,prior.candles.length+1);assert.equal(next.gapCount,2);
  assert.equal(saved.dailyHistory.retrievedAt,prior.retrievedAt,'refresh is immutable');
  assert.equal(merged.dailyHistory.firstCollectedAt,saved.dailyHistory.firstCollectedAt);
  assert.throws(()=>mergeEthArchive(saved,{...fresh,product:'BTC-USD'}),/identity/);
  assert.throws(()=>mergeEthArchive(saved,{...fresh,requestedStart:prior.requestedEnd+DAY}),/boundary/);
  const futureRow=structuredClone(fresh);futureRow.candles[0].retrievedAt=new Date(Date.parse(fresh.retrievedAt)+1).toISOString();assert.throws(()=>mergeEthArchive(saved,futureRow),/collection time/);
});

test('historical weekly inspection uses original daily collection provenance after a recent refresh',async()=>{
  const prior=parseEthArchive(saved),now=(prior.requestedEnd+DAY)*1000;
  const fresh=await fetchMarketCandles({product:'ETH-USD',interval:'daily',count:10,now,fetchImpl:async url=>response(url)});
  const merged=mergeEthArchive(saved,fresh),weekly=parseEthArchive(merged,'weekly'),old=weekly.candles[0];
  assert.equal(old.retrievedAt,prior.candles.find(row=>row.time===old.time).retrievedAt);
  assert.notEqual(old.retrievedAt,weekly.retrievedAt,'series refresh cannot overwrite an untouched week collection');
  const sourceByTime=new Map(parseEthArchive(merged).candles.map(row=>[row.time,row]));
  for(const row of weekly.candles){
    const expected=Math.max(...Array.from({length:7},(_,i)=>Date.parse(sourceByTime.get(row.time+i*DAY).retrievedAt)));
    assert.equal(Date.parse(row.retrievedAt),expected);
  }
  class SvgNode {
    constructor(){this.attrs=new Map();this.nodes=new Map();this.dataset={};this.textContent='';}
    setAttribute(key,value){this.attrs.set(key,String(value));}
    removeAttribute(key){this.attrs.delete(key);}
    getAttribute(key){return this.attrs.get(key);}
    querySelector(selector){if(!this.nodes.has(selector))this.nodes.set(selector,new SvgNode());return this.nodes.get(selector);}
    querySelectorAll(){return [];}
    focus(){}
  }
  const svg=new SvgNode();Object.assign(svg,{id:'eth-weekly-provenance',clientWidth:1000,clientHeight:450,innerHTML:'',parentElement:{style:{setProperty(){}}}});
  svg.getBoundingClientRect=()=>({left:0,top:0,width:1000,height:450});
  let inspected;
  const chart=drawIntradayChart({svg,series:weekly,showVolume:false,range:{start:old.time-DAY,end:old.time+8*DAY},onInspect:value=>{inspected=value;}});
  chart.selectDate(old.date);
  assert.ok(inspected.note.includes(old.retrievedAt.replace('T',' ').slice(0,19)),'actual candle inspection must display the original week collection');
  assert.ok(!inspected.note.includes(weekly.retrievedAt.replace('T',' ').slice(0,19)),'actual candle inspection must not claim the newest unrelated refresh');
});

test('incremental scheduled refresh revisits only recent history and validates all intervals',async()=>{
  const prior=parseEthArchive(saved),calls=[];
  const next=await refreshEthSnapshot({prior:saved,now:(prior.requestedEnd+DAY)*1000,requestGapMs:0,fetchImpl:async url=>{calls.push(new URL(url));return response(url);}});
  const dailyCalls=calls.filter(url=>url.searchParams.get('granularity')==='86400');
  assert.equal(dailyCalls.length,1);assert.equal(Date.parse(dailyCalls[0].searchParams.get('start'))/1000,prior.requestedEnd-7*DAY);
  assert.equal(validateEthSnapshot(next).candles,prior.candles.length+1);
  assert.deepEqual(next.dailyHistory.candles[0],saved.dailyHistory.candles[0]);
});

test('failed scheduled intraday refresh cannot overwrite a valid daily archive or its timestamps',async()=>{
  const folder=await mkdtemp(join(tmpdir(),'atlas-eth-refresh-')),output=join(folder,'eth-ohlc.json'),original=JSON.stringify(saved);
  try{
    await writeFile(output,original);
    await assert.rejects(refreshEthFile(output,{now:(saved.dailyHistory.requestedEnd+DAY)*1000,requestGapMs:0,fetchImpl:async url=>new URL(url).searchParams.get('granularity')==='86400'?response(url):{ok:false,status:503}}),/503/);
    assert.equal(await readFile(output,'utf8'),original);
  }finally{await rm(folder,{recursive:true,force:true});}
});
