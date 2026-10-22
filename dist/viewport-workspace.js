import { DATA_UPDATE } from './data-update.js';

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const kst = value => value ? new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value)) : '첫 갱신 대기';

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
    }else if(node.matches('ul,ol')){
      [...node.children].forEach(child=>{const p=document.createElement('p');p.innerHTML='• '+child.innerHTML;out.push(p);});
    }else if(node.matches('div,section,details,article,header,footer')){
      [...node.childNodes].forEach(visit);
    }else out.push(node.cloneNode(true));
  }
  [...root.childNodes].forEach(visit);
  return out;
}

function pager(dialog,body) {
  const nav=document.createElement('nav');nav.className='reader-pagination';nav.setAttribute('aria-label','설명 페이지');
  nav.innerHTML='<button type="button" aria-label="이전 설명 페이지">←</button><span role="status" aria-live="polite"></span><button type="button" aria-label="다음 설명 페이지">→</button>';
  body.after(nav);body.classList.add('reader-body');
  const [prev,next]=nav.querySelectorAll('button'),label=nav.querySelector('span');
  let blocks=[],pages=[],current=0;
  const paint=()=>{body.replaceChildren(...(pages[current]||[]).map(n=>n.cloneNode(true)));label.textContent=`${current+1} / ${Math.max(1,pages.length)}`;prev.disabled=current===0;next.disabled=current>=pages.length-1;};
  function fit(){
    if(!dialog.open)return;
    pages=[];let page=[];body.replaceChildren();
    const height=body.clientHeight;
    if(height<40)return;
    const queue=blocks.map(n=>n.cloneNode(true));
    while(queue.length){
      const block=queue.shift();body.append(block);
      if(body.scrollHeight>height+1){
        block.remove();
        if(page.length){pages.push(page);page=[];body.replaceChildren();queue.unshift(block);continue;}
        if(block.children.length>1){queue.unshift(...[...block.children].map(n=>n.cloneNode(true)));continue;}
        const words=block.textContent.split(/(?<=[。.!?])\s+|(?<=\s)/u);
        if(words.length>1){
          const mid=Math.ceil(words.length/2),a=document.createElement('p'),b=document.createElement('p');a.textContent=words.slice(0,mid).join('');b.textContent=words.slice(mid).join('');queue.unshift(a,b);continue;
        }
      }
      page.push(block.cloneNode(true));
    }
    if(page.length||!pages.length)pages.push(page);
    current=Math.min(current,pages.length-1);paint();
  }
  prev.onclick=()=>{current--;paint();};next.onclick=()=>{current++;paint();};
  new ResizeObserver(()=>{if(dialog.open)requestAnimationFrame(fit);}).observe(body);
  return {set(root){blocks=readableBlocks(root);current=0;requestAnimationFrame(fit);},fit};
}

