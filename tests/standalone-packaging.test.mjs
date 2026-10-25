import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { standaloneModuleMap } from '../scripts/standalone-modules.mjs';
import { verifyStandaloneArtifact } from '../scripts/standalone-verification.mjs';
import { javascriptModuleReferences, javascriptModuleSpecifiers } from '../scripts/module-references.mjs';

const run = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtime = resolve(root, 'tests/helpers/standalone-runtime.mjs');
const decode = url => Buffer.from(url.slice('data:text/javascript;base64,'.length), 'base64').toString('utf8');

async function fixture(t, files) {
  const directory = await mkdtemp(resolve(tmpdir(), 'atlas-standalone-'));
  t.after(() => rm(directory, {recursive:true, force:true}));
  for (const [name, source] of Object.entries(files)) {
    await mkdir(dirname(resolve(directory, name)), {recursive:true});
    await writeFile(resolve(directory, name), source);
  }
  return directory;
}

test('module references include exact quoted source spans without changing the existing string API', () => {
  const source = `/* import './ghost.js'; */
import value from /* note */ "\\x2e/real.js?v=1";
const example = 'export * from "./ghost.js"';
const lazy = import('./lazy.js');`;
  const references = javascriptModuleReferences(source);
  assert.deepEqual(references.map(reference => reference.specifier), javascriptModuleSpecifiers(source));
  assert.deepEqual(references.map(({start, end}) => source.slice(start, end)), ['"\\x2e/real.js?v=1"', "'./lazy.js'"]);
});

test('a shared dependency is encoded once and version/hash aliases keep the existing snapshot identity', async t => {
  const directory = await fixture(t, {
    'site-entry.js':'import "./left.js"; import "./right.js";',
    'left.js':'export * from "./shared.js?v=1";',
    'right.js':'export * from "./shared.js?v=2#alias";',
    'shared.js':'export const value = 42;',
  });
  const bundle = await standaloneModuleMap(directory);
  assert.equal(Object.keys(bundle.imports).length, 4);
  for (const id of ['@atlas/left.js', '@atlas/right.js']) {
    assert.deepEqual(javascriptModuleSpecifiers(decode(bundle.imports[id])), ['@atlas/shared.js']);
    assert(!decode(bundle.imports[id]).includes('data:text/javascript;base64,'));
  }
  assert.deepEqual(await standaloneModuleMap(directory), bundle);
});

test('source prose, comments, regexps and template text are untouched while literal imports are rewritten', async t => {
  const source = [
    `const title = "from './not-a-module.js'";`,
    `// import('./ghost.js');`,
    `const regexp = /import\('ghost'\)/;`,
    'const template = `import("./not-code.js") ${import("./real.js")}`;',
    `import /* comment */ './real.js';`,
    `export * from './real.js';`,
  ].join('\n');
  const directory = await fixture(t, {'site-entry.js':source, 'real.js':'export const value = 1;'});
  const bundle = await standaloneModuleMap(directory);
  const rewritten = decode(bundle.imports[bundle.entry]);
  assert.equal(rewritten, source.replace('import("./real.js")', 'import("@atlas/real.js")')
    .replace("import /* comment */ './real.js'", 'import /* comment */ "@atlas/real.js"')
    .replace("export * from './real.js'", 'export * from "@atlas/real.js"'));
  assert.equal(Object.keys(bundle.imports).length, 2);
});

