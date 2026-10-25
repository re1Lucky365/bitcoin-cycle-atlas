import { buildAssetComparison } from './asset-comparison.js?v=1.26.0';

const SYMBOLS = ['BTC', 'SPY', 'QQQ', 'NVDA', 'AAPL', 'GOOG', 'MSFT', 'AMZN', 'META', 'AVGO', 'PLTR', 'TSLA', 'HOOD', 'TLT', 'IEF', 'GLD', 'SLV', 'PDBC'];
const LABELS = { 'strong-buy': '적극 매수', buy: '분할 매수', neutral: '중립', sell: '분할 매도', 'strong-sell': '적극 매도' };
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const numeric = value => typeof value === 'number' && Number.isFinite(value);
const price = value => numeric(value) && value > 0 ? value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: value < 1 ? 4 : 2 }) : '—';
const tone = value => !numeric(value) || Math.abs(value) < .005 ? 'flat' : value > 0 ? 'gain' : 'loss';
const displayDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.replaceAll('-', '.') : '확인 중';
const today = () => new Date().toISOString().slice(0, 10);

export function formatDailyPercent(value, digits = 2) {
  if (!numeric(value)) return '—';
  const rounded = Math.abs(value) < .5 * 10 ** -digits ? 0 : value;
  return `${rounded > 0 ? '+' : rounded < 0 ? '−' : ''}${Math.abs(rounded).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
}

function judgment(row) {
  const result = row.judgment;
  // An incomplete model must never turn unavailable data into a neutral or buy/sell badge.
  if (result?.available === true && LABELS[result.id] === result.label && Number.isInteger(row.sampleYears) && row.sampleYears >= 5 && numeric(row.meanRisePct) && row.meanRisePct > 0 && numeric(row.meanFallPct) && row.meanFallPct < 0 && numeric(row.ytdPct) && row.coverage?.complete !== false) return result;
  return { id: 'unavailable', label: '판단 보류', reason: result?.available === false && result.reason ? result.reason : '표본 또는 계산 조건이 충분하지 않아 판단을 보류합니다.', available: false };
}

function sampleDescription(row) {
  if (!row.sampleYears) return '이전 연도의 유효한 관측 표본이 없습니다.';
  const years = `${row.sampleStartYear}–${row.sampleEndYear} · ${row.sampleYears}개 연도`;
  return `${years}${row.samplePartialFirstYear ? ` · 첫해는 ${row.firstPartialStartDate || row.source?.firstDate || row.sampleStartYear}부터의 일부 기간` : ''} · 올해 제외`;
}

function safeUrl(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
}

function sourceLink(row) {
  const source = row.source || {}, href = safeUrl(source.url);
  return href ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(source.name || '가격 출처')} ↗</a>` : esc(source.name || '출처 확인 필요');
}

function sharedDate(rows, key) {
  const dates = new Set(rows.map(row => row[key]).filter(Boolean));
  return dates.size === 1 && rows.every(row => row[key]) ? [...dates][0] : null;
}

