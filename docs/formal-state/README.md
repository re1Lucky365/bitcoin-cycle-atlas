# Market request ownership: bounded formal verification

Audit base: [`e15ae31a4223d127244b6d630ae4b7c910f653ef`](https://github.com/twoimo/bitcoin-cycle-atlas/tree/e15ae31a4223d127244b6d630ae4b7c910f653ef).

Last code/model correspondence review: [`c7fbf50c34a45386300336756b5fd42a0fab0363`](https://github.com/twoimo/bitcoin-cycle-atlas/tree/c7fbf50c34a45386300336756b5fd42a0fab0363). The previous synchronization commit was `780a33ccdaf5d5eb502249ab47ecf9d660858724`. The intervening `2ea9a54` ETH extension adds a product fixed for each controller, its snapshot URL, parser/fetch arguments and labels. Each controller still owns its cache, snapshot promise and active request. The covered `load`/`cancel` continuations gain no await or shared writer, and their publication guards do not move. The single-controller model therefore keeps its meaning with product treated as a fixed parameter.

Maintenance outcome: **updated correspondence records; unchanged model semantics and bounds**. The current model, all 30 implementation regressions and the actual saved-fallback guard mutation were rerun successfully. Nine ETH regressions also passed; they are executable examples, not a cross-product TLA+ proof. The state counts below are unchanged. This check does not extend the model to pagination, workspace saving, indicator templates, CSV export, chart rendering or first-screen initialization.

**The current ownership guard passed this audit.** No existing asynchronous overwrite defect was reproduced. The red/green comparison is a deliberate negative control: remove one guard, observe failure, then compare against the existing correct code. It is not evidence that this audit repaired a production race.

## Property and practical consequence

`NoStaleDisplay`: a request canceled or superseded by another request must never supply a later displayed result. This protects a freshly selected or refreshed chart from an older saved snapshot arriving late. Callback checks in the executable regressions also ensure a revoked request cannot schedule a stale UI update.

The model has two interval caches (`one` = `1m`, `five` = `5m`) and at most three request generations. TLC exhaustively enumerates its allowed interleavings of request start, cancellation/replacement, exchange success/failure, and saved-data success/failure. This is a finite-state verification of request ownership, not a mathematical proof of Bitcoin prices or forecast validity.

## Evidence

| Check | Observed result |
| --- | --- |
| Current TLA+ model | 5,955 generated states; 2,081 distinct states; 0 states left; invariant holds |
| Current complete state graph | 2,081 states; 5,954 transitions |
| Current full chart projection | 6 visible states; 13 transitions |
| Deliberately broken model, first-counterexample run | Invariant fails; 151 generated; 109 distinct; 79 queued when intentionally stopped |
| Actual controller/history/ownership regressions | 30 tests passed, 0 failed |
| Actual-code mutation | Removing the saved-fallback guard causes the expected stale-update assertion to fail |

These results come from the checked-in summaries and the runner, not estimates. The broken run stops at its first counterexample; its partial state count is not an exhaustive proof. pstack separately explores its complete graph to draw and classify counterexample paths.

## Model-to-code correspondence

| Model component | Actual code or meaning |
| --- | --- |
| `active` | Controller's currently owning request object, abstracted as a unique generation number |
| `interval`, `selected` | Request interval and selected interval; only two representatives are modeled |
| `phase` | Suspended live-fetch or saved-fallback continuation, including already canceled work that may complete late |
| `cancelled` | Verification monitor recording requests whose ownership was revoked; not a new product data structure |
| `displayed` | Generation of the last publication for each interval, not the age of the underlying price quote |
| `status`, `storedStatus` | Visible loading/ready/snapshot/error state and status restored from retained data on cancellation |
| `Load` | Forced `load` or interval switch: synchronous cancellation and installation of the new owner |
| `Cancel` | `cancel`: revoke owner, abort its signal, restore prior displayed status |
| `LiveSuccess`, `LiveFailure` | Synchronous continuations after `fetchMarketCandles`; ownership checked before publish or fallback |
| `SavedSuccess`, `SavedFailure` | Synchronous continuations after `snapshot`; the post-await ownership guard controls publication |

The model treats each uninterrupted continuation as one step. In this app, `onChange` schedules rendering rather than synchronously starting another controller action. The model permits independent saved-response completions, which overapproximates the shared snapshot promise: extra delivery orders are admitted, not omitted. Cache contents, HTTP parsing, numerical values, snapshot validity, and the exact source of a fallback are abstracted into success/failure. Prefer-snapshot initial loads, history pagination, throttling, wall-clock timeouts, and unbounded liveness are not included in this model; existing executable tests cover selected examples of those behaviors.

## Counterexample replay

The negative control removes only the guard immediately after the saved snapshot is awaited in `load`'s error branch:

1. Open the candle chart; its exchange request fails, so saved candles are requested.
2. Cancel the request, change interval, or force a newer refresh while saved data remains pending.
3. Let the older saved response arrive.
4. With the guard removed, the old response can publish a snapshot or notify the UI. With the existing guard, it is ignored, whether the newer request is still loading or already finished.

`tests/market-request-ownership.test.mjs` exercises both intervals, both old/new completion orders, and old saved-response success/failure: eight deterministic combinations. `scripts/verify-market-state.mjs` copies actual source to a temporary directory, removes that exact guard, verifies the expected assertion failure, and deletes the copy. It fails if the source mutation selector no longer matches, so code drift cannot silently invalidate the negative control.

## Run and reproduce

```sh
node scripts/verify-market-state.mjs
```

Requires Node 24+ and Java 11+. The script downloads and verifies official [TLC 1.7.4](https://github.com/tlaplus/tlaplus/releases/tag/v1.7.4), or accepts `TLA2TOOLS` pointing to the same jar. Its SHA-256 is `936a262061c914694dfd669a543be24573c45d5aa0ff20a8b96b23d01e050e88`. The current controller SHA-256 at correspondence review is `5de1c4b3396551ae71400516f26d35fb6737b0bdad74fcdec403342b2c9991db`.

## Statecharts

- [Current complete projection](current/full-chart.png) and [Mermaid source](current/full-chart.mmd) show all edges between the six visible states. Distinct hidden request/cache states can share a screen label; an arbitrary path through this projection is not itself proof that the hidden model can take that path.
- [Current pstack overview](current/chart.png) and [Mermaid source](current/chart.mmd) keep selected shortest paths. The overview is intentionally not the complete transition relation.
- [Negative-control counterexample](mutation/bug-1.png), [Mermaid source](mutation/bug-1.mmd), and [numbered story](mutation/stories.md) demonstrate the removed guard. Green denotes the existing guard preventing the mutant's bad state.
- Exact chart counts are in `current/summary.json`, `current/full-summary.json`, and `mutation/summary.json`. `verification-summary.json` records the one-command verification output.

Charts were generated with Cursor pstack's [`statechart`](https://github.com/cursor/plugins/tree/eb4db2b55b2b7dec3d9282754cddf0a56bf4ff10/pstack/skills/statechart), pinned at `eb4db2b55b2b7dec3d9282754cddf0a56bf4ff10`, plus Mermaid CLI 12.0.0. From a scratch copy of `verification/market-state/` outside the repository, with `PSTACK` set to that checkout and `TLA2TOOLS` to the verified jar:

```sh
node "$PSTACK/pstack/skills/statechart/scripts/statechart.mjs" from-spec MarketRequests.tla --title 'Candle request state transitions' --out current --png
node "$PSTACK/pstack/skills/statechart/scripts/statechart.mjs" from-spec MarketRequestsBroken.tla --fixed MarketRequests.tla --label 'the existing guard' --expect-broken NoStaleDisplay --title 'Negative control: guard removed' --out mutation --png
node "$PSTACK/pstack/skills/statechart/scripts/tlc-to-chart.mjs" --dot current/tlc/MarketRequests.dot --map MarketRequests.map.mjs --spec MarketRequests.tla --highlight 0 --full-labels --title 'Candle request transitions: all projected edges' --out full-chart.mmd --summary full-summary.json
npx --yes @mermaid-js/mermaid-cli@12.0.0 -i full-chart.mmd -o full-chart.png -s 2
```

Use a supported local Chromium configuration for PNG rendering. Tool or browser-launch failures are not verification passes; the TLC and image steps have separate failure signals. Keep the source, model, regression replay, and project-local `verify-market-state` skill synchronized after changes.
