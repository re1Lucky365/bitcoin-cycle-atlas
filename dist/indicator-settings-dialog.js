import {INDICATORS} from './indicator-state.js?v=1.13.0-research.1';
import {INDICATOR_SETTINGS,INDICATOR_SETTING_INTERVALS,indicatorSettings} from './indicator-settings.js?v=1.13.0-research.1';

/** An editor of only settings that the shipped graph actually consumes. */
export function mountIndicatorSettingsDialog({doc,getState,command}){
  const dialog=doc.createElement('dialog');dialog.id='indicator-settings';dialog.className='indicator-settings-dialog';dialog.setAttribute('aria-labelledby','indicator-settings-title');dialog.setAttribute('aria-describedby','indicator-settings-description');
  const header=doc.createElement('header'),title=doc.createElement('h2');title.id='indicator-settings-title';
  const close=doc.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','지표 설정 닫기');close.onclick=()=>dialog.close();header.append(title,close);
  const description=doc.createElement('p');description.id='indicator-settings-description';
  const content=doc.createElement('div');content.className='indicator-settings-content';
  const status=doc.createElement('p');status.className='indicator-settings-status';status.setAttribute('role','status');
  const footer=doc.createElement('footer'),reset=doc.createElement('button'),done=doc.createElement('button');reset.type=done.type='button';reset.textContent='이 지표 기본값';done.textContent='완료';done.onclick=()=>dialog.close();footer.append(reset,done);
  dialog.append(header,description,content,status,footer);doc.body.append(dialog);
  let id=null,opener=null,origin=null,fields=[];
  const fieldset=label=>{const set=doc.createElement('fieldset'),legend=doc.createElement('legend');legend.textContent=label;set.append(legend);content.append(set);return set;};
  const change=patch=>command('settings',id,{patch});
  function checkbox(parent,key,text){
    const label=doc.createElement('label'),input=doc.createElement('input');input.type='checkbox';input.dataset.setting=key;input.onchange=()=>change({[key]:input.checked});label.append(input,doc.createTextNode(text));parent.append(label);fields.push({key,input,set:value=>{input.checked=value;}});
  }
  function build(){
    const definition=INDICATOR_SETTINGS[id],item=INDICATORS.find(item=>item.id===id);content.replaceChildren();fields=[];
    title.textContent=`${item.label} 설정`;description.textContent=item.description;
    if(definition.inputs){
      const set=fieldset('입력 · 실제 분석 계산');
      for(const [key,inputDefinition] of Object.entries(definition.inputs)){
        const label=doc.createElement('label');label.className='indicator-setting-select';label.append(doc.createTextNode(inputDefinition.label));
        const input=doc.createElement('select');input.dataset.setting=`inputs.${key}`;input.setAttribute('aria-label',inputDefinition.label);
        for(const [value,text] of inputDefinition.options){const option=doc.createElement('option');option.value=value;option.textContent=text;input.append(option);}
        input.onchange=()=>change({inputs:{[key]:input.value}});label.append(input);set.append(label);fields.push({key:`inputs.${key}`,input,set:value=>{input.value=value;}});
      }
    }
    const display=fieldset('값과 눈금');checkbox(display,'values','지표 이름 옆에 선택한 값 표시');
    if(definition.axisLabels)checkbox(display,'axisLabels','이 지표의 축 숫자 표시');
    const note=doc.createElement('p');note.textContent='값을 꺼도 그래프와 계산은 유지됩니다. 가격·날짜, 자료 출처와 관측·가정 구분은 바꾸지 않습니다.';display.append(note);
    const styles=[['opacity','그래프 불투명도',.15,1,.05],['lineWidth','선 굵기 배율',.5,3,.25],['fillOpacity','채움 불투명도 배율',0,1,.05]].filter(([key])=>definition[key]);
    if(styles.length){
      const set=fieldset('스타일');
      for(const [key,labelText,min,max,step] of styles){
        const description=key==='lineWidth'&&id==='volume'?'가정 거래량선 굵기':key==='lineWidth'&&['turns','cycle-landmarks'].includes(id)?'원 테두리 굵기 배율':labelText;
        const label=doc.createElement('label');label.className='indicator-setting-range';const text=doc.createElement('span');text.textContent=description;
        const input=doc.createElement('input');input.type='range';input.min=String(min);input.max=String(max);input.step=String(step);input.dataset.setting=key;input.setAttribute('aria-label',description);
        const output=doc.createElement('output');const format=value=>key==='lineWidth'?`${Number(value)}×`:`${Math.round(Number(value)*100)}%`;
        input.oninput=()=>{output.textContent=format(input.value);input.setAttribute('aria-valuetext',output.textContent);};input.onchange=()=>change({[key]:Number(input.value)});
        label.append(text,input,output);set.append(label);fields.push({key,input,set:value=>{input.value=String(value);output.textContent=format(value);input.setAttribute('aria-valuetext',output.textContent);}});
      }
      const note=doc.createElement('p');note.textContent=`원래 색상과 관측 실선·잠정/가정 점선은 유지합니다. 배율 100% / 1×가 원래 표현입니다.${id==='volume'?' 선 굵기는 1D·1W의 미래 가정 거래량선에 적용됩니다.':''}`;set.append(note);
    }
    const intervals=fieldset('표시할 가격 간격');intervals.className='indicator-setting-intervals';
    for(const interval of INDICATOR_SETTING_INTERVALS.filter(item=>definition.intervals.includes(item.id))){
      const label=doc.createElement('label'),input=doc.createElement('input');input.type='checkbox';input.dataset.setting=`interval.${interval.id}`;
      input.onchange=()=>{const current=indicatorSettings(getState(),id).intervals;change({intervals:input.checked?[...current,interval.id]:current.filter(value=>value!==interval.id)});};
      label.append(input,doc.createTextNode(interval.label));intervals.append(label);fields.push({key:`interval.${interval.id}`,input,set:value=>{input.checked=value;}});
    }
    const intervalNote=doc.createElement('p');intervalNote.textContent='선택하지 않은 간격에서는 그래프만 자동으로 숨깁니다. 지표 추가 상태, 눈 아이콘과 값 표시 설정은 유지됩니다.';intervals.append(intervalNote);
  }
  function update(){
    if(!id||!dialog.open)return;const state=getState();
    if(!state.added.includes(id)){dialog.close();return;}
    const settings=indicatorSettings(state,id);
    for(const field of fields){const [group,key]=field.key.split('.');field.set(group==='inputs'?settings.inputs[key]:group==='interval'?settings.intervals.includes(key):settings[field.key]);}
    status.textContent=settings.intervals.length?'변경 내용은 즉시 반영됩니다. 작업공간·공유 링크·지표 템플릿을 저장할 때 함께 포함됩니다.':'표시할 간격이 없습니다. 간격을 선택하면 해당 그래프가 다시 나타납니다.';
  }
  function open(nextId,trigger){
    if(!INDICATOR_SETTINGS[nextId]||!getState().added.includes(nextId))return false;
    id=nextId;opener=trigger||doc.activeElement;origin=opener?.closest?.('[data-library-indicator]')?'library':opener?.closest?.('[data-indicator-row]')?'row':'analysis';build();
    doc.dispatchEvent(new CustomEvent('atlas:modal-open',{detail:{id:dialog.id}}));
    if(!dialog.open)dialog.showModal();update();(fields[0]?.input||done).focus();return true;
  }
  reset.onclick=()=>command('settings-reset',id);
  dialog.addEventListener('close',()=>{
    if(dialog.open)return;const visible=node=>node?.isConnected&&node.getClientRects().length;
    const selector=origin==='library'?`[data-library-indicator="${id}"] [data-library-action="settings"]`:origin==='row'?`[data-indicator-row="${id}"] [data-indicator-action="settings"]`:`#analysis-window-${id} [data-analysis-action="settings"]`;
    const replacement=doc.querySelector(selector),other=doc.querySelector('dialog[open]');
    const target=visible(opener)?opener:visible(replacement)?replacement:other?.id==='indicator-library'?doc.getElementById('indicator-search'):doc.getElementById('atlas-mode-menu');
    if(other&&!other.contains(target))return;target?.focus({preventScroll:true});
  });
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();});
  dialog.addEventListener('keydown',event=>{
    event.stopPropagation();if(event.key==='Escape'){event.preventDefault();dialog.close();return;}if(event.key!=='Tab')return;
    const controls=[...dialog.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled)')].filter(node=>!node.closest('[hidden]')),first=controls[0],last=controls.at(-1);
    if(event.shiftKey&&doc.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&doc.activeElement===last){event.preventDefault();first?.focus();}
  });
  const requested=event=>open(event.detail?.id,event.detail?.opener);doc.addEventListener('atlas:indicator-settings-open',requested);
  return {open,update,element:dialog,destroy(){doc.removeEventListener('atlas:indicator-settings-open',requested);dialog.remove();}};
}
