import assert from 'node:assert/strict';
import test from 'node:test';
import {utcDay,dateFromDay,validateDataset} from '../dist/cycle-engine.js';

test('cached dates preserve calendar validation, UTC arithmetic and zero epoch days',()=>{
  for(const [date,expected] of [['1970-01-01',0],['1969-12-31',-1],['2000-02-29',11016],['2024-02-29',19782],['0000-01-01',-719528]]){
    for(let i=0;i<3;i++)assert.equal(utcDay(date),expected);
    assert.equal(dateFromDay(utcDay(date)),date);
  }
  for(const value of [null,undefined,0,NaN,{},'2024-2-29','2024-02-29T00:00:00Z'])assert.throws(()=>utcDay(value),{name:'TypeError',message:`Invalid UTC date label: ${String(value)}`});
  for(const date of ['1900-02-29','2023-02-29','2024-02-30','2024-04-31','2024-13-01'])for(let i=0;i<2;i++)assert.throws(()=>utcDay(date),{name:'TypeError',message:`Invalid calendar date: ${date}`});
});

test('repeated date conversion avoids reparsing and FIFO eviction bounds retained entries',()=>{
  const parse=Date.parse;
  let parses=0;
  try{
    Date.parse=function(value){parses++;return parse(value);};
    const label='2150-01-01',day=utcDay(label);
    assert.equal(parses,1);
    for(let i=0;i<1000;i++)assert.equal(utcDay(label),day);
    assert.equal(parses,1,'validated identical labels must reuse their numeric UTC day');
    for(let i=1;i<=32768;i++)assert.equal(utcDay(dateFromDay(day+i)),day+i);
    const before=parses;
    assert.equal(utcDay(label),day);
    assert.equal(parses,before+1,'oldest entry must be evicted after 32,768 distinct newer labels');
  }finally{Date.parse=parse;}
});

test('calendar caching never caches prices or weakens dataset revision validation',()=>{
  const first=validateDataset([['2026-10-21',84000]]),revision=validateDataset([['2026-10-21',81000]]);
  assert.equal(first[0].epochDay,revision[0].epochDay);
  assert.equal(first[0].price,84000);assert.equal(revision[0].price,81000);
  assert.throws(()=>validateDataset([['2026-10-21',NaN]]),/Invalid positive finite price/);
  assert.throws(()=>validateDataset([['2026-10-21',1],['2026-10-21',2]]),/Duplicate or reversed/);
});
