import assert from 'node:assert/strict';
import test from 'node:test';
import {drawIntradayChart} from '../dist/intraday-chart.js';
import {equityForecastRows,equityForecastWindowRows} from '../dist/equity-forecast-chart.js';
const time=value=>Date.parse(`${value}T00:00:00Z`)/1000;
class SvgNode{constructor(){this.attrs=new Map();this.nodes=new Map();this.dataset={};this.textContent='';}setAttribute(k,v){this.attrs.set(k,String(v));}removeAttribute(k){this.attrs.delete(k);}getAttribute(k){return this.attrs.get(k);}querySelector(k){if(!this.nodes.has(k))this.nodes.set(k,new SvgNode());return this.nodes.get(k);}querySelectorAll(){return [];}focus(){}}
const svgFixture=(width=1100)=>{const svg=new SvgNode();Object.assign(svg,{id:'equity-test',clientWidth:width,clientHeight:520,innerHTML:'',parentElement:{style:{setProperty(){}}}});svg.getBoundingClientRect=()=>({left:0,top:0,width,height:520});return svg;};
const series={assetClass:'equity',symbol:'MSTR',product:'MSTR',source:'Yahoo Finance',interval:'daily',retrievedAt:'2026-10-24T08:00:00Z',snapshot:true,candles:['2026-10-16','2026-10-19','2026-10-20','2026-10-21','2026-10-22','2026-10-23'].map((date,i)=>({time:time(date),date:`${date}T00:00:00Z`,open:99+i,high:102+i,low:98+i,close:100+i,volume:1000}))};
const forecast={path:[{date:'2026-11-23',price:120,low:95,high:145,sourceIds:['filing']},{date:'2026-12-23',price:130,low:90,high:170,sourceIds:['filing']}],milestones:[{id:'capital',date:'2026-11-23',title:'자본구조 가정',description:'주식 수와 청구권',sourceIds:['filing']}]};

test('observed equity candles and conditional lines share a scale without synthetic forecast candles',()=>{
  for(const width of [320,1100]){
    const svg=svgFixture(width);let hovered;
    const controller=drawIntradayChart({svg,series,chartType:'candles',showVolume:false,forecast,range:{start:time('2026-10-01'),end:time('2027-01-01')},onHover:value=>{hovered=value;}});
    assert.equal(svg.dataset.observedCandleCount,'6');assert.equal(svg.dataset.forecastPointCount,'2');assert.equal((svg.innerHTML.match(/class="market-candle"/g)||[]).length,6);assert.match(svg.innerHTML,/class="equity-forecast-line"/);assert.match(svg.innerHTML,/class="equity-forecast-band"/);assert.doesNotMatch(svg.innerHTML,/NaN|Infinity/);
    assert.equal(hovered.kind,'observed');assert.equal(hovered.close,105,'initial quote is the latest real session');
    controller.selectDate('2026-11-23');assert.equal(hovered.kind,'forecast');assert.equal(hovered.price,120);assert.equal(hovered.completed,false);assert.equal(hovered.open,undefined);assert.equal(hovered.volume,undefined);assert.match(controller.getSelection().copyText,/조건부 미래 가정/);
    controller.selectDate('2026-10-19');assert.equal(hovered.kind,'observed');assert.equal(hovered.volumeUnit,'주');assert.match(controller.getSelection().copyText,/뉴욕 세션/);
  }
});

test('a future-only viewport renders and selects model values with no historical candle substitution',()=>{
  const svg=svgFixture(390);let hovered;
  const controller=drawIntradayChart({svg,series,chartType:'candles',showVolume:false,forecast,range:{start:time('2026-11-01'),end:time('2027-01-01')},onHover:value=>{hovered=value;}});
  assert.equal(svg.dataset.observedCandleCount,'0');assert.equal(svg.dataset.forecastPointCount,'2');assert.doesNotMatch(svg.innerHTML,/class="market-candle"/);assert.match(svg.innerHTML,/equity-forecast-line/);assert.equal(hovered.kind,'forecast');controller.selectDate('2026-12-23');assert.equal(hovered.price,130);
});

