import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCycleDecisionTable } from '../dist/cycle-decision.js';
import { cycleDecisionCsv, cycleTableRows, formatDailyPercent, initDailyDataView, renderCycleTableRows } from '../dist/daily-data-view.js';
import { cycleViewContext, dailyViewSurface } from './helpers/daily-data-view-fixture.mjs';

const modelOf = context => buildCycleDecisionTable(context);
const rowIds = markup => [...markup.matchAll(/data-cycle-row-id="([^"]+)"/g)].map(match => match[1]);

// This boundary verifies actual controller outputs/actions, not browser layout.
// Real DOM and responsive rendering are checked separately in the browser.
test('percentage formatting preserves missing values and signed finite values', () => {
  assert.equal(formatDailyPercent(null), '—');
  assert.equal(formatDailyPercent(NaN), '—');
  assert.equal(formatDailyPercent(Infinity), '—');
  assert.equal(formatDailyPercent(-.0001, 2), '0.00%');
  assert.equal(formatDailyPercent(1250.125, 2), '+1,250.13%');
  assert.equal(formatDailyPercent(-12.5), '−12.5%');
});

test('recent filtering preserves the whole preceding interval and separates selection provenance', () => {
  const rows = [
    { id: 'old', cycleId: 'a', startDate: '2019-01-01', endDate: '2021-01-01', kind: 'observed' },
    { id: 'recent', cycleId: 'b', startDate: '2021-01-01', endDate: '2022-11-09', kind: 'observed' },
    { id: 'mixed', cycleId: 'c', startDate: '2025-01-01', endDate: '2027-01-01', kind: 'mixed', evidenceKind: 'scenario' },
  ];
  const model = { asOf: '2026-10-23', rows };
  assert.deepEqual(cycleTableRows(model).map(row => row.id), ['recent', 'mixed']);
  assert.equal(cycleTableRows(model)[0].startDate, '2021-01-01', 'filtering must not silently rebase the metric');
  assert.deepEqual(cycleTableRows(model, { evidence: 'observed' }).map(row => row.id), ['recent']);
  assert.deepEqual(cycleTableRows(model, { cycle: 'all', evidence: 'scenario' }).map(row => row.id), ['mixed']);
  assert.deepEqual(cycleTableRows(model, { cycle: 'a' }).map(row => row.id), ['old']);
  assert.equal(rows.length, 3);
});

test('the controller creates one semantic table and no removed indicator or comparison interface', () => {
  const context = cycleViewContext(), ui = dailyViewSurface();
  const view = initDailyDataView({ root: ui.root, getCycleContext: () => context });
  view.render();
  assert.equal((ui.root.innerHTML.match(/<table\b/g) || []).length, 1);
  assert.equal((ui.root.innerHTML.match(/scope="col"/g) || []).length, 5);
  assert.match(ui.root.innerHTML, /사이클 판단표/);
  assert.doesNotMatch(ui.root.innerHTML, /SMA|RSI|daily-annual-table|daily-monthly-table|일별 원자료/);
  assert.match(ui.node('cycle-context').innerHTML, /2025-01-31/);
  assert.equal(rowIds(ui.node('data-body').innerHTML).length, modelOf(context).rows.length);
  assert.match(ui.node('data-body').innerHTML, /현재 관측/);
  assert.match(ui.node('data-body').innerHTML, /미래 가정/);
  assert.match(ui.node('data-body').innerHTML, /관측 · 잠정/);
  view.destroy();
});

test('filters, chart selection and CSV all refer to the same exact model rows', async () => {
  const context = cycleViewContext(), model = modelOf(context), ui = dailyViewSurface(), downloads = [], selections = [];
  const view = initDailyDataView({ root: ui.root, getCycleContext: () => context, onSelectCycleRow: row => selections.push(row), download: (name, blob) => downloads.push({ name, blob }) });
  view.render();
  ui.click('', { cycleEvidence: 'scenario' });
  const expected = cycleTableRows(model, { evidence: 'scenario' });
  assert.deepEqual(rowIds(ui.node('data-body').innerHTML), expected.map(row => row.id));
  assert.ok(expected.length > 0);
  ui.click('', { cycleRow: expected[0].id });
  assert.deepEqual(selections[0], expected[0]);
  ui.click('', { cycleRow: 'unknown' }); assert.equal(selections.length, 1);
  ui.click('export-raw'); assert.equal(downloads.length, 1);
  const exported = await downloads[0].blob.text();
  assert.match(downloads[0].name, /btc-cycle-review-2025-01-31-recent-scenario\.csv$/);
  assert.match(exported, /conditional-scenario-not-a-probability/);
  assert.doesNotMatch(exported, /SMA|RSI|retrospective-not-a-historical-trade-signal/);
  const lines = exported.slice(1).trimEnd().split('\r\n');
  assert.equal(lines.length, expected.length + 1);
  const fields = lines[0].split(',');
  assert.equal(lines[1].split(',')[fields.indexOf('price_change_pct')], '');
  assert.equal(lines[1].split(',')[fields.indexOf('period_mdd_pct')], '');
  ui.click('', { cycleEvidence: 'observed' }); ui.change('cycle-scope', 'current');
  assert.deepEqual(rowIds(ui.node('data-body').innerHTML), ['observed:range:2025-01-19:2025-01-31', model.current.id]);
  assert.match(ui.node('data-body').innerHTML, /28일/);
  view.destroy();
});

