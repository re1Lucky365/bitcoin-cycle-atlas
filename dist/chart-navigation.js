import { utcDay, dateFromDay } from './cycle-engine.js?v=1.11.0';
import { normalizePriceDomain, scalePriceDomain, panPriceDomain } from './price-axis.js?v=1.13.0-research.1';

const MIN_DAYS = 30;
const MIN_BARS = 12;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// Calendar ranges retain their inclusive UTC-day contract. Intraday ranges use
// actual Unix seconds on an explicit candle grid; missing bars remain missing.
function rangeUnits(range) {
  if (!range || typeof range !== 'object') throw new TypeError('차트 범위가 필요합니다.');
  const seconds = range.unit === 'seconds';
  if (range.unit && !seconds && range.unit !== 'days') throw new RangeError('지원하지 않는 차트 시간 단위입니다.');
  const step = seconds ? range.step : 1;
  if (!Number.isSafeInteger(step) || step <= 0) throw new RangeError('시간 간격은 양의 정수여야 합니다.');
  const read = value => {
    if (!seconds) return utcDay(value);
    if (!Number.isSafeInteger(value)) throw new RangeError('봉 시각은 유한한 정수 Unix 초여야 합니다.');
    return value;
  };
  const min = read(range.min), max = read(range.max), start = read(range.start), end = read(range.end);
  if (max < min || end < start) throw new RangeError('시간 범위의 끝은 시작보다 앞설 수 없습니다.');
  const values = [max, start, end].map(value => (value - min) / step);
  if (values.some(value => !Number.isSafeInteger(value))) throw new RangeError('범위는 같은 봉 시간 간격에 맞아야 합니다.');
  const minimum = range.minSpan ?? (seconds ? MIN_BARS : MIN_DAYS);
  if (!Number.isSafeInteger(minimum) || minimum < 1) throw new RangeError('최소 표시 간격 수는 양의 정수여야 합니다.');
  const free = range.allowEmpty === true, maximum = range.maxSpan ?? Math.max(free ? minimum : 1, values[0] + 1);
  if (!Number.isSafeInteger(maximum) || maximum < (free ? minimum : Math.min(minimum, values[0] + 1))) throw new RangeError('최대 표시 간격 수는 최소 표시 간격 이상이어야 합니다.');
  const hardMin = seconds ? Math.ceil((Date.parse('1800-01-01T00:00:00Z')/1000-min)/step) : utcDay('1800-01-01')-min;
  const hardMax = seconds ? Math.floor((Date.parse('2401-01-01T00:00:00Z')/1000-step-min)/step) : utcDay('2400-12-31')-min;
  return {
    min: 0, max: values[0], start: values[1], end: values[2],
    minimum: free ? minimum : Math.min(minimum, values[0] + 1),
    maximum: free ? Math.min(maximum,hardMax-hardMin+1) : Math.min(maximum, values[0] + 1),
    free,hardMin,hardMax,
    encode: value => seconds ? min + value * step : dateFromDay(min + value),
  };
}

function boundedRange(range, start, length) {
  const units = rangeUnits(range), available = units.max + 1;
  const count = clamp(Math.round(length), units.minimum, units.maximum);
  const first = units.free ? clamp(Math.round(start),units.hardMin,units.hardMax-count+1) : clamp(Math.round(start), 0, available - count);
  return { ...range, start: units.encode(first), end: units.encode(first + count - 1) };
}

export function fitRange(range) {
  const units = rangeUnits(range);
  const count=Math.min(units.max+1,units.maximum);
  return boundedRange(range, units.max - count + 1, count);
}

export function zoomRange(range, factor, anchor = .5) {
  if (!Number.isFinite(factor) || factor <= 0) throw new RangeError('확대 배율은 양수여야 합니다.');
  if (!Number.isFinite(anchor)) throw new RangeError('확대 중심은 유한한 값이어야 합니다.');
  const units = rangeUnits(range);
  const normal = boundedRange(range, units.start, units.end - units.start + 1), current = rangeUnits(normal);
  const fraction = clamp(anchor, 0, 1), oldLength = current.end - current.start + 1;
  const newLength = clamp(Math.round(oldLength * factor), current.minimum, current.maximum);
  const pivot = current.start + fraction * (oldLength - 1);
  return boundedRange(normal, pivot - fraction * (newLength - 1), newLength);
}

export function panRange(range, fraction) {
  if (!Number.isFinite(fraction)) throw new RangeError('이동 비율은 유한한 값이어야 합니다.');
  const units = rangeUnits(range);
  const normal = boundedRange(range, units.start, units.end - units.start + 1), current = rangeUnits(normal);
  const delta = (current.end - current.start + 1) * fraction;
  // Symmetric rounding prevents repeated left/right navigation from drifting.
  const offset = Math.sign(delta) * Math.round(Math.abs(delta));
  return boundedRange(normal, current.start + offset, current.end - current.start + 1);
}

