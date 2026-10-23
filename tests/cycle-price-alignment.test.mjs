import assert from 'node:assert/strict';
import test from 'node:test';
import { drawAtlasPriceChart } from '../dist/atlas-price-chart.js';

class SvgNode {
  constructor() { this.attrs = new Map(); this.nodes = new Map(); this.dataset = {}; this.textContent = ''; }
  setAttribute(name, value) { this.attrs.set(name, String(value)); }
  removeAttribute(name) { this.attrs.delete(name); }
  querySelector(selector) { if (!this.nodes.has(selector)) this.nodes.set(selector, new SvgNode()); return this.nodes.get(selector); }
  querySelectorAll(selector) { return selector === 'text' ? [0, 1, 2, 3].map(index => this.querySelector(`text-${index}`)) : []; }
  focus() {}
}

const at = index => new Date(Date.UTC(2024, 0, 1 + index)).toISOString().slice(0, 10);
const rowsFor = count => Array.from({ length: count }, (_, index) => ({ date: at(index), price: 100, drawdownPct: 0 }));
const milestone = (id, date, price, kind = 'observed') => ({ id, type: 'cycle-top', date, price, kind, provisional: kind === 'scenario' });
const attrs = tag => Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));

function render(rows, options = {}) {
  const width = options.width || 1000, height = 600, svg = new SvgNode();
  Object.assign(svg, { id: 'alignment-price', clientWidth: width, clientHeight: height, innerHTML: '', parentElement: { style: { setProperty() {} } }, getBoundingClientRect: () => ({ left: 0, top: 0, width, height }) });
  const readouts = [];
  const controller = drawAtlasPriceChart({ svg, rows, start: rows[0].date, end: rows.at(-1).date, split: rows.at(-1).date, showDrawdown: false, showHistoricalEvents: false, onHover: value => readouts.push(value), ...options });
  return { svg, controller, readouts };
}

function markerCenter(svg) {
  const ring = svg.innerHTML.match(/<circle class="cycle-marker-circle[^>]*>/);
  assert.ok(ring, 'the in-range milestone must remain visible');
  const point = attrs(ring[0]);
  return { x: Number(point.cx), y: Number(point.cy) };
}

function assertPathContains(svg, path, point) {
  assert.ok(path, 'the source trace must be present');
  const vertices = [...path.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map(([, x, y]) => ({ x: Number(x), y: Number(y) }));
  assert.ok(vertices.some(vertex => Math.abs(vertex.x - point.x) < .015 && Math.abs(vertex.y - point.y) < .015), `the source line must pass through the exact milestone at (${point.x}, ${point.y})`);
  assert.equal(svg.dataset.cycleMarkerCount, '1');
}

test('weekly observed traces retain a midweek milestone at its original daily price and UTC date', () => {
  const rows = rowsFor(15); rows[2].price = 400; // Wednesday, not the Sunday sample.
  const mark = milestone('wednesday-top', rows[2].date, rows[2].price);
  const before = structuredClone(rows);
  const { svg, controller, readouts } = render(rows, { frequency: 'weekly', cycleMarkers: [mark] });
  const path = svg.innerHTML.match(/class="observed-close-line" d="([^"]*)"/)?.[1];
  assertPathContains(svg, path, markerCenter(svg));
  controller.selectDate(mark.date);
  assert.equal(readouts.at(-1).date, mark.date);
  assert.equal(readouts.at(-1).price, 400);
  assert.deepEqual(rows, before, 'retaining a display anchor never changes observations');
});

test('weekly future traces retain exact scenario milestones without moving or synthesizing prices', () => {
  const rows = rowsFor(22); rows[10].price = 400; // Thursday in the future portion.
  const mark = milestone('scenario-thursday-top', rows[10].date, rows[10].price, 'scenario');
  const before = structuredClone(rows);
  const { svg } = render(rows, { split: rows[6].date, frequency: 'weekly', cycleMarkers: [mark] });
  const path = svg.innerHTML.match(/<path d="([^"]*)"[^>]*stroke="#f2b960"/)?.[1];
  assertPathContains(svg, path, markerCenter(svg));
  assert.deepEqual(rows, before);
});

test('pixel reduction preserves a milestone even when it is not the extreme in its display column', () => {
  const rows = rowsFor(3650); rows[2].price = 130; rows[3].price = 500;
  const mark = { ...milestone('inner-pixel-ath', rows[2].date, rows[2].price), type: 'ath' };
  const { svg } = render(rows, { width: 320, frequency: 'weekly', cycleMarkers: [mark] });
  const path = svg.innerHTML.match(/class="observed-close-line" d="([^"]*)"/)?.[1];
  assertPathContains(svg, path, markerCenter(svg));
});

