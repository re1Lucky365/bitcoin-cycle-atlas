/** Keep compact dialogs inside the visual viewport when a phone keyboard opens. */
export function mountDialogViewport(dialog){
  const win=dialog.ownerDocument?.defaultView,viewport=win?.visualViewport;
  if(!viewport)return {destroy(){}};
  const refresh=()=>{
    if(Number.isFinite(viewport.height)&&viewport.height>0){
      const height=Math.floor(viewport.height);
      dialog.style.setProperty('--dialog-viewport-height',`${height}px`);
      if(height<=600)dialog.setAttribute('data-short-viewport','');else dialog.removeAttribute('data-short-viewport');
    }
    dialog.style.setProperty('--dialog-viewport-top',`${Math.max(0,Math.round(viewport.offsetTop||0))}px`);
  };
  viewport.addEventListener('resize',refresh);viewport.addEventListener('scroll',refresh);refresh();
  return {destroy(){viewport.removeEventListener('resize',refresh);viewport.removeEventListener('scroll',refresh);dialog.style.removeProperty('--dialog-viewport-height');dialog.style.removeProperty('--dialog-viewport-top');dialog.removeAttribute('data-short-viewport');}};
}
