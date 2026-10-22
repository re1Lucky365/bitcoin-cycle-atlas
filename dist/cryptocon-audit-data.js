import { utcDay } from './cycle-engine.js';

export const CRYPTOCON_AUDIT_AS_OF = '2026-10-20';
export const CRYPTOCON_AUDIT_SOURCE = Object.freeze({
  title:'Coin Metrics · PriceUSD · UTC 일말 가격',
  url:'https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets=btc&metrics=PriceUSD&frequency=1d&start_time=2010-07-18&end_time=2026-10-21&page_size=10000'
});

export const CRYPTOCON_TIMING_CLAIMS = Object.freeze([
  {
    id:'alternative-may',shortLabel:'23년 대안',title:'6개월 앞당긴 대안',published:'2023-11-14',
    start:'2025-05-01',end:'2025-05-31',center:null,kind:'alternative',
    evidence:'저자 공개 본문',url:'https://www.bitcoindatanewsletter.com/p/theories-collide',
    note:'당시 원래 달력과 함께 제시한 미검증 대안입니다. 5월은 월 단위 해석이며 확률구간이 아닙니다.'
  },
  {
    id:'original-november',shortLabel:'24년 원래',title:'11월 28일 ±21일',published:'2024-11-28',
    start:'2025-11-07',end:'2025-12-19',center:'2025-11-28',kind:'forecast',
    evidence:'X 검색 색인 · 직접 본문 미확보',url:'https://x.com/CryptoCon_/status/1862142528939532706',
    note:'앞서 제시한 좁은 날짜 창의 재확인입니다. 나중에 넓힌 10–12월 창으로 소급 채점하지 않습니다.'
  },
  {
    id:'june-october',shortLabel:'25년 6월',title:'152주 비교 · 10월 고점',published:'2025-06-13',
    start:'2025-10-01',end:'2025-10-31',center:null,kind:'forecast',
    evidence:'X 색인 + 날짜 있는 재현',url:'https://x.com/CryptoCon_/status/1933580045546651799',
    supportingUrl:'https://forklog.com/en/mayer-multiple-indicates-bitcoins-undervaluation/',
    note:'실제 종가 최고는 해당 월 안에 있습니다. 원래 11월 창과 별개인 이 전망만 월 단위 일치로 분류합니다.'
  },
  {
    id:'december-retrospective',shortLabel:'25년 12월',title:'10–12월 창 · 사후 설명',published:'2025-12-01',
    start:'2025-10-01',end:'2025-12-31',center:null,kind:'retrospective',
    evidence:'X 검색 색인 · 직접 본문 미확보',url:'https://x.com/CryptoCon_/status/1995550863545266366',
    note:'고점 발생 뒤 넓은 창으로 설명한 글입니다. 이 행은 사전 예측 적중 수에 더하지 않습니다.'
  }
]);

export const CRYPTOCON_PRICE_CLAIMS = Object.freeze([
  {
    id:'cycle-130k',shortLabel:'2023.10',title:'주기 고점 약 $130,000',published:'2023-10-17',
    target:130000,observationStart:'2025-01-01',observationEnd:'2025-12-31',deadline:null,
    evidence:'X 색인 + 보도 재현',url:'https://x.com/CryptoCon_/status/1714269018465415240',
    supportingUrl:'https://cointelegraph.com/markets/btc-price-models-130k-target-024-bitcoin-halving',
    note:'2025년 최고 종가와 크기를 비교합니다. 정확한 가격 도달 시한을 새로 부여하거나, 약 13만 달러라는 표현을 정밀한 오차 허용치로 바꾸지 않습니다.'
  },
  {
    id:'september-166754',shortLabel:'2025.07',title:'$166,754 · 9월까지',published:'2025-07-04',
    target:166754,observationStart:'2025-07-04',observationEnd:'2025-09-30',deadline:'2025-09-30',
    evidence:'날짜 있는 2차 보도 · 원래 X 미확보',
    url:'https://www.tradingview.com/news/newsbtc:f6f582711094b:0-bitcoin-price-to-see-52-increase-to-166-000-analyst-reveals-tight-timeline/',
    supportingUrl:'https://www.newsbtc.com/es/news/bitcoin/bitcoin-52-increase-to-166000/',
    note:'7월 4일은 보도 날짜입니다. 보도일부터 9월 말까지 전체 관측 창의 최고 종가로 비교하며, 9월만의 최고가를 사용하지 않습니다.'
  },
  {
    id:'august-166754',shortLabel:'2025.08',title:'$166,754 재확인 · 시한 없음',published:'2025-08-01',
    target:166754,observationStart:'2025-08-01',observationEnd:CRYPTOCON_AUDIT_AS_OF,deadline:null,
    evidence:'X 날짜 있는 재현 · 직접 본문 미확보',url:'https://x.com/CryptoCon_/status/1951354699489353813',
    supportingUrl:'https://crypto.news/bitcoin-166k-inevitable-fibonacci-model/',
    note:'이 게시물 자체에는 독립적인 달력 시한이 없습니다. 연구 기준일까지의 미도달과 시한 실패를 구분합니다.'
  }
]);

