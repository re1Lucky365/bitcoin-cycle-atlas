/** Observed-data charts for the unified workspace; no forecast mathematics here. */
import { getMacroCycles, aggregateCloseBars, computeRollingStates, STATE_LABELS } from "./market-structure.js?v=1.23.0";
import { analyzePeakZones } from './peak-zones.js?v=1.23.0';
import { utcDay, dateFromDay, getAnchors } from './cycle-engine.js?v=1.19.0';
import { shiftCalendarMonths } from './cycle-timing.js?v=1.23.0';

const cache = new WeakMap();
const selections = new WeakMap();
const COLORS = ['#b7a3e8', '#7caedc', '#78c5b0', '#d99cb4', '#f2b15a'];
const INK = '#dfe6ed', MUTED = '#aab7c8', GRID = '#2a3442', GOLD = '#f2b15a';
const PHASE_COLORS = Object.freeze({warmup:'#4c5664','price-discovery':'#e8ba6d','bottom-formation':'#8394c9',range:'#8f9ba8',rebound:'#72b9ae',pullback:'#b293ad',advance:'#6e9f87',correction:'#bd7e82',transition:'#617181'});
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const format = (value, digits = 0) => Number.isFinite(value) ? new Intl.NumberFormat('en-US', {maximumFractionDigits:digits}).format(value) : '—';
const percent = value => Number.isFinite(value) ? `${value > 0 ? '+' : value < 0 ? '−' : ''}${format(Math.abs(value), 1)}%` : '—';
const money = value => Number.isFinite(value) ? `$${format(value, value < 1 ? 4 : value < 10 ? 2 : 0)}` : '—';
const dateText = value => value ? value.replaceAll('-', '.') : '—';
const D = utcDay;
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const shortNumber = n => n >= 1e6 ? `${format(n / 1e6, 1)}백만` : n >= 10000 ? `${format(n / 10000, 1)}만` : format(n, n < 1 ? 2 : 0);
const columns=entries=>entries.map(([key,label])=>({key,label}));
const exportSeries=(id,label,interval,unit,rows,fields,note)=>({id,label,source:'Coin Metrics · PriceUSD · UTC 일말 가격',interval,unit,kind:'analysis',rows,columns:columns(fields),note});

