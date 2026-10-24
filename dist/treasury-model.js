import { TREASURY_SNAPSHOTS, TREASURY_MARKET_ANCHORS, TREASURY_FUTURE_EVENTS, TREASURY_TARGETS } from './treasury-research.js?v=1.18.0';

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
  for (const key of ['coinUnits','cashUsd','otherAssetsUsd','debtUsd','preferredUsd','otherLiabilitiesUsd','nonControllingInterestUsd']) nonnegative(state[key] ?? 0,key);
  const grossAssets = (state.coinUnits||0) * coinPrice + (state.cashUsd||0) + (state.otherAssetsUsd || 0);
  const seniorClaims = (state.debtUsd||0) + (state.preferredUsd||0) + (state.otherLiabilitiesUsd || 0) + (state.nonControllingInterestUsd || 0);
  const residualUsd = grossAssets - seniorClaims;
  return {grossAssets,seniorClaims,residualUsd,navPerShare:Math.max(0,residualUsd)/state.shares,insolvent:residualUsd<=0};
}

/** Common-NAV accretion requires a NET offer premium above one. Coin/share
 * accretion has a different threshold when cash and senior claims are present.
 * All new shares enter the denominator; only net proceeds buy coins. */
export function issueCommon(state, {newShares,offerPrice,coinPrice,feeRate=0,investmentFraction=1}) {
  treasuryResidual(state,coinPrice);
  nonnegative(newShares,'newShares');nonnegative(offerPrice,'offerPrice');positive(coinPrice,'coinPrice');
  if (!(feeRate>=0&&feeRate<1&&investmentFraction>=0&&investmentFraction<=1)) throw new RangeError('Invalid financing fractions');
  const proceeds=newShares*offerPrice*(1-feeRate);
  return {...state,shares:state.shares+newShares,coinUnits:(state.coinUnits||0)+proceeds*investmentFraction/coinPrice,cashUsd:(state.cashUsd||0)+proceeds*(1-investmentFraction)};
}

/** Cash first, then coins. Unpaid outflows become liabilities rather than
 * disappearing. No negative coin inventories and no invented rescue funding. */
export function fundCashOutflow(state, amount, coinPrice, saleFee=0) {
  treasuryResidual(state,coinPrice);
  nonnegative(amount,'amount');positive(coinPrice,'coinPrice');
  if (!(saleFee>=0&&saleFee<1)) throw new RangeError('Invalid sale fee');
  const cashUsed=Math.min(amount,state.cashUsd||0),needed=amount-cashUsed;
  const coinsSold=Math.min(state.coinUnits||0,needed/(coinPrice*(1-saleFee)));
  const shortfall=Math.max(0,needed-coinsSold*coinPrice*(1-saleFee));
  return {state:{...state,cashUsd:(state.cashUsd||0)-cashUsed,coinUnits:(state.coinUnits||0)-coinsSold,otherLiabilitiesUsd:(state.otherLiabilitiesUsd||0)+shortfall},cashUsed,coinsSold,shortfall};
}

