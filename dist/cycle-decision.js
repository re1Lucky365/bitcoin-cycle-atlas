import { utcDay, validateDataset } from './cycle-engine.js?v=1.19.0';

/** Read-only interpretation of the chart's exact points, never another forecast. */
export const CYCLE_DECISION_VERSION = 'cycle-checkpoints-v1';
export const CYCLE_ACTIONS = Object.freeze({
  'strong-buy': Object.freeze({ id: 'strong-buy', label: '적극 매수 검토', strength: 'strong' }),
  buy: Object.freeze({ id: 'buy', label: '매수 검토', strength: 'standard' }),
  sideways: Object.freeze({ id: 'sideways', label: '횡보·관찰', strength: 'none' }),
  sell: Object.freeze({ id: 'sell', label: '매도 검토', strength: 'standard' }),
  'strong-sell': Object.freeze({ id: 'strong-sell', label: '적극 매도 검토', strength: 'strong' }),
  unavailable: Object.freeze({ id: 'unavailable', label: '판단 보류', strength: 'none' }),
});
const POINT_LABELS = Object.freeze({ bottom: '저점', 'cycle-top': '사이클 고점', 'mid-top': '중간 고점', 'first-top': '전반기 고점', 'pit-stop': '후반기 중간 고점', ath: '직전 사이클 고점 회복' });
const METHOD = Object.freeze({
  version: CYCLE_DECISION_VERSION,
  purpose: '고점·저점 행은 차트의 기준 지점에 도착했을 때 살펴볼 계획 단계이고, 횡보 행은 가격 조건이 이어진 기간입니다. 과거 고점·저점은 사후 복기이며 당시 실행 가능한 신호나 검증된 매매 전략이 아닙니다.',
  timing: '4년·3년 상승·1년 하락은 비교 가설입니다. 실제 기준점 사이의 UTC 경과 일수를 쓰며 고정된 반복 주기를 강제하지 않습니다.',
  actions: '저점은 매수, 직전 사이클 고점 회복은 매수, 중간·전반기·후반기 고점은 매도 검토 지점입니다. 이전 기준점과 가격 방향이 맞는 완료된 저점·고점만 검토 강도를 높입니다.',
  strength: '적극은 기준점에서 검토할 우선순위입니다. 수익 확률, 투자 비중, 주문 지시를 뜻하지 않습니다. 잠정 관측과 미완료 미래 창은 강도를 높이지 않습니다.',
  current: '현재 횡보는 연속된 28개 일말 가격의 고가/저가−1이 12% 이하이고 첫날 대비 등락 절댓값이 6% 이하일 때만 표시합니다. 그 밖에는 주기만으로 매매 방향을 정하지 않고 판단을 보류합니다. 12%·6%는 설명을 위한 운영 기준이며 최적 수익 기준으로 검증하지 않았습니다.',
  sidewaysPeriods: '횡보 구간은 같은 28개 가격 조건을 연속 7개 이상 일말 관측에서 충족한 날짜들을 묶습니다. 시작은 처음 조건을 충족한 날짜이며 28일 전으로 소급하지 않습니다. 7번째 충족일에 표시 요건이 갖춰집니다. 각 날짜의 이동 창 조건이므로 전체 구간의 가격 변화와는 다릅니다. 7개 유지 기준은 짧은 깜빡임을 줄이는 표시 규칙이며 수익성을 최적화한 값이 아닙니다. 미래 횡보는 차트의 근거리 가정 범위 안에서만 계산합니다.',
  risk: '수익률과 최대낙폭은 각 행에 표시된 시작일부터 종료일까지의 실제 일말 가격으로 계산합니다. 기준점 행은 이전 기준점부터 도착 지점까지, 횡보 행은 조건 충족 시작부터 마지막 충족일까지입니다. MDD는 그 구간 안에서 먼저 나온 고점 대비 이후 저점의 최대 하락률입니다. 결측을 보간하지 않으며 미래 행에는 실현 수익률·MDD를 표시하지 않습니다.',
  provenance: '과거 사후 기준, 잠정 관측, 미래 가정, 현재 관측을 구별합니다. 선택한 미래 경로의 지점을 관측된 고점·저점으로 승격하지 않습니다.',
});
const action = (id, reason, scope = 'end-marker') => ({ ...CYCLE_ACTIONS[id], reason, scope });
const percentage = (price, base) => {
  const ratio = price / base;
  if (!Number.isFinite(ratio) || ratio <= 0) throw new RangeError('Cycle checkpoint price ratio exceeds the positive finite numeric range');
  const result = (ratio - 1) * 100;
  if (!Number.isFinite(result)) throw new RangeError('Cycle checkpoint price ratio exceeds the finite numeric range');
  return result;
};
const blankRisk = () => ({ returnPct: null, mddPct: null, mddPeakDate: null, mddTroughDate: null, observationCount: 0, coverageComplete: false });

