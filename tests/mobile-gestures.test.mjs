import test from 'node:test';
import assert from 'node:assert/strict';
import { panRange, zoomRange } from '../dist/chart-navigation.js';
import { panPriceDomain, scalePriceDomain } from '../dist/price-axis.js';
import { mobileGestureHarness } from './helpers/mobile-gesture-fixture.mjs';

const daily={start:'2024-01-01',end:'2024-04-09',min:'2024-01-01',max:'2024-04-09',allowEmpty:true,contextKey:'daily:source'};
const first=Date.parse('2026-10-01T00:00:00Z')/1000;
const hourly={start:first,end:first+99*3600,min:first-1000*3600,max:first+99*3600,unit:'seconds',step:3600,minSpan:12,maxSpan:6000,allowEmpty:true,contextKey:'market:1h:revision'};
const point=(x,y=200,pointerId=1)=>({clientX:x,clientY:y,pointerId});

for(const [label,range]of [['daily',daily],['weekly',{...daily,contextKey:'weekly:source'}],['hourly',hourly]]){
  test(`${label} a 480px swipe includes its release coordinate through redraws and captures one transaction`,()=>{
    const h=mobileGestureHarness({range});try{
      h.dispatch('pointerdown',point(200));h.dispatch('pointermove',point(400));h.settle();
      assert.deepEqual(h.range,panRange(range,-200/870));assert.equal(h.captures.get(1),h.element);
      h.redraw();h.dispatch('pointerup',point(680));h.settle();
      assert.deepEqual(h.range,panRange(range,-480/870));assert.equal(h.captures.size,0);
      assert.deepEqual(h.transactions.map(item=>item[0]),['start','end']);assert.ok(h.redraws>=3);
      assert.equal(h.dispatch('click',point(680)).defaultPrevented,true);assert.equal(h.selections,0);
    }finally{h.destroy();}
  });
}

test('direction changes retain the pointerdown baseline, including a final return on release',()=>{
  const h=mobileGestureHarness({range:daily});try{
    h.dispatch('pointerdown',point(500));
    for(const x of [620,740,380]){h.dispatch('pointermove',point(x));h.settle();assert.deepEqual(h.range,panRange(daily,(500-x)/870));}
    h.dispatch('pointerup',point(500));h.settle();assert.deepEqual(h.range,daily);
    assert.deepEqual(h.transactions.map(item=>item[0]),['start','end']);
  }finally{h.destroy();}
});

test('touch crosshair panning preserves Auto despite finger wobble, while H deliberately pans both axes',()=>{
  for(const tool of ['crosshair','pan']){
    const h=mobileGestureHarness({range:daily,tool}),axis={...h.axis};try{
      h.dispatch('pointerdown',point(350,200));h.dispatch('pointermove',point(550,230));h.settle();
      h.dispatch('pointerup',point(650,270));h.settle();assert.deepEqual(h.range,panRange(daily,-300/870));
      if(tool==='crosshair'){assert.equal(h.priceChanges.length,0);assert.equal(h.axis.mode,'auto');}
      else{assert.deepEqual(h.priceChanges.at(-1),panPriceDomain(axis,70/350));assert.equal(h.axis.mode,'manual');}
    }finally{h.destroy();}
  }
});

for(const pointerType of ['touch','mouse'])test(`${pointerType} price and time axes include the exact final release without moving the other axis`,()=>{
  for(const kind of ['price','time']){
    const h=mobileGestureHarness({range:daily}),axis={...h.axis};try{
      if(kind==='price'){
        h.dispatch('pointerdown',{...point(965,200),pointerType});h.dispatch('pointermove',{...point(965,230),pointerType});h.settle();
        h.dispatch('pointerup',{...point(965,270),pointerType,buttons:0});h.settle();
        assert.deepEqual(h.priceChanges.at(-1),scalePriceDomain(axis,Math.exp(70/350*2)));assert.deepEqual(h.range,daily);
      }else{
        h.dispatch('pointerdown',{...point(500,470),pointerType});h.dispatch('pointermove',{...point(480,470),pointerType});h.settle();
        h.dispatch('pointerup',{...point(400,470),pointerType,buttons:0});h.settle();
        assert.deepEqual(h.range,zoomRange(daily,Math.exp(-100/870*2),440/870));assert.equal(h.priceChanges.length,0);
      }
      assert.deepEqual(h.transactions.map(item=>item[0]),['start','end']);assert.equal(h.captures.size,0);
    }finally{h.destroy();}
  }
});

