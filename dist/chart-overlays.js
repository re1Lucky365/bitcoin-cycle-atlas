import { pixelExtrema } from './chart-window.js?v=1.11.0';
/** Pure layout helpers shared by the daily and intraday chart renderers. */
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const numberFormats=new Map();
const number=(value,digits=2)=>{if(!numberFormats.has(digits))numberFormats.set(digits,new Intl.NumberFormat('en-US',{maximumFractionDigits:digits}));return numberFormats.get(digits).format(value);};
export const EVENT_COLORS=Object.freeze({protocol:'#d8b779',regulation:'#aeb9ed',adoption:'#79c6b6',institution:'#84bce5',security:'#d3a5c5',market:'#b6c2d3',macro:'#c5b08b'});

export function formatBtcVolume(value){
  if(!Number.isFinite(value)||value<0)return '—';
  return value>=1e6?`${number(value/1e6)}M`:value>=1e3?`${number(value/1e3)}k`:number(value,value<1?6:2);
}

export function chartPaneLayout({width,height,volume=true,drawdown=false,states=false,cycleTiming=false,top=66}){
  const small=width<600,short=height<360,left=Math.min(small?8:12,width*.05),right=Math.min(small?66:82,width*.25);
  const axisY=height-Math.min(small?29:22,height*.15),bottom=axisY-Math.min(24,height*.12);
  // Explicitly requested secondary panes stay present. Reduce their heights and
  // title gaps together when the viewport cannot hold their preferred sizes.
  top=Math.min(top,bottom*.55);
  const available=bottom-top;
  const volumeHeight=volume?Math.min(112,Math.max(short?38:58,height*.18)):0;
  const stateHeight=states?(short?8:10):0,cycleHeight=cycleTiming?(short?9:12):0,ddHeight=drawdown?Math.min(70,Math.max(28,height*.12)):0;
  const desiredVolumeGap=volume?(drawdown||states||cycleTiming?24:26):0,desiredStateGap=states?(drawdown||cycleTiming?14:18):0,desiredCycleGap=cycleTiming?24:0,desiredDdGap=drawdown?23:0;
  const desiredSecondary=volumeHeight+stateHeight+cycleHeight+ddHeight+desiredVolumeGap+desiredStateGap+desiredCycleGap+desiredDdGap;
  const priceReserve=Math.min(96,available*.35),paneScale=desiredSecondary?Math.min(1,(available-priceReserve)/desiredSecondary):1;
  const volumeGap=desiredVolumeGap*paneScale,stateGap=desiredStateGap*paneScale,cycleGap=desiredCycleGap*paneScale,ddGap=desiredDdGap*paneScale;
  let cursor=bottom;
  const volumeBottom=cursor,volumeTop=cursor-volumeHeight*paneScale;if(volume)cursor=volumeTop-volumeGap;
  const stateBottom=cursor,stateTop=cursor-stateHeight*paneScale;if(states)cursor=stateTop-stateGap;
  const cycleBottom=cursor,cycleTop=cursor-cycleHeight*paneScale;if(cycleTiming)cursor=cycleTop-cycleGap;
  const ddBottom=cursor,ddTop=cursor-ddHeight*paneScale;if(drawdown)cursor=ddTop-ddGap;
  const priceBottom=cursor;
  return {left,right,top,axisY,bottom,priceBottom,volumeTop,volumeBottom,ddTop,ddBottom,stateTop,stateBottom,cycleTop,cycleBottom,paneScale,
    cycleTitleY:cycleTop-cycleGap*.25,cycleTitleFontSize:Math.min(10,cycleGap*.45),
    stateTitleY:stateTop-stateGap*.2,stateTitleFontSize:Math.min(10,stateGap*.65),
    ddTitleY:ddTop-ddGap*.28,ddTitleFontSize:Math.min(height<320?11:12,ddGap*.52),
    volumeTitleY:volumeTop-volumeGap*.25,volumeTitleFontSize:Math.min(10,volumeGap*.45),volumeSeparatorY:volumeTop-volumeGap*.83};
}

