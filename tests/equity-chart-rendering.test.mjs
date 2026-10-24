import assert from 'node:assert/strict';
import test from 'node:test';
import {drawIntradayChart} from '../dist/intraday-chart.js';
import {equityForecastRows,equityForecastWindowRows} from '../dist/equity-forecast-chart.js';
const time=value=>Date.parse(`${value}T00:00:00Z`)/1000;
class SvgNode{constructor(){this.attrs=new Map();this.nodes=new Map();this.dataset={};this.textContent='';}setAttribute(k,v){this.attrs.set(k,String(v));}removeAttribute(k){this.attrs.delete(k);}getAttribute(k){return this.attrs.get(k);}querySelector(k){if(!this.nodes.has(k))this.nodes.set(k,new SvgNode());return this.nodes.get(k);}querySelectorAll(){return [];}focus(){}}
const svgFixture=(width=1100)=>{const svg=new SvgNode();Object.assign(svg,{id:'equity-test',clientWidth:width,clientHeight:520,innerHTML:'',parentElement:{style:{setProperty(){}}}});svg.getBoundingClientRect=()=>({left:0,top:0,width,height:520});return svg;};
const series={assetClass:'equity',symbol:'MSTR',product:'MSTR',source:'Yahoo Finance',interval:'daily',retrievedAt:'2026-10-24T08:00:00Z',snapshot:true,candles:['2026-10-16','2026-10-19','2026-10-20','2026-10-21','2026-10-22','2026-10-23'].map((date,i)=>({time:time(date),date:`${date}T00:00:00Z`,open:99+i,high:102+i,low:98+i,close:100+i,volume:1000}))};
const forecast={path:[{date:'2026-11-23',price:120,low:95,high:145,sourceIds:['filing']},{date:'2026-12-23',price:130,low:90,high:170,sourceIds:['filing']}],milestones:[{id:'capital',date:'2026-11-23',title:'자본구조 가정',description:'주식 수와 청구권',sourceIds:['filing']}]};
const linkedValues=[103,110,90,160,70,120,80,130,100,115,95,150,125];
const linkedForecast={asOf:'2026-10-21',pathMode:'asset-linked-daily',path:linkedValues.map((price,index)=>({date:new Date((time('2026-10-21')+index*86400)*1000).toISOString().slice(0,10),price,low:price-60,high:price+80,sourceIds:['filing','asset-path']})),milestones:[]};
const linkedSeries=(interval='daily')=>({...series,interval,candles:interval==='daily'?series.candles.filter(row=>row.time<=time(linkedForecast.asOf)):[{time:time('2026-10-19'),date:'2026-10-19T00:00:00Z',open:100,high:106,low:99,close:103,volume:3000}]});

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

test('linked daily and partial-week bars keep the observed boundary on narrow and wide viewports',()=>{
  for(const interval of ['daily','weekly'])for(const width of [320,1100]){
    const svg=svgFixture(width),observed=linkedSeries(interval);let hovered;
    const controller=drawIntradayChart({svg,series:observed,forecast:linkedForecast,chartType:'candles',showVolume:false,range:{start:time('2026-10-16'),end:time('2026-11-02')},onHover:value=>{hovered=value;}});
    assert.equal(svg.dataset.observedCandleCount,String(observed.candles.length));
    assert.equal(svg.dataset.forecastCandleCount,interval==='daily'?'8':'3');
    assert.equal(hovered.kind,'observed');
    controller.selectDate(linkedForecast.asOf);
    assert.equal(hovered.kind,'observed','the last observed session remains observed inside a partial weekly bar');
    assert.equal(hovered.close,103);
    const simulatedTimes=[...svg.innerHTML.matchAll(/class="equity-forecast-candle" data-time="(\d+)"/g)].map(match=>Number(match[1]));
    assert.ok(simulatedTimes.every(value=>value>time(linkedForecast.asOf)));
    controller.selectDate('2026-10-22');
    assert.equal(hovered.kind,'forecast');
    assert.equal(hovered.price,interval==='daily'?110:90);
    assert.equal(hovered.completed,false);
    assert.equal(hovered.open,undefined);
    assert.equal(hovered.volume,undefined);
    assert.equal(hovered.candle.startDate,linkedForecast.asOf);
    assert.doesNotMatch(svg.innerHTML,/NaN|Infinity/);
  }
});

