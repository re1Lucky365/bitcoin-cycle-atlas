import {utcDay} from './cycle-engine.js?v=1.19.0';
import {dateWindow,lowerBoundDate,upperBoundDate} from './chart-window.js?v=1.11.0';

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function forecastTime(value){
  try{return utcDay(value)*86400;}catch{throw new TypeError('Invalid equity forecast date');}
}

export function equityForecastAnchor(forecast,lastObserved){
  if(!forecast?.asOf||!lastObserved)return lastObserved;
  const time=forecastTime(forecast.asOf),point=forecast.path?.find(row=>row.date===forecast.asOf);
  if(!point||!Number.isFinite(point.price)||point.price<=0||time<lastObserved.time)throw new TypeError('Invalid equity forecast anchor');
  return {time,date:`${forecast.asOf}T00:00:00Z`,close:point.price};
}

/** Scenario bounds stay separate from a simulated path bar's extrema. */
export function equityForecastRows(forecast,lastObservedTime){
  if(!forecast)return [];
  if(!Array.isArray(forecast.path))throw new TypeError('Invalid equity forecast path');
  const rows=[];let previous=-Infinity;
  for(const point of forecast.path){
    const time=forecastTime(point?.date);
    if(time<=previous||!Number.isFinite(point.price)||point.price<0||!Number.isFinite(point.low)||!Number.isFinite(point.high)||point.low<0||point.low>point.price||point.high<point.price)throw new TypeError('Invalid equity forecast path');
    previous=time;if(time<=lastObservedTime)continue;
    rows.push({...point,time,date:`${point.date}T00:00:00Z`,close:point.price,kind:'forecast'});
  }
  return rows;
}

export const EQUITY_FORECAST_BAR_NOTE='일별 모의 평가값을 모은 경로봉입니다. 주중 표시 사이의 주말 변화를 포함하며, 거래소 휴장일·장중 시가·고가·저가·체결량을 예측한 OHLC가 아닙니다.';
const candleCache=new WeakMap();

export function equityForecastCandles(forecast,interval='daily'){
  if(!['daily','weekly'].includes(interval))throw new RangeError('Invalid simulated bar interval');
  if(forecast?.pathMode!=='asset-linked-daily')return [];
  if(candleCache.get(forecast)?.[interval])return candleCache.get(forecast)[interval];
  const points=equityForecastRows(forecast,-Infinity);
  if(!points.length||points[0].time!==forecastTime(forecast.asOf))throw new TypeError('Invalid simulated path anchor');
  for(let i=1;i<points.length;i++)if(points[i].time-points[i-1].time!==86400)throw new TypeError('Simulated path bars require consecutive daily values');
  const daily=[];let previous=points[0],pending=[];
  for(const row of points.slice(1)){
    pending.push(row);
    const weekday=new Date(row.time*1000).getUTCDay();
    if(weekday===0||weekday===6)continue;
    const values=[previous.price,...pending.map(item=>item.price)];
    daily.push({...row,valuationDate:row.date.slice(0,10),candle:{open:previous.price,high:Math.max(...values),low:Math.min(...values),close:row.price,startDate:previous.date.slice(0,10),endDate:row.date.slice(0,10),definition:'simulated-daily-valuation-range',calendar:'weekdays-not-exchange-calendar'},sourceIds:[...new Set([...(previous.sourceIds||[]),...pending.flatMap(item=>item.sourceIds||[])])]});
    previous=row;pending=[];
  }
  const groups=new Map();
  for(const row of daily){
    const monday=row.time-((new Date(row.time*1000).getUTCDay()+6)%7)*86400;
    if(!groups.has(monday))groups.set(monday,[]);
    groups.get(monday).push(row);
  }
  const weekly=[...groups].map(([monday,rows])=>{
    const first=rows[0],last=rows.at(-1),time=Math.max(monday,first.time);
    return {...last,time,date:new Date(time*1000).toISOString(),candle:{...last.candle,open:first.candle.open,high:Math.max(...rows.map(row=>row.candle.high)),low:Math.min(...rows.map(row=>row.candle.low)),startDate:first.candle.startDate},sourceIds:[...new Set(rows.flatMap(row=>row.sourceIds||[]))]};
  });
  candleCache.set(forecast,{daily,weekly});
  return interval==='daily'?daily:weekly;
}

