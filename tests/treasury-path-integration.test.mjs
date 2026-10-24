import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTreasuryForecast,buildTreasuryForecasts} from '../dist/treasury-model.js';

const DAY=86400000;
const asOf='2026-10-23';
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<=1e-7+64*Number.EPSILON*Math.max(Math.abs(actual),Math.abs(expected)),`${actual} != ${expected}`);
const snapshot=(changes={})=>({coin:'BTC',asOf:'2026-06-30',publishedAt:'2026-08-01',coinUnits:1_000_000,cashUsd:200_000_000,otherAssetsUsd:0,debtUsd:0,preferredUsd:0,otherLiabilitiesUsd:0,nonControllingInterestUsd:0,shares:100_000_000,annualExpensesUsd:0,sourceIds:['test-disclosure'],notes:[],...changes});
function assetPaths({asset='BTC',endYear=2027,prices={},trainingDate=asOf}={}){
  const endDate=`${endYear}-12-31`,first=Date.parse(`${asOf}T00:00:00Z`),count=(Date.parse(`${endDate}T00:00:00Z`)-first)/DAY+1;
  return {asset,asOf,endDate,metadata:{seed:7,ohlcClaim:false},warnings:['Test fixture, not market observations.'],scenarios:Object.fromEntries(['stress','base','bull'].map(id=>[id,{id,asset,asOf,endDate,method:'deterministic-fixture',sourceIds:['test-asset-path'],anchors:[],training:{maxSourceDate:trainingDate},path:Array.from({length:count},(_,index)=>({date:new Date(first+index*DAY).toISOString().slice(0,10),price:index===0?2000:prices[id]?.(index,count)??2000,kind:index?'simulation':'anchor',sourceIds:['test-asset-path']}))}]))};
}
const options=(changes={})=>({symbol:'MSTR',history:[{date:asOf,close:22}],snapshot:snapshot(),coinAnchor:{date:asOf,price:2000},endYear:2027,assetPaths:assetPaths(),...changes});

test('one bundled calculation exposes three daily paths and the selection wrapper agrees',()=>{
  const input=options(),all=buildTreasuryForecasts(input);
  assert.deepEqual(Object.keys(all),['stress','base','bull']);
  for(const id of Object.keys(all)){
    const result=all[id];
    assert.equal(result.pathMode,'asset-linked-daily');
    assert.equal(result.path.length,input.assetPaths.scenarios[id].path.length);
    assert.equal(result.path[0].date,asOf);
    near(result.path[0].price,22);
    assert.equal(result.path.at(-1).date,'2027-12-31');
    assert.equal(result.diagnostics.accountingFrequency,'calendar-day');
    assert.equal(result.diagnostics.currentNavClaim,false);
    assert.equal(result.diagnostics.predictiveValidation,'not-established');
    assert.equal(result.assetPath.training.maxSourceDate,asOf);
    assert.equal(result.assetPath.path,undefined,'do not duplicate the full crypto path in every result');
    assert.deepEqual(buildTreasuryForecast({...input,scenario:id}),result);
  }
});

test('the supplied daily asset values reach the financial model unchanged',()=>{
  const input=options({assetPaths:assetPaths({prices:{stress:i=>2000*(1+0.3*Math.sin(i/9)),base:i=>2000*(1+0.25*Math.sin(i/7)),bull:i=>2000*(1+0.4*Math.sin(i/11))}})});
  const all=buildTreasuryForecasts(input);
  for(const id of Object.keys(all))for(let index=0;index<all[id].path.length;index++){
    assert.equal(all[id].path[index].components.coinPrice,input.assetPaths.scenarios[id].path[index].price);
    assert.ok(all[id].path[index].sourceIds.includes('test-asset-path'));
  }
  const prices=all.base.path.map(row=>row.price);
  assert.ok(prices.some((price,index)=>index>0&&price<prices[index-1]));
  assert.ok(prices.some((price,index)=>index>0&&price>prices[index-1]));
});

test('condition envelopes come from complete financial trajectories at the same date',()=>{
  const input=options({snapshot:snapshot({cashUsd:0}),assetPaths:assetPaths({prices:{stress:()=>1,base:()=>2000,bull:()=>3000}})});
  const all=buildTreasuryForecasts(input);
  assert.ok(all.stress.diagnostics.insolventAt);
  assert.ok(all.base.path.at(-1).price>0);
  for(let index=0;index<all.base.path.length;index++){
    const prices=Object.values(all).map(result=>result.path[index].price);
    for(const result of Object.values(all)){
      assert.equal(result.path[index].low,Math.min(...prices));
      assert.equal(result.path[index].high,Math.max(...prices));
      assert.equal(result.path[index].probability,null);
    }
  }
  assert.equal(all.base.path.at(-1).low,0,'the stress case can be zero without zeroing the selected base case');
});

