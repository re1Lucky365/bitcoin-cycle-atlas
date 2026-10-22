import { LONG_HORIZON_CLAIMS } from './long-horizon-evidence.js?v=1.10.0';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const number = (value, digits = 0) => Number.isFinite(value) ? new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value) : '—';
const usd = value => Number.isFinite(value) ? `$${number(value)}` : '—';
const percent = (value, digits = 1) => `${number(value, digits)}%`;
const link = (url, label) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`;
const report = 'https://github.com/twoimo/bitcoin-cycle-atlas/blob/main/docs/LONG_HORIZON_RESEARCH.md';
function table(headers, rows) {
  return `<div class="lab-table-scroll"><table class="lab-table"><thead><tr>${headers.map(value => `<th scope="col">${esc(value)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(value => `<td>${esc(value)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

// The reader uses this pure markup in both the online and standalone builds.
// Every numeric label separates published values from the app's assumptions.
export function longHorizonMethodMarkup(model) {
  const long = model.longHorizon, assumptions = long.assumptions;
  const milestoneYears = new Set([2030, 2035, 2040, long.sourceThroughYear]);
  const milestones = long.annualSummary.filter(row => milestoneYears.has(row.year));
  const claims = LONG_HORIZON_CLAIMS.filter(item => long.sourceReferencePoints.some(point => point.sourceId === item.id));
  const summary = `<h3>${esc(long.sourceThroughYear)}년까지 이어지는 장기 시나리오</h3>
    <p>최신 완료 관측 ${esc(model.asOf)}에서 검증한 외부 자료의 마지막 목표 연도인 ${esc(long.sourceThroughYear)}년까지 표시합니다. 미래 연수를 고르는 설정은 없습니다. 연구 검토일은 ${esc(long.researchAsOf)}입니다.</p>
    <p><b>${esc(model.scenario.label)}</b>의 점선은 경제적 가치평가 가정과 과거 수익률의 흔들림을 결합한 한 경로입니다. 기관의 공식 목표선, 가장 가능성 높은 경로, 확률 예측구간을 뜻하지 않습니다.</p>
    <p>금처럼 채택될 가능성과 금처럼 변동성이 낮아질 가능성은 별개입니다. 발행량 감소만으로 4년 가격 주기의 종료 연도를 계산할 수 없어, 확정 종료일이나 장기 고저점의 D-day를 표시하지 않습니다.</p>`;
  const details = `<h3>가격 경로를 읽는 방법</h3>
    <p>WisdomTree의 통화량·금·BTC 채택 모형은 가격 = 세계 통화량 × 경화자산 비중 × 그중 BTC 비중 ÷ BTC 공급량입니다. 2030·2050년 원문의 낮은·기준·높은 평가값을 오늘의 관측 가격에 연결합니다. 목표 연도의 12월 31일 배치는 앱의 표시 규칙이며 원문이 예언한 정확한 날짜가 아닙니다.</p>
    <p>아래의 ‘평가 기준’은 외부 자료 또는 선택한 경제 가정의 값이고, ‘예시 경로’에는 모의 흔들림이 더해집니다. 두 값이 같아지도록 미래 가격을 강제하지 않습니다. 원문 발표 당시의 수익률을 오늘의 기대수익률로 재사용하지 않습니다.</p>
    ${table(['연말', '선택한 평가 기준', '예시 경로', '변동성 가정'], milestones.map(row => [row.year, usd(row.baselinePrice), usd(row.price), percent(row.annualizedVolatilityPct)]))}
    <p>음영은 서로 다른 채택·통화 시나리오가 같은 모의 흔들림을 겪는 경우입니다. 통계적 분위수·신뢰구간·가능한 손실의 하한이 아닙니다. ‘완만한 채택’은 낮은 경우와 기준 경우의 기하평균입니다. ‘수요 훼손’의 첫·마지막 평가 기준은 관측 가격의 60%·30%이며, 기관의 목표가가 아닌 앱의 별도 스트레스 가정입니다. 마지막 기준만 남으면 30%를 사용합니다.</p>
    <h3>기관별 원문 비교</h3>
    ${table(['기관 · 발표', '목표 연도', '낮음', '기준', '높음'], claims.map(item => [`${item.publisher} · ${item.publishedAt}`, item.targetYear, usd(item.prices.low), usd(item.prices.base), usd(item.prices.high)]))}
    <p>WisdomTree를 기본 가치평가에 사용하고 Bitwise·VanEck는 별도 비교로 둡니다. 서로 다른 채택률·시장 크기·통화 가정을 평균하지 않습니다. VanEck의 극단적 강세값을 일반 차트 음영 상단에 합치지 않습니다.</p>
    ${claims.map(item => `<p>${link(item.url, `${item.publisher} ${item.targetYear}년 원문`)}<br>${esc(item.assumptions.join(' '))}<br>${esc(item.limitations.join(' '))}</p>`).join('')}
    <h3>발행량과 4년 주기</h3>
    <p>Bitcoin Core는 210,000블록마다 블록 보조금을 절반으로 줄입니다. 표의 연도는 약 10분마다 블록이 생성된다는 달력 추정입니다. 반감기 직후의 연 발행률은 보조금 × 144블록 × 365.25일 ÷ 그때까지의 예정 발행량이며, 반감기를 포함한 한 해의 실제 총발행률과 다릅니다.</p>
    ${table(['반감기 무렵', 'BTC / 블록', '새 BTC / 일', '연 발행률'], long.issuance.halvingEpochs.map(row => [row.approximateYear === 2024 ? '2024 · 관측 연도' : `${row.approximateYear} · 추정`, number(row.subsidyBTC, 8), number(row.dailyNewBTC, 4), percent(row.annualIssuancePct, 3)]))}
    <p>2028·2032년에는 신규 공급 변화의 상대 크기가 더 작아집니다. 그래도 기존 보유자의 매매, 유동성, 레버리지와 수요가 가격을 움직일 수 있습니다. 신규 발행이 적다는 사실은 2028년이나 2032년에 가격 주기가 반드시 끝난다는 증거가 아닙니다.</p>
    <p>앱의 단기 주기 효과에는 ${number(long.cycleDecay.halfLifeYears, 3)}년 반감기의 감소 가중치를 적용합니다. 기존 단기 경로에서 추세를 뺀 일시적 편차만 사용하고 그 연결이 끝난 뒤 4년 고저점을 새로 반복하지 않습니다. 이 감소 규칙과 단기 연결 종료는 모형 선택이며 시장에서 입증된 주기 종료일이 아닙니다.</p>
    <p>${long.issuance.sources.map((url, index) => link(url, index ? '반감기 블록 간격 · Bitcoin Core' : '블록 보조금 · Bitcoin Core')).join(' · ')}</p>
    <h3>변동성의 미래는 별도 가정</h3>
    <p>관측 마지막 ${model.observables.volatilityWindowDays || 90}일의 연환산 변동성에서 시작해, 장기 ${percent(assumptions.terminalVolatilityPct * model.assumptions.volatilityMultiplier)} 가정에 ${number(assumptions.volatilityHalfLifeYears)}년 반감기로 접근합니다. σ(t) = σ장기 + (σ최근 − σ장기) × 2^(−경과연수 / ${number(assumptions.volatilityHalfLifeYears)}). 이 값은 생성 충격의 크기이며 실제로 생성된 경로의 실현 변동성과도 다릅니다.</p>
    <p>장기 ${percent(assumptions.terminalVolatilityPct)}와 ${number(assumptions.volatilityHalfLifeYears)}년 반감기는 앱의 공개된 모형 선택입니다. 변동성 배율은 현재 ${number(model.assumptions.volatilityMultiplier, 2)}배이며 시작값과 장기 가정 모두에 적용합니다. 기관 합의나 검증된 추정치가 아닙니다. Bitwise의 32.9%는 2025–2035년을 대표하는 평균·중간점 가정이며 2035년 말 목표가 아닙니다. VanEck는 장기 위험 계산에서도 40–70%를 사용합니다. 금 수준의 변동성에 도달하는 연도는 정하지 않습니다.</p>
    <h3>흔들림·검증·한계</h3>
    <p>선택적 단기 연결에는 이전 반감기 시대를 포함한 과거 잔차와 7–84일 가변 블록을 사용합니다. 모든 경제 시나리오는 같은 단기 시계와 흔들림을 공유합니다. 단기 연결 이후에는 관측 기준일까지의 최근 최대 1,461개 일별 로그수익률을 ${number(model.assumptions.blockDays)}일 연속 블록으로 재사용하며, 평균을 제거하고 변동성 크기를 조정합니다.</p>
    <p>단기 연결 뒤 잔차에는 ${number(assumptions.residualHalfLifeDays)}일 반감기의 평균회귀 가정을 더합니다. 이 반감기는 데이터에서 추정한 값이 아니며 끝점에 가격을 고정하지 않습니다. 같은 자료·시드·가정은 같은 경로를 재현합니다.</p>
    <p>새 장기 모형의 미래 정확도는 검증되지 않았습니다. 기존 단기 모형의 회고 평가에서는 모든 평가 기간의 MAPE가 당시 가격 유지 기준보다 컸습니다. 그 결과를 새 장기 모형의 적중률로 옮기지 않습니다. 현재 기관 보고서를 과거 관측에 붙이는 것도 당시 정보만 사용한 백테스트가 아닙니다.</p>
    <p>공급은 정수 사토시 보조금 일정으로 계산한 예정 발행량입니다. 분실·소각·미청구 보상·실제로 거래 가능한 물량을 뜻하지 않습니다. 영구적인 수요 상실이나 운영 실패는 기본 음영보다 큰 손실을 만들 수 있습니다.</p>
    <p>${link(report, '심층 조사·원문 수치·반론·제외 이유')} · ${link('https://github.com/twoimo/bitcoin-cycle-atlas/blob/main/docs/DETAILED_FORECAST_METHOD.md', '기존 단기 모형의 회고 검증 기록')} · ${link('https://github.com/twoimo/bitcoin-cycle-atlas/blob/main/docs/OHLC_CHART_METHOD.md', '실제 캔들의 출처·집계 규칙')}</p>`;
  return { summary, details };
}
