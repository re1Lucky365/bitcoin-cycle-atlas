/** Saved research coordinates are immutable market snapshots, never resampled pixels. */
export const RESEARCH_ANNOTATIONS_KEY = 'bitcoin-cycle-atlas.research-annotations.v1';
export const MAX_RESEARCH_ANNOTATIONS = 100;
export const RESEARCH_ANNOTATION_COLORS = Object.freeze(['#84bfff','#f4c76b','#d7a1f9','#77d4b1','#f29da6']);
const positive = value => typeof value === 'number' && Number.isFinite(value) && value > 0;
const text = (value,limit) => typeof value === 'string' ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/gu,'').slice(0,limit) : '';
const escape = value => String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const timestamp = value => typeof value === 'number' ? value*1000 : Date.parse(value);

/** Keep daily UTC dates as dates and intraday coordinates as UTC ISO timestamps. */
export function researchCoordinateDate(value) {
  if(typeof value === 'number')return Number.isSafeInteger(value)&&value>0&&Number.isFinite(new Date(value*1000).getTime())?new Date(value*1000).toISOString():null;
  if(typeof value !== 'string')return null;
  if(/^\d{4}-\d{2}-\d{2}$/u.test(value))return Number.isFinite(Date.parse(value))&&new Date(Date.parse(value)).toISOString().slice(0,10)===value?value:null;
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?Z$/u.test(value))return null;
  const time=Date.parse(value);return Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===value.slice(0,10)?new Date(time).toISOString():null;
}

function anchor(value) {
  const date=researchCoordinateDate(value?.date);
  if(!date||!positive(value?.price))return null;
  return {date,price:value.price,field:['O','H','L','C','free'].includes(value.field)?value.field:'free',kind:value.kind==='conditional'||value.kind==='simulated'?'conditional':'observed',source:text(value.source,160)||'사용자 연구 좌표',interval:text(value.interval,24)||'daily',basis:value.basis==='market'?'market':'custom'};
}

function normalizeItem(value) {
  const start=anchor(value?.start),end=anchor(value?.end),id=text(value?.id,100);
  if(!id||!start||!end||!/^[a-zA-Z0-9_-]+$/u.test(id))return null;
  const capture=value.capture||{},createdAt=researchCoordinateDate(value.createdAt),updatedAt=researchCoordinateDate(value.updatedAt);
  return {id,type:'measurement',label:text(value.label,80)||'연구 측정',note:text(value.note,1000),color:RESEARCH_ANNOTATION_COLORS.includes(value.color)?value.color:RESEARCH_ANNOTATION_COLORS[0],locked:value.locked===true,hidden:value.hidden===true,start,end,createdAt:createdAt||null,updatedAt:updatedAt||createdAt||null,capture:{interval:text(capture.interval,24)||start.interval,asOf:researchCoordinateDate(capture.asOf),scenarioId:text(capture.scenarioId,80),scenarioLabel:text(capture.scenarioLabel,120),revision:text(capture.revision,160),loadedBars:Number.isSafeInteger(capture.loadedBars)&&capture.loadedBars>=0?capture.loadedBars:null,barCountBasis:'loaded-source-rows',coordinatesEdited:capture.coordinatesEdited===true}};
}

export function normalizeResearchAnnotations(value) {
  const input=Array.isArray(value)?value:Array.isArray(value?.items)?value.items:[],seen=new Set(),items=[];
  for(const raw of input){const item=normalizeItem(raw);if(!item||seen.has(item.id))continue;seen.add(item.id);items.push(item);if(items.length===MAX_RESEARCH_ANNOTATIONS)break;}
  return {version:1,items,selectedId:items.some(item=>item.id===value?.selectedId)?value.selectedId:null};
}

