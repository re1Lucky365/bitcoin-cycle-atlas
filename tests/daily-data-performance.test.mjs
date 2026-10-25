import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeDailySeries } from '../dist/daily-analytics.js';
import { bitcoinDailyAsset } from '../dist/daily-data-source.js';
import { initDailyDataView, renderMonthlyDataTable } from '../dist/daily-data-view.js';
import { dailyViewSurface } from './helpers/daily-data-view-fixture.mjs';

function dataset(offset = 0) {
  const start = Date.parse('2024-12-31T00:00:00Z');
  const prices = Array.from({ length: 500 }, (_, index) => [new Date(start + index * 86400000).toISOString().slice(0, 10), 100 + offset + index / 4 + Math.sin(index) * 4]);
  return { meta: {
    sourceName: 'Coin Metrics Community API', source: 'https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets=btc&metrics=PriceUSD',
    metric: 'PriceUSD', frequency: '1d', timezone: 'UTC', retrievedAt: new Date(start + 500 * 86400000).toISOString(),
    firstDate: prices[0][0], lastDate: prices.at(-1)[0], count: prices.length,
  }, prices };
}
const analyzed = asset => analyzeDailySeries(asset.prices, { calendar: asset.calendar, asOfDate: asset.asOfDate, symbol: asset.symbol });

test('daily paging and filtering never build a hidden monthly table', async () => {
  const source = dataset(), ui = dailyViewSurface();
  const view = initDailyDataView({ root: ui.root, getBitcoinDataset: () => source, loadAsset: async symbol => ({ ...bitcoinDailyAsset(source), symbol }) });
  view.render(); await ui.settle();
  const firstPage = ui.node('data-body').innerHTML;
  ui.click('data-next');
  assert.notEqual(ui.node('data-body').innerHTML, firstPage, 'the requested page still renders');
  ui.click('data-prev');
  assert.equal(ui.node('data-body').innerHTML, firstPage);
  ui.change('data-year', '2025'); ui.change('daily-month', '2');
  assert.ok(ui.node('data-body').innerHTML.includes('2025-02-28'));
  assert.equal(ui.node('data-result-count').textContent, '28개 관측');
  ui.click('daily-comparison-toggle'); view.render();
  assert.equal(ui.work()['daily-monthly-table']?.nonemptyWrites || 0, 0,
    'hidden monthly work must stay zero, including async asset commits and subsequent renders');
  view.destroy();
});

test('opening monthly view renders current asset, year and MDD after hidden edits', async () => {
  const source = dataset(), ui = dailyViewSurface();
  const assets = new Map(['ETH', 'MSTR', 'BMNR'].map((symbol, index) => [symbol, { ...bitcoinDailyAsset(dataset(index * 20)), symbol }]));
  const view = initDailyDataView({ root: ui.root, getBitcoinDataset: () => source, loadAsset: async symbol => assets.get(symbol) });
  view.render(); await ui.settle();
  ui.click('', { dailyDetail: 'monthly' });
  assert.equal(ui.node('daily-monthly-table').innerHTML, renderMonthlyDataTable(bitcoinDailyAsset(source), analyzed(bitcoinDailyAsset(source))));
  ui.click('', { dailyDetail: 'daily' }); ui.resetWork();
  ui.click('', { dailyAsset: 'ETH' }); ui.change('data-year', '2025'); ui.click('', { dailyMetric: 'mdd' });
  assert.equal(ui.work()['daily-monthly-table']?.nonemptyWrites || 0, 0);
  ui.click('', { dailyDetail: 'monthly' });
  assert.equal(ui.node('daily-monthly-table').innerHTML, renderMonthlyDataTable(assets.get('ETH'), analyzed(assets.get('ETH')), { metric: 'mdd', year: '2025' }));
  assert.equal(ui.node('daily-monthly-scroll').hidden, false);
  assert.equal(ui.work()['daily-monthly-table'].nonemptyWrites, 1);
  view.destroy();
});

test('a replaced BTC dataset appears when the deferred monthly table opens', async () => {
  let source = dataset(); const ui = dailyViewSurface();
  const view = initDailyDataView({ root: ui.root, getBitcoinDataset: () => source, loadAsset: async symbol => ({ ...bitcoinDailyAsset(source), symbol }) });
  view.render(); await ui.settle();
  ui.click('', { dailyDetail: 'monthly' });
  const previous = ui.node('daily-monthly-table').innerHTML;
  ui.click('', { dailyDetail: 'daily' }); ui.resetWork();
  source = dataset(500); view.render();
  assert.equal(ui.work()['daily-monthly-table']?.nonemptyWrites || 0, 0);
  ui.click('', { dailyDetail: 'monthly' });
  assert.notEqual(ui.node('daily-monthly-table').innerHTML, previous);
  assert.equal(ui.node('daily-monthly-table').innerHTML, renderMonthlyDataTable(bitcoinDailyAsset(source), analyzed(bitcoinDailyAsset(source))));
  view.destroy();
});
