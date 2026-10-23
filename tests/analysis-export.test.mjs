import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {renderAtlasAnalysis} from '../dist/atlas-analysis.js';
import {renderCryptoConAudit} from '../dist/cryptocon-audit.js';
import {utcDay} from '../dist/cycle-engine.js';

const dataset=JSON.parse(await readFile(new URL('./fixtures/btc-daily-2026-10-20.json',import.meta.url),'utf8'));
const prices=new Map(dataset.prices);
function svgStub(width=290,height=140){const attrs=new Map();return {clientWidth:width,clientHeight:height,innerHTML:'',setAttribute:(key,value)=>attrs.set(key,String(value)),getAttribute:key=>attrs.get(key)||null,getBoundingClientRect:()=>({left:0,top:0,width,height})};}

test('every analysis redraw reapplies presentation on its true layer and keeps numeric axis labels separately addressable',()=>{
  const variants=[{mode:'cycles'},{mode:'duration'},{mode:'phases',phaseLeg:'bull'},{mode:'phases',phaseLeg:'bear'},{mode:'periods',period:'monthly'},{mode:'periods',period:'quarterly',metric:'discoveryDays'},{mode:'peaks'},...['timing','thresholds','targets'].map(view=>({mode:'cryptocon',view}))];
  for(const variant of variants){
    const svg=svgStub();let called=0;
    const presentation=node=>{assert.strictEqual(node,svg);assert.match(node.innerHTML,/data-indicator-axis-label/);assert.equal(node.getAttribute('data-indicator-layer'),variant.mode==='phases'?'duration':variant.mode);called++;};
    const controller=variant.mode==='cryptocon'?renderCryptoConAudit({svg,dataset,...variant,presentation}):renderAtlasAnalysis({svg,dataset,...variant,presentation});
    assert.equal(called,1);controller.previous();assert.equal(called,2,`${variant.mode} internal navigation must preserve presentation`);assert.ok(!/NaN|Infinity/.test(svg.innerHTML));
    const data=controller.exportData();assert.equal(data.kind,'analysis');assert.ok(data.rows.length>0);assert.ok(data.columns.length>0);assert.ok(data.source.includes('Coin Metrics'));assert.ok(data.unit);assert.ok(data.note);
    for(const column of data.columns)assert.ok(data.rows.some(row=>Object.hasOwn(row,column.key)),`${data.id}.${column.key}`);
  }
});

test('cycle and peak exports retain exact observed USD prices and distinguish their independent normalization bases',()=>{
  for(const mode of ['cycles','peaks']){
    const data=renderAtlasAnalysis({svg:svgStub(),dataset,mode,alignment:'halving'}).exportData();
    assert.match(data.note,/독립 경과일 축/);
    for(const row of data.rows){
      assert.equal(row.priceUsd,prices.get(row.date));
      if(mode==='cycles'){assert.equal(row.elapsedDays,utcDay(row.date)-utcDay(row.startDate));assert.equal(row.startIndex,row.priceUsd/row.startPriceUsd*100);}
      else{assert.equal(row.elapsedDays,utcDay(row.date)-utcDay(row.halvingDate));assert.equal(row.peakPercent,row.priceUsd/row.peakPriceUsd*100);}
    }
  }
});

test('period export contains only the current actual page, named units and incomplete-period flags',()=>{
  const controller=renderAtlasAnalysis({svg:svgStub(),dataset,mode:'periods',period:'monthly',metric:'realizedVolPct',scope:'recent'}),current=controller.exportData();
  assert.equal(current.rows.length,48);assert.match(current.unit,/realizedVolPct: %/);assert.match(current.note,/realizedVolPct/);assert.equal(current.rows.at(-1).complete,false);
  controller.selectDate('2012-01-01');const earlier=controller.exportData();assert.equal(earlier.rows.length,48);assert.notEqual(earlier.rows[0].period,current.rows[0].period);assert.ok(earlier.rows.some(row=>row.period==='2012-01'));
  for(const row of earlier.rows){assert.ok(row.observations<=row.expectedDays);assert.equal(typeof row.complete,'boolean');}
});

test('CryptoCon export preserves claim timing, explicit missing deadlines and source evidence separately from measured prices',()=>{
  const timing=renderCryptoConAudit({svg:svgStub(),dataset,view:'timing'}).exportData();
  assert.ok(timing.rows.some(row=>row.kind==='retrospective'));assert.ok(timing.columns.some(column=>column.key==='evidence'));assert.ok(timing.columns.some(column=>column.key==='url'));
  for(const row of timing.rows)assert.equal(row.peakPriceUsd,prices.get(row.peakDate));
  const targets=renderCryptoConAudit({svg:svgStub(),dataset,view:'targets'}).exportData();
  assert.ok(targets.rows.some(row=>row.deadline===null));assert.match(targets.note,/2026-10-20/);
  for(const row of targets.rows){assert.equal(row.peakPriceUsd,prices.get(row.peakDate));assert.equal(row.gapPct,(row.peakPriceUsd/row.target-1)*100);}
});