test('no prepared chart context clears prior judgments and never labels missing data sideways', () => {
  let context = cycleViewContext(); const ui = dailyViewSurface(), selected = [];
  const view = initDailyDataView({ root: ui.root, getCycleContext: () => context, onSelectCycleRow: row => selected.push(row), download() {} });
  view.render(); const oldId = modelOf(context).rows[0].id;
  context = null; view.render();
  assert.deepEqual(rowIds(ui.node('data-body').innerHTML), []);
  assert.equal(ui.node('export-raw').disabled, true);
  assert.doesNotMatch(ui.node('data-body').innerHTML, /횡보·관찰|적극 매수/);
  ui.click('', { cycleRow: oldId }); assert.equal(selected.length, 0);
  view.destroy();
});

test('misaligned chart inputs fail visibly without leaving stale rows or an export', () => {
  let context = cycleViewContext(); const ui = dailyViewSurface();
  const view = initDailyDataView({ root: ui.root, getCycleContext: () => context, download() {} });
  view.render();
  context = { ...context, milestones: { ...context.milestones, asOf: '2025-01-30' } };
  view.render();
  assert.match(ui.node('cycle-context').textContent, /일치하지 않아 판단을 보류/);
  assert.equal(ui.node('export-raw').disabled, true);
  assert.deepEqual(rowIds(ui.node('data-body').innerHTML), []);
  view.destroy();
});

test('displayed price respects the chart cutoff even when the source has later observations', () => {
  const context = cycleViewContext(), last = context.prices.at(-1), ui = dailyViewSurface();
  context.prices = [...context.prices, ['2025-02-01', 999999]];
  context.dataset = { ...context.dataset, prices: context.prices };
  const view = initDailyDataView({ root: ui.root, getCycleContext: () => context });
  view.render();
  assert.match(ui.node('cycle-context').innerHTML, new RegExp(last[1].toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace('.', '\\.')));
  assert.doesNotMatch(ui.node('cycle-context').innerHTML, /999,999/);
  view.destroy();
});

test('a replaced dataset or scenario updates the table while keeping valid selected filters', () => {
  let context = cycleViewContext(); const ui = dailyViewSurface();
  const view = initDailyDataView({ root: ui.root, getCycleContext: () => context });
  view.render(); ui.change('cycle-scope', 'current');
  const before = ui.node('data-body').innerHTML;
  context = cycleViewContext({ offset: 100 }); view.render();
  assert.equal(ui.node('cycle-scope').value, 'current');
  assert.notEqual(ui.node('data-body').innerHTML, before);
  ui.change('cycle-scope', 'scenario-base');
  context = cycleViewContext({ scenarioId: 'other' }); view.render();
  assert.equal(ui.node('cycle-scope').value, 'recent');
  assert.match(ui.node('cycle-scenario-label').textContent, /다른 미래 가정/);
  view.destroy();
});

test('method dialog explains timeframe, hindsight, and operational sideways criteria without a second table', () => {
  const context = cycleViewContext(), ui = dailyViewSurface();
  const view = initDailyDataView({ root: ui.root, getCycleContext: () => context });
  view.render(); ui.click('daily-method-open');
  assert.equal(ui.node('daily-method-dialog').open, true);
  const content = ui.node('daily-method-content').innerHTML;
  assert.match(content, /28개 일말 가격/); assert.match(content, /최적 수익 기준으로 검증하지/);
  assert.match(content, /당시 실행할 수 있었던/); assert.match(content, /행에 적힌 시작일부터 종료일까지/);
  assert.doesNotMatch(content, /<table|SMA|RSI/);
  ui.click('daily-method-close'); assert.equal(ui.node('daily-method-dialog').open, false);
  view.destroy();
});

