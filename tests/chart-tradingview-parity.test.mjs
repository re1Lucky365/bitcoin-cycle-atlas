import assert from 'node:assert/strict';
import test from 'node:test';
import { drawAtlasPriceChart } from '../dist/atlas-price-chart.js';
import { drawIntradayChart } from '../dist/intraday-chart.js';

class SvgNode {
  constructor(){this.attrs=new Map();this.nodes=new Map();this.dataset={};this.textContent='';}
  setAttribute(key,value){this.attrs.set(key,String(value));}
  removeAttribute(key){this.attrs.delete(key);}
  querySelector(selector){if(!this.nodes.has(selector))this.nodes.set(selector,new SvgNode());return this.nodes.get(selector);}
  querySelectorAll(selector){return selector==='text'?[0,1,2,3].map(index=>this.querySelector(`text-${index}`)):[];}
  focus(){}
}
const day=86400000,origin=Date.UTC(2024,0,1);
const date=index=>new Date(origin+index*day).toISOString().slice(0,10);
const source=(count=22)=>Array.from({length:count},(_,index)=>({date:date(index),price:100,drawdownPct:0}));
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8*Math.max(1,Math.abs(expected)),`${actual} ≈ ${expected}`);
function fixture(){
  const svg=new SvgNode();
  Object.assign(svg,{id:'parity',clientWidth:1000,clientHeight:600,innerHTML:'',parentElement:{style:{setProperty(){}}},getBoundingClientRect:()=>({left:0,top:0,width:1000,height:600})});
  return svg;
}
function daily(rows,options={}){
  const svg=fixture(),readouts=[],inspections=[];
  const start=options.start??rows[0].date,end=options.end??rows.at(-1).date;
  const controller=drawAtlasPriceChart({svg,rows,start,end,split:rows.at(-1).date,showHistoricalEvents:false,showDrawdown:false,onHover:value=>readouts.push(value),onInspect:(value,meta)=>inspections.push({value,meta}),...options});
  return {svg,controller,readouts,inspections,hoverDate(value){
    const left=Number(svg.dataset.plotLeft),right=Number(svg.dataset.plotRight);
    svg.onpointermove({pointerType:'mouse',target:{closest:()=>null},clientX:left+(Date.parse(value)-Date.parse(start))/(Date.parse(end)-Date.parse(start))*(right-left),clientY:(Number(svg.dataset.plotTop)+Number(svg.dataset.priceBottom))/2});
  }};
}
const key=(value,target={closest:()=>null})=>({key:value,target,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;}});
const marker=(at,price)=>({id:'daily-anchor',type:'cycle-top',date:at,price,kind:'observed',cycleId:'c1'});

test('weekly cursor and arrow keys follow displayed vertices while exact daily landmarks survive',()=>{
  const rows=source(15);rows[7].price=200;const before=structuredClone(rows);
  const plain=daily(rows,{frequency:'weekly'});
  plain.hoverDate(date(7));
  assert.equal(plain.readouts.at(-1).date,date(6));assert.equal(plain.readouts.at(-1).price,100);
  const cross=plain.svg.querySelector('[id$="-cross"]'),dot=cross.querySelector('circle');
  const point=`${Number(dot.attrs.get('cx')).toFixed(2)},${Number(dot.attrs.get('cy')).toFixed(2)}`;
  assert.ok(plain.svg.innerHTML.match(/class="observed-close-line" d="([^"]*)"/)[1].includes(point));
  plain.svg.onkeydown(key('Home'));plain.svg.onkeydown(key('ArrowRight'));
  assert.equal(plain.readouts.at(-1).date,date(6));
  plain.svg.onkeydown(key('ArrowRight'));assert.equal(plain.readouts.at(-1).date,date(13));
  assert.ok(plain.controller.getPriceScale().max<101,'an omitted daily spike does not flatten the weekly line');

  const marked=daily(rows,{frequency:'weekly',cycleMarkers:[marker(date(7),200)]});
  marked.hoverDate(date(7));assert.equal(marked.readouts.at(-1).date,date(7));assert.equal(marked.readouts.at(-1).price,200);
  marked.svg.onkeydown(key('Home'));marked.svg.onkeydown(key('ArrowRight'));marked.svg.onkeydown(key('ArrowRight'));
  assert.equal(marked.readouts.at(-1).date,date(7));
  assert.deepEqual(rows,before);
});

