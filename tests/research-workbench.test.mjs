import assert from 'node:assert/strict';
import test from 'node:test';
import {volumeForecastSummaryMarkup} from '../dist/research-workbench.js';

test('volume summary describes a separate audit only when holdout observations are available',()=>{
  const forecast=holdout=>({
    status:'ready',
    summary:{
      source:'Bitstamp',lastDate:'2030-12-31',
      trainingStart:'2019-01-01',trainingEnd:'2023-01-31',trainingMonths:49,
      anchorDailyVolume:1500,centralMethod:'persistence',centralLabel:'최근 활동 유지',
      holdout,
    },
    annual:[{year:2030,volume:1500,lower:500,upper:3000}],
  });

  const unavailable=volumeForecastSummaryMarkup(forecast({
    available:false,months:0,startDate:null,endDate:null,
    selectedMetrics:{count:0,wapePct:null,maeRatioToPersistence:null},
  }));
  assert.doesNotMatch(unavailable,/감사했습니다|별도 감사 구간/);
  assert.match(unavailable,/별도 감사 결과가 충분하지 않습니다/);

  const available=volumeForecastSummaryMarkup(forecast({
    available:true,months:24,startDate:'2024-10-01',endDate:'2026-09-30',
    selectedMetrics:{count:24,wapePct:37.4,maeRatioToPersistence:1},
  }));
  assert.match(available,/별도 감사 구간/);
  assert.match(available,/2024-10-01–2026-09-30/);
  assert.match(available,/37\.4%/);
  assert.match(available,/1배/);
  assert.match(available,/마지막 24개월은 모형 선택과 분리해 감사했습니다/);
  assert.doesNotMatch(available,/별도 감사 결과가 충분하지 않습니다/);
});
