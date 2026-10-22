import { utcDay } from './cycle-engine.js';
import { shiftCalendarMonths } from './cycle-timing.js';
import { STATE_LABELS } from './market-structure.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nf=(v,n=0)=>new Intl.NumberFormat('en-US',{maximumFractionDigits:n}).format(v);
const money=v=>`$${nf(v,v<10?2:0)}`;
const percent=v=>`${v>0?'+':v<0?'−':''}${nf(Math.abs(v),1)}%`;
const date=v=>v?.replaceAll('-','.')??'—';
const compact=v=>v>=1e6?`${nf(v/1e6,1)}m`:v>=1e3?`${nf(v/1e3,v<1e4?1:0)}k`:nf(v,v<1?2:0);
const COLORS={warmup:'#536173','price-discovery':'#dfb567','bottom-formation':'#91a1ce',range:'#93a1b1',rebound:'#7ec5b7',pullback:'#bc9bb7',advance:'#81b79b',correction:'#d28f94',transition:'#697c91'};
const plainState={warmup:'초기 자료', 'price-discovery':'최고가를 새로 쓰는 중','bottom-formation':'낮은 가격대에서 회복 중',range:'좁은 범위에서 횡보',rebound:'하락 뒤 반등',pullback:'상승 중 되돌림',advance:'상승 흐름',correction:'하락 흐름',transition:'방향이 섞인 구간'};
function nearest(rows,day){let lo=0,hi=rows.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(utcDay(rows[mid].date)<day)lo=mid+1;else hi=mid;}return lo>0&&Math.abs(utcDay(rows[lo-1].date)-day)<Math.abs(utcDay(rows[lo].date)-day)?lo-1:lo;}
function sample(rows,frequency){return frequency==='daily'?rows:rows.filter((p,i)=>new Date(`${p.date}T00:00:00Z`).getUTCDay()===0||i===0||i===rows.length-1);}

