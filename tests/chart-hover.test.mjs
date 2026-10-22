import assert from 'node:assert/strict';
import test from 'node:test';
import { clearChartHover, coalescedChartHover } from '../dist/chart-hover.js';

function frameFixture() {
  const frames = new Map(); let next = 1;
  const view = { requestAnimationFrame(callback) { const id = next++; frames.set(id, callback); return id; }, cancelAnimationFrame(id) { frames.delete(id); } };
  return { element: { ownerDocument: { defaultView: view } }, frames, flush() { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback()); } };
}

test('many pointer events use one frame and the latest coordinates', () => {
  const fixture = frameFixture(), observed = [];
  const handle = coalescedChartHover(fixture.element, event => observed.push(event.clientX));
  for (let i = 0; i < 100; i++) handle({ clientX: i });
  assert.equal(fixture.frames.size, 1); assert.deepEqual(observed, []);
  fixture.flush(); assert.deepEqual(observed, [99]);
  handle({ clientX: 101 }); fixture.flush(); assert.deepEqual(observed, [99, 101]);
});

test('pointer leave or click cancellation prevents an old hover overriding the pinned point', () => {
  const fixture = frameFixture(), observed = [];
  const handle = coalescedChartHover(fixture.element, event => observed.push(event.id));
  handle({ id: 'hover' }); handle.cancel(); fixture.flush(); assert.deepEqual(observed, []);
  handle({ id: 'returned' }); fixture.flush(); assert.deepEqual(observed, ['returned']);
});

test('redraw invalidates queued and retained handlers from the previous viewport', () => {
  const fixture = frameFixture(), observed = [];
  const old = coalescedChartHover(fixture.element, () => observed.push('old'));
  old({}); const saved = [...fixture.frames.values()][0];
  const current = coalescedChartHover(fixture.element, () => observed.push('current'));
  old({}); saved(); current({}); fixture.flush(); assert.deepEqual(observed, ['current']);
  current({}); clearChartHover(fixture.element); fixture.flush(); assert.deepEqual(observed, ['current']);
});

test('non-browser chart fixtures stay synchronous without global timer requirements', () => {
  const element = {}, observed = [];
  const handle = coalescedChartHover(element, event => observed.push(event));
  handle(42); assert.deepEqual(observed, [42]);
  clearChartHover(element); handle(43); assert.deepEqual(observed, [42]);
});
