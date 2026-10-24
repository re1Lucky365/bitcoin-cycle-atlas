import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  ETHEREUM_EVENTS,
  ETHEREUM_EVENTS_REVIEW_DATE,
  ETHEREUM_EVENT_CATEGORIES,
  ETHEREUM_EVENT_COLORS,
  getEthereumEvents,
} from '../dist/ethereum-events.js';

// These are saved responses from the independently operated Blockscout API,
// not values generated from the chart catalog being tested.
const receipts = JSON.parse(readFileSync(new URL('../research-data/ethereum-protocol-block-receipts.json', import.meta.url), 'utf8'));
const blocks = new Map(receipts.map(receipt => [receipt.block, receipt]));
const byId = id => {
  const event = ETHEREUM_EVENTS.find(item => item.id === id);
  assert.ok(event, `Missing reviewed Ethereum event: ${id}`);
  return event;
};
const ids = events => events.map(event => event.id);
function isDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}
function assertDeepFrozen(value, path = 'catalog') {
  if (!value || typeof value !== 'object') return;
  assert.ok(Object.isFrozen(value), `${path} must be frozen`);
  for (const [key, child] of Object.entries(value)) assertDeepFrozen(child, `${path}.${key}`);
}

test('reviewed Ethereum records are chronological, unique, completed and source-backed', () => {
  assert.equal(ETHEREUM_EVENTS_REVIEW_DATE, '2026-10-24');
  assert.deepEqual(new Set(Object.keys(ETHEREUM_EVENT_CATEGORIES)), new Set(['protocol', 'security', 'market', 'ecosystem']));
  assert.deepEqual(new Set(ETHEREUM_EVENTS.map(event => event.category)), new Set(Object.keys(ETHEREUM_EVENT_CATEGORIES)));
  assert.equal(new Set(ids(ETHEREUM_EVENTS)).size, ETHEREUM_EVENTS.length);
  let previous = '';
  for (const event of ETHEREUM_EVENTS) {
    assert.match(event.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(isDay(event.date), `${event.id}: valid calendar date`);
    assert.ok(event.date >= previous, `${event.id}: chronological order`);
    assert.ok(event.date <= ETHEREUM_EVENTS_REVIEW_DATE, `${event.id}: no future event`);
    assert.ok(Object.hasOwn(ETHEREUM_EVENT_CATEGORIES, event.category));
    assert.ok([2, 3].includes(event.importance), `${event.id}: editorial importance`);
    assert.ok(typeof event.label === 'string' && event.label.trim() && event.label.length <= 24, `${event.id}: compact chart label`);
    assert.match(event.title, /[가-힣]/, `${event.id}: Korean event explanation`);
    assert.ok(event.title && event.description && event.detail && event.dateBasis && event.crossCheck);
    assert.ok(['source-calendar-day', 'block-timestamp'].includes(event.datePrecision));
    assert.ok(Array.isArray(event.limitations) && event.limitations.length > 0);
    assert.ok(event.limitations.every(text => typeof text === 'string' && text.trim()));
    assert.doesNotMatch(event.title, /예정|예고|\bplanned\b|\bscheduled\b/i, `${event.id}: completed event, not a target date`);
    for (const field of ['forecast', 'prediction', 'priceTarget', 'sentiment', 'priceImpact', 'causalReturn']) {
      assert.ok(!Object.hasOwn(event, field), `${event.id}: no invented ${field}`);
    }
    assert.ok(new Set(event.sources.map(source => source.url)).size >= 2, `${event.id}: two distinct source documents`);
    for (const source of event.sources) {
      const url = new URL(source.url);
      assert.equal(url.protocol, 'https:');
      assert.equal(url.username + url.password, '', `${event.id}: public source link`);
      assert.ok(source.publisher && source.title && source.role && source.claim, `${event.id}: per-source provenance`);
      assert.equal(source.type, 'primary');
      assert.equal(source.accessedAt, ETHEREUM_EVENTS_REVIEW_DATE);
      if (source.publishedAt !== null && source.publishedAt !== undefined) {
        assert.ok(isDay(source.publishedAt), `${event.id}: source publication date`);
        assert.ok(source.publishedAt <= ETHEREUM_EVENTS_REVIEW_DATE);
      }
    }
    if (event.category === 'protocol') {
      assert.ok(event.sources.some(source => /completion|retrospective|observed/.test(source.role)), `${event.id}: completion evidence beyond an advance schedule`);
    }
    previous = event.date;
  }
  assert.deepEqual(Object.keys(ETHEREUM_EVENT_COLORS).sort(), Object.keys(ETHEREUM_EVENT_CATEGORIES).sort());
  for (const color of Object.values(ETHEREUM_EVENT_COLORS)) assert.match(color, /^#[\da-f]{6}$/i);
});

test('every asserted execution timestamp and hash agrees with a saved independent block receipt', () => {
  const chainEvents = ETHEREUM_EVENTS.filter(event => event.datePrecision === 'block-timestamp');
  assert.ok(chainEvents.length > 0);
  for (const event of chainEvents) {
    assert.ok(Number.isSafeInteger(event.blockHeight) && event.blockHeight > 0);
    const receipt = blocks.get(event.blockHeight);
    assert.ok(receipt, `${event.id}: receipt for block ${event.blockHeight}`);
    assert.equal(receipt.accessedAt, ETHEREUM_EVENTS_REVIEW_DATE);
    assert.equal(receipt.observed.height, event.blockHeight);
    assert.match(event.blockHash, /^0x[\da-f]{64}$/);
    assert.equal(event.blockHash, receipt.observed.hash, `${event.id}: block identity`);
    assert.equal(Date.parse(event.timestampUtc), Date.parse(receipt.observed.timestamp), `${event.id}: observed time`);
    assert.equal(event.timestampUtc.slice(0, 10), event.date, `${event.id}: UTC chart day`);
    assert.equal(event.facts.block, event.blockHeight);
    assert.equal(event.facts.blockHash, event.blockHash);
    assert.equal(event.facts.utcTimestamp, event.timestampUtc);
    assert.ok(event.sources.some(source => source.url === receipt.url), `${event.id}: public receipt link`);
  }
  for (const [id, date] of [
    ['ethereum-homestead', '2016-03-14'],
    ['ethereum-istanbul', '2019-12-08'],
    ['ethereum-shapella', '2023-04-12'],
  ]) assert.equal(byId(id).date, date, `${id}: regional headlines must not shift the UTC date`);
});

test('calendar-day evidence does not gain a fabricated instant, including the genesis-header exception', () => {
  for (const event of ETHEREUM_EVENTS.filter(item => item.datePrecision === 'source-calendar-day')) {
    assert.ok(!Object.hasOwn(event, 'timestampUtc'), `${event.id}: no invented midnight instant`);
    assert.ok(!Object.hasOwn(event, 'blockHeight') && !Object.hasOwn(event, 'blockHash'));
  }
  const frontier = byId('ethereum-frontier-launch');
  assert.equal(frontier.date, '2015-07-30');
  assert.equal(Date.parse(blocks.get(0).observed.timestamp), 0, 'genesis header time is not the launch date');
  assert.equal(blocks.get(1).observed.timestamp.slice(0, 10), frontier.date);
  assert.match(frontier.limitations.join(' '), /1970-01-01/);
  assert.equal(frontier.datePrecision, 'source-calendar-day');
});

test('the Merge distinguishes the terminal proof-of-work block from the first proof-of-stake block', () => {
  const event = byId('ethereum-merge');
  assert.equal(event.date, '2022-09-15');
  assert.equal(event.facts.terminalPowBlock, 15537393);
  assert.equal(event.blockHeight, 15537394);
  const terminal = blocks.get(event.facts.terminalPowBlock).observed;
  const firstPos = blocks.get(event.blockHeight).observed;
  assert.equal(Date.parse(event.facts.terminalPowTimestampUtc), Date.parse(terminal.timestamp));
  assert.equal(Date.parse(event.timestampUtc), Date.parse(firstPos.timestamp));
  assert.ok(Date.parse(terminal.timestamp) < Date.parse(firstPos.timestamp));
  assert.ok(BigInt(terminal.difficulty) > 0n);
  assert.equal(firstPos.difficulty, '0');
  assert.equal(firstPos.parent_hash, terminal.hash);
});

test('epoch boundaries remain distinct from later observed execution blocks when slots are skipped', () => {
  for (const event of ETHEREUM_EVENTS.filter(item => item.blockHeight && item.facts.epochActivationUtc)) {
    const boundary = Date.parse(event.facts.epochActivationUtc);
    const observed = Date.parse(event.timestampUtc);
    const previous = blocks.get(event.blockHeight - 1);
    assert.ok(previous, `${event.id}: preceding-block receipt`);
    assert.ok(Date.parse(previous.observed.timestamp) < boundary, `${event.id}: previous block precedes activation`);
    assert.ok(boundary <= observed, `${event.id}: first observed block is not before activation`);
    assert.equal(event.facts.epochActivationUtc.slice(0, 10), event.date);
  }
  const shapella = byId('ethereum-shapella'), fusaka = byId('ethereum-fusaka');
  assert.equal(Date.parse(shapella.timestampUtc) - Date.parse(shapella.facts.epochActivationUtc), 24_000);
  assert.equal(Date.parse(fusaka.timestampUtc) - Date.parse(fusaka.facts.epochActivationUtc), 12_000);
});

test('DAO attack, DAO fork, July Parity theft and November Parity freeze retain separate facts', () => {
  const attack = byId('eth-dao-exploit'), fork = byId('ethereum-dao-hard-fork');
  assert.equal(attack.date, '2016-06-17');
  assert.equal(fork.date, '2016-07-20');
  assert.equal(attack.category, 'security');
  assert.equal(fork.category, 'protocol');
  assert.equal(attack.facts.responseForkDate, fork.date);
  assert.equal(fork.blockHeight, 1920000);
  assert.match(attack.limitations.join(' '), /합의.*자체.*침해.*뜻하지/);
  const theft = byId('eth-parity-multisig-exploit'), freeze = byId('eth-parity-library-freeze');
  assert.equal(theft.date, '2017-07-19');
  assert.equal(freeze.date, '2017-11-06', 'the November 7 analysis publication is not the incident day');
  assert.equal(theft.facts.incidentKind, 'contract-exploit');
  assert.equal(freeze.facts.incidentKind, 'contract-library-destruction');
  assert.match(theft.description, /유출/);
  assert.match(freeze.title, /동결/);
});

test('US spot ETH exchange-rule approval is not confused with actual exchange trading', () => {
  const approval = byId('eth-us-spot-etp-rule-approval'), trading = byId('eth-us-spot-etp-trading');
  assert.equal(approval.date, '2024-05-23');
  assert.equal(trading.date, '2024-07-23');
  assert.equal(approval.facts.order, '34-100224');
  assert.equal(approval.facts.milestone, 'exchange-rule-approval');
  assert.equal(trading.facts.milestone, 'exchange-trading-start');
  assert.match(approval.detail, /등록서.*효력.*거래/);
  assert.match(trading.limitations.join(' '), /ETHE.*이전.*장외/);
  assert.ok(approval.sources.some(source => source.role === 'regulator-approval-order'));
  assert.ok(trading.sources.some(source => source.role === 'issuer-completed-trading-record'));
  assert.ok(trading.sources.some(source => source.role === 'independent-exchange-listing-record'));
});

test('Uniswap launch records preserve their same-organization corroboration limits', () => {
  const launches = [['eth-uniswap-v1-mainnet', '2018-11-02'], ['eth-uniswap-v2-mainnet', '2020-05-18'], ['eth-uniswap-v3-mainnet', '2021-05-05']];
  for (const [id, date] of launches) {
    const event = byId(id);
    assert.equal(event.date, date);
    assert.equal(event.category, 'ecosystem');
    assert.equal(event.facts.network, 'Ethereum mainnet');
    assert.match(event.crossCheck, /동일|같은/);
    assert.match(event.limitations.join(' '), /독립/);
    assert.ok(event.sources.some(source => source.role.startsWith('same-organization-')));
  }
  for (const id of launches.slice(0, 2).map(([id]) => id)) {
    assert.match(byId(id).sources.find(source => source.role.startsWith('same-organization-')).claim, /정확한 일자.*제시하지/);
  }
});

test('inclusive date boundaries and a single-day range retain the correct reviewed events', () => {
  assert.deepEqual(ids(getEthereumEvents({ startDate: '2016-06-17', endDate: '2016-07-20' })), ['eth-dao-exploit', 'ethereum-dao-hard-fork']);
  assert.deepEqual(ids(getEthereumEvents({ startDate: '2016-06-17', endDate: '2016-06-17' })), ['eth-dao-exploit']);
  assert.deepEqual(getEthereumEvents({ startDate: '2016-06-18', endDate: '2016-07-19' }), []);
  assert.deepEqual(ids(getEthereumEvents({ category: 'market', startDate: '2024-05-23', endDate: '2024-07-23' })), ['eth-us-spot-etp-rule-approval', 'eth-us-spot-etp-trading']);
  assert.deepEqual(getEthereumEvents({ startDate: null, endDate: null }), ETHEREUM_EVENTS);
  assert.deepEqual(getEthereumEvents({ startDate: '2024-02-29', endDate: '2024-02-29' }), [], 'a real leap day is valid');
});

test('category, date and case-insensitive multi-term search combine without mutating the input', () => {
  const filters = Object.freeze({ category: 'ecosystem', query: '  UNISWAP   v3  ', startDate: '2021-01-01', endDate: '2021-12-31' });
  assert.deepEqual(ids(getEthereumEvents(filters)), ['eth-uniswap-v3-mainnet']);
  assert.equal(filters.query, '  UNISWAP   v3  ');
  assert.deepEqual(ids(getEthereumEvents({ category: 'security', query: 'parity' })), ['eth-parity-multisig-exploit', 'eth-parity-library-freeze']);
  assert.deepEqual(ids(getEthereumEvents({ query: '2016-06-17' })), ['eth-dao-exploit']);
  assert.deepEqual(getEthereumEvents({ category: 'market', query: 'Uniswap' }), []);
  assert.deepEqual(getEthereumEvents({ query: 'definitely-no-such-reviewed-ethereum-event' }), []);
  assert.deepEqual(getEthereumEvents({ query: ' \n\t ' }), ETHEREUM_EVENTS);
  assert.deepEqual(getEthereumEvents({ query: '<script>alert(1)</script>' }), [], 'query text is not interpreted as code');
});

test('invalid date, category and reversed-range filters fail instead of silently changing meaning', () => {
  for (const date of ['2024-02-30', '2023-02-29', '2024-00-01', '2024-13-01', '2024-01-00', '2024-1-01', '2024-01-01T00:00:00Z', '', 20240101, new Date('2024-01-01T00:00:00Z')]) {
    assert.throws(() => getEthereumEvents({ startDate: date }), RangeError);
    assert.throws(() => getEthereumEvents({ endDate: date }), RangeError);
  }
  for (const category of ['unverified', 'macro', '__proto__', 'constructor', 'toString', '', null, 1, ['security']]) {
    assert.throws(() => getEthereumEvents({ category }), RangeError, `invalid category ${String(category)}`);
  }
  assert.throws(() => getEthereumEvents({ startDate: '2025-01-01', endDate: '2024-12-31' }), RangeError);
});

test('wide or future chart windows never manufacture hypothetical events', () => {
  assert.deepEqual(getEthereumEvents({ startDate: '2027-01-01', endDate: '2050-12-31' }), []);
  assert.deepEqual(getEthereumEvents({ startDate: '2010-01-01', endDate: '2050-12-31' }), ETHEREUM_EVENTS);
  assert.equal(getEthereumEvents()[0].id, 'ethereum-frontier-launch', 'pre-price-history context remains available to the event list');
});

test('returned views cannot mutate shared events, nested source evidence, facts or category metadata', () => {
  assertDeepFrozen(ETHEREUM_EVENTS);
  assertDeepFrozen(ETHEREUM_EVENT_CATEGORIES, 'categories');
  assertDeepFrozen(ETHEREUM_EVENT_COLORS, 'colors');
  const visible = getEthereumEvents();
  assert.notEqual(visible, ETHEREUM_EVENTS);
  visible.reverse();
  visible.pop();
  assert.deepEqual(getEthereumEvents(), ETHEREUM_EVENTS);
  assert.throws(() => { byId('eth-dao-exploit').date = '2030-01-01'; }, TypeError);
  assert.throws(() => { byId('eth-dao-exploit').sources[0].url = 'https://example.com/'; }, TypeError);
  assert.throws(() => { byId('eth-dao-exploit').limitations.push('unverified'); }, TypeError);
  assert.throws(() => { byId('eth-us-spot-etp-trading').facts.verifiedExamples.push('unverified'); }, TypeError);
  assert.throws(() => { ETHEREUM_EVENT_CATEGORIES.protocol = 'changed'; }, TypeError);
  assert.throws(() => { ETHEREUM_EVENT_COLORS.protocol = 'unsafe'; }, TypeError);
});