export function repayPrincipal(state, principal, coinPrice, saleFee=0) {
  nonnegative(principal,'principal');
  if (principal>(state.debtUsd||0)+0.01) throw new RangeError('Repayment exceeds outstanding principal');
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
  return {...config,anchors,sourceIds,otherAssetHaircut:symbol==='BMNR'?(scenario==='stress'?0.75:scenario==='base'?0.25:0):0,stakingFraction:symbol==='BMNR'?0.8:0,stakingAdvisoryFee:symbol==='BMNR'?0.015:0,stakingOtherFee:symbol==='BMNR'?0.10:0,endYear,
    assumptionsStatus:'analyst-sensitivity-not-estimated',assetPathMethod:'log interpolation of declared conditions; flat after final anchor',
    labels:[
      `발행 연율 ${(config.issuanceAnnual*100).toFixed(0)}% 상한 · 순발행가가 잔여가치보다 높을 때만 실행`,
      `무상 희석 연 ${(config.stockCompAnnual*100).toFixed(1)}% · 발행 비용 2% · 매도 비용 0.5%`,
      `프리미엄 ${config.premiumTarget.toFixed(1)}배로 3년 반감 수렴 · 추정치가 아닌 민감도 가정`,
      '연 운영비 $50m 추가 · 세금·파생상품·영업가치는 단순화',
      symbol==='BMNR'?`기타 자산을 첫 1년 동안 ${scenario==='stress'?'75':scenario==='base'?'25':'0'}% 할인 · 회수 가능성 민감도 가정`:'단기 투자자산은 공시 금액 고정 · 미래 수익·손실을 추정하지 않음',
      symbol==='BMNR'?'80% 스테이킹 · 공시 7일 연율을 출발점으로 보상 수수료 1.5%와 추가 10% 차감 가정. 보고 수익률의 비용 포함 범위가 불명확해 비용이 중복될 수 있음':'공시된 연 금융비용 유지 · 상환 후에도 비용 감소를 가정하지 않는 보수적 단순화',
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
  return {state,applied};
}

function simulate(symbol,snapshot,coinAnchor,latest,scenario,endYear) {
  const adjusted=applyKnownAdjustments(snapshot,latest.date),settings=assumptionsFor(symbol,scenario,adjusted.state,coinAnchor,endYear);
  let state={...adjusted.state};
  const initial=treasuryResidual(state,coinAnchor.price);
  if(initial.insolvent)throw new RangeError('Cannot normalize a nonpositive initial treasury residual');
  const initialPremium=latest.price/initial.navPerShare;
  const startDay=day(latest.date),endDay=day(`${endYear}-12-31`),dates=new Set([latest.date,date(endDay)]);
  for(let t=startDay+30;t<endDay;t+=30)dates.add(date(t));
  // Every scenario shares all annual knots, including other scenarios' targets.
  for(let year=Number(latest.date.slice(0,4));year<=endYear;year++)if(`${year}-12-31`>latest.date)dates.add(`${year}-12-31`);
  for(const item of snapshot.debtSchedule||[])if(item.date>latest.date&&day(item.date)<=endDay)dates.add(item.date);
  for(const item of settings.anchors)if(item.date>latest.date&&day(item.date)<=endDay)dates.add(item.date);
  const sorted=[...dates].sort(),path=[];let prior=latest.date,totalSold=0,capitalRaised=0,insolventAt=null,shockApplied=false;
  const sourceIds=[...new Set([...(snapshot.sourceIds||[]),...adjusted.applied.flatMap(item=>item.sourceIds||[]),...settings.sourceIds,`${symbol.toLowerCase()}-model-method`])];
  for(const at of sorted){
    const years=(day(at)-startDay)/YEAR,dt=(day(at)-day(prior))/YEAR,coinPrice=interpolatePrice({date:latest.date,price:coinAnchor.price},settings.anchors,at);
    const premium=settings.premiumTarget+(initialPremium-settings.premiumTarget)*Math.pow(0.5,years/settings.premiumHalfLifeYears);
    if(dt>0&&!insolventAt){
      const haircutStep=Math.min(years,1)-Math.min((day(prior)-startDay)/YEAR,1);
      state.otherAssetsUsd*=Math.pow(1-settings.otherAssetHaircut,Math.max(0,haircutStep));
      const netStake=settings.stakingFraction*settings.stakingGross*(1-settings.stakingAdvisoryFee)*(1-settings.stakingOtherFee);
      state.coinUnits*=Math.exp(Math.log1p(netStake)*dt);
      if(settings.slashingLoss&&!shockApplied&&years>=1){state.coinUnits*=1-settings.slashingLoss;shockApplied=true;}
      const paid=fundCashOutflow(state,(settings.financingCarryUsd+settings.operatingExpenseUsd)*dt,coinPrice,settings.saleFee);state=paid.state;totalSold+=paid.coinsSold;
      for(const payment of snapshot.debtSchedule||[])if(payment.date>prior&&payment.date<=at&&settings.repayAtPut){
        const result=repayPrincipal(state,Math.min(state.debtUsd,payment.principalUsd??payment.amountUsd??0),coinPrice,settings.saleFee);state=result.state;totalSold+=result.coinsSold;
      }
      state.shares*=Math.exp(Math.log1p(settings.stockCompAnnual)*dt);
      const nav=treasuryResidual(state,coinPrice),offer=nav.navPerShare*premium;
      if(!nav.insolvent&&premium*(1-settings.feeRate)>1&&settings.issuanceAnnual>0){
        const newShares=state.shares*(Math.exp(Math.log1p(settings.issuanceAnnual)*dt)-1);
        capitalRaised+=newShares*offer*(1-settings.feeRate);
        state=issueCommon(state,{newShares,offerPrice:offer,coinPrice,...settings});
      }
    }
    const components=treasuryResidual(state,coinPrice);
    if(components.insolvent&&!insolventAt)insolventAt=at;
    const price=insolventAt?0:components.navPerShare*premium;
    path.push({date:at,price,kind:at===latest.date?'anchor':'forecast',sourceIds,components:{...components,coinPrice,coinUnits:state.coinUnits,cashUsd:state.cashUsd,debtUsd:state.debtUsd,preferredUsd:state.preferredUsd,shares:state.shares,premium,coinsSold:totalSold,capitalRaised},financialAsOf:snapshot.asOf,probability:null});
    prior=at;
  }
  return {path,settings,initialPremium,insolventAt,adjustments:adjusted.applied};
}

/** This is a current-price-normalized sensitivity of a disclosed historical
 * capital structure. It is explicitly NOT current NAV: newer holdings are not
 * divided by a stale denominator. The stale-vintage warning travels with every
 * output and is shown on the chart. No out-of-sample predictive claim is made. */
export function buildTreasuryForecast({symbol,history,scenario='base',asOf,endYear=2035,snapshot=TREASURY_SNAPSHOTS[symbol],coinAnchor=TREASURY_MARKET_ANCHORS[symbol]}={}) {
  if(!['MSTR','BMNR'].includes(symbol)||!TREASURY_SCENARIOS.some(s=>s.id===scenario))throw new RangeError('Invalid instrument or scenario');
  if(!snapshot||!coinAnchor)throw new TypeError('Missing verified treasury snapshot or crypto anchor');
  if(!Number.isSafeInteger(endYear)||endYear<2027||endYear>2050)throw new RangeError('Horizon must be 2027–2050');
  const candles=Array.isArray(history)?history:history?.candles;
  if(!candles?.length)throw new RangeError('Observed equity history is required');
  const cutoff=asOf||String(candles.at(-1).date).slice(0,10);day(cutoff);
  // Current research contains October disclosures. This API does not backtest
  // its present assumptions at an earlier information set.
  if(cutoff<'2026-10-23')throw new RangeError('Historical cutoffs precede the research knowledge date; this is not a backtest');
  const last=candles.filter(row=>String(row.date).slice(0,10)<=cutoff).at(-1);
  if(!last)throw new RangeError('No observed price at cutoff');
  const latest={date:String(last.date).slice(0,10),price:last.close};positive(latest.price,'observed equity price');
  if(latest.date<'2026-10-23'||coinAnchor.date<'2026-10-23')throw new RangeError('Effective market anchors precede the research knowledge date');
  if(day(latest.date)>=day(`${endYear}-12-31`))throw new RangeError('Expired horizon');
  if(snapshot.asOf>latest.date||(snapshot.publishedAt&&snapshot.publishedAt>latest.date)||coinAnchor.date>latest.date)throw new RangeError('Future information is not permitted at the price cutoff');
  const simulations=Object.fromEntries(TREASURY_SCENARIOS.map(item=>[item.id,simulate(symbol,snapshot,coinAnchor,latest,item.id,endYear)]));
  const selected=simulations[scenario],maps=Object.values(simulations).map(item=>new Map(item.path.map(p=>[p.date,p])));
  const path=selected.path.map(point=>{
    const values=maps.map(map=>map.get(point.date)?.price).filter(Number.isFinite);
    return {...point,low:Math.min(point.price,...values),high:Math.max(point.price,...values)};
  });
  const age=day(latest.date)-day(snapshot.asOf);
  const milestones=[
    {id:`${symbol.toLowerCase()}-capital-model`,date:date(day(latest.date)+90),title:'주당 가치 · 자금 조달',description:'보유자산에서 선순위 청구권을 차감하고, 발행·희석·현금 비용을 적용합니다.',sourceIds:[`${symbol.toLowerCase()}-model-method`,...snapshot.sourceIds]},
    ...TREASURY_FUTURE_EVENTS.filter(item=>item.symbol===symbol&&item.date>latest.date&&Number(item.date.slice(0,4))<=endYear),
    ...selected.settings.anchors.filter(item=>item.date>latest.date&&Number(item.date.slice(0,4))<=endYear).map((item,index)=>({id:`${symbol.toLowerCase()}-valuation-${index}`,date:item.date,title:`${snapshot.coin} 가격 조건`,description:`${item.date}의 $${Math.round(item.price).toLocaleString('en-US')}는 지정한 조건입니다. 실제 사건 또는 확률 예측이 아닙니다.`,sourceIds:selected.settings.sourceIds})),
  ].sort((a,b)=>a.date.localeCompare(b.date));
  return {symbol,asOf:latest.date,issuedAt:'2026-10-24',financialAsOf:snapshot.asOf,displayEnd:`${endYear}-12-31`,path,milestones,snapshot,coinAnchor,scenario:TREASURY_SCENARIOS.find(item=>item.id===scenario),assumptions:selected.settings,
    formula:'주가 가정 = 프리미엄 × max(코인 가치 + 현금 + 포함 자산 − 채무 원금 − 우선주 청구권 − 기타 부채 − 비지배지분, 0) ÷ 보통주 수',
    warnings:[`재무 기준 ${snapshot.asOf} · 가격 기준 ${latest.date} · ${age}일 시차. 최신 NAV가 아닌 과거 구조의 가격 정규화 민감도입니다.`,
      '최근 보유량과 과거 주식 수를 합치지 않습니다. 공시 이후 모든 발행·매각·전환·세금을 복원한 현재 재무제표가 아닙니다.',
      '범위는 세 조건의 최소·최대입니다. 신뢰구간·발생 확률·상하한 보장이 아닙니다.',
      '잔여가치가 0 이하이면 이 모델은 청산 스트레스로 가격 0을 유지합니다. 법적 파산 판정이나 실제 주가 0의 예언은 아닙니다.',
      '주식과 코인 관측은 서로 다른 마감 시각입니다. 분 단위 동시 시세 또는 정확한 현물 프리미엄이 아닙니다.',
      ...(snapshot.notes||[])],
    diagnostics:{method:'historical-capital-structure-sensitivity',financialAgeDays:age,currentNavClaim:false,initialImpliedVintagePremium:selected.initialPremium,adjustments:selected.adjustments,predictiveValidation:'not-established',probabilities:null,insolventAt:selected.insolventAt,scenarioInsolvency:Object.fromEntries(Object.entries(simulations).map(([id,value])=>[id,value.insolventAt]))}};
}