const overlaps=(a,b,padding=5)=>a.x<b.x+b.width+padding&&a.x+a.width+padding>b.x&&a.y<b.y+b.height+padding&&a.y+a.height+padding>b.y;
const labelWidth=label=>[...label].reduce((width,char)=>width+(char.charCodeAt(0)>255?10:6),0);
function fitLabel(label,width){
  if(labelWidth(label)<=width)return label;
  let fitted='',used=0;
  for(const char of label){const next=labelWidth(char);if(used+next+10>width)break;fitted+=char;used+=next;}
  return `${fitted}…`;
}

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const chronological=(a,b)=>String(a.event.date).localeCompare(String(b.event.date))||String(a.event.id).localeCompare(String(b.event.id));
const importance=anchor=>Number.isFinite(anchor.event.importance)?anchor.event.importance:1;
const priority=(a,b)=>importance(b)-importance(a)||chronological(a,b);
const labelEdge=(anchor,box)=>({x:clamp(anchor.x,box.x+7,box.x+box.width-7),y:box.y>anchor.y?box.y:box.y+box.height});

function historicalLabelPolicy(valid,{left,right,top,bottom,visibleSpanDays,maxLabels}){
  const adaptive=Number.isFinite(visibleSpanDays)&&visibleSpanDays>0;
  const cap=Number.isFinite(maxLabels)?Math.max(0,Math.floor(maxLabels)):adaptive?Infinity:18;
  if(!adaptive)return {mode:'legacy',budget:Math.min(valid.length,cap),minGap:0,verticalGap:0,spreadWeight:0,maxWidth:Infinity,offsets:[30,58,86,114,142],maxLeader:Infinity};
  const width=Math.max(0,right-left),height=Math.max(0,bottom-top),pixelsPerDay=width/visibleSpanDays;
  const mode=pixelsPerDay<.35?'overview':pixelsPerDay<1.6?'context':'detail';
  const settings={
    overview:{spacingFactor:.95,spacingExtra:8,minSpacing:90,maxSpacing:126,gapFactor:.38,minGap:34,maxGap:68,verticalGap:Infinity,spreadWeight:2.5,maxWidth:140,offsets:[18,32,46],maxLeader:56},
    context:{spacingFactor:.72,spacingExtra:6,minSpacing:64,maxSpacing:100,gapFactor:.35,minGap:24,maxGap:50,verticalGap:64,spreadWeight:1.5,maxWidth:164,offsets:[18,34,50,66],maxLeader:78},
    detail:{spacingFactor:.52,spacingExtra:4,minSpacing:48,maxSpacing:76,gapFactor:.14,minGap:8,maxGap:24,verticalGap:40,spreadWeight:.5,maxWidth:190,offsets:[16,30,44,58,72],maxLeader:96},
  }[mode];
  const widths=valid.map(anchor=>Math.min(settings.maxWidth,Math.max(58,labelWidth(String(anchor.event.label||anchor.event.title))+18))).sort((a,b)=>a-b);
  const medianWidth=widths.length?widths[Math.floor(widths.length/2)]:58;
  const eventSpan=valid.length?Math.max(...valid.map(anchor=>anchor.x))-Math.min(...valid.map(anchor=>anchor.x)):0;
  // Empty future years never buy more names for a tightly packed history.
  const occupiedWidth=valid.length?Math.min(width,eventSpan+medianWidth):0;
  const spacing=clamp(medianWidth*settings.spacingFactor+settings.spacingExtra,settings.minSpacing,settings.maxSpacing);
  const heightFactor=clamp((height-26)/180,0,1);
  const budget=width>=62&&height>=26?Math.min(valid.length,cap,Math.ceil(occupiedWidth/spacing*heightFactor)):0;
  return {...settings,mode,budget,minGap:clamp(medianWidth*settings.gapFactor,settings.minGap,settings.maxGap),eventSpan:Math.max(eventSpan,1)};
}

