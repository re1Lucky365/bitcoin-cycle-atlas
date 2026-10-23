import { utcDay } from './cycle-engine.js?v=1.11.0';
import { INTERVAL_RELATIONS } from './cycle-milestones.js?v=1.14.1-touch.1';

// Dates and classifications belong to the milestone engine. This renderer only
// packs their spans into the existing price plot; it never extends that plot.
const relationById = new Map(INTERVAL_RELATIONS.map(relation => [relation.id, relation]));
const finite = value => typeof value === 'number' && Number.isFinite(value);
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const fmt = value => Number(value.toFixed(6));
const dayOf = date => { try { return utcDay(date); } catch { return null; } };
const project = (x, date) => { try { const value = x({ date }); return finite(value) ? value : null; } catch { return null; } };
const textWidth = text => [...text].reduce((width, char) => width + (/\s/.test(char) ? 3 : char.charCodeAt(0) > 255 ? 10 : 5.6), 0);
const durationLabel = days => `${Math.floor(days / 7) ? `${Math.floor(days / 7)}주${days % 7 ? ` ${days % 7}일` : ''}` : `${days}일`}`;
const scenarioSelected = item => item.selectionKind === 'scenario' || item.kind === 'scenario' || item.kind === 'mixed';
const isDashed = item => scenarioSelected(item) || Boolean(item.provisional) || item.selectionWindowComplete === false;
const status = item => {
  const label = item.kind === 'scenario' ? '미래 가정' : item.kind === 'mixed' ? '관측 + 미래 가정' : item.selectionKind === 'scenario' ? '관측 가격 · 가정 기준' : item.provisional ? '관측 · 잠정 기준' : '관측 · 사후 기준';
  return `${label}${item.selectionWindowComplete === false ? ' · 부분 구간 후보' : ''}`;
};
const intersects = (a, b, gap = 0) => a.x < b.x + b.width + gap && a.x + a.width + gap > b.x && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;
const horizontalOverlap = (a, b, gap = 0) => Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1) + gap);

// Test segments, not just vertices: a steep sampled price trace can cross a
// duration line even when both sampled price points are far from its y value.
function segmentIntersectsBox(segment, box) {
  const { x1, y1, x2, y2 } = segment;
  if (Math.max(x1, x2) < box.x || Math.min(x1, x2) > box.x + box.width || Math.max(y1, y2) < box.y || Math.min(y1, y2) > box.y + box.height) return false;
  let low = 0, high = 1;
  const dx = x2 - x1, dy = y2 - y1;
  for (const [p, q] of [[-dx, x1 - box.x], [dx, box.x + box.width - x1], [-dy, y1 - box.y], [dy, box.y + box.height - y1]]) {
    if (p === 0) { if (q < 0) return false; continue; }
    const ratio = q / p;
    if (p < 0) low = Math.max(low, ratio); else high = Math.min(high, ratio);
    if (low > high) return false;
  }
  return true;
}

function priceSegments(points) {
  const segments = [];
  let previous = null;
  for (const point of Array.isArray(points) ? points : []) {
    if (!point || !finite(point.x) || !finite(point.y)) { previous = null; continue; }
    segments.push({ x1: previous?.x ?? point.x, y1: previous?.y ?? point.y, x2: point.x, y2: point.y });
    previous = point;
  }
  return segments;
}

function labelAt(item, y, { bounds, placed, obstacles, segments }) {
  const available = item.x2 - item.x1 - 12;
  if (available <= 0) return null;
  const dense = item.lanePitch < 18, fontSize = dense ? 8 : 10, height = dense ? 10 : 14, labelGap = dense ? 1 : 3;
  const variants = [
    { mode: 'full', text: `${item.relation.label} · ${item.duration}`, top: y - height / 2, height, fontSize, baseline: y + 3, penalty: 0 },
    { mode: 'compact', text: `${item.relation.label}\n${item.duration}`, top: y - 24, height: 22, fontSize: 10, width: Math.max(textWidth(item.relation.label) * .8, textWidth(item.duration) * .9) + 4, penalty: 36 },
    { mode: 'duration', text: item.duration, top: y - height / 2, height, fontSize, baseline: y + 3, penalty: item.active ? 320 : 240 },
  ];
  let best = null;
  for (const variant of variants) {
    const width = variant.width ?? textWidth(variant.text) * variant.fontSize / 10 + 4;
    if (width > available || variant.top < bounds.top + 1 || variant.top + variant.height > bounds.bottom) continue;
    const start = item.x1 + 6, end = item.x2 - width - 6, center = (start + end) / 2;
    for (const x of new Set([center, start, end, (start + center) / 2, (center + end) / 2])) {
      const box = { x, y: variant.top, width, height: variant.height };
      if (obstacles.some(other => intersects(box, other, 2)) || placed.some(other => (other.labelBox && intersects(box, other.labelBox, labelGap)) || intersects(box, { x: other.x1, y: other.y - 2, width: other.x2 - other.x1, height: 4 }, 1))) continue;
      const priceHits = segments.reduce((count, segment) => count + Number(segmentIntersectsBox(segment, box)), 0);
      // Relation names carry the meaning. Prefer the smaller two-line name to
      // a bare number even when a price segment makes the name less convenient.
      const score = priceHits * 4 + variant.penalty + Math.abs(x - center) / Math.max(1, item.x2 - item.x1);
      if (!best || score < best.score) best = { ...box, text: variant.text, mode: variant.mode, fontSize: variant.fontSize, baseline: variant.baseline, score };
    }
  }
  return best;
}

