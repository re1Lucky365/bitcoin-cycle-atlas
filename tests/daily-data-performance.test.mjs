import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCycleDecisionTable } from '../dist/cycle-decision.js';
import { initDailyDataView } from '../dist/daily-data-view.js';
import { cycleViewContext, dailyViewSurface } from './helpers/daily-data-view-fixture.mjs';

// Work counters exercise real render/controller calls; they do not measure paint.
test('repeated rendering reuses the shared cycle model and does not rewrite an identical table', () => {
  const context = cycleViewContext(), ui = dailyViewSurface(); let builds = 0, reads = 0;
  const view = initDailyDataView({ root: ui.root, getCycleContext() { reads++; return { ...context }; }, buildModel(input) { builds++; return buildCycleDecisionTable(input); } });
  view.render(); const initial = ui.node('data-body').innerHTML; ui.resetWork();
  for (let index = 0; index < 50; index++) view.render();
  assert.equal(reads, 51); assert.equal(builds, 1);
  assert.equal(ui.node('data-body').innerHTML, initial);
  assert.equal(ui.work()['data-body']?.writes || 0, 0);
  view.destroy();
});

test('display filters only select the existing model and never fetch or analyze another asset', () => {
  const context = cycleViewContext(), ui = dailyViewSurface(); let builds = 0, sourceReads = 0, unrelatedLoads = 0;
  const view = initDailyDataView({ root: ui.root, getCycleContext() { sourceReads++; return context; }, loadAsset() { unrelatedLoads++; throw new Error('unneeded asset load'); }, buildModel(input) { builds++; return buildCycleDecisionTable(input); } });
  view.render();
  for (let index = 0; index < 25; index++) {
    ui.click('', { cycleEvidence: 'scenario' }); ui.change('cycle-scope', 'all');
    ui.click('', { cycleEvidence: 'observed' }); ui.change('cycle-scope', 'recent');
  }
  assert.equal(builds, 1); assert.equal(sourceReads, 1); assert.equal(unrelatedLoads, 0);
  assert.match(ui.node('data-body').innerHTML, /data-evidence="observed"/);
  assert.doesNotMatch(ui.node('data-body').innerHTML, /data-evidence="scenario"/);
  assert.equal(ui.work()['daily-annual-table'], undefined);
  assert.equal(ui.work()['daily-monthly-table'], undefined);
  view.destroy();
});

test('a genuinely changed chart or dataset invalidates the model once', () => {
  let context = cycleViewContext(), builds = 0; const ui = dailyViewSurface();
  const view = initDailyDataView({ root: ui.root, getCycleContext: () => context, buildModel(input) { builds++; return buildCycleDecisionTable(input); } });
  view.render(); const first = ui.node('data-body').innerHTML;
  context = cycleViewContext({ offset: 500, scenarioId: 'revised' }); view.render();
  assert.equal(builds, 2); assert.notEqual(ui.node('data-body').innerHTML, first);
  view.render(); assert.equal(builds, 2);
  view.destroy();
});
