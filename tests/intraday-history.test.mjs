import assert from 'node:assert/strict';
import test from 'node:test';
import { createMarketDataController, marketStatusText } from '../dist/market-data-controller.js';
import { chartInterval, fetchMarketCandles } from '../dist/ohlc-data.js';
import { INTRADAY_MAX_VISIBLE_BARS, INTRADAY_CACHE_BARS, mergeCoverage, missingWindows, intradayNavigationRange, createHistoryState, appendHistoryPage } from '../dist/intraday-history.js';
import { zoomRange } from '../dist/chart-navigation.js';

const end=Date.parse('2026-10-22T00:00:00Z')/1000;
function response(url,{omit=()=>false}={}) {
  const u=new URL(url),step=Number(u.searchParams.get('granularity')),start=Date.parse(u.searchParams.get('start'))/1000,finish=Date.parse(u.searchParams.get('end'))/1000;
  assert.ok((finish-start)/step<=300,'each HTTP request obeys the provider source-bar cap');
  const rows=[];for(let time=start;time<finish;time+=step){if(omit(time))continue;const open=100+(time/step)%17;rows.push([time,open-1,open+3,open,open+2,2]);}
  return {ok:true,json:async()=>rows.reverse()};
}
function deferred(){let resolve;const promise=new Promise(yes=>{resolve=yes;});return {promise,resolve};}
async function fixture(interval='1m',options={}) {
  const series=await fetchMarketCandles({interval,now:end*1000,count:180,fetchImpl:async url=>response(url)});
  const saved={version:1,source:'Coinbase Exchange',product:'BTC-USD',intervals:{[interval]:series}},calls=[];
  const controller=createMarketDataController({preferSnapshot:true,historyRequestGapMs:0,readEmbedded:()=>JSON.stringify(saved),fetchImpl:async(url,args)=>{calls.push({url,args});return options.fetchImpl?options.fetchImpl(url,args,calls.length):response(url,options);},...options.controller});
  await controller.load(interval);return {controller,calls,series,step:chartInterval(interval).seconds};
}

test('zoom-out crosses the original 180-bar snapshot and loads real older candles without changing interval',async t=>{
  const {controller,calls,series,step}=await fixture();t.after(()=>controller.cancel());
  const initial=controller.range('1m'),expanded=zoomRange(initial,4);
  assert.ok(expanded.start<series.candles[0].time-400*step);
  assert.equal(expanded.maxSpan,INTRADAY_MAX_VISIBLE_BARS);
  await controller.ensureRange('1m',expanded);
  const loaded=controller.get('1m');assert.ok(loaded.series.candles.length>700);assert.equal(loaded.series.interval,'1m');
  assert.ok(loaded.series.candles[0].time<=expanded.start);assert.equal(loaded.series.candles.at(-1).time,series.candles.at(-1).time);
  assert.equal(loaded.historyStatus,'ready');assert.ok(calls.length>=2);
  const count=calls.length;await controller.ensureRange('1m',expanded);assert.equal(calls.length,count,'revisiting a checked viewport is a cache hit');
  assert.deepEqual(controller.range('1m'),initial,'paging does not change Reset or gesture navigation bounds');
  assert.match(marketStatusText(loaded),/완료 봉/);
});

test('30m and 4h history uses only complete source groups and at most 288 source bars per page',async t=>{
  for(const interval of ['30m','4h']){
    const {controller,calls,series,step}=await fixture(interval);t.after(()=>controller.cancel());
    const start=series.candles[0].time-400*step;
    await controller.ensureRange(interval,{start,end:series.candles.at(-1).time});
    const loaded=controller.get(interval).series;assert.equal(loaded.candles.length,580);assert.equal(loaded.gapCount,0);
    for(const call of calls){const u=new URL(call.url);assert.ok((Date.parse(u.searchParams.get('end'))-Date.parse(u.searchParams.get('start')))/1000/Number(u.searchParams.get('granularity'))<=288);}
    assert.ok(loaded.candles.every(row=>row.time%step===0));assert.equal(loaded.candles[0].volume,interval==='4h'?8:4);
  }
});

