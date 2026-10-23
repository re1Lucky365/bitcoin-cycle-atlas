import {normalizeIndicatorState,isIndicatorVisible,ANALYSIS_PANE_MIN_HEIGHT,ANALYSIS_PANE_MAX_HEIGHT,ANALYSIS_PANE_DEFAULT_HEIGHT} from './indicator-state.js?v=1.14.1-touch.1';

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

const periodSummaryLabels={returnPct:'기간 수익률',maxDrawdownPct:'기간 중 최대 하락',realizedVolPct:'가격 흔들림 · 연간 환산',discoveryDays:'새 최고가를 기록한 날'};
export function analysisSelectionSummary(detail,{mode,metric='returnPct'}={}) {
  if(!detail)return '분석 항목을 선택하면 값을 확인합니다.';
  const metricLabel=mode==='periods'?(periodSummaryLabels[metric]||periodSummaryLabels.returnPct):null;
  const field=metricLabel?detail.fields?.find(item=>item.label===metricLabel):detail.fields?.[0];
  return `${detail.label} · ${metricLabel&&field?`${field.label} `:''}${field?.value??'선택 값 보기'}`;
}

export function dockHeight({availableHeight,open}) {
  if(!open)return 40;
  // The independent analysis axis can scroll inside its panel on small screens.
  // Reserve at least half of the canvas region for the navigable price chart.
  return Math.max(40,Math.min(340,Math.round(Math.max(0,availableHeight)*.48)));
}

