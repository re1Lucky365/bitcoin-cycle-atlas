import { utcDay } from './cycle-engine.js?v=1.10.3';

const $ = selector => document.querySelector(selector);
const fmt = (value, digits = 1) => value == null ? '—' : new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value);
const date = value => value ? value.replaceAll('-', '.') : '미확인';
const money = value => value == null ? '—' : '$' + fmt(value, 2);
const lead = value => value == null ? '비교 불가' : fmt(Math.abs(value)) + '일 ' + (value >= 0 ? '빠름' : '늦음');
const colors = {2012:'#a594df',2016:'#6a9fd4',2020:'#5fb8a4',2024:'#f2aa4c'};
const years = {recent2:[2016,2020], previous:[2020], all3:[2012,2016,2020]};
const labels = {recent2:'최근 두 사이클', previous:'직전 사이클', all3:'과거 세 사이클'};

export function renderPeakView(a, dataset, timing) {
  const c = a.current, q = Math.round(a.threshold * 100), comp = a.comparison.firstEntry;
  $('#peak-threshold').value = String(a.threshold);
  $('#peak-baseline').value = a.baseline;
  const calendarLead = a.calendarFourYear.firstEntryAdvanceDays;
  $('#peak-headline').innerHTML = `${q}% 고점권 진입, 달력 4년 대비 <em>${lead(calendarLead)}</em>`;
  $('#peak-summary').innerHTML = `${date(c.firstEntry?.date)}에 관측 최고값의 ${q}%에 처음 도달했습니다. ${labels[a.baseline]}의 같은 기준과 반감기 이후 경과일을 비교하면 <strong>${lead(comp.leadDays)}</strong>입니다. 최고값을 찍은 날과 고점권에 도착한 날은 다른 사건이며, 이 계산에는 나중에 관측된 최고값이 사용됩니다.`;
  const july = a.july2025;
  $('#peak-metrics').innerHTML = `<div><span>2025년 7월 최고 일말값</span><strong>${money(july?.price)}</strong><small>${date(july?.date)} · 관측 최고값의 ${fmt(july?.pctOfPeak, 2)}%</small></div><div><span>7월 최고값에서 남은 상승</span><strong>+${fmt(july?.remainingUpsidePct, 2)}%</strong><small>${date(c.peak.date)} 최고값까지</small></div><div><span>선택한 고점권 → 최고값</span><strong>${fmt(c.firstEntry?.daysBeforePeak, 0)}일</strong><small>${date(c.firstEntry?.date)} → ${date(c.peak.date)}</small></div>`;
  const z = c.zoneStats;
  $('#peak-chart-threshold').textContent = `${q}% 고점권 · 최초 진입 ●`;
  $('#peak-chart-note').innerHTML = `첫 진입 이후 최고값까지 ${fmt(z.observations, 0)}개 일말 관측 중 ${q}% 이상은 <strong>${fmt(z.aboveThresholdDays, 0)}일 (${fmt(z.occupancyPct)}%)</strong>입니다. 그 사이 최대 낙폭은 <strong>${fmt(z.maxDrawdownPct, 2)}%</strong>였습니다. ‘고점권에 일찍 도착했다’와 ‘계속 좁은 범위에 머물렀다’는 각각 확인해야 합니다.`;
  const selected = years[a.baseline];
  $('#peak-table-body').innerHTML = a.cycles.map(cycle => `<tr class="${cycle.current?'current-row':''}"><td>${cycle.peakYear}${cycle.current?' · 현재':''}<small>${cycle.current?'진행 중':selected.includes(cycle.year)?'비교 표본':'참고 구간'}</small></td><td>${date(cycle.firstEntry?.date)}</td><td>D+${fmt(cycle.firstEntry?.dayAfterHalving, 0)}</td><td>${fmt(cycle.firstEntry?.daysBeforePeak, 0)}일<small>최고값 ${date(cycle.peak.date)}</small></td><td>${cycle.sustained5of7?date(cycle.sustained5of7.confirmationDate):'최고가일까지 미충족'}</td></tr>`).join('');
  const spring = a.spring2021;
  const down = timing?.current?.confirmations?.gmaDown;
  $('#peak-method').innerHTML = `
    <h3>같은 사건을 같은 기준으로 비교</h3>
    <div class="formula-block">Qᵢ = 해당 구간 관측 최고 일말 가격<br>Zᵢ(q) = min {t ≥ 반감기ᵢ : Pₜ ≥ q × Qᵢ}<br>A(q) = 과거 [Zᵢ(q) − 반감기ᵢ]의 중앙값 − 현재 경과일<br>현재 q = ${fmt(a.threshold, 2)} : ${fmt(comp.medianDays)} − ${fmt(comp.currentDays)} = ${fmt(comp.leadDays)}일</div>
    <p>직전의 같은 고점권 진입일에 48개월을 더한 기준은 ${date(a.calendarFourYear.firstEntryReferenceDate)}입니다. 이번 진입은 ${lead(calendarLead)}입니다. 반감기 날짜 자체가 달라 두 시계의 결과도 달라집니다. 실제 최고값의 달력 4년 기준은 ${date(a.calendarFourYear.absolutePeakReferenceDate)}, 차이는 ${lead(a.calendarFourYear.absolutePeakAdvanceDays)}입니다.</p>
    <h3>2021년 봄 고점이 만드는 민감도</h3>
    <p>2021년 봄의 최고 일말값은 ${date(spring?.date)}의 ${money(spring?.price)}로 그해 최종 최고값의 <strong>${fmt(spring?.pctOfPeak, 4)}%</strong>였습니다. 따라서 93% 기준에서는 봄 진입이 포함되지만 94%부터 제외됩니다. 한 임계값의 결과를 사이클 전체의 일정한 가속 법칙으로 해석할 수 없습니다.</p>
    <div class="table-scroll"><table><thead><tr><th>고점권 기준</th><th>이번 첫 진입</th><th>반감기 기준 앞당김</th><th>직전 달력 4년 기준</th></tr></thead><tbody>${a.sensitivity.map(row=>`<tr><td>${fmt(row.threshold*100,0)}%</td><td>${date(row.currentDate)}</td><td>${lead(row.leadDays)}</td><td>${lead(row.calendarLeadDays)}</td></tr>`).join('')}</tbody></table></div>
    <h3>‘횡보’는 체류 시간과 변동 폭으로 분해</h3>
    <p>${q}% 고점권에 한 번이라도 들어온 날과 7일 중 5일 이상 그 위에 머문 것을 확인한 날은 다릅니다. 이번 지속 조건 확인일은 ${date(c.sustained5of7?.confirmationDate)}입니다. 첫 진입부터 최고값까지 ${q}% 아래로 연속 이탈한 최장 기간은 ${fmt(z.longestBelowRunDays,0)}일입니다. 고점 전 90일 수익률은 ${fmt(c.prePeak90Days.returnPct,2)}%, 일별 로그수익률의 연율 변동성은 ${fmt(c.prePeak90Days.annualizedVolatilityPct,2)}%입니다.</p>
    <p>연율 변동성은 일별 로그수익률의 표본 표준편차 × √365로 계산합니다. 체류율과 낙폭은 사후 구간의 특성이며 매수·매도 성공 확률이 아닙니다.</p>
    <h3>고점 후보와 하락 확인일</h3>
    <p>현재 관측 고점은 ${date(c.peak.date)}의 ${money(c.peak.price)}입니다. ${down?`200일 기하평균 아래 14일 지속의 하락 조건은 ${date(down.confirmationDate)}에 확인되었습니다.`:''} 고점에서 후속 저점 후보까지 ${fmt(c.daysPeakToLow,0)}일, 최고값을 회복하지 못한 채 지난 기간은 ${fmt(c.peakAgeDays,0)}일입니다. 두 기간은 같은 하락 기간이 아닙니다.</p>
    <p>현재 고점 대비 ${fmt(c.currentDrawdownPct,2)}%, 고점까지 필요한 회복은 +${fmt(c.recoveryToPeakPct,2)}%입니다. 전고점 재접근을 관찰할 가격은 90% ${money(c.peak.price*.9)}, 95% ${money(c.peak.price*.95)}, 최고값 ${money(c.peak.price)}입니다. 이 가격은 사후 기준선이며 미래의 매물대나 저항 확률을 추정한 값은 아닙니다.</p>
    <h3>수학적으로 확인한 범위</h3>
    <p>위 날짜 차이와 비율은 원자료로 다시 계산할 수 있습니다. 그러나 오늘까지 기록이 같은 두 미래 중 하나에는 더 높은 고점이, 다른 하나에는 더 낮은 저점이 생길 수 있습니다. 유한한 관측만으로 최종 고점·저점이나 미래의 특정 날짜를 증명할 수는 없습니다. 고점권 정의에 쓰인 최종 관측 최고값은 최초 진입 당시 알려져 있지 않았습니다.</p>
    <p class="timing-note">자료: <a href="https://gitbook-docs.coinmetrics.io/network-data/network-data-overview/market/price" target="_blank" rel="noopener noreferrer">Coin Metrics PriceUSD</a> · <a href="https://bitcoin.org/en/halving" target="_blank" rel="noopener noreferrer">반감기 날짜</a>. ${date(a.asOf)} UTC 일말까지 직접 계산.</p>`;
  renderPeakChart(a, dataset);
}