test('pinch uses the final finger position and ignores a third finger without splitting history',()=>{
  const h=mobileGestureHarness({range:daily});try{
    h.dispatch('pointerdown',point(350));h.dispatch('pointerdown',{...point(650,200,2),isPrimary:false});
    h.dispatch('pointerdown',{...point(500,280,3),isPrimary:false});h.dispatch('pointermove',{...point(850,280,3),isPrimary:false});h.settle();assert.deepEqual(h.range,daily);
    h.dispatch('pointermove',{...point(700,200,2),isPrimary:false});h.settle();
    h.dispatch('pointercancel',{...point(850,280,3),isPrimary:false});assert.deepEqual(h.transactions.map(item=>item[0]),['start']);
    h.dispatch('pointerup',{...point(800,200,2),isPrimary:false});h.settle();
    assert.deepEqual(h.range,panRange(zoomRange(daily,300/450,440/870),-75/870));
    assert.deepEqual(h.transactions.map(item=>item[0]),['start','end']);assert.equal(h.priceChanges.length,0);
    h.dispatch('pointerup',point(350));assert.equal(h.captures.size,0);
  }finally{h.destroy();}
});

test('a small begun pan cancels the hold without losing the two-finger cohort',()=>{
  const h=mobileGestureHarness({range:daily});try{
    h.dispatch('pointerdown',point(350));h.dispatch('pointermove',point(356));h.settle();h.advance(600);
    assert.equal(h.tracking.active,false);assert.equal(h.previews.length,0);
    h.dispatch('pointerdown',{...point(650,200,2),isPrimary:false});h.advance(600);assert.equal(h.tracking.active,false);
    h.dispatch('pointermove',{...point(800,200,2),isPrimary:false});h.settle();assert.equal(h.element.dataset.pinching,'true');
    assert.deepEqual(h.transactions.map(item=>item[0]),['start']);
    h.dispatch('pointerup',{...point(820,200,2),isPrimary:false});h.settle();assert.deepEqual(h.transactions.map(item=>item[0]),['start','end']);
  }finally{h.destroy();}
});

test('long press wins native touch contextmenu, while an explicit quick menu leaves tracking',()=>{
  const h=mobileGestureHarness({range:daily});try{
    h.dispatch('pointerdown',point(500));h.advance(450);
    assert.equal(h.dispatch('contextmenu',{...point(500),pointerType:'touch'}).defaultPrevented,true);assert.equal(h.nav.menu.hidden,true);
    h.advance(50);assert.equal(h.tracking.active,true);h.dispatch('pointerup',point(500));
    assert.equal(h.dispatch('contextmenu',{...point(500),pointerType:'touch'}).defaultPrevented,true);assert.equal(h.nav.menu.hidden,true);
    h.nav.openMenu();assert.equal(h.tracking.active,false);assert.equal(h.nav.menu.hidden,false);assert.equal(h.clears,1);
  }finally{h.destroy();}
});

test('a mouse context menu and keyboard activation remain available after touch tracking',()=>{
  const h=mobileGestureHarness({range:daily});try{
    h.dispatch('pointerdown',point(500));h.advance(500);h.dispatch('pointerup',point(500));
    h.dispatch('contextmenu',{...point(500),pointerType:'mouse',button:2});assert.equal(h.nav.menu.hidden,false);assert.equal(h.tracking.active,false);
    const button=h.document.createElement('button');h.element.append(button);let activations=0;button.onclick=()=>activations++;
    assert.equal(h.dispatch('click',{target:button,pointerType:'',detail:0}).defaultPrevented,false);assert.equal(activations,1);
  }finally{h.destroy();}
});

