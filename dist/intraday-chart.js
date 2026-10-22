import {createPriceScale} from './chart-math.js?v=1.10.3';
import {chartInterval} from './ohlc-data.js?v=1.10.3';
import {chartPaneLayout,volumePaneMarkup} from './chart-overlays.js?v=1.10.3';
import { resolveMagnetPoint, advanceMeasurement, measurePriceAnchors, measurementOverlayMarkup, createMeasurementOverlay } from './chart-magnet.js?v=1.10.3';
import { clearChartHover, coalescedChartHover } from './chart-hover.js?v=1.10.3';
import { dateWindow, pixelExtrema } from './chart-window.js?v=1.10.3';

const numberFormats=new Map();
const number=(value,digits=2)=>{if(!numberFormats.has(digits))numberFormats.set(digits,new Intl.NumberFormat('en-US',{maximumFractionDigits:digits}));return numberFormats.get(digits).format(value);};
const money=value=>`$${number(value,value<1?6:2)}`;
const timestamp=time=>new Date(time*1000).toISOString().slice(0,16).replace('T',' ');
const esc=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export function drawIntradayChart({svg,series,chartType='candles',scale='log',unit='usd',tool='crosshair',magnet='off',measurement=null,onMeasurement=()=>{},range=null,historyStatus='ready',showVolume=true,headerInset=70,onHover=()=>{},onInspect=()=>{},selectedTime=null}) {
  clearChartHover(svg);
  const allRows=series.candles,interval=chartInterval(series.interval);
  if(!allRows.length)throw new RangeError('The market chart needs completed candles');
  const W=Math.max(1,Math.round(svg.clientWidth||1100)),H=Math.max(1,Math.round(svg.clientHeight||500)),small=W<600;
  const layout=chartPaneLayout({width:W,height:H,volume:showVolume,top:Number.isFinite(headerInset)?Math.max(12,headerInset):70});
  const {left:L,right:R,top:T,axisY,bottom,priceBottom:B,volumeTop,volumeBottom}=layout;
  const minTime=range?.start??allRows[0].time-interval.seconds,maxTime=range?.end??allRows.at(-1).time+interval.seconds;
  const rows=dateWindow(allRows,minTime,maxTime,row=>row.time);
  const x=time=>L+(time-minTime)/(maxTime-minTime)*(W-L-R);
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  Object.assign(svg.dataset,{plotLeft:String(L),plotRight:String(W-R),plotTop:String(T),plotBottom:String(bottom),priceBottom:String(B),scale,chartType,interval:series.interval,historyLabelCount:'0',historyEventCount:'0'});
  svg.parentElement?.style.setProperty('--plot-bottom-gap',`${H-bottom+6}px`);svg.parentElement?.style.setProperty('--plot-right-gap',`${R+7}px`);
  Object.assign(svg.dataset,{visiblePointCount:String(rows.length),observedCandleCount:String(rows.length),candleRendering:'none'});
  if(!rows.length){svg.innerHTML=`<text x="${Math.max(L+8,W/2)}" y="${Math.max(T+24,H/2-12)}" text-anchor="middle" fill="#9eb2ca" font-size="12"><tspan x="${W/2}" dy="0">${historyStatus==='loading'?'이 구간의 과거 봉을 불러오고 있습니다.':historyStatus==='error'?'과거 자료 조회에 실패했습니다.':'이 구간에는 완료된 거래 봉이 없습니다.'}</tspan><tspan x="${W/2}" dy="21">조회한 빈 구간은 채우지 않습니다.</tspan></text>`;svg.onclick=svg.onpointermove=svg.onpointerleave=svg.onkeydown=svg.onkeyup=null;onHover({date:new Date(minTime*1000).toISOString(),interval:interval.label,source:series.source,kind:'unavailable',completed:false,price:NaN,volume:NaN});return null;}
  const factor=unit==='indexed'?100/allRows.at(-1).close:1;
  const axis=createPriceScale(rows.flatMap(row=>[row.low,row.high]),{scale,top:T,bottom:B,tickCount:Math.max(2,Math.min(7,Math.floor((B-T)/45))),factor,paddingRatio:.12});
  const y=axis.y,price=value=>unit==='indexed'?number(value*factor):money(value);
  const clip=`${svg.id}-market-clip`,width=Math.max(.7,Math.min(14,(W-L-R)*interval.seconds/(maxTime-minTime)*.68));
  let s=`<title>${esc(series.source)} BTC-USD · ${interval.label} · ${chartType==='candles'?'캔들':'종가 선'}</title><desc>거래소가 제공한 완료 봉의 시가·고가·저가·종가와 BTC 거래량입니다. 빈 구간은 채우지 않습니다. 시간은 UTC입니다.</desc><defs><clipPath id="${clip}"><rect x="${L}" y="${T}" width="${W-L-R}" height="${B-T}"/></clipPath></defs>`;
  for(const tick of axis.ticks){const yy=y(tick);s+=`<line x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}" stroke="#26323e"/><text x="${W-R+7}" y="${yy+4}" fill="#acbacb" font-size="11">${esc(price(tick))}</text>`;}
  const tickStep=Math.max(1,Math.ceil(rows.length/(small?3:7)));
  for(let i=0;i<rows.length;i+=tickStep){const row=rows[i],xx=x(row.time),label=timestamp(row.time).slice(5);s+=`<line x1="${xx}" x2="${xx}" y1="${T}" y2="${bottom}" stroke="#212c37"/><text x="${xx}" y="${axisY}" text-anchor="${i===0?'start':'middle'}" fill="#aebaca" font-size="10">${label}</text>`;}
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
    for(const row of rows){if(run.length&&row.time-run.at(-1).time!==interval.seconds)flush();run.push(row);}flush();
    s+=`<path class="market-close-line" d="${path}" fill="none" stroke="#dce7f2" stroke-width="1.7"/>`;
  }
  s+='</g>';
  if(showVolume)s+=volumePaneMarkup({bars:rows,x:bar=>x(bar.time),left:L,right:W-R,top:volumeTop,bottom:volumeBottom,titleY:layout.volumeTitleY,titleFontSize:layout.volumeTitleFontSize,separatorY:layout.volumeSeparatorY,barWidth:width,source:series.source,clipId:`${svg.id}-volume-clip`}).markup;
  const last=allRows.at(-1);if(last.time<=maxTime&&last.time>=minTime)s+=`<line x1="${L}" x2="${W-R}" y1="${y(last.close)}" y2="${y(last.close)}" stroke="#74ab9e" stroke-dasharray="3 5" opacity=".6"/>`;
  s+=`<g id="${svg.id}-cross" pointer-events="none"><line class="cross-time" y1="${T}" y2="${bottom}" stroke="#adbed1" stroke-dasharray="3 3"/><line class="cross-price" x1="${L}" x2="${W-R}" stroke="#adbed1" stroke-dasharray="3 3"/><circle r="3" fill="#10151c" stroke="#d5e6f7"/><g class="market-price-tag"><rect x="${W-R}" width="${R-2}" height="18" rx="2" fill="#385466"/><text x="${W-R+4}" fill="#f0f5fa" font-size="10"/></g><g class="market-date-tag"><rect width="124" height="18" rx="2" fill="#39485b"/><text fill="#edf2f9" font-size="9" text-anchor="middle"/></g></g>`;
  s+=measurementOverlayMarkup(clip);
  svg.innerHTML=s;
  const cross=svg.querySelector('[id$="-cross"]'),vertical=cross.querySelector('.cross-time'),horizontal=cross.querySelector('.cross-price'),dot=cross.querySelector('circle'),priceTag=cross.querySelector('.market-price-tag'),dateTag=cross.querySelector('.market-date-tag');
  const nearestIn=(values,time)=>{let left=0,right=values.length-1;while(left<right){const mid=(left+right)>>1;if(values[mid].time<time)left=mid+1;else right=mid;}return left>0&&time-values[left-1].time<values[left].time-time?left-1:left;};
  const nearest=time=>nearestIn(rows,time);
  let measurementState=measurement?{...measurement,endDate:measurement.endDate??null}:null;
  const initialTime=tool==='measure'&&measurementState?(measurementState.endDate||measurementState.startDate):selectedTime;
  let active=initialTime?nearest(typeof initialTime==='number'?initialTime:Date.parse(initialTime)/1000):rows.length-1,cursor=active,lastHovered=-1,lastPointer=null;

  const hover=index=>{const row=rows[index],previous=rows[index-1];return {date:row.date,time:row.time,price:row.close,displayedPrice:row.close*factor,open:row.open,high:row.high,low:row.low,close:row.close,volume:row.volume,volumeSource:series.source,volumeUnit:'BTC',changePrice:row.close-row.open,changePct:(row.close/row.open-1)*100,previousCloseChangePct:previous?(row.close/previous.close-1)*100:null,kind:'observed',interval:interval.label,source:series.source,product:series.product,completed:true};};
  function mark(index,hovered=false,anchor=null,notify=true){cursor=index;const row=rows[index],markPrice=anchor?.price??row.close,xx=x(row.time),yy=y(markPrice),tx=Math.max(L,Math.min(W-R-124,xx-62));vertical.setAttribute('x1',xx);vertical.setAttribute('x2',xx);horizontal.setAttribute('y1',yy);horizontal.setAttribute('y2',yy);dot.setAttribute('cx',xx);dot.setAttribute('cy',yy);priceTag.querySelector('rect').setAttribute('y',yy-9);priceTag.querySelector('text').setAttribute('y',yy+4);priceTag.querySelector('text').textContent=price(markPrice);dateTag.querySelector('rect').setAttribute('x',tx);dateTag.querySelector('rect').setAttribute('y',axisY-12);dateTag.querySelector('text').setAttribute('x',tx+62);dateTag.querySelector('text').setAttribute('y',axisY+1);dateTag.querySelector('text').textContent=timestamp(row.time);if(notify)onHover({...hover(index),hovered});}
  function inspection(index){const row=rows[index],snapshot=row.snapshot??series.snapshot,retrievedAt=row.retrievedAt||series.retrievedAt;return {label:`${timestamp(row.time)} UTC · ${interval.label} 완료 봉`,date:row.date,kind:'observed',fields:[{label:'시가 O',value:money(row.open)},{label:'고가 H',value:money(row.high)},{label:'저가 L',value:money(row.low)},{label:'종가 C',value:money(row.close)},{label:'거래량 · BTC',value:number(row.volume,6)},{label:'출처',value:`${series.source} · ${series.product}`}],note:`${snapshot?'저장 자료':'조회 자료'} · 수집 ${retrievedAt.replace('T',' ').slice(0,19)} UTC. 봉 시작 시각 기준이며 이 거래소 현물쌍의 물량입니다. ${series.gapCount?`${series.gapCount}개 빈 구간은 채우지 않았습니다.`:'완료된 실제 거래 봉만 표시합니다.'}`};}
  const measurementOverlay=createMeasurementOverlay(svg,{x:value=>x(Date.parse(value)/1000),y,left:L,right:W-R,top:T,bottom:B,small,formatPrice:money,formatDate:value=>timestamp(Date.parse(value)/1000).slice(5),formatChange:value=>`${value>0?'+':value<0?'−':''}${number(Math.abs(value),2)}%`,formatDuration:result=>{const minutes=result.deltaSeconds/60;return `${minutes>0?'+':''}${number(minutes,1)}분 · ${number(result.deltaSeconds/interval.seconds,1)}봉 간격`;}});
  const lookupMeasurement=value=>{const time=Date.parse(value)/1000,row=allRows[nearestIn(allRows,time)];return row.time===time?row:{date:value,price:NaN};};
  function renderMeasurement(preview=null){measurementOverlay.paint(measurePriceAnchors(measurementState,{lookup:lookupMeasurement,preview}),Boolean(measurementState&&!measurementState.endDate));}
  function anchorAt(index,event=null){
    const row=rows[index],box=event?svg.getBoundingClientRect():null,pointerY=event?Math.max(T,Math.min(B,(event.clientY-box.top)/box.height*H)):undefined;
    const point=resolveMagnetPoint({row:chartType==='candles'?row:{date:row.date,price:row.close},pointerY,y,invertY:axis.invert,mode:magnet,ctrlKey:event?.ctrlKey,metaKey:event?.metaKey,thresholdPx:(event?.pointerType==='touch'?20:12)*(box?H/box.height:1)});
    return point?{...point,date:row.date,kind:'observed'}:null;
  }
  function measure(index,anchor=null){active=Math.max(0,Math.min(rows.length-1,index));const point=anchor||anchorAt(active);mark(active,false,point);measurementState=advanceMeasurement(measurementState,point);renderMeasurement();measurementOverlay.showSnap(point);onMeasurement({...measurementState});}
  function commit(index,user=false,openPanel=user){lastHovered=-1;active=Math.max(0,Math.min(rows.length-1,index));mark(active);onInspect(inspection(active),{user,openPanel});}
  const fromPointer=event=>{const box=svg.getBoundingClientRect(),px=(event.clientX-box.left)/box.width*W;return nearest(minTime+(Math.max(L,Math.min(W-R,px))-L)/(W-L-R)*(maxTime-minTime));};
  const inPlot=event=>{const box=svg.getBoundingClientRect(),px=(event.clientX-box.left)/box.width*W,py=(event.clientY-box.top)/box.height*H;return px>=L&&px<=W-R&&py>=T&&py<=bottom;};
  svg.onclick=event=>{hoverHandler.cancel();if(tool==='pan'||!inPlot(event))return;const index=fromPointer(event);if(tool==='measure'){const box=svg.getBoundingClientRect();if((event.clientY-box.top)/box.height*H>B)return;svg.focus({preventScroll:true});measure(index,anchorAt(index,event));}else commit(index,true);};
  function pointerPreview(event){
    if(event.pointerType==='touch'||!inPlot(event))return;const index=fromPointer(event),dataChanged=index!==lastHovered;
    if(!dataChanged&&(tool!=='measure'||(lastPointer&&event.clientY===lastPointer.clientY&&Boolean(event.ctrlKey)===Boolean(lastPointer.ctrlKey)&&Boolean(event.metaKey)===Boolean(lastPointer.metaKey))))return;
    lastHovered=index;const anchor=tool==='measure'?anchorAt(index,event):null;mark(index,true,anchor,dataChanged);
    if(tool==='measure'){lastPointer=event;measurementOverlay.showSnap(anchor);if(measurementState&&!measurementState.endDate)renderMeasurement(anchor);}
  }
  const hoverHandler=coalescedChartHover(svg,pointerPreview);svg.onpointermove=hoverHandler;
  svg.onpointerleave=()=>{hoverHandler.cancel();lastHovered=-1;lastPointer=null;mark(active);measurementOverlay.showSnap(null);if(measurementState&&!measurementState.endDate)renderMeasurement();};svg.onblur=null;
  svg.onkeyup=event=>{hoverHandler.cancel();if(tool==='measure'&&lastPointer&&['Control','Meta'].includes(event.key))pointerPreview({clientX:lastPointer.clientX,clientY:lastPointer.clientY,pointerType:lastPointer.pointerType,ctrlKey:event.ctrlKey,metaKey:event.metaKey});};
  svg.onkeydown=event=>{
    hoverHandler.cancel();
    if(tool==='measure'&&lastPointer&&['Control','Meta'].includes(event.key)){pointerPreview({clientX:lastPointer.clientX,clientY:lastPointer.clientY,pointerType:lastPointer.pointerType,ctrlKey:event.ctrlKey,metaKey:event.metaKey});return;}
    if(event.shiftKey||event.altKey||event.ctrlKey||event.metaKey)return;
    if(tool==='measure'&&['Enter',' '].includes(event.key)){event.preventDefault();event.stopPropagation();if(!event.repeat)measure(cursor);return;}
    if(tool==='measure'&&event.key==='Escape'){event.preventDefault();event.stopPropagation();measurementState=null;renderMeasurement();measurementOverlay.showSnap(null);onMeasurement(null);return;}
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();
    const index=event.key==='Home'?0:event.key==='End'?rows.length-1:active+(event.key==='ArrowRight'?1:-1);
    if(tool==='measure'){active=Math.max(0,Math.min(rows.length-1,index));mark(active);if(measurementState&&!measurementState.endDate)renderMeasurement(anchorAt(active));}
    else commit(index,true,false);
  };
  renderMeasurement();if(tool==='measure')mark(active);else commit(active);

  return {getSelection({anchor}={}){const index=Number.isFinite(anchor)?nearest(minTime+Math.max(0,Math.min(1,anchor))*(maxTime-minTime)):cursor;const detail=inspection(index);return {label:detail.label,copyText:[detail.label,...detail.fields.map(field=>`${field.label}: ${field.value}`),detail.note].join('\n')};},selectDate(value){commit(nearest(Date.parse(value)/1000),true);},previous(){commit(active-1,true);},next(){commit(active+1,true);},getDate(){return rows[active].date;},hasPrevious(){return active>0;},hasNext(){return active<rows.length-1;}};
}
