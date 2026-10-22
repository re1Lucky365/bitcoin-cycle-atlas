// One pending pointer update per chart. Replacing a drawing cancels its old
// callback, so an earlier viewport cannot repaint a newer chart's readout.
const pendingCharts = new WeakMap();

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

export function clearChartHover(element) {
  pendingCharts.get(element)?.cancel();
  pendingCharts.delete(element);
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
