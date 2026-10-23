import test from 'node:test';
import assert from 'node:assert/strict';
import {createChartExportDataSnapshot,supportsChartImageClipboard} from '../dist/chart-export-workbench.js';
import {createObservedChartCsv,createConditionalChartCsv,createResearchSeriesCsv,chartCsvCell} from '../dist/chart-export.js';

const rows=[{date:'2026-10-01',price:100},{date:'2026-10-02',price:110},{date:'2026-10-04',price:130}];
const candle={date:'2026-10-04',time:Date.parse('2026-09-28T00:00:00Z')/1000,open:102,high:150,low:80,close:125,volume:12};
const context={rows,observedCandles:[candle],candleSource:'Bitstamp',frequency:'weekly',chartType:'candles',unit:'indexed-start',display:{unit:'indexed-start',basePrice:102,baseDate:'2026-09-28',factor:100/102,offset:0},range:{start:'2026-10-01',end:'2026-10-10'},asOf:'2026-10-04',capturedAt:'2026-10-23T00:00:00Z'};

test('export preview distinguishes displayed weekly OHLC from full daily source rows and always exports raw USD',()=>{
  const result=createChartExportDataSnapshot(context),daily=result.datasets.find(item=>item.id==='coin-metrics-daily'),weekly=result.datasets.find(item=>item.id==='bitstamp-ohlc');
  assert.equal(result.metadata.frequency,'weekly');assert.match(result.metadata.displayLabel,/기준 100/);assert.match(result.metadata.displayLabel,/102/);
  assert.equal(daily.rowCount,3);assert.equal(daily.interval,'daily');assert.match(daily.csv,/,daily,Coin Metrics,USD,,,,130,,observed/);assert.doesNotMatch(daily.csv,/2026-10-03/);
  assert.equal(weekly.rowCount,1);assert.equal(weekly.interval,'weekly');assert.match(weekly.csv,/2026-10-04,2026-09-28T00:00:00.000Z,weekly,Bitstamp,USD,102,150,80,125,12,observed/);
  assert.equal(weekly.loadedRange.start,'2026-10-04T00:00:00.000Z');assert.equal(weekly.exportRange.end,'2026-10-04T00:00:00.000Z');
  assert.throws(()=>{result.metadata.display.basePrice=999;},TypeError);assert.equal(context.display.basePrice,102);
});

test('observed and conditional CSV are independent snapshots without observed anchors in the assumption file',()=>{
  const mutable={...context,rows:structuredClone(rows),range:{start:'2026-10-01',end:'2026-10-10'},forecast:{scenarioId:'base',scenarioLabel:'기준',path:[{date:'2026-10-04',price:130,kind:'observed-anchor'},{date:'2026-10-05',price:140,lower:90,upper:180},{date:'2026-10-07',price:150,lower:100,upper:190}]}};
  const result=createChartExportDataSnapshot(mutable),observed=result.datasets.find(item=>item.id==='coin-metrics-daily'),conditional=result.datasets.find(item=>item.id==='conditional-path');
  assert.equal(conditional.observedOnly,false);assert.equal(conditional.kind,'conditional');assert.equal(conditional.rowCount,2);assert.match(conditional.csv,/,USD,140,90,180,base,기준,2026-10-04,conditional,false/);assert.doesNotMatch(conditional.csv,/^2026-10-04,/m);assert.doesNotMatch(observed.csv,/2026-10-05/);
  mutable.rows[0].price=999;mutable.forecast.path[1].price=999;mutable.forecast.scenarioLabel='changed';assert.doesNotMatch(observed.csv,/999/);assert.doesNotMatch(conditional.csv,/999|changed/);
});

test('intraday CSV includes only completed loaded Coinbase bars and preserves missing intervals and zero volume',()=>{
  const start=Date.parse('2026-10-23T12:00:00Z')/1000,candles=[0,2,3].map(index=>({time:start+index*60,date:new Date((start+index*60)*1000).toISOString(),open:100,high:130,low:90,close:120,volume:0}));
  const result=createChartExportDataSnapshot({frequency:'1m',range:{start,end:start+240,unit:'seconds'},unit:'percent',intradaySeries:{candles,source:'Coinbase Exchange',completedOnly:true,retrievedAt:new Date((start+210)*1000).toISOString()}}),item=result.datasets[0];
  assert.equal(result.datasets.length,1);assert.equal(item.id,'coinbase-ohlc');assert.equal(item.rowCount,2);assert.equal(item.loadedRange.end,'2026-10-23T12:02:00.000Z');assert.match(item.csv,/,1m,Coinbase Exchange,USD,100,130,90,120,0,observed/);assert.doesNotMatch(item.csv,/12:01:00|12:03:00/);assert.match(result.metadata.displayLabel,/%/);
});

