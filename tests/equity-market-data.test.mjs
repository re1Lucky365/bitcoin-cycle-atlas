import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {parseYahooEquity,parseEquityArchive,aggregateEquityWeeks,equityHistoryRange} from '../dist/equity-market-data.js';
import {equitySourceUrl,refreshEquityFile} from '../scripts/refresh-equities.mjs';
import {panRange,zoomRange} from '../dist/chart-navigation.js';
const day=value=>Date.parse(`${value}T00:00:00Z`)/1000;
const row=(date,close=100)=>({time:day(date),date:`${date}T00:00:00Z`,sessionDate:date,open:close-1,high:close+2,low:close-2,close,volume:100});
const provider=(dates=['2026-10-21','2026-10-22','2026-10-23'],symbol='MSTR')=>({chart:{result:[{meta:{symbol,instrumentType:'EQUITY',currency:'USD',exchangeTimezoneName:'America/New_York',dataGranularity:'1d',fullExchangeName:'NasdaqGS'},timestamp:dates.map(date=>day(date)+13.5*3600),indicators:{quote:[{open:dates.map(()=>99),high:dates.map(()=>102),low:dates.map(()=>98),close:dates.map(()=>100),volume:dates.map(()=>1000)}],adjclose:[{adjclose:dates.map(()=>90)}]},events:{splits:{one:{date:day('2024-08-08'),numerator:10,denominator:1,splitRatio:'10:1'}}}}],error:null}});
const options={symbol:'MSTR',retrievedAt:'2026-10-24T08:00:00Z',sourceUrl:'https://query1.finance.yahoo.com/v8/finance/chart/MSTR'};

test('equity provider requires exact instrument, USD and daily bars; range=max monthly substitution cannot enter',()=>{
  const snapshot=parseYahooEquity(provider(),options);
  assert.equal(snapshot.candles.length,3);assert.equal(snapshot.candles[0].close,100);assert.equal(snapshot.candles[0].adjustedClose,90,'dividend-adjusted close remains separate');
  for(const [key,value] of [['symbol','BMNR'],['instrumentType','CRYPTOCURRENCY'],['currency','CAD'],['dataGranularity','1mo'],['exchangeTimezoneName','UTC']]){const bad=provider();bad.chart.result[0].meta[key]=value;assert.throws(()=>parseYahooEquity(bad,options),/identity|granularity/);}
  assert.throws(()=>parseYahooEquity(provider(),{...options,symbol:'ETH-USD'}),/Unsupported/);
  assert.ok(equitySourceUrl('MSTR').includes('period1='));assert.ok(!equitySourceUrl('MSTR').includes('range=max'));
});

test('a current partial session is excluded and NY dates survive DST without shifting the calendar',()=>{
  const data=provider(['2026-03-06','2026-03-09','2026-03-10']);data.chart.result[0].timestamp[0]=day('2026-03-06')+14.5*3600;
  const snapshot=parseYahooEquity(data,{...options,retrievedAt:'2026-03-10T18:00:00Z'});
  assert.equal(snapshot.excludedIncomplete,1);assert.deepEqual(snapshot.candles.map(item=>item.sessionDate),['2026-03-06','2026-03-09']);assert.equal(snapshot.candles[0].sessionTimestamp,day('2026-03-06')+14.5*3600);assert.equal(snapshot.candles[1].sessionTimestamp,day('2026-03-09')+13.5*3600);
});

test('weekly equity OHLC aggregates actual sessions including a holiday week without weekend candles',()=>{
  const values=[row('2026-09-08',100),row('2026-09-09',110),row('2026-09-10',90),row('2026-09-11',105),row('2026-09-14',120)];
  const weeks=aggregateEquityWeeks(values,{retrievedAt:'2026-09-15T03:00:00Z'});
  assert.equal(weeks.length,1);assert.equal(weeks[0].sessionCount,4);assert.equal(weeks[0].date,'2026-09-07T00:00:00Z');assert.equal(weeks[0].lastSessionDate,'2026-09-11');
  assert.deepEqual([weeks[0].open,weeks[0].high,weeks[0].low,weeks[0].close,weeks[0].volume],[99,112,88,105,400]);
});

test('archive corruption, future rows and cross-symbol payloads fail instead of being drawn',()=>{
  const payload=parseYahooEquity(provider(),options);
  for(const modify of [p=>{p.candles[1].low=110;},p=>{p.candles.reverse();},p=>{p.currency='USDT';},p=>{p.symbol='BMNR';},p=>{p.retrievedAt='2026-10-23T18:00:00Z';}]){const bad=structuredClone(payload);modify(bad);assert.throws(()=>parseEquityArchive(bad,{symbol:'MSTR'}));}
  assert.throws(()=>parseEquityArchive(payload,{symbol:'MSTR',interval:'1h'}),/daily and weekly/);
});

