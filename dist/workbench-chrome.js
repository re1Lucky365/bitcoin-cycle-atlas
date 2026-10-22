const $ = selector => document.querySelector(selector);

const paths = {
  crosshair:'<path d="M12 2v5m0 10v5M2 12h5m10 0h5"/><circle cx="12" cy="12" r="4"/>',
  pan:'<path d="M8 12V7a2 2 0 0 1 4 0v5-7a2 2 0 0 1 4 0v7-5a2 2 0 0 1 4 0v8c0 5-3 7-7 7-3 0-5-2-7-5l-3-4a2 2 0 0 1 3-2l2 2"/>',
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
  const glyph=name=>paths[name]?`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`:icon(name);
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
  const modeTabs=$('.atlas-mode-tabs'),controlSets=[...document.querySelectorAll('.atlas-controls>.atlas-control-set')];
  settingsBody.prepend(...controlSets);settingsBody.append($('#atlas-reset'));
  const frequency=$('[data-lab-frequency]').closest('fieldset');frequency.id='workbench-frequency';
  frequency.setAttribute('aria-label','가격 표시 간격');
  for(const control of frequency.querySelectorAll('button')){
    const weekly=control.dataset.labFrequency==='weekly';control.textContent=weekly?'1W':'1D';
    control.title=weekly?'주별 마지막 관측 가격':'일별 관측 가격';control.setAttribute('aria-label',control.title);
  }
  const layers=document.createElement('div');layers.className='atlas-settings-body workbench-layers';
  const layerNames={'lab-band':'모의 경로 범위','lab-turns':'고점·저점','atlas-drawdown':'전고점 대비 낙폭','atlas-states':'상승·횡보·하락','lab-fib':'피보나치 되돌림'};
  for(const [id,label] of Object.entries(layerNames)){
    const input=$(`#${id}`),row=input.closest('label');
    row.replaceChildren(input,document.createTextNode(label));layers.append(row);
  }
  const layerEmpty=document.createElement('p');layerEmpty.id='workbench-layer-empty';layerEmpty.textContent='이 그래프에는 추가 레이어가 없습니다.';layerEmpty.hidden=true;layers.append(layerEmpty);
  const downloads=document.createElement('div');downloads.className='atlas-setting-downloads';downloads.append($('#lab-json'));layers.append(downloads);
  const scenarios=document.createElement('div');scenarios.className='workbench-scenarios';
  const scenarioSelect=$('#lab-scenario'),scenarioLabel=scenarioSelect.closest('label');scenarioLabel.hidden=true;scenarios.append(scenarioLabel);
  const scenarioNames={base:['기본','4년 흐름 반복'],accelerated:['빠른 전환','고점권·최종 고점 앞당김'],wait:['횡보 연장','빨리 오른 뒤 오래 체류'],late:['늦은 전환','고점 전환 지연'],stress:['하락 확대','기존 저점 재이탈']};
  for(const [key,[name,description]] of Object.entries(scenarioNames)){
    const node=document.createElement('button');node.type='button';node.dataset.workbenchScenario=key;node.setAttribute('aria-pressed','false');
    const strong=document.createElement('strong'),small=document.createElement('span');strong.textContent=name;small.textContent=description;node.append(strong,small);
    node.onclick=()=>{scenarioSelect.value=key;scenarioSelect.dispatchEvent(new Event('change',{bubbles:true}));};scenarios.append(node);
  }
  const scenarioModel=button('math','입력·가정·과거 검증 보기');scenarioModel.classList.add('workbench-scenario-model');scenarioModel.append(document.createTextNode('모델과 검증'));panelButton(scenarioModel,'math');scenarios.append(scenarioModel);
  liveControls.set('settings',settingsBody);liveControls.set('charts',modeTabs);liveControls.set('layers',layers);liveControls.set('scenarios',scenarios);
  controlStore.append(settingsBody,modeTabs,layers,scenarios);
  const heading=document.createElement('header');heading.className='atlas-canvas-heading';heading.setAttribute('aria-label','차트 상단 도구');
  const symbol=document.createElement('span');symbol.className='workbench-symbol';symbol.textContent='BTCUSD';symbol.title='비트코인 / 미국 달러 · UTC 일말 가격';
  const menu=panelButton(button('chart','그래프 종류'),'charts');menu.id='atlas-mode-menu';
  const modeName=document.createElement('span');modeName.id='atlas-mode-name';modeName.textContent='가격과 미래';menu.append(modeName);menu.classList.add('workbench-mode');
  const scenario=panelButton(button('scenario','미래 가정 선택'),'scenarios');scenario.id='workbench-scenario';
  const scenarioName=document.createElement('span');scenarioName.id='workbench-scenario-name';scenarioName.textContent='기본 가정';scenario.append(scenarioName);
  const settingButton=panelButton(button('settings','차트 설정'),'settings');settingButton.id='atlas-display-options';settings.remove();
  const save=$('#lab-svg');save.className='workbench-icon';save.innerHTML=icon('download');save.title='현재 그래프 저장 · SVG';save.setAttribute('aria-label',save.title);
  const spacer=document.createElement('span');spacer.className='workbench-spacer';
  heading.append(symbol,frequency,menu,scenario,spacer,save,settingButton);stage.prepend(heading);
  modeTabs.querySelectorAll('[data-atlas-mode]').forEach(node=>node.addEventListener('click',()=>closeReader()));
  const left=document.createElement('nav');left.className='workbench-tools';left.setAttribute('aria-label','차트 조작 도구');
  for(const [name,glyphName,label] of [['crosshair','crosshair','십자선 · C'],['pan','pan','차트 이동 · H'],['measure','ruler','두 지점 측정 · M']]){
    const node=button(glyphName,label,{'data-chart-tool':name,'aria-pressed':String(name==='crosshair')});node.onclick=()=>command('tool',name);left.append(node);
  }
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
  const bottom=document.createElement('footer');bottom.className='workbench-bottom';bottom.setAttribute('aria-label','표시 기간과 가격 눈금');
  const ranges=document.createElement('div');ranges.className='workbench-ranges';ranges.setAttribute('role','group');ranges.setAttribute('aria-label','차트 표시 기간');
  for(const [value,label,title] of [['near','6개월','가까운 6개월 · 최근 45일 포함'],['all','3년 전망','최근 1년과 앞으로 3년'],['history','전체','2010년부터 앞으로 3년까지']]){
    const node=document.createElement('button');node.type='button';node.textContent=label;node.title=title;node.setAttribute('aria-label',title);node.dataset.chartSpan=value;node.setAttribute('aria-pressed','false');node.onclick=()=>command('span',value);ranges.append(node);
  }
  const goDate=panelButton(button('calendar','날짜로 이동'),'selection');goDate.id='workbench-go-date';
  goDate.onclick=()=>{openReader('selection',{focus:true,opener:goDate});requestAnimationFrame(()=>$('#atlas-date').focus({preventScroll:true}));};ranges.append(goDate);
  const rangeLabel=document.createElement('span');rangeLabel.id='workbench-range-label';
  const axis=document.createElement('div');axis.className='workbench-axis';
  const scale=document.createElement('button');scale.type='button';scale.id='workbench-scale';scale.textContent='로그';scale.title='가격 눈금 · 로그 / 선형';scale.setAttribute('aria-label','로그 가격 눈금 · 선형으로 변경');scale.setAttribute('aria-pressed','true');scale.onclick=()=>command('scale');
  const auto=document.createElement('span');auto.className='workbench-auto';auto.textContent='자동';auto.title='가격축은 표시 중인 데이터 범위에 자동으로 맞춥니다.';
  const fit=button('fit','기본 기간으로 맞춤',{'id':'workbench-fit'});fit.onclick=()=>command('fit');axis.append(scale,auto,fit);
  const update=$('#atlas-update-status');update.className='workbench-update';panelButton(update,'update');
  const zone=document.createElement('span');zone.className='workbench-zone';zone.textContent='UTC';zone.title='차트 일별 관측 날짜의 기준 시간대';
  const status=document.createElement('div');status.className='workbench-status';status.append(zone,update);bottom.append(ranges,rangeLabel,axis,status);stage.append(bottom);
  $('#chart-detail-actions').append($('#atlas-date-label'),$('#atlas-inspect-prev'),$('#atlas-inspect-next'),$('#atlas-latest'));
  $('#atlas-latest').innerHTML=icon('clock');$('#atlas-latest').title='최근 관측으로';$('#atlas-latest').setAttribute('aria-label','최근 관측으로');
  $('.atlas-controls').remove();tools.remove();
  const live=document.createElement('span');live.id='workbench-announcement';live.className='lab-visually-hidden';live.setAttribute('role','status');live.setAttribute('aria-live','polite');stage.append(live);
  $('#lab-metrics').removeAttribute('aria-live');
  document.addEventListener('atlas:workbench-state',event=>{
    const s=event.detail,price=s.mode==='price';plot.dataset.tool=s.tool;workspace.dataset.chartMode=s.mode;
    left.hidden=!price;scenario.hidden=!price;layerButton.hidden=!price;ranges.hidden=!price;axis.hidden=!price;next.hidden=!price;goDate.hidden=!price;
    layerEmpty.hidden=price;scenarioName.textContent=`${scenarioNames[s.scenario]?.[0]||'기본'} 가정`;
    scenario.title=`미래 가정 · ${scenarioNames[s.scenario]?.[1]||''}`;scenario.setAttribute('aria-label',scenario.title);
    for(const node of document.querySelectorAll('[data-chart-tool]'))node.setAttribute('aria-pressed',String(node.dataset.chartTool===s.tool));
    for(const node of document.querySelectorAll('[data-workbench-scenario]'))node.setAttribute('aria-pressed',String(node.dataset.workbenchScenario===s.scenario));
    for(const node of ranges.querySelectorAll('[data-chart-span]'))node.setAttribute('aria-pressed',String(!s.customRange&&node.dataset.chartSpan===s.window));
    scale.textContent=s.scale==='linear'?'선형':'로그';scale.setAttribute('aria-pressed',String(s.scale!=='linear'));scale.setAttribute('aria-label',`${s.scale==='linear'?'선형':'로그'} 가격 눈금 · ${s.scale==='linear'?'로그로':'선형으로'} 변경`);
    clear.disabled=!s.measurement;rangeLabel.textContent=price?`${s.start?.replaceAll('-','.')} — ${s.end?.replaceAll('-','.')}`:'';
    rangeLabel.title=price?`표시 기간 · ${s.start} — ${s.end} UTC`:'';
    if(s.next){next.disabled=false;next.title=`${s.next.type==='high'?'조정':'반등'} 후보 · D-${s.next.days} · ${s.next.date} · 가정`;next.setAttribute('aria-label',next.title);}else next.disabled=true;
  });
  document.addEventListener('keydown',event=>{
    if(document.body.dataset.page!=='outlook'||event.ctrlKey||event.metaKey||event.altKey||event.target.closest('input,textarea,select,[contenteditable=true]'))return;
    const tool={c:'crosshair',h:'pan',m:'measure'}[event.key.toLowerCase()];
    if(tool&&workspace.dataset.chartMode==='price'){event.preventDefault();command('tool',tool);}
  });
}
