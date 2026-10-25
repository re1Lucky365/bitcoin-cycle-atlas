import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const baselineCommit = '64c8207cb044d8990289c5a7d39972e21b74c240';
const jarSha256 = '936a262061c914694dfd669a543be24573c45d5aa0ff20a8b96b23d01e050e88';
const jar = process.env.TLA2TOOLS || path.join(root, 'build/formal-tools/tla2tools-1.7.4.jar');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const invariants = ['TypeOK', 'ReadyHasUsableView', 'NoHiddenPublication', 'NoStalePublication', 'NavigationSurvivesRefresh', 'ReadinessOnce'];
const failuresBeforeFix = new Set(['ReadyHasUsableView', 'NoHiddenPublication', 'NavigationSurvivesRefresh']);

async function prepareTool() {
  let bytes;
  try { bytes = await readFile(jar); }
  catch (error) {
    if (error.code !== 'ENOENT' || process.env.TLA2TOOLS) throw error;
    const response = await fetch('https://github.com/tlaplus/tlaplus/releases/download/v1.7.4/tla2tools.jar', { signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error('TLC download HTTP ' + response.status);
    bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(hash(bytes), jarSha256, 'Unexpected TLC download checksum');
    await mkdir(path.dirname(jar), { recursive: true }); await writeFile(jar, bytes);
  }
  assert.equal(hash(bytes), jarSha256, 'Use the pinned TLC 1.7.4 jar');
}

function run(command, args, env = {}) {
  const result = spawnSync(command, args, {
    cwd: root, env: { ...process.env, ...env }, encoding: 'utf8',
    timeout: 60000, maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  return { status: result.status, output: (result.stdout || '') + (result.stderr || '') };
}

async function models(work) {
  await mkdir(path.join(work, 'configs'));
  await mkdir(path.join(work, 'states'));
  const directory = path.join(root, 'verification/eth-state');
  // TLC 1.7.4 resolves an absolute spec against its own parent and can then
  // miss a configuration outside that directory. Use the fixed repository cwd.
  const source = 'verification/eth-state/EthLoad.tla';
  const config = await readFile(path.join(directory, 'EthLoad.cfg'), 'utf8');
  const variants = [
    { id: 'current', values: {}, rules: [null] },
    { id: 'baseline', values: { BootOnRender: false, RespectSuspension: false, PreserveNavigation: false }, rules: invariants },
    { id: 'unguarded-response', values: { GuardResponses: false }, rules: ['NoStalePublication'] },
    { id: 'unguarded-error', values: { GuardErrors: false }, rules: ['NoStalePublication'] },
    { id: 'hidden-render', values: { RespectSuspension: false }, rules: ['NoHiddenPublication'] },
    { id: 'lost-navigation', values: { PreserveNavigation: false }, rules: ['NavigationSurvivesRefresh'] },
  ];
  const results = {};
  for (const variant of variants) {
    let reviewed = config;
    for (const [name, enabled] of Object.entries(variant.values)) reviewed = reviewed.replace(name + ' = TRUE', name + ' = ' + (enabled ? 'TRUE' : 'FALSE'));
    assert.equal(await readFile(path.join(directory, variant.id === 'current' ? 'EthLoad.cfg' : variant.id + '.cfg'), 'utf8'), reviewed, 'Reviewed configuration drift: ' + variant.id);
    for (const invariant of variant.rules) {
      const id = invariant ? variant.id + '/' + invariant : variant.id;
      const file = path.join(work, 'configs', id.replaceAll('/', '-') + '.cfg');
      await writeFile(file, invariant ? reviewed.replace(/^INVARIANTS .*$/m, 'INVARIANT ' + invariant) : reviewed);
      const expectedFailure = variant.id === 'baseline' ? failuresBeforeFix.has(invariant) : variant.id !== 'current';
      const result = run(process.env.JAVA || 'java', ['-XX:+UseParallelGC', '-Xmx1g', '-cp', jar, 'tlc2.TLC', '-workers', '1', '-seed', '1', '-fp', '0', '-metadir', path.join(work, 'states', id.replaceAll('/', '-')), '-config', file, source]);
      if (expectedFailure) {
        assert.notEqual(result.status, 0, id + ' must expose its invariant violation');
        assert.ok(result.output.includes('Invariant ' + invariant + ' is violated'), result.output);
      } else {
        assert.equal(result.status, 0, result.output);
        assert.match(result.output, /Model checking completed\. No error has been found\./);
      }
      const counts = result.output.match(/([\d,]+) states generated, ([\d,]+) distinct states found, ([\d,]+) states left on queue/);
      assert.ok(counts, 'TLC did not finish with state counts: ' + id);
      results[id] = {
        status: expectedFailure ? 'expected invariant violation' : 'pass', invariant,
        generated: Number(counts[1].replaceAll(',', '')), distinct: Number(counts[2].replaceAll(',', '')),
        remaining: Number(counts[3].replaceAll(',', '')),
      };
      console.log(id + ': ' + results[id].status);
    }
  }
  return results;
}

function assertTestRun(result, { mutation = false } = {}) {
  // A zero exit code or a "tests" headline alone can also hide skips or a
  // wrapper that counts test files. Require actual, complete TAP case totals.
  const entries = [...result.output.matchAll(/^# (tests|pass|fail|cancelled|skipped|todo) (\d+)$/gm)];
  assert.equal(entries.length, 6, 'Missing or duplicate test summary fields\n' + result.output);
  const counts = Object.fromEntries(entries.map(([, name, value]) => [name, Number(value)]));
  assert.equal(Object.keys(counts).length, 6, 'Duplicate test summary field');
  assert.equal(counts.tests, 17, result.output);
  assert.equal(counts.cancelled, 0, result.output);
  assert.equal(counts.skipped, 0, result.output);
  assert.equal(counts.todo, 0, result.output);
  assert.equal(counts.pass + counts.fail, 17, result.output);
  assert.match(result.output, /^1\.\.17$/m, 'The complete 17-case TAP plan must run');
  if (mutation) {
    assert.notEqual(result.status, 0, result.output);
    assert.ok(counts.fail > 0, 'A deliberate mutation must fail an executed test');
  } else {
    assert.equal(result.status, 0, result.output);
    assert.equal(counts.pass, 17, result.output);
    assert.equal(counts.fail, 0, result.output);
  }
  return counts;
}

async function implementation(work) {
  const test = 'tests/eth-load-ownership.test.mjs';
  const testArgs = ['--test-reporter=tap', test];
  const original = run(process.execPath, testArgs, { ETH_VIEW_SOURCE: path.join(root, 'dist/eth-view.js') });
  const originalCounts = assertTestRun(original);
  console.log(original.output.trim());
  const source = await readFile(path.join(root, 'dist/eth-view.js'), 'utf8');
  const temporary = path.join(work, 'eth-view.js');
  const changes = [
    {
      id: 'premature-ready',
      from: 'await new Promise(resolve=>requestAnimationFrame(()=>{render();resolve();}));',
      to: "await new Promise(resolve=>requestAnimationFrame(()=>{render();resolve();}));\n  document.dispatchEvent(new CustomEvent('atlas:ready'));",
      failure: /a canceled initializer must not mark an empty restored chart ready/,
    },
    {
      id: 'hidden-render', from: 'state.frame=null;if(suspended)return;', to: 'state.frame=null;',
      failure: /a suspended initialization callback must not release the boot shell/,
    },
    {
      id: 'unguarded-archive', from: 'if(token!==generation)return;setPayload(saved);', to: 'setPayload(saved);',
      failure: /a revoked archive must not replace restored prices/,
    },
    {
      id: 'unguarded-error', from: '}catch(error){\n      if(token!==generation)return;', to: '}catch(error){',
      failure: /a revoked live failure must not taint the current status/,
    },
    {
      id: 'lost-daily-navigation',
      from: 'if(navigationToken===navigationRevision)state.range=null;\n        else if(state.range)state.range=ethHistoryRange(currentSeries(),state.span,state.range);',
      to: 'state.range=null;',
      failure: /a live refresh must preserve a newer user date range/,
    },
    {
      id: 'lost-intraday-navigation',
      from: 'if(token===generation&&force&&navigationToken===navigationRevision)', to: 'if(token===generation&&force)',
      failure: /intraday refresh must preserve newer date navigation/,
    },
    {
      id: 'untracked-navigation', from: 'onRangeChange:range=>{++navigationRevision;', to: 'onRangeChange:range=>{',
      failure: /a live refresh must preserve a newer user date range/,
    },
    {
      id: 'repeated-ready', from: 'function revealReady(){if(ready)return;', to: 'function revealReady(){',
      failure: /Expected values to be strictly deep-equal/,
    },
    {
      id: 'missing-escaper', from: 'const esc = value =>', to: 'const unusedEsc = value =>',
      failure: /the information button must not call an undefined HTML escaper/,
    },
  ];
  const mutations = {};
  try {
    for (const change of changes) {
      assert.equal(source.split(change.from).length, 2, 'Review model/code correspondence and mutation selector: ' + change.id);
      await writeFile(temporary, source.replace(change.from, change.to));
      const result = run(process.execPath, testArgs, { ETH_VIEW_SOURCE: temporary });
      assert.notEqual(result.status, 0, change.id + ' must fail its real-code regression');
      assert.match(result.output, change.failure, 'Mutation failed for an unrelated reason: ' + change.id + '\n' + result.output);
      assertTestRun(result, { mutation: true });
      mutations[change.id] = 'expected assertion failure';
    }
  } finally {
    // Never alter the working runtime; restore and exercise the scratch copy too.
    await writeFile(temporary, source);
  }
  const restored = run(process.execPath, testArgs, { ETH_VIEW_SOURCE: temporary });
  const restoredCounts = assertTestRun(restored);
  return { tests: 17, original: 'pass', restored: 'pass', originalCounts, restoredCounts, sourceSha256: hash(source), mutations };
}

await prepareTool();
const work = await mkdtemp(path.join(tmpdir(), 'atlas-eth-proof-'));
try {
  const model = await models(work), replay = await implementation(work);
  const report = {
    baselineCommit, tool: { name: 'TLC', release: '1.7.4', jarSha256 },
    bounds: { requestGenerations: 3, intervals: ['daily', 'weekly'], rangeChoices: ['auto', 'custom'] },
    model, implementation: replay,
    limitations: [
      'Finite reachable-state check, not an unbounded or whole-program proof',
      'HTTP abort can complete late; callbacks while suspended are a deliberate scheduler over-approximation',
      'Initializer replay injects import, HTTP, animation-frame, timer and DOM boundaries',
      'Intraday controller publication is covered by verify-market-state; ETH integration is replay-tested',
      'No price accuracy, causal event effect, pixel layout, browser scheduling or liveness proof',
    ],
  };
  if (process.argv[2]) await writeFile(path.resolve(process.argv[2]), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally { await rm(work, { recursive: true, force: true }); }
