/** Chart membership and visibility are separate: a hidden indicator stays added. */
export const INDICATORS = Object.freeze([
  {id:'readout',label:'가격 · OHLC 읽기',category:'표시',description:'왼쪽 위의 가격, 날짜, 시가·고가·저가·종가',default:true},
  {id:'source',label:'자료 출처',category:'표시',description:'가격·거래량 제공자와 수집 시각',default:true},
  {id:'legend',label:'차트 범례',category:'표시',description:'오른쪽 위의 실제 가격·미래 가정·사이클 색상 범례',default:true},
  {id:'countdown',label:'다음 국면 · D-day',category:'가격 지표',description:'미래 경로에서 7일 유지되는 다음 국면까지 · 조건부 가정',default:true,dailyOnly:true},
  {id:'volume',label:'거래량',category:'가격 지표',description:'실제 BTC 수량과 장기 조건부 거래량',control:'atlas-volume',default:true},
  {id:'history',label:'역사 사건',category:'가격 지표',description:'확대 수준에 맞춘 사건 이름과 원문',control:'atlas-history-events',default:true,dailyOnly:true},
  {id:'range',label:'수요·채택 가정 범위',category:'가격 지표',description:'장기 가격 시나리오의 범위 · 확률구간 아님',control:'lab-band',default:true,dailyOnly:true},
  {id:'turns',label:'고점·저점',category:'가격 지표',description:'관측 전환점과 미래 조건부 방향 후보',control:'lab-turns',default:true,dailyOnly:true},
  {id:'cycle-landmarks',label:'사이클 주요 지점',category:'가격 지표',description:'CYCLE TOP · PIT STOP · FIRST TOP · ATH · MID-TOP · BOTTOM, 여섯 색 원형 표시',control:'lab-milestones',default:true,dailyOnly:true},
  {id:'cycle-intervals',label:'사이클 기간 비교',category:'가격 지표',description:'BOTTOM → CYCLE TOP 등 아홉 관계의 실제 경과 주·일, 미래 가정 포함',control:'lab-cycle-intervals',default:true,dailyOnly:true},
  {id:'cycle-timing',label:'사이클 시계 · 레인보우',category:'가격 지표',description:'조건부 시계 대비 단축·기준·연장 · 매매 신호 아님',default:true,dailyOnly:true},
  {id:'drawdown',label:'전고점 대비 낙폭',category:'가격 지표',description:'날짜별 이전 최고 가격에서 떨어진 비율',control:'atlas-drawdown',dailyOnly:true},
  {id:'states',label:'상승·횡보·하락',category:'가격 지표',description:'당시까지의 가격으로 분류한 시장 국면',control:'atlas-states',dailyOnly:true},
  {id:'fibonacci',label:'피보나치 되돌림',category:'가격 지표',description:'확인된 최근 스윙의 되돌림 기준',control:'lab-fib',dailyOnly:true},
  {id:'cycles',label:'4년 비교',category:'분석 창',description:'독립 경과일 축으로 비교하는 과거 사이클',analysis:true},
  {id:'duration',label:'구간 길이',category:'분석 창',description:'사이클과 상승·하락 구간의 실제 지속 기간',analysis:true},
  {id:'peaks',label:'고점권 도달',category:'분석 창',description:'과거 고점권 도달 시기와 체류 분석',analysis:true},
  {id:'periods',label:'월·분기',category:'분석 창',description:'기간 수익률·낙폭·변동성·최고가 기록',analysis:true},
  {id:'cryptocon',label:'CryptoCon 검증',category:'분석 창',description:'공개 전망의 시점·목표와 실제 관측 대조',analysis:true}
].map(Object.freeze));

const ids=new Set(INDICATORS.map(item=>item.id));
const analyses=new Set(INDICATORS.filter(item=>item.analysis).map(item=>item.id));
const studies=new Set(INDICATORS.filter(item=>item.category!=='표시').map(item=>item.id));
const defaults=INDICATORS.filter(item=>item.default).map(item=>item.id);
const ordered=values=>{const wanted=new Set(values);return INDICATORS.filter(item=>wanted.has(item.id)).map(item=>item.id);};

export function normalizeIndicatorState(value={}) {
  const added=ordered(Array.isArray(value.added)?value.added:defaults);
  const hidden=ordered((Array.isArray(value.hidden)?value.hidden:[]).filter(id=>added.includes(id)));
  const minimized=ordered((Array.isArray(value.minimized)?value.minimized:[]).filter(id=>analyses.has(id)&&added.includes(id)));
  const active=analyses.has(value.active)&&added.includes(value.active)&&!hidden.includes(value.active)?value.active:added.find(id=>analyses.has(id)&&!hidden.includes(id))||added.find(id=>analyses.has(id))||'cycles';
  const primary=ids.has(value.primary)&&added.includes(value.primary)?value.primary:null;
  return {added,hidden,minimized,active,primary,collapsed:value.collapsed===true};
}

