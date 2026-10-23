import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { drawAtlasPriceChart } from '../dist/atlas-price-chart.js';
import { drawIntradayChart } from '../dist/intraday-chart.js';
import { parseVolumeSnapshot, aggregateWeeklyVolume } from '../dist/volume-data.js';
import { CHART_INTERVALS, parseMarketSnapshot, parseCoinbaseCandles, aggregateCandles } from '../dist/ohlc-data.js';
import { createChartExportDataSnapshot } from '../dist/chart-export-workbench.js';
import { createObservedChartCsv } from '../dist/chart-export.js';
import { priceLegendMarkup, priceReadoutKind, observedPriceSourceLabel } from '../dist/price-legend.js';

const read = name => JSON.parse(readFileSync(new URL(`../dist/data/${name}.json`, import.meta.url), 'utf8'));
const daily = read('btc-daily'), volume = read('btc-volume'), market = read('btc-ohlc');
const rows = daily.prices.map(([date, price]) => ({ date, price }));
const asOf = rows.at(-1).date, now = Date.parse(volume.retrievedAt);
const observed = parseVolumeSnapshot(volume, { now });
const day = value => Date.parse(`${value}T00:00:00Z`) / 86400000;
const dateAt = value => new Date(value * 86400000).toISOString().slice(0, 10);
const nextDate = dateAt(day(asOf) + 1);
// A deliberately separate assumption probes classification without changing
// the published prices or invoking/changing the forecast model.
const assumption = { date: nextDate, price: rows.at(-1).price * 1.01, lower: rows.at(-1).price, upper: rows.at(-1).price * 1.02 };
const priceRows = [...rows, assumption];

class SvgNode {
  constructor() { this.attrs = new Map(); this.nodes = new Map(); this.dataset = {}; this.textContent = ''; }
  setAttribute(key, value) { this.attrs.set(key, String(value)); }
  removeAttribute(key) { this.attrs.delete(key); }
  getAttribute(key) { return this.attrs.get(key); }
  querySelector(selector) { if (!this.nodes.has(selector)) this.nodes.set(selector, new SvgNode()); return this.nodes.get(selector); }
  querySelectorAll() { return []; }
  focus() {}
}
function svgFixture() {
  const svg = new SvgNode();
  Object.assign(svg, { id: 'price-source-audit', clientWidth: 1000, clientHeight: 500, innerHTML: '', parentElement: { style: { setProperty() {} } }, getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 500 }) });
  return svg;
}
function atlas(options = {}) {
  const svg = options.svg || svgFixture(), readouts = [], details = [];
  const controller = drawAtlasPriceChart({ svg, rows: priceRows, start: dateAt(day(asOf) - 30), end: nextDate, split: asOf,
    showDrawdown: false, showHistoricalEvents: false, showCycleMarkers: false, showTurns: false,
    onHover: value => readouts.push(value), onInspect: value => details.push(value), ...options });
  return { svg, controller, readouts, details };
}
const csvRecords = csv => {
  // These real-data records contain no quoted user-supplied cells.
  const [header, ...lines] = csv.replace(/^\uFEFF/u, '').trim().split('\r\n');
  const keys = header.split(',');
  return lines.map(line => Object.fromEntries(line.split(',').map((value, index) => [keys[index], value])));
};
const snapshot = (frequency, candles, extra = {}) => createChartExportDataSnapshot({ frequency, chartType: 'candles', unit: 'usd',
  range: { start: rows[0].date, end: nextDate }, asOf, rows, observedCandles: candles, candleSource: observed.source,
  forecast: { path: [rows.at(-1), assumption], scenarioId: 'test-assumption' }, ...extra });
const lastCsv = (data, id) => csvRecords(data.datasets.find(item => item.id === id).csv).at(-1);

