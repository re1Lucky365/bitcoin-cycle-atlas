import assert from 'node:assert/strict';
import test from 'node:test';
import { createObservedChartCsv } from '../dist/chart-export.js';

test('visible price CSV contains every original observation, no gap fill or future model rows',()=>{
  const rows=[{date:'2026-10-01',price:100},{date:'2026-10-02',price:110},{date:'2026-10-04',price:90},{date:'2026-10-05',price:120},{date:'2026-10-06',price:999}];
  const csv=createObservedChartCsv({rows,range:{start:'2026-10-02',end:'2026-10-06'},asOf:'2026-10-05',frequency:'weekly'});
  const lines=csv.trim().split('\r\n');assert.equal(lines.length,4);
  assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes('2026-10-02,,daily,Coin Metrics,USD,,,,110,,observed'));
  assert.ok(csv.includes('2026-10-04,,daily,Coin Metrics,USD,,,,90,,observed'));
  assert.ok(!csv.includes('2026-10-03'));assert.ok(!csv.includes('999'));
});

test('intraday CSV preserves exact source OHLC and zero-volume completed candles',()=>{
  const time=Date.parse('2026-10-21T00:00:00Z')/1000;
  const candles=[0,1,3].map(i=>({time:time+i*60,date:new Date((time+i*60)*1000).toISOString(),open:100,high:125,low:75,close:110,volume:0}));
  const csv=createObservedChartCsv({candles,range:{start:time,end:time+180},frequency:'1m',source:'Coinbase Exchange'});
  assert.equal(csv.trim().split('\r\n').length,4);
  assert.ok(csv.includes(',1m,Coinbase Exchange,USD,100,125,75,110,0,observed'));
  assert.ok(!csv.includes('00:02:00'));
});

test('CSV distinguishes weekly chart label from candle opening time and escapes source text',()=>{
  const candle={date:'2026-10-18',time:Date.parse('2026-10-12T00:00:00Z')/1000,open:100,high:125,low:75,close:110,volume:1};
  const csv=createObservedChartCsv({candles:[candle],range:{start:'2026-10-01',end:'2026-10-21'},frequency:'weekly',source:'=source,"quoted"'});
  assert.ok(csv.includes('2026-10-18,2026-10-12T00:00:00.000Z,weekly,"\'=source,""quoted"""'));
});

test('an empty actual-data window fails explicitly instead of exporting simulated values',()=>{
  assert.throws(()=>createObservedChartCsv({rows:[{date:'2026-10-21',price:100}],asOf:'2026-10-21',range:{start:'2027-01-01',end:'2027-02-01'}}),/실제 관측값/);
});