export function readIndicatorState(search='',{mobile=globalThis.matchMedia?.('(max-width:620px)')?.matches??false}={}) {
  const params=search instanceof URLSearchParams?search:new URLSearchParams(search);
  const added=params.has('indicators')?params.get('indicators').split(','):defaults.slice();
  const hidden=params.get('indicator-hide')?.split(',')||[];
  const legacy=params.get('chart'),legacyCompare=params.get('page')==='compare'&&!params.has('legacy')&&legacy!=='price';
  if(!params.has('indicators')&&(analyses.has(legacy)||legacyCompare)){
    const mode=analyses.has(legacy)?legacy:'cycles';added.push(mode);if(params.get('dock')==='closed')hidden.push(mode);
  }
  const legend=params.get('indicator-list');
  return normalizeIndicatorState({added,hidden,minimized:params.get('indicator-minimize')?.split(',')||[],active:legacy,primary:params.get('indicator-primary'),collapsed:legend==='closed'||legend!=='open'&&mobile});
}

export function writeIndicatorState(params,state) {
  const next=normalizeIndicatorState(state),defaultKey=defaults.join(','),addedKey=next.added.join(',');
  if(addedKey===defaultKey)params.delete('indicators');else params.set('indicators',addedKey);
  if(next.hidden.length)params.set('indicator-hide',next.hidden.join(','));else params.delete('indicator-hide');
  if(next.minimized.length)params.set('indicator-minimize',next.minimized.join(','));else params.delete('indicator-minimize');
  // Both choices are explicit in shared/saved charts, even across device sizes.
  params.set('indicator-list',next.collapsed?'closed':'open');
  if(next.primary)params.set('indicator-primary',next.primary);else params.delete('indicator-primary');
  if(next.added.some(id=>analyses.has(id)))params.set('chart',next.active);else params.delete('chart');
  params.delete('dock');
  return params;
}

export function isIndicatorVisible(state,id) {return state.added.includes(id)&&!state.hidden.includes(id);}
export function visibleAnalysisIds(state) {return INDICATORS.filter(item=>item.analysis&&isIndicatorVisible(state,item.id)).map(item=>item.id);}

export function changeIndicatorState(state,{action,id,state:replacement}) {
  const next=normalizeIndicatorState(state);
  if(action==='reset')return normalizeIndicatorState();
  if(action==='replace')return replacement&&Array.isArray(replacement.added)?normalizeIndicatorState(replacement):next;
  if(action==='primary')return id==null?{...next,primary:null}:next.added.includes(id)?{...next,primary:id}:next;
  if(action==='collapse')return {...next,collapsed:!next.collapsed};
  if(action==='show-all')return {...next,hidden:next.hidden.filter(id=>!studies.has(id))};
  if(action==='hide-all')return normalizeIndicatorState({...next,hidden:[...next.hidden,...next.added.filter(id=>studies.has(id))]});
  if(!ids.has(id))return next;
  if(action==='minimize')return analyses.has(id)&&next.added.includes(id)?normalizeIndicatorState({...next,minimized:next.minimized.includes(id)?next.minimized.filter(value=>value!==id):[...next.minimized,id]}):next;
  if(action==='activate')return analyses.has(id)&&isIndicatorVisible(next,id)?{...next,active:id}:next;
  if(action==='toggle')action=next.added.includes(id)?'remove':'add';
  if(action==='add'&&!next.added.includes(id)){next.added.push(id);next.hidden=next.hidden.filter(value=>value!==id);if(analyses.has(id))next.active=id;}
  else if(action==='remove'){next.added=next.added.filter(value=>value!==id);next.hidden=next.hidden.filter(value=>value!==id);}
  else if(action==='visibility'&&next.added.includes(id)){next.hidden=next.hidden.includes(id)?next.hidden.filter(value=>value!==id):[...next.hidden,id];if(analyses.has(id)&&!next.hidden.includes(id))next.active=id;}
  return normalizeIndicatorState(next);
}

export function searchIndicators(query='',category='전체') {
  const terms=String(query).trim().toLocaleLowerCase().split(/\s+/u).filter(Boolean);
  return INDICATORS.filter(item=>(category==='전체'||item.category===category)&&terms.every(term=>`${item.label} ${item.description} ${item.id}`.toLocaleLowerCase().includes(term)));
}
