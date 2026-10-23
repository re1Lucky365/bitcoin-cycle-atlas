import { buildComparison, getAnchors, getPointAtDay, comparisonToCsv, validateDataset, utcDay } from './cycle-engine.js?v=1.11.0';
import { fetchLatestDataset } from './data-source.js?v=1.11.0';
import { inspectPublishedDataset, shouldCheckPublishedSnapshot } from './published-data.js?v=1.11.0';
import { analyzeCycleTiming } from './cycle-timing.js?v=1.11.0';
import { renderTimingView } from './timing-view.js?v=1.11.0';
import { analyzePeakZones } from './peak-zones.js?v=1.11.0';
import { analyzeCycleForecast } from './forecast-engine.js?v=1.11.0';
import { renderPeakView } from './peak-view.js?v=1.11.0';
import { renderForecastView, exportForecastSvg } from './forecast-view.js?v=1.11.0';
// Changed release modules use a versioned URL so a cached v1.5 module cannot
// leave a new long-horizon page running the old three-year workbench.
import { initViewportWorkspace } from './viewport-workspace.js?v=1.14.1-ime.1';
import { initLabView } from './lab-view.js?v=1.14.1-touch.1';
import { initEvidenceView, showEvidenceView } from './evidence-view.js?v=1.11.0';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const esc = (value) => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nfmt = (value, decimals = 0) => new Intl.NumberFormat('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
const money = (value, decimals = value < 10 ? 4 : 2) => value == null ? '—' : `$${nfmt(value, decimals)}`;
const pct = (value, decimals = 2) => value == null ? '—' : `${value >= 0 ? '+' : '−'}${nfmt(Math.abs(value), decimals)}%`;
const tone = (value) => value == null ? '' : value >= 0 ? 'gain' : 'loss';
const shortDate = (date) => date.replaceAll('-', '.');
const compact = (value, dollar = true) => `${dollar ? '$' : ''}${value >= 1e6 ? `${nfmt(value / 1e6, value % 1e6 === 0 ? 0 : 1)}M` : value >= 1e3 ? `${nfmt(value / 1e3, value % 1e3 === 0 ? 0 : 1)}K` : nfmt(value, value < 1 ? 2 : 0)}`;
const modeNames = { halving: '반감기', bottom: '저점', top: '고점', breakout: '이전 고점 돌파' };
const palette = ['#a594df', '#6a9fd4', '#5fb8a4', '#cf91aa'];
const icons = {
  layers:'<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
  table:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16"/>',
  book:'<path d="M12 6c-3-2-6-2-10-1v14c4-1 7-1 10 1 3-2 6-2 10-1V5c-4-1-7-1-10 1Zm0 0v14"/>',
  external:'<path d="M14 3h7v7M21 3l-10 10M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/>',
  moon:'<path d="M21 13A9 9 0 0 1 11 3a9 9 0 1 0 10 10Z"/>',
  link:'<path d="m10 13 4-4M8 15l-2 2a3.5 3.5 0 0 0 5 5l4-4a3.5 3.5 0 0 0 0-5M16 9l2-2a3.5 3.5 0 0 0-5-5L9 6a3.5 3.5 0 0 0 0 5" transform="translate(0 0) scale(.95)"/>',
  refresh:'<path d="M20 7V3m0 4h-4M4 17v4m0-4h4"/><path d="M20 7a9 9 0 0 0-15-2M4 17a9 9 0 0 0 15 2"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  trend:'<path d="m3 17 6-6 4 4 8-10M15 5h6v6"/>',
  download:'<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>',
  chevron:'<path d="m7 10 5 5 5-5"/>',
  image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><path d="m21 15-5-5-7 8-3-3-3 3"/>',
  chart:'<path d="M3 3v18h18M6 16l4-5 4 2 6-7"/>',
  half:'<circle cx="12" cy="12" r="8"/><path d="M12 4v16"/><path d="M12 4a8 8 0 0 0 0 16" fill="currentColor" opacity=".2"/>',
  bottom:'<path d="m3 7 8 11 10-11M11 3v7"/>',
  top:'<path d="m3 17 8-11 10 11M11 21v-7"/>',
  breakout:'<path d="M2 12h20" stroke-dasharray="2 3"/><path d="m3 19 5-4 4 1 8-13m-5 0h5v5"/>',
  reset:'<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>'
};
const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.chart}</svg>`;
$$('[data-icon]').forEach(el => el.innerHTML = icon(el.dataset.icon));

const params = new URLSearchParams(location.search);
// Old comparison links used `unit`; new links keep its choice separate from
// the atlas viewport, which can change while the comparison remains hidden.
const comparisonUnit = params.get('compare-unit') ?? (params.has('legacy') ? params.get('unit') : null);
const state = {
  mode: ['halving','bottom','top','breakout'].includes(params.get('mode')) ? params.get('mode') : 'halving',
  unit: comparisonUnit === 'indexed' ? 'indexed' : 'rebased',
  scale: params.get('scale') === 'linear' ? 'linear' : 'log',
  horizon: ['365','730','1461','current','all'].includes(params.get('range')) ? params.get('range') : '1461',
  cursor: /^\d{1,5}$/.test(params.get('day') || '') ? Number(params.get('day')) : null,
  hidden: new Set((params.get('hide') || '').split(',').filter(Boolean)),
  view: params.get('page')==='compare'&&!params.has('legacy')?'outlook':['outlook','compare','evidence','data'].includes(params.get('page')) ? params.get('page') : 'outlook', dataset: null, comparison: null, chart: null, dataPage: 0,
  timing: null, timingDataset: null, timingBaseline: ['previous','recent2','all3'].includes(params.get('baseline')) ? params.get('baseline') : 'recent2',
  analysisView: ['forecast','peak','timing'].includes(params.get('analysis')) ? params.get('analysis') : 'forecast',
  peakThreshold: ['0.9','0.93','0.94','0.95','0.98'].includes(params.get('zone')) ? Number(params.get('zone')) : .95,
  peakAnalysis: null, peakDataset: null,
  forecast: null, forecastDataset: null, forecastView: params.get('future') === 'analogues' ? 'analogues' : 'macro',
  forecastScenario: ['bottom-holds','calendar-48m','calendar-minus-3m','calendar-minus-4m','calendar-minus-5m'].includes(params.get('scenario')) ? params.get('scenario') : 'bottom-holds',
};
let toastTimer;
function toast(message) { $('#toast').textContent = message; $('#toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').hidden = true, 4200); }
function persistUrl() {
  // Only rewrite parameters owned by this page/comparison controller. The
  // atlas owns its current unit, viewport, indicators and analysis settings.
  const p = new URLSearchParams(location.search);
  for (const [key, value] of [
    ['page', state.view !== 'outlook' ? state.view : null],
    ['mode', state.mode !== 'halving' ? state.mode : null],
    ['compare-unit', p.has('legacy') || state.view === 'compare' || state.unit !== 'rebased' ? state.unit : null],
    ['scale', state.scale !== 'log' ? state.scale : null],
    ['range', state.horizon !== '1461' ? state.horizon : null],
    ['day', state.cursor != null && state.cursor !== state.comparison?.currentDays ? String(state.cursor) : null],
    ['hide', state.hidden.size ? [...state.hidden].join(',') : null],
    ['baseline', state.timingBaseline !== 'recent2' ? state.timingBaseline : null],
    ['analysis', state.analysisView !== 'forecast' ? state.analysisView : null],
    ['zone', state.peakThreshold !== .95 ? String(state.peakThreshold) : null],
    ['future', state.forecastView !== 'macro' ? state.forecastView : null],
    ['scenario', state.forecastScenario !== 'bottom-holds' ? state.forecastScenario : null],
  ]) value === null ? p.delete(key) : p.set(key, value);
  try { history.replaceState(null, '', `${location.pathname}${p.size ? `?${p}` : ''}`); } catch {}
}
document.documentElement.dataset.theme = 'dark';
let initialPageRendered = false;
function finishInitialPage() {
  if (document.documentElement.dataset.boot !== 'loading' || !state.dataset || !initialPageRendered) return;
  document.removeEventListener('atlas:page-ready', onInitialPageReady);
  document.dispatchEvent(new CustomEvent('atlas:ready'));
}
function onInitialPageReady(event) {
  if (event.detail?.page !== state.view) return;
  initialPageRendered = true;
  finishInitialPage();
}
document.addEventListener('atlas:page-ready', onInitialPageReady);
initViewportWorkspace(icon);
const outlookController = initLabView();
initEvidenceView();
function syncPage() {
  document.body.dataset.page=state.view;
  for (const view of ['outlook','compare','evidence','data']) document.querySelector(`#${view}-view`).hidden=state.view!==view;
  $$('[data-view]').forEach(n=>{const active=n.dataset.view===state.view;n.classList.toggle('active',active);if(active)n.setAttribute('aria-current','page');else n.removeAttribute('aria-current');});
  showEvidenceView(state.view==='evidence');
  outlookController.show(state.view==='outlook');
  outlookController.showCompare(state.view==='compare');
}
syncPage();

