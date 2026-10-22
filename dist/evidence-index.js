import { CRYPTOCON_EVIDENCE } from './cryptocon-evidence.js?v=1.11.0';
import { EVIDENCE, EVIDENCE_SUPPLEMENTS } from './evidence-catalog.js?v=1.11.0';
import { STRUCTURE_EVIDENCE, STRUCTURE_EVIDENCE_SUPPLEMENTS } from './structure-evidence.js?v=1.11.0';
import { LONG_HORIZON_CLAIMS } from './long-horizon-evidence.js?v=1.11.0';

const longHorizonEvidence = LONG_HORIZON_CLAIMS.map(claim => ({
  id: `long-${claim.id}`, title: claim.title, originalTitle: claim.sourceLocator,
  publisher: claim.publisher, date: claim.publishedAt, url: claim.url,
  tier: claim.evidenceGrade.slice(0, 1), type: claim.prices ? '조건부 장기 시나리오' : '장기 가설·반론',
  role: claim.prices ? '장기 가격·채택' : '변동성·주기·반론',
  stance: /blackrock|gold-volatility|harvey|taleb/.test(claim.id) ? 'counter' : 'mixed',
  timing: claim.targetYear ? 'before' : 'after', scope: 'long-horizon',
  family: `long-horizon-${claim.publisher.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
  access: `${claim.evidenceGrade} · ${claim.sourceLocator}`,
  reason: `${claim.claim} ${claim.assumptions.join(' ')}`,
  limitation: `${claim.limitations.join(' ')} 등급은 원문의 확인 수준이며 미래 적중률이 아니다.`,
}));

// This is an explicit reading workflow, not a confidence score. Data and
// falsification methods precede the user-requested chart and outside opinions.
const PRIORITY = [
  'cm-price-data','cm-price-definition','coinbase-candle-data','coinbase-candle-definition',
  'structure-bitcoin-consensus','bitcoin-halving-history','cm-community-scope',
  ...longHorizonEvidence.map(claim => claim.id),
  'fpp-forecast-methods','structure-directional-change','structure-stylized-facts',
  'cryptocon-audit-report','structure-fibonacci-null-paper','structure-white-reality-check','structure-lo-chart-patterns',
  'structure-ilay-halving-v3','structure-ilay-2024-repost',
  'cryptocon-theories-collide','cryptocon-slowest-2025','cryptocon-revision-2026','cryptocon-unfinished','cryptocon-sale-alert','cryptocon-pseudo-bottom','cryptocon-limbo','galaxy-cycle-duration','bitwise-march-early-bottom','structure-rekt-june2026',
  'glassnode-july-discovery','cm-july-flows','reuters-september-sideways','cm-q3-wrap',
  'structure-imf-crypto-cycle','structure-nyfed-disconnect',
  'structure-china-2013','structure-cme-launch','structure-frbsf-futures',
  'structure-fed-covid','structure-fed-tightening','structure-ftx-complaint','structure-sec-etp',
  'dave-cointelegraph','dave-x-original','rekt-dailyhodl','rekt-video-original',
  'structure-rekt-july2025','structure-cryptobirb-countdown','cowen-forklog','cowen-x-original',
  'ki-may-retraction','ki-july-context','ki-july-x-original',
  'bitwise-january-forecast','coinbase-october-outlook','k33-year-review',
  'glassnode-october-distribution','glassnode-october-hedged','bitwise-cf-bottom-model',
  'bitwise-september-compass','glassnode-october-2026','blackrock-pullback-paper',
  'structure-reddit-fib-deadline','reddit-merkle-prediction','reddit-merkle-followup',
];
const all=[...EVIDENCE,...STRUCTURE_EVIDENCE,...CRYPTOCON_EVIDENCE,...longHorizonEvidence],byId=new Map(all.map(row=>[row.id,row]));
const ordered=[...PRIORITY.map(id=>byId.get(id)),...all.filter(row=>!PRIORITY.includes(row.id))];
const seen=new Set();
export const RESEARCH_EVIDENCE=ordered.filter(row=>{if(!row)throw new Error('Missing priority source');const url=new URL(row.url).href;if(seen.has(url))return false;seen.add(url);return true;}).map((row,index)=>({...row,rank:index+1}));
const parents=new Set(RESEARCH_EVIDENCE.map(row=>row.id)),seenSupplements=new Set();
export const RESEARCH_SUPPLEMENTS=[...EVIDENCE_SUPPLEMENTS,...STRUCTURE_EVIDENCE_SUPPLEMENTS,...LONG_HORIZON_CLAIMS.filter(claim=>claim.documentUrl).map(claim=>({parentId:`long-${claim.id}`,title:`${claim.publisher} 원문 문서`,url:claim.documentUrl}))].filter(row=>{const key=`${row.parentId}:${row.url}`;if(!parents.has(row.parentId)||seenSupplements.has(key))return false;seenSupplements.add(key);return true;});
