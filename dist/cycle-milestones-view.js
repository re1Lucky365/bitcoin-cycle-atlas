import { utcDay } from './cycle-engine.js?v=1.19.0';
import { shiftCalendarMonths } from './cycle-timing.js?v=1.19.0';
import { MILESTONE_TYPES, INTERVAL_RELATIONS } from './cycle-milestones.js?v=1.19.0';

/** Pure presentation: all dates, prices and classifications come from the
 * milestone engine. Zoom changes geometry and label density, never endpoints. */
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const finite = value => typeof value === 'number' && Number.isFinite(value);
const types = new Map(MILESTONE_TYPES.map(type => [type.id, type]));
const relations = new Map(INTERVAL_RELATIONS.map(relation => [relation.id, relation]));
const numberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const smallPriceFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 8 });
const formatPrice = value => (Math.abs(value) < 1 ? smallPriceFormat : numberFormat).format(value);
const textWidth = text => [...text].reduce((width, char) => width + (char.charCodeAt(0) > 255 ? 10 : 5.6), 0);
const intersects = (a, b, gap = 4) => a.x < b.x + b.width + gap && a.x + a.width + gap > b.x && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;
const dayOf = date => { try { return utcDay(date); } catch { return null; } };
const position = (project, value) => { try { const result = project(value); return finite(result) ? result : null; } catch { return null; } };
const scenarioSelected = item => item.selectionKind === 'scenario' || item.kind === 'scenario' || item.kind === 'mixed';
const status = item => {
  const label = item.kind === 'scenario' ? '미래 가정' : item.kind === 'mixed' ? '관측 + 미래 가정' : item.selectionKind === 'scenario' ? '관측 가격 · 가정 기준' : item.provisional ? '관측 · 잠정 기준' : '관측 · 사후 기준';
  return `${label}${item.selectionWindowComplete === false ? ' · 부분 구간 후보' : ''}`;
};
const dashed = item => scenarioSelected(item) || Boolean(item.provisional) || item.selectionWindowComplete === false;
const sourceText = source => typeof source === 'string' ? source : source?.label || source?.name || source?.title || '';
const fmt = value => Number(value.toFixed(3));

/** Calendar elapsed time, not an inclusive count of plotted weekly bars. */
export function cycleDurationLabel(days) {
  if (!Number.isSafeInteger(days) || days < 0) return '기간 없음';
  const weeks = Math.floor(days / 7), remainder = days % 7;
  return weeks ? `${weeks}주${remainder ? ` ${remainder}일` : ''}` : `${remainder}일`;
}

function markerTitle(marker) {
  const type = types.get(marker.type);
  return `${type?.label || marker.label || marker.type} · ${marker.date} UTC · $${formatPrice(marker.price)}\n${status(marker)}${marker.definition ? `\n${marker.definition}` : ''}`;
}

function labelBox(point, bounds, placed, points, active = false) {
  const width = textWidth(point.label) + 14, height = 18;
  if (width > bounds.right - bounds.left - 4 || height > bounds.bottom - bounds.top - 4) return null;
  const preferred = point.y > (bounds.top + bounds.bottom) / 2 ? -1 : 1;
  const candidates = [];
  for (const offset of [6, 22, 38]) for (const side of [preferred, -preferred]) {
    const y = point.y + side * (point.radius + offset) - (side < 0 ? height : 0);
    if (y < bounds.top + 2 || y + height > bounds.bottom - 2) continue;
    for (const shift of [0, -width * .35, width * .35]) {
      candidates.push({ x: clamp(point.x - width / 2 + shift, bounds.left + 2, bounds.right - width - 2), y, width, height });
    }
  }
  const clearOfLabels = box => !placed.some(other => intersects(box, other));
  const clearOfPoints = box => !points.some(other => intersects(box, { x: other.x - other.radius, y: other.y - other.radius, width: other.radius * 2, height: other.radius * 2 }, 2));
  return candidates.find(box => clearOfLabels(box) && clearOfPoints(box)) || (active ? candidates.find(clearOfLabels) : null) || null;
}

