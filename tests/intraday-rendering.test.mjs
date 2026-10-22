import assert from 'node:assert/strict';
import test from 'node:test';
import { drawIntradayChart } from '../dist/intraday-chart.js';

const start=Date.parse('2026-10-01T00:00:00Z')/1000;
const candle=index=>({time:start+index*60,date:new Date((start+index*60)*1000).toISOString(),open:100+index%31,high:104+index%31,low:98+index%31,close:101+index%31,volume:index%97});
const series=candles=>({interval:'1m',source:'Coinbase Exchange',product:'BTC-USD',retrievedAt:'2026-10-22T00:00:00.000Z',candles,gapCount:0});
class SvgNode {
  constructor(){this.attrs=new Map();this.nodes=new Map();this.dataset={};this.textContent='';}
  setAttribute(key,value){this.attrs.set(key,String(value));}removeAttribute(key){this.attrs.delete(key);}getAttribute(key){return this.attrs.get(key);}
  querySelector(selector){if(!this.nodes.has(selector))this.nodes.set(selector,new SvgNode());return this.nodes.get(selector);}querySelectorAll(){return [];}focus(){}
}
function svgFixture(width,height=450){const svg=new SvgNode();Object.assign(svg,{id:'intraday-render-test',clientWidth:width,clientHeight:height,innerHTML:'',parentElement:{style:{setProperty(){}}}});svg.getBoundingClientRect=()=>({left:0,top:0,width,height});return svg;}

test('6000 intraday candles remain a small DOM on mobile and desktop while all source OHLCV stay selectable',()=>{
  const rows=Array.from({length:6000},(_,i)=>candle(i));
  for(const width of [360,390,1280]){
    const svg=svgFixture(width);let hovered;
    const control=drawIntradayChart({svg,series:series(rows),chartType:'candles',onHover:value=>{hovered=value;}});
    assert.equal(svg.dataset.candleRendering,'batched');assert.equal(svg.dataset.observedCandleCount,'6000');
    const elements=(svg.innerHTML.match(/<[a-z][\w-]*(?=[\s>])/g)||[]).length;assert.ok(elements<120,`${width}px: ${elements} SVG nodes`);
    const volumeShapes=[...svg.innerHTML.matchAll(/class="volume-bars-batch" d="([^"]*)"/g)].reduce((n,m)=>n+(m[1].match(/Z/g)||[]).length,0);assert.equal(volumeShapes,rows.length);
    for(const index of [0,3000,5999]){control.selectDate(rows[index].date);for(const key of ['time','open','high','low','close','volume'])assert.equal(hovered[key],rows[index][key]);}
  }
});

test('line reduction preserves missing-time breaks and uses at most four original extrema per pixel per run',()=>{
  const rows=Array.from({length:6000},(_,i)=>candle(i)).filter(row=>row.time!==start+3000*60),svg=svgFixture(360);
  drawIntradayChart({svg,series:series(rows),chartType:'line',showVolume:false});
  const path=svg.innerHTML.match(/class="market-close-line" d="([^"]*)"/)[1];
  assert.equal((path.match(/M/g)||[]).length,2,'the missing minute remains a line break');
  assert.ok((path.match(/[ML]/g)||[]).length<4*360+8);assert.equal(svg.dataset.visiblePointCount,'5999');
});

test('a narrow viewport searches a much larger source array logarithmically instead of scanning all history',()=>{
  const rows=Array.from({length:131072},(_,i)=>candle(i));let reads=0;
  const source=new Proxy(rows,{get(target,key,receiver){if(typeof key==='string'&&/^\d+$/.test(key))reads++;return Reflect.get(target,key,receiver);}}),svg=svgFixture(390);
  drawIntradayChart({svg,series:series(source),range:{start:rows[65000].time,end:rows[65008].time},showVolume:false});
  assert.equal(svg.dataset.visiblePointCount,'9');assert.ok(reads<70,`${reads} original-array reads for nine visible candles`);
});

test('empty windows replace stale values with unavailable readout and distinguish loading, errors and checked gaps',()=>{
  for(const [historyStatus,copy] of [['loading',/불러오고/],['error',/조회에 실패/],['ready',/거래 봉이 없습니다/]]){
    const svg=svgFixture(360);let value;const control=drawIntradayChart({svg,series:series([candle(10)]),range:{start,end:start+60},historyStatus,onHover:detail=>{value=detail;}});
    assert.equal(control,null);assert.equal(value.kind,'unavailable');assert.equal(value.completed,false);assert.ok(Number.isNaN(value.price));assert.match(svg.innerHTML,copy);
  }
});
