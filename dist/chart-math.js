import { utcDay } from './cycle-engine.js?v=1.11.0';
import { normalizePriceDomain } from './price-axis.js?v=1.13.0-research.1';

/** All coordinates use original prices; factor affects only the choice of ticks. */
export function createPriceScale(values,{scale='log',top=0,bottom=1,tickCount=6,factor=1,offset=0,inverted=false,paddingRatio=.12,domain=null}={}) {
  if(!['log','linear'].includes(scale))throw new RangeError('Unknown price scale');
  if(!Number.isFinite(factor)||factor<=0||!Number.isFinite(offset)||(scale==='log'&&offset!==0)||!Number.isFinite(top)||!Number.isFinite(bottom)||top===bottom)throw new RangeError('Invalid price axis');
  const prices=values.filter(value=>Number.isFinite(value)&&value>0);
  if(!prices.length)throw new RangeError('A price axis requires positive prices');
  const low=Math.min(...prices),high=Math.max(...prices),manual=domain===null?null:normalizePriceDomain(domain,{scale});
  if(domain!==null&&!manual)throw new RangeError('Invalid manual price domain');
  let min,max;
  if(paddingRatio!==null&&(!Number.isFinite(paddingRatio)||paddingRatio<0||paddingRatio>1))throw new RangeError('Invalid price padding');
  const paddingFraction=paddingRatio??.12;
  if(manual){({min,max}=manual);}
  else if(scale==='log'){const padding=Math.max(Math.log(high)-Math.log(low),.002)*Math.max(high===low ? .001 : 0,paddingFraction);min=low*Math.exp(-padding);max=high*Math.exp(padding);}
  else{const padding=(high-low||high*.2)*Math.max(high===low ? .001 : 0,paddingFraction);min=Math.max(0,low-padding);max=high+padding;}
  const transform=scale==='log'?Math.log:value=>value;
  const reverse=scale==='log'?Math.exp:value=>value;
  const first=transform(min),extent=transform(max)-first;
  if(![min,max,first,extent].every(Number.isFinite)||max<=min||extent<=0||(scale==='log'&&min<=0))throw new RangeError('Price domain cannot be represented');
  const y=value=>inverted?top+(transform(value)-first)/extent*(bottom-top):bottom-(transform(value)-first)/extent*(bottom-top);
  const invert=pixel=>reverse(first+(inverted?pixel-top:bottom-pixel)/(bottom-top)*extent);
  const count=Math.max(2,Math.min(64,Number.isFinite(tickCount)?Math.floor(tickCount)||6:6)),a=min*factor+offset,b=max*factor+offset;
  if(![a,b].every(Number.isFinite)||b<=a||(scale==='log'&&a<=0))throw new RangeError('Price labels exceed the numeric range');
  const displayTicks=[];
  if(scale==='log'){
    const firstExponent=Math.max(-323,Math.floor(Math.log10(a))-1),lastExponent=Math.min(308,Math.ceil(Math.log10(b))+1);
    for(let exponent=firstExponent;exponent<=lastExponent;exponent++)for(const multiplier of [1,2,5]){
      const value=multiplier*10**exponent;if(value>=a&&value<=b)displayTicks.push(value);
    }
    if(displayTicks.length<2){displayTicks.length=0;const firstLog=Math.log(a),logSpan=Math.log(b)-firstLog;for(let i=0;i<count;i++)displayTicks.push(i===0?a:i===count-1?b:Math.exp(firstLog+logSpan*i/(count-1)));}
    const stride=Math.max(1,Math.ceil(displayTicks.length/count));
    return {scale,min,max,top,bottom,inverted:Boolean(inverted),mode:manual?'manual':'auto',y,invert,ticks:displayTicks.filter((_,i)=>i%stride===0).map(value=>(value-offset)/factor)};
  }
  const rough=(b-a)/(count-1),magnitude=10**Math.floor(Math.log10(rough));
  const step=([1,2,2.5,5,10].find(value=>value>=rough/magnitude)||10)*magnitude;
  if(!Number.isFinite(step)||step<=0)throw new RangeError('Price ticks cannot be represented');
  const firstTick=Math.ceil(a/step);
  for(let index=0;index<count*4+16&&(firstTick+index)*step<=b+step*1e-9;index++)displayTicks.push(Number(((firstTick+index)*step).toPrecision(12)));
  return {scale,min,max,top,bottom,inverted:Boolean(inverted),mode:manual?'manual':'auto',y,invert,ticks:displayTicks.map(value=>(value-offset)/factor)};
}

/** Header change compares completed closes; candle body direction stays open-based. */
export function barPriceChange(close, previousClose, open = null) {
  const valid = value => Number.isFinite(value) && value > 0;
  const previous = valid(previousClose) ? previousClose : null;
  const changePrice = valid(close) && previous !== null ? close - previous : null;
  const changePct = changePrice !== null ? changePrice / previous * 100 : null;
  return {
    changeBasis:'previous-close', previousClose:previous, changePrice, changePct,
    previousCloseChangePct:changePct,
    fromOpenChangePrice:valid(close)&&valid(open)?close-open:null,
    fromOpenChangePct:valid(close)&&valid(open)?(close/open-1)*100:null,
  };
}

/** Rows are chronological daily observations or model points, never weekly samples. */
export function nearestDailyIndex(rows,day) {
  if(!rows.length)return -1;
  const target=typeof day==='string'?utcDay(day):day;
  if(!Number.isFinite(target))throw new RangeError('Invalid calendar position');
  let lo=0,hi=rows.length-1;
  while(lo<hi){const mid=(lo+hi)>>1;if(utcDay(rows[mid].date)<target)lo=mid+1;else hi=mid;}
  return lo>0&&Math.abs(utcDay(rows[lo-1].date)-target)<Math.abs(utcDay(rows[lo].date)-target)?lo-1:lo;
}

export function measureDailyRange(rows,measurement,split=null) {
  if(!measurement||!rows.length)return null;
  const start=rows[nearestDailyIndex(rows,measurement.startDate)];
  const end=measurement.endDate?rows[nearestDailyIndex(rows,measurement.endDate)]:null;
  if(!Number.isFinite(start.price)||start.price<=0||(end&&(!Number.isFinite(end.price)||end.price<=0)))throw new RangeError('Measurement requires positive prices');
  const includesSimulated=Boolean(split&&(start.date>split||(end&&end.date>split)));
  return {
    startDate:start.date,endDate:end?.date??null,startPrice:start.price,endPrice:end?.price??null,
    deltaDays:end?utcDay(end.date)-utcDay(start.date):null,
    changePrice:end?end.price-start.price:null,
    changePct:end?(end.price/start.price-1)*100:null,
    includesSimulated,kind:includesSimulated?'simulated':'observed'
  };
}
