import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import * as equityData from '../../dist/equity-market-data.js';

export function deferred() {
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
    this.style = { setProperty() {} }; this.clientHeight = 600; this.isConnected = true;
    this.textContent = ''; this.innerHTML = ''; this.open = false;
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
    const attr = selector.match(/^\[data-equity-([\w-]+)\]$/)?.[1];
    const key = attr && `equity${attr.replace(/(^|-)([a-z])/g, (_, _dash, letter) => letter.toUpperCase())}`;
    return key && key in this.dataset ? this : null;
  }
}

export function equityPayload(symbol, revision) {
  const candles = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23'].map(date => ({
    time: Date.parse(`${date}T00:00:00Z`) / 1000, date: `${date}T00:00:00Z`, sessionDate: date,
    open: 100 + revision, high: 102 + revision, low: 99 + revision, close: 101 + revision, volume: 100,
  }));
  return {
    version: 1, symbol, product: symbol, source: 'Yahoo Finance', assetClass: 'equity', currency: 'USD',
    exchangeTimezone: 'America/New_York', adjustment: 'provider-split-adjusted-ohlc', completedOnly: true,
    retrievedAt: '2026-10-24T08:00:00Z', firstDate: candles[0].date, lastDate: candles.at(-1).date, candles,
  };
}

export async function equityViewFixture(symbol = 'MSTR', { query = '', project } = {}) {
  const requests = [], frames = new Map(), draws = [], calculations = [], errors = [], events = [], articles = [];
  const window = new Surface(), document = new Surface();
  document.body = new Node(); document.activeElement = new Node();
  const boot = new Map(['atlas-boot-shell', 'atlas-boot-status', 'atlas-boot-error', 'atlas-boot-retry'].map(id => [id, new Node()]));
  document.documentElement = new Node(); document.documentElement.dataset.boot = 'loading';
  document.querySelectorAll = selector => selector === '[data-boot-content]'
    ? [...document.body.nodes.values()].filter(node => 'bootContent' in node.dataset) : [];
  document.getElementById = id => boot.get(id) || null;
  document.querySelector = selector => selector === 'dialog[open]'
    ? [...document.body.nodes.values()].find(node => node.open) || null : null;
  document.createElement = () => new Node();
  document.fonts = { ready: Promise.resolve() };
  for (const type of ['atlas:ready', 'atlas:boot-error']) document.addEventListener(type, () => events.push(type));
  let frameId = 0, navigation;
  const mount = () => ({ cancel() {}, cancelPending() {}, destroy() {} });
  const deps = {
    ...equityData,
    drawIntradayChart: options => { draws.push(options); return {}; },
    bindChartNavigation: options => {
      navigation = options;
      return { cancelGesture() {}, destroy() {}, update() {} };
    },
    mountChartTouchTracking: mount, clearChartHover() {}, mountSymbolSelector: mount,
    mountDialogViewport: mount, EQUITY_FORECAST_BAR_NOTE: 'simulated values',
    TREASURY_EVENTS: [], TREASURY_SOURCES: [], treasuryEventMarkup() {},
    openResearchArticle: (id, options) => articles.push({ id, view: options.view }),
    getResearchArticle: id => id === 'fixture-article' ? { id } : null, RESEARCH_CATEGORIES: {},
    buildTreasuryProjection: options => {
      const underlying = options.btcHistory || options.ethHistory;
      const record = { priceRevision: options.history[0].close - 101, assetRevision: underlying.revision };
      calculations.push(record);
      if (underlying.fail) throw new Error('Model inputs rejected');
      if (project) return project(options);
      const asOf = options.history.at(-1).date.slice(0, 10);
      return { forecasts: Object.fromEntries(['stress', 'base', 'bull'].map(scenario => [scenario, {
        ...record, scenario, asOf, financialAsOf: '2026-06-30', warnings: [], displayEnd: '2035-12-31',
        path: [{ date: asOf, price: 100 }, { date: '2035-12-31', price: 200 }],
      }])) };
    },
  };
  const source = await readFile(new URL('../../dist/equity-view.js', import.meta.url), 'utf8');
  const transformed = source.replace(/^import\s*\{([^}]+)\}\s*from\s*['"][^'"]+['"];?\s*$/gm, (_, names) => `const {${names}} = __deps;`)
    .replace('export async function initEquityView', 'async function initEquityView');
  const context = vm.createContext({
    __deps: deps, document, window, URLSearchParams, AbortController, AbortSignal, Date, Intl,
    location: { search: `?symbol=${symbol}${query}`, pathname: '/' }, history: { replaceState() {} },
    console: { error: (...args) => errors.push(args) },
    CustomEvent: class { constructor(type, options = {}) { this.type = type; Object.assign(this, options); } },
    ResizeObserver: class { observe() {} disconnect() {} },
    requestAnimationFrame: callback => { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame: id => frames.delete(id),
    fetch: (url, options) => { const pending = deferred(); requests.push({ url, options, ...pending }); return pending.promise; },
  });
  const html = await readFile(new URL('../../dist/index.html', import.meta.url), 'utf8');
  const bootSource = html.match(/<script id="atlas-boot-script">([\s\S]*?)<\/script>/)?.[1];
  if (!bootSource) throw new Error('Review the equity fixture after a boot entry change');
  vm.runInContext(bootSource, context, { timeout: 1000 });
  vm.runInContext(`${transformed}\nglobalThis.start = initEquityView;`, context, { timeout: 1000 });
  const initialization = context.start({ symbol });
  const microtasks = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
  const frame = async () => {
    const work = [...frames.values()]; frames.clear();
    for (const callback of work) callback(0);
    await microtasks();
  };
  const settle = async () => { for (let i = 0; i < 8; i++) { await microtasks(); if (frames.size) await frame(); } };
  const app = document.body.nodes.get('main');
  const click = (kind, value) => {
    const target = new Node(); target.dataset[`equity${kind[0].toUpperCase()}${kind.slice(1)}`] = value;
    app.dispatchEvent({ type: 'click', target });
  };
  return {
    requests, frames, draws, calculations, errors, events, articles, initialization, document, app,
    microtasks, frame, settle,
    reply: (index, value) => requests[index].resolve({ ok: true, json: async () => value }),
    reject: (index, message = 'Archive failed') => requests[index].reject(new Error(message)),
    hide: () => window.dispatchEvent({ type: 'pagehide', persisted: true }),
    show: () => window.dispatchEvent({ type: 'pageshow', persisted: true }),
    reload: () => click('action', 'reload'),
    interval: value => click('interval', value),
    scenario: value => app.querySelector('#equity-scenario').onchange({ target: { value } }),
    pan: range => navigation.onRangeChange(range),
    latest: () => draws.at(-1),
    status: () => app.querySelector('#equity-status').textContent,
    forecastDialog: () => { click('action', 'forecast'); return document.body.nodes.get('equity-detail-dialog').querySelector('#equity-detail-content').innerHTML; },
  };
}
