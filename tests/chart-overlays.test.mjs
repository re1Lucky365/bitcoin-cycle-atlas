import assert from 'node:assert/strict';
import test from 'node:test';
import { chartPaneLayout, formatBtcVolume, historicalMarkersMarkup, layoutHistoricalMarkers, volumePaneMarkup } from '../dist/chart-overlays.js';
import { drawAtlasPriceChart } from '../dist/atlas-price-chart.js';
import { drawIntradayChart } from '../dist/intraday-chart.js';
import { aggregateWeeklyVolume } from '../dist/volume-data.js';

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

test('volume annotation escapes text and a blank future is described without producing future volume', () => {
  const result = volumePaneMarkup({ bars: [dailyBar(0, 2.12345678)], x: () => 30, left: 10, right: 600, top: 40, bottom: 120, source: 'A & <B>', futureX: 150 });
  assert.equal(result.count, 1); assert.match(result.markup, /A &amp; &lt;B&gt;/);
  assert.match(result.markup, /2\.12345678 BTC/); assert.match(result.markup, /미래 거래량은 추정하지 않습니다/);
  assert.doesNotMatch(result.markup, /A & <B>/);
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

const event = (id, date, importance = 1, label = id) => ({ id, date, importance, label, title: label, category: 'market' });
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
