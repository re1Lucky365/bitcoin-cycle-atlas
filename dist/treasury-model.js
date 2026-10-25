import { TREASURY_SNAPSHOTS, TREASURY_MARKET_ANCHORS, TREASURY_FUTURE_EVENTS, TREASURY_TARGETS } from './treasury-research.js?v=1.19.0';
import { detectDirectionalChanges } from "./market-structure.js?v=1.23.0";

const DAY = 86400000, YEAR = 365.25;
const day = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new TypeError('Expected an ISO calendar date');
  const result = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(result) || new Date(result).toISOString().slice(0,10) !== value) throw new RangeError('Invalid calendar date');
  return result / DAY;
};
const date = value => new Date(value * DAY).toISOString().slice(0,10);
const nonnegative = (value, name) => { if (!Number.isFinite(value) || value < 0) throw new RangeError(`${name} must be finite and nonnegative`); return value; };
const positive = (value, name) => { nonnegative(value,name); if (!value) throw new RangeError(`${name} must be positive`); return value; };
const BALANCES = ['coinUnits','cashUsd','otherAssetsUsd','debtUsd','preferredUsd','otherLiabilitiesUsd','nonControllingInterestUsd'];
const HOLDING_POLICIES = Object.freeze({
  MSTR: {maxCoinUnits:21_000_000,kind:'protocol-terminal-supply-ceiling',sourceIds:['mstr-bitcoin-supply-limit'],label:'BTC 2,100만 개는 프로토콜의 최종 공급 상한입니다. 현재 매수 가능한 유통량·시장 흡수력을 뜻하지 않습니다.'},
  BMNR: {maxCoinUnits:6_105_000,kind:'management-target-fixed-supply-assumption',referenceSupply:122_100_000,referenceSupplyAsOf:'2026-10-18',fraction:0.05,sourceIds:['bmnr-october-message-2026','bmnr-latest-holdings-2026'],label:'ETH 6,105,000개 상한은 회사 보고 공급 122.1m × 경영진의 5% 전략입니다. 공급분모를 고정한 모델 가정이며 Ethereum 프로토콜 한계·미래 총공급 예측이 아닙니다.'},
});

export const TREASURY_SCENARIOS = Object.freeze([
  {id:'stress',label:'스트레스',description:'자산 하락 · 프리미엄 축소 · 자금 조달 중단'},
  {id:'base',label:'기준 가정',description:'공개 재무 구조 · 명시한 자산가격과 비용 가정'},
  {id:'bull',label:'채택 확대',description:'경영진의 채택 논리 · 유리한 발행 조건이 지속되는 경우'},
]);

/** Common-share residual, not enterprise value or a share-price prediction.
 * Basic shares + unconverted debt is one consistent convention. Never add
 * conversion shares while retaining the same convertible principal here. */
export function treasuryResidual(state, coinPrice) {
  positive(coinPrice,'coinPrice'); positive(state.shares,'shares');
  for (const key of BALANCES) nonnegative(state[key] ?? 0,key);
  const grossAssets = (state.coinUnits||0) * coinPrice + (state.cashUsd||0) + (state.otherAssetsUsd || 0);
  const seniorClaims = (state.debtUsd||0) + (state.preferredUsd||0) + (state.otherLiabilitiesUsd || 0) + (state.nonControllingInterestUsd || 0);
  nonnegative(grossAssets,'grossAssets'); nonnegative(seniorClaims,'seniorClaims');
  const residualUsd = grossAssets - seniorClaims;
  const navPerShare = nonnegative(Math.max(0,residualUsd)/state.shares,'navPerShare');
  return {grossAssets,seniorClaims,residualUsd,navPerShare,insolvent:residualUsd<=0};
}

/** Common-NAV accretion requires a NET offer premium above one. Coin/share
 * accretion has a different threshold when cash and senior claims are present.
 * All new shares enter the denominator; only net proceeds buy coins. */