test('weekly return uses the preceding completed weekly close outside the viewport',()=>{
  const rows=source(22);rows[6].price=100;rows[12].price=777;rows[13].price=110;
  const chart=daily(rows,{frequency:'weekly',start:date(13),end:date(21),selectedDate:date(13)});
  assert.equal(chart.readouts.at(-1).previousClose,100);
  assert.equal(chart.readouts.at(-1).previousCloseDate,date(6));
  assert.equal(chart.readouts.at(-1).changePct,10);assert.equal(chart.readouts.at(-1).changeInterval,'1W');
});

test('daily and weekly venue candles compare their previous venue close, including the first visible candle',()=>{
  for(const frequency of ['daily','weekly']){
    const interval=frequency==='weekly'?7:1,rows=source(interval*3);
    rows.forEach(row=>row.price=30000);
    const candles=[100,110,130].map((value,index)=>({date:date((index+1)*interval-1),startDate:date(index*interval),endDate:date((index+1)*interval-1),time:(origin+index*interval*day)/1000,open:index===1?120:value-1,high:150,low:80,close:value,volume:index+1}));
    const chart=daily(rows,{frequency,chartType:'candles',observedCandles:candles,start:candles[1].endDate,end:candles[2].endDate,selectedDate:candles[1].endDate});
    const selected=chart.readouts.at(-1);
    assert.equal(selected.close,110);assert.equal(selected.previousClose,100);assert.equal(selected.changePrice,10);assert.equal(selected.changePct,10);
    assert.equal(selected.fromOpenChangePrice,-10);assert.ok(selected.fromOpenChangePct<0);
    assert.equal(selected.previousCloseDate,candles[0].endDate);
    assert.match(chart.svg.innerHTML,/data-close="110"[^>]*>[\s\S]*?fill="#dd7e8d"/,'body color remains close versus open');
    const first=daily(rows,{frequency,chartType:'candles',observedCandles:candles,start:rows[0].date,end:candles[0].endDate,selectedDate:candles[0].endDate});
    assert.equal(first.readouts.at(-1).previousClose,null);assert.equal(first.readouts.at(-1).changePct,null);
  }
});

test('intraday header returns remain identical in candle and line modes and across viewport changes',()=>{
  const candles=[100,110,130].map((value,index)=>({time:origin/1000+index*60,date:new Date(origin+index*60000).toISOString(),open:index===1?120:value-1,high:150,low:80,close:value,volume:index+1}));
  for(const chartType of ['candles','line']){
    const svg=fixture(),readouts=[];
    const controller=drawIntradayChart({svg,series:{interval:'1m',candles,source:'Coinbase',product:'BTC-USD',retrievedAt:'2024-01-01T01:00:00Z'},chartType,range:{start:candles[1].time,end:candles[2].time},selectedTime:candles[1].time,onHover:value=>readouts.push(value)});
    const selected=readouts.at(-1);assert.equal(selected.previousClose,100);assert.equal(selected.changePct,10);assert.ok(selected.fromOpenChangePct<0);
    assert.equal(selected.previousCloseDate,candles[0].date);
    assert.equal(controller.getPriceScale().mode,'auto');
  }
});

test('future source boundaries do not silently become observed-market return comparisons',()=>{
  const rows=source(5);rows[3].price=120;rows[4].price=132;
  const chart=daily(rows,{split:date(2),selectedDate:date(3)});
  assert.equal(chart.readouts.at(-1).kind,'simulated');assert.equal(chart.readouts.at(-1).previousClose,null);assert.equal(chart.readouts.at(-1).changePct,null);
  chart.controller.selectDate(date(4));assert.equal(chart.readouts.at(-1).previousClose,120);assert.equal(chart.readouts.at(-1).changePct,10);
});

