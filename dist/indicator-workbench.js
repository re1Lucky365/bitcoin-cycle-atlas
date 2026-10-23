import { INDICATORS, readIndicatorState, normalizeIndicatorState, isIndicatorVisible } from './indicator-state.js?v=1.12.0-tv-parity.1';
import {indicatorReadout,indicatorReadoutDate} from './indicator-readouts.js?v=1.12.0-tv-parity.1';
import {INDICATOR_PREFERENCES_KEY,MAX_TEMPLATE_NAME,readIndicatorPreferences,writeIndicatorPreferences,toggleIndicatorFavorite,saveIndicatorTemplate,deleteIndicatorTemplate,indicatorLibraryItems,hasIndicatorTemplate} from './indicator-preferences.js?v=1.12.0-tv-parity.1';

const ICONS={eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',hidden:'<path d="m3 3 18 18M10 5a12 12 0 0 1 2 0c6.5 0 10 7 10 7a20 20 0 0 1-3 4M6 6a20 20 0 0 0-4 6s3.5 7 10 7a12 12 0 0 0 5-1"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',expand:'<path d="m7 10 5 5 5-5"/>',collapse:'<path d="m7 14 5-5 5 5"/>'};
const glyph=name=>`<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;
ICONS.star='<path d="m12 3 2.8 5.7 6.3.9-4.5 4.4 1.1 6.2-5.7-3-5.7 3 1.1-6.2L2.9 9.6l6.3-.9L12 3Z"/>';
const LEGEND_LABELS={readout:'가격 · OHLC',source:'자료 출처',legend:'범례',countdown:'다음 국면',volume:'Vol',history:'역사 사건',range:'수요·채택 범위','cycle-timing':'사이클 시계',drawdown:'전고점 대비',states:'시장 국면',fibonacci:'피보나치'};

/** Display controls already have their own HUD; only real indicators get value rows. */
export function chartIndicatorItems(state) {
  const items=INDICATORS.filter(item=>item.category!=='표시'&&state.added.includes(item.id));
  return [...items.filter(item=>item.id==='volume'),...items.filter(item=>item.id!=='volume')];
}

export function countdownPresentation(value={}) {
  const upcoming=value.status==='upcoming',maintained=value.status==='maintained';
  const current=value.currentLabel?`현재 가정 ${value.currentLabel}${value.currentUntil?` · ${value.currentUntil.replaceAll('-','.')}까지${value.currentRightCensored?' 표시':''}`:''}`:'현재 국면 확인 불가';
  return {caption:`시나리오 기준 · ${value.minimumRunDays||7}일 유지 조건`,dday:upcoming?value.dday||'—':'—',next:upcoming?value.nextLabel||'전환 후보':maintained?'다음 후보 없음':'다음 후보 계산 불가',current};
}

export function mountIndicatorWorkbench({plot,stage}) {
  const doc=plot.ownerDocument;
  let state=readIndicatorState(location.search),category='전체',view='all',intraday=false,cycle=null,countdown=null,countdownKey='',listKey='',dialogKey='',opener=null;
  const storageProvider=()=>doc.defaultView.localStorage;
  let preferences=readIndicatorPreferences(storageProvider);
  let readoutFrame=0;
  const readoutRows=new Map(),dialogReadoutRows=new Map(),readoutContext={selection:null,workbench:{},cycle:null,analyses:new Map()};
  const command=(action,id,extra={})=>doc.dispatchEvent(new CustomEvent('atlas:indicator-command',{detail:{action,id,...extra}}));
  const makeButton=(label,icon,action)=>{const b=doc.createElement('button');b.type='button';b.title=label;b.setAttribute('aria-label',label);b.innerHTML=glyph(icon);b.onclick=action;return b;};
  const manager=doc.createElement('section');manager.id='chart-indicator-manager';manager.className='chart-indicator-manager indicator-legend';manager.setAttribute('aria-label','추가한 인디케이터');manager.setAttribute('aria-describedby','indicator-readout-date');
  const list=doc.createElement('div');list.id='chart-indicator-list';list.className='chart-indicator-list';
  list.setAttribute('role','list');
  const readoutDate=doc.createElement('p');readoutDate.id='indicator-readout-date';readoutDate.className='indicator-readout-date';
  const fold=doc.createElement('button');fold.type='button';fold.id='indicator-legend-toggle';fold.className='indicator-legend-toggle';fold.setAttribute('aria-controls',list.id);
  fold.onclick=()=>command('collapse');
  manager.append(readoutDate,list,fold);plot.append(manager);
  const countdownBox=doc.createElement('button');countdownBox.type='button';countdownBox.id='scenario-countdown';countdownBox.className='scenario-countdown';countdownBox.hidden=true;countdownBox.setAttribute('aria-label','다음 국면 D-day의 가정과 근거 보기');
  countdownBox.onclick=()=>doc.dispatchEvent(new CustomEvent('atlas:countdown-detail'));plot.append(countdownBox);
  // Observe layout boxes, never the price path. Wrapped readouts determine the
  // legend position; the actual plot height bounds its scrollable overflow.
  const readoutNode=plot.querySelector('#lab-metrics'),sourceNode=plot.querySelector('.workbench-market-info');
  let observedCountdownWidth=-1,hudLayoutFrame=0,lastHudLayoutKey='';
  const hudNodes=[manager,countdownBox,readoutNode,sourceNode].filter(Boolean),overlayGeometry=new WeakMap();
  function scheduleHudLayoutChange(){
    if(hudLayoutFrame)return;
    hudLayoutFrame=requestAnimationFrame(()=>{
      hudLayoutFrame=0;
      // Read after the observer has applied CSS anchors: the countdown can move
      // without resizing when the indicator legend above it folds or expands.
      const origin=plot.getBoundingClientRect(),key=JSON.stringify(hudNodes.map(node=>{
        if(node.hidden)return null;
        const box=node.getBoundingClientRect();
        return box.width>0&&box.height>0?[box.left-origin.left,box.top-origin.top,box.width,box.height]:null;
      }));
      if(key===lastHudLayoutKey)return;lastHudLayoutKey=key;
      doc.dispatchEvent(new CustomEvent('atlas:hud-layout-change'));
    });
  }
  const overlaySizes=new WeakMap(),overlayResize=new ResizeObserver(entries=>{
    let offsetChanged=false,geometryChanged=false;
    for(const entry of entries){
      const width=entry.borderBoxSize?.[0]?.inlineSize??entry.contentRect.width,height=entry.borderBoxSize?.[0]?.blockSize??entry.contentRect.height;
      if(!Number.isFinite(width)||!Number.isFinite(height)||width<0||height<0)continue;
      const sizeKey=`${width}/${height}`;
      if(overlayGeometry.get(entry.target)!==sizeKey){overlayGeometry.set(entry.target,sizeKey);if(entry.target!==plot)geometryChanged=true;}
      if(entry.target===countdownBox){
        const pixels=Math.ceil(width);
        if(pixels!==observedCountdownWidth){observedCountdownWidth=pixels;plot.style.setProperty('--countdown-width',`${pixels}px`);}
      }
      const pixels=Math.ceil(height);
      if(overlaySizes.get(entry.target)===pixels)continue;overlaySizes.set(entry.target,pixels);
      const property=entry.target===plot?'--plot-height':entry.target===manager?'--indicator-manager-height':entry.target===countdownBox?'--countdown-height':entry.target===readoutNode?'--readout-height':'--source-height';
      plot.style.setProperty(property,`${pixels}px`);
      if(entry.target===readoutNode||entry.target===sourceNode)offsetChanged=true;
    }
    if(offsetChanged)updateOverlayOffsets();
    if(geometryChanged)scheduleHudLayoutChange();
  });
  for(const node of [plot,manager,countdownBox,readoutNode,sourceNode])if(node)overlayResize.observe(node);

  const dialog=doc.createElement('dialog');dialog.id='indicator-library';dialog.className='indicator-library';dialog.setAttribute('aria-labelledby','indicator-library-title');dialog.setAttribute('aria-describedby','indicator-library-description indicator-readout-date');
  const dialogHeader=doc.createElement('header');dialogHeader.className='indicator-library-heading';
  const title=doc.createElement('h2');title.id='indicator-library-title';title.textContent='인디케이터';
  const close=makeButton('인디케이터 창 닫기','close',()=>dialog.close());dialogHeader.append(title,close);
  const description=doc.createElement('p');description.id='indicator-library-description';description.textContent='이름을 눌러 추가·삭제하고, 눈 아이콘으로 잠시 숨깁니다. 자주 쓰는 지표는 별표로 모아두세요.';
  const search=doc.createElement('input');search.type='search';search.id='indicator-search';search.placeholder='인디케이터 검색';search.setAttribute('aria-label','인디케이터 검색');search.autocomplete='off';
  const views=doc.createElement('div');views.className='indicator-library-views';views.setAttribute('role','group');views.setAttribute('aria-label','인디케이터 목록');
  for(const [id,label] of [['all','전체'],['added','추가됨'],['favorites','즐겨찾기'],['templates','템플릿']]){
    const b=doc.createElement('button');b.type='button';b.dataset.indicatorView=id;b.textContent=label;b.setAttribute('aria-pressed',String(id===view));
    b.onclick=()=>{view=id;category='전체';dialogKey='';paintDialog();};views.append(b);
  }
  const categories=doc.createElement('div');categories.className='indicator-categories';categories.setAttribute('role','group');categories.setAttribute('aria-label','인디케이터 분류');
  for(const name of ['전체','가격 지표','분석 창','표시']){const b=doc.createElement('button');b.type='button';b.textContent=name;b.setAttribute('aria-pressed',String(name===category));b.onclick=()=>{category=name;dialogKey='';paintDialog();};categories.append(b);}
  const results=doc.createElement('div');results.id='indicator-library-results';results.className='indicator-library-results';
  const resultCount=doc.createElement('p');resultCount.className='indicator-result-count';resultCount.setAttribute('role','status');resultCount.setAttribute('aria-live','polite');
  const templatePanel=doc.createElement('section');templatePanel.className='indicator-template-panel';templatePanel.hidden=true;templatePanel.setAttribute('aria-label','저장한 지표 조합');
  const templateForm=doc.createElement('form');templateForm.className='indicator-template-form';
  const templateLabel=doc.createElement('label');templateLabel.htmlFor='indicator-template-name';templateLabel.textContent='현재 지표 조합 저장';
  const templateName=doc.createElement('input');templateName.id='indicator-template-name';templateName.placeholder='예: 장기 사이클 분석';templateName.maxLength=MAX_TEMPLATE_NAME;templateName.autocomplete='off';templateName.required=true;
  const templateSave=doc.createElement('button');templateSave.type='submit';templateSave.textContent='저장';templateForm.append(templateLabel,templateName,templateSave);
  const templateNote=doc.createElement('p');templateNote.className='indicator-template-note';templateNote.textContent='이 브라우저에 최대 8개 저장합니다. 적용하면 지표 구성과 표시 여부만 바뀝니다. 가격 간격·기간·미래 가정은 유지됩니다.';
  const templateRows=doc.createElement('div');templateRows.className='indicator-template-list';templatePanel.append(templateForm,templateNote,templateRows);
  const preferenceStatus=doc.createElement('p');preferenceStatus.className='indicator-preference-status';preferenceStatus.setAttribute('role','status');preferenceStatus.setAttribute('aria-live','polite');preferenceStatus.hidden=true;
  const footer=doc.createElement('footer');
  const options=doc.createElement('div');options.className='indicator-library-options';
  const listOption=doc.createElement('label');listOption.className='indicator-list-option';
  const listVisible=doc.createElement('input');listVisible.type='checkbox';listVisible.id='indicator-list-visibility';listVisible.setAttribute('aria-controls','chart-indicator-list');
  listVisible.onchange=()=>{if(listVisible.checked!==!state.collapsed)command('collapse');};
  listOption.append(listVisible,doc.createTextNode('차트의 지표 이름·값 펼치기'));
  const all=doc.createElement('button');all.type='button';all.id='indicator-visibility-all';all.onclick=()=>command(chartIndicatorItems(state).some(item=>isIndicatorVisible(state,item.id))?'hide-all':'show-all');
  options.append(listOption,all);
  const help=doc.createElement('p');help.className='indicator-library-help';help.textContent='작은 화살표는 지표 이름과 값만 접습니다. 차트에 그린 지표는 유지되며, 눈 아이콘으로 지표를 숨길 수 있습니다. 일괄 숨김은 가격·OHLC, 출처, 차트 범례를 유지합니다.';
  footer.append(options,help);
  dialog.append(dialogHeader,description,views,search,categories,resultCount,results,templatePanel,preferenceStatus,footer);doc.body.append(dialog);
  templateName.addEventListener('input',()=>{templateSave.textContent=hasIndicatorTemplate(preferences,templateName.value)?'덮어쓰기':'저장';});
  templateForm.addEventListener('submit',event=>{
    event.preventDefault();const saved=saveIndicatorTemplate(preferences,templateName.value,state);
    if(saved.error){announcePreference(saved.error);templateName.focus();return;}
    persistPreferences(saved.preferences,`“${saved.template.name}” 지표 조합을 ${saved.replaced?'덮어썼습니다':'저장했습니다'}.`);
    templateName.value='';templateSave.textContent='저장';paintTemplateRows();templateName.focus();
  });

  function open(trigger){
    if(dialog.open)return;opener=trigger||doc.activeElement;search.value='';category='전체';dialogKey='';preferenceStatus.hidden=true;
    doc.dispatchEvent(new CustomEvent('atlas:modal-open',{detail:{id:dialog.id}}));
    dialog.showModal();paintDialog();(view==='templates'?templateName:search).focus();
    doc.querySelector('#atlas-mode-menu')?.setAttribute('aria-expanded','true');
  }
  function announcePreference(message){preferenceStatus.textContent=message;preferenceStatus.hidden=false;}
  function persistPreferences(next,message){
    preferences=next;const saved=writeIndicatorPreferences(preferences,storageProvider);
    announcePreference(saved?message:'브라우저에 저장할 수 없어 이번 탭에서만 유지됩니다.');dialogKey='';return saved;
  }
  function paintTemplateRows(){
    const focused=doc.activeElement?.closest?.('[data-template-name]')?.dataset.templateName,action=doc.activeElement?.dataset.templateAction;
    templateRows.replaceChildren();
    for(const template of preferences.templates){
      const row=doc.createElement('div');row.className='indicator-template-row';row.dataset.templateName=template.name;
      const apply=doc.createElement('button');apply.type='button';apply.className='indicator-template-apply';apply.dataset.templateAction='apply';
      const name=doc.createElement('strong');name.textContent=template.name;
      const detail=doc.createElement('small');const visible=template.state.added.length-template.state.hidden.length;
      detail.textContent=`${template.state.added.length}개 · ${visible}개 표시 · 이름·값 ${template.state.collapsed?'접힘':'펼침'}${template.state.minimized.length?` · 분석 창 ${template.state.minimized.length}개 접힘`:''}`;
      apply.append(name,detail);apply.setAttribute('aria-label',`${template.name} 지표 조합 적용`);
      apply.onclick=()=>{command('replace',null,{state:template.state});announcePreference(`“${template.name}” 지표 조합을 적용했습니다.`);};
      const remove=makeButton(`${template.name} 템플릿 삭제`,'close',()=>{persistPreferences(deleteIndicatorTemplate(preferences,template.name),`“${template.name}” 템플릿을 삭제했습니다.`);paintTemplateRows();templateSave.textContent=hasIndicatorTemplate(preferences,templateName.value)?'덮어쓰기':'저장';templateName.focus();});remove.className='indicator-library-eye';remove.dataset.templateAction='remove';row.append(apply,remove);templateRows.append(row);
    }
    if(!preferences.templates.length){const empty=doc.createElement('p');empty.className='indicator-empty';empty.textContent='저장한 조합이 없습니다. 현재 차트의 지표를 이름으로 저장해 다시 불러오세요.';templateRows.append(empty);}
    if(view==='templates')resultCount.textContent=`저장한 조합 ${preferences.templates.length}개 / 8개`;
    if(focused){const row=[...templateRows.children].find(node=>node.dataset.templateName===focused);(row?.querySelector(`[data-template-action="${action}"]`)||templateName).focus({preventScroll:true});}
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
  // Folded rows update too, so expanding never reveals a stale selected date.
  function scheduleReadouts(){if((!manager.hidden||dialog.open)&&!readoutFrame)readoutFrame=requestAnimationFrame(paintReadouts);}
  function paintList(){
    const focusedNode=doc.activeElement,focusedRow=focusedNode?.closest?.('[data-indicator-row]'),focused=focusedRow?.dataset.indicatorRow,action=focusedNode?.dataset.indicatorAction;
    const previousRows=[...list.children],focusedIndex=previousRows.indexOf(focusedRow),focusedInManager=manager.contains(focusedNode);
    const items=chartIndicatorItems(state);
    applyDisplay();manager.dataset.collapsed=String(state.collapsed);manager.hidden=!items.length;list.hidden=state.collapsed;readoutDate.hidden=state.collapsed;
    fold.hidden=!items.length;fold.setAttribute('aria-expanded',String(!state.collapsed));fold.innerHTML=glyph(state.collapsed?'expand':'collapse');fold.title=`지표 이름·값 ${state.collapsed?'펼치기':'접기'} · ${items.length}개`;fold.setAttribute('aria-label',fold.title);
    listVisible.checked=!state.collapsed;
    const hasVisible=items.some(item=>isIndicatorVisible(state,item.id));all.textContent=hasVisible?'지표 일괄 숨김':'지표 일괄 표시';all.disabled=!items.length;all.title=`가격·OHLC, 출처, 범례를 유지하고 지표를 ${hasVisible?'모두 숨기기':'모두 표시'}`;all.setAttribute('aria-label',all.title);
    const key=JSON.stringify([state.added,state.hidden,state.collapsed,intraday]);if(key===listKey){scheduleReadouts();return;}listKey=key;
    list.replaceChildren();readoutRows.clear();
    for(const item of items){
      const visible=isIndicatorVisible(state,item.id),unavailable=intraday&&item.dailyOnly,row=doc.createElement('div');row.className='indicator-row';row.dataset.indicatorRow=item.id;row.dataset.visible=String(visible);row.dataset.unavailable=String(Boolean(unavailable));
      row.setAttribute('role','listitem');
      const name=doc.createElement(item.analysis?'button':'div');name.className='indicator-name';
      const label=doc.createElement('span');label.className='indicator-label';label.textContent=LEGEND_LABELS[item.id]||item.label;label.title=item.label;
      const value=doc.createElement('strong');value.className='indicator-value';value.textContent='자료 대기';name.append(label,value);
      if(item.analysis){name.type='button';name.dataset.indicatorAction='inspect';name.title=`${item.label} 분석 창으로 이동`;name.onclick=()=>{if(!visible)command('visibility',item.id);if(state.minimized.includes(item.id))command('minimize',item.id);command('activate',item.id);const window=doc.getElementById(`analysis-window-${item.id}`);window?.scrollIntoView({block:'nearest',inline:'nearest'});window?.querySelector('svg')?.focus({preventScroll:true});};}
      if(unavailable)name.title=`${item.description} · 1D·1W에서 표시됩니다.`;
      const eye=makeButton(`${item.label} ${visible?'숨기기':'표시'}`,visible?'eye':'hidden',()=>command('visibility',item.id));eye.className='indicator-row-action';eye.dataset.indicatorAction='visibility';eye.setAttribute('aria-pressed',String(visible));
      const remove=makeButton(`${item.label} 삭제`,'close',()=>command('remove',item.id));remove.className='indicator-row-action';remove.dataset.indicatorAction='remove';
      row.append(name,eye,remove);list.append(row);readoutRows.set(item.id,{item,row,value,name});
    }
    if(focusedInManager){
      const shown=state.collapsed?[]:[...list.children],same=shown.find(row=>row.dataset.indicatorRow===focused),nearby=shown[Math.min(Math.max(focusedIndex,0),shown.length-1)];
      const fallback=dialog.open?search:doc.querySelector('#atlas-mode-menu')||(opener?.isConnected?opener:null);
      const rowTarget=same||nearby;
      const target=manager.hidden?fallback:state.collapsed||focusedNode===fold?fold:rowTarget?.querySelector(`[data-indicator-action="${action||'visibility'}"]`)||rowTarget?.querySelector('[data-indicator-action]')||(!fold.hidden?fold:fallback);
      target?.focus({preventScroll:true});
    }
    paintReadouts();
  }
  function paintDialog(){
    const key=JSON.stringify([state.added,state.hidden,state.primary,preferences.favorites,category,view,search.value,intraday]);if(key===dialogKey)return;dialogKey=key;
    for(const b of views.children)b.setAttribute('aria-pressed',String(b.dataset.indicatorView===view));
    const templates=view==='templates';search.hidden=templates;categories.hidden=templates||view!=='all';results.hidden=templates;templatePanel.hidden=!templates;
    if(templates){dialogReadoutRows.clear();paintTemplateRows();return;}
    for(const b of categories.children)b.setAttribute('aria-pressed',String(b.textContent===category));
    const focused=doc.activeElement?.closest?.('[data-library-indicator]')?.dataset.libraryIndicator,action=doc.activeElement?.dataset.libraryAction,items=indicatorLibraryItems({query:search.value,category,view,state,preferences});results.replaceChildren();dialogReadoutRows.clear();
    for(const item of items){
      const added=state.added.includes(item.id),visible=isIndicatorVisible(state,item.id),wrapper=doc.createElement('div');wrapper.className='indicator-library-row';wrapper.dataset.libraryIndicator=item.id;wrapper.dataset.added=String(added);wrapper.dataset.visible=String(visible);
      const favorite=preferences.favorites.includes(item.id),star=makeButton(`${item.label} 즐겨찾기 ${favorite?'해제':'추가'}`,'star',()=>{const next=toggleIndicatorFavorite(preferences,item.id);persistPreferences(next,`${item.label} 즐겨찾기를 ${next.favorites.includes(item.id)?'추가했습니다':'해제했습니다'}.`);paintDialog();});star.className='indicator-library-favorite';star.dataset.libraryAction='favorite';star.setAttribute('aria-pressed',String(favorite));wrapper.append(star);
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
    if(!items.length){const empty=doc.createElement('p');empty.className='indicator-empty';empty.textContent=search.value.trim()?'검색 결과가 없습니다. 다른 이름으로 검색해 보세요.':view==='favorites'?'별표를 눌러 자주 쓰는 지표를 모아두세요.':view==='added'?'차트에 추가한 지표가 없습니다. 전체 목록에서 추가하세요.':'이 분류에 지표가 없습니다.';results.append(empty);}
    if(focused)(results.querySelector(`[data-library-indicator="${focused}"] [data-library-action="${action}"]`)||results.querySelector(`[data-indicator-id="${focused}"]`)||search).focus({preventScroll:true});
    paintReadouts();
  }
  search.addEventListener('input',paintDialog);
  dialog.addEventListener('close',()=>{
    if(dialog.open)return;doc.querySelector('#atlas-mode-menu')?.setAttribute('aria-expanded','false');
    // Native close events can be queued after another modal takes focus.
    if(doc.querySelector('dialog[open]'))return;
    const visible=node=>node?.isConnected&&node.getClientRects().length;
    const mobile=doc.getElementById('mobile-details-toggle'),trigger=doc.getElementById('atlas-mode-menu');
    const target=visible(opener)?opener:visible(mobile)?mobile:visible(trigger)?trigger:plot.querySelector('svg:not([hidden])');
    target?.focus({preventScroll:true});
  });
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
  dialog.addEventListener('keydown',event=>{
    event.stopPropagation();if(event.key!=='Tab')return;
    const focusable=[...dialog.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')].filter(node=>!node.closest('[hidden]')&&node.tabIndex!==-1);
    const first=focusable[0],last=focusable.at(-1);
    if(event.shiftKey&&doc.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&doc.activeElement===last){event.preventDefault();first?.focus();}
  });
  const onOpen=event=>open(event.detail?.opener);
  const onState=event=>{state=normalizeIndicatorState(event.detail.indicators||state);cycle=event.detail.cycleCalibration||cycle;readoutContext.cycle=cycle;paintList();if(dialog.open)paintDialog();};
  const onWorkbench=event=>{
    intraday=Boolean(event.detail.intraday);countdown=event.detail.countdown||countdown;readoutContext.workbench=event.detail;paintCountdown();paintList();
    // A completed chart and its indicator values must share the same selection.
    // Ordinary pointer updates remain coalesced by onReadout below.
    paintReadouts();
    if(dialog.open)paintDialog();
  };
  const onReadout=event=>{readoutContext.selection=event.detail;scheduleReadouts();};
  const onAnalysis=event=>{const detail=event.detail;if(!detail?.mode)return;readoutContext.analyses.set(detail.mode,{...readoutContext.analyses.get(detail.mode),...detail});scheduleReadouts();};
  const onPreferences=event=>{if(event.key!==INDICATOR_PREFERENCES_KEY&&event.key!==null)return;preferences=readIndicatorPreferences(storageProvider);dialogKey='';if(dialog.open)paintDialog();templateSave.textContent=hasIndicatorTemplate(preferences,templateName.value)?'덮어쓰기':'저장';};
  doc.defaultView?.addEventListener('storage',onPreferences);
  doc.addEventListener('atlas:indicator-library',onOpen);doc.addEventListener('atlas:indicator-state',onState);doc.addEventListener('atlas:workbench-state',onWorkbench);doc.addEventListener('atlas:readout',onReadout);doc.addEventListener('atlas:analysis-state',onAnalysis);paintList();
  for(const name of ['wheel','pointerdown','dblclick','contextmenu'])manager.addEventListener(name,event=>event.stopPropagation(),name==='wheel'?{passive:true}:undefined);
  return {open,destroy(){doc.removeEventListener('atlas:indicator-library',onOpen);doc.removeEventListener('atlas:indicator-state',onState);doc.removeEventListener('atlas:workbench-state',onWorkbench);doc.removeEventListener('atlas:readout',onReadout);doc.removeEventListener('atlas:analysis-state',onAnalysis);doc.defaultView?.removeEventListener('storage',onPreferences);if(readoutFrame)cancelAnimationFrame(readoutFrame);if(hudLayoutFrame)cancelAnimationFrame(hudLayoutFrame);overlayResize.disconnect();dialog.remove();manager.remove();countdownBox.remove();}};
}
