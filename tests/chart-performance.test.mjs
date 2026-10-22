import assert from 'node:assert/strict';
import test from 'node:test';
import { dateWindow, intervalAtDate, pixelExtrema, pixelLineSegments } from '../dist/chart-window.js';
import { chartPaneLayout, cycleTimingMarkup, volumePaneMarkup } from '../dist/chart-overlays.js';
import { drawAtlasPriceChart } from '../dist/atlas-price-chart.js';

const DAY = 86400000, origin = Date.parse('2000-01-01T00:00:00Z');
const at = index => new Date(origin + index * DAY).toISOString().slice(0, 10);
const data = count => Array.from({ length: count }, (_, index) => ({ date: at(index), price: 100 + index % 31, drawdownPct: -(index % 25) }));
function counted(rows) {
  let reads = 0;
  const proxy = new Proxy(rows, { get(target, key, receiver) { if (typeof key === 'string' && /^\d+$/.test(key)) reads++; return Reflect.get(target, key, receiver); } });
  return { rows: proxy, get reads() { return reads; }, reset() { reads = 0; } };
}
class SvgNode {
  constructor() { this.attrs = new Map(); this.nodes = new Map(); this.dataset = {}; this.textContent = ''; }
  setAttribute(key, value) { this.attrs.set(key, String(value)); }
  removeAttribute(key) { this.attrs.delete(key); }
  querySelector(selector) { if (!this.nodes.has(selector)) this.nodes.set(selector, new SvgNode()); return this.nodes.get(selector); }
  querySelectorAll(selector) { return selector === 'text' ? [0, 1, 2, 3].map(index => this.querySelector(`text-${index}`)) : []; }
  focus() {}
}
function svgFixture(width = 1000, height = 600) {
  const svg = new SvgNode();
  Object.assign(svg, { id: 'perf-price', clientWidth: width, clientHeight: height, innerHTML: '', parentElement: { style: { setProperty() {} } } });
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, width, height }); return svg;
}

test('date windows preserve inclusive endpoints and missing dates with logarithmic source reads', () => {
  for (const n of [1024, 16384, 131072]) {
    const source = data(n), counter = counted(source), middle = Math.floor(n / 2);
    const selected = dateWindow(counter.rows, at(middle), at(middle + 8));
    assert.deepEqual(selected, source.slice(middle, middle + 9));
    assert.ok(counter.reads <= 2 * Math.ceil(Math.log2(n)) + 13, `N=${n}, source reads=${counter.reads}`);
    assert.equal(selected[0], source[middle]);
  }
  const rows = [data(1)[0], { date: at(3), price: 120 }];
  assert.deepEqual(dateWindow(rows, at(1), at(2)), []);
  assert.deepEqual(dateWindow(rows, at(3), at(1)), []);
  assert.equal(dateWindow(rows, at(0), at(3)).length, 2);
});

test('interval lookup finds an original complete week without expanding it to seven copied days', () => {
  const weeks = [{ startDate: at(0), endDate: at(6), date: at(6), volume: 123 }, { startDate: at(14), endDate: at(20), date: at(20), volume: 456 }];
  for (let day = 0; day <= 6; day++) assert.equal(intervalAtDate(weeks, at(day)), weeks[0]);
  for (let day = 7; day <= 13; day++) assert.equal(intervalAtDate(weeks, at(day)), null);
  assert.equal(intervalAtDate(weeks, at(21)), null);
});

test('pixel reduction keeps chronological endpoints and every requested extreme in every occupied column', () => {
  const rows = Array.from({ length: 10000 }, (_, index) => ({ index, price: index % 73, lower: -(index % 47), upper: index % 101 }));
  rows[4013].price = 1000000; rows[6621].lower = -1000000; rows[7219].upper = 2000000;
  const keys = ['price', 'lower', 'upper'], x = row => row.index / 100, selected = pixelExtrema(rows, x, keys);
  assert.equal(selected[0], rows[0]); assert.equal(selected.at(-1), rows.at(-1));
  assert.ok(selected.includes(rows[4013]) && selected.includes(rows[6621]) && selected.includes(rows[7219]));
  assert.ok(selected.length <= 100 * (2 + keys.length * 2));
  assert.ok(selected.every((row, index) => !index || selected[index - 1].index < row.index));
  for (let bucket = 0; bucket < 100; bucket++) {
    const original = rows.slice(bucket * 100, bucket * 100 + 100), sampled = selected.filter(row => Math.floor(x(row)) === bucket);
    for (const key of keys) {
      assert.equal(Math.min(...sampled.map(row => row[key])), Math.min(...original.map(row => row[key])));
      assert.equal(Math.max(...sampled.map(row => row[key])), Math.max(...original.map(row => row[key])));
    }
  }
});

test('display reduction never connects across a candle-covered run', () => {
  const rows = [{ price: 1, index: 0 }, { price: 2, index: 1, candle: {} }, { price: 9, index: 2 }, { price: 3, index: 3 }];
  const runs = pixelLineSegments(rows, row => row.index / 10, ['price'], row => Boolean(row.candle));
  assert.deepEqual(runs.map(run => run.map(row => row.index)), [[0], [2, 3]]);
});

