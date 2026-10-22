import {BITCOIN_EVENTS,BITCOIN_EVENT_CATEGORIES,BITCOIN_EVENTS_REVIEW_DATE} from './bitcoin-events.js?v=1.7.0';
import {EVENT_COLORS,formatBtcVolume} from './chart-overlays.js?v=1.7.0';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stamp=value=>value?value.slice(0,16).replace('T',' '):'—';
const number=value=>new Intl.NumberFormat('en-US').format(value);
const eventCommand=(id,zoom=true)=>document.dispatchEvent(new CustomEvent('atlas:history-event',{detail:{id,zoom}}));
const glyph=path=>`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;

export function historicalEventDetail(event){
  return {kind:'history',date:event.date,label:event.title,fields:[
    {label:'사건 날짜',value:event.date},
    {label:'분류',value:BITCOIN_EVENT_CATEGORIES[event.category]},
    {label:'원문·교차 확인',value:`${event.sources.length}개 출처`},
    {label:'날짜 해석',value:event.dateBasis},
  ],note:[event.description,...(event.limitations||[]),'사건점은 해당 날짜의 Coin Metrics 일말 가격 위치를 참조합니다. 주봉의 종가로 날짜를 옮기지 않습니다. 이는 가격 맥락이며 사건이 가격 변동을 일으켰다는 인과 추정이 아닙니다.'].join(' '),sources:event.sources.map(source=>({url:source.url,title:`${source.publisher} · ${source.title}${source.publishedAt?' · '+source.publishedAt:''}`}))};
}

export function mountResearchWorkbench({stage,controlStore,liveControls,openReader,closeReader,isReaderOpen}){
  const layers=liveControls.get('layers');
  for(const [id,text] of [['atlas-volume','거래량 · 거래소 BTC 현물'],['atlas-history-events','비트코인 주요 사건']]){
    const row=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.id=id;input.checked=true;row.append(input,document.createTextNode(text));layers.prepend(row);
  }
  const events=document.createElement('section');events.className='research-panel events-panel';
  events.innerHTML=`<p class="research-intro">원문을 확인한 ${BITCOIN_EVENTS.length}개 사건. 날짜를 누르면 차트에서 해당 구간을 확대하고 출처를 엽니다.</p><label class="research-search">사건 검색<input id="history-event-search" type="search" placeholder="ETF, 반감기, FTX…" autocomplete="off"></label><label class="research-filter">분류<select id="history-event-category"><option value="all">모든 분류</option>${Object.entries(BITCOIN_EVENT_CATEGORIES).map(([id,label])=>`<option value="${id}">${label}</option>`).join('')}</select></label><p id="history-event-count" role="status"></p><div id="history-event-list" class="history-event-list"></div><p class="research-footnote">${BITCOIN_EVENTS_REVIEW_DATE} 검토 · 표시 우선순위는 편집 기준이며 관심도 순위가 아닙니다. 가격 자료 시작 전 사건은 목록에서만 확인할 수 있습니다.</p>`;
  const list=events.querySelector('#history-event-list'),search=events.querySelector('input'),category=events.querySelector('select');
  let latestAsOf='9999-12-31',lastState=null;
  function filtered(){const query=search.value.trim().toLocaleLowerCase('ko-KR');return BITCOIN_EVENTS.filter(event=>event.date<=latestAsOf&&(category.value==='all'||event.category===category.value)&&(!query||`${event.label} ${event.title} ${event.description} ${event.date}`.toLocaleLowerCase('ko-KR').includes(query)));}
  function paintEvents(){
    const shown=filtered();events.querySelector('#history-event-count').textContent=`${shown.length} / ${BITCOIN_EVENTS.filter(event=>event.date<=latestAsOf).length}개 사건`;
    list.innerHTML=shown.length?shown.map(event=>`<button type="button" class="history-event-card" data-history-jump="${event.id}" style="--event-color:${EVENT_COLORS[event.category]}"><time>${event.date}</time><strong>${esc(event.title)}</strong><span>${esc(BITCOIN_EVENT_CATEGORIES[event.category])} · 출처 ${event.sources.length}개</span></button>`).join(''):'<p>검색 조건에 맞는 사건이 없습니다.</p>';
  }
  search.addEventListener('input',paintEvents);category.addEventListener('change',()=>{paintEvents();document.dispatchEvent(new CustomEvent('atlas:history-filter',{detail:{category:category.value}}));});
  list.addEventListener('click',event=>{const button=event.target.closest('[data-history-jump]');if(button)eventCommand(button.dataset.historyJump);});
  liveControls.set('events',events);controlStore.append(events);paintEvents();

  const volume=document.createElement('section');volume.className='research-panel volume-panel';
  volume.innerHTML='<div id="volume-source-status" role="status">검증된 거래량 자료를 불러오는 중입니다.</div><p class="research-footnote">거래량은 BTC 수량이며 USD 거래대금과 다릅니다. 가격 기준이 다른 선과 비교할 때는 출처를 함께 확인하세요. 미래 구간과 누락 구간은 채우지 않습니다.</p><p><a href="https://github.com/twoimo/bitcoin-cycle-atlas/blob/main/docs/VOLUME_METHOD.md" target="_blank" rel="noopener noreferrer">교차 검증 방법과 결과 ↗</a></p>';
  liveControls.set('volume',volume);controlStore.append(volume);

  const rail=document.querySelector('.workbench-detail-tools');
  function panelButton(kind,label,path){
    const button=document.createElement('button');button.type='button';button.className='workbench-icon';button.dataset.reader=kind;button.title=label;button.setAttribute('aria-label',label);button.setAttribute('aria-controls','chart-reader');button.setAttribute('aria-expanded','false');button.innerHTML=glyph(path);
    button.onclick=()=>isReaderOpen(kind)?closeReader():openReader(kind,{focus:true,opener:button});rail.append(button);return button;
  }
  panelButton('events','비트코인 주요 사건 · 검색과 원문','<path d="M5 4h14v17H5zM8 1v6m8-6v6M5 9h14M8 13h2m4 0h2m-8 4h2m4 0h2"/>');
  panelButton('volume','거래량 출처와 검증','<path d="M4 21V11h4v10m2 0V4h4v17m2 0V8h4v13M2 21h20"/>');

  const journal=document.createElement('section');journal.className='history-journal';journal.setAttribute('aria-label','비트코인 주요 사건 타임라인');
  journal.innerHTML=`<div class="journal-heading"><button id="history-journal-toggle" type="button" aria-expanded="false" aria-controls="history-journal-items"><span class="journal-chevron">⌃</span> 주요 사건 <span class="journal-count">${BITCOIN_EVENTS.length}</span></button><span id="journal-context">과거 사건 · 원문 기반</span><button id="history-journal-all" type="button">검색·전체 목록</button><button id="history-volume-source" type="button">거래량 출처</button></div><div id="history-journal-items" class="journal-items" hidden></div>`;
  stage.querySelector('.workbench-bottom').before(journal);
  const journalItems=journal.querySelector('.journal-items'),toggle=journal.querySelector('#history-journal-toggle');
  toggle.onclick=()=>{const open=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(open));journalItems.hidden=!open;journal.dataset.open=String(open);if(open)paintJournal(lastState);};
  journal.querySelector('#history-journal-all').onclick=event=>openReader('events',{focus:true,opener:event.currentTarget});
  journal.querySelector('#history-volume-source').onclick=event=>openReader('volume',{focus:true,opener:event.currentTarget});
  journalItems.addEventListener('click',event=>{const button=event.target.closest('[data-history-jump]');if(button)eventCommand(button.dataset.historyJump);});
  function paintJournal(state){
    const range=state&&!state.intraday&&typeof state.start==='string'?{start:state.start,end:state.end}:null;
    const all=BITCOIN_EVENTS.filter(event=>event.date<=latestAsOf),visible=range?all.filter(event=>event.date>=range.start&&event.date<=range.end):all;
    journal.querySelector('#journal-context').textContent=state?.intraday?'사건은 하루 단위 · 일봉에서 탐색':`${visible.length}개 사건이 표시 기간에 포함`;
    journalItems.innerHTML=visible.length?visible.map(event=>`<button type="button" class="journal-event" data-history-jump="${event.id}" style="--event-color:${EVENT_COLORS[event.category]}"><time>${event.date}</time><strong>${esc(event.label)}</strong><span>${esc(BITCOIN_EVENT_CATEGORIES[event.category])}</span></button>`).join(''):'<p>이 기간에는 기록된 사건이 없습니다. 검색·전체 목록에서 다른 날짜를 선택하세요.</p>';
  }
  function paintVolume(state){
    const target=volume.querySelector('#volume-source-status'),meta=state?.volumeMeta;
    if(state?.intraday&&state.marketSeries){
      const series=state.marketSeries,bar=series.candles.at(-1);
      target.innerHTML=`<span class="source-badge">실제 완료 봉 · BTC</span><h3>${esc(series.source)} · ${esc(series.product)}</h3><dl class="source-stats"><dt>범위</dt><dd>${stamp(series.firstDate)} — ${stamp(series.lastDate)} UTC</dd><dt>표시 간격</dt><dd>${esc(state.intervalLabel)}</dd><dt>수집 시각</dt><dd>${stamp(series.retrievedAt)} UTC${series.snapshot?' · 저장 자료':''}</dd><dt>완료 봉</dt><dd>${series.candles.length}개 · 빈 봉 ${series.gapCount||0}개</dd><dt>최근 봉 거래량</dt><dd>${formatBtcVolume(bar.volume)} BTC</dd></dl><p>이 거래소 BTC/USD 현물의 물량입니다. 전 세계 거래소 합계가 아닙니다.</p><p>기존 Coinbase 저장본에는 일봉·시간봉 합계의 작은 차이가 확인되어, Bitstamp 일봉 검증과 구분합니다. 차이는 원문 그대로 보존합니다.</p><p><a href="${esc(series.documentationUrl)}" target="_blank" rel="noopener noreferrer">거래소 공식 데이터 정의 ↗</a></p>`;
    }else if(state?.intraday){
      target.textContent=state.marketLoading?'Coinbase BTC/USD의 완료 봉을 불러오는 중입니다. 거래량도 같은 봉의 원문을 사용합니다.':'현재 분·시간봉의 거래량 자료가 없습니다. 저장 자료 또는 새 조회가 준비되면 출처를 표시합니다.';
    }else if(meta){
      target.innerHTML=`<span class="source-badge">동일 거래소 교차 검증 · BTC</span><h3>${esc(meta.source)} · BTC/USD 현물</h3><dl class="source-stats"><dt>자료 범위</dt><dd>${meta.firstDate} — ${meta.lastDate} UTC</dd><dt>수집 시각</dt><dd>${stamp(meta.retrievedAt)} UTC</dd><dt>완료 일봉</dt><dd>${number(meta.count)}개</dd><dt>날짜 누락</dt><dd>${number(meta.gapCount)}일</dd><dt>실제 0 거래량</dt><dd>${number(meta.zeroCount)}일</dd></dl><p>${meta.validation?.firstDate||'—'}–${meta.validation?.lastDate||'—'} 표본의 ${meta.validation?.hourlyDays||0}개 일봉을 1시간·15분 봉 합계와 대조했고, ${meta.validation?.tradeMinutes||0}개 완료 1분 봉은 공개 체결 수량의 합계와 비교했습니다. 이 표본의 검증 결과는 ${meta.validation?.status==='PASS'?'모두 일치':'출처 보고서에서 확인'}입니다. 전체 역사 구간의 모든 체결을 감사한 것은 아닙니다.</p><p>주봉은 월요일–일요일 UTC의 완료 일봉 7개를 더합니다. 불완전한 주와 미래는 표시하지 않습니다.</p><p>다른 거래소 Coinbase와 겹치는 ${meta.validation?.overlapDays||0}일의 거래량도 비교했습니다. 거래소별 물량이 다르므로 두 수치를 합치거나 서로 대체하지 않습니다.</p><p><a href="https://www.bitstamp.net/api/" target="_blank" rel="noopener noreferrer">Bitstamp 공식 API 정의 ↗</a></p>`;
    }else target.textContent=state?.volumeError?'거래량 자료를 불러오지 못했습니다. 가격 차트는 이용할 수 있습니다.':'검증된 거래량 자료를 불러오는 중입니다.';
  }
  document.addEventListener('atlas:workbench-state',event=>{
    lastState=event.detail;journal.hidden=lastState.mode!=='price';
    if(lastState.asOf&&latestAsOf!==lastState.asOf){latestAsOf=lastState.asOf;paintEvents();}
    paintJournal(lastState);paintVolume(lastState);
  });
  return {events,volume,journal};
}
