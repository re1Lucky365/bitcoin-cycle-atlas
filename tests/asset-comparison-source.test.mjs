import test from 'node:test';
import assert from 'node:assert/strict';
import { createAssetComparisonLoader } from '../dist/asset-comparison-source.js';

test('concurrent renders share a request while an explicit later refresh reads a new snapshot', async () => {
  let calls = 0, finish;
  const load = createAssetComparisonLoader({ fetchImpl: (url, options) => {
    assert.equal(url, './data/asset-comparison.json');
    assert.equal(options.cache, 'no-cache');
    assert(options.signal instanceof AbortSignal);
    calls++;
    return new Promise(resolve => { finish = resolve; });
  } });
  const first = load(), same = load();
  assert.equal(first, same);
  await Promise.resolve();
  assert.equal(calls, 1);
  finish({ok: true, json: async () => ({version: 1, retrievedAt: 'first'})});
  assert.equal((await first).retrievedAt, 'first');
  const next = load();
  await Promise.resolve();
  assert.equal(calls, 2);
  finish({ok: true, json: async () => ({version: 1, retrievedAt: 'next'})});
  assert.equal((await next).retrievedAt, 'next');
});

test('HTTP failure can be retried without reusing the rejected promise', async () => {
  let calls = 0;
  const load = createAssetComparisonLoader({fetchImpl: async () => ++calls === 1
    ? {ok: false, status: 503}
    : {ok: true, json: async () => ({version: 1})}});
  await assert.rejects(load(), /503/);
  assert.deepEqual(await load(), {version: 1});
  assert.equal(calls, 2);
});

test('standalone uses the embedded snapshot without any network request', async () => {
  const bundle = {version: 1, assets: [{symbol: 'SPY', prices: [['2026-01-02', 100]]}]};
  const load = createAssetComparisonLoader({
    embeddedData: () => JSON.stringify(bundle),
    fetchImpl: () => { throw new Error('offline network must not be called'); },
  });
  assert.deepEqual(await load(), bundle);
  assert.deepEqual(await load(), bundle);
});

test('a corrupt embedded snapshot fails without silently fetching unrelated replacement data', async () => {
  let fetches = 0;
  const load = createAssetComparisonLoader({embeddedData: () => '{bad', fetchImpl: () => { fetches++; }});
  await assert.rejects(load(), SyntaxError);
  await assert.rejects(load(), SyntaxError);
  assert.equal(fetches, 0);
});