function wrapText(text, width) {
  const lines = [];
  let current = '';
  for (const word of text.split(/\s+/)) {
    if (textWidth(word) > width) {
      if (current) { lines.push(current); current = ''; }
      for (const char of word) {
        if (current && textWidth(current + char) > width) { lines.push(current); current = ''; }
        current += char;
      }
      continue;
    }
    const next = current ? `${current} ${word}` : word;
    if (current && textWidth(next) > width) { lines.push(current); current = word; } else current = next;
  }
  if (current) lines.push(current);
  return lines;
}

function previewFor(item, bounds) {
  const maxWidth = bounds.right - bounds.left - 12;
  if (maxWidth < 12) return null;
  const lines = [
    `${item.relation.label} · ${item.duration}`,
    `${item.interval.startDate} → ${item.interval.endDate} UTC`,
    `${item.days}일 · ${status(item.interval)}`,
  ].flatMap(text => wrapText(text, maxWidth));
  const width = Math.max(...lines.map(textWidth)) + 8, height = lines.length * 12 + 4;
  if (height > bounds.bottom - bounds.top - 4) return null;
  return { x: clamp((item.x1 + item.x2 - width) / 2, bounds.left + 2, bounds.right - width - 2), y: clamp(item.y - height - 24, bounds.top + 2, bounds.bottom - height - 2), width, height, lines };
}