function render(recalculate = true) {
  if (!state.dataset) return;
  const comparisonVisible=state.view==='compare';
  if (comparisonVisible&&(recalculate||state.comparisonDataset!==state.dataset||!state.comparison)) {
    const anchors = getAnchors(state.dataset, state.mode);
    const elapsed = utcDay(state.dataset.prices.at(-1)[0]) - utcDay(anchors.at(-1).date);
    const horizon = state.horizon === 'current' ? elapsed : state.horizon === 'all' ? 'all' : Number(state.horizon);
    state.comparison = buildComparison(state.dataset, { mode: state.mode, horizon });
    state.comparison.series.forEach((s, i) => s.color = s.current ? '#f2aa4c' : palette[i % palette.length]);
    if (state.comparison.series.every(s => state.hidden.has(s.id))) state.hidden.clear();
    state.cursor = Math.min(state.comparison.horizon, Math.max(0, state.cursor ?? state.comparison.currentDays));
    state.comparisonDataset=state.dataset;
  }
  if(comparisonVisible){
  $$('.anchor-tab').forEach(button => { const active = button.dataset.mode === state.mode; button.classList.toggle('active', active); button.setAttribute('aria-selected', String(active)); button.tabIndex = active ? 0 : -1; });
  $('#chart-panel').setAttribute('aria-labelledby', `tab-${state.mode}`);
  $$('[data-unit]').forEach(b => { b.classList.toggle('selected', b.dataset.unit === state.unit); b.setAttribute('aria-pressed', String(b.dataset.unit === state.unit)); });
  $$('[data-scale]').forEach(b => { b.classList.toggle('selected', b.dataset.scale === state.scale); b.setAttribute('aria-pressed', String(b.dataset.scale === state.scale)); });
  $('#horizon').value = state.horizon;
  renderLegend(); renderChart(); renderTable(state.cursor); renderMethod(); renderResearch();
  syncCursorInputs();
  }
  if(state.view==='data'){renderData();initialPageRendered=true;}
  outlookController.setDataset(state.dataset);
  document.dispatchEvent(new CustomEvent('atlas:dataset',{detail:{latestObservationDate:state.dataset.prices.at(-1)[0]}}));
  $('#sidebar-asof').textContent=`관측 · ${state.dataset.prices.at(-1)[0].replaceAll('-','.')} UTC`;
  $('#loading-state').hidden = true;
  persistUrl();
  // The first visible-page draw and validated data must both finish. Chart and
  // evidence renderers report their own completion after their scheduled frame.
  finishInitialPage();
}
function renderTiming() {
  if (!state.dataset) return;
  try {
    if (state.timingDataset !== state.dataset || state.timing?.selectedBaseline !== state.timingBaseline) {
      state.timing = analyzeCycleTiming(state.dataset, { baseline: state.timingBaseline });
      state.timingDataset = state.dataset;
    }
    renderTimingView(state.timing, state.timingBaseline);
  } catch {
    $('#timing-verdict').innerHTML = '<p>현재 자료로 전환 시점 분석을 계산하지 못했습니다. 원자료와 기준일을 확인해 주세요.</p>';
    $('#timing-body').innerHTML = ''; $('#timing-turns').innerHTML = ''; $('#timing-current').textContent = '';
    $('#timing-details-content').innerHTML = ''; state.timing = null;
  }
}
$('#timing-baseline').addEventListener('change', e => { state.timingBaseline = e.target.value; renderTiming(); renderResearch(); persistUrl(); });