function findHistoricalLabelBox(anchor,width,bounds,policy,boxes,valid){
  const {left,right,top,bottom}=bounds,height=22,preferred=anchor.y>(top+bottom)/2?-1:1;
  for(const offset of policy.offsets)for(const side of [preferred,-preferred]){
    const yy=anchor.y+side*offset-(side<0?height:0);
    if(yy<top+2||yy+height>bottom-3)continue;
    for(const shift of [0,-width*.35,width*.35]){
      const xx=clamp(anchor.x-width/2+shift,left+2,right-width-2),box={x:xx,y:yy,width,height},edge=labelEdge(anchor,box);
      if(Math.hypot(edge.x-anchor.x,edge.y-anchor.y)>policy.maxLeader)continue;
      if(boxes.some(other=>overlaps(box,other)))continue;
      // A permanent name must not cover another event's clickable dot.
      if(policy.mode!=='legacy'&&valid.some(point=>point.x>=box.x-8&&point.x<=box.x+box.width+8&&point.y>=box.y-8&&point.y<=box.y+box.height+8))continue;
      return box;
    }
  }
  return null;
}

function historicalPreview(anchor,bounds){
  const {left,right,top,bottom}=bounds,availableWidth=Math.max(0,right-left-4),height=22;
  if(availableWidth<58||bottom-top<height+5)return null;
  const fullLabel=String(anchor.event.label||anchor.event.title),width=Math.min(190,Math.max(58,labelWidth(fullLabel)+18),availableWidth);
  const above=anchor.y-10-height,below=anchor.y+10,preferred=anchor.y>(top+bottom)/2?above:below;
  const y=clamp(preferred,top+2,bottom-height-3),x=clamp(anchor.x-width/2,left+2,right-width-2);
  return {box:{x,y,width,height},label:fitLabel(fullLabel,width-18)};
}

function historicalMarkerLayout(anchors,bounds={}){
  const {left,right,top,bottom,activeEventId}=bounds;
  const valid=anchors.filter(anchor=>Number.isFinite(anchor.x)&&Number.isFinite(anchor.y)&&anchor.x>=left&&anchor.x<=right&&anchor.y>=top&&anchor.y<=bottom);
  const policy=historicalLabelPolicy(valid,bounds),boxes=[],selected=[],placed=new Map(),availableWidth=Math.max(0,right-left-4);
  let pending=[...valid],cursor=0,needsSort=true;
  while(cursor<pending.length){
    // Scores change only when another label is placed. Once the pixel budget is
    // full, remaining dots/previews require no further scoring or sorting.
    if(needsSort&&boxes.length<policy.budget){
      pending=pending.slice(cursor);cursor=0;
      const scores=new Map(pending.map(anchor=>[anchor,importance(anchor)+(selected.length?policy.spreadWeight*Math.min(...selected.map(other=>Math.abs(anchor.x-other.x)))/(policy.eventSpan||1):0)]));
      pending.sort((a,b)=>Number(b.event.id===activeEventId)-Number(a.event.id===activeEventId)||scores.get(b)-scores.get(a)||priority(a,b));needsSort=false;
    }
    const anchor=pending[cursor++],fullLabel=String(anchor.event.label||anchor.event.title),width=Math.min(Math.max(58,labelWidth(fullLabel)+18),policy.maxWidth,availableWidth);
    let box=null;
    const crowded=selected.some(other=>Math.abs(anchor.x-other.x)<policy.minGap&&Math.abs(anchor.y-other.y)<policy.verticalGap);
    if(boxes.length<policy.budget&&availableWidth>=58&&!crowded)box=findHistoricalLabelBox(anchor,width,bounds,policy,boxes,valid);
    if(box){boxes.push(box);selected.push(anchor);needsSort=true;}
    placed.set(anchor.event.id,{...anchor,label:fitLabel(fullLabel,Math.max(0,width-18)),box,active:anchor.event.id===activeEventId,preview:box?null:historicalPreview(anchor,bounds)});
  }
  const ordered=policy.mode==='legacy'?valid:[...valid].sort(chronological);
  return {markers:ordered.map(anchor=>placed.get(anchor.event.id)),policy};
}

/** visibleSpanDays enables zoom policy; omitted input keeps the legacy budget.
 * Priority controls legibility only, not the importance of an event to price.
 * Every visible event remains a dot even when its persistent name is hidden. */
export function layoutHistoricalMarkers(anchors,bounds={}){
  return historicalMarkerLayout(anchors,bounds).markers;
}

