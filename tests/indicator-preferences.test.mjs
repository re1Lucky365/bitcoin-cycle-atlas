import assert from 'node:assert/strict';
import test from 'node:test';
import {normalizeIndicatorState,changeIndicatorState,readIndicatorState} from '../dist/indicator-state.js';
import {INDICATOR_PREFERENCES_KEY,MAX_INDICATOR_TEMPLATES,normalizeIndicatorPreferences,readIndicatorPreferences,writeIndicatorPreferences,toggleIndicatorFavorite,saveIndicatorTemplate,deleteIndicatorTemplate,indicatorLibraryItems,hasIndicatorTemplate} from '../dist/indicator-preferences.js';

test('added and favorite views preserve hidden membership and intersect the search query',()=>{
  let state=normalizeIndicatorState({added:['volume','cycles'],hidden:['volume']}),preferences=toggleIndicatorFavorite({},'cycles');
  preferences=toggleIndicatorFavorite(preferences,'drawdown');
  assert.deepEqual(indicatorLibraryItems({view:'added',state,preferences}).map(item=>item.id),['volume','cycles']);
  assert.deepEqual(indicatorLibraryItems({view:'favorites',state,preferences}).map(item=>item.id),['drawdown','cycles']);
  assert.deepEqual(indicatorLibraryItems({view:'favorites',query:'4년',state,preferences}).map(item=>item.id),['cycles']);
  state=changeIndicatorState(state,{action:'remove',id:'cycles'});
  assert.equal(preferences.favorites.includes('cycles'),true);
  assert.equal(indicatorLibraryItems({view:'added',state,preferences}).some(item=>item.id==='cycles'),false);
  assert.deepEqual(toggleIndicatorFavorite(preferences,'invalid'),preferences);
  assert.deepEqual(toggleIndicatorFavorite(preferences,'cycles').favorites,['drawdown']);
});

test('preferences survive reload without changing a fresh or shared chart state',()=>{
  const values=new Map(),storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
  const shared=readIndicatorState('indicators=volume,periods&indicator-hide=volume&chart=periods&indicator-primary=periods');
  let preferences=toggleIndicatorFavorite({},'cycles');
  preferences=saveIndicatorTemplate(preferences,'사이클 연구',shared).preferences;
  assert.equal(writeIndicatorPreferences(preferences,()=>storage),true);
  assert.deepEqual(readIndicatorPreferences(()=>storage),preferences);
  assert.deepEqual(readIndicatorState('indicators=volume'),normalizeIndicatorState({added:['volume']}));
  assert.equal(readIndicatorState('').added.includes('periods'),false);
  shared.added.push('fibonacci');
  assert.equal(preferences.templates[0].state.added.includes('fibonacci'),false);
  assert.match(values.get(INDICATOR_PREFERENCES_KEY),/사이클 연구/);
});

test('template replacement retains hidden, empty, collapsed and mobile preferences',()=>{
  const state=normalizeIndicatorState({added:['volume','cycles'],hidden:['volume'],active:'cycles',primary:'cycles',collapsed:true});
  let saved=saveIndicatorTemplate({},'  Research  ',state);
  assert.equal(saved.error,null);assert.equal(saved.replaced,false);assert.equal(saved.template.name,'Research');
  assert.deepEqual(saved.template.state,state);
  saved=saveIndicatorTemplate(saved.preferences,'research',normalizeIndicatorState({added:[]}));
  assert.equal(saved.replaced,true);assert.equal(saved.preferences.templates.length,1);assert.deepEqual(saved.template.state.added,[]);
  assert.equal(hasIndicatorTemplate(saved.preferences,' RESEARCH '),true);
  assert.deepEqual(deleteIndicatorTemplate(saved.preferences,' RESEARCH ').templates,[]);
});

test('invalid storage and blocked storage degrade without throwing or inventing saved data',()=>{
  const empty=normalizeIndicatorPreferences();
  for(const raw of ['{','null','[]','"bad"','{"favorites":true,"templates":5}'])assert.deepEqual(readIndicatorPreferences(()=>({getItem:()=>raw})),empty);
  assert.deepEqual(readIndicatorPreferences(()=>{throw new Error('SecurityError');}),empty);
  assert.equal(writeIndicatorPreferences({},()=>{throw new Error('SecurityError');}),false);
  assert.equal(writeIndicatorPreferences({},()=>({setItem(){throw new Error('QuotaExceededError');}})),false);
  assert.equal(writeIndicatorPreferences({},()=>null),false);
  const repaired=normalizeIndicatorPreferences({favorites:['volume','unknown','volume'],templates:[null,{name:'bad',state:{}},{name:'ok',state:{added:['volume','bad'],hidden:['bad'],primary:'bad'}}]});
  assert.deepEqual(repaired.favorites,['volume']);assert.equal(repaired.templates.length,1);assert.equal(repaired.templates[0].state.primary,null);
});

test('template names, capacity, and duplicates have explicit bounded behavior',()=>{
  let preferences=normalizeIndicatorPreferences();
  assert.ok(saveIndicatorTemplate(preferences,'   ',{}).error);
  assert.ok(saveIndicatorTemplate(preferences,'x'.repeat(41),{}).error);
  for(let i=0;i<MAX_INDICATOR_TEMPLATES;i++)preferences=saveIndicatorTemplate(preferences,`조합 ${i}`,{added:[]}).preferences;
  assert.ok(saveIndicatorTemplate(preferences,'초과',{}).error);
  assert.equal(saveIndicatorTemplate(preferences,'조합 0',{added:['volume']}).error,null);
  assert.equal(preferences.templates[0].state.added.length,0,'Saving never mutates the source preferences');
  const escaped=saveIndicatorTemplate({},'<img src=x onerror=alert(1)>',{added:['volume']});
  assert.equal(escaped.template.name,'<img src=x onerror=alert(1)>','Names remain plain data; the UI renders textContent');
});
