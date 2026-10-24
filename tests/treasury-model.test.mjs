import test from 'node:test';
import assert from 'node:assert/strict';
import {
  treasuryResidual, issueCommon, fundCashOutflow, repayPrincipal,
  buildTreasuryForecast,
} from '../dist/treasury-model.js';
import { TREASURY_SNAPSHOTS } from '../dist/treasury-research.js';

const near = (actual, expected, tolerance = 1e-8) => {
  assert.ok(Number.isFinite(actual), `non-finite value ${actual}`);
  assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);
};
const state = (changes = {}) => ({
  coinUnits: 10, cashUsd: 0, otherAssetsUsd: 0, debtUsd: 0,
  preferredUsd: 0, otherLiabilitiesUsd: 0, nonControllingInterestUsd: 0,
  shares: 100, ...changes,
});
const snapshot = (changes = {}) => ({
  ...state({coinUnits: 1_000_000, cashUsd: 100_000_000, shares: 100_000_000}),
  asOf: '2026-05-31', publishedAt: '2026-07-14', coin: 'ETH',
  sourceIds: ['test-disclosure'], notes: [], ...changes,
});
const input = (changes = {}) => ({
  symbol: 'BMNR', history: [{date: '2026-10-23', close: 22}],
  snapshot: snapshot(), coinAnchor: {date: '2026-10-23', price: 2000},
  endYear: 2035, ...changes,
});

test('ordinary residual subtracts all senior and non-controlling claims once', () => {
  const result = treasuryResidual(state({cashUsd: 200, otherAssetsUsd: 50, debtUsd: 150, preferredUsd: 100, otherLiabilitiesUsd: 20, nonControllingInterestUsd: 5}), 100);
  near(result.grossAssets, 1250);
  near(result.seniorClaims, 275);
  near(result.residualUsd, 975);
  near(result.navPerShare, 9.75);
});

test('the matched BMNR accounting bridge reconciles reported common book equity', () => {
  const actual = TREASURY_SNAPSHOTS.BMNR;
  assert.equal(actual.asOf, '2026-05-31');
  assert.equal(actual.publishedAt, '2026-07-14');
  assert.equal(actual.shares, 579652432);
  const result = treasuryResidual(actual, actual.coinPriceUsd);
  near(result.residualUsd, 11599577000);
  assert.equal(actual.preferredUsd, 0, 'June preferred must not contaminate the May historical snapshot');
});

test('NET issue premium controls common-NAV accretion, including fees', () => {
  const initial = state();
  const above = issueCommon(initial, {newShares: 20, offerPrice: 12, coinPrice: 100, feeRate: 0.02});
  const below = issueCommon(initial, {newShares: 20, offerPrice: 8, coinPrice: 100, feeRate: 0.02});
  const neutral = issueCommon(initial, {newShares: 20, offerPrice: 10 / 0.98, coinPrice: 100, feeRate: 0.02});
  near(treasuryResidual(above, 100).navPerShare, 1235.2 / 120);
  near(treasuryResidual(below, 100).navPerShare, 1156.8 / 120);
  near(treasuryResidual(neutral, 100).navPerShare, 10);
  assert.ok(treasuryResidual(above, 100).navPerShare > 10);
  assert.ok(treasuryResidual(below, 100).navPerShare < 10);
  assert.deepEqual(initial, state(), 'input state must remain unchanged');
});

test('NAV accretion does not imply coin-per-share accretion under senior claims', () => {
  const initial = state({debtUsd: 500});
  const issued = issueCommon(initial, {newShares: 10, offerPrice: 6, coinPrice: 100});
  assert.ok(treasuryResidual(issued, 100).navPerShare > treasuryResidual(initial, 100).navPerShare);
  assert.ok(issued.coinUnits / issued.shares < initial.coinUnits / initial.shares);
});

test('retained issuance cash and coin purchases conserve net proceeds', () => {
  const initial = state({cashUsd: 5});
  const issued = issueCommon(initial, {newShares: 10, offerPrice: 12, coinPrice: 100, feeRate: 0.02, investmentFraction: 0.75});
  near(issued.cashUsd, 5 + 117.6 * 0.25);
  near((issued.coinUnits - initial.coinUnits) * 100 + issued.cashUsd - initial.cashUsd, 117.6);
  near(treasuryResidual(issued, 100).residualUsd - treasuryResidual(initial, 100).residualUsd, 117.6);
});

