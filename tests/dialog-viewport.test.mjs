import test from 'node:test';
import assert from 'node:assert/strict';
import {mountDialogViewport} from '../dist/dialog-viewport.js';

test('dialog follows visible height and top while a keyboard opens, and removes observers on destroy',()=>{
  const viewport=new EventTarget();Object.assign(viewport,{height:844,offsetTop:0});const values=new Map(),attributes=new Map();
  const dialog={ownerDocument:{defaultView:{visualViewport:viewport}},style:{setProperty:(key,value)=>values.set(key,value),removeProperty:key=>values.delete(key)},setAttribute:(key,value)=>attributes.set(key,value),removeAttribute:key=>attributes.delete(key)};
  const controller=mountDialogViewport(dialog);assert.equal(values.get('--dialog-viewport-height'),'844px');
  viewport.height=390.75;viewport.offsetTop=27.4;viewport.dispatchEvent(new Event('resize'));
  assert.equal(values.get('--dialog-viewport-height'),'390px');assert.equal(values.get('--dialog-viewport-top'),'27px');assert.equal(attributes.has('data-short-viewport'),true);
  viewport.offsetTop=41;viewport.dispatchEvent(new Event('scroll'));assert.equal(values.get('--dialog-viewport-top'),'41px');
  controller.destroy();viewport.dispatchEvent(new Event('resize'));assert.equal(values.size,0);assert.equal(attributes.size,0);
});

test('short viewport follows the visible-height boundary and ignores invalid transient heights',()=>{
  const viewport=new EventTarget();Object.assign(viewport,{height:600,offsetTop:0});const values=new Map(),attributes=new Map();
  const dialog={ownerDocument:{defaultView:{visualViewport:viewport}},style:{setProperty:(key,value)=>values.set(key,value),removeProperty:key=>values.delete(key)},setAttribute:(key,value)=>attributes.set(key,value),removeAttribute:key=>attributes.delete(key)};
  const controller=mountDialogViewport(dialog);assert.equal(attributes.has('data-short-viewport'),true);
  viewport.height=601;viewport.dispatchEvent(new Event('resize'));assert.equal(attributes.has('data-short-viewport'),false);
  for(const height of [0,-1,NaN,Infinity]){viewport.height=height;viewport.dispatchEvent(new Event('resize'));assert.equal(values.get('--dialog-viewport-height'),'601px');assert.equal(attributes.has('data-short-viewport'),false);}
  controller.destroy();assert.equal(attributes.size,0);assert.equal(values.size,0);
});

test('browsers without visualViewport keep native dialog sizing',()=>{
  const controller=mountDialogViewport({ownerDocument:{defaultView:{}}});assert.doesNotThrow(()=>controller.destroy());
});