test('observed daily and weekly price lines retain calendar gaps before display sampling', () => {
  // All Sundays exist. A missing Tuesday must not disappear when selecting
  // weekly closes, or the chart would imply an uninterrupted observed path.
  const rows = data(28).filter(row => row.date !== at(10));
  for (const frequency of ['daily', 'weekly']) {
    const svg = svgFixture();
    drawAtlasPriceChart({ svg, rows, start: at(0), end: at(27), split: at(27), frequency, showDrawdown: true, showHistoricalEvents: false });
    const closePath = svg.innerHTML.match(/class="observed-close-line" d="([^"]*)"/)[1];
    assert.equal((closePath.match(/M/g) || []).length, 2, `${frequency} closes must break at the missing day`);
    const drawdownPath = svg.innerHTML.match(/<path d="([^"]*)"[^>]*stroke="#a7b8cd"/)[1];
    assert.equal((drawdownPath.match(/M/g) || []).length, 2, `${frequency} drawdowns must preserve the same gap`);
  }
});

test('identical market-state labels on both sides of a gap remain separate observations', () => {
  const rows = data(6).filter(row => row.date !== at(2));
  const states = rows.map(row => ({ date: row.date, state: 'range' }));
  const svg = svgFixture();
  drawAtlasPriceChart({ svg, rows, states, start: at(0), end: at(5), split: at(5), showStates: true, showDrawdown: false, showHistoricalEvents: false });
  const rectangles = [...svg.innerHTML.matchAll(/<rect x="([^"]+)"[^>]*width="([^"]+)"[^>]*fill="#93a1b1"/g)];
  assert.equal(rectangles.length, 2, 'a missing day cannot inherit a market-state label');
  assert.ok(Number(rectangles[0][1]) + Number(rectangles[0][2]) < Number(rectangles[1][1]), 'the missing state has a visible gap');
});

test('isolated observations remain visible as points without connecting missing dates', () => {
  const rows = data(7).filter((_, index) => index % 3 === 0);
  const svg = svgFixture();
  drawAtlasPriceChart({ svg, rows, start: at(0), end: at(6), split: at(6), showDrawdown: true, showHistoricalEvents: false });
  assert.equal((svg.innerHTML.match(/class="observed-close-point"/g) || []).length, 3);
  assert.equal((svg.innerHTML.match(/class="observed-drawdown-point"/g) || []).length, 3);
  const closePath = svg.innerHTML.match(/class="observed-close-line" d="([^"]*)"/)[1];
  assert.equal((closePath.match(/L/g) || []).length, 0);
});

test('small-window chart redraw and ruler preview do not scan the full source series', () => {
  const source = data(65536), counter = counted(source), svg = svgFixture(), start = source[30000].date, end = source[30089].date;
  drawAtlasPriceChart({ svg, rows: counter.rows, start, end, split: end, showDrawdown: false, showHistoricalEvents: false, tool: 'measure', measurement: { startDate: start, endDate: null } });
  assert.ok(counter.reads < 260, `redraw read ${counter.reads} source rows for a 90-day viewport`);
  counter.reset();
  svg.onpointermove({ pointerType: 'mouse', target: { closest: () => null }, clientX: 600, clientY: 150 });
  assert.ok(counter.reads < 80, `ruler preview read ${counter.reads} source rows`);
  const before = counter.reads;
  svg.onpointermove({ pointerType: 'mouse', target: { closest: () => null }, clientX: 600, clientY: 150 });
  assert.equal(counter.reads, before, 'a repeated point does not reformat/recompute the hover');
});

test('dense SVG batching retains every original OHLC/volume shape and exact selected source values', () => {
  const rows = data(4096), bars = rows.map((row, index) => ({ date: row.date, time: (origin + index * DAY) / 1000, open: row.price - 1, close: row.price + .12345678, high: row.price + 4, low: row.price - 5, volume: index % 53 === 0 ? 0 : index + .12345678 }));
  const svg = svgFixture(); let readout;
  const controller = drawAtlasPriceChart({ svg, rows, start: rows[0].date, end: rows.at(-1).date, split: rows.at(-1).date, observedCandles: bars, volumeBars: bars, chartType: 'candles', showVolume: true, showDrawdown: false, showHistoricalEvents: false, onHover: value => { readout = value; } });
  assert.equal(svg.dataset.candleRendering, 'batched'); assert.equal(Number(svg.dataset.observedCandleCount), bars.length);
  assert.match(svg.innerHTML, /data-volume-observed-count="4096"/);
  assert.ok((svg.innerHTML.match(/<[a-z][\w-]*(?=[\s>])/g) || []).length < 100);
  const batchVolumePaths = [...svg.innerHTML.matchAll(/class="volume-bars-batch" d="([^"]*)"/g)].map(match => match[1]).join('');
  assert.equal((batchVolumePaths.match(/Z/g) || []).length, bars.length);
  for (const index of [0, 1, 2077, 4095]) {
    controller.selectDate(bars[index].date);
    assert.equal(readout.date, bars[index].date); assert.equal(readout.close, bars[index].close);
    assert.equal(readout.high, bars[index].high); assert.equal(readout.low, bars[index].low); assert.equal(readout.volume, bars[index].volume);
  }
});

