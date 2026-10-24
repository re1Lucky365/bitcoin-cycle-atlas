import {readFile,writeFile,rename,mkdir,rm} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {EQUITIES,parseYahooEquity,parseEquityArchive} from '../dist/equity-market-data.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export function equitySourceUrl(symbol,now=Date.now()){
  if(!Object.hasOwn(EQUITIES,symbol)||!Number.isFinite(now))throw new RangeError('Invalid equity source request');
  // Yahoo range=max may silently override 1d with monthly bars. Explicit
  // period boundaries plus a granularity assertion prevent that substitution.
  return `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${Date.parse('1998-01-01T00:00:00Z')/1000}&period2=${Math.floor(now/1000)}&interval=1d&events=history%2Csplits%2Cdividends`;
}
export async function fetchEquitySnapshot(symbol,{now=Date.now(),fetchImpl=globalThis.fetch}={}){
  const sourceUrl=equitySourceUrl(symbol,now),response=await fetchImpl(sourceUrl,{headers:{'User-Agent':'Bitcoin-Cycle-Atlas research / https://github.com/twoimo/bitcoin-cycle-atlas'},signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error(`${symbol} provider HTTP ${response.status}`);
  const raw=await response.text(),payload=JSON.parse(raw);
  return {...parseYahooEquity(payload,{symbol,retrievedAt:new Date(now).toISOString(),sourceUrl}),responseSha256:createHash('sha256').update(raw).digest('hex')};
}
export async function refreshEquityFile(symbol,output,{now=Date.now(),fetchImpl=globalThis.fetch}={}){
  const next=await fetchEquitySnapshot(symbol,{now,fetchImpl});let previous=null;
  try{previous=parseEquityArchive(JSON.parse(await readFile(output,'utf8')),{symbol});}catch(error){if(error.code!=='ENOENT')throw error;}
  if(previous&&(next.firstDate>previous.firstDate||next.lastDate<previous.lastDate||next.candles.length<previous.candles.length))throw new Error(`${symbol} provider would truncate existing equity history`);
  if(previous){
    const nextSessions=new Set(next.candles.map(row=>row.time));
    const missing=previous.candles.find(row=>!nextSessions.has(row.time));
    if(missing)throw new Error(`${symbol} provider omitted previously observed session ${missing.date.slice(0,10)}`);
  }
  // Refetch the complete history because future splits legitimately rewrite
  // prior split-adjusted prices. A partial response never replaces the file.
  await mkdir(dirname(output),{recursive:true});const temporary=`${output}.tmp-${process.pid}`;
  try{await writeFile(temporary,`${JSON.stringify(next)}\n`,{flag:'wx'});await rename(temporary,output);}finally{await rm(temporary,{force:true});}
  return next;
}
if(resolve(process.argv[1]||'')===fileURLToPath(import.meta.url)){
  for(const symbol of Object.keys(EQUITIES)){
    const result=await refreshEquityFile(symbol,resolve(root,`dist/data/${symbol.toLowerCase()}-ohlc.json`));
    console.log(JSON.stringify({symbol,rows:result.candles.length,firstDate:result.firstDate,lastDate:result.lastDate,retrievedAt:result.retrievedAt}));
  }
}
