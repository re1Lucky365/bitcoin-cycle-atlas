import assert from 'node:assert/strict';
import test from 'node:test';
import { createPriceScale, barPriceChange } from '../dist/chart-math.js';
import { normalizePriceDomain, scalePriceDomain } from '../dist/price-axis.js';

const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-9*Math.max(1,Math.abs(expected)),`${actual} ≈ ${expected}`);

test('automatic daily log axes give narrow movement useful height and multiple distinct ticks',()=>{
  const axis=createPriceScale([99000,101000],{top:18,bottom:833,tickCount:7});
  assert.ok(axis.y(99000)-axis.y(101000)>600);
  assert.ok(axis.min<99000&&axis.max>101000);
  assert.ok(axis.ticks.length>=3&&axis.ticks.length<=7);
  assert.equal(new Set(axis.ticks).size,axis.ticks.length);
  const flat=createPriceScale([100000,100000],{top:0,bottom:400});
  assert.ok(flat.min<100000&&flat.max>100000);
  close(flat.invert(flat.y(100000)),100000);
});

test('manual price domains stay exact across data, unit labels and both scale types',()=>{
  for(const scale of ['log','linear'])for(const factor of [1,.001]){
    const axis=createPriceScale([1,1000000],{domain:{min:90000,max:110000},scale,factor,top:20,bottom:420});
    assert.equal(axis.min,90000);assert.equal(axis.max,110000);assert.equal(axis.mode,'manual');
    close(axis.y(90000),420);close(axis.y(110000),20);
    close(axis.invert(axis.y(100000)),100000);
    assert.ok(axis.y(1)>420&&axis.y(1000000)<20,'source prices outside the manual domain are never clamped');
  }
});

test('price-axis drag scales ratios in log space and distances in linear space',()=>{
  const log=scalePriceDomain({min:100,max:400,scale:'log'},.5);
  close(Math.sqrt(log.min*log.max),200);close(Math.log(log.max/log.min),Math.log(4)/2);
  const linear=scalePriceDomain({min:100,max:400,scale:'linear'},.5);
  close(linear.min,175);close(linear.max,325);
  const zero=scalePriceDomain({min:0,max:100,scale:'linear'},2);
  assert.equal(zero.min,0);assert.equal(zero.max,200);
});

test('price domains reject invalid values without silently changing the supplied scale',()=>{
  for(const domain of [null,{}, {min:100,max:100},{min:200,max:100},{min:-1,max:100},{min:NaN,max:100},{min:100,max:Infinity}]){
    assert.equal(normalizePriceDomain(domain),null);
  }
  assert.equal(normalizePriceDomain({min:0,max:100},{scale:'log'}),null);
  assert.deepEqual(normalizePriceDomain({min:0,max:100},{scale:'linear'}),{min:0,max:100});
  assert.throws(()=>createPriceScale([100],{domain:{min:0,max:100},scale:'log'}),RangeError);
  assert.equal(scalePriceDomain({min:100,max:200,scale:'log'},NaN),null);
});

test('header returns are previous-close based while open-based change remains explicit',()=>{
  const change=barPriceChange(110,100,120);
  assert.equal(change.changePrice,10);assert.equal(change.changePct,10);
  assert.equal(change.fromOpenChangePrice,-10);close(change.fromOpenChangePct,-100/12);
  assert.equal(change.changeBasis,'previous-close');assert.equal(change.previousClose,100);
  const first=barPriceChange(110,null,120);
  assert.equal(first.changePrice,null);assert.equal(first.changePct,null);assert.ok(first.fromOpenChangePct<0);
});

test('subnormal and indistinguishable manual bounds recover without a tick-loop hang or NaN axis',()=>{
  const invalid=[{min:1e-323,max:100000},{min:100000,max:100000.00000000001},{min:1,max:1e308},{min:0,max:1e-323}];
  for(const domain of invalid)for(const scale of ['log','linear'])assert.equal(normalizePriceDomain(domain,{scale}),null);
  for(const domain of invalid)assert.throws(()=>createPriceScale([100000],{scale:'log',factor:.001,domain}),RangeError);
  assert.throws(()=>createPriceScale([1],{factor:1e-300,domain:{min:1e-200,max:1}}),RangeError);
});
