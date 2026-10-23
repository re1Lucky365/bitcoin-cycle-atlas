// Compact overlays share the existing price canvas. Their scrolling space is
// presentation only: membership, visibility and explicit folds stay untouched.
const LIST_HEIGHTS=Object.freeze({small:56,balanced:112,large:196});
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;

export function compactChartLayout({width,height,hudBottom=0,managerVisible=false,collapsed=true,listContentHeight=0,visiblePanes=0,listSize='balanced',controlsHeight=28}={}) {
  width=Math.max(0,finite(width));height=Math.max(0,finite(height));
  const enabled=width>0&&height>0&&(width<=850||height<=420);
  if(!enabled)return {enabled:false};
  const inset=8,gap=6,bottom=32,innerWidth=Math.max(0,width-inset*2);
  const top=Math.max(inset,Math.ceil(finite(hudBottom))+gap),available=Math.max(0,height-bottom-top);
  const controls=managerVisible?Math.min(available,Math.max(28,finite(controlsHeight,28))):0;
  const hasPanes=visiblePanes>0,open=managerVisible&&!collapsed;
  const columns=width>=600&&height<=420&&hasPanes&&open;
  const listWidth=columns?Math.min(260,Math.floor(innerWidth*.38)):innerWidth;
  const requested=LIST_HEIGHTS[listSize]||LIST_HEIGHTS.balanced;
  // The list has a bounded scrollport; a taller preference never moves a pane
  // above the HUD/list. Very short landscape canvases use their width instead.
  const paneReserve=hasPanes&&!columns?Math.min(176,Math.max(96,available*.48)):0;
  const listBudget=Math.max(0,available-controls-(hasPanes&&!columns?gap+paneReserve:0));
  const listHeight=open?Math.min(Math.max(0,finite(listContentHeight)),requested,listBudget):0;
  const managerHeight=managerVisible?controls+listHeight:0;
  const analysisTop=columns?top:top+managerHeight+(hasPanes&&managerHeight?gap:0);
  return {enabled:true,mode:columns?'columns':'stack',top,bottom,available,innerWidth,listWidth,listHeight,managerHeight,
    analysisTop,analysisLeft:columns?inset+listWidth+gap:inset,
    analysisHeight:hasPanes?Math.max(0,height-bottom-analysisTop):0};
}

