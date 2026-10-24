import assert from 'node:assert/strict';
import test from 'node:test';
import { drawIntradayChart } from '../dist/intraday-chart.js';
import { EVENT_COLORS } from '../dist/chart-overlays.js';

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
  const svg=new SvgNode();Object.assign(svg,{id:'eth-events-test',clientWidth:width,clientHeight:height,innerHTML:'',parentElement:{style:{setProperty(){}}}});
  svg.getBoundingClientRect=()=>({left:0,top:0,width,height});return svg;
}
const DAY=86400,start=Date.parse('2022-01-03T00:00:00Z')/1000;
const time=date=>Date.parse(`${date}T00:00:00Z`)/1000;
const candle=(index,seconds=DAY)=>({time:start+index*seconds,date:new Date((start+index*seconds)*1000).toISOString(),open:2000+index%100,high:2040+index%100,low:1980+index%100,close:2020+index%100,volume:100+index%90});
const series=(candles,interval='daily',extra={})=>({interval,source:'Coinbase Exchange',product:'ETH-USD',retrievedAt:'2026-10-24T00:00:00.000Z',candles,gapCount:0,...extra});
const event=(id,date,extra={})=>Object.freeze({id,date,label:`사건 ${id}`,title:`이더리움 사건 ${id}`,category:'protocol',importance:2,...extra});
const ids=svg=>[...svg.innerHTML.matchAll(/data-history-event="([^"]+)"/g)].map(match=>match[1]);
function marker(svg,id){
  const beginning=svg.innerHTML.indexOf(`data-history-event="${id}"`);assert.ok(beginning>=0,`marker ${id} exists`);
  const remainder=svg.innerHTML.slice(beginning),next=remainder.indexOf('data-history-event="',1),body=next<0?remainder:remainder.slice(0,next);
  const point=body.match(/<circle cx="([^"]+)" cy="([^"]+)" r="4"/);assert.ok(point);
  return {body,x:Number(point[1]),y:Number(point[2])};
}
const target=id=>({dataset:{historyEvent:id},closest(selector){return selector.includes('[data-history-event]')?this:null;}});
const key=(value,node,extra={})=>({key:value,target:node,...extra,defaultPrevented:false,stopped:false,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;}});

test('daily event markers stay within observed and visible dates; missing history and future dates cannot acquire a price',()=>{
  const svg=svgFixture(),rows=Array.from({length:10},(_,i)=>candle(i));
  const events=Object.freeze([event('before','2022-01-02'),event('first','2022-01-03'),event('middle','2022-01-07'),event('edge','2022-01-10'),event('last','2022-01-12'),event('after','2022-01-13'),event('future','2050-01-01'),event('invalid','2022-02-30')]);
  drawIntradayChart({svg,series:series(rows),showVolume:false,historicalEvents:events,showHistoricalEvents:true});
  assert.deepEqual(ids(svg),['first','middle','edge','last']);assert.equal(svg.dataset.historyEventCount,'4');
  assert.equal(Number(svg.dataset.historyLabelCount)+Number(svg.dataset.historyHiddenLabelCount),4);
  assert.match(svg.innerHTML,/날짜 기준은 원문 참조 · 위치의 높이는 주변 완료 봉 종가/);
  assert.equal(events[2].title,'이더리움 사건 middle','catalog facts are never changed to create layout hints');
  drawIntradayChart({svg,series:series(rows),range:{start:time('2022-01-05'),end:time('2022-01-10')},showVolume:false,historicalEvents:events,showHistoricalEvents:true});
  assert.deepEqual(ids(svg),['middle','edge']);assert.equal(svg.dataset.historyEventCount,'2');
  assert.doesNotMatch(svg.innerHTML,/NaN|Infinity|forecast/);
});

test('weekly events use their calendar date horizontally and nearby observed close only as their labelled height',()=>{
  const svg=svgFixture(),rows=[candle(0,7*DAY),candle(1,7*DAY),candle(2,7*DAY)];
  const events=[event('inside','2022-01-09'),event('last-week','2022-01-23'),event('unfinished-week','2022-01-24')];
  const range={start:start-7*DAY,end:start+21*DAY};
  const controller=drawIntradayChart({svg,series:series(rows,'weekly',{retrievedAt:'2022-01-24T00:00:00.000Z'}),range,showVolume:false,showHistoricalEvents:true,historicalEvents:events});
  assert.deepEqual(ids(svg),['inside','last-week']);
  const point=marker(svg,'inside'),left=Number(svg.dataset.plotLeft),right=Number(svg.dataset.plotRight);
  assert.ok(Math.abs(point.x-(left+(time('2022-01-09')-range.start)/(range.end-range.start)*(right-left)))<1e-8);
  assert.ok(Math.abs(point.y-controller.getPriceScale().y(rows[1].close))<1e-8);
  assert.match(point.body,/2022-01-10 · 1W/,'the nearby candle date is disclosed, not passed off as an event-time trade');
});

