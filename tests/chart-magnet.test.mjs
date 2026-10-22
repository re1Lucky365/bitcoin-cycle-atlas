import assert from 'node:assert/strict';
import test from 'node:test';
import { effectiveMagnetMode, resolveMagnetPoint, advanceMeasurement, measurePriceAnchors } from '../dist/chart-magnet.js';
import { createPriceScale } from '../dist/chart-math.js';
import { drawAtlasPriceChart } from '../dist/atlas-price-chart.js';
import { drawIntradayChart } from '../dist/intraday-chart.js';

const candle = { date: '2026-10-20', open: 100, high: 150, low: 80, close: 120, price: 120 };
const close = (a, b) => assert.ok(Math.abs(a - b) < Math.max(1, Math.abs(b)) * 1e-10, `${a} ≈ ${b}`);

test('temporary Ctrl/Command uses strong from off and disables either enabled mode without mutating it', () => {
  for (const modifier of [{ ctrlKey: true }, { metaKey: true }]) {
    assert.equal(effectiveMagnetMode('off', modifier), 'strong');
    assert.equal(effectiveMagnetMode('weak', modifier), 'off');
    assert.equal(effectiveMagnetMode('strong', modifier), 'off');
  }
  assert.equal(effectiveMagnetMode('weak'), 'weak');
  assert.equal(effectiveMagnetMode('bad-value'), 'off');
});

test('weak magnet has a screen-distance threshold while strong resolves OHLC at any distance on either axis', () => {
  for (const scale of ['linear', 'log']) {
    const axis = createPriceScale([80, 150], { scale, top: 40, bottom: 440 });
    const base = { row: candle, y: axis.y, invertY: axis.invert };
    const near = resolveMagnetPoint({ ...base, mode: 'weak', pointerY: axis.y(150) + 11, thresholdPx: 12 });
    assert.equal(near.price, 150); assert.equal(near.field, 'H'); assert.equal(near.snapped, true);
    const farY = axis.y(150) - 40;
    const weak = resolveMagnetPoint({ ...base, mode: 'weak', pointerY: farY, thresholdPx: 12 });
    assert.equal(weak.snapped, false); assert.equal(weak.field, 'free'); close(weak.price, axis.invert(farY));
    const strong = resolveMagnetPoint({ ...base, mode: 'strong', pointerY: farY });
    assert.equal(strong.price, 150); assert.equal(strong.field, 'H');
    const off = resolveMagnetPoint({ ...base, mode: 'off', pointerY: axis.y(137.5) });
    close(off.price, 137.5); assert.equal(off.snapped, false);
    const modified = resolveMagnetPoint({ ...base, mode: 'strong', ctrlKey: true, pointerY: axis.y(137.5) });
    close(modified.price, 137.5); assert.equal(modified.field, 'free');
  }
});

test('a close-only line or future scenario never acquires invented OHLC candidates', () => {
  const row = { date: '2028-01-01', price: 125 }, y = price => 500 - price, invertY = pixel => 500 - pixel;
  const snapped = resolveMagnetPoint({ row, y, invertY, mode: 'strong', pointerY: 320 });
  assert.equal(snapped.price, 125); assert.equal(snapped.field, 'C');
  const keyboard = resolveMagnetPoint({ row, y, invertY, mode: 'off' });
  assert.equal(keyboard.price, 125); assert.equal(keyboard.snapped, false);
  assert.equal(resolveMagnetPoint({ row: {}, y, invertY, mode: 'strong' }), null);
  assert.equal(resolveMagnetPoint({ row: {}, y, invertY, mode: 'off', pointerY: 510 }), null);
});