export function mountCompactChartLayout({plot}={}) {
  if(!plot)return {refresh(){return null;},destroy(){}};
  const doc=plot.ownerDocument,win=doc.defaultView||globalThis;
  const manager=plot.querySelector('.chart-indicator-manager'),list=manager?.querySelector('.chart-indicator-list');
  const fold=manager?.querySelector('.indicator-legend-toggle'),windows=plot.querySelector('.analysis-indicator-windows');
  const hud=[plot.querySelector('#lab-metrics'),plot.querySelector('.workbench-market-info'),plot.querySelector('.lab-chart-foot')].filter(Boolean);
  let size='balanced',active=false,destroyed=false,scheduled=false,frame=null,lastLayout=null;
  let header=null,sizeLabel=null,sizeSelect=null;
  if(manager&&fold){
    header=doc.createElement('div');header.className='compact-indicator-controls';header.hidden=true;
    sizeLabel=doc.createElement('label');sizeLabel.className='compact-list-size';
    const label=doc.createElement('span');label.textContent='높이';
    sizeSelect=doc.createElement('select');sizeSelect.setAttribute('aria-label','지표 값 목록 높이');sizeSelect.setAttribute('aria-controls',list?.id||'chart-indicator-list');
    for(const [value,text] of [['small','작게'],['balanced','보통'],['large','넓게']]){const option=doc.createElement('option');option.value=value;option.textContent=text;sizeSelect.append(option);}
    sizeSelect.value=size;sizeSelect.addEventListener('change',()=>{size=Object.hasOwn(LIST_HEIGHTS,sizeSelect.value)?sizeSelect.value:'balanced';refresh();});
    sizeLabel.append(label,sizeSelect);header.append(sizeLabel);manager.prepend(header);
  }
  function visible(node){return Boolean(node&&!node.hidden&&!node.closest?.('[hidden]'));}
  function rect(node){return node?.getBoundingClientRect?.()||{top:0,bottom:0,height:0,width:0};}
  function setMode(enabled){
    if(active===enabled)return;
    active=enabled;
    if(header&&fold){
      const focused=doc.activeElement===fold;
      if(enabled){header.prepend(fold);header.hidden=false;}else{manager.append(fold);header.hidden=true;}
      if(focused)fold.focus({preventScroll:true});
    }
  }
  function setProperty(name,value){const formatted=`${Math.max(0,Math.round(value*100)/100)}px`;if(plot.style.getPropertyValue(name)!==formatted)plot.style.setProperty(name,formatted);}
  function clearLayout(){
    setMode(false);delete plot.dataset.compactLayout;
    for(const name of ['--compact-content-top','--compact-list-width','--compact-list-max-height','--compact-analysis-top','--compact-analysis-left','--compact-analysis-bottom'])plot.style.removeProperty(name);
  }
  function refresh(){
    if(destroyed)return null;
    // Focus is a temporary view owned by the workspace, not a state mutation.
    // Ignore zero geometry while it is hidden; keep the user's height choice.
    if(plot.dataset.chartFocus==='true')return lastLayout;
    const bounds=rect(plot),height=bounds.height,width=bounds.width;
    const enabled=width>0&&height>0&&(width<=850||height<=420);
    if(!enabled){clearLayout();lastLayout={enabled:false};return lastLayout;}
    setMode(true);
    let bottom=0;
    for(const node of hud){if(!visible(node))continue;const box=rect(node);if(box.height>0)bottom=Math.max(bottom,(finite(box.bottom,box.top+box.height))-bounds.top);}
    const paneCount=visible(windows)?[...windows.querySelectorAll('.analysis-indicator-window')].filter(visible).length:0;
    const contentHeight=finite(list?.scrollHeight)||((list?.children.length||0)*28);
    const managerVisible=visible(manager),collapsed=manager?.dataset.collapsed==='true';
    if(sizeLabel)sizeLabel.hidden=collapsed;
    lastLayout=compactChartLayout({width,height,hudBottom:bottom,managerVisible,collapsed,listContentHeight:contentHeight,visiblePanes:paneCount,listSize:size,controlsHeight:rect(header).height||28});
    if(plot.dataset.compactLayout!==lastLayout.mode)plot.dataset.compactLayout=lastLayout.mode;
    setProperty('--compact-content-top',lastLayout.top);setProperty('--compact-list-width',lastLayout.listWidth);setProperty('--compact-list-max-height',lastLayout.listHeight);
    setProperty('--compact-analysis-top',lastLayout.analysisTop);setProperty('--compact-analysis-left',lastLayout.analysisLeft);setProperty('--compact-analysis-bottom',lastLayout.bottom);
    return lastLayout;
  }
  const request=win.requestAnimationFrame?.bind(win)||globalThis.requestAnimationFrame;
  const cancel=win.cancelAnimationFrame?.bind(win)||globalThis.cancelAnimationFrame;
  function schedule(){
    if(destroyed||scheduled)return;scheduled=true;
    const run=()=>{scheduled=false;frame=null;refresh();};
    if(request)frame=request(run);else queueMicrotask(run);
  }
  const Resize=win.ResizeObserver||globalThis.ResizeObserver,Mutation=win.MutationObserver||globalThis.MutationObserver;
  const resize=Resize?new Resize(schedule):null;
  for(const node of [plot,manager,list,windows,header,...hud].filter(Boolean))resize?.observe(node);
  const focusObserver=Mutation?new Mutation(schedule):null;focusObserver?.observe(plot,{attributes:true,attributeFilter:['data-chart-focus']});
  const stateObserver=Mutation?new Mutation(schedule):null;
  for(const node of [manager,windows,...hud].filter(Boolean))stateObserver?.observe(node,{attributes:true,attributeFilter:['hidden','data-collapsed','data-count','data-minimized-all','data-maximized']});
  if(list)stateObserver?.observe(list,{childList:true});
  doc.addEventListener('atlas:indicator-state',schedule);doc.addEventListener('atlas:hud-layout-change',schedule);doc.addEventListener('atlas:chart-focus',schedule);
  win.addEventListener?.('resize',schedule);refresh();
  return {refresh,destroy(){if(destroyed)return;destroyed=true;if(frame!==null&&cancel)cancel(frame);resize?.disconnect();focusObserver?.disconnect();stateObserver?.disconnect();doc.removeEventListener('atlas:indicator-state',schedule);doc.removeEventListener('atlas:hud-layout-change',schedule);doc.removeEventListener('atlas:chart-focus',schedule);win.removeEventListener?.('resize',schedule);clearLayout();header?.remove();}};
}