export function equityForecastWindowRows(points,lastObserved,minTime,maxTime,scale='log'){
  if(!points.length)return [];
  const anchor=lastObserved?{...lastObserved,price:lastObserved.close,low:lastObserved.close,high:lastObserved.close}:null;
  const visible=dateWindow(points,minTime,maxTime,row=>row.time);
  for(const time of new Set([minTime,maxTime])){
    if(time<=(anchor||points[0]).time||time>=points.at(-1).time)continue;
    const next=upperBoundDate(points,time,row=>row.time),left=next?points[next-1]:anchor,right=points[next];
    if(left.time===time)continue;
    if(scale==='log'&&((left.price===0)!==(right.price===0)))continue;
    const fraction=(time-left.time)/(right.time-left.time);
    const interpolate=key=>scale==='log'&&left[key]>0&&right[key]>0?Math.exp(Math.log(left[key])*(1-fraction)+Math.log(right[key])*fraction):scale==='log'&&((left[key]===0)!==(right[key]===0))?null:left[key]*(1-fraction)+right[key]*fraction;
    const price=interpolate('price'),low=interpolate('low'),high=interpolate('high'),unavailableBounds=['low','high'].filter(key=>(key==='low'?low:high)===null);
    visible.push({time,date:new Date(time*1000).toISOString(),price,close:price,low:low===null?null:Math.min(price,low),high:high===null?null:Math.max(price,high),kind:'forecast',interpolated:true,sourceIds:[...new Set([...(left.sourceIds||[]),...(right.sourceIds||[])])],interpolation:{from:left.date,to:right.date,scale,unavailableBounds}});
  }
  return visible.sort((a,b)=>a.time-b.time);
}

export function equityForecastLogGaps(points,lastObserved,minTime,maxTime){
  if(!points.length||maxTime<minTime)return [];
  let index=upperBoundDate(points,minTime,row=>row.time);
  let before=index?points[index-1]:lastObserved?{...lastObserved,price:lastObserved.close,low:lastObserved.close,high:lastObserved.close}:null;
  const gaps=[];
  for(;index<points.length;index++){
    const row=points[index];
    if(before&&before.time>=maxTime)break;
    if(before){
      const fields=['price','low','high'].filter(key=>(before[key]===0)!==(row[key]===0));
      if(fields.length)gaps.push({from:before.time,to:row.time,fields});
    }
    before=row;
  }
  return gaps;
}