function spanMarkup(item) {
  const { interval, relation, x1, x2, y, active, related, clippedStart, clippedEnd, labelBox, previewBox } = item;
  const color = relation.color, weight = active ? 2.6 : related ? 2 : 1.6;
  const dash = isDashed(interval) ? ' stroke-dasharray="5 3"' : '';
  const title = `${relation.label} · ${interval.startDate} → ${interval.endDate} UTC\n${item.duration} · ${item.days}일 · ${status(interval)}${clippedStart || clippedEnd ? '\n현재 화면에는 일부만 표시됩니다. 기간은 전체 양 끝 날짜의 차이입니다.' : ''}`;
  const edge = Math.min(3, item.capHeight), head = Math.min(4, (x2 - x1) / 3);
  let markup = `<g class="cycle-interval-span cycle-interval${active ? ' is-active' : ''}${related ? ' is-related' : ''}${item.crowded ? ' is-crowded' : ''}" data-cycle-interval="${esc(interval.id)}" data-cycle-relation="${relation.id}" data-kind="${esc(interval.kind || 'observed')}" data-start-date="${interval.startDate}" data-end-date="${interval.endDate}" data-days="${item.days}" data-clipped-start="${clippedStart}" data-clipped-end="${clippedEnd}" data-x1="${fmt(x1)}" data-x2="${fmt(x2)}" data-raw-x1="${fmt(item.rawX1)}" data-raw-x2="${fmt(item.rawX2)}" data-y="${fmt(y)}" data-label-mode="${item.labelMode}" role="button" tabindex="0" aria-pressed="${active}" aria-label="${esc(title.replaceAll('\n', ' · '))}"><title>${esc(title)}</title>`;
  // Only the 8px line and painted text receive pointers. There is no broad hit
  // rectangle: the rest of the plot remains available for pan and inspection.
  markup += `<line class="cycle-interval-hit" x1="${fmt(x1)}" x2="${fmt(x2)}" y1="${fmt(y)}" y2="${fmt(y)}" stroke="transparent" stroke-width="8" pointer-events="stroke"/><line class="cycle-interval-line" x1="${fmt(x1)}" x2="${fmt(x2)}" y1="${fmt(y)}" y2="${fmt(y)}" stroke="${color}" stroke-width="${weight}"${dash} opacity="${active ? 1 : related ? .95 : .78}" pointer-events="none"/>`;
  const stroke = `fill="none" stroke="${color}" stroke-width="${weight}" stroke-linejoin="round" pointer-events="none"`;
  if (clippedStart) {
    markup += `<path class="cycle-interval-continuation cycle-interval-continuation-start" d="M${fmt(x1 + head)},${fmt(y - edge)}L${fmt(x1)},${fmt(y)}L${fmt(x1 + head)},${fmt(y + edge)}M${fmt(x1 + 2 * head)},${fmt(y - edge)}L${fmt(x1 + head)},${fmt(y)}L${fmt(x1 + 2 * head)},${fmt(y + edge)}" ${stroke}/>`;
  } else {
    markup += `<path class="cycle-interval-cap cycle-interval-start-cap" d="M${fmt(x1)},${fmt(y - edge)}V${fmt(y + edge)}" ${stroke}/>`;
  }
  if (clippedEnd) {
    markup += `<path class="cycle-interval-continuation cycle-interval-continuation-end" d="M${fmt(x2 - 2 * head)},${fmt(y - edge)}L${fmt(x2 - head)},${fmt(y)}L${fmt(x2 - 2 * head)},${fmt(y + edge)}M${fmt(x2 - head)},${fmt(y - edge)}L${fmt(x2)},${fmt(y)}L${fmt(x2 - head)},${fmt(y + edge)}" ${stroke}/>`;
  } else {
    markup += `<path class="cycle-interval-end-arrow" d="M${fmt(x2 - head)},${fmt(y - edge)}L${fmt(x2)},${fmt(y)}L${fmt(x2 - head)},${fmt(y + edge)}" ${stroke}/>`;
  }
  if (labelBox) {
    const center = fmt(labelBox.x + labelBox.width / 2);
    markup += `<text class="cycle-interval-duration cycle-interval-label" x="${center}" y="${fmt(labelBox.baseline ?? labelBox.y + 11)}" text-anchor="middle" font-size="${labelBox.fontSize}" font-weight="${active ? 700 : 600}" fill="${color}" paint-order="stroke" stroke="#101a27" stroke-width="${labelBox.mode === 'compact' ? 2.3 : 3}" stroke-linejoin="round" pointer-events="visiblePainted">`;
    markup += labelBox.mode === 'compact' ? `<tspan class="cycle-interval-relation-label" x="${center}" y="${fmt(y - 14)}" font-size="8">${esc(relation.label)}</tspan><tspan x="${center}" y="${fmt(y - 4)}" font-size="9">${esc(item.duration)}</tspan>` : esc(labelBox.text);
    markup += '</text>';
  }
  if (previewBox) markup += `<g class="cycle-interval-preview" visibility="hidden" pointer-events="none" aria-hidden="true"><text class="cycle-interval-preview-label" x="${fmt(previewBox.x + 4)}" y="${fmt(previewBox.y + 11)}" font-size="10" font-weight="600" fill="${color}" paint-order="stroke" stroke="#101a27" stroke-width="4" stroke-linejoin="round">${previewBox.lines.map((line, index) => `<tspan x="${fmt(previewBox.x + 4)}"${index ? ' dy="12"' : ''}>${esc(line)}</tspan>`).join('')}</text></g>`;
  return `${markup}</g>`;
}

/**
 * Internal SVG group only. x receives the original endpoint as { date }; right
 * is the absolute price-plot edge. clipId refers to the caller's price clip.
 * Every valid visible span remains in a bounded bottom band. Relation rows and
 * original-date subtracks are independent of zoom, price values and selection.
 * Labels use horizontal room first and may be omitted; title/ARIA and the
 * caller's interval selection remain available without adding chart height.
 */