function observedRisk(rows, indices, start, end) {
  if (start === end) return { ...blankRisk(), observationCount: indices.has(end) ? 1 : 0 };
  const first = indices.get(start), last = indices.get(end);
  if (first === undefined || last === undefined || first > last) return blankRisk();
  let peak = rows[first], worstPeak = peak, trough = peak, mdd = 0;
  for (let index = first; index <= last; index++) {
    const row = rows[index];
    if (row.price > peak.price) peak = row;
    const drawdown = percentage(row.price, peak.price);
    if (drawdown < mdd) { mdd = drawdown; worstPeak = peak; trough = row; }
  }
  const observationCount = last - first + 1;
  return {
    returnPct: percentage(rows[last].price, rows[first].price), mddPct: mdd,
    mddPeakDate: worstPeak.date, mddTroughDate: trough.date, observationCount,
    coverageComplete: observationCount === utcDay(end) - utcDay(start) + 1,
  };
}

function checkpointAction(marker, previous, { scenario, provisional, completeWindow }) {
  const descending = previous && marker.price < previous.price;
  const ascending = previous && marker.price > previous.price;
  const strongEligible = !provisional && !scenario || scenario && completeWindow;
  const prefix = scenario ? '가정 경로의 ' : provisional ? '잠정 ' : '사후로 확인한 ';
  if (marker.type === 'bottom') return action(strongEligible && descending ? 'strong-buy' : 'buy', `${prefix}저점에서 분할 매수를 검토하는 계획 지점입니다.${provisional && !scenario ? ' 저점 후보이므로 적극 단계로 높이지 않습니다.' : ''}`);
  if (marker.type === 'cycle-top') return action(strongEligible && ascending ? 'strong-sell' : 'sell', `${prefix}사이클 고점에서 이익 실현과 비중 축소를 검토하는 계획 지점입니다.${provisional && !scenario ? ' 고점 후보이므로 적극 단계로 높이지 않습니다.' : ''}`);
  if (marker.type === 'ath') return action('buy', `${prefix}직전 사이클 고점 회복을 확인하는 지점입니다. 이후 상승이 보장되는 것은 아닙니다.`);
  return action('sell', `${prefix}${POINT_LABELS[marker.type]}에서 이익 실현을 검토합니다. 중간 고점을 최종 사이클 고점으로 간주하지 않습니다.`);
}

/** A causal description of the latest 28 closes, independent of all cycle points. */
function currentObservation(rows, indices, previous) {
  const last = rows.at(-1), recent = rows.slice(-28);
  const complete = recent.length === 28 && last.epochDay - recent[0].epochDay === 27;
  const high = Math.max(...recent.map(row => row.price)), low = Math.min(...recent.map(row => row.price));
  const range28dPct = complete ? percentage(high, low) : null;
  const change28dPct = complete ? percentage(last.price, recent[0].price) : null;
  const sideways = complete && range28dPct <= 12 + 1e-10 && Math.abs(change28dPct) <= 6 + 1e-10;
  const reason = sideways
    ? '최근 28개 연속 일말 가격이 폭 12%·등락 ±6% 범위에 있어 횡보·관찰 조건입니다. 이후 방향은 확정하지 않습니다.'
    : complete ? '최근 가격이 횡보 조건을 충족하지 않습니다. 진행 중인 구간은 주기만으로 매수·매도 단계를 확정하지 않습니다.'
      : '연속된 28일 관측이 없어 횡보 여부를 판단할 수 없습니다. 결측을 중립이나 매매 신호로 바꾸지 않습니다.';
  const startDate = previous?.date ?? rows[0].date, days = last.epochDay - utcDay(startDate);
  const risk = observedRisk(rows, indices, startDate, last.date);
  return {
    id: `current:${last.date}`, cycleId: 'current', cycleLabel: '현재 관측',
    date: last.date, startDate, endDate: last.date, days, weeks: days / 7,
    phaseId: 'current', phaseLabel: sideways ? '현재 횡보 조건' : '현재 진행 구간', fromLabel: previous ? POINT_LABELS[previous.type] : '첫 관측',
    action: action(sideways ? 'sideways' : 'unavailable', reason, 'as-of'),
    kind: 'observed', evidenceKind: 'current', provisional: true, current: true,
    startPrice: rows[indices.get(startDate)].price, endPrice: last.price,
    ...risk, range28dPct, change28dPct,
    rangeWindowStart: complete ? recent[0].date : null, rangeWindowEnd: last.date,
    markerIds: [], chart: { markerId: null, intervalId: null, startDate, endDate: last.date },
    reason, basis: '현재까지의 일말 가격만 사용 · 진행 구간', selectionIsRetrospective: false,
    note: days > 0 && !risk.coverageComplete ? '관측 누락이 있는 구간 · 수익률·최대낙폭은 확보된 일말 가격만 기준' : '',
  };
}

