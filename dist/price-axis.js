const axisEscape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const axisNumberFormats=new Map();
const axisNumber=(value,digits)=>{if(!axisNumberFormats.has(digits))axisNumberFormats.set(digits,new Intl.NumberFormat('en-US',{maximumFractionDigits:digits}));return axisNumberFormats.get(digits).format(value);};

/** Measure the font that the SVG actually uses, in its own viewBox units.
 * The fallback is for detached/test renderers; a live browser uses SVG glyph
 * metrics. Explicit font attributes and textLength survive SVG/PNG export. */
function priceAxisTextMetrics(svg){
  const doc=svg?.ownerDocument,view=doc?.defaultView;
  let inherited=null;try{inherited=view?.getComputedStyle?.(svg);}catch{}
  const font={family:inherited?.fontFamily||'Arial,"Noto Sans KR",sans-serif',weight:inherited?.fontWeight||'400',style:inherited?.fontStyle||'normal',spacing:Number.parseFloat(inherited?.letterSpacing)||0};
  const cache=new Map();let probe=null;
  try{if(doc?.createElementNS&&svg?.appendChild){probe=doc.createElementNS('http://www.w3.org/2000/svg','text');for(const [name,value] of Object.entries({'font-family':font.family,'font-weight':font.weight,'font-style':font.style,'font-variant-numeric':'tabular-nums','letter-spacing':font.spacing,x:0,y:0,visibility:'hidden','pointer-events':'none','aria-hidden':'true'}))probe.setAttribute(name,value);}}catch{}
  function measure(text,size){
    text=String(text);const key=`${size}:${text}`;if(cache.has(key))return cache.get(key);
    let width=0;
    if(probe){
      try{probe.setAttribute('font-size',size);probe.textContent=text;svg.appendChild(probe);const advance=probe.getComputedTextLength?.(),box=probe.getBBox?.();width=Math.max(Number.isFinite(advance)?advance:0,box&&Number.isFinite(box.width)?box.x+box.width:0)-Math.min(0,box?.x||0);}catch{}
      finally{try{if(probe.parentNode)probe.parentNode.removeChild(probe);}catch{}}
    }
    if(!(width>0)&&text){
      // Conservatively bound numeric text where layout APIs are unavailable.
      width=[...text].reduce((sum,char)=>sum+(/[., ]/.test(char)?.34:/[-+]/.test(char)?.55:char==='%'?.9:.68)*size,0)+Math.max(0,text.length-1)*font.spacing;
    }
    width=Math.max(0,width);if(cache.size>256)cache.clear();cache.set(key,width);return width;
  }
  return {font,measure};
}

/** A price-independent gutter prevents a pan/hover from moving its own X axis.
 * Reserve a normal six-digit USD quote plus sign and cents using actual font
 * metrics. Unusually large/small values adapt inside this same stable gutter. */
export function createPriceAxisLayout({svg,width,left=8,minRight=66,fontSize=width<600?11:12,badgeFontSize=width<600?10:11}){
  const metrics=priceAxisTextMetrics(svg),inset=7,edge=7;
  const limit=Math.max(1,Math.min(128,width*.35,width-left-48));
  const right=Math.min(limit,Math.max(minRight,Math.ceil(metrics.measure('$-999,999.99',fontSize)+inset+edge+2)));
  const labelWidth=Math.max(1,right-inset-edge),{font}=metrics;
  const common={'font-family':font.family,'font-weight':font.weight,'font-style':font.style,'font-variant-numeric':'tabular-nums','letter-spacing':font.spacing,lengthAdjust:'spacingAndGlyphs'};
  function textAttributes(label,{badge=false,kind=badge?'badge':'tick'}={}){
    const length=Math.min(labelWidth,Math.max(.01,metrics.measure(label,badge?badgeFontSize:fontSize)));
    return {...common,'data-price-axis-label':kind,textLength:Number(length.toFixed(3))};
  }
  return {right,inset,edge,labelWidth,fontSize,badgeFontSize,measure:metrics.measure,
    attributes(label,options){return Object.entries(textAttributes(label,options)).map(([name,value])=>`${name}="${axisEscape(value)}"`).join(' ');},
    fitNode(node,options={}){if(!node)return;for(const [name,value] of Object.entries(textAttributes(node.textContent,options)))node.setAttribute(name,value);node.setAttribute('font-size',options.badge?badgeFontSize:fontSize);},
  };
}

/** Axis labels may use scientific notation, but never truncate a number or
 * replace a nonzero tiny price by zero. Source values/readouts stay untouched. */
