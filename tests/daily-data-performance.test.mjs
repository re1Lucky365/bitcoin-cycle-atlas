import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildAssetComparison } from '../dist/asset-comparison.js';
import { initDailyDataView } from '../dist/daily-data-view.js';
import { COMPARISON_SYMBOLS, comparisonViewModel, dailyViewSurface } from './helpers/daily-data-view-fixture.mjs';

// Count real controller work rather than imposing a machine-dependent millisecond budget.
test('50 unchanged renders reuse the dataset/model and perform no DOM rewrites', async () => {
  const ui = dailyViewSurface(), model = comparisonViewModel(); let reads = 0, builds = 0;
  const view = initDailyDataView({ root: ui.root, asOfDate: '2026-10-25', getComparisonDataset: async () => { reads++; return {}; }, buildModel: () => { builds++; return model; } });
  await view.render(); const before = ui.snapshot(); ui.resetWork();
  await Promise.all(Array.from({ length: 50 }, () => view.render()));
  assert.equal(reads, 1); assert.equal(builds, 1); assert.deepEqual(ui.work(), {});
  assert.deepEqual(ui.snapshot(), before); view.destroy();
});

test('UTC date rollover rebuilds freshness once without refetching or retaining an old judgment', async () => {
  const ui = dailyViewSurface(); let date = '2026-10-25', reads = 0, builds = 0;
  const view = initDailyDataView({ root: ui.root, asOfDate: () => date, getComparisonDataset: async () => { reads++; return {}; }, buildModel: (_bundle, options) => {
    builds++; const model = comparisonViewModel({ asOf: options.asOfDate });
    if (options.asOfDate === '2026-11-01') for (const row of model.rows) row.judgment = { id: 'unavailable', label: '판단 보류', available: false, reason: '최근 종가가 7일보다 오래되었습니다.' };
    return model;
  } });
  await view.render(); date = '2026-11-01'; await view.render(); await view.render();
  assert.equal(reads, 1); assert.equal(builds, 2); assert.equal(view.state.asOf, date);
  assert.equal((ui.node('data-body').innerHTML.match(/>판단 보류<\/button>/g) || []).length, 18);
  view.destroy();
});

test('method and CSV interactions reuse the ready model without additional source or analysis work', async () => {
  const ui = dailyViewSurface(), model = comparisonViewModel(); let reads = 0, builds = 0, downloads = 0;
  const view = initDailyDataView({ root: ui.root, asOfDate: '2026-10-25', getComparisonDataset: async () => { reads++; return {}; }, buildModel: () => { builds++; return model; }, download: () => downloads++ });
  await view.render(); ui.resetWork();
  for (let index = 0; index < 25; index++) { ui.click('', { assetReason: 'QQQ' }); ui.click('daily-method-close'); ui.click('export-raw'); }
  assert.equal(reads, 1); assert.equal(builds, 1); assert.equal(downloads, 25);
  assert.equal(ui.work()['data-body'], undefined); view.destroy();
});

test('the acquired full-history bundle renders all 18 source-backed rows once', async () => {
  const bundle = JSON.parse(readFileSync(new URL('../dist/data/asset-comparison.json', import.meta.url), 'utf8'));
  const ui = dailyViewSurface(); let builds = 0, reads = 0;
  const view = initDailyDataView({ root: ui.root, asOfDate: '2026-10-25', getComparisonDataset: async () => { reads++; return bundle; }, buildModel: (input, options) => { builds++; return buildAssetComparison(input, options); } });
  const model = await view.render(); assert.equal(view.state.status, 'ready');
  assert.equal(bundle.assets.length, 18); assert.ok(bundle.assets.reduce((total, asset) => total + asset.prices.length, 0) > 90000);
  assert.deepEqual(model.rows.map(row => row.symbol), COMPARISON_SYMBOLS);
  assert.deepEqual([...ui.node('data-body').innerHTML.matchAll(/data-asset-symbol="([^"]+)"/g)].map(match => match[1]), COMPARISON_SYMBOLS);
  assert.ok(model.rows.every(row => row.sampleYears >= 5));
  assert.ok(model.rows.every(row => row.sampleEndYear < model.year));
  assert.ok(model.rows.every(row => ['적극 매수', '분할 매수', '중립', '분할 매도', '적극 매도'].includes(row.judgment.label)));
  ui.resetWork(); await view.render();
  assert.equal(reads, 1); assert.equal(builds, 1); assert.deepEqual(ui.work(), {}); view.destroy();
});