function renderResearch() {
  if (!state.dataset || state.view !== 'compare') return;
  $$('.analysis-tabs button').forEach(b=>{const active=b.dataset.analysis===state.analysisView;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;});
  $('#forecast-analysis').hidden=state.analysisView!=='forecast';
  $('#peak-analysis').hidden=state.analysisView!=='peak';
  $('#timing-analysis').hidden=state.analysisView!=='timing';
  $('#analysis-asof').textContent=`관측 종료 ${state.dataset.prices.at(-1)[0].replaceAll('-','.')} UTC`;
  try {
    if(state.analysisView==='timing'||state.analysisView==='peak')renderTiming();
    if(state.analysisView==='peak'&&(state.peakDataset!==state.dataset||state.peakAnalysis?.threshold!==state.peakThreshold||state.peakAnalysis?.baseline!==state.timingBaseline)){
      state.peakAnalysis=analyzePeakZones(state.dataset,{threshold:state.peakThreshold,baseline:state.timingBaseline});state.peakDataset=state.dataset;
    }
    if(state.analysisView==='forecast'&&(state.forecastDataset!==state.dataset||state.forecast?.methodology?.highZoneFraction!==state.peakThreshold)){
      state.forecast=analyzeCycleForecast(state.dataset,{highZoneFraction:state.peakThreshold});state.forecastDataset=state.dataset;
    }
    if(state.analysisView==='peak')renderPeakView(state.peakAnalysis,state.dataset,state.timing);
    if(state.analysisView==='forecast')renderForecastView(state.forecast,state.dataset,{view:state.forecastView,scenarioId:state.forecastScenario});
    $('#forecast-scenario').value=state.forecastScenario;
    $$('[data-forecast-view]').forEach(b=>{const active=b.dataset.forecastView===state.forecastView;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});
  } catch(error) {
    const target=state.analysisView==='peak'?'#peak-summary':'#forecast-summary';
    $(target).textContent='현재 자료에서 이 분석을 계산하지 못했습니다. 원자료를 갱신한 뒤 다시 확인해 주세요.';
    console.error('Research calculation failed',error);
  }
}
$$('[data-analysis]').forEach((b,i,all)=>{
  b.addEventListener('click',()=>{state.analysisView=b.dataset.analysis;renderResearch();persistUrl();});
  b.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?all.length-1:(i+(e.key==='ArrowRight'?1:-1)+all.length)%all.length;all[next].click();all[next].focus();});
});
$('#peak-threshold').addEventListener('change',e=>{state.peakThreshold=Number(e.target.value);renderResearch();persistUrl();});
$('#peak-baseline').addEventListener('change',e=>{state.timingBaseline=e.target.value;renderTiming();renderResearch();persistUrl();});
$('#forecast-scenario').addEventListener('change',e=>{state.forecastScenario=e.target.value;renderResearch();persistUrl();});
$$('[data-forecast-view]').forEach(b=>b.addEventListener('click',()=>{state.forecastView=b.dataset.forecastView;renderResearch();persistUrl();}));
$('#jump-forecast').addEventListener('click',()=>{state.analysisView='forecast';renderResearch();persistUrl();});

