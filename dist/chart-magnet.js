/** Drawing-anchor snapping. These functions never modify market observations. */
export const MAGNET_MODES = Object.freeze(['off', 'weak', 'strong']);
export const MAGNET_LABELS = Object.freeze({ off: '끄기', weak: '약한 자석', strong: '강한 자석' });
export const normalizeMagnetMode = value => MAGNET_MODES.includes(value) ? value : 'off';

/** TradingView's documented temporary modifier: off → strong; enabled → off. */
export function effectiveMagnetMode(mode, { ctrlKey = false, metaKey = false } = {}) {
  const value = normalizeMagnetMode(mode);
  return ctrlKey || metaKey ? value === 'off' ? 'strong' : 'off' : value;
}

/**
 * The caller finds the nearest time/bar with binary search. Compare the four
 * actual OHLC values in screen space, so log axes and indexed display work too.
 * A line with no OHLC has only its actual close/model point as a candidate.
 * thresholdPx is in the same coordinate system as pointerY and y(price).
 */
export function resolveMagnetPoint({ row, pointerY, y, invertY, mode = 'off', ctrlKey = false, metaKey = false, thresholdPx = 12 }) {
  const effective = effectiveMagnetMode(mode, { ctrlKey, metaKey });
  const candle = row?.candle || row || {};
  const hasOHLC = ['open', 'high', 'low', 'close'].every(key => Number.isFinite(candle[key]) && candle[key] > 0);
  const candidates = hasOHLC
    ? [['C', candle.close], ['O', candle.open], ['H', candle.high], ['L', candle.low]]
    : [['C', row?.price ?? row?.close]].filter(([, value]) => Number.isFinite(value) && value > 0);
  const fallback = candidates[0]?.[1];
  if (!Number.isFinite(pointerY)) return Number.isFinite(fallback) ? { price: fallback, field: 'C', snapped: false, mode: effective } : null;
  const free = invertY(pointerY);
  let nearest = null;
  if (effective !== 'off') for (const [field, price] of candidates) {
    const distance = Math.abs(y(price) - pointerY);
    if (Number.isFinite(distance) && (!nearest || distance < nearest.distance)) nearest = { price, field, distance };
  }
  if (nearest && (effective === 'strong' || nearest.distance <= Math.max(0, thresholdPx))) {
    return { price: nearest.price, field: nearest.field, snapped: true, mode: effective };
  }
  return Number.isFinite(free) && free > 0 ? { price: free, field: 'free', snapped: false, mode: effective } : null;
}

/** Preserve chosen prices when an axis, viewport, or indicator is redrawn. */
export function advanceMeasurement(measurement, anchor) {
  if (!anchor?.date || !Number.isFinite(anchor.price) || anchor.price <= 0) return measurement;
  if (!measurement || measurement.endDate) return {
    startDate: anchor.date, startPrice: anchor.price, startField: anchor.field || 'C', startKind: anchor.kind || 'observed',
    endDate: null, endPrice: null, endField: null, endKind: null
  };
  return { ...measurement, endDate: anchor.date, endPrice: anchor.price, endField: anchor.field || 'C', endKind: anchor.kind || 'observed' };
}

/** lookup is O(log N) and can return either a daily price or an intraday candle. */
export function measurePriceAnchors(measurement, { lookup, split = null, preview = null } = {}) {
  if (!measurement) return null;
  const start = lookup(measurement.startDate);
  const endDate = measurement.endDate || preview?.date;
  const end = endDate ? lookup(endDate) : null;
  if (!start || (endDate && !end)) return null;
  const valid = value => Number.isFinite(value) && value > 0;
  const startPrice = valid(measurement.startPrice) ? measurement.startPrice : start.price ?? start.close;
  const endPrice = end ? valid(measurement.endPrice) ? measurement.endPrice : valid(preview?.price) ? preview.price : end.price ?? end.close : null;
  if (!valid(startPrice) || (end && !valid(endPrice))) return null;
  const startDate = start.date, resolvedEnd = end?.date ?? null;
  const includesSimulated = measurement.startKind === 'simulated' || measurement.endKind === 'simulated' || preview?.kind === 'simulated' || Boolean(split && (startDate > split || (resolvedEnd && resolvedEnd > split)));
  const deltaSeconds = end ? (Date.parse(resolvedEnd) - Date.parse(startDate)) / 1000 : null;
  return {
    startDate, endDate: resolvedEnd, startPrice, endPrice,
    startField: measurement.startField || 'C', endField: measurement.endField || preview?.field || 'C',
    deltaSeconds, deltaDays: end ? deltaSeconds / 86400 : null,
    changePrice: end ? endPrice - startPrice : null, changePct: end ? (endPrice / startPrice - 1) * 100 : null,
    includesSimulated, kind: includesSimulated ? 'simulated' : 'observed'
  };
}

