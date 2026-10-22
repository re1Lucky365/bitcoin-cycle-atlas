import assert from 'node:assert/strict';
import test from 'node:test';
import { utcDay } from '../dist/cycle-engine.js';
import { fitRange,zoomRange,panRange,bindChartNavigation } from '../dist/chart-navigation.js';

const range={start:'2024-01-01',end:'2024-04-09',min:'2023-01-01',max:'2025-12-31'};
const length=value=>utcDay(value.end)-utcDay(value.start)+1;

test('zoom keeps an anchored calendar date while using inclusive UTC days',()=>{
  assert.equal(length(range),100);
  const centered=zoomRange(range,.5);
  assert.equal(length(centered),50);
  assert.equal(centered.start,'2024-01-26');
  assert.equal(centered.end,'2024-03-15');
  assert.equal(zoomRange(range,.5,0).start,range.start);
  assert.equal(zoomRange(range,.5,1).end,range.end);
  assert.deepEqual(zoomRange(range,1),range);
});

test('zoom limits minimum span and respects the full data and future boundary',()=>{
  assert.equal(length(zoomRange(range,.00001)),30);
  const leap={...range,start:'2024-02-01',end:'2024-03-01'};
  assert.equal(length(leap),30);
  assert.deepEqual(zoomRange(leap,.5),leap);
  assert.deepEqual(zoomRange(range,1000),fitRange(range));
  const edge={...range,start:'2025-12-01',end:'2025-12-31'};
  const expanded=zoomRange(edge,2,0);
  assert.equal(expanded.end,range.max);
  assert.equal(length(expanded),62);
});

test('pan moves both edges together and clamps without shrinking the window',()=>{
  const later=panRange(range,.25);
  assert.equal(later.start,'2024-01-26');
  assert.equal(later.end,'2024-05-04');
  assert.equal(length(later),100);
  const earliest=panRange(range,-100),latest=panRange(range,100);
  assert.equal(earliest.start,range.min);
  assert.equal(latest.end,range.max);
  assert.equal(length(earliest),100);
  assert.equal(length(latest),100);
  assert.deepEqual(panRange(earliest,-1),earliest);
  assert.deepEqual(panRange(latest,1),latest);
});

test('pan rounds half-day offsets symmetrically and preserves unclamped round trips',()=>{
  const original={start:'2026-03-17',end:'2029-05-29',min:'2010-07-18',max:'2032-12-31'};
  assert.equal(length(original),1170);
  const earlier=panRange(original,-.25),later=panRange(original,.25);
  assert.equal(utcDay(earlier.start)-utcDay(original.start),-293);
  assert.equal(utcDay(later.start)-utcDay(original.start),293);
  for(const fraction of [.25,-.25,.5,-.5]){
    let current=original;
    for(let i=0;i<12;i++){
      const shifted=panRange(current,fraction);
      assert.ok(shifted.start>original.min&&shifted.end<original.max);
      assert.equal(length(shifted),length(original));
      current=panRange(shifted,-fraction);
      assert.deepEqual(current,original);
    }
  }
});

test('short available history remains usable and fit never fabricates dates',()=>{
  const short={start:'2024-02-29',end:'2024-02-29',min:'2024-02-29',max:'2024-03-05'};
  assert.deepEqual(fitRange(short),{...short,start:'2024-02-29',end:'2024-03-05'});
  assert.deepEqual(zoomRange(short,.1),fitRange(short));
  assert.deepEqual(panRange(short,1),fitRange(short));
  const single={start:'2024-02-29',end:'2024-02-29',min:'2024-02-29',max:'2024-02-29'};
  assert.deepEqual(zoomRange(single,10),single);
});

