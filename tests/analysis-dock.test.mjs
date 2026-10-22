import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {ANALYSIS_MODES,readAnalysisDockState,writeAnalysisDockState,analysisCalendarDate,shouldPublishInspection,analysisSelectionSummary,dockHeight} from '../dist/analysis-dock.js';
import {renderAtlasAnalysis} from '../dist/atlas-analysis.js';
import {renderCryptoConAudit} from '../dist/cryptocon-audit.js';

const dataset=JSON.parse(await readFile(new URL('./fixtures/btc-daily-2026-10-20.json',import.meta.url),'utf8'));

test('legacy graph links select an analysis dock while a fresh price page starts collapsed',()=>{
  assert.deepEqual(readAnalysisDockState(''),{mode:'cycles',open:false});
  for(const {id} of ANALYSIS_MODES)assert.deepEqual(readAnalysisDockState(`?chart=${id}&granularity=1h&type=candles`),{mode:id,open:true});
  assert.deepEqual(readAnalysisDockState('?page=compare'),{mode:'cycles',open:true});
  assert.deepEqual(readAnalysisDockState('?page=compare&chart=price'),{mode:'cycles',open:false});
  assert.deepEqual(readAnalysisDockState('?page=compare&legacy=1'),{mode:'cycles',open:false});
  assert.deepEqual(readAnalysisDockState('?chart=periods&dock=closed'),{mode:'periods',open:false});
  assert.deepEqual(readAnalysisDockState('?analysis=timing'),{mode:'cycles',open:false});
});

test('selected and collapsed dock states round-trip without changing price or legacy analysis parameters',()=>{
  for(const {id} of ANALYSIS_MODES)for(const open of [false,true]){
    const params=new URLSearchParams('granularity=1h&type=candles&axis=linear&analysis=timing&span=near');
    writeAnalysisDockState(params,{mode:id,open});
    assert.deepEqual(readAnalysisDockState(params),{mode:id,open});
    assert.equal(params.get('granularity'),'1h');assert.equal(params.get('type'),'candles');assert.equal(params.get('axis'),'linear');assert.equal(params.get('analysis'),'timing');assert.equal(params.get('span'),'near');
  }
  const params=new URLSearchParams('chart=price&dock=closed');writeAnalysisDockState(params,{mode:'cycles',open:false});assert.equal(params.size,0);
  assert.throws(()=>writeAnalysisDockState(new URLSearchParams(),{mode:'price',open:true}),TypeError);
});

test('calendar linking rejects elapsed axes, timestamps, impossible days and unobserved dates',()=>{
  const coverage={firstDate:'2010-07-18',lastDate:'2026-10-20'};
  for(const date of [null,undefined,'1461','시작 후 100일','2025-01-01T00:00:00Z','2025-02-29','2009-01-03','2027-01-01'])assert.equal(analysisCalendarDate({date},coverage),null);
  assert.equal(analysisCalendarDate({date:'2024-02-29'},coverage),'2024-02-29');
  assert.equal(analysisCalendarDate({date:'2026-10-20'},coverage),'2026-10-20');
});

test('automatic render and resize inspections cannot switch ownership of the selected price or analysis',()=>{
  for(const currentOwner of ['price','analysis'])for(const owner of ['price','analysis']){
    assert.equal(shouldPublishInspection({owner,currentOwner,user:false}),owner===currentOwner);
    assert.equal(shouldPublishInspection({owner,currentOwner,user:true}),true);
  }
});

test('expanded analysis leaves at least half the canvas region available for the price chart',()=>{
  for(const availableHeight of [180,250,360,500,700,1000,1600]){
    const expanded=dockHeight({availableHeight,open:true});assert.ok(expanded<=availableHeight/2);assert.ok(expanded<=340);assert.ok(expanded>=40);
    assert.equal(dockHeight({availableHeight,open:false}),40);
  }
});

function svgStub(width,height){
  const attrs={};return {clientWidth:width,clientHeight:height,innerHTML:'',setAttribute(key,value){attrs[key]=value;},getAttribute(key){return attrs[key];},getBoundingClientRect(){return {left:0,top:0,width,height};}};
}

test('monthly and quarterly selection summaries name and show the selected metric instead of always showing returns',()=>{
  const metricFields={returnPct:'기간 수익률',maxDrawdownPct:'기간 중 최대 하락',realizedVolPct:'가격 흔들림 · 연간 환산',discoveryDays:'새 최고가를 기록한 날'};
  for(const period of ['monthly','quarterly'])for(const [metric,label] of Object.entries(metricFields)){
    let detail;
    renderAtlasAnalysis({svg:svgStub(660,180),dataset,mode:'periods',period,metric,onInspect:value=>{detail=value;}});
    const field=detail.fields.find(item=>item.label===label);
    assert.ok(field,`${period} ${metric} must expose its selected metric`);
    assert.equal(analysisSelectionSummary(detail,{mode:'periods',metric}),`${detail.label} · ${label} ${field.value}`);
    if(metric!=='returnPct')assert.notEqual(analysisSelectionSummary(detail,{mode:'periods',metric}),`${detail.label} · ${detail.fields[0].value}`);
  }
});

test('all five dock analyses and their subviews render and navigate at compact panel sizes',()=>{
  const definitions=[
    ...['trough','calendar','halving'].map(alignment=>({mode:'cycles',alignment})),
    {mode:'duration'},...['bull','bear'].map(phaseLeg=>({mode:'phases',phaseLeg})),{mode:'peaks'},
    ...['monthly','quarterly'].flatMap(period=>['returnPct','maxDrawdownPct','realizedVolPct','discoveryDays'].map(metric=>({mode:'periods',period,metric,scope:'recent'}))),
    {mode:'periods',period:'monthly',metric:'returnPct',scope:'all'},
    ...['timing','thresholds','targets'].map(view=>({mode:'cryptocon',view}))
  ];
  for(const [width,height] of [[330,170],[660,180],[1200,220]])for(const definition of definitions){
    const svg=svgStub(width,height),inspections=[];
    const render=definition.mode==='cryptocon'?renderCryptoConAudit:renderAtlasAnalysis;
    const c=render({svg,dataset,...definition,onInspect:detail=>inspections.push(detail)});
    assert.equal(svg.getAttribute('viewBox'),`0 0 ${width} ${height}`);
    assert.ok(!/NaN|Infinity/.test(svg.innerHTML),`${definition.mode} has invalid SVG geometry`);
    assert.ok(c.title&&c.caption&&c.note&&c.legend.length);
    assert.equal(inspections.length,1,'the existing renderer emits an automatic initial inspection');
    assert.equal(shouldPublishInspection({owner:'analysis',currentOwner:'price'}),false,'initial analysis cannot replace the price inspector');
    c.previous();c.next();svg.onkeydown({key:'Home',preventDefault(){}});svg.onclick({clientX:width/2,clientY:height/2});
    assert.ok(inspections.length>=5);
    for(const detail of inspections){assert.ok(detail.label);assert.ok(Array.isArray(detail.fields));if(definition.mode==='cycles')assert.equal(detail.date,null);}
    if(definition.mode==='cycles')assert.equal(analysisCalendarDate(inspections.at(-1)),null);
  }
});
