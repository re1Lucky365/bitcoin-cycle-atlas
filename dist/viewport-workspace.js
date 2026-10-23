import { DATA_UPDATE } from './data-update.js?v=1.11.0';
import { mountWorkbenchChrome } from './workbench-chrome.js?v=1.11.0-milestones.3';
import { mountResearchWorkbench } from './research-workbench.js?v=1.11.0';
import { mountAnalysisIndicators } from './analysis-dock.js?v=1.11.0-indicators.1';
import { mountIndicatorWorkbench } from './indicator-workbench.js?v=1.11.0-milestones.3';
import { inspectionPanelAction } from './inspection-policy.js?v=1.11.0';
import { mountMobileWorkspace } from './mobile-workspace.js?v=1.11.0';

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const kst = value => value ? new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value)) : '첫 갱신 대기';
const compactKst = value => {
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value)).map(part=>[part.type,part.value]));
  return `${parts.month}.${parts.day} ${parts.hour}:${parts.minute}`;
};

function readerClone(node) {
  const copy=node.cloneNode(true);
  if(copy.nodeType===Node.ELEMENT_NODE){
    for(const element of [copy,...copy.querySelectorAll('[id],[autofocus]')]){element.removeAttribute('id');element.removeAttribute('autofocus');}
  }
  return copy;
}

function readableBlocks(root) {
  const out=[];
  function visit(node) {
    if(node.nodeType===Node.TEXT_NODE){if(node.textContent.trim()){const p=document.createElement('p');p.textContent=node.textContent;out.push(p);}return;}
    if(node.nodeType!==Node.ELEMENT_NODE||node.matches('script,style,button,select,input,summary'))return;
    if(node.matches('table')){
      const headings=[...node.querySelectorAll('thead th')].map(n=>n.textContent);
      for(const row of node.querySelectorAll('tbody tr')){
        const section=document.createElement('section');section.className='reader-data-row';
        [...row.children].forEach((cell,i)=>{const p=document.createElement('p');const b=document.createElement('b');b.textContent=(headings[i]||'값')+' · ';p.append(b);p.insertAdjacentHTML('beforeend',cell.innerHTML);section.append(p);});
        out.push(section);
      }
    }else if(node.matches('dl')){
      for(const term of node.querySelectorAll('dt')){
        const p=document.createElement('p'),label=document.createElement('b');label.textContent=term.textContent+' · ';p.append(label);
        const value=term.nextElementSibling;if(value?.matches('dd'))p.insertAdjacentHTML('beforeend',value.innerHTML);out.push(p);
      }
    }else if(node.matches('ul,ol')){
      [...node.children].forEach((child,i)=>{const p=document.createElement('p');p.innerHTML=(node.matches('ol')?`${i+1}. `:'• ')+child.innerHTML;out.push(p);});
    }else if(node.matches('.lab-formula'))out.push(readerClone(node));
    else if(node.matches('div,section,details,article,header,footer')){
      [...node.childNodes].forEach(visit);
    }else if(node.matches('a')){const p=document.createElement('p');p.append(readerClone(node));out.push(p);}
    else if(!node.matches('br'))out.push(readerClone(node));
  }
  [...root.childNodes].forEach(visit);
  return out.map(readerClone);
}

// Split text through DOM ranges so links and inline formatting survive pagination.
function splitBlock(block) {
  const text=block.textContent;if(text.length<2)return null;
  let offset=Math.floor(text.length/2);
  for(let distance=0;distance<Math.min(80,offset);distance++){
    if(offset+distance<text.length-1&&/\s/u.test(text[offset+distance])){offset+=distance+1;break;}
    if(offset-distance>0&&/\s/u.test(text[offset-distance])){offset-=distance;break;}
  }
  if(/[\uD800-\uDBFF]/u.test(text[offset-1]))offset++;
  if(offset<=0||offset>=text.length)return null;
  const walker=document.createTreeWalker(block,NodeFilter.SHOW_TEXT);let node,remaining=offset;
  while((node=walker.nextNode())){if(remaining<=node.data.length)break;remaining-=node.data.length;}
  if(!node)return null;
  const before=document.createRange(),after=document.createRange();
  before.selectNodeContents(block);before.setEnd(node,remaining);
  after.selectNodeContents(block);after.setStart(node,remaining);
  const a=block.cloneNode(false),b=block.cloneNode(false);a.append(before.cloneContents());b.append(after.cloneContents());
  return [a,b];
}

