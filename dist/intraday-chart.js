import {createPriceScale,barPriceChange} from './chart-math.js?v=1.19.0';
import { priceAxisMarkup, timeAxisMarkup, createPriceAxisLayout, createPriceAxisFormatter } from './price-axis.js?v=1.14.0-mobile.1';
import { createPriceDisplay, formatDisplayPrice } from './price-display.js?v=1.13.0-research.1';
import { retainPriceViewport, renderEmptyPriceViewport } from './empty-price-chart.js?v=1.19.0';
import { researchAnnotationsMarkup } from './research-annotations.js?v=1.13.0-research.1';
import {chartInterval} from './ohlc-data.js?v=1.11.0';
import {chartPaneLayout,volumePaneMarkup,historicalMarkersMarkup} from './chart-overlays.js?v=1.16.0-history.1';
import { resolveMagnetPoint, advanceMeasurement, measurePriceAnchors, measurementOverlayMarkup, createMeasurementOverlay } from './chart-magnet.js?v=1.11.0';
import { clearChartHover, clearChartHoverPointer, getChartHoverPointer, rememberChartHoverPointer, coalescedChartHover, paintPriceCursor } from './chart-hover.js?v=1.12.1-cursor-hud.1';
import { dateWindow, pixelExtrema } from './chart-window.js?v=1.11.0';
import { equityForecastAnchor, equityForecastRows, equityForecastWindowRows, equityForecastLogGaps, equityForecastMarkup, equityForecastCandles, EQUITY_FORECAST_BAR_NOTE } from './equity-forecast-chart.js?v=1.20.0';

const numberFormats=new Map();
const number=(value,digits=2)=>{if(!numberFormats.has(digits))numberFormats.set(digits,new Intl.NumberFormat('en-US',{maximumFractionDigits:digits}));return numberFormats.get(digits).format(value);};
const money=value=>`$${number(value,value<1?6:2)}`;
const timestamp=time=>new Date(time*1000).toISOString().slice(0,16).replace('T',' ');
const esc=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
// Long daily/weekly windows need calendar years; minute/hour charts keep their
// familiar time labels until the visible range is wide enough to make dates useful.
const timeTickLabel=(time,seconds,span)=>{
  const value=timestamp(time);
  return seconds>=86400||span>=14*86400?value.slice(0,span>=180*86400?7:10):value.slice(5);
};

