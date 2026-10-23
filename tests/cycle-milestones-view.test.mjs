import assert from 'node:assert/strict';
import test from 'node:test';
import {
  milestoneMarkersMarkup, cycleIntervalsMarkup, cycleLegendMarkup,
  cycleMilestoneInspection, cycleIntervalInspection,
} from '../dist/cycle-milestones-view.js';

const day = value => Date.parse(`${value}T00:00:00Z`) / 86400000;
const attr = tag => Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
const marker = (id, type, date, price = 100, extra = {}) => ({ id, type, label: type, date, price, kind: 'observed', provisional: false, cycleId: 'cycle-a', definition: '일말 관측에서 사후 선택한 기준', ...extra });
const interval = (id, relation, startDate, endDate, extra = {}) => ({ id, relation, startDate, endDate, fromId: `${id}-from`, toId: `${id}-to`, kind: 'observed', provisional: false, cycleId: 'cycle-a', ...extra });

test('all nine interval relationships remain available when the viewport has no matching endpoints', () => {
  const result = cycleIntervalsMarkup({ intervals: [], start: '2020-01-01', end: '2030-01-01', width: 320, left: 8, right: 66 });
  assert.equal(result.rows.length, 9);
  assert.equal(result.visibleCount, 0);
  assert.equal(new Set(result.rows.map(row => row.id)).size, 9);
  assert.equal((result.markup.match(/data-cycle-relation=/g) || []).length, 9);
  assert.equal((result.markup.match(/현재 범위에 없음/g) || []).length, 9);
  assert.match(result.markup, /BOTTOM → BOTTOM/);
  assert.match(result.markup, /PIT STOP → CYCLE TOP/);
  assert.match(result.markup, /viewBox="0 0 320 /);
});

test('duration clipping keeps actual UTC endpoints and exact elapsed days rather than relabeling the visible fragment', () => {
  const full = interval('long', 'bottom-cycle-top', '2019-12-31', '2021-01-02', { days: 1, weeks: 999 });
  const result = cycleIntervalsMarkup({ intervals: [full], start: '2020-02-01', end: '2020-03-01', width: 320, left: 8, right: 66 });
  const span = result.rows.flatMap(row => row.spans)[0];
  assert.equal(span.x1, 8);
  assert.equal(span.x2, 254);
  assert.equal(span.days, 368);
  assert.equal(span.clippedStart, true);
  assert.equal(span.clippedEnd, true);
  assert.match(result.markup, /data-start-date="2019-12-31"/);
  assert.match(result.markup, /data-end-date="2021-01-02"/);
  assert.match(result.markup, /data-days="368"/);
  assert.match(result.markup, /52주 4일/);
  assert.match(result.markup, /일부만 표시/);
  assert.doesNotMatch(result.markup, /999주/);
});

test('a span too narrow for its full duration never prints a truncated or minimum-width number', () => {
  const result = cycleIntervalsMarkup({ intervals: [interval('one-day', 'pit-stop-cycle-top', '2024-01-01', '2024-01-02')], start: '2010-01-01', end: '2050-01-01', width: 320, left: 8, right: 66 });
  const span = result.rows.flatMap(row => row.spans)[0];
  assert.ok(span.x2 - span.x1 > 0 && span.x2 - span.x1 < 1);
  assert.equal(span.labelBox, null);
  assert.match(result.markup, /1일/);
  assert.match(result.markup, /data-cycle-interval="one-day"/);
  assert.match(result.markup, /role="button" tabindex="0"/);
  assert.doesNotMatch(result.markup, /class="cycle-interval-duration"/);
});

test('overlapping spans in the same relationship receive distinct vertical lanes and retain keyboard access', () => {
  const entries = [
    interval('a', 'bottom-cycle-top', '2020-01-01', '2024-01-01'),
    interval('b', 'bottom-cycle-top', '2021-01-01', '2025-01-01', { kind: 'scenario', provisional: true }),
  ];
  const result = cycleIntervalsMarkup({ intervals: entries, start: '2019-01-01', end: '2026-01-01', width: 800 });
  const spans = result.rows.find(row => row.id === 'bottom-cycle-top').spans;
  assert.equal(spans.length, 2);
  assert.notEqual(spans[0].y, spans[1].y);
  assert.match(result.markup, /data-cycle-interval="b"[^>]*data-kind="scenario"/);
  assert.match(result.markup, /stroke-dasharray="5 3"/);
});

test('dense mobile markers preserve every visible point while labels stay in bounds and do not overlap', () => {
  const types = ['cycle-top', 'pit-stop', 'first-top', 'ath', 'mid-top', 'bottom'];
  const entries = Array.from({ length: 36 }, (_, index) => marker(`m${index}`, types[index % 6], `2024-01-${String(index % 28 + 1).padStart(2, '0')}`, 40 + index % 10));
  const bounds = { left: 8, right: 254, top: 28, bottom: 160 };
  const result = milestoneMarkersMarkup({ markers: entries, start: '2024-01-01', end: '2024-02-01', x: point => 8 + (day(point.date) - day('2024-01-01')) / 31 * 246, y: price => 145 - price, ...bounds, clipId: 'price', activeMarkerId: 'm17' });
  assert.equal(result.count, 36);
  assert.equal((result.markup.match(/data-cycle-marker=/g) || []).length, 36);
  const boxes = result.markers.filter(point => point.box).map(point => point.box);
  for (const box of boxes) {
    assert.ok(box.x >= bounds.left && box.x + box.width <= bounds.right);
    assert.ok(box.y >= bounds.top && box.y + box.height <= bounds.bottom);
  }
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    assert.ok(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y);
  }
  assert.ok(result.markers.find(point => point.marker.id === 'm17').box, 'the active marker has a persistent readable label');
  assert.match(result.markup, /clip-path="url\(#price-cycle-milestones\)"/);
});

