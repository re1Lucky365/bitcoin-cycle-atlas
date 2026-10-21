const $ = selector => document.querySelector(selector);
const num = (value, decimals = Number.isInteger(value) ? 0 : 1) => value == null ? '—' : new Intl.NumberFormat('en-US', { maximumFractionDigits: decimals, minimumFractionDigits: decimals }).format(value);
const date = value => value ? value.replaceAll('-', '.') : '아직 미확인';
const price = value => value == null ? '—' : `$${num(value, 2)}`;
const lead = value => value == null ? '아직 비교 불가' : value === 0 ? '같은 시기' : `${num(Math.abs(value))}일 ${value > 0 ? '빠름' : '늦음'}`;
const month = value => value == null ? '—' : num(Math.abs(value) / (365.2425 / 12), 1);
const baselineLabels = { recent2: '2016·2020 두 사이클', previous: '2020 사이클', all3: '2012·2016·2020 세 사이클' };

export function renderTimingView(a, baseline) {
  const c = a.current, b = a.baselines[baseline], m = b.metrics;
  const low = c.troughCandidate, up = c.confirmations.gmaUp, rebound = c.confirmations.reboundUp;
  const label = baselineLabels[baseline];
  $('#timing-baseline').value = baseline;
  const direction = m.trough.leadDays >= 0 ? '앞섰습니다' : '늦었습니다';
  $('#timing-verdict').innerHTML = low ? `<h3>저점 후보는 <em>${num(Math.abs(m.trough.leadDays))}일 ${direction}</em><span class="provisional-badge">최종 저점 미확정</span></h3><p>${label}의 반감기 이후 저점 위치 중앙값 D+${num(m.trough.medianDays)}와 이번 값 D+${num(m.trough.currentDays)}을 비교한 결과입니다. ${up ? `200일 추세선 위에서 14일을 유지한 <strong>상승 조건 확인은 ${lead(m.gmaUp.leadDays)}</strong>입니다.` : '아직 저점 후보 이후 상승 조건이 확인되지 않았습니다.'} 관측 고점의 차이는 ${lead(m.peak.leadDays)}으로, 전 구간이 같은 속도로 당겨진 것은 아닙니다.</p>` : '<h3>고점 이후 저점이 아직 관측되지 않았습니다</h3><p>최신 고점 뒤에 더 낮은 일말 가격이 관측되면 저점 후보와 기간 비교를 계산합니다. 새 고점 자체를 저점으로 간주하지 않습니다.</p>';
  $('#timing-turns').innerHTML = `<div><span>현재까지 저점 후보</span><strong>${low ? date(low?.date) : '고점 이후 미관측'}</strong><small>${low ? `UTC 일말 ${price(low?.price)}` : '저점 시기 · 하락 기간 산출 대기'}</small></div><div><span>추세선 상향 구간 시작</span><strong>${date(up?.eventDate)}</strong><small>이날만으로 14일 지속을 알 수 없음</small></div><div><span>14일 지속 확인일</span><strong>${date(up?.confirmationDate)}</strong><small>${up ? `저점 후보 이후 ${num(up.daysAfterTrough)}일` : '미래 날짜를 추정하지 않음'}</small></div>`;
  const events = [
    ['관측 고점', c.peak.date, 'peak', '현재 시장의 최종 고점은 미확정'],
    ['하락 조건 확인', c.confirmations.gmaDown?.confirmationDate, 'gmaDown', '200일 기하평균 아래 14일 지속'],
    ['저점 후보', low?.date, 'trough', low ? '이후 더 낮은 가격이 나오면 변경' : '고점 이후 낮은 가격이 아직 없음'],
    ['상승 조건 확인', up?.confirmationDate, 'gmaUp', '200일 기하평균 위 14일 지속'],
    ['20% 반등 확인', rebound?.confirmationDate, 'reboundUp', '관측 중인 저점 대비 20% 위 14일 지속'],
  ];
  $('#timing-body').innerHTML = events.map(([name, when, key, note]) => {
    const v = m[key];
    return `<tr><td>${name}<small>${note}</small></td><td>${date(when)}</td><td>${v.currentDays == null ? '—' : `D+${num(v.currentDays)}`}</td><td>${v.medianDays == null ? '—' : `D+${num(v.medianDays)}`}<small>${v.n}개 역사 구간</small></td><td class="${v.leadDays > 0 ? 'advance' : ''}">${lead(v.leadDays)}${v.leadDays != null && Math.abs(v.leadDays) >= 30 ? `<small>약 ${month(v.leadDays)}개월</small>` : ''}</td></tr>`;
  }).join('');
  const regimeText = c.regime.state === 'up' ? '상승' : c.regime.state === 'down' ? '하락' : '미확인';
  const latestSide = c.regime.maValue == null ? '계산 대기' : c.latestPrice > c.regime.maValue ? '위' : c.latestPrice < c.regime.maValue ? '아래' : '동일';
  const oppositePending = (c.regime.state === 'up' && latestSide === '아래') || (c.regime.state === 'down' && latestSide === '위');
  $('#timing-current').innerHTML = `<strong>마지막 확인 상태: ${regimeText}${c.regime.lastTransition ? ` · ${date(c.regime.lastTransition.confirmationDate)}` : ''}</strong>. ${date(a.asOf)} 일말 가격은 ${price(c.latestPrice)}로 200일 기하평균 ${price(c.regime.maValue)} ${latestSide}입니다.${oppositePending ? ' 현재 가격은 반대편으로 이동했지만 반대 방향의 14일 지속 조건은 아직 미확인입니다.' : ''}${low ? ` 저점 후보 이후 ${num(c.daysSinceLow)}일, 저점 대비 ${num(c.reboundPct, 2)}%입니다.` : ''} <strong>조건 충족일은 관측 가능한 날짜이고, 최종 바닥의 확정일은 아닙니다.</strong>`;

  const cal = a.advances.calendarFourYear;
  const calendar = a.scenarios.previousTroughCalendarFourYears, aligned = a.scenarios.previousTroughHalvingRelative;
  const currentInvalidated = a.falseSignals.rebound.filter(x => x.cycleYear === c.year && x.subsequentLowerLow);
  const example = currentInvalidated.at(-1);
  const counts = a.falseSignals.counts[baseline];
  const sensitivityLeads = a.sensitivity.map(x => x.halvingToUpLeadDays).filter(x => x != null);
  const sensitivityDates = a.sensitivity.map(x => x.currentConfirmationDate).filter(Boolean).sort();
  const lowDurationReduction = low && m.bear.medianDays ? (1 - m.bear.currentDays / m.bear.medianDays) * 100 : null;
  const speedRatio = m.bear.currentDays > 0 ? m.bear.medianDays / m.bear.currentDays : null;
  const upDates = a.cycles.filter(x => b.years.includes(x.year)).map(x => x.confirmations.gmaUp?.confirmationDate).filter(Boolean);
  $('#timing-details-content').innerHTML = `
    <h3>1. 반감기 이후 경과일을 동일하게 비교</h3>
    <div class="formula-block">경과일 d = 사건의 UTC 날짜 − 해당 반감기 날짜<br>앞당김 A = 선택한 과거 구간 d의 중앙값 − 이번 d<br>저점 후보: ${num(m.trough.medianDays)} − ${num(m.trough.currentDays)} = ${num(m.trough.leadDays)}일<br>상승 조건 확인: ${num(m.gmaUp.medianDays)} − ${num(m.gmaUp.currentDays)} = ${num(m.gmaUp.leadDays)}일</div>
    <p>양수는 빠름, 음수는 늦음입니다. 위 표는 모두 반감기로부터 센 날짜입니다. 표본 선택은 모든 행에 동일하게 적용되며, 차트에서 숨긴 선이나 로그·선형 눈금과 무관합니다. 과거 상승 확인일은 ${upDates.map(date).join(', ')}입니다. 개월 표시는 평균 달력월 365.2425 ÷ 12 ≈ 30.44일로 환산합니다.</p>
    <div class="table-scroll"><table><thead><tr><th>반감기</th><th>고점 · D+</th><th>저점 · D+</th><th>상승 확인 · D+</th></tr></thead><tbody>${a.cycles.map(x => `<tr><td>${x.year}${x.current ? ' · 진행 중' : ''}</td><td>${date(x.peak.date)}<br>${num(x.peak.dayAfterHalving)}일</td><td>${date(x.trough?.date)}${x.current && x.trough ? ' · 후보' : ''}<br>${num(x.trough?.dayAfterHalving)}일</td><td>${date(x.confirmations.gmaUp?.confirmationDate)}<br>${num(x.confirmations.gmaUp?.dayAfterHalving)}일</td></tr>`).join('')}</tbody></table></div>
    <h3>2. 하락 구간 자체는 얼마나 짧아졌나</h3>
    <div class="formula-block">고점→저점 기간: ${num(m.bear.currentDays)}일 / 과거 중앙값 ${num(m.bear.medianDays)}일<br>기간 단축: ${num(m.bear.leadDays)}일, 약 ${month(m.bear.leadDays)}개월<br>기간 감소율: ${num(lowDurationReduction, 1)}% · 동일 구간의 역수 기준 속도: ${num(speedRatio, 3)}배</div>
    <p>이는 현재 저점 후보가 유지된다는 조건의 기술 통계입니다. 가격의 상승 속도, 다음 고점까지의 속도, 수익률을 뜻하지 않습니다.</p>
    <h3>3. 달력 4년과 비교하면 왜 숫자가 다른가</h3>
    <p>이 계산은 직전 사건에 정확히 48개월을 더합니다. 반감기는 210,000블록마다 발생하므로 두 기준의 날짜 차이는 서로 다릅니다.</p>
    <div class="formula-block">직전 저점 ${date(cal.previousTroughDate)} + 4년 = ${date(cal.projectedTroughDate)}<br>관측 저점 후보 ${date(low?.date)}: 기준일보다 ${num(cal.troughAdvanceDays)}일 빠름<br>저점 앞당김 = 고점 앞당김 + 고점→저점 기간 단축<br>${num(cal.troughAdvanceDays)} = ${num(cal.peakAdvanceDays)} + (${num(cal.projectedBearDurationDays)} − ${num(cal.currentBearDurationDays)})</div>
    <p>위 등식은 날짜 차이의 항등식입니다. 현재 관측의 시간 차이를 정확히 분해하지만, 같은 패턴의 재발이나 최종 저점을 증명하지는 않습니다.</p>
    <div class="table-scroll"><table><thead><tr><th>가정한 기준</th><th>앞당기기 전 계산일</th><th>3~5개월 앞당긴 구간</th></tr></thead><tbody><tr><td>직전 저점의 달력 4주년</td><td>${date(calendar.referenceDate)}</td><td>${date(calendar.startDate)}–${date(calendar.endDate)}</td></tr><tr><td>직전 저점의 반감기 상대 위치</td><td>${date(aligned.referenceDate)}</td><td>${date(aligned.startDate)}–${date(aligned.endDate)}</td></tr></tbody></table></div>
    <p class="timing-note">두 구간은 가설을 점검하기 위한 달력 계산입니다. 미래 전환일의 예측 구간이나 통계적 신뢰구간이 아닙니다.</p>
    <h3>4. 전환의 발생일과 확인일을 분리</h3>
    <div class="formula-block">G₂₀₀(t) = exp[(ln Pₜ + … + ln Pₜ₋₁₉₉) ÷ 200]<br>상승 조건: 14일 연속 Pₜ &gt; G₂₀₀(t)<br>하락 조건: 14일 연속 Pₜ &lt; G₂₀₀(t)<br>반등 보조 조건: 당시까지 관측한 저점 Lₜ 대비 20% 이상을 14일 지속</div>
    <p>${up ? `${date(up.eventDate)}부터의 14일 지속을 확인할 수 있는 가장 이른 완료 일말은 ${date(up.confirmationDate)}입니다.` : '현재 후보 저점 이후의 상승 확인은 아직 없습니다.'} 일별 가격은 UTC 하루가 끝난 뒤 알 수 있으므로 확인 날짜도 그 일말 기준입니다. 예를 들어 9월 1일 관측의 확인은 9월 2일 00:00 UTC 이후에 알 수 있으며, 자료 게시가 지연될 수 있습니다. 매일의 신호 계산에는 해당 날짜까지의 값만 쓰며, 앞으로의 데이터를 추가해도 이미 발생한 신호는 바뀌지 않습니다. 다만 <strong>어느 신호를 최종 저점 이후의 신호로 골라 비교하는지는 사후 선택</strong>입니다.</p>
    <p>반등 보조 신호는 당시 최고값에서 20% 이상 하락한 상태가 14일 지속된 뒤에만 활성화합니다. 새 최고값을 관측하면 해당 하락 구간을 초기화합니다. 추세선과 반등 조건은 같은 가격에서 파생되므로 독립적인 두 증거로 세지 않습니다.</p>
    <h3>5. 조건을 바꾸면 결과가 달라지는가</h3>
    <p>${label} 대비 상승 확인의 앞당김은 아래 ${a.sensitivity.length}개 설정에서 ${sensitivityLeads.length ? `${num(Math.min(...sensitivityLeads))}–${num(Math.max(...sensitivityLeads))}일` : '계산 불가'}입니다. 이번 확인일은 ${date(sensitivityDates[0])}–${date(sensitivityDates.at(-1))}로 달라집니다. 여러 설정은 같은 시계열을 재계산한 결과이며 독립 표본이 아닙니다.</p>
    <div class="table-scroll"><table><thead><tr><th>평균 방식 · 기간</th><th>지속 요건</th><th>이번 확인일</th><th>반감기 기준 앞당김</th></tr></thead><tbody>${a.sensitivity.map(x => `<tr><td>${x.maType === 'geometric' ? '기하평균' : '산술평균'} ${x.maWindow}일</td><td>${x.persistence}일</td><td>${date(x.currentConfirmationDate)}</td><td>${lead(x.halvingToUpLeadDays)}</td></tr>`).join('')}</tbody></table></div>
    <h3>6. 최종 바닥을 증명할 수 없는 이유</h3>
    <p>오늘까지의 가격 기록이 같은 두 미래를 생각할 수 있습니다. 하나는 이후 계속 반등하고, 다른 하나는 내일 지금까지의 최저값보다 낮아집니다. 오늘의 관측만으로 두 미래를 구별할 수 없으므로, 추가 가정 없이 관측 중인 저점을 최종 저점이라고 증명할 수 없습니다.</p>
    <p>${example ? `실제로 이번 구간에서도 ${date(example.confirmationDate)}의 20% 반등 신호 뒤 ${date(example.invalidatedAt)}에 당시 저점보다 낮아졌습니다. ` : ''}${label}의 고점 이후 추세선 상승 신호 ${counts.gma.signals}회 중 ${counts.gma.subsequentLowerLows}회, 20% 반등 신호 ${counts.rebound.signals}회 중 ${counts.rebound.subsequentLowerLows}회는 다음 반감기 전에 당시 저점보다 낮은 값이 나왔습니다. 이는 최종 저점 해석의 실패 사례 수이며, 미래 성공 확률이나 독립 시행의 승률이 아닙니다.</p>
    <p>역사 고점은 2013·2017·2021년의 최고 일말값, 후속 저점은 그 고점부터 다음 반감기 전날까지의 최소값입니다. 현재 고점은 2024년 반감기 이후 현재까지 최고값, 저점 후보는 그 이후 최소값입니다. 현재 구간이 끝나지 않았으며, 새 고점·저점이 나오면 후보 날짜와 분석도 갱신됩니다.</p>
    <p class="timing-note">자료: <a href="https://github.com/coinmetrics/docs-website/blob/master/asset-metrics/market/priceusd.md" target="_blank" rel="noopener noreferrer">Coin Metrics 일말 가격 정의</a> · <a href="https://bitcoin.org/en/halving" target="_blank" rel="noopener noreferrer">반감기 연혁</a> · <a href="https://www.davidhbailey.com/dhbpapers/backtest-prob.pdf" target="_blank" rel="noopener noreferrer">반복 설정 선택과 과최적화</a>. 분석은 ${date(a.asOf)}까지의 관측에 한정합니다.</p>`;
}
