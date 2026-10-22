import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const toolUrl = 'https://github.com/tlaplus/tlaplus/releases/download/v1.7.4/tla2tools.jar';
const toolSha256 = '936a262061c914694dfd669a543be24573c45d5aa0ff20a8b96b23d01e050e88';
const toolPath = process.env.TLA2TOOLS || path.join(root, 'build/formal-tools/tla2tools-1.7.4.jar');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

async function prepareTool() {
  let bytes;
  try { bytes = await readFile(toolPath); }
  catch (error) {
    if (error.code !== 'ENOENT' || process.env.TLA2TOOLS) throw error;
    console.log('Downloading pinned TLC 1.7.4 from its official release.');
    const response = await fetch(toolUrl, { signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`TLC download HTTP ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(hash(bytes), toolSha256, 'TLC checksum differs from the reviewed release');
    await mkdir(path.dirname(toolPath), { recursive: true });
    await writeFile(toolPath, bytes);
  }
  assert.equal(hash(bytes), toolSha256, 'Use the pinned TLC 1.7.4 jar for reproducible checks');
}

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', timeout: 60000, maxBuffer: 16 * 1024 * 1024 });
  if (result.error) throw result.error;
  return { status: result.status, output: `${result.stdout || ''}${result.stderr || ''}` };
}

async function checkModels(work) {
  const results = {};
  for (const [name, broken] of [['MarketRequests', false], ['MarketRequestsBroken', true]]) {
    const modelDir = path.join(root, 'verification/market-state');
    const result = run(process.env.JAVA || 'java', [
      '-cp', toolPath, 'tlc2.TLC', '-workers', '1', '-seed', '1', '-fp', '0',
      '-metadir', path.join(work, name), '-config', path.join(modelDir, `${name}.cfg`), path.join(modelDir, `${name}.tla`),
    ]);
    if (broken) {
      assert.notEqual(result.status, 0, 'Removing the ownership guard must break the model');
      assert.match(result.output, /Invariant NoStaleDisplay is violated/, 'The negative control must fail for stale display, not a tool error');
    } else {
      assert.equal(result.status, 0, result.output);
      assert.match(result.output, /Model checking completed\. No error has been found\./);
    }
    const counts = result.output.match(/([\d,]+) states generated, ([\d,]+) distinct states found, ([\d,]+) states left on queue/);
    assert.ok(counts, 'TLC did not report completed state counts');
    results[name] = {
      outcome: broken ? 'expected invariant violation' : 'pass',
      generatedStates: Number(counts[1].replaceAll(',', '')),
      distinctStates: Number(counts[2].replaceAll(',', '')),
      remainingStates: Number(counts[3].replaceAll(',', '')),
    };
  }
  return results;
}

async function checkImplementation(work) {
  const files = ['tests/market-data-controller.test.mjs', 'tests/intraday-history.test.mjs', 'tests/market-request-ownership.test.mjs'];
  const original = run(process.execPath, ['--test', ...files]);
  assert.equal(original.status, 0, original.output);
  console.log(original.output.trim());

  const copy = path.join(work, 'actual-code-mutation');
  await mkdir(path.join(copy, 'tests'), { recursive: true });
  await cp(path.join(root, 'dist'), path.join(copy, 'dist'), { recursive: true });
  await writeFile(path.join(copy, 'package.json'), '{"type":"module"}\n');
  await cp(path.join(root, 'tests/market-request-ownership.test.mjs'), path.join(copy, 'tests/market-request-ownership.test.mjs'));
  const controllerFile = path.join(copy, 'dist/market-data-controller.js');
  const source = await readFile(controllerFile, 'utf8');
  const guarded = 'const series = prior.series || parseMarketSnapshot(await snapshot(), interval);\n        if (active !== request) return;';
  assert.equal(source.split(guarded).length, 2, 'Controller changed: review model/code correspondence and mutation selector');
  const mutated = source.replace(guarded, 'const series = prior.series || parseMarketSnapshot(await snapshot(), interval);\n        // Negative control only: revoked request can publish.');
  await writeFile(controllerFile, mutated);
  const failure = run(process.execPath, ['--test', '--test-reporter=tap', 'tests/market-request-ownership.test.mjs'], copy);
  assert.notEqual(failure.status, 0, 'The real-code regression must reject the removed ownership guard');
  assert.match(failure.output, /superseded fallback must not (replace|notify)/, 'Mutation failed for an unrelated reason');
  return { regression: 'pass', mutation: 'expected assertion failure', sourceSha256: hash(source), mutatedSourceSha256: hash(mutated) };
}

await prepareTool();
const work = await mkdtemp(path.join(tmpdir(), 'atlas-market-proof-'));
try {
  const model = await checkModels(work);
  const implementation = await checkImplementation(work);
  console.log(JSON.stringify({
    tool: { name: 'TLC', version: '1.7.4', sha256: toolSha256 },
    bounds: { requestGenerations: 3, intervals: ['1m', '5m'], property: 'NoStaleDisplay' },
    model, implementation,
    limitations: ['Bounded abstract model, not a whole-program proof', 'No pricing, numerical, history-pagination, wall-clock or liveness proof'],
  }, null, 2));
} finally {
  await rm(work, { recursive: true, force: true });
}
