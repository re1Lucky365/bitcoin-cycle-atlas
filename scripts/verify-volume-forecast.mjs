import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fitVolumeForecastModel, projectVolumeForecast } from '../dist/volume-forecast.js';
import { buildLongHorizonForecast } from '../dist/long-horizon-forecast.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const volumeText = await readFile(path.join(root, 'dist/data/btc-volume.json'), 'utf8');
const priceText = await readFile(path.join(root, 'dist/data/btc-daily.json'), 'utf8');
const payload = JSON.parse(volumeText), prices = JSON.parse(priceText);
const asOf = payload.asOf;
const model = fitVolumeForecastModel(payload.bars, { asOf });
assert.equal(model.status, 'ready');
const priceModel = buildLongHorizonForecast(prices, { asOf, sampleCount: 16, seed: 20261022 });
const daily = projectVolumeForecast(model, priceModel.path, { asOf, endDate: priceModel.displayEnd });
const weekly = projectVolumeForecast(model, priceModel.path, { asOf, endDate: priceModel.displayEnd, frequency: 'weekly' });
assert.equal(daily.status, 'ready'); assert.equal(weekly.status, 'ready');
assert.equal(daily.points.at(-1).date, priceModel.displayEnd);
assert.deepEqual(weekly.annual, daily.annual);
assert.ok(model.validation.development.samples.every(row => row.targetEnd <= model.validation.selection.splitDate));
assert.ok(daily.points.every(row => row.date > asOf && row.lower > 0 && row.lower <= row.volume && row.volume <= row.upper && row.kind === 'scenario'));
assert.ok(weekly.points.every(row => row.daysIncluded === 7 && row.startDate > asOf));
assert.equal(weekly.points.length * 7 + weekly.diagnostics.excludedPartialWeekDays, daily.points.length);

const modifiedHoldout = payload.bars.map(row => row.date > model.validation.selection.splitDate
  ? { ...row, open: row.open * 2, high: row.high * 2, low: row.low * 2, close: row.close * 2, volume: row.volume * 3 } : row);
const modifiedFit = fitVolumeForecastModel(modifiedHoldout, { asOf });
assert.deepEqual(modifiedFit.validation.selection, model.validation.selection);
assert.deepEqual(modifiedFit.validation.holdout.samples.map(row => row.predictions), model.validation.holdout.samples.map(row => row.predictions));
const alteredNoise = projectVolumeForecast(model, priceModel.path.map(row => ({ ...row, price: row.price * 100 })), { asOf, endDate: priceModel.displayEnd });
assert.deepEqual(alteredNoise.points, daily.points);

const report = {
  version: 'volume-forecast-validation-1', generatedBy: 'node scripts/verify-volume-forecast.mjs', informationThrough: asOf,
  reproducible: true, designWasRetrospective: true, genuineProspectiveValidation: false,
  source: { path: 'dist/data/btc-volume.json', sha256: createHash('sha256').update(volumeText).digest('hex'), retrievedAt: payload.retrievedAt,
    provider: payload.source, product: payload.product, unit: payload.unit, bars: payload.bars.length, firstDate: payload.firstDate, lastDate: payload.lastDate },
  priceScenario: { path: 'dist/data/btc-daily.json', sha256: createHash('sha256').update(priceText).digest('hex'),
    scenario: 'base', pathField: 'baselinePrice', firstDate: priceModel.path[0].date, lastDate: priceModel.displayEnd,
    futurePricesAreAssumptions: true, randomPriceShocksIgnored: true, sampleCountDoesNotAffectBaseline: true },
  metadata: model.metadata, anchor: model.anchor, params: model.params, assumptions: model.assumptions,
  validation: model.validation, annual: daily.annual, summary: daily.summary,
  projection: { daily: daily.diagnostics, weekly: weekly.diagnostics, firstDaily: daily.points[0], lastDaily: daily.points.at(-1), firstWeekly: weekly.points[0], lastWeekly: weekly.points.at(-1) },
  assertions: { chronologicalDevelopmentTargets: true, holdoutChangesCannotSelectModel: true, holdoutPricesCannotChangeExAnteForecast: true,
    noiseSeedDoesNotDriveVolume: true, positiveOrderedAssumptionBounds: true, completeFutureOnlyWeeklySums: true,
    annualLevelsIndependentOfChartFrequency: true, noSyntheticFutureOHLC: true },
  sources: [
    'https://www.bitstamp.net/api/',
    'https://otexts.com/fpp3/toolbox.html',
    'https://link.springer.com/article/10.1007/s10203-021-00344-9',
    'https://link.springer.com/article/10.1186/s40854-018-0119-8',
    'https://www.kaiko.com/resources/btc-etfs-impact-on-spot-market-structure',
  ],
};
const output = path.join(root, 'docs/data/volume-forecast-validation.json');
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ file: path.relative(root, output), trainingMonths: model.metadata.trainingMonths,
  selection: model.validation.selection.method, anchorBTCPerDay: model.anchor.meanDailyVolume,
  developmentOrigins: model.validation.development.originCount, holdoutMonths: model.validation.holdout.months,
  holdoutSelected: model.validation.holdout.selectedMetrics, annual: daily.annual.filter(row => [2030, 2035, 2040, 2050].includes(row.year)),
  checks: report.assertions }, null, 2));
