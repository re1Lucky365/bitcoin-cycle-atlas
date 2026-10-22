import test from 'node:test';
import assert from 'node:assert/strict';
import { chartPresetRange, DEFAULT_CHART_SPAN } from '../dist/chart-presets.js';

const scope={asOf:'2026-10-21',referenceDate:'2026-10-22',firstDate:'2010-07-18',lastDate:'2050-12-31'};
test('first view shows two calendar years either side of the observed date without cutting the horizon',()=>{
  assert.equal(DEFAULT_CHART_SPAN,'focus');
  assert.deepEqual(chartPresetRange(scope),{start:'2024-10-21',end:'2028-10-21'});
  assert.deepEqual(chartPresetRange({...scope,span:'history'}),{start:'2010-07-18',end:'2050-12-31'});
  assert.deepEqual(chartPresetRange({...scope,span:'all'}),{start:'2025-10-21',end:'2050-12-31'});
});
test('calendar window handles leap days and clamps short observation or forecast coverage',()=>{
  assert.deepEqual(chartPresetRange({...scope,asOf:'2024-02-29'}),{start:'2022-02-28',end:'2026-02-28'});
  assert.deepEqual(chartPresetRange({...scope,firstDate:'2026-01-01',lastDate:'2027-12-31'}),{start:'2026-01-01',end:'2027-12-31'});
  assert.deepEqual(chartPresetRange({...scope,span:'near'}),{start:'2026-09-07',end:'2027-04-22'});
  assert.throws(()=>chartPresetRange({...scope,asOf:'2026-02-30'}));
});
