import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { observeEthereumEvent } from '../dist/ethereum-event-observations.js';
import { parseEthArchive } from '../dist/eth-market-data.js';
import { ethereumEventDetailMarkup } from '../dist/ethereum-history.js';

const DAY = 86400, first = Date.parse('2025-01-31T00:00:00Z') / 1000;
function series(closes=[100,90,80,120,105,110,115,130]) {
  return {interval:'daily',source:'Coinbase Exchange',product:'ETH-USD',completedOnly:true,retrievedAt:'2025-02-08T12:00:00Z',
    candles:closes.map((close,index)=>({time:first+index*DAY,date:new Date((first+index*DAY)*1000).toISOString(),close}))};
}
const status = result => result.windows.map(window=>window.status);

test('observed windows include the calendar event day and share the preceding UTC close',()=>{
  const input=series(),before=JSON.stringify(input),result=observeEthereumEvent({date:'2025-02-01'},input);
  assert.equal(result.baselineDate,'2025-01-31');assert.equal(result.baselineClose,100);
  assert.deepEqual(result.windows.map(window=>[window.days,window.startDate,window.endDate,window.endClose]),[
    [1,'2025-02-01','2025-02-01',90],[3,'2025-02-01','2025-02-03',120],[7,'2025-02-01','2025-02-07',130],
  ]);
  for(const [index,expected] of [-10,20,30].entries())assert.ok(Math.abs(result.windows[index].changePct-expected)<1e-10);
  assert.deepEqual(status(result),['observed','observed','observed']);
  assert.equal(result.retrievedAt,input.retrievedAt);assert.equal(JSON.stringify(input),before);
});

test('a missing intermediate day invalidates only windows that require it, even with valid endpoint prices',()=>{
  const input=series();input.candles.splice(2,1);
  const result=observeEthereumEvent({date:'2025-02-01'},input);
  assert.deepEqual(status(result),['observed','missing-day','missing-day']);
  assert.equal(result.windows[1].changePct,null);assert.equal(result.windows[1].endClose,null);
  input.candles.splice(0,1);
  assert.deepEqual(status(observeEthereumEvent({date:'2025-02-01'},input)),['outside-coverage','outside-coverage','outside-coverage']);
});

test('pre-price, incomplete future windows and missing baseline days never acquire substituted prices',()=>{
  const input=series();
  for(const date of ['2015-07-30','2025-01-31','2025-02-08']){
    const result=observeEthereumEvent({date},input);
    assert.ok(result.windows.every(window=>window.changePct===null));
    assert.deepEqual(status(result),['outside-coverage','outside-coverage','outside-coverage']);
  }
  assert.deepEqual(status(observeEthereumEvent({date:'2025-02-07'},input)),['observed','outside-coverage','outside-coverage']);
  const gap=series();gap.candles.splice(2,1);
  assert.deepEqual(status(observeEthereumEvent({date:'2025-02-03'},gap)),['missing-day','missing-day','outside-coverage']);
});

test('the helper requires completed Coinbase ETH daily bars and valid collection provenance',()=>{
  for(const extra of [{interval:'weekly'},{product:'BTC-USD'},{source:'Other Exchange'},{completedOnly:false},{candles:[]}]){
    assert.deepEqual(status(observeEthereumEvent({date:'2025-02-01'},{...series(),...extra})),['unavailable','unavailable','unavailable']);
  }
  for(const edit of [
    value=>{value.retrievedAt='2025-02-07T12:00:00Z';},
    value=>{value.retrievedAt='unknown';},
    value=>{value.candles[0].retrievedAt='2025-01-31T12:00:00Z';},
    value=>{value.candles[0].retrievedAt='2025-02-09T12:00:00Z';},
    value=>{value.candles[1].time+=1;},
    value=>{value.candles[1].date='2025-02-03T00:00:00Z';},
    value=>{value.candles[1].close=0;},
    value=>{value.candles[1].close=Infinity;},
    value=>{value.candles.reverse();},
    value=>{value.candles.splice(1,0,{...value.candles[0]});},
  ]){
    const input=series();edit(input);
    assert.deepEqual(status(observeEthereumEvent({date:'2025-02-01'},input)),['invalid-data','invalid-data','invalid-data']);
  }
});

test('noncanonical dates and missing data do not become midnight assumptions or zero returns',()=>{
  for(const date of ['2025-02-30','2025-02-29','2025-2-01','2025-02-01T20:50:00Z','',null]){
    assert.deepEqual(status(observeEthereumEvent({date},series())),['invalid-date','invalid-date','invalid-date']);
  }
  assert.deepEqual(status(observeEthereumEvent({date:'2025-02-01'},null)),['unavailable','unavailable','unavailable']);
  const flat=observeEthereumEvent({date:'2025-02-01'},series(Array(8).fill(100)));
  assert.ok(flat.windows.every(window=>window.status==='observed'&&window.changePct===0));
});

test('actual archived prices remain descriptive observations with explicit windows in the detail',async()=>{
  const data=parseEthArchive(JSON.parse(await readFile(new URL('../dist/data/eth-ohlc.json',import.meta.url),'utf8')));
  const result=observeEthereumEvent({date:'2025-02-01'},data);
  assert.deepEqual(status(result),['observed','observed','observed']);
  const baseline=data.candles.find(candle=>candle.date.slice(0,10)==='2025-01-31');
  for(const window of result.windows){
    const end=data.candles.find(candle=>candle.date.slice(0,10)===window.endDate);
    assert.equal(window.changePct,(end.close/baseline.close-1)*100);
  }
  const event={id:'observed-policy',date:'2025-02-01',title:'정책 발표 기록',category:'macro',description:'발표 사실',detail:'시장 해석과 분리합니다.',dateBasis:'발표한 달력 날짜',crossCheck:'원문 대조',sources:[],policyAction:'발표 내용',marketContext:'당시 보도의 해석',followUp:'후속 유예'};
  const markup=ethereumEventDetailMarkup(event,{firstDate:'2016-05-18',lastDate:'2026-10-23',dailySeries:data});
  assert.match(markup,/주변 가격 기록/);assert.match(markup,/2025-01-31 UTC 종가/);
  assert.match(markup,/사건 날짜를 포함한 1·3·7일/);assert.match(markup,/발표 직후의 수익률이나 사건만의 가격 효과를 뜻하지 않습니다/);
  assert.match(markup,/정책·결정/);assert.match(markup,/당시 시장 해석/);assert.match(markup,/후속 변화/);
  assert.equal((markup.match(/data-event-observation-window=/g)||[]).length,3);
});
