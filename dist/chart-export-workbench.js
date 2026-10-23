import {createObservedChartCsv,selectObservedChartRows,createConditionalChartCsv,createResearchSeriesCsv,createChartSvgExport,createChartPngFromSvg,chartExportRange} from './chart-export.js?v=1.14.1-png.1';
import {mountDialogViewport} from './dialog-viewport.js?v=1.14.0-mobile.1';

const iso=value=>{const time=typeof value==='number'?value*1000:Date.parse(value);return Number.isFinite(time)?new Date(time).toISOString():null;};
const deepFreeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))deepFreeze(child);Object.freeze(value);}return value;};
const rangeLabel=range=>range?.start&&range?.end?`${range.start} → ${range.end} UTC`:'없음';
const dataExtent=rows=>{const dates=rows.map(row=>iso(row.date??row.time)).filter(Boolean).sort();return dates.length?{start:dates[0],end:dates.at(-1)}:null;};
const displayLabel=(unit,display)=>unit==='percent'?`기준가 대비 %${display?.baseDate?` (기준 ${display.baseDate} UTC, 원 USD ${display.basePrice})`:''}`:unit==='indexed-start'?`시작 기준 100${display?.baseDate?` (기준 ${display.baseDate} UTC, 원 USD ${display.basePrice})`:''}`:unit==='indexed'?`최근 관측 = 100${display?.baseDate?` (기준 ${display.baseDate} UTC, 원 USD ${display.basePrice})`:''}`:'USD';

/** Pure data snapshot: the preview and download share these exact serialized rows. */
export function createChartExportDataSnapshot(context={}) {
  const frequency=context.frequency||'daily',intraday=!['daily','weekly'].includes(frequency),window=chartExportRange(context.range,frequency),capturedAt=context.capturedAt||new Date().toISOString();
  const metadata={capturedAt,frequency,chartType:context.chartType||'line',displayUnit:context.unit||'usd',display:structuredClone(context.display||null),displayLabel:displayLabel(context.unit,context.display),timezone:'UTC',viewport:{start:window.startUTC,end:window.endUTC},asOf:context.asOf||null};
  const datasets=[];
  function observed({id,label,rows=[],candles=null,source,interval,asOf,completedBefore}){
    const all=candles||rows,extent=dataExtent(all);let loadedRange=null;
    try{if(extent)loadedRange=dataExtent(selectObservedChartRows({rows,candles,range:{start:extent.start,end:extent.end},frequency:interval,asOf,completedBefore}));}catch{/* Invalid/unavailable loaded data is described by the exact export error below. */}
    const item={id,label,source,interval,kind:'observed',currency:'USD',observedOnly:true,loadedRange,exportRange:null,rowCount:0,csv:null,error:null,note:'현재 표시 기간과 실제로 로드된 원자료의 교집합만 저장합니다. 빈 날짜·미래 가격·화면 샘플을 생성하지 않습니다.'};
    try{const selected=selectObservedChartRows({rows,candles,range:context.range,frequency:interval,asOf,completedBefore});item.rowCount=selected.length;item.exportRange=dataExtent(selected);item.csv=createObservedChartCsv({rows:candles?[]:selected,candles:candles?selected:null,range:context.range,frequency:interval,asOf,source,completedBefore});}catch(error){item.error=error.message;}
    datasets.push(item);
  }
  if(intraday){
    const series=context.intradaySeries||{};
    observed({id:'coinbase-ohlc',label:`Coinbase 완료 OHLC · ${frequency}`,candles:series.completedOnly===false?[]:series.candles||[],source:series.source||'Coinbase Exchange',interval:frequency,completedBefore:series.retrievedAt||capturedAt});
  }else{
    observed({id:'coin-metrics-daily',label:'Coin Metrics 실제 일별 가격',rows:context.rows||[],source:'Coin Metrics',interval:'daily',asOf:context.asOf});
    observed({id:'bitstamp-ohlc',label:`${context.candleSource||'Bitstamp'} 실제 OHLC · ${frequency==='weekly'?'1W':'1D'}`,candles:context.observedCandles||[],source:context.candleSource||'Bitstamp',interval:frequency,asOf:context.asOf});
    const forecast=context.forecast;
    if(forecast?.path){
      const selected=forecast.path.filter(row=>row.date>context.asOf&&Date.parse(row.date)>=window.start&&Date.parse(row.date)<=window.end),item={id:'conditional-path',label:'조건부 가격 가정 · 별도 CSV',source:forecast.source||'Atlas conditional model',interval:'daily',kind:'conditional',currency:'USD',observedOnly:false,loadedRange:dataExtent(forecast.path.filter(row=>row.date>context.asOf)),exportRange:dataExtent(selected),rowCount:selected.length,csv:null,error:null,note:`${forecast.scenarioLabel||forecast.scenarioId||'선택 가정'} · 관측 기준 ${context.asOf} UTC 이후의 가정만 저장합니다. 하단·상단은 확률구간이 아닙니다.`};
      try{item.csv=createConditionalChartCsv({path:forecast.path,range:context.range,asOf:context.asOf,scenarioId:forecast.scenarioId,scenarioLabel:forecast.scenarioLabel,source:item.source});}catch(error){item.error=error.message;item.rowCount=0;}datasets.push(item);
    }
  }
  for(const supplied of context.researchSeries||[]){
    if(!supplied?.id||!Array.isArray(supplied.rows)||!Array.isArray(supplied.columns))continue;
    const item={id:`research-${supplied.id}`,label:`${supplied.label||supplied.title||supplied.id} · 별도 분석 CSV`,source:supplied.source||'Atlas research',interval:supplied.interval||frequency,kind:supplied.kind||'derived',currency:supplied.unit||'',observedOnly:false,rangeBasis:'analysis-pane',loadedRange:dataExtent(supplied.rows),exportRange:dataExtent(supplied.rows),rowCount:0,csv:null,error:null,note:[supplied.note,'현재 연구 창의 원자료 전체를 저장합니다. 고유 분석 축을 유지하며 가격 차트 날짜 범위 필터를 적용하지 않습니다. 원시 관측 가격과 별도의 분석 계산값입니다.'].filter(Boolean).join(' · ')};
    try{item.rowCount=supplied.rows.length;item.csv=createResearchSeriesCsv({...supplied,interval:item.interval,source:item.source,kind:item.kind,filterByRange:false});}catch(error){item.error=error.message;item.rowCount=0;}datasets.push(item);
  }
  return deepFreeze({metadata,datasets});
}