test('cash outflows use cash first and reduce common value by the expense', () => {
  const initial = state({cashUsd: 40});
  const paid = fundCashOutflow(initial, 65, 100);
  near(paid.cashUsed, 40);
  near(paid.coinsSold, 0.25);
  near(paid.state.cashUsd, 0);
  near(paid.shortfall, 0);
  near(treasuryResidual(paid.state, 100).residualUsd, treasuryResidual(initial, 100).residualUsd - 65);
});

test('coin sale fees are an additional economic loss', () => {
  const initial = state();
  const paid = fundCashOutflow(initial, 90, 100, 0.1);
  near(paid.coinsSold, 1);
  near(treasuryResidual(paid.state, 100).residualUsd, 900);
  near(paid.shortfall, 0);
});

test('unfunded operating bills remain liabilities, without negative cash or coins', () => {
  const initial = state({coinUnits: 0.2, cashUsd: 10});
  const paid = fundCashOutflow(initial, 100, 100);
  near(paid.shortfall, 70);
  near(paid.state.coinUnits, 0);
  near(paid.state.cashUsd, 0);
  near(paid.state.otherLiabilitiesUsd, 70);
  near(treasuryResidual(paid.state, 100).residualUsd, -70);
});

test('repaying principal preserves common residual before transaction costs', () => {
  const initial = state({coinUnits: 1, cashUsd: 50, debtUsd: 100, shares: 10});
  const repaid = repayPrincipal(initial, 60, 100);
  near(repaid.state.debtUsd, 40);
  near(repaid.cashUsed, 50);
  near(repaid.coinsSold, 0.1);
  near(treasuryResidual(repaid.state, 100).residualUsd, treasuryResidual(initial, 100).residualUsd);
});

test('unpaid principal is reclassified, not erased', () => {
  const initial = state({coinUnits: 0.2, cashUsd: 10, debtUsd: 100});
  const repaid = repayPrincipal(initial, 100, 100);
  near(repaid.state.debtUsd, 0);
  near(repaid.state.otherLiabilitiesUsd, 70);
  near(treasuryResidual(repaid.state, 100).residualUsd, treasuryResidual(initial, 100).residualUsd);
  assert.throws(() => repayPrincipal(initial, 101, 100), /exceeds/i);
});

test('principal cannot exceed outstanding debt by even a fraction of a cent', () => {
  const initial = state({coinUnits: 0, cashUsd: 2, debtUsd: 1, shares: 1});
  for (const principal of [1.005, 1.000001, 1 + Number.EPSILON]) {
    assert.throws(() => repayPrincipal(initial, principal, 100), /exceeds/i);
  }
  const paid = repayPrincipal(initial, 1, 100);
  assert.equal(paid.state.debtUsd, 0);
  assert.equal(paid.state.cashUsd, 1);
  assert.equal(treasuryResidual(paid.state, 100).residualUsd, treasuryResidual(initial, 100).residualUsd);
  assert.deepEqual(initial, state({coinUnits: 0, cashUsd: 2, debtUsd: 1, shares: 1}));
});

test('funding and principal preserve their independent balance identities over a bounded state grid', () => {
  let checks=0,unpaid=0;
  for(const coinUnits of [0,0.25,10])for(const cashUsd of [0,5,100])for(const debtUsd of [0,1,100])for(const coinPrice of [10,10_000])for(const saleFee of [0,0.005,0.25]){
    const initial=state({coinUnits,cashUsd,debtUsd}),before=treasuryResidual(initial,coinPrice).residualUsd;
    const expense=125;
    const funded=fundCashOutflow(initial,expense,coinPrice,saleFee);
    const repaid=repayPrincipal(initial,debtUsd,coinPrice,saleFee);
    near(treasuryResidual(funded.state,coinPrice).residualUsd,before-expense-funded.coinsSold*coinPrice*saleFee);
    near(treasuryResidual(repaid.state,coinPrice).residualUsd,before-repaid.coinsSold*coinPrice*saleFee);
    assert.equal(repaid.state.debtUsd,0);
    assert.ok(funded.state.coinUnits>=0&&funded.state.cashUsd>=0&&repaid.state.coinUnits>=0&&repaid.state.cashUsd>=0);
    assert.deepEqual(initial,state({coinUnits,cashUsd,debtUsd}));
    unpaid+=Number(funded.shortfall>0)+Number(repaid.shortfall>0);
    checks+=2;
  }
  assert.equal(checks,324);
  assert.ok(unpaid>0,'the grid must include unpaid bills and principal reclassification');
});

