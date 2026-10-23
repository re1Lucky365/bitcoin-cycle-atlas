import assert from 'node:assert/strict';
import test from 'node:test';
import { mountChartBottomBar,chartBottomBarFor } from '../dist/chart-bottom-bar.js';
import { mountHistoryJournal } from '../dist/history-journal.js';

// The real disclosure/controller boundary, including focus and delegated event
// commands. This fixture intentionally does not claim browser CSS geometry.
class Surface {
  listeners=new Map();
  addEventListener(type,handler){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(handler);}
  removeEventListener(type,handler){this.listeners.get(type)?.delete(handler);}
  dispatchEvent(event){event.target??=this;this[`on${event.type}`]?.(event);for(const handler of this.listeners.get(event.type)||[])handler(event);return !event.defaultPrevented;}
}
const dataKey=name=>name.slice(5).replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase());
class Element extends Surface {
  constructor(tag,doc){super();this.tagName=tag;this.ownerDocument=doc;this.children=[];this.attributes=new Map();this.dataset={};this.style={};this.className='';this._text='';this._html='';this._hidden=false;this.classList={add:name=>{if(!this.className.split(' ').includes(name))this.className=`${this.className} ${name}`.trim();},remove:name=>{this.className=this.className.split(' ').filter(value=>value!==name).join(' ');}};}
  append(...nodes){for(const node of nodes){node.remove();node.parentElement=this;this.children.push(node);}}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(node=>node!==this);this.parentElement=null;}
  contains(node){return this===node||this.children.some(child=>child.contains(node));}
  setAttribute(name,value){this.attributes.set(name,String(value));if(name==='id')this.id=String(value);if(name==='class')this.className=String(value);if(name.startsWith('data-'))this.dataset[dataKey(name)]=String(value);}
  getAttribute(name){return name==='id'?this.id??null:name==='class'?this.className:this.attributes.get(name)??null;}
  get hidden(){return this._hidden;}
  set hidden(value){this._hidden=Boolean(value);if(value&&this.contains(this.ownerDocument.activeElement))this.ownerDocument.activeElement=this.ownerDocument.body;}
  get textContent(){return this._text+this.children.map(child=>child.textContent).join('');}
  set textContent(value){for(const child of [...this.children])child.remove();this._text=String(value??'');this._html='';}
  get innerHTML(){return this._html;}
  set innerHTML(value){this.textContent='';this._html=String(value);for(const [,attributes,content]of this._html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)){const button=this.ownerDocument.createElement('button');for(const [,name,value]of attributes.matchAll(/([\w-]+)="([^"]*)"/g))button.setAttribute(name,value);button.textContent=content.replace(/<[^>]*>/g,'');this.append(button);}}
  matches(selector){
    if(selector.includes(','))return selector.split(',').some(value=>this.matches(value.trim()));
    if(selector==='[hidden]')return this.hidden;
    const tag=selector.match(/^[\w-]+/)?.[0];if(tag&&tag!==this.tagName)return false;
    const id=selector.match(/#([\w-]+)/)?.[1];if(id&&this.id!==id)return false;
    for(const [,name]of selector.matchAll(/\.([\w-]+)/g))if(!this.className.split(' ').includes(name))return false;
    for(const [,name,wanted]of selector.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)){const value=name.startsWith('data-')?this.dataset[dataKey(name)]:this.getAttribute(name);if(value==null||wanted!==undefined&&wanted!==value)return false;}
    return true;
  }
  closest(selector){return this.matches(selector)?this:this.parentElement?.closest(selector)||null;}
  querySelectorAll(selector){return this.children.flatMap(child=>[...(child.matches(selector)?[child]:[]),...child.querySelectorAll(selector)]);}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  getBoundingClientRect(){const {left=0,top=0,width=390,height=40}=this.rect||{};return {left,top,width,height,right:left+width,bottom:top+height};}
  get offsetHeight(){return this.hidden?0:this.rect?.height||260;}
  focus(){if(this.disabled||this.closest('[hidden]'))return;this.ownerDocument.activeElement=this;this.ownerDocument.dispatchEvent({type:'focusin',target:this});}
  dispatchEvent(event){super.dispatchEvent(event);if(event.bubbles&&!event.stopped){if(this.parentElement)this.parentElement.dispatchEvent(event);else if(this===this.ownerDocument.body)this.ownerDocument.dispatchEvent(event);}return !event.defaultPrevented;}
  click(){if(!this.disabled)this.dispatchEvent(event('click',this,{bubbles:true}));}
}
function event(type,target,extra={}){return {type,target,...extra,defaultPrevented:false,stopped:false,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;}};}
function fixture(t,{width=390}={}){
  const doc=new Surface(),win=new Surface();doc.defaultView=win;win.innerWidth=width;win.innerHeight=800;win.CustomEvent=class{constructor(type,{detail}){this.type=type;this.detail=detail;}};
  doc.createElement=tag=>new Element(tag,doc);doc.body=doc.createElement('body');doc.activeElement=doc.body;doc.getElementById=id=>doc.body.querySelector(`#${id}`);
  const add=(parent,tag,id,className='')=>{const node=doc.createElement(tag);node.id=id;node.className=className;parent.append(node);return node;};
  const stage=add(doc.body,'section','stage'),plot=add(stage,'div','plot'),svg=add(plot,'svg','price');svg.setAttribute('viewBox','0 0 390 693');svg.innerHTML='<path class="actual-price" d="M10 400L60 300"/>';plot.rect={left:0,top:40,width,height:693};
  const store=add(doc.body,'div','store'),ranges=add(store,'div','ranges','workbench-ranges'),commands=[],readers=[];
  for(const [value,label]of [['focus','4년'],['near','6개월'],['all','장기 전망'],['history','전체']]){const node=add(ranges,'button',`span-${value}`);node.dataset.chartSpan=value;node.textContent=label;node.onclick=()=>commands.push(['span',value]);}
  const date=add(ranges,'button','workbench-go-date');date.onclick=()=>commands.push(['go-to']);
  const rangeLabel=add(store,'span','workbench-range-label');rangeLabel.textContent='2024.01.01 — 2028.01.01';rangeLabel.title='표시 기간 · 2024.01.01 — 2028.01.01 UTC';
  const axis=add(store,'div','axis','workbench-axis'),scale=add(axis,'button','workbench-scale'),auto=add(axis,'button','workbench-auto-scale'),fit=add(axis,'button','workbench-fit');scale.onclick=()=>commands.push(['scale']);auto.onclick=()=>commands.push(['auto-scale']);fit.onclick=()=>commands.push(['fit']);
  const status=add(store,'div','status','workbench-status'),update=add(status,'button','atlas-update-status');update.textContent='10.23 12:00';update.title='Coin Metrics · 저장본 사용';
  const reader=add(doc.body,'div','reader'),readerTarget=add(reader,'button','reader-target');
  const openReader=(kind,options)=>{readers.push({kind,...options});readerTarget.focus();doc.dispatchEvent({type:'atlas:panel-state',detail:{open:true,kind}});};
  const bar=mountChartBottomBar({stage,ranges,dateButton:date,rangeLabel,axis,status,fitButton:fit,updateButton:update,onCommand:(...args)=>commands.push(args),onUpdate:opener=>openReader('update',{focus:true,opener})});bar.element.rect={left:0,top:733,width,height:44};
  const events=[{id:'early',date:'2010-07-17',category:'market',label:'첫 거래소'},{id:'middle',date:'2024-04-20',category:'protocol',label:'반감기'},{id:'latest',date:'2026-03-01',category:'market',label:'자료 사건'},{id:'future',date:'2028-01-01',category:'market',label:'미래의 기록'}];
  const jumps=[],journal=mountHistoryJournal({stage,bottomBar:bar,events,categories:{market:'시장',protocol:'프로토콜'},colors:{market:'#f8b46d',protocol:'#78c4ed'},onEvent:id=>jumps.push(id),openReader});
  const state={mode:'price',frequency:'daily',intraday:false,window:'focus',start:'2024-01-01',end:'2027-01-01',asOf:'2026-10-23',navigationAvailable:true};
  const publish=detail=>{Object.assign(state,detail);bar.update(state);journal.update(state);};publish({});
  t.after(()=>{journal.destroy();bar.destroy();});
  return {doc,win,stage,plot,svg,ranges,date,rangeLabel,axis,scale,auto,fit,status,update,bar,journal,commands,readers,jumps,publish,node:id=>doc.getElementById(id)};
}

