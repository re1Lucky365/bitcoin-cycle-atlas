import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const jarSha256 = '936a262061c914694dfd669a543be24573c45d5aa0ff20a8b96b23d01e050e88';
const jar = process.env.TLA2TOOLS || path.join(root, 'build/formal-tools/tla2tools-1.7.4.jar');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

async function prepareTool() {
  let bytes;
  try { bytes = await readFile(jar); }
  catch (error) {
    if (error.code !== 'ENOENT' || process.env.TLA2TOOLS) throw error;
    const response = await fetch('https://github.com/tlaplus/tlaplus/releases/download/v1.7.4/tla2tools.jar', { signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`TLC download HTTP ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(hash(bytes), jarSha256, 'Unexpected TLC download checksum');
    await mkdir(path.dirname(jar), { recursive: true }); await writeFile(jar, bytes);
  }
  assert.equal(hash(bytes), jarSha256, 'Use the pinned TLC 1.7.4 jar');
}

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', timeout: 60000, maxBuffer: 16 * 1024 * 1024 });
  if (result.error) throw result.error;
  return { status: result.status, output: `${result.stdout || ''}${result.stderr || ''}` };
}

const variants = [
  { id: 'current', values: {}, invariant: null },
  { id: 'original-boot-order', values: { BootOnRender: false, RespectSuspension: false }, invariant: 'UsableRenderReleasesBoot' },
  { id: 'unguarded-prices', values: { GuardPrices: false }, invariant: 'NoStalePublication' },
  { id: 'unguarded-projection', values: { GuardProjection: false }, invariant: 'NoStalePublication' },
  { id: 'unguarded-errors', values: { GuardErrors: false }, invariant: 'NoStalePublication' },
  { id: 'retained-old-projection', values: { ClearProjection: false }, invariant: 'ProjectionMatchesPrices' },
  { id: 'hidden-ready', values: { RespectSuspension: false }, invariant: 'NoHiddenReadiness' },
  { id: 'overwritten-range', values: { PreserveRange: false }, invariant: 'UserRangePreserved' },
];

async function models(work) {
  const model = path.join(root, 'verification/equity-state/EquityLoad.tla');
  const config = await readFile(path.join(root, 'verification/equity-state/EquityLoad.cfg'), 'utf8');
  const results = {};
  for (const variant of variants) {
    let value = config;
    for (const [name, enabled] of Object.entries(variant.values)) value = value.replace(`${name} = TRUE`, `${name} = ${enabled ? 'TRUE' : 'FALSE'}`);
    if (variant.invariant) value = value.replace(/^INVARIANTS .*$/m, `INVARIANT ${variant.invariant}`);
    const file = path.join(root, 'verification/equity-state', variant.id === 'current' ? 'EquityLoad.cfg' : `${variant.id}.cfg`);
    assert.equal(await readFile(file, 'utf8'), value, `Reviewed configuration drift: ${variant.id}`);
    const result = run(process.env.JAVA || 'java', ['-XX:+UseParallelGC', '-cp', jar, 'tlc2.TLC', '-workers', '1', '-seed', '1', '-fp', '0', '-metadir', path.join(work, variant.id), '-config', file, model]);
    if (variant.invariant) {
      assert.notEqual(result.status, 0, `${variant.id} must expose its invariant violation`);
      assert.ok(result.output.includes(`Invariant ${variant.invariant} is violated`), result.output);
    } else {
      assert.equal(result.status, 0, result.output);
      assert.match(result.output, /Model checking completed\. No error has been found\./);
    }
    const counts = result.output.match(/([\d,]+) states generated, ([\d,]+) distinct states found, ([\d,]+) states left on queue/);
    assert.ok(counts, 'TLC did not finish with state counts');
    results[variant.id] = {
      status: variant.invariant ? 'expected invariant violation' : 'pass', invariant: variant.invariant,
      generated: Number(counts[1].replaceAll(',', '')), distinct: Number(counts[2].replaceAll(',', '')), remaining: Number(counts[3].replaceAll(',', '')),
    };
    console.log(`${variant.id}: ${results[variant.id].status}`);
  }
  return results;
}

async function implementation(work) {
  const original = run(process.execPath, ['tests/equity-load-ownership.test.mjs']);
  assert.equal(original.status, 0, original.output);
  assert.match(original.output, /tests 28/);
  console.log(original.output.trim());
  const copy = path.join(work, 'implementation');
  const files = ['dist/equity-view.js', 'dist/equity-market-data.js', 'dist/index.html', 'tests/equity-load-ownership.test.mjs', 'tests/helpers/equity-view-fixture.mjs'];
  for (const file of files) {
    await mkdir(path.dirname(path.join(copy, file)), { recursive: true });
    await copyFile(path.join(root, file), path.join(copy, file));
  }
  await writeFile(path.join(copy, 'package.json'), '{"type":"module"}\n');
  const viewFile = path.join(copy, 'dist/equity-view.js'), source = await readFile(viewFile, 'utf8');
  const changes = [
    {
      id: 'deferred-readiness', from: 'navigation.update();revealReady();}', to: 'navigation.update();}',
      failure: /a completed observed render must release the boot shell/,
    },
    {
      id: 'unguarded-prices', from: 'if(token!==generation)return;\n      daily=nextDaily;', to: 'daily=nextDaily;',
      failure: /a revoked stock response must not request a coin archive/,
    },
    {
      id: 'unguarded-projection', from: 'if(token!==generation)return;\n        projection=buildTreasuryProjection', to: 'projection=buildTreasuryProjection',
      failure: /revoked paint continuation must not calculate/,
    },
    {
      id: 'unguarded-coin-error', from: "if(token===generation&&error.name!=='AbortError'){forecastError=", to: "if(error.name!=='AbortError'){forecastError=",
      failure: /revoked underlying work must not clear a newer forecast/,
    },
    {
      id: 'retained-old-projection', from: 'daily=nextDaily;weekly=nextWeekly;projection=null;forecast=null;', to: 'daily=nextDaily;weekly=nextWeekly;',
      failure: /new prices must never be displayed with the previous projection/,
    },
    {
      id: 'hidden-ready', from: 'state.frame=null;if(suspended)return;const series=current();', to: 'state.frame=null;const series=current();',
      failure: /a hidden initialization callback must not release the boot shell/,
    },
    {
      id: 'overwritten-range', from: 'state.range=state.rangeTouched&&state.range?{...nextRange,start:state.range.start,end:state.range.end}:null;', to: 'state.range=null;',
      failure: /preserves user interval, scenario and range/,
    },
  ];
  const mutations = {};
  for (const change of changes) {
    assert.equal(source.split(change.from).length, 2, `Review model/code correspondence and mutation selector: ${change.id}`);
    await writeFile(viewFile, source.replace(change.from, change.to));
    const result = run(process.execPath, ['tests/equity-load-ownership.test.mjs'], copy);
    assert.notEqual(result.status, 0, `${change.id} must fail its real-code regression`);
    assert.match(result.output, change.failure, `Mutation failed for an unrelated reason: ${change.id}\n${result.output}`);
    mutations[change.id] = 'expected assertion failure';
  }
  await writeFile(viewFile, source);
  const restored = run(process.execPath, ['tests/equity-load-ownership.test.mjs'], copy);
  assert.equal(restored.status, 0, restored.output);
  return { tests: 28, original: 'pass', restored: 'pass', sourceSha256: hash(source), mutations };
}

await prepareTool();
const work = await mkdtemp(path.join(tmpdir(), 'atlas-equity-proof-'));
try {
  const model = await models(work), replay = await implementation(work);
  const report = {
    tool: { name: 'TLC', release: '1.7.4', jarSha256 },
    bounds: { requestGenerations: 3, intervals: ['daily', 'weekly'], rangeChoices: ['auto', 'custom'] },
    model, implementation: replay,
    limitations: ['Finite request-state model, not an unbounded proof', 'UI replay injects import, HTTP, animation-frame and DOM boundaries', 'No economic accuracy, visual pixels, browser timing or liveness proof'],
  };
  if (process.argv[2]) await writeFile(path.resolve(process.argv[2]), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally { await rm(work, { recursive: true, force: true }); }
