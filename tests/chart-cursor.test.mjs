import assert from 'node:assert/strict';
import test from 'node:test';
import { drawAtlasPriceChart } from '../dist/atlas-price-chart.js';
import { drawIntradayChart } from '../dist/intraday-chart.js';
import { createPriceScale } from '../dist/chart-math.js';

class SvgNode {
  constructor() { this.attrs = new Map(); this.nodes = new Map(); this.dataset = {}; this.textContent = ''; }
  setAttribute(name, value) { this.attrs.set(name, String(value)); }
  removeAttribute(name) { this.attrs.delete(name); }
  querySelector(selector) { if (!this.nodes.has(selector)) this.nodes.set(selector, new SvgNode()); return this.nodes.get(selector); }
  querySelectorAll(selector) { return selector === 'text' ? [0, 1, 2, 3].map(index => this.querySelector(`text-${index}`)) : []; }
  focus() {}
}

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} ≈ ${expected}`);
const dates = ['2026-10-19', '2026-10-20', '2026-10-21'];
const dailyRows = dates.map(date => ({ date, price: 120 }));
const baseTime = Date.parse('2026-10-20T12:00:00Z') / 1000;
const candles = [0, 1, 2].map(index => ({ time: baseTime + index * 60, date: new Date((baseTime + index * 60) * 1000).toISOString(), open: 100, high: 150, low: 80, close: 120, volume: index + 1 }));

function chart(kind, { scale = 'log', unit = 'usd', scaled = false, range = null, tool = 'crosshair' } = {}) {
  const svg = new SvgNode(), readouts = [], inspections = [];
  const bounds = scaled ? { left: 25, top: 40, width: 500, height: 300 } : { left: 0, top: 0, width: 1000, height: 600 };
  Object.assign(svg, { id: `${kind}-cursor`, clientWidth: 1000, clientHeight: 600, innerHTML: '', parentElement: { style: { setProperty() {} } }, getBoundingClientRect: () => bounds });
  const common = { svg, scale, unit, tool, onHover: value => readouts.push(value), onInspect: value => inspections.push(value) };
  const controller = kind === 'daily'
    ? drawAtlasPriceChart({ ...common, rows: dailyRows, start: dates[0], end: dates.at(-1), split: dates.at(-1), showVolume: true, showDrawdown: false, showHistoricalEvents: false, denominator: 120 })
    : drawIntradayChart({ ...common, series: { interval: '1m', candles, source: 'Coinbase', product: 'BTC-USD', retrievedAt: '2026-10-20T12:04:00Z', gapCount: 0 }, range: range || { start: baseTime, end: baseTime + 120 }, showVolume: true });
  const top = Number(svg.dataset.plotTop), bottom = Number(svg.dataset.priceBottom);
  const axis = createPriceScale(kind === 'daily' ? [120] : [80, 150], { scale, top, bottom, ...(kind === 'intraday' ? { paddingRatio: .12 } : {}) });
  const x = (Number(svg.dataset.plotLeft) + Number(svg.dataset.plotRight)) / 2;
  const event = (price, extra = {}) => ({ pointerType: 'mouse', clientX: bounds.left + x / 1000 * bounds.width, clientY: bounds.top + axis.y(price) / 600 * bounds.height, target: { closest: () => null }, ...extra });
  const cross = svg.querySelector('[id$="-cross"]');
  return { svg, axis, controller, readouts, inspections, event, bounds, cross, horizontal: cross.querySelector('.cross-price'), dot: cross.querySelector('circle'), tag: cross.querySelector(kind === 'daily' ? '.cross-price-tag' : '.market-price-tag') };
}

for (const kind of ['daily', 'intraday']) {
  test(`${kind} free crosshair follows vertical movement within one bar without inventing OHLC values`, () => {
    for (const scale of ['log', 'linear']) for (const unit of ['usd', 'indexed']) {
      const h = chart(kind, { scale, unit, scaled: true });
      const high = h.axis.invert(Number(h.svg.dataset.plotTop) + 35);
      const low = h.axis.invert(Number(h.svg.dataset.priceBottom) - 35);
      h.svg.onpointermove(h.event(high));
      close(Number(h.horizontal.attrs.get('y1')), h.axis.y(high));
      const firstLabel = h.tag.querySelector('text').textContent, calls = h.readouts.length;
      assert.equal(h.readouts.at(-1).price, 120);
      if (kind === 'intraday') assert.equal(h.readouts.at(-1).close, 120);
      h.svg.onpointermove(h.event(low));
      close(Number(h.horizontal.attrs.get('y1')), h.axis.y(low));
      assert.notEqual(h.tag.querySelector('text').textContent, firstLabel, 'the price label must change inside the same time bar');
      assert.equal(h.readouts.length, calls, 'a cursor-price move does not republish unchanged source OHLC');
      close(Number(h.dot.attrs.get('cy')), h.axis.y(120));
      assert.equal(h.inspections.length, 1, 'hover never commits an inspection');
      const cursorText = h.tag.querySelector('text').textContent;
      if (unit === 'usd') assert.match(cursorText, /^\$/);
      else assert.doesNotMatch(cursorText, /\$/);
    }
  });

  test(`${kind} secondary pane hover keeps the time selection without showing a fake price-axis cursor`, () => {
    const h = chart(kind), priceBottom = Number(h.svg.dataset.priceBottom), plotBottom = Number(h.svg.dataset.plotBottom);
    h.svg.onpointermove(h.event(125));
    const event = h.event(125, { clientY: (priceBottom + plotBottom) / 2 });
    h.svg.onpointermove(event);
    assert.equal(h.horizontal.attrs.get('visibility'), 'hidden');
    assert.equal(h.tag.attrs.get('visibility'), 'hidden');
    assert.equal(h.dot.attrs.get('visibility'), 'hidden');
    assert.equal(h.readouts.at(-1).price, 120);
    assert.ok(Number.isFinite(Number(h.cross.querySelector('.cross-time').attrs.get('x1'))));
    h.svg.onpointermove(h.event(125));
    assert.notEqual(h.horizontal.attrs.get('visibility'), 'hidden');
    assert.notEqual(h.tag.attrs.get('visibility'), 'hidden');
    h.svg.onpointerleave();
    close(Number(h.horizontal.attrs.get('y1')), h.axis.y(120));
    assert.equal(h.readouts.at(-1).hovered, false);
  });

  test(`${kind} touch tap and keyboard selection remain source-data selections after free cursor movement`, () => {
    const h = chart(kind);
    h.svg.onpointermove(h.event(125));
    const beforeTouch = h.readouts.length;
    h.svg.onpointermove(h.event(130, { pointerType: 'touch' }));
    assert.equal(h.readouts.length, beforeTouch, 'touch drags must remain owned by chart navigation');
    h.svg.onclick(h.event(130, { pointerType: 'touch' }));
    close(Number(h.horizontal.attrs.get('y1')), h.axis.y(120));
    assert.equal(h.readouts.at(-1).price, 120);
    h.svg.onkeydown({ key: 'ArrowRight', target: { closest: () => null }, preventDefault() {} });
    assert.equal(h.readouts.at(-1).date, kind === 'daily' ? dates.at(-1) : candles.at(-1).date);
    assert.equal(h.inspections.at(-1).kind, 'observed');
  });
}

test('intraday last completed close has a persistent axis label only when that candle is visible', () => {
  for (const unit of ['usd', 'indexed']) {
    const h = chart('intraday', { unit });
    assert.match(h.svg.innerHTML, /class="market-last-price"/);
    assert.match(h.svg.innerHTML, /마지막 완료 봉/);
    assert.match(h.svg.innerHTML, /2026-10-20 12:02 UTC/);
    assert.match(h.svg.innerHTML, unit === 'usd' ? />\$120<\/text>/ : />100<\/text>/);
    const historical = chart('intraday', { unit, range: { start: baseTime - 60, end: baseTime + 60 } });
    assert.doesNotMatch(historical.svg.innerHTML, /class="market-last-price"/);
  }
});