test('invalid numerical state cannot silently propagate NaN or negative balances', () => {
  for (const bad of [NaN, Infinity, -1]) {
    assert.throws(() => treasuryResidual(state({cashUsd: bad}), 100));
    assert.throws(() => issueCommon(state({coinUnits: bad}), {newShares: 1, offerPrice: 10, coinPrice: 100}));
    assert.throws(() => fundCashOutflow(state({cashUsd: bad}), 10, 100));
  }
  assert.throws(() => treasuryResidual(state({shares: 0}), 100));
  assert.throws(() => fundCashOutflow(state(), 1, 0));
  assert.throws(() => issueCommon(state(), {newShares: 1, offerPrice: 10, coinPrice: 100, feeRate: 1}));
});

test('missing optional claims are either zero or rejected, never NaN', () => {
  let result;
  try { result = treasuryResidual({coinUnits: 10, cashUsd: 0, shares: 100}, 100); }
  catch (error) { assert.ok(error instanceof TypeError || error instanceof RangeError); return; }
  near(result.navPerShare, 10);
});

test('all forecast paths start at the observed equity price and expose the historical vintage', () => {
  for (const scenario of ['base', 'stress', 'bull']) {
    const result = buildTreasuryForecast(input({scenario}));
    near(result.path[0].price, 22);
    assert.equal(result.path[0].kind, 'anchor');
    assert.equal(result.asOf, '2026-10-23');
    assert.equal(result.issuedAt, '2026-10-24', 'research publication and observed equity price are separate dates');
    assert.equal(result.path[0].date, result.asOf);
    assert.equal(result.financialAsOf, '2026-05-31');
    assert.equal(result.diagnostics.currentNavClaim, false);
    assert.equal(result.diagnostics.predictiveValidation, 'not-established');
    assert.equal(result.diagnostics.probabilities, null);
    assert.ok(result.warnings.some(text => text.includes('2026-05-31') && text.includes('2026-10-23')));
    assert.ok(result.warnings.some(text => text.includes('신뢰구간')));
  }
});

test('later observed equity bars are excluded by the as-of cutoff', () => {
  const result = buildTreasuryForecast(input({history: [{date:'2026-10-23', close:22}, {date:'2026-10-24', close:999}], asOf:'2026-10-23'}));
  near(result.path[0].price, 22);
  assert.equal(result.asOf, '2026-10-23');
});

test('publication date, not balance-sheet date alone, gates historical use', () => {
  assert.throws(() => buildTreasuryForecast(input({snapshot:snapshot({publishedAt:'2026-10-24'})})), /Future information/i);
  assert.throws(() => buildTreasuryForecast(input({coinAnchor:{date:'2026-10-24',price:2000}})), /Future information/i);
});

test('current frozen research cannot be reused as a historical backtest', () => {
  assert.throws(() => buildTreasuryForecast(input({asOf:'2026-07-15',history:[{date:'2026-07-15',close:22}],coinAnchor:{date:'2026-07-15',price:2000}})), /research knowledge date|not a backtest/i);
});

test('a modern requested cutoff cannot hide stale equity or coin anchors', () => {
  assert.throws(() => buildTreasuryForecast(input({asOf:'2026-10-23',history:[{date:'2026-07-15',close:22}],coinAnchor:{date:'2026-07-15',price:2000}})), /research knowledge date|not a backtest|price anchor|anchor.*date/i);
  assert.throws(() => buildTreasuryForecast(input({coinAnchor:{date:'2026-07-15',price:2000}})), /research knowledge date|not a backtest|price anchor|anchor.*date/i);
});

test('post-snapshot adjustments cannot leak before their publication', () => {
  const historical = snapshot({modelAdjustments:[{date:'2026-09-01',publishedAt:'2026-10-30',cashUsd:100_000_000,preferredUsd:120_000_000,sourceIds:['unavailable-at-cutoff']}]});
  const result = buildTreasuryForecast(input({snapshot:historical}));
  assert.equal(result.diagnostics.adjustments.length, 0);
  near(result.path[0].components.cashUsd, historical.cashUsd);
  near(result.path[0].components.preferredUsd, 0);
  assert.ok(!result.path[0].sourceIds.includes('unavailable-at-cutoff'));
});

