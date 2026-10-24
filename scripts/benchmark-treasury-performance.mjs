#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { cpus, loadavg } from 'node:os';

const here = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = (key, fallback) => args.includes(key) ? args[args.indexOf(key) + 1] : fallback;
const beforeRoot = resolve(option('--before', ''));
const afterRoot = resolve(option('--after', here));
if (!args.includes('--before') || beforeRoot === afterRoot) throw new Error('Provide distinct --before and --after source directories.');
const samples = Number(option('--samples', '7'));
if (!Number.isInteger(samples) || samples < 5 || samples > 30) throw new Error('Use 5–30 measured samples.');
const sha = value => createHash('sha256').update(value).digest('hex');
const sourceNames = ['mstr-ohlc', 'btc-daily'];
const sourceTexts = Object.fromEntries(sourceNames.map(name => [name, readFileSync(resolve(beforeRoot, `dist/data/${name}.json`))]));
for (const name of sourceNames) assert.equal(sha(sourceTexts[name]), sha(readFileSync(resolve(afterRoot, `dist/data/${name}.json`))), `Changed input ${name}`);
const history = JSON.parse(sourceTexts['mstr-ohlc']);
const btcHistory = JSON.parse(sourceTexts['btc-daily']);
const asOf = '2026-10-23', seed = 20261022, endYear = 2035;
const load = (root, file) => import(pathToFileURL(resolve(root, 'dist', file)).href);
const sides = {};
for (const [name, root] of [['before', beforeRoot], ['after', afterRoot]]) {
  const [{ buildTreasuryProjection }, { parseEquityArchive, equityHistoryRange }, { drawIntradayChart }] = await Promise.all([
    load(root, 'treasury-projection.js'), load(root, 'equity-market-data.js'), load(root, 'intraday-chart.js'),
  ]);
  sides[name] = { root, buildTreasuryProjection, drawIntradayChart, equityHistoryRange, series: parseEquityArchive(history, { symbol: 'MSTR' }) };
}

class SvgBoundary {
  constructor() { this.attrs = new Map(); this.nodes = new Map(); this.dataset = {}; this.textContent = ''; }
  setAttribute(key, value) { this.attrs.set(key, String(value)); }
  getAttribute(key) { return this.attrs.get(key); }
  removeAttribute(key) { this.attrs.delete(key); }
  querySelector(key) { if (!this.nodes.has(key)) this.nodes.set(key, new SvgBoundary()); return this.nodes.get(key); }
  querySelectorAll() { return []; }
  focus() {}
}
function svgFixture() {
  const svg = new SvgBoundary();
  Object.assign(svg, { id: 'treasury-benchmark', clientWidth: 1280, clientHeight: 720, innerHTML: '', parentElement: { style: { setProperty() {} } } });
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1280, height: 720 });
  return svg;
}

function calculateAndDraw(side) {
  const svg = svgFixture();
  const start = performance.now();
  const projection = side.buildTreasuryProjection({ symbol: 'MSTR', history, btcHistory, asOf, seed, endYear });
  const calculationMs = performance.now() - start;
  const forecast = projection.forecasts.base;
  const range = side.equityHistoryRange(side.series, { span: '4y', forecastEnd: forecast.displayEnd });
  let selected;
  side.drawIntradayChart({ svg, series: side.series, forecast, range, chartType: 'line', showVolume: false, onHover: value => { selected = value; } });
  const totalMs = performance.now() - start;
  assert.equal(projection.asOf, asOf);
  assert.deepEqual(Object.keys(projection.forecasts), ['stress', 'base', 'bull']);
  const rows = Object.values(projection.forecasts).map(result => result.path.length);
  assert.deepEqual(rows, [3357, 3357, 3357]);
  assert.ok(Number(svg.dataset.forecastPointCount) > 0);
  assert.doesNotMatch(svg.innerHTML, /NaN|Infinity/);
  assert.equal(selected.kind, 'observed');
  side.projection = projection;
  return { calculationMs, totalMs, rows, modelSha256: sha(JSON.stringify(projection)), markupSha256: sha(svg.innerHTML), markupBytes: Buffer.byteLength(svg.innerHTML) };
}