export function issueCommon(state, {newShares,offerPrice,coinPrice,feeRate=0,investmentFraction=1,maxCoinUnits}) {
  treasuryResidual(state,coinPrice);
  nonnegative(newShares,'newShares');nonnegative(offerPrice,'offerPrice');positive(coinPrice,'coinPrice');
  if (!(Number.isFinite(feeRate)&&feeRate>=0&&feeRate<1&&Number.isFinite(investmentFraction)&&investmentFraction>=0&&investmentFraction<=1)) throw new RangeError('Invalid financing fractions');
  let room=Infinity;
  if(maxCoinUnits!==undefined){
    nonnegative(maxCoinUnits,'maxCoinUnits');
    room=maxCoinUnits-(state.coinUnits||0);
    if(room<0)throw new RangeError('Existing holdings exceed the declared capacity');
    const coinPerShare=offerPrice*(1-feeRate)*investmentFraction/coinPrice;
    if(coinPerShare>0)newShares=Math.min(newShares,room/coinPerShare);
  }
  const proceeds=nonnegative(newShares*offerPrice*(1-feeRate),'issue proceeds');
  const coinBudget=proceeds*investmentFraction,coinsBought=Math.min(room,coinBudget/coinPrice);
  const result={...state,shares:state.shares+newShares,coinUnits:(state.coinUnits||0)+coinsBought,cashUsd:(state.cashUsd||0)+proceeds*(1-investmentFraction)+Math.max(0,coinBudget-coinsBought*coinPrice)};
  treasuryResidual(result,coinPrice);
  return result;
}

/** Cash first, then coins. Unpaid outflows become liabilities rather than
 * disappearing. No negative coin inventories and no invented rescue funding. */
export function fundCashOutflow(state, amount, coinPrice, saleFee=0) {
  treasuryResidual(state,coinPrice);
  nonnegative(amount,'amount');positive(coinPrice,'coinPrice');
  if (!(Number.isFinite(saleFee)&&saleFee>=0&&saleFee<1)) throw new RangeError('Invalid sale fee');
  const cashUsed=Math.min(amount,state.cashUsd||0),needed=amount-cashUsed;
  const coinsSold=Math.min(state.coinUnits||0,needed/(coinPrice*(1-saleFee)));
  const shortfall=Math.max(0,needed-coinsSold*coinPrice*(1-saleFee));
  const result={...state,cashUsd:(state.cashUsd||0)-cashUsed,coinUnits:(state.coinUnits||0)-coinsSold,otherLiabilitiesUsd:(state.otherLiabilitiesUsd||0)+shortfall};
  treasuryResidual(result,coinPrice);
  return {state:result,cashUsed,coinsSold,shortfall};
}

export function repayPrincipal(state, principal, coinPrice, saleFee=0) {
  nonnegative(principal,'principal');
  if (principal>(state.debtUsd||0)) throw new RangeError('Repayment exceeds outstanding principal');
  const payment=fundCashOutflow(state,principal,coinPrice,saleFee);
  return {...payment,state:{...payment.state,debtUsd:Math.max(0,(state.debtUsd||0)-principal)}};
}

function interpolatePrice(start, anchors, at) {
  const points=[{date:start.date,price:start.price},...anchors.filter(item=>item.date>start.date)].sort((a,b)=>a.date.localeCompare(b.date));
  const next=points.findIndex(item=>item.date>=at);
  if(next===0)return start.price;
  // Hold the final sourced target flat; never silently extend its old CAGR.
  if(next<0)return points.at(-1).price;
  const left=points[next-1],right=points[next],weight=(day(at)-day(left.date))/(day(right.date)-day(left.date));
  return left.price*Math.exp(weight*Math.log(right.price/left.price));
}

