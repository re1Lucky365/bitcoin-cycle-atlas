import assert from 'node:assert/strict';
import test from 'node:test';
import { mountAnalysisIndicators } from '../dist/analysis-dock.js';
import { normalizeIndicatorState, changeIndicatorState } from '../dist/indicator-state.js';

// Event/focus boundary for the shipped analysis controller. Browser geometry,
// sticky positioning and native scrolling are verified separately in the app.
class Surface {
  listeners = new Map();
  addEventListener(type,handler){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(handler);}
  removeEventListener(type,handler){this.listeners.get(type)?.delete(handler);}
  dispatchEvent(event){for(const handler of this.listeners.get(event.type)||[])handler(event);}
}
class Element extends Surface {
  constructor(tag,doc){super();this.tagName=tag;this.ownerDocument=doc;this.children=[];this.dataset={};this.attributes=new Map();this._hidden=false;const style=new Map();this.style={setProperty:(key,value)=>style.set(key,value),getPropertyValue:key=>style.get(key)||''};}
  get isConnected(){return this===this.ownerDocument.body||Boolean(this.parentElement?.isConnected);}
  get hidden(){return this._hidden;}
  set hidden(value){this._hidden=Boolean(value);if(value&&this.contains(this.ownerDocument.activeElement))this.ownerDocument.activeElement=this.ownerDocument.body;}
  append(...nodes){for(const node of nodes){node.remove();node.parentElement=this;this.children.push(node);}}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(node=>node!==this);this.parentElement=null;}
  setAttribute(key,value){this.attributes.set(key,value);}
  getAttribute(key){return this.attributes.get(key)??null;}
  removeAttribute(key){this.attributes.delete(key);}
  contains(node){return node===this||this.children.some(child=>child.contains?.(node));}
  focus(){if(!this.closest('[hidden]')&&!this.disabled)this.ownerDocument.activeElement=this;}
  click(){if(!this.disabled)this.onclick?.({target:this});}
  getBoundingClientRect(){return {height:Number.parseFloat(this.style.getPropertyValue('--analysis-pane-height'))||330,width:300,left:0,top:0};}
  setPointerCapture(id){this.captured=id;}
  releasePointerCapture(){this.captured=null;}
  matches(selector){
    if(selector.includes(','))return selector.split(',').some(part=>this.matches(part.trim()));
    if(selector==='[hidden]')return this.hidden;
    if(selector==='dialog[open]')return this.tagName==='dialog'&&this.open;
    if(selector.startsWith('.'))return this.className?.split(' ').includes(selector.slice(1));
    if(selector.startsWith('#'))return this.id===selector.slice(1);
    const data=selector.match(/^\[data-([\w-]+)(?:="([^"]*)")?\]$/);
    if(data){const key=data[1].replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase());return data[2]===undefined?key in this.dataset:this.dataset[key]===data[2];}
    return this.tagName===selector;
  }
  closest(selector){return this.matches(selector)?this:this.parentElement?.closest(selector)||null;}
  querySelectorAll(selector){
    const parts=selector.split(' '),last=parts.pop(),nodes=this.children.flatMap(node=>[node,...node.querySelectorAll('*')]);
    return nodes.filter(node=>{if(last!=='*'&&!node.matches(last))return false;let parent=node.parentElement;for(const part of [...parts].reverse()){while(parent&&!parent.matches(part))parent=parent.parentElement;if(!parent)return false;parent=parent.parentElement;}return true;});
  }
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
}
function fixture(){
  const doc=new Surface();doc.createElement=tag=>new Element(tag,doc);doc.createElementNS=(_,tag)=>doc.createElement(tag);doc.createTextNode=text=>Object.assign(doc.createElement('#text'),{textContent:text});
  doc.body=doc.createElement('body');doc.activeElement=doc.body;doc.querySelector=selector=>doc.body.querySelector(selector);doc.querySelectorAll=selector=>doc.body.querySelectorAll(selector);doc.getElementById=id=>doc.querySelector(`#${id}`);
  const add=(parent,tag,className)=>{const node=doc.createElement(tag);node.className=className;parent.append(node);return node;};
  const opener=add(doc.body,'button');opener.id='atlas-mode-menu';
  const stage=add(doc.body,'section'),plot=add(stage,'div','atlas-plot'),svg=add(stage,'svg'),tabs=add(stage,'div');
  const controller=mountAnalysisIndicators({stage,svg,modeTabs:tabs,controls:[]});
  const legend=add(plot,'section'),row=add(legend,'div');row.dataset.indicatorRow='cycles';const eye=add(row,'button');eye.dataset.indicatorAction='visibility';
  let state;
  const publish=()=>doc.dispatchEvent({type:'atlas:indicator-state',detail:{indicators:state}});
  const update=(value={})=>{state=normalizeIndicatorState({added:['cycles'],active:'cycles',...value});publish();};
  doc.addEventListener('atlas:indicator-command',event=>{state=changeIndicatorState(state,event.detail);publish();});
  update();const header=controller.views.get('cycles').card.querySelector('.analysis-window-heading'),hide=header.querySelector('[data-analysis-action="visibility"]');
  return {doc,controller,opener,legend,row,eye,hide,update,publish,get state(){return state;}};
}

