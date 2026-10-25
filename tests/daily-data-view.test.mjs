import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeDailySeries } from '../dist/daily-analytics.js';
import { bitcoinDailyAsset } from '../dist/daily-data-source.js';
import { annualDataCsv, dailyDataCsv, dailyTableRows, formatDailyPercent, initDailyDataView, renderAnnualDataTable, renderMonthlyDataTable } from '../dist/daily-data-view.js';

function dataset({ start = '2019-12-31', length = 240, offset = 0 } = {}) {
  const first = Date.parse(`${start}T00:00:00Z`);
  const prices = Array.from({ length }, (_, index) => [new Date(first + index * 86400000).toISOString().slice(0, 10), 100 + offset + index / 4 + Math.sin(index) * 4]);
  const nextDate = new Date(first + length * 86400000).toISOString();
  return { meta: { sourceName: 'Coin Metrics Community API', source: 'https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets=btc&metrics=PriceUSD', metric: 'PriceUSD', frequency: '1d', timezone: 'UTC', retrievedAt: nextDate, firstDate: prices[0][0], lastDate: prices.at(-1)[0], count: prices.length }, prices };
}
function ready(symbol, source = dataset()) {
  const asset = { ...bitcoinDailyAsset(source), symbol, sourceName: `${symbol} provider`, priceNote: `${symbol} observed daily close` };
  return { status: 'ready', asset, analysis: analyzeDailySeries(asset.prices, { calendar: asset.calendar, symbol, asOfDate: asset.asOfDate }) };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }

class Node {
  constructor(id = '', dataset = {}) { this.id = id; this.dataset = dataset; this.attrs = new Map(); this.innerHTML = ''; this.textContent = ''; this.value = ''; this.hidden = false; this.disabled = false; this.clientHeight = 238; this.classList = { add() {} }; }
  setAttribute(key, value) { this.attrs.set(key, value); }
  removeAttribute(key) { this.attrs.delete(key); }
  getAttribute(key) { return this.attrs.get(key); }
  showModal() { this.open = true; }
  close() { this.open = false; }
  closest(selector) {
    if (selector === 'button') return this;
    const match = selector.match(/^\[data-(.+)\]$/);
    if (!match) return null;
    const key = match[1].replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    return key in this.dataset ? this : null;
  }
}
function surface(query = '') {
  const root = new Node('data-view'), nodes = new Map(), listeners = new Map();
  root.ownerDocument = { defaultView: { location: { search: query } } };
  root.querySelector = selector => { if (!nodes.has(selector)) nodes.set(selector, new Node(selector.slice(1))); return nodes.get(selector); };
  const controls = {
    '[data-daily-asset]': ['BTC', 'ETH', 'MSTR', 'BMNR'].map(symbol => new Node('', { dailyAsset: symbol })),
    '[data-daily-detail]': ['daily', 'monthly'].map(detail => new Node('', { dailyDetail: detail })),
    '[data-daily-metric]': ['return', 'mdd'].map(metric => new Node('', { dailyMetric: metric })),
  };
  root.querySelectorAll = selector => controls[selector] || [];
  root.addEventListener = (name, callback) => listeners.set(name, callback);
  root.removeEventListener = name => listeners.delete(name);
  return {
    root, node: id => root.querySelector(`#${id}`),
    click: (id, values = {}) => listeners.get('click')?.({ target: new Node(id, values) }),
    change(id, value) { const target = root.querySelector(`#${id}`); target.value = value; listeners.get('change')?.({ target }); },
  };
}

test('percentage display preserves missing values, signs, and a true neutral zero', () => {
  assert.equal(formatDailyPercent(null), '—');
  assert.equal(formatDailyPercent(NaN), '—');
  assert.equal(formatDailyPercent(Infinity), '—');
  assert.equal(formatDailyPercent(-0.0001), '0.00%');
  assert.equal(formatDailyPercent(1250.125), '+1,250.13%');
  assert.equal(formatDailyPercent(-12.5), '−12.50%');
});

test('daily filters are applied before newest-first pagination and do not mutate analytics', () => {
  const entry = ready('BTC');
  const original = entry.analysis.rows.map(row => row.date);
  const filtered = dailyTableRows(entry.analysis, { year: '2020', month: '2' });
  assert.equal(filtered.length, 29);
  assert.equal(filtered[0].date, '2020-02-29');
  assert.equal(filtered.at(-1).date, '2020-02-01');
  assert.deepEqual(entry.analysis.rows.map(row => row.date), original);
  assert.equal(dailyTableRows(entry.analysis, { year: '2021' }).length, 0);
});

