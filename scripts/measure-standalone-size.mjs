import { readFile, writeFile, mkdir, mkdtemp, cp, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { standaloneModuleMap } from './standalone-modules.mjs';
import { verifyStandaloneArtifact } from './standalone-verification.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [baseline = '7e90d01bda8552cd68db688542c9ebb8e9bb7085', output = resolve(root, 'docs/data/standalone-size-2026-10-24.json')] = process.argv.slice(2);
assert(/^[a-f\d]{40}$/.test(baseline), 'Baseline must be an exact commit SHA');
const run = promisify(execFile);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const temporary = await mkdtemp(resolve(tmpdir(), 'atlas-standalone-size-'));
try {
  const {stdout:oldBuilder} = await run('git', ['show', baseline + ':scripts/build-standalone.mjs'], {cwd:root});
  assert(oldBuilder.includes('async function inlineModule'), 'Expected recursive baseline builder');
  await mkdir(resolve(temporary, 'scripts'));
  await cp(resolve(root, 'dist'), resolve(temporary, 'dist'), {recursive:true});
  await writeFile(resolve(temporary, 'scripts/build-standalone.mjs'), oldBuilder);
  const bundle = await standaloneModuleMap(resolve(root, 'dist'));
  const index = await readFile(resolve(root, 'dist/index.html'), 'utf8');
  const inputs = [...new Set([
    'index.html', 'favicon.svg',
    ...Object.keys(bundle.imports).map(id => id.slice('@atlas/'.length)),
    ...[...index.matchAll(/<link rel="stylesheet" href="\.\/([^"?]+)(?:\?[^"\s]*)?">/g)].map(match => match[1]),
    ...['btc-daily', 'btc-ohlc', 'btc-volume', 'eth-ohlc', 'mstr-ohlc', 'bmnr-ohlc'].map(file => 'data/' + file + '.json'),
  ])].sort();
  const inputFiles = [];
  for (const file of inputs) {
    const content = await readFile(resolve(root, 'dist', file));
    assert.deepEqual(await readFile(resolve(temporary, 'dist', file)), content);
    inputFiles.push({file, bytes:content.length, sha256:sha256(content)});
  }
  const samples = [];
  let verification;
  for (let pair = 1; pair <= 5; pair++) {
    for (const side of ['before', 'after']) {
      const file = resolve(temporary, side + '.html');
      const script = resolve(side === 'before' ? temporary : root, 'scripts/build-standalone.mjs');
      const {stdout} = await run(process.execPath, [script, file], {cwd:root});
      const result = JSON.parse(stdout);
      const content = await readFile(file);
      assert.equal(result.bytes, content.length);
      assert.equal(result.modules, Object.keys(bundle.imports).length);
      if (side === 'after') verification = await verifyStandaloneArtifact(content.toString('utf8'), resolve(root, 'dist'));
      samples.push({pair, side, bytes:content.length, sha256:sha256(content), modules:result.modules, embeddedObservations:result.embeddedObservations});
    }
  }
  for (const side of ['before', 'after']) {
    assert.equal(new Set(samples.filter(sample => sample.side === side).map(sample => sample.sha256)).size, 1, `Nondeterministic ${side} artifact`);
  }
  const code = {};
  for (const file of ['scripts/build-standalone.mjs', 'scripts/standalone-modules.mjs', 'scripts/module-references.mjs', 'scripts/standalone-verification.mjs']) {
    code[file] = sha256(await readFile(resolve(root, file)));
  }
  const report = {
    scope:'Deterministic uncompressed HTML byte size; no browser load-time or memory claim.',
    baselineBuilderCommit:baseline,
    baselineBuilderSha256:sha256(oldBuilder),
    node:process.version,
    repetitionsPerSide:5,
    order:'before, after, repeated five times',
    failures:0,
    beforeBytes:samples[0].bytes,
    afterBytes:samples[1].bytes,
    reductionFraction:1 - samples[1].bytes / samples[0].bytes,
    verification,
    codeSha256:code,
    inputFiles,
    samples,
  };
  await mkdir(dirname(resolve(output)), {recursive:true});
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({output:resolve(output), beforeBytes:report.beforeBytes, afterBytes:report.afterBytes, reductionFraction:report.reductionFraction, failures:report.failures, verification}));
} finally {
  await rm(temporary, {recursive:true, force:true});
}
