import { chartInterval, fetchMarketCandles, parseMarketSnapshot } from './ohlc-data.js';

export function createMarketDataController({ onChange = () => {}, fetchImpl = globalThis.fetch, readEmbedded = () => null, timeoutMs = 15000 } = {}) {
  const entries = new Map();
  let active = null, snapshotPromise = null;
  const get = interval => entries.get(interval) || { status: 'idle', series: null, error: null };
  const publish = (interval, entry) => { entries.set(interval, entry); onChange(interval, entry); };

  async function snapshot() {
    if (!snapshotPromise) {
      snapshotPromise = (async () => {
        const embedded = readEmbedded();
        if (embedded) return JSON.parse(embedded);
        const response = await fetchImpl('./data/btc-ohlc.json', { credentials: 'omit', cache: 'no-cache', signal: AbortSignal.timeout(timeoutMs) });
        if (!response.ok) throw new Error(`Saved candles HTTP ${response.status}`);
        return response.json();
      })().catch(error => { snapshotPromise = null; throw error; });
    }
    return snapshotPromise;
  }

  function cancel() {
    if (!active) return;
    const previous = active;
    active = null;
    clearTimeout(previous.timer);
    previous.controller.abort();
    const entry = get(previous.interval);
    entries.set(previous.interval, { ...entry, status: entry.series ? (entry.series.snapshot ? 'snapshot' : 'ready') : 'idle' });
  }

  async function load(interval, { force = false } = {}) {
    chartInterval(interval);
    if (active?.interval === interval) return;
    const prior = get(interval);
    cancel();
    if (!force && prior.status !== 'idle') return;
    const controller = new AbortController();
    const request = { interval, controller, timer: setTimeout(() => controller.abort(new Error('Candle request timed out')), timeoutMs) };
    active = request;
    publish(interval, { ...prior, status: 'loading', error: null });
    try {
      const series = await fetchMarketCandles({ interval, signal: controller.signal, count: interval === 'daily' ? 300 : 180, fetchImpl });
      if (active !== request) return;
      publish(interval, { status: 'ready', series, error: null });
    } catch (error) {
      if (active !== request) return;
      try {
        const series = prior.series || parseMarketSnapshot(await snapshot(), interval);
        if (active !== request) return;
        publish(interval, { status: 'snapshot', series: { ...series, snapshot: true }, error: error.message });
      } catch {
        if (active === request) publish(interval, { status: 'error', series: null, error: error.message });
      }
    } finally {
      clearTimeout(request.timer);
      if (active === request) active = null;
    }
  }
  return { get, load, cancel };
}

export function marketStatusText(entry) {
  if (!entry || entry.status === 'idle') return '';
  if (entry.status === 'loading' && !entry.series) return 'Coinbase BTC-USD · 완료 봉 조회 중';
  if (!entry.series) return '캔들 조회 실패 · 새로고침으로 재시도';
  const stamp = entry.series.retrievedAt.slice(0, 16).replace('T', ' ');
  const state = entry.status === 'loading' ? '갱신 중 · 이전 조회' : entry.status === 'snapshot' ? '연결 실패 · 저장 자료' : '조회 완료';
  return `Coinbase BTC-USD · ${state} ${stamp} UTC${entry.series.gapCount ? ` · 빈 봉 ${entry.series.gapCount}개` : ''}`;
}
