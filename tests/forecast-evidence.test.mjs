import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {bitcoinForecastEvidence} from '../dist/forecast-evidence.js';
import {buildLongHorizonForecast} from '../dist/long-horizon-forecast.js';
import {getResearchArticle} from '../dist/research-reader.js';
import {drawAtlasPriceChart} from '../dist/atlas-price-chart.js';

const model=()=>({asOf:'2026-10-23',path:[
  {date:'2026-10-22',price:99},{date:'2026-10-23',price:100},
  {date:'2027-01-20',price:110},{date:'2027-01-21',price:112},
  {date:'2027-12-31',price:125},{date:'2030-12-31',price:150},{date:'2050-12-31',price:180},
],events:[
  {id:'source-2030',date:'2030-12-31',sourceId:'wisdomtree-2030',price:275000,isPublishedSourcePrice:true,valuationOrigin:'published-economic-case'},
  {id:'stress-2050',date:'2050-12-31',sourceId:'wisdomtree-2050',price:30,isPublishedSourcePrice:false,valuationOrigin:'analyst-derived'},
]});

test('a near-horizon method marker appears before 2030 without inventing a market catalyst',()=>{
  const entries=bitcoinForecastEvidence(model()),first=entries[0];
  assert.equal(first.id,'btc-forecast-method');
  assert.equal(first.date,'2027-01-21');
  assert.ok(first.date<'2030-01-01');
  assert.deepEqual(first.sourceIds,['btc-model-method']);
  assert.match(first.description,/시장 사건의 예정일이 아닙니다/);
  assert.equal(first.price,112,'a provenance marker must sit on the existing model path');
});

test('published price sources and analyst-derived stress cases open distinct first evidence',()=>{
  const source=model(),entries=bitcoinForecastEvidence(source);
  const published=entries.find(row=>row.id==='btc-evidence-source-2030');
  const derived=entries.find(row=>row.id==='btc-evidence-stress-2050');
  assert.deepEqual(published.sourceIds,['long-wisdomtree-2030','btc-model-method']);
  assert.deepEqual(derived.sourceIds,['btc-model-method','long-wisdomtree-2050']);
  assert.match(published.description,/발행사 가치평가 조건과 앱 경로는 다릅니다/);
  assert.match(derived.description,/파생·스트레스 가정/);
  assert.equal(published.price,150);
  assert.notEqual(published.price,source.events[0].price,'published valuation must not overwrite the representative path');
  assert.equal(derived.price,180);
});

test('markers never move into observed history or manufacture a missing model date',()=>{
  const source=model();
  source.events.push(...[
    {id:'past',date:'2026-10-22'},{id:'cutoff',date:source.asOf},{id:'missing',date:'2031-12-31'},
  ].map(event=>({...event,sourceId:'wisdomtree-2030',isPublishedSourcePrice:true})));
  const before=JSON.stringify(source),entries=bitcoinForecastEvidence(source);
  assert.ok(entries.every(row=>row.date>source.asOf));
  assert.ok(entries.every(row=>source.path.some(point=>point.date===row.date&&point.price===row.price)));
  assert.ok(!entries.some(row=>/past|cutoff|missing/.test(row.id)));
  assert.equal(JSON.stringify(source),before,'evidence extraction must not mutate the forecast');
  assert.deepEqual(bitcoinForecastEvidence(null),[]);
  assert.deepEqual(bitcoinForecastEvidence({path:[]}),[]);
});

test('actual BTC base and stress forecasts resolve every source and preserve source-price attribution',async()=>{
  const history=JSON.parse(await readFile(new URL('./fixtures/btc-daily-2026-10-20.json',import.meta.url),'utf8'));
  for(const scenario of ['base','stress']){
    const forecast=buildLongHorizonForecast(history,{sampleCount:16,scenario});
    const points=new Map(forecast.path.map(point=>[point.date,point.price]));
    const entries=bitcoinForecastEvidence(forecast);
    assert.equal(entries.length,forecast.events.length+1);
    assert.ok(entries[0].date<'2030-01-01');
    for(const marker of entries){
      assert.ok(marker.date>forecast.asOf);
      assert.equal(marker.price,points.get(marker.date));
      for(const id of marker.sourceIds)assert.ok(getResearchArticle(id),`unresolved ${scenario} marker source ${id}`);
    }
    for(const event of forecast.events){
      const marker=entries.find(row=>row.id===`btc-evidence-${event.id}`);
      assert.equal(marker.sourceIds[0],event.valuationOrigin==='analyst-derived'?'btc-model-method':`long-${event.sourceId}`);
    }
  }
});

