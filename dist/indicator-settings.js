import {CHART_INTERVALS} from './ohlc-data.js?v=1.11.0';

// These are presentation capabilities of existing graphs, not new calculations.
// Multipliers preserve the renderer's original observed/scenario styles.
const inputs=Object.freeze({
  cycles:{alignment:{label:'출발점 맞추기',default:'trough',options:[['trough','각 사이클의 저점'],['halving','각 반감기'],['calendar','달력의 4년 구간']]}},
  duration:{phase:{label:'비교할 흐름',default:'macro',options:[['macro','전체 상승·하락 기간'],['bull','상승장 안의 반복 흐름'],['bear','하락장 안의 반복 흐름']]}},
  periods:{period:{label:'집계 간격',default:'monthly',options:[['monthly','월별'],['quarterly','분기별']]},metric:{label:'비교할 값',default:'returnPct',options:[['returnPct','기간 수익률'],['maxDrawdownPct','기간 중 최대 하락'],['realizedVolPct','가격 흔들림 · 연간 환산'],['discoveryDays','새 최고가를 기록한 날']]},scope:{label:'집계 범위',default:'recent',options:[['recent','최근 구간'],['all','2010년부터 전체']]}},
  cryptocon:{view:{label:'검증 항목',default:'timing',options:[['timing','고점 전망과 수정'],['thresholds','고점권 조기 진입'],['targets','가격 목표와 결과']]}}
});
const allIntervals=CHART_INTERVALS.map(item=>item.id);
const dailyIntervals=['daily','weekly'];
const definitions={
  countdown:{dailyOnly:true},
  volume:{opacity:true,lineWidth:true,fillOpacity:true,axisLabels:true},
  history:{dailyOnly:true,opacity:true},
  range:{dailyOnly:true,opacity:true,fillOpacity:true},
  turns:{dailyOnly:true,opacity:true,lineWidth:true},
  'cycle-landmarks':{dailyOnly:true,opacity:true,lineWidth:true},
  'cycle-intervals':{dailyOnly:true,opacity:true,lineWidth:true},
  'cycle-timing':{dailyOnly:true,opacity:true,fillOpacity:true},
  drawdown:{dailyOnly:true,opacity:true,lineWidth:true,axisLabels:true},
  states:{dailyOnly:true,opacity:true,fillOpacity:true},
  fibonacci:{dailyOnly:true,opacity:true,lineWidth:true,axisLabels:true},
  cycles:{opacity:true,lineWidth:true,axisLabels:true,inputs:inputs.cycles},
  duration:{opacity:true,fillOpacity:true,axisLabels:true,inputs:inputs.duration},
  peaks:{opacity:true,lineWidth:true,axisLabels:true},
  periods:{opacity:true,fillOpacity:true,axisLabels:true,inputs:inputs.periods},
  cryptocon:{opacity:true,fillOpacity:true,axisLabels:true,inputs:inputs.cryptocon}
};
export const INDICATOR_SETTINGS=Object.freeze(Object.fromEntries(Object.entries(definitions).map(([id,value])=>[id,Object.freeze({...value,values:true,intervals:Object.freeze(value.dailyOnly?dailyIntervals.slice():allIntervals.slice())})])));
export const INDICATOR_SETTING_INTERVALS=CHART_INTERVALS;
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const round=value=>Math.round(value*100)/100;

export function normalizeIndicatorSettings(value={},added=Object.keys(INDICATOR_SETTINGS)){
  if(!object(value))return {};
  const result={};
  for(const id of added){
    const definition=INDICATOR_SETTINGS[id],raw=value[id];if(!definition||!object(raw))continue;
    const entry={};
    if(raw.values===false)entry.values=false;
    if(definition.axisLabels&&raw.axisLabels===false)entry.axisLabels=false;
    for(const [key,min,max] of [['opacity',.15,1],['lineWidth',.5,3],['fillOpacity',0,1]]){
      if(definition[key]&&typeof raw[key]==='number'&&Number.isFinite(raw[key])){
        const n=round(Math.min(max,Math.max(min,raw[key])));if(n!==1)entry[key]=n;
      }
    }
    if(Array.isArray(raw.intervals)){
      const selected=definition.intervals.filter(interval=>raw.intervals.includes(interval));
      if(selected.length!==definition.intervals.length)entry.intervals=selected;
    }
    if(definition.inputs&&object(raw.inputs)){
      const selected={};
      for(const [key,field] of Object.entries(definition.inputs))if(field.options.some(([value])=>value===raw.inputs[key]))selected[key]=raw.inputs[key];
      if(Object.keys(selected).length)entry.inputs=selected;
    }
    if(Object.keys(entry).length)result[id]=entry;
  }
  return result;
}