test('range math rejects impossible dates and invalid movements',()=>{
  assert.throws(()=>zoomRange({...range,start:'2024-02-30'},.8),/Invalid calendar date/);
  assert.throws(()=>zoomRange(range,0),RangeError);
  assert.throws(()=>zoomRange(range,NaN),RangeError);
  assert.throws(()=>zoomRange(range,1,Infinity),RangeError);
  assert.throws(()=>panRange(range,Infinity),RangeError);
  assert.throws(()=>fitRange({...range,min:range.max,max:range.min}),RangeError);
  assert.throws(()=>fitRange({...range,start:range.end,end:range.start}),RangeError);
});

test('repeated navigation never crosses the declared observed and simulated limits',()=>{
  let current={start:'2026-10-22',end:'2029-10-22',min:'2010-07-18',max:'2029-10-22'};
  for(let i=0;i<80;i++){
    current=zoomRange(current,i%2?.8:1.25,(i%7)/6);
    current=panRange(current,(i%5-2)*.21);
    assert.ok(current.start>=current.min);
    assert.ok(current.end<=current.max);
    assert.ok(length(current)>=30);
    assert.ok(Number.isInteger(utcDay(current.start))&&Number.isInteger(utcDay(current.end)));
  }
});

const firstTime=Date.parse('2026-10-22T00:00:00Z')/1000;
const intraday={unit:'seconds',min:firstTime,max:firstTime+179*900,start:firstTime+40*900,end:firstTime+139*900,step:900,minSpan:12,contextKey:'market:15m:snapshot-a'};
const barCount=value=>(value.end-value.start)/value.step+1;

test('intraday navigation preserves actual UTC spacing, anchor, bounds and source identity',()=>{
  assert.equal(barCount(intraday),100);
  for(const anchor of [0,.1,.25,.5,.73,1]){
    const zoomed=zoomRange(intraday,.5,anchor);
    assert.equal(barCount(zoomed),50);
    const before=intraday.start+anchor*(intraday.end-intraday.start);
    const after=zoomed.start+anchor*(zoomed.end-zoomed.start);
    assert.ok(Math.abs(before-after)<=intraday.step/2);
    assert.equal((zoomed.start-intraday.min)%intraday.step,0);
    assert.equal((zoomed.end-intraday.min)%intraday.step,0);
    assert.equal(zoomed.contextKey,intraday.contextKey);
  }
  assert.equal(barCount(zoomRange(intraday,.0001)),12);
  assert.deepEqual(zoomRange(intraday,100),fitRange(intraday));
  assert.equal(barCount(panRange(intraday,100)),100);
  assert.equal(panRange(intraday,100).end,intraday.max);
  assert.equal(panRange(intraday,-100).start,intraday.min);
  assert.deepEqual(panRange(panRange(intraday,.25),-.25),intraday);
});

test('intraday windows do not synthesize timestamps in missing-bar gaps',()=>{
  // Navigation has a time domain, never a series to fill or new OHLC values.
  const supplied=[0,1,2,5,6,7,8,9,10,11,12,13].map(i=>firstTime+i*60);
  const source=[...supplied];
  const domain={unit:'seconds',min:supplied[0],max:supplied.at(-1),start:supplied[0],end:supplied.at(-1),step:60,minSpan:4};
  const zoomed=zoomRange(domain,.5,0);
  assert.deepEqual(supplied.filter(time=>time>=zoomed.start&&time<=zoomed.end),source.slice(0,5));
  assert.deepEqual(supplied,source);
  assert.equal(barCount(zoomed),7);
  const short={...domain,minSpan:12,end:domain.min+3*60,max:domain.min+3*60};
  assert.deepEqual(zoomRange(short,.01),short);
});

test('seconds ranges reject malformed, mixed or off-grid times',()=>{
  for(const change of [{step:0},{step:60.5},{start:Infinity},{end:'2026-10-22'},{max:intraday.max+1},{start:intraday.start+1},{minSpan:0},{minSpan:1.5},{unit:'minutes'}]){
    assert.throws(()=>zoomRange({...intraday,...change},.8),RangeError);
  }
  assert.throws(()=>fitRange(null),TypeError);
});

