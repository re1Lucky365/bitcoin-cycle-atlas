import { CHART_INTERVALS, chartInterval, isIntradayInterval, fetchMarketCandles } from './ohlc-data.js?v=1.15.0-eth.1';
import { parseEthArchive, mergeEthArchive } from './eth-market-data.js?v=1.15.0-eth.1';
import { createMarketDataController, marketStatusText } from './market-data-controller.js?v=1.15.0-eth.1';
import { drawIntradayChart } from './intraday-chart.js?v=1.20.0';
import { bindChartNavigation } from './chart-navigation.js?v=1.19.0';
import { mountChartTouchTracking } from './chart-touch-tracking.js?v=1.14.0-mobile.1';
import { clearChartHover } from './chart-hover.js?v=1.12.1-cursor-hud.1';
import { mountSymbolSelector } from './symbol-selector.js?v=1.18.0';
import { readEthView, ethViewQuery, ethHistoryRange } from './eth-view-state.js?v=1.15.0-eth.1';
import { ETHEREUM_EVENTS, ETHEREUM_EVENT_COLORS, getEthereumEvents } from './ethereum-events.js?v=1.17.0-context.1';
import { mountEthereumHistory, readEthereumEventSettings, ethereumEventQuery, ethereumEventRange } from './ethereum-history.js?v=1.17.0-context.1';

