import {RESEARCH_ARTICLES, RESEARCH_CATEGORIES, openResearchArticle} from './research-reader.js?v=1.18.0';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize=v=>String(v??'').normalize('NFKC').toLocaleLowerCase();
const rows=RESEARCH_ARTICLES;
const searchable=new Map(rows.map(r=>[r.id,normalize([r.title,r.originalTitle,r.author,r.publisher,r.summary,...r.claims.flatMap(c=>[c.claim,c.assessment]),...r.symbols].join(' '))]));
let visible=false,initialized=false,frame=0,start=0,shown=0,query='',asset='all',category='all',previous=[];
function filtered(){const terms=normalize(query).trim().split(/\s+/).filter(Boolean);return rows.filter(r=>(asset==='all'||r.symbols.includes(asset))&&(category==='all'||r.category===category)&&terms.every(term=>searchable.get(r.id).includes(term)));}
function rowMarkup(r){return `<tr data-evidence-id="${r.id}"><td class="evidence-rank">${String(r.rank).padStart(2,'0')}</td><td class="evidence-title"><button class="research-open" type="button" data-evidence-detail="${r.id}" aria-label="${esc(r.title)} 연구 본문 읽기"><span class="evidence-title-text">${esc(r.title)}</span><span class="research-row-meta">${r.symbols.join(' · ')}</span></button></td><td class="evidence-publisher">${esc(r.publisher)}</td><td class="evidence-date">${esc(r.publishedAt||'미확인')}</td><td class="evidence-role">${esc(RESEARCH_CATEGORIES[r.category]||r.category)}</td><td class="evidence-grade"><button type="button" data-evidence-detail="${r.id}" aria-label="${esc(r.title)} 요약과 검토 읽기"><span class="research-summary-badge">읽기</span></button></td></tr>`;}
function render(){
 const view=document.querySelector('#evidence-view'),shell=view.querySelector('.evidence-table-shell'),table=shell.querySelector('table'),body=document.querySelector('#evidence-body'),list=filtered();
 start=list.length?Math.min(start,list.length-1):0;
 const room=shell.clientHeight,head=(table.caption?.getBoundingClientRect().height||0)+(table.tHead?.getBoundingClientRect().height||0),rowHeight=parseFloat(getComputedStyle(view).getPropertyValue('--evidence-row-height'))||(shell.clientWidth<680?64:56);
 shown=Math.min(Math.max(1,Math.floor((room-head-4)/rowHeight)||6),list.length-start);
 body.innerHTML=shown?list.slice(start,start+shown).map(rowMarkup).join(''):'<tr class="evidence-empty"><td colspan="6">일치하는 자료가 없습니다. 검색어와 분류를 확인해 주세요.</td></tr>';
 while(visible&&room>0&&shown>1&&table.getBoundingClientRect().height>room+1){body.lastElementChild.remove();shown--;}
 document.querySelector('#evidence-total').textContent=`${list.length} / ${rows.length}개`;
 document.querySelector('#evidence-progress').textContent=list.length?`${start+1}–${start+shown} / ${list.length}`:'0개';
 document.querySelector('#evidence-prev').disabled=start===0;document.querySelector('#evidence-more').disabled=start+shown>=list.length;document.querySelector('#evidence-clear').disabled=!query&&asset==='all'&&category==='all';
 if(visible)document.dispatchEvent(new CustomEvent('atlas:page-ready',{detail:{page:'evidence'}}));
}
function schedule(){if(frame)cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{frame=0;if(visible)render();});}
function persistFilters(){const url=new URL(location.href);for(const [key,value] of [['research-asset',asset==='all'?null:asset],['research-category',category==='all'?null:category],['research-q',query||null]]){if(value===null)url.searchParams.delete(key);else url.searchParams.set(key,value);}try{history.replaceState(null,'',url);}catch{}}
function reset(){start=0;previous=[];persistFilters();render();schedule();}
export function initEvidenceView(){
 if(initialized)return;initialized=true;
 const view=document.querySelector('#evidence-view'),shell=view.querySelector('.evidence-table-shell'),params=new URLSearchParams(location.search);
 asset=['BTCUSD','ETHUSD','MSTR','BMNR'].includes(params.get('research-asset'))?params.get('research-asset'):'all';
 category=Object.hasOwn(RESEARCH_CATEGORIES,params.get('research-category'))?params.get('research-category'):'all';query=params.get('research-q')||'';
 const controls=document.createElement('div');controls.className='evidence-controls';
 controls.innerHTML=`<label class="evidence-search"><input id="evidence-search" type="search" placeholder="제목 · 글쓴이 · 주장 검색" aria-label="연구 자료 검색" autocomplete="off"></label><label class="evidence-filter"><select id="evidence-asset" aria-label="리서치 종목"><option value="all">전체 종목</option>${['BTCUSD','ETHUSD','MSTR','BMNR'].map(s=>`<option value="${s}">${s}</option>`).join('')}</select></label><label class="evidence-filter"><select id="evidence-filter" aria-label="리서치 분류"><option value="all">전체 분류</option>${Object.entries(RESEARCH_CATEGORIES).map(([id,label])=>`<option value="${id}">${label}</option>`).join('')}</select></label><button id="evidence-clear" type="button">초기화</button>`;
 view.insertBefore(controls,shell);document.querySelector('#evidence-asset').value=asset;document.querySelector('#evidence-filter').value=category;document.querySelector('#evidence-search').value=query;
 const pager=document.createElement('nav');pager.className='evidence-pagination';pager.setAttribute('aria-label','리서치 자료 페이지');pager.innerHTML='<button id="evidence-prev" type="button">← 이전</button>';
 const more=document.querySelector('#evidence-more');more.textContent='다음 →';pager.append(document.querySelector('#evidence-progress'),more,document.querySelector('#evidence-end'));view.append(pager);view.querySelector('tfoot').hidden=true;document.querySelector('#evidence-end').hidden=true;
 document.querySelector('#evidence-search').addEventListener('input',e=>{query=e.target.value;reset();});
 document.querySelector('#evidence-asset').addEventListener('change',e=>{asset=e.target.value;reset();});
 document.querySelector('#evidence-filter').addEventListener('change',e=>{category=e.target.value;reset();});
 document.querySelector('#evidence-clear').onclick=()=>{query='';asset=category='all';document.querySelector('#evidence-search').value='';document.querySelector('#evidence-asset').value='all';document.querySelector('#evidence-filter').value='all';reset();};
 more.onclick=()=>{if(start+shown>=filtered().length)return;previous.push(start);start+=shown;render();};document.querySelector('#evidence-prev').onclick=()=>{start=previous.length?previous.pop():Math.max(0,start-Math.max(1,shown));render();};
 document.querySelector('#evidence-body').addEventListener('click',e=>{const button=e.target.closest('[data-evidence-detail]');if(button)openResearchArticle(button.dataset.evidenceDetail,{opener:button});});
 if('ResizeObserver'in window)new ResizeObserver(schedule).observe(shell);window.addEventListener('resize',schedule);window.visualViewport?.addEventListener('resize',schedule);document.fonts?.ready.then(schedule);render();
 const requested=params.get('article');if(requested){const open=()=>openResearchArticle(requested);if(document.documentElement.dataset.boot==='ready')open();else document.addEventListener('atlas:ready',open,{once:true});}
}
export function showEvidenceView(value){visible=value;if(value)schedule();else if(frame){cancelAnimationFrame(frame);frame=0;}}