const sameScope = (a, b) => Boolean(a && b &&
  a.unit === b.unit && a.step === b.step && a.min === b.min && a.max === b.max &&
  a.minSpan === b.minSpan && a.maxSpan === b.maxSpan && a.allowEmpty === b.allowEmpty && a.contextKey === b.contextKey);
const sameWindow = (a, b) => sameScope(a, b) && a.start === b.start && a.end === b.end;
const icons = {
  left: '<path d="m14 6-6 6 6 6"/>',
  in: '<path d="M12 5v14M5 12h14"/>',
  out: '<path d="M5 12h14"/>',
  right: '<path d="m10 6 6 6-6 6"/>',
  reset: '<path d="M4 10a8 8 0 1 1 2 8M4 4v6h6"/>',
};

export function bindChartNavigation({
  element, getRange, getTool = () => 'crosshair', onRangeChange, onReset,
  getPriceAxis = () => null, onPriceRangeChange = null, onPriceReset = null,
  getContext = () => null, onAnnounce, onGestureStart = null, onGestureEnd = null, signal,
}) {
  const document = element.ownerDocument, window = document.defaultView;
  const toolbar = document.createElement('div');
  toolbar.className = 'chart-navigation';
  toolbar.setAttribute('role', 'group');
  toolbar.setAttribute('aria-label', '차트 시간 범위');
  const buttons = new Map();
  for (const [action, label, shortcut] of [
    ['left', '이전 구간 · Shift+←', 'Shift+ArrowLeft'],
    ['out', '차트 축소 · −', '-'], ['in', '차트 확대 · +', '+'],
    ['right', '다음 구간 · Shift+→', 'Shift+ArrowRight'],
    ['reset', '기본 범위로 · 0 / Alt+R', '0 Alt+R'],
  ]) {
    const button = document.createElement('button');button.type = 'button';
    button.dataset.chartNavigation = action;
    button.setAttribute('aria-label', label);button.title = label;
    button.setAttribute('aria-keyshortcuts', shortcut);
    button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${icons[action]}</svg>`;
    toolbar.append(button);buttons.set(action, button);
  }
  element.append(toolbar);

  const menu = document.createElement('div');menu.className = 'chart-context-menu';menu.id = 'atlas-chart-context-menu';menu.hidden = true;
  menu.setAttribute('role', 'menu');menu.setAttribute('aria-label', '차트 빠른 조작');menu.tabIndex = -1;
  const menuHeading = document.createElement('span');menuHeading.className = 'chart-context-heading';menu.append(menuHeading);
  const menuButtons = new Map();
  for (const [action, label, shortcut] of [
    ['in', '이 위치로 확대', '+'], ['out', '이 위치에서 축소', '−'],
    ['reset', '기본 범위로 복원', 'Alt+R'], ['fit', '조회 가능한 전체 범위', ''],
    ['copy', '날짜·값 복사', ''],
  ]) {
    const button = document.createElement('button');button.type = 'button';button.tabIndex = -1;
    button.setAttribute('role', 'menuitem');button.dataset.chartContext = action;
    const labelNode = document.createElement('span');labelNode.textContent = label;button.append(labelNode);
    if (shortcut) { const key = document.createElement('kbd');key.textContent = shortcut;button.append(key); }
    menu.append(button);menuButtons.set(action, button);
  }
  element.append(menu);
  const status = document.createElement('span');status.className = 'lab-visually-hidden chart-navigation-status';
  status.setAttribute('role', 'status');status.setAttribute('aria-live', 'polite');element.append(status);
  const announce = text => { if (onAnnounce) onAnnounce(text); else status.textContent = text; };
  const previousTouchAction = element.style.touchAction;
  element.style.touchAction = 'pan-y pinch-zoom';
  let frame = null, pending = null, pendingPanPrice = null, priceFrame = null, pendingPrice = null, drag = null, pinch = null, suppressClickUntil = 0;
  let transaction = null, wheelTimer = null, finishOnFlush = false;
  const delay = typeof window.setTimeout === 'function' ? window.setTimeout.bind(window) : globalThis.setTimeout;
  const cancelDelay = typeof window.clearTimeout === 'function' ? window.clearTimeout.bind(window) : globalThis.clearTimeout;
  function beginTransaction(label){if(transaction)return;transaction=label;onGestureStart?.(label);}
  function finishTransaction(){if(wheelTimer!==null)cancelDelay(wheelTimer);wheelTimer=null;finishOnFlush=false;if(transaction){transaction=null;onGestureEnd?.();}}
  function wheelTransaction(){beginTransaction('차트 확대·이동');if(onGestureStart||onGestureEnd){if(wheelTimer!==null)cancelDelay(wheelTimer);wheelTimer=delay(()=>{wheelTimer=null;flush();finishTransaction();},220);}}
  function discrete(next,label='차트 범위 변경'){flush();finishTransaction();if(sameWindow(next,getRange()))return;beginTransaction(label);finishOnFlush=true;enqueue(next);}
  const touches = new Map();
  const completedPinchTouches = new Set();
  let menuState = null, lastPointer = null, destroyed = false;
  const listeners = [];
  const listen = (target, type, handler, options) => { target.addEventListener(type, handler, options);listeners.push([target, type, handler, options]); };
  // Event labels are chart surfaces for wheel navigation, while their click,
  // pointer and keyboard activation keeps the usual interactive boundary.
  const interactive = (target, allowHistoryWheel = false) => Boolean(target?.closest?.(`button,input,select,textarea,summary,a,[contenteditable=true],.analysis-indicator-windows,#chart-indicator-manager,[role=button]${allowHistoryWheel ? ':not(.history-event-marker):not(.cycle-interval):not(.cycle-milestone-marker):not(.research-annotation)' : ''},[role=menu],[data-next-turn]`));
  const chartSvg = () => element.querySelector('svg[data-plot-left]:not([hidden])');
  const focusChart = () => chartSvg()?.focus?.({ preventScroll: true });

  function clearPending() {
    if (frame !== null) window.cancelAnimationFrame(frame);
    frame = null;pending = null;pendingPanPrice=null;
  }
  function clearPricePending() {
    if (priceFrame !== null) window.cancelAnimationFrame(priceFrame);
    priceFrame = null; pendingPrice = null;
  }
  const validPriceScope = record => {
    const axis=getPriceAxis();
    return Boolean(record&&sameWindow(record.range,getRange())&&record.tool===getTool()&&record.axis.scale===axis?.scale&&record.axis.inverted===axis?.inverted&&record.axis.top===axis?.top&&record.axis.bottom===axis?.bottom&&record.axis.right===axis?.right);
  };
  const validPanScope = record => {
    const axis=getPriceAxis();
    return Boolean(record&&sameScope(record.range,getRange())&&record.tool===getTool()&&record.axis.scale===axis?.scale&&record.axis.inverted===axis?.inverted&&record.axis.top===axis?.top&&record.axis.bottom===axis?.bottom&&record.axis.right===axis?.right);
  };
  function flushPrice() {
    if (priceFrame !== null) window.cancelAnimationFrame(priceFrame);
    priceFrame = null;
    const next = pendingPrice; pendingPrice = null;
    if (!destroyed && validPriceScope(next) && typeof onPriceRangeChange === 'function') onPriceRangeChange(next.domain);
  }
  function enqueuePrice(domain, gesture) {
    if (destroyed || !domain || !validPriceScope(gesture)) return;
    pendingPrice = { domain, range:gesture.range, axis:gesture.axis, tool:gesture.tool };
    if (priceFrame === null) priceFrame = window.requestAnimationFrame(flushPrice);
  }
  function current() {
    const live = getRange();
    if (pending && !sameScope(pending, live)) clearPending();
    return live ? (pending || live) : null;
  }
  function flush() {
    if (frame !== null) window.cancelAnimationFrame(frame);
    frame = null;
    const next = pending,price=pendingPanPrice;pending = null;pendingPanPrice=null;
    const live = getRange();
    if (!destroyed && sameScope(next, live) && (!price||validPanScope(price))) {
      if(price&&typeof onPriceRangeChange==='function')onPriceRangeChange(price.domain);
      if(!sameWindow(next,live))onRangeChange(next);
    }
    if(finishOnFlush)finishTransaction();
  }
  function enqueue(next,priceDomain=null,gesture=null) {
    if (destroyed || !sameScope(next, getRange())) return;
    pending = next;pendingPanPrice=priceDomain&&gesture?{domain:priceDomain,axis:gesture.axis,range:gesture.range,tool:gesture.tool}:null;
    if (frame === null) frame = window.requestAnimationFrame(flush);
  }
  function releaseCapture(id) {
    try { if (element.hasPointerCapture?.(id)) element.releasePointerCapture(id); } catch { /* A cancelled pointer can already be gone. */ }
  }
  function cancelGesture() {
    const previous = drag,wasPinching=Boolean(pinch),captured=[...touches.keys()];drag = null;pinch=null;touches.clear();completedPinchTouches.clear();delete element.dataset.dragging;delete element.dataset.pinching;delete element.dataset.priceScaling;delete element.dataset.timeScaling;clearPending();clearPricePending();
    if (previous?.active||wasPinching) suppressClickUntil = Date.now() + 500;
    if (previous) releaseCapture(previous.id);
    for(const id of captured)releaseCapture(id);
    finishTransaction();
  }
  function closeMenu(restoreFocus = false) {
    if (menu.hidden) return;
    menu.hidden = true;menuState = null;
    if (restoreFocus) focusChart();
  }
  function reset() {
    cancelGesture();closeMenu();
    if (!destroyed && getRange()) { beginTransaction('기본 범위 복원');onReset();finishTransaction();announce('차트의 기본 표시 범위를 복원했습니다.'); }
  }
  function resetPrice() {
    cancelGesture();closeMenu();
    if (!destroyed && getPriceAxis() && typeof onPriceReset === 'function') { beginTransaction('가격축 자동 맞춤');onPriceReset();finishTransaction();announce('가격축을 보이는 가격 범위에 자동으로 맞췄습니다.'); }
  }
  function plotBounds() {
    const svg = chartSvg(), rect = (svg || element).getBoundingClientRect();
    if (!svg) return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    const view = svg.viewBox?.baseVal;
    const scaleX = rect.width / (view?.width || svg.clientWidth || rect.width || 1);
    const scaleY = rect.height / (view?.height || svg.clientHeight || rect.height || 1);
    const left = Number(svg.dataset.plotLeft), right = Number(svg.dataset.plotRight);
    const top = Number(svg.dataset.plotTop ?? 0), bottom = Number(svg.dataset.plotBottom ?? (view?.height || svg.clientHeight || rect.height));
    if (![left, right, top, bottom].every(Number.isFinite) || right <= left || bottom <= top) return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    return { left: rect.left + (left - (view?.x || 0)) * scaleX, top: rect.top + (top - (view?.y || 0)) * scaleY, width: (right - left) * scaleX, height: (bottom - top) * scaleY };
  }
  function priceAxisBounds() {
    const axis = getPriceAxis(), svg = chartSvg();
    if (!svg || !normalizePriceDomain(axis,{scale:axis?.scale})) return null;
    const rect = svg.getBoundingClientRect(), view = svg.viewBox?.baseVal;
    const width = view?.width || svg.clientWidth || rect.width, height = view?.height || svg.clientHeight || rect.height;
    const right = axis.right ?? Number(svg.dataset.plotRight), top = axis.top, bottom = axis.bottom;
    if (![right,top,bottom].every(Number.isFinite) || bottom <= top || right >= width) return null;
    return { left:rect.left+(right-(view?.x||0))/width*rect.width, top:rect.top+(top-(view?.y||0))/height*rect.height, width:(width-right)/width*rect.width, height:(bottom-top)/height*rect.height };
  }
  function timeAxisBounds(){
    const svg=chartSvg();if(!svg||svg.dataset.timeAxisTop===undefined)return null;
    const rect=svg.getBoundingClientRect(),view=svg.viewBox?.baseVal,width=view?.width||svg.clientWidth||rect.width,height=view?.height||svg.clientHeight||rect.height;
    const left=Number(svg.dataset.plotLeft),right=Number(svg.dataset.plotRight),top=Number(svg.dataset.timeAxisTop);
    if(![left,right,top].every(Number.isFinite)||top>=height)return null;
    return {left:rect.left+(left-(view?.x||0))/width*rect.width,top:rect.top+(top-(view?.y||0))/height*rect.height,width:(right-left)/width*rect.width,height:(height-top)/height*rect.height};
  }
  const inside = (event, rect) => Boolean(rect && rect.width > 0 && rect.height > 0 && event.clientX >= rect.left && event.clientX <= rect.left + rect.width && event.clientY >= rect.top && event.clientY <= rect.top + rect.height);

  function wheel(event) {
    const range = current(), rect = plotBounds();
    if (!range || event.ctrlKey || event.metaKey || interactive(event.target, true) || !inside(event, rect)) return;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1;
    if (!event.deltaX && !event.deltaY) return;
    event.preventDefault();if(drag)cancelGesture();closeMenu();wheelTransaction();
    if (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
      enqueue(panRange(range, clamp((event.deltaX || event.deltaY) * unit, -rect.width, rect.width) / rect.width));
    } else {
      const factor = Math.exp(clamp(event.deltaY * unit, -600, 600) * .0015);
      enqueue(zoomRange(range, factor, (event.clientX - rect.left) / rect.width));
    }
  }
  function pointerDown(event) {
    flush();finishTransaction();
    const range = current(), rect = plotBounds();
    if (drag?.kind === 'price' && drag.id !== event.pointerId) { cancelGesture();return; }
    if (range && event.button === 0 && event.isPrimary !== false && !interactive(event.target) && typeof onPriceRangeChange === 'function') {
      const bounds = priceAxisBounds();
      if (inside(event,bounds)) {
        cancelGesture();closeMenu();suppressClickUntil = 0;
        drag = { kind:'price', id:event.pointerId, y:event.clientY, height:bounds.height, range:{...range}, axis:{...getPriceAxis()}, tool:getTool(), active:false };
        event.preventDefault();event.stopImmediatePropagation();return;
      }
    }
    if(range&&event.button===0&&event.isPrimary!==false&&!interactive(event.target)&&inside(event,timeAxisBounds())){
      cancelGesture();closeMenu();suppressClickUntil=0;
      const bounds=timeAxisBounds();drag={kind:'time-scale',id:event.pointerId,x:event.clientX,y:event.clientY,width:bounds.width,range,tool:getTool(),anchor:(event.clientX-bounds.left)/bounds.width,active:false};
      event.preventDefault();event.stopImmediatePropagation();return;
    }
    if (!range || getTool() === 'measure' || event.button !== 0 || (event.isPrimary === false&&event.pointerType!=='touch') || interactive(event.target) || !inside(event, rect)) return;
    if(event.pointerType==='touch'){
      if(event.isPrimary!==false)completedPinchTouches.clear();
      if(touches.size>=2)return;
      touches.set(event.pointerId,{x:event.clientX,y:event.clientY});
      if(touches.size===2){
        flush();drag=null;delete element.dataset.dragging;
        const [a,b]=[...touches.values()];
        pinch={range:current(),tool:getTool(),distance:Math.max(16,Math.hypot(a.x-b.x,a.y-b.y)),center:(a.x+b.x)/2,left:rect.left,width:rect.width};
        beginTransaction('차트 두 손가락 확대·이동');element.dataset.pinching='true';closeMenu();focusChart();
        for(const id of touches.keys()){try{element.setPointerCapture?.(id);}catch{}}
        event.preventDefault();event.stopImmediatePropagation();return;
      }
    }
    closeMenu();suppressClickUntil = 0;
    const axis=getPriceAxis(),axisBounds=priceAxisBounds(),canPanY=range.allowEmpty===true&&typeof onPriceRangeChange==='function'&&normalizePriceDomain(axis,{scale:axis?.scale})&&axisBounds&&event.clientY>=axisBounds.top&&event.clientY<=axisBounds.top+axisBounds.height;
    drag = { kind:'time',id: event.pointerId, x: event.clientX, y: event.clientY, width: rect.width, range, tool:getTool(), pointerType:event.pointerType, axis:canPanY?{...axis}:null,priceHeight:axisBounds?.height,active: false };
  }
  function pointerMove(event) {
    if(drag?.kind==='price'&&event.pointerId===drag.id){
      if(!validPriceScope(drag)||(event.buttons===0&&event.pointerType!=='touch')){cancelGesture();return;}
      const delta=event.clientY-drag.y;
      if(!drag.active){
        if(Math.abs(delta)<3)return;
        beginTransaction('가격축 확대·축소');drag.active=true;element.dataset.priceScaling='true';focusChart();
        try{element.setPointerCapture?.(event.pointerId);}catch{}
      }
      event.preventDefault();event.stopImmediatePropagation();
      enqueuePrice(scalePriceDomain(drag.axis,Math.exp(clamp(delta/drag.height,-1.5,1.5)*2)),drag);return;
    }
    if(drag?.kind==='time-scale'&&event.pointerId===drag.id){
      if(!sameScope(drag.range,getRange())||getTool()!==drag.tool||(event.buttons===0&&event.pointerType!=='touch')){cancelGesture();return;}
      const delta=event.clientX-drag.x;
      if(!drag.active){if(Math.abs(delta)<3)return;beginTransaction('시간축 확대·축소');drag.active=true;element.dataset.timeScaling='true';focusChart();try{element.setPointerCapture?.(event.pointerId);}catch{}}
      event.preventDefault();event.stopImmediatePropagation();enqueue(zoomRange(drag.range,Math.exp(clamp(delta/drag.width,-2,2)*2),drag.anchor));return;
    }
    if(pinch&&touches.has(event.pointerId)){
      if(!sameScope(pinch.range,getRange())||getTool()!==pinch.tool){cancelGesture();return;}
      touches.set(event.pointerId,{x:event.clientX,y:event.clientY});
      const [a,b]=[...touches.values()],distance=Math.max(16,Math.hypot(a.x-b.x,a.y-b.y)),center=(a.x+b.x)/2;
      const zoomed=zoomRange(pinch.range,pinch.distance/distance,(pinch.center-pinch.left)/pinch.width);
      enqueue(panRange(zoomed,(pinch.center-center)/pinch.width));
      event.preventDefault();event.stopImmediatePropagation();return;
    }
    if(touches.has(event.pointerId))touches.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if (element.contains(event.target) && inside(event, plotBounds())) lastPointer = { clientX: event.clientX, clientY: event.clientY };
    if (!drag || event.pointerId !== drag.id) return;
    if (!sameScope(drag.range, getRange()) || getTool() !== drag.tool || (event.buttons === 0 && event.pointerType !== 'touch')) { cancelGesture();return; }
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if(drag.axis&&(drag.axis.scale!==getPriceAxis()?.scale||drag.axis.inverted!==getPriceAxis()?.inverted)){cancelGesture();return;}
    if (!drag.active) {
      const twoDimensions=drag.axis&&(drag.pointerType!=='touch'||drag.tool==='pan');
      if (twoDimensions?Math.hypot(dx,dy)<5:Math.abs(dx)<5||Math.abs(dx)<Math.abs(dy)) return;
      beginTransaction('차트 위치 이동');drag.active = true;element.dataset.dragging = 'true';focusChart();
      try { element.setPointerCapture?.(event.pointerId); } catch { /* Window listeners still complete the gesture. */ }
    }
    event.preventDefault();event.stopImmediatePropagation();
    if(drag.axis&&!drag.pricePanning&&Math.abs(dy)>=3){
      // Horizontal drags retain Auto. If Y begins later in the same gesture,
      // use the currently visible USD range, then retain it through a return
      // to the original pointer Y instead of dropping the final zero offset.
      drag.axis={...getPriceAxis()};drag.pricePanning=true;
    }
    enqueue(panRange(drag.range, -dx / drag.width),drag.pricePanning?panPriceDomain(drag.axis,dy/drag.priceHeight):null,drag);
  }
  function pointerUp(event) {
    if(completedPinchTouches.delete(event.pointerId)){
      event.preventDefault();event.stopImmediatePropagation();suppressClickUntil=Date.now()+500;return;
    }
    if(pinch&&touches.has(event.pointerId)){
      event.preventDefault();event.stopImmediatePropagation();flush();
      const captured=[...touches.keys()];for(const id of captured)if(id!==event.pointerId)completedPinchTouches.add(id);touches.clear();pinch=null;drag=null;delete element.dataset.pinching;delete element.dataset.dragging;
      suppressClickUntil=Date.now()+500;for(const id of captured)releaseCapture(id);finishTransaction();return;
    }
    touches.delete(event.pointerId);
    if (!drag || event.pointerId !== drag.id) return;
    const previous = drag;drag = null;delete element.dataset.dragging;delete element.dataset.priceScaling;delete element.dataset.timeScaling;
    if (previous.active) {
      event.preventDefault();event.stopImmediatePropagation();if(previous.kind==='price')flushPrice();else flush();suppressClickUntil = Date.now() + 500;
    }
    releaseCapture(previous.id);
    finishTransaction();
  }
  function pointerCancel(event) { if (drag?.id === event.pointerId||touches.has(event.pointerId)) cancelGesture(); }
  function resumeTouchGesture(points){
    if(destroyed||!Array.isArray(points)||points.length!==2||getTool()==='measure'||new Set(points.map(point=>point.pointerId)).size!==2||points.some(point=>![point.pointerId,point.clientX,point.clientY].every(Number.isFinite)))return false;
    flush();cancelGesture();const range=getRange(),rect=plotBounds();if(!range||!rect.width)return false;
    for(const point of points)touches.set(point.pointerId,{x:point.clientX,y:point.clientY});
    const [a,b]=[...touches.values()];pinch={range,tool:getTool(),distance:Math.max(16,Math.hypot(a.x-b.x,a.y-b.y)),center:(a.x+b.x)/2,left:rect.left,width:rect.width};
    beginTransaction('차트 두 손가락 확대·이동');element.dataset.pinching='true';closeMenu();focusChart();
    for(const id of touches.keys())try{element.setPointerCapture?.(id);}catch{}
    return true;
  }
  function click(event) {
    if (event.detail !== 0 && suppressClickUntil > Date.now() && !interactive(event.target)) {
      suppressClickUntil = 0;event.preventDefault();event.stopImmediatePropagation();
    }
  }
  function doubleClick(event) {
    if(current()&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!interactive(event.target)&&typeof onPriceReset==='function'&&inside(event,priceAxisBounds())){
      event.preventDefault();event.stopImmediatePropagation();resetPrice();focusChart();return;
    }
    if(current()&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!interactive(event.target)&&inside(event,timeAxisBounds())){event.preventDefault();event.stopImmediatePropagation();reset();focusChart();return;}
    if (!current() || getTool() === 'measure' || event.ctrlKey || event.metaKey || event.altKey || interactive(event.target) || !inside(event, plotBounds())) return;
    event.preventDefault();event.stopImmediatePropagation();reset();focusChart();
  }
  function visibleMenuButtons() { return [...menuButtons.values()].filter(button => !button.hidden && !button.disabled); }
  function focusMenuButton(index) {
    const visible = visibleMenuButtons();
    if (!visible.length) return;
    const chosen = visible[(index + visible.length) % visible.length];
    for (const button of menuButtons.values()) button.tabIndex = button === chosen ? 0 : -1;
    chosen.focus({ preventScroll: true });
  }
  function openMenu(position = null) {
    const range = getRange();
    if (destroyed || !range) return false;
    cancelGesture();closeMenu();
    const rect = plotBounds();
    const point = position || (lastPointer && inside(lastPointer, rect) ? lastPointer : { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 });
    const anchor = clamp((point.clientX - rect.left) / (rect.width || 1), 0, 1);
    const context = getContext({ range, anchor, clientX: point.clientX, clientY: point.clientY });
    menuState = { range, anchor, context };
    menuHeading.textContent = typeof context?.label === 'string' ? context.label : '차트 범위';
    const copy = menuButtons.get('copy');copy.hidden = typeof context?.copyText !== 'string' || !context.copyText;
    copy.disabled = !window.navigator?.clipboard?.writeText;
    copy.title = copy.disabled ? '이 브라우저에서는 클립보드 복사를 사용할 수 없습니다.' : '표시한 출처·날짜·값을 클립보드에 복사';
    menuButtons.get('in').disabled = sameWindow(zoomRange(range, .8, anchor), range);
    menuButtons.get('out').disabled = sameWindow(zoomRange(range, 1.25, anchor), range);
    menuButtons.get('fit').disabled = sameWindow(fitRange(range), range);
    menu.hidden = false;
    const host = element.getBoundingClientRect();
    menu.style.left = `${clamp(point.clientX - host.left, 6, Math.max(6, host.width - menu.offsetWidth - 6))}px`;
    menu.style.top = `${clamp(point.clientY - host.top, 6, Math.max(6, host.height - menu.offsetHeight - 6))}px`;
    focusMenuButton(0);
    return true;
  }
  function contextMenu(event) {
    if (!getRange() || interactive(event.target) || !inside(event, plotBounds())) return;
    event.preventDefault();event.stopImmediatePropagation();openMenu(event);
  }
  function menuKeydown(event) {
    const visible = visibleMenuButtons(), index = visible.indexOf(document.activeElement);
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();event.stopPropagation();
      focusMenuButton(event.key === 'Home' ? 0 : event.key === 'End' ? visible.length - 1 : index + (event.key === 'ArrowDown' ? 1 : -1));
    } else if (event.key === 'Escape') {
      event.preventDefault();event.stopPropagation();closeMenu(true);
    } else if (event.key === 'Tab') closeMenu(true);
  }
  function keydown(event) {
    if (event.defaultPrevented || interactive(event.target)) return;
    if (event.key === 'Escape' && (drag||pinch)) { event.preventDefault();event.stopImmediatePropagation();cancelGesture();return; }
    const range = current();if (!range) return;
    let action = null;
    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) action = 'menu';
    else if (event.altKey && !event.ctrlKey && !event.metaKey && event.key.toLowerCase() === 'r') action = 'reset';
    else if (event.ctrlKey || event.metaKey) {
      action = { ArrowUp: 'in', ArrowDown: 'out', ArrowLeft: 'left', ArrowRight: 'right' }[event.key];
    } else if (!event.altKey) {
      action = { '+': 'in', '=': 'in', '-': 'out', '0': 'reset' }[event.key];
      if (event.shiftKey && ['ArrowLeft', 'ArrowRight'].includes(event.key)) action = event.key === 'ArrowLeft' ? 'left' : 'right';
    }
    if (!action) return;
    event.preventDefault();event.stopImmediatePropagation();
    if (action === 'menu') openMenu();
    else if (action === 'reset') reset();
    else if (action === 'left' || action === 'right') discrete(panRange(range, action === 'left' ? -.25 : .25));
    else discrete(zoomRange(range, action === 'in' ? .8 : 1.25));
  }
  for (const [action, button] of buttons) button.onclick = () => {
    const range = current();if (!range) return;
    if (action === 'reset') reset();
    else if (action === 'left' || action === 'right') discrete(panRange(range, action === 'left' ? -.25 : .25));
    else discrete(zoomRange(range, action === 'in' ? .8 : 1.25));
    focusChart();
  };
  for (const [action, button] of menuButtons) button.onclick = () => {
    const saved = menuState;
    if (!saved || !sameScope(saved.range, getRange())) { closeMenu(true);return; }
    closeMenu(true);
    if (action === 'copy') {
      // Only this explicit menu activation writes; hover and opening do not.
      const text = saved.context?.copyText;
      if (!text || !window.navigator?.clipboard?.writeText) return;
      const failed = () => { if (!destroyed) announce('복사하지 못했습니다. 브라우저의 클립보드 접근을 확인해 주세요.'); };
      try {
        Promise.resolve(window.navigator.clipboard.writeText(text)).then(
          () => { if (!destroyed) announce('선택한 날짜와 값을 복사했습니다.'); }, failed,
        );
      } catch { failed(); }
    } else if (action === 'reset') reset();
    else if (action === 'fit') discrete(fitRange(saved.range));
    else discrete(zoomRange(saved.range, action === 'in' ? .8 : 1.25, saved.anchor));
  };
  listen(element, 'wheel', wheel, { passive: false, capture: true });
  listen(element, 'pointerdown', pointerDown, true);
  listen(window, 'pointermove', pointerMove, { passive: false, capture: true });
  listen(window, 'pointerup', pointerUp, true);
  listen(window, 'pointercancel', pointerCancel, true);
  listen(element, 'lostpointercapture', pointerCancel, true);
  listen(element, 'click', click, true);
  listen(element, 'dblclick', doubleClick, true);
  listen(element, 'contextmenu', contextMenu, true);
  listen(element, 'keydown', keydown, true);
  listen(menu, 'keydown', menuKeydown);
  listen(document, 'pointerdown', event => { if(drag?.kind==='price'&&!inside(event,priceAxisBounds()))cancelGesture();if (!menu.hidden && !menu.contains(event.target)) closeMenu(); }, true);
  listen(document, 'focusin', event => { if (!menu.hidden && !menu.contains(event.target)) closeMenu(); });
  listen(window, 'blur', () => { cancelGesture();closeMenu(); });
  listen(window, 'resize', () => { cancelGesture();closeMenu(); });
  listen(document, 'scroll', () => closeMenu(), true);
  listen(document, 'visibilitychange', () => { if (document.hidden) { cancelGesture();closeMenu(); } });

  function update() {
    if (destroyed) return;
    // An explicit pan tool owns vertical touches. Crosshair mode still leaves
    // an ordinary vertical swipe available to the page until tracking starts.
    element.style.touchAction=getTool()==='pan'?'none':'pan-y pinch-zoom';
    const range = getRange();toolbar.hidden = !range;
    if (!range || (drag && (drag.kind==='price'?!validPriceScope(drag):!sameScope(drag.range,range)||getTool()!==drag.tool||(drag.axis&&!validPanScope(drag)))) || (pinch&&(!sameScope(pinch.range,range)||getTool()!==pinch.tool))) cancelGesture();
    if (pending && !sameScope(pending, range)) clearPending();
    if (pendingPrice && !validPriceScope(pendingPrice)) clearPricePending();
    if (menuState && !sameWindow(menuState.range, range)) closeMenu();
    if (!range) { suppressClickUntil = 0;return; }
    const units = rangeUnits(range), count = units.end - units.start + 1;
    buttons.get('in').disabled = count <= units.minimum;
    buttons.get('out').disabled = count >= units.maximum;
    buttons.get('left').disabled = units.start <= (units.free?units.hardMin:0);
    buttons.get('right').disabled = units.end >= (units.free?units.hardMax:units.max);
  }
  function destroy() {
    if (destroyed) return;
    destroyed = true;cancelGesture();closeMenu();
    for (const [target, type, handler, options] of listeners) target.removeEventListener(type, handler, options);
    signal?.removeEventListener('abort', destroy);
    for (const button of [...buttons.values(), ...menuButtons.values()]) button.onclick = null;
    toolbar.remove();menu.remove();status.remove();element.style.touchAction = previousTouchAction;
  }
  update();
  if (signal?.aborted) destroy();else signal?.addEventListener('abort', destroy, { once: true });
  return { toolbar, menu, update, openMenu, resetPrice, cancelGesture, resumeTouchGesture, destroy };
}
