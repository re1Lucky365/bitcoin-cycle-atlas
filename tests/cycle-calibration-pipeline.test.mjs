import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, writeFile, mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createCalibrationRecord, refreshCycleCalibration, parseCalibrationArgs } from '../scripts/refresh-cycle-calibration.mjs';

const data = JSON.parse(await readFile(new URL('./fixtures/btc-daily-2026-10-20.json', import.meta.url), 'utf8'));
const now = new Date('2026-10-22T12:00:00Z');
function snapshot(prices) {
  return { ...structuredClone(data), prices: structuredClone(prices), meta: {
    ...data.meta, firstDate: prices[0][0], lastDate: prices.at(-1)[0], count: prices.length,
  } };
}
async function files(callback) {
  const dir = await mkdtemp(path.join(tmpdir(), 'btc-clock-'));
  const options = { datasetPath: path.join(dir, 'daily.json'), outputPath: path.join(dir, 'clock.json'), now };
  await writeFile(options.datasetPath, JSON.stringify(data));
  try { await callback(options); } finally { await rm(dir, { recursive: true, force: true }); }
}

test('calibration publication is deterministic and repeated checks do not write or churn on retrieval time', async () => {
  await files(async options => {
    const first = await refreshCycleCalibration(options);
    const bytes = await readFile(options.outputPath, 'utf8');
    const before = await stat(options.outputPath, { bigint: true });
    const again = await refreshCycleCalibration({ ...options, now: new Date('2026-10-23T12:00:00Z') });
    assert.equal(first.status, 'updated');
    assert.equal(again.status, 'unchanged');
    assert.equal((await stat(options.outputPath, { bigint: true })).mtimeNs, before.mtimeNs);
    const retrieved = structuredClone(data); retrieved.meta.retrievedAt = now.toISOString();
    await writeFile(options.datasetPath, JSON.stringify(retrieved));
    assert.equal((await refreshCycleCalibration(options)).status, 'unchanged');
    assert.equal((await refreshCycleCalibration({ ...options, check: true })).status, 'verified');
    assert.equal(await readFile(options.outputPath, 'utf8'), bytes);
    const record = JSON.parse(bytes);
    assert.equal(record.futureApplication.sourceValuationAnchorsChanged, false);
    assert.equal(record.current.asOf, record.source.lastDate);
    assert.equal(record.futureApplication.timingAdjustment.asOf, record.asOf);
  });
});

test('appending a real completed day updates the daily clock, source hash and actual future integration', () => {
  const before = createCalibrationRecord(snapshot(data.prices.slice(0, -1)), { now });
  const after = createCalibrationRecord(data, { now });
  assert.equal(after.observationCount, before.observationCount + 1);
  assert.notEqual(after.source.pricesSha256, before.source.pricesSha256);
  assert.equal(after.asOf, data.prices.at(-1)[0]);
  assert.equal(after.recentDailyStates.at(-1).date, after.asOf);
  assert.equal(after.futureApplication.appliedShiftDays, after.current.appliedShiftDays);
  assert.equal(after.futureApplication.applied, true);
});

test('stale or altered calibration artifacts fail verification without overwriting them', async () => {
  await files(async options => {
    await assert.rejects(refreshCycleCalibration({ ...options, check: true }), /absent, stale or inconsistent/);
    await refreshCycleCalibration(options);
    const record = JSON.parse(await readFile(options.outputPath, 'utf8'));
    record.current.appliedShiftDays += 1;
    const tampered = JSON.stringify(record);
    await writeFile(options.outputPath, tampered);
    await assert.rejects(refreshCycleCalibration({ ...options, check: true }), /inconsistent/);
    assert.equal(await readFile(options.outputPath, 'utf8'), tampered);
  });
});

test('invalid or unfinished observations fail before replacing a published calibration', async () => {
  await files(async options => {
    await writeFile(options.outputPath, 'published-clock');
    const incomplete = snapshot(data.prices.filter(([date]) => date !== '2024-05-01'));
    await writeFile(options.datasetPath, JSON.stringify(incomplete));
    await assert.rejects(refreshCycleCalibration(options), /missing UTC day/);
    assert.equal(await readFile(options.outputPath, 'utf8'), 'published-clock');
    const unfinished = snapshot([...data.prices, ...['2026-10-21','2026-10-22'].map(date => [date, data.prices.at(-1)[1]])]);
    await writeFile(options.datasetPath, JSON.stringify(unfinished));
    await assert.rejects(refreshCycleCalibration(options), /unfinished or future UTC day/);
    assert.equal(await readFile(options.outputPath, 'utf8'), 'published-clock');
    await assert.rejects(refreshCycleCalibration({ ...options, outputPath: options.datasetPath }), /must differ/);
  });
});

test('calibration CLI makes check and alternate artifact paths explicit', () => {
  const options = parseCalibrationArgs(['--check', '--dataset', '/tmp/daily.json', '--output', '/tmp/clock.json']);
  assert.deepEqual(options, { check: true, datasetPath: '/tmp/daily.json', outputPath: '/tmp/clock.json' });
  for (const flags of [['--check', '--check'], ['--output'], ['--unknown'], ['--dataset', '--check']]) assert.throws(() => parseCalibrationArgs(flags), /Usage:/);
});
