import { HALVINGS, utcDay, validateDataset } from './cycle-engine.js?v=1.11.0';
import { detectDirectionalChanges, getMacroCycles } from './market-structure.js?v=1.11.0';

/** Retrospective chart annotations. These never alter the observed or assumed price path. */
export const MILESTONE_TYPES = Object.freeze([
  Object.freeze({ id: 'cycle-top', label: 'CYCLE TOP', color: '#f27781', description: '관측: 사후로 선택한 사이클 고점 / 미래: 모형 고점 시계까지의 경로 최고값 · 최신·미래 구간은 후보' }),
  Object.freeze({ id: 'pit-stop', label: 'PIT STOP', color: '#6d9dff', description: 'FIRST TOP 이후, 최종 고점 60–150일 전의 마지막 12% 하락 확인 고점 · 관측·미래 경로에 같은 조건 적용' }),
  Object.freeze({ id: 'first-top', label: 'FIRST TOP', color: '#67c78f', description: '최종 고점 연도 1–6월의 주요 12% 하락 확인 고점 · 최종 고점보다 90일 이상 앞서며 관측·가정의 자격 창을 따름' }),
  Object.freeze({ id: 'ath', label: 'ATH', color: '#5bcbd8', description: '저점 이후 직전 선택 사이클 고점의 일말 가격을 처음 초과한 날 · 관측 또는 선택한 가정 경로의 회복 기준' }),
  Object.freeze({ id: 'mid-top', label: 'MID-TOP', color: '#f3ae63', description: '관측: 저점부터 반감기까지 최고 일말 가격 / 미래: 저점부터 모형 고점 시계까지 첫 1/3 구간의 최고 예시 가격' }),
  Object.freeze({ id: 'bottom', label: 'BOTTOM', color: '#b293ee', description: '관측: 선택 고점 사이의 최저 일말 가격 / 미래: 다음 저점 창에서 제공된 경로의 최저값 · 최신·부분 창은 후보' }),
]);
const TYPES = new Map(MILESTONE_TYPES.map(type => [type.id, type]));
export const INTERVAL_RELATIONS = Object.freeze([
  ['bottom-bottom', 'bottom', 'bottom', '#b293ee'],
  ['bottom-cycle-top', 'bottom', 'cycle-top', '#b293ee'],
  ['bottom-first-top', 'bottom', 'first-top', '#67c78f'],
  ['mid-top-cycle-top', 'mid-top', 'cycle-top', '#f3ae63'],
  ['bottom-ath', 'bottom', 'ath', '#5bcbd8'],
  ['cycle-top-bottom', 'cycle-top', 'bottom', '#c09be8'],
  ['first-top-cycle-top', 'first-top', 'cycle-top', '#f27781'],
  ['ath-cycle-top', 'ath', 'cycle-top', '#8bdbe4'],
  ['pit-stop-cycle-top', 'pit-stop', 'cycle-top', '#6d9dff'],
].map(([id, from, to, color]) => Object.freeze({ id, from, to, label: `${TYPES.get(from).label} → ${TYPES.get(to).label}`, color })));