test('volume path reduction retains narrow spikes in both bounds and the central quantity', () => {
  const points = Array.from({ length: 2000 }, (_, index) => ({ index, kind: 'scenario', date: at(index), volume: 100, lower: 25, upper: 400 }));
  points[551] = { ...points[551], volume: 9000, upper: 10000 }; points[1007] = { ...points[1007], lower: 1 };
  const result = volumePaneMarkup({ bars: [], projection: points, x: point => point.index / 20, left: 0, right: 100, top: 0, bottom: 100 });
  assert.equal(result.projectedCount, points.length);
  assert.ok(result.markup.includes(`27.55,${result.y(10000).toFixed(2)}`));
  assert.ok(result.markup.includes(`50.35,${result.y(1).toFixed(2)}`));
});

test('cycle ribbon retains completed causal colors, gaps, and labels without coloring future dates', () => {
  const points = [
    { date: at(0), epochDay: origin / DAY, state: 'shortened', shiftDays: -32, causal: true },
    { date: at(1), epochDay: origin / DAY + 1, state: 'shortened', shiftDays: -31, causal: true },
    { date: at(3), epochDay: origin / DAY + 3, state: 'lengthened', shiftDays: 40, causal: true },
    { date: at(4), epochDay: origin / DAY + 4, state: 'aligned', shiftDays: 2, causal: true },
    { date: at(5), epochDay: origin / DAY + 5, state: 'aligned', shiftDays: 2, causal: true },
    { date: at(6), epochDay: origin / DAY + 6, state: 'shortened', shiftDays: -50, causal: false },
  ];
  const result = cycleTimingMarkup({ points, x: point => (point.epochDay - origin / DAY) * 10, left: 0, right: 100, top: 200, bottom: 212, dayWidth: 10, split: at(4) });
  assert.equal(result.count, 4); assert.equal(result.segments.length, 3);
  assert.match(result.markup, /#df7c83/); assert.match(result.markup, /#65c3a5/); assert.match(result.markup, /#74a7ee/);
  assert.doesNotMatch(result.markup, new RegExp(at(5))); assert.doesNotMatch(result.markup, new RegExp(at(6)));
  assert.match(result.markup, /매매 신호/);
  const rectangles=[...result.markup.matchAll(/<rect x="([^"]+)" y="[^"]+" width="([^"]+)"/g)];
  assert.equal(rectangles.length,result.segments.length);
  for(const [,x,width] of rectangles)assert.ok(Number(x)+Number(width)<=40,'observed ribbon geometry must stop at the split, not one day beyond it');
});

test('future inspection distinguishes the applied clock from an unavailable observation-based correction',()=>{
  const rows=data(4),timing={date:at(1),epochDay:origin/DAY+1,state:'shortened',label:'단축 가정',shiftDays:-52,appliedShiftDays:-52,cycleLengthDays:1409,causal:true};
  for(const application of [
    {applied:true,appliedShiftDays:-52,reason:'causal-daily-clock-applied'},
    {applied:false,appliedShiftDays:0,reason:'near-phase-unavailable'},
    {applied:false,appliedShiftDays:0,reason:'adjustment-would-expire-required-anchor'},
  ]){
    const svg=svgFixture();let inspected;
    const controller=drawAtlasPriceChart({svg,rows,start:at(0),end:at(3),split:at(1),showDrawdown:false,showHistoricalEvents:false,showCycleTiming:true,cycleCalibration:{series:[timing],current:timing,forecastApplication:application},onInspect:detail=>{inspected=detail;}});
    controller.selectDate(at(2));
    const fields=Object.fromEntries(inspected.fields.map(field=>[field.label,field.value]));
    assert.equal(fields['적용한 사이클 보정'],application.applied?'단축 가정':'미적용');
    assert.equal(fields['시계 이동 · 일'],String(application.appliedShiftDays));
    assert.ok(fields['보정 적용 상태']);
    if(!application.applied)assert.ok(!inspected.fields.some(field=>field.value==='-52'));
    controller.selectDate(at(1));
    assert.equal(inspected.fields.find(field=>field.label==='시계 이동 · 일').value,'-52');
  }
});

test('cycle ribbon allocation fits ordered panes at compact overlay-header sizes', () => {
  for (const width of [380, 1280]) for (const height of [220, 600]) for (const volume of [false, true]) for (const states of [false, true]) {
    const layout = chartPaneLayout({ width, height, volume, states, drawdown: true, cycleTiming: true, top: 18 });
    assert.ok(layout.priceBottom > layout.top);
    assert.ok(layout.ddTop >= layout.priceBottom && layout.cycleTop >= layout.ddBottom);
    assert.ok(layout.cycleBottom > layout.cycleTop);
    if (states) assert.ok(layout.stateTop >= layout.cycleBottom);
    if (volume) assert.ok(layout.volumeTop >= (states ? layout.stateBottom : layout.cycleBottom));
    assert.ok(layout.bottom < layout.axisY && layout.axisY < height);
  }
});
