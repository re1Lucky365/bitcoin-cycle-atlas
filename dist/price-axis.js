// Price viewports are always expressed in the original USD coordinates.
// Indexed labels are a display concern and never change this domain.
export function normalizePriceDomain(domain, { scale = 'log' } = {}) {
  if (!domain || !['log', 'linear'].includes(scale)) return null;
  const { min, max } = domain;
  if (![min, max].every(Number.isFinite) || max <= min || (scale === 'log' && min <= 0)) return null;
  // Leave numeric headroom for unit factors and reject domains whose transform
  // collapses to a single floating-point value. These are display limits only.
  if ([min,max].some(value => value !== 0 && (Math.abs(value) < 1e-300 || Math.abs(value) > 1e300))) return null;
  const low=scale==='log'?Math.log(min):min,high=scale==='log'?Math.log(max):max,span=high-low;
  if(!Number.isFinite(span)||span<=Number.EPSILON*Math.max(Math.abs(low),Math.abs(high),Number.MIN_VALUE)*8)return null;
  return { min, max };
}

/** Scale about a price-axis anchor, using ratios for log and distances for linear. */
export function scalePriceDomain(axis, factor, anchor = .5) {
  const domain = normalizePriceDomain(axis, { scale: axis?.scale });
  if (!domain || !Number.isFinite(factor) || factor <= 0 || !Number.isFinite(anchor)) return null;
  const transform = axis.scale === 'log' ? Math.log : value => value;
  const reverse = axis.scale === 'log' ? Math.exp : value => value;
  const low = transform(domain.min), high = transform(domain.max);
  const fraction = Math.max(0, Math.min(1, anchor)), pivot = low + (high - low) * fraction;
  const minimum = axis.scale === 'log' ? 1e-6 : Math.max(1, Math.abs(pivot)) * 1e-8;
  const span = Math.max(minimum, (high - low) * Math.max(.05, Math.min(20, factor)));
  let first = pivot - span * fraction, last = pivot + span * (1 - fraction);
  if (axis.scale === 'linear' && domain.min >= 0 && first < 0) { last -= first; first = 0; }
  const result = { min: reverse(first), max: reverse(last) };
  return normalizePriceDomain(result, { scale: axis.scale });
}

/** Translate a viewport with a drag; empty linear price space is permitted. */
export function panPriceDomain(axis, fraction) {
  const domain = normalizePriceDomain(axis, { scale: axis?.scale });
  if (!domain || !Number.isFinite(fraction)) return null;
  const transform = axis.scale === 'log' ? Math.log : value => value;
  const reverse = axis.scale === 'log' ? Math.exp : value => value;
  const low = transform(domain.min), high = transform(domain.max), shift = (high - low) * fraction * (axis.inverted ? -1 : 1);
  const result = { min: reverse(low + shift), max: reverse(high + shift) };
  return normalizePriceDomain(result, { scale: axis.scale });
}

/** A narrow axis-only hit surface; no overlay receives price-plot gestures. */
export function priceAxisMarkup({ left, right, top, bottom }) {
  if (![left, right, top, bottom].every(Number.isFinite) || right <= left || bottom <= top) return '';
  return `<g class="price-axis-interaction" data-price-axis="true"><title>가격축 · 위아래로 드래그하여 확대·축소 · 두 번 눌러 자동 맞춤</title><rect x="${left}" y="${top}" width="${right - left}" height="${bottom - top}" fill="transparent" pointer-events="all" style="cursor:ns-resize;touch-action:none"/></g>`;
}

export function timeAxisMarkup({ left, right, top, bottom }) {
  if (![left,right,top,bottom].every(Number.isFinite) || right <= left || bottom <= top) return '';
  return `<g class="time-axis-interaction" data-time-axis="true"><title>시간축 · 좌우 드래그하여 시간 간격 확대·축소 · 두 번 눌러 기본 범위</title><rect x="${left}" y="${top}" width="${right-left}" height="${bottom-top}" fill="transparent" pointer-events="all" style="cursor:ew-resize;touch-action:none"/></g>`;
}