test('a removed or hidden focused analysis returns focus after the legend has processed the same state event',async()=>{
  for(const removed of [false,true]){
    const f=fixture();f.hide.focus();f.update(removed?{added:[]}:{hidden:['cycles']});
    if(removed)f.row.remove();
    assert.equal(f.doc.activeElement,f.doc.body,'the hidden native control cannot retain usable focus');
    await Promise.resolve();assert.equal(f.doc.activeElement,removed?f.opener:f.eye);
    f.controller.destroy();
  }
});

test('a folded or fully hidden indicator row is never selected as the focus return target',async()=>{
  for(const hiddenNode of ['row','legend']){
    const f=fixture();f[hiddenNode].hidden=true;f.hide.focus();f.update({hidden:['cycles']});await Promise.resolve();
    assert.equal(f.doc.activeElement,f.opener);f.controller.destroy();
  }
});

test('deferred focus return does not steal a newly focused control or an open modal',async()=>{
  for(const modal of [false,true]){
    const f=fixture(),next=f.doc.createElement(modal?'dialog':'button');f.doc.body.append(next);if(modal)next.open=true;
    f.hide.focus();f.update({hidden:['cycles']});next.focus();await Promise.resolve();
    assert.equal(f.doc.activeElement,next);f.controller.destroy();
  }
});

test('destroying the controller cancels a pending focus handoff',async()=>{
  const f=fixture();f.hide.focus();f.update({hidden:['cycles']});f.controller.destroy();await Promise.resolve();assert.equal(f.doc.activeElement,f.doc.body);
});

test('analysis minus folds only its body and the same header button restores the retained chart',()=>{
  const f=fixture();f.update({added:['cycles','periods']});
  const cycles=f.controller.views.get('cycles'),periods=f.controller.views.get('periods'),chart=cycles.chart;
  cycles.minimize.focus();cycles.minimize.click();
  assert.deepEqual(f.state.minimized,['cycles']);assert.deepEqual(f.state.hidden,[]);assert.deepEqual(f.state.added,['cycles','periods']);
  assert.equal(cycles.card.hidden,false);assert.equal(cycles.body.hidden,true);assert.equal(periods.body.hidden,false);
  assert.equal(cycles.minimize.closest('[hidden]'),null);assert.equal(cycles.minimize.getAttribute('aria-expanded'),'false');
  assert.equal(f.doc.activeElement,cycles.minimize);assert.strictEqual(cycles.chart,chart);
  cycles.minimize.click();
  assert.equal(cycles.body.hidden,false);assert.deepEqual(f.state.minimized,[]);assert.equal(cycles.minimize.getAttribute('aria-expanded'),'true');
  assert.strictEqual(cycles.chart,chart);f.controller.destroy();
});

test('hiding a minimized pane preserves its independent fold when the eye shows it again',()=>{
  const f=fixture(),cycles=f.controller.views.get('cycles');
  cycles.minimize.click();f.hide.click();
  assert.deepEqual(f.state.minimized,['cycles']);assert.deepEqual(f.state.hidden,['cycles']);assert.equal(cycles.card.hidden,true);
  f.doc.dispatchEvent(new CustomEvent('atlas:indicator-command',{detail:{action:'visibility',id:'cycles'}}));
  assert.equal(cycles.card.hidden,false);assert.equal(cycles.body.hidden,true);assert.equal(cycles.minimize.closest('[hidden]'),null);
  assert.equal(f.controller.element.dataset.minimizedAll,'true');f.controller.destroy();
});

test('folding a pane with keyboard focus inside it moves focus to its visible restore button',()=>{
  const f=fixture(),cycles=f.controller.views.get('cycles');cycles.chart.focus();
  f.update({minimized:['cycles']});
  assert.equal(f.doc.activeElement,cycles.minimize);assert.equal(cycles.body.hidden,true);assert.equal(cycles.card.hidden,false);
  f.controller.destroy();
});