const glyphs = {
  line:'<path d="m3 17 5-7 5 4 8-11"/>',
  candles:'<path d="M7 2v4m0 10v6M17 2v8m0 8v4"/><rect x="4" y="6" width="6" height="10"/><rect x="14" y="10" width="6" height="8"/>',
  crosshair:'<path d="M12 2v5m0 10v5M2 12h5m10 0h5"/><circle cx="12" cy="12" r="4"/>',
  pan:'<path d="M8 12V7a2 2 0 0 1 4 0v5-7a2 2 0 0 1 4 0v7-5a2 2 0 0 1 4 0v8c0 5-3 7-7 7-3 0-5-2-7-5l-3-4a2 2 0 0 1 3-2l2 2"/>',
  refresh:'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 6a8 8 0 0 1 13 2M5 16a8 8 0 0 0 13 2"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  history:'<path d="M3 10a9 9 0 1 1 2 8M3 3v7h7"/><path d="M12 7v5l3 2"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${glyphs[name]}</svg>`;
const nf = new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const number = value => Number.isFinite(value) ? nf.format(value) : '—';
const stamp = value => value ? value.replace('T',' ').slice(0,16) + ' UTC' : '—';
const actionButton = (action,label,glyph) => `<button type="button" class="eth-icon" data-eth-action="${action}" aria-label="${label}" title="${label}">${icon(glyph)}</button>`;

export async function initEthView() {
  // Keep the boot controller and embedded JSON; remove BTC-only controls from
  // the document as well as the accessibility tree before opening this view.
  for (const node of document.querySelectorAll('body > :not(#atlas-boot-shell):not(script)')) node.remove();
  document.body.dataset.market = 'ETHUSD';
  document.title = 'ETHUSD · Ethereum — Bitcoin Cycle Atlas';
  const params = new URLSearchParams(location.search);
  const state = {...readEthView(params),eventSettings:readEthereumEventSettings(params),selectedHistoryEvent:null,tool:'crosshair',range:null,priceDomain:null,controller:null,selectedTime:null,frame:null,loading:false,error:null,refreshError:null};
  let payload = null, daily = null, weekly = null, archiveRequest = null, generation = 0;
  const app = document.createElement('main');
  app.id = 'main';app.className = 'eth-app';app.dataset.bootContent = '';app.inert = true;app.setAttribute('aria-hidden','true');
  app.innerHTML = `
    <nav class="eth-tools" aria-label="차트 조작 도구">
      <span class="eth-brand" title="Ethereum" aria-hidden="true"><svg viewBox="0 0 24 32"><path d="m12 1 11 17-11 6L1 18Z" fill="#bec7f9"/><path d="m12 1 0 23 11-6Z" fill="#7d8abb"/><path d="m1 20 11 11 11-11-11 6Z" fill="#a9b5ed"/></svg></span>
      ${actionButton('crosshair','십자선 · C','crosshair')}${actionButton('pan','차트 이동 · H','pan')}
      <span class="eth-rail-unit">USD</span>
    </nav>
    <header class="eth-topbar" aria-label="차트 상단 도구">
      <button id="eth-symbol" class="workbench-symbol" type="button">ETHUSD</button>
      <div class="eth-interval-buttons" role="group" aria-label="가격 표시 간격">${CHART_INTERVALS.map(item=>`<button type="button" data-eth-interval="${item.id}">${item.label}</button>`).join('')}</div>
      <select id="eth-interval" aria-label="가격 표시 간격">${CHART_INTERVALS.map(item=>`<option value="${item.id}">${item.label}</option>`).join('')}</select>
      <span class="eth-divider" aria-hidden="true"></span>
      <div class="eth-chart-types" role="group" aria-label="차트 유형">${actionButton('line','가격선','line')}${actionButton('candles','캔들','candles')}</div>
      <span class="eth-top-spacer"></span>
      <button id="eth-history-trigger" class="eth-icon" type="button" aria-label="이더리움 역사 사건" title="역사 사건 · 표시 설정과 원문">${icon('history')}</button>
      ${actionButton('refresh','ETH 가격 새로고침','refresh')}${actionButton('info','ETH 데이터 출처와 조회 상태','info')}
    </header>
    <section class="atlas-plot eth-plot" aria-label="이더리움 실제 가격 차트">
      <svg id="eth-chart" role="group" tabindex="0" aria-label="ETH-USD 실제 가격. 드래그로 이동, 휠이나 두 손가락으로 확대·축소하고 방향키로 값을 확인하세요."></svg>
      <div class="eth-readout"><div class="eth-readout-heading"><strong>Ethereum / USD</strong><span id="eth-readout-interval"></span><span class="eth-venue">COINBASE</span></div><div class="eth-readout-value"><strong id="eth-price">—</strong><span id="eth-change"></span><time id="eth-bar-time"></time></div><div id="eth-ohlc" class="eth-ohlc"></div></div>
      <div id="eth-empty" class="eth-empty" role="status"><p id="eth-empty-message">ETH-USD 가격 자료를 불러오고 있습니다.</p><button type="button" data-eth-action="refresh" hidden>다시 조회</button></div>
      <button type="button" id="eth-touch-hint" class="chart-touch-tracking-hint" hidden>값 추적 중 · 탭하여 종료</button>
    </section>
    <footer class="eth-bottom" aria-label="차트 기간과 가격축">
      <div id="eth-periods" class="eth-periods" role="group" aria-label="표시 기간">${[['1m','1개월'],['6m','6개월'],['1y','1년'],['4y','4년'],['all','전체']].map(([id,label])=>`<button type="button" data-eth-span="${id}">${label}</button>`).join('')}</div>
      <select id="eth-period-select" aria-label="표시 기간">${[['1m','1개월'],['6m','6개월'],['1y','1년'],['4y','4년'],['all','전체']].map(([id,label])=>`<option value="${id}">${label}</option>`).join('')}</select>
      <button id="eth-recent" type="button" data-eth-action="reset" hidden>최근 구간</button>
      <span id="eth-status" role="status" aria-live="polite"></span><span class="eth-timezone">UTC</span>
      <button type="button" data-eth-action="scale" title="로그 / 선형 가격축 전환">로그</button><button type="button" data-eth-action="auto" title="가격축 자동 맞춤">Auto</button>
    </footer>
    <span id="eth-announcement" class="lab-visually-hidden" role="status" aria-live="polite"></span>`;
  document.body.append(app);
  const $ = selector => app.querySelector(selector), $$ = selector => [...app.querySelectorAll(selector)];
  const svg = $('#eth-chart'), plot = $('.eth-plot'), readout = $('.eth-readout');
  const info = document.createElement('dialog');info.id='eth-data-dialog';info.className='eth-data-dialog';info.setAttribute('aria-labelledby','eth-data-title');
  info.innerHTML=`<header><h2 id="eth-data-title">ETHUSD 데이터</h2><button type="button" aria-label="데이터 설명 닫기">${icon('close')}</button></header><div id="eth-data-content"></div>`;
  document.body.append(info);
  info.querySelector('button').onclick=()=>info.close();
  info.addEventListener('click',event=>{if(event.target===info){const b=info.getBoundingClientRect();if(event.clientX<b.left||event.clientX>b.right||event.clientY<b.top||event.clientY>b.bottom)info.close();}});
  mountSymbolSelector({button:$('#eth-symbol'),symbol:'ETHUSD'});

  const market = createMarketDataController({product:'ETH-USD',snapshotUrl:'./data/eth-ohlc.json',preferSnapshot:true,readEmbedded:()=>payload?JSON.stringify(payload):null,onChange:(frequency)=>{if(state.frequency===frequency&&isIntradayInterval(frequency))schedule();}});
  const currentSeries = () => isIntradayInterval(state.frequency) ? market.get(state.frequency).series : state.frequency==='weekly'?weekly:daily;
  const announce = text => {$('#eth-announcement').textContent=text;};
  const touch = mountChartTouchTracking({element:plot,getTool:()=>state.tool,canStart:point=>{
    const b=svg.getBoundingClientRect(),v=svg.viewBox.baseVal,x=(point.clientX-b.left)/b.width*v.width,y=(point.clientY-b.top)/b.height*v.height;
    return Boolean(state.controller)&&x>=Number(svg.dataset.plotLeft)&&x<=Number(svg.dataset.plotRight)&&y>=Number(svg.dataset.plotTop)&&y<=Number(svg.dataset.priceBottom);
  },preview:point=>state.controller?.previewPointer?.(point),clear:()=>state.controller?.clearPreview?.(),cancelNavigation:()=>navigation.cancelGesture(),resumeNavigation:points=>navigation.resumeTouchGesture(points),onChange:active=>{$('#eth-touch-hint').hidden=!active;}});
  $('#eth-touch-hint').onclick=()=>touch.cancel();
  const navigation = bindChartNavigation({element:plot,getRange:()=>state.range,getTool:()=>state.tool,getPriceAxis:()=>state.controller?.getPriceScale?.(),getContext:context=>state.controller?.getSelection?.(context),
    onGestureStart:()=>touch.cancelPending(),onMenuOpen:()=>touch.cancel(),onRangeChange:range=>{state.range=range;if(isIntradayInterval(state.frequency))void market.ensureRange(state.frequency,range);schedule();},
    onPriceRangeChange:domain=>{state.priceDomain=domain;schedule();},onPriceReset:()=>{state.priceDomain=null;schedule();},onReset:()=>resetRange(false),onAnnounce:announce});
  document.addEventListener('atlas:modal-open',()=>{touch.cancel();navigation.cancelGesture();});
  const historyWorkbench = mountEthereumHistory({button:$('#eth-history-trigger'),initialSettings:state.eventSettings,
    onSettingsChange:settings=>{cancelInteraction();state.eventSettings=settings;persist();schedule();},onFocusEvent:focusHistoricalEvent});

  function persist(){try{history.replaceState(null,'',`${location.pathname}?${ethereumEventQuery(ethViewQuery(state),state.eventSettings)}`);}catch{}}
  function cancelInteraction(){touch.cancel();navigation.cancelGesture();clearChartHover(svg);state.selectedTime=null;}
  function resetRange(cancel=true){if(cancel)cancelInteraction();state.range=null;state.priceDomain=null;state.span='4y';persist();schedule();}
  async function focusHistoricalEvent(id){
    const event=ETHEREUM_EVENTS.find(item=>item.id===id);if(!event)return false;
    cancelInteraction();
    if(state.frequency!=='daily')await changeInterval('daily');
    else if(!daily)await load();
    const range=ethereumEventRange(event,daily);
    if(!range){announce('이 사건 날짜에는 표시할 일봉 가격 자료가 없습니다.');return false;}
    state.selectedHistoryEvent=id;state.range=range;state.priceDomain=null;state.eventSettings.visible=true;
    if(state.eventSettings.category!=='all'&&state.eventSettings.category!==event.category)state.eventSettings.category='all';
    historyWorkbench.setSettings(state.eventSettings);persist();schedule();announce(`${event.date} ${event.title} 구간을 표시합니다.`);return true;
  }
  function openHistoricalEvent(id){cancelInteraction();state.selectedHistoryEvent=id;historyWorkbench.open(id);schedule();}
  function updateHistoryContext(){historyWorkbench.update({frequency:state.frequency,firstDate:daily?.firstDate?.slice(0,10),lastDate:daily?.lastDate?.slice(0,10),dailySeries:daily,visibleCount:Number(svg.dataset.historyEventCount||0)});}
  function showReadout(row){
    if(row.kind==='unavailable'){$('#eth-price').textContent='—';$('#eth-change').textContent='';$('#eth-bar-time').textContent='';$('#eth-ohlc').textContent='이 구간에 완료된 봉이 없습니다.';return;}
    $('#eth-price').textContent=`$${number(row.close)}`;
    const change=Number.isFinite(row.changePct)?row.changePct:null;
    $('#eth-change').textContent=change===null?'':`${change>=0?'+':'−'}${number(Math.abs(change))}%`;
    $('#eth-change').className=change===null?'':change>=0?'eth-gain':'eth-loss';
    $('#eth-bar-time').textContent=(row.date||'').slice(0,isIntradayInterval(state.frequency)?16:10).replace('T',' ');
    $('#eth-bar-time').dateTime=row.date||'';
    $('#eth-ohlc').innerHTML=[['O',row.open],['H',row.high],['L',row.low],['C',row.close]].map(([label,value])=>`<span><i>${label}</i> ${number(value)}</span>`).join('');
    if(!row.hovered)state.selectedTime=row.time;
  }
  function renderInfo(){
    const series=currentSeries();
    if(!series){info.querySelector('#eth-data-content').innerHTML='<p>표시할 완료 봉이 없습니다. 다시 조회해 주세요.</p>';return;}
    const intraday=isIntradayInterval(state.frequency),entry=intraday?market.get(state.frequency):null;
    info.querySelector('#eth-data-content').innerHTML=`<p class="eth-data-lead">Ethereum / U.S. Dollar <strong>ETH-USD</strong></p><dl><dt>거래소</dt><dd>Coinbase Exchange · USD 현물</dd><dt>표시 간격</dt><dd>${chartInterval(state.frequency).label} · 완료 봉 ${series.candles.length.toLocaleString('en-US')}개</dd><dt>조회된 봉 시작 시각</dt><dd>${stamp(series.firstDate)}<br>— ${stamp(series.lastDate)}</dd><dt>저장 자료 수집</dt><dd>${stamp(series.retrievedAt)}</dd>${series.historyRetrievedAt?`<dt>추가 조회</dt><dd>${stamp(series.historyRetrievedAt)}</dd>`:''}<dt>누락된 간격</dt><dd>${series.gapCount||0}개 · 빈 구간 유지</dd></dl><p>선은 실제 봉의 종가, 캔들은 같은 봉의 시가·고가·저가·종가입니다. 진행 중인 봉은 표시하지 않습니다. 30분·4시간·주봉은 빠짐없이 이어지는 완료 봉만 집계합니다.</p><p>날짜는 UTC의 봉 시작 시각입니다. 거래소·지수에 따라 다른 차트와 가격이 다를 수 있습니다.</p>${entry?.error||state.refreshError?'<p class="eth-data-error">최근 조회에 실패해 마지막 유효 자료를 표시합니다. 원래 수집 시각을 유지합니다.</p>':''}<a href="https://docs.cdp.coinbase.com/api-reference/exchange-api/rest-api/products/get-product-candles" target="_blank" rel="noopener noreferrer">Coinbase OHLC 데이터 안내 ↗</a>`;
  }
  function render(){
    state.frame=null;
    const series=currentSeries(),intraday=isIntradayInterval(state.frequency),entry=intraday?market.get(state.frequency):null;
    $('#eth-interval').value=state.frequency;
    $('#eth-readout-interval').textContent=`· ${chartInterval(state.frequency).label}`;
    for(const button of $$('[data-eth-interval]')){const active=button.dataset.ethInterval===state.frequency;button.setAttribute('aria-pressed',String(active));button.tabIndex=active?0:-1;}
    for(const button of $$('[data-eth-action]')){const action=button.dataset.ethAction;if(['line','candles','crosshair','pan'].includes(action))button.setAttribute('aria-pressed',String(action===state.chartType||action===state.tool));}
    const scale=$('[data-eth-action="scale"]');scale.textContent=state.scale==='log'?'로그':'선형';scale.setAttribute('aria-pressed',String(state.scale==='log'));
    $('[data-eth-action="auto"]').setAttribute('aria-pressed',String(!state.priceDomain));
    for(const button of $$('[data-eth-span]'))button.setAttribute('aria-pressed',String(button.dataset.ethSpan===state.span));
    $('#eth-period-select').value=state.span;
    $('#eth-periods').hidden=intraday;$('#eth-period-select').hidden=intraday;$('#eth-recent').hidden=!intraday;
    const busy=state.loading||entry?.status==='loading';
    $('[data-eth-action="refresh"]').disabled=busy;plot.setAttribute('aria-busy',String(busy));
    $('#eth-empty').hidden=Boolean(series);
    readout.hidden=!series;
    if(!series){
      svg.innerHTML='';state.controller=null;state.range=null;
      svg.dataset.historyEventCount='0';updateHistoryContext();
      const error=state.error||entry?.error;
      $('#eth-empty-message').textContent=error?'ETH-USD 가격 자료를 불러오지 못했습니다. 연결을 확인하고 다시 조회해 주세요.':'ETH-USD 가격 자료를 불러오고 있습니다.';
      $('#eth-empty button').hidden=!error;$('#eth-status').textContent=error?'조회 실패':'불러오는 중';
      navigation.update();return;
    }
    if(!state.range)state.range=intraday?market.range(state.frequency):ethHistoryRange(series,state.span);
    state.controller=drawIntradayChart({svg,series,range:state.range,chartType:state.chartType,scale:state.scale,priceDomain:state.priceDomain,showVolume:false,tool:state.tool,selectedTime:state.selectedTime,headerInset:plot.clientHeight<300?54:76,historyStatus:entry?.historyStatus||'ready',onHover:showReadout,
      historicalEvents:getEthereumEvents({category:state.eventSettings.category}),showHistoricalEvents:state.eventSettings.visible,activeHistoricalEventId:state.selectedHistoryEvent,historicalEventColors:ETHEREUM_EVENT_COLORS,onHistoricalEvent:openHistoricalEvent});
    updateHistoryContext();
    const status=intraday?marketStatusText(entry):`Coinbase ETH-USD · ${busy?'갱신 중':state.refreshError?'연결 실패 · 저장 자료':series.snapshot?'저장 자료':'완료 봉'} · ${stamp(series.lastDate)}${series.gapCount?` · 빈 봉 ${series.gapCount}개`:''}`;
    $('#eth-status').textContent=entry?.historyStatus==='loading'?'과거 봉 조회 중':state.refreshError||entry?.error?'연결 실패 · 저장 자료':`${series.snapshot?'저장 자료':'완료 봉'} · ${series.lastDate.slice(0,10)}`;
    $('#eth-status').title=status;$('#eth-status').setAttribute('aria-label',status);
    plot.dataset.tool=state.tool;navigation.update();if(info.open)renderInfo();
  }
  function schedule(){if(state.frame===null)state.frame=requestAnimationFrame(render);}
  function setPayload(value){const nextDaily=parseEthArchive(value),nextWeekly=parseEthArchive(value,'weekly');payload=value;daily=nextDaily;weekly=nextWeekly;}
  async function getArchive(signal){
    const embedded=document.getElementById('embedded-eth-data')?.textContent;
    if(embedded)return JSON.parse(embedded);
    const response=await fetch('./data/eth-ohlc.json',{credentials:'omit',cache:'no-cache',signal});
    if(!response.ok)throw new Error(`ETH snapshot HTTP ${response.status}`);
    return response.json();
  }
  async function load({force=false}={}){
    const token=++generation;archiveRequest?.abort();market.cancel();
    const request=new AbortController();archiveRequest=request;
    const timer=setTimeout(()=>request.abort(),20000);state.loading=true;state.error=null;state.refreshError=null;schedule();
    try{
      if(!payload){
        try{const saved=await getArchive(request.signal);if(token!==generation)return;setPayload(saved);}
        catch(error){if(token!==generation)return;if(!isIntradayInterval(state.frequency))throw error;}
      }
      if(isIntradayInterval(state.frequency)){
        state.loading=false;await market.load(state.frequency,{force});
        if(token===generation&&force){cancelInteraction();state.range=null;state.priceDomain=null;}
      }else if(force){
        const fresh=await fetchMarketCandles({product:'ETH-USD',interval:'daily',count:300,signal:request.signal});
        if(token!==generation)return;
        setPayload(mergeEthArchive(payload,fresh));state.range=null;
      }
    }catch(error){
      if(token!==generation)return;
      if(currentSeries())state.refreshError=error.message||'조회 실패';
      else state.error=error.message||'조회 실패';
    }finally{clearTimeout(timer);if(token===generation){state.loading=false;archiveRequest=null;schedule();}}
  }
  async function changeInterval(value){
    if(value===state.frequency||!CHART_INTERVALS.some(item=>item.id===value))return;
    cancelInteraction();state.frequency=value;state.range=null;state.priceDomain=null;state.error=null;persist();await load();
  }
  function changeSpan(value){if(!['1m','6m','1y','4y','all'].includes(value))return;cancelInteraction();state.span=value;state.range=null;state.priceDomain=null;persist();schedule();}
  app.addEventListener('click',event=>{
    const interval=event.target.closest('[data-eth-interval]');if(interval){void changeInterval(interval.dataset.ethInterval);return;}
    const span=event.target.closest('[data-eth-span]');if(span){changeSpan(span.dataset.ethSpan);return;}
    const button=event.target.closest('[data-eth-action]');if(!button)return;
    const action=button.dataset.ethAction;
    if(action==='refresh'){void load({force:true});return;}
    if(action==='info'){cancelInteraction();document.dispatchEvent(new CustomEvent('atlas:modal-open',{detail:{id:info.id}}));renderInfo();info.showModal();return;}
    if(action==='reset'){resetRange();return;}
    cancelInteraction();
    if(['line','candles'].includes(action)){state.chartType=action;state.priceDomain=null;}
    if(['crosshair','pan'].includes(action))state.tool=action;
    if(action==='scale'){state.scale=state.scale==='log'?'linear':'log';state.priceDomain=null;}
    if(action==='auto')state.priceDomain=null;
    persist();schedule();
  });
  $('#eth-interval').onchange=event=>void changeInterval(event.target.value);
  $('#eth-period-select').onchange=event=>changeSpan(event.target.value);
  $('.eth-interval-buttons').addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();
    const buttons=$$('[data-eth-interval]'),i=buttons.indexOf(event.target),n=event.key==='Home'?0:event.key==='End'?buttons.length-1:(i+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;
    buttons[n].click();buttons[n].focus();
  });
  document.addEventListener('keydown',event=>{if(event.ctrlKey||event.metaKey||event.altKey||event.isComposing||event.target.closest('input,select,textarea,dialog,[contenteditable="true"]'))return;const action={c:'crosshair',h:'pan'}[event.key.toLowerCase()];if(action){event.preventDefault();$(`[data-eth-action="${action}"]`).click();}});
  const observer=new ResizeObserver(()=>schedule());observer.observe(plot);
  document.fonts?.ready.then(()=>schedule());
  window.addEventListener('pagehide',event=>{
    ++generation;archiveRequest?.abort();market.cancel();state.loading=false;
    if(state.frame!==null){cancelAnimationFrame(state.frame);state.frame=null;}
    cancelInteraction();
    // A Back/Forward cache restoration keeps the same document and listeners.
    // Destroy them only when the browser discards this document entirely.
    if(!event.persisted){touch.destroy();navigation.destroy();observer.disconnect();historyWorkbench.destroy();}
  });
  window.addEventListener('pageshow',event=>{
    if(!event.persisted)return;
    if(!currentSeries())void load();else schedule();
  });
  persist();await load();
  await new Promise(resolve=>requestAnimationFrame(()=>{render();resolve();}));
  document.dispatchEvent(new CustomEvent('atlas:ready'));
}