function previewBox(point, bounds) {
  const width = textWidth(point.label) + 14, height = 18;
  if (width > bounds.right - bounds.left - 4 || height > bounds.bottom - bounds.top - 4) return null;
  return { x: clamp(point.x - width / 2, bounds.left + 2, bounds.right - width - 2), y: clamp(point.y - point.radius - height - 6, bounds.top + 2, bounds.bottom - height - 2), width, height };
}

function markerLabel(point, box) {
  const edgeX = clamp(point.x, box.x + 5, box.x + box.width - 5), edgeY = box.y > point.y ? box.y : box.y + box.height;
  return `<path d="M${fmt(point.x)},${fmt(point.y)}L${fmt(edgeX)},${fmt(edgeY)}" fill="none" stroke="${point.color}" stroke-width=".8" opacity=".65"/><rect class="cycle-marker-label-bg" x="${fmt(box.x)}" y="${fmt(box.y)}" width="${fmt(box.width)}" height="${box.height}" rx="4" fill="#132030" fill-opacity=".96" stroke="${point.color}" stroke-opacity=".45"/><text class="cycle-marker-label" x="${fmt(box.x + box.width / 2)}" y="${fmt(box.y + 12.5)}" text-anchor="middle" fill="${point.color}" font-size="10" font-weight="600">${esc(point.label)}</text>`;
}

/** x receives the original marker; y receives its USD price. right is the
 * absolute plot boundary. An inner clip keeps rings out of secondary panes. */
