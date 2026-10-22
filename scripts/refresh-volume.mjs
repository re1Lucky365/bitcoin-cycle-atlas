#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { fetchDailyVolumeHistory, parseVolumeSnapshot } from '../dist/volume-data.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const DAY = 86400;
const readJson = async file => JSON.parse(await readFile(file, 'utf8'));
const hash = value => createHash('sha256').update(value).digest('hex');
const dateAt = seconds => new Date(seconds * 1000).toISOString().slice(0, 10);
const options = {};
for (let index = 2; index < process.argv.length; index++) {
  const key = process.argv[index];
  if (key === '--verify') options.verify = true;
  else if (['--input', '--checks-dir', '--as-of', '--output'].includes(key) && process.argv[index + 1] && !process.argv[index + 1].startsWith('--')) options[key.slice(2)] = process.argv[++index];
  else throw new Error(`Unknown or incomplete option ${key}`);
}
const output = options.output ?? path.join(root, 'dist/data/btc-volume.json');

function units(value) {
  const text = typeof value === 'number' ? value.toFixed(8) : value;
  if (typeof text !== 'string' || !/^\d+(?:\.\d{1,8})?$/.test(text)) throw new TypeError(`Invalid BTC quantity ${String(value)}`);
  const [whole, fraction = ''] = text.split('.');
  return BigInt(whole) * 100000000n + BigInt(fraction.padEnd(8, '0'));
}
function btc(value) {
  const sign = value < 0n ? '-' : '', amount = value < 0n ? -value : value;
  return `${sign}${amount / 100000000n}.${String(amount % 100000000n).padStart(8, '0')}`;
}
function metadata(envelope) {
  return { url: envelope.url, retrievedAt: envelope.retrievedAt, responseSha256: envelope.responseSha256 ?? null };
}
function ohlcWitness(envelope) {
  return { ...metadata(envelope), rows: envelope.payload.data.ohlc.map(row => [Number(row.timestamp), row.open, row.high, row.low, row.close, row.volume]) };
}
function dailyResolutionCheck(daily, witness, seconds, requireExact = true) {
  const groups = new Map(), seen = new Set();
  for (const row of witness.rows) {
    const [time, open, high, low, close, volume] = row;
    if (!Number.isSafeInteger(time) || time % seconds !== 0 || seen.has(time)
      || ![open, high, low, close].every(value => Number.isFinite(Number(value)) && Number(value) > 0)
      || Number(low) > Math.min(Number(open), Number(close)) || Number(high) < Math.max(Number(open), Number(close))) throw new Error('Invalid source resolution witness');
    units(volume); seen.add(time);
    const day = Math.floor(time / DAY) * DAY;
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day).push(row);
  }
  const days = [];
  let maxAbsDifference = 0n;
  for (const [day, rows] of [...groups].sort((a, b) => a[0] - b[0])) {
    rows.sort((a, b) => a[0] - b[0]);
    if (rows.length !== DAY / seconds || rows.some((row, index) => row[0] !== day + index * seconds) || !daily.has(day)) continue;
    const actual = daily.get(day), sum = rows.reduce((total, row) => total + units(row[5]), 0n), delta = sum - units(actual.volume);
    const matchingOHLC = Number(rows[0][1]) === actual.open && Number(rows.at(-1)[4]) === actual.close
      && Math.max(...rows.map(row => Number(row[2]))) === actual.high && Math.min(...rows.map(row => Number(row[3]))) === actual.low;
    if (requireExact && (delta !== 0n || !matchingOHLC)) throw new Error(`Daily/resolution disagreement ${dateAt(day)} ${seconds}s`);
    const absolute = delta < 0n ? -delta : delta;
    if (absolute > maxAbsDifference) maxAbsDifference = absolute;
    days.push({ date: dateAt(day), sourceRows: rows.length, dailyBTC: btc(units(actual.volume)), summedBTC: btc(sum), differenceBTC: btc(delta),
      relativeDifferencePct: actual.volume > 0 ? Number(delta) / Number(units(actual.volume)) * 100 : null, matchingOHLC });
  }
  return { ...metadata(witness), seconds, nativeRows: witness.rows.length, completeDays: days.length,
    firstDate: days[0]?.date ?? null, lastDate: days.at(-1)?.date ?? null, maxAbsDifferenceBTC: days.length ? btc(maxAbsDifference) : null,
    status: !days.length ? 'NOT_COMPARED' : days.every(row => row.differenceBTC === '0.00000000' && row.matchingOHLC) ? 'PASS' : 'DIFFERENCES_OBSERVED',
    allOHLCMatch: days.length ? days.every(row => row.matchingOHLC) : null, differingVolumeDays: days.filter(row => row.differenceBTC !== '0.00000000').length, days };
}
function summarize(snapshot, evidence) {
  const daily = new Map(snapshot.bars.map(row => [row.time, row]));
  const hourly = dailyResolutionCheck(daily, evidence.bitstampHourly, 3600);
  const quarterHourly = dailyResolutionCheck(daily, evidence.bitstampQuarterHourly, 900);
  if (hourly.completeDays < 7 || quarterHourly.completeDays < 7) throw new Error('Seven complete daily resolution comparisons are required');
  const market = evidence.bitstampMarket.market;
  if (market.base_currency !== 'BTC' || market.counter_currency !== 'USD' || market.market_type !== 'SPOT' || market.market_symbol !== 'btcusd') throw new Error('Bitstamp source is not the documented BTC/USD spot market');
  const trades = evidence.bitstampTrades.rows;
  const minTrade = Math.min(...trades.map(row => row[0])), maxTrade = Math.max(...trades.map(row => row[0]));
  if (!Number.isFinite(minTrade) || !Number.isFinite(maxTrade)) throw new Error('Missing public trade witnesses');
  const sums = new Map(), counts = new Map();
  for (const [time, amount] of trades) {
    if (!Number.isSafeInteger(time)) throw new Error('Invalid trade timestamp');
    const minute = Math.floor(time / 60) * 60;
    sums.set(minute, (sums.get(minute) ?? 0n) + units(amount)); counts.set(minute, (counts.get(minute) ?? 0) + 1);
  }
  const unitDays = [];
  for (const row of evidence.bitstampMinute.rows) {
    const time = row[0];
    if (time < Math.ceil(minTrade / 60) * 60 || time + 60 > Math.floor(maxTrade / 60) * 60) continue;
    const quantity = sums.get(time) ?? 0n, delta = quantity - units(row[5]);
    if (delta !== 0n) throw new Error('Public trade base-amount does not match minute volume');
    unitDays.push({ time, date: new Date(time * 1000).toISOString(), tradeCount: counts.get(time) ?? 0,
      tradeAmountBTC: btc(quantity), candleVolumeBTC: btc(units(row[5])), differenceBTC: btc(delta) });
  }
  if (unitDays.length < 2) throw new Error('Insufficient completed public-trade unit comparisons');
  const kraken = evidence.kraken;
  if (kraken.pair !== 'XXBTZUSD') throw new Error('Unexpected Kraken market');
  const comparisonDates = new Set(hourly.days.map(row => row.date));
  const independentDays = [];
  let excludedUnfinished = 0;
  for (const row of kraken.rows) {
    const time = row[0];
    if (!Number.isSafeInteger(time) || time % DAY !== 0) throw new Error('Invalid Kraken day boundary');
    units(row[6]);
    if ((time + DAY) * 1000 > Date.parse(kraken.retrievedAt) || dateAt(time) > snapshot.asOf) { excludedUnfinished++; continue; }
    if (!comparisonDates.has(dateAt(time)) || !daily.has(time)) continue;
    const b = daily.get(time).volume, k = Number(row[6]);
    independentDays.push({ date: dateAt(time), bitstampBTC: btc(units(b)), krakenBTC: btc(units(row[6])), bitstampToKraken: k > 0 ? b / k : null });
  }
  independentDays.sort((a, b) => a.date.localeCompare(b.date));
  if (independentDays.length < 2) throw new Error('Insufficient independent-exchange date overlap');
  const cached = evidence.coinbaseCached;
  const coinbaseDaily = new Map(cached.daily.map(row => [row.time, row]));
  const overlap = cached.daily.filter(row => daily.has(row.time)).map(row => ({ date: dateAt(row.time),
    bitstampBTC: btc(units(daily.get(row.time).volume)), coinbaseBTC: btc(units(row.volume)),
    bitstampToCoinbase: row.volume > 0 ? daily.get(row.time).volume / row.volume : null }));
  const ratios = overlap.map(row => row.bitstampToCoinbase).filter(Number.isFinite).sort((a, b) => a - b);
  const median = ratios.length ? (ratios[Math.floor((ratios.length - 1) / 2)] + ratios[Math.floor(ratios.length / 2)]) / 2 : null;
  const asWitness = (rows, metadata) => ({ ...metadata, rows: rows.map(row => [row.time, row.open, row.high, row.low, row.close, row.volume]) });
  const coinbaseHourly = dailyResolutionCheck(coinbaseDaily, asWitness(cached.hourly, cached.hourlyMetadata), 3600, false);
  const coinbaseQuarterHourly = dailyResolutionCheck(coinbaseDaily, asWitness(cached.quarterHourly, cached.quarterHourlyMetadata), 900, false);
  return {
    status: 'PASS', method: 'Exact integer satoshi sums, native OHLC reconciliation, UTC boundaries, independent exchange scope check',
    barsSha256: hash(JSON.stringify(snapshot.bars)), observedBars: snapshot.bars.length, gapCount: snapshot.coverage.gapCount,
    sourceZeroVolumeBars: snapshot.coverage.sourceZeroVolumeBars, duplicates: 0, invalidRows: 0, imputedBars: 0,
    nativeResolution: { hourly, quarterHourly },
    baseUnit: { market: { ...metadata(evidence.bitstampMarket), base: market.base_currency, quote: market.counter_currency, type: market.market_type },
      tradeSource: metadata(evidence.bitstampTrades), minuteSource: metadata(evidence.bitstampMinute),
      publicTradesReturned: trades.length, completedMinutes: unitDays.length, firstTime: unitDays[0]?.date, lastTime: unitDays.at(-1)?.date,
      maxAbsDifferenceBTC: '0.00000000', days: unitDays },
    independentExchange: { source: 'Kraken', product: 'XBT/USD', unit: 'BTC', ...metadata(kraken),
      nativeRowsReturned: kraken.nativeRowsReturned, excludedUnfinished, comparedDays: independentDays.length,
      meaning: 'Distinct venue volumes. Equality is neither expected nor an accuracy condition; no global-volume estimate.', days: independentDays },
    cachedCoinbase: { ...metadata(cached), artifactPath: cached.artifactPath, artifactSha256: cached.artifactSha256,
      sourceUrls: cached.sourceUrls, access: 'Existing repository snapshot only; no new Coinbase request',
      overlappingDays: overlap.length, firstDate: overlap[0]?.date ?? null, lastDate: overlap.at(-1)?.date ?? null,
      bitstampToCoinbase: { minimum: ratios[0] ?? null, median, maximum: ratios.at(-1) ?? null },
      nativeResolution: { hourly: coinbaseHourly, quarterHourly: coinbaseQuarterHourly }, days: overlap },
  };
}
async function fetchEnvelope(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' }, credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Volume verification HTTP ${response.status}: ${new URL(url).hostname}; no retry`);
  const text = await response.text();
  return { url, retrievedAt: new Date().toISOString(), responseSha256: hash(text), payload: JSON.parse(text) };
}
async function collectEvidence(snapshot, directory) {
  const end = Math.floor(Date.parse(`${snapshot.asOf}T00:00:00Z`) / 1000) + DAY - 1;
  const candleUrl = (step, limit, last = end) => `https://www.bitstamp.net/api/v2/ohlc/btcusd/?step=${step}&limit=${limit}&end=${last}&exclude_current_candle=true`;
  const get = async (name, url) => directory ? readJson(path.join(directory, name)) : fetchEnvelope(url);
  const hourly = await get('bitstamp-hourly-check.json', candleUrl(3600, 168));
  const quarterHourly = await get('bitstamp-15m-check.json', candleUrl(900, 672));
  const kraken = await get('krakenRecent.json', 'https://api.kraken.com/0/public/OHLC?pair=XBTUSD&interval=1440');
  const markets = await get('bitstampMarkets.json', 'https://www.bitstamp.net/api/v2/markets/');
  const trades = await get('bitstampTradesHour.json', 'https://www.bitstamp.net/api/v2/transactions/btcusd/?time=hour');
  const lastTrade = Math.max(...trades.payload.map(row => Number(row.date)));
  const minute = await get('bitstamp-minute-check.json', candleUrl(60, 59, Math.floor(lastTrade / 60) * 60 - 1));
  if (kraken.payload.error?.length || !Array.isArray(kraken.payload.result?.XXBTZUSD)) throw new Error('Kraken returned no XBT/USD OHLC');
  const cachedText = await readFile(path.join(root, 'dist/data/btc-ohlc.json'), 'utf8'), cached = JSON.parse(cachedText);
  if (cached.source !== 'Coinbase Exchange' || cached.product !== 'BTC-USD') throw new Error('Unexpected existing OHLC source');
  return {
    bitstampHourly: ohlcWitness(hourly), bitstampQuarterHourly: ohlcWitness(quarterHourly), bitstampMinute: ohlcWitness(minute),
    bitstampMarket: { ...metadata(markets), market: markets.payload.find(row => row.market_symbol === 'btcusd') },
    bitstampTrades: { ...metadata(trades), rows: trades.payload.map(row => [Number(row.date), row.amount, row.price]) },
    kraken: { ...metadata(kraken), pair: 'XXBTZUSD', nativeRowsReturned: kraken.payload.result.XXBTZUSD.length,
      rows: kraken.payload.result.XXBTZUSD.filter(row => row[0] >= end + 1 - 7 * DAY) },
    coinbaseCached: { url: 'https://github.com/twoimo/bitcoin-cycle-atlas/blob/main/dist/data/btc-ohlc.json',
      artifactPath: 'dist/data/btc-ohlc.json', artifactSha256: hash(cachedText), sourceUrls: cached.intervals.daily.sourceUrls,
      retrievedAt: cached.intervals.daily.retrievedAt, daily: cached.intervals.daily.candles,
      hourlyMetadata: { url: cached.intervals['1h'].sourceUrls[0], retrievedAt: cached.intervals['1h'].retrievedAt },
      quarterHourlyMetadata: { url: cached.intervals['15m'].sourceUrls[0], retrievedAt: cached.intervals['15m'].retrievedAt },
      hourly: cached.intervals['1h'].candles, quarterHourly: cached.intervals['15m'].candles },
  };
}

