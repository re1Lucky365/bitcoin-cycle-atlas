import {RESEARCH_ARTICLES,ARTICLE_ALIASES} from './research-library-data.js?v=1.20.0';
import {RESEARCH_SOURCES} from './research-source-data.js?v=1.19.0';
import {mountDialogViewport} from './dialog-viewport.js?v=1.14.0-mobile.1';
import {serializeResearchArticleMarkdown,safeResearchUrl as safe} from './research-format.js?v=1.19.0';
export {RESEARCH_ARTICLES};
export const RESEARCH_CATEGORIES={filing:'공시·재무',data:'원자료·관측',method:'모델·검증 방법',leadership:'경영진·기관 전망',risk:'반론·정책·위험'};
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const map=new Map(RESEARCH_ARTICLES.map(item=>[item.id,item]));
const sourcesByUrl=new Map(RESEARCH_SOURCES.map(item=>[safe(item.sourceUrl),item]));
export const getResearchArticle=id=>map.get(ARTICLE_ALIASES[id]||id)||null;
const statusLabels={fact:'기록 확인',conditional:'조건부 주장',unverified:'검증 보류',contradicted:'반대 증거 확인'};
let dialog=null,opener=null,current=null,currentView='summary',previousEntries=[];

export function researchArticleMarkdown(articleOrId){
  const r=typeof articleOrId==='string'?getResearchArticle(articleOrId):articleOrId;
  if(!r)throw new RangeError('Unknown research article');
  return serializeResearchArticleMarkdown(r,ARTICLE_ALIASES);
}

export function getResearchSource(articleOrId){
  const article=typeof articleOrId==='string'?getResearchArticle(articleOrId):articleOrId;
  return article?sourcesByUrl.get(safe(article.url))||null:null;
}

export function researchSourceText(articleOrId){
  const source=getResearchSource(articleOrId);
  if(!source)throw new RangeError('No permitted source text archived for this article');
  return source.text;
}

function articleLink(id){
  const row=getResearchArticle(id);
  return row?`<button type="button" class="research-related" data-research-article="${esc(row.id)}">${esc(row.title)} <span aria-hidden="true">↗</span></button>`:'';
}

export function researchSourceMarkup(source){
  return `<section class="research-source-original" aria-labelledby="research-source-heading">
    <h2 id="research-source-heading">보관 원문 · English</h2>
    <p class="research-provenance">공식 저장소의 지정 판본에서 가져온 Markdown 파일 전체입니다. CC0 허용 범위를 확인하고 원문 바이트를 보존했습니다. 연결된 다른 문서·웹페이지 화면·이미지·영상은 포함하지 않습니다.</p>
    <dl class="research-source-grid">
      <div><dt>원문 판본</dt><dd><a href="${esc(safe(source.versionedUrl))}" target="_blank" rel="noopener noreferrer">${esc(source.sourcePath)} ↗</a><span class="research-hash research-source-revision">${esc(source.sourceRevision)}</span></dd></div>
      <div><dt>원문 수정 시각</dt><dd>${esc(source.sourceLastChangedAt)}</dd></div>
      <div><dt>수집·검토 시각</dt><dd>${esc(source.retrievedAt)}</dd></div>
      <div><dt>허용 근거</dt><dd><a href="${esc(safe(source.licenseUrl))}" target="_blank" rel="noopener noreferrer">${esc(source.license)} · 해당 판본 라이선스 ↗</a><br>본문 Copyright 절의 CC0 고지 확인</dd></div>
      <div><dt>보존 바이트</dt><dd>${source.bytes.toLocaleString('en-US')} bytes · UTF-8 · 수정 없음</dd></div>
      <div><dt>원문 SHA-256</dt><dd class="research-hash">${esc(source.sha256)}</dd></div>
    </dl>
    <p class="research-small">아래는 번역·요약하지 않은 원문입니다. Markdown 표기와 코드는 텍스트로 읽으며 실행하지 않습니다. 원문의 상대 링크는 원 발행처 문서를 기준으로 합니다. ‘원문 MD 저장’은 이 원문 파일을 저장합니다.</p>
    <pre class="research-source-text" lang="en">${esc(source.text)}</pre>
    <p class="research-small">원문 끝 · ${esc(source.id)} · ${esc(source.license)}. 내용의 보존과 무결성 확인은 가격 예측이나 구현의 정확성을 보증하지 않습니다.</p>
  </section>`;
}

