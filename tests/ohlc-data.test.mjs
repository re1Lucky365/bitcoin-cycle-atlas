import assert from 'node:assert/strict';
import test from 'node:test';
import {parseCoinbaseCandles,aggregateCandles,fetchMarketCandles,parseMarketSnapshot,isIntradayInterval} from '../dist/ohlc-data.js';

const start=Date.parse('2026-10-22T00:00:00Z')/1000;
const row=(time,{open=100,high=120,low=90,close=110,volume=2}={})=>[time,low,high,open,close,volume];
const parsed=(rows,sourceSeconds=900,now=(start+86400)*1000)=>parseCoinbaseCandles(rows,{sourceSeconds,now}).candles;

test('source OHLC field order is preserved and descending responses become chronological',()=>{
  const rows=parsed([row(start+900,{open:120,high:135,low:100,close:105,volume:3}),row(start)]);
  assert.deepEqual(rows.map(r=>[r.time,r.open,r.high,r.low,r.close,r.volume]),[[start,100,120,90,110,2],[start+900,120,135,100,105,3]]);
  assert.equal(rows[0].date,'2026-10-22T00:00:00.000Z');
});
test('unfinished bars are excluded at the exact closing boundary',()=>{
  assert.equal(parsed([row(start)],900,(start+900)*1000-1).length,0);
  assert.equal(parsed([row(start)],900,(start+900)*1000).length,1);
  const result=parseCoinbaseCandles([row(start),row(start+900)],{sourceSeconds:900,now:(start+901)*1000});
  assert.equal(result.excludedUnfinished,1);assert.equal(result.candles.length,1);
});
test('malformed and contradictory prices, duplicated timestamps and missing fields are rejected',()=>{
  for(const bad of [[start,90,100,110,105,1],[start,90,120,100,NaN,1],[start+1,90,120,100,110,1],[start,90,120,100,110,-1],[start,90,120,100,110],['1792627200',90,120,100,110,1]])assert.throws(()=>parsed([bad]));
  assert.throws(()=>parsed([row(start),row(start)]),/Duplicate/);
});
test('30 minute and 4 hour bars retain genuine extremes and sum actual volume',()=>{
  const thirty=aggregateCandles(parsed([row(start),row(start+900,{open:110,high:160,low:80,close:150,volume:3})]),'30m');
  assert.deepEqual(thirty.candles[0],{time:start,date:'2026-10-22T00:00:00.000Z',open:100,high:160,low:80,close:150,volume:5});
  const four=aggregateCandles(parsed([0,1,2,3].map(i=>row(start+i*3600)),3600),'4h');
  assert.equal(four.candles.length,1);assert.equal(four.candles[0].volume,8);
});
test('aggregation never manufactures a candle through a missing source bucket',()=>{
  const missing=aggregateCandles(parsed([row(start),row(start+3600),row(start+10800)],3600),'4h');
  assert.equal(missing.candles.length,0);assert.equal(missing.incompleteGroups,1);
  const partial=aggregateCandles(parsed([row(start+900)]),'30m');
  assert.equal(partial.candles.length,0);
});
test('weekly aggregation starts Monday UTC and excludes partial edge weeks',()=>{
  const monday=Date.parse('2026-10-19T00:00:00Z')/1000;
  const rows=parsed(Array.from({length:8},(_,i)=>row(monday+i*86400)),86400,(monday+10*86400)*1000);
  const result=aggregateCandles(rows,'weekly');
  assert.equal(result.candles.length,1);assert.equal(result.candles[0].time,monday);assert.equal(result.candles[0].volume,14);
  assert.equal(result.incompleteGroups,1);
});
test('bounded fetch splits large requests and filters provider overlap without inventing values',async()=>{
  const calls=[],now=(start+86400)*1000;
  const result=await fetchMarketCandles({interval:'4h',count:100,now,fetchImpl:async(url,options)=>{
    const u=new URL(url),from=Date.parse(u.searchParams.get('start'))/1000,to=Date.parse(u.searchParams.get('end'))/1000,step=Number(u.searchParams.get('granularity'));
    calls.push({from,to,options});
    return {ok:true,json:async()=>Array.from({length:(to-from)/step+1},(_,i)=>row(from+i*step)).reverse()};
  }});
  assert.equal(calls.length,2);assert.ok(calls.every(c=>(c.to-c.from)/3600<=290));
  assert.equal(result.candles.length,100);assert.equal(result.candles.at(-1).time+14400,now/1000);
  assert.equal(result.gapCount,0);assert.equal(result.aggregation,'4 × 3600s');assert.equal(result.completedOnly,true);
  assert.equal(calls[0].options.credentials,'omit');
});
test('failed requests and abortion are visible, not an empty successful price series',async()=>{
  await assert.rejects(fetchMarketCandles({fetchImpl:async()=>({ok:false,status:429})}),/HTTP 429/);
  const controller=new AbortController();controller.abort();let called=false;
  await assert.rejects(fetchMarketCandles({signal:controller.signal,fetchImpl:async()=>{called=true;}}),{name:'AbortError'});assert.equal(called,false);
});
test('snapshot preserves recorded time and rejects fabricated OHLC and unfinished bars',async()=>{
  const result=await fetchMarketCandles({interval:'15m',count:2,now:(start+1800)*1000,fetchImpl:async()=>({ok:true,json:async()=>[row(start),row(start+900)]})});
  const payload={version:1,source:'Coinbase Exchange',product:'BTC-USD',intervals:{'15m':result}};
  const saved=parseMarketSnapshot(payload,'15m');assert.equal(saved.retrievedAt,result.retrievedAt);assert.equal(saved.snapshot,true);
  const bad=structuredClone(payload);bad.intervals['15m'].candles[0].high=99;assert.throws(()=>parseMarketSnapshot(bad,'15m'));
  const unfinished=structuredClone(payload);unfinished.intervals['15m'].retrievedAt=new Date((start+1700)*1000).toISOString();assert.throws(()=>parseMarketSnapshot(unfinished,'15m'));
  assert.equal(isIntradayInterval('daily'),false);assert.equal(isIntradayInterval('4h'),true);assert.equal(isIntradayInterval('2D'),false);
});