let sequence=0;
/** Save raw USD anchors with the data source at capture, including mixed observed/assumed ends. */
export function createResearchAnnotation(measurement,context={}) {
  if(!measurement?.startDate||!measurement?.endDate||!positive(measurement.startPrice)||!positive(measurement.endPrice))throw new RangeError('가격 차트에서 두 점 측정을 완료한 뒤 저장해 주세요.');
  const frequency=context.frequency||'daily',candles=context.candles||context.observedCandles||[],rows=context.rows||[],intraday=!['daily','weekly'].includes(frequency),asOf=researchCoordinateDate(intraday&&candles.length?candles.at(-1).date??candles.at(-1).time:context.asOf),scenarioId=text(context.scenarioId,80),scenarioLabel=text(context.scenarioLabel,120);
  function captured(prefix){
    const date=researchCoordinateDate(measurement[`${prefix}Date`]);if(!date)throw new RangeError('연구 좌표의 UTC 날짜가 올바르지 않습니다.');
    const rawPrice=measurement[`${prefix}Price`],field=measurement[`${prefix}Field`]||'C',kind=measurement[`${prefix}Kind`];
    const conditional=kind==='simulated'||kind==='conditional'||Boolean(kind!=='observed'&&asOf&&timestamp(date)>timestamp(asOf));
    const candidate=candles.find(row=>timestamp(row.date??row.time)===timestamp(date)),row=rows.find(row=>timestamp(row.date)===timestamp(date));
    const candle=candidate&&(context.source==='Coin Metrics'&&context.chartType!=='candles'?null:context.chartType==='candles'||intraday||!row||context.source&&context.source!=='Coin Metrics'?candidate:null);
    const fieldKey={O:'open',H:'high',L:'low',C:'close'}[field];
    const actual=candle&&fieldKey?candle[fieldKey]:field==='C'?row?.price:null;
    const market=field!=='free'&&Number.isFinite(actual)&&actual===rawPrice;
    const candleSource=intraday?context.source||context.candleSource:context.candleSource||context.source;
    return {date,price:rawPrice,field:['O','H','L','C','free'].includes(field)?field:'free',kind:conditional?'conditional':'observed',source:conditional?`조건부 가정${scenarioLabel?` · ${scenarioLabel}`:''}`:candle?candleSource||'거래소 OHLC':row?'Coin Metrics':context.source||'사용자 연구 좌표',interval:candle?frequency:'daily',basis:conditional?'custom':market?'market':'custom'};
  }
  const start=captured('start'),end=captured('end'),from=Math.min(timestamp(start.date),timestamp(end.date)),to=Math.max(timestamp(start.date),timestamp(end.date));
  const sameSource=start.source===end.source&&start.kind==='observed'&&end.kind==='observed',sourceRows=start.source==='Coin Metrics'?rows:candles;
  const loadedBars=sameSource?new Set(sourceRows.filter(row=>{const date=timestamp(row.date??row.time);return date>=from&&date<=to;}).map(row=>timestamp(row.date??row.time))).size:null;
  const now=context.now||new Date().toISOString(),id=context.id||globalThis.crypto?.randomUUID?.()||`research-${Date.now()}-${++sequence}`;
  const result=normalizeItem({id,label:context.label||`연구 측정 ${start.date.slice(0,10)} → ${end.date.slice(0,10)}`,note:'',color:context.color||RESEARCH_ANNOTATION_COLORS[0],start,end,createdAt:now,updatedAt:now,capture:{interval:frequency,asOf,scenarioId,scenarioLabel,revision:context.revision,loadedBars}});
  if(!result)throw new RangeError('저장할 연구 좌표가 올바르지 않습니다.');return result;
}

/** Calendar time and loaded bar count intentionally remain separate quantities. */
export function researchAnnotationSummary(item) {
  const value=normalizeItem(item);if(!value)return null;
  const deltaSeconds=(timestamp(value.end.date)-timestamp(value.start.date))/1000,changePrice=value.end.price-value.start.price,changePct=changePrice/value.start.price*100;
  return {deltaSeconds,deltaDays:deltaSeconds/86400,changePrice,changePct,loadedBars:value.capture.loadedBars,includesConditional:value.start.kind==='conditional'||value.end.kind==='conditional',customCoordinates:value.start.basis!=='market'||value.end.basis!=='market'};
}

