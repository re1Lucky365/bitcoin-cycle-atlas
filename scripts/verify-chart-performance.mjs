#!/usr/bin/env node
// Deterministic complexity/DOM gate; elapsed time is deliberately not a pass condition.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { drawAtlasPriceChart } from '../dist/atlas-price-chart.js';
import { dateWindow, pixelExtrema } from '../dist/chart-window.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataset = JSON.parse(readFileSync(resolve(root, 'dist/data/btc-daily.json'), 'utf8'));
const source = JSON.parse(readFileSync(resolve(root, 'dist/data/btc-volume.json'), 'utf8'));
const asOf = dataset.prices.at(-1)[0], rows = dataset.prices.map(([date, price]) => ({ date, price }));
const bars = source.bars.filter(bar => bar.date <= asOf);
assert.ok(rows.length > 256 && bars.length > 256, 'Real snapshot must exercise the dense renderer.');
class SvgNode {
  constructor() { this.attrs = new Map(); this.nodes = new Map(); this.dataset = {}; this.textContent = ''; }
  setAttribute(key, value) { this.attrs.set(key, String(value)); }
  removeAttribute(key) { this.attrs.delete(key); }
  querySelector(selector) { if (!this.nodes.has(selector)) this.nodes.set(selector, new SvgNode()); return this.nodes.get(selector); }
  querySelectorAll(selector) { return selector === 'text' ? [0, 1, 2, 3].map(index => this.querySelector(`text-${index}`)) : []; }
  focus() {}
}
const svg = new SvgNode();
Object.assign(svg, { id: 'performance-gate', clientWidth: 1280, clientHeight: 720, innerHTML: '', parentElement: { style: { setProperty() {} } } });
svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1280, height: 720 });
let selected;
const controller = drawAtlasPriceChart({ svg, rows, start: rows[0].date, end: asOf, split: asOf, observedCandles: bars, volumeBars: bars, chartType: 'candles', showVolume: true, showHistoricalEvents: false, showDrawdown: false, onHover: value => { selected = value; } });
const svgElements = (svg.innerHTML.match(/<[a-z][\w-]*(?=[\s>])/g) || []).length;
assert.ok(svgElements < 120, `Dense snapshot created ${svgElements} DOM elements (budget < 120).`);
assert.equal(svg.dataset.candleRendering, 'batched');
assert.equal(Number(svg.dataset.observedCandleCount), bars.length);
const volumeShapes = [...svg.innerHTML.matchAll(/class="volume-bars-batch" d="([^"]*)"/g)].reduce((count, match) => count + (match[1].match(/Z/g) || []).length, 0);
assert.equal(volumeShapes, bars.length, 'Every observed volume rectangle survives batching.');
const selectionIndices = [0, Math.floor(bars.length / 2), bars.length - 1];
for (const index of selectionIndices) {
  const expected = bars[index]; controller.selectDate(expected.date);
  assert.equal(selected.date, expected.date); assert.equal(selected.open, expected.open); assert.equal(selected.high, expected.high);
  assert.equal(selected.low, expected.low); assert.equal(selected.close, expected.close); assert.equal(selected.volume, expected.volume);
}
const complexity = [];
for (const count of [1024, 16384, 131072]) {
  // Synthetic dates are a geometry/search fixture, never a market-data forecast.
  const list = Array.from({ length: count }, (_, index) => ({ date: String(index).padStart(9, '0'), price: index % 97, index }));
  let sourceReads = 0;
  const proxy = new Proxy(list, { get(target, key, receiver) { if (typeof key === 'string' && /^\d+$/.test(key)) sourceReads++; return Reflect.get(target, key, receiver); } });
  const middle = Math.floor(count / 2), result = dateWindow(proxy, list[middle].date, list[middle + 8].date), budget = 2 * Math.ceil(Math.log2(count)) + 13;
  assert.equal(result.length, 9); assert.ok(sourceReads <= budget, `${count} rows required ${sourceReads} reads (budget ${budget}).`);
  const sampled = pixelExtrema(list, row => row.index / count * 1000, ['price']);
  assert.ok(sampled.length <= 4004, 'Four original extrema/endpoints per occupied column.');
  assert.ok(sampled.every((row, index) => index === 0 || sampled[index - 1].index < row.index));
  complexity.push({ sourceRows: count, visibleRows: result.length, sourceReads, maxReads: budget, displayPoints: sampled.length, maxDisplayPoints: 4004 });
}
const moduleHashes = Object.fromEntries(['atlas-price-chart.js', 'chart-overlays.js', 'chart-window.js', 'chart-navigation.js'].map(name => [name, createHash('sha256').update(readFileSync(resolve(root, 'dist', name))).digest('hex')]));
const report = {
  status: 'PASS', asOf, scope: 'Deterministic renderer/search/selection checks; Node SVG boundary, not browser paint or input-latency measurement.',
  observedPriceRows: rows.length, observedCandleRows: bars.length, observedVolumeShapes: volumeShapes, svgElements, svgElementBudget: 120,
  sourceSelectionDates: selectionIndices.map(index => bars[index].date), complexity, moduleHashes,
};
const outputIndex = process.argv.indexOf('--output');
if (outputIndex >= 0) { const output = resolve(root, process.argv[outputIndex + 1]); mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`); }
console.log(JSON.stringify(report));