function pager(panel,body) {
  const nav=document.createElement('nav');nav.className='reader-pagination';nav.setAttribute('aria-label','설명 페이지');
  nav.innerHTML='<button type="button" aria-label="이전 설명 페이지">←</button><span role="status" aria-live="polite"></span><button type="button" aria-label="다음 설명 페이지">→</button>';
  body.after(nav);body.classList.add('reader-body');
  const [prev,next]=nav.querySelectorAll('button'),label=nav.querySelector('span');
  let blocks=[],pages=[],current=0,frame=0,enabled=true;
  const paint=()=>{body.replaceChildren(...(pages[current]||[]).map(n=>n.cloneNode(true)));label.textContent=`${current+1} / ${Math.max(1,pages.length)}`;prev.disabled=current===0;next.disabled=current>=pages.length-1;};
  function fit(){
    if(!enabled||panel.hidden)return;
    const height=body.clientHeight;
    if(height<40)return;
    pages=[];let page=[];body.replaceChildren();
    const queue=blocks.map(n=>n.cloneNode(true));
    while(queue.length){
      const block=queue.shift();body.append(block);
      if(body.scrollHeight>height+1){
        block.remove();
        if(page.length){pages.push(page);page=[];body.replaceChildren();queue.unshift(block);continue;}
        const parts=splitBlock(block);if(parts){queue.unshift(...parts);continue;}
      }
      page.push(block.cloneNode(true));
    }
    if(page.length||!pages.length)pages.push(page);
    current=Math.min(current,pages.length-1);paint();
  }
  prev.onclick=()=>{current--;paint();};next.onclick=()=>{current++;paint();};
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(()=>{frame=0;fit();});};
  new ResizeObserver(schedule).observe(body);
  document.fonts?.ready.then(schedule);
  return {
    set(root,{preservePage=false}={}){enabled=true;nav.hidden=false;blocks=readableBlocks(root);if(!preservePage)current=0;schedule();},
    suspend(){enabled=false;nav.hidden=true;if(frame){cancelAnimationFrame(frame);frame=0;}},
    fit:schedule
  };
}

