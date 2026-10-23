import assert from 'node:assert/strict';
import test from 'node:test';
import { drawAtlasPriceChart } from '../dist/atlas-price-chart.js';
import { drawIntradayChart } from '../dist/intraday-chart.js';
import { createPriceDisplay, formatDisplayPrice } from '../dist/price-display.js';
import { createPriceScale } from '../dist/chart-math.js';

class SvgNode{
  constructor(){this.attrs=new Map();this.nodes=new Map();this.dataset={};this.textContent='';}
  setAttribute(name,value){this.attrs.set(name,String(value));}getAttribute(name){return this.attrs.get(name)??null;}removeAttribute(name){this.attrs.delete(name);}
  querySelector(selector){if(!this.nodes.has(selector))this.nodes.set(selector,new SvgNode());return this.nodes.get(selector);}
  querySelectorAll(selector){return selector==='text'?[0,1,2,3].map(index=>this.querySelector(`text-${index}`)):[];}
  focus(){}closest(){return null;}
}
function svgFixture(){const svg=new SvgNode();Object.assign(svg,{id:'display-mode',clientWidth:1000,clientHeight:600,innerHTML:'',parentElement:{style:{setProperty(){}}},getBoundingClientRect:()=>({left:0,top:0,width:1000,height:600})});return svg;}
const dates=['2026-10-19','2026-10-20','2026-10-21'];
const dailyRows=dates.map((date,index)=>({date,price:[100,80,120][index],drawdownPct:0}));
const first=Date.parse('2026-10-20T12:00:00Z')/1000;
const candles=[100,80,120].map((close,index)=>({time:first+index*60,date:new Date((first+index*60)*1000).toISOString(),open:close-1,high:close+4,low:close-4,close,volume:index+1}));
const series={interval:'1m',candles,source:'Coinbase Exchange',product:'BTC-USD',retrievedAt:'2026-10-20T12:05:00Z',gapCount:0};
function chart(kind,options={}){
  const svg=options.svg||svgFixture(),readouts=[],inspections=[],activations=[],measurements=[];
  const common={svg,scale:'linear',onHover:value=>readouts.push(value),onInspect:value=>inspections.push(value),onAnnotation:id=>activations.push(id),onMeasurement:value=>measurements.push(value),showVolume:false,...options};
  const draw=extra=>kind==='daily'?drawAtlasPriceChart({rows:dailyRows,start:dates[0],end:dates.at(-1),split:dates.at(-1),denominator:120,showDrawdown:false,showHistoricalEvents:false,...common,...extra}):drawIntradayChart({series,range:{start:first,end:first+120},...common,...extra});
  return {svg,controller:draw({}),draw,readouts,inspections,activations,measurements};
}
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} ≈ ${b}`);

test('display transformations distinguish prior latest=100 from starting=100 and percent without editing raw values',()=>{
  const before=structuredClone(dailyRows),old=createPriceDisplay({unit:'indexed',rows:dailyRows,denominator:120,denominatorDate:dates[2]}),start=createPriceDisplay({unit:'indexed-start',rows:dailyRows,scale:'log'}),percent=createPriceDisplay({unit:'percent',rows:dailyRows,scale:'log'});
  close(old.toDisplay(120),100);close(start.toDisplay(100),100);close(start.toDisplay(120),120);close(percent.toDisplay(100),0);close(percent.toDisplay(80),-20);
  assert.equal(old.baseDate,dates[2]);assert.equal(start.baseDate,dates[0]);assert.equal(percent.baseDate,dates[0]);assert.equal(start.effectiveScale,'linear');assert.equal(percent.effectiveScale,'linear');
  assert.equal(formatDisplayPrice(80,percent),'-20%');assert.deepEqual(dailyRows,before);
});

for(const kind of ['daily','intraday']){
  test(`${kind} renderers publish the visible basis before returning a new controller`,()=>{
    for(const unit of ['percent','indexed-start','indexed']){
      const h=chart(kind,{unit,scale:'log'}),display=h.controller.getPriceScale().display;
      assert.equal(display.unit,unit);assert.deepEqual(h.readouts.at(-1).display,display);
      const expected=unit==='percent'?20:unit==='indexed-start'?120:100;close(h.readouts.at(-1).displayedPrice,expected);assert.equal(h.readouts.at(-1).price,120);
      h.controller.selectDate(kind==='daily'?dates[0]:candles[0].date);close(h.readouts.at(-1).displayedPrice,unit==='percent'?0:unit==='indexed-start'?100:100/1.2);
      assert.equal(h.svg.dataset.scale,unit==='indexed'?'log':'linear');assert.doesNotMatch(h.svg.innerHTML,/NaN|Infinity/);
    }
  });

  test(`${kind} start basis uses its first supplied visible row, never an invented left-edge observation`,()=>{
    const h=chart(kind,{unit:'percent',...(kind==='daily'?{start:dates[1]}:{range:{start:first+30,end:first+120}})}),display=h.controller.getPriceScale().display;
    assert.equal(display.basePrice,80);assert.equal(display.baseDate,kind==='daily'?dates[1]:candles[1].date);
    h.controller.selectDate(display.baseDate);assert.equal(h.readouts.at(-1).displayedPrice,0);assert.equal(h.svg.dataset.visiblePointCount,'2');
  });

  test(`${kind} reverse axes mirror only screen geometry and keep manual raw USD bounds`,()=>{
    const a=chart(kind,{priceDomain:{min:50,max:150},unit:'usd'}),b=chart(kind,{priceDomain:{min:50,max:150},unit:'percent',invertScale:true});
    const normal=a.controller.getPriceScale(),inverted=b.controller.getPriceScale();assert.equal(normal.min,inverted.min);assert.equal(normal.max,inverted.max);assert.equal(inverted.mode,'manual');assert.equal(inverted.inverted,true);
    for(const value of [50,80,120,150]){close(normal.y(value)+inverted.y(value),normal.top+normal.bottom);close(inverted.invert(inverted.y(value)),value);}
    assert.equal(b.readouts.at(-1).price,a.readouts.at(-1).price);assert.equal(b.svg.dataset.observedCandleCount,a.svg.dataset.observedCandleCount);
  });

  test(`${kind} an out-of-data viewport retains axes and real navigation surfaces without source rows or stale selections`,()=>{
    const h=chart(kind,{priceDomain:{min:50,max:150}}),old=h.controller;
    const empty=h.draw(kind==='daily'?{start:'2200-01-01',end:'2200-01-31'}:{range:{start:first+100000,end:first+101000}});
    assert.ok(empty);assert.equal(empty.getDate(),null);assert.equal(empty.getSelection(),null);assert.equal(empty.getPriceScale().min,50);assert.equal(empty.getPriceScale().max,150);
    assert.equal(h.svg.dataset.visiblePointCount,'0');assert.equal(h.svg.dataset.observedCandleCount,'0');assert.equal(h.readouts.at(-1).kind,'unavailable');assert.ok(Number.isNaN(h.readouts.at(-1).price));
    assert.match(h.svg.innerHTML,/data-price-axis="true"/);assert.match(h.svg.innerHTML,/data-time-axis="true"/);assert.doesNotMatch(h.svg.innerHTML,/class="(?:observed-close-line|market-close-line|market-candle|observed-candle)"/);
    const before=h.readouts.length;assert.equal(old.previewPointer({clientX:500,clientY:200}),false);assert.equal(old.clearPreview(),false);assert.equal(h.readouts.length,before);
  });

  test(`${kind} explicit touch preview follows the same real rows, does not commit, and cannot act through a stale controller`,()=>{
    const h=chart(kind),selected=h.controller.getDate(),axis=h.controller.getPriceScale(),before=h.inspections.length;
    assert.equal(h.controller.previewPointer({clientX:axis.left,clientY:axis.y(100)}),true);assert.equal(h.readouts.at(-1).price,100);assert.equal(h.controller.getDate(),selected);assert.equal(h.inspections.length,before);
    h.svg.onpointerleave({pointerType:'touch'});assert.equal(h.readouts.at(-1).price,100);assert.equal(h.readouts.at(-1).hovered,true);
    assert.equal(h.controller.clearPreview(),true);assert.equal(h.readouts.at(-1).price,120);
    const old=h.controller;h.draw({unit:'percent'});const calls=h.readouts.length;assert.equal(old.previewPointer({clientX:axis.left,clientY:axis.y(100)}),false);assert.equal(old.clearPreview(),false);assert.equal(h.readouts.length,calls);
  });
}

test('price-only auto excludes assumption and milestone extents while manual bounds remain authoritative',()=>{
  const rows=dailyRows.map(row=>({...row,lower:1,upper:10000})),marker={id:'high',type:'cycle-top',date:dates[1],price:20000,kind:'provisional'};
  const common={rows,split:dates[0],band:true,cycleMarkers:[marker]},all=chart('daily',common),price=chart('daily',{...common,priceOnlyAuto:true}),manual=chart('daily',{...common,priceOnlyAuto:true,priceDomain:{min:50,max:150}});
  assert.ok(all.controller.getPriceScale().max>=20000);assert.ok(price.controller.getPriceScale().max<200);assert.equal(manual.controller.getPriceScale().min,50);assert.equal(manual.controller.getPriceScale().max,150);
  assert.equal(price.readouts.at(-1).price,all.readouts.at(-1).price);assert.match(price.svg.innerHTML,/data-indicator-layer="range"/);assert.deepEqual(rows.map(row=>row.price),[100,80,120]);
});

test('saved intraday anchors preserve fractional UTC coordinates on daily charts and cannot trigger measurement or price selection',()=>{
  const annotation={id:'saved',label:'UTC exact',start:{date:'2026-10-19T12:00:00Z',price:95},end:{date:'2026-10-20T06:00:00Z',price:105}};
  for(const tool of ['crosshair','measure']){
    const h=chart('daily',{tool,researchAnnotations:[annotation],activeAnnotationId:'saved'}),axis=h.controller.getPriceScale(),line=h.svg.innerHTML.match(/class="research-annotation-line" x1="([^"]+)" x2="([^"]+)"/);
    assert.ok(line);close(Number(line[1]),axis.left+(axis.right-axis.left)*.25);close(Number(line[2]),axis.left+(axis.right-axis.left)*.625);
    assert.match(h.svg.innerHTML,/class="research-annotation is-active/);
    const target={dataset:{researchAnnotation:'saved'},closest:selector=>selector.includes('data-research-annotation')?target:null},before=h.inspections.length;
    h.svg.onclick({target,clientX:500,clientY:200});
    for(const key of ['Enter',' ','Home','ArrowRight'])h.svg.onkeydown({key,target,preventDefault(){},stopPropagation(){}});
    assert.deepEqual(h.activations,['saved','saved','saved']);assert.equal(h.inspections.length,before);assert.equal(h.measurements.length,0);
    assert.equal(annotation.start.date,'2026-10-19T12:00:00Z');assert.equal(annotation.end.price,105);
  }
});

test('linear display scales support empty negative USD space and percent ticks without changing inversion math',()=>{
  const display=createPriceDisplay({unit:'percent',rows:[{date:dates[0],price:100}]}),axis=createPriceScale([100],{scale:display.effectiveScale,top:10,bottom:210,domain:{min:-50,max:150},factor:display.factor,offset:display.offset});
  assert.equal(axis.min,-50);assert.equal(axis.max,150);assert.ok(axis.ticks.some(tick=>tick<0));close(axis.invert(axis.y(-25)),-25);
  assert.equal(formatDisplayPrice(50,display),'-50%');assert.equal(createPriceDisplay({unit:'percent',rows:[]}).available,false);
});