if (options.verify) {
  const saved = await readJson(output);
  parseVolumeSnapshot(saved);
  const expected = summarize(saved, saved.validation.evidence);
  const actual = { ...saved.validation }; delete actual.evidence;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('Saved verification metrics do not match embedded source witnesses');
  console.log(JSON.stringify({ status: 'PASS', source: saved.source, bars: saved.bars.length, firstDate: saved.firstDate, lastDate: saved.lastDate,
    gapCount: saved.coverage.gapCount, hourlyDays: expected.nativeResolution.hourly.completeDays, quarterHourlyDays: expected.nativeResolution.quarterHourly.completeDays,
    unitMinutes: expected.baseUnit.completedMinutes, independentDays: expected.independentExchange.comparedDays }));
} else {
  const input = options.input ? await readJson(options.input) : null;
  if (input && (input.source !== 'Bitstamp' || input.product !== 'BTC-USD' || !Array.isArray(input.pages))) throw new Error('Invalid replay collection');
  const startedAt = input?.collectionStartedAt ?? new Date().toISOString(), responses = [];
  const snapshot = await fetchDailyVolumeHistory({ source: 'Bitstamp', start: input?.requestedStart ?? '2010-01-01',
    now: Date.parse(startedAt), asOf: options['as-of'] ?? input?.asOf,
    fetchImpl: async url => {
      const found = input ? input.pages.find(page => page.url === url) : await fetchEnvelope(url);
      if (!found) throw new Error('Replay does not contain the exact requested public URL');
      responses.push(found);
      return { ok: true, json: async () => found.payload };
    },
  });
  snapshot.retrievedAt = input?.retrievedAt ?? responses.at(-1).retrievedAt;
  snapshot.collection.collectionStartedAt = startedAt;
  snapshot.collection.transport = input ? 'Public HTTPS responses replayed from recorded collection' : 'Official public HTTPS API via fetch';
  snapshot.collection.requests = snapshot.collection.requests.map((row, index) => ({ ...row,
    retrievedAt: responses[index].retrievedAt, responseSha256: responses[index].responseSha256 ?? null }));
  snapshot.collection.noDataBeforeFirstResponseDate = true;
  const evidence = await collectEvidence(snapshot, options['checks-dir']);
  snapshot.validation = { ...summarize(snapshot, evidence), evidence };
  parseVolumeSnapshot(snapshot);
  await writeFile(output, `${JSON.stringify(snapshot)}\n`);
  console.log(JSON.stringify({ status: 'PASS', output, source: snapshot.source, bars: snapshot.bars.length,
    firstDate: snapshot.firstDate, lastDate: snapshot.lastDate, gapCount: snapshot.coverage.gapCount,
    zeroVolumeSourceBars: snapshot.coverage.sourceZeroVolumeBars, requests: snapshot.collection.requestCount }));
}
