#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cp, copyFile, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { structureViewFixture } from '../tests/helpers/structure-view-fixture.mjs';

const args = process.argv.slice(2), options = {};
for (let index = 0; index < args.length; index += 2) {
  assert.ok(args[index].startsWith('--') && args[index + 1], 'Expected --name value pairs');
  options[args[index].slice(2)] = args[index + 1];
}
assert.ok(options.before && options.after, 'Supply --before BASE_TREE --after MODIFIED_TREE');
const beforeRoot = path.resolve(options.before), afterRoot = path.resolve(options.after);
// Historical v1.22-to-v1.23 comparison. Use the fixture from the exact reviewed
// after tree; the v1.24 cycle table intentionally has different output/controls.
const { dailyViewSurface } = await import(pathToFileURL(path.join(afterRoot, 'tests/helpers/daily-data-view-fixture.mjs')));
const afterApi = await import(pathToFileURL(path.join(afterRoot, 'dist/daily-data-view.js')));
assert.equal(typeof afterApi.renderMonthlyDataTable, 'function', 'This historical output-equivalence benchmark requires the archived v1.23 after tree. Use daily-data-performance.test.mjs for the v1.24 cycle table.');
assert.notEqual(beforeRoot, afterRoot, 'Distinct baseline and modified source trees are required');
const sampleCount = Number(options.samples || 7);
assert.ok(Number.isInteger(sampleCount) && sampleCount >= 5 && sampleCount <= 30, 'Use 5–30 samples per side');
const sha = value => createHash('sha256').update(value).digest('hex');
const revision = root => execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const moduleAt = (root, file) => import(pathToFileURL(path.join(root, 'dist', file)).href);
const jsonAt = async file => JSON.parse(await readFile(path.join(beforeRoot, 'dist/data', file), 'utf8'));
const sourceFiles = ['btc-daily.json', 'eth-ohlc.json', 'mstr-ohlc.json', 'bmnr-ohlc.json'];
const inputHashes = Object.fromEntries(await Promise.all(sourceFiles.map(async file => [file, sha(await readFile(path.join(beforeRoot, 'dist/data', file)))])));
for (const file of sourceFiles) assert.equal(sha(await readFile(path.join(afterRoot, 'dist/data', file))), inputHashes[file], `Both sides need identical ${file}`);
const btc = await jsonAt('btc-daily.json');
const { dailyAssetFromArchive } = await moduleAt(beforeRoot, 'daily-data-source.js');
const assets = new Map(await Promise.all(['ETH', 'MSTR', 'BMNR'].map(async symbol => [symbol, dailyAssetFromArchive(symbol, await jsonAt(`${symbol.toLowerCase()}-ohlc.json`))])));
const counts = { BTC: btc.prices.length, ...Object.fromEntries([...assets].map(([symbol, asset]) => [symbol, asset.prices.length])) };

// Isolate this optimization from simultaneous, correctness-changing financial fixes.
// All relative imports retain the production module graph and version queries.
// Only the two actual modified view sources are overlaid on a baseline JS tree.
const isolatedRoot = await mkdtemp(path.join(os.tmpdir(), 'atlas-daily-performance-'));
await cp(path.join(beforeRoot, 'dist'), path.join(isolatedRoot, 'dist'), {
  recursive: true,
  filter: (source, destination) => source === path.join(beforeRoot, 'dist') || source.endsWith('.js'),
});
await writeFile(path.join(isolatedRoot, 'package.json'), '{"type":"module"}\n');
const viewFiles = ['daily-data-view.js', 'lab-view.js'];
for (const file of viewFiles) await copyFile(path.join(afterRoot, 'dist', file), path.join(isolatedRoot, 'dist', file));
const scripts = (await readdir(path.join(beforeRoot, 'dist'))).filter(file => file.endsWith('.js')).sort();
const dependencyHashes = Object.fromEntries(await Promise.all(scripts.filter(file => !viewFiles.includes(file)).map(async file => [file, sha(await readFile(path.join(beforeRoot, 'dist', file)))])));
const sourceHashes = Object.fromEntries(await Promise.all(viewFiles.map(async file => [file, {
  before: sha(await readFile(path.join(beforeRoot, 'dist', file))), after: sha(await readFile(path.join(isolatedRoot, 'dist', file))),
}])));
const revisions = { before: revision(beforeRoot), afterTreeHead: revision(afterRoot) };
const implementations = {
  before: await moduleAt(beforeRoot, 'daily-data-view.js'),
  after: await moduleAt(isolatedRoot, 'daily-data-view.js'),
};