test('cash costs accrue on weekends and a Sunday debt maturity is paid exactly once',()=>{
  const input=options({snapshot:snapshot({debtUsd:50_000_000,annualExpensesUsd:365_250,debtSchedule:[{date:'2026-10-25',principalUsd:50_000_000}]})});
  const path=buildTreasuryForecasts(input).stress.path;
  const dailyCost=(50_000_000+365_250)/365.25;
  assert.deepEqual(path.slice(0,4).map(row=>row.date),['2026-10-23','2026-10-24','2026-10-25','2026-10-26']);
  near(path[1].components.cashUsd,200_000_000-dailyCost);
  near(path[1].components.debtUsd,50_000_000);
  near(path[2].components.cashUsd,200_000_000-2*dailyCost-50_000_000);
  near(path[2].components.debtUsd,0);
  near(path[3].components.cashUsd,path[2].components.cashUsd-dailyCost);
  near(path[3].components.otherLiabilitiesUsd,0);
});

test('the same terminal crypto price can produce different capital and equity outcomes',()=>{
  const common=options({symbol:'BMNR',history:[{date:asOf,close:280}],snapshot:snapshot({coin:'ETH',coinUnits:6_000_000,cashUsd:2_000_000_000})});
  const run=(first,second)=>buildTreasuryForecast({...common,scenario:'bull',assetPaths:assetPaths({asset:'ETH',prices:{bull:(index,count)=>index===count-1?2000:index<80?first:second}})}).path.at(-1);
  const lowFirst=run(1200,3000),highFirst=run(3000,1200);
  assert.equal(lowFirst.components.coinPrice,highFirst.components.coinPrice);
  assert.notEqual(lowFirst.components.capitalRaised,highFirst.components.capitalRaised);
  assert.notEqual(lowFirst.components.shares,highFirst.components.shares);
  assert.notEqual(lowFirst.price,highFirst.price);
});

test('daily staking above a full treasury cap becomes cash after sale costs',()=>{
  const initial=snapshot({coin:'ETH',coinUnits:6_105_000,cashUsd:1_000_000_000_000});
  const result=buildTreasuryForecast({...options(),symbol:'BMNR',snapshot:initial,assetPaths:assetPaths({asset:'ETH'}),scenario:'base'});
  const last=result.path.at(-1).components,elapsed=(Date.parse(result.displayEnd)-Date.parse(result.asOf))/DAY/365.25;
  near(last.coinUnits,6_105_000);
  near(last.capitalRaised,0);
  near(last.rewardSaleProceeds,last.rewardsSold*2000*0.995);
  const expectedCash=initial.cashUsd+last.rewardSaleProceeds-50_000_000*elapsed;
  const accumulatedRoundoff=4*Number.EPSILON*result.path.length*Math.max(initial.cashUsd,expectedCash);
  assert.ok(Math.abs(last.cashUsd-expectedCash)<=accumulatedRoundoff);
  assert.ok(result.path.every(point=>point.components.coinUnits<=6_105_000));
});

test('exhausted daily residual is absorbing even if the asset price later recovers',()=>{
  const result=buildTreasuryForecast({...options(),snapshot:snapshot({cashUsd:0}),scenario:'stress',assetPaths:assetPaths({prices:{stress:index=>index<10?0.01:100_000}})});
  const index=result.path.findIndex(row=>row.price===0);
  assert.ok(index>0);
  assert.ok(result.path.slice(index).every(row=>row.price===0));
  assert.ok(result.milestones.some(row=>row.kind==='simulated-insolvency'&&row.date===result.diagnostics.insolventAt));
});

test('absorbed valuation is explicit when frozen balances regain positive accounting residual',()=>{
  const initial=snapshot({cashUsd:1_000_000_000,debtUsd:1_000_000_000});
  const result=buildTreasuryForecast({...options(),snapshot:initial,scenario:'stress',assetPaths:assetPaths({prices:{stress:index=>index===1?0.1:2000}})});
  const [anchor,exhausted,recovered]=result.path;
  assert.equal(anchor.valuationState,'active');
  assert.equal(exhausted.components.insolvent,true);
  assert.equal(exhausted.valuationState,'absorbed');
  assert.ok(recovered.components.residualUsd>0);
  assert.equal(recovered.components.insolvent,false,'accounting insolvency remains a current-balance property');
  assert.equal(recovered.valuationState,'absorbed');
  assert.equal(recovered.price,0,'an accounting recovery does not revoke the chosen absorption convention');
  assert.ok(result.path.slice(1).every(point=>point.valuationState==='absorbed'&&point.price===0));
  for(const key of ['coinUnits','cashUsd','shares','debtUsd','otherLiabilitiesUsd'])assert.equal(recovered.components[key],exhausted.components[key],key);
  assert.match(result.formula,/흡수 상태.*0/);
});

