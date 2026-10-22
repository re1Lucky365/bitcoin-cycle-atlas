import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { buildCryptoConAudit } from '../dist/cryptocon-audit-data.js';
import { renderCryptoConAudit } from '../dist/cryptocon-audit.js';

const data=JSON.parse(await readFile(new URL('./fixtures/btc-daily-2026-10-20.json',import.meta.url),'utf8'));
const audit=buildCryptoConAudit(data);

test('near-peak entry, dwell time and drawdown remain different measured quantities',()=>{
  assert.equal(audit.peak.date,'2025-10-06');
  assert.deepEqual(audit.thresholds.map(row=>[row.ratio,row.firstDate,row.leadDays,row.aboveDays,row.windowDays]),[
    [.9,'2025-07-10',88,69,89],[.95,'2025-07-13',85,16,86],[.97,'2025-08-13',54,5,55],[.98,'2025-08-13',54,5,55],[.99,'2025-10-06',0,1,1]
  ]);
  assert.ok(Math.abs(audit.thresholds[1].maxDrawdownPct+12.253649182941317)<1e-10);
  assert.equal(audit.thresholds.at(-1).maxDrawdownPct,0);
});

test('a later wider explanation cannot overwrite the original prediction window',()=>{
  const original=audit.timing.find(row=>row.id==='original-november');
  const separate=audit.timing.find(row=>row.id==='june-october');
  const later=audit.timing.find(row=>row.id==='december-retrospective');
  assert.equal(original.within,false);
  assert.equal(original.daysFromWindowStart,-32);
  assert.equal(original.daysFromCenter,-53);
  assert.equal(separate.within,true);
  assert.equal(later.within,true);
  assert.equal(later.kind,'retrospective');
  assert.match(later.assessment,/채점 제외/);
  assert.notEqual(later.assessment,separate.assessment);
});

test('deadline scoring includes the full period and preserves no-deadline targets',()=>{
  const deadline=audit.targets.find(row=>row.id==='september-166754');
  assert.equal(deadline.observedPeak.date,'2025-08-13');
  assert.equal(deadline.observedPeak.price,123442.67982225);
  assert.ok(Math.abs(deadline.gapPct+25.973182159198583)<1e-10);
  assert.equal(deadline.reached,false);
  const indefinite=audit.targets.find(row=>row.id==='august-166754');
  assert.equal(indefinite.deadline,null);
  assert.match(indefinite.assessment,/시한 없음/);
  assert.equal(audit.targets[0].assessment,'2025년 고점 크기 비교');
});

test('future data updates cannot rewrite this fixed research audit',()=>{
  const extended={...data,prices:[...data.prices,['2026-10-21',1e9],['2026-10-22',1],['2027-01-01',2e9]]};
  assert.deepEqual(buildCryptoConAudit(extended),audit);
  assert.throws(()=>buildCryptoConAudit({...data,prices:data.prices.filter(([date])=>date!=='2025-05-01')}),/완료된 2025년/);
});

function svgStub(width,height){
  const attrs={};
  return {clientWidth:width,clientHeight:height,innerHTML:'',setAttribute(key,value){attrs[key]=value;},getAttribute(key){return attrs[key];},getBoundingClientRect(){return {left:0,top:0,width,height};}};
}

test('three graph views fit compact geometry and support source-bearing keyboard inspection',()=>{
  for(const [width,height] of [[300,190],[320,240],[390,300],[640,250],[1024,600],[1200,600]]){
    for(const view of ['timing','thresholds','targets']){
      const svg=svgStub(width,height),inspections=[];
      const control=renderCryptoConAudit({svg,dataset:data,view,onInspect:detail=>inspections.push(detail)});
      assert.equal(svg.getAttribute('viewBox'),`0 0 ${width} ${height}`);
      assert.ok(!/NaN|Infinity/.test(svg.innerHTML));
      for(const match of svg.innerHTML.matchAll(/<(?:rect|text|line|circle)\b([^>]*)>/g)){
        const attrs=Object.fromEntries([...match[1].matchAll(/([a-z\d-]+)="([^"]*)"/g)].map(item=>[item[1],item[2]]));
        for(const key of ['x','x1','x2','cx'])if(key in attrs)assert.ok(Number(attrs[key])>=0&&Number(attrs[key])<=width,`${view}: ${key} ${attrs[key]} exceeds width`);
        for(const key of ['y','y1','y2','cy'])if(key in attrs)assert.ok(Number(attrs[key])>=0&&Number(attrs[key])<=height,`${view}: ${key} ${attrs[key]} exceeds height`);
        if('width' in attrs)assert.ok(Number(attrs.width)>=0);
        if('height' in attrs)assert.ok(Number(attrs.height)>=0);
      }
      const event=key=>({key,preventDefault(){}});
      svg.onkeydown(event('Home'));
      assert.equal(control.hasPrevious(),false);
      const first=inspections.at(-1).label;
      svg.onkeydown(event('End'));
      assert.equal(control.hasNext(),false);
      assert.notEqual(inspections.at(-1).label,first);
      control.previous();control.next();
      svg.onclick({clientX:width/2,clientY:height/2});
      assert.ok(inspections.length>=6);
      for(const detail of inspections){assert.ok(detail.fields.length>=4);assert.ok(detail.sources.length>=1);assert.ok(detail.sources.every(source=>source.url.startsWith('https://')));}
      assert.equal(control.title.includes('고점')||control.title.includes('가격'),true);
    }
  }
});