export function cycleIntervalsOverlayMarkup({ intervals = [], start, end, x, left, right, top, bottom, clipId = 'price', relation = 'all', activeIntervalId = null, activeMarkerId = null, obstacles = [], pricePoints = [] } = {}) {
  const displayedRelations = relationById.has(relation) ? INTERVAL_RELATIONS.filter(item => item.id === relation) : [...INTERVAL_RELATIONS];
  const rows = displayedRelations.map(item => ({ ...item, spans: [], active: false, related: false }));
  const empty = { markup: '', visibleCount: 0, labelCount: 0, hiddenLabelCount: 0, items: [], rows, relations: rows, lanes: [], bandTop: null, bandBottom: null };
  const first = dayOf(start), last = dayOf(end);
  if (first === null || last === null || last <= first || ![left, right, top, bottom].every(finite) || right <= left || bottom <= top || typeof x !== 'function') return empty;
  // This is an annotation region inside the unchanged price plot, not reserved
  // layout space. Its height never depends on the visible data, HUDs or prices.
  const bandTop = bottom - Math.min(200, (bottom - top) * .4), bandBottom = bottom;
  const bounds = { left, right, top: bandTop, bottom: bandBottom }, selectedRelations = new Set(displayedRelations.map(item => item.id)), candidates = [], items = [];
  for (const interval of Array.isArray(intervals) ? intervals : []) {
    if (!interval?.id || !selectedRelations.has(interval.relation)) continue;
    const from = dayOf(interval.startDate), to = dayOf(interval.endDate);
    if (from === null || to === null || to <= from) continue;
    const item = { interval, relation: relationById.get(interval.relation), first: from, last: to };
    candidates.push(item);
    if (to <= first || from >= last) continue;
    const rawX1 = project(x, interval.startDate), rawX2 = project(x, interval.endDate);
    if (rawX1 === null || rawX2 === null || rawX2 <= rawX1) continue;
    const x1 = clamp(rawX1, left, right), x2 = clamp(rawX2, left, right);
    if (x2 <= x1) continue;
    Object.assign(item, { days: to - from, duration: durationLabel(to - from), rawX1, rawX2, x1, x2, clippedStart: from < first || rawX1 < left, clippedEnd: to > last || rawX2 > right, active: interval.id === activeIntervalId, related: Boolean(activeMarkerId && (interval.fromId === activeMarkerId || interval.toId === activeMarkerId)) });
    items.push(item);
  }
  const safeObstacles = (Array.isArray(obstacles) ? obstacles : []).filter(box => box && [box.x, box.y, box.width, box.height].every(finite) && box.width > 0 && box.height > 0);
  const segments = priceSegments(pricePoints), order = new Map(displayedRelations.map((item, index) => [item.id, index]));
  const byDate = (a, b) => a.first - b.first || a.last - b.last || String(a.interval.id).localeCompare(String(b.interval.id));
  let trackCount = 0;
  for (const row of rows) {
    const ends = [], spans = candidates.filter(item => item.relation.id === row.id).sort(byDate);
    row.lane = trackCount;
    for (const item of spans) {
      let track = ends.findIndex(end => end <= item.first);
      if (track < 0) track = ends.length;
      ends[track] = item.last;
      item.lane = trackCount + track;
      item.subtrack = track;
    }
    row.trackCount = Math.max(1, ends.length);
    trackCount += row.trackCount;
  }
  const bandHeight = bandBottom - bandTop, lowest = bandBottom - Math.min(7, bandHeight / 4), highest = bandTop + Math.min(8, bandHeight / 4);
  const lanePitch = trackCount > 1 ? Math.min(22, Math.max(0, (lowest - highest) / (trackCount - 1))) : 22;
  items.sort((a, b) => order.get(a.relation.id) - order.get(b.relation.id) || a.subtrack - b.subtrack || byDate(a, b));
  for (const item of items) {
    item.y = lowest - item.lane * lanePitch;
    item.lanePitch = lanePitch;
    item.compact = lanePitch < 18;
    item.labelBox = null;
    item.capHeight = Math.min(3, lanePitch / 3, item.y - bandTop, bandBottom - item.y);
    item.previewBox = previewFor(item, bounds);
  }
  // Selection only prioritizes readable text and foreground painting. It never
  // moves a row; dense layouts drop text before crossing a neighboring line.
  for (const item of [...items].sort((a, b) => Number(b.active) - Number(a.active) || Number(b.related) - Number(a.related))) {
    item.labelBox = labelAt(item, item.y, { bounds, placed: items.filter(other => other !== item), obstacles: safeObstacles.filter(box => box.x < item.x2 + 2 && box.x + box.width > item.x1 - 2), segments: segments.filter(segment => Math.max(segment.x1, segment.x2) >= item.x1 && Math.min(segment.x1, segment.x2) <= item.x2) });
    item.labelMode = item.labelBox?.mode || 'hidden';
    item.crowded = items.some(other => other !== item && Math.abs(other.y - item.y) < 6 && horizontalOverlap(item, other, 5) > 0);
  }
  for (const row of rows) {
    row.spans = items.filter(item => item.relation.id === row.id);
    row.active = row.spans.some(item => item.active);
    row.related = row.spans.some(item => item.related);
  }
  const labelCount = items.filter(item => item.labelBox).length;
  const markup = `<g class="cycle-interval-overlay" clip-path="url(#${esc(clipId)})" data-band-top="${fmt(bandTop)}" data-band-bottom="${fmt(bandBottom)}" data-cycle-interval-count="${items.length}" data-cycle-interval-label-count="${labelCount}" data-cycle-relation-count="${rows.length}" pointer-events="none">${[...items].sort((a, b) => Number(a.active) - Number(b.active) || Number(a.related) - Number(b.related)).map(spanMarkup).join('')}</g>`;
  return { markup, visibleCount: items.length, labelCount, hiddenLabelCount: items.length - labelCount, items, rows, relations: rows, lanes: [...new Set(items.map(item => item.y))].sort((a, b) => b - a), bandTop, bandBottom };
}