export function initViewportWorkspace(icon) {
  const stage=$('#lab-chart-stage'),plot=document.createElement('div');plot.className='atlas-plot';
  plot.append(...stage.childNodes);stage.append(plot);
  plot.prepend($('#lab-metrics'));plot.append($('.lab-chart-foot'));
  stage.append($('#atlas-cycle-panel'),$('.lab-chart-meta'),$('.atlas-inspector'),$('#atlas-event-rail'));
  const tools=document.createElement('div');tools.className='atlas-canvas-tools';
  tools.innerHTML='<button data-reader="selection">값·근거</button><button data-reader="guide">읽는 법</button><button data-reader="math">계산식</button><button data-reader="update" id="atlas-update-status" title="자동 갱신 상태"></button>';
  stage.append(tools);
  const workspace=$('.workspace');workspace.classList.add('atlas-details-layout');workspace.dataset.detailsOpen='false';
  const reader=document.createElement('aside');reader.id='chart-reader';reader.className='chart-details-panel';reader.hidden=true;reader.setAttribute('aria-labelledby','chart-reader-title');
  reader.innerHTML='<div class="reader-heading"><h2 id="chart-reader-title" tabindex="-1"></h2><button type="button" aria-label="상세 패널 닫기" title="상세 패널 닫기">'+icon('close')+'</button></div><div id="chart-detail-actions" class="chart-detail-actions" role="group" aria-label="선택한 날짜 이동" hidden></div><div id="chart-reader-body"></div>';
  workspace.append(reader);
  const body=$('#chart-reader-body'),readerPager=pager(reader,body);
  const overlay=matchMedia('(max-width:900px)');
  function syncOverlay(){
    const covers=!reader.hidden&&overlay.matches;
    $('#main').inert=covers;$('.atlas-sidebar').inert=covers;
    reader.dataset.overlay=String(covers);
    if(covers&&!reader.contains(document.activeElement)&&!document.activeElement?.closest('.workbench-rail'))$('#chart-reader-title').focus({preventScroll:true});
  }
  overlay.addEventListener('change',syncOverlay);
  const resize=document.createElement('div');resize.className='reader-resize';resize.tabIndex=0;
  resize.setAttribute('role','separator');resize.setAttribute('aria-orientation','vertical');resize.setAttribute('aria-label','상세 패널 너비');resize.setAttribute('aria-valuemin','280');resize.setAttribute('aria-valuemax','420');resize.setAttribute('aria-valuenow','320');reader.prepend(resize);
  function sizeReader(value){
    const rail=Math.ceil(workspace.querySelector('.workbench-rail')?.getBoundingClientRect().width||38),max=Math.max(280,Math.min(420,workspace.clientWidth-rail-480));
    const width=Math.round(Math.max(280,Math.min(max,value)));workspace.style.setProperty('--detail-width',`${width}px`);resize.setAttribute('aria-valuenow',String(width));resize.setAttribute('aria-valuemax',String(max));
  }
  window.addEventListener('resize',()=>{if(!reader.hidden&&!overlay.matches)sizeReader(parseFloat(workspace.style.getPropertyValue('--detail-width'))||320);});
  let resizeStart=null;
  resize.addEventListener('pointerdown',event=>{if(event.button!==0||overlay.matches)return;event.preventDefault();resizeStart={x:event.clientX,width:reader.getBoundingClientRect().width};resize.setPointerCapture(event.pointerId);});
  resize.addEventListener('pointermove',event=>{if(resizeStart)sizeReader(resizeStart.width+resizeStart.x-event.clientX);});
  const endResize=()=>{resizeStart=null;};resize.addEventListener('pointerup',endResize);resize.addEventListener('pointercancel',endResize);
  resize.addEventListener('dblclick',()=>sizeReader(320));
  resize.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home'].includes(event.key))return;event.preventDefault();sizeReader(event.key==='Home'?320:reader.getBoundingClientRect().width+(event.key==='ArrowLeft'?20:-20));});

  const title=$('#chart-reader-title'),actions=$('#chart-detail-actions');
  const controlStore=document.createElement('div');controlStore.id='chart-control-store';controlStore.hidden=true;stage.append(controlStore);
  const liveControls=new Map();
  function returnControls(){for(const control of liveControls.values())if(control.parentElement===body)controlStore.append(control);delete body.dataset.controls;}
  let selectedKind='observed',selectedOwner='price';
  let update={...DATA_UPDATE},selectedSources=[],displayedObservationDate=DATA_UPDATE.latestObservationDate,browserCheckedAt=null,opener=null,lastDialogTrigger=null;
  const expanded=()=>document.querySelectorAll('[data-reader]').forEach(button=>{button.setAttribute('aria-controls',reader.id);button.setAttribute('aria-expanded',String(!reader.hidden&&button.dataset.reader===reader.dataset.kind));});
  function rememberOpener(element){
    const target=element?.nodeType===Node.ELEMENT_NODE?element:document.activeElement;
    if(target&&target!==document.body&&!reader.contains(target))opener={element:target,id:target.id,evidenceId:target.dataset?.evidenceDetail};
  }
  function restoreOpener(){
    const saved=opener;
    const focus=()=>{
      let target=saved?.element;
      if(!target?.isConnected||!target.getClientRects().length)target=saved?.id?document.getElementById(saved.id):null;
      if((!target||!target.getClientRects().length)&&saved?.evidenceId)target=[...document.querySelectorAll('[data-evidence-detail]')].find(button=>button.dataset.evidenceDetail===saved.evidenceId);
      if(!target||!target.getClientRects().length)target=[...document.querySelectorAll('#lab-chart,#atlas-analysis-chart,.atlas-nav [aria-current=page]')].find(node=>node.getClientRects().length);
      target?.focus({preventScroll:true});
    };
    focus();
    // Docking resizes the research table, which may replace its opening button.
    requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(()=>{if(document.activeElement===document.body)focus();},0)));
  }
  function closeReader({restoreFocus=true}={}){
    if(reader.hidden)return;
    returnControls();
    reader.hidden=true;workspace.dataset.detailsOpen='false';expanded();syncOverlay();
    document.dispatchEvent(new CustomEvent('atlas:panel-state',{detail:{open:false,kind:reader.dataset.kind}}));
    if(restoreFocus)restoreOpener();
  }
  reader.querySelector('button').onclick=()=>closeReader();
  document.addEventListener('keydown',event=>{
    if(event.key!=='Tab'||reader.hidden||!overlay.matches)return;
    const focusable=[...reader.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]'),...workspace.querySelectorAll('.workbench-rail button:not(:disabled)')].filter(node=>node.getClientRects().length);
    if(!focusable.length)return;const first=focusable[0],last=focusable.at(-1);
    if(event.shiftKey&&(document.activeElement===first||document.activeElement===title)){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  });
  function showReader(kind,heading,source,{focus=false,opener:trigger,preservePage=false}={}){
    const changed=reader.hidden||reader.dataset.kind!==kind;
    if(reader.hidden||focus)rememberOpener(trigger);
    returnControls();
    title.textContent=heading;title.title=heading;reader.dataset.kind=kind;actions.hidden=kind!=='selection'||selectedKind==='history'||selectedOwner==='countdown'||selectedOwner==='cycle';
    reader.hidden=false;workspace.dataset.detailsOpen='true';
    if(!overlay.matches)sizeReader(parseFloat(workspace.style.getPropertyValue('--detail-width'))||320);
    if(liveControls.has(kind)){readerPager.suspend();body.dataset.controls=kind;body.replaceChildren(liveControls.get(kind));}
    else readerPager.set(source,{preservePage});
    expanded();syncOverlay();
    if(focus){if($('#atlas-display-options'))$('#atlas-display-options').open=false;title.focus({preventScroll:true});}
    if(changed)document.dispatchEvent(new CustomEvent('atlas:panel-state',{detail:{open:true,kind}}));
  }
  const status=()=>{
    const pending=!update.checkedAt;
    $('#atlas-update-status').textContent=pending?'갱신 대기':`${compactKst(update.checkedAt)} KST`;
    $('#atlas-update-status').setAttribute('aria-label',pending?'자동 자료 갱신 첫 실행 대기 · 상세 보기':`자동 자료 갱신 확인 ${kst(update.checkedAt)} KST · 상세 보기`);
    $('#atlas-update-status').dataset.status=update.status;
    $('#atlas-update-status').title=`차트 ${displayedObservationDate||'—'} UTC · 자동 배포 ${update.latestObservationDate||'—'} UTC · ${pending?'첫 실행 대기':kst(update.checkedAt)+' KST 확인'} · 6시간마다`;
  };
  status();
  document.addEventListener('atlas:dataset',event=>{displayedObservationDate=event.detail.latestObservationDate;status();if(!reader.hidden&&reader.dataset.kind==='update')openReader('update',{preservePage:true});});
  document.addEventListener('atlas:inspection',event=>{
    selectedSources=event.detail.sources||[];selectedKind=event.detail.kind;selectedOwner=event.detail.owner||'price';actions.setAttribute('aria-label',selectedOwner==='analysis'?'선택한 분석 항목 이동':'선택한 날짜 이동');
    const action=inspectionPanelAction(event.detail,{open:!reader.hidden,kind:reader.dataset.kind});
    if(action!=='preserve')openReader('selection',{preservePage:action==='refresh'&&!event.detail.userInitiated});
  });
  document.addEventListener('atlas:open-detail',event=>openReader(event.detail?.kind,{focus:event.detail?.focus!==false,opener:event.detail?.opener}));
  function openReader(kind,options={}){
    const source=document.createElement('div');
    const titles={events:'비트코인 주요 사건',volume:'거래량 · 출처와 미래 모형',selection:selectedOwner==='analysis'?'분석 선택 · 값과 해석':selectedOwner==='countdown'?'다음 국면 · 조건부 근거':selectedKind==='history'?'역사 사건과 출처':'선택 데이터 · 고정',guide:'차트 사용법',math:'모델과 검증',update:'자료 갱신 상태',settings:'차트 설정',charts:'분석 패널',layers:'차트 레이어',scenarios:'미래 가정'};
    if(!titles[kind])return;
    if(liveControls.has(kind)){showReader(kind,titles[kind],null,options);return;}
    if(kind==='selection'){
      source.innerHTML=`<h3>${esc($('#atlas-inspector-title').textContent)}</h3><p class="reader-kind">${esc($('#atlas-inspector-kind').textContent)}</p>`;
      for(const value of $('#atlas-inspector-values').children){const p=document.createElement('p'),text=value.querySelector('strong');p.className=`reader-value${text.textContent.length>80?' reader-value-description':''}`;p.innerHTML=`<span>${value.querySelector('span').innerHTML}</span><b>${text.innerHTML}</b>`;source.append(p);}
      source.append($('#atlas-inspector-note').cloneNode(true));
      for(const item of selectedSources){const p=document.createElement('p'),a=document.createElement('a');a.href=item.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=item.title||item.url;p.append(a);source.append(p);}

    }else if(kind==='guide'){
      source.append($('.atlas-guide>div').cloneNode(true));
      source.insertAdjacentHTML('beforeend','<p>가격과 미래에서는 그래프를 눌러 날짜를 선택합니다. 오른쪽은 가격, 아래는 날짜입니다. ← → 키로 하루씩, 선택 상세의 이전·다음 버튼으로 고저점을 이동합니다.</p><p>휠로 확대·축소하고 가로로 드래그해 구간을 이동합니다. 왼쪽 −·+·초기화 아이콘도 같은 기능입니다. 이동 도구는 차트를 옮기고, 자 모양 도구는 두 날짜를 눌러 기간·가격 차이·변화율을 잽니다. 미래가 포함되면 가정 포함으로 표시합니다. 차트에 초점을 둔 상태에서 +·−·0 키를 사용할 수 있습니다.</p><p>상단 1m·5m·15m·30m·1h·4h·1D·1W는 표시 간격입니다. 선·캔들 버튼으로 표시 방식을 바꿉니다. 분·시간봉은 Coinbase의 완료된 실제 거래 봉이고, 1D·1W에서는 장기 전망이 이어집니다. 일·주봉 캔들과 거래량은 Bitstamp 현물 자료이며, 캔들이 없는 옛 기간은 Coin Metrics 일말 가격선을 유지합니다. 하단 기간 버튼은 화면에 보이는 범위입니다. 로그·선형은 눈금만 바꾸며 가격을 바꾸지 않습니다. 상단 인디케이터 창에서 4년 비교·구간 길이·고점권 도달·월·분기·CryptoCon 검증을 추가하거나 삭제합니다. 분석은 가격 차트 내부의 창에 별도의 축으로 표시되며, 좌측 위 목록에서 개별 숨김·표시·삭제를 조작합니다. 4년 비교의 가로축은 출발 후 경과일이며 달력 날짜가 아닙니다. 분석 항목을 눌러도 가격 날짜는 바뀌지 않으며, 날짜가 있는 항목만 ‘가격 차트에서 보기’로 연결합니다. 차트의 일반 클릭과 키보드 선택은 날짜·값만 고정하며 상세 패널의 열림 상태를 바꾸지 않습니다. 오른쪽 데이터 아이콘에서 고정한 날짜와 출처를 엽니다. 리서치와 원자료도 오른쪽 아이콘으로 엽니다. 고점권 도달과 실제 최고가 날짜는 서로 다를 수 있습니다.</p>');
      source.insertAdjacentHTML('beforeend','<h3>확대·이동과 빠른 조작</h3><p>포인터가 있는 곳을 중심으로 휠 확대·축소합니다. Shift+휠 또는 가로 휠은 이동합니다. 좌클릭 후 드래그하면 이동하고, 한 번 클릭하면 값을 고정합니다. 우클릭 또는 Shift+F10은 확대·전체 범위·선택 데이터 복사 메뉴를 엽니다. +·−는 확대·축소, Shift+←·→는 이동, 0·Alt+R·배경 더블클릭은 기본 범위 복원입니다. C는 십자선, H는 이동, M은 일·주봉 측정입니다.</p><h3>사건과 거래량</h3><p>사건 라벨의 색은 분류를 나타냅니다. 확대 수준에 따라 읽을 수 있는 라벨 수를 조절하며, 생략된 이름도 점과 전체 목록에서 찾을 수 있습니다. 클릭하면 원문과 사건 날짜의 해석을 확인합니다. 하단 주요 사건을 펼치면 표시 기간의 타임라인을 봅니다.</p><p>거래량 막대는 가격과 같은 날짜축을 사용하고 BTC 수량을 표시합니다. 일·주봉은 Bitstamp, 분·시간봉은 Coinbase BTC/USD 현물입니다. 실제 막대는 가격 상승·하락 봉과 같은 색을 씁니다. 장기 미래 거래량은 금색 점선과 가정 범위로 구별합니다. 모두 단일 거래소 BTC/USD를 기준으로 하며 세계 전체 물량이 아닙니다. 긴 범위에서 BTC 로그 축을 쓰면 제목에 표시하고, 0을 보존하는 log(1+수량) 눈금을 사용합니다. 우측 거래량 패널에서 출처·원문 교차 검증·모형 수식과 과거 예측 검증을 확인합니다.</p>');
    }else if(kind==='math'){
      const modelInfo=$('#atlas-model-info');if(modelInfo){const copy=modelInfo.cloneNode(true);copy.hidden=false;source.append(copy);}
      source.append($('#atlas-exact-details .lab-details-body').cloneNode(true));
    }
    else{
      source.innerHTML=`<p><b>현재 차트의 관측일</b><br>${esc(displayedObservationDate||'—')} UTC</p><p><b>자동 배포 자료의 관측일</b><br>${esc(update.latestObservationDate||'—')} UTC</p><p><b>자동 확인</b><br>${esc(kst(update.checkedAt))}${update.checkedAt?' KST':''}</p><p><b>가격 자료 변경</b><br>${esc(kst(update.dataUpdatedAt))} KST</p><p><b>상태</b><br>${esc({pending:'아직 자동 갱신을 실행하지 않았습니다.',validated:'검증을 통과한 새 일별 자료를 반영했습니다.','no-change':'확인 결과 새 완료 일봉이 없어 기존 자료를 유지했습니다.'}[update.status]||update.status)}</p><p>매일 03:20 · 09:20 · 15:20 · 21:20 KST에 확인합니다. GitHub 실행 대기나 데이터 제공 지연으로 시각이 달라질 수 있습니다. 당일 진행 중인 값은 제외합니다.</p><p>날짜 순서, 연속성, 양수 가격, 기존 기록 보존을 검증합니다. 실패하면 기존 공개 자료를 유지합니다. 차트는 갱신된 자료로 다시 계산하고, 과거 연구 보고서의 고정 표본은 유지합니다.</p><p><a href="https://github.com/twoimo/bitcoin-cycle-atlas/actions/workflows/refresh-data.yml" target="_blank" rel="noopener noreferrer">자동 갱신 실행 기록 ↗</a></p><p>Data © Coin Metrics · CC BY-NC 4.0 · 비상업 연구용 · UTC 일말 기준.</p>`;
      if(browserCheckedAt)source.insertAdjacentHTML('beforeend',`<p>이 브라우저에서 별도 확인한 시각 · ${esc(kst(browserCheckedAt))} KST</p>`);
      if(displayedObservationDate!==update.latestObservationDate)source.insertAdjacentHTML('beforeend','<p>이 기기에 저장됐거나 별도로 가져온 자료가 자동 배포 번들보다 최신입니다. 차트는 현재 차트의 관측일까지 표시합니다.</p>');
      if(update.runUrl)source.insertAdjacentHTML('beforeend',`<p><a href="${esc(update.runUrl)}" target="_blank" rel="noopener noreferrer">이 자료를 만든 실행 ↗</a></p>`);
    }
    showReader(kind,titles[kind],source,options);
  }
  mountWorkbenchChrome({icon,stage,workspace,plot,tools,controlStore,liveControls,openReader,closeReader,isReaderOpen:kind=>!reader.hidden&&reader.dataset.kind===kind});
  mountResearchWorkbench({stage,controlStore,liveControls,openReader,closeReader,isReaderOpen:kind=>!reader.hidden&&reader.dataset.kind===kind});
  mountAnalysisIndicators({stage,svg:$('#atlas-analysis-chart'),modeTabs:$('.atlas-mode-tabs'),controls:['atlas-cycle-controls','atlas-duration-controls','atlas-period-controls','atlas-cryptocon-controls'].map(id=>document.getElementById(id))});
  mountIndicatorWorkbench({plot,stage});
  mountMobileWorkspace({workspace,stage,plot,reader,closeReader});
  document.addEventListener('click',event=>{if(event.target.closest('[data-view]'))closeReader({restoreFocus:false});});
  document.addEventListener('atlas:close-detail',()=>closeReader({restoreFocus:false}));
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!reader.hidden){event.preventDefault();closeReader();}});
  document.addEventListener('click',event=>{const trigger=event.target.closest('[data-method],[data-evidence-detail]');if(trigger)lastDialogTrigger=trigger;},true);
  for(const name of ['method','evidence']){
    const dialog=$(`#${name}-dialog`),content=$(name==='method'?'#method-content':'#evidence-detail-body');
    document.addEventListener(`${name}:open`,()=>{
      const source=content.cloneNode(true),heading=$(name==='method'?'#method-title':'#evidence-detail-title').textContent;
      // Existing callers showModal() and dispatch synchronously, before a paint.
      if(dialog.open)dialog.close();
      showReader(name,heading,source,{focus:true,opener:lastDialogTrigger||document.activeElement});lastDialogTrigger=null;
    });
  }
  expanded();
  document.addEventListener('atlas:data-update',event=>{
    if(event.detail.status==='success'){
      browserCheckedAt=event.detail.checkedAt;displayedObservationDate=event.detail.latestObservationDate;status();
      if(!reader.hidden&&reader.dataset.kind==='update')openReader('update',{preservePage:true});
    }
  });
}
