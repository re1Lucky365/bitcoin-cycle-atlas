import { utcDay } from './cycle-engine.js';
import { shiftCalendarMonths } from './cycle-timing.js';
import { STATE_LABELS } from './market-structure.js';
import { chartPaneLayout, historicalMarkersMarkup, volumePaneMarkup, formatBtcVolume } from './chart-overlays.js?v=1.7.0';
import { createPriceScale,nearestDailyIndex as nearest,measureDailyRange } from './chart-math.js?v=1.6.0';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nf=(v,n=0)=>new Intl.NumberFormat('en-US',{maximumFractionDigits:n}).format(v);
const money=v=>`$${nf(v,v<10?2:0)}`;
const percent=v=>`${v>0?'+':v<0?'−':''}${nf(Math.abs(v),1)}%`;
const date=v=>v?.replaceAll('-','.')??'—';
const compact=v=>v>=1e6?`${nf(v/1e6,1)}m`:v>=1e3?`${nf(v/1e3,v<1e4?1:0)}k`:nf(v,v<1?2:0);
const COLORS={warmup:'#536173','price-discovery':'#dfb567','bottom-formation':'#91a1ce',range:'#93a1b1',rebound:'#7ec5b7',pullback:'#bc9bb7',advance:'#81b79b',correction:'#d28f94',transition:'#697c91'};
const plainState={warmup:'초기 자료', 'price-discovery':'최고가를 새로 쓰는 중','bottom-formation':'낮은 가격대에서 회복 중',range:'좁은 범위에서 횡보',rebound:'하락 뒤 반등',pullback:'상승 중 되돌림',advance:'상승 흐름',correction:'하락 흐름',transition:'방향이 섞인 구간'};
function sample(rows,frequency){return frequency==='daily'?rows:rows.filter((p,i)=>new Date(`${p.date}T00:00:00Z`).getUTCDay()===0||i===0||i===rows.length-1);}