function modeExplanation() {
  const c = state.comparison;
  const base = state.unit === 'indexed' ? '모든 사이클의 시작을 100으로 맞춥니다.' : `모든 사이클의 시작을 ${c.currentAnchor.year}년 기준 가격 ${money(c.referencePrice)}에 맞춥니다.`;
  return `${base}${state.mode === 'top' ? ' 이 차트는 2025년 연간 최고값을 기준으로 합니다. 아래 전환 분석은 2024년 반감기 이후 최신 관측 최고값을 사용합니다.' : state.mode === 'bottom' ? ' 저점은 후속 반감기로 구간이 끝난 관측값만 사용합니다.' : ''}`;
}
function renderLegend() {
  const c = state.comparison;
  $('#cycle-legend').style.gridTemplateColumns = `repeat(${c.series.length},minmax(0,1fr))`;
  $('#cycle-legend').innerHTML = c.series.map(s => `<button class="legend-item" style="--cycle-color:${s.color}" data-series="${s.id}" aria-pressed="${!state.hidden.has(s.id)}" aria-label="${s.label} 사이클 ${state.hidden.has(s.id) ? '표시' : '숨기기'}"><span class="legend-heading"><span class="swatch"></span>${s.label} 사이클${s.current ? `<span class="current-tag">${s.provisional ? '잠정' : '현재'}</span>` : ''}<span class="legend-checkbox" aria-hidden="true">✓</span></span><span class="legend-sub">${shortDate(s.date)} <span>${state.unit === 'indexed' ? '· 시작 = 100' : `· 환산 ×${nfmt(c.referencePrice / s.price, c.referencePrice / s.price >= 10 ? 1 : 2)}`}</span></span></button>`).join('');
  $$('[data-series]').forEach(b => b.addEventListener('click', () => {
    if (!state.hidden.has(b.dataset.series) && c.series.filter(s => !state.hidden.has(s.id)).length === 1) return toast('비교할 사이클을 하나 이상 선택해 주세요.');
    state.hidden.has(b.dataset.series) ? state.hidden.delete(b.dataset.series) : state.hidden.add(b.dataset.series);
    render(false);
  }));
  $('#mode-explainer').textContent = modeExplanation();
}
function niceStep(span, target = 6) {
  const raw = Math.max(span / target, 1e-9), p = 10 ** Math.floor(Math.log10(raw));
  return ([1,2,2.5,5,10].find(n => n * p >= raw) || 10) * p;
}
function linePath(points, x, y) {
  let previous = -2;
  return points.map(p => { const command = p.day === previous + 1 ? 'L' : 'M'; previous = p.day; return `${command}${x(p.day).toFixed(2)},${y(p[state.unit]).toFixed(2)}`; }).join(' ');
}
function renderChart() {
  if (!state.comparison || state.view !== 'compare') return;
  const c = state.comparison, stage = $('#chart-stage'), svg = $('#cycle-chart');
  const width = Math.max(stage.clientWidth, 300), height = Math.max(stage.clientHeight, 218), mobile = width < 600;
  const left = mobile ? 42 : 62, right = mobile ? 15 : 43, top = 25, bottom = height - 29;
  const plotWidth = width - left - right, plotHeight = bottom - top, horizon = Math.max(c.horizon, 1);
  const visible = c.series.filter(s => !state.hidden.has(s.id));
  const values = visible.flatMap(s => s.points.map(p => p[state.unit]));
  if (!values.length) return;
  const low = Math.min(...values), high = Math.max(...values), log = state.scale === 'log';
  const logSpan = Math.max(Math.log10(high) - Math.log10(low), .15);
  const lo = log ? Math.log10(low) - logSpan * .08 : 0;
  const hi = log ? Math.log10(high) + logSpan * .1 : high * 1.09;
  const x = day => left + day / horizon * plotWidth;
  const y = value => bottom - ((log ? Math.log10(value) : value) - lo) / (hi - lo) * plotHeight;
  const css = getComputedStyle(document.documentElement), bg = css.getPropertyValue('--surface').trim(), grid = css.getPropertyValue('--grid').trim(), muted = css.getPropertyValue('--subtle').trim(), text = css.getPropertyValue('--muted').trim();
  state.chart = { x,y,left,right,top,bottom,width,height,plotWidth,horizon,visible,bg };
  const yTicks = [];
  if (log) {
    for (let e = Math.floor(lo); e <= Math.ceil(hi); e++) for (const m of [1,2,5]) { const v = m * 10 ** e; if (Math.log10(v) >= lo && Math.log10(v) <= hi) yTicks.push(v); }
    if (yTicks.length < 2) yTicks.push(low, high);
  } else { const step = niceStep(high * 1.09, mobile ? 4 : 5); for (let v = 0; v <= high * 1.09; v += step) yTicks.push(v); }
  const font = 9, xStep = niceStep(horizon, mobile ? 4 : 7);
  let html = `<title id="svg-chart-title">${modeNames[state.mode]} 기준 비트코인 사이클 비교</title><desc id="svg-chart-desc">${visible.length}개 사이클. ${c.latest.date} UTC까지의 실제 관측. ${state.unit === 'indexed' ? '시작을 100으로 정규화' : '현재 기준 가격에 환산'}. ${log ? '로그' : '선형'} 눈금.</desc><defs><linearGradient id="current-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#f2aa4c" stop-opacity=".10"/><stop offset="100%" stop-color="#f2aa4c" stop-opacity="0"/></linearGradient><clipPath id="plot-clip"><rect x="${left}" y="${top}" width="${plotWidth}" height="${plotHeight}"/></clipPath></defs>`;
  if (c.currentDays < horizon) html += `<rect x="${x(c.currentDays)}" y="${top}" width="${x(horizon)-x(c.currentDays)}" height="${plotHeight}" fill="${muted}" opacity=".035"/>`;
  yTicks.forEach(v => html += `<line x1="${left}" x2="${width - right}" y1="${y(v)}" y2="${y(v)}" stroke="${grid}" stroke-width=".7"/><text x="${left - 10}" y="${y(v) + 3}" text-anchor="end" fill="${muted}" font-size="${font}">${compact(v,state.unit==='rebased')}</text>`);
  for (let day = 0; day <= horizon; day += xStep) html += `<line x1="${x(day)}" x2="${x(day)}" y1="${top}" y2="${bottom}" stroke="${grid}" stroke-width=".6" stroke-dasharray="2 4"/><text x="${x(day)}" y="${bottom + 19}" text-anchor="middle" fill="${muted}" font-size="${font}">${nfmt(day)}</text>`;
  html += `<line x1="${left}" x2="${width-right}" y1="${bottom}" y2="${bottom}" stroke="${grid}"/>`;
  const base = state.unit === 'indexed' ? 100 : c.referencePrice;
  if (base > 0 && y(base) <= bottom && y(base) >= top) html += `<line x1="${left}" x2="${width-right}" y1="${y(base)}" y2="${y(base)}" stroke="${muted}" stroke-opacity=".3" stroke-width=".7" stroke-dasharray="3 5"/>`;
  html += '<g clip-path="url(#plot-clip)">';
  visible.forEach(s => {
    if (!s.points.length) return;
    const path = linePath(s.points,x,y);
    if (s.current && s.points.every((p,i) => !i || p.day === s.points[i-1].day + 1)) html += `<path d="${path} L${x(s.points.at(-1).day)},${bottom} L${x(s.points[0].day)},${bottom} Z" fill="url(#current-fill)"/>`;
    html += `<path data-chart-series="${s.id}" d="${path}" fill="none" stroke="${s.color}" stroke-width="${s.current ? mobile ? 2 : 2.3 : mobile ? 1.1 : 1.35}" opacity="${s.current ? 1 : .87}" stroke-linejoin="round" stroke-linecap="round"/>`;
  });
  html += '</g>';
  visible.forEach(s => {
    const p = s.points.at(-1); if (!p) return;
    if (s.current) html += `<circle cx="${x(p.day)}" cy="${y(p[state.unit])}" r="3.6" fill="${s.color}" stroke="${bg}" stroke-width="1.8"/>`;
    if (!mobile && !s.current && p.day >= horizon - 3) html += `<text x="${width-right+7}" y="${Math.max(top+9, Math.min(bottom-3,y(p[state.unit])+3))}" fill="${s.color}" font-size="8" font-weight="500">${s.label}</text>`;
  });
  if (c.currentDays <= horizon) {
    const nowX = x(c.currentDays), label = `현재 D+${nfmt(c.currentDays)}`, badgeWidth = mobile ? 69 : 82, labelX = Math.min(width-right-badgeWidth,Math.max(left,nowX-badgeWidth/2));
    html += `<line x1="${nowX}" x2="${nowX}" y1="${top}" y2="${bottom}" stroke="#f2aa4c" stroke-opacity=".45" stroke-width=".9" stroke-dasharray="4 4"/><rect x="${labelX}" y="3" width="${badgeWidth}" height="17" rx="3" fill="#f2aa4c" fill-opacity=".1"/><text x="${labelX+badgeWidth/2}" y="15" text-anchor="middle" fill="#d99b4d" font-size="${mobile?7:8}">${label}</text>`;
  } else html += `<text x="${width-right}" y="15" text-anchor="end" fill="${text}" font-size="8">현재 D+${nfmt(c.currentDays)} · 표시 범위 밖</text>`;
  html += `<g id="cursor-layer"></g><rect id="chart-hitarea" class="chart-hitarea" x="${left}" y="${top}" width="${plotWidth}" height="${plotHeight}" fill="transparent"/>`;
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`); svg.innerHTML = html;
  $('#axis-title').textContent = `${state.unit === 'indexed' ? '정규화 지수 (시작 = 100)' : '환산 가격 (USD)'} · ${log ? '로그' : '선형'}`;
  $('#chart-date-label').textContent = `기준일 ${shortDate(c.latest.date)} UTC`;
  $('.history-note').style.visibility = c.currentDays < horizon ? 'visible' : 'hidden';
  drawCursor(state.cursor);
  $('#chart-hitarea').addEventListener('pointermove', e => { if (e.pointerType === 'touch') return; const day = dayFromPointer(e); drawCursor(day); showTooltip(day,e); });
  $('#chart-hitarea').addEventListener('pointerleave', () => { $('#chart-tooltip').hidden = true; drawCursor(state.cursor); renderTable(state.cursor); });
  $('#chart-hitarea').addEventListener('click', e => { setCursor(dayFromPointer(e)); $('#chart-tooltip').hidden = true; });
}
function dayFromPointer(e) { const r = $('#cycle-chart').getBoundingClientRect(), c = state.chart; return Math.max(0, Math.min(c.horizon, Math.round(((e.clientX-r.left)/r.width*c.width-c.left)/c.plotWidth*c.horizon))); }
function drawCursor(day) {
  const g = $('#cursor-layer'); if (!g || !state.chart) return;
  const c = state.chart, x = c.x(day), muted = getComputedStyle(document.documentElement).getPropertyValue('--muted').trim();
  let html = `<line x1="${x}" x2="${x}" y1="${c.top}" y2="${c.bottom}" stroke="${muted}" stroke-opacity=".48" stroke-width=".8" stroke-dasharray="2 3"/>`;
  c.visible.forEach(s => { const p = getPointAtDay(s,day); if (p) html += `<circle cx="${x}" cy="${c.y(p[state.unit])}" r="3.1" fill="${s.color}" stroke="${c.bg}" stroke-width="1.5"/>`; });
  g.innerHTML = html;
}
function showTooltip(day,e) {
  const tip = $('#chart-tooltip'), stage = $('#chart-stage'), rect = stage.getBoundingClientRect();
  tip.innerHTML = `<div class="tooltip-head">기준일부터 D+${nfmt(day)}</div>${state.chart.visible.map(s => { const p = getPointAtDay(s,day); return `<div class="tooltip-row"><span class="swatch" style="--cycle-color:${s.color}"></span><span>${s.label} ${s.provisional?'· 잠정':s.current?'· 현재':''}<small>${p ? shortDate(p.date) : '관측 없음'}</small></span><strong>${p ? state.unit === 'indexed' ? nfmt(p.indexed,2) : money(p.rebased,0) : '—'}<small>${p ? `실제 ${money(p.price)}` : '미래 값을 만들지 않습니다'}</small></strong></div>`; }).join('')}<div class="tooltip-note">${state.unit==='indexed'?'시작 = 100 지수':'같은 시작가격으로 환산한 USD'} · 클릭하면 비교 시점 고정</div>`;
  tip.hidden = false;
  const px = e.clientX-rect.left, py = e.clientY-rect.top;
  tip.style.left = `${Math.max(0,Math.min(rect.width-tip.offsetWidth, px+18+tip.offsetWidth>rect.width?px-tip.offsetWidth-18:px+18))}px`;
  tip.style.top = `${Math.max(20,Math.min(rect.height-tip.offsetHeight,py-tip.offsetHeight/2))}px`;
}
function syncCursorInputs() {
  $('#day-cursor').max = state.comparison.horizon; $('#day-number').max = state.comparison.horizon;
  $('#day-cursor').value = state.cursor; $('#day-number').value = state.cursor;
  $('#day-cursor-value').textContent = `D + ${nfmt(state.cursor)}`;
  $('#day-cursor').setAttribute('aria-valuetext', `기준일부터 ${state.cursor}일`);
}
function setCursor(value) { if (!state.comparison) return; state.cursor = Math.max(0,Math.min(state.comparison.horizon,Math.round(Number(value)||0))); syncCursorInputs(); drawCursor(state.cursor); renderTable(state.cursor); persistUrl(); }
function renderTable(day) {
  const c = state.comparison;
  $('#comparison-heading').textContent = `경과일별 비교`;
  $('#table-unit-header').textContent = state.unit === 'indexed' ? '시작 = 100 지수' : '환산 가격';
  $('#comparison-body').innerHTML = c.series.filter(s => !state.hidden.has(s.id)).map(s => {
    const p = getPointAtDay(s,day);
    return `<tr class="${s.current?'current-row':''}"><td><span class="swatch" style="--cycle-color:${s.color}"></span>${s.label} 사이클 ${s.current?`<span class="current-tag">${s.provisional?'잠정':'현재'}</span>`:''}</td><td>${p ? shortDate(p.date) : '<span class="muted-value">미관측 / 범위 밖</span>'}</td><td>${p?money(p.price):'—'}</td><td>${p ? state.unit==='indexed'?nfmt(p.indexed,2):money(p.rebased):'—'}</td><td class="${p?tone(p.returnPct):''}">${p?pct(p.returnPct):'—'}</td><td>${p?`${nfmt(p.ratio,2)}×`:'—'}</td></tr>`;
  }).join('');
  $('#comparison-body').setAttribute('aria-label', `D+${day} 비교 데이터`);
}
function renderMethod() {
  const c = state.comparison;
  const link = (href,text) => `<a href="${href}" target="_blank" rel="noopener noreferrer">${text} ↗</a>`;
  $('#method-content').innerHTML = `<h3>01. 실제 일별 가격</h3><p>${link('https://coinmetrics.io/','Coin Metrics')} Community의 <code>PriceUSD</code>를 사용합니다. 각 날짜의 UTC 일말 기준가격이며 실시간 호가나 장중 고저가가 아닙니다. 관측 범위는 <strong>${c.metadata.firstDate}–${c.metadata.lastDate}</strong>, ${nfmt(c.metadata.count)}개 관측이며 내부 결측은 ${c.metadata.missingDayCount}일입니다. 갱신 실패 시 마지막으로 검증된 데이터를 유지합니다.</p><p>${link('https://github.com/coinmetrics/docs-website/blob/master/asset-metrics/market/priceusd.md','가격 지표 정의')} · ${link('https://gitbook-docs.coinmetrics.io/packages/coin-metrics-community-data','Community 데이터 안내')}</p><h3>02. 네 가지 출발점</h3><ul><li><strong>반감기:</strong> 2012-11-28, 2016-07-09, 2020-05-11, 2024-04-20의 UTC 일말 가격. ${link('https://bitcoin.org/en/halving','반감기 연혁')}</li><li><strong>고점:</strong> 원본의 역사적 시장 구간에 맞춰 2011·2013·2017·2021년 각각의 최고 일말값을 사용합니다. 2025년 연간 최고값도 추가하되, 최종 시장고점이 확정됐다는 의미가 아닌 <strong>잠정 비교 기준</strong>으로 표시합니다.</li><li><strong>저점:</strong> 위 역사 고점부터 뒤따르는 반감기 전날까지의 최소 일말값입니다. 구간이 끝나지 않은 2026년 잠정 저점은 포함하지 않습니다.</li><li><strong>이전 고점 돌파:</strong> 각 역사 저점 이후, 앞선 기준 고점의 일말가격을 처음 초과한 날짜입니다. 장중 돌파일과 다를 수 있습니다.</li></ul><p>이 소스의 2022년 저점은 <strong>11월 9일</strong>입니다. 거래소별 장중 저가와 일말 기준가격은 다르므로 널리 알려진 날짜를 그대로 입력하지 않고 원자료에서 계산합니다. 고점·저점의 사후 선택에는 미래 정보를 이용한 선택 편향이 있습니다.</p><h3>현재 선택: ${modeNames[state.mode]}</h3><div class="anchor-list"><table><thead><tr><th>사이클</th><th>기준일 UTC</th><th>시작 가격 USD</th><th>구분</th></tr></thead><tbody>${c.series.map(s=>`<tr><td>${s.label}</td><td>${s.date}</td><td>${money(s.price)}</td><td>${s.provisional?'잠정 시장고점':s.current?'최신 기준':'역사 기준'}</td></tr>`).join('')}</tbody></table></div><h3>03. 정규화와 시간축</h3><div class="method-formula">환산 가격 = 실제 가격 ÷ 해당 사이클 시작 가격 × 현재 시작 가격<br>100 기준 지수 = 실제 가격 ÷ 해당 사이클 시작 가격 × 100<br>수익률 = (실제 가격 ÷ 시작 가격 − 1) × 100%</div><p>가로축은 행 순서가 아닌 UTC 날짜 차이(D+0부터)입니다. 역사 경로는 시작일 뒤 최대 <strong>1,461일까지</strong> 표시하며 다음 반감기를 넘어갈 수 있습니다. 현재 경로는 마지막 관측까지만 표시합니다. 빈 날짜를 보간하거나 미래 가격을 생성하지 않습니다. 로그 눈금은 동일한 비율의 변화를 같은 간격으로 보여 줍니다.</p><p>차트 오른쪽의 음영은 현재 경과일 이후에 해당하는 <strong>과거의 관측 기록</strong>입니다. 예측 구간이 아닙니다.</p><h3>04. 원본 조사와 재구현 범위</h3><p>${link('https://www.bitcoincyclescomparison.com/','Bitcoin Cycles Comparison')}의 네 가지 시작 기준, 정규화, 로그 차트를 바탕으로 독립 구현했습니다. ${link('https://bitcointalk.org/index.php?topic=5512441.0','2024년 이용 기록과 원본 화면')}에서 동작을 교차 확인했습니다. 원본의 데이터 공급자와 계산 소스는 확인하지 못했으므로 가격과 기준일의 완전 일치를 주장하지 않습니다.</p><p>원본은 고점을 ‘다음 반감기 전 최고점’으로 설명하지만 2024년 신규 최고가 이전의 2021년 고점을 계속 기준으로 사용했습니다. 여기서는 혼동을 피하기 위해 고점의 기준 연도와 계산 규칙을 명시합니다. 정확한 1,461일 창, 한국어 UI, 100 지수, 데이터 표와 다운로드는 이 재구현의 선택입니다.</p><h3>05. 출처와 데이터 이용 조건</h3><p>가격 데이터 © Coin Metrics, ${link('https://creativecommons.org/licenses/by-nc/4.0/','CC BY-NC 4.0')}. 원자료를 BTC·USD·일별로 추출하고 정규화한 비상업 연구용 도구입니다. ${link('https://github.com/coinmetrics/data','공개 데이터 라이선스')}를 따릅니다. 금융상품의 매수·매도 권유 또는 미래 가격 예측을 제공하지 않습니다.</p><p>데이터 조회 시각: ${esc(c.metadata.retrievedAt || '번들 기준')}<br>최근 완료 관측: ${c.latest.date} UTC</p>`;
}
function showMethod() { closeExport(); if (!state.dataset) return toast('데이터를 불러온 뒤 방법론을 확인할 수 있습니다.'); renderMethod(); $('#method-dialog').showModal(); document.dispatchEvent(new Event('method:open')); }
$$('[data-method]').forEach(b => b.addEventListener('click', showMethod));
$('#close-method').addEventListener('click', () => $('#method-dialog').close()); $('#method-done').addEventListener('click', () => $('#method-dialog').close());
$('#method-dialog').addEventListener('click', e => { if(e.target === $('#method-dialog')) { const r=e.target.getBoundingClientRect(); if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom) e.target.close(); } });

function renderData() {
  if (!state.dataset) return;
  const rows = state.dataset.prices;
  const chosen = $('#data-year').value;
  const years = [...new Set(rows.map(r=>r[0].slice(0,4)))].reverse();
  $('#data-year').innerHTML = '<option value="all">전체 연도</option>' + years.map(y=>`<option value="${y}">${y}년</option>`).join('');
  $('#data-year').value = years.includes(chosen) ? chosen : 'all';
  $('#data-summary').innerHTML = `<div><label>관측 범위</label><strong>${rows[0][0]} — ${rows.at(-1)[0]}</strong></div><div><label>일별 관측 수</label><strong>${nfmt(rows.length)}개</strong></div><div><label>가격 정의</label><strong>USD · UTC 일말 · 1d</strong></div>`;
  const filter = $('#data-year').value;
  const filtered = rows.map((r,i)=>({date:r[0],price:r[1],change:i&&utcDay(r[0])-utcDay(rows[i-1][0])===1?(r[1]/rows[i-1][1]-1)*100:null})).filter(r=>filter==='all'||r.date.startsWith(filter)).reverse();
  const shell=$('#data-view .table-scroll');
  const pageSize=Math.max(3,Math.floor((shell.clientHeight-34)/34)||12);
  const pages = Math.max(1,Math.ceil(filtered.length/pageSize)); state.dataPage = Math.max(0,Math.min(pages-1,state.dataPage));
  $('#data-result-count').textContent = `${nfmt(filtered.length)}개 관측`;
  $('#data-body').innerHTML = filtered.slice(state.dataPage*pageSize,state.dataPage*pageSize+pageSize).map(r=>`<tr><td>${r.date}</td><td>${money(r.price,r.price<10?6:4)}</td><td class="${tone(r.change)}">${pct(r.change)}</td><td>PriceUSD</td></tr>`).join('');
  $('#data-page-label').textContent = `${nfmt(state.dataPage+1)} / ${nfmt(pages)} 페이지 · ${pageSize}행씩 표시`;
  $('#data-prev').disabled = state.dataPage === 0; $('#data-next').disabled = state.dataPage === pages-1;
}
$$('[data-view]').forEach(b => b.addEventListener('click', () => {
  state.view = b.dataset.view;
  syncPage();
  closeExport();
  if(state.view==='compare') requestAnimationFrame(()=>render()); else if(state.view==='data') renderData();
  persistUrl();
  window.scrollTo({top:0,behavior:'instant'});
}));
$('#data-year').addEventListener('change',()=>{state.dataPage=0;renderData();});
$('#data-prev').addEventListener('click',()=>{state.dataPage--;renderData();}); $('#data-next').addEventListener('click',()=>{state.dataPage++;renderData();});
// Comparison controls must not capture clicks or keys that bubble from the
// separate analysis dock, which also publishes its current mode in the DOM.
$$('#compare-view .anchor-tab[data-mode]').forEach(b=>b.addEventListener('click',()=>{state.mode=b.dataset.mode;state.cursor=null;state.hidden.clear();render();}));
$$('#compare-view .anchor-tab[data-mode]').forEach((b,i,all)=>b.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?all.length-1:(i+(e.key==='ArrowRight'?1:-1)+all.length)%all.length;all[next].click();all[next].focus();}));
$$('[data-unit]').forEach(b=>b.addEventListener('click',()=>{state.unit=b.dataset.unit;render(false);}));
$$('[data-scale]').forEach(b=>b.addEventListener('click',()=>{state.scale=b.dataset.scale;render(false);}));
$('#horizon').addEventListener('change',e=>{state.horizon=e.target.value;render();});
$('#reset-chart').addEventListener('click',()=>{state.mode='halving';state.unit='rebased';state.scale='log';state.horizon='1461';state.cursor=null;state.hidden.clear();render();toast('기본 비교 화면으로 돌아왔습니다.');});
$('#day-cursor').addEventListener('input',e=>setCursor(e.target.value));
$('#day-number').addEventListener('input',e=>{if(e.target.value!=='')setCursor(e.target.value);});
$('#day-number').addEventListener('change',e=>setCursor(e.target.value));
$('#jump-today').addEventListener('click',()=>{if(!state.comparison)return; if(state.comparison.currentDays>state.comparison.horizon){state.horizon='current';render();}setCursor(state.comparison.currentDays);});

function download(filename,blob) { const a=document.createElement('a');const url=URL.createObjectURL(blob);a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000); }
function closeExport() { $('#export-menu').hidden=true;$('#export-button').setAttribute('aria-expanded','false'); }
$('#export-button').addEventListener('click',()=>{const open=$('#export-menu').hidden;$('#export-menu').hidden=!open;$('#export-button').setAttribute('aria-expanded',String(open));if(open)$('#export-menu button').focus();});
document.addEventListener('click',e=>{if(!e.target.closest('.export-wrap'))closeExport();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeExport();$('#chart-tooltip').hidden=true;}});
$('#export-timing').addEventListener('click',()=>{if(!state.timing)return;download(`bitcoin-cycle-timing-${state.timing.asOf}.json`,new Blob([JSON.stringify(state.timing,null,2)],{type:'application/json'}));closeExport();toast('계산 조건, 전환 날짜, 민감도와 이전 실패 사례를 저장했습니다.');});
$('#export-research').addEventListener('click',()=>{if(!state.forecast)return;download(`bitcoin-peak-forecast-${state.forecast.asOf}.json`,new Blob([JSON.stringify({peakZones:state.peakAnalysis,forecast:state.forecast},null,2)],{type:'application/json'}));closeExport();toast('고점권 비교와 미래 시나리오의 계산 결과를 저장했습니다.');});
$('#export-forecast-svg').addEventListener('click',()=>{if(!state.forecast)return;download(`bitcoin-future-scenarios-${state.forecast.asOf}.svg`,new Blob([exportForecastSvg()],{type:'image/svg+xml;charset=utf-8'}));toast('조건과 기준일을 포함한 미래 시나리오 그래프를 저장했습니다.');});
$('#export-csv').addEventListener('click',()=>{if(!state.comparison)return;const c={...state.comparison,series:state.comparison.series.filter(s=>!state.hidden.has(s.id))};download(`bitcoin-cycles-${state.mode}-${c.latest.date}.csv`,new Blob(['\uFEFF'+comparisonToCsv(c)],{type:'text/csv;charset=utf-8'}));closeExport();toast('현재 표시한 사이클의 비교 데이터를 저장했습니다.');});
$('#export-raw').addEventListener('click',()=>{if(!state.dataset)return;const rows=state.dataset.prices.filter(r=>$('#data-year').value==='all'||r[0].startsWith($('#data-year').value));download(`btc-usd-daily-${$('#data-year').value}.csv`,new Blob(['\uFEFFdate_utc,price_usd,metric,source,license\r\n'+rows.map(r=>`${r[0]},${r[1]},PriceUSD,Coin Metrics,CC BY-NC 4.0`).join('\r\n')+'\r\n'],{type:'text/csv;charset=utf-8'}));toast('선택한 연도의 원자료를 저장했습니다.');});
function chartExport() {
  const c=state.chart, comp=state.comparison, clone=$('#cycle-chart').cloneNode(true);clone.querySelector('#chart-hitarea')?.remove();
  const css=getComputedStyle(document.documentElement), bg=css.getPropertyValue('--surface').trim(),fg=css.getPropertyValue('--text').trim(),muted=css.getPropertyValue('--muted').trim();
  const exportWidth=Math.max(c.width,600), scale=exportWidth/c.width, chartHeight=c.height*scale, footer=100;
  const legend=comp.series.filter(s=>!state.hidden.has(s.id)).map((s,i)=>`<circle cx="${28+i*(exportWidth-56)/comp.series.length}" cy="${chartHeight+103}" r="3" fill="${s.color}"/><text x="${38+i*(exportWidth-56)/comp.series.length}" y="${chartHeight+107}" fill="${muted}" font-size="10">${s.label}${s.current?' · current':''}${s.provisional?' · provisional':''}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${exportWidth}" height="${chartHeight+80+footer}" viewBox="0 0 ${exportWidth} ${chartHeight+80+footer}" font-family="Arial,sans-serif"><rect width="100%" height="100%" fill="${bg}"/><text x="28" y="35" fill="${fg}" font-size="20" font-weight="600">Bitcoin Cycles Comparison</text><text x="28" y="57" fill="${muted}" font-size="10">${state.mode.toUpperCase()} · ${state.unit==='indexed'?'BASE 100':'REBASED USD'} · ${state.scale.toUpperCase()} · As of ${comp.latest.date} UTC</text><g transform="translate(0,78) scale(${scale})">${clone.innerHTML}</g>${legend}<text x="28" y="${chartHeight+135}" fill="${muted}" font-size="9">Data: Coin Metrics · CC BY-NC 4.0 · UTC daily closing price</text><text x="28" y="${chartHeight+153}" fill="${muted}" font-size="9">Historical comparisons are not price forecasts. Historical paths end at D+1461.</text></svg>`;
}
$('#export-svg').addEventListener('click',()=>{if(!state.chart)return;download(`bitcoin-cycles-${state.mode}.svg`,new Blob([chartExport()],{type:'image/svg+xml;charset=utf-8'}));closeExport();toast('차트 SVG를 저장했습니다.');});
$('#export-png').addEventListener('click',async()=>{if(!state.chart)return;closeExport();try {const source=chartExport(),url=URL.createObjectURL(new Blob([source],{type:'image/svg+xml;charset=utf-8'})),img=new Image();try{await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});const canvas=document.createElement('canvas');canvas.width=img.width*2;canvas.height=img.height*2;const ctx=canvas.getContext('2d');ctx.scale(2,2);ctx.drawImage(img,0,0);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('PNG encoding failed');download(`bitcoin-cycles-${state.mode}.png`,blob);toast('차트 PNG를 저장했습니다.');}finally{URL.revokeObjectURL(url);}}catch{toast('이미지를 저장하지 못했습니다. SVG 저장을 이용해 주세요.');}});