test('empty provider pages are remembered and source gaps remain absent without repeated requests',async t=>{
  const {controller,calls,series,step}=await fixture('1m',{omit:()=>true});t.after(()=>controller.cancel());
  const range={start:series.candles[0].time-600*step,end:series.candles[0].time-step};
  await controller.ensureRange('1m',range);
  assert.equal(controller.get('1m').series.candles.length,180);assert.equal(controller.get('1m').series.gapCount,600);
  const count=calls.length;for(let i=0;i<4;i++)await controller.ensureRange('1m',range);
  assert.equal(calls.length,count);assert.equal(controller.get('1m').historyStatus,'ready');
});

test('history download is sequential and coalesces new gestures onto its latest requested viewport',async t=>{
  const delayed=deferred();let pendingUrl,active=0,peak=0;
  const {controller,calls,series,step}=await fixture('1m',{fetchImpl:async(url,_options,n)=>{active++;peak=Math.max(peak,active);if(n===1){pendingUrl=url;await delayed.promise;}active--;return response(url);}});t.after(()=>controller.cancel());
  const first=controller.ensureRange('1m',{start:series.candles[0].time-200*step,end:series.candles.at(-1).time});
  const latest={start:series.candles[0].time-1000*step,end:series.candles[0].time-500*step};
  const second=controller.ensureRange('1m',latest);assert.equal(first,second);assert.equal(calls.length,1);assert.ok(pendingUrl);
  delayed.resolve();await first;
  const data=controller.get('1m').series.candles;assert.equal(peak,1);assert.ok(data.some(row=>row.time===latest.start));assert.ok(data.some(row=>row.time===latest.end));
});

test('interval cancellation drops late history responses and never publishes stale rows',async t=>{
  const delayed=deferred();let savedUrl,savedSignal;
  const {controller,series,step}=await fixture('1m',{fetchImpl:async(url,args)=>{if(new URL(url).searchParams.get('granularity')==='60'){savedUrl=url;savedSignal=args.signal;return delayed.promise;}return response(url);}});t.after(()=>controller.cancel());
  const old=controller.ensureRange('1m',{start:series.candles[0].time-200*step,end:series.candles.at(-1).time});
  controller.cancel();await controller.load('5m');const selected=controller.get('5m');assert.equal(savedSignal.aborted,true);
  delayed.resolve(response(savedUrl));await old;
  assert.equal(controller.get('5m'),selected);assert.equal(controller.get('1m').series.candles.length,180);assert.equal(controller.get('1m').historyStatus,'idle');
});

test('429 preserves displayed data and cannot create an automatic retry loop',async t=>{
  const {controller,calls,series,step}=await fixture('1m',{fetchImpl:async()=>({ok:false,status:429})});t.after(()=>controller.cancel());
  const range={start:series.candles[0].time-200*step,end:series.candles.at(-1).time};
  await controller.ensureRange('1m',range);const failed=controller.get('1m');assert.equal(failed.historyStatus,'error');assert.match(failed.historyError,/429/);
  assert.equal(failed.series.candles.length,180);for(let i=0;i<10;i++)await controller.ensureRange('1m',range);assert.equal(calls.length,1);
  assert.match(marketStatusText(failed),/과거 조회 실패/);
});

test('a timed-out history page keeps the saved chart and clears loading state',async t=>{
  const {controller,series,step}=await fixture('1m',{controller:{timeoutMs:5},fetchImpl:(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}))});t.after(()=>controller.cancel());
  await controller.ensureRange('1m',{start:series.candles[0].time-200*step,end:series.candles.at(-1).time});
  assert.equal(controller.get('1m').historyStatus,'error');assert.match(controller.get('1m').historyError,/timed out/);assert.equal(controller.get('1m').series.candles.length,180);
});

