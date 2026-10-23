/** A legend identifies geometry and provenance; it is never a live-price quote. */
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const samples={
  line:'<path d="M1 6h16" stroke="#e2eaf3" stroke-width="2"/>',
  candles:'<path d="M5 1v10" stroke="#62bca5"/><rect x="3" y="3" width="4" height="5" fill="#62bca5"/><path d="M13 2v9" stroke="#cf7f89"/><rect x="11" y="5" width="4" height="4" fill="#cf7f89"/>',
  future:'<path d="M1 6h16" stroke="#f2b960" stroke-width="2" stroke-dasharray="4 3"/>',
  band:'<rect x="1" y="2" width="16" height="8" fill="#f2aa4c25" stroke="#b58748"/>',
  turns:'<ellipse cx="9" cy="6" rx="5" ry="3" fill="none" stroke="#f2b960"/>',
};
const item=(kind,label,title)=>`<span class="price-legend-item" title="${esc(title)}"><svg class="price-legend-swatch" width="18" height="12" viewBox="0 0 18 12" aria-hidden="true" focusable="false" fill="none">${samples[kind]}</svg><span>${label}</span></span>`;

export function priceLegendMarkup({candles=false,source='Coin Metrics',observed=true,mixedLine=false,forecast=false,band=false,turns=false}={}){
  const label=candles?'관측 캔들':'관측 가격선';
  const meaning=candles?`${source}의 완료된 OHLC 봉입니다. 실시간 현재가 표시는 아닙니다.`:`${source}의 관측 종가를 이은 선입니다. 실시간 현재가 표시는 아닙니다.`;
  return '<div class="price-legend" role="group" aria-label="가격 표시 범례">'+(observed?item(candles?'candles':'line',label,meaning):'')
    +(observed&&candles&&mixedLine?item('line','관측 가격선','완료된 거래소 봉이 없는 구간은 Coin Metrics의 실제 일말 가격선입니다. 진행 중인 봉을 만들지 않습니다.'):'')
    +(forecast?item('future','미래 가정','관측 이후의 조건부 가격 경로입니다. 실제 거래 가격이 아닙니다.'):'')
    +(forecast&&band?item('band','가정 범위','경제 가정에 따른 범위이며 통계적 확률구간이 아닙니다.'):'')
    +(turns?item('turns','고점·저점','관측 전환점과 미래 가정의 방향 후보입니다.'):'')+'</div>';
}

/** Completed candle coverage can end before the daily observation cutoff. */
export function observedPriceSourceLabel({candleCount=0,lineCount=0,candleSource='Bitstamp',candleEndDate,asOf,frequency='daily'}={}){
  const parts=[];
  if(candleCount>0)parts.push(`${candleSource} · 완료 ${frequency==='weekly'?'주봉':'일봉'} ${candleEndDate||'—'} UTC`);
  if(lineCount>0||candleCount===0)parts.push(`Coin Metrics · 일말 ${asOf||'—'} UTC`);
  return parts.join(' · ');
}

export function priceReadoutKind(detail={}){
  if(detail.kind==='unavailable')return '자료 없음';
  if(detail.kind==='simulated')return '가정';
  return Number.isFinite(detail.open)?'봉 종가':'관측 종가';
}