export function indicatorSettings(state,id){
  const definition=INDICATOR_SETTINGS[id];
  if(!definition)return {values:true,axisLabels:true,opacity:1,lineWidth:1,fillOpacity:1,intervals:allIntervals.slice(),inputs:{}};
  const saved=normalizeIndicatorSettings(state?.settings||{},[id])[id]||{};
  return {values:true,axisLabels:true,opacity:1,lineWidth:1,fillOpacity:1,intervals:definition.intervals.slice(),...saved,inputs:{...Object.fromEntries(Object.entries(definition.inputs||{}).map(([key,field])=>[key,field.default])),...saved.inputs}};
}

export function indicatorSupportsInterval(state,id,frequency){
  return !frequency||!INDICATOR_SETTINGS[id]||indicatorSettings(state,id).intervals.includes(frequency);
}

export function patchIndicatorSettings(state,id,patch){
  if(!INDICATOR_SETTINGS[id]||!object(patch))return state.settings||{};
  const current=state.settings?.[id]||{},next={...current,...patch};
  if(object(patch.inputs))next.inputs={...current.inputs,...patch.inputs};
  return normalizeIndicatorSettings({...state.settings,[id]:next},state.added);
}

// Only presentation attributes are touched; paths, dates, prices, dash patterns,
// colors and source labels remain the renderer's own output. WeakMap baselines
// prevent repeated calls from compounding a multiplier after a hover update.
const originals=new WeakMap();
function original(node,attribute){
  let values=originals.get(node);if(!values){values=new Map();originals.set(node,values);}
  if(!values.has(attribute))values.set(attribute,node.getAttribute(attribute));
  return values.get(attribute);
}
function multiply(node,attribute,factor,fallback=1){
  const baseline=original(node,attribute),parsed=Number(baseline),number=baseline!==null&&Number.isFinite(parsed)?parsed:fallback;
  if(factor===1){if(baseline===null)node.removeAttribute(attribute);else node.setAttribute(attribute,baseline);}
  else node.setAttribute(attribute,String(round(number*factor)));
}
function axisVisibility(node,visible){
  const baseline=original(node,'visibility'),aria=original(node,'aria-hidden');
  if(!visible){node.setAttribute('visibility','hidden');node.setAttribute('aria-hidden','true');}
  else{if(baseline===null)node.removeAttribute('visibility');else node.setAttribute('visibility',baseline);if(aria===null)node.removeAttribute('aria-hidden');else node.setAttribute('aria-hidden',aria);}
}

export function applyIndicatorPresentation(svg,state,frequency){
  if(!svg?.querySelectorAll)return;
  const layers=[...(svg.matches?.('[data-indicator-layer]')?[svg]:[]),...svg.querySelectorAll('[data-indicator-layer]')];
  for(const layer of layers){
    const id=layer.getAttribute('data-indicator-layer')||layer.dataset?.indicatorLayer,definition=INDICATOR_SETTINGS[id];if(!definition)continue;
    const settings=indicatorSettings(state,id);
    if(id==='cycle-landmarks')layer.style?.setProperty('--cycle-marker-line-scale',String(settings.lineWidth));
    if(definition.opacity)multiply(layer,'opacity',settings.opacity);
    if(definition.lineWidth){
      const selector=id==='cycle-landmarks'?'[data-indicator-line],.cycle-marker-ring':id==='cycle-intervals'?'[data-indicator-line],.cycle-interval-line':'[data-indicator-line]';
      for(const node of layer.querySelectorAll(selector))multiply(node,'stroke-width',settings.lineWidth);
      if(layer.matches?.('[data-indicator-line]'))multiply(layer,'stroke-width',settings.lineWidth);
    }
    if(definition.fillOpacity){for(const node of layer.querySelectorAll('[data-indicator-fill]'))multiply(node,'fill-opacity',settings.fillOpacity);if(layer.matches?.('[data-indicator-fill]'))multiply(layer,'fill-opacity',settings.fillOpacity);}
    if(definition.axisLabels)for(const node of layer.querySelectorAll('[data-indicator-axis-label]'))axisVisibility(node,settings.axisLabels);
    // Frequency filtering is also performed before layout. This makes detached
    // SVG exports and style-only updates obey the same settings immediately.
    const allowed=indicatorSupportsInterval(state,id,frequency);
    const display=original(layer,'display');if(!allowed)layer.setAttribute('display','none');else if(display===null)layer.removeAttribute('display');else layer.setAttribute('display',display);
  }
}