function assumptionsFor(symbol,scenario,snapshot,coinAnchor,endYear) {
  const common={feeRate:0.02,saleFee:0.005,investmentFraction:0.9,premiumHalfLifeYears:3,operatingExpenseUsd:50000000,stockCompAnnual:0.01,financingCarryUsd:snapshot.annualExpensesUsd??snapshot.annualPreferredDividendUsd??0,repayAtPut:true};
  const config=scenario==='stress'?{...common,premiumTarget:0.7,issuanceAnnual:0,stockCompAnnual:0.03,stakingGross:0,slashingLoss:symbol==='BMNR'?0.05:0}:
    scenario==='bull'?{...common,premiumTarget:1.6,issuanceAnnual:0.12,stockCompAnnual:0.015,stakingGross:0.03,slashingLoss:0}:
    {...common,premiumTarget:1,issuanceAnnual:0.03,stakingGross:0.0258,slashingLoss:0};
  let anchors,sourceIds;
  if(symbol==='MSTR') {
    sourceIds=['long-wisdomtree-2030','long-wisdomtree-2050'];
    anchors=scenario==='stress'?[{date:'2030-12-31',price:coinAnchor.price*0.5},{date:'2035-12-31',price:coinAnchor.price*0.3}]:
      [{date:'2030-12-31',price:scenario==='bull'?475000:275000},{date:'2050-12-31',price:scenario==='bull'?1800000:710000}];
    if(scenario==='stress')sourceIds=['mstr-model-method'];
    const saylor=TREASURY_TARGETS.filter(item=>item.symbol==='MSTR'&&item.asset==='BTC'&&item.targetYear&&item.price>0&&item.targetYear>Number(coinAnchor.date.slice(0,4))).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||b.targetYear-a.targetYear)[0];
    if(scenario==='bull'&&saylor){anchors=[{date:`${saylor.targetYear}-12-31`,price:saylor.price}];sourceIds=saylor.sourceIds;}
  } else {
    sourceIds=['model-eth-valuation','bmnr-model-method'];
    // $22k is the verified VanEck 2024 case and a Lee conditional example.
    // It is not Lee's dated BMNR target. Flat ETH is a deliberately neutral
    // analyst assumption; $360 is the publication's adverse 2030 case.
    anchors=[{date:'2030-12-31',price:scenario==='bull'?22000:scenario==='stress'?360:coinAnchor.price}];
  }
  return {...config,anchors,sourceIds:[...sourceIds,...HOLDING_POLICIES[symbol].sourceIds],holdingPolicy:HOLDING_POLICIES[symbol],otherAssetHaircut:symbol==='BMNR'?(scenario==='stress'?0.75:scenario==='base'?0.25:0):0,stakingFraction:symbol==='BMNR'?0.8:0,stakingAdvisoryFee:symbol==='BMNR'?0.015:0,stakingOtherFee:symbol==='BMNR'?0.10:0,endYear,
    assumptionsStatus:'analyst-sensitivity-not-estimated',assetPathMethod:'log interpolation of declared conditions; flat after final anchor',
    labels:[
      `발행 연율 ${(config.issuanceAnnual*100).toFixed(0)}% 상한 · 순발행가가 잔여가치보다 높을 때만 실행`,
      `무상 희석 연 ${(config.stockCompAnnual*100).toFixed(1)}% · 발행 비용 2% · 매도 비용 0.5%`,
      `프리미엄 ${config.premiumTarget.toFixed(1)}배로 3년 반감 수렴 · 추정치가 아닌 민감도 가정`,
      '연 운영비 $50m 추가 · 세금·파생상품·영업가치는 단순화',
      symbol==='BMNR'?`기타 자산을 첫 1년 동안 ${scenario==='stress'?'75':scenario==='base'?'25':'0'}% 할인 · 회수 가능성 민감도 가정`:'단기 투자자산은 공시 금액 고정 · 미래 수익·손실을 추정하지 않음',
      symbol==='BMNR'?'80% 스테이킹 · 공시 7일 연율을 출발점으로 보상 수수료 1.5%와 추가 10% 차감 가정. 보고 수익률의 비용 포함 범위가 불명확해 비용이 중복될 수 있음':'공시된 연 금융비용 유지 · 상환 후에도 비용 감소를 가정하지 않는 보수적 단순화',
      HOLDING_POLICIES[symbol].label,
      '보유 상한까지 부분 발행하고 상한에 있는 동안 코인 매입 목적의 추가 발행을 중단합니다. 상한 초과 스테이킹 보상은 매도비용 0.5%를 차감해 현금으로 보유하는 앱 가정입니다.',
      '미래 가격·날짜는 조건이며 확률 또는 실적 예측의 검증 결과가 아님',
    ]};
}

function applyKnownAdjustments(snapshot,asOf) {
  let state={...snapshot,otherLiabilitiesUsd:snapshot.otherLiabilitiesUsd||0,nonControllingInterestUsd:snapshot.nonControllingInterestUsd||0};
  const applied=[];
  for(const item of snapshot.modelAdjustments||[]) {
    if(item.date<=snapshot.asOf||item.date>asOf||(item.publishedAt&&item.publishedAt>asOf))continue;
    for(const key of ['cashUsd','preferredUsd','debtUsd','shares','coinUnits','annualExpensesUsd'])if(Number.isFinite(item[key]))state[key]=(state[key]||0)+item[key];
    applied.push(item);
  }
  for(const key of ['annualExpensesUsd','annualPreferredDividendUsd'])if(state[key]!==undefined)nonnegative(state[key],`adjusted ${key}`);
  return {state,applied};
}