let refreshing=false;
let checkingPublished=false,lastPublishedAttempt=Date.now();
async function refreshPublishedSnapshot() {
  if(checkingPublished||refreshing||!state.dataset||document.getElementById('embedded-btc-data')||!/^https?:$/.test(location.protocol)||!shouldCheckPublishedSnapshot(lastPublishedAttempt,Date.now(),document.visibilityState==='visible'))return;
  checkingPublished=true;lastPublishedAttempt=Date.now();
  const requestedDataset=state.dataset;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try {
    const response=await fetch('./data/btc-daily.json',{cache:'no-store',credentials:'omit',signal:controller.signal});
    if(!response.ok)throw new Error(`Published data HTTP ${response.status}`);
    const next=await response.json();
    // A manual refresh completed while this request was in flight. Keep its
    // source revision and model identity rather than publishing a stale reply.
    if(state.dataset!==requestedDataset)return;
    const result=inspectPublishedDataset(next,state.dataset);
    if(result.changed){
      state.dataset=next;
      try{localStorage.setItem('btc-cycles-daily-v1',JSON.stringify(next));}catch{}
      render();
    }
    const detail={status:'success',checkedAt:new Date().toISOString(),latestObservationDate:state.dataset.prices.at(-1)[0],source:'published-snapshot',observationsChanged:result.changed};
    document.dispatchEvent(new CustomEvent('atlas:data-update',{detail}));
    document.dispatchEvent(new CustomEvent('atlas:published-refresh',{detail}));
  }catch{/* Keep the verified data and its source cutoff; retry after the bounded interval. */}
  finally{clearTimeout(timer);checkingPublished=false;}
}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshPublishedSnapshot();});
window.addEventListener('focus',refreshPublishedSnapshot);
// A long-lived foreground tab follows the published data without downloading
// provider history on each pointer action or each midnight tick.
setInterval(refreshPublishedSnapshot,60*1000);
async function refreshData({quiet=false}={}) {
  if(refreshing)return;refreshing=true;const button=$('#refresh-button');button.disabled=true;button.classList.add('busy');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),22000);
  try{
    const next=await fetchLatestDataset({signal:controller.signal});validateDataset(next);
    if(state.dataset && next.prices.at(-1)[0]<state.dataset.prices.at(-1)[0])throw new Error('Provider returned an older dataset');
    const previousDate=state.dataset?.prices.at(-1)[0]; state.dataset=next;
    try{localStorage.setItem('btc-cycles-daily-v1',JSON.stringify(next));}catch{}
    render();
    document.dispatchEvent(new CustomEvent('atlas:data-update',{detail:{status:'success',checkedAt:new Date().toISOString(),latestObservationDate:next.prices.at(-1)[0]}}));
    button.title=`확인 완료: ${next.prices.at(-1)[0]} UTC`;
    if(!quiet)toast(next.prices.at(-1)[0]===previousDate?`최신 완료 관측은 ${previousDate} UTC입니다.`:`${next.prices.at(-1)[0]} UTC까지 데이터를 갱신했습니다.`);
  }catch(error){button.title='갱신에 실패했습니다. 검증된 이전 데이터를 표시합니다.';if(!quiet)toast(`갱신하지 못했습니다. ${state.dataset?.prices.at(-1)?.[0]||'저장된'} 기준 데이터를 유지합니다.`);}
  finally{clearTimeout(timer);refreshing=false;button.disabled=false;button.classList.remove('busy');}
}
$('#refresh-button').addEventListener('click',()=>{closeExport();refreshData();});
let dataResizeTimer;new ResizeObserver(()=>{clearTimeout(dataResizeTimer);dataResizeTimer=setTimeout(()=>{if(state.view==='data')renderData();},100);}).observe($('#data-view'));
let resizeTimer;new ResizeObserver(()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>renderChart(),100);}).observe($('#chart-stage'));
let researchResizeTimer;const researchObserver=new ResizeObserver(()=>{clearTimeout(researchResizeTimer);researchResizeTimer=setTimeout(()=>renderResearch(),100);});researchObserver.observe($('#forecast-chart-stage'));researchObserver.observe($('#peak-chart-stage'));
async function init() {
  try {
    const embedded=document.getElementById('embedded-btc-data');let bundled;if(embedded){bundled=JSON.parse(embedded.textContent);}else{const response=await fetch('./data/btc-daily.json',{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Bundled data unavailable');bundled=await response.json();}validateDataset(bundled);state.dataset=bundled;
    try{const cached=JSON.parse(localStorage.getItem('btc-cycles-daily-v1'));if(cached){validateDataset(cached);const latest=cached.prices.at(-1)[0],today=new Date().toISOString().slice(0,10);if(latest>=bundled.prices.at(-1)[0]&&latest<today&&cached.prices[0][0]===bundled.prices[0][0]&&cached.prices.length>=bundled.prices.length)state.dataset=cached;}}catch{}
    render();
    const today=new Date().toISOString().slice(0,10);if(utcDay(today)-utcDay(state.dataset.prices.at(-1)[0])>1)refreshData({quiet:true});
  } catch (error) {
    console.error('Initial dataset or page setup failed', error);
    document.dispatchEvent(new CustomEvent('atlas:boot-error'));
  }
}
init();
