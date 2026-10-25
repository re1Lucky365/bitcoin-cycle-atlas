import { buildCycleDecisionTable } from './cycle-decision.js?v=1.24.0';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const numeric = value => typeof value === 'number' && Number.isFinite(value);
const money = value => numeric(value) ? `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: value < 10 ? 4 : 2 })}` : '—';
const tone = value => !numeric(value) || Math.abs(value) < .005 ? 'flat' : value > 0 ? 'gain' : 'loss';
const scenarioRow = row => row.evidenceKind === 'scenario' || row.selectionKind === 'scenario' || row.kind === 'scenario' || row.kind === 'mixed';
const currentRow = row => row.evidenceKind === 'current' || row.current === true;
const actionId = row => row.action?.id || 'unavailable';
const evidenceLabel = row => row.evidenceLabel || (scenarioRow(row) ? row.kind === 'observed' ? '관측 가격 · 가정 기준' : '미래 가정' : currentRow(row) ? '현재 관측' : row.provisional ? '관측 · 잠정' : '과거 · 사후 해석');

export function formatDailyPercent(value, digits = 1) {
  if (!numeric(value)) return '—';
  const rounded = Math.abs(value) < .5 * 10 ** -digits ? 0 : value;
  return `${rounded > 0 ? '+' : rounded < 0 ? '−' : ''}${Math.abs(rounded).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
}

/** Select whole point-to-point rows; their displayed dates and metric baselines never change. */
export function cycleTableRows(model, { cycle = 'recent', evidence = 'all', allRanges = false } = {}) {
  if (!model) return [];
  const cutoff = new Date(`${model.asOf}T00:00:00Z`);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 4);
  const recentStart = cutoff.toISOString().slice(0, 10);
  const eligible = model.rows.filter(row => {
    if (evidence === 'observed' && scenarioRow(row)) return false;
    if (evidence === 'scenario' && !scenarioRow(row)) return false;
    if (cycle === 'recent') return scenarioRow(row) || row.endDate >= recentStart;
    return cycle === 'all' || (row.cycleIds || [row.cycleId]).includes(cycle);
  });
  if (allRanges) return eligible;
  const observedRanges = eligible.filter(row => row.phaseId === 'range' && !scenarioRow(row));
  const recentObserved = observedRanges.findLast(row => !row.rightCensored) || observedRanges.at(-1);
  const nextConditional = eligible.find(row => row.phaseId === 'range' && scenarioRow(row));
  return eligible.filter(row => row.phaseId !== 'range' || row === recentObserved || row === nextConditional);
}

function csvCell(value) {
  if (value == null || (typeof value === 'number' && !Number.isFinite(value))) return '';
  let text = String(value);
  if (typeof value !== 'number' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function cycleDecisionCsv(model, rows = model?.rows || [], metadata = {}) {
  const fields = [
    ['as_of', 'symbol', 'cycle', 'start_date', 'end_date', 'elapsed_days', 'elapsed_weeks', 'phase', 'review_stage', 'review_scope', 'reason', 'evidence', 'provisional', 'price_change_pct', 'period_mdd_pct', 'mdd_peak_date', 'mdd_trough_date', 'source', 'source_url', 'retrieved_at', 'scenario', 'interpretation'],
    ...rows.map(row => [model.asOf, 'BTC', row.cycleLabel, row.startDate, row.endDate, row.days, row.weeks, row.phaseLabel, row.action?.label, row.action?.scope || 'end-marker', row.action?.reason || row.reason, evidenceLabel(row), Boolean(row.provisional), row.returnPct, row.mddPct, row.mddPeakDate, row.mddTroughDate, metadata.sourceName || 'Coin Metrics', metadata.sourceUrl || '', metadata.retrievedAt || '', scenarioRow(row) ? metadata.scenarioLabel || '' : '', scenarioRow(row) ? 'conditional-scenario-not-a-probability' : currentRow(row) || row.action?.scope === 'period' ? 'observed-rule-not-a-trading-strategy' : 'retrospective-not-a-historical-trade-signal']),
  ];
  return '\uFEFF' + fields.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

function actionMarkup(row) {
  return `<span class="cycle-review cycle-review-${esc(actionId(row))}">${esc(row.action?.label || '판단 보류')}</span>`;
}
function duration(row) {
  return numeric(row.days) && row.days > 0 ? `${Math.round(row.days).toLocaleString('en-US')}일 · ${(row.weeks ?? row.days / 7).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}주` : '기간 계산 없음';
}
function periodMarkup(row, canSelect) {
  const endpoint = row.endDate || row.date || '—';
  const label = row.endLabel || row.markerLabel || row.phaseLabel || '기준점';
  const date = canSelect ? `<button type="button" class="cycle-point-link" data-cycle-row="${esc(row.id)}" aria-label="${esc(`${endpoint} ${label}, 차트에서 보기`)}">${esc(endpoint)}<span aria-hidden="true">↗</span></button>` : `<strong>${esc(endpoint)}</strong>`;
  return `<span class="cycle-mobile-point">${esc(row.phaseLabel)}<small>${esc(evidenceLabel(row))}</small></span>${date}<small>${row.startDate && row.startDate !== endpoint ? `${esc(row.startDate)}부터` : '해당 날짜의 기준점'}</small><span class="cycle-duration">${duration(row)}</span>`;
}

export function renderCycleTableRows(rows, { canSelect = false } = {}) {
  if (!rows.length) return '<tr><td colspan="5" class="cycle-table-empty">선택한 범위에 표시할 기준점이 없습니다.</td></tr>';
  return rows.map(row => {
    const assumed = scenarioRow(row), status = evidenceLabel(row);
    const metricLabel = assumed ? '가정 경로' : '관측 구간';
    const metrics = numeric(row.returnPct) || numeric(row.mddPct)
      ? `<span class="cycle-price-change cycle-number-${tone(row.returnPct)}">${formatDailyPercent(row.returnPct)}</span><small>${metricLabel} 가격 변화</small><span class="cycle-mdd" title="${esc(`${row.startDate || row.endDate} → ${row.endDate}의 시간순 고점 뒤 저점 기준. ${row.mddPeakDate || ''} → ${row.mddTroughDate || ''}`)}">최대 낙폭 <strong>${formatDailyPercent(row.mddPct)}</strong></span>`
      : `<span class="cycle-no-metric">—</span><small>${assumed ? '가정 기준 · 실현 성과 없음' : '비교 구간 없음'}</small>`;
    return `<tr class="cycle-period-row${assumed ? ' is-scenario' : ''}${currentRow(row) ? ' is-current' : ''}" data-cycle-row-id="${esc(row.id)}" data-evidence="${assumed ? 'scenario' : 'observed'}"><th scope="row" class="cycle-period">${periodMarkup(row, canSelect)}</th><td class="cycle-phase"><strong>${esc(row.phaseLabel || '기준점')}</strong><small>${row.fromLabel ? `${esc(row.fromLabel)} → ${esc(row.phaseLabel)}` : esc(row.cycleLabel || '')}</small><span class="cycle-evidence${assumed ? ' cycle-evidence-scenario' : ''}">${esc(status)}</span></td><td class="cycle-action-cell">${actionMarkup(row)}<small>${assumed ? '가정이 맞을 때 검토' : row.action?.scope === 'period' ? '표시 기간의 가격 조건' : currentRow(row) ? '관측 조건 기준' : '끝 지점의 사후 해석'}</small></td><td class="cycle-reason">${esc(row.action?.reason || row.reason || '')}${currentRow(row) && numeric(row.range28dPct) ? `<small>${esc(row.rangeWindowStart)}부터 28일 · 가격 폭 ${formatDailyPercent(row.range28dPct)} / 등락 ${formatDailyPercent(row.change28dPct)}</small>` : row.coverageComplete === false && numeric(row.mddPct) ? '<small>관측 누락 포함 · 실제 낙폭은 더 클 수 있음</small>' : row.note ? `<small>${esc(row.note)}</small>` : ''}</td><td class="cycle-metrics">${metrics}</td></tr>`;
  }).join('');
}

function frame() {
  return `<header class="daily-heading"><div><button type="button" class="daily-back" data-view="outlook">← 통합 차트</button><h1>사이클 판단표 <span>BTC · 시간과 구간</span></h1></div><div class="daily-heading-actions"><button type="button" class="daily-action" id="daily-method-open">읽는 법</button><button type="button" class="daily-action" id="export-raw" disabled>이 표 CSV ↓</button></div></header>
    <div class="cycle-context" id="cycle-context" aria-live="polite">차트의 관측 자료와 기준점을 확인하고 있습니다.</div>
    <section class="cycle-table-panel" aria-label="비트코인 사이클 기간과 검토 단계"><div class="cycle-table-toolbar"><label class="cycle-scope-label" for="cycle-scope">표시 범위<select id="cycle-scope"><option value="recent">최근 4년 기준점 + 가정</option><option value="all">전체 사이클</option></select></label><label class="cycle-detail-toggle"><input id="cycle-all-ranges" type="checkbox">세부 횡보 모두 보기</label><div class="daily-segmented" aria-label="관측과 미래 가정 구분"><button type="button" data-cycle-evidence="all" aria-pressed="true">전체</button><button type="button" data-cycle-evidence="observed" aria-pressed="false">과거·현재 관측</button><button type="button" data-cycle-evidence="scenario" aria-pressed="false">미래 가정</button></div></div>
    <div class="cycle-table-intro"><p id="cycle-table-note"><strong>고점·저점은 해당 시점, 횡보는 표시 기간의 검토 단계입니다.</strong> 과거 고점·저점은 사후 해석이며, 미래 행은 차트에서 선택한 가정입니다.</p><span id="cycle-scenario-label"></span></div>
    <div id="cycle-table-scroll" class="cycle-table-scroll" tabindex="0" role="region" aria-label="사이클 판단표, 작은 화면에서는 좌우로 이동"><table class="cycle-table" aria-describedby="cycle-table-note"><caption class="sr-only">비트코인 사이클 기준점별 기간, 검토 단계와 같은 구간의 가격 변화 및 최대 낙폭</caption><thead><tr><th scope="col">기준 지점 · 기간</th><th scope="col">사이클 구간</th><th scope="col">검토 단계</th><th scope="col">판단 근거</th><th scope="col">같은 구간의 가격 변화</th></tr></thead><tbody id="data-body"><tr><td colspan="5" class="cycle-table-empty">차트의 기준점을 불러오는 중입니다.</td></tr></tbody></table></div>
    <footer class="cycle-table-footer"><span id="cycle-row-count"></span><span>4년은 비교 틀입니다. ‘3년 상승 + 1년 하락’을 법칙으로 적용하지 않습니다.</span><a href="https://docs.coinmetrics.io/asset-metrics/market/priceusd" target="_blank" rel="noopener noreferrer">가격 출처 ↗</a></footer></section>
    <dialog class="daily-method-dialog" id="daily-method-dialog" aria-labelledby="daily-method-title"><div class="daily-method-heading"><h2 id="daily-method-title">사이클 판단표 읽는 법</h2><button type="button" id="daily-method-close" aria-label="읽는 법 닫기">×</button></div><div id="daily-method-content"></div></dialog>`;
}

export function initDailyDataView({ root, getBitcoinDataset, getCycleContext, onSelectCycleRow, download, toast = () => {}, buildModel = buildCycleDecisionTable } = {}) {
  if (!root || (typeof getBitcoinDataset !== 'function' && typeof getCycleContext !== 'function')) throw new TypeError('Cycle table needs a root and a chart data getter');
  const state = { cycle: 'recent', evidence: 'all', allRanges: false };
  let model = null, context = null, identity = null, disposed = false;
  root.classList.add('daily-workspace'); root.innerHTML = frame();
  const $ = selector => root.querySelector(selector);
  const $$ = selector => [...root.querySelectorAll(selector)];
  const put = (selector, markup) => { const node = $(selector); if (node.innerHTML !== markup) node.innerHTML = markup; };
  function metadata() {
    const meta = context?.dataset?.meta || {};
    return { sourceName: 'Coin Metrics', sourceUrl: meta.source || 'https://docs.coinmetrics.io/asset-metrics/market/priceusd', retrievedAt: meta.retrievedAt || '', scenarioLabel: context?.scenarioLabel || context?.scenarioId || '선택한 차트 가정' };
  }
  function paint() {
    if (disposed) return;
    const rows = cycleTableRows(model, state);
    put('#data-body', model ? renderCycleTableRows(rows, { canSelect: typeof onSelectCycleRow === 'function' }) : '<tr><td colspan="5" class="cycle-table-empty">차트의 검증된 기준점이 준비되면 이곳에 표시합니다.</td></tr>');
    $('#export-raw').disabled = !rows.length || typeof download !== 'function';
    $('#cycle-scope').disabled = !model;
    const fullCount = model ? cycleTableRows(model, { ...state, allRanges: true }).length : 0;
    $('#cycle-row-count').textContent = model ? `${rows.length}개 지점·구간${fullCount > rows.length ? ` · 횡보는 최근 관측·다음 가정 표시 (${fullCount - rows.length}개 더 보기)` : ''}` : '자료 확인 중';
    $('#cycle-all-ranges').checked = state.allRanges;
    $('#cycle-all-ranges').disabled = !model;
    $$('[data-cycle-evidence]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.cycleEvidence === state.evidence)));
    $('#cycle-scope').value = state.cycle;
  }
  function failContext(error) {
    model = null; context = null; identity = null;
    $('#cycle-context').textContent = '차트 자료와 기준점이 일치하지 않아 판단을 보류합니다. 자료를 다시 갱신해 주세요.';
    $('#cycle-context').title = String(error?.message || error);
    $('#cycle-scenario-label').textContent = '';
    paint();
  }
  function render() {
    if (disposed) return;
    let shared, dataset;
    try {
      shared = typeof getCycleContext === 'function' ? getCycleContext() : null;
      dataset = shared?.dataset || getBitcoinDataset?.();
    } catch (error) { failContext(error); return; }
    if (!shared?.milestones || !dataset) {
      model = null; context = null; identity = null;
      $('#cycle-context').textContent = '통합 차트와 같은 관측 자료·기준점이 준비되면 표시합니다.';
      $('#cycle-context').title = '';
      $('#cycle-scenario-label').textContent = '';
      paint(); return;
    }
    context = { ...shared, dataset };
    const key = [dataset, shared.prices, shared.milestones, shared.forecast];
    if (!identity || key.some((item, index) => item !== identity[index])) {
      try {
        model = buildModel({ prices: shared.prices || dataset.prices, milestones: shared.milestones, forecast: shared.forecast, asOf: shared.milestones.asOf });
        identity = key;
      } catch (error) { failContext(error); return; }
      const cycles = [...(model.cycles || []), ...(model.current ? [{ id: 'current', label: '현재 관측' }] : [])];
      if (!['recent', 'all'].includes(state.cycle) && !cycles.some(cycle => cycle.id === state.cycle)) state.cycle = 'recent';
      $('#cycle-scope').innerHTML = '<option value="recent">최근 4년 기준점 + 가정</option><option value="all">전체 사이클</option>' + cycles.map(cycle => `<option value="${esc(cycle.id)}">${esc(cycle.label)}</option>`).join('');
    }
    const latest = (shared.prices || dataset.prices).findLast(row => (Array.isArray(row) ? row[0] : row.date) <= model.asOf);
    const latestPrice = Array.isArray(latest) ? latest[1] : latest?.price;
    $('#cycle-context').innerHTML = `<span class="cycle-context-asset">₿ <strong>Bitcoin</strong></span><strong class="cycle-context-price">${money(latestPrice)}</strong><span>실제 관측 <strong>${esc(model.asOf)}</strong>까지</span>${model.current ? `<span class="cycle-context-stage">현재 ${actionMarkup(model.current)}</span>` : ''}<span class="cycle-context-definition">USD 일말 기준 · 고점·저점 확정 신호 아님</span>`;
    $('#cycle-context').title = `Coin Metrics · 수집 ${metadata().retrievedAt}`;
    $('#cycle-scenario-label').textContent = `차트의 선택 가정: ${metadata().scenarioLabel}`;
    paint();
  }
  function openMethod() {
    const info = metadata();
    $('#daily-method-content').innerHTML = `<h3>먼저 기준점을 읽습니다</h3><p>고점·저점 행은 차트의 기준점 하나와 그 앞 기준점부터의 기간을 연결합니다. <strong>매수·매도 검토는 그 행의 마지막 지점에 붙는 설명</strong>입니다. 횡보 행은 표시 기간에 가격 범위 조건이 연속 충족되었다는 별도 관측입니다. 앞 구간 전체에 같은 매매 지시가 발생했다는 뜻이 아닙니다. 날짜를 누르면 통합 차트에서 같은 기준점이나 구간을 확인합니다. 기본 표에서는 모든 고점·저점과 최근 관측 횡보·다음 가정 횡보를 남깁니다. ‘세부 횡보 모두 보기’를 선택하면 같은 표에서 나머지 횡보 구간을 확인할 수 있습니다.</p><h3>매수·횡보·매도와 강한 단계</h3><p>매수·매도는 사이클 위치에 따른 검토 방향입니다. 적극 단계는 설명한 기준점에 더 주의를 기울이라는 구분이며, 높은 수익 확률이나 큰 주문량을 뜻하지 않습니다. 지나고 나서 선택한 과거 저점·고점을 당시 실행할 수 있었던 매매 신호로 읽지 마세요.</p><p><strong>횡보는 관측된 가격 범위 조건을 충족한 경우에만 표시합니다.</strong> 중간 고점이나 기다려야 하는 구간을 자동으로 횡보라고 부르지 않습니다. 자료가 부족하거나 방향을 정할 근거가 없으면 판단을 보류합니다.</p><p>${esc(model?.methodology?.current || '')}</p><p>횡보 구간은 이 조건을 7개 일말 관측 이상 연속 충족한 기간입니다. 시작은 첫 조건 충족일이고, 7개 유지 여부는 일곱 번째 날에야 알 수 있습니다. 짧은 흔들림을 줄이는 표시 기준이며 최적 매매 기간이라는 뜻은 아닙니다. 미래 횡보는 선택한 경로 안의 가정입니다.</p><h3>관측·잠정·미래 가정</h3><p>‘과거 · 사후 해석’은 뒤의 가격까지 알고 선택한 기준점입니다. ‘관측 · 잠정’은 후속 자료에 따라 바뀔 수 있습니다. 점선으로 구분한 ‘미래 가정’은 현재 차트에서 선택한 가격 경로의 조건부 분류입니다. 발생 확률이나 확정된 미래 날짜가 아닙니다. 예측된 저점·고점을 실제 관측값과 섞어 계산하지 않습니다.</p><h3>같은 구간의 가격 변화와 최대 낙폭</h3><p>가격 변화 = (행 마지막 가격 ÷ 시작 가격 − 1) × 100. 최대 낙폭(MDD)은 <strong>이 행에 적힌 시작일부터 종료일까지</strong> 시간순 고점 이후의 가장 큰 일말 가격 하락입니다. 각 행마다 기준 기간이 달라집니다. 미래 가정에는 실제 성과처럼 관측 수익률·MDD를 붙이지 않습니다.</p><p>기간은 UTC 날짜 차이이며, 주 수는 일 수 ÷ 7입니다. 최근 4년 필터는 그 기간에 끝나는 기준점을 보여 줍니다. 앞 기준점이 4년보다 오래됐다면 표시된 전체 구간 그대로 계산하며, 필터 때문에 시작 가격을 바꾸지 않습니다. 결측은 보간하지 않습니다.</p><h3>4년은 비교 틀입니다</h3><p>반감기 간격과 가격 상승·하락 기간은 같은 개념이 아닙니다. ‘3년 상승 + 1년 하락’을 고정 규칙으로 강제하지 않으며, 시계만으로 매수·매도를 정하지 않습니다. BTC의 선택된 사이클을 다른 자산에 그대로 적용하지 않습니다.</p><h3>출처</h3><p><a href="${esc(info.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(info.sourceName)} PriceUSD ↗</a> · USD 일말 기준가격 · 장중 고저가 아님<br>최근 완료 관측 ${esc(model?.asOf || '확인 중')} · 수집 ${esc(info.retrievedAt || '확인 중')}<br>Coin Metrics · CC BY-NC 4.0</p>`;
    const dialog = $('#daily-method-dialog');
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
  }
  function closeMethod() { const dialog = $('#daily-method-dialog'); if (typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open'); }
  function click(event) {
    const evidence = event.target.closest?.('[data-cycle-evidence]');
    if (evidence) { state.evidence = evidence.dataset.cycleEvidence; paint(); return; }
    const selected = event.target.closest?.('[data-cycle-row]');
    if (selected) {
      const row = model?.rows.find(item => item.id === selected.dataset.cycleRow);
      if (row && typeof onSelectCycleRow === 'function') onSelectCycleRow(row);
      return;
    }
    const id = event.target.closest?.('button')?.id;
    if (id === 'daily-method-open') openMethod();
    if (id === 'daily-method-close') closeMethod();
    if (id === 'export-raw' && model && typeof download === 'function') {
      const rows = cycleTableRows(model, state);
      if (!rows.length) return;
      download(`btc-cycle-review-${model.asOf}-${state.cycle}-${state.evidence}${state.allRanges ? '-all-ranges' : ''}.csv`, new Blob([cycleDecisionCsv(model, rows, metadata())], { type: 'text/csv;charset=utf-8' }));
      toast('표시 중인 기준점·검토 근거·관측 구분을 저장했습니다.');
    }
  }
  function change(event) {
    if (event.target.id === 'cycle-scope') { state.cycle = event.target.value; paint(); }
    if (event.target.id === 'cycle-all-ranges') { state.allRanges = Boolean(event.target.checked); paint(); }
  }
  root.addEventListener('click', click); root.addEventListener('change', change);
  return { render, destroy() { disposed = true; root.removeEventListener('click', click); root.removeEventListener('change', change); closeMethod(); } };
}
