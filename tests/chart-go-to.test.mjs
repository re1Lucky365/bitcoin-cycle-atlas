import assert from 'node:assert/strict';
import test from 'node:test';
import { parseGoToRequest, parseUtcInput, transitionViewport } from '../dist/chart-view-policy.js';
import { mountChartGoTo } from '../dist/chart-go-to.js';
import { EventSurface, TestElement } from './helpers/navigation-fixture.mjs';

const now=Date.parse('2026-10-23T12:34:45Z'),seconds=date=>Date.parse(date)/1000;
const base={frequency:'15m',now,loadedStart:'2026-10-22T00:00:00Z',loadedEnd:'2026-10-23T12:00:00Z'};

test('UTC inputs reject impossible calendar values and never depend on local timezone',()=>{
  assert.equal(parseUtcInput('2024-02-29'),seconds('2024-02-29T00:00:00Z'));
  assert.equal(parseUtcInput('2026-03-08T02:30',{intraday:true}),seconds('2026-03-08T02:30:00Z'));
  for(const value of ['2025-02-29','2026-02-30','1799-12-31','2401-01-01','2026-10-23T00:00'])assert.equal(parseUtcInput(value),null);
  for(const value of ['2026-10-23T25:00','2026-02-30T12:00','2026-10-23T12:00+09:00','2026-10-23T12:00Z'])assert.equal(parseUtcInput(value,{intraday:true}),null);
});

test('GoTo distinguishes reversed ranges, interval-grid errors and incomplete future candles',()=>{
  assert.equal(parseGoToRequest({...base,mode:'range',start:'2026-10-22T03:00',end:'2026-10-22T02:00'}).code,'reversed');
  assert.equal(parseGoToRequest({...base,start:'2026-10-23T12:01'}).code,'off-grid');
  assert.equal(parseGoToRequest({...base,start:'2026-10-23T12:30'}).code,'unfinished');
  const completed=parseGoToRequest({...base,start:'2026-10-23T12:15'});assert.equal(completed.ok,true);assert.equal(completed.selectedTime,'2026-10-23T12:15:00.000Z');
  assert.equal(parseGoToRequest({...base,frequency:'1m',mode:'range',start:'2026-10-01T00:00',end:'2026-10-22T00:00'}).code,'too-wide');
});

test('GoTo outside cached history remains a request for empty or fetched data, with exact UTC range and selection',()=>{
  const result=parseGoToRequest({...base,mode:'range',start:'2020-01-01T00:00',end:'2020-01-02T00:00'});
  assert.equal(result.ok,true);assert.equal(result.code,'outside-loaded');assert.equal(result.range.start,seconds('2020-01-01T00:00:00Z'));assert.equal(result.range.end,seconds('2020-01-02T00:00:00Z'));
  assert.equal(result.selectedDate,'2020-01-01');assert.equal(result.unit,'seconds');assert.equal(Object.hasOwn(result,'candles'),false);
  const future=parseGoToRequest({frequency:'daily',now,start:'2200-01-01',loadedStart:'2010-01-01',loadedEnd:'2026-10-22'});assert.equal(future.ok,true);assert.equal(future.code,'outside-loaded');
  const first=parseGoToRequest({frequency:'daily',start:'1800-01-01',now}),last=parseGoToRequest({frequency:'daily',start:'2400-12-31',now});assert.equal(first.range.start,'1800-01-01');assert.equal(last.range.end,'2400-12-31');
});

test('interval transition preserves UTC duration and raw manual Y, adjusting only target grids',()=>{
  const range={start:seconds('2026-10-22T00:00:00Z'),end:seconds('2026-10-22T23:45:00Z')},domain={min:100,max:200};
  const next=transitionViewport({fromFrequency:'15m',toFrequency:'1m',range,selectedTime:'2026-10-22T12:30:00Z',priceDomain:domain,scale:'linear'});
  assert.equal(next.range.start,range.start);assert.equal(next.range.end,seconds('2026-10-22T23:59:00Z'));assert.equal(next.selectedTime,'2026-10-22T12:30:00.000Z');assert.deepEqual(next.priceDomain,domain);assert.equal(next.limited,false);
  const back=transitionViewport({fromFrequency:'1m',toFrequency:'15m',range:next.range,selectedTime:next.selectedTime,priceDomain:next.priceDomain,scale:'linear'});assert.deepEqual(back.range,range);assert.deepEqual(back.priceDomain,domain);
});