/** Rendering and inspection only. It never changes prices, paths or model dates. */
export function drawAtlasPriceChart({svg,tooltip,rows,start,end,split,frequency='daily',stateStepDays=1,unit='usd',denominator=1,band=false,turns=[],showTurns=true,events=[],states=[],fib=[],historical=false,nextTurn=null,onNextTurn=()=>{},showDrawdown=true,showStates=false,threshold=.12,onInspect=()=>{},selectedDate}){
  // Match the allocated viewport instead of shrinking a fixed-height drawing.
  // An explicitly enabled secondary band stays present even in a short chart.
  const W=Math.max(1,Math.round(svg.clientWidth||svg.parentElement?.clientWidth||1100)),H=Math.max(1,Math.round(svg.clientHeight||svg.parentElement?.clientHeight||500)),small=W<600,compactHeight=H<320;
  const L=small?8:12,R=small?58:72,T=compactHeight?52:58,axisY=H-30,stateBottom=H-(compactHeight?48:52),stateHeight=compactHeight?8:10,stateTop=stateBottom-stateHeight;
  const ddBottom=showStates?stateTop-(compactHeight?8:14):H-(compactHeight?48:53),ddHeight=Math.min(compactHeight?44:72,Math.max(24,H*.15)),ddTop=ddBottom-ddHeight,priceBottom=showDrawdown?ddTop-(compactHeight?20:30):showStates?stateTop-(compactHeight?10:18):ddBottom;
  const minDay=utcDay(start),maxDay=utcDay(end),span=Math.max(1,maxDay-minDay),xday=d=>L+(d-minDay)/span*(W-L-R),x=p=>xday(utcDay(p.date));
  const visible=rows.filter(p=>p.date>=start&&p.date<=end&&p.price>0);
  if(!visible.length){svg.innerHTML='<text x="24" y="60" fill="#c6d0dd">이 기간에는 아직 자료가 없습니다.</text>';return null;}
  const factor=unit==='indexed'?100/denominator:1;
  const values=visible.flatMap(p=>band&&p.lower>0&&p.upper>0?[p.lower,p.upper,p.price]:[p.price]);
  const min=Math.min(...values)*.82,max=Math.max(...values)*1.19;
  const y=v=>priceBottom-(Math.log(v)-Math.log(min))/(Math.log(max)-Math.log(min))*(priceBottom-T);
  const yd=v=>ddTop+Math.min(100,Math.max(0,-(v??0)))/100*(ddBottom-ddTop);
  const path=(ps,yy=y,key='price')=>ps.map((p,i)=>`${i?'L':'M'}${x(p).toFixed(2)},${yy(p[key]).toFixed(2)}`).join('');
  const observed=sample(visible.filter(p=>!split||p.date<=split),frequency),future=sample(visible.filter(p=>split&&p.date>=split),frequency).map(p=>({...p,lower:p.lower??p.price,upper:p.upper??p.price}));
  const bottom=showStates?stateBottom:showDrawdown?ddBottom:priceBottom;
  const clip=`${svg.id}-clip`,fullHistory=span>3000;
  let s=`<title>${historical?'실제 비트코인 가격':'실제 비트코인 가격과 미래 가정'}</title><desc>실선은 실제 관측, 점선은 가정에 따른 가격 예시입니다. 그래프를 누르면 값을 고정해 읽을 수 있습니다. 미래 음영은 보정된 확률 구간이 아닙니다.</desc><defs><clipPath id="${clip}"><rect x="${L}" y="${T}" width="${W-L-R}" height="${bottom-T}"/></clipPath></defs>`;
  const allTicks=[];for(let e=Math.floor(Math.log10(min*factor))-1;e<=Math.ceil(Math.log10(max*factor))+1;e++)for(const mult of[1,2,5]){const v=mult*10**e;if(v>=min*factor&&v<=max*factor)allTicks.push(v);}
  const tickCount=Math.max(2,Math.min(small?5:7,Math.floor((priceBottom-T)/38)+1)),tickStride=Math.max(1,Math.ceil(allTicks.length/tickCount));
  for(const value of allTicks.filter((_,i)=>i%tickStride===0)){const yy=y(value/factor);s+=`<line x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}" stroke="#28323f"/><text x="${W-R+8}" y="${yy+4}" text-anchor="start" fill="#b0bbca" font-size="12">${unit==='usd'?'$':''}${compact(value)}</text>`;}
  let months=span>5000?(small?60:24):span>3000?(small?36:24):span>1100?(small?12:6):span>550?(small?6:3):span>270?3:1;
  let tick=`${start.slice(0,4)}-01-01`;while(utcDay(tick)<minDay)tick=shiftCalendarMonths(tick,months);
  while(utcDay(tick)<=maxDay){const xx=xday(utcDay(tick));s+=`<line x1="${xx}" x2="${xx}" y1="${T}" y2="${bottom}" stroke="#222c37"/><text x="${xx}" y="${axisY}" text-anchor="${xx>W-35?'end':'middle'}" fill="#aebaca" font-size="12">${months>=12?tick.slice(0,4):tick.slice(2,7).replace('-','.')}</text>`;tick=shiftCalendarMonths(tick,months);}
  if(split&&utcDay(split)>=minDay&&utcDay(split)<=maxDay){const xx=xday(utcDay(split)),headerFixed=small||fullHistory;s+=`<rect x="${xx}" y="${T}" width="${W-R-xx}" height="${bottom-T}" fill="#e9b366" opacity=".025"/><line x1="${xx}" x2="${xx}" y1="${T}" y2="${bottom}" stroke="#a5b1bf" stroke-dasharray="3 5"/><text x="${headerFixed?L:Math.max(L,xx-7)}" y="${T-14}" text-anchor="${headerFixed||xx-L<72?'start':'end'}" fill="#b9c5d2" font-size="12">관측 ${split.slice(5).replace('-','.')}</text>`;}
  if(showDrawdown){s+=`<text x="${L}" y="${ddTop-(compactHeight?8:13)}" fill="#aebaca" font-size="${compactHeight?11:12}">이전 최고가에서 떨어진 폭</text>`;for(const dd of(ddHeight<44?[0,-100]:[0,-50,-100]))s+=`<line x1="${L}" x2="${W-R}" y1="${yd(dd)}" y2="${yd(dd)}" stroke="#25303c"/><text x="${W-R+8}" y="${yd(dd)+4}" text-anchor="start" fill="#aab7c8" font-size="11">${dd}%</text>`;}
  s+=`<g clip-path="url(#${clip})">`;
  if(nextTurn){const left=xday(Math.max(minDay,utcDay(nextTurn.lowerDate||nextTurn.date))),right=xday(Math.min(maxDay,utcDay(nextTurn.upperDate||nextTurn.date)));if(right>left)s+=`<rect x="${left}" y="${T}" width="${right-left}" height="${priceBottom-T}" fill="#87bde7" opacity=".065"/>`;}
  if(band&&future.length){s+=`<path d="${path(future,y,'upper')}${[...future].reverse().map(p=>`L${x(p).toFixed(2)},${y(p.lower).toFixed(2)}`).join('')}Z" fill="#efb45f" opacity=".13"/>`;}
  for(const f of fib.filter(f=>f.price>min&&f.price<max&&(!f.startDate||f.startDate<=end))){const yy=y(f.price),from=xday(Math.max(minDay,f.startDate?utcDay(f.startDate):minDay));s+=`<line x1="${from}" x2="${W-R}" y1="${yy}" y2="${yy}" stroke="#b4a7d6" opacity=".55" stroke-dasharray="3 5"/><text x="${W-R-4}" y="${yy-5}" text-anchor="end" fill="#c2b5e0" font-size="11">${nf(f.ratio*100,1)}% · ${unit==='usd'?money(f.price):nf(f.price*factor,1)}</text>`;}
  if(observed.length)s+=`<path d="${path(observed)}" fill="none" stroke="#e2eaf3" stroke-width="1.8"/>`;
  if(future.length)s+=`<path d="${path(future)}" fill="none" stroke="#f2b960" stroke-width="1.8" stroke-dasharray="5 3"/>`;
  if(showDrawdown){if(observed.length)s+=`<path d="${path(observed,yd,'drawdownPct')}" fill="none" stroke="#a7b8cd" stroke-width="1.1"/>`;if(future.length)s+=`<path d="${path(future,yd,'drawdownPct')}" fill="none" stroke="#cba069" stroke-width="1.1" stroke-dasharray="4 3"/>`;}
  if(showStates){let segments=[];for(const p of states.filter(p=>p.date>=start&&p.date<=end)){const last=segments.at(-1);if(last&&last.state===p.state)last.end=p.date;else segments.push({start:p.date,end:p.date,state:p.state});}for(const seg of segments){const xx=xday(utcDay(seg.start)),width=xday(utcDay(seg.end)+stateStepDays)-xx;s+=`<rect x="${xx}" y="${stateTop}" width="${Math.max(.7,width)}" height="${stateHeight}" fill="${COLORS[seg.state]||COLORS.transition}"><title>${esc(STATE_LABELS[seg.state])} ${seg.start}–${seg.end}</title></rect>`;}}
  const visibleTurns=turns.filter(p=>p.date>=start&&p.date<=end);
  if(showTurns)for(const p of visibleTurns){const actual=!split||p.date<=split,color=p.type==='high'?'#e7bb73':'#85bfdc';s+=`<circle data-date="${p.date}" cx="${xday(utcDay(p.date))}" cy="${y(p.price)}" r="${fullHistory?2.5:4}" fill="${actual?color:'#10151c'}" stroke="${color}" stroke-width="1.4"><title>${esc(`${actual?'관측':'예시 경로'} ${p.type==='high'?'고점':'저점'} ${date(p.date)} · ${money(p.price)}`)}</title></circle>`;}
  s+='</g>';
  if(nextTurn&&nextTurn.date>=start&&nextTurn.date<=end){const xx=xday(utcDay(nextTurn.date)),headerFixed=small||fullHistory,anchor=headerFixed||xx>W-190?'end':'start',tx=headerFixed?W-R:anchor==='end'?xx-7:xx+7,label=`${nextTurn.type==='high'?'조정':'반등'} 후보 · D-${nf(nextTurn.days)}`,width=132,left=anchor==='end'?tx-width:tx-5;s+=`<line x1="${xx}" x2="${xx}" y1="${T}" y2="${bottom}" stroke="#9bc8e8" stroke-dasharray="4 5" opacity=".8"/><g data-next-turn="${nextTurn.type}" role="button" tabindex="0" aria-label="${esc(label)} · 날짜와 범위 보기" style="cursor:pointer"><title>가정 · ${date(nextTurn.date)} · ${date(nextTurn.lowerDate)}–${date(nextTurn.upperDate)}</title><rect x="${left}" y="${T-29}" width="${width+5}" height="23" rx="3" fill="#172737"/><text x="${tx}" y="${T-14}" text-anchor="${anchor}" fill="#badcf2" font-size="11">${esc(label)}</text></g>`;}
  if(!fullHistory&&!small){let lastX=-999;for(const event of events.filter(p=>p.date>=start&&p.date<=end)){const xx=xday(utcDay(event.date)),yy=xx-lastX<140?T+30:T+16;lastX=xx;s+=`<line x1="${xx}" x2="${xx}" y1="${yy+8}" y2="${priceBottom}" stroke="#bca176" stroke-dasharray="2 6" opacity=".45"/><text x="${Math.min(W-R-5,xx)}" y="${yy}" text-anchor="${xx>W-180?'end':'start'}" fill="#c6ad88" font-size="11">${esc(event.shortLabel||event.label)}</text>`;}}
  const latest=visible.find(p=>p.date===split);
  if(latest){const yy=y(latest.price);s+=`<line x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}" stroke="#7da89c" stroke-dasharray="2 5" opacity=".5"/><rect x="${W-R}" y="${yy-9}" width="${R-3}" height="18" rx="2" fill="#2b6558"/><text x="${W-R+5}" y="${yy+4}" fill="#edf8f3" font-size="${small?10:11}">${unit==='usd'?money(latest.price):nf(latest.price*factor,1)}</text>`;}
  s+=`<g id="${svg.id}-cross" pointer-events="none"><line class="cross-time" y1="${T}" y2="${bottom}" stroke="#afc4dd" stroke-dasharray="3 3" opacity=".6"/><line class="cross-price" x1="${L}" x2="${W-R}" stroke="#afc4dd" stroke-dasharray="3 3" opacity=".6"/><circle r="4" fill="#10151c" stroke="#f4dcac" stroke-width="1.5"/><g class="cross-price-tag"><rect x="${W-R}" width="${R-3}" height="18" rx="2" fill="#465366"/><text x="${W-R+5}" fill="#edf2f9" font-size="${small?10:11}"></text></g><g class="cross-date-tag"><rect width="80" height="18" rx="2" fill="#39485b"/><text fill="#edf2f9" font-size="10" text-anchor="middle"></text></g></g>`;
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.dataset.plotLeft=String(L);svg.dataset.plotRight=String(W-R);svg.innerHTML=s;
  const cross=svg.querySelector('[id$="-cross"]'),crossLine=cross.querySelector('.cross-time'),crossPrice=cross.querySelector('.cross-price'),crossDot=cross.querySelector('circle'),priceTag=cross.querySelector('.cross-price-tag'),dateTag=cross.querySelector('.cross-date-tag'),stateByDate=new Map(states.map(p=>[p.date,p]));
  let active=nearest(visible,utcDay(selectedDate||split||visible.at(-1).date)),pinned=false;
  const inspection=index=>{const p=visible[index],isFuture=Boolean(split&&p.date>split),flow=stateByDate.get(p.date),event=visibleTurns.find(t=>t.date===p.date),fields=[{label:unit==='usd'?'가격 · 달러':'최근 관측 가격 = 100',value:unit==='usd'?money(p.price):nf(p.price*factor,1)},{label:'이전 최고가 대비',value:percent(p.drawdownPct)},{label:'가격 흐름',value:plainState[flow?.state]||'—'}];
    if(event)fields.push({label:isFuture?'예시에서 확인한 날':'방향 전환 확인일',value:date(event.confirmationDate)});else if(isFuture&&p.lower)fields.push({label:'여러 예시의 가격 범위',value:`${money(p.lower)}–${money(p.upper)}`});
    return {label:`${date(p.date)}${event?` · ${event.type==='high'?'고점':'저점'}${isFuture?' 예시':''}`:''}`,date:p.date,kind:isFuture?'simulated':'observed',fields,note:isFuture?'선택한 가정의 예시입니다. 가격 범위는 확률이 보정된 예측구간이 아닙니다.':event?`가격이 꺾인 날과, 반대 방향으로 ${nf(threshold*100)}% 이동해 확인한 날을 구분합니다.`:frequency==='weekly'?'선은 주간 마지막 가격, 선택한 값은 해당 날짜의 일말 가격입니다.':'하루가 끝난 가격입니다. 장중 최고·최저가와 다를 수 있습니다.'};};
  function mark(index){const p=visible[index],xx=x(p),yy=y(p.price),tx=Math.max(L,Math.min(W-R-80,xx-40));crossLine.setAttribute('x1',xx);crossLine.setAttribute('x2',xx);crossPrice.setAttribute('y1',yy);crossPrice.setAttribute('y2',yy);crossDot.setAttribute('cx',xx);crossDot.setAttribute('cy',yy);priceTag.querySelector('rect').setAttribute('y',yy-9);priceTag.querySelector('text').setAttribute('y',yy+4);priceTag.querySelector('text').textContent=unit==='usd'?money(p.price):nf(p.price*factor,1);dateTag.querySelector('rect').setAttribute('x',tx);dateTag.querySelector('rect').setAttribute('y',axisY-12);dateTag.querySelector('text').setAttribute('x',tx+40);dateTag.querySelector('text').setAttribute('y',axisY+1);dateTag.querySelector('text').textContent=p.date;}

  function commit(index,pin=true,user=pin){active=Math.max(0,Math.min(visible.length-1,index));pinned=pin;mark(active);if(tooltip)tooltip.hidden=true;onInspect(inspection(active),{user,openPanel:pin});}
  function fromPointer(e){const target=e.target.closest?.('[data-date]');if(target)return nearest(visible,utcDay(target.dataset.date));const rect=svg.getBoundingClientRect(),px=(e.clientX-rect.left)/rect.width*W;return nearest(visible,minDay+(Math.max(L,Math.min(W-R,px))-L)/(W-L-R)*span);}
  svg.onclick=e=>{if(e.target.closest?.('[data-next-turn]')){onNextTurn();return;}commit(fromPointer(e));};
  svg.onpointermove=e=>{if(e.pointerType==='touch'||e.target.closest?.('[data-next-turn]'))return;mark(fromPointer(e));if(tooltip)tooltip.hidden=true;};
  svg.onpointerleave=()=>{mark(active);if(tooltip)tooltip.hidden=true;};
  svg.onblur=()=>{if(tooltip&&!pinned)tooltip.hidden=true;};
  svg.onkeydown=e=>{if(e.target.closest?.('[data-next-turn]')&&['Enter',' '].includes(e.key)){e.preventDefault();e.stopPropagation();onNextTurn();return;}if(!['ArrowLeft','ArrowRight','Home','End','Escape'].includes(e.key))return;e.preventDefault();if(e.key==='Escape'){pinned=false;if(tooltip)tooltip.hidden=true;mark(active);return;}commit(e.key==='Home'?0:e.key==='End'?visible.length-1:active+(e.key==='ArrowRight'?1:-1)*(frequency==='weekly'?7:1),false,true);};
  commit(active,false);
  return {selectDate(value){commit(nearest(visible,utcDay(value)));},previous(){const previous=visibleTurns.filter(p=>p.date<visible[active].date).at(-1);commit(previous?nearest(visible,utcDay(previous.date)):0);},next(){const next=visibleTurns.find(p=>p.date>visible[active].date);commit(next?nearest(visible,utcDay(next.date)):visible.length-1);},getDate(){return visible[active].date;},hasPrevious(){return visibleTurns.some(p=>p.date<visible[active].date);},hasNext(){return visibleTurns.some(p=>p.date>visible[active].date);}};
}
