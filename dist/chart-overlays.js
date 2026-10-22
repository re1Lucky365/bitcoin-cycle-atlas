/** Pure layout helpers shared by the daily and intraday chart renderers. */
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=(value,digits=2)=>new Intl.NumberFormat('en-US',{maximumFractionDigits:digits}).format(value);
export const EVENT_COLORS=Object.freeze({protocol:'#d8b779',regulation:'#aeb9ed',adoption:'#79c6b6',institution:'#84bce5',security:'#d3a5c5',market:'#b6c2d3',macro:'#c5b08b'});

export function formatBtcVolume(value){
  if(!Number.isFinite(value)||value<0)return '—';
  return value>=1e6?`${number(value/1e6)}M`:value>=1e3?`${number(value/1e3)}k`:number(value,value<1?6:2);
}

export function chartPaneLayout({width,height,volume=true,drawdown=false,states=false,top=66}){
  const small=width<600,short=height<360,left=Math.min(small?8:12,width*.05),right=Math.min(small?66:82,width*.25);
  const axisY=height-Math.min(small?29:22,height*.15),bottom=axisY-Math.min(24,height*.12);
  // Explicitly requested secondary panes stay present. Reduce their heights and
  // title gaps together when the viewport cannot hold their preferred sizes.
  top=Math.min(top,bottom*.55);
  const available=bottom-top;
  const volumeHeight=volume?Math.min(112,Math.max(short?38:58,height*.18)):0;
  const stateHeight=states?(short?8:10):0,ddHeight=drawdown?Math.min(70,Math.max(28,height*.12)):0;
  const desiredVolumeGap=volume?(drawdown||states?24:26):0,desiredStateGap=states?(drawdown?14:18):0,desiredDdGap=drawdown?23:0;
  const desiredSecondary=volumeHeight+stateHeight+ddHeight+desiredVolumeGap+desiredStateGap+desiredDdGap;
  const priceReserve=Math.min(96,available*.35),paneScale=desiredSecondary?Math.min(1,(available-priceReserve)/desiredSecondary):1;
  const volumeGap=desiredVolumeGap*paneScale,stateGap=desiredStateGap*paneScale,ddGap=desiredDdGap*paneScale;
  let cursor=bottom;
  const volumeBottom=cursor,volumeTop=cursor-volumeHeight*paneScale;if(volume)cursor=volumeTop-volumeGap;
  const stateBottom=cursor,stateTop=cursor-stateHeight*paneScale;if(states)cursor=stateTop-stateGap;
  const ddBottom=cursor,ddTop=cursor-ddHeight*paneScale;if(drawdown)cursor=ddTop-ddGap;
  const priceBottom=cursor;
  return {left,right,top,axisY,bottom,priceBottom,volumeTop,volumeBottom,ddTop,ddBottom,stateTop,stateBottom,paneScale,
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

/** Priority affects legibility only; it is not a measure of impact or causation. */
export function layoutHistoricalMarkers(anchors,{left,right,top,bottom,maxLabels=18}={}){
  const boxes=[],placed=new Map();
  const valid=anchors.filter(a=>Number.isFinite(a.x)&&Number.isFinite(a.y)&&a.x>=left&&a.x<=right&&a.y>=top&&a.y<=bottom);
  const ranked=[...valid].sort((a,b)=>(b.event.importance||1)-(a.event.importance||1)||a.event.date.localeCompare(b.event.date));
  for(const anchor of ranked){
    const event=anchor.event,fullLabel=String(event.label||event.title),availableWidth=Math.max(0,right-left-4),width=Math.min(Math.max(58,labelWidth(fullLabel)+18),availableWidth),height=22;
    const label=fitLabel(fullLabel,Math.max(0,width-18));
    let box=null;
    if(boxes.length<maxLabels&&availableWidth>=58){
      const preferred=anchor.y>(top+bottom)/2?-1:1;
      for(const offset of [30,58,86,114,142]){
        for(const side of [preferred,-preferred]){
          const yy=anchor.y+side*offset-(side<0?height:0);
          if(yy<top+2||yy+height>bottom-3)continue;
          for(const shift of [0,-width*.35,width*.35]){
            const xx=Math.max(left+2,Math.min(right-width-2,anchor.x-width/2+shift));
            const candidate={x:xx,y:yy,width,height};
            if(!boxes.some(other=>overlaps(candidate,other))){box=candidate;break;}
          }
          if(box)break;
        }
        if(box)break;
      }
    }
    if(box)boxes.push(box);
    placed.set(event.id,{...anchor,label,box});
  }
  return valid.map(anchor=>placed.get(anchor.event.id));
}

export function historicalMarkersMarkup(anchors,bounds){
  const markers=layoutHistoricalMarkers(anchors,bounds);
  const markup=markers.map(({event,x,y,label,box})=>{
    const color=EVENT_COLORS[event.category]||EVENT_COLORS.market;
    let content=`<circle cx="${x}" cy="${y}" r="4" fill="#111b27" stroke="${color}" stroke-width="1.5"/>`;
    if(box){
      const edgeY=box.y>y?box.y:box.y+box.height,edgeX=Math.max(box.x+7,Math.min(box.x+box.width-7,x));
      content=`<path d="M${x},${y}L${edgeX},${edgeY}" fill="none" stroke="${color}" stroke-width=".8" opacity=".7"/>${content}<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="4" fill="#142131" fill-opacity=".96" stroke="${color}" stroke-opacity=".65"/><text x="${box.x+box.width/2}" y="${box.y+15}" text-anchor="middle" fill="${color}" font-size="10">${esc(label)}</text>`;
    }else content+=`<circle cx="${x}" cy="${y}" r="10" fill="transparent"/>`;
    return `<g class="history-event-marker${box?' has-label':''}" data-history-event="${esc(event.id)}" role="button" tabindex="0" aria-label="${esc(`${event.date} ${event.title} · 사건 원문 보기`)}"><title>${esc(`${event.date} · ${event.title}\n클릭하면 원문과 날짜 근거를 봅니다.`)}</title>${content}</g>`;
  }).join('');
  return {markup,markers,labelCount:markers.filter(marker=>marker.box).length,totalCount:markers.length};
}

/** Render reported base BTC volume. Missing periods and future values stay blank. */
export function volumePaneMarkup({bars,x,left,right,top,bottom,barWidth=3,source='거래소',clipId='volume-clip',futureX=null,titleY=top-6,titleFontSize=10,separatorY=top-20}){
  const usable=bars.filter(bar=>Number.isFinite(bar.volume)&&bar.volume>=0&&Number.isFinite(x(bar))&&x(bar)>=left&&x(bar)<=right);
  const high=Math.max(0,...usable.map(bar=>bar.volume));
  const base=high?10**Math.floor(Math.log10(high)):1;
  const max=high?([1,2,5,10].find(factor=>factor*base>=high)||10)*base:1;
  const y=value=>bottom-value/max*(bottom-top);
  const axisFontSize=Math.min(10,Math.max(1,(bottom-top)*.45)),messageY=top+(bottom-top)/2+axisFontSize*.3;
  let markup=`<defs><clipPath id="${esc(clipId)}"><rect x="${left}" y="${top}" width="${right-left}" height="${Math.max(0,bottom-top)}"/></clipPath></defs><line x1="${left}" x2="${right}" y1="${separatorY}" y2="${separatorY}" stroke="#2c3949"/><text x="${left}" y="${titleY}" class="volume-pane-title" fill="#9fb2c7" font-size="${titleFontSize}">거래량 · BTC · ${esc(source)}</text><text x="${right+7}" y="${top+axisFontSize*.5}" fill="#91a5bc" font-size="${axisFontSize}">${high?formatBtcVolume(max):'—'}</text><text x="${right+7}" y="${bottom+axisFontSize*.3}" fill="#91a5bc" font-size="${axisFontSize}">0</text><line x1="${left}" x2="${right}" y1="${bottom}" y2="${bottom}" stroke="#2a3645"/><g class="volume-bars" clip-path="url(#${esc(clipId)})">`;
  for(const bar of usable){
    const xx=x(bar),yy=y(bar.volume),color=bar.close>=bar.open?'#498f80':'#ab6374';
    markup+=`<rect class="volume-bar" data-volume="${bar.volume}" data-time="${bar.time}" data-date="${esc(bar.date)}" x="${xx-barWidth/2}" y="${yy}" width="${barWidth}" height="${Math.max(0,bottom-yy)}" fill="${color}" opacity=".78"><title>${esc(`${bar.startDate||bar.date}${bar.endDate?'–'+bar.endDate:''} UTC · ${source} · ${number(bar.volume,8)} BTC`)}</title></rect>`;
  }
  markup+='</g>';
  if(!usable.length)markup+=`<text x="${left+12}" y="${messageY}" fill="#7e94ac" font-size="${axisFontSize}">이 구간에는 검증된 거래량 자료가 없습니다.</text>`;
  else if(Number.isFinite(futureX)&&right-futureX>220)markup+=`<text x="${futureX+(right-futureX)/2}" y="${messageY}" text-anchor="middle" fill="#677d96" font-size="${axisFontSize}">미래 거래량은 추정하지 않습니다</text>`;
  return {markup,count:usable.length,max,y};
}