test('known preferred issuance adds cash AND senior claim without pretending to be current NAV', () => {
  const historical = snapshot({modelAdjustments:[{date:'2026-06-10',publishedAt:'2026-06-15',cashUsd:273_800_000,preferredUsd:350_000_000,annualExpensesUsd:33_250_000,sourceIds:['known-preferred']}]});
  const result = buildTreasuryForecast(input({snapshot:historical}));
  near(result.path[0].components.cashUsd, historical.cashUsd + 273_800_000);
  near(result.path[0].components.preferredUsd, 350_000_000);
  near(result.assumptions.financingCarryUsd, 33_250_000);
  assert.equal(result.diagnostics.currentNavClaim, false);
});

test('a known cost reduction may reach zero but cannot create a negative financing expense', () => {
  const withReduction = annualExpensesUsd => input({snapshot:snapshot({
    annualExpensesUsd:1_000_000,
    modelAdjustments:[{date:'2026-06-10',publishedAt:'2026-06-15',annualExpensesUsd}],
  })});
  const zero=buildTreasuryForecast(withReduction(-1_000_000));
  near(zero.assumptions.financingCarryUsd,0);
  assert.throws(() => buildTreasuryForecast(withReduction(-2_000_000)),/annualExpensesUsd|financing/i);
});

test('scenario endpoints and envelopes contain every scenario at each shared date', () => {
  const outputs = ['base','stress','bull'].map(scenario => buildTreasuryForecast(input({symbol:'MSTR', snapshot:snapshot({coin:'BTC'}),coinAnchor:{date:'2026-10-23',price:80_000},scenario,endYear:2050})));
  const grid = outputs[0].path.map(p => p.date);
  for (const output of outputs) assert.deepEqual(output.path.map(p => p.date), grid, 'all scenarios must use the union of target/payment knots');
  for (let index=0;index<grid.length;index++) {
    const values = outputs.map(output => output.path[index].price);
    for (const output of outputs) {
      near(output.path[index].low, Math.min(...values));
      near(output.path[index].high, Math.max(...values));
    }
  }
});

test('forecast dates are strictly increasing and monetary outputs remain finite and nonnegative', () => {
  for (const scenario of ['base','stress','bull']) {
    const result = buildTreasuryForecast(input({scenario,endYear:2050}));
    assert.equal(result.path.at(-1).date, '2050-12-31');
    for (let index=0;index<result.path.length;index++) {
      const point=result.path[index];
      if(index)assert.ok(result.path[index-1].date < point.date);
      for(const value of [point.price,point.low,point.high,point.components.coinUnits,point.components.cashUsd,point.components.debtUsd,point.components.preferredUsd,point.components.shares])assert.ok(Number.isFinite(value)&&value>=0);
      assert.ok(point.low <= point.price && point.price <= point.high);
      assert.equal(point.probability,null);
    }
  }
});

test('exhausted common residual follows an explicit absorbing-zero stress convention', () => {
  const result=buildTreasuryForecast(input({snapshot:snapshot({coinUnits:1,cashUsd:0,shares:1}),history:[{date:'2026-10-23',close:1}],coinAnchor:{date:'2026-10-23',price:1},scenario:'stress'}));
  const firstZero=result.path.findIndex(p=>p.price===0);
  assert.ok(firstZero>0);
  for(const point of result.path.slice(firstZero))assert.equal(point.price,0);
  assert.ok(result.diagnostics.insolventAt);
});

test('invalid horizons, symbols and calendar dates fail clearly', () => {
  assert.throws(()=>buildTreasuryForecast(input({symbol:'BTC'})),/Invalid instrument/i);
  assert.throws(()=>buildTreasuryForecast(input({scenario:'certain'})),/Invalid instrument/i);
  assert.throws(()=>buildTreasuryForecast(input({endYear:2051})),/Horizon/i);
  assert.throws(()=>buildTreasuryForecast(input({asOf:'2026-02-30'})),/calendar date/i);
  assert.throws(()=>buildTreasuryForecast(input({history:[]})),/history/i);
});


test('latest eligible observation is chosen by date without mutating source order', () => {
  const history = [{date:'2026-10-24', close:24}, {date:'2026-10-23', close:22}];
  const original = structuredClone(history);
  const result = buildTreasuryForecast(input({history,asOf:'2026-10-24'}));
  assert.equal(result.asOf,'2026-10-24');
  near(result.path[0].price,24);
  assert.deepEqual(history,original);
});