test('cross-frequency budget changes retain the UTC center and disclose a narrower viewport',()=>{
  const next=transitionViewport({fromFrequency:'daily',toFrequency:'1m',range:{start:'2026-01-01',end:'2026-12-31'},selectedDate:'2026-10-20',priceDomain:{min:-20,max:200},scale:'linear'});
  assert.equal((next.range.end-next.range.start)/60+1,6000);assert.equal(next.limited,true);assert.match(next.notice,/6,000/);assert.deepEqual(next.priceDomain,{min:-20,max:200});
  const center=(seconds('2026-01-01T00:00:00Z')+seconds('2027-01-01T00:00:00Z'))/2;assert.ok(Math.abs((next.range.start+next.range.end+60)/2-center)<=30);
  const daily=transitionViewport({fromFrequency:'1m',toFrequency:'daily',range:next.range,selectedTime:next.selectedTime,priceDomain:next.priceDomain,scale:'linear'});assert.equal(daily.selectedDate,'2026-10-20');assert.deepEqual(daily.priceDomain,next.priceDomain);assert.equal(daily.limited,true);
});

function dialogFixture(){
  const document=new EventSurface(),modalEvents=[];document.dispatchEvent=event=>{modalEvents.push(event);return true;};document.createElement=tag=>new TestElement(tag,document);document.body=document.createElement('body');
  const opener=document.createElement('button');document.body.append(opener);document.activeElement=opener;const submissions=[];
  const controller=mountChartGoTo({document,onSubmit:value=>submissions.push(value),now:()=>now});
  controller.update({mode:'price',frequency:'15m',start:seconds('2026-10-22T00:00:00Z'),end:seconds('2026-10-23T12:00:00Z'),loadedStart:base.loadedStart,loadedEnd:base.loadedEnd,selectedTime:'2026-10-22T12:30:00Z'});
  const dialog=document.body.children.find(node=>node.tagName==='DIALOG'),form=dialog.children[0];
  const find=predicate=>{const visit=node=>predicate(node)?node:node.children.map(visit).find(Boolean);return visit(dialog);};
  return {document,opener,controller,submissions,modalEvents,dialog,form,find,start:find(node=>node.name==='start'),end:find(node=>node.name==='end'),mode:find(node=>node.name==='mode'),submit(){form.onsubmit({preventDefault(){}});}};
}

test('UTC dialog validates inline before dispatch and restores focus only after a valid submit',()=>{
  const h=dialogFixture();h.controller.open(h.opener);assert.equal(h.modalEvents.at(-1).type,'atlas:modal-open');assert.equal(h.modalEvents.at(-1).detail.id,h.dialog.id);assert.equal(h.controller.isOpen(),true);assert.equal(h.start.type,'datetime-local');assert.equal(h.start.value,'2026-10-22T12:30');assert.equal(h.document.activeElement,h.start);
  h.start.value='2026-10-22T12:31';h.submit();assert.equal(h.submissions.length,0);assert.equal(h.controller.isOpen(),true);assert.equal(h.start.getAttribute('aria-invalid'),'true');assert.equal(h.find(node=>node.id==='chart-go-to-error').hidden,false);
  h.start.value='2026-10-22T12:45';h.start.oninput();h.submit();assert.equal(h.submissions.length,1);assert.equal(h.submissions[0].selectedTime,'2026-10-22T12:45:00.000Z');assert.equal(h.controller.isOpen(),false);assert.equal(h.document.activeElement,h.opener);h.controller.destroy();
});

test('GoTo range fields, focus trap and Escape work without changing the price viewport on cancellation',()=>{
  const h=dialogFixture();h.controller.open(h.opener);h.mode.value='range';h.mode.onchange();assert.equal(h.end.disabled,false);assert.equal(h.end.value,'2026-10-23T12:00');
  h.mode.focus();h.dialog.emit('keydown',{key:'Tab',shiftKey:true});assert.equal(h.document.activeElement.type,'submit');h.dialog.emit('keydown',{key:'Tab'});assert.equal(h.document.activeElement,h.mode);
  h.dialog.emit('keydown',{key:'Escape'});assert.equal(h.controller.isOpen(),false);assert.equal(h.document.activeElement,h.opener);assert.equal(h.submissions.length,0);h.controller.destroy();
});

test('live loading status does not overwrite a user-entered UTC point, while interval changes use the new input contract',()=>{
  const h=dialogFixture();h.controller.open(h.opener);h.start.value='2020-01-01T00:00';
  h.controller.update({...base,frequency:'15m',marketHistoryStatus:'loading'});assert.equal(h.start.value,'2020-01-01T00:00');assert.match(h.find(node=>node.className==='chart-go-to-status').textContent,/조회 중/);
  h.controller.update({frequency:'daily',asOf:'2026-10-22',start:'2026-01-01',end:'2026-12-31'});assert.equal(h.start.type,'date');assert.equal(h.start.value,'2026-10-22');h.controller.destroy();
});
