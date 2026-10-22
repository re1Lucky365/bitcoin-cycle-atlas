export const ANALYSIS_MODES = Object.freeze([
  {id:'cycles',label:'4년 비교'},
  {id:'duration',label:'구간 길이'},
  {id:'peaks',label:'고점권 도달'},
  {id:'periods',label:'월·분기'},
  {id:'cryptocon',label:'CryptoCon 검증'}
]);

const modeIds=new Set(ANALYSIS_MODES.map(item=>item.id));

// `analysis` already belongs to the legacy comparison page. Keep old chart links.
export function readAnalysisDockState(search='') {
  const params=search instanceof URLSearchParams?search:new URLSearchParams(search);
  const legacyCompare=params.get('page')==='compare'&&!params.has('legacy')&&params.get('chart')!=='price';
  const selected=modeIds.has(params.get('chart'))?params.get('chart'):null;
  return {mode:selected||'cycles',open:params.get('dock')!=='closed'&&Boolean(selected||legacyCompare)};
}

export function writeAnalysisDockState(params,{mode,open}) {
  if(!modeIds.has(mode))throw new TypeError('Unknown analysis view');
  if(open||mode!=='cycles'){params.set('chart',mode);open?params.delete('dock'):params.set('dock','closed');}
  else{params.delete('chart');params.delete('dock');}
  return params;
}

export function analysisCalendarDate(detail,{firstDate,lastDate}={}) {
  const date=detail?.date;
  if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date))return null;
  const time=Date.parse(`${date}T00:00:00Z`);
  if(!Number.isFinite(time)||new Date(time).toISOString().slice(0,10)!==date)return null;
  if(firstDate&&date<firstDate||lastDate&&date>lastDate)return null;
  return date;
}

export function shouldPublishInspection({owner,currentOwner,user=false}) {
  return Boolean(user)||owner===currentOwner;
}

export function dockHeight({availableHeight,open}) {
  if(!open)return 40;
  // The independent analysis axis can scroll inside its panel on small screens.
  // Reserve at least half of the canvas region for the navigable price chart.
  return Math.max(40,Math.min(340,Math.round(Math.max(0,availableHeight)*.48)));
}

