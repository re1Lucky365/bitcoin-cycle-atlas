import { RESEARCH_EVIDENCE as EVIDENCE, RESEARCH_SUPPLEMENTS as EVIDENCE_SUPPLEMENTS } from './evidence-index.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let visible = false, initialized = false, pendingFrame = 0, resizeObserver;
let start = 0, shown = 0, query = '', sourceFilter = 'all', previousStarts = [];
const rows = [...EVIDENCE].sort((a,b) => a.rank - b.rank);
const normalized = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase();
const searchText = new Map(rows.map(r=>[r.id,normalized([r.title,r.originalTitle,r.publisher,r.url].join(' '))]));
const tierNames = {A:'직접 근거',B:'출처가 확인된 해석',C:'맥락·소셜',D:'접근 제한'};
const timingNames = {data:'자료·정의',before:'사전',during:'당시 관찰',after:'사후'};
const stanceNames = {support:'지지 근거',counter:'반론·실패 기록',mixed:'혼합된 해석',data:'관측·방법',context:'맥락'};

function safeUrl(value) {
  try { const u = new URL(value); return ['https:','http:'].includes(u.protocol) ? u.href : '#'; } catch { return '#'; }
}

function filteredRows() {
  const terms=normalized(query).trim().split(/\s+/).filter(Boolean);
  return rows.filter(r=>terms.every(term=>searchText.get(r.id).includes(term)) &&
    (sourceFilter!=='cryptocon'||/cryptocon|크립토콘/i.test([r.title,r.originalTitle,r.publisher,r.family,r.url].join(' '))));
}

function rowMarkup(r) {
  const fullTitle=`${r.title}${r.originalTitle&&r.originalTitle!==r.title?` · ${r.originalTitle}`:''}`;
  return `<tr data-evidence-id="${esc(r.id)}"><td class="evidence-rank">${String(r.rank).padStart(2,'0')}</td><td class="evidence-title"><a href="${esc(safeUrl(r.url))}" target="_blank" rel="noopener noreferrer" title="${esc(fullTitle)}" aria-label="${esc(r.title)} — 원문 열기"><span class="evidence-title-text">${esc(r.title)}</span><span aria-hidden="true">↗</span></a></td><td class="evidence-publisher">${esc(r.publisher)}</td><td class="evidence-date">${esc(r.date || '날짜 미확인')}</td><td class="evidence-role" title="${esc(r.role)}">${esc(r.role)}</td><td class="evidence-grade"><button data-evidence-detail="${esc(r.id)}" aria-label="${esc(r.title)}의 근거와 한계 확인" title="${esc(r.reason)}"><span class="grade-${esc(r.tier)}">${esc(r.tier)}</span><span aria-hidden="true">ⓘ</span></button></td></tr>`;
}

function renderPage() {
  const view=document.querySelector('#evidence-view'),shell=view.querySelector('.evidence-table-shell'),table=shell.querySelector('table'),body=document.querySelector('#evidence-body'),filtered=filteredRows();
  start=filtered.length?Math.min(start,filtered.length-1):0;
  const room=shell.clientHeight,headerHeight=(table.caption?.getBoundingClientRect().height||0)+(table.tHead?.getBoundingClientRect().height||0);
  const rowHeight=parseFloat(getComputedStyle(view).getPropertyValue('--evidence-row-height'))||(shell.clientWidth<680?64:56);
  const capacity=room>0?Math.max(1,Math.floor((room-headerHeight-4)/rowHeight)):6;
  shown=Math.min(capacity,filtered.length-start);
  body.innerHTML=shown?filtered.slice(start,start+shown).map(rowMarkup).join(''):'<tr class="evidence-empty"><td colspan="6">검색 결과가 없습니다. 검색어나 자료 범위를 바꿔 보세요.</td></tr>';
  // Real font/wrapping metrics can exceed the estimate. Fit this page without
  // hiding a row or adding a nested scrollbar; the next button starts at its end.
  while(visible&&room>0&&shown>1&&table.getBoundingClientRect().height>room+1){body.lastElementChild.remove();shown--;}
  document.querySelector('#evidence-total').textContent=query.trim()||sourceFilter!=='all'?`${filtered.length} / ${rows.length}개 자료`:`${rows.length}개 자료`;
  document.querySelector('#evidence-progress').textContent=filtered.length?`${start+1}–${start+shown} / ${filtered.length}개`:'0개 자료';
  document.querySelector('#evidence-prev').disabled=start===0;
  document.querySelector('#evidence-more').disabled=start+shown>=filtered.length;
  document.querySelector('#evidence-clear').disabled=!query&&!sourceFilter.includes('cryptocon');
  document.querySelector('#evidence-end').hidden=true;
}

function schedulePage() {
  if(pendingFrame)cancelAnimationFrame(pendingFrame);
  pendingFrame=requestAnimationFrame(()=>{pendingFrame=0;if(visible)renderPage();});
}

function resetPage() {
  start=0;previousStarts=[];renderPage();schedulePage();
}