function validateAssetPaths(bundle,{coin,asOf,endDate,anchorPrice}) {
  if(!bundle||bundle.asset!==coin||bundle.asOf!==asOf||bundle.endDate!==endDate)throw new RangeError('Asset paths must match the treasury asset, as-of date and horizon');
  const firstDay=day(asOf),lastDay=day(endDate),count=lastDay-firstDay+1;
  if(!bundle.scenarios||Object.keys(bundle.scenarios).some(id=>!TREASURY_SCENARIOS.some(item=>item.id===id)))throw new TypeError('Asset paths require the three declared treasury scenarios');
  const scenarios={};
  for(const {id} of TREASURY_SCENARIOS){
    const scenario=bundle.scenarios[id];
    if(!scenario||scenario.id!==id||typeof scenario.method!=='string'||!scenario.method.trim())throw new TypeError('Asset path scenario identity and method are required');
    if(scenario.asset!==undefined&&scenario.asset!==coin||scenario.asOf!==undefined&&scenario.asOf!==asOf||scenario.endDate!==undefined&&scenario.endDate!==endDate)throw new RangeError('Asset path scenario boundaries disagree with its bundle');
    if(!Array.isArray(scenario.sourceIds)||!scenario.sourceIds.length||scenario.sourceIds.some(value=>typeof value!=='string'||!value))throw new TypeError('Asset path sources are required');
    if(!scenario.training||typeof scenario.training.maxSourceDate!=='string'||day(scenario.training.maxSourceDate)>firstDay)throw new RangeError('Asset path training cannot use observations after its as-of date');
    if(!Array.isArray(scenario.path)||scenario.path.length!==count)throw new RangeError('Asset path must contain every calendar day through its declared horizon');
    const path=Array.from(scenario.path,(row,index)=>{
      if(!row||day(row.date)!==firstDay+index)throw new RangeError('Asset path dates must be consecutive, ordered calendar days');
      positive(row.price,'asset path price');
      if(row.baselinePrice!==undefined)positive(row.baselinePrice,'asset baseline price');
      if(row.sourceIds!==undefined&&(!Array.isArray(row.sourceIds)||row.sourceIds.some(value=>typeof value!=='string'||!value)))throw new TypeError('Asset point source IDs must be strings');
      return {...row};
    });
    if(Math.abs(path[0].price-anchorPrice)>1e-10*Math.max(1,anchorPrice))throw new RangeError('Asset path anchor must match the observed coin price used for share normalization');
    if(!Array.isArray(scenario.anchors))throw new TypeError('Asset valuation anchors must be explicit, including an empty list');
    const anchors=scenario.anchors.map(anchor=>{day(anchor?.date);positive(anchor.price,'asset valuation anchor');return {...anchor};});
    scenarios[id]={...scenario,path,anchors,sourceIds:[...scenario.sourceIds],training:{...scenario.training}};
  }
  return {...bundle,scenarios};
}

