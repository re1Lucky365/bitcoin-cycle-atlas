const bottomBars=new WeakMap();
export const chartBottomBarFor=stage=>bottomBars.get(stage)||null;

/** One footer row owns existing controls. Extra actions open above the chart
 * and never add a second layout row or resize the price SVG. */
export function mountChartBottomBar({stage,ranges,dateButton,rangeLabel,axis,status,fitButton,updateButton,onCommand,onUpdate}){
  const doc=stage.ownerDocument,win=doc.defaultView||globalThis;
  const make=(tag,className,text)=>{const node=doc.createElement(tag);node.className=className;if(text!==undefined)node.textContent=text;return node;};
  const announceOpen=id=>{const Event=win.CustomEvent||globalThis.CustomEvent;if(Event)doc.dispatchEvent(new Event('atlas:modal-open',{detail:{id}}));};
  const footer=make('footer','workbench-bottom workbench-bottom-bar');footer.setAttribute('aria-label','차트 기간·날짜·사건·가격축');
  const scroll=make('div','workbench-bottom-scroll'),rangeControls=make('div','workbench-range-controls');
  const rangeSelect=make('select','workbench-range-select');rangeSelect.id='workbench-range-select';rangeSelect.setAttribute('aria-label','차트 표시 기간');
  const manual=make('option','','기간');manual.value='';manual.disabled=true;rangeSelect.append(manual);
  const spans=[...ranges.querySelectorAll('[data-chart-span]')];
  for(const source of spans){const option=make('option','',source.textContent);option.value=source.dataset.chartSpan;option.title=source.title;rangeSelect.append(option);}
  rangeSelect.value='';rangeSelect.onchange=()=>{if(spans.some(node=>node.dataset.chartSpan===rangeSelect.value))onCommand('span',rangeSelect.value);};
  rangeControls.append(ranges,rangeSelect);
  const eventSlot=make('div','workbench-event-slot');eventSlot.setAttribute('role','group');eventSlot.setAttribute('aria-label','주요 사건');
  const more=make('button','workbench-icon workbench-bottom-more');more.type='button';more.id='workbench-bottom-more';more.title='하단 도구 더보기';more.setAttribute('aria-label',more.title);more.setAttribute('aria-haspopup','menu');more.setAttribute('aria-expanded','false');more.setAttribute('aria-controls','workbench-bottom-menu');
  more.innerHTML='<svg class="icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="currentColor"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>';
  scroll.append(rangeControls,dateButton,eventSlot,rangeLabel,axis,status);footer.append(scroll,more);stage.append(footer);stage.classList.add('has-chart-bottom-bar');
  const menu=make('section','chart-bottom-popover workbench-bottom-menu');menu.id='workbench-bottom-menu';menu.hidden=true;menu.setAttribute('role','menu');menu.setAttribute('aria-label','하단 도구 더보기');
  const details=make('div','bottom-menu-context'),rangeInfo=make('p','bottom-range-context'),zone=make('p','','날짜·봉 시각 · UTC');details.setAttribute('role','presentation');details.append(rangeInfo,zone);
  const researchActions=make('div','bottom-research-actions'),actions=make('div','bottom-extra-actions');menu.append(details,researchActions,actions);doc.body.append(menu);
  let destroyed=false;
  function close(focus=false){if(menu.hidden)return;menu.hidden=true;more.setAttribute('aria-expanded','false');if(focus)more.focus({preventScroll:true});}
  function addAction({id,label,onActivate,research=true}){
    const node=make('button','bottom-menu-action',label);node.type='button';node.id=id;node.setAttribute('role','menuitem');node.tabIndex=-1;
    node.onclick=()=>{close(true);onActivate(more);};(research?researchActions:actions).append(node);return node;
  }
  const reset=addAction({id:'workbench-bottom-reset',label:'기본 범위로 · 0 / Alt+R',research:false,onActivate:()=>onCommand('fit')});
  const update=addAction({id:'workbench-bottom-update',label:'자료 갱신 상태',research:false,onActivate:opener=>onUpdate(opener)});
  function syncDetails(){rangeInfo.textContent=rangeLabel.title||rangeLabel.textContent||'차트 표시 기간';update.textContent=`갱신 상태${updateButton.textContent?` · ${updateButton.textContent}`:''}`;update.title=updateButton.title||'자료 갱신 상태';}
  function open(){
    if(destroyed)return;if(!menu.hidden){close(true);return;}syncDetails();announceOpen(menu.id);menu.hidden=false;more.setAttribute('aria-expanded','true');
    const bounds=footer.getBoundingClientRect(),viewWidth=win.visualViewport?.width||win.innerWidth||doc.documentElement?.clientWidth||320,viewHeight=win.visualViewport?.height||win.innerHeight||doc.documentElement?.clientHeight||600;
    const width=Math.max(160,Math.min(292,viewWidth-16));menu.style.width=`${width}px`;
    menu.style.left=`${Math.max(8,Math.min(viewWidth-width-8,bounds.right-width))}px`;
    menu.style.maxHeight=`${Math.max(80,Math.min(360,viewHeight-24))}px`;
    menu.style.top=`${Math.max(8,Math.min(viewHeight-menu.offsetHeight-8,bounds.top-menu.offsetHeight-6))}px`;
    const first=[...menu.querySelectorAll('button')].find(node=>!node.hidden&&!node.disabled);first?.focus({preventScroll:true});
  }
  more.onclick=open;
  const onMenuKey=event=>{
    event.stopPropagation();const buttons=[...menu.querySelectorAll('button')].filter(node=>!node.hidden&&!node.disabled),index=buttons.indexOf(doc.activeElement);
    if(['Escape','Tab'].includes(event.key)){event.preventDefault();close(true);}
    else if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowUp'?-1:1)+buttons.length)%buttons.length;buttons[next]?.focus({preventScroll:true});}
  };
  menu.addEventListener('keydown',onMenuKey);
  const dismiss=event=>{if(!menu.hidden&&!menu.contains(event.target)&&!more.contains(event.target))close();};
  const onModal=event=>{if(event.detail?.id!==menu.id)close();},onPanel=event=>{if(event.detail?.open)close();},onResize=()=>close();
  doc.addEventListener('pointerdown',dismiss,true);doc.addEventListener('focusin',dismiss);doc.addEventListener('atlas:modal-open',onModal);doc.addEventListener('atlas:panel-state',onPanel);win.addEventListener?.('resize',onResize);
  // Overflow gestures belong to this row, never to the price navigation loop.
  const stop=event=>event.stopPropagation();for(const type of ['wheel','pointerdown','dblclick'])footer.addEventListener(type,stop,type==='wheel'?{passive:true}:undefined);
  const controller={element:footer,eventSlot,addAction,close,update(state){
    const price=state.mode==='price',intraday=Boolean(state.intraday)||['1m','5m','15m','30m','1h','4h'].includes(state.frequency);
    rangeControls.hidden=!price||intraday;rangeSelect.value=!state.customRange&&spans.some(node=>node.dataset.chartSpan===state.window)?state.window:'';
    reset.hidden=!price;reset.disabled=state.navigationAvailable===false;fitButton.disabled=state.navigationAvailable===false;syncDetails();
    if(!price)close();
  },destroy(){if(destroyed)return;destroyed=true;close();doc.removeEventListener('pointerdown',dismiss,true);doc.removeEventListener('focusin',dismiss);doc.removeEventListener('atlas:modal-open',onModal);doc.removeEventListener('atlas:panel-state',onPanel);win.removeEventListener?.('resize',onResize);menu.removeEventListener('keydown',onMenuKey);for(const type of ['wheel','pointerdown','dblclick'])footer.removeEventListener(type,stop);footer.remove();menu.remove();stage.classList.remove('has-chart-bottom-bar');bottomBars.delete(stage);}};
  bottomBars.set(stage,controller);return controller;
}
