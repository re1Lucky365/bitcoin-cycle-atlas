const interactive = target => target?.closest?.('button,input,select,textarea,a,summary,[role="button"],[role="menu"],dialog,.analysis-indicator-window,#chart-indicator-manager');

/** Long press enters value tracking. A later tap exits; a second touch hands off to pinch. */
export function mountChartTouchTracking({element,getTool=()=> 'crosshair',canStart=()=>true,preview=()=>{},clear=()=>{},cancelNavigation=()=>{},resumeNavigation=()=>{},onChange=()=>{},delay=500,tolerance=10,timers=globalThis}={}) {
  const points=new Map(),listeners=[];
  let timer=null,pending=null,active=false,gesture=null,suppressClickUntil=0,touchContextUntil=0;
  const moveTarget=element.ownerDocument?.defaultView||element;
  const listen=(type,fn,options,target=element)=>{target.addEventListener(type,fn,options);listeners.push([target,type,fn,options]);};
  const stopTimer=()=>{if(timer!==null)timers.clearTimeout(timer);timer=null;pending=null;};
  const point=event=>({pointerId:event.pointerId,clientX:event.clientX,clientY:event.clientY});
  const distance=(a,b)=>Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
  const consume=event=>{event.preventDefault();event.stopImmediatePropagation();};
  function release(id){try{if(element.hasPointerCapture?.(id))element.releasePointerCapture(id);}catch{}}
  function setActive(value){if(active===value)return;active=value;element.dataset.touchTracking=String(value);onChange(value);}
  function cancel({clearPreview=true}={}) {
    const captured=[...points.keys()];stopTimer();points.clear();gesture=null;touchContextUntil=0;
    if(active){setActive(false);if(clearPreview)clear();}
    // Clear ownership before releasing capture: lostpointercapture is delivered
    // synchronously by some hosts and must not cancel the next gesture.
    for(const id of captured)release(id);
  }
  function down(event) {
    if(event.pointerType!=='touch'){if(active||points.size)cancel();return;}
    const current=point(event);
    // A primary contact begins a new physical cohort, even after an interrupted
    // browser stream omitted the previous up/cancel.
    if(event.isPrimary===true){if(points.size)cancel();suppressClickUntil=0;}
    if(interactive(event.target)||getTool()!=='crosshair'||!canStart(current)){
      stopTimer();if(active)cancel();return;
    }
    // A first contact outside this plot must not turn its second finger into
    // a new long press. The original cohort has to finish first.
    if(event.isPrimary===false&&!points.size)return;
    points.set(event.pointerId,current);touchContextUntil=Date.now()+800;
    if(points.size>1){
      stopTimer();
      if(active){const touches=[...points.values()];setActive(false);gesture=null;clear();resumeNavigation(touches);consume(event);}
      return;
    }
    if(active){gesture={start:current,moved:false,wasActive:true};try{element.setPointerCapture(event.pointerId);}catch{}preview(current);consume(event);return;}
    pending={...current};
    timer=timers.setTimeout(()=>{
      timer=null;
      if(!pending||points.size!==1||getTool()!=='crosshair')return;
      const current=points.get(pending.pointerId);if(!current)return;
      cancelNavigation();setActive(true);gesture={start:current,moved:false,wasActive:false};pending=null;
      try{element.setPointerCapture(current.pointerId);}catch{}
      preview(current);
    },delay);
  }
  function move(event) {
    if(event.pointerType!=='touch'||!points.has(event.pointerId))return;
    const current=point(event);points.set(event.pointerId,current);touchContextUntil=Date.now()+800;
    if(pending&&distance(pending,current)>tolerance)stopTimer();
    if(!active||points.size!==1)return;
    if(gesture&&distance(gesture.start,current)>tolerance)gesture.moved=true;
    preview(current);consume(event);
  }
  function up(event) {
    if(event.pointerType!=='touch'||!points.has(event.pointerId))return;
    const current=point(event);stopTimer();points.delete(event.pointerId);touchContextUntil=Date.now()+800;
    if(!active)return;
    // Pointerup may carry a newer position than the last pointermove.
    if(gesture&&distance(gesture.start,current)>tolerance)gesture.moved=true;
    if(event.type!=='pointercancel')preview(current);
    const exit=event.type==='pointercancel'||(gesture?.wasActive&&!gesture.moved);
    release(event.pointerId);gesture=null;suppressClickUntil=Date.now()+600;
    if(exit){setActive(false);clear();}
    consume(event);
  }
  // Navigation captures moves on window. Register here before navigation mounts,
  // otherwise its active drag can stop the movement before the hold timer sees it.
  listen('pointerdown',down,{capture:true,passive:false});listen('pointermove',move,{capture:true,passive:false},moveTarget);
  listen('pointerup',up,{capture:true,passive:false},moveTarget);listen('pointercancel',up,{capture:true,passive:false},moveTarget);
  listen('click',event=>{if(event.detail!==0&&!interactive(event.target)&&Date.now()<suppressClickUntil){suppressClickUntil=0;consume(event);}},true);
  // The first move after a stationary hold must not start native page scrolling.
  // An ordinary move before activation remains available to the browser.
  listen('touchmove',event=>{if(active&&points.size&&(!element.contains||element.contains(event.target)))event.preventDefault();},{capture:true,passive:false},moveTarget);
  listen('contextmenu',event=>{
    if(interactive(event.target))return;
    const touch=event.pointerType==='touch'||event.sourceCapabilities?.firesTouchEvents===true||
      (!event.pointerType&&event.sourceCapabilities?.firesTouchEvents!==false&&(points.size>0||Date.now()<touchContextUntil));
    // Native long-press context menus must not steal value tracking. Explicit
    // buttons, keyboard commands and a genuine mouse context menu still work.
    if(touch&&(active||pending||points.size||Date.now()<touchContextUntil))consume(event);
  },true);
  listen('lostpointercapture',event=>{if(active&&points.has(event.pointerId))cancel();else if(pending?.pointerId===event.pointerId)stopTimer();},true);
  listen('blur',()=>cancel(),undefined,moveTarget);listen('resize',()=>cancel(),undefined,moveTarget);
  if(element.ownerDocument?.addEventListener)listen('visibilitychange',()=>{if(element.ownerDocument.hidden)cancel();},undefined,element.ownerDocument);
  return {cancel,cancelPending:stopTimer,get active(){return active;},destroy(){cancel();for(const [target,type,fn,options] of listeners)target.removeEventListener(type,fn,options);}};
}
