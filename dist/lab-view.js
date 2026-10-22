import { drawAtlasPriceChart as drawChart } from './atlas-price-chart.js';
import { renderCryptoConAudit } from './cryptocon-audit.js';
import { bindChartNavigation } from './chart-navigation.js';
import { renderAtlasAnalysis } from './atlas-analysis.js';
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

export function initLabView() {
  const query=new URLSearchParams(location.search);
  const valid=(name,values,fallback)=>values.includes(query.get(name))?query.get(name):fallback;
  const state={dataset:null,base:null,analysis:null,models:new Map(),futureStates:new Map(),visible:false,compareVisible:false,scenario:valid('assumption',['base','accelerated','wait','late','stress'],'base'),frequency:valid('granularity',['daily','weekly'],'daily'),scale:valid('axis',['log','linear'],'log'),tool:'crosshair',measurement:null,unit:'usd',window:valid('span',['all','history','near','0','1','2'],'all'),atlasMode:valid('chart',['price','cycles','duration','peaks','periods','cryptocon'],query.get('page')==='compare'&&!query.has('legacy')?'cycles':'price'),cryptoView:'timing',atlasAlignment:valid('align',['trough','calendar','halving'],'trough'),atlasPeriod:valid('interval',['monthly','quarterly'],'monthly'),atlasMetric:valid('measure',['returnPct','maxDrawdownPct','realizedVolPct','discoveryDays'],'returnPct'),atlasPhase:valid('phase',['macro','bull','bear'],'macro'),atlasScope:valid('scope',['recent','all'],'recent'),controller:null,selectedDate:null,methodKey:null,selectedEvent:null,eventMode:'macro',eventPage:0,structureFrequency:'weekly',scope:'all',threshold:.12,alignment:'calendar',period:'monthly',periodPage:0,pending:false};
  function fail(error){console.error('Detailed research workspace',error);$('#lab-error').hidden=false;$('#lab-error').textContent='분석을 계산하지 못했습니다. 원자료와 계산 결과를 확인해 주세요.';}
  state.priceRange=null;state.chartRange=null;
  const plot=$('.atlas-plot');
  // A genuine chart click opens details; redraws and resizing only refresh them.
  plot.addEventListener('click',event=>{if(event.target.closest('#atlas-analysis-chart')||(state.tool==='crosshair'&&event.target.closest('#lab-chart'))){state.isChartClick=true;queueMicrotask(()=>{state.isChartClick=false;});}},true);
  for(const svg of [$('#lab-chart'),$('#atlas-analysis-chart')])svg.addEventListener('keydown',event=>{
    if(state.atlasMode==='price'&&state.tool!=='crosshair')return;
    if(['Enter',' '].includes(event.key)&&!event.target.closest('[data-next-turn]')){event.preventDefault();document.dispatchEvent(new CustomEvent('atlas:open-detail',{detail:{kind:'selection',focus:false}}));}
  });
  const chartNavigation=bindChartNavigation({element:$('.atlas-plot'),getTool:()=>state.tool,getRange:()=>state.visible&&state.atlasMode==='price'?state.chartRange:null,onRangeChange:range=>{state.priceRange={start:range.start,end:range.end};state.selectedEvent=null;schedule();},onReset:()=>{state.priceRange=null;state.window='all';state.selectedEvent=null;schedule();}});
  $('#workbench-navigation').append(chartNavigation.toolbar);
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
    return [.236,.382,.5,.618,.786].map(ratio=>({ratio,price:b.type==='high'?high-ratio*(high-low):low+ratio*(high-low),startDate:b.confirmationDate}));
  }
  function syncAtlasUrl(){
    const p=new URLSearchParams(location.search);
    for(const [key,value,defaultValue] of [['chart',state.atlasMode,'price'],['span',state.window,'all'],['assumption',state.scenario,'base'],['granularity',state.frequency,'daily'],['axis',state.scale,'log'],['align',state.atlasAlignment,'trough'],['interval',state.atlasPeriod,'monthly'],['measure',state.atlasMetric,'returnPct'],['scope',state.atlasScope,'recent'],['phase',state.atlasPhase,'macro']])value===defaultValue?p.delete(key):p.set(key,value);
    if(p.get('page')==='compare'&&!p.has('legacy'))p.delete('page');
    try{history.replaceState(null,'',`${location.pathname}${p.size?'?'+p:''}`);}catch{}
  }
  function inspect(detail,options={}){
    if(options.user){state.selectedEvent=null;queueMicrotask(updateNavigation);}
    if(!detail)return;
    const labels={observed:'관측',simulated:'가정',assumption:'가정',distribution:'모의 요약'};
    $('#atlas-inspector-kind').textContent=labels[detail.kind]||'실제 관측';$('#atlas-inspector-kind').dataset.kind=detail.kind;
    $('#atlas-inspector-title').textContent=detail.label;
    $('#atlas-inspector-values').innerHTML=(detail.fields||[]).map(f=>`<div><span>${esc(f.label)}</span><strong>${esc(f.value)}</strong></div>`).join('');
    $('#atlas-inspector-note').textContent=detail.note||'';
    if(detail.date&&state.atlasMode==='price'){state.selectedDate=detail.date;$('#atlas-date').value=detail.date;}
    if(options.user&&$('#workbench-announcement'))$('#workbench-announcement').textContent=`${detail.label} · ${labels[detail.kind]||'관측'} · ${detail.fields?.[0]?.value||''}`;
    document.dispatchEvent(new CustomEvent('atlas:inspection',{detail:{...detail,userInitiated:Boolean((options.openPanel??options.user)||state.isChartClick)}}));
  }
  function renderHover(detail){
    if(!detail||state.atlasMode!=='price')return;
    const future=detail.kind==='simulated',label=future?'가정':'관측';
    const displayPrice=state.unit==='indexed'?nf(detail.price/base().rows.at(-1).price*100,1):usd(detail.price);
    const change=Number.isFinite(detail.changePct)?pct(detail.changePct):'—';
    $('#lab-metrics').dataset.kind=detail.kind;
    $('#lab-metrics').innerHTML=`<span class="atlas-symbol">${state.frequency==='daily'?'1D':'1W'}<span class="readout-kind">${label}</span></span><strong>${displayPrice}</strong><span class="atlas-day-change ${tone(detail.changePct)}">${change}</span><span class="atlas-observation-date">${dateLabel(detail.date)} UTC</span>`;
    $('#lab-metrics').title=`${label} · ${dateLabel(detail.date)} UTC · 일말 가격 ${usd(detail.price)} · 전일 대비 ${change}${state.frequency==='weekly'?' · 선은 주별 마지막 가격, 선택은 해당 날짜 일말 가격':''}`;
  }
  function renderReadout(m,b,next){
    const last=b.rows.at(-1),previous=b.rows.at(-2),change=previous?(last.price/previous.price-1)*100:0;
    renderHover({date:m.asOf,price:last.price,changePct:change,kind:'observed'});
    $('#lab-asof').textContent=`실제 자료 ${dateLabel(m.asOf)}까지 · UTC`;
    $('#atlas-reference').textContent=`계산 기준 ${dateLabel(m.referenceDate)}`;
    $('#sidebar-reference').textContent=`계산 기준 · ${dateLabel(m.referenceDate)}`;
  }
  function drawOutlook(){
    if(!state.dataset||!state.visible)return;
    try{
      const focusId=document.activeElement?.id,focusEventId=document.activeElement?.dataset?.atlasEvent;
      const m=model(),b=base(),next=nextTurnInfo(m),priceMode=state.atlasMode==='price';
      plot.dataset.mode=state.atlasMode;$('#lab-metrics').hidden=!priceMode;
      $('#lab-chart').toggleAttribute('hidden',!priceMode);$('#atlas-analysis-chart').toggleAttribute('hidden',priceMode);$('#lab-tooltip').hidden=true;
      $('#atlas-price-controls').hidden=!priceMode;$('#atlas-cycle-controls').hidden=state.atlasMode!=='cycles';$('#atlas-period-controls').hidden=state.atlasMode!=='periods';
      $('[data-lab-frequency]').closest('fieldset').hidden=!priceMode;
      for(const id of ['lab-unit','lab-band','lab-turns','lab-fib','atlas-drawdown','atlas-states'])$(`#${id}`).closest('label').hidden=!priceMode;
      $('#lab-json').hidden=!priceMode;
      $('#atlas-duration-controls').hidden=state.atlasMode!=='duration';
      $('#atlas-cryptocon-controls').hidden=state.atlasMode!=='cryptocon';
      $('#atlas-cryptocon-view').value=state.cryptoView;
      $('#atlas-date-label').hidden=!priceMode;$('#atlas-latest').hidden=!priceMode;$('#atlas-event-rail').hidden=!priceMode;
      document.querySelectorAll('[data-atlas-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.atlasMode===state.atlasMode)));
      $('#atlas-mode-name').textContent=document.querySelector(`[data-atlas-mode="${state.atlasMode}"]`).textContent;
      $('#lab-scenario').value=state.scenario;$('#lab-window').value=state.window;$('#lab-unit').value=state.unit;
      $('#atlas-phase').value=state.atlasPhase;$('#atlas-alignment').value=state.atlasAlignment;$('#atlas-period').value=state.atlasPeriod;$('#atlas-measure').value=state.atlasMetric;$('#atlas-period-scope').value=state.atlasScope;
      document.querySelectorAll('[data-lab-frequency]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.labFrequency===state.frequency)));
      renderReadout(m,b,next);
      if(priceMode){
        const last=b.rows.at(-1);let peak=Math.max(...b.rows.map(r=>r.price));
        const future=m.path.filter(r=>r.date>m.asOf).map(r=>{peak=Math.max(peak,r.price);return {...r,drawdownPct:(r.price/peak-1)*100};});
        const allRows=[...b.rows,...future],ref=m.referenceDate,end=m.displayEnd||shiftCalendarMonths(ref,36);
        let start=dateFromDay(D(m.asOf)-365),chartEnd=end;
        if(state.window==='history')start=b.rows[0].date;
        else if(state.window==='near'){start=dateFromDay(D(ref)-45);chartEnd=shiftCalendarMonths(ref,6);}
        else if(state.window!=='all'){start=shiftCalendarMonths(ref,12*Number(state.window));chartEnd=shiftCalendarMonths(start,12);}
        if(state.priceRange){start=state.priceRange.start;chartEnd=state.priceRange.end;}
        state.chartRange={start,end:chartEnd,min:b.rows[0].date,max:end};
        if(!state.futureStates.has(state.scenario))state.futureStates.set(state.scenario,computeRollingStates({prices:[...state.dataset.prices,...future.map(p=>[p.date,p.price])]}).points);
        const actualTurns=b.pivots.pivots.map(p=>({date:p.eventDate,price:p.eventPrice,type:p.type,confirmationDate:p.confirmationDate}));
        if(state.selectedEvent?.startsWith('macro-')&&!m.events[Number(state.selectedEvent.split('-')[1])]?.inHorizon)state.selectedEvent=null;
        const activeMarker=['low','high'].includes(state.selectedEvent)?turnInfo(m,state.selectedEvent):next;
        state.controller=drawChart({svg:$('#lab-chart'),tooltip:$('#lab-tooltip'),rows:allRows,start,end:chartEnd,split:m.asOf,frequency:state.frequency,scale:state.scale,tool:state.tool,measurement:state.measurement,onMeasurement:value=>{state.measurement=value;if(value)state.selectedDate=value.endDate||value.startDate;schedule();},onHover:renderHover,unit:state.unit,denominator:last.price,band:$('#lab-band').checked,turns:[...actualTurns,...m.localTurns],showTurns:$('#lab-turns').checked,events:m.events.filter(e=>e.inHorizon),states:state.futureStates.get(state.scenario),fib:$('#lab-fib').checked?currentFib():[],nextTurn:activeMarker,onNextTurn:()=>focusEvent(activeMarker.type),showDrawdown:$('#atlas-drawdown').checked,showStates:$('#atlas-states').checked,onInspect:inspect,selectedDate:state.selectedDate||m.asOf});
        $('#atlas-date').min=b.rows[0].date;$('#atlas-date').max=end;
        $('#lab-chart-title').textContent=`${dateLabel(start)} — ${dateLabel(chartEnd)} · ${state.frequency==='daily'?'일별':'주별'} 가격`;
        $('#atlas-axis-note').textContent=`${state.unit==='usd'?'USD':'최근 = 100'} · ${state.scale==='linear'?'선형':'로그'}`;
        $('#atlas-chart-legend').innerHTML='<span><i class="legend-observed"></i>실제 가격</span><span><i class="legend-simulated"></i>미래 가정</span>'+($('#lab-band').checked?'<span><i class="legend-band"></i>모의 범위</span>':'')+($('#lab-turns').checked?'<span><i class="legend-turn"></i>고점·저점</span>':'');
        $('#atlas-chart-caveat').textContent='조건부 가정';
        $('#atlas-chart-note').textContent=`${m.scenario.label}. 실선은 실제 가격, 점선은 가정에 따른 한 가지 예시입니다. 그래프를 누르면 날짜와 값을 고정해 읽을 수 있습니다.`;
        $('#atlas-inspect-prev').textContent='←';$('#atlas-inspect-next').textContent='→';
        $('#atlas-inspect-prev').setAttribute('aria-label','이전 고점·저점');$('#atlas-inspect-next').setAttribute('aria-label','다음 고점·저점');
        renderEventRail(m);
        if(state.selectedEvent){inspectEvent(m,state.selectedEvent);}
      }else{
        state.controller=state.atlasMode==='cryptocon'?renderCryptoConAudit({svg:$('#atlas-analysis-chart'),dataset:state.dataset,view:state.cryptoView,onInspect:inspect}):renderAtlasAnalysis({svg:$('#atlas-analysis-chart'),dataset:state.dataset,mode:state.atlasMode==='duration'&&state.atlasPhase!=='macro'?'phases':state.atlasMode,phaseLeg:state.atlasPhase==='bear'?'bear':'bull',alignment:state.atlasAlignment,period:state.atlasPeriod,metric:state.atlasMetric,scope:state.atlasScope,onInspect:inspect});
        const c=state.controller;$('#lab-chart-title').textContent=c.title;$('#atlas-axis-note').textContent=c.caption;
        $('#atlas-chart-legend').innerHTML=c.legend.map(item=>`<span><i style="border-color:${esc(item.color)};border-top-style:${item.dashed?'dashed':'solid'}"></i>${esc(item.label)}</span>`).join('');
        $('#atlas-chart-caveat').textContent=state.atlasMode==='cryptocon'?'선택 주장 · 사후 검증':'실제 관측';$('#atlas-chart-note').textContent=c.note;
        $('#atlas-inspect-prev').textContent='←';$('#atlas-inspect-next').textContent='→';
        const item=state.atlasMode==='cryptocon'?'주장':state.atlasMode==='periods'?'기간':state.atlasMode==='cycles'?'경과일':'사이클';$('#atlas-inspect-prev').setAttribute('aria-label',`이전 ${item}`);$('#atlas-inspect-next').setAttribute('aria-label',`다음 ${item}`);
      }
      renderEvents(m);const methodKey=`${m.asOf}/${m.scenario.id||state.scenario}`;if(methodKey!==state.methodKey){renderForecastMethod(m);state.methodKey=methodKey;}
      $('#lab-error').hidden=true;updateNavigation();chartNavigation.update();syncAtlasUrl();
      document.dispatchEvent(new CustomEvent('atlas:workbench-state',{detail:{mode:state.atlasMode,scenario:state.scenario,frequency:state.frequency,scale:state.scale,tool:state.tool,measurement:state.measurement,window:state.window,customRange:Boolean(state.priceRange),start:state.chartRange?.start,end:state.chartRange?.end,next}}));
      if(state.openEventPanel){state.openEventPanel=false;const chart=$('#lab-chart');chart.focus({preventScroll:true});document.dispatchEvent(new CustomEvent('atlas:open-detail',{detail:{kind:'selection',focus:false,opener:chart}}));}
      if(focusId)document.getElementById(focusId)?.focus({preventScroll:true});else if(focusEventId)document.querySelector(`[data-atlas-event="${focusEventId}"]`)?.focus({preventScroll:true});
    }catch(error){fail(error);}
  }
  function turnInfo(m,type){
    const w=m.diagnostics.firstTurnWindows?.[type];if(!w?.medianDate)return null;
    return {type,date:w.medianDate,lowerDate:w.lowerDate,upperDate:w.upperDate,confirmationDate:w.confirmationWindow?.medianDate,days:D(w.medianDate)-D(m.referenceDate),direction:type==='high'?'상승 뒤 조정':'조정 뒤 반등'};
  }
  function renderEventRail(m){
    const entries=['low','high'].map(type=>{const w=turnInfo(m,type);return w?{id:type,label:`첫 ${type==='low'?'저점':'고점'} 후보`,date:w.date,note:'여러 예시의 첫 전환 중앙일'}:null;}).filter(Boolean);
    m.events.map((e,i)=>({...e,index:i})).filter(e=>e.inHorizon).slice(0,2).forEach(e=>entries.push({id:`macro-${e.index}`,label:e.label.replace('거시 ','큰 ').replace('도달 기준','진입 가정'),date:e.date,note:'선택한 큰 주기의 가정',assumed:true}));
    $('#atlas-event-rail').style.setProperty('--atlas-events',String(entries.length));
    $('#atlas-event-rail').innerHTML=entries.map(e=>`<button data-atlas-event="${e.id}" class="${e.assumed?'event-hypothesis':''}"><span>${esc(e.label)}</span><strong>${dateLabel(e.date)}<span class="event-dday"> · D-${nf(D(e.date)-D(m.referenceDate))}</span></strong><small>${esc(e.note)}</small></button>`).join('');
    document.querySelectorAll('[data-atlas-event]').forEach(button=>button.onclick=()=>focusEvent(button.dataset.atlasEvent));
  }
  function focusEvent(id){
    const m=model(),e=['low','high'].includes(id)?turnInfo(m,id):m.events[Number(id.split('-')[1])];if(!e)return;
    state.priceRange=null;state.atlasMode='price';state.selectedDate=e.date;state.window=['low','high'].includes(id)?'near':String(Math.min(2,Math.max(0,Math.floor((D(e.date)-D(m.referenceDate))/365.25))));state.selectedEvent=id;state.openEventPanel=true;schedule();
  }
  function inspectEvent(m,id){
    if(['low','high'].includes(id)){const e=turnInfo(m,id);if(!e)return;inspect({label:`첫 ${id==='low'?'저점':'고점'} 시기의 중앙값 · ${dateLabel(e.date)}`,date:e.date,kind:'distribution',fields:[{label:'후보일까지 · 계산 기준일 대비',value:`D-${nf(e.days)}`},{label:'여러 경로의 날짜 범위',value:`${dateLabel(e.lowerDate)}–${dateLabel(e.upperDate)}`},{label:'전환 뒤 방향 후보',value:e.direction},{label:'계산 기준일',value:dateLabel(m.referenceDate)}],note:'여러 예시 경로에서 첫 고점·저점이 나온 날짜를 요약했습니다. 금색 점선 한 개의 전환점이나 확정된 시장 일정이 아닙니다.'});}
    else{const e=m.events[Number(id.split('-')[1])];if(!e)return;inspect({label:`${e.label} · ${dateLabel(e.date)}`,date:e.date,kind:'assumption',fields:[{label:'가정한 날짜',value:dateLabel(e.date)},{label:'계산 기준일 대비',value:`D-${nf(D(e.date)-D(m.referenceDate))}`},{label:'가정한 기준 가격',value:usd(e.price)},{label:'표시 범위',value:e.inHorizon?'앞으로 3년 안':'앞으로 3년 밖'}],note:'큰 주기의 계산을 위한 기준점입니다. 예시 경로의 실제 최고·최저값은 이 날짜와 가격에서 달라질 수 있습니다.'});}
  }
  function nextTurnInfo(m){
    const windows=m.diagnostics.firstTurnWindows||{};
    const candidates=['high','low'].filter(type=>windows[type]?.medianDate&&windows[type].medianDate>=m.referenceDate).map(type=>({type,...windows[type]})).sort((a,b)=>a.medianDate.localeCompare(b.medianDate));
    if(candidates.length){const n=candidates[0],days=D(n.medianDate)-D(m.referenceDate);return {type:n.type,date:n.medianDate,lowerDate:n.lowerDate,upperDate:n.upperDate,days,direction:n.type==='high'?'상승 뒤 조정':'조정 뒤 반등',shortLabel:`다음 ${n.type==='high'?'고점':'저점'} 후보 · D−${nf(days)}`};}
    const n=m.localTurns.find(p=>p.date>=m.referenceDate);if(!n)return null;
    return {type:n.type,date:n.date,lowerDate:n.date,upperDate:n.date,days:D(n.date)-D(m.referenceDate),direction:n.type==='high'?'상승 뒤 조정':'조정 뒤 반등',shortLabel:`대표 ${n.type==='high'?'고점':'저점'} 후보`};
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
    $('#atlas-model-info').innerHTML=`<h3>가격 기반 조건부 시뮬레이션</h3><p><b>실제 입력</b> · ${esc(state.dataset.prices[0][0])}–${esc(m.asOf)}의 일말 가격·날짜. 로그수익률과 가격 국면을 계산합니다.</p><p><b>변동성</b> · 최근 90일 변동성에 맞춘 역사 잔차를 재표본화합니다. 미래의 변동성 변화는 따로 추정하지 않습니다.</p><p><b>기간 가정</b> · 48개월 시계, 명목 36개월 상승·12개월 하락, 고점권 선행·체류 기간. 역사적 지속기간 분포를 학습한 값이 아닙니다.</p><p><b>가격 가정</b> · 관측 고점 비율에 지수 0.75를 적용하고 다음 거시 저점 낙폭을 50%로 둡니다. 회귀 추정값이 아닙니다.</p><p><b>미구현 입력</b> · 시가총액·공급·거래량·유동성·ETF 자금 흐름. 해당 데이터의 수집·모형 연결·추가 예측력 검증은 아직 구현하지 않았습니다.</p><p><b>검증</b> · 3년 중앙값 경로 MAPE 203.09%, 가격 고정 86.25%. 6개 기점·2개 회차의 사후 평가이며 예측 우위는 입증되지 않았습니다.</p><p><a href="${REPORT_ROOT}MODEL_SCOPE.md" target="_blank" rel="noopener noreferrer">입력·가정·검증 전체 근거 ↗</a></p>`;
    $('#lab-method').innerHTML=`<h3>큰 시계와 작은 움직임</h3><p>명목 48개월 시계와 약 3년 상승·1년 하락은 사용자가 선택한 조건입니다. 이 기간과 고점권 선행·체류 기간은 지정한 가정이며, 역사적 국면의 지속기간 분포를 학습한 결과가 아닙니다. 과거 잔차를 가변 길이 블록으로 재표본합니다. 기하분포의 평균 모수는 28일이며, 길이는 7–84일로 제한하고 자료 경계에서 줄입니다. 차트의 한 선은 128개 중 실제로 생성된 대표 경로이며, 날짜별 중앙값을 이어 붙인 선이 아닙니다.</p><div class="lab-formula">N = 이전 관측 고점 + 48개월<br>Z = N − A, &nbsp; P = N − A + D<br>log P*(t) = log B(t) + R(t) − (t/T)R(T)</div><p>B(t)는 거시 가격 기준선, A는 고점권 선행 기간, D는 그 이후 머무는 기간입니다. 선행이 빨라도 머무는 기간이 같이 늘면 최종 고점은 빨라지지 않습니다. 블록 잔차의 연결 조건은 현재 가격과 표시 범위 밖의 다음 거시 저점 기준 가격을 잇습니다. 마지막 기준 가격은 모형에 의해 고정되며, 중간 고저점이나 2026년 저점 유지 조건은 강제하지 않습니다. 잔차의 크기는 최근 90일 로그수익률 변동성에 맞춥니다. 미래 가격 기준의 지수 0.75와 다음 거시 저점 낙폭 50%는 회귀 추정값이 아닌 설정이며, 시가총액·공급·거래량·자금 흐름은 입력하지 않습니다.</p><h3>범위와 고저점의 의미</h3><p>음영은 동일 가정에서 발생한 경로의 날짜별 10·90 분위수입니다. 80%의 실제 미래를 포괄한다는 뜻이 아닙니다. 12% 반대 방향 이동 뒤에만 고저점을 확인하며, 표에는 발생일과 모의 확인일을 분리했습니다. D-day는 연구 기준일에서 조건부 모의 중앙일까지 남은 달력 일수입니다. 후보 구간은 각 경로의 첫 고점·첫 저점 날짜의 10–90 분위수이며, 특정일 도달 확률이나 시장의 확정 일정이 아닙니다. 주봉은 일말 자료를 재집계한 값으로 장중 캔들이 아닙니다.</p><h3>과거 검증과 반증</h3>${simpleTable(['평가 기간','모형 중앙경로 MAPE','가격 고정 MAPE','모형 로그오차','가격 고정 로그오차','범위 안의 실제값','기점 / 거시 회차'],FORECAST_VALIDATION.summary.map(r=>[r.horizon,nf(r.median.mapePct,2)+'%',nf(r.flat.mapePct,2)+'%',nf(r.median.meanAbsoluteLogError,3),nf(r.flat.meanAbsoluteLogError,3),`${r.envelopeCovered}/${r.samples}`,`${r.samples} / ${r.distinctMacroCohorts}`]))}<p><strong>MAPE 기준으로는 모든 평가 기간에서 가격 고정 기준선보다 오차가 컸습니다.</strong> 2·3년의 절대 로그오차는 가격 고정보다 작았지만, 같은 거시 가정의 잔차 없는 단순 기준선보다 컸습니다. MAPE는 과대 예측 오차에 상한이 없고 과소 예측 오차는 100% 이내이며, 절대 로그오차는 같은 배수의 과대·과소 예측을 대칭적으로 평가합니다. 현 모형을 검증된 예측기라고 부를 수 없습니다. 표본이 작아 일관된 예측 우위는 확인되지 않았습니다. 10–90% 경로 범위도 실제 결과의 80%를 포괄하지 못했습니다.</p><p>각 과거 기점까지의 관측으로 잔차 풀과 평균을 다시 계산했습니다. 다만 모형 구조·설정·평가 기점은 과거를 알고 선택했으므로 사전 등록된 미래 검증이 아닙니다. 결과는 2024-12-31까지이며, 3년 평가는 겹치는 6개 기점·2개 거시 회차입니다. 전체 수치와 이전 모형의 실패 기록은 아래 원문에서 확인할 수 있습니다.</p><p><a href="${REPORT_ROOT}DETAILED_FORECAST_METHOD.md" target="_blank" rel="noopener noreferrer">새 모형 수식 · 같은 조건의 과거 검증 ↗</a> &nbsp; <a href="${REPORT_ROOT}DETAILED_FORECAST_RESULTS.json" target="_blank" rel="noopener noreferrer">전체 경로 · 진단 JSON ↗</a></p><h3>D-day의 민감도</h3>${simpleTable(['변경 조건','첫 저점 중앙일','첫 고점 중앙일','모의 MDD 중앙값'],FORECAST_SENSITIVITY.map(r=>[r.group==='block-length'?`블록 모수 ${r.parameters.blockDays}일`:r.group==='seed'?`시드 ${r.parameters.seed}`:`변동성 ×${r.parameters.volatilityMultiplier}`,dateLabel(r.firstLowMedianDate),dateLabel(r.firstHighMedianDate),nf(r.mddPct.p50,1)+'%']))}<p>예를 들어 변동성 배율만 바꿔도 첫 고점 중앙일이 크게 달라집니다. 현재 국면의 길이와 미래 전환일을 확정하는 수학적 증명으로 해석하지 않습니다.</p><p class="lab-small-note">이 경로에 사용한 가격 관측은 ${esc(m.asOf)}까지입니다. 위 검증표·민감도는 2026-10-20 자료로 발행한 고정 연구 결과이며 다른 시나리오나 새 자료 갱신의 적중률을 뜻하지 않습니다. 종가와 장중 고저가, 제공자 간 가격 차이로 기준일이 달라질 수 있습니다. 큰 주기의 붕괴, 유동성·시장 구조 변화, 실제 낙폭이 모형 범위를 벗어나는 경우 재추정이 필요합니다.</p><details><summary>이 계산의 상세 설정</summary><pre class="lab-formula">${esc(JSON.stringify({assumptions,training,diagnostics},null,2))}</pre></details>`;
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
      drawChart({svg:$('#structure-chart'),tooltip:$('#structure-tooltip'),rows:b.rows,start,end:actualEnd,frequency:state.structureFrequency,stateStepDays:state.structureFrequency==='weekly'?7:1,states:rolling.points,turns:dc.pivots.map(p=>({date:p.eventDate,price:p.eventPrice,type:p.type,confirmationDate:p.confirmationDate})),historical:true,showStates:true,threshold:state.threshold});
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
  $('#lab-scenario').onchange=e=>{state.scenario=e.target.value;state.measurement=null;state.eventPage=0;schedule();};
  document.addEventListener('atlas:chart-command',event=>{
    if(!state.dataset||state.atlasMode!=='price')return;
    const {action,value}=event.detail;
    if(action==='tool'&&['crosshair','pan','measure'].includes(value)){
      state.tool=value;if(value!=='measure'&&state.measurement&&!state.measurement.endDate)state.measurement=null;
      document.dispatchEvent(new CustomEvent('atlas:close-detail'));$('#lab-chart').focus({preventScroll:true});
    }else if(action==='clear-measurement')state.measurement=null;
    else if(action==='span'&&['all','history','near','0','1','2'].includes(value)){state.window=value;state.priceRange=null;state.selectedEvent=null;}
    else if(action==='scale')state.scale=state.scale==='log'?'linear':'log';
    else if(action==='fit'){state.priceRange=null;state.window='all';state.selectedEvent=null;}
    else if(action==='next-turn'){state.tool='crosshair';const next=nextTurnInfo(model());if(next)focusEvent(next.type);return;}
    else return;
    schedule();
  });
  $('#lab-unit').onchange=e=>{state.unit=e.target.value;schedule();};$('#lab-window').onchange=e=>{state.window=e.target.value;state.priceRange=null;state.selectedEvent=null;schedule();};
  for(const id of ['lab-band','lab-turns','lab-fib','atlas-drawdown','atlas-states'])$(`#${id}`).onchange=schedule;
  for(const button of document.querySelectorAll('[data-lab-frequency]'))button.onclick=()=>{state.frequency=button.dataset.labFrequency;document.querySelectorAll('[data-lab-frequency]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));schedule();};
  for(const button of document.querySelectorAll('[data-lab-events]'))button.onclick=()=>{state.eventMode=button.dataset.labEvents;state.eventPage=0;document.querySelectorAll('[data-lab-events]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));if(state.dataset)renderEvents(model());};
  $('#lab-json').onclick=()=>{if(state.dataset)download('Bitcoin_Detailed_Forecast.json',JSON.stringify(model(),null,2));};
  $('#lab-svg').onclick=()=>{const clone=$(state.atlasMode==='price'?'#lab-chart':'#atlas-analysis-chart').cloneNode(true);clone.setAttribute('xmlns','http://www.w3.org/2000/svg');clone.setAttribute('style','background:#10151c;font-family:Arial,sans-serif');clone.querySelector('[id$="-cross"]')?.remove();download(`Bitcoin_Cycles_${state.atlasMode}.svg`,new XMLSerializer().serializeToString(clone),'image/svg+xml');};
  for(const button of document.querySelectorAll('[data-atlas-mode]'))button.onclick=()=>{state.atlasMode=button.dataset.atlasMode;$('#atlas-display-options').open=false;schedule();};
  $('#atlas-phase').onchange=e=>{state.atlasPhase=e.target.value;schedule();};
  $('#atlas-alignment').onchange=e=>{state.atlasAlignment=e.target.value;schedule();};
  $('#atlas-period').onchange=e=>{state.atlasPeriod=e.target.value;schedule();};
  $('#atlas-measure').onchange=e=>{state.atlasMetric=e.target.value;schedule();};
  $('#atlas-period-scope').onchange=e=>{state.atlasScope=e.target.value;schedule();};
  function updateNavigation(){const c=state.controller;$('#atlas-inspect-prev').disabled=state.atlasMode==='price'&&Boolean(c?.hasPrevious)&&!c.hasPrevious();$('#atlas-inspect-next').disabled=state.atlasMode==='price'&&Boolean(c?.hasNext)&&!c.hasNext();}
  $('#atlas-inspect-prev').onclick=()=>{state.controller?.previous();updateNavigation();};$('#atlas-inspect-next').onclick=()=>{state.controller?.next();updateNavigation();};
  $('#atlas-date').onchange=e=>{if(!e.target.value||!e.target.validity.valid)return;const m=model(),v=e.target.value;state.priceRange=null;state.selectedEvent=null;state.selectedDate=v;state.window=v<m.asOf?'history':'all';schedule();};
  $('#atlas-latest').onclick=()=>{state.priceRange=null;state.selectedEvent=null;state.selectedDate=model().asOf;if(state.window!=='history'&&state.window!=='all'&&state.window!=='near')state.window='all';schedule();};
  $('#atlas-cryptocon-view').onchange=e=>{state.cryptoView=e.target.value;schedule();};
  $('#atlas-reset').onclick=()=>{state.priceRange=null;state.atlasMode='price';state.scenario='base';state.frequency='daily';state.scale='log';state.tool='crosshair';state.measurement=null;state.unit='usd';state.window='all';state.selectedDate=null;state.selectedEvent=null;state.atlasAlignment='trough';state.atlasPhase='macro';state.atlasPeriod='monthly';state.atlasMetric='returnPct';state.atlasScope='recent';for(const id of ['lab-band','lab-turns'])$(`#${id}`).checked=true;for(const id of ['lab-fib','atlas-states','atlas-drawdown'])$(`#${id}`).checked=false;$('#atlas-display-options').open=false;schedule();};
  document.addEventListener('click',e=>{if(!$('#atlas-display-options').contains(e.target))$('#atlas-display-options').open=false;});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('#atlas-display-options').open=false;document.querySelector('.atlas-guide').open=false;}});
  let plotSize='';new ResizeObserver(entries=>{const r=entries[0].contentRect,key=`${Math.round(r.width)}x${Math.round(r.height)}`;if(key!==plotSize){plotSize=key;schedule();}}).observe(document.querySelector('.atlas-plot'));
  let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(schedule,120);});
  $('#structure-scope').onchange=e=>{state.scope=e.target.value;state.periodPage=0;schedule();};$('#structure-alignment').onchange=e=>{state.alignment=e.target.value;schedule();};$('#structure-threshold').onchange=e=>{state.threshold=Number(e.target.value);state.analysis=null;schedule();};
  for(const button of document.querySelectorAll('[data-structure-frequency]'))button.onclick=()=>{state.structureFrequency=button.dataset.structureFrequency;document.querySelectorAll('[data-structure-frequency]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));schedule();};
  for(const button of document.querySelectorAll('[data-structure-period]'))button.onclick=()=>{state.period=button.dataset.structurePeriod;state.periodPage=0;document.querySelectorAll('[data-structure-period]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));if(state.dataset)renderPeriods(structure());};
  $('#structure-prev').onclick=()=>{state.periodPage=Math.max(0,state.periodPage-1);renderPeriods(structure());};$('#structure-next').onclick=()=>{state.periodPage++;renderPeriods(structure());};
  $('#structure-json').onclick=()=>{if(state.dataset)download('Bitcoin_Market_Structure.json',JSON.stringify(structure(),null,2));};
  $('#legacy-comparison').addEventListener('toggle',()=>{if($('#legacy-comparison').open)window.dispatchEvent(new Event('resize'));});
  return {setDataset(dataset){if(state.dataset===dataset)return;if(state.selectedDate===state.dataset?.prices.at(-1)?.[0])state.selectedDate=null;state.dataset=dataset;state.base=null;state.analysis=null;state.models.clear();state.futureStates.clear();state.methodKey=null;schedule();},show(value){state.visible=value;if(value)schedule();},showCompare(value){state.compareVisible=value;if(value)schedule();}};
}
