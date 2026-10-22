import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { chartPaneLayout, formatBtcVolume, historicalMarkersMarkup, layoutHistoricalMarkers, volumePaneMarkup } from '../dist/chart-overlays.js';
import { drawAtlasPriceChart } from '../dist/atlas-price-chart.js';
import { drawIntradayChart } from '../dist/intraday-chart.js';
import { aggregateWeeklyVolume } from '../dist/volume-data.js';
import { BITCOIN_EVENTS } from '../dist/bitcoin-events.js';

const DAY = 86400;
const monday = Date.parse('2026-10-12T00:00:00Z') / 1000;
const close = (actual, expected, message = '') => assert.ok(Math.abs(actual - expected) < 1e-8, `${message}: ${actual} ≈ ${expected}`);
const attributes = tag => Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
const volumeRects = markup => [...markup.matchAll(/<rect class="volume-bar"[^>]*>/g)].map(match => attributes(match[0]));
const candleGroups = (markup, className) => [...markup.matchAll(new RegExp(`<g class="${className}"[^>]*>[\\s\\S]*?<\\/g>`, 'g'))].map(match => ({
  ...attributes(match[0].slice(0, match[0].indexOf('>') + 1)),
  x: Number(attributes(match[0].match(/<line [^>]*>/)[0]).x1),
}));
const dailyBar = (index, volume = index + 1) => ({
  time: monday + index * DAY, date: new Date((monday + index * DAY) * 1000).toISOString().slice(0, 10),
  open: 100 + index * 100, high: 180 + index * 100, low: 90 + index * 100, close: 150 + index * 100, volume,
});

// A small SVG boundary stub inspects deterministic markup and callbacks, not
// browser layout or native event propagation. Browser validation is separate.
class SvgNode {
  constructor() { this.attrs = new Map(); this.nodes = new Map(); this.dataset = {}; this.textContent = ''; }
  setAttribute(key, value) { this.attrs.set(key, String(value)); }
  removeAttribute(key) { this.attrs.delete(key); }
  getAttribute(key) { return this.attrs.get(key); }
  querySelector(selector) { if (!this.nodes.has(selector)) this.nodes.set(selector, new SvgNode()); return this.nodes.get(selector); }
  querySelectorAll(selector) { return selector === 'text' ? [0, 1, 2, 3].map(index => this.querySelector(`text-${index}`)) : []; }
  focus() {}
}
function svgFixture(width = 900, height = 500) {
  const svg = new SvgNode();
  Object.assign(svg, { id: 'test-price', clientWidth: width, clientHeight: height, innerHTML: '', parentElement: { style: { setProperty() {} } } });
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, width, height });
  return svg;
}

test('BTC volume formatting preserves the base unit and distinguishes missing data from zero', () => {
  assert.equal(formatBtcVolume(0), '0');
  assert.equal(formatBtcVolume(.000123), '0.000123');
  assert.equal(formatBtcVolume(1250), '1.25k');
  assert.equal(formatBtcVolume(2500000), '2.5M');
  for (const value of [-1, NaN, Infinity, undefined]) assert.equal(formatBtcVolume(value), '—');
});

test('volume bars use reported BTC amounts and preserve missing timestamps rather than inserting bars', () => {
  const bars = [dailyBar(0, 25), dailyBar(2, 75), dailyBar(3, 0), dailyBar(4, -1), dailyBar(5, NaN), dailyBar(10, 10)];
  const result = volumePaneMarkup({ bars, x: bar => 20 + (bar.time - monday) / DAY * 20, left: 10, right: 150, top: 200, bottom: 300, barWidth: 6, source: 'Bitstamp' });
  assert.equal(result.count, 3); assert.equal(result.max, 100);
  const rects = volumeRects(result.markup);
  assert.deepEqual(rects.map(rect => rect['data-date']), ['2026-10-12', '2026-10-14', '2026-10-15']);
  assert.deepEqual(rects.map(rect => Number(rect['data-volume'])), [25, 75, 0]);
  assert.deepEqual(rects.map(rect => Number(rect.height)), [25, 75, 0]);
  assert.deepEqual(rects.map(rect => Number(rect.x) + Number(rect.width) / 2), [20, 60, 80]);
  close(result.y(0), 300); close(result.y(100), 200);
  assert.match(result.markup, /거래량 · BTC · Bitstamp/);
  assert.doesNotMatch(result.markup, /2026-10-13/);
});

