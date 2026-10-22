import { utcDay, dateFromDay } from './cycle-engine.js';

const MIN_DAYS = 30;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function rangeDays(range) {
  const min=utcDay(range.min),max=utcDay(range.max),start=utcDay(range.start),end=utcDay(range.end);
  if(max<min||end<start)throw new RangeError('날짜 범위의 끝은 시작보다 앞설 수 없습니다.');
  return {min,max,start,end};
}

function boundedRange(range,start,length) {
  const {min,max}=rangeDays(range),available=max-min+1;
  const days=clamp(Math.round(length),Math.min(MIN_DAYS,available),available);
  const first=clamp(Math.round(start),min,max-days+1);
  return {...range,start:dateFromDay(first),end:dateFromDay(first+days-1)};
}

export function fitRange(range) {
  const {min,max}=rangeDays(range);
  return {...range,start:dateFromDay(min),end:dateFromDay(max)};
}

export function zoomRange(range,factor,anchor=.5) {
  if(!Number.isFinite(factor)||factor<=0)throw new RangeError('확대 배율은 양수여야 합니다.');
  if(!Number.isFinite(anchor))throw new RangeError('확대 중심은 유한한 값이어야 합니다.');
  const d=rangeDays(range),normal=boundedRange(range,d.start,d.end-d.start+1),n=rangeDays(normal);
  const fraction=clamp(anchor,0,1),oldLength=n.end-n.start+1;
  const newLength=clamp(Math.round(oldLength*factor),Math.min(MIN_DAYS,n.max-n.min+1),n.max-n.min+1);
  const pivot=n.start+fraction*(oldLength-1);
  return boundedRange(normal,pivot-fraction*(newLength-1),newLength);
}

export function panRange(range,fraction) {
  if(!Number.isFinite(fraction))throw new RangeError('이동 비율은 유한한 값이어야 합니다.');
  const d=rangeDays(range),normal=boundedRange(range,d.start,d.end-d.start+1),n=rangeDays(normal);
  const delta=(n.end-n.start+1)*fraction;
  // Round half-day movements away from zero in both directions to prevent drift.
  const days=Math.sign(delta)*Math.round(Math.abs(delta));
  return boundedRange(normal,n.start+days,n.end-n.start+1);
}

const icons={
  left:'<path d="m14 6-6 6 6 6"/>',
  in:'<path d="M12 5v14M5 12h14"/>',
  out:'<path d="M5 12h14"/>',
  right:'<path d="m10 6 6 6-6 6"/>',
  reset:'<path d="M4 10a8 8 0 1 1 2 8M4 4v6h6"/>'
};

