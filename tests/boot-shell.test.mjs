import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
const bootMatch = html.match(/<script\b[^>]*id="atlas-boot-script"[^>]*>([\s\S]*?)<\/script>/);
const bootSource = bootMatch?.[1];
const earlyMatch = html.match(/<script\b[^>]*id="atlas-boot-resource-script"[^>]*>([\s\S]*?)<\/script>/);
const firstStylesheet = html.search(/<link\b[^>]*rel="stylesheet"/);

// This fixture supplies only the event and attribute APIs used by the real
// inline bootstrap. Browser layout and module loading are separate checks.
class ElementFixture extends EventTarget {
  constructor(attributes = '') {
    super();
    this.attributes = new Map([...attributes.matchAll(/([^\s=]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s]+)))?/g)]
      .map(([, name, double, single, bare]) => [name, double ?? single ?? bare ?? '']));
    this.dataset = new Proxy({}, {
      get: (_, key) => this.getAttribute(`data-${String(key).replace(/[A-Z]/g, char => `-${char.toLowerCase()}`)}`) ?? undefined,
      set: (_, key, value) => { this.setAttribute(`data-${String(key).replace(/[A-Z]/g, char => `-${char.toLowerCase()}`)}`, value); return true; },
    });
  }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }
  hasAttribute(name) { return this.attributes.has(name); }
  get hidden() { return this.hasAttribute('hidden'); }
  set hidden(value) { if (value) this.setAttribute('hidden', ''); else this.removeAttribute('hidden'); }
  get inert() { return this.hasAttribute('inert'); }
  set inert(value) { if (value) this.setAttribute('inert', ''); else this.removeAttribute('inert'); }
  click() { this.dispatchEvent(new Event('click')); }
}

function bootstrap({ earlyErrors = [] } = {}) {
  assert.ok(bootSource, 'The initial HTML must include its boot controller before the app module graph loads');
  const tags = [...html.matchAll(/<([a-z][\w:-]*)\b([^<>]*)>/gi)];
  const byId = new Map(), positions = new Map();
  const content = [];
  let root;
  for (const match of tags) {
    const [, tag, attributes] = match;
    const node = new ElementFixture(attributes);
    positions.set(node, match.index);
    node.tagName = tag.toUpperCase();
    if (tag === 'html') root = node;
    if (node.hasAttribute('id')) {
      byId.set(node.getAttribute('id'), node);
    }
    if (node.hasAttribute('data-boot-content')) {
      content.push(node);
    }
  }
  assert.ok(root);
  const window = new EventTarget(), document = new EventTarget();
  document.documentElement = root;
  let parsingPosition = 0;
  document.getElementById = id => {
    const node = byId.get(id);
    return node && positions.get(node) < parsingPosition ? node : null;
  };
  document.querySelectorAll = selector => {
    assert.equal(selector, '[data-boot-content]', 'The boot controller must only touch its designated content roots');
    return content.filter(node => positions.get(node) < parsingPosition);
  };
  let reloads = 0;
  const location = { reload() { reloads += 1; } };
  window.location = location;
  window.document = document;
  const emit = (type, target = document) => target.dispatchEvent(new Event(type));
  const resourceError = target => {
    const event = new Event('error');
    // A browser captures this on window while retaining the resource's target.
    Object.defineProperty(event, 'target', { value: target });
    window.dispatchEvent(event);
  };
  const context = { window, document, location, Event, console };
  // Preceding stylesheets may fail before the body script is allowed to run.
  // Respect source order and do not expose DOM nodes the parser has not reached.
  const steps = [
    { position: firstStylesheet, run: () => earlyErrors.forEach(resourceError) },
    { position: bootMatch.index, run: () => runInNewContext(bootSource, context, { filename: 'atlas-boot-script', timeout: 1000 }) },
  ];
  if (earlyMatch) steps.push({ position: earlyMatch.index, run: () => runInNewContext(earlyMatch[1], context, { filename: 'atlas-boot-resource-script', timeout: 1000 }) });
  for (const step of steps.sort((a, b) => a.position - b.position)) {
    parsingPosition = step.position;
    step.run();
  }
  parsingPosition = Infinity;
  return { root, window, document, content, byId, emit, resourceError, reloads: () => reloads };
}

