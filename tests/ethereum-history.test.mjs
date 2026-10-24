import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { readEthereumEventSettings, ethereumEventQuery, ethereumEventRange, ethereumEventDetailMarkup, ethereumHistoryList } from '../dist/ethereum-history.js';
import { ETHEREUM_EVENTS } from '../dist/ethereum-events.js';
import { parseEthArchive } from '../dist/eth-market-data.js';
import { readEthView, ethViewQuery } from '../dist/eth-view-state.js';
import { panRange, zoomRange } from '../dist/chart-navigation.js';

const DAY=86400,epoch=date=>Date.parse(`${date}T00:00:00Z`)/1000;
const dateAt=time=>new Date(time*1000).toISOString().slice(0,10);
function archive({start='2022-01-03',count=400}={}){
  const first=epoch(start),candles=Array.from({length:count},(_,i)=>({time:first+i*DAY}));
  return {interval:'daily',product:'ETH-USD',candles,retrievedAt:new Date((first+count*DAY)*1000).toISOString()};
}
const sample=(extra={})=>({
  id:'synthetic-event',date:'2022-09-15',label:'사건',title:'검증용 역사 사건',category:'protocol',importance:2,
  description:'프로토콜 변경을 기록합니다.',detail:'확인한 자료의 범위를 설명합니다.',
  dateBasis:'원문이 명시한 달력 날짜를 사용합니다. 정확한 UTC 시각은 별도 검증하지 않았습니다.',
  datePrecision:'source-calendar-day',crossCheck:'독립된 원문 두 개의 날짜와 실제 실행 여부를 대조했습니다.',
  limitations:['일정 발표와 실제 실행을 구분합니다.','사건과 가격 변화의 인과관계를 주장하지 않습니다.'],
  sources:[{url:'https://ethereum.org/en/history/',title:'공식 기록',publisher:'Ethereum',type:'primary',publishedAt:'2022-09-15',claim:'실제 실행 날짜를 확인합니다.'}],
  ...extra,
});
const jumpTag=markup=>markup.match(/<button\b[^>]*data-event-jump="[^"]*"[^>]*>/)?.[0];

test('history settings use explicit ETH keys, validate categories and default to observed event context',()=>{
  assert.deepEqual(readEthereumEventSettings(new URLSearchParams()),{visible:true,category:'all'});
  for(const category of ['protocol','security','market','ecosystem','macro','regulation','geopolitics']){
    assert.deepEqual(readEthereumEventSettings(new URLSearchParams(`eth-events=off&eth-event-category=${category}`)),{visible:false,category});
  }
  const btc=new URLSearchParams('history=off&events=off&history-category=protocol&eth-event-category=__proto__');
  assert.deepEqual(readEthereumEventSettings(btc),{visible:true,category:'all'});
  for(const category of ['<script>','constructor','unknown',''])assert.equal(readEthereumEventSettings(new URLSearchParams({'eth-event-category':category})).category,'all');
});

test('event query edits own keys without dropping presentation state, and ETH integration removes BTC state',()=>{
  const base='symbol=ETHUSD&granularity=4h&type=candles&axis=linear&eth-span=1y&eth-events=off&eth-events=off&eth-event-category=security';
  const enabled=new URLSearchParams(ethereumEventQuery(base,{visible:true,category:'all'}));
  assert.deepEqual([...enabled],[['symbol','ETHUSD'],['granularity','4h'],['type','candles'],['axis','linear'],['eth-span','1y']]);
  const filtered=new URLSearchParams(ethereumEventQuery(enabled,{visible:false,category:'ecosystem'}));
  assert.equal(filtered.getAll('eth-events').length,1);assert.equal(filtered.get('eth-event-category'),'ecosystem');
  assert.deepEqual(readEthereumEventSettings(filtered),{visible:false,category:'ecosystem'});
  const polluted=new URLSearchParams('page=compare&scenario=stress&view-start=1900-01-01&view-end=2050-01-01&price-min=90000&indicators=cycle&granularity=weekly&type=candles&axis=linear&eth-events=off&eth-event-category=market');
  const owned=new URLSearchParams(ethereumEventQuery(ethViewQuery(readEthView(polluted)),readEthereumEventSettings(polluted)));
  assert.equal(owned.get('symbol'),'ETHUSD');assert.equal(owned.get('granularity'),'weekly');assert.equal(owned.get('type'),'candles');
  assert.ok([...owned.keys()].every(key=>['symbol','granularity','type','axis','eth-span','eth-events','eth-event-category'].includes(key)));
  assert.deepEqual(readEthereumEventSettings(owned),{visible:false,category:'market'});
});