// Dependency-free event/DOM boundary harness. It exercises handlers, range
// callbacks, focus and cleanup; real layout/pointer behavior is audited in a
// browser separately, rather than claiming this harness is a browser test.
class EventSurface {
  constructor(){this.listeners=new Map();}
  addEventListener(type,handler,options){const list=this.listeners.get(type)||[];list.push({handler,options});this.listeners.set(type,list);}
  removeEventListener(type,handler){this.listeners.set(type,(this.listeners.get(type)||[]).filter(item=>item.handler!==handler));}
  emit(type,values={}){
    const event={type,target:this,button:0,buttons:1,pointerId:1,pointerType:'mouse',isPrimary:true,clientX:500,clientY:200,deltaX:0,deltaY:0,deltaMode:0,detail:1,key:'',defaultPrevented:false,stopped:false,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},stopImmediatePropagation(){this.stopped=true;this.immediate=true;},...values};
    for(const {handler}of [...(this.listeners.get(type)||[])]){handler(event);if(event.immediate)break;}
    return event;
  }
  listenerCount(){return [...this.listeners.values()].reduce((sum,list)=>sum+list.length,0);}
}
class TestElement extends EventSurface {
  constructor(tag,ownerDocument){super();this.tagName=tag.toUpperCase();this.ownerDocument=ownerDocument;this.children=[];this.dataset={};this.style={touchAction:'original'};this.attributes=new Map();this.hidden=false;this.disabled=false;this.parentElement=null;this.capture=new Set();this.clientWidth=1000;this.clientHeight=500;this.offsetWidth=220;this.offsetHeight=210;this.textContent='';}
  append(...children){for(const child of children){child.remove?.();child.parentElement=this;this.children.push(child);}}
  remove(){if(this.parentElement){this.parentElement.children=this.parentElement.children.filter(child=>child!==this);this.parentElement=null;}}
  setAttribute(key,value){this.attributes.set(key,String(value));}
  getAttribute(key){return this.attributes.get(key)??null;}
  contains(target){return target===this||this.children.some(child=>child.contains?.(target));}
  matchesSelector(selector){
    if(selector==='svg[data-plot-left]:not([hidden])')return this.tagName==='SVG'&&this.dataset.plotLeft!==undefined&&!this.hidden;
    if(selector==='[role=button]:not(.history-event-marker)')return this.getAttribute('role')==='button'&&!this.getAttribute('class')?.split(/\s+/).includes('history-event-marker');
    if(selector.startsWith('[role='))return this.getAttribute('role')===selector.slice(6,-1);
    if(selector==='[contenteditable=true]')return this.getAttribute('contenteditable')==='true';
    if(selector==='[data-next-turn]')return this.dataset.nextTurn!==undefined;
    return this.tagName.toLowerCase()===selector;
  }
  closest(selector){return selector.split(',').some(item=>this.matchesSelector(item))?this:this.parentElement?.closest(selector)||null;}
  querySelector(selector){for(const child of this.children){if(child.matchesSelector?.(selector))return child;const nested=child.querySelector?.(selector);if(nested)return nested;}return null;}
  getBoundingClientRect(){return {left:0,top:0,width:1000,height:500,right:1000,bottom:500};}
  focus(){this.ownerDocument.activeElement=this;this.ownerDocument.emit('focusin',{target:this});}
  setPointerCapture(id){this.capture.add(id);}
  hasPointerCapture(id){return this.capture.has(id);}
  releasePointerCapture(id){this.capture.delete(id);this.emit('lostpointercapture',{pointerId:id});}
  click(){if(!this.disabled&&!this.hidden)this.onclick?.({target:this});}
}
function navigationHarness(initial=range,extra={}){
  const window=new EventSurface(),document=new EventSurface();document.defaultView=window;document.hidden=false;
  window.navigator={clipboard:{writeText:text=>{copies.push(text);return Promise.resolve();}}};
  let nextFrame=0;const frames=new Map();window.requestAnimationFrame=fn=>{frames.set(++nextFrame,fn);return nextFrame;};window.cancelAnimationFrame=id=>frames.delete(id);
  document.createElement=tag=>new TestElement(tag,document);
  const element=document.createElement('div'),svg=document.createElement('svg');
  svg.dataset={plotLeft:'60',plotRight:'930',plotTop:'50',plotBottom:'440'};svg.viewBox={baseVal:{x:0,y:0,width:1000,height:500}};element.append(svg);document.activeElement=svg;
  let live={...initial},tool='crosshair',resets=0;const changes=[],copies=[],announcements=[];
  const controller=bindChartNavigation({element,getRange:()=>live,getTool:()=>tool,onRangeChange:value=>{live=value;changes.push(value);},onReset:()=>resets++,onAnnounce:value=>announcements.push(value),getContext:()=>({label:'2026-10-22 00:00 UTC · 실제 봉',copyText:'Coinbase BTC-USD\n2026-10-22 00:00 UTC\nC 100'}),...extra});
  return {window,document,element,svg,controller,changes,copies,announcements,get range(){return live;},set range(value){live=value;},set tool(value){tool=value;},get resets(){return resets;},frames,flush(){for(const [id,fn]of [...frames]){frames.delete(id);fn();}},fire(type,props={}){return element.emit(type,{target:svg,...props});},pointer(type,props={}){return window.emit(type,{target:svg,...props});},menuButton(action){return controller.menu.children.find(child=>child.dataset?.chartContext===action);}};
}

