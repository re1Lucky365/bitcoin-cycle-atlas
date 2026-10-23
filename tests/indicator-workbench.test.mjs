import assert from 'node:assert/strict';
import test from 'node:test';
import { mountIndicatorWorkbench } from '../dist/indicator-workbench.js';
import { readIndicatorState, changeIndicatorState, writeIndicatorState, applyIndicatorLayout, isIndicatorVisible } from '../dist/indicator-state.js';

// Exercise the shipped controller, reducer and shared-link boundary together.
// This fixture does not claim browser layout, SVG painting or native tab order.
class Surface {
  listeners=new Map();
  addEventListener(type,handler){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(handler);}
  removeEventListener(type,handler){this.listeners.get(type)?.delete(handler);}
  dispatchEvent(event){for(const handler of this.listeners.get(event.type)||[])handler(event);return true;}
}
class Element extends Surface {
  constructor(tag,doc){super();this.tagName=tag;this.ownerDocument=doc;this.children=[];this.dataset={};this.attributes=new Map();this._hidden=false;this._text='';this._html='';this.tabIndex=tag==='button'||tag==='input'||tag==='select'?0:-1;const styles=new Map();this.style={setProperty:(key,value)=>styles.set(key,value),getPropertyValue:key=>styles.get(key)||'',removeProperty:key=>styles.delete(key)};}
  get isConnected(){return this===this.ownerDocument.body||Boolean(this.parentElement?.isConnected);}
  get hidden(){return this._hidden;}
  set hidden(value){this._hidden=Boolean(value);if(value&&this.contains(this.ownerDocument.activeElement))this.ownerDocument.activeElement=this.ownerDocument.body;}
  get textContent(){return this._text+this.children.map(node=>node.textContent).join('');}
  set textContent(value){this.replaceChildren();this._text=String(value??'');this._html='';}
  get innerText(){return this.textContent;}
  get innerHTML(){return this._html;}
  set innerHTML(value){this.replaceChildren();this._html=String(value);this._text='';}
  append(...nodes){for(const node of nodes){node.remove();node.parentElement=this;this.children.push(node);}}
  replaceChildren(...nodes){for(const node of this.children)node.parentElement=null;this.children=[];this._text='';this._html='';this.append(...nodes);}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(node=>node!==this);this.parentElement=null;}
  contains(node){return node===this||this.children.some(child=>child.contains(node));}
  setAttribute(name,value){this.attributes.set(name,String(value));}
  getAttribute(name){if(name==='id')return this.id??null;if(name==='class')return this.className??null;return this.attributes.get(name)??null;}
  removeAttribute(name){this.attributes.delete(name);}
  matches(selector){
    if(selector.includes(','))return selector.split(',').some(part=>this.matches(part.trim()));
    let excluded=false;
    selector=selector.replace(/:not\(([^)]+)\)/g,(_,part)=>{if(this.matches(part))excluded=true;return '';});
    if(excluded)return false;
    if(selector===':disabled')return Boolean(this.disabled);
    const structural=selector.replace(/\[[^\]]+\]/g,'');
    const tag=structural.match(/^[\w-]+/)?.[0];if(tag&&tag!==this.tagName)return false;
    const id=structural.match(/#([\w-]+)/)?.[1];if(id&&this.id!==id)return false;
    for(const [,name]of structural.matchAll(/\.([\w-]+)/g))if(!(this.className||'').split(/\s+/).includes(name))return false;
    for(const [,name,wanted]of selector.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)){
      let value=name.startsWith('data-')?this.dataset[name.slice(5).replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase())]:name==='hidden'?this.hidden?true:undefined:name==='open'?this.open?true:undefined:this.getAttribute(name);
      if(value==null||wanted!==undefined&&String(value)!==wanted)return false;
    }
    return true;
  }
  closest(selector){return this.matches(selector)?this:this.parentElement?.closest(selector)||null;}
  querySelectorAll(selector){
    const found=[];for(const part of selector.split(',')){
      const pieces=part.trim().split(/\s+/),last=pieces.pop();
      const visit=node=>{for(const child of node.children){if(child.matches(last)){let parent=child.parentElement,matched=true;for(const previous of [...pieces].reverse()){while(parent&&!parent.matches(previous))parent=parent.parentElement;if(!parent){matched=false;break;}parent=parent.parentElement;}if(matched&&!found.includes(child))found.push(child);}visit(child);}};
      visit(this);
    }return found;
  }
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  getClientRects(){return this.isConnected&&!this.closest('[hidden]')?[{}]:[];}
  getBoundingClientRect(){const {left=0,top=0,width=800,height=600}=(typeof this.rect==='function'?this.rect():this.rect)||{};return {left,right:left+width,top,bottom:top+height,width,height};}
  focus(){if(this.getClientRects().length&&!this.disabled)this.ownerDocument.activeElement=this;}
  click(){if(!this.disabled)this.onclick?.({target:this});}
  showModal(){this.open=true;}
  close(){this.open=false;this.dispatchEvent({type:'close'});}
  scrollIntoView(){}
}
const cleanups=new WeakMap();
function fixture(t,{mobile=false,search='',viewport=null}={}){
  const original=new Map(['location','matchMedia','ResizeObserver','requestAnimationFrame','cancelAnimationFrame'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  const frames=new Map(),observers=[];let frame=0;
  Object.assign(globalThis,{location:{search},matchMedia:()=>({matches:mobile}),ResizeObserver:class{constructor(callback){this.callback=callback;this.targets=new Set();observers.push(this);}observe(node){this.targets.add(node);}disconnect(){this.targets.clear();}},requestAnimationFrame:callback=>{frames.set(++frame,callback);return frame;},cancelAnimationFrame:id=>frames.delete(id)});
  const doc=new Surface(),win=new Surface(),stored=new Map();doc.defaultView=win;win.visualViewport=viewport;win.matchMedia=globalThis.matchMedia;win.localStorage={getItem:key=>stored.get(key)||null,setItem:(key,value)=>stored.set(key,value)};
  doc.createElement=tag=>new Element(tag,doc);doc.createTextNode=text=>{const node=doc.createElement('#text');node.textContent=text;return node;};
  doc.body=doc.createElement('body');doc.activeElement=doc.body;doc.querySelector=selector=>doc.body.querySelector(selector);doc.querySelectorAll=selector=>doc.body.querySelectorAll(selector);doc.getElementById=id=>doc.querySelector(`#${id}`);
  const add=(parent,tag,id,className='')=>{const node=doc.createElement(tag);node.id=id;node.className=className;parent.append(node);return node;};
  const opener=add(doc.body,'button','atlas-mode-menu'),stage=add(doc.body,'section','stage'),plot=add(stage,'div','plot');
  const price=add(plot,'svg','lab-chart');price.innerHTML='<path d="M10 20L30 40"/>';
  add(plot,'div','lab-metrics');add(plot,'div','source','workbench-market-info');add(plot,'div','foot','lab-chart-foot');
  let state=readIndicatorState(search),query=search;
  const publish=()=>doc.dispatchEvent({type:'atlas:indicator-state',detail:{indicators:state}});
  const command=detail=>doc.dispatchEvent(new CustomEvent('atlas:indicator-command',{detail}));
  doc.addEventListener('atlas:indicator-command',event=>{state=applyIndicatorLayout(changeIndicatorState(state,event.detail));query=writeIndicatorState(new URLSearchParams(query),state).toString();publish();});
  const controller=mountIndicatorWorkbench({plot,stage});
  if(!cleanups.has(t)){const items=[];cleanups.set(t,items);t.after(()=>{for(const cleanup of items.reverse())cleanup();});}
  cleanups.get(t).push(()=>{controller.destroy();for(const [key,descriptor]of original)descriptor?Object.defineProperty(globalThis,key,descriptor):delete globalThis[key];});
  return {doc,controller,opener,price,command,publish,get state(){return state;},get query(){return query;},get pendingFrames(){return frames.size;},node:id=>doc.getElementById(id),resize(entries){for(const observer of observers){const observed=entries.filter(entry=>observer.targets.has(entry.target)).map(({target,width,height,borderBoxSize})=>({target,contentRect:{width,height},...(borderBoxSize?{borderBoxSize}:{})}));if(observed.length)observer.callback(observed);}},flush(){const callbacks=[...frames.values()];frames.clear();for(const callback of callbacks)callback();}};
}

test('the real legend button folds every study row, including a single volume row, while retaining price layers',t=>{
  const f=fixture(t,{search:'indicators=readout,source,legend,volume'}),fold=f.node('indicator-legend-toggle'),list=f.node('chart-indicator-list'),manager=f.node('chart-indicator-manager');
  const before=structuredClone(f.state),path=f.price.innerHTML;
  assert.equal(list.hidden,false);assert.equal(fold.hidden,false);
  fold.focus();fold.click();
  assert.equal(f.state.collapsed,true);assert.equal(list.hidden,true);assert.equal(manager.hidden,false);assert.ok(fold.getClientRects().length);
  assert.equal(fold.getAttribute('aria-expanded'),'false');assert.match(fold.title,/1개/);assert.equal(fold.textContent,'','the control is an arrow, not a second indicator strip');
  assert.deepEqual(f.state.added,before.added);assert.deepEqual(f.state.hidden,before.hidden);assert.equal(isIndicatorVisible(f.state,'volume'),true);assert.equal(f.price.innerHTML,path);
  assert.equal(f.doc.activeElement,fold);assert.equal(f.node('lab-metrics').hidden,false);
  assert.ok(list.querySelectorAll('[data-indicator-row]').every(row=>row.getClientRects().length===0));
  fold.click();assert.equal(list.hidden,false);assert.equal(fold.getAttribute('aria-expanded'),'true');assert.equal(f.doc.activeElement,fold);
});

test('mobile names and values remain folded for fresh, shared-open, reset and template states',t=>{
  const fresh=fixture(t,{mobile:true,search:'indicator-list=open'});
  assert.equal(fresh.node('chart-indicator-list').hidden,true);assert.equal(fresh.node('chart-indicator-manager').hidden,false);
  assert.equal(fresh.node('indicator-legend-toggle').disabled,true);
  assert.equal(fresh.node('indicator-list-visibility').disabled,true);
  fresh.node('indicator-legend-toggle').click();
  assert.equal(fresh.state.collapsed,true);
  for(const detail of [{action:'reset'},{action:'replace',state:{...fresh.state,collapsed:false}},{action:'collapse'}]){
    fresh.command(detail);assert.equal(fresh.state.collapsed,true);assert.equal(fresh.node('chart-indicator-list').hidden,true);
  }
  fresh.controller.open(fresh.opener);assert.equal(fresh.node('indicator-library').open,true,'library remains accessible');
});

test('desktop fold survives a shared link and does not retain a legacy primary row on mobile',t=>{
  const desktop=fixture(t,{search:'indicators=volume,cycle-timing&indicator-primary=cycle-timing'});
  desktop.node('indicator-legend-toggle').click();
  const mobile=fixture(t,{mobile:true,search:desktop.query}),list=mobile.node('chart-indicator-list');
  assert.equal(mobile.state.primary,'cycle-timing','old schema remains readable');assert.equal(list.hidden,true);
  assert.ok(list.children.every(row=>row.getClientRects().length===0));assert.ok(mobile.node('indicator-legend-toggle').getClientRects().length);
});

test('library checkbox and chart arrow control one fold state without hiding the recovery button',t=>{
  const f=fixture(t),fold=f.node('indicator-legend-toggle'),option=f.node('indicator-list-visibility');
  option.checked=false;option.onchange();
  assert.equal(f.state.collapsed,true);assert.equal(f.node('chart-indicator-list').hidden,true);assert.equal(f.node('chart-indicator-manager').hidden,false);
  fold.click();assert.equal(option.checked,true);assert.equal(f.state.collapsed,false);
  option.checked=false;option.onchange();assert.equal(new URLSearchParams(f.query).get('indicator-list'),'closed');
});

test('library bulk visibility targets studies and preserves separate OHLC and provenance choices',t=>{
  const f=fixture(t,{search:'indicator-hide=readout'}),all=f.node('indicator-visibility-all');
  all.click();
  assert.equal(isIndicatorVisible(f.state,'volume'),false);assert.equal(isIndicatorVisible(f.state,'cycle-timing'),false);
  assert.equal(isIndicatorVisible(f.state,'readout'),false);assert.equal(isIndicatorVisible(f.state,'source'),true);assert.equal(isIndicatorVisible(f.state,'legend'),true);
  assert.equal(f.state.collapsed,false);assert.match(all.textContent,/일괄 표시/);
  all.click();assert.equal(isIndicatorVisible(f.state,'volume'),true);assert.equal(isIndicatorVisible(f.state,'readout'),false);
});

test('folding with focus in a study row returns focus to the visible arrow and deleting the last study returns to the library opener',t=>{
  const f=fixture(t,{search:'indicators=volume'}),eye=f.node('chart-indicator-list').querySelector('[data-indicator-action="visibility"]');
  eye.focus();f.command({action:'collapse'});
  assert.equal(f.doc.activeElement,f.node('indicator-legend-toggle'));
  f.command({action:'remove',id:'volume'});
  assert.equal(f.node('chart-indicator-manager').hidden,true);assert.equal(f.doc.activeElement,f.opener);
});

test('folded rows keep the current selected value and reveal it immediately on expansion',t=>{
  const f=fixture(t,{search:'indicators=volume&indicator-list=closed'});
  f.doc.dispatchEvent({type:'atlas:readout',detail:{date:'2026-10-21',price:84000,volume:1234,volumeSource:'Bitstamp',frequency:'daily',kind:'observed'}});f.flush();
  f.node('indicator-legend-toggle').click();
  assert.equal(f.node('chart-indicator-list').hidden,false);
  assert.match(f.node('chart-indicator-list').querySelector('.indicator-value').textContent,/1\.23k BTC/);
  assert.match(f.node('indicator-readout-date').textContent,/2026\.10\.21/);
});

test('real settings hide only values, retain fresh hidden values and restore focus to the rebuilt row',t=>{
  const f=fixture(t,{search:'indicators=volume'}),path=f.price.innerHTML;
  const row=()=>f.node('chart-indicator-list').querySelector('[data-indicator-row="volume"]');
  const gear=row().querySelector('[data-indicator-action="settings"]');gear.focus();gear.click();
  const dialog=f.node('indicator-settings');assert.equal(dialog.open,true);
  const values=dialog.querySelector('[data-setting="values"]');values.checked=false;values.onchange();
  assert.equal(f.state.settings.volume.values,false);assert.equal(isIndicatorVisible(f.state,'volume'),true);assert.deepEqual(f.state.hidden,[]);
  f.doc.dispatchEvent({type:'atlas:readout',detail:{date:'2026-10-22',price:84000,volume:4321,volumeSource:'Bitstamp',frequency:'daily',kind:'observed'}});f.flush();
  assert.equal(row().querySelector('.indicator-value').hidden,true);assert.match(row().querySelector('.indicator-value').textContent,/4\.32k BTC/);assert.equal(f.price.innerHTML,path);
  values.checked=true;values.onchange();assert.equal(row().querySelector('.indicator-value').hidden,false);assert.match(row().querySelector('.indicator-value').textContent,/4\.32k BTC/);
  dialog.close();assert.equal(f.doc.activeElement,row().querySelector('[data-indicator-action="settings"]'),'settings updates rebuild the list without losing the return control');
});

test('setting interval conditions keep eye visibility and unsupported controls out of the editor',t=>{
  const f=fixture(t,{search:'indicators=volume,range,cycles,periods'});
  const open=id=>f.doc.dispatchEvent({type:'atlas:indicator-settings-open',detail:{id}});
  open('range');const dialog=f.node('indicator-settings');
  assert.equal(dialog.querySelector('[data-setting="lineWidth"]'),null);assert.equal(dialog.querySelector('[data-setting="axisLabels"]'),null);assert.ok(dialog.querySelector('[data-setting="fillOpacity"]'));assert.equal(dialog.querySelector('[data-setting="interval.1m"]'),null);
  const daily=dialog.querySelector('[data-setting="interval.daily"]');daily.checked=false;daily.onchange();
  assert.equal(isIndicatorVisible(f.state,'range'),true);assert.equal(isIndicatorVisible(f.state,'range','daily'),false);assert.equal(isIndicatorVisible(f.state,'range','weekly'),true);
  f.doc.dispatchEvent({type:'atlas:workbench-state',detail:{frequency:'daily',intraday:false}});
  const row=f.node('chart-indicator-list').querySelector('[data-indicator-row="range"]');assert.equal(row.dataset.unavailable,'true');assert.equal(row.querySelector('[data-indicator-action="visibility"]').getAttribute('aria-pressed'),'true');
  dialog.close();open('cycles');assert.ok(dialog.querySelector('[data-setting="inputs.alignment"]'));assert.equal(dialog.querySelector('[data-setting="inputs.period"]'),null);
  const alignment=dialog.querySelector('[data-setting="inputs.alignment"]');alignment.value='halving';alignment.onchange();assert.equal(f.state.settings.cycles.inputs.alignment,'halving');
  dialog.close();open('periods');const metric=dialog.querySelector('[data-setting="inputs.metric"]');metric.value='realizedVolPct';metric.onchange();assert.equal(f.state.settings.periods.inputs.metric,'realizedVolPct');
  assert.equal(dialog.querySelector('[data-setting="lineWidth"]'),null);assert.ok(dialog.querySelector('[data-setting="fillOpacity"]'));
});

test('settings remain reachable through the library when mobile legend is fully folded, without fake display-control gears',t=>{
  const f=fixture(t,{mobile:true,search:'indicators=readout,source,legend,volume'});f.controller.open(f.opener);
  const library=f.node('indicator-library');assert.equal(f.node('chart-indicator-list').hidden,true);
  for(const id of ['readout','source','legend'])assert.equal(library.querySelector(`[data-library-indicator="${id}"] [data-library-action="settings"]`),null);
  const gear=library.querySelector('[data-library-indicator="volume"] [data-library-action="settings"]');gear.click();const dialog=f.node('indicator-settings');assert.equal(dialog.open,true);
  const width=dialog.querySelector('[data-setting="lineWidth"]');width.value='1.75';width.onchange();assert.equal(f.state.settings.volume.lineWidth,1.75);assert.equal(f.state.collapsed,true);
  dialog.close();assert.equal(f.doc.activeElement,library.querySelector('[data-library-indicator="volume"] [data-library-action="settings"]'));
  assert.deepEqual(readIndicatorState(f.query,{mobile:false}).settings,f.state.settings);
});

test('study folding leaves the legend anchored directly below readout/source without reviving a countdown HUD',t=>{
  const f=fixture(t,{search:'indicators=readout,source,legend,countdown,volume&indicator-list=closed'}),plot=f.node('plot'),readout=f.node('lab-metrics'),source=f.node('source'),manager=f.node('chart-indicator-manager'),list=f.node('chart-indicator-list'),legend=f.node('foot');
  f.doc.dispatchEvent({type:'atlas:workbench-state',detail:{intraday:false,countdown:{status:'upcoming',dday:'D-20',date:'2026-11-12',nextLabel:'하락',minimumRunDays:7}}});
  assert.equal(f.node('scenario-countdown'),null,'old saved links and state payloads cannot mount the removed card');
  assert.equal(isIndicatorVisible(f.state,'countdown'),false);
  const pixels=key=>Number.parseFloat(plot.style.getPropertyValue(key));let readoutHeight=36;
  plot.rect={left:20,top:30,width:390,height:600};
  readout.rect=()=>({left:30,top:38,width:300,height:readoutHeight});
  source.rect=()=>({left:30,top:30+pixels('--source-top'),width:300,height:20});
  // Model the narrow-layout contract, not CSS painting: the legend depends on
  // wrapped readout/provenance, with no removed-card gap or study-height input.
  legend.rect=()=>({left:90,top:30+pixels('--indicator-top'),width:250,height:66});
  manager.rect=()=>({left:30,top:legend.getBoundingClientRect().top+pixels('--chart-legend-height')+8,width:300,height:list.hidden?28:228});
  const notices=[];f.doc.addEventListener('atlas:hud-layout-change',()=>notices.push({manager:manager.getBoundingClientRect(),legend:legend.getBoundingClientRect()}));
  f.resize([{target:readout,width:300,height:36},{target:source,width:300,height:20},{target:manager,width:300,height:28},{target:legend,width:250,height:66}]);
  assert.equal(notices.length,0,'observer deliveries wait for the final layout frame');f.flush();
  assert.equal(notices.length,1);assert.equal(notices[0].legend.top,103);assert.equal(notices[0].manager.top,177);
  const path=f.price.innerHTML;
  f.node('indicator-legend-toggle').click();
  f.resize([{target:manager,width:300,height:228}]);f.flush();
  assert.equal(notices.length,2);assert.equal(notices[1].manager.height,228);
  assert.equal(notices[1].legend.top,103,'expanding studies cannot push the legend down');assert.equal(notices[1].manager.top,177);
  f.node('indicator-legend-toggle').click();f.resize([{target:manager,width:300,height:28}]);f.flush();
  assert.equal(notices.length,3);assert.equal(notices[2].legend.top,103,'folding studies cannot move the legend either');
  readoutHeight=48;f.resize([{target:readout,width:300,height:48}]);
  readoutHeight=52;f.resize([{target:readout,width:300,height:52}]);
  assert.equal(notices.length,3);f.flush();
  assert.equal(notices.length,4,'several wrapped readout deliveries publish one settled layout');
  assert.equal(notices[3].legend.top,119);assert.equal(notices[3].manager.top,193);
  assert.equal(f.node('scenario-countdown'),null);assert.equal(plot.style.getPropertyValue('--countdown-height'),'');
  assert.equal(f.price.innerHTML,path,'the HUD controller does not mutate the price geometry');
});

test('chart legend uses its border box, clears hidden height and restores without redundant layout feedback',t=>{
  const f=fixture(t,{search:'indicators=readout,source,legend,volume'}),plot=f.node('plot'),legend=f.node('foot');
  const path=f.price.innerHTML,writes=[],notices=[];
  const setProperty=plot.style.setProperty;
  plot.style.setProperty=(key,value)=>{if(key==='--chart-legend-height')writes.push(value);setProperty(key,value);};
  let width=430.2,height=66.4;
  legend.rect=()=>({left:20,top:50,width:legend.hidden?0:width,height:legend.hidden?0:height});
  const report=(contentWidth=width-18,contentHeight=height-12)=>f.resize([{target:legend,width:contentWidth,height:contentHeight,borderBoxSize:[{inlineSize:legend.hidden?0:width,blockSize:legend.hidden?0:height}]}]);
  f.doc.addEventListener('atlas:hud-layout-change',()=>notices.push(legend.hidden?null:legend.getBoundingClientRect()));

  report();
  assert.equal(plot.style.getPropertyValue('--chart-legend-height'),'67px','padding and borders belong to the placement obstacle');
  assert.equal(plot.style.getPropertyValue('--source-height'),'','the legend must not overwrite provenance height');
  assert.equal(notices.length,0);f.flush();assert.equal(notices.length,1);
  report(100,20);f.flush();
  assert.deepEqual(writes,['67px']);assert.equal(notices.length,1,'contentRect changes do not override an unchanged border box');
  width=450.2;report();f.flush();
  assert.equal(notices.length,2,'legend width belongs to the published HUD geometry even when height is unchanged');
  assert.deepEqual(writes,['67px']);

  f.command({action:'visibility',id:'legend'});assert.equal(legend.hidden,true);
  report(0,0);f.flush();
  assert.equal(plot.style.getPropertyValue('--chart-legend-height'),'0px');assert.equal(notices.length,3);assert.equal(notices.at(-1),null);
  report(0,0);f.flush();assert.deepEqual(writes,['67px','0px']);assert.equal(notices.length,3);
  f.command({action:'visibility',id:'legend'});assert.equal(legend.hidden,false);
  report();f.flush();
  assert.equal(plot.style.getPropertyValue('--chart-legend-height'),'67px');assert.equal(notices.length,4);
  f.publish();report();f.flush();f.flush();
  assert.deepEqual(writes,['67px','0px','67px']);assert.equal(notices.length,4);assert.equal(f.pendingFrames,0);
  assert.equal(f.price.innerHTML,path);
});

test('HUD notifications ignore same-size hover values and render feedback but include width-only changes',t=>{
  const f=fixture(t,{search:'indicators=volume'}),manager=f.node('chart-indicator-manager');let width=100,notices=0;
  manager.rect=()=>({left:10,top:80,width,height:53});
  const reportSize=()=>f.resize([{target:manager,width,height:53}]);
  f.doc.addEventListener('atlas:hud-layout-change',()=>{notices++;f.publish();reportSize();});
  reportSize();f.flush();f.flush();assert.equal(notices,1);
  for(const volume of [1000,1100]){
    f.doc.dispatchEvent({type:'atlas:readout',detail:{date:'2026-10-21',price:84000,volume,kind:'observed',frequency:'daily'}});f.flush();
    reportSize();f.flush();assert.equal(notices,1,'changed values with identical boxes must not redraw period placement');
  }
  width=140;reportSize();f.flush();f.flush();assert.equal(notices,2,'a wider legend needs new placement even at the same height');
  width=160;reportSize();width=140;reportSize();f.flush();
  assert.equal(notices,2,'a transient resize that returns to the published geometry is suppressed');
  assert.equal(f.pendingFrames,0,'a renderer publishing the same HUD state cannot create a layout loop');
});

test('mobile library follows the keyboard viewport without unfolding indicators and releases observers',t=>{
  const viewport=new Surface();Object.assign(viewport,{height:884,offsetTop:0});
  const f=fixture(t,{mobile:true,viewport}),dialog=f.node('indicator-library');f.controller.open(f.opener);
  assert.equal(dialog.style.getPropertyValue('--dialog-viewport-height'),'884px');assert.equal(dialog.getAttribute('data-short-viewport'),null);
  viewport.height=475;viewport.offsetTop=12;viewport.dispatchEvent({type:'resize'});
  assert.equal(dialog.style.getPropertyValue('--dialog-viewport-height'),'475px');assert.equal(dialog.style.getPropertyValue('--dialog-viewport-top'),'12px');assert.equal(dialog.getAttribute('data-short-viewport'),'');
  assert.equal(f.state.collapsed,true);assert.equal(f.node('chart-indicator-list').hidden,true);
  viewport.height=884;viewport.offsetTop=0;viewport.dispatchEvent({type:'scroll'});assert.equal(dialog.getAttribute('data-short-viewport'),null);
  f.controller.destroy();assert.equal(viewport.listeners.get('resize').size,0);assert.equal(viewport.listeners.get('scroll').size,0);assert.equal(dialog.style.getPropertyValue('--dialog-viewport-height'),'');assert.equal(dialog.getAttribute('data-short-viewport'),null);
});

test('destroy cancels a pending HUD layout notification',t=>{
  const f=fixture(t),manager=f.node('chart-indicator-manager');let notices=0;
  f.doc.addEventListener('atlas:hud-layout-change',()=>notices++);
  f.resize([{target:manager,width:300,height:200}]);assert.ok(f.pendingFrames);
  f.controller.destroy();f.flush();assert.equal(notices,0);assert.equal(f.pendingFrames,0);
});
