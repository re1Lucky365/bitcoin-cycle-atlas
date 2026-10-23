import assert from 'node:assert/strict';
import test from 'node:test';
import { createPriceAxisLayout, createPriceAxisFormatter } from '../dist/price-axis.js';
import { createPriceDisplay } from '../dist/price-display.js';
import { createPriceScale } from '../dist/chart-math.js';
import { chartPaneLayout } from '../dist/chart-overlays.js';
import { drawAtlasPriceChart } from '../dist/atlas-price-chart.js';
import { drawIntradayChart } from '../dist/intraday-chart.js';
import { createChartSvgExport, createChartPngExport, createObservedChartCsv } from '../dist/chart-export.js';

// Deterministic glyph-metric boundary fixture, not a browser/pixel renderer.
// Its deliberately different digit/punctuation advances catch character-count
// sizing; browser QA separately checks the resulting SVG and raster pixels.
class Node {
  constructor(tag='g',doc=null){this.tagName=tag;this.ownerDocument=doc;this.attrs=new Map();this.nodes=new Map();this.children=[];this.dataset={};this.textContent='';this.parentNode=null;this.parentElement=null;}
  setAttribute(name,value){this.attrs.set(name,String(value));}getAttribute(name){return this.attrs.get(name)??null;}removeAttribute(name){this.attrs.delete(name);}
  get attributes(){return [...this.attrs].map(([name,value])=>({name,value}));}
  appendChild(node){this.children.push(node);node.parentNode=this;node.parentElement=this;return node;}append(...nodes){for(const node of nodes)this.appendChild(node);}
  removeChild(node){this.children=this.children.filter(child=>child!==node);node.parentNode=null;node.parentElement=null;}remove(){this.parentNode?.removeChild(this);}
  querySelector(selector){if(!this.nodes.has(selector))this.nodes.set(selector,new Node('g',this.ownerDocument));return this.nodes.get(selector);}
  querySelectorAll(selector){return selector==='text'?[0,1,2,3].map(index=>this.querySelector(`text-${index}`)):selector==='*'?this.children.flatMap(child=>[child,...child.querySelectorAll('*')]):[];}
  cloneNode(deep){const node=new Node(this.tagName,this.ownerDocument);node.attrs=new Map(this.attrs);node.textContent=this.textContent;if(deep)node.append(...this.children.map(child=>child.cloneNode(true)));return node;}
  getComputedTextLength(){this.ownerDocument.measures++;return naturalWidth(this.textContent,Number(this.getAttribute('font-size')),this.ownerDocument.widthScale);}
  getBBox(){return {x:0,y:0,width:this.getComputedTextLength(),height:Number(this.getAttribute('font-size'))};}
  focus(){}closest(){return null;}
}
const naturalWidth=(text,size,scale=1)=>[...text].reduce((sum,char)=>sum+(/[.,]/.test(char)?.25:char==='%'?.9:/[-+]/.test(char)?.4:/\d/.test(char)?.61:.59)*size*scale,0);
const esc=value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
const serialize=node=>`<${node.tagName}${node.attributes.map(({name,value})=>` ${name}="${esc(value)}"`).join('')}>${esc(node.textContent)}${node.children.map(serialize).join('')}</${node.tagName}>`;
function fixture(width=390,widthScale=1){
  const doc={measures:0,widthScale,createElementNS:(_ns,tag)=>new Node(tag,doc),defaultView:{getComputedStyle:()=>({fontFamily:'Test Digits, sans-serif',fontWeight:'400',fontStyle:'normal',letterSpacing:'normal'}),XMLSerializer:class{serializeToString(node){return serialize(node);}}}};
  const svg=new Node('svg',doc);Object.assign(svg,{id:'axis-layout',clientWidth:width,clientHeight:520,innerHTML:'',parentElement:{style:{setProperty(){}}},getBoundingClientRect:()=>({left:0,top:0,width,height:520})});return svg;
}
const dates=['2026-10-20','2026-10-21','2026-10-22'],first=Date.parse('2026-10-20T00:00:00Z')/1000;
function chart(kind,{width=390,widthScale=1,value=81567.49,svg=fixture(width,widthScale),...options}={}){
  const rows=[.98,1.02,1].map((factor,index)=>({date:dates[index],price:value*factor,drawdownPct:0}));
  const candles=rows.map((row,index)=>({date:new Date((first+index*3600)*1000).toISOString(),time:first+index*3600,open:row.price*.999,high:row.price*1.003,low:row.price*.997,close:row.price,volume:index}));
  const sourceBefore=structuredClone({rows,candles}),readouts=[];
  const common={svg,showVolume:false,onHover:detail=>readouts.push(detail),...options};
  const draw=extra=>kind==='daily'?drawAtlasPriceChart({rows,start:dates[0],end:dates[2],split:dates[2],denominator:value,showDrawdown:false,showHistoricalEvents:false,...common,...extra}):drawIntradayChart({series:{candles,interval:'1h',source:'Coinbase',product:'BTC-USD',retrievedAt:'2026-10-23T00:00:00Z'},range:{start:first,end:first+7200},...common,...extra});
  const controller=draw({});return {svg,rows,candles,sourceBefore,readouts,controller,draw};
}
const parseAttributes=text=>Object.fromEntries([...text.matchAll(/([\w-]+)="([^"]*)"/g)].map(match=>[match[1],match[2]]));
const labels=markup=>[...markup.matchAll(/<text\b([^>]*data-price-axis-label="[^"]+"[^>]*)>([^<]*)<\/text>/g)].map(match=>({attrs:parseAttributes(match[1]),text:match[2]}));
function contained(label,width){
  assert.equal(label.attrs.lengthAdjust,'spacingAndGlyphs');assert.ok(Number(label.attrs.textLength)>0);
  assert.ok(Number(label.attrs.x)+Number(label.attrs.textLength)<=width-6,`${label.text} extends past the reserved right edge`);
  assert.ok(label.attrs['font-family'],'the measured family must survive export');
}

test('axis gutter uses actual glyph metrics, keeps a bounded plot, and leaves no hidden measuring node',()=>{
  const regular=fixture(320),wide=fixture(320,1.5),a=createPriceAxisLayout({svg:regular,width:320}),b=createPriceAxisLayout({svg:wide,width:320});
  assert.ok(regular.ownerDocument.measures>0);assert.ok(b.right>a.right);assert.ok(b.right<=112);assert.ok(320-8-b.right>=200);
  assert.equal(regular.children.length,0);assert.equal(wide.children.length,0);
  const display=createPriceDisplay({unit:'usd'}),axis={min:80000,max:90000,ticks:[80000,82500,85000,87500,90000]},format=createPriceAxisFormatter({axis,display,layout:a});
  assert.equal(format.price(85386.18),'$85,386.18');assert.ok(a.measure(format.price(85386.18),a.badgeFontSize)<=a.labelWidth);
  assert.equal(a.right,createPriceAxisLayout({svg:regular,width:320}).right);
});

for(const kind of ['daily','intraday']){
  test(`${kind} mobile ticks, latest quotes and live cursor fit all units/scales without mutating OHLC or chart height`,()=>{
    for(const width of [320,360,390,456,620])for(const widthScale of [1,1.5])for(const value of [81567.49,1234567890.12,.000000012345678])for(const unit of ['usd','indexed','percent','indexed-start'])for(const scale of ['log','linear'])for(const invertScale of [false,true]){
      const h=chart(kind,{width,widthScale,value,unit,scale,invertScale}),axis=h.controller.getPriceScale(),before=h.svg.innerHTML;
      assert.equal(h.svg.getAttribute('viewBox'),`0 0 ${width} 520`);
      assert.equal(axis.bottom,chartPaneLayout({width,height:520,volume:false,drawdown:false,top:70}).priceBottom);
      const rendered=labels(before),ticks=rendered.filter(label=>label.attrs['data-price-axis-label']==='tick');assert.ok(ticks.length>=2);
      for(const label of rendered)contained(label,width);
      assert.equal(new Set(ticks.map(label=>label.text)).size,ticks.length,'nearby price ticks remain distinguishable');
      assert.ok(rendered.some(label=>label.attrs['data-price-axis-label']==='latest'));
      const cursorKind=kind==='daily'?'.cross-price-tag':'.market-price-tag',cursor=h.svg.querySelector('[id$="-cross"]').querySelector(cursorKind).querySelector('text');
      const cursorX=Number(before.match(new RegExp(`class="${cursorKind.slice(1)}"[\\s\\S]*?<text x="([^"]+)"`))[1]);
      for(const fraction of [.05,.37,.95]){
        h.controller.previewPointer({clientX:axis.left+(axis.right-axis.left)*.5,clientY:axis.top+(axis.bottom-axis.top)*fraction});
        assert.ok(cursorX+Number(cursor.getAttribute('textLength'))<=width-6);assert.equal(cursor.getAttribute('lengthAdjust'),'spacingAndGlyphs');
        assert.equal(h.controller.getPriceScale().right,axis.right);assert.equal(h.svg.innerHTML,before,'hover fits text without a full redraw');
      }
      h.controller.clearPreview();assert.equal(h.readouts.at(-1).price,value);
      assert.deepEqual({rows:h.rows,candles:h.candles},h.sourceBefore);
      assert.equal(h.svg.children.length,0);
    }
  });

  test(`${kind} free pan into empty time/negative USD space preserves a stable right gutter and does not manufacture rows`,()=>{
    const h=chart(kind,{width:320,scale:'linear',priceDomain:{min:-999999999,max:999999999}}),initial=h.controller.getPriceScale();
    const empty=h.draw(kind==='daily'?{start:'1900-01-01',end:'1900-02-01'}:{range:{start:first-1000000,end:first-999000}}),axis=empty.getPriceScale();
    assert.equal(axis.right,initial.right);assert.equal(axis.top,initial.top);assert.equal(axis.bottom,initial.bottom);assert.equal(axis.min,-999999999);assert.equal(axis.max,999999999);
    assert.equal(h.svg.dataset.visiblePointCount,'0');assert.equal(h.readouts.at(-1).kind,'unavailable');assert.ok(Number.isNaN(h.readouts.at(-1).price));
    for(const label of labels(h.svg.innerHTML))contained(label,320);
    assert.match(h.svg.innerHTML,/data-price-axis="true"/);assert.match(h.svg.innerHTML,/data-time-axis="true"/);
  });
}

test('very small prices stay nonzero and extremely narrow large-price ticks stay distinct',()=>{
  const svg=fixture(320,1.5),layout=createPriceAxisLayout({svg,width:320}),display=createPriceDisplay({unit:'usd'});
  for(const [min,max] of [[1e-100,4e-100],[1e-16,5e-16],[1e11,1e11+1],[1e100,2e100]]){
    const axis=createPriceScale([min,max],{scale:'linear',top:70,bottom:400,domain:{min,max},tickCount:5}),format=createPriceAxisFormatter({axis,display,layout}),ticks=axis.ticks.map(format.tick);
    assert.equal(new Set(ticks).size,ticks.length);for(const label of ticks){assert.notEqual(Number(label.replaceAll(',','').replace('$','')),0);assert.doesNotMatch(label,/…|Infinity|NaN/);}
    assert.ok(Number(format.price(min).replaceAll(',','').replace('$',''))>0);
  }
});

test('font and fitted bounds survive the actual SVG export and PNG input serialization while CSV retains raw precision',async()=>{
  const h=chart('intraday',{width:320,value:1234567890.123456}),svg=fixture(320),doc=svg.ownerDocument;svg.setAttribute('viewBox','0 0 320 520');
  for(const label of labels(h.svg.innerHTML)){const node=new Node('text',doc);for(const [name,value] of Object.entries(label.attrs))node.setAttribute(name,value);node.textContent=label.text;svg.append(node);}
  const vector=createChartSvgExport(svg,{title:'Axis clipping regression'}),exported=labels(vector);assert.equal(exported.length,labels(h.svg.innerHTML).length);for(const label of exported)contained(label,320);
  let imageSource;doc.fonts={ready:Promise.resolve()};doc.defaultView.URL={createObjectURL:blob=>{imageSource=blob;return 'blob:axis';},revokeObjectURL(){}};
  doc.defaultView.DOMParser=class{parseFromString(text){const root=text.match(/<svg\s[^>]+>/)[0];return {documentElement:{getAttribute:name=>root.match(new RegExp(` ${name}="([^"]+)"`))?.[1]}};}};
  doc.defaultView.Image=class{set src(_value){queueMicrotask(()=>this.onload());}};
  // Serialization seam only; received PNG pixels are verified separately.
  doc.createElement=()=>({getContext:()=>({drawImage(){},getImageData(){return {data:new Uint8ClampedArray([16,21,28,255])};}}),toBlob:callback=>callback(new Blob(['png-boundary'],{type:'image/png'}))});
  await createChartPngExport(svg);const pngInput=await imageSource.text();for(const label of labels(pngInput))contained(label,320);
  const csv=createObservedChartCsv({candles:h.candles,range:{start:first,end:first+7200},frequency:'1h',source:'Coinbase'});assert.ok(csv.includes(String(h.candles.at(-1).close)));assert.equal(h.candles.at(-1).close,1234567890.123456);
});