function historicalLabelMarkup(anchor,box,label,color){
  const edge=labelEdge(anchor,box);
  return `<path d="M${anchor.x},${anchor.y}L${edge.x},${edge.y}" fill="none" stroke="${color}" stroke-width=".8" opacity=".7"/><rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="4" fill="#142131" fill-opacity=".96" stroke="${color}" stroke-opacity=".65"/><text x="${box.x+box.width/2}" y="${box.y+15}" text-anchor="middle" fill="${color}" font-size="10">${esc(label)}</text>`;
}

export function historicalMarkersMarkup(anchors,bounds={}){
  const {markers,policy}=historicalMarkerLayout(anchors,bounds);
  const markup=markers.map(marker=>{
    const {event,x,y,label,box,preview,active}=marker,color=EVENT_COLORS[event.category]||EVENT_COLORS.market;
    let content=box?historicalLabelMarkup(marker,box,label,color):'<circle cx="'+x+'" cy="'+y+'" r="10" fill="transparent"/>';
    content+=`<circle cx="${x}" cy="${y}" r="4" fill="#111b27" stroke="${color}" stroke-width="1.5"/>`;
    if(preview)content+=`<g class="history-event-preview" visibility="hidden" pointer-events="none" aria-hidden="true">${historicalLabelMarkup(marker,preview.box,preview.label,color)}</g>`;
    return `<g class="history-event-marker${box?' has-label':''}${active?' is-active':''}" data-history-event="${esc(event.id)}" role="button" tabindex="0" aria-label="${esc(`${event.date} ${event.title} · 사건 원문 보기`)}"><title>${esc(`${event.date} · ${event.title}\n클릭하면 원문과 날짜 근거를 봅니다.`)}</title>${content}</g>`;
  }).join('');
  const labelCount=markers.filter(marker=>marker.box).length;
  return {markup,markers,labelCount,totalCount:markers.length,hiddenLabelCount:markers.length-labelCount,labelMode:policy.mode,labelBudget:policy.budget};
}

/** Causal observations only: future days never acquire an observed timing color. */
export function cycleTimingMarkup({points=[],x,left,right,top,bottom,titleY=top-6,titleFontSize=10,dayWidth=1,split=null}){
  const splitX=split?x({date:split,epochDay:Date.parse(`${split}T00:00:00Z`)/86400000}):right;
  const observedRight=Number.isFinite(splitX)?Math.min(right,splitX):right;
  const valid=points.filter(point=>point.causal===true&&(!split||point.date<=split)&&Number.isFinite(point.shiftDays)&&Number.isFinite(x(point))&&x(point)>=left&&x(point)<=right);
  const segments=[];
  for(const point of valid){
    const previous=segments.at(-1),day=Number.isFinite(point.epochDay)?point.epochDay:Date.parse(`${point.date}T00:00:00Z`)/86400000;
    if(previous&&previous.state===point.state&&day===previous.lastDay+1){previous.end=point;previous.lastDay=day;previous.low=Math.min(previous.low,point.shiftDays);previous.high=Math.max(previous.high,point.shiftDays);}
    else segments.push({start:point,end:point,state:point.state,lastDay:day,low:point.shiftDays,high:point.shiftDays});
  }
  const colors={shortened:'#df7c83',aligned:'#65c3a5',lengthened:'#74a7ee',insufficient:'#8290a3'};
  const labels={shortened:'단축 가정',aligned:'기준 범위',lengthened:'연장 가정',insufficient:'근거 부족'};
  let markup=`<g class="cycle-timing-ribbon" data-cycle-observed-count="${valid.length}" role="img" aria-label="사이클 시계 · 관측 기반 보정 · 매매 신호 아님"><text x="${left}" y="${titleY}" fill="#a8b9ca" font-size="${titleFontSize}">사이클 시계 · 관측 보정</text>`;
  for(const segment of segments){const xx=x(segment.start),end=Math.min(observedRight,x(segment.end)+dayWidth),width=Math.max(0,end-xx),color=colors[segment.state]||colors.insufficient;markup+=`<rect x="${xx}" y="${top}" width="${width}" height="${Math.max(0,bottom-top)}" fill="${color}" data-cycle-state="${esc(segment.state)}" data-cycle-start="${segment.start.date}" data-cycle-end="${segment.end.date}"><title>${esc(`${segment.start.date}–${segment.end.date} UTC · ${labels[segment.state]||labels.insufficient} · 시계 이동 ${number(segment.low,1)}–${number(segment.high,1)}일. 각 날짜까지 확인된 자료로 계산한 보정이며 매매 신호·확률구간이 아닙니다.`)}</title></rect>`;}
  if(!valid.length)markup+=`<text x="${left+8}" y="${top+(bottom-top)*.75}" fill="#8290a3" font-size="${Math.min(10,bottom-top)}">이 구간에는 완료된 관측 보정이 없습니다.</text>`;
  markup+='</g>';return {markup,count:valid.length,segments};
}

