import { CHART_INTERVALS } from './ohlc-data.js?v=1.11.0';
import { mountDialogViewport } from './dialog-viewport.js?v=1.14.0-mobile.1';
import { readWorkspaces, saveWorkspace, writeWorkspaces, cleanWorkspaceQuery, workspaceQuery, readWorkspaceViewport, readWorkspacePriceDomain, searchWorkspaceCommands } from './workspace-state.js?v=1.14.0-mobile.1';

/** All actions delegate to the live chart, so the palette is another entrance to the same state. */
export function mountWorkspaceTools({trigger, plot, openReader, closeReader}) {
  const doc=trigger.ownerDocument,win=doc.defaultView;
  const make=(tag,className,text)=>{const node=doc.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
  const button=(text,handler)=>{const node=make('button','',text);node.type='button';node.onclick=handler;return node;};
  const dispatch=(action,value)=>doc.dispatchEvent(new win.CustomEvent('atlas:chart-command',{detail:{action,value}}));
  let storage;try{storage=win.localStorage;}catch{}
  let saved=readWorkspaces(storage),latest=null,opener=null,tab='commands',restoreAfterClose=true;
  const dialog=make('dialog','workspace-dialog');dialog.id='workspace-dialog';dialog.setAttribute('aria-labelledby','workspace-dialog-title');
  const header=make('header','workspace-dialog-header'),title=make('h2','','작업 화면');title.id='workspace-dialog-title';
  const closeButton=button('×',()=>close());closeButton.setAttribute('aria-label','작업 화면 닫기');header.append(title,closeButton);
  const tabs=make('div','workspace-dialog-tabs');tabs.setAttribute('role','group');tabs.setAttribute('aria-label','작업 화면 기능');
  const commandsTab=button('빠른 검색',()=>selectTab('commands')),savedTab=button('저장·공유',()=>selectTab('saved'));tabs.append(commandsTab,savedTab);
  const commandsPane=make('section','workspace-command-pane'),search=make('input','workspace-command-search');search.type='search';search.placeholder='도구·지표·간격 검색';search.setAttribute('aria-label','차트 명령 검색');search.autocomplete='off';
  const results=make('div','workspace-command-results');results.setAttribute('role','list');results.setAttribute('aria-label','차트 명령');
  const hint=make('p','workspace-hint','↑↓ 결과 이동 · Enter 실행 · Esc 닫기 · Ctrl/⌘ K');commandsPane.append(search,results,hint);
  const savedPane=make('section','workspace-saved-pane'),summary=make('p','workspace-current');
  const scope=make('p','workspace-hint','날짜 범위·간격·가격 눈금·가정·지표 설정·분석 창 배치를 저장합니다. 연구 측정은 별도 브라우저 저장소에 남고 공유 링크에는 포함되지 않습니다. 실행 취소 기록은 현재 탭 세션에만 남습니다. 자료는 열 때 갱신됩니다.');
  const form=make('form','workspace-save-form'),name=make('input');name.type='text';name.maxLength=40;name.placeholder='예: 주봉 장기 비교';name.setAttribute('aria-label','작업 화면 이름');name.autocomplete='off';
  const save=button('현재 화면 저장');save.type='submit';form.append(name,save);
  const list=make('div','workspace-saved-list');list.setAttribute('aria-label','저장한 작업 화면');
  const shareTitle=make('h3','','현재 화면 링크'),shareRow=make('div','workspace-share-row'),link=make('input');link.type='text';link.readOnly=true;link.setAttribute('aria-label','현재 작업 화면 공유 링크');
  const copy=button('링크 복사',async()=>{
    updateLink();if(!link.value)return;
    try{await win.navigator.clipboard.writeText(link.value);status.textContent='현재 화면 링크를 복사했습니다.';}
    catch{link.focus();link.select();status.textContent='링크를 선택했습니다. 복사하여 공유해 주세요.';}
  });shareRow.append(link,copy);
  const localNote=make('p','workspace-hint','저장 목록은 이 브라우저에만 남습니다. 다른 기기에서는 공유 링크를 사용하세요.');savedPane.append(summary,scope,form,list,shareTitle,shareRow,localNote);
  const status=make('p','workspace-feedback');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  dialog.append(header,tabs,commandsPane,savedPane,status);doc.body.append(dialog);
  const dialogViewport=mountDialogViewport(dialog);
  const toast=make('div','workspace-toast');toast.hidden=true;toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');doc.body.append(toast);let toastTimer;
  const onFeedback=event=>{toast.textContent=String(event.detail?.message || '');toast.hidden=!toast.textContent;win.clearTimeout(toastTimer);toastTimer=win.setTimeout(()=>{toast.hidden=true;},7000);};
  trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-controls',dialog.id);trigger.setAttribute('aria-expanded','false');
  trigger.setAttribute('aria-keyshortcuts','Control+K Meta+K');
  // Style/pane changes update the URL without rebuilding the price chart.
  // Merge those latest settings with the last rendered, exact viewport.
  const query=()=>{if(latest?.shareQuery===undefined)return null;const params=new URLSearchParams(win.location.search);return workspaceQuery(params,{frequency:latest.frequency,unit:readWorkspaceViewport(params).unit,priceDomain:readWorkspacePriceDomain(params),range:{start:latest.start,end:latest.end}});};
  function updateLink(){
    const value=query(),publicPage=/^https?:$/.test(win.location.protocol);
    link.value=value===null||!publicPage?'':`${win.location.origin}${win.location.pathname}${value?'?'+value:''}`;
    copy.disabled=!link.value;save.disabled=value===null;
    if(!publicPage)link.placeholder='단독 HTML은 링크 공유를 지원하지 않습니다.';
  }
  function renderSaved(){
    list.replaceChildren();
    if(!saved.length)list.append(make('p','workspace-empty','저장한 작업 화면이 없습니다. 현재 구성을 이름으로 보관하세요.'));
    for(const item of saved){
      const row=make('div','workspace-saved-row'),load=button(item.name,()=>{
        // Only whitelisted query parameters can be restored, always on this exact page.
        win.location.assign(`${win.location.pathname}?${cleanWorkspaceQuery(item.query)}`);
      });load.className='workspace-load';load.title=`${item.name} 불러오기`;load.setAttribute('aria-label',`${item.name} 불러오기`);
      const replace=button('덮어쓰기',()=>persist(item.name,true));replace.setAttribute('aria-label',`${item.name}에 현재 화면 덮어쓰기`);replace.disabled=query()===null;
      const remove=button('삭제',()=>{const result=writeWorkspaces(storage,saved.filter(value=>value.name!==item.name));if(result.ok){saved=result.items;renderSaved();status.textContent=`${item.name}을 삭제했습니다.`;name.focus();}else status.textContent=result.error;});remove.setAttribute('aria-label',`${item.name} 저장 삭제`);row.append(load,replace,remove);list.append(row);
    }
    summary.textContent=latest?`BTCUSD · ${latest.intervalLabel || '1D'} · ${latest.scale==='linear'?'선형':'로그'} · ${latest.display?.label||'USD'}${latest.invertScale?' · 가격축 반전':''}`:'차트 자료를 불러오는 중입니다.';
    updateLink();
  }
  function persist(label,overwrite=false){
    const value=query();if(value===null){status.textContent='차트가 준비되면 저장할 수 있습니다.';return;}
    const result=saveWorkspace(storage,saved,{name:label,query:value},{overwrite});
    if(result.ok){saved=result.items;name.value='';renderSaved();status.textContent=overwrite?'현재 구성으로 덮어썼습니다.':'작업 화면을 저장했습니다.';name.focus();}else status.textContent=result.error;
  }
  form.onsubmit=event=>{event.preventDefault();persist(name.value);};
  function close(restore=true){restoreAfterClose=restore;if(dialog.open)dialog.close();}
  function selectTab(value,{focusInput=true}={}){
    tab=value;commandsPane.hidden=value!=='commands';savedPane.hidden=value!=='saved';commandsTab.setAttribute('aria-pressed',String(value==='commands'));savedTab.setAttribute('aria-pressed',String(value==='saved'));
    status.textContent='';if(value==='commands'){paintCommands();if(focusInput)search.focus();}else{renderSaved();if(focusInput)name.focus();}
  }
  function open(value='commands',source=trigger){
    opener=source;closeReader({restoreFocus:false});
    doc.dispatchEvent(new win.CustomEvent('atlas:modal-open',{detail:{id:dialog.id}}));
    if(!dialog.open)dialog.showModal();trigger.setAttribute('aria-expanded','true');search.value='';
    const compact=Boolean(win.matchMedia?.('(max-width:620px), (max-height:500px)').matches);
    selectTab(value,{focusInput:!compact});if(compact)closeButton.focus({preventScroll:true});
  }
  function run(item){close(false);plot.querySelector('svg:not([hidden])')?.focus({preventScroll:true});item.run();}
  function commands(){
    const intraday=Boolean(latest?.intraday),available=Boolean(latest?.navigationAvailable);
    const reader=kind=>()=>openReader(kind,{focus:true,opener:trigger});
    return [
      {label:'실행 취소',description:latest?.history?.undoLabel||'현재 탭의 명시적 차트 변경',keywords:'undo 취소',key:'Ctrl/⌘ Z',disabled:!latest?.history?.canUndo,run:()=>dispatch('undo')},
      {label:'다시 실행',description:latest?.history?.redoLabel||'취소한 차트 변경 복원',keywords:'redo',key:'Ctrl/⌘ Shift Z',disabled:!latest?.history?.canRedo,run:()=>dispatch('redo')},
      {label:'저장한 연구 측정',description:'좌표·메모·출처 · 잠금·숨김·삭제',keywords:'drawing annotation object 연구 주석',run:()=>dispatch('annotations')},
      {label:'현재 두 점 측정 저장',description:'UTC 날짜와 원 USD 가격을 고정해 보관',keywords:'measure save',disabled:!latest?.measurement?.endDate,run:()=>dispatch('save-measurement')},
      ...[['usd','달러 가격'],['indexed','최근 관측 = 100'],['percent','표시 시작 대비 %'],['indexed-start','표시 시작 = 100']].map(([value,label])=>({label,description:'가격 표시 단위 · 원 USD 자료 유지',keywords:'price unit percent indexed',run:()=>dispatch('unit',value)})),
      {label:'지표 추가·즐겨찾기·템플릿',description:'가격 지표와 분석 창 관리',keywords:'indicator volume 거래량',run:()=>doc.dispatchEvent(new win.CustomEvent('atlas:indicator-library',{detail:{opener:trigger}}))},
      {label:'작업 화면 저장·공유',description:'이름으로 저장하고 같은 범위를 링크로 공유',keywords:'layout save share 저장 불러오기',run:()=>open('saved',trigger)},
      ...[['crosshair','십자선','C'],['pan','차트 이동','H'],['measure','두 지점 측정','M']].map(([value,label,key])=>({label,description:'차트 도구',key,run:()=>dispatch('tool',value)})),
      {label:'기본 범위로 돌아가기',description:'확대·이동 초기화',keywords:'reset fit',key:'Alt R',run:()=>dispatch('fit')},
      {label:'로그·선형 눈금 전환',description:latest?.scale==='linear'?'현재 선형 · 로그로 변경':'현재 로그 · 선형으로 변경',keywords:'scale log axis',key:'Alt L',run:()=>dispatch('scale')},
      ...CHART_INTERVALS.map(item=>({label:`${item.label} 간격`,description:item.seconds<86400?'거래소의 실제 완료 봉':'장기 관측과 미래 가정',keywords:`interval timeframe ${item.id}`,run:()=>dispatch('frequency',item.id)})),
      ...[['line','선 차트'],['candles','캔들 차트']].map(([value,label])=>({label,description:'가격 표시 방식',keywords:'chart type',run:()=>dispatch('chart-type',value)})),
      ...[['focus','기본 4년'],['near','가까운 6개월'],['all','장기 전망'],['history','전체 역사']].map(([value,label])=>({label,description:'차트 표시 기간',hidden:intraday,run:()=>dispatch('span',value)})),
      {label:'차트 설정',description:'가격 단위와 분석 기준',keywords:'settings unit indexed',run:reader('settings')},
      {label:'차트 레이어',description:'가격 위에 표시할 정보',run:reader('layers')},
      {label:'미래 가정 선택',description:'수요·채택 시나리오',hidden:intraday,run:reader('scenarios')},
      {label:'선택 데이터',description:'실제 관측값과 출처 확인',run:reader('selection')},
      {label:'날짜로 이동',description:'UTC 날짜·시각 또는 시작·끝 범위 지정',key:'Alt G',run:()=>doc.getElementById('workbench-go-date')?.click()},
      {label:'모델과 검증',description:'계산식과 자료의 한계',run:reader('math')},
      {label:'차트 PNG 저장',description:'현재 주 가격 차트 · 가격축·가정·출처 포함',keywords:'image snapshot export download 사진 이미지',run:()=>dispatch('export-png')},
      {label:'가격 + 연구 창 이미지 저장',description:'보이는 분석 창의 순서·개별 축과 출처 포함',keywords:'workspace snapshot export',run:()=>dispatch('export-workspace')},
      {label:'가격축 뒤집기',description:latest?.invertScale?'현재 반전 · 기본 방향으로':'가격축 위아래 방향 전환',keywords:'invert price scale',run:()=>dispatch('invert-scale')},
      {label:'가격 자료만 자동 맞춤',description:'보조 레이어를 제외한 가격·캔들 기준',keywords:'price only auto scale',run:()=>dispatch('price-only-auto')},
      {label:'차트 SVG 저장',description:'편집 가능한 벡터 이미지 · 가격축·가정·출처 포함',keywords:'image vector export download',run:()=>dispatch('export-svg')},
      {label:'가격축 자동 맞춤',description:latest?.priceAxisMode==='manual'?'현재 수동 · 표시 자료에 다시 맞춤':'현재 자동 · 현재 가격 범위 고정',keywords:'price axis auto scale reset',run:()=>dispatch('auto-scale')},
      {label:'원자료·가정·연구 CSV',description:'자료별 출처·범위·원 단위를 미리 확인하고 따로 저장',keywords:'csv export data download 데이터 내보내기',disabled:!available,run:()=>dispatch('export-csv')},
      {label:'거래소 자료 새로 조회',description:'실제 완료 봉·거래량 갱신',keywords:'refresh',run:()=>dispatch('refresh-market')},
      {label:doc.fullscreenElement?'전체 화면 끝내기':'전체 화면',description:'차트 작업 공간 확대',keywords:'fullscreen',hidden:!doc.fullscreenEnabled,run:async()=>{try{if(doc.fullscreenElement)await doc.exitFullscreen();else await doc.documentElement.requestFullscreen();}catch{const announcement=doc.getElementById('workbench-announcement');if(announcement)announcement.textContent='이 브라우저에서 전체 화면을 열 수 없습니다.';}}},
      {label:'단축키와 차트 사용법',description:'이동·선택·측정 도움말',keywords:'help shortcuts',key:'?',run:reader('guide')},
    ];
  }
  function paintCommands(){
    const found=searchWorkspaceCommands(commands(),search.value);results.replaceChildren();
    if(!found.length){results.append(make('p','workspace-empty','일치하는 기능이 없습니다. “지표”, “저장”, “1h”처럼 검색해 보세요.'));return;}
    for(const item of found){const wrapper=make('div');wrapper.setAttribute('role','listitem');const row=button('',()=>run(item));row.className='workspace-command';row.disabled=Boolean(item.disabled);const text=make('span'),label=make('strong','',item.label),description=make('small','',item.description);text.append(label,description);row.append(text);if(item.key)row.append(make('kbd','',item.key));wrapper.append(row);results.append(wrapper);}
  }
  search.oninput=paintCommands;
  dialog.addEventListener('keydown',event=>{
    event.stopPropagation();
    if(event.key==='Escape'){event.preventDefault();close();return;}
    if(tab==='commands'&&['ArrowDown','ArrowUp','Enter'].includes(event.key)){
      const nodes=[...results.querySelectorAll('button:not(:disabled)')],index=nodes.indexOf(doc.activeElement);
      if(event.key==='Enter'&&doc.activeElement!==search)return;
      if(event.key==='Enter'){if(nodes.length){event.preventDefault();nodes[0].click();}return;}
      if(doc.activeElement===search||index>=0){event.preventDefault();const next=index<0?(event.key==='ArrowDown'?0:nodes.length-1):(index+(event.key==='ArrowDown'?1:-1)+nodes.length)%nodes.length;nodes[next]?.focus();}
    }
    if(event.key==='Tab'){
      const nodes=[...dialog.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]')].filter(node=>!node.closest('[hidden]'));
      const first=nodes[0],last=nodes.at(-1);if(event.shiftKey&&doc.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&doc.activeElement===last){event.preventDefault();first?.focus();}
    }
  });
  dialog.addEventListener('close',()=>{if(dialog.open)return;trigger.setAttribute('aria-expanded','false');if(!restoreAfterClose){restoreAfterClose=true;return;}const target=opener?.isConnected&&opener.getClientRects().length?opener:doc.getElementById('mobile-details-toggle')?.getClientRects().length?doc.getElementById('mobile-details-toggle'):plot.querySelector('svg:not([hidden])');target?.focus({preventScroll:true});});
  trigger.onclick=()=>open();
  const onKey=event=>{if(event.defaultPrevented||doc.body.dataset.page!=='outlook'||event.altKey||event.shiftKey||!(event.ctrlKey||event.metaKey)||event.key.toLowerCase()!=='k'||event.target.closest?.('input,textarea,select,[contenteditable=true],dialog[open]'))return;event.preventDefault();open('commands',doc.activeElement);};
  const onState=event=>{latest=event.detail;if(dialog.open&&tab==='saved')renderSaved();};
  const onHistory=event=>{if(latest)latest={...latest,history:event.detail};if(dialog.open&&tab==='commands')paintCommands();};
  const onOpen=event=>open(event.detail?.tab==='saved'?'saved':'commands',event.detail?.opener||doc.activeElement);
  doc.addEventListener('atlas:workspace-open',onOpen);
  doc.addEventListener('atlas:history-state',onHistory);
  doc.addEventListener('keydown',onKey);doc.addEventListener('atlas:workbench-state',onState);doc.addEventListener('atlas:action-feedback',onFeedback);
  return {destroy(){dialogViewport.destroy();doc.removeEventListener('atlas:workspace-open',onOpen);doc.removeEventListener('atlas:history-state',onHistory);doc.removeEventListener('keydown',onKey);doc.removeEventListener('atlas:workbench-state',onState);doc.removeEventListener('atlas:action-feedback',onFeedback);win.clearTimeout(toastTimer);dialog.remove();toast.remove();}};
}
