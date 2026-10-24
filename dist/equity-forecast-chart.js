const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function forecastTime(value){
  const time=typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)?Date.parse(`${value}T00:00:00Z`)/1000:NaN;
  if(!Number.isSafeInteger(time)||new Date(time*1000).toISOString().slice(0,10)!==value)throw new TypeError('Invalid equity forecast date');
  return time;
}

export function equityForecastAnchor(forecast,lastObserved){
  if(!forecast?.asOf||!lastObserved)return lastObserved;
  const time=forecastTime(forecast.asOf),point=forecast.path?.find(row=>row.date===forecast.asOf);
  if(!point||!Number.isFinite(point.price)||point.price<=0||time<lastObserved.time)throw new TypeError('Invalid equity forecast anchor');
  return {time,date:`${forecast.asOf}T00:00:00Z`,close:point.price};
}

/** Forecast observations have a price and scenario bounds, never OHLCV. */
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

export function equityForecastWindowRows(points,lastObserved,minTime,maxTime,scale='log'){
  if(!points.length)return [];
  const values=lastObserved?[{...lastObserved,price:lastObserved.close,low:lastObserved.close,high:lastObserved.close},...points]:points;
  const visible=points.filter(row=>row.time>=minTime&&row.time<=maxTime);
  for(const time of new Set([minTime,maxTime])){
    if(time<=values[0].time||time>=values.at(-1).time||visible.some(row=>row.time===time))continue;
    const next=values.findIndex(row=>row.time>time),left=values[next-1],right=values[next];
    if(scale==='log'&&((left.price===0)!==(right.price===0)))continue;
    const fraction=(time-left.time)/(right.time-left.time);
    const interpolate=key=>scale==='log'&&left[key]>0&&right[key]>0?Math.exp(Math.log(left[key])*(1-fraction)+Math.log(right[key])*fraction):scale==='log'&&((left[key]===0)!==(right[key]===0))?null:left[key]*(1-fraction)+right[key]*fraction;
    const price=interpolate('price'),low=interpolate('low'),high=interpolate('high'),unavailableBounds=['low','high'].filter(key=>(key==='low'?low:high)===null);
    visible.push({time,date:new Date(time*1000).toISOString(),price,close:price,low:low===null?null:Math.min(price,low),high:high===null?null:Math.max(price,high),kind:'forecast',interpolated:true,sourceIds:[...new Set([...(left.sourceIds||[]),...(right.sourceIds||[])])],interpolation:{from:left.date,to:right.date,scale,unavailableBounds}});
  }
  return visible.sort((a,b)=>a.time-b.time);
}

export function equityForecastLogGaps(points,lastObserved,minTime,maxTime){
  const values=lastObserved?[{...lastObserved,price:lastObserved.close,low:lastObserved.close,high:lastObserved.close},...points]:points;
  return values.slice(1).flatMap((row,index)=>{
    const before=values[index],fields=['price','low','high'].filter(key=>(before[key]===0)!==(row[key]===0));
    return fields.length&&row.time>minTime&&before.time<maxTime?[{from:before.time,to:row.time,fields}]:[];
  });
}

export function equityForecastMarkup({forecast,points,lastObserved,x,y,left,right,top,bottom,clipId,minTime,maxTime,showBand=true,scale='log',visibleRows=equityForecastWindowRows(points,lastObserved,minTime,maxTime,scale)}){
  if(!forecast||!points.length)return {markup:'',markerIds:new Set()};
  const pointBefore=points.findLast(row=>row.time<minTime);
  const included=points.filter(row=>row.time>=minTime&&row.time<=maxTime);
  const pointAfter=points.find(row=>row.time>maxTime);
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
  let markup=`<g class="equity-forecast-layer" clip-path="url(#${clipId})">${showBand&&band?`<path class="equity-forecast-band" data-zero-bound="${Boolean(zeroBound)}" d="${band}" fill="#c79b4b" opacity=".13"><title>${zeroBound?'하한 0: 잔여가치 소진. 로그축에서 0은 표시할 수 없어 음영을 축 하단까지 자릅니다.':'세 조건의 최소·최대 가정 범위. 확률 또는 신뢰구간이 아닙니다.'}</title></path>`:''}<path class="equity-forecast-line" d="${path}" fill="none" stroke="#e2b66c" stroke-width="1.8" stroke-dasharray="7 5"/>`;
  if(zeroPrice||zeroBound){const zero=zeroPrice||zeroBound;markup+=`<g class="equity-zero-residual" data-zero-price="${Boolean(zeroPrice)}"><title>${zero.date.slice(0,10)} · ${zeroPrice?'선택한 조건':'하단 조건'}의 보통주 잔여가치가 0입니다. 양수 가격으로 대체하지 않습니다.</title><text x="${Math.max(left+6,Math.min(right-170,x(zero.time)))}" y="${bottom-8}" fill="#e1a08b" font-size="10">${zeroPrice?'가정 가격 0':'범위 하한 0'} · 잔여가치 소진${scale==='log'?' · 로그축 외':''}</text></g>`;}
  if(scale==='log'&&equityForecastLogGaps(points,lastObserved,minTime,maxTime).some(gap=>showBand||gap.fields.includes('price')))markup+=`<g class="equity-log-gap"><title>양수와 0 사이의 구간은 로그축에서 보간하지 않습니다. 해당 가격선 또는 가정 범위를 생략합니다. 선형축에서 확인해 주세요.</title><text x="${left+6}" y="${top+15}" fill="#e1a08b" font-size="10">0 경계 구간 · 로그 연결 생략</text><text x="${left+6}" y="${top+29}" fill="#e1a08b" font-size="10">선형축에서 확인해 주세요.</text></g>`;
  const markerIds=new Set();let lastLabelX=-Infinity;
  for(const item of forecast.milestones||[]){
    const time=Date.parse(`${String(item.date).slice(0,10)}T00:00:00Z`)/1000;
    if(!Number.isFinite(time)||time<minTime||time>maxTime||typeof item.id!=='string')continue;
    const point=points.reduce((closest,row)=>Math.abs(row.time-time)<Math.abs(closest.time-time)?row:closest,points[0]);
    const xx=x(time),yy=point.price<=0?bottom-20:Math.max(top+12,Math.min(bottom-12,y(point.price))),label=xx-lastLabelX>145;
    markup+=`<g class="equity-forecast-evidence" role="button" tabindex="0" data-forecast-evidence="${esc(item.id)}" aria-label="${esc(item.title)} · 미래 가정 근거"><title>${esc(item.date)} · ${esc(item.title)} · ${esc(item.description)}</title><line x1="${xx}" x2="${xx}" y1="${yy}" y2="${bottom}" stroke="#d4ad68" opacity=".22" stroke-dasharray="2 5"/><circle cx="${xx}" cy="${yy}" r="5" fill="#181b21" stroke="#e2b66c" stroke-width="1.8"/>${label?`<text x="${Math.min(right-5,Math.max(left+5,xx+8))}" y="${yy-10}" fill="#e2bd7c" font-size="10">${esc(item.title)}</text>`:''}</g>`;
    if(label)lastLabelX=xx;markerIds.add(item.id);
  }
  markup+='</g>';return {markup,markerIds};
}