test('published Coin Metrics daily selection and CSV keep exact USD values and separate the next-day assumption', () => {
  const h = atlas(), latest = rows.at(-1), data = snapshot('daily', observed.bars);
  assert.equal(h.readouts.at(-1).date, latest.date);
  assert.equal(h.readouts.at(-1).price, latest.price);
  assert.equal(h.readouts.at(-1).kind, 'observed');
  assert.equal(priceReadoutKind(h.readouts.at(-1)), '관측 종가');
  assert.match(h.details.at(-1).note, /Coin Metrics/u);
  const exported = lastCsv(data, 'coin-metrics-daily');
  assert.equal(exported.chart_date_utc, latest.date);
  assert.equal(Number(exported.close), latest.price);
  assert.equal(exported.source, 'Coin Metrics');
  assert.equal(exported.interval, 'daily');
  assert.equal(exported.kind, 'observed');
  h.controller.selectDate(nextDate);
  assert.equal(h.readouts.at(-1).kind, 'simulated');
  assert.equal(h.readouts.at(-1).price, assumption.price);
  assert.equal(priceReadoutKind(h.readouts.at(-1)), '가정');
  assert.equal(lastCsv(data, 'conditional-path').chart_date_utc, nextDate);
  assert.equal(lastCsv(data, 'conditional-path').kind, 'conditional');
  const observedOnly = csvRecords(createObservedChartCsv({ rows: priceRows, asOf, range: { start: rows[0].date, end: nextDate } }));
  assert.equal(observedOnly.at(-1).chart_date_utc, asOf);
  assert.equal(observedOnly.length, rows.length);
});

test('daily exchange candle selection and CSV agree on the original Bitstamp OHLCV, independently of Coin Metrics', () => {
  const eligible = observed.bars.filter(bar => bar.date <= asOf), latest = eligible.at(-1);
  const h = atlas({ chartType: 'candles', observedCandles: eligible, candleSource: observed.source, selectedDate: latest.date });
  const selected = h.readouts.at(-1), exported = lastCsv(snapshot('daily', eligible), 'bitstamp-ohlc');
  for (const field of ['open', 'high', 'low', 'close', 'volume']) assert.equal(selected[field], latest[field]);
  assert.equal(selected.price, latest.close);
  assert.equal(selected.source, observed.source);
  assert.equal(selected.kind, 'observed');
  assert.equal(selected.completed, true);
  assert.equal(priceReadoutKind(selected), '봉 종가');
  assert.equal(exported.chart_date_utc, latest.date);
  assert.equal(exported.candle_open_utc, new Date(latest.time * 1000).toISOString());
  assert.equal(exported.source, observed.source);
  for (const field of ['open', 'high', 'low', 'close']) assert.equal(Number(exported[field]), latest[field]);
  assert.equal(Number(exported.volume_btc), latest.volume);
  assert.ok(Number(h.svg.dataset.observedCandleCount) > 0);
  assert.equal(h.svg.dataset.observedLineCount, '0');
  const source = observedPriceSourceLabel({ candleCount: Number(h.svg.dataset.observedCandleCount), lineCount: Number(h.svg.dataset.observedLineCount), candleSource: observed.source, candleEndDate: latest.date, asOf, frequency: 'daily' });
  assert.equal(source, `${observed.source} · 완료 일봉 ${latest.date} UTC`);
});