/** Image annotations are attributed source claims, never model inputs or measured durations. */
export const MILESTONE_SOURCE_REFERENCE = Object.freeze({
  title: 'Insights from Bitcoin Halvings (v.3)', author: 'ilay_ / @ilay_vp',
  publishedAt: '2024-08-06T19:34:44Z', chartCapturedAt: '2024-08-06T22:33:00+03:00', instrument: 'Bitcoin Liquid Index · 1W · BNC',
  source: 'X 원문과 원문에 첨부된 TradingView 차트 이미지',
  url: 'https://x.com/ilay_vp/status/1820906371669168600',
  imageUrl: 'https://pbs.twimg.com/media/GUUooPxW4AAR1l9.jpg',
  cycles: Object.freeze(['2011–2013', '2015–2017', '2019–2021', '2022–2025']),
  periodClaims: Object.freeze({
    'bottom-bottom': Object.freeze(['214', '204', '204', '204']),
    'bottom-cycle-top': Object.freeze(['152', '152', '152', '152']),
    'bottom-first-top': Object.freeze(['122', '122', '122', '122']),
    'mid-top-cycle-top': Object.freeze(['124', '80', '124', '80']),
    'bottom-ath': Object.freeze(['113', '113', '104', '113']),
    'cycle-top-bottom': Object.freeze(['63 − 2', '50', '50', '50']),
    'first-top-cycle-top': Object.freeze(['30 + 2', '30', '30', '30']),
    'ath-cycle-top': Object.freeze(['38 + 2', '38 − 2', '47', '58 / 56 · 대안 38 + 1']),
    'pit-stop-cycle-top': Object.freeze(['13', '13 + 2', '13 − 2', '13 + 2']),
  }),
  unit: 'weeks', datesAreWeeklyLabels: true, usedForCalculation: false,
  note: '2024년 8월 원본의 2025·2026 표시는 당시 가정입니다. 원본 BLX 주봉과 이 앱의 Coin Metrics 일말 가격·기준점 정의는 달라 주 수가 일치하지 않을 수 있습니다. 원문의 ATH 기간은 Sustained ATH(돌파 후 유지)이며 앱의 첫 일말 돌파 ATH와 같지 않습니다. 원문 §3의 104 + 7~8 = 113은 산술오류입니다. 실제 합은 111~112주이며 113주에는 9주가 필요합니다. COVID의 7~8주 효과와 반복 주수는 인과관계·예측 법칙으로 입증되지 않은 가설입니다.',
});

const METHODS = Object.freeze({
  general: '가격선의 사후 기준점과 기간 비교입니다. 원본의 반복 주 수를 가격 모형에 강제하지 않습니다.',
  duration: '기간 = (종료 UTC 날짜 − 시작 UTC 날짜) / 7. 양 끝을 중복해 세지 않으며 윤년을 포함합니다.',
  'cycle-top': '과거: 2011·2013·2017·2021·2025년 최고 일말 가격. 2025년 및 아직 끝나지 않은 연도·사이클은 잠정 기준입니다.',
  bottom: '선택한 고점부터 다음 선택 고점까지의 최저 일말 가격. 최신 관측 저점은 후보이며 첫 관측일을 저점으로 만들지 않습니다.',
  'mid-top': '과거: 직전 저점 이후, 해당 상승 구간 반감기까지의 최고 일말 가격. 미래: 저점 후보부터 모형 고점 시계까지의 첫 1/3 구간 최고 예시 가격이며 반감기 예측이 아닙니다.',
  'first-top': '선택한 최종 고점 연도 전반기(1–6월)의 12% 하락 확인 고점 중 가장 높은 가격. 반감기·직전 고점 회복 뒤이며 최종 고점과 90일 이상 떨어져야 합니다. 날짜가 가장 이른 작은 고점이 아닌 전반기 주요 고점입니다.',
  'pit-stop': 'FIRST TOP 이후, 선택한 최종 고점 60–150일 전 구간의 마지막 12% 하락 확인 고점. 구간은 후반기 중간 고점 비교를 위한 사후 선택 규칙이며 원본의 13주를 강제하지 않습니다.',
  ath: '직전 선택 사이클 고점의 일말 가격을 저점 뒤 처음 초과한 날짜입니다. 모든 사상 최고가나 원본의 지속 ATH 가정과는 다른 명시적 기준입니다.',
  future: '미래는 선택한 예시 가격 경로를 근거리 모형의 고점·다음 저점 시계 안에서 같은 방식으로 사후 분류한 조건부 표식입니다. 장기 연말 가치평가 기준을 반복 사이클 고점으로 바꾸지 않습니다.',
});
const extreme = (rows, maximum = true) => rows.reduce((best, row) => !best || (maximum ? row.price > best.price : row.price < best.price) ? row : best, null);
const within = (rows, start, end) => rows.filter(row => row.date >= start && row.date <= end);

/**
 * @param {object|Array} input Validated daily observed prices, as in cycle-engine.
 * @param {object} options forecast is the already-selected model, never recomputed here.
 */
