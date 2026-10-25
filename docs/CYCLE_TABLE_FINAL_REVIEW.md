# Cycle table independent review — v1.24

## Final replay status

**PASS — the three initial findings were corrected and their public-controller repros passed on 2026-10-25.** The portable replay is now [scripts/verify-cycle-table-integration.mjs](../scripts/verify-cycle-table-integration.mjs), with the complete result and exact source/fixture/verifier hashes preserved in [cycle-table-integration-verification.json](data/cycle-table-integration-verification.json). All ten named integration checks passed, and the covered files remained unchanged while the replay ran.

```sh
node scripts/verify-cycle-table-integration.mjs
```

The script resolves the repository relative to its own module, accepts an optional checkout path, and does not read `.git` internals or require subprocesses or network access. It checks every model row produced by the bundled data, rather than hardcoding the current row count so that routine observed-data refreshes remain possible. This saved result uses Node `v24.22.1` and the 5,942-record observed dataset ending `2026-10-23`.

| Initial finding | Correction verified by the final replay |
| --- | --- |
| Selected historical cycle omitted its closing low | Every source cycle retains its chart's closing low. In particular, `peak-2021` now includes `2022-11-09`; one shared row carries both cycle memberships. |
| Historical and future sideways periods were absent | The current base model has 39 observed sideways periods and 34 conditional periods, plus the current observation. The view's core/detail filter uses the same model; it does not invent another path. |
| Old scenario rows could focus the new scenario when dates coincided | Saved base conditional rows are rejected under all four alternative scenarios; every valid row of the active scenario remains selectable. |

All **103 base rows** focus successfully. `accelerated`, `wait`, `late`, and `stress` respectively produce **96, 103, 99, and 97** rows; every row is accepted by its active controller, observed rows remain identical, and no saved base-scenario conditional row is accepted after the switch. Repeated `getCycleContext` calls preserve the exact cached dataset, forecast, and milestone identities.

The view creates **one semantic table** and does not recreate the retired indicator interface. A throwing shared-context getter removes old rows, disables export and stale selections, and clears the previous scenario. Recovery restores the rows without an old error title. These checks run actual exported `initLabView`, `getCycleContext`, `focusCycleRow`, `buildCycleDecisionTable`, `cycleTableRows`, and `initDailyDataView` behavior.

The shared structure fixture now explicitly supplies `queueMicrotask`, the browser global used by the focus/inspection boundary. The persisted replay imports that fixture normally. It does not rewrite the fixture into a temporary data URL or replace production function bodies. The fixture still substitutes inert browser mounts and instruments existing import bindings, as documented in its source.

### Final source correspondence

| File | SHA-256 |
| --- | --- |
| `dist/lab-view.js` | `f80c539dd1d24893169913466fc5dd090827d4ae7b2c21f7902785b34fe814c4` |
| `dist/cycle-decision.js` | `7dad7868a73f43aaea1ca656bf9223a7a4fdabe1d88da75b6d2b59be12ebb0a9` |
| `dist/daily-data-view.js` | `c2b345ca88aa3b91046a36dbcdad11a0e101f84dcf3d890a9b4afec8769becab` |
| `dist/daily-data.css` | `9c22c452c760a6d9796bc2a9a06a89ee64d96b7219bf5c7754e2979e6f578da1` |
| `scripts/verify-cycle-table-integration.mjs` | `ac8ba00c07e68b1dc7bf60fc2c6d2f2f5ba5b9c5306844c6421bcb886786875f` |
| `tests/helpers/structure-view-fixture.mjs` | `ba63460e91024ae1682e5474e58f3299a2a106c9b37686dd7686042b652bf691` |

### Boundary and companion evidence

This is a controller-contract and generated-markup replay through an **inert DOM boundary**. It does not certify painted layout, mobile clipping, touch interaction, focus visibility, browser timing, or the actual published deployment. The root task records real-browser verification separately. The prior-scenario finding remains limited to the public method contract; the initial review did not demonstrate a normal visible UI route to stale rows.

The new episode arithmetic and provenance properties are covered separately by the actual-function finite checker and its negative controls in [CYCLE_TABLE_VERIFICATION.md](CYCLE_TABLE_VERIFICATION.md). The replay does not replace those checks or prove market forecasts, strategy profitability, or unrestricted-input correctness. The JSON hashes identify the checked source snapshot independently of any later documentation-only commit.

