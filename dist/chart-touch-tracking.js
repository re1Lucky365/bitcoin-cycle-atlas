const interactive = target => target?.closest?.('button,input,select,textarea,a,summary,[role="button"],dialog,.analysis-indicator-window,#chart-indicator-manager');

/** Long press enters value tracking. A later tap exits; a second touch hands off to pinch. */
export function mountChartTouchTracking({element,getTool=()=> 'crosshair',canStart=()=>true,preview=()=>{},clear=()=>{},cancelNavigation=()=>{},resumeNavigation=()=>{},onChange=()=>{},delay=500,tolerance=10,timers=globalThis}={}) {
  const points=new Map(),listeners=[];
  let timer=null,pending=null,active=false,gesture=null,suppressClickUntil=0;
  const moveTarget=element.ownerDocument?.defaultView||element;
  const listen=(type,fn,options,target=element)=>{target.addEventListener(type,fn,options);listeners.push([target,type,fn,options]);};
  const stopTimer=()=>{if(timer!==null)timers.clearTimeout(timer);timer=null;pending=null;};
  const point=event=>({pointerId:event.pointerId,clientX:event.clientX,clientY:event.clientY});
  const distance=(a,b)=>Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
  const consume=event=>{event.preventDefault();event.stopImmediatePropagation();};
  function release(id){try{if(element.hasPointerCapture?.(id))element.releasePointerCapture(id);}catch{}}
  function setActive(value){if(active===value)return;active=value;element.dataset.touchTracking=String(value);onChange(value);}
  function cancel({clearPreview=true}={}) {
    stopTimer();for(const id of points.keys())release(id);points.clear();gesture=null;
    if(active){setActive(false);if(clearPreview)clear();}
  }
  function down(event) {
    if(event.pointerType!=='touch'||interactive(event.target)||getTool()!=='crosshair')return;
    if(!active&&!points.size&&!canStart(point(event)))return;
    points.set(event.pointerId,point(event));
    if(points.size>1){
      stopTimer();
      if(active){const touches=[...points.values()];setActive(false);gesture=null;clear();resumeNavigation(touches);consume(event);}
      return;
    }
    if(active){gesture={start:point(event),moved:false,wasActive:true};try{element.setPointerCapture(event.pointerId);}catch{}preview(point(event));consume(event);return;}
    pending={...point(event)};
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
    const current=point(event);points.set(event.pointerId,current);
    if(pending&&distance(pending,current)>tolerance)stopTimer();
    if(!active||points.size!==1)return;
    if(gesture&&distance(gesture.start,current)>tolerance)gesture.moved=true;
    preview(current);consume(event);
  }
  function up(event) {
    if(event.pointerType!=='touch'||!points.has(event.pointerId))return;
    stopTimer();points.delete(event.pointerId);
    if(!active)return;
    const exit=event.type==='pointercancel'||(gesture?.wasActive&&!gesture.moved);
    release(event.pointerId);gesture=null;suppressClickUntil=Date.now()+600;
    if(exit){setActive(false);clear();}
    consume(event);
  }
  // Navigation captures moves on window. Register here before navigation mounts,
  // otherwise its active drag can stop the movement before the hold timer sees it.
  listen('pointerdown',down,{capture:true,passive:false});listen('pointermove',move,{capture:true,passive:false},moveTarget);
  listen('pointerup',up,{capture:true,passive:false},moveTarget);listen('pointercancel',up,{capture:true,passive:false},moveTarget);
  listen('click',event=>{if(Date.now()<suppressClickUntil)consume(event);},true);
  // The first move after a stationary hold must not start native page scrolling.
  // An ordinary move before activation remains available to the browser.
  listen('touchmove',event=>{if(active)event.preventDefault();},{capture:true,passive:false},moveTarget);
  listen('contextmenu',event=>{if(active||pending)consume(event);},true);
  return {cancel,cancelPending:stopTimer,get active(){return active;},destroy(){cancel();for(const [target,type,fn,options] of listeners)target.removeEventListener(type,fn,options);}};
}
