---
name: verify-market-state
description: Verify candle request ownership, cancellation, forced refresh, and saved-data fallback in Bitcoin Cycle Atlas. Use when changing market-data-controller.js, its async guards, callback ordering, or the model and regression checks that protect the chart from stale responses.
---

# Verify market request state

Keep this promise: **a canceled or superseded request never replaces or notifies the displayed chart.** A broken guard can overwrite a fresh price view with a late saved response.

## Coverage and synchronization

- Covered implementation: `dist/market-data-controller.js`, `createMarketDataController`, specifically `load`, `cancel`, and the ownership checks before publishing network results, saved fallback results, or errors.
- Last correspondence review: commit `d4e27dbb18cbe00af733779723b9db9406e243ef`. The committed `load` and `cancel` paths, post-await ownership guards, and publication continuations were checked against the model, then the formal gate was rerun successfully. Controller SHA-256: `f1ac6e876f7271f7fc5d17e591cdb5488fd85246be49c57e1566786ba4e5c4ce`.
- Model: `verification/market-state/MarketRequests.tla`; configuration bounds requests to three generations and two intervals. `MarketRequestsBroken.tla` is a deliberate negative control, not an observed production bug.
- Actual-code checks: `tests/market-data-controller.test.mjs`, `tests/intraday-history.test.mjs`, and `tests/market-request-ownership.test.mjs`.
- Read `docs/formal-state/README.md` for the model-to-code mapping, assumptions, evidence, and chart commands. The intraday tests cover examples; pagination itself is outside the TLA+ proof.

## Run

From the repository root, with Node 24+ and Java 11+:

```sh
node scripts/verify-market-state.mjs
```

The runner downloads TLC 1.7.4 from its official release into ignored `build/formal-tools/` and checks its SHA-256. For an offline run, set `TLA2TOOLS` to the same verified jar. Do not silently accept another tool version or a download/hash error.

Expect all four checks: the current model passes; the broken model violates `NoStaleDisplay`; actual controller regressions pass; removing the saved-fallback ownership guard in a temporary copy causes the expected assertion failure. The runner deletes its temporary copy and never mutates product files.

## Review a change

1. Compare covered source with the synchronization commit. Trace each `await`, request replacement, cancellation, and publication against its action in the model.
2. Treat each modeled action as a synchronous continuation. Split an action if new code adds an `await` inside it. Preserve canceled requests as possible late completions; abort is not proof that a response cannot arrive.
3. Run the command and inspect its real exit status. Confirm named tests actually execute; file-level sandbox summaries alone are insufficient evidence. An execution-policy error or incomplete TLC run is blocked, never passed.
4. Reproduce a newly reported counterexample against real code with a deterministic deferred response. If it does not reproduce, repair the model's correspondence; do not weaken the invariant to obtain green output.
5. If an intended behavior changes, update source, model, code regressions, and the negative-control mutation together. The selector intentionally fails closed when the guarded code has changed.
6. Move the synchronization commit forward only after checking the mapping against the committed code and rerunning verification. Update the source hash and evidence together.

## Interpretation

A pass verifies the invariant within the stated finite model. It does not prove price forecasts, unrestricted request counts, clock timing, rate limiting, browser rendering, memory use, or eventual completion. Report the current code result separately from the deliberate mutation result. For later unrelated edits, use pstack `maintain-formal-verification-skill` to check whether this skill has drifted.
