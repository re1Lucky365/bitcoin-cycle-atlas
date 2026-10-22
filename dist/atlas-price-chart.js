import { utcDay } from './cycle-engine.js?v=1.10.3';
import { shiftCalendarMonths } from './cycle-timing.js?v=1.10.3';
import { STATE_LABELS } from './market-structure.js?v=1.10.3';
import { chartPaneLayout, historicalMarkersMarkup, volumePaneMarkup, cycleTimingMarkup, formatBtcVolume } from './chart-overlays.js?v=1.10.3';
import { createPriceScale,nearestDailyIndex as nearest } from './chart-math.js?v=1.10.3';

import { resolveMagnetPoint, advanceMeasurement, measurePriceAnchors, measurementOverlayMarkup, createMeasurementOverlay } from './chart-magnet.js?v=1.10.3';

import { clearChartHover, coalescedChartHover } from './chart-hover.js?v=1.10.3';

import { dateWindow, intervalAtDate, upperBoundDate, pixelExtrema, pixelLineSegments } from './chart-window.js?v=1.10.3';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const numberFormats=new Map();
const nf=(v,n=0)=>{if(!numberFormats.has(n))numberFormats.set(n,new Intl.NumberFormat('en-US',{maximumFractionDigits:n}));return numberFormats.get(n).format(v);};
const money=v=>`$${nf(v,v<10?2:0)}`;
const percent=v=>`${v>0?'+':v<0?'−':''}${nf(Math.abs(v),1)}%`;
const date=v=>v?.replaceAll('-','.')??'—';
const compact=v=>v>=1e6?`${nf(v/1e6,1)}m`:v>=1e3?`${nf(v/1e3,v<1e4?1:0)}k`:nf(v,v<1?2:0);
// UTC date interpretation is immutable across data revisions. Bound the pure
// calendar cache; prices, model outputs and mutable source metadata are not cached.
const calendarDays=new Map();
const dayOf=date=>{if(calendarDays.has(date))return calendarDays.get(date);const value=utcDay(date);if(calendarDays.size>=32768)calendarDays.delete(calendarDays.keys().next().value);calendarDays.set(date,value);return value;};
const COLORS={warmup:'#536173','price-discovery':'#dfb567','bottom-formation':'#91a1ce',range:'#93a1b1',rebound:'#7ec5b7',pullback:'#bc9bb7',advance:'#81b79b',correction:'#d28f94',transition:'#697c91'};
const plainState={warmup:'초기 자료', 'price-discovery':'최고가를 새로 쓰는 중','bottom-formation':'낮은 가격대에서 회복 중',range:'좁은 범위에서 횡보',rebound:'하락 뒤 반등',pullback:'상승 중 되돌림',advance:'상승 흐름',correction:'하락 흐름',transition:'방향이 섞인 구간'};
const timingReasons={'causal-daily-clock-applied':'관측 보정을 근거리 시계에 반영','near-phase-unavailable':'적용할 근거리 기준 시계 없음','adjustment-would-expire-required-anchor':'보정하면 필수 기준일이 이미 지남','insufficient-causal-timing-evidence':'완료된 관측 근거 부족','calibration-reference-high-differs':'보정과 근거리 모형의 기준 고점이 다름','disabled-for-comparison':'비교 조건에서 보정 끔','legacy-calendar-prior':'기존 달력 기준 사용'};
function sample(rows,frequency){return frequency==='daily'?rows:rows.filter((p,i)=>new Date(`${p.date}T00:00:00Z`).getUTCDay()===0||i===0||i===rows.length-1);}