/** Root owns undo/redo and scheduling; one command yields one serializable state. */
export function changeResearchAnnotations(value,command={}) {
  const state=normalizeResearchAnnotations(value),type=command.type||command.action;
  if(type==='replace')return normalizeResearchAnnotations(command.state);
  if(type==='add'){
    if(state.items.length>=MAX_RESEARCH_ANNOTATIONS)throw new RangeError(`연구 측정은 최대 ${MAX_RESEARCH_ANNOTATIONS}개 저장할 수 있습니다.`);
    const item=normalizeItem(command.annotation);if(!item)throw new RangeError('연구 측정의 좌표를 확인해 주세요.');if(state.items.some(row=>row.id===item.id))throw new RangeError('이미 저장된 연구 측정입니다.');
    return {...state,items:[...state.items,item],selectedId:item.id};
  }
  if(type==='select'){return {...state,selectedId:state.items.some(item=>item.id===command.id)?command.id:null};}
  const index=state.items.findIndex(item=>item.id===command.id);if(index<0)throw new RangeError('해당 연구 측정을 찾을 수 없습니다.');
  const item=state.items[index];
  if(type==='toggle-hidden'||type==='toggle-lock'){const field=type==='toggle-hidden'?'hidden':'locked';return {...state,items:state.items.map((row,i)=>i===index?{...row,[field]:!row[field]}:row)};}
  if(item.locked)throw new RangeError('좌표를 편집하거나 삭제하려면 잠금을 먼저 해제해 주세요.');
  if(type==='delete')return {...state,items:state.items.filter(row=>row.id!==item.id),selectedId:state.selectedId===item.id?null:state.selectedId};
  if(type!=='update')throw new RangeError('지원하지 않는 연구 측정 작업입니다.');
  const patch=command.patch||{},changed=structuredClone(item);
  for(const key of ['label','note','color'])if(Object.hasOwn(patch,key))changed[key]=patch[key];
  let coordinatesEdited=false;
  for(const key of ['start','end'])if(patch[key]){
    const source={...changed[key],...patch[key]},date=researchCoordinateDate(source.date);if(!date||!positive(source.price))throw new RangeError('날짜는 UTC로, 가격은 0보다 큰 원 USD 값으로 입력해 주세요.');
    if(date!==changed[key].date||source.price!==changed[key].price){coordinatesEdited=true;changed[key]={...changed[key],date,price:source.price,field:'free',basis:'custom',kind:changed.capture.asOf&&timestamp(date)>timestamp(changed.capture.asOf)?'conditional':'observed'};}
  }
  if(coordinatesEdited)changed.capture={...changed.capture,loadedBars:null,coordinatesEdited:true};
  changed.updatedAt=command.now||new Date().toISOString();
  return {...state,items:state.items.map((row,i)=>i===index?normalizeItem(changed):row)};
}

export function readResearchAnnotations(storage=()=>globalThis.localStorage) {
  try{const store=typeof storage==='function'?storage():storage,raw=store?.getItem(RESEARCH_ANNOTATIONS_KEY);if(!raw)return normalizeResearchAnnotations(null);if(raw.length>500000)return normalizeResearchAnnotations(null);return normalizeResearchAnnotations(JSON.parse(raw));}catch{return normalizeResearchAnnotations(null);}
}
export function writeResearchAnnotations(value,storage=()=>globalThis.localStorage) {
  const state=normalizeResearchAnnotations(value);try{const store=typeof storage==='function'?storage():storage;if(!store?.setItem)throw new Error('Unavailable storage');store.setItem(RESEARCH_ANNOTATIONS_KEY,JSON.stringify(state));return {state,saved:true,error:null};}catch{return {state,saved:false,error:'이 브라우저에 저장하지 못했습니다. 현재 탭에서는 연구 측정을 계속 사용할 수 있습니다.'};}
}

function clippedSegment(x1,y1,x2,y2,left,right,top,bottom){
  const dx=x2-x1,dy=y2-y1;let low=0,high=1;
  for(const [p,q]of [[-dx,x1-left],[dx,right-x1],[-dy,y1-top],[dy,bottom-y1]]){if(p===0){if(q<0)return null;continue;}const t=q/p;if(p<0)low=Math.max(low,t);else high=Math.min(high,t);if(low>high)return null;}
  return {x1:x1+low*dx,y1:y1+low*dy,x2:x1+high*dx,y2:y1+high*dy};
}

