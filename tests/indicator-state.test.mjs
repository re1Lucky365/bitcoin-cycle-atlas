import assert from 'node:assert/strict';
import test from 'node:test';
import {INDICATORS,normalizeIndicatorState,readIndicatorState,writeIndicatorState,changeIndicatorState,isIndicatorVisible,visibleAnalysisIds,searchIndicators} from '../dist/indicator-state.js';
import {preparePriceViewData} from '../dist/price-view-data.js';
import {countdownPresentation,chartIndicatorItems} from '../dist/indicator-workbench.js';

test('fresh chart shows the indicator legend without unsolicited research analysis windows',()=>{
  const state=readIndicatorState('');
  assert.equal(state.collapsed,false);assert.deepEqual(visibleAnalysisIds(state),[]);
  for(const id of ['readout','source','legend','volume','history','cycle-timing'])assert.ok(isIndicatorVisible(state,id));
});

test('click to add and click again to remove is separate from temporary eye visibility',()=>{
  for(const {id} of INDICATORS){
    let state=normalizeIndicatorState({added:[]});state=changeIndicatorState(state,{action:'toggle',id});
    assert.ok(isIndicatorVisible(state,id));
    state=changeIndicatorState(state,{action:'visibility',id});assert.ok(state.added.includes(id));assert.equal(isIndicatorVisible(state,id),false);
    state=changeIndicatorState(state,{action:'visibility',id});assert.ok(isIndicatorVisible(state,id));
    state=changeIndicatorState(state,{action:'toggle',id});assert.equal(state.added.includes(id),false);assert.equal(state.hidden.includes(id),false);
  }
});

test('multiple optional analyses have independent membership and visibility',()=>{
  let state=readIndicatorState('');
  for(const id of ['cycles','periods','cryptocon'])state=changeIndicatorState(state,{action:'add',id});
  assert.deepEqual(visibleAnalysisIds(state),['cycles','periods','cryptocon']);assert.equal(state.active,'cryptocon');
  state=changeIndicatorState(state,{action:'visibility',id:'periods'});assert.deepEqual(visibleAnalysisIds(state),['cycles','cryptocon']);
  state=changeIndicatorState(state,{action:'remove',id:'cycles'});assert.deepEqual(visibleAnalysisIds(state),['cryptocon']);
  state=changeIndicatorState(state,{action:'hide-all'});assert.deepEqual(visibleAnalysisIds(state),[]);assert.ok(state.added.includes('cryptocon'));
  state=changeIndicatorState(state,{action:'show-all'});assert.deepEqual(visibleAnalysisIds(state),['periods','cryptocon']);
});

test('indicator URL preserves empty selections, hidden rows, active study and unrelated chart settings',()=>{
  for(const value of [{added:[]},{added:['readout','volume','periods','cycles'],hidden:['volume','cycles'],active:'periods',collapsed:false},{added:['volume'],collapsed:true},readIndicatorState('')]){
    const state=normalizeIndicatorState(value),params=new URLSearchParams('granularity=1h&type=candles&measure=realizedVolPct&assumption=late&page=evidence');
    writeIndicatorState(params,state);assert.deepEqual(readIndicatorState(params),state);
    assert.equal(params.get('granularity'),'1h');assert.equal(params.get('type'),'candles');assert.equal(params.get('measure'),'realizedVolPct');assert.equal(params.get('page'),'evidence');
  }
});

test('explicit closed legend survives sharing while existing open links remain expanded',()=>{
  assert.equal(readIndicatorState('indicator-list=open').collapsed,false);
  const closed=readIndicatorState('indicator-list=closed');
  assert.equal(closed.collapsed,true);
  const params=writeIndicatorState(new URLSearchParams(),closed);
  assert.equal(params.get('indicator-list'),'closed');
  const expanded=changeIndicatorState(closed,{action:'collapse'});
  assert.equal(expanded.collapsed,false);
  writeIndicatorState(params,expanded);
  assert.equal(params.get('indicator-list'),'open');
  assert.deepEqual(readIndicatorState(params),expanded);
});

test('only a fresh mobile chart starts folded and either explicit choice survives device changes',()=>{
  assert.equal(readIndicatorState('',{mobile:true}).collapsed,true);
  assert.equal(readIndicatorState('',{mobile:false}).collapsed,false);
  for(const mobile of [true,false])for(const collapsed of [true,false]){
    const state=readIndicatorState(`indicator-list=${collapsed?'closed':'open'}`,{mobile});
    assert.equal(state.collapsed,collapsed);
    const params=writeIndicatorState(new URLSearchParams(),state);
    assert.equal(readIndicatorState(params,{mobile:!mobile}).collapsed,collapsed);
  }
});

