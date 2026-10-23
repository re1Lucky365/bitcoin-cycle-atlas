import test from 'node:test';
import assert from 'node:assert/strict';
import {mountChartExportWorkbench} from '../dist/chart-export-workbench.js';
import {mountResearchAnnotationsWorkbench} from '../dist/research-annotations-workbench.js';
import {normalizeResearchAnnotations,changeResearchAnnotations} from '../dist/research-annotations.js';

// DOM command/focus boundary only; actual responsive layout is checked in browser QA.
class Element {
  constructor(tag,doc){this.tagName=tag;this.ownerDocument=doc;this.children=[];this.values=new Map();this.listeners=new Map();this._text='';this.value='';this.style={setProperty(){}};}
  setAttribute(key,value){this.values.set(key,String(value));if(key==='value')this.value=String(value);}
  getAttribute(key){return this.values.get(key)??null;}
  removeAttribute(key){this.values.delete(key);}
  get id(){return this.getAttribute('id');}
  get isConnected(){return this===this.ownerDocument.body||Boolean(this.parentElement?.isConnected);}
  get textContent(){return this._text+this.children.map(child=>child.textContent).join('');}
  set textContent(value){this.replaceChildren();this._text=String(value);}
  append(...nodes){for(const node of nodes){node.remove();node.parentElement=this;this.children.push(node);}}
  replaceChildren(...nodes){for(const node of this.children)node.parentElement=null;this.children=[];this._text='';this.append(...nodes);}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(node=>node!==this);this.parentElement=null;}
  addEventListener(type,listener){if(!this.listeners.has(type))this.listeners.set(type,[]);this.listeners.get(type).push(listener);}
  dispatchEvent(event){for(const listener of this.listeners.get(event.type)||[])listener(event);}
  focus(){if(this.isConnected&&!this.disabled)this.ownerDocument.activeElement=this;}
  click(){if(!this.disabled)return this.onclick?.({target:this});}
  showModal(){this.open=true;}
  close(){this.open=false;this.dispatchEvent({type:'close'});}
}
function fixture(){
  const doc={defaultView:{},events:[],createElement(tag){return new Element(tag,doc);},dispatchEvent(event){this.events.push(event);}};doc.body=doc.createElement('body');doc.activeElement=doc.body;
  const all=()=>{const result=[];const visit=node=>{result.push(node);node.children.forEach(visit);};visit(doc.body);return result;};
  const opener=doc.createElement('button');opener.textContent='Open';doc.body.append(opener);opener.focus();
  return {doc,opener,node:id=>all().find(node=>node.id===id),button:text=>all().find(node=>node.tagName==='button'&&node.textContent===text),all};
}
const rows=[{date:'2026-10-01',price:100},{date:'2026-10-04',price:110}],measurement={startDate:'2026-10-01',startPrice:100,startField:'C',startKind:'observed',endDate:'2026-10-04',endPrice:110,endField:'C',endKind:'observed'};

test('CSV dialog previews source/range/raw USD, freezes original rows, isolates keys and restores opener focus',async()=>{
  const f=fixture(),downloads=[],context={rows:structuredClone(rows),range:{start:'2026-10-01',end:'2026-10-04'},frequency:'weekly',chartType:'line',unit:'percent',asOf:'2026-10-04'},controller=mountChartExportWorkbench({document:f.doc,getContext:()=>context,onDownload:(...args)=>downloads.push(args)});
  controller.open({format:'csv',opener:f.opener});const dialog=f.node('chart-export-dialog');assert.equal(dialog.open,true);assert.equal(f.doc.activeElement,f.node('chart-export-format'));assert.match(dialog.textContent,/Coin Metrics/);assert.match(dialog.textContent,/원 USD/);assert.match(dialog.textContent,/daily · UTC/);assert.match(dialog.textContent,/2026-10-04T00:00:00.000Z/);
  context.rows[0].price=999;context.range.start='2030-01-01';await f.button('저장').click();assert.equal(downloads.length,1);assert.match(downloads[0][1],/,USD,,,,100,,observed/);assert.doesNotMatch(downloads[0][1],/999/);
  let stopped=false;dialog.dispatchEvent({type:'keydown',key:'Home',stopPropagation(){stopped=true;}});assert.equal(stopped,true);f.button('닫기').click();assert.equal(f.doc.activeElement,f.opener);controller.destroy();assert.equal(dialog.isConnected,false);
});

