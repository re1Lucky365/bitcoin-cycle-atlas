import { bindChartNavigation } from '../../dist/chart-navigation.js';
import { mountChartTouchTracking } from '../../dist/chart-touch-tracking.js';
import { EventSurface, TestElement } from './navigation-fixture.mjs';

// Exercises the two real controllers in their production registration order.
// Event phases, capture ownership, RAF redraw and timers are deterministic;
// this is not a browser's native touch/scroll arbitration or a device test.
export function mobileGestureHarness({ range, tool = 'crosshair', width = 1000, height = 500 } = {}) {
  const window = new EventSurface(), document = new EventSurface();
  document.defaultView = window; document.hidden = false;
  class Element extends TestElement {
    matchesSelector(selector) { return super.matchesSelector(selector.replace(/\[role=(["'])(.*?)\1\]/gu, '[role=$2]')); }
    getBoundingClientRect() { return {left:0,top:0,width,height,right:width,bottom:height}; }
    setPointerCapture(id) { captures.set(id,this); this.capture.add(id); }
    releasePointerCapture(id) {
      if (captures.get(id)!==this) return;
      captures.delete(id); this.capture.delete(id);
      dispatch('lostpointercapture',{pointerId:id,pointerType:contacts.get(id)?.pointerType||'touch',target:this});
    }
  }
  document.createElement = tag => new Element(tag,document);
  const element=document.createElement('div'),svg=document.createElement('svg');
  element.append(svg); document.activeElement=svg;
  svg.viewBox={baseVal:{x:0,y:0,width:1000,height:500}};
  svg.dataset={plotLeft:'60',plotRight:'930',plotTop:'50',plotBottom:'440',priceBottom:'400',timeAxisTop:'450'};
  const captures=new Map(),contacts=new Map(),frames=new Map(),timers=new Map();
  let clock=1000,serial=0,frameId=0,live={...range},currentTool=tool,nav,priceTarget,redrawPending=false,redraws=0,selections=0,clears=0;
  let axis={min:100,max:200,scale:'linear',inverted:false,top:50,bottom:400,left:60,right:930,mode:'auto'};
  const originalNow=Date.now; Date.now=()=>clock;
  const changes=[],priceChanges=[],previews=[],trackingChanges=[],transactions=[];
  window.setTimeout=(fn,delay=0)=>{const id=++serial;timers.set(id,{fn,at:clock+delay});return id;};
  window.clearTimeout=id=>timers.delete(id);
  window.requestAnimationFrame=fn=>{const id=++frameId;frames.set(id,fn);return id;};
  window.cancelAnimationFrame=id=>frames.delete(id);
  window.navigator={clipboard:{writeText:()=>Promise.resolve()}};
  const insidePrice=point=>point.clientX/width*1000>=axis.left&&point.clientX/width*1000<=axis.right&&point.clientY/height*500>=axis.top&&point.clientY/height*500<=axis.bottom;
  const tracking=mountChartTouchTracking({element,timers:window,getTool:()=>currentTool,canStart:insidePrice,
    preview:point=>previews.push({...point}),clear:()=>clears++,cancelNavigation:()=>nav.cancelGesture(),resumeNavigation:points=>nav.resumeTouchGesture(points),onChange:value=>trackingChanges.push(value)});
  const schedule=()=>{if(redrawPending)return;redrawPending=true;window.requestAnimationFrame(()=>{redrawPending=false;redraw();});};
  nav=bindChartNavigation({element,getRange:()=>live,getTool:()=>currentTool,getPriceAxis:()=>axis,
    onRangeChange:value=>{live={...value};changes.push({...value});schedule();},
    onPriceRangeChange:domain=>{axis={...axis,...domain,mode:'manual'};priceChanges.push({...domain});schedule();},
    onReset:()=>{},onPriceReset:()=>{},onMenuOpen:()=>tracking.cancel(),
    onGestureStart:label=>{tracking.cancelPending();transactions.push(['start',label]);},onGestureEnd:()=>transactions.push(['end'])});
  function redraw() {
    // Renderers replace SVG children and return fresh scale objects after every
    // state/network draw; the plot capture owner and SVG element stay mounted.
    priceTarget?.remove();priceTarget=document.createElement('path');svg.append(priceTarget);
    live={...live};axis={...axis};redraws++;nav.update();
  }
  redraw();
  svg.onclick=()=>{if(currentTool==='crosshair')selections++;};
  function dispatch(type, values={}) {
    const pointerId=values.pointerId??1,previous=contacts.get(pointerId);
    const event={type,pointerId,pointerType:previous?.pointerType||'touch',isPrimary:previous?.isPrimary??contacts.size===0,
      clientX:previous?.clientX??500,clientY:previous?.clientY??200,button:0,buttons:['pointerup','pointercancel'].includes(type)?0:1,
      detail:1,target:priceTarget,key:'',defaultPrevented:false,stopped:false,immediate:false,
      preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},stopImmediatePropagation(){this.stopped=true;this.immediate=true;},...values};
    if (type==='pointerdown'||type==='pointermove') contacts.set(pointerId,{pointerType:event.pointerType,isPrimary:event.isPrimary,clientX:event.clientX,clientY:event.clientY});
    if (captures.has(pointerId)&&type.startsWith('pointer')) event.target=captures.get(pointerId);
    const path=[];for(let node=event.target;node;node=node.parentElement)path.push(node);
    if(event.target!==window&&!path.includes(document))path.push(document);if(!path.includes(window))path.push(window);
    const invoke=(surface,capture)=>{
      event.currentTarget=surface;
      for(const {handler,options} of [...(surface.listeners?.get(type)||[])]){
        if(Boolean(options===true||options?.capture)!==capture)continue;
        handler(event);if(event.immediate)break;
      }
      if(!capture&&!event.immediate)surface[`on${type}`]?.(event);
    };
    for(const surface of [...path].reverse()){invoke(surface,true);if(event.stopped)break;}
    if(!event.stopped)for(const surface of path){invoke(surface,false);if(event.stopped)break;}
    if(type==='pointerup'||type==='pointercancel'){
      captures.get(pointerId)?.releasePointerCapture(pointerId);contacts.delete(pointerId);
    }
    return event;
  }
  function advance(ms) {
    const end=clock+ms;
    for(let steps=0;steps<100;steps++){
      const next=[...timers].filter(([,job])=>job.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];
      if(!next)break;clock=next[1].at;timers.delete(next[0]);next[1].fn();
    }
    clock=end;
  }
  function frame() {for(const [id,fn]of [...frames]){frames.delete(id);fn();}}
  function settle(){for(let count=0;frames.size&&count<20;count++)frame();if(frames.size)throw new Error('Unbounded gesture redraw');}
  return {element,svg,document,window,nav,tracking,dispatch,advance,frame,settle,redraw,captures,changes,priceChanges,previews,trackingChanges,transactions,
    get range(){return live;},get axis(){return axis;},get selections(){return selections;},get clears(){return clears;},get redraws(){return redraws;},get target(){return priceTarget;},
    setTool(value){tracking.cancel();nav.cancelGesture();currentTool=value;redraw();},
    setRange(value){tracking.cancel();nav.cancelGesture();live={...value};redraw();},
    destroy(){tracking.destroy();nav.destroy();Date.now=originalNow;},
  };
}
