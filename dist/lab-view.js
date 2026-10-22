import { drawAtlasPriceChart as drawChart } from './atlas-price-chart.js?v=1.10.3';
import { renderCryptoConAudit } from './cryptocon-audit.js?v=1.10.3';
import { bindChartNavigation, panRange } from './chart-navigation.js?v=1.10.3';
import { renderAtlasAnalysis } from './atlas-analysis.js?v=1.10.3';
import { ANALYSIS_MODES, analysisCalendarDate, shouldPublishInspection, analysisSelectionSummary } from './analysis-dock.js?v=1.10.3';
import { INDICATORS, readIndicatorState, writeIndicatorState, changeIndicatorState, isIndicatorVisible, visibleAnalysisIds } from './indicator-state.js?v=1.10.3';
import { preparePriceViewData } from './price-view-data.js?v=1.10.3';
import { chartSelectionHandler } from './inspection-policy.js?v=1.10.3';
import { buildScenarioCountdown, koreanCalendarDate } from './scenario-countdown.js?v=1.10.3';
import { buildLongHorizonForecast } from './long-horizon-forecast.js?v=1.10.3';
import { longHorizonMethodMarkup } from './long-horizon-view.js?v=1.10.3';
import { CHART_INTERVALS, chartInterval, isIntradayInterval } from './ohlc-data.js?v=1.10.3';
import { drawIntradayChart } from './intraday-chart.js?v=1.10.3';
import { createMarketDataController, marketStatusText } from './market-data-controller.js?v=1.10.3';
import { parseVolumeSnapshot, aggregateWeeklyVolume } from './volume-data.js?v=1.10.3';
import { fitVolumeForecastModel, projectVolumeForecast } from './volume-forecast.js?v=1.10.3';
import { BITCOIN_EVENTS } from './bitcoin-events.js?v=1.10.3';
import { historicalEventDetail } from './research-workbench.js?v=1.10.3';
import { formatBtcVolume } from './chart-overlays.js?v=1.10.3';
import { analyzeMarketStructure, computeRollingStates, detectDirectionalChanges, STATE_LABELS } from './market-structure.js?v=1.10.3';
import { utcDay, dateFromDay } from './cycle-engine.js?v=1.10.3';
import { shiftCalendarMonths } from './cycle-timing.js?v=1.10.3';
import { chartPresetRange, DEFAULT_CHART_SPAN, CHART_SPANS } from './chart-presets.js?v=1.10.3';
import { createChartSvgExport } from './chart-export.js?v=1.10.3';
import { clearChartHover } from './chart-hover.js?v=1.10.3';

