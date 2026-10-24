import { utcDay, dateFromDay } from './cycle-engine.js?v=1.19.0';

/** Resolve against the current model on every redraw. A scenario replacement
 * must never retain endpoint IDs, prices, or dates from its previous path. */
export function resolveCycleSelection(data, selection) {
  if (!data || !selection || !Array.isArray(data.markers) || !Array.isArray(data.intervals)) return null;
  if (selection.kind === 'marker') {
    const marker = data.markers.find(item => item.id === selection.id);
    if (!marker) return null;
    return { marker, interval: null, markerIds: [marker.id], intervals: data.intervals.filter(item => item.fromId === marker.id || item.toId === marker.id) };
  }
  if (selection.kind !== 'interval') return null;
  const interval = data.intervals.find(item => item.id === selection.id);
  if (!interval) return null;
  const from = data.markers.find(item => item.id === interval.fromId);
  const to = data.markers.find(item => item.id === interval.toId);
  if (!from || !to || from.date !== interval.startDate || to.date !== interval.endDate || from.date >= to.date) return null;
  return { marker: null, interval, markerIds: [...new Set([from.id, to.id])], intervals: [interval] };
}

/** Fit both real endpoints with breathing room, bounded by the model's data
 * domain. Clipping the viewport never changes the selected interval itself. */
export function cycleSelectionViewport(selection, { min, max } = {}) {
  if (!selection?.interval) return null;
  try {
    const first = utcDay(selection.interval.startDate), last = utcDay(selection.interval.endDate);
    const minimum = utcDay(min), maximum = utcDay(max);
    if (last <= first || maximum <= minimum || first < minimum || last > maximum) return null;
    const pad = Math.max(14, Math.ceil((last - first) * .08));
    return { start: dateFromDay(Math.max(minimum, first - pad)), end: dateFromDay(Math.min(maximum, last + pad)) };
  } catch { return null; }
}

/** Show the entire annotated history and the model's available near cycle.
 * Long-range valuation targets are not manufactured into extra cycles. */
export function cycleOverviewViewport(data, { min, max } = {}) {
  try {
    const minimum = utcDay(min), maximum = utcDay(max);
    if (maximum <= minimum || !Array.isArray(data?.markers)) return null;
    const days = data.markers.flatMap(marker => {
      try { const day = utcDay(marker.date); return day >= minimum && day <= maximum ? [day] : []; }
      catch { return []; }
    });
    if (!days.length) return null;
    const first = Math.min(...days), last = Math.max(...days);
    const pad = Math.max(30, Math.min(180, Math.ceil((last - first) * .04)));
    return { start: dateFromDay(Math.max(minimum, first - pad)), end: dateFromDay(Math.min(maximum, last + pad)) };
  } catch { return null; }
}