test('one footer owns the original navigation controls and compact period selection dispatches the same command',t=>{
  const f=fixture(t),select=f.node('workbench-range-select');
  assert.equal(chartBottomBarFor(f.stage),f.bar);assert.equal(f.stage.querySelectorAll('footer').length,1);
  for(const original of [f.ranges,f.date,f.axis,f.status])assert.ok(f.bar.element.contains(original),'existing control identity is preserved');
  assert.equal(f.ranges.contains(f.date),false,'calendar remains outside the daily-only range group');
  assert.equal(select.value,'focus');select.value='near';select.onchange();f.node('span-history').click();f.date.click();f.scale.click();f.auto.click();f.fit.click();
  assert.deepEqual(f.commands,[['span','near'],['span','history'],['go-to'],['scale'],['auto-scale'],['fit']]);
  select.value='not-a-period';select.onchange();assert.equal(f.commands.length,6);
  f.publish({customRange:true});assert.equal(select.value,'');
  f.publish({frequency:'1h',intraday:true});assert.equal(select.parentElement.hidden,true);assert.equal(f.date.closest('[hidden]'),null,'date navigation remains available in intraday');
});

test('more exposes current range, UTC, update and reset while restoring focus to its visible opener',t=>{
  const f=fixture(t,{width:320}),more=f.node('workbench-bottom-more'),menu=f.node('workbench-bottom-menu');
  f.update.textContent='10.23 15:46';f.update.title='최근 완료 봉 확인';f.rangeLabel.title='표시 기간 · 1900.01.01 — 1901.01.01 UTC';
  more.click();assert.equal(menu.hidden,false);assert.equal(more.getAttribute('aria-expanded'),'true');
  assert.match(menu.textContent,/1900\.01\.01/);assert.match(menu.textContent,/UTC/);assert.match(f.node('workbench-bottom-update').textContent,/15:46/);assert.equal(f.node('workbench-bottom-update').title,'최근 완료 봉 확인');
  assert.ok(parseFloat(menu.style.left)>=8);assert.ok(parseFloat(menu.style.left)+parseFloat(menu.style.width)<=312,'menu is bounded to the 320px viewport');
  f.node('workbench-bottom-reset').click();assert.equal(menu.hidden,true);assert.equal(f.doc.activeElement,more);assert.deepEqual(f.commands,[['fit']]);
  more.click();f.node('workbench-bottom-update').click();assert.equal(f.readers.at(-1).kind,'update');assert.equal(f.readers.at(-1).opener,more);assert.equal(menu.hidden,true);assert.equal(f.doc.activeElement,f.node('reader-target'));
});