/** Group causal qualifying END dates; never backdate a run to its lookback. */
function sidewaysRuns(input, { firstEligibleDate = null } = {}) {
  const runs = [];
  let run = null;
  const finish = rightCensored => {
    if (run?.qualifyingObservations >= 7) runs.push({ ...run, rightCensored });
    run = null;
  };
  for (let index = 27; index < input.length; index++) {
    const point = input[index], first = input[index - 27];
    if (firstEligibleDate && point.date < firstEligibleDate) continue;
    const contiguous = point.epochDay - first.epochDay === 27;
    let range = null, change = null;
    if (contiguous) {
      let high = first.price, low = first.price;
      for (let offset = index - 26; offset <= index; offset++) {
        high = Math.max(high, input[offset].price); low = Math.min(low, input[offset].price);
      }
      range = percentage(high, low); change = percentage(point.price, first.price);
    }
    const qualifies = contiguous && range <= 12 + 1e-10 && Math.abs(change) <= 6 + 1e-10;
    if (!qualifies) { finish(!contiguous); continue; }
    if (run && point.epochDay - run.last.epochDay !== 1) finish(true);
    if (!run) run = { first: point, last: point, lookbackStart: first.date, qualifyingObservations: 0, minimumRunKnownAt: null };
    run.last = point; run.qualifyingObservations++;
    run.range28dPct = range; run.change28dPct = change;
    if (run.qualifyingObservations === 7) run.minimumRunKnownAt = point.date;
  }
  finish(true);
  return runs;
}

function rangeRow(run, { rows, indices, cutoff, cycles, scenario = false, scenarioId = null }) {
  const startDate = run.first.date, endDate = run.last.date;
  const days = run.last.epochDay - run.first.epochDay;
  const eligible = cycles.filter(cycle => (cycle.kind === 'scenario') === scenario);
  const memberships = eligible.filter(cycle => cycle.startDate <= endDate && cycle.endDate >= startDate);
  const owner = memberships.at(-1) || (scenario ? eligible.at(-1) : null);
  const reason = `${scenario ? '선택한 가정 경로에서 ' : ''}직전 28개 가격의 폭 12%·등락 ±6% 조건이 ${run.qualifyingObservations}개 일말 관측에서 연속 충족됩니다. 매매 방향은 확정하지 않습니다.`;
  const risk = !scenario ? observedRisk(rows, indices, startDate, endDate) : blankRisk();
  return {
    id: `${scenario ? 'scenario' : 'observed'}:range:${startDate}:${endDate}`,
    cycleId: owner?.id || 'current', cycleIds: memberships.length ? memberships.map(cycle => cycle.id) : [owner?.id || 'current'],
    cycleLabel: owner?.label || '관측된 횡보 구간',
    date: endDate, startDate, endDate, days, weeks: days / 7,
    phaseId: 'range', phaseLabel: scenario ? '횡보 가정' : '횡보 조건 구간', fromLabel: '조건 충족 시작',
    action: action('sideways', reason, 'period'),
    kind: scenario ? run.lookbackStart <= cutoff ? 'mixed' : 'scenario' : 'observed',
    evidenceKind: scenario ? 'scenario' : 'observed-period',
    evidenceLabel: scenario ? '미래 가정 · 횡보 조건' : run.rightCensored ? '관측 · 횡보 조건 진행 중' : '관측 · 횡보 조건',
    provisional: scenario || run.rightCensored, current: false,
    startPrice: run.first.price, endPrice: run.last.price,
    ...risk,
    qualifyingObservations: run.qualifyingObservations, minimumRunObservations: 7, minimumRunKnownAt: run.minimumRunKnownAt,
    range28dPct: run.range28dPct, change28dPct: run.change28dPct,
    rangeWindowStart: run.lookbackStart, rangeWindowEnd: endDate, rightCensored: run.rightCensored,
    markerIds: [], chart: { markerId: null, intervalId: null, startDate, endDate },
    reason, basis: scenario ? '미래 가정 · 같은 가격 조건이 이어지는 구간' : '각 날짜까지 실제로 관측된 가격 조건',
    selectionIsRetrospective: false, scenarioId: scenario ? scenarioId : null,
    note: `각 날짜의 직전 28개 가격 조건 · 7번째 충족일 ${run.minimumRunKnownAt}부터 표시 요건 성립${run.rightCensored ? ' · 자료 종료 또는 결측으로 끝을 확정하지 않음' : ''}`,
  };
}

