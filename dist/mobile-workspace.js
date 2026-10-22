/** Phone layout keeps the canvas wide; the same desktop controls live in trays. */
export function mountMobileWorkspace({workspace,stage,plot,reader,closeReader}) {
  const doc=workspace.ownerDocument,win=doc.defaultView,media=win.matchMedia('(max-width:620px)');
  const heading=stage.querySelector('.atlas-canvas-heading'),sidebar=doc.querySelector('.atlas-sidebar'),rail=workspace.querySelector('.workbench-rail');
  if(!heading||!sidebar||!rail)return {destroy(){}};
  sidebar.id='mobile-chart-tools';rail.id='mobile-chart-details';
  const glyph=path=>`<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
  const make=(id,label,path)=>{const b=doc.createElement('button');b.type='button';b.id=id;b.className='workbench-icon mobile-workbench-button';b.title=label;b.setAttribute('aria-label',label);b.innerHTML=glyph(path);return b;};
  const tools=make('mobile-tools-toggle','차트 도구','<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2" fill="#11161f"/><circle cx="15" cy="12" r="2" fill="#11161f"/><circle cx="9" cy="18" r="2" fill="#11161f"/>');
  const details=make('mobile-details-toggle','정보와 설정','<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>');
  const home=make('mobile-chart-home','통합 차트로 돌아가기','<path d="m14 6-6 6 6 6"/>');home.className='mobile-chart-home';home.append(doc.createTextNode('통합 차트'));home.onclick=()=>{close(false);doc.querySelector('.atlas-brand')?.click();};doc.body.append(home);
  for(const [button,node]of [[tools,sidebar],[details,rail]]){button.setAttribute('aria-controls',node.id);button.setAttribute('aria-expanded','false');heading.append(button);}
  const backdrop=doc.createElement('button');backdrop.type='button';backdrop.className='mobile-workbench-backdrop';backdrop.hidden=true;backdrop.tabIndex=-1;backdrop.setAttribute('aria-label','열린 도구 닫기');doc.body.append(backdrop);
  const mobileActions=doc.createElement('nav');mobileActions.className='mobile-extra-actions';mobileActions.setAttribute('aria-label','추가 차트 기능');
  for(const [label,target,path]of [
    ['차트 설정','#atlas-display-options','<path d="M5 3v18M12 3v18M19 3v18M2 8h6m1 8h6m1-10h6"/>'],
    ['미래 가정','#workbench-scenario','<path d="m3 18 7-8 5 3 6-9M10 10l5 10 6-4"/>'],
    ['SVG 저장','#lab-svg','<path d="M12 3v12m-4-4 4 4 4-4M5 16v5h14v-5"/>'],
    ['차트 빠른 조작','#workbench-chart-menu','<path d="M4 6h16M4 12h16M4 18h16"/>'],
    ['작업 화면·공유','#workbench-workspace','<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M15 9v11"/>'],
  ]){
    const b=make('',label,path);b.className='workbench-icon mobile-extra-action';b.dataset.mobileTarget=target;
    b.onclick=()=>{
      const kind=target==='#atlas-display-options'?'settings':target==='#workbench-scenario'?'scenarios':null;
      close(target==='#lab-svg'||target==='#workbench-workspace');
      if(kind)doc.dispatchEvent(new CustomEvent('atlas:open-detail',{detail:{kind,focus:true,opener:details}}));
      else doc.querySelector(target)?.click();
    };mobileActions.append(b);
  }
  rail.prepend(mobileActions);
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
  const sync=()=>{close(false);workspace.dataset.mobile=String(media.matches);};
  const onState=event=>{for(const node of mobileActions.children){if(node.dataset.mobileTarget==='#workbench-scenario')node.hidden=Boolean(event.detail.intraday);}};
  media.addEventListener('change',sync);doc.addEventListener('keydown',onKey,true);doc.addEventListener('atlas:panel-state',onPanel);doc.addEventListener('atlas:modal-open',onModal);doc.addEventListener('atlas:chart-command',onCommand);rail.addEventListener('click',onPage);doc.addEventListener('atlas:workbench-state',onState);sync();
  return {destroy(){close(false);media.removeEventListener('change',sync);doc.removeEventListener('keydown',onKey,true);doc.removeEventListener('atlas:panel-state',onPanel);doc.removeEventListener('atlas:modal-open',onModal);doc.removeEventListener('atlas:chart-command',onCommand);rail.removeEventListener('click',onPage);doc.removeEventListener('atlas:workbench-state',onState);tools.remove();details.remove();home.remove();mobileActions.remove();backdrop.remove();}};
}
