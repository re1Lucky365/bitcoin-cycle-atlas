import assert from 'node:assert/strict';
import test from 'node:test';
import { assetComparisonCsv, formatDailyPercent, initDailyDataView, renderAssetComparisonRows } from '../dist/daily-data-view.js';
import { COMPARISON_SYMBOLS, comparisonViewModel, dailyViewSurface, deferred } from './helpers/daily-data-view-fixture.mjs';

const symbols = markup => [...markup.matchAll(/data-asset-symbol="([^"]+)"/g)].map(match => match[1]);
function setup({ model = comparisonViewModel(), getter = async () => ({ retrievedAt: '2026-10-25T08:00:00Z' }), surface = dailyViewSurface(), ...options } = {}) {
  const view = initDailyDataView({ root: surface.root, getComparisonDataset: getter, buildModel: () => model, asOfDate: '2026-10-25', ...options });
  return { view, ui: surface, model };
}

// These tests verify the controller boundary; a real-browser pass verifies layout separately.
test('percentage formatting distinguishes missing, zero, signed values and sub-cent rounding', () => {
  for (const missing of [null, undefined, NaN, Infinity, '12']) assert.equal(formatDailyPercent(missing), '—');
  assert.equal(formatDailyPercent(-.0001), '0.00%');
  assert.equal(formatDailyPercent(1250.125), '+1,250.13%');
  assert.equal(formatDailyPercent(-12.5), '−12.50%');
  assert.equal(formatDailyPercent(-12.5, 1), '−12.5%');
});

test('opening the view creates exactly one grouped comparison table with all 17 assets', async () => {
  const { view, ui } = setup(); await view.render();
  assert.equal(view.state.status, 'ready');
  assert.equal((ui.root.innerHTML.match(/<table\b/g) || []).length, 1);
  assert.equal((ui.root.innerHTML.match(/<col\b/g) || []).length, 10);
  assert.match(ui.root.innerHTML, /colspan="3" scope="colgroup"[^>]*>종목명/);
  assert.match(ui.root.innerHTML, /<h1>자산 비교표/);
  assert.doesNotMatch(ui.root.innerHTML, /SMA|RSI|사이클 판단표|일별 원자료|cycle-scope|<select/);
  const table = ui.node('data-body').innerHTML;
  assert.deepEqual(symbols(table), COMPARISON_SYMBOLS);
  assert.deepEqual([...table.matchAll(/rowspan="(\d+)"/g)].map(match => Number(match[1])), [12, 4, 1]);
  assert.match(table, /asset-return-gain/); assert.match(table, /asset-return-loss/);
  assert.match(ui.node('asset-row-count').textContent, /17개 자산 전체/);
  assert.doesNotMatch(table, /data-cycle|data-evidence|M7/);
  view.destroy();
});

test('each final cell uses an exact five-stage label and opens the relevant explanation', async () => {
  const { view, ui, model } = setup(); await view.render();
  const table = ui.node('data-body').innerHTML;
  for (const label of ['적극 매수', '분할 매수', '중립', '분할 매도', '적극 매도']) assert.match(table, new RegExp(`>${label}</button></td></tr>`));
  ui.click('', { assetReason: 'QQQ' });
  assert.equal(ui.node('daily-method-dialog').open, true);
  assert.match(ui.node('daily-method-content').innerHTML, /NASDAQ100 \(QQQ\) · 분할 매수/);
  assert.match(ui.node('daily-method-content').innerHTML, new RegExp(model.rows[1].judgment.reason));
  assert.match(ui.node('daily-method-content').innerHTML, /−10\.00% 이하/);
  assert.match(ui.node('daily-method-content').innerHTML, /−5\.00% 초과, \+10\.00% 미만/);
  assert.match(ui.node('daily-method-content').innerHTML, /\+20\.00% 이상/);
  assert.doesNotMatch(ui.node('daily-method-content').innerHTML, /<table\b/);
  ui.click('daily-method-close'); assert.equal(ui.node('daily-method-dialog').open, false);
  ui.click('', { assetReason: 'missing' }); assert.equal(ui.node('daily-method-dialog').open, false);
  view.destroy();
});

