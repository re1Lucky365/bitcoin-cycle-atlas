import { analyzeThreeYearOutlook, buildOutlookScenario } from './outlook-engine.js?v=1.10.4';
import { utcDay, dateFromDay } from './cycle-engine.js?v=1.10.4';

const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(n,d=0)=>new Intl.NumberFormat('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}).format(n);
const money=n=>`$${fmt(n)}`;
const short=d=>String(d||'').replaceAll('-','.');
const COLORS={base:'#f2aa4c','early-arrival-6':'#6cc4a8','early-arrival-9':'#75a9d8','early-turn':'#d78aab',delayed:'#aa9bd7',stress:'#e97872',custom:'#f2aa4c'};
const LABELS={base:'기준 3 / 3','early-arrival-6':'도달 6 / 형성 6','early-arrival-9':'도달 9 / 형성 9','early-turn':'이른 전환 9 / 5',delayed:'늦은 전환 3 / 6',stress:'저점 이탈',custom:'직접 설정'};
const PHASES={'observed-anchor':'마지막 관측',recovery:'회복·상승 가정','high-zone':'고점 형성 가정',decline:'하락 가정','stress-decline':'저점 이탈 가정','stress-recovery':'재축적·회복 가정',observed:'실제 관측'};
const COMMON={referenceDate:'2026-10-21',displayEnd:'2029-10-21'};
const download=(name,type,text)=>{const u=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),10000);};

