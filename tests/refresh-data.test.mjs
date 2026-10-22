import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, writeFile, mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { planRefresh, refreshData, validateSnapshot, metadataModule, parseArgs, SCHEDULE_UTC, SCHEDULE_KST } from '../scripts/refresh-data.mjs';

// The immutable fixture is the exact published research dataset. Advancement
// tests append an already observed real day to a truncated copy, never a forecast.
const fixturePath = fileURLToPath(new URL('./fixtures/btc-daily-2026-10-20.json', import.meta.url));
const full = JSON.parse(await readFile(fixturePath, 'utf8'));
const now = new Date('2026-10-22T12:00:00.000Z');
function snapshot(prices) {
  return { ...structuredClone(full), prices: structuredClone(prices), meta: {
    ...full.meta, firstDate: prices[0][0], lastDate: prices.at(-1)[0], count: prices.length,
  } };
}
const before = snapshot(full.prices.slice(0, -1));
const initialMetadata = {
  checkedAt: '2026-10-21T10:00:00.000Z', dataUpdatedAt: '2026-10-21T09:16:20.212Z',
  latestObservationDate: before.meta.lastDate, status: 'validated', source: before.meta.source,
  runUrl: null, scheduleUtc: SCHEDULE_UTC, scheduleKst: [...SCHEDULE_KST],
};

async function temporaryFiles(callback) {
  const dir = await mkdtemp(path.join(tmpdir(), 'btc-refresh-'));
  const datasetPath = path.join(dir, 'current.json'), metadataPath = path.join(dir, 'data-update.js');
  await writeFile(datasetPath, `${JSON.stringify(before, null, 2)}\n`);
  await writeFile(metadataPath, metadataModule(initialMetadata));
  try { return await callback({ dir, datasetPath, metadataPath }); }
  finally { await rm(dir, { recursive: true, force: true }); }
}

test('a validated extension appends the exact real observation and separates check time from cutoff', () => {
  const original = JSON.stringify(before);
  const result = planRefresh(before, full, { now, previousUpdate: initialMetadata, runUrl: 'https://github.com/twoimo/bitcoin-cycle-atlas/actions/runs/123' });
  assert.equal(result.appendedRows, 1);
  assert.equal(result.update.status, 'validated');
  assert.equal(result.update.latestObservationDate, '2026-10-20');
  assert.equal(result.update.checkedAt, now.toISOString());
  assert.equal(result.update.dataUpdatedAt, now.toISOString());
  assert.deepEqual(result.dataset.prices.at(-1), full.prices.at(-1));
  assert.equal(JSON.stringify(before), original);
  assert.deepEqual(result.update.scheduleKst, ['03:20', '09:20', '15:20', '21:20']);
  assert.equal(result.update.scheduleUtc, '20 0,6,12,18 * * *');
});

test('no-change records a fresh check but preserves the prior data-update timestamp', () => {
  const previousUpdate = { ...initialMetadata, latestObservationDate: full.meta.lastDate };
  const result = planRefresh(full, structuredClone(full), { now, previousUpdate });
  assert.equal(result.dataset, null);
  assert.equal(result.appendedRows, 0);
  assert.equal(result.update.status, 'no-change');
  assert.equal(result.update.checkedAt, now.toISOString());
  assert.equal(result.update.dataUpdatedAt, initialMetadata.dataUpdatedAt);
});

test('backward, missing-day, revised-history and malformed datasets fail before publication', () => {
  assert.throws(() => planRefresh(full, before, { now }), /backwards|truncates/);
  const missing = snapshot(full.prices.filter(([date]) => date !== '2024-05-01'));
  assert.throws(() => planRefresh(before, missing, { now }), /missing UTC day/);
  const revised = structuredClone(full); revised.prices[100][1] *= 2;
  assert.throws(() => planRefresh(before, revised, { now }), /changed.*source revisions require review/);
  for (const [label, mutate, pattern] of [
    ['string price', data => { data.prices.at(-1)[1] = '82898'; }, /positive finite/],
    ['intraday date', data => { data.prices.at(-1)[0] += 'T12:00:00Z'; }, /Invalid UTC date/],
    ['extra column', data => { data.prices.at(-1).push('unexpected'); }, /only.*rows/],
    ['wrong count', data => { data.meta.count--; }, /metadata does not match/],
    ['wrong timezone', data => { data.meta.timezone = 'Asia/Seoul'; }, /timezone or provider/],
    ['wrong source', data => { data.meta.source = data.meta.source.replace('community-api.coinmetrics.io', 'example.com'); }, /source endpoint/],
    ['wrong boundary', data => { data.meta.completedDaysBeforeUtc = '2026-10-22'; }, /completion boundary/],
    ['future retrieval', data => { data.meta.retrievedAt = '2099-01-01T00:00:00Z'; }, /retrieval time/],
    ['invalid calendar timestamp', data => { data.meta.retrievedAt = '2026-02-30T00:00:00Z'; }, /Invalid calendar/],
  ]) {
    const malformed = structuredClone(full); mutate(malformed);
    assert.throws(() => validateSnapshot(malformed, { now }), pattern, label);
  }
});

