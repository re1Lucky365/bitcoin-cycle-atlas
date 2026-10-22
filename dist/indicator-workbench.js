import { INDICATORS, readIndicatorState, normalizeIndicatorState, isIndicatorVisible, searchIndicators } from './indicator-state.js?v=1.10.5';
import {indicatorReadout,indicatorReadoutDate} from './indicator-readouts.js?v=1.10.5';

const ICONS={eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',hidden:'<path d="m3 3 18 18M10 5a12 12 0 0 1 2 0c6.5 0 10 7 10 7a20 20 0 0 1-3 4M6 6a20 20 0 0 0-4 6s3.5 7 10 7a12 12 0 0 0 5-1"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>'};
const glyph=name=>`<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;
const LEGEND_LABELS={readout:'가격 · OHLC',source:'자료 출처',legend:'범례',countdown:'다음 국면',volume:'Vol',history:'역사 사건',range:'수요·채택 범위','cycle-timing':'사이클 시계',drawdown:'전고점 대비',states:'시장 국면',fibonacci:'피보나치'};
const HUD_INDICATORS=new Set(['readout','source','legend','countdown','history']);

/** A compact legend changes presentation, never membership or chart layers. */
export function mobilePrimaryIndicator(state,{intraday=false}={}) {
  const eligible=INDICATORS.filter(item=>isIndicatorVisible(state,item.id)&&!(intraday&&item.dailyOnly));
  return (eligible.find(item=>item.id==='volume')||eligible.find(item=>!HUD_INDICATORS.has(item.id))||eligible[0])?.id||null;
}

export function countdownPresentation(value={}) {
  const upcoming=value.status==='upcoming',maintained=value.status==='maintained';
  const current=value.currentLabel?`현재 가정 ${value.currentLabel}${value.currentUntil?` · ${value.currentUntil.replaceAll('-','.')}까지${value.currentRightCensored?' 표시':''}`:''}`:'현재 국면 확인 불가';
  return {caption:`시나리오 기준 · ${value.minimumRunDays||7}일 유지 조건`,dday:upcoming?value.dday||'—':'—',next:upcoming?value.nextLabel||'전환 후보':maintained?'다음 후보 없음':'다음 후보 계산 불가',current};
}

export function mountIndicatorWorkbench({plot,stage}) {
  const doc=plot.ownerDocument;
  let state=readIndicatorState(location.search),category='전체',intraday=false,cycle=null,countdown=null,countdownKey='',listKey='',dialogKey='',opener=null;
  let readoutFrame=0;
  const readoutRows=new Map(),dialogReadoutRows=new Map(),readoutContext={selection:null,workbench:{},cycle:null,analyses:new Map()};
  const compactViewport=doc.defaultView?.matchMedia?.('(max-width:620px), (max-width:950px) and (max-height:500px)');
  const command=(action,id)=>doc.dispatchEvent(new CustomEvent('atlas:indicator-command',{detail:{action,id}}));
  const makeButton=(label,icon,action)=>{const b=doc.createElement('button');b.type='button';b.title=label;b.setAttribute('aria-label',label);b.innerHTML=glyph(icon);b.onclick=action;return b;};
  const manager=doc.createElement('section');manager.id='chart-indicator-manager';manager.className='chart-indicator-manager indicator-legend';manager.setAttribute('aria-label','추가한 인디케이터');manager.setAttribute('aria-describedby','indicator-readout-date');
  const list=doc.createElement('div');list.id='chart-indicator-list';list.className='chart-indicator-list';
  list.setAttribute('role','list');
  const readoutDate=doc.createElement('p');readoutDate.id='indicator-readout-date';readoutDate.className='indicator-readout-date';
  manager.append(readoutDate,list);plot.append(manager);
  const countdownBox=doc.createElement('button');countdownBox.type='button';countdownBox.id='scenario-countdown';countdownBox.className='scenario-countdown';countdownBox.hidden=true;countdownBox.setAttribute('aria-label','다음 국면 D-day의 가정과 근거 보기');
  countdownBox.onclick=()=>doc.dispatchEvent(new CustomEvent('atlas:countdown-detail'));plot.append(countdownBox);
  // Observe layout boxes, never the price path. Wrapped readouts determine the
  // legend position; the actual plot height bounds its scrollable overflow.
  const readoutNode=plot.querySelector('#lab-metrics'),sourceNode=plot.querySelector('.workbench-market-info');
  let observedCountdownWidth=-1;
  const overlaySizes=new WeakMap(),overlayResize=new ResizeObserver(entries=>{
    let offsetChanged=false;
    for(const entry of entries){
      if(entry.target===countdownBox){
        const width=Math.ceil(entry.borderBoxSize?.[0]?.inlineSize??entry.contentRect.width);
        if(Number.isFinite(width)&&width!==observedCountdownWidth){observedCountdownWidth=width;plot.style.setProperty('--countdown-width',`${width}px`);}
      }
      const height=Math.ceil(entry.borderBoxSize?.[0]?.blockSize??entry.contentRect.height);
      if(overlaySizes.get(entry.target)===height)continue;overlaySizes.set(entry.target,height);
      const property=entry.target===plot?'--plot-height':entry.target===manager?'--indicator-manager-height':entry.target===countdownBox?'--countdown-height':entry.target===readoutNode?'--readout-height':'--source-height';
      plot.style.setProperty(property,`${height}px`);
      if(entry.target===readoutNode||entry.target===sourceNode)offsetChanged=true;
    }
    if(offsetChanged)updateOverlayOffsets();
  });
  for(const node of [plot,manager,countdownBox,readoutNode,sourceNode])if(node)overlayResize.observe(node);

  const dialog=doc.createElement('dialog');dialog.id='indicator-library';dialog.className='indicator-library';dialog.setAttribute('aria-labelledby','indicator-library-title');dialog.setAttribute('aria-describedby','indicator-library-description indicator-readout-date');
  const dialogHeader=doc.createElement('header');dialogHeader.className='indicator-library-heading';
  const title=doc.createElement('h2');title.id='indicator-library-title';title.textContent='인디케이터';
  const close=makeButton('인디케이터 창 닫기','close',()=>dialog.close());dialogHeader.append(title,close);
  const description=doc.createElement('p');description.id='indicator-library-description';description.textContent='클릭하면 차트에 추가됩니다. 추가한 항목을 다시 클릭하면 삭제됩니다.';
  const search=doc.createElement('input');search.type='search';search.id='indicator-search';search.placeholder='인디케이터 검색';search.setAttribute('aria-label','인디케이터 검색');search.autocomplete='off';
  const categories=doc.createElement('div');categories.className='indicator-categories';categories.setAttribute('role','group');categories.setAttribute('aria-label','인디케이터 분류');
  for(const name of ['전체','가격 지표','분석 창','표시']){const b=doc.createElement('button');b.type='button';b.textContent=name;b.setAttribute('aria-pressed',String(name===category));b.onclick=()=>{category=name;dialogKey='';paintDialog();};categories.append(b);}
  const results=doc.createElement('div');results.id='indicator-library-results';results.className='indicator-library-results';
  const resultCount=doc.createElement('p');resultCount.className='indicator-result-count';resultCount.setAttribute('role','status');resultCount.setAttribute('aria-live','polite');
  const footer=doc.createElement('footer');
  const options=doc.createElement('div');options.className='indicator-library-options';
  const listOption=doc.createElement('label');listOption.className='indicator-list-option';
  const listVisible=doc.createElement('input');listVisible.type='checkbox';listVisible.id='indicator-list-visibility';listVisible.setAttribute('aria-controls','chart-indicator-list');
  listVisible.onchange=()=>{if(listVisible.checked!==!state.collapsed)command('collapse');};
  listOption.append(listVisible,doc.createTextNode('차트에 지표 값 표시'));
  const all=doc.createElement('button');all.type='button';all.id='indicator-visibility-all';all.onclick=()=>command(state.added.some(id=>isIndicatorVisible(state,id))?'hide-all':'show-all');
  options.append(listOption,all);
  const help=doc.createElement('p');help.className='indicator-library-help';help.textContent='작은 화면은 대표 지표 1개만 표시합니다. 나머지 값과 표시 여부는 여기서 확인·변경할 수 있습니다.';
  footer.append(options,help);
  dialog.append(dialogHeader,description,search,categories,resultCount,results,footer);doc.body.append(dialog);

  function open(trigger){
    if(dialog.open)return;opener=trigger||doc.activeElement;search.value='';category='전체';dialogKey='';dialog.showModal();paintDialog();search.focus();
    doc.querySelector('#atlas-mode-menu')?.setAttribute('aria-expanded','true');
  }
  function applyDisplay(){
    for(const [id,selector] of [['readout','#lab-metrics'],['source','.workbench-market-info'],['legend','.lab-chart-foot']]){
      const node=plot.querySelector(selector);if(node)node.hidden=!isIndicatorVisible(state,id);
    }
    updateOverlayOffsets();
    countdownBox.hidden=!isIndicatorVisible(state,'countdown')||intraday||!countdown;
    plot.dataset.countdownVisible=String(!countdownBox.hidden);
  }
  function updateOverlayOffsets(){
    // Actual wrapped text height is measured by ResizeObserver, never by a
    // pointer handler. Position changes cannot resize these absolute overlays.
    const sourceTop=7+(isIndicatorVisible(state,'readout')?(overlaySizes.get(readoutNode)??36)+4:0);
    const indicatorTop=sourceTop+(isIndicatorVisible(state,'source')?(overlaySizes.get(sourceNode)??20)+6:0);
    for(const [property,value] of [['--source-top',sourceTop],['--indicator-top',indicatorTop]])if(plot.style.getPropertyValue(property)!==`${value}px`)plot.style.setProperty(property,`${value}px`);
  }
  function paintCountdown(){
    if(!countdown)return;const key=JSON.stringify([countdown.status,countdown.dday,countdown.date,countdown.nextKey,countdown.nextLabel,countdown.currentLabel,countdown.holdDays,countdown.currentUntil,countdown.currentRightCensored,countdown.minimumRunDays,countdown.asOf,countdown.asOfAgeDays,countdown.note]);if(key===countdownKey)return;countdownKey=key;
    const presentation=countdownPresentation(countdown);
    const main=doc.createElement('strong');main.className='countdown-main';
    const next=doc.createElement('span');next.className='countdown-next';next.textContent=countdown.status==='upcoming'?`다음 ${presentation.next}`:presentation.next;
    const dday=doc.createElement('b');dday.textContent=presentation.dday;main.append(next,dday);
    const meta=doc.createElement('span');meta.className='countdown-meta';
    const label=doc.createElement('span');label.className='countdown-caption';label.textContent='가정';
    const date=doc.createElement('time');date.className='countdown-date';date.textContent=countdown.date?countdown.date.replaceAll('-','.'):`${countdown.minimumRunDays||7}일 유지 조건`;if(countdown.date)date.dateTime=countdown.date;
    meta.append(label,date);countdownBox.dataset.regime=countdown.nextKey||'unknown';
    countdownBox.replaceChildren(main,meta);countdownBox.title=`${presentation.caption}\n${presentation.current}\n${countdown.note||'같은 미래 가격 경로에서 계산한 조건부 국면입니다.'}\n관측 ${countdown.asOf||'—'} UTC · ${countdown.asOfAgeDays??'—'}일 경과 · 클릭하여 가정 보기`;
    countdownBox.setAttribute('aria-label',`${presentation.caption} · ${next.textContent} · ${dday.textContent}${countdown.date?` · ${countdown.date}`:''} · ${presentation.current} · 가정과 근거 보기`);
  }
  function paintValueRows(rows,details,{chart=false}={}){
    for(const {item,row,value,name} of rows.values()){
      if(chart&&compactViewport?.matches&&row.dataset.mobilePrimary!=='true')continue;
      if(!details.has(item.id))details.set(item.id,indicatorReadout(item,readoutContext));
      const detail=details.get(item.id),text=chart&&item.id==='volume'?detail.value.replace(/^Vol\s+/u,''):detail.value;
      if(value.textContent!==text)value.textContent=text;
      if(value.dataset.tone!==detail.tone)value.dataset.tone=detail.tone;
      if(name.title!==detail.title)name.title=detail.title;
      if(row.dataset.value!==detail.value)row.dataset.value=detail.value;
    }
  }
  function paintReadouts(){
    if(readoutFrame)cancelAnimationFrame(readoutFrame);readoutFrame=0;if(manager.hidden&&!dialog.open)return;
    const date=indicatorReadoutDate(readoutContext.selection);if(readoutDate.textContent!==date)readoutDate.textContent=date;
    const details=new Map();
    if(!manager.hidden)paintValueRows(readoutRows,details,{chart:true});
    if(dialog.open)paintValueRows(dialogReadoutRows,details);
  }
  // Hover only touches existing value nodes, at most once per animation frame.
  // Hidden/collapsed rows retain their data without layout work until reopened.
  function scheduleReadouts(){if((!manager.hidden||dialog.open)&&!readoutFrame)readoutFrame=requestAnimationFrame(paintReadouts);}
  function paintList(){
    applyDisplay();manager.dataset.collapsed=String(state.collapsed);manager.hidden=state.collapsed||!state.added.length;list.hidden=state.collapsed;readoutDate.hidden=state.collapsed;
    const mobilePrimary=mobilePrimaryIndicator(state,{intraday});manager.dataset.mobileEmpty=String(!mobilePrimary);
    listVisible.checked=!state.collapsed;
    const hasVisible=state.added.some(id=>isIndicatorVisible(state,id));all.textContent=hasVisible?'모두 숨김':'모두 표시';all.disabled=!state.added.length;all.title=`추가한 인디케이터 모두 ${hasVisible?'숨기기':'표시'}`;all.setAttribute('aria-label',all.title);
    const key=JSON.stringify([state.added,state.hidden,intraday]);if(key===listKey){scheduleReadouts();return;}listKey=key;
    const focused=doc.activeElement?.closest?.('[data-indicator-row]')?.dataset.indicatorRow,action=doc.activeElement?.dataset.indicatorAction;
    list.replaceChildren();readoutRows.clear();
    for(const item of INDICATORS.filter(item=>state.added.includes(item.id))){
      const visible=isIndicatorVisible(state,item.id),unavailable=intraday&&item.dailyOnly,row=doc.createElement('div');row.className='indicator-row';row.dataset.indicatorRow=item.id;row.dataset.visible=String(visible);row.dataset.unavailable=String(Boolean(unavailable));row.dataset.mobilePrimary=String(item.id===mobilePrimary);
      row.setAttribute('role','listitem');
      const name=doc.createElement(item.analysis?'button':'div');name.className='indicator-name';
      const label=doc.createElement('span');label.className='indicator-label';label.textContent=LEGEND_LABELS[item.id]||item.label;label.title=item.label;
      const value=doc.createElement('strong');value.className='indicator-value';value.textContent='자료 대기';name.append(label,value);
      if(item.analysis){name.type='button';name.title=`${item.label} 분석 창으로 이동`;name.onclick=()=>{if(!visible)command('visibility',item.id);command('activate',item.id);const window=doc.getElementById(`analysis-window-${item.id}`);window?.scrollIntoView({block:'nearest',inline:'nearest'});window?.querySelector('svg')?.focus({preventScroll:true});};}
      if(unavailable)name.title=`${item.description} · 1D·1W에서 표시됩니다.`;
      const eye=makeButton(`${item.label} ${visible?'숨기기':'표시'}`,visible?'eye':'hidden',()=>command('visibility',item.id));eye.className='indicator-row-action';eye.dataset.indicatorAction='visibility';eye.setAttribute('aria-pressed',String(visible));
      const remove=makeButton(`${item.label} 삭제`,'close',()=>command('remove',item.id));remove.className='indicator-row-action';remove.dataset.indicatorAction='remove';
      row.append(name,eye,remove);list.append(row);readoutRows.set(item.id,{item,row,value,name});
    }
    if(focused&&action){
      const focusId=compactViewport?.matches?mobilePrimary:focused;
      const target=list.querySelector(`[data-indicator-row="${focusId}"] [data-indicator-action="${action}"]`)||(dialog.open?search:doc.querySelector('#atlas-mode-menu')||(opener?.isConnected?opener:null));
      target?.focus({preventScroll:true});
    }
    paintReadouts();
  }
  function paintDialog(){
    const key=JSON.stringify([state.added,state.hidden,category,search.value,intraday]);if(key===dialogKey)return;dialogKey=key;
    for(const b of categories.children)b.setAttribute('aria-pressed',String(b.textContent===category));
    const focused=doc.activeElement?.closest?.('[data-library-indicator]')?.dataset.libraryIndicator,action=doc.activeElement?.dataset.libraryAction,items=searchIndicators(search.value,category);results.replaceChildren();dialogReadoutRows.clear();
    for(const item of items){
      const added=state.added.includes(item.id),visible=isIndicatorVisible(state,item.id),wrapper=doc.createElement('div');wrapper.className='indicator-library-row';wrapper.dataset.libraryIndicator=item.id;wrapper.dataset.added=String(added);wrapper.dataset.visible=String(visible);
      const row=doc.createElement('button');row.type='button';row.className='indicator-library-item';row.dataset.indicatorId=item.id;row.dataset.libraryAction='membership';row.setAttribute('aria-pressed',String(added));row.setAttribute('aria-label',`${item.label} · ${added?'차트에서 삭제':'차트에 추가'}`);
      const text=doc.createElement('span'),name=doc.createElement('strong'),detail=doc.createElement('small');name.textContent=item.label;detail.textContent=`${item.description}${intraday&&item.dailyOnly?' · 1D·1W에서 표시':''}`;text.append(name,detail);
      const status=doc.createElement('span');status.className='indicator-library-status';status.textContent=added?(visible?'추가됨 ✓':'추가됨 · 숨김'):'+ 추가';
      row.append(text,status);row.onclick=()=>command('toggle',item.id);wrapper.append(row);
      if(added){
        const value=doc.createElement('small');value.className='indicator-library-value indicator-value';value.id=`indicator-library-value-${item.id}`;value.textContent='자료 대기';text.append(value);row.setAttribute('aria-describedby',value.id);
        const eye=makeButton(`${item.label} ${visible?'숨기기':'표시'}`,visible?'eye':'hidden',()=>command('visibility',item.id));eye.className='indicator-library-eye';eye.dataset.libraryAction='visibility';eye.setAttribute('aria-pressed',String(visible));eye.setAttribute('aria-describedby',value.id);wrapper.append(eye);
        dialogReadoutRows.set(item.id,{item,row:wrapper,value,name:row});
      }
      results.append(wrapper);
    }
    resultCount.textContent=`${items.length}개 · 차트에 ${state.added.length}개 추가됨`;
    if(!items.length){const empty=doc.createElement('p');empty.className='indicator-empty';empty.textContent='검색 결과가 없습니다. 다른 이름으로 검색해 보세요.';results.append(empty);}
    if(focused)(results.querySelector(`[data-library-indicator="${focused}"] [data-library-action="${action}"]`)||results.querySelector(`[data-indicator-id="${focused}"]`)||search).focus({preventScroll:true});
    paintReadouts();
  }
  search.addEventListener('input',paintDialog);
  dialog.addEventListener('close',()=>{doc.querySelector('#atlas-mode-menu')?.setAttribute('aria-expanded','false');const target=opener?.isConnected?opener:doc.querySelector('#atlas-mode-menu');target?.focus({preventScroll:true});});
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
  dialog.addEventListener('keydown',event=>{
    event.stopPropagation();if(event.key!=='Tab')return;
    const focusable=[...dialog.querySelectorAll('button:not(:disabled),input:not(:disabled),[tabindex="0"]')].filter(node=>!node.hidden);
    const first=focusable[0],last=focusable.at(-1);
    if(event.shiftKey&&doc.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&doc.activeElement===last){event.preventDefault();first?.focus();}
  });
  const onOpen=event=>open(event.detail?.opener);
  const onState=event=>{state=normalizeIndicatorState(event.detail.indicators||state);cycle=event.detail.cycleCalibration||cycle;readoutContext.cycle=cycle;paintList();if(dialog.open)paintDialog();};
  const onWorkbench=event=>{
    intraday=Boolean(event.detail.intraday);countdown=event.detail.countdown||countdown;readoutContext.workbench=event.detail;paintCountdown();paintList();
    // Publish the first chart with its actual indicator values, not the prior frame's placeholders.
    if(doc.documentElement.dataset.boot==='loading')paintReadouts();
    if(dialog.open)paintDialog();
  };
  const onReadout=event=>{readoutContext.selection=event.detail;scheduleReadouts();};
  const onAnalysis=event=>{const detail=event.detail;if(!detail?.mode)return;readoutContext.analyses.set(detail.mode,{...readoutContext.analyses.get(detail.mode),...detail});scheduleReadouts();};
  const onCompactViewport=()=>{
    const focused=doc.activeElement?.closest?.('[data-indicator-row]');
    if(compactViewport.matches&&focused&&focused.dataset.mobilePrimary!=='true'){
      const target=list.querySelector('[data-mobile-primary="true"] [data-indicator-action]')||doc.querySelector('#atlas-mode-menu');target?.focus({preventScroll:true});
    }
    scheduleReadouts();
  };
  compactViewport?.addEventListener('change',onCompactViewport);
  doc.addEventListener('atlas:indicator-library',onOpen);doc.addEventListener('atlas:indicator-state',onState);doc.addEventListener('atlas:workbench-state',onWorkbench);doc.addEventListener('atlas:readout',onReadout);doc.addEventListener('atlas:analysis-state',onAnalysis);paintList();
  for(const name of ['wheel','pointerdown','dblclick','contextmenu'])manager.addEventListener(name,event=>event.stopPropagation(),name==='wheel'?{passive:true}:undefined);
  return {open,destroy(){doc.removeEventListener('atlas:indicator-library',onOpen);doc.removeEventListener('atlas:indicator-state',onState);doc.removeEventListener('atlas:workbench-state',onWorkbench);doc.removeEventListener('atlas:readout',onReadout);doc.removeEventListener('atlas:analysis-state',onAnalysis);compactViewport?.removeEventListener('change',onCompactViewport);if(readoutFrame)cancelAnimationFrame(readoutFrame);overlayResize.disconnect();dialog.remove();manager.remove();countdownBox.remove();}};
}
