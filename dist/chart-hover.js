// One pending pointer update per chart. Replacing a drawing cancels its old
// callback, so an earlier viewport cannot repaint a newer chart's readout.
const pendingCharts = new WeakMap();

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