export function milestoneMarkersMarkup({ markers = [], start, end, x, y, left, right, top, bottom, clipId = 'price', activeMarkerId = null, activeMarkerIds = [], activeInterval = null } = {}) {
  const empty = { markup: '', markers: [], count: 0, labelCount: 0, hiddenLabelCount: 0, labelMode: 'empty', labelBudget: 0 };
  const first = dayOf(start), last = dayOf(end);
  if (first === null || last === null || last < first || ![left, right, top, bottom].every(finite) || right <= left || bottom <= top || typeof x !== 'function' || typeof y !== 'function') return empty;
  const bounds = { left, right, top, bottom }, valid = [];
  const activeIds = new Set(Array.isArray(activeMarkerIds) ? activeMarkerIds : []);
  if (activeMarkerId) activeIds.add(activeMarkerId);
  const selectedFacts = intervalFacts(activeInterval);
  // Resolve endpoints from the supplied marker collection. Interval metadata
  // alone must never invent a price point or bypass a caller's marker filter.
  const selectedEndpoints = selectedFacts ? [
    markers.find(marker => marker.id === activeInterval.fromId && marker.type === selectedFacts.relation.from && marker.date === activeInterval.startDate),
    markers.find(marker => marker.id === activeInterval.toId && marker.type === selectedFacts.relation.to && marker.date === activeInterval.endDate),
  ] : [];
  const hasSelectedEndpoints = selectedEndpoints.length === 2 && selectedEndpoints.every(marker => marker && finite(marker.price) && marker.price > 0);
  const intervalEndpointIds = new Set(hasSelectedEndpoints ? selectedEndpoints.map(marker => marker.id) : []);
  for (const id of intervalEndpointIds) activeIds.add(id);
  for (const marker of markers) {
    const type = types.get(marker.type), day = dayOf(marker.date);
    if (!type || !marker.id || day === null || day < first || day > last || !finite(marker.price) || marker.price <= 0) continue;
    const xx = position(x, marker), yy = position(y, marker.price);
    if (xx === null || yy === null || xx < left || xx > right || yy < top || yy > bottom) continue;
    valid.push({ marker, x: xx, y: yy, label: type.label, color: type.color, active: activeIds.has(marker.id), selectedEndpoint: intervalEndpointIds.has(marker.id), box: null });
  }
  const width = right - left, height = bottom - top;
  const dense = valid.length > width / 22, overview = width / Math.max(1, last - first) < .45;
  const radius = dense ? 7 : clamp(width / 70, 9, 15);
  const coincident = new Map();
  for (const point of valid) {
    const key = `${Math.round(point.x * 2)}:${Math.round(point.y * 2)}`;
    const group = coincident.get(key) || [];
    group.push(point);coincident.set(key, group);
  }
  // Two meanings can honestly share a date and price. Nested rings preserve
  // both colors; no arbitrary shift changes the apparent event location.
  for (const group of coincident.values()) group.forEach((point, index) => {
    point.radius = (group.length === 1 && point.marker.type === 'pit-stop' ? radius * .78 : radius) + index * 4 + (point.active ? 1 : 0);
    point.coincident = group.length > 1;
  });
  const selectedLabelBudget = Math.min(2, valid.filter(point => point.active).length);
  const budget = Math.min(valid.length, Math.max(selectedLabelBudget, Math.floor(width / (overview ? 130 : 86)) * Math.min(2, Math.max(1, Math.floor(height / 180)))));
  const placed = [], chosen = [];
  const pending = [...valid];
  while (pending.length && placed.length < budget) {
    pending.sort((a, b) => Number(b.active) - Number(a.active) ||
      (chosen.length ? Math.min(...chosen.map(point => Math.abs(b.x - point.x))) - Math.min(...chosen.map(point => Math.abs(a.x - point.x))) : 0) ||
      Number(['cycle-top', 'bottom'].includes(b.marker.type)) - Number(['cycle-top', 'bottom'].includes(a.marker.type)) || a.marker.date.localeCompare(b.marker.date));
    const point = pending.shift();
    point.box = labelBox(point, bounds, placed, valid, point.active);
    if (point.box) { placed.push(point.box); chosen.push(point); }
  }
  const id = `${clipId}-cycle-milestones`;
  let markup = `<defs><clipPath id="${esc(id)}"><rect x="${left}" y="${top}" width="${width}" height="${height}"/></clipPath></defs><g class="cycle-milestone-markers" clip-path="url(#${esc(id)})" data-cycle-marker-count="${valid.length}" data-cycle-label-mode="${overview || dense ? 'overview' : 'detail'}">`;
  if (hasSelectedEndpoints) {
    const coordinates = selectedEndpoints.map(marker => ({ marker, x: position(x, marker) }));
    const [from, to] = coordinates;
    if (from.x !== null && to.x !== null && to.x > from.x && selectedFacts.last > first && selectedFacts.first < last) {
      const bandLeft = Math.max(left, from.x), bandRight = Math.min(right, to.x);
      if (bandRight > bandLeft) markup += `<rect class="cycle-selected-interval-band" data-selected-cycle-interval="${esc(activeInterval.id || '')}" x="${fmt(bandLeft)}" y="${top}" width="${fmt(bandRight - bandLeft)}" height="${height}" fill="${selectedFacts.relation.color}" fill-opacity=".065" pointer-events="none" aria-hidden="true"/>`;
    }
    for (const endpoint of coordinates) {
      const endpointDay = dayOf(endpoint.marker.date);
      if (endpoint.x === null || endpoint.x < left || endpoint.x > right || endpointDay < first || endpointDay > last) continue;
      markup += `<line class="cycle-selected-endpoint-guide" data-guide-marker="${esc(endpoint.marker.id)}" data-date="${esc(endpoint.marker.date)}" x1="${fmt(endpoint.x)}" x2="${fmt(endpoint.x)}" y1="${top}" y2="${bottom}" stroke="${types.get(endpoint.marker.type).color}" stroke-width="1" stroke-dasharray="3 5" opacity=".6" pointer-events="none" aria-hidden="true"/>`;
    }
  }
  // Selected rings and their labels remain above coincident inactive points.
  for (const point of [...valid].sort((a, b) => Number(a.active) - Number(b.active))) {
    const { marker, color, active } = point, title = markerTitle(marker), preview = point.box ? null : previewBox(point, bounds);
    markup += `<g class="cycle-milestone-marker cycle-marker${point.box ? ' has-label' : ''}${active ? ' is-active' : ''}${point.selectedEndpoint ? ' is-interval-endpoint' : ''}" data-cycle-marker="${esc(marker.id)}" data-date="${esc(marker.date)}" data-kind="${esc(marker.kind)}" data-milestone-type="${esc(marker.type)}" role="button" tabindex="0" aria-pressed="${active}" aria-label="${esc(title.replaceAll('\n', ' · '))}"><title>${esc(title)}</title><circle class="cycle-marker-hit" cx="${fmt(point.x)}" cy="${fmt(point.y)}" r="${Math.max(12, point.radius)}" fill="transparent"${point.coincident ? ' pointer-events="none"' : ''}/><circle class="cycle-marker-circle cycle-marker-ring" cx="${fmt(point.x)}" cy="${fmt(point.y)}" r="${fmt(point.radius)}" fill="${color}" fill-opacity="${active ? '.23' : dashed(marker) ? '.07' : '.17'}" stroke="${color}" stroke-width="${active ? '2.6' : '1.5'}"${dashed(marker) ? ' stroke-dasharray="4 3"' : ''}${point.coincident ? ' pointer-events="stroke"' : ''}/><circle class="cycle-marker-center" cx="${fmt(point.x)}" cy="${fmt(point.y)}" r="1.8" fill="${color}"/>`;
    if (point.box) markup += markerLabel(point, point.box);
    if (preview) markup += `<g class="cycle-marker-preview" visibility="hidden" pointer-events="none" aria-hidden="true">${markerLabel(point, preview)}</g>`;
    markup += '</g>';
  }
  markup += '</g>';
  return { markup, markers: valid, count: valid.length, labelCount: placed.length, hiddenLabelCount: valid.length - placed.length, labelMode: overview || dense ? 'overview' : 'detail', labelBudget: budget };
}

