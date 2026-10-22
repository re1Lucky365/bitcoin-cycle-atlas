import { INDICATORS, readIndicatorState, normalizeIndicatorState, isIndicatorVisible, searchIndicators } from './indicator-state.js?v=1.9.0';

const ICONS={eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',hidden:'<path d="m3 3 18 18M10 5a12 12 0 0 1 2 0c6.5 0 10 7 10 7a20 20 0 0 1-3 4M6 6a20 20 0 0 0-4 6s3.5 7 10 7a12 12 0 0 0 5-1"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',add:'<path d="M12 5v14M5 12h14"/>',chevron:'<path d="m6 9 6 6 6-6"/>'};
const glyph=name=>`<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;

export function countdownPresentation(value={}) {
  const upcoming=value.status==='upcoming',maintained=value.status==='maintained';
  const current=value.currentLabel?`현재 가정 ${value.currentLabel}${value.currentUntil?` · ${value.currentUntil.replaceAll('-','.')}까지${value.currentRightCensored?' 표시':''}`:''}`:'현재 국면 확인 불가';
  return {caption:`시나리오 기준 · ${value.minimumRunDays||7}일 유지 조건`,dday:upcoming?value.dday||'—':'—',next:upcoming?value.nextLabel||'전환 후보':maintained?'다음 후보 없음':'다음 후보 계산 불가',current};
}

export function mountIndicatorWorkbench({plot,stage}) {
  const doc=plot.ownerDocument;
  let state=readIndicatorState(location.search),category='전체',intraday=false,cycle=null,countdown=null,countdownKey='',listKey='',dialogKey='',opener=null;
  const command=(action,id)=>doc.dispatchEvent(new CustomEvent('atlas:indicator-command',{detail:{action,id}}));
  const makeButton=(label,icon,action)=>{const b=doc.createElement('button');b.type='button';b.title=label;b.setAttribute('aria-label',label);b.innerHTML=glyph(icon);b.onclick=action;return b;};
  const manager=doc.createElement('section');manager.id='chart-indicator-manager';manager.className='chart-indicator-manager';manager.setAttribute('aria-label','추가한 인디케이터');
  const header=doc.createElement('div');header.className='indicator-manager-heading';
  const collapse=makeButton('인디케이터 목록 접기','chevron',()=>command('collapse'));collapse.id='indicator-list-toggle';collapse.setAttribute('aria-controls','chart-indicator-list');
  const count=doc.createElement('span');count.id='indicator-count';
  const add=makeButton('인디케이터 추가·삭제','add',()=>open(add));add.id='indicator-add';add.setAttribute('aria-haspopup','dialog');
  const all=makeButton('추가한 인디케이터 모두 숨기기','eye',()=>command(state.added.some(id=>isIndicatorVisible(state,id))?'hide-all':'show-all'));all.id='indicator-visibility-all';
  header.append(collapse,count,all,add);
  const list=doc.createElement('div');list.id='chart-indicator-list';list.className='chart-indicator-list';
  manager.append(header,list);plot.append(manager);
  const countdownBox=doc.createElement('button');countdownBox.type='button';countdownBox.id='scenario-countdown';countdownBox.className='scenario-countdown';countdownBox.hidden=true;countdownBox.setAttribute('aria-label','다음 국면 D-day의 가정과 근거 보기');
  countdownBox.onclick=()=>doc.dispatchEvent(new CustomEvent('atlas:countdown-detail'));plot.append(countdownBox);
  // Observe only these small overlays, never the price path. A narrow plot can
  // stack the HUD beneath an expanded manager without a reserved chart header.
  const overlaySizes=new WeakMap(),overlayResize=new ResizeObserver(entries=>{
    for(const entry of entries){const height=Math.ceil(entry.borderBoxSize?.[0]?.blockSize??entry.contentRect.height+2);if(overlaySizes.get(entry.target)===height)continue;overlaySizes.set(entry.target,height);if(height>2)plot.style.setProperty(entry.target===manager?'--indicator-manager-height':'--countdown-height',`${height}px`);}
  });overlayResize.observe(manager);overlayResize.observe(countdownBox);

  const dialog=doc.createElement('dialog');dialog.id='indicator-library';dialog.className='indicator-library';dialog.setAttribute('aria-labelledby','indicator-library-title');dialog.setAttribute('aria-describedby','indicator-library-description');
  const dialogHeader=doc.createElement('header');dialogHeader.className='indicator-library-heading';
  const title=doc.createElement('h2');title.id='indicator-library-title';title.textContent='인디케이터';
  const close=makeButton('인디케이터 창 닫기','close',()=>dialog.close());dialogHeader.append(title,close);
  const description=doc.createElement('p');description.id='indicator-library-description';description.textContent='클릭하면 차트에 추가됩니다. 추가한 항목을 다시 클릭하면 삭제됩니다.';
  const search=doc.createElement('input');search.type='search';search.id='indicator-search';search.placeholder='인디케이터 검색';search.setAttribute('aria-label','인디케이터 검색');search.autocomplete='off';
  const categories=doc.createElement('div');categories.className='indicator-categories';categories.setAttribute('role','group');categories.setAttribute('aria-label','인디케이터 분류');
  for(const name of ['전체','가격 지표','분석 창','표시']){const b=doc.createElement('button');b.type='button';b.textContent=name;b.setAttribute('aria-pressed',String(name===category));b.onclick=()=>{category=name;dialogKey='';paintDialog();};categories.append(b);}
  const results=doc.createElement('div');results.id='indicator-library-results';results.className='indicator-library-results';
  const resultCount=doc.createElement('p');resultCount.className='indicator-result-count';resultCount.setAttribute('role','status');resultCount.setAttribute('aria-live','polite');
  const footer=doc.createElement('footer');footer.textContent='눈 아이콘은 표시만 바꿉니다. 분석은 가격 차트 안의 독립된 축을 사용합니다.';
  dialog.append(dialogHeader,description,search,categories,resultCount,results,footer);doc.body.append(dialog);

  function open(trigger){
    if(dialog.open)return;opener=trigger||doc.activeElement;search.value='';category='전체';dialogKey='';paintDialog();dialog.showModal();search.focus();
    doc.querySelector('#atlas-mode-menu')?.setAttribute('aria-expanded','true');
  }
  function applyDisplay(){
    for(const [id,selector] of [['readout','#lab-metrics'],['source','.workbench-market-info'],['legend','.lab-chart-foot']]){
      const node=plot.querySelector(selector);if(node)node.hidden=!isIndicatorVisible(state,id);
    }
    const top=(isIndicatorVisible(state,'readout')?43:0)+(isIndicatorVisible(state,'source')?24:0)+8;
    const indicatorTop=`${top}px`,sourceTop=`${isIndicatorVisible(state,'readout')?47:7}px`;
    if(plot.style.getPropertyValue('--indicator-top')!==indicatorTop)plot.style.setProperty('--indicator-top',indicatorTop);
    if(plot.style.getPropertyValue('--source-top')!==sourceTop)plot.style.setProperty('--source-top',sourceTop);
    countdownBox.hidden=!isIndicatorVisible(state,'countdown')||intraday||!countdown;
    plot.dataset.countdownVisible=String(!countdownBox.hidden);
  }
  function paintCountdown(){
    if(!countdown)return;const key=JSON.stringify([countdown.status,countdown.dday,countdown.nextLabel,countdown.currentLabel,countdown.holdDays,countdown.currentUntil,countdown.currentRightCensored,countdown.minimumRunDays,countdown.asOf,countdown.asOfAgeDays,countdown.note]);if(key===countdownKey)return;countdownKey=key;
    const presentation=countdownPresentation(countdown);
    const label=doc.createElement('span');label.className='countdown-caption';label.textContent=presentation.caption;
    const main=doc.createElement('strong');main.className='countdown-main';
    const dday=doc.createElement('b');dday.textContent=presentation.dday;const next=doc.createElement('span');next.textContent=presentation.next;main.append(dday,next);
    const current=doc.createElement('span');current.className='countdown-current';current.textContent=presentation.current;
    countdownBox.replaceChildren(label,main,current);countdownBox.title=`${countdown.note||'같은 미래 가격 경로에서 계산한 조건부 국면입니다.'}\n관측 ${countdown.asOf||'—'} UTC · ${countdown.asOfAgeDays??'—'}일 경과 · 클릭하여 가정 보기`;
    countdownBox.setAttribute('aria-label',`${label.textContent} · ${main.textContent} · ${current.textContent} · 가정과 근거 보기`);
  }
  function paintList(){
    applyDisplay();manager.dataset.collapsed=String(state.collapsed);list.hidden=state.collapsed;
    collapse.setAttribute('aria-expanded',String(!state.collapsed));collapse.title=state.collapsed?'인디케이터 목록 펼치기':'인디케이터 목록 접기';collapse.setAttribute('aria-label',collapse.title);
    count.textContent=`지표 ${state.added.length}`;const hasVisible=state.added.some(id=>isIndicatorVisible(state,id));all.innerHTML=glyph(hasVisible?'eye':'hidden');all.title=`추가한 인디케이터 모두 ${hasVisible?'숨기기':'표시'}`;all.setAttribute('aria-label',all.title);
    const key=JSON.stringify([state,intraday,cycle?.label,cycle?.shiftDays,cycle?.color]);if(key===listKey)return;listKey=key;
    const focused=doc.activeElement?.closest?.('[data-indicator-row]')?.dataset.indicatorRow,action=doc.activeElement?.dataset.indicatorAction;
    list.replaceChildren();
    for(const item of INDICATORS.filter(item=>state.added.includes(item.id))){
      const visible=isIndicatorVisible(state,item.id),unavailable=intraday&&item.dailyOnly,row=doc.createElement('div');row.className='indicator-row';row.dataset.indicatorRow=item.id;row.dataset.visible=String(visible);row.dataset.unavailable=String(Boolean(unavailable));
      const name=doc.createElement(item.analysis?'button':'span');name.className='indicator-name';name.textContent=item.label;
      if(item.analysis){name.type='button';name.title=`${item.label} 분석 창으로 이동`;name.onclick=()=>{if(!visible)command('visibility',item.id);command('activate',item.id);const window=doc.getElementById(`analysis-window-${item.id}`);window?.scrollIntoView({block:'nearest',inline:'nearest'});window?.querySelector('svg')?.focus({preventScroll:true});};}
      if(item.id==='cycle-timing'&&cycle){name.textContent=`사이클 시계 · ${cycle.label}`;name.style.color=cycle.color;name.title=`관측 기반 조건부 보정 · ${Number.isFinite(cycle.appliedShiftDays??cycle.shiftDays)?`${(cycle.appliedShiftDays??cycle.shiftDays)>0?'+':''}${Math.round(cycle.appliedShiftDays??cycle.shiftDays)}일`:'근거 대기'} · 색상은 매매 신호가 아닙니다.`;}
      if(unavailable)name.title=`${item.description} · 1D·1W에서 표시됩니다.`;
      const eye=makeButton(`${item.label} ${visible?'숨기기':'표시'}`,visible?'eye':'hidden',()=>command('visibility',item.id));eye.dataset.indicatorAction='visibility';eye.setAttribute('aria-pressed',String(visible));
      const remove=makeButton(`${item.label} 삭제`,'close',()=>command('remove',item.id));remove.dataset.indicatorAction='remove';
      row.append(name,eye,remove);list.append(row);
    }
    if(!state.added.length){const empty=doc.createElement('p');empty.className='indicator-empty';empty.textContent='추가한 지표가 없습니다.';list.append(empty);}
    if(focused&&action)(list.querySelector(`[data-indicator-row="${focused}"] [data-indicator-action="${action}"]`)||add).focus({preventScroll:true});
  }
  function paintDialog(){
    const key=JSON.stringify([state.added,state.hidden,category,search.value,intraday]);if(key===dialogKey)return;dialogKey=key;
    for(const b of categories.children)b.setAttribute('aria-pressed',String(b.textContent===category));
    const focused=doc.activeElement?.dataset.indicatorId,items=searchIndicators(search.value,category);results.replaceChildren();
    for(const item of items){
      const added=state.added.includes(item.id),row=doc.createElement('button');row.type='button';row.className='indicator-library-item';row.dataset.indicatorId=item.id;row.setAttribute('aria-pressed',String(added));row.setAttribute('aria-label',`${item.label} · ${added?'차트에서 삭제':'차트에 추가'}`);
      const text=doc.createElement('span'),name=doc.createElement('strong'),detail=doc.createElement('small');name.textContent=item.label;detail.textContent=`${item.description}${intraday&&item.dailyOnly?' · 1D·1W에서 표시':''}`;text.append(name,detail);
      const status=doc.createElement('span');status.className='indicator-library-status';status.textContent=added?(isIndicatorVisible(state,item.id)?'추가됨 ✓':'추가됨 · 숨김'):'+ 추가';
      row.append(text,status);row.onclick=()=>command('toggle',item.id);results.append(row);
    }
    resultCount.textContent=`${items.length}개 · 차트에 ${state.added.length}개 추가됨`;
    if(!items.length){const empty=doc.createElement('p');empty.className='indicator-empty';empty.textContent='검색 결과가 없습니다. 다른 이름으로 검색해 보세요.';results.append(empty);}
    if(focused)results.querySelector(`[data-indicator-id="${focused}"]`)?.focus({preventScroll:true});
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
  const onState=event=>{state=normalizeIndicatorState(event.detail.indicators||state);cycle=event.detail.cycleCalibration||cycle;paintList();if(dialog.open)paintDialog();};
  const onWorkbench=event=>{intraday=Boolean(event.detail.intraday);countdown=event.detail.countdown||countdown;paintCountdown();paintList();if(dialog.open)paintDialog();};
  doc.addEventListener('atlas:indicator-library',onOpen);doc.addEventListener('atlas:indicator-state',onState);doc.addEventListener('atlas:workbench-state',onWorkbench);paintList();
  for(const name of ['wheel','pointerdown','dblclick','contextmenu'])manager.addEventListener(name,event=>event.stopPropagation(),name==='wheel'?{passive:true}:undefined);
  return {open,destroy(){doc.removeEventListener('atlas:indicator-library',onOpen);doc.removeEventListener('atlas:indicator-state',onState);doc.removeEventListener('atlas:workbench-state',onWorkbench);overlayResize.disconnect();dialog.remove();manager.remove();countdownBox.remove();}};
}