test('weekly candles end on Sunday and use seven real Bitstamp days; chart and CSV preserve the same close', () => {
  const weekly = aggregateWeeklyVolume(observed.bars, { asOf, now, source: observed.source }), last = weekly.bars.at(-1);
  const seven = observed.bars.filter(bar => bar.date >= last.startDate && bar.date <= last.endDate);
  assert.equal(seven.length, 7);
  assert.equal(new Date(`${last.startDate}T00:00:00Z`).getUTCDay(), 1);
  assert.equal(new Date(`${last.endDate}T00:00:00Z`).getUTCDay(), 0);
  assert.equal(last.date, last.endDate);
  assert.equal(last.open, seven[0].open);
  assert.equal(last.close, seven.at(-1).close);
  assert.equal(last.high, Math.max(...seven.map(bar => bar.high)));
  assert.equal(last.low, Math.min(...seven.map(bar => bar.low)));
  assert.equal(last.volume, seven.reduce((sum, bar) => sum + bar.volume, 0));
  assert.ok((last.time + 7 * 86400) * 1000 <= now);
  const h = atlas({ frequency: 'weekly', chartType: 'candles', observedCandles: weekly.bars, candleSource: weekly.source, selectedDate: last.date });
  assert.equal(h.readouts.at(-1).date, last.endDate);
  assert.equal(h.readouts.at(-1).price, last.close);
  assert.equal(h.readouts.at(-1).source, weekly.source);
  assert.equal(h.readouts.at(-1).interval, '1W');
  const exported = lastCsv(snapshot('weekly', weekly.bars), 'bitstamp-ohlc');
  assert.equal(exported.chart_date_utc, last.endDate);
  assert.equal(exported.candle_open_utc.slice(0, 10), last.startDate);
  assert.equal(Number(exported.close), last.close);
  assert.equal(exported.interval, 'weekly');
});

test('the current incomplete week stays a Coin Metrics daily-close fallback, never a fabricated weekly candle', () => {
  // Keep this real-data case valid when the automatically refreshed last day
  // is Sunday by selecting the previous completed day as the audit cutoff.
  const cutoff = new Date(`${asOf}T00:00:00Z`).getUTCDay() === 0 ? dateAt(day(asOf) - 1) : asOf;
  const weekly = aggregateWeeklyVolume(observed.bars, { asOf: cutoff, now, source: observed.source });
  const start = dateAt(day(weekly.bars.at(-1).date) + 1), expected = rows.find(row => row.date === cutoff);
  const h = atlas({ frequency: 'weekly', chartType: 'candles', split: cutoff, start, end: cutoff, observedCandles: weekly.bars, candleSource: weekly.source, selectedDate: cutoff });
  assert.equal(h.svg.dataset.observedCandleCount, '0');
  assert.equal(Number(h.svg.dataset.observedLineCount), rows.filter(row => row.date >= start && row.date <= cutoff).length);
  assert.equal(h.readouts.at(-1).date, cutoff);
  assert.equal(h.readouts.at(-1).price, expected.price);
  assert.equal(h.readouts.at(-1).kind, 'observed');
  assert.equal(h.readouts.at(-1).open, undefined);
  assert.notEqual(h.readouts.at(-1).source, 'Bitstamp');
  assert.equal(priceReadoutKind(h.readouts.at(-1)), '관측 종가');
  const candleCount = Number(h.svg.dataset.observedCandleCount), lineCount = Number(h.svg.dataset.observedLineCount);
  const legend = priceLegendMarkup({ candles: candleCount > 0, observed: candleCount > 0 || lineCount > 0, mixedLine: lineCount > 0, source: candleCount > 0 ? weekly.source : 'Coin Metrics', forecast: false });
  assert.match(legend, /관측 가격선/u);
  assert.match(legend, /Coin Metrics/u);
  assert.doesNotMatch(legend, /관측 캔들/u);
  const source = observedPriceSourceLabel({ candleCount, lineCount, candleSource: weekly.source, candleEndDate: weekly.bars.at(-1).endDate, asOf: cutoff, frequency: 'weekly' });
  assert.equal(source, `Coin Metrics · 일말 ${cutoff} UTC`, 'loaded candles outside the viewport must not make its fallback line appear to be Bitstamp OHLC');
  const data = snapshot('weekly', weekly.bars, { asOf: cutoff });
  assert.equal(lastCsv(data, 'bitstamp-ohlc').chart_date_utc, weekly.bars.at(-1).date);
  assert.equal(lastCsv(data, 'coin-metrics-daily').chart_date_utc, cutoff);
});

