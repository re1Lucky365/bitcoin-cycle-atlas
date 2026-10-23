import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanWorkspaceQuery, readWorkspacePriceDomain, workspaceQuery, writeWorkspaceViewport } from '../dist/workspace-state.js';

test('a shared manual USD price domain survives indexed units and preserves the independent time window',()=>{
  const params=new URLSearchParams('axis=log&indicator-list=closed');
  const query=workspaceQuery(params,{frequency:'daily',unit:'indexed',range:{start:'2026-01-01',end:'2026-10-21'},priceDomain:{min:90000,max:120000}});
  const restored=new URLSearchParams(cleanWorkspaceQuery(query));
  assert.deepEqual(readWorkspacePriceDomain(restored),{min:90000,max:120000});
  assert.equal(restored.get('unit'),'indexed');assert.equal(restored.get('view-start'),'2026-01-01');assert.equal(restored.get('indicator-list'),'closed');
  writeWorkspaceViewport(restored,{range:{start:'2026-01-01',end:'2026-10-21'},priceDomain:null});
  assert.equal(restored.has('price-min'),false);assert.equal(restored.has('price-max'),false);assert.equal(restored.get('view-end'),'2026-10-21');
});

test('invalid shared price ranges safely return to Auto and zero is accepted only on a linear axis',()=>{
  for(const text of ['price-min=&price-max=100','price-min=1&price-max=Infinity','price-min=100&price-max=1','price-min=-1&price-max=100','price-min=0&price-max=100','price-min=1']){
    const params=new URLSearchParams(cleanWorkspaceQuery(text));
    assert.equal(readWorkspacePriceDomain(params),null);assert.equal(params.has('price-min'),false);assert.equal(params.has('price-max'),false);
  }
  assert.deepEqual(readWorkspacePriceDomain(new URLSearchParams(cleanWorkspaceQuery('axis=linear&price-min=0&price-max=100'))),{min:0,max:100});
});