function intervalFacts(interval) {
  const relation = relations.get(interval?.relation), first = dayOf(interval?.startDate), last = dayOf(interval?.endDate);
  if (!relation || first === null || last === null || last <= first) return null;
  return { relation, first, last, days: last - first, duration: cycleDurationLabel(last - first) };
}

/** Standalone SVG. left/right are margins, matching chartPaneLayout; unlike
 * marker geometry, right is NOT the absolute right edge. All nine rows remain. */
export function cycleIntervalsMarkup({ intervals = [], start, end, width = 1000, left = 12, right = 82, rowHeight = 40, id = 'cycle-intervals', activeIntervalId = null, activeMarkerId = null, split = null, relation: selectedRelation = 'all' } = {}) {
  width = finite(width) ? Math.max(1, width) : 1000;
  left = clamp(finite(left) ? left : 12, 0, Math.max(0, width - 1));
  right = clamp(finite(right) ? right : 82, 0, Math.max(0, width - left - 1));
  rowHeight = Math.max(38, finite(rowHeight) ? rowHeight : 40);
  const plotRight = width - right, plotWidth = plotRight - left, first = dayOf(start), last = dayOf(end);
  const validDomain = first !== null && last !== null && last >= first, spanDays = validDomain ? Math.max(1, last - first) : 1;
  const xx = day => left + (day - first) / spanDays * plotWidth;
  let cursor = 7, visibleCount = 0;
  const displayedRelations = relations.has(selectedRelation) ? INTERVAL_RELATIONS.filter(relation => relation.id === selectedRelation) : INTERVAL_RELATIONS;
  const rows = displayedRelations.map(relation => {
    const spans = [];
    if (validDomain) for (const interval of intervals) {
      if (interval.relation !== relation.id || !interval.id) continue;
      const facts = intervalFacts(interval);
      if (!facts || facts.last <= first || facts.first >= last) continue;
      const x1 = clamp(xx(Math.max(first, facts.first)), left, plotRight), x2 = clamp(xx(Math.min(last, facts.last)), left, plotRight);
      if (x2 <= x1) continue;
      spans.push({ interval, ...facts, x1, x2, active: interval.id === activeIntervalId, related: Boolean(activeMarkerId && (interval.fromId === activeMarkerId || interval.toId === activeMarkerId)), clippedStart: facts.first < first, clippedEnd: facts.last > last, labelBox: null });
    }
    spans.sort((a, b) => a.first - b.first || a.last - b.last || a.interval.id.localeCompare(b.interval.id));
    const laneEnds = [];
    for (const item of spans) {
      let lane = laneEnds.findIndex(endX => endX + 7 <= item.x1);
      if (lane < 0) lane = laneEnds.length;
      laneEnds[lane] = item.x2;
      item.y = cursor + 28 + lane * 18;
      const labelWidth = textWidth(item.duration) + 8;
      if (labelWidth + 6 <= item.x2 - item.x1) item.labelBox = { x: (item.x1 + item.x2 - labelWidth) / 2, y: item.y - 14, width: labelWidth, height: 14 };
    }
    const height = Math.max(rowHeight, 38 + Math.max(0, laneEnds.length - 1) * 18);
    const row = { ...relation, top: cursor, height, spans,
      active: Boolean(activeIntervalId && intervals.some(interval => interval.id === activeIntervalId && interval.relation === relation.id && intervalFacts(interval))),
      related: Boolean(activeMarkerId && intervals.some(interval => interval.relation === relation.id && (interval.fromId === activeMarkerId || interval.toId === activeMarkerId) && intervalFacts(interval))),
    };
    cursor += height;
    visibleCount += spans.length;
    return row;
  });
  const height = cursor + 26, clipId = `${id}-plot`;
  let markup = `<svg class="cycle-interval-chart" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="group" aria-label="사이클 기준점 사이의 실제 경과 기간 · ${rows.length}개 관계"><title>사이클 기간 · 날짜 차이로 계산한 ${rows.length}개 관계</title><desc>관측과 미래 가정은 다른 선으로 표시합니다. 각 구간을 선택하면 전체 시작일, 종료일, 정확한 경과일과 정의를 확인합니다. 화면 밖 부분을 잘라도 원래 기간은 바뀌지 않습니다.</desc><defs><clipPath id="${esc(clipId)}"><rect x="${left}" y="0" width="${plotWidth}" height="${cursor}"/></clipPath></defs>`;
  for (const row of rows) {
    markup += `<g class="cycle-interval-row${row.active ? ' is-active' : ''}${row.related ? ' has-related' : ''}" data-cycle-relation="${esc(row.id)}">`;
    if (row.active || row.related) markup += `<rect class="cycle-interval-row-highlight" x="${left}" y="${row.top}" width="${plotWidth}" height="${row.height - 2}" fill="${row.color}" fill-opacity="${row.active ? '.065' : '.035'}" pointer-events="none" aria-hidden="true"/>`;
    markup += `<line x1="${left}" x2="${plotRight}" y1="${row.top + row.height - 2}" y2="${row.top + row.height - 2}" stroke="#293747" stroke-opacity=".65"/><text class="cycle-interval-row-label" x="${left + 3}" y="${row.top + 10}" fill="${row.color}" font-size="10" font-weight="600">${esc(row.label)}</text>`;
    if (!row.spans.length) markup += `<text class="cycle-interval-empty" x="${left + 6}" y="${row.top + 29}" fill="#94a6bc" font-size="10">현재 범위에 없음</text>`;
    markup += `<g clip-path="url(#${esc(clipId)})">`;
    for (const item of row.spans) {
      const interval = item.interval, color = row.color, isDashed = dashed(interval), { active, related } = item;
      const title = `${row.label} · ${interval.startDate} → ${interval.endDate} UTC\n${item.duration} · ${item.days}일 · ${status(interval)}${item.clippedStart || item.clippedEnd ? '\n현재 화면에는 일부만 표시됩니다. 기간은 전체 양 끝 날짜의 차이입니다.' : ''}`;
      const hitWidth = Math.min(plotWidth, Math.max(12, item.x2 - item.x1)), hitX = clamp((item.x1 + item.x2 - hitWidth) / 2, left, plotRight - hitWidth);
      markup += `<g class="cycle-interval-span cycle-interval${active ? ' is-active' : ''}${related ? ' is-related' : ''}" data-cycle-interval="${esc(interval.id)}" data-kind="${esc(interval.kind)}" data-start-date="${esc(interval.startDate)}" data-end-date="${esc(interval.endDate)}" data-days="${item.days}" data-clipped-start="${item.clippedStart}" data-clipped-end="${item.clippedEnd}" role="button" tabindex="0" aria-pressed="${active}" aria-label="${esc(title.replaceAll('\n', ' · '))}"><title>${esc(title)}</title><rect class="cycle-interval-hit" x="${fmt(hitX)}" y="${fmt(item.y - 13)}" width="${fmt(hitWidth)}" height="20" rx="3" fill="${active || related ? color : 'transparent'}" fill-opacity="${active ? '.12' : related ? '.065' : '0'}"/><path class="cycle-interval-line" d="M${fmt(item.x1)},${fmt(item.y)}H${fmt(item.x2)}" fill="none" stroke="${color}" stroke-width="${active ? '2.6' : related ? '2' : '1.6'}"${isDashed ? ' stroke-dasharray="5 3"' : ''}/>`;
      if (!item.clippedStart) markup += `<path d="M${fmt(item.x1)},${fmt(item.y - 3)}v6" fill="none" stroke="${color}"/>`;
      if (!item.clippedEnd && item.x2 - item.x1 >= 7) markup += `<path d="M${fmt(item.x2 - 4)},${fmt(item.y - 3)}L${fmt(item.x2)},${fmt(item.y)}L${fmt(item.x2 - 4)},${fmt(item.y + 3)}" fill="none" stroke="${color}"/>`;
      if (item.labelBox) markup += `<text class="cycle-interval-duration" x="${fmt((item.x1 + item.x2) / 2)}" y="${fmt(item.y - 4)}" text-anchor="middle" fill="${color}" font-size="10">${esc(item.duration)}</text>`;
      markup += '</g>';
    }
    markup += '</g></g>';
  }
  if (validDomain) {
    const splitDay = dayOf(split);
    if (splitDay !== null && splitDay >= first && splitDay <= last) markup += `<line class="cycle-interval-observed-split" x1="${fmt(xx(splitDay))}" x2="${fmt(xx(splitDay))}" y1="0" y2="${cursor}" stroke="#b5c2d3" stroke-dasharray="2 5" opacity=".55" pointer-events="none"><title>관측 기준일 ${esc(split)} UTC</title></line>`;
    // Keep the exact calendar grid used by drawAtlasPriceChart. Equal pixel
    // fractions can land in arbitrary months and repeat coarse year labels.
    const small = width < 600;
    const months = spanDays > 5000 ? (small ? 60 : 24) : spanDays > 3000 ? (small ? 36 : 24) : spanDays > 1100 ? (small ? 12 : 6) : spanDays > 550 ? (small ? 6 : 3) : spanDays > 270 ? 3 : 1;
    let tick = `${start.slice(0, 4)}-01-01`;
    while (dayOf(tick) < first) tick = shiftCalendarMonths(tick, months);
    while (dayOf(tick) <= last) {
      const tickX = xx(dayOf(tick)), dateLabel = months >= 12 ? tick.slice(0, 4) : tick.slice(2, 7).replace('-', '.');
      markup += `<text class="cycle-interval-date" x="${fmt(tickX)}" y="${cursor + 18}" text-anchor="${tickX > width - 35 ? 'end' : 'middle'}" fill="#9badc2" font-size="10">${dateLabel}</text>`;
      tick = shiftCalendarMonths(tick, months);
    }
  }
  markup += '</svg>';
  return { markup, height, width, left, right, plotRight, rows, visibleCount };
}