function renderPeakChart(a, dataset) {
  const stage=$('#peak-chart-stage'),svg=$('#peak-chart');
  const width=Math.max(stage.clientWidth,320),height=stage.clientHeight||310,mobile=width<600;
  const left=mobile?43:61,right=mobile?17:30,top=25,bottom=height-34;
  const visible=a.cycles.filter(c=>c.current||years[a.baseline].includes(c.year));
  const start=200,end=Math.ceil(Math.max(560,...visible.map(c=>c.peak.dayAfterHalving||utcDay(c.peak.date)-utcDay(c.halvingDate)))/50)*50;
  const x=d=>left+(d-start)/(end-start)*(width-left-right),y=v=>bottom-v/110*(bottom-top);
  const q=a.threshold*100;
  const path = rows => rows.map((p,i)=>(i?'L':'M')+x(p.day).toFixed(2)+','+y(p.ratio).toFixed(2)).join(' ');
  let html=`<title>최고값의 ${q}%에 도달한 시점 비교</title><desc>각 사이클의 관측 최고값을 100%로 정규화하고 반감기 이후 같은 경과일을 비교합니다. 마지막 최고값을 이용한 사후 분석입니다.</desc><defs><clipPath id="peak-clip"><rect x="${left}" y="${top}" width="${width-left-right}" height="${bottom-top}"/></clipPath></defs>`;
  html+=`<rect x="${left}" y="${y(100)}" width="${width-left-right}" height="${y(q)-y(100)}" fill="#f2aa4c" opacity=".09"/>`;
  for(const v of [0,25,50,75,100])html+=`<line x1="${left}" x2="${width-right}" y1="${y(v)}" y2="${y(v)}" stroke="#252d39"/><text x="${left-9}" y="${y(v)+3}" fill="#8e98a8" text-anchor="end" font-size="9">${v}%</text>`;
  for(let day=start;day<=end;day+=100)html+=`<line x1="${x(day)}" x2="${x(day)}" y1="${top}" y2="${bottom}" stroke="#252d39" stroke-dasharray="2 5"/><text x="${x(day)}" y="${bottom+21}" fill="#8e98a8" text-anchor="middle" font-size="9">D+${day}</text>`;
  html+=`<line x1="${left}" x2="${width-right}" y1="${y(q)}" y2="${y(q)}" stroke="#f2aa4c" stroke-opacity=".6" stroke-dasharray="4 4"/><text x="${left+8}" y="${y(q)+15}" fill="#d5a46a" font-size="9">고점권 ${q}%</text>`;
  html+='<g clip-path="url(#peak-clip)">';
  visible.forEach(c=>{
    const h=utcDay(c.halvingDate),series=dataset.prices.filter(r=>utcDay(r[0])-h>=start&&r[0]<=c.peak.date&&r[0]>=c.halvingDate).map(r=>({day:utcDay(r[0])-h,ratio:r[1]/c.peak.price*100}));
    const color=colors[c.year]||'#f2aa4c';
    html+=`<path d="${path(series)}" stroke="${color}" stroke-width="${c.current?2.2:1.3}" fill="none" opacity="${c.current?1:.8}"/>`;
    const e=c.firstEntry;
    if(e)html+=`<circle cx="${x(e.dayAfterHalving)}" cy="${y(e.price/c.peak.price*100)}" r="${c.current?4.6:3.7}" fill="${color}" stroke="#12161d" stroke-width="1.5"><title>${c.peakYear}: ${e.date} · D+${e.dayAfterHalving} · ${money(e.price)}</title></circle>`;
  });
  html+='</g>';
  svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.innerHTML=html;
  $('#peak-legend').innerHTML=visible.map(c=>`<span style="--legend-color:${colors[c.year]||'#f2aa4c'}"><i></i>${c.peakYear} 고점${c.current?' · 현재':''}</span>`).join('');
}
