import { utcDay } from './cycle-engine.js?v=1.11.0';

/** All coordinates use original prices; factor affects only the choice of ticks. */
export function createPriceScale(values,{scale='log',top=0,bottom=1,tickCount=6,factor=1,paddingRatio=null}={}) {
  if(!['log','linear'].includes(scale))throw new RangeError('Unknown price scale');
  if(!Number.isFinite(factor)||factor<=0||!Number.isFinite(top)||!Number.isFinite(bottom)||top===bottom)throw new RangeError('Invalid price axis');
  const prices=values.filter(value=>Number.isFinite(value)&&value>0);
  if(!prices.length)throw new RangeError('A price axis requires positive prices');
  const low=Math.min(...prices),high=Math.max(...prices);
  let min,max;
  if(paddingRatio!==null&&(!Number.isFinite(paddingRatio)||paddingRatio<0||paddingRatio>1))throw new RangeError('Invalid price padding');
  if(scale==='log'&&paddingRatio!==null){const padding=Math.max(Math.log(high/low),.002)*paddingRatio;min=low*Math.exp(-padding);max=high*Math.exp(padding);}
  else if(scale==='log'){min=low*.82;max=high*1.19;}
  else{const padding=(high-low||high*.2)*.1;min=Math.max(0,low-padding);max=high+padding;}
  const transform=scale==='log'?Math.log:value=>value;
  const reverse=scale==='log'?Math.exp:value=>value;
  const first=transform(min),extent=transform(max)-first;
  const y=value=>bottom-(transform(value)-first)/extent*(bottom-top);
  const invert=pixel=>reverse(first+(bottom-pixel)/(bottom-top)*extent);
  const count=Math.max(2,Math.floor(tickCount)||6),a=min*factor,b=max*factor;
  const displayTicks=[];
  if(scale==='log'){
    for(let exponent=Math.floor(Math.log10(a))-1;exponent<=Math.ceil(Math.log10(b))+1;exponent++)for(const multiplier of [1,2,5]){
      const value=multiplier*10**exponent;if(value>=a&&value<=b)displayTicks.push(value);
    }
    if(displayTicks.length<2&&paddingRatio!==null){displayTicks.length=0;for(let i=0;i<count;i++)displayTicks.push(a*Math.pow(b/a,i/(count-1)));}
    const stride=Math.max(1,Math.ceil(displayTicks.length/count));
    return {scale,min,max,y,invert,ticks:displayTicks.filter((_,i)=>i%stride===0).map(value=>value/factor)};
  }
  const rough=(b-a)/(count-1),magnitude=10**Math.floor(Math.log10(rough));
  const step=([1,2,2.5,5,10].find(value=>value>=rough/magnitude)||10)*magnitude;
  const firstTick=Math.ceil(a/step);
  for(let i=firstTick;i*step<=b+step*1e-9;i++)displayTicks.push(Number((i*step).toPrecision(12)));
  return {scale,min,max,y,invert,ticks:displayTicks.map(value=>value/factor)};
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
