import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import path from 'node:path';
const root=process.argv[2]?path.resolve(process.argv[2]):path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const modelPath=path.join(root,'dist/treasury-model.js');
const {buildTreasuryForecast}=await import(pathToFileURL(modelPath));
async function hashes(files){
  return Object.fromEntries(await Promise.all(files.map(async file=>[file,createHash('sha256').update(await readFile(path.join(root,file))).digest('hex')])));
}
const sourceHashes=await hashes(['dist/treasury-model.js','dist/treasury-research.js','dist/treasury-catalog.js']);
const inputHashes=await hashes(['dist/data/mstr-ohlc.json','dist/data/bmnr-ohlc.json','research-data/treasury-mstr.json','research-data/treasury-bmnr.json']);
const maxima={cashUsd:0,coinUnits:0,rewardCashUsd:0,issuanceUsd:0};
function near(a,b,label,scale,field){
  const error=Math.abs(a-b),tolerance=1e-7+64*Number.EPSILON*Math.max(1,scale,Math.abs(a),Math.abs(b));
  maxima[field]=Math.max(maxima[field],error);
  assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&error<=tolerance,`${label}: error ${error}, tolerance ${tolerance}`);
}
let steps=0,financingSteps=0,rewardSaleSteps=0;
const scenarios=[];
for(const symbol of ['MSTR','BMNR']){
  const archive=JSON.parse(await readFile(path.join(root,`dist/data/${symbol.toLowerCase()}-ohlc.json`),'utf8'));
  for(const scenario of ['stress','base','bull']){
    const f=buildTreasuryForecast({symbol,history:archive.candles,scenario,endYear:2050});
    const s=f.assumptions;let active=true,slashed=false;
    for(let i=1;i<f.path.length;i++){
      const p=f.path[i-1],q=f.path[i],a=p.components,b=q.components;
      if(!active){assert.equal(q.price,0);continue;}
      const dt=(Date.parse(q.date)-Date.parse(p.date))/86400000/365.25;
      const years=(Date.parse(q.date)-Date.parse(f.asOf))/86400000/365.25;
      const coinMinted=a.coinUnits*(Math.pow(1+s.stakingFraction*s.stakingGross*(1-s.stakingAdvisoryFee)*(1-s.stakingOtherFee),dt)-1);
      const rewardSold=b.rewardsSold-a.rewardsSold;
      const rewardCash=b.rewardSaleProceeds-a.rewardSaleProceeds;
      const newCapital=b.capitalRaised-a.capitalRaised;
      const sold=b.coinsSold-a.coinsSold;
      let slash=0;
      if(s.slashingLoss&&!slashed&&years>=1){slash=(a.coinUnits+coinMinted-rewardSold)*s.slashingLoss;slashed=true;}
      const coinTerms=[a.coinUnits,coinMinted,-sold,-slash,newCapital*s.investmentFraction/b.coinPrice];
      near(b.coinUnits,coinTerms.reduce((x,y)=>x+y,0),`${symbol}/${scenario}/${q.date} coin conservation`,coinTerms.reduce((x,y)=>x+Math.abs(y),0),'coinUnits');
      near(rewardCash,rewardSold*b.coinPrice*(1-s.saleFee),`${symbol}/${scenario}/${q.date} reward proceeds`,Math.max(b.rewardSaleProceeds,a.rewardSaleProceeds),'rewardCashUsd');
      const expense=(s.financingCarryUsd+s.operatingExpenseUsd)*dt;
      const principal=a.debtUsd-b.debtUsd;
      const newLiability=(b.seniorClaims-b.debtUsd-b.preferredUsd)-(a.seniorClaims-a.debtUsd-a.preferredUsd);
      const cashTerms=[a.cashUsd,rewardCash,newCapital*(1-s.investmentFraction),-expense,-principal,(sold-rewardSold)*b.coinPrice*(1-s.saleFee),newLiability];
      const cashScale=cashTerms.reduce((x,y)=>x+Math.abs(y),0)+(a.capitalRaised+b.capitalRaised)*(1-s.investmentFraction)+(a.coinsSold+b.coinsSold+a.rewardsSold+b.rewardsSold)*b.coinPrice*(1-s.saleFee)+a.seniorClaims+b.seniorClaims+a.debtUsd+b.debtUsd+a.preferredUsd+b.preferredUsd;
      near(b.cashUsd,cashTerms.reduce((x,y)=>x+y,0),`${symbol}/${scenario}/${q.date} cash conservation`,cashScale,'cashUsd');
      assert.ok(b.coinUnits<=s.holdingPolicy.maxCoinUnits);
      if(newCapital>1){
        const preShares=a.shares*Math.pow(1+s.stockCompAnnual,dt);
        const paidShares=b.shares-preShares;
        const preResidual=b.residualUsd-newCapital;
        const reconstructed=paidShares*(preResidual/preShares)*b.premium*(1-s.feeRate);
        near(reconstructed,newCapital,`${symbol}/${scenario}/${q.date} net proceeds`,Math.max(b.capitalRaised,a.capitalRaised),'issuanceUsd');
        financingSteps++;
      }
      if(rewardSold>0)rewardSaleSteps++;
      steps++;
      if(q.price===0)active=false;
    }
    scenarios.push({symbol,scenario,asOf:f.asOf,financialAsOf:f.financialAsOf,pathPoints:f.path.length,cap:s.holdingPolicy.maxCoinUnits,capacityReachedAt:f.diagnostics.capacityReachedAt,endUnits:f.path.at(-1).components.coinUnits,rewardSaleProceeds:f.path.at(-1).components.rewardSaleProceeds});
  }
}
console.log(JSON.stringify({status:'PASS',node:process.version,scope:'Current source and stored observations; independent algebraic flow reconstruction, not predictive validation',sourceHashes,inputHashes,tolerance:'1e-7 + 64 * Number.EPSILON * arithmetic scale, including cumulative balances used in subtraction',steps,financingSteps,rewardSaleSteps,maxAbsoluteErrors:maxima,scenarios},null,2));
