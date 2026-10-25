import {buildTreasuryAssetPaths} from "./treasury-asset-paths.js?v=1.23.0";
import {buildTreasuryForecasts} from "./treasury-model.js?v=1.23.0";

import {utcDay} from './cycle-engine.js?v=1.19.0';

/** One bundle per observed-data load; switching conditions reuses its paths. */
export function buildTreasuryProjection({symbol,history,btcHistory,ethHistory,endYear=2035,seed=20261022,asOf}={}){
  const candles=Array.isArray(history)?history:history?.candles;
  if(!Array.isArray(candles)||!candles.length)throw new TypeError('Observed equity history is required');
  if(asOf!==undefined)utcDay(asOf);
  const dates=candles.map(row=>{
    if(typeof row?.date!=='string'||!/^\d{4}-\d{2}-\d{2}(?:T00:00:00(?:\.000)?Z)?$/.test(row.date))throw new TypeError('Observed equity session date is invalid');
    const date=row.date.slice(0,10);utcDay(date);return date;
  });
  const cutoff=dates.filter(date=>asOf===undefined||date<=asOf).sort().at(-1);
  if(!cutoff)throw new RangeError('No observed equity session at cutoff');
  const assetPaths=buildTreasuryAssetPaths({symbol,btcHistory,ethHistory,asOf:cutoff,endYear,seed});
  const source=symbol==='MSTR'?btcHistory?.meta:ethHistory?.dailyHistory??ethHistory;
  const coinAnchor={date:cutoff,price:assetPaths.scenarios.base.path[0].price,
    source:symbol==='MSTR'?'Coin Metrics · UTC 일말':'Coinbase ETH-USD · UTC 일말',
    url:symbol==='MSTR'?source?.source:'https://api.exchange.coinbase.com/products/ETH-USD/candles',
    retrievedAt:source?.retrievedAt??ethHistory?.retrievedAt??null,
    alignment:'Same date UTC end-of-day; not simultaneous with the New York equity close'};
  const forecasts=buildTreasuryForecasts({symbol,history,asOf:cutoff,endYear,assetPaths,coinAnchor});
  return {symbol,asOf:cutoff,endYear,seed,forecasts,assetMetadata:assetPaths.metadata};
}