function openDetail(id) {
  const r = rows.find(item=>item.id===id); if(!r) return;
  const supplements=EVIDENCE_SUPPLEMENTS.filter(item=>item.parentId===id);
  document.querySelector('#evidence-detail-title').textContent = r.title;
  document.querySelector('#evidence-detail-body').innerHTML = `<p class="evidence-original">${esc(r.originalTitle || r.title)}</p><dl class="evidence-facts"><div><dt>읽는 순서</dt><dd>${r.rank} / ${rows.length}</dd></div><div><dt>출처 · 발행일</dt><dd>${esc(r.publisher)} · ${esc(r.date || '날짜 미확인')}</dd></div><div><dt>근거 활용</dt><dd>${esc(r.tier)} · ${esc(tierNames[r.tier] || r.tier)} / ${esc(stanceNames[r.stance] || r.stance)}</dd></div><div><dt>시점 · 접근</dt><dd>${esc(timingNames[r.timing] || r.timing)} · ${esc(r.access)}</dd></div></dl><h3>이 순서로 읽는 이유</h3><p>${esc(r.reason)}</p><h3>해석의 한계</h3><p>${esc(r.limitation)}</p><p class="evidence-family">같은 주장 계보: ${esc(r.family)}. 같은 계보의 재전파를 독립적인 검증으로 세지 않습니다.</p><a class="primary-button evidence-source-link" href="${esc(safeUrl(r.url))}" target="_blank" rel="noopener noreferrer">원문 열기 ↗</a><p class="evidence-scale-note">A–D는 자료를 활용하는 등급입니다. 주장 적중률이나 미래 확률이 아닙니다.</p>`;
  if(supplements.length)document.querySelector('#evidence-detail-body').insertAdjacentHTML('beforeend',`<h3>관련 원문 · 보조 자료</h3><ul class="evidence-supplements">${supplements.map(item=>`<li><a href="${esc(safeUrl(item.url))}" target="_blank" rel="noopener noreferrer">${esc(item.title)} ↗</a></li>`).join('')}</ul>`);
  document.querySelector('#evidence-dialog').showModal();
  document.dispatchEvent(new CustomEvent('evidence:open',{detail:{id}}));
}

export function initEvidenceView() {
  if(initialized)return;initialized=true;
  const view=document.querySelector('#evidence-view'),shell=view.querySelector('.evidence-table-shell');
  const controls=document.createElement('div');controls.className='evidence-controls';
  controls.innerHTML='<label class="evidence-search"><span class="lab-visually-hidden">자료 제목·출처 검색</span><input id="evidence-search" type="search" placeholder="자료 제목·출처 검색" aria-label="자료 제목·출처 검색" autocomplete="off"></label><label class="evidence-filter"><span class="lab-visually-hidden">자료 범위</span><select id="evidence-filter" aria-label="자료 범위"><option value="all">전체 자료</option><option value="cryptocon">CryptoCon 관련</option></select></label><button id="evidence-clear" type="button">초기화</button>';
  view.insertBefore(controls,shell);
  const pager=document.createElement('nav');pager.className='evidence-pagination';pager.setAttribute('aria-label','리서치 자료 페이지');
  pager.innerHTML='<button id="evidence-prev" type="button" aria-label="이전 자료 페이지">← 이전</button>';
  const more=document.querySelector('#evidence-more');more.textContent='다음 →';more.setAttribute('aria-label','다음 자료 페이지');
  pager.append(document.querySelector('#evidence-progress'),more,document.querySelector('#evidence-end'));view.append(pager);
  view.querySelector('tfoot').hidden=true;
  document.querySelector('#evidence-search').addEventListener('input',event=>{query=event.target.value;resetPage();});
  document.querySelector('#evidence-filter').addEventListener('change',event=>{sourceFilter=event.target.value;resetPage();});
  document.querySelector('#evidence-clear').addEventListener('click',()=>{query='';sourceFilter='all';document.querySelector('#evidence-search').value='';document.querySelector('#evidence-filter').value='all';resetPage();});
  more.addEventListener('click',()=>{if(start+shown>=filteredRows().length)return;previousStarts.push(start);start+=shown;renderPage();});
  document.querySelector('#evidence-prev').addEventListener('click',()=>{start=previousStarts.length?previousStarts.pop():Math.max(0,start-Math.max(1,shown));renderPage();});
  document.querySelector('#evidence-body').addEventListener('click',e=>{const b=e.target.closest('[data-evidence-detail]');if(b)openDetail(b.dataset.evidenceDetail);});
  document.querySelector('#evidence-close').addEventListener('click',()=>document.querySelector('#evidence-dialog').close());
  const dialog=document.querySelector('#evidence-dialog');
  dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();});
  renderPage();
  if('ResizeObserver' in window){resizeObserver=new ResizeObserver(schedulePage);resizeObserver.observe(shell);}
  window.addEventListener('resize',schedulePage);window.visualViewport?.addEventListener('resize',schedulePage);
  document.fonts?.ready.then(schedulePage);
}

export function showEvidenceView(value) {
  visible=value;
  if(value)schedulePage();
  else if(pendingFrame){cancelAnimationFrame(pendingFrame);pendingFrame=0;}
}