export function initViewportWorkspace(icon) {
  const stage=$('#lab-chart-stage'),plot=document.createElement('div');plot.className='atlas-plot';
  plot.append(...stage.childNodes);stage.append(plot);
  stage.prepend($('#lab-metrics'),$('.lab-chart-meta'));
  stage.append($('.lab-chart-foot'),$('.atlas-inspector'),$('#atlas-event-rail'));
  const tools=document.createElement('div');tools.className='atlas-canvas-tools';
  tools.innerHTML='<button data-reader="selection">값·근거</button><button data-reader="guide">읽는 법</button><button data-reader="math">계산식</button><button data-reader="update" id="atlas-update-status" title="자동 갱신 상태"></button>';
  stage.append(tools);
  const reader=document.createElement('dialog');reader.id='chart-reader';reader.className='viewport-reader';reader.setAttribute('aria-labelledby','chart-reader-title');
  reader.innerHTML='<div class="reader-heading"><h2 id="chart-reader-title"></h2><button aria-label="설명 닫기">'+icon('close')+'</button></div><div id="chart-reader-body"></div>';
  stage.append(reader);reader.querySelector('button').onclick=()=>reader.close();
  const body=$('#chart-reader-body'),readerPager=pager(reader,body);
  let update={...DATA_UPDATE},selectedSources=[],displayedObservationDate=DATA_UPDATE.latestObservationDate,browserCheckedAt=null;
  const status=()=>{
    const pending=!update.checkedAt;
    $('#atlas-update-status').textContent=pending?'자동 갱신 · 첫 실행 대기':`갱신 확인 ${kst(update.checkedAt)} KST`;
    $('#atlas-update-status').dataset.status=update.status;
    $('#atlas-update-status').title=`차트 ${displayedObservationDate||'—'} UTC · 자동 배포 ${update.latestObservationDate||'—'} UTC · ${pending?'첫 실행 대기':kst(update.checkedAt)+' KST 확인'} · 6시간마다`;
  };
  status();
  document.addEventListener('atlas:dataset',event=>{displayedObservationDate=event.detail.latestObservationDate;status();});
  document.addEventListener('atlas:inspection',event=>{selectedSources=event.detail.sources||[];});
  function openReader(kind){
    const source=document.createElement('div');
    const titles={selection:'선택한 값과 근거',guide:'차트 읽는 법',math:'계산식과 검증',update:'자료 갱신 상태'};
    $('#chart-reader-title').textContent=titles[kind];
    if(kind==='selection'){
      source.innerHTML=`<h3>${esc($('#atlas-inspector-title').textContent)}</h3><p>${esc($('#atlas-inspector-kind').textContent)}</p>`;
      for(const value of $('#atlas-inspector-values').children){const p=document.createElement('p');p.innerHTML=`<b>${value.querySelector('span').innerHTML}</b><br>${value.querySelector('strong').innerHTML}`;source.append(p);}
      source.append($('#atlas-inspector-note').cloneNode(true));
      for(const item of selectedSources){const p=document.createElement('p'),a=document.createElement('a');a.href=item.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=item.title||item.url;p.append(a);source.append(p);}
      source.append($('#atlas-chart-note').cloneNode(true));
      const legend=$('#atlas-chart-legend').cloneNode(true);legend.querySelectorAll('span').forEach(n=>{const p=document.createElement('p');p.textContent=n.textContent;source.append(p);});
    }else if(kind==='guide'){
      source.append($('.atlas-guide>div').cloneNode(true));
      source.insertAdjacentHTML('beforeend','<p>가격과 미래에서는 그래프를 눌러 날짜를 선택합니다. 오른쪽은 가격, 아래는 날짜입니다. ← → 키로 하루씩, 아래 이전·다음 버튼으로 고저점을 이동합니다.</p><p>휠로 확대·축소하고 가로로 드래그해 구간을 이동합니다. 차트 안의 −·+·방향·초기화 아이콘도 같은 기능입니다. 차트에 초점을 둔 상태에서 +·−·0 키를 사용할 수 있습니다.</p><p>다른 그래프는 실제 관측 자료의 비교입니다. ⓘ에서 선택한 구간의 모든 수치와 출처를 확인합니다. 리서치와 원자료는 왼쪽 아이콘으로 엽니다. 고점권 도달과 실제 최고가 날짜는 서로 다를 수 있습니다.</p>');
    }else if(kind==='math')source.append($('#atlas-exact-details .lab-details-body').cloneNode(true));
    else{
      source.innerHTML=`<p><b>현재 차트의 관측일</b><br>${esc(displayedObservationDate||'—')} UTC</p><p><b>자동 배포 자료의 관측일</b><br>${esc(update.latestObservationDate||'—')} UTC</p><p><b>자동 확인</b><br>${esc(kst(update.checkedAt))}${update.checkedAt?' KST':''}</p><p><b>가격 자료 변경</b><br>${esc(kst(update.dataUpdatedAt))} KST</p><p><b>상태</b><br>${esc({pending:'아직 자동 갱신을 실행하지 않았습니다.',validated:'검증을 통과한 새 일별 자료를 반영했습니다.','no-change':'확인 결과 새 완료 일봉이 없어 기존 자료를 유지했습니다.'}[update.status]||update.status)}</p><p>매일 03:20 · 09:20 · 15:20 · 21:20 KST에 확인합니다. GitHub 실행 대기나 데이터 제공 지연으로 시각이 달라질 수 있습니다. 당일 진행 중인 값은 제외합니다.</p><p>날짜 순서, 연속성, 양수 가격, 기존 기록 보존을 검증합니다. 실패하면 기존 공개 자료를 유지합니다. 차트는 갱신된 자료로 다시 계산하고, 과거 연구 보고서의 고정 표본은 유지합니다.</p><p><a href="https://github.com/twoimo/bitcoin-cycle-atlas/actions/workflows/refresh-data.yml" target="_blank" rel="noopener noreferrer">자동 갱신 실행 기록 ↗</a></p><p>Data © Coin Metrics · CC BY-NC 4.0 · 비상업 연구용 · UTC 일말 기준.</p>`;
      if(browserCheckedAt)source.insertAdjacentHTML('beforeend',`<p>이 브라우저에서 별도 확인한 시각 · ${esc(kst(browserCheckedAt))} KST</p>`);
      if(displayedObservationDate!==update.latestObservationDate)source.insertAdjacentHTML('beforeend','<p>이 기기에 저장됐거나 별도로 가져온 자료가 자동 배포 번들보다 최신입니다. 차트는 현재 차트의 관측일까지 표시합니다.</p>');
      if(update.runUrl)source.insertAdjacentHTML('beforeend',`<p><a href="${esc(update.runUrl)}" target="_blank" rel="noopener noreferrer">이 자료를 만든 실행 ↗</a></p>`);
    }
    reader.showModal();readerPager.set(source);
  }
  tools.querySelectorAll('[data-reader]').forEach(button=>button.onclick=()=>openReader(button.dataset.reader));
  const heading=document.createElement('div');heading.className='atlas-canvas-heading';
  const menu=document.createElement('details');menu.id='atlas-mode-menu';menu.className='atlas-mode-menu';
  menu.innerHTML=`<summary aria-label="그래프 종류" title="그래프 종류">${icon('chart')}</summary>`;
  menu.append($('.atlas-mode-tabs'));
  menu.querySelectorAll('[data-atlas-mode]').forEach(button=>button.addEventListener('click',()=>{menu.open=false;}));
  const modeName=document.createElement('span');modeName.id='atlas-mode-name';modeName.textContent='가격과 미래';
  const settings=$('#atlas-display-options'),settingsBody=$('.atlas-settings-body');
  settings.querySelector('summary').innerHTML=icon('layers');settings.querySelector('summary').setAttribute('aria-label','차트 설정');settings.querySelector('summary').title='차트 설정';
  const controlSets=[...document.querySelectorAll('.atlas-controls>.atlas-control-set')];
  settingsBody.prepend(...controlSets);
  settingsBody.append($('#atlas-reset'));
  const selection=tools.querySelector('[data-reader=selection]');selection.innerHTML=icon('info');selection.title='선택한 값과 근거';selection.setAttribute('aria-label','선택한 값과 근거');
  $('.atlas-inspector-actions').append(selection);
  const math=tools.querySelector('[data-reader=math]');math.innerHTML=icon('book');math.title='계산식과 검증';math.setAttribute('aria-label','계산식과 검증');$('.atlas-setting-downloads').append(math);
  const updateButton=$('#atlas-update-status');heading.append(menu,modeName,updateButton,settings);
  $('.atlas-controls').remove();tools.remove();stage.prepend(heading);
  document.addEventListener('click',event=>{if(!menu.contains(event.target))menu.open=false;});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')menu.open=false;});
  $('#atlas-latest').innerHTML=icon('clock');$('#atlas-latest').title='최근 관측으로';$('#atlas-latest').setAttribute('aria-label','최근 관측으로');
  const help=document.createElement('button');help.className='sidebar-help';help.title='차트 읽는 법';help.setAttribute('aria-label','차트 읽는 법');help.innerHTML=icon('info');help.onclick=()=>openReader('guide');$('.atlas-sidebar').append(help);
  for(const name of ['method','evidence']){
    const dialog=$(`#${name}-dialog`),content=$(name==='method'?'#method-content':'#evidence-detail-body');dialog.classList.add('viewport-reader');const controller=pager(dialog,content);
    document.addEventListener(`${name}:open`,()=>controller.set(content.cloneNode(true)));
  }
  document.addEventListener('atlas:data-update',event=>{
    if(event.detail.status==='success'){
      browserCheckedAt=event.detail.checkedAt;displayedObservationDate=event.detail.latestObservationDate;status();
    }
  });
}
