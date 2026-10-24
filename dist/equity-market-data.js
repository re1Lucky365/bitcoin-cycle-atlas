/** Listed-equity observations are separate from crypto market products. */
export const EQUITIES = Object.freeze({
  MSTR: Object.freeze({symbol:'MSTR',name:'Strategy',koreanName:'스트래티지',exchange:'Nasdaq',currency:'USD',historyNote:'1998년 상장 이후 제공자 일별 기록. 과거 가격은 주식분할을 반영한 현재 주식 단위입니다.'}),
  BMNR: Object.freeze({symbol:'BMNR',name:'Bitmine',koreanName:'비트마인',exchange:'NYSE',currency:'USD',historyNote:'2025-06-05 거래소 상장 이후 기록. 이전 OTC 거래와 2025년 5월 1:20 역분할 이전 가격은 이 자료에 없습니다.'}),
});
export const EQUITY_INTERVALS = Object.freeze([{id:'daily',label:'1D'},{id:'weekly',label:'1W'}]);
const DAY=86400;
const dateOnly=value=>new Date(value*1000).toISOString().slice(0,10);
const midnight=value=>Date.parse(`${value}T00:00:00Z`)/1000;
function identity(symbol){if(!Object.hasOwn(EQUITIES,symbol))throw new RangeError('Unsupported equity symbol');return EQUITIES[symbol];}
function candle(row,previous=-Infinity){
  if(!row||!Number.isSafeInteger(row.time)||row.time%DAY!==0||row.time<=previous||row.date!==`${dateOnly(row.time)}T00:00:00Z`)throw new TypeError('Invalid equity session date');
  if(!['open','high','low','close'].every(key=>Number.isFinite(row[key])&&row[key]>0)||row.low>Math.min(row.open,row.close)||row.high<Math.max(row.open,row.close)||!Number.isFinite(row.volume)||row.volume<0)throw new TypeError('Invalid equity OHLCV');
  return {...row};
}

/** The provider adjusts OHLC for splits. Keep adjusted close separately; never
 * turn its dividend adjustment into synthetic historical OHLC. */
export function parseYahooEquity(payload,{symbol,retrievedAt=new Date().toISOString(),sourceUrl}={}){
  identity(symbol);
  const result=payload?.chart?.result?.[0],meta=result?.meta,quote=result?.indicators?.quote?.[0];
  if(payload?.chart?.error||meta?.symbol!==symbol||meta?.instrumentType!=='EQUITY'||meta?.currency!=='USD'||meta?.exchangeTimezoneName!=='America/New_York'||meta?.dataGranularity!=='1d')throw new TypeError('Invalid equity provider identity or daily granularity');
  const now=Date.parse(retrievedAt),cutoff=Math.floor(now/1000/DAY)*DAY;
  if(!Number.isFinite(now)||!Array.isArray(result.timestamp)||!quote)throw new TypeError('Invalid equity provider rows');
  const sessionFormatter=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'});
  const candles=[];let excludedIncomplete=0;const unavailableSessions=[];
  for(let i=0;i<result.timestamp.length;i++){
    const sessionTimestamp=result.timestamp[i];
    if(!Number.isSafeInteger(sessionTimestamp))throw new TypeError('Invalid equity provider timestamp');
    const parts=Object.fromEntries(sessionFormatter.formatToParts(new Date(sessionTimestamp*1000)).map(p=>[p.type,p.value]));
    const sessionDate=`${parts.year}-${parts.month}-${parts.day}`,time=midnight(sessionDate);
    // Waiting until the following UTC day also safely excludes an in-progress
    // US session, including early close dates and DST changes.
    if(time>=cutoff){excludedIncomplete++;continue;}
    const values=Object.fromEntries(['open','high','low','close','volume'].map(key=>[key,quote[key]?.[i]]));
    if(Object.values(values).every(value=>value===null||value===undefined)){unavailableSessions.push(sessionDate);continue;}
    const adjustedClose=result.indicators.adjclose?.[0]?.adjclose?.[i];
    candles.push(candle({time,date:`${sessionDate}T00:00:00Z`,sessionDate,sessionTimestamp,...values,...(Number.isFinite(adjustedClose)?{adjustedClose}: {})},candles.at(-1)?.time));
  }
  if(!candles.length)throw new RangeError('No completed equity sessions');
  const splits=Object.values(result.events?.splits||{}).map(item=>({date:dateOnly(item.date),numerator:item.numerator,denominator:item.denominator,ratio:item.splitRatio}));
  const snapshot={version:1,source:'Yahoo Finance',symbol,product:symbol,assetClass:'equity',currency:'USD',exchange:meta.fullExchangeName,exchangeTimezone:'America/New_York',retrievedAt,sourceUrl,sourcePage:`https://finance.yahoo.com/quote/${symbol}/history/`,adjustment:'provider-split-adjusted-ohlc',volumeUnit:'shares',completedOnly:true,completionRule:'session-date-before-retrieval-utc-date',firstDate:candles[0].date,lastDate:candles.at(-1).date,coverageNote:EQUITIES[symbol].historyNote,unavailableSessions,excludedIncomplete,splits,candles};
  parseEquityArchive(snapshot,{symbol});return snapshot;
}