export function bindChartNavigation({element,getRange,getTool=()=> 'crosshair',onRangeChange,onReset}) {
  const document=element.ownerDocument,window=document.defaultView;
  const toolbar=document.createElement('div');toolbar.className='chart-navigation';toolbar.setAttribute('role','group');toolbar.setAttribute('aria-label','차트 날짜 범위');
  toolbar.innerHTML=[['left','이전 구간'],['out','차트 축소'],['in','차트 확대'],['right','다음 구간'],['reset','기본 구간으로']].map(([action,label])=>`<button type="button" data-chart-navigation="${action}" aria-label="${label}" title="${label}"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${icons[action]}</svg></button>`).join('');
  element.append(toolbar);
  const previousTouchAction=element.style.touchAction;element.style.touchAction='pan-y pinch-zoom';
  let frame=null,pending=null,drag=null,suppressClick=false;
  const current=()=>getRange()?(pending||getRange()):null;
  function flush(){
    if(frame!==null){window.cancelAnimationFrame(frame);frame=null;}
    const next=pending;pending=null;
    const live=getRange();
    if(next&&live&&(next.start!==live.start||next.end!==live.end))onRangeChange(next);
  }
  function enqueue(next){pending=next;if(frame===null)frame=window.requestAnimationFrame(flush);}
  function reset(){if(frame!==null)window.cancelAnimationFrame(frame);frame=null;pending=null;if(getRange())onReset();}
  const interactive=target=>Boolean(target?.closest?.('button,input,select,textarea,summary,a,[contenteditable=true],[data-next-turn]'));
  function plotBounds(){
    const svg=element.querySelector('svg[data-plot-left]:not([hidden])');
    const rect=(svg||element).getBoundingClientRect();
    if(!svg)return {left:rect.left,width:rect.width,height:rect.height};
    const left=Number(svg.dataset.plotLeft),right=Number(svg.dataset.plotRight);
    if(!Number.isFinite(left)||!Number.isFinite(right)||right<=left)return {left:rect.left,width:rect.width,height:rect.height};
    const scale=svg.clientWidth?rect.width/svg.clientWidth:1;
    return {left:rect.left+left*scale,width:(right-left)*scale,height:rect.height};
  }
  function wheel(event){
    const range=current();
    if(!range||event.ctrlKey||event.metaKey||interactive(event.target))return;
    const rect=plotBounds();if(rect.width<=0)return;
    const unit=event.deltaMode===1?16:event.deltaMode===2?rect.height:1;
    event.preventDefault();
    if(event.shiftKey||Math.abs(event.deltaX)>Math.abs(event.deltaY)){
      enqueue(panRange(range,clamp((event.deltaX||event.deltaY)*unit,-rect.width,rect.width)/rect.width));
    }else{
      const factor=Math.exp(clamp(event.deltaY*unit,-600,600)*.0015);
      enqueue(zoomRange(range,factor,(event.clientX-rect.left)/rect.width));
    }
  }
  function pointerDown(event){
    suppressClick=false;
    const range=current();
    if(!range||getTool()==='measure'||event.button!==0||event.isPrimary===false||interactive(event.target))return;
    const rect=plotBounds();if(rect.width<=0)return;
    drag={id:event.pointerId,x:event.clientX,y:event.clientY,width:rect.width,range,active:false};
  }
  function pointerMove(event){
    if(!drag||event.pointerId!==drag.id)return;
    if(getTool()==='measure'){release(event,true);return;}
    if(event.buttons===0&&event.pointerType!=='touch'){drag=null;delete element.dataset.dragging;return;}
    const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
    if(!drag.active){
      if(Math.abs(dx)<5||Math.abs(dx)<Math.abs(dy))return;
      drag.active=true;element.dataset.dragging='true';
      element.setPointerCapture?.(event.pointerId);
    }
    event.preventDefault();event.stopImmediatePropagation();
    enqueue(panRange(drag.range,-dx/drag.width));
  }
  function release(event,cancelled=false){
    if(!drag||event.pointerId!==drag.id)return;
    const active=drag.active;drag=null;delete element.dataset.dragging;
    if(active){
      if(cancelled){if(frame!==null)window.cancelAnimationFrame(frame);frame=null;pending=null;}
      else{event.preventDefault();event.stopImmediatePropagation();flush();suppressClick=true;}
      if(element.hasPointerCapture?.(event.pointerId))element.releasePointerCapture(event.pointerId);
    }
  }
  const pointerUp=event=>release(event);
  const pointerCancel=event=>release(event,true);
  function click(event){if(suppressClick&&!interactive(event.target)){suppressClick=false;event.preventDefault();event.stopImmediatePropagation();}}
  function keydown(event){
    const range=current();
    if(!range||interactive(event.target)||event.ctrlKey||event.metaKey||event.altKey)return;
    if(!['+','=','-','0'].includes(event.key))return;
    event.preventDefault();event.stopImmediatePropagation();
    if(event.key==='0')reset();else enqueue(zoomRange(range,event.key==='-'?1.25:.8));
  }
  for(const button of toolbar.querySelectorAll('button'))button.onclick=()=>{
    const range=current();if(!range)return;
    const action=button.dataset.chartNavigation;
    if(action==='reset')reset();
    else if(action==='left'||action==='right')enqueue(panRange(range,action==='left'?-.25:.25));
    else enqueue(zoomRange(range,action==='in'?.8:1.25));
  };
  const listeners=[['wheel',wheel,{passive:false,capture:true}],['pointerdown',pointerDown,true],['pointermove',pointerMove,true],['pointerup',pointerUp,true],['pointercancel',pointerCancel,true],['click',click,true],['keydown',keydown,true]];
  for(const args of listeners)element.addEventListener(...args);
  function update(){
    const range=getRange();toolbar.hidden=!range;
    if(drag&&getTool()==='measure'){
      if(element.hasPointerCapture?.(drag.id))element.releasePointerCapture(drag.id);
      drag=null;pending=null;delete element.dataset.dragging;
      if(frame!==null){window.cancelAnimationFrame(frame);frame=null;}
    }
    if(!range){drag=null;pending=null;suppressClick=false;delete element.dataset.dragging;}
    else{
      const {min,max,start,end}=rangeDays(range),length=end-start+1;
      toolbar.querySelector('[data-chart-navigation=in]').disabled=length<=Math.min(MIN_DAYS,max-min+1);
      toolbar.querySelector('[data-chart-navigation=out]').disabled=start<=min&&end>=max;
      toolbar.querySelector('[data-chart-navigation=left]').disabled=start<=min;
      toolbar.querySelector('[data-chart-navigation=right]').disabled=end>=max;
    }
  }
  update();
  return {toolbar,update,destroy(){
    for(const args of listeners)element.removeEventListener(...args);
    if(frame!==null)window.cancelAnimationFrame(frame);
    if(drag&&element.hasPointerCapture?.(drag.id))element.releasePointerCapture(drag.id);
    toolbar.remove();element.style.touchAction=previousTouchAction;delete element.dataset.dragging;
  }};
}
