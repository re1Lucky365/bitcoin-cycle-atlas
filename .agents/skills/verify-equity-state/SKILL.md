---
name: verify-equity-state
description: Verify MSTR and BMNR chart readiness, archive request ownership, projection invalidation, page suspension and restoration, and user range preservation. Use when changing dist/equity-view.js load/render/page lifecycle logic, the index.html boot handshake, or the corresponding TLA+ model and regression fixture.
---

# Verify equity chart state

Keep the observed chart usable while its forecast is pending. Never let revoked work overwrite newer prices, projections or errors. A correct calculation can still mislead if the UI pairs it with different inputs.

## Coverage and synchronization

- Covered code: `dist/equity-view.js` functions `load`, `render`, `schedule`, `revealReady`, interval/range callbacks, and `pagehide`/`pageshow`; `dist/index.html` boot-script handshake.
- Last correspondence review: commit `c7fbf50c34a45386300336756b5fd42a0fab0363`. Equity view SHA-256: `0e9cd421cdd831a6fdd618f2ceb87f1d8353a6054d93e40ecf4356dd8c490a3d`.
- Model: `verification/equity-state/EquityLoad.tla`. Bounds: three request generations, daily/weekly displays, automatic/custom range choices. Network continuations and the two animation-frame yields are separate.
- Actual-code replay: `tests/equity-load-ownership.test.mjs` and `tests/helpers/equity-view-fixture.mjs`. The complete production initializer and actual inline boot script execute with HTTP, imports, rendering and DOM boundaries injected. The test does not copy `load` or inspect its hidden locals.
- Read `docs/formal-equity/README.md` for correspondence and scope. Existing `verify-market-state` separately covers the crypto candle controller.

## Run

From the repository root with Node 24+ and Java 11+:

```sh
node scripts/verify-equity-state.mjs
```

The runner downloads official TLC release 1.7.4 and verifies SHA-256 `936a262061c914694dfd669a543be24573c45d5aa0ff20a8b96b23d01e050e88`. For offline execution, set `TLA2TOOLS` to the same jar. `JAVA` can select a binary. Launch, download, checksum, timeout or incomplete-enumeration errors are blocked checks, never passes.

Expect the current model to pass. The old boot order and deliberate model mutations must fail their named invariants. Expect 28 actual UI replay cases to pass, seven mutations of temporary product copies to fail the intended assertion, and the restored copy to pass. Exact mutation selectors fail closed on source drift. Product files are never mutated by this command.

Read every TLA+ result with pstack `/statechart`, including passing results. Follow that skill's current instructions; do not assume copied options or machine paths remain valid. It shows numbered failure stories and successful state transitions. Use `/maintain-formal-verification-skill` after unrelated changes that did not recheck correspondence.

## Review a change

1. Compare covered source with the synchronization commit. Map every publication and `await`; keep final initialization separate from per-load continuations.
2. Update source references on model conditions. Do not invent guards. Preserve documented extra delivery orders rather than assuming abort prevents late work.
3. Check both readiness writers. `Render` and `InitialFrame` must update the hidden-readiness monitor whenever they can first make the page ready.
4. Replay each counterexample through public initializer/callback entry points and observable boot attributes, rendered inputs and status. If it does not reproduce, inspect correspondence before changing code or weakening a rule.
5. Keep price failure separate from forecast failure. Rejected coin inputs or calculations leave the observed chart usable. Fresh prices invalidate an old projection before publishing a new one.
6. Run the command and inspect named tests and expected negative-control failures. A file-level pass summary alone is insufficient.
7. After confirming correspondence on committed code, advance this synchronization commit and source hash, regenerate evidence and review the charts. Verification does not automatically follow changed code.

## Scope

This is finite-state verification, not an unbounded or whole-program proof. The model permits extra callback and input orders, including suspended callbacks. That adversarial trace does not establish a particular browser's scheduling behavior. Forecast accuracy, numerical formulas, pixels, latency, liveness and rendering dependencies are outside this check.