test('unfinished or future UTC observations cannot enter the public bundle', () => {
  for (const date of ['2026-10-22', '2026-10-23']) {
    const unfinished = snapshot([...full.prices, [date, full.prices.at(-1)[1]]]);
    assert.throws(() => planRefresh(before, unfinished, { now }), /unfinished or future UTC day/);
  }
});

test('offline dry-run and rejection leave both output files byte-for-byte unchanged', async () => {
  await temporaryFiles(async options => {
    const oldDataset = await readFile(options.datasetPath), oldMetadata = await readFile(options.metadataPath);
    const started = Date.now();
    const result = await refreshData({ ...options, input: fixturePath, dryRun: true });
    assert.equal(result.datasetChanged, true);
    assert.equal(result.appendedRows, 1);
    assert.ok(Date.parse(result.checkedAt) >= started && Date.parse(result.checkedAt) <= Date.now());
    assert.deepEqual(await readFile(options.datasetPath), oldDataset);
    assert.deepEqual(await readFile(options.metadataPath), oldMetadata);
    const missing = snapshot(full.prices.filter(([date]) => date !== '2024-05-01'));
    const malformedPath = path.join(options.dir, 'invalid.json');
    await writeFile(malformedPath, JSON.stringify(missing));
    await assert.rejects(refreshData({ ...options, input: malformedPath }), /missing UTC day/);
    assert.deepEqual(await readFile(options.datasetPath), oldDataset);
    assert.deepEqual(await readFile(options.metadataPath), oldMetadata);
  });
});

test('a valid offline refresh writes the exact data once; later checks update metadata only', async () => {
  await temporaryFiles(async options => {
    const first = await refreshData({ ...options, input: fixturePath });
    assert.equal(first.status, 'validated');
    assert.deepEqual(JSON.parse(await readFile(options.datasetPath, 'utf8')), full);
    const dataBytes = await readFile(options.datasetPath), dataStat = await stat(options.datasetPath, { bigint: true });
    const second = await refreshData({ ...options, input: fixturePath });
    assert.equal(second.status, 'no-change');
    assert.equal(second.dataUpdatedAt, first.dataUpdatedAt);
    assert.deepEqual(await readFile(options.datasetPath), dataBytes);
    assert.equal((await stat(options.datasetPath, { bigint: true })).mtimeNs, dataStat.mtimeNs);
    const metadata = await readFile(options.metadataPath, 'utf8');
    assert.match(metadata, /"status": "no-change"/);
    assert.match(metadata, /"latestObservationDate": "2026-10-20"/);
    const module = await import(`data:text/javascript;base64,${Buffer.from(metadata).toString('base64')}`);
    assert.equal(module.DATA_UPDATE.status, 'no-change');
    assert.equal(module.DATA_UPDATE.dataUpdatedAt, first.dataUpdatedAt);
  });
});

test('a failed live request preserves the already published dataset and metadata', async () => {
  await temporaryFiles(async options => {
    const oldDataset = await readFile(options.datasetPath), oldMetadata = await readFile(options.metadataPath);
    const originalFetch = globalThis.fetch;
    let calls = 0;
    try {
      globalThis.fetch = async () => { calls++; return new Response('rate limited', { status: 429 }); };
      await assert.rejects(refreshData(options), /HTTP 429/);
      assert.equal(calls, 1);
    } finally { globalThis.fetch = originalFetch; }
    assert.deepEqual(await readFile(options.datasetPath), oldDataset);
    assert.deepEqual(await readFile(options.metadataPath), oldMetadata);
  });
});

test('CLI fixture and dry-run arguments route to safe offline validation', async () => {
  await temporaryFiles(async options => {
    const flags = ['--dataset', options.datasetPath, '--metadata', options.metadataPath];
    const parsed = parseArgs(['--input', fixturePath, '--dry-run', ...flags]);
    assert.equal(parsed.input, fixturePath);
    assert.equal(parsed.datasetPath, options.datasetPath);
    assert.equal(parsed.metadataPath, options.metadataPath);
    const result = await refreshData(parsed);
    assert.equal(result.dryRun, true);
    assert.equal(result.appendedRows, 1);
    const invalidPath = path.join(options.dir, 'invalid.json');
    await writeFile(invalidPath, '{"meta":{},"prices":[]}');
    await assert.rejects(refreshData(parseArgs(['--input', invalidPath, ...flags])), /nonempty array/);
    for (const invalid of [['--input'], ['--unknown'], ['--input', '--dry-run'], ['--dry-run', '--dry-run']]) {
      assert.throws(() => parseArgs(invalid), /Usage:/);
    }
    assert.equal(JSON.parse(await readFile(options.datasetPath, 'utf8')).meta.lastDate, before.meta.lastDate);
    assert.equal(await readFile(options.metadataPath, 'utf8'), metadataModule(initialMetadata));
  });
});
