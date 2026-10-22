import {createPriceScale} from './chart-math.js?v=1.6.0';
import {chartInterval} from './ohlc-data.js';
import {chartPaneLayout,volumePaneMarkup} from './chart-overlays.js?v=1.7.0';

const number=(value,digits=2)=>new Intl.NumberFormat('en-US',{maximumFractionDigits:digits}).format(value);
const money=value=>`$${number(value,value<1?6:2)}`;
const timestamp=time=>new Date(time*1000).toISOString().slice(0,16).replace('T',' ');
const esc=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export function drawIntradayChart({svg,series,chartType='candles',scale='log',unit='usd',tool='crosshair',range=null,showVolume=true,onHover=()=>{},onInspect=()=>{},selectedTime=null}) {
  const allRows=series.candles,interval=chartInterval(series.interval);
  if(!allRows.length)throw new RangeError('The market chart needs completed candles');
  const W=Math.max(1,Math.round(svg.clientWidth||1100)),H=Math.max(1,Math.round(svg.clientHeight||500)),small=W<600;
  const layout=chartPaneLayout({width:W,height:H,volume:showVolume,top:70});
  const {left:L,right:R,top:T,axisY,bottom,priceBottom:B,volumeTop,volumeBottom}=layout;
  const minTime=range?.start??allRows[0].time-interval.seconds,maxTime=range?.end??allRows.at(-1).time+interval.seconds;
  const rows=allRows.filter(row=>row.time>=minTime&&row.time<=maxTime);
  const x=time=>L+(time-minTime)/(maxTime-minTime)*(W-L-R);
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  Object.assign(svg.dataset,{plotLeft:String(L),plotRight:String(W-R),plotTop:String(T),plotBottom:String(bottom),priceBottom:String(B),scale,chartType,interval:series.interval,historyLabelCount:'0',historyEventCount:'0'});
  svg.parentElement?.style.setProperty('--plot-bottom-gap',`${H-bottom+6}px`);svg.parentElement?.style.setProperty('--plot-right-gap',`${R+7}px`);
  if(!rows.length){svg.innerHTML='<text x="24" y="90" fill="#9eb2ca">이 구간에는 완료된 거래 봉이 없습니다. 확대·이동으로 다른 구간을 확인하세요.</text>';svg.onclick=svg.onpointermove=svg.onpointerleave=svg.onkeydown=null;return null;}
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
    for(const row of rows){const xx=x(row.time),up=row.close>=row.open,color=up?'#62bca5':'#dd7e8d',top=Math.min(y(row.open),y(row.close)),height=Math.max(1,Math.abs(y(row.open)-y(row.close)));s+=`<g class="market-candle" data-time="${row.time}" data-open="${row.open}" data-high="${row.high}" data-low="${row.low}" data-close="${row.close}"><line x1="${xx}" x2="${xx}" y1="${y(row.high)}" y2="${y(row.low)}" stroke="${color}"/><rect x="${xx-width/2}" y="${top}" width="${width}" height="${height}" fill="${color}"/><title>${timestamp(row.time)} UTC · O ${money(row.open)} H ${money(row.high)} L ${money(row.low)} C ${money(row.close)}</title></g>`;}
  }else{
    const path=rows.map((row,index)=>`${index&&row.time-rows[index-1].time===interval.seconds?'L':'M'}${x(row.time)},${y(row.close)}`).join(' ');
    s+=`<path class="market-close-line" d="${path}" fill="none" stroke="#dce7f2" stroke-width="1.7"/>`;
  }
  s+='</g>';
  if(showVolume)s+=volumePaneMarkup({bars:rows,x:bar=>x(bar.time),left:L,right:W-R,top:volumeTop,bottom:volumeBottom,titleY:layout.volumeTitleY,titleFontSize:layout.volumeTitleFontSize,separatorY:layout.volumeSeparatorY,barWidth:width,source:series.source,clipId:`${svg.id}-volume-clip`}).markup;
  const last=allRows.at(-1);if(last.time<=maxTime&&last.time>=minTime)s+=`<line x1="${L}" x2="${W-R}" y1="${y(last.close)}" y2="${y(last.close)}" stroke="#74ab9e" stroke-dasharray="3 5" opacity=".6"/>`;
  s+=`<g id="${svg.id}-cross" pointer-events="none"><line class="cross-time" y1="${T}" y2="${bottom}" stroke="#adbed1" stroke-dasharray="3 3"/><line class="cross-price" x1="${L}" x2="${W-R}" stroke="#adbed1" stroke-dasharray="3 3"/><circle r="3" fill="#10151c" stroke="#d5e6f7"/><g class="market-price-tag"><rect x="${W-R}" width="${R-2}" height="18" rx="2" fill="#385466"/><text x="${W-R+4}" fill="#f0f5fa" font-size="10"/></g><g class="market-date-tag"><rect width="124" height="18" rx="2" fill="#39485b"/><text fill="#edf2f9" font-size="9" text-anchor="middle"/></g></g>`;
  svg.innerHTML=s;
  const cross=svg.querySelector('[id$="-cross"]'),vertical=cross.querySelector('.cross-time'),horizontal=cross.querySelector('.cross-price'),dot=cross.querySelector('circle'),priceTag=cross.querySelector('.market-price-tag'),dateTag=cross.querySelector('.market-date-tag');
  const nearest=time=>{let left=0,right=rows.length-1;while(left<right){const mid=(left+right)>>1;if(rows[mid].time<time)left=mid+1;else right=mid;}return left>0&&time-rows[left-1].time<rows[left].time-time?left-1:left;};
  let active=selectedTime?nearest(typeof selectedTime==='number'?selectedTime:Date.parse(selectedTime)/1000):rows.length-1,cursor=active;
  const hover=index=>{const row=rows[index],previous=rows[index-1];return {date:row.date,time:row.time,price:row.close,displayedPrice:row.close*factor,open:row.open,high:row.high,low:row.low,close:row.close,volume:row.volume,volumeSource:series.source,volumeUnit:'BTC',changePrice:row.close-row.open,changePct:(row.close/row.open-1)*100,previousCloseChangePct:previous?(row.close/previous.close-1)*100:null,kind:'observed',interval:interval.label,source:series.source,product:series.product,completed:true};};
  function mark(index,hovered=false){cursor=index;const row=rows[index],xx=x(row.time),yy=y(row.close),tx=Math.max(L,Math.min(W-R-124,xx-62));vertical.setAttribute('x1',xx);vertical.setAttribute('x2',xx);horizontal.setAttribute('y1',yy);horizontal.setAttribute('y2',yy);dot.setAttribute('cx',xx);dot.setAttribute('cy',yy);priceTag.querySelector('rect').setAttribute('y',yy-9);priceTag.querySelector('text').setAttribute('y',yy+4);priceTag.querySelector('text').textContent=price(row.close);dateTag.querySelector('rect').setAttribute('x',tx);dateTag.querySelector('rect').setAttribute('y',axisY-12);dateTag.querySelector('text').setAttribute('x',tx+62);dateTag.querySelector('text').setAttribute('y',axisY+1);dateTag.querySelector('text').textContent=timestamp(row.time);onHover({...hover(index),hovered});}
  function inspection(index){const row=rows[index];return {label:`${timestamp(row.time)} UTC · ${interval.label} 완료 봉`,date:row.date,kind:'observed',fields:[{label:'시가 O',value:money(row.open)},{label:'고가 H',value:money(row.high)},{label:'저가 L',value:money(row.low)},{label:'종가 C',value:money(row.close)},{label:'거래량 · BTC',value:number(row.volume,6)},{label:'출처',value:`${series.source} · ${series.product}`}],note:`${series.snapshot?'저장 자료':'조회 자료'} · 수집 ${series.retrievedAt.replace('T',' ').slice(0,19)} UTC. 봉 시작 시각 기준이며 이 거래소 현물쌍의 물량입니다. ${series.gapCount?`${series.gapCount}개 빈 구간은 채우지 않았습니다.`:'완료된 실제 거래 봉만 표시합니다.'}`};}
  function commit(index,user=false){active=Math.max(0,Math.min(rows.length-1,index));mark(active);onInspect(inspection(active),{user,openPanel:user});}
  const fromPointer=event=>{const box=svg.getBoundingClientRect(),px=(event.clientX-box.left)/box.width*W;return nearest(minTime+(Math.max(L,Math.min(W-R,px))-L)/(W-L-R)*(maxTime-minTime));};
  const inPlot=event=>{const box=svg.getBoundingClientRect(),px=(event.clientX-box.left)/box.width*W,py=(event.clientY-box.top)/box.height*H;return px>=L&&px<=W-R&&py>=T&&py<=bottom;};
  svg.onclick=event=>{if(tool!=='pan'&&inPlot(event))commit(fromPointer(event),true);};svg.onpointermove=event=>{if(event.pointerType!=='touch'&&inPlot(event))mark(fromPointer(event),true);};svg.onpointerleave=()=>mark(active);svg.onblur=null;
  svg.onkeydown=event=>{if(event.shiftKey||event.altKey||event.ctrlKey||event.metaKey||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();commit(event.key==='Home'?0:event.key==='End'?rows.length-1:active+(event.key==='ArrowRight'?1:-1),false);};
  commit(active);
  return {getSelection({anchor}={}){const index=Number.isFinite(anchor)?nearest(minTime+Math.max(0,Math.min(1,anchor))*(maxTime-minTime)):cursor;const detail=inspection(index);return {label:detail.label,copyText:[detail.label,...detail.fields.map(field=>`${field.label}: ${field.value}`),detail.note].join('\n')};},selectDate(value){commit(nearest(Date.parse(value)/1000),true);},previous(){commit(active-1,true);},next(){commit(active+1,true);},getDate(){return rows[active].date;},hasPrevious(){return active>0;},hasNext(){return active<rows.length-1;}};
}
