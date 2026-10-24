import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { readEthView, ethViewQuery, ethHistoryRange, ethRangeLabel } from '../dist/eth-view-state.js';
import { panRange, zoomRange, fitRange } from '../dist/chart-navigation.js';

const DAY=86400,WEEK=7*DAY;
const seconds=date=>Date.parse(`${date}T00:00:00Z`)/1000;
function series(interval,first,last,retrievedAt='2026-10-24T10:00:00.000Z'){
  const step=interval==='weekly'?WEEK:DAY,candles=[];
  for(let time=seconds(first);time<=seconds(last);time+=step)candles.push({time,date:new Date(time*1000).toISOString()});
  return {interval,candles,retrievedAt,product:'ETH-USD'};
}

test('ETH reads only supported presentation choices and ignores BTC scenarios, dates, price domains and layers',()=>{
  const polluted=new URLSearchParams('page=compare&legacy=1&symbol=BTCUSD&span=history&assumption=stress&scenario=bottom-holds&view-start=2010-01-01&view-end=2050-12-31&price-min=90000&price-max=150000&indicators=cycle&cycle-panel=open&chart=forecast&unit=indexed');
  assert.deepEqual(readEthView(polluted),{frequency:'daily',chartType:'line',scale:'log',span:'4y'});
  polluted.set('granularity','4h');polluted.set('type','candles');polluted.set('axis','linear');polluted.set('eth-span','1y');
  assert.deepEqual(readEthView(polluted),{frequency:'4h',chartType:'candles',scale:'linear',span:'1y'});
  const invalid=new URLSearchParams('granularity=1s&type=heikin-ashi&axis=percent&eth-span=future');
  assert.deepEqual(readEthView(invalid),{frequency:'daily',chartType:'line',scale:'log',span:'4y'});
});

test('ETH share queries round-trip every supported interval with only asset-scoped presentation state',()=>{
  for(const frequency of ['1m','5m','15m','30m','1h','4h','daily','weekly']){
    for(const chartType of ['line','candles']){
      for(const scale of ['log','linear']){
        for(const span of ['1m','6m','1y','4y','all']){
          const state={frequency,chartType,scale,span,assumption:'stress',priceDomain:{min:90000,max:150000},range:{start:0,end:9999999999}};
          const params=new URLSearchParams(ethViewQuery(state));
          assert.equal(params.get('symbol'),'ETHUSD');
          assert.deepEqual(readEthView(params),{frequency,chartType,scale,span});
          assert.ok([...params.keys()].every(key=>['symbol','granularity','type','axis','eth-span'].includes(key)));
        }
      }
    }
  }
  assert.equal(ethViewQuery({frequency:'daily',chartType:'line',scale:'log',span:'4y'}),'symbol=ETHUSD');
});

test('the default four-year daily view ends at the last observed candle boundary, never a forecast horizon',()=>{
  const observed=series('daily','2016-05-24','2026-10-23'),range=ethHistoryRange(observed);
  assert.equal(range.start,seconds('2022-10-24'));
  assert.equal(range.end,seconds('2026-10-24'));
  assert.equal(range.end-range.start,1461*DAY);
  assert.equal(range.max,observed.candles.at(-1).time+DAY);
  assert.ok(range.end*1000<=Date.parse(observed.retrievedAt));
  assert.equal(range.step,DAY);assert.equal(range.unit,'seconds');
  assert.match(range.contextKey,/^ETH-USD:daily:/);
  const history=ethHistoryRange(observed,'all');
  assert.equal(history.start,observed.candles[0].time-DAY,'one leading candle of visual margin');
  assert.equal(history.end,range.end);
  for(const [span,days]of [['1m',30],['6m',183],['1y',365]])assert.equal(ethHistoryRange(observed,span).end-ethHistoryRange(observed,span).start,days*DAY);
});

test('weekly default and all-history windows remain on the Monday UTC grid and end at a completed week',()=>{
  const observed=series('weekly','2016-05-30','2026-10-12'),range=ethHistoryRange(observed);
  assert.equal(range.step,WEEK);assert.equal(range.end,seconds('2026-10-19'));
  assert.equal((range.end-range.start)/WEEK,Math.ceil(1461/7));
  for(const value of [range.start,range.end,range.min,range.max]){
    assert.equal(new Date(value*1000).getUTCDay(),1);
    assert.equal(Math.abs((value-observed.candles[0].time)%WEEK),0);
    assert.ok(value*1000<=Date.parse(observed.retrievedAt));
  }
  const history=ethHistoryRange(observed,'all');assert.equal(history.start,history.min);assert.equal(history.end,history.max);
});

test('short or missing archives do not invent history and all date presets clamp to available observations',()=>{
  assert.equal(ethHistoryRange({interval:'daily',candles:[]}),null);
  assert.equal(ethHistoryRange({interval:'daily',candles:[{time:NaN}]}),null);
  const observed=series('daily','2026-10-20','2026-10-23');
  for(const span of ['1m','6m','1y','4y','all']){
    const range=ethHistoryRange(observed,span);
    assert.equal(range.start,seconds('2026-10-19'));assert.equal(range.end,seconds('2026-10-24'));
    assert.ok(range.minSpan>0&&range.minSpan<=6);
  }
  assert.equal(ethRangeLabel('1m','all'),'최근 구간');assert.equal(ethRangeLabel('4h','4y'),'최근 구간');
  assert.equal(ethRangeLabel('daily','4y'),'4년');assert.equal(ethRangeLabel('weekly','all'),'전체');
});

