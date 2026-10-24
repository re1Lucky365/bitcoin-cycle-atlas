import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTreasuryForecasts} from '../dist/treasury-model.js';
import {equityPayload,equityViewFixture} from './helpers/equity-view-fixture.mjs';

function projection({symbol,history}){
  const asOf='2026-10-23',endDate='2035-12-31',asset=symbol==='MSTR'?'BTC':'ETH';
  const first=Date.parse(asOf),days=(Date.parse(endDate)-first)/86400000+1;
  const snapshot={coin:asset,asOf:'2026-06-30',publishedAt:'2026-08-01',coinUnits:1_000_000,cashUsd:1_000_000_000,otherAssetsUsd:0,debtUsd:1_000_000_000,preferredUsd:0,otherLiabilitiesUsd:0,nonControllingInterestUsd:0,shares:100_000_000,annualExpensesUsd:0,sourceIds:['test-filing'],notes:[]};
  const assetPaths={asset,asOf,endDate,metadata:{seed:7},warnings:[],scenarios:Object.fromEntries(['stress','base','bull'].map(id=>[id,{
    id,asset,asOf,endDate,method:'test-shock-and-recovery',sourceIds:['test-input'],anchors:[],training:{maxSourceDate:asOf},
    path:Array.from({length:days},(_,index)=>({date:new Date(first+index*86400000).toISOString().slice(0,10),price:id==='stress'&&index===1?0.01:2000,kind:index?'simulation':'anchor',sourceIds:['test-input']})),
  }]))};
  return {forecasts:buildTreasuryForecasts({symbol,history,snapshot,coinAnchor:{date:asOf,price:2000},assetPaths,endYear:2035})};
}

for(const symbol of ['MSTR','BMNR'])test(`${symbol} evidence distinguishes a recovered residual from absorbed valuation`,async()=>{
  const view=await equityViewFixture(symbol,{query:'&treasury-scenario=stress',project:projection});
  view.reply(0,equityPayload(symbol,1));await view.microtasks();
  view.reply(1,{revision:1});await view.settle();await view.initialization;
  const stressed=view.latest().forecast,point=stressed.path.at(-1);
  assert.equal(point.price,0);
  assert.equal(point.valuationState,'absorbed');
  assert.equal(point.components.insolvent,false);
  assert.ok(point.components.residualUsd>0,'the UI must explain the seemingly conflicting positive residual');
  const markup=view.forecastDialog();
  assert.match(markup,/<dt>평가 상태<\/dt><dd>잔여가치 소진 후 0 유지<\/dd>/);
  assert.match(markup,/재구조화·주주 회복을 모델링하지 않습니다/);
  assert.ok(markup.includes(stressed.formula),'the displayed formula comes from the actual financial model');
  view.scenario('base');await view.settle();
  assert.equal(view.latest().forecast.path.at(-1).valuationState,'active');
  const active=view.forecastDialog();
  assert.match(active,/<dt>평가 상태<\/dt><dd>정상 평가 상태<\/dd>/);
  assert.doesNotMatch(active,/이 조건은 잔여가치 소진 뒤/);
});