export function cycleLegendMarkup() {
  const samples = [
    { dashed: false, name: '실선 원과 기간선', label: '실선 · 관측 사후 기준' },
    { dashed: true, name: '점선 원과 기간선', label: '점선 · 잠정·가정' },
  ].map(sample => `<span class="cycle-style-sample"><svg width="30" height="16" viewBox="0 0 30 16" role="img" aria-label="${sample.name}"><circle cx="6" cy="8" r="4.8" fill="none" stroke="currentColor" stroke-width="1.2"${sample.dashed ? ' stroke-dasharray="2 2"' : ''}/><path d="M15,8H29" fill="none" stroke="currentColor" stroke-width="1.2"${sample.dashed ? ' stroke-dasharray="3 2"' : ''}/></svg><span>${sample.label}</span></span>`).join('');
  return `<div class="cycle-milestone-legend cycle-legend" role="group" aria-label="사이클 기준점 색상 범례">${MILESTONE_TYPES.map(type => `<span class="cycle-legend-item" data-milestone-type="${esc(type.id)}" title="${esc(type.description || type.label)}"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="${type.id === 'pit-stop' ? 4.68 : 6}" fill="${type.color}" fill-opacity=".17" stroke="${type.color}" stroke-width="1.2"/></svg><span>${esc(type.label)}</span></span>`).join('')}<span class="cycle-legend-status cycle-legend-note" role="group" aria-label="원과 기간선의 상태"><span class="cycle-legend-status-label">원·기간선</span>${samples}</span></div>`;
}

