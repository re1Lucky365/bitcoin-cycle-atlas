import { RESEARCH_EVIDENCE as EVIDENCE, RESEARCH_SUPPLEMENTS as EVIDENCE_SUPPLEMENTS } from './evidence-index.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const BATCH = 12;
let count = 0, visible = false, observer;
const rows = [...EVIDENCE].sort((a,b) => a.rank - b.rank);
const tierNames = {A:'직접 근거',B:'출처가 확인된 해석',C:'맥락·소셜',D:'접근 제한'};
const timingNames = {data:'자료·정의',before:'사전',during:'당시 관찰',after:'사후'};
const stanceNames = {support:'지지 근거',counter:'반론·실패 기록',mixed:'혼합된 해석',data:'관측·방법',context:'맥락'};

function safeUrl(value) {
  try { const u = new URL(value); return ['https:','http:'].includes(u.protocol) ? u.href : '#'; } catch { return '#'; }
}

function appendRows() {
  const batch = rows.slice(count, count+BATCH);
  document.querySelector('#evidence-body').insertAdjacentHTML('beforeend', batch.map(r => `<tr data-evidence-id="${esc(r.id)}"><td class="evidence-rank">${String(r.rank).padStart(2,'0')}</td><td class="evidence-title"><a href="${esc(safeUrl(r.url))}" target="_blank" rel="noopener noreferrer" title="${esc(r.originalTitle || r.title)}"><span class="evidence-title-text">${esc(r.title)}</span><span aria-hidden="true">↗</span></a></td><td class="evidence-publisher">${esc(r.publisher)}</td><td class="evidence-date">${esc(r.date || '날짜 미확인')}</td><td class="evidence-role" title="${esc(r.role)}">${esc(r.role)}</td><td class="evidence-grade"><button data-evidence-detail="${esc(r.id)}" aria-label="${esc(r.title)}의 근거와 한계 확인" title="${esc(r.reason)}"><span class="grade-${esc(r.tier)}">${esc(r.tier)}</span><span aria-hidden="true">ⓘ</span></button></td></tr>`).join(''));
  count += batch.length;
  document.querySelector('#evidence-progress').textContent = `${count} / ${rows.length}개 자료`;
  const done = count >= rows.length;
  document.querySelector('#evidence-more').hidden = done;
  document.querySelector('#evidence-end').hidden = !done;
  document.querySelector('#evidence-end').textContent = `${rows.length}개 자료를 모두 표시했습니다.`;
  if (done) observer?.disconnect();
}

function openDetail(id) {
  const r = rows.find(item=>item.id===id); if(!r) return;
  const supplements=EVIDENCE_SUPPLEMENTS.filter(item=>item.parentId===id);
  document.querySelector('#evidence-detail-title').textContent = r.title;
  document.querySelector('#evidence-detail-body').innerHTML = `<p class="evidence-original">${esc(r.originalTitle || r.title)}</p><dl class="evidence-facts"><div><dt>읽는 순서</dt><dd>${r.rank} / ${rows.length}</dd></div><div><dt>출처 · 발행일</dt><dd>${esc(r.publisher)} · ${esc(r.date || '날짜 미확인')}</dd></div><div><dt>근거 활용</dt><dd>${esc(r.tier)} · ${esc(tierNames[r.tier] || r.tier)} / ${esc(stanceNames[r.stance] || r.stance)}</dd></div><div><dt>시점 · 접근</dt><dd>${esc(timingNames[r.timing] || r.timing)} · ${esc(r.access)}</dd></div></dl><h3>이 순서로 읽는 이유</h3><p>${esc(r.reason)}</p><h3>해석의 한계</h3><p>${esc(r.limitation)}</p><p class="evidence-family">같은 주장 계보: ${esc(r.family)}. 같은 계보의 재전파를 독립적인 검증으로 세지 않습니다.</p><a class="primary-button evidence-source-link" href="${esc(safeUrl(r.url))}" target="_blank" rel="noopener noreferrer">원문 열기 ↗</a><p class="evidence-scale-note">A–D는 자료를 활용하는 등급입니다. 주장 적중률이나 미래 확률이 아닙니다.</p>`;
  if(supplements.length)document.querySelector('#evidence-detail-body').insertAdjacentHTML('beforeend',`<h3>관련 원문 · 보조 자료</h3><ul class="evidence-supplements">${supplements.map(item=>`<li><a href="${esc(safeUrl(item.url))}" target="_blank" rel="noopener noreferrer">${esc(item.title)} ↗</a></li>`).join('')}</ul>`);
  document.querySelector('#evidence-dialog').showModal();
}

export function initEvidenceView() {
  document.querySelector('#evidence-total').textContent = `${rows.length}개 자료`;
  document.querySelector('#evidence-more').addEventListener('click',appendRows);
  document.querySelector('#evidence-body').addEventListener('click',e=>{const b=e.target.closest('[data-evidence-detail]');if(b)openDetail(b.dataset.evidenceDetail);});
  document.querySelector('#evidence-close').addEventListener('click',()=>document.querySelector('#evidence-dialog').close());
  const dialog=document.querySelector('#evidence-dialog');
  dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();});
  appendRows();
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(entries=>{if(visible&&entries.some(e=>e.isIntersecting)&&count<rows.length)appendRows();},{rootMargin:'120px',threshold:0});
    observer.observe(document.querySelector('#evidence-sentinel'));
  }
}

export function showEvidenceView(value) {
  visible=value;
  if(value&&observer&&count<rows.length){observer.unobserve(document.querySelector('#evidence-sentinel'));observer.observe(document.querySelector('#evidence-sentinel'));}
}
