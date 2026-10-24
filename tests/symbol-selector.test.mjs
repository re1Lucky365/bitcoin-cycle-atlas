import assert from 'node:assert/strict';
import test from 'node:test';
import { SYMBOLS, normalizeSymbol, searchSymbols, createSymbolUrl, mountSymbolSelector } from '../dist/symbol-selector.js';

test('only supported true USD symbols resolve and symbol search includes both names and venue',()=>{
  assert.deepEqual(SYMBOLS.map(item=>item.product),['BTC-USD','ETH-USD','MSTR','BMNR']);
  for(const value of ['ETHUSD','ethusd','ETH-USD',' ETH/USD '])assert.equal(normalizeSymbol(value),'ETHUSD');
  for(const value of ['ETHUSDT','ETHBTC','javascript:ETHUSD',null,undefined])assert.equal(normalizeSymbol(value),'BTCUSD');
  for(const query of ['ethereum','이더리움','ETH/USD','eth usd','ETH Coinbase'])assert.deepEqual(searchSymbols(query).map(item=>item.symbol),['ETHUSD']);
  assert.equal(searchSymbols('USDT').length,0);assert.equal(searchSymbols('btc').length,1);assert.equal(searchSymbols('').length,4);
});

test('switching preserves supported chart choices and removes cross-asset models, bounds and layers',()=>{
  const original='https://twoimo.github.io/bitcoin-cycle-atlas/?page=compare&legacy=1&assumption=stress&granularity=4h&type=candles&axis=linear&span=history&view-start=1770000000&view-end=1780000000&price-min=90000&price-max=100000&indicators=cycle&scenario=bottom-holds&symbol=BTCUSD&return=https%3A%2F%2Fexample.com#forecast';
  const eth=new URL(createSymbolUrl(original,'ETHUSD'));
  assert.equal(eth.origin,'https://twoimo.github.io');assert.equal(eth.pathname,'/bitcoin-cycle-atlas/');assert.equal(eth.hash,'');
  assert.deepEqual([...eth.searchParams],[['symbol','ETHUSD'],['granularity','4h'],['type','candles'],['axis','linear']]);
  const btc=new URL(createSymbolUrl(eth,'BTCUSD'));
  assert.deepEqual([...btc.searchParams],[['granularity','4h'],['type','candles'],['axis','linear']]);
  assert.match(original,/assumption=stress/,'the existing BTC URL remains available in browser history');
});

test('invalid presentation choices are discarded and navigation cannot change destination or scheme',()=>{
  const url=new URL(createSymbolUrl('https://example.com/chart?granularity=1s&type=heikin-ashi&axis=anything&next=https://attacker.invalid','ETH-USD'));
  assert.equal(url.href,'https://example.com/chart?symbol=ETHUSD');
  assert.equal(createSymbolUrl('file:///tmp/Bitcoin_Cycles_Comparison.html?granularity=weekly','ETHUSD'),'file:///tmp/Bitcoin_Cycles_Comparison.html?symbol=ETHUSD&granularity=weekly');
  assert.throws(()=>createSymbolUrl('javascript:alert(1)','ETHUSD'),/Invalid chart URL/);
  assert.throws(()=>createSymbolUrl('https://example.com/','ETHUSDT'),/Unsupported chart symbol/);
});

test('equity symbols resolve by company and executive while crypto intraday settings reset to real supported equity intervals',()=>{
  for(const value of ['MSTR','mstr',' MSTR '])assert.equal(normalizeSymbol(value),'MSTR');
  assert.equal(normalizeSymbol('BMNR'),'BMNR');assert.deepEqual(searchSymbols('마이클 세일러').map(item=>item.symbol),['MSTR']);assert.deepEqual(searchSymbols('Tom Lee').map(item=>item.symbol),['BMNR']);
  const url=new URL(createSymbolUrl('https://example.com/?symbol=ETHUSD&granularity=1h&eth-span=all&type=candles&axis=linear','MSTR'));
  assert.equal(url.searchParams.get('symbol'),'MSTR');assert.equal(url.searchParams.get('granularity'),'daily');assert.equal(url.searchParams.get('type'),'candles');assert.equal(url.searchParams.has('eth-span'),false);
  assert.equal(new URL(createSymbolUrl(url,'BMNR')).searchParams.get('symbol'),'BMNR');
});

