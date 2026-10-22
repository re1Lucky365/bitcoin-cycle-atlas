import assert from 'node:assert/strict';
import test from 'node:test';
import {chartSelectionHandler,inspectionPanelAction} from '../dist/inspection-policy.js';
import {drawAtlasPriceChart} from '../dist/atlas-price-chart.js';
import {drawIntradayChart} from '../dist/intraday-chart.js';
import {shouldPublishInspection} from '../dist/analysis-dock.js';

class SvgNode {
  constructor(){this.attrs=new Map();this.nodes=new Map();this.dataset={};this.textContent='';}
  setAttribute(key,value){this.attrs.set(key,String(value));}
  removeAttribute(key){this.attrs.delete(key);}
  querySelector(selector){if(!this.nodes.has(selector))this.nodes.set(selector,new SvgNode());return this.nodes.get(selector);}
  querySelectorAll(selector){return selector==='text'?[0,1,2,3].map(index=>this.querySelector(`text-${index}`)):[];}
  focus(){}
}
function svgFixture(){const svg=new SvgNode();Object.assign(svg,{id:'selection-test',clientWidth:1000,clientHeight:600,innerHTML:'',parentElement:{style:{setProperty(){}}}});svg.getBoundingClientRect=()=>({left:0,top:0,width:1000,height:600});return svg;}

test('ordinary selections preserve reader layout while explicit controls can open details',()=>{
  for(const panel of [{open:false,kind:null},{open:false,kind:'selection'},{open:true,kind:'selection'},{open:true,kind:'volume'},{open:true,kind:'settings'}]){
    for(const userInitiated of [false,true]){
      assert.equal(inspectionPanelAction({userInitiated,openPanel:false},panel),panel.open&&panel.kind==='selection'?'refresh':'preserve');
      assert.equal(inspectionPanelAction({userInitiated},panel),panel.open&&panel.kind==='selection'?'refresh':'preserve');
    }
    for(const kind of ['history','assumption','observed'])assert.equal(inspectionPanelAction({kind,openPanel:true},panel),'open');
  }
});

test('chart adapter preserves exact selection and ownership while refusing layout requests from the renderer',()=>{
  const detail={date:'2026-10-21',fields:[{label:'종가',value:'$100'}]},options={user:true,openPanel:true};let received;
  chartSelectionHandler((value,flags)=>{received={value,flags};})(detail,options);
  assert.strictEqual(received.value,detail);assert.equal(received.flags.user,true);assert.equal(received.flags.openPanel,false);
  assert.equal(options.openPanel,true,'the renderer options are not mutated');
});

test('real daily and intraday click/keyboard selections pin values without opening or replacing a reader',()=>{
  const rows=['2026-10-19','2026-10-20','2026-10-21'].map((date,index)=>({date,price:100+index*5}));
  const series={interval:'1m',source:'Coinbase Exchange',product:'BTC-USD',retrievedAt:'2026-10-22T00:00:00Z',gapCount:0,candles:[0,1,2].map(index=>{
    const time=Date.parse('2026-10-21T00:00:00Z')/1000+index*60;return {time,date:new Date(time*1000).toISOString(),open:100+index,high:105+index,low:99+index,close:103+index,volume:10+index};
  })};
  for(const intraday of [false,true])for(const panel of [{open:false,kind:null},{open:true,kind:'selection'},{open:true,kind:'volume'}]){
    const svg=svgFixture(),calls=[];
    const onInspect=chartSelectionHandler((detail,options)=>calls.push({detail,options,action:inspectionPanelAction({...options,userInitiated:options.user},panel)}));
    const controller=intraday?drawIntradayChart({svg,series,onInspect}):drawAtlasPriceChart({svg,rows,start:rows[0].date,end:rows.at(-1).date,split:rows.at(-1).date,showDrawdown:false,showHistoricalEvents:false,onInspect});
    assert.equal(calls.at(-1).options.user,false);
    svg.onclick({clientX:400,clientY:150,target:{closest:()=>null}});
    assert.equal(calls.at(-1).options.user,true);assert.equal(controller.getDate(),calls.at(-1).detail.date);
    svg.onkeydown({key:'Home',target:{closest:()=>null},preventDefault(){},stopPropagation(){}});
    assert.equal(calls.at(-1).options.user,true);assert.equal(controller.getDate(),intraday?series.candles[0].date:rows[0].date);
    for(const call of calls){assert.equal(call.options.openPanel,false);assert.equal(call.action,panel.open&&panel.kind==='selection'?'refresh':'preserve');}
  }
});

test('countdown detail survives renderer initialization and resize until an explicit different selection',()=>{
  const rows=['2026-10-19','2026-10-20','2026-10-21'].map((date,index)=>({date,price:100+index*5}));
  let owner='countdown',detail={label:'다음 국면 · 조건부 시나리오',asOf:'2026-10-20'};
  const publish=(nextOwner,value,{user=false}={})=>{
    if(!shouldPublishInspection({owner:nextOwner,currentOwner:owner,user}))return;
    if(user)owner=nextOwner;detail=value;
  };
  const svg=svgFixture(),onInspect=chartSelectionHandler((value,options)=>publish('price',value,options));
  const draw=()=>drawAtlasPriceChart({svg,rows,start:rows[0].date,end:rows.at(-1).date,split:rows.at(-1).date,showDrawdown:false,showHistoricalEvents:false,onInspect});
  const original=detail;draw();svg.clientWidth=740;draw();publish('analysis',{label:'자동 분석 초기값'});
  assert.strictEqual(detail,original);assert.equal(owner,'countdown');
  const updated={label:original.label,asOf:'2026-10-21'};publish('countdown',updated);
  assert.strictEqual(detail,updated,'the same countdown owner can refresh after its model/day changes');
  svg.onclick({clientX:400,clientY:150,target:{closest:()=>null}});
  assert.equal(owner,'price');assert.ok(rows.some(row=>row.date===detail.date));
  const selected=detail;publish('countdown',{label:'뒤늦은 자동 D-day 갱신'});
  assert.strictEqual(detail,selected,'a background countdown refresh cannot take ownership back');
  publish('analysis',{label:'사용자가 선택한 분석 항목'},{user:true});assert.equal(owner,'analysis');
  draw();assert.equal(detail.label,'사용자가 선택한 분석 항목');
});