test('empty volume has an explicit missing-data message, while source-returned zeros remain real rows', () => {
  const options = { x: bar => bar.time, left: 0, right: 100, top: 40, bottom: 120 };
  const empty = volumePaneMarkup({ ...options, bars: [] });
  assert.equal(empty.count, 0); assert.match(empty.markup, /검증된 거래량 자료가 없습니다/);
  const zero = volumePaneMarkup({ ...options, bars: [{ time: 50, date: '2026-10-12', open: 1, close: 1, volume: 0 }] });
  assert.equal(zero.count, 1); assert.equal(volumeRects(zero.markup)[0].height, '0');
  assert.doesNotMatch(zero.markup, /검증된 거래량 자료가 없습니다/);
});

test('volume annotation escapes text and cannot produce projections without a fitted scenario', () => {
  const result = volumePaneMarkup({ bars: [dailyBar(0, 2.12345678)], x: () => 30, left: 10, right: 600, top: 40, bottom: 120, source: 'A & <B>', futureX: 150 });
  assert.equal(result.count, 1); assert.match(result.markup, /A &amp; &lt;B&gt;/);
  assert.match(result.markup, /2\.12345678 BTC/); assert.equal(result.projectedCount, 0);
  assert.doesNotMatch(result.markup, /class="volume-scenario-line"/);
  assert.doesNotMatch(result.markup, /A & <B>/);
});

test('conditional volume uses a separate dashed path and range while preserving actual BTC bars and zero', () => {
  const bars = [dailyBar(0, 10000), dailyBar(1, 0)];
  const projection = [2, 3].map(index => ({...dailyBar(index, 100), kind:'scenario', lower:25, upper:400}));
  const result = volumePaneMarkup({bars,projection,x:row=>20+(row.time-monday)/DAY*80,left:10,right:600,top:200,bottom:300,futureX:110,source:'Bitstamp'});
  assert.equal(result.count, 2); assert.equal(result.projectedCount, 2); assert.equal(result.scale, 'log');
  assert.deepEqual(volumeRects(result.markup).map(rect=>Number(rect['data-volume'])), [10000,0]);
  assert.match(result.markup, /class="volume-scenario-line"[^>]*stroke-dasharray="4 3"/);
  assert.match(result.markup, /volume-scenario-range/); assert.match(result.markup, /확률구간 아님/);
  assert.match(result.markup, /BTC · Bitstamp · 로그/); close(result.y(0),300);
  assert.ok(result.y(10000)<result.y(100)&&result.y(100)<result.y(0));
  const wrongKind = volumePaneMarkup({bars:[],projection:projection.map(point=>({...point,kind:'observed'})),x:row=>row.time,left:monday,right:monday+7*DAY,top:0,bottom:100});
  assert.equal(wrongKind.projectedCount,0);
});

test('enabled chart panes remain ordered within the viewport at desktop and short mobile heights', () => {
  for (const [width, height] of [[1280, 720], [900, 500], [380, 320], [380, 260], [380, 220]]) {
    for (const volume of [false, true]) for (const drawdown of [false, true]) for (const states of [false, true]) {
      const layout = chartPaneLayout({ width, height, volume, drawdown, states, top: height < 320 ? 62 : 70 });
      const label = `${width}×${height} volume=${volume} drawdown=${drawdown} states=${states}`;
      assert.ok(layout.priceBottom > layout.top, `${label}: price has height`);
      const panes = [[layout.top, layout.priceBottom]];
      if (drawdown) panes.push([layout.ddTop, layout.ddBottom]);
      if (states) panes.push([layout.stateTop, layout.stateBottom]);
      if (volume) panes.push([layout.volumeTop, layout.volumeBottom]);
      for (let index = 0; index < panes.length; index++) {
        assert.ok(panes[index][0] <= panes[index][1], `${label}: pane ${index} has nonnegative height`);
        assert.ok(panes[index][1] <= layout.axisY, `${label}: pane ${index} stays above the date axis`);
        if (index) assert.ok(panes[index - 1][1] <= panes[index][0], `${label}: panes ${index - 1} and ${index} overlap`);
      }
      if (drawdown) {
        assert.ok(layout.ddTitleY - layout.ddTitleFontSize >= layout.priceBottom, `${label}: drawdown title stays out of the price pane`);
        assert.ok(layout.ddTitleY < layout.ddTop, `${label}: drawdown title stays above its data`);
      }
      if (volume) {
        const previousBottom = states ? layout.stateBottom : drawdown ? layout.ddBottom : layout.priceBottom;
        assert.ok(layout.volumeSeparatorY >= previousBottom, `${label}: volume separator stays below the preceding data`);
        assert.ok(layout.volumeTitleY - layout.volumeTitleFontSize >= layout.volumeSeparatorY, `${label}: volume title stays below the separator`);
        assert.ok(layout.volumeTitleY < layout.volumeTop, `${label}: volume title stays above its data`);
      }
      assert.ok(layout.axisY < height, `${label}: date axis stays inside viewport`);
    }
  }
});