test('ambiguous duplicate sessions and malformed calendar fields are rejected at the boundary', () => {
  assert.throws(() => buildTreasuryForecast(input({history:[{date:'2026-10-23',close:22},{date:'2026-10-23',close:23}]})),RangeError);
  for (const bad of ['2026-10-23x','2026-10-32',null,20261023]) {
    assert.throws(() => buildTreasuryForecast(input({coinAnchor:{date:bad,price:2000}})),/date/i);
    assert.throws(() => buildTreasuryForecast(input({snapshot:snapshot({publishedAt:bad})})),/date/i);
  }
  assert.throws(() => buildTreasuryForecast(input({history:[{date:'2026-10-23garbage',close:22}]})),/date/i);
});

test('asset and disclosure timing cannot be reinterpreted by the treasury model', () => {
  assert.throws(() => buildTreasuryForecast(input({snapshot:snapshot({coin:'BTC'})})),/coin|asset/i);
  assert.throws(() => buildTreasuryForecast(input({snapshot:snapshot({publishedAt:'2026-05-30'})})),/publication|date/i);
});

test('finite operands that overflow financial arithmetic fail without returning nonfinite money', () => {
  assert.throws(() => treasuryResidual(state({coinUnits:1e308}),1e308),RangeError);
  assert.throws(() => issueCommon(state(),{newShares:1e308,offerPrice:1e308,coinPrice:100}),RangeError);
  assert.throws(() => issueCommon(state(),{newShares:1,offerPrice:10,coinPrice:100,feeRate:'0.02'}),RangeError);
  assert.throws(() => fundCashOutflow(state(),10,100,'0.005'),RangeError);
});

test('capacity-limited issuance buys only remaining units and conserves net funding', () => {
  const initial=state();
  const issued=issueCommon(initial,{newShares:100,offerPrice:10,coinPrice:100,feeRate:0.02,investmentFraction:0.9,maxCoinUnits:14});
  const sharesAdded=issued.shares-initial.shares;
  near(issued.coinUnits,14);
  near(sharesAdded,400/(10*0.98*0.9));
  near(issued.cashUsd,400/9);
  near((issued.coinUnits-initial.coinUnits)*100+issued.cashUsd-initial.cashUsd,sharesAdded*10*0.98);
  assert.ok(sharesAdded<100);
  const full=issueCommon(issued,{newShares:100,offerPrice:10,coinPrice:100,feeRate:0.02,investmentFraction:0.9,maxCoinUnits:14});
  assert.deepEqual(full,issued,'a full treasury must not dilute shareholders to fund nonexistent purchases');
});

test('long-horizon default paths remain within the stated supply or strategy limit', () => {
  for(const symbol of ['MSTR','BMNR']){
    const result=buildTreasuryForecast({symbol,history:[{date:'2026-10-23',close:symbol==='MSTR'?146.01:22.40}],scenario:'bull',endYear:2050});
    const cap=symbol==='MSTR'?21_000_000:6_105_000;
    assert.equal(result.assumptions.holdingPolicy.maxCoinUnits,cap);
    assert.ok(result.diagnostics.capacityReachedAt);
    for(const point of result.path)assert.ok(point.components.coinUnits<=cap,`${symbol} exceeds capacity on ${point.date}`);
  }
});

test('staking rewards above the strategy cap are realized as cash after explicit sale costs', () => {
  const initial=snapshot({coinUnits:6_105_000,cashUsd:1_000_000_000_000});
  const result=buildTreasuryForecast(input({snapshot:initial,scenario:'base',endYear:2035}));
  const last=result.path.at(-1),c=last.components;
  const years=(Date.parse(last.date)-Date.parse(result.asOf))/86400000/365.25;
  assert.ok(c.rewardsSold>0);
  near(c.coinUnits,6_105_000);
  near(c.capitalRaised,0);
  near(c.rewardSaleProceeds,c.rewardsSold*2000*0.995);
  near(c.cashUsd,initial.cashUsd+c.rewardSaleProceeds-50_000_000*years);
  near(c.coinsSold,c.rewardsSold);
});

test('an already impossible holding balance is rejected instead of normalized to a plausible share price', () => {
  assert.throws(()=>buildTreasuryForecast(input({snapshot:snapshot({coinUnits:6_105_001})})),/capacity/i);
});
