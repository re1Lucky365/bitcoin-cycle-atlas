import assert from 'node:assert/strict';
import test from 'node:test';
import { priceLegendMarkup, priceReadoutKind } from '../dist/price-legend.js';

const attributes=text=>Object.fromEntries([...text.matchAll(/([\w-]+)="([^"]*)"/g)].map(match=>[match[1],match[2]]));
const items=markup=>[...markup.matchAll(/<span class="price-legend-item" title="([^"]*)"><svg\b([^>]*)>([\s\S]*?)<\/svg><span>([^<]*)<\/span><\/span>/g)].map(match=>({title:match[1],svg:attributes(match[2]),sample:match[3],label:match[4]}));
const elements=(item,tag)=>[...item.sample.matchAll(new RegExp(`<${tag}\\b([^>]*)\\/>`,'g'))].map(match=>attributes(match[1]));

test('observed line and candle legends identify their source and completed-price meaning with distinct real SVG samples',()=>{
  const line=items(priceLegendMarkup({source:'Coin Metrics'})),candles=items(priceLegendMarkup({candles:true,source:'Coinbase BTC-USD'}));
  assert.equal(line.length,1);assert.equal(line[0].label,'관측 가격선');assert.match(line[0].title,/Coin Metrics.*관측 종가/);assert.match(line[0].title,/실시간 현재가.*아닙니다/);
  assert.equal(candles.length,1);assert.equal(candles[0].label,'관측 캔들');assert.match(candles[0].title,/Coinbase BTC-USD.*완료된 OHLC/);assert.match(candles[0].title,/실시간 현재가.*아닙니다/);
  const linePaths=elements(line[0],'path');assert.equal(linePaths.length,1);assert.equal(linePaths[0]['stroke-dasharray'],undefined);
  const bodies=elements(candles[0],'rect'),wicks=elements(candles[0],'path');assert.equal(bodies.length,2);assert.equal(wicks.length,2);assert.equal(new Set(bodies.map(body=>body.fill)).size,2);
  assert.ok(bodies.every(body=>Number(body.width)>0&&Number(body.height)>0));assert.deepEqual(new Set(wicks.map(wick=>wick.stroke)),new Set(bodies.map(body=>body.fill)));
});

test('future path and assumption band appear only for forecast geometry and cannot imply a live quote or probability interval',()=>{
  assert.deepEqual(items(priceLegendMarkup({forecast:false,band:true})).map(item=>item.label),['관측 가격선']);
  assert.deepEqual(items(priceLegendMarkup({forecast:true,band:false})).map(item=>item.label),['관측 가격선','미래 가정']);
  const all=items(priceLegendMarkup({forecast:true,band:true,turns:true}));assert.deepEqual(all.map(item=>item.label),['관측 가격선','미래 가정','가정 범위','고점·저점']);
  const observed=elements(all[0],'path')[0],future=elements(all[1],'path')[0];assert.ok(future['stroke-dasharray'].split(/\s+/).every(value=>Number(value)>0));assert.notEqual(future.stroke,observed.stroke);assert.match(all[1].title,/조건부.*실제 거래 가격이 아닙니다/);
  const range=elements(all[2],'rect');assert.equal(range.length,1);assert.ok(Number(range[0].width)>0&&Number(range[0].height)>0);assert.notEqual(range[0].fill,'none');assert.match(all[2].title,/확률구간이 아닙니다/);
  assert.equal(elements(all[3],'ellipse').length,1);assert.match(all[3].title,/관측.*미래 가정/);
});

test('price samples are bounded decorative SVGs while text carries the accessible meaning',()=>{
  for(const candles of [true,false]){
    const markup=priceLegendMarkup({candles,forecast:true,band:true,turns:true});assert.match(markup,/role="group" aria-label="가격 표시 범례"/);
    for(const item of items(markup)){
      assert.equal(item.svg['aria-hidden'],'true');assert.equal(item.svg.focusable,'false');assert.ok(item.label.length>0&&item.title.length>0);
      const viewBox=item.svg.viewBox.split(/\s+/).map(Number);assert.equal(viewBox.length,4);assert.ok(viewBox.every(Number.isFinite));
      assert.ok(Number(item.svg.width)>0&&Number(item.svg.width)<=24);assert.ok(Number(item.svg.height)>0&&Number(item.svg.height)<=24);assert.equal(Number(item.svg.width)/Number(item.svg.height),viewBox[2]/viewBox[3]);
    }
    assert.doesNotMatch(markup,/<button|<a\b|on(?:click|pointer)|D-\d+|scenario-countdown|\$[\d,]+/,'the legend does not contain an action, countdown or changing price quote');
  }
});

test('provider strings cannot inject markup into the legend title',()=>{
  const markup=priceLegendMarkup({source:'Venue "quoted" <script>run()</script> & BTC'}),parsed=items(markup);
  assert.equal(parsed.length,1);assert.doesNotMatch(markup,/<script>|<\/script>/);assert.match(parsed[0].title,/&quot;quoted&quot;/);assert.match(parsed[0].title,/&lt;script&gt;/);assert.match(parsed[0].title,/&amp; BTC/);
});

test('readout kind distinguishes a completed candle close, observed series close, model price and absent data',()=>{
  assert.equal(priceReadoutKind({kind:'observed',price:81567.49,open:82000,high:83000,low:81000,close:81567.49}),'봉 종가');
  assert.equal(priceReadoutKind({kind:'observed',price:81567.49}),'관측 종가');
  for(const open of [undefined,null,NaN,'82000'])assert.equal(priceReadoutKind({kind:'observed',price:81567.49,open}),'관측 종가');
  assert.equal(priceReadoutKind({kind:'simulated',price:95000}),'가정');assert.equal(priceReadoutKind({kind:'simulated',price:95000,open:90000}),'가정','source kind takes precedence over incidental OHLC fields');
  assert.equal(priceReadoutKind({kind:'unavailable',price:NaN}),'자료 없음');assert.equal(priceReadoutKind({kind:'unavailable',open:82000}),'자료 없음');
});