test('all 128 compact and tall pane combinations keep each enabled title between neighboring data panes', () => {
  for (const width of [320, 844]) for (const height of [220, 300, 500, 800]) for (let flags = 0; flags < 16; flags++) {
    const enabled = { drawdown: Boolean(flags & 1), cycleTiming: Boolean(flags & 2), states: Boolean(flags & 4), volume: Boolean(flags & 8) };
    const layout = chartPaneLayout({ width, height, top: 18, ...enabled });
    const label = `${width}×${height} ${JSON.stringify(enabled)}`;
    assert.ok(layout.priceBottom > layout.top, `${label}: the price pane retains positive height`);
    let previousBottom = layout.priceBottom;
    for (const [id, prefix] of [['drawdown', 'dd'], ['cycleTiming', 'cycle'], ['states', 'state'], ['volume', 'volume']]) {
      if (!enabled[id]) continue;
      const top = layout[`${prefix}Top`], bottom = layout[`${prefix}Bottom`];
      const titleY = layout[`${prefix}TitleY`], fontSize = layout[`${prefix}TitleFontSize`];
      assert.ok(bottom > top && top >= previousBottom && bottom <= layout.bottom, `${label}: ${id} data stay ordered`);
      assert.ok(Number.isFinite(titleY) && fontSize > 0, `${label}: ${id} has an allocated title`);
      assert.ok(titleY - fontSize >= previousBottom - 1e-8, `${label}: ${id} title stays below prior data`);
      assert.ok(titleY + fontSize * .25 <= top + 1e-8, `${label}: ${id} title and descenders stay above its data`);
      if (id === 'volume') assert.ok(layout.volumeSeparatorY >= previousBottom && layout.volumeSeparatorY <= titleY - fontSize, `${label}: volume separator stays outside both data panes`);
      previousBottom = bottom;
    }
    assert.ok(previousBottom < layout.axisY && layout.axisY < height, `${label}: data and titles remain above the date axis`);
  }
});

test('the market-state ribbon exports its own title without changing selected values or creating data', () => {
  const rows = [dailyBar(0), dailyBar(1), dailyBar(2)].map(row => ({ date: row.date, price: row.close, drawdownPct: 0 }));
  const states = [{ date: rows[0].date, state: 'range' }, { date: rows[2].date, state: 'range' }];
  for (const showStates of [false, true]) {
    const svg = svgFixture(320, 220); let selected;
    drawAtlasPriceChart({ svg, rows, states, start: rows[0].date, end: rows[2].date, split: rows[2].date, selectedDate: rows[2].date, headerInset: 18, showStates, showVolume: true, showDrawdown: true, showCycleTiming: true, showHistoricalEvents: false, onHover: value => { selected = value; } });
    const title = svg.innerHTML.match(/<text class="state-pane-title"[^>]*>[\s\S]*?<\/text>/g) || [];
    assert.equal(title.length, showStates ? 1 : 0, 'the title follows actual pane visibility');
    if (showStates) {
      assert.match(title[0], /시장 국면/);
      assert.match(title[0], /가정/);
      assert.match(title[0], /매매 신호가 아닙니다/);
      const rectangles = [...svg.innerHTML.matchAll(/<rect x="([^"]+)"[^>]*width="([^"]+)"[^>]*fill="#93a1b1"/g)];
      assert.equal(rectangles.length, 2, 'a missing state date remains a gap');
      assert.ok(Number(rectangles[0][1]) + Number(rectangles[0][2]) < Number(rectangles[1][1]));
    }
    assert.equal(selected.date, rows[2].date);
    assert.equal(selected.price, rows[2].price);
    assert.equal(selected.marketState, 'range');
  }
});

const event = (id, date, importance = 1, label = id) => ({ id, date, importance, label, title: label, category: 'market' });
const dayNumber = date => Date.parse(`${date}T00:00:00Z`) / 86400000;
const displayedIds = result => result.markers.filter(marker => marker.box).map(marker => marker.event.id);
const insideBox = (box, bounds) => {
  assert.ok(box.x >= bounds.left + 2 && box.x + box.width <= bounds.right - 2, 'label stays inside horizontal inset');
  assert.ok(box.y >= bounds.top + 2 && box.y + box.height <= bounds.bottom - 3, 'label stays inside vertical inset');
};

