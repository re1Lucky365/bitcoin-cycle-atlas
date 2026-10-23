import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { drawAtlasPriceChart } from '../dist/atlas-price-chart.js';
import { buildCycleMilestones, INTERVAL_RELATIONS, MILESTONE_TYPES } from '../dist/cycle-milestones.js';
import { resolveCycleSelection } from '../dist/cycle-selection.js';
import { createChartSvgExport } from '../dist/chart-export.js';
import { utcDay, dateFromDay } from '../dist/cycle-engine.js';

// Minimal SVG tree boundary harness. It checks rendered SVG coordinates,
// activation and export cloning; browser font layout is verified separately.
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const decode = value => value.replace(/&(?:amp|quot|lt|gt|apos|#39);/g, entity => ({ '&amp;': '&', '&quot;': '"', '&lt;': '<', '&gt;': '>', '&apos;': "'", '&#39;': "'" })[entity]);
const attributes = tag => [...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, decode(value)]);
class VectorNode {
  constructor(tag, doc) {
    this.tagName = tag; this.ownerDocument = doc; this.values = new Map(); this.children = []; this.parentElement = null; this.value = '';
    this.data = {};
    this.dataset = new Proxy(this.data, { set: (target, key, value) => {
      target[key] = String(value); this.values.set(`data-${String(key).replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`, String(value)); return true;
    } });
  }
  get attributes() { return [...this.values].map(([name, value]) => ({ name, value })); }
  getAttribute(name) { return this.values.get(name) ?? null; }
  setAttribute(name, value) {
    this.values.set(name, String(value));
    if (name.startsWith('data-')) this.data[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = String(value);
  }
  removeAttribute(name) { this.values.delete(name); }
  get textContent() { return this.value + this.children.map(node => node.textContent).join(''); }
  set textContent(value) { this.value = String(value); this.children = []; }
  get innerHTML() { return this.children.map(serialize).join(''); }
  set innerHTML(value) { this.children = []; parseChildren(String(value), this); }
  append(...nodes) { for (const node of nodes) { node.parentElement = this; this.children.push(node); } }
  remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(node => node !== this); this.parentElement = null; }
  cloneNode(deep) {
    const copy = new VectorNode(this.tagName, this.ownerDocument); copy.value = this.value;
    for (const [name, value] of this.values) copy.setAttribute(name, value);
    if (deep) copy.append(...this.children.map(node => node.cloneNode(true)));
    return copy;
  }
  matches(selector) {
    if (this.tagName === '#text') return false;
    if (selector === '*') return true;
    const tag = selector.match(/^[a-zA-Z][\w-]*/)?.[0], className = selector.match(/\.([\w-]+)/)?.[1], id = selector.match(/^#([\w-]+)/)?.[1];
    if (tag && this.tagName !== tag) return false;
    if (className && !(this.getAttribute('class') || '').split(/\s+/).includes(className)) return false;
    if (id && this.getAttribute('id') !== id) return false;
    const attr = selector.match(/\[([\w-]+)(?:(\$?=)"([^"]*)")?\]/);
    if (attr) {
      const value = this.getAttribute(attr[1]);
      if (value === null || (attr[2] === '$=' ? !value.endsWith(attr[3]) : attr[2] && value !== attr[3])) return false;
    }
    return Boolean(tag || className || id || attr);
  }
  querySelectorAll(selector) {
    const selectors = selector.split(',').map(value => value.trim()), result = [];
    for (const child of this.children) {
      if (selectors.some(value => child.matches(value))) result.push(child);
      result.push(...child.querySelectorAll(selector));
    }
    return result;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  closest(selector) { return selector.split(',').some(value => this.matches(value.trim())) ? this : this.parentElement?.closest?.(selector) ?? null; }
  focus() { this.ownerDocument.activeElement = this; }
}
function serialize(node) {
  if (node.tagName === '#text') return escape(node.value);
  return `<${node.tagName}${node.attributes.map(({ name, value }) => ` ${name}="${escape(value)}"`).join('')}>${escape(node.value)}${node.children.map(serialize).join('')}</${node.tagName}>`;
}
function parseChildren(markup, root) {
  const stack = [root];
  for (const token of markup.match(/<\?[^>]*>|<!--[\s\S]*?-->|<[^>]+>|[^<]+/g) || []) {
    if (token.startsWith('<?') || token.startsWith('<!--')) continue;
    if (token.startsWith('</')) { assert.equal(stack.pop().tagName, token.slice(2, -1).trim()); continue; }
    if (token.startsWith('<')) {
      const tag = token.match(/^<([\w:-]+)/)?.[1]; assert.ok(tag);
      const node = new VectorNode(tag, root.ownerDocument);
      for (const [name, value] of attributes(token)) node.setAttribute(name, value);
      stack.at(-1).append(node); if (!token.endsWith('/>')) stack.push(node);
    } else { const node = new VectorNode('#text', root.ownerDocument); node.value = decode(token); stack.at(-1).append(node); }
  }
  assert.equal(stack.length, 1, 'the generated SVG is balanced');
}
function documentFixture() {
  const doc = { createElementNS: (_namespace, tag) => new VectorNode(tag, doc), defaultView: { XMLSerializer: class { serializeToString(node) { return serialize(node); } } } };
  return doc;
}

const source = JSON.parse(await readFile(new URL('./fixtures/btc-daily-2026-10-20.json', import.meta.url), 'utf8'));
function fixture(multiplier = 1, id = 'bottom-layout-base') {
  const [asOf, price] = source.prices.at(-1), day = utcDay(asOf);
  const path = Array.from({ length: 1001 }, (_, index) => ({ date: dateFromDay(day + index), price: price * Math.exp(index / 650 * multiplier + .3 * Math.sin(index / 37)), kind: index ? 'conditional-long-horizon-path' : 'observed-anchor' }));
  const forecast = { asOf, path, nominalClock: { effectivePeakDate: dateFromDay(day + 720), nextLowDate: dateFromDay(day + 1000), zoneEntryDate: dateFromDay(day + 620) }, scenario: { id } };
  const annotations = buildCycleMilestones(source, { forecast });
  const rows = [...source.prices.map(([date, price]) => ({ date, price })), ...path.slice(1)];
  return { rows, annotations, split: asOf, start: rows[0].date, end: rows.at(-1).date, denominator: price };
}
const baseline = fixture();
const original = JSON.stringify(baseline);
function freeze(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value); for (const child of Object.values(value)) freeze(child, seen); return Object.freeze(value);
}
freeze(baseline);

function render(options = {}, data = baseline) {
  const { width = 1280, height = 720, ...extra } = options, doc = documentFixture(), svg = new VectorNode('svg', doc);
  Object.assign(svg, { id: 'period-bottom-price', clientWidth: width, clientHeight: height, parentElement: { style: { setProperty() {} } }, getBoundingClientRect: () => ({ left: 0, top: 0, width, height }) });
  const controller = drawAtlasPriceChart({ svg, rows: data.rows, start: data.start, end: data.end, split: data.split, denominator: data.denominator,
    showDrawdown: false, showHistoricalEvents: false, showCycleIntervals: true, headerInset: 18,
    cycleMarkers: data.annotations.markers, cycleIntervals: data.annotations.intervals, ...extra });
  return { svg, controller };
}
const number = (node, name) => Number(node.getAttribute(name));
const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < .025, `${message}: ${actual} vs ${expected}`);
const periods = svg => svg.querySelectorAll('[data-cycle-interval]');
const placements = svg => new Map(periods(svg).map(node => [node.dataset.cycleInterval, number(node, 'data-y')]));
function assertBottom(svg) {
  const overlay = svg.querySelector('.cycle-interval-overlay'); assert.ok(overlay, 'periods share the price SVG');
  assert.notEqual(overlay.getAttribute('data-band-top'), null, 'the SVG exposes its actual bottom band');
  const top = number(overlay, 'data-band-top'), bottom = number(overlay, 'data-band-bottom');
  assert.ok(Number.isFinite(top) && Number.isFinite(bottom) && top < bottom);
  assert.ok(top >= Number(svg.dataset.plotTop) && bottom <= Number(svg.dataset.priceBottom) + .025);
  assert.ok(Number(svg.dataset.priceBottom) - bottom <= 12, 'the band remains attached to the bottom of the price plot');
  for (const line of overlay.querySelectorAll('.cycle-interval-line')) {
    near(number(line, 'y1'), number(line, 'y2'), 'duration lines remain horizontal');
    assert.ok(number(line, 'y1') >= top && number(line, 'y1') <= bottom, 'every duration line stays in the bottom band');
  }
  for (const path of overlay.querySelectorAll('path')) for (const match of (path.getAttribute('d') || '').matchAll(/[ML]-?[\d.]+,(-?[\d.]+)|V(-?[\d.]+)/g)) {
    const y = Number(match[1] ?? match[2]); assert.ok(y >= top - .025 && y <= bottom + .025, 'caps and continuation arrows stay in the band');
  }
  for (const text of overlay.querySelectorAll('text')) {
    let y = number(text, 'y'); const spans = text.children.filter(node => node.tagName === 'tspan');
    for (const run of spans.length ? spans : [text]) {
      if (run !== text) y = run.getAttribute('y') !== null ? number(run, 'y') : y + number(run, 'dy');
      const size = Number(run.getAttribute('font-size') ?? text.getAttribute('font-size') ?? 10);
      assert.ok(y - size >= top - .1 && y + 2 <= bottom + .1, `visible labels and focus previews stay in the band: ${run.textContent}`);
    }
  }
  assert.equal(periods(svg).length, Number(svg.dataset.cycleIntervalCount));
  return { top, bottom };
}

test('all 44 observed and scenario periods stay inside the existing price bottom band on desktop and phones', () => {
  assert.equal(baseline.annotations.intervals.length, 44);
  for (const layout of [{ width: 1280, height: 720 }, { width: 390, height: 500 }, { width: 320, height: 260, showVolume: true, showDrawdown: true }]) {
    const { svg } = render(layout), plain = render({ ...layout, showCycleIntervals: false }).svg;
    assertBottom(svg);
    assert.equal(periods(svg).length, 44);
    assert.deepEqual(new Set(periods(svg).map(node => node.dataset.cycleRelation)), new Set(INTERVAL_RELATIONS.map(row => row.id)));
    assert.equal(svg.getAttribute('viewBox'), plain.getAttribute('viewBox'));
    for (const key of ['plotLeft', 'plotRight', 'plotTop', 'plotBottom', 'priceBottom']) assert.equal(svg.dataset[key], plain.dataset[key], key);
    assert.equal(svg.querySelectorAll('svg').length, 0, 'periods never allocate a nested panel or extra height');
    if (layout.showVolume) assert.ok(Number(svg.dataset.priceBottom) < Number(svg.dataset.plotBottom), 'bottom means price bottom, not the volume pane bottom');
  }
  assert.equal(JSON.stringify(baseline), original, 'annotations never mutate source observations or the future path');
});

test('scale, unit, manual range, selected period and the upper D-day/legend HUD cannot move duration rows upward', () => {
  const { svg: plain } = render(), fixed = placements(plain), band = assertBottom(plain);
  const selected = baseline.annotations.intervals.find(row => row.kind === 'scenario');
  const variants = [
    { scale: 'linear' }, { unit: 'indexed' }, { scale: 'linear', unit: 'indexed' },
    { priceDomain: { min: 60000, max: 130000 } },
    { activeCycleInterval: selected, activeCycleMarkerIds: [selected.fromId, selected.toId] },
    { activeCycleMarkerId: selected.fromId },
    { cycleOverlayObstacles: [{ x: 460, y: 16, width: 730, height: 240 }, { x: 10, y: 18, width: 350, height: 120 }] },
  ];
  for (const options of variants) {
    const { svg, controller } = render(options), without = render({ ...options, showCycleIntervals: false });
    assert.deepEqual(assertBottom(svg), band);
    assert.deepEqual(placements(svg), fixed, 'only horizontal positions and labels may respond to viewport content');
    assert.equal(svg.querySelector('.observed-close-line').getAttribute('d'), without.svg.querySelector('.observed-close-line').getAttribute('d'));
    const axis = controller.getPriceScale(), plainAxis = without.controller.getPriceScale();
    assert.deepEqual([axis.min, axis.max, axis.top, axis.bottom], [plainAxis.min, plainAxis.max, plainAxis.top, plainAxis.bottom]);
    const future = chart => chart.querySelectorAll('path').filter(node => node.getAttribute('stroke') === '#f2b960').map(node => node.getAttribute('d'));
    assert.deepEqual(future(svg), future(without.svg), 'displaying periods never alters future price geometry');
  }
});

test('zoom and pan change exact UTC x coordinates and edge continuations while preserving canonical bottom rows', () => {
  const full = render().svg, fixed = placements(full), fullBand = assertBottom(full);
  for (const [start, end] of [['2012-01-01', '2029-07-16'], ['2020-01-01', '2024-06-01'], ['2023-05-01', '2024-02-01'], ['2026-12-01', '2028-04-01']]) {
    const { svg } = render({ start, end, frequency: 'weekly' });
    assert.deepEqual(assertBottom(svg), fullBand);
    const expected = baseline.annotations.intervals.filter(row => row.endDate > start && row.startDate < end);
    assert.deepEqual(new Set(periods(svg).map(node => node.dataset.cycleInterval)), new Set(expected.map(row => row.id)));
    const left = Number(svg.dataset.plotLeft), right = Number(svg.dataset.plotRight), project = date => left + (utcDay(date) - utcDay(start)) / (utcDay(end) - utcDay(start)) * (right - left);
    for (const period of periods(svg)) {
      const interval = expected.find(row => row.id === period.dataset.cycleInterval);
      near(number(period, 'data-y'), fixed.get(interval.id), 'zoom preserves the original relation row');
      near(number(period, 'data-raw-x1'), project(interval.startDate), 'start uses the real UTC date');
      near(number(period, 'data-raw-x2'), project(interval.endDate), 'end uses the real UTC date');
      near(number(period, 'data-x1'), Math.max(left, project(interval.startDate)), 'start clips at the price boundary');
      near(number(period, 'data-x2'), Math.min(right, project(interval.endDate)), 'end clips at the price boundary');
      assert.equal(number(period, 'data-days'), utcDay(interval.endDate) - utcDay(interval.startDate));
      assert.ok(period.getAttribute('aria-label').includes(interval.startDate) && period.getAttribute('aria-label').includes(interval.endDate));
      assert.equal(Boolean(period.querySelector('.cycle-interval-continuation-start')), interval.startDate < start);
      assert.equal(Boolean(period.querySelector('.cycle-interval-continuation-end')), interval.endDate > end);
      assert.equal(Boolean(period.querySelector('.cycle-interval-start-cap')), interval.startDate >= start);
      assert.equal(Boolean(period.querySelector('.cycle-interval-end-arrow')), interval.endDate <= end);
    }
  }
});

test('input ordering, relation filtering and a replacement scenario preserve stable historical rows and current-model selection', () => {
  const full = render().svg, fixed = placements(full), reordered = render({ cycleIntervals: [...baseline.annotations.intervals].reverse() }).svg;
  assert.deepEqual(periods(reordered).map(node => node.dataset.cycleInterval), periods(full).map(node => node.dataset.cycleInterval), 'SVG and keyboard order is canonical, not input order');
  assert.deepEqual(placements(reordered), fixed);
  const relation = 'bottom-cycle-top', filtered = render({ cycleRelation: relation }).svg; assertBottom(filtered);
  for (const period of periods(filtered)) {
    assert.equal(period.dataset.cycleRelation, relation);
    assert.ok(number(period, 'data-y') >= fixed.get(period.dataset.cycleInterval), 'a focused relation can use the lowest available row within the same band');
  }
  const replaced = fixture(1.4, 'bottom-layout-replacement'), selected = baseline.annotations.intervals.find(row => row.kind === 'scenario');
  assert.equal(resolveCycleSelection(replaced.annotations, { kind: 'interval', id: selected.id }), null);
  const next = render({}, replaced).svg; assertBottom(next);
  for (const interval of baseline.annotations.intervals.filter(row => row.kind === 'observed')) near(placements(next).get(interval.id), fixed.get(interval.id), 'new future assumptions keep historical rows fixed');
  assert.equal(periods(next).some(node => node.dataset.cycleInterval === selected.id), false, 'removed scenario periods cannot linger in the chart');
  assert.equal(periods(next).filter(node => node.getAttribute('aria-pressed') === 'true').length, 0);
});

test('bottom period keyboard selection remains separate from the price cursor and measurement tool', () => {
  const interval = baseline.annotations.intervals.find(row => row.relation === 'bottom-cycle-top' && row.kind === 'observed');
  for (const tool of ['crosshair', 'measure']) {
    const selected = [], measured = [], inspected = [], { svg, controller } = render({ tool, onCycleInterval: id => selected.push(id), onMeasurement: value => measured.push(value), onInspect: value => inspected.push(value) });
    const period = periods(svg).find(node => node.dataset.cycleInterval === interval.id), target = period.querySelector('.cycle-interval-line'), date = controller.getDate(), initialInspections = inspected.length;
    for (const key of ['Home', 'End', 'ArrowLeft', 'ArrowRight', 'Enter', ' ']) {
      const event = { key, target, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; } };
      svg.onkeydown(event);
      if (['Enter', ' '].includes(key)) assert.ok(event.prevented && event.stopped);
    }
    assert.deepEqual(selected, [interval.id, interval.id]);
    assert.equal(controller.getDate(), date); assert.equal(inspected.length, initialInspections); assert.deepEqual(measured, []);
    const selection = resolveCycleSelection(baseline.annotations, { kind: 'interval', id: selected.at(-1) });
    const active = render({ tool, activeCycleInterval: selection.interval, activeCycleMarkerIds: selection.markerIds }).svg; assertBottom(active);
    const activePeriod = periods(active).find(node => node.dataset.cycleInterval === interval.id);
    assert.equal(activePeriod.getAttribute('aria-pressed'), 'true'); assert.match(activePeriod.getAttribute('class'), /\bis-active\b/);
    near(number(activePeriod, 'data-y'), number(period, 'data-y'), 'activation never lifts a duration line');
  }
});

test('SVG export preserves the actual bottom layout once, with source dates, nine families and no live previews', () => {
  const { svg } = render({ width: 390, height: 500, start: '2015-01-01', end: '2029-07-16' }), before = serialize(svg);
  const live = periods(svg), vector = createChartSvgExport(svg, { title: 'BTCUSD · 기간 비교 · UTC', legend: MILESTONE_TYPES });
  const document = new VectorNode('document', documentFixture()); document.innerHTML = vector;
  const charts = document.querySelectorAll('svg'); assert.equal(charts.length, 2, 'one export root and one price chart, with no repeated period panel');
  const exported = charts[1]; assertBottom(exported);
  assert.equal(exported.getAttribute('viewBox'), svg.getAttribute('viewBox'));
  assert.deepEqual(periods(exported).map(node => [node.dataset.cycleInterval, node.dataset.cycleRelation, node.dataset.days, node.dataset.x1, node.dataset.x2, node.dataset.y]), live.map(node => [node.dataset.cycleInterval, node.dataset.cycleRelation, node.dataset.days, node.dataset.x1, node.dataset.x2, node.dataset.y]));
  assert.deepEqual(new Set(periods(exported).map(node => node.dataset.cycleRelation)), new Set(INTERVAL_RELATIONS.map(row => row.id)));
  assert.equal(exported.querySelectorAll('.cycle-interval-preview').length, 0);
  assert.equal(exported.querySelectorAll('[tabindex]').length, 0);
  assert.equal(serialize(svg), before, 'export removes temporary interactions only from its clone');
});

test('HUD geometry updates only period labels without rebuilding the price SVG or moving the live crosshair', () => {
  const readouts = [], inspections = [], { svg, controller } = render({ onHover: value => readouts.push(value), onInspect: value => inspections.push(value) });
  const band = assertBottom(svg), positions = placements(svg), initialLabels = Number(svg.dataset.cycleIntervalLabelCount);
  assert.ok(initialLabels > 0, 'the fixture has visible labels to relayout');
  svg.onpointermove({ target: svg, pointerType: 'mouse', clientX: 800, clientY: 220 });
  const cross = svg.querySelector('[id$="-cross"]'), price = svg.querySelector('.observed-close-line'), x = cross.querySelector('.cross-time').getAttribute('x1'), y = cross.querySelector('.cross-price').getAttribute('y1');
  const hovered = readouts.at(-1).date, selection = controller.getDate(), beforeReadouts = readouts.length, beforeInspections = inspections.length;
  const focused = periods(svg)[0]; focused.focus();
  const result = controller.updateCycleOverlayObstacles([{ x: 0, y: band.top, width: 1280, height: band.bottom - band.top }]);
  assert.equal(result.changed, true); assert.equal(result.visibleCount, 44); assert.ok(result.labelCount < initialLabels);
  assert.strictEqual(svg.querySelector('[id$="-cross"]'), cross, 'the existing crosshair DOM is never replaced by HUD updates');
  assert.strictEqual(svg.querySelector('.observed-close-line'), price, 'the original price path is untouched');
  assert.equal(cross.querySelector('.cross-time').getAttribute('x1'), x); assert.equal(cross.querySelector('.cross-price').getAttribute('y1'), y);
  assert.equal(readouts.length, beforeReadouts); assert.equal(inspections.length, beforeInspections);
  assert.equal(readouts.at(-1).date, hovered); assert.equal(controller.getDate(), selection);
  assert.equal(svg.ownerDocument.activeElement.dataset.cycleInterval, focused.dataset.cycleInterval);
  assert.notStrictEqual(svg.ownerDocument.activeElement, focused, 'keyboard focus follows the replacement of its own period label group');
  assert.deepEqual(placements(svg), positions); assertBottom(svg);
  controller.updateCycleOverlayObstacles([]); assert.equal(Number(svg.dataset.cycleIntervalLabelCount), initialLabels);
  assert.equal(controller.updateCycleOverlayObstacles([]).changed, false, 'identical HUD geometry does not replace annotations again');
  drawAtlasPriceChart({ svg, rows: baseline.rows, start: baseline.start, end: baseline.end, split: baseline.split, showDrawdown: false, showCycleIntervals: false });
  const replacement = serialize(svg);
  assert.equal(controller.updateCycleOverlayObstacles([]), null, 'a retired controller cannot relayout a newer drawing');
  assert.equal(serialize(svg), replacement);
});