test('mixed weekly candles and the unfinished-week daily line have distinct legend samples and independent completion dates', () => {
  const cutoff = new Date(`${asOf}T00:00:00Z`).getUTCDay() === 0 ? dateAt(day(asOf) - 1) : asOf;
  const weekly = aggregateWeeklyVolume(observed.bars, { asOf: cutoff, now, source: observed.source }), last = weekly.bars.at(-1);
  const h = atlas({ frequency: 'weekly', chartType: 'candles', split: cutoff, start: last.startDate, end: cutoff, observedCandles: weekly.bars, candleSource: weekly.source, selectedDate: cutoff });
  const candleCount = Number(h.svg.dataset.observedCandleCount), lineCount = Number(h.svg.dataset.observedLineCount);
  assert.equal(candleCount, 1);
  assert.equal(lineCount, day(cutoff) - day(last.endDate));
  assert.ok(lineCount > 0);
  const legend = priceLegendMarkup({ candles: candleCount > 0, observed: candleCount > 0 || lineCount > 0, mixedLine: lineCount > 0, source: weekly.source });
  assert.match(legend, /Bitstamp의 완료된 OHLC/u);
  assert.match(legend, /관측 캔들/u);
  assert.match(legend, /Coin Metrics의 실제 일말 가격선/u);
  assert.match(legend, /관측 가격선/u);
  assert.equal((legend.match(/class="price-legend-item"/gu) || []).length, 2);
  const source = observedPriceSourceLabel({ candleCount, lineCount, candleSource: weekly.source, candleEndDate: last.endDate, asOf: cutoff, frequency: 'weekly' });
  assert.equal(source, `${weekly.source} · 완료 주봉 ${last.endDate} UTC · Coin Metrics · 일말 ${cutoff} UTC`);
  assert.notEqual(last.endDate, cutoff);
  assert.equal(h.readouts.at(-1).price, rows.find(row => row.date === cutoff).price);
  assert.equal(priceReadoutKind(h.readouts.at(-1)), '관측 종가');
  h.controller.selectDate(last.endDate);
  assert.equal(h.readouts.at(-1).price, last.close);
  assert.equal(h.readouts.at(-1).source, weekly.source);
  assert.equal(priceReadoutKind(h.readouts.at(-1)), '봉 종가');
});

test('future-only and empty viewports clear prior observed metadata and cannot retain an observed candle legend', () => {
  const svg = svgFixture();
  const historical = atlas({ svg, chartType: 'candles', observedCandles: observed.bars, candleSource: observed.source });
  assert.ok(Number(historical.svg.dataset.observedCandleCount) > 0);
  const future = atlas({ svg, chartType: 'candles', observedCandles: observed.bars, candleSource: observed.source, start: nextDate, end: nextDate, selectedDate: nextDate });
  assert.equal(future.svg.dataset.observedCandleCount, '0');
  assert.equal(future.svg.dataset.observedLineCount, '0');
  assert.equal(future.readouts.at(-1).kind, 'simulated');
  assert.equal(future.readouts.at(-1).price, assumption.price);
  const candleCount = Number(svg.dataset.observedCandleCount), lineCount = Number(svg.dataset.observedLineCount);
  const legend = priceLegendMarkup({ candles: candleCount > 0, observed: candleCount > 0 || lineCount > 0, mixedLine: lineCount > 0, source: observed.source, forecast: true, band: true });
  assert.doesNotMatch(legend, /관측 캔들|관측 가격선|Bitstamp/u);
  assert.match(legend, /미래 가정/u);
  assert.match(legend, /가정 범위/u);
  atlas({ svg, chartType: 'candles', observedCandles: observed.bars, candleSource: observed.source });
  assert.ok(Number(svg.dataset.observedCandleCount) > 0);
  const emptyDate = dateAt(day(nextDate) + 1), empty = atlas({ svg, chartType: 'candles', observedCandles: observed.bars, start: emptyDate, end: emptyDate });
  assert.equal(empty.svg.dataset.observedCandleCount, '0');
  assert.equal(empty.svg.dataset.observedLineCount, '0');
  assert.equal(empty.readouts.at(-1).kind, 'unavailable');
});

