import { buildCryptoConAudit, CRYPTOCON_AUDIT_SOURCE } from './cryptocon-audit-data.js?v=1.10.0';
import { utcDay } from './cycle-engine.js?v=1.10.0';

const selections=new WeakMap(),cache=new WeakMap();
const INK='#e1e8f0',MUTED='#aab7c8',GRID='#2a3442',GOLD='#edb66b',BLUE='#82b9dc',PURPLE='#baace3';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=(value,digits=0)=>new Intl.NumberFormat('en-US',{maximumFractionDigits:digits}).format(value);
const usd=value=>`$${number(value)}`;
const date=value=>value.replaceAll('-','.');
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
const signed=value=>`${value<0?'−':value>0?'+':''}${number(Math.abs(value),2)}%`;

function geometry(svg){
  const W=Math.max(1,Math.round(svg.clientWidth||svg.parentElement?.clientWidth||1000));
  const H=Math.max(1,Math.round(svg.clientHeight||svg.parentElement?.clientHeight||400));
  return {W,H,small:W<620,short:H<290,L:W<620?67:121,R:W<620?20:35,T:H<290?32:44,B:H-(H<290?51:60)};
}

function sources(claim){
  const list=[{title:claim.title,url:claim.url}];
  if(claim.supportingUrl)list.push({title:'날짜와 원문을 확인할 수 있는 재현',url:claim.supportingUrl});
  list.push(CRYPTOCON_AUDIT_SOURCE);
  return list;
}

const VIEWS={
  timing:{title:'CryptoCon · 예측 창과 실제 고점',caption:'2025년 날짜 · 발행 시점 보존',note:'원래 좁은 창, 별개의 사전 전망, 고점 이후의 설명을 나눠 봅니다. 같은 모델의 반복 게시물을 독립된 예측으로 세지 않습니다. X 일부는 색인과 날짜 있는 재현만 확인했습니다.',legend:[{label:'실제 고점 10/6',color:INK},{label:'95% 첫 진입 7/13',color:BLUE},{label:'그때 제시한 날짜 창',color:PURPLE},{label:'사후 설명',color:MUTED,dashed:true}]},
  thresholds:{title:'고점권을 언제 처음 방문했나',caption:'2025년 최종 고점 기준 · 사후 측정',note:'최종 고점의 95%에 먼저 도달한 것과, 이후 내내 그 수준에서 횡보한 것은 다릅니다. 최종 최고가를 알고 정한 기준이라 실시간 선행 신호나 미래의 일정한 가속률을 증명하지 않습니다.',legend:[{label:'첫 진입 → 최종 고점까지',color:BLUE}]},
  targets:{title:'CryptoCon · 목표 가격과 관측 결과',caption:'USD · UTC 일말 최고값 비교',note:'표시한 목표와 실제 일말 가격을 동일한 기준으로 비교합니다. 장중 최고가나 자기보고 체결가는 검증하지 않습니다. 시한이 없는 주장은 시한 실패로 채점하지 않습니다.',legend:[{label:'관측 창의 최고 일말 가격',color:BLUE},{label:'공개된 목표',color:GOLD}]}
};

