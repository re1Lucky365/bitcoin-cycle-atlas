import assert from 'node:assert/strict';
import test from 'node:test';
import {equityForecastCandles} from '../dist/equity-forecast-chart.js';

const prices=[100,110,80,130,120,160,70,115,125];
const start=Date.parse('2026-10-19T00:00:00Z');
const forecast={asOf:'2026-10-19',pathMode:'asset-linked-daily',path:prices.map((price,index)=>({date:new Date(start+index*86400000).toISOString().slice(0,10),price,low:Math.max(0,price-20),high:price+20,sourceIds:['asset','filing']}))};

test('daily simulated bars preserve weekend valuation moves without inventing weekend trading candles',()=>{
  const rows=equityForecastCandles(forecast,'daily');
  assert.deepEqual(rows.map(row=>row.date.slice(0,10)),['2026-10-20','2026-10-21','2026-10-22','2026-10-23','2026-10-26','2026-10-27']);
  const monday=rows.find(row=>row.date.startsWith('2026-10-26'));
  assert.deepEqual([monday.candle.open,monday.candle.high,monday.candle.low,monday.candle.close],[120,160,70,115]);
  assert.equal(monday.candle.startDate,'2026-10-23');
  assert.equal(monday.candle.endDate,'2026-10-26');
  assert.equal(monday.low,95,'scenario lower bound is separate from the simulated path low');
  assert.equal(monday.high,135);
  assert.equal(monday.kind,'forecast');
  assert.equal(monday.volume,undefined);
  assert.equal(monday.open,undefined,'top-level OHLC is reserved for observations');
});

test('weekly simulated bars aggregate the same path and never start before the forecast anchor',()=>{
  const rows=equityForecastCandles(forecast,'weekly');
  assert.equal(rows.length,2);
  assert.equal(rows[0].date.slice(0,10),'2026-10-20');
  assert.deepEqual([rows[0].candle.open,rows[0].candle.high,rows[0].candle.low,rows[0].candle.close],[100,130,80,120]);
  assert.deepEqual([rows[1].candle.open,rows[1].candle.high,rows[1].candle.low,rows[1].candle.close],[120,160,70,125]);
  assert.equal(rows[1].valuationDate,'2026-10-27');
  assert.equal(rows[1].low,105);
});

test('simulated bar generation cannot silently turn monthly target interpolation into daily OHLC',()=>{
  assert.deepEqual(equityForecastCandles({...forecast,pathMode:'target-interpolation'},'daily'),[]);
  assert.throws(()=>equityForecastCandles(forecast,'hourly'),/interval/);
  assert.throws(()=>equityForecastCandles({...forecast,path:forecast.path.filter((_,index)=>index!==4)},'daily'),/consecutive/);
  assert.deepEqual(forecast.path.map(row=>row.price),prices,'display construction cannot mutate the source model');
});

test('zero-valued simulated path bars retain depletion instead of substituting a positive value',()=>{
  const zero={...forecast,path:forecast.path.map((row,index)=>index<3?row:{...row,price:0,low:0,high:30})};
  const rows=equityForecastCandles(zero,'daily');
  assert.equal(rows.at(-1).price,0);
  assert.equal(rows.at(-1).candle.low,0);
  assert.equal(rows.at(-1).candle.high,0);
});

test('a midweek anchor creates a partial first week and carries weekend extrema into the following week',()=>{
  const values=[100,120,80,160,60,110,130,90,140,100];
  const midweek={asOf:'2026-10-21',pathMode:'asset-linked-daily',path:values.map((price,index)=>({date:new Date(Date.parse('2026-10-21T00:00:00Z')+index*86400000).toISOString().slice(0,10),price,low:price-40,high:price+80,sourceIds:[`source-${index}`]}))};
  const before=structuredClone(midweek),rows=equityForecastCandles(midweek,'weekly');
  assert.deepEqual(rows.map(row=>row.date.slice(0,10)),['2026-10-22','2026-10-26']);
  assert.deepEqual(rows.map(row=>[row.candle.open,row.candle.high,row.candle.low,row.candle.close]),[[100,120,80,80],[80,160,60,100]]);
  assert.equal(rows[0].candle.startDate,midweek.asOf);
  assert.equal(rows[0].candle.endDate,'2026-10-23');
  assert.equal(rows[1].candle.startDate,'2026-10-23');
  assert.equal(rows[1].candle.endDate,'2026-10-30');
  assert.deepEqual([rows[1].low,rows[1].high],[60,180]);
  assert.ok(rows[1].sourceIds.includes('source-3')&&rows[1].sourceIds.includes('source-4'),'Saturday and Sunday extrema retain their source IDs');
  assert.deepEqual(midweek,before);
});