function research(dataset) {
  if (!cache.has(dataset)) cache.set(dataset, {rows:dataset.prices.map(([date,price])=>({date,price,day:D(date)}))});
  return cache.get(dataset);
}
function macro(dataset) {
  const entry=research(dataset);entry.macro ??= getMacroCycles(dataset);return entry.macro;
}
function bars(dataset, frequency) {
  const entry=research(dataset);entry[frequency] ??= aggregateCloseBars(dataset,{frequency});return entry[frequency];
}
function peaks(dataset) {
  const entry=research(dataset);entry.peaks ??= analyzePeakZones(dataset,{threshold:.95});return entry.peaks;
}
function phaseWindows(dataset, leg) {
  const entry=research(dataset);entry.dailyStates ??= computeRollingStates(dataset).points;
  entry.phaseWindows ??= {};
  if(!entry.phaseWindows[leg])entry.phaseWindows[leg]=macro(dataset).cycles.map(c=>{
    const startDate=leg==='bull'?c.start.date:c.peak.date,endDate=leg==='bull'?c.peak.date:c.end.date,startDay=D(startDate);
    // Same exclusive-start/inclusive-end boundary as addCycleStates in market-structure.js.
    const selected=entry.dailyStates.filter(p=>p.date>startDate&&p.date<=endDate);
    const counts=Object.fromEntries(Object.keys(STATE_LABELS).map(state=>[state,0])),segments=[];
    for(const row of selected){
      counts[row.state]++;
      const elapsed=D(row.date)-startDay-1,previous=segments.at(-1);
      if(previous&&previous.state===row.state&&previous.offset+previous.days===elapsed)previous.days++;
      else segments.push({state:row.state,offset:elapsed,days:1});
    }
    return {...c,startDate,endDate,days:D(endDate)-startDay,observationCount:selected.length,counts,segments};
  });
  return entry.phaseWindows[leg];
}
function nearest(rows, day, key='day') {
  if(!rows.length)return -1;
  let lo=0,hi=rows.length-1;
  while(lo<hi){const mid=(lo+hi)>>1;if(rows[mid][key]<day)lo=mid+1;else hi=mid;}
  return lo>0&&Math.abs(rows[lo-1][key]-day)<Math.abs(rows[lo][key]-day)?lo-1:lo;
}
function tickValues(min, max, count=5) {
  if(!Number.isFinite(min)||!Number.isFinite(max))return [0,1];
  if(max===min)max=min+1;
  const raw=(max-min)/count,power=10**Math.floor(Math.log10(raw)),ratio=raw/power;
  const step=(ratio<=1?1:ratio<=2?2:ratio<=5?5:10)*power;
  const ticks=[];
  for(let v=Math.ceil(min/step)*step;v<=max+step*.001;v+=step)ticks.push(Math.abs(v)<step*.0001?0:v);
  return ticks;
}
function logTicks(min,max) {
  const ticks=[];
  for(let power=Math.floor(Math.log10(min));power<=Math.ceil(Math.log10(max));power++){
    const v=10**power;if(v>=min&&v<=max)ticks.push(v);
  }
  return ticks;
}
function geometry(svg) {
  const width=Math.max(1,Math.round(svg.clientWidth||svg.parentElement?.clientWidth||1000)),small=width<650;
  const height=Math.max(1,Math.round(svg.clientHeight||svg.parentElement?.clientHeight||500)),short=height<330;
  const top=short?30:39,bottom=height-(short?54:62);
  return {W:width,H:height,L:small?49:64,R:small?16:26,T:top,B:bottom,small,short,
    ticks:Math.max(2,Math.min(5,Math.floor((bottom-top)/38))),axisY:height-33};
}
function frame(svg,g,title,description) {
  svg.setAttribute('viewBox',`0 0 ${g.W} ${g.H}`);svg.setAttribute('role','img');svg.setAttribute('tabindex','0');
  svg.setAttribute('aria-label',`${title}。그래프를 누르거나 좌우 방향키로 값을 확인할 수 있습니다.`);
  return `<title>${esc(title)}</title><desc>${esc(description)}</desc>`;
}
function line(rows,x,y,key='value') {
  return rows.map((p,i)=>`${i?'L':'M'}${x(p).toFixed(2)},${y(p[key]).toFixed(2)}`).join('');
}
function svgPointer(svg,event,g) {
  const rect=svg.getBoundingClientRect();
  // The root may give the SVG a taller viewport. Account for xMidYMid meet.
  const scale=Math.min(rect.width/g.W,rect.height/g.H);
  return {x:(event.clientX-rect.left-(rect.width-g.W*scale)/2)/scale,y:(event.clientY-rect.top-(rect.height-g.H*scale)/2)/scale};
}
function attach(svg,{get,set,max,selectPointer,draw}) {
  svg.onpointermove=null;svg.onpointerleave=null;svg.onblur=null;svg.onpointerdown=null;
  svg.onclick=event=>{selectPointer(event);draw({user:true,origin:'pointer'});};
  svg.onkeydown=event=>{
    if(event.shiftKey||event.altKey||event.ctrlKey||event.metaKey||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','Enter',' '].includes(event.key))return;
    event.preventDefault();if(!['Enter',' '].includes(event.key))set(event.key==='Home'?0:event.key==='End'?max():get()+(['ArrowRight','ArrowDown'].includes(event.key)?1:-1));draw({user:true,origin:'keyboard'});
  };
  return {previous(){set(get()-1);draw({user:true,origin:'navigation'});},next(){set(get()+1);draw({user:true,origin:'navigation'});}};
}

function cycleSeries(dataset,alignment) {
  const {rows}=research(dataset),last=rows.at(-1),groups=[];
  if(alignment==='halving'){
    for(const anchor of getAnchors(dataset,'halving'))groups.push({start:anchor.date,startPrice:anchor.price,label:`${anchor.year} 반감기`,partial:false});
  }else if(alignment==='calendar'){
    for(let year=2010;year<=Number(last.date.slice(0,4));year+=4){
      const calendarStart=`${year}-01-01`,end=`${year+3}-12-31`,selected=rows.filter(p=>p.date>=calendarStart&&p.date<=end);
      if(selected.length)groups.push({start:calendarStart,startPrice:selected[0].price,label:`${year}–${year+3}`,partial:selected[0].date!==calendarStart,first:selected[0].date});
    }
  }else{
    for(const c of macro(dataset).cycles)groups.push({start:c.start.date,startPrice:c.start.price,label:`${c.start.date.slice(0,4)} 시작`,partial:c.leftCensored});
  }
  return groups.map((group,index)=>{
    const end=shiftCalendarMonths(group.start,48),endDay=D(end),startDay=D(group.start);
    let high=0;
    const points=rows.filter(p=>p.date>=group.start&&(alignment==='calendar'?p.day<endDay:p.day<=endDay)).map(p=>{high=Math.max(high,p.price);return {...p,elapsed:p.day-startDay,value:p.price/group.startPrice*100,drawdownPct:(p.price/high-1)*100};});
    const incomplete=last.date<(alignment==='calendar'?dateFromDay(endDay-1):end);
    return {...group,points,end,incomplete,color:index===groups.length-1?GOLD:COLORS[index%COLORS.length],
      legend:`${group.label}${group.partial?' · 초기 일부':''}${incomplete?' · 진행 중':''}`};
  }).filter(s=>s.points.length);
}

function renderCycles({svg,dataset,alignment,onInspect,presentation}) {
  const g=geometry(svg),series=cycleSeries(dataset,alignment),maxDay=Math.max(...series.map(s=>D(s.end)-D(s.start)));
  const key=`cycles:${alignment}`,saved=selections.get(svg);
  let selected=saved?.key===key?saved.index:series.at(-1).points.at(-1).elapsed;
  selected=clamp(selected,0,maxDay);
  const all=series.flatMap(s=>s.points),min=Math.min(...all.map(p=>p.value))*.75,max=Math.max(...all.map(p=>p.value))*1.3;
  const x=day=>g.L+day/maxDay*(g.W-g.L-g.R),y=value=>g.B-(Math.log(value)-Math.log(min))/(Math.log(max)-Math.log(min))*(g.B-g.T);
  const label=alignment==='halving'?'반감기':alignment==='calendar'?'달력 구간 시작':'사후 저점';
  const title=`${label}부터 같은 4년 비교`,caption='같은 출발값 100 · 관측된 가격만 표시';
  const note=alignment==='calendar'?'달력 4년은 비교를 위한 구획입니다. 2010년은 7월 18일부터 관측되어 그 첫 가격을 100으로 삼습니다.':alignment==='halving'?'가로축은 각 반감기 이후 경과일입니다. 각 선의 끝은 관측이 끝났거나 4년을 채운 지점입니다.':'저점은 후속 가격으로 사후에 정한 기준입니다. 2010년은 최종 저점이 아닌 첫 관측일이며, 최신 4년 창은 아직 진행 중입니다.';
  let initialInspection;
  function inspect(){
    const fields=series.map(s=>{
      if(!s.points.length||selected<s.points[0].elapsed||selected>s.points.at(-1).elapsed)return {label:s.legend,value:'해당 날짜 관측 없음'};
      const p=s.points[nearest(s.points,selected,'elapsed')];
      return {label:`${s.label} · ${dateText(p.date)}`,value:`${format(p.value,1)}  /  ${money(p.price)}`};
    });
    return {label:`시작 후 ${format(selected)}일`,date:null,kind:'observed',fields,note:'각 행: 시작을 100으로 맞춘 값 / 해당 날짜의 실제 USD 가격. 날짜가 다른 과거 기록을 나란히 비교합니다.'};
  }
  function draw({user=false,origin='render'}={}){
    let out=frame(svg,g,title,note);
    const ticks=logTicks(min,max),tickStride=Math.max(1,Math.ceil(ticks.length/g.ticks));
    for(const v of ticks.filter((_,i)=>i%tickStride===0)){const yy=y(v);out+=`<line x1="${g.L}" x2="${g.W-g.R}" y1="${yy}" y2="${yy}" stroke="${GRID}"/><text data-indicator-axis-label x="${g.L-9}" y="${yy+4}" fill="${MUTED}" text-anchor="end" font-size="12">${esc(shortNumber(v))}</text>`;}
    for(let year=0;year<=4;year++){const xx=x(Math.min(maxDay,year*365.25));out+=`<line x1="${xx}" x2="${xx}" y1="${g.T}" y2="${g.B}" stroke="${GRID}"/><text data-indicator-axis-label x="${xx}" y="${g.axisY}" text-anchor="middle" fill="${MUTED}" font-size="12">${year}년</text>`;}
    out+=`<text x="${g.L}" y="${g.short?16:20}" font-size="12" fill="${MUTED}">시작 = 100 · 배수 눈금</text>`;
    for(const s of series){const sampled=s.points.filter((_,i)=>i%Math.max(1,Math.floor(s.points.length/(g.W*1.5)))===0||i===s.points.length-1);out+=`<path data-indicator-line d="${line(sampled,p=>x(p.elapsed),y)}" fill="none" stroke="${s.color}" stroke-width="${s.color===GOLD?2.25:1.6}" stroke-linejoin="round"/>`;}
    const xx=x(selected);out+=`<line x1="${xx}" x2="${xx}" y1="${g.T}" y2="${g.B}" stroke="#d6e1ef" opacity=".6" stroke-dasharray="4 4"/>`;
    for(const s of series){if(selected<s.points[0].elapsed||selected>s.points.at(-1).elapsed)continue;const p=s.points[nearest(s.points,selected,'elapsed')];out+=`<circle cx="${x(p.elapsed)}" cy="${y(p.value)}" r="4" fill="#10151c" stroke="${s.color}" stroke-width="2"/>`;}
    svg.innerHTML=out;presentation(svg);selections.set(svg,{key,index:selected});initialInspection=inspect();onInspect(initialInspection,{user,origin,openPanel:false});
  }
  const navigation=attach(svg,{get:()=>selected,set:v=>{selected=clamp(Math.round(v),0,maxDay);},max:()=>maxDay,selectPointer:event=>{const p=svgPointer(svg,event,g);selected=clamp(Math.round((p.x-g.L)/(g.W-g.L-g.R)*maxDay),0,maxDay);},draw});
  draw();
  return {title,caption,note,legend:series.map(s=>({label:s.legend,color:s.color})),initialInspection,...navigation,
    exportData(){return exportSeries('cycles',title,'daily','priceUsd: USD; startIndex: 시작=100; elapsedDays: 일',series.flatMap(s=>s.points.map(p=>({series:s.label,date:p.date,elapsedDays:p.elapsed,priceUsd:p.price,startIndex:p.value,startDate:s.start,startPriceUsd:s.startPrice,partial:s.partial,incomplete:s.incomplete}))),[['series','비교 구간'],['date','관측 날짜 UTC'],['elapsedDays','독립 축 경과일'],['priceUsd','실제 가격 USD'],['startIndex','시작 가격=100 지수'],['startDate','비교 시작일 UTC'],['startPriceUsd','기준 가격 USD'],['partial','초기 일부 관측'],['incomplete','4년 미완료']],`${note} 독립 경과일 축이며 공통 달력 축으로 합치지 않습니다. 화면의 경량 표시 전 원래 관측점을 모두 내보냅니다.`);},
    selectDate(date){if(!date)return;selected=clamp(D(date)-D(series.at(-1).start),0,maxDay);draw({user:true,origin:'date'});}};
}

function renderDuration({svg,dataset,onInspect,presentation}) {
  const g=geometry(svg),cycles=macro(dataset).cycles,key='duration',saved=selections.get(svg);
  let selected=clamp(saved?.key===key?saved.index:cycles.length-1,0,cycles.length-1);
  const left=g.small?60:91,plotTop=g.short?35:53,plotBottom=g.H-10,rowHeight=(plotBottom-plotTop)/cycles.length,maxDays=Math.max(1461,...cycles.map(c=>c.cycleDays));
  const x=days=>left+days/maxDays*(g.W-left-g.R);
  const title='상승과 하락에 실제로 걸린 시간',caption='저점 → 고점 → 다음 저점 · 달력 일수';
  const note='색칠된 길이는 사후에 구분한 기간입니다. 2026년 저점은 현재까지의 후보이며, 하락 기간이 확정된 것은 아닙니다.';
  let initialInspection;
  function inspect(){const c=cycles[selected];return {label:`${c.peakYear}년 고점 사이클`,date:c.peak.date,kind:'observed',fields:[{label:'상승 · 저점 → 고점',value:`${format(c.bullDays)}일`},{label:'하락 · 고점 → 저점',value:`${format(c.bearDays)}일${c.endIsCandidate?' · 후보':''}`},{label:'시작 → 고점',value:`${dateText(c.start.date)} → ${dateText(c.peak.date)}`},{label:'다음 저점',value:`${dateText(c.end.date)}${c.endIsCandidate?' · 미확정':''}`},{label:'관측 범위',value:c.leftCensored?'초기 관측이 부족한 구간':c.rightCensored?'진행 중인 사이클':'사후 구분 완료'}],note:c.endIsCandidate?`후보 저점 이후 ${format(c.recoverySinceCandidateDays)}일의 회복은 막대의 하락 기간에 포함하지 않습니다.`:'‘3년 상승·1년 하락’은 고정 규칙이 아닙니다. 기간은 실제 관측값으로 계산했습니다.'};}
  function draw({user=false,origin='render'}={}){
    let out=frame(svg,g,title,note);
    for(let year=0;year<=4;year++){const xx=x(year*365.25);out+=`<line x1="${xx}" x2="${xx}" y1="${g.short?27:36}" y2="${plotBottom}" stroke="${GRID}" stroke-dasharray="${year===3?'4 4':'0'}"/><text data-indicator-axis-label x="${xx}" y="${g.short?18:25}" text-anchor="middle" fill="${MUTED}" font-size="12">${year}년</text>`;}
    cycles.forEach((c,i)=>{const yy=plotTop+i*rowHeight,h=Math.max(8,Math.min(30,rowHeight-(g.short?12:26))),barY=yy+(rowHeight-h)/2,a=x(c.bullDays),end=x(c.cycleDays);if(i===selected)out+=`<rect x="6" y="${yy}" width="${g.W-12}" height="${rowHeight-2}" rx="5" fill="#b6c9e5" opacity=".055"/>`;
      out+=`<text x="${left-10}" y="${barY+h/2+4}" text-anchor="end" fill="${INK}" font-size="12">${c.peakYear}</text>`;
      if(!g.short)out+=`<text x="${left-10}" y="${barY+h/2+20}" text-anchor="end" fill="${MUTED}" font-size="11">${c.leftCensored?'초기 일부':c.rightCensored?'진행 중':'완료'}</text>`;
      out+=`<rect data-indicator-fill x="${left}" y="${barY}" width="${a-left}" height="${h}" fill="#72b9ae" rx="3"/><rect data-indicator-fill x="${a}" y="${barY}" width="${Math.max(1,end-a)}" height="${h}" fill="#cb9299" opacity="${c.endIsCandidate ? .6 : .9}" rx="3"${c.endIsCandidate?' stroke="#f0bac0" stroke-dasharray="3 3"':''}/>`;
      if(a-left>65&&h>=14)out+=`<text x="${left+(a-left)/2}" y="${barY+h/2+4}" text-anchor="middle" fill="#0c171b" font-size="12" font-weight="600">${format(c.bullDays)}일</text>`;
      if(end-a>45&&h>=14)out+=`<text x="${a+(end-a)/2}" y="${barY+h/2+4}" text-anchor="middle" fill="#171015" font-size="12" font-weight="600">${format(c.bearDays)}일</text>`;
    });
    svg.innerHTML=out;presentation(svg);selections.set(svg,{key,index:selected});initialInspection=inspect();onInspect(initialInspection,{user,origin,openPanel:false});
  }
  const navigation=attach(svg,{get:()=>selected,set:v=>{selected=clamp(v,0,cycles.length-1);},max:()=>cycles.length-1,selectPointer:event=>{const p=svgPointer(svg,event,g);selected=clamp(Math.floor((p.y-plotTop)/rowHeight),0,cycles.length-1);},draw});
  draw();return {title,caption,note,legend:[{label:'저점부터 고점까지',color:'#72b9ae'},{label:'고점부터 다음 저점까지',color:'#cb9299'},{label:'아직 확정되지 않은 저점',color:'#cb9299',dashed:true}],initialInspection,...navigation,
    exportData(){return exportSeries('duration',title,'cycle','days',cycles.map(c=>({peakYear:c.peakYear,startDate:c.start.date,peakDate:c.peak.date,endDate:c.end.date,bullDays:c.bullDays,bearDays:c.bearDays,cycleDays:c.cycleDays,endIsCandidate:Boolean(c.endIsCandidate),leftCensored:Boolean(c.leftCensored),rightCensored:Boolean(c.rightCensored)})),[['peakYear','사이클 고점 연도'],['startDate','시작 저점 UTC'],['peakDate','고점 UTC'],['endDate','다음 저점 또는 후보 UTC'],['bullDays','상승 일수'],['bearDays','하락 일수'],['cycleDays','전체 일수'],['endIsCandidate','끝 저점 미확정 후보'],['leftCensored','초기 일부 관측'],['rightCensored','진행 중']],note);},
    selectDate(date){selected=cycles.reduce((best,c,i)=>Math.abs(D(c.peak.date)-D(date))<Math.abs(D(cycles[best].peak.date)-D(date))?i:best,0);draw({user:true,origin:'date'});}};
}

function renderPhases({svg,dataset,phaseLeg,onInspect,presentation}) {
  const g=geometry(svg),windows=phaseWindows(dataset,phaseLeg),key=`phases:${phaseLeg}`,saved=selections.get(svg);
  let selected=clamp(saved?.key===key?saved.index:windows.length-1,0,windows.length-1);
  const left=g.small?60:91,plotTop=g.short?35:53,plotBottom=g.H-10,rowHeight=(plotBottom-plotTop)/windows.length,maxDays=Math.ceil(Math.max(...windows.map(c=>c.days))/100)*100;
  const x=days=>left+days/maxDays*(g.W-left-g.R),isBull=phaseLeg==='bull';
  const title=`${isBull?'상승장':'하락장'} 안에서 반복된 흐름`,caption='색의 순서 = 실제 발생 순서 · 가로 길이 = 실제 일수';
  const note='각 날짜는 당시까지 알려진 자료로 한 가지 상태에만 분류합니다. 전체 상승·하락 구간의 경계는 사후에 정했으며, 국면 이름이 미래 방향을 보장하지 않습니다.';
  let initialInspection;
  function inspect(){
    const row=windows[selected];
    return {label:`${row.peakYear}년 고점 사이클 · ${isBull?'상승장':'하락장'} 내부`,date:row.endDate,kind:'observed',
      fields:[{label:'관측 일수 / 달력 일수',value:`${format(row.observationCount)} / ${format(row.days)}일`},...Object.entries(STATE_LABELS).map(([state,label])=>({label,value:`${format(row.counts[state])}일`}))],
      note:`${dateText(dateFromDay(D(row.startDate)+1))}–${dateText(row.endDate)} · 시작 기준일 제외, 마지막 날 포함. ${row.leftCensored?'초기 관측이 불완전합니다. ':''}${row.rightCensored&&!isBull?'끝 날짜는 미확정 저점 후보입니다. ':''}일별 12% 전환 규칙. ‘저점 형성 조건’은 최종 저점 확정이 아닙니다.`};
  }
  function draw({user=false,origin='render'}={}){
    let out=frame(svg,g,title,note);
    for(const day of tickValues(0,maxDays,g.small?3:5)){const xx=x(day);out+=`<line x1="${xx}" x2="${xx}" y1="${g.short?27:39}" y2="${plotBottom}" stroke="${GRID}"/><text data-indicator-axis-label x="${xx}" y="${g.short?18:26}" text-anchor="${xx>g.W-28?'end':'middle'}" fill="${MUTED}" font-size="12">${format(day)}일</text>`;}
    windows.forEach((row,i)=>{
      const yy=plotTop+i*rowHeight,h=Math.max(8,Math.min(31,rowHeight-(g.short?12:31))),barY=yy+(rowHeight-h)/2-(g.short?0:5),selectedRow=i===selected;
      if(selectedRow)out+=`<rect x="6" y="${yy}" width="${g.W-12}" height="${rowHeight-2}" rx="5" fill="#b6c9e5" opacity=".06"/>`;
      out+=`<text x="${left-10}" y="${barY+h/2+4}" text-anchor="end" fill="${INK}" font-size="12">${row.peakYear}</text>`;
      if(!g.short)out+=`<text x="${left-10}" y="${barY+h/2+20}" text-anchor="end" fill="${MUTED}" font-size="11">${row.leftCensored?'초기 일부':row.rightCensored?'진행 중':'완료'}</text>`;
      out+=`<rect x="${left}" y="${barY}" width="${x(row.days)-left}" height="${h}" fill="#202a36"/>`;
      for(const segment of row.segments){
        const xx=x(segment.offset),width=x(segment.offset+segment.days)-xx;
        out+=`<rect data-indicator-fill x="${xx}" y="${barY}" width="${width}" height="${h}" fill="${PHASE_COLORS[segment.state]}" opacity="${selectedRow?1:.82}"><title>${esc(STATE_LABELS[segment.state])} · ${segment.days}일 · ${dateText(dateFromDay(D(row.startDate)+segment.offset+1))}–${dateText(dateFromDay(D(row.startDate)+segment.offset+segment.days))}</title></rect>`;
      }
      if(row.rightCensored&&!isBull)out+=`<rect x="${left}" y="${barY}" width="${x(row.days)-left}" height="${h}" fill="none" stroke="#dce5f1" stroke-dasharray="4 3"/>`;
      if(!g.short)out+=`<text x="${clamp(x(row.days),left+28,g.W-g.R)}" y="${barY+h+16}" text-anchor="end" fill="${MUTED}" font-size="12">${format(row.days)}일${row.rightCensored&&!isBull?' · 후보':''}</text>`;
    });
    svg.innerHTML=out;presentation(svg);selections.set(svg,{key,index:selected});initialInspection=inspect();onInspect(initialInspection,{user,origin,openPanel:false});
  }
  const navigation=attach(svg,{get:()=>selected,set:value=>{selected=clamp(value,0,windows.length-1);},max:()=>windows.length-1,selectPointer:event=>{const p=svgPointer(svg,event,g);selected=clamp(Math.floor((p.y-plotTop)/rowHeight),0,windows.length-1);},draw});
  draw();
  return {title,caption,note,legend:Object.entries(STATE_LABELS).filter(([state])=>windows.some(row=>row.counts[state]>0)).map(([state,label])=>({label,color:PHASE_COLORS[state]})),initialInspection,...navigation,
    exportData(){return exportSeries('duration',title,'daily state segments','days',windows.flatMap(row=>row.segments.map(segment=>({peakYear:row.peakYear,leg:phaseLeg,state:segment.state,stateLabel:STATE_LABELS[segment.state],startDate:dateFromDay(D(row.startDate)+segment.offset+1),endDate:dateFromDay(D(row.startDate)+segment.offset+segment.days),offsetDays:segment.offset,days:segment.days,windowStart:row.startDate,windowEnd:row.endDate,rightCensored:Boolean(row.rightCensored&&!isBull)}))),[['peakYear','사이클 고점 연도'],['leg','상승장 또는 하락장'],['state','국면 코드'],['stateLabel','국면 이름'],['startDate','국면 시작 UTC'],['endDate','국면 마지막 UTC'],['offsetDays','독립 축 시작 위치 일'],['days','실제 국면 일수'],['windowStart','시작 기준일 UTC 제외'],['windowEnd','마지막 기준일 UTC 포함'],['rightCensored','끝 저점 미확정 후보']],`${note} 구간 시작 기준일 제외·마지막 날 포함. 일별 12% 전환 규칙입니다.`);},
    selectDate(date){selected=windows.reduce((best,row,i)=>Math.abs(D(row.endDate)-D(date))<Math.abs(D(windows[best].endDate)-D(date))?i:best,0);draw({user:true,origin:'date'});}};
}

const METRICS={
  returnPct:{label:'기간 수익률',unit:'%',description:'연속된 전기 마지막 가격에서 이번 기간 마지막 가격까지의 변화입니다. 기간 경계의 종가가 누락되면 계산하지 않습니다.'},
  maxDrawdownPct:{label:'기간 중 가장 큰 하락',unit:'%',description:'기간 내 관측된 앞선 고점에서 이후 저점까지 가장 크게 떨어진 비율입니다. 바로 전날의 전기 마지막 가격이 있을 때 포함합니다.'},
  realizedVolPct:{label:'가격 흔들림',unit:'%',description:'일별 수익률의 흔들림을 연간 기준으로 환산한 값입니다. 상승 방향이나 손실 확률을 뜻하지 않습니다.'},
  discoveryDays:{label:'새 최고가를 기록한 날',unit:'일',description:'해당 날짜까지 관측한 최고 일말 가격을 새로 넘은 날의 수입니다.'},
};
function renderPeriods({svg,dataset,period,metric,scope,onInspect,presentation}) {
  const g=geometry(svg),all=bars(dataset,period),definition=METRICS[metric]||METRICS.returnPct,key=`periods:${period}`,saved=selections.get(svg);
  if(!METRICS[metric])metric='returnPct';
  let selected=clamp(saved?.key===key?saved.index:all.length-1,0,all.length-1);
  const pageSize=scope==='all'?all.length:period==='quarterly'?20:48;
  let start=Math.max(0,all.length-pageSize);
  if(selected<start)start=Math.max(0,selected-Math.floor(pageSize/2));
  const title=`${period==='quarterly'?'분기':'월'}별 ${definition.label}`,caption=`2010년부터 현재까지 · ${scope==='all'?'전체 기간':'한 화면에 최근 '+pageSize+(period==='quarterly'?'분기':'개월')}`;
  const note=`${definition.description} 끝나지 않은 기간은 테두리로 표시합니다.`;
  let initialInspection;
  function inspect(){const row=all[selected];return {label:row.period.replace('-Q','년 ')+(period==='quarterly'?'분기':''),date:row.lastObservationDate,kind:'observed',fields:[{label:'기간 수익률',value:percent(row.returnPct)},{label:'기간 중 최대 하락',value:percent(row.maxDrawdownPct)},{label:'가격 흔들림 · 연간 환산',value:`${format(row.realizedVolPct,1)}%`},{label:'새 최고가를 기록한 날',value:`${format(row.discoveryDays)}일`},{label:'관측된 날짜',value:`${format(row.observations)} / ${format(row.expectedDays)}일${row.complete?' · 완료':' · 일부 관측'}`}],note:`${dateText(row.firstObservationDate)}–${dateText(row.lastObservationDate)} · 일말 가격 기준. ${definition.description}`};}
  function draw({user=false,origin='render'}={}){
    if(scope!=='all'){if(selected<start)start=selected;if(selected>=start+pageSize)start=selected-pageSize+1;start=clamp(start,0,Math.max(0,all.length-pageSize));}else start=0;
    const rows=all.slice(start,start+pageSize),values=rows.map(p=>p[metric]).filter(Number.isFinite);
    const min=Math.min(0,...values),max=Math.max(0,...values),pad=(max-min||1)*.12,low=min<0?min-pad:0,high=max>0?max+pad:0;
    const y=value=>g.B-(value-low)/(high-low||1)*(g.B-g.T),barSpace=(g.W-g.L-g.R)/rows.length,barWidth=Math.max(.6,barSpace*.72),x=i=>g.L+barSpace*(i+.5),zero=y(0);
    let out=frame(svg,g,title,note);
    for(const v of tickValues(low,high,g.ticks)){const yy=y(v);out+=`<line x1="${g.L}" x2="${g.W-g.R}" y1="${yy}" y2="${yy}" stroke="${GRID}"/><text data-indicator-axis-label x="${g.L-9}" y="${yy+4}" text-anchor="end" fill="${MUTED}" font-size="12">${format(v,1)}${definition.unit}</text>`;}
    out+=`<line x1="${g.L}" x2="${g.W-g.R}" y1="${zero}" y2="${zero}" stroke="#758193"/><text x="${g.L}" y="${g.short?16:20}" fill="${MUTED}" font-size="12">${esc(rows[0]?.period)} — ${esc(rows.at(-1)?.period)}</text>`;
    rows.forEach((row,i)=>{const value=row[metric];if(!Number.isFinite(value))return;const yy=y(value),fill=metric==='returnPct'?(value<0?'#cf969f':'#7fc5b0'):metric==='maxDrawdownPct'?'#cf969f':GOLD;
      out+=`<rect data-indicator-fill x="${x(i)-barWidth/2}" y="${Math.min(zero,yy)}" width="${barWidth}" height="${Math.max(1,Math.abs(yy-zero))}" fill="${fill}" opacity="${i+start===selected?1:.7}"${!row.complete?' stroke="#e9eff6" stroke-width="1.2" stroke-dasharray="3 2"':''}><title>${esc(row.period)} · ${definition.label} ${format(value,1)}${definition.unit}</title></rect>`;
    });
    const labelCount=Math.max(2,Math.min(7,Math.floor((g.W-g.L-g.R)/72))),stride=Math.max(1,Math.ceil(rows.length/labelCount));
    rows.forEach((row,i)=>{if(i%stride!==0&&i!==rows.length-1)return;if(i===rows.length-1&&i%stride<stride*.6&&i!==0)return;const xx=x(i);out+=`<text data-indicator-axis-label x="${xx}" y="${g.axisY}" fill="${MUTED}" font-size="12" text-anchor="${xx>g.W-40?'end':i===0?'start':'middle'}">${esc(row.period.replace('-Q','.Q'))}</text>`;});
    const sx=x(selected-start);out+=`<line x1="${sx}" x2="${sx}" y1="${g.T}" y2="${g.B}" stroke="#e5edf7" opacity=".8" stroke-dasharray="4 4"/>`;
    svg.innerHTML=out;presentation(svg);selections.set(svg,{key,index:selected});initialInspection=inspect();onInspect(initialInspection,{user,origin,openPanel:false});
  }
  const navigation=attach(svg,{get:()=>selected,set:v=>{selected=clamp(v,0,all.length-1);},max:()=>all.length-1,selectPointer:event=>{const p=svgPointer(svg,event,g),length=Math.min(pageSize,all.length-start);selected=clamp(start+Math.floor((p.x-g.L)/(g.W-g.L-g.R)*length),start,start+length-1);},draw});
  draw();return {title,caption,note,legend:metric==='returnPct'?[{label:'상승한 기간',color:'#7fc5b0'},{label:'하락한 기간',color:'#cf969f'},{label:'기간 미완료',color:'#dfe6ed',dashed:true}]:[{label:definition.label,color:metric==='maxDrawdownPct'?'#cf969f':GOLD},{label:'기간 미완료',color:'#dfe6ed',dashed:true}],initialInspection,...navigation,
    exportData(){return exportSeries('periods',title,period,'returnPct/maxDrawdownPct/realizedVolPct: %; discoveryDays: 일',all.slice(start,start+pageSize).map(row=>({period:row.period,startDate:row.startDate,endDate:row.endDate,firstObservationDate:row.firstObservationDate,lastObservationDate:row.lastObservationDate,returnPct:row.returnPct,maxDrawdownPct:row.maxDrawdownPct,realizedVolPct:row.realizedVolPct,discoveryDays:row.discoveryDays,observations:row.observations,expectedDays:row.expectedDays,complete:row.complete})),[['period','집계 기간'],['startDate','기간 시작 UTC'],['endDate','기간 끝 UTC'],['firstObservationDate','첫 관측 UTC'],['lastObservationDate','마지막 관측 UTC'],['returnPct','기간 수익률 %'],['maxDrawdownPct','기간 최대 낙폭 %'],['realizedVolPct','실현 변동성 연간환산 %'],['discoveryDays','새 최고가 기록 일수'],['observations','실제 관측 일수'],['expectedDays','기대 일수'],['complete','기간 완료']],`${note} 현재 분석 창에 표시한 집계 구간만 내보냅니다. 화면 선택 값은 ${metric}입니다.`);},
    selectDate(date){selected=all.findIndex(r=>date>=r.startDate&&date<=r.endDate);if(selected<0)selected=all.reduce((best,r,i)=>Math.abs(D(r.lastObservationDate)-D(date))<Math.abs(D(all[best].lastObservationDate)-D(date))?i:best,0);draw({user:true,origin:'date'});}};
}

function renderPeaks({svg,dataset,onInspect,presentation}) {
  const g=geometry(svg),analysis=peaks(dataset),rows=research(dataset).rows,key='peaks',saved=selections.get(svg);
  if(g.short)g.T=44;
  const series=analysis.cycles.map((c,i)=>({...c,color:i===analysis.cycles.length-1?GOLD:COLORS[i],points:rows.filter(p=>p.date>=c.halvingDate&&p.date<=c.peak.date).map(p=>({...p,elapsed:p.day-D(c.halvingDate),value:p.price/c.peak.price*100}))}));
  let selected=clamp(saved?.key===key?saved.index:series.length-1,0,series.length-1);
  const maxDay=Math.ceil(Math.max(...series.map(s=>s.peak.dayAfterHalving))/100)*100;
  const x=day=>g.L+day/maxDay*(g.W-g.L-g.R),y=value=>g.B-(value/110)*(g.B-g.T),title='고점 부근에 언제 먼저 도착했나',caption='각 사이클의 관측 최고값 = 100% · 반감기 이후 경과일';
  const note='최고값의 95%에 처음 도착한 날과 최종 관측 최고값 날짜를 구분합니다. 최고값을 나중에 알아야 계산할 수 있는 사후 비교입니다.';
  let initialInspection;
  function inspect(){const s=series[selected];return {label:`${s.peakYear}년 고점 · 95% 구간`,date:s.firstEntry.date,kind:'observed',fields:[{label:'고점 부근 첫 도착',value:dateText(s.firstEntry.date)},{label:'최고값까지 남았던 시간',value:`${format(s.firstEntry.daysBeforePeak)}일`},{label:'최고 일말 가격 날짜',value:dateText(s.peak.date)},{label:'최고 일말 가격',value:money(s.peak.price)},{label:'첫 도착 이후 최대 하락',value:percent(s.zoneStats.maxDrawdownPct)}],note:`반감기 후 ${format(s.firstEntry.dayAfterHalving)}일에 95% 구간 첫 진입. ${s.current?'최신 사이클 최고값은 현재까지 관측한 비교 기준입니다. ':''}그 뒤 내내 횡보하거나 95% 이상을 유지했다는 뜻은 아닙니다.`};}
  function draw({user=false,origin='render'}={}){
    let out=frame(svg,g,title,note);
    out+=`<rect x="${g.L}" y="${y(100)}" width="${g.W-g.L-g.R}" height="${y(95)-y(100)}" fill="#f2b15a" opacity=".13"/>`;
    for(const v of (g.ticks<4?[0,50,100]:[0,25,50,75,100])){const yy=y(v);out+=`<line x1="${g.L}" x2="${g.W-g.R}" y1="${yy}" y2="${yy}" stroke="${GRID}"/><text data-indicator-axis-label x="${g.L-9}" y="${yy+4}" text-anchor="end" fill="${MUTED}" font-size="12">${v}%</text>`;}
    out+=`<line x1="${g.L}" x2="${g.W-g.R}" y1="${y(95)}" y2="${y(95)}" stroke="${GOLD}" stroke-dasharray="4 4" opacity=".65"/><text x="${g.L}" y="${g.short?16:20}" fill="${MUTED}" font-size="12">원: 95% 첫 진입 · 사각: 최고값</text>`;
    const step=g.small?200:100;
    for(let day=0;day<=maxDay;day+=step){const xx=x(day);out+=`<line x1="${xx}" x2="${xx}" y1="${g.T}" y2="${g.B}" stroke="${GRID}"/><text data-indicator-axis-label x="${xx}" y="${g.axisY}" fill="${MUTED}" text-anchor="${xx>g.W-28?'end':'middle'}" font-size="12">${day}일</text>`;}
    series.forEach((s,i)=>{out+=`<path data-indicator-line d="${line(s.points,p=>x(p.elapsed),y)}" fill="none" stroke="${s.color}" stroke-width="${i===selected?2.4:1.4}" opacity="${i===selected?1:.55}"/>`;
      const firstX=x(s.firstEntry.dayAfterHalving),firstY=y(s.firstEntry.price/s.peak.price*100),peakX=x(s.peak.dayAfterHalving);
      out+=`<circle cx="${firstX}" cy="${firstY}" r="${i===selected?5:3.5}" fill="#10151c" stroke="${s.color}" stroke-width="2"/><rect x="${peakX-3.5}" y="${y(100)-3.5}" width="7" height="7" fill="${s.color}"/>`;
      if(i===selected){out+=`<line x1="${firstX}" x2="${peakX}" y1="${y(105)}" y2="${y(105)}" stroke="${s.color}" stroke-width="1.5"/><text x="${clamp((firstX+peakX)/2,g.L+48,g.W-g.R-48)}" y="${y(105)-7}" fill="${s.color}" text-anchor="middle" font-size="12">${s.peakYear} · ${s.firstEntry.daysBeforePeak}일 먼저</text>`;}
    });
    svg.innerHTML=out;presentation(svg);selections.set(svg,{key,index:selected});initialInspection=inspect();onInspect(initialInspection,{user,origin,openPanel:false});
  }
  const navigation=attach(svg,{get:()=>selected,set:v=>{selected=clamp(v,0,series.length-1);},max:()=>series.length-1,selectPointer:event=>{const p=svgPointer(svg,event,g),day=clamp((p.x-g.L)/(g.W-g.L-g.R)*maxDay,0,maxDay);let closest=Infinity;series.forEach((s,i)=>{const q=s.points[nearest(s.points,day,'elapsed')],distance=(x(q.elapsed)-p.x)**2+(y(q.value)-p.y)**2;if(distance<closest){closest=distance;selected=i;}});},draw});
  draw();return {title,caption,note,legend:series.map(s=>({label:`${s.peakYear}${s.current?' · 현재까지 관측':''}`,color:s.color})),initialInspection,...navigation,
    exportData(){return exportSeries('peaks',title,'daily','priceUsd/peakPriceUsd: USD; peakPercent: %; elapsedDays: 일',series.flatMap(s=>s.points.map(p=>({peakYear:s.peakYear,date:p.date,elapsedDays:p.elapsed,priceUsd:p.price,peakPercent:p.value,halvingDate:s.halvingDate,peakDate:s.peak.date,peakPriceUsd:s.peak.price,firstEntryDate:s.firstEntry.date,current:Boolean(s.current)}))),[['peakYear','사이클 고점 연도'],['date','관측 날짜 UTC'],['elapsedDays','독립 축 반감기 이후 일수'],['priceUsd','실제 가격 USD'],['peakPercent','사후 최고가 대비 %'],['halvingDate','반감기 UTC'],['peakDate','최고가 UTC'],['peakPriceUsd','최고가 USD'],['firstEntryDate','95% 첫 진입 UTC'],['current','현재까지 관측한 기준']],`${note} 독립 경과일 축이며 공통 달력 축으로 합치지 않습니다.`);},
    selectDate(date){selected=series.reduce((best,s,i)=>Math.abs(D(s.peak.date)-D(date))<Math.abs(D(series[best].peak.date)-D(date))?i:best,0);draw({user:true,origin:'date'});}};
}

/** All modes display observed history. The parent owns layout and inspector UI. */
export function renderAtlasAnalysis({svg,dataset,mode,period='monthly',alignment='trough',metric='returnPct',scope='recent',phaseLeg='bull',onInspect=()=>{},presentation=()=>{}}) {
  if(!svg||!dataset?.prices?.length)throw new TypeError('A chart SVG and observed price dataset are required.');
  svg.setAttribute('data-indicator-layer',mode==='phases'?'duration':mode);
  if(mode==='cycles')return renderCycles({svg,dataset,alignment:['trough','calendar','halving'].includes(alignment)?alignment:'trough',onInspect,presentation});
  if(mode==='duration')return renderDuration({svg,dataset,onInspect,presentation});
  if(mode==='phases')return renderPhases({svg,dataset,phaseLeg:phaseLeg==='bear'?'bear':'bull',onInspect,presentation});
  if(mode==='periods')return renderPeriods({svg,dataset,period:period==='quarterly'?'quarterly':'monthly',metric,scope:scope==='all'?'all':'recent',onInspect,presentation});
  if(mode==='peaks')return renderPeaks({svg,dataset,onInspect,presentation});
  throw new TypeError(`Unknown observed chart mode: ${mode}`);
}