test('forecast evidence clicks and keyboard activate only displayed markers',()=>{
  const svg=svgFixture(),calls=[];drawIntradayChart({svg,series,showVolume:false,forecast,range:{start:time('2026-10-01'),end:time('2027-01-01')},onForecastEvidence:id=>calls.push(id)});
  const target=id=>({dataset:{forecastEvidence:id},closest(selector){return selector.includes('[data-forecast-evidence]')?this:null;}});
  svg.onclick({target:target('capital')});svg.onclick({target:target('stale')});assert.deepEqual(calls,['capital']);
  svg.onkeydown({key:'Enter',target:target('capital'),preventDefault(){},stopPropagation(){}});assert.deepEqual(calls,['capital','capital']);
});

test('equity line connects actual Friday to Monday observations without inventing weekend records',()=>{
  const svg=svgFixture();drawIntradayChart({svg,series,chartType:'line',showVolume:false});const path=svg.innerHTML.match(/class="market-close-line" d="([^"]*)"/)[1];assert.equal((path.match(/M/g)||[]).length,1);assert.equal(svg.dataset.observedCandleCount,'6');assert.equal(svg.dataset.forecastPointCount,'0');
});

test('malformed scenario intervals cannot silently enter the chart',()=>{
  assert.throws(()=>equityForecastRows({path:[{date:'2027-01-01',price:100,low:110,high:130}]},time('2026-10-23')),/Invalid equity forecast/);
  assert.throws(()=>equityForecastRows({path:[...forecast.path].reverse()},time('2026-10-23')),/Invalid equity forecast/);
  for(const date of ['2027-02-30','2027-01-01extra','not-a-date'])assert.throws(()=>equityForecastRows({path:[{date,price:100,low:90,high:110}]},time('2026-10-23')),/Invalid equity forecast/);
});

test('zooming between monthly scenario calculations preserves the future line and labelled interpolation',()=>{
  for(const scale of ['linear','log']){
    const svg=svgFixture(390);let hovered;
    const controller=drawIntradayChart({svg,series,scale,chartType:'candles',showVolume:false,forecast,range:{start:time('2026-11-28'),end:time('2026-12-08')},onHover:value=>{hovered=value;}});
    assert.match(svg.innerHTML,/class="equity-forecast-line"/);
    assert.doesNotMatch(svg.innerHTML,/class="market-candle"|NaN|Infinity/);
    assert.equal(svg.dataset.observedCandleCount,'0');
    controller.selectDate('2026-11-28');
    const expected=scale==='log'?Math.exp(Math.log(120)+(Math.log(130)-Math.log(120))/6):120+10/6;
    assert.ok(Math.abs(hovered.price-expected)<1e-9);
    assert.equal(hovered.kind,'forecast');assert.equal(hovered.interpolated,true);
    assert.equal(hovered.open,undefined);assert.equal(hovered.volume,undefined);
    assert.match(controller.getSelection().copyText,/보간/);
  }
});

test('a weekly candle start never relabels the observed forecast anchor as a future point',()=>{
  const anchored={...forecast,asOf:'2026-10-23',path:[{date:'2026-10-23',price:105,low:105,high:105},...forecast.path]};
  const svg=svgFixture();let hovered;
  const weekly={...series,interval:'weekly',candles:[{...series.candles.at(-1),time:time('2026-10-19'),date:'2026-10-19T00:00:00Z'}]};
  drawIntradayChart({svg,series:weekly,chartType:'candles',showVolume:false,forecast:anchored,range:{start:time('2026-10-01'),end:time('2026-10-23')},onHover:value=>{hovered=value;}});
  assert.equal(hovered.kind,'observed');assert.equal(svg.dataset.forecastPointCount,'0');
});