/** Capture all geometry, text, source metadata and CSV rows before the first await. */
export function captureChartExportSnapshot(context={}) {
  const data=createChartExportDataSnapshot(context),panels=(context.panels||[]).filter(panel=>panel?.svg&&!panel.hidden&&!panel.minimized),options={...(context.imageOptions||{})},images={main:null,workspace:null},imageErrors={};
  const scopeNote='저장 범위: 현재 가격 화면. 날짜·가격축 범위와 표시 중인 연구 주석을 유지합니다.';
  try{images.main=createChartSvgExport(context.svg,{...options,panels:[],note:[options.note,scopeNote].filter(Boolean).join(' · ')});}catch(error){imageErrors.main=error.message;}
  try{images.workspace=createChartSvgExport(context.svg,{...options,panels,note:[options.note,'저장 범위: 현재 가격 화면 + 보이는 펼친 연구 창. 숨김·최소화 창은 제외하며 각 창의 고유 축과 범위를 유지합니다.'].filter(Boolean).join(' · ')});}catch(error){imageErrors.workspace=error.message;}
  return deepFreeze({...data,images,imageErrors,panels:panels.map(panel=>({title:panel.title||'분석 창',readout:panel.readout||'',note:panel.note||''})),excludedPanels:(context.panels||[]).filter(panel=>panel?.hidden||panel?.minimized).map(panel=>panel.title||'분석 창')});
}

export function supportsChartImageClipboard(view=globalThis){return Boolean(view.navigator?.clipboard?.write&&view.ClipboardItem&&(!view.ClipboardItem.supports||view.ClipboardItem.supports('image/png')));}

/** clipboard.write starts in the user gesture; image encoding may finish asynchronously. */
export async function copyChartSnapshotImage(vector,doc){
  const view=doc?.defaultView;if(!supportsChartImageClipboard(view))throw new Error('이 브라우저에서는 이미지 복사를 지원하지 않습니다. PNG 저장을 사용해 주세요.');
  const blob=createChartPngFromSvg(vector,doc);blob.catch(()=>{});return view.navigator.clipboard.write([new view.ClipboardItem({'image/png':blob})]);
}

