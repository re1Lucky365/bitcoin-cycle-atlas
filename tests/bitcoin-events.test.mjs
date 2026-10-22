import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BITCOIN_EVENTS,
  BITCOIN_EVENTS_REVIEW_DATE,
  BITCOIN_EVENT_CATEGORIES,
  getVisibleBitcoinEvents,
} from '../dist/bitcoin-events.js';

const byId = id => {
  const event = BITCOIN_EVENTS.find(item => item.id === id);
  assert.ok(event, `Missing historical event: ${id}`);
  return event;
};

function isDay(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

test('historical catalog stays sourced, unique, chronological and within its review cutoff', () => {
  assert.ok(BITCOIN_EVENTS.length >= 30 && BITCOIN_EVENTS.length <= 45);
  assert.equal(BITCOIN_EVENTS_REVIEW_DATE, '2026-10-22');
  assert.equal(new Set(BITCOIN_EVENTS.map(event => event.id)).size, BITCOIN_EVENTS.length);
  let previous = '';
  for (const event of BITCOIN_EVENTS) {
    assert.match(event.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(isDay(event.date), event.id);
    assert.ok(event.date >= previous, `${event.id}: order`);
    assert.ok(event.date <= BITCOIN_EVENTS_REVIEW_DATE, `${event.id}: future event`);
    assert.ok(Object.hasOwn(BITCOIN_EVENT_CATEGORIES, event.category));
    assert.ok([1, 2, 3].includes(event.importance));
    assert.match(event.label, /[가-힣]/);
    assert.ok(event.label.length <= 24, `${event.id}: compact chart label`);
    assert.ok(event.title && event.description && event.dateBasis);
    assert.ok(event.limitations.length > 0);
    assert.ok(event.sources.some(source => source.type === 'primary'), `${event.id}: no primary evidence`);
    assert.ok(!Object.hasOwn(event, 'sentiment') && !Object.hasOwn(event, 'priceImpact'), 'historical context has no invented price-direction score');
    for (const source of event.sources) {
      assert.equal(new URL(source.url).protocol, 'https:');
      assert.ok(source.publisher && source.title);
      assert.ok(['primary', 'secondary'].includes(source.type));
      assert.equal(source.accessedAt, BITCOIN_EVENTS_REVIEW_DATE);
      if (source.publishedAt !== null) {
        assert.ok(isDay(source.publishedAt));
        assert.ok(source.publishedAt <= BITCOIN_EVENTS_REVIEW_DATE);
      }
    }
    previous = event.date;
  }
  assert.deepEqual(new Set(BITCOIN_EVENTS.map(event => event.category)), new Set(Object.keys(BITCOIN_EVENT_CATEGORIES)));
});

test('actual chain records preserve UTC dates across genesis, halvings and upgrades', () => {
  // Fixtures independently checked from Blockstream's public block records.
  const records = [
    ['genesis-2009', 0, 1231006505, '2009-01-03'],
    ['halving-2012', 210000, 1354116278, '2012-11-28'],
    ['halving-2016', 420000, 1468082773, '2016-07-09'],
    ['segwit-2017', 481824, 1503539857, '2017-08-24'],
    ['halving-2020', 630000, 1589225023, '2020-05-11'],
    ['taproot-2021', 709632, 1636866927, '2021-11-14'],
    ['halving-2024', 840000, 1713571767, '2024-04-20'],
  ];
  for (const [id, height, timestamp, day] of records) {
    const event = byId(id);
    assert.equal(event.blockHeight, height);
    assert.equal(Date.parse(event.timestampUtc) / 1000, timestamp);
    assert.equal(event.date, day);
    assert.equal(event.timestampUtc.slice(0, 10), event.date);
    assert.equal(event.datePrecision, 'block-timestamp');
    assert.match(event.blockHash, /^[0-9a-f]{64}$/);
    assert.ok(event.sources.some(source => source.url.endsWith(`/block/${event.blockHash}`)));
  }
  assert.equal(byId('halving-2024').date, '2024-04-20', 'US April 19 headlines must not shift the UTC chart marker');
});

test('offer, disclosure, approval, trading and completion dates remain distinct', () => {
  assert.equal(byId('pizza-2010').date, '2010-05-22', 'the initial May 18 offer was not the completed trade');
  assert.equal(byId('tesla-disclosure-2021').date, '2021-02-08', 'public disclosure, not the January purchase period');
  assert.equal(byId('china-crypto-notices-2021').date, '2021-09-24', 'public release, not September 3/15 signature dates');
  assert.equal(byId('blackrock-filing-2023').date, '2023-06-15', 'S-1 filing, not June 8 in the filename');
  assert.equal(byId('us-spot-etp-approval-2024').date, '2024-01-10', 'actual approval, not the compromised January 9 social post');
  assert.equal(byId('us-spot-etp-trading-2024').date, '2024-01-11');
  assert.equal(byId('saxony-sale-2024').date, '2024-07-12');
  assert.equal(byId('saxony-sale-2024').sources[0].publishedAt, '2024-07-16');
  assert.equal(byId('sab-122-2025').date, '2025-01-23', 'announcement, not January 30 effective date');
});

test('inclusive date boundaries allow adjacent-day markers and an exact single-day view', () => {
  assert.deepEqual(getVisibleBitcoinEvents({ startDate: '2024-01-10', endDate: '2024-01-11' }).map(event => event.id), [
    'us-spot-etp-approval-2024', 'us-spot-etp-trading-2024',
  ]);
  assert.deepEqual(getVisibleBitcoinEvents({ startDate: '2024-01-10', endDate: '2024-01-10' }).map(event => event.id), ['us-spot-etp-approval-2024']);
  assert.deepEqual(getVisibleBitcoinEvents({ startDate: '2024-01-12', endDate: '2024-01-13' }), []);
});

test('long forecast windows never acquire hypothetical future historical markers', () => {
  assert.deepEqual(getVisibleBitcoinEvents({ startDate: '2027-01-01', endDate: '2050-12-31' }), []);
  assert.deepEqual(getVisibleBitcoinEvents({ startDate: '2009-01-01', endDate: '2050-12-31' }), BITCOIN_EVENTS);
  assert.equal(getVisibleBitcoinEvents()[0].id, 'genesis-2009', 'pre-price-history context is retained for the full events panel');
});

test('category and importance filters combine without mutating the caller filters', () => {
  const categories = new Set(['protocol']);
  const filtered = getVisibleBitcoinEvents({ startDate: '2011-01-01', minImportance: 3, categories });
  assert.deepEqual(filtered.map(event => event.id), ['halving-2012', 'halving-2016', 'halving-2020', 'halving-2024']);
  assert.deepEqual([...categories], ['protocol']);
  assert.deepEqual(getVisibleBitcoinEvents({ categories: [] }), []);
  assert.deepEqual(getVisibleBitcoinEvents({ categories: ['macro'] }).map(event => event.id), ['who-pandemic-2020']);
});

test('a constrained marker budget selects editorial priorities and returns chronological order', () => {
  const window = { startDate: '2024-01-01', endDate: '2024-12-31' };
  assert.deepEqual(getVisibleBitcoinEvents({ ...window, limit: 2 }).map(event => event.id), ['us-spot-etp-approval-2024', 'halving-2024']);
  assert.deepEqual(getVisibleBitcoinEvents({ ...window, limit: 3 }).map(event => event.id), ['us-spot-etp-approval-2024', 'us-spot-etp-trading-2024', 'halving-2024']);
  assert.deepEqual(getVisibleBitcoinEvents({ ...window, limit: 0 }), []);
  assert.deepEqual(getVisibleBitcoinEvents({ ...window, limit: 1000 }), getVisibleBitcoinEvents(window));
});

test('invalid chart boundaries and filters fail explicitly instead of silently changing the event view', () => {
  assert.throws(() => getVisibleBitcoinEvents({ startDate: '2024-02-30' }), RangeError);
  assert.throws(() => getVisibleBitcoinEvents({ startDate: '2023-02-29' }), RangeError);
  assert.doesNotThrow(() => getVisibleBitcoinEvents({ startDate: '2024-02-29', endDate: '2024-02-29' }));
  assert.throws(() => getVisibleBitcoinEvents({ startDate: '2024-01-01T00:00:00Z' }), TypeError);
  assert.throws(() => getVisibleBitcoinEvents({ startDate: '2025-01-01', endDate: '2024-12-31' }), RangeError);
  assert.throws(() => getVisibleBitcoinEvents({ categories: ['unverified'] }), RangeError);
  assert.throws(() => getVisibleBitcoinEvents({ categories: 'protocol' }), TypeError);
  for (const minImportance of [0, 4, 1.5, NaN]) assert.throws(() => getVisibleBitcoinEvents({ minImportance }), RangeError);
  for (const limit of [-1, 2.5, Infinity, NaN]) assert.throws(() => getVisibleBitcoinEvents({ limit }), RangeError);
});

test('views cannot mutate the shared historical facts or nested source evidence', () => {
  const visible = getVisibleBitcoinEvents();
  assert.notEqual(visible, BITCOIN_EVENTS);
  visible.pop();
  assert.equal(getVisibleBitcoinEvents().length, BITCOIN_EVENTS.length);
  assert.throws(() => { BITCOIN_EVENTS[0].date = '2030-01-01'; }, TypeError);
  assert.throws(() => { BITCOIN_EVENTS[0].sources[0].url = 'https://example.com/'; }, TypeError);
  assert.throws(() => { BITCOIN_EVENTS[0].limitations.push('unverified'); }, TypeError);
});
