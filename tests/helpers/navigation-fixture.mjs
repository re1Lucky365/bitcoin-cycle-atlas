import { bindChartNavigation } from '../../dist/chart-navigation.js';
// Shared event boundary fixture; native browser gesture arbitration needs separate QA.
export class EventSurface {
  constructor(){this.listeners=new Map();}
  addEventListener(type,handler,options){const list=this.listeners.get(type)||[];list.push({handler,options});this.listeners.set(type,list);}
  removeEventListener(type,handler){this.listeners.set(type,(this.listeners.get(type)||[]).filter(item=>item.handler!==handler));}
  emit(type,values={}){
    const owner=this.ownerDocument?.defaultView||this,points=owner.pointerPositions??=new Map(),id=values.pointerId??1,ending=type==='pointerup'||type==='pointercancel';
    // An unspecified release keeps the last emitted coordinate, as intended by
    // these tests; explicit release coordinates still exercise the final delta.
    const event={type,target:this,button:0,buttons:ending?0:1,pointerId:1,pointerType:'mouse',isPrimary:true,clientX:500,clientY:200,deltaX:0,deltaY:0,deltaMode:0,detail:1,key:'',defaultPrevented:false,stopped:false,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},stopImmediatePropagation(){this.stopped=true;this.immediate=true;},...(ending?points.get(id):null),...values};
    if(type==='pointerdown'||type==='pointermove')points.set(id,{clientX:event.clientX,clientY:event.clientY,pointerType:event.pointerType,isPrimary:event.isPrimary});
    if(ending)points.delete(id);
    for(const {handler}of [...(this.listeners.get(type)||[])]){handler(event);if(event.immediate)break;}
    return event;
  }
  listenerCount(){return [...this.listeners.values()].reduce((sum,list)=>sum+list.length,0);}
}
export class TestElement extends EventSurface {
  constructor(tag,ownerDocument){super();this.tagName=tag.toUpperCase();this.ownerDocument=ownerDocument;this.children=[];this.dataset={};this.style={touchAction:'original'};this.attributes=new Map();this.hidden=false;this.disabled=false;this.parentElement=null;this.capture=new Set();this.clientWidth=1000;this.clientHeight=500;this.offsetWidth=220;this.offsetHeight=210;this.textContent='';}
  append(...children){for(const child of children){child.remove?.();child.parentElement=this;this.children.push(child);}}
  remove(){if(this.parentElement){this.parentElement.children=this.parentElement.children.filter(child=>child!==this);this.parentElement=null;}}
  setAttribute(key,value){this.attributes.set(key,String(value));}
  getAttribute(key){return this.attributes.get(key)??null;}removeAttribute(key){this.attributes.delete(key);}
  contains(target){return target===this||this.children.some(child=>child.contains?.(target));}
  matchesSelector(selector){
    const exclusions=[...selector.matchAll(/:not\(([^)]+)\)/g)].map(match=>match[1]);
    if(exclusions.length){
      const positive=selector.replace(/:not\([^)]+\)/g,'');
      return this.matchesSelector(positive)&&exclusions.every(excluded=>!this.matchesSelector(excluded));
    }
    if(selector.startsWith('.'))return this.getAttribute('class')?.split(/\s+/).includes(selector.slice(1))||false;
    if(selector.startsWith('#'))return this.getAttribute('id')===selector.slice(1);
    if(selector==='svg[data-plot-left]')return this.tagName==='SVG'&&this.dataset.plotLeft!==undefined;
    if(selector==='[hidden]')return this.hidden;
    if(selector.startsWith('[role='))return this.getAttribute('role')===selector.slice(6,-1);
    if(selector==='[contenteditable=true]')return this.getAttribute('contenteditable')==='true';
    if(selector==='[data-next-turn]')return this.dataset.nextTurn!==undefined;
    if(selector.startsWith('[data-')){const name=selector.slice(6,-1).replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase());return this.dataset[name]!==undefined;}
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
export function navigationHarness(initial,extra={}){
  const window=new EventSurface(),document=new EventSurface();document.defaultView=window;document.hidden=false;
  window.navigator={clipboard:{writeText:text=>{copies.push(text);return Promise.resolve();}}};
  let timerId=0;const timers=new Map();window.setTimeout=fn=>{timers.set(++timerId,fn);return timerId;};window.clearTimeout=id=>timers.delete(id);
  let nextFrame=0;const frames=new Map();window.requestAnimationFrame=fn=>{frames.set(++nextFrame,fn);return nextFrame;};window.cancelAnimationFrame=id=>frames.delete(id);
  document.createElement=tag=>new TestElement(tag,document);
  const element=document.createElement('div'),svg=document.createElement('svg');
  svg.dataset={plotLeft:'60',plotRight:'930',plotTop:'50',plotBottom:'440'};svg.viewBox={baseVal:{x:0,y:0,width:1000,height:500}};element.append(svg);document.activeElement=svg;
  let live={...initial},tool='crosshair',resets=0;const changes=[],copies=[],announcements=[];
  const controller=bindChartNavigation({element,getRange:()=>live,getTool:()=>tool,onRangeChange:value=>{live=value;changes.push(value);},onReset:()=>resets++,onAnnounce:value=>announcements.push(value),getContext:()=>({label:'2026-10-22 00:00 UTC · 실제 봉',copyText:'Coinbase BTC-USD\n2026-10-22 00:00 UTC\nC 100'}),...extra});
  return {window,document,element,svg,controller,changes,copies,announcements,get range(){return live;},set range(value){live=value;},set tool(value){tool=value;},get resets(){return resets;},frames,timers,expire(){for(const [id,fn]of [...timers]){timers.delete(id);fn();}},flush(){for(const [id,fn]of [...frames]){frames.delete(id);fn();}},fire(type,props={}){return element.emit(type,{target:svg,...props});},pointer(type,props={}){return window.emit(type,{target:svg,...props});},menuButton(action){return controller.menu.children.find(child=>child.dataset?.chartContext===action);}};
}
