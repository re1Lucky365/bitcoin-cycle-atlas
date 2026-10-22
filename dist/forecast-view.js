import { utcDay, dateFromDay, validateDataset } from './cycle-engine.js?v=1.10.3';

const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const num = (value, digits = 0) => value == null ? '—' : new Intl.NumberFormat('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
const date = (value) => value ? value.replaceAll('-', '.') : '미관측';
const money = (value) => value == null ? '—' : `$${num(value)}`;
const compactMoney = (value) => value >= 1000 ? `$${num(value / 1000, value >= 100000 ? 0 : 1)}k` : money(value);
const pct = (value) => `${value >= 0 ? '+' : ''}${num(value, 1)}%`;
const span = (window) => !window ? '산출 불가' : window.startDate === window.endDate ? date(window.centerDate) : `${date(window.startDate)} – ${date(window.endDate)}`;
const band = (range) => range ? `${money(range.min)} – ${money(range.max)}` : '가격 가정 없음';
const yearMonth = (value) => value.slice(0, 7).replace('-', '.');
const analogueColors = ['#77b4ea', '#b6a2eb', '#6bc6ad'];
let chartContext = null;
let chartObserver = null;
let observedWidth = 0;

function colors() {
  const computed = getComputedStyle(document.documentElement);
  const read = (name, fallback) => computed.getPropertyValue(name).trim() || fallback;
  return {
    background: read('--surface', '#12161d'), text: read('--text', '#f2f4f7'),
    muted: read('--muted', '#8e98a8'), grid: read('--grid', '#242b35'),
    gold: read('--accent', '#f2a84b'), future: '#70c7d7',
    peak: '#d9a0c0', trough: '#71c6a6',
  };
}

function svgText(x, y, content, { fill, size = 10, anchor = 'start', weight = 400, opacity = 1 } = {}) {
  return `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" fill="${fill}" font-size="${size}" text-anchor="${anchor}" font-weight="${weight}" opacity="${opacity}">${esc(content)}</text>`;
}

function linePath(points, x, y, field = 'price') {
  return points.map((point, index) => `${index ? 'L' : 'M'}${x(point.date).toFixed(2)},${y(point[field]).toFixed(2)}`).join(' ');
}

function logTicks(minimum, maximum) {
  const ticks = [];
  for (let exponent = Math.floor(Math.log10(minimum)) - 1; exponent <= Math.ceil(Math.log10(maximum)); exponent++) {
    for (const multiplier of [1, 2, 5]) {
      const value = multiplier * 10 ** exponent;
      if (value >= minimum && value <= maximum) ticks.push(value);
    }
  }
  return ticks;
}

function pointSymbol(type, x, y, color, size = 5) {
  if (type === 'peak') return `<path d="M${x},${y - size} L${x - size},${y + size * 0.7} L${x + size},${y + size * 0.7} Z" fill="${color}"/>`;
  if (type === 'trough') return `<path d="M${x},${y + size} L${x - size},${y - size * 0.7} L${x + size},${y - size * 0.7} Z" fill="${color}"/>`;
  return `<circle cx="${x}" cy="${y}" r="${size * 0.7}" fill="${color}"/>`;
}

function buildChart(forecast, dataset, { view, scenario }) {
  const stage = $('forecast-chart-stage'), svg = $('forecast-chart');
  if (!stage || !svg) return;
  const width = Math.max(300, Math.round(stage.getBoundingClientRect().width || 1000));
  const height = Math.max(300, Math.round(stage.getBoundingClientRect().height || 390));
  const mobile = width < 540, small = mobile ? 9 : 10;
  const margin = { left: mobile ? 48 : 68, right: mobile ? 17 : 37, top: 67, bottom: 37 };
  const plot = { x: margin.left, y: margin.top, width: width - margin.left - margin.right, height: height - margin.top - margin.bottom };
  const palette = colors();
  const allRows = validateDataset(dataset).filter((row) => row.date <= forecast.asOf);
  const actualStart = forecast.asOf >= '2025-01-01' ? '2025-01-01' : dateFromDay(utcDay(forecast.asOf) - 730);
  const actual = allRows.filter((row) => row.date >= actualStart);
  if (!actual.length) return;
  const indexed = view === 'analogues';
  const transform = (value) => indexed ? value / forecast.current.price * 100 : value;
  const actualPath = actual.map((row) => ({ date: row.date, price: transform(row.price) }));
  let endDate = indexed ? forecast.horizonDate : scenario?.troughWindow?.endDate ?? scenario?.peakWindow?.endDate ?? forecast.horizonDate;
  if (endDate <= forecast.asOf) endDate = forecast.horizonDate;
  const endDay = utcDay(endDate) + (indexed ? 10 : 70);
  const startDay = utcDay(actual[0].date);
  const valueInputs = actualPath.map((point) => point.price);
  if (indexed) for (const replay of forecast.scenarios) for (const point of replay.path) valueInputs.push(transform(point.price));
  else for (const point of scenario?.path ?? []) valueInputs.push(point.low, point.price, point.high);
  const validValues = valueInputs.filter((value) => Number.isFinite(value) && value > 0);
  const minValue = Math.min(...validValues) * 0.78, maxValue = Math.max(...validValues) * 1.45;
  const x = (when) => plot.x + (utcDay(when) - startDay) / (endDay - startDay) * plot.width;
  const y = (value) => plot.y + (Math.log(maxValue) - Math.log(value)) / (Math.log(maxValue) - Math.log(minValue)) * plot.height;
  const currentX = x(forecast.asOf);
  const title = indexed ? '현재 가격을 100으로 맞춘 과거 저점 이후 수익률의 조건부 재생' : '현재 저점 후보와 시간 가정에 따른 다음 고점·저점 시나리오';
  const description = indexed
    ? `${date(forecast.asOf)}까지 금색 실선은 실제 관측을 현재 100으로 환산한 값입니다. 이후 점선은 과거 세 경로의 수익률을 재생합니다. 삼각형은 해당 역사 경로 안에서 20% 반전으로 확인된 내부 고점과 저점입니다. 예측 가격이나 확률이 아닙니다.`
    : `${date(forecast.asOf)}까지 금색 실선은 실제 USD 가격입니다. 점선은 ${scenario?.label ?? '선택된 가정'}의 사건 사이를 로그 가격으로 연결한 개략선이며 음영은 가격 가정의 민감도입니다. 미래 고점 ${span(scenario?.peakWindow)}, 미래 저점 ${span(scenario?.troughWindow)}. 날짜 범위는 미래 오차범위가 아닙니다.`;
  let content = `<title id="forecast-svg-title">${esc(title)}</title><desc id="forecast-svg-desc">${esc(description)}</desc><defs><clipPath id="forecast-plot-clip"><rect x="${plot.x}" y="${plot.y}" width="${plot.width}" height="${plot.height}"/></clipPath></defs><rect width="${width}" height="${height}" fill="${palette.background}"/>`;
  content += `<rect x="${currentX}" y="${plot.y}" width="${Math.max(0, plot.x + plot.width - currentX)}" height="${plot.height}" fill="${palette.future}" fill-opacity="0.025"/>`;
  for (const value of logTicks(minValue, maxValue)) {
    content += `<line x1="${plot.x}" x2="${plot.x + plot.width}" y1="${y(value)}" y2="${y(value)}" stroke="${palette.grid}" stroke-width="1"/>`;
    content += svgText(plot.x - 9, y(value) + 3, indexed ? num(value) : compactMoney(value), { fill: palette.muted, size: small, anchor: 'end' });
  }
  const firstYear = Number(actual[0].date.slice(0, 4)), lastYear = Number(dateFromDay(endDay).slice(0, 4));
  for (let year = firstYear; year <= lastYear; year++) {
    const tick = `${year}-01-01`;
    if (utcDay(tick) < startDay || utcDay(tick) > endDay) continue;
    content += `<line x1="${x(tick)}" x2="${x(tick)}" y1="${plot.y}" y2="${plot.y + plot.height}" stroke="${palette.grid}" stroke-width="1" stroke-dasharray="2 6"/>`;
    content += svgText(x(tick), plot.y + plot.height + 24, String(year), { fill: palette.muted, size: small, anchor: 'middle' });
  }
  content += svgText(plot.x, 21, '실제 관측', { fill: palette.gold, size: small, weight: 550 });
  content += svgText(Math.min(currentX + 10, width - 138), 21, indexed ? '과거 수익률 재생 · 현재=100' : '조건부 계산 · 확률범위 아님', { fill: palette.future, size: small, weight: 500 });
  content += svgText(Math.min(Math.max(currentX, plot.x + 60), width - 74), 41, `관측 종료 ${date(forecast.asOf)}`, { fill: palette.muted, size: small, anchor: 'middle' });
  content += `<line x1="${currentX}" x2="${currentX}" y1="47" y2="${plot.y + plot.height}" stroke="${palette.muted}" stroke-width="1" stroke-dasharray="4 5" opacity="0.65"/>`;

  if (indexed && forecast.scenarios.length) {
    for (let index = 0; index < forecast.scenarios.length; index++) {
      const replay = forecast.scenarios[index], color = analogueColors[index % analogueColors.length];
      const points = replay.path.map((point) => ({ ...point, price: transform(point.price) }));
      content += `<path clip-path="url(#forecast-plot-clip)" d="${linePath(points, x, y)}" fill="none" stroke="${color}" stroke-width="${mobile ? 1.5 : 1.8}" stroke-dasharray="5 4" stroke-linejoin="round"><title>${esc(replay.label)} · 실제 미래 예측이 아닌 수익률 재생</title></path>`;
      for (const event of replay.events) {
        const relative = transform(event.price);
        content += `<g tabindex="0" role="img" aria-label="${esc(`${replay.label}, ${event.type === 'peak' ? '조건부 고점' : '조건부 저점'} ${date(event.date)}, 현재 대비 ${pct(relative - 100)}, 해당 역사 경로의 반전 확인 ${date(event.confirmationDate)}`)}"><title>${esc(`${replay.label} · ${event.type === 'peak' ? '고점' : '저점'} ${date(event.date)} · 현재=100 지수 ${num(relative, 1)} · 반전 확인 ${date(event.confirmationDate)}`)}</title>${pointSymbol(event.type, x(event.date), y(relative), color, mobile ? 3 : 4)}</g>`;
      }
    }
  } else if (!indexed && scenario?.path.length > 1) {
    const upper = linePath(scenario.path, x, y, 'high');
    const lower = [...scenario.path].reverse().map((point) => `L${x(point.date).toFixed(2)},${y(point.low).toFixed(2)}`).join(' ');
    content += `<path clip-path="url(#forecast-plot-clip)" d="${upper} ${lower} Z" fill="${palette.future}" fill-opacity="0.10"/>`;
    content += `<path clip-path="url(#forecast-plot-clip)" d="${linePath(scenario.path, x, y)}" fill="none" stroke="${palette.future}" stroke-width="2" stroke-dasharray="6 5" stroke-linejoin="round"><title>α=0.75 및 직전 완결 사이클의 저점 잔존비율을 선택한 개략선입니다. 예상 평균이 아닙니다.</title></path>`;
    for (const anchor of scenario.anchors.filter((point) => point.type !== 'observed')) {
      const type = anchor.type, color = type === 'peak' ? palette.peak : type === 'trough' ? palette.trough : palette.future;
      const window = type === 'peak' ? scenario.peakWindow : type === 'trough' ? scenario.troughWindow : scenario.highZoneWindow;
      const markerX = x(anchor.date), markerY = y(anchor.price);
      const label = type === 'peak' ? '고점' : type === 'trough' ? '저점' : `${num(forecast.methodology.highZoneFraction * 100)}% 고점권`;
      if (window) content += `<rect x="${x(window.startDate)}" y="${plot.y}" width="${Math.max(0.7, x(window.endDate) - x(window.startDate))}" height="${plot.height}" fill="${color}" fill-opacity="0.12"/>`;
      content += `<g tabindex="0" role="img" aria-label="${esc(`${label} 조건부 날짜 ${span(window)}, 가격 민감도 ${money(anchor.low)}에서 ${money(anchor.high)}, 표시 가정 ${money(anchor.price)}`)}"><title>${esc(`${label}: ${span(window)} / 가격 가정 ${money(anchor.low)}–${money(anchor.high)} / 대표선 ${money(anchor.price)} / 확률·신뢰구간 아님`)}</title><line x1="${markerX}" x2="${markerX}" y1="${y(anchor.high)}" y2="${y(anchor.low)}" stroke="${color}" stroke-width="1.3" opacity="0.8"/><line x1="${markerX - 4}" x2="${markerX + 4}" y1="${y(anchor.high)}" y2="${y(anchor.high)}" stroke="${color}"/><line x1="${markerX - 4}" x2="${markerX + 4}" y1="${y(anchor.low)}" y2="${y(anchor.low)}" stroke="${color}"/>${pointSymbol(type, markerX, markerY, color, mobile ? 4 : 5)}</g>`;
      const labelX = Math.min(Math.max(markerX, plot.x + (mobile ? 36 : 55)), plot.x + plot.width - (mobile ? 36 : 55));
      let labelY = type === 'high-zone' ? markerY + 23 : markerY - 30;
      labelY = Math.min(Math.max(labelY, plot.y + 11), plot.y + plot.height - 22);
      content += svgText(labelX, labelY, `${label} ${yearMonth(anchor.date)}`, { fill: color, size: small, anchor: 'middle', weight: 550 });
      if (type !== 'high-zone') content += svgText(labelX, labelY + 14, `${compactMoney(anchor.price)} · 표시 가정`, { fill: color, size: small, anchor: 'middle' });
    }
  }
  content += `<path clip-path="url(#forecast-plot-clip)" d="${linePath(actualPath, x, y)}" fill="none" stroke="${palette.gold}" stroke-width="2.1" stroke-linejoin="round"/>`;
  const currentY = y(transform(forecast.current.price));
  content += `<circle cx="${currentX}" cy="${currentY}" r="3.4" fill="${palette.gold}"/>`;
  if (!indexed) {
    for (const [observed, label, offset] of [[forecast.current.peak, '관측 고점', -14], [forecast.current.troughCandidate, '저점 후보', 21]]) {
      if (!observed || observed.date < actual[0].date) continue;
      const pointX = x(observed.date), pointY = y(observed.price);
      content += `<circle cx="${pointX}" cy="${pointY}" r="3" fill="${palette.background}" stroke="${palette.gold}" stroke-width="1.3"><title>${esc(`${label} ${date(observed.date)} ${money(observed.price)}`)}</title></circle>`;
      content += svgText(Math.min(Math.max(pointX, plot.x + 25), currentX - 8), pointY + offset, label, { fill: palette.gold, size: small, anchor: 'middle' });
    }
  }
  if (indexed && !forecast.scenarios.length) content += svgText(plot.x + plot.width * 0.68, plot.y + plot.height * 0.52, '저점 후보 또는 완결 비교 경로가 없습니다', { fill: palette.muted, size: small, anchor: 'middle' });
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('aria-labelledby', 'forecast-svg-title forecast-svg-desc');
  svg.setAttribute('font-family', "Inter, 'Noto Sans KR', Arial, sans-serif");
  svg.setAttribute('data-export-width', String(width));
  svg.setAttribute('data-export-height', String(height));
  svg.innerHTML = content;
}

function renderMacroTable(forecast, scenario) {
  const fraction = forecast.methodology.highZoneFraction;
  $('forecast-table-head').innerHTML = '<tr><th scope="col">전환 사건</th><th scope="col">조건부 날짜 · UTC</th><th scope="col">가격 가정의 범위 · USD</th><th scope="col">해석</th></tr>';
  const rows = [];
  if (forecast.current.troughCandidate) rows.push(`<tr><td>현재 저점 후보<small>관측 사실 · 최종 저점 미확정</small></td><td>${date(forecast.current.troughCandidate.date)}</td><td>${money(forecast.current.troughCandidate.price)}</td><td>후속 저가가 나오면 기준 변경</td></tr>`);
  if (scenario) {
    const zoneBand = scenario.peakPriceBand ? { min: scenario.peakPriceBand.min * fraction, max: scenario.peakPriceBand.max * fraction } : null;
    rows.push(`<tr><td>다음 고점권 진입<small>다음 가정 고점의 ${num(fraction * 100)}%</small></td><td>${span(scenario.highZoneWindow)}</td><td>${band(zoneBand)}</td><td>이번 ${num(forecast.current.firstHighZoneEntry?.daysBeforePeak)}일 간격의 재사용</td></tr>`);
    rows.push(`<tr><td>다음 큰 고점<small>확정 시점 또는 목표가 아님</small></td><td class="advance">${span(scenario.peakWindow)}</td><td>${band(scenario.peakPriceBand)}</td><td>${scenario.id === 'bottom-holds' ? '과거 저점→다음 고점 기간의 사례 범위' : '선택한 달력 간격을 반복한 계산일'}</td></tr>`);
    if (scenario.troughWindow) rows.push(`<tr><td>다음 큰 저점<small>고점 뒤 새로운 하락 구간</small></td><td class="advance">${span(scenario.troughWindow)}</td><td>${band(scenario.troughPriceBand)}</td><td>${scenario.id === 'bottom-holds' ? '완결된 하락기간 364–406일 적용' : '현재의 잠정 저점 사건을 달력 이동'}</td></tr>`);
    if (scenario.shorterDeclineWindow) rows.push(`<tr><td>짧은 하락이 반복되면<small>별도 시간 민감도 · 기본 곡선에 미포함</small></td><td>${span(scenario.shorterDeclineWindow)}</td><td>별도 가격 추정 없음</td><td>이번 고점→저점 후보 ${num(forecast.current.troughCandidate.daysAfterPeak)}일 적용</td></tr>`);
  }
  $('forecast-table-body').innerHTML = rows.length ? rows.join('') : '<tr><td colspan="4">계산에 필요한 관측 사건이 없습니다.</td></tr>';
}

function renderAnalogueTable(forecast) {
  $('forecast-table-head').innerHTML = '<tr><th scope="col">반복한다고 가정한 역사</th><th scope="col">첫 내부 고점 후보</th><th scope="col">그다음 내부 저점 후보</th><th scope="col">해당 역사 내 반전 확인</th></tr>';
  $('forecast-table-body').innerHTML = forecast.scenarios.map((scenario) => {
    const peak = scenario.events.find((event) => event.type === 'peak');
    const trough = scenario.events.find((event) => event.type === 'trough' && (!peak || event.date > peak.date));
    const show = (event) => event ? `${date(event.date)}<small>현재 대비 ${pct((event.price / forecast.current.price - 1) * 100)}</small>` : '확인된 내부 전환 없음';
    return `<tr><td>${esc(scenario.label)}<small>관측 저점 후 ${num(scenario.phaseDays)}일에 맞춤</small></td><td>${show(peak)}</td><td>${show(trough)}</td><td>고점 ${date(peak?.confirmationDate)}<small>저점 ${date(trough?.confirmationDate)}</small></td></tr>`;
  }).join('') || '<tr><td colspan="4">현재 저점 후보가 없거나 과거 전체 경로가 관측되지 않았습니다.</td></tr>';
}

function methodHtml(forecast) {
  const model = forecast.macro.priceModel, replay = forecast.backtest;
  const actualLow = forecast.current.troughCandidate;
  const intervalRows = forecast.macro.lowToNextPeakIntervals.map((interval) => `<tr><td>${date(interval.fromDate)} → ${date(interval.toDate)}</td><td>${num(interval.days)}일</td><td>${interval.nextPeakProvisional ? '끝 고점은 현재 관측 최고값 · 잠정' : '과거 완결 구간 · 사후 선택'}</td></tr>`).join('');
  const priceRows = model.peakPriceCases.map((entry) => `<tr><td>${num(entry.alpha * 100)}%</td><td>${money(entry.price)}</td><td>미래 성장률의 ${entry.alpha === 0.75 ? '표시용 대표 ' : ''}가정</td></tr>`).join('');
  const retentionRows = model.retentionCases.map((retention) => {
    const values = model.peakPriceCases.map((entry) => money(entry.price * retention.ratio));
    return `<tr><td>${retention.cycleYear} 사이클${retention.provisional ? ' · 후보' : ''}<small>${num(retention.drawdownPct, 1)}% 하락</small></td>${values.map((value) => `<td>${value}</td>`).join('')}</tr>`;
  }).join('');
  const replayRows = replay?.summary.map((result) => `<tr><td>${result.horizonDays}일</td><td>${num(result.analogueMeanAbsolutePercentageErrorPct, 1)}%</td><td>${num(result.flatMeanAbsolutePercentageErrorPct, 1)}%</td><td>${num(result.analogueMeanAbsoluteLogError, 3)} / ${num(result.flatMeanAbsoluteLogError, 3)}</td><td>${result.n}</td></tr>`).join('') ?? '';
  const allEventRows = forecast.scenarios.flatMap((scenario) => scenario.events.map((event) => `<tr><td>${esc(scenario.label)}</td><td>${event.type === 'peak' ? '고점' : '저점'}</td><td>${date(event.date)}</td><td>${pct((event.price / forecast.current.price - 1) * 100)}</td><td>${date(event.confirmationDate)}</td></tr>`)).join('');
  const endpointIndices = forecast.scenarios.map((scenario) => `${scenario.referenceTrough.date.slice(0, 4)} 사례 ${num(scenario.statistics.endPrice / forecast.current.price * 100, 1)}`).join(' · ');
  const source = /^https:\/\//.test(forecast.source.source ?? '') ? forecast.source.source : 'https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets=btc&metrics=PriceUSD&frequency=1d';
  return `<h3>1. 저점이 유지될 때의 큰 전환 날짜</h3>
    <p>현재 ${actualLow ? `${date(actualLow.date)}의 ${money(actualLow.price)}` : '고점 이후 저점이 아직 없어'}${actualLow ? '가 이번 사이클 저점으로 남는다고 가정합니다.' : ' 저점 기준 시나리오를 계산하지 않습니다.'} 과거 저점에서 그다음 큰 고점까지 걸린 기간을 그대로 더합니다. 과거의 저점·고점 자체는 해당 구간을 본 뒤 고른 사건이며, 그 당시 최종 저점임을 알았다는 뜻이 아닙니다.</p>
    <div class="formula-block">다음 고점 날짜 = 현재 저점 후보 날짜 + (과거 다음 고점 날짜 − 과거 저점 날짜)<br>다음 저점 날짜 = 위 고점 날짜 + 완결된 과거 고점→저점 기간</div>
    <div class="table-scroll"><table><thead><tr><th>과거 저점 → 다음 고점</th><th>기간</th><th>관측 상태</th></tr></thead><tbody>${intervalRows}</tbody></table></div>
    <p>고점 날짜의 최솟값과 최댓값이 ${num(forecast.macro.lowToNextPeakIntervals.length)}개 사례에서 좁게 모여도, 실제 미래가 그 며칠 안에 들어온다는 정밀 예측은 아닙니다. 다음 하락기간은 완결된 사례의 ${forecast.macro.peakToTroughIntervals.map((entry) => entry.days).join('·')}일을 적용했습니다.${actualLow ? ` 현재 후보까지의 ${num(actualLow.daysAfterPeak)}일 하락을 반복하는 경우는 별도 시간 민감도입니다.` : ''} 아직 관측되지 않은 다음 반감기 날짜는 계산에 쓰지 않습니다.</p>
    <h3>2. 달력 4년과 추가 압축은 별도 가정</h3>
    <div class="formula-block">달력 반복 날짜 = 이번 관측 사건 + 48개월<br>추가 압축 민감도 = 이번 관측 사건 + (48 − 3·4·5)개월</div>
    <p>고점권 첫 진입과 최고값 날짜를 각각 이동합니다. 고점권의 기준은 관측 고점의 ${num(forecast.methodology.highZoneFraction * 100)}%이며, 이번 첫 진입은 ${date(forecast.current.firstHighZoneEntry?.date)}, 최고값은 ${date(forecast.current.peak.date)}입니다. 저점 유지 모형은 이미 빨라진 현재 저점을 출발점으로 삼으므로 여기에서 3–5개월을 다시 빼지 않습니다. 추가 3·4·5개월은 48개월 달력 기준에만 적용한 민감도이며 통계적으로 추정된 가속률이 아닙니다.</p>
    <h3>3. 가격은 별도의 성장·하락 가정</h3>
    <p>직전 고점 ${money(model.previousPeak?.price)}에서 현재 관측 고점 ${money(model.currentPeak.price)}까지의 배율은 ${num(model.lastPeakMultiple, 4)}배입니다. 이 로그 성장이 다음에도 50·75·100% 남는 세 경우를 계산합니다. 세 비율은 편의를 위해 정한 시나리오이고, 분포를 추정하거나 가장 가능성이 높은 값을 찾은 결과가 아닙니다.</p>
    <div class="formula-block">Q<sub>다음</sub>(α) = Q<sub>현재</sub> × (Q<sub>현재</sub> / Q<sub>이전</sub>)<sup>α</sup>, α ∈ {0.50, 0.75, 1.00}<br>L<sub>다음</sub>(α, r) = Q<sub>다음</sub>(α) × r<br>r = 과거 저점 / 같은 사이클 고점</div>
    <div class="table-scroll"><table><thead><tr><th>로그 성장 유지율</th><th>다음 고점 가격 가정</th><th>성격</th></tr></thead><tbody>${priceRows}</tbody></table></div>
    <p>다음 저점은 과거 잔존비율 r을 대입한 민감도 표로 제시합니다. 현재 사이클의 비율은 저점이 확정되지 않은 후보값입니다. 음영은 이 조합들의 최솟값과 최댓값이며 실제 결과가 그 밖에 있을 수 있습니다.</p>
    <div class="table-scroll"><table><thead><tr><th>저점 잔존비율의 기준</th><th>α = 0.50</th><th>α = 0.75</th><th>α = 1.00</th></tr></thead><tbody>${retentionRows}</tbody></table></div>
    <p>점선은 α=0.75와 직전 완결 사이클의 잔존비율 ${num((model.representativeRetention ?? 0) * 100, 2)}%를 표시용으로 선택해 사건 사이를 연결합니다. 기대수익률이나 평균 예측이 아닙니다. 선의 기울기와 중간 날짜에는 별도의 일별 예측 의미가 없습니다.</p>
    <div class="formula-block">log P(t) = (1 − w) log A + w log B<br>w = 두 가정 사건 사이에서 지난 일수 / 두 사건 사이 총일수</div>
    <h3>4. 중간 반등·조정 그래프의 의미</h3>
    <p>현재를 100으로 두고, 각 과거 저점 후 ${num(forecast.current.phaseDays)}일 시점부터의 수익률을 ${num(forecast.horizonDays)}일간 재생합니다. 서로 다른 시대의 성장 배율을 그대로 적용하면 매우 큰 값이 나올 수 있습니다. 끝값은 ${endpointIndices || '계산 가능한 사례 없음'}입니다. 이 재생을 USD 목표가로 제시하거나 위 거시 가격 민감도와 이어 붙이지 않습니다.</p>
    <div class="formula-block">S<sub>j</sub>(h) / P<sub>현재</sub> × 100 = 100 × P<sub>과거 저점 j + d + h</sub> / P<sub>과거 저점 j + d</sub><br>d = 오늘 − 현재 저점 후보 날짜</div>
    <p>최초 추세가 20% 움직인 뒤 반대쪽으로 20% 움직였을 때 해당 역사 경로 안의 고점·저점을 표시합니다. 시작의 얕은 흔들림과 끝의 미확인 극값은 전환점에서 제외합니다. 그래프의 확인 날짜는 가정한 과거 경로 안에서 그 반전이 나타나는 때이지, 미래 사건이 지금 확인되었다는 뜻이 아닙니다.</p>
    ${allEventRows ? `<details><summary>경로 안의 모든 내부 고점·저점 후보 보기</summary><div class="table-scroll"><table><thead><tr><th>반복 역사</th><th>종류</th><th>조건부 날짜</th><th>현재 대비</th><th>가정 경로의 반전 확인</th></tr></thead><tbody>${allEventRows}</tbody></table></div></details>` : ''}
    <h3>5. 당시 데이터만 사용한 과거 재생 검증</h3>
    <p>기준일은 2019.03.31과 2023.03.31 두 번입니다. 각 날짜까지의 관측만으로 당시 저점 후보를 고르고, 그때까지 전체 경로가 이미 관측된 이전 사례만 사용했습니다. 여러 경로가 있으면 가격의 기하평균을 비교값으로 삼습니다. 비교 기준은 당시 가격이 계속 유지된다는 단순 모형입니다.</p>
    ${replayRows ? `<div class="table-scroll"><table><thead><tr><th>평가 시차</th><th>아날로그 평균 절대 % 오차</th><th>현재가 유지 평균 절대 % 오차</th><th>평균 절대 로그 오차<br>아날로그 / 유지</th><th>기준일 수</th></tr></thead><tbody>${replayRows}</tbody></table></div>` : '<p>이 데이터 범위에서는 과거 검증 결과를 계산하지 않았습니다.</p>'}
    <p>90일·180일의 평균 절대 백분율 오차는 단순 현재가 유지보다 컸고, 365일은 작았습니다. 검증 시점이 두 번뿐이고 시차별 결과도 같은 두 구간을 공유하므로 우월한 예측력을 입증하지 못합니다. 기준일 선택도 사전 등록된 실험이 아닙니다. 기본 평가는 2025년 이후 결과를 제외하며, 730일 경로·2029/2030 날짜·α 선택·가격 밴드를 검증한 것은 아닙니다.</p>
    <h3>6. 수학으로 확인할 수 있는 것과 남는 불확실성</h3>
    <p>위 산식과 날짜 덧셈은 가정이 주어졌을 때 재현할 수 있습니다. 관측만으로 미래 극값을 증명하는 것은 별개의 문제입니다. 오늘까지 똑같은 가격 이력을 가진 두 경로라도 내일 하나는 기존 최고값보다 높고 다른 하나는 기존 최저값보다 낮게 이어질 수 있습니다.</p>
    <div class="formula-block">P⁺(t) = P⁻(t) = P(t), t ≤ T<br>P⁺(T+1) = 1.1 × max(P(t), t≤T)<br>P⁻(T+1) = 0.9 × min(P(t), t≤T)</div>
    <p>동일한 과거에서 서로 다른 미래가 가능하므로, 추가 가정 없이 최종 고점·저점의 날짜와 가격이 유일하게 결정되지는 않습니다. 현재 저점 후보를 밑도는 새 관측, 새 고점, 이전과 다른 상승·하락 기간이 나오면 관련 기준을 다시 계산해야 합니다.</p>
    <p>출처: <a href="https://docs.coinmetrics.io/network-data/network-data-overview/market/price" target="_blank" rel="noopener noreferrer">Coin Metrics PriceUSD의 UTC 일말 정의</a> · <a href="${esc(source)}" target="_blank" rel="noopener noreferrer">실제 사용한 공개 일별 원자료</a> · <a href="https://otexts.com/fpp3/toolbox.html" target="_blank" rel="noopener noreferrer">Forecasting: Principles and Practice 5장 — 과거 시점 검증·단순 기준·예측구간</a>. 출처가 이 사이트의 미래 시나리오를 보증하는 것은 아닙니다.</p>`;
}

export function renderForecastView(forecast, dataset, { view = 'macro', scenarioId = 'bottom-holds' } = {}) {
  if (!['macro', 'analogues'].includes(view)) throw new TypeError('Unknown forecast view');
  const scenario = forecast.macro.scenarios.find((entry) => entry.id === scenarioId) ?? forecast.macro.scenarios.find((entry) => entry.id === 'calendar-48m') ?? forecast.macro.scenarios[0];
  const palette = colors();
  $('macro-controls').hidden = view !== 'macro';
  if (scenario) $('forecast-scenario').value = scenario.id;
  for (const button of document.querySelectorAll('[data-forecast-view]')) {
    const active = button.dataset.forecastView === view;
    button.classList.toggle('selected', active);
    button.setAttribute('aria-pressed', String(active));
  }
  if (view === 'macro') {
    $('forecast-headline').textContent = scenario?.id === 'bottom-holds' ? `저점이 유지되면, 다음 큰 고점은 ${yearMonth(scenario.peakWindow.startDate)}–${yearMonth(scenario.peakWindow.endDate)}` : `${scenario?.label ?? '달력 가정'}에 따른 고점·저점`;
    $('forecast-summary').textContent = scenario?.id === 'bottom-holds'
      ? `${date(forecast.current.troughCandidate.date)} 저점 후보에 과거 저점→다음 고점 기간을 더한 조건부 날짜입니다. 며칠 간격으로 좁게 모인 결과는 ${forecast.macro.lowToNextPeakIntervals.length}개 역사 사례의 범위이며 미래가 그 안에 들어온다는 뜻은 아닙니다.`
      : '이번 고점권 진입, 관측 최고값, 잠정 저점에 같은 달력 간격을 더합니다. 추가 단축 개월 수는 추정치가 아닌 별도 가정입니다.';
    $('forecast-axis-label').textContent = '가격 (USD · 로그) · 미래 부분은 가정';
    $('forecast-chart-note').innerHTML = '<strong>미래 점선은 가정한 사건을 연결한 개략선입니다.</strong> 음영은 성장·하락 가정을 바꿨을 때의 가격 민감도이며 예측구간이 아닙니다. 삼각형의 대표 가격도 확정 목표가가 아닙니다.';
    $('forecast-legend').innerHTML = `<span style="--legend-color:${palette.gold}"><i></i>실제 관측</span><span class="dashed" style="--legend-color:${palette.future}"><i></i>표시 가정 연결선</span><span style="--legend-color:${palette.peak}"><i></i>고점 · 날짜/가격 가정</span><span style="--legend-color:${palette.trough}"><i></i>저점 · 날짜/가격 가정</span>`;
    renderMacroTable(forecast, scenario);
  } else {
    $('forecast-headline').textContent = '중간 반등과 조정, 과거 세 경로를 나란히';
    $('forecast-summary').textContent = `현재를 100으로 맞추고 과거 저점 후 ${num(forecast.current.phaseDays)}일 지점부터의 수익률을 재생합니다. 점선마다 서로 다른 가정이며, 전환 날짜도 그 경로가 반복될 때만 성립합니다.`;
    $('forecast-axis-label').textContent = '상대수익률 지수 (현재=100 · 로그)';
    $('forecast-chart-note').innerHTML = '<strong>과거 수익률의 재생이며 USD 목표가가 아닙니다.</strong> ▲ 고점과 ▼ 저점은 해당 역사 안에서 선행 20% 움직임과 반대방향 20% 움직임이 확인된 내부 전환입니다. 끝의 미확인 극값은 표시하지 않습니다.';
    $('forecast-legend').innerHTML = `<span style="--legend-color:${palette.gold}"><i></i>실제 관측 · 현재=100</span>${forecast.scenarios.map((replay, index) => `<span class="dashed" style="--legend-color:${analogueColors[index % analogueColors.length]}"><i></i>${esc(replay.label)}</span>`).join('')}`;
    renderAnalogueTable(forecast);
  }
  $('forecast-conditions').innerHTML = forecast.current.troughCandidate
    ? `<strong>무효화 기준:</strong> ${date(forecast.current.troughCandidate.date)} 후보 ${money(forecast.current.troughCandidate.price)}보다 낮은 UTC 일말 관측이 나오면 현재의 저점 기준을 다시 잡아야 합니다. 새 고점이 생겨도 고점권 기준과 가격 배율을 다시 계산합니다. ${view === 'macro' ? '달력 가정과 저점 유지 가정을 중복 차감하지 않습니다.' : '각 역사 경로의 반복 여부와 시점을 보증하는 확률은 계산하지 않았습니다.'}`
    : '<strong>저점 기준 산출 대기:</strong> 현재 고점 뒤에 더 낮은 관측이 아직 없어 저점 유지 경로와 이후 저점을 계산하지 않습니다. 고점 자체를 저점으로 취급하지 않습니다.';
  $('forecast-method').innerHTML = methodHtml(forecast);
  chartContext = { forecast, dataset, options: { view, scenario } };
  buildChart(forecast, dataset, { view, scenario });
  if (!chartObserver && typeof ResizeObserver !== 'undefined') {
    chartObserver = new ResizeObserver((entries) => {
      const width = Math.round(entries[0]?.contentRect.width ?? 0);
      if (width > 0 && width !== observedWidth && chartContext) {
        observedWidth = width;
        buildChart(chartContext.forecast, chartContext.dataset, chartContext.options);
      }
    });
    chartObserver.observe($('forecast-chart-stage'));
  }
}

/** The caller owns download UI; this function returns a self-contained SVG XML. */
export function exportForecastSvg() {
  const original = $('forecast-chart');
  if (!original?.querySelector('path')) throw new Error('Export requires a rendered forecast chart');
  const svg = original.cloneNode(true);
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const width = Number(original.getAttribute('data-export-width') ?? 1000);
  const chartHeight = Number(original.getAttribute('data-export-height') ?? 390);
  const footerHeight = 92;
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(chartHeight + footerHeight));
  svg.setAttribute('viewBox', `0 0 ${width} ${chartHeight + footerHeight}`);
  svg.removeAttribute('data-export-width');
  svg.removeAttribute('data-export-height');
  if (chartContext) {
    const palette = colors(), namespace = 'http://www.w3.org/2000/svg';
    const background = document.createElementNS(namespace, 'rect');
    for (const [name, value] of Object.entries({ x: 0, y: chartHeight, width, height: footerHeight, fill: palette.background })) background.setAttribute(name, String(value));
    svg.append(background);
    const { forecast, options } = chartContext;
    const footerLines = [
      `관측 종료 ${forecast.asOf} · UTC 일말`,
      options.view === 'macro' ? `시간 가정: ${options.scenario?.label ?? '달력 반복'}` : '과거 수익률의 조건부 재생 · 현재=100',
      options.view === 'macro' ? `표시 가격: α=0.75 · r=${num((forecast.macro.priceModel.representativeRetention ?? 0) * 100, 2)}%` : '▲▼ 과거 경로 안의 20% 내부 반전',
      '선·음영은 가정이며 확률구간·목표가 아님',
      'Data © Coin Metrics · CC BY-NC 4.0',
    ];
    footerLines.forEach((line, index) => {
      const element = document.createElementNS(namespace, 'text');
      for (const [name, value] of Object.entries({ x: 16, y: chartHeight + 12 + index * 16, fill: palette.muted, 'font-size': width < 540 ? 9 : 10 })) element.setAttribute(name, String(value));
      element.textContent = line;
      svg.append(element);
    });
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(svg)}`;
}