/** Rendering and inspection only. It never changes prices, paths or model dates. */
export function drawAtlasPriceChart({svg,tooltip,rows,start,end,split,frequency='daily',chartType='line',observedCandles=[],candleSource='Bitstamp',volumeBars=[],volumeProjection=null,volumeSource='Bitstamp',showVolume=false,historicalEvents=[],cycleCalibration=null,showCycleTiming=false,headerInset=null,showHistoricalEvents=true,activeHistoricalEventId=null,onHistoricalEvent=()=>{},stateStepDays=1,unit='usd',denominator=1,scale='log',tool='crosshair',magnet='off',measurement=null,onMeasurement=()=>{},onHover=()=>{},band=false,turns=[],showTurns=true,events=[],states=[],fib=[],historical=false,nextTurn=null,showNextTurnLabel=true,onNextTurn=()=>{},showDrawdown=true,showStates=false,threshold=.12,onInspect=()=>{},selectedDate}){
  clearChartHover(svg);
  // Match the allocated viewport instead of shrinking a fixed-height drawing.
  // An explicitly enabled secondary band stays present even in a short chart.
  const W=Math.max(1,Math.round(svg.clientWidth||svg.parentElement?.clientWidth||1100)),H=Math.max(1,Math.round(svg.clientHeight||svg.parentElement?.clientHeight||500)),small=W<600,compactHeight=H<320;
  const layout=chartPaneLayout({width:W,height:H,volume:showVolume,drawdown:showDrawdown,states:showStates,cycleTiming:showCycleTiming,top:Number.isFinite(headerInset)?Math.max(8,headerInset):compactHeight?62:70});
  const {left:L,right:R,top:T,axisY,priceBottom,ddTop,ddBottom,stateTop,stateBottom,volumeTop,volumeBottom,cycleTop,cycleBottom}=layout,stateHeight=stateBottom-stateTop,ddHeight=ddBottom-ddTop;
  const minDay=dayOf(start),maxDay=dayOf(end),span=Math.max(1,maxDay-minDay),xday=d=>L+(d-minDay)/span*(W-L-R),x=p=>xday(dayOf(p.date));
  svg.dataset.historyLabelCount='0';svg.dataset.historyEventCount='0';svg.dataset.historyLabelMode='off';svg.dataset.historyHiddenLabelCount='0';
  const originalVisible=dateWindow(rows,start,end).filter(p=>p.price>0);
  const candleDays=frequency==='weekly'?7:1;
  const candleRows=chartType==='candles'?dateWindow(observedCandles,start,split&&split<end?split:end,c=>c.endDate||c.date||new Date((c.time+(candleDays-1)*86400)*1000).toISOString().slice(0,10)).map(c=>({...c,startDate:c.startDate||new Date(c.time*1000).toISOString().slice(0,10),endDate:c.endDate||new Date((c.time+(candleDays-1)*86400)*1000).toISOString().slice(0,10)})).filter(c=>c.endDate>=start&&c.endDate<=end&&(!split||c.endDate<=split)):[];
  const candleByDate=new Map(candleRows.map(c=>[c.endDate,c]));
  const coveredDays=new Set();for(const c of candleRows)for(let day=dayOf(c.startDate);day<=dayOf(c.endDate);day++)coveredDays.add(day);
  const covered=date=>coveredDays.has(dayOf(date));
  const visible=candleRows.length?originalVisible.filter(p=>!covered(p.date)||candleByDate.has(p.date)).map(p=>candleByDate.has(p.date)?{...p,coinMetricsPrice:p.price,price:candleByDate.get(p.date).close,candle:candleByDate.get(p.date)}:p):originalVisible;
  if(!visible.length){svg.onclick=svg.onpointermove=svg.onpointerleave=svg.onkeydown=svg.onkeyup=null;delete svg.dataset.plotLeft;delete svg.dataset.plotRight;svg.innerHTML='<text x="24" y="60" fill="#c6d0dd">이 기간에는 아직 자료가 없습니다.</text>';return null;}
  const factor=unit==='indexed'?100/denominator:1;
  let valueLow=Infinity,valueHigh=-Infinity;const includePrice=value=>{if(Number.isFinite(value)&&value>0){valueLow=Math.min(valueLow,value);valueHigh=Math.max(valueHigh,value);}};
  for(const point of visible){includePrice(point.price);if(band&&point.lower>0&&point.upper>0){includePrice(point.lower);includePrice(point.upper);}}for(const candle of candleRows){includePrice(candle.low);includePrice(candle.high);}const values=[valueLow,valueHigh];
  const tickCount=Math.max(2,Math.min(small?5:7,Math.floor((priceBottom-T)/38)+1));
  const priceScale=createPriceScale(values,{scale,top:T,bottom:priceBottom,tickCount,factor}),{min,max,y}=priceScale;
  const yd=v=>ddTop+Math.min(100,Math.max(0,-(v??0)))/100*(ddBottom-ddTop);
  const path=(ps,yy=y,key='price')=>pixelExtrema(ps,x,[key]).map((p,i)=>`${i?'L':'M'}${x(p).toFixed(2)},${yy(p[key]).toFixed(2)}`).join('');
  const observed=sample(visible.filter(p=>!split||p.date<=split),frequency),future=sample(originalVisible.filter(p=>split&&p.date>=split),frequency).map(p=>({...p,lower:p.lower??p.price,upper:p.upper??p.price}));
  const bottom=showVolume?volumeBottom:showStates?stateBottom:showCycleTiming?cycleBottom:showDrawdown?ddBottom:priceBottom;
  const visibleVolume=dateWindow(volumeBars,start,split&&split<end?split:end),volumeByDate=new Map(visibleVolume.map(bar=>[bar.date,bar]));
  const allProjectedVolume=volumeProjection?.points||[];
  const projectedVolume=dateWindow(allProjectedVolume,start,end).filter(point=>point.kind==='scenario'&&split&&point.date>split);
  const projectedVolumeAt=date=>{const point=intervalAtDate(allProjectedVolume,date);return point?.kind==='scenario'&&split&&date>split?point:null;};
  const timingSeries=cycleCalibration?.series||[],visibleTiming=showCycleTiming?dateWindow(timingSeries,start,end):[];
  const clip=`${svg.id}-clip`,fullHistory=span>3000;
  let s=`<title>${historical?'실제 비트코인 가격':'실제 비트코인 가격과 미래 가정'}</title><desc>실선은 실제 관측, 점선은 가정에 따른 가격 예시입니다. 그래프를 누르면 값을 고정해 읽을 수 있습니다. 미래 음영은 보정된 확률 구간이 아닙니다.</desc><defs><clipPath id="${clip}"><rect x="${L}" y="${T}" width="${W-L-R}" height="${bottom-T}"/></clipPath></defs>`;
  for(const price of priceScale.ticks){const value=price*factor,yy=y(price);s+=`<line x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}" stroke="#28323f"/><text x="${W-R+8}" y="${yy+4}" text-anchor="start" fill="#b0bbca" font-size="12">${unit==='usd'?'$':''}${compact(value)}</text>`;}
  let months=span>5000?(small?60:24):span>3000?(small?36:24):span>1100?(small?12:6):span>550?(small?6:3):span>270?3:1;
  let tick=`${start.slice(0,4)}-01-01`;while(dayOf(tick)<minDay)tick=shiftCalendarMonths(tick,months);
  while(dayOf(tick)<=maxDay){const xx=xday(dayOf(tick));s+=`<line x1="${xx}" x2="${xx}" y1="${T}" y2="${bottom}" stroke="#222c37"/><text x="${xx}" y="${axisY}" text-anchor="${xx>W-35?'end':'middle'}" fill="#aebaca" font-size="12">${months>=12?tick.slice(0,4):tick.slice(2,7).replace('-','.')}</text>`;tick=shiftCalendarMonths(tick,months);}
  if(split&&dayOf(split)>=minDay&&dayOf(split)<=maxDay){
    const xx=xday(dayOf(split)),badgeWidth=Math.min(78,Math.max(0,W-R-L-8)),preferredX=xx-L>=badgeWidth+10?xx-badgeWidth-6:xx+6;
    const badgeX=Math.max(L+4,Math.min(W-R-badgeWidth-4,preferredX)),fontSize=Math.min(small?10:11,Math.max(0,badgeWidth-12)/6);
    s+=`<rect x="${xx}" y="${T}" width="${W-R-xx}" height="${bottom-T}" fill="#e9b366" opacity=".025"/><line x1="${xx}" x2="${xx}" y1="${T}" y2="${bottom}" stroke="#a5b1bf" stroke-dasharray="3 5"/><g class="observed-split-badge" pointer-events="none"><title>관측 기준일 ${split} UTC</title><rect x="${badgeX}" y="${T+3}" width="${badgeWidth}" height="19" rx="3" fill="#152333" fill-opacity=".95"/><text x="${badgeX+badgeWidth/2}" y="${T+16}" text-anchor="middle" fill="#b9c5d2" font-size="${fontSize}">관측 ${split.slice(5).replace('-','.')}</text></g>`;
  }
  if(showDrawdown){s+=`<text x="${L}" y="${layout.ddTitleY}" fill="#aebaca" font-size="${layout.ddTitleFontSize}">이전 최고가에서 떨어진 폭</text>`;for(const dd of(ddHeight<44?[0,-100]:[0,-50,-100]))s+=`<line x1="${L}" x2="${W-R}" y1="${yd(dd)}" y2="${yd(dd)}" stroke="#25303c"/><text x="${W-R+8}" y="${yd(dd)+4}" text-anchor="start" fill="#aab7c8" font-size="11">${dd}%</text>`;}
  s+=`<g clip-path="url(#${clip})">`;
  if(nextTurn){const left=xday(Math.max(minDay,dayOf(nextTurn.lowerDate||nextTurn.date))),right=xday(Math.min(maxDay,dayOf(nextTurn.upperDate||nextTurn.date)));if(right>left)s+=`<rect x="${left}" y="${T}" width="${right-left}" height="${priceBottom-T}" fill="#87bde7" opacity=".065"/>`;}
  if(band&&future.length){s+=`<path d="${path(future,y,'upper')}${pixelExtrema(future,x,['lower']).reverse().map(p=>`L${x(p).toFixed(2)},${y(p.lower).toFixed(2)}`).join('')}Z" fill="#efb45f" opacity=".13"/>`;}
  for(const f of fib.filter(f=>f.price>min&&f.price<max&&(!f.startDate||f.startDate<=end))){const yy=y(f.price),from=xday(Math.max(minDay,f.startDate?dayOf(f.startDate):minDay));s+=`<line x1="${from}" x2="${W-R}" y1="${yy}" y2="${yy}" stroke="#b4a7d6" opacity=".55" stroke-dasharray="3 5"/><text x="${W-R-4}" y="${yy-5}" text-anchor="end" fill="#c2b5e0" font-size="11">${nf(f.ratio*100,1)}% · ${unit==='usd'?money(f.price):nf(f.price*factor,1)}</text>`;}
  if(observed.length){const line=pixelLineSegments(observed,x,['price'],point=>Boolean(point.candle)).map(segment=>segment.map((p,i)=>`${i?'L':'M'}${x(p).toFixed(2)},${y(p.price).toFixed(2)}`).join('')).join('');s+=`<path class="observed-close-line" d="${line}" fill="none" stroke="#e2eaf3" stroke-width="1.8"/>`;}
  const candleWidth=Math.max(.7,Math.min(12,(W-L-R)*candleDays/span*.68));
  const denseCandles=candleRows.length>256&&candleWidth<2;
  if(denseCandles){
    const wicks=['',''],bodies=['',''];
    for(const c of candleRows){const xx=xday(dayOf(c.endDate)),side=c.close>=c.open?0:1,top=Math.min(y(c.open),y(c.close)),height=Math.max(1,Math.abs(y(c.open)-y(c.close)));wicks[side]+=`M${xx.toFixed(2)},${y(c.high).toFixed(2)}V${y(c.low).toFixed(2)}`;bodies[side]+=`M${(xx-candleWidth/2).toFixed(2)},${top.toFixed(2)}h${candleWidth.toFixed(2)}v${height.toFixed(2)}h${(-candleWidth).toFixed(2)}Z`;}
    s+=`<g class="observed-candles-batched" data-count="${candleRows.length}"><title>${candleRows.length}개 실제 캔들 · 모든 OHLC를 보존하며, 날짜 선택으로 정확한 값을 확인합니다.</title>`;
    for(let side=0;side<2;side++){const color=side?'#dd7e8d':'#62bca5';if(wicks[side])s+=`<path d="${wicks[side]}" fill="none" stroke="${color}"/>`;if(bodies[side])s+=`<path d="${bodies[side]}" fill="${color}"/>`;}s+='</g>';
  }else {
  for(const c of candleRows){const xx=xday(dayOf(c.endDate)),color=c.close>=c.open?'#62bca5':'#dd7e8d',top=Math.min(y(c.open),y(c.close)),height=Math.max(1,Math.abs(y(c.open)-y(c.close)));s+=`<g class="observed-candle" data-date="${c.endDate}" data-open="${c.open}" data-high="${c.high}" data-low="${c.low}" data-close="${c.close}"><line x1="${xx}" x2="${xx}" y1="${y(c.high)}" y2="${y(c.low)}" stroke="${color}"/><rect x="${xx-candleWidth/2}" y="${top}" width="${candleWidth}" height="${height}" fill="${color}"/><title>${esc(candleSource)} BTC-USD · ${c.startDate}${candleDays>1?`–${c.endDate}`:''} UTC · O ${money(c.open)} H ${money(c.high)} L ${money(c.low)} C ${money(c.close)}</title></g>`;}
  }
  if(future.length)s+=`<path d="${path(future)}" fill="none" stroke="#f2b960" stroke-width="1.8" stroke-dasharray="5 3"/>`;
  if(showDrawdown){if(observed.length)s+=`<path d="${path(observed,yd,'drawdownPct')}" fill="none" stroke="#a7b8cd" stroke-width="1.1"/>`;if(future.length)s+=`<path d="${path(future,yd,'drawdownPct')}" fill="none" stroke="#cba069" stroke-width="1.1" stroke-dasharray="4 3"/>`;}
  if(showStates){let segments=[];for(const p of dateWindow(states,start,end)){const last=segments.at(-1);if(last&&last.state===p.state)last.end=p.date;else segments.push({start:p.date,end:p.date,state:p.state});}for(const seg of segments){const xx=xday(dayOf(seg.start)),width=xday(dayOf(seg.end)+stateStepDays)-xx;s+=`<rect x="${xx}" y="${stateTop}" width="${Math.max(.7,width)}" height="${stateHeight}" fill="${COLORS[seg.state]||COLORS.transition}"><title>${esc(STATE_LABELS[seg.state])} ${seg.start}–${seg.end}</title></rect>`;}}
  const confirmedTurns=turns.filter(point=>point.confirmationDate).sort((a,b)=>a.confirmationDate.localeCompare(b.confirmationDate));
  const turnAt=value=>{const point=confirmedTurns[upperBoundDate(confirmedTurns,value,turn=>turn.confirmationDate)-1];return point?{...point,kind:split&&point.date>split?'simulated':'observed'}:null;};
  const visibleTurns=turns.filter(p=>p.date>=start&&p.date<=end);
  if(showTurns)for(const p of visibleTurns){const actual=!split||p.date<=split,color=p.type==='high'?'#e7bb73':'#85bfdc';s+=`<circle data-date="${p.date}" cx="${xday(dayOf(p.date))}" cy="${y(p.price)}" r="${fullHistory?2.5:4}" fill="${actual?color:'#10151c'}" stroke="${color}" stroke-width="1.4"><title>${esc(`${actual?'관측':'예시 경로'} ${p.type==='high'?'고점':'저점'} ${date(p.date)} · ${money(p.price)}`)}</title></circle>`;}
  s+='</g>';
  if(showCycleTiming)s+=cycleTimingMarkup({points:visibleTiming,x,left:L,right:W-R,top:cycleTop,bottom:cycleBottom,titleY:layout.cycleTitleY,titleFontSize:layout.cycleTitleFontSize,dayWidth:(W-L-R)/span,split}).markup;
  if(showVolume)s+=volumePaneMarkup({bars:visibleVolume,x:bar=>xday(dayOf(bar.date)),left:L,right:W-R,top:volumeTop,bottom:volumeBottom,titleY:layout.volumeTitleY,titleFontSize:layout.volumeTitleFontSize,separatorY:layout.volumeSeparatorY,barWidth:Math.max(.6,Math.min(12,(W-L-R)*candleDays/span*.72)),source:volumeSource,projectionLabel:volumeProjection?.summary?.centralMethod==='persistence'?'중앙 · 최근 90일 활동 유지':'점선 · 조건부 평균 거래량',projection:projectedVolume,clipId:`${svg.id}-volume-clip`,futureX:split&&dayOf(split)>=minDay&&dayOf(split)<maxDay?xday(dayOf(split)):null}).markup;
  if(showHistoricalEvents){
    const actual=originalVisible.filter(point=>!split||point.date<=split);
    const anchors=historicalEvents.filter(event=>event.date>=start&&event.date<=end&&actual.length&&event.date>=actual[0].date&&(!split||event.date<=split)).map(event=>{const point=actual[nearest(actual,dayOf(event.date))];return {event,x:xday(dayOf(event.date)),y:y(point.price)};});
    const labels=historicalMarkersMarkup(anchors,{left:L,right:W-R,top:T+5,bottom:priceBottom-4,visibleSpanDays:span,activeEventId:activeHistoricalEventId});
    s+=`<g class="history-events-layer">${labels.markup}</g>`;svg.dataset.historyLabelCount=String(labels.labelCount);svg.dataset.historyEventCount=String(labels.totalCount);svg.dataset.historyLabelMode=labels.labelMode;svg.dataset.historyHiddenLabelCount=String(labels.hiddenLabelCount);
  }else{svg.dataset.historyLabelCount='0';svg.dataset.historyEventCount='0';svg.dataset.historyLabelMode='off';svg.dataset.historyHiddenLabelCount='0';}
  if(nextTurn&&nextTurn.date>=start&&nextTurn.date<=end){const xx=xday(dayOf(nextTurn.date)),headerFixed=small||fullHistory,anchor=headerFixed||xx>W-190?'end':'start',tx=headerFixed?W-R:anchor==='end'?xx-7:xx+7,label=`${nextTurn.type==='high'?'조정':'반등'} 후보 · D-${nf(nextTurn.days)}`,width=132,left=anchor==='end'?tx-width:tx-5,badgeY=Math.max(2,T-29);s+=`<line x1="${xx}" x2="${xx}" y1="${T}" y2="${bottom}" stroke="#9bc8e8" stroke-dasharray="4 5" opacity=".8"/>`;if(showNextTurnLabel)s+=`<g data-next-turn="${nextTurn.type}" role="button" tabindex="0" aria-label="${esc(label)} · 날짜와 범위 보기" style="cursor:pointer"><title>가정 · ${date(nextTurn.date)} · ${date(nextTurn.lowerDate)}–${date(nextTurn.upperDate)}</title><rect x="${left}" y="${badgeY}" width="${width+5}" height="23" rx="3" fill="#172737"/><text x="${tx}" y="${badgeY+15}" text-anchor="${anchor}" fill="#badcf2" font-size="11">${esc(label)}</text></g>`;}
  if(!fullHistory&&!small){let lastX=-999;for(const event of events.filter(p=>p.date>=start&&p.date<=end)){const xx=xday(dayOf(event.date)),yy=xx-lastX<140?T+30:T+16;lastX=xx;s+=`<line x1="${xx}" x2="${xx}" y1="${yy+8}" y2="${priceBottom}" stroke="#bca176" stroke-dasharray="2 6" opacity=".45"/><text x="${Math.min(W-R-5,xx)}" y="${yy}" text-anchor="${xx>W-180?'end':'start'}" fill="#c6ad88" font-size="11">${esc(event.shortLabel||event.label)}</text>`;}}
  const latest=originalVisible.find(p=>p.date===split);
  if(latest){const yy=y(latest.price);s+=`<line x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}" stroke="#7da89c" stroke-dasharray="2 5" opacity=".5"/><rect x="${W-R}" y="${yy-9}" width="${R-3}" height="18" rx="2" fill="#2b6558"/><text x="${W-R+5}" y="${yy+4}" fill="#edf8f3" font-size="${small?10:11}">${unit==='usd'?money(latest.price):nf(latest.price*factor,1)}</text>`;}
  s+=`<g id="${svg.id}-cross" pointer-events="none"><line class="cross-time" y1="${T}" y2="${bottom}" stroke="#afc4dd" stroke-dasharray="3 3" opacity=".6"/><line class="cross-price" x1="${L}" x2="${W-R}" stroke="#afc4dd" stroke-dasharray="3 3" opacity=".6"/><circle r="4" fill="#10151c" stroke="#f4dcac" stroke-width="1.5"/><g class="cross-price-tag"><rect x="${W-R}" width="${R-3}" height="18" rx="2" fill="#465366"/><text x="${W-R+5}" fill="#edf2f9" font-size="${small?10:11}"></text></g><g class="cross-date-tag"><rect width="80" height="18" rx="2" fill="#39485b"/><text fill="#edf2f9" font-size="10" text-anchor="middle"></text></g></g>`;
  s+=measurementOverlayMarkup(clip);
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.dataset.plotLeft=String(L);svg.dataset.plotRight=String(W-R);svg.dataset.plotTop=String(T);svg.dataset.plotBottom=String(bottom);svg.dataset.priceBottom=String(priceBottom);svg.parentElement?.style.setProperty('--plot-bottom-gap',`${H-bottom+6}px`);svg.parentElement?.style.setProperty('--plot-right-gap',`${R+7}px`);svg.dataset.scale=scale;svg.dataset.tool=tool;svg.dataset.chartType=chartType;svg.dataset.visiblePointCount=String(visible.length);svg.dataset.observedCandleCount=String(candleRows.length);svg.dataset.candleRendering=denseCandles?'batched':'individual';svg.innerHTML=s;
  const cross=svg.querySelector('[id$="-cross"]'),crossLine=cross.querySelector('.cross-time'),crossPrice=cross.querySelector('.cross-price'),crossDot=cross.querySelector('circle'),priceTag=cross.querySelector('.cross-price-tag'),dateTag=cross.querySelector('.cross-date-tag'),stateByDate=new Map(dateWindow(states,start,end).map(p=>[p.date,p]));
  let measurementState=measurement?{...measurement,endDate:measurement.endDate??null}:null;
  const initialDate=tool==='measure'&&measurementState?(measurementState.endDate||measurementState.startDate):(selectedDate||split||visible.at(-1).date);
  let active=nearest(visible,dayOf(initialDate)),pinned=false,cursor=active,lastHovered=-1,lastPointer=null;
  const hoverInfo=(index,hovered)=>{const point=visible[index],previous=rows[nearest(rows,dayOf(point.date))-1],c=point.candle,v=volumeByDate.get(point.date),projected=projectedVolumeAt(point.date);return {date:point.date,price:point.price,displayedPrice:point.price*factor,changePrice:c?c.close-c.open:previous?point.price-previous.price:null,changePct:c?(c.close/c.open-1)*100:previous?(point.price/previous.price-1)*100:null,drawdownPct:c?null:point.drawdownPct??null,kind:split&&point.date>split?'simulated':'observed',...(v?{volume:v.volume,volumeSource,volumeUnit:'BTC',volumeStartDate:v.startDate||v.date,volumeEndDate:v.endDate||v.date}:{}),...(projected?{volume:projected.volume,volumeLower:projected.lower,volumeUpper:projected.upper,volumeKind:'scenario',volumeSource,volumeUnit:'BTC',volumeStartDate:projected.startDate,volumeEndDate:projected.endDate}:{}),...(c?{open:c.open,high:c.high,low:c.low,close:c.close,volume:c.volume,source:candleSource,product:'BTC-USD',interval:frequency==='weekly'?'1W':'1D',completed:true}:{}),lower:point.lower,upper:point.upper,marketState:stateByDate.get(point.date)?.state,marketStateLabel:plainState[stateByDate.get(point.date)?.state],cycleTiming:split&&point.date>split?cycleCalibration?.current:intervalAtDate(timingSeries,point.date),turn:turnAt(point.date),fib,hovered};};
  const measurementMoney=value=>`$${nf(value,Math.abs(value)<1?6:2)}`;
  const measurementOverlay=createMeasurementOverlay(svg,{x:value=>xday(dayOf(value)),y,left:L,right:W-R,top:T,bottom:priceBottom,small,formatPrice:measurementMoney,formatDate:date,formatChange:percent,formatDuration:result=>`${result.deltaDays>0?'+':''}${result.deltaDays}일`});
  const lookupMeasurement=value=>{const point=rows[nearest(rows,value)],candle=candleByDate.get(point.date);return candle?{...point,price:candle.close}:point;};
  function renderMeasurement(preview=null){measurementOverlay.paint(measurePriceAnchors(measurementState,{lookup:lookupMeasurement,split,preview}),Boolean(measurementState&&!measurementState.endDate));}
  function anchorAt(index,event=null){
    const row=visible[index],box=event?svg.getBoundingClientRect():null;
    const pointerY=event?Math.max(T,Math.min(priceBottom,(event.clientY-box.top)/box.height*H)):undefined;
    const point=resolveMagnetPoint({row,pointerY,y,invertY:priceScale.invert,mode:magnet,ctrlKey:event?.ctrlKey,metaKey:event?.metaKey,thresholdPx:(event?.pointerType==='touch'?20:12)*(box?H/box.height:1)});
    return point?{...point,date:row.date,kind:split&&row.date>split?'simulated':'observed'}:null;
  }

  const inspection=index=>{const p=visible[index],isFuture=Boolean(split&&p.date>split),isLong=isFuture&&(p.phase==='long-horizon'||p.kind==='conditional-long-horizon-path'),flow=stateByDate.get(p.date),event=visibleTurns.find(t=>t.date===p.date),fields=[{label:unit==='usd'?'가격 · 달러':'최근 관측 가격 = 100',value:unit==='usd'?money(p.price):nf(p.price*factor,1)},{label:'이전 최고가 대비',value:percent(p.drawdownPct)},{label:'가격 흐름',value:plainState[flow?.state]||'—'}];
    if(p.candle){fields.splice(0,fields.length,{label:'시가 O',value:money(p.candle.open)},{label:'고가 H',value:money(p.candle.high)},{label:'저가 L',value:money(p.candle.low)},{label:'종가 C',value:money(p.candle.close)},{label:'거래량 · BTC',value:nf(p.candle.volume,4)},{label:'출처',value:`${candleSource} · BTC-USD`});}
    const volume=volumeByDate.get(p.date);if(!p.candle&&volume)fields.push({label:'거래량 · BTC',value:nf(volume.volume,4)},{label:'거래량 출처',value:`${volumeSource} · BTC/USD 현물`});
    const projected=projectedVolumeAt(p.date);
    if(projected)fields.push({label:`거래량 가정 · BTC/${frequency==='weekly'?'주':'일'}`,value:nf(projected.volume,2)},{label:'거래량 민감도 범위',value:`${nf(projected.lower,2)}–${nf(projected.upper,2)} BTC`},{label:'거래량 기간 · UTC',value:projected.startDate===projected.endDate?projected.date:`${projected.startDate}–${projected.endDate}`},{label:'달러 환산 가정',value:money(projected.usdProxy)});
    if(showCycleTiming){
      const timing=isFuture?cycleCalibration?.current:intervalAtDate(timingSeries,p.date);
      if(timing?.causal){
        if(isFuture){
          const application=cycleCalibration?.forecastApplication;
          fields.push({label:'적용한 사이클 보정',value:application?.applied===true?timing.label||timing.state:application?'미적용':'적용 정보 없음'},{label:'시계 이동 · 일',value:Number.isFinite(application?.appliedShiftDays)?nf(application.appliedShiftDays,1):'—'},{label:'보정 적용 상태',value:timingReasons[application?.reason]||'적용 여부를 확인할 수 없습니다.'});
        }else fields.push({label:'관측 기반 사이클 시계',value:timing.label||timing.state},{label:'시계 이동 · 일',value:nf(timing.appliedShiftDays??timing.shiftDays,1)},{label:'조건부 주기 길이 · 일',value:nf(timing.cycleLengthDays,1)});
      }
    }
    if(event)fields.push({label:isFuture?'예시에서 확인한 날':'방향 전환 확인일',value:date(event.confirmationDate)});
    if(isFuture&&p.lower&&(!event||isLong))fields.push({label:isLong?'경제 가정 범위':'여러 예시의 가격 범위',value:`${money(p.lower)}–${money(p.upper)}`});
    if(isLong&&Number.isFinite(p.baselinePrice))fields.push({label:'가치평가 기준 가격',value:money(p.baselinePrice)});
    if(isLong&&Number.isFinite(p.annualizedVolatilityPct))fields.push({label:'연환산 변동성 가정',value:`${nf(p.annualizedVolatilityPct,1)}%`});
    if(isLong&&Number.isFinite(p.realizedVolPct))fields.push({label:'가정 경로의 계산 변동성',value:`${nf(p.realizedVolPct,1)}%`});
    return {label:`${date(p.date)}${event?` · ${event.type==='high'?'고점':'저점'}${isFuture?' 예시':''}`:''}`,date:p.date,kind:isFuture?'simulated':'observed',fields,note:(p.candle?`${candleSource} 실제 거래소의 완료 ${frequency==='weekly'?'주':'일'}봉입니다. 캔들 ${p.candle.startDate}–${p.candle.endDate} UTC. 과거 종가 선과 미래 가정의 연결 기준은 Coin Metrics이며 거래소 종가와 다를 수 있습니다.`:isLong?'가격선과 범위는 경제적 채택 가정에 따른 예시입니다. 가치평가 기준과 변동성 가정은 모델 입력이며, 가정 경로의 계산 변동성은 그 예시에서 따로 계산한 값입니다. 실제 미래의 실현 변동성이나 확률이 보정된 예측구간을 뜻하지 않습니다.':isFuture?'선택한 가정의 예시입니다. 가격 범위는 확률이 보정된 예측구간이 아닙니다.':event?`가격이 꺾인 날과, 반대 방향으로 ${nf(threshold*100)}% 이동해 확인한 날을 구분합니다.`:frequency==='weekly'?'선은 주간 마지막 가격, 선택한 값은 해당 날짜의 일말 가격입니다.':`Coin Metrics의 하루 말 가격입니다. 장중 최고·최저가와 다를 수 있습니다.${volume?` 거래량은 ${volumeSource} BTC/USD 현물의 ${volume.startDate||volume.date}${volume.endDate?'–'+volume.endDate:''} UTC 합계이며 전 세계 거래량이 아닙니다.`:''}`)+(projected?` 거래량 점선은 ${volumeSource} BTC/USD 자료로 보정한 조건부 평균 거래량입니다. 음영은 가정 민감도이며 확률구간이 아닙니다. 달러 환산은 기준 가격 × 가정 BTC 수량으로, 실제 VWAP 거래대금이나 전 세계 합계가 아닙니다.`:''),...(projected?{sources:[{url:'https://github.com/twoimo/bitcoin-cycle-atlas/blob/main/docs/VOLUME_FORECAST_MODEL.md',title:'거래량 모형 · 과거 검증 · 장기 가정'}]}:{})};};
  function mark(index,anchor=null){cursor=index;const p=visible[index],markPrice=anchor?.price??p.price,xx=x(p),yy=y(markPrice),tx=Math.max(L,Math.min(W-R-80,xx-40));crossLine.setAttribute('x1',xx);crossLine.setAttribute('x2',xx);crossPrice.setAttribute('y1',yy);crossPrice.setAttribute('y2',yy);crossDot.setAttribute('cx',xx);crossDot.setAttribute('cy',yy);priceTag.querySelector('rect').setAttribute('y',yy-9);priceTag.querySelector('text').setAttribute('y',yy+4);priceTag.querySelector('text').textContent=unit==='usd'?money(markPrice):nf(markPrice*factor,1);dateTag.querySelector('rect').setAttribute('x',tx);dateTag.querySelector('rect').setAttribute('y',axisY-12);dateTag.querySelector('text').setAttribute('x',tx+40);dateTag.querySelector('text').setAttribute('y',axisY+1);dateTag.querySelector('text').textContent=p.date;}

  function commit(index,pin=true,user=pin){lastHovered=-1;active=Math.max(0,Math.min(visible.length-1,index));pinned=pin;mark(active);if(tooltip)tooltip.hidden=true;onHover(hoverInfo(active,false));onInspect(inspection(active),{user,openPanel:pin});}
  function measure(index,anchor=null){
    active=Math.max(0,Math.min(visible.length-1,index));const point=anchor||anchorAt(active);mark(active,point);onHover(hoverInfo(active,false));
    measurementState=advanceMeasurement(measurementState,point);
    renderMeasurement();measurementOverlay.showSnap(point);onMeasurement({...measurementState});
  }

  function fromPointer(e){const target=e.target.closest?.('[data-date]');if(target)return nearest(visible,dayOf(target.dataset.date));const rect=svg.getBoundingClientRect(),px=(e.clientX-rect.left)/rect.width*W;return nearest(visible,minDay+(Math.max(L,Math.min(W-R,px))-L)/(W-L-R)*span);}
  const inPlot=e=>{const box=svg.getBoundingClientRect(),px=(e.clientX-box.left)/box.width*W,py=(e.clientY-box.top)/box.height*H;return px>=L&&px<=W-R&&py>=T&&py<=bottom;};
  svg.onclick=e=>{hoverHandler.cancel();const history=e.target.closest?.('[data-history-event]');if(history){onHistoricalEvent(history.dataset.historyEvent);return;}if(e.target.closest?.('[data-next-turn]')){onNextTurn();return;}if(tool==='pan'||!inPlot(e))return;if(tool==='measure'){const box=svg.getBoundingClientRect();if((e.clientY-box.top)/box.height*H>priceBottom)return;svg.focus({preventScroll:true});measure(fromPointer(e),anchorAt(fromPointer(e),e));return;}commit(fromPointer(e));};
  function pointerPreview(e){
    if(e.pointerType==='touch'||e.target?.closest?.('[data-next-turn],[data-history-event]')||!inPlot(e))return;
    const index=fromPointer(e),dataChanged=index!==lastHovered;if(index===lastHovered&&(tool!=='measure'||(lastPointer&&e.clientY===lastPointer.clientY&&Boolean(e.ctrlKey)===Boolean(lastPointer.ctrlKey)&&Boolean(e.metaKey)===Boolean(lastPointer.metaKey))))return;lastHovered=index;
    const anchor=tool==='measure'?anchorAt(index,e):null;mark(index,anchor);if(dataChanged)onHover(hoverInfo(index,true));
    if(tool==='measure'){lastPointer=e;measurementOverlay.showSnap(anchor);if(measurementState&&!measurementState.endDate)renderMeasurement(anchor);}
    if(tooltip)tooltip.hidden=true;
  }
  const hoverHandler=coalescedChartHover(svg,pointerPreview);svg.onpointermove=hoverHandler;
  svg.onpointerleave=()=>{hoverHandler.cancel();lastHovered=-1;lastPointer=null;mark(active);measurementOverlay.showSnap(null);onHover(hoverInfo(active,false));if(measurementState&&!measurementState.endDate)renderMeasurement();if(tooltip)tooltip.hidden=true;};
  svg.onkeyup=e=>{hoverHandler.cancel();if(tool==='measure'&&lastPointer&&['Control','Meta'].includes(e.key))pointerPreview({clientX:lastPointer.clientX,clientY:lastPointer.clientY,pointerType:lastPointer.pointerType,target:lastPointer.target,ctrlKey:e.ctrlKey,metaKey:e.metaKey});};

  svg.onblur=()=>{if(tooltip&&!pinned)tooltip.hidden=true;};
  svg.onkeydown=e=>{
    hoverHandler.cancel();
    if(tool==='measure'&&lastPointer&&['Control','Meta'].includes(e.key)){pointerPreview({clientX:lastPointer.clientX,clientY:lastPointer.clientY,pointerType:lastPointer.pointerType,target:lastPointer.target,ctrlKey:e.ctrlKey,metaKey:e.metaKey});return;}
    const history=e.target.closest?.('[data-history-event]');if(history&&['Enter',' '].includes(e.key)){e.preventDefault();e.stopPropagation();onHistoricalEvent(history.dataset.historyEvent);return;}
    if(e.shiftKey||e.altKey||e.ctrlKey||e.metaKey)return;
    if(e.target.closest?.('[data-next-turn]')&&['Enter',' '].includes(e.key)){e.preventDefault();e.stopPropagation();onNextTurn();return;}
    if(tool==='measure'&&['Enter',' '].includes(e.key)){e.preventDefault();e.stopPropagation();if(!e.repeat)measure(cursor);return;}
    if(!['ArrowLeft','ArrowRight','Home','End','Escape'].includes(e.key))return;e.preventDefault();
    if(e.key==='Escape'){pinned=false;if(tooltip)tooltip.hidden=true;mark(active);if(measurementState){measurementState=null;renderMeasurement();onMeasurement(null);e.stopPropagation();}return;}
    const index=e.key==='Home'?0:e.key==='End'?visible.length-1:active+(e.key==='ArrowRight'?1:-1)*(frequency==='weekly'&&chartType!=='candles'?7:1);
    if(tool==='measure'){active=Math.max(0,Math.min(visible.length-1,index));mark(active);onHover(hoverInfo(active,false));if(measurementState&&!measurementState.endDate)renderMeasurement(anchorAt(active));}
    else commit(index,false,true);
  };
  renderMeasurement();
  if(tool==='measure'){mark(active);onHover(hoverInfo(active,false));}else commit(active,false);
  return {getSelection({anchor}={}){const index=Number.isFinite(anchor)?nearest(visible,minDay+Math.max(0,Math.min(1,anchor))*span):cursor;const detail=inspection(index);return {label:detail.label,copyText:[detail.label,...detail.fields.map(field=>`${field.label}: ${field.value}`),detail.note].join('\n')};},selectDate(value){commit(nearest(visible,dayOf(value)));},previous(){const previous=visibleTurns.filter(p=>p.date<visible[active].date).at(-1);commit(previous?nearest(visible,dayOf(previous.date)):0);},next(){const next=visibleTurns.find(p=>p.date>visible[active].date);commit(next?nearest(visible,dayOf(next.date)):visible.length-1);},getDate(){return visible[active].date;},hasPrevious(){return visibleTurns.some(p=>p.date<visible[active].date);},hasNext(){return visibleTurns.some(p=>p.date>visible[active].date);}};
}
