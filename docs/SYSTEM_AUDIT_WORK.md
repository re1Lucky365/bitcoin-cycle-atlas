# System audit work record

Baseline: `347997f02d3674259d4ad6e1f788419bde4811bd` (v1.20.0).
Branch: `codex/system-audit-20261024`.

## Completion criteria

Inspect the current calculation and rendering paths, reproduce material defects, fix their causes, and preserve their regression cases. Check bounded asynchronous state transitions with an executable model, a real-code replay, and deliberately broken controls. Measure performance on fixed inputs with alternating repeated runs and correct-output checks. Independently review the changes before publishing, then confirm the exact published commit and workflows.

## Swarm phases

- [x] Frame
- [x] Fan out
- [x] Aggregate
- [x] Report

## Architecture phases

- [x] Ground
- [x] Sketch
- [x] Agree
- [x] Implement
- [x] Revise an invalidated choice: independent review found a near-maximum overflow in the first weighted-log implementation; replace it with stable endpoint-relative evaluation.

## Coverage and file ownership

| Worker | Inspection and implementation scope | Evidence |
|---|---|---|
| Performance | BTC and treasury generation, render/update hot paths; performance harness and its targeted fixes | Baseline SHA, profile, alternating measurements, output equivalence |
| Mathematics | Treasury transitions, BTC/ETH numerical contracts, analytical claims | Reproducible counterexamples, independent identities, boundary tests |
| State verification | Request ownership, retries, detach/restore; TLA+, statechart, local verification skill | Code mapping, counterexample replay, negative controls, bounded results |
| Standalone packaging | Recursive module duplication, token-aware rewriting, exact source/data preservation | Five deterministic paired builds, real module parsing/linking/evaluation, corruption controls |
| Independent reviewers | Current data/math/state changes and standalone packaging, separately from their authors | A new numerical counterexample and Node 24 compatibility issue found and fixed; explicit review scope |
| Coordinator | Input/source/date boundaries, UI integration, cross-review, release and deployment | Whole-system checks and actual public UI |

The available workers inherit GPT-6 Astra. Cursor-specific Task, Grok and Opus executions are unavailable in this session; those model roles are explicitly substituted. pstack instructions are applied through the available collaboration and command tools. Workers report PASS, ISSUES or BLOCKED and must distinguish model bounds from product-wide proof.

## Decision trail

- Re-read GitHub before writing. Main, PR #20 and v1.20.0 match the baseline. Unrelated open PR #12 is excluded.
- Partition inspection first and coordinate ownership before touching shared files.
- All output claims require an executable check or an explicit limitation. No performance or market-accuracy claim follows merely from a passing test count.
- Use an invocation-local BTC batch rather than a cross-call price/model cache. Preserve correction freshness and isolate returned metadata.
- Use existing date-window helpers rather than adding a second rendering cache. Full numerical validation remains linear.
- Keep the existing generation-token architecture and verify its actual continuations; a new controller/reducer would add ownership without resolving the boot boundary.
- Retain whole-history equity replacement after completeness validation. Mixing previous split-adjusted values with a newer provider vintage would create a different data error.
- Preserve the existing absorbed-zero convention, expose its branch and lifecycle explicitly, and do not invent a restructuring or rescue-funding path.
- Package one data URL per physical module using an import map, preserving the previous query/hash alias policy. Verify actual source/data and real module execution separately from browser policy.
- Keep isolated performance measurements and their exact production patch distinct from subsequent accounting and UI changes.
- Recheck the older candle verification skill against the fixed-product ETH extension, and pin both verification skills to publicly preserved code rather than an unreachable local worker SHA.
- Full integrated `npm test`: 908 tests, zero failures, cancellations or skips. Research, financial identities, both formal gates, cycle/performance, static and standalone checks pass; see the linked reports for their bounds.

The [system report](SYSTEM_AUDIT_SUMMARY.md), [independent review](SYSTEM_INDEPENDENT_REVIEW.md) and [release notes](RELEASE_V1_21.md) collect the results. The GitHub Actions and release metadata identify the exact externally published source; local isolated measurement commits are labeled as such and are not presented as public release commits.
