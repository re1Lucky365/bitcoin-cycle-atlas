import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { analyzeCycleTiming } from '../dist/cycle-timing.js';
import { renderTimingView } from '../dist/timing-view.js';

const data = JSON.parse(await readFile(new URL('./fixtures/btc-daily-2026-10-20.json', import.meta.url)));
const nodes = new Map();
globalThis.document = { querySelector: selector => {
  if (!nodes.has(selector)) nodes.set(selector, {});
  return nodes.get(selector);
} };

// A new high is not a zero-length bear market or a confirmed bottom.
const ath = structuredClone(data);
ath.prices.push(['2026-10-21', 130000]);
renderTimingView(analyzeCycleTiming(ath), 'recent2');
assert.match(nodes.get('#timing-verdict').innerHTML, /고점 이후 저점이 아직 관측되지/);
assert.doesNotMatch(nodes.get('#timing-details-content').innerHTML, /기간 감소율: 100/);

// A one-day cross does not erase the last confirmed state; both must be visible.
const cross = structuredClone(data);
cross.prices.push(['2026-10-21', 70000]);
renderTimingView(analyzeCycleTiming(cross), 'recent2');
assert.match(nodes.get('#timing-current').innerHTML, /마지막 확인 상태: 상승/);
assert.match(nodes.get('#timing-current').innerHTML, /아래/);
assert.match(nodes.get('#timing-current').innerHTML, /반대 방향의 14일 지속 조건은 아직 미확인/);
console.log('2 rendered-state regression scenarios passed');
