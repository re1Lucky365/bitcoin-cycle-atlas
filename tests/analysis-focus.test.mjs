import assert from 'node:assert/strict';
import test from 'node:test';
import { mountAnalysisIndicators } from '../dist/analysis-dock.js';

// Event/focus boundary for the shipped analysis controller. Browser geometry,
// sticky positioning and native scrolling are verified separately in the app.
class Surface {
  listeners = new Map();
  addEventListener(type,handler){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(handler);}
  removeEventListener(type,handler){this.listeners.get(type)?.delete(handler);}
  dispatchEvent(event){for(const handler of this.listeners.get(event.type)||[])handler(event);}
}
class Element extends Surface {
  constructor(tag,doc){super();this.tagName=tag;this.ownerDocument=doc;this.children=[];this.dataset={};this.attributes=new Map();this._hidden=false;}
  get isConnected(){return this===this.ownerDocument.body||Boolean(this.parentElement?.isConnected);}
  get hidden(){return this._hidden;}
  set hidden(value){this._hidden=Boolean(value);if(value&&this.contains(this.ownerDocument.activeElement))this.ownerDocument.activeElement=this.ownerDocument.body;}
  append(...nodes){for(const node of nodes){node.parentElement=this;this.children.push(node);}}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(node=>node!==this);this.parentElement=null;}
  setAttribute(key,value){this.attributes.set(key,value);}
  removeAttribute(key){this.attributes.delete(key);}
  contains(node){return node===this||this.children.some(child=>child.contains?.(node));}
  focus(){if(!this.closest('[hidden]')&&!this.disabled)this.ownerDocument.activeElement=this;}
  matches(selector){
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
  const update=({added=['cycles'],hidden=[]}={})=>doc.dispatchEvent({type:'atlas:indicator-state',detail:{indicators:{added,hidden,active:'cycles'}}});
  update();const header=controller.views.get('cycles').card.querySelector('.analysis-window-heading'),hide=header.children[2];
  return {doc,controller,opener,legend,row,eye,hide,update};
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