function researchOverview() {
  const bounds = { left: 12, right: 1199, top: 80, bottom: 560, visibleSpanDays: dayNumber('2050-12-31') - dayNumber('2010-07-18') };
  const prices = new Map(JSON.parse(readFileSync(new URL('../dist/data/btc-daily.json', import.meta.url), 'utf8')).prices);
  // Actual source dates and daily prices, with a fixed logarithmic projection
  // for the reported 2010–2050 geometry regression; this is not a browser test.
  const anchors = BITCOIN_EVENTS.filter(item => item.date >= '2010-07-18' && item.date <= '2050-12-31' && prices.has(item.date)).map(item => ({
    event: item,
    x: bounds.left + (dayNumber(item.date) - dayNumber('2010-07-18')) / bounds.visibleSpanDays * (bounds.right - bounds.left),
    y: bounds.bottom - (Math.log10(prices.get(item.date)) + 2) / 9 * (bounds.bottom - bounds.top),
  }));
  return { bounds, anchors };
}

test('historical labels honor priority and collision limits while retaining lower-priority event dots', () => {
  const anchors = [
    { event: event('low', '2020-01-01', 1), x: 200, y: 140 },
    { event: event('high', '2020-01-02', 3), x: 202, y: 142 },
    { event: event('medium', '2020-01-03', 2), x: 204, y: 144 },
    { event: event('offscreen', '2020-01-04', 5), x: -1, y: 100 },
  ];
  const result = historicalMarkersMarkup(anchors, { left: 10, right: 500, top: 20, bottom: 300, maxLabels: 2 });
  assert.equal(result.totalCount, 3); assert.equal(result.labelCount, 2);
  assert.equal(result.markers.find(marker => marker.event.id === 'low').box, null);
  assert.ok(result.markers.find(marker => marker.event.id === 'high').box);
  const boxes = result.markers.filter(marker => marker.box).map(marker => marker.box);
  const [a, b] = boxes;
  assert.ok(a.x + a.width + 5 <= b.x || b.x + b.width + 5 <= a.x || a.y + a.height + 5 <= b.y || b.y + b.height + 5 <= a.y);
  assert.match(result.markup, /data-history-event="low" role="button" tabindex="0"/);
  assert.equal(result.labelMode, 'legacy');
  assert.equal(result.hiddenLabelCount, 1);
});

test('narrow event labels stay inside both plot boundaries including the declared inset', () => {
  const bounds = { left: 8, right: 92, top: 0, bottom: 200, maxLabels: 1 };
  const markers = layoutHistoricalMarkers([{ event: event('narrow', '2024-01-01', 3, '아주 긴 사건 이름과 추가 설명'), x: 45, y: 100 }], bounds);
  assert.equal(markers.length, 1);
  if (markers[0].box) {
    const box = markers[0].box;
    assert.ok(box.x >= bounds.left + 2);
    assert.ok(box.x + box.width <= bounds.right - 2, 'label must not cover the price-axis gutter');
    assert.ok(markers[0].label.endsWith('…'), 'long visible text must shorten together with its box');
  }
  const escaped = historicalMarkersMarkup([{ event: event('x', '2024-01-01', 1, '<img & bad>'), x: 100, y: 100 }], { left: 0, right: 300, top: 0, bottom: 200 });
  assert.match(escaped.markup, /&lt;img &amp; bad&gt;/);
  assert.doesNotMatch(escaped.markup, /<img & bad>/);
});

test('the research overview keeps only a readable set of names across eras and retains every event dot', () => {
  const { anchors, bounds } = researchOverview(), result = historicalMarkersMarkup(anchors, bounds);
  assert.equal(result.labelMode, 'overview');
  assert.ok(result.labelCount >= 5 && result.labelCount <= 8, `wide research view has ${result.labelCount} names`);
  assert.equal(result.totalCount, anchors.length); assert.equal(result.markers.length, anchors.length);
  assert.equal(result.hiddenLabelCount, result.totalCount - result.labelCount);
  assert.ok(result.labelCount <= result.labelBudget);
  const dates = result.markers.filter(marker => marker.box).map(marker => marker.event.date);
  assert.ok(dates.some(date => date < '2015-01-01'));
  assert.ok(dates.some(date => date >= '2016-01-01' && date < '2023-01-01'));
  assert.ok(dates.some(date => date >= '2024-01-01'), 'early chronology must not consume every label slot');
  assert.equal((result.markup.match(/role="button" tabindex="0"/g) || []).length, anchors.length);
  assert.equal((result.markup.match(/r="4" fill="#111b27"/g) || []).length, anchors.length);
  for (const anchor of anchors) assert.ok(result.markup.includes(`data-history-event="${anchor.event.id}"`));
});