export function mountChartExportWorkbench({document:doc=globalThis.document,getContext,onDownload,onFeedback=()=>{}}={}) {
  if(!doc||typeof getContext!=='function'||typeof onDownload!=='function')throw new TypeError('Chart export workbench requires document, context and download callbacks');
  const make=(tag,attrs={},text)=>{const node=doc.createElement(tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,String(value));if(text!==undefined)node.textContent=text;return node;};
  const dialog=make('dialog',{id:'chart-export-dialog',class:'chart-export-dialog','aria-labelledby':'chart-export-title'}),header=make('header'),heading=make('h2',{id:'chart-export-title'},'차트 내보내기'),close=make('button',{type:'button','aria-label':'내보내기 창 닫기'},'닫기');header.append(heading,close);
  const help=make('p',{class:'chart-export-help'},'이 창을 연 순간의 화면과 자료를 고정했습니다. 출처·범위·단위를 확인한 뒤 저장하세요. 새 화면은 창을 닫고 다시 열어 가져옵니다.'),controls=make('div',{class:'chart-export-controls'});
  function select(name,label,choices){const wrapper=make('label',{},label),node=make('select',{id:`chart-export-${name}`});for(const [value,text]of choices)node.append(make('option',{value},text));wrapper.append(node);controls.append(wrapper);return node;}
  const format=select('format','파일 형식',[['png','PNG 이미지'],['svg','SVG 벡터'],['csv','CSV 원자료 / 분석']]),scope=select('scope','이미지 범위',[['main','현재 가격 화면'],['workspace','현재 가격 + 보이는 연구 창']]),dataset=select('dataset','CSV 자료',[]),facts=make('dl',{class:'chart-export-facts'}),preview=make('div',{class:'chart-export-preview'}),status=make('p',{class:'chart-export-status',role:'status','aria-live':'polite'}),actions=make('footer'),download=make('button',{type:'button',class:'chart-export-download'},'저장'),copy=make('button',{type:'button'},'이미지 복사');actions.append(copy,download);
  const body=make('div',{class:'chart-export-body'});body.append(help,controls,facts,preview,status);dialog.append(header,body,actions);doc.body.append(dialog);
  const dialogViewport=mountDialogViewport(dialog);
  let snapshot=null,opener=null,busy=false,previewURL=null;
  const announce=message=>{status.textContent=message;};
  function releasePreview(){if(previewURL){doc.defaultView?.URL?.revokeObjectURL(previewURL);previewURL=null;}}
  function fact(label,value){facts.append(make('dt',{},label),make('dd',{},value||'—'));}
  function paint(){
    if(!snapshot)return;releasePreview();facts.replaceChildren();preview.replaceChildren();const isCsv=format.value==='csv',item=snapshot.datasets.find(item=>item.id===dataset.value),scopeValue=scope.value;
    scope.parentElement.hidden=isCsv;dataset.parentElement.hidden=!isCsv;copy.hidden=isCsv||!supportsChartImageClipboard(doc.defaultView);copy.disabled=busy||!snapshot.images[scopeValue];
    fact('고정 시각',`${snapshot.metadata.capturedAt} UTC`);fact('현재 화면',`${snapshot.metadata.frequency} · ${snapshot.metadata.chartType==='candles'?'캔들':'가격선'} · ${snapshot.metadata.displayLabel}`);fact('표시 기간',rangeLabel(snapshot.metadata.viewport));
    if(isCsv){
      fact('자료',item?.label);fact('출처',item?.source);fact('자료 종류',item?.observedOnly?'실제 관측만':item?.kind==='conditional'?'조건부 가정 · 관측값 아님':'별도 분석 계산값');fact('CSV 간격 / 시간',`${item?.interval||'—'} · UTC`);fact('CSV 단위',item?.currency==='USD'?'원 USD · 화면의 지수/% 변환을 적용하지 않습니다.':item?.currency);fact('로드된 자료 범위',item?.rangeBasis==='analysis-pane'&&!item.loadedRange?'연구 창 고유 분석 축':rangeLabel(item?.loadedRange));fact('실제 저장 범위',item?.rangeBasis==='analysis-pane'?'현재 보이는 연구 창 원자료 전체 · 가격 날짜 필터 미적용':rangeLabel(item?.exportRange));fact('저장 행 수',String(item?.rowCount||0));fact('범위 설명',item?.note);
      const content=make('pre',{'aria-label':'CSV 첫 6행 미리보기'},item?.csv?.split('\r\n').slice(0,7).join('\n')||item?.error||'저장할 자료가 없습니다.');preview.append(content);download.disabled=busy||!item?.csv;announce(item?.error||'미리보기와 동일한 행을 저장합니다.');
    }else{
      fact('이미지 범위',scopeValue==='workspace'?`현재 가격 + 펼친 연구 창 ${snapshot.panels.length}개`:'현재 가격 화면');if(scopeValue==='workspace'){fact('포함 연구 창',snapshot.panels.map(item=>item.title).join(' · ')||'없음');fact('제외 창',snapshot.excludedPanels.join(' · ')||'없음');}fact('자료 / 가정',snapshot.datasets.filter(item=>item.rowCount>0).map(item=>`${item.source} (${item.kind})`).join(' · '));fact('가격 / 날짜축','현재 화면의 각 축과 표시 범위를 유지합니다. 연구 창의 고유 축을 가격 날짜축으로 바꾸지 않습니다.');
      const vector=snapshot.images[scopeValue];download.disabled=busy||!vector;if(vector&&doc.defaultView?.URL?.createObjectURL){previewURL=doc.defaultView.URL.createObjectURL(new Blob([vector],{type:'image/svg+xml;charset=utf-8'}));preview.append(make('img',{src:previewURL,alt:scopeValue==='workspace'?'현재 가격과 보이는 연구 창 내보내기 미리보기':'현재 가격 화면 내보내기 미리보기'}));}announce(snapshot.imageErrors[scopeValue]||'현재 화면을 고정한 이미지입니다. PNG는 메모리 한도에 맞춰 해상도를 조정합니다.');
    }
  }
  async function save(clipboard=false){
    if(busy||!snapshot)return;const selectedFormat=format.value,selectedScope=scope.value,item=snapshot.datasets.find(item=>item.id===dataset.value),vector=snapshot.images[selectedScope];busy=true;download.disabled=true;copy.disabled=true;for(const control of [format,scope,dataset])control.disabled=true;dialog.setAttribute('aria-busy','true');announce(clipboard?'이미지를 복사하고 있습니다…':'파일을 만들고 있습니다…');
    try{
      if(clipboard){if(!vector)throw new Error('복사할 이미지가 없습니다.');await copyChartSnapshotImage(vector,doc);announce('이미지를 클립보드에 복사했습니다.');onFeedback('이미지를 클립보드에 복사했습니다.');}
      else if(selectedFormat==='csv'){if(!item?.csv)throw new Error(item?.error||'저장할 자료가 없습니다.');onDownload(`Bitcoin_${item.id}_${item.interval}.csv`,item.csv,'text/csv;charset=utf-8');announce(`${item.rowCount}행 CSV를 저장했습니다.`);onFeedback(`${item.label} ${item.rowCount}행을 CSV로 저장했습니다.`);}
      else{if(!vector)throw new Error('저장할 이미지가 없습니다.');const content=selectedFormat==='png'?await createChartPngFromSvg(vector,doc):vector;onDownload(`Bitcoin_${selectedScope==='workspace'?'Research_Workspace':'Price_Chart'}.${selectedFormat}`,content,selectedFormat==='png'?'image/png':'image/svg+xml;charset=utf-8');announce(`${selectedFormat.toUpperCase()} 파일을 저장했습니다.`);onFeedback(`${selectedScope==='workspace'?'가격과 보이는 연구 창':'현재 가격 화면'}을 ${selectedFormat.toUpperCase()}로 저장했습니다.`);}
    }catch(error){announce(error.message||'내보내기에 실패했습니다.');onFeedback(error.message||'내보내기에 실패했습니다.');}
    finally{busy=false;for(const control of [format,scope,dataset])control.disabled=false;dialog.removeAttribute('aria-busy');download.disabled=selectedFormat==='csv'?!item?.csv:!vector;copy.disabled=!vector;}
  }
  format.onchange=paint;scope.onchange=paint;dataset.onchange=paint;download.onclick=()=>save(false);copy.onclick=()=>save(true);close.onclick=()=>dialog.close();
  dialog.addEventListener('keydown',event=>{event.stopPropagation();});dialog.addEventListener('close',()=>{releasePreview();if(opener?.isConnected!==false)opener?.focus?.();});
  function open(options={}){
    if(busy){announce('현재 파일 생성이 끝난 뒤 다시 열어 주세요.');return;}
    opener=options.opener||doc.activeElement;try{snapshot=captureChartExportSnapshot(getContext());}catch(error){onFeedback(error.message);return;}
    format.value=['png','svg','csv'].includes(options.format)?options.format:'png';scope.value=options.scope==='workspace'?'workspace':'main';dataset.replaceChildren();for(const item of snapshot.datasets)dataset.append(make('option',{value:item.id},`${item.label}${item.error?' · 현재 범위에 없음':''}`));
    const preferred=options.dataset||(snapshot.metadata.chartType==='candles'&&['daily','weekly'].includes(snapshot.metadata.frequency)?'bitstamp-ohlc':null);
    dataset.value=snapshot.datasets.find(item=>item.id===preferred&&item.csv)?.id||snapshot.datasets.find(item=>item.csv)?.id||snapshot.datasets[0]?.id||'';const Event=doc.defaultView?.CustomEvent||globalThis.CustomEvent;if(Event)doc.dispatchEvent(new Event('atlas:modal-open',{detail:{id:dialog.id}}));if(!dialog.open)dialog.showModal();paint();format.focus();
  }
  return {open,destroy(){dialogViewport.destroy();releasePreview();dialog.remove();}};
}
