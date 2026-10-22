#!/usr/bin/env node
/** Reproduce the live cycle clock from completed observations; no network I/O. */
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { cycleCalibrationSnapshot } from '../dist/cycle-calibration.js';
import { buildLongHorizonForecast } from '../dist/long-horizon-forecast.js';
import { utcDay, dateFromDay } from '../dist/cycle-engine.js';
import { validateSnapshot } from './refresh-data.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CALIBRATION_RECORD_VERSION = 'cycle-calibration-record-v1';

export function createCalibrationRecord(dataset, { now = new Date() } = {}) {
  const rows = validateSnapshot(dataset, { now, label: 'Cycle calibration input' });
  const asOf = rows.at(-1).date;
  const calibration = cycleCalibrationSnapshot(dataset, { asOf });
  // Timing does not depend on the number of stochastic sample paths. A small
  // ensemble verifies the identical production clock without storing paths.
  const model = buildLongHorizonForecast(dataset, {
    asOf, referenceDate: dateFromDay(utcDay(asOf) + 1), sampleCount: 16,
    scenario: 'base', applyCycleCalibration: true,
  });
  assert.deepEqual(model.cycleCalibration.current, calibration.current,
    'The published daily clock and the runtime future model must agree');
  assert.equal(model.asOf, asOf);
  assert.equal(calibration.asOf, asOf);
  assert.equal(model.cycleCalibration.forecastApplication.sourceValuationAnchorsChanged, false);
  const clock = model.nominalClock;
  return {
    schemaVersion: CALIBRATION_RECORD_VERSION,
    generatedBy: 'node scripts/refresh-cycle-calibration.mjs',
    source: {
      path: 'dist/data/btc-daily.json',
      pricesSha256: createHash('sha256').update(JSON.stringify(dataset.prices)).digest('hex'),
      provider: dataset.meta.sourceName, metric: dataset.meta.metric,
      firstDate: rows[0].date, lastDate: asOf, observationCount: rows.length,
      completedUtcObservationsOnly: true,
    },
    ...calibration,
    futureApplication: {
      ...model.cycleCalibration.forecastApplication,
      displayEnd: model.displayEnd,
      nominalPeakDate: clock?.nominalPeakDate ?? null,
      effectivePeakDate: clock?.effectivePeakDate ?? null,
      nominalTroughDate: clock?.nominalTroughDate ?? null,
      nextLowDate: clock?.nextLowDate ?? null,
      timingAdjustment: clock?.timingAdjustment ?? null,
      clockVerifiedWithSampleCount: 16,
    },
    recentDailyStates: model.cycleCalibration.series.slice(-180).map(point => ({
      date: point.date, state: point.state,
      appliedShiftDays: point.appliedShiftDays, cycleLengthDays: point.cycleLengthDays,
    })),
    interpretation: {
      automaticUpdate: 'Recalculated after validated completed UTC price observations are appended.',
      unchangedObservationsProduceIdenticalRecord: true,
      wallClockIsNotMarketData: true,
      historicalSignalsUseTheirOwnObservedPrefix: true,
      calibratedPredictionInterval: false,
      tradingSignal: false,
    },
  };
}

export async function refreshCycleCalibration({
  datasetPath = path.join(root, 'dist/data/btc-daily.json'),
  outputPath = path.join(root, 'dist/data/cycle-calibration.json'),
  check = false, now = new Date(),
} = {}) {
  if (path.resolve(datasetPath) === path.resolve(outputPath)) throw new Error('Input and output paths must differ');
  const dataset = JSON.parse(await readFile(datasetPath, 'utf8'));
  const record = createCalibrationRecord(dataset, { now });
  const expected = `${JSON.stringify(record, null, 2)}\n`;
  let previous = null;
  try { previous = await readFile(outputPath, 'utf8'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const changed = previous !== expected;
  if (check && changed) throw new Error('Cycle calibration artifact is absent, stale or inconsistent with completed observations. Run npm run refresh:cycle.');
  if (!check && changed) {
    await mkdir(path.dirname(outputPath), { recursive: true });
    const temporary = `${outputPath}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, expected, { flag: 'wx', mode: 0o644 });
      await rename(temporary, outputPath);
    } finally { await rm(temporary, { force: true }); }
  }
  return {
    status: check ? 'verified' : changed ? 'updated' : 'unchanged',
    asOf: record.asOf, version: record.version, observationCount: record.observationCount,
    state: record.current.state, shiftDays: record.current.appliedShiftDays,
    referenceCount: record.current.referenceCount,
    futureApplied: record.futureApplication.applied,
    futureAppliedShiftDays: record.futureApplication.appliedShiftDays,
    futureReason: record.futureApplication.reason,
    sourcePricesSha256: record.source.pricesSha256,
    output: path.relative(root, outputPath),
  };
}

export function parseCalibrationArgs(args) {
  const options = {};
  const names = new Map([['--dataset', 'datasetPath'], ['--output', 'outputPath']]);
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (flag === '--check' && !options.check) { options.check = true; continue; }
    const key = names.get(flag);
    if (!key || options[key] || !args[index + 1] || args[index + 1].startsWith('--')) {
      throw new Error('Usage: node scripts/refresh-cycle-calibration.mjs [--check] [--dataset path] [--output path]');
    }
    options[key] = path.resolve(args[++index]);
  }
  return options;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { console.log(JSON.stringify(await refreshCycleCalibration(parseCalibrationArgs(process.argv.slice(2))))); }
  catch (error) { console.error(`Cycle calibration validation failed: ${error.message}`); process.exitCode = 1; }
}
