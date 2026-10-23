import assert from 'node:assert/strict';
import test from 'node:test';
import { cycleIntervalsOverlayMarkup } from '../dist/cycle-interval-overlay.js';
import { INTERVAL_RELATIONS } from '../dist/cycle-milestones.js';

const day = date => Date.parse(`${date}T00:00:00Z`) / 86400000;
const dateAt = days => new Date((day('2020-01-01') + days) * 86400000).toISOString().slice(0, 10);
const interval = (id, relation, startDate, endDate, extra = {}) => ({ id, relation, startDate, endDate, fromId: `${id}-from`, toId: `${id}-to`, kind: 'observed', provisional: false, ...extra });
const options = (extra = {}) => {
  const config = { start: '2020-01-01', end: '2025-01-01', left: 12, right: 912, top: 28, bottom: 310, ...extra };
  return { ...config, x: extra.x || (point => config.left + (day(point.date) - day(config.start)) / (day(config.end) - day(config.start)) * (config.right - config.left)) };
};
const attrs = tag => Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
const tags = (markup, className, element = 'line') => [...markup.matchAll(new RegExp(`<${element} class="${className}"[^>]*>`, 'g'))].map(match => attrs(match[0]));
const overlap = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
const groups = markup => [...markup.matchAll(/<g class="cycle-interval-span[^>]*>/g)].map(match => attrs(match[0]));

test('all nine relationships render inside the caller plot without another SVG, panel, date axis, or price-axis allocation', () => {
  const entries = INTERVAL_RELATIONS.map((relation, index) => Object.freeze(interval(`r${index}`, relation.id, '2020-01-01', '2024-01-01')));
  Object.freeze(entries);
  const before = JSON.stringify(entries), config = options({ intervals: entries, clipId: 'main-price-clip' });
  const result = cycleIntervalsOverlayMarkup(config);
  assert.equal(result.visibleCount, 9);
  assert.equal(result.rows.length, 9);
  assert.equal(result.relations, result.rows);
  assert.equal(new Set(result.items.map(item => item.y)).size, 9, 'simultaneously overlapping relations get distinct lanes when space is available');
  assert.equal(result.labelCount, 9);
  assert.equal(result.hiddenLabelCount, 0);
  assert.ok(result.bandTop > config.top + (config.bottom - config.top) / 2, 'all annotations belong to the lower price area');
  assert.equal(result.bandBottom, config.bottom);
  assert.equal(groups(result.markup).length, 9);
  assert.equal(tags(result.markup, 'cycle-interval-line').length, 9);
  assert.match(result.markup, /^<g class="cycle-interval-overlay" clip-path="url\(#main-price-clip\)"/);
  assert.doesNotMatch(result.markup, /<svg|<rect|viewBox=|cycle-interval-date|cycle-interval-row-label/);
  for (const item of result.items) {
    assert.ok(item.y - item.capHeight >= result.bandTop && item.y + item.capHeight <= result.bandBottom);
    assert.ok(item.labelBox.y >= result.bandTop && item.labelBox.y + item.labelBox.height <= result.bandBottom);
    assert.equal(item.x1, config.x({ date: item.interval.startDate }));
    assert.equal(item.x2, config.x({ date: item.interval.endDate }));
    assert.equal(item.relation.color, INTERVAL_RELATIONS.find(relation => relation.id === item.interval.relation).color);
  }
  assert.equal(JSON.stringify(entries), before, 'frozen engine data remains unchanged');
});

test('clipping uses original endpoint projection and full UTC elapsed days, with continuation chevrons at either clipped edge', () => {
  const entries = [
    interval('both', 'bottom-bottom', '2019-12-31', '2021-01-02', { days: 1, weeks: 999 }),
    interval('left', 'bottom-cycle-top', '2020-01-01', '2020-02-15'),
    interval('right', 'bottom-first-top', '2020-02-15', '2020-04-01'),
    interval('edge', 'bottom-ath', '2020-02-01', '2020-03-01'),
  ];
  const seen = [], config = options({ intervals: entries, start: '2020-02-01', end: '2020-03-01', left: 8, right: 254 });
  const project = config.x;
  config.x = point => { seen.push(point.date); return project(point); };
  const result = cycleIntervalsOverlayMarkup(config), both = result.items.find(item => item.interval.id === 'both');
  assert.equal(both.x1, 8);
  assert.equal(both.x2, 254, 'right is an absolute edge, not a margin');
  assert.ok(both.rawX1 < 8 && both.rawX2 > 254);
  assert.equal(both.days, 368);
  assert.equal(both.duration, '52주 4일');
  assert.deepEqual(result.items.map(item => [item.interval.id, item.clippedStart, item.clippedEnd]), [['both', true, true], ['left', true, false], ['right', false, true], ['edge', false, false]]);
  assert.deepEqual(seen, entries.flatMap(entry => [entry.startDate, entry.endDate]), 'the projection receives original dates, not artificial viewport endpoints');
  assert.equal((result.markup.match(/class="cycle-interval-continuation cycle-interval-continuation-start"/g) || []).length, 2);
  assert.equal((result.markup.match(/class="cycle-interval-continuation cycle-interval-continuation-end"/g) || []).length, 2);
  assert.equal((result.markup.match(/class="cycle-interval-cap cycle-interval-start-cap"/g) || []).length, 2);
  assert.equal((result.markup.match(/class="cycle-interval-end-arrow"/g) || []).length, 2);
  assert.match(result.markup, /data-start-date="2019-12-31" data-end-date="2021-01-02" data-days="368"/);
  assert.match(result.markup, /2019-12-31 → 2021-01-02 UTC/);
  assert.match(result.markup, /기간은 전체 양 끝 날짜의 차이/);
  assert.doesNotMatch(result.markup, /999주/);
});

test('disjoint relationships keep their canonical rows instead of changing rows as a viewport clips them', () => {
  const entries = INTERVAL_RELATIONS.map((relation, index) => interval(`r${index}`, relation.id, dateAt(index * 100), dateAt(index * 100 + 75)));
  const result = cycleIntervalsOverlayMarkup(options({ intervals: entries, end: dateAt(900), right: 1812 }));
  assert.equal(result.visibleCount, 9);
  assert.equal(new Set(result.items.map(item => item.y)).size, 9, 'each relationship has a stable row even when its x span is disjoint');
  assert.deepEqual(result.items.map(item => item.relation.id), INTERVAL_RELATIONS.map(relation => relation.id));
  for (let index = 1; index < result.items.length; index++) assert.ok(result.items[index - 1].y > result.items[index].y);
  const zoomed = cycleIntervalsOverlayMarkup(options({ intervals: entries, start: dateAt(400), end: dateAt(600), right: 1812 }));
  for (const item of zoomed.items) assert.equal(item.y, result.items.find(other => other.interval.id === item.interval.id).y);
  const boxes = result.items.filter(item => item.labelBox).map(item => item.labelBox);
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) assert.equal(overlap(boxes[i], boxes[j]), false);
});

test('labels keep full names on one line, then two smaller lines, then duration only, without widening a tiny interval', () => {
  const source = interval('duration', 'bottom-cycle-top', '2020-01-01', '2020-02-01');
  const full = cycleIntervalsOverlayMarkup(options({ intervals: [source], end: '2020-02-01' }));
  assert.equal(full.items[0].labelMode, 'full');
  assert.equal(full.items[0].labelBox.text, 'BOTTOM → CYCLE TOP · 4주 3일');
  const compact = cycleIntervalsOverlayMarkup(options({ intervals: [source], end: '2020-02-01', right: 144, relation: source.relation }));
  assert.equal(compact.items[0].labelMode, 'compact');
  assert.equal(compact.items[0].labelBox.text, 'BOTTOM → CYCLE TOP\n4주 3일');
  assert.match(compact.markup, /class="cycle-interval-relation-label"[^>]*font-size="8">BOTTOM → CYCLE TOP<\/tspan>/);
  assert.match(compact.markup, /font-size="9">4주 3일<\/tspan>/);
  const short = cycleIntervalsOverlayMarkup(options({ intervals: [source], end: '2020-02-01', right: 102, relation: source.relation }));
  assert.equal(short.items[0].labelMode, 'duration');
  assert.equal(short.items[0].labelBox.text, '4주 3일');
  const tiny = cycleIntervalsOverlayMarkup(options({ intervals: [interval('tiny', 'pit-stop-cycle-top', '2024-02-28', '2024-02-29')], start: '2010-01-01', end: '2050-01-01', left: 8, right: 254 }));
  assert.equal(tiny.visibleCount, 1);
  assert.equal(tiny.items[0].labelMode, 'hidden');
  assert.equal(tiny.items[0].labelBox, null);
  assert.ok(tiny.items[0].x2 - tiny.items[0].x1 < .02 && tiny.items[0].x2 > tiny.items[0].x1);
  assert.equal(tiny.hiddenLabelCount, 1);
  assert.equal(tiny.items[0].days, 1);
  assert.match(tiny.markup, /2024-02-28 → 2024-02-29 UTC/);
  assert.match(tiny.markup, /<title>PIT STOP → CYCLE TOP/);
  assert.match(tiny.markup, /class="cycle-interval-preview" visibility="hidden"/);
  assert.doesNotMatch(tiny.markup, /class="cycle-interval-duration cycle-interval-label"/);
});

test('HUD and marker obstacles change horizontal label placement without moving a bottom-anchored span', () => {
  const source = interval('main', 'bottom-bottom', '2020-01-01', '2025-01-01');
  const config = options({ intervals: [source] }), clear = cycleIntervalsOverlayMarkup(config);
  const obstacle = { x: (config.left + config.right) / 2 - 50, y: clear.bandTop, width: 100, height: clear.bandBottom - clear.bandTop };
  const result = cycleIntervalsOverlayMarkup({ ...config, obstacles: [obstacle, { x: 100, y: 35, width: 90, height: 30 }] });
  const item = result.items[0];
  assert.equal(item.y, clear.items[0].y, 'obstacles cannot promote an interval toward the chart header');
  assert.ok(item.labelBox);
  assert.equal(overlap(item.labelBox, obstacle), false);
  assert.equal(item.x1, clear.items[0].x1);
  assert.equal(item.x2, clear.items[0].x2);
  const blocked = cycleIntervalsOverlayMarkup({ ...config, obstacles: [{ x: config.left, y: clear.bandTop, width: config.right - config.left, height: clear.bandBottom - clear.bandTop }] });
  assert.equal(blocked.items[0].y, item.y);assert.equal(blocked.items[0].labelBox, null);
  assert.equal(blocked.visibleCount, 1);assert.match(groups(blocked.markup)[0]['aria-label'], /BOTTOM → BOTTOM/);
});

test('price segments can shift labels horizontally but can never move a duration row upward', () => {
  const config = options({ intervals: [interval('main', 'bottom-bottom', '2020-01-01', '2025-01-01')] });
  const clear = cycleIntervalsOverlayMarkup(config), normalY = clear.items[0].y;
  const center = (config.left + config.right) / 2;
  const result = cycleIntervalsOverlayMarkup({ ...config, pricePoints: [{ x: center - 10, y: normalY - 30 }, { x: center + 10, y: normalY + 30 }] });
  const item = result.items[0];
  assert.equal(item.y, normalY);
  assert.ok(item.labelBox);
  assert.notEqual(item.labelBox.x, clear.items[0].labelBox.x, 'the connecting segment matters even though its vertices are outside the text box');
  assert.equal(item.x1, clear.items[0].x1);
  assert.equal(item.x2, clear.items[0].x2);
});

test('short mobile plots retain every relationship and its detail access while omitting crowded labels', () => {
  const entries = INTERVAL_RELATIONS.map((relation, index) => interval(`r${index}`, relation.id, '2020-01-01', '2024-01-01'));
  const config = options({ intervals: entries, left: 8, right: 254, top: 18, bottom: 126, activeIntervalId: 'r8', activeMarkerId: 'r3-from' });
  const result = cycleIntervalsOverlayMarkup(config), active = result.items.find(item => item.active);
  assert.equal(result.visibleCount, 9);
  assert.equal(groups(result.markup).length, 9);
  assert.ok(result.items.some(item => item.compact), 'fixed rows compress inside the existing bottom band');
  assert.ok(result.hiddenLabelCount > 0, 'small plots omit text instead of using the upper chart');
  for (const item of result.items) {
    assert.ok(item.y - item.capHeight >= result.bandTop && item.y + item.capHeight <= result.bandBottom);
    if (item.labelBox) {
      assert.ok(item.labelBox.y >= result.bandTop && item.labelBox.y + item.labelBox.height <= result.bandBottom);
      for (const other of result.items) if (other !== item) assert.equal(overlap(item.labelBox, { x: other.x1, y: other.y - 2, width: other.x2 - other.x1, height: 4 }), false, 'crowding sacrifices labels before drawing another interval through their text');
    }
  }
  const activeGroup = groups(result.markup).find(group => group['data-cycle-interval'] === 'r8');
  assert.match(activeGroup.class, /is-active/);
  assert.equal(activeGroup['aria-pressed'], 'true');
  assert.match(activeGroup['aria-label'], /PIT STOP → CYCLE TOP.*2020-01-01 → 2024-01-01 UTC/);
  const focused = cycleIntervalsOverlayMarkup({ ...config, relation: active.relation.id });
  assert.equal(focused.visibleCount, 1);assert.ok(focused.items[0].labelBox, 'the existing relation filter exposes crowded text without a new pane');
  assert.match(groups(result.markup).find(group => group['data-cycle-interval'] === 'r3').class, /is-related/);
  assert.equal(groups(result.markup).at(-1)['data-cycle-interval'], 'r8', 'selected interval draws last');
  assert.equal(result.labelCount + result.hiddenLabelCount, 9);
  assert.doesNotMatch(result.markup, /<svg|<rect/);
});

test('observed, provisional, scenario-selected, mixed, and incomplete intervals retain their distinct statuses and dashed convention', () => {
  const entries = [
    interval('observed', 'bottom-bottom', '2020-01-01', '2024-01-01'),
    interval('provisional', 'bottom-cycle-top', '2020-01-01', '2024-01-01', { provisional: true }),
    interval('future', 'bottom-first-top', '2020-01-01', '2024-01-01', { kind: 'scenario' }),
    interval('selected', 'bottom-ath', '2020-01-01', '2024-01-01', { selectionKind: 'scenario' }),
    interval('mixed', 'ath-cycle-top', '2020-01-01', '2024-01-01', { kind: 'mixed' }),
    interval('partial', 'pit-stop-cycle-top', '2020-01-01', '2024-01-01', { selectionWindowComplete: false }),
  ];
  const result = cycleIntervalsOverlayMarkup(options({ intervals: entries }));
  const lineAttributes = tags(result.markup, 'cycle-interval-line');
  assert.equal(lineAttributes[0]['stroke-dasharray'], undefined);
  assert.ok(lineAttributes.slice(1).every(line => line['stroke-dasharray'] === '5 3'));
  for (const status of ['관측 · 사후 기준', '관측 · 잠정 기준', '미래 가정', '관측 가격 · 가정 기준', '관측 + 미래 가정', '부분 구간 후보']) assert.ok(result.markup.includes(status));
});

test('interaction consists of narrow stroke and painted text targets, with full keyboard and hover inspection', () => {
  const result = cycleIntervalsOverlayMarkup(options({ intervals: [interval('inspect', 'bottom-first-top', '2020-02-28', '2020-03-07')], start: '2020-02-28', end: '2020-03-07' }));
  const hit = tags(result.markup, 'cycle-interval-hit')[0], visual = tags(result.markup, 'cycle-interval-line')[0], group = groups(result.markup)[0];
  assert.equal(hit['stroke-width'], '8');
  assert.equal(hit['pointer-events'], 'stroke');
  assert.equal(visual['pointer-events'], 'none');
  assert.equal(group.role, 'button');
  assert.equal(group.tabindex, '0');
  assert.match(group['aria-label'], /2020-02-28 → 2020-03-07 UTC/);
  assert.match(group['aria-label'], /1주 1일 · 8일/);
  assert.match(result.markup, /pointer-events="visiblePainted"/);
  assert.match(result.markup, /class="cycle-interval-preview" visibility="hidden" pointer-events="none" aria-hidden="true"/);
  assert.doesNotMatch(result.markup, /<rect|onclick=|onfocus=/);
});

test('zoom, pan, selection, price traces, and upper HUDs cannot change an existing relationship row', () => {
  const entries = INTERVAL_RELATIONS.map((relation, index) => interval(`stable-${index}`, relation.id, dateAt(index * 30), dateAt(1500 + index * 40)));
  const config = options({ intervals: entries, top: 18, bottom: 650 }), baseline = cycleIntervalsOverlayMarkup(config);
  const reversed = cycleIntervalsOverlayMarkup({ ...config, intervals: [...entries].reverse() });
  assert.equal(reversed.markup, baseline.markup, 'input order does not change geometry, labels or keyboard order');
  const cases = [
    options({ ...config, start: dateAt(600), end: dateAt(900), x: undefined }),
    options({ ...config, start: dateAt(1400), end: dateAt(1800), x: undefined }),
    { ...config, activeIntervalId: 'stable-8', activeMarkerId: 'stable-3-from' },
    { ...config, obstacles: [{ x: config.left, y: config.top, width: config.right - config.left, height: baseline.bandTop - config.top }, { x: 400, y: 620, width: 110, height: 25 }] },
    { ...config, pricePoints: [{ x: config.left, y: 640 }, { x: 330, y: 50 }, { x: 680, y: 635 }, { x: config.right, y: 30 }] },
  ];
  for (const changed of cases) {
    const result = cycleIntervalsOverlayMarkup(changed);
    assert.equal(result.bandTop, baseline.bandTop);assert.equal(result.bandBottom, baseline.bandBottom);
    for (const item of result.items) {
      const original = baseline.items.find(other => other.interval.id === item.interval.id);
      assert.equal(item.y, original.y);assert.equal(item.lane, original.lane);
      for (const box of [item.labelBox, item.previewBox].filter(Boolean)) {
        assert.ok(box.y >= result.bandTop && box.y + box.height <= result.bandBottom);
      }
    }
  }
});

test('same-relation subtracks use all original UTC intervals, including overlaps outside the viewport', () => {
  const entries = [
    interval('earlier', 'bottom-bottom', '2010-01-01', '2014-01-01'),
    interval('earlier-overlap', 'bottom-bottom', '2011-01-01', '2012-01-01'),
    interval('later', 'bottom-bottom', '2020-01-01', '2024-01-01'),
    interval('other-relation', 'bottom-cycle-top', '2020-01-01', '2023-01-01'),
  ];
  const full = cycleIntervalsOverlayMarkup(options({ intervals: entries, start: '2010-01-01' }));
  const zoom = cycleIntervalsOverlayMarkup(options({ intervals: [...entries].reverse() }));
  const byId = new Map(full.items.map(item => [item.interval.id, item]));
  assert.equal(byId.get('earlier').lane, byId.get('later').lane, 'disjoint cycles of one relationship reuse their fixed track');
  assert.notEqual(byId.get('earlier').lane, byId.get('earlier-overlap').lane, 'overlapping original dates keep distinct subtracks');
  assert.deepEqual(zoom.items.map(item => item.interval.id), ['later', 'other-relation']);
  for (const item of zoom.items) assert.equal(item.y, byId.get(item.interval.id).y, 'panning the earlier overlap offscreen cannot compact later rows upward');
});

test('resizing keeps lines, caps, labels and previews inside the bounded bottom of the unchanged price plot', () => {
  const entries = INTERVAL_RELATIONS.map((relation, index) => interval(`resize-${index}`, relation.id, '2020-01-01', '2024-01-01'));
  const baseline = cycleIntervalsOverlayMarkup(options({ intervals: entries }));
  const layouts = [
    { left: 8, right: 254, top: 18, bottom: 126 },
    { left: 12, right: 384, top: 28, bottom: 310 },
    { left: 12, right: 1512, top: 28, bottom: 910 },
    { left: 12, right: 912, top: 128, bottom: 410 },
  ];
  for (const layout of layouts) {
    const config = options({ intervals: entries, ...layout }), result = cycleIntervalsOverlayMarkup(config);
    assert.ok(result.bandTop >= config.top + (config.bottom - config.top) / 2);
    assert.ok(result.bandBottom - result.bandTop <= 200);assert.equal(result.bandBottom, config.bottom);
    assert.equal(config.bottom - result.items[0].y, 7, 'the lowest canonical row stays attached to the price bottom');
    const group = attrs(result.markup.slice(0, result.markup.indexOf('>') + 1));
    assert.ok(Math.abs(Number(group['data-band-top']) - result.bandTop) < 1e-6);assert.equal(Number(group['data-band-bottom']), result.bandBottom);
    for (const item of result.items) {
      assert.ok(item.y - item.capHeight >= result.bandTop && item.y + item.capHeight <= result.bandBottom);
      for (const box of [item.labelBox, item.previewBox].filter(Boolean)) assert.ok(box.y >= result.bandTop && box.y + box.height <= result.bandBottom);
      if(config.bottom === 310)assert.equal(item.y, baseline.items.find(other => other.interval.id === item.interval.id).y, 'horizontal resize cannot change rows');
      if(config.top === 128)assert.equal(item.y, baseline.items.find(other => other.interval.id === item.interval.id).y + 100, 'a translated plot preserves its bottom offsets');
    }
    assert.doesNotMatch(result.markup, /<svg|<rect|viewBox=/);
  }
});

test('filtering, invalid dates, projection failures, and hostile metadata cannot alter source facts or inject SVG', () => {
  const entries = [
    interval('safe" onfocus="bad', 'bottom-ath', '2020-01-01', '2024-01-01', { label: '<script>bad()</script>', color: 'red" onload="bad' }),
    interval('another', 'bottom-bottom', '2020-01-01', '2024-01-01'),
    interval('invalid-date', 'bottom-ath', '2020-02-31', '2024-01-01'),
    interval('reverse', 'bottom-ath', '2024-01-01', '2020-01-01'),
    interval('zero', 'bottom-ath', '2020-01-01', '2020-01-01'),
    interval('outside', 'bottom-ath', '2018-01-01', '2020-01-01'),
    interval('unknown', 'unknown', '2020-01-01', '2024-01-01'),
    null,
  ];
  const result = cycleIntervalsOverlayMarkup(options({ intervals: entries, relation: 'bottom-ath' }));
  assert.equal(result.visibleCount, 1);
  assert.deepEqual(result.rows.map(row => row.id), ['bottom-ath']);
  assert.match(result.markup, /safe&quot; onfocus=&quot;bad/);
  assert.doesNotMatch(result.markup, /<script>| onfocus="bad"| onload="bad"|NaN|Infinity/);
  const all = cycleIntervalsOverlayMarkup(options({ intervals: entries, relation: 'unknown-filter' }));
  assert.equal(all.visibleCount, 2);
  assert.equal(all.rows.length, 9);
  for (const change of [{ x: () => Infinity }, { x: () => { throw Error('unprojectable'); } }, { x: () => 0 }, { end: '2020-01-01' }, { right: 12 }, { top: Infinity }, { bottom: 28 }]) {
    const invalid = cycleIntervalsOverlayMarkup(options({ intervals: entries, ...change }));
    assert.equal(invalid.visibleCount, 0);
    assert.doesNotMatch(invalid.markup, /NaN|Infinity/);
  }
  assert.equal(cycleIntervalsOverlayMarkup().visibleCount, 0);
});
