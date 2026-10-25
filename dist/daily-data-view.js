import { analyzeDailySeries } from './daily-analytics.js?v=1.23.0';
import { bitcoinDailyAsset, loadDailyAsset } from './daily-data-source.js?v=1.22.0';

const ASSETS = ['BTC', 'ETH', 'MSTR', 'BMNR'];
const NAMES = { BTC: '비트코인', ETH: '이더리움', MSTR: '스트래티지', BMNR: '비트마인' };
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const numeric = value => typeof value === 'number' && Number.isFinite(value);
const count = value => Number(value).toLocaleString('en-US');
const price = value => numeric(value) ? `$${value.toLocaleString('en-US', { maximumFractionDigits: value < 10 ? 6 : 2, minimumFractionDigits: 2 })}` : '—';
const number = value => numeric(value) ? value.toFixed(1) : '—';
const tone = value => !numeric(value) || Math.abs(value) < 0.005 ? 'flat' : value > 0 ? 'gain' : 'loss';
const signalMarkup = signal => `<span class="daily-signal daily-signal-${esc(signal?.key || 'unavailable')}" title="${esc(signal?.reason || '지표 계산에 필요한 관측이 부족합니다.')}">${esc(signal?.label || '자료 부족')}</span>`;

export function formatDailyPercent(value, digits = 2) {
  if (!numeric(value)) return '—';
  const rounded = Math.abs(value) < 0.5 * 10 ** -digits ? 0 : value;
  return `${rounded > 0 ? '+' : rounded < 0 ? '−' : ''}${Math.abs(rounded).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
}

export function dailyTableRows(analysis, { year = 'all', month = 'all' } = {}) {
  return (analysis?.rows || []).filter(row => (year === 'all' || row.date.slice(0, 4) === String(year)) && (month === 'all' || Number(row.date.slice(5, 7)) === Number(month))).slice().reverse();
}

function csvCell(value) {
  if (value == null || (typeof value === 'number' && !Number.isFinite(value))) return '';
  let text = String(value);
  if (typeof value !== 'number' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
const csv = rows => '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';

export function dailyDataCsv(asset, analysis, filters = {}) {
  const rows = dailyTableRows(analysis, filters);
  return csv([
    ['date', 'symbol', 'price_usd', 'change_pct', 'ytd_pct', 'ytd_partial', 'drawdown_pct', 'mdd_to_date_pct', 'recovery_needed_pct', 'sma_50', 'sma_200', 'rsi_14', 'signal', 'signal_reason', 'signal_status', 'timezone', 'source', 'source_url', 'price_definition', 'retrieved_at', 'license'],
    ...rows.map(row => [row.date, asset.symbol, row.price, row.changePct, row.ytdPct, row.ytdPartial, row.drawdownPct, row.mddToDatePct, row.recoveryPct, row.sma50, row.sma200, row.rsi14, row.signal?.label, row.signal?.reason, 'heuristic-not-backtested', asset.timezone, asset.sourceName, asset.sourceUrl, asset.priceNote, asset.retrievedAt, asset.license]),
  ]);
}

export function annualDataCsv(entries, years) {
  return csv([
    ['symbol', 'year', 'return_pct', 'period_mdd_pct', 'baseline_date', 'first_observation', 'last_observation', 'partial_period', 'coverage_complete', 'mdd_peak_date', 'mdd_trough_date', 'source', 'price_definition', 'retrieved_at', 'license'],
    ...ASSETS.flatMap(symbol => {
      const entry = entries.get ? entries.get(symbol) : entries[symbol];
      if (!entry?.analysis) return [];
      return entry.analysis.annual.filter(period => years.includes(period.year)).map(period => [symbol, period.year, period.returnPct, period.mddPct, period.baselineDate, period.startDate, period.endDate, period.partial, period.coverageComplete, period.peakDate, period.troughDate, entry.asset.sourceName, entry.asset.priceNote, entry.asset.retrievedAt, entry.asset.license]);
    }),
  ]);
}

function heatCell(period, { metric, symbol, year, month } = {}) {
  if (!period) return '<td class="daily-heat daily-heat-empty" title="이 기간에 관측 자료가 없습니다.">—</td>';
  const value = metric === 'mdd' ? period.mddPct : period.returnPct;
  const span = `${period.baselineDate || period.startDate} → ${period.endDate}`;
  const notes = [metric === 'mdd' ? '기간 내 종가 MDD' : '가격 수익률', span, period.partial ? '부분기간' : '', period.coverageComplete === false ? '결측 포함 · 관측치 기준' : '', metric === 'mdd' ? `${period.peakDate || '—'} 고점 → ${period.troughDate || '—'} 저점` : ''].filter(Boolean).join(' · ');
  const intensity = numeric(value) ? Math.min(0.44, 0.09 + Math.log1p(Math.abs(value)) * 0.055).toFixed(3) : '0';
  return `<td class="daily-heat daily-heat-${tone(value)}" style="--heat-alpha:${intensity}"><button type="button" data-daily-period data-symbol="${esc(symbol)}" data-year="${year}"${month ? ` data-month="${month}"` : ''} title="${esc(notes)}" aria-label="${esc(`${symbol} ${year}년${month ? ` ${month}월` : ''} ${formatDailyPercent(value)}. ${notes}. 일별 자료 보기`)}">${formatDailyPercent(value, 1)}${period.partial || period.coverageComplete === false ? '<sup>*</sup>' : ''}</button></td>`;
}

export function renderAnnualDataTable(entries, years, { selected = 'BTC', metric = 'return' } = {}) {
  const get = symbol => entries.get ? entries.get(symbol) : entries[symbol];
  const latestYear = Math.max(...ASSETS.map(symbol => Number(get(symbol)?.asset?.asOfDate?.slice(0, 4)) || 0));
  const head = `<thead><tr><th scope="col" class="daily-sticky">자산</th>${years.map(year => `<th scope="col"${year === latestYear ? ' class="daily-current-year"' : ''}>${year}${year === latestYear ? '<small>YTD</small>' : ''}</th>`).join('')}<th scope="col" class="daily-total-head">전체 누적</th><th scope="col">전체 CAGR</th><th scope="col">전체 MDD</th></tr></thead>`;
  const body = ASSETS.map(symbol => {
    const entry = get(symbol), asset = entry?.asset, analysis = entry?.analysis;
    const identity = `<th scope="row" class="daily-sticky"><button type="button" data-daily-asset="${symbol}" aria-pressed="${selected === symbol}"><span class="daily-asset-mark daily-asset-${symbol.toLowerCase()}">${symbol === 'BTC' ? '₿' : symbol === 'ETH' ? 'Ξ' : symbol[0]}</span><span><strong>${symbol}</strong><small>${NAMES[symbol]}</small></span></button></th>`;
    if (!analysis) return `<tr${selected === symbol ? ' class="daily-selected-row"' : ''}>${identity}<td colspan="${years.length + 3}" class="daily-load-state">${entry?.error ? '자료를 불러오지 못했습니다. ' + `<button type="button" data-daily-retry="${symbol}">다시 시도</button>` : '검증된 일별 자료 불러오는 중…'}</td></tr>`;
    const periods = new Map(analysis.annual.map(period => [period.year, period]));
    const summary = analysis.summary, fullRange = `${summary.firstDate} → ${summary.lastDate} · 각 자산의 전체 관측 이력`;
    const cells = years.map(year => heatCell(periods.get(year), { metric, symbol, year })).join('');
    const totals = [summary.cumulativeReturnPct, summary.cagrPct, summary.mddPct].map((value, index) => `<td class="daily-total daily-number-${tone(value)}" title="${esc(`${fullRange}${index === 1 ? ' · 실제 경과일 기준 복리 연율. 1년 미만은 계산하지 않습니다.' : index === 2 ? ` · ${summary.mddPeakDate} 고점 → ${summary.mddTroughDate} 저점 · 종가 기준` : ''}`)}">${formatDailyPercent(value, 1)}</td>`).join('');
    return `<tr${selected === symbol ? ' class="daily-selected-row"' : ''}>${identity}${cells}${totals}</tr>`;
  }).join('');
  return `${head}<tbody>${body}</tbody>`;
}

export function renderMonthlyDataTable(asset, analysis, { metric = 'return', year = 'all' } = {}) {
  const years = [...new Set(analysis.monthly.map(period => period.year))].filter(value => year === 'all' || String(value) === String(year)).reverse();
  const periods = new Map(analysis.monthly.map(period => [`${period.year}-${period.month}`, period]));
  const annual = new Map(analysis.annual.map(period => [period.year, period]));
  return `<thead><tr><th class="daily-sticky" scope="col">연도</th>${Array.from({ length: 12 }, (_, index) => `<th scope="col">${index + 1}월</th>`).join('')}<th scope="col">연간${metric === 'mdd' ? ' MDD' : ''}</th></tr></thead><tbody>${years.map(value => `<tr><th scope="row" class="daily-sticky">${value}</th>${Array.from({ length: 12 }, (_, index) => heatCell(periods.get(`${value}-${index + 1}`), { metric, symbol: asset.symbol, year: value, month: index + 1 })).join('')}${heatCell(annual.get(value), { metric, symbol: asset.symbol, year: value })}</tr>`).join('')}</tbody>`;
}

function frame() {
  return `<header class="daily-heading"><div><button type="button" class="daily-back" data-view="outlook">← 통합 차트</button><h1>일별 원자료 <span>수익률 · 낙폭 · 추세</span></h1></div><div class="daily-heading-actions"><button type="button" class="daily-action" id="daily-method-open">계산 기준</button><button type="button" class="daily-action" id="export-raw">일별 CSV ↓</button></div></header>
    <section class="daily-comparison" aria-labelledby="daily-comparison-title"><div class="daily-section-heading"><button type="button" id="daily-comparison-toggle" aria-expanded="true" aria-controls="daily-comparison-content"><span id="daily-comparison-title">자산별 연간 비교</span><span class="daily-chevron">⌄</span></button><div class="daily-comparison-controls"><label class="sr-only" for="daily-scope">연간 비교 표시 범위</label><select id="daily-scope"><option value="2011">2011년부터</option><option value="all">전체 이력</option></select><div class="daily-segmented" aria-label="비교 지표"><button type="button" data-daily-metric="return" aria-pressed="true">수익률</button><button type="button" data-daily-metric="mdd" aria-pressed="false">MDD</button></div><button type="button" id="daily-export-annual" class="daily-action" title="표시한 연도의 자산별 수익률과 MDD CSV">비교 CSV ↓</button></div></div><div id="daily-comparison-content"><div class="daily-heat-scroll" tabindex="0" role="region" aria-label="자산별 연간 수익률 비교, 좌우로 스크롤"><table class="daily-heat-table" id="daily-annual-table"></table></div><div class="daily-comparison-foot"><span id="daily-comparison-note">셀을 누르면 해당 기간의 일별 자료를 확인합니다.</span><span class="daily-color-key"><i class="daily-key-gain"></i>수익 + <i class="daily-key-loss"></i>수익 − / 낙폭</span></div></div></section>
    <div id="data-summary" class="daily-summary" aria-live="polite"></div>
    <section class="daily-detail" aria-label="선택 자산 상세 원자료"><div class="daily-detail-toolbar"><div class="daily-asset-tabs" aria-label="원자료 자산">${ASSETS.map(symbol => `<button type="button" data-daily-asset="${symbol}" aria-pressed="${symbol === 'BTC'}">${symbol}</button>`).join('')}</div><div class="daily-segmented" aria-label="원자료 표시 방식"><button type="button" data-daily-detail="daily" aria-pressed="true">일별 상세</button><button type="button" data-daily-detail="monthly" aria-pressed="false">월별 비교</button></div><div class="daily-filters"><label for="data-year">연도</label><select id="data-year"><option value="all">전체 연도</option></select><label for="daily-month" class="sr-only">조회 월</label><select id="daily-month"><option value="all">전체 월</option>${Array.from({ length: 12 }, (_, index) => `<option value="${index + 1}">${index + 1}월</option>`).join('')}</select><span id="data-result-count"></span></div></div>
    <div id="daily-source-line" class="daily-source-line"></div><div class="daily-signal-key"><span>신호</span><span class="daily-signal daily-signal-buy">매수</span><span class="daily-signal daily-signal-neutral">중립</span><span class="daily-signal daily-signal-sell">매도</span><span>규칙 기반 참고 · 성과 미검증</span></div>
    <div id="daily-table-scroll" class="daily-table-scroll" tabindex="0" role="region" aria-label="일별 원자료, 좌우로 스크롤"><table class="daily-table"><thead><tr><th class="daily-sticky" id="daily-date-heading" scope="col">일자 · UTC</th><th scope="col">가격 · USD</th><th id="daily-change-heading" scope="col">전일 대비</th><th scope="col">연초 대비</th><th scope="col" title="해당 날짜까지의 최고 종가 대비 현재 가격 하락률">전고점 대비</th><th scope="col" title="첫 관측일부터 해당 날짜까지 발생한 최대 종가 낙폭">당시까지 MDD</th><th scope="col" title="50개 관측 단순이동평균">SMA 50</th><th scope="col" title="200개 관측 단순이동평균">SMA 200</th><th scope="col">RSI 14</th><th scope="col">규칙 신호</th></tr></thead><tbody id="data-body"></tbody></table></div>
    <div id="daily-monthly-scroll" class="daily-monthly-scroll" tabindex="0" role="region" aria-label="선택 자산 월별 수익률 비교, 좌우로 스크롤" hidden><table class="daily-heat-table" id="daily-monthly-table"></table></div>
    <footer class="daily-pagination" id="daily-pagination"><span id="data-page-label"></span><div><button type="button" id="data-prev" class="daily-action">이전</button><button type="button" id="data-next" class="daily-action">다음</button></div></footer></section>
    <dialog class="daily-method-dialog" id="daily-method-dialog" aria-labelledby="daily-method-title"><div class="daily-method-heading"><h2 id="daily-method-title">숫자와 색상을 읽는 법</h2><button type="button" id="daily-method-close" aria-label="계산 기준 닫기">×</button></div><div id="daily-method-content"></div></dialog>`;
}

export function initDailyDataView({ root, getBitcoinDataset, download, toast = () => {}, loadAsset = loadDailyAsset } = {}) {
  if (!root || typeof getBitcoinDataset !== 'function') throw new TypeError('Daily data needs a root and a Bitcoin dataset getter');
  const params = new URLSearchParams(root.ownerDocument?.defaultView?.location?.search || globalThis.location?.search || '');
  const requested = params.get('data-asset')?.toUpperCase();
  const state = { selected: ASSETS.includes(requested) ? requested : 'BTC', scope: '2011', metric: 'return', detail: 'daily', year: 'all', month: 'all', page: 0, collapsed: false };
  const entries = new Map(ASSETS.map(symbol => [symbol, { status: 'idle' }]));
  let btcIdentity = null, started = false, disposed = false, currentYears = [], rowLimit = 10;
  root.classList.add('daily-workspace'); root.innerHTML = frame();
  const $ = selector => root.querySelector(selector);
  const $$ = selector => [...root.querySelectorAll(selector)];

  function analyzed(asset) {
    return { status: 'ready', asset, analysis: analyzeDailySeries(asset.prices, { calendar: asset.calendar, asOfDate: asset.asOfDate, symbol: asset.symbol, missingDates: asset.missingDates || [] }) };
  }
  function selectedEntry() { return entries.get(state.selected); }
  function allYears() {
    const values = ASSETS.flatMap(symbol => entries.get(symbol).analysis?.annual.map(period => period.year) || []);
    if (!values.length) return [];
    const min = state.scope === '2011' ? Math.max(2011, Math.min(...values)) : Math.min(...values), max = Math.max(...values);
    if (min > max) return [];
    return Array.from({ length: max - min + 1 }, (_, index) => min + index);
  }
  function syncButtons() {
    $$('[data-daily-asset]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.dailyAsset === state.selected)));
    $$('[data-daily-detail]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.dailyDetail === state.detail)));
    $$('[data-daily-metric]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.dailyMetric === state.metric)));
    $('#daily-table-scroll').hidden = state.detail !== 'daily'; $('#daily-monthly-scroll').hidden = state.detail !== 'monthly';
    $('#daily-pagination').hidden = state.detail !== 'daily'; $('#daily-month').hidden = state.detail !== 'daily';
    $('#daily-comparison-content').hidden = state.collapsed; $('#daily-comparison-toggle').setAttribute('aria-expanded', String(!state.collapsed));
  }
  function paintSummary(entry) {
    if (!entry?.analysis) { $('#data-summary').innerHTML = `<div class="daily-summary-loading">${state.selected} ${entry?.error ? '자료를 불러오지 못했습니다.' : '자료 확인 중…'}</div>`; return; }
    const { asset, analysis } = entry, summary = analysis.summary, latest = analysis.rows.at(-1);
    $('#data-summary').innerHTML = `<div class="daily-summary-price"><label>${esc(asset.symbol)} · ${summary.lastDate}</label><strong>${price(latest.price)}</strong><small>${summary.firstDate}부터 ${count(summary.count)}개 관측</small></div><div><label>전체 이력 누적</label><strong class="daily-number-${tone(summary.cumulativeReturnPct)}">${formatDailyPercent(summary.cumulativeReturnPct, 1)}</strong><small>CAGR ${formatDailyPercent(summary.cagrPct, 1)}</small></div><div title="${esc(`${summary.mddPeakDate} 고점 → ${summary.mddTroughDate} 저점 · 종가 기준`)}"><label>전체 이력 MDD</label><strong class="daily-number-loss">${formatDailyPercent(summary.mddPct, 1)}</strong><small>${summary.mddPeakDate} → ${summary.mddTroughDate}</small></div><div><label>현재 전고점 대비</label><strong class="daily-number-${tone(summary.drawdownPct)}">${formatDailyPercent(summary.drawdownPct, 1)}</strong><small>회복 필요 ${formatDailyPercent(summary.recoveryPct, 1)}</small></div><div class="daily-summary-signal"><label>최근 규칙 신호</label><strong>${signalMarkup(latest.signal)}</strong><small title="${esc(latest.signal?.reason)}">SMA 50 / 200 · RSI 14</small></div>`;
  }
  function paintDetail(entry) {
    const available = Boolean(entry?.analysis);
    $('#export-raw').disabled = !available; $('#data-year').disabled = !available; $('#daily-month').disabled = !available;
    if (!available) {
      $('#data-body').innerHTML = `<tr><td colspan="10" class="daily-empty">${state.selected} ${entry?.error ? '자료를 불러오지 못했습니다. 연간 비교표의 다시 시도를 이용해 주세요.' : '일별 자료를 불러오는 중입니다.'}</td></tr>`;
      $('#daily-monthly-table').innerHTML = ''; $('#daily-source-line').textContent = '완료된 실제 관측만 표시합니다.'; $('#data-result-count').textContent = ''; $('#data-page-label').textContent = ''; $('#data-prev').disabled = true; $('#data-next').disabled = true; return;
    }
    const { asset, analysis } = entry;
    const years = [...new Set(analysis.rows.map(row => row.date.slice(0, 4)))].reverse();
    if (state.year !== 'all' && !years.includes(String(state.year))) { state.year = 'all'; state.month = 'all'; state.page = 0; }
    $('#data-year').innerHTML = '<option value="all">전체 연도</option>' + years.map(year => `<option value="${year}">${year}년</option>`).join('');
    $('#data-year').value = state.year; $('#daily-month').value = state.month;
    const filtered = dailyTableRows(analysis, state);
    rowLimit = Math.max(3, Math.min(100, Math.floor(($('#daily-table-scroll').clientHeight - 34) / 34) || 10));
    const pageCount = Math.max(1, Math.ceil(filtered.length / rowLimit)); state.page = Math.min(pageCount - 1, Math.max(0, state.page));
    const shown = filtered.slice(state.page * rowLimit, (state.page + 1) * rowLimit);
    $('#data-body').innerHTML = shown.length ? shown.map(row => `<tr><th scope="row" class="daily-sticky">${row.date}</th><td>${price(row.price)}</td><td class="daily-cell-${tone(row.changePct)}">${formatDailyPercent(row.changePct)}</td><td class="daily-cell-${tone(row.ytdPct)}"${row.ytdPartial ? ' title="전년말 기준가격이 없어 첫 관측일부터 계산한 부분기간 수익률입니다."' : ''}>${formatDailyPercent(row.ytdPct)}${row.ytdPartial ? '<sup>*</sup>' : ''}</td><td class="daily-cell-${tone(row.drawdownPct)}" title="${esc(row.peakDate)}까지의 최고 종가 기준">${formatDailyPercent(row.drawdownPct)}</td><td class="daily-cell-${tone(row.mddToDatePct)}">${formatDailyPercent(row.mddToDatePct)}</td><td>${price(row.sma50)}</td><td>${price(row.sma200)}</td><td>${number(row.rsi14)}</td><td class="daily-signal-cell">${signalMarkup(row.signal)}</td></tr>`).join('') : '<tr><td colspan="10" class="daily-empty">선택한 기간에 관측 자료가 없습니다.</td></tr>';
    $('#data-result-count').textContent = `${count(filtered.length)}개 관측`;
    $('#data-page-label').textContent = `${state.page + 1} / ${count(pageCount)} 페이지 · 최근순 · ${rowLimit}행`;
    $('#data-prev').disabled = state.page === 0; $('#data-next').disabled = state.page === pageCount - 1;
    $('#daily-date-heading').textContent = asset.calendar === 'sessions' ? '거래일 · 뉴욕' : '일자 · UTC';
    $('#daily-change-heading').textContent = asset.calendar === 'sessions' ? '전 거래일 대비' : '전일 대비';
    const gapNote = analysis.summary.missingDayCount ? ` · 결측 ${count(analysis.summary.missingDayCount)}일, MDD는 관측치 기준` : '';
    $('#daily-source-line').innerHTML = `<a href="${esc(asset.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(asset.sourceName)} ↗</a><span>${esc(asset.priceNote)}${gapNote}</span><span title="${esc(asset.retrievedAt)}">${esc(analysis.summary.lastDate)}까지</span>`;
    $('#daily-source-line').title = `${asset.coverageNote || ''} · ${asset.timezone} · 수집 ${asset.retrievedAt} · ${asset.license || ''}`;
    // Paging the daily table must not rebuild hundreds of hidden heatmap cells.
    // Opening monthly mode always paints from the latest asset/filter/metric.
    if (state.detail === 'monthly') $('#daily-monthly-table').innerHTML = renderMonthlyDataTable(asset, analysis, state);
  }
  function paint() {
    if (disposed) return;
    currentYears = allYears();
    $('#daily-annual-table').innerHTML = renderAnnualDataTable(entries, currentYears, state);
    $('#daily-comparison-note').textContent = `${state.metric === 'mdd' ? '연내 MDD' : '가격 수익률'} · * 부분기간 / 결측 · 요약 3열은 각 자산의 전체 이력 · 셀을 눌러 일별 확인`;
    paintSummary(selectedEntry()); syncButtons(); paintDetail(selectedEntry());
  }
  async function fetchAssets(symbols) {
    for (const symbol of symbols) entries.set(symbol, { status: 'loading' });
    paint();
    await Promise.allSettled(symbols.map(async symbol => {
      try {
        const entry = analyzed(await loadAsset(symbol));
        if (!disposed) entries.set(symbol, entry);
      } catch (error) {
        if (!disposed) entries.set(symbol, { status: 'error', error: String(error?.message || error) });
      }
      if (!disposed) paint();
    }));
  }
  function render() {
    if (disposed) return;
    const dataset = getBitcoinDataset();
    if (dataset && dataset !== btcIdentity) {
      try { entries.set('BTC', analyzed(bitcoinDailyAsset(dataset))); btcIdentity = dataset; }
      catch (error) { entries.set('BTC', { status: 'error', error: error.message }); }
    }
    paint();
    if (!started) { started = true; void fetchAssets(ASSETS.filter(symbol => symbol !== 'BTC')); }
  }
  function chooseAsset(symbol, { reset = true } = {}) {
    if (!ASSETS.includes(symbol)) return;
    state.selected = symbol; state.page = 0;
    if (reset) { state.year = 'all'; state.month = 'all'; }
  }
  function exportDaily() {
    const entry = selectedEntry(); if (!entry?.analysis || typeof download !== 'function') return;
    const suffix = `${state.year}${state.month === 'all' ? '' : '-' + state.month.padStart(2, '0')}`;
    download(`${state.selected.toLowerCase()}-daily-${suffix}.csv`, new Blob([dailyDataCsv(entry.asset, entry.analysis, state)], { type: 'text/csv;charset=utf-8' }));
    toast('선택 기간의 원가격·계산지표·출처를 저장했습니다.');
  }
  function openMethod() {
    const sourceRows = ASSETS.map(symbol => {
      const entry = entries.get(symbol);
      if (!entry.analysis) return `<li><strong>${symbol}</strong> · ${entry.error ? '자료 불러오기 실패' : '불러오는 중'}</li>`;
      const { asset, analysis } = entry;
      return `<li><strong>${symbol}</strong> · ${analysis.summary.firstDate} – ${analysis.summary.lastDate}<br>${esc(asset.priceNote)} · ${esc(asset.timezone)}<br>${esc(asset.coverageNote || '')}<br><a href="${esc(asset.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(asset.sourceName)} ↗</a> · 수집 ${esc(asset.retrievedAt)} · ${esc(asset.license || '')}</li>`;
    }).join('');
    $('#daily-method-content').innerHTML = `<h3>수익률과 기간</h3><p>연간·월간 수익률 = (기간 마지막 가격 ÷ 직전 기간 마지막 가격 − 1) × 100. 직전 기준가격이 없는 첫 기간은 첫 관측부터 계산한 부분기간(*)입니다. 올해는 마지막 완료 관측까지의 YTD입니다. 셀을 누르면 실제 일별 값을 확인할 수 있습니다.</p><p>오른쪽 누적·CAGR·MDD와 요약 카드는 각 자산의 <strong>전체 관측 이력</strong>입니다. 2011년부터 보기나 아래 연도 필터를 바꿔도 전체 이력 기준을 유지합니다. 각 자산의 시작일이 다르므로 같은 투자기간의 순위로 읽지 마세요.</p><p>CAGR = [(마지막 가격 ÷ 첫 가격)<sup>365.2425 / 경과일</sup> − 1] × 100. 실제 경과일이 1년 미만이면 표시하지 않습니다. 주식은 분할조정 종가이며 배당 재투자 총수익률이 아닙니다. 암호화폐 역시 수수료·세금·스테이킹 보상을 포함하지 않습니다.</p><h3>낙폭과 회복 필요 수익률</h3><p>전고점 대비 = (현재 가격 ÷ 그날까지 최고 가격 − 1) × 100. MDD는 시간순으로 앞선 고점에서 이후 저점까지의 가장 큰 하락입니다. 연내·월내 MDD는 기간 시작 기준가격부터 계산합니다. 일별 표의 ‘당시까지 MDD’는 첫 관측부터 그날까지입니다. 회복 필요 수익률 = (1 ÷ (1 + 낙폭 / 100) − 1) × 100.</p><p>모두 종가 기준이며 장중 낙폭과 다릅니다. 결측을 보간하지 않습니다. 관측이 빠졌으면 MDD는 관측치 기준이고 실제 낙폭은 더 클 수 있습니다.</p><h3>색상과 규칙 신호</h3><p>수익률 셀의 초록은 양수, 빨강은 음수입니다. 낙폭은 빨강으로 표시합니다. 색의 진하기는 절댓값의 크기를 읽기 쉽게 나타낸 것이며 매매 확률이 아닙니다.</p><p><strong>매수</strong> · 가격 &gt; SMA 200, SMA 50 &gt; SMA 200, 50 ≤ RSI 14 &lt; 70.<br><strong>매도</strong> · 가격 &lt; SMA 200, SMA 50 &lt; SMA 200, RSI 14 &lt; 50.<br><strong>중립</strong> · 그 외 조건. <strong>자료 부족</strong> · 200개 연속 관측을 채우지 못했거나 결측으로 지표가 재시작된 구간.</p><p>신호는 해당 날짜까지의 관측만 사용한 앱의 추세 규칙입니다. 신호가 표시된 종가에 체결됐다고 가정하지 않습니다. 수익성·적중률을 검증한 전략이 아니며 미래 가격을 보장하지 않습니다. 큰 하락폭 자체를 매수 근거로 쓰지 않습니다. 주식의 SMA는 거래 세션, 암호화폐의 SMA는 일별 관측 기준입니다.</p><h3>실제 자료와 출처</h3><ul>${sourceRows}</ul><p><a href="https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/RSI" target="_blank" rel="noopener noreferrer">Fidelity RSI 정의 ↗</a> · <a href="https://docs.cdp.coinbase.com/api-reference/exchange-api/rest-api/products/get-product-candles" target="_blank" rel="noopener noreferrer">Coinbase 일봉 정의 ↗</a> · <a href="https://docs.coinmetrics.io/asset-metrics/market/priceusd" target="_blank" rel="noopener noreferrer">Coin Metrics 가격 정의 ↗</a></p>`;
    const dialog = $('#daily-method-dialog');
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
  }
  function closeMethod() { const dialog = $('#daily-method-dialog'); if (typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open'); }
  function click(event) {
    const period = event.target.closest?.('[data-daily-period]');
    if (period) { chooseAsset(period.dataset.symbol, { reset: false }); state.year = String(period.dataset.year); state.month = period.dataset.month || 'all'; state.detail = 'daily'; paint(); return; }
    const asset = event.target.closest?.('[data-daily-asset]');
    if (asset) { chooseAsset(asset.dataset.dailyAsset); paint(); return; }
    const metric = event.target.closest?.('[data-daily-metric]');
    if (metric) { state.metric = metric.dataset.dailyMetric; paint(); return; }
    const detail = event.target.closest?.('[data-daily-detail]');
    if (detail) { state.detail = detail.dataset.dailyDetail; if (state.detail === 'monthly') state.month = 'all'; paint(); return; }
    const retry = event.target.closest?.('[data-daily-retry]');
    if (retry) { if (retry.dataset.dailyRetry === 'BTC') { btcIdentity = null; render(); } else void fetchAssets([retry.dataset.dailyRetry]); return; }
    const id = event.target.closest?.('button')?.id;
    if (id === 'data-prev') { state.page--; paintDetail(selectedEntry()); }
    if (id === 'data-next') { state.page++; paintDetail(selectedEntry()); }
    if (id === 'daily-comparison-toggle') { state.collapsed = !state.collapsed; syncButtons(); paintDetail(selectedEntry()); }
    if (id === 'export-raw') exportDaily();
    if (id === 'daily-export-annual' && typeof download === 'function') { download(`asset-annual-${state.scope}.csv`, new Blob([annualDataCsv(entries, currentYears)], { type: 'text/csv;charset=utf-8' })); toast('표시 연도의 수익률·MDD·기준일·출처를 저장했습니다.'); }
    if (id === 'daily-method-open') openMethod();
    if (id === 'daily-method-close') closeMethod();
  }
  function change(event) {
    if (event.target.id === 'data-year') { state.year = event.target.value; state.month = 'all'; state.page = 0; }
    if (event.target.id === 'daily-month') { state.month = event.target.value; state.page = 0; }
    if (event.target.id === 'daily-scope') state.scope = event.target.value;
    paint();
  }
  root.addEventListener('click', click); root.addEventListener('change', change);
  return { render, destroy() { disposed = true; root.removeEventListener('click', click); root.removeEventListener('change', change); closeMethod(); } };
}
