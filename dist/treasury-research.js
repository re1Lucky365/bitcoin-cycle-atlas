import { TREASURY_DATA, MARKET_ANCHORS } from './treasury-catalog.js?v=1.19.0';

export const TREASURY_SOURCES=Object.values(TREASURY_DATA).flatMap(data=>data.sources.map(source=>({...source,symbol:data.symbol})));
export const TREASURY_EVENTS=Object.values(TREASURY_DATA).flatMap(data=>data.events).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
export const TREASURY_FUTURE_EVENTS=Object.values(TREASURY_DATA).flatMap(data=>data.futureEvents||[]);
export const TREASURY_TARGETS=Object.values(TREASURY_DATA).flatMap(data=>(data.leadershipTargets||[]).map(target=>({...target,symbol:data.symbol})));
export const TREASURY_MARKET_ANCHORS=MARKET_ANCHORS;
export const TREASURY_SNAPSHOTS=Object.fromEntries(Object.values(TREASURY_DATA).map(data=>{
  const snapshot={...data.snapshot,publishedAt:data.sources.find(source=>source.id===data.snapshot.sourceIds[0])?.publishedAt,debtSchedule:data.debtSchedule||[],modelAdjustments:[]};
  for(const event of data.postSnapshotEvents||[])if(event.type==='preferred-issuance')snapshot.modelAdjustments.push({
    date:event.date,publishedAt:data.sources.find(source=>source.id===event.sourceIds.at(-1))?.publishedAt||event.date,
    cashUsd:event.netCashProceedsUsd,preferredUsd:event.minimumPreferredLiquidationUsd,annualExpensesUsd:event.annualPreferredDividendUsd,
    sourceIds:event.sourceIds,note:'공시된 최초 발행만 반영한 가정 조정. 이후 사용·추가 발행을 복원한 현재 재무제표가 아님.',
  });
  return [data.symbol,snapshot];
}));
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function treasuryEventMarkup(event){
  return `<p class="research-kicker">${esc(event.symbol)} · ${esc(event.date)} · ${esc(event.category)}</p><p>${esc(event.description)}</p><p class="research-caveat">역사 날짜는 확인한 발표·거래·정책 기준입니다. 같은 시기의 주가 변화가 이 사건만의 효과라는 뜻은 아닙니다. 원문의 날짜와 거래 세션을 구분합니다.</p>`;
}