export function createPriceAxisFormatter({axis,display,layout}){
  const shown=value=>display?.toDisplay?display.toDisplay(value):display?.available===false?null:value*(display?.factor??1)+(display?.offset??0);
  const values=(axis?.ticks||[]).map(shown).filter(Number.isFinite).sort((a,b)=>a-b);
  const gaps=values.slice(1).map((value,index)=>value-values[index]).filter(value=>value>0);
  const gap=gaps.length?Math.min(...gaps):Math.abs((axis?.max-axis?.min)*(display?.factor??1));
  const tickDigits=Math.max(0,Math.min(12,Number.isFinite(gap)&&gap>0?1-Math.floor(Math.log10(gap)):2));
  const wrap=text=>`${display?.unit==='usd'?'$':''}${text}${display?.unit==='percent'?'%':''}`;
  function format(raw,badge){
    const value=shown(raw);if(!Number.isFinite(value))return '—';
    const abs=Math.abs(value),digits=Math.min(12,Math.max(tickDigits,badge?(abs>0&&abs<1?6:2):0));
    const fixed=wrap(axisNumber(value,digits)),size=badge?layout.badgeFontSize:layout.fontSize;
    if((value===0||Number(axisNumber(value,digits).replaceAll(',',''))!==0)&&layout.measure(fixed,size)<=layout.labelWidth)return fixed;
    // Keep adjacent ticks distinguishable even in a very tight manual range.
    const significant=badge?8:Math.max(3,Math.min(16,Number.isFinite(gap)&&gap>0&&abs>0?Math.floor(Math.log10(abs))-Math.floor(Math.log10(gap))+3:6));
    const scientific=wrap(value.toExponential(significant-1).replace(/(\.\d*?[1-9])0+e/,'$1e').replace(/\.0+e/,'e').replace('e+','e'));
    return layout.measure(scientific,size)<layout.measure(fixed,size)||Number(axisNumber(value,digits).replaceAll(',',''))===0?scientific:fixed;
  }
  return {tick:value=>format(value,false),price:value=>format(value,true),tickDigits};
}

// Price viewports are always expressed in the original USD coordinates.
// Indexed labels are a display concern and never change this domain.
export function normalizePriceDomain(domain, { scale = 'log' } = {}) {
  if (!domain || !['log', 'linear'].includes(scale)) return null;
  const { min, max } = domain;
  if (![min, max].every(Number.isFinite) || max <= min || (scale === 'log' && min <= 0)) return null;
  // Leave numeric headroom for unit factors and reject domains whose transform
  // collapses to a single floating-point value. These are display limits only.
  if ([min,max].some(value => value !== 0 && (Math.abs(value) < 1e-300 || Math.abs(value) > 1e300))) return null;
  const low=scale==='log'?Math.log(min):min,high=scale==='log'?Math.log(max):max,span=high-low;
  if(!Number.isFinite(span)||span<=Number.EPSILON*Math.max(Math.abs(low),Math.abs(high),Number.MIN_VALUE)*8)return null;
  return { min, max };
}

/** Scale about a price-axis anchor, using ratios for log and distances for linear. */
export function scalePriceDomain(axis, factor, anchor = .5) {
  const domain = normalizePriceDomain(axis, { scale: axis?.scale });
  if (!domain || !Number.isFinite(factor) || factor <= 0 || !Number.isFinite(anchor)) return null;
  const transform = axis.scale === 'log' ? Math.log : value => value;
  const reverse = axis.scale === 'log' ? Math.exp : value => value;
  const low = transform(domain.min), high = transform(domain.max);
  const fraction = Math.max(0, Math.min(1, anchor)), pivot = low + (high - low) * fraction;
  const minimum = axis.scale === 'log' ? 1e-6 : Math.max(1, Math.abs(pivot)) * 1e-8;
  const span = Math.max(minimum, (high - low) * Math.max(.05, Math.min(20, factor)));
  let first = pivot - span * fraction, last = pivot + span * (1 - fraction);
  if (axis.scale === 'linear' && domain.min >= 0 && first < 0) { last -= first; first = 0; }
  const result = { min: reverse(first), max: reverse(last) };
  return normalizePriceDomain(result, { scale: axis.scale });
}

/** Translate a viewport with a drag; empty linear price space is permitted. */
export function panPriceDomain(axis, fraction) {
  const domain = normalizePriceDomain(axis, { scale: axis?.scale });
  if (!domain || !Number.isFinite(fraction)) return null;
  const transform = axis.scale === 'log' ? Math.log : value => value;
  const reverse = axis.scale === 'log' ? Math.exp : value => value;
  const low = transform(domain.min), high = transform(domain.max), shift = (high - low) * fraction * (axis.inverted ? -1 : 1);
  const result = { min: reverse(low + shift), max: reverse(high + shift) };
  return normalizePriceDomain(result, { scale: axis.scale });
}

/** A narrow axis-only hit surface; no overlay receives price-plot gestures. */
export function priceAxisMarkup({ left, right, top, bottom }) {
  if (![left, right, top, bottom].every(Number.isFinite) || right <= left || bottom <= top) return '';
  return `<g class="price-axis-interaction" data-price-axis="true"><title>가격축 · 위아래로 드래그하여 확대·축소 · 두 번 눌러 자동 맞춤</title><rect x="${left}" y="${top}" width="${right - left}" height="${bottom - top}" fill="transparent" pointer-events="all" style="cursor:ns-resize;touch-action:none"/></g>`;
}

export function timeAxisMarkup({ left, right, top, bottom }) {
  if (![left,right,top,bottom].every(Number.isFinite) || right <= left || bottom <= top) return '';
  return `<g class="time-axis-interaction" data-time-axis="true"><title>시간축 · 좌우 드래그하여 시간 간격 확대·축소 · 두 번 눌러 기본 범위</title><rect x="${left}" y="${top}" width="${right-left}" height="${bottom-top}" fill="transparent" pointer-events="all" style="cursor:ew-resize;touch-action:none"/></g>`;
}