test('legend folding never changes a single study or its price layer visibility',()=>{
  for(const added of [['volume'],['readout','source','legend','volume','cycle-timing','periods']]){
    const state=normalizeIndicatorState({added,hidden:['cycle-timing'],minimized:['periods']});
    const closed=changeIndicatorState(state,{action:'collapse'});
    assert.deepEqual({...closed,collapsed:false},state);
    assert.deepEqual(changeIndicatorState(closed,{action:'collapse'}),state);
  }
});

test('bulk study visibility leaves OHLC, source and chart legend choices unchanged',()=>{
  for(const displayHidden of [[],['readout'],['source','legend']]){
    const state=normalizeIndicatorState({added:INDICATORS.map(item=>item.id),hidden:displayHidden,minimized:['periods'],collapsed:true});
    const hidden=changeIndicatorState(state,{action:'hide-all'});
    for(const item of INDICATORS){
      assert.equal(isIndicatorVisible(hidden,item.id),item.category==='표시'?!displayHidden.includes(item.id):false,item.id);
    }
    const shown=changeIndicatorState(hidden,{action:'show-all'});
    assert.deepEqual(shown,state);
  }
});

test('minimized analysis panes survive visibility and URL changes without removing a study',()=>{
  let state=normalizeIndicatorState({added:['volume','cycles','periods'],hidden:['volume'],collapsed:true});
  const original=structuredClone(state);
  state=changeIndicatorState(state,{action:'minimize',id:'cycles'});
  assert.deepEqual(state.minimized,['cycles']);assert.deepEqual(state.hidden,original.hidden);assert.deepEqual(state.added,original.added);
  state=changeIndicatorState(state,{action:'visibility',id:'cycles'});
  assert.deepEqual(state.minimized,['cycles']);assert.ok(state.hidden.includes('cycles'));
  const restored=readIndicatorState(writeIndicatorState(new URLSearchParams(),state),{mobile:false});
  assert.deepEqual(restored,state);
  state=changeIndicatorState(restored,{action:'visibility',id:'cycles'});
  state=changeIndicatorState(state,{action:'minimize',id:'cycles'});
  assert.deepEqual(state,original);
  assert.deepEqual(changeIndicatorState(state,{action:'minimize',id:'volume'}),state);
  const invalid=normalizeIndicatorState({...state,minimized:['cycles','cycles','volume','peaks','invalid']});
  assert.deepEqual(invalid.minimized,['cycles']);
  assert.deepEqual(changeIndicatorState(invalid,{action:'remove',id:'cycles'}).minimized,[]);
});

test('legacy graph links migrate into optional in-chart indicators without a bottom dock',()=>{
  for(const id of ['cycles','duration','peaks','periods','cryptocon']){
    const state=readIndicatorState(`chart=${id}`);assert.deepEqual(visibleAnalysisIds(state),[id]);
    const hidden=readIndicatorState(`chart=${id}&dock=closed`);assert.ok(hidden.added.includes(id));assert.equal(isIndicatorVisible(hidden,id),false);
    const params=new URLSearchParams(`chart=${id}&dock=closed`);writeIndicatorState(params,hidden);assert.equal(params.has('dock'),false);assert.deepEqual(readIndicatorState(params),hidden);
  }
  assert.deepEqual(visibleAnalysisIds(readIndicatorState('page=compare')),['cycles']);
  assert.deepEqual(visibleAnalysisIds(readIndicatorState('page=compare&legacy=1')),[]);
});

test('unknown or duplicated IDs cannot create invalid controls; search combines all terms',()=>{
  const state=readIndicatorState('indicators=bad,volume,volume,cycles&indicator-hide=other,volume,volume');
  assert.deepEqual(state.added,['volume','cycles']);assert.deepEqual(state.hidden,['volume']);
  assert.deepEqual(changeIndicatorState(state,{action:'add',id:'bad'}),state);
  assert.deepEqual(searchIndicators('사이클 시계').map(x=>x.id),['cycle-timing']);
  assert.ok(searchIndicators('','분석 창').every(x=>x.analysis));assert.deepEqual(searchIndicators('없는 지표 123'),[]);
});

test('legacy primary fields survive existing shared links without defining the new legend fold',()=>{
  let state=changeIndicatorState(readIndicatorState(''),{action:'primary',id:'cycle-timing'});
  const params=writeIndicatorState(new URLSearchParams('granularity=1m'),state);
  assert.equal(params.get('indicator-primary'),'cycle-timing');
  assert.deepEqual(readIndicatorState(params),state);
  state=changeIndicatorState(state,{action:'visibility',id:'cycle-timing'});
  assert.equal(state.primary,'cycle-timing');
  state=changeIndicatorState(state,{action:'visibility',id:'cycle-timing'});
  assert.equal(state.primary,'cycle-timing');
  state=changeIndicatorState(state,{action:'remove',id:'cycle-timing'});
  assert.equal(state.primary,null);
  assert.equal(changeIndicatorState(state,{action:'primary',id:'missing'}).primary,null);
});

