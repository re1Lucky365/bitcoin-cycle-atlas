import assert from 'node:assert/strict';
import test from 'node:test';
import { createObservedChartCsv, createChartSvgExport } from '../dist/chart-export.js';

test('visible price CSV contains every original observation, no gap fill or future model rows',()=>{
  const rows=[{date:'2026-10-01',price:100},{date:'2026-10-02',price:110},{date:'2026-10-04',price:90},{date:'2026-10-05',price:120},{date:'2026-10-06',price:999}];
  const csv=createObservedChartCsv({rows,range:{start:'2026-10-02',end:'2026-10-06'},asOf:'2026-10-05',frequency:'weekly'});
  const lines=csv.trim().split('\r\n');assert.equal(lines.length,4);
  assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes('2026-10-02,,daily,Coin Metrics,USD,,,,110,,observed'));
  assert.ok(csv.includes('2026-10-04,,daily,Coin Metrics,USD,,,,90,,observed'));
  assert.ok(!csv.includes('2026-10-03'));assert.ok(!csv.includes('999'));
});

test('intraday CSV preserves exact source OHLC and zero-volume completed candles',()=>{
  const time=Date.parse('2026-10-21T00:00:00Z')/1000;
  const candles=[0,1,3].map(i=>({time:time+i*60,date:new Date((time+i*60)*1000).toISOString(),open:100,high:125,low:75,close:110,volume:0}));
  const csv=createObservedChartCsv({candles,range:{start:time,end:time+180},frequency:'1m',source:'Coinbase Exchange'});
  assert.equal(csv.trim().split('\r\n').length,4);
  assert.ok(csv.includes(',1m,Coinbase Exchange,USD,100,125,75,110,0,observed'));
  assert.ok(!csv.includes('00:02:00'));
});

test('CSV distinguishes weekly chart label from candle opening time and escapes source text',()=>{
  const candle={date:'2026-10-18',time:Date.parse('2026-10-12T00:00:00Z')/1000,open:100,high:125,low:75,close:110,volume:1};
  const csv=createObservedChartCsv({candles:[candle],range:{start:'2026-10-01',end:'2026-10-21'},frequency:'weekly',source:'=source,"quoted"'});
  assert.ok(csv.includes('2026-10-18,2026-10-12T00:00:00.000Z,weekly,"\'=source,""quoted"""'));
});

test('an empty actual-data window fails explicitly instead of exporting simulated values',()=>{
  assert.throws(()=>createObservedChartCsv({rows:[{date:'2026-10-21',price:100}],asOf:'2026-10-21',range:{start:'2027-01-01',end:'2027-02-01'}}),/실제 관측값/);
});

// A small SVG tree boundary harness: no layout or browser-rendering claim.
class VectorNode {
  constructor(tag,doc){this.tagName=tag;this.ownerDocument=doc;this.values=new Map();this.children=[];this.textContent='';this.parentElement=null;}
  get attributes(){return [...this.values].map(([name,value])=>({name,value}));}
  getAttribute(name){return this.values.get(name)??null;}
  setAttribute(name,value){this.values.set(name,String(value));}
  removeAttribute(name){this.values.delete(name);}
  append(...nodes){for(const node of nodes){node.parentElement=this;this.children.push(node);}}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(node=>node!==this);this.parentElement=null;}
  cloneNode(deep){const copy=new VectorNode(this.tagName,this.ownerDocument);copy.values=new Map(this.values);copy.textContent=this.textContent;if(deep)copy.append(...this.children.map(node=>node.cloneNode(true)));return copy;}
  matches(selector){
    if(selector==='*')return true;
    const className=selector.match(/^\.([\w-]+)/)?.[1],tag=selector.match(/^[a-zA-Z]+/)?.[0];
    if(className&&!String(this.getAttribute('class')||'').split(/\s+/).includes(className))return false;
    if(tag&&this.tagName!==tag)return false;
    const attribute=selector.match(/\[([\w-]+)(\$?=)"([^"]*)"\]/);
    if(attribute){const value=this.getAttribute(attribute[1]);if(attribute[2]==='$='?!value?.endsWith(attribute[3]):value!==attribute[3])return false;}
    return Boolean(className||tag||attribute);
  }
  querySelectorAll(selector){const selectors=selector.split(',').map(item=>item.trim()),matches=[];for(const child of this.children){if(selectors.some(item=>child.matches(item)))matches.push(child);matches.push(...child.querySelectorAll(selector));}return matches;}
}

test('SVG export keeps periods inside the price chart and strips transient interval previews and activation attributes',()=>{
  const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
  const serialize=node=>`<${node.tagName}${node.attributes.map(({name,value})=>` ${name}="${escape(value)}"`).join('')}>${escape(node.textContent)}${node.children.map(serialize).join('')}</${node.tagName}>`;
  const doc={createElementNS:(_ns,tag)=>new VectorNode(tag,doc),defaultView:{XMLSerializer:class{serializeToString(node){return serialize(node);}}}};
  const make=(tag,attributes={},text='')=>{const node=new VectorNode(tag,doc);for(const [name,value]of Object.entries(attributes))node.setAttribute(name,value);node.textContent=text;return node;};
  const svg=make('svg',{viewBox:'0 0 800 400',id:'price-chart',tabindex:0});
  const period=make('g',{class:'cycle-interval',role:'button',tabindex:0,onclick:'selectPeriod()', 'data-days':'130'});
  const line=make('line',{class:'cycle-interval-line',x1:120,x2:620,y1:210,y2:210});
  const preview=make('g',{class:'cycle-interval-preview'});preview.append(make('text',{},'TRANSIENT_INTERVAL_PREVIEW'));
  period.append(line,make('text',{class:'cycle-interval-duration'},'18주 4일'),preview);svg.append(period);
  const before=serialize(svg),exported=createChartSvgExport(svg,{title:'BTCUSD',legend:[{label:'BOTTOM',color:'#b293ee'},{label:'CYCLE TOP',color:'#f27781'}]});
  assert.equal((exported.match(/<svg\b/g)||[]).length,2,'export has one root and one price chart, without a duplicate period panel');
  assert.match(exported,/18주 4일/);
  const exportedLine=exported.match(/<line class="cycle-interval-line"[^>]*>/)?.[0];
  assert.ok(exportedLine);assert.match(exportedLine,/x1="120"/);assert.match(exportedLine,/x2="620"/);
  assert.doesNotMatch(exported,/TRANSIENT_INTERVAL_PREVIEW|cycle-interval-preview|tabindex=|onclick=|role="button"/);
  assert.match(exported,/BOTTOM/);assert.match(exported,/CYCLE TOP/);
  assert.equal(serialize(svg),before,'export sanitizes only its clone, keeping live chart interactions intact');
});