test('future-only daily and weekly path bars expose selected-path extrema separately from condition bounds',()=>{
  for(const interval of ['daily','weekly']){
    const svg=svgFixture(320);let hovered;
    const controller=drawIntradayChart({svg,series:linkedSeries(interval),forecast:linkedForecast,chartType:'candles',showVolume:false,range:{start:time('2026-10-22'),end:time('2026-11-02')},onHover:value=>{hovered=value;}});
    assert.equal(svg.dataset.observedCandleCount,'0');
    assert.doesNotMatch(svg.innerHTML,/class="market-candle"/);
    assert.match(svg.innerHTML,/class="equity-forecast-candles"/);
    assert.equal(hovered.kind,'forecast');
    controller.selectDate('2026-10-26');
    const expectedClose=interval==='daily'?120:115;
    assert.equal(hovered.price,expectedClose);
    assert.deepEqual([hovered.candle.open,hovered.candle.high,hovered.candle.low,hovered.candle.close],[90,160,70,expectedClose]);
    assert.deepEqual([hovered.low,hovered.high],[expectedClose-60,expectedClose+80]);
    assert.equal(hovered.candle.startDate,'2026-10-23');
    assert.equal(hovered.candle.endDate,interval==='daily'?'2026-10-26':'2026-10-30');
    assert.equal(hovered.valuationDate,hovered.candle.endDate);
    const copy=controller.getSelection().copyText;
    assert.match(copy,/모의 경로봉/);assert.match(copy,/경로 최고 H: \$160/);assert.match(copy,/경로 최저 L: \$70/);
    assert.ok(copy.includes(`세 조건 범위 · 끝값 기준: $${expectedClose-60} – $${expectedClose+80}`));
    assert.match(copy,/체결량을 예측한 OHLC가 아닙니다/);
  }
});

test('linked line display retains weekend valuations without inventing weekend observed candles',()=>{
  const before=structuredClone(linkedForecast),svg=svgFixture(390);let hovered;
  const controller=drawIntradayChart({svg,series:linkedSeries(),forecast:linkedForecast,chartType:'line',showVolume:false,range:{start:time('2026-10-22'),end:time('2026-11-02')},onHover:value=>{hovered=value;}});
  assert.equal(svg.dataset.forecastCandleCount,'0');
  assert.match(svg.innerHTML,/class="equity-forecast-line"/);
  assert.doesNotMatch(svg.innerHTML,/class="equity-forecast-candle"|class="market-candle"/);
  controller.selectDate('2026-10-24');
  assert.equal(hovered.price,160);assert.equal(hovered.kind,'forecast');
  assert.equal(hovered.candle,undefined);assert.equal(hovered.open,undefined);assert.equal(hovered.volume,undefined);
  assert.deepEqual(linkedForecast,before);
});

test('dense linked path bars batch SVG nodes while preserving source intervals and exact selections',()=>{
  const prices=Array.from({length:4201},(_,index)=>103+(index*17)%37);
  const dense={...linkedForecast,path:prices.map((price,index)=>({date:new Date((time(linkedForecast.asOf)+index*86400)*1000).toISOString().slice(0,10),price,low:price-60,high:price+80,sourceIds:['filing','asset-path']}))};
  const sourceBefore=structuredClone(dense),weekdayIndices=prices.map((_,index)=>index).filter(index=>index>0&&![0,6].includes(new Date((time(dense.asOf)+index*86400)*1000).getUTCDay()));
  for(const width of [320,1280]){
    const svg=svgFixture(width);let hovered;
    const controller=drawIntradayChart({svg,series:linkedSeries(),forecast:dense,chartType:'candles',showVolume:false,range:{start:time(dense.asOf),end:time(dense.path.at(-1).date)},onHover:value=>{hovered=value;}});
    assert.match(svg.innerHTML,/class="equity-forecast-candles" data-count="\d+" data-rendering="batched"/);
    assert.equal(svg.dataset.forecastCandleCount,String(weekdayIndices.length));
    const elements=(svg.innerHTML.match(/<[a-z][\w-]*(?=[\s>])/g)||[]).length;
    assert.ok(elements<140,`${width}px: ${elements} SVG nodes for ${weekdayIndices.length} forecast bars`);
    for(const position of [0,Math.floor(weekdayIndices.length/2),weekdayIndices.length-1]){
      const index=weekdayIndices[position],previous=position?weekdayIndices[position-1]:0,values=prices.slice(previous,index+1);
      controller.selectDate(dense.path[index].date);
      assert.equal(hovered.price,prices[index]);
      assert.deepEqual([hovered.candle.open,hovered.candle.high,hovered.candle.low,hovered.candle.close],[prices[previous],Math.max(...values),Math.min(...values),prices[index]]);
      assert.equal(hovered.candle.startDate,dense.path[previous].date);
      assert.equal(hovered.candle.endDate,dense.path[index].date);
      assert.deepEqual([hovered.low,hovered.high],[prices[index]-60,prices[index]+80]);
    }
    assert.doesNotMatch(svg.innerHTML,/NaN|Infinity/);
  }
  assert.deepEqual(dense,sourceBefore);
});

