import assert from 'node:assert/strict';
import test from 'node:test';
import { equityForecastRows, equityForecastWindowRows, equityForecastLogGaps, equityForecastMarkup } from '../dist/equity-forecast-chart.js';

const DAY = 86400;
const start = Date.parse('2026-10-23') / 1000;
const anchor = { time: start, date: '2026-10-23T00:00:00Z', close: 100 };
const points = Array.from({ length: 20 }, (_, index) => {
  const time = start + (index + 1) * 3 * DAY;
  const price = index < 8 || index > 13 ? 100 + index : 0;
  return { time, date: new Date(time * 1000).toISOString(), price, close: price, low: index < 5 ? price * 0.8 : 0, high: 200 + index, sourceIds: [`source-${index % 2}`], kind: 'forecast' };
});

function referenceWindow(min, max, scale, observed = anchor) {
  const values = observed ? [{ ...observed, price: observed.close, low: observed.close, high: observed.close }, ...points] : points;
  const visible = points.filter(row => row.time >= min && row.time <= max);
  for (const time of new Set([min, max])) {
    if (time <= values[0].time || time >= values.at(-1).time || visible.some(row => row.time === time)) continue;
    const next = values.findIndex(row => row.time > time), left = values[next - 1], right = values[next];
    if (scale === 'log' && ((left.price === 0) !== (right.price === 0))) continue;
    const fraction = (time - left.time) / (right.time - left.time);
    const interpolate = key => scale === 'log' && left[key] > 0 && right[key] > 0 ? Math.exp(Math.log(left[key]) * (1 - fraction) + Math.log(right[key]) * fraction) : scale === 'log' && ((left[key] === 0) !== (right[key] === 0)) ? null : left[key] * (1 - fraction) + right[key] * fraction;
    const price = interpolate('price'), low = interpolate('low'), high = interpolate('high');
    visible.push({ time, date: new Date(time * 1000).toISOString(), price, close: price, low: low === null ? null : Math.min(price, low), high: high === null ? null : Math.max(price, high), kind: 'forecast', interpolated: true, sourceIds: [...new Set([...(left.sourceIds || []), ...(right.sourceIds || [])])], interpolation: { from: left.date, to: right.date, scale, unavailableBounds: ['low', 'high'].filter(key => (key === 'low' ? low : high) === null) } });
  }
  return visible.sort((a, b) => a.time - b.time);
}

test('binary windows preserve the exhaustive boundary and logarithmic-zero oracle', () => {
  for (const observed of [anchor, null]) for (const scale of ['log', 'linear']) {
    for (let left = -2; left <= 63; left += 2.5) for (const span of [0, 1, 3, 10]) {
      const min = start + left * DAY, max = min + span * DAY;
      assert.deepEqual(equityForecastWindowRows(points, observed, min, max, scale), referenceWindow(min, max, scale, observed));
      const values = observed ? [{ ...observed, price: observed.close, low: observed.close, high: observed.close }, ...points] : points;
      const expected = values.slice(1).flatMap((row, index) => {
        const before = values[index], fields = ['price', 'low', 'high'].filter(key => (before[key] === 0) !== (row[key] === 0));
        return fields.length && row.time > min && before.time < max ? [{ from: before.time, to: row.time, fields }] : [];
      });
      assert.deepEqual(equityForecastLogGaps(points, observed, min, max), expected);
    }
  }
});

test('narrow forecast windows and marker lookup inspect logarithmic bounds plus visible rows', () => {
  for (const count of [1024, 16384, 65536]) {
    const rows = Array.from({ length: count }, (_, index) => ({ time: start + (index + 1) * DAY, date: new Date((start + (index + 1) * DAY) * 1000).toISOString(), price: 100, low: 0, high: 150 }));
    let reads = 0;
    const observed = new Proxy(rows, { get(target, key, receiver) { if (typeof key === 'string' && /^\d+$/.test(key)) reads++; return Reflect.get(target, key, receiver); } });
    const middle = Math.floor(count / 2), minTime = rows[middle].time, maxTime = rows[middle + 8].time;
    const window = equityForecastWindowRows(observed, anchor, minTime, maxTime);
    const gaps = equityForecastLogGaps(observed, anchor, minTime, maxTime);
    const forecast = { milestones: [{ id: 'middle', date: rows[middle + 4].date.slice(0, 10), title: 'Selected path point' }] };
    const rendered = equityForecastMarkup({ forecast, points: observed, lastObserved: anchor, minTime, maxTime, x: value => (value - minTime) / DAY, y: value => value, left: 0, right: 100, top: 0, bottom: 200, clipId: 'bounded', visibleRows: window });
    assert.equal(window.length, 9);
    assert.equal(gaps.length, 0);
    assert.equal(rendered.markerIds.has('middle'), true);
    const budget = 14 * Math.ceil(Math.log2(count)) + 90;
    assert.ok(reads <= budget, `${count} rows required ${reads} source reads; budget ${budget}`);
  }
});

test('calendar reuse keeps corrected prices fresh and still rejects malformed values', () => {
  const forecast = { path: [{ date: '2026-10-24', price: 120, low: 90, high: 150 }] };
  assert.equal(equityForecastRows(forecast, start)[0].price, 120);
  forecast.path[0].price = 125;
  assert.equal(equityForecastRows(forecast, start)[0].price, 125);
  forecast.path[0].price = NaN;
  assert.throws(() => equityForecastRows(forecast, start), /Invalid equity forecast path/);
  forecast.path[0].price = 120;
  for (const date of ['2026-02-30', '2026-10-24T00:00:00Z', '2026-10-24extra', null]) {
    forecast.path[0].date = date;
    assert.throws(() => equityForecastRows(forecast, start), /Invalid equity forecast date/);
  }
});