test('wheel zoom uses the actual plot and cursor; axes, controls and browser zoom stay untouched',()=>{
  const h=navigationHarness();
  const ignored=[{clientX:960,deltaY:-100},{clientY:20,deltaY:-100},{ctrlKey:true,deltaY:-100},{metaKey:true,deltaY:-100},{target:h.controller.toolbar.children[0],deltaY:-100}];
  for(const props of ignored)assert.equal(h.fire('wheel',props).defaultPrevented,false);
  assert.equal(h.frames.size,0);
  const event=h.fire('wheel',{clientX:234,deltaY:-200});assert.equal(event.defaultPrevented,true);h.flush();
  const anchor=(234-60)/(930-60),before=utcDay(range.start)+anchor*(length(range)-1),after=utcDay(h.range.start)+anchor*(length(h.range)-1);
  assert.ok(Math.abs(before-after)<=.5);assert.ok(length(h.range)<100);
  h.controller.destroy();
});

test('historical event label children allow wheel zoom and pan but retain activation and real control boundaries',()=>{
  const h=navigationHarness();
  const marker=h.document.createElement('g'),label=h.document.createElement('rect'),text=h.document.createElement('text');
  marker.setAttribute('class','history-event-marker has-label');marker.setAttribute('role','button');marker.dataset.historyEvent='ftx-bankruptcy';
  marker.append(label,text);h.svg.append(marker);
  assert.equal(h.fire('wheel',{target:label,clientX:234,deltaY:-200}).defaultPrevented,true);h.flush();
  assert.deepEqual(h.range,zoomRange(range,Math.exp(-200*.0015),(234-60)/(930-60)));
  const zoomed=h.range;
  assert.equal(h.fire('wheel',{target:text,shiftKey:true,deltaY:174}).defaultPrevented,true);h.flush();
  assert.deepEqual(h.range,panRange(zoomed,.2));assert.equal(length(h.range),length(zoomed));
  const shifted=h.range;
  assert.equal(h.fire('wheel',{target:label,deltaX:-87,deltaY:2}).defaultPrevented,true);h.flush();
  assert.deepEqual(h.range,panRange(shifted,-.1));
  const changed=h.changes.length;
  for(const type of ['click','pointerdown','dblclick','contextmenu'])assert.equal(h.fire(type,{target:label}).defaultPrevented,false);
  for(const key of ['Enter',' ','+'])assert.equal(h.fire('keydown',{target:text,key}).defaultPrevented,false);
  assert.equal(h.element.dataset.dragging,undefined);assert.equal(h.resets,0);
  const button=h.document.createElement('button'),input=h.document.createElement('input'),otherRole=h.document.createElement('g');
  button.setAttribute('class','history-event-marker');button.setAttribute('role','button');otherRole.setAttribute('role','button');
  marker.append(button,input);h.svg.append(otherRole);
  for(const target of [button,input,otherRole,h.controller.toolbar.children[0],h.controller.menu,h.menuButton('in')]){
    assert.equal(h.fire('wheel',{target,deltaY:-100}).defaultPrevented,false);
  }
  assert.equal(h.fire('wheel',{target:label,ctrlKey:true,deltaY:-100}).defaultPrevented,false);
  assert.equal(h.fire('wheel',{target:label,metaKey:true,deltaY:-100}).defaultPrevented,false);
  assert.equal(h.fire('wheel',{target:label,clientY:20,deltaY:-100}).defaultPrevented,false);
  h.controller.menu.append(marker);
  assert.equal(h.fire('wheel',{target:label,deltaY:-100}).defaultPrevented,false);
  h.flush();assert.equal(h.changes.length,changed);h.controller.destroy();
});