const runs = { before: [], after: [] }, loadBefore = loadavg();
for (let index = 0; index < samples + 2; index++) {
  for (const name of ['before', 'after']) {
    const result = calculateAndDraw(sides[name]);
    if (index >= 2) runs[name].push(result);
    if (name === 'after') {
      const other = sides.before.projection;
      assert.deepEqual(sides.after.projection, other, 'The complete financial and asset results must be unchanged.');
    }
  }
}
for (const name of ['before', 'after']) {
  for (const row of runs[name]) {
    assert.equal(row.modelSha256, runs.before[0].modelSha256);
    assert.equal(row.markupSha256, runs.before[0].markupSha256);
  }
}
const redrawRuns = { before: [], after: [] };
for (let index = 0; index < samples + 2; index++) {
  for (const name of ['before', 'after']) {
    const side = sides[name], svg = svgFixture(), outputs = [];
    const forecast = side.projection.forecasts.base, startTime = Date.parse('2030-01-01') / 1000;
    const start = performance.now();
    for (let step = 0; step < 20; step++) {
      const range = { start: startTime + step * 86400, end: startTime + (step + 90) * 86400 };
      side.drawIntradayChart({ svg, series: side.series, forecast, range, chartType: 'line', showVolume: false });
      outputs.push(svg.innerHTML);
    }
    const durationMs = performance.now() - start;
    assert.equal(outputs.length, 20);
    assert.equal(Number(svg.dataset.forecastPointCount), 91);
    for (const markup of outputs) assert.doesNotMatch(markup, /NaN|Infinity/);
    const result = { durationMs, markupSha256: sha(outputs.join('')), draws: outputs.length };
    if (index >= 2) redrawRuns[name].push(result);
    side.lastRedraw = result;
    if (name === 'after') assert.equal(result.markupSha256, sides.before.lastRedraw.markupSha256);
  }
}
const summary = values => {
  const sorted = [...values].sort((a, b) => a - b);
  return { medianMs: sorted[Math.floor(sorted.length / 2)], minMs: sorted[0], maxMs: sorted.at(-1), samplesMs: values };
};
const result = Object.fromEntries(Object.entries(runs).map(([name, rows]) => [name, {
  calculation: summary(rows.map(row => row.calculationMs)), calculationAndInitialSvg: summary(rows.map(row => row.totalMs)),
  successes: rows.length, failures: 0, dailyRows: rows[0].rows, modelSha256: rows[0].modelSha256,
  markupSha256: rows[0].markupSha256, markupBytes: rows[0].markupBytes,
  twentyNarrowRedraws: { ...summary(redrawRuns[name].map(row => row.durationMs)), drawsPerSample: 20, successes: redrawRuns[name].length, failures: 0, markupSha256: redrawRuns[name][0].markupSha256 },
}]));
const moduleNames = ['long-horizon-forecast.js', 'treasury-asset-paths.js', 'treasury-model.js', 'treasury-projection.js', 'equity-forecast-chart.js', 'intraday-chart.js'];
const report = {
  status: 'PASS', node: process.version, cpus: cpus().length, loadBefore, loadAfter: loadavg(), asOf, seed, endYear,
  beforeRevision: option('--before-revision', 'unspecified'), afterRevision: option('--after-revision', 'working-tree'),
  scope: 'Node computation and SVG-string generation after module and data loading. Excludes network, DOM parsing, style, layout, paint and user input latency. No browser or mobile speed claim.',
  method: `${samples} samples per side after 2 warmups; alternate before, after for every pair; same real snapshots, seed, horizon and 128-sample BTC source ensemble. Each timed call fully recalculates all three financial paths and the initial 1280×720 MSTR line chart. Hashes and full deep equality are checked outside the timer. A separate paired case times 20 successive 90-day future viewport redraws of the already calculated projection, also after 2 warmups.`,
  inputSha256: Object.fromEntries(sourceNames.map(name => [name, sha(sourceTexts[name])])),
  moduleSha256: Object.fromEntries(Object.entries(sides).map(([name, side]) => [name, Object.fromEntries(moduleNames.map(file => [file, sha(readFileSync(resolve(side.root, 'dist', file)))]))])),
  results: result,
};
const output = option('--output', null);
if (output) writeFileSync(resolve(output), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
