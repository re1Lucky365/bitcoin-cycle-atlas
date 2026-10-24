import {RESEARCH_ARTICLES,ARTICLE_ALIASES} from './research-library-data.js?v=1.18.0';
import {mountDialogViewport} from './dialog-viewport.js?v=1.14.0-mobile.1';
import {serializeResearchArticleMarkdown,safeResearchUrl as safe} from './research-format.js?v=1.18.0';
export {RESEARCH_ARTICLES};
export const RESEARCH_CATEGORIES={filing:'공시·재무',data:'원자료·관측',method:'모델·검증 방법',leadership:'경영진·기관 전망',risk:'반론·정책·위험'};
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const map=new Map(RESEARCH_ARTICLES.map(item=>[item.id,item]));
export const getResearchArticle=id=>map.get(ARTICLE_ALIASES[id]||id)||null;
const statusLabels={fact:'기록 확인',conditional:'조건부 주장',unverified:'검증 보류',contradicted:'반대 증거 확인'};
let dialog=null,opener=null,current=null,previousIds=[];

export function researchArticleMarkdown(articleOrId){
  const r=typeof articleOrId==='string'?getResearchArticle(articleOrId):articleOrId;if(!r)throw new RangeError('Unknown research article');
  return serializeResearchArticleMarkdown(r,ARTICLE_ALIASES);
}

function articleLink(id){const row=getResearchArticle(id);return row?`<button type="button" class="research-related" data-research-article="${esc(row.id)}">${esc(row.title)} <span aria-hidden="true">↗</span></button>`:'';}
export function researchArticleMarkup(r){
  const media=r.media.map(item=>`<li><span class="research-media-kind">${item.type==='video'?'동영상':'이미지'}</span><a href="${esc(safe(item.url))}" target="_blank" rel="noopener noreferrer">${esc(item.title||'원문 미디어')} ↗</a><small>주소·제목 기록 · 외부 파일 미보관</small></li>`).join('');
  return `<div class="research-reading-progress" aria-hidden="true"><span></span></div><header class="research-reader-nav"><div><span class="research-wordmark">ATLAS</span><span class="research-nav-divider">/</span><span>RESEARCH</span></div><div class="research-reader-actions"><button type="button" data-reader-action="back" ${previousIds.length?'':'hidden'} aria-label="이전 연구 글">←</button><button type="button" data-reader-action="download">MD 저장</button><button type="button" data-reader-action="close" aria-label="연구 글 닫기">닫기 ×</button></div></header>
  <div class="research-reader-scroll"><article class="research-article"><header class="research-article-heading"><div class="research-tags">${r.symbols.map(symbol=>`<span>${esc(symbol)}</span>`).join('')}<span>${esc(RESEARCH_CATEGORIES[r.category]||r.category)}</span></div><h1 id="research-reader-title">${esc(r.title)}</h1><p class="research-deck">${esc(r.originalTitle||r.title)}</p><div class="research-byline"><span class="research-avatar" aria-hidden="true">${esc((r.publisher||'A').slice(0,1))}</span><div><strong>${esc(r.author)}</strong><span>${esc(r.publisher)} · ${esc(r.publishedAt||'발행일 미확인')}</span></div></div><div class="research-meta"><span>검토 기록 ${esc(r.reviewedAt)}</span><span>${Math.max(1,Math.ceil((r.summary.length+r.claims.map(c=>c.assessment).join('').length+r.limitations.join('').length)/450))}분 읽기</span><a href="${esc(safe(r.url))}" target="_blank" rel="noopener noreferrer">원문 열기 ↗</a></div></header>
  <aside class="research-provenance">직접 작성한 연구 요약·교차 확인 기록입니다. 원문 전체나 외부 이미지·영상의 복제본은 아닙니다.</aside>
  <section id="research-summary"><h2>핵심 내용</h2><p class="research-lead">${esc(r.summary)}</p>${r.reviewNote?`<p class="research-small">${esc(r.reviewNote)}</p>`:''}</section>
  ${r.claims.length?`<section id="research-claims"><h2>주장과 교차 확인</h2>${r.claims.map(claim=>`<div class="research-claim"><span class="research-verdict" data-status="${esc(claim.status)}">${esc(statusLabels[claim.status]||claim.status)}</span><h3>${esc(claim.claim)}</h3><p>${esc(claim.assessment)}</p>${claim.crossCheckIds?.length?`<div class="research-crosslinks"><span>함께 대조할 자료</span>${claim.crossCheckIds.map(articleLink).join('')}</div>`:'<p class="research-small">별도의 독립 대조 자료가 기재되지 않은 주장입니다.</p>'}</div>`).join('')}</section>`:''}
  <section id="research-limits"><h2>어디까지 알 수 있는가</h2><ul>${r.limitations.map(item=>`<li>${esc(item)}</li>`).join('')||'<li>원문을 확인했다는 사실과 미래 성과를 검증했다는 주장은 다릅니다.</li>'}</ul></section>
  <section id="research-source"><h2>출처 기록</h2><dl class="research-source-grid"><div><dt>접근·검토 상태</dt><dd>${esc(r.access)}</dd></div><div><dt>원문 위치</dt><dd>${esc(r.sourceAnchor||r.evidenceAnchor||'페이지 본문 · 상세 접근 한계 참조')}</dd></div><div><dt>보존 범위</dt><dd>제목·글쓴이·날짜·직접 작성한 본문·검토·출처·미디어 링크</dd></div><div><dt>검증 식별자</dt><dd class="research-hash">${esc(r.archiveSha256)}</dd></div></dl>${r.relatedLinks?.length?`<ul class="research-media-list">${r.relatedLinks.map(link=>`<li><a href="${esc(safe(link.url))}" target="_blank" rel="noopener noreferrer">${esc(link.title)} ↗</a></li>`).join('')}</ul>`:''}</section>
  <section id="research-media"><h2>이미지와 동영상</h2>${media?`<ul class="research-media-list">${media}</ul>`:'<p class="research-small">별도 미디어 주소를 확보하지 않았습니다. 원문에 미디어가 없다는 뜻은 아닙니다.</p>'}</section>
  <footer class="research-article-footer"><p>${esc(r.footer.copyright)}</p><p>${esc(r.footer.availability)}</p><a href="${esc(safe(r.url))}" target="_blank" rel="noopener noreferrer">${esc(r.publisher)}에서 원문 확인 ↗</a><p class="research-small">이 글의 원문 전체: 미보관 · 이미지·영상 파일: 미보관 · Atlas 연구 본문: 보존</p></footer></article></div>`;
}

