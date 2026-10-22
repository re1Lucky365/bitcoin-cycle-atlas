# Bitcoin issuance, market-cycle persistence, and volatility: research and implementation evidence

Research cutoff: 2026-10-22. Price fixture cutoff: 2026-10-20. This is a companion to the repository’s `docs/LONG_HORIZON_RESEARCH.md`; institutional target-price comparisons are maintained there. Primary sources were checked directly. Market opinions, historical measurements, protocol rules, and this app’s modeling choices are kept separate below.

## Findings that affect the chart

**No defensible exact calendar year for the end of Bitcoin’s four-year price pattern was established.** Bitcoin Core fixes the subsidy at a block height. It does not fix demand, the timing of monetary-policy shocks, investor positioning, or price turning points. Smaller issuance is a sound reason to question the future economic importance of miners’ incremental selling. It cannot identify a year in which a price pattern becomes invalid.

The strongest source comparison is the disagreement within Fidelity’s own published research. Fidelity Digital Assets (24 February 2026) argues that deeper markets and falling volatility make the old blow-off-top pattern less relevant. Fidelity’s retail education article (2 March 2026) observes that the large decline following the October 2025 high remains consistent with a traditional cycle. Neither proves continuation or a particular stopping date. This matters more than choosing one confident headline.

The app therefore extends its daily chart to the last year covered by a verified eligible source, currently **2050**, while explicitly classifying the result as conditional economic scenarios. It preserves the existing short-term engine as an optional input, does not manufacture additional periodic peaks, and separates source-imposed valuation references from a seeded illustrative price path. These choices make the uncertainty visible; they do not validate long-horizon forecasting accuracy.

## 1. Deterministic issuance arithmetic

The versioned Bitcoin Core v29.0 sources establish the following rules:

- `src/kernel/chainparams.cpp`: mainnet subsidy interval is 210,000 blocks; target block spacing is 600 seconds.
- `src/validation.cpp`, `GetBlockSubsidy`: the initial 50 BTC subsidy is an integer number of satoshis, right-shifted by `floor(height / 210000)`. The integer truncation matters for sufficiently small future rewards. The guard after 64 halvings avoids an undefined shift; the calculated subsidy already becomes zero after 33 shifts.