export function mountAnalysisDock({stage,svg,modeTabs,controls}) {
  const doc=stage.ownerDocument;
  const command=(action,value)=>doc.dispatchEvent(new CustomEvent('atlas:analysis-command',{detail:{action,value}}));
  const dock=doc.createElement('section');dock.id='analysis-dock';dock.className='analysis-dock';dock.dataset.open='false';dock.setAttribute('aria-label','과거 자료 분석 패널');
  const header=doc.createElement('div');header.className='analysis-dock-header';
  const heading=doc.createElement('span');heading.className='analysis-dock-label';heading.textContent='분석';
  modeTabs.className='analysis-dock-tabs';modeTabs.setAttribute('role','tablist');modeTabs.setAttribute('aria-label','주 가격 차트 아래에서 볼 분석');
  modeTabs.querySelector('[data-atlas-mode="price"]')?.remove();
  for(const button of modeTabs.querySelectorAll('[data-atlas-mode]')){
    const mode=button.dataset.atlasMode;button.id=`analysis-tab-${mode}`;button.type='button';button.setAttribute('role','tab');button.setAttribute('aria-controls','analysis-dock-body');button.setAttribute('aria-selected','false');button.removeAttribute('aria-pressed');button.tabIndex=-1;
    button.onclick=()=>command('select',mode);
  }
  const toggle=doc.createElement('button');toggle.type='button';toggle.id='analysis-dock-toggle';toggle.className='analysis-dock-toggle';toggle.setAttribute('aria-controls','analysis-dock-body');toggle.onclick=()=>command('toggle');
  header.append(heading,modeTabs,toggle);
  const panel=doc.createElement('div');panel.id='analysis-dock-body';panel.className='analysis-dock-body';panel.setAttribute('role','tabpanel');panel.hidden=true;
  const meta=doc.createElement('div');meta.className='analysis-dock-meta';
  const title=doc.createElement('h3');title.id='analysis-dock-title';
  const caption=doc.createElement('p');caption.id='analysis-dock-caption';
  const legend=doc.createElement('div');legend.id='analysis-dock-legend';legend.className='analysis-dock-legend';
  meta.append(title,caption,legend);
  const controlRow=doc.createElement('div');controlRow.className='analysis-dock-controls';controlRow.append(...controls);
  const viewport=doc.createElement('div');viewport.id='analysis-chart-viewport';viewport.className='analysis-chart-viewport';svg.hidden=false;svg.removeAttribute('hidden');svg.setAttribute('role','group');svg.setAttribute('aria-describedby','analysis-dock-caption');viewport.append(svg);
  const selection=doc.createElement('div');selection.className='analysis-dock-selection';
  const prev=doc.createElement('button');prev.type='button';prev.id='analysis-inspect-prev';prev.textContent='←';prev.setAttribute('aria-label','이전 분석 항목');prev.onclick=()=>command('previous');
  const next=doc.createElement('button');next.type='button';next.id='analysis-inspect-next';next.textContent='→';next.setAttribute('aria-label','다음 분석 항목');next.onclick=()=>command('next');
  const summary=doc.createElement('button');summary.type='button';summary.id='analysis-selection-summary';summary.className='analysis-selection-summary';summary.textContent='분석 항목을 선택하면 값을 확인합니다.';summary.onclick=()=>command('inspect');
  const locate=doc.createElement('button');locate.type='button';locate.id='analysis-locate-date';locate.textContent='가격 차트에서 보기';locate.disabled=true;locate.onclick=()=>command('locate-date');
  const save=doc.createElement('button');save.type='button';save.id='analysis-save-svg';save.textContent='SVG';save.title='현재 분석 그래프만 SVG로 저장';save.setAttribute('aria-label',save.title);save.onclick=()=>command('save');
  selection.append(prev,next,summary,locate,save);
  const note=doc.createElement('p');note.id='analysis-dock-note';note.className='analysis-dock-note';
  panel.append(meta,controlRow,viewport,selection,note);dock.append(header,panel);
  stage.querySelector('.atlas-plot').after(dock);
  let current={mode:'cycles',open:false},sizeKey='';
  function size(){
    const plot=stage.querySelector('.atlas-plot');
    const availableHeight=(plot?.getBoundingClientRect().height||0)+dock.getBoundingClientRect().height;
    const height=dockHeight({availableHeight,open:current.open});
    const key=String(height);if(key!==sizeKey){sizeKey=key;dock.style.setProperty('--analysis-dock-height',`${height}px`);}
  }
  function setState(event){
    const nextState=event.detail||{};current={...current,...nextState};
    const mode=modeIds.has(current.mode)?current.mode:'cycles';
    dock.dataset.open=String(Boolean(current.open));dock.dataset.mode=mode;panel.hidden=!current.open;
    panel.setAttribute('aria-labelledby',`analysis-tab-${mode}`);
    for(const button of modeTabs.querySelectorAll('[data-atlas-mode]')){
      const selected=button.dataset.atlasMode===mode;button.setAttribute('aria-selected',String(selected));button.setAttribute('aria-expanded',String(selected&&current.open));button.tabIndex=selected?0:-1;
    }
    toggle.textContent=current.open?'접기':'펼치기';toggle.title=current.open?'분석을 접고 가격 차트를 넓게 보기':'선택한 분석 펼치기';toggle.setAttribute('aria-label',toggle.title);toggle.setAttribute('aria-expanded',String(Boolean(current.open)));
    const groups={cycles:'atlas-cycle-controls',duration:'atlas-duration-controls',periods:'atlas-period-controls',cryptocon:'atlas-cryptocon-controls'};
    for(const control of controls)control.hidden=control.id!==groups[mode];
    controlRow.hidden=!groups[mode];
    if(nextState.controller){
      const c=nextState.controller;title.textContent=c.title||'';caption.textContent=c.caption||'';note.textContent=c.note||'';
      legend.replaceChildren(...(c.legend||[]).map(item=>{const node=doc.createElement('span'),swatch=doc.createElement('i');swatch.style.borderColor=item.color;swatch.style.borderTopStyle=item.dashed?'dashed':'solid';node.append(swatch,doc.createTextNode(item.label));return node;}));
      prev.disabled=typeof c.previous!=='function'||Boolean(c.hasPrevious)&&!c.hasPrevious();next.disabled=typeof c.next!=='function'||Boolean(c.hasNext)&&!c.hasNext();
    }
    if(Object.hasOwn(nextState,'detail')){
      const detail=nextState.detail;summary.textContent=detail?`${detail.label} · ${detail.fields?.[0]?.value||'선택 값 보기'}`:'분석 항목을 선택하면 값을 확인합니다.';summary.title=detail?'선택한 분석 값과 설명 열기':'분석 항목을 선택해 주세요';summary.disabled=!detail;
      const date=nextState.calendarDate;locate.disabled=!date;locate.title=date?`${date} UTC를 주 가격 차트에서 보기`:'경과일 비교에는 공통 달력 날짜가 없습니다.';
    }
    size();
  }
  const handleTabKeys=event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    const tabs=[...modeTabs.querySelectorAll('[role=tab]')],index=tabs.indexOf(event.target);if(index<0)return;
    event.preventDefault();event.stopPropagation();const nextIndex=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[nextIndex].focus({preventScroll:true});tabs[nextIndex].click();
  };
  modeTabs.addEventListener('keydown',handleTabKeys);
  const observer=new ResizeObserver(size);observer.observe(stage);
  doc.addEventListener('atlas:analysis-state',setState);setState({detail:current});
  return {element:dock,destroy(){observer.disconnect();doc.removeEventListener('atlas:analysis-state',setState);modeTabs.removeEventListener('keydown',handleTabKeys);}};
}
