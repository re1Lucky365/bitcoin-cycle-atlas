import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import * as ohlc from '../../dist/ohlc-data.js';
import * as ethData from '../../dist/eth-market-data.js';
import * as ethState from '../../dist/eth-view-state.js';
import * as events from '../../dist/ethereum-events.js';
import * as eventHistory from '../../dist/ethereum-history.js';
import { createMarketDataController, marketStatusText } from '../../dist/market-data-controller.js';

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

class Surface {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(callback);
  }
  removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback); }
  dispatchEvent(event) {
    for (const callback of this.listeners.get(event.type) || []) callback(event);
    return true;
  }
}

class Node extends Surface {
  constructor() {
    super(); this.nodes = new Map(); this.dataset = {}; this.attrs = new Map();
    this.clientHeight = 600; this.isConnected = true; this.textContent = '';
    this.innerHTML = ''; this.open = false; this.hidden = false;
  }
  querySelector(selector) {
    if (!this.nodes.has(selector)) this.nodes.set(selector, new Node());
    return this.nodes.get(selector);
  }
  querySelectorAll() { return []; }
  setAttribute(name, value) { this.attrs.set(name, String(value)); }
  removeAttribute(name) { this.attrs.delete(name); }
  getAttribute(name) { return this.attrs.get(name); }
  append(node) { this.nodes.set(node.id || `child-${this.nodes.size}`, node); }
  remove() { this.isConnected = false; }
  focus() {}
  showModal() { this.open = true; }
  close() { this.open = false; this.dispatchEvent({ type: 'close' }); }
  closest(selector) {
    const attr = selector.match(/^\[data-eth-([\w-]+)\]$/)?.[1];
    const key = attr && `eth${attr.replace(/(^|-)([a-z])/g, (_, _dash, letter) => letter.toUpperCase())}`;
    return key && key in this.dataset ? this : null;
  }
}

// Small, valid OHLC fixtures go through the production archive and week parsers.
export function ethPayload(revision = 1) {
  const start = Date.parse('2026-09-01T00:00:00Z') / 1000, seconds = 86400;
  const candles = Array.from({ length: 53 }, (_, index) => {
    const time = start + index * seconds;
    return { time, date: new Date(time * 1000).toISOString(), open: 100 + revision,
      high: 103 + revision, low: 99 + revision, close: 101 + revision, volume: 10 };
  });
  const dailyHistory = { interval: 'daily', seconds, candles, product: 'ETH-USD', source: 'Coinbase Exchange',
    completedOnly: true, retrievedAt: `2026-10-24T${String(revision).padStart(2, '0')}:00:00.000Z`,
    requestedStart: start, requestedEnd: candles.at(-1).time + seconds };
  const hourly = { ...dailyHistory, interval: '1h', seconds: 3600,
    candles: Array.from({ length: 48 }, (_, index) => {
      const time = dailyHistory.requestedEnd - (48 - index) * 3600;
      return { ...candles[0], time, date: new Date(time * 1000).toISOString() };
    }) };
  return { version: 1, product: 'ETH-USD', source: 'Coinbase Exchange',
    retrievedAt: dailyHistory.retrievedAt, dailyHistory, intervals: { daily: dailyHistory, '1h': hourly } };
}

/** Execute the complete production initializer and inline boot script. Only
 * imports, HTTP, animation-frame, timer and DOM boundaries are injected; no
 * private function is extracted or rewritten. Requests deliberately permit late
 * success after abort so ownership cannot accidentally rely on browser abort. */
