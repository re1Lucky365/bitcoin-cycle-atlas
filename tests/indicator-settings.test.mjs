import assert from 'node:assert/strict';
import test from 'node:test';
import {INDICATOR_SETTINGS,normalizeIndicatorSettings,indicatorSettings,applyIndicatorPresentation} from '../dist/indicator-settings.js';
import {normalizeIndicatorState,changeIndicatorState,isIndicatorVisible,readIndicatorState,writeIndicatorState,visibleAnalysisIds} from '../dist/indicator-state.js';
import {saveIndicatorTemplate,readIndicatorPreferences,writeIndicatorPreferences} from '../dist/indicator-preferences.js';

test('settings accept only actual capabilities and bounded input options',()=>{
  const settings=normalizeIndicatorSettings({volume:{values:false,axisLabels:false,opacity:-10,lineWidth:90,fillOpacity:-4,intervals:['daily','daily','1h','bad'],inputs:{period:'monthly'},color:'red'},countdown:{opacity:.2,lineWidth:2,axisLabels:false,intervals:['1m','weekly']},periods:{inputs:{period:'quarterly',metric:'not-real',scope:'all',fake:10}},missing:{opacity:.4}});
  assert.deepEqual(settings.volume,{values:false,axisLabels:false,opacity:.15,lineWidth:3,fillOpacity:0,intervals:['1h','daily']});
  assert.deepEqual(settings.countdown,{intervals:['weekly']});
  assert.deepEqual(settings.periods,{inputs:{period:'quarterly',scope:'all'}});
  assert.equal(settings.missing,undefined);
  for(const invalid of [null,[],true,5])assert.deepEqual(normalizeIndicatorSettings(invalid),{});
  assert.equal(INDICATOR_SETTINGS.drawdown.fillOpacity,undefined,'drawdown has lines, not an adjustable filled area');
  assert.equal(INDICATOR_SETTINGS['cycle-timing'].lineWidth,undefined,'the timing ribbon has no adjustable graph line');
});

test('value visibility and supported intervals never rewrite membership, eye visibility or minimized state',()=>{
  const original=normalizeIndicatorState({added:['volume','cycles'],hidden:['volume'],minimized:['cycles'],collapsed:true});
  let state=changeIndicatorState(original,{action:'settings',id:'volume',patch:{values:false,intervals:['weekly'],fillOpacity:.3}});
  assert.deepEqual(state.added,original.added);assert.deepEqual(state.hidden,original.hidden);assert.deepEqual(state.minimized,original.minimized);assert.equal(state.collapsed,true);
  state=changeIndicatorState(state,{action:'visibility',id:'volume'});
  assert.equal(isIndicatorVisible(state,'volume'),true);assert.equal(isIndicatorVisible(state,'volume','daily'),false);assert.equal(isIndicatorVisible(state,'volume','weekly'),true);
  assert.equal(indicatorSettings(state,'volume').values,false);
  state=changeIndicatorState(state,{action:'settings',id:'volume',patch:{intervals:[]}});
  assert.equal(isIndicatorVisible(state,'volume'),true);assert.equal(isIndicatorVisible(state,'volume','weekly'),false);
  state=changeIndicatorState(state,{action:'settings-reset',id:'volume'});
  assert.equal(indicatorSettings(state,'volume').values,true);assert.equal(isIndicatorVisible(state,'volume','1m'),true);
});