test('plain click is left to selection while a real drag pans and suppresses only its trailing click',()=>{
  const h=navigationHarness();
  h.fire('pointerdown');h.pointer('pointermove',{clientX:503});h.pointer('pointerup',{clientX:503});
  assert.equal(h.fire('click').defaultPrevented,false);assert.equal(h.changes.length,0);
  h.fire('pointerdown');h.pointer('pointermove',{clientX:674});
  assert.equal(h.element.dataset.dragging,'true');assert.equal(h.element.hasPointerCapture(1),true);
  h.pointer('pointerup',{clientX:674});assert.equal(length(h.range),100);assert.equal(h.range.start,'2023-12-12');
  assert.equal(h.element.hasPointerCapture(1),false);assert.equal(h.element.dataset.dragging,undefined);
  assert.equal(h.fire('click').defaultPrevented,true);
  assert.equal(h.fire('click',{detail:0}).defaultPrevented,false);
  h.controller.destroy();
});

test('drag completes outside the chart and cancellation or mode changes discard pending movement',()=>{
  const h=navigationHarness();
  h.fire('pointerdown');h.pointer('pointermove',{clientX:1100,target:h.window});h.pointer('pointerup',{clientX:1100,target:h.window});
  assert.equal(h.changes.length,1);assert.equal(h.element.dataset.dragging,undefined);
  h.fire('pointerdown');h.pointer('pointermove',{clientX:650});h.pointer('pointercancel');h.flush();assert.equal(h.changes.length,1);
  h.fire('pointerdown');h.pointer('pointermove',{clientX:650});h.tool='measure';h.controller.update();h.flush();assert.equal(h.changes.length,1);assert.equal(h.element.hasPointerCapture(1),false);
  h.fire('pointerdown');h.pointer('pointermove',{clientX:750});h.pointer('pointerup');assert.equal(h.changes.length,1);
  h.controller.destroy();
});

test('queued navigation cannot apply to a new interval or a new data revision',()=>{
  const h=navigationHarness(intraday);
  h.fire('wheel',{deltaY:-200});assert.equal(h.frames.size,1);
  h.range={...intraday,contextKey:'market:15m:snapshot-b'};h.flush();assert.equal(h.changes.length,0);
  h.fire('wheel',{deltaY:-200});h.range={...intraday,step:300,max:intraday.min+179*300,start:intraday.min+40*300,end:intraday.min+139*300,contextKey:'market:5m:snapshot-b'};h.controller.update();h.flush();assert.equal(h.changes.length,0);
  h.range=null;h.controller.update();assert.equal(h.controller.toolbar.hidden,true);
  h.controller.destroy();
});