function summaryMarkup(r,source){
  const media=r.media.map(item=>`<li><span class="research-media-kind">${item.type==='video'?'동영상':'이미지'}</span><a href="${esc(safe(item.url))}" target="_blank" rel="noopener noreferrer">${esc(item.title||'원문 미디어')} ↗</a><small>주소·제목 기록 · 외부 파일 미보관</small></li>`).join('');
  return `<aside class="research-provenance">직접 작성한 연구 요약·교차 확인 기록입니다.${source?' 별도로 보존한 CC0 원문은 위의 ‘보관 원문’에서 읽을 수 있습니다.':' 원문 전체나 외부 이미지·영상의 복제본은 아닙니다.'}</aside>
  <section id="research-summary"><h2>핵심 내용</h2><p class="research-lead">${esc(r.summary)}</p>${r.reviewNote?`<p class="research-small">${esc(r.reviewNote)}</p>`:''}</section>
  ${r.claims.length?`<section id="research-claims"><h2>주장과 교차 확인</h2>${r.claims.map(claim=>`<div class="research-claim"><span class="research-verdict" data-status="${esc(claim.status)}">${esc(statusLabels[claim.status]||claim.status)}</span><h3>${esc(claim.claim)}</h3><p>${esc(claim.assessment)}</p>${claim.crossCheckIds?.length?`<div class="research-crosslinks"><span>함께 대조할 자료</span>${claim.crossCheckIds.map(articleLink).join('')}</div>`:'<p class="research-small">별도의 독립 대조 자료가 기재되지 않은 주장입니다.</p>'}</div>`).join('')}</section>`:''}
  <section id="research-limits"><h2>어디까지 알 수 있는가</h2><ul>${r.limitations.map(item=>`<li>${esc(item)}</li>`).join('')||'<li>원문을 확인했다는 사실과 미래 성과를 검증했다는 주장은 다릅니다.</li>'}</ul></section>
  <section id="research-source"><h2>출처 기록</h2><dl class="research-source-grid"><div><dt>접근·검토 상태</dt><dd>${esc(r.access)}</dd></div><div><dt>원문 위치</dt><dd>${esc(r.sourceAnchor||r.evidenceAnchor||'페이지 본문 · 상세 접근 한계 참조')}</dd></div><div><dt>요약 보존 범위</dt><dd>제목·글쓴이·날짜·직접 작성한 본문·검토·출처·미디어 링크</dd></div><div><dt>요약 SHA-256</dt><dd class="research-hash">${esc(r.archiveSha256)}</dd></div></dl>${r.relatedLinks?.length?`<ul class="research-media-list">${r.relatedLinks.map(link=>`<li><a href="${esc(safe(link.url))}" target="_blank" rel="noopener noreferrer">${esc(link.title)} ↗</a></li>`).join('')}</ul>`:''}</section>
  <section id="research-media"><h2>이미지와 동영상</h2>${media?`<ul class="research-media-list">${media}</ul>`:'<p class="research-small">별도 미디어 주소를 확보하지 않았습니다. 원문에 미디어가 없다는 뜻은 아닙니다.</p>'}</section>
  <footer class="research-article-footer"><p>${esc(r.footer.copyright)}</p><p>${esc(source?'이 화면의 자체 요약과 CC0 원문 파일을 별도로 보존합니다. 외부 이미지·영상·연결 문서의 복제본은 포함하지 않습니다.':r.footer.availability)}</p><a href="${esc(safe(r.url))}" target="_blank" rel="noopener noreferrer">${esc(r.publisher)}에서 원문 확인 ↗</a><p class="research-small">${source?'원문 Markdown 파일 전체: 별도 보관 · 이미지·영상 파일: 미보관 · Atlas 연구 본문: 보존':'이 글의 원문 전체: 미보관 · 이미지·영상 파일: 미보관 · Atlas 연구 본문: 보존'}</p></footer>`;
}

export function researchArticleMarkup(r,{view='summary'}={}){
  const source=getResearchSource(r),sourceView=view==='source'&&source;
  const selector=source?`<div class="research-content-switch" role="group" aria-label="읽기 내용"><button type="button" data-reader-view="summary" aria-pressed="${!sourceView}">연구 요약</button><button type="button" data-reader-view="source" aria-pressed="${Boolean(sourceView)}">보관 원문 <span>CC0</span></button></div>`:'';
  return `<div class="research-reading-progress" aria-hidden="true"><span></span></div><header class="research-reader-nav"><div><span class="research-wordmark">ATLAS</span><span class="research-nav-divider">/</span><span>RESEARCH</span></div><div class="research-reader-actions"><button type="button" data-reader-action="back" ${previousEntries.length?'':'hidden'} aria-label="이전 연구 글">←</button><button type="button" data-reader-action="download">${sourceView?'원문 MD 저장':'요약 MD 저장'}</button><button type="button" data-reader-action="close" aria-label="연구 글 닫기">닫기 ×</button></div></header>
  <div class="research-reader-scroll"><article class="research-article"><header class="research-article-heading"><div class="research-tags">${r.symbols.map(symbol=>`<span>${esc(symbol)}</span>`).join('')}<span>${esc(RESEARCH_CATEGORIES[r.category]||r.category)}</span></div><h1 id="research-reader-title">${esc(r.title)}</h1><p class="research-deck">${esc(r.originalTitle||r.title)}</p><div class="research-byline"><span class="research-avatar" aria-hidden="true">${esc((r.publisher||'A').slice(0,1))}</span><div><strong>${esc(r.author)}</strong><span>${esc(r.publisher)} · ${esc(r.publishedAt||'발행일 미확인')}</span></div></div><div class="research-meta"><span>검토 기록 ${esc(r.reviewedAt)}</span><span>${sourceView?'원문 전체':`${Math.max(1,Math.ceil((r.summary.length+r.claims.map(c=>c.assessment).join('').length+r.limitations.join('').length)/450))}분 읽기`}</span><a href="${esc(safe(r.url))}" target="_blank" rel="noopener noreferrer">원문 열기 ↗</a></div></header>
  ${selector}${sourceView?researchSourceMarkup(source):summaryMarkup(r,source)}</article></div>`;
}