test('a subsequent mouse gesture can reuse a retired touch pointer ID',()=>{
  const h=mobileGestureHarness({range:daily});try{
    h.dispatch('pointerdown',point(350));h.advance(500);h.dispatch('pointerup',point(350));
    h.dispatch('pointerdown',{...point(350),pointerType:'mouse'});h.dispatch('pointermove',{...point(550),pointerType:'mouse'});h.settle();
    h.dispatch('pointerup',{...point(650),pointerType:'mouse',buttons:0});h.settle();
    assert.equal(h.tracking.active,false);assert.deepEqual(h.range,panRange(daily,-300/870));assert.equal(h.captures.size,0);
  }finally{h.destroy();}
});

test('native touch menus cannot steal H or measurement, and a later legacy mouse context menu remains available',()=>{
  for(const tool of ['pan','measure']){
    const h=mobileGestureHarness({range:daily,tool});try{
      h.dispatch('pointerdown',point(500));h.advance(900);
      assert.equal(h.dispatch('contextmenu',{...point(500),pointerType:'touch'}).defaultPrevented,true);assert.equal(h.nav.menu.hidden,true);assert.equal(h.tracking.active,false);
      h.dispatch('pointercancel',point(500));
      h.dispatch('pointerdown',{...point(500),pointerType:'mouse',button:2});
      h.dispatch('contextmenu',{...point(500),pointerType:'',button:2});assert.equal(h.nav.menu.hidden,false);
    }finally{h.destroy();}
  }
});

test('retained tracking never prevents a later page or control scroll outside the plot',()=>{
  const h=mobileGestureHarness({range:daily});try{
    h.dispatch('pointerdown',point(500));h.advance(500);assert.equal(h.dispatch('touchmove').defaultPrevented,true);
    const outside=h.document.createElement('section');
    assert.equal(h.dispatch('touchmove',{target:outside}).defaultPrevented,false);
    h.dispatch('pointerup',point(500));assert.equal(h.tracking.active,true);
    assert.equal(h.dispatch('touchmove').defaultPrevented,false);assert.equal(h.dispatch('touchmove',{target:outside}).defaultPrevented,false);
  }finally{h.destroy();}
});

test('tracking never steals a fresh price or time-axis gesture and excludes H, measurement and controls',()=>{
  for(const coordinate of [point(965,200),point(500,470)]){
    const h=mobileGestureHarness({range:daily});try{
      h.dispatch('pointerdown',point(500));h.advance(500);h.dispatch('pointerup',point(500));
      h.dispatch('pointerdown',coordinate);assert.equal(h.tracking.active,false);
      h.dispatch('pointermove',{...coordinate,clientX:coordinate.clientX-20,clientY:coordinate.clientY+20});h.advance(600);
      assert.equal(h.tracking.active,false);h.dispatch('pointerup',{...coordinate,clientX:coordinate.clientX-40,clientY:coordinate.clientY+40});h.settle();
      assert.ok(coordinate.clientX>930?h.priceChanges.length>0:h.changes.length>0);
    }finally{h.destroy();}
  }
  for(const tool of ['pan','measure']){
    const h=mobileGestureHarness({range:daily,tool});try{h.dispatch('pointerdown');h.advance(700);assert.equal(h.tracking.active,false);assert.equal(h.previews.length,0);}finally{h.destroy();}
  }
  const h=mobileGestureHarness({range:daily});try{
    const marker=h.document.createElement('g');marker.setAttribute('role','button');h.svg.append(marker);
    h.dispatch('pointerdown',{target:marker});h.advance(700);assert.equal(h.tracking.active,false);assert.equal(h.captures.size,0);
  }finally{h.destroy();}
});

test('an extra finger after pinch release cannot begin a second pan before the whole cohort ends',()=>{
  const h=mobileGestureHarness({range:daily});try{
    h.dispatch('pointerdown',point(350));h.dispatch('pointerdown',{...point(650,200,2),isPrimary:false});
    h.dispatch('pointermove',{...point(800,200,2),isPrimary:false});h.settle();
    h.dispatch('pointerup',{...point(800,200,2),isPrimary:false});const finished={...h.range};
    h.advance(1500);h.dispatch('pointerdown',{...point(650,200,3),isPrimary:false});h.dispatch('pointermove',{...point(850,200,3),isPrimary:false});h.settle();
    assert.deepEqual(h.range,finished);assert.equal(h.tracking.active,false);
    h.dispatch('pointercancel',point(350));h.dispatch('pointerup',{...point(850,200,3),isPrimary:false});
    assert.equal(h.dispatch('click',point(850)).defaultPrevented,true);
    h.dispatch('pointerdown',point(500));h.dispatch('pointerup',point(500));h.dispatch('click',point(500));assert.equal(h.selections,1);
  }finally{h.destroy();}
});