/** The image's printed numbers are source claims, never current measurements. */
export function cycleSourceReferenceMarkup(sourceReference) {
  if (!sourceReference || !Array.isArray(sourceReference.cycles) || !sourceReference.periodClaims) return '';
  const reference = sourceReference;
  return `<details class="cycle-source-reference"><summary>첨부 원본의 기간 표 · 2024년 당시 가정 포함</summary><p>${esc(reference.title)} · ${esc(reference.author)} · ${esc(reference.publishedAt)}<br>${esc(reference.instrument)}${reference.chartCapturedAt?`<br>차트 작성 ${esc(reference.chartCapturedAt)} · 게시 시각과 구분`:''}${reference.url?`<br><a href="${esc(reference.url)}" target="_blank" rel="noopener noreferrer">X 원문</a>`:''}</p><p>${esc(reference.note || '원본에 적힌 비교값입니다. 현재 앱의 실제 경과 기간과 구분합니다.')}</p><div class="cycle-source-table-wrap" tabindex="0" role="region" aria-label="원본 이미지 기간 비교표"><table><caption>원본에 표기된 주 수 · 계산 입력으로 사용하지 않음</caption><thead><tr><th scope="col">관계</th>${reference.cycles.map(cycle => `<th scope="col">${esc(cycle)}</th>`).join('')}</tr></thead><tbody>${INTERVAL_RELATIONS.map(relation => `<tr><th scope="row">${esc(relation.id==='bottom-ath'?'BOTTOM → Sustained ATH':relation.id==='ath-cycle-top'?'Sustained ATH → CYCLE TOP':relation.label)}</th>${reference.cycles.map((_, index) => `<td>${esc(reference.periodClaims[relation.id]?.[index] ?? '—')}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p>단위: 주. 원본의 주봉 날짜·지수·선택 기준과 현재 일말 자료는 다릅니다. 그림에 맞추기 위해 실제 기간이나 가격을 변경하지 않습니다.</p></details>`;
}

function selectionWindowFields(item, prefix = '') {
  const fields = [], label = prefix ? `${prefix} · ` : '';
  if (dayOf(item.windowStart) !== null && dayOf(item.windowEnd) !== null) fields.push({ label: `${label}실제 선택 구간 · UTC`, value: `${item.windowStart} → ${item.windowEnd}` });
  if (dayOf(item.requestedWindowEnd) !== null) fields.push({ label: `${label}요청한 구간 종료 · UTC`, value: item.requestedWindowEnd });
  if (item.selectionWindowComplete === false) fields.push({ label: `${label}선택 구간 상태`, value: '부분 구간 후보 · 요청한 종료일까지의 가격 경로가 아직 없습니다.' });
  return fields;
}

/** Inspection objects use the shared app inspector; no DOM mutation or HTML. */
export function cycleMilestoneInspection(marker, { asOf } = {}) {
  const type = types.get(marker?.type);
  if (!type || dayOf(marker.date) === null || !finite(marker.price) || marker.price <= 0) return null;
  const fields = [
    { label: '날짜 · UTC', value: marker.date },
    { label: '가격 · USD', value: `$${formatPrice(marker.price)}` },
    { label: '기준점 상태', value: status(marker) },
    { label: '선택 기준', value: marker.definition || type.description || '명시된 사이클 기준점' },
  ];
  fields.push(...selectionWindowFields(marker));
  if (marker.confirmationDate) fields.push({ label: '조건 확인일 · UTC', value: marker.confirmationDate });
  if (asOf) fields.push({ label: '관측 기준일 · UTC', value: asOf });
  if (sourceText(marker.source)) fields.push({ label: '자료·모형', value: sourceText(marker.source) });
  const note = marker.kind === 'scenario' ? '선택한 미래 가격 경로와 명시된 규칙에서 정한 가정 기준점입니다. 확정된 미래 고점·저점이나 확률 예측이 아닙니다.' : marker.selectionKind === 'scenario' ? '가격과 날짜는 실제 관측값이지만, 이 기준점의 선택은 현재 미래 가정에 속합니다. 관측된 가격이라고 해서 사이클 역할이 확정된 것은 아닙니다.' : marker.provisional ? '가격은 실제 관측입니다. 현재 자료에서 고른 잠정 기준점이며 최종 시장 사이클 고점·저점으로 확정하지 않습니다.' : '실제 관측에 명시된 선택 규칙을 적용한 사후 기준점입니다. 당시 미리 알 수 있었던 매매 신호를 뜻하지 않습니다.';
  return { label: type.label, date: marker.date, kind: scenarioSelected(marker) ? 'assumption' : 'observed', fields,
    note: `${note}${marker.selectionWindowComplete === false ? ' 요청한 선택 구간이 완성되지 않아 현재 제공된 부분 경로 안에서 고른 후보입니다.' : ''}` };
}

export function cycleIntervalInspection(interval, { asOf } = {}) {
  const facts = intervalFacts(interval);
  if (!facts) return null;
  const fields = [
    { label: `${types.get(facts.relation.from)?.label || '시작'} · UTC`, value: interval.startDate },
    { label: `${types.get(facts.relation.to)?.label || '종료'} · UTC`, value: interval.endDate },
    { label: '정확한 경과 기간', value: `${facts.duration} · ${facts.days}일` },
    { label: '주 단위', value: `${numberFormat.format(facts.days / 7)}주 · UTC 날짜 차이 ÷ 7` },
    { label: '기간의 상태', value: status(interval) },
  ];
  fields.push(...selectionWindowFields(interval));
  if (interval.from) fields.push(...selectionWindowFields(interval.from, '시작점'));
  if (interval.to) fields.push(...selectionWindowFields(interval.to, '종료점'));
  if (interval.from?.definition) fields.push({ label: '시작점 선택 기준', value: interval.from.definition });
  if (interval.to?.definition) fields.push({ label: '종료점 선택 기준', value: interval.to.definition });
  if (asOf) fields.push({ label: '관측 기준일 · UTC', value: asOf });
  return { label: facts.relation.label, date: interval.endDate, kind: scenarioSelected(interval) ? 'assumption' : 'observed', fields,
    note: `양 끝 UTC 날짜의 차이이며 시작일과 종료일을 모두 세는 봉 개수가 아닙니다. 화면을 확대하거나 일부만 표시해도 기간은 변하지 않습니다. 관측 기간은 사후 비교이고, 가정이 포함된 기간은 확정된 일정·확률 예측이 아닙니다.${interval.selectionWindowComplete === false ? ' 한쪽 기준점이 부분 구간 후보이므로 이 기간도 완성된 사이클 기간이 아닙니다.' : ''}` };
}