export function initOutlookView(){
  let dataset=null,result=null,selected=null,visible=false,selectedId='base',custom=null,unit='indexed',settings={},chart=null,resizeTimer,frame;
  const latest=()=>result?.observables?.current ? [result.observables.current.date,result.observables.current.price] : dataset?.prices.at(-1);
  const scenario=()=>selectedId==='custom'?custom:result?.scenarios.find(s=>s.id===selectedId);
  const showError=message=>{const el=$('#outlook-error');el.textContent=message||'';el.hidden=!message;};

  function syncControls(s){
    if(!s)return;
    const p=s.parameters||{};
    const peakPrice=s.summary?.peakPrice??s.events.find(e=>e.type==='peak'||e.id==='peak')?.price;
    settings={arrivalLeadMonths:p.arrivalLeadMonths??3,dwellMonths:p.dwellMonths??3,peakMultiple:p.peakMultiple??(peakPrice/latest()[1]),bearDrawdownPct:p.bearDrawdownPct??50,kind:s.kind==='stress'?'stress':'bottom-holds'};
    if(!Number.isFinite(settings.peakMultiple))settings.peakMultiple=3;
    $('#outlook-arrival').value=settings.arrivalLeadMonths;
    $('#outlook-dwell').min=Math.max(0,settings.arrivalLeadMonths-6);
    $('#outlook-dwell').max=Math.min(12,settings.arrivalLeadMonths+6);
    $('#outlook-dwell').value=settings.dwellMonths;
    $('#outlook-multiple').min=Math.min(1.6,Math.floor(settings.peakMultiple*100)/100);
    $('#outlook-multiple').max=Math.max(8,Math.ceil(settings.peakMultiple));
    $('#outlook-multiple').value=settings.peakMultiple;
    $('#outlook-drawdown').value=settings.bearDrawdownPct;
    updateOutputs();
  }

  function updateOutputs(){
    const a=settings.arrivalLeadMonths,d=settings.dwellMonths;
    $('#outlook-arrival-value').textContent=a===0?'같은 시점':`${Math.abs(a)}개월 ${a>0?'먼저':'늦게'}`;
    $('#outlook-dwell-value').textContent=`${d}개월`;
    $('#outlook-multiple-value').textContent=`${fmt(settings.peakMultiple,2)}×`;
    $('#outlook-drawdown-value').textContent=`${settings.bearDrawdownPct}%`;
    $('#outlook-arrival').setAttribute('aria-valuetext',$('#outlook-arrival-value').textContent);
    $('#outlook-dwell').setAttribute('aria-valuetext',`${d}개월. 현재 허용 범위 ${$('#outlook-dwell').min}~${$('#outlook-dwell').max}개월`);
  }

  function choose(id){
    if(!result)return;selectedId=id;selected=scenario();if(!selected)return;
    $('#outlook-scenario').value=id;syncControls(selected);showError('');render();
  }

  function updateCustom(key,value){
    if(!dataset||!result)return;
    settings[key]=value;
    let adjustment='';
    if(key==='arrivalLeadMonths'){
      const min=Math.max(0,value-6),max=Math.min(12,value+6);
      const next=Math.max(min,Math.min(max,settings.dwellMonths));
      if(next!==settings.dwellMonths)adjustment=`큰 주기를 유지하는 ±6개월 범위에 맞춰 고점 형성 기간 D를 ${next}개월로 함께 조정했습니다.`;
      settings.dwellMonths=next;$('#outlook-dwell').min=min;$('#outlook-dwell').max=max;$('#outlook-dwell').value=next;
    }
    updateOutputs();
    cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
      try{
        custom=buildOutlookScenario(dataset,{...COMMON,...settings,id:'custom',label:settings.kind==='stress'?'직접 설정 · 저점 이탈':'직접 설정',includeValidation:false});
        selectedId='custom';selected=custom;$('#outlook-scenario').value='custom';showError(adjustment);render();
      }catch(e){showError(`이 조합을 계산할 수 없습니다: ${e.message}. 그래프는 마지막 유효 설정을 표시합니다.`);}
    });
  }

  function render(){
    if(!result||!dataset||!visible)return;
    selected=scenario();if(!selected)return;
    renderChart();renderCaption();renderEvents();renderMethod();
  }

  function renderCaption(){
    const t=selected.timing,p=selected.parameters||settings;
    const shift=Number(t.netShiftMonths??(p.dwellMonths-p.arrivalLeadMonths));
    const direction=shift===0?'명목 최고점과 같은 시점':`${Math.abs(shift)}개월 ${shift<0?'빠른':'늦은'} 전환`;
    $('#outlook-equation').innerHTML=`명목 최고점 <strong>${short(t.nominalPeakDate)}</strong> − 도달 시차 A <strong>${p.arrivalLeadMonths}개월</strong> + 고점 형성 D <strong>${p.dwellMonths}개월</strong> = <strong>${short(t.effectivePeakDate)}</strong> · ${direction}.<br><span>큰 틀을 유지하기 위해 최종 전환의 이동은 ±6개월로 제한합니다. 이 범위와 가격 배수는 조절 가능한 가정입니다.</span>`;
    $('#outlook-caption').innerHTML=`고점권 첫 도달 <strong>${short(t.zoneEntryDate)}</strong> → 고점 형성 <strong>${p.dwellMonths}개월</strong> → 최고가 후보 <strong>${short(t.effectivePeakDate)}</strong>. ${selected.kind==='stress'?'이 경로는 현재 저점이 깨지는 스트레스 가정입니다.':'현재 관측 저점이 유지되는 가정입니다.'} 작은 파동은 구간 구조를 표현한 예시이며, 음영은 가격 가정을 바꾼 범위입니다. 확률 구간이 아닙니다.`;
  }

  function renderChart(){
    if(!result||!dataset||!selected)return;
    const stage=$('#outlook-chart-stage'),svg=$('#outlook-chart'),w=Math.max(stage.clientWidth,300),h=Math.max(stage.clientHeight,300),mobile=w<600;
    const left=mobile?43:65,right=mobile?17:29,top=48,bottom=h-45,pw=w-left-right,ph=bottom-top;
    const rows=dataset.prices,cur=latest(),anchor=cur[1],asof=cur[0],end=result.displayEnd||COMMON.displayEnd;
    const start=$('#outlook-show-history').checked?'2025-06-01':asof;
    const loDay=utcDay(start),hiDay=utcDay(end),total=hiDay-loDay;
    const history=rows.filter(r=>r[0]>=start&&r[0]<=asof);
    const others=$('#outlook-compare-paths').checked?result.scenarios.filter(s=>s.id!==selected.id):[];
    const all=[...others,selected];
    const band=$('#outlook-show-band').checked;
    const val=n=>unit==='indexed'?100*n/anchor:n;
    const values=[...history.map(r=>val(r[1])),...all.flatMap(s=>s.path.filter(p=>p.date>=start&&p.date<=end).map(p=>val(p.price)))];
    if(band)for(const p of selected.path){if(p.date>=start&&p.date<=end)values.push(val(p.low??p.price),val(p.high??p.price));}
    const min=Math.max(.001,Math.min(...values)),max=Math.max(...values),span=Math.max(.5,Math.log(max/min));
    const low=Math.log(min)-span*.11,high=Math.log(max)+span*.16;
    const x=d=>left+(utcDay(d)-loDay)/total*pw,y=n=>bottom-(Math.log(val(n))-low)/(high-low)*ph;
    const sample=(path)=>path.filter((p,i)=>i%4===0||i===path.length-1||selected.events.some(e=>e.date===p.date));
    const line=path=>sample(path).filter(p=>p.date>=start&&p.date<=end).map((p,i)=>`${i?'L':'M'}${x(p.date).toFixed(2)},${y(p.price).toFixed(2)}`).join(' ');
    let out=`<title id="outlook-svg-title">비트코인 3년 조건부 전망 · ${esc(selected.label)}</title><desc>관측 종료 ${asof} UTC, 표시 종료 ${end}. 약3년 상승1년 하락의 명목 주기 아래 고점권 도달과 형성 기간을 바꾼 계산입니다. 미래 사실이나 확률 예측이 아닙니다.</desc><defs><clipPath id="outlook-clip"><rect x="${left}" y="${top}" width="${pw}" height="${ph}"/></clipPath></defs>`;
    out+=`<rect x="${left}" y="${top}" width="${pw}" height="${ph}" fill="#12161d"/>`;
    const stageSpan=(a,b,color,label)=>{const da=Math.max(loDay,utcDay(a)),db=Math.min(hiDay,utcDay(b));if(db<=da)return;const xx=left+(da-loDay)/total*pw,ww=(db-da)/total*pw;out+=`<rect x="${xx}" y="${top}" width="${ww}" height="${ph}" fill="${color}" opacity=".035"/><rect x="${xx}" y="29" width="${ww}" height="3" fill="${color}" opacity=".55"/>`;if(ww>(mobile?55:90))out+=`<text x="${xx+ww/2}" y="23" text-anchor="middle" fill="${color}" font-size="${mobile?8:9}">${label}</text>`;};
    stageSpan(asof,selected.timing.zoneEntryDate,'#6cc4a8',selected.kind==='stress'?'이탈·회복 가정':'회복·상승 가정');
    if(selected.timing.zoneEntryDate!==selected.timing.effectivePeakDate)stageSpan(selected.timing.zoneEntryDate,selected.timing.effectivePeakDate,'#f2aa4c','고점 형성');
    stageSpan(selected.timing.effectivePeakDate,selected.timing.nextLowDate,'#df899b','하락 가정');
    const ticks=[];
    for(let e=Math.floor(low/Math.LN10);e<=Math.ceil(high/Math.LN10);e++)for(const m of [1,2,5]){const v=m*10**e;if(Math.log(v)>low&&Math.log(v)<high)ticks.push(v);}
    if(ticks.length<3){const step=(high-low)/4;for(let i=1;i<4;i++)ticks.push(Math.exp(low+step*i));}
    ticks.sort((a,b)=>a-b);
    for(const v of ticks){const yy=bottom-(Math.log(v)-low)/(high-low)*ph;const label=unit==='indexed'?fmt(v,v<10?1:0):v>=1e6?`$${fmt(v/1e6,1)}m`:v>=1000?`$${fmt(v/1000)}k`:money(v);out+=`<line x1="${left}" x2="${w-right}" y1="${yy}" y2="${yy}" stroke="#252c36" stroke-width=".65"/><text x="${left-9}" y="${yy+3}" text-anchor="end" fill="#8390a2" font-size="${mobile?8:9}">${label}</text>`;}
    const years=Array.from({length:6},(_,i)=>2025+i);
    for(const year of years)for(const month of mobile?['01']:['01','07']){const date=`${year}-${month}-01`;if(date<start||date>end)continue;out+=`<line x1="${x(date)}" x2="${x(date)}" y1="${top}" y2="${bottom}" stroke="#252c36" stroke-width=".6" stroke-dasharray="2 5"/><text x="${x(date)}" y="${bottom+22}" text-anchor="middle" fill="#8390a2" font-size="${mobile?9:10}">${month==='01'?year:year+'.07'}</text>`;}
    out+='<g clip-path="url(#outlook-clip)">';
    if(band){const points=sample(selected.path).filter(p=>p.date>=start&&p.date<=end);out+=`<path d="${points.map((p,i)=>`${i?'L':'M'}${x(p.date)},${y(p.high??p.price)}`).join(' ')} ${[...points].reverse().map(p=>`L${x(p.date)},${y(p.low??p.price)}`).join(' ')} Z" fill="${COLORS[selected.id]||COLORS.custom}" opacity=".075"/>`;}
    for(const s of others)out+=`<path d="${line(s.path)}" fill="none" stroke="${COLORS[s.id]||'#778999'}" stroke-width="1.1" opacity=".38" stroke-dasharray="3 5" stroke-linejoin="round"/>`;
    out+=`<path d="${history.map((p,i)=>`${i?'L':'M'}${x(p[0])},${y(p[1])}`).join(' ')}" fill="none" stroke="#b8c1cf" stroke-width="1.7" stroke-linejoin="round"/><path d="${line(selected.path)}" fill="none" stroke="${COLORS[selected.id]||COLORS.custom}" stroke-width="2.1" stroke-dasharray="6 3" stroke-linejoin="round"/>`;
    out+='</g>';
    const now=x(asof);out+=`<line x1="${now}" x2="${now}" y1="${top-8}" y2="${bottom}" stroke="#8490a0" stroke-width=".8" stroke-dasharray="4 5"/><circle cx="${now}" cy="${y(anchor)}" r="3.5" fill="#c9d2df" stroke="#12161d" stroke-width="1.5"/><text x="${Math.min(w-right-70,Math.max(left,now+6))}" y="${top-10}" fill="#a3adbb" font-size="${mobile?8:9}">관측 종료 ${asof.slice(2).replaceAll('-','.')}</text>`;
    const nominal=selected.timing.nominalPeakDate;if(nominal>=start&&nominal<=end)out+=`<line x1="${x(nominal)}" x2="${x(nominal)}" y1="${top}" y2="${bottom}" stroke="#778191" stroke-width=".7" stroke-dasharray="2 7"/><text x="${x(nominal)-5}" y="${bottom-7}" text-anchor="end" fill="#707d90" font-size="8">명목 고점</text>`;
    const events=selected.events.filter(e=>e.id!=='horizon-end'&&e.date>asof&&e.date>=start&&e.date<=end);
    let idx=0;
    for(const e of events){if(!Number.isFinite(e.price))continue;const px=x(e.date),py=y(e.price);out+=`<circle cx="${px}" cy="${py}" r="3.4" fill="#12161d" stroke="${COLORS[selected.id]||COLORS.custom}" stroke-width="1.5"/>`;if(idx<3){const label=({'zone-entry':'고점권 도달',peak:'최고가 후보','stress-low':'저점 후보','next-low':'다음 저점'})[e.id]||e.label||e.type||e.id;const tx=Math.max(left+3,Math.min(w-right-3,px));out+=`<text x="${tx}" y="${Math.max(top+10,py-(idx%2?43:14))}" text-anchor="${px>w-160?'end':px<left+100?'start':'middle'}" fill="${COLORS[selected.id]||COLORS.custom}" font-size="${mobile?8:10}" paint-order="stroke" stroke="#12161d" stroke-width="3">${esc(label)} ${e.date.slice(2).replaceAll('-','.')}</text>`;idx++;}}
    out+=`<g id="outlook-crosshair"></g><rect id="outlook-hitarea" x="${left}" y="${top}" width="${pw}" height="${ph}" fill="transparent"/>`;
    svg.setAttribute('viewBox',`0 0 ${w} ${h}`);svg.innerHTML=out;
    $('#outlook-axis-label').textContent=`${unit==='indexed'?'현재 = 100':`USD · 현재 ${money(anchor)}`} · 로그 눈금`;
    $('#outlook-legend').innerHTML=`<span><i class="observed-line" style="--line-color:#b8c1cf"></i>실제 관측</span>`+result.scenarios.map(s=>`<button data-outlook-select="${s.id}" aria-pressed="${selectedId===s.id}"><i style="--line-color:${COLORS[s.id]}"></i>${LABELS[s.id]||esc(s.label)}</button>`).join('')+(selectedId==='custom'?'<span style="color:#f2aa4c">직접 설정</span>':'');
    chart={w,h,left,right,top,bottom,pw,loDay,hiDay,x,y,anchor,asof,end,selected};
    const hit=$('#outlook-hitarea');hit.addEventListener('pointermove',hover);hit.addEventListener('pointerdown',hover);hit.addEventListener('pointerleave',()=>{$('#outlook-tooltip').hidden=true;$('#outlook-crosshair').innerHTML='';});
  }

  function hover(event){
    if(!chart)return;const r=$('#outlook-chart').getBoundingClientRect(),c=chart,px=(event.clientX-r.left)/r.width*c.w;
    const day=Math.round(c.loDay+Math.max(0,Math.min(1,(px-c.left)/c.pw))*(c.hiDay-c.loDay));const date=dateFromDay(day);
    const observed=date<=c.asof;const raw=observed?dataset.prices.find(p=>p[0]===date):null;
    const point=observed?(raw?{date,price:raw[1],phase:'observed'}:null):c.selected.path.find(p=>p.date===date);if(!point)return;
    const xp=c.x(date),yp=c.y(point.price);$('#outlook-crosshair').innerHTML=`<line x1="${xp}" x2="${xp}" y1="${c.top}" y2="${c.bottom}" stroke="#8d98a8" stroke-width=".7" stroke-dasharray="2 4"/><circle cx="${xp}" cy="${yp}" r="3.4" fill="#f2aa4c" stroke="#12161d" stroke-width="1.5"/>`;
    const tooltip=$('#outlook-tooltip');tooltip.innerHTML=`<strong>${short(date)} · UTC</strong><div class="value">${money(point.price)} <span>· ${fmt(point.price/c.anchor*100,1)}</span></div><span>${PHASES[point.phase]||esc(point.phase)}${observed?'':' · 조건부 계산'}</span>${!observed&&point.low?`<br><span>가격 가정 범위 ${money(point.low)}–${money(point.high)}</span>`:''}`;tooltip.hidden=false;
    const localX=event.clientX-r.left,localY=event.clientY-r.top;tooltip.style.left=`${Math.max(7,Math.min(r.width-tooltip.offsetWidth-7,localX+14))}px`;tooltip.style.top=`${Math.max(36,Math.min(r.height-tooltip.offsetHeight-8,localY-55))}px`;
  }

  function renderEvents(){
    const anchor=latest()[1];
    const events=[...selected.events].sort((a,b)=>a.date.localeCompare(b.date));
    $('#outlook-events-body').innerHTML=events.map(e=>{const outside=e.inHorizon===false||e.date>(result.displayEnd||COMMON.displayEnd);return `<tr><td>${esc(e.label||e.type||e.id)}</td><td class="${outside?'outside':'event-date'}">${short(e.date)}</td><td>${Number.isFinite(e.price)?fmt(e.price/anchor*100,1):'—'}</td><td>${Number.isFinite(e.price)?money(e.price):'—'}</td><td class="${outside?'outside':''}">${e.date<=latest()[0]?'관측 기준':outside?'3년 표시 범위 밖 · 가정':'미래 가정'}</td></tr>`;}).join('');
  }

  function renderMethod(){
    const p=selected.parameters||{},v=result.validation||{};
    const rawValidation=result.historicalReconstruction?.cases||[];
    const validation=Array.isArray(rawValidation)&&rawValidation.length?`<div class="table-scroll"><table><thead><tr><th>과거 구간</th><th>명목 최고점</th><th>관측 최고점</th><th>비고</th></tr></thead><tbody>${rawValidation.map(r=>`<tr><td>${esc(r.year||r.cycle||r.peakYear||'과거 회차')}</td><td>${esc(r.nominalPeakDate||r.nominalDate||'—')}</td><td>${esc(r.actualPeak?.date||'—')}</td><td>${esc('사후 분해 · 예측 적중률 아님')}</td></tr>`).join('')}</tbody></table></div>`:'';
    $('#outlook-method-body').innerHTML=`<h3>1. 큰 주기와 실제 전환의 시계를 나눕니다</h3><p>기준은 관측된 2025년 최고점에 48개월을 더한 명목 최고점 ${short(selected.timing.nominalPeakDate)}입니다. 약 36개월 상승·12개월 하락은 이 화면의 구조적 가정입니다. 2026년 6월 말 저점 후보부터 이미 진행된 회복을 1년 내내 하락한 것으로 처리하지 않습니다.</p><div class="outlook-formula">Z = N − A<br>P = Z + D = N − A + D<br>P − N = D − A</div><p>N은 명목 최고점, Z는 고점권 첫 도달, P는 최고점 후보입니다. A는 <strong>명목 최고점으로부터 역산한 도달 시차</strong>, D는 첫 도달부터 최고점까지의 고점 형성 기간입니다. 중간 조정을 허용하며 연속으로 최고가의 95% 안에 머문다는 뜻은 아닙니다.</p><p>A = D이면 P = N, A &gt; D이면 최고점도 앞당겨지고 D &gt; A이면 늦어집니다. 이는 정의에서 따라오는 항등식입니다. 날짜 간격을 일수로 쓰면 정확한 일수 산술이며, 이 화면의 개월 슬라이더는 달력 월 좌표로 계산합니다.</p><h3>2. 기존의 ‘98일 선행’과 A는 다른 값입니다</h3><p>앞선 연구의 98일은 2021년의 같은 95% 진입 사건을 4년 옮겨 비교한 값입니다. 여기의 A는 명목 최고점에서 역산합니다. 2025년 예를 일수로 쓰면 A = 118일, D = 85일이고 최고점은 명목 기준보다 33일 빠릅니다. 과거 날짜를 역산해 이 식이 맞는 것은 예측력의 검증이 아닙니다.</p><h3>3. 가격은 별도의 가정입니다</h3><p>기본값은 직전 두 최고값 사이의 로그 상승폭을 75% 유지하는 가정이며, 배수 슬라이더로 현재 가격 대비 고점 수준을 직접 바꿀 수 있습니다. 현재 선택의 고점 배수는 ${fmt(settings.peakMultiple,2)}배, 이후 낙폭은 ${settings.bearDrawdownPct}%입니다. 이 값을 사실이나 수익률 기대값으로 해석하지 않습니다.</p><div class="outlook-formula">log B(u) = (1 − u) log S₀ + u log S₁, 0 ≤ u ≤ 1<br>W(u) = sin²(πu) · sin²(kπu)<br>S(u) = B(u) · exp(±c(u)W(u))</div><p>파동 없는 기준선 B는 양수이며 두 끝 가격 사이에 있습니다. 실제로 그린 S는 고점 형성 중 첫 도달 가격 아래로 다시 내려갈 수 있도록 예시 파동을 더합니다. W는 양 끝에서 0이고, c의 상한으로 가정한 고점을 넘지 않게 제한합니다. 이는 연결식의 성질이며 실제 일별 경로가 맞는다는 증명이 아닙니다. 음영은 선택한 고점 가격의 ±25% 가정을 연결한 범위이고, 신뢰구간이 아닙니다.</p><h3>4. 과거 분해와 예측 오차를 따로 봅니다</h3>${validation}<p>과거 두 기준시점에서 당시까지의 자료만 넣어 새 모형을 재생했습니다. 다만 모형과 시작일을 사후에 정했으므로 진정한 사전 실험은 아닙니다. ‘저점 유지’ 가정은 ${v.candidateHoldFailures??'—'} / ${v.numberOfDistinctCutoffs??'—'}개 구간에서 깨졌으며 실패 구간을 제외하지 않았습니다.</p><div class="table-scroll"><table><thead><tr><th>기간</th><th>모형 가격 MAPE</th><th>현재 가격 유지 MAPE</th><th>표본</th></tr></thead><tbody>${(v.summary||[]).map(r=>`<tr><td>${r.horizonMonths}개월</td><td>${fmt(r.scenarioMAPEPct,1)}%</td><td>${fmt(r.flatMAPEPct,1)}%</td><td>${r.numberOfCutoffs}개 기준시점</td></tr>`).join('')}</tbody></table></div><p>MAPE는 실제 가격 대비 절대 오차율의 평균으로 작을수록 좋습니다. 이 비교에서 모형은 단순 가격 유지보다 오차가 컸습니다. 로그 오차 등 다른 척도의 결과는 JSON에 함께 공개하지만, 이 모형을 검증된 가격 예측기로 제시하지 않습니다.</p><p>역사적 고점권의 시작은 이후 관측 최고값을 사용해 정한 사후 구간입니다. 2021년의 이중 고점 때문에 93%와 94% 사이에서도 진입 시점이 봄에서 가을로 바뀝니다. 수천 개의 일별 가격이 있어도 독립된 사이클 수는 적습니다.</p><p class="outlook-validation-note">계산식의 항등식, 양수성·연속성 검사와 실제 미래를 맞히는 능력은 별개입니다. 이 화면은 보장된 미래 경로나 확률 예측을 제공하지 않습니다. 일별 파동의 시점을 검증한 것이 아닙니다. 자세한 수치는 계산 결과 JSON에 함께 포함됩니다.</p><h3>5. 가정을 다시 계산해야 하는 경우</h3><ul><li>새로운 저점이 나오면 ‘현재 저점 유지’의 기준점을 다시 정해야 합니다.</li><li>새로운 최고가는 다음 상승 회차에서 예상하는 사건일 수도 있습니다. 이전 회차의 기준을 자동 폐기하지 않고, 어느 회차의 앵커가 달라졌는지 검토해야 합니다.</li><li>최종 전환이 명목 날짜의 ±6개월 범위를 벗어나면 이 화면이 유지하는 큰 주기 가정도 검토해야 합니다.</li><li>동일 규칙이 다음 회차에서 재현되지 않으면 영구적인 가속 법칙으로 확장할 수 없습니다.</li></ul><p><a href="?page=evidence">근거 자료를 읽는 순서 보기 ↗</a> · 가격 출처 <a href="https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets=btc&metrics=PriceUSD&frequency=1d&start_time=2010-07-18&end_time=2026-10-21&page_size=10000" target="_blank" rel="noopener noreferrer">Coin Metrics PriceUSD</a></p>`;
  }

  function exportSvg(){
    if(!chart||!selected)return;const clone=$('#outlook-chart').cloneNode(true);clone.querySelector('#outlook-hitarea')?.remove();clone.querySelector('#outlook-crosshair')?.remove();
    const w=Math.max(1100,chart.w),scale=w/chart.w,h=chart.h*scale,total=h+170;
    const source=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${total}" viewBox="0 0 ${w} ${total}" font-family="Arial,Noto Sans KR,sans-serif"><rect width="100%" height="100%" fill="#12161d"/><text x="30" y="35" fill="#f2f4f7" font-size="21">비트코인 · 앞으로의 3년</text><text x="30" y="60" fill="#8e98a8" font-size="12">${esc(selected.label)} · 관측 ${latest()[0]} UTC · 미래 2026.10.21–2029.10.21 · ${unit==='indexed'?'현재=100':'USD'}</text><g transform="translate(0 78) scale(${scale})">${clone.innerHTML}</g><text x="30" y="${h+111}" fill="#b1b9c6" font-size="11">도달 시차 ${selected.parameters.arrivalLeadMonths}개월 / 고점 형성 ${selected.parameters.dwellMonths}개월 · 최고점 후보 ${selected.timing.effectivePeakDate}</text><text x="30" y="${h+134}" fill="#8e98a8" font-size="10">점선은 가정에 따른 계산. 음영은 가격 가정 민감도이며 확률 구간이 아닙니다. 내부 파동은 예시입니다.</text><text x="30" y="${h+154}" fill="#8e98a8" font-size="10">Data © Coin Metrics · CC BY-NC 4.0 · 3년 상승/1년 하락은 모델의 명목 구조입니다.</text></svg>`;
    download('Bitcoin_Three_Year_Outlook.svg','image/svg+xml;charset=utf-8',source);
  }

  $('#outlook-scenario').addEventListener('change',e=>choose(e.target.value));
  $('#outlook-unit').addEventListener('change',e=>{unit=e.target.value;renderChart();});
  for(const id of ['outlook-compare-paths','outlook-show-history','outlook-show-band'])$('#'+id).addEventListener('change',renderChart);
  $('#outlook-legend').addEventListener('click',e=>{const b=e.target.closest('[data-outlook-select]');if(b)choose(b.dataset.outlookSelect);});
  for(const [id,key] of [['arrival','arrivalLeadMonths'],['dwell','dwellMonths'],['multiple','peakMultiple'],['drawdown','bearDrawdownPct']])$('#outlook-'+id).addEventListener('input',e=>updateCustom(key,Number(e.target.value)));
  $('#outlook-reset').addEventListener('click',()=>choose('base'));
  $('#outlook-export-svg').addEventListener('click',exportSvg);
  $('#outlook-export-json').addEventListener('click',()=>{if(result)download('Bitcoin_Three_Year_Calculations.json','application/json',JSON.stringify({...result,selectedScenario:selected,display:{unit,comparePaths:$('#outlook-compare-paths').checked,showHistory:$('#outlook-show-history').checked}},null,2));});
  new ResizeObserver(()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(visible&&result)renderChart();},100);}).observe($('#outlook-chart-stage'));
  return {
    setDataset(next){if(next===dataset)return;dataset=next;try{result=analyzeThreeYearOutlook(dataset,COMMON);selectedId='base';selected=scenario();syncControls(selected);showError('');render();}catch(e){showError(`3년 전망을 계산하지 못했습니다: ${e.message}`);}},
    show(value){visible=value;if(value)requestAnimationFrame(render);}
  };
}
