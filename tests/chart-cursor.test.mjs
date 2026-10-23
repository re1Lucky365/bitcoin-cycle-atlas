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
    const cursorPrice = h.axis.invert(Number(h.svg.dataset.plotTop) + 35);
    h.svg.onpointermove(h.event(cursorPrice));
    const event = h.event(cursorPrice, { clientY: (priceBottom + plotBottom) / 2 });
    h.svg.onpointermove(event);
    assert.equal(h.horizontal.attrs.get('visibility'), 'hidden');
    assert.equal(h.tag.attrs.get('visibility'), 'hidden');
    assert.equal(h.dot.attrs.get('visibility'), 'hidden');
    assert.equal(h.readouts.at(-1).price, 120);
    assert.ok(Number.isFinite(Number(h.cross.querySelector('.cross-time').attrs.get('x1'))));
    h.svg.onpointermove(h.event(cursorPrice));
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

function redrawFixture(kind, { queued = false, acceptAutomaticInspection = true } = {}) {
  class RedrawNode extends SvgNode {
    get innerHTML() { return this.markup || ''; }
    set innerHTML(value) { this.markup = value; this.nodes = new Map(); }
  }
  const svg = new RedrawNode(), readouts = [], inspections = [], frames = new Map(); let frameId = 0;
  const rows = Array.from({ length: 11 }, (_, index) => ({ date: `2026-10-${String(10 + index).padStart(2, '0')}`, price: 100 + index }));
  const bars = rows.map((row, index) => ({ ...row, time: baseTime + index * 60, date: new Date((baseTime + index * 60) * 1000).toISOString(), open: row.price - 1, high: row.price + 4, low: row.price - 4, close: row.price, volume: 1 }));
  const view = queued ? { requestAnimationFrame(callback) { const id = ++frameId; frames.set(id, callback); return id; }, cancelAnimationFrame(id) { frames.delete(id); } } : {};
  Object.assign(svg, { id: 'redraw-cursor', ownerDocument: { defaultView: view }, clientWidth: 1000, clientHeight: 600, innerHTML: '', parentElement: { style: { setProperty() {} } }, getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 600 }) });
  let selected = kind === 'daily' ? rows[5].date : bars[5].date, controller;
  const options = {}, series = { interval: '1m', candles: bars, source: 'Coinbase', product: 'BTC-USD', retrievedAt: '2026-10-20T13:00:00Z', gapCount: 0 };
  const draw = (patch = {}) => {
    if ('selection' in patch) selected = patch.selection;
    Object.assign(options, patch);
    const common = { svg, scale: 'log', tool: 'crosshair', showVolume: false, onHover: value => readouts.push(value), onInspect: (value, meta) => { if(acceptAutomaticInspection||meta.user)selected = value.date; inspections.push({ value, meta }); }, ...options };
    controller = kind === 'daily'
      ? drawAtlasPriceChart({ ...common, rows, start: rows[0].date, end: rows.at(-1).date, split: rows[5].date, selectedDate: selected, showDrawdown: false, showHistoricalEvents: false, ...options })
      : drawIntradayChart({ ...common, series, range: { start: bars[0].time, end: bars.at(-1).time }, selectedTime: selected, ...options });
    return controller;
  };
  const cross = () => svg.querySelector('[id$="-cross"]');
  const position = () => ({ x: Number(cross().querySelector('.cross-time').attrs.get('x1')), y: Number(cross().querySelector('.cross-price').attrs.get('y1')) });
  const event = (fraction = .8, y = 180) => ({ pointerType: 'mouse', clientX: Number(svg.dataset.plotLeft) + (Number(svg.dataset.plotRight) - Number(svg.dataset.plotLeft)) * fraction, clientY: y, target: { closest: () => null } });
  const flush = () => { const pending = [...frames.values()]; frames.clear(); for (const callback of pending) callback(); };
  draw(); return { svg, rows, bars, readouts, inspections, frames, draw, event, flush, position, get controller() { return controller; } };
}