export function equityForecastMarkup({forecast,points,lastObserved,x,y,left,right,top,bottom,clipId,minTime,maxTime,showBand=true,scale='log',chartType='line',candles=[],barWidth=4,visibleRows=equityForecastWindowRows(points,lastObserved,minTime,maxTime,scale)}){
  if(!forecast||!points.length)return {markup:'',markerIds:new Set()};
  const first=lowerBoundDate(points,minTime,row=>row.time),last=upperBoundDate(points,maxTime,row=>row.time);
  const pointBefore=points[first-1],included=points.slice(first,last),pointAfter=points[last];
  const values=[...(pointBefore?[pointBefore]:lastObserved?[{...lastObserved,price:lastObserved.close,low:lastObserved.close,high:lastObserved.close}]:[]),...included,...(pointAfter?[pointAfter]:[])];
  let path='',continuous=false;
  for(const row of values){if(row.price===0&&scale==='log'){continuous=false;continue;}path+=`${continuous?'L':'M'}${x(row.time).toFixed(2)},${y(row.price).toFixed(2)} `;continuous=true;}
  const boundaryY=value=>value===0&&scale==='log'?bottom:y(value);
  const bandRuns=[];let run=[];
  for(const row of values){
    const before=run.at(-1);
    if(before&&scale==='log'&&['low','high'].some(key=>(before[key]===0)!==(row[key]===0))){if(run.length>1)bandRuns.push(run);run=[];}
    run.push(row);
  }
  if(run.length>1)bandRuns.push(run);
  const band=bandRuns.map(rows=>[...rows,...[...rows].reverse()].map((row,index)=>`${index?'L':'M'}${x(row.time).toFixed(2)},${boundaryY(index<rows.length?row.high:row.low).toFixed(2)}`).join(' ')+'Z').join(' ');
  const zeroBound=visibleRows.find(row=>row.low===0),zeroPrice=visibleRows.find(row=>row.price===0);
  const useCandles=chartType==='candles'&&forecast.pathMode==='asset-linked-daily'&&candles.length>0;
  let markup=`<g class="equity-forecast-layer" clip-path="url(#${clipId})">${showBand&&band?`<path class="equity-forecast-band" data-zero-bound="${Boolean(zeroBound)}" d="${band}" fill="#c79b4b" opacity=".13"><title>${zeroBound?'하한 0: 잔여가치 소진. 로그축에서 0은 표시할 수 없어 음영을 축 하단까지 자릅니다.':'세 조건의 최소·최대 가정 범위. 확률 또는 신뢰구간이 아닙니다.'}</title></path>`:''}${useCandles?'':`<path class="equity-forecast-line" d="${path}" fill="none" stroke="#e2b66c" stroke-width="1.8" stroke-dasharray="7 5"/>`}`;
  if(useCandles){
    const dense=candles.length>256&&barWidth<2,wicks=['',''],bodies=['',''];
    markup+=`<g class="equity-forecast-candles" data-count="${candles.length}" data-rendering="${dense?'batched':'individual'}"><title>${EQUITY_FORECAST_BAR_NOTE}</title>`;
    for(const row of candles){
      const candle=row.candle;if(scale==='log'&&candle.low<=0)continue;
      const xx=x(row.time),side=candle.close>=candle.open?0:1,color=side?'#ba9bc5':'#e2b66c',yy=Math.min(y(candle.open),y(candle.close)),height=Math.max(1,Math.abs(y(candle.open)-y(candle.close)));
      if(dense){wicks[side]+=`M${xx.toFixed(2)},${y(candle.high).toFixed(2)}V${y(candle.low).toFixed(2)}`;bodies[side]+=`M${(xx-barWidth/2).toFixed(2)},${yy.toFixed(2)}h${barWidth.toFixed(2)}v${height.toFixed(2)}h${(-barWidth).toFixed(2)}Z`;}
      else markup+=`<g class="equity-forecast-candle" data-time="${row.time}" data-path-open="${candle.open}" data-path-high="${candle.high}" data-path-low="${candle.low}" data-path-close="${candle.close}"><line x1="${xx}" x2="${xx}" y1="${y(candle.high)}" y2="${y(candle.low)}" stroke="${color}"/><rect x="${xx-barWidth/2}" y="${yy}" width="${barWidth}" height="${height}" fill="${color}" fill-opacity=".25" stroke="${color}" stroke-dasharray="2 1"/><title>${candle.startDate} – ${candle.endDate} · 모의 경로봉 · ${EQUITY_FORECAST_BAR_NOTE}</title></g>`;
    }
    if(dense)for(let side=0;side<2;side++){const color=side?'#ba9bc5':'#e2b66c';markup+=`<path d="${wicks[side]}" fill="none" stroke="${color}" opacity=".75"/><path d="${bodies[side]}" fill="${color}" opacity=".55"/>`;}
    markup+='</g>';
  }
  if(zeroPrice||zeroBound){const zero=zeroPrice||zeroBound;markup+=`<g class="equity-zero-residual" data-zero-price="${Boolean(zeroPrice)}"><title>${zero.date.slice(0,10)} · ${zeroPrice?'선택한 조건':'하단 조건'}의 보통주 잔여가치가 0입니다. 양수 가격으로 대체하지 않습니다.</title><text x="${Math.max(left+6,Math.min(right-170,x(zero.time)))}" y="${bottom-8}" fill="#e1a08b" font-size="10">${zeroPrice?'가정 가격 0':'범위 하한 0'} · 잔여가치 소진${scale==='log'?' · 로그축 외':''}</text></g>`;}
  if(scale==='log'&&equityForecastLogGaps(points,lastObserved,minTime,maxTime).some(gap=>showBand||gap.fields.includes('price')))markup+=`<g class="equity-log-gap"><title>양수와 0 사이의 구간은 로그축에서 보간하지 않습니다. 해당 가격선 또는 가정 범위를 생략합니다. 선형축에서 확인해 주세요.</title><text x="${left+6}" y="${top+15}" fill="#e1a08b" font-size="10">0 경계 구간 · 로그 연결 생략</text><text x="${left+6}" y="${top+29}" fill="#e1a08b" font-size="10">선형축에서 확인해 주세요.</text></g>`;
  const markerIds=new Set();let lastLabelX=-Infinity;
  for(const item of forecast.milestones||[]){
    const time=Date.parse(`${String(item.date).slice(0,10)}T00:00:00Z`)/1000;
    if(!Number.isFinite(time)||time<minTime||time>maxTime||typeof item.id!=='string')continue;
    const next=lowerBoundDate(points,time,row=>row.time),before=points[next-1],after=points[next];
    const point=!before?after:!after?before:after.time-time<time-before.time?after:before;
    const xx=x(time),yy=point.price<=0?bottom-20:Math.max(top+12,Math.min(bottom-12,y(point.price))),label=xx-lastLabelX>145,color=item.turnType==='high'?'#bc9bd7':item.turnType==='low'?'#7bbfae':'#e2b66c';
    markup+=`<g class="equity-forecast-evidence" role="button" tabindex="0" data-forecast-evidence="${esc(item.id)}" data-turn-type="${esc(item.turnType||'assumption')}" aria-label="${esc(item.title)} · 미래 가정 근거"><title>${esc(item.date)} · ${esc(item.title)} · ${esc(item.description)}</title><line x1="${xx}" x2="${xx}" y1="${yy}" y2="${bottom}" stroke="${color}" opacity=".22" stroke-dasharray="2 5"/><circle cx="${xx}" cy="${yy}" r="5" fill="#181b21" stroke="${color}" stroke-width="1.8"/>${label?`<text x="${Math.min(right-5,Math.max(left+5,xx+8))}" y="${yy-10}" fill="${color}" font-size="10">${esc(item.title)}</text>`:''}</g>`;
    if(label)lastLabelX=xx;markerIds.add(item.id);
  }
  markup+='</g>';return {markup,markerIds};
}