for (const interval of CHART_INTERVALS.filter(item => item.seconds < 86400)) test(`${interval.id} saved Coinbase readout and CSV keep the same completed candle and its opening timestamp`, () => {
  const series = parseMarketSnapshot(market, interval.id), last = series.candles.at(-1), previous = series.candles.at(-2);
  assert.ok((last.time + interval.seconds) * 1000 <= Date.parse(series.retrievedAt));
  const range = { start: last.time - 3 * interval.seconds, end: last.time + interval.seconds, unit: 'seconds' };
  for (const chartType of ['line', 'candles']) {
    const readouts = [], details = [];
    drawIntradayChart({ svg: svgFixture(), series, chartType, range, showVolume: false, onHover: detail => readouts.push(detail), onInspect: detail => details.push(detail) });
    const selected = readouts.at(-1);
    for (const field of ['time', 'date', 'open', 'high', 'low', 'close', 'volume']) assert.equal(selected[field], last[field]);
    assert.equal(selected.price, last.close);
    assert.equal(selected.source, 'Coinbase Exchange');
    assert.equal(selected.kind, 'observed');
    assert.equal(selected.completed, true);
    assert.equal(selected.previousCloseDate, previous.date);
    assert.equal(selected.previousClose, previous.close);
    assert.match(details.at(-1).note, /봉 시작 시각 기준/u);
  }
  const data = createChartExportDataSnapshot({ frequency: interval.id, range, intradaySeries: series });
  const exported = lastCsv(data, 'coinbase-ohlc');
  assert.equal(exported.chart_date_utc, last.date);
  assert.equal(exported.candle_open_utc, last.date);
  assert.equal(Number(exported.close), last.close);
  assert.equal(exported.source, 'Coinbase Exchange');
  assert.equal(exported.kind, 'observed');
});

test('Coinbase completion is inclusive at the exact close boundary and excludes unfinished aggregate groups', () => {
  for (const seconds of [60, 300, 900, 3600, 86400]) {
    const time = Math.floor(Date.parse(market.retrievedAt) / 1000 / seconds) * seconds;
    const payload = [[time, 90, 110, 100, 105, 1]], completedAt = (time + seconds) * 1000;
    assert.equal(parseCoinbaseCandles(payload, { sourceSeconds: seconds, now: completedAt - 1 }).candles.length, 0);
    assert.equal(parseCoinbaseCandles(payload, { sourceSeconds: seconds, now: completedAt }).candles.length, 1);
  }
  for (const intervalId of ['30m', '4h']) {
    const interval = CHART_INTERVALS.find(item => item.id === intervalId), n = interval.seconds / interval.sourceSeconds;
    const time = Math.floor(Date.parse(market.retrievedAt) / 1000 / interval.seconds) * interval.seconds;
    const source = Array.from({ length: n }, (_, index) => ({ time: time + index * interval.sourceSeconds, open: 100, high: 110, low: 90, close: 105, volume: 1 }));
    assert.equal(aggregateCandles(source.slice(0, -1), intervalId).candles.length, 0);
    assert.equal(aggregateCandles(source, intervalId).candles.length, 1);
  }
});

test('hiding the D-day label preserves selected observation and assumption values while removing the badge', () => {
  const nextTurn = { type: 'high', date: nextDate, days: 1, lowerDate: asOf, upperDate: dateAt(day(asOf) + 2) };
  const shown = atlas({ nextTurn, showNextTurnLabel: true }), hidden = atlas({ nextTurn, showNextTurnLabel: false });
  assert.match(shown.svg.innerHTML, /data-next-turn=/u);
  assert.doesNotMatch(hidden.svg.innerHTML, /data-next-turn=|D-1/u);
  assert.equal(hidden.readouts.at(-1).price, shown.readouts.at(-1).price);
  assert.equal(hidden.readouts.at(-1).date, shown.readouts.at(-1).date);
  hidden.controller.selectDate(nextDate);
  assert.equal(hidden.readouts.at(-1).price, assumption.price);
  assert.equal(hidden.readouts.at(-1).kind, 'simulated');
});
