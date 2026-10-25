import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

class NodeBoundary {
  constructor(id = '') {
    this.id = id; this.attrs = new Map(); this.dataset = {}; this.nodes = new Map(); this.listeners = new Map();
    this.innerHTML = ''; this.textContent = ''; this.style = { setProperty() {} };
    this.classList = { add() {}, remove() {}, toggle() {} }; this.clientWidth = 1280; this.clientHeight = 720;
    this.parentElement = { style: { setProperty() {} } };
  }
  setAttribute(key, value) { this.attrs.set(key, String(value)); }
  removeAttribute(key) { this.attrs.delete(key); }
  getAttribute(key) { return this.attrs.get(key); }
  querySelector(selector) { if (!this.nodes.has(selector)) this.nodes.set(selector, new NodeBoundary(selector)); return this.nodes.get(selector); }
  querySelectorAll(selector) { return selector === 'text' ? [0, 1, 2, 3].map(index => this.querySelector(`text-${index}`)) : []; }
  addEventListener(name, fn) { if (!this.listeners.has(name)) this.listeners.set(name, []); this.listeners.get(name).push(fn); }
  removeEventListener() {}
  dispatchEvent(event) { for (const fn of this.listeners.get(event.type) || []) fn(event); }
  append(node) { this.nodes.set(node.id || `child-${this.nodes.size}`, node); }
  insertBefore(node) { this.append(node); }
  contains() { return false; }
  focus() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: 1280, height: 720 }; }
}

/** Actual controller/analysis/SVG renderer; browser navigation/dialog mounts are inert. */
export async function structureViewFixture({ root = fileURLToPath(new URL('../../', import.meta.url)) } = {}) {
  const document = new NodeBoundary('document'), window = new NodeBoundary('window');
  document.body = new NodeBoundary('body'); document.documentElement = new NodeBoundary('html');
  document.createElement = () => new NodeBoundary(); document.getElementById = () => null;
  window.matchMedia = () => ({ matches: false, addEventListener() {} });
  const frequencies = ['daily', 'weekly'].map(frequency => { const button = new NodeBoundary(); button.dataset.structureFrequency = frequency; return button; });
  document.querySelectorAll = selector => selector === '[data-structure-frequency]' ? frequencies : [];
  const source = await readFile(path.join(root, 'dist/lab-view.js'), 'utf8'), deps = {};
  const imports = [...source.matchAll(/^import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["'];?\s*$/gm)];
  for (const [, names, specifier] of imports) {
    const imported = await import(new URL(specifier, pathToFileURL(path.join(root, 'dist/lab-view.js'))).href);
    for (const item of names.split(',')) { const [name, alias = name] = item.trim().split(/\s+as\s+/); deps[alias] = imported[name]; }
  }
  const mounts = () => ({ cancel() {}, cancelPending() {}, destroy() {}, update() {}, refresh() {}, open() {}, toolbar: new NodeBoundary() });
  Object.assign(deps, {
    mountResearchAnnotationsWorkbench: mounts, mountChartTouchTracking: mounts, mountChartExportWorkbench: mounts,
    bindChartNavigation: () => ({ ...mounts(), cancelGesture() {}, resumeTouchGesture() {} }),
    createMarketDataController: () => ({ cancel() {}, get() { return { status: 'idle' }; } }),
  });
  const calls = { rolling: 0, directional: 0, analysis: 0, chart: 0 }, draws = [], errors = [], frames = [];
  for (const [name, key] of [['computeRollingStates', 'rolling'], ['detectDirectionalChanges', 'directional'], ['analyzeMarketStructure', 'analysis'], ['drawChart', 'chart']]) {
    const original = deps[name]; deps[name] = (...args) => {
      calls[key]++; if (key === 'chart') draws.push(args[0]); return original(...args);
    };
  }
  // Change only import binding syntax so calls can be counted. Bodies stay exact.
  const transformed = source.replace(/^import\s*\{([^}]+)\}\s*from\s*["'][^"']+["'];?\s*$/gm, (_, names) => names.split(',').map(item => {
    const [name, alias = name] = item.trim().split(/\s+as\s+/); return `const ${alias}=__deps.${alias};`;
  }).join('\n')).replace('export function initLabView', 'function initLabView');
  const context = vm.createContext({
    __deps: deps, document, window, URLSearchParams, URL, Date, Intl, AbortSignal, location: { search: '' },
    console: { error: (...values) => errors.push(values.map(value => value?.stack || String(value)).join(' ')) },
    queueMicrotask, CustomEvent: class { constructor(type, options = {}) { this.type = type; Object.assign(this, options); } },
    ResizeObserver: class { observe() {} }, requestAnimationFrame: fn => frames.push(fn),
  });
  vm.runInContext(`${transformed}\nglobalThis.start=initLabView;`, context);
  const view = context.start(), node = id => document.querySelector(`#${id}`);
  const flush = () => {
    for (let iteration = 0; frames.length; iteration++) {
      assert.ok(iteration < 10, 'The controller must settle without a render loop');
      for (const callback of frames.splice(0)) callback();
    }
    assert.deepEqual(errors, [], 'A fast failed render is not a successful measurement');
  };
  return {
    view, calls, draws, errors, flush, node,
    change(id, value) { node(id).onchange({ target: { value } }); flush(); },
    frequency(value) { frequencies.find(button => button.dataset.structureFrequency === value).onclick(); flush(); },
    setDataset(dataset) { view.setDataset(dataset); flush(); },
    showCompare(value = true) { view.showCompare(value); flush(); },
    snapshot() {
      return Object.fromEntries([...document.nodes].filter(([key]) => key.startsWith('#structure-')).sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, { markup: item.innerHTML, text: item.textContent, dataset: item.dataset }]));
    },
  };
}