function mount(){
  if(dialog?.isConnected)return;
  dialog=document.createElement('dialog');dialog.id='research-reader';dialog.className='research-reader';dialog.setAttribute('aria-labelledby','research-reader-title');document.body.append(dialog);mountDialogViewport(dialog);
  dialog.addEventListener('click',event=>{
    const related=event.target.closest('[data-research-article]');if(related){openResearchArticle(related.dataset.researchArticle,{keepHistory:true});return;}
    const action=event.target.closest('[data-reader-action]')?.dataset.readerAction;
    if(action==='close')dialog.close();
    if(action==='back'&&previousIds.length){const id=previousIds.pop();openResearchArticle(id,{fromBack:true});}
    if(action==='download'&&current){const link=document.createElement('a');link.download=`${current.id}.md`;link.href=URL.createObjectURL(new Blob([researchArticleMarkdown(current)],{type:'text/markdown;charset=utf-8'}));link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);}
    if(event.target===dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close();}
  });
  dialog.addEventListener('keydown',event=>event.stopPropagation());
  dialog.addEventListener('close',()=>{const url=new URL(location.href);url.searchParams.delete('article');try{history.replaceState(null,'',url);}catch{}if(!document.querySelector('dialog[open]')&&opener?.isConnected)opener.focus({preventScroll:true});previousIds=[];});
  document.addEventListener('atlas:modal-open',event=>{if(event.detail?.id!==dialog.id&&dialog.open)dialog.close();});
}

export function openResearchArticle(id,{opener:requestedOpener,keepHistory=false,fromBack=false}={}){
  const record=getResearchArticle(id);if(!record)return false;
  mount();if(!dialog.open){opener=requestedOpener||document.activeElement;previousIds=[];}else if(keepHistory&&current)previousIds.push(current.id);else if(!fromBack)previousIds=[];
  current=record;dialog.innerHTML=researchArticleMarkup(record);
  document.dispatchEvent(new CustomEvent('atlas:modal-open',{detail:{id:dialog.id}}));
  if(!dialog.open)dialog.showModal();
  const scroll=dialog.querySelector('.research-reader-scroll');scroll.scrollTop=0;scroll.addEventListener('scroll',()=>{dialog.querySelector('.research-reading-progress span').style.width=`${100*scroll.scrollTop/Math.max(1,scroll.scrollHeight-scroll.clientHeight)}%`;},{passive:true});
  const title=dialog.querySelector('h1');title.tabIndex=-1;title.focus({preventScroll:true});
  const url=new URL(location.href);url.searchParams.set('article',record.id);try{history.replaceState(null,'',url);}catch{}
  return true;
}
