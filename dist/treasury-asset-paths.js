import { utcDay, dateFromDay } from './cycle-engine.js?v=1.19.0';
import { buildLongHorizonForecasts } from "./long-horizon-forecast.js?v=1.21.0";
import { LONG_HORIZON_REVIEW_DATE } from './long-horizon-evidence.js?v=1.11.0';

const SCENARIOS = ['stress', 'base', 'bull'];
const BTC_SCENARIOS = { stress: 'stress', base: 'base', bull: 'accelerated' };
const ETH_SOURCE_IDS = ['model-eth-valuation', 'bmnr-model-method', 'eth-merge-eip-3675'];
const ETH_TARGET_DATE = '2030-12-31';
const ETH_SOURCE_DATE = '2024-06-05';
const CLOCK_WARNING = '코인 기준은 같은 날짜의 UTC 일말 관측이며 뉴욕 주식 종가와 동시 체결된 가격이 아닙니다. 주식 기준일 이후의 코인 관측은 사용하지 않습니다.';
const RANGE_WARNING = '세 조건은 서로 다른 경제·재무 가정입니다. 대표 경로와 조건 범위는 확률 예측·분위수·가능한 손실의 전체 범위가 아닙니다.';

export const TREASURY_ASSET_PATH_DEFAULTS = Object.freeze({
  seed: 20261022, endYear: 2035, blockDays: 28, volatilityWindowDays: 90,
  minimumEthObservations: 366, ethHistoryStart: '2022-09-15', residualHalfLifeDays: 730,
});

