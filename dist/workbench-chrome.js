import { CHART_INTERVALS,isIntradayInterval } from './ohlc-data.js?v=1.11.0';
import { MAGNET_MODES, MAGNET_LABELS, normalizeMagnetMode } from './chart-magnet.js?v=1.11.0';
import { mountChartGoTo } from './chart-go-to.js?v=1.14.0-mobile.1';
import { isStartPriceUnit } from './price-display.js?v=1.13.0-research.1';
import { mountWorkspaceTools } from './workspace-tools.js?v=1.14.0-mobile.1';
import { mountChartBottomBar } from './chart-bottom-bar.js?v=1.14.0-mobile.1';
import { mountSymbolSelector } from './symbol-selector.js?v=1.15.0-eth.1';
const $ = selector => document.querySelector(selector);

const paths = {
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  candles:'<path d="M7 2v4m0 10v6M17 2v8m0 8v4"/><rect x="4" y="6" width="6" height="10"/><rect x="14" y="10" width="6" height="8"/>',
  line:'<path d="m3 17 5-7 5 4 8-11"/>',
  refresh:'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 6a8 8 0 0 1 13 2M5 16a8 8 0 0 0 13 2"/>',
  crosshair:'<path d="M12 2v5m0 10v5M2 12h5m10 0h5"/><circle cx="12" cy="12" r="4"/>',
  pan:'<path d="M8 12V7a2 2 0 0 1 4 0v5-7a2 2 0 0 1 4 0v7-5a2 2 0 0 1 4 0v8c0 5-3 7-7 7-3 0-5-2-7-5l-3-4a2 2 0 0 1 3-2l2 2"/>',
  magnet:'<path d="M4 3h5v9a3 3 0 0 0 6 0V3h5v9a8 8 0 0 1-16 0V3Z"/><path d="M4 7h5m6 0h5"/>',
  magnetStrong:'<path d="M4 3h5v9a3 3 0 0 0 6 0V3h5v9a8 8 0 0 1-16 0V3Z"/><path d="M4 7h5m6 0h5M12 2v6m-2-2 2 2 2-2"/>',
  ruler:'<path d="m3 16 13-13 5 5L8 21 3 16Zm8-8 2 2m2-6 2 2M7 12l2 2m-6 2 2 2"/>',
  clear:'<path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6m4-6v6"/>',
  settings:'<path d="M5 3v18M12 3v18M19 3v18M2 8h6m1 8h6m1-10h6"/>',
  scenario:'<path d="M3 18h4l4-7 4 3 6-10M11 11l4-6 6 2"/><path d="m11 11 4 9 6-4" stroke-dasharray="2 3"/>',
  data:'<path d="M4 5h16M4 12h16M4 19h16M8 3v18"/>',
  math:'<path d="M18 4H8l6 8-6 8h10M4 4v16"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18m-13 4h2m4 0h2m-8 3h2"/>',
  fit:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M8 12h8m-4-4v8"/>',
  target:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3"/>'
};

