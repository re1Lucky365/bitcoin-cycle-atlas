import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SourceTextModule, createContext } from 'node:vm';

const [mode, file] = process.argv.slice(2);
const input = await readFile(file, 'utf8');
const bundle = mode === 'artifact' ? {
  entry:'@atlas/site-entry.js',
  ...JSON.parse(input.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]),
} : JSON.parse(input);
const context = createContext({});
const modules = new Map();
for (const [id, url] of Object.entries(bundle.imports)) {
  const source = Buffer.from(url.slice('data:text/javascript;base64,'.length), 'base64').toString('utf8');
  modules.set(id, new SourceTextModule(source, {
    identifier:id,
    context,
    importModuleDynamically: async specifier => {
      const imported = resolve(specifier);
      if (imported.status === 'unlinked') await imported.link(resolve);
      if (imported.status === 'linked') await imported.evaluate();
      return imported;
    },
  }));
}
function resolve(specifier) {
  assert(modules.has(specifier), `Runtime import is unmapped: ${specifier}`);
  return modules.get(specifier);
}
if (mode === 'fixture') {
  const entry = resolve(bundle.entry);
  await entry.link(resolve);
  await entry.evaluate();
  console.log(JSON.stringify({modules:modules.size, result:context.result}));
} else {
  for (const module of modules.values()) if (module.status === 'unlinked') await module.link(resolve);
  console.log(JSON.stringify({modules:modules.size, parsed:true, linked:true}));
}
