import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, dirname, relative, sep } from 'node:path';
import { javascriptModuleReferences, javascriptModuleSpecifiers } from './module-references.mjs';

export async function verifyStandaloneArtifact(html, dist) {
  const maps = [...html.matchAll(/<script\b[^>]*type=["']importmap["'][^>]*>([\s\S]*?)<\/script>/gi)];
  assert.equal(maps.length, 1, 'Standalone requires exactly one import map');
  const map = JSON.parse(maps[0][1]);
  assert.deepEqual(Object.keys(map), ['imports'], 'Unexpected standalone import map configuration');
  const imports = map.imports;
  assert(imports && typeof imports === 'object' && !Array.isArray(imports), 'Invalid standalone imports');
  const entryScripts = [...html.matchAll(/<script\b[^>]*type=["']module["'][^>]*>([\s\S]*?)<\/script>/gi)];
  assert.equal(entryScripts.length, 1, 'Standalone requires one module entry');
  assert(maps[0].index < entryScripts[0].index, 'Import map must precede module entry');
  assert.equal(entryScripts[0][1].trim(), 'import "@atlas/site-entry.js";', 'Unexpected standalone entry');
  assert(Object.hasOwn(imports, '@atlas/site-entry.js'), 'Missing standalone entry module');
  const directory = resolve(dist), graph = new Map();
  let sourceBytes = 0, rewrittenBytes = 0;
  for (const [id, url] of Object.entries(imports)) {
    assert(id.startsWith('@atlas/'), `Unexpected module ID: ${id}`);
    const file = resolve(directory, id.slice('@atlas/'.length));
    assert(file.startsWith(directory + sep), `Embedded module escapes dist: ${id}`);
    assert.equal('@atlas/' + relative(directory, file).split(sep).join('/'), id, `Noncanonical module ID: ${id}`);
    assert(typeof url === 'string' && url.startsWith('data:text/javascript;base64,'), `Missing module data URL: ${id}`);
    const encoded = url.slice('data:text/javascript;base64,'.length);
    const bytes = Buffer.from(encoded, 'base64');
    assert.equal(bytes.toString('base64'), encoded, `Invalid module base64: ${id}`);
    const embedded = bytes.toString('utf8'), original = await readFile(file, 'utf8');
    const before = javascriptModuleReferences(original), after = javascriptModuleReferences(embedded);
    assert.equal(after.length, before.length, `Changed module edge count: ${id}`);
    let originalStart = 0, embeddedStart = 0;
    const targets = [];
    for (let index = 0; index < before.length; index++) {
      const source = before[index], packaged = after[index];
      assert.equal(embedded.slice(embeddedStart, packaged.start), original.slice(originalStart, source.start), `Changed module source: ${id}`);
      assert(/^\.\.?\//.test(source.specifier), `Nonlocal original module: ${id}`);
      const targetFile = resolve(dirname(file), source.specifier.split(/[?#]/)[0]);
      assert(targetFile.startsWith(directory + sep), `Module edge escapes dist: ${id}`);
      const target = '@atlas/' + relative(directory, targetFile).split(sep).join('/');
      assert.equal(packaged.specifier, target, `Changed module target: ${id}`);
      assert(Object.hasOwn(imports, target), `Unmapped module: ${target}`);
      targets.push(target);
      originalStart = source.end;
      embeddedStart = packaged.end;
    }
    assert.equal(embedded.slice(embeddedStart), original.slice(originalStart), `Changed module source tail: ${id}`);
    graph.set(id, targets);
    sourceBytes += Buffer.byteLength(original);
    rewrittenBytes += bytes.length;
  }
  const visited = new Set();
  function visit(id) {
    if (visited.has(id)) return;
    visited.add(id);
    for (const target of graph.get(id)) visit(target);
  }
  for (const entry of javascriptModuleSpecifiers(entryScripts[0][1])) visit(entry);
  assert.equal(visited.size, graph.size, 'Standalone includes unreachable modules');
  const snapshots = {
    btc:'btc-daily.json', ohlc:'btc-ohlc.json', volume:'btc-volume.json',
    eth:'eth-ohlc.json', mstr:'mstr-ohlc.json', bmnr:'bmnr-ohlc.json',
    'asset-comparison':'asset-comparison.json',
  };
  for (const [id, file] of Object.entries(snapshots)) {
    const scripts = [...html.matchAll(new RegExp(`<script\\b[^>]*id=["']embedded-${id}-data["'][^>]*>([\\s\\S]*?)<\\/script>`, 'gi'))];
    assert.equal(scripts.length, 1, `Missing or repeated snapshot: ${id}`);
    assert.deepEqual(JSON.parse(scripts[0][1]), JSON.parse(await readFile(resolve(directory, 'data', file), 'utf8')), `Changed embedded snapshot: ${id}`);
  }
  const index = await readFile(resolve(directory, 'index.html'), 'utf8');
  const stylesheets = [...index.matchAll(/<link rel="stylesheet" href="\.\/([^"?]+)(?:\?[^"\s]*)?">/g)];
  for (const [, file] of stylesheets) {
    const css = (await readFile(resolve(directory, file), 'utf8')).replace(/@import\s+url\(\s*(?:"[^"]*"|'[^']*'|[^)]*)\s*\)\s*;/g, '');
    assert(html.includes(`<style>\n${css}\n</style>`), `Missing or changed stylesheet: ${file}`);
  }
  const favicon = (await readFile(resolve(directory, 'favicon.svg'))).toString('base64');
  assert(html.includes(`href="data:image/svg+xml;base64,${favicon}"`), 'Changed embedded favicon');
  return {modules:graph.size, edges:[...graph.values()].reduce((count, targets) => count + targets.length, 0), sourceBytes, rewrittenBytes, snapshots:Object.keys(snapshots).length, stylesheets:stylesheets.length};
}