test('headers use actual observed trading dates and sample cells disclose partial first years', async () => {
  const { view, ui } = setup(); await view.render();
  assert.match(ui.node('asset-start-header').innerHTML, /2026\.01\.02/);
  assert.match(ui.node('asset-latest-header').innerHTML, /2026\.10\.23/);
  assert.match(ui.node('asset-ytd-header').innerHTML, /2026년/);
  assert.doesNotMatch(ui.node('asset-latest-header').innerHTML, /03\.25|현재가/);
  assert.match(ui.node('data-body').innerHTML, /2016–2025 · 10개 연도/);
  assert.match(ui.node('data-body').innerHTML, /첫해는 2016-03-02부터의 일부 기간/);
  assert.match(ui.node('data-body').innerHTML, /<sup aria-hidden="true">\*<\/sup>/);
  assert.match(ui.node('asset-sample-note').textContent, /2026년은 평균에서 제외/);
  view.destroy();
});

test('unequal dates are labeled per asset instead of asserting a shared observation date', async () => {
  const model = comparisonViewModel();
  model.rows[1].latestDate = '2026-10-22'; model.rows[1].yearStartDate = '2026-01-05';
  const { view, ui } = setup({ model }); await view.render();
  assert.match(ui.node('asset-start-header').innerHTML, /종목별 기준일/);
  assert.match(ui.node('asset-latest-header').innerHTML, /종목별 기준일/);
  assert.match(ui.node('data-body').innerHTML, /asset-cell-date">2026\.10\.22/);
  assert.match(ui.node('data-body').innerHTML, /asset-cell-date">2026\.01\.05/);
  assert.match(ui.node('asset-context').innerHTML, /최근 관측 종목별 기준일/);
  view.destroy();
});

test('loading is lazy while hidden and repeated visible calls share the same pending request', async () => {
  const gate = deferred(), surface = dailyViewSurface({ hidden: true }); let reads = 0, builds = 0;
  const { view, ui } = setup({ surface, getter: () => { reads++; return gate.promise; }, buildModel: () => { builds++; return comparisonViewModel(); } });
  assert.equal(reads, 0); await view.render(); assert.equal(reads, 0);
  ui.root.hidden = false;
  const pending = view.render(); assert.equal(view.render(), pending);
  await ui.settle(); assert.equal(reads, 1); assert.equal(builds, 0);
  assert.equal(view.state.status, 'loading'); assert.equal(ui.node('export-raw').disabled, true);
  assert.deepEqual(symbols(ui.node('data-body').innerHTML), []);
  gate.resolve({ retrievedAt: '2026-10-25T08:00:00Z' }); await pending;
  assert.equal(builds, 1); assert.equal(view.state.status, 'ready');
  view.destroy();
});

test('failed fetch clears rows and export, does not retry on resize, and explicit retry recovers', async () => {
  let broken = false, reads = 0; const downloads = [];
  const { view, ui } = setup({ getter: async () => { reads++; if (broken) throw new Error('network offline'); return {}; }, download: (...args) => downloads.push(args) });
  await view.render(); assert.equal(ui.node('export-raw').disabled, false);
  broken = true; await view.refresh();
  assert.equal(view.state.status, 'error'); assert.equal(ui.node('export-raw').disabled, true);
  assert.deepEqual(symbols(ui.node('data-body').innerHTML), []);
  assert.match(ui.node('data-body').innerHTML, /id="asset-retry"/);
  assert.match(ui.node('asset-context').title, /network offline/);
  ui.click('export-raw'); assert.equal(downloads.length, 0);
  await view.render(); await view.render(); assert.equal(reads, 2);
  broken = false; ui.click('asset-retry'); await view.render();
  assert.equal(reads, 3); assert.equal(view.state.status, 'ready');
  assert.equal(ui.node('export-raw').disabled, false);
  assert.doesNotMatch(ui.node('asset-context').title, /network offline/);
  assert.deepEqual(symbols(ui.node('data-body').innerHTML), COMPARISON_SYMBOLS);
  view.destroy();
});

test('synchronous getter and model failures resolve after painting the error state', async () => {
  for (const options of [{ getter() { throw new Error('sync source failure'); } }, { buildModel() { throw new Error('bad price series'); } }]) {
    const { view, ui } = setup(options);
    assert.equal(await view.render(), null); assert.equal(view.state.status, 'error');
    assert.match(ui.node('data-body').innerHTML, /자료를 확인할 수 없어/);
    assert.equal(ui.node('export-raw').disabled, true);
    assert.equal(ui.node('asset-table-scroll').getAttribute('aria-busy'), 'false');
    view.destroy();
  }
});

test('the refresh button gets new data and immediately clears an old CSV and open judgment explanation', async () => {
  let offset = 0, reads = 0; const next = deferred(), downloads = [];
  const { view, ui } = setup({ getter: () => { reads++; return reads === 1 ? { offset } : next.promise; }, buildModel: bundle => comparisonViewModel({ offset: bundle.offset }), download: (name, blob) => downloads.push({ name, blob }) });
  await view.render(); const before = ui.node('data-body').innerHTML;
  ui.click('', { assetReason: 'QQQ' }); assert.match(ui.node('daily-method-content').innerHTML, /NASDAQ100 \(QQQ\) · 분할 매수/);
  ui.click('asset-refresh'); const pending = view.render();
  assert.equal(ui.node('asset-refresh').disabled, true); assert.equal(ui.node('export-raw').disabled, true);
  assert.deepEqual(symbols(ui.node('data-body').innerHTML), []);
  assert.doesNotMatch(ui.node('daily-method-content').innerHTML, /NASDAQ100 \(QQQ\) · 분할 매수/);
  ui.click('export-raw'); ui.click('asset-refresh'); await ui.settle();
  assert.equal(downloads.length, 0); assert.equal(reads, 2);
  offset = 700; next.resolve({ offset }); await pending;
  assert.equal(ui.node('asset-refresh').disabled, false); assert.equal(ui.node('export-raw').disabled, false);
  assert.notEqual(ui.node('data-body').innerHTML, before); assert.match(ui.node('data-body').innerHTML, />800\.00</);
  view.destroy();
});

test('a partial or duplicate asset result fails closed rather than silently dropping assets', async () => {
  for (const alter of [model => model.rows.pop(), model => { model.rows[16] = model.rows[0]; }]) {
    const model = comparisonViewModel(); alter(model);
    const { view, ui } = setup({ model, download() {} }); await view.render();
    assert.equal(view.state.status, 'error'); assert.deepEqual(symbols(ui.node('data-body').innerHTML), []);
    assert.equal(ui.node('export-raw').disabled, true); view.destroy();
  }
});

test('unavailable samples never become neutral; individual observed prices remain readable', async () => {
  const model = comparisonViewModel();
  model.rows[0].judgment = { id: 'unavailable', label: '판단 보류', reason: '자료가 오래되었습니다.', available: false };
  model.rows[1].sampleYears = 4;
  model.rows[2].meanRisePct = 0;
  model.rows[3].coverage.complete = false;
  const { view, ui } = setup({ model }); await view.render();
  assert.equal(view.state.status, 'ready');
  const table = ui.node('data-body').innerHTML;
  assert.equal((table.match(/>판단 보류<\/button>/g) || []).length, 4);
  assert.deepEqual(symbols(table), COMPARISON_SYMBOLS);
  assert.match(table, /최근 관측 종가">85\.00/);
  assert.match(ui.node('asset-row-count').textContent, /4개 판단 보류/);
  assert.match(assetComparisonCsv(model), /자료가 오래되었습니다/);
  view.destroy();
});

test('CSV contains the same 17 rows, unrounded metrics, provenance, boundaries and price dates', async () => {
  const downloads = [], model = comparisonViewModel(); model.rows[0].meanRisePct = 20.123456789;
  const { view, ui } = setup({ model, download: (name, blob) => downloads.push({ name, blob }) }); await view.render();
  ui.click('export-raw'); assert.equal(downloads.length, 1);
  assert.equal(downloads[0].name, 'asset-comparison-2026-10-25.csv');
  const csv = await downloads[0].blob.text();
  assert.equal(csv.trimEnd().split('\r\n').length, 18);
  assert.match(csv, /mean_annual_fall_pct_not_mdd/); assert.match(csv, /20\.123456789/);
  assert.match(csv, /2026-01-02,100,2026-10-23,85,-15,적극 매수/);
  assert.match(csv, /current year excluded/); assert.match(csv, /https:\/\/example\.test\/prices\/SPY/);
  assert.match(csv, /strong_buy_threshold_pct/); assert.doesNotMatch(csv, /SMA|RSI/);
  view.destroy();
});

test('method explains MDD distinction, operational boundaries, sample years and sources without another table', async () => {
  const { view, ui } = setup(); await view.render(); ui.click('daily-method-open');
  const content = ui.node('daily-method-content').innerHTML;
  assert.equal(ui.node('daily-method-dialog').open, true);
  assert.match(content, /100 → 150 → 120/); assert.match(content, /MDD는 −20%/);
  assert.match(content, /D &lt; r ≤ D ÷ 2/); assert.match(content, /U ÷ 2 ≤ r &lt; U/);
  assert.match(content, /상장 첫해 일부 기간/); assert.match(content, /5개 연도 미만/);
  assert.match(content, /종목별 출처·표본 범위 \(17개\)/);
  assert.match(content, /총수익률/); assert.doesNotMatch(content, /<table\b|SMA|RSI/);
  view.destroy();
});

test('untrusted names and explanations are escaped and CSV spreadsheet formulas are neutralized', async () => {
  const model = comparisonViewModel(), row = model.rows[0];
  row.name = '<img src=x onerror=alert(1)>'; row.judgment.reason = ' =1+1,"source"';
  row.source.name = '@IMPORTXML'; row.source.url = 'javascript:alert(1)';
  const markup = renderAssetComparisonRows(model.rows);
  assert.match(markup, /&lt;img src=x onerror=alert\(1\)&gt;/); assert.doesNotMatch(markup, /<img/);
  assert.match(assetComparisonCsv(model), /' =1\+1/); assert.match(assetComparisonCsv(model), /""source""/);
  assert.match(assetComparisonCsv(model), /'@IMPORTXML/);
  const { view, ui } = setup({ model }); await view.render(); ui.click('daily-method-open');
  assert.doesNotMatch(ui.node('daily-method-content').innerHTML, /href="javascript:|<img/);
  view.destroy();
});

test('a superseded request cannot replace newer data or surface its obsolete error', async () => {
  const first = deferred(), second = deferred(); let reads = 0;
  const { view, ui } = setup({ getter: () => ++reads === 1 ? first.promise : second.promise, buildModel: bundle => comparisonViewModel({ offset: bundle.offset }) });
  const oldPending = view.render(); await ui.settle();
  const newPending = view.refresh(); await ui.settle();
  second.resolve({ offset: 700 }); await newPending; const newer = ui.snapshot();
  first.reject(new Error('obsolete error')); await oldPending;
  assert.deepEqual(ui.snapshot(), newer); assert.equal(view.state.status, 'ready');
  assert.match(newer.table, />800\.00</); view.destroy();
});

test('destroy cancels pending effects, removes actions and makes further renders inert', async () => {
  const gate = deferred(), downloads = []; let builds = 0;
  const { view, ui } = setup({ getter: () => gate.promise, buildModel: () => { builds++; return comparisonViewModel(); }, download: name => downloads.push(name) });
  const pending = view.render(); await ui.settle(); const before = ui.snapshot();
  view.destroy(); gate.resolve({}); await pending;
  assert.equal(builds, 0); assert.deepEqual(ui.snapshot(), before);
  await view.render(); ui.click('export-raw'); ui.click('daily-method-open');
  assert.equal(downloads.length, 0); assert.equal(ui.node('daily-method-dialog').open, false);
});

test('invalid comparison dates fail visibly before any source request', async () => {
  for (const asOfDate of ['2026-02-30', 'invalid', () => { throw new Error('clock unavailable'); }]) {
    let reads = 0; const { view, ui } = setup({ asOfDate, getter: () => { reads++; return {}; } });
    assert.equal(await view.render(), null); assert.equal(reads, 0); assert.equal(view.state.status, 'error');
    assert.deepEqual(symbols(ui.node('data-body').innerHTML), []); view.destroy();
  }
});