test('future turns are identified within the simulated path with separate confirmation dates',()=>{
  const result=buildTreasuryForecast({...options(),assetPaths:assetPaths({prices:{base:index=>2000*(1+0.35*Math.sin(index/12))}})});
  const turns=result.milestones.filter(row=>row.kind==='simulated-turn');
  assert.ok(turns.some(row=>row.turnType==='high'));
  assert.ok(turns.some(row=>row.turnType==='low'));
  for(const row of turns){
    assert.ok(row.title.startsWith('모의'));
    assert.ok(row.confirmationDate>row.date);
    assert.equal(row.probability,null);
    assert.equal(row.price,result.path.find(point=>point.date===row.date).price);
    assert.ok(row.sourceIds.includes('test-asset-path'));
  }
});

test('longer display horizons do not alter the shared daily financial prefix',()=>{
  const prices={base:index=>2000*(1+0.2*Math.sin(index/14))};
  const short=buildTreasuryForecast({...options(),assetPaths:assetPaths({prices})});
  const long=buildTreasuryForecast({...options(),endYear:2028,assetPaths:assetPaths({prices,endYear:2028})});
  assert.deepEqual(long.path.slice(0,short.path.length),short.path);
});

test('target interpolation remains an explicitly named comparison mode',()=>{
  const input=options();delete input.assetPaths;
  const result=buildTreasuryForecast(input);
  assert.equal(result.pathMode,'target-interpolation');
  assert.equal(result.assetPath,null);
  assert.equal(result.diagnostics.accountingFrequency,'target-and-30-day-knots');
  assert.ok(result.path.length<30);
});

test('asset-linked paths require a coin observation on the equity anchor date',()=>{
  const input=options({history:[{date:'2026-10-26',close:22}]});
  input.assetPaths.asOf='2026-10-26';
  for(const scenario of Object.values(input.assetPaths.scenarios)){
    scenario.asOf='2026-10-26';
    scenario.training.maxSourceDate='2026-10-26';
    scenario.path.splice(0,3);
  }
  assert.throws(()=>buildTreasuryForecast(input),/coin anchor date/);
  assert.doesNotThrow(()=>buildTreasuryForecast({...input,coinAnchor:{date:'2026-10-26',price:2000}}));
  delete input.assetPaths;
  assert.doesNotThrow(()=>buildTreasuryForecast(input),'the explicit legacy comparison keeps its previous stale-anchor policy');
});

test('asset bundles reject wrong assets, dates, horizons, scenario names and missing provenance',()=>{
  const corruptions=[
    bundle=>{bundle.asset='ETH';},
    bundle=>{bundle.asOf='2026-10-22';},
    bundle=>{bundle.endDate='2028-12-31';},
    bundle=>{bundle.scenarios.base.id='bull';},
    bundle=>{delete bundle.scenarios.stress;},
    bundle=>{bundle.scenarios.extra=bundle.scenarios.base;},
    bundle=>{bundle.scenarios.base.method='';},
    bundle=>{bundle.scenarios.base.sourceIds=[];},
    bundle=>{bundle.scenarios.base.training.maxSourceDate='2026-10-24';},
    bundle=>{bundle.scenarios.base.anchors=[{date:'2026-02-30',price:2000}];},
  ];
  for(const corrupt of corruptions){const input=options();corrupt(input.assetPaths);assert.throws(()=>buildTreasuryForecast(input));}
});

test('all asset path rows are validated before any selected scenario is returned',()=>{
  const corruptions=[
    path=>{path[0].price=1999;},
    path=>{path[10].price=NaN;},
    path=>{path[10].price=0;},
    path=>{path[10].price=Infinity;},
    path=>{path[10].date=path[9].date;},
    path=>{path[10].date='2026-02-30';},
    path=>{delete path[10];},
    path=>{path.pop();},
    path=>{path.push({...path.at(-1),date:'2028-01-01'});},
    path=>{path[10].baselinePrice=-1;},
  ];
  for(const corrupt of corruptions){const input=options();corrupt(input.assetPaths.scenarios.stress.path);assert.throws(()=>buildTreasuryForecast({...input,scenario:'base'}));}
});

test('forecast construction preserves source inputs and has no circular output references',()=>{
  const input=options(),before=structuredClone(input);
  const outputs=buildTreasuryForecasts(input);
  assert.deepEqual(input,before);
  assert.doesNotThrow(()=>JSON.stringify(outputs));
  for(const result of Object.values(outputs))for(const point of result.path){
    for(const key of ['coinUnits','cashUsd','otherAssetsUsd','debtUsd','preferredUsd','otherLiabilitiesUsd','nonControllingInterestUsd','shares'])assert.ok(Number.isFinite(point.components[key])&&point.components[key]>=0,key);
  }
});