/**
 * Consume the exact selected chart annotations. Prices are observed daily BTC
 * prices; the optional forecast is checked for identity but never fitted here.
 * Checkpoint review applies to its END point, not its preceding return.
 * Sideways rows describe the displayed period of qualifying observations.
 */
export function buildCycleDecisionTable({ prices, milestones, forecast = null, asOf } = {}) {
  const validated = validateDataset(prices);
  if (asOf !== undefined) utcDay(asOf);
  const rows = asOf === undefined ? validated : validated.filter(row => row.date <= asOf);
  if (!rows.length) throw new RangeError('No observed prices on or before asOf');
  const cutoff = rows.at(-1).date;
  if (!milestones || milestones.asOf !== cutoff || !Array.isArray(milestones.markers) || !Array.isArray(milestones.cycles)) {
    throw new TypeError('Chart milestones must match the observed cutoff');
  }
  if (forecast && forecast.asOf !== cutoff) throw new RangeError('Selected forecast must match the observed cutoff');
  if (!forecast && milestones.markers.some(marker => marker.kind === 'scenario')) throw new RangeError('Future checkpoints require the selected forecast path');
  const byDate = new Map(rows.map(row => [row.date, row.price])), indices = new Map(rows.map((row, index) => [row.date, index]));
  let futurePrices = null, selectedPath = null;
  if (forecast) {
    const path = validateDataset(forecast.path);
    if (path[0].date !== cutoff || path[0].price !== rows.at(-1).price) throw new RangeError('Selected forecast anchor does not match observed prices');
    futurePrices = new Map(path.map(row => [row.date, row.price]));
    selectedPath = path;
  }
  const byId = new Map();
  for (const marker of milestones.markers) {
    utcDay(marker.date);
    if (!POINT_LABELS[marker.type] || !marker.id || byId.has(marker.id) || !Number.isFinite(marker.price) || marker.price <= 0) throw new TypeError('Invalid or duplicated chart checkpoint');
    if (marker.kind === 'observed') {
      if (marker.date > cutoff || byDate.get(marker.date) !== marker.price) throw new RangeError('Observed checkpoint must use the exact observed price');
    } else if (marker.kind !== 'scenario' || marker.date <= cutoff || futurePrices && futurePrices.get(marker.date) !== marker.price) {
      throw new RangeError('Future checkpoint must belong to the selected scenario path');
    }
    byId.set(marker.id, marker);
  }
  const cycleRows = milestones.cycles.map(cycle => ({
    id: cycle.id, label: cycle.label, kind: cycle.kind, provisional: Boolean(cycle.provisional),
    startDate: cycle.startDate, endDate: cycle.endDate,
  }));
  const owners = new Map(), membership = new Map();
  for (const cycle of milestones.cycles) {
    for (const marker of Object.values(cycle.markers).filter(Boolean)) {
      if (!membership.has(marker.id)) membership.set(marker.id, new Set());
      membership.get(marker.id).add(cycle.id);
    }
  }
  for (const cycle of milestones.cycles.filter(cycle => cycle.kind !== 'scenario')) {
    for (const marker of Object.values(cycle.markers).filter(Boolean)) if (!owners.has(marker.id)) owners.set(marker.id, cycle);
    // A shared bottom opens the next cycle as well as closing the previous one.
    if (cycle.markers.bottom) owners.set(cycle.markers.bottom.id, cycle);
  }
  const result = [];
  const makeRow = (marker, previous, cycle, scenario = false) => {
    const startDate = previous?.date ?? marker.date, endDate = marker.date;
    const days = utcDay(endDate) - utcDay(startDate);
    // The review applies to the destination point. A completed opening bottom
    // does not become provisional merely because its following cycle is open.
    const provisional = Boolean(marker.provisional || marker.selectionWindowComplete === false || scenario);
    const completeWindow = marker.selectionWindowComplete !== false && milestones.futureStatus?.completeWindow === true;
    const evidenceKind = scenario ? 'scenario' : provisional ? 'provisional' : 'retrospective';
    const interval = (milestones.intervals ?? []).find(item => item.fromId === previous?.id && item.toId === marker.id && Boolean(item.selectionKind === 'scenario' || item.kind !== 'observed') === scenario);
    const step = checkpointAction(marker, previous, { scenario, provisional, completeWindow });
    const basis = scenario ? marker.date <= cutoff ? '관측 가격 · 미래 가정이 선택한 역할' : '미래 가정 · 선택한 경로의 조건부 지점' : provisional ? '관측 가격 · 잠정 기준점' : '실제 관측 · 사후 기준점';
    const risk = scenario ? blankRisk() : observedRisk(rows, indices, startDate, endDate);
    return {
      id: scenario ? `${cycle.id}:${marker.id}` : `observed:${marker.id}`,
      cycleId: cycle?.id ?? marker.cycleId, cycleLabel: cycle?.label ?? '과거 사이클',
      cycleIds: scenario ? [cycle.id] : [...(membership.get(marker.id) || [])].filter(id => milestones.cycles.find(item => item.id === id)?.kind !== 'scenario'),
      date: endDate, startDate, endDate, days, weeks: days / 7,
      phaseId: marker.type, phaseLabel: POINT_LABELS[marker.type], fromLabel: previous ? POINT_LABELS[previous.type] : null,
      action: step, kind: scenario ? marker.date <= cutoff ? 'observed' : startDate <= cutoff ? 'mixed' : 'scenario' : 'observed',
      evidenceKind, provisional, current: false, startPrice: previous?.price ?? marker.price, endPrice: marker.price,
      ...risk,
      markerIds: [...new Set([previous?.id, marker.id].filter(Boolean))],
      chart: { markerId: marker.id, intervalId: interval?.id ?? null, startDate, endDate },
      reason: step.reason, basis, selectionIsRetrospective: true,
      note: !scenario && days > 0 && !risk.coverageComplete ? '관측 누락이 있는 구간 · 수익률·최대낙폭은 확보된 일말 가격만 기준' : '',
      scenarioWindowComplete: scenario ? completeWindow : null,
      scenarioId: scenario ? forecast?.scenario?.id ?? null : null,
    };
  };
  const observed = milestones.markers.filter(marker => marker.kind === 'observed' && marker.selectionKind !== 'scenario').sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  observed.forEach((marker, index) => result.push(makeRow(marker, observed[index - 1], owners.get(marker.id))));
  const current = currentObservation(rows, indices, observed.at(-1));
  result.push(current);
  for (const cycle of milestones.cycles.filter(cycle => cycle.kind === 'scenario')) {
    const points = [...new Map(Object.values(cycle.markers).filter(Boolean).map(marker => [marker.id, byId.get(marker.id)])).values()];
    if (points.some(point => !point)) throw new RangeError('Scenario references an unknown chart checkpoint');
    points.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    points.forEach((marker, index) => {
      if (marker.date > cutoff || marker.selectionKind === 'scenario') result.push(makeRow(marker, points[index - 1], cycle, true));
    });
  }
  for (const run of sidewaysRuns(rows)) result.push(rangeRow(run, { rows, indices, cutoff, cycles: cycleRows }));
  const futureEnd = milestones.futureStatus?.through;
  if (selectedPath && futureEnd && milestones.futureStatus.available === true) {
    utcDay(futureEnd);
    const future = selectedPath.filter(point => point.date > cutoff && point.date <= futureEnd);
    if (future.length) {
      // Only 27 observed warm-up closes are needed. The observed and future
      // runs are split at the cutoff, so a forecast cannot extend real results.
      const combined = [...rows.slice(-27), ...future];
      for (const run of sidewaysRuns(combined, { firstEligibleDate: future[0].date })) {
        result.push(rangeRow(run, { rows, indices, cutoff, cycles: cycleRows, scenario: true, scenarioId: forecast?.scenario?.id ?? null }));
      }
    }
  }
  result.sort((a, b) => Number(a.evidenceKind === 'scenario') - Number(b.evidenceKind === 'scenario') || a.endDate.localeCompare(b.endDate) || Number(a.current) - Number(b.current) || a.id.localeCompare(b.id));
  return { asOf: cutoff, version: CYCLE_DECISION_VERSION, rows: result, cycles: cycleRows, current, methodology: METHOD, futureStatus: milestones.futureStatus ?? null };
}