test('pre-price and post-observation events have no invented chart range or clamped substitute date',()=>{
  const source=archive({start:'2016-05-24',count:500}),first=source.candles[0].time,last=source.candles.at(-1).time;
  for(const date of ['2015-07-30',dateAt(first-DAY),dateAt(last+DAY),'2050-01-01'])assert.equal(ethereumEventRange({date},source),null);
  assert.equal(ethereumEventRange(null,source),null);
  assert.equal(ethereumEventRange({date:'2016-05-24'},{...source,interval:'weekly'}),null);
  assert.equal(ethereumEventRange({date:'2016-05-24'},{...source,candles:[]}),null);
  assert.equal(ethereumEventRange({date:'2016-05-24'},null),null);
});

test('event focus stays on valid daily UTC boundaries and existing navigation preserves observed bounds',()=>{
  for(const count of [1,8,400]){
    const source=archive({count}),first=source.candles[0].time,last=source.candles.at(-1).time;
    for(const candle of [source.candles[0],source.candles[Math.floor(count/2)],source.candles.at(-1)]){
      const range=ethereumEventRange({date:dateAt(candle.time)},source);
      assert.ok(range&&range.start<=candle.time&&range.end>=candle.time);
      assert.equal(range.min,first-DAY);assert.equal(range.max,last+DAY);
      assert.ok(range.start>=range.min&&range.end<=range.max);assert.ok(range.end-range.start<=181*DAY);
      assert.equal(range.unit,'seconds');assert.equal(range.step,DAY);assert.match(range.contextKey,/^ETH-USD:daily:/);
      assert.ok(Number.isInteger((range.start-first)/DAY));assert.ok(Number.isInteger((range.end-first)/DAY));
      const zoom=zoomRange(range,.6,.5),past=panRange(zoom,-100),recent=panRange(zoom,100);
      assert.ok(past.start>=first-DAY);assert.ok(recent.end<=last+DAY);
      assert.ok(range.end*1000<=Date.parse(source.retrievedAt));
    }
  }
});

test('calendar dates must be canonical so impossible days and timestamp strings cannot silently jump to another day',()=>{
  const source=archive();
  for(const date of ['2022-02-30','2022-02-29','2022-13-01','2022-00-10','2022-01-04T12:00:00Z','2022-01-04garbage','January 4 2022','',null])assert.equal(ethereumEventRange({date},source),null,String(date));
  const leap=archive({start:'2024-01-01',count:100});assert.ok(ethereumEventRange({date:'2024-02-29'},leap));
});