function mount(){
  if(dialog?.isConnected)return;
  dialog=document.createElement('dialog');dialog.id='research-reader';dialog.className='research-reader';dialog.setAttribute('aria-labelledby','research-reader-title');document.body.append(dialog);mountDialogViewport(dialog);
  dialog.addEventListener('click',event=>{
    const related=event.target.closest('[data-research-article]');
    if(related){openResearchArticle(related.dataset.researchArticle,{keepHistory:true,view:'summary'});return;}
    const view=event.target.closest('[data-reader-view]')?.dataset.readerView;
    if(view&&current){renderCurrent(view);dialog.querySelector(`[data-reader-view="${currentView}"]`)?.focus({preventScroll:true});return;}
    const action=event.target.closest('[data-reader-action]')?.dataset.readerAction;
    if(action==='close')dialog.close();
    if(action==='back'&&previousEntries.length){const entry=previousEntries.pop();openResearchArticle(entry.id,{fromBack:true,view:entry.view});}
    if(action==='download'&&current){
      const source=currentView==='source'?getResearchSource(current):null;
      const link=document.createElement('a');link.download=source?`${source.id}.md`:`${current.id}.md`;
      link.href=URL.createObjectURL(new Blob([source?researchSourceText(current):researchArticleMarkdown(current)],{type:'text/markdown;charset=utf-8'}));
      link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);
    }
    if(event.target===dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close();}
  });
  dialog.addEventListener('keydown',event=>event.stopPropagation());
  dialog.addEventListener('close',()=>{
    const url=new URL(location.href);url.searchParams.delete('article');url.searchParams.delete('article-view');
    try{history.replaceState(null,'',url);}catch{}
    if(!document.querySelector('dialog[open]')&&opener?.isConnected)opener.focus({preventScroll:true});
    previousEntries=[];currentView='summary';
  });
  document.addEventListener('atlas:modal-open',event=>{if(event.detail?.id!==dialog.id&&dialog.open)dialog.close();});
}

function renderCurrent(view){
  currentView=view==='source'&&getResearchSource(current)?'source':'summary';
  dialog.innerHTML=researchArticleMarkup(current,{view:currentView});
  const scroll=dialog.querySelector('.research-reader-scroll');scroll.scrollTop=0;
  scroll.addEventListener('scroll',()=>{dialog.querySelector('.research-reading-progress span').style.width=`${100*scroll.scrollTop/Math.max(1,scroll.scrollHeight-scroll.clientHeight)}%`;},{passive:true});
  const url=new URL(location.href);url.searchParams.set('article',current.id);
  if(currentView==='source')url.searchParams.set('article-view','source');else url.searchParams.delete('article-view');
  try{history.replaceState(null,'',url);}catch{}
}

export function openResearchArticle(id,{opener:requestedOpener,keepHistory=false,fromBack=false,view}={}){
  const record=getResearchArticle(id);if(!record)return false;
  mount();
  if(!dialog.open){opener=requestedOpener||document.activeElement;previousEntries=[];}
  else if(keepHistory&&current)previousEntries.push({id:current.id,view:currentView});
  else if(!fromBack)previousEntries=[];
  const url=new URL(location.href);
  const requestedView=view??((url.searchParams.get('article')===id||url.searchParams.get('article')===record.id)?url.searchParams.get('article-view'):'summary');
  current=record;renderCurrent(requestedView);
  document.dispatchEvent(new CustomEvent('atlas:modal-open',{detail:{id:dialog.id}}));
  if(!dialog.open)dialog.showModal();
  const title=dialog.querySelector('h1');title.tabIndex=-1;title.focus({preventScroll:true});
  return true;
}