test('date and geometry clipping skip offscreen markers rather than moving them onto a plot boundary', () => {
  const entries = [marker('before', 'bottom', '2019-12-31'), marker('above', 'cycle-top', '2020-01-02', 500), marker('inside', 'ath', '2020-01-03', 100), marker('after', 'bottom', '2020-02-01')];
  const result = milestoneMarkersMarkup({ markers: entries, start: '2020-01-01', end: '2020-01-31', x: () => 50, y: price => 200 - price, left: 8, right: 254, top: 20, bottom: 180 });
  assert.deepEqual(result.markers.map(point => point.marker.id), ['inside']);
  assert.match(result.markup, /data-date="2020-01-03"/);
});

test('observed provisional and future markers use dashed circles without converting observed dates into assumptions', () => {
  const entries = [marker('observed', 'bottom', '2024-01-01'), marker('candidate', 'cycle-top', '2024-01-02', 100, { provisional: true }), marker('future', 'first-top', '2024-01-03', 100, { kind: 'scenario', provisional: true })];
  const result = milestoneMarkersMarkup({ markers: entries, start: '2024-01-01', end: '2024-02-01', x: point => 40 + (day(point.date) - day('2024-01-01')) * 80, y: () => 100, left: 8, right: 300, top: 20, bottom: 180 });
  const circles = [...result.markup.matchAll(/<circle class="cycle-marker-circle[^"]*"[^>]*>/g)].map(match => attr(match[0]));
  assert.equal(circles[0]['stroke-dasharray'], undefined);
  assert.equal(circles[1]['stroke-dasharray'], '4 3');
  assert.equal(circles[2]['stroke-dasharray'], '4 3');
  assert.equal(cycleMilestoneInspection(entries[1]).kind, 'observed');
  assert.equal(cycleMilestoneInspection(entries[2]).kind, 'assumption');
});

test('untrusted labels and IDs are escaped while malformed dates, prices and intervals never reach SVG geometry', () => {
  const unsafe = marker('id" onfocus="bad', 'ath', '2024-01-01', 100, { definition: '<script>bad()</script>' });
  const result = milestoneMarkersMarkup({ markers: [unsafe, marker('bad-date', 'bottom', '2024-02-31'), marker('bad-price', 'bottom', '2024-01-02', Infinity)], start: '2024-01-01', end: '2024-02-01', x: () => 80, y: () => 80, left: 8, right: 254, top: 20, bottom: 160 });
  assert.equal(result.count, 1);
  assert.match(result.markup, /id&amp;quot;|id&quot;/);
  assert.doesNotMatch(result.markup, /<script>| onfocus="bad"/);
  const ranges = cycleIntervalsMarkup({ intervals: [interval('reverse', 'bottom-bottom', '2024-02-01', '2024-01-01'), interval('bad', 'bottom-bottom', '2024-02-31', '2024-04-01')], start: '2024-01-01', end: '2025-01-01', width: 320 });
  assert.equal(ranges.visibleCount, 0);
  assert.doesNotMatch(result.markup + ranges.markup, /(?:="|[ ,])(?:NaN|Infinity)/);
});

test('inspection preserves exact endpoint metadata, full duration and the scenario distinction', () => {
  const detail = cycleIntervalInspection(interval('future', 'bottom-cycle-top', '2024-02-28', '2024-03-07', { kind: 'mixed', provisional: true }));
  assert.equal(detail.kind, 'assumption');
  assert.equal(detail.date, '2024-03-07');
  assert.ok(detail.fields.some(field => field.value.includes('2024-02-28')));
  assert.ok(detail.fields.some(field => field.value.includes('2024-03-07')));
  assert.ok(detail.fields.some(field => field.value.includes('1주 1일')));
  assert.ok(detail.fields.some(field => field.value.includes('8일')));
  assert.match(detail.note, /확률|가정/);
});

test('the six-category legend remains explicit and distinct from observation status', () => {
  const markup = cycleLegendMarkup();
  assert.equal((markup.match(/data-milestone-type=/g) || []).length, 6);
  for (const label of ['CYCLE TOP', 'PIT STOP', 'FIRST TOP', 'ATH', 'MID-TOP', 'BOTTOM']) assert.ok(markup.includes(label));
  assert.match(markup, /잠정|가정/);
});

test('a selected relationship filters the duration pane without silently filtering the default overview', () => {
  const options = { intervals: [], start: '2020-01-01', end: '2030-01-01', width: 320 };
  assert.equal(cycleIntervalsMarkup(options).rows.length, 9);
  const selected = cycleIntervalsMarkup({ ...options, relation: 'bottom-ath' });
  assert.deepEqual(selected.rows.map(row => row.id), ['bottom-ath']);
  assert.match(selected.markup, /1개 관계/);
});

test('coincident types retain different colored rings at the true shared date and price', () => {
  const entries = [marker('ath', 'ath', '2027-06-04', 100, { kind: 'scenario' }), marker('mid', 'mid-top', '2027-06-04', 100, { kind: 'scenario' })];
  const result = milestoneMarkersMarkup({ markers: entries, start: '2026-01-01', end: '2030-01-01', x: () => 120, y: () => 100, left: 8, right: 254, top: 20, bottom: 180 });
  assert.equal(result.count, 2);
  assert.equal(result.markers[0].x, result.markers[1].x);
  assert.equal(result.markers[0].y, result.markers[1].y);
  assert.notEqual(result.markers[0].radius, result.markers[1].radius);
  assert.notEqual(result.markers[0].color, result.markers[1].color);
  assert.equal((result.markup.match(/pointer-events="stroke"/g) || []).length, 2);
});

test('four-year duration ticks align with the price chart calendar grid on desktop and mobile', () => {
  const start = '2024-10-22', end = '2028-10-22';
  const ticks = result => [...result.markup.matchAll(/<text class="cycle-interval-date"([^>]*)>([^<]+)<\/text>/g)].map(([, attributes, label]) => ({ ...attr(attributes), label }));
  const expectedX = (date, width, left, right) => left + (day(date) - day(start)) / (day(end) - day(start)) * (width - left - right);
  const desktop = ticks(cycleIntervalsMarkup({ intervals: [], start, end, width: 1000, left: 12, right: 82 }));
  assert.deepEqual(desktop.map(tick => tick.label), ['25.01', '25.07', '26.01', '26.07', '27.01', '27.07', '28.01', '28.07']);
  assert.ok(Math.abs(Number(desktop[0].x) - expectedX('2025-01-01', 1000, 12, 82)) < .001, 'January tick uses its actual UTC date, not a fraction of the viewport');
  assert.ok(Math.abs(Number(desktop[1].x) - expectedX('2025-07-01', 1000, 12, 82)) < .001, 'July tick follows the same six-month calendar grid as price');
  assert.equal(new Set(desktop.map(tick => tick.label)).size, desktop.length, 'month ticks do not repeat coarse year-only labels');
  const mobile = ticks(cycleIntervalsMarkup({ intervals: [], start, end, width: 390, left: 8, right: 66 }));
  assert.deepEqual(mobile.map(tick => tick.label), ['2025', '2026', '2027', '2028']);
  for (const tick of mobile) assert.ok(Math.abs(Number(tick.x) - expectedX(`${tick.label}-01-01`, 390, 8, 66)) < .001, 'mobile annual ticks align on January 1');
});