const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const numberFormats=new Map();
const nf = (value, digits = 0) => {if(!Number.isFinite(value))return '—';if(!numberFormats.has(digits))numberFormats.set(digits,new Intl.NumberFormat('en-US',{maximumFractionDigits:digits,minimumFractionDigits:digits}));return numberFormats.get(digits).format(value);};
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
  const state={dataset:null,base:null,analysis:null,models:new Map(),futureStates:new Map(),visible:false,compareVisible:false,scenario:valid('assumption',['base','accelerated','wait','late','stress'],'base'),frequency:valid('granularity',['daily','weekly'],'daily'),scale:valid('axis',['log','linear'],'log'),tool:'crosshair',magnet:valid('magnet',['off','weak','strong'],'off'),measurement:null,unit:'usd',window:valid('span',CHART_SPANS,DEFAULT_CHART_SPAN),atlasMode:'price',cryptoView:'timing',atlasAlignment:valid('align',['trough','calendar','halving'],'trough'),atlasPeriod:valid('interval',['monthly','quarterly'],'monthly'),atlasMetric:valid('measure',['returnPct','maxDrawdownPct','realizedVolPct','discoveryDays'],'returnPct'),atlasPhase:valid('phase',['macro','bull','bear'],'macro'),atlasScope:valid('scope',['recent','all'],'recent'),selectedDate:null,methodKey:null,selectedEvent:null,eventMode:'macro',eventPage:0,structureFrequency:'weekly',scope:'all',threshold:.12,alignment:'calendar',period:'monthly',periodPage:0,pending:false};
  function fail(error){console.error('Detailed research workspace',error);$('#lab-error').hidden=false;$('#lab-error').textContent='분석을 계산하지 못했습니다. 원자료와 계산 결과를 확인해 주세요.';}
  state.indicators=readIndicatorState(query);
  state.atlasMode='price';state.analysisMode=state.indicators.active;state.analysisOpen=visibleAnalysisIds(state.indicators).length>0;state.priceController=null;state.analysisController=null;state.inspectionOwner='price';state.lastAnalysisDetail=null;state.lastPriceDetail=null;state.lastCountdownInspection=null;
  state.analysisControllers=new Map();state.analysisDetails=new Map();state.analysisRenderKeys=new Map();state.analysisDataset=null;
  state.cryptoView=valid('audit',['timing','thresholds','targets'],'timing');
  state.priceRange=null;state.marketRange=null;state.chartRange=null;state.historyCategory='all';state.selectedHistoryEvent=null;
  state.frequency=valid('granularity',CHART_INTERVALS.map(item=>item.id),'daily');
  state.chartType=valid('type',['line','candles'],'line');
  state.marketSelectedTime=null;
  state.candleFitDone=false;
  const marketData=createMarketDataController({preferSnapshot:true,onChange:()=>schedule(),readEmbedded:()=>document.getElementById('embedded-ohlc-data')?.textContent});
  let volumeState={status:'idle',series:null,error:null},volumeCache=new Map(),volumeModelCache=new Map(),volumeProjectionCache=new Map();
  state.volumeProjection=null;
  const countdownCache=new WeakMap(),kstToday=()=>koreanCalendarDate();
  function countdownFor(m){const today=kstToday(),cached=countdownCache.get(m);if(cached?.today===today)return cached.value;const value=buildScenarioCountdown(m,{today});countdownCache.set(m,{today,value});return value;}
  async function loadVolume({force=false}={}){
    if(volumeState.status==='loading'||(!force&&volumeState.status!=='idle'))return;
    volumeState={...volumeState,status:'loading',error:null};
    try{const embedded=$('#embedded-volume-data')?.textContent;let payload;if(embedded)payload=JSON.parse(embedded);else{const response=await fetch('./data/btc-volume.json',{credentials:'omit',cache:'no-cache',signal:AbortSignal.timeout(12000)});if(!response.ok)throw new Error(`거래량 자료 HTTP ${response.status}`);payload=await response.json();}
      volumeState={status:'ready',series:parseVolumeSnapshot(payload),error:null};volumeCache.clear();volumeModelCache.clear();volumeProjectionCache.clear();
    }catch(error){volumeState={...volumeState,status:'error',error:error.message};}
    schedule();
  }
  function historicalSeries(asOf){
    if(!volumeState.series)return null;const key=`${asOf}/${state.frequency}`;if(volumeCache.has(key))return volumeCache.get(key);
    const daily=volumeState.series.bars.filter(bar=>bar.date<=asOf),result=state.frequency==='weekly'?aggregateWeeklyVolume(daily,{asOf,source:volumeState.series.source}):{...volumeState.series,bars:daily};volumeCache.set(key,result);return result;
  }
  function forecastVolume(m){
    if(!volumeState.series)return null;
    const modelKey=`${m.asOf}/${volumeState.series.retrievedAt}`,key=`${modelKey}/${state.scenario}/${state.frequency}/${m.displayEnd}`;
    if(volumeProjectionCache.has(key))return volumeProjectionCache.get(key);
    try{
      if(!volumeModelCache.has(modelKey))volumeModelCache.set(modelKey,fitVolumeForecastModel(volumeState.series.bars,{asOf:m.asOf,source:volumeState.series.source}));
      const fitted=volumeModelCache.get(modelKey),assumptions=m.longHorizon?.assumptions;
      const result=projectVolumeForecast(fitted,m.path,{asOf:m.asOf,endDate:m.displayEnd,frequency:state.frequency,terminalVolatility:(assumptions?.terminalVolatilityPct??20)/100*(m.assumptions?.volatilityMultiplier??1),volatilityHalfLifeYears:assumptions?.volatilityHalfLifeYears??8});
      volumeProjectionCache.set(key,result);return result;
    }catch(error){const result={status:'unavailable',reason:'거래량 모형을 계산하지 못했습니다. 실제 관측은 계속 표시합니다.'};volumeProjectionCache.set(key,result);console.warn('Volume scenario unavailable',error);return result;}
  }
  function volumeMetadata(){const series=volumeState.series;if(!series)return null;const check=series.validation;return {source:series.source,firstDate:series.firstDate,lastDate:series.lastDate,retrievedAt:series.retrievedAt,count:series.bars.length,gapCount:series.coverage.gapCount,zeroCount:series.coverage.sourceZeroVolumeBars,validation:{status:check?.status,hourlyDays:check?.nativeResolution?.hourly?.completeDays,quarterHourlyDays:check?.nativeResolution?.quarterHourly?.completeDays,firstDate:check?.nativeResolution?.hourly?.firstDate,lastDate:check?.nativeResolution?.hourly?.lastDate,tradeMinutes:check?.baseUnit?.completedMinutes,overlapDays:check?.cachedCoinbase?.overlappingDays}};}
  const plot=$('.atlas-plot');
  $('#lab-chart').addEventListener('keydown',event=>{
    if(state.tool!=='crosshair')return;
    if(['Enter',' '].includes(event.key)&&!event.target.closest('[data-next-turn],[data-history-event]')){event.preventDefault();showPriceInspection();}
  });
  const analysisCharts=new Map([...document.querySelectorAll('[data-analysis-svg]')].map(svg=>[svg.dataset.analysisSvg,svg]));
  const selectedAnalysisSvg=()=>analysisCharts.get(state.analysisMode);
  function resetChartRange(){marketData.cancel();state.priceRange=null;state.marketRange=null;state.window=DEFAULT_CHART_SPAN;state.selectedEvent=null;state.selectedHistoryEvent=null;document.dispatchEvent(new CustomEvent('atlas:close-detail'));schedule();}
  const chartNavigation=bindChartNavigation({element:plot,getTool:()=>state.tool,getRange:()=>state.visible&&state.atlasMode==='price'?state.chartRange:null,
    getContext:context=>state.priceController?.getSelection?.(context)||{label:'선택한 실제 자료 또는 가정',copyText:null},
    onAnnounce:text=>{if($('#workbench-announcement'))$('#workbench-announcement').textContent=text;},
    onRangeChange:range=>{if(range.unit==='seconds'){state.marketRange={start:range.start,end:range.end};void marketData.ensureRange(state.frequency,state.marketRange);}else state.priceRange={start:range.start,end:range.end};state.chartRange={...state.chartRange,...range};state.selectedEvent=null;state.selectedHistoryEvent=null;schedule();},onReset:resetChartRange});
  $('#workbench-navigation').append(chartNavigation.toolbar);
  function base(){
    if(state.base)return state.base;
    const pivots=detectDirectionalChanges(state.dataset);
    let high=0;const rows=state.dataset.prices.map(([date,price])=>{high=Math.max(high,price);return {date,price,drawdownPct:(price/high-1)*100};});
    state.base={pivots,rows};return state.base;
  }
  function model(){
    if(state.models.has(state.scenario))return state.models.get(state.scenario);
    const asOf=state.dataset.prices.at(-1)[0],referenceDate=asOf>'2026-10-21'?dateFromDay(D(asOf)+1):'2026-10-22';
    const m=buildLongHorizonForecast(state.dataset,{asOf,referenceDate,scenario:state.scenario,seed:20261022,sampleCount:128,blockDays:28});
    state.models.set(state.scenario,m);return m;
  }
  function currentFib(){
    const pivots=base().pivots.pivots;if(pivots.length<2)return[];
    const a=pivots.at(-2),b=pivots.at(-1),low=Math.min(a.eventPrice,b.eventPrice),high=Math.max(a.eventPrice,b.eventPrice);
    return [.236,.382,.5,.618,.786].map(ratio=>({ratio,price:b.type==='high'?high-ratio*(high-low):low+ratio*(high-low),startDate:b.confirmationDate}));
  }
  function syncAtlasUrl(){
    const p=new URLSearchParams(location.search);
    writeIndicatorState(p,state.indicators);
    for(const [key,value,defaultValue] of [['span',state.window,DEFAULT_CHART_SPAN],['magnet',state.magnet,'off'],['assumption',state.scenario,'base'],['granularity',state.frequency,'daily'],['axis',state.scale,'log'],['align',state.atlasAlignment,'trough'],['interval',state.atlasPeriod,'monthly'],['measure',state.atlasMetric,'returnPct'],['scope',state.atlasScope,'recent'],['phase',state.atlasPhase,'macro'],['audit',state.cryptoView,'timing']])value===defaultValue?p.delete(key):p.set(key,value);
    state.chartType==='line'?p.delete('type'):p.set('type',state.chartType);
    if(p.get('page')==='compare'&&!p.has('legacy'))p.delete('page');
    try{history.replaceState(null,'',`${location.pathname}${p.size?'?'+p:''}`);}catch{}
  }
  function inspect(detail,options={}){
    if(!detail)return;
    const owner=options.owner||'price',user=options.user===true;
    if(owner==='price')state.lastPriceDetail=detail;
    if(!shouldPublishInspection({owner,currentOwner:state.inspectionOwner,user}))return;
    if(user)state.inspectionOwner=owner;
    if(user&&owner==='price'&&detail.kind!=='history'){state.selectedEvent=null;state.selectedHistoryEvent=null;}
    queueMicrotask(updateNavigation);
    const labels={observed:'관측',simulated:'가정',assumption:'가정',distribution:'모의 요약',history:'역사 사건'};
    $('#atlas-inspector-kind').textContent=labels[detail.kind]||'실제 관측';$('#atlas-inspector-kind').dataset.kind=detail.kind;
    $('#atlas-inspector-title').textContent=detail.label;
    $('#atlas-inspector-values').innerHTML=(detail.fields||[]).map(f=>`<div><span>${esc(f.label)}</span><strong>${esc(f.value)}</strong></div>`).join('');
    $('#atlas-inspector-note').textContent=detail.note||'';
    if(detail.date&&owner==='price'&&detail.kind!=='history'){
      if(isIntradayInterval(state.frequency))state.marketSelectedTime=detail.date;
      else{state.selectedDate=detail.date;$('#atlas-date').value=detail.date;}
    }
    if(user&&$('#workbench-announcement'))$('#workbench-announcement').textContent=owner==='analysis'?`${analysisSelectionSummary(detail,{mode:state.analysisMode,metric:state.atlasMetric})} · ${labels[detail.kind]||'관측'}`:`${detail.label} · ${labels[detail.kind]||'관측'} · ${detail.fields?.[0]?.value||''}`;
    document.dispatchEvent(new CustomEvent('atlas:inspection',{detail:{...detail,owner,analysisMode:owner==='analysis'?state.analysisMode:null,userInitiated:user,openPanel:options.openPanel===true}}));
  }
  const inspectPriceSelection=chartSelectionHandler(inspect);
  function publishCountdownInspection(m,{user=false,openPanel=false}={}){
    const c=countdownFor(m);
    if(!user&&state.lastCountdownInspection===c)return;
    const currentSpan=c.currentUntil?`${c.currentUntil}까지${c.currentRightCensored?' 표시':''} · ${c.currentRightCensored?'최소 ':''}${c.holdDays}일 (오늘 포함)`:'—';
    inspect({label:'다음 국면 · 조건부 시나리오',kind:'assumption',date:c.date||null,fields:[{label:'현재 국면',value:c.currentLabel||'—'},{label:'현재 연속 구간',value:currentSpan},{label:'다음 지속 후보',value:c.nextLabel||(c.status==='maintained'?'표시 범위에 없음':'계산 불가')},{label:'다음 후보까지',value:c.date?`${c.dday} · ${c.date}`:'—'},{label:'유지 확인 조건',value:`${c.minimumRunDays||7}일 연속`},{label:'관측 종료',value:`${c.asOf||'—'} UTC`},{label:'관측 경과',value:`${c.asOfAgeDays??'—'}일`}],note:c.note||'같은 미래 가격 경로에서 계산한 조건부 국면이며 확정된 일정이나 매매 신호가 아닙니다.'},{owner:'countdown',user,openPanel});
    state.lastCountdownInspection=c;
  }
  function analysisDate(detail=state.lastAnalysisDetail){return analysisCalendarDate(detail,{firstDate:state.dataset?.prices[0]?.[0],lastDate:state.dataset?.prices.at(-1)?.[0]});}
  function publishAnalysisState(extra={}){document.dispatchEvent(new CustomEvent('atlas:analysis-state',{detail:{mode:state.analysisMode,metric:state.atlasMetric,open:state.analysisOpen,...extra}}));}
  function publishIndicators(){
    state.analysisOpen=visibleAnalysisIds(state.indicators).length>0;
    for(const item of INDICATORS)if(item.control){const input=$(`#${item.control}`);if(input)input.checked=isIndicatorVisible(state.indicators,item.id);}
    document.dispatchEvent(new CustomEvent('atlas:indicator-state',{detail:{indicators:state.indicators,cycleCalibration:state.models.get(state.scenario)?.cycleCalibration?.current}}));
  }
  function activateAnalysis(mode){
    if(!visibleAnalysisIds(state.indicators).includes(mode))return;
    state.indicators=changeIndicatorState(state.indicators,{action:'activate',id:mode});state.analysisMode=mode;
    state.analysisController=state.analysisControllers.get(mode)||null;state.lastAnalysisDetail=state.analysisDetails.get(mode)||null;
    publishIndicators();syncAtlasUrl();
  }
  function inspectAnalysis(mode,detail,{user=false}={}){
    state.analysisDetails.set(mode,detail);
    if(user)activateAnalysis(mode);
    if(mode===state.analysisMode)state.lastAnalysisDetail=detail;
    publishAnalysisState({mode,detail,calendarDate:analysisDate(detail)});
    if(mode===state.analysisMode)inspect(detail,{owner:'analysis',user,openPanel:false});
  }
  function drawAnalysisIndicators(){
    publishIndicators();
    if(state.analysisDataset!==state.dataset){state.analysisDataset=state.dataset;state.analysisRenderKeys.clear();state.analysisControllers.clear();state.analysisDetails.clear();}
    const visible=visibleAnalysisIds(state.indicators);
    for(const mode of visible){
      const settings=mode==='cycles'?[state.atlasAlignment]:mode==='duration'?[state.atlasPhase]:mode==='periods'?[state.atlasPeriod,state.atlasMetric,state.atlasScope]:mode==='cryptocon'?[state.cryptoView]:[];
      const svg=analysisCharts.get(mode),key=[Math.round(svg.clientWidth),Math.round(svg.clientHeight),...settings].join('/');
      if(state.analysisRenderKeys.get(mode)===key)continue;
      const onInspect=(detail,options)=>inspectAnalysis(mode,detail,options);
      const controller=mode==='cryptocon'?renderCryptoConAudit({svg,dataset:state.dataset,view:state.cryptoView,onInspect}):renderAtlasAnalysis({svg,dataset:state.dataset,mode:mode==='duration'&&state.atlasPhase!=='macro'?'phases':mode,phaseLeg:state.atlasPhase==='bear'?'bear':'bull',alignment:state.atlasAlignment,period:state.atlasPeriod,metric:state.atlasMetric,scope:state.atlasScope,onInspect});
      state.analysisControllers.set(mode,controller);state.analysisRenderKeys.set(mode,key);
      const detail=state.analysisDetails.get(mode);publishAnalysisState({mode,controller,detail,calendarDate:analysisDate(detail)});
    }
    state.analysisController=visible.includes(state.analysisMode)?state.analysisControllers.get(state.analysisMode)||null:null;
    state.lastAnalysisDetail=state.analysisDetails.get(state.analysisMode)||null;
  }
  function showPriceInspection(){state.inspectionOwner='price';if(state.lastPriceDetail)inspect(state.lastPriceDetail,{openPanel:false});updateNavigation();}
  function useAnalysisNavigation(direction){
    if(!state.analysisOpen||!state.analysisController)return;
    state.analysisController[direction]?.();
    publishAnalysisState({controller:state.analysisController});updateNavigation();
  }
  function saveSvg(svg,name){
    const primary=svg===$('#lab-chart'),intraday=isIntradayInterval(state.frequency);
    const content=createChartSvgExport(svg,{title:primary?`BTCUSD · ${chartInterval(state.frequency).label} · ${state.chartType==='candles'?'캔들':'가격선'} · UTC`:'Bitcoin Cycles · 분석',readout:primary?($('#lab-metrics').innerText||$('#lab-metrics').textContent).replace(/\s+/gu,' ').trim():state.lastAnalysisDetail?.label||'',source:primary?$('#workbench-market-status')?.textContent||'':state.lastAnalysisDetail?.note||'',note:primary?(intraday?'완료된 실제 거래소 봉 · 이 거래소 현물쌍의 BTC 거래량 · 빈 구간은 채우지 않습니다.':'실선·캔들: 실제 관측 · 점선·음영: 조건부 시나리오, 확률구간 아님 · Coin Metrics / Bitstamp'): '출처와 가정은 사이트의 분석 근거를 확인하세요.',countdown:primary&&!intraday&&!$('#scenario-countdown')?.hidden?[...$('#scenario-countdown').children].map(node=>node.innerText||node.textContent).join(' · '):''});
    download(name,content,'image/svg+xml;charset=utf-8');
  }
  function renderHover(detail){
    if(!detail||state.atlasMode!=='price')return;
    document.dispatchEvent(new CustomEvent('atlas:readout',{detail:{...detail,frequency:state.frequency,unit:state.unit}}));
    const key=[state.frequency,state.unit,isIndicatorVisible(state.indicators,'volume'),detail.date,detail.price,detail.displayedPrice,detail.changePct,detail.kind,detail.open,detail.high,detail.low,detail.close,detail.volume,detail.volumeKind,detail.volumeLower,detail.volumeUpper,detail.volumeSource,detail.source].join('/');
    if(state.hoverReadoutKey===key)return;state.hoverReadoutKey=key;
    const future=detail.kind==='simulated',label=detail.kind==='unavailable'?'자료 없음':future?'가정':'관측',intraday=isIntradayInterval(state.frequency),ohlc=Number.isFinite(detail.open);
    const displayPrice=state.unit==='indexed'?nf(detail.displayedPrice??detail.price/base().rows.at(-1).price*100,1):usd(detail.price,intraday||detail.price<10?2:0),change=Number.isFinite(detail.changePct)?pct(detail.changePct):'—';
    $('#lab-metrics').dataset.kind=detail.kind;
    const shownDate=intraday?detail.date.slice(0,16).replace('T',' '):dateLabel(detail.date),values=ohlc?`<span class="readout-ohlc"><span>O <b>${usd(detail.open,2)}</b></span><span>H <b>${usd(detail.high,2)}</b></span><span>L <b>${usd(detail.low,2)}</b></span><span>C <b>${usd(detail.close,2)}</b></span></span>`:'';
    const projectedVolume=detail.volumeKind==='scenario',volumeUnit=projectedVolume?`BTC/${state.frequency==='weekly'?'주':'일'}`:'BTC';
    const volumeTitle=projectedVolume?`${detail.volumeSource} 관측 기반 조건부 평균 · ${detail.volumeStartDate}–${detail.volumeEndDate} UTC · ${formatBtcVolume(detail.volumeLower)}–${formatBtcVolume(detail.volumeUpper)} BTC · 실체결이나 확률구간이 아닙니다.`:`${detail.volumeSource||detail.source} BTC/USD 현물`;
    const volume=isIndicatorVisible(state.indicators,'volume')&&Number.isFinite(detail.volume)?`<span class="readout-volume${projectedVolume?' is-projected':''}" title="${esc(volumeTitle)}">Vol${projectedVolume?' 가정':''} <b>${formatBtcVolume(detail.volume)}</b> ${volumeUnit}</span>`:'';
    $('#lab-metrics').innerHTML=`<span class="readout-main"><span class="atlas-symbol">${chartInterval(state.frequency).label}<span class="readout-kind">${label}</span></span><strong>${displayPrice}</strong><span class="atlas-day-change ${tone(detail.changePct)}">${change}</span><span class="atlas-observation-date">${shownDate} UTC</span></span><span class="readout-detail">${values}${volume}</span>`;
    $('#lab-metrics').title=detail.kind==='unavailable'?`${detail.source||'거래소'} · ${shownDate} UTC · 이 구간에 확인된 완료 봉이 없습니다.`:ohlc?`${detail.source} BTC-USD · ${shownDate} UTC · O ${usd(detail.open,2)} H ${usd(detail.high,2)} L ${usd(detail.low,2)} C ${usd(detail.close,2)} · 시가 대비 ${change} · ${nf(detail.volume,6)} BTC`:`${label} · ${shownDate} UTC · ${future?'조건부 예시 가격':'Coin Metrics 일말 가격'} ${usd(detail.price)} · 전일 대비 ${change}${detail.volumeSource?` · ${detail.volumeSource} ${projectedVolume?'가정 평균 거래량':'거래량'} ${nf(detail.volume,6)} ${volumeUnit}`:''}`;
  }
  function renderReadout(m,b,next){
    $('#lab-asof').textContent=`실제 자료 ${dateLabel(m.asOf)}까지 · UTC`;
    $('#atlas-reference').textContent=`계산 기준 ${dateLabel(m.referenceDate)}`;
    $('#sidebar-reference').textContent=`계산 기준 · ${dateLabel(m.referenceDate)}`;
  }
  function drawOutlook(){
    if(!state.dataset||!state.visible)return;
    try{
      const focusId=document.activeElement?.id,focusEventId=document.activeElement?.dataset?.atlasEvent;
      const m=model(),b=base(),next=nextTurnInfo(m),intraday=isIntradayInterval(state.frequency);
      plot.dataset.mode='price';plot.dataset.intraday=String(intraday);$('#lab-metrics').hidden=!isIndicatorVisible(state.indicators,'readout');
      $('#lab-chart').removeAttribute('hidden');$('#lab-tooltip').hidden=true;
      $('#atlas-price-controls').hidden=false;
      $('[data-lab-frequency]').closest('fieldset').hidden=false;
      for(const id of ['lab-unit','lab-band','lab-turns','lab-fib','atlas-drawdown','atlas-states'])$(`#${id}`).closest('label').hidden=intraday&&id!=='lab-unit';
      $('#lab-json').hidden=false;
      $('#atlas-cryptocon-view').value=state.cryptoView;
      $('#atlas-event-rail').hidden=intraday;
      $('#lab-scenario').value=state.scenario;$('#lab-window').value=state.window;$('#lab-unit').value=state.unit;
      $('#atlas-phase').value=state.atlasPhase;$('#atlas-alignment').value=state.atlasAlignment;$('#atlas-period').value=state.atlasPeriod;$('#atlas-measure').value=state.atlasMetric;$('#atlas-period-scope').value=state.atlasScope;
      document.querySelectorAll('[data-lab-frequency]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.labFrequency===state.frequency)));
      renderReadout(m,b,next);
      if(volumeState.status==='idle')void loadVolume();
      const history=historicalSeries(m.asOf);
      const needsMarket=intraday;
      if(needsMarket&&marketData.get(state.frequency).status==='idle')void marketData.load(state.frequency);
      const market=needsMarket?marketData.get(state.frequency):null;
      state.volumeProjection=intraday?null:forecastVolume(m);
      if(intraday){
        state.chartRange=null;
        if(market.series){
          // Navigation has a real historical domain independent of the cached
          // snapshot. Expanding or panning requests the newly visible windows.
          const previousRange=state.marketRange;
          state.chartRange=panRange(marketData.range(state.frequency,previousRange),0);
          if(previousRange)state.marketRange={start:state.chartRange.start,end:state.chartRange.end};
          state.priceController=drawIntradayChart({range:state.chartRange,tool:state.tool,magnet:state.magnet,measurement:state.measurement,onMeasurement:value=>{state.measurement=value;if(value)state.marketSelectedTime=value.endDate||value.startDate;schedule();},historyStatus:market.historyStatus,showVolume:$('#atlas-volume').checked,headerInset:18,svg:$('#lab-chart'),series:market.series,chartType:state.chartType,scale:state.scale,unit:state.unit,onHover:renderHover,onInspect:inspectPriceSelection,selectedTime:state.marketSelectedTime});
          $('#lab-chart-title').textContent=`${chartInterval(state.frequency).label} · ${market.series.firstDate.slice(0,16).replace('T',' ')} — ${market.series.lastDate.slice(0,16).replace('T',' ')} UTC`;
          $('#lab-asof').textContent=`완료 봉 ${market.series.lastDate.slice(0,16).replace('T',' ')} UTC까지`;
        }else{
          state.priceController=null;
          const svg=$('#lab-chart');clearChartHover(svg);svg.onclick=null;svg.onpointermove=null;svg.onpointerleave=null;svg.onkeydown=null;svg.onkeyup=null;
          state.hoverReadoutKey=null;$('#lab-metrics').dataset.kind='unavailable';
          document.dispatchEvent(new CustomEvent('atlas:readout',{detail:{kind:'unavailable',date:new Date().toISOString(),frequency:state.frequency,unit:state.unit,source:'Coinbase Exchange',price:NaN,volume:NaN,completed:false}}));
          svg.setAttribute('viewBox','0 0 1000 500');svg.innerHTML=`<text x="500" y="240" text-anchor="middle" fill="#b8c9dc" font-size="17">${market.status==='error'?'거래소 자료를 불러오지 못했습니다. 새로고침으로 다시 시도하세요.':'완료된 거래소 봉을 불러오는 중입니다.'}</text>`;
          $('#lab-metrics').innerHTML=`<span class="atlas-symbol">${chartInterval(state.frequency).label}</span><span>Coinbase BTC-USD · ${market.status==='error'?'연결 확인 필요':'조회 중'}</span>`;
          $('#lab-metrics').title='Coinbase BTC-USD의 완료된 실제 봉을 조회합니다.';
          $('#lab-asof').textContent=market.status==='error'?'거래소 봉 조회 실패':'거래소 봉 조회 중';
          $('#lab-chart-title').textContent=`${chartInterval(state.frequency).label} · 실제 거래소 OHLC`;
        }
        $('#atlas-axis-note').textContent=`${state.unit==='usd'?'USD':'최근 봉 = 100'} · ${state.scale==='linear'?'선형':'로그'}`;
        $('#atlas-chart-legend').innerHTML=`<span><i class="${state.chartType==='candles'?'legend-candle':'legend-observed'}"></i>실제 ${state.chartType==='candles'?'캔들':'종가'}</span><span>Coinbase BTC-USD · UTC</span>`;
        $('#atlas-chart-caveat').textContent='완료 봉';
        $('#atlas-chart-note').textContent=`${marketStatusText(market)}. 미완성 봉과 빈 구간은 채우지 않습니다. 장기 전망은 1D·1W에서 같은 차트에 이어 표시합니다.`;
        $('#atlas-inspect-prev').setAttribute('aria-label','이전 완료 봉');$('#atlas-inspect-next').setAttribute('aria-label','다음 완료 봉');
      }else{
        const last=b.rows.at(-1),prepared=preparePriceViewData(m,b.rows,b.pivots.pivots);
        const {future,rows:allRows}=prepared,ref=m.referenceDate,end=m.displayEnd;
        const preset=chartPresetRange({asOf:m.asOf,referenceDate:ref,firstDate:b.rows[0].date,lastDate:end,span:state.window});
        let start=preset.start,chartEnd=preset.end;
        if(state.priceRange){start=state.priceRange.start;chartEnd=state.priceRange.end;}
        state.chartRange={start,end:chartEnd,min:b.rows[0].date,max:end,contextKey:`daily:${state.frequency}:${m.asOf}`};
        if($('#atlas-states').checked&&!state.futureStates.has(state.scenario))state.futureStates.set(state.scenario,computeRollingStates({prices:[...state.dataset.prices,...future.map(p=>[p.date,p.price])]}).points);
                if(state.selectedEvent?.startsWith('macro-')&&!m.events[Number(state.selectedEvent.split('-')[1])]?.inHorizon)state.selectedEvent=null;
        const activeMarker=['low','high'].includes(state.selectedEvent)?turnInfo(m,state.selectedEvent):next;
        const observedCandles=history?.bars||[];
        state.priceController=drawChart({svg:$('#lab-chart'),tooltip:$('#lab-tooltip'),rows:allRows,start,end:chartEnd,split:m.asOf,frequency:state.frequency,chartType:state.chartType,observedCandles,candleSource:history?.source||'Bitstamp',volumeBars:history?.bars||[],volumeProjection:state.volumeProjection,volumeSource:history?.source||'Bitstamp',showVolume:$('#atlas-volume').checked,historicalEvents:BITCOIN_EVENTS.filter(event=>state.historyCategory==='all'||event.category===state.historyCategory),showHistoricalEvents:$('#atlas-history-events').checked,activeHistoricalEventId:state.selectedHistoryEvent,onHistoricalEvent:id=>focusHistoricalEvent(id,false),scale:state.scale,tool:state.tool,magnet:state.magnet,measurement:state.measurement,onMeasurement:value=>{state.measurement=value;if(value)state.selectedDate=value.endDate||value.startDate;schedule();},onHover:renderHover,unit:state.unit,denominator:last.price,headerInset:18,cycleCalibration:m.cycleCalibration,showCycleTiming:isIndicatorVisible(state.indicators,'cycle-timing'),band:$('#lab-band').checked,turns:prepared.turns,showTurns:$('#lab-turns').checked,events:prepared.events,states:state.futureStates.get(state.scenario),fib:$('#lab-fib').checked?currentFib():[],nextTurn:$('#lab-turns').checked?activeMarker:null,showNextTurnLabel:!isIndicatorVisible(state.indicators,'countdown'),onNextTurn:()=>focusEvent(activeMarker.type),showDrawdown:$('#atlas-drawdown').checked,showStates:$('#atlas-states').checked,onInspect:inspectPriceSelection,selectedDate:state.selectedDate||m.asOf});
        $('#atlas-date').min=b.rows[0].date;$('#atlas-date').max=end;
        $('#lab-chart-title').textContent=`${dateLabel(start)} — ${dateLabel(chartEnd)} · ${state.frequency==='daily'?'일별':'주별'} 가격`;
        $('#atlas-axis-note').textContent=`${state.unit==='usd'?'USD':'최근 = 100'} · ${state.scale==='linear'?'선형':'로그'}`;
        $('#atlas-chart-legend').innerHTML=`<span><i class="${state.chartType==='candles'&&observedCandles.length?'legend-candle':'legend-observed'}"></i>실제 가격</span><span><i class="legend-simulated"></i>미래 가정</span>`+($('#lab-band').checked?'<span><i class="legend-band"></i>가정 범위</span>':'')+($('#lab-turns').checked?'<span><i class="legend-turn"></i>고점·저점</span>':'');
        $('#atlas-chart-caveat').textContent='조건부 가정';
        const candleNote=state.chartType==='candles'?` ${observedCandles.length?`Bitstamp BTC/USD 캔들 ${observedCandles[0].date}–${observedCandles.at(-1).date} · 실제 OHLC. 이전 가격선과 미래 연결 기준은 Coin Metrics입니다.`:'실제 캔들을 기다리는 동안 Coin Metrics 일말 가격선을 표시합니다.'}`:'';
        $('#atlas-chart-note').textContent=`${m.scenario.label} · ${end.slice(0,4)}년까지. 점선과 음영은 출처·가정에 따른 시나리오이며 확률 예측구간이 아닙니다.${candleNote}`;
        $('#atlas-inspect-prev').textContent='←';$('#atlas-inspect-next').textContent='→';
        $('#atlas-inspect-prev').setAttribute('aria-label','이전 고점·저점');$('#atlas-inspect-next').setAttribute('aria-label','다음 고점·저점');
        renderEventRail(m);
        if(state.selectedEvent){inspectEvent(m,state.selectedEvent);}
        if(state.selectedHistoryEvent){const event=BITCOIN_EVENTS.find(event=>event.id===state.selectedHistoryEvent);if(event)inspect(historicalEventDetail(event),{openPanel:false});}
      }
      drawAnalysisIndicators();
      // A docking resize emits fresh price/analysis inspections. The explicitly
      // selected countdown keeps its own owner; only model/day changes refresh it.
      if(state.inspectionOwner==='countdown')publishCountdownInspection(m);
      const eventKey=`${m.asOf}/${state.scenario}/${state.eventMode}/${state.eventPage}`;if(eventKey!==state.eventsRenderKey){renderEvents(m);state.eventsRenderKey=eventKey;}const methodKey=`${m.asOf}/${m.scenario.id||state.scenario}`;if(methodKey!==state.methodKey){renderForecastMethod(m);state.methodKey=methodKey;}
      $('#lab-error').hidden=true;updateNavigation();chartNavigation.update();syncAtlasUrl();
      const historyLabels=$('#lab-chart').dataset;
      document.dispatchEvent(new CustomEvent('atlas:workbench-state',{detail:{mode:'price',analysisMode:state.analysisMode,analysisOpen:state.analysisOpen,countdown:countdownFor(m),inspectionOwner:state.inspectionOwner,historicalEventsVisible:$('#atlas-history-events').checked&&!intraday,historicalLabelMeta:{mode:historyLabels.historyLabelMode,labels:Number(historyLabels.historyLabelCount||0),total:Number(historyLabels.historyEventCount||0),hidden:Number(historyLabels.historyHiddenLabelCount||0)},scenario:state.scenario,frequency:state.frequency,chartType:state.chartType,intraday,asOf:m.asOf,intervalLabel:chartInterval(state.frequency).label,marketSeries:market?.series,volumeMeta:volumeMetadata(),volumeForecast:state.volumeProjection?{status:state.volumeProjection.status,reason:state.volumeProjection.reason,summary:state.volumeProjection.summary,annual:state.volumeProjection.annual,diagnostics:state.volumeProjection.diagnostics}:null,volumeError:volumeState.error,marketStatus:intraday?marketStatusText(market):volumeState.series?`${state.chartType==='candles'?'캔들·거래량':'거래량'} · Bitstamp BTC/USD · ${volumeState.series.retrievedAt.slice(0,16).replace('T',' ')} UTC 수집${state.chartType==='line'?' · 가격선 Coin Metrics':''}`:volumeState.error?'거래량 조회 실패 · 가격선은 이용 가능':'거래량 자료 불러오는 중',marketLoading:intraday?(market?.status==='loading'||market?.historyStatus==='loading'):volumeState.status==='loading',navigationAvailable:Boolean(state.chartRange),scale:state.scale,tool:state.tool,magnet:state.magnet,measurement:state.measurement,window:state.window,customRange:Boolean(intraday?state.marketRange:state.priceRange),start:state.chartRange?.start,end:state.chartRange?.end,next}}));
      if(state.openEventPanel){state.openEventPanel=false;const chart=$('#lab-chart');chart.focus({preventScroll:true});document.dispatchEvent(new CustomEvent('atlas:open-detail',{detail:{kind:'selection',focus:false,opener:chart}}));}
      if(focusId)document.getElementById(focusId)?.focus({preventScroll:true});else if(focusEventId)document.querySelector(`[data-atlas-event="${focusEventId}"]`)?.focus({preventScroll:true});
    }catch(error){fail(error);}
  }
  function focusHistoricalEvent(id,zoom=true){
    const event=BITCOIN_EVENTS.find(item=>item.id===id);if(!event||!state.dataset)return;
    const asOf=model().asOf,first=base().rows[0].date;if(event.date>asOf)return;
    if(zoom){marketData.cancel();state.atlasMode='price';if(isIntradayInterval(state.frequency))state.frequency='daily';state.marketRange=null;state.priceRange={start:dateFromDay(Math.max(D(first),D(event.date)-150)),end:dateFromDay(Math.max(D(first)+300,Math.min(D(asOf),D(event.date)+210)))};state.selectedDate=event.date<first?first:event.date;state.window='history';}
    state.selectedHistoryEvent=id;state.selectedEvent=null;state.tool='crosshair';
    inspect(historicalEventDetail(event),{user:true,openPanel:true});schedule();
  }
  document.addEventListener('atlas:history-event',event=>focusHistoricalEvent(event.detail.id,event.detail.zoom!==false));
  document.addEventListener('atlas:history-filter',event=>{state.historyCategory=event.detail.category;state.indicators=changeIndicatorState(state.indicators,{action:'add',id:'history'});if(!isIndicatorVisible(state.indicators,'history'))state.indicators=changeIndicatorState(state.indicators,{action:'visibility',id:'history'});publishIndicators();schedule();});
  function turnInfo(m,type){
    const w=m.diagnostics.firstTurnWindows?.[type];if(!w?.medianDate)return null;
    return {type,date:w.medianDate,lowerDate:w.lowerDate,upperDate:w.upperDate,confirmationDate:w.confirmationWindow?.medianDate,days:D(w.medianDate)-D(m.referenceDate),direction:type==='high'?'상승 뒤 조정':'조정 뒤 반등'};
  }
  function renderEventRail(m){
    const entries=['low','high'].map(type=>{const w=turnInfo(m,type);return w?{id:type,label:`첫 ${type==='low'?'저점':'고점'} 후보`,date:w.date,note:'여러 예시의 첫 전환 중앙일'}:null;}).filter(Boolean);
    m.events.map((e,i)=>({...e,index:i})).filter(e=>e.inHorizon).slice(0,2).forEach(e=>entries.push({id:`macro-${e.index}`,label:e.label.replace('거시 ','큰 ').replace('도달 기준','진입 가정'),date:e.date,note:'출처 기반 가치평가 가정',assumed:true}));
    $('#atlas-event-rail').style.setProperty('--atlas-events',String(entries.length));
    $('#atlas-event-rail').innerHTML=entries.map(e=>`<button data-atlas-event="${e.id}" class="${e.assumed?'event-hypothesis':''}"><span>${esc(e.label)}</span><strong>${dateLabel(e.date)}<span class="event-dday"> · D-${nf(D(e.date)-D(m.referenceDate))}</span></strong><small>${esc(e.note)}</small></button>`).join('');
    document.querySelectorAll('[data-atlas-event]').forEach(button=>button.onclick=()=>focusEvent(button.dataset.atlasEvent));
  }
  function focusEvent(id){
    const m=model(),e=['low','high'].includes(id)?turnInfo(m,id):m.events[Number(id.split('-')[1])];if(!e)return;
    state.inspectionOwner='price';state.selectedHistoryEvent=null;state.priceRange=null;state.atlasMode='price';state.selectedDate=e.date;state.window=['low','high'].includes(id)?'near':'all';state.selectedEvent=id;state.openEventPanel=true;schedule();
  }
  function inspectEvent(m,id){
    if(['low','high'].includes(id)){const e=turnInfo(m,id);if(!e)return;inspect({label:`첫 ${id==='low'?'저점':'고점'} 시기의 중앙값 · ${dateLabel(e.date)}`,date:e.date,kind:'distribution',fields:[{label:'후보일까지 · 계산 기준일 대비',value:`D-${nf(e.days)}`},{label:'여러 경로의 날짜 범위',value:`${dateLabel(e.lowerDate)}–${dateLabel(e.upperDate)}`},{label:'전환 뒤 방향 후보',value:e.direction},{label:'계산 기준일',value:dateLabel(m.referenceDate)}],note:'여러 예시 경로에서 첫 고점·저점이 나온 날짜를 요약했습니다. 금색 점선 한 개의 전환점이나 확정된 시장 일정이 아닙니다.'});}
    else{const e=m.events[Number(id.split('-')[1])];if(!e)return;inspect({label:`${e.label} · ${dateLabel(e.date)}`,date:e.date,kind:'assumption',fields:[{label:'표시 기준일 · 연말 배치',value:dateLabel(e.date)},{label:'가격 가정의 출처',value:e.isPublishedSourcePrice?'기관 원문 가격':'앱의 파생·스트레스 가정'},{label:'가정한 기준 가격',value:usd(e.price)},{label:'같은 날 예시 경로',value:usd(e.representativePriceOnDate)}],note:`${e.derivation||'출처의 수요·채택 가정을 적용한 가치평가 기준입니다.'} 대표 경로의 가격이나 최고·최저 시점을 확정하지 않습니다.`});}
  }
  function nextTurnInfo(m){
    if(m.longHorizon)return null;
    const windows=m.diagnostics.firstTurnWindows||{};
    const candidates=['high','low'].filter(type=>windows[type]?.medianDate&&windows[type].medianDate>=m.referenceDate).map(type=>({type,...windows[type]})).sort((a,b)=>a.medianDate.localeCompare(b.medianDate));
    if(candidates.length){const n=candidates[0],days=D(n.medianDate)-D(m.referenceDate);return {type:n.type,date:n.medianDate,lowerDate:n.lowerDate,upperDate:n.upperDate,days,direction:n.type==='high'?'상승 뒤 조정':'조정 뒤 반등',shortLabel:`다음 ${n.type==='high'?'고점':'저점'} 후보 · D−${nf(days)}`};}
    const n=m.localTurns.find(p=>p.date>=m.referenceDate);if(!n)return null;
    return {type:n.type,date:n.date,lowerDate:n.date,upperDate:n.date,days:D(n.date)-D(m.referenceDate),direction:n.type==='high'?'상승 뒤 조정':'조정 뒤 반등',shortLabel:`대표 ${n.type==='high'?'고점':'저점'} 후보`};
  }
  function renderEvents(m){
    const local=state.eventMode==='local',rows=local?m.localTurns:m.events,pageSize=8,start=local?state.eventPage*pageSize:0,selected=local?rows.slice(start,start+pageSize):rows;
    $('#lab-events-head').innerHTML=local?'<tr><th>모의 전환</th><th>경로상 날짜</th><th>경로상 가격</th><th>모의 확인일</th><th>확인 지연</th></tr>':'<tr><th>조건부 기준점</th><th>표시 날짜 · UTC</th><th>가격 가정</th><th>기준선 가격</th><th>표시 범위</th></tr>';
    $('#lab-events-body').innerHTML=selected.map(r=>local?`<tr><td>${r.type==='high'?'예시 고점':'예시 저점'}</td><td>${esc(dateLabel(r.date))}</td><td>${usd(r.price)}</td><td>${esc(dateLabel(r.confirmationDate))}</td><td class="lab-muted-cell">${nf(r.lagDays)}일</td></tr>`:`<tr><td>${esc(r.label)}</td><td class="lab-accent-cell">${esc(dateLabel(r.date))}</td><td>${r.isPublishedSourcePrice?'기관 원문':'앱의 파생 가정'}</td><td>${usd(r.price)}</td><td class="lab-muted-cell">${r.inHorizon?'표시 범위 안':'표시 범위 밖'}</td></tr>`).join('');
    $('#lab-events-foot').innerHTML=local?`대표 모의 경로의 전환입니다. 실제 발생일의 예측이나 매매 신호가 아닙니다. <span>${Math.min(start+1,rows.length)}–${Math.min(start+pageSize,rows.length)} / ${rows.length}</span><button id="lab-turn-prev" ${start===0?'disabled':''} aria-label="이전 고저점">←</button><button id="lab-turn-next" ${start+pageSize>=rows.length?'disabled':''} aria-label="다음 고저점">→</button>`:'기관 원문 가격과 앱에서 파생한 가정을 구분합니다. 연말 배치는 표시 규칙이며 대표 경로 가격이나 해당 연도의 고점·저점을 뜻하지 않습니다.';
    if(local){$('#lab-turn-prev').onclick=()=>{state.eventPage=Math.max(0,state.eventPage-1);renderEvents(m);};$('#lab-turn-next').onclick=()=>{state.eventPage++;renderEvents(m);};}
  }
  function renderForecastMethod(m){
    const markup=longHorizonMethodMarkup(m);
    $('#atlas-model-info').innerHTML=markup.summary;
    $('#lab-method').innerHTML=markup.details;
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
  const schedule=()=>{if(state.pending)return;state.pending=true;requestAnimationFrame(()=>{state.pending=false;drawOutlook();drawStructure();});};
  const scheduleAnalysis=()=>{if(state.analysisPending)return;state.analysisPending=true;requestAnimationFrame(()=>{state.analysisPending=false;if(!state.dataset||!state.visible)return;drawAnalysisIndicators();updateNavigation();syncAtlasUrl();});};
  function selectFrequency(value){
    if(!CHART_INTERVALS.some(interval=>interval.id===value))return;
    marketData.cancel();state.inspectionOwner='price';state.frequency=value;state.marketRange=null;state.selectedHistoryEvent=null;state.marketSelectedTime=null;state.measurement=null;state.tool='crosshair';
    state.selectedEvent=null;state.priceRange=null;schedule();
  }
  $('#lab-scenario').onchange=e=>{state.scenario=e.target.value;state.measurement=null;state.eventPage=0;schedule();};
  document.addEventListener('atlas:indicator-command',event=>{
    const before=state.indicators,command=event.detail||{};
    state.indicators=changeIndicatorState(before,command);state.analysisMode=state.indicators.active;
    if(command.action==='activate'){activateAnalysis(command.id);return;}
    if(!isIndicatorVisible(state.indicators,state.analysisMode)&&state.inspectionOwner==='analysis')showPriceInspection();
    publishIndicators();syncAtlasUrl();
    const htmlOnly=['readout','source','legend'].includes(command.id)||command.action==='collapse';
    if(!htmlOnly){if(ANALYSIS_MODES.some(item=>item.id===command.id))scheduleAnalysis();else schedule();}
  });
  document.addEventListener('atlas:countdown-detail',()=>{
    if(state.dataset)publishCountdownInspection(model(),{user:true,openPanel:true});
  });
  // The app bounds published checks to six hours while visible. A successful
  // price check can still have a newer volume snapshot at the same price cutoff.
  document.addEventListener('atlas:published-refresh',event=>{
    if(event.detail?.status==='success'&&!$('#embedded-volume-data'))void loadVolume({force:true});
  });
  document.addEventListener('atlas:analysis-command',event=>{
    const {action,value,mode}=event.detail||{};
    if(mode)activateAnalysis(mode);
    if(action==='activate')return;
    if(action==='select'&&ANALYSIS_MODES.some(mode=>mode.id===value)){state.indicators=changeIndicatorState(state.indicators,{action:'add',id:value});state.analysisMode=value;state.analysisOpen=true;state.lastAnalysisDetail=null;}
    else if(action==='toggle'){document.dispatchEvent(new CustomEvent('atlas:indicator-library'));return;}
    else if(action==='previous'||action==='next'){useAnalysisNavigation(action);return;}
    else if(action==='inspect'){if(state.lastAnalysisDetail)inspect(state.lastAnalysisDetail,{owner:'analysis',user:true,openPanel:true});return;}
    else if(action==='save'){if(state.analysisOpen&&state.analysisController)saveSvg(selectedAnalysisSvg(),`Bitcoin_Analysis_${state.analysisMode}.svg`);return;}
    else if(action==='locate-date'){
      const date=analysisDate();if(!date||!state.dataset)return;
      marketData.cancel();if(isIntradayInterval(state.frequency))state.frequency='daily';state.marketRange=null;state.marketSelectedTime=null;state.selectedDate=date;state.selectedHistoryEvent=null;state.selectedEvent=null;state.inspectionOwner='price';state.tool='crosshair';
      const first=base().rows[0].date,last=model().displayEnd;state.priceRange={start:dateFromDay(Math.max(D(first),D(date)-120)),end:dateFromDay(Math.min(D(last),D(date)+120))};state.window='history';state.openEventPanel=true;
    }else return;
    publishAnalysisState();schedule();
  });
  document.addEventListener('atlas:chart-command',event=>{
    if(!state.dataset||state.atlasMode!=='price')return;
    const {action,value}=event.detail;
    if(action==='price-inspection'){showPriceInspection();return;}
    if(action==='context-menu'){chartNavigation.openMenu();return;}
    if(action==='tool'&&['crosshair','pan','measure'].includes(value)){
      state.tool=value;if(value!=='measure'&&state.measurement&&!state.measurement.endDate)state.measurement=null;
      document.dispatchEvent(new CustomEvent('atlas:close-detail'));$('#lab-chart').focus({preventScroll:true});
    }else if(action==='frequency'){selectFrequency(value);return;}
    else if(action==='chart-type'&&['line','candles'].includes(value)){
      state.chartType=value;
      if(!isIntradayInterval(state.frequency)&&value==='line')marketData.cancel();
      if(value==='candles'&&!state.candleFitDone&&!isIntradayInterval(state.frequency)&&!state.priceRange&&['all','history'].includes(state.window)){
        const asOf=model().asOf;
        state.priceRange={start:dateFromDay(D(asOf)-(state.frequency==='weekly'?560:180)),end:dateFromDay(D(asOf)+30)};
        state.selectedDate=asOf;state.candleFitDone=true;
        $('#workbench-announcement').textContent='실제 캔들을 확인할 수 있도록 최근 구간으로 확대했습니다. 하단 장기 전망으로 전체 미래를 다시 봅니다.';
      }
    }
    else if(action==='refresh-market'){if(isIntradayInterval(state.frequency)){const interval=state.frequency;void marketData.load(interval,{force:true}).then(()=>{if(state.frequency===interval&&state.marketRange)void marketData.ensureRange(interval,state.marketRange);});}else void loadVolume({force:true});return;}
    else if(action==='magnet'&&['off','weak','strong'].includes(value))state.magnet=value;
    else if(action==='clear-measurement')state.measurement=null;
    else if(action==='span'&&CHART_SPANS.includes(value)){state.window=value;state.priceRange=null;state.selectedEvent=null;state.selectedHistoryEvent=null;}
    else if(action==='scale')state.scale=state.scale==='log'?'linear':'log';
    else if(action==='fit'){resetChartRange();return;}
    else if(action==='next-turn'){state.tool='crosshair';const next=nextTurnInfo(model());if(next)focusEvent(next.type);return;}
    else return;
    schedule();
  });
  $('#lab-unit').onchange=e=>{state.unit=e.target.value;schedule();};$('#lab-window').onchange=e=>{state.selectedHistoryEvent=null;state.window=e.target.value;state.priceRange=null;state.selectedEvent=null;schedule();};
  for(const item of INDICATORS.filter(item=>item.control))$(`#${item.control}`).onchange=event=>{
    if(event.target.checked){state.indicators=changeIndicatorState(state.indicators,{action:'add',id:item.id});if(!isIndicatorVisible(state.indicators,item.id))state.indicators=changeIndicatorState(state.indicators,{action:'visibility',id:item.id});}
    else if(isIndicatorVisible(state.indicators,item.id))state.indicators=changeIndicatorState(state.indicators,{action:'visibility',id:item.id});
    publishIndicators();schedule();
  };
  for(const button of document.querySelectorAll('[data-lab-frequency]'))button.onclick=()=>selectFrequency(button.dataset.labFrequency);
  for(const button of document.querySelectorAll('[data-lab-events]'))button.onclick=()=>{state.eventMode=button.dataset.labEvents;state.eventPage=0;document.querySelectorAll('[data-lab-events]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));if(state.dataset)renderEvents(model());};
  $('#lab-json').onclick=()=>{if(state.dataset)download('Bitcoin_Long_Horizon_Scenarios.json',JSON.stringify(model(),null,2));};
  $('#lab-svg').onclick=()=>saveSvg($('#lab-chart'),'Bitcoin_Price_and_Future.svg');
  $('#atlas-phase').onchange=e=>{state.atlasPhase=e.target.value;scheduleAnalysis();};
  $('#atlas-alignment').onchange=e=>{state.atlasAlignment=e.target.value;scheduleAnalysis();};
  $('#atlas-period').onchange=e=>{state.atlasPeriod=e.target.value;scheduleAnalysis();};
  $('#atlas-measure').onchange=e=>{state.atlasMetric=e.target.value;scheduleAnalysis();};
  $('#atlas-period-scope').onchange=e=>{state.atlasScope=e.target.value;scheduleAnalysis();};
  function updateNavigation(){
    const analysis=state.inspectionOwner==='analysis',c=analysis?state.analysisController:state.priceController;
    $('#atlas-inspect-prev').disabled=typeof c?.previous!=='function'||Boolean(c?.hasPrevious)&&!c.hasPrevious();$('#atlas-inspect-next').disabled=typeof c?.next!=='function'||Boolean(c?.hasNext)&&!c.hasNext();
    $('#atlas-date-label').hidden=analysis||isIntradayInterval(state.frequency);$('#atlas-latest').hidden=analysis;
    const item=analysis?(state.analysisMode==='cycles'?'경과일':state.analysisMode==='periods'?'기간':'분석 항목'):isIntradayInterval(state.frequency)?'완료 봉':'고점·저점';$('#atlas-inspect-prev').setAttribute('aria-label',`이전 ${item}`);$('#atlas-inspect-next').setAttribute('aria-label',`다음 ${item}`);
  }
  $('#atlas-inspect-prev').onclick=()=>{if(state.inspectionOwner==='analysis')useAnalysisNavigation('previous');else state.priceController?.previous();updateNavigation();};$('#atlas-inspect-next').onclick=()=>{if(state.inspectionOwner==='analysis')useAnalysisNavigation('next');else state.priceController?.next();updateNavigation();};
  $('#atlas-date').onchange=e=>{if(!e.target.value||!e.target.validity.valid)return;const m=model(),v=e.target.value;state.inspectionOwner='price';state.selectedHistoryEvent=null;state.priceRange=null;state.selectedEvent=null;state.selectedDate=v;state.window=v<m.asOf?'history':'all';schedule();};
  $('#atlas-latest').onclick=()=>{marketData.cancel();state.inspectionOwner='price';state.marketRange=null;state.selectedHistoryEvent=null;state.priceRange=null;state.selectedEvent=null;state.marketSelectedTime=null;state.selectedDate=model().asOf;if(!CHART_SPANS.includes(state.window))state.window=DEFAULT_CHART_SPAN;schedule();};
  $('#atlas-cryptocon-view').onchange=e=>{state.cryptoView=e.target.value;scheduleAnalysis();};
  $('#atlas-reset').onclick=()=>{state.indicators=changeIndicatorState(state.indicators,{action:'reset'});publishIndicators();state.analysisMode='cycles';state.analysisOpen=false;state.inspectionOwner='price';state.lastAnalysisDetail=null;state.marketRange=null;state.selectedHistoryEvent=null;state.priceRange=null;state.atlasMode='price';state.scenario='base';state.frequency='daily';state.chartType='line';state.marketSelectedTime=null;marketData.cancel();state.scale='log';state.tool='crosshair';state.magnet='off';state.measurement=null;state.unit='usd';state.window=DEFAULT_CHART_SPAN;state.selectedDate=null;state.selectedEvent=null;state.atlasAlignment='trough';state.atlasPhase='macro';state.atlasPeriod='monthly';state.atlasMetric='returnPct';state.atlasScope='recent';for(const id of ['lab-band','lab-turns','atlas-volume','atlas-history-events'])$(`#${id}`).checked=true;for(const id of ['lab-fib','atlas-states','atlas-drawdown'])$(`#${id}`).checked=false;$('#atlas-display-options').open=false;schedule();};
  document.addEventListener('click',e=>{if(!$('#atlas-display-options').contains(e.target))$('#atlas-display-options').open=false;});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('#atlas-display-options').open=false;document.querySelector('.atlas-guide').open=false;}});
  const chartSizes=new WeakMap(),chartResize=new ResizeObserver(entries=>{let priceChanged=false,analysisChanged=false;for(const entry of entries){const r=entry.contentRect,key=`${Math.round(r.width)}x${Math.round(r.height)}`;if(key!==chartSizes.get(entry.target)){chartSizes.set(entry.target,key);if(entry.target===plot)priceChanged=true;else analysisChanged=true;}}if(priceChanged)schedule();else if(analysisChanged)scheduleAnalysis();});chartResize.observe(plot);for(const svg of analysisCharts.values())chartResize.observe(svg.parentElement);
  // Plot ResizeObserver is the single size-change scheduler; window resize would draw the same geometry twice.
  $('#structure-scope').onchange=e=>{state.scope=e.target.value;state.periodPage=0;schedule();};$('#structure-alignment').onchange=e=>{state.alignment=e.target.value;schedule();};$('#structure-threshold').onchange=e=>{state.threshold=Number(e.target.value);state.analysis=null;schedule();};
  for(const button of document.querySelectorAll('[data-structure-frequency]'))button.onclick=()=>{state.structureFrequency=button.dataset.structureFrequency;document.querySelectorAll('[data-structure-frequency]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));schedule();};
  for(const button of document.querySelectorAll('[data-structure-period]'))button.onclick=()=>{state.period=button.dataset.structurePeriod;state.periodPage=0;document.querySelectorAll('[data-structure-period]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));if(state.dataset)renderPeriods(structure());};
  $('#structure-prev').onclick=()=>{state.periodPage=Math.max(0,state.periodPage-1);renderPeriods(structure());};$('#structure-next').onclick=()=>{state.periodPage++;renderPeriods(structure());};
  $('#structure-json').onclick=()=>{if(state.dataset)download('Bitcoin_Market_Structure.json',JSON.stringify(structure(),null,2));};
  $('#legacy-comparison').addEventListener('toggle',()=>{if($('#legacy-comparison').open)window.dispatchEvent(new Event('resize'));});
  let countdownDay=kstToday(),midnightTimer;
  function refreshCountdownDay(){const today=kstToday();if(today!==countdownDay){countdownDay=today;if(state.visible&&state.dataset)schedule();}}
  function armMidnight(){clearTimeout(midnightTimer);const now=Date.now(),next=Math.floor((now+9*3600000)/86400000)*86400000+86400000-9*3600000;midnightTimer=setTimeout(()=>{refreshCountdownDay();armMidnight();},Math.max(1000,next-now+1000));}
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){refreshCountdownDay();armMidnight();}});armMidnight();
  publishIndicators();
  return {setDataset(dataset){if(state.dataset===dataset)return;if(state.selectedDate===state.dataset?.prices.at(-1)?.[0])state.selectedDate=null;state.dataset=dataset;state.base=null;state.analysis=null;state.models.clear();state.futureStates.clear();volumeProjectionCache.clear();state.volumeProjection=null;state.methodKey=null;state.eventsRenderKey=null;state.hoverReadoutKey=null;if(volumeState.series&&volumeState.series.lastDate<dataset.prices.at(-1)[0])void loadVolume({force:true});schedule();},show(value){state.visible=value;if(value)schedule();},showCompare(value){state.compareVisible=value;if(value)schedule();}};
}
