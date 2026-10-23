const NS='http://www.w3.org/2000/svg';

/** Export original observations in the visible window, never sampled pixels or model paths. */
export function createObservedChartCsv({rows=[],candles=null,range,frequency='daily',asOf,source='Coin Metrics'}={}) {
  if(!range||range.end<range.start)throw new RangeError('저장할 표시 범위가 없습니다.');
  const numeric=typeof range.start==='number';
  const selected=candles?candles.filter(row=>{const key=numeric?row.time:row.date;return key>=range.start&&key<=range.end&&(numeric||!asOf||row.date<=asOf);})
    :rows.filter(row=>row.date>=range.start&&row.date<=range.end&&(!asOf||row.date<=asOf));
  if(!selected.length)throw new RangeError('현재 범위에 저장할 실제 관측값이 없습니다.');
  const cell=value=>{if(value==null)return '';let text=String(value);if(typeof value==='string'&&/^[=+@\-\t\r]/u.test(text))text="'"+text;return /[",\r\n]/u.test(text)?`"${text.replaceAll('"','""')}"`:text;};
  const lines=[['chart_date_utc','candle_open_utc','interval','source','currency','open','high','low','close','volume_btc','kind']];
  for(const row of selected){
    const price=candles?row.close:row.price;if(!Number.isFinite(price)||price<=0)throw new RangeError('유효하지 않은 관측 가격입니다.');
    const opened=candles&&Number.isSafeInteger(row.time)?new Date(row.time*1000).toISOString():'';
    const record=candles?[row.date,opened,frequency,source,'USD',row.open,row.high,row.low,row.close,row.volume,'observed']:[row.date,'','daily',source,'USD',null,null,null,row.price,null,'observed'];
    lines.push(record);
  }
  return '\uFEFF'+lines.map(line=>line.map(cell).join(',')).join('\r\n')+'\r\n';
}

/** Conservative text wrapping keeps vector exports legible at phone widths. */
export function wrapExportText(text,width,fontSize=11){
  const limit=Math.max(5,width/fontSize),lines=[];let line='',units=0;
  for(const char of String(text??'').replace(/\s+/gu,' ').trim()){
    const size=/[\u1100-\u11ff\u2e80-\ua4cf\uac00-\ud7af\uff00-\uffef]/u.test(char)?1:.62;
    if(units+size>limit&&line){lines.push(line.trim());line='';units=0;}
    line+=char;units+=size;
  }
  if(line.trim())lines.push(line.trim());return lines;
}

export function createChartSvgExport(svg,{title='BTCUSD',readout='',source='',note='',countdown='',panels=[],legend=[]}={}){
  if(!svg)throw new TypeError('저장할 차트가 없습니다.');
  const box=(svg.getAttribute('viewBox')||'').trim().split(/[\s,]+/u).map(Number);
  const width=box.length===4?box[2]:svg.clientWidth,height=box.length===4?box[3]:svg.clientHeight;
  if(!(width>0&&height>0))throw new RangeError('표시 중인 차트만 저장할 수 있습니다.');
  const doc=svg.ownerDocument,make=(tag,attrs={},text)=>{const node=doc.createElementNS(NS,tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,String(value));if(text!==undefined)node.textContent=text;return node;};
  const readableWidth=Math.max(80,width-28),head=[...wrapExportText(title,readableWidth,14).map(text=>({text,size:14,color:'#dce8f7'})),...wrapExportText(readout,readableWidth,11).map(text=>({text,size:11,color:'#b5cce6'}))];
  if(countdown)head.push(...wrapExportText(countdown,readableWidth,10).map(text=>({text,size:10,color:'#94b4d9'})));
  const foot=[...wrapExportText(source,readableWidth,10),...wrapExportText(note,readableWidth,10)];
  const extra=panels.filter(Boolean).map(panel=>{
    const viewBox=(panel.getAttribute('viewBox')||'').trim().split(/[\s,]+/u).map(Number);
    if(viewBox.length!==4||!viewBox.every(Number.isFinite)||viewBox[2]<=0||viewBox[3]<=0)throw new RangeError('추가 차트의 크기가 올바르지 않습니다.');
    return {panel,height:viewBox[3]*width/viewBox[2]};
  });
  const legendItems=legend.filter(item=>item?.label&&/^#[0-9a-f]{6}$/i.test(item.color||''));
  const legendColumns=Math.max(1,Math.min(6,Math.floor(readableWidth/132))),legendHeight=legendItems.length?Math.ceil(legendItems.length/legendColumns)*24+12:0;
  const chartHeight=height+extra.reduce((sum,item)=>sum+item.height+8,0);
  const top=18+head.reduce((sum,line)=>sum+line.size+5,0),bottom=18+foot.length*15,total=top+chartHeight+legendHeight+bottom;
  const root=make('svg',{xmlns:NS,width:Math.round(width),height:Math.round(total),viewBox:`0 0 ${width} ${total}`,role:'img','aria-label':title});
  root.setAttribute('style','background:#10151c;font-family:Arial,"Noto Sans KR",sans-serif;font-variant-numeric:tabular-nums');
  root.append(make('title',{},title),make('desc',{},[readout,countdown,source,note].filter(Boolean).join(' · ')),make('rect',{width:'100%',height:'100%',fill:'#10151c'}));
  let yy=17;for(const line of head){yy+=line.size;root.append(make('text',{x:14,y:yy,fill:line.color,'font-size':line.size},line.text));yy+=5;}
  function copyChart(sourceChart,y,chartHeight){
    const clone=sourceChart.cloneNode(true);clone.removeAttribute('id');clone.removeAttribute('class');clone.removeAttribute('hidden');clone.removeAttribute('tabindex');clone.setAttribute('x','0');clone.setAttribute('y',String(y));clone.setAttribute('width',String(width));clone.setAttribute('height',String(chartHeight));
    clone.removeAttribute('style');
    for(const node of clone.querySelectorAll('[id$="-cross"],.history-event-preview,.cycle-marker-preview,.chart-magnet-preview,.chart-snap-feedback,.chart-measurement[data-pending="true"],script,foreignObject'))node.remove();
    for(const node of [clone,...clone.querySelectorAll('*')]){
      node.removeAttribute('tabindex');node.removeAttribute('role');
      for(const attr of [...node.attributes])if(attr.name.startsWith('on'))node.removeAttribute(attr.name);
    }
    root.append(clone);
  }
  copyChart(svg,top,height);
  let chartY=top+height;
  for(const item of extra){chartY+=8;copyChart(item.panel,chartY,item.height);chartY+=item.height;}
  for(let i=0;i<legendItems.length;i++){
    const item=legendItems[i],column=i%legendColumns,row=Math.floor(i/legendColumns),xx=20+column*(readableWidth/legendColumns),ly=chartY+18+row*24;
    root.append(make('circle',{cx:xx,cy:ly,r:5.5,fill:item.color,'fill-opacity':.17,stroke:item.color,'stroke-width':1.5}),make('text',{x:xx+12,y:ly+4,fill:item.color,'font-size':10},item.label));
  }
  root.append(make('line',{x1:14,x2:width-14,y1:top+chartHeight+legendHeight+1,y2:top+chartHeight+legendHeight+1,stroke:'#2b3c50'}));
  yy=top+chartHeight+legendHeight+17;for(const text of foot){root.append(make('text',{x:14,y:yy,fill:'#91a9c3','font-size':10},text));yy+=15;}
  const Serializer=doc.defaultView?.XMLSerializer||XMLSerializer;
  return '<?xml version="1.0" encoding="UTF-8"?>\n'+new Serializer().serializeToString(root);
}
