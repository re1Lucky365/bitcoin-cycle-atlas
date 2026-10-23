import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCycleSelection, cycleSelectionViewport, cycleOverviewViewport } from '../dist/cycle-selection.js';

const bottom = { id: 'bottom:observed:2022-11-09', date: '2022-11-09', price: 15809 };
const peak = { id: 'cycle-top:observed:2025-10-06', date: '2025-10-06', price: 124824 };
const future = { id: 'cycle-top:scenario:2029-08-12', date: '2029-08-12', price: 250000 };
const pastInterval = { id: '2025:bottom-cycle-top', fromId: bottom.id, toId: peak.id, startDate: bottom.date, endDate: peak.date };
const futureInterval = { id: 'scenario-base:bottom-cycle-top', fromId: bottom.id, toId: future.id, startDate: bottom.date, endDate: future.date };
const data = { markers: [bottom, peak, future], intervals: [pastInterval, futureInterval] };

test('a selected period resolves both exact current-model endpoint objects and connected periods', () => {
  const selected = resolveCycleSelection(data, { kind: 'interval', id: pastInterval.id });
  assert.strictEqual(selected.interval, pastInterval);
  assert.deepEqual(selected.markerIds, [bottom.id, peak.id]);
  const linked = resolveCycleSelection(data, { kind: 'marker', id: bottom.id });
  assert.strictEqual(linked.marker, bottom);
  assert.deepEqual(linked.intervals, [pastInterval, futureInterval]);
});

test('changing scenarios cannot reuse a removed forecast selection or a mismatched endpoint', () => {
  const replacement = { markers: [bottom, peak], intervals: [pastInterval] };
  assert.equal(resolveCycleSelection(replacement, { kind: 'interval', id: futureInterval.id }), null);
  assert.equal(resolveCycleSelection(replacement, { kind: 'marker', id: future.id }), null);
  assert.strictEqual(resolveCycleSelection(replacement, { kind: 'marker', id: peak.id }).marker, peak);
  assert.equal(resolveCycleSelection({ ...data, intervals: [{ ...pastInterval, endDate: '2025-10-07' }] }, { kind: 'interval', id: pastInterval.id }), null);
  assert.equal(resolveCycleSelection({ ...data, markers: [bottom] }, { kind: 'interval', id: pastInterval.id }), null);
});

test('show full period includes both endpoints and padding while respecting the available domain', () => {
  const selected = resolveCycleSelection(data, { kind: 'interval', id: pastInterval.id });
  const original = structuredClone(pastInterval);
  const full = cycleSelectionViewport(selected, { min: '2010-07-18', max: '2050-12-31' });
  assert.ok(full.start < bottom.date && full.end > peak.date);
  assert.deepEqual(cycleSelectionViewport(selected, { min: bottom.date, max: peak.date }), { start: bottom.date, end: peak.date });
  assert.equal(cycleSelectionViewport(selected, { min: '2023-01-01', max: '2050-12-31' }), null);
  assert.equal(cycleSelectionViewport(selected, { min: 'bad', max: '2050-12-31' }), null);
  assert.equal(cycleSelectionViewport(resolveCycleSelection(data, { kind: 'marker', id: peak.id }), { min: '2010-07-18', max: '2050-12-31' }), null);
  assert.deepEqual(pastInterval, original);
});

test('cycle overview includes actual and available scenario landmarks without extending to distant valuation targets', () => {
  const range = cycleOverviewViewport(data, { min: '2010-07-18', max: '2050-12-31' });
  assert.ok(range.start < bottom.date && range.end > future.date);
  assert.ok(range.end < '2031-01-01');
  const history = cycleOverviewViewport({ markers: [bottom, peak] }, { min: bottom.date, max: peak.date });
  assert.deepEqual(history, { start: bottom.date, end: peak.date });
  assert.equal(cycleOverviewViewport({ markers: [] }, { min: bottom.date, max: peak.date }), null);
  assert.equal(cycleOverviewViewport(data, { min: 'bad', max: peak.date }), null);
});