async function run(side) {
  const ui = dailyViewSurface('', { clientHeight: 714 }), output = createHash('sha256');
  let snapshots = 0, outputCharacters = 0, consumedDailyRows = 0, monthlyReads = 0, pagingMs = 0;
  let hiddenMonthlyWrites = 0, hiddenMonthlyCharacters = 0, pagingActions = 0;
  const consume = () => {
    const snapshot = ui.snapshot(), text = JSON.stringify(snapshot);
    assert.ok(!text.includes('NaN') && !text.includes('Infinity'), 'Visible output must remain finite');
    assert.ok(!snapshot.annual || !snapshot.annual.includes('data-daily-retry'), 'No silent loader failure');
    if (ui.node('daily-monthly-scroll').hidden) {
      const rowCount = (ui.node('data-body').innerHTML.match(/<tr>/g) || []).length;
      assert.equal(rowCount, 20, 'The requested daily rows must really render');
      consumedDailyRows += rowCount;
    } else {
      assert.ok(ui.node('daily-monthly-table').innerHTML.includes('data-daily-period'), 'The visible monthly table must really render');
      monthlyReads++;
    }
    output.update(text); snapshots++; outputCharacters += text.length;
  };
  const started = performance.now();
  const view = implementations[side].initDailyDataView({
    root: ui.root, getBitcoinDataset: () => btc,
    loadAsset: async symbol => { assert.ok(assets.has(symbol)); return assets.get(symbol); },
  });
  view.render(); await ui.settle(); consume();
  const firstReadyMs = performance.now() - started;
  for (const symbol of ['BTC', 'ETH', 'MSTR', 'BMNR']) {
    ui.click('', { dailyAsset: symbol }); consume();
    for (const direction of ['data-next', 'data-prev']) for (let index = 0; index < 10; index++) {
      ui.resetWork();
      const start = performance.now();
      ui.click(direction); consume();
      pagingMs += performance.now() - start;
      const work = ui.work()['daily-monthly-table'];
      hiddenMonthlyWrites += work?.nonemptyWrites || 0;
      hiddenMonthlyCharacters += work?.characters || 0;
      pagingActions++;
    }
    const lastDate = symbol === 'BTC' ? btc.prices.at(-1)[0] : assets.get(symbol).prices.at(-1)[0];
    ui.change('data-year', lastDate.slice(0, 4)); consume();
    ui.click('', { dailyDetail: 'monthly' }); consume();
    ui.click('', { dailyDetail: 'daily' }); consume();
  }
  const outputHash = output.digest('hex');
  const journeyMs = performance.now() - started;
  assert.equal(pagingActions, 80); assert.equal(monthlyReads, 4); assert.equal(snapshots, 97);
  if (side === 'after') assert.equal(hiddenMonthlyWrites, 0, 'Optimization must eliminate all hidden monthly builds');
  view.destroy();
  return { firstReadyMs, pagingMs, journeyMs, outputHash, snapshots, outputCharacters, consumedDailyRows, monthlyReads, pagingActions, hiddenMonthlyWrites, hiddenMonthlyCharacters, errors: 0 };
}

async function runStructure(side) {
  const ui = await structureViewFixture({ root: side === 'before' ? beforeRoot : isolatedRoot });
  const output = createHash('sha256'); let snapshots = 0, outputCharacters = 0;
  const consume = () => {
    const text = JSON.stringify(ui.snapshot());
    assert.ok(ui.node('structure-chart').innerHTML.length > 0, 'Requested SVG must be generated');
    assert.ok(!text.includes('NaN') && !text.includes('Infinity'), 'Comparison output must remain finite');
    output.update(text); snapshots++; outputCharacters += text.length;
  };
  const started = performance.now();
  ui.setDataset(btc); ui.showCompare(); consume();
  const firstReadyMs = performance.now() - started, firstCalls = { ...ui.calls };
  const redrawStart = performance.now();
  for (const frequency of ['weekly', 'daily']) {
    ui.frequency(frequency); consume();
    for (let index = 0; index < 10; index++) { ui.change('structure-scope', ['2014', '2018', '2022', 'all', '1990'][index % 5]); consume(); }
    for (const alignment of ['trough', 'calendar']) { ui.change('structure-alignment', alignment); consume(); }
  }
  const outputHash = output.digest('hex'), redrawMs = performance.now() - redrawStart, journeyMs = performance.now() - started;
  const repeatedCalls = Object.fromEntries(Object.entries(ui.calls).map(([name, count]) => [name, count - firstCalls[name]]));
  assert.equal(snapshots, 27); assert.equal(repeatedCalls.chart, 26); assert.equal(repeatedCalls.analysis, 0);
  if (side === 'after') { assert.equal(repeatedCalls.rolling, 0); assert.equal(repeatedCalls.directional, 0); }
  return { firstReadyMs, redrawMs, journeyMs, outputHash, snapshots, outputCharacters, firstCalls, repeatedCalls, errors: ui.errors.length };
}

