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
  assert.equal(groups(result.markup).length, 9);
  assert.equal(tags(result.markup, 'cycle-interval-line').length, 9);
  assert.match(result.markup, /^<g class="cycle-interval-overlay" clip-path="url\(#main-price-clip\)"/);
  assert.doesNotMatch(result.markup, /<svg|<rect|viewBox=|cycle-interval-date|cycle-interval-row-label/);
  for (const item of result.items) {
    assert.ok(item.y > config.top && item.y < config.bottom);
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

test('horizontal space packs disjoint spans into a shared lane across relationship types', () => {
  const entries = INTERVAL_RELATIONS.map((relation, index) => interval(`r${index}`, relation.id, dateAt(index * 100), dateAt(index * 100 + 75)));
  const result = cycleIntervalsOverlayMarkup(options({ intervals: entries, end: dateAt(900), right: 1812 }));
  assert.equal(result.visibleCount, 9);
  assert.equal(new Set(result.items.map(item => item.y)).size, 1, 'disjoint relationships do not consume nine full-width rows');
  const boxes = result.items.filter(item => item.labelBox).map(item => item.labelBox);
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) assert.equal(overlap(boxes[i], boxes[j]), false);
});

test('labels keep full names on one line, then two smaller lines, then duration only, without widening a tiny interval', () => {
  const source = interval('duration', 'bottom-cycle-top', '2020-01-01', '2020-02-01');
  const full = cycleIntervalsOverlayMarkup(options({ intervals: [source], end: '2020-02-01' }));
  assert.equal(full.items[0].labelMode, 'full');
  assert.equal(full.items[0].labelBox.text, 'BOTTOM → CYCLE TOP · 4주 3일');
  const compact = cycleIntervalsOverlayMarkup(options({ intervals: [source], end: '2020-02-01', right: 144 }));
  assert.equal(compact.items[0].labelMode, 'compact');
  assert.equal(compact.items[0].labelBox.text, 'BOTTOM → CYCLE TOP\n4주 3일');
  assert.match(compact.markup, /class="cycle-interval-relation-label"[^>]*font-size="8">BOTTOM → CYCLE TOP<\/tspan>/);
  assert.match(compact.markup, /font-size="9">4주 3일<\/tspan>/);
  const short = cycleIntervalsOverlayMarkup(options({ intervals: [source], end: '2020-02-01', right: 102 }));
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

test('existing legend and marker obstacles move both the span and its label into free plot space', () => {
  const source = interval('main', 'bottom-bottom', '2020-01-01', '2025-01-01');
  const config = options({ intervals: [source] }), clear = cycleIntervalsOverlayMarkup(config);
  const obstacle = { x: config.left, y: config.bottom - 38, width: config.right - config.left, height: 38 };
  const result = cycleIntervalsOverlayMarkup({ ...config, obstacles: [obstacle, { x: 100, y: 35, width: 90, height: 30 }] });
  const item = result.items[0];
  assert.ok(item.y < clear.items[0].y);
  assert.equal(overlap({ x: item.x1, y: item.y - 2, width: item.x2 - item.x1, height: 4 }, obstacle), false);
  assert.ok(item.labelBox);
  assert.equal(overlap(item.labelBox, obstacle), false);
  assert.equal(item.x1, clear.items[0].x1);
  assert.equal(item.x2, clear.items[0].x2);
});

test('price-trace collisions use connecting segments even when neither sampled endpoint is near the duration line', () => {
  const config = options({ intervals: [interval('main', 'bottom-bottom', '2020-01-01', '2025-01-01')] });
  const clear = cycleIntervalsOverlayMarkup(config), normalY = clear.items[0].y;
  const result = cycleIntervalsOverlayMarkup({ ...config, pricePoints: [{ x: config.left, y: normalY - 6 }, { x: config.right, y: normalY + 6 }] });
  const item = result.items[0];
  assert.ok(item.y < normalY - 6, 'a lower-cost lane avoids the steep or unsampled crossing');
  assert.ok(item.labelBox);
  assert.ok(item.labelBox.y + item.labelBox.height < normalY - 6);
  assert.equal(item.x1, clear.items[0].x1);
  assert.equal(item.x2, clear.items[0].x2);
});

test('short mobile plots preserve all nine overlapping relationships and prioritize selected and related intervals', () => {
  const entries = INTERVAL_RELATIONS.map((relation, index) => interval(`r${index}`, relation.id, '2020-01-01', '2024-01-01'));
  const config = options({ intervals: entries, left: 8, right: 254, top: 18, bottom: 126, activeIntervalId: 'r8', activeMarkerId: 'r3-from' });
  const result = cycleIntervalsOverlayMarkup(config), active = result.items.find(item => item.active);
  assert.equal(result.visibleCount, 9);
  assert.equal(groups(result.markup).length, 9);
  assert.ok(active.labelBox, 'selected interval gets first access to readable label space');
  assert.ok(result.items.some(item => item.compact), 'thin supplemental slots are used without changing plot height');
  for (const item of result.items) {
    assert.ok(item.y > config.top && item.y < config.bottom);
    if (item.labelBox) {
      assert.ok(item.labelBox.y >= config.top && item.labelBox.y + item.labelBox.height <= config.bottom);
      for (const other of result.items) if (other !== item) assert.equal(overlap(item.labelBox, { x: other.x1, y: other.y - 2, width: other.x2 - other.x1, height: 4 }), false, 'crowding sacrifices labels before drawing another interval through their text');
    }
  }
  const activeGroup = groups(result.markup).find(group => group['data-cycle-interval'] === 'r8');
  assert.match(activeGroup.class, /is-active/);
  assert.equal(activeGroup['aria-pressed'], 'true');
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
