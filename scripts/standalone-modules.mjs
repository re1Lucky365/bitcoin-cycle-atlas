import { readFile } from 'node:fs/promises';
import { resolve, dirname, relative, sep } from 'node:path';
import { javascriptModuleReferences } from './module-references.mjs';

export const STANDALONE_MODULE_PREFIX = '@atlas/';
export const JAVASCRIPT_DATA_PREFIX = 'data:text/javascript;base64,';

export async function standaloneModuleMap(dist, entry = 'site-entry.js') {
  const directory = resolve(dist), modules = new Map();
  const moduleId = file => STANDALONE_MODULE_PREFIX + relative(directory, file).split(sep).join('/');
  function localModule(specifier, importer) {
    if (!/^\.\.?\//.test(specifier)) throw new Error(`Standalone requires a relative module: ${specifier}`);
    // An offline snapshot has one version of each file, as in the previous builder.
    const file = resolve(dirname(importer), specifier.split(/[?#]/)[0]);
    if (!file.startsWith(directory + sep)) throw new Error(`Module outside dist: ${specifier}`);
    return file;
  }
  async function visit(file) {
    if (modules.has(file)) return;
    const source = await readFile(file, 'utf8');
    const references = javascriptModuleReferences(source);
    modules.set(file, {source, references});
    for (const reference of references) {
      reference.target = localModule(reference.specifier, file);
      await visit(reference.target);
    }
  }
  const entryFile = localModule('./' + entry, resolve(directory, 'index.html'));
  await visit(entryFile);
  const imports = {};
  for (const [file, {source, references}] of modules) {
    let rewritten = source;
    for (const reference of references.toReversed()) {
      rewritten = rewritten.slice(0, reference.start) + JSON.stringify(moduleId(reference.target)) + rewritten.slice(reference.end);
    }
    imports[moduleId(file)] = JAVASCRIPT_DATA_PREFIX + Buffer.from(rewritten).toString('base64');
  }
  return {entry:moduleId(entryFile), imports};
}
