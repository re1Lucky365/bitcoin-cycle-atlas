/** Phone layout keeps the canvas wide; the same desktop controls live in trays. */
export function mountMobileWorkspace({workspace,stage,plot,reader,closeReader}) {
  const doc=workspace.ownerDocument,win=doc.defaultView,media=win.matchMedia('(max-width:620px)');
  const heading=stage.querySelector('.atlas-canvas-heading'),sidebar=doc.querySelector('.atlas-sidebar'),rail=workspace.querySelector('.workbench-rail');
  if(!heading||!sidebar||!rail)return {destroy(){}};
  sidebar.id='mobile-chart-tools';rail.id='mobile-chart-details';
  const glyph=path=>`<svg width="21" height="21" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
  const emit=(type,detail)=>doc.dispatchEvent(new win.CustomEvent(type,{detail}));
  const make=(id,label,path)=>{const b=doc.createElement('button');b.type='button';b.id=id;b.className='workbench-icon mobile-workbench-button';b.title=label;b.setAttribute('aria-label',label);b.innerHTML=glyph(path);return b;};
  const tools=make('mobile-tools-toggle','차트 도구','<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2" fill="#11161f"/><circle cx="15" cy="12" r="2" fill="#11161f"/><circle cx="9" cy="18" r="2" fill="#11161f"/>');
  const details=make('mobile-details-toggle','정보와 설정','<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>');
  const home=make('mobile-chart-home','통합 차트로 돌아가기','<path d="m14 6-6 6 6 6"/>');home.className='mobile-chart-home';home.append(doc.createTextNode('통합 차트'));home.onclick=()=>{close(false);doc.querySelector('.atlas-brand')?.click();};doc.body.append(home);
  for(const [button,node]of [[tools,sidebar],[details,rail]]){button.setAttribute('aria-controls',node.id);button.setAttribute('aria-expanded','false');heading.append(button);}
  const backdrop=doc.createElement('button');backdrop.type='button';backdrop.className='mobile-workbench-backdrop';backdrop.hidden=true;backdrop.tabIndex=-1;backdrop.setAttribute('aria-label','열린 도구 닫기');doc.body.append(backdrop);
  const trayHeading=(node,label)=>{const header=doc.createElement('header');header.className='mobile-tray-heading';const title=doc.createElement('strong');title.textContent=label;const dismiss=doc.createElement('button');dismiss.type='button';dismiss.textContent='닫기';dismiss.setAttribute('aria-label',`${label} 닫기`);dismiss.onclick=()=>close();header.append(title,dismiss);node.prepend(header);return header;};
  const toolsHeader=trayHeading(sidebar,'차트 도구');
  const toolStatus=doc.createElement('p');toolStatus.className='mobile-tool-status';toolStatus.textContent='십자선 · 자석 끄기';toolsHeader.append(toolStatus);
  let hintDismissed=false;try{hintDismissed=win.localStorage?.getItem('atlas-mobile-gesture-hint')==='dismissed';}catch{}
  const gestureHint=doc.createElement('section');gestureHint.className='mobile-gesture-hint';gestureHint.hidden=hintDismissed;
  const hintText=doc.createElement('p');hintText.textContent='탭으로 값 고정 · 좌우 드래그로 날짜 이동 · H 이동 도구로 상하좌우 이동. 길게 누르면 값 추적, 다음 탭으로 종료합니다. 두 손가락으로 확대·축소하고, 가격축을 끌어 눈금을 조절합니다.';
  const hintActions=doc.createElement('div'),guide=doc.createElement('button'),dismissHint=doc.createElement('button');guide.type=dismissHint.type='button';guide.textContent='자세한 사용법';dismissHint.textContent='안내 접기';
  guide.onclick=()=>{close(false);emit('atlas:open-detail',{kind:'guide',focus:true,opener:tools});};
  const setHint=visible=>{gestureHint.hidden=!visible;try{win.localStorage?.setItem('atlas-mobile-gesture-hint',visible?'visible':'dismissed');}catch{}};
  dismissHint.onclick=()=>setHint(false);hintActions.append(guide,dismissHint);gestureHint.append(hintText,hintActions);sidebar.append(gestureHint);
  const showHint=doc.createElement('button');showHint.type='button';showHint.className='mobile-gesture-help';showHint.textContent='터치 안내';showHint.onclick=()=>setHint(gestureHint.hidden);toolsHeader.append(showHint);
  const restoreInfo=doc.createElement('button');restoreInfo.type='button';restoreInfo.className='mobile-focus-return';restoreInfo.hidden=true;restoreInfo.textContent='정보 다시 표시';restoreInfo.setAttribute('aria-label','차트 정보 다시 표시');plot.append(restoreInfo);
  let focused=false,focusAction;
  function setFocus(value){
    if(focused===value)return;focused=value;
    if(value)plot.dataset.chartFocus='true';else delete plot.dataset.chartFocus;
    restoreInfo.hidden=!value;focusAction?.setAttribute('aria-pressed',String(value));
    if(focusAction)focusAction.setAttribute('aria-label',value?'차트 정보 다시 표시':'차트 집중 보기');
    emit('atlas:chart-focus',{focused:value});
  }
  restoreInfo.onclick=()=>{setFocus(false);details.focus({preventScroll:true});};
  const mobileActions=doc.createElement('nav');mobileActions.className='mobile-extra-actions';mobileActions.setAttribute('aria-label','추가 차트 기능');
  for(const [label,target,path]of [
    ['차트 설정','#atlas-display-options','<path d="M5 3v18M12 3v18M19 3v18M2 8h6m1 8h6m1-10h6"/>'],
    ['미래 가정','#workbench-scenario','<path d="m3 18 7-8 5 3 6-9M10 10l5 10 6-4"/>'],
    ['차트 내보내기','#lab-svg','<path d="M12 3v12m-4-4 4 4 4-4M5 16v5h14v-5"/>'],
    ['차트 빠른 조작','#workbench-chart-menu','<path d="M4 6h16M4 12h16M4 18h16"/>'],
    ['작업 화면·공유','#workbench-workspace','<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M15 9v11"/>'],
    ['차트 집중 보기','focus','<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/><path d="m7 15 4-5 3 2 3-4"/>'],
  ]){
    const b=make('',label,path);b.className='workbench-icon mobile-extra-action';b.dataset.mobileTarget=target;
    if(target==='focus'){focusAction=b;b.setAttribute('aria-pressed','false');}
    b.onclick=()=>{
      if(target==='focus'){setFocus(!focused);close();if(focused)restoreInfo.focus({preventScroll:true});return;}
      const kind=target==='#atlas-display-options'?'settings':target==='#workbench-scenario'?'scenarios':null;
      close(target==='#lab-svg'||target==='#workbench-workspace');
      if(kind)emit('atlas:open-detail',{kind,focus:true,opener:details});
      else if(target==='#workbench-workspace')emit('atlas:workspace-open',{tab:'saved',opener:details});
      else doc.querySelector(target)?.click();
    };mobileActions.append(b);
  }
  rail.prepend(mobileActions);
  const detailsHeader=trayHeading(rail,'정보와 설정');
  let active=null,opener=null;
  function close(restore=true){
    const trigger=opener;active=null;opener=null;delete sidebar.dataset.mobileOpen;delete rail.dataset.mobileOpen;
    tools.setAttribute('aria-expanded','false');details.setAttribute('aria-expanded','false');backdrop.hidden=true;
    if(restore&&trigger?.isConnected&&media.matches)trigger.focus({preventScroll:true});
  }
  function toggle(kind,trigger){
    if(!media.matches)return;
    if(active===kind){close();return;}
    if(!reader.hidden)closeReader({restoreFocus:false});
    close(false);active=kind;opener=trigger;
    const node=kind==='tools'?sidebar:rail;node.dataset.mobileOpen='true';trigger.setAttribute('aria-expanded','true');backdrop.hidden=false;
    node.querySelector('button:not(:disabled):not(.atlas-brand)')?.focus({preventScroll:true});
  }
  tools.onclick=()=>toggle('tools',tools);details.onclick=()=>toggle('details',details);backdrop.onclick=()=>close();
  const onKey=event=>{
    if(!active)return;
    // The top modal owns Tab/Escape even if an external opener omitted the
    // notification. Never restore a tray opener over the modal's focus.
    if(event.target.closest?.('dialog[open]')){close(false);return;}
    if(event.target.closest?.('.workbench-magnet-menu'))return;
    if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close();return;}
    if(event.key==='Tab'){
      const node=active==='tools'?sidebar:rail;
      const items=[opener,...node.querySelectorAll('button:not(:disabled),a[href],select,input,[tabindex="0"]')].filter(item=>item?.getClientRects().length&&!item.hidden);
      if(!items.length)return;
      const index=items.indexOf(doc.activeElement),next=(index+(event.shiftKey?-1:1)+items.length)%items.length;
      event.preventDefault();items[next].focus({preventScroll:true});
    }
  };
  const onPanel=event=>{if(event.detail?.open)close(false);};
  const onModal=()=>close(false);
  const onCommand=event=>{if(active&&['tool','span','chart-type','frequency'].includes(event.detail?.action))close();};
  const onPage=event=>{if(active&&event.target.closest?.('[data-view]'))close(false);};
  const sync=()=>{close(false);if(!media.matches)setFocus(false);workspace.dataset.mobile=String(media.matches);};
  const onState=event=>{const state=event.detail||{};for(const node of mobileActions.children){if(node.dataset.mobileTarget==='#workbench-scenario')node.hidden=Boolean(state.intraday);}const label=`${{crosshair:'십자선',pan:'이동',measure:'두 점 측정'}[state.tool]||'십자선'} · 자석 ${{off:'끄기',weak:'약하게',strong:'강하게'}[state.magnet]||'끄기'}`;if(toolStatus.textContent!==label)toolStatus.textContent=label;};
  media.addEventListener('change',sync);doc.addEventListener('keydown',onKey,true);doc.addEventListener('atlas:panel-state',onPanel);doc.addEventListener('atlas:modal-open',onModal);doc.addEventListener('atlas:chart-command',onCommand);rail.addEventListener('click',onPage);doc.addEventListener('atlas:workbench-state',onState);sync();
  return {destroy(){close(false);setFocus(false);media.removeEventListener('change',sync);doc.removeEventListener('keydown',onKey,true);doc.removeEventListener('atlas:panel-state',onPanel);doc.removeEventListener('atlas:modal-open',onModal);doc.removeEventListener('atlas:chart-command',onCommand);rail.removeEventListener('click',onPage);doc.removeEventListener('atlas:workbench-state',onState);tools.remove();details.remove();home.remove();mobileActions.remove();backdrop.remove();toolsHeader.remove();detailsHeader.remove();gestureHint.remove();restoreInfo.remove();}};
}