Primary sources: [Bitcoin Core subsidy calculation](https://raw.githubusercontent.com/bitcoin/bitcoin/v29.0/src/validation.cpp), [mainnet parameters](https://raw.githubusercontent.com/bitcoin/bitcoin/v29.0/src/kernel/chainparams.cpp).

For height \(h\), define subsidy in satoshis as

`subsidySats(h) = floor(5,000,000,000 / 2^floor(h/210,000))`.

Scheduled supply **before** height \(h\) is the sum of these integer block subsidies for blocks `0 ... h−1`. The code computes this epoch by epoch. All intermediate integer totals remain below JavaScript’s maximum exact integer. The theoretical total with satoshi truncation is 20,999,999.9769 BTC.

### Halving-epoch run rates

The future years are approximate, because actual block arrivals determine the calendar. Annual BTC below means the current reward multiplied by 144 expected blocks/day and 365.25 days/year. It is an annualized run rate, not the actual total mined in a calendar year containing a halving.

| Approximate epoch | Starting height | BTC per block | BTC per expected day | Scheduled BTC before starting block | Annualized new BTC | Annual issuance / starting supply |
|---|---:|---:|---:|---:|---:|---:|
| 2024 | 840,000 | 3.125 | 450 | 19,687,500 | 164,362.5 | 0.834857% |
| 2028 | 1,050,000 | 1.5625 | 225 | 20,343,750 | 82,181.25 | 0.403963% |
| 2032 | 1,260,000 | 0.78125 | 112.5 | 20,671,875 | 41,090.625 | 0.198776% |
| 2036 | 1,470,000 | 0.390625 | 56.25 | 20,835,937.5 | 20,545.3125 | 0.098605% |
| 2040 | 1,680,000 | 0.1953125 | 28.125 | 20,917,968.75 | 10,272.65625 | 0.049109% |

At these heights, the scheduled fractions of the conventional 21 million cap are respectively 93.75%, 96.875%, 98.4375%, 99.21875%, and 99.609375%. The approximately 0.1% issuance rate in the 2036 epoch is **not an empirically established price-cycle threshold**. Existing holders, ETFs, derivatives, and treasury firms can transfer or sell much larger inventories than newly issued coins.

### Calendar projection used by the app

For future dates the app anchors height 840,000 to the UTC day 2024-04-20 and projects 144 blocks per day. The halving occurred within that day; treating its day label as midnight is an explicit approximation. The table samples midnight on 31 December, rather than the close of that date. It consequently differs by one assumed day of rewards from a next-year January 1 computation.

| Projection date | Estimated height | Scheduled subsidy supply | Share of conventional 21m |
|---|---:|---:|---:|
| 2030-12-31 | 1,192,224 | 20,565,975 BTC | 97.933214% |
| 2040-12-31 | 1,718,256 | 20,925,440.625 BTC | 99.644955% |
| 2050-12-31 | 2,244,144 | 20,986,530.46802928 BTC | 99.935859% |

This is scheduled subsidy supply, **not available float or spendable circulating supply**. The ideal sum includes the genesis subsidy, and does not subtract unclaimed rewards, provably inaccessible outputs, or burns. Lost keys affect accessibility rather than changing the protocol reward schedule. Nothing in this calculation supplies a price floor.

## 2. Cross-check of cycle claims

| Primary source and date | What the source supports | What it does not establish |
|---|---|---|
| [Fidelity Digital Assets, “Is Bitcoin’s Four-Year Cycle Over?”](https://www.fidelitydigitalassets.com/research-and-insights/bitcoins-four-year-cycle-over), 2026-02-24 | One-year realized volatility registered 17 new lows in January 2026 shortly after the October 2025 price high. Larger market scale, deeper liquidity, and institutional participation may change the old boom-bust pattern. | No causal test identifies an expiry year. Lower measured volatility does not rule out a severe drawdown. |
| [Fidelity, “Bitcoin 4-year cycles explained”](https://www.fidelity.com/learning-center/trading-investing/four-year-bitcoin-and-crypto-cycles), 2026-03-02 | The approximately 52% drawdown by February 2026 can be read as evidence of continued cyclical behavior. Halvings, policy, and psychology are all relevant explanations. | The historical sequence is limited and irregular. The article does not guarantee continuation, a 77% decline, or the end of cycles. |
| [Coinbase Institutional, 2026 Crypto Market Outlook](https://www.coinbase.com/institutional/research-insights/research/market-intelligence/2026-crypto-market-outlook), 2025-12-19; report pp. 20–22 | Its discussion emphasizes that only four halvings have occurred, macro liquidity confounds comparisons, and miners’ incremental supply may be less important than institutional flows. | Four observations do not isolate halving causality. The institutional thesis is not proof of permanently low volatility. |
| [Virtonen, “Estimating the Impact of the Bitcoin Halving on Its Price Using Synthetic Control”](https://arxiv.org/abs/2511.05512), submitted 2025-10-25 | The abstract reports a positive 2024 effect after roughly three months, accounting for about one-fifth of the studied price change, while the 2020 estimate is not statistically significant and robust. | A preprint using synthetic controls cannot resolve all spillovers or counterfactual assumptions. Its abstract provides no exact expiry year. |
| [Molnar, “Bitcoin Runs on a Clock: Why Every Price Indicator Dies and the Halving Clock Doesn’t”](https://arxiv.org/abs/2607.26188), 2026-07-28 preprint | Retrospective timing rules find comparatively tight top timing in a small number of mature cycles and state a forward timing hypothesis. The paper also shows much less distinctive bottom alignment under its null. | Retrospective rule selection, very few cycles, and an ongoing 2026 forecast window prevent treating the rule as verified prospective performance. The 2026 bottom window had not ended as of this review. |
| [Copestake, Furceri, and Terracciano, “The Crypto Cycle and Institutional Investors”](https://copestake.info/workingpaper/cryptofinance/CryptoFinance.pdf), August 2026 author paper | Daily January 2018–March 2026 data yield a common crypto factor explaining 67% of price variance. Monetary-policy sensitivity is stronger when institutional participation and leverage are high. ETF access can link Bitcoin more closely to equity-market risk taking. | Institutional adoption does not mechanically remove leverage-driven downturns. Author findings are not an IMF institutional forecast; the paper explicitly says so. |

Coinbase’s [official PDF](https://downloads.ctfassets.net/k3n74unfin40/rmATDHYWNtdxmeLGypfqm/1ab64899b1133d1f7cccd28fdf4c5f4d/CB_CryptoMarketOutlook_2026.pdf) exceeded the web extraction tool’s size limit. Its cached official PDF pages were inspected; the landing page and source URL were verified. The remaining sources above were opened directly. The Molnar and Virtonen papers are explicitly marked preprints and do not set model prices or turning dates.

**Inference:** supply predictability and market maturation justify testing weaker halving influence, but neither implies smooth prices. A changing source of volatility—from marginal miner supply toward global risk appetite and leveraged institutional balance sheets—is compatible with continued major drawdowns.

## 3. Gold analogies and volatility

[World Gold Council, 16 April 2026](https://www.gold.org/goldhub/gold-focus/2026/04/you-asked-we-answered-has-golds-performance-structurally-changed) reports that gold’s annualized volatility has usually been between 10% and 18%, while 2026 volatility reached the upper tail of its long history. Its estimated roughly 1.6-month shock half-life concerns **gold’s historical volatility shocks**. It is not a Bitcoin convergence parameter or a guarantee of future gold behavior. The Council represents the gold industry; its underlying measurement is useful, while the asset-allocation interpretation warrants that context.

[iShares/BlackRock, updated 28 July 2025](https://www.ishares.com/us/insights/bitcoin-volatility-trends) describes declining Bitcoin volatility alongside a remaining large difference from conventional assets; its comparison gives Bitcoin volatility at 3.6 times gold and 5.1 times global equities for the cited historical measurement. This is a measured relative statistic with its own window, not a forecast ratio.

[State Street, 3 February 2026](https://www.ssga.com/us/en/intermediary/insights/bitcoin-volatility-and-liquidity-key-trends-for-investors) also describes falling longer-window volatility while emphasizing fat tails and materially larger historical Bitcoin drawdowns. [Wells Fargo Investment Institute, September 2026](https://www.wellsfargoadvisors.com/research-analysis/reports/digital-assets/bitcoin-inflation.htm) reports annualized daily volatility of 64% for Bitcoin and 16% for gold over January 2014–2 September 2026, and challenges a reliable inflation-hedge interpretation. These long-window values should not be substituted for recent 90-day volatility without relabeling the measurement period.

The defensible analogy is conditional: if Bitcoin becomes a much larger, more liquid store of value, its volatility could decline. Different demand bases, leverage, trading structure, and risk-off correlations mean it need not inherit gold’s volatility, return path, or portfolio behavior. Scarcity alone does not force a gold-like price-to-supply relationship.

## 4. Implemented long-horizon model and every non-estimated number

The code is `dist/long-horizon-forecast.js`. This is a model specification, not evidence that its outputs will occur.

### Horizon and economic reference curves

1. Filter the evidence registry to verified primary price scenarios published by `researchAsOf` and marked `chartEligible`.
2. Set the display endpoint to 31 December of the maximum covered target year. With the reviewed registry this is 2050. A newly verified later year automatically extends the chart. There is no N-year picker.
3. Use one coherent publisher’s internally comparable low/base/high cases for the structural curves: WisdomTree October 2025, 2030 prices $150,000/$275,000/$475,000 and 2050 prices $266,000/$710,000/$1,800,000. Other publishers remain visible comparison evidence rather than being averaged into a spurious consensus.
4. Log-interpolate from the last actual price to those valuations. The year-end placement is an app convention. Published target years do not specify that day or a price turning point.

The cases map to base, high, a geometric low/base blend, low, and a separate demand-failure case. The blend is an app calculation. Demand failure sets the structural reference to 60% of the current observed price at the first remaining milestone and 30% at the final milestone; if only one remains, 30% applies. Those fractions are analyst choices, neither institutional forecasts nor a worst-case bound. Event metadata labels mixed/stress references as analyst-derived. All economic cases use the same near-term timing and residual path, so economic labels do not silently change old cycle clocks.

### Temporary near-cycle contribution

When the existing short-term engine has a usable observed peak and historical context, the app uses its three-year deviation from its endpoint trend as a temporary component. That deviation is multiplied by

`w(t) = 2^(−elapsedYears / (210000 / 144 / 365.25))`.

The approximately 3.99-year half-life imitates declining issuance. It is **chosen, not estimated** as a price effect. The component returns to zero at the end of the existing near-term horizon, and the long model invents no additional scheduled cycle highs or lows. This modeling boundary must not be presented as proof that the market cycle ends in 2029. `cycleWeight` remains a hypothetical coefficient after that boundary; `cycleComponentActive` and `cycleDisplacement` disclose whether it actually contributes to the path.

The optional near model can be unavailable because of an expired clock, insufficient halving history, or no observed 20% peak decline. The long economic model still runs from a validated consecutive daily prefix; it records the missing near-phase reason instead of fabricating a reference peak.

**v1.9 timing update:** the near clock now accepts the daily observed-prefix calibration documented in [CYCLE_CALIBRATION_MODEL.md](CYCLE_CALIBRATION_MODEL.md). Its persistent 40% drawdown / 20% rebound criteria, 14-day confirmation, small-sample shrinkage and smoothing are disclosed modeling choices, not empirically validated optimal settings. The calibration shifts valid near-phase dates without changing published long-horizon valuation anchors. Each historical ribbon row uses only its own observed prefix. A new high, observed halving or gap resets the reference. The top-right countdown reads the resulting representative path, filters candidate runs below seven days, and reports the next sustained state as conditional. This is not a probability of a future market turn. Archived numerical example paths below predate this clock update and should not be read as current live results.

### Residual path and assumed volatility

Near-phase residuals retain the existing model’s historical sampling; the later segment samples consecutive blocks from the latest 1,461 actual daily returns known by the selected price cutoff. The default later block length is 28 days. Block provenance records source dates and target dates. Source blocks may overlap and are not independent observations.

The assumed annualized innovation volatility is

`sigma(t) = 20% + (recent 90-day annualized volatility − 20%) × 2^(−elapsedYears / 8)`.

The default 20% long-run level is an analyst assumption motivated by possible maturation, deliberately not described as historical gold volatility. The eight-year half-life is also an analyst choice. Neither is fitted or supported as a point forecast by the cited papers. Changing the volatility multiplier changes the corresponding scale and disclosures.

After the optional near phase, log-price residuals follow

`R[t] = exp(−ln(2)/730) × R[t−1] + normalized historical block return × sigma(t)/sqrt(365)`.

The 730-day residual half-life limits unbounded accumulation of a single illustrative random path around the economic curve. It is not an empirically estimated Bitcoin equilibrium speed. No residual is pinned to zero at a source date or endpoint. No future price floor or cap is applied.

The selected structural curve times `exp(cycleDisplacement + residual)` gives the representative price. Low and high structural cases share the same displacement; the plotted range is therefore a range of economic assumptions along one illustrative residual path, **not a confidence interval, sample quantile, or exhaustive set of possible futures**. Outcomes can lie outside it; permanent demand loss and total loss are not excluded by a positive low-adoption case. The explicit stress case makes one adverse assumption inspectable without claiming to cover every failure.

`annualizedVolatilityPct` is the assumed innovation scale. `realizedVolPct` is separately calculated from the generated path. Their distinction is retained in annual summaries. Existing near-model backtests do not validate the new long-range valuation and volatility assumptions.

## 5. Reproducible observed output and verification

Using `tests/fixtures/btc-daily-2026-10-20.json`, seed 20261022, default near ensemble size 128, and the base economic case:

| Year-end | Structural base reference | One illustrative path | Economic range with shared residual | Assumed annualized innovation volatility |
|---|---:|---:|---:|---:|
| 2030 | $275,000 | $245,208.93 | $133,750.33–$423,542.70 | 32.43198% |
| 2035 | $348,578.03 | $368,995.18 | $183,231.87–$701,518.65 | 28.06162% |
| 2040 | $441,899.71 | $624,328.50 | $282,223.33–$1,306,508.08 | 25.22638% |
| 2050 | $710,000 | $824,257.66 | $308,806.39–$2,089,667.31 | 22.19768% |

These values are implementation output, not an additional independent forecast source. The path contains 8,839 daily points from 2026-10-20 through 2050-12-31, starting exactly at the observed $82,898.9101560549. Its minimum is $76,149.23 and maximum $935,732.13; the largest decline from a preceding modeled high is 57.20%. Those dates and values are contingent on the illustrative seed and assumptions. The display does not identify a most-likely turning date.

Verification command:

```sh
node --test --test-isolation=none tests/long-horizon-forecast.test.mjs
```

Twelve behavior tests pass. They cover daily continuity; exact latest-price anchoring; finite ordered bounds across all five economic cases; no forced terminal prices; source-value attribution; common residuals and timing across economic cases; automatic extension to a newly verified later source year; exclusion of unverified/future-published evidence; fixed-price-cutoff immunity to future appended or altered observations; historical block provenance; deterministic reproducibility; explicit demand-loss behavior; absence of an empirical cycle-expiry claim; recomputed turning points from the actual displayed path; partial weekly edges; graceful optional near-model unavailability; integer subsidy/supply arithmetic; and explicit failure for invalid daily history.

The tests establish implementation behavior and arithmetic. They cannot establish future forecast accuracy. The tested 16-path fast near ensemble has a different selected near representative than the default 128-path setting, so its illustrative 2030 value must not be mislabeled as the default chart result.