function highest(rows) {
  return rows.reduce((peak,row)=>!peak||row.price>peak.price?row:peak,null);
}

export function buildCryptoConAudit(dataset) {
  const rows=dataset.prices.filter(([date])=>date<=CRYPTOCON_AUDIT_AS_OF).map(([date,price])=>({date,price}));
  const year=rows.filter(row=>row.date>='2025-01-01'&&row.date<='2025-12-31');
  if(year.length!==365||year[0].date!=='2025-01-01'||year.at(-1).date!=='2025-12-31')throw new Error('CryptoCon 비교에는 완료된 2025년 일별 관측이 필요합니다.');
  const peak=highest(year),beforePeak=year.filter(row=>row.date<=peak.date);
  const thresholds=[.9,.95,.97,.98,.99].map(ratio=>{
    const first=beforePeak.find(row=>row.price>=peak.price*ratio);
    const window=beforePeak.filter(row=>row.date>=first.date);
    let runningHigh=0,maxDrawdownPct=0;
    for(const row of window){runningHigh=Math.max(runningHigh,row.price);maxDrawdownPct=Math.min(maxDrawdownPct,(row.price/runningHigh-1)*100);}
    const aboveDays=window.filter(row=>row.price>=peak.price*ratio).length;
    return {ratio,firstDate:first.date,firstPrice:first.price,peakDate:peak.date,peakPrice:peak.price,leadDays:utcDay(peak.date)-utcDay(first.date),aboveDays,windowDays:window.length,maxDrawdownPct};
  });
  const timing=CRYPTOCON_TIMING_CLAIMS.map(claim=>{
    const within=peak.date>=claim.start&&peak.date<=claim.end;
    return {...claim,within,daysFromWindowStart:utcDay(peak.date)-utcDay(claim.start),daysFromCenter:claim.center?utcDay(peak.date)-utcDay(claim.center):null,
      assessment:claim.kind==='retrospective'?'사후 설명 · 적중 채점 제외':claim.kind==='alternative'?'대안 창 밖':within?'사전 월 단위 일치':'원래 날짜 창 밖'};
  });
  const targets=CRYPTOCON_PRICE_CLAIMS.map(claim=>{
    const end=claim.observationEnd<rows.at(-1).date?claim.observationEnd:rows.at(-1).date;
    const selected=rows.filter(row=>row.date>=claim.observationStart&&row.date<=end),observedPeak=highest(selected);
    const reached=Boolean(observedPeak&&observedPeak.price>=claim.target);
    return {...claim,observedThrough:end,observedPeak,reached,gapPct:observedPeak?(observedPeak.price/claim.target-1)*100:null,
      assessment:claim.deadline?(end<claim.deadline?'시한 미도래':reached?'일말 목표 도달':'시한 내 일말 미도달'):claim.id==='cycle-130k'?'2025년 고점 크기 비교':reached?'기준일까지 일말 도달':'시한 없음 · 기준일까지 미도달'};
  });
  return {asOf:CRYPTOCON_AUDIT_AS_OF,observedThrough:rows.at(-1).date,priceDefinition:'Coin Metrics PriceUSD · UTC 일말 가격',peak,thresholds,timing,targets};
}