function positive(value, label) {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${label} must be positive and finite`);
  return value;
}

function dailyRows(history, asset, asOf) {
  if (asset === 'ETH' && history && !Array.isArray(history)) {
    if (history.product !== undefined && history.product !== 'ETH-USD') throw new TypeError('ETH history must be ETH-USD');
    if (history.dailyHistory && (history.source !== 'Coinbase Exchange' || history.product !== 'ETH-USD' || history.dailyHistory.source !== 'Coinbase Exchange' || history.dailyHistory.product !== 'ETH-USD' || history.dailyHistory.completedOnly !== true)) {
      throw new TypeError('ETH archive must contain completed Coinbase ETH-USD daily observations');
    }
    if (history.completedOnly === false) throw new TypeError('ETH history must contain completed daily observations');
  }
  const raw = Array.isArray(history) ? history : asset === 'BTC' ? history?.prices : history?.dailyHistory?.candles ?? history?.candles;
  if (!Array.isArray(raw) || !raw.length) throw new TypeError(`${asset} completed daily history is required`);
  const rows = [];
  let prior = null;
  for (let index = 0; index < raw.length; index++) {
    const row = raw[index], label = Array.isArray(row) ? row[0] : row?.date;
    if (typeof label !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T00:00:00(?:\.000)?Z)?$/.test(label)) throw new TypeError('Daily history requires ISO dates or UTC midnight labels');
    const date = label.slice(0, 10), epochDay = utcDay(date);
    if (prior !== null && epochDay <= prior) throw new RangeError('Daily history must be strictly chronological without duplicates');
    prior = epochDay;
    if (date > asOf) continue;
    if (!Array.isArray(row) && row.time !== undefined && row.time !== epochDay * 86400) throw new RangeError('Daily history timestamp conflicts with its date');
    const price = positive(Array.isArray(row) ? row[1] : row.close ?? row.price, `${asset} observed close`);
    rows.push({ date, price, epochDay });
  }
  if (rows.at(-1)?.date !== asOf) throw new RangeError(`${asset} requires an observed close on the exact equity asOf date`);
  return rows;
}

function stats(values) {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return { mean, sd: Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1)) };
}

function randomGenerator(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function bitcoinPaths(rows, asOf, endDate, seed) {
  const researchAsOf = asOf < LONG_HORIZON_REVIEW_DATE ? asOf : LONG_HORIZON_REVIEW_DATE;
  const source = { prices: rows.map(row => [row.date, row.price]) };
  const scenarios = {};
  const models = buildLongHorizonForecasts(source, { asOf, seed, scenarios: SCENARIOS.map(id => BTC_SCENARIOS[id]), researchAsOf });
  for (const id of SCENARIOS) {
    const model = models[BTC_SCENARIOS[id]];
    if (model.displayEnd < endDate) throw new RangeError('BTC source horizon does not cover the requested treasury horizon');
    const sourceIds = [...model.longHorizon.assumptions.valuationSourceIds.map(value => `long-${value}`), 'mstr-model-method'];
    const path = model.path.filter(point => point.date <= endDate).map(point => ({
      date: point.date, price: point.price, baselinePrice: point.baselinePrice,
      kind: point.date === asOf ? 'observed-anchor' : 'conditional-asset-path', sourceIds,
    }));
    scenarios[id] = {
      id, asset: 'BTC', asOf, endDate, path, sourceIds, method: 'btc-shared-long-horizon-engine',
      anchors: model.events.map(event => ({ date: event.date, price: event.price, sourceIds: [`long-${event.sourceId}`], origin: event.valuationOrigin })),
      training: { ...model.training, maxSourceDate: asOf, researchAsOf },
      metadata: {
        engine: model.version, engineScenario: model.scenario.id, seed, sampleCount: 1,
        shortTermSourceEnsembleCount: model.assumptions.shortTermSourceEnsembleCount,
        representativeRule: model.assumptions.representativeRule,
        sourceDisplayEnd: model.displayEnd, displayedPathIsExactEnginePrefix: true,
        repeatedFourYearWaves: false, cycleComponent: model.longHorizon.cycleDecay,
        targetPricesAreBaselineConditions: true, terminalPriceForced: false,
        managementTargetAppliedToPath: false, historicalVintageBacktest: false,
        probability: null, calibrated: false, ohlcClaim: false,
      },
      warnings: [...model.warnings, CLOCK_WARNING, 'MSTR 연동 경로는 BTC 화면의 같은 조건·seed 경로입니다. 세일러의 별도 목표 가격을 이 경로에 강제로 맞추지 않습니다.'],
    };
  }
  return scenarios;
}

function ethereumPaths(allRows, asOf, endDate, seed) {
  if (asOf < ETH_SOURCE_DATE) throw new RangeError('ETH valuation conditions were not published at the observation cutoff');
  if (asOf >= ETH_TARGET_DATE) throw new RangeError('ETH valuation conditions have expired and require a new reviewed source');
  const settings = TREASURY_ASSET_PATH_DEFAULTS;
  const rows = allRows.filter(row => row.date >= settings.ethHistoryStart);
  if (rows.length < settings.minimumEthObservations) throw new RangeError('ETH requires at least 366 post-Merge completed daily observations');
  for (let index = 1; index < rows.length; index++) {
    if (rows[index].epochDay !== rows[index - 1].epochDay + 1) throw new RangeError('ETH post-Merge history must be consecutive; missing dates are not interpolated');
  }
  const returns = rows.slice(1).map((row, index) => Math.log(row.price / rows[index].price));
  const sourceStats = stats(returns), recent = stats(returns.slice(-settings.volatilityWindowDays));
  if (!(sourceStats.sd > 1e-9 && recent.sd > 1e-9)) throw new RangeError('ETH history requires positive realized return variation');
  const current = rows.at(-1), horizonDays = utcDay(endDate) - current.epochDay;
  const targetDays = utcDay(ETH_TARGET_DATE) - current.epochDay;
  const targets = { stress: 360, base: current.price, bull: 22000 };
  const random = randomGenerator((seed ^ 0x455448) >>> 0);
  const persistence = Math.exp(-Math.LN2 / settings.residualHalfLifeDays);
  const blocks = [], residuals = [0];
  let residual = 0, blockStart = 0, blockOffset = settings.blockDays;
  for (let index = 1; index <= horizonDays; index++) {
    if (blockOffset === settings.blockDays) {
      blockStart = Math.floor(random() * (returns.length - settings.blockDays + 1));
      blockOffset = 0;
      const used = Math.min(settings.blockDays, horizonDays - index + 1);
      blocks.push({
        sourceStartDate: rows[blockStart].date, sourceReturnStartDate: rows[blockStart + 1].date,
        sourceEndDate: rows[blockStart + used].date, targetStartDate: dateFromDay(current.epochDay + index),
        targetEndDate: dateFromDay(current.epochDay + index + used - 1), days: used,
      });
    }
    const innovation = (returns[blockStart + blockOffset++] - sourceStats.mean) / sourceStats.sd;
    residual = persistence * residual + innovation * recent.sd;
    residuals.push(residual);
  }
  const training = {
    firstObservation: rows[0].date, informationThrough: asOf, maxSourceDate: asOf,
    observations: rows.length, excludedPreMergeObservations: allRows.length - rows.length,
    sourceReturnStartDate: rows[1].date, sourceReturnCount: returns.length,
    sourceDailyLogMean: sourceStats.mean, sourceDailyLogSd: sourceStats.sd,
    recentDailyLogSd: recent.sd, volatilityWindowDays: settings.volatilityWindowDays,
    representativeBlocks: blocks, sourceBlockEndpointsAtOrBeforeAsOf: true,
    overlappingBlocksAreIndependent: false, historicalForecastAccuracyClaim: false,
    researchAsOf: ETH_SOURCE_DATE,
  };
  return Object.fromEntries(SCENARIOS.map(id => {
    const priceTarget = targets[id];
    const path = residuals.map((residualLog, index) => {
      const fraction = Math.min(1, index / targetDays);
      const baselinePrice = index ? positive(Math.exp(Math.log(current.price) + fraction * Math.log(priceTarget / current.price)), 'ETH baseline price') : current.price;
      const price = index ? positive(baselinePrice * Math.exp(residualLog), 'ETH simulated price') : current.price;
      return { date: dateFromDay(current.epochDay + index), price, baselinePrice, kind: index ? 'conditional-asset-path' : 'observed-anchor', sourceIds: ETH_SOURCE_IDS };
    });
    return [id, {
      id, asset: 'ETH', asOf, endDate, path, sourceIds: ETH_SOURCE_IDS, method: 'eth-post-merge-historical-blocks',
      anchors: [{ date: ETH_TARGET_DATE, price: priceTarget, sourceIds: id === 'base' ? ['bmnr-model-method'] : ['model-eth-valuation'], origin: id === 'base' ? 'analyst-flat-price' : 'published-valuation-condition' }],
      training,
      metadata: {
        seed, sampleCount: 1, blockDays: settings.blockDays, repeatedFourYearWaves: false,
        representativeRule: 'One seeded post-Merge historical-block residual path shared by the three economic conditions.',
        historicalDriftExtrapolated: false, baselineAfter2030: 'flat',
        recentAnnualizedVolatilityPct: recent.sd * Math.sqrt(365) * 100,
        futureInnovationScale: 'Latest 90-day realized daily log-return standard deviation held constant; not an estimated future volatility forecast.',
        residualHalfLifeDays: settings.residualHalfLifeDays, residualMeanReversionEstimated: false,
        residualFormula: 'R[t] = exp(-ln(2)/730) * R[t-1] + standardized historical block return * latest 90-day daily sigma',
        targetPricesAreBaselineConditions: true, terminalPriceForced: false,
        historicalVintageBacktest: false, probability: null, calibrated: false, ohlcClaim: false,
      },
      warnings: [
        'ETH 경로는 Merge 이후 과거 수익률 블록으로 만든 조건부 예시입니다. BTC의 4년 주기를 적용하지 않습니다.',
        '2030년 $360·$22,000은 외부 평가 조건이며, 현재 가격 유지는 앱 가정입니다. 2030년 이후 기준선 유지도 앱 가정입니다.',
        '최근 90일 변동성의 미래 유지와 잔차의 730일 반감 평균회귀는 검증된 예측 계수가 아닙니다.',
        '과거 블록의 중복 추출은 독립적인 시장 사례를 늘리지 않습니다. 세 경제 조건에는 같은 예시 잔차를 사용합니다.',
        '일별 모의 가격은 실제 미래 시가·고가·저가·종가를 제공하지 않습니다.', CLOCK_WARNING,
      ],
    }];
  }));
}

export function buildTreasuryAssetPaths({ symbol, btcHistory, ethHistory, asOf, endYear = TREASURY_ASSET_PATH_DEFAULTS.endYear, seed = TREASURY_ASSET_PATH_DEFAULTS.seed } = {}) {
  if (!['MSTR', 'BMNR'].includes(symbol)) throw new RangeError('Treasury asset paths require MSTR or BMNR');
  utcDay(asOf);
  if (!Number.isSafeInteger(endYear) || endYear < 2027 || endYear > 2050) throw new RangeError('Treasury asset horizon must be 2027–2050');
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 4294967295) throw new RangeError('seed must be an unsigned 32-bit integer');
  const endDate = `${endYear}-12-31`;
  if (asOf >= endDate) throw new RangeError('Treasury asset horizon must follow its observation cutoff');
  const asset = symbol === 'MSTR' ? 'BTC' : 'ETH';
  const rows = dailyRows(asset === 'BTC' ? btcHistory : ethHistory, asset, asOf);
  const scenarios = asset === 'BTC' ? bitcoinPaths(rows, asOf, endDate, seed) : ethereumPaths(rows, asOf, endDate, seed);
  return {
    asset, asOf, endDate, scenarios,
    metadata: { version: 'treasury-asset-paths-1', symbol, seed, maximumObservationDate: asOf, calendar: 'UTC daily simulation dates', scenarioCount: 3, sampleCountPerScenario: 1, probability: null, calibrated: false, ohlcClaim: false },
    warnings: [CLOCK_WARNING, RANGE_WARNING],
  };
}
