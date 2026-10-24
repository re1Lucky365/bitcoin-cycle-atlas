#!/usr/bin/env node
/**
 * Append validated, completed Coin Metrics UTC days to the public snapshot.
 *
 * Live:    node scripts/refresh-data.mjs
 * Check:   node scripts/refresh-data.mjs --dry-run
 * Offline: node scripts/refresh-data.mjs --input fixture.json --dry-run
 * Tests may use --dataset /tmp/current.json --metadata /tmp/data-update.js.
 * An input fixture uses the { meta, prices } dataset schema, not an API page.
 * Research JSON, backtests and published figures are never regenerated here.
 */
import { readFile, writeFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { COMMUNITY_ENDPOINT, START_DATE, fetchLatestDataset, validateFullSeries } from '../dist/data-source.js';
import { utcDay } from '../dist/cycle-engine.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SCHEDULE_UTC = '20 0,6,12,18 * * *';
export const SCHEDULE_KST = Object.freeze(['03:20', '09:20', '15:20', '21:20']);

function validTimestamp(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|\+00:00)$/.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new TypeError(`${label} must be a valid UTC timestamp`);
  }
  utcDay(value.slice(0, 10));
  return Date.parse(value);
}

/** Validate the full daily schema and provenance before comparing snapshots. */
export function validateSnapshot(dataset, { now = new Date(), label = 'Dataset' } = {}) {
  if (!dataset || typeof dataset !== 'object' || Array.isArray(dataset) || !dataset.meta || typeof dataset.meta !== 'object' || Array.isArray(dataset.meta)) {
    throw new TypeError(`${label} must contain meta and prices`);
  }
  if (!Array.isArray(dataset.prices) || dataset.prices.some(row => !Array.isArray(row) || row.length !== 2)) {
    throw new TypeError(`${label} prices must contain only [UTC date, numeric price] rows`);
  }
  const rows = validateFullSeries(dataset.prices);
  const first = rows[0], last = rows.at(-1), meta = dataset.meta;
  const today = now.toISOString().slice(0, 10);
  if (last.date >= today) throw new Error(`${label} includes an unfinished or future UTC day: ${last.date}`);
  if (meta.firstDate !== first.date || meta.lastDate !== last.date || meta.count !== rows.length || meta.missingDayCount !== 0) {
    throw new Error(`${label} metadata does not match its complete daily observations`);
  }
  if (meta.metric !== 'PriceUSD' || meta.frequency !== '1d' || meta.timezone !== 'UTC' || meta.sourceName !== 'Coin Metrics Community API') {
    throw new Error(`${label} changed its metric, frequency, timezone or provider`);
  }
  if (meta.license !== 'CC BY-NC 4.0' || meta.licenseUrl !== 'https://creativecommons.org/licenses/by-nc/4.0/' || meta.attributionUrl !== 'https://coinmetrics.io/') {
    throw new Error(`${label} is missing the expected source attribution and license`);
  }
  const source = new URL(meta.source);
  if (`${source.origin}${source.pathname}` !== COMMUNITY_ENDPOINT || source.username || source.password || source.hash) {
    throw new Error(`${label} changed its source endpoint`);
  }
  for (const [key, value] of Object.entries({ assets: 'btc', metrics: 'PriceUSD', frequency: '1d', start_time: START_DATE })) {
    if (source.searchParams.getAll(key).length !== 1 || source.searchParams.get(key) !== value) {
      throw new Error(`${label} source changed ${key}`);
    }
  }
  const sourceEnd = source.searchParams.get('end_time');
  utcDay(sourceEnd);
  if (source.searchParams.getAll('end_time').length !== 1 || sourceEnd > today || last.date >= sourceEnd) {
    throw new Error(`${label} source end date cannot establish completed observations`);
  }
  if (meta.completedDaysBeforeUtc != null) {
    utcDay(meta.completedDaysBeforeUtc);
    if (meta.completedDaysBeforeUtc !== sourceEnd) throw new Error(`${label} completion boundary differs from its source request`);
  }
  const retrievedAt = validTimestamp(meta.retrievedAt, `${label} retrievedAt`);
  if (retrievedAt > now.getTime() + 5_000 || meta.retrievedAt.slice(0, 10) < sourceEnd) {
    throw new Error(`${label} retrieval time is inconsistent with its completion boundary`);
  }
  return rows;
}