test('settings and pane geometry round-trip in URLs and templates, including legacy real inputs',()=>{
  const legacy=readIndicatorState('indicators=cycles,periods,cryptocon&align=halving&interval=quarterly&measure=discoveryDays&scope=all&audit=targets');
  assert.equal(indicatorSettings(legacy,'cycles').inputs.alignment,'halving');assert.equal(indicatorSettings(legacy,'cryptocon').inputs.view,'targets');
  const original=normalizeIndicatorState({...legacy,added:[...legacy.added,'volume'],settings:{...legacy.settings,volume:{values:false,axisLabels:false,lineWidth:1.75,fillOpacity:.4,intervals:['1h','weekly']}},paneOrder:['cryptocon','periods','cycles'],paneHeights:{cycles:420,periods:280},maximized:'periods',minimized:['cycles'],collapsed:true});
  const query=writeIndicatorState(new URLSearchParams('granularity=1h&from=2026-01-01&assumption=late'),original);
  assert.deepEqual(readIndicatorState(query),original);assert.equal(query.get('granularity'),'1h');assert.equal(query.get('from'),'2026-01-01');assert.equal(query.get('assumption'),'late');
  const saved=saveIndicatorTemplate({},'Research settings',original),storage=new Map();
  writeIndicatorPreferences(saved.preferences,()=>({setItem:(key,value)=>storage.set(key,value)}));
  const restored=readIndicatorPreferences(()=>({getItem:key=>storage.get(key)})).templates[0].state;
  assert.deepEqual(restored,original);
  const cleared=changeIndicatorState(original,{action:'settings-reset',id:'periods'}),clearedQuery=writeIndicatorState(new URLSearchParams('measure=discoveryDays'),cleared);
  assert.deepEqual(readIndicatorState(clearedQuery),cleared,'an explicitly reset input cannot revive stale legacy query settings');
});

test('pane order, height, maximum, minimize and hidden states remain independent across 0, 1 and 5 panes',()=>{
  const ids=['cycles','duration','peaks','periods','cryptocon'];
  for(const added of [[],ids.slice(0,1),ids]){
    let state=normalizeIndicatorState({added,paneOrder:[...ids].reverse(),paneHeights:{cycles:10,periods:10000,peaks:'400',cryptocon:Infinity},maximized:'not-an-id'});
    assert.deepEqual(visibleAnalysisIds(state),[...added].reverse());assert.equal(state.maximized,null);
    if(!added.length){assert.deepEqual(state.paneHeights,{});continue;}
    assert.equal(state.paneHeights.cycles,240);
    if(added.length===5)assert.equal(state.paneHeights.periods,900);
    const before=structuredClone(state);state=changeIndicatorState(state,{action:'maximize',id:'cycles'});
    assert.deepEqual(visibleAnalysisIds(state),['cycles']);assert.deepEqual(state.added,before.added);assert.deepEqual(state.paneHeights,before.paneHeights);
    state=changeIndicatorState(state,{action:'maximize',id:'cycles'});assert.deepEqual(state,{...before,active:'cycles'});
    state=changeIndicatorState(state,{action:'resize',id:'cycles',height:472});state=changeIndicatorState(state,{action:'minimize',id:'cycles'});state=changeIndicatorState(state,{action:'visibility',id:'cycles'});
    assert.equal(state.paneHeights.cycles,472);assert.ok(state.minimized.includes('cycles'));
    assert.deepEqual(readIndicatorState(writeIndicatorState(new URLSearchParams(),state)),state);
  }
  let state=normalizeIndicatorState({added:ids});state=changeIndicatorState(state,{action:'move',id:'cycles',direction:1});
  assert.deepEqual(state.paneOrder,['duration','cycles','peaks','periods','cryptocon']);assert.deepEqual(state.added,ids);
  state=changeIndicatorState(state,{action:'settings',id:'cycles',patch:{intervals:['weekly']}});state=changeIndicatorState(state,{action:'maximize',id:'cycles'});
  assert.deepEqual(visibleAnalysisIds(state,'daily'),['duration','peaks','periods','cryptocon'],'an unsupported maximum never blanks all supported panes');
});

// A minimal attribute tree exercises the production presentation boundary, not
// browser painting. Full browser SVG/layout verification is recorded separately.
class Node {
  constructor(attrs={},children=[]){this.attrs=new Map(Object.entries(attrs).map(([key,value])=>[key,String(value)]));this.children=children;}
  getAttribute(key){return this.attrs.get(key)??null;}
  setAttribute(key,value){this.attrs.set(key,String(value));}
  removeAttribute(key){this.attrs.delete(key);}
  matches(selector){return selector.split(',').some(part=>{part=part.trim();if(part.startsWith('.'))return (this.getAttribute('class')||'').split(' ').includes(part.slice(1));const attr=part.match(/^\[([^\]]+)\]$/)?.[1];return Boolean(attr&&this.attrs.has(attr));});}
  querySelectorAll(selector){return this.children.flatMap(node=>[...(node.matches(selector)?[node]:[]),...node.querySelectorAll(selector)]);}
}

