import assert from 'node:assert/strict';
import test from 'node:test';
import { utcDay } from '../dist/cycle-engine.js';
import { fitRange, panRange, zoomRange } from '../dist/chart-navigation.js';
import { panPriceDomain } from '../dist/price-axis.js';
import { navigationHarness } from './helpers/navigation-fixture.mjs';

const full={start:'2024-01-01',end:'2024-04-09',min:'2024-01-01',max:'2024-04-09',allowEmpty:true,contextKey:'daily-source'};
const count=range=>utcDay(range.end)-utcDay(range.start)+1;
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} ≈ ${b}`);
function priceHarness(options={}){
  let axis={min:100,max:200,scale:'linear',inverted:false,top:50,bottom:400,left:60,right:930,mode:'auto',...options.axis};
  const yChanges=[],history=[];let resets=0;
  const h=navigationHarness(full,{getPriceAxis:()=>axis,onPriceRangeChange:domain=>{axis={...axis,...domain,mode:'manual'};yChanges.push(domain);},onPriceReset:()=>{resets++;axis={...axis,min:100,max:200,mode:'auto'};},onGestureStart:label=>history.push(['start',label]),onGestureEnd:()=>history.push(['end'])});
  return {...h,get range(){return h.range;},set range(value){h.range=value;},set tool(value){h.tool=value;},get resets(){return h.resets;},get axis(){return axis;},set axis(value){axis=value;},yChanges,history,get yResets(){return resets;}};
}

test('full-width zoom preserves its width while panning beyond either real-data edge',()=>{
  assert.equal(count(zoomRange(full,100)),100);
  const left=panRange(full,-1),right=panRange(full,1);
  assert.equal(count(left),100);assert.equal(count(right),100);
  assert.ok(left.end<full.min);assert.ok(right.start>full.max);
  assert.equal(left.min,full.min);assert.equal(right.max,full.max);
  assert.deepEqual(fitRange(left),full);
  assert.deepEqual(panRange({...full,allowEmpty:false},1),{...full,allowEmpty:false});
});

test('free UTC panning remains bounded to supported dates and keeps the candle grid',()=>{
  assert.equal(panRange(full,-1e9).start,'1800-01-01');assert.equal(panRange(full,1e9).end,'2400-12-31');
  const first=Date.parse('2026-10-22T00:00:00Z')/1000,range={unit:'seconds',step:900,minSpan:12,maxSpan:6000,allowEmpty:true,min:first,max:first+99*900,start:first,end:first+99*900};
  const empty=panRange(range,8);assert.ok(empty.start>range.max);assert.equal((empty.end-empty.start)/900+1,100);assert.equal(empty.start%900,0);
  const earliest=panRange(range,-1e9);assert.equal(new Date(earliest.start*1000).toISOString(),'1800-01-01T00:00:00.000Z');
  assert.throws(()=>fitRange({...range,max:first+60*900,maxSpan:4}),RangeError);
});

test('one drag updates UTC time and raw USD Y together at maximum zoom-out',()=>{
  const h=priceHarness();h.fire('pointerdown',{clientX:500,clientY:200});
  h.pointer('pointermove',{clientX:674,clientY:270});assert.equal(h.changes.length,0);assert.equal(h.yChanges.length,0);h.flush();
  assert.equal(h.range.start,'2023-12-12');assert.equal(count(h.range),100);close(h.axis.min,120);close(h.axis.max,220);assert.equal(h.axis.mode,'manual');
  h.pointer('pointermove',{clientX:761,clientY:305});h.flush();
  assert.equal(h.range.start,'2023-12-02');close(h.axis.min,130);close(h.axis.max,230);
  assert.equal(h.history.filter(item=>item[0]==='start').length,1);assert.equal(h.history.filter(item=>item[0]==='end').length,0);
  h.pointer('pointerup',{clientX:761,clientY:305});assert.equal(h.history.filter(item=>item[0]==='end').length,1);
  const x={...h.range};h.fire('dblclick',{clientX:965,clientY:200});assert.equal(h.yResets,1);assert.deepEqual(h.range,x);assert.equal(h.axis.mode,'auto');h.controller.destroy();
});

test('vertical-only mouse pan permits empty linear USD space without moving time',()=>{
  const h=priceHarness();h.fire('pointerdown',{clientX:500,clientY:200});h.pointer('pointermove',{clientX:500,clientY:-325});h.flush();
  assert.deepEqual(h.range,full);close(h.axis.min,-50);close(h.axis.max,50);assert.equal(h.changes.length,0);assert.equal(h.yChanges.length,1);
  h.pointer('pointerup',{clientX:500,clientY:-325});h.controller.destroy();
});

test('horizontal pan and tiny Y jitter retain Auto, while a real Y move can return to its original raw range',()=>{
  const h=priceHarness();h.fire('pointerdown',{clientX:500,clientY:200});
  for(const point of [{clientX:674,clientY:200},{clientX:761,clientY:202}]){h.pointer('pointermove',point);h.flush();}
  assert.equal(h.yChanges.length,0);assert.equal(h.axis.mode,'auto');assert.notEqual(h.range.start,full.start);
  h.pointer('pointermove',{clientX:761,clientY:206});h.flush();assert.equal(h.axis.mode,'manual');assert.ok(h.axis.min>100);
  h.pointer('pointermove',{clientX:761,clientY:200});h.flush();close(h.axis.min,100);close(h.axis.max,200);assert.equal(h.yChanges.length,2);
  h.pointer('pointerup',{clientX:761,clientY:200});assert.equal(h.history.length,2);h.controller.destroy();
});

test('log translation and inverted axes preserve raw geometry and reverse screen direction correctly',()=>{
  const log={min:10,max:1000,scale:'log'};const shifted=panPriceDomain(log,.5);close(shifted.min,100);close(shifted.max,10000);close(shifted.max/shifted.min,100);
  assert.deepEqual(panPriceDomain({min:100,max:200,scale:'linear',inverted:true},.2),{min:80,max:180});
  const h=priceHarness({axis:{inverted:true}});h.fire('pointerdown',{clientX:500,clientY:200});h.pointer('pointermove',{clientX:500,clientY:270});h.flush();close(h.axis.min,80);close(h.axis.max,180);h.controller.destroy();
});

test('time-axis drag changes only UTC spacing and remains available in measurement mode',()=>{
  const h=priceHarness();h.svg.dataset.timeAxisTop='450';h.tool='measure';h.controller.update();
  assert.equal(h.fire('pointerdown',{clientX:500,clientY:470}).defaultPrevented,true);
  h.pointer('pointermove',{clientX:326,clientY:470});h.flush();assert.ok(count(h.range)<100);assert.equal(h.yChanges.length,0);assert.equal(h.axis.mode,'auto');
  h.pointer('pointerup',{clientX:326,clientY:470});assert.equal(h.history.length,2);
  h.fire('dblclick',{clientX:500,clientY:470});assert.equal(h.resets,1);h.controller.destroy();
});

test('a wheel burst records one transaction while discrete keys record separate operations',()=>{
  const history=[],h=navigationHarness(full,{onGestureStart:label=>history.push(['start',label]),onGestureEnd:()=>history.push(['end'])});
  for(let i=0;i<4;i++){h.fire('wheel',{deltaY:-40});h.flush();}
  assert.equal(history.length,1);assert.equal(h.timers.size,1);h.expire();assert.equal(history.length,2);
  h.fire('keydown',{key:'ArrowRight',shiftKey:true});h.flush();h.fire('keydown',{key:'+'});h.flush();
  assert.equal(history.filter(item=>item[0]==='start').length,3);assert.equal(history.filter(item=>item[0]==='end').length,3);h.controller.destroy();
});

test('source or scale changes discard queued two-dimensional moves instead of applying stale axes',()=>{
  for(const change of ['source','scale']){
    const h=priceHarness();h.fire('pointerdown');h.pointer('pointermove',{clientX:600,clientY:250});
    if(change==='source')h.range={...h.range,contextKey:'replaced-source'};else h.axis={...h.axis,scale:'log'};
    h.controller.update();h.flush();assert.equal(h.changes.length,0);assert.equal(h.yChanges.length,0);assert.equal(h.history.filter(item=>item[0]==='end').length,1);h.controller.destroy();
  }
});

test('long-press tracking hands two existing fingers to a live pinch without requiring new pointerdown events',()=>{
  const h=priceHarness();h.controller.cancelGesture();
  assert.equal(h.controller.resumeTouchGesture([{pointerId:11,clientX:300,clientY:200},{pointerId:12,clientX:700,clientY:200}]),true);
  assert.deepEqual([...h.element.capture].sort(),[11,12]);
  const event=h.pointer('pointermove',{pointerId:12,pointerType:'touch',isPrimary:false,clientX:850,clientY:200});assert.equal(event.defaultPrevented,true);h.flush();
  assert.ok(count(h.range)<100);assert.equal(h.yChanges.length,0);
  h.pointer('pointerup',{pointerId:12,pointerType:'touch'});assert.equal(h.element.capture.size,0);assert.equal(h.history.length,2);assert.equal(h.fire('click').defaultPrevented,true);h.controller.destroy();
});

test('explicit pan owns mobile vertical gestures, while crosshair preserves page scrolling',()=>{
  const h=priceHarness();h.controller.update();assert.equal(h.element.style.touchAction,'pan-y pinch-zoom');
  h.fire('pointerdown',{pointerType:'touch',clientX:500,clientY:200});assert.equal(h.pointer('pointermove',{pointerType:'touch',clientX:501,clientY:280}).defaultPrevented,false);h.controller.cancelGesture();
  h.tool='pan';h.controller.update();assert.equal(h.element.style.touchAction,'none');
  h.fire('pointerdown',{pointerType:'touch',clientX:500,clientY:200});assert.equal(h.pointer('pointermove',{pointerType:'touch',clientX:501,clientY:280}).defaultPrevented,true);h.flush();assert.ok(h.axis.min>100);
  h.controller.destroy();assert.equal(h.element.style.touchAction,'original');
});
