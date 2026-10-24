import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { javascriptModuleSpecifiers } from '../scripts/module-references.mjs';

const run = promisify(execFile);
const backtick = String.fromCharCode(96);
const interpolation = '$' + '{';

test('source titles, quoted examples, comments and regexp bodies are not imports', () => {
  const source = [
    'const title = "Trump exempts smartphones, computers from \'reciprocal\' tariffs";',
    'const example = "import \'./missing-example.js\'";',
    "const escaped = 'Don\\'t import \"missing-quoted-package\"';",
    '// import "./missing-line-comment.js";',
    '/* export * from "missing-block-comment"; */',
    'const expression = /from \'missing-regexp\'|import\\(\'missing-regexp\'\\)/g;',
    'const template = ' + backtick + 'from "missing-template"; import("./missing-template.js")' + backtick + ';',
    'const object = { from: "missing-property", import: value => value };',
    'object.import("./not-a-module.js");',
    'object?.import("./also-not-a-module.js");',
    'import "./real.js";',
  ].join('\n');
  assert.deepEqual(javascriptModuleSpecifiers(source), ['./real.js']);
});

test('all static import and re-export forms retain their literal specifiers across comments and line breaks', () => {
  const source = [
    'import "./side-effect.js";',
    'import value from "./default.js";',
    'import { value, "hyphen-name" as named } /* from "comment" */ from "./named.js";',
    'import value, { other } from "./mixed.js";',
    'import * as namespace from "./namespace.js";',
    'import value, * as otherNamespace from "./mixed-namespace.js";',
    'import /* explanation */',
    ' value',
    ' from',
    ' "./multiline.js";',
    'export { value } from "./reexport.js";',
    'export * from "./all.js";',
    'export * as namespaceExport from "./export-namespace.js";',
    'export const label = "from \'not-a-module\'";',
  ].join('\n');
  assert.deepEqual(javascriptModuleSpecifiers(source), [
    './side-effect.js', './default.js', './named.js', './mixed.js',
    './namespace.js', './mixed-namespace.js', './multiline.js',
    './reexport.js', './all.js', './export-namespace.js',
  ]);
});

test('dynamic literals inside code and template expressions are checked, while computed URLs are not guessed', () => {
  const source = [
    'const a = import /* comment */ ( /* comment */ "./lazy.js" );',
    'const b = import("./data.json", { with: { type: "json" } });',
    'const c = ' + backtick + 'literal import("./not-code.js") ' + interpolation + 'import("./in-template.js")}' + backtick + ';',
    'const d = ' + backtick + interpolation + '({ value: ' + backtick + 'nested ' + interpolation + 'import("./nested.js")}' + backtick + ' }).value}' + backtick + ';',
    'const metadata = import.meta.url;',
    'const computed = import(prefix + "/computed.js");',
    'const suffixed = import("./computed/" + name);',
  ].join('\n');
  assert.deepEqual(javascriptModuleSpecifiers(source), ['./lazy.js', './data.json', './in-template.js', './nested.js']);
});

test('escaped module strings resolve to the browser-visible path', () => {
  const source = [
    'import "\\x2e\\x2fhex.js";',
    'export * from "\\u002e/\\u{75}nicode.js";',
    'import("./with\\\'quote.js");',
    'import "./line\\\ncontinuation.js";',
  ].join('\n');
  assert.deepEqual(javascriptModuleSpecifiers(source), ['./hex.js', './unicode.js', "./with'quote.js", './linecontinuation.js']);
});

test('declaration regexp bodies stay opaque while division after function and class expressions retains imports', () => {
  for (const source of [
    'class C {} /import(".\\/ghost.js")/.test(""); import("./real.js");',
    'function f() {} /import(".\\/ghost.js")/.test(""); import("./real.js");',
    'const f = function() {} / import("./real.js");',
    'const C = class {} / import("./real.js");',
    'const object = {} / import("./real.js");',
    'if (true) /import(".\\/ghost.js")/.test(""); import("./real.js");',
  ]) {
    assert.doesNotThrow(() => new Function(source), 'Fixture must be valid JavaScript');
    assert.deepEqual(javascriptModuleSpecifiers(source), ['./real.js'], source);
  }
});

test('the real generated event catalog no longer acquires a reciprocal bare import', async () => {
  const source = await readFile(new URL('../dist/ethereum-events.js', import.meta.url), 'utf8');
  assert.match(source, /from 'reciprocal' tariffs/);
  assert.deepEqual(javascriptModuleSpecifiers(source), []);
});

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'atlas-static-references-'));
  t.after(() => rm(root, {recursive:true, force:true}));
  await mkdir(path.join(root, 'scripts'));
  await mkdir(path.join(root, 'dist'));
  for (const name of ['verify-static.mjs', 'module-references.mjs']) {
    await cp(new URL('../scripts/' + name, import.meta.url), path.join(root, 'scripts', name));
  }
  await writeFile(path.join(root, 'package.json'), '{"type":"module"}');
  await writeFile(path.join(root, 'dist', 'index.html'), '<script type="module" src="./site-entry.js"></script>');
  await writeFile(path.join(root, 'dist', 'dependency.js'), 'export default 1; export const value = 2;');
  return {
    async verify(source) {
      await writeFile(path.join(root, 'dist', 'site-entry.js'), source);
      return run(process.execPath, ['scripts/verify-static.mjs'], {cwd:root, timeout:15000});
    },
  };
}

test('the unchanged Pages resource validator accepts real relative imports and ignores citation prose', async t => {
  const app = await fixture(t);
  await app.verify([
    'import value from "./dependency.js?v=1";',
    'export { value } from "./dependency.js#reexport";',
    'void import(/* eager validation of a literal */ "./dependency.js");',
    'const title = "Trump exempts smartphones from \'reciprocal\' tariffs";',
    '/* import "not-a-package"; */',
  ].join('\n'));
});

test('the unchanged Pages resource validator still rejects bare, root, escaping and missing module paths', async t => {
  const app = await fixture(t);
  for (const [source, expected] of [
    ['import value from "missing-package";', /Unbundled bare import/],
    ['import "/dependency.js";', /Root-absolute resource breaks project Pages/],
    ['export * from "../outside.js";', /Resource escapes Pages base path/],
    ['import { value } from "./missing.js";', /Missing static resource/],
    ['void import("./missing-dynamic.js");', /Missing static resource/],
    ['export { value } from "./missing-reexport.js";', /Missing static resource/],
    ['import "\\x2fdependency.js";', /Root-absolute resource breaks project Pages/],
  ]) {
    await assert.rejects(app.verify(source), error => expected.test(error.stderr), source);
  }
});