test('anchor prices and fields survive redraw and same-bar measurement measures the chosen prices', () => {
  const first = advanceMeasurement(null, { date: candle.date, price: candle.high, field: 'H', kind: 'observed' });
  const second = advanceMeasurement(first, { date: candle.date, price: candle.low, field: 'L', kind: 'observed' });
  const result = measurePriceAnchors(second, { lookup: () => ({ ...candle, close: 999, price: 999 }) });
  assert.equal(result.startPrice, 150); assert.equal(result.endPrice, 80);
  assert.equal(result.startField, 'H'); assert.equal(result.endField, 'L');
  assert.equal(result.changePrice, -70); close(result.changePct, (80 / 150 - 1) * 100);
  assert.equal(result.deltaSeconds, 0); assert.equal(result.includesSimulated, false);
  const restarted = advanceMeasurement(second, { date: '2026-10-21', price: 131.2, field: 'free' });
  assert.equal(restarted.endDate, null); assert.equal(restarted.startPrice, 131.2);
});

test('daily and intraday measurement duration uses elapsed UTC time, including reversed and future anchors', () => {
  const rows = [{ date: '2026-10-20T23:59:00.000Z', close: 100 }, { date: '2026-10-21T00:01:00.000Z', close: 103 }];
  const lookup = date => rows.find(row => row.date === date);
  const result = measurePriceAnchors({ startDate: rows[1].date, endDate: rows[0].date }, { lookup });
  assert.equal(result.deltaSeconds, -120); assert.equal(result.changePrice, -3);
  const pending = { startDate: '2026-10-20', startPrice: 100, endDate: null };
  const preview = measurePriceAnchors(pending, { lookup: date => ({ date, price: 120 }), split: '2026-10-21', preview: { date: '2026-10-22', price: 130, field: 'C' } });
  assert.equal(preview.deltaDays, 2); assert.equal(preview.includesSimulated, true); assert.equal(preview.endPrice, 130);
  assert.equal(pending.endDate, null, 'preview cannot commit or mutate an anchor');
});

class SvgNode {
  constructor() { this.attrs = new Map(); this.nodes = new Map(); this.dataset = {}; this.textContent = ''; }
  setAttribute(key, value) { this.attrs.set(key, String(value)); }
  removeAttribute(key) { this.attrs.delete(key); }
  querySelector(selector) { if (!this.nodes.has(selector)) this.nodes.set(selector, new SvgNode()); return this.nodes.get(selector); }
  querySelectorAll(selector) { return selector === 'text' ? [0, 1, 2, 3].map(index => this.querySelector(`text-${index}`)) : []; }
  focus() {}
}
function svgFixture() {
  const svg = new SvgNode();
  Object.assign(svg, { id: 'magnet-price', clientWidth: 1000, clientHeight: 600, innerHTML: '', parentElement: { style: { setProperty() {} } } });
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 600 }); return svg;
}

test('actual daily renderer commits high/low anchors while hover readout retains the actual close', () => {
  const rows = ['2026-10-19', '2026-10-20', '2026-10-21'].map(date => ({ date, price: 120 }));
  const bars = rows.map(row => ({ ...candle, ...row, time: Date.parse(row.date) / 1000, volume: 10 }));
  const svg = svgFixture(); let measurement, readout, inspections = 0;
  drawAtlasPriceChart({ svg, rows, start: rows[0].date, end: rows.at(-1).date, split: rows.at(-1).date, observedCandles: bars, chartType: 'candles', tool: 'measure', magnet: 'strong', showHistoricalEvents: false, showDrawdown: false, onMeasurement: value => { measurement = value; }, onHover: value => { readout = value; }, onInspect: () => inspections++ });
  const x = (Number(svg.dataset.plotLeft) + Number(svg.dataset.plotRight)) / 2;
  const axis = createPriceScale([80, 150], { scale: 'log', top: Number(svg.dataset.plotTop), bottom: Number(svg.dataset.priceBottom) });
  const event = price => ({ pointerType: 'mouse', clientX: x, clientY: axis.y(price), target: { closest: () => null } });
  svg.onpointermove(event(150)); svg.onclick(event(150));
  assert.equal(measurement.startPrice, 150); assert.equal(measurement.startField, 'H');
  assert.equal(readout.price, 120); assert.equal(readout.close, 120);
  svg.onclick(event(80));
  assert.equal(measurement.endPrice, 80); assert.equal(measurement.endField, 'L');
  assert.equal(inspections, 0, 'measurements do not open or replace a detail panel');
  const start = svg.querySelector('.chart-measurement').querySelector('.measurement-start');
  const end = svg.querySelector('.chart-measurement').querySelector('.measurement-end');
  assert.equal(start.attrs.get('data-measure-price'), '150'); assert.equal(end.attrs.get('data-measure-price'), '80');
});


