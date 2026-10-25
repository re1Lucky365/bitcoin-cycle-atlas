import assert from 'node:assert/strict';
import test from 'node:test';
import { ethPayload, ethViewFixture } from './helpers/eth-view-fixture.mjs';

async function loaded(options) {
  const fixture = await ethViewFixture(options);
  fixture.reply(0, ethPayload()); await fixture.settle(); await fixture.initialization;
  return fixture;
}

test('ETH reveals a rendered observed chart exactly once', async () => {
  const f = await loaded();
  assert.equal(f.document.documentElement.dataset.boot, 'ready');
  assert.equal(f.app.inert, false); assert.equal(f.latest().series.candles.at(-1).close, 102);
  f.hide(); f.show(); await f.settle();
  assert.deepEqual(f.events, ['atlas:ready']);
});

test('ETH initial failure reveals its actionable retry and a retry can recover', async () => {
  const f = await ethViewFixture(); f.reject(0); await f.settle(); await f.initialization;
  assert.equal(f.document.documentElement.dataset.boot, 'ready');
  assert.equal(f.app.querySelector('#eth-empty button').hidden, false);
  assert.match(f.status(), /실패/);
  f.refresh(); f.reply(1, ethPayload(2)); await f.microtasks();
  f.replyLive(0, ethPayload(3)); await f.settle();
  assert.equal(f.latest().series.candles.at(-1).close, 104);
  assert.deepEqual(f.events, ['atlas:ready']);
});

test('ETH canceled initialization cannot release the shell before restored data is usable', async () => {
  const f = await ethViewFixture();
  f.hide(); f.reject(0, 'Aborted'); await f.microtasks(); f.show(); await f.settle();
  assert.equal(f.document.documentElement.dataset.boot, 'loading', 'a canceled initializer must not mark an empty restored chart ready');
  assert.deepEqual(f.events, []); assert.equal(f.draws.length, 0);
  f.reply(1, ethPayload(2)); await f.settle(); await f.initialization;
  assert.equal(f.document.documentElement.dataset.boot, 'ready'); assert.equal(f.app.inert, false);
});

test('ETH hidden initialization and late resize cannot publish retained prices', async () => {
  const f = await ethViewFixture();
  f.reply(0, ethPayload()); await f.microtasks(); f.hide(); f.resize(); await f.settle(); await f.initialization;
  assert.equal(f.document.documentElement.dataset.boot, 'loading', 'a suspended initialization callback must not release the boot shell');
  assert.equal(f.draws.length, 0, 'a suspended view must not draw retained prices');
  f.show(); await f.settle();
  assert.equal(f.document.documentElement.dataset.boot, 'ready'); assert.equal(f.draws.length, 1);
});

test('ETH shortest hidden-layout counterexample does not update an empty suspended page', async () => {
  const f = await ethViewFixture();
  f.hide(); f.resize(); await f.frame();
  assert.equal(f.status(), '', 'a suspended layout callback must not publish loading status');
  assert.deepEqual(f.events, []);
  f.reject(0); await f.settle(); await f.initialization;
});

test('ETH shortest revoked-initializer counterexample cannot release a suspended empty page', async () => {
  const f = await ethViewFixture();
  f.hide(); f.reply(0, ethPayload()); await f.settle(); await f.initialization;
  assert.equal(f.document.documentElement.dataset.boot, 'loading', 'a revoked initializer must not release an empty suspended page');
  assert.deepEqual(f.events, []); assert.equal(f.draws.length, 0);
  f.show(); f.reply(1, ethPayload(2)); await f.settle();
  assert.equal(f.document.documentElement.dataset.boot, 'ready');
});

for (const fail of [false, true]) {
  test(`ETH revoked archive ${fail ? 'failure' : 'success'} cannot replace the restored chart`, async () => {
    const f = await ethViewFixture(); f.hide(); f.show();
    f.reply(1, ethPayload(2)); await f.settle();
    if (fail) f.reject(0); else f.reply(0, ethPayload(1));
    await f.settle(); await f.initialization;
    assert.equal(f.latest().series.candles.at(-1).close, 103, 'a revoked archive must not replace restored prices');
    assert.doesNotMatch(f.status(), /실패/);
    assert.deepEqual(f.events, ['atlas:ready'], 'a revoked initializer must not repeat readiness');
  });
  test(`ETH revoked live ${fail ? 'failure' : 'success'} cannot replace a newer refresh`, async () => {
    const f = await loaded(); f.refresh(); f.hide(); f.show(); f.refresh();
    f.replyLive(1, ethPayload(3)); await f.settle();
    if (fail) f.rejectLive(0); else f.replyLive(0, ethPayload(2));
    await f.microtasks(); f.resize(); await f.settle();
    assert.equal(f.latest().series.candles.at(-1).close, 104, 'a revoked live response must not replace current prices');
    assert.doesNotMatch(f.status(), /실패/, 'a revoked live failure must not taint the current status');
  });
}