function simulate(symbol,snapshot,coinAnchor,latest,scenario,endYear,assetPath=null) {
  const adjusted=applyKnownAdjustments(snapshot,latest.date),originalSettings=assumptionsFor(symbol,scenario,adjusted.state,coinAnchor,endYear);
  const settings=assetPath?{...originalSettings,anchors:assetPath.anchors,sourceIds:[...new Set([...assetPath.sourceIds,...HOLDING_POLICIES[symbol].sourceIds])],assetPathMethod:assetPath.method,accountingFrequency:'calendar-day',labels:[...originalSettings.labels,'기초 코인의 일별 모의 경로를 그대로 재무 계산에 전달하며 주말에도 비용·보상·상환을 평가합니다.']}:originalSettings;
  let state={...adjusted.state};
  const initial=treasuryResidual(state,coinAnchor.price);
  if(state.coinUnits>settings.holdingPolicy.maxCoinUnits)throw new RangeError('Initial holdings exceed the declared capacity');
  if(initial.insolvent)throw new RangeError('Cannot normalize a nonpositive initial treasury residual');
  const initialPremium=latest.price/initial.navPerShare;
  const startDay=day(latest.date),endDay=day(`${endYear}-12-31`),dates=new Set([latest.date,date(endDay)]);
  if(!assetPath){
    for(let t=startDay+30;t<endDay;t+=30)dates.add(date(t));
    for(let year=Number(latest.date.slice(0,4));year<=endYear;year++)if(`${year}-12-31`>latest.date)dates.add(`${year}-12-31`);
    for(const item of snapshot.debtSchedule||[])if(item.date>latest.date&&day(item.date)<=endDay)dates.add(item.date);
    for(const item of settings.anchors)if(item.date>latest.date&&day(item.date)<=endDay)dates.add(item.date);
  }
  const sorted=assetPath?assetPath.path.map(point=>point.date):[...dates].sort(),path=[];let prior=latest.date,totalSold=0,capitalRaised=0,insolventAt=null,shockApplied=false,capacityReachedAt=null,rewardsSold=0,rewardSaleProceeds=0;
  const sourceIds=[...new Set([...(snapshot.sourceIds||[]),...adjusted.applied.flatMap(item=>item.sourceIds||[]),...settings.sourceIds,`${symbol.toLowerCase()}-model-method`])];
  for(let index=0;index<sorted.length;index++){
    const at=sorted[index],assetPoint=assetPath?.path[index];
    const years=(day(at)-startDay)/YEAR,dt=(day(at)-day(prior))/YEAR,coinPrice=assetPoint?assetPoint.price:interpolatePrice({date:latest.date,price:coinAnchor.price},settings.anchors,at);
    const premium=settings.premiumTarget+(initialPremium-settings.premiumTarget)*Math.pow(0.5,years/settings.premiumHalfLifeYears);
    if(dt>0&&!insolventAt){
      const haircutStep=Math.min(years,1)-Math.min((day(prior)-startDay)/YEAR,1);
      state.otherAssetsUsd*=Math.pow(1-settings.otherAssetHaircut,Math.max(0,haircutStep));
      const netStake=settings.stakingFraction*settings.stakingGross*(1-settings.stakingAdvisoryFee)*(1-settings.stakingOtherFee);
      state.coinUnits*=Math.exp(Math.log1p(netStake)*dt);
      if(state.coinUnits>settings.holdingPolicy.maxCoinUnits){
        const excess=state.coinUnits-settings.holdingPolicy.maxCoinUnits;
        const proceeds=excess*coinPrice*(1-settings.saleFee);
        state.coinUnits=settings.holdingPolicy.maxCoinUnits;
        state.cashUsd+=proceeds;
        rewardsSold+=excess;rewardSaleProceeds+=proceeds;totalSold+=excess;
        capacityReachedAt??=at;
      }
      if(settings.slashingLoss&&!shockApplied&&years>=1){state.coinUnits*=1-settings.slashingLoss;shockApplied=true;}
      const paid=fundCashOutflow(state,(settings.financingCarryUsd+settings.operatingExpenseUsd)*dt,coinPrice,settings.saleFee);state=paid.state;totalSold+=paid.coinsSold;
      for(const payment of snapshot.debtSchedule||[])if(payment.date>prior&&payment.date<=at&&settings.repayAtPut){
        const result=repayPrincipal(state,Math.min(state.debtUsd,payment.principalUsd??payment.amountUsd??0),coinPrice,settings.saleFee);state=result.state;totalSold+=result.coinsSold;
      }
      state.shares*=Math.exp(Math.log1p(settings.stockCompAnnual)*dt);
      const nav=treasuryResidual(state,coinPrice),offer=nav.navPerShare*premium;
      if(!nav.insolvent&&premium*(1-settings.feeRate)>1&&settings.issuanceAnnual>0){
        const newShares=state.shares*(Math.exp(Math.log1p(settings.issuanceAnnual)*dt)-1);
        const issued=issueCommon(state,{newShares,offerPrice:offer,coinPrice,...settings,maxCoinUnits:settings.holdingPolicy.maxCoinUnits});
        capitalRaised+=(issued.shares-state.shares)*offer*(1-settings.feeRate);
        state=issued;
        if(state.coinUnits>=settings.holdingPolicy.maxCoinUnits)capacityReachedAt??=at;
      }
    }
    const components=treasuryResidual(state,coinPrice);
    if(components.insolvent&&!insolventAt)insolventAt=at;
    const price=nonnegative(insolventAt?0:components.navPerShare*premium,'scenario price');
    const pointSources=assetPoint?.sourceIds?.length?[...new Set([...sourceIds,...assetPoint.sourceIds])]:sourceIds;
    path.push({date:at,price,valuationState:insolventAt?'absorbed':'active',kind:at===latest.date?'anchor':'forecast',sourceIds:pointSources,components:{...components,coinPrice,...(assetPoint?.baselinePrice!==undefined?{coinBaselinePrice:assetPoint.baselinePrice}:{}),coinUnits:state.coinUnits,cashUsd:state.cashUsd,otherAssetsUsd:state.otherAssetsUsd,debtUsd:state.debtUsd,preferredUsd:state.preferredUsd,otherLiabilitiesUsd:state.otherLiabilitiesUsd,nonControllingInterestUsd:state.nonControllingInterestUsd,shares:state.shares,premium,coinsSold:totalSold,capitalRaised,rewardsSold,rewardSaleProceeds,holdingCap:settings.holdingPolicy.maxCoinUnits},financialAsOf:snapshot.asOf,probability:null});
    prior=at;
  }
  return {path,settings,initialPremium,insolventAt,capacityReachedAt,adjustments:adjusted.applied};
}

