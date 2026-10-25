import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

// Read-only regression replay of the three initial v1.24 integration findings.
// Uses actual exported controllers through an inert browser boundary; does not
// measure browser layout, touch behavior, painted colors, or market accuracy.
const root = path.resolve(process.argv[2] || fileURLToPath(new URL('../', import.meta.url)));
const sourceFiles = ['dist/app.js', 'dist/lab-view.js', 'dist/cycle-decision.js', 'dist/daily-data-view.js', 'dist/daily-data.css', 'dist/cycle-milestones.js', 'dist/long-horizon-forecast.js', 'dist/data/btc-daily.json', 'scripts/verify-cycle-decision.mjs', 'scripts/verify-cycle-table-integration.mjs', 'tests/helpers/structure-view-fixture.mjs', 'tests/helpers/daily-data-view-fixture.mjs'];
const initialHashes = {};
for (const name of sourceFiles) initialHashes[name] = createHash('sha256').update(await readFile(path.join(root, name))).digest('hex');
const load = name => import(pathToFileURL(path.join(root, name)).href);
const { buildCycleDecisionTable } = await load('dist/cycle-decision.js');
const { initDailyDataView, cycleTableRows } = await load('dist/daily-data-view.js');
const { dailyViewSurface } = await load('tests/helpers/daily-data-view-fixture.mjs');
const { structureViewFixture } = await load('tests/helpers/structure-view-fixture.mjs');
const dataset = JSON.parse(await readFile(path.join(root, 'dist/data/btc-daily.json'), 'utf8'));
const ui = await structureViewFixture({ root });
ui.setDataset(dataset);
const baseContext = ui.view.getCycleContext();
const repeatedContext = ui.view.getCycleContext();
const baseModel = buildCycleDecisionTable(baseContext);
const results = {
  command: 'node scripts/verify-cycle-table-integration.mjs',
  scope: 'Public-controller and generated-markup regression replay with inert DOM boundary; not browser visual verification.',
  node: process.version,
  asOf: baseModel.asOf,
  checks: [],
  hashes: {},
};
const check = (name, pass, detail = {}) => results.checks.push({ name, status: pass ? 'PASS' : 'ISSUE', ...detail });
check('shared cached chart context',
  baseContext.dataset === dataset && baseContext.prices === dataset.prices &&
  baseContext.forecast === repeatedContext.forecast && baseContext.milestones === repeatedContext.milestones);
const rejectedFresh = baseModel.rows.filter(row => !ui.view.focusCycleRow(row)).map(row => row.id);
check('fresh base rows focus successfully', rejectedFresh.length === 0, { rows: baseModel.rows.length, rejectedFresh });

const cycleCoverage = baseContext.milestones.cycles.filter(cycle => cycle.kind !== 'scenario').map(cycle => {
  const closing = cycle.markers['next-bottom'];
  const rows = cycleTableRows(baseModel, { cycle: cycle.id });
  return {
    cycleId: cycle.id, chartStart: cycle.startDate, chartEnd: cycle.endDate,
    chartClosingLow: closing?.date ?? null, tableLastDate: rows.at(-1)?.endDate ?? null,
    includesClosingLow: !closing || rows.some(row => row.endDate === closing.date && row.markerIds?.includes(closing.id)),
  };
});
check('cycle filters retain their chart closing low', cycleCoverage.every(cycle => cycle.includesClosingLow), { cycles: cycleCoverage });
const historicalSideways = baseModel.rows.filter(row => row.action?.id === 'sideways' && row.evidenceKind !== 'scenario' && row.evidenceKind !== 'current' && !row.current);
const conditionalSideways = baseModel.rows.filter(row => row.action?.id === 'sideways' && row.evidenceKind === 'scenario');
check('requested historical and conditional sideways periods exist', historicalSideways.length > 0 && conditionalSideways.length > 0, {
  historicalRows: historicalSideways.length, conditionalRows: conditionalSideways.length,
  currentRows: baseModel.rows.filter(row => row.action?.id === 'sideways' && (row.current || row.evidenceKind === 'current')).length,
});

const baseObserved = baseModel.rows.filter(row => row.evidenceKind !== 'scenario');
const baseConditional = baseModel.rows.filter(row => row.evidenceKind === 'scenario');
const scenarios = [];
for (const scenarioId of ['accelerated', 'wait', 'late', 'stress']) {
  ui.change('lab-scenario', scenarioId);
  const context = ui.view.getCycleContext();
  const model = buildCycleDecisionTable(context);
  const historicalStable = JSON.stringify(model.rows.filter(row => row.evidenceKind !== 'scenario')) === JSON.stringify(baseObserved);
  const newRowsRejected = model.rows.filter(row => !ui.view.focusCycleRow(row)).map(row => row.id);
  const staleRowsAccepted = baseConditional.filter(row => ui.view.focusCycleRow(row)).map(row => ({
    id: row.id, oldPrice: row.endPrice,
    newPrice: model.rows.find(next => next.chart?.markerId === row.chart?.markerId && next.evidenceKind === 'scenario')?.endPrice ?? null,
  }));
  scenarios.push({ scenarioId, rows: model.rows.length, historicalStable, newRowsRejected, staleRowsAccepted });
}
check('scenario changes preserve observed rows and accept valid new rows', scenarios.every(item => item.historicalStable && item.newRowsRejected.length === 0), { scenarios });
check('public focus rejects previous-scenario rows', scenarios.every(item => item.staleRowsAccepted.length === 0), {
  limitation: 'Controller-contract probe; no normal visible UI route to stale scenario rows was demonstrated.',
});

// The actual view controller and generated frame, using the existing inert DOM
// fixture. This checks one-table markup and failure behavior, not browser layout.
const surface = dailyViewSurface();
let broken = false;
const selections = [], downloads = [];
const view = initDailyDataView({ root: surface.root,
  getCycleContext() { if (broken) throw new RangeError('review replacement context unavailable'); return baseContext; },
  onSelectCycleRow: row => selections.push(row.id), download: name => downloads.push(name),
});
view.render();
check('one semantic table and removed indicator interface',
  (surface.root.innerHTML.match(/<table\b/g) || []).length === 1 &&
  !/SMA50|SMA200|RSI14|일별 원자료/.test(surface.root.innerHTML));
broken = true; view.render();
surface.click('export-raw'); surface.click('', { cycleRow: baseModel.rows[0].id });
check('throwing shared context clears stale judgments and disables actions',
  !surface.node('data-body').innerHTML.includes('data-cycle-row-id=') &&
  surface.node('export-raw').disabled && selections.length === 0 && downloads.length === 0 &&
  /판단을 보류/.test(surface.node('cycle-context').textContent));
broken = false; view.render();
check('shared context recovers without an old error title',
  surface.node('data-body').innerHTML.includes('data-cycle-row-id=') &&
  !surface.node('export-raw').disabled && !/review replacement/.test(surface.node('cycle-context').title));
view.destroy();

for (const name of sourceFiles) {
  results.hashes[name] = createHash('sha256').update(await readFile(path.join(root, name))).digest('hex');
}
check('source snapshot remained stable during probe', JSON.stringify(initialHashes) === JSON.stringify(results.hashes), { initialHashes });
results.status = results.checks.some(item => item.status === 'ISSUE') ? 'ISSUES' : 'PASS';
console.log(JSON.stringify(results, null, 2));
process.exitCode = results.status === 'PASS' ? 0 : 1;
