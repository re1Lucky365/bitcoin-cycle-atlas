import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { computeRollingStates, detectDirectionalChanges } from '../dist/market-structure.js';
import { structureViewFixture } from './helpers/structure-view-fixture.mjs';

const dataset = JSON.parse(await readFile(new URL('../dist/data/btc-daily.json', import.meta.url), 'utf8'));
const plain = value => JSON.parse(JSON.stringify(value));

test('comparison scope and alignment reuse analysis while rendering identical current states and pivots', async () => {
  const ui = await structureViewFixture();
  ui.setDataset(dataset); ui.showCompare();
  const first = { ...ui.calls };
  for (const frequency of ['weekly', 'daily']) {
    ui.frequency(frequency);
    const expectedStates = computeRollingStates(dataset, { frequency, threshold: 0.12 }).points;
    const expectedTurns = detectDirectionalChanges(dataset, { frequency, threshold: 0.12 }).pivots.map(pivot => ({ date: pivot.eventDate, price: pivot.eventPrice, type: pivot.type, confirmationDate: pivot.confirmationDate }));
    for (const scope of ['2014', '2018', '2022', '1990', 'all']) {
      ui.change('structure-scope', scope);
      assert.deepEqual(plain(ui.draws.at(-1).states), plain(expectedStates));
      assert.deepEqual(plain(ui.draws.at(-1).turns), plain(expectedTurns));
    }
    ui.change('structure-alignment', 'trough'); ui.change('structure-alignment', 'calendar');
  }
  assert.equal(ui.calls.analysis, first.analysis, 'scope/alignment/frequency do not change the cached full analysis');
  assert.equal(ui.calls.rolling, 0, 'full analysis already contains both daily and weekly state points');
  assert.equal(ui.calls.directional, 1, 'only base price preparation computes its own default pivots');
  assert.equal(ui.calls.chart - first.chart, 16, 'reuse must not skip requested visible redraws');
});

test('threshold changes and same-date source revisions invalidate reused comparison results', async () => {
  const ui = await structureViewFixture();
  ui.setDataset(dataset); ui.showCompare();
  for (const threshold of [0.08, 0.12, 0.20]) {
    ui.change('structure-threshold', threshold);
    for (const frequency of ['daily', 'weekly']) {
      ui.frequency(frequency);
      assert.deepEqual(plain(ui.draws.at(-1).states), plain(computeRollingStates(dataset, { frequency, threshold }).points));
      assert.deepEqual(plain(ui.draws.at(-1).turns), plain(detectDirectionalChanges(dataset, { frequency, threshold }).pivots.map(pivot => ({ date: pivot.eventDate, price: pivot.eventPrice, type: pivot.type, confirmationDate: pivot.confirmationDate }))));
    }
  }
  const beforeRevision = ui.draws.at(-1).states.at(-1).price, oldAnalysisCount = ui.calls.analysis;
  const revised = { ...dataset, prices: dataset.prices.map(([date, price], index) => [date, index >= dataset.prices.length - 14 ? price * 1.05 : price]) };
  assert.equal(revised.prices.at(-1)[0], dataset.prices.at(-1)[0]);
  ui.setDataset(revised);
  assert.equal(ui.calls.analysis, oldAnalysisCount + 1, 'same final date must not hide a replacement dataset');
  assert.notEqual(ui.draws.at(-1).states.at(-1).price, beforeRevision);
  assert.deepEqual(plain(ui.draws.at(-1).states), plain(computeRollingStates(revised, { frequency: 'weekly', threshold: 0.20 }).points));
  const afterRevision = ui.calls.chart;
  ui.setDataset(revised);
  assert.equal(ui.calls.chart, afterRevision, 'unchanged identity keeps the existing no-op contract');
  assert.equal(ui.calls.rolling, 0); assert.equal(ui.calls.directional, 2);
});