/** This is a current-price-normalized sensitivity of a disclosed historical
 * capital structure. It is explicitly NOT current NAV: newer holdings are not
 * divided by a stale denominator. The stale-vintage warning travels with every
 * output and is shown on the chart. No out-of-sample predictive claim is made. */
export function buildTreasuryForecasts({symbol,history,asOf,endYear=2035,snapshot=TREASURY_SNAPSHOTS[symbol],coinAnchor=TREASURY_MARKET_ANCHORS[symbol],assetPaths}={}) {
  if(!['MSTR','BMNR'].includes(symbol))throw new RangeError('Invalid instrument or scenario');
  if(!snapshot||!coinAnchor)throw new TypeError('Missing verified treasury snapshot or crypto anchor');
  if(!Number.isSafeInteger(endYear)||endYear<2027||endYear>2050)throw new RangeError('Horizon must be 2027–2050');
  const rawCandles=Array.isArray(history)?history:history?.candles;
  if(!Array.isArray(rawCandles)||!rawCandles.length)throw new RangeError('Observed equity history is required');
  const seen=new Set(),candles=rawCandles.map(row=>{
    if(typeof row?.date!=='string'||!/^\d{4}-\d{2}-\d{2}(?:T00:00:00(?:\.000)?Z)?$/.test(row.date))throw new TypeError('Observed session date must be an ISO day or UTC midnight');
    const sessionDate=row.date.slice(0,10);day(sessionDate);
    if(row.sessionDate!==undefined&&row.sessionDate!==sessionDate)throw new RangeError('Conflicting equity session date');
    if(seen.has(sessionDate))throw new RangeError('Duplicate equity session date');
    seen.add(sessionDate);
    return {date:sessionDate,price:positive(row.close,'observed equity price')};
  }).sort((a,b)=>a.date.localeCompare(b.date));
  const cutoff=asOf===undefined?candles.at(-1).date:asOf;day(cutoff);
  if(cutoff<'2026-10-23')throw new RangeError('Historical cutoffs precede the research knowledge date; this is not a backtest');
  const latest=candles.filter(row=>row.date<=cutoff).at(-1);
  if(!latest)throw new RangeError('No observed price at cutoff');
  day(snapshot.asOf);day(snapshot.publishedAt);day(coinAnchor.date);positive(coinAnchor.price,'coin anchor price');
  if(snapshot.publishedAt<snapshot.asOf)throw new RangeError('Publication date precedes the financial date');
  if(snapshot.coin!==(symbol==='MSTR'?'BTC':'ETH'))throw new RangeError('Treasury coin does not match the equity asset');
  for(const key of ['annualExpensesUsd','annualPreferredDividendUsd'])if(snapshot[key]!==undefined)nonnegative(snapshot[key],key);
  for(const item of snapshot.debtSchedule||[]){day(item.date);nonnegative(item.principalUsd??item.amountUsd,'debt principal');}
  for(const item of snapshot.modelAdjustments||[]){
    day(item.date);day(item.publishedAt);
    if(item.publishedAt<item.date)throw new RangeError('Adjustment publication date precedes its effective date');
    for(const key of ['cashUsd','preferredUsd','debtUsd','shares','coinUnits','annualExpensesUsd'])if(item[key]!==undefined&&!Number.isFinite(item[key]))throw new RangeError(`Adjustment ${key} must be finite`);
  }
  snapshot={...snapshot,...Object.fromEntries(BALANCES.map(key=>[key,snapshot[key]??0]))};
  treasuryResidual(snapshot,coinAnchor.price);
  if(latest.date<'2026-10-23'||coinAnchor.date<'2026-10-23')throw new RangeError('Effective market anchors precede the research knowledge date');
  if(day(latest.date)>=day(`${endYear}-12-31`))throw new RangeError('Expired horizon');
  if(snapshot.asOf>latest.date||snapshot.publishedAt>latest.date||coinAnchor.date>latest.date)throw new RangeError('Future information is not permitted at the price cutoff');
  if(assetPaths!==undefined&&coinAnchor.date!==latest.date)throw new RangeError('Asset-linked paths require the coin anchor date to match the observed equity anchor date');
  const assets=assetPaths===undefined?null:validateAssetPaths(assetPaths,{coin:snapshot.coin,asOf:latest.date,endDate:`${endYear}-12-31`,anchorPrice:coinAnchor.price});
  const simulations=Object.fromEntries(TREASURY_SCENARIOS.map(item=>[item.id,simulate(symbol,snapshot,coinAnchor,latest,item.id,endYear,assets?.scenarios[item.id])]));
  const maps=Object.values(simulations).map(item=>new Map(item.path.map(p=>[p.date,p])));
  const age=day(latest.date)-day(snapshot.asOf);
  return Object.fromEntries(TREASURY_SCENARIOS.map(scenario=>{
    const selected=simulations[scenario.id],asset=assets?.scenarios[scenario.id];
    const path=selected.path.map(point=>{
      const values=maps.map(map=>map.get(point.date)?.price).filter(Number.isFinite);
      if(values.length!==TREASURY_SCENARIOS.length)throw new RangeError('Treasury scenario dates must agree before constructing the condition range');
      return {...point,low:Math.min(...values),high:Math.max(...values)};
    });
    const pivots=assets?detectDirectionalChanges(path.filter(point=>point.price>0),{threshold:0.12}).pivots.filter(point=>point.eventDate>latest.date):[];
    const milestones=[
      {id:`${symbol.toLowerCase()}-capital-model`,date:date(day(latest.date)+90),title:'주당 가치 · 자금 조달',description:'보유자산에서 선순위 청구권을 차감하고, 발행·희석·현금 비용을 적용합니다.',sourceIds:[`${symbol.toLowerCase()}-model-method`,...snapshot.sourceIds]},
      ...TREASURY_FUTURE_EVENTS.filter(item=>item.symbol===symbol&&item.date>latest.date&&Number(item.date.slice(0,4))<=endYear),
      ...selected.settings.anchors.filter(item=>item.date>latest.date&&Number(item.date.slice(0,4))<=endYear).map((item,index)=>({id:`${symbol.toLowerCase()}-valuation-${index}`,date:item.date,title:`${snapshot.coin} 가격 조건`,description:`${item.date}의 $${Math.round(item.price).toLocaleString('en-US')}는 지정한 ${assets?'기초자산 기준선':'가격'} 조건입니다. 실제 사건 또는 확률 예측이 아닙니다.`,sourceIds:selected.settings.sourceIds})),
      ...pivots.map((point,index)=>({id:`${symbol.toLowerCase()}-simulated-${point.type}-${index}`,date:point.eventDate,price:point.eventPrice,title:`모의 ${point.type==='high'?'고점':'저점'} 후보`,description:`앱이 선택한 12% 반전 규칙으로 모의 경로를 사후 요약한 ${point.type==='high'?'고점':'저점'}입니다. 모형 내 확인일은 ${point.confirmationDate}이며 별도 최소 간격 필터는 없습니다. 실제 미래 사건, 4년 주기 또는 적중 확률을 뜻하지 않습니다.`,kind:'simulated-turn',turnType:point.type,confirmationDate:point.confirmationDate,threshold:0.12,probability:null,sourceIds:selected.path.find(row=>row.date===point.eventDate).sourceIds})),
      ...(assets&&selected.insolventAt?[{id:`${symbol.toLowerCase()}-simulated-zero`,date:selected.insolventAt,price:0,title:'모의 잔여가치 소진',description:'이 조건의 일말 보통주 잔여가치가 0 이하가 되어 이후 가격을 0으로 유지하는 모델 규칙입니다. 실제 파산일 예측이 아닙니다.',kind:'simulated-insolvency',probability:null,sourceIds:selected.settings.sourceIds}]:[]),
    ].filter(item=>item.date<=`${endYear}-12-31`).sort((a,b)=>a.date.localeCompare(b.date));
    return [scenario.id,{symbol,asOf:latest.date,issuedAt:'2026-10-24',financialAsOf:snapshot.asOf,displayEnd:`${endYear}-12-31`,path,milestones,snapshot,coinAnchor,scenario,assumptions:selected.settings,
    pathMode:assets?'asset-linked-daily':'target-interpolation',
    assetPath:asset?{asset:assets.asset,asOf:assets.asOf,endDate:assets.endDate,scenario:asset.id,method:asset.method,sourceIds:asset.sourceIds,anchors:asset.anchors,training:asset.training,metadata:{...assets.metadata,...asset.metadata},warnings:[...(assets.warnings||[]),...(asset.warnings||[])]}:null,
    formula:'주가 가정 = 흡수 상태이면 0; 정상 평가 상태이면 프리미엄 × max(코인 가치 + 현금 + 포함 자산 − 채무 원금 − 우선주 청구권 − 기타 부채 − 비지배지분, 0) ÷ 보통주 수',
    warnings:[`재무 기준 ${snapshot.asOf} · 가격 기준 ${latest.date} · ${age}일 시차. 최신 NAV가 아닌 과거 구조의 가격 정규화 민감도입니다.`,
      '최근 보유량과 과거 주식 수를 합치지 않습니다. 공시 이후 모든 발행·매각·전환·세금을 복원한 현재 재무제표가 아닙니다.',
      '범위는 세 조건의 최소·최대입니다. 신뢰구간·발생 확률·상하한 보장이 아닙니다.',
      '잔여가치가 0 이하이면 이 모델은 청산 스트레스로 가격 0을 유지합니다. 법적 파산 판정이나 실제 주가 0의 예언은 아닙니다.',
      '주식과 코인 관측은 서로 다른 마감 시각입니다. 분 단위 동시 시세 또는 정확한 현물 프리미엄이 아닙니다.',
      ...(assets?['일별 경로는 기초 코인 모형을 재무 구조에 전달한 모의 평가입니다. 주말에도 계산하며 실제 거래소의 체결·장중 OHLC를 예측한 값이 아닙니다.','일별 발행은 연간 발행률을 달력 날짜에 배분한 모델 가정이며 실제 주말 주식 발행 기록이 아닙니다.','일별 현금·발행 계산은 기존 목표 연결 모형의 약 30일 계산과 구간 길이가 다릅니다. 같은 종착 코인 가격이라도 중간 경로와 계산 주기에 따라 보유량·희석·주가가 달라집니다.',...(assets.warnings||[]),...(asset.warnings||[])]:[]),
      `${selected.settings.holdingPolicy.label} 상한 전에도 조달 접근성·호가·거래량·가격 충격은 검증하지 않았습니다.`,
      ...(snapshot.notes||[])],
    diagnostics:{method:assets?'asset-path-linked-capital-structure-sensitivity':'historical-capital-structure-sensitivity',accountingFrequency:assets?'calendar-day':'target-and-30-day-knots',dayCountBasis:YEAR,assetPathMethod:asset?.method??null,simulatedTurnCount:pivots.length,financialAgeDays:age,currentNavClaim:false,initialImpliedVintagePremium:selected.initialPremium,adjustments:selected.adjustments,predictiveValidation:'not-established',probabilities:null,insolventAt:selected.insolventAt,capacityReachedAt:selected.capacityReachedAt,scenarioCapacityReachedAt:Object.fromEntries(Object.entries(simulations).map(([id,value])=>[id,value.capacityReachedAt])),scenarioInsolvency:Object.fromEntries(Object.entries(simulations).map(([id,value])=>[id,value.insolventAt]))}}];
  }));
}

export function buildTreasuryForecast(options={}) {
  const scenario=options.scenario??'base';
  if(!TREASURY_SCENARIOS.some(item=>item.id===scenario))throw new RangeError('Invalid instrument or scenario');
  return buildTreasuryForecasts(options)[scenario];
}