test('zooming the same event set reveals more names, including lower-priority events', () => {
  const bounds = { left: 10, right: 1210, top: 30, bottom: 450 };
  const items = Array.from({ length: 12 }, (_, index) => ({
    event: event(`event-${String(index).padStart(2, '0')}`, new Date(Date.UTC(2024, 0, 11 + index * 8)).toISOString().slice(0, 10), index % 4 === 0 ? 3 : 1, `사건 ${index + 1}`),
    days: 10 + index * 8,
  }));
  const atSpan = visibleSpanDays => historicalMarkersMarkup(items.map(item => ({ event: item.event, x: bounds.left + item.days / visibleSpanDays * 1200, y: 230 })), { ...bounds, visibleSpanDays });
  const overview = atSpan(14610), context = atSpan(1095), detail = atSpan(120);
  assert.equal(overview.labelMode, 'overview'); assert.equal(context.labelMode, 'context'); assert.equal(detail.labelMode, 'detail');
  assert.ok(context.labelCount > overview.labelCount);
  assert.ok(detail.labelCount > context.labelCount);
  assert.ok(detail.markers.some(marker => marker.box && marker.event.importance === 1));
  for (const result of [overview, context, detail]) {
    assert.equal(result.totalCount, items.length);
    assert.equal(result.hiddenLabelCount + result.labelCount, items.length);
  }
});

test('a dense local cluster does not receive extra names from empty plot space', () => {
  const anchors = Array.from({ length: 40 }, (_, index) => ({ event: event(`cluster-${String(index).padStart(2, '0')}`, '2024-01-01', index % 3 + 1), x: 200 + index / 20, y: 200 }));
  const compact = historicalMarkersMarkup(anchors, { left: 0, right: 700, top: 0, bottom: 400, visibleSpanDays: 36500 });
  const emptyFuture = historicalMarkersMarkup(anchors, { left: 0, right: 2000, top: 0, bottom: 400, visibleSpanDays: 36500 });
  assert.equal(emptyFuture.labelBudget, compact.labelBudget);
  assert.equal(emptyFuture.labelCount, compact.labelCount);
  assert.ok(emptyFuture.labelCount <= 2);
  assert.equal(emptyFuture.totalCount, 40); assert.equal(emptyFuture.hiddenLabelCount, 40 - emptyFuture.labelCount);
  assert.equal((emptyFuture.markup.match(/role="button" tabindex="0"/g) || []).length, 40);
});

test('date and id ties resolve deterministically regardless of input order', () => {
  const bounds = { left: 0, right: 900, top: 0, bottom: 450, visibleSpanDays: 900 };
  const anchors = Array.from({ length: 8 }, (_, index) => ({
    event: event(`tie-${index}`, index < 4 ? '2024-01-01' : '2024-02-01', 2, `동일 등급 ${index}`),
    x: index < 4 ? 200 : 600, y: 80 + index % 4 * 90,
  }));
  const first = historicalMarkersMarkup(anchors, bounds), reversed = historicalMarkersMarkup([...anchors].reverse(), bounds);
  const shuffled = historicalMarkersMarkup([anchors[4], anchors[0], anchors[7], anchors[2], anchors[6], anchors[1], anchors[5], anchors[3]], bounds);
  assert.deepEqual(reversed.markers, first.markers); assert.deepEqual(shuffled.markers, first.markers);
  assert.equal(reversed.markup, first.markup); assert.equal(shuffled.markup, first.markup);
});

test('offscreen or invalid anchors do not consume names, spacing, or the active selection slot', () => {
  const { anchors, bounds } = researchOverview(), normal = historicalMarkersMarkup(anchors, bounds);
  const invisible = [
    { event: event('left-out', '2020-01-01', 999), x: bounds.left - 1, y: 200 },
    { event: event('below-out', '2020-01-02', 999), x: 200, y: bounds.bottom + 1 },
    { event: event('invalid', '2020-01-03', 999), x: NaN, y: 200 },
  ];
  const result = historicalMarkersMarkup([...invisible, ...anchors], { ...bounds, activeEventId: 'left-out' });
  assert.equal(result.labelBudget, normal.labelBudget); assert.equal(result.totalCount, normal.totalCount);
  assert.deepEqual(displayedIds(result), displayedIds(normal));
  assert.doesNotMatch(result.markup, /data-history-event="(?:left-out|below-out|invalid)"/);
});