/** Aggregate observed trading sessions, not seven manufactured crypto days.
 * A week is admitted only after its Friday UTC date has fully elapsed. */
export function aggregateEquityWeeks(rows,{retrievedAt}={}){
  const cutoff=Math.floor(Date.parse(retrievedAt)/1000/DAY)*DAY;
  if(!Number.isFinite(cutoff))throw new TypeError('Invalid equity weekly cutoff');
  const groups=new Map();
  for(const row of rows){const day=new Date(row.time*1000).getUTCDay(),monday=row.time-((day+6)%7)*DAY;if(!groups.has(monday))groups.set(monday,[]);groups.get(monday).push(row);}
  return [...groups].filter(([monday])=>monday+5*DAY<=cutoff).map(([time,bars])=>({time,date:`${dateOnly(time)}T00:00:00Z`,sessionDate:dateOnly(time),lastSessionDate:bars.at(-1).sessionDate,open:bars[0].open,high:Math.max(...bars.map(row=>row.high)),low:Math.min(...bars.map(row=>row.low)),close:bars.at(-1).close,volume:bars.reduce((sum,row)=>sum+row.volume,0),sessionCount:bars.length}));
}

export function parseEquityArchive(payload,{symbol=payload?.symbol,interval='daily'}={}){
  identity(symbol);
  if(!['daily','weekly'].includes(interval))throw new RangeError('Equity archive supports daily and weekly only');
  if(payload?.version!==1||payload?.symbol!==symbol||payload?.product!==symbol||payload?.source!=='Yahoo Finance'||payload?.assetClass!=='equity'||payload?.currency!=='USD'||payload?.exchangeTimezone!=='America/New_York'||payload?.adjustment!=='provider-split-adjusted-ohlc'||payload?.completedOnly!==true||!Array.isArray(payload.candles))throw new TypeError('Invalid equity archive identity');
  const retrieved=Date.parse(payload.retrievedAt),cutoff=Math.floor(retrieved/1000/DAY)*DAY;
  if(!Number.isFinite(retrieved))throw new TypeError('Invalid equity archive collection time');
  let previous=-Infinity;
  const daily=payload.candles.map(row=>{const parsed=candle(row,previous);previous=parsed.time;if(parsed.time>=cutoff)throw new TypeError('Incomplete or future equity session');return parsed;});
  if(!daily.length||daily[0].date!==payload.firstDate||daily.at(-1).date!==payload.lastDate)throw new TypeError('Invalid equity archive coverage');
  const candles=interval==='weekly'?aggregateEquityWeeks(daily,payload):daily;
  if(!candles.length)throw new RangeError('No completed equity weeks');
  return {...payload,interval,seconds:interval==='weekly'?7*DAY:DAY,candles,firstDate:candles[0].date,lastDate:candles.at(-1).date,snapshot:true,calendar:'exchange-sessions',gapCount:(payload.unavailableSessions||[]).length};
}

export function equityHistoryRange(series,{span='4y',forecastEnd=null}={}){
  const step=series.seconds,first=series.candles[0].time,last=series.candles.at(-1).time;
  const future=forecastEnd?midnight(forecastEnd):last;
  const min=first-step;
  const floor=value=>min+Math.floor((value-min)/step)*step;
  const ceil=value=>min+Math.ceil((value-min)/step)*step;
  const max=ceil(Math.max(last,future)+step);
  const days={'1m':30,'6m':183,'1y':365,'4y':1461};
  const end=span==='all'?max:Math.min(max,ceil(last+(span==='4y'?548:Math.max(10,Math.round((days[span]||1461)*.25)))*DAY));
  const start=span==='all'?min:Math.max(min,floor(end-(days[span]||1461)*DAY));
  return {unit:'seconds',start,end,min,max,step,minSpan:Math.min(12,Math.round((max-min)/step)+1),contextKey:`${series.symbol}:${series.interval}:${series.retrievedAt}`};
}
