import { ETHEREUM_EVENTS, ETHEREUM_EVENT_CATEGORIES, ETHEREUM_EVENT_COLORS, ETHEREUM_EVENTS_REVIEW_DATE, getEthereumEvents } from './ethereum-events.js?v=1.17.0-context.1';
import { observeEthereumEvent } from './ethereum-event-observations.js?v=1.17.0-context.1';
import { mountDialogViewport } from './dialog-viewport.js?v=1.14.0-mobile.1';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const daySeconds = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0,10) === value ? time / 1000 : NaN;
};
const DAY = 86400;
const isCategory = value => value === 'all' || Object.hasOwn(ETHEREUM_EVENT_CATEGORIES, value);
const money = new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2});

export function ethereumHistoryList({category='all',query='',year='all',order='desc'}={}) {
  if (year !== 'all' && (typeof year !== 'string' || !/^\d{4}$/.test(year) || Number(year) < Number(ETHEREUM_EVENTS[0].date.slice(0,4)) || Number(year) > Number(ETHEREUM_EVENTS_REVIEW_DATE.slice(0,4)))) throw new RangeError('Invalid Ethereum history year');
  if (!['asc','desc'].includes(order)) throw new RangeError('Invalid Ethereum history order');
  const events = getEthereumEvents({category,query,...(year === 'all' ? {} : {startDate:`${year}-01-01`,endDate:`${year}-12-31`})});
  return events.sort((a,b)=>(order === 'asc' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)) || a.id.localeCompare(b.id));
}

function observationMarkup(event, series) {
  if (!series) return '';
  const observed = observeEthereumEvent(event,series);
  const reasons = {'outside-coverage':'관측 구간 부족','missing-day':'누락 일봉 포함','invalid-date':'날짜 확인 필요','invalid-data':'자료 확인 필요',unavailable:'일봉 자료 없음'};
  const cards = observed.windows.map(window => {
    const ready = window.status === 'observed';
    const value = ready ? `${window.changePct > 0 ? '+' : window.changePct < 0 ? '−' : ''}${Math.abs(window.changePct).toFixed(2)}%` : '—';
    return `<div class="eth-history-observation" data-event-observation-window="${window.days}"><span>${window.days === 1 ? '사건일' : `${window.days}일 구간`}</span><strong>${value}</strong><small>${ready ? `${esc(window.endDate)} 종가<br>${money.format(window.endClose)}` : esc(reasons[window.status])}</small></div>`;
  }).join('');
  return `<section class="eth-history-observations" aria-label="사건 날짜 주변의 실제 ETH 일봉"><h4>주변 가격 기록 <span>Coinbase · ETH-USD</span></h4>
    <p class="eth-history-observation-basis">${observed.baselineClose === null ? '사건 전일의 완료 종가가 없는 구간은 계산하지 않습니다.' : `기준: ${esc(observed.baselineDate)} UTC 종가 ${money.format(observed.baselineClose)}`}</p>
    <div class="eth-history-observation-grid">${cards}</div>
    <p class="eth-history-observation-note">사건 날짜를 포함한 1·3·7일 구간을 전일 종가와 비교합니다. 가격은 같은 달력 날짜의 UTC 완료 일봉 기준이며, 원문의 현지 날짜와 24시간 범위가 다를 수 있습니다. 발표 직후의 수익률이나 사건만의 가격 효과를 뜻하지 않습니다. 누락된 일봉은 보간하지 않습니다.</p></section>`;
}

export function readEthereumEventSettings(params) {
  return {visible:params.get('eth-events') !== 'off', category:isCategory(params.get('eth-event-category')) ? params.get('eth-event-category') : 'all'};
}

export function ethereumEventQuery(query, settings) {
  const params = new URLSearchParams(query);
  params.delete('eth-events');params.delete('eth-event-category');
  if (settings.visible === false) params.set('eth-events','off');
  if (isCategory(settings.category) && settings.category !== 'all') params.set('eth-event-category',settings.category);
  return params.toString();
}

/** Focus a calendar event on observed daily data. A pre-price event never
 * acquires an invented price or a clamped, misleading date on the chart. */
