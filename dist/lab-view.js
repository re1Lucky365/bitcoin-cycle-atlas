import { buildDetailedForecast } from './detailed-forecast.js';
import { FORECAST_VALIDATION, FORECAST_SENSITIVITY } from './forecast-validation.js';
import { analyzeMarketStructure, computeRollingStates, detectDirectionalChanges, STATE_LABELS } from './market-structure.js';
import { utcDay, dateFromDay } from './cycle-engine.js';
import { shiftCalendarMonths } from './cycle-timing.js';

const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nf = (value, digits = 0) => Number.isFinite(value) ? new Intl.NumberFormat('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value) : '—';
const usd = (value, digits = 0) => Number.isFinite(value) ? `$${nf(value, digits)}` : '—';
const pct = (value, digits = 1) => Number.isFinite(value) ? `${value > 0 ? '+' : value < 0 ? '−' : ''}${nf(Math.abs(value), digits)}%` : '—';
const dateLabel = (date) => date?.replaceAll('-', '.') ?? '—';
const compact = (value) => value >= 1e6 ? `${nf(value/1e6,1)}M` : value >= 1e3 ? `${nf(value/1e3, value < 1e4 ? 1 : 0)}k` : nf(value,value < 1 ? 2 : 0);
const tone = (value) => value < 0 ? 'lab-down' : value > 0 ? 'lab-up' : '';
const COLORS = Object.freeze({ warmup:'#4c5664','price-discovery':'#e8ba6d','bottom-formation':'#8394c9',range:'#8f9ba8',rebound:'#72b9ae',pullback:'#b293ad',advance:'#6e9f87',correction:'#bd7e82',transition:'#617181' });
const REPORT_ROOT = 'https://github.com/twoimo/bitcoin-cycle-atlas/blob/main/docs/';
const D = (d) => utcDay(d);
function download(name, content, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], {type})); const a = document.createElement('a'); a.href=url; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function linePath(rows, x, y, key = 'price') { return rows.map((p,i)=>`${i?'L':'M'}${x(p).toFixed(2)},${y(p[key]).toFixed(2)}`).join(''); }
function nearest(rows, day) {
  let lo=0,hi=rows.length-1;
  while(lo<hi){const mid=(lo+hi)>>1;if(D(rows[mid].date)<day)lo=mid+1;else hi=mid;}
  if(lo>0&&Math.abs(D(rows[lo-1].date)-day)<Math.abs(D(rows[lo].date)-day))lo--;
  return lo;
}
function axisTicks(min,max) {
  const list=[];
  for(let e=Math.floor(Math.log10(min))-1;e<=Math.ceil(Math.log10(max))+1;e++)for(const m of [1,2,5]){const v=m*10**e;if(v>=min&&v<=max)list.push(v);}
  const stride=Math.max(1,Math.ceil(list.length/7));return list.filter((_,i)=>i%stride===0);
}
function sampled(rows, frequency) {
  if(frequency==='daily')return rows;
  return rows.filter((p,i)=>new Date(`${p.date}T00:00:00Z`).getUTCDay()===0||i===rows.length-1||i===0);
}
function makeSegments(rows) {
  const out=[];for(const r of rows){const last=out.at(-1);if(last&&last.state===r.state)last.endDate=r.date;else out.push({startDate:r.date,endDate:r.date,state:r.state});}return out;
}
function simpleTable(headers, rows) {
  return `<div class="lab-table-scroll"><table class="lab-table"><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(cell=>`<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

/** Pure SVG drawing: chart geometry never changes model data. */
function drawChart({svg,tooltip,rows,start,end,split,frequency='daily',stateStepDays=1,unit='usd',denominator=1,band=false,turns=[],events=[],states=[],fib=[],historical=false,nextTurn=null}) {
  const W=1100,H=510,L=67,R=30,T=40,B=H-34,priceBottom=325,ddTop=367,ddBottom=438,stateTop=460,stateBottom=468;
  const minDay=D(start),maxDay=D(end),fullHistory=maxDay-minDay>3000,xday=day=>L+(day-minDay)/(maxDay-minDay)*(W-L-R),x=p=>xday(D(p.date));
  const visible=rows.filter(p=>p.date>=start&&p.date<=end);
  if(!visible.length){svg.innerHTML='<text x="30" y="50" fill="#b8c3cf">이 구간의 관측 자료가 없습니다.</text>';return;}
  const factor=unit==='indexed'?100/denominator:1;
  const values=visible.flatMap(p=>band&&p.lower>0&&p.upper>0?[p.lower,p.upper,p.price]:[p.price]);
  const min=Math.min(...values)*.80,max=Math.max(...values)*1.23;
  const y=value=>priceBottom-(Math.log(value)-Math.log(min))/(Math.log(max)-Math.log(min))*(priceBottom-T);
  const yd=value=>ddTop+Math.min(100,Math.max(0,-(value??0)))/100*(ddBottom-ddTop);
  const observed=sampled(visible.filter(p=>!split||p.date<=split),frequency),future=sampled(visible.filter(p=>split&&p.date>=split),frequency).map(p=>({...p,lower:p.lower??p.price,upper:p.upper??p.price}));
  const clip=`${svg.id}-clip`,ticks=axisTicks(min*factor,max*factor);
  let content=`<title>${historical?'비트코인 가격과 국면':'비트코인 향후 3년 조건부 모의 경로'}</title><desc>가격은 로그 눈금입니다. 아래 패널은 이전 최고가 대비 낙폭입니다. 미래 범위는 확률 보정된 예측구간이 아닙니다.</desc><defs><clipPath id="${clip}"><rect x="${L}" y="${T}" width="${W-L-R}" height="${stateBottom-T}"/></clipPath></defs>`;
  if(split&&D(split)>=minDay&&D(split)<=maxDay){const sx=xday(D(split));content+=`<rect x="${L}" y="${T}" width="${sx-L}" height="${stateBottom-T}" fill="#b5c5dd" opacity=".025"/><line x1="${sx}" x2="${sx}" y1="${T}" y2="${stateBottom}" stroke="#7e8b9c" stroke-dasharray="3 5"/><text x="${fullHistory?sx-8:sx+8}" y="25" text-anchor="${fullHistory?'end':'start'}" fill="#a3afbe" font-size="11">관측 종료 ${esc(split.slice(5).replace('-','.'))}</text>`;}
  for(const v of ticks){const yy=y(v/factor);content+=`<line x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}" stroke="#27313e" stroke-width=".8"/><text x="${L-12}" y="${yy+4}" text-anchor="end" fill="#9eacbf" font-size="11">${unit==='usd'?'$':''}${compact(v)}</text>`;}
  const span=maxDay-minDay,months=span>3000?24:span>1500?12:span>750?6:3;
  let tick=`${start.slice(0,4)}-01-01`;
  while(D(tick)<minDay)tick=shiftCalendarMonths(tick,months);
  while(D(tick)<=maxDay){const xx=xday(D(tick));content+=`<line x1="${xx}" x2="${xx}" y1="${T}" y2="${stateBottom}" stroke="#242c38" stroke-width=".65"/><text x="${xx}" y="${B+12}" text-anchor="middle" fill="#9caabc" font-size="11">${months>=12?tick.slice(0,4):tick.slice(0,7).replace('-','.')}</text>`;tick=shiftCalendarMonths(tick,months);}
  content+=`<text x="${L}" y="351" fill="#9baabd" font-size="10">전고점 대비 낙폭</text>`;
  for(const dd of [0,-50,-100])content+=`<line x1="${L}" x2="${W-R}" y1="${yd(dd)}" y2="${yd(dd)}" stroke="#27313e" stroke-width=".6"/><text x="${L-12}" y="${yd(dd)+4}" text-anchor="end" fill="#9caabc" font-size="10">${dd}%</text>`;
  content+=`<g clip-path="url(#${clip})">`;
  if(band&&future.length){const upper=linePath(future,x,y,'upper');const lower=[...future].reverse().map(p=>`L${x(p).toFixed(2)},${y(p.lower).toFixed(2)}`).join('');content+=`<path d="${upper}${lower}Z" fill="#f2aa4c" opacity=".095"/><path d="${linePath(future,x,y,'upper')}" fill="none" stroke="#c6a267" opacity=".24" stroke-width="1"/><path d="${linePath(future,x,y,'lower')}" fill="none" stroke="#c6a267" opacity=".24" stroke-width="1"/>`;}
  for(const f of fib.filter(f=>f.price>min&&f.price<max)){const yy=y(f.price);content+=`<line x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}" stroke="#a498c5" opacity=".4" stroke-dasharray="2 5"/><text x="${W-R-5}" y="${yy-4}" text-anchor="end" fill="#b1a5d3" font-size="10">${nf(f.ratio*100,1)}% · ${usd(f.price)}</text>`;}
  const stateRows=states.filter(p=>p.date>=start&&p.date<=end);
  for(const seg of makeSegments(stateRows)){const a=xday(D(seg.startDate)),b=xday(D(seg.endDate)+stateStepDays);content+=`<rect x="${a}" y="${stateTop}" width="${Math.max(.7,b-a)}" height="${stateBottom-stateTop}" fill="${COLORS[seg.state]||COLORS.transition}" opacity=".8"/>`;}
  if(observed.length){content+=`<path d="${linePath(observed,x,y)}" fill="none" stroke="#dce4ee" stroke-width="1.5" vector-effect="non-scaling-stroke"/><path d="${linePath(observed,x,yd,'drawdownPct')}" fill="none" stroke="#9ba9bc" stroke-width="1" vector-effect="non-scaling-stroke"/>`;}
  if(future.length){content+=`<path d="${linePath(future,x,y)}" fill="none" stroke="#f2b15a" stroke-width="1.55" vector-effect="non-scaling-stroke" stroke-dasharray="4 2"/><path d="${linePath(future,x,yd,'drawdownPct')}" fill="none" stroke="#cc995e" stroke-width="1" opacity=".9" vector-effect="non-scaling-stroke"/>`;}
  const visibleTurns=turns.filter(e=>e.date>=start&&e.date<=end);
  for(const e of visibleTurns)content+=`<circle cx="${xday(D(e.date))}" cy="${y(e.price)}" r="${fullHistory?1.8:3.2}" fill="#10151c" stroke="${e.type==='high'?'#e8bd7a':'#83b4ca'}" stroke-width="1.25"><title>${esc(`${e.type==='high'?'고점':'저점'} ${e.date} ${usd(e.price)} · ${historical?'확인':'모의 확인'} ${e.confirmationDate??'미확인'}`)}</title></circle>`;
  content+='</g>';
  if(nextTurn&&nextTurn.date>=start&&nextTurn.date<=end){
    const nx=xday(D(nextTurn.date)),left=xday(Math.max(minDay,D(nextTurn.lowerDate||nextTurn.date))),right=xday(Math.min(maxDay,D(nextTurn.upperDate||nextTurn.date)));
    content+=`<rect x="${left}" y="${T}" width="${Math.max(1,right-left)}" height="${priceBottom-T}" fill="#8caed4" opacity=".035"/><line x1="${nx}" x2="${nx}" y1="${T}" y2="${stateBottom}" stroke="#98b6d7" stroke-dasharray="4 5" opacity=".75"/><text x="${Math.min(W-R-5,nx+7)}" y="${fullHistory?25:T+15}" text-anchor="${nx>W-140?'end':'start'}" fill="#aec9e5" font-size="11">${esc(nextTurn.shortLabel)}</text>`;
  }
  const usedLabels=[];
  for(const e of events.filter(e=>!fullHistory&&e.date>=start&&e.date<=end)){
    const xx=xday(D(e.date));let level=0;while(usedLabels.some(p=>p.level===level&&Math.abs(p.x-xx)<135))level++;usedLabels.push({x:xx,level});
    content+=`<line x1="${xx}" x2="${xx}" y1="${T+5+level*18}" y2="${priceBottom}" stroke="#ba9d76" stroke-dasharray="2 5" opacity=".38"/><text x="${Math.min(W-R-5,Math.max(L+5,xx))}" y="${T+12+level*18}" text-anchor="${xx>W-180?'end':'start'}" fill="#c8ad84" font-size="10">${esc(e.shortLabel||e.label)}</text>`;
  }
  content+=`<g id="${svg.id}-cross" visibility="hidden"><line x1="0" x2="0" y1="${T}" y2="${stateBottom}" stroke="#aab8cb" opacity=".6"/><circle r="4" fill="#10151c" stroke="#eed1a2" stroke-width="1.5"/></g>`;
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.innerHTML=content;
  let active=visible.length-1;
  const cross=svg.querySelector(`#${svg.id}-cross`),crossLine=cross.querySelector('line'),crossDot=cross.querySelector('circle');
  const stateByDate=new Map(states.map(p=>[p.date,p]));
  const show=(index,clientX,clientY)=>{
    active=Math.max(0,Math.min(visible.length-1,index));const p=visible[active],cx=x(p),cy=y(p.price),isFuture=split&&p.date>split,s=stateByDate.get(p.date);
    cross.setAttribute('visibility','visible');crossLine.setAttribute('x1',cx);crossLine.setAttribute('x2',cx);crossDot.setAttribute('cx',cx);crossDot.setAttribute('cy',cy);
    const event=visibleTurns.find(e=>e.date===p.date);const barNote=frequency==='weekly'?'주간 종가 표시 · 마지막 주 일부 · 커서는 일별 값':'일별 값';
    tooltip.innerHTML=`<strong>${esc(dateLabel(p.date))} · ${isFuture?'모의 경로':'관측'}</strong><div class="tooltip-price">${unit==='indexed'?nf(p.price*factor,1):usd(p.price,2)}</div><div class="tooltip-pair"><span>전고점 대비</span><b>${pct(p.drawdownPct)}</b></div>${s?`<div class="tooltip-pair"><span>국면</span><b>${esc(STATE_LABELS[s.state]||s.state)}</b></div>`:''}${isFuture&&p.lower?`<div class="tooltip-divider">10–90% 경로 범위<br>${usd(p.lower)} — ${usd(p.upper)}<br><span class="tooltip-secondary">확률 보정 전 · 대표 경로가 범위를 벗어날 수 있음</span></div>`:''}${event?`<div class="tooltip-divider">${event.type==='high'?'고점':'저점'} ${historical?'관측':'후보'} · 방향 전환<br>${historical?'관측 확인일':'모의 경로 내 확인'} ${esc(event.confirmationDate||'표시 범위 밖')}</div>`:''}<div class="tooltip-secondary">${barNote}</div>`;
    tooltip.hidden=false;const rect=svg.getBoundingClientRect(),wrap=svg.parentElement.getBoundingClientRect();
    const px=clientX??rect.left+cx/W*rect.width,py=clientY??rect.top+cy/H*rect.height;
    tooltip.style.left=`${Math.max(6,Math.min(wrap.width-tooltip.offsetWidth-7,px-wrap.left+14))}px`;tooltip.style.top=`${Math.max(8,Math.min(wrap.height-tooltip.offsetHeight-8,py-wrap.top-30))}px`;
  };
  const hide=()=>{tooltip.hidden=true;cross.setAttribute('visibility','hidden');};
  svg.onpointermove=e=>{const rect=svg.getBoundingClientRect(),pos=(e.clientX-rect.left)/rect.width*W;if(pos<L||pos>W-R){hide();return;}show(nearest(visible,minDay+(pos-L)/(W-L-R)*(maxDay-minDay)),e.clientX,e.clientY);};
  svg.onpointerleave=hide;svg.onblur=hide;
  svg.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End','Escape'].includes(e.key))return;e.preventDefault();if(e.key==='Escape'){hide();return;}show(e.key==='Home'?0:e.key==='End'?visible.length-1:active+(e.key==='ArrowRight'?1:-1)*(frequency==='weekly'?7:1));};
}

export function initLabView() {
  const state={dataset:null,base:null,analysis:null,models:new Map(),visible:false,compareVisible:false,scenario:'base',frequency:'daily',unit:'usd',window:'all',eventMode:'macro',eventPage:0,structureFrequency:'weekly',scope:'all',threshold:.12,alignment:'calendar',period:'monthly',periodPage:0,pending:false};
  function fail(error){console.error('Detailed research workspace',error);$('#lab-error').hidden=false;$('#lab-error').textContent='분석을 계산하지 못했습니다. 원자료와 계산 결과를 확인해 주세요.';}
  function base(){
    if(state.base)return state.base;
    const daily=computeRollingStates(state.dataset),weekly=computeRollingStates(state.dataset,{frequency:'weekly'}),pivots=detectDirectionalChanges(state.dataset);
    let high=0;const rows=state.dataset.prices.map(([date,price])=>{high=Math.max(high,price);return {date,price,drawdownPct:(price/high-1)*100};});
    state.base={daily,weekly,pivots,rows};return state.base;
  }
  function model(){
    if(state.models.has(state.scenario))return state.models.get(state.scenario);
    const asOf=state.dataset.prices.at(-1)[0],referenceDate=asOf>'2026-10-21'?dateFromDay(D(asOf)+1):'2026-10-22';
    const m=buildDetailedForecast(state.dataset,{asOf,referenceDate,scenario:state.scenario,seed:20261022,sampleCount:128,blockDays:28});
    state.models.set(state.scenario,m);return m;
  }
  function currentFib(){
    const pivots=base().pivots.pivots;if(pivots.length<2)return[];
    const a=pivots.at(-2),b=pivots.at(-1),low=Math.min(a.eventPrice,b.eventPrice),high=Math.max(a.eventPrice,b.eventPrice);
    return [.236,.382,.5,.618,.786].map(ratio=>({ratio,price:b.type==='high'?high-ratio*(high-low):low+ratio*(high-low)}));
  }
  function drawOutlook(){
    if(!state.dataset||!state.visible)return;
    try{
      const m=model(),b=base(),last=b.rows.at(-1),ath=Math.max(...b.rows.map(r=>r.price));let peak=ath;
      const future=m.path.filter(r=>r.date>m.asOf).map(r=>{peak=Math.max(peak,r.price);return {...r,drawdownPct:(r.price/peak-1)*100};});
      const allRows=[...b.rows,...future];const ref=m.referenceDate||'2026-10-22',end=m.displayEnd||shiftCalendarMonths(ref,36);
      let start=dateFromDay(D(m.asOf)-365),chartEnd=end;
      if(state.window==='history')start=b.rows[0].date;
      else if(state.window!=='all'){start=shiftCalendarMonths(ref,12*Number(state.window));chartEnd=shiftCalendarMonths(start,12);}
      const next=nextTurnInfo(m);
      const simStates=computeRollingStates({prices:[...state.dataset.prices,...future.map(p=>[p.date,p.price])]}).points;
      drawChart({svg:$('#lab-chart'),tooltip:$('#lab-tooltip'),rows:allRows,start,end:chartEnd,split:m.asOf,frequency:state.frequency,unit:state.unit,denominator:last.price,band:$('#lab-band').checked,turns:$('#lab-turns').checked?m.localTurns:[],events:m.events.filter(e=>e.inHorizon),states:simStates,fib:$('#lab-fib').checked?currentFib():[],nextTurn:next});
      $('#lab-asof').textContent=`관측 종료 ${dateLabel(m.asOf)} UTC`;
      $('.lab-date').childNodes[0].textContent=`${dateLabel(ref)} — ${dateLabel(end)}`;
      const current=b.daily.current;
      $('#lab-metrics').innerHTML=`<div class="lab-metric"><span class="lab-metric-label">마지막 일말 가격</span><strong>${usd(last.price)}</strong><small>최종 관측 최고가 대비 ${pct(current.athDrawdownPct)}</small></div><div class="lab-metric"><span class="lab-metric-label">현재 내부 국면</span><strong class="lab-small-value">${esc(STATE_LABELS[current.state])}</strong><small>28일 수익률 ${pct(current.rollingReturnPct)}</small></div><div class="lab-metric"><span class="lab-metric-label">다음 방향 전환 · 모의 후보</span><strong class="lab-small-value">${esc(next?.direction||'계산 범위 밖')}</strong><small>${next?dateLabel(next.date):'—'} · 모의 날짜 중앙값</small></div><div class="lab-metric"><span class="lab-metric-label" title="연구 기준일 대비 달력 일수">다음 후보일까지 · 기준일 대비</span><strong>${next?`D${next.days===0?'-DAY':next.days>0?'-'+nf(next.days):'+'+nf(-next.days)}`:'—'}</strong><small>${next?`후보 범위 ${dateLabel(next.lowerDate)} — ${dateLabel(next.upperDate)}`:'확인할 전환 없음'}</small></div>`;
      $('#lab-chart-title').textContent=`${m.scenario.label} · ${state.frequency==='daily'?'일별':'주별'} 대표 경로`;
      renderEvents(m);renderForecastMethod(m);$('#lab-error').hidden=true;
    }catch(error){fail(error);}
  }
  function nextTurnInfo(m){
    const windows=m.diagnostics.firstTurnWindows||{};
    const candidates=['high','low'].filter(type=>windows[type]?.medianDate&&windows[type].medianDate>=m.referenceDate).map(type=>({type,...windows[type]})).sort((a,b)=>a.medianDate.localeCompare(b.medianDate));
    if(candidates.length){const n=candidates[0],days=D(n.medianDate)-D(m.referenceDate);return {type:n.type,date:n.medianDate,lowerDate:n.lowerDate,upperDate:n.upperDate,days,direction:n.type==='high'?'상승 → 조정':'조정 → 반등',shortLabel:`다음 ${n.type==='high'?'고점':'저점'} 후보 · D−${nf(days)}`};}
    const n=m.localTurns.find(p=>p.date>=m.referenceDate);if(!n)return null;
    return {type:n.type,date:n.date,lowerDate:n.date,upperDate:n.date,days:D(n.date)-D(m.referenceDate),direction:n.type==='high'?'상승 → 조정':'조정 → 반등',shortLabel:`대표 ${n.type==='high'?'고점':'저점'} 후보`};
  }
  function renderEvents(m){
    const local=state.eventMode==='local',rows=local?m.localTurns:m.events,pageSize=8,start=local?state.eventPage*pageSize:0,selected=local?rows.slice(start,start+pageSize):rows;
    $('#lab-events-head').innerHTML=local?'<tr><th>모의 전환</th><th>경로상 날짜</th><th>경로상 가격</th><th>모의 확인일</th><th>확인 지연</th></tr>':'<tr><th>조건부 기준점</th><th>날짜 · UTC</th><th>D-day</th><th>기준선 가격</th><th>표시 범위</th></tr>';
    $('#lab-events-body').innerHTML=selected.map(r=>local?`<tr><td>${r.type==='high'?'고점 후보':'저점 후보'}</td><td>${esc(dateLabel(r.date))}</td><td>${usd(r.price)}</td><td>${esc(dateLabel(r.confirmationDate))}</td><td class="lab-muted-cell">${nf(r.lagDays)}일</td></tr>`:`<tr><td>${esc(r.label)}</td><td class="lab-accent-cell">${esc(dateLabel(r.date))}</td><td>D${D(r.date)>=D(m.referenceDate)?'-':'+'}${nf(Math.abs(D(r.date)-D(m.referenceDate)))}</td><td>${usd(r.price)}</td><td class="lab-muted-cell">${r.inHorizon?'3년 내':'3년 밖'}</td></tr>`).join('');
    $('#lab-events-foot').innerHTML=local?`대표 모의 경로의 전환입니다. 실제 발생일의 예측이나 매매 신호가 아닙니다. <span>${Math.min(start+1,rows.length)}–${Math.min(start+pageSize,rows.length)} / ${rows.length}</span><button id="lab-turn-prev" ${start===0?'disabled':''} aria-label="이전 고저점">←</button><button id="lab-turn-next" ${start+pageSize>=rows.length?'disabled':''} aria-label="다음 고저점">→</button>`:'기준일과 가격은 거시 가정입니다. 대표 경로의 실제 최고·최저값은 이 기준점과 다를 수 있습니다.';
    if(local){$('#lab-turn-prev').onclick=()=>{state.eventPage=Math.max(0,state.eventPage-1);renderEvents(m);};$('#lab-turn-next').onclick=()=>{state.eventPage++;renderEvents(m);};}
  }
  function renderForecastMethod(m){
    const assumptions=m.assumptions||{},training=m.training||{},diagnostics=m.diagnostics||{};
    $('#lab-method').innerHTML=`<h3>큰 시계와 작은 움직임</h3><p>명목 48개월 시계와 약 3년 상승·1년 하락은 사용자가 선택한 조건입니다. 과거 잔차를 28일 블록으로 재표본해 조정, 반등, 횡보가 반복되는 일별 경로를 만듭니다. 차트의 한 선은 128개 중 실제로 생성된 대표 경로이며, 날짜별 중앙값을 이어 붙인 선이 아닙니다.</p><div class="lab-formula">N = 이전 관측 고점 + 48개월<br>Z = N − A, &nbsp; P = N − A + D<br>log P*(t) = 거시 기준선(t) + R(t) − (t/T)R(T)</div><p>A는 고점권 선행 기간, D는 그 이후 머무는 기간입니다. 선행이 빨라도 머무는 기간이 같이 늘면 최종 고점은 빨라지지 않습니다. 블록 잔차의 연결 조건은 현재 가격과 표시 범위 밖의 다음 거시 저점 기준 가격을 잇습니다. 마지막 기준 가격은 모형에 의해 고정되며, 중간 고저점이나 2026년 저점 유지 조건은 강제하지 않습니다.</p><h3>범위와 고저점의 의미</h3><p>음영은 동일 가정에서 발생한 경로의 날짜별 10·90 분위수입니다. 80%의 실제 미래를 포괄한다는 뜻이 아닙니다. 12% 반대 방향 이동 뒤에만 고저점을 확인하며, 표에는 발생일과 모의 확인일을 분리했습니다. D-day는 연구 기준일에서 조건부 모의 중앙일까지 남은 달력 일수입니다. 후보 구간은 각 경로의 첫 고점·첫 저점 날짜의 10–90 분위수이며, 특정일 도달 확률이나 시장의 확정 일정이 아닙니다. 주봉은 일말 자료를 재집계한 값으로 장중 캔들이 아닙니다.</p><h3>과거 검증과 반증</h3>${simpleTable(['평가 기간','모형 중앙경로 MAPE','가격 고정 MAPE','모형 로그오차','가격 고정 로그오차','범위 안의 실제값','기점 / 거시 회차'],FORECAST_VALIDATION.summary.map(r=>[r.horizon,nf(r.median.mapePct,2)+'%',nf(r.flat.mapePct,2)+'%',nf(r.median.meanAbsoluteLogError,3),nf(r.flat.meanAbsoluteLogError,3),`${r.envelopeCovered}/${r.samples}`,`${r.samples} / ${r.distinctMacroCohorts}`]))}<p><strong>MAPE 기준으로는 모든 평가 기간에서 가격 고정 기준선보다 오차가 컸습니다.</strong> 장기 2·3년의 평균 절대 로그오차는 모형이 더 작았습니다. MAPE는 과소예측보다 과대예측에 큰 벌점을 주므로 두 척도를 함께 봅니다. 표본이 작아 일관된 예측 우위는 확인되지 않았습니다. 10–90% 경로 범위도 실제 결과의 80%를 포괄하지 못했습니다.</p><p>평가 시점 이후 자료를 학습에 쓰지 않는 과거 시점 검증을 시행하고, 동일 시점·기간의 가격 고정 기준선과 비교합니다. 겹치는 시점은 독립 표본으로 세지 않습니다. 검증 수치와 기존 모형의 실패 기록은 아래 원문에서 확인할 수 있습니다.</p><p><a href="${REPORT_ROOT}DETAILED_FORECAST_METHOD.md" target="_blank" rel="noopener noreferrer">새 모형 수식 · 같은 조건의 과거 검증 ↗</a> &nbsp; <a href="${REPORT_ROOT}DETAILED_FORECAST_RESULTS.json" target="_blank" rel="noopener noreferrer">전체 경로 · 진단 JSON ↗</a></p><h3>D-day의 민감도</h3>${simpleTable(['변경 조건','첫 저점 중앙일','첫 고점 중앙일','모의 MDD 중앙값'],FORECAST_SENSITIVITY.map(r=>[r.group==='block-length'?`블록 ${r.parameters.blockDays}일`:r.group==='seed'?`시드 ${r.parameters.seed}`:`변동성 ×${r.parameters.volatilityMultiplier}`,dateLabel(r.firstLowMedianDate),dateLabel(r.firstHighMedianDate),nf(r.mddPct.p50,1)+'%']))}<p>예를 들어 변동성 배율만 바꿔도 첫 고점 중앙일이 크게 달라집니다. 현재 국면의 길이와 미래 전환일을 확정하는 수학적 증명으로 해석하지 않습니다.</p><p class="lab-small-note">이 경로의 학습 자료는 ${esc(m.asOf)}까지입니다. 위 검증표·민감도는 2026-10-20 자료로 발행한 고정 연구 결과이며 다른 시나리오나 새 자료 갱신의 적중률을 뜻하지 않습니다. 종가와 장중 고저가, 제공자 간 가격 차이로 기준일이 달라질 수 있습니다. 큰 주기의 붕괴, 유동성·시장 구조 변화, 실제 낙폭이 모형 범위를 벗어나는 경우 재추정이 필요합니다.</p><details><summary>이 계산의 상세 설정</summary><pre class="lab-formula">${esc(JSON.stringify({assumptions,training,diagnostics},null,2))}</pre></details>`;
  }
  function structure(){
    if(!state.analysis||state.analysis.parameters?.threshold!==state.threshold)state.analysis=analyzeMarketStructure(state.dataset,{threshold:state.threshold});
    return state.analysis;
  }
  function drawStructure(){
    if(!state.dataset||!state.compareVisible)return;
    try{
      const a=structure(),b=base(),rolling=computeRollingStates(state.dataset,{frequency:state.structureFrequency,threshold:state.threshold});
      const start=state.scope==='all'?b.rows[0].date:`${state.scope}-01-01`,end=state.scope==='all'?b.rows.at(-1).date:`${Number(state.scope)+3}-12-31`;
      const actualEnd=end>b.rows.at(-1).date?b.rows.at(-1).date:end;
      const dc=detectDirectionalChanges(state.dataset,{frequency:state.structureFrequency,threshold:state.threshold});
      drawChart({svg:$('#structure-chart'),tooltip:$('#structure-tooltip'),rows:b.rows,start,end:actualEnd,frequency:state.structureFrequency,stateStepDays:state.structureFrequency==='weekly'?7:1,states:rolling.points,turns:dc.pivots.map(p=>({date:p.eventDate,price:p.eventPrice,type:p.type,confirmationDate:p.confirmationDate})),historical:true});
      $('#structure-legend').innerHTML=Object.entries(STATE_LABELS).filter(([k])=>k!=='warmup').map(([k,v])=>`<span><i style="background:${COLORS[k]}"></i>${esc(v)}</span>`).join('');
      drawTimeline(a,rolling.points);renderCycleTable(a);renderPeriods(a);renderStructureDetails(a);
    }catch(error){fail(error);}
  }
  function cycles(a){return Array.isArray(a.macroCycles)?a.macroCycles:(a.macroCycles?.cycles||[]);}
  function drawTimeline(a,points){
    const list=state.alignment==='calendar'?[2010,2014,2018,2022,2026].map(y=>({label:`${y}–${y+3}`,start:`${y}-01-01`,end:`${y+3}-12-31`,partial:y===2010||y===2026})):cycles(a).map(c=>({label:`${c.start.date.slice(0,4)} → ${c.peakYear}`,start:c.start.date,end:shiftCalendarMonths(c.start.date,48),partial:c.leftCensored||c.rightCensored}));
    const W=1100,L=150,R=27,rowHeight=53,H=50+list.length*rowHeight,x=day=>L+day/1461*(W-L-R);
    let s=`<title>같은 4년 축으로 비교한 내부 국면</title>`;
    for(let year=0;year<=4;year++){const xx=x(year*365.25);s+=`<line x1="${xx}" x2="${xx}" y1="25" y2="${H-20}" stroke="#2a3442" stroke-width=".8"/><text x="${xx}" y="17" fill="#9aa8bb" text-anchor="middle" font-size="11">${year}년</text>`;}
    list.forEach((row,i)=>{const y=42+i*rowHeight,end=row.end>a.asOf?a.asOf:row.end,selected=points.filter(p=>p.date>=row.start&&p.date<=end);s+=`<text x="16" y="${y+8}" fill="#d1d9e4" font-size="12">${esc(row.label)}</text><text x="16" y="${y+23}" fill="#8796aa" font-size="10">${esc(row.start)}${row.partial?' · 일부 관측':''}</text><rect x="${L}" y="${y}" width="${W-L-R}" height="23" fill="#1b232e"/>`;
      for(const seg of makeSegments(selected)){const offset=D(seg.startDate)-D(row.start),duration=D(seg.endDate)-D(seg.startDate)+(state.structureFrequency==='weekly'?7:1),xx=x(offset),width=Math.min(W-R,x(offset+duration))-xx;s+=`<rect x="${xx}" y="${y}" width="${Math.max(.6,width)}" height="23" fill="${COLORS[seg.state]}" opacity=".87"><title>${esc(`${STATE_LABELS[seg.state]} ${seg.startDate}–${seg.endDate}`)}</title></rect>`;}
    });
    const svg=$('#structure-timeline');svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.innerHTML=s;
  }
  function renderCycleTable(a){
    $('#structure-cycles').innerHTML=cycles(a).map(c=>`<tr><td>${esc(c.start.date)} → ${esc(c.peak.date)}<br><span class="lab-muted-cell">${esc(c.end.date)}${c.endIsCandidate?' 저점 후보':''}</span></td><td>${nf(c.bullDays)}일</td><td>${nf(c.bearDays)}일</td><td>${nf(c.cycleDays)}일</td><td class="lab-muted-cell">${c.leftCensored?'초기 자료 불완전':c.rightCensored?'현재 사이클 미완료':'완료 · 사후 구분'}</td></tr>`).join('');
    const t=a.durationTrends?.bullMatureIncludingLatestPeak;
    $('#structure-conclusion').innerHTML=t?`최근 세 상승 구간은 <strong>${t.records.map(r=>nf(r.value)+'일').join(' · ')}</strong>. 기울기 ${nf(t.slopeDaysPerCycle,1)}일/사이클, 한 사이클을 제외하면 ${nf(t.leaveOneOutMin,1)} ~ ${nf(t.leaveOneOutMax,1)}일로 방향이 바뀝니다. <strong>큰 상승 구간의 지속적인 단축은 확인되지 않았습니다.</strong>`:'기간은 사후 저점·고점을 기준으로 계산합니다. 내부 국면과 거시 주기의 길이는 별도로 비교해야 합니다.';
  }
  function renderPeriods(a){
    let rows=[...(a[state.period]||[])].reverse();if(state.scope!=='all')rows=rows.filter(r=>r.startDate>=`${state.scope}-01-01`&&r.startDate<=`${Number(state.scope)+3}-12-31`);
    const pageSize=8;state.periodPage=Math.min(state.periodPage,Math.max(0,Math.ceil(rows.length/pageSize)-1));const start=state.periodPage*pageSize;
    $('#structure-periods').innerHTML=rows.slice(start,start+pageSize).map(r=>`<tr><td>${esc(r.period)}</td><td class="${tone(r.returnPct)}">${pct(r.returnPct)}</td><td class="lab-down">${pct(r.maxDrawdownPct)}</td><td>${pct(r.athDrawdownPct)}</td><td>${nf(r.realizedVolPct,1)}%</td><td>${nf(r.discoveryDays)}일</td><td title="이미 확인된 최근 스윙 기준 · 선형 가격 · 100%는 전체 되돌림">${r.fibonacciAnchor?nf(r.fibonacciAnchor.currentRetracementLinear*100,1)+'%':'—'}</td><td class="lab-muted-cell">${r.complete?'완료':`${r.observations}/${r.expectedDays}일 관측`}</td></tr>`).join('');
    $('#structure-period-count').textContent=`${Math.min(start+1,rows.length)}–${Math.min(start+pageSize,rows.length)} / ${rows.length}개 기간 · MDD는 전기 마지막 종가 포함`;
    $('#structure-prev').disabled=start===0;$('#structure-next').disabled=start+pageSize>=rows.length;
  }
  function renderStructureDetails(a){
    const cs=cycles(a),states=Object.keys(STATE_LABELS).filter(s=>s!=='warmup');
    $('#structure-durations').innerHTML=`<h3>상승 구간 내부의 국면 일수 · 일별 분류</h3><p>이 표는 일별 분류 기준이며 위 주봉 토글과 별도입니다. 각 날짜에 이미 알려진 값으로 국면을 분류합니다. 신고가 발견은 당시까지의 최고 종가 갱신을 뜻합니다. ‘저점 형성 조건’은 미래의 최종 저점 판정이 아닙니다.</p>${simpleTable(['국면',...cs.map(c=>String(c.peakYear))],states.map(s=>[STATE_LABELS[s],...cs.map(c=>{const v=c.stateSummary?.bull?.stateCounts?.[s];return v==null?'—':`${v}일`})]))}<h3>8% · 12% · 20%, 일봉 · 주봉</h3><p>방향 전환을 확인하는 임계값이 커지면 작은 조정이 합쳐지고, 주봉으로 바꾸면 확인이 늦어집니다. 한 임계값에서 얻은 짧아짐을 전체 주기의 법칙으로 일반화하지 않습니다. 완료된 구간의 중앙 기간과 미완료 구간을 분리한 결과를 제공합니다.</p>${simpleTable(['간격','확인 임계값','확인 전환점','스윙 중앙 길이','확인 지연 중앙값'],(a.sensitivity||[]).map(s=>[s.frequency==='daily'?'일봉':'주봉',nf(s.threshold*100)+'%',nf(s.confirmedPivotCount),nf(s.medianConfirmedLegDays)+'일',nf(s.medianConfirmationLagDays)+'일']))}<p><a href="${REPORT_ROOT}MARKET_STRUCTURE_METHOD.md" target="_blank" rel="noopener noreferrer">국면별 기간 · 민감도 검증 ↗</a> &nbsp; <a href="${REPORT_ROOT}MARKET_STRUCTURE_RESULTS.json" target="_blank" rel="noopener noreferrer">8·12·20% 전체 계산값 ↗</a></p>`;
    const f=a.fibonacci||{},fc=f.completedCycleComparison||{},matched=f.matchedCompletedTouches||{};
    $('#structure-fibonacci').innerHTML=`<h3>피보나치가 특별한가</h3>${simpleTable(['완료된 사이클 · 선형 가격','되돌림 거부','완전 추적 표본','비율'],[['피보나치 계열',nf(fc.fibonacci?.rejected),nf(fc.fibonacci?.completedTouches),pct(fc.fibonacci?.rejectionRatePct)],['대조 비율',nf(fc.control?.rejected),nf(fc.control?.completedTouches),pct(fc.control?.rejectionRatePct)]])}<p>이미 확인된 두 방향 전환점으로 스윙을 고정한 뒤 되돌림을 관찰합니다. 23.6·38.2·50·61.8·78.6%를 20·35·45·65·80% 대조 비율과 같은 조건에서 비교합니다. 50%는 관습적으로 포함되는 비율이며 피보나치 수열에서 직접 나온 값은 아닙니다.</p><div class="lab-formula">상승 스윙 되돌림: F(r) = H − r(H − L)<br>하락 스윙 반등: F(r) = L + r(H − L)</div><p>기준점이 확인되기 전의 돌파는 검증 표본에 넣지 않습니다. 가격이 비율에 닿았다는 사실만으로 저항이나 예측력이 입증되지 않습니다. 같은 스윙의 여러 비율은 독립 표본이 아니며, 중첩된 사건과 여러 임계값을 시험한 효과도 남습니다.</p><p><a href="${REPORT_ROOT}MARKET_STRUCTURE_METHOD.md#피보나치" target="_blank" rel="noopener noreferrer">대조검증 결과와 판정 규칙 ↗</a></p>${simpleTable(['간격','반전 임계값','가격 눈금','사이클 평균 차이'],(f.sensitivity||[]).map(s=>[s.frequency==='daily'?'일봉':'주봉',nf(s.threshold*100)+'%',s.scale==='linear'?'선형':'로그',pct(s.completedCycleComparison?.meanCycleDifferencePercentagePoints,2)+'p']))}<p class="lab-small-note">비율 간 차이는 기술 통계입니다. 표본은 완료된 세 사이클이며, 독립 표본처럼 일수나 접촉 수를 늘려 유의확률을 계산하지 않았습니다.</p>`;
    $('#structure-method').innerHTML=`<h3>서로 다른 네 가지 시간</h3><p>① 고정 달력 4년 ② 사후 저점→고점→다음 저점 ③ 당시에 알 수 있었던 국면의 길이 ④ 고저점 발생 후 확인까지의 지연을 따로 계산합니다. 첫 자료는 2010-07-18이며, 2010년 전체나 2009년은 관측하지 않았습니다.</p><div class="lab-formula">r(t) = log[P(t)/P(t−1)]<br>DD(t) = P(t)/max P(s≤t) − 1<br>MDD[a,b] = min(P(t)/max{P(a−1),…,P(t)} − 1)<br>RV = sd(r) × √365<br>β̂ = median{(기간ⱼ−기간ᵢ)/(사이클ⱼ−사이클ᵢ)}</div><p>월·분기 MDD는 전기 마지막 관측 종가를 시작 고점에 포함합니다. 수익률은 전기 종가 대비, 변동성은 일별 로그수익률의 연율화입니다. 일말 가격으로 계산한 지표이므로 실제 장중 최대 낙폭보다 작을 수 있습니다. 주봉의 고가·저가는 일말 가격의 최댓값·최솟값입니다.</p><h3>날짜를 바꾸는 가격 제공자 차이</h3><p>2022년 11월 Coin Metrics의 최저 일말 가격은 11월 9일이고 Coinbase의 최저 종가는 11월 21일입니다. Coin Metrics에서 두 날짜 가격 차이는 약 0.125%입니다. 2021년 최고 종가는 두 제공자 모두 11월 8일, Coinbase 장중 최고가는 11월 10일입니다. 전환일을 하루 단위 확정 사실로 과도하게 해석하지 않습니다.</p><p><a href="${REPORT_ROOT}STRUCTURE_CROSS_VALIDATION.md" target="_blank" rel="noopener noreferrer">원자료 대조 · 이슈 · X/레딧/보고서 교차 검증 ↗</a></p>`;
  }
  const schedule=()=>{if(state.pending)return;state.pending=true;setTimeout(()=>{state.pending=false;drawOutlook();drawStructure();},0);};
  $('#lab-scenario').onchange=e=>{state.scenario=e.target.value;state.eventPage=0;schedule();};
  $('#lab-unit').onchange=e=>{state.unit=e.target.value;schedule();};$('#lab-window').onchange=e=>{state.window=e.target.value;schedule();};
  for(const id of ['lab-band','lab-turns','lab-fib'])$(`#${id}`).onchange=schedule;
  for(const button of document.querySelectorAll('[data-lab-frequency]'))button.onclick=()=>{state.frequency=button.dataset.labFrequency;document.querySelectorAll('[data-lab-frequency]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));schedule();};
  for(const button of document.querySelectorAll('[data-lab-events]'))button.onclick=()=>{state.eventMode=button.dataset.labEvents;state.eventPage=0;document.querySelectorAll('[data-lab-events]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));if(state.dataset)renderEvents(model());};
  $('#lab-json').onclick=()=>{if(state.dataset)download('Bitcoin_Detailed_Forecast.json',JSON.stringify(model(),null,2));};
  $('#lab-svg').onclick=()=>{const clone=$('#lab-chart').cloneNode(true);clone.setAttribute('xmlns','http://www.w3.org/2000/svg');clone.setAttribute('style','background:#10151c;font-family:Arial,sans-serif');clone.querySelector('[id$="-cross"]')?.remove();download('Bitcoin_Detailed_Forecast.svg',new XMLSerializer().serializeToString(clone),'image/svg+xml');};
  $('#structure-scope').onchange=e=>{state.scope=e.target.value;state.periodPage=0;schedule();};$('#structure-alignment').onchange=e=>{state.alignment=e.target.value;schedule();};$('#structure-threshold').onchange=e=>{state.threshold=Number(e.target.value);state.analysis=null;schedule();};
  for(const button of document.querySelectorAll('[data-structure-frequency]'))button.onclick=()=>{state.structureFrequency=button.dataset.structureFrequency;document.querySelectorAll('[data-structure-frequency]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));schedule();};
  for(const button of document.querySelectorAll('[data-structure-period]'))button.onclick=()=>{state.period=button.dataset.structurePeriod;state.periodPage=0;document.querySelectorAll('[data-structure-period]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));if(state.dataset)renderPeriods(structure());};
  $('#structure-prev').onclick=()=>{state.periodPage=Math.max(0,state.periodPage-1);renderPeriods(structure());};$('#structure-next').onclick=()=>{state.periodPage++;renderPeriods(structure());};
  $('#structure-json').onclick=()=>{if(state.dataset)download('Bitcoin_Market_Structure.json',JSON.stringify(structure(),null,2));};
  $('#legacy-comparison').addEventListener('toggle',()=>{if($('#legacy-comparison').open)window.dispatchEvent(new Event('resize'));});
  return {setDataset(dataset){if(state.dataset===dataset)return;state.dataset=dataset;state.base=null;state.analysis=null;state.models.clear();schedule();},show(value){state.visible=value;if(value)schedule();},showCompare(value){state.compareVisible=value;if(value)schedule();}};
}