// A controller-boundary fixture tests the actual event listeners, focus and
// navigation. Native top-layer layout is verified separately in a browser.
class Surface {
  listeners=new Map();
  addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn);}
  removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);}
  dispatchEvent(event){event.target??=this;this[`on${event.type}`]?.(event);for(const fn of this.listeners.get(event.type)||[])fn(event);if(event.bubbles&&!event.stopped)this.parentElement?.dispatchEvent(event);return !event.defaultPrevented;}
}
class Element extends Surface {
  constructor(tag,doc){super();this.tagName=tag;this.ownerDocument=doc;this.children=[];this.attributes=new Map();this.dataset={};this.className='';this._text='';this.hidden=false;this.style={setProperty(){},removeProperty(){}};this.classList={add:name=>{this.className=`${this.className} ${name}`.trim();}};}
  append(...nodes){for(const node of nodes){node.remove();node.parentElement=this;this.children.push(node);}}
  replaceChildren(...nodes){for(const node of [...this.children])node.remove();this._text='';this.append(...nodes);}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(node=>node!==this);this.parentElement=null;}
  get isConnected(){return this===this.ownerDocument.body||Boolean(this.parentElement?.isConnected);}
  set textContent(value){this.replaceChildren();this._text=String(value??'');}
  get textContent(){return this._text+this.children.map(node=>node.textContent).join('');}
  setAttribute(name,value){this.attributes.set(name,String(value));}
  getAttribute(name){return this.attributes.get(name)??null;}
  removeAttribute(name){this.attributes.delete(name);}
  focus(){this.ownerDocument.activeElement=this;this.onfocus?.();}
  click(){this.dispatchEvent(event('click'));}
  showModal(){this.setAttribute('open','');}
  close(){this.removeAttribute('open');this.dispatchEvent(event('close'));}
  getBoundingClientRect(){return {left:10,right:510,top:24,bottom:400};}
  find(predicate){if(predicate(this))return this;for(const child of this.children){const found=child.find(predicate);if(found)return found;}return null;}
  findAll(predicate){return [...(predicate(this)?[this]:[]),...this.children.flatMap(child=>child.findAll(predicate))];}
}
function event(type,extra={}){return {type,defaultPrevented:false,stopped:false,...extra,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;}};}
function fixture(t,{symbol='BTCUSD',onSelect=null}={}){
  const doc=new Surface(),destinations=[];doc.createElement=tag=>new Element(tag,doc);doc.body=doc.createElement('body');
  doc.defaultView={location:{href:'https://example.com/chart?granularity=1h&type=candles&price-min=85000&assumption=base',assign:url=>destinations.push(url)},CustomEvent:class {constructor(type,options){this.type=type;this.detail=options.detail;}}};
  const button=doc.createElement('button');doc.body.append(button);doc.activeElement=button;
  const selector=mountSymbolSelector({button,symbol,document:doc,onSelect});t.after(()=>selector.destroy());
  const node=id=>doc.body.find(item=>item.id===id),input=selector.element.find(item=>item.tagName==='input');
  const key=(value,extra={})=>{const e=event('keydown',{key:value,bubbles:true,...extra});doc.activeElement.dispatchEvent(e);return e;};
  return {doc,button,selector,node,input,key,destinations};
}

test('search keyboard selects ETH, cleans asset state and restores trigger focus',t=>{
  const f=fixture(t);f.button.click();assert.equal(f.selector.isOpen(),true);assert.equal(f.button.getAttribute('aria-expanded'),'true');assert.equal(f.doc.activeElement,f.input);
  assert.equal(f.input.getAttribute('aria-activedescendant'),'symbol-option-BTCUSD');
  assert.equal(f.key('ArrowDown').defaultPrevented,true);assert.equal(f.input.getAttribute('aria-activedescendant'),'symbol-option-ETHUSD');
  f.key('Enter');assert.equal(f.selector.isOpen(),false);assert.equal(f.doc.activeElement,f.button);
  assert.equal(f.destinations[0],'https://example.com/chart?symbol=ETHUSD&granularity=1h&type=candles');
});

test('search input filters safely; IME confirmation and empty results cannot navigate',t=>{
  const f=fixture(t);f.selector.open();f.input.value='이더리움';f.input.oninput();
  assert.equal(f.node('symbol-search-results').children.length,1);assert.equal(f.input.getAttribute('aria-activedescendant'),'symbol-option-ETHUSD');
  f.key('Enter',{isComposing:true});assert.equal(f.selector.isOpen(),true);assert.equal(f.destinations.length,0);
  f.input.value='<img src=x onerror=alert(1)>';f.input.oninput();assert.equal(f.node('symbol-search-results').children.length,0);assert.equal(f.input.getAttribute('aria-activedescendant'),null);
  f.key('Enter');assert.equal(f.destinations.length,0);assert.equal(f.selector.isOpen(),true);
  f.key('Escape');assert.equal(f.selector.isOpen(),false);assert.equal(f.button.getAttribute('aria-expanded'),'false');assert.equal(f.doc.activeElement,f.button);
});

test('the current symbol closes without reload and optional selection callbacks receive an isolated URL',t=>{
  const selected=[],f=fixture(t,{symbol:'ETHUSD',onSelect:(...args)=>selected.push(args)});f.selector.open();
  f.node('symbol-option-ETHUSD').click();assert.equal(selected.length,0);assert.equal(f.selector.isOpen(),false);
  f.selector.open();f.node('symbol-option-BTCUSD').click();assert.deepEqual(selected,[['BTCUSD','https://example.com/chart?granularity=1h&type=candles']]);assert.equal(f.destinations.length,0);
});

test('focus stays in the dialog and modal replacement/teardown release listeners',t=>{
  const f=fixture(t);f.selector.open();const close=f.selector.element.find(item=>item.className==='symbol-search-close');
  f.node('symbol-option-ETHUSD').focus();assert.equal(f.input.getAttribute('aria-activedescendant'),'symbol-option-ETHUSD');
  assert.equal(f.key('Tab').defaultPrevented,true);assert.equal(f.doc.activeElement,close);
  f.key('Tab',{shiftKey:true});assert.equal(f.doc.activeElement,f.node('symbol-option-ETHUSD'));
  f.doc.dispatchEvent({type:'atlas:modal-open',detail:{id:'another-dialog'}});assert.equal(f.selector.isOpen(),false);assert.equal(f.doc.activeElement,f.button);
  f.selector.open();f.selector.element.dispatchEvent(event('click',{clientX:0,clientY:0}));assert.equal(f.selector.isOpen(),false);
  f.selector.destroy();assert.equal(f.node('symbol-search-dialog'),null);assert.equal(f.doc.listeners.get('atlas:modal-open').size,0);f.button.click();assert.equal(f.selector.isOpen(),false);
});
