import assert from 'node:assert/strict';
import test from 'node:test';
import {compactChartLayout,mountCompactChartLayout} from '../dist/compact-chart-layout.js';

test('320/390/456/620 compact budgets keep open values and zero/one/five research panes below the HUD without growing the price canvas',()=>{
  for(const [width,height] of [[320,589],[390,693],[456,765],[620,680]])for(const visiblePanes of [0,1,5])for(const listSize of ['small','balanced','large']){
    const input={width,height,hudBottom:128,managerVisible:true,collapsed:false,listContentHeight:400,visiblePanes,listSize},before={...input};
    const layout=compactChartLayout(input);
    assert.equal(layout.enabled,true);assert.equal(layout.mode,'stack');assert.equal(layout.listWidth,width-16);
    assert.ok(layout.top>=input.hudBottom+6);assert.ok(layout.listHeight>=34);
    assert.ok(layout.analysisTop>=layout.top+layout.managerHeight);
    if(visiblePanes){assert.ok(layout.analysisHeight>=176);assert.ok(layout.analysisTop+layout.analysisHeight<=height-32);}
    assert.deepEqual(input,before);
  }
});

test('short landscape uses disjoint columns and a tall single-column viewport uses only the requested list height',()=>{
  for(const width of [620,762,844,1000]){
    const layout=compactChartLayout({width,height:287,hudBottom:112,managerVisible:true,collapsed:false,listContentHeight:500,visiblePanes:5,listSize:'large'});
    assert.equal(layout.mode,'columns');assert.equal(layout.analysisTop,layout.top);
    assert.ok(layout.analysisLeft>=8+layout.listWidth+6);assert.ok(width-8-layout.analysisLeft>=300);
    assert.ok(layout.analysisHeight>=130);assert.ok(layout.managerHeight<=layout.available);
  }
  assert.equal(compactChartLayout({width:1000,height:600}).enabled,false);
  assert.equal(compactChartLayout({width:390,height:693,managerVisible:true,collapsed:false,listContentHeight:34}).listHeight,34);
});

test('folding or hiding the value list reclaims its slot without modifying pane state or imposing a 330px upward offset',()=>{
  const common={width:320,height:589,hudBottom:132,visiblePanes:5,listContentHeight:400};
  const open=compactChartLayout({...common,managerVisible:true,collapsed:false});
  const folded=compactChartLayout({...common,managerVisible:true,collapsed:true});
  const absent=compactChartLayout({...common,managerVisible:false,collapsed:false});
  assert.equal(folded.listHeight,0);assert.equal(folded.managerHeight,28);assert.equal(absent.managerHeight,0);
  assert.ok(folded.analysisTop<open.analysisTop);assert.equal(absent.analysisTop,138);
  assert.ok(folded.analysisTop>=common.hudBottom);assert.ok(absent.analysisTop>=common.hudBottom);
});

// This fixture checks real controller events/measurements/state preservation.
// Native CSS wrapping, focus scrolling and touch are browser QA boundaries.
class Surface{
  listeners=new Map();
  addEventListener(type,handler){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(handler);}
  removeEventListener(type,handler){this.listeners.get(type)?.delete(handler);}
  dispatchEvent(event){for(const handler of this.listeners.get(event.type)||[])handler(event);}
}
class Element extends Surface{
  constructor(tag,doc){super();this.tagName=tag;this.ownerDocument=doc;this.children=[];this.dataset={};this.attrs=new Map();this.hidden=false;this.box={top:0,height:0,width:0};this.writes=0;const styles=new Map();this.style={setProperty:(key,value)=>{styles.set(key,value);this.writes++;},getPropertyValue:key=>styles.get(key)||'',removeProperty:key=>styles.delete(key)};}
  append(...nodes){for(const node of nodes){node.remove();node.parentElement=this;this.children.push(node);}}
  prepend(node){node.remove();node.parentElement=this;this.children.unshift(node);}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(node=>node!==this);this.parentElement=null;}
  setAttribute(key,value){this.attrs.set(key,value);}getAttribute(key){return this.attrs.get(key);}
  focus(){this.ownerDocument.activeElement=this;}
  getBoundingClientRect(){return {...this.box,bottom:this.box.top+this.box.height};}
  matches(selector){if(selector==='[hidden]')return this.hidden;if(selector[0]==='.')return this.className?.split(' ').includes(selector.slice(1));if(selector[0]==='#')return this.id===selector.slice(1);return this.tagName===selector;}
  closest(selector){return this.matches(selector)?this:this.parentElement?.closest(selector)||null;}
  querySelectorAll(selector){return this.children.flatMap(node=>[...(node.matches(selector)?[node]:[]),...node.querySelectorAll(selector)]);}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
}
function fixture({width=390,height=693,collapsed=false,panes=5}={}){
  const doc=new Surface(),win=new Surface(),observers=[];doc.defaultView=win;
  class Resize{constructor(callback){this.callback=callback;this.nodes=[];observers.push(this);}observe(node){this.nodes.push(node);}disconnect(){this.nodes=[];}}
  win.ResizeObserver=Resize;
  doc.createElement=tag=>new Element(tag,doc);doc.body=doc.createElement('body');doc.activeElement=doc.body;
  const add=(parent,tag,className,box={})=>{const node=doc.createElement(tag);node.className=className;node.box={...node.box,...box};parent.append(node);return node;};
  const plot=add(doc.body,'div','atlas-plot',{top:40,width,height}),readout=add(plot,'div','atlas-readout',{top:48,height:38,width:320});readout.id='lab-metrics';
  const source=add(plot,'p','workbench-market-info',{top:90,height:18,width:320}),legend=add(plot,'div','lab-chart-foot',{top:114,height:50,width:220});
  const manager=add(plot,'section','chart-indicator-manager');manager.dataset.collapsed=String(collapsed);
  const list=add(manager,'div','chart-indicator-list');list.id='chart-indicator-list';list.scrollHeight=420;list.hidden=collapsed;
  const fold=add(manager,'button','indicator-legend-toggle');fold.setAttribute('aria-expanded',String(!collapsed));
  const windows=add(plot,'section','analysis-indicator-windows');windows.dataset.minimizedAll='false';windows.hidden=!panes;
  for(let index=0;index<panes;index++){const card=add(windows,'article','analysis-indicator-window');card.dataset.minimized=String(index===1);}
  const commands=[];doc.addEventListener('atlas:indicator-command',event=>commands.push(event.detail));
  fold.focus();const controller=mountCompactChartLayout({plot});
  return {doc,win,plot,readout,source,legend,manager,list,fold,windows,commands,controller,observers,select:manager.querySelector('select')};
}