test('annotation-focused navigation keys never claim price inspection while Enter and Space still activate',()=>{
  const activations=[],chart=daily(source(),{onCycleMarker:id=>activations.push(id),onCycleInterval:id=>activations.push(id),onHistoricalEvent:id=>activations.push(id),onNextTurn:()=>activations.push('next')});
  for(const [selector,field,id] of [['[data-cycle-marker]','cycleMarker','marker'],['[data-cycle-interval]','cycleInterval','interval'],['[data-history-event]','historyEvent','history'],['[data-next-turn]','nextTurn','next']]){
    const target={closest:value=>value===selector?{dataset:{[field]:id}}:null},before=chart.inspections.length;
    for(const value of ['Home','End','ArrowLeft','ArrowRight','Escape'])chart.svg.onkeydown(key(value,target));
    assert.equal(chart.inspections.length,before);
    chart.svg.onkeydown(key('Enter',target));chart.svg.onkeydown(key(' ',target));
    assert.deepEqual(activations.slice(-2),[id,id]);
  }
  const before=chart.inspections.length;chart.svg.onkeydown(key('Home'));assert.equal(chart.inspections.length,before+1);
});

test('manual daily price domains preserve raw geometry, hide offscreen markers and clip price layers independently of panes',()=>{
  const rows=source(3);rows[1].price=1000;
  const options={priceDomain:{min:90,max:110},showVolume:true,showDrawdown:true,cycleMarkers:[marker(date(1),1000)],turns:[{date:date(1),price:1000,type:'high'}]};
  const usd=daily(rows,options),indexed=daily(rows,{...options,unit:'indexed',denominator:100});
  for(const chart of [usd,indexed]){
    const axis=chart.controller.getPriceScale();assert.equal(axis.min,90);assert.equal(axis.max,110);assert.equal(axis.mode,'manual');
    assert.ok(axis.y(1000)<axis.top);assert.equal(chart.svg.dataset.cycleMarkerCount,'0');
    assert.match(chart.svg.innerHTML,/<g class="price-series-layer" clip-path="url\(#parity-price-clip\)">/);
    assert.match(chart.svg.innerHTML,/<circle data-date="2024-01-02" clip-path="url\(#parity-price-clip\)"/);
    assert.ok(Number(chart.svg.dataset.plotBottom)>axis.bottom);
    chart.controller.selectDate(date(1));
    assert.equal(chart.svg.querySelector('[id$="-cross"]').querySelector('.cross-price-tag').attrs.get('visibility'),'hidden');
    assert.doesNotMatch(chart.svg.innerHTML,/NaN|Infinity/);
  }
  for(const value of [90,100,110,1000])close(usd.controller.getPriceScale().y(value),indexed.controller.getPriceScale().y(value));
  assert.equal(usd.svg.dataset.plotLeft,indexed.svg.dataset.plotLeft);assert.equal(usd.svg.dataset.plotRight,indexed.svg.dataset.plotRight);
});

test('manual intraday price axis does not move an offscreen last close onto an axis edge',()=>{
  const candles=[100,200].map((close,index)=>({time:origin/1000+index*60,date:new Date(origin+index*60000).toISOString(),open:close-1,high:close+1,low:close-2,close,volume:1}));
  const svg=fixture(),controller=drawIntradayChart({svg,series:{interval:'1m',candles,source:'Coinbase',product:'BTC-USD',retrievedAt:'2024-01-01T01:00:00Z'},priceDomain:{min:90,max:110}});
  assert.equal(controller.getPriceScale().min,90);assert.equal(controller.getPriceScale().max,110);
  assert.doesNotMatch(svg.innerHTML,/class="market-last-price"/);
  assert.equal(svg.querySelector('[id$="-cross"]').querySelector('.market-price-tag').attrs.get('visibility'),'hidden');
});

test('narrow-range price tick labels stay distinct instead of rounding every tick to the same thousands',()=>{
  const rows=source(3);rows[0].price=99000;rows[1].price=100000;rows[2].price=101000;
  const chart=daily(rows),labels=[...chart.svg.innerHTML.matchAll(/fill="#b0bbca" font-size="[^"]*">([^<]*)<\/text>/g)].map(match=>match[1]);
  assert.ok(labels.length>=3);assert.equal(new Set(labels).size,labels.length);
});
