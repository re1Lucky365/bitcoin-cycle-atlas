import {normalizeResearchAnnotations,createResearchAnnotation,researchAnnotationSummary,RESEARCH_ANNOTATION_COLORS,MAX_RESEARCH_ANNOTATIONS} from './research-annotations.js?v=1.13.0-research.1';

/** Controlled editor: callers apply a single command to their own undoable state. */
export function mountResearchAnnotationsWorkbench({document:doc=globalThis.document,getState,getContext,onCommand}={}) {
  if(!doc||typeof getState!=='function'||typeof onCommand!=='function')throw new TypeError('Research annotation workbench requires document and state callbacks');
  const make=(tag,attrs={},text)=>{const node=doc.createElement(tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,String(value));if(text!==undefined)node.textContent=text;return node;};
  const dialog=make('dialog',{id:'research-annotations-dialog',class:'research-annotations-dialog','aria-labelledby':'research-annotations-title'}),header=make('header'),title=make('h2',{id:'research-annotations-title'},'저장한 연구 측정'),close=make('button',{type:'button','aria-label':'연구 측정 창 닫기'},'닫기');header.append(title,close);
  const introduction=make('p',{class:'research-annotations-help'},'완료한 두 점 측정을 이 브라우저에 저장합니다. 날짜는 UTC, 좌표 가격은 화면 단위와 관계없이 원 USD입니다. 저장 좌표는 가격 자료나 가정이 바뀌어도 자동으로 이동하지 않습니다.');
  const save=make('button',{type:'button',class:'research-annotation-save'},'현재 두 점 측정 저장'),status=make('p',{class:'research-annotations-status',role:'status','aria-live':'polite'}),list=make('div',{class:'research-annotations-list',role:'list','aria-label':'저장한 측정 목록'}),form=make('form',{class:'research-annotations-editor'});
  const fields={};
  function input(name,label,type='text',options={}){const wrapper=make('label',{},label),control=make(type==='textarea'?'textarea':'input',{name,id:`research-${name}`,...(type==='textarea'?{}:{type}),...options});wrapper.append(control);form.append(wrapper);fields[name]=control;return control;}
  input('label','이름','text',{maxlength:80,required:''});
  input('startDate','시작 날짜 · UTC','text',{required:'',placeholder:'2026-10-01 또는 2026-10-01T12:00:00Z'});
  input('startPrice','시작 가격 · 원 USD','number',{required:'',min:'0.000000000001',step:'any'});
  input('endDate','종료 날짜 · UTC','text',{required:'',placeholder:'2026-10-21 또는 2026-10-21T12:00:00Z'});
  input('endPrice','종료 가격 · 원 USD','number',{required:'',min:'0.000000000001',step:'any'});
  const colorLabel=make('label',{},'색상'),color=make('select',{name:'color',id:'research-color'});for(const [index,value]of RESEARCH_ANNOTATION_COLORS.entries())color.append(make('option',{value},['파랑','노랑','보라','민트','분홍'][index]));colorLabel.append(color);form.append(colorLabel);fields.color=color;
  input('note','연구 메모','textarea',{maxlength:1000,rows:3});
  const metadata=make('p',{class:'research-annotation-metadata'}),editNote=make('p',{class:'research-annotations-help'},'좌표를 직접 편집하면 사용자 좌표로 표시하며 원자료 봉 수는 다시 추정하지 않습니다. 원자료 출처와 저장 당시 가정은 함께 보존합니다.'),submit=make('button',{type:'submit'},'변경 저장');form.append(metadata,editNote,submit);
  const footer=make('p',{class:'research-annotations-help'},`최대 ${MAX_RESEARCH_ANNOTATIONS}개 · 숨김은 저장을 유지합니다. 잠금은 좌표·메모 편집과 삭제를 막습니다. 삭제는 작업 기록에서 되돌릴 수 있습니다.`);
  dialog.append(header,introduction,save,status,list,form,footer);doc.body.append(dialog);
  let opener=null,editingId=null,lastStateKey='';
  const announce=message=>{status.textContent=message;};
  function run(command,message){try{onCommand(command);lastStateKey='';refresh();if(message)announce(message);return true;}catch(error){announce(error.message||'연구 측정을 변경하지 못했습니다.');return false;}}
  function refresh(){
    const state=normalizeResearchAnnotations(getState()),key=JSON.stringify(state);if(key===lastStateKey&&dialog.open){updateSave();return;}lastStateKey=key;
    list.replaceChildren();
    if(!state.items.length)list.append(make('p',{class:'research-annotations-empty'},'아직 저장한 측정이 없습니다. 가격 차트의 측정 도구로 두 점을 선택한 뒤 저장하세요.'));
    for(const item of state.items){
      const row=make('div',{class:`research-annotation-row${item.id===state.selectedId?' is-selected':''}`,role:'listitem'}),select=make('button',{type:'button','data-research-select':item.id,'aria-pressed':String(item.id===state.selectedId)},item.label);
      select.style.setProperty('--annotation-color',item.color);select.onclick=()=>run({type:'select',id:item.id});
      const actions=make('div',{class:'research-annotation-actions'});
      for(const [type,label,pressed] of [['toggle-hidden',item.hidden?'표시':'숨김',item.hidden],['toggle-lock',item.locked?'잠금 해제':'잠금',item.locked],['delete','삭제',false]]){
        const button=make('button',{type:'button','aria-label':`${item.label} ${label}`,...(type==='delete'?{}:{'aria-pressed':String(pressed)})},label);button.disabled=type==='delete'&&item.locked;button.onclick=()=>run({type,id:item.id},type==='delete'?'연구 측정을 삭제했습니다.':null);actions.append(button);
      }
      const summary=researchAnnotationSummary(item),info=make('small',{},`${item.start.date} → ${item.end.date} UTC · ${summary.changePct>=0?'+':''}${summary.changePct.toFixed(2)}%${item.hidden?' · 숨김':''}${item.locked?' · 잠김':''}${summary.includesConditional?' · 가정 포함':''}`);row.append(select,actions,info);list.append(row);
    }
    const selected=state.items.find(item=>item.id===state.selectedId)||null;editingId=selected?.id||null;form.hidden=!selected;
    if(selected){for(const [key,value]of Object.entries({label:selected.label,startDate:selected.start.date,startPrice:selected.start.price,endDate:selected.end.date,endPrice:selected.end.price,color:selected.color,note:selected.note})){fields[key].value=String(value);fields[key].disabled=selected.locked;}submit.disabled=selected.locked;
      const summary=researchAnnotationSummary(selected),calendar=Number.isInteger(summary.deltaDays)?`${summary.deltaDays}일`:`${summary.deltaSeconds}초 (${summary.deltaDays.toFixed(4)}일)`;
      metadata.textContent=`달력 경과 ${calendar} · ${summary.loadedBars===null?'원자료 봉 수 계산 안 함':`저장 시 로드된 원자료 ${summary.loadedBars}봉`} · 시작 ${selected.start.source} (${selected.start.interval}, ${selected.start.basis==='market'?'실제 원자료 가격':'사용자 좌표'}) · 종료 ${selected.end.source} (${selected.end.interval}, ${selected.end.basis==='market'?'실제 원자료 가격':'사용자 좌표'})${selected.capture.scenarioLabel?` · 저장 가정 ${selected.capture.scenarioLabel}`:''}${selected.capture.revision?` · 자료 기준 ${selected.capture.revision}`:''}${selected.capture.coordinatesEdited?' · 좌표 편집됨':''}`;
    }
    updateSave();
  }
  function updateSave(){const measurement=getContext?.()?.measurement;save.disabled=!(measurement?.startDate&&measurement?.endDate&&Number.isFinite(measurement?.startPrice)&&Number.isFinite(measurement?.endPrice));}
  function saveMeasurement(){try{const context=getContext?.()||{},annotation=createResearchAnnotation(context.measurement,context);return run({type:'add',annotation},'두 점 측정과 원자료 출처를 저장했습니다.');}catch(error){announce(error.message);return false;}}
  save.onclick=saveMeasurement;close.onclick=()=>dialog.close();
  form.addEventListener('submit',event=>{event.preventDefault();if(!editingId)return;run({type:'update',id:editingId,patch:{label:fields.label.value,note:fields.note.value,color:fields.color.value,start:{date:fields.startDate.value.trim(),price:Number(fields.startPrice.value)},end:{date:fields.endDate.value.trim(),price:Number(fields.endPrice.value)}}},'연구 측정을 변경했습니다.');});
  dialog.addEventListener('keydown',event=>{event.stopPropagation();});
  dialog.addEventListener('close',()=>{if(opener?.isConnected!==false)opener?.focus?.();});
  function open(options={}){opener=options?.opener||((options?.focus&&options?.tagName)?options:null)||doc.activeElement;if(options?.id)run({type:'select',id:options.id});refresh();if(!dialog.open){const Event=doc.defaultView?.CustomEvent||globalThis.CustomEvent;if(Event)doc.dispatchEvent(new Event('atlas:modal-open',{detail:{id:dialog.id}}));dialog.showModal();}close.focus();}
  return {open,refresh,saveMeasurement,destroy(){dialog.remove();}};
}