test('keyboard navigation preserves plain arrow selection and provides reset, pan and contextual actions',()=>{
  const h=navigationHarness(intraday);
  assert.equal(h.fire('keydown',{key:'ArrowRight'}).defaultPrevented,false);
  assert.equal(h.fire('keydown',{key:'ArrowRight',shiftKey:true}).defaultPrevented,true);h.flush();assert.ok(h.range.start>intraday.start);
  h.fire('keydown',{key:'r',altKey:true});assert.equal(h.resets,1);
  h.fire('dblclick');assert.equal(h.resets,2);
  h.tool='measure';assert.equal(h.fire('dblclick').defaultPrevented,false);assert.equal(h.resets,2);h.tool='crosshair';
  h.fire('keydown',{key:'F10',shiftKey:true});assert.equal(h.controller.menu.hidden,false);assert.equal(h.document.activeElement.getAttribute('role'),'menuitem');
  h.controller.menu.emit('keydown',{key:'End',target:h.document.activeElement});assert.equal(h.document.activeElement,h.menuButton('copy'));
  h.controller.menu.emit('keydown',{key:'Escape',target:h.document.activeElement});assert.equal(h.controller.menu.hidden,true);assert.equal(h.document.activeElement,h.svg);
  h.controller.destroy();
});

test('context menu writes only on explicit copy and reports clipboard failure',async()=>{
  const h=navigationHarness();
  h.fire('contextmenu',{clientX:900,clientY:410});assert.equal(h.controller.menu.hidden,false);assert.equal(h.copies.length,0);
  assert.equal(h.controller.menu.style.left,'774px');assert.equal(h.controller.menu.style.top,'284px');
  h.menuButton('copy').click();await Promise.resolve();assert.equal(h.copies.length,1);assert.match(h.copies[0],/Coinbase BTC-USD/);assert.match(h.announcements.at(-1),/복사했습니다/);
  h.window.navigator.clipboard.writeText=()=>{throw new Error('denied');};h.controller.openMenu();h.menuButton('copy').click();assert.match(h.announcements.at(-1),/복사하지 못했습니다/);
  h.window.navigator.clipboard=undefined;h.controller.openMenu();assert.equal(h.menuButton('copy').disabled,true);
  h.document.emit('pointerdown',{target:h.window});assert.equal(h.controller.menu.hidden,true);
  h.controller.destroy();
});

test('abort and destroy release capture, clear scheduled work, remove listeners and restore styles',()=>{
  const abort=new AbortController(),h=navigationHarness(range,{signal:abort.signal});
  h.fire('pointerdown');h.pointer('pointermove',{clientX:700});assert.equal(h.frames.size,1);
  abort.abort();h.flush();assert.equal(h.changes.length,0);assert.equal(h.frames.size,0);assert.equal(h.element.hasPointerCapture(1),false);
  assert.equal(h.element.style.touchAction,'original');assert.equal(h.controller.toolbar.parentElement,null);assert.equal(h.controller.menu.parentElement,null);
  assert.equal(h.window.listenerCount(),0);assert.equal(h.document.listenerCount(),0);assert.equal(h.element.listenerCount(),0);
  h.controller.destroy();assert.equal(h.fire('wheel',{deltaY:-100}).defaultPrevented,false);
});

test('Escape and window changes stop an in-progress gesture without leaving a stale click or menu',()=>{
  const h=navigationHarness();
  h.fire('pointerdown');h.pointer('pointermove',{clientX:650});assert.equal(h.document.activeElement,h.svg);
  assert.equal(h.fire('keydown',{key:'Escape'}).defaultPrevented,true);h.flush();assert.equal(h.changes.length,0);assert.equal(h.element.hasPointerCapture(1),false);
  assert.equal(h.fire('click').defaultPrevented,true);
  h.controller.openMenu();h.window.emit('resize');assert.equal(h.controller.menu.hidden,true);
  h.fire('pointerdown');h.pointer('pointermove',{clientX:650});h.window.emit('blur');h.flush();assert.equal(h.changes.length,0);assert.equal(h.element.dataset.dragging,undefined);
  h.controller.destroy();
});
