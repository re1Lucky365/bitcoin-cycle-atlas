import assert from 'node:assert/strict';
import test from 'node:test';
import { mountMobileWorkspace } from '../dist/mobile-workspace.js';

// Event/focus boundary for the shipped controller. Native modal inertness and
// CSS geometry are intentionally outside this fixture.
class Surface {
  listeners = new Map();
  addEventListener(type, handler) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(handler); }
  removeEventListener(type, handler) { this.listeners.get(type)?.delete(handler); }
  dispatchEvent(event) { for (const handler of this.listeners.get(event.type) || []) { handler(event); if (event.immediateStopped) break; } return !event.defaultPrevented; }
}
class Element extends Surface {
  constructor(tag, doc) { super(); this.tagName = tag; this.ownerDocument = doc; this.children = []; this.dataset = {}; this.attributes = new Map(); this.hidden = false; this.isConnected = true; }
  append(...nodes) { for (const node of nodes) { node.parentElement = this; this.children.push(node); } }
  prepend(node) { node.parentElement = this; this.children.unshift(node); }
  setAttribute(key, value) { this.attributes.set(key, value); }
  getAttribute(key) { return this.attributes.get(key); }
  focus() { this.ownerDocument.activeElement = this; }
  click() { this.onclick?.(); }
  remove() { this.isConnected = false; if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(node => node !== this); }
  getClientRects() { return this.hidden ? [] : [{}]; }
  matches(selector) {
    if (selector === 'dialog[open]') return this.tagName === 'dialog' && this.open;
    if (selector.startsWith('.')) return this.className?.split(' ').includes(selector.slice(1));
    if (selector.startsWith('#')) return this.id === selector.slice(1);
    return this.tagName === 'button' && !this.disabled && !(selector.includes(':not(.atlas-brand)') && this.className === 'atlas-brand');
  }
  closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector); }
  querySelectorAll(selector) { return this.children.flatMap(node => node instanceof Element ? [...(node.matches(selector) ? [node] : []), ...node.querySelectorAll(selector)] : []); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}
function fixture() {
  const doc = new Surface(), media = new Surface(); media.matches = true;
  doc.defaultView = { matchMedia: () => media }; doc.createElement = tag => new Element(tag, doc); doc.createTextNode = value => ({ textContent: value });
  doc.body = doc.createElement('body'); doc.querySelector = selector => doc.body.querySelector(selector); doc.getElementById = id => doc.querySelector(`#${id}`);
  const add = (parent, tag, className) => { const node = doc.createElement(tag); node.className = className; parent.append(node); return node; };
  const sidebar = add(doc.body, 'aside', 'atlas-sidebar'); add(sidebar, 'button', 'atlas-brand'); add(sidebar, 'button', 'tool');
  const workspace = add(doc.body, 'main', 'workspace'), stage = add(workspace, 'section', 'stage'); add(stage, 'header', 'atlas-canvas-heading');
  const plot = add(stage, 'div', 'plot'), rail = add(workspace, 'aside', 'workbench-rail'); add(rail, 'button', 'reader-control');
  const reader = add(doc.body, 'aside', 'reader'); reader.hidden = true;
  const controller = mountMobileWorkspace({ workspace, stage, plot, reader, closeReader() { reader.hidden = true; } });
  const modal = add(doc.body, 'dialog', 'modal'); modal.open = true; const input = add(modal, 'input', 'modal-input');
  return { doc, sidebar, rail, controller, input, toggle: kind => doc.getElementById(`mobile-${kind}-toggle`), tray: kind => kind === 'tools' ? sidebar : rail };
}
function key(doc, target, value) {
  const event = { type: 'keydown', key: value, target, defaultPrevented: false, immediateStopped: false, preventDefault() { this.defaultPrevented = true; }, stopImmediatePropagation() { this.immediateStopped = true; } };
  doc.dispatchEvent(event); return event;
}

test('opening a modal releases either mobile tray without restoring focus over the dialog', () => {
  for (const kind of ['tools', 'details']) {
    const f = fixture(); f.toggle(kind).click(); f.input.focus();
    assert.equal(f.tray(kind).dataset.mobileOpen, 'true');
    f.doc.dispatchEvent({ type: 'atlas:modal-open', detail: { id: 'workspace-dialog' } });
    assert.equal(f.tray(kind).dataset.mobileOpen, undefined);
    assert.equal(f.toggle(kind).getAttribute('aria-expanded'), 'false');
    assert.equal(f.doc.activeElement, f.input, 'tray teardown cannot steal the dialog focus');
    for (const name of ['Tab', 'Escape']) { const event = key(f.doc, f.input, name); assert.equal(event.defaultPrevented, false); assert.equal(event.immediateStopped, false); }
    f.controller.destroy();
  }
});

test('a modal key has priority even when its opener omitted the modal-open notification', () => {
  for (const kind of ['tools', 'details']) for (const name of ['Tab', 'Escape']) {
    const f = fixture(); f.toggle(kind).click(); f.input.focus();
    const event = key(f.doc, f.input, name);
    assert.equal(f.tray(kind).dataset.mobileOpen, undefined, `${kind} is released before ${name}`);
    assert.equal(f.doc.activeElement, f.input);
    assert.equal(event.defaultPrevented, false, `${name} reaches the active modal`);
    assert.equal(event.immediateStopped, false);
    f.controller.destroy();
  }
});

test('ordinary tray Escape keeps its existing dismissal and opener focus', () => {
  for (const kind of ['tools', 'details']) {
    const f = fixture(); f.toggle(kind).click();
    const event = key(f.doc, f.doc.activeElement, 'Escape');
    assert.equal(f.tray(kind).dataset.mobileOpen, undefined);
    assert.equal(f.doc.activeElement, f.toggle(kind));
    assert.equal(event.defaultPrevented, true); assert.equal(event.immediateStopped, true);
    f.controller.destroy();
  }
});
