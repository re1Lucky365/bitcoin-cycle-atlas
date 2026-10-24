import { chartInterval, isIntradayInterval } from './ohlc-data.js?v=1.11.0';
import { parseGoToRequest } from './chart-view-policy.js?v=1.19.0';

const inputValue=(value,intraday)=>{
  if(value===null||value===undefined)return '';
  const milliseconds=typeof value==='number'?value*1000:Date.parse(value.length===10?`${value}T00:00:00Z`:value);
  return Number.isFinite(milliseconds)?new Date(milliseconds).toISOString().slice(0,intraday?16:10):'';
};

/** A UTC form controls only the requested view. Data loading remains with the app. */
export function mountChartGoTo({document=globalThis.document,onSubmit=()=>{},now=()=>Date.now()}={}){
  const dialog=document.createElement('dialog');dialog.className='chart-go-to-dialog';dialog.id='chart-go-to-dialog';
  dialog.setAttribute('aria-labelledby','chart-go-to-title');
  const form=document.createElement('form');form.noValidate=true;
  const heading=document.createElement('h2');heading.id='chart-go-to-title';heading.textContent='날짜·기간으로 이동';
  const note=document.createElement('p');note.textContent='모든 입력은 UTC입니다. 날짜를 이동해도 원본 가격과 수동 가격 범위는 유지됩니다.';
  const modeLabel=document.createElement('label');modeLabel.textContent='이동 방식';
  const mode=document.createElement('select');mode.setAttribute('aria-label','이동 방식');mode.name='mode';
  for(const [value,label] of [['point','날짜·시각'],['range','시작–끝 기간']]){const option=document.createElement('option');option.value=value;option.textContent=label;mode.append(option);}mode.value='point';modeLabel.append(mode);
  const fields=document.createElement('div');fields.className='chart-go-to-fields';
  const startLabel=document.createElement('label'),endLabel=document.createElement('label');
  const startText=document.createElement('span'),endText=document.createElement('span');
  const start=document.createElement('input'),end=document.createElement('input');start.name='start';end.name='end';
  for(const input of [start,end]){input.required=true;input.setAttribute('aria-describedby','chart-go-to-help chart-go-to-error');}
  startLabel.append(startText,start);endLabel.append(endText,end);fields.append(startLabel,endLabel);
  const help=document.createElement('p');help.id='chart-go-to-help';help.className='chart-go-to-help';
  const status=document.createElement('p');status.className='chart-go-to-status';status.setAttribute('role','status');
  const error=document.createElement('p');error.id='chart-go-to-error';error.className='chart-go-to-error';error.setAttribute('role','alert');error.hidden=true;
  const actions=document.createElement('div');actions.className='chart-go-to-actions';
  const cancel=document.createElement('button');cancel.type='button';cancel.textContent='취소';
  const submit=document.createElement('button');submit.type='submit';submit.textContent='이동';
  actions.append(cancel,submit);form.append(heading,note,modeLabel,fields,help,status,error,actions);dialog.append(form);document.body.append(dialog);
  let state={frequency:'daily'},opener=null,opened=false;
  const visible=()=>opened;
  function clearError(){error.hidden=true;error.textContent='';start.removeAttribute('aria-invalid');end.removeAttribute('aria-invalid');}
  function refreshMode(){const range=mode.value==='range';endLabel.hidden=!range;end.disabled=!range;startText.textContent=range?'시작 · UTC':'날짜·시각 · UTC';endText.textContent='끝 · UTC';clearError();}
  function refreshStatus(){
    const intraday=isIntradayInterval(state.frequency),interval=chartInterval(state.frequency);
    help.textContent=intraday?`${interval.label} 봉 시작 시각으로 입력합니다. 최대 6,000봉이며 미완료 봉은 선택할 수 없습니다.`:'일 단위로 입력합니다. 관측 이후는 선택한 미래 가정이 있는 날짜에만 표시됩니다.';
    const loaded=state.loadedStart&&state.loadedEnd?`불러온 자료 · ${inputValue(state.loadedStart,intraday).replace('T',' ')} – ${inputValue(state.loadedEnd,intraday).replace('T',' ')} UTC`:'자료를 불러오면 실제 조회 범위를 확인할 수 있습니다.';
    status.textContent=state.marketHistoryStatus==='loading'?`과거 자료 조회 중 · ${loaded}`:state.marketHistoryStatus==='error'?`과거 자료 조회 실패 · ${state.marketError||'다시 조회할 수 있습니다.'}`:loaded;
  }
  function prepare(){
    const intraday=isIntradayInterval(state.frequency),interval=chartInterval(state.frequency);
    for(const input of [start,end]){input.type=intraday?'datetime-local':'date';input.min=intraday?'1800-01-01T00:00':'1800-01-01';input.max=intraday?'2400-12-31T23:59':'2400-12-31';input.step=String(intraday?interval.seconds:1);}
    const selected=intraday?state.selectedTime:state.selectedDate;
    const center=intraday&&Number.isFinite(state.start)&&Number.isFinite(state.end)?Math.floor((state.start+state.end)/2/interval.seconds)*interval.seconds:state.asOf||state.start;
    start.value=inputValue(mode.value==='range'?state.start:selected??center,intraday);end.value=inputValue(state.end,intraday);
    refreshMode();refreshStatus();
  }
  function restoreFocus(){const target=opener;opener=null;if(target&&!target.hidden&&!target.disabled&&target.isConnected!==false)target.focus({preventScroll:true});}
  function close(){if(!opened)return;opened=false;if(typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open');restoreFocus();}
  function open(trigger){if(opened){start.focus({preventScroll:true});return;}opener=trigger||document.activeElement;prepare();opened=true;const ModalEvent=document.defaultView?.CustomEvent||globalThis.CustomEvent;if(ModalEvent)document.dispatchEvent?.(new ModalEvent('atlas:modal-open',{detail:{id:dialog.id}}));if(typeof dialog.showModal==='function')dialog.showModal();else{dialog.setAttribute('open','');dialog.setAttribute('aria-modal','true');}start.focus({preventScroll:true});}
  mode.onchange=()=>{refreshMode();if(mode.value==='range'){const intraday=isIntradayInterval(state.frequency);start.value=inputValue(state.start,intraday);end.value=inputValue(state.end,intraday);}};
  start.oninput=end.oninput=clearError;cancel.onclick=close;
  form.onsubmit=event=>{
    event.preventDefault();clearError();
    const result=parseGoToRequest({frequency:state.frequency,mode:mode.value,start:start.value,end:end.value,currentRange:{start:state.start,end:state.end},loadedStart:state.loadedStart,loadedEnd:state.loadedEnd,now:now()});
    if(!result.ok){error.textContent=result.message;error.hidden=false;start.setAttribute('aria-invalid','true');if(mode.value==='range')end.setAttribute('aria-invalid','true');return;}
    onSubmit(result);close();
  };
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  dialog.addEventListener('close',()=>{if(opened){opened=false;restoreFocus();}});
  dialog.addEventListener('keydown',event=>{
    event.stopPropagation();
    if(event.key==='Escape'){event.preventDefault();close();return;}
    if(event.key!=='Tab')return;
    const controls=[mode,start,...(mode.value==='range'?[end]:[]),cancel,submit],index=controls.indexOf(document.activeElement);
    if(event.shiftKey&&(index<=0)){event.preventDefault();controls.at(-1).focus();}
    else if(!event.shiftKey&&(index<0||index===controls.length-1)){event.preventDefault();controls[0].focus();}
  });
  return {open,close,isOpen:visible,update(value){const changed=value.frequency!==state.frequency;state={...value};if(opened){if(changed)prepare();else refreshStatus();}},destroy(){close();dialog.remove();}};
}