test('hover, copying and magnet measurements preserve linked prices and label model-derived anchors',()=>{
  for(const scale of ['linear','log']){
    const sourceBefore=structuredClone(linkedForecast),svg=svgFixture(390),range={start:time('2026-10-22'),end:time('2026-11-02')};let hovered,measurement;
    const controller=drawIntradayChart({svg,series:linkedSeries(),forecast:linkedForecast,chartType:'candles',scale,showVolume:false,range,tool:'measure',magnet:'strong',onHover:value=>{hovered=value;},onMeasurement:value=>{measurement=value;}});
    controller.selectDate('2026-10-26');
    const copyBefore=controller.getSelection().copyText,axis=controller.getPriceScale();
    const pointer=(date,price)=>({clientX:axis.left+(time(date)-range.start)/(range.end-range.start)*(axis.right-axis.left),clientY:axis.y(price),pointerType:'mouse',target:svg});
    assert.equal(controller.previewPointer(pointer('2026-10-26',160)),true);
    assert.equal(svg.querySelector('.chart-snap-feedback').dataset.field,'H');
    assert.equal(svg.querySelector('.chart-snap-feedback').dataset.price,'160');
    assert.equal(hovered.price,120);
    assert.equal(hovered.candle.high,160);
    assert.equal(controller.getSelection().copyText,copyBefore);
    svg.onclick(pointer('2026-10-26',160));
    svg.onclick(pointer('2026-11-02',95));
    assert.deepEqual([measurement.startPrice,measurement.startField,measurement.endPrice,measurement.endField],[160,'H',95,'L']);
    assert.equal(hovered.price,125);
    assert.match(svg.querySelector('.chart-measurement').getAttribute('aria-label'),/가정 포함/);
    controller.selectDate('2026-10-26');
    assert.equal(controller.getSelection().copyText,copyBefore);
    assert.deepEqual(linkedForecast,sourceBefore);
  }
});

test('zero-valued linked bars retain zero in readouts and are not drawn as positive logarithmic candles',()=>{
  const zero={...linkedForecast,path:linkedForecast.path.map((row,index)=>index<3?row:{...row,price:0,low:0,high:40})};
  for(const scale of ['log','linear']){
    const svg=svgFixture(390);let hovered;
    const controller=drawIntradayChart({svg,series:linkedSeries(),forecast:zero,chartType:'candles',scale,showVolume:false,range:{start:time('2026-10-26'),end:time('2026-11-02')},onHover:value=>{hovered=value;}});
    controller.selectDate('2026-10-26');
    assert.equal(hovered.price,0);assert.equal(hovered.candle.close,0);assert.equal(hovered.candle.low,0);
    assert.match(svg.innerHTML,/가정 가격 0 · 잔여가치 소진/);
    assert.match(controller.getSelection().copyText,/시나리오 가격: \$0/);
    assert.match(controller.getSelection().copyText,/끝값 C: \$0/);
    assert.doesNotMatch(svg.innerHTML,/NaN|Infinity/);
    if(scale==='log'){
      assert.doesNotMatch(svg.innerHTML,/class="equity-forecast-candle"/);
      assert.equal(svg.querySelector('[id$="-cross"]').querySelector('circle').getAttribute('visibility'),'hidden');
    }else{
      assert.match(svg.innerHTML,/class="equity-forecast-candle"/);
      assert.equal(controller.getPriceScale().min,0);
    }
  }
});

test('a zero condition lower bound cannot zero or suppress a positive selected-path candle',()=>{
  const bounded={...linkedForecast,path:linkedForecast.path.map(row=>({...row,low:0}))},svg=svgFixture(320);let hovered;
  const controller=drawIntradayChart({svg,series:linkedSeries(),forecast:bounded,chartType:'candles',scale:'log',showVolume:false,range:{start:time('2026-10-22'),end:time('2026-11-02')},onHover:value=>{hovered=value;}});
  assert.equal((svg.innerHTML.match(/class="equity-forecast-candle"/g)||[]).length,8);
  assert.match(svg.innerHTML,/범위 하한 0 · 잔여가치 소진/);
  assert.doesNotMatch(svg.innerHTML,/가정 가격 0|NaN|Infinity/);
  controller.selectDate('2026-10-26');
  assert.equal(hovered.price,120);assert.equal(hovered.low,0);assert.equal(hovered.candle.low,70);
  assert.notEqual(svg.querySelector('[id$="-cross"]').querySelector('circle').getAttribute('visibility'),'hidden');
});
