// One pending pointer update per chart. Replacing a drawing cancels its old
// callback, so an earlier viewport cannot repaint a newer chart's readout.
const pendingCharts = new WeakMap();
const pointerCharts = new WeakMap();

// Retain only coordinates and semantic scope, never an SVG event target that
// becomes detached on redraw. A hover is a preview, not the committed point.
export function rememberChartHoverPointer(element, context, event, selections = []) {
  if(event.pointerType==='touch'||!Number.isFinite(event.clientX)||!Number.isFinite(event.clientY))return;
  pointerCharts.set(element,{context:[...context],selections:[...selections],pointer:{clientX:event.clientX,clientY:event.clientY,pointerType:event.pointerType||'mouse',ctrlKey:Boolean(event.ctrlKey),metaKey:Boolean(event.metaKey)}});
}

export function getChartHoverPointer(element, context, selection) {
  const saved=pointerCharts.get(element);
  // A caller may accept or reject a renderer's non-user selection update.
  // Both its original intent and the clamped visible point are valid aliases;
  // a different explicit offscreen selection must still invalidate the hover.
  return saved&&saved.context.length===context.length&&saved.context.every((value,index)=>Object.is(value,context[index]))&&(selection===undefined||saved.selections.some(value=>Object.is(value,selection)))?{...saved.pointer}:null;
}

export function clearChartHoverPointer(element) { pointerCharts.delete(element); }

// A pointer's price-axis position is separate from the selected candle's close.
// The series dot stays on the source value; secondary panes have no USD cursor.
export function paintPriceCursor({ horizontal, dot, tag, axis, top, bottom, selectedPrice, pointerY = null, formatPrice }) {
  const followsPointer = Number.isFinite(pointerY);
  const visible = !followsPointer || (pointerY >= top && pointerY <= bottom);
  for (const node of [horizontal, dot, tag]) node.setAttribute('visibility', visible ? 'visible' : 'hidden');
  if (!visible) return;
  const yy = followsPointer ? pointerY : axis.y(selectedPrice);
  const price = followsPointer ? axis.invert(yy) : selectedPrice;
  horizontal.setAttribute('y1', yy);horizontal.setAttribute('y2', yy);
  dot.setAttribute('cy', axis.y(selectedPrice));
  const labelTop = Math.max(top, Math.min(bottom - 18, yy - 9));
  tag.querySelector('rect').setAttribute('y', labelTop);
  tag.querySelector('text').setAttribute('y', labelTop + 13);
  tag.querySelector('text').textContent = formatPrice(price);
}

export function clearChartHover(element,{preservePointer=false}={}) {
  pendingCharts.get(element)?.cancel();
  pendingCharts.delete(element);
  if(!preservePointer)clearChartHoverPointer(element);
}

export function coalescedChartHover(element, paint) {
  clearChartHover(element);
  const view = element.ownerDocument?.defaultView;
  const request = typeof view?.requestAnimationFrame === 'function' ? view.requestAnimationFrame.bind(view) : null;
  const cancel = typeof view?.cancelAnimationFrame === 'function' ? view.cancelAnimationFrame.bind(view) : null;
  const state = { frame: null, event: null, cancel() { if (this.frame !== null) cancel?.(this.frame); this.frame = null; this.event = null; } };
  pendingCharts.set(element, state);
  const handler = event => {
    if (pendingCharts.get(element) !== state) return;
    if (!request) { paint(event); return; }
    state.event = event;
    if (state.frame !== null) return;
    state.frame = request(() => {
      state.frame = null;
      const latest = state.event; state.event = null;
      if (latest && pendingCharts.get(element) === state) paint(latest);
    });
  };
  handler.cancel = () => state.cancel();
  return handler;
}