/** Additive SVG overlay: exact raw coordinates, existing price clip, small hit targets. */
export function researchAnnotationsMarkup({annotations=[],start=-Infinity,end=Infinity,x,y,left,right,top,bottom,clipId,activeId=null,scenarioId=''}={}) {
  if(typeof x!=='function'||typeof y!=='function'||![left,right,top,bottom].every(Number.isFinite)||right<=left||bottom<=top)return {markup:'',visibleCount:0,items:[]};
  const normalized=normalizeResearchAnnotations(annotations).items,items=[];
  for(const item of normalized){
    if(item.hidden)continue;
    const x1=x({date:item.start.date}),x2=x({date:item.end.date}),y1=y(item.start.price),y2=y(item.end.price);
    if(![x1,x2,y1,y2].every(Number.isFinite))continue;const visible=clippedSegment(x1,y1,x2,y2,left,right,top,bottom);if(!visible)continue;
    const summary=researchAnnotationSummary(item),active=item.id===activeId,staleScenario=summary.includesConditional&&Boolean(item.capture.scenarioId&&scenarioId&&item.capture.scenarioId!==scenarioId);
    const detail=`${item.label} · ${item.start.date} UTC $${item.start.price} (${item.start.field}, ${item.start.kind==='conditional'?'가정':'관측 날짜'} · ${item.start.source}${item.start.basis==='custom'?' · 사용자 좌표':''}) → ${item.end.date} UTC $${item.end.price} (${item.end.field}, ${item.end.kind==='conditional'?'가정':'관측 날짜'} · ${item.end.source}${item.end.basis==='custom'?' · 사용자 좌표':''}) · ${summary.changePct.toFixed(2)}% · 달력 ${summary.deltaDays.toFixed(2)}일${summary.loadedBars===null?'':` · 로드된 원자료 ${summary.loadedBars}봉`}${staleScenario?' · 저장 당시 다른 가정':''}${item.locked?' · 잠김':''}${item.note?` · ${item.note}`:''}`;
    const label=`${item.label.slice(0,24)} · ${summary.changePct>=0?'+':''}${summary.changePct.toFixed(1)}%${staleScenario?' · 저장 가정':''}`;
    const labelWidth=Math.min(Math.max(48,label.length*6.2+12),Math.max(1,right-left-8)),labelX=Math.max(left+4,Math.min(right-labelWidth-4,(visible.x1+visible.x2-labelWidth)/2)),labelY=Math.max(top+15,Math.min(bottom-5,Math.min(visible.y1,visible.y2)-8));
    const dash=summary.includesConditional?'5 4':item.start.basis==='custom'||item.end.basis==='custom'?'3 3':'';
    const markup=`<g class="research-annotation${active?' is-active':''}${item.locked?' is-locked':''}${staleScenario?' is-saved-scenario':''}" data-research-annotation="${escape(item.id)}" data-start-date="${escape(item.start.date)}" data-end-date="${escape(item.end.date)}" data-start-price="${item.start.price}" data-end-price="${item.end.price}" data-kind="${summary.includesConditional?'conditional':'observed'}" role="button" tabindex="0" aria-pressed="${active}" aria-label="${escape(detail)}" clip-path="url(#${escape(clipId)})"><title>${escape(detail)}</title><line class="research-annotation-hit" x1="${x1}" x2="${x2}" y1="${y1}" y2="${y2}" stroke="transparent" stroke-width="10" pointer-events="stroke"/><line class="research-annotation-line" x1="${x1}" x2="${x2}" y1="${y1}" y2="${y2}" stroke="${item.color}" stroke-width="${active?2.5:1.5}"${dash?` stroke-dasharray="${dash}"`:''} pointer-events="none"/><circle cx="${x1}" cy="${y1}" r="${active?4:3}" fill="#10151c" stroke="${item.color}" pointer-events="none"/><circle cx="${x2}" cy="${y2}" r="${active?4:3}" fill="#10151c" stroke="${item.color}" pointer-events="none"/><g class="research-annotation-label"><rect x="${labelX}" y="${labelY-12}" width="${labelWidth}" height="17" rx="3" fill="#142131" fill-opacity=".92" stroke="${item.color}" stroke-opacity=".45"/><text x="${labelX+5}" y="${labelY}" fill="${item.color}" font-size="9" textLength="${Math.max(1,labelWidth-10)}" lengthAdjust="spacingAndGlyphs">${escape(label)}</text></g></g>`;
    items.push({id:item.id,x1,x2,y1,y2,active,staleScenario,markup});
  }
  const paint=[...items.filter(item=>!item.active),...items.filter(item=>item.active)];
  return {markup:items.length?`<g class="research-annotations" aria-label="저장한 연구 측정">${paint.map(item=>item.markup).join('')}</g>`:'',visibleCount:items.length,items};
}
