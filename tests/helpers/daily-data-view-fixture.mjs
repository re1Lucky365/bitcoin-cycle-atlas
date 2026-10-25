/** Inert DOM boundary for the real daily controller; no layout, parsing or paint. */
class NodeBoundary {
  constructor(id = '', dataset = {}, work = new Map()) {
    this.id = id; this.dataset = dataset; this.work = work; this.attrs = new Map();
    this.markup = ''; this.textContent = ''; this.value = ''; this.hidden = false;
    this.disabled = false; this.clientHeight = 714; this.classList = { add() {} };
  }
  get innerHTML() { return this.markup; }
  set innerHTML(value) {
    this.markup = value;
    const previous = this.work.get(this.id) || { writes: 0, nonemptyWrites: 0, characters: 0 };
    this.work.set(this.id, {
      writes: previous.writes + 1, nonemptyWrites: previous.nonemptyWrites + Number(value.length > 0),
      characters: previous.characters + value.length,
    });
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
    '[data-daily-asset]': ['BTC', 'ETH', 'MSTR', 'BMNR', 'BTC', 'ETH', 'MSTR', 'BMNR'].map(symbol => new NodeBoundary('', { dailyAsset: symbol }, work)),
    '[data-daily-detail]': ['daily', 'monthly'].map(detail => new NodeBoundary('', { dailyDetail: detail }, work)),
    '[data-daily-metric]': ['return', 'mdd'].map(metric => new NodeBoundary('', { dailyMetric: metric }, work)),
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
    /** Consume all currently visible content/control state, ignoring hidden stale markup. */
    snapshot() {
      const monthly = !node('daily-monthly-scroll').hidden;
      return {
        annual: node('daily-comparison-content').hidden ? null : node('daily-annual-table').innerHTML,
        note: node('daily-comparison-note').textContent,
        summary: node('data-summary').innerHTML,
        source: [node('daily-source-line').innerHTML, node('daily-source-line').title],
        years: [node('data-year').innerHTML, node('data-year').value],
        month: node('daily-month').hidden ? null : node('daily-month').value,
        count: node('data-result-count').textContent,
        table: monthly ? node('daily-monthly-table').innerHTML : node('data-body').innerHTML,
        headings: monthly ? null : [node('daily-date-heading').textContent, node('daily-change-heading').textContent],
        page: monthly ? null : [node('data-page-label').textContent, node('data-prev').disabled, node('data-next').disabled],
        controls: Object.fromEntries(Object.entries(controls).map(([name, buttons]) => [name, buttons.map(button => button.getAttribute('aria-pressed'))])),
      };
    },
  };
}
