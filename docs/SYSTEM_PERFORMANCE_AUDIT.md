# Treasury calculation and chart performance audit

The isolated performance change reduces the measured MSTR calculation and initial SVG generation time by **25.0%**. The median is **933.31 ms before and 699.94 ms after**. Every financial output field and generated SVG string is identical in this comparison. These are Node computation measurements, not browser input or paint timings.

The baseline is `347997f02d3674259d4ad6e1f788419bde4811bd`. The local implementation commit is `7f84ac0a142ebb242093626f5a61c7652ed3360b`. The [measurement JSON](data/treasury-performance-2026-10-24.json) records all source hashes, inputs and samples. The [isolated production patch](data/treasury-performance-isolated.patch) preserves the exact measured change even when a later audit commit also changes financial behavior.

## Runtime and ownership

`buildTreasuryProjection` receives the observed equity archive and the relevant crypto archive. It builds three daily asset paths, then runs each financial condition. MSTR maps its conditions to BTC stress, base and accelerated. Each default equity path contains 3,357 daily rows through 2035. The BTC source engine still builds its full 8,836-row path through 2050.

The previous MSTR caller ran `buildLongHorizonForecast` three times. Each call repeated the same source validation, cycle calibration and 128-sample base near-phase ensemble. The selected economic condition changes the later price calculation. It does not change that preparation. The initial profile attributes 1,351 ms of 3,411 sampled projection milliseconds to those repeated detailed-forecast calls across three complete projections.

The new `buildLongHorizonForecasts` prepares the input once per invocation. The existing scalar function uses the same private preparation and projection functions. Each output receives its own copies of near-phase, calibration and evidence metadata. Editing one returned condition cannot change another. There is no cross-call price or fitted-model cache.

Two designs were considered. A global memo would require an invalidation rule for revised observations, options and source vintages. An explicit batch has a lifetime bounded by one call and revalidates a later revision, including a changed price at the same cutoff. The batch was chosen for that reason.

## The renderer repeated work outside the viewport

The renderer validated every date using `Date.parse` and an ISO conversion on every redraw. The separate renderer profile attributes 293 of 466 sampled redraw milliseconds to that date conversion across 100 redraws. It also scanned the complete future path for visible windows, zero transitions and every evidence marker.

The renderer now uses the existing bounded `utcDay` calendar cache. Only immutable calendar labels are cached. Prices, scenario bounds and chronological order are validated on each call. Visible windows and marker searches use the existing binary-search helpers. A new render-result cache was rejected because it would add another invalidation contract without being necessary for this measured improvement.

## Measurements

Both sides use Node 24.22.1, the same saved BTC and MSTR archives, cutoff 2026-10-23, seed 20261022, and the unchanged 128-sample source ensemble. Each side has two warmups and seven measured samples. Every pair runs before then after. The shared host reports nine logical CPUs and load averages of 0.48, 0.37, 0.21 before and 0.67, 0.42, 0.22 after. Timing is descriptive and is not a CI threshold.

| Measured operation | Before median and range | After median and range |
|---|---:|---:|
| Three MSTR financial conditions and initial 1280×720 SVG | 933.31 ms; 845.17–1,066.70 | 699.94 ms; 602.44–740.05 |
| Financial and asset calculation within that operation | 923.70 ms; 835.74–1,057.65 | 696.18 ms; 599.18–735.04 |
| Twenty successive 90-day future viewport redraws | 97.11 ms; 89.07–99.65 | 12.74 ms; 12.37–17.65 |

The redraw result applies to the separate twenty-draw workload, not to initial application loading. The initial SVG accounts for a small part of the complete calculation. Removing only that work could not explain the overall 25.0% improvement. The profile identifies the removed duplicate preparation as the larger contributor. After the change, scenario-specific rolling states, long-horizon prices and financial accounting still run separately and remain the main cost.

There are seven successful measured samples per side for each workload, with zero failed samples. Each full calculation produces all 10,071 daily financial rows. The harness consumes each result and checks complete deep equality, output hashes, selected observed values, visible point counts and invalid markup. It checks all twenty redraw strings. Hashing and assertions occur outside the measured region.

Module loading, file parsing, network transfer, actual DOM construction, style calculation, layout, paint and input latency are outside this timing. This audit does not establish a browser or mobile speedup percentage. Profiling runs are separate from benchmark runs. Their overlapping inclusive stack times must not be added or treated as uninstrumented wall time.

## Output and complexity checks

The [BTC parity result](data/btc-batch-parity-2026-10-24.json) compares every field of all five BTC economic conditions with the original baseline implementation, using the default 128-sample source ensemble through 2050. Both the scalar and batch outputs pass strict deep equality. This is preservation of model output, not evidence that the price predictions are accurate.

Eight relevant test files pass. The two new files add five batch-contract cases and three renderer cases. The renderer test compares 432 combinations of anchor presence, scale, position and span with the retained linear boundary oracle. It also covers zero-width windows, exact observations, missing-day interpolation, positive-to-zero transitions and corrected prices on an existing object.

The bounded-search test checks paths with 1,024, 16,384 and 65,536 rows. A nine-row viewport, its zero transitions and one evidence marker stay within a logarithmic search plus visible-row read budget. This bound applies to those lookup helpers. Full path validation remains linear in the number of future rows. Full-window drawing remains linear in visible data. The change does not make the entire chart constant time.

## Reproduction

Use separate worktrees to reproduce the isolated comparison after later accounting changes. The patch contains only the three measured production modules.

```sh
git worktree add --detach build/perf-before 347997f02d3674259d4ad6e1f788419bde4811bd
git worktree add --detach build/perf-after 347997f02d3674259d4ad6e1f788419bde4811bd
git -C build/perf-after apply ../../docs/data/treasury-performance-isolated.patch
node scripts/benchmark-treasury-performance.mjs --before build/perf-before --after build/perf-after --samples 7 --before-revision 347997f02d3674259d4ad6e1f788419bde4811bd --after-revision isolated-patch
node --test tests/long-horizon-batch.test.mjs tests/equity-forecast-performance.test.mjs
```

The [profile index](data/treasury-performance-profiles-2026-10-24.json) records stage, workload counts and hashes for three raw V8 CPU profiles. The first profile covers three baseline projections. The second covers one batch projection and 100 redraws before the renderer change. The third covers three final projections and 100 final redraws. The intermediate profile is used only to diagnose the unchanged old renderer.

The pstack `benchmark-checklist`, `how`, `principle-explain-the-number`, `principle-fix-root-causes` and `principle-subtract-before-you-add` guided the measured changes. The available GPT-6 Astra agent performed this slice. It did not execute a Grok or Opus model. The coordinator independently reviewed the code before integration.
