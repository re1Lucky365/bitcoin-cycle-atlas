import assert from 'node:assert/strict';
import test from 'node:test';
import { drawIntradayChart } from '../dist/intraday-chart.js';
import { CHART_INTERVALS } from '../dist/ohlc-data.js';

class SvgNode {
  constructor(){this.attrs=new Map();this.nodes=new Map();this.dataset={};this.textContent='';}
  setAttribute(key,value){this.attrs.set(key,String(value));}
  removeAttribute(key){this.attrs.delete(key);}
  getAttribute(key){return this.attrs.get(key);}
  querySelector(selector){if(!this.nodes.has(selector))this.nodes.set(selector,new SvgNode());return this.nodes.get(selector);}
  querySelectorAll(){return [];}
  focus(){}
}
function svgFixture(width=1100,height=450){
  const svg=new SvgNode();
  Object.assign(svg,{id:'eth-render-test',clientWidth:width,clientHeight:height,innerHTML:'',parentElement:{style:{setProperty(){}}}});
  svg.getBoundingClientRect=()=>({left:0,top:0,width,height});
  return svg;
}
const start=Date.parse('2022-01-03T00:00:00Z')/1000;
const candle=(index,seconds=86400)=>({time:start+index*seconds,date:new Date((start+index*seconds)*1000).toISOString(),open:2000+index%70,high:2040+index%70,low:1980+index%70,close:2020+index%70,volume:100+index%90});
const series=(candles,interval='daily',extra={})=>({interval,source:'Coinbase Exchange',product:'ETH-USD',retrievedAt:'2026-10-24T00:00:00.000Z',candles,gapCount:0,...extra});
const ticks=svg=>[...svg.innerHTML.matchAll(/class="market-time-label"[^>]*>([^<]+)<\/text>/g)].map(match=>match[1]);

test('ETH line and candle views identify the same observed OHLC across every supported interval',()=>{
  for(const interval of CHART_INTERVALS)for(const chartType of ['line','candles']){
    const rows=Array.from({length:4},(_,i)=>candle(i,interval.seconds)),svg=svgFixture();
    let hovered,inspected;
    const controller=drawIntradayChart({svg,series:series(rows,interval.id),chartType,showVolume:false,onHover:value=>{hovered=value;},onInspect:value=>{inspected=value;}});
    controller.selectDate(rows[1].date);
    assert.equal(svg.dataset.product,'ETH-USD');
    assert.equal(svg.dataset.observedCandleCount,'4');
    assert.match(svg.innerHTML,/<title>Coinbase Exchange ETH-USD/);
    assert.doesNotMatch(svg.innerHTML,/BTC|volume-pane|volume-projection|forecast|cycle-marker/);
    assert.equal(hovered.product,'ETH-USD');
    assert.equal(hovered.volumeUnit,'ETH');
    assert.equal(hovered.kind,'observed');
    assert.equal(hovered.completed,true);
    for(const key of ['time','open','high','low','close','volume'])assert.equal(hovered[key],rows[1][key]);
    assert.equal(inspected.product,'ETH-USD');
    assert.equal(inspected.kind,'observed');
    assert.ok(inspected.fields.some(field=>field.label==='거래량 · ETH'));
    assert.ok(inspected.fields.some(field=>field.label==='출처'&&field.value==='Coinbase Exchange · ETH-USD'));
    assert.doesNotMatch(controller.getSelection().copyText,/BTC|조건부|예측/);
  }
});

test('multiyear daily and weekly ETH charts show years on desktop and mobile without losing source selection',()=>{
  for(const interval of [{id:'daily',seconds:86400,count:1461},{id:'weekly',seconds:604800,count:209}])for(const width of [360,1100]){
    const rows=Array.from({length:interval.count},(_,i)=>candle(i,interval.seconds)),svg=svgFixture(width);
    let hovered;
    const controller=drawIntradayChart({svg,series:series(rows,interval.id),showVolume:false,onHover:value=>{hovered=value;}});
    const labels=ticks(svg);
    assert.ok(labels.length>=3);
    assert.ok(labels.every(label=>/^20\d{2}-\d{2}$/.test(label)),labels.join(', '));
    assert.ok(new Set(labels.map(label=>label.slice(0,4))).size>=3);
    for(const index of [0,Math.floor(rows.length/2),rows.length-1]){
      controller.selectDate(rows[index].date);
      assert.equal(hovered.time,rows[index].time);
      assert.equal(hovered.close,rows[index].close);
      assert.equal(hovered.product,'ETH-USD');
    }
  }
});

test('intraday time labels retain hours while short daily labels use calendar dates',()=>{
  const intraday=svgFixture(),daily=svgFixture();
  drawIntradayChart({svg:intraday,series:series([candle(0,60),candle(1,60),candle(2,60)],'1m'),showVolume:false});
  drawIntradayChart({svg:daily,series:series([candle(0),candle(1),candle(2)]),showVolume:false});
  assert.ok(ticks(intraday).every(label=>/^01-03 00:0[0-2]$/.test(label)));
  assert.deepEqual(ticks(daily),['2022-01-03','2022-01-04','2022-01-05']);
});

test('missing ETH minutes, days, and weeks break the close line without inventing candles',()=>{
  for(const interval of [{id:'1m',seconds:60},{id:'daily',seconds:86400},{id:'weekly',seconds:604800}]){
    const rows=[0,1,3,4].map(index=>candle(index,interval.seconds)),svg=svgFixture();
    drawIntradayChart({svg,series:series(rows,interval.id,{gapCount:1}),chartType:'line',showVolume:false});
    const path=svg.innerHTML.match(/class="market-close-line" d="([^"]*)"/)[1];
    assert.equal((path.match(/M/g)||[]).length,2);
    assert.equal((path.match(/[ML]/g)||[]).length,4);
    assert.equal(svg.dataset.observedCandleCount,'4');
    assert.doesNotMatch(svg.innerHTML,/NaN|Infinity/);
  }
});

test('an empty ETH viewport clears the prior readout while retaining ETH identity and unavailable state',()=>{
  const svg=svgFixture(360);let hovered;
  drawIntradayChart({svg,series:series([candle(0)],'daily',{product:'BTC-USD'}),showVolume:false,onHover:value=>{hovered=value;}});
  assert.equal(hovered.product,'BTC-USD');
  const controller=drawIntradayChart({svg,series:series([candle(10)]),range:{start,end:start+86400},showVolume:false,onHover:value=>{hovered=value;}});
  assert.equal(svg.dataset.product,'ETH-USD');
  assert.equal(hovered.product,'ETH-USD');
  assert.equal(hovered.volumeUnit,'ETH');
  assert.equal(hovered.kind,'unavailable');
  assert.equal(hovered.completed,false);
  assert.ok(Number.isNaN(hovered.price));
  assert.equal(controller.getSelection(),null);
  assert.doesNotMatch(svg.innerHTML,/market-candle|market-close-line|BTC-USD/);
});

test('legacy series without an explicit product retain BTC identity in rendered and copied data',()=>{
  const svg=svgFixture();let hovered,inspected;
  const controller=drawIntradayChart({svg,series:series([candle(0)],'daily',{product:undefined}),showVolume:false,onHover:value=>{hovered=value;},onInspect:value=>{inspected=value;}});
  assert.equal(hovered.product,'BTC-USD');
  assert.equal(hovered.volumeUnit,'BTC');
  assert.equal(inspected.product,'BTC-USD');
  assert.match(svg.innerHTML,/<title>Coinbase Exchange BTC-USD/);
  assert.match(controller.getSelection().copyText,/Coinbase Exchange · BTC-USD/);
});
