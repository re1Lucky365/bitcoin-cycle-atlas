import assert from 'node:assert/strict';
import test from 'node:test';
import { utcDay } from '../dist/cycle-engine.js';
import { fitRange,zoomRange,panRange } from '../dist/chart-navigation.js';

const range={start:'2024-01-01',end:'2024-04-09',min:'2023-01-01',max:'2025-12-31'};
const length=value=>utcDay(value.end)-utcDay(value.start)+1;

test('zoom keeps an anchored calendar date while using inclusive UTC days',()=>{
  assert.equal(length(range),100);
  const centered=zoomRange(range,.5);
  assert.equal(length(centered),50);
  assert.equal(centered.start,'2024-01-26');
  assert.equal(centered.end,'2024-03-15');
  assert.equal(zoomRange(range,.5,0).start,range.start);
  assert.equal(zoomRange(range,.5,1).end,range.end);
  assert.deepEqual(zoomRange(range,1),range);
});

test('zoom limits minimum span and respects the full data and future boundary',()=>{
  assert.equal(length(zoomRange(range,.00001)),30);
  const leap={...range,start:'2024-02-01',end:'2024-03-01'};
  assert.equal(length(leap),30);
  assert.deepEqual(zoomRange(leap,.5),leap);
  assert.deepEqual(zoomRange(range,1000),fitRange(range));
  const edge={...range,start:'2025-12-01',end:'2025-12-31'};
  const expanded=zoomRange(edge,2,0);
  assert.equal(expanded.end,range.max);
  assert.equal(length(expanded),62);
});

test('pan moves both edges together and clamps without shrinking the window',()=>{
  const later=panRange(range,.25);
  assert.equal(later.start,'2024-01-26');
  assert.equal(later.end,'2024-05-04');
  assert.equal(length(later),100);
  const earliest=panRange(range,-100),latest=panRange(range,100);
  assert.equal(earliest.start,range.min);
  assert.equal(latest.end,range.max);
  assert.equal(length(earliest),100);
  assert.equal(length(latest),100);
  assert.deepEqual(panRange(earliest,-1),earliest);
  assert.deepEqual(panRange(latest,1),latest);
});

test('pan rounds half-day offsets symmetrically and preserves unclamped round trips',()=>{
  const original={start:'2026-03-17',end:'2029-05-29',min:'2010-07-18',max:'2032-12-31'};
  assert.equal(length(original),1170);
  const earlier=panRange(original,-.25),later=panRange(original,.25);
  assert.equal(utcDay(earlier.start)-utcDay(original.start),-293);
  assert.equal(utcDay(later.start)-utcDay(original.start),293);
  for(const fraction of [.25,-.25,.5,-.5]){
    let current=original;
    for(let i=0;i<12;i++){
      const shifted=panRange(current,fraction);
      assert.ok(shifted.start>original.min&&shifted.end<original.max);
      assert.equal(length(shifted),length(original));
      current=panRange(shifted,-fraction);
      assert.deepEqual(current,original);
    }
  }
});

test('short available history remains usable and fit never fabricates dates',()=>{
  const short={start:'2024-02-29',end:'2024-02-29',min:'2024-02-29',max:'2024-03-05'};
  assert.deepEqual(fitRange(short),{...short,start:'2024-02-29',end:'2024-03-05'});
  assert.deepEqual(zoomRange(short,.1),fitRange(short));
  assert.deepEqual(panRange(short,1),fitRange(short));
  const single={start:'2024-02-29',end:'2024-02-29',min:'2024-02-29',max:'2024-02-29'};
  assert.deepEqual(zoomRange(single,10),single);
});

test('range math rejects impossible dates and invalid movements',()=>{
  assert.throws(()=>zoomRange({...range,start:'2024-02-30'},.8),/Invalid calendar date/);
  assert.throws(()=>zoomRange(range,0),RangeError);
  assert.throws(()=>zoomRange(range,NaN),RangeError);
  assert.throws(()=>zoomRange(range,1,Infinity),RangeError);
  assert.throws(()=>panRange(range,Infinity),RangeError);
  assert.throws(()=>fitRange({...range,min:range.max,max:range.min}),RangeError);
  assert.throws(()=>fitRange({...range,start:range.end,end:range.start}),RangeError);
});

test('repeated navigation never crosses the declared observed and simulated limits',()=>{
  let current={start:'2026-10-22',end:'2029-10-22',min:'2010-07-18',max:'2029-10-22'};
  for(let i=0;i<80;i++){
    current=zoomRange(current,i%2?.8:1.25,(i%7)/6);
    current=panRange(current,(i%5-2)*.21);
    assert.ok(current.start>=current.min);
    assert.ok(current.end<=current.max);
    assert.ok(length(current)>=30);
    assert.ok(Number.isInteger(utcDay(current.start))&&Number.isInteger(utcDay(current.end)));
  }
});
