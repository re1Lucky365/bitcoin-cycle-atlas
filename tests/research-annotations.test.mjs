import test from 'node:test';
import assert from 'node:assert/strict';
import {createResearchAnnotation,changeResearchAnnotations,normalizeResearchAnnotations,researchAnnotationSummary,researchAnnotationsMarkup,readResearchAnnotations,writeResearchAnnotations,researchCoordinateDate,MAX_RESEARCH_ANNOTATIONS} from '../dist/research-annotations.js';

const rows=[{date:'2026-10-01',price:100},{date:'2026-10-03',price:130},{date:'2026-10-04',price:110}];
const measurement={startDate:'2026-10-01',startPrice:100,startField:'C',startKind:'observed',endDate:'2026-10-04',endPrice:110,endField:'C',endKind:'observed'};
const create=(extra={})=>createResearchAnnotation(measurement,{rows,frequency:'weekly',asOf:'2026-10-04',id:'research-1',now:'2026-10-23T00:00:00Z',...extra});

test('saved anchors retain raw USD, source and calendar elapsed separately from actual loaded rows',()=>{
  const saved=create();assert.equal(saved.start.price,100);assert.equal(saved.end.price,110);assert.equal(saved.start.source,'Coin Metrics');assert.equal(saved.start.interval,'daily');assert.equal(saved.start.basis,'market');
  const result=researchAnnotationSummary(saved);assert.equal(result.deltaDays,3);assert.equal(result.loadedBars,3);assert.equal(result.changePct,10);assert.equal(result.includesConditional,false);
  assert.equal(saved.capture.interval,'weekly','chart interval is distinct from source sample interval');
  assert.deepEqual(rows,[{date:'2026-10-01',price:100},{date:'2026-10-03',price:130},{date:'2026-10-04',price:110}]);
});

test('multiple measurements, exact edit, lock, hide and delete are independent reversible commands',()=>{
  let state=changeResearchAnnotations(null,{type:'add',annotation:create()});state=changeResearchAnnotations(state,{type:'add',annotation:create({id:'research-2'})});assert.equal(state.items.length,2);assert.equal(state.selectedId,'research-2');
  state=changeResearchAnnotations(state,{type:'update',id:'research-1',patch:{note:'Exact raw USD memo',start:{date:'2026-10-02',price:101.123456789}}});
  const edited=state.items[0];assert.equal(edited.start.price,101.123456789);assert.equal(edited.start.date,'2026-10-02');assert.equal(edited.start.basis,'custom');assert.equal(edited.capture.loadedBars,null);assert.equal(edited.capture.coordinatesEdited,true);
  state=changeResearchAnnotations(state,{type:'toggle-lock',id:'research-1'});assert.throws(()=>changeResearchAnnotations(state,{type:'delete',id:'research-1'}),/잠금/);assert.throws(()=>changeResearchAnnotations(state,{type:'update',id:'research-1',patch:{note:'bad'}}),/잠금/);
  state=changeResearchAnnotations(state,{type:'toggle-hidden',id:'research-1'});assert.equal(state.items[0].hidden,true);assert.equal(state.items[0].note,'Exact raw USD memo');
  state=changeResearchAnnotations(state,{type:'toggle-lock',id:'research-1'});state=changeResearchAnnotations(state,{type:'delete',id:'research-1'});assert.equal(state.items.length,1);assert.equal(state.items[0].id,'research-2');
});

test('observed and conditional anchors are explicit and saved scenario coordinates survive a scenario change',()=>{
  const saved=createResearchAnnotation({...measurement,endDate:'2027-10-01',endPrice:200,endKind:'simulated'},{rows,asOf:'2026-10-04',scenarioId:'base',scenarioLabel:'기준',id:'future-1'});
  assert.equal(saved.start.kind,'observed');assert.equal(saved.end.kind,'conditional');assert.equal(saved.capture.loadedBars,null);
  const markup=researchAnnotationsMarkup({annotations:[saved],x:row=>Date.parse(row.date)/86400000-20727,y:price=>300-price,left:0,right:500,top:0,bottom:300,clipId:'price',activeId:saved.id,scenarioId:'stress'});
  assert.equal(markup.visibleCount,1);assert.match(markup.markup,/is-saved-scenario/);assert.match(markup.markup,/저장 당시 다른 가정/);assert.match(markup.markup,/data-end-price="200"/);assert.match(markup.markup,/clip-path="url\(#price\)"/);assert.match(markup.markup,/aria-pressed="true"/);
  assert.equal(saved.end.price,200);
});