test('measured HUD bottoms, explicit list height and focus mode preserve canonical visibility/folds and the existing fold control',async()=>{
  const f=fixture(),state=()=>JSON.stringify({collapsed:f.manager.dataset.collapsed,listHidden:f.list.hidden,windowsHidden:f.windows.hidden,panes:f.windows.children.map(card=>({hidden:card.hidden,minimized:card.dataset.minimized}))});
  const before=state();assert.equal(f.plot.style.getPropertyValue('--compact-content-top'),'130px');assert.equal(f.doc.activeElement,f.fold);
  assert.equal(f.fold.parentElement.className,'compact-indicator-controls');assert.equal(f.select.getAttribute('aria-controls'),'chart-indicator-list');
  const initialTop=Number.parseFloat(f.plot.style.getPropertyValue('--compact-analysis-top'));
  f.select.value='small';f.select.dispatchEvent({type:'change'});assert.equal(f.plot.style.getPropertyValue('--compact-list-max-height'),'56px');assert.ok(Number.parseFloat(f.plot.style.getPropertyValue('--compact-analysis-top'))<initialTop);
  const writes=f.plot.writes;f.controller.refresh();assert.equal(f.plot.writes,writes,'unchanged geometry produces no style writes');
  f.plot.dataset.chartFocus='true';f.legend.box.height=0;f.readout.box.height=0;f.source.box.height=0;f.doc.dispatchEvent({type:'atlas:chart-focus',detail:{focused:true}});await Promise.resolve();
  assert.equal(f.plot.writes,writes);assert.equal(state(),before);
  f.legend.box.height=66;f.readout.box.height=38;f.source.box.height=18;f.plot.dataset.chartFocus='false';f.doc.dispatchEvent({type:'atlas:chart-focus',detail:{focused:false}});await Promise.resolve();
  assert.equal(f.plot.style.getPropertyValue('--compact-content-top'),'146px');assert.equal(f.plot.style.getPropertyValue('--compact-list-max-height'),'56px');assert.equal(state(),before);assert.deepEqual(f.commands,[]);
  f.controller.destroy();assert.equal(f.fold.parentElement,f.manager);assert.equal(f.plot.dataset.compactLayout,undefined);assert.equal(f.manager.querySelector('.compact-indicator-controls'),null);
});

test('observed resize and hidden HUD changes are coalesced, desktop exits cleanly and a folded list stays folded',async()=>{
  const f=fixture({width:320,height:589,collapsed:true});
  assert.equal(f.manager.querySelector('.compact-list-size').hidden,true);assert.equal(f.plot.style.getPropertyValue('--compact-list-max-height'),'0px');
  f.legend.hidden=true;for(const observer of f.observers){observer.callback([]);observer.callback([]);}await Promise.resolve();
  assert.equal(f.plot.style.getPropertyValue('--compact-content-top'),'74px');assert.equal(f.manager.dataset.collapsed,'true');assert.equal(f.list.hidden,true);
  f.plot.box.width=1200;f.plot.box.height=833;f.win.dispatchEvent({type:'resize'});await Promise.resolve();assert.equal(f.plot.dataset.compactLayout,undefined);assert.equal(f.fold.parentElement,f.manager);
  f.plot.box.width=456;f.win.dispatchEvent({type:'resize'});await Promise.resolve();assert.equal(f.plot.dataset.compactLayout,'stack');assert.equal(f.fold.parentElement.className,'compact-indicator-controls');
  f.controller.destroy();const writes=f.plot.writes;for(const observer of f.observers)observer.callback([]);await Promise.resolve();assert.equal(f.plot.writes,writes);assert.deepEqual(f.commands,[]);
});

test('a CSS-hidden mobile legend contributes no empty HUD slot while the upper-left values remain usable',()=>{
  const f=fixture({width:320,height:589});
  f.legend.box.height=0;assert.equal(f.legend.hidden,false,'the mobile rule hides only its layout, not the user preference');
  f.controller.refresh();assert.equal(f.plot.style.getPropertyValue('--compact-content-top'),'74px');
  assert.equal(f.plot.style.getPropertyValue('--compact-list-max-height'),'112px');assert.equal(f.manager.dataset.collapsed,'false');
  f.controller.destroy();
});