test('real navigation operations keep ETH daily and weekly ranges bounded and grid-aligned through repeated pans/zooms',()=>{
  for(const observed of [series('daily','2016-05-24','2026-10-23'),series('weekly','2016-05-30','2026-10-12')]){
    let range=ethHistoryRange(observed),seed=17;
    const min=range.min,max=range.max,step=range.step;
    for(let i=0;i<160;i++){
      seed=(seed*1664525+1013904223)>>>0;
      const fraction=(seed/2**32-.5)*2;
      range=i%3?panRange(range,fraction):zoomRange(range,i%2?.68:1.9,.35);
      assert.ok(range.start>=min&&range.end<=max,'observed bounds are retained');
      assert.ok(range.end>range.start);assert.equal((range.start-min)%step,0);assert.equal((range.end-min)%step,0);
    }
    const entire=fitRange(range);assert.equal(entire.start,min);assert.equal(entire.end,max);
    assert.equal(panRange(ethHistoryRange(observed),1000).end,max);
    assert.equal(panRange(ethHistoryRange(observed),-1000).start,min);
  }
});

// Execute the production entry's actual branching and error handling. Only its
// import() boundary is injected so no browser application or model executes in
// this test process; the selected module and initialization are observed.
async function runEntry(search,{failImport=false,failInit=false}={}){
  const source=await readFile(new URL('../dist/site-entry.js',import.meta.url),'utf8');
  const imports=[],events=[],errors=[],bootSymbol={textContent:'BTCUSD'},root={dataset:{}},initializations=[];
  const context={
    URLSearchParams,location:{search},console:{error:(...values)=>errors.push(values)},
    CustomEvent:class{constructor(type){this.type=type;}},
    document:{documentElement:root,querySelector:()=>bootSymbol,dispatchEvent:event=>events.push(event.type)},
    __import:async path=>{imports.push(path);if(failImport)throw new Error('module unavailable');return {initEthView:async()=>{initializations.push('ETHUSD');await Promise.resolve();if(failInit)throw new Error('snapshot unavailable');initializations.push('ready');}};},
  };
  await vm.runInNewContext(`(async()=>{${source.replace(/\bimport\s*\(/g,'__import(')}\n})()`,context,{timeout:1000});
  return {imports,events,errors,bootSymbol,root,initializations};
}

test('ETH routing loads and awaits only the ETH workspace, while BTC and unsupported symbols retain the BTC entry',async()=>{
  for(const query of ['?symbol=ETHUSD','?symbol=ethusd','?symbol=ETHUSD&page=compare&assumption=stress']){
    const result=await runEntry(query);
    assert.equal(result.imports.length,1);assert.match(result.imports[0],/^\.\/eth-view\.js\?/);
    assert.deepEqual(result.initializations,['ETHUSD','ready']);assert.deepEqual(result.events,[]);
    assert.equal(result.root.dataset.symbol,'ETHUSD');assert.equal(result.bootSymbol.textContent,'ETHUSD');
  }
  for(const query of ['','?symbol=BTCUSD','?symbol=ETHUSDT','?symbol=unknown']){
    const result=await runEntry(query);assert.equal(result.imports.length,1);assert.match(result.imports[0],/^\.\/app\.js\?/);
    assert.deepEqual(result.initializations,[]);assert.equal(result.root.dataset.symbol,'BTCUSD');
  }
});

test('a failed ETH import or initialization reports the boot error and never falls back to a mislabeled BTC chart',async()=>{
  for(const failure of [{failImport:true},{failInit:true}]){
    const result=await runEntry('?symbol=ETHUSD',failure);
    assert.equal(result.imports.length,1);assert.match(result.imports[0],/^\.\/eth-view\.js\?/);
    assert.deepEqual(result.events,['atlas:boot-error']);assert.equal(result.errors.length,1);
    assert.equal(result.root.dataset.symbol,'ETHUSD');
  }
});

test('the complete ETH module graph excludes BTC workspaces, forecast engines and cycle-analysis controllers',async()=>{
  const seen=new Set(),pending=[new URL('../dist/eth-view.js',import.meta.url)];
  while(pending.length){
    const url=pending.pop();url.search='';if(seen.has(url.href))continue;seen.add(url.href);
    const source=await readFile(url,'utf8');
    for(const match of source.matchAll(/^\s*(?:import|export)\s+(?:[^'"\n]*?\s+from\s*)?['"](\.[^'"]+)['"]|\bimport\s*\(\s*['"](\.[^'"]+)['"]\s*\)/gm))pending.push(new URL(match[1]||match[2],url));
  }
  const names=[...seen].map(value=>new URL(value).pathname.split('/').at(-1));
  assert.ok(names.includes('market-data-controller.js'));assert.ok(names.includes('intraday-chart.js'));assert.ok(names.includes('eth-market-data.js'));assert.ok(names.includes('symbol-selector.js'));
  for(const name of names)assert.doesNotMatch(name,/^(?:app|lab-view|workbench-chrome|atlas-analysis|atlas-price-chart|bitcoin-events|cycle-calibration|cycle-timing|cycle-milestones|market-structure|forecast-engine|detailed-forecast|long-horizon-forecast|volume-forecast|outlook-engine)\.js$/);
});