test('CSV and HTML safely preserve quoted source and review text', () => {
  const model = modelOf(cycleViewContext());
  model.rows[0] = { ...model.rows[0], phaseLabel: '<img src=x>', action: { ...model.rows[0].action, reason: '=1+1,"source"' } };
  const output = cycleDecisionCsv(model, [model.rows[0]], { sourceName: '=1+1', sourceUrl: 'https://example.test/', retrievedAt: 'now' });
  assert.match(output, /'=1\+1/); assert.match(output, /""source""/);
  const html = renderCycleTableRows([model.rows[0]]);
  assert.match(html, /&lt;img src=x&gt;/); assert.doesNotMatch(html, /<img/);
});

test('destroy removes actions and makes subsequent render calls inert', () => {
  let context = cycleViewContext(); const ui = dailyViewSurface(), downloads = [];
  const view = initDailyDataView({ root: ui.root, getCycleContext: () => context, download: name => downloads.push(name) });
  view.render(); const before = ui.snapshot(); view.destroy();
  context = cycleViewContext({ offset: 700 }); view.render();
  ui.click('export-raw'); ui.change('cycle-scope', 'all');
  assert.equal(downloads.length, 0);
  assert.equal(ui.node('data-body').innerHTML, before.table);
});


test('a throwing shared-chart getter clears all stale plans and recovers without the old error title', () => {
  const context = cycleViewContext(), ui = dailyViewSurface(), downloads = [], selections = [];
  let broken = false;
  const view = initDailyDataView({ root: ui.root, getCycleContext() { if (broken) throw new RangeError('bad replacement as-of'); return context; }, onSelectCycleRow: row => selections.push(row), download: name => downloads.push(name) });
  view.render(); const oldId = modelOf(context).rows[0].id;
  broken = true; assert.doesNotThrow(() => view.render());
  assert.equal(ui.node('export-raw').disabled, true);
  assert.deepEqual(rowIds(ui.node('data-body').innerHTML), []);
  assert.match(ui.node('cycle-context').textContent, /판단을 보류/);
  assert.doesNotMatch(ui.snapshot().context, /cycle-context-price/);
  assert.equal(ui.node('cycle-scenario-label').textContent, '');
  ui.click('export-raw'); ui.click('', { cycleRow: oldId });
  assert.equal(downloads.length, 0); assert.equal(selections.length, 0);
  broken = false; view.render();
  assert.ok(rowIds(ui.node('data-body').innerHTML).length > 0);
  assert.equal(ui.node('export-raw').disabled, false);
  assert.doesNotMatch(ui.node('cycle-context').title, /bad replacement/);
  view.destroy();
});

test('shared cycle boundaries stay visible and the explicit range detail control reveals all episodes', () => {
  const rows = [
    { id: 'shared-low', phaseId: 'bottom', cycleId: 'new', cycleIds: ['old', 'new'], endDate: '2024-01-01' },
    { id: 'range-1', phaseId: 'range', cycleId: 'old', endDate: '2024-01-02' },
    { id: 'range-2', phaseId: 'range', cycleId: 'old', endDate: '2024-01-03' },
    { id: 'future-range-1', phaseId: 'range', cycleId: 'future', evidenceKind: 'scenario', endDate: '2027-01-01' },
    { id: 'future-range-2', phaseId: 'range', cycleId: 'future', evidenceKind: 'scenario', endDate: '2027-02-01' },
  ];
  const model = { asOf: '2026-10-23', rows };
  assert.deepEqual(cycleTableRows(model, { cycle: 'old', allRanges: true }).map(row => row.id), ['shared-low', 'range-1', 'range-2']);
  assert.deepEqual(cycleTableRows(model).map(row => row.id), ['shared-low', 'range-2', 'future-range-1']);
  assert.deepEqual(cycleTableRows(model, { allRanges: true }), rows);
  const ui = dailyViewSurface(), context = cycleViewContext();
  const view = initDailyDataView({ root: ui.root, getCycleContext: () => context });
  view.render();
  ui.node('cycle-all-ranges').checked = true; ui.change('cycle-all-ranges', 'on');
  assert.deepEqual(rowIds(ui.node('data-body').innerHTML), cycleTableRows(modelOf(context), { allRanges: true }).map(row => row.id));
  assert.equal((ui.root.innerHTML.match(/<table\b/g) || []).length, 1);
  view.destroy();
});