/** Observed bars and conditional volume paths share BTC units, with distinct marks. */
export function volumePaneMarkup({bars,x,left,right,top,bottom,barWidth=3,source='거래소',clipId='volume-clip',futureX=null,projection=[],projectionLabel='점선 · 조건부 평균 거래량',volumeScale='auto',titleY=top-6,titleFontSize=10,separatorY=top-20}){
  const usable=[],projected=[],positions=new Map();let high=0,positiveLow=Infinity;
  for(const bar of bars){const xx=x(bar);if(!Number.isFinite(bar.volume)||bar.volume<0||!Number.isFinite(xx)||xx<left||xx>right)continue;usable.push(bar);positions.set(bar,xx);high=Math.max(high,bar.volume);if(bar.volume>0)positiveLow=Math.min(positiveLow,bar.volume);}
  for(const point of projection){const xx=x(point);if(point.kind!=='scenario'||!Number.isFinite(point.volume)||point.volume<=0||!Number.isFinite(point.lower)||point.lower<=0||!Number.isFinite(point.upper)||point.lower>point.volume||point.upper<point.volume||!Number.isFinite(xx)||xx<left||xx>right||(Number.isFinite(futureX)&&xx<=futureX))continue;projected.push(point);positions.set(point,xx);high=Math.max(high,point.upper);positiveLow=Math.min(positiveLow,point.lower);}
  const base=high?10**Math.floor(Math.log10(high)):1;
  const max=high?([1,2,5,10].find(factor=>factor*base>=high)||10)*base:1;
  const scale=volumeScale==='log'||(volumeScale==='auto'&&projected.length&&positiveLow<Infinity&&high/positiveLow>50)?'log':'linear';
  const dense=usable.length>Math.max(256,(right-left)/2);
  const y=value=>bottom-(scale==='log'?Math.log1p(value)/Math.log1p(max):value/max)*(bottom-top);
  const axisFontSize=Math.min(10,Math.max(1,(bottom-top)*.45)),messageY=top+(bottom-top)/2+axisFontSize*.3;
  let ticks=[0,max];
  if(scale==='log'&&bottom-top>=55){const candidates=[0];for(let power=1;10**power<max;power++)candidates.push(10**power);candidates.push(max);const count=Math.min(4,Math.max(2,Math.floor((bottom-top)/24)));ticks=[...new Set(Array.from({length:count},(_,i)=>candidates[Math.round(i*(candidates.length-1)/(count-1))]))];}
  let markup=`<defs><clipPath id="${esc(clipId)}"><rect x="${left}" y="${top}" width="${right-left}" height="${Math.max(0,bottom-top)}"/></clipPath><pattern id="${esc(clipId)}-scenario" width="7" height="7" patternUnits="userSpaceOnUse"><path d="M0 7L7 0" stroke="#dfb06d" stroke-width=".65" opacity=".22"/></pattern></defs><g class="volume-pane" data-volume-scale="${scale}" data-volume-observed-count="${usable.length}" data-volume-rendering="${dense?'batched':'individual'}" data-volume-projection-count="${projected.length}"><line x1="${left}" x2="${right}" y1="${separatorY}" y2="${separatorY}" stroke="#2c3949"/><text x="${left}" y="${titleY}" class="volume-pane-title" fill="#9fb2c7" font-size="${titleFontSize}">거래량 · BTC · ${esc(source)}${scale==='log'?' · 로그':''}<title>${scale==='log'?'실제 BTC 수량을 log(1 + 거래량) 축에 표시합니다. 0도 보존합니다.':'선형 BTC 수량 축입니다.'} 막대는 실제 거래량, 점선과 음영은 조건부 시나리오입니다.</title></text>`;
  for(const tick of ticks)markup+=`<text x="${right+7}" y="${Math.max(top+axisFontSize*.5,Math.min(bottom+axisFontSize*.3,y(tick)+axisFontSize*.3))}" fill="#91a5bc" font-size="${axisFontSize}">${high?formatBtcVolume(tick):tick===0?'0':'—'}</text>`;
  markup+=`<line x1="${left}" x2="${right}" y1="${bottom}" y2="${bottom}" stroke="#2a3645"/><g class="volume-bars" clip-path="url(#${esc(clipId)})">`;
  if(dense){
    // Every original rectangle is preserved as a path subshape. This reduces
    // thousands of DOM nodes to two paths without summing or averaging BTC.
    const paths=['',''];
    for(const bar of usable){const xx=positions.get(bar)-barWidth/2,yy=y(bar.volume),height=Math.max(0,bottom-yy),side=bar.close>=bar.open?0:1;paths[side]+=`M${xx.toFixed(2)},${yy.toFixed(2)}h${barWidth.toFixed(2)}v${height.toFixed(2)}h${(-barWidth).toFixed(2)}Z`;}
    for(let side=0;side<2;side++)if(paths[side])markup+=`<path class="volume-bars-batch" d="${paths[side]}" fill="${side?'#ab6374':'#498f80'}" opacity=".78"/>`;
    markup+=`<title>${usable.length}개 실제 거래량 막대 · 화면의 같은 가격 날짜에서 정확한 BTC 수량을 확인할 수 있습니다.</title>`;
  }else for(const bar of usable){
    const xx=positions.get(bar),yy=y(bar.volume),color=bar.close>=bar.open?'#498f80':'#ab6374';
    markup+=`<rect class="volume-bar" data-volume="${bar.volume}" data-time="${bar.time}" data-date="${esc(bar.date)}" x="${xx-barWidth/2}" y="${yy}" width="${barWidth}" height="${Math.max(0,bottom-yy)}" fill="${color}" opacity=".78"><title>${esc(`${bar.startDate||bar.date}${bar.endDate?'–'+bar.endDate:''} UTC · ${source} · ${number(bar.volume,8)} BTC`)}</title></rect>`;
  }
  markup+='</g>';
  if(projected.length){
    const pathPoints=pixelExtrema(projected,point=>positions.get(point),['volume','lower','upper']);
    const line=key=>pathPoints.map((point,index)=>`${index?'L':'M'}${positions.get(point).toFixed(2)},${y(point[key]).toFixed(2)}`).join('');
    const area=`${line('upper')}${[...pathPoints].reverse().map(point=>`L${positions.get(point).toFixed(2)},${y(point.lower).toFixed(2)}`).join('')}Z`;
    markup+=`<g class="volume-projection" clip-path="url(#${esc(clipId)})" aria-label="미래 거래량 조건부 시나리오 · 확률구간 아님"><path class="volume-scenario-range" d="${area}" fill="#dfb06d" opacity=".08"/><path d="${area}" fill="url(#${esc(clipId)}-scenario)"/><path class="volume-scenario-line" d="${line('volume')}" fill="none" stroke="#e4b66f" stroke-width="1.6" stroke-dasharray="4 3"/><title>실제 체결이 아닌 장기 평균 거래량 시나리오입니다. 음영은 가정 민감도 범위이며 확률 예측구간이 아닙니다.</title></g>`;
    const captionX=Math.max(left+8,Number.isFinite(futureX)?futureX+8:left+8);
    if(right-captionX>185)markup+=`<text class="volume-projection-caption" x="${captionX}" y="${top+axisFontSize+2}" fill="#d1ae79" font-size="${axisFontSize}">${esc(projectionLabel)}</text>`;
  }
  if(!usable.length&&!projected.length)markup+=`<text x="${left+12}" y="${messageY}" fill="#7e94ac" font-size="${axisFontSize}">이 구간에는 검증된 거래량 자료가 없습니다.</text>`;
  markup+='</g>';
  return {markup,count:usable.length,projectedCount:projected.length,rendering:dense?'batched':'individual',scale,max,y};
}