test('major-event disclosure filters the real range and as-of without replacing or resizing chart nodes',t=>{
  const f=fixture(t),toggle=f.node('history-journal-toggle'),before={markup:f.svg.innerHTML,viewBox:f.svg.getAttribute('viewBox'),plotRect:f.plot.getBoundingClientRect(),style:{...f.plot.style}};
  assert.equal(f.journal.element.hidden,true);assert.equal(toggle.querySelector('.journal-count').textContent,'3');
  toggle.click();assert.equal(f.journal.element.hidden,false);assert.equal(toggle.getAttribute('aria-expanded'),'true');
  const items=f.node('history-journal-items');assert.deepEqual(items.querySelectorAll('[data-history-jump]').map(node=>node.dataset.historyJump),['middle','latest']);
  assert.equal(f.doc.activeElement,items.querySelector('button'));assert.equal(f.svg.parentElement,f.plot);
  assert.deepEqual({markup:f.svg.innerHTML,viewBox:f.svg.getAttribute('viewBox'),plotRect:f.plot.getBoundingClientRect(),style:{...f.plot.style}},before,'opening changes only the disclosure, not chart geometry or data');
  f.publish({historicalLabelMeta:{total:2,labels:1,hidden:1}});assert.match(f.node('journal-context').textContent,/차트 사건 2개 · 이름 1개/);
  assert.equal(f.doc.activeElement,items.querySelector('button'),'unrelated state updates do not replace a focused event');
  items.querySelector('[data-history-jump="middle"]').click();assert.deepEqual(f.jumps,['middle']);assert.equal(f.journal.element.hidden,true);assert.equal(f.doc.activeElement,toggle);
  f.publish({start:'1900-01-01',end:'1901-01-01'});toggle.click();assert.match(items.textContent||items.innerHTML,/기록된 사건이 없습니다/);assert.equal(f.doc.activeElement,f.node('history-journal-all'));
});