const summarize = values => {
  const sorted = [...values].sort((left, right) => left - right), middle = Math.floor(sorted.length / 2);
  return { median: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2, min: sorted[0], max: sorted.at(-1) };
};
const machineBefore = { loadAverage: os.loadavg(), cores: os.availableParallelism(), uptimeSeconds: os.uptime() };
const samples = { before: [], after: [] }, structureSamples = { before: [], after: [] }, order = [];
try {
  for (let warmup = 0; warmup < 2; warmup++) for (const side of ['before', 'after']) { await run(side); await runStructure(side); }
  for (let sample = 0; sample < sampleCount; sample++) for (const side of ['before', 'after']) {
    const result = await run(side), structureResult = await runStructure(side);
    samples[side].push(result); structureSamples[side].push(structureResult); order.push(side);
    const reference = samples.before[0];
    for (const field of ['outputHash', 'snapshots', 'outputCharacters', 'consumedDailyRows', 'monthlyReads', 'pagingActions']) {
      assert.equal(result[field], reference[field], `Real work and visible results must agree: ${side}.${field}`);
    }
    for (const field of ['outputHash', 'snapshots', 'outputCharacters']) assert.equal(structureResult[field], structureSamples.before[0][field], `Comparison visible result must agree: ${side}.${field}`);
  }
  const summary = Object.fromEntries(['before', 'after'].map(side => [side,
    Object.fromEntries(['firstReadyMs', 'pagingMs', 'journeyMs'].map(metric => [metric, summarize(samples[side].map(sample => sample[metric]))])),
  ]));
  const structureSummary = Object.fromEntries(['before', 'after'].map(side => [side,
    Object.fromEntries(['firstReadyMs', 'redrawMs', 'journeyMs'].map(metric => [metric, summarize(structureSamples[side].map(sample => sample[metric]))])),
  ]));
  const receipt = {
    version: 1, measuredAt: new Date().toISOString(),
    claim: 'Remove the hidden monthly heatmap work during daily paging; reuse existing state/pivot results during comparison redraws; preserve visible outputs and requested render counts.',
    scope: 'Real daily controller/analytics with archived 4-asset inputs and real comparison controller/analysis/SVG renderer. Daily journey: first-ready plus 80 page actions and 4 monthly transitions. Comparison journey: first-ready plus 26 frequency/scope/alignment changes. Inert DOM boundary; no browser HTML parsing/layout/paint, network, download latency, or mobile-device timing.',
    isolation: 'Baseline production JS dependencies on both sides; only daily-data-view.js and lab-view.js are overlaid from the modified tree. Concurrent financial correctness fixes are deliberately excluded from this performance comparison. Comparison import bindings are instrumented to count actual calls; its function bodies and mathematical/render dependencies remain unchanged.',
    runtime: { node: process.version, platform: os.platform(), architecture: os.arch() },
    machineBefore, machineAfter: { loadAverage: os.loadavg(), uptimeSeconds: os.uptime() },
    warmupsPerSide: 2, samplesPerSide: sampleCount, order, errors: 0,
    revisions,
    sources: {
      views: sourceHashes,
      baselineDependencyManifest: sha(JSON.stringify(dependencyHashes)),
      benchmark: sha(await readFile(new URL(import.meta.url))),
      dailyBoundary: sha(await readFile(new URL('../tests/helpers/daily-data-view-fixture.mjs', import.meta.url))),
      structureBoundary: sha(await readFile(new URL('../tests/helpers/structure-view-fixture.mjs', import.meta.url))),
    },
    inputs: { hashes: inputHashes, rows: counts, asOf: btc.prices.at(-1)[0], rowLimit: 20, boundaryClientHeight: 714 },
    summary, samples,
    structure: {
      summary: structureSummary, samples: structureSamples,
      improvements: Object.fromEntries(['firstReadyMs', 'redrawMs', 'journeyMs'].map(metric => [metric, {
        reductionPct: (1 - structureSummary.after[metric].median / structureSummary.before[metric].median) * 100,
        ratio: structureSummary.before[metric].median / structureSummary.after[metric].median,
      }])),
    },
    improvements: Object.fromEntries(['firstReadyMs', 'pagingMs', 'journeyMs'].map(metric => [metric, {
      reductionPct: (1 - summary.after[metric].median / summary.before[metric].median) * 100,
      ratio: summary.before[metric].median / summary.after[metric].median,
    }])),
  };
  if (options.output) await writeFile(path.resolve(options.output), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify({ scope: receipt.scope, summary, improvements: receipt.improvements, structure: { summary: structureSummary, improvements: receipt.structure.improvements }, errors: receipt.errors, sources: receipt.sources, output: options.output || null }, null, 2));
} finally { await rm(isolatedRoot, { recursive: true, force: true }); }