test('CSV dialog makes actual displayed OHLC the default for candle charts and disables an empty export',()=>{
  const f=fixture(),context={rows,observedCandles:[{date:'2026-10-04',time:Date.parse('2026-10-04')/1000,open:100,high:130,low:90,close:115,volume:0}],candleSource:'Bitstamp',range:{start:'2026-10-01',end:'2026-10-04'},frequency:'daily',chartType:'candles',asOf:'2026-10-04'},controller=mountChartExportWorkbench({document:f.doc,getContext:()=>context,onDownload(){throw new Error('must not save empty data');}});
  controller.open({format:'csv'});assert.equal(f.node('chart-export-dataset').value,'bitstamp-ohlc');assert.match(f.node('chart-export-dialog').textContent,/100,130,90,115,0,observed/);
  f.button('닫기').click();context.range={start:'2030-01-01',end:'2030-02-01'};controller.open({format:'csv'});assert.equal(f.button('저장').disabled,true);assert.match(f.node('chart-export-dialog').textContent,/실제 관측값이 없습니다/);controller.destroy();
});

test('research dialog saves multiple measurements, edits exact raw coordinates and preserves hidden locked state',()=>{
  const f=fixture();let state=normalizeResearchAnnotations(null),id=0;const context={rows,measurement,source:'Coin Metrics',asOf:'2026-10-04',frequency:'weekly'},controller=mountResearchAnnotationsWorkbench({document:f.doc,getState:()=>state,getContext:()=>({...context,id:`saved-${++id}`}),onCommand:command=>{state=changeResearchAnnotations(state,command);}});
  controller.open({opener:f.opener});assert.equal(f.node('research-annotations-dialog').open,true);f.button('현재 두 점 측정 저장').click();f.button('현재 두 점 측정 저장').click();assert.equal(state.items.length,2);assert.equal(state.items[1].start.price,100);assert.equal(state.items[1].start.source,'Coin Metrics');
  const form=f.all().find(node=>node.tagName==='form');f.node('research-startDate').value='2026-10-02';f.node('research-startPrice').value='101.123456789';f.node('research-note').value='<script>literal note</script>';form.dispatchEvent({type:'submit',preventDefault(){}});assert.equal(state.items[1].start.date,'2026-10-02');assert.equal(state.items[1].start.price,101.123456789);assert.equal(state.items[1].start.basis,'custom');assert.equal(state.items[1].note,'<script>literal note</script>');
  const selected=state.selectedId;state=changeResearchAnnotations(state,{type:'toggle-lock',id:selected});controller.refresh();assert.equal(f.node('research-startPrice').disabled,true);assert.equal(f.node('research-note').disabled,true);
  state=changeResearchAnnotations(state,{type:'toggle-hidden',id:selected});controller.refresh();assert.equal(state.items[1].hidden,true);assert.equal(state.items[1].locked,true);assert.equal(state.items[1].start.price,101.123456789);
  let stopped=false;f.node('research-annotations-dialog').dispatchEvent({type:'keydown',key:'ArrowRight',stopPropagation(){stopped=true;}});assert.equal(stopped,true);f.button('닫기').click();assert.equal(f.doc.activeElement,f.opener);controller.destroy();
});

test('research dialog does not save an unfinished measurement and reports denied mutations without losing state',()=>{
  const f=fixture();let state=normalizeResearchAnnotations(null),fail=false;const context={rows,measurement:{...measurement,endDate:null},asOf:'2026-10-04'},controller=mountResearchAnnotationsWorkbench({document:f.doc,getState:()=>state,getContext:()=>context,onCommand:command=>{if(fail)throw new Error('storage test error');state=changeResearchAnnotations(state,command);}});
  controller.open();assert.equal(f.button('현재 두 점 측정 저장').disabled,true);assert.equal(controller.saveMeasurement(),false);assert.equal(state.items.length,0);context.measurement=measurement;fail=true;controller.refresh();assert.equal(controller.saveMeasurement(),false);assert.equal(state.items.length,0);assert.match(f.node('research-annotations-dialog').textContent,/storage test error/);controller.destroy();
});
