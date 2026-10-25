import { validateDataset, utcDay } from './cycle-engine.js?v=1.19.0';
import { parseEthArchive } from './eth-market-data.js?v=1.15.0';
import { parseEquityArchive, EQUITIES } from './equity-market-data.js?v=1.18.0';

const ARCHIVES = Object.freeze({
  ETH: { url: './data/eth-ohlc.json', embeddedId: 'embedded-eth-data' },
  MSTR: { url: './data/mstr-ohlc.json', embeddedId: 'embedded-mstr-data' },
  BMNR: { url: './data/bmnr-ohlc.json', embeddedId: 'embedded-bmnr-data' },
});

function observationCutoff(retrievedAt, lastDate) {
  const time = Date.parse(retrievedAt);
  if (!Number.isFinite(time)) throw new TypeError('Invalid daily data retrieval time');
  const date = new Date(time).toISOString().slice(0, 10);
  if (lastDate >= date) throw new TypeError('Daily analytics requires completed observations');
  return date;
}

export function bitcoinDailyAsset(dataset) {
  const rows = validateDataset(dataset), meta = dataset.meta;
  if (meta?.sourceName !== 'Coin Metrics Community API' || meta.metric !== 'PriceUSD' || meta.frequency !== '1d' || meta.timezone !== 'UTC') {
    throw new TypeError('Invalid Bitcoin daily price identity');
  }
  const source = new URL(meta.source);
  if (source.origin !== 'https://community-api.coinmetrics.io' || source.pathname !== '/v4/timeseries/asset-metrics' || source.username || source.password) {
    throw new TypeError('Invalid Bitcoin daily price source');
  }
  if (meta.firstDate !== rows[0].date || meta.lastDate !== rows.at(-1).date || meta.count !== rows.length) {
    throw new TypeError('Bitcoin daily coverage does not match its metadata');
  }
  return {
    symbol: 'BTC', name: '비트코인', prices: dataset.prices, calendar: 'daily',
    asOfDate: observationCutoff(meta.retrievedAt, rows.at(-1).date),
    sourceName: 'Coin Metrics', sourceUrl: source.href, timezone: 'UTC',
    retrievedAt: meta.retrievedAt, license: 'CC BY-NC 4.0', missingDates: [],
    priceNote: 'USD 일말 기준가격 · 장중 고저가 아님',
    coverageNote: `${rows[0].date}부터의 Coin Metrics 일말 관측입니다.`,
  };
}

export function dailyAssetFromArchive(symbol, payload) {
  if (!Object.hasOwn(ARCHIVES, symbol)) throw new RangeError('Unsupported daily data asset');
  if (symbol === 'ETH') {
    const series = parseEthArchive(payload, 'daily');
    const prices = series.candles.map(row => [row.date.slice(0, 10), row.close]);
    return {
      symbol, name: '이더리움', prices, calendar: 'daily',
      asOfDate: observationCutoff(series.retrievedAt, prices.at(-1)[0]),
      sourceName: 'Coinbase Exchange', sourceUrl: series.documentationUrl, timezone: 'UTC',
      retrievedAt: series.retrievedAt, license: 'Coinbase 공개 시장 관측', missingDates: [],
      priceNote: 'ETH-USD 일봉 종가 · Coinbase 단일 거래소',
      coverageNote: `${prices[0][0]}부터 Coinbase 관측. ${series.gapCount}일의 결측을 보간하지 않습니다.`,
    };
  }
  const series = parseEquityArchive(payload, { symbol, interval: 'daily' });
  const prices = series.candles.map(row => [row.date.slice(0, 10), row.close]);
  const missingDates = [...new Set(series.unavailableSessions || [])].sort();
  for (const date of missingDates) utcDay(date);
  return {
    symbol, name: EQUITIES[symbol].koreanName, prices, calendar: 'sessions',
    asOfDate: observationCutoff(series.retrievedAt, prices.at(-1)[0]),
    sourceName: 'Yahoo Finance', sourceUrl: `https://finance.yahoo.com/quote/${symbol}/history/`,
    timezone: 'America/New_York', retrievedAt: series.retrievedAt,
    license: 'Yahoo Finance 공개 시장 관측', missingDates,
    priceNote: 'USD · 분할 조정 종가 · 배당 미포함 가격수익률',
    coverageNote: EQUITIES[symbol].historyNote,
  };
}

export async function loadDailyAsset(symbol, { document = globalThis.document, fetch = globalThis.fetch } = {}) {
  if (!Object.hasOwn(ARCHIVES, symbol)) throw new RangeError('Unsupported daily data asset');
  const archive = ARCHIVES[symbol];
  const embedded = document?.getElementById(archive.embeddedId);
  if (embedded) return dailyAssetFromArchive(symbol, JSON.parse(embedded.textContent));
  const response = await fetch(archive.url, { cache: 'no-cache', credentials: 'same-origin', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`${symbol} 원자료를 불러오지 못했습니다 (${response.status})`);
  return dailyAssetFromArchive(symbol, await response.json());
}