test('ETH refresh failure retains valid observed prices and is recoverable', async () => {
  const f = await loaded(); const before = f.latest().series;
  f.refresh(); f.rejectLive(0); await f.settle();
  assert.equal(f.latest().series, before); assert.match(f.status(), /실패/);
  f.refresh(); f.replyLive(1, ethPayload(2)); await f.settle();
  assert.equal(f.latest().series.candles.at(-1).close, 103); assert.doesNotMatch(f.status(), /실패/);
});

test('ETH accepts consecutive refresh clicks before disabled is painted and the latest request wins', async () => {
  const f = await loaded();
  const button = f.app.querySelector('[data-eth-action="refresh"]');
  assert.equal(button.disabled, false); f.refresh();
  assert.equal(button.disabled, false, 'disabled is painted by a later frame');
  f.refresh();
  assert.equal(f.liveRequests.length, 2, 'production accepts two refreshes before a frame');
  assert.equal(f.liveRequests[0].options.signal.aborted, true);
  f.replyLive(1, ethPayload(3)); await f.settle();
  f.replyLive(0, ethPayload(2)); await f.settle();
  assert.equal(f.latest().series.candles.at(-1).close, 104, 'latest refresh wins when prior response arrives after abort');
  assert.doesNotMatch(f.status(), /실패/);
});

test('ETH refresh preserves a date range chosen while its request was pending', async () => {
  const f = await loaded(); f.refresh();
  const custom = { ...f.latest().range, start: f.latest().range.start + 86400 * 10, end: f.latest().range.end - 86400 * 10 };
  f.pan(custom); await f.frame(); f.replyLive(0, ethPayload(2)); await f.settle();
  assert.equal(f.latest().range.start, custom.start, 'a live refresh must preserve a newer user date range');
  assert.equal(f.latest().range.end, custom.end);
});

test('ETH data information opens with its escaped original-data link', async () => {
  const f = await loaded({ pathname: '/atlas-"quote&path' });
  let dialog;
  assert.doesNotThrow(() => { dialog = f.info(); }, 'the information button must not call an undefined HTML escaper');
  assert.equal(dialog.open, true);
  assert.match(dialog.querySelector('#eth-data-content').innerHTML, /href="\/atlas-&quot;quote&amp;path\?page=data&amp;data-asset=ETH"/);
});

test('ETH intraday force refresh preserves later date and price navigation through the real controller', async () => {
  const f = await loaded(); f.interval('1h'); await f.settle();
  assert.equal(f.latest().series.interval, '1h'); f.refresh(); await f.microtasks();
  const custom = { ...f.latest().range, start: f.latest().range.start + 3600 * 8 };
  const priceDomain = { min: 80, max: 130 };
  f.pan(custom); f.priceRange(priceDomain); await f.frame();
  f.replyCandles(1); await f.settle();
  assert.equal(f.latest().range.start, custom.start, 'intraday refresh must preserve newer date navigation');
  assert.equal(f.latest().priceDomain, priceDomain, 'intraday refresh must preserve newer price navigation');
  assert.equal(f.latest().series.interval, '1h'); assert.equal(f.latest().series.candles.at(-1).close, 103);
});

test('ETH switching interval revokes the real intraday force refresh without resetting its new range', async () => {
  const f = await loaded(); f.interval('1h'); await f.settle(); f.refresh(); await f.microtasks();
  f.interval('weekly'); await f.settle();
  const before = f.latest(); f.replyCandles(1); await f.settle();
  assert.equal(f.latest().series.interval, 'weekly');
  assert.equal(f.latest().range, before.range, 'a superseded intraday refresh must not reset the weekly range');
  assert.equal(f.latest().priceDomain, before.priceDomain);
  assert.doesNotMatch(f.status(), /실패/);
});

test('ETH weekly refresh preserves the later preset and updated observation bounds', async () => {
  const f = await loaded(); f.interval('weekly'); await f.settle(); f.refresh();
  f.span('1m'); await f.frame(); const selected = f.latest().range;
  f.replyLive(0, ethPayload(2)); await f.settle();
  assert.equal(f.latest().series.interval, 'weekly'); assert.equal(f.latest().range.step, 7 * 86400);
  assert.equal(f.latest().range.start, selected.start); assert.equal(f.latest().range.end, selected.end);
  assert.match(f.latest().range.contextKey, /weekly:2026-10-24T02/);
});
