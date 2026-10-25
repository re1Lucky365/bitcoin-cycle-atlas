/** Inert DOM boundary for the cycle-table controller; no layout, parsing or paint. */
class NodeBoundary {
  constructor(id = '', dataset = {}, work = new Map()) {
    this.id = id; this.dataset = dataset; this.work = work; this.attrs = new Map();
    this.markup = ''; this.textContent = ''; this.value = ''; this.hidden = false;
    this.disabled = false; this.clientHeight = 714; this.classList = { add() {} };
  }
  get textContent() { return this.text || ''; }
  set textContent(value) { this.text = String(value); this.markup = ''; }
  get innerHTML() { return this.markup; }
  set innerHTML(value) {
    this.markup = value; this.text = '';
    const previous = this.work.get(this.id) || { writes: 0, nonemptyWrites: 0, characters: 0 };
    this.work.set(this.id, { writes: previous.writes + 1, nonemptyWrites: previous.nonemptyWrites + Number(value.length > 0), characters: previous.characters + value.length });
  }
  setAttribute(key, value) { this.attrs.set(key, String(value)); }
  removeAttribute(key) { this.attrs.delete(key); }
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

export function dailyViewSurface(query = '', { clientHeight = 714 } = {}) {
  const work = new Map(), nodes = new Map(), listeners = new Map();
  const root = new NodeBoundary('data-view', {}, work);
  root.ownerDocument = { defaultView: { location: { search: query } } };
  root.querySelector = selector => {
    if (!nodes.has(selector)) { const node = new NodeBoundary(selector.slice(1), {}, work); node.clientHeight = clientHeight; nodes.set(selector, node); }
    return nodes.get(selector);
  };
  const controls = {
    '[data-cycle-evidence]': ['all', 'observed', 'scenario'].map(evidence => new NodeBoundary('', { cycleEvidence: evidence }, work)),
  };
  root.querySelectorAll = selector => controls[selector] || [];
  root.addEventListener = (name, callback) => listeners.set(name, callback);
  root.removeEventListener = name => listeners.delete(name);
  const node = id => root.querySelector(`#${id}`);
  return {
    root, node,
    click: (id, values = {}) => listeners.get('click')?.({ target: new NodeBoundary(id, values, work) }),
    change(id, value) { const target = node(id); target.value = value; listeners.get('change')?.({ target }); },
    settle: () => new Promise(resolve => setImmediate(resolve)),
    resetWork: () => work.clear(),
    work: () => Object.fromEntries([...work].sort(([left], [right]) => left.localeCompare(right))),
    snapshot() {
      return {
        context: node('cycle-context').innerHTML || node('cycle-context').textContent,
        scenario: node('cycle-scenario-label').textContent,
        table: node('data-body').innerHTML,
        count: node('cycle-row-count').textContent,
        cycle: [node('cycle-scope').innerHTML, node('cycle-scope').value],
        exportDisabled: node('export-raw').disabled,
        controls: controls['[data-cycle-evidence]'].map(button => button.getAttribute('aria-pressed')),
      };
    },
  };
}

/** Small chart-shaped input for view lifecycle/interaction tests, not cycle discovery. */
export function cycleViewContext({ offset = 0, scenarioId = 'base', short = false } = {}) {
  const start = Date.parse('2024-12-23T00:00:00Z');
  const prices = Array.from({ length: short ? 20 : 40 }, (_, index) => [new Date(start + index * 86400000).toISOString().slice(0, 10), 100 + offset + Math.sin(index / 4) * 2]);
  const asOf = prices.at(-1)[0];
  const marker = (type, index, extra = {}) => ({ id: `${type}:observed:${prices[index][0]}`, type, date: prices[index][0], price: prices[index][1], kind: 'observed', selectionKind: 'observed', provisional: false, ...extra });
  const bottom = marker('bottom', 0), top = marker('cycle-top', 10), low = marker('bottom', short ? 18 : 25, { provisional: true });
  const futureTop = { id: 'cycle-top:scenario:2025-03-01', type: 'cycle-top', date: '2025-03-01', price: 140 + offset, kind: 'scenario', selectionKind: 'scenario', provisional: true };
  const futureLow = { id: 'bottom:scenario:2025-06-01', type: 'bottom', date: '2025-06-01', price: 80 + offset, kind: 'scenario', selectionKind: 'scenario', provisional: true, selectionWindowComplete: true };
  const observedCycle = { id: 'observed-cycle', label: '관측 사이클', kind: 'observed', provisional: false, startDate: bottom.date, endDate: low.date, markers: { bottom, 'cycle-top': top, 'next-bottom': low } };
  const futureCycle = { id: `scenario-${scenarioId}`, label: '2025년 조건부 사이클', kind: 'scenario', provisional: true, startDate: low.date, endDate: futureLow.date, markers: { bottom: low, 'cycle-top': futureTop, 'next-bottom': futureLow } };
  const milestones = { asOf, markers: [bottom, top, low, futureTop, futureLow], cycles: [observedCycle, futureCycle], intervals: [], futureStatus: { available: true, completeWindow: true } };
  const dataset = { meta: { source: 'https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets=btc&metrics=PriceUSD', retrievedAt: '2025-02-01T00:00:00Z' }, prices };
  const forecast = { asOf, path: [prices.at(-1), [futureTop.date, futureTop.price], [futureLow.date, futureLow.price]] };
  return { dataset, prices, forecast, milestones, scenarioId, scenarioLabel: scenarioId === 'base' ? '저점 유지 가정' : '다른 미래 가정' };
}
