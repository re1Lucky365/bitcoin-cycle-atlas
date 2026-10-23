# Research workflows final gates — 1.13.0

- Completed: 2026-10-23T10:40:45.274861+00:00
- Git base: `a71cdc3765fc7913dc0d9c57c94365619a4bcb0b`; validation applies to the frozen shared working tree, not merely this base commit.
- Node: v24.19.0
- Source, tests, scripts, package and formal inputs: **193 files unchanged** before/after all gates. Documentation, QA files and generated build files excluded.

## Tests

- `npm test`: **66/66 file-level runner boundaries** passed. These are not 66 actual application cases.
- Direct `node tests/<file>.test.mjs`, at most four concurrent processes: **66 files**; **61 node:test files, 572/572 actual cases**; **5 legacy harness files, 44/44 named regression scenarios**.
- Aggregate: **616/616 cases/scenarios**, failures 0, skipped 0. This is not a count of individual assert() calls.
- The npm file-level runner and formal's repeated implementation regressions are not added a second time.

| Custom harness | Scenarios |
|---|---:|
| `tests/cycle-engine.test.mjs` | 10 |
| `tests/cycle-timing.test.mjs` | 12 |
| `tests/data-source.test.mjs` | 10 |
| `tests/peak-zones.test.mjs` | 10 |
| `tests/timing-view.test.mjs` | 2 |

## Gates

| Gate | Result |
|---|---|
| npm test | PASS |
| Every test file directly | PASS |
| verify:cycle | PASS |
| verify:performance | PASS |
| verify:static | PASS |
| build:standalone | PASS |
| Standalone static verification | PASS |
| verify:formal | PASS after environment permission retry |

The initial formal attempt was blocked by `spawnSync java EPERM` before running the model. The identical pinned local TLC command passed with `require_escalated`; both attempt logs are retained. No application source was changed in response.

## Evidence and limits

- Cycle snapshot: 5,941 observations through 2026-10-22; canonical calibration verified without writing it.
- Performance: 5,545 real candles and 5,545 volume shapes preserved in 103 SVG elements, below the 120 element budget. This is deterministic Node renderer/search testing, not browser frame-time measurement.
- Static: 100 files and 203 resource references checked under the GitHub Pages project subpath; standalone check also passed.
- Standalone: 72 embedded modules, 5,941 observations, 16,758,597 bytes. SHA-256 `84ad5e576786e16a0cfccb5a252233c16f53e4c042e91ae2671d15113a0c7793`.
- Formal good model: 5,955 generated states, 2,081 distinct, 0 remaining; no invariant error. Broken model produces the expected stale-display invariant violation. Real-code removed-guard mutation produces the expected assertion failure in a temporary copy.
- Formal scope: bounded abstract request-ownership model. It is not a whole-program, financial-model, numerical, pagination, wall-clock or liveness proof.

Machine-readable gate results and case counts are preserved in `verification.json`. Source manifests are in `source-hashes.json`. Full execution logs were retained in the validation workspace; they are not shipped as application assets. Browser evidence and limitations are in `../RESEARCH_WORKFLOWS_2026-10-23.md`.