test('the initial HTML provides a visible loading status while unfinished controls stay inert', () => {
  const { root, content, byId, emit, window } = bootstrap();
  assert.equal(root.dataset.boot, 'loading');
  for (const name of ['atlas-sidebar', 'workspace']) {
    assert.ok(content.some(node => (node.getAttribute('class') ?? '').split(/\s+/).includes(name)),
      `${name} must be gated before module evaluation`);
  }
  assert.ok(content.every(node => node.inert && node.getAttribute('aria-hidden') === 'true'));
  assert.equal(byId.get('atlas-boot-shell').hidden, false);
  assert.equal(byId.get('atlas-boot-status').getAttribute('role'), 'status');
  assert.equal(byId.get('atlas-boot-status').getAttribute('aria-busy'), 'true');
  assert.equal(byId.get('atlas-boot-error').hidden, true);
  emit('DOMContentLoaded');
  emit('load', window);
  assert.equal(root.dataset.boot, 'loading', 'Document load alone cannot prove the requested page has rendered');
  assert.ok(content.every(node => node.inert));
});

test('render readiness releases the real workspace once and later errors cannot resurrect the skeleton', () => {
  const { root, content, byId, emit, window } = bootstrap();
  emit('atlas:ready');
  assert.equal(root.dataset.boot, 'ready');
  assert.equal(byId.get('atlas-boot-shell').hidden, true);
  assert.ok(content.every(node => !node.inert && !node.hasAttribute('aria-hidden')));
  for (const type of ['atlas:ready', 'atlas:boot-error']) emit(type);
  for (const type of ['error', 'unhandledrejection']) emit(type, window);
  assert.equal(root.dataset.boot, 'ready');
  assert.equal(byId.get('atlas-boot-shell').hidden, true);
  assert.ok(content.every(node => !node.inert));
});

test('startup failures expose accessible recovery and a late ready event cannot reveal a broken page', () => {
  for (const type of ['atlas:boot-error', 'error', 'unhandledrejection']) {
    const { root, content, byId, emit, window, reloads } = bootstrap();
    emit(type, type === 'atlas:boot-error' ? undefined : window);
    assert.equal(root.dataset.boot, 'error', type);
    assert.equal(byId.get('atlas-boot-shell').hidden, false);
    assert.equal(byId.get('atlas-boot-status').getAttribute('aria-busy'), 'false');
    assert.equal(byId.get('atlas-boot-error').hidden, false);
    assert.equal(byId.get('atlas-boot-error').getAttribute('role'), 'alert');
    assert.ok(content.every(node => node.inert));
    emit('atlas:ready');
    assert.equal(root.dataset.boot, 'error', 'A failed boot requires a fresh load');
    assert.ok(content.every(node => node.inert));
    byId.get('atlas-boot-retry').click();
    assert.equal(reloads(), 1, 'Recovery remains actionable while the app workspace is inert');
  }
});

test('optional resource failures do not abort boot while script and stylesheet failures do', () => {
  for (const resource of [{ tagName: 'IMG' }, { tagName: 'LINK', rel: 'icon' }, { tagName: 'LINK', rel: 'preload' }]) {
    const { root, byId, emit, resourceError } = bootstrap();
    resourceError(resource);
    assert.equal(root.dataset.boot, 'loading', `${resource.tagName} ${resource.rel ?? ''} is not required to initialize the app`);
    assert.equal(byId.get('atlas-boot-error').hidden, true);
    emit('atlas:ready');
    assert.equal(root.dataset.boot, 'ready', 'A harmless resource failure must not prevent the completed page from opening');
  }
  for (const resource of [{ tagName: 'SCRIPT', type: 'module' }, { tagName: 'LINK', rel: 'stylesheet' }]) {
    const { root, byId, resourceError } = bootstrap();
    resourceError(resource);
    assert.equal(root.dataset.boot, 'error', `${resource.tagName} ${resource.rel ?? resource.type} is required to initialize the app`);
    assert.equal(byId.get('atlas-boot-error').hidden, false);
  }
});

test('stylesheet failure during head parsing reaches recovery while early icon failure remains optional', () => {
  const failed = bootstrap({ earlyErrors: [{ tagName: 'LINK', rel: 'stylesheet' }] });
  assert.equal(failed.root.dataset.boot, 'error', 'A failed head stylesheet must survive the later body-controller handoff');
  assert.equal(failed.byId.get('atlas-boot-error').hidden, false);
  assert.ok(failed.content.every(node => node.inert));
  failed.emit('atlas:ready');
  assert.equal(failed.root.dataset.boot, 'error', 'Later rendering cannot override the recorded stylesheet failure');
  failed.byId.get('atlas-boot-retry').click();
  assert.equal(failed.reloads(), 1);

  const optional = bootstrap({ earlyErrors: [{ tagName: 'LINK', rel: 'icon' }, { tagName: 'LINK', rel: 'preload' }] });
  assert.equal(optional.root.dataset.boot, 'loading');
  optional.emit('atlas:ready');
  assert.equal(optional.root.dataset.boot, 'ready');
});