test('the selected event keeps its name inside the same overview budget', () => {
  const { anchors, bounds } = researchOverview(), normal = historicalMarkersMarkup(anchors, bounds);
  const hidden = normal.markers.find(marker => !marker.box && marker.event.importance < 3);
  assert.ok(hidden);
  const selected = historicalMarkersMarkup(anchors, { ...bounds, activeEventId: hidden.event.id });
  const active = selected.markers.find(marker => marker.event.id === hidden.event.id);
  assert.ok(active.box); assert.equal(active.active, true); assert.equal(active.preview, null);
  assert.equal(selected.labelBudget, normal.labelBudget); assert.ok(selected.labelCount <= normal.labelBudget);
  insideBox(active.box, bounds);
  const noNames = historicalMarkersMarkup(anchors, { ...bounds, activeEventId: hidden.event.id, maxLabels: 0 });
  assert.equal(noNames.labelCount, 0); assert.equal(noNames.hiddenLabelCount, anchors.length);
});

test('hidden names have clamped hover/focus previews that do not alter persistent counts or click targets', () => {
  const bounds = { left: 10, right: 170, top: 20, bottom: 140, visibleSpanDays: 30, maxLabels: 0 };
  const anchors = [
    { event: event('preview-left', '2024-01-01', 1, '아주 긴 사건 이름 <추가 & 설명>'), x: 12, y: 22 },
    { event: event('preview-right', '2024-01-02', 1, '오른쪽 사건'), x: 168, y: 138 },
  ];
  const result = historicalMarkersMarkup(anchors, bounds);
  assert.equal(result.labelMode, 'detail'); assert.equal(result.labelCount, 0); assert.equal(result.hiddenLabelCount, 2);
  assert.equal((result.markup.match(/class="history-event-preview" visibility="hidden" pointer-events="none" aria-hidden="true"/g) || []).length, 2);
  assert.equal((result.markup.match(/role="button" tabindex="0"/g) || []).length, 2);
  assert.equal((result.markup.match(/r="10" fill="transparent"/g) || []).length, 2);
  for (const marker of result.markers) { assert.ok(marker.preview); insideBox(marker.preview.box, bounds); }
  assert.match(result.markup, /&lt;추가 &amp; 설명&gt;/);
  assert.doesNotMatch(result.markup, /<추가 & 설명>/);
});

test('zoomed names keep short leaders, avoid every event dot, and survive narrow or short plot geometry', () => {
  const { anchors, bounds } = researchOverview(), overview = historicalMarkersMarkup(anchors, bounds);
  for (const marker of overview.markers.filter(item => item.box)) {
    const box = marker.box; insideBox(box, bounds);
    const edgeX = Math.max(box.x + 7, Math.min(box.x + box.width - 7, marker.x));
    const edgeY = box.y > marker.y ? box.y : box.y + box.height;
    assert.ok(Math.hypot(edgeX - marker.x, edgeY - marker.y) <= 56);
    assert.ok(!anchors.some(point => point.x >= box.x - 8 && point.x <= box.x + box.width + 8 && point.y >= box.y - 8 && point.y <= box.y + box.height + 8));
  }
  for (const geometry of [{ left: 0, right: 94, top: 0, bottom: 100 }, { left: 0, right: 40, top: 0, bottom: 30 }]) {
    const narrowAnchors = [{ event: event('narrow-zoom', '2024-01-01', 3, '아주 긴 좁은 화면 사건'), x: geometry.right / 2, y: geometry.bottom / 2 }];
    const result = historicalMarkersMarkup(narrowAnchors, { ...geometry, visibleSpanDays: 30 });
    assert.equal(result.totalCount, 1); assert.match(result.markup, /data-history-event="narrow-zoom" role="button" tabindex="0"/);
    for (const marker of result.markers) {
      if (marker.box) insideBox(marker.box, geometry);
      if (marker.preview) insideBox(marker.preview.box, geometry);
    }
  }
  const empty = historicalMarkersMarkup([], { ...bounds, visibleSpanDays: 30 });
  assert.equal(empty.labelCount, 0); assert.equal(empty.hiddenLabelCount, 0); assert.equal(empty.labelBudget, 0);
});