test('presentation multiplies actual line and fill attributes once, keeps coordinates and restores the original style',()=>{
  const line=new Node({'data-indicator-line':'',d:'M4,5L8,9',stroke:'#c0ffee','stroke-width':'1.6','stroke-dasharray':'4 3'}),fill=new Node({'data-indicator-fill':'',x:12,y:18,width:5,height:40,fill:'#123456',opacity:'.08'}),axis=new Node({'data-indicator-axis-label':'',x:600,y:40}),source=new Node({class:'volume-pane-title'}),grid=new Node({'stroke-width':'.5'});
  const volume=new Node({'data-indicator-layer':'volume',opacity:'.9'},[line,fill,axis,source,grid]),price=new Node({class:'observed-close-line',d:'M2,1L5,7','stroke-width':1.8}),svg=new Node({},[volume,price]);
  const state=normalizeIndicatorState({added:['volume'],settings:{volume:{opacity:.5,lineWidth:2,fillOpacity:.4,axisLabels:false,values:false}}});
  for(let index=0;index<3;index++)applyIndicatorPresentation(svg,state,'daily');
  assert.equal(volume.getAttribute('opacity'),'.45'.replace(/^\./,'0.'));assert.equal(line.getAttribute('stroke-width'),'3.2');assert.equal(fill.getAttribute('fill-opacity'),'0.4');assert.equal(fill.getAttribute('opacity'),'.08');assert.equal(axis.getAttribute('visibility'),'hidden');
  assert.equal(line.getAttribute('d'),'M4,5L8,9');assert.equal(line.getAttribute('stroke'),'#c0ffee');assert.equal(line.getAttribute('stroke-dasharray'),'4 3');assert.equal(fill.getAttribute('y'),'18');assert.equal(grid.getAttribute('stroke-width'),'.5');assert.equal(price.getAttribute('stroke-width'),'1.8');assert.equal(source.getAttribute('visibility'),null);
  applyIndicatorPresentation(svg,normalizeIndicatorState({added:['volume']}),'daily');
  assert.equal(volume.getAttribute('opacity'),'.9');assert.equal(line.getAttribute('stroke-width'),'1.6');assert.equal(fill.getAttribute('fill-opacity'),null);assert.equal(axis.getAttribute('visibility'),null);assert.equal(axis.getAttribute('aria-hidden'),null);
  applyIndicatorPresentation(svg,{settings:{volume:{intervals:['weekly']}}},'daily');assert.equal(volume.getAttribute('display'),'none');
  applyIndicatorPresentation(svg,{settings:{}},'daily');assert.equal(volume.getAttribute('display'),null);
});

test('new selected marker and period nodes receive their own baseline instead of inheriting a previous selection width',()=>{
  const marker=new Node({'data-indicator-layer':'cycle-landmarks'},[new Node({class:'cycle-marker-ring','stroke-width':2.6,cx:100,cy:200})]),period=new Node({'data-indicator-layer':'cycle-intervals'},[new Node({class:'cycle-interval-line','stroke-width':1.2,x1:100,x2:430,'stroke-dasharray':'5 3'})]),svg=new Node({},[marker,period]);
  const state={settings:{'cycle-landmarks':{lineWidth:2},'cycle-intervals':{lineWidth:.5}}};applyIndicatorPresentation(svg,state,'weekly');
  assert.equal(marker.children[0].getAttribute('stroke-width'),'5.2');assert.equal(period.children[0].getAttribute('stroke-width'),'0.6');
  marker.children=[new Node({class:'cycle-marker-ring','stroke-width':1.5,cx:100,cy:200})];applyIndicatorPresentation(svg,state,'weekly');
  assert.equal(marker.children[0].getAttribute('stroke-width'),'3');assert.equal(period.children[0].getAttribute('stroke-width'),'0.6');assert.equal(period.children[0].getAttribute('x2'),'430');
});
