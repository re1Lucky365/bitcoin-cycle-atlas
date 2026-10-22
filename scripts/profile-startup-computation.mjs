#!/usr/bin/env node
// CPU-only measurements: this is deliberately not a browser performance gate.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {buildLongHorizonForecast} from '../dist/long-horizon-forecast.js';
import {fitVolumeForecastModel,projectVolumeForecast} from '../dist/volume-forecast.js';
import {calibrateCycleTiming} from '../dist/cycle-calibration.js';
import {computeRollingStates} from '../dist/market-structure.js';
import {analyzeCycleTiming} from '../dist/cycle-timing.js';
import {buildComparison,utcDay,dateFromDay} from '../dist/cycle-engine.js';

const dataset=JSON.parse(readFileSync(new URL('../dist/data/btc-daily.json',import.meta.url),'utf8'));
const volume=JSON.parse(readFileSync(new URL('../dist/data/btc-volume.json',import.meta.url),'utf8'));
const asOf=dataset.prices.at(-1)[0],referenceDate=asOf>'2026-10-21'?dateFromDay(utcDay(asOf)+1):'2026-10-22';
const timings={};
const measure=(name,compute)=>{const start=performance.now(),value=compute();timings[name]=+(performance.now()-start).toFixed(2);return value;};
const sha=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

// Included to quantify work that can be deferred until those views are opened.
measure('hiddenComparison',()=>buildComparison(dataset));
measure('hiddenTiming',()=>analyzeCycleTiming(dataset));
measure('cycleCalibration',()=>calibrateCycleTiming(dataset,{asOf}));
const model=measure('longHorizon128',()=>buildLongHorizonForecast(dataset,{asOf,referenceDate,seed:20261022,sampleCount:128,blockDays:28}));
measure('rollingStatesRepeated',()=>computeRollingStates({prices:[...dataset.prices,...model.path.slice(1).map(point=>[point.date,point.price])]}));
const fit=measure('volumeFit',()=>fitVolumeForecastModel(volume.bars,{asOf,source:'Bitstamp'}));
const projection=measure('volumeProjection',()=>projectVolumeForecast(fit,model.path,{asOf,endDate:model.displayEnd,frequency:'daily',terminalVolatility:.2,volatilityHalfLifeYears:8}));

console.log(JSON.stringify({
  scope:'Node computation walltime in one process; not browser paint/input latency or a mobile-device benchmark. Descriptive timings, no timing threshold.',
  node:process.version,asOf,referenceDate,priceRows:dataset.prices.length,pathRows:model.path.length,volumeBars:volume.bars.length,
  timings,hashes:{model:sha(model),volumeFit:sha(fit),volumeProjection:sha(projection)},
},null,2));