test('weekly candle and BTC volume share the Sunday display coordinate and sum actual daily amounts', () => {
  const daily = Array.from({ length: 7 }, (_, index) => dailyBar(index));
  const weekly = aggregateWeeklyVolume(daily, { asOf: '2026-10-18', now: Date.parse('2026-10-22T00:00:00Z') }).bars;
  const svg = svgFixture();
  drawAtlasPriceChart({ svg, rows: daily.map(row => ({ date: row.date, price: row.close })), start: '2026-10-12', end: '2026-10-19', split: '2026-10-18', frequency: 'weekly', chartType: 'candles', observedCandles: weekly, volumeBars: weekly, showVolume: true, showDrawdown: false });
  const candles = candleGroups(svg.innerHTML, 'observed-candle'), volume = volumeRects(svg.innerHTML);
  assert.equal(candles.length, 1); assert.equal(volume.length, 1);
  assert.equal(candles[0]['data-date'], '2026-10-18'); assert.equal(volume[0]['data-date'], '2026-10-18');
  assert.equal(Number(volume[0]['data-time']), monday); assert.equal(Number(volume[0]['data-volume']), 28);
  close(candles[0].x, Number(volume[0].x) + Number(volume[0].width) / 2, 'weekly price and volume center');
  assert.match(svg.innerHTML, /2026-10-12–2026-10-18 UTC · Bitstamp · 28 BTC/);
});

test('daily volume stops at the observed cutoff, and indexed price mode leaves BTC geometry unchanged', () => {
  const bars = Array.from({ length: 4 }, (_, index) => dailyBar(index));
  const render = unit => {
    const svg = svgFixture();
    drawAtlasPriceChart({ svg, rows: bars.map(row => ({ date: row.date, price: row.close })), start: '2026-10-12', end: '2026-10-15', split: '2026-10-13', volumeBars: bars, showVolume: true, showDrawdown: false, unit, denominator: 250 });
    return volumeRects(svg.innerHTML);
  };
  const usd = render('usd'), indexed = render('indexed');
  assert.deepEqual(usd.map(rect => rect['data-date']), ['2026-10-12', '2026-10-13']);
  assert.deepEqual(indexed, usd);
});

test('historical midweek events remain visible when weekly candles remove daily display rows', () => {
  const daily = Array.from({ length: 7 }, (_, index) => dailyBar(index));
  const weekly = aggregateWeeklyVolume(daily, { asOf: '2026-10-18', now: Date.parse('2026-10-22T00:00:00Z') }).bars;
  const svg = svgFixture();
  drawAtlasPriceChart({ svg, rows: daily.map(row => ({ date: row.date, price: row.close })), start: '2026-10-12', end: '2026-10-19', split: '2026-10-18', frequency: 'weekly', chartType: 'candles', observedCandles: weekly, showVolume: false, showDrawdown: false, historicalEvents: [event('wednesday', '2026-10-14', 3)] });
  assert.match(svg.innerHTML, /data-history-event="wednesday"/);
  assert.equal(svg.dataset.historyEventCount, '1');
});

const marketSeries = () => ({
  interval: '1m', source: 'Coinbase Exchange', product: 'BTC-USD', retrievedAt: '2026-10-22T00:00:00Z', gapCount: 1,
  candles: [0, 1, 3].map((offset, index) => ({ time: monday + offset * 60, date: new Date((monday + offset * 60) * 1000).toISOString(), open: 100 + index, high: 103 + index, low: 99 + index, close: 102 + index, volume: index + 1 })),
});
test('intraday candles and volume preserve elapsed-time gaps and agree on each bar coordinate', () => {
  const series = marketSeries(), svg = svgFixture();
  drawIntradayChart({ svg, series, range: { start: monday - 60, end: monday + 240 }, showVolume: true });
  const candles = candleGroups(svg.innerHTML, 'market-candle'), volumes = volumeRects(svg.innerHTML);
  assert.equal(candles.length, 3); assert.equal(volumes.length, 3);
  close(candles[2].x - candles[1].x, 2 * (candles[1].x - candles[0].x), 'a missing minute occupies time');
  candles.forEach((candle, index) => {
    assert.equal(candle['data-time'], volumes[index]['data-time']);
    close(candle.x, Number(volumes[index].x) + Number(volumes[index].width) / 2, 'intraday price and volume center');
  });
  const lineSvg = svgFixture();
  drawIntradayChart({ svg: lineSvg, series, chartType: 'line', range: { start: monday - 60, end: monday + 240 }, showVolume: true });
  const path = lineSvg.innerHTML.match(/class="market-close-line" d="([^"]*)"/)[1];
  assert.equal((path.match(/M/g) || []).length, 2); assert.equal((path.match(/L/g) || []).length, 1);
});