// Exercise deterministic SVG output and installed callbacks. Native browser
// focus/geometry are covered by the parent's browser smoke pass.
class SvgNode{
  constructor(){this.attrs=new Map();this.nodes=new Map();this.dataset={};this.textContent='';}
  setAttribute(key,value){this.attrs.set(key,String(value));}
  removeAttribute(key){this.attrs.delete(key);}
  getAttribute(key){return this.attrs.get(key);}
  querySelector(selector){if(!this.nodes.has(selector))this.nodes.set(selector,new SvgNode());return this.nodes.get(selector);}
  querySelectorAll(){return [];}
  focus(){}
}
const fixture=(width=900)=>{
  const svg=new SvgNode();
  Object.assign(svg,{id:'btc-evidence-test',clientWidth:width,clientHeight:500,innerHTML:'',parentElement:{style:{setProperty(){}}}});
  svg.getBoundingClientRect=()=>({left:0,top:0,width,height:500});
  return svg;
};
const chartOptions=(svg,changes={})=>{
  const source=model();
  return {svg,rows:source.path,start:source.asOf,end:'2027-12-31',split:source.asOf,forecastEvidence:bitcoinForecastEvidence(source),showDrawdown:false,showHistoricalEvents:false,showCycleMarkers:false,showTurns:false,...changes};
};

test('desktop and mobile near-horizon views display the method source before the 2030 target',()=>{
  for(const width of [390,1100]){
    const svg=fixture(width);drawAtlasPriceChart(chartOptions(svg));
    assert.equal(svg.dataset.forecastEvidenceCount,'1');
    assert.match(svg.innerHTML,/data-forecast-evidence="btc-forecast-method" role="button" tabindex="0"/);
    assert.doesNotMatch(svg.innerHTML,/data-forecast-evidence="btc-evidence-source-2030"/);
    assert.doesNotMatch(svg.innerHTML,/NaN|Infinity/);
  }
});

test('BTC evidence marker click, Enter and Space select its research without chart key leakage',()=>{
  const svg=fixture(),calls=[];
  drawAtlasPriceChart(chartOptions(svg,{onForecastEvidence:id=>calls.push(id)}));
  const target={dataset:{forecastEvidence:'btc-forecast-method'},closest(selector){return selector.includes('[data-forecast-evidence]')?this:null;}};
  svg.onclick({target});
  let prevented=0,stopped=0;
  for(const key of ['Enter',' '])svg.onkeydown({key,target,preventDefault(){prevented++;},stopPropagation(){stopped++;}});
  assert.deepEqual(calls,['btc-forecast-method','btc-forecast-method','btc-forecast-method']);
  assert.equal(prevented,2);assert.equal(stopped,2);
});

test('the renderer excludes markers at the price cutoff and outside the active viewport',()=>{
  const svg=fixture(),source=model(),valid=bitcoinForecastEvidence(source)[0];
  drawAtlasPriceChart(chartOptions(svg,{forecastEvidence:[
    {...valid,id:'at-cutoff',date:source.asOf,price:100},
    {...valid,id:'observed',date:'2026-10-22',price:99},valid,
    {...valid,id:'outside-view',date:'2030-12-31',price:150},
  ]}));
  assert.equal(svg.dataset.forecastEvidenceCount,'1');
  assert.match(svg.innerHTML,/data-forecast-evidence="btc-forecast-method"/);
  assert.doesNotMatch(svg.innerHTML,/data-forecast-evidence="(?:at-cutoff|observed|outside-view)"/);
});