test('zero residuals stay zero in readouts and never become positive log-axis prices',()=>{
  const zeroForecast={...forecast,path:[{date:'2026-11-23',price:0,low:0,high:145,sourceIds:['filing']},{date:'2026-12-23',price:0,low:0,high:170,sourceIds:['filing']}]};
  for(const scale of ['log','linear']){
    const svg=svgFixture(390);let hovered;
    const controller=drawIntradayChart({svg,series,scale,showVolume:false,forecast:zeroForecast,range:{start:time('2026-11-01'),end:time('2027-01-01')},onHover:value=>{hovered=value;}});
    assert.match(svg.innerHTML,/가정 가격 0 · 잔여가치 소진/);assert.doesNotMatch(svg.innerHTML,/NaN|Infinity/);controller.selectDate('2026-12-23');assert.equal(hovered.price,0);assert.equal(hovered.kind,'forecast');assert.equal(hovered.open,undefined);
    if(scale==='log')assert.equal(svg.querySelector('[id$="-cross"]').querySelector('circle').getAttribute('visibility'),'hidden');
    else assert.equal(controller.getPriceScale().min,0);
  }
});

test('a viewport between zero-valued calculation dates preserves the zero warning',()=>{
  const zeroForecast={...forecast,path:forecast.path.map(row=>({...row,price:0,low:0}))};
  const svg=svgFixture(390);let hovered;
  drawIntradayChart({svg,series,scale:'log',showVolume:false,forecast:zeroForecast,range:{start:time('2026-11-28'),end:time('2026-12-08')},onHover:value=>{hovered=value;}});
  assert.equal(hovered.price,0);assert.equal(hovered.interpolated,true);
  assert.match(svg.innerHTML,/data-zero-bound="true"/);assert.match(svg.innerHTML,/가정 가격 0 · 잔여가치 소진/);
  assert.doesNotMatch(svg.innerHTML,/NaN|Infinity/);
});

test('a positive-to-zero price transition explains log unavailability and stays available on a linear axis',()=>{
  const boundaryForecast={...forecast,path:[forecast.path[0],{...forecast.path[1],price:0,low:0}]};
  for(const scale of ['log','linear']){
    const svg=svgFixture(390);let hovered;
    drawIntradayChart({svg,series,scale,showVolume:false,forecast:boundaryForecast,range:{start:time('2026-11-28'),end:time('2026-12-08')},onHover:value=>{hovered=value;}});
    if(scale==='log'){
      assert.equal(hovered.kind,'unavailable');assert.equal(svg.dataset.forecastLogGapCount,'1');
      assert.match(svg.innerHTML,/로그 연결 불가/);assert.match(svg.innerHTML,/선형축에서 확인/);
      assert.doesNotMatch(svg.innerHTML,/완료된 거래 봉이 없습니다/);
    }else{
      assert.equal(hovered.kind,'forecast');assert.ok(hovered.price>0&&hovered.price<120);assert.equal(svg.dataset.forecastLogGapCount,'0');
    }
    assert.doesNotMatch(svg.innerHTML,/NaN|Infinity/);
  }
});

test('a zero-crossing lower bound is not shown as early depletion or fabricated logarithmic interpolation',()=>{
  const boundaryForecast={...forecast,path:[forecast.path[0],{...forecast.path[1],low:0}]};
  const svg=svgFixture(390);let hovered;
  const controller=drawIntradayChart({svg,series,scale:'log',showVolume:false,forecast:boundaryForecast,range:{start:time('2026-11-28'),end:time('2026-12-08')},onHover:value=>{hovered=value;}});
  controller.selectDate('2026-11-28');
  assert.ok(hovered.price>120&&hovered.price<130);assert.equal(hovered.low,null);assert.deepEqual(hovered.interpolation.unavailableBounds,['low']);
  assert.match(svg.innerHTML,/equity-forecast-line/);assert.match(svg.innerHTML,/0 경계 구간 · 로그 연결 생략/);
  assert.doesNotMatch(svg.innerHTML,/equity-forecast-band|잔여가치 소진/);
  assert.match(controller.getSelection().copyText,/로그축 0 경계 · 선형축에서 확인/);
  assert.doesNotMatch(controller.getSelection().copyText,/\$0/);
});

test('display interpolation never extrapolates before the observed anchor or beyond the forecast path',()=>{
  const anchor=series.candles.at(-1),points=equityForecastRows(forecast,anchor.time);
  assert.deepEqual(equityForecastWindowRows(points,anchor,time('2026-10-01'),time('2026-10-22')),[]);
  assert.deepEqual(equityForecastWindowRows(points,anchor,time('2027-01-01'),time('2027-01-15')),[]);
});