test('zero, one and five panes maximize and restore without removing another study or changing an axis SVG',()=>{
  for(const added of [[],['cycles'],['cycles','duration','peaks','periods','cryptocon']]){
    const f=fixture();f.update({added,minimized:added.includes('periods')?['periods']:[]});
    const cards=[...f.controller.views.values()],charts=cards.map(view=>view.chart);
    assert.equal(f.controller.element.hidden,added.length===0);assert.equal(cards.filter(view=>!view.card.hidden).length,added.length);
    if(added.length){
      const cycles=f.controller.views.get('cycles');f.controller.element.scrollTop=added.length>1?420:0;cycles.maximize.focus();cycles.maximize.click();
      assert.equal(f.controller.element.dataset.maximized,'true');assert.deepEqual(f.state.added,added);assert.equal(cards.filter(view=>!view.card.hidden).length,1);assert.equal(cycles.resize.hidden,true);assert.equal(cycles.maximize.getAttribute('aria-pressed'),'true');
      assert.equal(f.controller.element.scrollTop,0);cycles.maximize.click();assert.equal(f.controller.element.dataset.maximized,'false');assert.equal(cards.filter(view=>!view.card.hidden).length,added.length);assert.equal(cycles.resize.hidden,false);assert.equal(f.controller.element.scrollTop,added.length>1?420:0);
      if(added.includes('periods'))assert.equal(f.controller.views.get('periods').body.hidden,true,'the other pane retains its own minimized state');
    }
    assert.deepEqual(cards.map(view=>view.chart),charts);f.controller.destroy();
  }
});

test('reorder changes DOM and keyboard order together while keeping the focused control and chart instances',()=>{
  const f=fixture();f.update({added:['cycles','duration','periods']});
  const cycles=f.controller.views.get('cycles'),chart=cycles.chart;cycles.down.focus();cycles.down.click();
  assert.deepEqual(f.state.paneOrder,['duration','cycles','periods']);assert.deepEqual(f.controller.element.children.slice(0,3).map(card=>card.dataset.analysisMode),f.state.paneOrder);assert.equal(f.doc.activeElement,cycles.down);assert.strictEqual(cycles.chart,chart);
  cycles.up.click();assert.deepEqual(f.state.paneOrder,['cycles','duration','periods']);assert.equal(cycles.up.disabled,true);assert.equal(f.controller.views.get('periods').down.disabled,true);f.controller.destroy();
});

test('boundary drag previews height through publishes and commits once, while cancel and keyboard preserve pane independence',()=>{
  const f=fixture();f.update({added:['cycles','periods'],paneHeights:{cycles:400,periods:300}});
  const cycles=f.controller.views.get('cycles'),periods=f.controller.views.get('periods'),commands=[];f.doc.addEventListener('atlas:indicator-command',event=>{if(event.detail.action==='resize')commands.push(event.detail);});
  const pointer=(type,y,id=1)=>cycles.resize.dispatchEvent({type,button:0,pointerId:id,clientY:y,preventDefault(){}});
  pointer('pointerdown',300);pointer('pointermove',350);assert.equal(cycles.card.style.getPropertyValue('--analysis-pane-height'),'450px');assert.equal(f.state.paneHeights.cycles,400);f.publish();assert.equal(cycles.card.style.getPropertyValue('--analysis-pane-height'),'450px','a chart resize publish must not cancel the drag preview');
  pointer('pointermove',390);pointer('pointerup',390);assert.equal(f.state.paneHeights.cycles,490);assert.equal(commands.length,1);assert.equal(periods.card.style.getPropertyValue('--analysis-pane-height'),'300px');assert.equal(cycles.resize.getAttribute('aria-valuenow'),'490');
  pointer('pointerdown',300);pointer('pointermove',400);pointer('pointercancel',400);assert.equal(f.state.paneHeights.cycles,490);assert.equal(cycles.card.style.getPropertyValue('--analysis-pane-height'),'490px');assert.equal(commands.length,1);
  const key=(key,shiftKey=false)=>cycles.resize.dispatchEvent({type:'keydown',key,shiftKey,preventDefault(){}});
  cycles.resize.focus();key('ArrowUp');assert.equal(f.state.paneHeights.cycles,470);key('ArrowDown',true);assert.equal(f.state.paneHeights.cycles,530);key('Home');assert.equal(f.state.paneHeights.cycles,240);key('End');assert.equal(f.state.paneHeights.cycles,900);assert.equal(f.doc.activeElement,cycles.resize);
  assert.deepEqual(f.state.hidden,[]);assert.deepEqual(f.state.minimized,[]);assert.equal(f.state.paneHeights.periods,300);f.controller.destroy();
});