test('CSV cells defend source, labels and notes against formula injection without changing valid numeric data',()=>{
  for(const value of ['=HYPERLINK("x")','  +cmd','\tformula','\n=1','@SUM(1)','-bad'])assert.ok(chartCsvCell(value).includes("'"),value);
  assert.equal(chartCsvCell(-12.5),'-12.5');assert.equal(chartCsvCell('normal'),'normal');
  const output=createConditionalChartCsv({path:[{date:'2026-10-05',price:140}],range:context.range,asOf:'2026-10-04',scenarioId:'=formula',scenarioLabel:'  @bad',source:'+cmd'});assert.match(output,/'=formula/);assert.match(output,/'  @bad/);assert.match(output,/'\+cmd/);
  const indicator=createResearchSeriesCsv({rows:[{date:'2026-10-02',value:-10,note:'=bad'}],columns:[{key:'value',label:'value'},{key:'note',label:'note'}],range:context.range,source:'Atlas',unit:'%',kind:'derived'});assert.match(indicator,/,derived,-10,'=bad/);
});

test('empty, corrupt OHLC and invalid cutoffs report errors instead of fabricating export rows',()=>{
  const empty=createChartExportDataSnapshot({...context,range:{start:'2030-01-01',end:'2030-12-31'}});assert.ok(empty.datasets.every(item=>item.csv===null&&item.rowCount===0&&item.error));assert.equal(empty.datasets[0].loadedRange.end,'2026-10-04T00:00:00.000Z');
  assert.throws(()=>createObservedChartCsv({...context,candles:[{...candle,high:100}],source:'Bitstamp'}),/OHLC/);
  assert.throws(()=>createObservedChartCsv({...context,asOf:'invalid'}),/기준 시각/);
  assert.throws(()=>createResearchSeriesCsv({rows:[{date:'2026-10-02',value:Infinity}],columns:[{key:'value',label:'value'}],range:context.range}),/유효하지/);
});

test('analysis CSV keeps its source and unit separate and accepts explicit daily numeric view ranges',()=>{
  const day=date=>Date.parse(date)/86400000,result=createChartExportDataSnapshot({...context,range:{start:day('2026-10-01'),end:day('2026-10-04'),unit:'days'},researchSeries:[{id:'drawdown',label:'전고점 대비',source:'Coin Metrics derived',interval:'daily',unit:'%',kind:'derived',rows:[{date:'2026-10-02',value:-20}],columns:[{key:'value',label:'drawdown_pct'}]}]});
  assert.equal(result.datasets[0].rowCount,3);const item=result.datasets.find(row=>row.id==='research-drawdown');assert.equal(item.rowCount,1);assert.equal(item.currency,'%');assert.equal(item.observedOnly,false);assert.match(item.csv,/,daily,Coin Metrics derived,%,derived,-20/);
});

test('clipboard option requires both image-capable ClipboardItem and a write API',()=>{
  assert.equal(supportsChartImageClipboard({}),false);assert.equal(supportsChartImageClipboard({navigator:{clipboard:{write(){}}}}),false);
  assert.equal(supportsChartImageClipboard({navigator:{clipboard:{write(){}}},ClipboardItem:class{static supports(){return false;}}}),false);
  assert.equal(supportsChartImageClipboard({navigator:{clipboard:{write(){}}},ClipboardItem:class{static supports(type){return type==='image/png';}}}),true);
});

test('independent research axes export all supplied pane rows without applying the price viewport dates',()=>{
  const result=createChartExportDataSnapshot({...context,researchSeries:[{id:'cycles',label:'4년 비교',interval:'cycle-elapsed-days',unit:'index',source:'Coin Metrics derived',rows:[{date:'2013-01-01',elapsedDays:10,value:105},{date:'2017-01-01',elapsedDays:10,value:120}],columns:[{key:'elapsedDays',label:'elapsed_days'},{key:'value',label:'index'}]},{id:'durations',label:'구간 길이',interval:'cycle-duration',unit:'days',rows:[{start:'2015-01-14',peak:'2017-12-16',end:'2018-12-15',days:1431}],columns:[{key:'start',label:'start_utc'},{key:'peak',label:'peak_utc'},{key:'end',label:'end_utc'},{key:'days',label:'days'}]}]});
  const cycles=result.datasets.find(item=>item.id==='research-cycles'),durations=result.datasets.find(item=>item.id==='research-durations');assert.equal(cycles.rowCount,2);assert.match(cycles.csv,/2013-01-01,cycle-elapsed-days/);assert.equal(cycles.rangeBasis,'analysis-pane');assert.match(cycles.note,/가격 차트 날짜 범위 필터를 적용하지/);assert.equal(durations.rowCount,1);assert.match(durations.csv,/2015-01-14,2017-12-16,2018-12-15,1431/);assert.equal(durations.exportRange,null);
});
