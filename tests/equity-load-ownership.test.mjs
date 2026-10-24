import assert from 'node:assert/strict';
import test from 'node:test';
import { equityPayload, equityViewFixture } from './helpers/equity-view-fixture.mjs';

async function complete(fixture, symbol, offset, revision) {
  fixture.reply(offset, equityPayload(symbol, revision)); await fixture.microtasks();
  fixture.reply(offset + 1, { revision }); await fixture.settle();
}

for (const symbol of ['MSTR', 'BMNR']) {
  test(`${symbol} releases the usable observed chart before the coin response or projection`, { timeout: 2000 }, async () => {
    const f = await equityViewFixture(symbol);
    assert.equal(f.document.documentElement.dataset.boot, 'loading');
    assert.equal(f.app.inert, true);
    f.reply(0, equityPayload(symbol, 1)); await f.microtasks(); await f.frame();
    assert.equal(f.requests.length, 2, 'coin request is still pending');
    assert.equal(f.calculations.length, 0);
    assert.equal(f.latest().forecast, null);
    assert.equal(f.document.documentElement.dataset.boot, 'ready', 'a completed observed render must release the boot shell');
    assert.equal(f.app.inert, false, 'observed chart controls must be usable while the coin archive is pending');
    assert.equal(f.app.getAttribute('aria-hidden'), undefined);
    assert.match(f.status(), /계산 중/, 'forecast status must remain pending after observed readiness');
    f.scenario('bull'); await f.frame();
    f.reply(1, { revision: 1 }); await f.settle(); await f.initialization;
    assert.equal(f.latest().forecast.scenario, 'bull');
    f.hide(); f.show(); await f.settle();
    assert.deepEqual(f.events, ['atlas:ready'], 'projection completion and cache restoration must not repeat readiness');
  });

  test(`${symbol} shows an actionable price failure and opens a requested source view once`, { timeout: 2000 }, async () => {
    const f = await equityViewFixture(symbol, { query: '&article=fixture-article&article-view=source' });
    f.reject(0); await f.settle(); await f.initialization;
    assert.equal(f.document.documentElement.dataset.boot, 'ready');
    assert.equal(f.app.inert, false);
    assert.equal(f.app.querySelector('#equity-empty button').hidden, false);
    assert.deepEqual(f.articles, [{ id: 'fixture-article', view: 'source' }]);
    f.reload(); await complete(f, symbol, 1, 2);
    assert.deepEqual(f.events, ['atlas:ready']);
    assert.equal(f.articles.length, 1, 'retry must not reopen an initial deep link');
  });

  test(`${symbol} cannot release or render a suspended document before restoration`, { timeout: 2000 }, async () => {
    const f = await equityViewFixture(symbol);
    f.hide(); f.reply(0, equityPayload(symbol, 1)); await f.settle(); await f.initialization;
    assert.equal(f.document.documentElement.dataset.boot, 'loading');
    assert.equal(f.draws.length, 0);
    assert.deepEqual(f.events, []);
    f.show(); await complete(f, symbol, 1, 2);
    assert.equal(f.document.documentElement.dataset.boot, 'ready');
    assert.equal(f.app.inert, false);
  });

  test(`${symbol} does not reveal loaded prices after leaving before their first render`, { timeout: 2000 }, async () => {
    const f = await equityViewFixture(symbol);
    f.reply(0, equityPayload(symbol, 1)); await f.microtasks();
    f.hide(); f.reject(1); await f.settle(); await f.initialization;
    assert.equal(f.document.documentElement.dataset.boot, 'loading', 'a hidden initialization callback must not release the boot shell');
    assert.equal(f.draws.length, 0, 'a suspended document must not render retained prices');
    assert.deepEqual(f.events, []);
    f.show(); await complete(f, symbol, 2, 2);
    assert.equal(f.document.documentElement.dataset.boot, 'ready');
  });

  for (const lateFailure of [false, true]) {
    test(`${symbol} ignores revoked stock replies, success or failure=${lateFailure}`, { timeout: 2000 }, async () => {
      const f = await equityViewFixture(symbol);
      f.hide(); f.show(); f.show();
      assert.equal(f.requests.length, 2, 'repeated restore must not duplicate the current request');
      await complete(f, symbol, 1, 2);
      const displayed = f.latest();
      if (lateFailure) f.reject(0); else f.reply(0, equityPayload(symbol, 1));
      await f.settle();
      assert.equal(f.requests.length, 3, 'a revoked stock response must not request a coin archive');
      assert.equal(f.calculations.length, 1, 'a revoked stock response must not calculate');
      assert.equal(f.latest().forecast, displayed.forecast, 'revoked stock work must not replace the current forecast');
      assert.doesNotMatch(f.status(), /실패/);
      await f.initialization;
    });

    test(`${symbol} ignores revoked underlying replies, success or failure=${lateFailure}`, { timeout: 2000 }, async () => {
      const f = await equityViewFixture(symbol);
      f.reply(0, equityPayload(symbol, 1)); await f.microtasks();
      assert.equal(f.requests.length, 2);
      f.hide(); f.show(); f.show();
      await complete(f, symbol, 2, 2);
      const displayed = f.latest();
      if (lateFailure) f.reject(1); else f.reply(1, { revision: 1 });
      await f.settle(); await f.initialization;
      assert.deepEqual(f.calculations, [{ priceRevision: 2, assetRevision: 2 }], 'revoked underlying work must not calculate');
      assert.equal(f.latest().forecast, displayed.forecast, 'revoked underlying work must not clear a newer forecast');
      assert.doesNotMatch(f.status(), /확인 필요|실패/);
    });
  }

  for (const completedPaints of [0, 1]) {
    test(`${symbol} cancels projection after ${completedPaints} paint yields`, { timeout: 2000 }, async () => {
      const f = await equityViewFixture(symbol);
      f.reply(0, equityPayload(symbol, 1)); await f.microtasks();
      f.reply(1, { revision: 1 }); await f.microtasks();
      if (completedPaints) await f.frame();
      f.hide(); f.show();
      await complete(f, symbol, 2, 2); await f.initialization;
      assert.deepEqual(f.calculations, [{ priceRevision: 2, assetRevision: 2 }], 'revoked paint continuation must not calculate with a stale underlying archive');
      assert.equal(f.latest().forecast.priceRevision, 2);
      assert.equal(f.latest().forecast.assetRevision, 2);
    });
  }

  test(`${symbol} invalidates the previous projection when refreshed stock prices publish`, { timeout: 2000 }, async () => {
    const f = await equityViewFixture(symbol);
    await complete(f, symbol, 0, 1); await f.initialization;
    assert.equal(f.latest().forecast.priceRevision, 1);
    f.reload(); f.reload();
    assert.equal(f.requests.length, 3, 'a second click must not start overlapping refreshes');
    f.reply(2, equityPayload(symbol, 2)); await f.microtasks(); await f.frame();
    assert.equal(f.latest().series.candles[0].close, 103);
    assert.equal(f.latest().forecast, null, 'new prices must never be displayed with the previous projection');
    f.reply(3, { revision: 2 }); await f.settle();
    assert.equal(f.latest().forecast.priceRevision, 2);
  });

  test(`${symbol} preserves user interval, scenario and range while the projection is pending`, { timeout: 2000 }, async () => {
    const f = await equityViewFixture(symbol);
    f.reply(0, equityPayload(symbol, 1)); await f.microtasks(); await f.frame();
    f.interval('weekly'); f.scenario('bull'); await f.frame();
    const range = { ...f.latest().range, start: 1791849600, end: 1801440000 };
    f.pan(range);
    f.reply(1, { revision: 1 }); await f.settle(); await f.initialization;
    assert.equal(f.latest().series.interval, 'weekly');
    assert.equal(f.latest().forecast.scenario, 'bull');
    assert.equal(f.latest().range.start, range.start);
    assert.equal(f.latest().range.end, range.end);
    assert.equal(f.calculations.length, 1);
  });

  test(`${symbol} keeps observed prices after coin failure and recovers on retry`, { timeout: 2000 }, async () => {
    const f = await equityViewFixture(symbol);
    f.reply(0, equityPayload(symbol, 1)); await f.microtasks();
    f.reject(1, 'Coin archive unavailable'); await f.settle(); await f.initialization;
    assert.equal(f.latest().series.candles[0].close, 102);
    assert.equal(f.latest().forecast, null);
    assert.match(f.forecastDialog(), /Coin archive unavailable/);
    f.reload(); await complete(f, symbol, 2, 2);
    assert.equal(f.latest().forecast.assetRevision, 2);
    assert.doesNotMatch(f.status(), /확인 필요|실패/);
  });

  test(`${symbol} keeps observed prices when projection rejects inputs and a retry can recover`, { timeout: 2000 }, async () => {
    const f = await equityViewFixture(symbol);
    f.reply(0, equityPayload(symbol, 1)); await f.microtasks();
    f.reply(1, { revision: 1, fail: true }); await f.settle(); await f.initialization;
    assert.equal(f.latest().series.candles[0].close, 102);
    assert.equal(f.latest().forecast, null);
    assert.match(f.forecastDialog(), /Model inputs rejected/);
    f.reload(); await complete(f, symbol, 2, 2);
    assert.equal(f.latest().forecast.assetRevision, 2);
    assert.doesNotMatch(f.status(), /확인 필요|실패/);
  });
}