test('real module evaluation preserves cycles, side effects, re-exports, shared instances and dynamic import', async t => {
  const directory = await fixture(t, {
    'site-entry.js':[
      'import "./shared.js?v=1";',
      'import {marker} from "./shared.js?v=2";',
      'import {value} from "./reexport.js";',
      'import {readCycle} from "./cycle-a.js";',
      'const lazy = await import("./lazy.js");',
      'globalThis.result = {count:globalThis.count, shared:marker === lazy.marker, value, cycle:readCycle()};',
    ].join('\n'),
    'shared.js':'globalThis.count = (globalThis.count || 0) + 1; export const marker = {}; export const value = 42;',
    'reexport.js':'export {value} from "./shared.js";',
    'lazy.js':'export {marker} from "./shared.js#lazy";',
    'cycle-a.js':'import {readB} from "./cycle-b.js"; export const a = "a"; export const readCycle = () => a + readB();',
    'cycle-b.js':'import {a} from "./cycle-a.js"; export const readB = () => "b" + a;',
  });
  const bundle = await standaloneModuleMap(directory);
  const file = resolve(directory, 'bundle.json');
  await writeFile(file, JSON.stringify(bundle));
  const {stdout} = await run(process.execPath, ['--experimental-vm-modules', runtime, 'fixture', file]);
  assert.deepEqual(JSON.parse(stdout), {modules:6, result:{count:1, shared:true, value:42, cycle:'aba'}});
});

test('outside, missing and nonlocal module dependencies stop packaging', async t => {
  const directory = await fixture(t, {'site-entry.js':''});
  for (const [specifier, expected] of [
    ['../outside.js', /Module outside dist/],
    ['https://example.com/library.js', /requires a relative module/],
    ['package', /requires a relative module/],
    ['./missing.js', /ENOENT/],
  ]) {
    await writeFile(resolve(directory, 'site-entry.js'), `import ${JSON.stringify(specifier)};`);
    await assert.rejects(standaloneModuleMap(directory), expected);
  }
});

test('the real standalone is deterministic, preserves every module and snapshot, and passes the runtime parser/linker', async t => {
  const directory = await fixture(t, {});
  const first = resolve(directory, 'first.html'), second = resolve(directory, 'second.html');
  const builder = resolve(root, 'scripts/build-standalone.mjs');
  await run(process.execPath, [builder, first]);
  await run(process.execPath, [builder, second]);
  const html = await readFile(first, 'utf8');
  assert.equal(await readFile(second, 'utf8'), html);
  const verification = await verifyStandaloneArtifact(html, resolve(root, 'dist'));
  const bundle = await standaloneModuleMap(resolve(root, 'dist'));
  assert.equal(verification.modules, Object.keys(bundle.imports).length);
  assert.equal(verification.snapshots, 6);
  assert.equal(verification.stylesheets, 23);
  const {stdout} = await run(process.execPath, ['--experimental-vm-modules', runtime, 'artifact', first]);
  assert.deepEqual(JSON.parse(stdout), {modules:verification.modules, parsed:true, linked:true});
  const mapMatch = html.match(/<script type="importmap">([\s\S]*?)<\/script>/);
  const map = JSON.parse(mapMatch[1]);
  const changed = structuredClone(map);
  delete changed.imports['@atlas/cycle-engine.js'];
  await assert.rejects(verifyStandaloneArtifact(html.replace(mapMatch[1], JSON.stringify(changed)), resolve(root, 'dist')), /Unmapped module/);
  const damaged = structuredClone(map);
  damaged.imports['@atlas/cycle-engine.js'] = 'data:text/javascript;base64,' + Buffer.from(decode(damaged.imports['@atlas/cycle-engine.js']) + '\n// corruption').toString('base64');
  await assert.rejects(verifyStandaloneArtifact(html.replace(mapMatch[1], JSON.stringify(damaged)), resolve(root, 'dist')), /Changed module source/);
  const dataMatch = html.match(/(<script id="embedded-btc-data" type="application\/json">)([\s\S]*?)(<\/script>)/);
  const data = JSON.parse(dataMatch[2]);
  data.prices[0][1] += 1;
  await assert.rejects(verifyStandaloneArtifact(html.replace(dataMatch[0], dataMatch[1] + JSON.stringify(data) + dataMatch[3]), resolve(root, 'dist')), /Changed embedded snapshot/);
  await assert.rejects(verifyStandaloneArtifact(html.replace(mapMatch[0], ''), resolve(root, 'dist')), /exactly one import map/);
});