test('a new short gesture still obeys the shared request throttle and can be cancelled before HTTP starts',async t=>{
  const {controller,calls,series,step}=await fixture('1m',{controller:{historyRequestGapMs:100}});t.after(()=>controller.cancel());
  await controller.ensureRange('1m',{start:series.candles[0].time-20*step,end:series.candles.at(-1).time});assert.equal(calls.length,1);
  const pending=controller.ensureRange('1m',{start:series.candles[0].time-40*step,end:series.candles.at(-1).time});
  assert.equal(calls.length,1,'the second short gesture must not immediately start another HTTP request');
  controller.cancel();await pending;assert.equal(calls.length,1);assert.equal(controller.get('1m').historyStatus,'idle');
});

test('forced refresh can refill the existing past viewport using the newer navigation baseline',async t=>{
  const {controller,series,step}=await fixture();t.after(()=>controller.cancel());
  const target={start:series.candles[0].time-600*step,end:series.candles[0].time-100*step};
  await controller.ensureRange('1m',target);const oldKey=controller.range('1m',target).contextKey;
  await controller.load('1m',{force:true});assert.equal(controller.get('1m').series.candles.length,180);
  const refreshed=controller.range('1m',target);assert.notEqual(refreshed.contextKey,oldKey);assert.equal(refreshed.start,target.start);assert.equal(refreshed.end,target.end);
  await controller.ensureRange('1m',target);const rows=controller.get('1m').series.candles;
  assert.ok(rows.some(row=>row.time===target.start));assert.ok(rows.some(row=>row.time===target.end));assert.equal(controller.get('1m').historyStatus,'ready');
});

test('older panning keeps a bounded cache, every requested source bar, and the Reset snapshot',async t=>{
  const {controller,series,step}=await fixture();t.after(()=>controller.cancel());
  for(const offset of [0,6000,12000]){
    const target={start:end-(offset+6000)*step,end:end-(offset+1)*step};
    await controller.ensureRange('1m',target);const loaded=controller.get('1m').series.candles;
    assert.ok(loaded.length<=INTRADAY_CACHE_BARS+180);assert.equal(loaded.filter(row=>row.time>=target.start&&row.time<=target.end).length,6000);
    assert.equal(loaded.at(-1).time,series.candles.at(-1).time);assert.equal(controller.get('1m').series.gapCount,0,'unrequested space between retained windows is not a reported source gap');
  }
  assert.ok(controller.get('1m').series.candles[0].time<end-12000*step,'cache budget does not impose a global history wall');
});

test('checked coverage merges overlap and queries only the missing half-open windows',()=>{
  const coverage=mergeCoverage([[10,20],[50,60],[15,30],[30,40]]);assert.deepEqual(coverage,[[10,40],[50,60]]);
  assert.deepEqual(missingWindows(5,65,coverage),[[5,10],[40,50],[60,65]]);
  assert.deepEqual(missingWindows(10,30,coverage),[]);
  assert.equal(intradayNavigationRange({interval:'1m',retrievedAt:'test',candles:[{time:end-60},{time:end}]}).maxSpan,6000);
});

test('checked empty-window metadata is evicted with the time cache instead of growing across distant pans',async t=>{
  const {controller,series,step}=await fixture();t.after(()=>controller.cancel());const history=createHistoryState(series);let current=series;
  for(let i=1;i<=100;i++){
    const start=end-i*30000*step,finish=start+60*step;history.requested={start,end:finish,step};
    current=appendHistoryPage(current,history,{candles:[],requestedStart:start,requestedEnd:finish,retrievedAt:'2026-10-22T00:00:00.000Z',sourceUrls:[]});
    assert.ok(history.coverage.length<=2);assert.ok(history.coverage.reduce((n,[a,b])=>n+(b-a)/step,0)<=INTRADAY_CACHE_BARS+180);
    assert.equal(current.candles.length,180);
  }
});