export function mountWorkbenchChrome({icon,stage,workspace,plot,tools,controlStore,liveControls,openReader,closeReader,isReaderOpen}) {
  const glyph=name=>paths[name]?`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</svg>`:icon(name);
  const command=(action,value)=>document.dispatchEvent(new CustomEvent('atlas:chart-command',{detail:{action,value}}));
  const button=(name,label,attributes={})=>{
    const node=document.createElement('button');node.type='button';node.className='workbench-icon';
    node.innerHTML=glyph(name);node.title=label;node.setAttribute('aria-label',label);
    for(const [key,value] of Object.entries(attributes))node.setAttribute(key,value);
    return node;
  };
  function panelButton(node,kind){
    node.dataset.reader=kind;
    node.onclick=()=>isReaderOpen(kind)?closeReader():openReader(kind,{focus:true,opener:node});
    return node;
  }
  const settings=$('#atlas-display-options'),settingsBody=$('.atlas-settings-body');
  const unitSelect=$('#lab-unit');
  for(const [value,label] of [['percent','표시 시작 대비 %'],['indexed-start','표시 시작 = 100']]){if(![...unitSelect.options].some(option=>option.value===value)){const option=document.createElement('option');option.value=value;option.textContent=label;unitSelect.append(option);}}
  const priceOptions=document.createElement('fieldset');priceOptions.className='price-axis-options';
  const priceOptionsTitle=document.createElement('legend');priceOptionsTitle.textContent='가격축';priceOptions.append(priceOptionsTitle);
  const priceChecks=new Map();
  for(const [action,label,title] of [['invert-scale','가격축 뒤집기','큰 가격을 아래쪽으로 표시합니다. 원본 가격은 바뀌지 않습니다.'],['price-only-auto','가격 자료만 자동 맞춤','가격선·캔들의 범위에 자동 맞춥니다. 가정 범위와 기준점은 축 범위를 늘리지 않습니다.']]){const row=document.createElement('label'),input=document.createElement('input'),text=document.createElement('span');input.type='checkbox';input.dataset.priceAxisOption=action;input.onchange=()=>command(action,input.checked);text.textContent=label;row.title=title;row.append(input,text);priceOptions.append(row);priceChecks.set(action,input);}
  const displayBasis=document.createElement('p');displayBasis.className='price-axis-basis';priceOptions.append(displayBasis);settingsBody.append(priceOptions);
  const goTo=mountChartGoTo({document,onSubmit:result=>command('go-to',result)});
  const modeTabs=$('.atlas-mode-tabs'),controlSets=[...document.querySelectorAll('.atlas-controls>.atlas-control-set')];
  settingsBody.prepend(...controlSets);settingsBody.append($('#atlas-reset'));
  const frequency=$('[data-lab-frequency]').closest('fieldset');frequency.id='workbench-frequency';
  frequency.setAttribute('aria-label','가격 표시 간격');
  const intervalButtons=frequency.querySelector('.lab-segmented');intervalButtons.replaceChildren();
  for(const interval of CHART_INTERVALS){
    const node=document.createElement('button');node.type='button';node.dataset.labFrequency=interval.id;node.textContent=interval.label;
    node.id=`workbench-interval-${interval.id}`;node.tabIndex=interval.id==='daily'?0:-1;
    node.title=`${interval.label} · ${interval.seconds<86400?'실제 거래소 완료 봉':'일·주별 가격'}`;node.setAttribute('aria-label',node.title);node.setAttribute('aria-pressed',String(interval.id==='daily'));
    node.onclick=()=>command('frequency',interval.id);intervalButtons.append(node);
  }
  const intervalSelect=document.createElement('select');intervalSelect.id='workbench-interval-select';intervalSelect.setAttribute('aria-label','가격 표시 간격');
  for(const interval of CHART_INTERVALS){const option=document.createElement('option');option.value=interval.id;option.textContent=interval.label;intervalSelect.append(option);}intervalSelect.value='daily';intervalSelect.onchange=()=>command('frequency',intervalSelect.value);frequency.append(intervalSelect);
  const layers=document.createElement('div');layers.className='atlas-settings-body workbench-layers';
  const layerNames={'lab-band':'경제 가정 범위','lab-turns':'고점·저점','atlas-drawdown':'전고점 대비 낙폭','atlas-states':'상승·횡보·하락','lab-fib':'피보나치 되돌림'};
  for(const [id,label] of Object.entries(layerNames)){
    const input=$(`#${id}`),row=input.closest('label');
    row.replaceChildren(input,document.createTextNode(label));layers.append(row);
  }
  const layerEmpty=document.createElement('p');layerEmpty.id='workbench-layer-empty';layerEmpty.textContent='이 그래프에는 추가 레이어가 없습니다.';layerEmpty.hidden=true;layers.append(layerEmpty);
  const downloads=document.createElement('div');downloads.className='atlas-setting-downloads';downloads.append($('#lab-json'));layers.append(downloads);
  const scenarios=document.createElement('div');scenarios.className='workbench-scenarios';
  const scenarioSelect=$('#lab-scenario'),scenarioLabel=scenarioSelect.closest('label');scenarioLabel.hidden=true;scenarios.append(scenarioLabel);
  const scenarioNames={base:['통화·금 기준','기준 수요 가정'],accelerated:['채택 확대','높은 채택 시나리오'],wait:['완만한 채택','낮음과 기준 사이'],late:['낮은 채택','낮은 수요 시나리오'],stress:['수요 훼손','채택 실패 스트레스']};
  for(const [key,[name,description]] of Object.entries(scenarioNames)){
    const node=document.createElement('button');node.type='button';node.dataset.workbenchScenario=key;node.setAttribute('aria-pressed','false');
    const strong=document.createElement('strong'),small=document.createElement('span');strong.textContent=name;small.textContent=description;node.append(strong,small);
    node.onclick=()=>{scenarioSelect.value=key;scenarioSelect.dispatchEvent(new Event('change',{bubbles:true}));};scenarios.append(node);
  }
  const scenarioModel=button('math','입력·가정·과거 검증 보기');scenarioModel.classList.add('workbench-scenario-model');scenarioModel.append(document.createTextNode('모델과 검증'));panelButton(scenarioModel,'math');scenarios.append(scenarioModel);
  liveControls.set('settings',settingsBody);liveControls.set('layers',layers);liveControls.set('scenarios',scenarios);
  controlStore.append(settingsBody,modeTabs,layers,scenarios);
  const heading=document.createElement('header');heading.className='atlas-canvas-heading';heading.setAttribute('aria-label','차트 상단 도구');
  const symbol=document.createElement('button');symbol.className='workbench-symbol';
  const symbolSelector=mountSymbolSelector({button:symbol,symbol:'BTCUSD'});
  const menu=button('chart','인디케이터 추가·삭제',{'aria-controls':'indicator-library','aria-haspopup':'dialog','aria-expanded':'false'});menu.id='atlas-mode-menu';
  menu.onclick=()=>document.dispatchEvent(new CustomEvent('atlas:indicator-library',{detail:{opener:menu}}));
  const modeName=document.createElement('span');modeName.id='atlas-mode-name';modeName.textContent='인디케이터';menu.append(modeName);menu.classList.add('workbench-mode');
  const scenario=panelButton(button('scenario','미래 가정 선택'),'scenarios');scenario.id='workbench-scenario';
  const scenarioName=document.createElement('span');scenarioName.id='workbench-scenario-name';scenarioName.textContent='기본 가정';scenario.append(scenarioName);
  const settingButton=panelButton(button('settings','차트 설정'),'settings');settingButton.id='atlas-display-options';settings.remove();
  const save=$('#lab-svg');save.className='workbench-icon';save.innerHTML=icon('download');save.title='주 가격 차트 저장 · PNG';save.setAttribute('aria-label',save.title);
  const spacer=document.createElement('span');spacer.className='workbench-spacer';
  const chartType=button('candles','가격 표시 · 캔들로 변경',{'id':'workbench-chart-type','aria-pressed':'false'});chartType.onclick=()=>command('chart-type',chartType.getAttribute('aria-pressed')==='true'?'line':'candles');
  const chartMenu=button('more','차트 빠른 조작 · 우클릭 / Shift+F10',{'id':'workbench-chart-menu','aria-haspopup':'menu','aria-controls':'atlas-chart-context-menu'});chartMenu.onclick=()=>command('context-menu');
  const workspaceButton=button('search','작업 화면·명령 검색 · Ctrl/⌘ K',{'id':'workbench-workspace'});
  heading.append(symbol,frequency,chartType,menu,scenario,$('#atlas-cycle-panel'),spacer,workspaceButton,chartMenu,save,settingButton);stage.prepend(heading);
  const workspaceTools=mountWorkspaceTools({trigger:workspaceButton,plot,openReader,closeReader});
  const marketInfo=document.createElement('div');marketInfo.className='workbench-market-info';marketInfo.hidden=true;
  const marketStatus=document.createElement('span');marketStatus.id='workbench-market-status';marketStatus.setAttribute('role','status');marketStatus.setAttribute('aria-live','polite');
  const marketRefresh=button('refresh','거래소 캔들 새로 조회',{'id':'workbench-market-refresh'});marketRefresh.onclick=()=>command('refresh-market');marketInfo.append(marketStatus,marketRefresh);plot.append(marketInfo);

  const left=document.createElement('nav');left.className='workbench-tools';left.setAttribute('aria-label','차트 조작 도구');
  for(const [name,glyphName,label] of [['crosshair','crosshair','십자선 · C · 클릭 고정 / 드래그 이동'],['pan','pan','차트 이동 · H · 좌클릭 드래그'],['measure','ruler','두 지점 측정 · M']]){
    const node=button(glyphName,label,{'data-chart-tool':name,'aria-pressed':String(name==='crosshair')});node.setAttribute('aria-keyshortcuts',{crosshair:'C',pan:'H',measure:'M'}[name]);node.onclick=()=>command('tool',name);left.append(node);
  }
  let magnetMode='off';
  const magnet=button('magnet','자석 · 끄기 · 설정',{'id':'workbench-magnet','aria-pressed':'false','aria-expanded':'false','aria-haspopup':'menu','aria-controls':'workbench-magnet-menu','aria-keyshortcuts':'Alt+M'});
  const magnetBadge=document.createElement('span');magnetBadge.className='workbench-magnet-badge';magnetBadge.setAttribute('aria-hidden','true');magnetBadge.textContent='OFF';magnet.append(magnetBadge);left.append(magnet);
  const magnetMenu=document.createElement('div');magnetMenu.id='workbench-magnet-menu';magnetMenu.className='workbench-magnet-menu';magnetMenu.hidden=true;magnetMenu.setAttribute('role','menu');magnetMenu.setAttribute('aria-label','자석 모드');
  const magnetDescriptions={off:'포인터 가격에 자유롭게 놓기',weak:'가까운 시가·고가·저가·종가에 붙이기',strong:'거리와 무관하게 가장 가까운 OHLC에 붙이기'};
  for(const value of MAGNET_MODES){
    const option=document.createElement('button');option.type='button';option.dataset.magnetMode=value;option.setAttribute('role','menuitemradio');option.setAttribute('aria-checked',String(value==='off'));option.tabIndex=value==='off'?0:-1;
    const label=document.createElement('strong'),description=document.createElement('small');label.textContent=MAGNET_LABELS[value];description.textContent=magnetDescriptions[value];option.append(label,description);option.onclick=()=>{command('magnet',value);closeMagnet(true);};magnetMenu.append(option);
  }
  const magnetHint=document.createElement('p');magnetHint.textContent='두 지점 측정에 적용 · Ctrl/⌘로 일시 전환';magnetMenu.append(magnetHint);document.body.append(magnetMenu);
  function closeMagnet(focus=false){if(magnetMenu.hidden)return;magnetMenu.hidden=true;magnet.setAttribute('aria-expanded','false');if(focus)magnet.focus({preventScroll:true});}
  function openMagnet(){
    if(!magnetMenu.hidden){closeMagnet(true);return;}
    magnetMenu.hidden=false;magnet.setAttribute('aria-expanded','true');
    const bounds=magnet.getBoundingClientRect(),width=Math.max(120,Math.min(284,window.innerWidth-16));magnetMenu.style.width=`${width}px`;
    magnetMenu.style.left=`${Math.max(8,Math.min(window.innerWidth-width-8,bounds.right+7))}px`;
    magnetMenu.style.top=`${Math.max(8,Math.min(window.innerHeight-magnetMenu.offsetHeight-8,bounds.top))}px`;
    for(const option of magnetMenu.querySelectorAll('[data-magnet-mode]'))option.tabIndex=option.dataset.magnetMode===magnetMode?0:-1;
    magnetMenu.querySelector(`[data-magnet-mode="${magnetMode}"]`)?.focus({preventScroll:true});
  }
  magnet.onclick=openMagnet;
  magnetMenu.addEventListener('keydown',event=>{
    event.stopPropagation();const items=[...magnetMenu.querySelectorAll('button')],index=items.indexOf(event.target);
    if(event.key==='Escape'){event.preventDefault();closeMagnet(true);}
    else if(event.key==='Tab'){event.preventDefault();closeMagnet(true);}
    else if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;items.forEach((item,i)=>item.tabIndex=i===next?0:-1);items[next].focus();}
  });
  const dismissMagnet=event=>{if(!magnetMenu.hidden&&!magnetMenu.contains(event.target)&&!magnet.contains(event.target))closeMagnet();};
  const resizeMagnet=()=>closeMagnet(),scrollMagnet=event=>{if(!magnetMenu.contains(event.target))closeMagnet();},visibilityMagnet=()=>{if(document.hidden)closeMagnet();};
  document.addEventListener('pointerdown',dismissMagnet,true);document.addEventListener('focusin',dismissMagnet);document.addEventListener('scroll',scrollMagnet,true);document.addEventListener('visibilitychange',visibilityMagnet);window.addEventListener('resize',resizeMagnet);window.addEventListener('blur',resizeMagnet);
  const clear=button('clear','측정 지우기',{'id':'workbench-clear'});clear.disabled=true;clear.onclick=()=>command('clear-measurement');left.append(clear);
  const navigation=document.createElement('div');navigation.id='workbench-navigation';left.append(navigation);
  $('.atlas-brand').after(left);
  const right=document.createElement('aside');right.className='workbench-rail';right.setAttribute('aria-label','차트 정보와 자료');
  const detailTools=document.createElement('nav');detailTools.className='workbench-detail-tools';detailTools.setAttribute('aria-label','차트 상세');
  const selection=tools.querySelector('[data-reader=selection]');selection.className='workbench-icon';selection.innerHTML=glyph('data');selection.title='선택 데이터';selection.setAttribute('aria-label','선택 데이터');panelButton(selection,'selection');
  const layerButton=panelButton(button('layers','차트 레이어'),'layers');
  const math=tools.querySelector('[data-reader=math]');math.className='workbench-icon';math.innerHTML=glyph('math');math.title='모델과 검증';math.setAttribute('aria-label',math.title);panelButton(math,'math');
  const next=button('target','다음 방향 후보로 이동',{'id':'workbench-next-turn'});next.onclick=()=>command('next-turn');
  detailTools.append(selection,layerButton,math,next);right.append(detailTools,$('.atlas-nav'));
  const help=tools.querySelector('[data-reader=guide]');help.className='workbench-icon workbench-help';help.innerHTML=icon('info');help.title='차트 사용법';help.setAttribute('aria-label',help.title);panelButton(help,'guide');right.append(help);workspace.append(right);
  const ranges=document.createElement('div');ranges.className='workbench-ranges';ranges.setAttribute('role','group');ranges.setAttribute('aria-label','차트 표시 기간');
  for(const [value,label,title] of [['focus','4년','최근 2년 + 앞으로 2년 · 기본 보기'],['near','6개월','가까운 6개월 · 최근 45일 포함'],['all','장기 전망','검증한 자료의 마지막 목표 연도까지'],['history','전체','2010년부터 장기 전망까지']]){
    const node=document.createElement('button');node.type='button';node.textContent=label;node.title=title;node.setAttribute('aria-label',title);node.dataset.chartSpan=value;node.setAttribute('aria-pressed','false');node.onclick=()=>command('span',value);ranges.append(node);
  }
  const goDate=button('calendar','UTC 날짜·시간 또는 기간으로 이동 · Alt+G',{'aria-haspopup':'dialog','aria-controls':'chart-go-to-dialog'});goDate.id='workbench-go-date';
  goDate.onclick=()=>goTo.open(goDate);ranges.append(goDate);
  const rangeLabel=document.createElement('span');rangeLabel.id='workbench-range-label';
  const axis=document.createElement('div');axis.className='workbench-axis';
  const scale=document.createElement('button');scale.type='button';scale.id='workbench-scale';scale.textContent='로그';scale.title='가격 눈금 · 로그 / 선형';scale.setAttribute('aria-label','로그 가격 눈금 · 선형으로 변경');scale.setAttribute('aria-pressed','true');scale.onclick=()=>command('scale');
  const auto=document.createElement('button');auto.type='button';auto.id='workbench-auto-scale';auto.className='workbench-auto';auto.textContent='자동';auto.setAttribute('aria-pressed','true');auto.onclick=()=>command('auto-scale');
  const fit=button('fit','기본 범위로 · 0 / Alt+R / 차트 더블클릭',{'id':'workbench-fit','aria-keyshortcuts':'0 Alt+R'});fit.onclick=()=>command('fit');axis.append(scale,auto,fit);
  const update=$('#atlas-update-status');update.className='workbench-update';panelButton(update,'update');
  const zone=document.createElement('span');zone.className='workbench-zone';zone.textContent='UTC';zone.title='차트 날짜와 봉 시각의 기준 시간대';
  const status=document.createElement('div');status.className='workbench-status';status.append(zone,update);
  const bottomBar=mountChartBottomBar({stage,ranges,dateButton:goDate,rangeLabel,axis,status,fitButton:fit,updateButton:update,onCommand:command,onUpdate:opener=>openReader('update',{focus:true,opener})});
  $('#chart-detail-actions').append($('#atlas-date-label'),$('#atlas-inspect-prev'),$('#atlas-inspect-next'),$('#atlas-latest'));
  $('#atlas-latest').innerHTML=icon('clock');$('#atlas-latest').title='최근 관측으로';$('#atlas-latest').setAttribute('aria-label','최근 관측으로');
  $('.atlas-controls').remove();tools.remove();
  const live=document.createElement('span');live.id='workbench-announcement';live.className='lab-visually-hidden';live.setAttribute('role','status');live.setAttribute('aria-live','polite');stage.append(live);
  $('#lab-metrics').removeAttribute('aria-live');
  const handleState=event=>{
    const s=event.detail,price=s.mode==='price',intraday=price&&isIntradayInterval(s.frequency),candles=s.chartType==='candles';plot.dataset.tool=s.tool;plot.dataset.intraday=String(intraday);workspace.dataset.chartMode=s.mode;
    workspace.dataset.analysisMode=s.analysisMode||'';goTo.update(s);
    left.hidden=!price;left.querySelector('[data-chart-tool=measure]').hidden=false;clear.hidden=false;chartMenu.hidden=!price;chartMenu.disabled=s.navigationAvailable===false;scenario.hidden=!price||intraday;layerButton.hidden=!price;ranges.hidden=!price;axis.hidden=!price;next.hidden=!price||intraday;goDate.hidden=!price;chartType.hidden=!price;
    intervalSelect.value=s.frequency||'daily';
    for(const node of intervalButtons.querySelectorAll('button')){const selected=node.dataset.labFrequency===s.frequency;node.setAttribute('aria-pressed',String(selected));node.tabIndex=selected?0:-1;}
    chartType.setAttribute('aria-pressed',String(candles));chartType.innerHTML=glyph(candles?'candles':'line');chartType.title=`${candles?'캔들':'선'} 표시 · ${candles?'선':'캔들'}으로 변경`;chartType.setAttribute('aria-label',chartType.title);
    marketInfo.hidden=!price;const marketText=typeof s.marketStatus==='string'?s.marketStatus:s.marketStatus?.text||'거래소 완료 봉 · 조회 대기';marketStatus.textContent=marketText;marketStatus.title=marketText;marketRefresh.disabled=Boolean(s.marketLoading);marketInfo.setAttribute('aria-busy',String(Boolean(s.marketLoading)));
    symbol.title=intraday?'비트코인 / 미국 달러 · Coinbase Exchange 실제 완료 봉':candles?'비트코인 / 미국 달러 · Bitstamp 실제 완료 봉과 장기 가정':'비트코인 / 미국 달러 · Coin Metrics 일말 가격과 장기 가정';
    layerEmpty.hidden=price;scenarioName.textContent=`${scenarioNames[s.scenario]?.[0]||'기본'} 가정`;
    scenario.title=`미래 가정 · ${scenarioNames[s.scenario]?.[1]||''}`;scenario.setAttribute('aria-label',scenario.title);
    for(const node of document.querySelectorAll('[data-chart-tool]'))node.setAttribute('aria-pressed',String(node.dataset.chartTool===s.tool));
    for(const node of document.querySelectorAll('[data-workbench-scenario]'))node.setAttribute('aria-pressed',String(node.dataset.workbenchScenario===s.scenario));
    for(const node of ranges.querySelectorAll('[data-chart-span]')){node.hidden=intraday;node.setAttribute('aria-pressed',String(!s.customRange&&node.dataset.chartSpan===s.window));}
    const display=s.display,linearOnly=isStartPriceUnit(s.unit),effectiveScale=display?.effectiveScale||(linearOnly?'linear':s.scale);
    scale.textContent=`${s.unit==='percent'?'% · ':s.unit==='indexed-start'?'100 · ':''}${effectiveScale==='linear'?'선형':'로그'}`;scale.setAttribute('aria-pressed',String(effectiveScale!=='linear'));scale.disabled=linearOnly;scale.title=linearOnly?'표시 시작 기준 %와 100은 선형 눈금을 사용합니다.':`가격 눈금 · ${effectiveScale==='linear'?'로그로':'선형으로'} 변경`;scale.setAttribute('aria-label',scale.title);
    unitSelect.value=s.unit||'usd';priceChecks.get('invert-scale').checked=Boolean(s.invertScale);priceChecks.get('price-only-auto').checked=Boolean(s.priceOnlyAuto);
    displayBasis.textContent=s.unit==='usd'?'USD 원본 가격':display?.available===false?'현재 표시 구간에 기준으로 삼을 실제 가격이 없습니다.':`${display?.label||''} · 기준 ${display?.baseDate||'—'} UTC · $${Number.isFinite(display?.basePrice)?display.basePrice.toLocaleString('en-US',{maximumFractionDigits:6}):'—'}`;
    const automatic=s.priceAxisMode!=='manual';auto.setAttribute('aria-pressed',String(automatic));auto.textContent=automatic?'자동':'수동';auto.title=automatic?'가격축 자동 맞춤 켜짐 · 눌러 현재 가격 범위 고정':'가격축 수동 범위 · 눌러 자동 맞춤';auto.setAttribute('aria-label',auto.title);auto.disabled=s.navigationAvailable===false;plot.dataset.priceAxisMode=automatic?'auto':'manual';
    magnetMode=normalizeMagnetMode(s.magnet);if(magnet.dataset.magnetMode!==magnetMode)magnet.querySelector('.icon').innerHTML=paths[magnetMode==='strong'?'magnetStrong':'magnet'];magnet.dataset.magnetMode=magnetMode;magnet.setAttribute('aria-pressed',String(magnetMode!=='off'));magnetBadge.textContent={off:'OFF',weak:'약',strong:'강'}[magnetMode];
    magnet.title=`자석 · ${MAGNET_LABELS[magnetMode]} · 두 지점 측정 · Alt+M`;magnet.setAttribute('aria-label',`${magnet.title} · 설정`);
    for(const option of magnetMenu.querySelectorAll('[data-magnet-mode]'))option.setAttribute('aria-checked',String(option.dataset.magnetMode===magnetMode));
    clear.disabled=!s.measurement;
    const validSeconds=value=>Number.isSafeInteger(value)&&Math.abs(value)<8640000000000;
    const timeText=value=>new Date(value*1000).toISOString().slice(0,16).replace('T',' ');
    const rangeText=intraday&&validSeconds(s.start)&&validSeconds(s.end)?`${timeText(s.start)} — ${timeText(s.end)}`:!intraday&&typeof s.start==='string'&&typeof s.end==='string'?`${s.start.replaceAll('-','.')} — ${s.end.replaceAll('-','.')}`:'';
    rangeLabel.hidden=!price||!rangeText;rangeLabel.textContent=price?rangeText:'';
    rangeLabel.title=price&&rangeText?`표시 기간 · ${rangeText} UTC`:'';
    bottomBar.update(s);
    if(s.next){next.disabled=false;next.title=`${s.next.type==='high'?'조정':'반등'} 후보 · D-${s.next.days} · ${s.next.date} · 가정`;next.setAttribute('aria-label',next.title);}else next.disabled=true;
  };
  const handleIntervalKey=event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)||event.altKey||event.ctrlKey||event.metaKey)return;
    const nodes=[...intervalButtons.querySelectorAll('button')],index=nodes.indexOf(event.target);if(index<0)return;
    event.preventDefault();event.stopPropagation();
    const next=event.key==='Home'?0:event.key==='End'?nodes.length-1:(index+(event.key==='ArrowRight'?1:-1)+nodes.length)%nodes.length;
    nodes[next].focus({preventScroll:true});nodes[next].click();
  };
  const handleKey=event=>{
    if(event.defaultPrevented||document.body.dataset.page!=='outlook'||event.ctrlKey||event.metaKey||event.target.closest?.('input,textarea,select,[contenteditable=true],#chart-reader,#indicator-library,#workspace-dialog,#chart-indicator-manager,.analysis-indicator-window,.chart-context-menu,.chart-go-to-dialog,.chart-bottom-popover'))return;
    if(workspace.dataset.chartMode!=='price')return;
    const key=event.key.toLowerCase(),intraday=plot.dataset.intraday==='true';
    if(event.altKey){
      if(key==='r'){event.preventDefault();command('fit');}
      else if(key==='l'){event.preventDefault();command('scale');}
      else if(key==='m'){event.preventDefault();command('magnet',MAGNET_MODES[(MAGNET_MODES.indexOf(magnetMode)+1)%MAGNET_MODES.length]);}
      else if(key==='g'){event.preventDefault();goDate.click();}
      else if(key==='z'){event.preventDefault();plot.querySelector('svg[data-plot-left]:not([hidden])')?.focus({preventScroll:true});}
      return;
    }
    if(key==='?'){event.preventDefault();openReader('guide',{focus:true,opener:document.activeElement});return;}
    const tool={c:'crosshair',h:'pan',m:'measure'}[key];
    if(tool){event.preventDefault();command('tool',tool);}
  };
  scale.setAttribute('aria-keyshortcuts','Alt+L');goDate.setAttribute('aria-keyshortcuts','Alt+G');
  document.addEventListener('atlas:workbench-state',handleState);
  document.addEventListener('keydown',handleKey);intervalButtons.addEventListener('keydown',handleIntervalKey);
  return {destroy(){symbolSelector.destroy();goTo.destroy();workspaceTools.destroy();bottomBar.destroy();document.removeEventListener('atlas:workbench-state',handleState);document.removeEventListener('keydown',handleKey);intervalButtons.removeEventListener('keydown',handleIntervalKey);document.removeEventListener('pointerdown',dismissMagnet,true);document.removeEventListener('focusin',dismissMagnet);document.removeEventListener('scroll',scrollMagnet,true);document.removeEventListener('visibilitychange',visibilityMagnet);window.removeEventListener('resize',resizeMagnet);window.removeEventListener('blur',resizeMagnet);magnetMenu.remove();}};
}
