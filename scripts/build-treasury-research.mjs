import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),check=process.argv.includes('--check');
const readJson=async file=>JSON.parse(await readFile(path.join(root,file),'utf8'));
const data={MSTR:await readJson('research-data/treasury-mstr.json'),BMNR:await readJson('research-data/treasury-bmnr.json')};
const allSources=Object.values(data).flatMap(item=>item.sources),ids=new Set();
for(const source of allSources){assert(/^[a-z0-9-]+$/.test(source.id));assert(!ids.has(source.id),`duplicate ${source.id}`);ids.add(source.id);assert(new URL(source.url).protocol==='https:');assert(source.title&&source.summary&&source.author);assert(['filing','data','leadership','method','risk'].includes(source.category));}
for(const record of Object.values(data)){
  assert(record.symbol&&record.reviewDate&&record.snapshot.asOf);
  for(const event of [...record.events,...record.futureEvents||[]]){assert(/^\d{4}-\d{2}-\d{2}$/.test(event.date));assert.equal(new Date(`${event.date}T00:00:00Z`).toISOString().slice(0,10),event.date);assert(event.sourceIds.length);for(const id of event.sourceIds)assert(ids.has(id),`Missing event source ${id}`);}
  for(const source of record.sources)for(const claim of source.claims||[])for(const id of claim.crossCheckIds||[])assert(ids.has(id),`Missing cross-check ${id}`);
  for(const key of ['coinUnits','shares','cashUsd','otherAssetsUsd','debtUsd','preferredUsd'])assert(Number.isFinite(record.snapshot[key])&&record.snapshot[key]>=0,`Invalid snapshot ${key}`);
  assert(record.snapshot.shares>0);
}
const btc=await readJson('dist/data/btc-daily.json'),eth=await readJson('dist/data/eth-ohlc.json');
const mstr=await readJson('dist/data/mstr-ohlc.json'),bmnr=await readJson('dist/data/bmnr-ohlc.json');
// Crypto trades on weekends; US stocks do not. A refresh must not put Sunday's
// coin price behind Friday's equity anchor or break the weekend forecast.
const lastBtc=btc.prices.filter(row=>row[0]<=mstr.lastDate.slice(0,10)).at(-1),lastEth=eth.dailyHistory.candles.filter(row=>row.date.slice(0,10)<=bmnr.lastDate.slice(0,10)).at(-1);
assert(lastBtc&&lastEth,'Missing crypto observation at or before equity session');
const anchors={MSTR:{date:lastBtc[0],price:lastBtc[1],source:'Coin Metrics · UTC 일말',url:btc.meta.source,retrievedAt:btc.meta.retrievedAt},BMNR:{date:lastEth.date.slice(0,10),price:lastEth.close,source:'Coinbase ETH-USD · UTC 일말',url:'https://api.exchange.coinbase.com/products/ETH-USD/candles',retrievedAt:eth.retrievedAt}};
const text=`// Generated from reviewed research-data/treasury-*.json. Do not edit by hand.\nexport const TREASURY_DATA=${JSON.stringify(data)};\nexport const MARKET_ANCHORS=${JSON.stringify(anchors)};\n`;
const out=path.join(root,'dist/treasury-catalog.js');
if(check)assert.equal(await readFile(out,'utf8'),text,'Treasury catalog is stale');else await writeFile(out,text);
const manifest={version:1,reviewDate:'2026-10-24',scope:'source metadata and original research summaries; no complete third-party text or media copies',sources:allSources.length,historicalEvents:Object.values(data).reduce((n,item)=>n+item.events.length,0),inputs:[]};
for(const name of ['research-data/treasury-mstr.json','research-data/treasury-bmnr.json'])manifest.inputs.push({path:name,sha256:createHash('sha256').update(await readFile(path.join(root,name))).digest('hex')});
await mkdir(path.join(root,'dist/research'),{recursive:true});
if(!check)await writeFile(path.join(root,'dist/research/treasury-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({status:'ok',check,sources:manifest.sources,historicalEvents:manifest.historicalEvents}));
