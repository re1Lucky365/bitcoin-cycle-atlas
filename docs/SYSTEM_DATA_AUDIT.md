# Source and startup data audit

Reviewed baseline: `347997f02d3674259d4ad6e1f788419bde4811bd`.
Review date: 2026-10-24. Counterexamples use temporary synthetic provider responses; published observations are unchanged.

## Previously observed equity sessions could disappear

`refreshEquityFile` compared only the first date, last date and row count before replacing a full split-adjusted history. Starting with October 21, 22 and 23, a response containing October 21, 23 and 26 passed every check and erased October 22. Appending more new sessions also hid the omission.

The refresh now requires every previously observed timestamp to occur in the new full response before writing. The file remains byte-for-byte unchanged on failure. A complete replacement may still revise every OHLC price after a stock split. Merging old prices into the new response was rejected because it would mix adjustment vintages.

Regression cases exercise equal and larger row counts with missing interior sessions, plus a complete four-session replacement with all prices halved. They run through the real parser and atomic file writer.

## Missing BTC days crossed the manual-refresh boundary

`validateFullSeries` checked coverage size and four halving dates, but an ordinary missing day passed. Deleting October 20, 2026 from the baseline produced 5,941 accepted observations. The long-horizon engine then rejected that same dataset because historical daily-return blocks require consecutive observations. The manual refresh assigned and cached the dataset before rendering, so validation happened too late.

The common full-series boundary now rejects every missing interior UTC day. The published-data and scheduled-refresh callers use this single continuity check. The manual-fetch regression returns HTTP 200 with an omitted ordinary day and must reject before constructing a usable refresh dataset. The general comparison-only `validateDataset` still supports gaps and does not invent observations.

Startup now applies the existing full published-snapshot validator to the bundled file and optional browser cache. A newer last date and equal row count no longer admit a cached dataset with a hidden gap. Invalid cached data leaves the verified bundle selected; an older source revision cannot replace a newer bundle. These cache cases exercise the shared public validation boundary, and the actual startup caller was inspected. They do not replay complete BTC DOM initialization with a corrupt browser cache. The final deployed-browser check covers normal initialization separately.

## Reproduce

```sh
node tests/equity-market-data.test.mjs
node tests/data-source.test.mjs
node tests/published-data.test.mjs
node tests/refresh-data.test.mjs
node tests/cycle-calibration-pipeline.test.mjs
```

These checks protect source completeness and admission. They do not establish that a provider's prices are economically correct, that two venues agree, or that financial forecasts predict future returns.