The remainder of this document preserves the initial findings, commands, and source hashes as historical evidence. Its initial `ISSUES` status and pending-gate wording describe the earlier snapshot; the final replay result above supersedes them for the corrected integration behavior.

## Initial review snapshot — preserved history

**ISSUES — initial independent review, 2026-10-25.** The decision engine's finite verification and the focused existing tests pass. The review found two completeness/integration defects and one narrower public-controller contract defect. Corrections were assigned after these findings; this document does **not** certify those later edits until the repros are rerun against their new hashes.

- Repository: `bitcoin-cycle-atlas`.
- Branch: `improve/single-cycle-table`.
- Baseline and exact HEAD: `3a1be8370a9fd9a71861be3f929493370f08a5ef`.
- Reviewed change state: uncommitted v1.24 worktree additions and modifications.
- Runtime: Node `v24.22.1`.
- Bundled observed-data cutoff: `2026-10-23`, 5,942 daily records.
- No product files were changed by this review. The permitted report and a temporary read-only replay probe were written. No publication or external mutation occurred.

The root task owns real-browser visual checks. This review uses actual exported model and controller methods with the project's existing inert DOM boundary. It verifies behavior at that boundary and generated markup, not geometry, touch interaction, painted colors, or focus visibility.

## Initial findings — corrected and replayed above

### P2 — A selected historical cycle omits its closing low and the corresponding decline

**Location in the reviewed snapshot:** `dist/cycle-decision.js`, `owners` assignment around lines 131–136; `dist/daily-data-view.js`, the exact-cycle filter at line 28.

The source chart shares a low between the cycle it closes and the cycle it opens. The table assigns that row to one `cycleId`, with the next cycle overriding the previous owner. Filtering on the previous cycle therefore hides its final low even though the chart's cycle contains it.

**Visible repro:** open the data page, select `2021년 사이클` in the display-range selector, and inspect the last displayed milestone. The table ends at the `2021-11-08` high. The source `peak-2021` cycle ends at the `2022-11-09` low, and the omitted row is the `2021-11-08 → 2022-11-09` decline. The row exists in the full table but is assigned exclusively to `peak-2025`.

| Selected cycle | Source chart's closing low | Table's last date | Closing low included? |
| --- | --- | --- | --- |
| `peak-2011` | 2011-11-18 | 2011-06-08 | No |
| `peak-2013` | 2015-01-14 | 2013-12-04 | No |
| `peak-2017` | 2018-12-15 | 2017-12-16 | No |
| `peak-2021` | 2022-11-09 | 2021-11-08 | No |
| `peak-2025` | 2026-06-30 | 2026-06-30 | Yes |

This is an omission of the selected source cycle, not an arithmetic error. The one-table design does not require duplicate rows in the full list: retain a deduplicated row with membership in both source cycles, then filter by membership. The corrected public repro should include each source cycle's `next-bottom` row.

### P2 — Historical and future sideways periods are absent

**Location in the reviewed snapshot:** `dist/cycle-decision.js`, `checkpointAction`, `currentObservation`, and the row assembly at lines 165–175.

`currentObservation` is the only path that can produce the `sideways` action. Every historical or conditional milestone receives a buy/sell review stage. On the bundled base scenario, the complete table contains 30 rows and exactly one sideways row, `current:2026-10-23`; historical sideways rows and conditional sideways rows are both zero. The recent filter contains 11 rows.

This does not satisfy the requested historical/future low–sideways–high period coverage. It is not caused by an absence of qualifying price windows. An independent scan of the bundled data using the documented 28-consecutive-close, 12% range, and ±6% net-change rule finds historical qualifying runs, including `2025-08-01 → 2025-08-24`; a scan of the selected future path also finds runs, including qualifying endpoints `2026-12-30 → 2027-01-06`.

An appropriate correction must define the displayed interval and any minimum qualifying-run length explicitly, distinguish observed from conditional episodes, and avoid relabeling arbitrary waiting periods as sideways. A recent/future view also needs a bounded future scope: the underlying long-horizon forecast path extends much farther than the selected cycle, so inserting every distant conditional run would overwhelm the table. Conditional episodes must continue to have no realized return or realized MDD.

The requested review strength stages remain priorities at retrospective or conditional checkpoints. Their existence is not evidence that a strategy predicts profitable trades.

### P3 — Public `focusCycleRow` accepts rows from an old scenario when marker dates coincide

