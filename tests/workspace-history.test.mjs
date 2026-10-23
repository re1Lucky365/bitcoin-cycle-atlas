import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspaceHistory,captureHistoryCommand,historyShortcut} from '../dist/workspace-history.js';

test('one drag records its final viewport once and restores raw price bounds',()=>{
  let state={x:0,y:{min:10,max:100},unit:'usd'},priceRevision=1;
  const history=createWorkspaceHistory({read:()=>state,apply:snapshot=>{state=snapshot;}});
  history.begin('이동');for(let x=1;x<=30;x++)state={...state,x,y:{min:x,max:x+90}};history.commit();
  priceRevision=2;
  assert.equal(history.status().undoCount,1);assert.equal(history.undo(),true);
  assert.deepEqual(state,{x:0,y:{min:10,max:100},unit:'usd'});assert.equal(priceRevision,2);
  assert.equal(history.redo(),true);assert.deepEqual(state.y,{min:30,max:120});
});

test('delegated nested commands form one transaction and no-op commands retain redo',()=>{
  let state={unit:'usd',range:[1,2]},queue=[];
  const history=createWorkspaceHistory({read:()=>state,apply:s=>{state=s;}});
  captureHistoryCommand(history,'설정',job=>queue.push(job));
  history.run('단위',()=>{state.unit='percent';});
  captureHistoryCommand(history,'범위',job=>queue.push(job));state.range=[2,3];
  for(const job of queue)job();assert.equal(history.status().undoCount,1);
  history.undo();history.run('변경 없음',()=>{});assert.equal(history.status().canRedo,true);
  history.run('새 변경',()=>{state.unit='indexed';});assert.equal(history.status().canRedo,false);
});

test('history is bounded, immutable and never records reads or hover updates',()=>{
  let state={settings:{width:1}},hover=0;
  const history=createWorkspaceHistory({read:()=>state,apply:s=>{state=s;},limit:3});
  for(let width=2;width<=6;width++)history.run('두께',()=>{state.settings.width=width;});
  state.settings.width=99;hover++;history.status();
  assert.equal(history.status().undoCount,3);history.undo();assert.equal(state.settings.width,5);
  history.undo();history.undo();assert.equal(state.settings.width,3);assert.equal(history.undo(),false);assert.equal(hover,1);
});

test('restore failure leaves the history entry intact and resets restoration guard',()=>{
  let state=1,fail=true;
  const history=createWorkspaceHistory({read:()=>state,apply:value=>{if(fail)throw new Error('cancel failed');state=value;}});
  history.run('value',()=>{state=2;});assert.throws(()=>history.undo(),/cancel failed/);
  assert.equal(history.restoring,false);assert.equal(history.status().undoCount,1);fail=false;history.undo();assert.equal(state,1);
});

test('shortcut leaves editing/native dialogs alone and supports both redo gestures',()=>{
  const event=(extra={})=>({key:'z',ctrlKey:true,target:{closest:()=>null},...extra});
  assert.equal(historyShortcut(event()),'undo');assert.equal(historyShortcut(event({shiftKey:true})),'redo');
  assert.equal(historyShortcut(event({key:'y'})),'redo');assert.equal(historyShortcut(event({ctrlKey:false,metaKey:true})),'undo');
  for(const extra of [{defaultPrevented:true},{altKey:true},{target:{closest:()=>({})}},{ctrlKey:false}])assert.equal(historyShortcut(event(extra)),null);
});