export function ethereumEventRange(event, series) {
  if (!event || series?.interval !== 'daily' || !series.candles?.length) return null;
  const time = daySeconds(event.date), first = series.candles[0].time, last = series.candles.at(-1).time;
  if (!Number.isFinite(time) || time < first || time > last) return null;
  const min = first - DAY, max = last + DAY, span = Math.min(181 * DAY, max - min);
  const start = Math.max(min, Math.min(time - 90 * DAY, max - span));
  return {unit:'seconds', start, end:start+span, min, max, step:DAY, minSpan:Math.min(12,Math.round((max-min)/DAY)+1), contextKey:`ETH-USD:daily:${series.retrievedAt}`};
}

export function ethereumEventDetailMarkup(event, {firstDate=null, lastDate=null, dailySeries=null}={}) {
  if (!event) return '<p class="eth-history-placeholder">사건을 선택하면 날짜 근거와 확인한 원문을 볼 수 있습니다.</p>';
  const before = firstDate && event.date < firstDate, after = lastDate && event.date > lastDate;
  const available = Boolean(firstDate && lastDate && !before && !after);
  const note = before ? `가격 자료 시작일(${firstDate}) 이전 사건입니다. 목록과 원문으로 확인할 수 있습니다.` : after ? '현재 저장된 완료 일봉 이후 사건입니다. 가격 데이터를 갱신한 뒤 확인해 주세요.' : !firstDate ? '일봉 가격 자료가 준비되면 차트에서 해당 날짜를 볼 수 있습니다.' : '날짜 표식의 높이는 주변 완료 봉의 종가에 맞춥니다. 사건 발생 순간의 체결 가격을 뜻하지 않습니다.';
  const sources = event.sources.map(source => {
    let safe = false;try { safe = new URL(source.url).protocol === 'https:'; } catch {}
    const title = safe ? `<a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.title)} ↗</a>` : `<span>${esc(source.title)}</span>`;
    return `<li>${title}<small>${esc(source.publisher)} · ${source.type === 'secondary' ? '보조 검증 자료' : '1차 자료'}${source.publishedAt ? ` · ${esc(source.publishedAt)}` : ''}</small>${source.claim ? `<p>${esc(source.claim)}</p>` : ''}</li>`;
  }).join('');
  return `<div class="eth-history-detail-heading"><span class="eth-history-category" style="--event-color:${ETHEREUM_EVENT_COLORS[event.category]}">${esc(ETHEREUM_EVENT_CATEGORIES[event.category])}</span><time datetime="${esc(event.date)}">${esc(event.date)}</time></div>
    <h3 id="eth-history-event-title">${esc(event.title)}</h3>
    <p class="eth-history-description">${esc(event.description)}</p>
    ${event.detail && event.detail !== event.description ? `<p>${esc(event.detail)}</p>` : ''}
    <button type="button" class="eth-history-jump" data-event-jump="${esc(event.id)}" ${available ? '' : 'disabled'}>차트에서 보기 <span aria-hidden="true">↗</span></button>
    <p class="eth-history-location-note">${esc(note)}</p>
    ${observationMarkup(event,dailySeries)}
    ${event.policyAction ? `<h4>정책·결정</h4><p>${esc(event.policyAction)}</p>` : ''}
    ${event.marketContext ? `<h4>당시 시장 해석</h4><p>${esc(event.marketContext)}</p>` : ''}
    ${event.followUp ? `<h4>후속 변화</h4><p>${esc(event.followUp)}</p>` : ''}
    <h4>날짜 기준</h4><p>${esc(event.dateBasis)}</p>
    ${event.timestampUtc ? `<p class="eth-history-exact">검증한 시각 · ${esc(event.timestampUtc.replace('T',' ').replace('Z',' UTC'))}</p>` : ''}
    ${event.facts?.announcementUtc ? `<p class="eth-history-exact">확인한 발표 시각 · ${esc(event.facts.announcementUtc.replace('T',' ').replace('Z',' UTC'))}</p>` : ''}
    <h4>교차 확인</h4><p>${esc(event.crossCheck)}</p>
    ${event.limitations?.length ? `<h4>해석할 때 구분할 점</h4><ul class="eth-history-cautions">${event.limitations.map(item=>`<li>${esc(item)}</li>`).join('')}</ul>` : ''}
    <h4>확인한 원문 <span>${event.sources.length}</span></h4><ol class="eth-history-sources">${sources}</ol>`;
}

/** The catalog stays folded until requested, including on mobile. It is a
 * historical context layer; this controller does not import any price model. */
