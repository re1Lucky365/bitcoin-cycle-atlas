import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {INDICATORS,normalizeIndicatorState} from '../dist/indicator-state.js';
import {indicatorSettings,indicatorSupportsInterval} from '../dist/indicator-settings.js';
import {indicatorReadout,indicatorReadoutDate} from '../dist/indicator-readouts.js';

const source=await readFile(new URL('../dist/indicator-workbench.js',import.meta.url),'utf8');
const paintSource=source.slice(source.indexOf('  function paintValueRows('),source.indexOf('  function paintList('));
const eventSource=source.slice(source.indexOf('  const onWorkbench='),source.indexOf('  const onAnalysis='));
const observed={date:'2026-10-21',price:84176.08,kind:'observed',frequency:'daily',unit:'usd'};
const classified={...observed,marketState:'range',marketStateLabel:'좁은 범위에서 횡보'};

function mountedRows({boot='ready',dialogOpen=false,settings={}}={}){
  const item=INDICATORS.find(item=>item.id==='states');
  const makeRow=()=>({item,row:{dataset:{}},value:{textContent:'자료 대기',dataset:{}},name:{title:''}});
  const chart=makeRow(),library=makeRow(),readoutDate={textContent:''};
  const frames=new Map();let frameId=0;
  const context={
    indicatorReadout,indicatorReadoutDate,indicatorSettings,indicatorSupportsInterval,state:normalizeIndicatorState({added:['states'],settings}),
    doc:{documentElement:{dataset:{boot}}},manager:{hidden:false},dialog:{open:dialogOpen},readoutDate,
    readoutRows:new Map([['states',chart]]),dialogReadoutRows:new Map([['states',library]]),
    readoutContext:{selection:observed,workbench:{},cycle:null,analyses:new Map()},
    requestAnimationFrame(callback){frames.set(++frameId,callback);return frameId;},
    cancelAnimationFrame(id){frames.delete(id);},
    paintCountdown(){},paintDialog(){},
  };
  // Exercise the shipped event handlers and value painters with already-mounted
  // rows. An unchanged indicator list schedules its values without rebuilding.
  const handlers=runInNewContext(`let intraday=false,countdown=null,readoutFrame=0;\n${paintSource}\nfunction paintList(){scheduleReadouts();}\n${eventSource}\n({onWorkbench,onReadout,paintReadouts});`,context);
  handlers.paintReadouts();
  return {
    chart,library,readoutDate,frames,
    select(detail){handlers.onReadout({detail});},
    settle(detail={intraday:false,frequency:'daily'}){handlers.onWorkbench({detail});},
    flush(){const pending=[...frames.values()];frames.clear();for(const callback of pending)callback(0);},
  };
}

test('a completed chart frame publishes its selected state in chart and library rows immediately',async t=>{
  for(const boot of ['loading','ready'])for(const dialogOpen of [false,true])await t.test(`${boot}, library ${dialogOpen?'open':'closed'}`,()=>{
    const h=mountedRows({boot,dialogOpen}),row=h.chart;
    assert.equal(row.value.textContent,'국면 분류 대기');
    h.select(classified);h.settle();
    assert.equal(row.value.textContent,classified.marketStateLabel,'the ribbon and its value must agree before the next frame');
    assert.equal(h.readoutDate.textContent,'2026.10.21 UTC · 선택');
    assert.equal(h.frames.size,0,'the settled render consumes its pending value paint');
    assert.equal(h.chart,row,'a value update preserves the existing row');
    if(dialogOpen)assert.equal(h.library.value.textContent,classified.marketStateLabel);
  });
});

test('ordinary pointer moves keep one queued paint and display only the latest selected observation',()=>{
  const h=mountedRows({dialogOpen:true});
  h.select({...classified,date:'2026-10-19',marketStateLabel:'상승 흐름',hovered:true});
  h.select({...classified,date:'2026-10-20',marketStateLabel:'하락 흐름',hovered:true});
  assert.equal(h.chart.value.textContent,'국면 분류 대기');
  assert.equal(h.frames.size,1);
  h.flush();
  assert.equal(h.chart.value.textContent,'하락 흐름');
  assert.equal(h.library.value.textContent,'하락 흐름');
  assert.equal(h.readoutDate.textContent,'2026.10.20 UTC · 커서');
  assert.equal(h.frames.size,0);
});

test('a completed selection change consumes stale hover work and synchronizes observed or assumed scope',()=>{
  const h=mountedRows({dialogOpen:true});
  h.select(classified);h.flush();
  h.select({...classified,marketStateLabel:'상승 흐름',hovered:true});
  h.select({...classified,date:'2026-10-23',kind:'simulated'});h.settle();
  for(const row of [h.chart,h.library]){
    assert.equal(row.value.textContent,'가정 좁은 범위에서 횡보');
    assert.equal(row.value.dataset.tone,'scenario');
  }
  assert.equal(h.readoutDate.textContent,'2026.10.23 UTC · 선택 · 가정');
  assert.equal(h.frames.size,0);
  h.flush();
  assert.equal(h.chart.value.textContent,'가정 좁은 범위에서 횡보');
  h.select(observed);h.settle();
  for(const row of [h.chart,h.library])assert.equal(row.value.textContent,'국면 분류 대기');
  assert.equal(h.readoutDate.textContent,'2026.10.21 UTC · 선택');
});

test('hidden value settings preserve the latest coalesced observation without making the graph unavailable',()=>{
  const h=mountedRows({dialogOpen:true,settings:{states:{values:false}}});h.select(classified);h.settle();
  for(const row of [h.chart,h.library]){assert.equal(row.value.hidden,true);assert.equal(row.value.textContent,classified.marketStateLabel);assert.equal(row.row.dataset.value,classified.marketStateLabel);}
  assert.equal(h.frames.size,0);
});
