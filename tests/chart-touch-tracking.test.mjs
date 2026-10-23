import test from 'node:test';
import assert from 'node:assert/strict';
import {mountChartTouchTracking} from '../dist/chart-touch-tracking.js';

function setup({canStart=()=>true}={}){
  const listeners=new Map(),windowListeners=new Map(),captured=new Set(),jobs=new Map(),values=[],transitions=[],pinches=[];let tool='crosshair',clock=0,serial=0,cancels=0,clears=0;
  const timers={setTimeout(fn,delay){const id=++serial;jobs.set(id,{fn,time:clock+delay});return id;},clearTimeout:id=>jobs.delete(id)};
  const view={addEventListener(type,fn){windowListeners.set(type,[...(windowListeners.get(type)||[]),fn]);},removeEventListener(type,fn){windowListeners.set(type,(windowListeners.get(type)||[]).filter(item=>item!==fn));}};
  const element={dataset:{},ownerDocument:{defaultView:view},addEventListener(type,fn){listeners.set(type,[...(listeners.get(type)||[]),fn]);},removeEventListener(type,fn){listeners.set(type,(listeners.get(type)||[]).filter(item=>item!==fn));},setPointerCapture:id=>captured.add(id),releasePointerCapture:id=>captured.delete(id),hasPointerCapture:id=>captured.has(id)};
  const tracking=mountChartTouchTracking({element,timers,canStart,getTool:()=>tool,preview:p=>values.push(p),clear:()=>clears++,cancelNavigation:()=>cancels++,resumeNavigation:p=>pinches.push(p),onChange:value=>transitions.push(value)});
  function send(type,id=1,x=100,y=100,extra={}){const event={type,pointerId:id,pointerType:'touch',clientX:x,clientY:y,target:{closest:()=>null},preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;},...extra};for(const fn of [...windowListeners.get(type)||[],...listeners.get(type)||[]]){fn(event);if(event.stopped)break;}return event;}
  function advance(ms){clock+=ms;for(const [id,job] of [...jobs])if(job.time<=clock){jobs.delete(id);job.fn();}}
  return {tracking,element,view,send,advance,values,transitions,pinches,captured,setTool:value=>{tool=value;},counts:()=>({cancels,clears,jobs:jobs.size})};
}

test('long press previews raw pointer without selecting and next tap exits',()=>{
  const s=setup();assert.equal(s.send('pointerdown').prevented,undefined);s.advance(499);assert.equal(s.tracking.active,false);
  s.advance(1);assert.equal(s.tracking.active,true);assert.equal(s.counts().cancels,1);assert.deepEqual(s.values[0],{pointerId:1,clientX:100,clientY:100});
  assert.equal(s.send('pointermove',1,145,120).prevented,true);assert.equal(s.values.at(-1).clientX,145);
  s.send('pointerup',1,145,120);assert.equal(s.tracking.active,true);
  s.send('pointerdown',2,150,121);s.send('pointerup',2,150,121);assert.equal(s.tracking.active,false);assert.equal(s.counts().clears,1);assert.equal(s.captured.size,0);
});

test('normal pan motion or initial pinch cancels pending long press without consuming navigation',()=>{
  const s=setup();s.send('pointerdown');assert.equal(s.send('pointermove',1,112,100).prevented,undefined);s.advance(1000);assert.equal(s.tracking.active,false);
  s.send('pointerup');s.send('pointerdown');assert.equal(s.send('pointerdown',2,130,100).prevented,undefined);s.advance(1000);assert.equal(s.tracking.active,false);assert.equal(s.counts().cancels,0);
});

test('a second finger transfers both exact pointer coordinates into pinch',()=>{
  const s=setup();s.send('pointerdown');s.advance(500);s.send('pointermove',1,105,115);
  const event=s.send('pointerdown',2,200,220);assert.equal(event.prevented,true);assert.equal(s.tracking.active,false);
  assert.deepEqual(s.pinches[0],[{pointerId:1,clientX:105,clientY:115},{pointerId:2,clientX:200,clientY:220}]);
  assert.equal(s.send('pointermove',2,210,230).prevented,undefined);
});

test('cancel, tool changes and interactive targets cannot strand a timer or capture',()=>{
  const s=setup();s.send('pointerdown');s.tracking.cancel();s.advance(500);assert.equal(s.tracking.active,false);
  s.send('pointerdown',1,100,100,{target:{closest:()=>({})}});s.advance(500);assert.equal(s.counts().jobs,0);
  s.setTool('measure');s.send('pointerdown');s.advance(500);assert.equal(s.tracking.active,false);
  s.setTool('crosshair');s.send('pointerdown');s.advance(500);s.send('pointercancel');assert.equal(s.tracking.active,false);assert.equal(s.captured.size,0);
  s.tracking.destroy();s.send('pointerdown');s.advance(500);assert.equal(s.tracking.active,false);
});

test('window capture sees movement before navigation stops it and a begun drag cancels a small hold',()=>{
  const s=setup();s.view.addEventListener('pointermove',event=>{s.tracking.cancelPending();event.stopImmediatePropagation();});
  s.send('pointerdown');s.send('pointermove',1,106,100);s.advance(1000);assert.equal(s.tracking.active,false);
  // Keep both members of the current touch cohort: the second finger cannot arm a new hold.
  s.send('pointerdown',2,120,100);s.advance(1000);assert.equal(s.tracking.active,false);
});

test('axes do not arm tracking and native touch scrolling is prevented only while tracking',()=>{
  const axes=setup({canStart:point=>point.clientX<200});axes.send('pointerdown',1,250,100);axes.advance(500);assert.equal(axes.tracking.active,false);
  const s=setup();assert.equal(s.send('touchmove').prevented,undefined);s.send('pointerdown');s.advance(500);assert.equal(s.send('touchmove').prevented,true);s.tracking.cancel();assert.equal(s.send('touchmove').prevented,undefined);
});
