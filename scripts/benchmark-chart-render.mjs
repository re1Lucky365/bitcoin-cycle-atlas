#!/usr/bin/env node
// Measures renderer JavaScript/string construction, not browser paint/layout.
// --input-root may be a git archive of the baseline to keep model/data identical.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';

const here = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const inputRoot = resolve(option('--input-root', here));
const rendererRoot = resolve(option('--renderer-root', here));
const samples = Number(option('--samples', '7'));
if (!Number.isInteger(samples) || samples < 3 || samples > 30) throw new Error('Use 3–30 measured samples.');
const load = (root, name) => import(pathToFileURL(resolve(root, 'dist', name)).href);
const [{ drawAtlasPriceChart }, { buildLongHorizonForecast }, { fitVolumeForecastModel, projectVolumeForecast }, { BITCOIN_EVENTS }] = await Promise.all([
  load(rendererRoot, 'atlas-price-chart.js'), load(inputRoot, 'long-horizon-forecast.js'), load(inputRoot, 'volume-forecast.js'), load(inputRoot, 'bitcoin-events.js'),
]);
const dataset = JSON.parse(readFileSync(resolve(inputRoot, 'dist/data/btc-daily.json'), 'utf8'));
const volume = JSON.parse(readFileSync(resolve(inputRoot, 'dist/data/btc-volume.json'), 'utf8'));
const asOf = dataset.prices.at(-1)[0], referenceDate = new Date(Date.parse(`${asOf}T00:00:00Z`) + 86400000).toISOString().slice(0, 10), stamp = performance.now();
const model = buildLongHorizonForecast(dataset, { asOf, referenceDate, scenario: 'base', seed: 20261022, sampleCount: 128, blockDays: 28 });
const priceModelMs = performance.now() - stamp, volumeStamp = performance.now();
const volumeModel = fitVolumeForecastModel(volume.bars, { asOf, source: volume.source });
const volumeProjection = projectVolumeForecast(volumeModel, model.path, { asOf, endDate: model.displayEnd, frequency: 'daily', terminalVolatility: (model.longHorizon?.assumptions?.terminalVolatilityPct ?? 20) / 100, volatilityHalfLifeYears: model.longHorizon?.assumptions?.volatilityHalfLifeYears ?? 8 });
const volumeModelMs = performance.now() - volumeStamp;
let high = 0;
const rows = [...dataset.prices.map(([date, price]) => ({ date, price })), ...model.path.filter(row => row.date > asOf)].map(row => {
  high = Math.max(high, row.price); return { ...row, drawdownPct: (row.price / high - 1) * 100 };
});

class NodeBoundary {
  constructor() { this.attrs = new Map(); this.nodes = new Map(); this.dataset = {}; this.textContent = ''; }
  setAttribute(key, value) { this.attrs.set(key, String(value)); }
  removeAttribute(key) { this.attrs.delete(key); }
  querySelector(selector) { if (!this.nodes.has(selector)) this.nodes.set(selector, new NodeBoundary()); return this.nodes.get(selector); }
  querySelectorAll(selector) { return selector === 'text' ? [0, 1, 2, 3].map(index => this.querySelector(`text-${index}`)) : []; }
  focus() {}
}
function svgFixture() {
  const svg = new NodeBoundary();
  Object.assign(svg, { id: 'benchmark-price', clientWidth: 1280, clientHeight: 720, innerHTML: '', parentElement: { style: { setProperty() {} } } });
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1280, height: 720 });
  return svg;
}
const oneYearStart = new Date(Date.parse(`${asOf}T00:00:00Z`) - 364 * 86400000).toISOString().slice(0, 10);
const futureYear = Math.min(Number(asOf.slice(0, 4)) + 4, Number(model.displayEnd.slice(0, 4)));
const settings = { rows, split: asOf, frequency: 'daily', observedCandles: volume.bars, volumeBars: volume.bars, volumeProjection, showVolume: true, historicalEvents: BITCOIN_EVENTS, band: true, showDrawdown: true };
const cases = [
  { name: 'full-line', start: rows[0].date, end: model.displayEnd, chartType: 'line' },
  { name: 'full-candles', start: rows[0].date, end: model.displayEnd, chartType: 'candles' },
  { name: 'one-year-candles', start: oneYearStart, end: asOf, chartType: 'candles' },
  { name: 'future-90-days', start: `${futureYear}-01-01`, end: `${futureYear}-03-31`, chartType: 'line' },
];
const summarize = values => {
  const sorted = [...values].sort((a, b) => a - b);
  return { medianMs: sorted[Math.floor(sorted.length / 2)], minMs: sorted[0], maxMs: sorted.at(-1), samplesMs: values };
};
const results = [];
for (const item of cases) {
  const svg = svgFixture(), durations = [];
  for (let i = 0; i < samples + 2; i++) {
    const before = performance.now(); drawAtlasPriceChart({ ...settings, ...item, svg });
    const elapsed = performance.now() - before;
    if (i >= 2) durations.push(elapsed);
  }
  results.push({ name: item.name, ...summarize(durations), markupBytes: Buffer.byteLength(svg.innerHTML), svgElements: (svg.innerHTML.match(/<[a-z][\w-]*(?=[\s>])/g) || []).length, pathCommands: (svg.innerHTML.match(/(?:M|L)-?\d/g) || []).length, data: svg.dataset });
}
const svg = svgFixture();
drawAtlasPriceChart({ ...settings, svg, start: oneYearStart, end: asOf, chartType: 'candles', tool: 'measure', measurement: { startDate: `${asOf.slice(0, 4)}-01-01`, endDate: null } });
const hoverSamples = [];
for (let sample = 0; sample < samples + 2; sample++) {
  const before = performance.now();
  for (let i = 0; i < 100; i++) svg.onpointermove({ pointerType: 'mouse', target: { closest: () => null }, clientX: 20 + i * 10, clientY: 140 });
  if (sample >= 2) hoverSamples.push(performance.now() - before);
}
results.push({ name: 'measurement-100-pointer-events', ...summarize(hoverSamples) });
const report = {
  generatedAt: new Date().toISOString(), revision: option('--revision', 'working-tree'), node: process.version,
  scope: 'Node SVG boundary stub: renderer JS and markup generation. No DOM parsing, browser paint, network, or end-to-end latency claim.',
  method: `${samples} measured samples per case after 2 warmups; 1280×720; cases in the listed order; no wall-time pass/fail threshold.`,
  rendererModuleHashes: Object.fromEntries(['atlas-price-chart.js', 'chart-overlays.js', 'chart-window.js', 'chart-navigation.js'].filter(name => existsSync(resolve(rendererRoot, 'dist', name))).map(name => [name, createHash('sha256').update(readFileSync(resolve(rendererRoot, 'dist', name))).digest('hex')])),
  inputRoot, rendererRoot, rows: rows.length, observedBars: volume.bars.length, projectedBars: volumeProjection.points?.length,
  inputSha256: createHash('sha256').update(JSON.stringify({ rows, bars: volume.bars, projection: volumeProjection.points })).digest('hex'),
  construction: { priceModelMs, volumeModelMs }, results,
};
const output = option('--output', null);
if (output) writeFileSync(resolve(output), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ revision: report.revision, scope: report.scope, inputSha256: report.inputSha256, construction: report.construction, results: results.map(({ name, medianMs, minMs, maxMs, markupBytes, svgElements, pathCommands }) => ({ name, medianMs, minMs, maxMs, markupBytes, svgElements, pathCommands })) }, null, 2));