test('CSV exports the filtered observations with exact values, partial YTD and nulls kept empty', () => {
  const entry = ready('BTC', dataset({ start: '2020-06-01', length: 8 }));
  const output = dailyDataCsv(entry.asset, entry.analysis, { year: '2020', month: '6' });
  const lines = output.slice(1).trimEnd().split('\r\n'), headers = lines[0].split(',');
  assert.equal(lines.length, 9);
  assert.equal(lines[1].split(',')[0], '2020-06-08');
  const firstObservation = lines.at(-1).split(',');
  assert.equal(firstObservation[headers.indexOf('price_usd')], String(entry.analysis.rows[0].price));
  assert.equal(firstObservation[headers.indexOf('change_pct')], '');
  assert.equal(firstObservation[headers.indexOf('sma_200')], '');
  assert.equal(firstObservation[headers.indexOf('ytd_partial')], 'true');
  assert.ok(output.includes('heuristic-not-backtested'));
  assert.ok(output.includes(entry.asset.retrievedAt));
  assert.ok(output.includes('CC BY-NC 4.0'));
});

test('CSV quotes source commas and protects text cells against spreadsheet formulas', () => {
  const entry = ready('BTC', dataset({ length: 1 }));
  entry.asset.sourceName = '=1+1'; entry.asset.priceNote = 'close, "quoted"';
  const output = dailyDataCsv(entry.asset, entry.analysis);
  assert.ok(output.includes("'=1+1"));
  assert.ok(output.includes('"close, ""quoted"""'));
});

test('annual export includes only displayed years and actually loaded assets with source metadata', () => {
  const entries = new Map([['BTC', ready('BTC')], ['ETH', { status: 'error', error: 'offline' }], ['MSTR', ready('MSTR')]]);
  const output = annualDataCsv(entries, [2020]);
  const lines = output.slice(1).trimEnd().split('\r\n');
  assert.equal(lines.length, 3);
  assert.ok(lines[1].startsWith('BTC,2020,')); assert.ok(lines[2].startsWith('MSTR,2020,'));
  assert.ok(output.includes('baseline_date')); assert.ok(output.includes('coverage_complete'));
  assert.ok(!output.includes('ETH,2020'));
});

test('heatmap distinguishes incomplete observations, missing assets and full-history totals', () => {
  const entries = new Map([['BTC', ready('BTC')], ['ETH', { status: 'error', error: 'offline' }]]);
  const markup = renderAnnualDataTable(entries, [2018, 2019, 2020]);
  assert.ok(markup.includes('전체 누적')); assert.ok(markup.includes('전체 CAGR')); assert.ok(markup.includes('전체 MDD'));
  assert.ok(markup.includes('각 자산의 전체 관측 이력'));
  assert.ok(markup.includes('이 기간에 관측 자료가 없습니다.'));
  assert.ok(markup.includes('data-daily-retry="ETH"'));
  assert.ok(markup.includes('부분기간')); assert.ok(markup.includes('<sup>*</sup>'));
  const mdd = renderAnnualDataTable(entries, [2020], { metric: 'mdd' });
  assert.ok(mdd.includes('기간 내 종가 MDD')); assert.ok(mdd.includes('고점 →'));
});

test('monthly heatmap cells carry the matching asset/year/month drill-down and skip absent months', () => {
  const entry = ready('BMNR', dataset({ start: '2025-06-05', length: 40 }));
  const markup = renderMonthlyDataTable(entry.asset, entry.analysis);
  assert.ok(markup.includes('data-symbol="BMNR" data-year="2025" data-month="6"'));
  assert.ok(markup.includes('data-month="7"')); assert.ok(!markup.includes('data-month="1"'));
  assert.ok(markup.includes('부분기간'));
});

