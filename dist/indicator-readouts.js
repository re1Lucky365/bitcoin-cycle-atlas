import {formatBtcVolume} from './chart-overlays.js?v=1.10.3';

const formatters=new Map();
const number=(value,digits=2)=>{if(!formatters.has(digits))formatters.set(digits,new Intl.NumberFormat('en-US',{maximumFractionDigits:digits}));return formatters.get(digits).format(value);};
const finite=Number.isFinite;
const money=value=>finite(value)?`$${number(value,value<1?6:2)}`:'—';
const percent=value=>finite(value)?`${value>0?'+':value<0?'−':''}${number(Math.abs(value),2)}%`:'—';
const date=value=>typeof value==='string'?value.slice(0,16).replace('T',' ').replaceAll('-','.'):'';
const output=(value,title=value,tone='neutral')=>({value,title,tone});
const missing=(reason='선택한 날짜에 자료 없음')=>output(reason,reason,'muted');
const periodLabels={returnPct:'기간 수익률',maxDrawdownPct:'기간 중 최대 하락',realizedVolPct:'가격 흔들림 · 연간 환산',discoveryDays:'새 최고가를 기록한 날'};

/** One small value per added indicator. No financial model runs in this path. */
export function indicatorReadout(item,{selection=null,workbench={},cycle=null,analyses=new Map()}={}) {
  const id=typeof item==='string'?item:item.id;
  const dailyOnly=typeof item==='object'&&item.dailyOnly;
  if(dailyOnly&&workbench.intraday)return missing('1D · 1W에서 표시');
  const selected=selection||{},future=selected.kind==='simulated';
  const when=selected.date?`${date(selected.date)} UTC`:'';
  const context=when?`${when}${future?' · 조건부 가정':selected.kind==='unavailable'?' · 자료 없음':' · 관측'}`:'자료를 불러오는 중';
  switch(id){
    case 'readout': {
      if(!finite(selected.price))return missing(selected.kind==='unavailable'?'선택 범위에 가격 없음':'가격 자료 대기');
      const value=selected.unit==='indexed'&&finite(selected.displayedPrice)?`${number(selected.displayedPrice)} · 지수`:money(selected.price);
      const ohlc=finite(selected.open)?`O ${money(selected.open)} · H ${money(selected.high)} · L ${money(selected.low)} · C ${money(selected.close)}`:'';
      return output(`${future?'가정 ':''}${value}${finite(selected.changePct)?`  ${percent(selected.changePct)}`:''}`,[context,ohlc,finite(selected.changePct)?`${finite(selected.open)?'시가':'직전 관측'} 대비 ${percent(selected.changePct)}`:''].filter(Boolean).join(' · '),future?'scenario':selected.changePct>0?'up':selected.changePct<0?'down':'neutral');
    }
    case 'volume': {
      if(!finite(selected.volume)||selected.volume<0)return missing(workbench.marketLoading?'Vol 불러오는 중':'Vol 자료 없음');
      const projected=selected.volumeKind==='scenario',unit=projected?`BTC/${selected.frequency==='weekly'?'주':'일'}`:'BTC';
      const range=projected&&finite(selected.volumeLower)&&finite(selected.volumeUpper)?` · 가정 범위 ${formatBtcVolume(selected.volumeLower)}–${formatBtcVolume(selected.volumeUpper)} ${unit}`:'';
      return output(`Vol${projected?' 가정':''} ${formatBtcVolume(selected.volume)} ${unit}`,`${context} · ${selected.volumeSource||selected.source||'거래소'} · ${number(selected.volume,6)} ${unit}${range}${projected?' · 실체결량이나 확률구간이 아닙니다.':' · 이 현물쌍의 거래량입니다.'}`,projected?'scenario':'neutral');
    }
    case 'source': {
      if(!selected.date)return missing(workbench.marketLoading?'자료 불러오는 중':'출처 확인 중');
      const priceSource=future?'가격 모형':selected.source||(workbench.intraday?workbench.marketSeries?.source:'Coin Metrics');
      const volumeSource=selected.volumeSource||null;
      const value=[priceSource,volumeSource&&volumeSource!==priceSource?`Vol ${volumeSource}`:null].filter(Boolean).join(' · ');
      return output(value||'출처 확인 중',[context,workbench.marketStatus,selected.product].filter(Boolean).join(' · '),future?'scenario':'neutral');
    }
    case 'legend':
      return output(workbench.intraday?'실제 완료 봉':`${workbench.chartType==='candles'?'실제 캔들':'관측 실선'} · 가정 점선`,workbench.intraday?'실제로 완료된 거래소 OHLCV만 표시합니다.':'실제 관측과 미래 조건부 가정을 구분합니다. 음영은 가정 범위이며 확률구간이 아닙니다.');
    case 'countdown': {
      const c=workbench.countdown;
      if(!c)return missing('다음 국면 계산 중');
      if(c.status==='upcoming')return output(`${c.dday} · ${c.nextLabel} 가정`,`${c.today} 한국 날짜 기준 · ${date(c.date)} 시작 후보 · ${c.minimumRunDays||7}일 유지 조건 · ${c.note||''}`,'scenario');
      return missing(c.status==='maintained'?'다음 지속 후보 없음':'다음 후보 계산 불가');
    }
    case 'history': {
      const meta=workbench.historicalLabelMeta;
      if(!meta)return missing('사건 자료 대기');
      return output(`${number(meta.total||0,0)}개 사건 · 이름 ${number(meta.labels||0,0)}개`,`현재 보이는 기간의 사건 ${number(meta.total||0,0)}개 중 ${number(meta.labels||0,0)}개 이름을 표시합니다. 확대 수준에 따라 이름 수가 바뀝니다.`);
    }
    case 'range':
      return future&&finite(selected.lower)&&finite(selected.upper)?output(`${money(selected.lower)}–${money(selected.upper)}`,`${context} · 수요·채택 가정 범위 · 확률구간이 아닙니다.`,'scenario'):missing(selected.date?'미래 구간의 가정 범위':'범위 자료 대기');
    case 'turns': {
      const turn=selected.turn||workbench.next;
      if(!turn)return missing('선택일의 확인된 전환점 없음');
      if(turn===selected.turn&&turn.confirmationDate&&selected.date&&turn.confirmationDate>selected.date)return missing('이 날짜에는 전환점 확인 전');
      const turnDate=turn.date||turn.eventDate,assumed=turn.kind==='simulated'||turn.kind==='assumption'||turn===workbench.next;
      return output(`${turn.type==='high'?'고점':'저점'}${assumed?' 가정':''} ${date(turnDate)}${finite(turn.price??turn.eventPrice)?` · ${money(turn.price??turn.eventPrice)}`:''}`,`${assumed?'조건부 전환 후보':'선택일 전에 확인된 최근 전환점'}${turn.confirmationDate?` · 확인 ${date(turn.confirmationDate)}`:''}${turnDate?` · 발생 ${date(turnDate)}`:''}`,assumed?'scenario':'neutral');
    }
    case 'cycle-timing': {
      // A missing historical clock must never fall back to today's calibration.
      const timing=Object.hasOwn(selected,'cycleTiming')?selected.cycleTiming:cycle;
      const shift=timing?.appliedShiftDays??timing?.shiftDays;
      if(!timing?.causal||timing.state==='insufficient'||!finite(shift))return missing('관측 근거 대기');
      return output(`${timing.label||'조건부 보정'} ${shift>0?'+':shift<0?'−':''}${number(Math.abs(shift),0)}일`,`${context} · 관측 기반 조건부 사이클 시계${finite(timing.cycleLengthDays)?` · 조건부 주기 ${number(timing.cycleLengthDays,0)}일`:''} · 색상은 매매 신호가 아닙니다.`,shift<-21?'down':shift>21?'extended':'up');
    }
    case 'drawdown':
      return finite(selected.drawdownPct)?output(`${future?'가정 ':''}${percent(selected.drawdownPct)}`,`${context} · 이 가격 계열의 이전 최고가 대비 낙폭`,future?'scenario':selected.drawdownPct<0?'down':'neutral'):missing(finite(selected.open)?'일말 가격선에서 확인':'낙폭 자료 없음');
    case 'states':
      return selected.marketStateLabel?output(`${future?'가정 ':''}${selected.marketStateLabel}`,`${context} · 해당 가격 경로의 국면 분류`,future?'scenario':'neutral'):missing('국면 분류 대기');
    case 'fibonacci': {
      const levels=Array.isArray(selected.fib)?selected.fib.filter(level=>finite(level.price)&&finite(level.ratio)):[];
      if(!levels.length)return missing('확인된 스윙 없음');
      if(selected.date&&levels[0].startDate>selected.date)return missing('이 날짜에는 스윙 확인 전');
      const level=levels.find(level=>Math.abs(level.ratio-.618)<1e-8)||levels[0];
      return output(`${number(level.ratio*100,1)}% · ${money(level.price)}`,`확인된 최근 스윙 · ${levels.map(level=>`${number(level.ratio*100,1)}% ${money(level.price)}`).join(' · ')}`);
    }
    default: {
      const analysis=analyses instanceof Map?analyses.get(id):analyses?.[id],detail=analysis?.detail;
      if(!detail)return missing('분석 항목 선택');
      const fields=detail.fields||[],field=id==='periods'?fields.find(field=>field.label===(periodLabels[analysis.metric]||periodLabels.returnPct)):fields[0];
      return output(`${detail.label}${field?` · ${field.value}`:''}`,[detail.label,...fields.map(field=>`${field.label}: ${field.value}`),detail.note].filter(Boolean).join(' · '),['assumption','simulated'].includes(detail.kind)?'scenario':'neutral');
    }
  }
}

export function indicatorReadoutDate(selection) {
  if(!selection?.date)return '가격 자료를 불러오는 중';
  return `${date(selection.date)} UTC · ${selection.kind==='unavailable'?'범위 · 자료 없음':selection.hovered?'커서':'선택'}${selection.kind==='simulated'?' · 가정':''}`;
}