export function buildCycleMilestones(input, { forecast = null, asOf } = {}) {
  const validated = validateDataset(input);
  if (asOf !== undefined) utcDay(asOf);
  const rows = asOf === undefined ? validated : validated.filter(row => row.date <= asOf);
  if (!rows.length) throw new RangeError('No observed prices on or before asOf');
  const cutoff = rows.at(-1).date;
  const macro = getMacroCycles(rows);
  const pivots = detectDirectionalChanges(rows, { threshold: .12 }).pivots;
  const markersById = new Map(), intervals = [], cycles = [];
  let futureStatus = { available: false, through: null, reason: '미래 모형을 선택하면 근거리 사이클 기준을 표시합니다.' };

  function addMarker(type, row, cycleId, options = {}) {
    if (!row) return null;
    const kind = row.date > cutoff ? 'scenario' : 'observed', id = `${type}:${kind}:${row.date}`;
    if (markersById.has(id)) return markersById.get(id);
    const { label, color } = TYPES.get(type), selectionKind = options.selectionKind || kind;
    const marker = { id, type, label, color, date: row.date, price: row.price, kind, selectionKind,
      provisional: selectionKind === 'scenario' || kind === 'scenario' || Boolean(options.provisional), cycleId,
      definition: options.definition || METHODS[type], source: kind === 'scenario' ? '선택한 미래 가정' : 'Coin Metrics',
      selectionIsRetrospective: true, futureObservation: false,
      ...(options.confirmationDate ? { confirmationDate: options.confirmationDate } : {}),
      ...(options.windowStart ? { windowStart: options.windowStart, windowEnd: options.windowEnd } : {}),
      ...(options.selectionWindowComplete !== undefined ? { selectionWindowComplete: options.selectionWindowComplete, requestedWindowEnd: options.requestedWindowEnd } : {}),
    };
    markersById.set(id, marker);return marker;
  }

  function addIntervals(cycle) {
    for (const relation of INTERVAL_RELATIONS) {
      const from = relation.id === 'cycle-top-bottom' ? cycle.markers['cycle-top'] : cycle.markers[relation.from];
      const to = relation.to === 'bottom' ? cycle.markers['next-bottom'] : cycle.markers[relation.to];
      if (!from || !to || from.date >= to.date) continue;
      const days = utcDay(to.date) - utcDay(from.date);
      const kind = from.kind === to.kind ? from.kind : 'mixed';
      // Price provenance and selection provenance are independent: a future
      // cycle can select an already observed ATH or intermediate high.
      const selectionKind = cycle.kind === 'scenario' || from.selectionKind === 'scenario' || to.selectionKind === 'scenario' ? 'scenario' : 'observed';
      const partialWindow = from.selectionWindowComplete === false || to.selectionWindowComplete === false;
      intervals.push({ id: `${cycle.id}:${relation.id}`, relation: relation.id, fromId: from.id, toId: to.id,
        startDate: from.date, endDate: to.date, days, weeks: days / 7, label: relation.label, color: relation.color,
        kind, selectionKind, provisional: from.provisional || to.provisional || cycle.provisional,
        ...(partialWindow ? { selectionWindowComplete: false } : {}),
        cycleId: cycle.id, cycleLabel: cycle.label, from, to });
    }
    cycles.push({ ...cycle, markerIds: Object.values(cycle.markers).filter(Boolean).map(point => point.id) });
  }

  function fillLandmarks({ id, label, start, peak, end, previousPeak, selectedRows, selectedPivots, midpointEnd, firstEligibleDate, provisional = false, initial = false, isFuture = false, lowWindow = null }) {
    const markers = {};
    const mark = (type, row, options = {}) => addMarker(type, row, id, { ...options, selectionKind: isFuture ? 'scenario' : 'observed' });
    if (!initial) markers.bottom = mark('bottom', start, { provisional: isFuture ? Boolean(start.provisional) : false });
    markers['cycle-top'] = mark('cycle-top', peak, { provisional, definition: isFuture
      ? '모형 고점 시계까지의 선택한 미래 경로에서 가장 높은 예시 가격. 실제 미래 고점이나 모형 시계 날짜 적중을 뜻하지 않습니다.' : METHODS['cycle-top'] });
    markers['next-bottom'] = end && end.date > peak.date ? mark('bottom', end, { provisional,
      definition: isFuture ? lowWindow?.complete === false
        ? '선택한 예시 고점 이후 현재 경로 종료일까지의 부분 구간 최저 예시 가격입니다. 다음 저점 시계까지 경로가 없어 전체 구간의 BOTTOM으로 확정하지 않습니다.'
        : '선택한 예시 고점 이후 모형의 다음 저점 시계까지 가장 낮은 예시 가격. 확정된 미래 저점이 아닙니다.' : METHODS.bottom,
      ...(lowWindow ? { windowStart: peak.date, windowEnd: lowWindow.end, requestedWindowEnd: lowWindow.requestedEnd, selectionWindowComplete: lowWindow.complete } : {}),
    }) : null;
    const rising = within(selectedRows, start.date, peak.date);
    const reclaim = previousPeak ? rising.find(row => row.date > start.date && row.price > previousPeak.price) : null;
    if (reclaim) markers.ath = mark('ath', reclaim, { provisional: isFuture,
      definition: `${METHODS.ath} 비교 고점: ${previousPeak.date}, $${previousPeak.price}.` });
    if (!initial && midpointEnd && midpointEnd > start.date && midpointEnd < peak.date) {
      const mid = extreme(within(rising, start.date, midpointEnd));
      if (mid && mid.date > start.date && mid.date < peak.date) markers['mid-top'] = mark('mid-top', mid, {
        provisional: isFuture, definition: isFuture ? '저점 후보부터 모형 고점 시계까지 첫 1/3 구간에서 가장 높은 예시 가격. 이 구간 경계는 모형 가정이며 미래 반감기 날짜가 아닙니다.' : METHODS['mid-top'],
        windowStart: start.date, windowEnd: midpointEnd,
      });
    }
    const eligibleDate = firstEligibleDate && reclaim ? (firstEligibleDate > reclaim.date ? firstEligibleDate : reclaim.date) : reclaim?.date;
    const highs = selectedPivots.filter(point => point.type === 'high' && point.eventDate > start.date && point.eventDate < peak.date && point.confirmationDate <= peak.date);
    const firstHalfStart = `${peak.date.slice(0, 4)}-01-01`, firstHalfEnd = `${peak.date.slice(0, 4)}-06-30`;
    const first = eligibleDate ? highs.filter(point => point.eventDate >= eligibleDate && point.eventDate >= firstHalfStart && point.eventDate <= firstHalfEnd && utcDay(peak.date) - utcDay(point.eventDate) >= 90 && point.eventDate !== markers['mid-top']?.date).reduce((best, point) => !best || point.eventPrice > best.eventPrice ? point : best, null) : null;
    if (first) markers['first-top'] = mark('first-top', { date: first.eventDate, price: first.eventPrice },
      { provisional: provisional || isFuture, confirmationDate: first.confirmationDate });
    const pit = first ? highs.findLast(point => point.eventDate > first.eventDate && utcDay(peak.date) - utcDay(point.eventDate) >= 60 && utcDay(peak.date) - utcDay(point.eventDate) <= 150 && point.eventDate !== markers['mid-top']?.date) : null;
    if (pit) markers['pit-stop'] = mark('pit-stop', { date: pit.eventDate, price: pit.eventPrice },
      { provisional: provisional || isFuture, confirmationDate: pit.confirmationDate });
    addIntervals({ id, label, provisional, kind: isFuture ? 'scenario' : 'observed', markers,
      startDate: start.date, endDate: end?.date ?? peak.date,
      missingTypes: MILESTONE_TYPES.filter(type => !markers[type.id]).map(type => type.id) });
  }

  for (let index = 0; index < macro.cycles.length; index++) {
    const cycle = macro.cycles[index], previous = macro.cycles[index - 1];
    const halving = HALVINGS.find(event => event.date > cycle.start.date && event.date < cycle.peak.date);
    const provisional = cycle.peakYear === 2025 || !cycle.peakYearFullyObserved;
    fillLandmarks({ id: cycle.id, label: `${cycle.peakYear}년 사이클`, start: cycle.start, peak: cycle.peak,
      end: { ...cycle.end, provisional: cycle.endIsCandidate }, previousPeak: previous?.peak,
      selectedRows: rows, selectedPivots: pivots, midpointEnd: halving?.date,
      firstEligibleDate: halving?.date, provisional, initial: cycle.leftCensored });
    // A still-open ending trough is provisional independently of its peak year.
    const bottomId = `bottom:observed:${cycle.end.date}`;
    if (cycle.endIsCandidate && markersById.has(bottomId)) markersById.get(bottomId).provisional = true;
  }

  if (forecast) {
    if (forecast.asOf !== cutoff) throw new RangeError('forecast.asOf must match the observed cutoff');
    const clock = forecast.nominalClock || forecast.nearPhase?.nominalClock;
    const lastCycle = macro.cycles.at(-1);
    if (!clock?.effectivePeakDate || !clock?.nextLowDate || !lastCycle) {
      futureStatus.reason = '이 가정에는 분류할 근거리 사이클 시계가 없습니다. 장기 가치평가 기준은 사이클 고점이 아닙니다.';
    } else {
      const peakDay = utcDay(clock.effectivePeakDate), endDay = utcDay(clock.nextLowDate);
      if (peakDay <= utcDay(cutoff) || endDay <= peakDay) {
        futureStatus.reason = '근거리 사이클 시계가 관측 기준일 이전이거나 날짜 순서가 맞지 않아 미래 표식을 만들지 않습니다.';
      } else {
        const path = validateDataset(forecast.path);
        if (path[0].date !== cutoff || path[0].price !== rows.at(-1).price) throw new RangeError('Forecast anchor price and date must match the final observed price');
        const future = path.filter(point => point.date > cutoff && point.date <= clock.nextLowDate);
        const futureRows = [...rows, ...future];
        if (!future.length || future.at(-1).date < clock.effectivePeakDate) {
          futureStatus.reason = '선택한 예시 경로가 고점 시계까지 이어지지 않아 전체 근거리 사이클 기준을 계산할 수 없습니다.';
        } else {
          const start = { ...lastCycle.end, provisional: true };
          const rising = within(futureRows, start.date, clock.effectivePeakDate);
          const peak = extreme(rising);
          const end = extreme(within(futureRows, peak.date, clock.nextLowDate), false);
          if (peak.date <= cutoff) {
            futureStatus.reason = '선택한 가정의 근거리 상승 구간 최고값이 이미 관측된 가격입니다. 새로운 미래 CYCLE TOP을 만들지 않습니다.';
          } else {
            const midpoint = utcDay(start.date) + Math.floor((peakDay - utcDay(start.date)) / 3);
            const midpointEnd = new Date(midpoint * 86400000).toISOString().slice(0, 10);
            const completeWindow = future.at(-1).date >= clock.nextLowDate;
            fillLandmarks({ id: `scenario-${forecast.scenario?.id || 'selected'}-${clock.effectivePeakDate}`, label: `${clock.effectivePeakDate.slice(0, 4)}년 조건부 사이클`,
              start, peak, end, previousPeak: lastCycle.peak, selectedRows: futureRows,
              selectedPivots: detectDirectionalChanges(futureRows, { threshold: .12 }).pivots,
              midpointEnd, firstEligibleDate: midpointEnd, provisional: true, isFuture: true,
              lowWindow: { end: future.at(-1).date, requestedEnd: clock.nextLowDate, complete: completeWindow } });
            futureStatus = { available: true, through: future.at(-1).date, clockPeakDate: clock.effectivePeakDate,
              clockNextLowDate: clock.nextLowDate, completeWindow,
              reason: completeWindow
                ? '근거리 시계 안의 예시 가격 경로만 분류합니다. 이후 장기 구간에는 반복 사이클 고점·저점을 가정하지 않습니다.'
                : `미래 경로가 ${future.at(-1).date}에서 끝나 다음 저점 시계 ${clock.nextLowDate}까지의 구간은 미완료입니다. BOTTOM과 연결 기간은 현재 경로 안의 부분 구간 후보입니다. 이후 반복 사이클은 만들지 않습니다.` };
          }
        }
      }
    }
  }
  // Endpoint candidate flags can be established when a later cycle reuses that
  // bottom. Propagate final flags after all references have been linked.
  for (const interval of intervals) interval.provisional = Boolean(interval.provisional || interval.from.provisional || interval.to.provisional);
  const order = new Map(MILESTONE_TYPES.map((type, index) => [type.id, index]));
  const markers = [...markersById.values()].sort((a, b) => a.date.localeCompare(b.date) || order.get(a.type) - order.get(b.type));
  return { asOf: cutoff, markers, intervals, cycles, futureStatus, sourceReference: MILESTONE_SOURCE_REFERENCE, methodology: METHODS };
}
