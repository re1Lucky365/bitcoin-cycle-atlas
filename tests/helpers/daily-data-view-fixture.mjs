/** Inert DOM boundary for controller lifecycle and interaction tests; no browser layout. */
class NodeBoundary {
  constructor(id = '', dataset = {}, work = new Map()) {
    this.id = id; this.dataset = dataset; this.work = work; this.attrs = new Map();
    this.markup = ''; this.text = ''; this.hidden = false; this.open = false;
    this.disabled = id === 'export-raw'; this.classList = { add() {} };
  }
  get textContent() { return this.text || ''; }
  set textContent(value) { this.text = String(value); this.markup = ''; this.record('textContent', this.text); }
  get innerHTML() { return this.markup; }
  set innerHTML(value) { this.markup = String(value); this.text = ''; this.record('innerHTML', this.markup); }
  record(kind, value) {
    const previous = this.work.get(this.id) || { writes: 0, characters: 0, kinds: {} };
    this.work.set(this.id, { writes: previous.writes + 1, characters: previous.characters + value.length, kinds: { ...previous.kinds, [kind]: (previous.kinds[kind] || 0) + 1 } });
  }
  setAttribute(key, value) { this.attrs.set(key, String(value)); if (key === 'open') this.open = true; }
  removeAttribute(key) { this.attrs.delete(key); if (key === 'open') this.open = false; }
  getAttribute(key) { return this.attrs.get(key); }
  showModal() { this.open = true; }
  close() { this.open = false; }
  closest(selector) {
    if (selector === 'button') return this;
    const match = selector.match(/^\[data-(.+)\]$/);
    if (!match) return null;
    const key = match[1].replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    return key in this.dataset ? this : null;
  }
}

export function dailyViewSurface({ hidden = false } = {}) {
  const work = new Map(), nodes = new Map(), listeners = new Map();
  const root = new NodeBoundary('data-view', {}, work);
  root.hidden = hidden;
  root.querySelector = selector => {
    if (!nodes.has(selector)) nodes.set(selector, new NodeBoundary(selector.slice(1), {}, work));
    return nodes.get(selector);
  };
  root.addEventListener = (name, callback) => listeners.set(name, callback);
  root.removeEventListener = name => listeners.delete(name);
  const node = id => root.querySelector(`#${id}`);
  return {
    root, node,
    click: (id, values = {}) => listeners.get('click')?.({ target: new NodeBoundary(id, values, work) }),
    settle: () => new Promise(resolve => setImmediate(resolve)),
    resetWork: () => work.clear(),
    work: () => Object.fromEntries([...work].sort(([left], [right]) => left.localeCompare(right))),
    snapshot: () => ({ context: node('asset-context').innerHTML || node('asset-context').textContent, table: node('data-body').innerHTML, count: node('asset-row-count').textContent, startHeader: node('asset-start-header').innerHTML, latestHeader: node('asset-latest-header').innerHTML, exportDisabled: node('export-raw').disabled }),
  };
}

export const COMPARISON_SYMBOLS = ['SPY', 'QQQ', 'NVDA', 'AAPL', 'GOOG', 'MSFT', 'AMZN', 'META', 'AVGO', 'PLTR', 'TSLA', 'HOOD', 'TLT', 'IEF', 'GLD', 'SLV', 'PDBC'];
const NAMES = ['S&P500', 'NASDAQ100', '엔비디아', '애플', '구글', '마이크로소프트', '아마존', '메타', '브로드컴', '팔란티어', '테슬라', '로빈후드', '미국장기채권', '미국중기채권', '금', '은', '원자재'];
const DECISIONS = [['strong-buy', '적극 매수', -15], ['buy', '분할 매수', -7], ['neutral', '중립', 0], ['sell', '분할 매도', 15], ['strong-sell', '적극 매도', 25]];

/** Synthetic engine output for view behavior only; numerical semantics have independent engine tests. */
export function comparisonViewModel({ asOf = '2026-10-25', offset = 0 } = {}) {
  const year = Number(asOf.slice(0, 4));
  return {
    version: 1, asOf, year, methodology: {},
    rows: COMPARISON_SYMBOLS.map((symbol, index) => {
      const [id, label, ytdPct] = DECISIONS[index % DECISIONS.length];
      return {
        symbol, name: NAMES[index], group: index < 12 ? '위험 자산' : index < 16 ? '안전 자산' : '대체자산', category: index < 2 ? 'Index ETF' : index < 9 ? '대형 기술주' : index < 12 ? '개별주' : index < 14 ? '채권' : index === 14 ? '금' : index === 15 ? '은' : '원자재', currency: 'USD',
        sampleYears: 10, sampleStartYear: year - 10, sampleEndYear: year - 1, samplePartialFirstYear: index % 2 === 0, firstPartialStartDate: index % 2 === 0 ? `${year - 10}-03-02` : null,
        meanRisePct: 20, meanFallPct: -10, meanMddPct: -25,
        yearStartDate: `${year}-01-02`, yearStartPrice: 100 + offset,
        latestDate: `${year}-10-23`, latestPrice: (100 + offset) * (1 + ytdPct / 100), ytdPct,
        judgment: { id, label, available: true, reason: `${symbol}의 올해 등락률과 과거 평균을 비교합니다.`, thresholds: { strongBuyPct: -10, buyPct: -5, sellPct: 10, strongSellPct: 20 } },
        source: { name: 'Example price source', url: `https://example.test/prices/${symbol}`, priceDefinition: 'split-adjusted close excluding cash distributions', currency: 'USD', retrievedAt: `${year}-10-25T08:00:00Z`, firstDate: `${year - 10}-03-02`, lastDate: `${year}-10-23`, count: 2500, responseSha256: 'test-only' },
        coverage: { status: 'observed', complete: true, issues: [], missingYears: [], missingDates: [], gapCount: 0 },
      };
    }),
  };
}

export function deferred() {
  let resolve, reject;
  const promise = new Promise((resolvePromise, rejectPromise) => { resolve = resolvePromise; reject = rejectPromise; });
  return { promise, resolve, reject };
}