/** This is one row per asset, without filtering, pagination, or a second summary table. */
export function renderAssetComparisonRows(rows = []) {
  if (!rows.length) return '<tr><td colspan="10" class="asset-table-empty">표시할 자산 자료가 없습니다.</td></tr>';
  const mixedStart = !sharedDate(rows, 'yearStartDate'), mixedLatest = !sharedDate(rows, 'latestDate');
  return rows.map((row, index) => {
    const firstInGroup = index === 0 || rows[index - 1].group !== row.group;
    let groupCell = '';
    if (firstInGroup) {
      let count = 1;
      while (rows[index + count]?.group === row.group) count++;
      const words = String(row.group || '분류 없음').replace(/^(위험|안전)\s*자산$/, '$1 자산').split(' ');
      groupCell = `<th scope="rowgroup" rowspan="${count}" class="asset-group">${words.map(word => `<span>${esc(word)}</span>`).join('')}</th>`;
    }
    const decision = judgment(row);
    const dateNote = (date, mixed) => mixed && date ? `<small class="asset-cell-date">${esc(displayDate(date))}</small>` : '';
    return `<tr data-asset-symbol="${esc(row.symbol)}"${firstInGroup ? ' class="asset-group-start"' : ''}>${groupCell}<td class="asset-category">${esc(row.category)}</td><th scope="row" class="asset-name">${esc(row.name)} <span>(${esc(row.symbol)})</span></th><td class="asset-samples" title="${esc(sampleDescription(row))}" aria-label="${esc(sampleDescription(row))}">${Number.isInteger(row.sampleYears) ? row.sampleYears : '—'}${row.samplePartialFirstYear ? '<sup aria-hidden="true">*</sup>' : ''}</td><td class="asset-return asset-return-${tone(row.meanRisePct)}" title="과거 각 연도의 첫 거래일 종가 대비 연중 최고 종가 상승률을 같은 비중으로 평균">${formatDailyPercent(row.meanRisePct)}</td><td class="asset-return asset-return-${tone(row.meanFallPct)}" title="과거 각 연도의 첫 거래일 종가 대비 연중 최저 종가 낙폭을 같은 비중으로 평균 · MDD 아님">${formatDailyPercent(row.meanFallPct)}</td><td class="asset-price" title="${esc(`${row.yearStartDate || '관측 없음'} · ${row.currency || 'USD'} · 올해 첫 거래일 종가`)}">${price(row.yearStartPrice)}${dateNote(row.yearStartDate, mixedStart)}</td><td class="asset-price asset-latest" title="${esc(`${row.latestDate || '관측 없음'} · ${row.currency || 'USD'} · 최근 관측 종가`)}">${price(row.latestPrice)}${dateNote(row.latestDate, mixedLatest)}</td><td class="asset-return asset-ytd asset-return-${tone(row.ytdPct)}" title="${esc(`${row.yearStartDate || '—'} → ${row.latestDate || '—'} · (최근 종가 ÷ 연초 종가 − 1) × 100`)}">${formatDailyPercent(row.ytdPct)}</td><td class="asset-judgment-cell"><button type="button" class="asset-judgment asset-judgment-${decision.id}" data-asset-reason="${esc(row.symbol)}" title="${esc(decision.reason)}" aria-label="${esc(`${row.name} ${decision.label}: ${decision.reason}`)}">${decision.label}</button></td></tr>`;
  }).join('');
}