for (const kind of ['daily', 'intraday']) {
  test(`${kind} live hover survives repeated layout redraws without bouncing back to the observation or changing the committed selection`, () => {
    const h = redrawFixture(kind), committed = h.controller.getDate(), initial = h.position();
    h.svg.onpointermove(h.event()); const hovered = h.position(), date = h.readouts.at(-1).date;
    assert.notEqual(hovered.x, initial.x);
    const before = h.readouts.length;
    for (let index = 0; index < 6; index++) {
      h.draw(); close(h.position().x, hovered.x); close(h.position().y, hovered.y);
      assert.equal(h.readouts.at(-1).date, date); assert.equal(h.readouts.at(-1).hovered, true);
      assert.equal(h.controller.getDate(), committed, 'a resumed preview never becomes a pinned selection');
      assert.equal(h.inspections.at(-1).value.date, committed);
      assert.equal(h.inspections.at(-1).meta.user, false);
    }
    assert.equal(h.readouts.length, before + 6, 'redraw publishes only the actual hover, without an intermediate selected-point readout');
    assert.ok(h.readouts.slice(before).every(value => value.hovered && value.date === date));
  });

  test(`${kind} an axis or viewport redraw projects the live pointer through the new scales`, () => {
    const h = redrawFixture(kind); h.svg.onpointermove(h.event(.8, 170));
    const selected = h.controller.getDate(), oldPosition = h.position();
    h.draw({ scale: 'linear', unit: 'indexed', priceDomain: { min: 95, max: 125 } });
    close(h.position().x, oldPosition.x); close(h.position().y, 170);
    assert.equal(h.controller.getDate(), selected); assert.equal(h.readouts.at(-1).hovered, true);
    h.draw(kind === 'daily' ? { start: h.rows[2].date, end: h.rows[9].date } : { range: { start: h.bars[2].time, end: h.bars[9].time } });
    const selectedDate = kind === 'daily' ? h.rows[8].date : h.bars[8].date;
    assert.equal(h.readouts.at(-1).date, selectedDate); close(h.position().y, 170);
    assert.equal(h.controller.getDate(), selected);
  });

  test(`${kind} pointer leave, explicit selection, keyboard and changed data or tool cannot revive an old hover`, () => {
    const h = redrawFixture(kind);
    const selectedDate = index => kind === 'daily' ? h.rows[index].date : h.bars[index].date;
    const assertPinned = expected => { h.draw(); assert.equal(h.readouts.at(-1).hovered, false); assert.equal(h.readouts.at(-1).date, expected); };
    h.svg.onpointermove(h.event()); h.svg.onpointerleave(); assertPinned(selectedDate(5));
    h.svg.onpointermove(h.event()); h.svg.onclick(h.event(.2)); assertPinned(selectedDate(2));
    h.svg.onpointermove(h.event()); h.svg.onkeydown({ key: 'Home', target: { closest: () => null }, preventDefault() {} }); assertPinned(selectedDate(0));
    h.svg.onpointermove(h.event()); h.controller.selectDate(selectedDate(3)); assertPinned(selectedDate(3));
    h.svg.onpointermove(h.event()); h.draw({ selection: selectedDate(4) }); assert.equal(h.readouts.at(-1).hovered, false); assert.equal(h.readouts.at(-1).date, selectedDate(4));
    h.svg.onpointermove(h.event()); h.draw({ tool: 'measure' }); assert.equal(h.readouts.at(-1).hovered, false);
    h.draw({ tool: 'crosshair' }); h.svg.onpointermove(h.event());
    h.draw(kind === 'daily' ? { rows: h.rows.map(row => ({ ...row, price: row.price * 2 })) } : { series: { interval: '1m', candles: h.bars.map(row => ({ ...row, close: row.close * 2, high: row.high * 2 })), source: 'Coinbase', product: 'BTC-USD', retrievedAt: '2026-10-20T14:00:00Z' } });
    assert.equal(h.readouts.at(-1).hovered, false, 'a replacement dataset does not inherit a preview from the previous scope');
  });

  test(`${kind} queued pointer callbacks cannot overwrite a later redraw or programmatic selection`, () => {
    const h = redrawFixture(kind, { queued: true }); h.svg.onpointermove(h.event()); h.flush();
    const live = h.position(); h.svg.onpointermove(h.event(.2));
    const old = [...h.frames.values()][0]; assert.ok(old);
    h.draw(); const before = h.readouts.length; old(); h.flush();
    assert.equal(h.readouts.length, before); close(h.position().x, live.x);
    h.svg.onpointermove(h.event(.7)); h.controller.selectDate(kind === 'daily' ? h.rows[1].date : h.bars[1].date); h.flush();
    assert.equal(h.readouts.at(-1).hovered, false); assert.equal(h.readouts.at(-1).date, kind === 'daily' ? h.rows[1].date : h.bars[1].date);
  });

  test(`${kind} a non-price inspection owner can reject automatic selection without losing hover after a clipped redraw`, () => {
    const h = redrawFixture(kind, { acceptAutomaticInspection: false }), selectedDate = index => kind === 'daily' ? h.rows[index].date : h.bars[index].date;
    h.draw({ selection: selectedDate(10), ...(kind === 'daily' ? { start: h.rows[0].date, end: h.rows[4].date } : { range: { start: h.bars[0].time, end: h.bars[4].time } }) });
    h.svg.onpointermove(h.event(.25)); const hovered = h.position();
    for(let index=0;index<3;index++){
      h.draw(); assert.equal(h.readouts.at(-1).hovered, true); assert.equal(h.readouts.at(-1).date, selectedDate(1));
      close(h.position().x, hovered.x); close(h.position().y, 180);
      assert.equal(h.controller.getDate(), selectedDate(4), 'hover remains separate from the visible clamped selected point');
    }
    h.draw({ selection: selectedDate(9) });
    assert.equal(h.readouts.at(-1).hovered, false, 'a different explicit offscreen date invalidates the preview even when it clamps to the same visible endpoint');
  });
}