export function drawIntradayChart({svg,series,chartType='candles',scale='log',priceDomain=null,invertScale=false,priceOnlyAuto=false,researchAnnotations=[],activeAnnotationId=null,onAnnotation=null,activeResearchAnnotationId=null,onResearchAnnotation=()=>{},scenarioId=null,unit='usd',tool='crosshair',magnet='off',measurement=null,onMeasurement=()=>{},range=null,historyStatus='ready',showVolume=true,historicalEvents=[],showHistoricalEvents=false,activeHistoricalEventId=null,historicalEventColors=null,onHistoricalEvent=()=>{},forecast=null,showForecastBand=true,onForecastEvidence=()=>{},headerInset=70,onHover=()=>{},onInspect=()=>{},selectedTime=null}) {
  clearChartHover(svg,{preservePointer:true});
  const selectedAnnotation=activeAnnotationId??activeResearchAnnotationId,activateAnnotation=onAnnotation||onResearchAnnotation;
  const allRows=series.candles,interval=chartInterval(series.interval),product=series.product||'BTC-USD',equity=series.assetClass==='equity',baseAsset=equity?'주':product.split('-')[0];
  if(!allRows.length&&(!Number.isFinite(range?.start)||!Number.isFinite(range?.end)))throw new RangeError('An empty market chart needs an explicit UTC range');
  const W=Math.max(1,Math.round(svg.clientWidth||1100)),H=Math.max(1,Math.round(svg.clientHeight||500)),small=W<600;
  const layout=chartPaneLayout({width:W,height:H,volume:showVolume,top:Number.isFinite(headerInset)?Math.max(12,headerInset):70});
  const axisText=createPriceAxisLayout({svg,width:W,left:layout.left,minRight:layout.right});layout.right=axisText.right;
  const {left:L,right:R,top:T,axisY,bottom,priceBottom:B,volumeTop,volumeBottom}=layout;
  const minTime=range?.start??allRows[0].time-interval.seconds,maxTime=range?.end??allRows.at(-1).time+interval.seconds;
  let rows=dateWindow(allRows,minTime,maxTime,row=>row.time);
  const forecastAnchor=equityForecastAnchor(forecast,allRows.at(-1));
  const futureRows=equityForecastRows(forecast,forecastAnchor?.time??Infinity),visibleFuture=equityForecastWindowRows(futureRows,forecastAnchor,minTime,maxTime,scale);
  const futureCandles=forecast?.pathMode==='asset-linked-daily'&&chartType==='candles'?dateWindow(equityForecastCandles(forecast,series.interval),minTime,maxTime,row=>row.time):[];
  const scaleRows=[...rows,...visibleFuture];
  const forecastLogGaps=scale==='log'?equityForecastLogGaps(futureRows,forecastAnchor,minTime,maxTime):[];
  const x=time=>L+(time-minTime)/Math.max(1,maxTime-minTime)*(W-L-R);
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  Object.assign(svg.dataset,{plotLeft:String(L),plotRight:String(W-R),plotTop:String(T),plotBottom:String(bottom),priceBottom:String(B),scale,chartType,interval:series.interval,product,historyLabelCount:'0',historyEventCount:'0',historyHiddenLabelCount:'0',historyLabelMode:'off'});
  svg.parentElement?.style.setProperty('--plot-bottom-gap',`${H-bottom+6}px`);svg.parentElement?.style.setProperty('--plot-right-gap',`${R+7}px`);
  Object.assign(svg.dataset,{visiblePointCount:String(rows.length),observedCandleCount:String(rows.length),candleRendering:'none',forecastPointCount:'0',forecastCandleCount:String(futureCandles.length),forecastBarDefinition:futureCandles.length?'simulated-daily-valuation-range':'none',forecastInterpolationCount:'0',forecastEvidenceCount:'0',forecastLogGapCount:String(forecastLogGaps.length)});
  if(!scaleRows.length)return renderEmptyPriceViewport({svg,layout,axisText,width:W,height:H,start:minTime,end:maxTime,seconds:true,scale,priceDomain,unit,denominator:allRows.at(-1)?.close,denominatorDate:allRows.at(-1)?.date,fallbackPrice:allRows.at(-1)?.close,invertScale,tool,message:forecastLogGaps.length?'0 경계 · 로그 연결 불가 · 선형축에서 확인':historyStatus==='loading'?'이 구간의 과거 봉을 불러오고 있습니다.':historyStatus==='error'?'과거 자료 조회에 실패했습니다.':'이 구간에는 완료된 거래 봉이 없습니다.',onHover:detail=>onHover({...detail,product,volumeUnit:baseAsset}),source:series.source,frequency:series.interval,researchAnnotations,activeResearchAnnotationId:selectedAnnotation,onResearchAnnotation:activateAnnotation,scenarioId});
  const display=createPriceDisplay({unit,rows:scaleRows,denominator:allRows.at(-1).close,denominatorDate:allRows.at(-1).date,scale}),{factor,offset,effectiveScale}=display;
  const observedPrices=rows.flatMap(row=>chartType==='candles'?[row.low,row.high]:[row.close]);
  const scenarioPrices=[...visibleFuture.flatMap(row=>showForecastBand?[row.low,row.price,row.high]:[row.price]),...futureCandles.flatMap(row=>[row.candle.low,row.candle.high])].filter(value=>Number.isFinite(value)&&(effectiveScale!=='log'||value>0));
  const valuesForAxis=[...observedPrices,...scenarioPrices];if(!valuesForAxis.some(value=>value>0))valuesForAxis.push(allRows.at(-1).close);
  const zeroDomain=effectiveScale==='linear'&&visibleFuture.some(row=>row.low===0)?{min:0,max:Math.max(...valuesForAxis)*1.12}:null;
  const axis=createPriceScale(valuesForAxis,{scale:effectiveScale,top:T,bottom:B,tickCount:Math.max(2,Math.min(7,Math.floor((B-T)/45))),factor,offset,inverted:invertScale,paddingRatio:.12,domain:priceDomain||zeroDomain});
  const y=axis.y,price=value=>formatDisplayPrice(value,display,unit==='usd'&&Math.abs(value)<1?6:2);
  const axisLabels=createPriceAxisFormatter({axis,display,layout:axisText});
  retainPriceViewport(svg,axis);Object.assign(svg.dataset,{scale:effectiveScale,unit,invertScale:String(Boolean(invertScale)),timeAxisTop:String(bottom+8)});
  const clip=`${svg.id}-market-clip`,axisClip=`${svg.id}-price-axis-clip`,width=Math.max(.7,Math.min(14,(W-L-R)*interval.seconds/(maxTime-minTime)*.68));
  let s=`<title>${esc(series.source)} ${esc(product)} · ${interval.label} · ${chartType==='candles'?'캔들':'종가 선'}</title><desc>${esc(product)} ${equity?'분할 조정된 주식 관측':'거래소 완료'} 봉의 시가·고가·저가·종가${showVolume?`와 ${esc(baseAsset)} 거래량`:''}입니다. ${equity?'날짜는 뉴욕 거래 세션일이며, 점선·빈 경로봉·음영은 일별 모의 평가의 조건부 미래 가정이며 실제 장중 OHLC가 아닙니다.':'빈 구간은 채우지 않습니다. 시간은 UTC입니다.'}</desc><defs><clipPath id="${clip}"><rect x="${L}" y="${T}" width="${W-L-R}" height="${B-T}"/></clipPath><clipPath id="${axisClip}"><rect x="${W-R}" y="${T}" width="${R}" height="${B-T}"/></clipPath></defs>`;
  for(const tick of axis.ticks){const yy=y(tick),label=axisLabels.tick(tick);s+=`<line x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}" stroke="#26323e"/><text x="${W-R+axisText.inset}" y="${yy+4}" ${axisText.attributes(label)} fill="#acbacb" font-size="${axisText.fontSize}">${esc(label)}</text>`;}
  // Daily observations are much denser than monthly scenario knots. Time
  // labels must cover the future too, rather than follow row-count quantiles.
  const tickCount=small?4:8;
  const tickRows=forecast?Array.from({length:tickCount},(_,index)=>({time:minTime+(maxTime-minTime)*index/(tickCount-1)})):scaleRows;
  const tickStep=forecast?1:Math.max(1,Math.ceil(tickRows.length/(small?3:7)));
  for(let i=0;i<tickRows.length;i+=tickStep){const row=tickRows[i],xx=x(row.time),label=timeTickLabel(row.time,interval.seconds,maxTime-minTime);s+=`<line x1="${xx}" x2="${xx}" y1="${T}" y2="${bottom}" stroke="#212c37"/><text class="market-time-label" x="${xx}" y="${axisY}" text-anchor="${i===0?'start':forecast&&i===tickRows.length-1?'end':'middle'}" fill="#aebaca" font-size="10">${label}</text>`;}
  s+=`<g clip-path="url(#${clip})">`;
  if(chartType==='candles'){
    const dense=rows.length>256&&width<2;svg.dataset.candleRendering=dense?'batched':'individual';
    if(dense){
      // Keep every source wick/body while reducing thousands of SVG nodes to
      // four paths. Selection still reads the complete original candle array.
      const wicks=['',''],bodies=['',''];
      for(const row of rows){const xx=x(row.time),side=row.close>=row.open?0:1,top=Math.min(y(row.open),y(row.close)),height=Math.max(1,Math.abs(y(row.open)-y(row.close)));wicks[side]+=`M${xx.toFixed(2)},${y(row.high).toFixed(2)}V${y(row.low).toFixed(2)}`;bodies[side]+=`M${(xx-width/2).toFixed(2)},${top.toFixed(2)}h${width.toFixed(2)}v${height.toFixed(2)}h${(-width).toFixed(2)}Z`;}
      s+=`<g class="market-candles-batched" data-count="${rows.length}"><title>${rows.length}개 실제 완료 봉 · 모든 OHLC 보존 · 선택하여 정확한 값을 확인합니다.</title>`;
      for(let side=0;side<2;side++){const color=side?'#dd7e8d':'#62bca5';if(wicks[side])s+=`<path d="${wicks[side]}" fill="none" stroke="${color}"/>`;if(bodies[side])s+=`<path d="${bodies[side]}" fill="${color}"/>`;}
      s+='</g>';
    }else{
    for(const row of rows){const xx=x(row.time),up=row.close>=row.open,color=up?'#62bca5':'#dd7e8d',top=Math.min(y(row.open),y(row.close)),height=Math.max(1,Math.abs(y(row.open)-y(row.close)));s+=`<g class="market-candle" data-time="${row.time}" data-open="${row.open}" data-high="${row.high}" data-low="${row.low}" data-close="${row.close}"><line x1="${xx}" x2="${xx}" y1="${y(row.high)}" y2="${y(row.low)}" stroke="${color}"/><rect x="${xx-width/2}" y="${top}" width="${width}" height="${height}" fill="${color}"/><title>${timestamp(row.time)} UTC · O ${money(row.open)} H ${money(row.high)} L ${money(row.low)} C ${money(row.close)}</title></g>`;}
    }
  }else{
    let path='',run=[];
    const flush=()=>{path+=pixelExtrema(run,row=>x(row.time),['close']).map((row,index)=>`${index?'L':'M'}${x(row.time).toFixed(2)},${y(row.close).toFixed(2)}`).join(' ');run=[];};
    for(const row of rows){if(!equity&&run.length&&row.time-run.at(-1).time!==interval.seconds)flush();run.push(row);}flush();
    s+=`<path class="market-close-line" d="${path}" fill="none" stroke="#dce7f2" stroke-width="1.7"/>`;
  }
  s+='</g>';
  const projection=equityForecastMarkup({forecast,points:futureRows,lastObserved:forecastAnchor,visibleRows:visibleFuture,x,y,left:L,right:W-R,top:T,bottom:B,clipId:clip,minTime,maxTime,showBand:showForecastBand,scale:effectiveScale,chartType,candles:futureCandles,barWidth:width});
  s+=projection.markup;svg.dataset.forecastPointCount=String(visibleFuture.filter(row=>!row.interpolated).length);svg.dataset.forecastInterpolationCount=String(visibleFuture.filter(row=>row.interpolated).length);svg.dataset.forecastEvidenceCount=String(projection.markerIds.size);
  if(showVolume)s+=volumePaneMarkup({bars:rows,x:bar=>x(bar.time),left:L,right:W-R,top:volumeTop,bottom:volumeBottom,titleY:layout.volumeTitleY,titleFontSize:layout.volumeTitleFontSize,separatorY:layout.volumeSeparatorY,barWidth:width,source:series.source,clipId:`${svg.id}-volume-clip`}).markup;
  const last=allRows.at(-1);
  if(last.time<=maxTime&&last.time>=minTime&&last.close>=axis.min&&last.close<=axis.max){
    const yy=y(last.close),labelTop=Math.max(T,Math.min(B-18,yy-9)),up=last.close>=last.open,color=up?'#2b6558':'#823c4c';
    const label=axisLabels.price(last.close);
    s+=`<g class="market-last-price" pointer-events="none"><title>${esc(series.source)} · 마지막 완료 봉 · ${timestamp(last.time)} UTC · ${esc(money(last.close))}</title><line x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}" stroke="${up?'#74ab9e':'#dd7e8d'}" stroke-dasharray="3 5" opacity=".6"/><rect x="${W-R}" y="${labelTop}" width="${R-2}" height="18" rx="2" fill="${color}"/><text x="${W-R+axisText.inset}" y="${labelTop+13}" ${axisText.attributes(label,{badge:true,kind:'latest'})} fill="#f0f5fa" font-size="${axisText.badgeFontSize}">${esc(label)}</text></g>`;
  }
  const historicalEventIds=new Set();
  if(showHistoricalEvents&&['daily','weekly'].includes(series.interval)){
    const seen=new Set(),anchors=[],retrieved=Date.parse(series.retrievedAt)/1000;
    const observedEnd=Math.min(last.time+interval.seconds,Number.isFinite(retrieved)?retrieved:Infinity);
    for(const event of Array.isArray(historicalEvents)?historicalEvents:[]){
      if(!event||typeof event.id!=='string'||!event.id||seen.has(event.id)||typeof event.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(event.date))continue;
      const time=Date.parse(`${event.date}T00:00:00Z`)/1000;
      if(!Number.isSafeInteger(time)||new Date(time*1000).toISOString().slice(0,10)!==event.date||time<allRows[0].time||time>=observedEnd||time<minTime||time>maxTime)continue;
      seen.add(event.id);
      // The event stays on its calendar date. Nearby completed OHLC provides
      // only a label height; it is not an event-time trade or a price estimate.
      const point=allRows[nearestIn(allRows,time)];
      anchors.push({event,x:x(time),y:y(point.close),anchorNote:`날짜 기준은 원문 참조 · 위치의 높이는 주변 완료 봉 종가 (${point.date.slice(0,10)} · ${interval.label})`});
    }
    const labels=historicalMarkersMarkup(anchors,{left:L,right:W-R,top:T+5,bottom:B-4,visibleSpanDays:(maxTime-minTime)/86400,activeEventId:activeHistoricalEventId,categoryColors:historicalEventColors});
    for(const marker of labels.markers)historicalEventIds.add(marker.event.id);
    s+=`<g class="history-events-layer" data-indicator-layer="history">${labels.markup}</g>`;
    Object.assign(svg.dataset,{historyLabelCount:String(labels.labelCount),historyEventCount:String(labels.totalCount),historyHiddenLabelCount:String(labels.hiddenLabelCount),historyLabelMode:labels.labelMode});
  }
  const annotations=researchAnnotationsMarkup({annotations:researchAnnotations,start:minTime,end:maxTime,x:({date:value})=>x(typeof value==='number'?value:Date.parse(value)/1000),y,left:L,right:W-R,top:T,bottom:B,clipId:clip,activeId:selectedAnnotation,scenarioId});
  s+=annotations.markup;svg.dataset.researchAnnotationCount=String(annotations.visibleCount);
  s+=`<g id="${svg.id}-cross" pointer-events="none"><line class="cross-time" y1="${T}" y2="${bottom}" stroke="#adbed1" stroke-dasharray="3 3"/><line class="cross-price" clip-path="url(#${clip})" x1="${L}" x2="${W-R}" stroke="#adbed1" stroke-dasharray="3 3"/><circle clip-path="url(#${clip})" r="3" fill="#10151c" stroke="#d5e6f7"/><g class="market-price-tag" clip-path="url(#${axisClip})"><rect x="${W-R}" width="${R-2}" height="18" rx="2" fill="#385466"/><text x="${W-R+axisText.inset}" fill="#f0f5fa" font-size="${axisText.badgeFontSize}"/></g><g class="market-date-tag"><rect width="124" height="18" rx="2" fill="#39485b"/><text fill="#edf2f9" font-size="9" text-anchor="middle"/></g></g>`;
  s+=measurementOverlayMarkup(clip);
  s+=priceAxisMarkup({left:W-R,right:W,top:T,bottom:B})+timeAxisMarkup({left:L,right:W-R,top:bottom+8,bottom:H});
  const observedSelectionRows=rows,projectedSelectionRows=futureCandles.length?futureCandles:visibleFuture;
  rows=[...observedSelectionRows,...projectedSelectionRows];
  svg.innerHTML=s;
  const cross=svg.querySelector('[id$="-cross"]'),vertical=cross.querySelector('.cross-time'),horizontal=cross.querySelector('.cross-price'),dot=cross.querySelector('circle'),priceTag=cross.querySelector('.market-price-tag'),dateTag=cross.querySelector('.market-date-tag');
  function nearestIn(values,time){let left=0,right=values.length-1;while(left<right){const mid=(left+right)>>1;if(values[mid].time<time)left=mid+1;else right=mid;}return left>0&&time-values[left-1].time<values[left].time-time?left-1:left;}
  const nearest=time=>{
    // A weekly bar's Monday label must not pull an observed cutoff into the
    // first future bar merely because that future label is closer in time.
    if(equity&&forecastAnchor){
      if(time<=forecastAnchor.time&&observedSelectionRows.length)return nearestIn(observedSelectionRows,time);
      if(time>forecastAnchor.time&&projectedSelectionRows.length)return observedSelectionRows.length+nearestIn(projectedSelectionRows,time);
    }
    return nearestIn(rows,time);
  };
  let measurementState=measurement?{...measurement,endDate:measurement.endDate??null}:null;
  const initialTime=tool==='measure'&&measurementState?(measurementState.endDate||measurementState.startDate):selectedTime;
  let active=initialTime!=null?nearest(typeof initialTime==='number'?initialTime:Date.parse(initialTime)/1000):nearest(allRows.at(-1).time),cursor=active,lastHovered=-1,lastPointer=null;
  let hoverSelection=initialTime!=null?(typeof initialTime==='number'?initialTime:Date.parse(initialTime)/1000):rows[active].time;
  const hoverContext=()=>['intraday',allRows,series.interval,series.source,series.product,chartType,tool,measurementState?.startDate,measurementState?.endDate,measurementState?.startPrice,measurementState?.endPrice];
  const retainedPointer=getChartHoverPointer(svg,hoverContext(),hoverSelection);

  const hover=index=>{const row=rows[index],previous=allRows[nearestIn(allRows,row.time)-1];if(row.kind==='forecast')return {...row,price:row.price,displayedPrice:display.toDisplay(row.price),display:display.metadata,source:'조건부 시나리오',product,completed:false};return {date:row.date,time:row.time,price:row.close,displayedPrice:display.toDisplay(row.close),display:display.metadata,open:row.open,high:row.high,low:row.low,close:row.close,volume:row.volume,volumeSource:series.source,volumeUnit:baseAsset,...barPriceChange(row.close,previous?.close,row.open),previousCloseDate:previous?.date??null,changeInterval:interval.label,kind:'observed',interval:interval.label,source:series.source,product,completed:true};};
  function mark(index,hovered=false,anchor=null,notify=true,pointerY=null){
    cursor=index;const row=rows[index],xx=x(row.time),tx=Math.max(L,Math.min(W-R-124,xx-62));
    vertical.setAttribute('x1',xx);vertical.setAttribute('x2',xx);dot.setAttribute('cx',xx);
    if(effectiveScale==='log'&&(anchor?.price??row.close)===0){for(const node of [horizontal,dot,priceTag])node.setAttribute('visibility','hidden');}
    else paintPriceCursor({horizontal,dot,tag:priceTag,axis,top:T,bottom:B,selectedPrice:anchor?.price??row.close,pointerY,formatPrice:axisLabels.price});
    axisText.fitNode(priceTag.querySelector('text'),{badge:true,kind:'cursor'});
    if(!Number.isFinite(pointerY)&&((anchor?.price??row.close)<axis.min||(anchor?.price??row.close)>axis.max))for(const node of [horizontal,dot,priceTag])node.setAttribute('visibility','hidden');
    dateTag.querySelector('rect').setAttribute('x',tx);dateTag.querySelector('rect').setAttribute('y',axisY-12);dateTag.querySelector('text').setAttribute('x',tx+62);dateTag.querySelector('text').setAttribute('y',axisY+1);dateTag.querySelector('text').textContent=timestamp(row.time);if(notify)onHover({...hover(index),hovered});
  }
  function inspection(index){const row=rows[index];if(row.kind==='forecast')return {label:`${row.candle?`${row.candle.startDate} – ${row.candle.endDate} · 모의 경로봉`:row.date.slice(0,10)} · 조건부 미래 가정`,date:row.date,product,kind:'forecast',fields:[{label:'시나리오 가격',value:money(row.price)},...(row.candle?[['시작값 O','open'],['경로 최고 H','high'],['경로 최저 L','low'],['끝값 C','close']].map(([label,key])=>({label,value:money(row.candle[key])})):[]),{label:'세 조건 범위 · 끝값 기준',value:row.interpolation?.unavailableBounds?.length?'로그축 0 경계 · 선형축에서 확인':`${money(row.low)} – ${money(row.high)}`}],note:row.candle?EQUITY_FORECAST_BAR_NOTE:row.interpolated?'계산일 사이를 표시 축에 맞춰 보간한 값입니다. 실제 체결·OHLC·새 재무 계산이 아닙니다.':'가격 목표·신뢰구간이 아닌 명시한 입력의 조건부 계산입니다.',sourceIds:row.sourceIds||[]};const snapshot=row.snapshot??series.snapshot,retrievedAt=row.retrievedAt||series.retrievedAt;return {label:`${equity?row.date.slice(0,10)+' 뉴욕 세션':timestamp(row.time)+' UTC'} · ${interval.label} 완료 봉`,date:row.date,product,kind:'observed',fields:[...(unit==='usd'?[]:[{label:display.label,value:price(row.close)},{label:'표시 기준 · UTC',value:`${display.baseDate} · ${money(display.basePrice)}`}]),{label:'시가 O',value:money(row.open)},{label:'고가 H',value:money(row.high)},{label:'저가 L',value:money(row.low)},{label:'종가 C',value:money(row.close)},{label:`거래량 · ${baseAsset}`,value:number(row.volume,6)},{label:'출처',value:`${series.source} · ${product}`}],note:`${snapshot?'저장 자료':'조회 자료'} · 수집 ${retrievedAt.replace('T',' ').slice(0,19)} UTC. ${equity?'뉴욕 거래 세션일 · 주식분할 조정 OHLC · 주 단위 거래량입니다.':'봉 시작 시각 기준이며 이 거래소 현물쌍의 물량입니다.'} ${series.gapCount?`${series.gapCount}개 빈 구간은 채우지 않았습니다.`:'완료된 실제 거래 봉만 표시합니다.'}`};}
  const measurementOverlay=createMeasurementOverlay(svg,{x:value=>x(Date.parse(value)/1000),y,left:L,right:W-R,top:T,bottom:B,small,formatPrice:money,formatDate:value=>timestamp(Date.parse(value)/1000).slice(5),formatChange:value=>`${value>0?'+':value<0?'−':''}${number(Math.abs(value),2)}%`,formatDuration:result=>{const minutes=result.deltaSeconds/60;return `${minutes>0?'+':''}${number(minutes,1)}분 · ${number(result.deltaSeconds/interval.seconds,1)}봉 간격`;}});
  const lookupMeasurement=value=>{const time=Date.parse(value)/1000,row=allRows[nearestIn(allRows,time)];return row.time===time?row:{date:value,price:NaN};};
  function renderMeasurement(preview=null){measurementOverlay.paint(measurePriceAnchors(measurementState,{lookup:lookupMeasurement,preview}),Boolean(measurementState&&!measurementState.endDate));}
  function anchorAt(index,event=null){
    const row=rows[index],box=event?svg.getBoundingClientRect():null,pointerY=event?Math.max(T,Math.min(B,(event.clientY-box.top)/box.height*H)):undefined;
    const magnetRow=row.kind==='forecast'?(chartType==='candles'&&row.candle?{date:row.date,...row.candle}:{date:row.date,price:row.price}):chartType==='candles'?row:{date:row.date,price:row.close};
    const point=resolveMagnetPoint({row:magnetRow,pointerY,y,invertY:axis.invert,mode:magnet,ctrlKey:event?.ctrlKey,metaKey:event?.metaKey,thresholdPx:(event?.pointerType==='touch'?20:12)*(box?H/box.height:1)});
    return point?{...point,date:row.date,kind:row.kind==='forecast'?'simulated':'observed'}:null;
  }
  function measure(index,anchor=null){hoverHandler.cancel();clearChartHoverPointer(svg);lastHovered=-1;lastPointer=null;active=Math.max(0,Math.min(rows.length-1,index));const point=anchor||anchorAt(active);mark(active,false,point);measurementState=advanceMeasurement(measurementState,point);renderMeasurement();measurementOverlay.showSnap(point);onMeasurement({...measurementState});}
  function commit(index,user=false,openPanel=user){hoverHandler.cancel();clearChartHoverPointer(svg);lastHovered=-1;lastPointer=null;active=Math.max(0,Math.min(rows.length-1,index));if(user)hoverSelection=rows[active].time;mark(active);onInspect(inspection(active),{user,openPanel});}
  const fromPointer=event=>{const box=svg.getBoundingClientRect(),px=(event.clientX-box.left)/box.width*W;return nearest(minTime+(Math.max(L,Math.min(W-R,px))-L)/(W-L-R)*(maxTime-minTime));};
  const inPlot=event=>{const box=svg.getBoundingClientRect(),px=(event.clientX-box.left)/box.width*W,py=(event.clientY-box.top)/box.height*H;return px>=L&&px<=W-R&&py>=T&&py<=bottom;};
  svg.onclick=event=>{hoverHandler.cancel();clearChartHoverPointer(svg);const evidence=event.target?.closest?.('[data-forecast-evidence]');if(evidence){if(projection.markerIds.has(evidence.dataset.forecastEvidence))onForecastEvidence(evidence.dataset.forecastEvidence);return;}const annotation=event.target?.closest?.('[data-research-annotation]');if(annotation){activateAnnotation(annotation.dataset.researchAnnotation,{user:true});return;}const history=event.target?.closest?.('[data-history-event]');if(history){if(historicalEventIds.has(history.dataset.historyEvent))onHistoricalEvent(history.dataset.historyEvent);return;}if(tool==='pan'||!inPlot(event))return;const index=fromPointer(event);if(tool==='measure'){const box=svg.getBoundingClientRect();if((event.clientY-box.top)/box.height*H>B)return;svg.focus({preventScroll:true});measure(index,anchorAt(index,event));}else commit(index,true);};
  function pointerPreview(event){
    if(event.pointerType==='touch'||event.target?.closest?.('[data-research-annotation],[data-history-event],[data-forecast-evidence]')||!inPlot(event)){clearChartHoverPointer(svg);return false;}
    rememberChartHoverPointer(svg,hoverContext(),event,[hoverSelection,rows[active].time]);
    const index=fromPointer(event),dataChanged=index!==lastHovered;
    if(!dataChanged&&lastPointer&&event.clientY===lastPointer.clientY&&Boolean(event.ctrlKey)===Boolean(lastPointer.ctrlKey)&&Boolean(event.metaKey)===Boolean(lastPointer.metaKey))return true;
    lastHovered=index;lastPointer=event;
    const anchor=tool==='measure'?anchorAt(index,event):null,box=svg.getBoundingClientRect(),pointerY=tool==='measure'?null:(event.clientY-box.top)/box.height*H;
    mark(index,true,anchor,dataChanged,pointerY);
    if(tool==='measure'){measurementOverlay.showSnap(anchor);if(measurementState&&!measurementState.endDate)renderMeasurement(anchor);}
    return true;
  }
  const hoverHandler=coalescedChartHover(svg,pointerPreview);svg.onpointermove=hoverHandler;
  svg.onpointerleave=event=>{if(event?.pointerType==='touch')return;hoverHandler.cancel();clearChartHoverPointer(svg);lastHovered=-1;lastPointer=null;mark(active);measurementOverlay.showSnap(null);if(measurementState&&!measurementState.endDate)renderMeasurement();};svg.onblur=null;
  svg.onkeyup=event=>{hoverHandler.cancel();if(tool==='measure'&&lastPointer&&['Control','Meta'].includes(event.key))pointerPreview({clientX:lastPointer.clientX,clientY:lastPointer.clientY,pointerType:lastPointer.pointerType,ctrlKey:event.ctrlKey,metaKey:event.metaKey});};
  svg.onkeydown=event=>{
    hoverHandler.cancel();
    if(tool==='measure'&&lastPointer&&['Control','Meta'].includes(event.key)){pointerPreview({clientX:lastPointer.clientX,clientY:lastPointer.clientY,pointerType:lastPointer.pointerType,ctrlKey:event.ctrlKey,metaKey:event.metaKey});return;}
    if(['Enter',' ','ArrowLeft','ArrowRight','Home','End','Escape'].includes(event.key))clearChartHoverPointer(svg);
    const evidence=event.target?.closest?.('[data-forecast-evidence]');if(evidence){if(['Enter',' '].includes(event.key)){event.preventDefault();event.stopPropagation();if(projection.markerIds.has(evidence.dataset.forecastEvidence))onForecastEvidence(evidence.dataset.forecastEvidence);}return;}
    const annotation=event.target?.closest?.('[data-research-annotation]');if(annotation){if(['Enter',' '].includes(event.key)){event.preventDefault();event.stopPropagation();activateAnnotation(annotation.dataset.researchAnnotation,{user:true});}return;}
    const history=event.target?.closest?.('[data-history-event]');if(history){if(['Enter',' '].includes(event.key)){event.preventDefault();event.stopPropagation();if(!event.repeat&&historicalEventIds.has(history.dataset.historyEvent))onHistoricalEvent(history.dataset.historyEvent);}return;}
    if(event.shiftKey||event.altKey||event.ctrlKey||event.metaKey)return;
    if(tool==='measure'&&['Enter',' '].includes(event.key)){event.preventDefault();event.stopPropagation();if(!event.repeat)measure(cursor);return;}
    if(tool==='measure'&&event.key==='Escape'){event.preventDefault();event.stopPropagation();measurementState=null;renderMeasurement();measurementOverlay.showSnap(null);onMeasurement(null);return;}
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();
    const index=event.key==='Home'?0:event.key==='End'?rows.length-1:active+(event.key==='ArrowRight'?1:-1);
    if(tool==='measure'){active=Math.max(0,Math.min(rows.length-1,index));mark(active);if(measurementState&&!measurementState.endDate)renderMeasurement(anchorAt(active));}
    else commit(index,true,false);
  };
  renderMeasurement();
  if(retainedPointer&&pointerPreview({...retainedPointer,target:svg})){
    if(tool!=='measure')onInspect(inspection(active),{user:false,openPanel:false});
  }else if(tool==='measure')mark(active);else commit(active);

  return {previewPointer(point){if(svg.onpointermove!==hoverHandler)return false;hoverHandler.cancel();return pointerPreview({...point,pointerType:'mouse',target:svg});},clearPreview(){if(svg.onpointermove!==hoverHandler)return false;svg.onpointerleave();return true;},getPriceScale(){return {...axis,left:L,right:W-R,display:display.metadata};},getSelection({anchor}={}){const index=Number.isFinite(anchor)?nearest(minTime+Math.max(0,Math.min(1,anchor))*(maxTime-minTime)):cursor;const detail=inspection(index);return {label:detail.label,copyText:[detail.label,...detail.fields.map(field=>`${field.label}: ${field.value}`),detail.note].join('\n')};},selectDate(value){commit(nearest(Date.parse(value)/1000),true);},previous(){commit(active-1,true);},next(){commit(active+1,true);},getDate(){return rows[active].date;},hasPrevious(){return active>0;},hasNext(){return active<rows.length-1;}};
}