test('saved annotation geometry projects exact coordinates and clips only SVG drawing, not endpoint meaning',()=>{
  const saved=create();const render=y=>researchAnnotationsMarkup({annotations:[saved],x:row=>row.date==='2026-10-01'?-40:440,y,left:20,right:400,top:10,bottom:250,clipId:'manual'});
  const first=render(price=>price*2);assert.equal(first.items[0].x1,-40);assert.equal(first.items[0].x2,440);assert.equal(first.items[0].y1,200);assert.match(first.markup,/data-start-date="2026-10-01"/);assert.match(first.markup,/stroke-width="10" pointer-events="stroke"/);
  const second=render(price=>Math.log(price)*25);assert.equal(second.items[0].x1,-40);assert.equal(second.items[0].x2,440);assert.equal(saved.start.price,100);
  assert.equal(researchAnnotationsMarkup({annotations:[{...saved,hidden:true}],x:()=>10,y:()=>20,left:0,right:400,top:0,bottom:250,clipId:'p'}).visibleCount,0);
});

test('bounded persistence rejects corrupt dates/prices and survives storage denial',()=>{
  const saved=create(),state=normalizeResearchAnnotations({items:[saved,saved,{...saved,id:'bad',start:{date:'2026-02-30',price:1}}],selectedId:'bad'});assert.equal(state.items.length,1);assert.equal(state.selectedId,null);
  assert.equal(researchCoordinateDate('2026-02-30'),null);assert.equal(researchCoordinateDate('2026-10-21T12:00:00+09:00'),null);assert.equal(researchCoordinateDate(Date.parse('2026-10-21T12:00:00Z')/1000),'2026-10-21T12:00:00.000Z');
  assert.equal(normalizeResearchAnnotations(Array.from({length:110},(_,i)=>({...saved,id:`a-${i}`}))).items.length,MAX_RESEARCH_ANNOTATIONS);
  const denied={getItem(){throw new Error('denied');},setItem(){throw new Error('denied');}};assert.equal(readResearchAnnotations(denied).items.length,0);const result=writeResearchAnnotations(state,denied);assert.equal(result.saved,false);assert.equal(result.state.items.length,1);assert.match(result.error,/현재 탭/);
  let stored='';const storage={getItem:()=>stored,setItem:(_key,value)=>{stored=value;}};assert.equal(writeResearchAnnotations(state,storage).saved,true);assert.deepEqual(readResearchAnnotations(storage),state);
});

test('unfinished measurement and invalid edits never create fabricated anchors',()=>{
  assert.throws(()=>createResearchAnnotation({...measurement,endDate:null}),/두 점/);
  const state=changeResearchAnnotations(null,{type:'add',annotation:create()});for(const price of [0,-1,Infinity,NaN])assert.throws(()=>changeResearchAnnotations(state,{type:'update',id:'research-1',patch:{end:{price}}}),/USD/);
  assert.equal(state.items[0].end.price,110);
});

test('completed intraday anchors use the Coinbase source even when the daily model cutoff is older',()=>{
  const candles=[{date:'2026-10-23T12:00:00.000Z',time:1792756800,open:100,high:120,low:90,close:110,volume:1},{date:'2026-10-23T12:05:00.000Z',time:1792757100,open:110,high:140,low:100,close:130,volume:1}];
  const item=createResearchAnnotation({startDate:candles[0].date,startPrice:120,startField:'H',startKind:'observed',endDate:candles[1].date,endPrice:130,endField:'C',endKind:'observed'},{candles,candleSource:'Coinbase Exchange',frequency:'5m',asOf:'2026-10-21',id:'intraday-1'});
  assert.equal(item.start.kind,'observed');assert.equal(item.start.source,'Coinbase Exchange');assert.equal(item.start.interval,'5m');assert.equal(item.start.basis,'market');assert.equal(researchAnnotationSummary(item).deltaSeconds,300);assert.equal(item.capture.loadedBars,2);
});

test('Coin Metrics line coordinates are never attributed to concurrently loaded Bitstamp candles',()=>{
  const candles=rows.map(row=>({...row,time:Date.parse(row.date)/1000,open:90,high:150,low:80,close:row.price+1,volume:1}));
  const item=create({candles,candleSource:'Bitstamp',source:'Coin Metrics',chartType:'line'});assert.equal(item.start.source,'Coin Metrics');assert.equal(item.start.basis,'market');assert.equal(item.end.source,'Coin Metrics');assert.equal(item.capture.loadedBars,3);
  const candleItem=createResearchAnnotation({...measurement,startPrice:101,endPrice:111},{rows,candles,candleSource:'Bitstamp',source:'Bitstamp',chartType:'candles',frequency:'daily',asOf:'2026-10-04',id:'candle-source'});assert.equal(candleItem.start.source,'Bitstamp');assert.equal(candleItem.start.basis,'market');
});