test('pre-price facts retain their source details but disable price navigation and explain the coverage boundary',()=>{
  const before=sample({date:'2015-07-30'}),context={firstDate:'2016-05-24',lastDate:'2026-10-23'};
  const markup=ethereumEventDetailMarkup(before,context);
  assert.match(jumpTag(markup),/\bdisabled\b/);assert.match(markup,/가격 자료 시작일\(2016-05-24\) 이전 사건/);
  assert.match(markup,/2015-07-30/);assert.match(markup,/https:\/\/ethereum\.org\/en\/history\//);assert.match(markup,/날짜 기준/);
  assert.match(jumpTag(ethereumEventDetailMarkup(sample({date:'2026-10-24'}),context)),/\bdisabled\b/);
  assert.match(ethereumEventDetailMarkup(sample({date:'2026-10-24'}),context),/현재 저장된 완료 일봉 이후 사건/);
  assert.match(jumpTag(ethereumEventDetailMarkup(sample())),/\bdisabled\b/);
  assert.doesNotMatch(jumpTag(ethereumEventDetailMarkup(sample(),context)),/\bdisabled\b/);
  assert.match(ethereumEventDetailMarkup(sample(),context),/사건 발생 순간의 체결 가격을 뜻하지 않습니다/);
});

test('day-level records keep source calendar context without inventing exact UTC midnight or event-time prices',()=>{
  const context={firstDate:'2016-05-24',lastDate:'2026-10-23'},markup=ethereumEventDetailMarkup(sample(),context);
  assert.match(markup,/원문이 명시한 달력 날짜/);assert.match(markup,/정확한 UTC 시각은 별도 검증하지 않았습니다/);
  assert.doesNotMatch(markup,/검증한 시각 ·|2022-09-15T00:00|2022-09-15 00:00/);
  const precise=ethereumEventDetailMarkup(sample({datePrecision:'verified-instant',timestampUtc:'2022-09-15T06:42:42Z'}),context);
  assert.match(precise,/검증한 시각 · 2022-09-15 06:42:42 UTC/);
  assert.match(precise,/독립된 원문 두 개/);assert.match(precise,/일정 발표와 실제 실행/);
});

test('source detail escapes all dynamic text and permits only HTTPS links with an isolated new tab',()=>{
  const hostile='<img src=x onerror=alert(1)>',sources=[
    {url:'https://example.org/source?x=" onmouseover="bad',title:`공식 ${hostile}`,publisher:hostile,claim:hostile,type:'primary',publishedAt:hostile},
    ...['javascript:alert(1)','data:text/html,<script>alert(1)</script>','http://example.org','//example.org','/relative-source','not a URL'].map(url=>({url,title:`차단 ${hostile}`,publisher:hostile,type:'secondary',claim:hostile})),
  ];
  const value=sample({id:`event" ${hostile}`,title:hostile,label:hostile,description:hostile,detail:`details ${hostile}`,dateBasis:hostile,crossCheck:hostile,limitations:[hostile],policyAction:hostile,marketContext:hostile,followUp:hostile,facts:{announcementUtc:hostile},sources});
  const markup=ethereumEventDetailMarkup(value,{firstDate:'2016-05-24',lastDate:'2026-10-23'});
  assert.doesNotMatch(markup,/<img|<script|href="(?:javascript:|data:|http:|\/)/);
  assert.match(markup,/&lt;img src=x onerror=alert\(1\)&gt;/);
  const links=[...markup.matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>/g)];assert.equal(links.length,1);
  assert.ok(links[0][1].startsWith('https://example.org/source?x=&quot;'));assert.match(links[0][0],/target="_blank"/);assert.match(links[0][0],/rel="noopener noreferrer"/);
  assert.match(markup,/보조 검증 자료/);assert.match(markup,/1차 자료/);
  assert.match(ethereumEventDetailMarkup(null),/사건을 선택하면/);
});

test('the expanded catalog supports combined year/category/search filters and reversible date order',()=>{
  const recent=ethereumHistoryList(),oldest=ethereumHistoryList({order:'asc'});
  assert.equal(recent.length,ETHEREUM_EVENTS.length);assert.equal(oldest[0].id,'eth-ether-presale-launch');
  assert.ok(recent.every((event,index)=>!index||event.date<=recent[index-1].date));
  assert.deepEqual(oldest,ETHEREUM_EVENTS);
  const filtered=ethereumHistoryList({year:'2021',category:'ecosystem',query:'Uniswap'});
  // Arbitrum's launch evidence also names its Uniswap deployment; search includes source context.
  assert.deepEqual(filtered.map(event=>event.id),['eth-context-arbitrum-one-public','eth-uniswap-v3-mainnet']);
  assert.deepEqual(ethereumHistoryList({year:'2014'}).map(event=>event.id),['eth-ether-presale-launch']);
  for(const year of ['2025-01','2013','2027','202x','',null,2025])assert.throws(()=>ethereumHistoryList({year}),RangeError);
  for(const order of ['newest',null,1])assert.throws(()=>ethereumHistoryList({order}),RangeError);
  recent.pop();assert.equal(ethereumHistoryList().length,ETHEREUM_EVENTS.length);
});

test('every published catalog entry has consistent detail/jump behavior against the actual validated ETH price archive',async()=>{
  const source=parseEthArchive(JSON.parse(await readFile(new URL('../dist/data/eth-ohlc.json',import.meta.url),'utf8')));
  const context={firstDate:source.firstDate.slice(0,10),lastDate:source.lastDate.slice(0,10)};
  let prePrice=0,observed=0;
  for(const value of ETHEREUM_EVENTS){
    const range=ethereumEventRange(value,source),markup=ethereumEventDetailMarkup(value,context);
    const available=value.date>=context.firstDate&&value.date<=context.lastDate;
    if(available){
      observed++;assert.ok(range,value.id);assert.doesNotMatch(jumpTag(markup),/\bdisabled\b/,value.id);
      assert.ok(range.start<=epoch(value.date)&&range.end>=epoch(value.date));
    }else{
      if(value.date<context.firstDate)prePrice++;assert.equal(range,null,value.id);assert.match(jumpTag(markup),/\bdisabled\b/,value.id);
    }
    assert.ok(markup.includes(value.date));assert.doesNotMatch(markup,/<script|href="(?:javascript:|data:)/);
    if(!value.timestampUtc)assert.doesNotMatch(markup,/검증한 시각 ·/,value.id);
  }
  assert.ok(prePrice>0,'pre-price history stays readable without manufactured price coordinates');
  assert.ok(observed>0,'events covered by the archive remain navigable');
});
