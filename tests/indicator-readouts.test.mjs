import assert from 'node:assert/strict';
import test from 'node:test';
import {INDICATORS} from '../dist/indicator-state.js';
import {indicatorReadout,indicatorReadoutDate} from '../dist/indicator-readouts.js';
import {barPriceChange} from '../dist/chart-math.js';

const read=(id,context)=>indicatorReadout(INDICATORS.find(item=>item.id===id),context);
const observed={date:'2026-10-21',price:84023.24,open:82946.02,high:84842.65,low:82552.76,close:84023.24,...barPriceChange(84023.24,83100,82946.02),previousCloseDate:'2026-10-20',volume:2220,source:'Bitstamp',volumeSource:'Bitstamp',kind:'observed',frequency:'daily',unit:'usd'};
const workbench={chartType:'candles',historicalLabelMeta:{total:43,labels:9,hidden:34},countdown:{status:'upcoming',today:'2026-10-22',date:'2027-01-18',dday:'D-88',nextLabel:'하락',minimumRunDays:7},marketStatus:'Bitstamp BTC/USD · 2026-10-22 11:53 UTC 수집'};

test('every library row has an explicit value or honest availability status',()=>{
  for(const item of INDICATORS){
    for(const context of [{},{selection:observed,workbench}]){
      const result=indicatorReadout(item,context);
      assert.ok(result.value.length>0,item.id);assert.ok(result.title.length>0,item.id);
      assert.doesNotMatch(result.value,/undefined|NaN|Infinity/);
    }
  }
  assert.match(read('history',{selection:observed,workbench}).value,/43개 사건 · 이름 9개/);
  assert.equal(read('countdown',{selection:observed,workbench}).value,'D-88 · 하락 가정');
});

test('actual BTC volume and conditional volume keep distinct scopes and units',()=>{
  const actual=read('volume',{selection:observed,workbench});
  assert.equal(actual.value,'Vol 2.22k BTC');assert.match(actual.title,/Bitstamp/);assert.doesNotMatch(actual.value,/가정/);
  const projected={...observed,kind:'simulated',volumeKind:'scenario',volumeLower:1000,volumeUpper:4500};
  assert.equal(read('volume',{selection:projected}).value,'Vol 가정 2.22k BTC/일');
  assert.equal(read('volume',{selection:{...projected,frequency:'weekly'}}).value,'Vol 가정 2.22k BTC/주');
  assert.match(read('volume',{selection:projected}).title,/확률구간이 아닙니다/);
  assert.equal(read('volume',{selection:{...observed,volume:0}}).value,'Vol 0 BTC');
  assert.equal(read('volume',{selection:{...observed,volume:null}}).value,'Vol 자료 없음');
});

test('daily-only values never leak a stale daily forecast into an intraday selection',()=>{
  for(const item of INDICATORS.filter(item=>item.dailyOnly))assert.equal(indicatorReadout(item,{selection:observed,workbench:{...workbench,intraday:true}}).value,'1D · 1W에서 표시');
  const value=read('volume',{selection:{...observed,volume:.868811,frequency:'1m'},workbench:{intraday:true}});
  assert.equal(value.value,'Vol 0.868811 BTC');
});

test('historical clock with insufficient evidence cannot borrow current calibration',()=>{
  const cycle={causal:true,state:'shortened',label:'단축',appliedShiftDays:-52,cycleLengthDays:1409};
  assert.equal(read('cycle-timing',{selection:{...observed,cycleTiming:null},cycle}).value,'관측 근거 대기');
  assert.equal(read('cycle-timing',{selection:{...observed,cycleTiming:{...cycle,state:'insufficient'}},cycle}).value,'관측 근거 대기');
  assert.equal(read('cycle-timing',{selection:{...observed,cycleTiming:cycle}}).value,'단축 −52일');
});

test('assumption range and Coin Metrics drawdown are not invented for exchange candles',()=>{
  assert.equal(read('range',{selection:{...observed,lower:50000,upper:180000}}).value,'미래 구간의 가정 범위');
  assert.equal(read('range',{selection:{...observed,kind:'simulated',lower:50000,upper:180000}}).value,'$50,000–$180,000');
  assert.equal(read('drawdown',{selection:{...observed,drawdownPct:null}}).value,'일말 가격선에서 확인');
  assert.equal(read('drawdown',{selection:{...observed,open:undefined,drawdownPct:-12.75}}).value,'−12.75%');
});

test('fibonacci readout respects the confirmation date of the current swing',()=>{
  const fib=[{ratio:.5,price:50000,startDate:'2026-08-01'},{ratio:.618,price:45000,startDate:'2026-08-01'}];
  assert.equal(read('fibonacci',{selection:{...observed,date:'2026-07-01',fib}}).value,'이 날짜에는 스윙 확인 전');
  assert.equal(read('fibonacci',{selection:{...observed,fib}}).value,'61.8% · $45,000');
});

