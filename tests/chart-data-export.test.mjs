import assert from 'node:assert/strict';
import test from 'node:test';
import { createObservedChartCsv, createChartSvgExport, chartRasterSize, createChartPngExport } from '../dist/chart-export.js';
import {captureChartExportSnapshot,copyChartSnapshotImage} from '../dist/chart-export-workbench.js';

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

test('PNG size preserves the aspect ratio and bounds phone memory for large snapshots',()=>{
  assert.deepEqual(chartRasterSize(800,500),{width:1600,height:1000});
  for(const [width,height] of [[12000,800],[400,20000],[10000,10000]]){
    const size=chartRasterSize(width,height);
    assert.ok(size.width<=4096&&size.height<=4096&&size.width*size.height<=12000000);
    assert.ok(Math.abs(size.width/size.height-width/height)<.02);
  }
  for(const [width,height] of [[0,10],[Infinity,500],[-1,300]])assert.throws(()=>chartRasterSize(width,height),RangeError);
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

function rasterFixture({imageError=false,blobError=false}={}){
  const calls={revoked:[],draws:0},canvas={width:0,height:0,getContext:()=>({drawImage(){calls.draws++;}}),toBlob:callback=>callback(blobError?null:new Blob(['raster'],{type:'image/png'}))};
  const serialize=node=>`<${node.tagName}${node.attributes.map(({name,value})=>` ${name}="${String(value).replaceAll('"','&quot;')}"`).join('')}>${node.textContent}${node.children.map(serialize).join('')}</${node.tagName}>`;
  const doc={fonts:{ready:Promise.resolve()},createElement:()=>canvas,createElementNS:(_ns,tag)=>new VectorNode(tag,doc),defaultView:{
    XMLSerializer:class{serializeToString(node){return serialize(node);}},
    DOMParser:class{parseFromString(text){const root=text.match(/<svg\s[^>]+>/)[0];return {documentElement:{getAttribute:name=>root.match(new RegExp(` ${name}="([^"]+)"`))?.[1]}};}},
    URL:{createObjectURL:()=> 'blob:test-chart',revokeObjectURL:url=>calls.revoked.push(url)},
    Image:class{set src(_value){queueMicrotask(()=>imageError?this.onerror():this.onload());}}
  }};
  const svg=new VectorNode('svg',doc);svg.setAttribute('viewBox','0 0 800 400');
  return {svg,canvas,calls};
}

test('PNG exports the source-labelled vector, releases its blob URL and clears the large canvas',async()=>{
  const f=rasterFixture(),blob=await createChartPngExport(f.svg,{title:'BTCUSD · USD · 로그 · 기준 가정 · UTC',note:'조건부 시나리오'});
  assert.equal(blob.type,'image/png');assert.equal(f.calls.draws,1);
  assert.deepEqual(f.calls.revoked,['blob:test-chart']);assert.equal(f.canvas.width,0);assert.equal(f.canvas.height,0);
});

test('failed PNG decoding or encoding provides an SVG fallback and still releases its resources',async()=>{
  for(const options of [{imageError:true},{blobError:true}]){
    const f=rasterFixture(options);await assert.rejects(createChartPngExport(f.svg),/SVG 저장/);
    assert.deepEqual(f.calls.revoked,['blob:test-chart']);assert.equal(f.canvas.width,0);assert.equal(f.canvas.height,0);
  }
});

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

test('workspace export snapshots only visible expanded panes with their own labels and axes, without duplicate overlays',()=>{
  const f=rasterFixture(),doc=f.svg.ownerDocument,make=(name)=>{const panel=new VectorNode('svg',doc);panel.setAttribute('viewBox','0 0 400 180');const text=new VectorNode('text',doc);text.textContent=name;panel.append(text);return panel;};
  const context={svg:f.svg,frequency:'daily',range:{start:'2026-10-01',end:'2026-10-21'},asOf:'2026-10-21',rows:[{date:'2026-10-21',price:100}],imageOptions:{title:'BTCUSD · USD',source:'SOURCE BEFORE'},panels:[{svg:make('VISIBLE AXIS'),title:'Drawdown pane',note:'Own percentage axis'},{svg:make('HIDDEN AXIS'),title:'Hidden pane',hidden:true},{svg:make('MINIMIZED AXIS'),title:'Minimized pane',minimized:true}]};
  const snapshot=captureChartExportSnapshot(context);assert.equal(snapshot.panels.length,1);assert.deepEqual(snapshot.excludedPanels,['Hidden pane','Minimized pane']);
  assert.match(snapshot.images.workspace,/VISIBLE AXIS|Drawdown pane|Own percentage axis/);assert.doesNotMatch(snapshot.images.workspace,/HIDDEN AXIS|MINIMIZED AXIS/);assert.doesNotMatch(snapshot.images.main,/VISIBLE AXIS/);
  assert.equal((snapshot.images.workspace.match(/<svg\b/g)||[]).length,3);context.panels[0].svg.children[0].textContent='CHANGED AXIS';context.imageOptions.source='SOURCE AFTER';context.rows[0].price=999;
  assert.match(snapshot.images.workspace,/SOURCE BEFORE/);assert.doesNotMatch(snapshot.images.workspace,/CHANGED AXIS|SOURCE AFTER/);assert.doesNotMatch(snapshot.datasets[0].csv,/999/);
});

test('PNG serialization captures geometry and metadata before pending fonts or image decoding can observe new state',async()=>{
  const f=rasterFixture(),doc=f.svg.ownerDocument;let releaseFont,sourceBlob;doc.fonts.ready=new Promise(resolve=>{releaseFont=resolve;});doc.defaultView.URL.createObjectURL=blob=>{sourceBlob=blob;return 'blob:test-chart';};
  const path=new VectorNode('path',doc);path.setAttribute('d','M10 20L30 40');f.svg.append(path);const options={title:'SNAPSHOT BEFORE',source:'OLD SOURCE'},pending=createChartPngExport(f.svg,options);
  path.setAttribute('d','M999 999L888 888');options.title='SNAPSHOT AFTER';options.source='NEW SOURCE';releaseFont();await pending;
  const serialized=await sourceBlob.text();assert.match(serialized,/M10 20L30 40/);assert.match(serialized,/SNAPSHOT BEFORE/);assert.match(serialized,/OLD SOURCE/);assert.doesNotMatch(serialized,/999|SNAPSHOT AFTER|NEW SOURCE/);
});

test('image clipboard starts write synchronously with the fixed PNG promise and releases resources after encoding',async()=>{
  const f=rasterFixture(),doc=f.svg.ownerDocument;let wrote=false,payload;doc.defaultView.ClipboardItem=class{constructor(value){payload=value;}};doc.defaultView.navigator={clipboard:{write(items){wrote=true;assert.equal(items.length,1);return Promise.resolve(payload['image/png']).then(blob=>assert.equal(blob.type,'image/png'));}}};
  const vector=createChartSvgExport(f.svg),pending=copyChartSnapshotImage(vector,doc);assert.equal(wrote,true,'clipboard write remains inside the initiating user gesture');await pending;assert.equal(f.canvas.width,0);assert.deepEqual(f.calls.revoked,['blob:test-chart']);
});