/** Rendering and inspection only. It never changes prices, paths or model dates. */
export function drawAtlasPriceChart({svg,tooltip,rows,start,end,split,frequency='daily',chartType='line',observedCandles=[],candleSource='Bitstamp',volumeBars=[],volumeSource='Bitstamp',showVolume=false,historicalEvents=[],showHistoricalEvents=true,onHistoricalEvent=()=>{},stateStepDays=1,unit='usd',denominator=1,scale='log',tool='crosshair',measurement=null,onMeasurement=()=>{},onHover=()=>{},band=false,turns=[],showTurns=true,events=[],states=[],fib=[],historical=false,nextTurn=null,onNextTurn=()=>{},showDrawdown=true,showStates=false,threshold=.12,onInspect=()=>{},selectedDate}){
  // Match the allocated viewport instead of shrinking a fixed-height drawing.
  // An explicitly enabled secondary band stays present even in a short chart.
  const W=Math.max(1,Math.round(svg.clientWidth||svg.parentElement?.clientWidth||1100)),H=Math.max(1,Math.round(svg.clientHeight||svg.parentElement?.clientHeight||500)),small=W<600,compactHeight=H<320;
  const layout=chartPaneLayout({width:W,height:H,volume:showVolume,drawdown:showDrawdown,states:showStates,top:compactHeight?62:70});
  const {left:L,right:R,top:T,axisY,priceBottom,ddTop,ddBottom,stateTop,stateBottom,volumeTop,volumeBottom}=layout,stateHeight=stateBottom-stateTop,ddHeight=ddBottom-ddTop;
  const minDay=utcDay(start),maxDay=utcDay(end),span=Math.max(1,maxDay-minDay),xday=d=>L+(d-minDay)/span*(W-L-R),x=p=>xday(utcDay(p.date));
  const originalVisible=rows.filter(p=>p.date>=start&&p.date<=end&&p.price>0);
  const candleDays=frequency==='weekly'?7:1;
  const candleRows=chartType==='candles'?observedCandles.map(c=>({...c,startDate:c.startDate||new Date(c.time*1000).toISOString().slice(0,10),endDate:c.endDate||new Date((c.time+(candleDays-1)*86400)*1000).toISOString().slice(0,10)})).filter(c=>c.endDate>=start&&c.endDate<=end&&(!split||c.endDate<=split)):[];
  const candleByDate=new Map(candleRows.map(c=>[c.endDate,c]));
  const coveredDays=new Set();for(const c of candleRows)for(let day=utcDay(c.startDate);day<=utcDay(c.endDate);day++)coveredDays.add(day);
  const covered=date=>coveredDays.has(utcDay(date));
  const visible=originalVisible.filter(p=>!covered(p.date)||candleByDate.has(p.date)).map(p=>candleByDate.has(p.date)?{...p,coinMetricsPrice:p.price,price:candleByDate.get(p.date).close,candle:candleByDate.get(p.date)}:p);
  if(!visible.length){svg.onclick=svg.onpointermove=svg.onpointerleave=svg.onkeydown=null;delete svg.dataset.plotLeft;delete svg.dataset.plotRight;svg.innerHTML='<text x="24" y="60" fill="#c6d0dd">이 기간에는 아직 자료가 없습니다.</text>';return null;}
  const factor=unit==='indexed'?100/denominator:1;
  const values=[...visible.flatMap(p=>band&&p.lower>0&&p.upper>0?[p.lower,p.upper,p.price]:[p.price]),...candleRows.flatMap(c=>[c.low,c.high])];
  const tickCount=Math.max(2,Math.min(small?5:7,Math.floor((priceBottom-T)/38)+1));
  const priceScale=createPriceScale(values,{scale,top:T,bottom:priceBottom,tickCount,factor}),{min,max,y}=priceScale;
  const yd=v=>ddTop+Math.min(100,Math.max(0,-(v??0)))/100*(ddBottom-ddTop);
  const path=(ps,yy=y,key='price')=>ps.map((p,i)=>`${i?'L':'M'}${x(p).toFixed(2)},${yy(p[key]).toFixed(2)}`).join('');
  const observed=sample(visible.filter(p=>!split||p.date<=split),frequency),future=sample(originalVisible.filter(p=>split&&p.date>=split),frequency).map(p=>({...p,lower:p.lower??p.price,upper:p.upper??p.price}));
  const bottom=showVolume?volumeBottom:showStates?stateBottom:showDrawdown?ddBottom:priceBottom;
  const volumeByDate=new Map(volumeBars.filter(bar=>!split||bar.date<=split).map(bar=>[bar.date,bar]));
  const clip=`${svg.id}-clip`,fullHistory=span>3000;
  let s=`<title>${historical?'실제 비트코인 가격':'실제 비트코인 가격과 미래 가정'}</title><desc>실선은 실제 관측, 점선은 가정에 따른 가격 예시입니다. 그래프를 누르면 값을 고정해 읽을 수 있습니다. 미래 음영은 보정된 확률 구간이 아닙니다.</desc><defs><clipPath id="${clip}"><rect x="${L}" y="${T}" width="${W-L-R}" height="${bottom-T}"/></clipPath></defs>`;
  for(const price of priceScale.ticks){const value=price*factor,yy=y(price);s+=`<line x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}" stroke="#28323f"/><text x="${W-R+8}" y="${yy+4}" text-anchor="start" fill="#b0bbca" font-size="12">${unit==='usd'?'$':''}${compact(value)}</text>`;}
  let months=span>5000?(small?60:24):span>3000?(small?36:24):span>1100?(small?12:6):span>550?(small?6:3):span>270?3:1;
  let tick=`${start.slice(0,4)}-01-01`;while(utcDay(tick)<minDay)tick=shiftCalendarMonths(tick,months);
  while(utcDay(tick)<=maxDay){const xx=xday(utcDay(tick));s+=`<line x1="${xx}" x2="${xx}" y1="${T}" y2="${bottom}" stroke="#222c37"/><text x="${xx}" y="${axisY}" text-anchor="${xx>W-35?'end':'middle'}" fill="#aebaca" font-size="12">${months>=12?tick.slice(0,4):tick.slice(2,7).replace('-','.')}</text>`;tick=shiftCalendarMonths(tick,months);}
  if(split&&utcDay(split)>=minDay&&utcDay(split)<=maxDay){const xx=xday(utcDay(split)),headerFixed=small||fullHistory;s+=`<rect x="${xx}" y="${T}" width="${W-R-xx}" height="${bottom-T}" fill="#e9b366" opacity=".025"/><line x1="${xx}" x2="${xx}" y1="${T}" y2="${bottom}" stroke="#a5b1bf" stroke-dasharray="3 5"/><text x="${headerFixed?L:Math.max(L,xx-7)}" y="${T-14}" text-anchor="${headerFixed||xx-L<72?'start':'end'}" fill="#b9c5d2" font-size="12">관측 ${split.slice(5).replace('-','.')}</text>`;}
  if(showDrawdown){s+=`<text x="${L}" y="${layout.ddTitleY}" fill="#aebaca" font-size="${layout.ddTitleFontSize}">이전 최고가에서 떨어진 폭</text>`;for(const dd of(ddHeight<44?[0,-100]:[0,-50,-100]))s+=`<line x1="${L}" x2="${W-R}" y1="${yd(dd)}" y2="${yd(dd)}" stroke="#25303c"/><text x="${W-R+8}" y="${yd(dd)+4}" text-anchor="start" fill="#aab7c8" font-size="11">${dd}%</text>`;}
  s+=`<g clip-path="url(#${clip})">`;
  if(nextTurn){const left=xday(Math.max(minDay,utcDay(nextTurn.lowerDate||nextTurn.date))),right=xday(Math.min(maxDay,utcDay(nextTurn.upperDate||nextTurn.date)));if(right>left)s+=`<rect x="${left}" y="${T}" width="${right-left}" height="${priceBottom-T}" fill="#87bde7" opacity=".065"/>`;}
  if(band&&future.length){s+=`<path d="${path(future,y,'upper')}${[...future].reverse().map(p=>`L${x(p).toFixed(2)},${y(p.lower).toFixed(2)}`).join('')}Z" fill="#efb45f" opacity=".13"/>`;}
  for(const f of fib.filter(f=>f.price>min&&f.price<max&&(!f.startDate||f.startDate<=end))){const yy=y(f.price),from=xday(Math.max(minDay,f.startDate?utcDay(f.startDate):minDay));s+=`<line x1="${from}" x2="${W-R}" y1="${yy}" y2="${yy}" stroke="#b4a7d6" opacity=".55" stroke-dasharray="3 5"/><text x="${W-R-4}" y="${yy-5}" text-anchor="end" fill="#c2b5e0" font-size="11">${nf(f.ratio*100,1)}% · ${unit==='usd'?money(f.price):nf(f.price*factor,1)}</text>`;}
  if(observed.length){let connected=false;const line=observed.map(p=>{if(p.candle){connected=false;return '';}const part=`${connected?'L':'M'}${x(p).toFixed(2)},${y(p.price).toFixed(2)}`;connected=true;return part;}).join('');s+=`<path class="observed-close-line" d="${line}" fill="none" stroke="#e2eaf3" stroke-width="1.8"/>`;}
  const candleWidth=Math.max(.7,Math.min(12,(W-L-R)*candleDays/span*.68));
  for(const c of candleRows){const xx=xday(utcDay(c.endDate)),color=c.close>=c.open?'#62bca5':'#dd7e8d',top=Math.min(y(c.open),y(c.close)),height=Math.max(1,Math.abs(y(c.open)-y(c.close)));s+=`<g class="observed-candle" data-date="${c.endDate}" data-open="${c.open}" data-high="${c.high}" data-low="${c.low}" data-close="${c.close}"><line x1="${xx}" x2="${xx}" y1="${y(c.high)}" y2="${y(c.low)}" stroke="${color}"/><rect x="${xx-candleWidth/2}" y="${top}" width="${candleWidth}" height="${height}" fill="${color}"/><title>${esc(candleSource)} BTC-USD · ${c.startDate}${candleDays>1?`–${c.endDate}`:''} UTC · O ${money(c.open)} H ${money(c.high)} L ${money(c.low)} C ${money(c.close)}</title></g>`;}
  if(future.length)s+=`<path d="${path(future)}" fill="none" stroke="#f2b960" stroke-width="1.8" stroke-dasharray="5 3"/>`;
  if(showDrawdown){if(observed.length)s+=`<path d="${path(observed,yd,'drawdownPct')}" fill="none" stroke="#a7b8cd" stroke-width="1.1"/>`;if(future.length)s+=`<path d="${path(future,yd,'drawdownPct')}" fill="none" stroke="#cba069" stroke-width="1.1" stroke-dasharray="4 3"/>`;}
  if(showStates){let segments=[];for(const p of states.filter(p=>p.date>=start&&p.date<=end)){const last=segments.at(-1);if(last&&last.state===p.state)last.end=p.date;else segments.push({start:p.date,end:p.date,state:p.state});}for(const seg of segments){const xx=xday(utcDay(seg.start)),width=xday(utcDay(seg.end)+stateStepDays)-xx;s+=`<rect x="${xx}" y="${stateTop}" width="${Math.max(.7,width)}" height="${stateHeight}" fill="${COLORS[seg.state]||COLORS.transition}"><title>${esc(STATE_LABELS[seg.state])} ${seg.start}–${seg.end}</title></rect>`;}}
  const visibleTurns=turns.filter(p=>p.date>=start&&p.date<=end);
  if(showTurns)for(const p of visibleTurns){const actual=!split||p.date<=split,color=p.type==='high'?'#e7bb73':'#85bfdc';s+=`<circle data-date="${p.date}" cx="${xday(utcDay(p.date))}" cy="${y(p.price)}" r="${fullHistory?2.5:4}" fill="${actual?color:'#10151c'}" stroke="${color}" stroke-width="1.4"><title>${esc(`${actual?'관측':'예시 경로'} ${p.type==='high'?'고점':'저점'} ${date(p.date)} · ${money(p.price)}`)}</title></circle>`;}
  s+='</g>';
  if(showVolume)s+=volumePaneMarkup({bars:volumeBars.filter(bar=>bar.date>=start&&bar.date<=end&&(!split||bar.date<=split)),x:bar=>xday(utcDay(bar.date)),left:L,right:W-R,top:volumeTop,bottom:volumeBottom,titleY:layout.volumeTitleY,titleFontSize:layout.volumeTitleFontSize,separatorY:layout.volumeSeparatorY,barWidth:Math.max(.6,Math.min(12,(W-L-R)*candleDays/span*.72)),source:volumeSource,clipId:`${svg.id}-volume-clip`,futureX:split&&utcDay(split)>=minDay&&utcDay(split)<maxDay?xday(utcDay(split)):null}).markup;
  if(showHistoricalEvents){
    const actual=originalVisible.filter(point=>!split||point.date<=split);
    const anchors=historicalEvents.filter(event=>event.date>=start&&event.date<=end&&actual.length&&event.date>=actual[0].date&&(!split||event.date<=split)).map(event=>{const point=actual[nearest(actual,utcDay(event.date))];return {event,x:xday(utcDay(event.date)),y:y(point.price)};});
    const labels=historicalMarkersMarkup(anchors,{left:L,right:W-R,top:T+5,bottom:priceBottom-4,maxLabels:small?7:Math.min(22,Math.max(8,Math.floor((W-L-R)/55)))});
    s+=`<g class="history-events-layer">${labels.markup}</g>`;svg.dataset.historyLabelCount=String(labels.labelCount);svg.dataset.historyEventCount=String(labels.totalCount);
  }else{svg.dataset.historyLabelCount='0';svg.dataset.historyEventCount='0';}
  if(nextTurn&&nextTurn.date>=start&&nextTurn.date<=end){const xx=xday(utcDay(nextTurn.date)),headerFixed=small||fullHistory,anchor=headerFixed||xx>W-190?'end':'start',tx=headerFixed?W-R:anchor==='end'?xx-7:xx+7,label=`${nextTurn.type==='high'?'조정':'반등'} 후보 · D-${nf(nextTurn.days)}`,width=132,left=anchor==='end'?tx-width:tx-5;s+=`<line x1="${xx}" x2="${xx}" y1="${T}" y2="${bottom}" stroke="#9bc8e8" stroke-dasharray="4 5" opacity=".8"/><g data-next-turn="${nextTurn.type}" role="button" tabindex="0" aria-label="${esc(label)} · 날짜와 범위 보기" style="cursor:pointer"><title>가정 · ${date(nextTurn.date)} · ${date(nextTurn.lowerDate)}–${date(nextTurn.upperDate)}</title><rect x="${left}" y="${T-29}" width="${width+5}" height="23" rx="3" fill="#172737"/><text x="${tx}" y="${T-14}" text-anchor="${anchor}" fill="#badcf2" font-size="11">${esc(label)}</text></g>`;}
  if(!fullHistory&&!small){let lastX=-999;for(const event of events.filter(p=>p.date>=start&&p.date<=end)){const xx=xday(utcDay(event.date)),yy=xx-lastX<140?T+30:T+16;lastX=xx;s+=`<line x1="${xx}" x2="${xx}" y1="${yy+8}" y2="${priceBottom}" stroke="#bca176" stroke-dasharray="2 6" opacity=".45"/><text x="${Math.min(W-R-5,xx)}" y="${yy}" text-anchor="${xx>W-180?'end':'start'}" fill="#c6ad88" font-size="11">${esc(event.shortLabel||event.label)}</text>`;}}
  const latest=originalVisible.find(p=>p.date===split);
  if(latest){const yy=y(latest.price);s+=`<line x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}" stroke="#7da89c" stroke-dasharray="2 5" opacity=".5"/><rect x="${W-R}" y="${yy-9}" width="${R-3}" height="18" rx="2" fill="#2b6558"/><text x="${W-R+5}" y="${yy+4}" fill="#edf8f3" font-size="${small?10:11}">${unit==='usd'?money(latest.price):nf(latest.price*factor,1)}</text>`;}
  s+=`<g id="${svg.id}-cross" pointer-events="none"><line class="cross-time" y1="${T}" y2="${bottom}" stroke="#afc4dd" stroke-dasharray="3 3" opacity=".6"/><line class="cross-price" x1="${L}" x2="${W-R}" stroke="#afc4dd" stroke-dasharray="3 3" opacity=".6"/><circle r="4" fill="#10151c" stroke="#f4dcac" stroke-width="1.5"/><g class="cross-price-tag"><rect x="${W-R}" width="${R-3}" height="18" rx="2" fill="#465366"/><text x="${W-R+5}" fill="#edf2f9" font-size="${small?10:11}"></text></g><g class="cross-date-tag"><rect width="80" height="18" rx="2" fill="#39485b"/><text fill="#edf2f9" font-size="10" text-anchor="middle"></text></g></g>`;
  s+=`<g class="chart-measurement" pointer-events="none" display="none" role="img"><g class="measurement-geometry" clip-path="url(#${clip})"><rect class="measurement-area" fill-opacity=".1"/><line class="measurement-line" stroke-width="1.4" stroke-dasharray="4 3"/><circle class="measurement-start" r="4" fill="#10151c" stroke-width="2"/><circle class="measurement-end" r="4" fill="#10151c" stroke-width="2"/></g><g class="measurement-label"><rect rx="4" fill="#142131" stroke="#557b9f"/><text x="8" y="15" fill="#d8e7f8" font-size="10"></text><text x="8" y="29" fill="#d8e7f8" font-size="10"></text><text x="8" y="43" fill="#e1ecf8" font-size="10"></text><text x="8" y="57" fill="#b9cde3" font-size="10"></text></g></g>`;
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.dataset.plotLeft=String(L);svg.dataset.plotRight=String(W-R);svg.dataset.plotTop=String(T);svg.dataset.plotBottom=String(bottom);svg.dataset.priceBottom=String(priceBottom);svg.parentElement?.style.setProperty('--plot-bottom-gap',`${H-bottom+6}px`);svg.parentElement?.style.setProperty('--plot-right-gap',`${R+7}px`);svg.dataset.scale=scale;svg.dataset.tool=tool;svg.dataset.chartType=chartType;svg.innerHTML=s;
  const cross=svg.querySelector('[id$="-cross"]'),crossLine=cross.querySelector('.cross-time'),crossPrice=cross.querySelector('.cross-price'),crossDot=cross.querySelector('circle'),priceTag=cross.querySelector('.cross-price-tag'),dateTag=cross.querySelector('.cross-date-tag'),stateByDate=new Map(states.map(p=>[p.date,p]));
  let measurementState=measurement?{startDate:measurement.startDate,endDate:measurement.endDate??null}:null;
  const initialDate=tool==='measure'&&measurementState?(measurementState.endDate||measurementState.startDate):(selectedDate||split||visible.at(-1).date);
  let active=nearest(visible,utcDay(initialDate)),pinned=false,cursor=active;
  const rowIndices=new Map(rows.map((point,index)=>[point.date,index]));
  const hoverInfo=(index,hovered)=>{const point=visible[index],previous=rows[(rowIndices.get(point.date)??0)-1],c=point.candle,v=volumeByDate.get(point.date);return {date:point.date,price:point.price,displayedPrice:point.price*factor,changePrice:c?c.close-c.open:previous?point.price-previous.price:null,changePct:c?(c.close/c.open-1)*100:previous?(point.price/previous.price-1)*100:null,drawdownPct:c?null:point.drawdownPct??null,kind:split&&point.date>split?'simulated':'observed',...(v?{volume:v.volume,volumeSource,volumeUnit:'BTC',volumeStartDate:v.startDate||v.date,volumeEndDate:v.endDate||v.date}:{}),...(c?{open:c.open,high:c.high,low:c.low,close:c.close,volume:c.volume,source:candleSource,product:'BTC-USD',interval:frequency==='weekly'?'1W':'1D',completed:true}:{}),hovered};};
  const measurementLayer=svg.querySelector('.chart-measurement'),measureArea=measurementLayer.querySelector('.measurement-area'),measureLine=measurementLayer.querySelector('.measurement-line'),measureStart=measurementLayer.querySelector('.measurement-start'),measureEnd=measurementLayer.querySelector('.measurement-end'),measureLabel=measurementLayer.querySelector('.measurement-label'),measureLabelRect=measureLabel.querySelector('rect'),measureTexts=[...measureLabel.querySelectorAll('text')];
  const attrs=(node,values)=>{for(const [key,value] of Object.entries(values))node.setAttribute(key,value);};
  const measurementMoney=value=>`$${nf(value,Math.abs(value)<1?6:2)}`;
  function renderMeasurement(previewDate=null){
    if(!measurementState){measurementLayer.setAttribute('display','none');return;}
    const input={...measurementState,endDate:measurementState.endDate||previewDate},measurementRows=rows.map(p=>candleByDate.has(p.date)?{...p,price:candleByDate.get(p.date).close}:p),result=measureDailyRange(measurementRows,input,split);
    if(!result){measurementLayer.setAttribute('display','none');return;}
    measurementLayer.removeAttribute('display');measurementLayer.dataset.pending=String(!measurementState.endDate);
    const ax=xday(utcDay(result.startDate)),ay=y(result.startPrice),hasEnd=Boolean(result.endDate),bx=hasEnd?xday(utcDay(result.endDate)):ax,by=hasEnd?y(result.endPrice):ay,color=hasEnd?(result.changePrice<0?'#db9ba7':'#8ac8b9'):'#93c3e8';
    attrs(measureStart,{cx:ax,cy:ay,stroke:color,'data-measure-date':result.startDate,'data-measure-price':result.startPrice});
    attrs(measureEnd,{cx:bx,cy:by,stroke:color,display:hasEnd?'inline':'none','data-measure-date':result.endDate||'','data-measure-price':result.endPrice??''});
    attrs(measureArea,{x:Math.min(ax,bx),y:Math.min(ay,by),width:Math.abs(bx-ax),height:Math.max(1,Math.abs(by-ay)),fill:color,display:hasEnd?'inline':'none'});
    attrs(measureLine,{x1:ax,y1:ay,x2:bx,y2:by,stroke:color,display:hasEnd?'inline':'none'});
    const signedMoney=hasEnd?`${result.changePrice>0?'+':result.changePrice<0?'−':''}${measurementMoney(Math.abs(result.changePrice))}`:'';
    const lines=hasEnd?[`시작 ${date(result.startDate)} · ${measurementMoney(result.startPrice)}`,`끝 ${date(result.endDate)} · ${measurementMoney(result.endPrice)}`,`Δ ${signedMoney} · ${percent(result.changePct)}`,`Δ ${result.deltaDays>0?'+':''}${result.deltaDays}일${result.includesSimulated?' · 가정 포함':''}`]:[`${date(result.startDate)} · ${measurementMoney(result.startPrice)}`,`끝점 선택${result.includesSimulated?' · 가정 포함':''}`];
    const labelWidth=Math.min(small?214:240,Math.max(140,W-L-R-12)),labelHeight=lines.length*14+9;
    const labelX=Math.max(L+4,Math.min(W-R-labelWidth-4,(ax+bx)/2-labelWidth/2)),labelY=Math.max(T+5,Math.min(priceBottom-labelHeight-4,Math.min(ay,by)-labelHeight-10));
    attrs(measureLabel,{transform:`translate(${labelX},${labelY})`});attrs(measureLabelRect,{width:labelWidth,height:labelHeight,stroke:color});
    measureTexts.forEach((node,index)=>{node.textContent=lines[index]||'';});
    measurementLayer.setAttribute('aria-label',lines.join(' · '));
  }
  const inspection=index=>{const p=visible[index],isFuture=Boolean(split&&p.date>split),isLong=isFuture&&(p.phase==='long-horizon'||p.kind==='conditional-long-horizon-path'),flow=stateByDate.get(p.date),event=visibleTurns.find(t=>t.date===p.date),fields=[{label:unit==='usd'?'가격 · 달러':'최근 관측 가격 = 100',value:unit==='usd'?money(p.price):nf(p.price*factor,1)},{label:'이전 최고가 대비',value:percent(p.drawdownPct)},{label:'가격 흐름',value:plainState[flow?.state]||'—'}];
    if(p.candle){fields.splice(0,fields.length,{label:'시가 O',value:money(p.candle.open)},{label:'고가 H',value:money(p.candle.high)},{label:'저가 L',value:money(p.candle.low)},{label:'종가 C',value:money(p.candle.close)},{label:'거래량 · BTC',value:nf(p.candle.volume,4)},{label:'출처',value:`${candleSource} · BTC-USD`});}
    const volume=volumeByDate.get(p.date);if(!p.candle&&volume)fields.push({label:'거래량 · BTC',value:nf(volume.volume,4)},{label:'거래량 출처',value:`${volumeSource} · BTC/USD 현물`});
    if(event)fields.push({label:isFuture?'예시에서 확인한 날':'방향 전환 확인일',value:date(event.confirmationDate)});
    if(isFuture&&p.lower&&(!event||isLong))fields.push({label:isLong?'경제 가정 범위':'여러 예시의 가격 범위',value:`${money(p.lower)}–${money(p.upper)}`});
    if(isLong&&Number.isFinite(p.baselinePrice))fields.push({label:'가치평가 기준 가격',value:money(p.baselinePrice)});
    if(isLong&&Number.isFinite(p.annualizedVolatilityPct))fields.push({label:'연환산 변동성 가정',value:`${nf(p.annualizedVolatilityPct,1)}%`});
    if(isLong&&Number.isFinite(p.realizedVolPct))fields.push({label:'가정 경로의 계산 변동성',value:`${nf(p.realizedVolPct,1)}%`});
    return {label:`${date(p.date)}${event?` · ${event.type==='high'?'고점':'저점'}${isFuture?' 예시':''}`:''}`,date:p.date,kind:isFuture?'simulated':'observed',fields,note:p.candle?`${candleSource} 실제 거래소의 완료 ${frequency==='weekly'?'주':'일'}봉입니다. 캔들 ${p.candle.startDate}–${p.candle.endDate} UTC. 과거 종가 선과 미래 가정의 연결 기준은 Coin Metrics이며 거래소 종가와 다를 수 있습니다.`:isLong?'가격선과 범위는 경제적 채택 가정에 따른 예시입니다. 가치평가 기준과 변동성 가정은 모델 입력이며, 가정 경로의 계산 변동성은 그 예시에서 따로 계산한 값입니다. 실제 미래의 실현 변동성이나 확률이 보정된 예측구간을 뜻하지 않습니다.':isFuture?'선택한 가정의 예시입니다. 가격 범위는 확률이 보정된 예측구간이 아닙니다.':event?`가격이 꺾인 날과, 반대 방향으로 ${nf(threshold*100)}% 이동해 확인한 날을 구분합니다.`:frequency==='weekly'?'선은 주간 마지막 가격, 선택한 값은 해당 날짜의 일말 가격입니다.':`Coin Metrics의 하루 말 가격입니다. 장중 최고·최저가와 다를 수 있습니다.${volume?` 거래량은 ${volumeSource} BTC/USD 현물의 ${volume.startDate||volume.date}${volume.endDate?'–'+volume.endDate:''} UTC 합계이며 전 세계 거래량이 아닙니다.`:''}`};};
  function mark(index){cursor=index;const p=visible[index],xx=x(p),yy=y(p.price),tx=Math.max(L,Math.min(W-R-80,xx-40));crossLine.setAttribute('x1',xx);crossLine.setAttribute('x2',xx);crossPrice.setAttribute('y1',yy);crossPrice.setAttribute('y2',yy);crossDot.setAttribute('cx',xx);crossDot.setAttribute('cy',yy);priceTag.querySelector('rect').setAttribute('y',yy-9);priceTag.querySelector('text').setAttribute('y',yy+4);priceTag.querySelector('text').textContent=unit==='usd'?money(p.price):nf(p.price*factor,1);dateTag.querySelector('rect').setAttribute('x',tx);dateTag.querySelector('rect').setAttribute('y',axisY-12);dateTag.querySelector('text').setAttribute('x',tx+40);dateTag.querySelector('text').setAttribute('y',axisY+1);dateTag.querySelector('text').textContent=p.date;}

  function commit(index,pin=true,user=pin){active=Math.max(0,Math.min(visible.length-1,index));pinned=pin;mark(active);if(tooltip)tooltip.hidden=true;onHover(hoverInfo(active,false));onInspect(inspection(active),{user,openPanel:pin});}
  function measure(index){
    active=Math.max(0,Math.min(visible.length-1,index));mark(active);onHover(hoverInfo(active,false));
    measurementState=!measurementState||measurementState.endDate?{startDate:visible[active].date,endDate:null}:{startDate:measurementState.startDate,endDate:visible[active].date};
    renderMeasurement();onMeasurement({...measurementState});
  }
  function fromPointer(e){const target=e.target.closest?.('[data-date]');if(target)return nearest(visible,utcDay(target.dataset.date));const rect=svg.getBoundingClientRect(),px=(e.clientX-rect.left)/rect.width*W;return nearest(visible,minDay+(Math.max(L,Math.min(W-R,px))-L)/(W-L-R)*span);}
  const inPlot=e=>{const box=svg.getBoundingClientRect(),px=(e.clientX-box.left)/box.width*W,py=(e.clientY-box.top)/box.height*H;return px>=L&&px<=W-R&&py>=T&&py<=bottom;};
  svg.onclick=e=>{const history=e.target.closest?.('[data-history-event]');if(history){onHistoricalEvent(history.dataset.historyEvent);return;}if(e.target.closest?.('[data-next-turn]')){onNextTurn();return;}if(tool==='pan'||!inPlot(e))return;if(tool==='measure'){svg.focus({preventScroll:true});measure(fromPointer(e));return;}commit(fromPointer(e));};
  svg.onpointermove=e=>{if(e.pointerType==='touch'||e.target.closest?.('[data-next-turn],[data-history-event]')||!inPlot(e))return;const index=fromPointer(e);mark(index);onHover(hoverInfo(index,true));if(tool==='measure'&&measurementState&&!measurementState.endDate)renderMeasurement(visible[index].date);if(tooltip)tooltip.hidden=true;};
  svg.onpointerleave=()=>{mark(active);onHover(hoverInfo(active,false));if(measurementState&&!measurementState.endDate)renderMeasurement();if(tooltip)tooltip.hidden=true;};
  svg.onblur=()=>{if(tooltip&&!pinned)tooltip.hidden=true;};
  svg.onkeydown=e=>{
    const history=e.target.closest?.('[data-history-event]');if(history&&['Enter',' '].includes(e.key)){e.preventDefault();e.stopPropagation();onHistoricalEvent(history.dataset.historyEvent);return;}
    if(e.shiftKey||e.altKey||e.ctrlKey||e.metaKey)return;
    if(e.target.closest?.('[data-next-turn]')&&['Enter',' '].includes(e.key)){e.preventDefault();e.stopPropagation();onNextTurn();return;}
    if(tool==='measure'&&['Enter',' '].includes(e.key)){e.preventDefault();e.stopPropagation();if(!e.repeat)measure(cursor);return;}
    if(!['ArrowLeft','ArrowRight','Home','End','Escape'].includes(e.key))return;e.preventDefault();
    if(e.key==='Escape'){pinned=false;if(tooltip)tooltip.hidden=true;mark(active);if(measurementState){measurementState=null;renderMeasurement();onMeasurement(null);e.stopPropagation();}return;}
    const index=e.key==='Home'?0:e.key==='End'?visible.length-1:active+(e.key==='ArrowRight'?1:-1)*(frequency==='weekly'&&chartType!=='candles'?7:1);
    if(tool==='measure'){active=Math.max(0,Math.min(visible.length-1,index));mark(active);onHover(hoverInfo(active,false));if(measurementState&&!measurementState.endDate)renderMeasurement(visible[active].date);}
    else commit(index,false,true);
  };
  renderMeasurement();
  if(tool==='measure'){mark(active);onHover(hoverInfo(active,false));}else commit(active,false);
  return {getSelection({anchor}={}){const index=Number.isFinite(anchor)?nearest(visible,minDay+Math.max(0,Math.min(1,anchor))*span):cursor;const detail=inspection(index);return {label:detail.label,copyText:[detail.label,...detail.fields.map(field=>`${field.label}: ${field.value}`),detail.note].join('\n')};},selectDate(value){commit(nearest(visible,utcDay(value)));},previous(){const previous=visibleTurns.filter(p=>p.date<visible[active].date).at(-1);commit(previous?nearest(visible,utcDay(previous.date)):0);},next(){const next=visibleTurns.find(p=>p.date>visible[active].date);commit(next?nearest(visible,utcDay(next.date)):visible.length-1);},getDate(){return visible[active].date;},hasPrevious(){return visibleTurns.some(p=>p.date<visible[active].date);},hasNext(){return visibleTurns.some(p=>p.date>visible[active].date);}};
}
