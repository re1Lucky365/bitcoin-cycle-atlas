---
name: verify-cycle-decision
description: Verify cycle-table provenance, displayed-period MDD, causal observed and future sideways episodes, shared cycle membership, and provisional strength guards in Bitcoin Cycle Atlas. Use when changing cycle-decision.js, chart-point or period contracts, sideways criteria, future bounds, or the verification script.
---

# Verify cycle decision boundaries

Keep the promise: **the table never turns future assumptions into realized results, and its MDD stays within the displayed period in time order.** Keep a period's first qualifying date separate from the date its minimum duration becomes knowable. Preserve both source cycles when a bottom is shared.

## Coverage and synchronization

- Covered code: `dist/cycle-decision.js`, specifically `buildCycleDecisionTable`, `makeRow`, `observedRisk`, `checkpointAction`, `currentObservation`, `sidewaysRuns`, and `rangeRow`.
- Integration contract: chart marker IDs, endpoint prices and cutoff must match the supplied selected `buildCycleMilestones` result and forecast.
- Reviewed committed implementation: `8039187b6e2505f306f16b7baf52ccf99e574e39` on 2026-10-25, verified again after fetching the published commit with `npm run verify:cycle-table`. Covered module SHA-256: `7dad7868a73f43aaea1ca656bf9223a7a4fdabe1d88da75b6d2b59be12ebb0a9`. Reviewed runtime: Node `v24.22.1`. The runner prints the current hash; a different hash requires correspondence review before advancing this record.
- Verification: `scripts/verify-cycle-decision.mjs`. Detailed bounds and findings: `docs/CYCLE_TABLE_VERIFICATION.md`. The state diagram in `docs/formal-cycle-table/provenance.mmd` documents actual classification branches; it is not a TLA+ proof.

## Run

Use Node 24 or later from the repository root:

```sh
node scripts/verify-cycle-decision.mjs
```

Expect PASS with the original 1,089 exhaustive short price paths, 81 scoped intervals, 36 current-window cases, 33 past cutoffs, 12 conditional provenance rows, four provisional-strength combinations, and six rejected mismatches. Also require 53 observed-episode inputs, 66 missing-date positions, 17 episode cutoff prefixes, 48 future-episode inputs, 17 explicit/absent/unavailable horizon cases, eight future or warm-up gaps, and five shared-cycle membership cases. Require **27 detected negative controls**, including all nine original controls.

Call the actual exported function for every check. Keep independent MDD enumeration over all ordered price pairs. Keep the episode oracle's explicit UTC date grid and all-pairs width comparison separate from the production rolling-window implementation. Treat the long episode fixtures as bounded cases, not exhaustive coverage of all long price paths.

The runner mutates a memory copy of the source one change at a time and imports each copy with the unchanged dependency. Each mutation must produce the expected public-output or input-rejection failure. Production source is rerun after the negative controls. No product file is edited and no forecast is published.

## Review a change

1. Compare the covered code to the recorded source hash and review commit. Trace the observed cutoff, marker price identity, selection provenance, interval endpoints, and every condition that permits a strong review stage.
2. Keep price provenance and role provenance distinct. A real observed price selected only by the future scenario still has a conditional role. Keep its performance fields empty and do not omit the point from both categories.
3. Preserve the period contract: `phaseId: range`, `action.scope: period`, 28 consecutive closes, width at most 12%, absolute endpoint change at most 6%, and at least seven consecutive qualifying END observations. Start at the first qualifying end date; record the seventh in `minimumRunKnownAt`. Keep the lookback start in separate metadata and keep realized MDD inside the displayed period.
4. Split observed and future runs at the cutoff, applying the seven-observation minimum independently. Permit at most 27 observed warm-up closes for a future run. Require the selected path, `futureStatus.available === true`, and explicit `futureStatus.through`; never infer a chart horizon from arbitrary path length. Keep mixed/future period performance null and preserve a supplied `scenarioId` on both period and checkpoint rows.
5. Check missing-day resets and `rightCensored`: the end is unconfirmed when data ends or a day is missing; a known nonqualifying close can confirm termination. Preserve every source `cycleIds` membership at shared bottoms and overlapping periods without duplicating a factual checkpoint. Do not apply the seven-observation period minimum to the separate current-date classification.
6. Preserve the independent oracles. Never replace ordered-pair or calendar-grid enumeration with the production algorithm or make expected values by reading the result being checked.
7. Run the command and inspect every named mutation result. A stale selector, import failure, unrelated failure, or unexecuted test is BLOCKED rather than passed. If an intended source change moves a guard, update the mutation to break that real guard and require its specific expected assertion again.
8. Reproduce a new counterexample through `buildCycleDecisionTable`. Correct the product or the mistaken correspondence; do not weaken the invariant to make the result green. Confirm that the final unchanged production rerun passes after all controls.
9. Move the synchronization commit and source hash forward only after verifying the committed code, rerunning the checks, and confirming the state diagram still describes the branches. Validate this skill with the skill-creator `quick_validate.py` after editing it and persist the project skill with its repository commit.

## Report

State PASS, ISSUES, or BLOCKED explicitly. Include the exact command, source hash, Node version, case counts, and detected/expected control count. Identify an actual counterexample or blocked correspondence by its assertion and fixture. Explain that the method is bounded executable verification of real JavaScript; do not describe it as market-forecast proof, an unbounded theorem, or TLA+ model checking. Keep the state diagram about data classification and recomputation, without imposing a buy-to-sell market sequence.

## Interpretation

This is finite executable verification on the real JavaScript implementation. It does not prove unrestricted inputs, forecasts, profitable trading, the statistical validity of 28/12/6/seven-observation thresholds, intraday losses, portfolio suitability, browser rendering or chart data quality. Strong stages are review-priority annotations at a retrospective or conditional checkpoint. They are not probability estimates or order instructions.

For unrelated changes that did not recheck this area, use pstack `maintain-formal-verification-skill` to assess drift before treating this record as current. Use pstack `statechart` if a future asynchronous design is modeled in TLA+; do not label the current explanatory diagram a model-checking result.