/** No market-return threshold is used: a large genuine price move is data. */
export function planRefresh(current, candidate, { now = new Date(), previousUpdate = null, runUrl = null } = {}) {
  const before = validateSnapshot(current, { now, label: 'Bundled dataset' });
  const after = validateSnapshot(candidate, { now, label: 'Fetched dataset' });
  if (after.length < before.length || after.at(-1).date < before.at(-1).date) {
    throw new Error('Fetched dataset moves backwards or truncates the published series');
  }
  for (let index = 0; index < before.length; index++) {
    if (before[index].date !== after[index].date || before[index].price !== after[index].price) {
      throw new Error(`Published observation changed at ${before[index].date}; source revisions require review`);
    }
  }
  const appendedRows = after.length - before.length;
  const checkedAt = now.toISOString();
  let dataUpdatedAt = current.meta.retrievedAt;
  if (previousUpdate?.latestObservationDate === before.at(-1).date && previousUpdate?.dataUpdatedAt) {
    validTimestamp(previousUpdate.dataUpdatedAt, 'Previous dataUpdatedAt');
    dataUpdatedAt = previousUpdate.dataUpdatedAt;
  }
  const update = {
    checkedAt,
    dataUpdatedAt: appendedRows ? checkedAt : dataUpdatedAt,
    latestObservationDate: after.at(-1).date,
    status: appendedRows ? 'validated' : 'no-change',
    source: candidate.meta.source,
    runUrl,
    scheduleUtc: SCHEDULE_UTC,
    scheduleKst: [...SCHEDULE_KST],
  };
  return { appendedRows, dataset: appendedRows ? candidate : null, update };
}

export function metadataModule(update) {
  return `// Generated by scripts/refresh-data.mjs after successful validation.\n// checkedAt is the successful check time; latestObservationDate is the UTC data cutoff.\nexport const DATA_UPDATE = Object.freeze(${JSON.stringify(update, null, 2)});\n`;
}

function workflowRunUrl(env = process.env) {
  if (!env.GITHUB_RUN_ID || !env.GITHUB_REPOSITORY) return null;
  if (!/^\d+$/.test(env.GITHUB_RUN_ID) || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(env.GITHUB_REPOSITORY) || env.GITHUB_SERVER_URL !== 'https://github.com') {
    throw new Error('Invalid public GitHub workflow run coordinates');
  }
  return `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`;
}

async function previousMetadata(filename) {
  let source;
  try { source = await readFile(filename, 'utf8'); } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  const match = /export const DATA_UPDATE = Object\.freeze\((\{[\s\S]*\})\);?\s*$/.exec(source);
  if (!match) throw new Error('Existing data-update.js is not a generated metadata module');
  return JSON.parse(match[1]);
}

async function writeAtomically(files) {
  const staged = [];
  try {
    // Stage every file first; an invalid response never reaches this function.
    for (const [filename, contents] of files) {
      const temporary = `${filename}.${randomUUID()}.tmp`;
      staged.push([temporary, filename]);
      await writeFile(temporary, contents, { flag: 'wx', mode: 0o644 });
    }
    for (const [temporary, filename] of staged) await rename(temporary, filename);
  } finally {
    await Promise.all(staged.map(([temporary]) => rm(temporary, { force: true })));
  }
}

export async function refreshData({
  input = null, dryRun = false,
  datasetPath = path.join(root, 'dist/data/btc-daily.json'),
  metadataPath = path.join(root, 'dist/data-update.js'),
} = {}) {
  if (path.resolve(datasetPath) === path.resolve(metadataPath)) throw new Error('Dataset and metadata paths must differ');
  const [current, previousUpdate] = await Promise.all([
    readFile(datasetPath, 'utf8').then(JSON.parse), previousMetadata(metadataPath),
  ]);
  // Reject a damaged local baseline before making any network request.
  validateSnapshot(current, { label: 'Bundled dataset' });
  const candidate = input
    ? JSON.parse(await readFile(input, 'utf8'))
    : await fetchLatestDataset({ signal: AbortSignal.timeout(90_000) });
  const plan = planRefresh(current, candidate, { previousUpdate, runUrl: workflowRunUrl(), now: new Date() });
  if (!dryRun) {
    const files = [];
    if (plan.dataset) files.push([datasetPath, `${JSON.stringify(plan.dataset)}\n`]);
    files.push([metadataPath, metadataModule(plan.update)]);
    await writeAtomically(files);
  }
  return {
    dryRun, status: plan.update.status, appendedRows: plan.appendedRows,
    latestObservationDate: plan.update.latestObservationDate,
    checkedAt: plan.update.checkedAt, dataUpdatedAt: plan.update.dataUpdatedAt,
    datasetChanged: plan.dataset !== null,
  };
}

export function parseArgs(args) {
  const options = {};
  const values = new Map([['--input', 'input'], ['--dataset', 'datasetPath'], ['--metadata', 'metadataPath']]);
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (flag === '--dry-run' && !options.dryRun) { options.dryRun = true; continue; }
    const name = values.get(flag);
    if (!name || options[name] || !args[index + 1] || args[index + 1].startsWith('--')) {
      throw new Error('Usage: node scripts/refresh-data.mjs [--dry-run] [--input fixture.json] [--dataset path] [--metadata path]');
    }
    options[name] = path.resolve(args[++index]);
  }
  return options;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    console.log(JSON.stringify(await refreshData(parseArgs(process.argv.slice(2)))));
  } catch (error) {
    console.error(`Data refresh failed; no public deployment was requested: ${error.message}`);
    process.exitCode = 1;
  }
}