export async function ethViewFixture({ query = '', pathname = '/' } = {}) {
  const requests = [], liveRequests = [], frames = new Map(), timers = new Map(), draws = [], emitted = [];
  const window = new Surface(), document = new Surface();
  document.body = new Node(); document.activeElement = new Node(); document.documentElement = new Node();
  document.documentElement.dataset.boot = 'loading';
  const boot = new Map(['atlas-boot-shell', 'atlas-boot-status', 'atlas-boot-error', 'atlas-boot-retry'].map(id => [id, new Node()]));
  document.getElementById = id => boot.get(id) || null;
  document.querySelectorAll = selector => selector === '[data-boot-content]'
    ? [...document.body.nodes.values()].filter(node => 'bootContent' in node.dataset) : [];
  document.createElement = () => new Node(); document.fonts = { ready: Promise.resolve() };
  document.addEventListener('atlas:ready', () => emitted.push('atlas:ready'));
  let frameId = 0, timerId = 0, navigation, historyOptions, resize;
  const mount = () => ({ cancel() {}, cancelPending() {}, destroy() {} });
  const fetchImpl = (url, options) => {
    const pending = deferred(); requests.push({ url, options, ...pending }); return pending.promise;
  };
  const deps = {
    ...ohlc, ...ethData, ...ethState, ...events, ...eventHistory, marketStatusText,
    createMarketDataController: options => createMarketDataController({ ...options, fetchImpl }),
    fetchMarketCandles: options => {
      const pending = deferred(); liveRequests.push({ options, ...pending }); return pending.promise;
    },
    drawIntradayChart: options => { draws.push(options); return {}; },
    bindChartNavigation: options => { navigation = options; return { cancelGesture() {}, destroy() {}, update() {} }; },
    mountChartTouchTracking: mount, clearChartHover() {}, mountSymbolSelector: mount,
    mountEthereumHistory: options => { historyOptions = options; return { update() {}, setSettings() {}, open() {}, destroy() {} }; },
  };
  const source = await readFile(process.env.ETH_VIEW_SOURCE || new URL('../../dist/eth-view.js', import.meta.url), 'utf8');
  const transformed = source.replace(/^import\s*\{([^}]+)\}\s*from\s*['"][^'"]+['"];?\s*$/gm, (_, names) => `const {${names}} = __deps;`)
    .replace('export async function initEthView', 'async function initEthView');
  const context = vm.createContext({
    __deps: deps, document, window, URLSearchParams, AbortController, AbortSignal, Date, Intl,
    location: { search: `?symbol=ETHUSD${query}`, pathname }, history: { replaceState() {} },
    CustomEvent: class { constructor(type, options = {}) { this.type = type; Object.assign(this, options); } },
    ResizeObserver: class { constructor(callback) { resize = callback; } observe() {} disconnect() {} },
    requestAnimationFrame: callback => { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame: id => frames.delete(id),
    setTimeout: callback => { timers.set(++timerId, callback); return timerId; },
    clearTimeout: id => timers.delete(id), fetch: fetchImpl,
  });
  const html = await readFile(new URL('../../dist/index.html', import.meta.url), 'utf8');
  const bootSource = html.match(/<script id="atlas-boot-script">([\s\S]*?)<\/script>/)?.[1];
  if (!bootSource) throw new Error('Review the ETH fixture after a boot entry change');
  vm.runInContext(bootSource, context, { timeout: 1000 });
  vm.runInContext(`${transformed}\nglobalThis.start = initEthView;`, context, { timeout: 1000 });
  const initialization = context.start();
  const microtasks = async () => { for (let i = 0; i < 16; i++) await Promise.resolve(); };
  const frame = async () => {
    const work = [...frames.values()]; frames.clear();
    for (const callback of work) callback(0);
    await microtasks();
  };
  const settle = async () => { for (let i = 0; i < 8; i++) { await microtasks(); if (frames.size) await frame(); } };
  const app = document.body.nodes.get('main');
  const click = (kind, value) => {
    const target = new Node(); target.dataset[`eth${kind[0].toUpperCase()}${kind.slice(1)}`] = value;
    app.dispatchEvent({ type: 'click', target });
  };
  return {
    requests, liveRequests, frames, timers, draws, events: emitted, initialization, document, app,
    microtasks, frame, settle,
    reply: (index, payload) => requests[index].resolve({ ok: true, json: async () => payload }),
    reject: (index, message = 'Archive failed') => requests[index].reject(new Error(message)),
    replyCandles: (index, revision = 2) => {
      const url = new URL(requests[index].url), step = Number(url.searchParams.get('granularity'));
      const start = Date.parse(url.searchParams.get('start')) / 1000, end = Date.parse(url.searchParams.get('end')) / 1000;
      const rows = Array.from({ length: (end - start) / step }, (_, offset) => [start + offset * step, 99 + revision, 103 + revision, 100 + revision, 101 + revision, 10]);
      requests[index].resolve({ ok: true, json: async () => rows });
    },
    replyLive: (index, payload) => liveRequests[index].resolve(payload.dailyHistory),
    rejectLive: (index, message = 'Live refresh failed') => liveRequests[index].reject(new Error(message)),
    hide: (persisted = true) => window.dispatchEvent({ type: 'pagehide', persisted }),
    show: () => window.dispatchEvent({ type: 'pageshow', persisted: true }),
    resize: () => resize(), refresh: () => click('action', 'refresh'),
    interval: value => click('interval', value), span: value => click('span', value),
    pan: range => navigation.onRangeChange(range), priceRange: range => navigation.onPriceRangeChange(range),
    focusEvent: id => historyOptions.onFocusEvent(id), latest: () => draws.at(-1),
    status: () => app.querySelector('#eth-status').textContent,
    info: () => { click('action', 'info'); return document.body.nodes.get('eth-data-dialog'); },
  };
}