**Location in the reviewed snapshot:** `dist/lab-view.js`, `focusCycleRow`, especially lines 219–224.

The method's comment promises to ignore previous-scenario selections, but the guard checks only whether the last marker ID exists. Marker IDs contain type, price provenance, and date; they do not uniquely identify a scenario or its price. Different scenarios can retain a marker date while changing its price.

**Public-controller repro:** obtain the base context through `getCycleContext`, build its decision rows, change the actual controller to `accelerated`, and call `focusCycleRow` with a saved base-scenario row. Three of the four old conditional rows are accepted:

| Marker | Saved base price | Active accelerated price |
| --- | ---: | ---: |
| Mid-top, 2027-05-30 | 99,804.27426650951 | 107,925.56499899653 |
| Cycle top, 2029-03-28 | 240,756.6989696531 | 330,510.8005425067 |
| Bottom, 2029-08-21 | 166,513.72302552857 | 240,828.25219014194 |

Two old rows are also accepted under `wait`, one under `late`, and none under `stress`.

**Severity limit:** a normal visible UI route to a stale row was not demonstrated. Current navigation rerenders the table when it becomes visible, and the actual view's failure paths clear stale rows. This finding concerns the newly exposed controller's promised ownership guard. It should not be reported as proof that ordinary users currently see mixed-scenario rows.

The corrected method should validate conditional scenario identity and relevant row endpoints/prices before mutating chart state. Fresh valid rows must remain selectable in every scenario; observed rows should remain scenario-independent.

## Initial passed checks and implementation correspondence

The reviewed decision module hash matches the project-local `verify-cycle-decision` skill's synchronized source hash exactly. The engine consumes supplied chart milestones and the supplied selected forecast. It does not fit a second forecast. Its observed cutoff, observed-marker prices, future-path prices, forecast anchor, and scenario-selected observed roles are validated before rows are returned.

The public controller probe confirms that repeated `getCycleContext` calls return the same cached forecast and milestone objects and the same dataset/prices supplied through `setDataset`. All 30 valid base rows are accepted by `focusCycleRow`. All valid rows are also accepted after switching to `accelerated`, `wait`, `late`, and `stress`; observed rows remain identical across those scenarios.

The actual table controller creates exactly one semantic `<table>` with five columns. The generated frame uses `사이클 판단표`; its frame and method content do not reintroduce the removed SMA50, SMA200, or RSI14 interface. Method content does not add a second table. The entry module and stylesheet references are versioned to v1.24.

The integration initializes the lab controller before the table and calls `setDataset` before rendering the table on a data-page update. The row callback focuses the lab selection before switching the page. The data view obtains its dataset, selected forecast, and milestones through the lab-owned context.

The actual view controller fails closed for a missing, mismatched, or throwing shared context: old judgments are removed, the export is disabled, old row selections have no effect, and the selected-scenario label is cleared. A subsequent valid context restores rows without retaining the old error title. The public replay reproduces the throwing-context path; the focused existing view tests cover the missing and misaligned variants as well.

CSS was inspected for the actual changed layout: the data workspace inherits column layout from `viewport.css`, `[hidden]` remains authoritative, the table uses an internal overflow region, and the small-screen rules retain a sticky date column. These are code-level observations; the root browser pass must determine actual clipping and usability.

## Initial commands and results

| Command/check | Result |
| --- | --- |
| `node --version` | `v24.22.1` |
| `git rev-parse HEAD` | `3a1be8370a9fd9a71861be3f929493370f08a5ef` |
| `git branch --show-current` | `improve/single-cycle-table` |
| `node scripts/verify-cycle-decision.mjs` | **PASS**, exit 0; exact source hash below |
| `node --test tests/cycle-decision.test.mjs tests/daily-data-view.test.mjs tests/daily-data-performance.test.mjs tests/daily-analytics.test.mjs tests/cycle-milestones.test.mjs tests/cycle-selection.test.mjs` | **PASS**, exit 0; six test-file subprocesses passed, zero failed |
| Public controller replay, `node /tmp/cycle-table-final-review-probe.mjs` | **ISSUES**, exit 1; seven named checks passed and the three findings above reproduced; source hashes unchanged during execution |

