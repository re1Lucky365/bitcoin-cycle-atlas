---
name: verify-eth-state
description: Verify Ethereum chart readiness, page suspension and restoration, request ownership, and refresh navigation after changes to eth-view.js or its boot integration. Run the bounded TLA+ checks and complete production-initializer regressions, and prove they catch deliberate real-code mutations.
---

# Verify ETH state

## Promise and scope

An ETH document announces readiness only after it renders observed prices or an
actionable retry error. A suspended or superseded request cannot publish into the
current chart, and refresh cannot reset navigation chosen while it was pending.
Readiness is emitted once for each document.

Covered runtime: dist/eth-view.js — initEthView, load, render, revealReady,
schedule, changeInterval, date/price navigation callbacks, pagehide, and
pageshow. The replay also executes the real inline boot script in dist/index.html,
archive parsers, and intraday controller at its actual import boundary.
Review the history-jump availability checks in dist/ethereum-history.js and the
post-await focusHistoricalEvent writer whenever either changes: daily coverage
and cached daily loading establish the current abstraction's focus boundary.

Baseline commit: 64c8207cb044d8990289c5a7d39972e21b74c240.
Last code/model synchronization commit: 1ad3be543e870e74f10708c266f19572b217d25f.
The correspondence review includes the committed ETH fix and v1.23.0 import URLs.
Reviewed runtime SHA-256:
bd57616e5ed9515fb876e93bf12d8ff4cf185825465e4e82c0b86b5dde47ab5d.
See docs/formal-eth/README.md for the committed review revision, every action and
guard's code mapping, actual bug replays, bounds, and result receipts.

## Run the check

From the repository root:

    node scripts/verify-eth-state.mjs

Requires Node.js and Java 11 or later. The checker pins the official TLC release
1.7.4 jar to SHA-256
936a262061c914694dfd669a543be24573c45d5aa0ff20a8b96b23d01e050e88.
It uses build/formal-tools/tla2tools-1.7.4.jar and downloads that pinned release
only if missing. For an offline installation, set TLA2TOOLS to that exact jar;
JAVA may select a Java binary. A supplied jar with a different hash fails.

An optional output argument writes a machine-readable receipt:

    node scripts/verify-eth-state.mjs /tmp/eth-state-receipt.json

The command must report all of the following:

1. Current model passes every invariant within three request generations,
   daily/weekly display, and automatic/custom range choices.
2. The original baseline still fails its three recorded safety properties.
   Deliberately removed response, error, suspension and navigation guards fail
   the corresponding invariant. Do not weaken a property to make a failure pass.
3. All 17 complete-initializer replay cases pass, including intraday refresh
   integration and the information dialog's escaped data link.
4. All nine mutations of a temporary copy of the real production module fail
   their intended assertions. The restored temporary module passes all 17 cases.
   The working runtime is never mutated by the checker.

Read both the exit status and actual test counts. A runner reporting only test
filenames, a Java/tool failure, a missing mutation selector, or a skipped replay
is not a verification pass. The verifier requires an actual 17-case TAP plan,
17 passes, zero failures, skips, cancellations and todos for original/restored
runs. Every mutation must execute all 17 cases with at least one intended failure
and no skipped or cancelled cases.

## Read the statecharts

Read every TLA+ result with the pstack /statechart skill. Use its current
instructions and help rather than copying external script paths or options
into this skill. Keep the original properties, compare the preserved baseline
configuration with the fixed model, render every chart, inspect every PNG, and
replay each counterexample through the real initializer.

The checked-in Mermaid/PNG charts, shortest bug stories and summary.json in
docs/formal-eth/statechart are a receipt for the reviewed model. They are not
independent proof of the current JavaScript. Regenerate them after any action,
guard, configuration or mapping changes.

## Maintain correspondence

Before trusting a previous pass, diff the covered runtime and boot script from
the reviewed revision. Revisit every await and every writer of prices, errors,
readiness, range, request generation and suspension. Confirm that each TLA+
action remains one JavaScript continuation and each model guard maps to a real
check or an explicitly documented bound/environment assumption.

Update these together when behavior changes:

- verification/eth-state/EthLoad.tla and reviewed configurations.
- verification/eth-state/EthLoad.map.mjs and docs/formal-eth/README.md mappings.
- tests/eth-load-ownership.test.mjs and tests/helpers/eth-view-fixture.mjs.
- scripts/verify-eth-state.mjs mutation selectors and expected results.
- Model, replay and statechart receipts, reviewed commit and source hash.

The replay runs the whole initializer; do not replace it with extracted private
load/render functions or a second implementation of ownership logic. If a model
counterexample does not replay, inspect the model's atomicity, environment
assumptions and fixture boundaries before changing runtime behavior.

After a real covered-code change, follow /maintain-formal-verification-skill.
Review this skill from a fresh context and rerun its command before recording a
new sync point.

## Limits

This is bounded safety verification, not an unbounded or whole-program proof.
The model abstracts daily/weekly archive and refresh state; intraday internals
remain under verify-market-state and real ETH integration replays. It assumes
valid parsed prices, allows aborted HTTP to complete late, and deliberately
allows old callbacks to run while suspended. This last over-approximation tests
defensive guards; it does not claim a browser normally renders a frozen BFCache
document. The replay injects DOM, rendering, HTTP, timers, animation frames and
import boundaries. Neither layer proves browser pixels/timing, economic
correctness, historical-event causation, scheduler fairness, eventual completion,
or behavior after arbitrarily many generations.