test('chart value rows exclude duplicate display controls and preserve hidden indicator membership',()=>{
  const state=normalizeIndicatorState({added:INDICATORS.map(item=>item.id),hidden:['volume','cycle-timing']});
  const before=structuredClone(state),rows=chartIndicatorItems(state);
  assert.equal(rows[0].id,'volume');
  assert.equal(rows.length,INDICATORS.filter(item=>item.category!=='표시').length);
  assert.ok(rows.every(item=>item.category!=='표시'));
  assert.ok(rows.some(item=>item.id==='cycle-timing'));
  assert.ok(rows.some(item=>item.id==='cryptocon'));
  assert.deepEqual(state,before,'Rendering a stack must not rewrite saved membership or visibility');
  assert.deepEqual(chartIndicatorItems(normalizeIndicatorState({added:['readout','source','legend']})),[]);
});

test('legacy display-only primary links remain readable without restoring representative rows',()=>{
  for(const id of ['readout','source','legend']){
    const state=readIndicatorState(`indicators=readout,source,legend,volume,cycle-timing&indicator-primary=${id}&indicator-list=closed`);
    assert.equal(writeIndicatorState(new URLSearchParams(),state).get('indicator-primary'),id);
    assert.equal(state.primary,id);
    assert.equal(state.collapsed,true);
    assert.deepEqual(chartIndicatorItems(state).map(item=>item.id),['volume','cycle-timing']);
  }
});

test('applying an indicator template replaces only validated indicator state',()=>{
  const template={added:['volume','periods','invalid','volume'],hidden:['volume','invalid'],active:'periods',primary:'periods',collapsed:false,frequency:'1m'};
  const next=changeIndicatorState(readIndicatorState(''),{action:'replace',state:template});
  assert.deepEqual(next,normalizeIndicatorState(template));
  assert.deepEqual(next.added,['volume','periods']);
  assert.equal(next.primary,'periods');
  assert.equal(next.frequency,undefined);
  const params=writeIndicatorState(new URLSearchParams('granularity=1h&assumption=stress&type=candles'),next);
  assert.equal(params.get('granularity'),'1h');assert.equal(params.get('assumption'),'stress');assert.equal(params.get('type'),'candles');
  assert.deepEqual(readIndicatorState(params),next);
  assert.deepEqual(changeIndicatorState(next,{action:'replace'}),next);
});

test('price-view preparation preserves exact points and drawdowns while reusing identity during zoom',()=>{
  const rows=[{date:'2026-01-01',price:100},{date:'2026-01-02',price:80}],pivots=[{eventDate:'2026-01-01',eventPrice:100,type:'high',confirmationDate:'2026-01-02'}];
  const model={asOf:'2026-01-02',path:[{date:'2026-01-02',price:80},{date:'2026-01-03',price:70},{date:'2026-01-04',price:120},{date:'2026-01-05',price:90}],localTurns:[],events:[{inHorizon:true},{inHorizon:false}]};
  const prepared=preparePriceViewData(model,rows,pivots);
  assert.equal(prepared.rows.length,5);assert.ok(Math.abs(prepared.future[0].drawdownPct+30)<1e-12);assert.equal(prepared.future[1].drawdownPct,0);assert.equal(prepared.future[2].drawdownPct,-25);
  for(let i=0;i<20;i++)assert.strictEqual(preparePriceViewData(model,rows,pivots),prepared);
  assert.equal(prepared.actualTurns[0].confirmationDate,'2026-01-02');assert.equal(prepared.events.length,1);
  const revisedRows=[{date:'2026-01-01',price:200},rows[1]],revision=preparePriceViewData(model,revisedRows,pivots);
  assert.notStrictEqual(revision,prepared);assert.equal(revision.future[0].drawdownPct,-65);
  const revisedModel={...model,path:model.path.map(point=>({...point,price:point.price*2}))};
  assert.notStrictEqual(preparePriceViewData(revisedModel,revisedRows,pivots),revision);
});

test('countdown HUD distinguishes upcoming candidates, no candidate and unavailable paths',()=>{
  const current={currentLabel:'횡보',currentUntil:'2026-10-26',holdDays:5,minimumRunDays:7};
  const upcoming=countdownPresentation({...current,status:'upcoming',dday:'D-33',nextLabel:'상승'});
  assert.equal(upcoming.dday,'D-33');assert.equal(upcoming.next,'상승');assert.equal(upcoming.current,'현재 가정 횡보 · 2026.10.26까지');
  const maintained=countdownPresentation({...current,status:'maintained',currentRightCensored:true});
  assert.equal(maintained.dday,'—');assert.equal(maintained.next,'다음 후보 없음');assert.match(maintained.current,/까지 표시$/);
  const unavailable=countdownPresentation({...current,status:'unavailable',reason:'incomplete-future-path'});
  assert.equal(unavailable.dday,'—');assert.equal(unavailable.next,'다음 후보 계산 불가');assert.notEqual(unavailable.next,maintained.next);
});
