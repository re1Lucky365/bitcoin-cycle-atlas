import { createPriceScale } from './chart-math.js?v=1.19.0';
import { normalizePriceDomain, priceAxisMarkup, timeAxisMarkup, createPriceAxisLayout, createPriceAxisFormatter } from './price-axis.js?v=1.14.0-mobile.1';
import { createPriceDisplay } from './price-display.js?v=1.13.0-research.1';
import { clearChartHover } from './chart-hover.js?v=1.12.1-cursor-hud.1';
import { researchAnnotationsMarkup } from './research-annotations.js?v=1.13.0-research.1';
import { utcDay } from './cycle-engine.js?v=1.19.0';

const previousAxes = new WeakMap();
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function retainPriceViewport(svg,axis){previousAxes.set(svg,{min:axis.min,max:axis.max});}

/** An empty viewport still has real axes and drag surfaces, but no price rows. */
export function renderEmptyPriceViewport({svg,layout,axisText=null,width:W,height:H,start,end,seconds=false,scale='log',priceDomain=null,unit='usd',denominator=null,denominatorDate=null,fallbackPrice=null,invertScale=false,tool='crosshair',message='이 기간에는 표시할 가격 자료가 없습니다.',onHover=()=>{},source='',frequency='daily',researchAnnotations=[],activeResearchAnnotationId=null,onResearchAnnotation=()=>{},scenarioId=null}){
  clearChartHover(svg);
  axisText??=createPriceAxisLayout({svg,width:W,left:layout.left,minRight:layout.right});layout={...layout,right:axisText.right};
  const {left:L,right:R,top:T,bottom,axisY,priceBottom:B}=layout;
  const display=createPriceDisplay({unit,rows:[],denominator,denominatorDate,scale});
  const retained=normalizePriceDomain(priceDomain,{scale:display.effectiveScale})||normalizePriceDomain(previousAxes.get(svg),{scale:display.effectiveScale});
  const fallback=Number.isFinite(fallbackPrice)&&fallbackPrice>0?fallbackPrice:retained?.max>0?retained.max:1;
  const axis=createPriceScale([fallback],{scale:display.effectiveScale,top:T,bottom:B,domain:retained,factor:display.factor,offset:display.offset,inverted:invertScale,tickCount:4});
  const axisLabels=createPriceAxisFormatter({axis,display,layout:axisText});
  axis.mode=priceDomain?'manual':'auto';retainPriceViewport(svg,axis);
  const dateCoordinate=value=>typeof value==='number'?seconds?value:value/86400:seconds?Date.parse(value)/1000:value.length>10?Date.parse(value)/86400000:utcDay(value);
  const a=dateCoordinate(start),b=dateCoordinate(end),x=({date})=>L+(dateCoordinate(date)-a)/Math.max(1,b-a)*(W-L-R),clip=`${svg.id}-empty-price`;
  let markup=`<title>자료가 없는 표시 범위 · UTC</title><desc>조회하거나 관측하지 않은 봉과 미래 가격을 만들어 채우지 않습니다. 빈 영역에서도 시간축과 가격축을 이동할 수 있습니다.</desc><defs><clipPath id="${clip}"><rect x="${L}" y="${T}" width="${W-L-R}" height="${B-T}"/></clipPath></defs>`;
  for(const value of axis.ticks){const yy=axis.y(value),label=axisLabels.tick(value);markup+=`<line x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}" stroke="#26323e"/><text x="${W-R+axisText.inset}" y="${yy+4}" ${axisText.attributes(label)} fill="#acbacb" font-size="${axisText.fontSize}">${esc(label)}</text>`;}
  for(let index=0;index<4;index++){
    const fraction=index/3,coordinate=a+(b-a)*fraction,xx=L+fraction*(W-L-R),date=new Date(coordinate*(seconds?1000:86400000)).toISOString(),label=seconds?date.slice(0,16).replace('T',' '):date.slice(0,10);
    markup+=`<line x1="${xx}" x2="${xx}" y1="${T}" y2="${bottom}" stroke="#212c37"/><text x="${xx}" y="${axisY}" text-anchor="${index===0?'start':index===3?'end':'middle'}" fill="#aebaca" font-size="9">${label}</text>`;
  }
  markup+=`<text class="chart-empty-message" x="${L+(W-L-R)/2}" y="${T+(B-T)/2}" text-anchor="middle" fill="#9eb2ca" font-size="11"><tspan x="${L+(W-L-R)/2}">${esc(message)}</tspan><tspan x="${L+(W-L-R)/2}" dy="18">빈 영역 · 드래그로 이동하거나 기본 범위로 복원</tspan></text>`;
  const annotations=researchAnnotationsMarkup({annotations:researchAnnotations,start,end,x,y:axis.y,left:L,right:W-R,top:T,bottom:B,clipId:clip,activeId:activeResearchAnnotationId,scenarioId});
  markup+=annotations.markup+priceAxisMarkup({left:W-R,right:W,top:T,bottom:B})+timeAxisMarkup({left:L,right:W-R,top:bottom+8,bottom:H});
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  svg.parentElement?.style.setProperty('--plot-bottom-gap',`${H-bottom+6}px`);svg.parentElement?.style.setProperty('--plot-right-gap',`${R+7}px`);
  Object.assign(svg.dataset,{plotLeft:String(L),plotRight:String(W-R),plotTop:String(T),plotBottom:String(bottom),priceBottom:String(B),timeAxisTop:String(bottom+8),scale:axis.scale,unit,invertScale:String(Boolean(invertScale)),visiblePointCount:'0',observedCandleCount:'0',cycleIntervalCount:'0',cycleIntervalLabelCount:'0',cycleMarkerCount:'0',cycleMarkerLabelCount:'0',researchAnnotationCount:String(annotations.visibleCount),tool});
  delete svg.dataset.cycleIntervalBandTop;delete svg.dataset.cycleIntervalBandBottom;
  svg.innerHTML=markup;
  const activate=event=>{const item=event.target?.closest?.('[data-research-annotation]');if(item){onResearchAnnotation(item.dataset.researchAnnotation,{user:true});return true;}return false;};
  svg.onclick=activate;svg.onpointermove=svg.onpointerleave=svg.onkeyup=svg.onblur=null;
  svg.onkeydown=event=>{if(['Enter',' '].includes(event.key)&&activate(event)){event.preventDefault();event.stopPropagation();}};
  onHover({date:seconds?new Date(start*1000).toISOString():start,kind:'unavailable',completed:false,price:NaN,volume:NaN,displayedPrice:null,display:display.metadata,source,frequency});
  const activeMarkup=markup;
  return {getPriceScale:()=>({...axis,left:L,right:W-R,display:display.metadata}),previewPointer:()=>false,clearPreview:()=>false,getDate:()=>null,getSelection:()=>null,hasPrevious:()=>false,hasNext:()=>false,selectDate(){},previous(){},next(){},updateCycleOverlayObstacles:()=>svg.innerHTML===activeMarkup?{changed:false,visibleCount:0,labelCount:0}:null};
}
