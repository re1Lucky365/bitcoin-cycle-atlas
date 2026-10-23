import { buildCycleMilestones, INTERVAL_RELATIONS, MILESTONE_TYPES } from './cycle-milestones.js?v=1.11.0-milestones.4';
import { cycleLegendMarkup, cycleMilestoneInspection, cycleIntervalInspection, cycleDurationLabel } from './cycle-milestones-view.js?v=1.11.0-milestones.4';
import { resolveCycleSelection, cycleSelectionViewport, cycleOverviewViewport } from './cycle-selection.js?v=1.11.0-milestones.4';
import { drawAtlasPriceChart as drawChart } from './atlas-price-chart.js?v=1.13.0-research.1';
import { renderCryptoConAudit } from './cryptocon-audit.js?v=1.13.0-research.1';
import { bindChartNavigation, panRange } from './chart-navigation.js?v=1.13.0-research.1';
import { renderAtlasAnalysis } from './atlas-analysis.js?v=1.13.0-research.1';
import { ANALYSIS_MODES, analysisCalendarDate, shouldPublishInspection, analysisSelectionSummary } from './analysis-dock.js?v=1.13.0-research.1';
import { INDICATORS, readIndicatorState, writeIndicatorState, changeIndicatorState, isIndicatorVisible, visibleAnalysisIds, indicatorSettings, applyIndicatorPresentation } from './indicator-state.js?v=1.13.0-research.1';
import { preparePriceViewData } from './price-view-data.js?v=1.11.0';
import { chartSelectionHandler } from './inspection-policy.js?v=1.11.0';
import { buildScenarioCountdown, koreanCalendarDate } from './scenario-countdown.js?v=1.11.0';
import { buildLongHorizonForecast, LONG_HORIZON_SCENARIOS } from './long-horizon-forecast.js?v=1.11.0';
import { longHorizonMethodMarkup } from './long-horizon-view.js?v=1.11.0';
import { CHART_INTERVALS, chartInterval, isIntradayInterval } from './ohlc-data.js?v=1.11.0';
import { drawIntradayChart } from './intraday-chart.js?v=1.13.0-research.1';
import { createMarketDataController, marketStatusText } from './market-data-controller.js?v=1.11.0';
import { parseVolumeSnapshot, aggregateWeeklyVolume } from './volume-data.js?v=1.11.0';
import { fitVolumeForecastModel, projectVolumeForecast } from './volume-forecast.js?v=1.11.0';
import { BITCOIN_EVENTS } from './bitcoin-events.js?v=1.11.0';
import { historicalEventDetail } from './research-workbench.js?v=1.13.0-research.1';
import { formatBtcVolume } from './chart-overlays.js?v=1.13.0-research.1';
import { analyzeMarketStructure, computeRollingStates, detectDirectionalChanges, STATE_LABELS } from './market-structure.js?v=1.11.0';
import { utcDay, dateFromDay } from './cycle-engine.js?v=1.11.0';
import { shiftCalendarMonths } from './cycle-timing.js?v=1.11.0';
import { chartPresetRange, DEFAULT_CHART_SPAN, CHART_SPANS } from './chart-presets.js?v=1.11.0';
import { createChartSvgExport } from './chart-export.js?v=1.13.0-research.1';
import { readWorkspaceViewport, readWorkspacePriceDomain, readWorkspaceAxisOptions, writeWorkspaceViewport, workspaceQuery } from './workspace-state.js?v=1.13.0-research.1';
import { normalizePriceDomain } from './price-axis.js?v=1.13.0-research.1';
import { clearChartHover } from './chart-hover.js?v=1.12.1-cursor-hud.1';
import { PRICE_UNITS, isStartPriceUnit, formatDisplayPrice } from './price-display.js?v=1.13.0-research.1';
import { transitionViewport } from './chart-view-policy.js?v=1.13.0-research.1';
import { createWorkspaceHistory, captureHistoryCommand, historyShortcut } from './workspace-history.js?v=1.13.0-research.1';
import { mountChartTouchTracking } from './chart-touch-tracking.js?v=1.13.0-research.1';
import { mountChartExportWorkbench } from './chart-export-workbench.js?v=1.13.0-research.1';
import { readResearchAnnotations, writeResearchAnnotations, changeResearchAnnotations } from './research-annotations.js?v=1.13.0-research.1';
import { mountResearchAnnotationsWorkbench } from './research-annotations-workbench.js?v=1.13.0-research.1';

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
  function fail(error){console.error('Detailed research workspace',error);$('#lab-error').hidden=false;$('#lab-error').textContent='분석을 계산하지 못했습니다. 원자료와 계산 결과를 확인해 주세요.';document.dispatchEvent(new CustomEvent('atlas:boot-error'));}
  state.indicators=readIndicatorState(query);
  state.atlasMode='price';state.analysisMode=state.indicators.active;state.analysisOpen=visibleAnalysisIds(state.indicators,state.frequency).length>0;state.priceController=null;state.analysisController=null;state.inspectionOwner='price';state.lastAnalysisDetail=null;state.lastPriceDetail=null;state.lastCountdownInspection=null;
  state.analysisControllers=new Map();state.analysisDetails=new Map();state.analysisRenderKeys=new Map();state.analysisDataset=null;
  state.cryptoView=valid('audit',['timing','thresholds','targets'],'timing');
  state.priceRange=null;state.marketRange=null;state.chartRange=null;state.historyCategory='all';state.selectedHistoryEvent=null;
  state.frequency=valid('granularity',CHART_INTERVALS.map(item=>item.id),'daily');
  state.chartType=valid('type',['line','candles'],'line');
  const restoredViewport=readWorkspaceViewport(query);state.unit=restoredViewport.unit;
  Object.assign(state,readWorkspaceAxisOptions(query));
  state.priceDomain=readWorkspacePriceDomain(query);
  if(isIntradayInterval(state.frequency))state.marketRange=restoredViewport.range;else state.priceRange=restoredViewport.range;
  state.restoreMarketRange=Boolean(isIntradayInterval(state.frequency)&&restoredViewport.range);
  state.marketSelectedTime=null;
  state.candleFitDone=false;
  state.cycleRelation=valid('cycle-relation',INTERVAL_RELATIONS.map(item=>item.id),'all');
  state.cycleCollapsed=query.get('cycle-panel')==='closed';state.selectedCycleItem=null;state.cycleAnnotations=null;
  state.annotations=readResearchAnnotations();
  const shown=id=>isIndicatorVisible(state.indicators,id,state.frequency);
  const effectiveScale=()=>isStartPriceUnit(state.unit)?'linear':state.scale;
  function feedback(message){document.dispatchEvent(new CustomEvent('atlas:action-feedback',{detail:{message}}));}
  function syncAnalysisInputs(){
    const inputs=id=>indicatorSettings(state.indicators,id).inputs;
    state.atlasAlignment=inputs('cycles').alignment;state.atlasPhase=inputs('duration').phase;
    state.atlasPeriod=inputs('periods').period;state.atlasMetric=inputs('periods').metric;state.atlasScope=inputs('periods').scope;state.cryptoView=inputs('cryptocon').view;
  }
  syncAnalysisInputs();
  const milestoneCache=new WeakMap();
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
  const historyKeys=['scenario','chartType','frequency','scale','invertScale','priceOnlyAuto','tool','magnet','measurement','unit','window','atlasAlignment','atlasPeriod','atlasMetric','atlasPhase','atlasScope','cryptoView','selectedDate','marketSelectedTime','priceRange','marketRange','priceDomain','indicators','annotations','cycleRelation','cycleCollapsed','selectedCycleItem','historyCategory','selectedHistoryEvent','selectedEvent','inspectionOwner','analysisMode','candleFitDone'];
  const historyRead=()=>Object.fromEntries(historyKeys.map(key=>[key,state[key]??null]));
  const historyControls=document.createElement('div');historyControls.className='workspace-history-controls';historyControls.setAttribute('role','group');historyControls.setAttribute('aria-label','차트 변경 기록');
  const historyButtons={};
  for(const [action,label,path] of [['undo','실행 취소','M9 7 4 12l5 5M4 12h9a6 6 0 0 1 6 6'],['redo','다시 실행','m15 7 5 5-5 5m5-5h-9a6 6 0 0 0-6 6']]){
    const button=document.createElement('button');button.id=`workbench-${action}`;button.type='button';button.className='workbench-icon';button.disabled=true;button.setAttribute('aria-label',label);button.title=label;button.setAttribute('aria-keyshortcuts',action==='undo'?'Control+Z Meta+Z':'Control+Shift+Z Meta+Shift+Z Control+Y');button.innerHTML=`<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="${path}"/></svg>`;button.onclick=()=>restoreHistory(action);historyControls.append(button);historyButtons[action]=button;
  }
  $('.atlas-canvas-heading').insertBefore(historyControls,$('#workbench-workspace'));
  function persistAnnotations(){const result=writeResearchAnnotations(state.annotations);if(!result.saved)feedback(result.error);}
  const workspaceHistory=createWorkspaceHistory({read:historyRead,apply:snapshot=>{
    touchTracking.cancel();chartNavigation.cancelGesture();marketData.cancel();clearChartHover($('#lab-chart'));
    Object.assign(state,snapshot);state.restoreMarketRange=isIntradayInterval(state.frequency)&&Boolean(state.marketRange);state.chartRange=null;state.hoverReadoutKey=null;state.lastCountdownInspection=null;
    syncAnalysisInputs();persistAnnotations();publishIndicators();annotationWorkbench.refresh();schedule();
  },onChange:status=>{
    for(const action of ['undo','redo']){const ready=action==='undo'?status.canUndo:status.canRedo,label=action==='undo'?'실행 취소':'다시 실행',detail=action==='undo'?status.undoLabel:status.redoLabel;historyButtons[action].disabled=!ready;historyButtons[action].title=`${label}${detail?` · ${detail}`:''}`;historyButtons[action].setAttribute('aria-label',historyButtons[action].title);}
    document.dispatchEvent(new CustomEvent('atlas:history-state',{detail:status}));
  }});
  function restoreHistory(action){touchTracking.cancel();chartNavigation.cancelGesture();marketData.cancel();if(workspaceHistory[action]())feedback(action==='undo'?'차트 변경을 취소했습니다.':'차트 변경을 다시 적용했습니다.');}
  const commandNames={'frequency':'봉 간격','chart-type':'차트 유형','scale':'가격 눈금','unit':'가격 단위','auto-scale':'가격축 자동 맞춤','invert-scale':'가격축 뒤집기','price-only-auto':'가격 자료만 자동 맞춤','go-to':'UTC 날짜·기간 이동','span':'표시 기간','fit':'기본 범위','tool':'차트 도구','magnet':'측정 자석','clear-measurement':'측정 지우기'};
  for(const type of ['atlas:chart-command','atlas:indicator-command','atlas:analysis-command','atlas:history-event','atlas:history-filter'])document.addEventListener(type,event=>{
    if(!state.dataset||['undo','redo','refresh-market'].includes(event.detail?.action))return;
    captureHistoryCommand(workspaceHistory,commandNames[event.detail?.action]||(type==='atlas:indicator-command'?'지표·분석 창 변경':'차트 선택'));
  },true);
  // These controls mutate live state directly; delegated chart commands above
  // join the same nested transaction and still produce exactly one entry.
  const directControls='#lab-scenario,#lab-unit,#lab-window,#atlas-phase,#atlas-alignment,#atlas-period,#atlas-measure,#atlas-period-scope,#atlas-cryptocon-view,#atlas-date,#atlas-cycle-relation';
  document.addEventListener('change',event=>{if(state.dataset&&(event.target.matches?.(directControls)||INDICATORS.some(item=>item.control===event.target.id)))captureHistoryCommand(workspaceHistory,'차트 설정');},true);
  document.addEventListener('click',event=>{if(state.dataset&&event.target.closest?.('#atlas-reset,#atlas-latest,#atlas-cycle-toggle,#atlas-cycle-overview,#atlas-cycle-focus,[data-lab-frequency],#lab-chart,[data-atlas-event]'))captureHistoryCommand(workspaceHistory,'차트 선택·보기');},true);
  document.addEventListener('keydown',event=>{if(!state.visible)return;const action=historyShortcut(event);if(!action)return;event.preventDefault();restoreHistory(action);},true);
  const touchHint=document.createElement('button');touchHint.type='button';touchHint.className='chart-touch-tracking-hint';touchHint.hidden=true;touchHint.textContent='값 추적 중 · 탭하여 종료';touchHint.onclick=()=>touchTracking.cancel();plot.append(touchHint);
  const touchTracking=mountChartTouchTracking({element:plot,getTool:()=>state.tool,canStart:point=>{const svg=$('#lab-chart'),box=svg.getBoundingClientRect(),view=svg.viewBox.baseVal,x=(point.clientX-box.left)/box.width*view.width,y=(point.clientY-box.top)/box.height*view.height;return Boolean(state.priceController)&&x>=Number(svg.dataset.plotLeft)&&x<=Number(svg.dataset.plotRight)&&y>=Number(svg.dataset.plotTop)&&y<=Number(svg.dataset.priceBottom);},preview:point=>state.priceController?.previewPointer?.(point),clear:()=>state.priceController?.clearPreview?.(),cancelNavigation:()=>chartNavigation.cancelGesture(),resumeNavigation:points=>chartNavigation.resumeTouchGesture(points),onChange:active=>{touchHint.hidden=!active;}});
  const annotationWorkbench=mountResearchAnnotationsWorkbench({document,getState:()=>state.annotations,getContext:()=>{
    if(!state.dataset)return {measurement:null};
    const intraday=isIntradayInterval(state.frequency),m=model(),history=historicalSeries(m.asOf),series=intraday?marketData.get(state.frequency).series:null;
    return {measurement:state.measurement,frequency:state.frequency,asOf:m.asOf,scenarioId:state.scenario,scenarioLabel:m.scenario.label,rows:base().rows,candles:intraday?series?.candles:state.chartType==='candles'?history?.bars:[],candleSource:intraday?series?.source||'Coinbase Exchange':history?.source||'Bitstamp',source:intraday?series?.source||'Coinbase Exchange':state.chartType==='candles'?'Bitstamp':'Coin Metrics',revision:intraday?series?.retrievedAt:m.asOf};
  },onCommand:command=>workspaceHistory.run('연구 측정 변경',()=>{state.annotations=changeResearchAnnotations(state.annotations,command);persistAnnotations();schedule();})});
  const annotationsButton=document.createElement('button');annotationsButton.type='button';annotationsButton.id='workbench-annotations';annotationsButton.className='workbench-icon';annotationsButton.title='저장한 연구 측정';annotationsButton.setAttribute('aria-label',annotationsButton.title);annotationsButton.setAttribute('aria-haspopup','dialog');annotationsButton.setAttribute('aria-controls','research-annotations-dialog');annotationsButton.innerHTML='<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M5 3h11l3 3v15H5zM9 8h6M9 12h6M9 16h4"/></svg>';annotationsButton.onclick=()=>annotationWorkbench.open({opener:annotationsButton});$('.workbench-tools').append(annotationsButton);
  $('#lab-chart').addEventListener('keydown',event=>{
    if(state.tool!=='crosshair')return;
    if(['Enter',' '].includes(event.key)&&!event.target.closest('[data-next-turn],[data-history-event],[data-cycle-marker],[data-cycle-interval],[data-research-annotation]')){event.preventDefault();showPriceInspection();}
  });
  const analysisCharts=new Map([...document.querySelectorAll('[data-analysis-svg]')].map(svg=>[svg.dataset.analysisSvg,svg]));
  const selectedAnalysisSvg=()=>analysisCharts.get(state.analysisMode);
  function resetChartRange({cancelGesture=true}={}){touchTracking.cancel();if(cancelGesture)chartNavigation.cancelGesture();marketData.cancel();state.priceRange=null;state.marketRange=null;state.priceDomain=null;state.window=DEFAULT_CHART_SPAN;state.selectedEvent=null;state.selectedHistoryEvent=null;document.dispatchEvent(new CustomEvent('atlas:close-detail'));schedule();}
  const chartNavigation=bindChartNavigation({element:plot,getTool:()=>state.tool,getRange:()=>state.visible&&state.atlasMode==='price'?state.chartRange:null,
    onGestureStart:label=>{touchTracking.cancelPending();workspaceHistory.begin(label||'차트 이동·확대');},onGestureEnd:()=>workspaceHistory.commit(),
    getPriceAxis:()=>state.priceController?.getPriceScale?.(),
    onPriceRangeChange:domain=>{state.priceDomain=normalizePriceDomain(domain,{scale:effectiveScale()});schedule();},
    onPriceReset:()=>{state.priceDomain=null;schedule();},
    getContext:context=>state.priceController?.getSelection?.(context)||{label:'선택한 실제 자료 또는 가정',copyText:null},
    onAnnounce:text=>{if($('#workbench-announcement'))$('#workbench-announcement').textContent=text;},
    onRangeChange:range=>{if(range.unit==='seconds'){state.marketRange={start:range.start,end:range.end};void marketData.ensureRange(state.frequency,state.marketRange);}else state.priceRange={start:range.start,end:range.end};state.chartRange={...state.chartRange,...range};state.selectedEvent=null;state.selectedHistoryEvent=null;schedule();},onReset:()=>resetChartRange({cancelGesture:false})});
  $('#workbench-navigation').append(chartNavigation.toolbar);
  document.addEventListener('atlas:modal-open',()=>{touchTracking.cancel();chartNavigation.cancelGesture();});
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
  function cycleAnnotations(m){
    if(!milestoneCache.has(m))milestoneCache.set(m,buildCycleMilestones(state.dataset,{forecast:m,asOf:m.asOf}));
    return milestoneCache.get(m);
  }
  function cycleDetail(kind,id){
    const data=state.cycleAnnotations;
    if(!data)return null;
    const item=(kind==='marker'?data.markers:data.intervals).find(item=>item.id===id);
    if(!item)return null;
    const detail=kind==='marker'?cycleMilestoneInspection(item,{asOf:data.asOf}):cycleIntervalInspection(item,{asOf:data.asOf});
    if(detail&&kind==='marker'){
      const related=data.intervals.filter(interval=>interval.fromId===id||interval.toId===id);
      detail.fields.push(...related.map(interval=>({label:interval.label,value:`${cycleDurationLabel(interval.days)} · ${interval.days}일 · ${interval.startDate} → ${interval.endDate}${interval.selectionKind==='scenario'||interval.kind!=='observed'?' · 가정 포함':''}`})));
    }
    return detail;
  }
  function activeCycleSelection(){return state.inspectionOwner==='cycle'?resolveCycleSelection(state.cycleAnnotations,state.selectedCycleItem):null;}
  function inspectCycle(kind,id,{user=true,openPanel=true}={}){
    const detail=cycleDetail(kind,id);if(!detail)return;
    if(user){state.selectedCycleItem={kind,id};state.selectedEvent=null;state.selectedHistoryEvent=null;$('#atlas-cycle-options').open=false;}
    inspect(detail,{owner:'cycle',user,openPanel});
    if(user)schedule();
  }
  function renderCycleControls(data){
    const panel=$('#atlas-cycle-panel');
    panel.hidden=!shown('cycle-intervals')||isIntradayInterval(state.frequency);
    const toggle=$('#atlas-cycle-toggle');
    toggle.setAttribute('aria-pressed',String(!state.cycleCollapsed));toggle.textContent=state.cycleCollapsed?'기간선 보이기':'기간선 숨기기';
    $('#atlas-cycle-relation').value=state.cycleRelation;
    if(panel.hidden){state.cycleVisibleIntervals=0;return;}
    const selection=activeCycleSelection(),summary=$('#atlas-cycle-selection');
    summary.hidden=!selection;
    if(selection){
      const item=selection.interval||selection.marker;
      $('#atlas-cycle-selection-summary').textContent=selection.interval?`${item.label} · ${cycleDurationLabel(item.days)} (${item.days}일) · ${item.startDate} → ${item.endDate}`:`${item.label} · ${item.date} UTC · 연결 기간 ${selection.intervals.length}개`;
      $('#atlas-cycle-focus').hidden=!selection.interval;
    }
    state.cycleVisibleIntervals=Number($('#lab-chart').dataset.cycleIntervalCount||0);
    const note=`기간선은 가격 그래프 하단의 고정된 관계별 행에 표시됩니다. 확대·이동해도 위로 올라가지 않으며, 날짜축에 맞춰 가로 길이만 바뀝니다. 좁은 구간의 전체 이름·날짜는 선택해서 확인할 수 있습니다. 기간은 종료 UTC 날짜 − 시작 UTC 날짜이며, 화면 밖으로 이어지는 구간도 전체 기간을 표시합니다. 색 원·기간선의 실선은 사후 기준, 점선은 잠정 또는 가정입니다. ${data.futureStatus?.reason||''}`;
    $('#atlas-cycle-note').textContent=note;
    const ref=data.sourceReference;
    $('#atlas-cycle-reference').innerHTML=`<p><strong>${esc(ref.title)}</strong> · ${esc(ref.author)} · 2024.08.06 · ${esc(ref.instrument)}</p><p>${esc(ref.note)} 아래는 원본에 적힌 주 수이며, 위 차트의 계산값과 구분합니다.</p><div class="cycle-reference-table"><table><thead><tr><th scope="col">원본 관계 · 주</th>${ref.cycles.map(label=>`<th scope="col">${esc(label)}</th>`).join('')}</tr></thead><tbody>${INTERVAL_RELATIONS.map(item=>`<tr><th scope="row">${esc(item.label)}</th>${ref.periodClaims[item.id].map(value=>`<td>${esc(value)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p><strong>선정 기준</strong><br>${Object.entries(data.methodology).filter(([key])=>!['general','duration','future'].includes(key)).map(([key,value])=>`${esc(key.toUpperCase())}: ${esc(value)}`).join('<br>')}</p><p>모형에 기준점이 없는 장기 구간에는 날짜나 고점을 만들어 넣지 않습니다. 구간 막대나 원을 선택하면 정확한 날짜와 기준을 확인할 수 있습니다.</p>`;
  }
  // HUDs stay in the allocated viewport. They are placement obstacles, never
  // reasons to shrink or move the price/date axes.
  function cycleHudObstacles(){
    const box=$('#lab-chart').getBoundingClientRect();
    return [...plot.querySelectorAll('.atlas-readout,.workbench-market-info,#chart-indicator-manager,#scenario-countdown,.lab-chart-foot')].filter(node=>!node.hidden).map(node=>{
      const rect=node.getBoundingClientRect();
      return {x:rect.left-box.left-5,y:rect.top-box.top-5,width:rect.width+10,height:rect.height+10};
    }).filter(rect=>rect.width>10&&rect.height>10);
  }
  // Readout text may resize while the pointer moves. Repack only the period
  // annotations; rebuilding the price chart here would reset its live cursor.
  function refreshCycleHudPlacement(){
    if(!isIntradayInterval(state.frequency)&&shown('cycle-intervals')&&!state.cycleCollapsed){state.priceController?.updateCycleOverlayObstacles?.(cycleHudObstacles());applyIndicatorPresentation($('#lab-chart'),state.indicators,state.frequency);}
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
    state.cycleCollapsed?p.set('cycle-panel','closed'):p.delete('cycle-panel');
    state.cycleRelation==='all'?p.delete('cycle-relation'):p.set('cycle-relation',state.cycleRelation);
    writeWorkspaceViewport(p,{frequency:state.frequency,unit:state.unit,range:isIntradayInterval(state.frequency)?state.marketRange:state.priceRange,priceDomain:state.priceDomain,invertScale:state.invertScale,priceOnlyAuto:state.priceOnlyAuto});
    if(p.get('page')==='compare'&&!p.has('legacy'))p.delete('page');
    try{history.replaceState(null,'',`${location.pathname}${p.size?'?'+p:''}`);}catch{}
  }
  function inspect(detail,options={}){
    if(!detail)return;
    const owner=options.owner||'price',user=options.user===true;
    if(owner==='price')state.lastPriceDetail=detail;
    if(!shouldPublishInspection({owner,currentOwner:state.inspectionOwner,user}))return;
    if(user){
      state.inspectionOwner=owner;
      if(owner!=='cycle'&&state.selectedCycleItem){state.selectedCycleItem=null;schedule();}
    }
    if(user&&owner==='price'&&detail.kind!=='history'){state.selectedEvent=null;state.selectedHistoryEvent=null;}
    queueMicrotask(updateNavigation);
    const labels={observed:'관측',simulated:'가정',assumption:'가정',distribution:'모의 요약',history:'역사 사건'};
    $('#atlas-inspector-kind').textContent=labels[detail.kind]||'실제 관측';$('#atlas-inspector-kind').dataset.kind=detail.kind;
    $('#atlas-inspector-title').textContent=detail.label;
    $('#atlas-inspector-values').innerHTML=(detail.fields||[]).map(f=>`<div><span>${esc(f.label)}</span><strong>${esc(f.value)}</strong></div>`).join('');
    $('#atlas-inspector-note').textContent=detail.note||'';
    if(detail.date&&owner==='price'&&detail.kind!=='history'){
      // Render-time fallbacks describe the visible data, not a new user choice.
      // Keep an explicit UTC selection even when the next interval is empty or bounded.
      if(user){if(isIntradayInterval(state.frequency))state.marketSelectedTime=detail.date;else state.selectedDate=detail.date;}
      if(!isIntradayInterval(state.frequency))$('#atlas-date').value=state.selectedDate||detail.date;
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
    state.analysisOpen=visibleAnalysisIds(state.indicators,state.frequency).length>0;
    for(const item of INDICATORS)if(item.control){const input=$(`#${item.control}`);if(input)input.checked=shown(item.id);}
    document.dispatchEvent(new CustomEvent('atlas:indicator-state',{detail:{indicators:state.indicators,frequency:state.frequency,cycleCalibration:state.models.get(state.scenario)?.cycleCalibration?.current}}));
  }
  function activateAnalysis(mode){
    if(!visibleAnalysisIds(state.indicators,state.frequency).includes(mode))return;
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
    const visible=visibleAnalysisIds(state.indicators,state.frequency);
    for(const mode of visible){
      if(state.indicators.minimized.includes(mode))continue;
      const settings=mode==='cycles'?[state.atlasAlignment]:mode==='duration'?[state.atlasPhase]:mode==='periods'?[state.atlasPeriod,state.atlasMetric,state.atlasScope]:mode==='cryptocon'?[state.cryptoView]:[];
      const svg=analysisCharts.get(mode),key=[Math.round(svg.clientWidth),Math.round(svg.clientHeight),...settings,JSON.stringify(indicatorSettings(state.indicators,mode))].join('/');
      if(state.analysisRenderKeys.get(mode)===key){applyIndicatorPresentation(svg,state.indicators,state.frequency);continue;}
      const onInspect=(detail,options)=>inspectAnalysis(mode,detail,options);
      const controller=mode==='cryptocon'?renderCryptoConAudit({svg,dataset:state.dataset,view:state.cryptoView,onInspect,presentation:svg=>applyIndicatorPresentation(svg,state.indicators,state.frequency)}):renderAtlasAnalysis({svg,dataset:state.dataset,mode:mode==='duration'&&state.atlasPhase!=='macro'?'phases':mode,phaseLeg:state.atlasPhase==='bear'?'bear':'bull',alignment:state.atlasAlignment,period:state.atlasPeriod,metric:state.atlasMetric,scope:state.atlasScope,onInspect,presentation:svg=>applyIndicatorPresentation(svg,state.indicators,state.frequency)});
      state.analysisControllers.set(mode,controller);state.analysisRenderKeys.set(mode,key);
      const detail=state.analysisDetails.get(mode);publishAnalysisState({mode,controller,detail,calendarDate:analysisDate(detail)});
    }
    state.analysisController=visible.includes(state.analysisMode)?state.analysisControllers.get(state.analysisMode)||null:null;
    state.lastAnalysisDetail=state.analysisDetails.get(state.analysisMode)||null;
  }
  function showPriceInspection(){const hadCycle=Boolean(state.selectedCycleItem);state.selectedCycleItem=null;state.inspectionOwner='price';if(state.lastPriceDetail)inspect(state.lastPriceDetail,{openPanel:false});updateNavigation();if(hadCycle)schedule();}
  function useAnalysisNavigation(direction){
    if(!state.analysisOpen||!state.analysisController)return;
    state.analysisController[direction]?.();
    publishAnalysisState({controller:state.analysisController});updateNavigation();
  }
  function exportOptions(svg){
    const primary=svg===$('#lab-chart'),intraday=isIntradayInterval(state.frequency);
    const scenario=LONG_HORIZON_SCENARIOS.find(item=>item.id===state.scenario)?.label||state.scenario;
    const anchor=intraday?marketData.get(state.frequency).series?.candles.at(-1):base().rows.at(-1);
    const anchorDate=intraday?anchor?.date.slice(0,16).replace('T',' '):anchor?.date;
    const display=state.priceController?.getPriceScale?.()?.display;
    const unit=state.unit==='usd'?'USD':`${display?.label||state.unit} · 기준 ${display?.baseDate||anchorDate||'없음'} UTC · 원 USD ${display?.basePrice??'—'}`;
    const axis=`${effectiveScale()==='linear'?'선형':'로그'}${state.invertScale?' · 반전':''} · 가격축 ${state.priceDomain?'수동':'자동'}${state.priceOnlyAuto?' · 가격 자료만':''}`;
    return {legend:primary&&!intraday&&(shown('cycle-landmarks')||(shown('cycle-intervals')&&!state.cycleCollapsed))?MILESTONE_TYPES:[],title:primary?`BTCUSD · ${chartInterval(state.frequency).label} · ${state.chartType==='candles'?'캔들':'가격선'} · ${unit} · ${axis} · UTC${intraday?'':` · ${scenario} 가정`}`:'Bitcoin Cycles · 분석',readout:primary?($('#lab-metrics').innerText||$('#lab-metrics').textContent).replace(/\s+/gu,' ').trim():state.lastAnalysisDetail?.label||'',source:primary?$('#workbench-market-status')?.textContent||'':state.lastAnalysisDetail?.note||'',note:primary?(intraday?'완료된 실제 거래소 봉 · 이 거래소 현물쌍의 BTC 거래량 · 빈 구간은 채우지 않습니다.':'가격 실선·캔들: 실제 관측 · 가격 점선·음영: 조건부 시나리오, 확률구간 아님 · 색 원·기간선: 사후 기준점, 점선: 잠정·가정 · 기간: 종료 UTC 날짜 − 시작 UTC 날짜 · Coin Metrics / Bitstamp'): '출처와 가정은 사이트의 분석 근거를 확인하세요.',countdown:primary&&!intraday&&!$('#scenario-countdown')?.hidden?[...$('#scenario-countdown').children].map(node=>node.innerText||node.textContent).join(' · '):''};
  }
  function saveSvg(svg,name){download(name,createChartSvgExport(svg,exportOptions(svg)),'image/svg+xml;charset=utf-8');}
  const exportWorkbench=mountChartExportWorkbench({document,getContext:()=>{
    const m=model(),intraday=isIntradayInterval(state.frequency),history=historicalSeries(m.asOf),visible=visibleAnalysisIds(state.indicators,state.frequency);
    const order=[...state.indicators.paneOrder,...INDICATORS.filter(item=>item.analysis&&!state.indicators.paneOrder.includes(item.id)).map(item=>item.id)];
    const panels=order.map(id=>({svg:analysisCharts.get(id),title:INDICATORS.find(item=>item.id===id)?.label||id,readout:state.analysisDetails.get(id)?.label||'',note:state.analysisDetails.get(id)?.note||'가격 날짜축과 독립된 연구 축',hidden:!visible.includes(id),minimized:state.indicators.minimized.includes(id)}));
    return {svg:$('#lab-chart'),panels,imageOptions:exportOptions($('#lab-chart')),display:state.priceController?.getPriceScale?.()?.display,frequency:state.frequency,chartType:state.chartType,unit:state.unit,range:state.chartRange,asOf:intraday?marketData.get(state.frequency).series?.lastDate:m.asOf,rows:base().rows,observedCandles:history?.bars||[],candleSource:history?.source||'Bitstamp',intradaySeries:intraday?marketData.get(state.frequency).series:null,forecast:{path:m.path,scenarioId:state.scenario,scenarioLabel:m.scenario.label},researchSeries:visible.filter(id=>!state.indicators.minimized.includes(id)).map(id=>state.analysisControllers.get(id)?.exportData?.()).filter(Boolean)};
  },onDownload:download,onFeedback:feedback});
  function savePng(){if(state.priceController)exportWorkbench.open({format:'png',scope:'main',opener:document.activeElement});}
  function renderHover(detail){
    if(!detail||state.atlasMode!=='price')return;
    document.dispatchEvent(new CustomEvent('atlas:readout',{detail:{...detail,frequency:state.frequency,unit:state.unit}}));
    const key=[state.frequency,state.unit,shown('volume'),detail.date,detail.price,detail.displayedPrice,detail.changePct,detail.kind,detail.open,detail.high,detail.low,detail.close,detail.volume,detail.volumeKind,detail.volumeLower,detail.volumeUpper,detail.volumeSource,detail.source].join('/');
    if(state.hoverReadoutKey===key)return;state.hoverReadoutKey=key;
    const future=detail.kind==='simulated',label=detail.kind==='unavailable'?'자료 없음':future?'가정':'관측',intraday=isIntradayInterval(state.frequency),ohlc=Number.isFinite(detail.open);
    const display=detail.display||state.priceController?.getPriceScale?.()?.display;
    const displayPrice=state.unit==='usd'?usd(detail.price,intraday||detail.price<10?2:0):Number.isFinite(detail.displayedPrice)?`${nf(detail.displayedPrice,2)}${state.unit==='percent'?'%':''}`:formatDisplayPrice(detail.price,display,2),change=Number.isFinite(detail.changePct)?pct(detail.changePct):'—';
    $('#lab-metrics').dataset.kind=detail.kind;
    const shownDate=intraday?detail.date.slice(0,16).replace('T',' '):dateLabel(detail.date),values=ohlc?`<span class="readout-ohlc"><span>O <b>${usd(detail.open,2)}</b></span><span>H <b>${usd(detail.high,2)}</b></span><span>L <b>${usd(detail.low,2)}</b></span><span>C <b>${usd(detail.close,2)}</b></span></span>`:'';
    const projectedVolume=detail.volumeKind==='scenario',volumeUnit=projectedVolume?`BTC/${state.frequency==='weekly'?'주':'일'}`:'BTC';
    const changeBasis=Number.isFinite(detail.previousClose)?'직전 봉 종가 대비':'직전 봉 자료 없음';
    const fromOpen=Number.isFinite(detail.fromOpenChangePct)?` · 시가 대비 ${pct(detail.fromOpenChangePct)}`:'';
    const displayBasis=state.unit==='usd'?'':` · ${display?.label||state.unit} · 기준 ${display?.baseDate||'없음'} UTC · 원 USD ${display?.basePrice??'—'}`;
    $('#lab-metrics').innerHTML=`<span class="readout-main"><span class="atlas-symbol">${chartInterval(state.frequency).label}<span class="readout-kind">${label}</span></span><strong>${displayPrice}</strong><span class="atlas-day-change ${tone(detail.changePct)}" title="${changeBasis}" aria-label="${changeBasis} ${change}">전봉 ${change}</span><span class="atlas-observation-date">${shownDate} UTC</span></span><span class="readout-detail">${values}</span>`;
    $('#lab-metrics').title=detail.kind==='unavailable'?`${detail.source||'거래소'} · ${shownDate} UTC · 이 구간에 확인된 완료 봉이 없습니다.`:ohlc?`${detail.source} BTC-USD · ${shownDate} UTC · O ${usd(detail.open,2)} H ${usd(detail.high,2)} L ${usd(detail.low,2)} C ${usd(detail.close,2)} · ${changeBasis} ${change}${fromOpen} · ${nf(detail.volume,6)} BTC`:`${label} · ${shownDate} UTC · ${future?'조건부 예시 가격':'Coin Metrics 일말 가격'} ${usd(detail.price)} · ${changeBasis} ${change}${detail.volumeSource?` · ${detail.volumeSource} ${projectedVolume?'가정 평균 거래량':'거래량'} ${nf(detail.volume,6)} ${volumeUnit}`:''}`;
    $('#lab-metrics').title+=displayBasis;
  }
  function renderReadout(m,b,next){
    $('#lab-asof').textContent=`실제 자료 ${dateLabel(m.asOf)}까지 · UTC`;
    $('#atlas-reference').textContent=`계산 기준 ${dateLabel(m.referenceDate)}`;
    $('#sidebar-reference').textContent=`계산 기준 · ${dateLabel(m.referenceDate)}`;
  }
  function drawOutlook(){
    if(!state.dataset||!state.visible)return;
    try{
      const focusId=document.activeElement?.id,focusEventId=document.activeElement?.dataset?.atlasEvent,focusCycleMarker=document.activeElement?.dataset?.cycleMarker,focusCycleInterval=document.activeElement?.dataset?.cycleInterval,focusResearchAnnotation=document.activeElement?.dataset?.researchAnnotation;
      const m=model(),b=base(),next=nextTurnInfo(m),intraday=isIntradayInterval(state.frequency);
      publishIndicators();
      plot.dataset.mode='price';plot.dataset.intraday=String(intraday);plot.dataset.cyclePeriodsVisible=String(!intraday&&shown('cycle-intervals')&&!state.cycleCollapsed);$('#lab-metrics').hidden=!shown('readout');
      $('#lab-chart').removeAttribute('hidden');$('#lab-tooltip').hidden=true;
      $('#atlas-price-controls').hidden=false;
      $('[data-lab-frequency]').closest('fieldset').hidden=false;
      for(const id of ['lab-unit','lab-band','lab-turns','lab-milestones','lab-cycle-intervals','lab-fib','atlas-drawdown','atlas-states'])$(`#${id}`).closest('label').hidden=intraday&&id!=='lab-unit';
      $('#lab-json').hidden=false;
      $('#atlas-cryptocon-view').value=state.cryptoView;
      $('#atlas-event-rail').hidden=intraday;
      $('#atlas-cycle-panel').hidden=intraday||!shown('cycle-intervals');
      $('#lab-scenario').value=state.scenario;$('#lab-window').value=state.window;$('#lab-unit').value=state.unit;
      $('#atlas-phase').value=state.atlasPhase;$('#atlas-alignment').value=state.atlasAlignment;$('#atlas-period').value=state.atlasPeriod;$('#atlas-measure').value=state.atlasMetric;$('#atlas-period-scope').value=state.atlasScope;
      document.querySelectorAll('[data-lab-frequency]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.labFrequency===state.frequency)));
      renderReadout(m,b,next);
      if(volumeState.status==='idle')void loadVolume();
      const history=historicalSeries(m.asOf);
      const needsMarket=intraday;
      if(needsMarket&&marketData.get(state.frequency).status==='idle')void marketData.load(state.frequency);
      let market=needsMarket?marketData.get(state.frequency):null;
      state.volumeProjection=intraday?null:forecastVolume(m);
      if(intraday){
        state.chartRange=null;
        if(market.series){
          // Navigation has a real historical domain independent of the cached
          // snapshot. Expanding or panning requests the newly visible windows.
          const previousRange=state.marketRange;
          state.chartRange=panRange({...marketData.range(state.frequency,previousRange),allowEmpty:true},0);
          if(previousRange)state.marketRange={start:state.chartRange.start,end:state.chartRange.end};
          if(previousRange&&state.restoreMarketRange){
            state.restoreMarketRange=false;void marketData.ensureRange(state.frequency,state.marketRange);market=marketData.get(state.frequency);
          }
          state.priceController=drawIntradayChart({range:state.chartRange,tool:state.tool,magnet:state.magnet,measurement:state.measurement,researchAnnotations:state.annotations.items,activeAnnotationId:state.annotations.selectedId,scenarioId:state.scenario,onAnnotation:id=>annotationWorkbench.open({id,opener:$('#lab-chart')}),onMeasurement:value=>workspaceHistory.run('두 점 측정',()=>{state.measurement=value;if(value)state.marketSelectedTime=value.endDate||value.startDate;schedule();}),historyStatus:market.historyStatus,showVolume:$('#atlas-volume').checked,headerInset:18,svg:$('#lab-chart'),series:market.series,chartType:state.chartType,scale:state.scale,invertScale:state.invertScale,priceOnlyAuto:state.priceOnlyAuto,priceDomain:state.priceDomain,unit:state.unit,onHover:renderHover,onInspect:inspectPriceSelection,selectedTime:state.marketSelectedTime});
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
        state.chartRange=panRange({start,end:chartEnd,min:b.rows[0].date,max:end,allowEmpty:true,contextKey:`daily:${state.frequency}:${state.scenario}:${state.chartType}:${m.asOf}`},0);
        start=state.chartRange.start;chartEnd=state.chartRange.end;
        if(state.priceRange)state.priceRange={start,end:chartEnd};
        if($('#atlas-states').checked&&!state.futureStates.has(state.scenario))state.futureStates.set(state.scenario,computeRollingStates({prices:[...state.dataset.prices,...future.map(p=>[p.date,p.price])]}).points);
                if(state.selectedEvent?.startsWith('macro-')&&!m.events[Number(state.selectedEvent.split('-')[1])]?.inHorizon)state.selectedEvent=null;
        const activeMarker=['low','high'].includes(state.selectedEvent)?turnInfo(m,state.selectedEvent):next;
        const observedCandles=history?.bars||[];
        const milestones=cycleAnnotations(m);state.cycleAnnotations=milestones;
        const cycleSelection=activeCycleSelection();
        if(state.inspectionOwner==='cycle'&&state.selectedCycleItem&&!cycleSelection){
          state.selectedCycleItem=null;
          inspect({label:'이 가정에는 선택한 사이클 지점이 없습니다',kind:'assumption',fields:[],note:'가정을 바꾸면 예시 경로와 주요 지점이 다시 계산됩니다. 현재 차트에서 지점이나 기간을 선택하세요.'},{owner:'cycle'});
        }
        const cycleObstacles=cycleHudObstacles();
        state.priceController=drawChart({svg:$('#lab-chart'),tooltip:$('#lab-tooltip'),rows:allRows,start,end:chartEnd,split:m.asOf,frequency:state.frequency,chartType:state.chartType,observedCandles,candleSource:history?.source||'Bitstamp',volumeBars:history?.bars||[],volumeProjection:state.volumeProjection,volumeSource:history?.source||'Bitstamp',showVolume:$('#atlas-volume').checked,historicalEvents:BITCOIN_EVENTS.filter(event=>state.historyCategory==='all'||event.category===state.historyCategory),showHistoricalEvents:$('#atlas-history-events').checked,activeHistoricalEventId:state.selectedHistoryEvent,onHistoricalEvent:id=>focusHistoricalEvent(id,false),scale:state.scale,invertScale:state.invertScale,priceOnlyAuto:state.priceOnlyAuto,priceDomain:state.priceDomain,tool:state.tool,magnet:state.magnet,measurement:state.measurement,researchAnnotations:state.annotations.items,activeAnnotationId:state.annotations.selectedId,scenarioId:state.scenario,onAnnotation:id=>annotationWorkbench.open({id,opener:$('#lab-chart')}),onMeasurement:value=>workspaceHistory.run('두 점 측정',()=>{state.measurement=value;if(value)state.selectedDate=value.endDate||value.startDate;schedule();}),onHover:renderHover,unit:state.unit,denominator:last.price,headerInset:18,cycleCalibration:m.cycleCalibration,showCycleTiming:shown('cycle-timing'),band:$('#lab-band').checked,turns:prepared.turns,showTurns:$('#lab-turns').checked,cycleMarkers:milestones.markers,showCycleMarkers:shown('cycle-landmarks'),activeCycleMarkerId:cycleSelection?.marker?.id,activeCycleMarkerIds:cycleSelection?.markerIds||[],activeCycleInterval:cycleSelection?.interval,onCycleMarker:id=>inspectCycle('marker',id),cycleIntervals:milestones.intervals,showCycleIntervals:shown('cycle-intervals')&&!state.cycleCollapsed,cycleRelation:state.cycleRelation,cycleOverlayObstacles:cycleObstacles,onCycleInterval:id=>inspectCycle('interval',id),events:prepared.events,states:state.futureStates.get(state.scenario),fib:$('#lab-fib').checked?currentFib():[],nextTurn:$('#lab-turns').checked?activeMarker:null,showNextTurnLabel:!shown('countdown'),onNextTurn:()=>focusEvent(activeMarker.type),showDrawdown:$('#atlas-drawdown').checked,showStates:$('#atlas-states').checked,onInspect:inspectPriceSelection,selectedDate:state.selectedDate||m.asOf});
        $('#atlas-date').min=b.rows[0].date;$('#atlas-date').max=end;
        $('#lab-chart-title').textContent=`${dateLabel(start)} — ${dateLabel(chartEnd)} · ${state.frequency==='daily'?'일별':'주별'} 가격`;
        $('#atlas-chart-legend').innerHTML='<div class="price-legend">'+(`<span><i class="${state.chartType==='candles'&&observedCandles.length?'legend-candle':'legend-observed'}"></i>실제 가격</span><span><i class="legend-simulated"></i>미래 가정</span>`+($('#lab-band').checked?'<span><i class="legend-band"></i>가정 범위</span>':'')+($('#lab-turns').checked?'<span><i class="legend-turn"></i>고점·저점</span>':''))+ '</div>'+((shown('cycle-landmarks')||(shown('cycle-intervals')&&!state.cycleCollapsed))?cycleLegendMarkup():'');
        renderCycleControls(milestones);
        // One follow-up layout after a HUD wraps keeps the period labels clear
        // without reserving vertical chart space or altering the price scale.
        if(JSON.stringify(cycleHudObstacles())!==JSON.stringify(cycleObstacles))refreshCycleHudPlacement();
        $('#atlas-chart-caveat').textContent='조건부 가정';
        const candleNote=state.chartType==='candles'?` ${observedCandles.length?`Bitstamp BTC/USD 캔들 ${observedCandles[0].date}–${observedCandles.at(-1).date} · 실제 OHLC. 이전 가격선과 미래 연결 기준은 Coin Metrics입니다.`:'실제 캔들을 기다리는 동안 Coin Metrics 일말 가격선을 표시합니다.'}`:'';
        $('#atlas-chart-note').textContent=`${m.scenario.label} · ${end.slice(0,4)}년까지. 금색 가격 점선과 음영은 출처·가정에 따른 시나리오이며 확률 예측구간이 아닙니다. 색 원·기간선의 점선은 잠정 기준 또는 가정을 뜻합니다.${candleNote}`;
        $('#atlas-inspect-prev').textContent='←';$('#atlas-inspect-next').textContent='→';
        $('#atlas-inspect-prev').setAttribute('aria-label','이전 고점·저점');$('#atlas-inspect-next').setAttribute('aria-label','다음 고점·저점');
        renderEventRail(m);
        if(state.selectedEvent){inspectEvent(m,state.selectedEvent);}
        if(state.selectedHistoryEvent){const event=BITCOIN_EVENTS.find(event=>event.id===state.selectedHistoryEvent);if(event)inspect(historicalEventDetail(event),{openPanel:false});}
      }
      applyIndicatorPresentation($('#lab-chart'),state.indicators,state.frequency);
      annotationWorkbench.refresh();
      const display=state.priceController?.getPriceScale?.()?.display;
      $('#atlas-axis-note').textContent=`${display?.label||'USD'} · ${effectiveScale()==='linear'?'선형':'로그'}${state.invertScale?' · 반전':''}`;
      drawAnalysisIndicators();
      // A docking resize emits fresh price/analysis inspections. The explicitly
      // selected countdown keeps its own owner; only model/day changes refresh it.
      if(state.inspectionOwner==='countdown')publishCountdownInspection(m);
      if(state.inspectionOwner==='analysis'&&state.lastAnalysisDetail)inspect(state.lastAnalysisDetail,{owner:'analysis'});
      if(state.inspectionOwner==='cycle'&&state.selectedCycleItem){const item=state.selectedCycleItem;if(cycleDetail(item.kind,item.id))inspectCycle(item.kind,item.id,{user:false,openPanel:false});else inspect({label:'이 가정에는 선택한 사이클 지점이 없습니다',kind:'assumption',fields:[],note:'가정을 바꾸면 예시 경로와 주요 지점이 다시 계산됩니다. 현재 차트에서 지점이나 기간을 선택하세요.'},{owner:'cycle'});}
      const eventKey=`${m.asOf}/${state.scenario}/${state.eventMode}/${state.eventPage}`;if(eventKey!==state.eventsRenderKey){renderEvents(m);state.eventsRenderKey=eventKey;}const methodKey=`${m.asOf}/${m.scenario.id||state.scenario}`;if(methodKey!==state.methodKey){renderForecastMethod(m);state.methodKey=methodKey;}
      $('#lab-error').hidden=true;updateNavigation();chartNavigation.update();syncAtlasUrl();
      const historyLabels=$('#lab-chart').dataset;
      const shareQuery=state.chartRange?workspaceQuery(new URLSearchParams(location.search),{frequency:state.frequency,unit:state.unit,range:state.chartRange,priceDomain:state.priceDomain}):undefined;
      document.dispatchEvent(new CustomEvent('atlas:workbench-state',{detail:{shareQuery,unit:state.unit,display:state.priceController?.getPriceScale?.()?.display,invertScale:state.invertScale,priceOnlyAuto:state.priceOnlyAuto,history:workspaceHistory.status(),mode:'price',analysisMode:state.analysisMode,analysisOpen:state.analysisOpen,countdown:countdownFor(m),inspectionOwner:state.inspectionOwner,selectedDate:state.selectedDate,selectedTime:state.marketSelectedTime,historicalEventsVisible:$('#atlas-history-events').checked&&!intraday,historicalLabelMeta:{mode:historyLabels.historyLabelMode,labels:Number(historyLabels.historyLabelCount||0),total:Number(historyLabels.historyEventCount||0),hidden:Number(historyLabels.historyHiddenLabelCount||0)},cycleMilestones:intraday?null:{visibleMarkers:Number($('#lab-chart').dataset.cycleMarkerCount||0),visibleIntervals:state.cycleVisibleIntervals||0},scenario:state.scenario,frequency:state.frequency,chartType:state.chartType,intraday,asOf:m.asOf,intervalLabel:chartInterval(state.frequency).label,marketSeries:market?.series,volumeMeta:volumeMetadata(),volumeForecast:state.volumeProjection?{status:state.volumeProjection.status,reason:state.volumeProjection.reason,summary:state.volumeProjection.summary,annual:state.volumeProjection.annual,diagnostics:state.volumeProjection.diagnostics}:null,volumeError:volumeState.error,marketStatus:intraday?marketStatusText(market):volumeState.series?`${state.chartType==='candles'?'캔들·거래량':'거래량'} · Bitstamp BTC/USD · ${volumeState.series.retrievedAt.slice(0,16).replace('T',' ')} UTC 수집${state.chartType==='line'?' · 가격선 Coin Metrics':''}`:volumeState.error?'거래량 조회 실패 · 가격선은 이용 가능':'거래량 자료 불러오는 중',marketHistoryStatus:market?.historyStatus,marketError:market?.historyError||market?.error,loadedStart:intraday?market?.series?.firstDate:b.rows[0].date,loadedEnd:intraday?market?.series?.lastDate:m.asOf,marketLoading:intraday?(market?.status==='loading'||market?.historyStatus==='loading'):volumeState.status==='loading',navigationAvailable:Boolean(state.chartRange),priceAxisMode:state.priceDomain?'manual':'auto',scale:state.scale,tool:state.tool,magnet:state.magnet,measurement:state.measurement,window:state.window,customRange:Boolean(intraday?state.marketRange:state.priceRange),start:state.chartRange?.start,end:state.chartRange?.end,next}}));
      if(state.openEventPanel){state.openEventPanel=false;const chart=$('#lab-chart');chart.focus({preventScroll:true});document.dispatchEvent(new CustomEvent('atlas:open-detail',{detail:{kind:'selection',focus:false,opener:chart}}));}
      if(focusCycleMarker)document.querySelector(`[data-cycle-marker="${CSS.escape(focusCycleMarker)}"]`)?.focus({preventScroll:true});else if(focusCycleInterval)document.querySelector(`[data-cycle-interval="${CSS.escape(focusCycleInterval)}"]`)?.focus({preventScroll:true});else if(focusResearchAnnotation)document.querySelector(`[data-research-annotation="${CSS.escape(focusResearchAnnotation)}"]`)?.focus({preventScroll:true});else if(focusId)document.getElementById(focusId)?.focus({preventScroll:true});else if(focusEventId)document.querySelector(`[data-atlas-event="${focusEventId}"]`)?.focus({preventScroll:true});
      // A loading message is not a rendered price chart on a direct intraday visit.
      const visibleMarket=market?.series?.candles.some(row=>row.time>=state.chartRange?.start&&row.time<=state.chartRange?.end);
      if(!intraday||(market?.series&&(visibleMarket||market.historyStatus!=='loading'&&market.historyStatus!=='error')))document.dispatchEvent(new CustomEvent('atlas:page-ready',{detail:{page:'outlook'}}));
      else if(market?.status==='error'||market?.historyStatus==='error')document.dispatchEvent(new CustomEvent('atlas:boot-error'));
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
  document.addEventListener('atlas:history-filter',event=>{state.historyCategory=event.detail.category;state.indicators=changeIndicatorState(state.indicators,{action:'add',id:'history'});if(!shown('history'))state.indicators=changeIndicatorState(state.indicators,{action:'visibility',id:'history'});publishIndicators();schedule();});
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
      document.dispatchEvent(new CustomEvent('atlas:page-ready',{detail:{page:'compare'}}));
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
    $('#structure-method').innerHTML=`<h3>서로 다른 네 가지 시간</h3><p>① 고정 달력 4년 ② 사후 저점→고점→다음 저점 ③ 당시에 알 수 있었던 국면의 길이 ④ 고저점 발생 후 확인까지의 지연을 따로 계산합니다. 첫 자료는 2010-07-18이며, 2010년 전체나 2009년은 관측하지 않았습니다.</p><div class="lab-formula">r(t) = log[P(t)/P(t−1)]<br>DD(t) = P(t)/max P(s≤t) − 1<br>MDD[a,b] = min(P(t)/max{기간 내 P(s≤t), 연속된 전일 종가} − 1)<br>RV = sd(r) × √365<br>β̂ = median{(기간ⱼ−기간ᵢ)/(사이클ⱼ−사이클ᵢ)}</div><p>월·분기 MDD는 새 기간 첫 관측의 바로 전날 종가가 있을 때만 그 값을 시작 고점에 포함합니다. 경계 종가가 누락되면 기간 수익률을 계산하지 않고, MDD는 기간 안의 관측만 사용합니다. 변동성은 연속된 일별 로그수익률의 연율화입니다. 일말 가격으로 계산한 지표이므로 실제 장중 최대 낙폭보다 작을 수 있습니다. 주봉의 고가·저가는 일말 가격의 최댓값·최솟값입니다.</p><h3>날짜를 바꾸는 가격 제공자 차이</h3><p>2022년 11월 Coin Metrics의 최저 일말 가격은 11월 9일이고 Coinbase의 최저 종가는 11월 21일입니다. Coin Metrics에서 두 날짜 가격 차이는 약 0.125%입니다. 2021년 최고 종가는 두 제공자 모두 11월 8일, Coinbase 장중 최고가는 11월 10일입니다. 전환일을 하루 단위 확정 사실로 과도하게 해석하지 않습니다.</p><p><a href="${REPORT_ROOT}STRUCTURE_CROSS_VALIDATION.md" target="_blank" rel="noopener noreferrer">원자료 대조 · 이슈 · X/레딧/보고서 교차 검증 ↗</a></p>`;
  }
  const schedule=()=>{if(state.pending)return;state.pending=true;requestAnimationFrame(()=>{state.pending=false;drawOutlook();drawStructure();});};
  const scheduleAnalysis=()=>{if(state.analysisPending)return;state.analysisPending=true;requestAnimationFrame(()=>{state.analysisPending=false;if(!state.dataset||!state.visible)return;drawAnalysisIndicators();updateNavigation();syncAtlasUrl();});};
  function selectFrequency(value){
    if(!CHART_INTERVALS.some(interval=>interval.id===value)||state.frequency===value)return;
    const transition=transitionViewport({fromFrequency:state.frequency,toFrequency:value,range:state.chartRange,selectedDate:state.selectedDate,selectedTime:state.marketSelectedTime,priceDomain:state.priceDomain,scale:effectiveScale()});
    touchTracking.cancel();chartNavigation.cancelGesture();marketData.cancel();clearChartHover($('#lab-chart'));
    state.frequency=value;state.inspectionOwner='price';state.marketRange=isIntradayInterval(value)?transition.range:null;state.priceRange=isIntradayInterval(value)?null:transition.range;state.restoreMarketRange=Boolean(state.marketRange);
    state.selectedDate=transition.selectedDate;state.marketSelectedTime=transition.selectedTime;state.priceDomain=transition.priceDomain;state.chartRange=null;
    state.selectedHistoryEvent=null;state.selectedEvent=null;state.measurement=null;state.tool='crosshair';state.hoverReadoutKey=null;
    if(transition.notice)feedback(transition.notice);schedule();
  }
  function setUnit(value){
    if(!PRICE_UNITS.includes(value))return;
    const before=state.priceDomain;state.unit=value;state.priceDomain=normalizePriceDomain(before,{scale:effectiveScale()});
    if(before&&!state.priceDomain)feedback('로그 눈금은 양수 가격 범위가 필요해 자동 맞춤으로 돌아갔습니다.');
    schedule();
  }
  function changeAnalysisInput(id,key,value){state.indicators=changeIndicatorState(state.indicators,{action:'settings',id,patch:{inputs:{[key]:value}}});syncAnalysisInputs();publishIndicators();scheduleAnalysis();}
  $('#atlas-cycle-relation').innerHTML='<option value="all">모든 기간 관계</option>'+INTERVAL_RELATIONS.map(item=>`<option value="${item.id}">${esc(item.label)}</option>`).join('');
  $('#atlas-cycle-relation').onchange=event=>{state.cycleRelation=event.target.value;schedule();};
  $('#atlas-cycle-toggle').onclick=()=>{state.cycleCollapsed=!state.cycleCollapsed;schedule();};
  $('#atlas-cycle-overview').onclick=()=>{
    const range=cycleOverviewViewport(state.cycleAnnotations,{min:base().rows[0].date,max:model().displayEnd});
    if(!range)return;
    state.priceRange=range;state.cycleRelation='all';state.cycleCollapsed=false;state.selectedEvent=null;state.selectedHistoryEvent=null;$('#atlas-cycle-options').open=false;schedule();
  };
  $('#atlas-cycle-focus').onclick=()=>{
    const selection=activeCycleSelection(),range=cycleSelectionViewport(selection,{min:base().rows[0].date,max:model().displayEnd});
    if(!range)return;
    state.priceRange=range;state.selectedEvent=null;state.selectedHistoryEvent=null;$('#atlas-cycle-options').open=false;schedule();
  };
  $('#atlas-cycle-clear').onclick=()=>{showPriceInspection();$('#atlas-cycle-relation').focus({preventScroll:true});};
  $('#lab-scenario').onchange=e=>{state.scenario=e.target.value;state.measurement=null;state.eventPage=0;schedule();};
  document.addEventListener('atlas:hud-layout-change',()=>{
    refreshCycleHudPlacement();
  });
  document.addEventListener('atlas:indicator-command',event=>{
    const before=state.indicators,command=event.detail||{};
    state.indicators=changeIndicatorState(before,command);state.analysisMode=state.indicators.active;syncAnalysisInputs();
    if(command.action==='activate'){activateAnalysis(command.id);return;}
    if(!shown(state.analysisMode)&&state.inspectionOwner==='analysis')showPriceInspection();
    publishIndicators();syncAtlasUrl();
    const presentationOnly=command.action==='settings'&&!Object.hasOwn(command.patch||{},'inputs')&&!Object.hasOwn(command.patch||{},'intervals');
    if(presentationOnly){applyIndicatorPresentation($('#lab-chart'),state.indicators,state.frequency);for(const svg of analysisCharts.values())applyIndicatorPresentation(svg,state.indicators,state.frequency);refreshCycleHudPlacement();return;}
    const htmlOnly=['readout','source','legend'].includes(command.id)||['collapse','primary'].includes(command.action);
    if(!htmlOnly){if(ANALYSIS_MODES.some(item=>item.id===command.id))scheduleAnalysis();else schedule();}
    else refreshCycleHudPlacement();
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
    if(action==='undo'||action==='redo'){restoreHistory(action);return;}
    if(action==='annotations'){annotationWorkbench.open({opener:document.activeElement});return;}
    if(action==='save-measurement'){annotationWorkbench.open({opener:document.activeElement});annotationWorkbench.saveMeasurement();return;}
    if(['export-csv','export-png','export-svg','export-workspace'].includes(action)){
      if(state.priceController)exportWorkbench.open({format:action==='export-csv'?'csv':action==='export-svg'?'svg':'png',scope:action==='export-workspace'?'workspace':'main',opener:document.activeElement});return;
    }
    if(action==='context-menu'){chartNavigation.openMenu();return;}
    touchTracking.cancel();
    if(action==='tool'&&['crosshair','pan','measure'].includes(value)){
      state.tool=value;if(value!=='measure'&&state.measurement&&!state.measurement.endDate)state.measurement=null;
      document.dispatchEvent(new CustomEvent('atlas:close-detail'));$('#lab-chart').focus({preventScroll:true});
    }else if(action==='frequency'){selectFrequency(value);return;}
    else if(action==='chart-type'&&['line','candles'].includes(value)){
      if(state.chartType!==value)state.measurement=null;state.chartType=value;
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
    else if(action==='scale'){if(isStartPriceUnit(state.unit)){state.unit='usd';state.scale='log';}else state.scale=state.scale==='log'?'linear':'log';const previous=state.priceDomain;state.priceDomain=normalizePriceDomain(previous,{scale:effectiveScale()});if(previous&&!state.priceDomain)feedback('로그 눈금은 양수 범위가 필요해 가격축을 자동으로 맞췄습니다.');}
    else if(action==='unit'){setUnit(value);return;}
    else if(action==='invert-scale')state.invertScale=typeof value==='boolean'?value:!state.invertScale;
    else if(action==='price-only-auto'){state.priceOnlyAuto=typeof value==='boolean'?value:!state.priceOnlyAuto;state.priceDomain=null;}
    else if(action==='go-to'&&value?.ok&&value.frequency===state.frequency){chartNavigation.cancelGesture();marketData.cancel();state.selectedDate=value.selectedDate;state.marketSelectedTime=value.selectedTime;state.selectedEvent=null;state.selectedHistoryEvent=null;state.inspectionOwner='price';if(value.unit==='seconds'){state.marketRange=value.range;state.restoreMarketRange=true;}else state.priceRange=value.range;feedback(value.message);}
    else if(action==='auto-scale'){chartNavigation.cancelGesture();state.priceDomain=state.priceDomain?null:normalizePriceDomain(state.priceController?.getPriceScale?.(),{scale:effectiveScale()});}
    else if(action==='fit'){resetChartRange();return;}
    else if(action==='next-turn'){state.tool='crosshair';const next=nextTurnInfo(model());if(next)focusEvent(next.type);return;}
    else return;
    schedule();
  });
  $('#lab-unit').onchange=e=>setUnit(e.target.value);$('#lab-window').onchange=e=>{state.selectedHistoryEvent=null;state.window=e.target.value;state.priceRange=null;state.selectedEvent=null;schedule();};
  for(const item of INDICATORS.filter(item=>item.control))$(`#${item.control}`).onchange=event=>{
    if(event.target.checked){state.indicators=changeIndicatorState(state.indicators,{action:'add',id:item.id});if(!isIndicatorVisible(state.indicators,item.id))state.indicators=changeIndicatorState(state.indicators,{action:'visibility',id:item.id});}
    else if(isIndicatorVisible(state.indicators,item.id))state.indicators=changeIndicatorState(state.indicators,{action:'visibility',id:item.id});
    if(event.target.checked&&!shown(item.id))state.indicators=changeIndicatorState(state.indicators,{action:'settings',id:item.id,patch:{intervals:[...indicatorSettings(state.indicators,item.id).intervals,state.frequency]}});
    publishIndicators();schedule();
  };
  for(const button of document.querySelectorAll('[data-lab-frequency]'))button.onclick=()=>selectFrequency(button.dataset.labFrequency);
  for(const button of document.querySelectorAll('[data-lab-events]'))button.onclick=()=>{state.eventMode=button.dataset.labEvents;state.eventPage=0;document.querySelectorAll('[data-lab-events]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));if(state.dataset)renderEvents(model());};
  $('#lab-json').onclick=()=>{if(state.dataset)download('Bitcoin_Long_Horizon_Scenarios.json',JSON.stringify({...model(),cycleMilestones:cycleAnnotations(model())},null,2));};
  $('#lab-svg').onclick=()=>{void savePng();};
  $('#atlas-phase').onchange=e=>changeAnalysisInput('duration','phase',e.target.value);
  $('#atlas-alignment').onchange=e=>changeAnalysisInput('cycles','alignment',e.target.value);
  $('#atlas-period').onchange=e=>changeAnalysisInput('periods','period',e.target.value);
  $('#atlas-measure').onchange=e=>changeAnalysisInput('periods','metric',e.target.value);
  $('#atlas-period-scope').onchange=e=>changeAnalysisInput('periods','scope',e.target.value);
  function updateNavigation(){
    const analysis=state.inspectionOwner==='analysis',c=analysis?state.analysisController:state.priceController;
    $('#atlas-inspect-prev').disabled=typeof c?.previous!=='function'||Boolean(c?.hasPrevious)&&!c.hasPrevious();$('#atlas-inspect-next').disabled=typeof c?.next!=='function'||Boolean(c?.hasNext)&&!c.hasNext();
    $('#atlas-date-label').hidden=analysis||isIntradayInterval(state.frequency);$('#atlas-latest').hidden=analysis;
    const item=analysis?(state.analysisMode==='cycles'?'경과일':state.analysisMode==='periods'?'기간':'분석 항목'):isIntradayInterval(state.frequency)?'완료 봉':'고점·저점';$('#atlas-inspect-prev').setAttribute('aria-label',`이전 ${item}`);$('#atlas-inspect-next').setAttribute('aria-label',`다음 ${item}`);
  }
  $('#atlas-inspect-prev').onclick=()=>{if(state.inspectionOwner==='analysis')useAnalysisNavigation('previous');else state.priceController?.previous();updateNavigation();};$('#atlas-inspect-next').onclick=()=>{if(state.inspectionOwner==='analysis')useAnalysisNavigation('next');else state.priceController?.next();updateNavigation();};
  $('#atlas-date').onchange=e=>{if(!e.target.value||!e.target.validity.valid)return;const m=model(),v=e.target.value;state.inspectionOwner='price';state.selectedHistoryEvent=null;state.priceRange=null;state.selectedEvent=null;state.selectedDate=v;state.window=v<m.asOf?'history':'all';schedule();};
  $('#atlas-latest').onclick=()=>{marketData.cancel();state.inspectionOwner='price';state.marketRange=null;state.selectedHistoryEvent=null;state.priceRange=null;state.selectedEvent=null;state.marketSelectedTime=null;state.selectedDate=model().asOf;if(!CHART_SPANS.includes(state.window))state.window=DEFAULT_CHART_SPAN;schedule();};
  $('#atlas-cryptocon-view').onchange=e=>changeAnalysisInput('cryptocon','view',e.target.value);
  $('#atlas-reset').onclick=()=>{state.indicators=changeIndicatorState(state.indicators,{action:'reset'});publishIndicators();state.analysisMode='cycles';state.analysisOpen=false;state.inspectionOwner='price';state.lastAnalysisDetail=null;state.marketRange=null;state.selectedHistoryEvent=null;state.priceRange=null;state.atlasMode='price';state.scenario='base';state.frequency='daily';state.chartType='line';state.marketSelectedTime=null;marketData.cancel();state.scale='log';state.priceDomain=null;state.invertScale=false;state.priceOnlyAuto=false;state.tool='crosshair';state.magnet='off';state.measurement=null;state.unit='usd';state.window=DEFAULT_CHART_SPAN;state.selectedDate=null;state.selectedEvent=null;state.selectedCycleItem=null;state.cycleCollapsed=false;state.cycleRelation='all';state.atlasAlignment='trough';state.atlasPhase='macro';state.atlasPeriod='monthly';state.atlasMetric='returnPct';state.atlasScope='recent';for(const id of ['lab-band','lab-turns','lab-milestones','lab-cycle-intervals','atlas-volume','atlas-history-events'])$(`#${id}`).checked=true;for(const id of ['lab-fib','atlas-states','atlas-drawdown'])$(`#${id}`).checked=false;$('#atlas-display-options').open=false;schedule();};
  document.addEventListener('click',e=>{if(!$('#atlas-display-options').contains(e.target))$('#atlas-display-options').open=false;if(!$('#atlas-cycle-options').contains(e.target))$('#atlas-cycle-options').open=false;});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){touchTracking.cancel();$('#atlas-display-options').open=false;document.querySelector('.atlas-guide').open=false;$('#atlas-cycle-options').open=false;}});
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
  document.addEventListener('visibilitychange',()=>{if(document.hidden)touchTracking.cancel();if(!document.hidden){refreshCountdownDay();armMidnight();}});armMidnight();
  publishIndicators();
  return {setDataset(dataset){if(state.dataset===dataset)return;touchTracking.cancel();if(state.selectedDate===state.dataset?.prices.at(-1)?.[0])state.selectedDate=null;state.dataset=dataset;state.base=null;state.analysis=null;state.models.clear();state.futureStates.clear();state.cycleAnnotations=null;volumeProjectionCache.clear();state.volumeProjection=null;state.methodKey=null;state.eventsRenderKey=null;state.hoverReadoutKey=null;if(volumeState.series&&volumeState.series.lastDate<dataset.prices.at(-1)[0])void loadVolume({force:true});schedule();},show(value){state.visible=value;if(value)schedule();},showCompare(value){state.compareVisible=value;if(value)schedule();}};
}