test('intraday intervals suppress day-based events and every redraw clears all historical marker metadata',()=>{
  const svg=svgFixture(),events=[event('shown','2022-01-05')];
  const draw=(extra={})=>drawIntradayChart({svg,series:series(Array.from({length:6},(_,i)=>candle(i))),showVolume:false,showHistoricalEvents:true,historicalEvents:events,...extra});
  draw();assert.equal(svg.dataset.historyEventCount,'1');
  for(const [interval,step]of [['1m',60],['5m',300],['15m',900],['30m',1800],['1h',3600],['4h',14400]]){
    draw({series:series([candle(0,step),candle(1,step)],interval)});
    assert.deepEqual(ids(svg),[]);assert.equal(svg.dataset.historyEventCount,'0');assert.equal(svg.dataset.historyLabelCount,'0');assert.equal(svg.dataset.historyHiddenLabelCount,'0');assert.equal(svg.dataset.historyLabelMode,'off');
  }
  draw();draw({showHistoricalEvents:false});assert.equal(svg.dataset.historyLabelMode,'off');assert.equal(svg.dataset.historyEventCount,'0');
  draw();draw({range:{start:time('2023-01-01'),end:time('2023-02-01')}});
  assert.equal(svg.dataset.historyEventCount,'0');assert.equal(svg.dataset.historyLabelCount,'0');assert.equal(svg.dataset.historyHiddenLabelCount,'0');assert.equal(svg.dataset.historyLabelMode,'off');
});

test('event rendering preserves all underlying candle prices and remains opt-in for existing BTC callers',()=>{
  const rows=Array.from({length:12},(_,i)=>candle(i)),before=structuredClone(rows),svg=svgFixture(),events=[event('one','2022-01-07')];
  drawIntradayChart({svg,series:series(rows),chartType:'line',showVolume:false});
  const plain=svg.innerHTML.match(/class="market-close-line" d="([^"]*)"/)[1];
  const controller=drawIntradayChart({svg,series:series(rows),chartType:'line',showVolume:false,showHistoricalEvents:true,historicalEvents:events});
  assert.equal(svg.innerHTML.match(/class="market-close-line" d="([^"]*)"/)[1],plain);assert.deepEqual(rows,before);
  controller.selectDate(rows[3].date);assert.match(controller.getSelection().copyText,/종가 C: \$2,023/);
  drawIntradayChart({svg,series:series(rows,'daily',{product:'BTC-USD'}),showVolume:false,historicalEvents:events});
  assert.deepEqual(ids(svg),[]);assert.equal(svg.dataset.historyLabelMode,'off');assert.match(svg.innerHTML,/Coinbase Exchange BTC-USD/);
});

test('click and keyboard activate only current rendered events while hover and marker keys preserve price selection',()=>{
  const svg=svgFixture(),calls=[],hovered=[],rows=Array.from({length:8},(_,i)=>candle(i)),events=[event('active','2022-01-06')];
  const controller=drawIntradayChart({svg,series:series(rows),showVolume:false,showHistoricalEvents:true,historicalEvents:events,onHistoricalEvent:id=>calls.push(id),onHover:row=>hovered.push(row)});
  const node=target('active'),selected=controller.getDate(),count=hovered.length;
  svg.onclick({target:node});assert.deepEqual(calls,['active']);assert.equal(controller.getDate(),selected);assert.equal(hovered.length,count);
  svg.onpointermove({target:node,pointerType:'mouse',clientX:300,clientY:200});assert.equal(hovered.length,count);assert.equal(controller.getDate(),selected);
  for(const value of ['Enter',' ']){const e=key(value,node);svg.onkeydown(e);assert.equal(e.defaultPrevented,true);assert.equal(e.stopped,true);}
  assert.deepEqual(calls,['active','active','active']);
  svg.onkeydown(key('Enter',node,{repeat:true}));svg.onkeydown(key('ArrowLeft',node));assert.equal(calls.length,3);assert.equal(controller.getDate(),selected);
  svg.onclick({target:target('stale')});assert.equal(calls.length,3);
  svg.onpointermove({target:svg,pointerType:'mouse',clientX:300,clientY:200});assert.ok(hovered.length>count,'price hover resumes away from the marker');
  assert.equal(svg.onpointerdown,undefined,'the renderer does not install competing pointer capture or gesture handlers');
});

test('adaptive labels keep mobile dots and active selection with explicit category colors; unsafe color values cannot enter markup',()=>{
  const svg=svgFixture(360,520),rows=Array.from({length:1461},(_,i)=>candle(i));
  const events=Array.from({length:45},(_,i)=>event(`event-${i}`,new Date((start+i*30*DAY)*1000).toISOString().slice(0,10),{category:'ecosystem',importance:1+i%3}));
  drawIntradayChart({svg,series:series(rows),chartType:'line',showVolume:false,showHistoricalEvents:true,historicalEvents:events,activeHistoricalEventId:'event-15',historicalEventColors:{ecosystem:'#79c6b6'}});
  assert.equal(svg.dataset.historyEventCount,'45');assert.ok(Number(svg.dataset.historyLabelCount)<45);assert.equal(Number(svg.dataset.historyLabelCount)+Number(svg.dataset.historyHiddenLabelCount),45);
  assert.equal(svg.dataset.historyLabelMode,'overview');assert.match(svg.innerHTML,/class="history-event-marker[^"]*is-active" data-history-event="event-15"/);
  assert.match(marker(svg,'event-15').body,/stroke="#79c6b6"/);
  drawIntradayChart({svg,series:series(rows),showVolume:false,showHistoricalEvents:true,historicalEvents:[events[0]],historicalEventColors:{ecosystem:'#fff" onload="alert(1)'}});
  assert.doesNotMatch(svg.innerHTML,/onload|alert\(1\)/);assert.match(marker(svg,'event-0').body,new RegExp(`stroke="${EVENT_COLORS.market}"`));
});