test('event list and volume provenance remain available in intraday or with chart events hidden',t=>{
  const f=fixture(t),toggle=f.node('history-journal-toggle'),more=f.node('workbench-bottom-more');
  f.publish({intraday:true,frequency:'1h',start:1767225600,end:1767312000,historicalEventsVisible:false});toggle.click();
  assert.match(f.node('journal-context').textContent,/하루 단위/);assert.deepEqual(f.node('history-journal-items').querySelectorAll('[data-history-jump]').map(node=>node.dataset.historyJump),['early','middle','latest']);
  f.node('history-journal-all').click();assert.equal(f.readers.at(-1).kind,'events');assert.equal(f.readers.at(-1).opener,toggle);assert.equal(f.journal.element.hidden,true);
  toggle.click();f.node('history-volume-source').click();assert.equal(f.readers.at(-1).kind,'volume');assert.equal(f.readers.at(-1).opener,toggle);
  for(const [id,kind]of [['workbench-bottom-events','events'],['workbench-bottom-volume','volume']]){more.click();f.node(id).click();assert.equal(f.readers.at(-1).kind,kind);assert.equal(f.readers.at(-1).opener,more);assert.equal(f.node('workbench-bottom-menu').hidden,true);}
  f.publish({intraday:false,frequency:'daily',start:'2024-01-01',end:'2027-01-01'});assert.match(f.node('journal-context').textContent,/표시 꺼짐/);assert.deepEqual(f.commands,[],'browsing provenance never toggles chart layers');
});

test('disclosures dismiss each other, support keyboard return and release on mode changes',t=>{
  const f=fixture(t),toggle=f.node('history-journal-toggle'),more=f.node('workbench-bottom-more'),menu=f.node('workbench-bottom-menu');
  toggle.click();more.click();assert.equal(f.journal.element.hidden,true);assert.equal(menu.hidden,false);
  const down=event('keydown',f.doc.activeElement,{key:'ArrowDown',bubbles:true});f.doc.activeElement.dispatchEvent(down);assert.equal(down.defaultPrevented,true);assert.equal(down.stopped,true);assert.equal(f.doc.activeElement,f.node('workbench-bottom-volume'));
  const esc=event('keydown',f.doc.activeElement,{key:'Escape',bubbles:true});f.doc.activeElement.dispatchEvent(esc);assert.equal(menu.hidden,true);assert.equal(f.doc.activeElement,more);
  more.click();toggle.click();assert.equal(menu.hidden,true);assert.equal(f.journal.element.hidden,false);
  f.doc.activeElement.dispatchEvent(event('keydown',f.doc.activeElement,{key:'Escape',bubbles:true}));assert.equal(f.journal.element.hidden,true);assert.equal(f.doc.activeElement,toggle);
  toggle.click();f.doc.dispatchEvent({type:'atlas:modal-open',detail:{id:'chart-go-to-dialog'}});assert.equal(f.journal.element.hidden,true);
  more.click();f.doc.dispatchEvent({type:'pointerdown',target:f.plot});assert.equal(menu.hidden,true);
  toggle.click();f.publish({mode:'cycles'});assert.equal(toggle.hidden,true);assert.equal(f.journal.element.hidden,true);assert.equal(f.node('workbench-bottom-reset').hidden,true);
});

test('footer input cannot bubble into plot navigation and teardown removes both popovers and listeners',t=>{
  const f=fixture(t),events=[];for(const type of ['wheel','pointerdown','dblclick'])f.stage.addEventListener(type,()=>events.push(type));
  for(const type of ['wheel','pointerdown','dblclick'])f.scale.dispatchEvent(event(type,f.scale,{bubbles:true}));assert.deepEqual(events,[]);
  f.node('workbench-bottom-more').click();f.win.dispatchEvent({type:'resize'});assert.equal(f.node('workbench-bottom-menu').hidden,true);
  f.journal.destroy();f.bar.destroy();assert.equal(f.stage.querySelector('footer'),null);assert.equal(f.node('history-journal'),null);assert.equal(f.node('workbench-bottom-menu'),null);assert.equal(chartBottomBarFor(f.stage),null);
  for(const type of ['pointerdown','focusin','atlas:modal-open','atlas:panel-state'])assert.equal(f.doc.listeners.get(type)?.size||0,0,type);
  assert.equal(f.win.listeners.get('resize')?.size||0,0);assert.equal(f.svg.parentElement,f.plot);
});
