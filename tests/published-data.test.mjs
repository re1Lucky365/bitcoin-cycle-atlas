import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { inspectPublishedDataset, shouldCheckPublishedSnapshot, PUBLISHED_REFRESH_INTERVAL_MS } from '../dist/published-data.js';
const data=JSON.parse(await readFile(new URL('./fixtures/btc-daily-2026-10-20.json',import.meta.url),'utf8'));
const now=new Date('2026-10-22T12:00:00Z');

test('background publication check avoids recalculation for same or older prices but detects reviewed revisions',()=>{
  const same=structuredClone(data);same.meta.retrievedAt=now.toISOString();
  assert.equal(inspectPublishedDataset(same,data,{now}).changed,false);
  const revised=structuredClone(data);revised.prices.at(-1)[1]+=1;
  assert.equal(inspectPublishedDataset(revised,data,{now}).changed,true);
  const newer=structuredClone(data);newer.prices.push(['2026-10-21',data.prices.at(-1)[1]]);
  assert.equal(inspectPublishedDataset(data,newer,{now}).reason,'published-snapshot-older');
  const shorter=structuredClone(data);shorter.prices.pop();
  assert.equal(inspectPublishedDataset(data,shorter,{now}).changed,true);
});

test('published metadata, incomplete days and gaps cannot silently enter the active model',()=>{
  const wrong=structuredClone(data);wrong.meta.metric='market_cap';
  assert.throws(()=>inspectPublishedDataset(wrong,data,{now}),/provenance/);
  const gap=structuredClone(data);gap.prices.splice(5000,1);gap.meta.count--;
  assert.throws(()=>inspectPublishedDataset(gap,data,{now}),/gap/);
  assert.throws(()=>inspectPublishedDataset(data,null,{now:new Date('2026-10-20T12:00:00Z')}),/unfinished/);
});

test('a newer cache candidate cannot hide a missing old day behind an unchanged total row count',()=>{
  const cached=structuredClone(data);
  cached.prices.splice(5000,1);
  cached.prices.push(['2026-10-21',data.prices.at(-1)[1]]);
  cached.meta.lastDate='2026-10-21';cached.meta.retrievedAt=now.toISOString();
  assert.equal(cached.prices.length,data.prices.length);
  assert.throws(()=>inspectPublishedDataset(cached,data,{now}),/missing UTC day/);
  assert.throws(()=>inspectPublishedDataset(cached,null,{now}),/missing UTC day/);
});

test('an older published revision cannot overwrite a newer manual correction at the same cutoff',()=>{
  const published=structuredClone(data);published.meta.retrievedAt='2026-10-21T12:00:00.000Z';
  const manual=structuredClone(published);manual.meta.retrievedAt='2026-10-22T11:00:00.000Z';manual.prices[5000][1]+=1;
  assert.deepEqual(inspectPublishedDataset(published,manual,{now}),{changed:false,reason:'published-revision-older',lastDate:data.prices.at(-1)[0]});
  const corrected=structuredClone(published);corrected.meta.retrievedAt=now.toISOString();
  assert.equal(inspectPublishedDataset(corrected,manual,{now}).changed,true);
  const same=structuredClone(manual);same.meta.retrievedAt=published.meta.retrievedAt;
  assert.equal(inspectPublishedDataset(same,manual,{now}).reason,'same-observations');
});

test('published tuple shape and finite completed-day retrieval timestamps are required',()=>{
  const objects=structuredClone(data);objects.prices=objects.prices.map(([date,price])=>({date,price}));
  assert.throws(()=>inspectPublishedDataset(objects,data,{now}),/\[UTC date, numeric price\]/);
  for(const retrievedAt of [null,'not-a-date','2026-02-30T12:00:00Z','2026-10-23T12:00:00Z','2026-10-20T23:59:59Z']){
    const invalid=structuredClone(data);invalid.meta.retrievedAt=retrievedAt;
    assert.throws(()=>inspectPublishedDataset(invalid,data,{now}),/retrieval time/);
  }
});

test('visibility and a six-hour throttle bound revalidation even under repeated focus events',()=>{
  const last=1000;
  assert.equal(shouldCheckPublishedSnapshot(last,last+PUBLISHED_REFRESH_INTERVAL_MS-1),false);
  assert.equal(shouldCheckPublishedSnapshot(last,last+PUBLISHED_REFRESH_INTERVAL_MS),true);
  assert.equal(shouldCheckPublishedSnapshot(last,last+PUBLISHED_REFRESH_INTERVAL_MS,false),false);
  assert.equal(shouldCheckPublishedSnapshot(last,last-1),false);
  assert.equal(shouldCheckPublishedSnapshot(null,last),true);
});