export function mountEthereumHistory({button, initialSettings, onSettingsChange=()=>{}, onFocusEvent=()=>false, document=button.ownerDocument}) {
  const win = document.defaultView;
  let settings = {...initialSettings}, context = {}, selectedId = null, returnFocus = button, destroyed = false;
  const dialog = document.createElement('dialog');
  dialog.id = 'eth-history-dialog';dialog.className = 'eth-history-dialog';dialog.setAttribute('aria-labelledby','eth-history-title');
  dialog.innerHTML = `<header class="eth-history-heading"><div><p>ETHEREUM · HISTORY</p><h2 id="eth-history-title">이더리움 역사 사건</h2></div><button class="eth-history-close" type="button" aria-label="역사 사건 닫기">×</button></header>
    <div class="eth-history-controls"><label class="eth-history-toggle"><input id="eth-history-visible" type="checkbox">차트에 표시</label><label class="eth-history-filter">분류<select id="eth-history-category"><option value="all">전체 분류</option>${Object.entries(ETHEREUM_EVENT_CATEGORIES).map(([key,label])=>`<option value="${key}">${esc(label)}</option>`).join('')}</select></label></div>
    <p id="eth-history-context" class="eth-history-context" role="status"></p>
    <div class="eth-history-body"><section class="eth-history-browser" aria-label="사건 목록"><label class="eth-history-search">사건 검색<input id="eth-history-search" type="search" placeholder="관세, 금리, FTX, 머지…" autocomplete="off" spellcheck="false"></label>
    <div class="eth-history-list-filters"><label>목록 연도<select id="eth-history-year" aria-label="목록 연도"><option value="all">전체 연도</option>${[...new Set(ETHEREUM_EVENTS.map(event=>event.date.slice(0,4)))].sort().reverse().map(year=>`<option value="${year}">${year}년</option>`).join('')}</select></label><label>정렬<select id="eth-history-order" aria-label="사건 정렬"><option value="desc">최근순</option><option value="asc">오래된순</option></select></label></div>
    <p id="eth-history-count" role="status" aria-live="polite"></p><div id="eth-history-list"></div></section>
    <section class="eth-history-detail" aria-label="사건 근거와 출처"><button type="button" class="eth-history-back">← 사건 목록</button><div id="eth-history-detail-content"></div></section></div>
    <footer>${ETHEREUM_EVENTS_REVIEW_DATE} 검토 · 확인된 역사 기록 · 가격 인과·매매 신호 아님</footer>`;
  document.body.append(dialog);
  const $ = selector => dialog.querySelector(selector);
  const input = $('#eth-history-search'), list = $('#eth-history-list'), detail = $('#eth-history-detail-content');
  const checkbox = $('#eth-history-visible'), category = $('#eth-history-category');
  const year = $('#eth-history-year'), order = $('#eth-history-order');
  button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls',dialog.id);button.setAttribute('aria-expanded','false');
  const viewport = mountDialogViewport(dialog);
  function filtered() { return ethereumHistoryList({category:settings.category,query:input.value,year:year.value,order:order.value}); }
  function renderContext() {
    const intraday = !['daily','weekly'].includes(context.frequency);
    $('#eth-history-context').textContent = intraday ? '역사 표식은 일·주봉에서 표시합니다. 사건을 고르고 ‘차트에서 보기’를 누르면 일봉으로 이동합니다.' : !settings.visible ? '차트 표시는 꺼져 있습니다. 목록과 출처는 계속 볼 수 있습니다.' : `${context.visibleCount ?? 0}개 사건이 현재 차트에 포함됩니다. 확대하면 사건 이름이 더 표시됩니다.`;
    button.dataset.active = String(settings.visible);
    checkbox.checked = settings.visible;category.value = settings.category;
  }
  function renderDetail({resetScroll=false}={}) {
    const event = ETHEREUM_EVENTS.find(item=>item.id === selectedId);
    const active=document.activeElement,hadFocus=detail.contains(active),href=hadFocus?active.getAttribute('href'):null;
    const jumpId=hadFocus?active.dataset?.eventJump:null,scrollTop=$('.eth-history-detail').scrollTop;
    detail.innerHTML = ethereumEventDetailMarkup(event,context);
    $('.eth-history-detail').scrollTop = resetScroll?0:scrollTop;
    if(hadFocus){
      const target=href?[...detail.querySelectorAll('a[href]')].find(node=>node.getAttribute('href')===href):jumpId?detail.querySelector('[data-event-jump]'):null;
      const fallback=detail.querySelector('h3');if(fallback)fallback.setAttribute('tabindex','-1');
      (target&&!target.disabled?target:fallback||input).focus({preventScroll:true});
    }
  }
  function renderList() {
    const shown = filtered();
    $('#eth-history-count').textContent = `${shown.length} / ${ETHEREUM_EVENTS.length}개 사건`;
    list.innerHTML = shown.length ? shown.map(event=>`<button type="button" class="eth-history-card" data-event-id="${event.id}" aria-current="${event.id === selectedId ? 'true' : 'false'}" style="--event-color:${ETHEREUM_EVENT_COLORS[event.category]}"><time>${event.date}</time><strong>${esc(event.title)}</strong><span>${esc(ETHEREUM_EVENT_CATEGORIES[event.category])} · 원문 ${event.sources.length}개</span></button>`).join('') : '<p class="eth-history-empty">일치하는 사건이 없습니다.</p>';
    if (selectedId && !shown.some(item=>item.id === selectedId)) {selectedId = null;dialog.dataset.detail = 'false';renderDetail();}
  }
  function select(id) {
    if (!ETHEREUM_EVENTS.some(event=>event.id === id)) return;
    selectedId = id;dialog.dataset.detail = 'true';renderList();renderDetail({resetScroll:true});
    const heading = $('#eth-history-event-title');heading?.setAttribute('tabindex','-1');heading?.focus({preventScroll:true});
  }
  function open(id=null) {
    if (destroyed) return;
    if(!dialog.open)returnFocus = document.activeElement || button;
    input.value = '';year.value = 'all';selectedId = null;dialog.dataset.detail = 'false';renderList();renderDetail({resetScroll:true});renderContext();
    document.dispatchEvent(new win.CustomEvent('atlas:modal-open',{detail:{id:dialog.id}}));
    if (!dialog.open) dialog.showModal();
    button.setAttribute('aria-expanded','true');
    if (id) select(id);else input.focus({preventScroll:true});
  }
  const close = () => dialog.close();
  const trigger = () => open();
  button.addEventListener('click',trigger);
  $('.eth-history-close').onclick = close;
  $('.eth-history-back').onclick = () => {dialog.dataset.detail='false';input.focus({preventScroll:true});};
  const filterList = () => {renderList();list.scrollTop=0;};
  input.oninput = filterList;year.onchange = filterList;order.onchange = filterList;
  checkbox.onchange = () => {settings.visible=checkbox.checked;onSettingsChange({...settings});renderContext();};
  category.onchange = () => {settings.category=category.value;onSettingsChange({...settings});filterList();renderContext();};
  list.addEventListener('click',event => {const row=event.target.closest('[data-event-id]');if(row)select(row.dataset.eventId);});
  detail.addEventListener('click',async event => {
    const jump=event.target.closest('[data-event-jump]');if(!jump||jump.disabled)return;
    jump.disabled=true;
    try {if(await onFocusEvent(jump.dataset.eventJump))close();}
    finally {if(dialog.open)renderDetail();}
  });
  dialog.addEventListener('click',event => {if(event.target!==dialog)return;const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)close();});
  dialog.addEventListener('close',() => {
    button.setAttribute('aria-expanded','false');
    if (!destroyed && !document.querySelector('dialog[open]')) (returnFocus?.isConnected ? returnFocus : button).focus({preventScroll:true});
  });
  dialog.addEventListener('keydown',event => {
    event.stopPropagation();
    if(event.key!=='Tab')return;
    const focusable=[...dialog.querySelectorAll('button:not(:disabled),input,select,a[href]')].filter(node=>node.getClientRects().length);
    const first=focusable[0],last=focusable.at(-1);
    if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus();}
  });
  const anotherModal = event => {if(event.detail?.id !== dialog.id && dialog.open)close();};
  document.addEventListener('atlas:modal-open',anotherModal);
  return {
    open,
    update(next) {const changed=next.firstDate!==context.firstDate||next.lastDate!==context.lastDate||next.dailySeries!==context.dailySeries;context={...context,...next};renderContext();if(dialog.open&&changed)renderDetail();},
    setSettings(next) {settings={...settings,...next};renderContext();if(dialog.open)renderList();},
    destroy() {destroyed=true;button.removeEventListener('click',trigger);document.removeEventListener('atlas:modal-open',anotherModal);viewport.destroy();dialog.remove();},
  };
}