test('controller paints BTC immediately, keeps user selection through independent async loads and exposes failure', async () => {
  const data = dataset(), ui = surface('?data-asset=ETH'), pending = new Map(['ETH', 'MSTR', 'BMNR'].map(symbol => [symbol, deferred()]));
  const view = initDailyDataView({ root: ui.root, getBitcoinDataset: () => data, loadAsset: symbol => pending.get(symbol).promise });
  view.render();
  assert.ok(ui.node('daily-annual-table').innerHTML.includes('BTC'));
  assert.ok(ui.node('data-summary').innerHTML.includes('ETH'));
  ui.click('', { dailyAsset: 'MSTR' });
  pending.get('MSTR').resolve(ready('MSTR').asset); await tick();
  assert.ok(ui.node('data-summary').innerHTML.includes('MSTR ·'));
  assert.ok(ui.node('data-body').innerHTML.includes('2020-08-26'));
  pending.get('ETH').resolve(ready('ETH').asset); pending.get('BMNR').reject(new Error('offline')); await tick();
  assert.ok(ui.node('data-summary').innerHTML.includes('MSTR ·'), 'late responses must not switch the selected asset');
  assert.ok(ui.node('daily-annual-table').innerHTML.includes('data-daily-retry="BMNR"'));
  assert.ok(!ui.node('daily-annual-table').innerHTML.includes('data-daily-retry="ETH"'));
  view.destroy();
});

test('real period click, filter, page and CSV actions use the same visible rows', async () => {
  const data = dataset(), ui = surface(), downloads = [];
  const view = initDailyDataView({ root: ui.root, getBitcoinDataset: () => data, loadAsset: async symbol => ready(symbol).asset, download: (name, blob) => downloads.push({ name, blob }) });
  view.render(); await tick();
  ui.click('', { dailyPeriod: '', symbol: 'ETH', year: '2020', month: '2' });
  assert.equal(ui.node('data-year').value, '2020'); assert.equal(ui.node('daily-month').value, '2');
  assert.equal(ui.node('data-result-count').textContent, '29개 관측');
  assert.ok(ui.node('data-body').innerHTML.includes('2020-02-29'));
  assert.ok(!ui.node('data-body').innerHTML.includes('2020-03-01'));
  ui.click('data-next'); assert.ok(!ui.node('data-body').innerHTML.includes('2020-02-29'));
  ui.click('export-raw'); assert.equal(downloads[0].name, 'eth-daily-2020-02.csv');
  const downloaded = await downloads[0].blob.text();
  assert.ok(downloaded.includes('2020-02-01,ETH,')); assert.ok(downloaded.includes('2020-02-29,ETH,'));
  assert.ok(!downloaded.includes('2020-03-01,ETH,'));
  ui.change('data-year', '2019'); assert.equal(ui.node('daily-month').value, 'all');
  assert.equal(ui.node('data-result-count').textContent, '1개 관측');
  assert.ok(ui.node('data-body').innerHTML.includes('첫 관측일부터 계산한 부분기간'));
  ui.click('', { dailyDetail: 'monthly' });
  assert.equal(ui.node('daily-monthly-scroll').hidden, false); assert.equal(ui.node('daily-table-scroll').hidden, true);
  view.destroy();
});

test('source replacement updates data without resetting a selected year and destroy ignores pending responses', async () => {
  let data = dataset(); const ui = surface(), pending = deferred();
  const view = initDailyDataView({ root: ui.root, getBitcoinDataset: () => data, loadAsset: () => pending.promise });
  view.render(); ui.change('data-year', '2020');
  const before = ui.node('data-body').innerHTML;
  data = dataset({ offset: 500 }); view.render();
  assert.equal(ui.node('data-year').value, '2020'); assert.notEqual(ui.node('data-body').innerHTML, before);
  const painted = ui.node('daily-annual-table').innerHTML; view.destroy();
  pending.resolve(ready('ETH').asset); await tick();
  assert.equal(ui.node('daily-annual-table').innerHTML, painted);
});

test('a pre-2011 series safely offers all-history view and the method dialog explains the signal', async () => {
  const data = dataset({ start: '2010-07-18', length: 8 }), ui = surface();
  const view = initDailyDataView({ root: ui.root, getBitcoinDataset: () => data, loadAsset: async symbol => ready(symbol, data).asset });
  assert.doesNotThrow(() => view.render()); await tick();
  ui.change('daily-scope', 'all'); assert.ok(ui.node('daily-annual-table').innerHTML.includes('data-year="2010"'));
  ui.click('daily-method-open'); assert.equal(ui.node('daily-method-dialog').open, true);
  assert.ok(ui.node('daily-method-content').innerHTML.includes('50 ≤ RSI 14 &lt; 70'));
  assert.ok(ui.node('daily-method-content').innerHTML.includes('수익성·적중률을 검증한 전략이 아니며'));
  ui.click('daily-method-close'); assert.equal(ui.node('daily-method-dialog').open, false);
  view.destroy();
});