test('published archives have authentic symbol identity, source receipts and model-independent candle coverage',async()=>{
  for(const symbol of ['MSTR','BMNR']){
    const raw=JSON.parse(await readFile(new URL(`../dist/data/${symbol.toLowerCase()}-ohlc.json`,import.meta.url),'utf8'));
    const parsed=parseEquityArchive(raw,{symbol}),weeks=parseEquityArchive(raw,{symbol,interval:'weekly'});
    assert.match(raw.responseSha256,/^[0-9a-f]{64}$/);assert.match(raw.sourceUrl,new RegExp(`/chart/${symbol}\\?`));
    assert.ok(Date.parse(parsed.lastDate)>=Date.parse('2026-10-23T00:00:00Z'),'a refresh retains the initially verified coverage');
    assert.ok(Date.parse(parsed.lastDate)<Date.parse(`${raw.retrievedAt.slice(0,10)}T00:00:00Z`),'the final bar is a completed session at retrieval');
    assert.ok(weeks.candles.length>60);assert.ok(parsed.candles.length>300);
    assert.ok(parsed.candles.every(item=>!['forecast','simulated'].includes(item.kind)));
    if(symbol==='MSTR'){assert.equal(parsed.firstDate,'1998-06-11T00:00:00Z');assert.ok(raw.splits.some(item=>item.date==='2024-08-08'&&item.ratio==='10:1'));}
    else{assert.equal(parsed.firstDate,'2025-06-05T00:00:00Z');assert.match(raw.coverageNote,/OTC/);}
    const range=equityHistoryRange(parsed,{forecastEnd:'2035-12-31'});assert.ok(range.end>parsed.candles.at(-1).time);assert.ok(range.max>range.end);assert.ok(range.end-range.start<=1461*86400);
  }
});

test('a truncated response cannot replace the saved full history',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'atlas-equity-'));t.after(()=>rm(directory,{recursive:true,force:true}));const file=join(directory,'mstr.json');
  const payload=parseYahooEquity(provider(),options),original=JSON.stringify(payload);await writeFile(file,original);
  await assert.rejects(refreshEquityFile('MSTR',file,{now:Date.parse(options.retrievedAt),fetchImpl:async()=>({ok:true,text:async()=>JSON.stringify(provider(['2026-10-22','2026-10-23']))})}),/truncate/);
  assert.equal(await readFile(file,'utf8'),original);
});

test('adding new sessions cannot conceal an omitted previously observed session during a full refresh',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'atlas-equity-coverage-'));t.after(()=>rm(directory,{recursive:true,force:true}));const file=join(directory,'mstr.json');
  const original=JSON.stringify(parseYahooEquity(provider(),options));await writeFile(file,original);
  for(const dates of [['2026-10-21','2026-10-23','2026-10-26'],['2026-10-21','2026-10-23','2026-10-26','2026-10-27']]){
    await assert.rejects(refreshEquityFile('MSTR',file,{now:Date.parse('2026-10-28T08:00:00Z'),fetchImpl:async()=>({ok:true,text:async()=>JSON.stringify(provider(dates))})}),/omitted previously observed session 2026-10-22/);
    assert.equal(await readFile(file,'utf8'),original,'a failed coverage check preserves the entire existing file');
  }
});

test('a complete refresh replaces all old split-adjusted prices together and admits additional sessions',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'atlas-equity-split-'));t.after(()=>rm(directory,{recursive:true,force:true}));const file=join(directory,'mstr.json');
  await writeFile(file,JSON.stringify(parseYahooEquity(provider(),options)));
  const payload=provider(['2026-10-21','2026-10-22','2026-10-23','2026-10-26']);
  const result=payload.chart.result[0];
  for(const key of ['open','high','low','close'])result.indicators.quote[0][key]=result.indicators.quote[0][key].map(value=>value/2);
  result.indicators.adjclose[0].adjclose=result.indicators.adjclose[0].adjclose.map(value=>value/2);
  const refreshed=await refreshEquityFile('MSTR',file,{now:Date.parse('2026-10-27T08:00:00Z'),fetchImpl:async()=>({ok:true,text:async()=>JSON.stringify(payload)})});
  assert.deepEqual(refreshed.candles.map(item=>item.close),[50,50,50,50]);
  assert.deepEqual(JSON.parse(await readFile(file,'utf8')),refreshed);
});

test('every equity time preset stays on its day or Monday-week navigation grid with future dates',async()=>{
  const payload=JSON.parse(await readFile(new URL('../dist/data/mstr-ohlc.json',import.meta.url),'utf8'));
  for(const interval of ['daily','weekly'])for(const span of ['1m','6m','1y','4y','all']){
    const range=equityHistoryRange(parseEquityArchive(payload,{interval}),{span,forecastEnd:'2035-12-31'});
    for(const key of ['start','end','max'])assert.equal((range[key]-range.min)%range.step,0);
    assert.doesNotThrow(()=>panRange(range,.2));assert.doesNotThrow(()=>zoomRange(range,.8));
  }
});