test('turn readout identifies observed and conditional points and preserves confirmation timing',()=>{
  const turn={type:'low',date:'2026-06-30',price:58525.07,confirmationDate:'2026-09-02',kind:'observed'};
  assert.equal(read('turns',{selection:{...observed,date:'2026-08-01',turn}}).value,'이 날짜에는 전환점 확인 전');
  assert.equal(read('turns',{selection:{...observed,turn}}).value,'저점 2026.06.30 · $58,525.07');
  const assumed={...turn,kind:'simulated'};
  assert.equal(read('turns',{selection:{...observed,turn:assumed}}).value,'저점 가정 2026.06.30 · $58,525.07');
});

test('period study shows the selected metric, with full source fields retained in the description',()=>{
  const detail={label:'2026-09',kind:'observed',fields:[{label:'기간 수익률',value:'+15%'},{label:'가격 흔들림 · 연간 환산',value:'44.3%'}],note:'실제 일말 자료'};
  const analyses=new Map([['periods',{metric:'realizedVolPct',detail}]]);
  assert.equal(read('periods',{analyses}).value,'2026-09 · 44.3%');
  assert.match(read('periods',{analyses}).title,/기간 수익률: \+15%/);
});

test('selection date, currency mode and observed source track the displayed point',()=>{
  assert.equal(indicatorReadoutDate({...observed,hovered:true}),'2026.10.21 UTC · 커서');
  assert.equal(indicatorReadoutDate({...observed,kind:'simulated'}),'2026.10.21 UTC · 선택 · 가정');
  assert.match(read('readout',{selection:{...observed,unit:'indexed',displayedPrice:98.55}}).value,/98.55 · 지수/);
  assert.match(read('readout',{selection:observed}).title,/O \$82,946.02 · H \$84,842.65 · L \$82,552.76 · C \$84,023.24/);
  assert.equal(read('source',{selection:{...observed,source:'Coin Metrics'}}).value,'Coin Metrics · Vol Bitstamp');
  const unavailable={date:'2026-10-10T10:00:00Z',price:NaN,volume:NaN,kind:'unavailable'};
  assert.equal(read('readout',{selection:unavailable}).value,'선택 범위에 가격 없음');
  assert.equal(read('volume',{selection:unavailable}).value,'Vol 자료 없음');
  assert.equal(indicatorReadoutDate(unavailable),'2026.10.10 10:00 UTC · 범위 · 자료 없음');
});

test('price values identify percent, start-index and latest-index units while keeping raw USD and the basis in provenance',()=>{
  const original={...observed,price:110,previousClose:null,changePct:null,displayedPrice:10};
  const percentage=read('readout',{selection:{...original,unit:'percent',display:{unit:'percent',baseDate:'2026-10-01',basePrice:100,factor:1,offset:-100}}});
  assert.equal(percentage.value,'10% · 표시 시작 대비');assert.match(percentage.title,/기준 2026\.10\.01 UTC · 기준 가격 \$100 · 원래 가격 \$110/);
  for(const [unit,label] of [['indexed','최근 관측'],['indexed-start','표시 시작']]){
    const result=read('readout',{selection:{...original,unit,displayedPrice:110,display:{unit,baseDate:'2026-10-01',basePrice:100,factor:1,offset:0}}});
    assert.equal(result.value,`110 · 지수 · ${label} = 100`);assert.match(result.title,/원래 가격 \$110/);
  }
  const metadataOnly=read('readout',{selection:{...original,unit:'percent',displayedPrice:undefined,display:{unit:'percent',factor:2,offset:-100,basePrice:50}}});
  assert.equal(metadataOnly.value,'120% · 표시 시작 대비');
  const unavailable=read('readout',{selection:{...original,unit:'indexed-start',displayedPrice:null,display:{available:false}}});assert.equal(unavailable.value,'표시 기준 가격 없음');assert.doesNotMatch(unavailable.value,/\$110/);
});

test('OHLC readout names the previous-close return even when the same candle rises from its open',()=>{
  const selected={...observed,price:105,open:100,high:108,low:99,close:105,...barPriceChange(105,110,100)};
  const result=read('readout',{selection:selected});
  assert.equal(result.value,'$105  전봉 −4.55%');assert.equal(result.tone,'down');
  assert.match(result.title,/직전 봉 종가 대비 −4\.55% · 기준 \$110/);
  assert.match(result.title,/2026\.10\.20 UTC/);assert.match(result.title,/시가 대비 \+5%/);
  assert.doesNotMatch(result.title,/시가 대비 −4\.55%/);
});

test('a first or unavailable preceding bar cannot substitute its open-to-close move for the header return',()=>{
  for(const previousClose of [null,undefined,0,NaN]){
    const selected={...observed,price:105,open:100,close:105,...barPriceChange(105,previousClose,100),previousCloseDate:null};
    const result=read('readout',{selection:selected});
    assert.equal(result.value,'$105');assert.equal(result.tone,'neutral');
    assert.match(result.title,/직전 봉 자료 없음/);assert.match(result.title,/시가 대비 \+5%/);
    assert.doesNotMatch(result.value,/%/);
  }
});