test('an empty intraday window keeps navigation geometry and clears stale point handlers', () => {
  const svg = svgFixture(), series = marketSeries();
  drawIntradayChart({ svg, series });
  const controller = drawIntradayChart({ svg, series, range: { start: monday + 61, end: monday + 179 } });
  assert.equal(controller, null);
  for (const name of ['onclick', 'onpointermove', 'onpointerleave', 'onkeydown']) assert.equal(svg[name], null);
  assert.ok(Number(svg.dataset.plotRight) > Number(svg.dataset.plotLeft));
  assert.match(svg.innerHTML, /완료된 거래 봉이 없습니다/);
});

test('keyboard price selections claim inspection ownership without forcing a panel, while initial renders do not', () => {
  for(const intraday of [false,true]){
    const svg=svgFixture(),calls=[];
    if(intraday)drawIntradayChart({svg,series:marketSeries(),onInspect:(detail,options)=>calls.push({detail,options})});
    else{const bars=Array.from({length:4},(_,index)=>dailyBar(index));drawAtlasPriceChart({svg,rows:bars.map(row=>({date:row.date,price:row.close})),start:bars[0].date,end:bars.at(-1).date,split:bars.at(-1).date,showDrawdown:false,onInspect:(detail,options)=>calls.push({detail,options})});}
    assert.equal(calls.at(-1).options.user,false);
    svg.onkeydown({key:'Home',target:{closest:()=>null},preventDefault(){},stopPropagation(){}});
    assert.equal(calls.at(-1).options.user,true);assert.equal(calls.at(-1).options.openPanel,false);
  }
});

test('context-menu anchors select their own daily or intraday values without moving the pinned selection', () => {
  const bars = Array.from({ length: 4 }, (_, index) => dailyBar(index));
  const svg = svgFixture(); let inspectCalls = 0;
  const daily = drawAtlasPriceChart({ svg, rows: bars.map(row => ({ date: row.date, price: row.close })), start: '2026-10-12', end: '2026-10-15', split: '2026-10-13', showVolume: false, showDrawdown: false, onInspect: () => inspectCalls++ });
  const dailyPinned = daily.getDate(), afterDailyRender = inspectCalls;
  assert.match(daily.getSelection({ anchor: 0 }).label, /2026\.10\.12/);
  assert.match(daily.getSelection({ anchor: 1 }).label, /2026\.10\.15/);
  assert.equal(daily.getDate(), dailyPinned); assert.equal(inspectCalls, afterDailyRender);

  const series = marketSeries(), marketSvg = svgFixture();
  const intraday = drawIntradayChart({ svg: marketSvg, series, range: { start: monday - 60, end: monday + 240 }, onInspect: () => inspectCalls++ });
  const intradayPinned = intraday.getDate(), afterMarketRender = inspectCalls;
  assert.match(intraday.getSelection({ anchor: 0 }).label, /2026-10-12 00:00 UTC/);
  assert.match(intraday.getSelection({ anchor: .5 }).label, /2026-10-12 00:01 UTC/);
  assert.match(intraday.getSelection({ anchor: 1 }).label, /2026-10-12 00:03 UTC/);
  assert.match(intraday.getSelection({ anchor: .5 }).copyText, /거래량 · BTC: 2/);
  assert.equal(intraday.getDate(), intradayPinned); assert.equal(inspectCalls, afterMarketRender);
});

test('an empty daily window clears handlers that reference rows from a preceding render', () => {
  const bars = Array.from({ length: 4 }, (_, index) => dailyBar(index)), svg = svgFixture();
  const options = { svg, rows: bars.map(row => ({ date: row.date, price: row.close })), start: '2026-10-12', end: '2026-10-15', split: '2026-10-15', showVolume: false, showDrawdown: false };
  drawAtlasPriceChart(options);
  assert.equal(typeof svg.onclick, 'function');
  assert.equal(drawAtlasPriceChart({ ...options, start: '2026-09-01', end: '2026-09-30' }), null);
  for (const name of ['onclick', 'onpointermove', 'onpointerleave', 'onkeydown']) assert.equal(svg[name], null);
  assert.match(svg.innerHTML, /아직 자료가 없습니다/);
});