The finite decision verification covered all 1,089 length-2…6 price paths over three price levels; 81 intervals with outside prices excluded; 36 current-window cases; 33 past cutoffs; 12 conditional-provenance rows; four provisional-strength combinations; and six rejected mismatches. All nine named negative controls were detected: unordered MDD, prior-history scope leakage, missing-days-as-sideways, future observations in a past cutoff, scenario promotion to history, fictional realized zero values, unconditional strong stages, changed observed price acceptance, and changed scenario price acceptance. The production source passed again after the mutation controls.

The replay probe uses the real exported `initLabView`, `getCycleContext`, `focusCycleRow`, `buildCycleDecisionTable`, `cycleTableRows`, and `initDailyDataView`. It supplies the missing `queueMicrotask` browser global to the existing structure fixture in memory; product function bodies are not replaced. Its first setup attempt exposed that missing fixture global, and an initial diagnostic treated object-shaped forecast prices as arrays; both were corrected in the diagnostic boundary. Neither setup error was counted as a product defect. A subprocess call to read git state was also unavailable in this sandbox, so the final probe reads the local git ref files directly and uses no subprocesses or network.

The temporary replay probe is not part of the release or committed tests. The root task may rerun it after corrections and record the new status/hashes here. Its source-stability check deliberately reports an issue if another agent modifies a covered source while it is running.

## Initial reviewed SHA-256 values

| File | SHA-256 |
| --- | --- |
| `dist/app.js` | `25ea5ec567ff943642903b898b9975826d79410453777da6bdb4bcd011bc1966` |
| `dist/lab-view.js` | `e4089e350aab9e5c4d634f47f5914ab0df51b3695c8e157fe9cfdf11b01d4d09` |
| `dist/cycle-decision.js` | `f8c069fa0cbceaf3229487a385329d2a27bebddadaf47d02da387b7c377944eb` |
| `dist/daily-data-view.js` | `0697c28b4410d1771c5e13d7c72d58a1e831c1adf8d50addb250d3e0fb718275` |
| `dist/daily-data.css` | `ff616d1cb8c45de033e9674d891724103e7efcc46a7c7563b68a99111ae0f1b3` |
| `dist/daily-analytics.js` | `f79103b4116d3322cfde2a52515428a391032f91e211e45df9e953aef4a650c2` |
| `dist/index.html` | `5deec822d8e4b885deeb074e7bdad0d1197883e7cfa672b773a917caabce0ca0` |
| `dist/site-entry.js` | `2173878085900cb0c613bf989e27f5274ec83570031bc5ffefe1f79e405b55f7` |
| `dist/cycle-milestones.js` | `d69400b38c4206d04df879fa3a619046a88a6a9aa8d5eeaf2b94c4990970e9b8` |
| `dist/long-horizon-forecast.js` | `fcedcfa438b56136a3910e258a6473d5a3d4fb20b99cab8a22a4cb1a4b77e02c` |
| `dist/data/btc-daily.json` | `ba002ee272c8b8f6fe2111e32df85080b3352756d1f46ba11d5dffa5c4ab5bf2` |
| `scripts/verify-cycle-decision.mjs` | `b84ebe1ee425ddc7a53f5c886bd959055eb07625f86f60ccb14c9e0910efe4ba` |
| `tests/daily-data-view.test.mjs` | `217a6d8311694e01d353fcb309a7caba1287aafa231ea273e4219e8ceb0d3171` |
| `tests/helpers/structure-view-fixture.mjs` | `5984518c3b4ddf2cb27ece9f197509dea16bb7092d757663ab324c1a2a283c77` |
| `.agents/skills/verify-cycle-decision/SKILL.md` | `35455f2f5105ccb866447b3b15e885553e40921a6f60ad0715caf7a0f77eaf11` |

## Initial scope limits and follow-up gate

There is no blocked executable check in this scoped review. Real-browser verification is assigned separately. The observed-data file was read as a repository artifact; its prices were not independently fetched or certified against the market in this review.

Finite executable verification establishes the stated implementation properties only within its checked bounds. It does not establish forecast accuracy, probability calibration, profitable trading signals, suitability of any position, intraday drawdown, or unrestricted-input correctness. The 28-close/12%/6% rule is an explicit descriptive operating rule, and any new run-length rule needs equally explicit labeling.

After corrections, rerun the public replay, the focused tests, and the cycle-decision verification against the changed source. New sideways episodes introduce a new correspondence surface: observe/assumption classification, displayed interval boundaries, causal window/run definition, and no realized metrics on future episodes must be covered before advancing the verification skill's synchronized record. A clean replay of these initial repros alone does not verify every new episode calculation.