function csvCell(value) {
  if (value == null || (typeof value === 'number' && !Number.isFinite(value))) return '';
  let text = String(value);
  if (typeof value !== 'number' && (/^[\u0000-\u0020]*[=+\-@]/.test(text) || /^[\t\r]/.test(text))) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function assetComparisonCsv(model) {
  const fields = [
    ['comparison_as_of', 'comparison_year', 'group', 'category', 'symbol', 'name', 'currency', 'sample_years', 'sample_start_year', 'sample_end_year', 'partial_first_year', 'first_partial_start_date', 'mean_annual_rise_pct', 'mean_annual_fall_pct_not_mdd', 'year_start_date', 'year_start_close', 'latest_date', 'latest_close', 'year_to_date_pct', 'judgment', 'judgment_reason', 'judgment_available', 'strong_buy_threshold_pct', 'buy_threshold_pct', 'sell_threshold_pct', 'strong_sell_threshold_pct', 'coverage_status', 'coverage_issues', 'source', 'source_url', 'price_definition', 'retrieved_at', 'historical_average_method', 'interpretation'],
    ...(model?.rows || []).map(row => {
      const decision = judgment(row), thresholds = row.judgment?.thresholds || {}, source = row.source || {};
      return [model.asOf, model.year, row.group, row.category, row.symbol, row.name, row.currency || 'USD', row.sampleYears, row.sampleStartYear, row.sampleEndYear, Boolean(row.samplePartialFirstYear), row.firstPartialStartDate, row.meanRisePct, row.meanFallPct, row.yearStartDate, row.yearStartPrice, row.latestDate, row.latestPrice, row.ytdPct, decision.label, decision.reason, decision.available, thresholds.strongBuyPct, thresholds.buyPct, thresholds.sellPct, thresholds.strongSellPct, row.coverage?.status, (row.coverage?.issues || []).join(' | '), source.name, source.url, source.priceDefinition, source.retrievedAt, 'equal-weight prior-calendar-year max/min close versus first-session close; current year excluded; listing partial year disclosed', 'descriptive historical-range rule; not a probability or position size'];
    }),
  ];
  return '\uFEFF' + fields.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

function frame() {
  return `<header class="daily-heading"><button type="button" class="daily-back" data-view="outlook" aria-label="통합 차트로 돌아가기" title="통합 차트로 돌아가기"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20 12H4m6-6-6 6 6 6"/></svg></button><div class="daily-heading-title"><h1>자산 비교표</h1><span class="daily-board-label" lang="en">MARKET BOARD</span></div><div class="daily-heading-actions"><button type="button" class="daily-action" id="asset-refresh" aria-label="가격 자료 갱신" title="가격 자료 갱신"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20 7v5h-5M4 17v-5h5m10-2a7 7 0 0 0-12-4l-3 3m16 6-3 3a7 7 0 0 1-12-4"/></svg><span>갱신</span></button><button type="button" class="daily-action" id="daily-method-open" aria-label="자산 비교표 읽는 법" title="자산 비교표 읽는 법"><span class="daily-help-icon" aria-hidden="true">?</span><span>읽는 법</span></button><button type="button" class="daily-action" id="export-raw" aria-label="18개 자산 CSV 내려받기" title="18개 자산 CSV 내려받기" disabled><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/></svg><span>CSV</span></button></div></header>
    <div class="asset-context" id="asset-context" role="status" aria-live="polite">자산 비교표를 열면 가격 자료를 불러옵니다.</div>
    <p class="asset-scroll-hint" id="asset-scroll-hint">좌우로 밀어 수치와 맨 끝 판단을 확인하세요.</p>
    <section class="asset-table-panel" aria-label="18개 자산의 과거 상승·낙폭과 올해 판단"><div class="asset-table-scroll" id="asset-table-scroll" tabindex="0" role="region" aria-describedby="asset-scroll-hint" aria-label="자산 비교표. 작은 화면에서는 좌우로 이동할 수 있습니다."><table class="asset-comparison-table" aria-describedby="asset-table-note"><caption class="sr-only">18개 자산별 과거 연간 평균 상승률과 연초 대비 낙폭, 올해 종가와 등락률, 다섯 단계 판단</caption><colgroup><col class="asset-col-group"><col class="asset-col-category"><col class="asset-col-name"><col class="asset-col-samples"><col class="asset-col-return"><col class="asset-col-return"><col class="asset-col-price"><col class="asset-col-price"><col class="asset-col-ytd"><col class="asset-col-judgment"></colgroup><thead><tr><th colspan="3" scope="colgroup" class="asset-identity-header">종목명</th><th scope="col" class="asset-mobile-header asset-mobile-group-header">자산군</th><th scope="col" class="asset-mobile-header">분류</th><th scope="col" class="asset-mobile-header asset-mobile-name-header">종목명</th><th scope="col">표본<br>연수</th><th scope="col">평균<br>상승률</th><th scope="col">평균<br>낙폭</th><th scope="col" id="asset-start-header">연초 종가<small>기준일 확인 중</small></th><th scope="col" id="asset-latest-header">최근 종가<small>기준일 확인 중</small></th><th scope="col" class="asset-ytd-header" id="asset-ytd-header">연초 대비<br>상승·하락률</th><th scope="col" class="asset-judgment-header">판단</th></tr></thead><tbody id="data-body"><tr><td colspan="10" class="asset-table-empty">자산별 가격 자료를 준비하고 있습니다.</td></tr></tbody></table></div>
    <footer class="asset-table-footer"><div class="asset-table-meta"><span id="asset-row-count">18개 자산</span><span>배당·분배금 제외 종가 기준 · USD</span><span class="asset-color-key"><i class="asset-key-gain" aria-hidden="true"></i>상승 <i class="asset-key-loss" aria-hidden="true"></i>하락</span></div><p id="asset-table-note">평균 낙폭은 연초 종가 대비 연중 최저 낙폭이며 <strong>MDD가 아닙니다.</strong> 판단은 과거 평균과 올해 등락률을 비교한 규칙입니다. <span id="asset-sample-note">올해는 평균에서 제외합니다.</span></p></footer></section>
    <dialog class="daily-method-dialog" id="daily-method-dialog" aria-labelledby="daily-method-title"><div class="daily-method-heading"><h2 id="daily-method-title">자산 비교표 읽는 법</h2><button type="button" id="daily-method-close" aria-label="읽는 법 닫기">×</button></div><div id="daily-method-content"></div></dialog>`;
}

function assertModel(model) {
  if (!model || !Array.isArray(model.rows) || model.rows.length !== SYMBOLS.length || new Set(model.rows.map(row => row.symbol)).size !== SYMBOLS.length || SYMBOLS.some(symbol => !model.rows.some(row => row.symbol === symbol))) throw new TypeError('18개 자산의 계산 결과가 모두 필요합니다.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(model.asOf) || !Number.isInteger(model.year)) throw new TypeError('비교 기준일이 올바르지 않습니다.');
}

/** A single lazy source, one cached model per UTC date, and explicit retry after failure. */
export function initDailyDataView({ root, getComparisonDataset, download, toast = () => {}, buildModel = buildAssetComparison, asOfDate = today } = {}) {
  if (!root || typeof getComparisonDataset !== 'function') throw new TypeError('Asset comparison needs a root and a dataset getter');
  const state = { status: 'idle', asOf: null, error: null };
  let bundle = null, model = null, pending = null, request = 0, disposed = false;
  root.classList.add('daily-workspace'); root.innerHTML = frame();
  const $ = selector => root.querySelector(selector);
  const put = (selector, markup) => { const node = $(selector); if (node.innerHTML !== markup) node.innerHTML = markup; };
  const text = (selector, value) => { const node = $(selector); if (node.textContent !== value) node.textContent = value; };

  function clearRows(message, canRetry = false) {
    put('#data-body', `<tr><td colspan="10" class="asset-table-empty"><span>${esc(message)}</span>${canRetry ? '<button type="button" id="asset-retry">다시 불러오기</button>' : ''}</td></tr>`);
    $('#export-raw').disabled = true;
    $('#asset-refresh').disabled = state.status === 'loading';
    put('#asset-start-header', '연초 종가<small>기준일 확인 중</small>');
    put('#asset-latest-header', '최근 종가<small>기준일 확인 중</small>');
    put('#asset-ytd-header', '연초 대비<br>상승·하락률');
    text('#asset-row-count', canRetry ? '자료 확인 필요' : '18개 자산 · 자료 준비 중');
    text('#asset-sample-note', '올해는 평균에서 제외합니다.');
    if ($('#daily-method-dialog').open) put('#daily-method-content', methodContent());
  }

  function methodContent(selected) {
    const rows = model?.rows || [];
    const selectedDecision = selected ? judgment(selected) : null;
    const thresholds = selected?.judgment?.thresholds;
    const boundaries = thresholds && ['strongBuyPct', 'buyPct', 'sellPct', 'strongSellPct'].every(key => numeric(thresholds[key]))
      ? `<ul class="asset-method-rules asset-selected-thresholds"><li><strong>적극 매수</strong> · ${formatDailyPercent(thresholds.strongBuyPct)} 이하</li><li><strong>분할 매수</strong> · ${formatDailyPercent(thresholds.strongBuyPct)} 초과, ${formatDailyPercent(thresholds.buyPct)} 이하</li><li><strong>중립</strong> · ${formatDailyPercent(thresholds.buyPct)} 초과, ${formatDailyPercent(thresholds.sellPct)} 미만</li><li><strong>분할 매도</strong> · ${formatDailyPercent(thresholds.sellPct)} 이상, ${formatDailyPercent(thresholds.strongSellPct)} 미만</li><li><strong>적극 매도</strong> · ${formatDailyPercent(thresholds.strongSellPct)} 이상</li></ul><p>표시는 소수 둘째 자리로 반올림하며 실제 판단은 반올림 전 경계값으로 계산합니다.</p>` : '';
    const selectedNote = selected ? `<section class="asset-selected-reason"><h3>${esc(selected.name)} (${esc(selected.symbol)}) · ${selectedDecision.label}</h3><p>${esc(selectedDecision.reason)}</p><p>올해 등락률 ${formatDailyPercent(selected.ytdPct)} · 과거 평균 상승 ${formatDailyPercent(selected.meanRisePct)} · 평균 낙폭 ${formatDailyPercent(selected.meanFallPct)}</p>${boundaries}<p>${sourceLink(selected)} · ${esc(selected.yearStartDate || '기준일 없음')} → ${esc(selected.latestDate || '관측 없음')}<br>${esc(sampleDescription(selected))}</p></section>` : '';
    return `${selectedNote}<h3>평균 상승률과 평균 낙폭</h3><p>과거 각 연도의 <strong>첫 거래일 종가를 0%</strong>로 둡니다. 그해 가장 높은 종가까지의 상승률과 가장 낮은 종가까지의 낙폭을 구한 뒤, 연도별 값을 같은 비중으로 평균합니다. 올해 자료는 이 평균에 넣지 않습니다. 장중 고가·저가와 연말 수익률의 평균이 아닙니다.</p><p>연간 상승률 = (연중 최고 종가 ÷ 첫 거래일 종가 − 1) × 100<br>연간 낙폭 = (연중 최저 종가 ÷ 첫 거래일 종가 − 1) × 100</p><h3>평균 낙폭과 MDD는 다릅니다</h3><p>이 표의 평균 낙폭은 <strong>각 연도의 시작 가격을 고정</strong>합니다. MDD는 시간순으로 갱신되는 고점 이후의 최대 하락을 측정합니다. 예를 들어 종가가 100 → 150 → 120이면 이 표의 연간 낙폭은 0%, 그해 MDD는 −20%입니다. 둘을 같은 값으로 표시하지 않습니다.</p><h3>마지막 열의 다섯 단계</h3><p>올해 등락률을 <strong>r</strong>, 과거 평균 상승률을 <strong>U</strong>, 평균 낙폭을 <strong>D</strong>라고 합니다. D는 음수입니다.</p><ul class="asset-method-rules"><li><strong>적극 매수</strong> · r ≤ D</li><li><strong>분할 매수</strong> · D &lt; r ≤ D ÷ 2</li><li><strong>중립</strong> · D ÷ 2 &lt; r &lt; U ÷ 2</li><li><strong>분할 매도</strong> · U ÷ 2 ≤ r &lt; U</li><li><strong>적극 매도</strong> · r ≥ U</li></ul><p>과거 평균 범위 안에서 올해 가격이 어디에 있는지 구분하는 <strong>비교 규칙</strong>입니다. 확률을 추정하거나 미래의 저점·고점을 확정하지 않으며, 적극·분할이라는 이름이 주문 금액을 정하지 않습니다. 중립도 횡보가 확인됐다는 뜻은 아닙니다. 초록·붉은색 수익률 수치은 상승·하락 방향을 뜻하고, 매수·매도 구분은 마지막 열에서 읽습니다.</p><h3>표본 연수와 판단 보류</h3><p>표본 연수는 올해 이전에 실제 관측된 연도 수입니다. <strong>*는 상장 첫해 일부 기간이 포함</strong>되었다는 표시입니다. 표본 셀에서 기간을 확인할 수 있고, 아래 종목별 출처에도 표시합니다. 5개 연도 미만, 누락되거나 오래된 자료, 비교할 수 없는 평균값은 판단 보류로 남깁니다. 결측값을 0이나 중립으로 채우지 않습니다.</p><h3>가격과 기준일</h3><p>모든 가격은 USD 종가입니다. BTC는 UTC 달력일(주말·윤일 포함), 주식·ETF는 뉴욕 거래일을 사용하므로 연초 기준일이 다를 수 있습니다. 주식분할을 반영하고 배당·분배금을 제외한 종가 기준이므로 총수익률과 다를 수 있습니다. 배당·분배금 지급에 따른 가격 하락도 포함됩니다. 특히 PDBC처럼 큰 분배금이 있는 자산의 낙폭은 분배금을 합친 투자 손실과 다를 수 있습니다. 이 판단을 총수익률이나 수익성 검증으로 해석하지 않습니다. 연초 종가는 올해 첫 거래일 종가이며 전년 마지막 거래일 종가가 아닙니다. 최근 종가는 자료에 포함된 마지막 거래일의 관측값입니다. 종목별 날짜가 다르면 해당 가격 셀에도 기준일을 표시합니다.</p><details class="asset-source-details"><summary>종목별 출처·표본 범위${rows.length ? ` (${rows.length}개)` : ''}</summary>${rows.length ? `<ul>${rows.map(row => `<li><strong>${esc(row.symbol)} · ${esc(row.name)}</strong><br>${sourceLink(row)} · ${esc(sampleDescription(row))}<br>관측 ${esc(row.source?.firstDate || '확인 중')} → ${esc(row.latestDate || '관측 없음')} · 수집 ${esc(row.source?.retrievedAt || bundle?.retrievedAt || '확인 중')}<br>${esc(row.source?.priceDefinition || '가격 정의 확인 필요')}${judgment(row).available ? '' : `<br><span class="asset-source-issue">${esc(judgment(row).reason)}</span>`}</li>`).join('')}</ul>` : '<p>자료를 불러오면 종목별 출처와 실제 관측 범위가 표시됩니다.</p>'}</details>`;
  }

  function paint() {
    const rows = model.rows, start = sharedDate(rows, 'yearStartDate'), latest = sharedDate(rows, 'latestDate');
    const unavailable = rows.filter(row => !judgment(row).available).length;
    const sources = [...new Set(rows.map(row => row.source?.name).filter(Boolean))];
    put('#data-body', renderAssetComparisonRows(rows));
    put('#asset-start-header', `연초 종가<small>${start ? esc(displayDate(start)) : '종목별 기준일'}</small>`);
    put('#asset-latest-header', `최근 종가<small>${latest ? esc(displayDate(latest)) : '종목별 기준일'}</small>`);
    put('#asset-ytd-header', `${model.year}년<br>연초 대비 등락률`);
    put('#asset-context', `<strong>${rows.length}개 자산</strong><span>${model.year}년 비교</span><span>최근 관측 ${latest ? esc(displayDate(latest)) : '종목별 기준일'}</span><span class="asset-context-source">${esc(sources.join(' · ') || '출처 확인 필요')} · USD 종가</span>`);
    $('#asset-context').title = `판단 기준일 ${model.asOf} · 수집 ${bundle?.retrievedAt || '종목별 출처 참조'}`;
    text('#asset-row-count', `${rows.length}개 자산 전체${unavailable ? ` · ${unavailable}개 판단 보류` : ''}`);
    text('#asset-sample-note', `${model.year}년은 평균에서 제외${rows.some(row => row.samplePartialFirstYear) ? ' · * 상장 첫해 일부 기간 포함' : ''}.`);
    $('#export-raw').disabled = typeof download !== 'function';
    $('#asset-refresh').disabled = false;
    $('#asset-table-scroll').setAttribute('aria-busy', 'false');
    if ($('#daily-method-dialog').open) put('#daily-method-content', methodContent());
  }

  function fail(error, date) {
    model = null; bundle = null;
    state.status = 'error'; state.asOf = date; state.error = String(error?.message || error);
    text('#asset-context', '가격 자료를 불러오거나 검증하지 못했습니다. 다시 불러오기를 눌러 주세요.');
    $('#asset-context').title = state.error;
    $('#asset-table-scroll').setAttribute('aria-busy', 'false');
    clearRows('자료를 확인할 수 없어 가격과 판단을 표시하지 않습니다.', true);
    if ($('#daily-method-dialog').open) put('#daily-method-content', methodContent());
  }

  function render({ refresh = false } = {}) {
    if (disposed || root.hidden) return Promise.resolve(null);
    let date;
    try {
      date = typeof asOfDate === 'function' ? asOfDate() : asOfDate;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) throw new TypeError('비교 기준일이 올바르지 않습니다.');
    } catch (error) { request++; pending = null; fail(error, null); return Promise.resolve(null); }
    if (refresh || (pending && state.asOf !== date)) { request++; pending = null; model = null; if (refresh) bundle = null; state.status = 'idle'; }
    if (pending) return pending;
    if (state.status === 'ready' && state.asOf === date) return Promise.resolve(model);
    if (state.status === 'error' && state.asOf === date && !refresh) return Promise.resolve(null);
    const token = ++request;
    model = null; state.status = 'loading'; state.asOf = date; state.error = null;
    text('#asset-context', '18개 자산의 실제 가격 자료와 표본 연수를 확인하고 있습니다.');
    $('#asset-context').title = '';
    $('#asset-table-scroll').setAttribute('aria-busy', 'true');
    clearRows('자산별 가격 자료를 불러오는 중입니다.');
    pending = (async () => {
      await Promise.resolve();
      if (disposed || token !== request) return null;
      try {
        const loaded = bundle || await getComparisonDataset();
        if (disposed || token !== request) return null;
        const calculated = await buildModel(loaded, { asOfDate: date });
        if (disposed || token !== request) return null;
        assertModel(calculated);
        bundle = loaded; model = calculated; state.status = 'ready';
        paint();
        return model;
      } catch (error) {
        if (!disposed && token === request) fail(error, date);
        return null;
      } finally { if (token === request) pending = null; }
    })();
    return pending;
  }

  function openMethod(selected) {
    put('#daily-method-content', methodContent(selected));
    const dialog = $('#daily-method-dialog');
    if (dialog.open) return;
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
  }
  function closeMethod() { const dialog = $('#daily-method-dialog'); if (typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open'); }
  function click(event) {
    if (disposed) return;
    const reason = event.target.closest?.('[data-asset-reason]');
    if (reason) { const selected = model?.rows.find(row => row.symbol === reason.dataset.assetReason); if (selected) openMethod(selected); return; }
    const id = event.target.closest?.('button')?.id;
    if (id === 'asset-refresh') { if (state.status !== 'loading') void render({ refresh: true }); return; }
    if (id === 'asset-retry') { void render({ refresh: true }); return; }
    if (id === 'daily-method-open') openMethod();
    if (id === 'daily-method-close') closeMethod();
    if (id === 'export-raw' && state.status === 'ready' && model && typeof download === 'function') {
      download(`asset-comparison-${model.asOf}.csv`, new Blob([assetComparisonCsv(model)], { type: 'text/csv;charset=utf-8' }));
      toast('18개 자산의 수치·판단 근거·기준일·출처를 저장했습니다.');
    }
  }
  root.addEventListener('click', click);
  return { render, refresh: () => render({ refresh: true }), get state() { return { ...state }; }, destroy() { disposed = true; request++; pending = null; model = null; bundle = null; root.removeEventListener('click', click); closeMethod(); } };
}
