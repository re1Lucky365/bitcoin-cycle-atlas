import { chartInterval, fetchMarketCandles, marketProduct, parseMarketSnapshot as parseProductSnapshot } from './ohlc-data.js?v=1.15.0';
import { createHistoryState, intradayNavigationRange, requestedHistoryWindow, nextHistoryPage, appendHistoryPage } from './intraday-history.js?v=1.15.0';

export function createMarketDataController({ product = 'BTC-USD', snapshotUrl, onChange = () => {}, fetchImpl = globalThis.fetch, readEmbedded = () => null, timeoutMs = 15000, preferSnapshot = false, historyRequestGapMs = 250 } = {}) {
  // Product ownership is fixed for the lifetime of this controller. Separate
  // controller instances cannot share a snapshot promise, cache or request slot.
  const market=marketProduct(product);
  snapshotUrl ??= market.snapshotUrl;
  const parseMarketSnapshot=(payload,interval)=>parseProductSnapshot(payload,interval,{product:market.product});
  const entries = new Map(), histories = new Map();
  let active = null, snapshotPromise = null, lastHistoryRequestAt = 0;
  const get = interval => entries.get(interval) || { status: 'idle', series: null, error: null, product:market.product };
  const publish = (interval, entry) => { entries.set(interval, entry); onChange(interval, entry); };

  async function snapshot() {
    if (!snapshotPromise) {
      snapshotPromise = (async () => {
        const embedded = readEmbedded();
        if (embedded) return JSON.parse(embedded);
        const response = await fetchImpl(snapshotUrl, { credentials: 'omit', cache: 'no-cache', signal: AbortSignal.timeout(timeoutMs) });
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
    entries.set(previous.interval, { ...entry, status: entry.series ? (entry.series.snapshot ? 'snapshot' : 'ready') : 'idle', historyStatus: entry.historyStatus==='loading'?'idle':entry.historyStatus });
  }

  async function load(interval, { force = false } = {}) {
    chartInterval(interval);
    if (active?.interval === interval && !force) return;
    const prior = get(interval);
    cancel();
    if (!force && prior.status !== 'idle') return;
    const controller = new AbortController();
    const request = { interval, controller, timer: setTimeout(() => controller.abort(new Error('Candle request timed out')), timeoutMs) };
    active = request;
    publish(interval, { ...prior, status: 'loading', error: null });
    try {
      if(preferSnapshot&&!force){
        try{
          const series=parseMarketSnapshot(await snapshot(),interval);
          if(active!==request)return;controller.signal.throwIfAborted();
          histories.set(interval,createHistoryState(series));publish(interval,{status:'snapshot',series:{...series,snapshot:true},error:null});return;
        }catch(error){if(active!==request)return;controller.signal.throwIfAborted();}
      }
      const series = await fetchMarketCandles({ interval, product:market.product, signal: controller.signal, count: interval === 'daily' ? 300 : 180, fetchImpl });
      if (active !== request) return;
      histories.set(interval,createHistoryState(series));
      publish(interval, { status: 'ready', series, error: null });
    } catch (error) {
      if (active !== request) return;
      try {
        const series = prior.series || parseMarketSnapshot(await snapshot(), interval);
        if (active !== request) return;
        if(!histories.has(interval))histories.set(interval,createHistoryState(series));
        publish(interval, { status: 'snapshot', series: { ...series, snapshot: true }, error: error.message });
      } catch {
        if (active === request) publish(interval, { status: 'error', series: null, error: error.message });
      }
    } finally {
      clearTimeout(request.timer);
      if (active === request) active = null;
    }
  }

  function range(interval,previousRange=null) {
    const entry=get(interval);if(!entry.series)return null;
    return intradayNavigationRange(histories.get(interval)?.base||entry.series,previousRange);
  }

  /** One sequential request stream. New gestures replace its target, rather than
   * start overlapping downloads. A different interval/refresh cancels it. */
  function ensureRange(interval,visibleRange) {
    const prior=get(interval),history=histories.get(interval);if(!prior.series||!history)return Promise.resolve();
    const target=requestedHistoryWindow(history,visibleRange);if(!target)return Promise.resolve();history.requested=target;
    if(active?.interval===interval)return active.promise||Promise.resolve();
    if(active)return Promise.resolve();
    if(!nextHistoryPage(history)||history.retryAt>Date.now())return Promise.resolve();
    const controller=new AbortController(),request={interval,controller,kind:'history',timer:null,promise:null};active=request;
    publish(interval,{...prior,historyStatus:'loading',historyError:null});
    request.promise=(async()=>{
      try{
        while(active===request){
          const window=nextHistoryPage(history);if(!window)break;
          // Keep the rate bound across successive short gesture batches too.
          // Otherwise many one-page zooms could each bypass the inter-page wait.
          const waitMs=Math.max(0,historyRequestGapMs-(Date.now()-lastHistoryRequestAt));
          if(waitMs>0)await new Promise((resolve,reject)=>{
            const onAbort=()=>{clearTimeout(timer);reject(controller.signal.reason);};
            const timer=setTimeout(()=>{controller.signal.removeEventListener('abort',onAbort);resolve();},waitMs);
            controller.signal.addEventListener('abort',onAbort,{once:true});
          });
          controller.signal.throwIfAborted();
          lastHistoryRequestAt=Date.now();
          request.timer=setTimeout(()=>controller.abort(new Error('History request timed out')),timeoutMs);
          const page=await fetchMarketCandles({interval,product:market.product,start:window.start,end:window.end,allowEmpty:true,signal:controller.signal,fetchImpl});
          clearTimeout(request.timer);request.timer=null;
          if(active!==request)return;controller.signal.throwIfAborted();
          const entry=get(interval),series=appendHistoryPage(entry.series,history,page);
          publish(interval,{...entry,series,historyStatus:'loading',historyError:null,historyPages:(entry.historyPages||0)+1});
        }
        if(active===request){history.retryAt=0;publish(interval,{...get(interval),historyStatus:'ready',historyError:null});}
      }catch(error){
        if(active!==request)return;
        // Rendering/hover never retries a failed page. Explicit refresh clears
        // this state; a later user gesture can retry after the backoff period.
        history.retryAt=Date.now()+30000;
        publish(interval,{...get(interval),historyStatus:'error',historyError:error.message});
      }finally{clearTimeout(request.timer);if(active===request)active=null;}
    })();
    return request.promise;
  }
  return { get, load, cancel, range, ensureRange };
}

export function marketStatusText(entry) {
  if (!entry || entry.status === 'idle') return '';
  const product=marketProduct(entry.series?.product||entry.product||'BTC-USD').product;
  if (entry.status === 'loading' && !entry.series) return `Coinbase ${product} · 완료 봉 조회 중`;
  if (!entry.series) return '캔들 조회 실패 · 새로고침으로 재시도';
  const stamp = entry.series.retrievedAt.slice(0, 16).replace('T', ' ');
  const state = entry.status === 'loading' ? '갱신 중 · 이전 조회' : entry.status === 'snapshot' ? (entry.error?'연결 실패 · 저장 자료':'저장 자료') : '조회 완료';
  const history=entry.historyStatus==='loading'?' · 과거 봉 불러오는 중':entry.historyStatus==='error'?' · 과거 조회 실패 · 새로고침으로 재시도':entry.historyStatus==='ready'?` · ${entry.series.candles.length.toLocaleString('en-US')}개 완료 봉`:'';
  return `Coinbase ${product} · ${state} ${stamp} UTC${entry.series.gapCount ? ` · 빈 봉 ${entry.series.gapCount}개` : ''}${history}`;
}