export function renderCryptoConAudit({svg,dataset,onInspect=()=>{},view='timing'}){
  if(!VIEWS[view])view='timing';
  if(!cache.has(dataset))cache.set(dataset,buildCryptoConAudit(dataset));
  const audit=cache.get(dataset),g=geometry(svg),definition=VIEWS[view],rows=view==='timing'?audit.timing:view==='thresholds'?audit.thresholds:audit.targets;
  const saved=selections.get(svg),key=`cryptocon:${view}`;
  let selected=clamp(saved?.key===key?saved.index:view==='thresholds'?1:view==='timing'?1:0,0,rows.length-1),initialInspection;
  const rowHeight=(g.B-g.T)/rows.length;
  const yy=index=>g.T+(index+.5)*rowHeight;
  const text=(x,y,value,{color=MUTED,size=g.small?10:12,anchor='start',weight=400}={})=>`<text x="${x}" y="${y}" fill="${color}" font-size="${size}" text-anchor="${anchor}" font-weight="${weight}">${esc(value)}</text>`;
  function inspect(){
    const row=rows[selected];
    if(view==='timing')return {label:`${row.title} · ${date(row.published)} 발행`,date:audit.peak.date,kind:row.kind==='retrospective'?'observed':'assumption',
      fields:[{label:'그때 제시한 날짜 창',value:`${date(row.start)}–${date(row.end)}`},{label:'비교 결과',value:row.assessment},{label:'2025년 종가 최고',value:`${date(audit.peak.date)} · ${usd(audit.peak.price)}`},{label:row.center?'원래 중심일보다':'창 시작일과의 차이',value:row.center?`${Math.abs(row.daysFromCenter)}일 ${row.daysFromCenter<0?'빠름':'늦음'}`:`${Math.abs(row.daysFromWindowStart)}일 ${row.daysFromWindowStart<0?'빠름':'뒤'}`},{label:'근거 접근 수준',value:row.evidence}],note:row.note,sources:sources(row)};
    if(view==='thresholds')return {label:`최종 최고가의 ${number(row.ratio*100)}% 첫 진입`,date:row.firstDate,kind:'observed',
      fields:[{label:'처음 도달한 날',value:date(row.firstDate)},{label:'최고값까지 선행',value:`${row.leadDays}일`},{label:'그 뒤 기준 이상인 관측',value:`${row.aboveDays} / ${row.windowDays}일`},{label:'그 구간의 최대 낙폭',value:signed(row.maxDrawdownPct)},{label:'최종 종가 최고',value:`${date(row.peakDate)} · ${usd(row.peakPrice)}`},{label:'고점권 가격 기준',value:usd(row.peakPrice*row.ratio)}],note:'T(q) = 처음으로 P(t) ≥ q × 최종 최고가인 날짜. 선행일 = 최고가 날짜 − T(q). 체류일은 첫 진입일부터 최고일까지 세며, 그 기간 계속 고점권에 머물렀다는 뜻은 아닙니다.',sources:[CRYPTOCON_AUDIT_SOURCE]};
    return {label:`${row.title} · ${date(row.published)} 공개`,date:row.observedPeak?.date,kind:'observed',
      fields:[{label:'공개된 목표 가격',value:usd(row.target)},{label:'관측 창의 최고 일말',value:row.observedPeak?`${usd(row.observedPeak.price)} · ${date(row.observedPeak.date)}`:'관측 없음'},{label:'목표 대비 최고값 차이',value:row.gapPct===null?'—':signed(row.gapPct)},{label:'채점·비교 상태',value:row.assessment},{label:'실제 비교한 관측 창',value:`${date(row.observationStart)}–${date(row.observedThrough)}`},{label:'근거 접근 수준',value:row.evidence}],note:row.note,sources:sources(row)};
  }
  function background(){
    svg.setAttribute('viewBox',`0 0 ${g.W} ${g.H}`);svg.setAttribute('role','img');svg.setAttribute('tabindex','0');svg.setAttribute('aria-label',`${definition.title}. 그래프를 누르거나 좌우 키로 각 항목을 확인하세요.`);
    let out=`<title>${esc(definition.title)}</title><desc>${esc(definition.note)}</desc>`;
    out+=`<rect x="4" y="${g.T+selected*rowHeight}" width="${g.W-8}" height="${Math.max(1,rowHeight-1)}" rx="4" fill="#bbcee8" opacity=".065"/>`;
    return out;
  }
  function drawTiming(){
    const min=utcDay('2025-01-01'),max=utcDay('2025-12-31'),x=value=>g.L+(utcDay(value)-min)/(max-min)*(g.W-g.L-g.R);
    let out=background();
    const months=g.small?[1,4,7,10,12]:[1,3,5,7,9,11,12];
    for(const month of months){const value=`2025-${String(month).padStart(2,'0')}-01`,xx=x(value);out+=`<line x1="${xx}" x2="${xx}" y1="${g.T}" y2="${g.B}" stroke="${GRID}"/>`+text(xx,g.H-34,`${month}월`,{anchor:'middle'});}
    rows.forEach((row,index)=>{
      const y=yy(index),h=Math.max(8,Math.min(g.short?12:24,rowHeight*.4)),color=row.kind==='retrospective'?MUTED:row.kind==='alternative'?GOLD:PURPLE;
      out+=text(g.L-8,y+4,row.shortLabel,{anchor:'end',color:INK});
      out+=`<rect x="${x(row.start)}" y="${y-h/2}" width="${Math.max(2,x(row.end)-x(row.start))}" height="${h}" rx="2" fill="${color}" fill-opacity="${row.kind==='retrospective'?'.1':'.46'}" stroke="${color}"${row.kind==='retrospective'?' stroke-dasharray="4 3"':''}/>`;
      if(row.center)out+=`<line x1="${x(row.center)}" x2="${x(row.center)}" y1="${y-h/2-3}" y2="${y+h/2+3}" stroke="${color}" stroke-width="2"/>`;
      if(!g.short)out+=text(g.L-8,y+20,row.kind==='retrospective'?'사후 설명':row.kind==='alternative'?'조건부 대안':'사전 전망',{anchor:'end',size:10});
    });
    for(const [value,color,label] of [[audit.thresholds[1].firstDate,BLUE,'7/13'],[audit.peak.date,INK,'10/6']]){const xx=x(value);out+=`<line x1="${xx}" x2="${xx}" y1="${g.T-8}" y2="${g.B}" stroke="${color}" stroke-width="1.4" stroke-dasharray="3 3"/>`+text(xx,g.T-14,label,{anchor:'middle',color,size:10});}
    return out;
  }
  function drawThresholds(){
    const left=g.small?47:82,right=g.small?36:55,max=100,x=value=>left+value/max*(g.W-left-right);
    let out=background();
    for(const n of [0,25,50,75,100]){const xx=x(n);out+=`<line x1="${xx}" x2="${xx}" y1="${g.T}" y2="${g.B}" stroke="${GRID}"/>`+text(xx,g.H-34,`${n}`,{anchor:'middle',size:10});}
    out+=text(g.W-4,15,'선행일',{anchor:'end',size:10});
    rows.forEach((row,index)=>{const y=yy(index),h=Math.max(8,Math.min(g.short?13:22,rowHeight*.44));out+=text(left-9,y+4,`${number(row.ratio*100)}%`,{anchor:'end',color:INK});
      out+=row.leadDays?`<rect x="${left}" y="${y-h/2}" width="${x(row.leadDays)-left}" height="${h}" rx="2" fill="${BLUE}" fill-opacity="${index===selected?'.95':'.55'}"/>`:`<circle cx="${left}" cy="${y}" r="3" fill="${BLUE}"/>`;
      out+=text(x(row.leadDays)+7,y+4,`${row.leadDays}일`,{color:INK,size:11});
      if(!g.short)out+=text(left,y+h/2+14,`${date(row.firstDate)} · ${row.aboveDays}/${row.windowDays}일 체류`,{size:10});
    });return out;
  }
  function drawTargets(){
    const left=g.small?64:110,right=g.small?23:35,max=180000,x=value=>left+value/max*(g.W-left-right);
    let out=background();
    for(const n of [0,50000,100000,150000]){const xx=x(n);out+=`<line x1="${xx}" x2="${xx}" y1="${g.T}" y2="${g.B}" stroke="${GRID}"/>`+text(xx,g.H-34,`${n/1000}k`,{anchor:'middle',size:10});}
    out+=text(g.W-5,15,'USD',{anchor:'end',size:10});
    rows.forEach((row,index)=>{const y=yy(index),h=Math.max(9,Math.min(g.short?16:25,rowHeight*.32));out+=text(left-8,y+4,row.shortLabel,{anchor:'end',color:INK,size:g.small?9:12});
      out+=`<rect x="${left}" y="${y-h/2}" width="${Math.max(0,x(row.observedPeak?.price||0)-left)}" height="${h}" rx="2" fill="${BLUE}" fill-opacity="${index===selected?'.9':'.5'}"/>`;
      out+=`<line x1="${x(row.target)}" x2="${x(row.target)}" y1="${y-h/2-5}" y2="${y+h/2+5}" stroke="${GOLD}" stroke-width="2"/>`;
      out+=text(x(row.target),y-h/2-8,`${number(row.target/1000,row.target%1000?1:0)}k`,{anchor:'middle',color:GOLD,size:10});
      if(!g.short)out+=text(left,y+h/2+16,row.deadline?'9월 말 시한':row.id==='cycle-130k'?'2025년 고점 비교':'시한 없음',{size:10});
    });return out;
  }
  function draw({user=false,origin='render'}={}){
    svg.innerHTML=view==='timing'?drawTiming():view==='thresholds'?drawThresholds():drawTargets();
    selections.set(svg,{key,index:selected});initialInspection=inspect();onInspect(initialInspection,{user,origin,openPanel:false});
  }
  function select(index,origin='navigation'){selected=clamp(Math.round(index),0,rows.length-1);draw({user:true,origin});}
  svg.onpointermove=null;svg.onpointerleave=null;svg.onblur=null;svg.onpointerdown=null;
  svg.onclick=event=>{const rect=svg.getBoundingClientRect(),scale=Math.min(rect.width/g.W,rect.height/g.H),y=(event.clientY-rect.top-(rect.height-g.H*scale)/2)/scale;select(Math.floor((y-g.T)/rowHeight),'pointer');};
  svg.onkeydown=event=>{if(event.shiftKey||event.altKey||event.ctrlKey||event.metaKey||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','Enter',' '].includes(event.key))return;event.preventDefault();select(['Enter',' '].includes(event.key)?selected:event.key==='Home'?0:event.key==='End'?rows.length-1:selected+(['ArrowRight','ArrowDown'].includes(event.key)?1:-1),'keyboard');};
  draw();
  return {...definition,initialInspection,previous(){select(selected-1);},next(){select(selected+1);},hasPrevious(){return selected>0;},hasNext(){return selected<rows.length-1;},selectDate(value){const day=utcDay(value);select(rows.reduce((best,row,index)=>Math.abs(utcDay(row.firstDate||row.published)-day)<Math.abs(utcDay(rows[best].firstDate||rows[best].published)-day)?index:best,0),'date');}};
}