test('tracking-to-pinch, residual cancellation and interval changes cannot apply stale work',()=>{
  const h=mobileGestureHarness({range:daily});try{
    h.dispatch('pointerdown',point(350));h.advance(500);h.dispatch('pointerdown',{...point(650,200,2),isPrimary:false});
    assert.equal(h.tracking.active,false);assert.equal(h.element.dataset.pinching,'true');
    h.dispatch('pointermove',{...point(800,200,2),isPrimary:false});h.settle();h.dispatch('pointerup',{...point(800,200,2),isPrimary:false});
    h.advance(1500);h.dispatch('pointercancel',point(350));assert.equal(h.captures.size,0);
    h.dispatch('pointerdown',point(500));h.dispatch('pointermove',point(600));h.setRange(hourly);h.settle();assert.deepEqual(h.range,hourly);
    h.dispatch('pointerup',point(650));h.advance(700);assert.deepEqual(h.range,hourly);assert.equal(h.tracking.active,false);
    h.dispatch('pointerdown',point(500));h.dispatch('pointerup',point(500));h.dispatch('click',point(500));assert.equal(h.selections,1);
  }finally{h.destroy();}
});

test('a fresh measurement tap is not swallowed by an earlier drag whose compatibility click never fired',()=>{
  const h=mobileGestureHarness({range:daily});try{
    h.dispatch('pointerdown',point(350));h.dispatch('pointermove',point(550));h.dispatch('pointerup',point(650));h.settle();
    h.setTool('measure');const before={...h.range};let measurements=0;h.svg.onclick=()=>measurements++;
    assert.equal(h.dispatch('pointerdown',point(500)).defaultPrevented,false);
    assert.equal(h.dispatch('pointerup',point(500)).defaultPrevented,false);
    assert.equal(h.dispatch('click',point(500)).defaultPrevented,false);assert.equal(measurements,1);assert.deepEqual(h.range,before);
  }finally{h.destroy();}
});

test('blur and resize cancel both pending and active tracking and do not rearm it',()=>{
  for(const type of ['blur','resize'])for(const active of [false,true]){
    const h=mobileGestureHarness({range:daily});try{
      h.dispatch('pointerdown');h.advance(active?500:100);h.dispatch(type,{target:h.window});h.advance(800);
      assert.equal(h.tracking.active,false);assert.equal(h.captures.size,0);assert.equal(h.previews.length,active?1:0);
    }finally{h.destroy();}
  }
});

test('hidden documents and capture loss retire tracking; an unrelated second contact cannot arm a hold',()=>{
  for(const interruption of ['hidden','capture']){
    const h=mobileGestureHarness({range:daily});try{
      h.dispatch('pointerdown',point(500));h.advance(500);
      if(interruption==='hidden'){h.document.hidden=true;h.dispatch('visibilitychange',{target:h.document});}
      else h.element.releasePointerCapture(1);
      assert.equal(h.tracking.active,false);assert.equal(h.captures.size,0);assert.equal(h.clears,1);
      h.dispatch('pointerdown',{...point(650,200,2),isPrimary:false});h.advance(800);assert.equal(h.tracking.active,false);assert.deepEqual(h.range,daily);
      h.dispatch('pointercancel',point(500));h.dispatch('pointerup',{...point(650,200,2),isPrimary:false});h.document.hidden=false;
      h.dispatch('pointerdown',point(500));h.dispatch('pointerup',point(500));h.dispatch('click',point(500));assert.equal(h.selections,1);
    }finally{h.destroy();}
  }
  const h=mobileGestureHarness({range:daily});try{
    h.dispatch('pointerdown',point(965));h.dispatch('pointerdown',{...point(500,200,2),isPrimary:false});h.advance(800);
    assert.equal(h.tracking.active,false);assert.equal(h.previews.length,0);
  }finally{h.destroy();}
});