test('actual minute renderer measures OHLC with the same magnet semantics and elapsed minutes', () => {
  const base = Date.parse('2026-10-20T12:00:00Z') / 1000;
  const candles = [0, 1, 2].map(index => ({ ...candle, time: base + index * 60, date: new Date((base + index * 60) * 1000).toISOString(), volume: 2 }));
  const series = { interval: '1m', candles, source: 'Coinbase', product: 'BTC-USD', retrievedAt: '2026-10-20T12:04:00Z', gapCount: 0 };
  const svg = svgFixture(); let measurement, inspected = 0, readout;
  drawIntradayChart({ svg, series, range: { start: base, end: base + 120 }, tool: 'measure', magnet: 'strong', showVolume: false, onMeasurement: value => { measurement = value; }, onInspect: () => inspected++, onHover: value => { readout = value; } });
  const axis = createPriceScale([80, 150], { scale: 'log', top: Number(svg.dataset.plotTop), bottom: Number(svg.dataset.priceBottom), paddingRatio: .12 });
  const left = Number(svg.dataset.plotLeft), right = Number(svg.dataset.plotRight);
  const event = (x, price) => ({ pointerType: 'mouse', clientX: x, clientY: axis.y(price) });
  svg.onclick(event(left, 150)); svg.onclick(event(right, 80));
  assert.equal(measurement.startPrice, 150); assert.equal(measurement.endPrice, 80);
  assert.equal(measurement.startField, 'H'); assert.equal(measurement.endField, 'L');
  assert.equal(readout.close, 120); assert.equal(inspected, 0);
  const result = measurePriceAnchors(measurement, { lookup: date => candles.find(row => row.date === date) });
  assert.equal(result.deltaSeconds, 120); assert.equal(result.changePrice, -70);
  const persisted = JSON.parse(JSON.stringify(measurement));
  drawIntradayChart({ svg, series, range: { start: base - 60, end: base + 180 }, tool: 'measure', magnet: 'off', measurement: persisted, showVolume: false });
  assert.equal(svg.querySelector('.chart-measurement').querySelector('.measurement-start').attrs.get('data-measure-price'), '150');
});


test('indicator turn readout reveals a reversal only after its confirmation date', () => {
  const rows = ['2026-10-19', '2026-10-20', '2026-10-21'].map(date => ({ date, price: 120 }));
  const svg = svgFixture(); let readout;
  const controller = drawAtlasPriceChart({ svg, rows, start: rows[0].date, end: rows.at(-1).date, split: '2026-10-20', showHistoricalEvents: false, showDrawdown: false, turns: [{ date: '2026-10-19', confirmationDate: '2026-10-20', price: 120, type: 'high' }, { date: '2026-10-21', confirmationDate: '2026-10-22', price: 115, type: 'low' }], onHover: value => { readout = value; } });
  controller.selectDate('2026-10-19'); assert.equal(readout.turn, null);
  controller.selectDate('2026-10-20'); assert.equal(readout.turn.type, 'high'); assert.equal(readout.turn.kind, 'observed');
  controller.selectDate('2026-10-21'); assert.equal(readout.turn.type, 'high', 'unconfirmed future turn cannot enter the selected-date readout');
});
