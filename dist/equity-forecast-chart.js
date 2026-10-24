const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
/** Forecast observations have a price and scenario bounds, never OHLCV. */
export function equityForecastRows(forecast,lastObservedTime){
  if(!forecast)return [];
  const rows=[];let previous=lastObservedTime;
  for(const point of forecast.path||[]){
    const time=Date.parse(`${String(point.date).slice(0,10)}T00:00:00Z`)/1000;
    if(!Number.isSafeInteger(time)||time<=lastObservedTime)continue;
    if(time<=previous||!Number.isFinite(point.price)||point.price<0||!Number.isFinite(point.low)||!Number.isFinite(point.high)||point.low<0||point.low>point.price||point.high<point.price)throw new TypeError('Invalid equity forecast path');
    rows.push({...point,time,date:`${String(point.date).slice(0,10)}T00:00:00Z`,close:point.price,kind:'forecast'});previous=time;
  }
  return rows;
}

export function equityForecastMarkup({forecast,points,lastObserved,x,y,left,right,top,bottom,clipId,minTime,maxTime,showBand=true,scale='log'}){
  if(!forecast||!points.length)return {markup:'',markerIds:new Set()};
  const pointBefore=points.findLast(row=>row.time<minTime);
  const included=points.filter(row=>row.time>=minTime&&row.time<=maxTime);
  const pointAfter=points.find(row=>row.time>maxTime);
  const values=[...(pointBefore?[pointBefore]:lastObserved?[{...lastObserved,price:lastObserved.close,low:lastObserved.close,high:lastObserved.close}]:[]),...included,...(pointAfter?[pointAfter]:[])];
  let path='',continuous=false;
  for(const row of values){if(row.price===0&&scale==='log'){continuous=false;continue;}path+=`${continuous?'L':'M'}${x(row.time).toFixed(2)},${y(row.price).toFixed(2)} `;continuous=true;}
  const boundaryY=value=>value===0&&scale==='log'?bottom:y(value);
  const band=[...values,...[...values].reverse()].map((row,index)=>`${index?'L':'M'}${x(row.time).toFixed(2)},${boundaryY(index<values.length?row.high:row.low).toFixed(2)}`).join(' ')+'Z';
  const zeroBound=included.find(row=>row.low===0),zeroPrice=included.find(row=>row.price===0);
  let markup=`<g class="equity-forecast-layer" clip-path="url(#${clipId})">${showBand&&band?`<path class="equity-forecast-band" data-zero-bound="${Boolean(zeroBound)}" d="${band}" fill="#c79b4b" opacity=".13"><title>${zeroBound?'하한 0: 잔여가치 소진. 로그축에서 0은 표시할 수 없어 음영을 축 하단까지 자릅니다.':'세 조건의 최소·최대 가정 범위. 확률 또는 신뢰구간이 아닙니다.'}</title></path>`:''}<path class="equity-forecast-line" d="${path}" fill="none" stroke="#e2b66c" stroke-width="1.8" stroke-dasharray="7 5"/>`;
  if(zeroPrice||zeroBound){const zero=zeroPrice||zeroBound;markup+=`<g class="equity-zero-residual" data-zero-price="${Boolean(zeroPrice)}"><title>${zero.date.slice(0,10)} · ${zeroPrice?'선택한 조건':'하단 조건'}의 보통주 잔여가치가 0입니다. 양수 가격으로 대체하지 않습니다.</title><text x="${Math.max(left+6,Math.min(right-170,x(zero.time)))}" y="${bottom-8}" fill="#e1a08b" font-size="10">${zeroPrice?'가정 가격 0':'범위 하한 0'} · 잔여가치 소진${scale==='log'?' · 로그축 외':''}</text></g>`;}
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
