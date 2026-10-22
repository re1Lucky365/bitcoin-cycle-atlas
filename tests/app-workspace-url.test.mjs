import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../dist/app.js', import.meta.url), 'utf8');
const persistSource = source.slice(source.indexOf('function persistUrl() {'), source.indexOf("document.documentElement.dataset.theme = 'dark';"));
const initialStateSource = source.slice(source.indexOf('const params = new URLSearchParams(location.search);'), source.indexOf('let toastTimer;'));

function appUrl(search = '', overrides = {}) {
  const location = { pathname: '/bitcoin-cycle-atlas/', search }, writes = [];
  const context = { location, URLSearchParams, Set, history: { replaceState(_state, _unused, path) { writes.push(path);location.search = path.includes('?') ? path.slice(path.indexOf('?')) : ''; } } };
  const state = runInNewContext(`${initialStateSource}\nstate;`, context);
  Object.assign(state, overrides);context.state = state;
  runInNewContext(persistSource, context);
  return { state, location, writes, persist() { context.persistUrl();return new URLSearchParams(location.search); } };
}

test('page navigation preserves the current atlas viewport, primary indicator, and unit', () => {
  const query = '?granularity=daily&type=candles&axis=linear&unit=indexed&view-start=2023-01-01&view-end=2028-12-31&indicator-primary=range&indicators=volume,range&assumption=stress';
  const h = appUrl(query);
  h.state.unit = 'rebased'; // The hidden comparison view owns a different unit.
  for (const page of ['data', 'evidence', 'outlook']) {
    h.state.view = page;
    const next = h.persist();
    for (const [key, value] of new URLSearchParams(query)) assert.equal(next.get(key), value, `${page}: ${key}`);
    assert.equal(next.get('page'), page === 'outlook' ? null : page);
  }
});

test('a stale comparison preference cannot resurrect indexed units after the atlas switches to USD', () => {
  const h = appUrl('?unit=indexed');
  h.state.unit = 'indexed';
  h.location.search = '?granularity=1m&view-start=1792497600&view-end=1792498800&indicator-primary=volume';
  for (const page of ['data', 'evidence', 'outlook']) {
    h.state.view = page;
    const next = h.persist();
    assert.equal(next.has('unit'), false);
    assert.equal(next.get('view-start'), '1792497600');
    assert.equal(next.get('view-end'), '1792498800');
    assert.equal(next.get('indicator-primary'), 'volume');
  }
});

test('legacy comparison links remain readable and comparison units never overwrite atlas units', () => {
  const old = appUrl('?page=compare&legacy=1&unit=indexed');
  assert.equal(old.state.view, 'compare');assert.equal(old.state.unit, 'indexed');
  old.state.unit = 'rebased';
  let next = old.persist();
  assert.equal(next.get('unit'), 'indexed', 'atlas unit remains independently encoded');
  assert.equal(next.get('compare-unit'), 'rebased', 'explicit comparison reset overrides legacy fallback');
  assert.equal(appUrl(`?${next}`).state.unit, 'rebased');
  old.state.view = 'data';old.persist();old.state.view = 'outlook';next = old.persist();
  assert.equal(next.get('unit'), 'indexed');
  assert.equal(next.get('compare-unit'), 'rebased');
  assert.equal(appUrl('?page=compare&legacy=1&compare-unit=indexed').state.unit, 'indexed');
  assert.equal(appUrl('?unit=indexed').state.unit, 'rebased', 'an atlas-only link does not choose legacy normalization');
});

test('owned comparison defaults are removed while unrelated chart parameters survive', () => {
  const h = appUrl('?page=data&mode=top&scale=linear&range=730&day=45&hide=2012&baseline=all3&analysis=peak&zone=0.9&future=analogues&scenario=calendar-48m&indicator-primary=volume&chart-extra=kept');
  Object.assign(h.state, { view: 'outlook', mode: 'halving', unit: 'rebased', scale: 'log', horizon: '1461', cursor: null, hidden: new Set(), timingBaseline: 'recent2', analysisView: 'forecast', peakThreshold: .95, forecastView: 'macro', forecastScenario: 'bottom-holds' });
  const next = h.persist();
  for (const key of ['page', 'mode', 'scale', 'range', 'day', 'hide', 'baseline', 'analysis', 'zone', 'future', 'scenario']) assert.equal(next.has(key), false, key);
  assert.equal(next.get('indicator-primary'), 'volume');
  assert.equal(next.get('chart-extra'), 'kept');
  assert.equal(h.persist().toString(), next.toString(), 'persistence is idempotent');
});