test('the enabled Coin Metrics marker participates in candle scaling without altering venue OHLC', () => {
  const rows = rowsFor(8); rows[2].price = 400;
  const candles = rows.map(row => ({ date: row.date, time: Date.parse(`${row.date}T00:00:00Z`) / 1000, open: 100, high: 101, low: 99, close: 100, volume: 1 }));
  const mark = milestone('separate-source-top', rows[2].date, rows[2].price);
  const originalCandles = structuredClone(candles);
  for (const scale of ['linear', 'log']) {
    const { svg, controller, readouts } = render(rows, { scale, chartType: 'candles', observedCandles: candles, cycleMarkers: [mark] });
    const center = markerCenter(svg);
    assert.ok(center.y >= Number(svg.dataset.plotTop) && center.y <= Number(svg.dataset.priceBottom));
    controller.selectDate(mark.date);
    assert.equal(readouts.at(-1).high, 101);
    assert.equal(readouts.at(-1).close, 100);
    assert.match(svg.innerHTML, /data-high="101"/);
    assert.deepEqual(candles, originalCandles);
  }
});

test('hidden and offscreen milestones do not change price scaling or the unannotated weekly trace', () => {
  const rows = rowsFor(15); rows[2].price = 400;
  const mark = milestone('disabled-top', rows[2].date, 1e12);
  const plain = render(rows, { frequency: 'weekly' }).svg;
  const hidden = render(rows, { frequency: 'weekly', cycleMarkers: [mark], showCycleMarkers: false }).svg;
  const offscreen = render(rows, { frequency: 'weekly', cycleMarkers: [{ ...mark, date: '2023-12-31' }] }).svg;
  const priceTrace = svg => svg.innerHTML.match(/class="observed-close-line" d="([^"]*)"/)?.[1];
  assert.equal(priceTrace(hidden), priceTrace(plain));
  assert.equal(priceTrace(offscreen), priceTrace(plain));
  assert.equal(hidden.dataset.cycleMarkerCount, '0');
  assert.equal(offscreen.dataset.cycleMarkerCount, '0');
});

test('the integrated price renderer forwards persistent milestone selection to the annotation layer', () => {
  const rows = rowsFor(15), mark = milestone('chosen-top', rows[6].date, 100);
  const { svg } = render(rows, { cycleMarkers: [mark], activeCycleMarkerId: mark.id });
  assert.match(svg.innerHTML, /<g class="[^"]*cycle-marker[^"]*is-active[^"]*"[^>]*data-cycle-marker="chosen-top"/);
});

test('a selected period stays geometrically clipped with one or both real endpoints outside the viewport', () => {
  const rows = rowsFor(15); rows.at(-1).price = 200;
  const from = { ...milestone('earlier-bottom', rows[0].date, 100), type: 'bottom' };
  const to = milestone('later-top', rows.at(-1).date, 200);
  const interval = { id: 'selected-period', relation: 'bottom-cycle-top', fromId: from.id, toId: to.id, startDate: from.date, endDate: to.date };
  const originalMarkers = structuredClone([from, to]);
  for (const endIndex of [14, 9]) {
    const { svg } = render(rows, { start: rows[4].date, end: rows[endIndex].date, cycleMarkers: [from, to], activeCycleMarkerIds: [from.id, to.id], activeCycleInterval: interval });
    const band = svg.innerHTML.match(/<rect class="cycle-selected-interval-band"[^>]*>/);
    assert.ok(band, 'real endpoints outside the zoom must not remove the intersecting selected span');
    const rectangle = attrs(band[0]);
    assert.equal(Number(rectangle.x), Number(svg.dataset.plotLeft));
    assert.ok(Math.abs(Number(rectangle.width) - (Number(svg.dataset.plotRight) - Number(svg.dataset.plotLeft))) < .01);
    const guides = [...svg.innerHTML.matchAll(/<line class="cycle-selected-endpoint-guide"[^>]*>/g)].map(match => attrs(match[0]));
    const expectedVisible = endIndex === 14 ? 1 : 0;
    assert.equal(guides.length, expectedVisible);
    assert.equal(Number(svg.dataset.cycleMarkerCount), expectedVisible, 'offscreen endpoints must never become circles on a clipped edge');
    if (expectedVisible) assert.equal(guides[0]['data-date'], to.date);
    assert.deepEqual([from, to], originalMarkers);
  }
});