export function mountAnalysisIndicators({stage,svg,modeTabs,controls}) {
  const doc=stage.ownerDocument;
  const command=(action,mode)=>doc.dispatchEvent(new CustomEvent('atlas:analysis-command',{detail:{action,mode,value:mode}}));
  const indicator=(action,id,extra={})=>doc.dispatchEvent(new CustomEvent('atlas:indicator-command',{detail:{action,id,...extra}}));
  let indicatorState=normalizeIndicatorState({added:[]}),frequency=null,previousMaximized=null,normalScrollTop=0;
  const windows=doc.createElement('section');windows.id='analysis-indicator-windows';windows.className='analysis-indicator-windows';windows.setAttribute('aria-label','차트에 추가한 분석 창');windows.hidden=true;
  // A compact scrollport can be shorter than one research pane. Keep every
  // surviving pane reachable without scrolling through another pane's body.
  const access=doc.createElement('nav');access.className='analysis-pane-access';access.setAttribute('aria-label','연구 창 이동');access.hidden=true;
  const accessLabel=doc.createElement('label'),accessText=doc.createElement('span'),paneSelect=doc.createElement('select'),paneGo=doc.createElement('button');
  paneSelect.setAttribute('aria-label','연구 창으로 이동');paneSelect.setAttribute('aria-controls',windows.id);accessText.textContent='연구 창';accessLabel.append(accessText,paneSelect);
  paneGo.type='button';paneGo.textContent='이동';paneGo.setAttribute('aria-label','선택한 연구 창 조작으로 이동');access.append(accessLabel,paneGo);windows.append(access);
  let accessKey='';
  const views=new Map(),controlGroups={cycles:'atlas-cycle-controls',duration:'atlas-duration-controls',periods:'atlas-period-controls',cryptocon:'atlas-cryptocon-controls'};
  for(const {id:mode,label} of ANALYSIS_MODES){
    const card=doc.createElement('article');card.id=`analysis-window-${mode}`;card.className='analysis-indicator-window';card.dataset.analysisMode=mode;card.hidden=true;card.setAttribute('aria-labelledby',`analysis-window-title-${mode}`);
    const header=doc.createElement('header');header.className='analysis-window-heading';
    const heading=doc.createElement('h3');heading.id=`analysis-window-title-${mode}`;heading.textContent=label;
    const axis=doc.createElement('span');axis.className='analysis-window-axis';axis.textContent='독립 분석 축';
    const actions=doc.createElement('div');actions.className='analysis-window-actions';
    const makeAction=(action,text,description,run)=>{const button=doc.createElement('button');button.type='button';button.textContent=text;button.title=`${label} ${description}`;button.setAttribute('aria-label',button.title);button.dataset.analysisAction=action;button.onclick=run;return button;};
    const settings=makeAction('settings','⚙','설정',()=>doc.dispatchEvent(new CustomEvent('atlas:indicator-settings-open',{detail:{id:mode,opener:settings}})));
    const up=makeAction('move-up','↑','창 위로 이동',()=>indicator('move',mode,{direction:-1}));
    const down=makeAction('move-down','↓','창 아래로 이동',()=>indicator('move',mode,{direction:1}));
    const maximize=makeAction('maximize','□','창 최대화',()=>indicator('maximize',mode));maximize.setAttribute('aria-pressed','false');
    const minimize=doc.createElement('button');minimize.type='button';minimize.textContent='−';minimize.title=`${label} 분석 창 접기`;minimize.setAttribute('aria-label',minimize.title);minimize.setAttribute('aria-expanded','true');minimize.setAttribute('aria-controls',`analysis-window-body-${mode}`);minimize.dataset.analysisAction='minimize';minimize.onclick=()=>indicator('minimize',mode);
    const hide=doc.createElement('button');hide.type='button';hide.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';hide.title=`${label} 숨기기`;hide.setAttribute('aria-label',hide.title);hide.dataset.analysisAction='visibility';hide.onclick=()=>indicator('visibility',mode);
    const remove=doc.createElement('button');remove.type='button';remove.textContent='×';remove.title=`${label} 삭제`;remove.setAttribute('aria-label',remove.title);remove.onclick=()=>indicator('remove',mode);
    remove.dataset.analysisAction='remove';actions.append(settings,up,down,maximize,minimize,hide,remove);header.append(heading,axis,actions);
    header.addEventListener('dblclick',event=>{if(event.target.closest?.('button,select,input'))return;event.preventDefault();indicator('maximize',mode);});
    const body=doc.createElement('div');body.id=`analysis-window-body-${mode}`;body.className='analysis-window-body';
    const meta=doc.createElement('div');meta.className='analysis-window-meta';
    const title=doc.createElement('h4'),caption=doc.createElement('p'),legend=doc.createElement('div');caption.id=`analysis-caption-${mode}`;legend.className='analysis-window-legend';meta.append(title,caption,legend);
    const controlRow=doc.createElement('div');controlRow.className='analysis-window-controls';
    const control=controls.find(node=>node.id===controlGroups[mode]);if(control){control.hidden=false;controlRow.append(control);}else controlRow.hidden=true;
    const viewport=doc.createElement('div');viewport.className='analysis-chart-viewport';viewport.id=mode==='cycles'?'analysis-chart-viewport':`analysis-chart-viewport-${mode}`;
    const chart=mode==='cycles'?svg:doc.createElementNS('http://www.w3.org/2000/svg','svg');chart.id=mode==='cycles'?'atlas-analysis-chart':`atlas-analysis-${mode}-chart`;chart.dataset.analysisSvg=mode;chart.hidden=false;chart.removeAttribute('hidden');chart.setAttribute('role','group');chart.setAttribute('aria-describedby',caption.id);viewport.append(chart);
    const selection=doc.createElement('div');selection.className='analysis-window-selection';
    const prev=doc.createElement('button');prev.type='button';prev.textContent='←';prev.setAttribute('aria-label',`${label} 이전 항목`);prev.onclick=()=>command('previous',mode);
    const next=doc.createElement('button');next.type='button';next.textContent='→';next.setAttribute('aria-label',`${label} 다음 항목`);next.onclick=()=>command('next',mode);
    const summary=doc.createElement('button');summary.type='button';summary.className='analysis-selection-summary';summary.textContent='분석 항목 선택';summary.onclick=()=>command('inspect',mode);
    const locate=doc.createElement('button');locate.type='button';locate.textContent='날짜로';locate.disabled=true;locate.onclick=()=>command('locate-date',mode);
    const save=doc.createElement('button');save.type='button';save.textContent='SVG';save.title=`${label} 그래프 저장`;save.setAttribute('aria-label',save.title);save.onclick=()=>command('save',mode);
    selection.append(prev,next,summary,locate,save);
    const note=doc.createElement('p');note.className='analysis-window-note';
    const resize=doc.createElement('div');resize.className='analysis-window-resize';resize.tabIndex=0;resize.setAttribute('role','separator');resize.setAttribute('aria-orientation','horizontal');resize.setAttribute('aria-label',`${label} 창 높이 조절`);resize.setAttribute('aria-controls',body.id);resize.setAttribute('aria-valuemin',String(ANALYSIS_PANE_MIN_HEIGHT));resize.setAttribute('aria-valuemax',String(ANALYSIS_PANE_MAX_HEIGHT));resize.title='경계를 끌거나 위·아래 방향키로 높이를 조절합니다. Home: 최소, End: 최대';
    let drag=null;
    const height=()=>indicatorState.paneHeights[mode]||ANALYSIS_PANE_DEFAULT_HEIGHT;
    const bounded=value=>Math.round(Math.min(ANALYSIS_PANE_MAX_HEIGHT,Math.max(ANALYSIS_PANE_MIN_HEIGHT,value)));
    const showHeight=value=>{card.style.setProperty('--analysis-pane-height',`${value}px`);resize.setAttribute('aria-valuenow',String(value));resize.setAttribute('aria-valuetext',`${value}px`);};
    const finish=(event,cancel=false)=>{if(!drag||event.pointerId!==undefined&&event.pointerId!==drag.pointerId)return;const current=drag;drag=null;card.dataset.resizing='false';if(cancel)showHeight(height());else indicator('resize',mode,{height:current.height});try{resize.releasePointerCapture?.(current.pointerId);}catch{}};
    resize.addEventListener('pointerdown',event=>{if(event.button!==0||indicatorState.maximized===mode)return;event.preventDefault();resize.focus({preventScroll:true});const initial=card.getBoundingClientRect?.().height||height();drag={pointerId:event.pointerId,y:event.clientY,height:bounded(initial),initial};card.dataset.resizing='true';resize.setPointerCapture?.(event.pointerId);});
    resize.addEventListener('pointermove',event=>{if(!drag||event.pointerId!==drag.pointerId)return;event.preventDefault();drag.height=bounded(drag.initial+event.clientY-drag.y);showHeight(drag.height);});
    resize.addEventListener('pointerup',event=>finish(event));resize.addEventListener('pointercancel',event=>finish(event,true));resize.addEventListener('lostpointercapture',event=>finish(event,true));
    resize.addEventListener('keydown',event=>{
      if(event.key==='Escape'&&drag){event.preventDefault();finish({},true);return;}
      const step=event.shiftKey?60:20,next=event.key==='ArrowUp'?height()-step:event.key==='ArrowDown'?height()+step:event.key==='Home'?ANALYSIS_PANE_MIN_HEIGHT:event.key==='End'?ANALYSIS_PANE_MAX_HEIGHT:null;
      if(next===null)return;event.preventDefault();indicator('resize',mode,{height:bounded(next)});
    });
    resize.addEventListener('dblclick',event=>{event.preventDefault();indicator('resize',mode,{height:ANALYSIS_PANE_DEFAULT_HEIGHT});});
    body.append(meta,controlRow,viewport,selection,note);card.append(header,body,resize);windows.append(card);
    card.addEventListener('pointerdown',()=>command('activate',mode),true);card.addEventListener('focusin',()=>command('activate',mode));
    views.set(mode,{card,body,minimize,maximize,up,down,resize,showHeight,chart,title,caption,legend,note,summary,locate,prev,next});
  }
  function goToPane({focus=false}={}){
    const view=views.get(paneSelect.value);if(!view||view.card.hidden)return;
    const paneTop=view.card.getBoundingClientRect().top,windowTop=windows.getBoundingClientRect().top,headerHeight=access.getBoundingClientRect().height;
    windows.scrollTop=Math.max(0,(windows.scrollTop||0)+paneTop-windowTop-headerHeight);
    command('activate',paneSelect.value);
    if(focus)view.minimize.focus({preventScroll:true});
  }
  paneSelect.addEventListener('change',()=>goToPane());paneGo.onclick=()=>goToPane({focus:true});
  modeTabs.remove();stage.querySelector('.atlas-plot').append(windows);
  function setState(event){
    const state=event.detail||{},view=views.get(state.mode);if(!view)return;
    const {title,caption,legend,note,summary,locate,prev,next}=view;
    if(state.controller){
      const c=state.controller;title.textContent=c.title||'';caption.textContent=c.caption||'';note.textContent=c.note||'';
      legend.replaceChildren(...(c.legend||[]).map(item=>{const node=doc.createElement('span'),swatch=doc.createElement('i');swatch.style.borderColor=item.color;swatch.style.borderTopStyle=item.dashed?'dashed':'solid';node.append(swatch,doc.createTextNode(item.label));return node;}));
      prev.disabled=typeof c.previous!=='function'||Boolean(c.hasPrevious)&&!c.hasPrevious();next.disabled=typeof c.next!=='function'||Boolean(c.hasNext)&&!c.hasNext();
    }
    if(Object.hasOwn(state,'detail')){
      const detail=state.detail;summary.textContent=analysisSelectionSummary(detail,{mode:state.mode,metric:state.metric});summary.title=detail?'선택한 분석 값과 설명 열기':'분석 항목을 선택해 주세요';summary.disabled=!detail;
      locate.disabled=!state.calendarDate;locate.title=state.calendarDate?`${state.calendarDate} UTC를 가격 차트에서 보기`:'경과일 비교에는 공통 달력 날짜가 없습니다.';
    }
  }
  function indicators(event){
    const focused=doc.activeElement,focusedCard=focused?.closest?.('.analysis-indicator-window');
    indicatorState=normalizeIndicatorState(event.detail.indicators||{});frequency=event.detail.frequency||frequency;
    const {minimized,active,paneOrder,paneHeights}=indicatorState;let count=0,minimizedCount=0;
    const maximized=isIndicatorVisible(indicatorState,indicatorState.maximized,frequency)?indicatorState.maximized:null;
    if(maximized&&!previousMaximized)normalScrollTop=windows.scrollTop||0;
    const order=[...paneOrder,...ANALYSIS_MODES.map(item=>item.id).filter(id=>!paneOrder.includes(id))];
    if([...windows.children].filter(node=>node.dataset.analysisMode).map(node=>node.dataset.analysisMode).join(',')!==order.join(',')){
      for(const mode of order)windows.append(views.get(mode).card);
      if(focused?.isConnected&&!focused.closest?.('[hidden]'))focused.focus({preventScroll:true});
    }
    for(const [mode,view] of views){
      const visible=isIndicatorVisible(indicatorState,mode,frequency)&&(!maximized||mode===maximized),folded=minimized.includes(mode),focusInBody=view.body.contains(focused),expanded=mode===maximized;
      view.card.hidden=!visible;view.card.dataset.active=String(mode===active);view.card.dataset.minimized=String(folded);view.body.hidden=folded;
      view.card.dataset.maximized=String(expanded);view.resize.hidden=folded||expanded;
      if(view.card.dataset.resizing!=='true')view.showHeight(paneHeights[mode]||ANALYSIS_PANE_DEFAULT_HEIGHT);
      const index=paneOrder.indexOf(mode);view.up.disabled=index<=0;view.down.disabled=index<0||index===paneOrder.length-1;
      view.maximize.textContent=expanded?'▣':'□';view.maximize.title=`${ANALYSIS_MODES.find(item=>item.id===mode).label} 창 ${expanded?'원래 크기로':'최대화'}`;view.maximize.setAttribute('aria-label',view.maximize.title);view.maximize.setAttribute('aria-pressed',String(expanded));
      view.minimize.textContent=folded?'+':'−';view.minimize.title=`${ANALYSIS_MODES.find(item=>item.id===mode).label} 분석 창 ${folded?'펼치기':'접기'}`;view.minimize.setAttribute('aria-label',view.minimize.title);view.minimize.setAttribute('aria-expanded',String(!folded));
      if(visible){count++;if(folded)minimizedCount++;if(folded&&focusInBody)view.minimize.focus({preventScroll:true});}
    }
    windows.hidden=!count;windows.dataset.count=String(count);windows.dataset.minimizedAll=String(count>0&&minimizedCount===count);windows.dataset.maximized=String(Boolean(maximized));
    const available=order.filter(mode=>!views.get(mode).card.hidden),nextAccessKey=available.map(mode=>`${mode}:${minimized.includes(mode)}`).join(',');
    if(nextAccessKey!==accessKey){
      const selected=paneSelect.value;
      paneSelect.replaceChildren(...available.map(mode=>{const option=doc.createElement('option');option.value=mode;option.textContent=`${ANALYSIS_MODES.find(item=>item.id===mode).label}${minimized.includes(mode)?' · 접힘':''}`;return option;}));
      paneSelect.value=available.includes(selected)?selected:available.includes(active)?active:available[0]||'';accessKey=nextAccessKey;
    }
    accessText.textContent=`연구 창 · ${count}`;access.hidden=count<2||Boolean(maximized);
    if(maximized!==previousMaximized)windows.scrollTop=maximized?0:normalScrollTop;
    previousMaximized=maximized;
    if(focusedCard&&windows.contains(focusedCard)&&focusedCard.hidden)queueMicrotask(()=>{
      // The indicator legend receives the same event after this controller.
      // Restore focus only after it has rendered the surviving controls.
      if(!windows.isConnected||!focusedCard.hidden||doc.querySelector('dialog[open]'))return;
      const current=doc.activeElement;
      if(current!==focused&&current!==doc.body&&current?.isConnected&&!current.closest('[hidden]'))return;
      const mode=focusedCard.dataset.analysisMode;
      const visible=node=>node&&!node.closest('[hidden]')&&!node.disabled;
      const own=doc.querySelector(`[data-indicator-row="${mode}"] [data-indicator-action="visibility"]`);
      const remaining=[...windows.querySelectorAll('.analysis-window-heading button')].find(visible);
      const legend=[...doc.querySelectorAll('[data-indicator-row] [data-indicator-action="visibility"]')].find(visible);
      const target=maximized?views.get(maximized).maximize:visible(own)?own:remaining||legend||doc.getElementById('atlas-mode-menu');
      target?.focus();
    });
  }
  // Scroll inside floating analysis windows never pans the underlying price axis.
  windows.addEventListener('wheel',event=>event.stopPropagation(),{passive:true});windows.addEventListener('pointerdown',event=>event.stopPropagation());windows.addEventListener('dblclick',event=>event.stopPropagation());windows.addEventListener('contextmenu',event=>event.stopPropagation());windows.addEventListener('keydown',event=>event.stopPropagation());
  doc.addEventListener('atlas:analysis-state',setState);doc.addEventListener('atlas:indicator-state',indicators);
  return {element:windows,views,paneSelect,paneGo,destroy(){doc.removeEventListener('atlas:analysis-state',setState);doc.removeEventListener('atlas:indicator-state',indicators);windows.remove();}};
}