export function measurementOverlayMarkup(clipId) {
  return `<g class="chart-measurement" pointer-events="none" display="none" role="img"><g class="measurement-geometry" clip-path="url(#${clipId})"><rect class="measurement-area" fill-opacity=".1"/><line class="measurement-line" stroke-width="1.4" stroke-dasharray="4 3"/><circle class="measurement-start" r="4" fill="#10151c" stroke-width="2"/><circle class="measurement-end" r="4" fill="#10151c" stroke-width="2"/></g><g class="measurement-label"><rect rx="4" fill="#142131" stroke="#557b9f"/><text x="8" y="15" fill="#d8e7f8" font-size="10"/><text x="8" y="29" fill="#d8e7f8" font-size="10"/><text x="8" y="43" fill="#e1ecf8" font-size="10"/><text x="8" y="57" fill="#b9cde3" font-size="10"/></g></g><g class="chart-snap-feedback" pointer-events="none" display="none" aria-hidden="true"><circle r="7" fill="#142131" fill-opacity=".5" stroke="#80bfff" stroke-width="2"/><text fill="#b9dcff" font-size="10" font-weight="600"/></g>`;
}

const setAttrs = (node, values) => { for (const [key, value] of Object.entries(values)) node.setAttribute(key, value); };

/** Cache tiny SVG nodes once per draw, then update only attributes on hover. */
export function createMeasurementOverlay(svg, { x, y, left, right, top, bottom, small = false, formatPrice, formatDate, formatChange, formatDuration }) {
  const layer = svg.querySelector('.chart-measurement'), snap = svg.querySelector('.chart-snap-feedback');
  const area = layer.querySelector('.measurement-area'), line = layer.querySelector('.measurement-line'), start = layer.querySelector('.measurement-start'), end = layer.querySelector('.measurement-end');
  const label = layer.querySelector('.measurement-label'), rect = label.querySelector('rect'), texts = [...label.querySelectorAll('text')];
  const snapCircle = snap.querySelector('circle'), snapText = snap.querySelector('text');
  const field = value => value === 'free' ? '자유' : value || 'C';
  return {
    paint(result, pending = false) {
      if (!result) { layer.setAttribute('display', 'none'); return; }
      layer.removeAttribute('display'); layer.dataset.pending = String(pending);
      const ax = x(result.startDate), ay = y(result.startPrice), hasEnd = Boolean(result.endDate), bx = hasEnd ? x(result.endDate) : ax, by = hasEnd ? y(result.endPrice) : ay;
      const color = hasEnd ? result.changePrice < 0 ? '#db9ba7' : '#8ac8b9' : '#93c3e8';
      setAttrs(start, { cx: ax, cy: ay, stroke: color, 'data-measure-date': result.startDate, 'data-measure-price': result.startPrice, 'data-measure-field': result.startField });
      setAttrs(end, { cx: bx, cy: by, stroke: color, display: hasEnd ? 'inline' : 'none', 'data-measure-date': result.endDate || '', 'data-measure-price': result.endPrice ?? '', 'data-measure-field': result.endField });
      setAttrs(area, { x: Math.min(ax, bx), y: Math.min(ay, by), width: Math.abs(bx - ax), height: Math.max(1, Math.abs(by - ay)), fill: color, display: hasEnd ? 'inline' : 'none' });
      setAttrs(line, { x1: ax, y1: ay, x2: bx, y2: by, stroke: color, display: hasEnd ? 'inline' : 'none' });
      const signed = hasEnd ? `${result.changePrice > 0 ? '+' : result.changePrice < 0 ? '−' : ''}${formatPrice(Math.abs(result.changePrice))}` : '';
      const lines = hasEnd ? [
        `${formatDate(result.startDate)} · ${field(result.startField)} ${formatPrice(result.startPrice)}`,
        `${formatDate(result.endDate)} · ${field(result.endField)} ${formatPrice(result.endPrice)}`,
        `Δ ${signed} · ${formatChange(result.changePct)}`,
        `Δ ${formatDuration(result)}${result.includesSimulated ? ' · 가정 포함' : ''}`
      ] : [`${formatDate(result.startDate)} · ${field(result.startField)} ${formatPrice(result.startPrice)}`, `끝점 선택${result.includesSimulated ? ' · 가정 포함' : ''}`];
      const width = Math.min(small ? 220 : 252, Math.max(100, right - left - 12)), height = lines.length * 14 + 9;
      const labelX = Math.max(left + 4, Math.min(right - width - 4, (ax + bx) / 2 - width / 2)), labelY = Math.max(top + 5, Math.min(bottom - height - 4, Math.min(ay, by) - height - 10));
      setAttrs(label, { transform: `translate(${labelX},${labelY})` }); setAttrs(rect, { width, height, stroke: color });
      texts.forEach((node, index) => { node.textContent = lines[index] || ''; });
      layer.setAttribute('aria-label', lines.join(' · '));
    },
    showSnap(anchor) {
      if (!anchor?.snapped) { snap.setAttribute('display', 'none'); return; }
      snap.removeAttribute('display'); const xx = x(anchor.date), yy = y(anchor.price);
      setAttrs(snapCircle, { cx: xx, cy: yy });
      const endAligned = xx > right - 72;
      setAttrs(snapText, { x: xx + (endAligned ? -11 : 11), y: Math.max(top + 11, yy - 10), 'text-anchor': endAligned ? 'end' : 'start' });
      snapText.textContent = `${anchor.field} · 자석`;
      snap.dataset.field = anchor.field; snap.dataset.price = String(anchor.price);
    }
  };
}
