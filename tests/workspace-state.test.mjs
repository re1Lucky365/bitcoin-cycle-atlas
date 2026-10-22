import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeWorkspaceRange, readWorkspaceViewport, writeWorkspaceViewport, workspaceQuery, cleanWorkspaceQuery, readWorkspaces, saveWorkspace, writeWorkspaces, WORKSPACE_STORAGE_KEY, searchWorkspaceCommands } from '../dist/workspace-state.js';
import { normalizeIndicatorState, writeIndicatorState, readIndicatorState } from '../dist/indicator-state.js';

const memory = () => { const values=new Map();return {getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)}; };

test('sharing a panned indexed workspace retains hidden indicators and the mobile primary',()=>{
  const indicators=normalizeIndicatorState({added:['volume','states','periods'],hidden:['states'],active:'periods',primary:'volume',collapsed:true});
  const params=writeIndicatorState(new URLSearchParams('granularity=weekly&axis=linear&assumption=stress&page=data&utm_source=x'),indicators);
  const query=workspaceQuery(params,{frequency:'weekly',unit:'indexed',range:{start:'2024-03-04',end:'2025-04-05'}});
  const restored=new URLSearchParams(query);
  assert.deepEqual(readIndicatorState(restored),indicators);
  assert.deepEqual(readWorkspaceViewport(restored),{unit:'indexed',range:{start:'2024-03-04',end:'2025-04-05'}});
  assert.equal(restored.get('axis'),'linear');assert.equal(restored.get('assumption'),'stress');
  assert.equal(restored.has('page'),false);assert.equal(restored.has('utm_source'),false);
});

test('daily viewport rejects impossible dates and reversed bounds without blocking the page',()=>{
  for(const range of [{start:'2026-02-30',end:'2026-04-01'},{start:'2026-05-01',end:'2026-04-01'},{start:'2026-01-01',end:'2026-01-01'},{start:'<script>',end:'2027-01-01'}])assert.equal(normalizeWorkspaceRange(range),null);
  const params=new URLSearchParams('unit=anything&view-start=2026-02-30&view-end=2026-04-01');
  assert.deepEqual(readWorkspaceViewport(params),{unit:'usd',range:null});
  writeWorkspaceViewport(params);assert.equal(params.toString(),'');
});

test('intraday viewport preserves seconds on its candle grid and bounds history work',()=>{
  const start=Date.parse('2026-10-20T00:00:00Z')/1000;
  const params=new URLSearchParams('granularity=5m');
  writeWorkspaceViewport(params,{frequency:'5m',unit:'usd',range:{start,end:start+5999*300}});
  assert.deepEqual(readWorkspaceViewport(params).range,{start,end:start+5999*300});
  for(const range of [{start,end:start+6000*300},{start:start+1,end:start+600},{start:start*1000,end:(start+600)*1000},{start,end:Infinity}])assert.equal(normalizeWorkspaceRange(range,'5m'),null);
  assert.equal(readWorkspaceViewport(new URLSearchParams('granularity=1m&view-start=1e9&view-end=2e9')).range,null);
});

test('saved workspaces are bounded immutable snapshots and require explicit overwrite',()=>{
  const storage=memory(),original=[];
  let result=saveWorkspace(storage,original,{name:'주봉 장기',query:'granularity=weekly&indicator-hide=volume'});
  assert.equal(result.ok,true);assert.equal(original.length,0);
  assert.deepEqual(readWorkspaces(storage),result.items);
  const before=storage.getItem(WORKSPACE_STORAGE_KEY);
  assert.equal(saveWorkspace(storage,result.items,{name:'주봉 장기',query:'axis=linear'}).ok,false);
  assert.equal(storage.getItem(WORKSPACE_STORAGE_KEY),before);
  result=saveWorkspace(storage,result.items,{name:'주봉 장기',query:'axis=linear'},{overwrite:true});
  assert.equal(result.ok,true);assert.equal(readWorkspaces(storage)[0].query,'axis=linear');
  for(let i=1;i<8;i++)result=saveWorkspace(storage,result.items,{name:`화면${i}`,query:''});
  assert.equal(result.items.length,8);assert.equal(saveWorkspace(storage,result.items,{name:'초과',query:''}).ok,false);
});

test('unavailable or corrupt personal storage never produces a false save success',()=>{
  const denied={getItem(){throw new Error('denied');},setItem(){throw new Error('quota');}};
  assert.deepEqual(readWorkspaces(denied),[]);assert.equal(saveWorkspace(denied,[],{name:'보기',query:''}).ok,false);
  assert.equal(writeWorkspaces(null,[]).ok,false);
  const storage=memory();storage.setItem(WORKSPACE_STORAGE_KEY,'{broken');assert.deepEqual(readWorkspaces(storage),[]);
  storage.setItem(WORKSPACE_STORAGE_KEY,JSON.stringify({version:2,items:[{name:'보기',query:'axis=linear'}]}));assert.deepEqual(readWorkspaces(storage),[]);
});

test('workspace restoration cannot carry a destination, legacy mode or external payload',()=>{
  const query=cleanWorkspaceQuery('next=https://evil.example&legacy=1&page=compare&compare-unit=indexed&unit=indexed&axis=linear&view-start=2026-02-30&view-end=2026-12-31');
  assert.equal(query,'axis=linear&unit=indexed');
  assert.equal(cleanWorkspaceQuery('x'.repeat(5001)),'');
  assert.equal(cleanWorkspaceQuery(query),query);
});

test('command search matches all case-insensitive terms and excludes unavailable modes',()=>{
  const commands=[{label:'현재 범위 일별 가격 CSV',description:'Coin Metrics USD',keywords:'export data'},{label:'지표 즐겨찾기',keywords:'indicator favorite'},{label:'미래 가정',hidden:true}];
  assert.deepEqual(searchWorkspaceCommands(commands,'USD cSv'),[commands[0]]);
  assert.deepEqual(searchWorkspaceCommands(commands,'FAVORITE'),[commands[1]]);
  assert.deepEqual(searchWorkspaceCommands(commands,'미래'),[]);
  assert.equal(searchWorkspaceCommands(commands).length,2);
});
